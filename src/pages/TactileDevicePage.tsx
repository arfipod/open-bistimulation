import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SessionBroadcastMessage, TactileSide } from '../domain/sessionTypes';
import { getServerNowMs } from '../domain/motion';
import { getBlsSession, upsertTactileDevice } from '../lib/sessionApi';
import { getOrCreateLocalId } from '../lib/localStorage';
import { useServerClock } from '../hooks/useServerClock';
import { useSessionRealtime } from '../hooks/useSessionRealtime';
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
  const [pulseCount, setPulseCount] = useState(0);
  const [lastPulseAt, setLastPulseAt] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const clock = useServerClock();

  const deviceId = useMemo(() => getOrCreateLocalId(`open-binstimulation.tactile.${sessionId}.${side}`), [sessionId, side]);
  const supported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  const label = side === 'left' ? 'Left phone' : 'Right phone';

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
      setError('Falta el token de cliente en la URL.');
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
          setError(nextError instanceof Error ? nextError.message : 'Could not pair the phone.');
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
  }, [deviceId, label, sessionId, side, token]);

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
      return;
    }

    navigator.vibrate([80, 40, 80]);
    setEnabled(true);
  };

  const handleTest = () => {
    if (supported) {
      navigator.vibrate([120, 50, 120]);
    }
  };

  if (error) {
    return <ErrorView message={error} />;
  }

  if (!loaded) {
    return <LoadingView message="Pairing tactile phone…" />;
  }

  if (sessionEnded) {
    return <ErrorView title="Session ended" message="The therapist has ended this session." />;
  }

  return (
    <main className="tactile-page">
      <section className="panel tactile-device-card">
        <span className="eyebrow">Tactile device</span>
        <h1>{label}</h1>
        <p>
          This phone will vibrate when the therapist emits <strong>{side === 'left' ? 'left' : 'right'}</strong>.
        </p>

        <div className={`support-box ${supported ? 'ok' : 'bad'}`}>
          {supported
            ? 'Este navegador expone navigator.vibrate(). Pulsa activar para permitir vibraciones.'
            : 'This browser does not support the Vibration API. Use Android with Chrome or Samsung Internet.'}
        </div>

        <div className="device-metrics">
          <div>
            <span>Realtime</span>
            <strong>{realtimeStatus === 'connected' ? 'Connected' : 'Reconnecting'}</strong>
          </div>
          <div>
            <span>Estado</span>
            <strong>{enabled ? 'Vibration enabled' : 'Pending activation'}</strong>
          </div>
          <div>
            <span>Pulsos recibidos</span>
            <strong>{pulseCount}</strong>
          </div>
          <div>
            <span>Last pulse</span>
            <strong>{lastPulseAt ?? '—'}</strong>
          </div>
        </div>

        <div className="control-actions tactile-actions">
          <button className="primary-button" type="button" disabled={!supported || enabled} onClick={handleEnable}>
            {enabled ? 'Vibration enabledda' : 'Enable vibration'}
          </button>
          <button className="secondary-button" type="button" disabled={!supported} onClick={handleTest}>
            Test vibration
          </button>
        </div>
      </section>
    </main>
  );
}
