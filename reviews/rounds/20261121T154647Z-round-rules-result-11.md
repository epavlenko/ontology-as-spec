Task: round-rules
Step: result-review
Narrow: false
Number: 11
Time: 2026-11-21T15:46:47Z
Commits: 269a87f..351483a
By: gpt-6.2-sol (OpenAI, Codex)
Statement-hash: 132246afe5da82c382525de03308a4c94381f6f39f58bc0c80863d48e0f3b8c7
Checks-listed: 61
Checks-given: 61
Checks-carried: 0
Findings:
- review status · important · change · fixable · check.task-result.latest-done
- owner approval gate · important · change · fixable · check.review-round.entry-points-agree
- malformed round coverage · important · change · fixable · check.review-round.result-names-version
Acceptance:
- next-round behaviour · important · change · fixable · check.review-round.entry-points-agree
- record handling · important · change · fixable · check.review-round.result-names-version
- documentation · important · change · fixable · check.review-round.result-names-version
- done criteria coverage · important · change · fixable · check.task-result.latest-done

## Notes

The reviewer says the round-10 changes are a redesign: --rounds takes task IDs from every record and delegates its state and NEXT lines to the shared task-state function.
