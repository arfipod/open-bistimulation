export type JoyConSide = 'left' | 'right' | 'both';
export type JoyConIntensity = 'low' | 'medium' | 'high';

export interface JoyConBatterySummary {
  label?: string | null;
  level?: number | null;
  percent?: number | null;
  charging?: boolean | null;
  rawPowerInfo?: string | null;
  reportId?: string | null;
  error?: string;
}

export interface JoyConDeviceSummary {
  index?: number;
  side: Exclude<JoyConSide, 'both'> | 'unknown';
  product?: string;
  manufacturer?: string;
  vendorId?: string;
  productId?: string;
  usagePage?: string | null;
  usage?: string | null;
  interface?: number;
  release?: number;
  serialNumber?: string | null;
  battery?: JoyConBatterySummary | null;
  path?: string;
}

export interface PulseJoyConOptions {
  side: JoyConSide;
  intensity: JoyConIntensity;
  duration: number;
  repeats: number;
}

export interface NeutralJoyConOptions {
  side: JoyConSide;
}

export interface JoyConCommandResult {
  ok: true;
  events?: unknown[];
}
