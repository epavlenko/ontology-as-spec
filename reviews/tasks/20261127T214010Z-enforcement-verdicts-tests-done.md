Seal: v1 a12db2ef23ab9233939540e89caa323e8aff287e49af6178c34d2b824efc65b2
Record: done
Task: enforcement-verdicts-tests
Commit: c495e69fcd09121ba5b897353ada535dfbc16898
Statement-hash: ddc3ba4db42c49460a6ab0ed8b9d96e657db4f6dffc5f24ce0b90a0fe33bd72b
Budget-new-input: 40000000
Budget-output: 4000000
Budget-reserve: 1.5
Goal: enforcement
Time: 2026-11-27T21:40:10Z
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
