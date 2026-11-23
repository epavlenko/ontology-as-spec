Seal: v1 92e9270ab8e4d4cbf05f4e16dad2041ef537aa8fc8ab99272428e701744d2eea
Record: done
Task: enforcement-tool-records
Commit: 8c25fd8cfa78ae113f811f11c26366be3349600b
Statement-hash: a60f13206d300f1d2266ed11a1d592f881434d42ad4ed0dc7e31f00ae5f5d6cb
Budget-new-input: 5000000
Budget-output: 1000000
Budget-reserve: 1.5
Goal: enforcement
Time: 2026-11-23T23:22:24Z
Checks:
- npm test · pass
- node tools/ont-check/ont-check.mjs --config ont.config.json · pass
- node tools/ont-check/ont-check.mjs --config example/ont.config.json · pass
