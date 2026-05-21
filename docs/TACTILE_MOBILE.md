# Tactile Output

Tactile output no longer uses participant-device registration, Supabase tactile-device storage, or Supabase Realtime pulse messages.

Current tactile output is driven directly from the controller browser through WebHID. Pair both Joy-Cons in the operating system Bluetooth settings, open the controller page, then use `Add Joy-Cons` in the tactile panel and select each controller from the browser device prompt.

Joy-Con detection and rumble commands remain local to the controller browser. Supabase Realtime remains responsible for session state and participant readiness only.

WebHID requires a secure browser context, so the deployed HTTPS app and local development on `localhost` are the intended entry points. The old local bridge remains in `scripts/` for CLI diagnostics, but it is no longer required by the app.
