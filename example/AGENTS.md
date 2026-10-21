# Lending Library: keeping meaning current

> Example of the agent rules section (part 7 in `docs/parts/agent-rules.md`). In a real project this lives in the repository's `AGENTS.md`.

Product meaning lives in `ontology.md` (entities, fields, rules, invariants, views, and the glossary that is the single source of concept definitions) and `decisions.md` (every product decision with its reason). The mockup, the UI-to-ontology map, the verification map, the tickets and the test titles refer to concepts by permanent ID. `tools/ont-check/ont-check.mjs --config example/ont.config.json` cross-checks all of them, and `tools/ont-check/guard-decisions.mjs` refuses edits to accepted decisions; both run on commit and in CI.

Start every task from the ontology IDs it touches. If a concept you need has no ID, the ontology is incomplete: propose the glossary row before writing code or markup.

| You changed                                         | Also update                                                                                      | Verify                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------ |
| A concept, rule, invariant or view in the ontology  | regenerate `mockup/ontology.js`; a revision history line; a decision entry when the reason is new | `ont-check.mjs`                |
| The mockup                                          | `data-ont` on every new meaningful element and its row in `mockup/ontology-map.md`               | `ont-check.mjs`, open the page |
| Behavior in `app/`                                  | the implementation table and "Known divergences" in the ontology; a test whose title starts with the tag of the IDs it proves, for every implemented `inv.*`, `rule.*` and `derived.*` | `ont-check.mjs`, `node --test` |
| Your mind about an earlier decision                 | a new dated entry that supersedes the old one; the old entry is never edited                     | `ont-check.mjs`, `guard-decisions.mjs` |
| A ticket in `issues/`                               | an `IDs:` line and one GIVEN/WHEN/THEN line per expected behavior, tagged with its IDs          | `ont-check.mjs`                |
| A `view.*`, `action.*` or `hook.*` becomes implemented | a scenario in `features/` with the ID on its `IDs:` line                                       | `ont-check.mjs`                |

Rules the check cannot enforce:

- IDs are permanent. Renaming a term changes its glossary text, never its ID.
- Never hand-edit `mockup/ontology.js`; it is generated.
- The mockup may not show a concept that has no glossary row. Write the row first.
- Removing a concept removes it from the glossary, the map and the mockup in one commit, with a decision entry saying why.
- The ontology describes the target. When the code disagrees, record the divergence; do not silently change either side.
- A ticket's scenarios and proof commands are written before work starts.
- A tag on a test is a claim that the test proves the concept. Do not tag a test that does not.
