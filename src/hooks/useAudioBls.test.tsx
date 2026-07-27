import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SESSION_STATE } from '../domain/defaults';
import type { SessionRole, SessionState } from '../domain/sessionTypes';
import { useAudioBls } from './useAudioBls';

const mocks = vi.hoisted(() => ({
  engine: {
    unlock: vi.fn(),
    isUnlocked: vi.fn(),
    play: vi.fn(),
    dispose: vi.fn(),
  },
  createAudioEngine: vi.fn(),
}));

vi.mock('../domain/audioEngine', () => ({
  createAudioEngine: mocks.createAudioEngine,
}));

function makeState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    ...DEFAULT_SESSION_STATE,
    status: 'running',
    startedAtMs: 0,
    motionStartedAtMs: 0,
    visual: { ...DEFAULT_SESSION_STATE.visual, speed: 20 },
    audio: { ...DEFAULT_SESSION_STATE.audio, enabled: true, therapistMuted: false },
    tactile: { ...DEFAULT_SESSION_STATE.tactile },
    ...overrides,
  };
}

function installRaf() {
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();

  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextId;
    nextId += 1;
    callbacks.set(id, callback);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    callbacks.delete(id);
  });

  return {
    count() {
      return callbacks.size;
    },
    runNext() {
      const [id, callback] = callbacks.entries().next().value as [number, FrameRequestCallback];
      callbacks.delete(id);
      callback(0);
    },
  };
}

function renderUseAudioBls(state: SessionState, role: SessionRole = 'client') {
  return renderHook(() => useAudioBls({ state, serverTimeOffsetMs: 0, unlocked: true, role }));
}

describe('useAudioBls', () => {
  beforeEach(() => {
    mocks.engine.unlock.mockReset().mockResolvedValue(undefined);
    mocks.engine.isUnlocked.mockReset().mockReturnValue(true);
    mocks.engine.play.mockReset();
    mocks.engine.dispose.mockReset();
    mocks.createAudioEngine.mockReset().mockReturnValue(mocks.engine);
  });

  it('creates and resumes the engine only from the explicit unlock action', async () => {
    const { result } = renderHook(() =>
      useAudioBls({
        state: makeState({ audio: { ...DEFAULT_SESSION_STATE.audio, enabled: false } }),
        serverTimeOffsetMs: 0,
        unlocked: true,
        role: 'client',
      }),
    );

    expect(mocks.createAudioEngine).not.toHaveBeenCalled();

    await act(async () => {
      await expect(result.current.unlock()).resolves.toBe(true);
    });

    expect(mocks.createAudioEngine).toHaveBeenCalledTimes(1);
    expect(mocks.engine.unlock).toHaveBeenCalledTimes(1);
    expect(result.current.isUnlocked).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('honors therapist muting while allowing client audio', async () => {
    const raf = installRaf();
    const mutedState = makeState({ audio: { ...DEFAULT_SESSION_STATE.audio, enabled: true, therapistMuted: true } });
    const therapist = renderUseAudioBls(mutedState, 'therapist');

    await act(async () => {
      await therapist.result.current.unlock();
    });
    expect(raf.count()).toBe(0);
    therapist.unmount();

    const client = renderUseAudioBls(mutedState, 'client');
    await act(async () => {
      await client.result.current.unlock();
    });

    expect(mocks.createAudioEngine).toHaveBeenCalledTimes(2);
    expect(raf.count()).toBe(1);
  });

  it('plays the configured sound when the motion half-cycle changes', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const raf = installRaf();
    const { result, unmount } = renderUseAudioBls(makeState());

    await act(async () => {
      await result.current.unlock();
    });
    act(() => raf.runNext());
    expect(mocks.engine.play).not.toHaveBeenCalled();

    now = 400;
    act(() => raf.runNext());

    expect(mocks.engine.play).toHaveBeenCalledWith('snap', 'right', 0.7);
    expect(mocks.createAudioEngine).toHaveBeenCalledTimes(1);

    unmount();
    expect(mocks.engine.dispose).toHaveBeenCalledTimes(1);
    expect(raf.count()).toBe(0);
  });

  it('resets the half-cycle gate while playback is not running', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const raf = installRaf();
    const { result, rerender } = renderHook(
      ({ state }) => useAudioBls({ state, serverTimeOffsetMs: 0, unlocked: true, role: 'client' }),
      { initialProps: { state: makeState() } },
    );

    await act(async () => {
      await result.current.unlock();
    });
    act(() => raf.runNext());
    now = 400;
    act(() => raf.runNext());
    expect(mocks.engine.play).toHaveBeenCalledTimes(1);

    rerender({ state: makeState({ status: 'paused' }) });
    expect(raf.count()).toBe(0);

    rerender({ state: makeState() });
    act(() => raf.runNext());

    expect(mocks.engine.play).toHaveBeenCalledTimes(1);
  });

  it('establishes a fresh phase after audio is re-enabled or unmuted', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const raf = installRaf();
    const enabledState = makeState();
    const { result, rerender } = renderHook(
      ({ state }) => useAudioBls({ state, serverTimeOffsetMs: 0, unlocked: true, role: 'therapist' }),
      { initialProps: { state: enabledState } },
    );

    await act(async () => {
      await result.current.unlock();
    });
    act(() => raf.runNext());
    now = 400;
    act(() => raf.runNext());
    expect(mocks.engine.play).toHaveBeenCalledTimes(1);

    rerender({ state: makeState({ audio: { ...enabledState.audio, enabled: false } }) });
    now = 700;
    rerender({ state: enabledState });
    act(() => raf.runNext());
    expect(mocks.engine.play).toHaveBeenCalledTimes(1);

    now = 1100;
    act(() => raf.runNext());
    expect(mocks.engine.play).toHaveBeenCalledTimes(2);

    rerender({ state: makeState({ audio: { ...enabledState.audio, therapistMuted: true } }) });
    now = 1400;
    rerender({ state: enabledState });
    act(() => raf.runNext());
    expect(mocks.engine.play).toHaveBeenCalledTimes(2);
  });

  it('reports unlock failures reactively and allows a retry', async () => {
    const unlockError = new Error('Audio permission was blocked.');
    mocks.engine.unlock.mockRejectedValueOnce(unlockError).mockResolvedValueOnce(undefined);
    const { result } = renderUseAudioBls(makeState());

    await act(async () => {
      await expect(result.current.unlock()).resolves.toBe(false);
    });
    expect(result.current).toMatchObject({
      isUnlocked: false,
      error: 'Audio permission was blocked.',
    });

    await act(async () => {
      await expect(result.current.unlock()).resolves.toBe(true);
    });
    expect(mocks.createAudioEngine).toHaveBeenCalledTimes(1);
    expect(mocks.engine.unlock).toHaveBeenCalledTimes(2);
    expect(result.current).toMatchObject({
      isUnlocked: true,
      error: null,
    });
  });
});
