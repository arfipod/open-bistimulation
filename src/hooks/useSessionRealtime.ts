import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { SessionBroadcastMessage, SessionRole } from '../domain/sessionTypes';
import { supabase } from '../lib/supabase';

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

const EVENT_NAME = 'bls';

type PresenceMeta = {
  role?: SessionRole;
  online_at?: string;
};

type PresenceState = Record<string, PresenceMeta[]>;

interface UseSessionRealtimeOptions {
  sessionId: string;
  channelKey?: string;
  onMessage: (message: SessionBroadcastMessage) => void;
  role?: SessionRole;
  onClientPresenceChange?: (connected: boolean) => void;
  onTherapistPresenceChange?: (connected: boolean) => void;
}

type UnknownRecord = Record<string, unknown>;

const MAX_CHANNEL_KEY_LENGTH = 256;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return isNonNegativeNumber(value) && Number.isSafeInteger(value);
}

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return isFiniteNumber(value) && value >= min && value <= max;
}

function isNullableNonNegativeNumber(value: unknown): value is number | null {
  return value === null || isNonNegativeNumber(value);
}

function isOptional<T>(value: unknown, predicate: (candidate: unknown) => candidate is T): value is T | undefined {
  return value === undefined || predicate(value);
}

function isOptionalNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

function isOptionalNullableNonNegativeNumber(value: unknown): value is number | null | undefined {
  return value === undefined || value === null || isNonNegativeNumber(value);
}

function isOptionalNullableBoolean(value: unknown): value is boolean | null | undefined {
  return value === undefined || value === null || typeof value === 'boolean';
}

function isVisualSettings(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.enabled === 'boolean' &&
    typeof value.color === 'string' &&
    isOptional(value.stimulus, (candidate): candidate is string =>
      isOneOf(candidate, ['dot', 'dog', 'flower', 'sun', 'star', 'heart', 'smile'] as const),
    ) &&
    isOptional(value.stimulusAlternatesSides, (candidate): candidate is boolean => typeof candidate === 'boolean') &&
    typeof value.background === 'string' &&
    isNumberInRange(value.dotSize, 10, 200) &&
    isNumberInRange(value.speed, 1, 20) &&
    isOneOf(value.direction, ['horizontal', 'vertical', 'diagonal', 'diagonal-down', 'diagonal-up', 'infinity'] as const) &&
    isOptional(value.motionOrder, (candidate): candidate is string =>
      isOneOf(candidate, ['left-to-right', 'right-to-left', 'random'] as const),
    ) &&
    isOneOf(value.verticalPosition, ['top', 'center', 'bottom'] as const)
  );
}

function isAudioSettings(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.enabled === 'boolean' &&
    isOneOf(value.sound, ['snap', 'beep', 'bell', 'heartbeat'] as const) &&
    isFiniteNumber(value.volume) &&
    value.volume >= 0 &&
    value.volume <= 1 &&
    typeof value.therapistMuted === 'boolean'
  );
}

function isTactileSettings(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.enabled === 'boolean' &&
    isNumberInRange(value.pulseDurationMs, 10, 5_000) &&
    isNumberInRange(value.gapMs, 0, 10_000) &&
    isOptional(value.intensity, (candidate): candidate is string => isOneOf(candidate, ['low', 'medium', 'high'] as const))
  );
}

function isSessionState(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonNegativeInteger(value.version) &&
    isOneOf(value.status, ['idle', 'running', 'paused', 'stopping', 'stopped', 'ended'] as const) &&
    isOptional(value.roundDurationMs, (candidate): candidate is number | null =>
      candidate === null || isNumberInRange(candidate, 1, 60 * 60_000),
    ) &&
    isNullableNonNegativeNumber(value.startedAtMs) &&
    isNullableNonNegativeNumber(value.pausedAtMs) &&
    isNonNegativeNumber(value.elapsedBeforePauseMs) &&
    isOptional(value.motionStartedAtMs, isNullableNonNegativeNumber) &&
    isOptional(value.motionElapsedBeforePauseMs, isNonNegativeNumber) &&
    isNonNegativeInteger(value.setsCompleted) &&
    isVisualSettings(value.visual) &&
    isAudioSettings(value.audio) &&
    isTactileSettings(value.tactile)
  );
}

