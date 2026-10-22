# #<n> <Title that says what changes for the user>

A slice of the gap between the target and the implementation. What the slice means is already in the ontology and the checks; the ticket says which part to build now and within which limits. `ont-check.mjs --gap` lists the gap to cut slices from.

## Slice

IDs: `action.close`, `inv.closed-is-final`.

Checks: `check.thing.close`, `check.thing.stays-closed`.

Why now: one sentence on why this slice comes before the rest of the gap.

## Out of scope

What a helpful agent would otherwise add, including target concepts left for later slices.

## Depends on

Slices that must be done first, or "Nothing open".

## Done when

```bash
node tools/ont-check/ont-check.mjs --config <path>/ont.config.json --gap <path>/issues/<this ticket>.md   # SLICE_DONE
<test command>
```

## Pre-authorized

Permissions the agent may otherwise stop and ask for. A missing line means the repository default.

- commit: allowed on the task branch
- PR: not yet
- browser verification: not needed
