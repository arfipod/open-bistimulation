import { useEffect, useRef } from 'react';
import { createAudioEngine, type AudioEngine } from '../domain/audioEngine';
import { getMotionSnapshot, getServerNowMs } from '../domain/motion';
import type { SessionRole, SessionState } from '../domain/sessionTypes';

interface UseAudioBlsOptions {
  state: SessionState;
  serverTimeOffsetMs: number;
  unlocked: boolean;
  role: SessionRole;
}

export function useAudioBls({ state, serverTimeOffsetMs, unlocked, role }: UseAudioBlsOptions): string | null {
  const engineRef = useRef<AudioEngine | null>(null);
  const lastHalfCycleRef = useRef<number | null>(null);
  const errorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!unlocked || !state.audio.enabled) {
      return;
    }

    if (role === 'therapist' && state.audio.therapistMuted) {
      return;
    }

    try {
      engineRef.current ??= createAudioEngine();
      errorRef.current = null;
    } catch (error) {
      errorRef.current = error instanceof Error ? error.message : 'Audio could not be initialized.';
      return;
    }

    let frame = 0;

    const tick = () => {
      if (state.status === 'running') {
        const snapshot = getMotionSnapshot(state, getServerNowMs(serverTimeOffsetMs));

        if (lastHalfCycleRef.current === null) {
          lastHalfCycleRef.current = snapshot.halfCycleIndex;
        } else if (snapshot.halfCycleIndex !== lastHalfCycleRef.current) {
          lastHalfCycleRef.current = snapshot.halfCycleIndex;
          engineRef.current?.play(state.audio.sound, snapshot.side, state.audio.volume);
        }
      } else {
        lastHalfCycleRef.current = null;
      }

      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [role, serverTimeOffsetMs, state, unlocked]);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  return errorRef.current;
}
