import { useEffect, useRef } from 'react';
import { getMotionSnapshot, getServerNowMs } from '../domain/motion';
import type { SessionBroadcastMessage, SessionState } from '../domain/sessionTypes';

interface UseTactilePulseEmitterOptions {
  state: SessionState;
  serverTimeOffsetMs: number;
  send: (message: SessionBroadcastMessage) => Promise<void>;
}

export function useTactilePulseEmitter({ state, serverTimeOffsetMs, send }: UseTactilePulseEmitterOptions): void {
  const lastHalfCycleRef = useRef<number | null>(null);
  const sequenceRef = useRef(0);

  useEffect(() => {
    if (!state.tactile.enabled) {
      lastHalfCycleRef.current = null;
      return;
    }

    let frame = 0;
    let cancelled = false;

    const tick = () => {
      if (state.status === 'running') {
        const snapshot = getMotionSnapshot(state, getServerNowMs(serverTimeOffsetMs));

        if (lastHalfCycleRef.current === null) {
          lastHalfCycleRef.current = snapshot.halfCycleIndex;
        } else if (snapshot.halfCycleIndex !== lastHalfCycleRef.current) {
          lastHalfCycleRef.current = snapshot.halfCycleIndex;
          sequenceRef.current += 1;

          void send({
            kind: 'TACTILE_PULSE',
            side: snapshot.side,
            durationMs: state.tactile.pulseDurationMs,
            sequence: sequenceRef.current,
            emittedAtMs: getServerNowMs(serverTimeOffsetMs),
          });
        }
      } else {
        lastHalfCycleRef.current = null;
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
  }, [send, serverTimeOffsetMs, state]);
}
