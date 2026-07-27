# Tactile Output

Tactile output no longer uses participant-device registration, Supabase tactile-device storage, or Supabase Realtime pulse messages.

Current tactile output is driven directly from the participant browser through WebHID. Pair both Joy-Cons in the participant computer's Bluetooth settings, open the participant link, then use `Add Joy-Cons` in its tactile panel and select each controller from the browser device prompt.

Joy-Con detection and rumble commands remain local to the participant browser. The Supabase row remains authoritative for session state and controller heartbeat; Realtime provides invalidation and presence hints.

WebHID requires a secure browser context, so the deployed HTTPS app and local development on `localhost` are the intended entry points. The old local bridge remains in `scripts/` for CLI diagnostics, but it is no longer required by the app.
