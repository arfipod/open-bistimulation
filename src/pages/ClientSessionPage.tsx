import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JoyConClientStatus, SessionBroadcastMessage, SessionState } from '../domain/sessionTypes';
import { getBlsSession } from '../lib/sessionApi';
import { getServerNowMs } from '../domain/motion';
import { useI18n } from '../lib/i18n';
import { useAudioBls } from '../hooks/useAudioBls';
import { useJoyConTactileOutput } from '../hooks/useJoyConTactileOutput';
import { useJoyConWebHid } from '../hooks/useJoyConWebHid';
import { useServerClock } from '../hooks/useServerClock';
import { useSessionRealtime } from '../hooks/useSessionRealtime';
import { ErrorView } from '../components/ErrorView';
import { LoadingView } from '../components/LoadingView';
import { LanguageToggle } from '../components/LanguageToggle';
import { StimulusStage } from '../components/StimulusStage';
import { TactilePanel } from '../components/TactilePanel';

interface ClientSessionPageProps {
  sessionId: string;
  token?: string;
}

export function ClientSessionPage({ sessionId, token }: ClientSessionPageProps) {
  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
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
  const joyConWebHid = useJoyConWebHid();
  const activeState = state ?? fallbackState;
  const tactileIntensity = activeState.tactile.intensity ?? 'medium';
  const tactileOutput = useJoyConTactileOutput({
    state: activeState,
    serverTimeOffsetMs: clock.offsetMs,
    intensity: tactileIntensity,
    enabled: joyConWebHid.supported && joyConWebHid.leftConnected && joyConWebHid.rightConnected,
  });
  const joyConStatus = useMemo<JoyConClientStatus>(
    () => ({
      webHidSupported: joyConWebHid.supported,
      requestingDevices: joyConWebHid.requesting,
      devices: joyConWebHid.devices,
      leftConnected: joyConWebHid.leftConnected,
      rightConnected: joyConWebHid.rightConnected,
      error: joyConWebHid.error,
      outputStatus: tactileOutput,
    }),
    [
      joyConWebHid.devices,
      joyConWebHid.error,
      joyConWebHid.leftConnected,
      joyConWebHid.requesting,
      joyConWebHid.rightConnected,
      joyConWebHid.supported,
      tactileOutput,
    ],
  );
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

  useEffect(() => {
    if (realtimeStatus !== 'connected') {
      return;
    }

    const sendJoyConStatus = () => {
      void send({ kind: 'JOYCON_STATUS', status: joyConStatus, emittedAtMs: getServerNowMs(clock.offsetMs) });
    };

    sendJoyConStatus();
    const interval = window.setInterval(sendJoyConStatus, 5000);
    return () => window.clearInterval(interval);
  }, [clock.offsetMs, joyConStatus, realtimeStatus, send]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    handleFullscreenChange();
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const enterFullscreen = useCallback(() => {
    const requestFullscreen = document.documentElement.requestFullscreen;

    if (!requestFullscreen) {
      return;
    }

    void requestFullscreen.call(document.documentElement).catch(() => undefined);
  }, []);

  const exitFullscreen = useCallback(() => {
    if (!document.exitFullscreen) {
      return;
    }

    void document.exitFullscreen().catch(() => undefined);
  }, []);

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

      {isFullscreen ? (
        <button className="secondary-button client-fullscreen-exit" type="button" onClick={exitFullscreen}>
          {t('client.exitFullscreen')}
        </button>
      ) : (
        <div className="client-topbar">
          <span className={`client-status ${realtimeStatus === 'connected' ? 'ok' : 'bad'}`}>
            {realtimeStatus === 'connected' ? t('common.connected') : t('common.reconnecting')}
          </span>
          <button className="secondary-button" type="button" onClick={() => setAudioUnlocked(true)}>
            {audioUnlocked ? t('client.audioEnabled') : t('client.enableAudio')}
          </button>
          <button className="secondary-button" type="button" onClick={enterFullscreen}>
            {t('client.fullscreen')}
          </button>
          <LanguageToggle />
        </div>
      )}

      {!isFullscreen && !audioUnlocked && state.audio.enabled ? (
        <div className="join-audio-panel panel">
          <h1>{t('client.enableAudioTitle')}</h1>
          <p>{t('client.enableAudioBody')}</p>
          <button className="primary-button" type="button" onClick={() => setAudioUnlocked(true)}>
            {t('client.enterEnableAudio')}
          </button>
        </div>
      ) : null}

      {!isFullscreen && state.tactile.enabled ? (
        <div className="client-tactile-panel">
          <TactilePanel
            tactile={state.tactile}
            webHidSupported={joyConWebHid.supported}
            requestingDevices={joyConWebHid.requesting}
            devices={joyConWebHid.devices}
            leftConnected={joyConWebHid.leftConnected}
            rightConnected={joyConWebHid.rightConnected}
            error={joyConWebHid.error}
            outputStatus={tactileOutput}
            onRequestDevices={() => void joyConWebHid.requestDevices()}
            onDisconnectDevices={() => void joyConWebHid.disconnectDevices()}
            onRefresh={() => void joyConWebHid.refresh()}
            onTestPulse={(options) => void joyConWebHid.testPulse(options)}
          />
        </div>
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
    intensity: 'medium',
  },
};
