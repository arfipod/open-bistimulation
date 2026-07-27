# Roadmap

## Next production-hardening work

- Move public session creation behind server-side rate limiting and bot protection.
- Add authenticated ownership and private Realtime authorization for multi-tenant use.
- Make scheduled retention observable with alerts for failed cleanup jobs.
- Add browser-level end-to-end tests for two controllers, reconnects, fullscreen audio changes, and real Realtime packet loss.
- Add supported-device/manual hardware qualification notes for Joy-Con variants and operating systems.
- Split the production bundle by route if controller-only dependencies continue to grow.

## Explicitly outside the current product

Accounts, clinical records, billing, analytics, audit reporting, background output, and guaranteed hardware/browser compatibility remain non-goals unless the product definition is deliberately revised.

