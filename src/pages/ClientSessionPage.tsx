import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SessionBroadcastMessage, SessionState } from '../domain/sessionTypes';
import { getBlsSession } from '../lib/sessionApi';
import { getServerNowMs } from '../domain/motion';
import { tactileUrl } from '../lib/url';
import { useI18n } from '../lib/i18n';
import { useAudioBls } from '../hooks/useAudioBls';
import { useServerClock } from '../hooks/useServerClock';
import { useSessionRealtime } from '../hooks/useSessionRealtime';
import { ErrorView } from '../components/ErrorView';
import { LoadingView } from '../components/LoadingView';
import { LanguageToggle } from '../components/LanguageToggle';
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
  const { t } = useI18n();

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
      setError(t('client.missingToken'));
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
          setError(nextError instanceof Error ? nextError.message : t('session.loadError'));
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [sessionId, t, token]);

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
    return <LoadingView message={t('loading.client')} />;
  }

  if (sessionEnded) {
    return <ErrorView title={t('client.sessionEndedTitle')} message={t('client.sessionEndedMessage')} />;
  }

  return (
    <main className="client-page">
      <StimulusStage state={state} serverTimeOffsetMs={clock.offsetMs} className="client-stage" />

      <div className="client-topbar">
        <span className={`client-status ${realtimeStatus === 'connected' ? 'ok' : 'bad'}`}>
          {realtimeStatus === 'connected' ? t('common.connected') : t('common.reconnecting')}
        </span>
        <button className="secondary-button" type="button" onClick={() => setAudioUnlocked(true)}>
          {audioUnlocked ? t('client.audioEnabled') : t('client.enableAudio')}
        </button>
        <button className="secondary-button" type="button" onClick={() => setShowPairing((current) => !current)}>
          {showPairing ? t('client.hideTactileQr') : t('client.tactileQr')}
        </button>
        <button className="secondary-button" type="button" onClick={() => void document.documentElement.requestFullscreen?.()}>
          {t('client.fullscreen')}
        </button>
        <LanguageToggle />
      </div>

      {!audioUnlocked && state.audio.enabled ? (
        <div className="join-audio-panel panel">
          <h1>{t('client.enableAudioTitle')}</h1>
          <p>{t('client.enableAudioBody')}</p>
          <button className="primary-button" type="button" onClick={() => setAudioUnlocked(true)}>
            {t('client.enterEnableAudio')}
          </button>
        </div>
      ) : null}

      {showPairing && tactileLinks ? (
        <section className="pairing-drawer panel">
          <header>
            <h2>{t('client.pairTactile')}</h2>
            <p>{t('client.pairTactileBody')}</p>
          </header>
          <div className="qr-grid">
            <QRCodeCard title={t('common.leftPhone')} url={tactileLinks.left} helper={t('client.leftPhoneHelper')} />
            <QRCodeCard title={t('common.rightPhone')} url={tactileLinks.right} helper={t('client.rightPhoneHelper')} />
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
