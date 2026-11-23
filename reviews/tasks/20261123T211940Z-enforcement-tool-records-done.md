Seal: v1 d67e5d7cca8dd08c9b5c2c255373d47b06be7e7ccf34215520be482dbe7ad97d
Record: done
Task: enforcement-tool-records
Commit: 232e3af929de8d1337c2b7f308eb2afdbec1bf6b
Statement-hash: a60f13206d300f1d2266ed11a1d592f881434d42ad4ed0dc7e31f00ae5f5d6cb
Budget-new-input: 5000000
Budget-output: 1000000
Budget-reserve: 1.5
Goal: enforcement
Time: 2026-11-23T21:19:40Z
Checks:
- npm test · pass
- node tools/ont-check/ont-check.mjs --config ont.config.json · pass
- node tools/ont-check/ont-check.mjs --config example/ont.config.json · pass
