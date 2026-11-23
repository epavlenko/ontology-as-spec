# #16 Faults of the tool on the path of the range of fixes

Findings of rounds 1 to 3 of the review of the result of task enforcement-after-condition, each a rare history here and a fault of the tool, filed as `later` rather than in `docs/limitations.md`, as `rule.findings-filed` routes a fault of the tool:

- class "reissued acceptance drops the narrow-round findings" (rounds 1 and 2): `tools/ont-check/tasks.mjs:416` selects the reissue as the last round, so a clean reissue of the verdict of acceptance can erase the narrow round's findings from the next action; also `tools/ont-check/tasks.mjs:719`, `tools/ont-check/review-rounds.mjs:284` and `docs/parts/agent-rules.md:118`, as round 1 gives them.
- class "clean update from main invalidates verdicts in the fix range" (rounds 1 and 2): `tools/ont-check/tasks.mjs:457` compares the working tree directly with the commit of the record of done, so where `verdicts.require` is set a clean update from main that changes a file outside the records can make a verdict of the one issue missing though `records-only` accepts the merge; also `tools/ont-check/ont-check.mjs:1324` and `tools/ont-check/merge-gate.mjs:412`, as round 1 gives them.
- class "task readers omit the pre-done range end" (round 3): before done, `--task` and `--rounds` get no end of the range, as `stepNext` is given no head; `tools/ont-check/tasks.mjs:414`, `:426` and `:632`.
- class "done can be written while the acceptance verdict is pending" (round 3): after a narrow round with a missing or refused verdict of acceptance, `NEXT` gives the reissue to the reviewer, while `taskNext` classifies it as work and `done.mjs` records done; `tools/ont-check/tasks.mjs:751`, `tools/ont-check/done.mjs:43`, and the test that expects the write, `tools/ont-check/test/tasks.test.mjs:1824` and `:1836`.

The lines are those of the commits the rounds reviewed.

## Slice

IDs: `rule.fixes-held-by-tests`, `derived.task-next`, `action.record-done`, `derived.current-run`.

Checks: `check.review-round.fixes-after-narrow`.

Why now: each case needs a history that is rare in this repository, a narrow round without its verdict of acceptance or a project that sets `verdicts.require`, so none breaks a step of the usual work of the goal; each is still a place where the one function of the range or the kinds of the next action do not hold what `rule.fixes-held-by-tests` says, and a project on that path would meet it.

## Out of scope

- Whether the one issue of verdicts was given and whether each fix has a test of its own, which the task enforcement-verdicts-tests covers.

## Depends on

The merge of the tasks enforcement-merge-gate and enforcement-after-condition, whose range of fixes these cases are in.
