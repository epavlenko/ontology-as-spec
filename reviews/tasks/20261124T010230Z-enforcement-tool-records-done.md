Seal: v1 5eae245c6b85d64323636a76cfdd81c4826742b439c5b32b2b728e2824e5228a
Record: done
Task: enforcement-tool-records
Commit: 64a42b5abeb5cc5d81a8036897c2e3d76b7f36a3
Statement-hash: a60f13206d300f1d2266ed11a1d592f881434d42ad4ed0dc7e31f00ae5f5d6cb
Budget-new-input: 5000000
Budget-output: 1000000
Budget-reserve: 1.5
Goal: enforcement
Time: 2026-11-24T01:02:30Z
Checks:
- npm test · pass
- node tools/ont-check/ont-check.mjs --config ont.config.json · pass
- node tools/ont-check/ont-check.mjs --config example/ont.config.json · pass
