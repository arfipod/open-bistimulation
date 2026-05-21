import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SessionBroadcastMessage, SessionPreferences, SessionState, TactileDeviceStatus, TactileSide } from '../domain/sessionTypes';
import {
  completeStopPlayback,
  formatElapsedTime,
  getElapsedMs,
  getServerNowMs,
  getStoppingDurationMs,
  isStopTransitionComplete,
  pausePlayback,
  resetPlaybackCounters,
  resumePlayback,
  retimeMotionForVisualChange,
  startPlayback,
  stopPlayback,
} from '../domain/motion';
import { endBlsSession, getBlsSession, getServerTimeMs, saveTherapistPreferences, saveTherapistState } from '../lib/sessionApi';
import { saveLocalPreferences } from '../lib/localStorage';
import { clientUrl } from '../lib/url';
import { useI18n } from '../lib/i18n';
import { useServerClock } from '../hooks/useServerClock';
import { useSessionRealtime } from '../hooks/useSessionRealtime';
import { useTactilePulseEmitter } from '../hooks/useTactilePulseEmitter';
import { useAudioBls } from '../hooks/useAudioBls';
import { useTicker } from '../hooks/useTicker';
import { AppHeader } from '../components/AppHeader';
import { AuditoryPanel } from '../components/AuditoryPanel';
import { ClientPreview } from '../components/ClientPreview';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { ErrorView } from '../components/ErrorView';
import { InviteClient } from '../components/InviteClient';
import { LoadingView } from '../components/LoadingView';
import { SessionControls } from '../components/SessionControls';
import { SessionStats } from '../components/SessionStats';
import { TactilePanel } from '../components/TactilePanel';
import { VisualPanel } from '../components/VisualPanel';

interface TherapistSessionPageProps {
  sessionId: string;
  token?: string;
}

const STALE_AFTER_MS = 15_000;
const DEFAULT_ROUND_DURATION_MS: number | null = null;

function emptyDevice(side: TactileSide): TactileDeviceStatus {
  return {
    side,
    deviceId: null,
    label: null,
    connected: false,
    lastSeenAtMs: null,
  };
}

function normalizeDevice(device: TactileDeviceStatus, nowMs: number): TactileDeviceStatus {
  return {
    ...device,
    connected: device.lastSeenAtMs !== null && nowMs - device.lastSeenAtMs < STALE_AFTER_MS,
  };
}

