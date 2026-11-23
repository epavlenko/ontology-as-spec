# #13 A project's check on a view is not listed when the view's file changes under another concept

A finding of round 12 of the review of the statement of task enforcement-review-run, class "desk copy edit skips its run", filed as `later`: it was there before that change, for manual checks as for runs.

## Slice

IDs: `derived.review-checks`, `rule.reviewed-before-merge`.

Checks: `check.agent-rules.reviewed-before-merge`.

Why now: `--review` selects a project's checks by the concepts a changed line names. In the example, the refusal message on the desk view names `inv.suspended-cannot-borrow`, while the check that the refusal is understandable names `view.desk` and `action.checkout`, so an edit of the message does not list that check. The bundled checks of the approach are selected by the kind of the changed file as well; a project's checks are not.

## Out of scope

- The selection of the approach's own bundled checks, which already follows the kind of file.

## Depends on

Task enforcement-review-run.
