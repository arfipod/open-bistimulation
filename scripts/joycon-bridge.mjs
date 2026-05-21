#!/usr/bin/env node
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import {
  MAX_DURATION_MS,
  MAX_REPEATS,
  MIN_DURATION_MS,
  MIN_REPEATS,
  listJoyCons,
  neutralJoyCons,
  pulseJoyCons,
} from './joycon-hid-core.mjs';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

const BRIDGE_VERSION = packageJson.version ?? '0.1.0';
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 5174;
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://open-bistimulation.vercel.app'];
const API_ENDPOINTS = ['/api/joycon/status', '/api/joycon/devices', '/api/joycon/pulse', '/api/joycon/neutral'];
const ALLOWED_SIDES = new Set(['left', 'right', 'both']);
const ALLOWED_INTENSITIES = new Set(['low', 'medium', 'high']);
const MAX_BODY_BYTES = 4096;

function parseAllowedOrigins(value) {
  return (value ?? DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getConfig() {
  const host = process.env.JOYCON_BRIDGE_HOST || DEFAULT_HOST;
  const port = Number(process.env.JOYCON_BRIDGE_PORT || DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('JOYCON_BRIDGE_PORT must be an integer between 1 and 65535.');
  }
  return {
    host,
    port,
    allowedOrigins: parseAllowedOrigins(process.env.JOYCON_ALLOWED_ORIGINS),
  };
}

function getCorsHeaders(request, allowedOrigins) {
  const origin = request.headers.origin;
  if (!origin) return {};
  if (!allowedOrigins.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'false',
    Vary: 'Origin',
  };
}

function writeResponse(request, response, allowedOrigins, status, body, extraHeaders = {}) {
  const corsHeaders = getCorsHeaders(request, allowedOrigins);
  if (corsHeaders === null) {
    response.writeHead(403, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(JSON.stringify({ ok: false, error: 'Origin is not allowed by JOYCON_ALLOWED_ORIGINS.' }));
    return;
  }

  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...corsHeaders,
    ...extraHeaders,
  });
  response.end(JSON.stringify(body, null, 2));
}

function writeJson(request, response, allowedOrigins, status, body) {
  writeResponse(request, response, allowedOrigins, status, body);
}

function writePreflight(request, response, allowedOrigins) {
  const corsHeaders = getCorsHeaders(request, allowedOrigins);
  if (corsHeaders === null) {
    writeJson(request, response, allowedOrigins, 403, { ok: false, error: 'Origin is not allowed by JOYCON_ALLOWED_ORIGINS.' });
    return;
  }

  response.writeHead(204, {
    ...corsHeaders,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
  });
  response.end();
}

async function readJsonBody(request) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) throw new Error(`Request body must be ${MAX_BODY_BYTES} bytes or smaller.`);
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

function assertPlainObject(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object.');
  }
}

function rejectUnknownFields(body, allowedFields) {
  const allowed = new Set(allowedFields);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new Error(`Unsupported field "${key}".`);
  }
}

function validateSide(value) {
  if (!ALLOWED_SIDES.has(value)) throw new Error('side must be left, right, or both.');
  return value;
}

function validatePulseBody(body) {
  assertPlainObject(body);
  rejectUnknownFields(body, ['side', 'intensity', 'duration', 'repeats']);

  if (!ALLOWED_INTENSITIES.has(body.intensity)) throw new Error('intensity must be low, medium, or high.');
  if (!Number.isFinite(body.duration) || body.duration < MIN_DURATION_MS || body.duration > MAX_DURATION_MS) {
    throw new Error(`duration must be a number between ${MIN_DURATION_MS} and ${MAX_DURATION_MS} ms.`);
  }
  if (!Number.isInteger(body.repeats) || body.repeats < MIN_REPEATS || body.repeats > MAX_REPEATS) {
    throw new Error(`repeats must be an integer between ${MIN_REPEATS} and ${MAX_REPEATS}.`);
  }

  return {
    side: validateSide(body.side),
    intensity: body.intensity,
    duration: body.duration,
    repeats: body.repeats,
  };
}

function validateNeutralBody(body) {
  assertPlainObject(body);
  rejectUnknownFields(body, ['side']);
  return { side: validateSide(body.side) };
}

async function handleApi(request, response, url, allowedOrigins) {
  try {
    if (request.method === 'OPTIONS') {
      writePreflight(request, response, allowedOrigins);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/joycon/status') {
      writeJson(request, response, allowedOrigins, 200, {
        ok: true,
        mode: 'node-hid',
        bridgeVersion: BRIDGE_VERSION,
        endpoints: API_ENDPOINTS,
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/joycon/devices') {
      writeJson(request, response, allowedOrigins, 200, { ok: true, devices: await listJoyCons() });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/joycon/pulse') {
      const events = [];
      const body = validatePulseBody(await readJsonBody(request));
      await pulseJoyCons(body, (event) => events.push(event));
      writeJson(request, response, allowedOrigins, 200, { ok: true, events });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/joycon/neutral') {
      const events = [];
      const body = validateNeutralBody(await readJsonBody(request));
      await neutralJoyCons(body, (event) => events.push(event));
      writeJson(request, response, allowedOrigins, 200, { ok: true, events });
      return;
    }

    if (API_ENDPOINTS.includes(url.pathname)) {
      writeJson(request, response, allowedOrigins, 405, { ok: false, error: 'Method is not allowed for this endpoint.' });
      return;
    }

    writeJson(request, response, allowedOrigins, 404, { ok: false, error: 'Unknown API endpoint.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Joy-Con bridge error.';
    const status = message.startsWith('Request body') || message.includes(' must ') || message.startsWith('Unsupported field') ? 400 : 500;
    writeJson(request, response, allowedOrigins, status, { ok: false, error: message });
  }
}

function createJoyConBridgeServer(config) {
  return createServer(async (request, response) => {
    const hostHeader = request.headers.host ?? `${config.host}:${config.port}`;
    const url = new URL(request.url ?? '/', `http://${hostHeader}`);
    if (!url.pathname.startsWith('/api/joycon/')) {
      writeJson(request, response, config.allowedOrigins, 404, { ok: false, error: 'Unknown API endpoint.' });
      return;
    }

    await handleApi(request, response, url, config.allowedOrigins);
  });
}

const config = getConfig();
const server = createJoyConBridgeServer(config);

server.listen(config.port, config.host, () => {
  console.log(`Joy-Con bridge listening at http://${config.host}:${config.port}`);
  console.log(`Allowed origins: ${config.allowedOrigins.join(', ')}`);
});
