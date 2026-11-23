# #14 Filing a finding after the reviewed commit blocks the merge

Findings of rounds 23 and 25 of the review of the statement of task enforcement-after-condition, class "filing-only commits still invalidate verdicts", filed as `later`: they concern every round of the review of a result, not only the path after the narrow round.

## Slice

IDs: `rule.reviewed-before-merge`.

Checks: `check.agent-rules.reviewed-before-merge`.

Why now: a rare finding of a round of the review of a result is filed in `docs/limitations.md` or `issues/` in the commit of the round's record, after the commit the reviewer checked. The check that only records follow the reviewed commit refuses that commit, and a verdict whose check read the changed file stops counting by its freshness rule (D-95), so an ordinary clean result with a filed finding cannot be merged as is.

## Out of scope

- The path after the narrow round, which the task enforcement-after-condition covers.

## Depends on

Task enforcement-merge-gate (its check that only records follow the reviewed commit, and the merge-gate concepts it brings, are named here once it is merged).
