Task: enforcement-tool-records
Step: statement-review
Narrow: false
Number: 8
Time: 2026-11-23T12:18:43Z
Commits: e0d61be..e0d61be
By: gpt-6.2-sol (OpenAI, Codex)
Statement-hash: c820a8f473afb1cf5ca9ea6b89aa67dda76fff45d771101955f953d9db93cd63
Checks-listed: 0
Checks-given: 0
Checks-carried: 0
Findings:
- spend attribution still incomplete · important · change · fixable
- goal-level work missing the aggregate cap · important · change · fixable
- baseline without the Codex predecessor · important · change · fixable
- standalone task still needing a goal baseline · important · change · fixable
- gate refresh conflicting with immutability · important · change · fixable
- standalone run counting after its input changed · important · change · fixable
- sealed rounds without a way to attach the tests of fixes · important · change · fixable

## Notes

The class of spend came back a fifth time. The next version drops the baseline and the marks: the tool sums the logs afresh from the start of the goal, a task's spend is the sessions whose first message names it, and the executor's own work in a shared session counts to the goal, where the hard stop is; that last part is filed in docs/limitations.md.
