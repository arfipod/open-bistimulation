import { useCallback, useEffect, useRef, useState } from 'react';
import { TACTILE_INTERNAL_PAUSE_MS } from '../domain/defaults';
import type { JoyConClientStatus, SessionBroadcastMessage, SessionPreferences, SessionState } from '../domain/sessionTypes';
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
import {
  endBlsSession,
  getBlsSession,
  getServerTimeMs,
  heartbeatTherapistSession,
  saveTherapistPreferences,
  saveTherapistState,
  stopTherapistSession,
} from '../lib/sessionApi';
import { saveLocalPreferences } from '../lib/localStorage';
import { clientUrl } from '../lib/url';
import { useI18n } from '../lib/i18n';
import { useServerClock } from '../hooks/useServerClock';
import { useSessionRealtime } from '../hooks/useSessionRealtime';
import { useAudioBls } from '../hooks/useAudioBls';
import { useTicker } from '../hooks/useTicker';
import { AppHeader } from '../components/AppHeader';
import { AuditoryPanel } from '../components/AuditoryPanel';
import { ClientPreview } from '../components/ClientPreview';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { ErrorView } from '../components/ErrorView';
import { InviteClient } from '../components/InviteClient';
import { LoadingView } from '../components/LoadingView';
import { SessionControlActions, SessionControls } from '../components/SessionControls';
import { SessionStats } from '../components/SessionStats';
import { TactilePanel } from '../components/TactilePanel';
import { VisualPanel } from '../components/VisualPanel';

interface TherapistSessionPageProps {
  sessionId: string;
  token?: string;
}

const STALE_AFTER_MS = 15_000;
const DEFAULT_ROUND_DURATION_MS: number | null = null;

