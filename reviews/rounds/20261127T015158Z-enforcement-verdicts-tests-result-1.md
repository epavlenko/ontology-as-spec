Seal: v1 cb5ad700049b3a603cb4111da446495e810481aaf57ca2925d48ed495bcb6b8b
Task: enforcement-verdicts-tests
Step: result-review
Narrow: false
Number: 1
Time: 2026-11-27T01:51:58Z
Commits: 6d1e401fa0f1055c73e17afb133921efaf6e223c
Done: 20261127T013303Z-enforcement-verdicts-tests-done.md
By: gpt-6.2-sol (OpenAI Codex)
Statement-hash: f4bbc86906494453e091d65882530eb48f4313cbe01e1ffeff674bf897e1d8e3
Brief-time: 2026-11-27T01:35:53Z
Tokens-new: 200176
Tokens-cached: 6312192
Tokens-out: 22420
Spend-record: 20261127T015158Z-enforcement-verdicts-tests-spend-snapshot.md
Findings:
- Base guard cannot read the approval rounds · important · change · fixable
- Verdict writer and guard disagree on the checked commit · important · change · fixable
- Guard review reads beyond the checked tree · important · change · later · issues/0020-rare-cases-of-the-verdict-gate.md
- Findings filed in earlier rounds can waive a current fail · important · change · later · issues/0020-rare-cases-of-the-verdict-gate.md
- Narrow issue verdicts are not bound to their diff · important · change · fixable
- Issue filings are not verified at merge · important · change · fixable
- Narrow issue test cases are missing · important · change · fixable
- Failed cause verdict can clear without evidence of a fix · important · change · fixable
- Carry catalogue contradicts the writer · important · change · fixable
- Judged output accepts repository directories · important · change · fixable
Acceptance:
- Carry catalogue contradicts the writer · important · change · fixable
- Verdict writer and guard disagree on the checked commit · important · change · fixable
- Narrow issue verdicts are not bound to their diff · important · change · fixable
- Failed cause verdict can clear without evidence of a fix · important · change · fixable
- Failed cause verdict can clear without evidence of a fix · important · change · fixable
- Judged output accepts repository directories · important · change · fixable
- Base guard cannot read the approval rounds · important · change · fixable

## Notes

- Base guard cannot read the approval rounds: usual path, the step it breaks: the executor opens the pull request of the task and the guard, with main's code, cannot read the records of rounds the new writer wrote, so the merge is refused
- Verdict writer and guard disagree on the checked commit: usual path, the step it breaks: the executor records the verdicts of the review after the commit of the records of gate changes, and the writer stamps another commit than the one the guard requires
- Narrow issue verdicts are not bound to their diff: usual path, the step it breaks: the executor records the one issue of verdicts after the narrow round, and a verdict given on another diff of the same commit satisfies it
- Issue filings are not verified at merge: usual path, the step it breaks: the executor files a rare finding of the issue and finishes the range of fixes, and a filing in an unrelated or removed file still clears the finding
- Narrow issue test cases are missing: usual path, the step it breaks: the executor relies on the tests of the range of fixes when the issue list is empty or a check appears only on the final diff, and no test holds those cases
- Failed cause verdict can clear without evidence of a fix: usual path, the step it breaks: after a failed review of the analysis the executor briefs the next round, and a later pass on the same analysis lets the brief omit the corrected one
- Carry catalogue contradicts the writer: usual path, the step it breaks: the executor implements or checks a carried verdict by the catalogue, whose case says no record while the writer and its test write one
- Judged output accepts repository directories: usual path, the step it breaks: the executor runs test:judged with an evidence directory inside the repository whose name starts with two dots, and the check of item 7 that the output is outside the repository passes it
