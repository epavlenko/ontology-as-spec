Record: done
Task: enforcement-review-run
Commit: 41453cd78e717f421566e954f6b0b4c9193d254b
Statement-hash: df04aed438bb7e1b737e4b0cd8cbe2d7f54f2ac95c50eea842bf6d7d7fecc5bc
Budget-new-input: 5000000
Budget-output: 1000000
Budget-reserve: 1.5
Time: 2026-11-23T10:08:21Z
Checks:
- npm test · pass
- node tools/ont-check/ont-check.mjs --config ont.config.json · pass
- node tools/ont-check/ont-check.mjs --config example/ont.config.json · pass
