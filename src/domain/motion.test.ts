import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SESSION_STATE } from './defaults';
import type { SessionState, VisualSettings } from './sessionTypes';
import {
  clamp,
  completeStopPlayback,
  cycleMsFromSpeed,
  formatElapsedTime,
  getElapsedMs,
  getMotionElapsedMs,
  getMotionSnapshot,
  getServerNowMs,
  getStimulusPosition,
  getStoppingDurationMs,
  isStopTransitionComplete,
  pausePlayback,
  resetPlaybackCounters,
  resumePlayback,
  retimeMotionForVisualChange,
  sideFromHalfCycleIndex,
  startPlayback,
  stopPlayback,
} from './motion';

function makeState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    ...DEFAULT_SESSION_STATE,
    visual: { ...DEFAULT_SESSION_STATE.visual },
    audio: { ...DEFAULT_SESSION_STATE.audio },
    tactile: { ...DEFAULT_SESSION_STATE.tactile },
    ...overrides,
  };
}

function makeVisual(overrides: Partial<VisualSettings> = {}): VisualSettings {
  return {
    ...DEFAULT_SESSION_STATE.visual,
    ...overrides,
  };
}

describe('motion domain', () => {
  it('clamps values and maps speed boundaries to safe cycle durations', () => {
    expect(clamp(3, 1, 5)).toBe(3);
    expect(clamp(-3, 1, 5)).toBe(1);
    expect(clamp(9, 1, 5)).toBe(5);
    expect(cycleMsFromSpeed(1)).toBe(4200);
    expect(cycleMsFromSpeed(20)).toBe(650);
    expect(cycleMsFromSpeed(-100)).toBe(4200);
    expect(cycleMsFromSpeed(100)).toBe(650);
    expect(cycleMsFromSpeed(10.5)).toBe(2425);
  });

  it('uses the browser clock plus server offset', () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000);

    expect(getServerNowMs(250)).toBe(10_250);
    expect(getServerNowMs(-750)).toBe(9_250);
  });

  it('computes elapsed session time for running, paused, and invalid negative clocks', () => {
    expect(
      getElapsedMs(
        makeState({
          status: 'running',
          startedAtMs: 1_000,
          elapsedBeforePauseMs: 500,
        }),
        2_400,
      ),
    ).toBe(1_900);

    expect(
      getElapsedMs(
        makeState({
          status: 'paused',
          startedAtMs: null,
          elapsedBeforePauseMs: 3_500,
        }),
        9_999,
      ),
    ).toBe(3_500);

    expect(
      getElapsedMs(
        makeState({
          status: 'running',
          startedAtMs: 5_000,
          elapsedBeforePauseMs: -250,
        }),
        4_000,
      ),
    ).toBe(0);
  });

  it('separates motion time from session time when a motion clock exists', () => {
    expect(
      getMotionElapsedMs(
        makeState({
          status: 'running',
          startedAtMs: 1_000,
          elapsedBeforePauseMs: 9_000,
          motionStartedAtMs: 2_000,
          motionElapsedBeforePauseMs: 250,
        }),
        3_250,
      ),
    ).toBe(1_500);

    expect(
      getMotionElapsedMs(
        makeState({
          status: 'running',
          startedAtMs: 1_000,
          elapsedBeforePauseMs: 750,
          motionStartedAtMs: undefined,
          motionElapsedBeforePauseMs: undefined,
        }),
        2_000,
      ),
    ).toBe(1_750);
  });

  it('creates motion snapshots with deterministic pass and side information', () => {
    const cycleMs = cycleMsFromSpeed(20);
    const state = makeState({
      status: 'running',
      startedAtMs: 0,
      motionStartedAtMs: 0,
      visual: makeVisual({ speed: 20, motionOrder: 'left-to-right' }),
    });

    expect(getMotionSnapshot(state, 0)).toMatchObject({
      elapsedMs: 0,
      cycleMs,
      halfCycleIndex: 0,
      side: 'right',
      passes: 0,
    });
    expect(getMotionSnapshot(state, cycleMs / 4)).toMatchObject({
      halfCycleIndex: 1,
      side: 'right',
      passes: 1,
    });
    expect(getMotionSnapshot(state, cycleMs * 0.75)).toMatchObject({
      halfCycleIndex: 2,
      side: 'left',
      passes: 2,
    });
  });

  it('maps half-cycle indices to left/right order, including deterministic random mode', () => {
    expect([0, 1, 2, 3].map((index) => sideFromHalfCycleIndex(index, 'left-to-right'))).toEqual([
      'right',
      'right',
      'left',
      'right',
    ]);
    expect([0, 1, 2, 3].map((index) => sideFromHalfCycleIndex(index, 'right-to-left'))).toEqual([
      'left',
      'left',
      'right',
      'left',
    ]);
    expect([0, 1, 2, 3, 4, 5].map((index) => sideFromHalfCycleIndex(index, 'random'))).toEqual([
      'left',
      'left',
      'left',
      'left',
      'left',
      'right',
    ]);
  });

  it('positions the stimulus across every visual direction and vertical band', () => {
    const cycleMs = cycleMsFromSpeed(20);
    const width = 400;
    const height = 300;

    const topPosition = getStimulusPosition(makeVisual({ speed: 20, verticalPosition: 'top' }), cycleMs / 4, width, height);
    expect(topPosition.x).toBe(350);
    expect(topPosition.y).toBeCloseTo(84);

    const bottomPosition = getStimulusPosition(
      makeVisual({ speed: 20, motionOrder: 'right-to-left', verticalPosition: 'bottom' }),
      cycleMs / 4,
      width,
      height,
    );
    expect(bottomPosition.x).toBe(50);
    expect(bottomPosition.y).toBeCloseTo(216);
    expect(getStimulusPosition(makeVisual({ speed: 20, direction: 'vertical' }), cycleMs / 4, width, height)).toEqual({
      x: 200,
      y: 250,
    });
    expect(getStimulusPosition(makeVisual({ speed: 20, direction: 'diagonal-down' }), cycleMs / 4, width, height)).toEqual({
      x: 350,
      y: 250,
    });
    expect(getStimulusPosition(makeVisual({ speed: 20, direction: 'diagonal-up' }), cycleMs / 4, width, height)).toEqual({
      x: 350,
      y: 50,
    });
    expect(getStimulusPosition(makeVisual({ speed: 20, direction: 'infinity' }), cycleMs / 4, width, height)).toEqual({
      x: 350,
      y: 150,
    });
    expect(
      getStimulusPosition(
        makeVisual({ speed: 20, direction: 'infinity', motionOrder: 'right-to-left' }),
        cycleMs / 4,
        width,
        height,
      ),
    ).toEqual({ x: 50, y: 150 });
  });

  it('keeps coordinates finite on tiny stage sizes', () => {
    expect(getStimulusPosition(makeVisual({ direction: 'horizontal' }), 0, 0, 0)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('transitions through start, pause, resume, stop, complete, and reset states', () => {
    const started = startPlayback(makeState({ version: 2, elapsedBeforePauseMs: 300 }), 1_000);
    expect(started).toMatchObject({
      version: 3,
      status: 'running',
      startedAtMs: 1_000,
      motionStartedAtMs: 1_000,
      motionElapsedBeforePauseMs: 0,
      pausedAtMs: null,
    });

    const paused = pausePlayback(started, 2_500);
    expect(paused).toMatchObject({
      version: 4,
      status: 'paused',
      startedAtMs: null,
      motionStartedAtMs: null,
      pausedAtMs: 2_500,
      elapsedBeforePauseMs: 1_800,
      motionElapsedBeforePauseMs: 1_500,
    });

    const resumed = resumePlayback(paused, 3_000);
    expect(resumed).toMatchObject({
      version: 5,
      status: 'running',
      startedAtMs: 3_000,
      motionStartedAtMs: 3_000,
      motionElapsedBeforePauseMs: 1_500,
      pausedAtMs: null,
    });

    const stopping = stopPlayback(resumed, 4_000);
    expect(stopping).toMatchObject({
      version: 6,
      status: 'stopping',
      startedAtMs: null,
      pausedAtMs: null,
      elapsedBeforePauseMs: 2_800,
      motionElapsedBeforePauseMs: 2_500,
      setsCompleted: 1,
    });
    expect(stopping.motionStartedAtMs).toBe(4_000);

    const stopped = completeStopPlayback(stopping);
    expect(stopped).toMatchObject({
      version: 7,
      status: 'stopped',
      motionStartedAtMs: null,
      motionElapsedBeforePauseMs: 0,
    });

    expect(resetPlaybackCounters({ ...stopped, setsCompleted: 4 })).toMatchObject({
      version: 8,
      status: 'idle',
      startedAtMs: null,
      pausedAtMs: null,
      elapsedBeforePauseMs: 0,
      motionStartedAtMs: null,
      motionElapsedBeforePauseMs: 0,
      setsCompleted: 0,
    });
  });

  it('stops immediately when there is no elapsed playback to animate', () => {
    expect(stopPlayback(makeState({ status: 'idle', setsCompleted: 3 }), 5_000)).toMatchObject({
      status: 'stopped',
      motionStartedAtMs: null,
      motionElapsedBeforePauseMs: 0,
      setsCompleted: 3,
    });
  });

  it('animates stopping to the next centered position and reports completion', () => {
    const state = makeState({
      status: 'stopping',
      elapsedBeforePauseMs: 500,
      motionStartedAtMs: 1_000,
      motionElapsedBeforePauseMs: 0,
      visual: makeVisual({ speed: 20 }),
    });

    expect(state.status).toBe('stopping');
    expect(getStoppingDurationMs(state)).toBe(975);
    expect(isStopTransitionComplete(state, 1_974)).toBe(false);
    expect(isStopTransitionComplete(state, 1_975)).toBe(true);
    expect(getMotionElapsedMs(state, 1_000)).toBe(0);
    expect(getMotionElapsedMs(state, 1_975)).toBe(650);
  });

  it('retimes motion proportionally when visual speed changes mid-run', () => {
    const state = makeState({
      status: 'running',
      startedAtMs: 1_000,
      motionStartedAtMs: 1_000,
      motionElapsedBeforePauseMs: 500,
      visual: makeVisual({ speed: 5 }),
    });
    const nextVisual = makeVisual({ speed: 10, color: '#ffffff' });
    const next = retimeMotionForVisualChange(state, nextVisual, 2_000);
    const expectedMotionElapsed = getMotionElapsedMs(state, 2_000) * (cycleMsFromSpeed(10) / cycleMsFromSpeed(5));

    expect(next.visual).toBe(nextVisual);
    expect(next.motionStartedAtMs).toBe(2_000);
    expect(next.motionElapsedBeforePauseMs).toBeCloseTo(expectedMotionElapsed);
  });

  it('keeps motion clock untouched when speed does not change', () => {
    const state = makeState({
      status: 'paused',
      motionStartedAtMs: null,
      motionElapsedBeforePauseMs: 500,
      visual: makeVisual({ speed: 5 }),
    });
    const nextVisual = makeVisual({ speed: 5, color: '#ffffff' });

    expect(retimeMotionForVisualChange(state, nextVisual, 2_000)).toEqual({
      ...state,
      visual: nextVisual,
    });
  });

  it('formats elapsed time as minutes and zero-padded seconds', () => {
    expect(formatElapsedTime(0)).toBe('0:00');
    expect(formatElapsedTime(59_999)).toBe('0:59');
    expect(formatElapsedTime(60_000)).toBe('1:00');
    expect(formatElapsedTime(3_665_000)).toBe('61:05');
  });
});
