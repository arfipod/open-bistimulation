import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { SessionBroadcastMessage } from '../domain/sessionTypes';
import { supabase } from '../lib/supabase';

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

const EVENT_NAME = 'bls';

interface UseSessionRealtimeOptions {
  sessionId: string;
  onMessage: (message: SessionBroadcastMessage) => void;
}

export function useSessionRealtime({ sessionId, onMessage }: UseSessionRealtimeOptions) {
  const [status, setStatus] = useState<RealtimeStatus>('idle');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    setStatus('connecting');

    const channel = supabase.channel(`session:${sessionId}`, {
      config: {
        broadcast: { self: false },
      },
    });

    channel
      .on('broadcast', { event: EVENT_NAME }, ({ payload }) => {
        onMessageRef.current(payload as SessionBroadcastMessage);
      })
      .subscribe((nextStatus) => {
        if (nextStatus === 'SUBSCRIBED') {
          setStatus('connected');
        } else if (nextStatus === 'CHANNEL_ERROR' || nextStatus === 'TIMED_OUT') {
          setStatus('error');
        } else if (nextStatus === 'CLOSED') {
          setStatus('disconnected');
        }
      });

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

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
