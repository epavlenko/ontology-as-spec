Seal: v1 88f5d7495de9bb7d17ca6b70c039cafffd26352c9b1e780e7a8ef43a840ddc12
Record: fixes
Task: enforcement-tool-records
Round: 20261123T194851Z-enforcement-tool-records-result-2.md
Time: 2026-11-23T20:11:24Z
Tests:
- Statement review loses budget context · tools/ont-check/test/tool-records.test.mjs · [check.spend-snapshot.statement-round-limits] a round of the review of a statement briefed from it and recorded with no statement before any record of done keeps the task's limits and reserve in its snapshot, and --rounds keeps the goal and the limits after the brief is used
- Usual-path test omits the review-verdict writer · tools/ont-check/test/tool-records.test.mjs · [check.process-record.usual-path] rounds, a verdict, done, the owner's approval and answer to a gate, spend, a gate change and a gate proof written by the tool for a task of a goal pass the guard and the full check
