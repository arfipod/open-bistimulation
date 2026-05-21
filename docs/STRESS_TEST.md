# Session Stress Test

Local run: 2026-05-21T00:52:47+02:00.

## Executive Summary

- The app deployed on Vercel is a static Vite frontend. There are no custom serverless functions on Vercel; the functional bottleneck is Supabase RPC and Supabase Realtime.
- Local `http://127.0.0.1:5173/` and Vercel `https://open-bistimulation.vercel.app/` point to the same Supabase project: `ilnybknoyafzejsftizy.supabase.co`, with the same public key fingerprint.
- The current product model is `1 therapist : 1 patient` per BLS session. The schema generates one `therapist_token` and one `client_token`; multiple clients can open the same link, but the app does not distinguish them as unique patients.
- The observed test passed without errors up to:
  - 50 lightweight sessions, without tactile mobile devices: 100 Realtime connections.
  - 50 complete sessions, with 1 patient and 2 tactile mobile devices: 200 Realtime connections, 100% of expected deliveries for 10 s at the default pulse rate.
  - 20 complete sessions in a high-pulse scenario: 80 Realtime connections, 100% of expected deliveries for 10 s.
- For production sizing, the limit to watch is not Vercel but Supabase Realtime: concurrent connections, messages per second, and joins per second.

## Added Tooling

Added `scripts/stress-test.mjs` and the npm script:

```bash
npm run stress -- http --base-url http://127.0.0.1:5173/ --requests 200 --concurrency 20
npm run stress -- realtime --base-url https://open-bistimulation.vercel.app/ --sessions 25 --clients 1 --tactile 2 --duration-ms 15000 --pulse-hz 0.58
npm run stress -- matrix --base-url http://127.0.0.1:5173/ --sessions 10,25,40 --clients 1 --tactile 0
```

For Realtime, the script creates one independent Supabase client per participant, approximating WebSocket connections from separate browsers. It also creates real sessions through RPC, opens `session:{id}` channels, sends broadcasts, and closes the sessions when finished.

## HTTP Tests

| Environment | Load | OK | p50 | p95 | p99 | Max | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Local | 200 requests, c=20 | 200/200 | 16 ms | 38 ms | 44 ms | 45 ms | Vite dev, HTML + direct module |
| Vercel | 200 requests, c=20 | 200/200 | 86 ms | 610 ms | 843 ms | 936 ms | HTML + 2 build assets |

There were no HTTP errors. This test only measures frontend delivery; it does not represent clinical session capacity.

## Lightweight Realtime Tests

Scenario: each session opens 1 therapist + 1 patient, without tactile mobile devices or continuous pulses.

| Environment | Sessions | Connections | Subscribed | Delivery | RPC p95 | Join p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Local | 10 | 20 | 20 | 100% | 84 ms | 628 ms |
| Local | 25 | 50 | 50 | 100% | 408 ms | 1049 ms |
| Local | 50 | 100 | 100 | 100% | 82 ms | 1884 ms |
| Vercel | 10 | 20 | 20 | 100% | 80 ms | 515 ms |
| Vercel | 25 | 50 | 50 | 100% | 131 ms | 1043 ms |
| Vercel | 50 | 100 | 100 | 100% | 79 ms | 1999 ms |

Interpretation: 50 therapists treating 50 simultaneous patients without tactile devices passed with margin during the short test window.

## Complete Realtime Tests

Scenario: each session opens 1 therapist + 1 patient + 2 tactile mobile devices. The tactile mobile devices send heartbeats and the therapist emits pulses.

| Base | Sessions | Connections | Duration | Pulse Hz | Subscribed | Sent | Expected received | Delivery | RPC p95 | Join p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vercel | 10 | 40 | 15 s | 0.58 | 40 | 190 | 570 | 100% | 152 ms | 882 ms |
| Vercel | 20 | 80 | 15 s | 0.58 | 80 | 380 | 1140 | 100% | 150 ms | 1544 ms |
| Vercel | 30 | 120 | 15 s | 0.58 | 120 | 570 | 1710 | 100% | 165 ms | 2214 ms |
| Vercel | 50 | 200 | 10 s | 0.58 | 200 | 650 | 1950 | 100% | 153 ms | 3614 ms |
| Vercel | 20 | 80 | 10 s | 3.08 | 80 | 760 | 2280 | 100% | 167 ms | 1547 ms |

Interpretation: the deployment handled 50 complete sessions in a short test. Even so, 200 connections already matches the concurrent connection limit documented by Supabase Realtime for the Free plan, so I would not treat this as production capacity without confirming the plan and logs.

## Capacity Model

Supabase documents Realtime limits by plan: Free 200 concurrent connections and 100 messages/s; Pro 500 connections and 500 messages/s; Pro without a spend cap 10,000 connections and 2,500 messages/s. Supabase also documents that an `event` counts when it is sent from a client or delivered to a client, and that `tenant_events` can disconnect when throughput is exceeded.

Source: https://supabase.com/docs/guides/realtime/limits

One current therapeutic pair consumes:

| Mode | Connections per session | Approximate messages/s per session |
| --- | ---: | ---: |
| Without tactile devices | 2 | 0.4 from client heartbeat |
| Tactile devices connected, without pulses | 4 | 2.4 from heartbeats |
| Tactile devices at default speed, `pulseHz ~= 0.58` | 4 | `2.4 + 4 * 0.58 = 4.72` |
| Tactile devices at maximum speed, `pulseHz ~= 3.08` | 4 | `2.4 + 4 * 3.08 = 14.72` |

Quota-based estimate, before applying operational margin:

| Mode | Free | Pro | Pro without spend cap |
| --- | ---: | ---: | ---: |
| Without tactile devices, connection-limited | 100 sessions | 250 sessions | 5000 sessions |
| Tactile devices connected, connection-limited | 50 sessions | 125 sessions | 2500 sessions |
| Tactile devices connected, without pulses, message-limited | 41 sessions | 208 sessions | 1041 sessions |
| Tactile devices at default speed, message-limited | 21 sessions | 105 sessions | 529 sessions |
| Tactile devices at maximum speed, message-limited | 6 sessions | 33 sessions | 169 sessions |

Recommendation with a 60-70% margin:

| Service scenario | Conservative Free | Conservative Pro |
| --- | ---: | ---: |
| Visual/audio without tactile devices | 60-70 sessions | 150-175 sessions |
| Complete session with tactile devices at default speed | 12-15 sessions | 60-75 sessions |
| Complete session with tactile devices at maximum speed | 4-5 sessions | 20-25 sessions |

## Test Limitations

- These are short tests, not 30-120 minute soak tests.
- Internal Supabase Dashboard logs were not reviewed; measurements were client-side only.
- Physical phones and `navigator.vibrate()` were not tested, only equivalent Realtime channels.
- The app does not truly support `1 therapist : n unique patients` in a single session; n patients require n independent sessions or product/data model changes.
- Joins were limited to 60/s to avoid false `too_many_joins` errors. If many users enter at exactly the same time, the joins-per-second limit also needs to be considered.

## Conclusion

For the current product state, it is fair to say that:

- 50 therapists with 50 patients without tactile devices was validated locally and on Vercel.
- 50 therapists with 50 patients and 2 tactile devices per patient was validated against Vercel/Supabase in a short window.
- If the project is on Supabase Free, I would not promise 50 complete sessions with tactile devices in sustained production; I would size closer to 12-15 complete sessions at the default speed, or 4-5 at maximum speed.
- If the project is on Supabase Pro, a reasonable initial target would be 60-75 complete sessions at the default speed, dropping to 20-25 if frequent maximum-speed use is expected.
