Seal: v1 f757e1e6768cf96254056b276fb2dc75bbdcaa3da04d5547ca3a73590b0e32e7
Record: fixes
Task: enforcement-verdicts-tests
Round: 20261127T154553Z-enforcement-verdicts-tests-result-3.md
Time: 2026-11-27T16:44:34Z
Tests:
- Guard review reads beyond the checked tree · tools/ont-check/test/verdicts-gate.test.mjs · the guard reads no file out of the checked tree
- Findings filed in earlier rounds can waive a current fail · tools/ont-check/test/verdicts-gate.test.mjs · whose class only an earlier round of the window filed is VERDICT_FAILED
- Failed cause verdict can clear without evidence of a fix · tools/ont-check/test/verdicts-gate.test.mjs · the latest verdict of the analysis of the cause decides it
