import { DEFAULT_PREFERENCES, DEFAULT_SESSION_STATE } from './defaults';
import type {
  AudioSettings,
  SessionPreferences,
  SessionState,
  TactileSettings,
  VisualSettings,
} from './sessionTypes';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

function isFiniteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isNullableTimestamp(value: unknown): value is number | null {
  return value === null || isFiniteInRange(value, 0, Number.MAX_SAFE_INTEGER);
}

function normalizeVisual(value: unknown): VisualSettings {
  if (!isRecord(value)) {
    throw new Error('Session visual settings are invalid.');
  }

  const stimulus = value.stimulus ?? DEFAULT_SESSION_STATE.visual.stimulus;
  const stimulusAlternatesSides =
    value.stimulusAlternatesSides ?? DEFAULT_SESSION_STATE.visual.stimulusAlternatesSides;
  const motionOrder = value.motionOrder ?? DEFAULT_SESSION_STATE.visual.motionOrder;

  if (
    typeof value.enabled !== 'boolean' ||
    typeof value.color !== 'string' ||
    typeof value.background !== 'string' ||
    !isOneOf(stimulus, ['dot', 'dog', 'flower', 'sun', 'star', 'heart', 'smile'] as const) ||
    typeof stimulusAlternatesSides !== 'boolean' ||
    !isFiniteInRange(value.dotSize, 10, 200) ||
    !isFiniteInRange(value.speed, 1, 20) ||
    !isOneOf(value.direction, ['horizontal', 'vertical', 'diagonal', 'diagonal-down', 'diagonal-up', 'infinity'] as const) ||
    !isOneOf(motionOrder, ['left-to-right', 'right-to-left', 'random'] as const) ||
    !isOneOf(value.verticalPosition, ['top', 'center', 'bottom'] as const)
  ) {
    throw new Error('Session visual settings are invalid.');
  }

  return {
    enabled: value.enabled,
    color: value.color,
    stimulus,
    stimulusAlternatesSides,
    background: value.background,
    dotSize: value.dotSize,
    speed: value.speed,
    direction: value.direction,
    motionOrder,
    verticalPosition: value.verticalPosition,
  };
}

function normalizeAudio(value: unknown): AudioSettings {
  if (
    !isRecord(value) ||
    typeof value.enabled !== 'boolean' ||
    !isOneOf(value.sound, ['snap', 'beep', 'bell', 'heartbeat'] as const) ||
    !isFiniteInRange(value.volume, 0, 1) ||
    typeof value.therapistMuted !== 'boolean'
  ) {
    throw new Error('Session audio settings are invalid.');
  }

  return {
    enabled: value.enabled,
    sound: value.sound,
    volume: value.volume,
    therapistMuted: value.therapistMuted,
  };
}

function normalizeTactile(value: unknown): TactileSettings {
  if (!isRecord(value)) {
    throw new Error('Session tactile settings are invalid.');
  }

  const intensity = value.intensity ?? DEFAULT_SESSION_STATE.tactile.intensity;
  if (
    typeof value.enabled !== 'boolean' ||
    !isFiniteInRange(value.pulseDurationMs, 10, 5_000) ||
    !isFiniteInRange(value.gapMs, 0, 10_000) ||
    !isOneOf(intensity, ['low', 'medium', 'high'] as const)
  ) {
    throw new Error('Session tactile settings are invalid.');
  }

  return {
    enabled: value.enabled,
    pulseDurationMs: value.pulseDurationMs,
    gapMs: value.gapMs,
    intensity,
  };
}

export function normalizeSessionState(value: unknown): SessionState {
  if (!isRecord(value)) {
    throw new Error('Session state is invalid.');
  }

  const roundDurationMs = value.roundDurationMs ?? DEFAULT_SESSION_STATE.roundDurationMs ?? null;
  const motionStartedAtMs = value.motionStartedAtMs ?? value.startedAtMs;
  const motionElapsedBeforePauseMs = value.motionElapsedBeforePauseMs ?? value.elapsedBeforePauseMs;

  if (
    !Number.isSafeInteger(value.version) ||
    !isFiniteInRange(value.version, 0, Number.MAX_SAFE_INTEGER) ||
    !isOneOf(value.status, ['idle', 'running', 'paused', 'stopping', 'stopped', 'ended'] as const) ||
    !(roundDurationMs === null || isFiniteInRange(roundDurationMs, 1, 60 * 60_000)) ||
    !isNullableTimestamp(value.startedAtMs) ||
    !isNullableTimestamp(value.pausedAtMs) ||
    !isNullableTimestamp(motionStartedAtMs) ||
    !isFiniteInRange(value.elapsedBeforePauseMs, 0, Number.MAX_SAFE_INTEGER) ||
    !isFiniteInRange(motionElapsedBeforePauseMs, 0, Number.MAX_SAFE_INTEGER) ||
    !Number.isSafeInteger(value.setsCompleted) ||
    !isFiniteInRange(value.setsCompleted, 0, Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error('Session state is invalid.');
  }

  return {
    version: value.version,
    status: value.status,
    roundDurationMs,
    startedAtMs: value.startedAtMs,
    pausedAtMs: value.pausedAtMs,
    elapsedBeforePauseMs: value.elapsedBeforePauseMs,
    motionStartedAtMs,
    motionElapsedBeforePauseMs,
    setsCompleted: value.setsCompleted,
    visual: normalizeVisual(value.visual),
    audio: normalizeAudio(value.audio),
    tactile: normalizeTactile(value.tactile),
  };
}

export function normalizeSessionPreferences(value: unknown): SessionPreferences {
  if (!isRecord(value)) {
    throw new Error('Session preferences are invalid.');
  }

  return {
    visual: normalizeVisual(value.visual ?? DEFAULT_PREFERENCES.visual),
    audio: normalizeAudio(value.audio ?? DEFAULT_PREFERENCES.audio),
    tactile: normalizeTactile(value.tactile ?? DEFAULT_PREFERENCES.tactile),
  };
}
