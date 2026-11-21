Task: releases-and-task
Step: result-review
Narrow: true
Number: 1
Time: 2026-11-20T23:30:00Z
Commits: ae64c6c..b8e05ce8f2f0b139055f2b3ee56274d3ce424186
By: gpt-6.2-sol (OpenAI, Codex)
Statement-hash: ced247ff58f273c0640aea217775d5feb1c2006fd37907ff89150bc98573236c
Checks-listed: 52
Checks-given: 52
Checks-carried: 0
Findings:
- budget stop at the end of a step · important · change · fixable · check.task-statement.reserve-of-statement

Acceptance:
- budget stop at the end of a step · important · change · fixable · check.task-statement.reserve-of-statement

## Narrow round and acceptance of version 9

The merge verdict is fix first. Acceptance of version 9: not accepted. The author of the fixes is given as Claude Opus 5.5 (Anthropic) in the commit metadata. The review is limited to three fixes and the lines they touch.

The SHA-256 of the version 9 file matches the approval record and the done record. The approval precedes the done record, which names the checked commit with the approval and the binding of tests to the findings of the sixth round. The three commands of the statement, the order of the commands and the budget match the record. The reserve line repeats 4,500,000 new input and 2,250,000 output from the section on the budget. History of versions and source of approval: the task's statement, kept outside the repository, line 3 · Approval record: `reviews/tasks/20261120T232434Z-releases-and-task-approval.md:3` · Done record: `reviews/tasks/20261120T232528Z-releases-and-task-done.md:3` · Done conditions and budget: the task's statement, kept outside the repository, line 91

1. **acceptance not bound to approval and commit**: the original error is fixed and held by the test `check.task-result.ending-round-one-function`. A missing left end of the range of the ending round causes a refusal in the check, `--task` and `--rounds`. For a round with a finding and for a round followed by a clean one, the missing end stays information. There are no new findings of this class in the changed lines. `tools/ont-check/tasks.mjs:135` · `tools/ont-check/test/tasks.test.mjs:860`
2. **git context and paths**: the original error is fixed and held by the test `check.product-release.pin-is-file`. A directory in place of the pin is refused by the release, the integrity check and the repeated run. Reading historical paths checks the object's type through a shared function. There are no new findings of this class in the changed lines. `tools/ont-check/releases.mjs:350` · `tools/ont-check/releases.mjs:392` · `tools/ont-check/test/releases.test.mjs:705`
3. **budget stop at the end of a step**: the original error of version 8 is fixed and held by the test `check.task-statement.reserve-of-statement`. At 3,200,000 new input with a reserve of 1.5 the next round is allowed; with a reserve of 1 the same spend stops the round. The new support for the reserve line has two findings below. `tools/ont-check/test/tasks.test.mjs:893` · Regular run of version 9: the reviewer's log releases-n1-task-exact.log, kept outside the repository

## Findings in the changed lines

- **budget stop at the end of a step, important.** With `Budget-reserve: 1.1` the limit 3,000,000 becomes the threshold `3300000.0000000005`. At a spend of exactly 3,300,000 both outputs allow the next round, and the check ends with code 0. The statement requires a stop when the limit with the reserve is reached. The probability is low: it needs a fractional multiplier with such rounding and a spend exactly on the integer boundary. Reproduced with an ordinary multiplier and this task's limit. `tools/ont-check/tasks.mjs:295` · `tools/ont-check/tasks.mjs:320` · Stop boundary: the task's statement, kept outside the repository, line 49 · Run at the budget boundary: the reviewer's log edge-task.log, kept outside the repository
- **budget stop at the end of a step, important.** With the line `Budget-reserve: 1,5`, `--task` returns 1 and reports an error, but at the same time prints permission to start work. `done.mjs` returns 0 and writes `Budget-reserve: none`. Without the statement file the ordinary check accepts this record, and with a clean verdict `--rounds` completes the step. In this mode the tool uses the default reserve. The probability is low: this format is usual in Russian-language text, but the wrong version must get approval, and the executor must go on after the `--task` error. The test has no end-to-end assertion for the case with a comma: it ends with a call of the parser. `tools/ont-check/tasks.mjs:27` · `tools/ont-check/tasks.mjs:43` · `tools/ont-check/tasks.mjs:417` · `tools/ont-check/done.mjs:55` · `tools/ont-check/test/tasks.test.mjs:928` · Done record with a comma, output of --task, output of --rounds without the file (the reviewer's logs comma-done.log, comma-task.log and comma-rounds.log, kept outside the repository)

## Check against the statement

- The parts on protocol and product releases, deployment and notifications were checked against the materials of the sixth round. The new run confirms the fix for historical release files. Part on releases: the task's statement, kept outside the repository, line 17 · Materials of the sixth round: the reviewer's notes on acceptance, kept outside the repository · `tools/ont-check/test/releases.test.mjs:705`
- Binding the statement to a version, the done record and acceptance were checked against the new hash, the order of the records and the fix of the Git range check. The other cases of the statement and of acceptance were checked against the materials of the sixth round. Statement, approval and acceptance: the task's statement, kept outside the repository, line 34 · Approval record: `reviews/tasks/20261120T232434Z-releases-and-task-approval.md:3` · Done record: `reviews/tasks/20261120T232528Z-releases-and-task-done.md:3` · `tools/ont-check/test/tasks.test.mjs:860` · Materials of the sixth round: the reviewer's notes on acceptance, kept outside the repository
- The budget item is met for the actual reserve of version 9. The general requirement on the moment of the stop and the correct passing of the reserve is not met, by the two cases above. The regular run knows the spend for 0 of 11 contributions, so it cannot confirm the actual remainder. Budget requirements: the task's statement, kept outside the repository, line 47 · Output of the task: the reviewer's log releases-n1-task-exact.log, kept outside the repository
- The transition of the machine's rules and the note to the center remain as per the materials of the sixth round, where the references in both files and the text of the note were checked. Delivery was not confirmed in that round. The updated descriptions of releases, acceptance, the reserve and the configuration key were reread within the narrow diff. Transition of the machine's rules and documentation: the task's statement, kept outside the repository, line 52 · Materials of the sixth round: the reviewer's notes on acceptance, kept outside the repository · `docs/lifecycle.md:91` · `docs/parts/agent-rules.md:133` · `tools/ont-check/README.md:101`

All three Done-when commands were run on the commit from the done record in a temporary clone. `npm test`: 361 passed, 5 skipped, 0 failures. Both `ont-check` commands gave `ONT_OK`. The regular `--task` was run in the same clone on the branch with the separate commit of the done record, also `ONT_OK`. The check of the three fixes is held by the three passing tests given above. npm test log, protocol check, example check, output of the task: the reviewer's logs releases-n1-npm.log, releases-n1-root.log, releases-n1-example.log and releases-n1-task-exact.log, kept outside the repository · Table of all verdicts: the reviewer's table of verdicts, kept outside the repository

The tool read 52 verdicts and the narrow round record in a trial copy. For the new finding, a test holding its fix is still missing. Check of the table format, check of the round format: the reviewer's logs releases-n1-table-validation.log and releases-n1-round-validation.log, kept outside the repository
