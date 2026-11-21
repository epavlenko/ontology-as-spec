Task: round-rules
Step: result-review
Narrow: false
Number: 12
Time: 2026-11-21T16:09:07Z
Commits: 269a87f..92192fb
By: gpt-6.2-sol (OpenAI, Codex)
Statement-hash: 132246afe5da82c382525de03308a4c94381f6f39f58bc0c80863d48e0f3b8c7
Checks-listed: 61
Checks-given: 61
Checks-carried: 0
Findings:
- legacy task versioning · important · change · fixable · check.task-statement.gates-from
Acceptance:
- decision · important · change · fixable · check.task-statement.gates-from
- next-round behaviour · important · change · fixable · check.review-round.entry-points-agree
- documentation · important · change · fixable · check.doc-section.reread-before-stamp
- done criteria coverage · important · change · fixable · check.task-statement.gates-from

## Notes

The reviewer says the shared cutoff rule is a redesign of record compatibility, but the date may govern only the reading of old records; tasks that already used versioned approvals keep those guards. The stale-acceptance label fix is a patch reusing the acceptance predicate.
