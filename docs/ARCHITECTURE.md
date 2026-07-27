# Architecture

Open Bistimulation is a static React/Vite browser app backed by token-checked Supabase RPCs and Realtime.

## Authority flow

1. `create_bls_session` creates separate controller and participant bearer tokens.
2. Each route validates its token through `get_bls_session` before joining a token-scoped Realtime topic.
3. The session row is durable authority. Realtime state/end messages are invalidation hints; both roles refetch and poll the row.
4. Normal controller writes use a monotonically versioned compare-and-swap RPC.
5. Stop and end use preemptive atomic RPCs so queued settings writes or failed broadcasts cannot delay the safety action.
6. A therapist-token heartbeat is refreshed every five seconds. Participant output requires a recent heartbeat, verified server clock, fresh row read, Realtime connection/presence, and an active unexpired state.

## Browser output

- Visual output renders in the participant tab only while running or during an intentional stopping transition.
- Web Audio output requires a direct participant gesture and is neutralized on every suppression condition.
- Optional Joy-Con output stays in the participant browser through WebHID. Commands are serialized, cancellation-aware, and fault-latched.
- Preview mode is an observer: it does not claim participant presence or operate audio/tactile hardware.

See [PRODUCT.md](../PRODUCT.md) for product invariants and [DESIGN.md](../DESIGN.md) for interface rules.

