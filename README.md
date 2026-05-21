# Open Bistimulation

Open Bistimulation is an independent MVP for browser-based bilateral sensory cues. BLS in this project means configurable left/right visual, auditory, and optional tactile browser cues coordinated by a controller for a participant.

This project is experimental software. It is not medical advice, not a medical device, not for diagnostic or therapeutic decisions, and not for emergencies. Qualified professionals and operators remain responsible for deciding whether and how to use it in their own context.

Open Bistimulation is not affiliated with, endorsed by, sponsored by, or connected to bilateralstimulation.io or BLS GmbH.

## Features

- Controller page for cue settings, timing, session status, and participant invitation links.
- Participant page for visual and audio cues.
- Optional tactile pairing with two browser devices using QR codes and the Vibration API where supported.
- English and Spanish UI copy.
- Supabase RPC and Realtime backend with RLS denying direct anon table access.

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

## Supabase Setup

1. Open Supabase Dashboard > SQL Editor.
2. Run [supabase/schema.sql](supabase/schema.sql).
3. Confirm Realtime is enabled for the project.
4. Use the app to create a session from `/`.

The schema creates:

- `public.sessions`
- `public.tactile_devices`
- RPC functions for creating sessions, loading sessions, saving controller state/preferences, ending sessions, registering tactile devices, and reading server time.
- RLS policies that deny direct table access from anon/authenticated roles. The app uses `SECURITY DEFINER` RPC functions instead.

## Data And Retention

Supabase stores the minimum operational data needed for the MVP:

- Session id
- Controller and participant tokens
- Session state
- Preferences
- Tactile device metadata
- Timestamps such as creation, update, expiry, end time, and last-seen values

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

The cleanup deletes expired rows from `public.sessions`; linked tactile device rows are removed by `on delete cascade`.

## Legal And Safety Limits

- No medical advice is provided.
- The software is not a medical device.
- Do not use it for diagnostic decisions, therapeutic decisions, crisis response, or emergency situations.
- No warranty is provided for clinical, professional, health, or operational outcomes.
- Optional tips support independent development and maintenance only. They do not buy access, professional services, medical services, warranties, or outcome guarantees.

## Support Development And Payment Wording

- The app is free to access.
- Optional tips support independent development and maintenance.
- Tips do not buy access, professional services, medical services, warranties, or outcome guarantees.
- Charity-style payment wording should be avoided unless the project is run by a registered charity or non-profit.
- Preferred wording: optional tip, leave a tip, support development.

## Quality Checks

```sh
npm run legal:check
npm run typecheck
npm run build
```

`npm run legal:check` scans source and documentation for high-risk affirmative claims such as compliance promises, validation claims, or affiliation wording.

## License

MIT. See [LICENSE](LICENSE).
