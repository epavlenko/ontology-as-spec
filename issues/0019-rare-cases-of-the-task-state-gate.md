# #19 Rare cases of the gate of the task state

Findings of round 1 of the review of the statement of task enforcement-task-state, each a rare history here, filed as `later`:

- class "Per-commit waiver scope": an owner's permission for one commit that changes gate paths outside an approved statement; no task of the goal changes gate paths that way.
- class "Review boundary under `reviews/`": a file under `reviews/` that is not a record of the process, such as a README there, edited after the acceptance of a result.
- class "Work during a withdrawn approval": a commit made after a round withdrew the approval of a statement and before a new version was approved; statements of the goal are revised after approval only for a finding of the usual path.
- class "Records-only publication scope" (round 2): a records-only pull request passes on any record of publication on the base, not only one whose scope covers its records; the only records of publication here are of this goal, so no usual pull request meets another scope.
- class "Statement version verification" (round 2): a fixture where a revised statement is approved while the record of done or the acceptance still names the previous version; statements of the goal are revised after approval only for a finding of the usual path.

## Slice

IDs: `rule.work-under-approval`, `derived.approval`.

Checks: `check.task-statement.changed-after-approval`.

## Depends on

Task enforcement-task-state.
