Task: enforcement-merge-gate
Step: statement-review
Narrow: false
Number: 3
Time: 2026-11-23T10:29:11Z
Commits: 7b04fb0..7b04fb0
By: gpt-6.2-sol (OpenAI, Codex)
Statement-hash: 2038f6e7310659fc5e88bfbb9f505cf96eeefe4d8b69bb0a1c6b60f2dc4bd4a8
Checks-listed: 0
Checks-given: 0
Checks-carried: 0
Findings:
- ci execution boundary · important · change · fixable
- required result bound to the merge candidate · important · change · fixable
- first activation without a preflight · important · change · fixable
- gate change review and its approval binding · important · change · fixable
- proof records tied to what github evaluated · important · change · fixable
- default policy stopping the guard · important · change · fixable
- guarded paths without the test code · important · change · fixable
- read-only rights declared by the pull request · important · change · fixable
- template adoption reporting a gate before it exists · important · change · fixable
- relative tree path in a temporary worktree · nit · change · fixable

## Notes

The guard on pull_request_target brought new problems in every round, and GitHub will block that trigger by default from 2026-12-02. Version 4 drops it: one required check on pull_request with an up-to-date branch, the repository's default token set to read-only by its settings, which a pull request cannot change, and the change of gate paths reviewed by the reviewer of the result until task 3 lets CI check approvals. A pull request that deliberately weakens its own check is the limitation the owner accepted with answer 1036; one that does it by mistake is caught by that review.
