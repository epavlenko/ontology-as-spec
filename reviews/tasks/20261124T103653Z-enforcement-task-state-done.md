Seal: v1 67cf3ae08141900ace11eeaf89a23bc1b8fe2e4f703c84fd7d65ad53a97f22d8
Record: done
Task: enforcement-task-state
Commit: a4563308dd26a6b374bc004bbd856a9666df8865
Statement-hash: 528eeb1a3f2f43d0ad8a7bea579d354003d986afef79a64349b7199ff1bca703
Budget-new-input: 7000000
Budget-output: 1200000
Budget-reserve: 1.5
Goal: enforcement
Time: 2026-11-24T10:36:53Z
Checks:
- npm test · pass
- node tools/ont-check/ont-check.mjs --config ont.config.json · pass
- node tools/ont-check/ont-check.mjs --config example/ont.config.json · pass
Evidence:
- The rules read before the gate is switched on (item 5), by the one-off job ont-rules-probe of pull request 13 on commit 0724bd2, with the permissions of the required guard (contents: read, metadata: read), then removed:
- RULES epavlenko/ontology-as-spec · fields token: 8 compared with the rule file
- read · enforcement
- read · target
- read · conditions.ref_name.include
- read · conditions.ref_name.exclude
- read · rules
- read · pull_request.allowed_merge_methods
- read · required_status_checks.strict_required_status_checks_policy
- read · required_status_checks.required_status_checks
- RULES_OK
- RULES epavlenko/ontology-as-spec · fields all: 8 compared with the rule file
- read · enforcement
- read · target
- read · conditions.ref_name.include
- read · conditions.ref_name.exclude
- read · rules
- read · pull_request.allowed_merge_methods
- read · required_status_checks.strict_required_status_checks_policy
- read · required_status_checks.required_status_checks
- RULES_OK
- The owner's permission to publish the work of goal enforcement: reviews/tasks/20261124T052400Z-enforcement-publish.md, from the answer to question 1047, option a, read from the registry before the gate is switched on.
