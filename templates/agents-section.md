## Keep product meaning current

Product meaning lives in `<path>/ontology.md` (concepts, rules, invariants, views, and the glossary that is the single source of definitions) and `<path>/decisions.md` (every product decision with its reason). The mockup, the UI-to-ontology map and the verification map refer to concepts by permanent ID. `node tools/ont-check/ont-check.mjs --config <path>/ont.config.json` cross-checks them; it runs on commit and in CI.

Start every task from the ontology IDs it touches. If a concept you need has no ID, propose the glossary row before writing code or markup.

| You changed                                         | Also update                                                                               | Verify               |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------- |
| A concept, rule, invariant or view in the ontology  | regenerate the tooltips; a revision history line; a decision entry when the reason is new | the check            |
| The mockup                                          | `data-ont` on every new meaningful element and its map row                                | the check            |
| Behavior in code                                    | the implementation table and known divergences                                            | the check, the tests |
| Your mind about an earlier decision                 | a new dated entry that supersedes the old one; never edit the old one                     | the check            |
| A view, action or hook becomes implemented          | a scenario with the ID on its `IDs:` line                                                 | the check            |

Rules the check cannot enforce:

- IDs are permanent. Renaming a term changes its glossary text, never its ID.
- Never hand-edit the generated tooltip glossary.
- The mockup may not show a concept that has no glossary row.
- Removing a concept removes it from the glossary, the map and the mockup in one change, with a decision entry.
- The ontology describes the target. When the code disagrees, record the divergence; do not silently change either side.
- A ticket's Done when is written as commands before work starts.
