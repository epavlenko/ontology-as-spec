Seal: v1 46cd3c1002e5fae1e71516aecdbbddd3c06ce9199832cb6350fac64f07388191
Record: done
Task: enforcement-tool-records
Commit: 338e90620edf57c31e595e40d0c4a5a3ce63fd81
Statement-hash: a60f13206d300f1d2266ed11a1d592f881434d42ad4ed0dc7e31f00ae5f5d6cb
Budget-new-input: 5000000
Budget-output: 1000000
Budget-reserve: 1.5
Goal: enforcement
Time: 2026-11-24T01:17:27Z
Checks:
- npm test · pass
- node tools/ont-check/ont-check.mjs --config ont.config.json · pass
- node tools/ont-check/ont-check.mjs --config example/ont.config.json · pass
