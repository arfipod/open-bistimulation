import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getMotionSnapshot, getServerNowMs } from '../domain/motion';
import type { SessionState, TactileSide } from '../domain/sessionTypes';
import type { JoyConIntensity } from '../lib/joyconTypes';
import { neutralJoyCon, pulseJoyCon } from '../lib/joyconWebHidClient';

interface UseJoyConTactileOutputOptions {
  state: SessionState;
  serverTimeOffsetMs: number;
  intensity: JoyConIntensity;
  enabled: boolean;
}

export interface JoyConTactileOutputStatus {
  lastPulseSide: TactileSide | null;
  lastPulseAt: number | null;
  pulseCount: number;
  lastError: string | null;
  skippedPulseCount: number;
}

const IDLE_STATUS: JoyConTactileOutputStatus = {
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
  const lastPulseStartedAtRef = useRef<number | null>(null);
  const pulseInFlightRef = useRef(false);
  const neutralInFlightRef = useRef(false);
  const pulseCountRef = useRef(0);
  const skippedPulseCountRef = useRef(0);

  const active = enabled && state.status === 'running' && state.tactile.enabled;

  const updateStatus = useCallback((recipe: (current: JoyConTactileOutputStatus) => JoyConTactileOutputStatus) => {
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
    lastPulseStartedAtRef.current = null;
  }, []);

  const sendNeutral = useCallback(
    () => {
      if (neutralInFlightRef.current) {
        return;
      }

      neutralInFlightRef.current = true;
      void neutralJoyCon({ side: 'both' })
        .then(() => {
          updateStatus((current) => ({
            ...current,
            lastError: null,
          }));
        })
        .catch(recordError)
        .finally(() => {
          neutralInFlightRef.current = false;
        });
    },
    [recordError, updateStatus],
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

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
      const nowMs = getServerNowMs(serverTimeOffsetMs);
      const snapshot = getMotionSnapshot(state, nowMs);

      if (lastHalfCycleRef.current === null) {
        lastHalfCycleRef.current = snapshot.halfCycleIndex;
      } else if (snapshot.halfCycleIndex !== lastHalfCycleRef.current) {
        lastHalfCycleRef.current = snapshot.halfCycleIndex;

        const minSpacingMs = state.tactile.pulseDurationMs + state.tactile.gapMs;
        const lastPulseStartedAt = lastPulseStartedAtRef.current;
        const isInsideGap = lastPulseStartedAt !== null && nowMs - lastPulseStartedAt < minSpacingMs;

        if (pulseInFlightRef.current || isInsideGap) {
          recordSkippedPulse();
        } else {
          lastPulseStartedAtRef.current = nowMs;
          pulseInFlightRef.current = true;
          pulseCountRef.current += 1;

          const pulseCount = pulseCountRef.current;
          const side = snapshot.side;

          updateStatus((current) => ({
            ...current,
            lastPulseSide: side,
            lastPulseAt: nowMs,
            pulseCount,
            lastError: null,
          }));

          void pulseJoyCon({
            side,
            duration: state.tactile.pulseDurationMs,
            repeats: 1,
            intensity,
          })
            .catch(recordError)
            .finally(() => {
              pulseInFlightRef.current = false;
            });
        }
      }

      if (!cancelled) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [active, intensity, recordError, recordSkippedPulse, resetTimingRefs, serverTimeOffsetMs, state, updateStatus]);

  return useMemo(
    () => ({
      ...status,
    }),
    [status],
  );
}
