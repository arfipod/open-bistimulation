#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_LOCAL_URL = 'http://127.0.0.1:5173/';
const DEFAULT_VERCEL_URL = 'https://open-bistimulation.vercel.app/';
const THERAPIST_HEARTBEAT_STALE_MS = 15_000;
const HEARTBEAT_FUTURE_TOLERANCE_MS = 5_000;

const DEFAULT_STATE = {
  version: 1,
  status: 'idle',
  roundDurationMs: null,
  startedAtMs: null,
  pausedAtMs: null,
  elapsedBeforePauseMs: 0,
  motionStartedAtMs: null,
  motionElapsedBeforePauseMs: 0,
  setsCompleted: 0,
  visual: {
    enabled: true,
    color: '#0500a8',
    stimulus: 'dot',
    stimulusAlternatesSides: true,
    background: '#c9ced1',
    dotSize: 52,
    speed: 5,
    direction: 'horizontal',
    motionOrder: 'left-to-right',
    verticalPosition: 'center',
  },
  audio: {
    enabled: false,
    sound: 'snap',
    volume: 0.7,
    therapistMuted: true,
  },
  tactile: {
    enabled: false,
    pulseDurationMs: 120,
    gapMs: 40,
    intensity: 'medium',
  },
};

const DEFAULT_PREFERENCES = {
  visual: DEFAULT_STATE.visual,
  audio: DEFAULT_STATE.audio,
  tactile: DEFAULT_STATE.tactile,
};

const DEFAULT_JOYCON_STATUS = {
  webHidSupported: false,
  requestingDevices: false,
  devices: [],
  leftConnected: false,
  rightConnected: false,
  error: null,
  outputStatus: {
    lastPulseSide: null,
    lastPulseAt: null,
    pulseCount: 0,
    lastError: null,
    skippedPulseCount: 0,
  },
};

function parseArgs(argv) {
  const parsed = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith('--')) {
      parsed._.push(arg);
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split('=', 2);
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }

  return parsed;
}

function parseEnvValue(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function loadEnvFiles() {
  for (const path of ['.env.local', '.env']) {
    if (!existsSync(path)) {
      continue;
    }

    const raw = readFileSync(path, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || match[1].startsWith('#')) {
        continue;
      }

      process.env[match[1]] ??= parseEnvValue(match[2]);
    }
  }
}

function toInt(value, fallback) {
  const next = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(next) ? next : fallback;
}

function toFloat(value, fallback) {
  const next = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(next) ? next : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function percentile(values, p) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[index]);
}

function summarizeTimings(results) {
  const ok = results.filter((result) => result.ok);
  const failed = results.filter((result) => !result.ok);
  const timings = ok.map((result) => result.ms);

  return {
    total: results.length,
    ok: ok.length,
    failed: failed.length,
    minMs: percentile(timings, 0),
    p50Ms: percentile(timings, 50),
    p95Ms: percentile(timings, 95),
    p99Ms: percentile(timings, 99),
    maxMs: percentile(timings, 100),
    errors: summarizeErrors(failed),
  };
}

function summarizeHeartbeatObservations(observations) {
  const ages = observations.map((observation) => observation.ageMs).filter(Number.isFinite);
  const fresh = observations.filter((observation) => observation.fresh).length;

  return {
    total: observations.length,
    fresh,
    stale: observations.length - fresh,
    minAgeMs: percentile(ages, 0),
    p50AgeMs: percentile(ages, 50),
    p95AgeMs: percentile(ages, 95),
    maxAgeMs: percentile(ages, 100),
  };
}

