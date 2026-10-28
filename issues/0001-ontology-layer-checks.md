# #1 The ontology layer names silent changes of meaning and shared terms

A slice of the approach's own gap, cut when the owner asked on 2026-10-28 to build every agreed target except the deferred one (D-44, D-50; D-51 stays deferred).

## Slice

IDs: `derived.meaning-changed`, `inv.one-concept-per-term`.

Checks: `check.decision.meaning-changed`, `check.concept.term-shared`.

Why now: every later slice changes definitions, and these two checks guard such changes.

## Out of scope

The other targets of D-44 and D-50, in tickets 2 to 4.

## Depends on

Nothing open.

## Done when

```bash
npm run gap -- issues/0001-ontology-layer-checks.md   # SLICE_DONE
npm test
```

## Pre-authorized

- commit: allowed on `main`; every change ends with a commit of its own files (D-54)
- push: only with the owner's yes, since the repository is public
