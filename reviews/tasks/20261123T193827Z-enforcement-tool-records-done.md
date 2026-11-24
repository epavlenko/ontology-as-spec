Seal: v1 07f134f441888bb0b546dcf35743de3adb70f079dc2e51dfb1e24563e8dd2d6c
Record: done
Task: enforcement-tool-records
Commit: 9de15a7bb3b958c858c01dc13cc1cb73e6dc7eb8
Statement-hash: a60f13206d300f1d2266ed11a1d592f881434d42ad4ed0dc7e31f00ae5f5d6cb
Budget-new-input: 5000000
Budget-output: 1000000
Budget-reserve: 1.5
Goal: enforcement
Time: 2026-11-23T19:38:27Z
Checks:
- npm test · pass
- node tools/ont-check/ont-check.mjs --config ont.config.json · pass
- node tools/ont-check/ont-check.mjs --config example/ont.config.json · pass
