import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TACTILE_INTERNAL_PAUSE_MS } from '../domain/defaults';
import type { JoyConClientStatus, SessionBroadcastMessage, SessionState } from '../domain/sessionTypes';
import { getBlsSession } from '../lib/sessionApi';
import { getElapsedMs, getServerNowMs } from '../domain/motion';
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
  preview?: boolean;
}

const THERAPIST_HEARTBEAT_STALE_MS = 15_000;
const HEARTBEAT_FUTURE_TOLERANCE_MS = 5_000;

export function ClientSessionPage({ sessionId, token, preview = false }: ClientSessionPageProps) {
  const [state, setState] = useState<SessionState | null>(null);
  const [validatedChannelKey, setValidatedChannelKey] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const [locallyStopped, setLocallyStopped] = useState(false);
  const [roundExpired, setRoundExpired] = useState(false);
  const [therapistConnected, setTherapistConnected] = useState(false);
  const [therapistHeartbeatAt, setTherapistHeartbeatAt] = useState<string | null>(null);
  const [heartbeatExpiryTick, setHeartbeatExpiryTick] = useState(0);
  const [reconcileRequest, setReconcileRequest] = useState(0);
  const [verifiedReconcileRequest, setVerifiedReconcileRequest] = useState(-1);
  const [verifiedConnectionEpoch, setVerifiedConnectionEpoch] = useState(-1);
  const clock = useServerClock();
  const { t } = useI18n();
  const tRef = useRef(t);

  const handleMessage = useCallback((message: SessionBroadcastMessage) => {
    if (message.kind === 'STATE_UPDATED' || message.kind === 'SESSION_ENDED') {
      setReconcileRequest((current) => current + 1);
    }
  }, []);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const { status: realtimeStatus, connectionEpoch, send } = useSessionRealtime({
    sessionId,
    channelKey: validatedChannelKey ?? undefined,
    role: preview ? undefined : 'client',
    onMessage: handleMessage,
    onTherapistPresenceChange: setTherapistConnected,
  });

  const joyConWebHid = useJoyConWebHid();
  const activeState = state ?? fallbackState;
  const clockSyncBlocked = !clock.isSynced || Boolean(clock.error);
  const therapistHeartbeatMs = therapistHeartbeatAt === null ? Number.NaN : Date.parse(therapistHeartbeatAt);
  const therapistHeartbeatAgeMs =
    getServerNowMs(clock.offsetMs) + heartbeatExpiryTick * 0 - therapistHeartbeatMs;
  const therapistHeartbeatFresh =
    preview ||
    (Number.isFinite(therapistHeartbeatMs) &&
      therapistHeartbeatAgeMs >= -HEARTBEAT_FUTURE_TOLERANCE_MS &&
      therapistHeartbeatAgeMs <= THERAPIST_HEARTBEAT_STALE_MS);
  const roundDeadlineReached =
    state !== null &&
    clock.isSynced &&
    !clock.error &&
    state?.status === 'running' &&
    typeof state.roundDurationMs === 'number' &&
    state.roundDurationMs > 0 &&
    getElapsedMs(state, getServerNowMs(clock.offsetMs)) >= state.roundDurationMs;
  const baseOutputSuppressed =
    sessionEnded ||
    locallyStopped ||
    roundExpired ||
    roundDeadlineReached ||
    clockSyncBlocked ||
    Boolean(syncError) ||
    realtimeStatus !== 'connected' ||
    verifiedConnectionEpoch !== connectionEpoch ||
    verifiedReconcileRequest !== reconcileRequest ||
    (!preview && (!therapistConnected || !therapistHeartbeatFresh));
  const audioInputState = useMemo<SessionState>(() => {
    if (!baseOutputSuppressed && !preview) {
      return activeState;
    }

    return {
      ...activeState,
      status: baseOutputSuppressed ? 'stopped' : activeState.status,
      audio: { ...activeState.audio, enabled: false },
    };
  }, [activeState, baseOutputSuppressed, preview]);
  const audioOutput = useAudioBls({
    state: audioInputState,
    serverTimeOffsetMs: clock.offsetMs,
    unlocked: audioUnlocked,
    role: 'client',
  });
  const audioReady = audioUnlocked && audioOutput.isUnlocked;
  const audioGateRequired = !preview && activeState.audio.enabled && !audioReady;
  const outputSuppressed = baseOutputSuppressed || audioGateRequired;
  const manualTactileTestAvailable =
    !outputSuppressed && activeState.status !== 'running' && activeState.status !== 'stopping';
  const outputState = useMemo<SessionState>(() => {
    if (!outputSuppressed && !preview) {
      const visualActive = activeState.status === 'running' || activeState.status === 'stopping';
      return {
        ...activeState,
        visual: {
          ...activeState.visual,
          enabled: activeState.visual.enabled && visualActive,
        },
      };
    }

    return {
      ...activeState,
      status: outputSuppressed ? 'stopped' : activeState.status,
      visual: outputSuppressed ? { ...activeState.visual, enabled: false } : activeState.visual,
      audio: { ...activeState.audio, enabled: false },
      tactile: { ...activeState.tactile, enabled: false },
    };
  }, [activeState, outputSuppressed, preview]);
  const tactileIntensity = activeState.tactile.intensity ?? 'medium';
  const tactileOutput = useJoyConTactileOutput({
    state: outputState,
    serverTimeOffsetMs: clock.offsetMs,
    intensity: tactileIntensity,
    enabled: !preview && joyConWebHid.supported && joyConWebHid.leftConnected && joyConWebHid.rightConnected,
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
  const joyConStatusRef = useRef(joyConStatus);
  const clockOffsetMsRef = useRef(clock.offsetMs);
  joyConStatusRef.current = joyConStatus;
  clockOffsetMsRef.current = clock.offsetMs;

  useEffect(() => {
    if (!preview && outputSuppressed) {
      void joyConWebHid.neutral();
    }
  }, [joyConWebHid.neutral, outputSuppressed, preview, sessionEnded]);

  const audioGateOpen = !isFullscreen && !locallyStopped && audioGateRequired;

  useEffect(() => {
    if (!token) {
      setFatalError(tRef.current('client.missingToken'));
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

        if (session.role !== 'client') {
          setFatalError(tRef.current('client.permissions'));
          return;
        }

        setState(session.state);
        setSessionEnded(Boolean(session.endedAt) || session.state.status === 'ended');
        setTherapistHeartbeatAt(session.therapistHeartbeatAt);
        setTherapistConnected(false);
        setValidatedChannelKey(sessionToken);
      } catch (nextError) {
        if (active) {
          setFatalError(nextError instanceof Error ? nextError.message : tRef.current('session.loadError'));
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [sessionId, token]);

  useEffect(() => {
    if (!token || !validatedChannelKey || realtimeStatus !== 'connected') {
      return;
    }

    let active = true;

    let inFlight = false;
    const reconcile = () => {
      if (inFlight) {
        return;
      }

      inFlight = true;
      void getBlsSession(sessionId, token)
        .then((session) => {
          if (!active || session.role !== 'client') {
            return;
          }

          setState(session.state);
          setSessionEnded(Boolean(session.endedAt) || session.state.status === 'ended');
          setTherapistHeartbeatAt(session.therapistHeartbeatAt);
          setSyncError(null);
          setVerifiedConnectionEpoch(connectionEpoch);
          setVerifiedReconcileRequest(reconcileRequest);
        })
        .catch(() => {
          if (active) {
            setSyncError(tRef.current('client.syncError'));
          }
        })
        .finally(() => {
          inFlight = false;
        });
    };

    reconcile();
    const interval = window.setInterval(reconcile, 5_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [
    connectionEpoch,
    realtimeStatus,
    reconcileRequest,
    sessionId,
    token,
    validatedChannelKey,
  ]);

  useEffect(() => {
    if (preview || !validatedChannelKey || realtimeStatus !== 'connected') {
      return;
    }

    const sendReady = () => {
      void send({ kind: 'CLIENT_READY', emittedAtMs: getServerNowMs(clock.offsetMs) }).catch(() => {
        setSyncError(tRef.current('client.syncError'));
      });
    };

    sendReady();
    const interval = window.setInterval(sendReady, 5000);
    return () => window.clearInterval(interval);
  }, [clock.offsetMs, preview, realtimeStatus, send, validatedChannelKey]);

  useEffect(() => {
    if (preview || !validatedChannelKey || realtimeStatus !== 'connected') {
      return;
    }

    const sendJoyConStatus = () => {
      void send({
        kind: 'JOYCON_STATUS',
        status: joyConStatusRef.current,
        emittedAtMs: getServerNowMs(clockOffsetMsRef.current),
      }).catch(() => {
        setSyncError(tRef.current('client.syncError'));
      });
    };

    sendJoyConStatus();
    const interval = window.setInterval(sendJoyConStatus, 5000);
    return () => window.clearInterval(interval);
  }, [preview, realtimeStatus, send, validatedChannelKey]);

  useEffect(() => {
    if (
      preview ||
      !clock.isSynced ||
      clock.error ||
      !Number.isFinite(therapistHeartbeatMs)
    ) {
      return;
    }

    const remainingMs =
      therapistHeartbeatMs + THERAPIST_HEARTBEAT_STALE_MS - getServerNowMs(clock.offsetMs);

    if (remainingMs <= 0) {
      return;
    }

    const timeout = window.setTimeout(
      () => setHeartbeatExpiryTick((current) => current + 1),
      remainingMs + 25,
    );
    return () => window.clearTimeout(timeout);
  }, [
    clock.error,
    clock.isSynced,
    clock.offsetMs,
    heartbeatExpiryTick,
    preview,
    therapistHeartbeatAt,
    therapistHeartbeatMs,
  ]);

  useEffect(() => {
    const durationMs = state?.roundDurationMs;

    if (
      !state ||
      !clock.isSynced ||
      clock.error ||
      state.status !== 'running' ||
      durationMs === null ||
      durationMs === undefined ||
      durationMs <= 0
    ) {
      setRoundExpired(false);
      return;
    }

    const remainingMs = durationMs - getElapsedMs(state, getServerNowMs(clock.offsetMs));

    if (remainingMs <= 0) {
      setRoundExpired(true);
      return;
    }

    setRoundExpired(false);
    const timeout = window.setTimeout(() => setRoundExpired(true), remainingMs + 25);
    return () => window.clearTimeout(timeout);
  }, [clock.error, clock.isSynced, clock.offsetMs, state]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    handleFullscreenChange();
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isFullscreen || !activeState.audio.enabled || audioReady) {
      return;
    }

    setFullscreenError(t('client.fullscreenAudioEnabled'));
    const requestExit = document.exitFullscreen;

    if (!requestExit) {
      setFullscreenError(t('client.fullscreenAudioExitFailed'));
      return;
    }

    let active = true;
    void requestExit.call(document).catch(() => {
      if (active) {
        setFullscreenError(t('client.fullscreenAudioExitFailed'));
      }
    });

    return () => {
      active = false;
    };
  }, [activeState.audio.enabled, audioReady, isFullscreen, t]);

  const enterFullscreen = useCallback(() => {
    setFullscreenError(null);

    if (activeState.audio.enabled && !audioReady) {
      setFullscreenError(t('client.fullscreenAudioRequired'));
      return;
    }

    const requestFullscreen = document.documentElement.requestFullscreen;

    if (!requestFullscreen) {
      setFullscreenError(t('client.fullscreenUnavailable'));
      return;
    }

    void requestFullscreen.call(document.documentElement).catch(() => {
      setFullscreenError(t('client.fullscreenFailed'));
    });
  }, [activeState.audio.enabled, audioReady, t]);

  const exitFullscreen = useCallback(() => {
    if (!document.exitFullscreen) {
      return;
    }

    void document.exitFullscreen().catch(() => undefined);
  }, []);

  const handleLocalOutputToggle = () => {
    setLocallyStopped((current) => !current);
  };

  const handleUnlockAudio = async () => {
    const unlocked = await audioOutput.unlock();
    setAudioUnlocked(unlocked);
    if (unlocked) {
      setFullscreenError(null);
    }
  };

  if (fatalError) {
    return <ErrorView message={fatalError} />;
  }

  if (!state || !token) {
    return <LoadingView message={t('loading.client')} />;
  }

  if (sessionEnded) {
    return <ErrorView title={t('client.sessionEndedTitle')} message={t('client.sessionEndedMessage')} />;
  }

  return (
    <main className="client-page">
      <StimulusStage state={outputState} serverTimeOffsetMs={clock.offsetMs} className="client-stage" />

      <div
        className={`client-command-dock${isFullscreen ? ' is-fullscreen' : ''}`}
        aria-label={t('client.controls')}
        aria-hidden={audioGateOpen || undefined}
        inert={audioGateOpen || undefined}
      >
        {!isFullscreen ? (
          <>
            <span className={`client-status ${realtimeStatus === 'connected' ? 'ok' : 'bad'}`} role="status">
              {realtimeStatus === 'connected' ? t('common.connected') : t('common.reconnecting')}
            </span>
            <button className="secondary-button" type="button" onClick={() => void handleUnlockAudio()}>
              {audioReady ? t('client.audioEnabled') : t('client.enableAudio')}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={activeState.audio.enabled && !audioReady}
              onClick={enterFullscreen}
            >
              {t('client.fullscreen')}
            </button>
            <LanguageToggle />
          </>
        ) : (
          <button className="secondary-button" type="button" onClick={exitFullscreen}>
            {t('client.exitFullscreen')}
          </button>
        )}
        <button
          className={locallyStopped ? 'primary-button' : 'danger-button'}
          type="button"
          aria-pressed={locallyStopped}
          onClick={handleLocalOutputToggle}
        >
          {locallyStopped ? t('client.localResume') : t('client.localStop')}
        </button>
      </div>

      {clockSyncBlocked || syncError || fullscreenError || audioOutput.error || roundExpired || roundDeadlineReached || (!preview && (!therapistConnected || !therapistHeartbeatFresh)) ? (
        <div className="client-inline-alert" role="alert">
          {roundExpired || roundDeadlineReached
            ? t('client.roundExpired')
            : clockSyncBlocked
              ? t('client.clockSyncError')
            : !preview && (!therapistConnected || !therapistHeartbeatFresh)
              ? t('client.controllerAway')
              : syncError ?? fullscreenError ?? audioOutput.error}
        </div>
      ) : null}

      {audioGateOpen ? (
        <div className="join-audio-backdrop">
          <section
            className="join-audio-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="enable-audio-title"
            aria-describedby="enable-audio-description"
          >
            <h1 id="enable-audio-title">{t('client.enableAudioTitle')}</h1>
            <p id="enable-audio-description">{t('client.enableAudioBody')}</p>
            {audioOutput.error ? <div className="error-box" role="alert">{audioOutput.error}</div> : null}
            <div className="join-audio-actions">
              <button className="primary-button" type="button" onClick={() => void handleUnlockAudio()}>
                {t('client.enterEnableAudio')}
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={locallyStopped}
                onClick={() => setLocallyStopped(true)}
              >
                {t('client.localStop')}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {!preview && !isFullscreen && state.tactile.enabled ? (
        <div
          className="client-tactile-panel"
          aria-hidden={audioGateOpen || undefined}
          inert={audioGateOpen || undefined}
        >
          <TactilePanel
            tactile={state.tactile}
            webHidSupported={joyConWebHid.supported}
            requestingDevices={joyConWebHid.requesting}
            devices={joyConWebHid.devices}
            leftConnected={joyConWebHid.leftConnected}
            rightConnected={joyConWebHid.rightConnected}
            error={joyConWebHid.error}
            outputStatus={tactileOutput}
            panelCollapsible
            defaultPanelCollapsed={false}
            onRequestDevices={() => void joyConWebHid.requestDevices()}
            onDisconnectDevices={() => void joyConWebHid.disconnectDevices()}
            onRefresh={() => void joyConWebHid.refresh()}
            onTestPulse={
              manualTactileTestAvailable ? (options) => void joyConWebHid.testPulse(options) : undefined
            }
          />
        </div>
      ) : null}
    </main>
  );
}

const fallbackState: SessionState = {
  version: 0,
  status: 'idle',
  roundDurationMs: null,
  startedAtMs: null,
  pausedAtMs: null,
  elapsedBeforePauseMs: 0,
  motionStartedAtMs: null,
  motionElapsedBeforePauseMs: 0,
  setsCompleted: 0,
  visual: {
    enabled: false,
    color: '#0500a8',
    stimulus: 'dot',
    stimulusAlternatesSides: true,
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
    gapMs: TACTILE_INTERNAL_PAUSE_MS,
    intensity: 'medium',
  },
};
