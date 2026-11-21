Task: round-rules
Step: result-review
Narrow: false
Number: 8
Time: 2026-11-21T14:25:04Z
Commits: 269a87f..d7ef044
By: gpt-6.2-sol (OpenAI, Codex)
Statement-hash: 132246afe5da82c382525de03308a4c94381f6f39f58bc0c80863d48e0f3b8c7
Checks-listed: 61
Checks-given: 61
Checks-carried: 0
Findings:
- owner approval gate · important · change · fixable · check.task-statement.done-of-version
- malformed round coverage · important · change · fixable · check.review-round.malformed-blocks
- review guidance · important · change · fixable · check.task-statement.task-next-documented
Acceptance:
- next-round behaviour · important · change · fixable · check.task-statement.done-of-version
- malformed records · important · change · fixable · check.review-round.malformed-blocks
- documentation · important · change · fixable · check.task-statement.task-next-documented
- done criteria coverage · important · change · fixable · check.task-statement.done-of-version

## Notes

The reviewer says binding records to a hash and a window is a redesign, but several consumers still bypass it; the guide, the skill stamp and the overlap clarification are patches.
