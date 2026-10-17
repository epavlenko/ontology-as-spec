# #3 Serve the hold queue: reservation on return and the pickup window

> Example ticket in the shape described in `docs/parts/agent-workflow.md`. Numbers and names are fictional.

## Outcome

When an item comes back and its title has waiting holds, the item is set aside for the member at the head of the queue, who is told it is ready. If they do not check it out within the pickup window, the next member in the queue gets it.

Ontology IDs: `hook.hold-ready`, `hook.hold-expire`, `concept.reservation`, `rule.pickup-window`, `inv.queue-order`, `derived.available`.

## Scope

1. `app/library.mjs`: a reservation on the returned item for the first waiting hold; a reserved item is not available (`derived.available`); checkout of a reserved item only by the member it is reserved for.
2. `app/library.mjs`: expiry after `rule.pickup-window`, evaluated for a given day; the expired hold is closed and the next hold is served.
3. `app/cli.mjs`: `return` prints who the item is reserved for; a `tick` command applies expiry for `--today`.
4. Implementation table rows for the IDs above, removal of the matching line under "Known divergences", a scenario in `features/holds.md`.

## Out of scope

Notifications themselves (the hook records that a notification is due; delivery is a separate ticket). The tentative length of the window (D-05) stays 3 days.

## Done when

- [ ] A returned item of a held title is reserved for the head of the queue and refused to anyone else.
- [ ] After the window passes, the reservation moves to the next hold in placement order.
- [ ] The ontology, the implementation table and the verification map agree.

## Proof commands

```bash
node --test 'example/app/*.test.mjs'                                    # new cases: reserve on return, refuse others, expiry passes it on
node tools/ont-check/ont-check.mjs --config example/ont.config.json      # prints ONT_OK
```

## Pre-authorized

- commit: allowed on the task branch
- PR: not yet
