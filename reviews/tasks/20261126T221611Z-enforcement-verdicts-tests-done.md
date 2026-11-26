Seal: v1 7630cc6575e1d1d080533b6b9cd109a6b4c83ce1510fe70c9b772bfdf29f8bb0
Record: done
Task: enforcement-verdicts-tests
Commit: 5cf8e36adb4cd4cfb7d20112f45e505931ac42e7
Statement-hash: daac3ccc8b434445fe9f1fe4cc3c893fb083b283005f840a30aa3b078ae855cc
Budget-new-input: 12600000
Budget-output: 1300000
Budget-reserve: 1.5
Goal: enforcement
Time: 2026-11-26T22:16:11Z
Checks:
- npm test · pass
- npm run --silent test:judged · pass
Evidence:
- Rows of the audit, item 6, each with its tests in tools/ont-check/test/verdicts-gate.test.mjs:
- action.record-verdicts: [check.manual-run.record-classes], [check.merge-gate.verdict-missing] (a refused carry); a record by hand is SEAL_MISSING by task 2
- rule.run-recorded: [check.merge-gate.verdict-missing] (the verdicts only in the reviewer's reply), [check.merge-gate.verdicts-usual-path]
- rule.reviewed-before-merge: [check.agent-rules.reviewed-before-merge], [check.merge-gate.verdict-failed]
- derived.review-checks: [check.merge-gate.verdict-missing] (a check of the list the guard computes outside the table), [check.merge-gate.verdicts-run-nothing]
- rule.code-reviewed-for-errors: [check.merge-gate.verdict-not-of-change], [check.merge-gate.verdicts-usual-path] (a fail with a class filed for later)
- inv.manual-checks-run: [check.merge-gate.verdict-missing], [check.merge-gate.verdicts-usual-path] (a lone not-run with its reason)
- rule.ready-after-clean-round: [check.review-round.ready-after-clean]
- rule.rounds-converge: [check.review-round.round-verdicts-required] (the analysis of the cause asked), [check.merge-gate.round-verdicts-held] (a failed analysis passed again on the same one)
- rule.whole-class: [check.review-round.round-verdicts-required], [check.review-round.ready-after-clean] (a fail of whole-class)
- rule.executor-triage: [check.merge-gate.round-verdicts-held] (a fail of filed-right), [check.review-round.round-verdicts-required]
- rule.findings-filed: [check.merge-gate.round-verdicts-held]; the filing of the closing round, read by no one, is in docs/limitations.md
