Seal: v1 8d2f8d5993bc0d3d900e06950bcb077421eff5add21ab13efded28a918a662b6
Task: enforcement-verdicts-tests
Step: statement-review
Narrow: false
Number: 5
Time: 2026-11-25T05:16:20Z
Commits: d6c1de49c5c6055c4f0f65ef778471d457fc102d
By: gpt-6.2-sol, OpenAI Codex
Statement-hash: 17e3f321858e796f8dd9965679709cb2b976829bc3202af16a55259027f5afa4
Gate-paths: .github/workflows/ont-check.yml, package.json, ont.config.json, example/ont.config.json, tools/ont-check/approach.json, tools/ont-check/ont-check.mjs, tools/ont-check/manual-runs.mjs, tools/ont-check/round.mjs, tools/ont-check/tasks.mjs, tools/ont-check/merge-gate.mjs, tools/ont-check/review.mjs, tools/ont-check/judge.mjs, tools/ont-check/gate-record.mjs, tools/ont-check/lib.mjs, tools/ont-check/review-rounds.mjs, tools/ont-check/README.md, templates/ont.config.json, templates/README.md, templates/.github/workflows/ont-check.yml, tools/ont-check/test/verdicts-gate.test.mjs, tools/ont-check/test/manual-runs.test.mjs, tools/ont-check/test/review-run.test.mjs, tools/ont-check/test/review-rounds.test.mjs, tools/ont-check/test/merge-gate.test.mjs, tools/ont-check/test/ont-check.test.mjs, tools/ont-check/test/code-traces.test.mjs, tools/ont-check/test/judge.test.mjs, tools/ont-check/test/tool-records.test.mjs, tools/ont-check/test/options-documented.test.mjs
Brief-time: 2026-11-25T04:59:40Z
Tokens-new: 210825
Tokens-cached: 5689984
Tokens-out: 14527
Spend-record: 20261125T051620Z-enforcement-verdicts-tests-spend-snapshot.md
Cause: 932904cfacde0111558b34831483ba8a99ef5cd3b35b4e17708eadca35aa9a9f
Findings:
- Verdict probe depends on the task ending · important · change · later · issues/0020-rare-cases-of-the-verdict-gate.md
- Audit checks absent from the selected list · important · change · fixable
- Cause verdict is bound only by time · important · change · later · issues/0020-rare-cases-of-the-verdict-gate.md
- Release run debt loses merged deferrals · important · change · later · issues/0020-rare-cases-of-the-verdict-gate.md
- Mutation baseline absent on the installing PR · important · change · fixable

## Notes

- Audit checks absent from the selected list: usual path, the step it breaks: a requirement in the Interface or Code section of a profile is edited, or a previous round's triage and filings are reviewed, and the root review list must name the audit row's check
- Mutation baseline absent on the installing PR: usual path, the step it breaks: the required CI runs on this task's own PR, which installs the list of known survivors while its base has none
