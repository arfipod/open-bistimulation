import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES } from '../domain/defaults';
import type { SessionPreferences } from '../domain/sessionTypes';
import { getOrCreateLocalId, loadLocalPreferences, saveLocalPreferences } from './localStorage';

const preferencesKey = 'open-bistimulation.preferences.v1';

interface PreferencesOverrides {
  visual?: Partial<SessionPreferences['visual']>;
  audio?: Partial<SessionPreferences['audio']>;
  tactile?: Partial<SessionPreferences['tactile']>;
}

function makePreferences(overrides: PreferencesOverrides = {}): SessionPreferences {
  return {
    ...DEFAULT_PREFERENCES,
    visual: { ...DEFAULT_PREFERENCES.visual, ...overrides.visual },
    audio: { ...DEFAULT_PREFERENCES.audio, ...overrides.audio },
    tactile: { ...DEFAULT_PREFERENCES.tactile, ...overrides.tactile },
  };
}

describe('localStorage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when no preferences are stored', () => {
    expect(loadLocalPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('returns defaults when stored preferences are malformed', () => {
    localStorage.setItem(preferencesKey, '{bad-json');

    expect(loadLocalPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('merges partial stored preferences into defaults by section', () => {
    localStorage.setItem(
      preferencesKey,
      JSON.stringify({
        visual: {
          color: '#ffffff',
          speed: 12,
        },
        audio: {
          enabled: true,
          volume: 0.25,
        },
      }),
    );

    expect(loadLocalPreferences()).toEqual(
      makePreferences({
        visual: { color: '#ffffff', speed: 12 },
        audio: { enabled: true, volume: 0.25 },
      }),
    );
  });

  it('persists preferences verbatim', () => {
    const preferences = makePreferences({
      visual: { background: '#111827' },
      tactile: { enabled: true, pulseDurationMs: 240 },
    });

    saveLocalPreferences(preferences);

    expect(JSON.parse(localStorage.getItem(preferencesKey) ?? '')).toEqual(preferences);
  });

  it('returns an existing local id before creating a new one', () => {
    localStorage.setItem('device-id', 'current-device');
    const randomUUID = vi.spyOn(crypto, 'randomUUID');

    expect(getOrCreateLocalId('device-id')).toBe('current-device');
    expect(randomUUID).not.toHaveBeenCalled();
  });

  it('creates and stores a random local id when missing', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000000');

    expect(getOrCreateLocalId('device-id')).toBe('00000000-0000-4000-8000-000000000000');
    expect(localStorage.getItem('device-id')).toBe('00000000-0000-4000-8000-000000000000');
  });
});
