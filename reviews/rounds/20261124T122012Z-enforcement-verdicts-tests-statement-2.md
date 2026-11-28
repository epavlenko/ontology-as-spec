Seal: v1 a7dfa3807f90e9ac3df7f887fff3117fd06c8884c2eae269d5597ceca54524a7
Task: enforcement-verdicts-tests
Step: statement-review
Narrow: false
Number: 2
Time: 2026-11-24T12:20:12Z
Commits: c843478408f737a6af6cca306f1107724c492b0e
By: gpt-6.2-sol, OpenAI Codex
Statement-hash: 505b29f256926ed0a580fa8f41ee8332dce24a54af4ef18297f6ae626a9e7eb2
Gate-paths: .github/workflows/ont-check.yml, package.json, ont.config.json, example/ont.config.json, tools/ont-check/approach.json, tools/ont-check/ont-check.mjs, tools/ont-check/manual-runs.mjs, tools/ont-check/round.mjs, tools/ont-check/tasks.mjs, tools/ont-check/merge-gate.mjs, tools/ont-check/review.mjs, tools/ont-check/judge.mjs, tools/ont-check/README.md, tools/ont-check/test/*.test.mjs
Brief-time: 2026-11-24T12:13:31Z
Tokens-new: 150774
Tokens-cached: 2045821
Tokens-out: 13655
Spend-record: 20261124T122012Z-enforcement-verdicts-tests-spend-snapshot.md
Findings:
- Narrow issue bound to final done · important · change · fixable
- Narrow issue coverage · important · change · fixable
- Verdict freshness and supersession · important · change · fixable
- Audit checks absent from the selected list · important · change · fixable
- Required end-to-end suite can disappear · important · change · fixable
- Refusal evidence arrives after the successor starts · important · change · fixable
- Required CI refusal evidence omitted · important · change · fixable
- Approval scope wider than the workflow change · nit · change · fixable

## Notes

- Narrow issue bound to final done: usual path, the step it breaks: the one issue after the narrow round finds nothing to fix and done is recorded on the commit it checked
- Narrow issue coverage: usual path, the step it breaks: the executor merges after the one issue reviewed the fixes and needs to know which reviewed list holds each verdict
- Verdict freshness and supersession: usual path, the step it breaks: the reviewer records a reasoned not-run, or a later round reviews a revised change at the same stamp
- Audit checks absent from the selected list: usual path, the step it breaks: an implementation-status row is edited and its audit row is accounted for at acceptance
- Required end-to-end suite can disappear: usual path, the step it breaks: a change of the example configuration runs required CI, which goal row 4 requires to refuse when a needed suite is gone
- Refusal evidence arrives after the successor starts: usual path, the step it breaks: the next task starts after the merge of this one, and the goal requires this gate's negative proof before that start
- Required CI refusal evidence omitted: usual path, the step it breaks: the gate proofs are recorded and accepted after the merge, and goal row 4 requires red CI of attack branches for the report and mutation gates
- Approval scope wider than the workflow change: usual path, the step it breaks: the approval is issued and the gate-change records are written for the test files
