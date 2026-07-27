# Supabase Setup

Run [../supabase/schema.sql](../supabase/schema.sql) in the Supabase SQL editor, then configure the frontend with `SUPABASE_URL` and `SUPABASE_ANON_KEY` or the supported `NEXT_PUBLIC_` / `VITE_` aliases.

Supabase stores session rows only: ids, controller/participant tokens, session state, preferences, and operational timestamps, including the controller-token heartbeat used to fail participant output closed. Joy-Con detection and rumble commands stay in the participant browser and are not stored in Supabase.

Re-run the complete schema after updating an existing deployment. It installs the four-argument compare-and-swap state RPC, controller heartbeat, token-filtered reads, atomic session ending, explicit function grants, and cleanup function.

The schema includes cleanup drops for the removed browser-device registration flow. Legacy tactile-device persistence objects are removed if they exist.
