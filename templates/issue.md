# #<n> <Title that says what changes for the user>

## Outcome

What changes for the user, in two or three sentences.

Ontology IDs: `<id>`, `<id>`.

## Scope

1. File-level, numbered.

## Out of scope

What a helpful agent would otherwise add.

## Done when

- [ ] Observable acceptance criteria.
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
