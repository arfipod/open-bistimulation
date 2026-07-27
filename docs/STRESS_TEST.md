# Session Stress Test

Protocol audit updated: 2026-07-26. Historical benchmark run: 2026-05-21.

## What the current harness exercises

The Vercel deployment is a static Vite frontend, so the functional load is split between frontend delivery, Supabase RPC, and Supabase Realtime. `scripts/stress-test.mjs` has separate HTTP and session-protocol scenarios.

The Realtime scenario now follows the app's hardened protocol:

- Creates disposable sessions through `create_bls_session`.
- Validates the therapist and client roles through `get_bls_session` before joining Realtime.
- Joins the token-scoped, encoded topic `session:${encodeURIComponent(sessionId)}:${encodeURIComponent(clientToken)}`. The full topic and tokens are never printed.
- Enables broadcast acknowledgements, disables self-delivery, and tracks each connection's therapist or client role through advisory Presence.
- Calls the therapist-token `therapist_heartbeat` RPC immediately and every five seconds, requiring a literal `true` result.
- Polls authoritative session state for both roles every five seconds. Every participant read verifies that `therapist_heartbeat_at` is no more than 15 seconds old and no more than 5 seconds in the future, matching the participant safety gate.
- Persists every controller state change first through the four-argument CAS RPC `therapist_save_state(..., _expected_version)`.
- Treats an RPC result other than literal `true` as a failed mutation. A rejected CAS write is not broadcast.
- Sends `STATE_UPDATED` only after persistence. Broadcast delivery is an optimization: clients treat it as an invalidation and refetch authoritative state, while five-second polling remains the database-backed authority if a broadcast is lost.
- Models the participant's five-second authoritative poll and its five-second `CLIENT_READY` and `JOYCON_STATUS` broadcasts.
- Invokes `therapist_stop_session` while the session is running, requires a normalized stopped JSON state with the exact next version, and verifies the participant-token read sees that authoritative stop. It then performs one versioned restart before ending the session, exercising the stop → restart → end ordering.
- Ends every session atomically through `end_bls_session`, verifies that `ended_at`, the incremented state version, and `status: "ended"` were committed together, then sends a best-effort `SESSION_ENDED` invalidation before removing channels.

The JSON report separates:

- `rpcSummary`: initial token and role validation reads.
- `authoritativeReadSummary`: reconnect, invalidation, and five-second therapist/participant reads.
- `therapistHeartbeatSummary` and `heartbeatFreshnessSummary`: heartbeat RPC reliability and participant-observed freshness.
- `stateSaveSummary`: CAS state writes.
- `stopSummary` and `stopVerificationSummary`: atomic stop response integrity and participant-visible database authority.
- `resumeAfterStopSummary` and `resumeVerificationSummary`: the versioned restart after stop and its authoritative readback.
- `joinSummary` and `presenceTrackSummary`: channel and Presence setup.
- `sendSummary`: acknowledged, best-effort application broadcasts.
- `endSummary` and `endVerificationSummary`: strict atomic end calls and authoritative post-end verification.

## Commands

```bash
npm run stress -- http --base-url http://127.0.0.1:5173/ --requests 200 --concurrency 20
npm run stress -- realtime --base-url https://open-bistimulation.vercel.app/ --sessions 25 --clients 1 --duration-ms 15000 --state-hz 0.58
npm run stress -- matrix --base-url http://127.0.0.1:5173/ --sessions 10,25,40 --clients 1
```

For local Realtime runs, Supabase configuration is read from `.env.local` or `.env`. For a deployed Vite build, the harness can discover the public project URL and publishable/anon key from built assets.

Before a Realtime run, deploy the current `supabase/schema.sql`. In particular, the target database must expose the four-argument `therapist_save_state(uuid, text, jsonb, bigint)` function, `therapist_stop_session(uuid, text) -> jsonb`, `therapist_heartbeat(uuid, text)`, the `therapist_heartbeat_at` field in create/get results, and the atomic `end_bls_session` implementation. The scenario creates, mutates, stops, restarts, and ends real disposable session rows in the selected project.

## Historical results

The results below were captured on 2026-05-21 with the earlier harness. That version used the unscoped `session:{id}` topic, did not persist each emitted update with CAS, did not exercise atomic stop/restart/end authority, did not model Presence, therapist-token heartbeats, `JOYCON_STATUS`, or database-backed heartbeat freshness, did not refetch authoritative state after invalidations, and sampled join duration only after all subscription attempts completed. These figures are retained as a transport baseline, not evidence of capacity for the current protocol. A post-hardening live Realtime benchmark has not yet been recorded in this document.

### HTTP delivery

| Environment | Load | OK | p50 | p95 | p99 | Max | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Local | 200 requests, c=20 | 200/200 | 16 ms | 38 ms | 44 ms | 45 ms | Vite dev, HTML + direct module |
| Vercel | 200 requests, c=20 | 200/200 | 86 ms | 610 ms | 843 ms | 936 ms | HTML + 2 build assets |

### Lightweight Realtime transport

Each session opened one controller and one participant without continuous controller updates.

