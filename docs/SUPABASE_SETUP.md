# Supabase Setup

Run [../supabase/schema.sql](../supabase/schema.sql) in the Supabase SQL editor, then configure the frontend with `SUPABASE_URL` and `SUPABASE_ANON_KEY` or the supported `NEXT_PUBLIC_` / `VITE_` aliases.

Supabase stores session rows only: ids, controller/participant tokens, session state, preferences, and timestamps. Joy-Con detection and rumble commands stay in the controller browser and are not stored in Supabase.

The schema includes cleanup drops for the removed browser-device registration flow. Legacy tactile-device persistence objects are removed if they exist.
