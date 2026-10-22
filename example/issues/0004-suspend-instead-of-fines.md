# #4 Suspend borrowing instead of fines

> Example ticket in the shape described in `docs/parts/agent-workflow.md`, like #3 Serve the hold queue: reservation on return and the pickup window. Numbers and names are fictional.

## Slice

IDs: `inv.suspended-cannot-borrow`, `concept.suspension`.

Checks: `check.member.suspended-cannot-borrow`, `check.member.suspended-cannot-hold`.

Why now: the code still adds fines that D-03 abolished, and a member with an overdue loan can still borrow. Both contradict the target, so both close in one slice: removing the fines without the suspension would leave nothing that brings overdue items back.

## Out of scope

- Showing the suspension on the member's screens; `view.member.loans` stays as it is.
- Any grace period. D-03 says the suspension starts the moment a loan is overdue.

## Depends on

Nothing open.

## Done when

```bash
node tools/ont-check/ont-check.mjs --config example/ont.config.json --gap example/issues/0004-suspend-instead-of-fines.md   # SLICE_DONE
node --test 'example/app/*.test.mjs' 'example/e2e/*.test.mjs'
```

## Pre-authorized

- commit: allowed on the task branch
- PR: not yet
