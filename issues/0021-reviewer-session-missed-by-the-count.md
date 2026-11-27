# #21 A reviewer's session the count of spend does not see

The count of spend takes a session into a unit when its first message names a task of the unit, and the spend of a round from the session whose message holds the brief's lines (`tools/ont-check/spend.mjs`). In statement rounds 4 and 5 of task enforcement-verdicts-tests the executor gave the reviewer the path of the brief instead of its text, so:

- the reviewer's session named no task in its first message and was counted in neither the goal nor the task;
- in round 4 the round's spend was taken from the executor's own session, whose message carried the reviewer's reply with the brief's lines, so the snapshot of that round holds the executor's few thousand tokens instead of the reviewer's run; `round.mjs record` refused round 5, where no message held the lines, and the round was given again with the brief's text.

The two sessions missed hold about 0.38 M new input. A writer could refuse a round whose spend comes only from an executor's session, and the count could take a session whose messages hold a brief of the unit, not only its first.

## Slice

IDs: `derived.log-spend`, `ent.spend-snapshot`.

Checks: `check.spend-snapshot.counted-from-logs`.

## Depends on

Task enforcement-verdicts-tests.
