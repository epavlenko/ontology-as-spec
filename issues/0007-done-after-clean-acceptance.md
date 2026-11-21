# #7 A record of done made again after a clean acceptance reopens the step

A fault of the tool that round 16 of the review of task round-rules found and the owner chose to merge with, in his answers "1018 б" and "1021 б" of 2026-11-21.

## Slice

IDs: `derived.task-next`, `inv.acceptance-after-done`.

Checks: `check.task-statement.budget-one-action`, `check.task-result.latest-done`.

Why now: below the budget's cap, `--task` and `--rounds` give a task whose result was accepted clean as done, but `done.mjs` asks for new work, where the branch of done does not apply, and takes "the step ended clean" for work. So running `done.mjs` again on the same commit writes a newer record of done; the acceptance no longer holds for the latest record, and the task asks for another round of review. No acceptance is taken for one it is not, but a round is spent for nothing.

## Out of scope

- Any other kind of the next action.

## Depends on

Nothing.

## Done when

```bash
npm run gap -- issues/0007-done-after-clean-acceptance.md   # SLICE_DONE
npm test
```

`SLICE_DONE` means a test of `check.task-result.latest-done` holds: after a clean acceptance below the cap, `done.mjs` refuses with the action `--task` gives, the task is done, and the record of done and its acceptance stay as they were.
