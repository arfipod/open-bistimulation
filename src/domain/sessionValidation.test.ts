import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, DEFAULT_SESSION_STATE } from './defaults';
import { normalizeSessionPreferences, normalizeSessionState } from './sessionValidation';

describe('session payload validation', () => {
  it('accepts the current state and preferences contract', () => {
    expect(normalizeSessionState(DEFAULT_SESSION_STATE)).toEqual(DEFAULT_SESSION_STATE);
    expect(normalizeSessionPreferences(DEFAULT_PREFERENCES)).toEqual(DEFAULT_PREFERENCES);
  });

  it('fills optional fields used by sessions created before the current contract', () => {
    const {
      roundDurationMs: _roundDurationMs,
      motionStartedAtMs: _motionStartedAtMs,
      motionElapsedBeforePauseMs: _motionElapsedBeforePauseMs,
      ...legacyState
    } = DEFAULT_SESSION_STATE;
    const {
      stimulus: _stimulus,
      stimulusAlternatesSides: _stimulusAlternatesSides,
      motionOrder: _motionOrder,
      ...legacyVisual
    } = legacyState.visual;
    const { intensity: _intensity, ...legacyTactile } = legacyState.tactile;

    expect(
      normalizeSessionState({
        ...legacyState,
        visual: legacyVisual,
        tactile: legacyTactile,
      }),
    ).toEqual(DEFAULT_SESSION_STATE);
  });

  it('rejects malformed or unsafe state ranges', () => {
    expect(() => normalizeSessionState({ ...DEFAULT_SESSION_STATE, status: 'forged' })).toThrow(
      'Session state is invalid.',
    );
    expect(() =>
      normalizeSessionState({
        ...DEFAULT_SESSION_STATE,
        visual: { ...DEFAULT_SESSION_STATE.visual, dotSize: 100_000 },
      }),
    ).toThrow('Session visual settings are invalid.');
    expect(() =>
      normalizeSessionState({
        ...DEFAULT_SESSION_STATE,
        audio: { ...DEFAULT_SESSION_STATE.audio, volume: Number.NaN },
      }),
    ).toThrow('Session audio settings are invalid.');
  });

  it('rejects malformed preference groups', () => {
    expect(() => normalizeSessionPreferences({ ...DEFAULT_PREFERENCES, tactile: 'invalid' })).toThrow(
      'Session tactile settings are invalid.',
    );
  });
});
