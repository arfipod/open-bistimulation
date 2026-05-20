import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SessionBroadcastMessage, SessionPreferences, SessionState, TactileDeviceStatus, TactileSide } from '../domain/sessionTypes';
import { getServerNowMs, pausePlayback, resetPlaybackCounters, resumePlayback, startPlayback, stopPlayback } from '../domain/motion';
import { endBlsSession, getBlsSession, getServerTimeMs, saveTherapistPreferences, saveTherapistState } from '../lib/sessionApi';
import { saveLocalPreferences } from '../lib/localStorage';
import { clientUrl } from '../lib/url';
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
import { TactilePanel } from '../components/TactilePanel';
import { VisualPanel } from '../components/VisualPanel';

interface TherapistSessionPageProps {
  sessionId: string;
  token?: string;
}

const STALE_AFTER_MS = 15_000;

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

  const clock = useServerClock();
  const renderTick = useTicker(1000);

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
      setError('Missing therapist token in the URL.');
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
          setError('This link does not have therapist permissions.');
          return;
        }

        setState(session.state);
        setClientToken(session.clientToken ?? null);
      } catch (nextError) {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : 'Could not load the session.');
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [sessionId, token]);

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
        setError(nextError instanceof Error ? nextError.message : 'No se pudo guardar el estado.');
      });
    },
    [commitState, state],
  );

  useTactilePulseEmitter({ state: state ?? undefinedState, serverTimeOffsetMs: clock.offsetMs, send });
  useAudioBls({ state: state ?? undefinedState, serverTimeOffsetMs: clock.offsetMs, unlocked: audioUnlocked, role: 'therapist' });

  const nowForStale = Date.now() + renderTick * 0;
  const normalizedLeft = useMemo(() => normalizeDevice(leftDevice, nowForStale), [leftDevice, nowForStale]);
  const normalizedRight = useMemo(() => normalizeDevice(rightDevice, nowForStale), [rightDevice, nowForStale]);
  const clientConnected = clientLastSeenAtMs !== null && nowForStale - clientLastSeenAtMs < STALE_AFTER_MS;

  if (error) {
    return <ErrorView message={error} />;
  }

  if (!state || !clientToken || !token) {
    return <LoadingView message="Opening therapist panel…" />;
  }

  const handleStart = async () => {
    setBusy(true);
    try {
      const serverMs = await getServerTimeMs();
      await commitState(startPlayback(state, serverMs + 300));
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
      const serverMs = await getServerTimeMs();
      await commitState(stopPlayback(state, serverMs));
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
    setNotice('Preferences saved locally and in Supabase for this session.');
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
        title="Therapist panel"
        connected={realtimeStatus === 'connected'}
        connectionLabel={realtimeStatus === 'connected' ? 'Realtime conectado' : 'Realtime desconectado'}
        actions={
          <>
            <ConnectionBadge connected={clientConnected} label={clientConnected ? 'Cliente conectado' : 'Sin cliente'} />
            <button className="secondary-button" type="button" onClick={() => window.open(clientUrl(sessionId, clientToken), '_blank')}>
              Previsualizar cliente
            </button>
            <button className="danger-button" type="button" disabled={busy} onClick={handleEndSession}>
              End session
            </button>
          </>
        }
      />

      <div className="therapist-grid">
        <div className="left-column">
          <InviteClient sessionId={sessionId} clientToken={clientToken} />
          <VisualPanel visual={state.visual} onChange={(visual) => patchState((current) => ({ ...current, visual }))} />
          <SessionControls
            state={state}
            serverTimeOffsetMs={clock.offsetMs}
            onStart={handleStart}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
            onReset={handleReset}
            onSavePreferences={() => void handleSavePreferences()}
            busy={busy}
          />
        </div>

        <div className="middle-column">
          <AuditoryPanel audio={state.audio} onChange={(audio) => patchState((current) => ({ ...current, audio }))} />
          <button className="secondary-button full-width" type="button" onClick={() => setAudioUnlocked(true)}>
            {audioUnlocked ? 'Therapist audio enabled' : 'Enable local audio'}
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
          {clock.error ? <div className="warning-box">Reloj servidor: {clock.error}</div> : null}
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
  setsCompleted: 0,
  visual: {
    enabled: false,
    color: '#0500a8',
    background: '#c9ced1',
    dotSize: 52,
    speed: 5,
    direction: 'horizontal',
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
