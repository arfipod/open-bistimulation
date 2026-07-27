import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TACTILE_INTERNAL_PAUSE_MS } from '../domain/defaults';
import { getMotionSnapshot, getServerNowMs } from '../domain/motion';
import type { JoyConOutputStatus, SessionState, TactileSide } from '../domain/sessionTypes';
import type { JoyConIntensity } from '../lib/joyconTypes';
import { neutralJoyCon, pulseJoyCon } from '../lib/joyconWebHidClient';

interface UseJoyConTactileOutputOptions {
  state: SessionState;
  serverTimeOffsetMs: number;
  intensity: JoyConIntensity;
  enabled: boolean;
}

export type JoyConTactileOutputStatus = JoyConOutputStatus;

const IDLE_STATUS: JoyConOutputStatus = {
  lastPulseSide: null,
  lastPulseAt: null,
  pulseCount: 0,
  lastError: null,
  skippedPulseCount: 0,
};

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : 'Joy-Con tactile request failed.';
}

export function useJoyConTactileOutput({
  state,
  serverTimeOffsetMs,
  intensity,
  enabled,
}: UseJoyConTactileOutputOptions): JoyConTactileOutputStatus {
  const [status, setStatus] = useState<JoyConTactileOutputStatus>(IDLE_STATUS);
  const mountedRef = useRef(false);
  const wasActiveRef = useRef(false);
  const lastHalfCycleRef = useRef<number | null>(null);
  const lastPulseStartedAtRef = useRef<Record<TactileSide, number | null>>({ left: null, right: null });
  const pulseInFlightRef = useRef<Record<TactileSide, boolean>>({ left: false, right: false });
  const pulseCountRef = useRef(0);
  const skippedPulseCountRef = useRef(0);
  const faultedRef = useRef(false);
  const operationGenerationRef = useRef(0);
  const wasEnabledRef = useRef(enabled);

  const active = enabled && !faultedRef.current && state.status === 'running' && state.tactile.enabled;

  const updateStatus = useCallback((recipe: (current: JoyConOutputStatus) => JoyConOutputStatus) => {
    if (mountedRef.current) {
      setStatus(recipe);
    }
  }, []);

  const recordSkippedPulse = useCallback(() => {
    skippedPulseCountRef.current += 1;
    const skippedPulseCount = skippedPulseCountRef.current;

    updateStatus((current) => ({
      ...current,
      skippedPulseCount,
    }));
  }, [updateStatus]);

  const recordError = useCallback(
    (error: unknown) => {
      const lastError = messageFromError(error);
      updateStatus((current) => ({
        ...current,
        lastError,
      }));
    },
    [updateStatus],
  );

  const resetTimingRefs = useCallback(() => {
    lastHalfCycleRef.current = null;
    lastPulseStartedAtRef.current = { left: null, right: null };
  }, []);

  const latchFault = useCallback(
    (error: unknown, operationGeneration: number) => {
      if (operationGeneration !== operationGenerationRef.current) {
        return;
      }

      faultedRef.current = true;
      operationGenerationRef.current += 1;
      wasActiveRef.current = false;
      resetTimingRefs();
      recordError(error);

      const faultGeneration = operationGenerationRef.current;
      void neutralJoyCon({ side: 'both' }).catch((neutralError) => {
        if (!faultedRef.current || faultGeneration !== operationGenerationRef.current) {
          return;
        }

        recordError(
          new Error(
            `${messageFromError(error)} Neutral command also failed: ${messageFromError(neutralError)}`,
          ),
        );
      });
    },
    [recordError, resetTimingRefs],
  );

  const sendNeutral = useCallback(
    () => {
      const operationGeneration = operationGenerationRef.current;

      void neutralJoyCon({ side: 'both' })
        .then(() => {
          if (!faultedRef.current && operationGeneration === operationGenerationRef.current) {
            updateStatus((current) => ({
              ...current,
              lastError: null,
            }));
          }
        })
        .catch((error) => {
          latchFault(error, operationGeneration);
        });
    },
    [latchFault, updateStatus],
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (enabled && !wasEnabledRef.current) {
      operationGenerationRef.current += 1;
      faultedRef.current = false;
      updateStatus((current) => ({ ...current }));
    }
    wasEnabledRef.current = enabled;
  }, [enabled, updateStatus]);

  useEffect(() => {
    if (active) {
      wasActiveRef.current = true;
      return;
    }

    resetTimingRefs();

    if (wasActiveRef.current) {
      wasActiveRef.current = false;
      sendNeutral();
    }
  }, [active, resetTimingRefs, sendNeutral]);

  useEffect(() => {
    return () => {
      if (wasActiveRef.current) {
        sendNeutral();
      }
    };
  }, [sendNeutral]);

  useEffect(() => {
    if (!active) {
      resetTimingRefs();
      return;
    }

    let frame = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled || faultedRef.current) {
        return;
      }

      const nowMs = getServerNowMs(serverTimeOffsetMs);
      const snapshot = getMotionSnapshot(state, nowMs);

      if (lastHalfCycleRef.current === null) {
        lastHalfCycleRef.current = snapshot.halfCycleIndex;
      } else if (snapshot.halfCycleIndex !== lastHalfCycleRef.current) {
        lastHalfCycleRef.current = snapshot.halfCycleIndex;

        const minSpacingMs = state.tactile.pulseDurationMs + TACTILE_INTERNAL_PAUSE_MS;
        const side = snapshot.side;
        const lastPulseStartedAt = lastPulseStartedAtRef.current[side];
        const isInsideGap = lastPulseStartedAt !== null && nowMs - lastPulseStartedAt < minSpacingMs;

        if (pulseInFlightRef.current[side] || isInsideGap) {
          recordSkippedPulse();
        } else {
          lastPulseStartedAtRef.current[side] = nowMs;
          pulseInFlightRef.current[side] = true;
          pulseCountRef.current += 1;

          const pulseCount = pulseCountRef.current;
          const operationGeneration = operationGenerationRef.current;

          updateStatus((current) => ({
            ...current,
            lastPulseSide: side,
            lastPulseAt: nowMs,
            pulseCount,
          }));

          void pulseJoyCon({
            side,
            duration: state.tactile.pulseDurationMs,
            repeats: 1,
            intensity,
          })
            .then(() => {
              if (!faultedRef.current && operationGeneration === operationGenerationRef.current) {
                updateStatus((current) => ({
                  ...current,
                  lastError: null,
                }));
              }
            })
            .catch((error) => {
              latchFault(error, operationGeneration);
            })
            .finally(() => {
              pulseInFlightRef.current[side] = false;
            });
        }
      }

      if (!cancelled && !faultedRef.current) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [active, intensity, latchFault, recordSkippedPulse, resetTimingRefs, serverTimeOffsetMs, state, updateStatus]);

  return useMemo(
    () => ({
      ...status,
    }),
    [status],
  );
}
