## Keep product meaning current

Product meaning lives in `<path>/ontology.md` (one table per entity, then screens; every concept is one definition row, grouped by kind, and those rows are the only definitions) and `<path>/decisions.md` (every product decision with its reason). The mockup, the UI-to-ontology map, the check catalogue, the tickets, the test titles and the anchored doc pages refer to concepts by permanent ID. `node tools/ont-check/ont-check.mjs --config <path>/ont.config.json` cross-checks them, and `node tools/ont-check/guard-decisions.mjs --config <path>/ont.config.json` refuses edits to accepted decisions; both run on commit and in CI.

Start every task from the ontology IDs it touches. If a concept you need has no ID, propose its definition row, in its entity's table, before writing code or markup.

| You changed                                        | Also update                                                                                                                           | Verify               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A concept, rule, invariant or view in the ontology | regenerate the tooltips and, for a field or relation, the contracts; a revision history line; a decision entry when the reason is new | the check            |
| A rule, invariant, hook or action in the ontology  | its check in the catalogue, before the code                                                                                           | the check            |
| The mockup                                         | `data-ont` on every new meaningful element and its map row                                                                            | the check            |
| Behavior in code                                   | the implementation table and known divergences; a test titled with the tag of the IDs it proves                                       | the check, the tests |
| Your mind about an earlier decision                | a new dated entry that supersedes the old one, named on its `Supersedes:` line; never edit the old one                                                                 | the check, the guard |
| A ticket                                           | an `IDs:` line and the checks of the slice; new behavior goes into the catalogue first                                                | the check            |
| A concept becomes implemented                      | tests that implement its automatic checks, titled with the check IDs                                                                  | the check, the tests |
| A definition row that a help page explains         | reread the sections the check lists, then `stamp-docs.mjs`; regenerate the reference pages                                            | the check            |

Generated files are never edited by hand; the check compares them with what the generators write.

Rules the check cannot enforce:

- IDs are permanent. Renaming a term changes its row's text, never its ID. An ID that has to change goes under "Retired IDs" with its replacement; only the decision log keeps using it.
- Removing a concept is a decision: write the entry and retire the ID; the check then finds every reference left.
- The ontology describes the target. When the code disagrees, record the divergence; do not silently change either side.
- A ticket is a slice of the gap: IDs, checks, out of scope, dependencies, permissions. It does not describe behavior; behavior goes into the catalogue first.
- A tag on a test is a claim that the test implements the check. Do not tag a test that does not.
