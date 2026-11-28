Seal: v1 f9488c42d09cb31a6b16a2ab02e87ac9b532ebc74fa3c3390ad52e85900adac6
Task: enforcement-verdicts-tests
Step: statement-review
Narrow: false
Number: 3
Time: 2026-11-24T12:40:42Z
Commits: d884d0d72870e169e5acbb639b5d7955e28b5224
By: gpt-6.2-sol, OpenAI Codex
Statement-hash: 562cd357c68ea4b9d25f23674cb4261b061ca169d1bc542caa142a6718ac38f4
Gate-paths: .github/workflows/ont-check.yml, package.json, ont.config.json, example/ont.config.json, tools/ont-check/approach.json, tools/ont-check/ont-check.mjs, tools/ont-check/manual-runs.mjs, tools/ont-check/round.mjs, tools/ont-check/tasks.mjs, tools/ont-check/merge-gate.mjs, tools/ont-check/review.mjs, tools/ont-check/judge.mjs, tools/ont-check/gate-record.mjs, tools/ont-check/README.md, tools/ont-check/test/verdicts-gate.test.mjs, tools/ont-check/test/manual-runs.test.mjs, tools/ont-check/test/review-run.test.mjs, tools/ont-check/test/review-rounds.test.mjs, tools/ont-check/test/merge-gate.test.mjs, tools/ont-check/test/ont-check.test.mjs, tools/ont-check/test/code-traces.test.mjs, tools/ont-check/test/judge.test.mjs, tools/ont-check/test/tool-records.test.mjs
Brief-time: 2026-11-24T12:34:08Z
Tokens-new: 164580
Tokens-cached: 3197643
Tokens-out: 14065
Spend-record: 20261124T124042Z-enforcement-verdicts-tests-spend-snapshot.md
Cause: 6ffd7f3c2b11a58f4403c291900f43e933ae2e7fb6f5ce360aa672a789dce242
Findings:
- Narrow issue coverage · important · change · fixable
- Verdict freshness and supersession · important · change · fixable
- Audit checks absent from the selected list · important · change · fixable
- Required end-to-end suite can disappear · important · change · later · issues/0020-rare-cases-of-the-verdict-gate.md
- Required CI refusal evidence omitted · important · change · not fixable
- Verdict probe depends on the task ending · important · change · fixable
- Template end-to-end work deferred · important · change · fixable
- Release evidence producer deferred · important · change · fixable
- Configuration gate paths missing · important · change · fixable

## Notes

- Narrow issue coverage: usual path, the step it breaks: the executor records the one issue after the narrow round, fixes its findings and records done, and the guard must bind them to one issue commit
- Verdict freshness and supersession: usual path, the step it breaks: a finding is fixed and the next result is reviewed at the same check stamp
- Audit checks absent from the selected list: usual path, the step it breaks: an implementation-status row is edited and its audit row is accounted for at acceptance
- Verdict probe depends on the task ending: usual path, the step it breaks: the verdict refusal probe runs after task 4 merges through the narrow fixes path
- Template end-to-end work deferred: usual path, the step it breaks: the goal assigns the templates' end-to-end suite to task 4, and an adopter of the templates adds its first action
- Release evidence producer deferred: usual path, the step it breaks: the goal assigns the producer of judged and run evidence to task 4, and the release task consumes it
- Configuration gate paths missing: usual path, the step it breaks: the full check reads the new configuration keys and the gate-change records name the allowlist and its fixture
