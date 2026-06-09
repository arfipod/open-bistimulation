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
  onMessage: (message: SessionBroadcastMessage) => void;
  role?: SessionRole;
  onClientPresenceChange?: (connected: boolean) => void;
}

function createPresenceKey(role?: SessionRole): string {
  const id =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${role ?? 'observer'}:${id}`;
}

function hasClientPresence(channel: RealtimeChannel): boolean {
  const presenceState = channel.presenceState() as PresenceState;
  return Object.values(presenceState).some((metas) => metas.some((meta) => meta.role === 'client'));
}

export function useSessionRealtime({ sessionId, onMessage, role, onClientPresenceChange }: UseSessionRealtimeOptions) {
  const [status, setStatus] = useState<RealtimeStatus>('idle');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onMessageRef = useRef(onMessage);
  const onClientPresenceChangeRef = useRef(onClientPresenceChange);
  const presenceKeyRef = useRef(createPresenceKey(role));

  useEffect(() => {
    onMessageRef.current = onMessage;
    onClientPresenceChangeRef.current = onClientPresenceChange;
  }, [onClientPresenceChange, onMessage]);

  useEffect(() => {
    setStatus('connecting');

    const channel = supabase.channel(`session:${sessionId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: presenceKeyRef.current },
      },
    });

    channel
      .on('broadcast', { event: EVENT_NAME }, ({ payload }) => {
        onMessageRef.current(payload as SessionBroadcastMessage);
      })
      .on('presence', { event: 'sync' }, () => {
        onClientPresenceChangeRef.current?.(hasClientPresence(channel));
      })
      .subscribe((nextStatus) => {
        if (nextStatus === 'SUBSCRIBED') {
          setStatus('connected');
          if (role) {
            void channel.track({ role, online_at: new Date().toISOString() });
          }
        } else if (nextStatus === 'CHANNEL_ERROR' || nextStatus === 'TIMED_OUT') {
          setStatus('error');
        } else if (nextStatus === 'CLOSED') {
          setStatus('disconnected');
        }
      });

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      if (role) {
        void channel.untrack().finally(() => void supabase.removeChannel(channel));
      } else {
        void supabase.removeChannel(channel);
      }
    };
  }, [role, sessionId]);

  const send = useCallback(async (message: SessionBroadcastMessage): Promise<void> => {
    const channel = channelRef.current;

    if (!channel) {
      return;
    }

    await channel.send({
      type: 'broadcast',
      event: EVENT_NAME,
      payload: message,
    });
  }, []);

  return { status, send };
}
