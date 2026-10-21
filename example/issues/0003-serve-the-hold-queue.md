# #3 Serve the hold queue: reservation on return and the pickup window

> Example ticket in the shape described in `docs/parts/agent-workflow.md`. Numbers and names are fictional.

## Outcome

When an item comes back and its title has waiting holds, the item is set aside for the member at the head of the queue, who is told it is ready. If they do not check it out within the pickup window, the next member in the queue gets it.

Ontology IDs: `hook.hold-ready`, `hook.hold-expire`, `concept.reservation`, `rule.pickup-window`, `inv.queue-order`, `derived.available`.

## Scope

1. `app/library.mjs`: a reservation on the returned item for the first waiting hold; a reserved item is not available (`derived.available`); checkout of a reserved item only by the member it is reserved for.
2. `app/library.mjs`: expiry after `rule.pickup-window`, evaluated for a given day; the expired hold is closed and the next hold is served.
3. `app/cli.mjs`: `return` prints who the item is reserved for; a `tick` command applies expiry for `--today`.
4. `app/library.test.mjs`: one test per scenario below, titled with its tag.
5. Implementation table rows for the IDs above, removal of the matching line under "Known divergences", a scenario in `features/holds.md`.

## Out of scope

Notifications themselves (the hook records that a notification is due; delivery is a separate ticket). The tentative length of the window (D-05) stays 3 days.

## Scenarios

Expected behavior, one scenario per line, tagged with the IDs it proves. Each becomes a test in `app/library.test.mjs` whose title starts with the same tag.

- [hook.hold-ready, concept.reservation] GIVEN ana waits for Dune and both copies are out WHEN ben returns `dune-1` THEN `dune-1` is reserved for ana until three days later.
- [derived.available] GIVEN `dune-1` is reserved for ana WHEN anyone asks whether it is available THEN it is not, although no loan is open.
- [concept.reservation] GIVEN `dune-1` is reserved for ana WHEN the desk checks it out to ben THEN checkout is refused with "Reserved for ana"; to ana it succeeds and closes her hold.
- [inv.queue-order] GIVEN ana placed her hold before carl WHEN a copy of Dune comes back THEN it is reserved for ana, not carl.
- [hook.hold-expire, rule.pickup-window] GIVEN `dune-1` was reserved for ana on 2026-10-10 and carl waits next WHEN the day 2026-10-14 is processed THEN ana's hold is closed as expired and `dune-1` is reserved for carl.
- [rule.pickup-window] GIVEN `dune-1` was reserved for ana on 2026-10-10 WHEN the day 2026-10-13 is processed THEN the reservation still stands.

## Done when

- [ ] Every scenario above is a test with the same tag, and the tests pass.
- [ ] The implementation table lists the tagged IDs; the matching line under "Known divergences" is gone.
- [ ] `features/holds.md` has a command line scenario for the reservation.

## Proof commands

```bash
node --test 'example/app/*.test.mjs'                                    # the tagged scenarios above
node tools/ont-check/ont-check.mjs --config example/ont.config.json      # prints ONT_OK
```

## Pre-authorized

- commit: allowed on the task branch
- PR: not yet
