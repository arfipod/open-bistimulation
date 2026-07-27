import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SESSION_STATE } from '../domain/defaults';
import type { SessionBroadcastMessage } from '../domain/sessionTypes';
import { useSessionRealtime } from './useSessionRealtime';

type StatusCallback = (status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED') => void;

function makeChannel() {
  let broadcastHandler: ((event: { payload: unknown }) => void) | null = null;
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
    send: vi.fn().mockResolvedValue('ok'),
    track: vi.fn().mockResolvedValue({}),
    untrack: vi.fn().mockResolvedValue({}),
    presenceState: vi.fn().mockReturnValue({}),
  };

  return {
    channel,
    emit(payload: unknown) {
      broadcastHandler?.({ payload });
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

const CHANNEL_KEY = 'client-channel-key';

describe('useSessionRealtime', () => {
  beforeEach(() => {
    mocks.nextChannel = makeChannel();
    mocks.channel.mockReset().mockReturnValue(mocks.nextChannel.channel);
    mocks.removeChannel.mockReset().mockResolvedValue(undefined);
  });

  it('stays idle until a valid shared channel key exists', () => {
    const { result, rerender } = renderHook(
      ({ channelKey }) => useSessionRealtime({ sessionId: 'session-1', channelKey, onMessage: vi.fn() }),
      { initialProps: { channelKey: undefined as string | undefined } },
    );

    expect(result.current.status).toBe('idle');
    expect(mocks.channel).not.toHaveBeenCalled();

    rerender({ channelKey: '   ' });
    expect(result.current.status).toBe('idle');
    expect(mocks.channel).not.toHaveBeenCalled();

    rerender({ channelKey: `secret${String.fromCharCode(0)}` });
    rerender({ channelKey: 'x'.repeat(257) });
    expect(mocks.channel).not.toHaveBeenCalled();

    rerender({ channelKey: CHANNEL_KEY });
    expect(result.current.status).toBe('connecting');
    expect(mocks.channel).toHaveBeenCalledTimes(1);
  });

  it('subscribes to the session channel and maps Supabase statuses', () => {
    const { result } = renderHook(() =>
      useSessionRealtime({ sessionId: 'session-1', channelKey: CHANNEL_KEY, onMessage: vi.fn() }),
    );

    expect(mocks.channel).toHaveBeenCalledWith(`session:session-1:${CHANNEL_KEY}`, {
      config: { broadcast: { ack: true, self: false }, presence: { key: expect.stringMatching(/^observer:/) } },
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
    const { result } = renderHook(() =>
      useSessionRealtime({ sessionId: 'session-1', channelKey: CHANNEL_KEY, onMessage: vi.fn() }),
    );
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

  it.each(['error', 'timed out'] as const)('rejects when Supabase reports a %s broadcast', async (sendResult) => {
    mocks.nextChannel?.channel.send.mockResolvedValueOnce(sendResult);
    const { result } = renderHook(() =>
      useSessionRealtime({ sessionId: 'session-1', channelKey: CHANNEL_KEY, onMessage: vi.fn() }),
    );

    await expect(result.current.send({ kind: 'CLIENT_READY', emittedAtMs: 123 })).rejects.toThrow(
      `Realtime broadcast failed: ${sendResult}.`,
    );
  });

  it('uses the latest message handler without resubscribing', () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    const { rerender } = renderHook(
      ({ handler }) => useSessionRealtime({ sessionId: 'session-1', channelKey: CHANNEL_KEY, onMessage: handler }),
      { initialProps: { handler: firstHandler } },
    );

    rerender({ handler: secondHandler });
    const message: SessionBroadcastMessage = { kind: 'SESSION_ENDED', emittedAtMs: 456 };
    act(() => mocks.nextChannel?.emit(message));

    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalledWith(message);
    expect(mocks.channel).toHaveBeenCalledTimes(1);
  });

  it('accepts valid message variants and ignores malformed broadcast payloads', () => {
    const handler = vi.fn();
    renderHook(() => useSessionRealtime({ sessionId: 'session-1', channelKey: CHANNEL_KEY, onMessage: handler }));
    const validMessages: SessionBroadcastMessage[] = [
      { kind: 'STATE_UPDATED', state: DEFAULT_SESSION_STATE, emittedAtMs: 100 },
      { kind: 'CLIENT_READY', emittedAtMs: 101 },
      {
        kind: 'JOYCON_STATUS',
        emittedAtMs: 102,
        status: {
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
        },
      },
      { kind: 'CLIENT_LEFT', emittedAtMs: 103 },
      { kind: 'SESSION_ENDED', emittedAtMs: 104 },
    ];

    act(() => validMessages.forEach((message) => mocks.nextChannel?.emit(message)));
    expect(handler.mock.calls.map(([message]) => message)).toEqual(validMessages);

    const malformedPayloads: unknown[] = [
      null,
      { kind: 'CLIENT_READY', emittedAtMs: 'now' },
      { kind: 'UNKNOWN', emittedAtMs: 105 },
      {
        kind: 'STATE_UPDATED',
        emittedAtMs: 106,
        state: {
          ...DEFAULT_SESSION_STATE,
          visual: { ...DEFAULT_SESSION_STATE.visual, speed: Number.POSITIVE_INFINITY },
        },
      },
      {
        kind: 'STATE_UPDATED',
        emittedAtMs: 106,
        state: {
          ...DEFAULT_SESSION_STATE,
          roundDurationMs: 24 * 60 * 60_000,
        },
      },
      {
        kind: 'JOYCON_STATUS',
        emittedAtMs: 107,
        status: {
          webHidSupported: true,
          requestingDevices: false,
          devices: [],
          leftConnected: false,
          rightConnected: false,
          error: null,
        },
      },
    ];

    act(() => malformedPayloads.forEach((payload) => mocks.nextChannel?.emit(payload)));
    expect(handler).toHaveBeenCalledTimes(validMessages.length);
  });

  it('preserves role presence tracking and sync notifications', async () => {
    const onClientPresenceChange = vi.fn();
    const onTherapistPresenceChange = vi.fn();
    const { unmount } = renderHook(() =>
      useSessionRealtime({
        sessionId: 'session-1',
        channelKey: CHANNEL_KEY,
        role: 'therapist',
        onMessage: vi.fn(),
        onClientPresenceChange,
        onTherapistPresenceChange,
      }),
    );

    expect(mocks.channel).toHaveBeenCalledWith(expect.any(String), {
      config: {
        broadcast: { ack: true, self: false },
        presence: { key: expect.stringMatching(/^therapist:/) },
      },
    });

    act(() => mocks.nextChannel?.status('SUBSCRIBED'));
    expect(mocks.nextChannel?.channel.track).toHaveBeenCalledWith({
      role: 'therapist',
      online_at: expect.any(String),
    });

    mocks.nextChannel?.channel.presenceState.mockReturnValue({
      participant: [{ role: 'client' }],
      controller: [{ role: 'therapist' }],
    });
    act(() => mocks.nextChannel?.syncPresence());
    expect(onClientPresenceChange).toHaveBeenLastCalledWith(true);
    expect(onTherapistPresenceChange).toHaveBeenLastCalledWith(true);

    mocks.nextChannel?.channel.presenceState.mockReturnValue({});
    act(() => mocks.nextChannel?.syncPresence());
    expect(onClientPresenceChange).toHaveBeenLastCalledWith(false);
    expect(onTherapistPresenceChange).toHaveBeenLastCalledWith(false);

    const channel = mocks.nextChannel?.channel;
    unmount();
    expect(channel?.untrack).toHaveBeenCalled();
    await waitFor(() => expect(mocks.removeChannel).toHaveBeenCalledWith(channel));
  });

  it('removes the channel on unmount and makes later sends a no-op', async () => {
    const { result, unmount } = renderHook(() =>
      useSessionRealtime({ sessionId: 'session-1', channelKey: CHANNEL_KEY, onMessage: vi.fn() }),
    );
    const channel = mocks.nextChannel?.channel;

    unmount();
    await act(async () => {
      await result.current.send({ kind: 'CLIENT_READY', emittedAtMs: 123 });
    });

    expect(mocks.removeChannel).toHaveBeenCalledWith(channel);
    expect(channel?.send).not.toHaveBeenCalled();
  });
});
