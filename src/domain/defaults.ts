import type { SessionPreferences, SessionState } from './sessionTypes';

export const DEFAULT_SESSION_STATE: SessionState = {
  version: 1,
  status: 'idle',
  startedAtMs: null,
  pausedAtMs: null,
  elapsedBeforePauseMs: 0,
  motionStartedAtMs: null,
  motionElapsedBeforePauseMs: 0,
  setsCompleted: 0,
  visual: {
    enabled: true,
    color: '#0500a8',
    background: '#c9ced1',
    dotSize: 52,
    speed: 5,
    direction: 'horizontal',
    motionOrder: 'left-to-right',
    verticalPosition: 'center',
  },
  audio: {
    enabled: false,
    sound: 'snap',
    volume: 0.7,
    therapistMuted: true,
  },
  tactile: {
    enabled: false,
    pulseDurationMs: 120,
    gapMs: 40,
    intensity: 'medium',
  },
};

export const DEFAULT_PREFERENCES: SessionPreferences = {
  visual: DEFAULT_SESSION_STATE.visual,
  audio: DEFAULT_SESSION_STATE.audio,
  tactile: DEFAULT_SESSION_STATE.tactile,
};

export const VISUAL_COLORS = ['#0500a8', '#46739D', '#ffcc00', '#b83b3f', '#111827', '#ffffff'];
export const BACKGROUND_COLORS = ['#c9ced1', '#6b7280', '#ffffff', '#fbe8ea', '#111827'];
