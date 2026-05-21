import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SessionBroadcastMessage, TactileSide } from '../domain/sessionTypes';
import { getServerNowMs } from '../domain/motion';
import { getBlsSession, upsertTactileDevice } from '../lib/sessionApi';
import { getOrCreateLocalId } from '../lib/localStorage';
import { useI18n } from '../lib/i18n';
import { useServerClock } from '../hooks/useServerClock';
import { useSessionRealtime } from '../hooks/useSessionRealtime';
import { AppHeader } from '../components/AppHeader';
import { ErrorView } from '../components/ErrorView';
import { LoadingView } from '../components/LoadingView';

interface TactileDevicePageProps {
  sessionId: string;
  token?: string;
  side: TactileSide;
}

export function TactileDevicePage({ sessionId, token, side }: TactileDevicePageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [activationNotice, setActivationNotice] = useState<string | null>(null);
  const [pulseCount, setPulseCount] = useState(0);
  const [lastPulseAt, setLastPulseAt] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const clock = useServerClock();
  const { t } = useI18n();

  const deviceId = useMemo(() => getOrCreateLocalId(`open-binstimulation.tactile.${sessionId}.${side}`), [sessionId, side]);
  const supported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  const label = side === 'left' ? t('common.leftPhone') : t('common.rightPhone');

  const handleMessage = useCallback(
    (message: SessionBroadcastMessage) => {
      if (message.kind === 'SESSION_ENDED') {
        setSessionEnded(true);
        return;
      }

      if (message.kind === 'TACTILE_PULSE' && message.side === side && enabled && supported) {
        navigator.vibrate(Math.max(1, message.durationMs));
        setPulseCount((current) => current + 1);
        setLastPulseAt(new Date().toLocaleTimeString());
      }
    },
    [enabled, side, supported],
  );

  const { status: realtimeStatus, send } = useSessionRealtime({ sessionId, onMessage: handleMessage });

  useEffect(() => {
    if (!token) {
      setError(t('client.missingToken'));
      return;
    }

    const sessionToken = token;
    let active = true;

    async function load() {
      try {
        await getBlsSession(sessionId, sessionToken);
        await upsertTactileDevice(sessionId, sessionToken, side, deviceId, label, true);

        if (active) {
          setLoaded(true);
        }
      } catch (nextError) {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : t('session.loadError'));
        }
      }
    }

    void load();

    return () => {
      active = false;
      if (token) {
        void upsertTactileDevice(sessionId, token, side, deviceId, label, false);
      }
    };
  }, [deviceId, label, sessionId, side, t, token]);

  useEffect(() => {
    if (realtimeStatus !== 'connected' || !loaded) {
      return;
    }

    const sendHeartbeat = () => {
      void send({
        kind: 'TACTILE_DEVICE_HEARTBEAT',
        side,
        deviceId,
        emittedAtMs: getServerNowMs(clock.offsetMs),
        supported,
      });
    };

    void send({
      kind: 'TACTILE_DEVICE_READY',
      side,
      deviceId,
      label,
      emittedAtMs: getServerNowMs(clock.offsetMs),
      supported,
    });
    sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, 5000);
    return () => window.clearInterval(interval);
  }, [clock.offsetMs, deviceId, label, loaded, realtimeStatus, send, side, supported]);

  const handleEnable = () => {
    if (!supported) {
      setActivationNotice(t('tactileDevice.enableNotice'));
      return;
    }

    const accepted = navigator.vibrate([80, 40, 80]);

    if (!accepted) {
      setActivationNotice(t('tactileDevice.rejected'));
      return;
    }

    setActivationNotice(null);
    setEnabled(true);
  };

  const handleTest = () => {
    if (supported) {
      const accepted = navigator.vibrate([120, 50, 120]);

      if (!accepted) {
        setActivationNotice(t('tactileDevice.rejected'));
      }
    }
  };

  if (error) {
    return <ErrorView message={error} />;
  }

  if (!loaded) {
    return <LoadingView message={t('loading.tactile')} />;
  }

  if (sessionEnded) {
    return <ErrorView title={t('client.sessionEndedTitle')} message={t('client.sessionEndedMessage')} />;
  }

  return (
    <>
      <AppHeader title="" />
      <main className="tactile-page">
        <section className="panel tactile-device-card">
          <span className="eyebrow">{t('tactileDevice.title')}</span>
          <h1>{label}</h1>
          <p>{t('tactileDevice.description', { side: side === 'left' ? t('common.left') : t('common.right') })}</p>

          <div className={`support-box ${supported ? 'ok' : 'bad'}`}>
            {supported ? t('tactileDevice.supported') : t('tactileDevice.unsupported')}
          </div>

          {activationNotice ? <div className="warning-box">{activationNotice}</div> : null}

          <div className="device-metrics">
            <div>
              <span>{t('tactileDevice.realtime')}</span>
              <strong>{realtimeStatus === 'connected' ? t('common.connected') : t('common.reconnecting')}</strong>
            </div>
            <div>
              <span>{t('tactileDevice.status')}</span>
              <strong>{enabled ? t('tactileDevice.vibrationEnabled') : t('tactileDevice.pendingActivation')}</strong>
            </div>
            <div>
              <span>{t('tactileDevice.pulsesReceived')}</span>
              <strong>{pulseCount}</strong>
            </div>
            <div>
              <span>{t('tactileDevice.lastPulse')}</span>
              <strong>{lastPulseAt ?? '—'}</strong>
            </div>
          </div>

          <div className="control-actions tactile-actions">
            <button className="primary-button" type="button" disabled={!supported || enabled} onClick={handleEnable}>
              {enabled ? t('tactileDevice.vibrationEnabled') : t('tactileDevice.enableVibration')}
            </button>
            <button className="secondary-button" type="button" disabled={!supported} onClick={handleTest}>
              {t('tactileDevice.testVibration')}
            </button>
          </div>
        </section>
      </main>
    </>
  );
}
