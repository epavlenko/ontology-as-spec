# Lending Library: keeping meaning current

> Example of the agent rules section (part 7 in `docs/parts/agent-rules.md`). In a real project this lives in the repository's `AGENTS.md`.

Product meaning lives in `ontology.md` (one table per entity, then screens; every concept is one definition row, grouped by kind, and those rows are the only definitions) and `decisions.md` (every product decision with its reason). The mockup, the UI-to-ontology map, the check catalogue, the tickets and the test titles refer to concepts by permanent ID. `tools/ont-check/ont-check.mjs --config example/ont.config.json` cross-checks all of them, and `tools/ont-check/guard-decisions.mjs` refuses edits to accepted decisions; both run on commit and in CI.

Start every task from the ontology IDs it touches. If a concept you need has no ID, the ontology is incomplete: propose its definition row, in its entity's table, before writing code or markup.

| You changed                                        | Also update                                                                                                                                                                                                                                                                              | Verify                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| A concept, rule, invariant or view in the ontology | regenerate `mockup/ontology.js` and, for a field or relation, `contracts/ontology.schema.json`; a revision history line; a decision entry when the reason is new                                                                                                                         | `ont-check.mjs`                        |
| The mockup                                         | `data-ont` on every new meaningful element and its row in `mockup/ontology-map.md`                                                                                                                                                                                                       | `ont-check.mjs`, open the page         |
| Behavior in `app/`                                 | the implementation table and "Known divergences" in the ontology; a test whose title starts with the tag of the IDs it proves: a unit test in `app/` for every implemented `inv.*`, `rule.*` and `derived.*`, an end-to-end test in `e2e/` for every implemented `action.*` and `view.*` | `ont-check.mjs`, `node --test`         |
| Your mind about an earlier decision                | a new dated entry that supersedes the old one; the old entry is never edited                                                                                                                                                                                                             | `ont-check.mjs`, `guard-decisions.mjs` |
| A ticket in `issues/`                              | an `IDs:` line and the checks of the slice; new behavior goes into `checks.md` first                                                                                                                                                                                                     | `ont-check.mjs`                        |
| A concept becomes implemented                      | tests that implement its automatic checks in `checks.md`, titled with the check IDs                                                                                                                                                                                                      | `ont-check.mjs`, `node --test`         |
| A definition row that a help page explains         | reread the sections the check lists, then `stamp-docs.mjs`; regenerate the reference pages                                                                                                                                                                                               | the check                              |

Rules the check cannot enforce:

- IDs are permanent. Renaming a term changes its row's text, never its ID. An ID that has to change goes under "Retired IDs" with its replacement; only the decision log keeps using it.
- Never hand-edit `mockup/ontology.js`; it is generated.
- The mockup may not show a concept that has no glossary row. Write the row first.
- Removing a concept removes its definition row, its map rows and its mockup elements in one commit, with a decision entry saying why; the ID goes under "Retired IDs".
- The ontology describes the target. When the code disagrees, record the divergence; do not silently change either side.
- Checks are written in the catalogue before the code. A ticket is a slice of the gap: IDs, checks, out of scope, dependencies, permissions; its finish condition is `--gap` with the ticket printing `SLICE_DONE`.
- A tag on a test is a claim that the test implements the check. Do not tag a test that does not.
