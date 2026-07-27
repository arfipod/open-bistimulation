# Security

## Implemented controls

- Controller and participant links use separate random bearer tokens stored in URL fragments.
- Direct table access is denied and revoked. Only selected fixed-search-path RPCs are executable by browser roles.
- State writes use server-enforced version compare-and-swap; malformed server payloads are rejected in the browser.
- Stop and end are atomic therapist-token RPCs. Broadcast failure cannot prevent the durable action.
- Realtime payloads never directly activate participant output. A fresh database read and therapist-token heartbeat are required.
- Session creation clamps expiry, bounds input JSON size, validates basic state shape, and opportunistically removes expired rows.
- Deployment headers suppress referrer leakage and MIME sniffing.

## Operational requirements

- Treat invitation URLs as secrets and keep them out of logs, analytics, screenshots, and public messages.
- Use HTTPS and ship only the public Supabase key. Never expose service-role or database credentials.
- Schedule `cleanup_expired_bls_sessions()` and verify it runs; opportunistic cleanup is defense in depth, not a retention scheduler.
- Put production session creation behind rate limiting, bot protection, or authenticated ownership. The public anon key cannot provide per-user abuse control by itself.
- Public token-scoped Realtime is an acceleration channel, not an authorization boundary. A participant-token holder can create nuisance presence/invalidation traffic for that session, but cannot create a fresh therapist heartbeat or authoritative running state.
- Review Supabase/Vercel logs and quotas without logging bearer URLs.

For a stronger multi-tenant deployment, use authenticated users, private Realtime channels with `realtime.messages` policies, server-side creation controls, and audited retention jobs.

