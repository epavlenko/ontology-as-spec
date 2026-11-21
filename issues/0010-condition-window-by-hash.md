# #10 A confirmed condition is grouped by hash across approval windows

A fault of the tool the first round of the review of the result of task triage-rules found, filed as `later` under the owner's answers "1020 b" and "1021 b" of 2026-11-21: approval window reused by hash.

## Slice

IDs: `field.review-round.condition`, `derived.next-round`.

Checks: `check.review-round.condition-gate`.

Why now: after an approval history A, then B, then A again (a reviewer-approved return to the exact text of an earlier version), the rounds of the review of the result are grouped by the version's hash across approval windows. The first `Condition: holds` of the new window is then read as the follow-up of the old window's confirming round, and a false owner gate opens. The case needs a return to a byte-identical earlier statement, so it is rare; it never accepts a result that should not be accepted, it only asks the owner once too often.

## Out of scope

- Any other reading of approval windows.

## Depends on

Nothing.

## Done when

```bash
npm run gap -- issues/0010-condition-window-by-hash.md   # SLICE_DONE
npm test
```

Its check already passes today, so `SLICE_DONE` proves nothing on its own; the slice is done only with a new test of the behaviour: a test of `check.review-round.condition-gate` that holds: after the history A, B, A, the first confirming round of the new window of A is its own C, and no owner gate opens.