function isBatteryStatus(value: unknown): boolean {
  if (value === null) {
    return true;
  }

  if (!isRecord(value)) {
    return false;
  }

  return (
    isOptionalNullableString(value.label) &&
    isOptionalNullableNonNegativeNumber(value.level) &&
    isOptionalNullableNonNegativeNumber(value.percent) &&
    isOptionalNullableBoolean(value.charging) &&
    isOptional(value.error, (candidate): candidate is string => typeof candidate === 'string')
  );
}

function isJoyConDevice(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isOptional(value.index, isNonNegativeInteger) &&
    isOneOf(value.side, ['left', 'right', 'unknown'] as const) &&
    isOptional(value.product, (candidate): candidate is string => typeof candidate === 'string') &&
    isOptional(value.manufacturer, (candidate): candidate is string => typeof candidate === 'string') &&
    isOptional(value.vendorId, (candidate): candidate is string => typeof candidate === 'string') &&
    isOptional(value.productId, (candidate): candidate is string => typeof candidate === 'string') &&
    isOptionalNullableString(value.usagePage) &&
    isOptionalNullableString(value.usage) &&
    isOptional(value.interface, isNonNegativeInteger) &&
    isOptional(value.release, isNonNegativeInteger) &&
    isOptionalNullableString(value.serialNumber) &&
    (value.battery === undefined || isBatteryStatus(value.battery)) &&
    isOptional(value.path, (candidate): candidate is string => typeof candidate === 'string')
  );
}

function isJoyConOutputStatus(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.lastPulseSide === null || isOneOf(value.lastPulseSide, ['left', 'right'] as const)) &&
    isNullableNonNegativeNumber(value.lastPulseAt) &&
    isNonNegativeInteger(value.pulseCount) &&
    (value.lastError === null || typeof value.lastError === 'string') &&
    isNonNegativeInteger(value.skippedPulseCount)
  );
}

function isJoyConClientStatus(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.devices)) {
    return false;
  }

  return (
    typeof value.webHidSupported === 'boolean' &&
    typeof value.requestingDevices === 'boolean' &&
    value.devices.every(isJoyConDevice) &&
    typeof value.leftConnected === 'boolean' &&
    typeof value.rightConnected === 'boolean' &&
    (value.error === null || typeof value.error === 'string') &&
    isJoyConOutputStatus(value.outputStatus)
  );
}

function isSessionBroadcastMessage(value: unknown): value is SessionBroadcastMessage {
  if (!isRecord(value) || !isNonNegativeNumber(value.emittedAtMs)) {
    return false;
  }

  switch (value.kind) {
    case 'STATE_UPDATED':
      return isSessionState(value.state);
    case 'JOYCON_STATUS':
      return isJoyConClientStatus(value.status);
    case 'CLIENT_READY':
    case 'CLIENT_LEFT':
    case 'SESSION_ENDED':
      return true;
    default:
      return false;
  }
}

function isValidChannelKey(channelKey: string | undefined): channelKey is string {
  return (
    typeof channelKey === 'string' &&
    channelKey.length > 0 &&
    channelKey.length <= MAX_CHANNEL_KEY_LENGTH &&
    channelKey.trim() === channelKey &&
    !CONTROL_CHARACTER_PATTERN.test(channelKey)
  );
}

function createChannelTopic(sessionId: string, channelKey: string): string {
  return `session:${encodeURIComponent(sessionId)}:${encodeURIComponent(channelKey)}`;
}

