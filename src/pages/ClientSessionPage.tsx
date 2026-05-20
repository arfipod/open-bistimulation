import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SessionBroadcastMessage, SessionState } from '../domain/sessionTypes';
import { getBlsSession } from '../lib/sessionApi';
import { getServerNowMs } from '../domain/motion';
import { tactileUrl } from '../lib/url';
import { useAudioBls } from '../hooks/useAudioBls';
import { useServerClock } from '../hooks/useServerClock';
import { useSessionRealtime } from '../hooks/useSessionRealtime';
import { ErrorView } from '../components/ErrorView';
import { LoadingView } from '../components/LoadingView';
import { QRCodeCard } from '../components/QRCodeCard';
import { StimulusStage } from '../components/StimulusStage';

interface ClientSessionPageProps {
  sessionId: string;
  token?: string;
}

export function ClientSessionPage({ sessionId, token }: ClientSessionPageProps) {
  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showPairing, setShowPairing] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const clock = useServerClock();

  const handleMessage = useCallback((message: SessionBroadcastMessage) => {
    if (message.kind === 'STATE_UPDATED') {
      setState(message.state);
      return;
    }

    if (message.kind === 'SESSION_ENDED') {
      setSessionEnded(true);
    }
  }, []);

  const { status: realtimeStatus, send } = useSessionRealtime({ sessionId, onMessage: handleMessage });
  useAudioBls({ state: state ?? fallbackState, serverTimeOffsetMs: clock.offsetMs, unlocked: audioUnlocked, role: 'client' });

  useEffect(() => {
    if (!token) {
      setError('Falta el token de cliente en la URL.');
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

        setState(session.state);
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

  useEffect(() => {
    if (realtimeStatus !== 'connected') {
      return;
    }

    const sendReady = () => {
      void send({ kind: 'CLIENT_READY', emittedAtMs: getServerNowMs(clock.offsetMs) });
    };

    sendReady();
    const interval = window.setInterval(sendReady, 5000);
    return () => window.clearInterval(interval);
  }, [clock.offsetMs, realtimeStatus, send]);

  const tactileLinks = useMemo(() => {
    if (!token) {
      return null;
    }

    return {
      left: tactileUrl(sessionId, token, 'left'),
      right: tactileUrl(sessionId, token, 'right'),
    };
  }, [sessionId, token]);

  if (error) {
    return <ErrorView message={error} />;
  }

  if (!state || !token) {
    return <LoadingView message="Connecting to therapist…" />;
  }

  if (sessionEnded) {
    return <ErrorView title="Session ended" message="The therapist has ended this session." />;
  }

  return (
    <main className="client-page">
      <StimulusStage state={state} serverTimeOffsetMs={clock.offsetMs} className="client-stage" />

      <div className="client-topbar">
        <span className={`client-status ${realtimeStatus === 'connected' ? 'ok' : 'bad'}`}>
          {realtimeStatus === 'connected' ? 'Connected' : 'Reconnecting'}
        </span>
        <button className="secondary-button" type="button" onClick={() => setAudioUnlocked(true)}>
          {audioUnlocked ? 'Audio enabled' : 'Enable audio'}
        </button>
        <button className="secondary-button" type="button" onClick={() => setShowPairing((current) => !current)}>
          {showPairing ? 'Hide tactile QR' : 'Tactile QR'}
        </button>
        <button className="secondary-button" type="button" onClick={() => void document.documentElement.requestFullscreen?.()}>
          Fullscreen
        </button>
      </div>

      {!audioUnlocked && state.audio.enabled ? (
        <div className="join-audio-panel panel">
          <h1>Enable audio</h1>
          <p>The browser requires a user gesture to allow stereo audio.</p>
          <button className="primary-button" type="button" onClick={() => setAudioUnlocked(true)}>
            Enter and enable audio
          </button>
        </div>
      ) : null}

      {showPairing && tactileLinks ? (
        <section className="pairing-drawer panel">
          <header>
            <h2>Pair tactile phones</h2>
            <p>Scan each QR with a different phone. Recommended: Android + Chrome/Samsung Internet.</p>
          </header>
          <div className="qr-grid">
            <QRCodeCard title="Left phone" url={tactileLinks.left} helper="This phone will vibrate on left pulses." />
            <QRCodeCard title="Right phone" url={tactileLinks.right} helper="This phone will vibrate on right pulses." />
          </div>
        </section>
      ) : null}
    </main>
  );
}

const fallbackState: SessionState = {
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
