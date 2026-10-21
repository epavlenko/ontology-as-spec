# #<n> <Title that says what changes for the user>

## Outcome

What changes for the user, in two or three sentences.

Ontology IDs: `action.close`, `inv.closed-is-final`.

## Scope

1. File-level, numbered.

## Out of scope

What a helpful agent would otherwise add.

## Scenarios

Expected behavior, one line each, tagged with the IDs it proves. Each becomes a test whose title starts with the same tag. The check requires at least one, an ID tag and GIVEN … WHEN … THEN on every line, and tags from the `IDs:` line only.

- [action.close] GIVEN an open thing WHEN its owner closes it THEN its state is closed.
- [inv.closed-is-final] GIVEN a closed thing WHEN anyone tries to reopen it THEN the request is refused with the reason.

## Done when

- [ ] Every scenario above is a test with the same tag, and the tests pass.
- [ ] Other observable acceptance criteria.
- [ ] The ontology, the implementation table and the verification map agree.

## Proof commands

Per-file commands that must all pass. This block is the finish condition.

```bash
<test command for the files touched>
node tools/ont-check/ont-check.mjs --config <path>/ont.config.json
```

## Pre-authorized

Permissions the agent may otherwise stop and ask for. A missing line means the repository default.

- commit: allowed on the task branch
- PR: not yet
- browser verification: not needed
