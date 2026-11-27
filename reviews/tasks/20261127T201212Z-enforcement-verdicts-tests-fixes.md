Seal: v1 b543db442c5863a32b77e33dcaba0d4ec17d394039b9f674d0f7d22cf830961b
Record: fixes
Task: enforcement-verdicts-tests
Round: 20261127T185742Z-enforcement-verdicts-tests-result-4.md
Time: 2026-11-27T20:12:12Z
Tests:
- Guard review reads beyond the checked tree · tools/ont-check/test/verdicts-gate.test.mjs · the boundary makes no exception by path
- Failed cause verdict can clear without evidence of a fix · tools/ont-check/test/verdicts-gate.test.mjs · the check of the analysis of the cause is never carried
- Carried abstention loses its reason · tools/ont-check/test/verdicts-gate.test.mjs · a carry of a not-run or a not-applicable keeps its reason only from the record it carries
