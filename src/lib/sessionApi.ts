import { DEFAULT_PREFERENCES, DEFAULT_SESSION_STATE } from '../domain/defaults';
import type { SessionPreferences, SessionRecord, SessionRole, SessionState } from '../domain/sessionTypes';
import { isSupabaseConfigured, supabase } from './supabase';

interface CreateSessionRow {
  id: string;
  therapist_token: string;
  client_token: string;
  state: SessionState | null;
  preferences: SessionPreferences | null;
  expires_at: string | null;
}

interface GetSessionRow {
  id: string;
  role: SessionRole;
  therapist_token: string | null;
  client_token: string | null;
  state: SessionState | null;
  preferences: SessionPreferences | null;
  expires_at: string | null;
  ended_at: string | null;
}

function ensureConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Copy .env.example to .env.local and fill in the project URL and anon key.');
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
    state: data.state ?? DEFAULT_SESSION_STATE,
    preferences: data.preferences ?? DEFAULT_PREFERENCES,
    expiresAt: data.expires_at,
    endedAt: null,
  };
}

export async function getBlsSession(sessionId: string, token: string): Promise<SessionRecord> {
  ensureConfigured();

  const { data, error } = await supabase
    .rpc('get_bls_session', {
      _session_id: sessionId,
      _token: token,
    })
    .single<GetSessionRow>();

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
    state: data.state ?? DEFAULT_SESSION_STATE,
    preferences: data.preferences ?? DEFAULT_PREFERENCES,
    expiresAt: data.expires_at,
    endedAt: data.ended_at,
  };
}

export async function saveTherapistState(sessionId: string, therapistToken: string, state: SessionState): Promise<void> {
  ensureConfigured();

  const { error } = await supabase.rpc('therapist_save_state', {
    _session_id: sessionId,
    _therapist_token: therapistToken,
    _state: state,
  });

  if (error) {
    throw error;
  }
}

export async function saveTherapistPreferences(
  sessionId: string,
  therapistToken: string,
  preferences: SessionPreferences,
): Promise<void> {
  ensureConfigured();

  const { error } = await supabase.rpc('therapist_save_preferences', {
    _session_id: sessionId,
    _therapist_token: therapistToken,
    _preferences: preferences,
  });

  if (error) {
    throw error;
  }
}

export async function endBlsSession(sessionId: string, therapistToken: string): Promise<void> {
  ensureConfigured();

  const { error } = await supabase.rpc('end_bls_session', {
    _session_id: sessionId,
    _therapist_token: therapistToken,
  });

  if (error) {
    throw error;
  }
}

export async function getServerTimeMs(): Promise<number> {
  ensureConfigured();

  const { data, error } = await supabase.rpc('get_server_time_ms');

  if (error) {
    throw error;
  }

  return Number(data);
}
