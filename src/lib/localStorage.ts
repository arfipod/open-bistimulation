import { DEFAULT_PREFERENCES } from '../domain/defaults';
import type { SessionPreferences } from '../domain/sessionTypes';

const PREFERENCES_KEY = 'open-binstimulation.preferences.v1';

export function loadLocalPreferences(): SessionPreferences {
  const raw = localStorage.getItem(PREFERENCES_KEY);

  if (!raw) {
    return DEFAULT_PREFERENCES;
  }

  try {
    return {
      ...DEFAULT_PREFERENCES,
      ...JSON.parse(raw),
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
