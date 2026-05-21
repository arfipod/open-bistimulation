import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SESSION_STATE } from '../domain/defaults';
import type { SessionState } from '../domain/sessionTypes';
import { useTactilePulseEmitter } from './useTactilePulseEmitter';

function makeState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    ...DEFAULT_SESSION_STATE,
    status: 'running',
    startedAtMs: 0,
    motionStartedAtMs: 0,
    visual: { ...DEFAULT_SESSION_STATE.visual, speed: 20 },
    audio: { ...DEFAULT_SESSION_STATE.audio },
    tactile: { ...DEFAULT_SESSION_STATE.tactile, enabled: true, pulseDurationMs: 180 },
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

describe('useTactilePulseEmitter', () => {
  beforeEach(() => {
    installRaf();
  });

  it('emits one tactile pulse each time the half-cycle changes', () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const raf = installRaf();
    const send = vi.fn().mockResolvedValue(undefined);

    renderHook(() => useTactilePulseEmitter({ state: makeState(), serverTimeOffsetMs: 0, send }));

    act(() => raf.runNext());
    expect(send).not.toHaveBeenCalled();

    now = 400;
    act(() => raf.runNext());
    expect(send).toHaveBeenCalledWith({
      kind: 'TACTILE_PULSE',
      side: 'right',
      durationMs: 180,
      sequence: 1,
      emittedAtMs: 400,
    });

    now = 410;
    act(() => raf.runNext());
    expect(send).toHaveBeenCalledTimes(1);

    now = 700;
    act(() => raf.runNext());
    expect(send).toHaveBeenLastCalledWith({
      kind: 'TACTILE_PULSE',
      side: 'left',
      durationMs: 180,
      sequence: 2,
      emittedAtMs: 700,
    });
  });

  it('does not schedule frames when tactile output is disabled', () => {
    const raf = installRaf();
    renderHook(() =>
      useTactilePulseEmitter({
        state: makeState({ tactile: { ...DEFAULT_SESSION_STATE.tactile, enabled: false } }),
        serverTimeOffsetMs: 0,
        send: vi.fn(),
      }),
    );

    expect(raf.count()).toBe(0);
  });

  it('cancels the scheduled frame on unmount', () => {
    const raf = installRaf();
    const { unmount } = renderHook(() =>
      useTactilePulseEmitter({ state: makeState(), serverTimeOffsetMs: 0, send: vi.fn() }),
    );

    expect(raf.count()).toBe(1);
    unmount();
    expect(raf.count()).toBe(0);
  });
});
