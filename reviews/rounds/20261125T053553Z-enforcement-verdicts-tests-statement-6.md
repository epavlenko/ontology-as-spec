Seal: v1 bf3b2f620322f474144c96112ea0b4d1e8be2e51f0b1d3480344282d2b561bc7
Task: enforcement-verdicts-tests
Step: statement-review
Narrow: false
Number: 6
Time: 2026-11-25T05:35:53Z
Commits: ad5181828f7804c5b1921149387ab3764999dd7f
By: gpt-6.2-sol, OpenAI Codex
Statement-hash: a9808d2fcb99e0bf216411e9780b5992fb6a169b32f587133b9b8c2d609d2f4b
Gate-paths: .github/workflows/ont-check.yml, package.json, ont.config.json, example/ont.config.json, tools/ont-check/approach.json, tools/ont-check/ont-check.mjs, tools/ont-check/manual-runs.mjs, tools/ont-check/round.mjs, tools/ont-check/tasks.mjs, tools/ont-check/merge-gate.mjs, tools/ont-check/review.mjs, tools/ont-check/judge.mjs, tools/ont-check/gate-record.mjs, tools/ont-check/lib.mjs, tools/ont-check/review-rounds.mjs, tools/ont-check/briefs.mjs, tools/ont-check/README.md, templates/ont.config.json, templates/README.md, templates/.github/workflows/ont-check.yml, tools/ont-check/test/verdicts-gate.test.mjs, tools/ont-check/test/manual-runs.test.mjs, tools/ont-check/test/review-run.test.mjs, tools/ont-check/test/review-rounds.test.mjs, tools/ont-check/test/merge-gate.test.mjs, tools/ont-check/test/ont-check.test.mjs, tools/ont-check/test/code-traces.test.mjs, tools/ont-check/test/judge.test.mjs, tools/ont-check/test/tool-records.test.mjs, tools/ont-check/test/options-documented.test.mjs
Brief-time: 2026-11-25T05:30:17Z
Tokens-new: 131107
Tokens-cached: 1375232
Tokens-out: 9166
Spend-record: 20261125T053553Z-enforcement-verdicts-tests-spend-snapshot.md
Cause: 364dcea280592f88e47bbff33ecb9764540fc96d6bb9cc73ef66a0ac17f9b6fa
Findings:
- Audit checks absent from the selected list · important · change · fixable
- Verdict probe requires the records it withholds · important · change · fixable
- Verdict base is unchecked outside the narrow issue · important · change · later · issues/0020-rare-cases-of-the-verdict-gate.md
- Malformed catalogue row has no valid mark · important · change · later · issues/0020-rare-cases-of-the-verdict-gate.md

## Notes

- Audit checks absent from the selected list: usual path, the step it breaks: a new entry of the decision log chooses a value or a requirement, and the root review list must name check.check.chosen-value-held
- Verdict probe requires the records it withholds: usual path, the step it breaks: the verdict probe of this task records a clean round through the writers while it keeps a verdict of the change missing
