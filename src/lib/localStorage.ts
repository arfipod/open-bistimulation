import { DEFAULT_PREFERENCES } from '../domain/defaults';
import type { SessionPreferences } from '../domain/sessionTypes';

const PREFERENCES_KEY = 'open-bistimulation.preferences.v1';
const JOYCON_BRIDGE_URL_KEY = 'open-bistimulation.joyconBridgeUrl.v1';

export const DEFAULT_JOYCON_BRIDGE_URL = 'http://127.0.0.1:5174';

export function normalizeJoyConBridgeUrl(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);

    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) {
      return null;
    }

    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function isValidJoyConBridgeUrl(value: string): boolean {
  return normalizeJoyConBridgeUrl(value) !== null;
}

export function getJoyConBridgeUrl(): string {
  const raw = localStorage.getItem(JOYCON_BRIDGE_URL_KEY);
  const normalized = raw ? normalizeJoyConBridgeUrl(raw) : null;
  return normalized ?? DEFAULT_JOYCON_BRIDGE_URL;
}

export function saveJoyConBridgeUrl(url: string): void {
  const normalized = normalizeJoyConBridgeUrl(url);

  if (!normalized) {
    throw new Error('Invalid Joy-Con bridge URL.');
  }

  localStorage.setItem(JOYCON_BRIDGE_URL_KEY, normalized);
}

export function loadLocalPreferences(): SessionPreferences {
  const raw = localStorage.getItem(PREFERENCES_KEY);

  if (!raw) {
    return DEFAULT_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SessionPreferences>;

    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      visual: {
        ...DEFAULT_PREFERENCES.visual,
        ...parsed.visual,
      },
      audio: {
        ...DEFAULT_PREFERENCES.audio,
        ...parsed.audio,
      },
      tactile: {
        ...DEFAULT_PREFERENCES.tactile,
        ...parsed.tactile,
      },
    } as SessionPreferences;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveLocalPreferences(preferences: SessionPreferences): void {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}

export function getOrCreateLocalId(key: string): string {
  const current = localStorage.getItem(key);

  if (current) {
    return current;
  }

  const next = crypto.randomUUID();
  localStorage.setItem(key, next);
  return next;
}
