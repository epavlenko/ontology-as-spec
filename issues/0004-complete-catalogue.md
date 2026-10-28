# #4 A complete catalogue: every outcome of an action covered, and a blind derivation

A slice of the approach's own gap, cut when the owner asked on 2026-10-28 to build every agreed target except the deferred one (D-44, D-50; D-51 stays deferred).

## Slice

IDs: `concept.completeness-axis`, `inv.axis-values-covered`, `rule.check-not-redundant`, `action.derive-blind`.

Checks: `check.check.axis-value-uncovered`, `check.check.redundant`, `check.check.blind-derivation`.

Why now: it is the last agreed target, and D-50 builds it together with judged checks.

## Out of scope

Forbidden terms, deferred by D-51.

## Depends on

#2 Checks a model judges, run by the suites that name them.

## Done when

```bash
npm run gap -- issues/0004-complete-catalogue.md   # SLICE_DONE
npm test
```

## Pre-authorized

- commit: allowed on `main`; every change ends with a commit of its own files (D-54)
- push: only with the owner's yes, since the repository is public
