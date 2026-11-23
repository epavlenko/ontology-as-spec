Task: enforcement
Step: statement-review
Narrow: false
Number: 14
Time: 2026-11-22T21:49:15Z
Commits: f3beaf5..f3beaf5
By: gpt-6.2-sol (OpenAI, Codex)
Statement-hash: 4947d9a975c32a331e7924453313b66e12d2b2a1be98e0f02a9c2ef032119cad
Checks-listed: 0
Checks-given: 0
Checks-carried: 0
Findings:
- audit rows ahead of their gates · important · change · fixable
- live proof of another gate · important · change · fixable
- conflicting merge instructions · important · change · fixable
- pass criterion of the final judged run · important · change · fixable
- stale served tree after a merge · important · change · fixable

## Notes

The class of audit rows ahead of their gates came back once more: an allocation made before the work cannot know every gate a row's proof needs. Version 16 changes the rule rather than the allocation: a task closes a row only when every gate the row's proof needs is on by its merge, and marks the rest as waiting for a later task; whatever is still open is closed by task 7, where all gates are on. The allocation file becomes the list of the task that first touches each row.
