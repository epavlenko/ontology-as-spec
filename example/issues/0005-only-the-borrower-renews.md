# #5 Only the borrower renews a loan

> Example ticket in the shape described in `docs/parts/agent-workflow.md`, like #3 Serve the hold queue: reservation on return and the pickup window. Numbers and names are fictional.

## Slice

IDs: `inv.borrower-renews`.

Checks: `check.loan.renew-only-borrower`.

Why now: renewal does not know who renews, so any member can move the due date of another member's loan. The code compared with the oracle meets this on every run.

## Out of scope

- Who acts at the desk: `action.checkout` and `action.return` stay staff actions, as they are.
- The screens; `view.member.loans` already shows only the member's own loans.

## Depends on

Nothing open.

## Done when

```bash
node tools/ont-check/ont-check.mjs --config example/ont.config.json --gap example/issues/0005-only-the-borrower-renews.md   # SLICE_DONE
node --test 'example/app/*.test.mjs' 'example/e2e/*.test.mjs'
```

`SLICE_DONE` means `inv.borrower-renews` is in the implementation table, its automatic check has a test, and the Loan line under known divergences is gone.

## Pre-authorized

- commit: allowed on the task branch
- PR: not yet
