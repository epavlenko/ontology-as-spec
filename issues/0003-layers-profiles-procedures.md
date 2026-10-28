# #3 The two layers, the profiles, the blind walk and the critic, in the documentation

A slice of the approach's own gap, cut when the owner asked on 2026-10-28 to build every agreed target except the deferred one (D-44, D-50; D-51 stays deferred).

## Slice

IDs: `concept.ontology-layer`, `concept.product-layer`, `ent.profile`, `rule.profile-requires-checkable`, `action.walk-blind`, `action.critique-change`.

Checks: `check.profile.requires-checkable`, `check.divergence.walk-blind`, `check.agent-rules.critique-change`.

Why now: they move from the draft page into the pages a reader follows, once the mechanisms they describe are built.

## Out of scope

Any configuration key for profiles: D-44 gives them none.

## Depends on

#2 Checks a model judges, run by the suites that name them.

## Done when

```bash
npm run gap -- issues/0003-layers-profiles-procedures.md   # SLICE_DONE
npm test
```

## Pre-authorized

- commit: allowed on `main`; every change ends with a commit of its own files (D-54)
- push: only with the owner's yes, since the repository is public
