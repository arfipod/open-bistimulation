# QA Checklist

## Automated release gate

```sh
npm test
npm run typecheck
npm run legal:check
npm run build
npm run stress -- http --base-url http://127.0.0.1:5173/ --requests 200 --concurrency 20
```

Run the protocol-aware Realtime stress scenario against a disposable project only after deploying the current schema; see [STRESS_TEST.md](STRESS_TEST.md).

## Manual product gate

- Verify landing, legal, controller, participant, audio gate, ended, and error views in English and Spanish.
- Check keyboard order, visible focus, switch/selection names, alerts, dialogs, 200% zoom, and 320px layout.
- Confirm participant visual/audio/tactile output is off before Start and after Pause, Stop, expiry, disconnect, clock/heartbeat failure, local stop, and End.
- Confirm Stop preempts settings activity and End succeeds even when Realtime notification fails.
- Confirm a blank timer does not select Free and a chosen idle timer survives more than one poll interval.
- Enable audio during fullscreen and confirm output stops until the participant unlocks it.
- Test both Joy-Cons, then simulate a command failure and confirm both sides neutralize with no asymmetric retry.
- Verify invitation tokens remain in URL fragments and are absent from copied request/referrer logs.

