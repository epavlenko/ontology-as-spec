Task: releases-and-task
Step: result-review
Narrow: true
Number: 4
Time: 2026-11-21T00:00:27Z
Commits: 4122e7ca14840be00f4a5b2c6f2f3278ccbddc94..f367450419a762807a64e1b46966bf4851c0279b
By: gpt-6.2-sol (OpenAI Codex)
Statement-hash: ced247ff58f273c0640aea217775d5feb1c2006fd37907ff89150bc98573236c
Checks-listed: 21
Checks-given: 21
Checks-carried: 0
Findings:
- budget stop at the end of a step · important · change · fixable

Acceptance:
- budget stop at the end of a step · important · change · fixable

## Verdicts

Merge verdict: fix first. Acceptance of statement version 9: refused. The reviewer is gpt-6.2-sol (OpenAI Codex). The documentation commit credits Claude Opus 5.5 (Anthropic). This fourth narrow round follows the owner's authorization to decide the number of rounds, quoted in the version 9 approval record (reviews/tasks/20261120T232434Z-releases-and-task-approval.md:5). The content review is limited to the specified diff ending at 7c93732, the commit documenting the reserve limits. The round ends at the result commit f367450 named by the subsequent done record (reviews/tasks/20261120T235552Z-releases-and-task-done.md:3).

## The three limits

1. The configuration reads a JavaScript number after JSON parsing. In a reviewer probe, the raw JSON number 1.93000000000000001 arrived as 1.93 and passed, and the same literal in a statement failed. When JSON preserves the excess precision, as for 1.9300000000000002, the loader refuses it. The exception in the reserve decision agrees with the implementation (tools/ont-check/lib.mjs:172, tools/ont-check/lib.mjs:237, tools/ont-check/tasks.mjs:37). In ordinary use this needs unusual input precision, and it affects the next action only at an affected threshold. Recording the exception is proportionate under the rule on findings that matter (decisions.md:191).
2. The reader rejects a retained record of done with a reserve such as 1.125 and still reads records from before the reserve field existed. The content commit contains no such incompatible record. Exposure is low because the relevant writer could produce this value only during the period before the two-digit restriction. A reserve of 1.125 is a plausible choice and an incompatible retained file blocks the repository check. Recording the constraint is proportionate for the reviewed task once its trigger and recovery are accurately described (tools/ont-check/tasks.mjs:90, tools/ont-check/tasks.mjs:101).
3. An earlier Overspend line whose text differs from the current cap rendering is refused. The reviewer verified that the earlier rendering for a limit of 3000000 with a reserve of 1.1 is refused, the current text passes, and a historical line whose text still matches also passes. The existing tests hold literal mismatch and a correctly rendered fractional cap. They leave the specific historical floating-point rendering untested (tools/ont-check/tasks.mjs:351, tools/ont-check/tasks.mjs:360, tools/ont-check/test/tasks.test.mjs:689, tools/ont-check/test/tasks.test.mjs:740). There is no such line in the content commit. Exposure is low because the case requires a retained overspent acceptance and a cap whose displayed value changed. Recording that limit is proportionate.

The three cases remain recorded limitations classified as not fixable in the preceding round. The README points readers to the limitations page (README.md:88). The task-budget guide and tool configuration reference cite the reserve decision, which now points readers to the new limitations section (docs/parts/agent-rules.md:138, tools/ont-check/README.md:101, decisions.md:1361). This is a reasonable place for the cases.

## Finding in the changed lines

**Budget stop at the end of a step, important, fixable within the statement.** The text says the retained-record case needs a hand-edited record and describes the record as refused and written again (decisions.md:1361, docs/limitations.md:41). A reviewer ran the earlier done writer on an approved synthetic statement with a reserve of 1.125. It wrote that reserve into its standard record of done without edits to the record. The current repository check refused the generated file. A separate probe retained an invalid older record alongside a valid newer record and got the same rejection. The writer creates a fresh file, while the check reads all retained records, so issuing a new record or rounding the old field without regard to its approved statement is insufficient recovery guidance (tools/ont-check/done.mjs:59, tools/ont-check/tasks.mjs:53, tools/ont-check/tasks.mjs:90, tools/ont-check/ont-check.mjs:1363). This matters to an upgrading project because the historical file can keep its checks red. Describe that the old writer could generate the file, and that remediation has to address the obsolete file and any acceptance bound to it. Identify the current-text comparison in the Overspend description so readers can tell which older lines need rewriting. This finding concerns the documentation of the prior limit under the rule on findings that matter (decisions.md:191). It does not require expanding the reserve format or adding a migration mechanism.

## Acceptance against version 9

- The file digest matches the approval in force and the done record. The done record names the result commit and records the three commands in the approved order (reviews/tasks/20261120T232434Z-releases-and-task-approval.md:3, reviews/tasks/20261120T235552Z-releases-and-task-done.md:3).
- Independently run on the done commit in a temporary clone, all three Done-when commands exited zero. npm test reported 361 passes, five skips and zero failures. The direct approach and example checks both reported ONT_OK.
- With the subsequent done record in place, the task check using the approved statement reported ONT_OK, the correct approval and done commit, all three Done-when commands passed, and caps of 4500000 new input and 2250000 output. Its result status reports the preceding round's finding that is not fixable within the task. Spend is known for zero of 14 contributions, so the records do not establish actual aggregate spend.
- In the temporary clone, the tool recorded all 21 check verdicts and recognized the fourth narrow round as the review after the latest done record. The task check remained ONT_OK and requested an owner decision as the next action because both narrow rounds have one finding class (tools/ont-check/review-rounds.mjs:131, tools/ont-check/review-rounds.mjs:181).
- The release and deployment, statement review, acceptance binding, machine-rule transition and documentation coverage evidence from the preceding review still applies to the artifacts outside this narrow diff (reviews/rounds/20261120T235104Z-releases-and-task-result-narrow-3.md:42). That evidence records the transition note and leaves its delivery unverified. The version 9 requirement for documentation of the mechanisms still has the finding above. The acceptance criterion also requires a result review ready to merge with no acceptance findings.
- The runs and probes are in the reviewer's log, kept outside the repository.
