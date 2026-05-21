#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_LOCAL_URL = 'http://127.0.0.1:5173/';
const DEFAULT_VERCEL_URL = 'https://open-binstimulation.vercel.app/';

const DEFAULT_STATE = {
  version: 1,
  status: 'idle',
  startedAtMs: null,
  pausedAtMs: null,
  elapsedBeforePauseMs: 0,
  motionStartedAtMs: null,
  motionElapsedBeforePauseMs: 0,
  setsCompleted: 0,
  visual: {
    enabled: true,
    color: '#0500a8',
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
  },
};

const DEFAULT_PREFERENCES = {
  visual: DEFAULT_STATE.visual,
  audio: DEFAULT_STATE.audio,
  tactile: DEFAULT_STATE.tactile,
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
        'user-agent': 'open-binstimulation-stress-test/1.0',
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
      headers: { 'user-agent': 'open-binstimulation-stress-test/1.0' },
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
        'x-client-info': `open-binstimulation-stress/${label}`,
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

  return {
    id: data.id,
    therapistToken: data.therapist_token,
    clientToken: data.client_token,
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

  return data;
}

async function saveTherapistState(client, sessionId, therapistToken, state) {
  const { error } = await client.rpc('therapist_save_state', {
    _session_id: sessionId,
    _therapist_token: therapistToken,
    _state: state,
  });

  if (error) {
    throw error;
  }
}

async function upsertTactileDevice(client, sessionId, clientToken, side, deviceId, label, connected) {
  const { error } = await client.rpc('upsert_tactile_device', {
    _session_id: sessionId,
    _client_token: clientToken,
    _side: side,
    _device_id: deviceId,
    _label: label,
    _connected: connected,
  });

  if (error) {
    throw error;
  }
}

async function endBlsSession(client, sessionId, therapistToken) {
  const { error } = await client.rpc('end_bls_session', {
    _session_id: sessionId,
    _therapist_token: therapistToken,
  });

  if (error) {
    throw error;
  }
}

async function getServerTimeMs(client) {
  const { data, error } = await client.rpc('get_server_time_ms');
  if (error) {
    throw error;
  }

  return Number(data);
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

function subscribeParticipant({ config, sessionId, role, label }) {
  const client = makeSupabaseClient(config, label);
  const messageCounts = {};
  let received = 0;
  let finalStatus = 'PENDING';

  const channel = client.channel(`session:${sessionId}`, {
    config: {
      broadcast: { self: false },
    },
  });

  channel.on('broadcast', { event: 'bls' }, ({ payload }) => {
    received += 1;
    const kind = payload?.kind || 'UNKNOWN';
    messageCounts[kind] = (messageCounts[kind] || 0) + 1;
  });

  const startedAt = performance.now();
  const ready = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      finalStatus = 'SUBSCRIBE_TIMEOUT';
      resolve(false);
    }, 15_000);

    channel.subscribe((status) => {
      finalStatus = status;

      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        resolve(true);
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        clearTimeout(timeout);
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
    getJoinMs: () => Math.round(performance.now() - startedAt),
    getReceived: () => received,
    getMessageCounts: () => ({ ...messageCounts }),
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

function sideFor(index) {
  return index % 2 === 0 ? 'left' : 'right';
}

async function teardownParticipants(participants) {
  await Promise.allSettled(
    participants.map(async (participant) => {
      await participant.client.removeChannel(participant.channel);
      participant.client.realtime.disconnect();
    }),
  );
}

async function cleanupSessions(client, sessions, tactileDevices) {
  await Promise.allSettled(
    sessions.map(async (session) => {
      for (let index = 0; index < tactileDevices; index += 1) {
        const side = sideFor(index);
        await upsertTactileDevice(
          client,
          session.id,
          session.clientToken,
          side,
          `stress-${side}-${index}`,
          `Stress ${side}`,
          false,
        ).catch(() => undefined);
      }

      await endBlsSession(client, session.id, session.therapistToken);
    }),
  );
}

async function runRealtimeScenario({
  baseUrl,
  sessionsCount,
  clientsPerSession,
  tactileDevices,
  durationMs,
  pulseHz,
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
    rpcJobs.push(() => getBlsSession(setupClient, session.id, session.therapistToken));

    for (let index = 0; index < clientsPerSession; index += 1) {
      rpcJobs.push(() => getBlsSession(setupClient, session.id, session.clientToken));
    }

    for (let index = 0; index < tactileDevices; index += 1) {
      const side = sideFor(index);
      rpcJobs.push(async () => {
        await getBlsSession(setupClient, session.id, session.clientToken);
        await upsertTactileDevice(
          setupClient,
          session.id,
          session.clientToken,
          side,
          `stress-${side}-${index}`,
          `Stress ${side}`,
          true,
        );
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
      tactile: [],
    };

    const therapist = subscribeParticipant({
      config,
      sessionId: session.id,
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
        role: 'client',
        label: `client-${sessionIndex}-${index}`,
      });
      participants.push(client);
      group.clients.push(client);
      if (joinDelayMs) {
        await sleep(joinDelayMs);
      }
    }

    for (let index = 0; index < tactileDevices; index += 1) {
      const tactile = subscribeParticipant({
        config,
        sessionId: session.id,
        role: 'tactile',
        label: `tactile-${sessionIndex}-${index}`,
      });
      participants.push(tactile);
      group.tactile.push({ participant: tactile, side: sideFor(index), deviceId: `stress-${sideFor(index)}-${index}` });
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
  let sequence = 0;

  function expectedFor(group) {
    const connectedInGroup = [group.therapist, ...group.clients, ...group.tactile.map((item) => item.participant)].filter((participant) =>
      subscribedParticipants.includes(participant),
    );
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

  const serverTimeResult = await timed(() => getServerTimeMs(setupClient));
  const serverTimeMs = serverTimeResult.ok ? serverTimeResult.value : Date.now();

  for (const group of groups) {
    await sendAndCount(group.therapist, group, {
      kind: 'STATE_UPDATED',
      state: runningState(sequence, serverTimeMs),
      emittedAtMs: serverTimeMs,
    });

    await saveTherapistState(setupClient, group.session.id, group.session.therapistToken, runningState(sequence, serverTimeMs)).catch(
      () => undefined,
    );
  }

  const startedAt = performance.now();
  let nextPulseAt = 0;
  let nextHeartbeatAt = 0;
  const pulseIntervalMs = pulseHz > 0 ? 1000 / pulseHz : null;

  while (performance.now() - startedAt < durationMs) {
    const elapsed = performance.now() - startedAt;

    if (pulseIntervalMs !== null && elapsed >= nextPulseAt) {
      for (const group of groups) {
        sequence += 1;
        await sendAndCount(group.therapist, group, {
          kind: 'TACTILE_PULSE',
          side: sideFor(sequence),
          durationMs: DEFAULT_STATE.tactile.pulseDurationMs,
          sequence,
          emittedAtMs: Date.now(),
        });
      }

      nextPulseAt += pulseIntervalMs;
    }

    if (elapsed >= nextHeartbeatAt) {
      for (const group of groups) {
        for (const client of group.clients) {
          await sendAndCount(client, group, {
            kind: 'CLIENT_READY',
            emittedAtMs: Date.now(),
          });
        }

        for (const tactile of group.tactile) {
          await sendAndCount(tactile.participant, group, {
            kind: 'TACTILE_DEVICE_HEARTBEAT',
            side: tactile.side,
            deviceId: tactile.deviceId,
            emittedAtMs: Date.now(),
            supported: true,
          });
        }
      }

      nextHeartbeatAt += 5000;
    }

    await sleep(10);
  }

  await sleep(2_000);

  const received = subscribedParticipants.reduce((sum, participant) => sum + participant.getReceived(), 0);
  const countsByKind = {};
  for (const participant of subscribedParticipants) {
    for (const [kind, count] of Object.entries(participant.getMessageCounts())) {
      countsByKind[kind] = (countsByKind[kind] || 0) + count;
    }
  }

  await teardownParticipants(participants);
  await cleanupSessions(setupClient, sessions, tactileDevices);
  setupClient.realtime.disconnect();

  return {
    kind: 'realtime',
    baseUrl,
    supabase: configFingerprint(config),
    sessionsRequested: sessionsCount,
    sessionsCreated: sessions.length,
    clientsPerSession,
    tactileDevicesPerSession: tactileDevices,
    participantsExpected: sessions.length * (1 + clientsPerSession + tactileDevices),
    participantsSubscribed: subscribedParticipants.length,
    durationMs,
    pulseHz,
    createSummary: summarizeTimings(createResults),
    rpcSummary: summarizeTimings(rpcResults),
    joinSummary: summarizeTimings(joinResults),
    serverTimeSummary: summarizeTimings([serverTimeResult]),
    sendSummary: summarizeTimings(sendResults),
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
      tactileDevices: toInt(args.tactileDevices || args.tactile, 0),
      durationMs: toInt(args.durationMs, 10_000),
      pulseHz: toFloat(args.pulseHz, 0),
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
          tactileDevices: toInt(args.tactileDevices || args.tactile, 0),
          durationMs: toInt(args.durationMs, 10_000),
          pulseHz: toFloat(args.pulseHz, 0),
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
  node scripts/stress-test.mjs realtime --base-url ${DEFAULT_VERCEL_URL} --sessions 25 --clients 1 --tactile 2 --duration-ms 15000 --pulse-hz 0.58
  node scripts/stress-test.mjs matrix --base-url ${DEFAULT_LOCAL_URL} --sessions 10,25,40 --clients 1 --tactile 0

Notes:
  - Realtime uses separate Supabase clients per participant to approximate separate browser WebSocket connections.
  - For local runs, Supabase config is read from .env.local/.env.
  - For deployed Vite runs, the script first tries to read the public Supabase config from the built assets.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
