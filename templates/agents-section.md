## Keep product meaning current

Product meaning lives in `<path>/ontology.md` (one table per entity, then screens; every concept is one definition row, grouped by kind, and those rows are the only definitions) and `<path>/decisions.md` (every product decision with its reason). The mockup, the UI-to-ontology map, the verification map, the tickets and the test titles refer to concepts by permanent ID. `node tools/ont-check/ont-check.mjs --config <path>/ont.config.json` cross-checks them, and `node tools/ont-check/guard-decisions.mjs --config <path>/ont.config.json` refuses edits to accepted decisions; both run on commit and in CI.

Start every task from the ontology IDs it touches. If a concept you need has no ID, propose its definition row, in its entity's table, before writing code or markup.

| You changed                                         | Also update                                                                               | Verify               |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------- |
| A concept, rule, invariant or view in the ontology  | regenerate the tooltips; a revision history line; a decision entry when the reason is new | the check            |
| The mockup                                          | `data-ont` on every new meaningful element and its map row                                | the check            |
| Behavior in code                                    | the implementation table and known divergences; a test titled with the tag of the IDs it proves | the check, the tests |
| Your mind about an earlier decision                 | a new dated entry that supersedes the old one; never edit the old one                     | the check, the guard |
| A ticket                                            | an `IDs:` line and one GIVEN/WHEN/THEN line per expected behavior, tagged with its IDs   | the check            |
| A view, action or hook becomes implemented          | a scenario with the ID on its `IDs:` line                                                 | the check            |

Rules the check cannot enforce:

- IDs are permanent. Renaming a term changes its row's text, never its ID. An ID that has to change goes under "Retired IDs" with its replacement; only the decision log keeps using it.
- Never hand-edit the generated tooltip glossary.
- The mockup may not show a concept that has no glossary row.
- Removing a concept removes its definition row, its map rows and its mockup elements in one change, with a decision entry; the ID goes under "Retired IDs".
- The ontology describes the target. When the code disagrees, record the divergence; do not silently change either side.
- A ticket's scenarios and proof commands are written before work starts.
- A tag on a test is a claim that the test proves the concept. Do not tag a test that does not.
