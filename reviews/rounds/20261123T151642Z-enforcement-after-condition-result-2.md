Task: enforcement-after-condition
Step: result-review
Narrow: false
Number: 2
Time: 2026-11-23T15:16:42Z
Commits: 7d0d3f0..c3793e4
By: gpt-6.2-sol (OpenAI, Codex)
Statement-hash: 998a21400b537dd12e3ba8ec9925ba48a8f408c2f1ce97ea57e36dbd4bde2969
Checks-listed: 73
Checks-given: 73
Checks-carried: 0
Findings:
- done omits the catalogue changes required for acceptance · important · change · fixable
- gate-change record attributing a verdict test to the wrong item · nit · change · fixable
- exception documentation with empty anchors · nit · change · fixable
- reissued acceptance drops the narrow-round findings · important · change · limitation · docs/limitations.md
- clean update from main invalidates verdicts in the fix range · important · change · limitation · docs/limitations.md
- tool faults filed as limitations · nit · change · limitation · docs/limitations.md
Acceptance:
- done without the changed catalogue rows of item 2 · important · change · fixable

## Notes

The record of done is written by the tool and names its commands only; the catalogue rows this task changed, from the diff of its merge (ee6c906), are: check.agent-rules.code-reviewed-for-errors, check.agent-rules.reviewed-before-merge, check.manual-run.fixes-range, check.manual-run.required, check.manual-run.stale, check.merge-gate.merged-as-checked, check.merge-gate.records-only-since-review, check.merge-gate.resolution-kept, check.review-round.condition-branch, check.review-round.condition-gate, check.review-round.fixes-after-narrow, check.review-round.ready-after-clean, check.task-result.acceptance-not-clean, check.task-result.clean-needs-acceptance, check.task-result.latest-done. The anchor of the section on the three rare cases had slid onto the next heading and is put back. The two tool faults are rare histories by the owner's answer 1063 a and stay with the limitations.
