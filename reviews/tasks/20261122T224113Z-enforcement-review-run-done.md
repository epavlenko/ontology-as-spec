Record: done
Task: enforcement-review-run
Commit: 7125c066759975a2bf710466e4bd832cbf9d68c5
Statement-hash: df04aed438bb7e1b737e4b0cd8cbe2d7f54f2ac95c50eea842bf6d7d7fecc5bc
Budget-new-input: 5000000
Budget-output: 1000000
Budget-reserve: 1.5
Time: 2026-11-22T22:41:13Z
Checks:
- npm test · pass
- node tools/ont-check/ont-check.mjs --config ont.config.json · pass
- node tools/ont-check/ont-check.mjs --config example/ont.config.json · pass
