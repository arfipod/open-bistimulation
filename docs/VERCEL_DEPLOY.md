# Vercel Deploy

1. Create or select a Supabase project.
2. Run the complete current [schema](../supabase/schema.sql) in the SQL editor.
3. Schedule `cleanup_expired_bls_sessions()` and configure production creation rate limiting/bot protection.
4. Set one supported public variable pair in Vercel:

```txt
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the documented `VITE_` aliases are also accepted. Do not add a service-role key to the frontend.

5. Deploy with the repository build command (`npm run build`) and output directory (`dist`).
6. Confirm the SPA rewrite and security headers from `vercel.json`.
7. Run the automated and manual gates in [QA_CHECKLIST.md](QA_CHECKLIST.md), then create and end a disposable live session.

Re-run the schema whenever RPC signatures change. A frontend using the current CAS, heartbeat, atomic-stop, or atomic-end protocol will not operate correctly against an older schema.

