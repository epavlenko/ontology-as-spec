# #5 Read a mockup's script without the lexer's misses

A divergence the review of D-91 left, recorded instead of more rounds of review, as the thread decided with the owner's leave in his answer of 2026-11-19 to question 928.

## Slice

IDs: `inv.other-word-not-used`.

Checks: `check.other-word.used`.

Why now: not now. The first project that lists other words reports what the check caught and what it missed (D-91); take this up when that report, or a project's mockup, shows a miss of this kind.

## Out of scope

- Reading JavaScript with a full parser; the tool has no dependencies.
- Any change to what counts as the text of a mockup.

## Depends on

Nothing open.

## Done when

```bash
npm run gap -- issues/0005-script-reader-misses.md   # SLICE_DONE
npm test
```

The test of `check.other-word.used` holds `obj . if() / 2` followed by a template with a listed word, and the divergence is gone from `ontology.md`.

## Pre-authorized

- commit: allowed on a task branch; every change ends with a commit of its own files (D-54)
- push: only with the owner's yes, since the repository is public
