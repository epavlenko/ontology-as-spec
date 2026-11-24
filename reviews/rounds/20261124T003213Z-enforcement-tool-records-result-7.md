Seal: v1 7e7fab43c95111207c07f267ad13cfe4e6b1f9faa2919e252dcd9496b35222b3
Task: enforcement-tool-records
Step: result-review
Narrow: false
Number: 7
Time: 2026-11-24T00:32:13Z
Commits: efb70f9e1a64bec47a57d4e1e0ff40e2c30a2fb5
Done: 20261124T002102Z-enforcement-tool-records-done.md
By: gpt-6.2-sol (OpenAI, Codex)
Statement-hash: a60f13206d300f1d2266ed11a1d592f881434d42ad4ed0dc7e31f00ae5f5d6cb
Brief-time: 2026-11-24T00:22:43Z
Tokens-new: 207516
Tokens-cached: 4066176
Tokens-out: 16425
Spend-record: 20261124T003213Z-enforcement-tool-records-spend-snapshot.md
Findings:
- rollout diagnostics predict the wrong guard result · nit · change · fixable
- Gate proof records the readback base instead of the checked base · important · change · fixable
- Gate refresh fault filed as a design limitation · nit · change · later · issues/0017-rare-faults-of-the-writers-of-records.md
Acceptance:
- rollout diagnostics predict the wrong guard result · nit · change · fixable
- Gate proof records the readback base instead of the checked base · important · change · fixable

## Notes

- rollout diagnostics predict the wrong guard result: usual path, the step it breaks: the executor runs the full check on this pull request, which starts the seals, before recording done, and it reports records the guard of main accepts as refused
- Gate proof records the readback base instead of the checked base: usual path, the step it breaks: after this task merges, the executor records the merge of the next task's pull request as the positive gate proof with gate-record.mjs proof
