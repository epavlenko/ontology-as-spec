Seal: v1 82b7f55ec099eb90a5ed92755cca91af1e514dcc179df926d710a0d83780289f
Record: done
Task: enforcement-tool-records
Commit: 52a447789ddd39bd34309d124f66407dbacb7476
Statement-hash: a60f13206d300f1d2266ed11a1d592f881434d42ad4ed0dc7e31f00ae5f5d6cb
Budget-new-input: 5000000
Budget-output: 1000000
Budget-reserve: 1.5
Goal: enforcement
Time: 2026-11-23T20:53:57Z
Checks:
- npm test · pass
- node tools/ont-check/ont-check.mjs --config ont.config.json · pass
- node tools/ont-check/ont-check.mjs --config example/ont.config.json · pass
