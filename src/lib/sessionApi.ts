import { DEFAULT_PREFERENCES, DEFAULT_SESSION_STATE } from '../domain/defaults';
import { normalizeSessionPreferences, normalizeSessionState } from '../domain/sessionValidation';
import type { SessionPreferences, SessionRecord, SessionRole, SessionState } from '../domain/sessionTypes';
import { isSupabaseConfigured, supabase } from './supabase';

interface CreateSessionRow {
  id: string;
  therapist_token: string;
  client_token: string;
  state: unknown;
  preferences: unknown;
  expires_at: string | null;
  therapist_heartbeat_at: string | null;
}

interface GetSessionRow {
  id: string;
  role: SessionRole;
  therapist_token: string | null;
  client_token: string | null;
  state: unknown;
  preferences: unknown;
  expires_at: string | null;
  ended_at: string | null;
  therapist_heartbeat_at: string | null;
}

function ensureConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Copy .env.example to .env.local and fill in the project URL and anon key.');
  }
}

function ensureMutationSucceeded(data: unknown, operation: string): void {
  if (data !== true) {
    throw new Error(`${operation} was rejected by the server.`);
  }
}

export async function createBlsSession(
  state: SessionState = DEFAULT_SESSION_STATE,
  preferences: SessionPreferences = DEFAULT_PREFERENCES,
): Promise<SessionRecord> {
  ensureConfigured();

  const { data, error } = await supabase
    .rpc('create_bls_session', {
      _state: state,
      _preferences: preferences,
      _ttl_minutes: 24 * 60,
    })
    .single<CreateSessionRow>();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    role: 'therapist',
    therapistToken: data.therapist_token,
    clientToken: data.client_token,
    state: data.state === null ? DEFAULT_SESSION_STATE : normalizeSessionState(data.state),
    preferences: data.preferences === null ? DEFAULT_PREFERENCES : normalizeSessionPreferences(data.preferences),
    expiresAt: data.expires_at,
    endedAt: null,
    therapistHeartbeatAt: data.therapist_heartbeat_at,
  };
}

export async function getBlsSession(sessionId: string, token: string): Promise<SessionRecord> {
  ensureConfigured();

  const { data, error } = await supabase
    .rpc('get_bls_session', {
      _session_id: sessionId,
      _token: token,
    })
    .maybeSingle<GetSessionRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Session not found or token is invalid.');
  }

  return {
    id: data.id,
    role: data.role,
    therapistToken: data.therapist_token ?? undefined,
    clientToken: data.client_token ?? undefined,
    state: data.state === null ? DEFAULT_SESSION_STATE : normalizeSessionState(data.state),
    preferences: data.preferences === null ? DEFAULT_PREFERENCES : normalizeSessionPreferences(data.preferences),
    expiresAt: data.expires_at,
    endedAt: data.ended_at,
    therapistHeartbeatAt: data.therapist_heartbeat_at,
  };
}

export async function saveTherapistState(sessionId: string, therapistToken: string, state: SessionState): Promise<void> {
  ensureConfigured();

  const { data, error } = await supabase.rpc('therapist_save_state', {
    _session_id: sessionId,
    _therapist_token: therapistToken,
    _state: state,
    _expected_version: state.version - 1,
  });

  if (error) {
    throw error;
  }

  ensureMutationSucceeded(data, 'Session state update');
}

export async function saveTherapistPreferences(
  sessionId: string,
  therapistToken: string,
  preferences: SessionPreferences,
): Promise<void> {
  ensureConfigured();

  const { data, error } = await supabase.rpc('therapist_save_preferences', {
    _session_id: sessionId,
    _therapist_token: therapistToken,
    _preferences: preferences,
  });

  if (error) {
    throw error;
  }

  ensureMutationSucceeded(data, 'Session preferences update');
}

export async function stopTherapistSession(sessionId: string, therapistToken: string): Promise<SessionState> {
  ensureConfigured();

  const { data, error } = await supabase.rpc('therapist_stop_session', {
    _session_id: sessionId,
    _therapist_token: therapistToken,
  });

  if (error) {
    throw error;
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Session stop was rejected by the server.');
  }

  return normalizeSessionState(data);
}

export async function endBlsSession(sessionId: string, therapistToken: string): Promise<void> {
  ensureConfigured();

  const { data, error } = await supabase.rpc('end_bls_session', {
    _session_id: sessionId,
    _therapist_token: therapistToken,
  });

  if (error) {
    throw error;
  }

  ensureMutationSucceeded(data, 'Session end');
}

export async function heartbeatTherapistSession(sessionId: string, therapistToken: string): Promise<void> {
  ensureConfigured();

  const { data, error } = await supabase.rpc('therapist_heartbeat', {
    _session_id: sessionId,
    _therapist_token: therapistToken,
  });

  if (error) {
    throw error;
  }

  ensureMutationSucceeded(data, 'Controller heartbeat');
}

export async function getServerTimeMs(): Promise<number> {
  ensureConfigured();

  const { data, error } = await supabase.rpc('get_server_time_ms');

  if (error) {
    throw error;
  }

  const serverTimeMs = Number(data);

  if (!Number.isFinite(serverTimeMs) || serverTimeMs <= 0) {
    throw new Error('The server returned an invalid clock value.');
  }

  return serverTimeMs;
}
