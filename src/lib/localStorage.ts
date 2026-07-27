import { DEFAULT_PREFERENCES } from '../domain/defaults';
import { normalizeSessionPreferences } from '../domain/sessionValidation';
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
  try {
    const raw = localStorage.getItem(JOYCON_BRIDGE_URL_KEY);
    const normalized = raw ? normalizeJoyConBridgeUrl(raw) : null;
    return normalized ?? DEFAULT_JOYCON_BRIDGE_URL;
  } catch {
    return DEFAULT_JOYCON_BRIDGE_URL;
  }
}

export function saveJoyConBridgeUrl(url: string): void {
  const normalized = normalizeJoyConBridgeUrl(url);

  if (!normalized) {
    throw new Error('Invalid Joy-Con bridge URL.');
  }

  try {
    localStorage.setItem(JOYCON_BRIDGE_URL_KEY, normalized);
  } catch {
    // The bridge can still be used for the current page when storage is blocked.
  }
}

export function loadLocalPreferences(): SessionPreferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);

    if (!raw) {
      return DEFAULT_PREFERENCES;
    }

    const parsed = JSON.parse(raw) as Partial<SessionPreferences>;

    return normalizeSessionPreferences({
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
    });
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveLocalPreferences(preferences: SessionPreferences): void {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Session persistence must not depend on optional browser storage.
  }
}

export function getOrCreateLocalId(key: string): string {
  try {
    const current = localStorage.getItem(key);

    if (current) {
      return current;
    }
  } catch {
    // Fall through to an ephemeral identifier.
  }

  const next = crypto.randomUUID();
  try {
    localStorage.setItem(key, next);
  } catch {
    // An ephemeral identifier is sufficient when storage is unavailable.
  }
  return next;
}
