Seal: v1 bc78edc5ac69dd02ad8d9f48c3f4435d1057946f4fd8ab65dc7c3a1ec6356ce3
Task: enforcement-verdicts-tests
Step: statement-review
Narrow: false
Number: 9
Time: 2026-11-25T06:29:36Z
Commits: 613fdf36585fc9878c36d08fe426a8f3b9cd21f3
By: gpt-6.2-sol, OpenAI Codex
Statement-hash: 10cdfba2f5e0dc90e4c2ec5c1602abd36da71bdedfa062344c5ac3b5a15cd3b9
Gate-paths: .github/workflows/ont-check.yml, package.json, ont.config.json, example/ont.config.json, tools/ont-check/approach.json, tools/ont-check/ont-check.mjs, tools/ont-check/manual-runs.mjs, tools/ont-check/round.mjs, tools/ont-check/tasks.mjs, tools/ont-check/merge-gate.mjs, tools/ont-check/review.mjs, tools/ont-check/judge.mjs, tools/ont-check/gate-record.mjs, tools/ont-check/lib.mjs, tools/ont-check/review-rounds.mjs, tools/ont-check/briefs.mjs, tools/ont-check/README.md, templates/ont.config.json, templates/README.md, templates/.github/workflows/ont-check.yml, tools/ont-check/test/verdicts-gate.test.mjs, tools/ont-check/test/manual-runs.test.mjs, tools/ont-check/test/review-run.test.mjs, tools/ont-check/test/review-rounds.test.mjs, tools/ont-check/test/merge-gate.test.mjs, tools/ont-check/test/ont-check.test.mjs, tools/ont-check/test/code-traces.test.mjs, tools/ont-check/test/judge.test.mjs, tools/ont-check/test/tool-records.test.mjs, tools/ont-check/test/options-documented.test.mjs, tools/ont-check/test/audit-selection.json
Brief-time: 2026-11-25T06:23:09Z
Tokens-new: 158331
Tokens-cached: 1953664
Tokens-out: 11419
Spend-record: 20261125T062936Z-enforcement-verdicts-tests-spend-snapshot.md
Cause: 059c4aa9cd4b0b01e261843ee867a4453ff33f94c01afe5643b7e2371535a597
Findings:
- Narrow issue coverage · important · change · fixable
- Round verdicts disappear at merge · important · change · fixable
- Configuration gate paths missing · important · change · fixable
- Audit checks absent from the selected list · important · change · fixable
- Judged screen evidence can be missing · important · change · fixable

## Notes

- Narrow issue coverage: usual path, the step it breaks: the narrow round reviewed a decision, the fix after it changes only a test, and the merge needs the decision's verdict from the reviewed result
- Round verdicts disappear at merge: usual path, the step it breaks: a result is merged whose last clean round followed a round with findings, as this task's own result will be
- Configuration gate paths missing: usual path, the step it breaks: required CI runs the existing test of the next action, tools/ont-check/test/tasks.test.mjs, which the work must update
- Audit checks absent from the selected list: usual path, the step it breaks: a change of tools/ont-check/judge.mjs, which item 9 makes, selects check.check.judge-sees-the-check, and the audit row needs its fixture
- Judged screen evidence can be missing: usual path, the step it breaks: done is recorded after the example's judged view tests pass while no snapshot was written, the arm of the audit row of rule.screens-kept
