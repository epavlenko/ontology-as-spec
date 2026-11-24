Seal: v1 6991621db2693bc6034e6b9088c3c45f4e8db192f6b85e5d6fa3e7beb58ab769
Record: done
Task: enforcement-tool-records
Commit: efb70f9e1a64bec47a57d4e1e0ff40e2c30a2fb5
Statement-hash: a60f13206d300f1d2266ed11a1d592f881434d42ad4ed0dc7e31f00ae5f5d6cb
Budget-new-input: 5000000
Budget-output: 1000000
Budget-reserve: 1.5
Goal: enforcement
Time: 2026-11-24T00:21:02Z
Checks:
- npm test · pass
- node tools/ont-check/ont-check.mjs --config ont.config.json · pass
- node tools/ont-check/ont-check.mjs --config example/ont.config.json · pass
