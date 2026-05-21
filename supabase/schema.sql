-- Open Bistimulation MVP schema
-- Run this file in Supabase Dashboard > SQL Editor > New Query.

create extension if not exists pgcrypto;

-- Remove obsolete tactile-device persistence from older installs.
-- Joy-Con detection and rumble stay local to the controller browser.
drop function if exists public.upsert_tactile_device(uuid, text, text, text, text, boolean);
drop table if exists public.tactile_devices;

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  therapist_token text not null,
  client_token text not null,
  state jsonb not null default '{}'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  ended_at timestamptz
);

create index if not exists idx_sessions_expires_at on public.sessions (expires_at);

alter table public.sessions enable row level security;

-- The MVP uses SECURITY DEFINER RPC functions instead of direct table access.
-- This keeps table data unavailable to the anon key while still allowing the app to create and operate sessions.
drop policy if exists "deny direct sessions select" on public.sessions;
drop policy if exists "deny direct sessions insert" on public.sessions;
drop policy if exists "deny direct sessions update" on public.sessions;
drop policy if exists "deny direct sessions delete" on public.sessions;
create policy "deny direct sessions select" on public.sessions for select using (false);
create policy "deny direct sessions insert" on public.sessions for insert with check (false);
create policy "deny direct sessions update" on public.sessions for update using (false) with check (false);
create policy "deny direct sessions delete" on public.sessions for delete using (false);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sessions_touch_updated_at on public.sessions;
create trigger sessions_touch_updated_at
before update on public.sessions
for each row execute function public.touch_updated_at();

create or replace function public.get_server_time_ms()
returns bigint
language sql
volatile
security definer
set search_path = public, extensions
as $$
  select floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;

create or replace function public.create_bls_session(
  _state jsonb,
  _preferences jsonb default '{}'::jsonb,
  _ttl_minutes integer default 1440
)
returns table (
  id uuid,
  therapist_token text,
  client_token text,
  state jsonb,
  preferences jsonb,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid := gen_random_uuid();
  v_therapist_token text := encode(gen_random_bytes(24), 'hex');
  v_client_token text := encode(gen_random_bytes(24), 'hex');
  v_expires_at timestamptz := now() + make_interval(mins => greatest(coalesce(_ttl_minutes, 1440), 10));
begin
  insert into public.sessions (id, therapist_token, client_token, state, preferences, expires_at)
  values (v_id, v_therapist_token, v_client_token, coalesce(_state, '{}'::jsonb), coalesce(_preferences, '{}'::jsonb), v_expires_at);

  return query
  select s.id, s.therapist_token, s.client_token, s.state, s.preferences, s.expires_at
  from public.sessions s
  where s.id = v_id;
end;
$$;

create or replace function public.get_bls_session(
  _session_id uuid,
  _token text
)
returns table (
  id uuid,
  role text,
  therapist_token text,
  client_token text,
  state jsonb,
  preferences jsonb,
  expires_at timestamptz,
  ended_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select
    s.id,
    case when s.therapist_token = _token then 'therapist' else 'client' end as role,
    case when s.therapist_token = _token then s.therapist_token else null end as therapist_token,
    case when s.therapist_token = _token then s.client_token else null end as client_token,
    s.state,
    s.preferences,
    s.expires_at,
    s.ended_at
  from public.sessions s
  where s.id = _session_id
    and s.ended_at is null
    and (s.expires_at is null or s.expires_at > now())
    and (_token = s.therapist_token or _token = s.client_token);
end;
$$;

create or replace function public.therapist_save_state(
  _session_id uuid,
  _therapist_token text,
  _state jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.sessions s
  set state = coalesce(_state, '{}'::jsonb)
  where s.id = _session_id
    and s.therapist_token = _therapist_token
    and s.ended_at is null
    and (s.expires_at is null or s.expires_at > now());

  return found;
end;
$$;

create or replace function public.therapist_save_preferences(
  _session_id uuid,
  _therapist_token text,
  _preferences jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.sessions s
  set preferences = coalesce(_preferences, '{}'::jsonb)
  where s.id = _session_id
    and s.therapist_token = _therapist_token
    and s.ended_at is null
    and (s.expires_at is null or s.expires_at > now());

  return found;
end;
$$;

create or replace function public.end_bls_session(
  _session_id uuid,
  _therapist_token text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.sessions s
  set ended_at = now()
  where s.id = _session_id
    and s.therapist_token = _therapist_token
    and s.ended_at is null;

  return found;
end;
$$;

create or replace function public.cleanup_expired_bls_sessions()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_deleted integer;
begin
  delete from public.sessions s
  where s.expires_at is not null
    and s.expires_at <= now();

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on public.sessions from anon, authenticated;
revoke all on function public.cleanup_expired_bls_sessions() from public, anon, authenticated;

grant execute on function public.get_server_time_ms() to anon, authenticated;
grant execute on function public.create_bls_session(jsonb, jsonb, integer) to anon, authenticated;
grant execute on function public.get_bls_session(uuid, text) to anon, authenticated;
grant execute on function public.therapist_save_state(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.therapist_save_preferences(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.end_bls_session(uuid, text) to anon, authenticated;
