# Tactile Output

Tactile output no longer uses mobile participant routes, browser-device registration, Supabase tactile-device storage, or Supabase Realtime pulse messages.

Current tactile output is driven from the controller browser through the local Joy-Con bridge. Joy-Con detection, battery status, bridge status, and rumble commands remain local to the controller computer. Supabase Realtime remains responsible for session state and participant readiness only.
