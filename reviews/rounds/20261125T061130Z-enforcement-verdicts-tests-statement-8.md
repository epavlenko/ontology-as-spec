Seal: v1 7b88ed2e3131ad2a9535b84e2f6e3ac4e9d6eae79f0ce23da19109b2d58e46cf
Task: enforcement-verdicts-tests
Step: statement-review
Narrow: false
Number: 8
Time: 2026-11-25T06:11:30Z
Commits: addffa0f83404134d237c75d9f38f23b26691ce7
By: gpt-6.2-sol, OpenAI Codex
Statement-hash: 59f3393b8cc45b45fac01652e58bccb4cdd4171f3e7d9183cfc492890a3d8377
Gate-paths: .github/workflows/ont-check.yml, package.json, ont.config.json, example/ont.config.json, tools/ont-check/approach.json, tools/ont-check/ont-check.mjs, tools/ont-check/manual-runs.mjs, tools/ont-check/round.mjs, tools/ont-check/tasks.mjs, tools/ont-check/merge-gate.mjs, tools/ont-check/review.mjs, tools/ont-check/judge.mjs, tools/ont-check/gate-record.mjs, tools/ont-check/lib.mjs, tools/ont-check/review-rounds.mjs, tools/ont-check/briefs.mjs, tools/ont-check/README.md, templates/ont.config.json, templates/README.md, templates/.github/workflows/ont-check.yml, tools/ont-check/test/verdicts-gate.test.mjs, tools/ont-check/test/manual-runs.test.mjs, tools/ont-check/test/review-run.test.mjs, tools/ont-check/test/review-rounds.test.mjs, tools/ont-check/test/merge-gate.test.mjs, tools/ont-check/test/ont-check.test.mjs, tools/ont-check/test/code-traces.test.mjs, tools/ont-check/test/judge.test.mjs, tools/ont-check/test/tool-records.test.mjs, tools/ont-check/test/options-documented.test.mjs, tools/ont-check/test/audit-selection.json
Brief-time: 2026-11-25T06:04:01Z
Tokens-new: 166532
Tokens-cached: 3019520
Tokens-out: 13598
Spend-record: 20261125T061130Z-enforcement-verdicts-tests-spend-snapshot.md
Cause: 6b79ab58ad00d22e67737dfa2fdf18244a8485cc844f0be8d52410bc9989c92f
Findings:
- Audit checks absent from the selected list · important · change · fixable
- Verdict probe requires the records it withholds · important · change · fixable
- Malformed catalogue row has no valid mark · important · change · later · issues/0020-rare-cases-of-the-verdict-gate.md
- Verbatim audit evidence is refused by the done writer · important · change · fixable
- Report refusal can stop before its diagnostic · important · change · fixable

## Notes

- Audit checks absent from the selected list: usual path, the step it breaks: a PR adds a decision entry for a tuned setting, and the fixture of rule.number-by-role must hold the trigger the full audit names
- Verdict probe requires the records it withholds: usual path, the step it breaks: the verdict probe of this task runs after a range of fixes, in a version whose earlier rounds failed a round check, as this task's rounds did
- Verbatim audit evidence is refused by the done writer: usual path, the step it breaks: the executor writes this task's record of done with its evidence of the 116 rows
- Report refusal can stop before its diagnostic: usual path, the step it breaks: the live probe of the report gate runs required CI with a failing test
