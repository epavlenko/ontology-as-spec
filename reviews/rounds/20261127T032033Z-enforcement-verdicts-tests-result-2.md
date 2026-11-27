Seal: v1 70e3b64dc2570afe3b69b23b0e5fed5d56cf0d755019c5ebb660a16676288ab3
Task: enforcement-verdicts-tests
Step: result-review
Narrow: false
Number: 2
Time: 2026-11-27T03:20:33Z
Commits: c3c840b3494a1d7eb8ca10401deba5fdce9f5545
Done: 20261127T030258Z-enforcement-verdicts-tests-done.md
By: gpt-6.2-sol (OpenAI Codex)
Statement-hash: f4bbc86906494453e091d65882530eb48f4313cbe01e1ffeff674bf897e1d8e3
Brief-time: 2026-11-27T03:06:25Z
Tokens-new: 181868
Tokens-cached: 6792704
Tokens-out: 20859
Spend-record: 20261127T032033Z-enforcement-verdicts-tests-spend-snapshot.md
Round-checks: check.review-round.filed-right, check.review-round.whole-class
Findings:
- Base guard cannot read the approval rounds · important · change · fixable
- Guard review reads beyond the checked tree · important · change · fixable
- Findings filed in earlier rounds can waive a current fail · important · change · fixable
- Narrow issue verdicts are not bound to their diff · important · change · fixable
- Failed cause verdict can clear without evidence of a fix · important · change · fixable
- Verdict base field lacks a code anchor · nit · change · fixable
Acceptance:
- Findings filed in earlier rounds can waive a current fail · important · change · fixable
- Narrow issue verdicts are not bound to their diff · important · change · fixable
- Failed cause verdict can clear without evidence of a fix · important · change · fixable
- Failed cause verdict can clear without evidence of a fix · important · change · fixable
- Base guard cannot read the approval rounds · important · change · fixable
- Base guard cannot read the approval rounds · important · change · fixable

## Notes

- Base guard cannot read the approval rounds: usual path, the step it breaks: the executor opens the pull request of the task and the guard, with main's code, cannot read the records of rounds the new writer wrote, so the merge is refused
- Guard review reads beyond the checked tree: usual path, the step it breaks: the guard computes the list of a change from the configuration of the checked commit, and item 2 requires the inputs of the list to come from the checked tree, while paths of the configuration can leave it
- Findings filed in earlier rounds can waive a current fail: usual path, the step it breaks: a later check of the result repeats a class filed in an earlier round, and the merge takes the old filing instead of a filing of the round that ends the step
- Narrow issue verdicts are not bound to their diff: usual path, the step it breaks: the executor closes the range of fixes with the one issue, and a standalone run record without the issue's base satisfies it
- Failed cause verdict can clear without evidence of a fix: usual path, the step it breaks: after a failed analysis the executor briefs the next round with the same analysis, and the brief writer accepts it
- Verdict base field lacks a code anchor: usual path, the step it breaks: the next change that touches the verdict writer is reviewed with check.implementation-row.code-names-concepts, which fails on the field without its annotation
