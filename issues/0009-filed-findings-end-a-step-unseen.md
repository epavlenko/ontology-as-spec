# #9 A round without a confirmed condition can end a step with filed findings only, unseen by a reviewer

A finding filed as `limitation` or `later` does not make its round unclean (`rule.findings-filed`). So a round of the review of the result whose findings the executor has all filed, with a clean verdict of acceptance, ends the step even when it gives no line `Condition: holds`: the filings were made in the commit of the round's record, after the reviewer's reply, and no reviewer reads them before the merge. This is the behaviour of D-152, kept by D-153, whose statement left it out of scope for later.

## Slice

IDs: `rule.findings-filed`, `rule.executor-triage`, `derived.next-round`.

Checks: `check.review-round.filed`, `check.review-round.filed-right`.

Why now: the executor's triage of D-153 files more findings than before, so a step that ends on filed findings alone, read by no reviewer, is more frequent.

## Out of scope

- The branch condition confirmed of `derived.next-round` and its gate (D-153).
- Tickets #7 "A record of done made again after a clean acceptance reopens the step" and #8 "The budget's stops and limits where the tool measures no spend".

## Depends on

Nothing open.

## Done when

```bash
npm run gap -- issues/0009-filed-findings-end-a-step-unseen.md   # SLICE_DONE
npm test
```

`SLICE_DONE` means a test of `check.review-round.filed` holds: a round of the result whose only findings of the change are filed, with no confirmed condition, does not end the step until a reviewer has read the filings, or the rule says why it may. The check `check.review-round.filed` already holds today, so `SLICE_DONE` alone proves nothing: this slice is done only with a new test of the behaviour above, tagged with that check.

## Pre-authorized

- commit: allowed on the task branch
- PR: not yet
- browser verification: not needed
