# #15 Gate-change records attribute shared files to items by hand

A finding of round 5 of the review of the result of task enforcement-merge-gate, class "shared-file attribution process unchanged after stagnation", filed as `later`: until the task enforcement-tool-records brings the writer of gate records, the executor writes the records of a gate change by hand, one per item of What to do, and decides which items allow a change of a file that several items touch; the reviewer of the result checks that attribution.

## Slice

IDs: `inv.gate-change-approved`, `field.gate-change.item`, `field.gate-change.paths`.

Checks: `check.merge-gate.gate-change-bound`.

Why now: the guard holds the binding of a record to the last commit outside `reviews/` and to the approved version, but not whether every item that allows a change of a shared file is named; a missing item is found only by the reviewer. The writer of task enforcement-tool-records, `gate-record.mjs change --clause N --paths`, writes the records from what the executor names and refuses a path the diff does not change; it is the place to take the attribution from the approved statement instead of the executor's judgement.

## Out of scope

- The binding of a record to its commit, which the guard already holds.

## Depends on

Task enforcement-tool-records.
