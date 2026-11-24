Seal: v1 6c5efc74d04f77204a9dae9bd76e8838eae3588b5ee94660dd507954e703e8b9
Record: done
Task: enforcement-tool-records
Commit: f08dbc374a8ddf188b47c2275101d62b6492dc14
Statement-hash: a60f13206d300f1d2266ed11a1d592f881434d42ad4ed0dc7e31f00ae5f5d6cb
Budget-new-input: 5000000
Budget-output: 1000000
Budget-reserve: 1.5
Goal: enforcement
Time: 2026-11-23T23:56:35Z
Checks:
- npm test · pass
- node tools/ont-check/ont-check.mjs --config ont.config.json · pass
- node tools/ont-check/ont-check.mjs --config example/ont.config.json · pass
