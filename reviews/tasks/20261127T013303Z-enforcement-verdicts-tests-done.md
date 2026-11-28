Seal: v1 c4fe2e005f2e5e65d4f06c53af81151b0625f7fa514227595ae9ff0d4ed5d8db
Record: done
Task: enforcement-verdicts-tests
Commit: 6d1e401fa0f1055c73e17afb133921efaf6e223c
Statement-hash: f4bbc86906494453e091d65882530eb48f4313cbe01e1ffeff674bf897e1d8e3
Budget-new-input: 12600000
Budget-output: 1300000
Budget-reserve: 1.5
Goal: enforcement
Time: 2026-11-27T01:33:03Z
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
