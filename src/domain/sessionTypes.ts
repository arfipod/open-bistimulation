export type SessionRole = 'therapist' | 'client';
export type SessionStatus = 'idle' | 'running' | 'paused' | 'stopping' | 'stopped' | 'ended';
export type VisualDirection = 'horizontal' | 'vertical' | 'diagonal' | 'diagonal-down' | 'diagonal-up' | 'infinity';
export type MotionOrder = 'left-to-right' | 'right-to-left' | 'random';
export type VerticalPosition = 'top' | 'center' | 'bottom';
export type AudioSound = 'snap' | 'beep' | 'bell' | 'heartbeat';
export type TactileSide = 'left' | 'right';

export interface VisualSettings {
  enabled: boolean;
  color: string;
  background: string;
  dotSize: number;
  speed: number;
  direction: VisualDirection;
  motionOrder?: MotionOrder;
  verticalPosition: VerticalPosition;
}

export interface AudioSettings {
  enabled: boolean;
  sound: AudioSound;
  volume: number;
  therapistMuted: boolean;
}

export interface TactileSettings {
  enabled: boolean;
  pulseDurationMs: number;
  gapMs: number;
}

export interface SessionState {
  version: number;
  status: SessionStatus;
  /** Server-clock timestamp used as the origin for the current running segment. */
  startedAtMs: number | null;
  /** Server-clock timestamp of the latest pause. */
  pausedAtMs: number | null;
  /** Accumulated elapsed running time before the current running segment. */
  elapsedBeforePauseMs: number;
  /** Server-clock timestamp used as the origin for the current visual/audio/tactile motion segment. */
  motionStartedAtMs?: number | null;
  /** Accumulated motion time before the current running segment. May differ from session time after speed changes. */
  motionElapsedBeforePauseMs?: number;
  setsCompleted: number;
  visual: VisualSettings;
  audio: AudioSettings;
  tactile: TactileSettings;
}

export interface SessionPreferences {
  visual: VisualSettings;
  audio: AudioSettings;
  tactile: TactileSettings;
}

export interface SessionRecord {
  id: string;
  role: SessionRole;
  therapistToken?: string;
  clientToken?: string;
  state: SessionState;
  preferences: SessionPreferences;
  expiresAt: string | null;
  endedAt: string | null;
}

export interface ClientStatus {
  connected: boolean;
  lastSeenAtMs: number | null;
}

export interface TactileDeviceStatus {
  side: TactileSide;
  deviceId: string | null;
  label: string | null;
  connected: boolean;
  lastSeenAtMs: number | null;
  unsupported?: boolean;
}

export type SessionBroadcastMessage =
  | {
      kind: 'STATE_UPDATED';
      state: SessionState;
      emittedAtMs: number;
    }
  | {
      kind: 'CLIENT_READY';
      emittedAtMs: number;
    }
  | {
      kind: 'TACTILE_DEVICE_READY';
      side: TactileSide;
      deviceId: string;
      label: string;
      emittedAtMs: number;
      supported: boolean;
    }
  | {
      kind: 'TACTILE_DEVICE_HEARTBEAT';
      side: TactileSide;
      deviceId: string;
      emittedAtMs: number;
      supported: boolean;
    }
  | {
      kind: 'TACTILE_PULSE';
      side: TactileSide;
      durationMs: number;
      sequence: number;
      emittedAtMs: number;
    }
  | {
      kind: 'SESSION_ENDED';
      emittedAtMs: number;
    };

export interface RouteInfo {
  page: 'landing' | 'therapist' | 'client' | 'tactile' | 'legal' | 'privacy' | 'terms' | 'disclaimer' | 'not-found';
  sessionId?: string;
  token?: string;
  side?: TactileSide;
}
