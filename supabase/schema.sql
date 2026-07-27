-- Open Bistimulation MVP schema
-- Run this file in Supabase Dashboard > SQL Editor > New Query.

create extension if not exists pgcrypto;

-- Remove obsolete tactile-device persistence from older installs.
-- Joy-Con detection and rumble stay local to the participant browser.
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

alter table public.sessions
add column if not exists therapist_heartbeat_at timestamptz;

create index if not exists idx_sessions_expires_at on public.sessions (expires_at);
create index if not exists idx_sessions_created_at on public.sessions (created_at);

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
security invoker
set search_path = public, extensions
as $$
  select floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;

drop function if exists public.create_bls_session(jsonb, jsonb, integer);

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
  expires_at timestamptz,
  therapist_heartbeat_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid := gen_random_uuid();
  v_therapist_token text := encode(gen_random_bytes(24), 'hex');
  v_client_token text := encode(gen_random_bytes(24), 'hex');
  v_expires_at timestamptz := now() + make_interval(mins => least(greatest(coalesce(_ttl_minutes, 1440), 10), 1440));
begin
  perform pg_advisory_xact_lock(hashtext('open_bistimulation_create_session'));

  if
    _state is null
    or jsonb_typeof(_state) <> 'object'
    or jsonb_typeof(_state -> 'version') <> 'number'
    or (_state ->> 'version')::numeric < 0
    or (_state ->> 'version')::numeric > 9007199254740991
    or mod((_state ->> 'version')::numeric, 1) <> 0
    or not coalesce(
      (_state ->> 'status') in ('idle', 'running', 'paused', 'stopping', 'stopped', 'ended'),
      false
    )
    or octet_length(_state::text) > 32768
  then
    raise exception 'Invalid or oversized initial session state.'
      using errcode = '22023';
  end if;

  if
    _preferences is null
    or jsonb_typeof(_preferences) <> 'object'
    or octet_length(_preferences::text) > 16384
  then
    raise exception 'Invalid or oversized session preferences.'
      using errcode = '22023';
  end if;

  -- Keep opportunistic cleanup bounded; production deployments must also
  -- schedule cleanup_expired_bls_sessions().
  delete from public.sessions s
  where s.id in (
    select expired.id
    from public.sessions expired
    where expired.expires_at is not null
      and expired.expires_at <= now()
    order by expired.expires_at
    limit 500
  );

  if (
    select count(*)
    from public.sessions recent
    where recent.created_at >= now() - interval '1 minute'
  ) >= 120 then
    raise exception 'Session creation is temporarily rate limited.'
      using errcode = '53300';
  end if;

  if (
    select count(*)
    from public.sessions active_session
    where active_session.expires_at is null
       or active_session.expires_at > now()
  ) >= 2000 then
    raise exception 'The active session capacity has been reached.'
      using errcode = '53300';
  end if;

  insert into public.sessions (
    id,
    therapist_token,
    client_token,
    state,
    preferences,
    expires_at,
    therapist_heartbeat_at
  )
  values (
    v_id,
    v_therapist_token,
    v_client_token,
    coalesce(_state, '{}'::jsonb),
    coalesce(_preferences, '{}'::jsonb),
    v_expires_at,
    now()
  );

  return query
  select
    s.id,
    s.therapist_token,
    s.client_token,
    s.state,
    s.preferences,
    s.expires_at,
    s.therapist_heartbeat_at
  from public.sessions s
  where s.id = v_id;
end;
$$;

drop function if exists public.get_bls_session(uuid, text);

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
  ended_at timestamptz,
  therapist_heartbeat_at timestamptz
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
    s.ended_at,
    s.therapist_heartbeat_at
  from public.sessions s
  where s.id = _session_id
    and (s.expires_at is null or s.expires_at > now())
    and (_token = s.therapist_token or _token = s.client_token);
end;
$$;

drop function if exists public.therapist_save_state(uuid, text, jsonb);

