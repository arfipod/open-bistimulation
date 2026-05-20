import type { SessionState, TactileSide, VisualDirection, VisualSettings } from './sessionTypes';

export interface StimulusPosition {
  x: number;
  y: number;
}

export interface MotionSnapshot {
  elapsedMs: number;
  cycleMs: number;
  phase: number;
  halfCycleIndex: number;
  side: TactileSide;
  passes: number;
}

const MIN_SPEED = 1;
const MAX_SPEED = 20;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Maps the product-style 1..20 speed slider to a full left-right-left cycle duration.
 * Lower values are deliberately slow and high values remain safe for a browser animation.
 */
export function cycleMsFromSpeed(speed: number): number {
  const normalized = (clamp(speed, MIN_SPEED, MAX_SPEED) - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
  const minCycleMs = 650;
  const maxCycleMs = 4200;
  return Math.round(maxCycleMs - normalized * (maxCycleMs - minCycleMs));
}

export function getServerNowMs(serverTimeOffsetMs: number): number {
  return Date.now() + serverTimeOffsetMs;
}

export function getElapsedMs(state: SessionState, nowMs: number): number {
  if (state.status === 'running' && state.startedAtMs !== null) {
    return Math.max(0, state.elapsedBeforePauseMs + nowMs - state.startedAtMs);
  }

  return Math.max(0, state.elapsedBeforePauseMs);
}

export function getMotionSnapshot(state: SessionState, nowMs: number): MotionSnapshot {
  const elapsedMs = getElapsedMs(state, nowMs);
  const cycleMs = cycleMsFromSpeed(state.visual.speed);
  const phase = (elapsedMs / cycleMs) * Math.PI * 2;
  const halfCycleIndex = Math.floor((phase + Math.PI / 2) / Math.PI);
  const side = sideFromHalfCycleIndex(halfCycleIndex);
  const passes = Math.max(0, halfCycleIndex);

  return {
    elapsedMs,
    cycleMs,
    phase,
    halfCycleIndex,
    side,
    passes,
  };
}

export function sideFromHalfCycleIndex(index: number): TactileSide {
  return index % 2 === 0 ? 'right' : 'left';
}

export function getStimulusPosition(
  visual: VisualSettings,
  elapsedMs: number,
  width: number,
  height: number,
): StimulusPosition {
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  const dotRadius = visual.dotSize / 2;
  const padding = dotRadius + 24;
  const ampX = Math.max(8, safeWidth / 2 - padding);
  const ampY = Math.max(8, safeHeight / 2 - padding);
  const cycleMs = cycleMsFromSpeed(visual.speed);
  const phase = (elapsedMs / cycleMs) * Math.PI * 2;
  const centerX = safeWidth / 2;
  const centerY = verticalCenterForPosition(visual.verticalPosition, safeHeight);

  const direction = visual.direction;

  if (direction === 'horizontal') {
    return {
      x: centerX + ampX * Math.sin(phase),
      y: centerY,
    };
  }

  if (direction === 'vertical') {
    return {
      x: centerX,
      y: safeHeight / 2 + ampY * Math.sin(phase),
    };
  }

  if (direction === 'diagonal') {
    return {
      x: centerX + ampX * Math.sin(phase),
      y: safeHeight / 2 + ampY * Math.sin(phase),
    };
  }

  return getInfinityPosition(direction, phase, centerX, safeHeight / 2, ampX, ampY);
}

function getInfinityPosition(
  direction: VisualDirection,
  phase: number,
  centerX: number,
  centerY: number,
  ampX: number,
  ampY: number,
): StimulusPosition {
  if (direction !== 'infinity') {
    return { x: centerX, y: centerY };
  }

  return {
    x: centerX + ampX * Math.sin(phase),
    y: centerY + ampY * Math.sin(phase) * Math.cos(phase),
  };
}

function verticalCenterForPosition(position: VisualSettings['verticalPosition'], height: number): number {
  if (position === 'top') {
    return height * 0.28;
  }

  if (position === 'bottom') {
    return height * 0.72;
  }

  return height / 2;
}

export function startPlayback(state: SessionState, serverStartMs: number): SessionState {
  return {
    ...state,
    version: state.version + 1,
    status: 'running',
    startedAtMs: serverStartMs,
    pausedAtMs: null,
  };
}

export function pausePlayback(state: SessionState, serverPauseMs: number): SessionState {
  return {
    ...state,
    version: state.version + 1,
    status: 'paused',
    elapsedBeforePauseMs: getElapsedMs(state, serverPauseMs),
    pausedAtMs: serverPauseMs,
    startedAtMs: null,
  };
}

export function resumePlayback(state: SessionState, serverResumeMs: number): SessionState {
  return {
    ...state,
    version: state.version + 1,
    status: 'running',
    startedAtMs: serverResumeMs,
    pausedAtMs: null,
  };
}

export function stopPlayback(state: SessionState, serverStopMs: number): SessionState {
  const elapsed = getElapsedMs(state, serverStopMs);
  return {
    ...state,
    version: state.version + 1,
    status: 'stopped',
    startedAtMs: null,
    pausedAtMs: null,
    elapsedBeforePauseMs: elapsed,
    setsCompleted: elapsed > 0 ? state.setsCompleted + 1 : state.setsCompleted,
  };
}

export function resetPlaybackCounters(state: SessionState): SessionState {
  return {
    ...state,
    version: state.version + 1,
    status: 'idle',
    startedAtMs: null,
    pausedAtMs: null,
    elapsedBeforePauseMs: 0,
    setsCompleted: 0,
  };
}

export function formatElapsedTime(totalMs: number): string {
  const totalSeconds = Math.floor(totalMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
