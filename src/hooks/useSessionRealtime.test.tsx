import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionBroadcastMessage } from '../domain/sessionTypes';
import { useSessionRealtime } from './useSessionRealtime';

type StatusCallback = (status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED') => void;

function makeChannel() {
  let broadcastHandler: ((event: { payload: SessionBroadcastMessage }) => void) | null = null;
  let presenceSyncHandler: (() => void) | null = null;
  let statusHandler: StatusCallback | null = null;
  const channel = {
    on: vi.fn((type: string, filter: unknown, handler: typeof broadcastHandler | typeof presenceSyncHandler) => {
      if (type === 'broadcast') {
        broadcastHandler = handler as typeof broadcastHandler;
      }
      if (type === 'presence' && (filter as { event?: string }).event === 'sync') {
        presenceSyncHandler = handler as typeof presenceSyncHandler;
      }
      return channel;
    }),
    subscribe: vi.fn((handler: StatusCallback) => {
      statusHandler = handler;
      return channel;
    }),
    send: vi.fn().mockResolvedValue({}),
    track: vi.fn().mockResolvedValue({}),
    untrack: vi.fn().mockResolvedValue({}),
    presenceState: vi.fn().mockReturnValue({}),
  };

  return {
    channel,
    emit(message: SessionBroadcastMessage) {
      broadcastHandler?.({ payload: message });
    },
    status(status: Parameters<StatusCallback>[0]) {
      statusHandler?.(status);
    },
    syncPresence() {
      presenceSyncHandler?.();
    },
  };
}

const mocks = vi.hoisted(() => ({
  nextChannel: null as ReturnType<typeof makeChannel> | null,
  channel: vi.fn(),
  removeChannel: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  },
}));

describe('useSessionRealtime', () => {
  beforeEach(() => {
    mocks.nextChannel = makeChannel();
    mocks.channel.mockReset().mockReturnValue(mocks.nextChannel.channel);
    mocks.removeChannel.mockReset().mockResolvedValue(undefined);
  });

  it('subscribes to the session channel and maps Supabase statuses', () => {
    const { result } = renderHook(() => useSessionRealtime({ sessionId: 'session-1', onMessage: vi.fn() }));

    expect(mocks.channel).toHaveBeenCalledWith('session:session-1', {
      config: { broadcast: { self: false }, presence: { key: expect.stringMatching(/^observer:/) } },
    });
    expect(result.current.status).toBe('connecting');

    act(() => mocks.nextChannel?.status('SUBSCRIBED'));
    expect(result.current.status).toBe('connected');

    act(() => mocks.nextChannel?.status('TIMED_OUT'));
    expect(result.current.status).toBe('error');

    act(() => mocks.nextChannel?.status('CLOSED'));
    expect(result.current.status).toBe('disconnected');
  });

  it('sends broadcast messages through the active channel', async () => {
    const { result } = renderHook(() => useSessionRealtime({ sessionId: 'session-1', onMessage: vi.fn() }));
    const message: SessionBroadcastMessage = { kind: 'CLIENT_READY', emittedAtMs: 123 };

    await act(async () => {
      await result.current.send(message);
    });

    expect(mocks.nextChannel?.channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'bls',
      payload: message,
    });
  });

  it('uses the latest message handler without resubscribing', () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    const { rerender } = renderHook(
      ({ handler }) => useSessionRealtime({ sessionId: 'session-1', onMessage: handler }),
      { initialProps: { handler: firstHandler } },
    );

    rerender({ handler: secondHandler });
    const message: SessionBroadcastMessage = { kind: 'SESSION_ENDED', emittedAtMs: 456 };
    act(() => mocks.nextChannel?.emit(message));

    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalledWith(message);
    expect(mocks.channel).toHaveBeenCalledTimes(1);
  });

  it('removes the channel on unmount and makes later sends a no-op', async () => {
    const { result, unmount } = renderHook(() => useSessionRealtime({ sessionId: 'session-1', onMessage: vi.fn() }));
    const channel = mocks.nextChannel?.channel;

    unmount();
    await act(async () => {
      await result.current.send({ kind: 'CLIENT_READY', emittedAtMs: 123 });
    });

    expect(mocks.removeChannel).toHaveBeenCalledWith(channel);
    expect(channel?.send).not.toHaveBeenCalled();
  });
});