export function TherapistSessionPage({ sessionId, token }: TherapistSessionPageProps) {
  const [state, setState] = useState<SessionState | null>(null);
  const [clientToken, setClientToken] = useState<string | null>(null);
  const [clientLastSeenAtMs, setClientLastSeenAtMs] = useState<number | null>(null);
  const [leftDevice, setLeftDevice] = useState<TactileDeviceStatus>(() => emptyDevice('left'));
  const [rightDevice, setRightDevice] = useState<TactileDeviceStatus>(() => emptyDevice('right'));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [roundDurationMs, setRoundDurationMs] = useState<number | null>(DEFAULT_ROUND_DURATION_MS);
  const autoStopStartedRef = useRef(false);

  const clock = useServerClock();
  const renderTick = useTicker(1000);
  const { t } = useI18n();

  const handleMessage = useCallback((message: SessionBroadcastMessage) => {
    if (message.kind === 'CLIENT_READY') {
      setClientLastSeenAtMs(Date.now());
      return;
    }

    if (message.kind === 'TACTILE_DEVICE_READY' || message.kind === 'TACTILE_DEVICE_HEARTBEAT') {
      const nextDevice: TactileDeviceStatus = {
        side: message.side,
        deviceId: message.deviceId,
        label: message.kind === 'TACTILE_DEVICE_READY' ? message.label : null,
        connected: true,
        lastSeenAtMs: Date.now(),
        unsupported: !message.supported,
      };

      if (message.side === 'left') {
        setLeftDevice((current) => ({ ...current, ...nextDevice, label: nextDevice.label ?? current.label }));
      } else {
        setRightDevice((current) => ({ ...current, ...nextDevice, label: nextDevice.label ?? current.label }));
      }
    }
  }, []);

  const { status: realtimeStatus, send } = useSessionRealtime({ sessionId, onMessage: handleMessage });

  useEffect(() => {
    if (!token) {
      setError(t('session.missingTherapistToken'));
      return;
    }

    const sessionToken = token;
    let active = true;

    async function load() {
      try {
        const session = await getBlsSession(sessionId, sessionToken);

        if (!active) {
          return;
        }

        if (session.role !== 'therapist') {
          setError(t('session.therapistPermissions'));
          return;
        }

        setState(session.state);
        setClientToken(session.clientToken ?? null);
      } catch (nextError) {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : t('session.loadError'));
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [sessionId, t, token]);

  const commitState = useCallback(
    async (nextState: SessionState) => {
      if (!token) {
        return;
      }

      setState(nextState);
      await send({ kind: 'STATE_UPDATED', state: nextState, emittedAtMs: getServerNowMs(clock.offsetMs) });
      await saveTherapistState(sessionId, token, nextState);
    },
    [clock.offsetMs, send, sessionId, token],
  );

  const patchState = useCallback(
    (recipe: (current: SessionState) => SessionState) => {
      if (!state) {
        return;
      }

      const nextState = recipe(state);
      void commitState({ ...nextState, version: nextState.version + 1 }).catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : t('session.saveStateError'));
      });
    },
    [commitState, state, t],
  );

  useTactilePulseEmitter({ state: state ?? undefinedState, serverTimeOffsetMs: clock.offsetMs, send });
  useAudioBls({ state: state ?? undefinedState, serverTimeOffsetMs: clock.offsetMs, unlocked: audioUnlocked, role: 'therapist' });

  useEffect(() => {
    if (!state || state.status !== 'running') {
      autoStopStartedRef.current = false;
      return;
    }

    const elapsedMs = getElapsedMs(state, getServerNowMs(clock.offsetMs));

    if (roundDurationMs === null || elapsedMs < roundDurationMs || autoStopStartedRef.current) {
      return;
    }

    autoStopStartedRef.current = true;
    setBusy(true);
    void commitState(stopPlayback(state, getServerNowMs(clock.offsetMs)))
      .then(() => {
        setNotice(t('session.roundFinished', { duration: formatElapsedTime(roundDurationMs) }));
        window.setTimeout(() => setNotice(null), 2500);
      })
      .catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : t('session.saveStateError'));
      })
      .finally(() => setBusy(false));
  }, [clock.offsetMs, commitState, renderTick, roundDurationMs, state, t]);

  useEffect(() => {
    if (!state || state.status !== 'stopping') {
      return;
    }

    if (state.motionStartedAtMs === null || state.motionStartedAtMs === undefined) {
      void commitState(completeStopPlayback(state)).catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : t('session.saveStateError'));
      });
      return;
    }

    const nowMs = getServerNowMs(clock.offsetMs);
    const remainingMs = Math.max(0, state.motionStartedAtMs + getStoppingDurationMs(state) - nowMs);
    const timeout = window.setTimeout(() => {
      const completeNowMs = getServerNowMs(clock.offsetMs);

      if (!isStopTransitionComplete(state, completeNowMs)) {
        return;
      }

      void commitState(completeStopPlayback(state)).catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : t('session.saveStateError'));
      });
    }, remainingMs + 50);

    return () => window.clearTimeout(timeout);
  }, [clock.offsetMs, commitState, state, t]);

  const nowForStale = Date.now() + renderTick * 0;
  const normalizedLeft = useMemo(() => normalizeDevice(leftDevice, nowForStale), [leftDevice, nowForStale]);
  const normalizedRight = useMemo(() => normalizeDevice(rightDevice, nowForStale), [rightDevice, nowForStale]);
  const clientConnected = clientLastSeenAtMs !== null && nowForStale - clientLastSeenAtMs < STALE_AFTER_MS;

  if (error) {
    return <ErrorView message={error} />;
  }

  if (!state || !clientToken || !token) {
    return <LoadingView message={t('loading.therapist')} />;
  }

  const handleStart = async () => {
    setBusy(true);
    try {
      const serverMs = await getServerTimeMs();
      const stateToStart =
        state.status === 'stopped'
          ? {
              ...state,
              elapsedBeforePauseMs: 0,
              motionElapsedBeforePauseMs: 0,
              startedAtMs: null,
              motionStartedAtMs: null,
              pausedAtMs: null,
            }
          : state;
      await commitState(startPlayback(stateToStart, serverMs + 300));
    } finally {
      setBusy(false);
    }
  };

  const handlePause = async () => {
    setBusy(true);
    try {
      const serverMs = await getServerTimeMs();
      await commitState(pausePlayback(state, serverMs));
    } finally {
      setBusy(false);
    }
  };

  const handleResume = async () => {
    setBusy(true);
    try {
      const serverMs = await getServerTimeMs();
      await commitState(resumePlayback(state, serverMs + 300));
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    setBusy(true);
    try {
      await commitState(stopPlayback(state, getServerNowMs(clock.offsetMs)));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    void commitState(resetPlaybackCounters(state));
  };

  const handleSavePreferences = async () => {
    const preferences: SessionPreferences = {
      visual: state.visual,
      audio: state.audio,
      tactile: state.tactile,
    };

    saveLocalPreferences(preferences);
    await saveTherapistPreferences(sessionId, token, preferences);
    setNotice(t('session.preferencesSaved'));
    window.setTimeout(() => setNotice(null), 2500);
  };

  const handleEndSession = async () => {
    setBusy(true);
    try {
      await endBlsSession(sessionId, token);
      await send({ kind: 'SESSION_ENDED', emittedAtMs: getServerNowMs(clock.offsetMs) });
      window.location.assign('/');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="therapist-page">
      <AppHeader
        title={t('session.therapistPanel')}
        connected={realtimeStatus === 'connected'}
        connectionLabel={realtimeStatus === 'connected' ? t('session.realtimeConnected') : t('session.realtimeDisconnected')}
        actions={
          <>
            <ConnectionBadge connected={clientConnected} label={clientConnected ? t('common.clientConnected') : t('common.noClient')} />
            <button className="secondary-button" type="button" onClick={() => window.open(clientUrl(sessionId, clientToken), '_blank')}>
              {t('session.previewClient')}
            </button>
            <button className="danger-button" type="button" disabled={busy} onClick={handleEndSession}>
              {t('session.endSession')}
            </button>
          </>
        }
      />

      <div className="therapist-grid">
        <div className="left-column">
          <InviteClient sessionId={sessionId} clientToken={clientToken} />
          <VisualPanel
            visual={state.visual}
            onChange={(visual) => patchState((current) => retimeMotionForVisualChange(current, visual, getServerNowMs(clock.offsetMs)))}
          />
          <SessionControls
            state={state}
            serverTimeOffsetMs={clock.offsetMs}
            roundDurationMs={roundDurationMs}
            onStart={handleStart}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
            onReset={handleReset}
            onRoundDurationChange={setRoundDurationMs}
            onSavePreferences={() => void handleSavePreferences()}
            busy={busy}
          />
        </div>

        <div className="middle-column">
          <AuditoryPanel audio={state.audio} onChange={(audio) => patchState((current) => ({ ...current, audio }))} />
          <button className="secondary-button full-width" type="button" onClick={() => setAudioUnlocked(true)}>
            {audioUnlocked ? t('session.localAudioEnabled') : t('session.enableLocalAudio')}
          </button>
          <ClientPreview state={state} serverTimeOffsetMs={clock.offsetMs} />
        </div>

        <div className="right-column">
          <TactilePanel
            tactile={state.tactile}
            leftDevice={normalizedLeft}
            rightDevice={normalizedRight}
            onChange={(tactile) => patchState((current) => ({ ...current, tactile }))}
          />
          <section className="stats-panel panel" aria-label={t('controls.time')}>
            <SessionStats state={state} serverTimeOffsetMs={clock.offsetMs} />
          </section>
          {clock.error ? <div className="warning-box">{t('session.serverClock')}: {clock.error}</div> : null}
          {notice ? <div className="success-box">{notice}</div> : null}
        </div>
      </div>
    </main>
  );
}

const undefinedState: SessionState = {
  version: 0,
  status: 'idle',
  startedAtMs: null,
  pausedAtMs: null,
  elapsedBeforePauseMs: 0,
  motionStartedAtMs: null,
  motionElapsedBeforePauseMs: 0,
  setsCompleted: 0,
  visual: {
    enabled: false,
    color: '#0500a8',
    background: '#c9ced1',
    dotSize: 52,
    speed: 5,
    direction: 'horizontal',
    motionOrder: 'left-to-right',
    verticalPosition: 'center',
  },
  audio: {
    enabled: false,
    sound: 'snap',
    volume: 0,
    therapistMuted: true,
  },
  tactile: {
    enabled: false,
    pulseDurationMs: 120,
    gapMs: 40,
  },
};
