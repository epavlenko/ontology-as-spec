Task: enforcement-merge-gate
Step: statement-review
Narrow: false
Number: 4
Time: 2026-11-23T10:33:13Z
Commits: 7d41535..7d41535
By: gpt-6.2-sol (OpenAI, Codex)
Statement-hash: f130a8d3a574ca7b84b479f376e488633fa9c80abe7fdf90ddb8315abf4817a1
Checks-listed: 0
Checks-given: 0
Checks-carried: 0
Findings:
- ci execution boundary · important · change · not fixable
- required result bound to the merge candidate · important · change · fixable
- first activation without a preflight · important · change · fixable
- gate change review and its approval binding · important · change · fixable
- proof records tied to what github evaluated · important · change · fixable
- guarded paths without the test code · important · change · fixable
- read-only rights declared by the pull request · important · change · fixable
- issuer of the required check · important · change · fixable
- stale branch probe failing for another reason · important · change · fixable
- paths of the tool and pin for a minimal adopter · important · change · fixable
- project package blocking the ci scaffolding · important · change · fixable

## Notes

The goal's approved statement takes the check from main; on a repository of a personal account that needs pull_request_target, which GitHub blocks by default from 2026-12-02 unless the owner allows it in the Actions settings. Asked as registry question 1058; the other findings depend on its answer and are fixed in the next version.
