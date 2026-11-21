# #8 The budget's stops and limits where the tool measures no spend

Faults of the tool around the budget that the review of task round-rules found. They were first written as weaknesses in [docs/limitations.md](../docs/limitations.md); the owner had them moved here, since that page holds only what the approach does not do by choice (his answer "1021 б" of 2026-11-21), and merged the task with them ("1018 б").

## Slice

IDs: `derived.task-budget`, `derived.budget-report`, `derived.task-next`, `inv.contributions-apart`, `field.task-statement.budget`, `field.task-statement.done-when`.

Checks: `check.task-statement.budget-one-action`, `check.task-statement.budget-report`.

Why now: four cases stop a task, or judge its budget, by something other than its measured spend:
- two records of spend of one contribution whose intervals overlap stop the task with no spend measured, and beside a clean acceptance `NEXT` says done while the check reports the overlap;
- a line of the statement's budget the tool cannot read, such as `Budget-reserve: 1,5`, stops the task as a spent budget does, and no line `REPORT` is printed;
- an approved statement with no line `Done-when:` at the cap: `BUDGET` says the budget is spent while `NEXT` names only the missing command;
- `--rounds`, which takes no statement file, judges the budget by the limits of the approved version's latest record of done, so before the first record of done of a version it uses other limits than `--task` with the file.

## Out of scope

- The rule of the budget itself (D-108, D-152) and its marks.

## Depends on

Nothing.

## Done when

```bash
npm run gap -- issues/0008-budget-stops-without-measured-spend.md   # SLICE_DONE
npm test
```

`SLICE_DONE` means a test of `check.task-statement.budget-one-action` holds for each case: the same next action in `--task`, `--rounds` and `done.mjs`, with the budget line and the action in agreement.
