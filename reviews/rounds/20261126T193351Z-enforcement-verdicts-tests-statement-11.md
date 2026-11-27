Seal: v1 3b83dc842bdc67721a99ccfe5050343b5a9d37857059f0f19c439d707074c989
Task: enforcement-verdicts-tests
Step: statement-review
Narrow: false
Number: 11
Time: 2026-11-26T19:33:51Z
Commits: 13c0dd44fe8bd8c2906bf49a3484897cc959957a
By: gpt-6.2-sol, OpenAI Codex
Statement-hash: 924d8e99fb678c75c2758b58bd08523f5ad267412255485904ecb072a3e61555
Gate-paths: package.json, ont.config.json, tools/ont-check/approach.json, tools/ont-check/ont-check.mjs, tools/ont-check/manual-runs.mjs, tools/ont-check/round.mjs, tools/ont-check/tasks.mjs, tools/ont-check/merge-gate.mjs, tools/ont-check/review.mjs, tools/ont-check/done.mjs, tools/ont-check/judge.mjs, tools/ont-check/lib.mjs, tools/ont-check/review-rounds.mjs, tools/ont-check/briefs.mjs, tools/ont-check/README.md, tools/ont-check/test/verdicts-gate.test.mjs, tools/ont-check/test/manual-runs.test.mjs, tools/ont-check/test/review-run.test.mjs, tools/ont-check/test/review-rounds.test.mjs, tools/ont-check/test/merge-gate.test.mjs, tools/ont-check/test/tasks.test.mjs, tools/ont-check/test/judge.test.mjs, tools/ont-check/test/options-documented.test.mjs
Brief-time: 2026-11-26T19:26:09Z
Tokens-new: 180249
Tokens-cached: 3322504
Tokens-out: 14212
Spend-record: 20261126T193351Z-enforcement-verdicts-tests-spend-snapshot.md
Cause: 6effedd5f4297388a2d4b7473f668daca6ae850e51e672190cd90713d031490f
Findings:
- Narrow issue coverage · important · change · fixable
- Configuration gate paths missing · important · change · fixable
- Failed cause verdict can clear without evidence of a fix · important · change · fixable

## Notes

- Narrow issue coverage: usual path, the step it breaks: an ordinary test change and a later fix to a settings file together select checks on the full diff that neither incremental diff selects, or the review after the issue finds a defect whose fix moves the commit its verdict must name, and done cannot be recorded without repeating the issue
- Configuration gate paths missing: usual path, the step it breaks: required CI runs the existing test of the round writer, tools/ont-check/test/tool-records.test.mjs, which asserts the behaviour the work changes
- Failed cause verdict can clear without evidence of a fix: usual path, the step it breaks: a result is merged after a failed review of its stagnation analysis and a later clean closing round, with no corrected analysis
