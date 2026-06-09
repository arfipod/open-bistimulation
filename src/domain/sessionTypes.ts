export type SessionRole = 'therapist' | 'client';
export type SessionStatus = 'idle' | 'running' | 'paused' | 'stopping' | 'stopped' | 'ended';
export type VisualDirection = 'horizontal' | 'vertical' | 'diagonal' | 'diagonal-down' | 'diagonal-up' | 'infinity';
export type MotionOrder = 'left-to-right' | 'right-to-left' | 'random';
export type VerticalPosition = 'top' | 'center' | 'bottom';
export type VisualStimulus = 'dot' | 'dog' | 'flower' | 'sun' | 'star' | 'heart' | 'smile';
export type AudioSound = 'snap' | 'beep' | 'bell' | 'heartbeat';
export type TactileSide = 'left' | 'right';
export type TactileIntensity = 'low' | 'medium' | 'high';

export interface VisualSettings {
  enabled: boolean;
  color: string;
  stimulus?: VisualStimulus;
  stimulusAlternatesSides?: boolean;
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
  intensity?: TactileIntensity;
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

export interface JoyConOutputStatus {
  lastPulseSide: TactileSide | null;
  lastPulseAt: number | null;
  pulseCount: number;
  lastError: string | null;
  skippedPulseCount: number;
}

export interface JoyConClientStatus {
  webHidSupported: boolean;
  requestingDevices: boolean;
  devices: Array<{
    index?: number;
    side: 'left' | 'right' | 'unknown';
    product?: string;
    manufacturer?: string;
    vendorId?: string;
    productId?: string;
    usagePage?: string | null;
    usage?: string | null;
    interface?: number;
    release?: number;
    serialNumber?: string | null;
    battery?: {
      label?: string | null;
      level?: number | null;
      percent?: number | null;
      charging?: boolean | null;
      error?: string;
    } | null;
    path?: string;
  }>;
  leftConnected: boolean;
  rightConnected: boolean;
  error: string | null;
  outputStatus: JoyConOutputStatus;
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
      kind: 'JOYCON_STATUS';
      status: JoyConClientStatus;
      emittedAtMs: number;
    }
  | {
      kind: 'CLIENT_LEFT';
      emittedAtMs: number;
    }
  | {
      kind: 'SESSION_ENDED';
      emittedAtMs: number;
    };

export interface RouteInfo {
  page: 'landing' | 'therapist' | 'client' | 'legal' | 'privacy' | 'terms' | 'disclaimer' | 'not-found';
  sessionId?: string;
  token?: string;
}
