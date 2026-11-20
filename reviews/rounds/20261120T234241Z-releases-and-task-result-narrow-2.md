Task: releases-and-task
Step: result-review
Narrow: true
Number: 2
Time: 2026-11-20T23:42:41Z
Commits: 8b9cde9ff6f24a1171f9323dd91246b93fe6adf7..361b7552c13a5320e7d00b80830cfbf0d2dd4915
By: gpt-6.2-sol (OpenAI, Codex)
Statement-hash: ced247ff58f273c0640aea217775d5feb1c2006fd37907ff89150bc98573236c
Checks-listed: 33
Checks-given: 33
Checks-carried: 0
Findings:
- budget stop at the end of a step · important · change · fixable · check.task-statement.reserve-of-statement
- budget stop at the end of a step · important · change · fixable · check.task-statement.overspend-computed
- budget stop at the end of a step · nit · change · fixable · check.task-statement.budget-one-action

Acceptance:
- budget stop at the end of a step · important · change · fixable · check.task-statement.reserve-of-statement
- budget stop at the end of a step · important · change · fixable · check.task-statement.overspend-computed

## Verdicts

Merge verdict: fix first. Acceptance of statement version 9: refused. Claude Opus 5.5 (Anthropic) co-authored the fixes, per the fix commit. The review covers the two fixes and regressions in the lines they changed.

## Narrow round 1 findings

1. The original boundary case is fixed. A limit of 3,000,000 with reserve 1.1 stops at 3,300,000. The passing test for `check.task-statement.reserve-of-statement` asserts both the cap and exhaustion at equality (tools/ont-check/tasks.mjs:298, tools/ont-check/tasks.mjs:326, tools/ont-check/test/tasks.test.mjs:938). Findings 1 and 2 below concern the new arithmetic.
2. The original comma case is fixed. With an approved `Budget-reserve: 1,5`, the task CLI withholds permission and the done CLI exits with the invalid-line error and leaves the record count unchanged. The passing tests are `check.task-statement.reserve-of-statement` and `check.task-result.done-recorded` (tools/ont-check/tasks.mjs:390, tools/ont-check/done.mjs:33, tools/ont-check/test/tasks.test.mjs:542, tools/ont-check/test/tasks.test.mjs:944). Finding 3 concerns the stop message after a prior round.

Both tagged tests pass on the reviewed code and fail with the original implementations restored in a temporary clone. The runs are in the reviewer's log, kept outside the repository.

## Findings in the changed lines

1. **budget stop at the end of a step, important.** The fraction's numerator is computed using floating point before conversion to `BigInt`. With a limit of 3,000,000, reserve `1.9300000000000002` and spend of 5,790,000, the decimal cap is 5,790,000.0000000006. The fix substitutes a numerator of 19,300,000,000,000,000 for 19,300,000,000,000,002. The task CLI then reports exhaustion and blocks round 2, which the base allowed. This breaks the boundary under `rule.budget-before-next` and the exact arithmetic in the tentative reserve decision (tools/ont-check/tasks.mjs:300, tools/ont-check/tasks.mjs:328, decisions.md:1361). Likelihood is very low. This needs a high-precision reserve and spend on the affected whole-token boundary.
2. **budget stop at the end of a step, important.** The cap's new rendering can invalidate a previously accepted record. A final acceptance at 3,300,001 new input with reserve 1.1 passed the base with `Overspend: new input 3300001 of 3300000.0000000005, output 0 of 1650000.0000000002`. The same unedited record fails the validator after the fix, which now expects caps of 3,300,000 and 1,650,000. The validator compares the stored line as exact text (tools/ont-check/tasks.mjs:301, tools/ont-check/tasks.mjs:363, tools/ont-check/ont-check.mjs:1374). Likelihood is low. It needs a retained final acceptance with overspend and a reserve whose rendered cap changes. The branch's existing review records contain no such overspend line.
3. **budget stop at the end of a step, nit.** With `Budget-reserve: 1,5`, an approved statement, a prior result round with findings, and 100,000 tokens spent, the statement status gives the unreadable-budget reason, the result status falsely says the budget is exhausted, and the budget status still shows spend below the fallback cap. The unreadable flag takes the exhaustion path in the round chooser (tools/ont-check/tasks.mjs:390, tools/ont-check/tasks.mjs:416, tools/ont-check/review-rounds.mjs:161). The CLI correctly exits 1 and offers no next round. Likelihood is low. A decimal comma is a plausible input mistake, and this contradictory status additionally needs a prior round and an invalid version that is in force.

The boundary, final acceptance and malformed-input paths were compared on the base and reviewed implementation in temporary clones. Details are in the reviewer's log, kept outside the repository.

## Acceptance against the approved version

- Version 9's digest matches the approval and the later record of done. The approval records the owner's authorization for the thread to finish the approved goal and set the number of rounds. The reserve line restates the approved 4,500,000 and 2,250,000 caps. The round ends at the checked commit named by the record of done (reviews/tasks/20261120T232434Z-releases-and-task-approval.md:3, reviews/tasks/20261120T233718Z-releases-and-task-done.md:3).
- Protocol releases and notices, product releases and deployments, statement approval and its review, and the acceptance binding retain the earlier review evidence. The narrow fixes affect budget handling. The documentation coverage and machine-rule transition also retain the earlier evidence. That evidence verified the transition references and the note for the coordinating thread. Delivery of that note was unverified.
- The version 9 task command reports the approved hash, the record of done with checks passed, and the expected caps of 4,500,000 new input and 2,250,000 output. It exits successfully and selects narrow round 2. Spend is recorded for 0 of 12 contributions, so the remaining spend allowance cannot be confirmed from these records.
- All three Done-when commands pass on the reviewed commit. `npm test` reports 361 passed, five skipped and zero failures. `node tools/ont-check/ont-check.mjs --config ont.config.json` and `node tools/ont-check/ont-check.mjs --config example/ont.config.json` both report `ONT_OK`. The version 9 `--task releases-and-task --statement` run includes the subsequent record of done and also reports `ONT_OK`. The outputs are in the reviewer's log, kept outside the repository.
- The result misses the requirement to decide whether a next round is permitted at the correct budget boundary. It also breaks validation of an existing clean final acceptance that named its overspend in the tool's previously required form. These are findings 1 and 2 above.
