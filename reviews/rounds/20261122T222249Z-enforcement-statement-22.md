Task: enforcement
Step: statement-review
Narrow: true
Number: 22
Time: 2026-11-22T22:22:49Z
Commits: 6d2193b..6d2193b
By: gpt-6.2-sol (OpenAI, Codex)
Statement-hash: 5b3c6bded27703600f77675c5d326fa6949a6027cd3a6b80173eeb4fb4c66157
Checks-listed: 0
Checks-given: 0
Checks-carried: 0
Findings:
- publication proof required by the goal check · important · change · fixable
- final proof pull request passing before its merge · important · change · fixable

## Notes

Both findings come from the fix of round 21; version 25 exempts the positive proof of the publication gate from the goal's check, as the statement already exempts it, and makes the check require the commit it runs on to be on main.
