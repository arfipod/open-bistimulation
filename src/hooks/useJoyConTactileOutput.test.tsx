import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SESSION_STATE } from '../domain/defaults';
import type { SessionState } from '../domain/sessionTypes';
import { useJoyConTactileOutput } from './useJoyConTactileOutput';

const mocks = vi.hoisted(() => ({
  pulseJoyCon: vi.fn(),
  neutralJoyCon: vi.fn(),
}));

vi.mock('../lib/joyconWebHidClient', () => ({
  pulseJoyCon: mocks.pulseJoyCon,
  neutralJoyCon: mocks.neutralJoyCon,
}));

function makeState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    ...DEFAULT_SESSION_STATE,
    status: 'running',
    startedAtMs: 0,
    motionStartedAtMs: 0,
    visual: { ...DEFAULT_SESSION_STATE.visual, speed: 20 },
    audio: { ...DEFAULT_SESSION_STATE.audio },
    tactile: { ...DEFAULT_SESSION_STATE.tactile, enabled: true, pulseDurationMs: 180, gapMs: 40 },
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
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
      const next = callbacks.entries().next().value as [number, FrameRequestCallback] | undefined;

      if (!next) {
        throw new Error('No animation frame is scheduled.');
      }

      const [id, callback] = next;
      callbacks.delete(id);
      callback(0);
    },
  };
}

const BASE_OPTIONS = {
  intensity: 'medium' as const,
  enabled: true,
};

describe('useJoyConTactileOutput', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.pulseJoyCon.mockReset().mockResolvedValue({ ok: true, events: [] });
    mocks.neutralJoyCon.mockReset().mockResolvedValue({ ok: true, events: [] });
  });

  it('sends one Joy-Con pulse when the half-cycle changes', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const raf = installRaf();

    const { result } = renderHook(() =>
      useJoyConTactileOutput({ state: makeState(), serverTimeOffsetMs: 0, ...BASE_OPTIONS }),
    );

    act(() => raf.runNext());
    expect(mocks.pulseJoyCon).not.toHaveBeenCalled();

    now = 400;
    act(() => raf.runNext());

    await waitFor(() => expect(mocks.pulseJoyCon).toHaveBeenCalledTimes(1));
    expect(mocks.pulseJoyCon).toHaveBeenCalledWith({
      side: 'right',
      duration: 180,
      repeats: 1,
      intensity: 'medium',
    });
    expect(result.current).toMatchObject({
      lastPulseSide: 'right',
      lastPulseAt: 400,
      pulseCount: 1,
      skippedPulseCount: 0,
    });
  });

  it('does not retrigger while the motion remains in the same half-cycle', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const raf = installRaf();

    renderHook(() => useJoyConTactileOutput({ state: makeState(), serverTimeOffsetMs: 0, ...BASE_OPTIONS }));

    act(() => raf.runNext());
    now = 400;
    act(() => raf.runNext());
    await waitFor(() => expect(mocks.pulseJoyCon).toHaveBeenCalledTimes(1));

    now = 410;
    act(() => raf.runNext());
    expect(mocks.pulseJoyCon).toHaveBeenCalledTimes(1);
  });

  it('does not pulse when tactile output is disabled', () => {
    vi.spyOn(Date, 'now').mockReturnValue(400);
    const raf = installRaf();

    renderHook(() =>
      useJoyConTactileOutput({
        state: makeState({ tactile: { ...DEFAULT_SESSION_STATE.tactile, enabled: false } }),
        serverTimeOffsetMs: 0,
        ...BASE_OPTIONS,
      }),
    );

    expect(raf.count()).toBe(0);
    expect(mocks.pulseJoyCon).not.toHaveBeenCalled();
  });

  it('sends neutral once when running tactile output pauses or stops', async () => {
    const raf = installRaf();
    const runningState = makeState();
    const pausedState = makeState({ status: 'paused' });
    const stoppedState = makeState({ status: 'stopped' });

    const { rerender } = renderHook(({ state }) => useJoyConTactileOutput({ state, serverTimeOffsetMs: 0, ...BASE_OPTIONS }), {
      initialProps: { state: runningState },
    });

    act(() => raf.runNext());

    rerender({ state: pausedState });
    await waitFor(() => expect(mocks.neutralJoyCon).toHaveBeenCalledTimes(1));
    expect(mocks.neutralJoyCon).toHaveBeenCalledWith({ side: 'both' });

    rerender({ state: stoppedState });
    expect(mocks.neutralJoyCon).toHaveBeenCalledTimes(1);
  });

  it('sends neutral once when tactile output is disabled mid-run', async () => {
    const raf = installRaf();
    const runningState = makeState();
    const disabledState = makeState({ tactile: { ...DEFAULT_SESSION_STATE.tactile, enabled: false } });

    const { rerender } = renderHook(({ state }) => useJoyConTactileOutput({ state, serverTimeOffsetMs: 0, ...BASE_OPTIONS }), {
      initialProps: { state: runningState },
    });

    act(() => raf.runNext());

    rerender({ state: disabledState });
    await waitFor(() => expect(mocks.neutralJoyCon).toHaveBeenCalledTimes(1));

    rerender({ state: disabledState });
    expect(mocks.neutralJoyCon).toHaveBeenCalledTimes(1);
  });

  it('uses the side from getMotionSnapshot, including reversed bilateral order', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const raf = installRaf();
    const state = makeState({ visual: { ...DEFAULT_SESSION_STATE.visual, speed: 20, motionOrder: 'right-to-left' } });

    renderHook(() => useJoyConTactileOutput({ state, serverTimeOffsetMs: 0, ...BASE_OPTIONS }));

    act(() => raf.runNext());
    now = 400;
    act(() => raf.runNext());

    await waitFor(() => expect(mocks.pulseJoyCon).toHaveBeenCalledTimes(1));
    expect(mocks.pulseJoyCon).toHaveBeenCalledWith(expect.objectContaining({ side: 'left' }));
  });

  it('skips same-side half-cycle pulses while a previous request for that side is still in flight', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const raf = installRaf();
    const pulse = deferred<{ ok: true; events: unknown[] }>();
    mocks.pulseJoyCon.mockReturnValue(pulse.promise);

    const { result } = renderHook(() =>
      useJoyConTactileOutput({ state: makeState(), serverTimeOffsetMs: 0, ...BASE_OPTIONS }),
    );

    act(() => raf.runNext());
    now = 400;
    act(() => raf.runNext());
    await waitFor(() => expect(mocks.pulseJoyCon).toHaveBeenCalledTimes(1));

    now = 700;
    act(() => raf.runNext());

    await waitFor(() => expect(mocks.pulseJoyCon).toHaveBeenCalledTimes(2));
    expect(result.current.skippedPulseCount).toBe(0);

    now = 1100;
    act(() => raf.runNext());

    await waitFor(() => expect(result.current.skippedPulseCount).toBe(1));
    expect(mocks.pulseJoyCon).toHaveBeenCalledTimes(2);

    await act(async () => {
      pulse.resolve({ ok: true, events: [] });
    });
  });
});
