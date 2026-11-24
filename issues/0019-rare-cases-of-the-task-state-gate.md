# #19 Rare cases of the gate of the task state

Findings of round 1 of the review of the statement of task enforcement-task-state, each a rare history here, filed as `later`:

- class "Per-commit waiver scope": an owner's permission for one commit that changes gate paths outside an approved statement; no task of the goal changes gate paths that way.
- class "Review boundary under `reviews/`": a file under `reviews/` that is not a record of the process, such as a README there, edited after the acceptance of a result.
- class "Work during a withdrawn approval": a commit made after a round withdrew the approval of a statement and before a new version was approved; statements of the goal are revised after approval only for a finding of the usual path.
- class "Records-only publication scope" (round 2): a records-only pull request passes on any record of publication on the base, not only one whose scope covers its records; the only records of publication here are of this goal, so no usual pull request meets another scope.
- class "Statement version verification" (round 2): a fixture where a revised statement is approved while the record of done or the acceptance still names the previous version; statements of the goal are revised after approval only for a finding of the usual path.
- class "Early-work exemption by filename" (result round 1): the guard does not count as work before approval a commit whose non-record files are named by a filed finding of a statement round of the task, whatever else that commit changes in them; the commits of statement rounds here change only the ticket that files the finding (`tools/ont-check/merge-gate.mjs` around 434).
- class "Incomplete rules read" (result round 1): a null list of excluded refs read from GitHub is taken as the empty list the rule file names (`tools/ont-check/merge-gate.mjs` around 669 and 689); GitHub gives the list as an array here.
- class "Scope validation by substring" (result round 1): `approve.mjs --kind publish` accepts a question whose text holds the scope as a part of a longer name (`tools/ont-check/approve.mjs` around 50); the guard compares scopes whole.
- class "Reviewer brief includes executor conclusions" (result round 1): the brief of the round listed the implementing agent's choices for the reviewer to judge; later briefs name the change and the statement only.

## Slice

IDs: `rule.work-under-approval`, `derived.approval`.

Checks: `check.task-statement.changed-after-approval`.

## Depends on

Task enforcement-task-state.
