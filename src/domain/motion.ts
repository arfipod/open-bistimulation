import type { MotionOrder, SessionState, TactileSide, VisualDirection, VisualSettings } from './sessionTypes';

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
const STOP_EXTRA_PASS_AT_PROGRESS = 0.75;
const STOP_CENTER_PROGRESS = 1.25;
const STOP_EXTRA_PASS_CENTER_PROGRESS = 2.25;
const STOP_DECELERATION_MULTIPLIER = 1.5;

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

export function getMotionElapsedMs(state: SessionState, nowMs: number): number {
  const hasMotionClock = typeof state.motionElapsedBeforePauseMs === 'number';
  const elapsedBeforePauseMs = hasMotionClock ? state.motionElapsedBeforePauseMs ?? 0 : state.elapsedBeforePauseMs;
  const startedAtMs = hasMotionClock ? state.motionStartedAtMs ?? null : state.startedAtMs;

  if (state.status === 'running' && startedAtMs !== null) {
    return Math.max(0, elapsedBeforePauseMs + nowMs - startedAtMs);
  }

  if (state.status === 'stopping' && startedAtMs !== null) {
    return getStoppingMotionElapsedMs(state, nowMs);
  }

  return Math.max(0, elapsedBeforePauseMs);
}

export function getMotionSnapshot(state: SessionState, nowMs: number): MotionSnapshot {
  const elapsedMs = getMotionElapsedMs(state, nowMs);
  const cycleMs = cycleMsFromSpeed(state.visual.speed);
  const phase = (elapsedMs / cycleMs) * Math.PI * 2;
  const halfCycleIndex = Math.floor((phase + Math.PI / 2) / Math.PI);
  const side = sideFromHalfCycleIndex(halfCycleIndex, getMotionOrder(state.visual));
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

export function sideFromHalfCycleIndex(index: number, motionOrder: MotionOrder = 'left-to-right'): TactileSide {
  return targetSideForSegment(Math.max(0, index - 1), motionOrder);
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
  const motionOrder = getMotionOrder(visual);
  const glide = getOrderedGlide(elapsedMs, cycleMs, motionOrder);
  const centerX = safeWidth / 2;
  const centerY = verticalCenterForPosition(visual.verticalPosition, safeHeight);

  const direction = visual.direction;

  if (direction === 'horizontal') {
    return {
      x: centerX + ampX * glide,
      y: centerY,
    };
  }

  if (direction === 'vertical') {
    return {
      x: centerX,
      y: safeHeight / 2 + ampY * glide,
    };
  }

  if (direction === 'diagonal' || direction === 'diagonal-down') {
    return {
      x: centerX + ampX * glide,
      y: safeHeight / 2 + ampY * glide,
    };
  }

  if (direction === 'diagonal-up') {
    return {
      x: centerX + ampX * glide,
      y: safeHeight / 2 - ampY * glide,
    };
  }

  return getInfinityPosition(direction, phase, centerX, safeHeight / 2, ampX, ampY, glide);
}

function getMotionOrder(visual: VisualSettings): MotionOrder {
  return visual.motionOrder ?? 'left-to-right';
}

function getOrderedGlide(elapsedMs: number, cycleMs: number, motionOrder: MotionOrder): number {
  const halfCycleMs = cycleMs / 2;
  const segmentIndex = Math.floor(elapsedMs / halfCycleMs + 0.5);
  const segmentStartMs = (segmentIndex - 0.5) * halfCycleMs;
  const progress = clamp((elapsedMs - segmentStartMs) / halfCycleMs, 0, 1);
  const from = glideForSide(targetSideForSegment(segmentIndex - 1, motionOrder));
  const to = glideForSide(targetSideForSegment(segmentIndex, motionOrder));
  const easedProgress = smoothStep(progress);

  return from + (to - from) * easedProgress;
}

function smoothStep(progress: number): number {
  const safeProgress = clamp(progress, 0, 1);
  return safeProgress * safeProgress * (3 - 2 * safeProgress);
}

function getStoppingMotionElapsedMs(state: SessionState, nowMs: number): number {
  const stopStartedAtMs = state.motionStartedAtMs;
  const motionElapsedBeforeStopMs = state.motionElapsedBeforePauseMs ?? state.elapsedBeforePauseMs;

  if (stopStartedAtMs === null || stopStartedAtMs === undefined) {
    return 0;
  }

  const cycleMs = cycleMsFromSpeed(state.visual.speed);
  const transition = getStopTransition(motionElapsedBeforeStopMs, cycleMs);
  const durationMs = getStopTransitionDurationMs(transition);

  if (durationMs <= 0) {
    return 0;
  }

  const progress = clamp((nowMs - stopStartedAtMs) / durationMs, 0, 1);
  const easedProgress = Math.sin((progress * Math.PI) / 2);
  const currentProgress =
    transition.startProgress + (transition.endProgress - transition.startProgress) * easedProgress;

  return Math.max(0, (currentProgress - 0.25) * cycleMs);
}

interface StopTransition {
  startProgress: number;
  endProgress: number;
  cycleMs: number;
}

function getStopTransition(motionElapsedMs: number, cycleMs: number): StopTransition {
  const startProgress = Math.max(0, motionElapsedMs) / cycleMs + 0.25;
  const loopProgress = positiveModulo(startProgress, 1);
  const currentCycle = Math.floor(startProgress);
  let endProgress =
    currentCycle + (loopProgress >= STOP_EXTRA_PASS_AT_PROGRESS ? STOP_EXTRA_PASS_CENTER_PROGRESS : STOP_CENTER_PROGRESS);

  if (endProgress <= startProgress) {
    endProgress += 1;
  }

  return {
    startProgress,
    endProgress,
    cycleMs,
  };
}

function getStopTransitionDurationMs(transition: StopTransition): number {
  return (transition.endProgress - transition.startProgress) * transition.cycleMs * STOP_DECELERATION_MULTIPLIER;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function targetSideForSegment(index: number, motionOrder: MotionOrder): TactileSide {
  if (motionOrder === 'right-to-left') {
    return index % 2 === 0 ? 'left' : 'right';
  }

  if (motionOrder === 'random') {
    return deterministicUnit(index) < 0.5 ? 'left' : 'right';
  }

  return index % 2 === 0 ? 'right' : 'left';
}

function glideForSide(side: TactileSide): number {
  return side === 'right' ? 1 : -1;
}

function deterministicUnit(index: number): number {
  let value = Math.imul(index ^ 0x9e3779b9, 0x85ebca6b);
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

function getInfinityPosition(
  direction: VisualDirection,
  phase: number,
  centerX: number,
  centerY: number,
  ampX: number,
  ampY: number,
  glide: number,
): StimulusPosition {
  if (direction !== 'infinity') {
    return { x: centerX, y: centerY };
  }

  return {
    x: centerX + ampX * glide,
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
  const motionElapsedBeforePauseMs = state.motionElapsedBeforePauseMs ?? state.elapsedBeforePauseMs;

  return {
    ...state,
    version: state.version + 1,
    status: 'running',
    startedAtMs: serverStartMs,
    motionStartedAtMs: serverStartMs,
    motionElapsedBeforePauseMs,
    pausedAtMs: null,
  };
}

export function pausePlayback(state: SessionState, serverPauseMs: number): SessionState {
  return {
    ...state,
    version: state.version + 1,
    status: 'paused',
    elapsedBeforePauseMs: getElapsedMs(state, serverPauseMs),
    motionElapsedBeforePauseMs: getMotionElapsedMs(state, serverPauseMs),
    motionStartedAtMs: null,
    pausedAtMs: serverPauseMs,
    startedAtMs: null,
  };
}

export function resumePlayback(state: SessionState, serverResumeMs: number): SessionState {
  const motionElapsedBeforePauseMs = state.motionElapsedBeforePauseMs ?? state.elapsedBeforePauseMs;

  return {
    ...state,
    version: state.version + 1,
    status: 'running',
    startedAtMs: serverResumeMs,
    motionStartedAtMs: serverResumeMs,
    motionElapsedBeforePauseMs,
    pausedAtMs: null,
  };
}

export function stopPlayback(state: SessionState, serverStopMs: number): SessionState {
  const elapsed = getElapsedMs(state, serverStopMs);
  const motionElapsed = getMotionElapsedMs(state, serverStopMs);
  const shouldAnimateStop = elapsed > 0 && state.status !== 'stopped' && state.status !== 'idle';

  return {
    ...state,
    version: state.version + 1,
    status: shouldAnimateStop ? 'stopping' : 'stopped',
    startedAtMs: null,
    motionStartedAtMs: shouldAnimateStop ? serverStopMs : null,
    pausedAtMs: null,
    elapsedBeforePauseMs: elapsed,
    motionElapsedBeforePauseMs: shouldAnimateStop ? motionElapsed : 0,
    setsCompleted: elapsed > 0 ? state.setsCompleted + 1 : state.setsCompleted,
  };
}

export function completeStopPlayback(state: SessionState): SessionState {
  return {
    ...state,
    version: state.version + 1,
    status: 'stopped',
    startedAtMs: null,
    motionStartedAtMs: null,
    pausedAtMs: null,
    motionElapsedBeforePauseMs: 0,
  };
}

export function getStoppingDurationMs(state: SessionState): number {
  if (state.status !== 'stopping') {
    return 0;
  }

  const cycleMs = cycleMsFromSpeed(state.visual.speed);
  return getStopTransitionDurationMs(getStopTransition(state.motionElapsedBeforePauseMs ?? state.elapsedBeforePauseMs, cycleMs));
}

export function isStopTransitionComplete(state: SessionState, nowMs: number): boolean {
  if (state.status !== 'stopping' || state.motionStartedAtMs === null || state.motionStartedAtMs === undefined) {
    return false;
  }

  return nowMs - state.motionStartedAtMs >= getStoppingDurationMs(state);
}

export function resetPlaybackCounters(state: SessionState): SessionState {
  return {
    ...state,
    version: state.version + 1,
    status: 'idle',
    startedAtMs: null,
    pausedAtMs: null,
    elapsedBeforePauseMs: 0,
    motionStartedAtMs: null,
    motionElapsedBeforePauseMs: 0,
    setsCompleted: 0,
  };
}

export function retimeMotionForVisualChange(state: SessionState, nextVisual: VisualSettings, nowMs: number): SessionState {
  if (state.visual.speed === nextVisual.speed) {
    return {
      ...state,
      visual: nextVisual,
    };
  }

  const currentMotionElapsedMs = getMotionElapsedMs(state, nowMs);
  const currentCycleMs = cycleMsFromSpeed(state.visual.speed);
  const nextCycleMs = cycleMsFromSpeed(nextVisual.speed);
  const nextMotionElapsedMs = currentMotionElapsedMs * (nextCycleMs / currentCycleMs);

  return {
    ...state,
    visual: nextVisual,
    motionStartedAtMs: state.status === 'running' || state.status === 'stopping' ? nowMs : null,
    motionElapsedBeforePauseMs: nextMotionElapsedMs,
  };
}

export function formatElapsedTime(totalMs: number): string {
  const totalSeconds = Math.floor(totalMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
