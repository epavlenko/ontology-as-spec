Seal: v1 cb12e3d7beecf661798ca919f5c01ecd12774046dc6a7e9e2322d9223ed1b567
Record: done
Task: enforcement-task-state
Commit: 8a8fd08e9d1d465df0b1d4b1fc1ff27f52046a4e
Statement-hash: 528eeb1a3f2f43d0ad8a7bea579d354003d986afef79a64349b7199ff1bca703
Budget-new-input: 7000000
Budget-output: 1200000
Budget-reserve: 1.5
Goal: enforcement
Time: 2026-11-24T05:32:51Z
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
