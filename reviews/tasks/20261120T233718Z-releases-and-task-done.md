Record: done
Task: releases-and-task
Commit: 361b7552c13a5320e7d00b80830cfbf0d2dd4915
Statement-hash: ced247ff58f273c0640aea217775d5feb1c2006fd37907ff89150bc98573236c
Budget-new-input: 3000000
Budget-output: 1500000
Budget-reserve: 1.5
Time: 2026-11-20T23:37:18Z
Checks:
- npm test · pass
- node tools/ont-check/ont-check.mjs --config ont.config.json · pass
- node tools/ont-check/ont-check.mjs --config example/ont.config.json · pass
