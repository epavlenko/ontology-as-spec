## Keep product meaning current

Product meaning lives in `<path>/ontology.md` (one table per entity, then screens; every concept is one definition row, grouped by kind, and those rows are the only definitions) and `<path>/decisions.md` (every product decision with its reason). The mockup, the UI-to-ontology map, the check catalogue, the tickets, the test titles and the anchored doc pages refer to concepts by permanent ID. `node tools/ont-check/ont-check.mjs --config <path>/ont.config.json` cross-checks them, and `node tools/ont-check/guard-decisions.mjs --config <path>/ont.config.json` refuses edits to accepted decisions; both run on commit and in CI.

Start every task from the ontology IDs it touches (`rule.start-from-ids`). If a concept you need has no ID, propose its definition row, in its entity's table, before writing code or markup.

| You changed                                        | Also update                                                                                                                                                      | Verify               |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A concept, rule, invariant or view in the ontology | run `format-ontology.mjs`; regenerate the tooltips and, for a field or relation, the contracts; a revision history line; a decision entry when the reason is new | the check            |
| A rule, invariant, hook or action in the ontology  | its check in the catalogue, before the code                                                                                                                      | the check            |
| The mockup                                         | `data-ont` on every new meaningful element and its map row                                                                                                       | the check            |
| Behavior in code                                   | an `ont:` comment naming the concepts the code implements; the implementation table and known divergences; a test titled with the tag of the IDs it proves                                                                  | the check, the tests |
| Your mind about an earlier decision                | a new dated entry that supersedes the old one, named on its `Supersedes:` line; never edit the old one                                                           | the check, the guard |
| A ticket                                           | an `IDs:` line and a `Checks:` line with the checks of the slice; new behavior goes into the catalogue first                                                     | the check            |
| A concept becomes implemented                      | tests that implement its automatic checks, titled with the check IDs                                                                                             | the check, the tests |
| A definition row that a help page explains         | reread the sections the check lists, then `stamp-docs.mjs`; regenerate the reference pages                                                                       | the check            |

Generated files are never edited by hand; the check compares them with what the generators write.

Rules the check cannot enforce:

- When you are corrected, hold the correction at the strongest step that can hold it: the structure of the code, so the mistake cannot be written; then a check, a test or a lint; a rule here only when none of them can (`rule.strongest-step`).
- IDs are permanent. Renaming a term changes its row's text, never its ID. An ID that has to change goes under "Retired IDs" with its replacement; only the decision log keeps using it (`inv.ids-permanent`, `action.change-id`).
- Removing a concept is a decision: write the entry and retire the ID; the check then finds every reference left (`action.remove-concept`).
- The ontology describes the target. When the code disagrees, record the divergence; do not silently change either side (`rule.divergence-becomes-work`).
- Code that implements a concept names its ID next to it in a comment, `// ont: <ID>` (`rule.code-names-concepts`).
- What a partial implementation leaves out is a target concept, named in the note of its row. A note alone hides the work from `--gap` (`rule.partial-noted`).
- A choice the owner has not explicitly approved, such as a value you picked when asked to tune something, is recorded as tentative; the owner's approval accepts it (`rule.unconfirmed-tentative`).
- A number is held as its role needs. A rule's value or a requirement is held by a check. A model's assumptions are held by a snapshot of its base scenario, each change of them is a short entry about its topic, and no check requires the model to reach its goal (`rule.number-by-role`, `rule.chosen-value-checked`).
- A ticket is a slice of the gap: IDs, checks, out of scope, dependencies, permissions. It does not describe behavior; behavior goes into the catalogue first (`rule.ticket-without-behavior`, `action.cut-slice`).
- A tag on a test is a claim that the test implements the check. Do not tag a test that does not (`inv.test-does-what-check-says`).
- A consistency review reports what would mislead a reader or an agent, or would break a check. Style, the completeness of lists and compliance that changes nothing are not findings (`rule.findings-mislead`).
- Every change ends with a commit of its own files, never another agent's (`rule.commit-finished-work`).
- A rule here that comes from a rule of the approach or from a decision names it, by ID or entry; a rule that departs from the approach cites the process entry of the log that decided it (`rule.agent-rule-source`, `rule.departure-by-entry`).
