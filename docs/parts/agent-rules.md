# 7. Agent rules

## What it is

A section in the repository's agent instructions (`AGENTS.md` or its equivalent) that tells any agent how to keep meaning current. It has two parts: a table of what else to update when something changes, and a short list of rules the check cannot enforce.

| You changed                                        | Also update                                                                                | Verify                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------- |
| A concept, rule, invariant or view in the ontology | regenerate the tooltips; a revision history line; a decision entry when the reason is new  | the check                       |
| The mockup                                         | `data-ont` on every new meaningful element and its map row                                 | the check, a browser smoke test |
| Behavior in code                                   | the implementation table and known divergences                                             | the check, the tests            |
| Your mind about an earlier decision                | a new dated entry that supersedes the old one                                              | the check                       |
| A concept becomes implemented                      | tests that implement its automatic checks, titled with the check IDs                       | the check, the tests            |
| A definition row that a help page explains         | reread the sections the check lists, then `stamp-docs.mjs`; regenerate the reference pages | the check                       |

Rules the check cannot enforce:

- IDs are permanent. Renaming a term changes its row's text, never its ID. An ID that has to change goes under "Retired IDs" with its replacement; only the decision log keeps using it.
- Never hand-edit the generated glossary.
- The mockup may not show a concept that has no glossary row.
- Removing a concept removes its definition row, its map rows and its mockup elements in one change, with a decision entry; the ID goes under "Retired IDs".
- The ontology describes the target. When the code disagrees, record the divergence; do not silently change either side.

## Why a table

Agents follow explicit procedures well and infer side effects badly. "Remember to keep docs in sync" produces nothing. "You changed the mockup, so add the map row and run this command" produces the map row. The table turns the dependency graph between artifacts into instructions, and the Verify column turns each instruction into something checkable.

The second list exists because some rules have no mechanical check yet. Writing them down is the fallback. When a rule keeps being broken, it should move from the list into the check. Encoding a lesson in structure beats repeating it in prose.

## Rules for the rules

- **Keep it short.** The section is read at the start of every session. Long sections are skimmed.
- **Point at files, not at ideas.** Every row names a path or a command.
- **Start every task from IDs.** The instruction "name the ontology IDs this task touches before writing code" belongs here or in the workflow ([part 8](agent-workflow.md)). If an agent cannot name them, either the task is not about product meaning or the ontology is incomplete.

## What the check enforces

Nothing directly. The check enforces the consequences: if an agent skipped a row of the table, the check usually fails.

## How it fails in practice

- **The table describes an older layout of the repository.** When paths move, update the table in the same change. Include the agent instructions file in the paths that trigger the check.
- **Rules that should be checks stay rules forever.** Review the list from time to time and ask which item could be a check.

## In the example

[`example/AGENTS.md`](../../example/AGENTS.md).
