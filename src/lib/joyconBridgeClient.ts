export type JoyConSide = 'left' | 'right' | 'both';
export type JoyConIntensity = 'low' | 'medium' | 'high';

export interface JoyConBatterySummary {
  label?: string | null;
  level?: number | null;
  percent?: number | null;
  charging?: boolean | null;
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

export interface JoyConBridgeStatus {
  ok: true;
  mode?: string;
  bridgeVersion?: string;
  endpoints?: string[];
}

export interface JoyConBridgeResult {
  ok: true;
  events?: unknown[];
}

interface JoyConDevicesResponse {
  ok: true;
  devices: JoyConDeviceSummary[];
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
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

export class JoyConBridgeClientError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'JoyConBridgeClientError';
    this.status = status;
  }
}

const DEFAULT_TIMEOUT_MS = 2500;
const MAX_PULSE_TIMEOUT_MS = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function endpointUrl(baseUrl: string, path: string): string {
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    throw new JoyConBridgeClientError('Joy-Con bridge URL is not valid.');
  }
}

function errorMessageFromBody(body: unknown, fallback: string): string {
  if (isRecord(body) && typeof body.error === 'string' && body.error.trim()) {
    return body.error;
  }

  return fallback;
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && error.name === 'AbortError';
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new JoyConBridgeClientError('Joy-Con bridge returned invalid JSON.', response.status);
  }
}

async function requestBridgeJson<T>(baseUrl: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers, ...requestOptions } = options;
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpointUrl(baseUrl, path), {
      ...requestOptions,
      headers,
      signal: controller.signal,
    });
    const body = await parseJsonResponse(response);

    if (!response.ok) {
      throw new JoyConBridgeClientError(
        errorMessageFromBody(body, `Joy-Con bridge request failed with HTTP ${response.status}.`),
        response.status,
      );
    }

    if (isRecord(body) && body.ok === false) {
      throw new JoyConBridgeClientError(errorMessageFromBody(body, 'Joy-Con bridge request failed.'), response.status);
    }

    return body as T;
  } catch (error) {
    if (error instanceof JoyConBridgeClientError) {
      throw error;
    }

    if (isAbortError(error)) {
      throw new JoyConBridgeClientError('Joy-Con bridge request timed out.');
    }

    throw new JoyConBridgeClientError(
      'Could not reach the Joy-Con bridge. Connect both Joy-Cons over Bluetooth, then run npm run joycon:bridge on this computer.',
    );
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function jsonPostOptions(body: unknown, timeoutMs?: number): RequestOptions {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    timeoutMs,
  };
}

function pulseTimeoutMs({ side, duration, repeats }: PulseJoyConOptions): number {
  const targetCount = side === 'both' ? 2 : 1;
  return Math.min(MAX_PULSE_TIMEOUT_MS, Math.max(DEFAULT_TIMEOUT_MS, duration * repeats * targetCount + 2500));
}

export async function getJoyConBridgeStatus(baseUrl: string): Promise<JoyConBridgeStatus> {
  return requestBridgeJson<JoyConBridgeStatus>(baseUrl, '/api/joycon/status');
}

export async function listJoyConDevices(baseUrl: string): Promise<JoyConDeviceSummary[]> {
  const response = await requestBridgeJson<JoyConDevicesResponse>(baseUrl, '/api/joycon/devices');

  if (!Array.isArray(response.devices)) {
    throw new JoyConBridgeClientError('Joy-Con bridge response did not include a device list.');
  }

  return response.devices;
}

export async function pulseJoyCon(baseUrl: string, options: PulseJoyConOptions): Promise<JoyConBridgeResult> {
  return requestBridgeJson<JoyConBridgeResult>(
    baseUrl,
    '/api/joycon/pulse',
    jsonPostOptions(
      {
        side: options.side,
        intensity: options.intensity,
        duration: options.duration,
        repeats: options.repeats,
      },
      pulseTimeoutMs(options),
    ),
  );
}

export async function neutralJoyCon(baseUrl: string, options: NeutralJoyConOptions): Promise<JoyConBridgeResult> {
  return requestBridgeJson<JoyConBridgeResult>(baseUrl, '/api/joycon/neutral', jsonPostOptions({ side: options.side }));
}
