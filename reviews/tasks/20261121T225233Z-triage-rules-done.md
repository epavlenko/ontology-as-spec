Record: done
Task: triage-rules
Commit: 458137a731ff6310dd2a5e52396192dc8d8c05b5
Statement-hash: d1fbc10928fd00bd2c6e86ae46f21d7eb702a938cda10754a37f5ea0068b7f73
Budget-new-input: 2000000
Budget-output: 400000
Budget-reserve: 1.5
Time: 2026-11-21T22:52:33Z
Checks:
- npm test · pass
- node tools/ont-check/ont-check.mjs --config ont.config.json · pass
- node tools/ont-check/ont-check.mjs --config example/ont.config.json · pass
