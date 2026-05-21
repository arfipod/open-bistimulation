import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SESSION_STATE } from '../domain/defaults';
import type { SessionRole, SessionState } from '../domain/sessionTypes';
import { useAudioBls } from './useAudioBls';

const mocks = vi.hoisted(() => ({
  engine: {
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
    mocks.engine.play.mockReset();
    mocks.engine.dispose.mockReset();
    mocks.createAudioEngine.mockReset().mockReturnValue(mocks.engine);
  });

  it('does not create an engine until audio is both unlocked and enabled', () => {
    renderHook(() =>
      useAudioBls({
        state: makeState({ audio: { ...DEFAULT_SESSION_STATE.audio, enabled: false } }),
        serverTimeOffsetMs: 0,
        unlocked: true,
        role: 'client',
      }),
    );
    renderHook(() =>
      useAudioBls({
        state: makeState(),
        serverTimeOffsetMs: 0,
        unlocked: false,
        role: 'client',
      }),
    );

    expect(mocks.createAudioEngine).not.toHaveBeenCalled();
  });

  it('honors therapist muting while allowing client audio', () => {
    const mutedState = makeState({ audio: { ...DEFAULT_SESSION_STATE.audio, enabled: true, therapistMuted: true } });

    renderUseAudioBls(mutedState, 'therapist');
    expect(mocks.createAudioEngine).not.toHaveBeenCalled();

    renderUseAudioBls(mutedState, 'client');
    expect(mocks.createAudioEngine).toHaveBeenCalledTimes(1);
  });

  it('plays the configured sound when the motion half-cycle changes', () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const raf = installRaf();
    const { unmount } = renderUseAudioBls(makeState());

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

  it('resets the half-cycle gate while playback is not running', () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const raf = installRaf();
    const { rerender } = renderHook(
      ({ state }) => useAudioBls({ state, serverTimeOffsetMs: 0, unlocked: true, role: 'client' }),
      { initialProps: { state: makeState() } },
    );

    act(() => raf.runNext());
    now = 400;
    act(() => raf.runNext());
    expect(mocks.engine.play).toHaveBeenCalledTimes(1);

    rerender({ state: makeState({ status: 'paused' }) });
    act(() => raf.runNext());

    rerender({ state: makeState() });
    act(() => raf.runNext());

    expect(mocks.engine.play).toHaveBeenCalledTimes(1);
  });
});
