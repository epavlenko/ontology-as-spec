Seal: v1 b42f244b8fb847b10ed5c420664740281a72e8e53afbc2b12e2b15e711c3c822
Task: enforcement-verdicts-tests
Step: statement-review
Narrow: false
Number: 1
Time: 2026-11-24T11:53:59Z
Commits: 8e8ee1424bcba4ea73825f1e75b95ba299bcbee8
By: gpt-6.2-sol, OpenAI Codex
Statement-hash: 802e8f09c52482e64ebbf6653a152302e2fec56d61e73c76b48063616bf35b90
Gate-paths: .github/, package.json, tools/ont-check/, ont.config.json, example/ont.config.json, templates/
Brief-time: 2026-11-24T11:48:30Z
Tokens-new: 190606
Tokens-cached: 2324245
Tokens-out: 10737
Spend-record: 20261124T115359Z-enforcement-verdicts-tests-spend-snapshot.md
Findings:
- Narrow issue bound to final done · important · change · fixable
- Findings outside failed checks · important · change · fixable
- Verdict freshness and supersession · important · change · fixable
- Example review scope · important · change · fixable
- Audit checks absent from the selected list · important · change · fixable
- Test report includes an unrun suite · important · change · fixable
- Empty template suites · important · change · fixable
- Missing judged evidence handoff · important · change · fixable
- Run obligation cleared by older evidence · important · change · fixable
- Live proof rejected by its writer · important · change · fixable
- Probe enrolled as goal work · important · change · fixable
- Approval scope wider than the workflow change · important · change · fixable
- Budget stop order and duplicate runs · important · change · fixable

## Notes

- Narrow issue bound to final done: usual path, the step it breaks: after the narrow round with findings the executor fixes them and records done on a later commit than the one the issue of verdicts checked
- Findings outside failed checks: usual path, the step it breaks: the executor closes the findings of the post-narrow issue that its findings table gives outside a failed check
- Verdict freshness and supersession: usual path, the step it breaks: a later result round carries verdicts of the earlier one after the files under review changed
- Example review scope: usual path, the step it breaks: a change to the example mockup, map or run guide is reviewed and merged under the guard
- Audit checks absent from the selected list: usual path, the step it breaks: the audit table credits the guard with rows whose checks --review does not list on their usual change
- Test report includes an unrun suite: usual path, the step it breaks: required CI runs test:ci on every pull request, which excludes the judged suite
- Empty template suites: usual path, the step it breaks: npm run check runs on the templates after their configuration gets test suites
- Missing judged evidence handoff: usual path, the step it breaks: the executor runs test:judged and its records must outlive the temporary worktree of done
- Run obligation cleared by older evidence: usual path, the step it breaks: a later merge defers a run check whose stamp an earlier pass shares
- Live proof rejected by its writer: usual path, the step it breaks: the executor records the live refusal proofs after the merge with gate-record.mjs proof
- Probe enrolled as goal work: usual path, the step it breaks: the negative probe is authorized and the goal's completion is later checked over goals.enforcement
- Approval scope wider than the workflow change: usual path, the step it breaks: the approval is issued and the gate-change records are written for the workflow file
- Budget stop order and duplicate runs: usual path, the step it breaks: done is recorded and --task decides which reserve stops the next step
