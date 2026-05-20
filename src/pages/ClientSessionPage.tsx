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
          setError(nextError instanceof Error ? nextError.message : 'No se pudo cargar la sesión.');
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
    return <LoadingView message="Conectando con el terapeuta…" />;
  }

  if (sessionEnded) {
    return <ErrorView title="Sesión finalizada" message="El terapeuta ha finalizado esta sesión." />;
  }

  return (
    <main className="client-page">
      <StimulusStage state={state} serverTimeOffsetMs={clock.offsetMs} className="client-stage" />

      <div className="client-topbar">
        <span className={`client-status ${realtimeStatus === 'connected' ? 'ok' : 'bad'}`}>
          {realtimeStatus === 'connected' ? 'Conectado' : 'Reconectando'}
        </span>
        <button className="secondary-button" type="button" onClick={() => setAudioUnlocked(true)}>
          {audioUnlocked ? 'Audio activo' : 'Activar audio'}
        </button>
        <button className="secondary-button" type="button" onClick={() => setShowPairing((current) => !current)}>
          {showPairing ? 'Ocultar QR táctil' : 'QR táctil'}
        </button>
        <button className="secondary-button" type="button" onClick={() => void document.documentElement.requestFullscreen?.()}>
          Pantalla completa
        </button>
      </div>

      {!audioUnlocked && state.audio.enabled ? (
        <div className="join-audio-panel panel">
          <h1>Activa el audio</h1>
          <p>El navegador necesita un toque del usuario para permitir audio estéreo.</p>
          <button className="primary-button" type="button" onClick={() => setAudioUnlocked(true)}>
            Entrar y activar audio
          </button>
        </div>
      ) : null}

      {showPairing && tactileLinks ? (
        <section className="pairing-drawer panel">
          <header>
            <h2>Vincular móviles táctiles</h2>
            <p>Escanea cada QR con un móvil diferente. Recomendado: Android + Chrome/Samsung Internet.</p>
          </header>
          <div className="qr-grid">
            <QRCodeCard title="Móvil izquierdo" url={tactileLinks.left} helper="Este móvil vibrará en los pulsos izquierdos." />
            <QRCodeCard title="Móvil derecho" url={tactileLinks.right} helper="Este móvil vibrará en los pulsos derechos." />
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
