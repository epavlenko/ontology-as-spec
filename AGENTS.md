# Ontology as Specification: rules for agents

This repository describes an approach to product development: product meaning kept as a semi-formal ontology with permanent concept IDs, referenced by every artifact and checked by a script. Read `README.md` first.

## Layout

- `docs/` explains the approach: principles, the nine parts, lifecycle, comparison, limitations. It is a doc set of the approach's ontology: sections carry anchors, and `docs/reference.md` is generated. A rule of the approach is changed in `ontology.md` and `checks.md`, then explained here; never edit `docs/reference.md`.
- `example/` is a fictional lending library described with the approach, end to end.
- `templates/` holds starting files; the set must pass the check.
- `tools/ont-check/` is the check, the decision guard, and the generators of tooltips, contracts and reference pages, with tests.
- `ontology.md` and `checks.md` describe the approach with itself: its concepts, rules and checks. `ont.config.json` checks them; the tests in `tools/ont-check/test/` implement the checks.
- `decisions.md` records decisions about this repository.

## Rules

- **English only** (D-03).
- **Nothing from the source project.** Do not copy content, names, concepts, decisions or screens from the product where the approach emerged, and do not name it (D-01, D-02). Examples use the fictional lending library or generic placeholders. No personal data, no names of partners or contractors.
- **New mechanisms need a decision.** A new check, generator or format rule is recorded in `decisions.md` before it is implemented, and listed in `docs/limitations.md` as not yet tried in a real project (D-24).
- **Unapproved is tentative.** A choice the owner has not explicitly approved is recorded as tentative; the owner's approval accepts it (D-34).
- **Accepted decisions are never edited**, here or in the example. Write a superseding entry; `npm run guard` refuses the edit. One entry answers one question; a later entry adds to it or supersedes it whole (D-26).
- **Finished work.** A finished task, its checks passing, ends with a commit where the owner lets agents commit; otherwise say which accepted entries are not protected yet (D-42).
- **Findings that matter.** A consistency review reports what would mislead a reader or an agent, or would break a check. Style, the completeness of lists and compliance that changes nothing are not findings. (D-27)
- **Cite primary sources.** A claim about another tool or practice links to its primary source; quotes are verbatim.
- **Keep the example consistent.** It follows its own rules in `example/AGENTS.md`. After editing the example's definition rows, run `npm run format` and `npm run generate` to regenerate the tooltips, the contracts and the reference pages.
- **No publishing.** Do not create a remote, push or publish without the owner's explicit approval.

## Verify

```bash
node tools/ont-check/ont-check.mjs --config ont.config.json             # ONT_OK: the approach itself
node tools/ont-check/ont-check.mjs --config example/ont.config.json     # ONT_OK
node tools/ont-check/ont-check.mjs --config templates/ont.config.json   # ONT_OK
node --test 'tools/ont-check/test/*.test.mjs' 'example/app/*.test.mjs' 'example/e2e/*.test.mjs'
```

`npm test` runs all four and the guard. A change to a rule of the approach starts in `ontology.md` and `checks.md`, like any product change. `npm run guard` compares accepted decision entries with `HEAD`. Enable the pre-commit hook once per clone: `git config core.hooksPath .githooks`; it runs the check and the guard.
