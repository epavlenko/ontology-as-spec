Task: releases-and-task
Step: result-review
Narrow: true
Number: 3
Time: 2026-11-20T23:51:04Z
Commits: 29ba90c1b9219edd7fa4762599ca8bd3ea5a3e2e..f77ba743391ec56db9d792be513b182cf71b046f
By: gpt-6.2-sol (OpenAI Codex)
Statement-hash: ced247ff58f273c0640aea217775d5feb1c2006fd37907ff89150bc98573236c
Checks-listed: 33
Checks-given: 33
Checks-carried: 0
Findings:
- budget stop at the end of a step · important · change · not fixable
- budget stop at the end of a step · important · change · not fixable
- budget stop at the end of a step · nit · change · not fixable

Acceptance:
- budget stop at the end of a step · important · change · not fixable
- budget stop at the end of a step · important · change · not fixable

## Verdicts

Merge verdict: fix first. Acceptance of statement version 9: refused. Reviewer: gpt-6.2-sol (OpenAI Codex). Fix author: Claude Opus 5.5 (Anthropic), per the fix commit. The review covers the three fixes and the regressions in their changed lines.

## Narrow round 2 findings

1. The original reserve `1.9300000000000002` is now refused in the statement parser and in the configuration loader. The tagged reserve test holds both refusals and the original cap at equality (tools/ont-check/test/tasks.test.mjs:939, tools/ont-check/test/tasks.test.mjs:945). Findings 1 and 2 cover cases the narrower format introduces.
2. The tentative reserve decision now records that an old floating-point `Overspend:` line must be rewritten using the exact cap. A search of the reviewed commit found no such lines (decisions.md:1361). In a reviewer probe, `new input 3300001 of 3300000.0000000005, output 0 of 1650000.0000000002` was refused and the exact-cap text was accepted. Existing tests hold strict comparison and reading a correct fractional cap (tools/ont-check/test/tasks.test.mjs:689, tools/ont-check/test/tasks.test.mjs:740). Finding 3 concerns the test cited for this fix.
3. The result status now names the unreadable statement budget after a result round with findings (tools/ont-check/tasks.mjs:434). The tagged reserve test guards against the old result status (tools/ont-check/test/tasks.test.mjs:951). A base-to-head probe confirmed the positive result message. No regression was found in this status change.

## Findings in the changed lines

1. **budget stop at the end of a step, important.** The configuration loader validates the value after JSON parsing, which can have rounded it already. The raw JSON number `1.93000000000000001` passes as `1.93`, while the statement parser refuses the same input. At a limit of 3,000,000 and spend of 5,790,000, the loader silently gives an exhausted budget at a cap of 5,790,000. The input is outside the permitted precision and its stated value would give a cap of 5,790,000.00000000003. This defeats the load-time refusal promised by the tentative reserve decision and leaves the wrong boundary under `rule.budget-before-next` (tools/ont-check/lib.mjs:237, decisions.md:1361). Likelihood is very low. It takes a pasted or generated value with precision beyond that of a JavaScript number and, to change the next action, spend at the affected boundary.
2. **budget stop at the end of a step, important.** The new statement restriction also applies to stored records of done. A record with `Budget-reserve: 1.125` parses on the base and is a fatal task-record error on the reviewed change, even for a different task than the one under review. The diagnostic says that 1.125 is not a number of 1 or more. A new statement with 1.125 gets a diagnostic that also omits the two-digit limit. The tentative decision describes the restriction for statements and config and gives a migration only for older `Overspend:` text. This breaks reading a stored budget under `field.task-result.budget` (tools/ont-check/tasks.mjs:37, tools/ont-check/tasks.mjs:90, ontology.md:316, decisions.md:1361). Likelihood is low. It needs a stored record from the short period when decimal reserves were accepted without that restriction. The reviewed repository has no such record, and a 12.5 percent reserve is a plausible setting.
3. **budget stop at the end of a step, nit.** The narrow round 2 record cites `check.task-statement.reserve-of-statement` as holding the fix for previously rendered `Overspend:` text, but that test never exercises an overspend line. The cited test cannot establish that the documented rewrite passes. This misstates the evidence used to proceed to a narrow round. The reviewer probe verifies the particular rewrite, and the existing overspend tests exercise the comparison independently (reviews/rounds/20261120T234241Z-releases-and-task-result-narrow-2.md:14, tools/ont-check/test/tasks.test.mjs:903, tools/ont-check/test/tasks.test.mjs:689). Likelihood of a practical consequence is low. It takes a retained overspent acceptance and a reviewer relying on the cited test to verify the rewrite.

The runs and probes are in the reviewer's log, kept outside the repository.

## Acceptance against version 9

- The approved version's digest matches its owner approval and the latest record of done. The record names the last commit in this round, which contains the three fixes and the preceding round's updated record. The approval records the owner's authorization to finish the approved goal and set the number of rounds. Version 9's reserve line restates the agreed caps of 4,500,000 new input and 2,250,000 output (reviews/tasks/20261120T232434Z-releases-and-task-approval.md:3, reviews/tasks/20261120T234652Z-releases-and-task-done.md:3).
- Protocol releases and notices, product releases and deployments, approval and statement review, acceptance binding, machine-rule transition and documentation coverage retain the evidence from the preceding review. That review verified the transition references and the note for the coordinating thread. Delivery of that note was unverified (reviews/rounds/20261120T234241Z-releases-and-task-result-narrow-2.md:43). The narrow diff affects the task budget.
- All three Done-when commands passed on the commit named by the record of done. `npm test` reported 361 passed, five skipped and zero failures. The direct checks of the approach and example both reported `ONT_OK`. The version 9 task command, run with the subsequent done record present, reported `ONT_OK`, the approved hash, all three done checks passed and the expected caps. The result status reflects the preceding recorded round. It reports spend known for zero of 13 contributions, so the recorded data cannot establish actual total spend.
- The new budget validator still allows the wrong boundary from some configuration input and can break validation of a retained result record. These are acceptance findings 1 and 2. The runs are in the reviewer's log, kept outside the repository.
