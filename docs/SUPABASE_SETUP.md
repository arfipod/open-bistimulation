# Supabase Setup

Run [../supabase/schema.sql](../supabase/schema.sql) in the Supabase SQL editor, then configure the frontend with `SUPABASE_URL` and `SUPABASE_ANON_KEY` or the supported `NEXT_PUBLIC_` / `VITE_` aliases.

Supabase stores session rows only: ids, controller/participant tokens, session state, preferences, and timestamps. Joy-Con detection, local bridge status, battery details, and rumble commands stay on the controller computer and are not stored in Supabase.

The schema includes cleanup drops for the removed mobile tactile-device registration flow: `public.upsert_tactile_device` and `public.tactile_devices` are removed if they exist.
