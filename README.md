# Open Bistimulation

Open Bistimulation is an independent MVP for browser-based bilateral sensory cues. BLS in this project means configurable left/right visual, auditory, and optional Joy-Con tactile cues coordinated by a controller for a participant.

This project is experimental software. It is not medical advice, not a medical device, not for diagnostic or therapeutic decisions, and not for emergencies. Qualified professionals and operators remain responsible for deciding whether and how to use it in their own context.

Open Bistimulation is not affiliated with, endorsed by, sponsored by, or connected to bilateralstimulation.io or BLS GmbH.

## Features

- Controller page for cue settings, timing, session status, and participant invitation links.
- Participant page for visual and audio cues that work directly in the browser.
- Optional Joy-Con tactile output can run directly from the participant browser through WebHID.
- English and Spanish UI copy.
- Supabase RPC and Realtime backend with RLS denying direct anon table access.

The app is hosted normally on Vercel as a browser frontend. Visual and audio cues run in the participant browser, and optional Joy-Con tactile output also runs in the participant browser through WebHID. No local bridge process is required for the Vercel app or the local Vite app. The legacy `node-hid` scripts remain available for CLI diagnostics.

## Local Setup

Requirements:

- Node.js `>=20 <23`
- npm `>=10`
- A Supabase project for shared sessions

Install and run:

```sh
npm install
cp .env.example .env.local
npm run dev
```

Configure `.env.local` with:

```sh
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

The Vercel/Supabase aliases `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are also supported by the app runtime.

## Browser Joy-Con WebHID

Pair both Joy-Cons over Bluetooth first, then open the participant link in a browser with WebHID support. In the tactile panel, use `Add Joy-Cons` and select each controller from the browser device prompt. The app sends rumble reports directly from `navigator.hid`; Supabase does not register tactile devices or store Joy-Con device metadata, and Supabase Realtime is not used for hardware output.

Quick flow:

1. Pair the left and right Joy-Con with the participant computer over Bluetooth.
2. Open the participant link in Chrome or Edge over HTTPS or localhost.
3. Use `Add Joy-Cons` in the participant tactile panel and approve the browser prompt.
4. Select both Joy-Cons. If the browser asks once per controller, repeat `Add Joy-Cons`.
5. Test left, right, and both sides before starting a round.
6. Keep the participant tab open, awake, and visible while tactile output is enabled.

See [docs/TACTILE_MOBILE.md](docs/TACTILE_MOBILE.md) for the current browser flow. See [docs/joycon-bridge.md](docs/joycon-bridge.md) only if you want the legacy local bridge or CLI diagnostics.

## Supabase Setup

1. Open Supabase Dashboard > SQL Editor.
2. Run [supabase/schema.sql](supabase/schema.sql).
3. Confirm Realtime is enabled for the project.
4. Use the app to create a session from `/`.

The schema creates:

- `public.sessions`
- RPC functions for creating sessions, loading sessions, saving controller state/preferences, ending sessions, and reading server time.
- RLS policies that deny direct table access from anon/authenticated roles. The app uses `SECURITY DEFINER` RPC functions instead.

For compatibility with older installs, the schema also drops obsolete tactile-device persistence objects if they exist. Those objects belonged to the removed browser-device registration flow.

## Data And Retention

Supabase stores the minimum operational data needed for the MVP:

- Session id
- Controller and participant tokens
- Session state
- Preferences
- Timestamps such as creation, update, expiry, and end time

Tactile preferences may include whether tactile output is enabled plus pulse timing values. Joy-Con detection and rumble commands stay in the controller browser and are not stored in Supabase.

The app does not intentionally store participant names, professional notes, diagnostic labels, symptoms, care plans, or transcripts. Avoid placing sensitive identifying information into URLs, browser tools, issue reports, logs, or deployment settings.

Sessions receive an `expires_at` timestamp. To remove expired sessions manually:

```sql
select public.cleanup_expired_bls_sessions();
```

Optional scheduling can be done in Supabase with a scheduler such as `pg_cron` if it is enabled for the project:

```sql
select cron.schedule(
  'cleanup-expired-bls-sessions',
  '*/30 * * * *',
  $$select public.cleanup_expired_bls_sessions();$$
);
```

The cleanup deletes expired rows from `public.sessions`.

## Legal And Safety Limits

- No medical advice is provided.
- The software is not a medical device.
- Do not use it for diagnostic decisions, therapeutic decisions, crisis response, or emergency situations.
- No warranty is provided for clinical, professional, health, or operational outcomes.
- The app is free to access and is supplied without professional services, medical services, warranties, or outcome guarantees.

## Quality Checks

```sh
npm run legal:check
npm run typecheck
npm run build
```

`npm run legal:check` scans source and documentation for high-risk affirmative claims such as compliance promises, validation claims, or affiliation wording.

## License

MIT. See [LICENSE](LICENSE).
