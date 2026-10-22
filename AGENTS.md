# Ontology as Specification: rules for agents

This repository describes an approach to product development: product meaning kept as a semi-formal ontology with permanent concept IDs, referenced by every artifact and checked by a script. Read `README.md` first.

## Layout

- `docs/` describes the approach: principles, the eight parts, lifecycle, comparison, limitations.
- `example/` is a fictional lending library described with the approach, end to end.
- `templates/` holds starting files; the set must pass the check.
- `tools/ont-check/` is the check, the decision guard and the generators of tooltips and contracts, with tests.
- `decisions.md` records decisions about this repository.

## Rules

- **English only** (D-03).
- **Nothing from the source project.** Do not copy content, names, concepts, decisions or screens from the product where the approach emerged, and do not name it (D-01, D-02). Examples use the fictional lending library or generic placeholders. No personal data, no names of partners or contractors.
- **New mechanisms need a decision.** A new check, generator or format rule is recorded in `decisions.md` before it is implemented, and listed in `docs/limitations.md` as not yet tried in a real project (D-05, D-08 to D-17).
- **Accepted decisions are never edited**, here or in the example. Write a superseding entry; `npm run guard` refuses the edit. One entry records one choice and is superseded whole (D-17).
- **Cite primary sources.** A claim about another tool or practice links to its primary source; quotes are verbatim.
- **Keep the example consistent.** It follows its own rules in `example/AGENTS.md`. After editing the example's definition rows, run `npm run generate` to regenerate the tooltips and the contracts.
- **No publishing.** Do not create a remote, push or publish without the owner's explicit approval.

## Verify

```bash
node tools/ont-check/ont-check.mjs --config example/ont.config.json     # ONT_OK
node tools/ont-check/ont-check.mjs --config templates/ont.config.json   # ONT_OK
node --test 'tools/ont-check/test/*.test.mjs' 'example/app/*.test.mjs' 'example/e2e/*.test.mjs'
```

`npm test` runs all three. `npm run guard` compares accepted decision entries with `HEAD`. Enable the pre-commit hook once per clone: `git config core.hooksPath .githooks`; it runs the check and the guard.
