Task: triage-rules
Step: result-review
Narrow: false
Number: 1
Time: 2026-11-21T22:04:54Z
Commits: 5b70e88..529ce38
By: gpt-6.2-sol (OpenAI, Codex)
Statement-hash: d1fbc10928fd00bd2c6e86ae46f21d7eb702a938cda10754a37f5ea0068b7f73
Checks-listed: 62
Checks-given: 62
Checks-carried: 0
Findings:
- owner gate explanation · important · change · fixable · check.review-round.condition-gate
- follow-up round instructions · important · change · fixable · check.review-round.triage-documented
- review of triage marks · important · change · fixable · check.review-round.filed-right
- cross-reader test coverage · important · change · fixable · check.review-round.condition-branch
- approval window reused by hash · nit · change · later · issues/0010-condition-window-by-hash.md
- deferred ticket reports completion early · nit · change · fixable · issues/0009-filed-findings-end-a-step-unseen.md
Acceptance:
- executor triage · important · change · fixable · check.review-round.filed-right
- confirmed condition · important · change · fixable · check.review-round.condition-gate
- ontology and decision record · important · change · fixable · check.review-round.triage-documented
- tests · important · change · fixable · check.review-round.condition-branch

## Notes

Condition: not yet. Triage by the thread (a finding is usual only when a step of usual work it breaks is named): owner gate explanation, usual (the owner reads the question after a failed narrow round and cannot tell what to decide); follow-up round instructions, usual (the executor reading the guide or the catalogue is sent to the wrong round); review of triage marks, usual (the narrow-round reviewer skips the marks the executor kept); cross-reader test coverage, usual (npm test passes a fixture whose done command failed, so the executor trusts a false green); approval window reused by hash, rare (a rollback to the exact text of an earlier version), filed as ticket 10; deferred ticket reports completion early, rare, fixed in the ticket's text.
