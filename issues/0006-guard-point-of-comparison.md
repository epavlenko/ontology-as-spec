# #6 The guard compares an accepted entry with the text it was accepted with

A gap of the guard the review of task tree-refresh found, recorded as a ticket and in [docs/limitations.md](../docs/limitations.md) as the owner asked in his answer "1006 a" of 2026-11-20.

## Slice

IDs: `rule.guard-from-acceptance`, a target the ontology does not implement yet.

Checks: `check.decision.compared-with-acceptance`.

Why now: the owner answered D-131, "1008 a" of 2026-11-20, which accepts it as it stands. The guard compares an accepted entry with `HEAD`, or with the base CI gives it, so an edit committed with the hook skipped becomes the text it then protects, and CI misses the edit of an entry accepted after its base. Which commit should be the point of comparison, the first that accepted the entry, and from which commit on, so that edits merged before the change do not fail the check, is decided by D-131 in [decisions.md](../decisions.md), and was the open question "The guard's point of comparison" in [docs/limitations.md](../docs/limitations.md). `rule.guard-from-acceptance` states it as a target, ready to take.

## Out of scope

- Any change to what counts as an accepted entry or as its text.
- Restoring entries edited before the change; the answer to D-131 says from which commit on the guard compares.

## Depends on

Nothing: D-131 is accepted.

## Done when

```bash
npm run gap -- issues/0006-guard-point-of-comparison.md   # SLICE_DONE
npm test
```

`SLICE_DONE` means `rule.guard-from-acceptance` is in the implementation table and `check.decision.compared-with-acceptance` has a test: an entry accepted after the base and edited in a later commit with the hook skipped is refused whatever the base, the restore of its accepted text is not, and an entry edited before the starting commit is not.

## Pre-authorized

- commit: allowed on a task branch; every change ends with a commit of its own files (D-54)
- push: only with the owner's yes, since the repository is public
