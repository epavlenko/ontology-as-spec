# #6 The guard compares an accepted entry with the text it was accepted with

A gap of the guard the review of task tree-refresh found, recorded as a ticket and in [docs/limitations.md](../docs/limitations.md) as the owner asked in his answer "1006 a" of 2026-11-20.

## Slice

IDs: `inv.accepted-never-edited`.

Checks: `check.decision.accepted-edited`.

Why now: not now. The guard compares an accepted entry with `HEAD`, or with the base CI gives it, so an edit committed with the hook skipped becomes the text it then protects, and CI misses the edit of an entry accepted after its base. Which commit should be the point of comparison, the first that accepted the entry, and from which commit on, so that edits merged before the change do not fail the check, is the open question "The guard's point of comparison" in [docs/limitations.md](../docs/limitations.md); take this up once the owner answers it.

## Out of scope

- Any change to what counts as an accepted entry or as its text.
- Restoring entries edited before the change; the answer to the open question says from which commit on the guard compares.

## Depends on

The owner's answer to the open question "The guard's point of comparison" in [docs/limitations.md](../docs/limitations.md).

## Done when

```bash
npm run gap -- issues/0006-guard-point-of-comparison.md   # SLICE_DONE
npm test
```

The test of `check.decision.accepted-edited` holds the case the answer to the open question settles: an entry accepted after the base and edited in a later commit with the hook skipped, and what the guard then says.

## Pre-authorized

- commit: allowed on a task branch; every change ends with a commit of its own files (D-54)
- push: only with the owner's yes, since the repository is public
