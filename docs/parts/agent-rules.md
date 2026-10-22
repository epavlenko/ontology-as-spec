# 7. Agent rules

<!-- ont: ent.agent-rules@99af23 -->
## What it is

A section in the repository's agent instructions (`AGENTS.md` or its equivalent) that tells any agent how to keep meaning current. It has two parts: a table of what else to update when something changes, and a short list of rules the check cannot enforce.

| You changed                                        | Also update                                                                                | Verify                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------- |
| A concept, rule, invariant or view in the ontology | regenerate the tooltips; a revision history line; a decision entry when the reason is new  | the check                       |
| A rule, invariant, hook or action in the ontology  | its check in the catalogue, before the code                                                | the check                       |
| The mockup                                         | `data-ont` on every new meaningful element and its map row                                 | the check, a browser smoke test |
| Behavior in code                                   | the implementation table and known divergences                                             | the check, the tests            |
| Your mind about an earlier decision                | a new dated entry that supersedes the old one                                              | the check                       |
| A concept becomes implemented                      | tests that implement its automatic checks, titled with the check IDs                       | the check, the tests            |
| A definition row that a help page explains         | reread the sections the check lists, then `stamp-docs.mjs`; regenerate the reference pages | the check                       |

Generated files are never edited by hand; the check compares them with what the generators write.

Rules the check cannot enforce:

- IDs are permanent. Renaming a term changes its row's text, never its ID. An ID that has to change goes under "Retired IDs" with its replacement; only the decision log keeps using it.
- Removing a concept is a decision: write the entry and retire the ID; the check then finds every reference left.
- The ontology describes the target. When the code disagrees, record the divergence; do not silently change either side.

## Why a table

Agents follow explicit procedures well and infer side effects badly. "Remember to keep docs in sync" produces nothing. "You changed the mockup, so add the map row and run this command" produces the map row. The table turns the dependency graph between artifacts into instructions, and the Verify column turns each instruction into something checkable.

The list after the table holds only the rules no check enforces; it exists because some rules have no mechanical check yet. Writing them down is the fallback. When a rule keeps being broken, it should move from the list into the check. Encoding a lesson in structure beats repeating it in prose.

<!-- ont: rule.agent-rules-short@66c9df, rule.agent-rules-point-at-files@13a4c3, rule.start-from-ids@8804d9 -->
## Reference

The rules for the section itself are in the reference: [Agent rules](../reference.md#agent-rules). Keep it short, because it is read at the start of every session and long sections are skimmed. Let every row name a path or a command. Let every task start by naming the IDs it touches: if an agent cannot name them, the task is not about meaning, or the ontology is incomplete. The tool enforces none of this directly; it enforces the consequences, because a skipped row usually fails the check.

## How it fails in practice

- **The table describes an older layout of the repository.** When paths move, update the table in the same change. Include the agent instructions file in the paths that trigger the check.
- **Rules that should be checks stay rules forever.** Review the list from time to time and ask which item could be a check.

## In the example

[`example/AGENTS.md`](../../example/AGENTS.md).
