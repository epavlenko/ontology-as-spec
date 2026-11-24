Seal: v1 5ca2b20c0f4f0f482fdd6f3d66077aeb98908f4a843335d84de89d2b0791e5fa
Record: fixes
Task: enforcement-task-state
Round: 20261124T062823Z-enforcement-task-state-result-2.md
Time: 2026-11-24T06:42:17Z
Tests:
- Rules comparison skips configured settings · tools/ont-check/test/task-state.test.mjs · [check.merge-gate.rules-compared] every parameter of every rule the rule file names is compared, so one approval required where the file says none is a difference, and a list GitHub gives as null is not read
- Incomplete rules read · tools/ont-check/test/task-state.test.mjs · [check.merge-gate.rules-compared] merge-gate.mjs rules refuses a null list of excluded refs, RULES_UNREAD, and --task names the question to the owner when GitHub requires an approval the rule file does not
