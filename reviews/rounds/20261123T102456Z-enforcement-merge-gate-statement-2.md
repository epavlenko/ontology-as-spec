Task: enforcement-merge-gate
Step: statement-review
Narrow: false
Number: 2
Time: 2026-11-23T10:24:56Z
Commits: a18636a..a18636a
By: gpt-6.2-sol (OpenAI, Codex)
Statement-hash: b7dd6f69d513780851451fddad4111f1480096394713ee31b8e4ede6bed57a72
Checks-listed: 0
Checks-given: 0
Checks-carried: 0
Findings:
- ci execution boundary · important · change · fixable
- required result bound to the merge candidate · important · change · fixable
- first activation without a preflight · important · change · fixable
- pinned copy verification in ci · important · change · fixable
- template installation before branch protection · important · change · fixable
- gate change review and its approval binding · important · change · fixable
- proof records tied to what github evaluated · important · change · fixable
- required workflow unavailable on the target · important · change · fixable
- evaluate mode requires enterprise · important · change · fixable
- task 2 a prerequisite for its own start · important · change · fixable
- the approach repository has no copy pin · important · change · fixable
- a current tree gives no confirmation · nit · change · fixable

## Notes

The design of version 2 rests on two features GitHub does not give a repository of a personal account: required workflows and evaluate mode. Version 3 changes the design rather than patch it: two required status checks, a full check that runs the pull request's code with a read-only token, and a small guard taken from main by pull_request_target that executes nothing of the pull request and refuses a change of the gate paths without an approval for that diff. A deliberate change of the full check is thus caught by the guard; a deliberate attack by an agent with write access stays the limitation the owner accepted with answer 1036.
