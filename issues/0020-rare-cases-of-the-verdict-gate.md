# #20 Rare cases of the gate of verdicts and tests

Findings of the review of the statement of task enforcement-verdicts-tests, each a rare history here, filed as `later`:

- class "Required end-to-end suite can disappear" (statement round 3): a change of the example's configuration that drops its end-to-end suite while a unit suite still covers the same classes passes the coverage of classes; no change in this repository moves the example's actions and views from its end-to-end suite to its unit suite.

## Slice

IDs: `inv.suite-covers-classes`.

Checks: `check.test-suite.uncovered-concept`.

## Depends on

Task enforcement-verdicts-tests.