function summarizeErrors(results) {
  const counts = new Map();

  for (const result of results) {
    const key = result.error || `HTTP_${result.status || 'UNKNOWN'}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Object.fromEntries(counts);
}

async function runPool(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function timed(fn) {
  const start = performance.now();

  try {
    const value = await fn();
    return { ok: true, ms: Math.round(performance.now() - start), value };
  } catch (error) {
    return {
      ok: false,
      ms: Math.round(performance.now() - start),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchWithTimeout(url, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'cache-control': 'no-cache',
        'user-agent': 'open-bistimulation-stress-test/1.0',
      },
    });
    const body = await response.arrayBuffer();

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    return { status: response.status, bytes: body.byteLength };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'open-bistimulation-stress-test/1.0' },
    });

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function absolutizeUrl(baseUrl, value) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

async function discoverAssets(baseUrl) {
  const html = await fetchText(baseUrl);
  const urls = new Set();
  const assetRegex =
    /(?:src|href)=["']([^"']+\.(?:js|mjs|ts|tsx|css|ico|png|jpg|jpeg|svg|webp|woff2?)(?:\?[^"']*)?)["']/gi;

  for (const match of html.matchAll(assetRegex)) {
    const url = absolutizeUrl(baseUrl, match[1]);
    if (url) {
      urls.add(url);
    }
  }

  return [...urls];
}

async function runHttpLoad({ baseUrl, requests, concurrency, includeAssets, timeoutMs }) {
  const assets = includeAssets ? await discoverAssets(baseUrl).catch(() => []) : [];
  const jobs = Array.from({ length: requests }, (_, index) => index);
  const results = await runPool(jobs, concurrency, async () => {
    const start = performance.now();

    try {
      const page = await fetchWithTimeout(baseUrl, timeoutMs);
      let assetBytes = 0;

      if (assets.length > 0) {
        const assetResults = await Promise.all(assets.map((asset) => fetchWithTimeout(asset, timeoutMs)));
        assetBytes = assetResults.reduce((sum, asset) => sum + asset.bytes, 0);
      }

      return {
        ok: true,
        ms: Math.round(performance.now() - start),
        bytes: page.bytes + assetBytes,
      };
    } catch (error) {
      return {
        ok: false,
        ms: Math.round(performance.now() - start),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  return {
    kind: 'http',
    baseUrl,
    requests,
    concurrency,
    includeAssets,
    discoveredAssets: assets.length,
    bytesPerSuccessfulRequest: results.find((result) => result.ok)?.bytes ?? null,
    summary: summarizeTimings(results),
  };
}

function parseSupabaseConfigFromText(text) {
  const url = text.match(/https:\/\/[a-z0-9][a-z0-9-]+\.supabase\.co/i)?.[0] ?? null;
  const jwt = text.match(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/)?.[0] ?? null;
  const publishable = text.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0] ?? null;
  const key = jwt || publishable;

  return url && key ? { url, key } : null;
}

async function discoverSupabaseConfigFromApp(baseUrl) {
  const html = await fetchText(baseUrl);
  const candidates = new Set();
  const refRegex = /(?:src|href)=["']([^"']+)["']/gi;

  for (const match of html.matchAll(refRegex)) {
    const url = absolutizeUrl(baseUrl, match[1]);
    if (url && /\.(?:js|mjs|ts|tsx)(?:\?|$)/.test(new URL(url).pathname)) {
      candidates.add(url);
    }
  }

  for (const devPath of ['/src/lib/supabase.ts', '/src/main.tsx']) {
    candidates.add(new URL(devPath, baseUrl).toString());
  }

  const directConfig = parseSupabaseConfigFromText(html);
  if (directConfig) {
    return { ...directConfig, source: 'html' };
  }

  for (const candidate of candidates) {
    try {
      const text = await fetchText(candidate);
      const config = parseSupabaseConfigFromText(text);
      if (config) {
        return { ...config, source: candidate };
      }
    } catch {
      // Ignore non-existing Vite dev module candidates and continue.
    }
  }

  return null;
}

async function resolveSupabaseConfig(baseUrl) {
  const isLocal = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(baseUrl);
  const remoteConfig = !isLocal ? await discoverSupabaseConfigFromApp(baseUrl).catch(() => null) : null;

  if (remoteConfig) {
    return remoteConfig;
  }

  const envUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!envUrl || !envKey) {
    throw new Error('Missing Supabase config. Set SUPABASE_URL and SUPABASE_ANON_KEY or point --base-url to a deployed Vite build.');
  }

  return { url: envUrl, key: envKey, source: '.env/local environment' };
}

function configFingerprint(config) {
  return {
    urlHost: new URL(config.url).host,
    keySha256: createHash('sha256').update(config.key).digest('hex').slice(0, 12),
    source: config.source,
  };
}

function makeSupabaseClient(config, label) {
  return createClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'x-client-info': `open-bistimulation-stress/${label}`,
      },
    },
    realtime: {
      params: {
        eventsPerSecond: 20,
      },
    },
  });
}

async function createBlsSession(client) {
  const { data, error } = await client
    .rpc('create_bls_session', {
      _state: DEFAULT_STATE,
      _preferences: DEFAULT_PREFERENCES,
      _ttl_minutes: 60,
    })
    .single();

  if (error) {
    throw error;
  }

  if (
    !data ||
    typeof data.id !== 'string' ||
    typeof data.therapist_token !== 'string' ||
    typeof data.client_token !== 'string' ||
    !Number.isSafeInteger(data.state?.version) ||
    typeof data.therapist_heartbeat_at !== 'string' ||
    !Number.isFinite(Date.parse(data.therapist_heartbeat_at))
  ) {
    throw new Error('create_bls_session returned an invalid session record.');
  }

  return {
    id: data.id,
    therapistToken: data.therapist_token,
    clientToken: data.client_token,
    state: data.state,
    stateVersion: data.state.version,
    therapistHeartbeatAt: data.therapist_heartbeat_at,
  };
}

async function getBlsSession(client, sessionId, token) {
  const { data, error } = await client
    .rpc('get_bls_session', {
      _session_id: sessionId,
      _token: token,
    })
    .single();

  if (error) {
    throw error;
  }

  if (
    !data ||
    data.id !== sessionId ||
    (data.role !== 'therapist' && data.role !== 'client') ||
    typeof data.therapist_heartbeat_at !== 'string' ||
    !Number.isFinite(Date.parse(data.therapist_heartbeat_at))
  ) {
    throw new Error('get_bls_session returned an invalid session record.');
  }

  return data;
}

async function saveTherapistState(client, sessionId, therapistToken, state) {
  const { data, error } = await client.rpc('therapist_save_state', {
    _session_id: sessionId,
    _therapist_token: therapistToken,
    _state: state,
    _expected_version: state.version - 1,
  });

  if (error) {
    throw error;
  }

  if (data !== true) {
    throw new Error('therapist_save_state was rejected by the server.');
  }
}

function validateStoppedSessionState(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    value.status !== 'stopped' ||
    !Number.isSafeInteger(value.version) ||
    value.version < 1 ||
    value.startedAtMs !== null ||
    value.pausedAtMs !== null ||
    value.motionStartedAtMs !== null ||
    value.motionElapsedBeforePauseMs !== 0 ||
    typeof value.elapsedBeforePauseMs !== 'number' ||
    !Number.isFinite(value.elapsedBeforePauseMs) ||
    value.elapsedBeforePauseMs < 0 ||
    !Number.isSafeInteger(value.setsCompleted) ||
    value.setsCompleted < 0 ||
    typeof value.visual !== 'object' ||
    value.visual === null ||
    typeof value.audio !== 'object' ||
    value.audio === null ||
    typeof value.tactile !== 'object' ||
    value.tactile === null
  ) {
    throw new Error('therapist_stop_session returned an invalid stopped state.');
  }

  return value;
}

async function stopTherapistSession(client, sessionId, therapistToken) {
  const { data, error } = await client.rpc('therapist_stop_session', {
    _session_id: sessionId,
    _therapist_token: therapistToken,
  });

  if (error) {
    throw error;
  }

  return validateStoppedSessionState(data);
}

async function endBlsSession(client, sessionId, therapistToken) {
  const { data, error } = await client.rpc('end_bls_session', {
    _session_id: sessionId,
    _therapist_token: therapistToken,
  });

  if (error) {
    throw error;
  }

  if (data !== true) {
    throw new Error('end_bls_session was rejected by the server.');
  }
}

async function heartbeatTherapistSession(client, sessionId, therapistToken) {
  const { data, error } = await client.rpc('therapist_heartbeat', {
    _session_id: sessionId,
    _therapist_token: therapistToken,
  });

  if (error) {
    throw error;
  }

  if (data !== true) {
    throw new Error('therapist_heartbeat was rejected by the server.');
  }
}

async function getServerTimeMs(client) {
  const { data, error } = await client.rpc('get_server_time_ms');
  if (error) {
    throw error;
  }

  const serverTimeMs = Number(data);
  if (!Number.isFinite(serverTimeMs) || serverTimeMs < 0) {
    throw new Error('get_server_time_ms returned an invalid timestamp.');
  }

  return serverTimeMs;
}

function runningState(sequence, serverTimeMs) {
  return {
    ...DEFAULT_STATE,
    version: sequence,
    status: 'running',
    startedAtMs: serverTimeMs + 300,
    motionStartedAtMs: serverTimeMs + 300,
    tactile: {
      ...DEFAULT_STATE.tactile,
      enabled: true,
    },
  };
}

function restartState(stoppedState, serverStartMs) {
  return {
    ...stoppedState,
    version: stoppedState.version + 1,
    status: 'running',
    startedAtMs: serverStartMs,
    pausedAtMs: null,
    elapsedBeforePauseMs: 0,
    motionStartedAtMs: serverStartMs,
    motionElapsedBeforePauseMs: 0,
  };
}

function createChannelTopic(sessionId, channelKey) {
  return `session:${encodeURIComponent(sessionId)}:${encodeURIComponent(channelKey)}`;
}

function subscribeParticipant({ config, sessionId, channelKey, sessionToken, role, label }) {
  const client = makeSupabaseClient(config, label);
  const messageCounts = {};
  const authoritativeReadResults = [];
  const heartbeatObservations = [];
  const presenceTrackResults = [];
  let received = 0;
  let finalStatus = 'PENDING';
  let joinMs = null;
  let serverClockOffsetMs = 0;
  let authoritativeReadPromise = null;
  let presenceTrackPromise = null;

  const channel = client.channel(createChannelTopic(sessionId, channelKey), {
    config: {
      broadcast: { ack: true, self: false },
      presence: { key: `${role}:${randomUUID()}` },
    },
  });

  channel.on('broadcast', { event: 'bls' }, ({ payload }) => {
    received += 1;
    const kind = payload?.kind || 'UNKNOWN';
    messageCounts[kind] = (messageCounts[kind] || 0) + 1;

    if (role === 'client' && (kind === 'STATE_UPDATED' || kind === 'SESSION_ENDED')) {
      void readAuthoritativeState();
    }
  });

  function readAuthoritativeState() {
    if (authoritativeReadPromise) {
      return authoritativeReadPromise;
    }

    authoritativeReadPromise = timed(async () => {
      const session = await getBlsSession(client, sessionId, sessionToken);
      if (session.role !== role) {
        throw new Error(`get_bls_session returned role ${session.role}; expected ${role}.`);
      }

      if (role === 'client') {
        const heartbeatAtMs = Date.parse(session.therapist_heartbeat_at);
        const ageMs = Date.now() + serverClockOffsetMs - heartbeatAtMs;
        const fresh =
          Number.isFinite(ageMs) &&
          ageMs >= -HEARTBEAT_FUTURE_TOLERANCE_MS &&
          ageMs <= THERAPIST_HEARTBEAT_STALE_MS;
        heartbeatObservations.push({ fresh, ageMs });

        if (!fresh) {
          throw new Error(`THERAPIST_HEARTBEAT_STALE_${Math.round(ageMs)}MS`);
        }
      }

      return session;
    })
      .then((result) => {
        authoritativeReadResults.push(result);
        return result;
      })
      .finally(() => {
        authoritativeReadPromise = null;
      });

    return authoritativeReadPromise;
  }

  const startedAt = performance.now();
  const ready = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      finalStatus = 'SUBSCRIBE_TIMEOUT';
      joinMs = Math.round(performance.now() - startedAt);
      resolve(false);
    }, 15_000);

    channel.subscribe((status) => {
      finalStatus = status;

      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        joinMs = Math.round(performance.now() - startedAt);
        presenceTrackPromise = timed(async () => {
          const result = await channel.track({ role, online_at: new Date().toISOString() });
          if (result !== 'ok') {
            throw new Error(`PRESENCE_TRACK_${result}`);
          }
        }).then((result) => {
          presenceTrackResults.push(result);
          return result;
        });
        resolve(true);
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        clearTimeout(timeout);
        joinMs ??= Math.round(performance.now() - startedAt);
        resolve(false);
      }
    });
  });

  return {
    role,
    label,
    sessionId,
    client,
    channel,
    ready,
    readAuthoritativeState,
    setServerClockOffsetMs: (nextOffsetMs) => {
      serverClockOffsetMs = nextOffsetMs;
    },
    flushProtocolWork: async () => {
      await Promise.allSettled([authoritativeReadPromise, presenceTrackPromise].filter(Boolean));
    },
    getJoinMs: () => joinMs ?? Math.round(performance.now() - startedAt),
    getReceived: () => received,
    getMessageCounts: () => ({ ...messageCounts }),
    getAuthoritativeReadResults: () => [...authoritativeReadResults],
    getHeartbeatObservations: () => [...heartbeatObservations],
    getPresenceTrackResults: () => [...presenceTrackResults],
    getStatus: () => finalStatus,
  };
}

async function sendBroadcast(participant, payload) {
  const result = await timed(async () => {
    const response = await participant.channel.send({
      type: 'broadcast',
      event: 'bls',
      payload,
    });

    if (response !== 'ok') {
      throw new Error(`BROADCAST_${response}`);
    }
  });

  return result;
}

async function teardownParticipants(participants) {
  await Promise.allSettled(
    participants.map(async (participant) => {
      if (participant.role) {
        await participant.channel.untrack();
      }
      await participant.client.removeChannel(participant.channel);
      participant.client.realtime.disconnect();
    }),
  );
}

async function runRealtimeScenario({
  baseUrl,
  sessionsCount,
  clientsPerSession,
  durationMs,
  stateUpdateHz,
  setupConcurrency,
  joinRate,
}) {
  const config = await resolveSupabaseConfig(baseUrl);
  const setupClient = makeSupabaseClient(config, 'setup');
  const sessionIndexes = Array.from({ length: sessionsCount }, (_, index) => index);
  const createResults = await runPool(sessionIndexes, setupConcurrency, () => timed(() => createBlsSession(setupClient)));
  const sessions = createResults.filter((result) => result.ok).map((result) => result.value);

  const rpcJobs = [];
  for (const session of sessions) {
    rpcJobs.push(async () => {
      const record = await getBlsSession(setupClient, session.id, session.therapistToken);
      if (record.role !== 'therapist') {
        throw new Error(`get_bls_session returned role ${record.role}; expected therapist.`);
      }
      return record;
    });

    for (let index = 0; index < clientsPerSession; index += 1) {
      rpcJobs.push(async () => {
        const record = await getBlsSession(setupClient, session.id, session.clientToken);
        if (record.role !== 'client') {
          throw new Error(`get_bls_session returned role ${record.role}; expected client.`);
        }
        return record;
      });
    }
  }

  const rpcResults = await runPool(rpcJobs, setupConcurrency, (job) => timed(job));
  const participants = [];
  const groups = [];
  const joinDelayMs = joinRate > 0 ? Math.ceil(1000 / joinRate) : 0;

  for (const [sessionIndex, session] of sessions.entries()) {
    const group = {
      session,
      therapist: null,
      clients: [],
      currentState: session.state,
      currentVersion: session.stateVersion,
    };

    const therapist = subscribeParticipant({
      config,
      sessionId: session.id,
      channelKey: session.clientToken,
      sessionToken: session.therapistToken,
      role: 'therapist',
      label: `therapist-${sessionIndex}`,
    });
    participants.push(therapist);
    group.therapist = therapist;
    if (joinDelayMs) {
      await sleep(joinDelayMs);
    }

    for (let index = 0; index < clientsPerSession; index += 1) {
      const client = subscribeParticipant({
        config,
        sessionId: session.id,
        channelKey: session.clientToken,
        sessionToken: session.clientToken,
        role: 'client',
        label: `client-${sessionIndex}-${index}`,
      });
      participants.push(client);
      group.clients.push(client);
      if (joinDelayMs) {
        await sleep(joinDelayMs);
      }
    }

    groups.push(group);
  }

  const joined = await Promise.all(participants.map((participant) => participant.ready));
  const subscribedParticipants = participants.filter((_, index) => joined[index]);
  const joinResults = participants.map((participant, index) => ({
    ok: joined[index],
    ms: participant.getJoinMs(),
    error: joined[index] ? null : participant.getStatus(),
  }));

  let expectedReceived = 0;
  const sendResults = [];
  const stateSaveResults = [];
  const stopResults = [];
  const stopVerificationResults = [];
  const resumeAfterStopResults = [];
  const resumeVerificationResults = [];
  const therapistHeartbeatResults = [];
  const endResults = [];
  const endVerificationResults = [];

  function expectedFor(group) {
    const connectedInGroup = [group.therapist, ...group.clients].filter((participant) => subscribedParticipants.includes(participant));
    return Math.max(0, connectedInGroup.length - 1);
  }

  async function sendAndCount(sender, group, payload) {
    if (!subscribedParticipants.includes(sender)) {
      return;
    }

    const result = await sendBroadcast(sender, payload);
    sendResults.push(result);

    if (result.ok) {
      expectedReceived += expectedFor(group);
    }
  }

  async function persistStateAndBroadcast(group, nextState) {
    const saveResult = await timed(() =>
      saveTherapistState(
        group.therapist.client,
        group.session.id,
        group.session.therapistToken,
        nextState,
      ),
    );
    stateSaveResults.push(saveResult);

    if (!saveResult.ok) {
      return saveResult;
    }

    group.currentVersion = nextState.version;
    group.currentState = nextState;
    await sendAndCount(group.therapist, group, {
      kind: 'STATE_UPDATED',
      state: nextState,
      emittedAtMs: getEstimatedServerTimeMs(),
    });

    return saveResult;
  }

  async function persistAndBroadcastState(group, serverStartedAtMs) {
    return persistStateAndBroadcast(
      group,
      runningState(group.currentVersion + 1, serverStartedAtMs),
    );
  }

  async function sendTherapistHeartbeat(group) {
    const result = await timed(() =>
      heartbeatTherapistSession(
        group.therapist.client,
        group.session.id,
        group.session.therapistToken,
      ),
    );
    therapistHeartbeatResults.push(result);
  }

  const serverTimeResult = await timed(() => getServerTimeMs(setupClient));
  const serverTimeMs = serverTimeResult.ok ? serverTimeResult.value : Date.now();
  const serverClockOffsetMs = serverTimeMs - Date.now();
  const getEstimatedServerTimeMs = () => Date.now() + serverClockOffsetMs;
  participants.forEach((participant) => participant.setServerClockOffsetMs(serverClockOffsetMs));
  const authoritativePollingParticipants = participants.filter(
    (participant) =>
      participant.role === 'therapist' || subscribedParticipants.includes(participant),
  );

  await Promise.all(
    authoritativePollingParticipants.map((participant) => participant.readAuthoritativeState()),
  );

  for (const group of groups) {
    await persistAndBroadcastState(group, serverTimeMs);
  }

  const startedAt = performance.now();
  let nextStateUpdateAt = 0;
  let nextTherapistHeartbeatAt = 0;
  let nextParticipantTelemetryAt = 0;
  let nextAuthoritativePollAt = 5_000;
  const stateUpdateIntervalMs = stateUpdateHz > 0 ? 1000 / stateUpdateHz : null;

  while (performance.now() - startedAt < durationMs) {
    const elapsed = performance.now() - startedAt;

    if (stateUpdateIntervalMs !== null && elapsed >= nextStateUpdateAt) {
      for (const group of groups) {
        await persistAndBroadcastState(group, serverTimeMs);
      }

      nextStateUpdateAt += stateUpdateIntervalMs;
    }

    if (elapsed >= nextTherapistHeartbeatAt) {
      for (const group of groups) {
        await sendTherapistHeartbeat(group);
      }

      nextTherapistHeartbeatAt += 5_000;
    }

    if (elapsed >= nextAuthoritativePollAt) {
      for (const participant of authoritativePollingParticipants) {
        void participant.readAuthoritativeState();
      }

      nextAuthoritativePollAt += 5_000;
    }

    if (elapsed >= nextParticipantTelemetryAt) {
      for (const group of groups) {
        for (const client of group.clients) {
          if (!subscribedParticipants.includes(client)) {
            continue;
          }

          void client.readAuthoritativeState();
          await sendAndCount(client, group, {
            kind: 'CLIENT_READY',
            emittedAtMs: getEstimatedServerTimeMs(),
          });
          await sendAndCount(client, group, {
            kind: 'JOYCON_STATUS',
            status: DEFAULT_JOYCON_STATUS,
            emittedAtMs: getEstimatedServerTimeMs(),
          });
        }

      }

      nextParticipantTelemetryAt += 5_000;
    }

    await sleep(10);
  }

  for (const group of groups) {
    const expectedStoppedVersion = group.currentVersion + 1;
    const stopResult = await timed(async () => {
      const stoppedState = await stopTherapistSession(
        group.therapist.client,
        group.session.id,
        group.session.therapistToken,
      );

      if (stoppedState.version !== expectedStoppedVersion) {
        throw new Error(
          `therapist_stop_session returned version ${stoppedState.version}; expected ${expectedStoppedVersion}.`,
        );
      }

      return stoppedState;
    });
    stopResults.push(stopResult);

    if (!stopResult.ok) {
      continue;
    }

    group.currentState = stopResult.value;
    group.currentVersion = stopResult.value.version;
    await sendAndCount(group.therapist, group, {
      kind: 'STATE_UPDATED',
      state: stopResult.value,
      emittedAtMs: getEstimatedServerTimeMs(),
    });

    stopVerificationResults.push(
      await timed(async () => {
        const stoppedSession = await getBlsSession(
          setupClient,
          group.session.id,
          group.session.clientToken,
        );
        const stoppedState = validateStoppedSessionState(stoppedSession.state);

        if (stoppedSession.role !== 'client' || stoppedState.version !== expectedStoppedVersion) {
          throw new Error('therapist_stop_session was not authoritative for the participant.');
        }

        return stoppedSession;
      }),
    );
  }

  await Promise.all(
    subscribedParticipants
      .filter((participant) => participant.role === 'client')
      .map((participant) => participant.readAuthoritativeState()),
  );

  for (const group of groups) {
    if (group.currentState?.status !== 'stopped') {
      continue;
    }

    const resumedState = restartState(
      group.currentState,
      getEstimatedServerTimeMs() + 300,
    );
    const resumeResult = await persistStateAndBroadcast(group, resumedState);
    resumeAfterStopResults.push(resumeResult);

    if (!resumeResult.ok) {
      continue;
    }

    resumeVerificationResults.push(
      await timed(async () => {
        const resumedSession = await getBlsSession(
          setupClient,
          group.session.id,
          group.session.clientToken,
        );

        if (
          resumedSession.role !== 'client' ||
          resumedSession.ended_at !== null ||
          resumedSession.state?.status !== 'running' ||
          resumedSession.state?.version !== resumedState.version ||
          resumedSession.state?.startedAtMs !== resumedState.startedAtMs ||
          resumedSession.state?.motionStartedAtMs !== resumedState.motionStartedAtMs
        ) {
          throw new Error('The versioned restart after atomic stop was not authoritative.');
        }

        return resumedSession;
      }),
    );
  }

  await Promise.all(
    subscribedParticipants
      .filter((participant) => participant.role === 'client')
      .map((participant) => participant.readAuthoritativeState()),
  );

  for (const group of groups) {
    const expectedEndedVersion = group.currentVersion + 1;
    const endResult = await timed(() =>
      endBlsSession(
        group.therapist.client,
        group.session.id,
        group.session.therapistToken,
      ),
    );
    endResults.push(endResult);

    if (!endResult.ok) {
      continue;
    }

    group.currentVersion = expectedEndedVersion;
    await sendAndCount(group.therapist, group, {
      kind: 'SESSION_ENDED',
      emittedAtMs: getEstimatedServerTimeMs(),
    });

    endVerificationResults.push(
      await timed(async () => {
        const endedSession = await getBlsSession(
          setupClient,
          group.session.id,
          group.session.clientToken,
        );

        if (
          endedSession.role !== 'client' ||
          typeof endedSession.ended_at !== 'string' ||
          !Number.isFinite(Date.parse(endedSession.ended_at)) ||
          endedSession.state?.status !== 'ended' ||
          endedSession.state?.version !== expectedEndedVersion
        ) {
          throw new Error('end_bls_session did not atomically persist the expected ended state.');
        }

        return endedSession;
      }),
    );
  }

  await Promise.all(
    subscribedParticipants
      .filter((participant) => participant.role === 'client')
      .map((participant) => participant.readAuthoritativeState()),
  );
  await sleep(2_000);
  await Promise.all(participants.map((participant) => participant.flushProtocolWork()));

  const received = subscribedParticipants.reduce((sum, participant) => sum + participant.getReceived(), 0);
  const authoritativeReadResults = participants.flatMap((participant) =>
    participant.getAuthoritativeReadResults(),
  );
  const heartbeatObservations = participants.flatMap((participant) =>
    participant.getHeartbeatObservations(),
  );
  const presenceTrackResults = subscribedParticipants.flatMap((participant) =>
    participant.getPresenceTrackResults(),
  );
  const countsByKind = {};
  for (const participant of subscribedParticipants) {
    for (const [kind, count] of Object.entries(participant.getMessageCounts())) {
      countsByKind[kind] = (countsByKind[kind] || 0) + count;
    }
  }

  await teardownParticipants(participants);
  setupClient.realtime.disconnect();

  return {
    kind: 'realtime',
    baseUrl,
    supabase: configFingerprint(config),
    sessionsRequested: sessionsCount,
    sessionsCreated: sessions.length,
    clientsPerSession,
    participantsExpected: sessions.length * (1 + clientsPerSession),
    participantsSubscribed: subscribedParticipants.length,
    durationMs,
    stateUpdateHz,
    createSummary: summarizeTimings(createResults),
    rpcSummary: summarizeTimings(rpcResults),
    authoritativeReadSummary: summarizeTimings(authoritativeReadResults),
    heartbeatFreshnessSummary: summarizeHeartbeatObservations(heartbeatObservations),
    therapistHeartbeatSummary: summarizeTimings(therapistHeartbeatResults),
    stateSaveSummary: summarizeTimings(stateSaveResults),
    stopSummary: summarizeTimings(stopResults),
    stopVerificationSummary: summarizeTimings(stopVerificationResults),
    resumeAfterStopSummary: summarizeTimings(resumeAfterStopResults),
    resumeVerificationSummary: summarizeTimings(resumeVerificationResults),
    joinSummary: summarizeTimings(joinResults),
    presenceTrackSummary: summarizeTimings(presenceTrackResults),
    serverTimeSummary: summarizeTimings([serverTimeResult]),
    sendSummary: summarizeTimings(sendResults),
    endSummary: summarizeTimings(endResults),
    endVerificationSummary: summarizeTimings(endVerificationResults),
    expectedReceived,
    received,
    deliveryRate: expectedReceived > 0 ? Number((received / expectedReceived).toFixed(4)) : null,
    receivedByKind: countsByKind,
  };
}

async function main() {
  loadEnvFiles();

  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || 'help';

  if (command === 'http') {
    const result = await runHttpLoad({
      baseUrl: args.baseUrl || args.base || DEFAULT_LOCAL_URL,
      requests: toInt(args.requests, 100),
      concurrency: toInt(args.concurrency, 10),
      includeAssets: args.includeAssets !== 'false',
      timeoutMs: toInt(args.timeoutMs, 15_000),
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'realtime') {
    const result = await runRealtimeScenario({
      baseUrl: args.baseUrl || args.base || DEFAULT_LOCAL_URL,
      sessionsCount: toInt(args.sessions, 10),
      clientsPerSession: toInt(args.clientsPerSession || args.clients, 1),
      durationMs: toInt(args.durationMs, 10_000),
      stateUpdateHz: toFloat(args.stateHz ?? args.stateUpdateHz, 0),
      setupConcurrency: toInt(args.setupConcurrency, 10),
      joinRate: toInt(args.joinRate, 60),
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'matrix') {
    const baseUrl = args.baseUrl || args.base || DEFAULT_LOCAL_URL;
    const sessions = String(args.sessions || '10,25,40')
      .split(',')
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter(Number.isFinite);
    const results = [];

    for (const sessionsCount of sessions) {
      results.push(
        await runRealtimeScenario({
          baseUrl,
          sessionsCount,
          clientsPerSession: toInt(args.clientsPerSession || args.clients, 1),
          durationMs: toInt(args.durationMs, 10_000),
          stateUpdateHz: toFloat(args.stateHz ?? args.stateUpdateHz, 0),
          setupConcurrency: toInt(args.setupConcurrency, 10),
          joinRate: toInt(args.joinRate, 60),
        }),
      );
    }

    console.log(JSON.stringify({ kind: 'matrix', baseUrl, results }, null, 2));
    return;
  }

  console.log(`Usage:
  node scripts/stress-test.mjs http --base-url ${DEFAULT_LOCAL_URL} --requests 200 --concurrency 20
  node scripts/stress-test.mjs realtime --base-url ${DEFAULT_VERCEL_URL} --sessions 25 --clients 1 --duration-ms 15000 --state-hz 0.58
  node scripts/stress-test.mjs matrix --base-url ${DEFAULT_LOCAL_URL} --sessions 10,25,40 --clients 1

Notes:
  - Realtime uses separate Supabase clients per participant to approximate separate browser WebSocket connections.
  - It uses token-scoped channels, advisory role Presence, acknowledged best-effort broadcasts, CAS state saves, and authoritative polling.
  - It exercises the therapist-token heartbeat freshness gate and verifies atomic stop, versioned restart, and atomic end state.
  - Realtime scenarios create and end real disposable session rows; deploy the current schema before running them.
  - For local runs, Supabase config is read from .env.local/.env.
  - For deployed Vite runs, the script first tries to read the public Supabase config from the built assets.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
