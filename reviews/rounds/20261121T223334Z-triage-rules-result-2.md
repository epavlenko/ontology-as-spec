Task: triage-rules
Step: result-review
Narrow: false
Number: 2
Time: 2026-11-21T22:33:34Z
Commits: 5b70e88..ffef5a3
By: gpt-6.2-sol (OpenAI, Codex)
Statement-hash: d1fbc10928fd00bd2c6e86ae46f21d7eb702a938cda10754a37f5ea0068b7f73
Checks-listed: 62
Checks-given: 62
Checks-carried: 0
Findings:
- follow-up round instructions · important · change · fixable · check.review-round.triage-documented
- cross-reader test coverage · important · change · fixable · check.review-round.condition-branch
- approval window reused by hash · nit · change · later · issues/0010-condition-window-by-hash.md
Acceptance:
- confirmed condition · important · change · fixable · check.review-round.triage-documented
- ontology and decision record · important · change · fixable · check.review-round.triage-documented
- tests · important · change · fixable · check.review-round.condition-branch

## Notes

Condition: not yet. The reviewer calls the single end of a step a change of design, and the follow-up wording and the refusal assertion patches. Triage by the thread: follow-up round instructions, usual (a reviewer following the skill, or a reader of the guide or of D-153, asks for a full round after the one follow-up where the owner must be asked); cross-reader test coverage, usual (npm test before a record of done does not observe the check's own decision that a step ended); approval window reused by hash, rare, filed in ticket 10 already. The class of the first finding repeats a third time, so the design changes: the guide and the skill stop restating what follows a round and point to the NEXT line and derived.next-round.