function createPresenceKey(role?: SessionRole): string {
  const id =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${role ?? 'observer'}:${id}`;
}

function hasRolePresence(channel: RealtimeChannel, role: SessionRole): boolean {
  const presenceState = channel.presenceState() as PresenceState;
  return Object.values(presenceState).some((metas) => metas.some((meta) => meta.role === role));
}

export function useSessionRealtime({
  sessionId,
  channelKey,
  onMessage,
  role,
  onClientPresenceChange,
  onTherapistPresenceChange,
}: UseSessionRealtimeOptions) {
  const [status, setStatus] = useState<RealtimeStatus>('idle');
  const [connectionEpoch, setConnectionEpoch] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onMessageRef = useRef(onMessage);
  const onClientPresenceChangeRef = useRef(onClientPresenceChange);
  const onTherapistPresenceChangeRef = useRef(onTherapistPresenceChange);
  const presenceKeyRef = useRef(createPresenceKey(role));

  useEffect(() => {
    onMessageRef.current = onMessage;
    onClientPresenceChangeRef.current = onClientPresenceChange;
    onTherapistPresenceChangeRef.current = onTherapistPresenceChange;
  }, [onClientPresenceChange, onMessage, onTherapistPresenceChange]);

  useEffect(() => {
    if (!isValidChannelKey(channelKey)) {
      setStatus('idle');
      onClientPresenceChangeRef.current?.(false);
      onTherapistPresenceChangeRef.current?.(false);
      return;
    }

    let active = true;
    setStatus('connecting');
    onClientPresenceChangeRef.current?.(false);
    onTherapistPresenceChangeRef.current?.(false);

    const channel = supabase.channel(createChannelTopic(sessionId, channelKey), {
      config: {
        broadcast: { ack: true, self: false },
        presence: { key: presenceKeyRef.current },
      },
    });

    channel
      .on('broadcast', { event: EVENT_NAME }, ({ payload }) => {
        if (active && isSessionBroadcastMessage(payload)) {
          onMessageRef.current(payload);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        if (active) {
          onClientPresenceChangeRef.current?.(hasRolePresence(channel, 'client'));
          onTherapistPresenceChangeRef.current?.(hasRolePresence(channel, 'therapist'));
        }
      })
      .subscribe((nextStatus) => {
        if (!active) {
          return;
        }

        if (nextStatus === 'SUBSCRIBED') {
          onClientPresenceChangeRef.current?.(false);
          onTherapistPresenceChangeRef.current?.(false);
          setConnectionEpoch((current) => current + 1);
          setStatus('connected');
          if (role) {
            void channel.track({ role, online_at: new Date().toISOString() });
          }
        } else if (nextStatus === 'CHANNEL_ERROR' || nextStatus === 'TIMED_OUT') {
          onClientPresenceChangeRef.current?.(false);
          onTherapistPresenceChangeRef.current?.(false);
          setStatus('error');
        } else if (nextStatus === 'CLOSED') {
          onClientPresenceChangeRef.current?.(false);
          onTherapistPresenceChangeRef.current?.(false);
          setStatus('disconnected');
        }
      });

    channelRef.current = channel;

    return () => {
      active = false;
      channelRef.current = null;
      onClientPresenceChangeRef.current?.(false);
      onTherapistPresenceChangeRef.current?.(false);
      if (role) {
        void channel.untrack().finally(() => void supabase.removeChannel(channel));
      } else {
        void supabase.removeChannel(channel);
      }
    };
  }, [channelKey, role, sessionId]);

  const send = useCallback(async (message: SessionBroadcastMessage): Promise<void> => {
    const channel = channelRef.current;

    if (!channel) {
      return;
    }

    const result = await channel.send({
      type: 'broadcast',
      event: EVENT_NAME,
      payload: message,
    });

    if (result !== 'ok') {
      throw new Error(`Realtime broadcast failed: ${result}.`);
    }
  }, []);

  return { status, connectionEpoch, send };
}
