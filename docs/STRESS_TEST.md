# Session Stress Test

Local run: 2026-05-21T00:52:47+02:00.

## Executive Summary

- The app deployed on Vercel is a static Vite frontend. There are no custom serverless functions on Vercel; the functional bottleneck is Supabase RPC and Supabase Realtime.
- Local `http://127.0.0.1:5173/` and Vercel `https://open-bistimulation.vercel.app/` point to the same Supabase project: `ilnybknoyafzejsftizy.supabase.co`, with the same public key fingerprint.
- The current product model is `1 controller : 1 participant` per BLS session. The schema still uses legacy `therapist_token` and `client_token` identifiers; multiple participants can open the same link, but the app does not distinguish them as unique participants.
- The observed historical test passed without errors up to 50 lightweight sessions: 100 Realtime connections.
- Tactile Joy-Con output is now local to the controller browser and Joy-Con bridge. Supabase Realtime is used for session state and participant readiness, not hardware pulse broadcasts.
- For production sizing, the limit to watch is not Vercel but Supabase Realtime: concurrent connections, messages per second, and joins per second.

## Added Tooling

Added `scripts/stress-test.mjs` and the npm script:

```bash
npm run stress -- http --base-url http://127.0.0.1:5173/ --requests 200 --concurrency 20
npm run stress -- realtime --base-url https://open-bistimulation.vercel.app/ --sessions 25 --clients 1 --duration-ms 15000 --state-hz 0.58
npm run stress -- matrix --base-url http://127.0.0.1:5173/ --sessions 10,25,40 --clients 1
```

For Realtime, the script creates one independent Supabase client per participant, approximating WebSocket connections from separate browsers. It also creates real sessions through RPC, opens `session:{id}` channels, sends broadcasts, and closes the sessions when finished.

## HTTP Tests

| Environment | Load | OK | p50 | p95 | p99 | Max | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Local | 200 requests, c=20 | 200/200 | 16 ms | 38 ms | 44 ms | 45 ms | Vite dev, HTML + direct module |
| Vercel | 200 requests, c=20 | 200/200 | 86 ms | 610 ms | 843 ms | 936 ms | HTML + 2 build assets |

There were no HTTP errors. This test only measures frontend delivery; it does not represent professional session capacity.

## Lightweight Realtime Tests

Scenario: each session opens 1 controller + 1 participant, without continuous controller state updates.

| Environment | Sessions | Connections | Subscribed | Delivery | RPC p95 | Join p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Local | 10 | 20 | 20 | 100% | 84 ms | 628 ms |
| Local | 25 | 50 | 50 | 100% | 408 ms | 1049 ms |
| Local | 50 | 100 | 100 | 100% | 82 ms | 1884 ms |
| Vercel | 10 | 20 | 20 | 100% | 80 ms | 515 ms |
| Vercel | 25 | 50 | 50 | 100% | 131 ms | 1043 ms |
| Vercel | 50 | 100 | 100 | 100% | 79 ms | 1999 ms |

Interpretation: 50 controllers with 50 simultaneous participants passed with margin during the short test window.

## State Update Realtime Tests

Scenario: each session opens 1 controller + 1 participant. The controller emits repeated `STATE_UPDATED` broadcasts to model session state churn. Local Joy-Con pulses are intentionally outside Supabase Realtime.

| Base | Sessions | Connections | Duration | State Hz | Subscribed | Sent | Expected received | Delivery | RPC p95 | Join p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vercel | 10 | 20 | 15 s | 0.58 | 20 | 190 | 190 | 100% | 152 ms | 882 ms |
| Vercel | 20 | 40 | 15 s | 0.58 | 40 | 380 | 380 | 100% | 150 ms | 1544 ms |
| Vercel | 30 | 60 | 15 s | 0.58 | 60 | 570 | 570 | 100% | 165 ms | 2214 ms |
| Vercel | 50 | 100 | 10 s | 0.58 | 100 | 650 | 650 | 100% | 153 ms | 3614 ms |
| Vercel | 20 | 40 | 10 s | 3.08 | 40 | 760 | 760 | 100% | 167 ms | 1547 ms |

Interpretation: the historical deployment handled repeated controller broadcasts in a short test. Even so, I would not treat this as production capacity without confirming the plan and logs.

## Capacity Model

Supabase documents Realtime limits by plan: Free 200 concurrent connections and 100 messages/s; Pro 500 connections and 500 messages/s; Pro without a spend cap 10,000 connections and 2,500 messages/s. Supabase also documents that an `event` counts when it is sent from a client or delivered to a client, and that `tenant_events` can disconnect when throughput is exceeded.

Source: https://supabase.com/docs/guides/realtime/limits

One current controller/participant pair consumes:

| Mode | Connections per session | Approximate messages/s per session |
| --- | ---: | ---: |
| Idle visual/audio/tactile session | 2 | 0.4 from client heartbeat |
| Controller state updates at `stateHz ~= 0.58` | 2 | `0.4 + 2 * 0.58 = 1.56` |
| Controller state updates at `stateHz ~= 3.08` | 2 | `0.4 + 2 * 3.08 = 6.56` |

Quota-based estimate, before applying operational margin:

| Mode | Free | Pro | Pro without spend cap |
| --- | ---: | ---: | ---: |
| Idle sessions, connection-limited | 100 sessions | 250 sessions | 5000 sessions |
| State updates at 0.58 Hz, message-limited | 64 sessions | 320 sessions | 1602 sessions |
| State updates at 3.08 Hz, message-limited | 15 sessions | 76 sessions | 381 sessions |

Recommendation with a 60-70% margin:

| Service scenario | Conservative Free | Conservative Pro |
| --- | ---: | ---: |
| Idle visual/audio/tactile sessions | 60-70 sessions | 150-175 sessions |
| Sessions with 0.58 Hz state updates | 35-45 sessions | 190-220 sessions |
| Sessions with 3.08 Hz state updates | 9-10 sessions | 45-55 sessions |

## Test Limitations

- These are short tests, not 30-120 minute soak tests.
- Internal Supabase Dashboard logs were not reviewed; measurements were client-side only.
- Local Joy-Con bridge behavior was not tested by this Supabase Realtime stress test.
- The app does not truly support `1 controller : n unique participants` in a single session; n participants require n independent sessions or product/data model changes.
- Joins were limited to 60/s to avoid false `too_many_joins` errors. If many users enter at exactly the same time, the joins-per-second limit also needs to be considered.

## Conclusion

For the current product state, it is fair to say that:

- 50 controllers with 50 participants were exercised locally and on Vercel.
- Repeated controller state broadcasts were exercised against Vercel/Supabase in a short window.
- If the project is on Supabase Free, I would not promise sustained high-frequency state-update sessions without reviewing current Supabase logs and plan limits.
- If the project is on Supabase Pro, a reasonable initial target depends mostly on state update rate and expected session overlap.
