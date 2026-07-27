import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioEngine, type AudioEngine } from '../domain/audioEngine';
import { getMotionSnapshot, getServerNowMs } from '../domain/motion';
import type { SessionRole, SessionState } from '../domain/sessionTypes';

interface UseAudioBlsOptions {
  state: SessionState;
  serverTimeOffsetMs: number;
  unlocked: boolean;
  role: SessionRole;
}

export interface UseAudioBlsResult {
  error: string | null;
  isUnlocked: boolean;
  unlock: () => Promise<boolean>;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : 'Audio could not be initialized.';
}

export function useAudioBls({ state, serverTimeOffsetMs, unlocked, role }: UseAudioBlsOptions): UseAudioBlsResult {
  const engineRef = useRef<AudioEngine | null>(null);
  const lastHalfCycleRef = useRef<number | null>(null);
  const unlockPromiseRef = useRef<Promise<boolean> | null>(null);
  const mountedRef = useRef(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlock = useCallback((): Promise<boolean> => {
    if (unlockPromiseRef.current) {
      return unlockPromiseRef.current;
    }

    let engine: AudioEngine;

    try {
      engineRef.current ??= createAudioEngine();
      engine = engineRef.current;
    } catch (nextError) {
      if (mountedRef.current) {
        setIsUnlocked(false);
        setError(messageFromError(nextError));
      }
      return Promise.resolve(false);
    }

    const attempt = engine
      .unlock()
      .then(() => {
        const nextIsUnlocked = engine.isUnlocked();

        if (mountedRef.current) {
          setIsUnlocked(nextIsUnlocked);
          setError(nextIsUnlocked ? null : 'The browser did not allow audio output. Try enabling audio again.');
        }

        return nextIsUnlocked;
      })
      .catch((nextError: unknown) => {
        if (mountedRef.current) {
          setIsUnlocked(false);
          setError(messageFromError(nextError));
        }
        return false;
      })
      .finally(() => {
        if (unlockPromiseRef.current === attempt) {
          unlockPromiseRef.current = null;
        }
      });

    unlockPromiseRef.current = attempt;
    return attempt;
  }, []);

  useEffect(() => {
    if (!unlocked || !isUnlocked || !state.audio.enabled || state.status !== 'running') {
      lastHalfCycleRef.current = null;
      return;
    }

    if (role === 'therapist' && state.audio.therapistMuted) {
      lastHalfCycleRef.current = null;
      return;
    }

    const engine = engineRef.current;

    if (!engine?.isUnlocked()) {
      lastHalfCycleRef.current = null;
      setIsUnlocked(false);
      return;
    }

    let frame = 0;
    let cancelled = false;

    const tick = () => {
      const snapshot = getMotionSnapshot(state, getServerNowMs(serverTimeOffsetMs));

      if (lastHalfCycleRef.current === null) {
        lastHalfCycleRef.current = snapshot.halfCycleIndex;
      } else if (snapshot.halfCycleIndex !== lastHalfCycleRef.current) {
        lastHalfCycleRef.current = snapshot.halfCycleIndex;
        try {
          engine.play(state.audio.sound, snapshot.side, state.audio.volume);
          setError(null);
        } catch (nextError) {
          setIsUnlocked(false);
          setError(messageFromError(nextError));
          return;
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
  }, [isUnlocked, role, serverTimeOffsetMs, state, unlocked]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      unlockPromiseRef.current = null;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  return { error, isUnlocked, unlock };
}