create or replace function public.therapist_save_state(
  _session_id uuid,
  _therapist_token text,
  _state jsonb,
  _expected_version bigint
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
    and (s.expires_at is null or s.expires_at > now())
    and jsonb_typeof(_state) = 'object'
    and octet_length(_state::text) <= 32768
    and jsonb_typeof(_state -> 'version') = 'number'
    and (_state ->> 'version')::numeric >= 0
    and (_state ->> 'version')::numeric <= 9007199254740991
    and mod((_state ->> 'version')::numeric, 1) = 0
    and coalesce(
      (_state ->> 'status') in ('idle', 'running', 'paused', 'stopping', 'stopped', 'ended'),
      false
    )
    and jsonb_typeof(s.state -> 'version') = 'number'
    and (s.state ->> 'version')::bigint = _expected_version
    and (_state ->> 'version')::bigint = _expected_version + 1;

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
    and (s.expires_at is null or s.expires_at > now())
    and jsonb_typeof(_preferences) = 'object'
    and octet_length(_preferences::text) <= 16384;

  return found;
end;
$$;

create or replace function public.therapist_stop_session(
  _session_id uuid,
  _therapist_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_current jsonb;
  v_next jsonb;
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_version bigint;
  v_status text;
  v_elapsed_before bigint;
  v_started_at bigint;
  v_elapsed bigint;
  v_sets bigint;
begin
  select s.state
  into v_current
  from public.sessions s
  where s.id = _session_id
    and s.therapist_token = _therapist_token
    and s.ended_at is null
    and (s.expires_at is null or s.expires_at > now())
  for update;

  if not found then
    return null;
  end if;

  v_version :=
    case
      when jsonb_typeof(v_current -> 'version') = 'number'
        then (v_current ->> 'version')::bigint
      else 0
    end;
  v_status := coalesce(v_current ->> 'status', 'idle');
  v_elapsed_before :=
    case
      when jsonb_typeof(v_current -> 'elapsedBeforePauseMs') = 'number'
        then greatest(0, (v_current ->> 'elapsedBeforePauseMs')::bigint)
      else 0
    end;
  v_started_at :=
    case
      when jsonb_typeof(v_current -> 'startedAtMs') = 'number'
        then greatest(0, (v_current ->> 'startedAtMs')::bigint)
      else null
    end;
  v_elapsed :=
    case
      when v_status = 'running' and v_started_at is not null
        then v_elapsed_before + greatest(0, v_now_ms - v_started_at)
      else v_elapsed_before
    end;
  v_sets :=
    case
      when jsonb_typeof(v_current -> 'setsCompleted') = 'number'
        then greatest(0, (v_current ->> 'setsCompleted')::bigint)
      else 0
    end;

  if v_status in ('running', 'paused') and v_elapsed > 0 then
    v_sets := v_sets + 1;
  end if;

  v_next :=
    v_current
    || jsonb_build_object(
      'version', v_version + 1,
      'status', 'stopped',
      'startedAtMs', null,
      'pausedAtMs', null,
      'elapsedBeforePauseMs', v_elapsed,
      'motionStartedAtMs', null,
      'motionElapsedBeforePauseMs', 0,
      'setsCompleted', v_sets
    );

  update public.sessions s
  set
    state = v_next,
    therapist_heartbeat_at = now()
  where s.id = _session_id;

  return v_next;
end;
$$;

create or replace function public.therapist_heartbeat(
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
  set therapist_heartbeat_at = now()
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
  set
    ended_at = now(),
    therapist_heartbeat_at = now(),
    state =
      coalesce(s.state, '{}'::jsonb)
      || jsonb_build_object(
        'version',
        case
          when jsonb_typeof(s.state -> 'version') = 'number'
            then (s.state ->> 'version')::bigint + 1
          else 1
        end,
        'status',
        'ended'
      )
      || '{"startedAtMs": null, "pausedAtMs": null, "motionStartedAtMs": null}'::jsonb
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

revoke all on public.sessions from public, anon, authenticated;

-- PostgreSQL grants function execution to PUBLIC by default. Reset every function
-- privilege before exposing only the app-facing RPCs to Supabase API roles.
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.get_server_time_ms() from public, anon, authenticated;
revoke execute on function public.create_bls_session(jsonb, jsonb, integer) from public, anon, authenticated;
revoke execute on function public.get_bls_session(uuid, text) from public, anon, authenticated;
revoke execute on function public.therapist_save_state(uuid, text, jsonb, bigint) from public, anon, authenticated;
revoke execute on function public.therapist_save_preferences(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.therapist_stop_session(uuid, text) from public, anon, authenticated;
revoke execute on function public.therapist_heartbeat(uuid, text) from public, anon, authenticated;
revoke execute on function public.end_bls_session(uuid, text) from public, anon, authenticated;
revoke execute on function public.cleanup_expired_bls_sessions() from public, anon, authenticated;

grant execute on function public.get_server_time_ms() to anon, authenticated;
grant execute on function public.create_bls_session(jsonb, jsonb, integer) to anon, authenticated;
grant execute on function public.get_bls_session(uuid, text) to anon, authenticated;
grant execute on function public.therapist_save_state(uuid, text, jsonb, bigint) to anon, authenticated;
grant execute on function public.therapist_save_preferences(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.therapist_stop_session(uuid, text) to anon, authenticated;
grant execute on function public.therapist_heartbeat(uuid, text) to anon, authenticated;
grant execute on function public.end_bls_session(uuid, text) to anon, authenticated;