export function TherapistSessionPage({ sessionId, token }: TherapistSessionPageProps) {
  const [state, setState] = useState<SessionState | null>(null);
  const [clientToken, setClientToken] = useState<string | null>(null);
  const [clientLastSeenAtMs, setClientLastSeenAtMs] = useState<number | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [heartbeatError, setHeartbeatError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [roundDurationMs, setRoundDurationMs] = useState<number | null>(DEFAULT_ROUND_DURATION_MS);
  const [clientJoyConStatus, setClientJoyConStatus] = useState<JoyConClientStatus>(EMPTY_CLIENT_JOYCON_STATUS);
  const [endConfirmationOpen, setEndConfirmationOpen] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [reconcileRequest, setReconcileRequest] = useState(0);
  const [heartbeatSuppressed, setHeartbeatSuppressed] = useState(false);
  const autoStopStartedRef = useRef(false);
  const stateRef = useRef<SessionState | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveEpochRef = useRef(0);
  const recoveringSaveRef = useRef(false);
  const normalMutationRef = useRef(false);
  const safetyMutationRef = useRef(false);
  const actionEpochRef = useRef(0);
  const lastAuthoritativeVersionRef = useRef(-1);

  const clock = useServerClock();
  const renderTick = useTicker(1000);
  const { t } = useI18n();
  const tRef = useRef(t);

  const handleMessage = useCallback((message: SessionBroadcastMessage) => {
    if (message.kind === 'STATE_UPDATED' || message.kind === 'SESSION_ENDED') {
      setReconcileRequest((current) => current + 1);
      return;
    }

    if (message.kind === 'CLIENT_READY') {
      setClientLastSeenAtMs(Date.now());
      return;
    }

    if (message.kind === 'JOYCON_STATUS') {
      setClientLastSeenAtMs(Date.now());
      setClientJoyConStatus(message.status);
    }
  }, []);

  const handleClientPresenceChange = useCallback((connected: boolean) => {
    setClientLastSeenAtMs(connected ? Date.now() : null);
    if (!connected) {
      setClientJoyConStatus(EMPTY_CLIENT_JOYCON_STATUS);
    }
  }, []);

  const { status: realtimeStatus, send } = useSessionRealtime({
    sessionId,
    channelKey: clientToken ?? undefined,
    role: 'therapist',
    onMessage: handleMessage,
    onClientPresenceChange: handleClientPresenceChange,
  });

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!token) {
      setFatalError(tRef.current('session.missingTherapistToken'));
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
          setFatalError(tRef.current('session.therapistPermissions'));
          return;
        }

        stateRef.current = session.state;
        lastAuthoritativeVersionRef.current = session.state.version;
        setState(session.state);
        setSessionEnded(Boolean(session.endedAt) || session.state.status === 'ended');
        setRoundDurationMs(session.state.roundDurationMs ?? DEFAULT_ROUND_DURATION_MS);
        setClientToken(session.clientToken ?? null);
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
    if (!token || !clientToken) {
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
          if (!active || session.role !== 'therapist') {
            return;
          }

          if (session.state.version >= lastAuthoritativeVersionRef.current) {
            lastAuthoritativeVersionRef.current = session.state.version;
            const current = stateRef.current;
            if (!current || session.state.version >= current.version) {
              stateRef.current = session.state;
              setState(session.state);
              setRoundDurationMs(session.state.roundDurationMs ?? DEFAULT_ROUND_DURATION_MS);
            }
            setSessionEnded(Boolean(session.endedAt) || session.state.status === 'ended');
          }
          setActionError(null);
        })
        .catch(() => {
          if (active) {
            setActionError(tRef.current('session.syncError'));
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
  }, [clientToken, reconcileRequest, sessionId, token]);

  useEffect(() => {
    if (!token || !clientToken || sessionEnded || heartbeatSuppressed) {
      return;
    }

    let active = true;
    const heartbeat = () => {
      void heartbeatTherapistSession(sessionId, token)
        .then(() => {
          if (active) {
            setHeartbeatError(null);
          }
        })
        .catch(() => {
          if (active) {
            setHeartbeatError(tRef.current('session.heartbeatError'));
          }
        });
    };

    heartbeat();
    const interval = window.setInterval(heartbeat, 5_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [clientToken, heartbeatSuppressed, sessionEnded, sessionId, token]);

  const commitState = useCallback(
    async (nextState: SessionState) => {
      if (!token) {
        return;
      }

      if (recoveringSaveRef.current || safetyMutationRef.current) {
        throw new Error(tRef.current('session.concurrentUpdate'));
      }

      const previousState = stateRef.current;
      const saveEpoch = saveEpochRef.current;
      stateRef.current = nextState;
      setState(nextState);

      const persist = saveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (saveEpoch !== saveEpochRef.current) {
            throw new Error(tRef.current('session.concurrentUpdate'));
          }

          try {
            await saveTherapistState(sessionId, token, nextState);
          } catch (nextError) {
            recoveringSaveRef.current = true;
            saveEpochRef.current += 1;

            try {
              const session = await getBlsSession(sessionId, token);
              if (
                session.role === 'therapist' &&
                session.state.version >= lastAuthoritativeVersionRef.current
              ) {
                lastAuthoritativeVersionRef.current = session.state.version;
                stateRef.current = session.state;
                setState(session.state);
                setSessionEnded(Boolean(session.endedAt) || session.state.status === 'ended');
                setRoundDurationMs(session.state.roundDurationMs ?? DEFAULT_ROUND_DURATION_MS);
              }
            } catch {
              if (previousState && previousState.version >= lastAuthoritativeVersionRef.current) {
                stateRef.current = previousState;
                setState(previousState);
                setRoundDurationMs(previousState.roundDurationMs ?? DEFAULT_ROUND_DURATION_MS);
              }
            } finally {
              saveEpochRef.current += 1;
              recoveringSaveRef.current = false;
            }

            throw nextError;
          }

          lastAuthoritativeVersionRef.current = Math.max(
            lastAuthoritativeVersionRef.current,
            nextState.version,
          );
          await send({ kind: 'STATE_UPDATED', state: nextState, emittedAtMs: getServerNowMs(clock.offsetMs) });
        });

      saveQueueRef.current = persist.catch(() => undefined);
      await persist;
    },
    [clock.offsetMs, send, sessionId, token],
  );

  const patchState = useCallback(
    (recipe: (current: SessionState) => SessionState) => {
      const currentState = stateRef.current;

      if (!currentState) {
        return;
      }

      const nextState = recipe(currentState);
      void commitState({ ...nextState, version: nextState.version + 1 }).catch((nextError) => {
        setActionError(nextError instanceof Error ? nextError.message : t('session.saveStateError'));
      });
    },
    [commitState, t],
  );

  const audioOutput = useAudioBls({
    state: state ?? undefinedState,
    serverTimeOffsetMs: clock.offsetMs,
    unlocked: audioUnlocked,
    role: 'therapist',
  });
  const audioReady = audioUnlocked && audioOutput.isUnlocked;

  useEffect(() => {
    if (!state || !clock.isSynced || clock.error || state.status !== 'running') {
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
        setActionError(nextError instanceof Error ? nextError.message : t('session.saveStateError'));
      })
      .finally(() => setBusy(false));
  }, [clock.error, clock.isSynced, clock.offsetMs, commitState, renderTick, roundDurationMs, state, t]);

  useEffect(() => {
    if (!state || state.status !== 'stopping') {
      return;
    }

    if (state.motionStartedAtMs === null || state.motionStartedAtMs === undefined) {
      void commitState(completeStopPlayback(state)).catch((nextError) => {
        setActionError(nextError instanceof Error ? nextError.message : t('session.saveStateError'));
      });
      return;
    }

    if (!clock.isSynced || clock.error) {
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
        setActionError(nextError instanceof Error ? nextError.message : t('session.saveStateError'));
      });
    }, remainingMs + 50);

    return () => window.clearTimeout(timeout);
  }, [clock.error, clock.isSynced, clock.offsetMs, commitState, state, t]);

  const nowForStale = Date.now() + renderTick * 0;
  const clientConnected = clientLastSeenAtMs !== null && nowForStale - clientLastSeenAtMs < STALE_AFTER_MS;

  if (fatalError) {
    return <ErrorView message={fatalError} />;
  }

  if (!state || !clientToken || !token) {
    return <LoadingView message={t('loading.therapist')} />;
  }

  if (sessionEnded) {
    return <ErrorView title={t('session.endedTitle')} message={t('session.endedMessage')} />;
  }

  const runBusyAction = async (
    action: (actionEpoch: number) => Promise<void>,
    fallbackMessage: string,
  ) => {
    if (normalMutationRef.current || safetyMutationRef.current) {
      return;
    }

    normalMutationRef.current = true;
    const actionEpoch = actionEpochRef.current + 1;
    actionEpochRef.current = actionEpoch;
    setActionError(null);
    setBusy(true);

    try {
      await action(actionEpoch);
    } catch (nextError) {
      if (actionEpoch === actionEpochRef.current) {
        setActionError(nextError instanceof Error ? nextError.message : fallbackMessage);
      }
    } finally {
      if (actionEpoch === actionEpochRef.current) {
        normalMutationRef.current = false;
        setBusy(false);
      }
    }
  };

  const handleStart = () => {
    void runBusyAction(async (actionEpoch) => {
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
      await commitState(startPlayback({ ...stateToStart, roundDurationMs }, serverMs + 300));
      if (actionEpoch === actionEpochRef.current && !safetyMutationRef.current) {
        setHeartbeatSuppressed(false);
      }
    }, t('session.startError'));
  };

  const handlePause = () => {
    setHeartbeatSuppressed(true);
    void runBusyAction(async (actionEpoch) => {
      const serverMs = await getServerTimeMs();
      await commitState(pausePlayback(state, serverMs));
      if (actionEpoch === actionEpochRef.current && !safetyMutationRef.current) {
        setHeartbeatSuppressed(false);
      }
    }, t('session.pauseError'));
  };

  const handleResume = () => {
    void runBusyAction(async (actionEpoch) => {
      const serverMs = await getServerTimeMs();
      await commitState(resumePlayback(state, serverMs + 300));
      if (actionEpoch === actionEpochRef.current && !safetyMutationRef.current) {
        setHeartbeatSuppressed(false);
      }
    }, t('session.resumeError'));
  };

  const handleStop = () => {
    if (safetyMutationRef.current) {
      return;
    }

    setActionError(null);
    setHeartbeatSuppressed(true);
    actionEpochRef.current += 1;
    normalMutationRef.current = false;
    setBusy(false);
    setSafetyBusy(true);
    safetyMutationRef.current = true;
    saveEpochRef.current += 1;

    void stopTherapistSession(sessionId, token)
      .then((stoppedState) => {
        lastAuthoritativeVersionRef.current = Math.max(
          lastAuthoritativeVersionRef.current,
          stoppedState.version,
        );
        stateRef.current = stoppedState;
        setState(stoppedState);
        setRoundDurationMs(stoppedState.roundDurationMs ?? DEFAULT_ROUND_DURATION_MS);
        setHeartbeatSuppressed(false);
        setActionError(null);
        void send({
          kind: 'STATE_UPDATED',
          state: stoppedState,
          emittedAtMs: getServerNowMs(clock.offsetMs),
        }).catch(() => undefined);
      })
      .catch((nextError) => {
        setActionError(nextError instanceof Error ? nextError.message : t('session.stopError'));
      })
      .finally(() => {
        safetyMutationRef.current = false;
        setSafetyBusy(false);
      });
  };

  const handleReset = () => {
    setActionError(null);
    void commitState(resetPlaybackCounters(state)).catch((nextError) => {
      setActionError(nextError instanceof Error ? nextError.message : t('session.resetError'));
    });
  };

  const handleSavePreferences = () => {
    const preferences: SessionPreferences = {
      visual: state.visual,
      audio: state.audio,
      tactile: state.tactile,
    };

    void runBusyAction(async (actionEpoch) => {
      saveLocalPreferences(preferences);
      await saveTherapistPreferences(sessionId, token, preferences);
      if (actionEpoch === actionEpochRef.current && !safetyMutationRef.current) {
        setNotice(t('session.preferencesSaved'));
        window.setTimeout(() => setNotice(null), 2500);
      }
    }, t('session.preferencesError'));
  };

  const handleUnlockAudio = async () => {
    const unlocked = await audioOutput.unlock();
    setAudioUnlocked(unlocked);
  };

  const handleEndSession = () => {
    if (safetyMutationRef.current) {
      return;
    }

    setEndConfirmationOpen(false);
    setHeartbeatSuppressed(true);
    actionEpochRef.current += 1;
    normalMutationRef.current = false;
    setBusy(false);
    setSafetyBusy(true);
    safetyMutationRef.current = true;
    saveEpochRef.current += 1;
    const endedState: SessionState = {
      ...state,
      version: state.version + 1,
      status: 'ended',
      startedAtMs: null,
      pausedAtMs: null,
      motionStartedAtMs: null,
    };

    void endBlsSession(sessionId, token)
      .then(async () => {
        lastAuthoritativeVersionRef.current = endedState.version;
        stateRef.current = endedState;
        setState(endedState);
        setSessionEnded(true);
        await send({
          kind: 'SESSION_ENDED',
          emittedAtMs: getServerNowMs(clock.offsetMs),
        }).catch(() => undefined);
        window.location.assign('/');
      })
      .catch((nextError) => {
        setActionError(nextError instanceof Error ? nextError.message : t('session.endError'));
      })
      .finally(() => {
        safetyMutationRef.current = false;
        setSafetyBusy(false);
      });
  };

  const roundInProgress = state.status === 'running' || state.status === 'stopping';
  const handleRoundDurationChange = (durationMs: number | null) => {
    setRoundDurationMs(durationMs);
    patchState((current) => ({ ...current, roundDurationMs: durationMs }));
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
            <button
              className="secondary-button"
              type="button"
              onClick={() => window.open(`${clientUrl(sessionId, clientToken)}&preview=1`, '_blank', 'noopener,noreferrer')}
            >
              {t('session.previewClient')}
            </button>
            <button className="danger-button" type="button" disabled={safetyBusy} onClick={() => setEndConfirmationOpen(true)}>
              {t('session.endSession')}
            </button>
          </>
        }
      />

      <div className="therapist-workspace">
        <h1 className="workspace-title">{t('session.therapistPanel')}</h1>

        <div className="session-command-deck">
          <section className="stats-panel panel" aria-label={t('controls.sessionActions')}>
            <SessionStats state={state} serverTimeOffsetMs={clock.offsetMs} />
            <SessionControlActions
              state={state}
              onStart={handleStart}
              onPause={handlePause}
              onResume={handleResume}
              onStop={handleStop}
              onReset={handleReset}
              onSavePreferences={handleSavePreferences}
              busy={busy}
              safetyBusy={safetyBusy}
            />
          </section>
          <SessionControls
            state={state}
            serverTimeOffsetMs={clock.offsetMs}
            roundDurationMs={roundDurationMs}
            onRoundDurationChange={handleRoundDurationChange}
            busy={busy}
            panelCollapsible
            autoCollapse={state.status === 'running'}
          />
        </div>

        {endConfirmationOpen ? (
          <section className="end-session-confirmation" role="alertdialog" aria-labelledby="end-session-title" aria-describedby="end-session-description">
            <div>
              <h2 id="end-session-title">{t('session.endConfirmTitle')}</h2>
              <p id="end-session-description">{t('session.endConfirmBody')}</p>
            </div>
            <div className="confirmation-actions">
              <button className="secondary-button" type="button" onClick={() => setEndConfirmationOpen(false)}>
                {t('common.cancel')}
              </button>
              <button className="danger-button" type="button" disabled={safetyBusy} onClick={handleEndSession}>
                {t('session.endConfirmAction')}
              </button>
            </div>
          </section>
        ) : null}

        {actionError ? <div className="error-box workspace-notice" role="alert">{actionError}</div> : null}
        {heartbeatError ? <div className="error-box workspace-notice" role="alert">{heartbeatError}</div> : null}
        {audioOutput.error ? <div className="error-box workspace-notice" role="alert">{audioOutput.error}</div> : null}
        {clock.error ? <div className="warning-box workspace-notice" role="status">{t('session.serverClock')}: {clock.error}</div> : null}
        {notice ? <div className="success-box workspace-notice" role="status">{notice}</div> : null}

        <InviteClient sessionId={sessionId} clientToken={clientToken} />

        <div className="therapist-grid">
          <div className="left-column">
          <VisualPanel
            visual={state.visual}
            onChange={(visual) => patchState((current) => retimeMotionForVisualChange(current, visual, getServerNowMs(clock.offsetMs)))}
            panelCollapsible
            autoCollapse={roundInProgress && !state.visual.enabled}
          />
          </div>

          <div className="middle-column">
            <AuditoryPanel
              audio={state.audio}
              onChange={(audio) => patchState((current) => ({ ...current, audio }))}
              panelCollapsible
              autoCollapse={roundInProgress && !state.audio.enabled}
            />
            <button className="secondary-button full-width" type="button" onClick={() => void handleUnlockAudio()}>
              {audioReady ? t('session.localAudioEnabled') : t('session.enableLocalAudio')}
            </button>
            <ClientPreview state={state} serverTimeOffsetMs={clock.offsetMs} panelCollapsible autoCollapse={state.status === 'running'} />
          </div>

          <div className="right-column">
            <TactilePanel
              tactile={state.tactile}
              onChange={(tactile) => patchState((current) => ({ ...current, tactile }))}
              panelCollapsible
              autoCollapse={roundInProgress && !state.tactile.enabled}
              webHidSupported={clientJoyConStatus.webHidSupported}
              requestingDevices={clientJoyConStatus.requestingDevices}
              devices={clientJoyConStatus.devices}
              leftConnected={clientJoyConStatus.leftConnected}
              rightConnected={clientJoyConStatus.rightConnected}
              error={clientJoyConStatus.error}
              outputStatus={clientJoyConStatus.outputStatus}
              deviceStatusCollapsible
              defaultDeviceStatusCollapsed
              defaultInstructionsCollapsed
            />
          </div>
        </div>
      </div>
    </main>
  );
}

const undefinedState: SessionState = {
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

const EMPTY_CLIENT_JOYCON_STATUS: JoyConClientStatus = {
  webHidSupported: true,
  requestingDevices: false,
  devices: [],
  leftConnected: false,
  rightConnected: false,
  error: null,
  outputStatus: {
    lastPulseSide: null,
    lastPulseAt: null,
    pulseCount: 0,
    lastError: null,
    skippedPulseCount: 0,
  },
};
