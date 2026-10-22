# #3 Serve the hold queue: reservation on return and the pickup window

> Example ticket in the shape described in `docs/parts/agent-workflow.md`: a slice of the gap between the target and the implementation. What the slice means is in the ontology and the checks; the ticket says only which part to build now and within which limits. Numbers and names are fictional.

## Slice

IDs: `hook.hold-ready`, `hook.hold-expire`, `concept.reservation`, `rule.pickup-window`, `inv.queue-order`, `derived.available`.

Checks: `check.hold.reserve-on-return`, `check.hold.reserved-not-available`, `check.hold.reserved-for-holder-only`, `check.hold.served-in-order`, `check.hold.window-still-open`, `check.hold.expiry-passes-on`.

Why now: a returned item goes to whoever comes first, ahead of the members waiting for it. This is the one divergence members notice.

## Out of scope

- Delivering notifications. `hook.hold-ready` records that one is due; sending it is a separate slice.
- `action.cancel-hold` and the screens, although they are target too.
- The length of the pickup window: D-05 keeps it tentative at 3 days.

## Depends on

Nothing open.

## Done when

```bash
node tools/ont-check/ont-check.mjs --config example/ont.config.json --gap example/issues/0003-serve-the-hold-queue.md   # SLICE_DONE
node --test 'example/app/*.test.mjs' 'example/e2e/*.test.mjs'
```

`SLICE_DONE` means every ID of the slice is in the implementation table and every automatic check of the slice has a test. The tests passing means those checks hold.

## Pre-authorized

- commit: allowed on the task branch
- PR: not yet