| Environment | Sessions | Connections | Subscribed | Delivery | RPC p95 | Join p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Local | 10 | 20 | 20 | 100% | 84 ms | 628 ms |
| Local | 25 | 50 | 50 | 100% | 408 ms | 1049 ms |
| Local | 50 | 100 | 100 | 100% | 82 ms | 1884 ms |
| Vercel | 10 | 20 | 20 | 100% | 80 ms | 515 ms |
| Vercel | 25 | 50 | 50 | 100% | 131 ms | 1043 ms |
| Vercel | 50 | 100 | 100 | 100% | 79 ms | 1999 ms |

### Repeated broadcast transport

| Base | Sessions | Connections | Duration | State Hz | Subscribed | Sent | Expected received | Delivery | RPC p95 | Join p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vercel | 10 | 20 | 15 s | 0.58 | 20 | 190 | 190 | 100% | 152 ms | 882 ms |
| Vercel | 20 | 40 | 15 s | 0.58 | 40 | 380 | 380 | 100% | 150 ms | 1544 ms |
| Vercel | 30 | 60 | 15 s | 0.58 | 60 | 570 | 570 | 100% | 165 ms | 2214 ms |
| Vercel | 50 | 100 | 10 s | 0.58 | 100 | 650 | 650 | 100% | 153 ms | 3614 ms |
| Vercel | 20 | 40 | 10 s | 3.08 | 40 | 760 | 760 | 100% | 167 ms | 1547 ms |

## Current capacity model

Supabase's documented Realtime limits, checked on 2026-07-26, are:

| Limit | Free | Pro | Pro without spend cap |
| --- | ---: | ---: | ---: |
| Concurrent connections | 200 | 500 | 10,000 |
| Messages per second | 100 | 500 | 2,500 |
| Channel joins per second | 100 | 500 | 2,500 |

Source: https://supabase.com/docs/guides/realtime/limits

Supabase counts an event when a WebSocket message is sent from or delivered to a client. For one controller/participant pair, the steady-state approximation is:

| Mode | Connections | Realtime events/s | Database RPC/s |
| --- | ---: | ---: | ---: |
| Idle after setup | 2 | `0.8` | about `0.6` |
| Controller state updates at rate `h` | 2 | `0.8 + 2h` | about `0.6 + 2h` |

The `0.8` Realtime baseline is two participant broadcasts every five seconds, each sent once and delivered once. The `0.6` RPC baseline is one therapist heartbeat plus one therapist poll plus one participant poll every five seconds. Each controller state update adds a CAS save and an immediate participant authoritative refetch. The estimate excludes startup/reconnect reads, the one-time atomic stop/restart/end sequence, Presence setup traffic, retries, and coalescing while an authoritative read is already in flight.

Quota-only estimates, before operational margin:

| Mode | Free | Pro | Pro without spend cap |
| --- | ---: | ---: | ---: |
| Idle | 100 sessions | 250 sessions | 3,125 sessions |
| State updates at 0.58 Hz | 51 sessions | 250 sessions | 1,275 sessions |
| State updates at 3.08 Hz | 14 sessions | 71 sessions | 359 sessions |

These are arithmetic ceilings, not safe production targets. A 60-70% Realtime margin suggests:

| Mode | Conservative Free | Conservative Pro |
| --- | ---: | ---: |
| Idle | 60-70 sessions | 150-175 sessions |
| State updates at 0.58 Hz | 30-35 sessions | 150-175 sessions |
| State updates at 3.08 Hz | 8-10 sessions | 42-50 sessions |

RPC/database capacity, client network latency, Presence limits, reconnection bursts, and project-specific limits can produce a lower ceiling. Confirm the selected Supabase plan and review Realtime and database logs during a representative soak test.

## Test limitations

- The historical runs lasted seconds, not the 30-120 minutes expected of a useful soak test.
- The current protocol-aware harness has not yet been run against the deployed CAS, atomic-stop, heartbeat, and atomic-end schema for a recorded benchmark.
- Supabase Dashboard logs were not reviewed; historical measurements were client-side only.
- Browser rendering, audio, WebHID, and Joy-Con rumble are outside this Node-based test.
- The product model remains one controller to one participant per BLS session. Opening the same participant link multiple times does not create independently addressable participants.
- The harness throttles joins to 60/s by default. Test deliberate join bursts separately if that traffic pattern is expected.
- Realtime Presence is advisory and a public-channel peer can claim a role, but participant output additionally requires a fresh database heartbeat that can only be written with the therapist token. Presence impersonation alone cannot keep output active. This harness does not test private-channel RLS authorization.

## Release gate

Before publishing a capacity claim:

1. Deploy the current schema and app to the target project.
2. Run the protocol-aware matrix at realistic update rates.
3. Run a 30-120 minute soak at the intended concurrent-session count.
4. Confirm `stateSaveSummary`, `stopSummary`, `stopVerificationSummary`, `resumeAfterStopSummary`, `resumeVerificationSummary`, `therapistHeartbeatSummary`, `heartbeatFreshnessSummary`, `authoritativeReadSummary`, `presenceTrackSummary`, `endSummary`, and `endVerificationSummary` have no failures or stale observations.
5. Treat `sendSummary` failures as degraded latency rather than lost authority, and confirm polling still observes persisted state.
6. Review Supabase Realtime and database logs for throttling, disconnects, slow RPCs, heartbeat gaps, and CAS rejects.
