Seal: v1 f540aabc1147bc76723cdbcc3213dbea5c63e3c5ebbd8031d934513f52984c62
Record: done
Task: enforcement-tool-records
Commit: 07cd7b26f7fc9d9dc7d79f9dd4354d0f8c2d4f25
Statement-hash: a60f13206d300f1d2266ed11a1d592f881434d42ad4ed0dc7e31f00ae5f5d6cb
Budget-new-input: 5000000
Budget-output: 1000000
Budget-reserve: 1.5
Time: 2026-11-23T19:01:36Z
Checks:
- npm test · pass
- node tools/ont-check/ont-check.mjs --config ont.config.json · pass
- node tools/ont-check/ont-check.mjs --config example/ont.config.json · pass
