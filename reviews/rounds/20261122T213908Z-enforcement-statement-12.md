Task: enforcement
Step: statement-review
Narrow: false
Number: 12
Time: 2026-11-22T21:39:08Z
Commits: d8be44a..d8be44a
By: gpt-6.2-sol (OpenAI, Codex)
Statement-hash: 28b31bb59cab6914e95e7641b754be03f760c8a1f5367237db285db82c922f59
Checks-listed: 0
Checks-given: 0
Checks-carried: 0
Findings:
- audit rows ahead of their gates · important · change · fixable
- task state gate and records only pull requests · important · change · fixable
- start check without the open owner gate · important · change · fixable
- tree refresh after a server merge · important · change · fixable

## Notes

The class of audit rows ahead of their gates came back again because the executor moved rows one by one. Version 14 changes how the allocation is built: a row goes to the latest task among the gates its proof needs, computed for every row at once, so a row proven by a reviewer's verdict is never closed before task 4.
