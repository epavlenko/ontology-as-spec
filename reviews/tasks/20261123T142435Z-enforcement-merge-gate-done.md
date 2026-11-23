Record: done
Task: enforcement-merge-gate
Commit: 7d0d3f0271613de7a58604603021f7d23a90cb0c
Statement-hash: 02c025cd3310d96dd58e31e9ce75a02f8c571239489486bc23e0e43b7331d0c4
Budget-new-input: 3000000
Budget-output: 600000
Budget-reserve: 1.5
Time: 2026-11-23T14:24:35Z
Checks:
- npm test · pass
- node tools/ont-check/ont-check.mjs --config ont.config.json · pass
- node tools/ont-check/ont-check.mjs --config templates/ont.config.json · pass
