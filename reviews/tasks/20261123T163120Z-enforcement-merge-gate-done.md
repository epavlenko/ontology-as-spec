Record: done
Task: enforcement-merge-gate
Commit: 4c71e1f18db2dceb6ddeafe8b4ff008cf18cad29
Statement-hash: 02c025cd3310d96dd58e31e9ce75a02f8c571239489486bc23e0e43b7331d0c4
Budget-new-input: 3000000
Budget-output: 600000
Budget-reserve: 1.5
Time: 2026-11-23T16:31:20Z
Checks:
- npm test · pass
- node tools/ont-check/ont-check.mjs --config ont.config.json · pass
- node tools/ont-check/ont-check.mjs --config templates/ont.config.json · pass
Evidence:
- Findings of the usual path of the narrow round (reviews/rounds/20261123T155551Z-enforcement-merge-gate-result-narrow-1.md) and their fixes:
- 1. gate limitation omits the clean main merge exception; step: the executor updates the branch with main and reruns the pre-merge checks; fixed in b881c6a, docs/limitations.md section on the final tree, the case held by tools/ont-check/test/merge-gate.test.mjs (check.merge-gate.gate-change-bound, clean merge of main)
- 2. gate-binding explanation under an empty anchor; step: the review of a changed section under check.doc-section.anchored; fixed in b881c6a, the anchor of that section names inv.gate-change-approved and rule.merge-what-was-checked, held by the check of anchors in npm test
- 3. rare-history rationale gives the wrong filing destination: rare history, fixed in b881c6a by ticket issues/0016-faults-of-the-range-of-fixes.md
- Findings of the usual path of the one issue of verdicts (reviews/runs of 20261123T16 today): conflicting merge instructions after a clean narrow round, fixed in 4c71e1f in docs/parts/agent-rules.md and AGENTS.md; narrow-round triage without named steps, answered by this evidence. Its two rare faults are in ticket 16.
