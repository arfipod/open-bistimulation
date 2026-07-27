# Product Definition

## Purpose

Open Bistimulation is an experimental browser application for coordinating configurable left/right visual, auditory, and optional Joy-Con tactile cues. A controller operates a shared session and a participant receives the cues in their browser.

The product is not medical advice and is not a medical device. It is not an emergency service or a basis for diagnostic or therapeutic decisions. It makes no clinical, professional, accessibility-certification, security-certification, or outcome guarantee.

## Audiences

### Controller

A qualified professional, facilitator, researcher, or other responsible operator who:

- Creates and ends a session.
- Shares the participant invitation.
- Chooses modalities, timing, direction, intensity, and round duration.
- Starts, pauses, resumes, stops, and resets rounds.
- Observes participant connection and available Joy-Con status.

The controller remains responsible for whether and how the experimental software is used.

### Participant

A person who opens a time-limited invitation and:

- Receives the shared visual and, after permission, auditory cues.
- Optionally connects paired Joy-Cons through browser WebHID.
- Can enter fullscreen for a focused experience.
- Can immediately stop and later resume local output without waiting for the controller.

### Deployer

The person or organization responsible for the Vercel/frontend and Supabase deployment, HTTPS, environment configuration, data retention scheduling, access to logs, and operational monitoring.

## Core Journey

1. **Create:** The controller creates a session from the landing page. Saved local preferences seed the new session.
2. **Authenticate:** The controller page validates its opaque therapist token before joining realtime. The server returns a separate participant token and invitation URL.
3. **Prepare:** The controller configures visual, audio, tactile, and duration settings; previews the visual result; shares the invitation; and confirms participant connectivity.
4. **Join:** The participant URL validates its token before joining realtime. Audio requires a direct browser permission gesture. Joy-Cons require explicit browser selection and may be tested before use.
5. **Run:** A round follows `idle -> running <-> paused -> stopping -> stopped`. Server-clock timestamps coordinate both browsers. A configured duration stops participant output when its accumulated running time expires.
6. **Recover:** Reconnects reload the persisted server snapshot. The participant can suppress all output locally at any time.
7. **End:** The controller explicitly confirms session termination. One atomic server operation marks both the persisted state and session as ended; subsequent loads receive an ended view.

Saving preferences stores the current modality configuration locally for the controller and in the active session. Resetting a round resets counters; it does not end the session.

## Safety Invariants

- No sensory output occurs before a valid participant session has loaded.
- Output is active only after a fresh authoritative read, a verified server clock, a current therapist-token heartbeat, connected realtime, controller presence, a running state, an unexpired round, and no participant local stop.
- Participant local stop is always available, including in fullscreen.
- Pause, stop, disconnect, expiry, local stop, session end, and unmount suppress browser audio and visual output and send a neutral command to tactile devices when applicable.
- Audio never depends on autoplay; the participant deliberately enables it in a browser gesture.
- Tactile output requires explicit device selection. Device status and test controls must be visible before relying on it.
- Controller transport actions show failures and do not silently imply that a rejected command succeeded.
- Ending a session is separate from stopping a round and requires confirmation.
- Realtime or hardware delivery is best effort. The application must fail toward no output, not continued output.
- The UI must state the experimental and non-medical limits without hiding them behind account creation or a session flow.

## State and Realtime Model

The Supabase session row is the durable authority. Therapist mutations are authenticated by the therapist bearer token, serialized in the controller, persisted first, and broadcast only after a successful write. Session state versions increase monotonically; the server rejects stale state writes. Ending is an atomic RPC and does not depend on broadcast delivery.

Realtime carries invalidation hints, presence, readiness, session-end hints, and non-persisted Joy-Con status. State and end payloads never become authority directly: they trigger a fresh database read. Both roles also poll the durable row, so a missed broadcast cannot leave either view stale indefinitely.

The participant joins only after its token has been validated. Incoming message shapes are validated before use. The realtime topic is scoped by the participant secret rather than the public session id alone. Realtime presence is only a fast liveness hint: participant output additionally requires a recent database heartbeat that only the therapist token can update.

This capability-token design prevents participant-token holders from authorizing output, but its public Realtime channel is still not a substitute for Supabase private-channel authorization with authenticated users and `realtime.messages` policies. A participant-token holder can create nuisance presence or invalidation traffic for that session; durable RPC state and heartbeat checks remain authoritative.

Preview mode is an observer experience: it does not advertise participant presence and does not operate participant tactile hardware.

## Output Fail-safe Behavior

If state delivery becomes uncertain, output is suppressed:

| Condition | Visual | Audio | Tactile |
| --- | --- | --- | --- |
| Session not validated or not running | Off | Off | Neutral/off |
| Server clock, authoritative read, or therapist heartbeat not verified | Off | Off | Neutral/off |
| Realtime disconnected or reconnecting | Off | Off | Neutral/off |
| Participant local stop | Off | Off | Neutral/off |
| Configured round duration elapsed | Off | Off | Neutral/off |
| Session ended | Off | Off | Neutral/off |
| Audio not unlocked | Unchanged if otherwise safe | Off | Unchanged if otherwise safe |
| Preview mode | Available when otherwise safe | Off | Off |

Joy-Con commands are serialized per device. A neutral request invalidates an active pulse sequence so stale rumble work cannot restart output after a stop.

## Privacy and Security Assumptions

- Therapist and participant tokens are bearer secrets. Possession grants the corresponding session role.
- New links place tokens in URL fragments so they are not sent as normal HTTP request targets. Legacy query-string tokens are migrated into the fragment immediately.
- Invitation links must not be placed in public messages, analytics, screenshots, bug reports, or logs.
- Direct anonymous and authenticated table access is revoked and denied by row-level security. The browser uses narrowly exposed RPC functions that validate tokens, session expiry, input shape, and state version.
- `SECURITY DEFINER` functions use a fixed search path, and function execution is revoked by default before selected app RPCs are granted.
- The browser receives only a public Supabase key. Service-role keys and database credentials must never be shipped to the frontend.
- Session data is intentionally limited to ids, bearer tokens, cue settings, status, and timestamps. The product does not intentionally collect names, notes, symptoms, diagnoses, transcripts, or care plans.
- Joy-Con detection, device metadata, and rumble commands remain in the participant browser and are not persisted to Supabase.
- Sessions expire within 24 hours. Expired rows are deleted only when the deployer runs or schedules the cleanup function.
- The threat model assumes HTTPS, a trusted frontend deployment, a correctly configured Supabase project, no injected script, and careful handling of deployment logs. An XSS or leaked bearer token can compromise its session.

## Non-goals

- Diagnosis, treatment selection, crisis response, or emergency operation.
- Claims of clinical efficacy, regulatory approval, legal compliance, or fitness for professional use.
- Patient records, notes, case management, billing, scheduling, consent capture, or electronic health record integration.
- User accounts, organization administration, long-term session history, analytics, or audit reporting.
- Multi-controller collaboration or guaranteed delivery across unreliable networks.
- Background, locked-screen, offline, or unattended sensory output.
- Remote storage or orchestration of participant hardware.
- Automatic pairing, guaranteed browser support, or guaranteed Joy-Con behavior.
- Replacement of human observation, informed judgment, or an immediate physical stop mechanism where one is required.
