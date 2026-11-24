Seal: v1 cf34bd99fc9b384cbde27b948f42ecf36faa353183d30dd1ba94b6f4804b5841
Record: done
Task: enforcement-task-state
Commit: c2f7c756cd7581694934c920d75f5217c79c6334
Statement-hash: 528eeb1a3f2f43d0ad8a7bea579d354003d986afef79a64349b7199ff1bca703
Budget-new-input: 7000000
Budget-output: 1200000
Budget-reserve: 1.5
Goal: enforcement
Time: 2026-11-24T06:15:23Z
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
