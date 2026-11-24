Seal: v1 dff6c50015d08b7921e82c3edeaf53ce838f7a762462d9f170148d7e1b9118fb
Record: done
Task: enforcement-tool-records
Commit: 061c10bf362fd508666e0c4ceabafd4c09d2a59f
Statement-hash: a60f13206d300f1d2266ed11a1d592f881434d42ad4ed0dc7e31f00ae5f5d6cb
Budget-new-input: 5000000
Budget-output: 1000000
Budget-reserve: 1.5
Goal: enforcement
Time: 2026-11-23T20:09:25Z
Checks:
- npm test · pass
- node tools/ont-check/ont-check.mjs --config ont.config.json · pass
- node tools/ont-check/ont-check.mjs --config example/ont.config.json · pass
