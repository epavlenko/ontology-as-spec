# #20 Rare cases of the gate of verdicts and tests

Findings of the review of the statement of task enforcement-verdicts-tests, each a rare history here, filed as `later`:

- class "Required end-to-end suite can disappear" (statement round 3): a change of the example's configuration that drops its end-to-end suite while a unit suite still covers the same classes passes the coverage of classes; no change in this repository moves the example's actions and views from its end-to-end suite to its unit suite.
- class "Template end-to-end work deferred" (statement round 5, the first reply, which was not recorded: its session held no brief the count reads, issue #21): an adopter who removes the templates' end-to-end suite while setting up, and adds no other suite, leaves the first implemented action covered by no suite; the templates ship the suite, and removing it is a departure from their setup, like the case above.
- class "Release run debt loses merged deferrals" (statement round 5, both replies): a reasoned `not-run` of a check of run, then a tested fix after the narrow round that changes that same check's stamp, then the merge: the release reader drops the deferral at the new stamp; it needs a deferral and a fix of the same check inside one range of fixes.
- class "Verdict probe depends on the task ending" (statement round 5): a round for the verdict of acceptance alone after a narrow round with findings drops the range of fixes; such a round is briefed only when the reviewer's reply of the narrow round gave no line of acceptance or refused it, and no reply of a round here has done so.
- class "Cause verdict is bound only by time" (statement round 5): a verdict on `check.review-round.redesign-after-stagnation` recorded after the brief's time by another review stands for this analysis; it needs two reviews of that check of one task in the same window.
- class "Verdict base is unchecked outside the narrow issue" (statement round 6): a review of a smaller diff than the task's, recorded as `Origin: review` on the same result commit with the same stamp, satisfies the gate of the whole diff; outside the narrow issue, which binds its base, the process here gives the reviewer of the result the whole diff.
- class "Malformed catalogue row has no valid mark" (statement round 6): filed here by mistake and returned to the statement by round 7. The reason given, that the formatter sees the row, was wrong: the formatter reads the ontology, not `checks.md`, and the case is an audit row this task closes.
- class "Malformed catalogue row has no valid mark" (statement round 8): a new row of `checks.md` whose ID has its opening backtick and lacks the closing one is still skipped without an error by the check version 8 of the statement specifies; it needs that one typo, which the reviewer of the result reads in the diff.

## Slice

IDs: `inv.suite-covers-classes`.

Checks: `check.test-suite.uncovered-concept`.

## Depends on

Task enforcement-verdicts-tests.
