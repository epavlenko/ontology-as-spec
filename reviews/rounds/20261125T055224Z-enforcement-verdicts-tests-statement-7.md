Seal: v1 2529d9b522a2ee7bbb3eb13d1fb8bdc386ca7d453312dd47560b642df1f4364b
Task: enforcement-verdicts-tests
Step: statement-review
Narrow: false
Number: 7
Time: 2026-11-25T05:52:24Z
Commits: b8fd0b4c84ea94e17fa65162034e0b1a1adeb401
By: gpt-6.2-sol, OpenAI Codex
Statement-hash: 2242afb5d519a914fc53f0892bff803645559e535dd5cc793b7f0f33374ae35d
Gate-paths: .github/workflows/ont-check.yml, package.json, ont.config.json, example/ont.config.json, tools/ont-check/approach.json, tools/ont-check/ont-check.mjs, tools/ont-check/manual-runs.mjs, tools/ont-check/round.mjs, tools/ont-check/tasks.mjs, tools/ont-check/merge-gate.mjs, tools/ont-check/review.mjs, tools/ont-check/judge.mjs, tools/ont-check/gate-record.mjs, tools/ont-check/lib.mjs, tools/ont-check/review-rounds.mjs, tools/ont-check/briefs.mjs, tools/ont-check/README.md, templates/ont.config.json, templates/README.md, templates/.github/workflows/ont-check.yml, tools/ont-check/test/verdicts-gate.test.mjs, tools/ont-check/test/manual-runs.test.mjs, tools/ont-check/test/review-run.test.mjs, tools/ont-check/test/review-rounds.test.mjs, tools/ont-check/test/merge-gate.test.mjs, tools/ont-check/test/ont-check.test.mjs, tools/ont-check/test/code-traces.test.mjs, tools/ont-check/test/judge.test.mjs, tools/ont-check/test/tool-records.test.mjs, tools/ont-check/test/options-documented.test.mjs, tools/ont-check/test/audit-selection.json
Brief-time: 2026-11-25T05:45:27Z
Tokens-new: 152656
Tokens-cached: 2864640
Tokens-out: 11413
Spend-record: 20261125T055224Z-enforcement-verdicts-tests-spend-snapshot.md
Cause: ed3d4503a4e5c46e58093e0e24416847f5ca5125b612d51983804f4c642f387d
Findings:
- Audit checks absent from the selected list · important · change · fixable
- Verdict probe requires the records it withholds · important · change · fixable
- Malformed catalogue row has no valid mark · important · change · fixable

## Notes

- Audit checks absent from the selected list: usual path, the step it breaks: behaviour is changed in code before the ontology, or work is put off in a ticket only, and the root review list must name the audit row's check on that edit
- Verdict probe requires the records it withholds: usual path, the step it breaks: the verdict probe is briefed after task 4 merged through a tested range of fixes, ending (5)
- Malformed catalogue row has no valid mark: usual path, the step it breaks: a new check is added to checks.md, as this task itself does, and its row must not be dropped without an error
