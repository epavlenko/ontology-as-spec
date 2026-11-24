# #17 Rare faults of the writers of records and of the guard of seals

Findings of round 1 of the review of the result of task enforcement-tool-records, filed as `later`: each needs an unusual history, and none breaks a step of the usual work of this repository.

- class "goal acceptance disagrees with its own overspend snapshot": a clean acceptance of the goal itself recorded past its reserve gives a snapshot whose goal part the reader drops when the unit is the task (`tools/ont-check/spend.mjs` around 200, 297 and 306, `tools/ont-check/tasks.mjs` around 75).
- class "run freshness checks only endpoint content": a change outside the record directories committed after a run starts and undone before it is recorded is not seen (`tools/ont-check/ont-check.mjs` around 1328).
- class "record history omits merge additions and file modes": a record first added by the resolution of a merge, or whose file mode changes, is compared by its blob alone (`tools/ont-check/merge-gate.mjs` around 243, 255 and 262).
- class "gate proof does not corroborate the merge refusal": the saved answer of GitHub is not tied to the required check the proof credits (`tools/ont-check/gate-record.mjs` around 117 and 123).
- class "Spend scope implementation is missing from its row": the choice of the scope of budget in `tools/ont-check/tasks.mjs` and its call in `tools/ont-check/ont-check.mjs` are not in the implementation row of the spend from the logs (`ontology.md` around 1016).
- class "catalogue uses invocation syntax for behavioral cases": three cases of the catalogue name commands (`checks.md` around 187, 266 and 332).
- class "Catalogue uses invocation syntax for behavioral cases": the same finding as the class above, given again by round 6 with a capital letter.
- class "Recorded review history omits the cited result review": D-179 cites as round 6 a review of commit 8c25fd8 that was run but not recorded, because its brief was given as a file and not in the message, so the round writer found no session that held the brief; the record of rounds holds no text of it (`decisions.md` around 1800).
- class "Gate-change refresh carries a missing clause into the approved version" (round 6), and class "Gate refresh fault filed as a design limitation" (round 7), which moved it here from `docs/limitations.md`: `gate-record.mjs change` checks that an item it is given is in the statement, while a refresh of the existing records copies their items onto the new version without that check; it needs a revision of an approved statement that drops or renumbers an item of What to do while gate-change records exist (`tools/ont-check/gate-record.mjs` around 74 and 79).
- class "Gate proof can cite a run from another suite" (narrow round 2): `gate-record.mjs proof` falls back to a workflow run of the same name when no run of the check's suite is in the workflow results (`tools/ont-check/gate-record.mjs` around 194).
- class "Gate proof decision bundles independent choices" (narrow round 2): D-180 also chooses the fallback of the run and the order of the proofs' times, with a reason for the base only (`decisions.md` around 1814).
- class "Gate proof field implementation is missing from its row" (narrow round 2): the implementation row of the base and the run of a gate proof names the parser only, and the writer does not name `field.gate-proof.base` and `field.gate-proof.run` (`ontology.md` around 988, `tools/ont-check/gate-record.mjs` around 24).

## Fixed, no longer rare

- class "rollout diagnostics predict the wrong guard result", filed here by round 1: round 7 found it on the usual path, the full check run on the pull request that brings `records.sealsFrom`, and it is fixed after that round; the full check and pre-commit read the start of seals at the base of the pull request, as the guard does (D-181).

## Slice

IDs: `ent.process-record`, `inv.records-immutable`, `ent.spend-snapshot`, `action.record-gate-proof`.

Checks: `check.process-record.records-immutable`, `check.gate-proof.writer`.

## Depends on

Task enforcement-tool-records.
