import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES } from '../domain/defaults';
import type { SessionPreferences } from '../domain/sessionTypes';
import {
  DEFAULT_JOYCON_BRIDGE_URL,
  getJoyConBridgeUrl,
  getOrCreateLocalId,
  isValidJoyConBridgeUrl,
  loadLocalPreferences,
  normalizeJoyConBridgeUrl,
  saveJoyConBridgeUrl,
  saveLocalPreferences,
} from './localStorage';

const preferencesKey = 'open-bistimulation.preferences.v1';
const joyConBridgeUrlKey = 'open-bistimulation.joyconBridgeUrl.v1';

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

  it('returns defaults when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(loadLocalPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('returns defaults when stored preferences are malformed', () => {
    localStorage.setItem(preferencesKey, '{bad-json');

    expect(loadLocalPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('returns defaults when stored preferences contain invalid values', () => {
    localStorage.setItem(preferencesKey, JSON.stringify({ visual: { speed: 'fast' } }));

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

  it('treats blocked preference storage as optional', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(() => saveLocalPreferences(makePreferences())).not.toThrow();
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

  it('returns an ephemeral local id when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');

    expect(getOrCreateLocalId('device-id')).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('loads and saves the local Joy-Con bridge URL', () => {
    expect(getJoyConBridgeUrl()).toBe(DEFAULT_JOYCON_BRIDGE_URL);

    saveJoyConBridgeUrl('http://localhost:5174/');

    expect(localStorage.getItem(joyConBridgeUrlKey)).toBe('http://localhost:5174');
    expect(getJoyConBridgeUrl()).toBe('http://localhost:5174');
  });

  it('rejects malformed Joy-Con bridge URLs and falls back to the default', () => {
    expect(isValidJoyConBridgeUrl('http://127.0.0.1:5174')).toBe(true);
    expect(normalizeJoyConBridgeUrl('ftp://127.0.0.1:5174')).toBeNull();
    expect(() => saveJoyConBridgeUrl('not-a-url')).toThrow('Invalid Joy-Con bridge URL.');

    localStorage.setItem(joyConBridgeUrlKey, 'not-a-url');
    expect(getJoyConBridgeUrl()).toBe(DEFAULT_JOYCON_BRIDGE_URL);
  });

  it('falls back gracefully when bridge URL storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(getJoyConBridgeUrl()).toBe(DEFAULT_JOYCON_BRIDGE_URL);
    expect(() => saveJoyConBridgeUrl('http://localhost:5174')).not.toThrow();
  });
});
