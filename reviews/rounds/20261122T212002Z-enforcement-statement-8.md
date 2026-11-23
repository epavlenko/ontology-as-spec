Task: enforcement
Step: statement-review
Narrow: false
Number: 8
Time: 2026-11-22T21:20:02Z
Commits: ab24c3f..ab24c3f
By: gpt-6.2-sol (OpenAI, Codex)
Statement-hash: 0af50eaed6ec0e21ed89ececc5dd0745bb859f4e5bbaf475f3652f8e666d4113
Checks-listed: 0
Checks-given: 0
Checks-carried: 0
Findings:
- release entry and tag ordering · important · change · fixable
- owner record read as approval of the whole statement · important · change · fixable
- audit rows ahead of their gates · important · change · fixable
- direct push protection without evidence · important · change · fixable
- publication ban against approved probes · important · change · fixable
- final merge proof depends on acceptance · important · change · fixable

## Notes

Six important findings, as in round 7; the release entry and tag ordering came back, so its design changes: the publication process tags the head of the release pull request before the merge, so an entry never reaches main without its tag. The start of work is checked by the executor against a clean round naming the current hash, as the tool still reads an owner record as approval until task 3.
