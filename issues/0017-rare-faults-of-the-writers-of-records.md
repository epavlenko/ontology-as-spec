# #17 Rare faults of the writers of records and of the guard of seals

Findings of round 1 of the review of the result of task enforcement-tool-records, filed as `later`: each needs an unusual history, and none breaks a step of the usual work of this repository.

- class "goal acceptance disagrees with its own overspend snapshot": a clean acceptance of the goal itself recorded past its reserve gives a snapshot whose goal part the reader drops when the unit is the task (`tools/ont-check/spend.mjs` around 200, 297 and 306, `tools/ont-check/tasks.mjs` around 75).
- class "run freshness checks only endpoint content": a change outside the record directories committed after a run starts and undone before it is recorded is not seen (`tools/ont-check/ont-check.mjs` around 1328).
- class "record history omits merge additions and file modes": a record first added by the resolution of a merge, or whose file mode changes, is compared by its blob alone (`tools/ont-check/merge-gate.mjs` around 243, 255 and 262).
- class "gate proof does not corroborate the merge refusal": the saved answer of GitHub is not tied to the required check the proof credits (`tools/ont-check/gate-record.mjs` around 117 and 123).
- class "rollout diagnostics predict the wrong guard result": on the transition pull request the full check says the guard refuses records that the guard of main accepts (`tools/ont-check/merge-gate.mjs` around 295 and 309).
- class "Spend scope implementation is missing from its row": the choice of the scope of budget in `tools/ont-check/tasks.mjs` and its call in `tools/ont-check/ont-check.mjs` are not in the implementation row of the spend from the logs (`ontology.md` around 1016).
- class "catalogue uses invocation syntax for behavioral cases": three cases of the catalogue name commands (`checks.md` around 187, 266 and 332).
- class "Catalogue uses invocation syntax for behavioral cases": the same finding as the class above, given again by round 6 with a capital letter.
- class "Recorded review history omits the cited result review": D-179 cites as round 6 a review of commit 8c25fd8 that was run but not recorded, because its brief was given as a file and not in the message, so the round writer found no session that held the brief; the record of rounds holds no text of it (`decisions.md` around 1800).
- class "Gate-change refresh carries a missing clause into the approved version" (round 6), and class "Gate refresh fault filed as a design limitation" (round 7), which moved it here from `docs/limitations.md`: `gate-record.mjs change` checks that an item it is given is in the statement, while a refresh of the existing records copies their items onto the new version without that check; it needs a revision of an approved statement that drops or renumbers an item of What to do while gate-change records exist (`tools/ont-check/gate-record.mjs` around 74 and 79).

## Slice

IDs: `ent.process-record`, `inv.records-immutable`, `ent.spend-snapshot`, `action.record-gate-proof`.

Checks: `check.process-record.records-immutable`, `check.gate-proof.writer`.

## Depends on

Task enforcement-tool-records.
