Seal: v1 5c47af8f13ed4b62085dde5bb2b170f3dc96f7d1fe433a84c9746be26598b1ef
Record: done
Task: enforcement-tool-records
Commit: 134adaa2f97a7cd6ea25d9787c125360668bc553
Statement-hash: a60f13206d300f1d2266ed11a1d592f881434d42ad4ed0dc7e31f00ae5f5d6cb
Budget-new-input: 5000000
Budget-output: 1000000
Budget-reserve: 1.5
Goal: enforcement
Time: 2026-11-23T22:36:20Z
Checks:
- npm test · pass
- node tools/ont-check/ont-check.mjs --config ont.config.json · pass
- node tools/ont-check/ont-check.mjs --config example/ont.config.json · pass
