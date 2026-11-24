Seal: v1 336d69078bc2b8027efb272f62f5312f67c1f5fe672367990c7e4f6b5a8b6456
Record: fixes
Task: enforcement-tool-records
Round: 20261124T003213Z-enforcement-tool-records-result-7.md
Time: 2026-11-24T01:02:39Z
Tests:
- Gate proof records the readback base instead of the checked base · tools/ont-check/test/tool-records.test.mjs · [check.gate-proof.checked-base] a pass records the first parent of its merge commit, not the base read back after the merge, and is refused when that parent is not an ancestor of the head; a refusal records the base it is given
- rollout diagnostics predict the wrong guard result · tools/ont-check/test/tool-records.test.mjs · [check.process-record.check-predicts-guard] a branch that brings the key while its base has none is told of no refusal; after its merge, a later record without a seal is named as refused
