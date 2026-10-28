# #2 Checks a model judges, run by the suites that name them

A slice of the approach's own gap, cut when the owner asked on 2026-10-28 to build every agreed target except the deferred one (D-44, D-50; D-51 stays deferred).

## Slice

IDs: `inv.judged-check-tested`, `rule.judge-sees-the-check`, `rule.verdict-kept`, `edge.test-suite.checks`, `inv.suite-implements-checks`.

Checks: `check.check.judged-untested`, `check.ticket.judged-check-waits`, `check.test-suite.unimplemented-check`, `check.check.judge-sees-the-check`, `check.check.verdict-kept`.

Why now: a complete catalogue is built together with judged checks (D-50), and the profile for model output needs them.

## Out of scope

Profiles and the procedures that use judged checks, in tickets 3 and 4.

## Depends on

Nothing open.

## Done when

```bash
npm run gap -- issues/0002-judged-checks.md   # SLICE_DONE
npm test
```

## Pre-authorized

- commit: allowed on `main`; every change ends with a commit of its own files (D-54)
- push: only with the owner's yes, since the repository is public
