import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES, DEFAULT_SESSION_STATE } from '../domain/defaults';
import type { SessionPreferences, SessionState } from '../domain/sessionTypes';

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('./supabase');
});

async function importSessionApi(configured: boolean, rpc = vi.fn()) {
  vi.doMock('./supabase', () => ({
    isSupabaseConfigured: configured,
    supabase: { rpc },
  }));

  return import('./sessionApi');
}

describe('session API', () => {
  it('rejects every backend operation when Supabase is not configured', async () => {
    const api = await importSessionApi(false);

    await expect(api.createBlsSession()).rejects.toThrow('Supabase is not configured');
    await expect(api.getBlsSession('session', 'token')).rejects.toThrow('Supabase is not configured');
  });

  it('creates a therapist session and falls back to defaults for empty state/preferences', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'session-id',
        therapist_token: 'therapist-token',
        client_token: 'client-token',
        state: null,
        preferences: null,
        expires_at: '2026-05-22T00:00:00.000Z',
      },
      error: null,
    });
    const rpc = vi.fn(() => ({ single }));
    const api = await importSessionApi(true, rpc);

    await expect(api.createBlsSession()).resolves.toEqual({
      id: 'session-id',
      role: 'therapist',
      therapistToken: 'therapist-token',
      clientToken: 'client-token',
      state: DEFAULT_SESSION_STATE,
      preferences: DEFAULT_PREFERENCES,
      expiresAt: '2026-05-22T00:00:00.000Z',
      endedAt: null,
    });
    expect(rpc).toHaveBeenCalledWith('create_bls_session', {
      _state: DEFAULT_SESSION_STATE,
      _preferences: DEFAULT_PREFERENCES,
      _ttl_minutes: 24 * 60,
    });
    expect(single).toHaveBeenCalledTimes(1);
  });

  it('propagates create-session RPC errors', async () => {
    const error = new Error('create failed');
    const rpc = vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: null, error }) }));
    const api = await importSessionApi(true, rpc);

    await expect(api.createBlsSession()).rejects.toThrow(error);
  });

  it('loads sessions, hiding unavailable tokens and defaulting empty JSON columns', async () => {
    const state: SessionState = {
      ...DEFAULT_SESSION_STATE,
      status: 'running',
      visual: { ...DEFAULT_SESSION_STATE.visual },
      audio: { ...DEFAULT_SESSION_STATE.audio },
      tactile: { ...DEFAULT_SESSION_STATE.tactile },
    };
    const preferences: SessionPreferences = {
      visual: state.visual,
      audio: state.audio,
      tactile: state.tactile,
    };
    const rpc = vi.fn(() => ({
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'session-id',
          role: 'client',
          therapist_token: null,
          client_token: null,
          state,
          preferences,
          expires_at: null,
          ended_at: null,
        },
        error: null,
      }),
    }));
    const api = await importSessionApi(true, rpc);

    await expect(api.getBlsSession('session-id', 'client-token')).resolves.toEqual({
      id: 'session-id',
      role: 'client',
      therapistToken: undefined,
      clientToken: undefined,
      state,
      preferences,
      expiresAt: null,
      endedAt: null,
    });
    expect(rpc).toHaveBeenCalledWith('get_bls_session', {
      _session_id: 'session-id',
      _token: 'client-token',
    });
  });

  it('throws when a session cannot be found for the token', async () => {
    const rpc = vi.fn(() => ({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    }));
    const api = await importSessionApi(true, rpc);

    await expect(api.getBlsSession('session-id', 'bad-token')).rejects.toThrow('Session not found or token is invalid.');
  });

  it('saves state, preferences, ending, server time, and tactile devices through the expected RPCs', async () => {
    const rpc = vi.fn((name: string) => {
      if (name === 'get_server_time_ms') {
        return Promise.resolve({ data: '123456', error: null });
      }

      return Promise.resolve({ data: true, error: null });
    });
    const api = await importSessionApi(true, rpc);

    await expect(api.saveTherapistState('session-id', 'therapist-token', DEFAULT_SESSION_STATE)).resolves.toBeUndefined();
    await expect(api.saveTherapistPreferences('session-id', 'therapist-token', DEFAULT_PREFERENCES)).resolves.toBeUndefined();
    await expect(api.endBlsSession('session-id', 'therapist-token')).resolves.toBeUndefined();
    await expect(api.getServerTimeMs()).resolves.toBe(123456);
    await expect(
      api.upsertTactileDevice('session-id', 'client-token', 'left', 'device-id', 'Left phone', true),
    ).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('therapist_save_state', {
      _session_id: 'session-id',
      _therapist_token: 'therapist-token',
      _state: DEFAULT_SESSION_STATE,
    });
    expect(rpc).toHaveBeenCalledWith('therapist_save_preferences', {
      _session_id: 'session-id',
      _therapist_token: 'therapist-token',
      _preferences: DEFAULT_PREFERENCES,
    });
    expect(rpc).toHaveBeenCalledWith('end_bls_session', {
      _session_id: 'session-id',
      _therapist_token: 'therapist-token',
    });
    expect(rpc).toHaveBeenCalledWith('get_server_time_ms');
    expect(rpc).toHaveBeenCalledWith('upsert_tactile_device', {
      _session_id: 'session-id',
      _client_token: 'client-token',
      _side: 'left',
      _device_id: 'device-id',
      _label: 'Left phone',
      _connected: true,
    });
  });

  it('propagates mutation RPC errors', async () => {
    const api = await importSessionApi(true, vi.fn().mockResolvedValue({ data: null, error: new Error('save failed') }));

    await expect(api.saveTherapistState('session-id', 'token', DEFAULT_SESSION_STATE)).rejects.toThrow('save failed');
  });
});
