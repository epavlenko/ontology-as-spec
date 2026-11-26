Seal: v1 9cae504e422ad8226a319009e2955a748fac0c3c241b51a94a0f0070005a66c2
Task: enforcement-verdicts-tests
Step: statement-review
Narrow: false
Number: 10
Time: 2026-11-26T19:18:19Z
Commits: bbc9a588caa14fbec96b9796a711a0198f554120
By: gpt-6.2-sol, OpenAI Codex
Statement-hash: 8f9eb5276619cd8851d166355c002558f41ab16ba524b1b073f56f7989306b4e
Gate-paths: package.json, ont.config.json, tools/ont-check/approach.json, tools/ont-check/ont-check.mjs, tools/ont-check/manual-runs.mjs, tools/ont-check/round.mjs, tools/ont-check/tasks.mjs, tools/ont-check/merge-gate.mjs, tools/ont-check/review.mjs, tools/ont-check/judge.mjs, tools/ont-check/lib.mjs, tools/ont-check/review-rounds.mjs, tools/ont-check/briefs.mjs, tools/ont-check/README.md, tools/ont-check/test/verdicts-gate.test.mjs, tools/ont-check/test/manual-runs.test.mjs, tools/ont-check/test/review-run.test.mjs, tools/ont-check/test/review-rounds.test.mjs, tools/ont-check/test/merge-gate.test.mjs, tools/ont-check/test/tasks.test.mjs, tools/ont-check/test/judge.test.mjs, tools/ont-check/test/options-documented.test.mjs
Brief-time: 2026-11-26T19:10:48Z
Tokens-new: 150999
Tokens-cached: 2916468
Tokens-out: 13046
Spend-record: 20261126T191819Z-enforcement-verdicts-tests-spend-snapshot.md
Cause: b03173537ab8ee32026dacd30eb395e34be271238d1b6b8104815ad338eebf46
Findings:
- Pre-approval tickets block the merge · important · change · fixable
- Narrow issue coverage · important · change · fixable
- Passing fix test has no evidence source · important · change · fixable
- Stagnation analysis omits repeated classes · important · change · fixable

## Notes

- Pre-approval tickets block the merge: usual path, the step it breaks: the PR of task 4 carries issues/0021 and issues/0022, committed before the approval, so the existing guard refuses the first merge with WORK_BEFORE_APPROVAL
- Narrow issue coverage: usual path, the step it breaks: the issue after the narrow round finds a missing documentation update, the fix adds it, and the merge needs a verdict on a check absent from both earlier lists with no further issue allowed
- Passing fix test has no evidence source: usual path, the step it breaks: done is recorded after a narrow-round fix whose named test exists but was skipped, and the gate cannot tell it from a passing test
- Stagnation analysis omits repeated classes: usual path, the step it breaks: the reviewer checks the analysis of the cause before the next version is approved, and it does not say why the earlier fixes of each repeated class failed
