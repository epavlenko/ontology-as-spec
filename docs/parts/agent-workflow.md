# 8. Agent workflow

## What it is

How implementation work is framed for agents so that it stays inside the ontology and can run without supervision. Four habits:

1. **Start from the gap.** What is left to build is computed, not listed by hand: target concepts without an implementation, automatic checks without a test, known divergences. `ont-check.mjs --gap` prints it.
2. **Cut a slice.** A ticket takes a part of the gap: the concepts and checks to build now, what to leave, what it depends on, what the agent may do. What the slice means is already in the ontology and the check catalogue; the ticket does not repeat it.
3. **Finish on commands.** The finish condition is derived: `--gap` with the ticket prints `SLICE_DONE`, and the tests pass. That block is the finish condition, for the agent and for any loop that runs the agent until done.
4. **Deliver in slices, each closed by a test.** Slices are ordered by dependency, and each ends with a control test that shows it works before the next one builds on it.

<!-- ont: ent.ticket@030195, rule.ticket-without-behavior@6b6048, action.cut-slice@2b0910 -->
## Tickets are slices of the gap

The target ontology already says what to build, and the check catalogue says how to know it works. A ticket adds what neither of them holds, because it is process, not meaning: which part of the gap now, in which order, within which limits.

```markdown
# #3 Serve the hold queue: reservation on return and the pickup window

## Slice
IDs: `hook.hold-ready`, `hook.hold-expire`, `concept.reservation`, `rule.pickup-window`, `inv.queue-order`, `derived.available`.
Checks: `check.hold.reserve-on-return`, `check.hold.served-in-order`, `check.hold.expiry-passes-on`, …
Why now: a returned item goes to whoever comes first, ahead of the members waiting for it.

## Out of scope
Delivering notifications; `action.cancel-hold` and the screens, although they are target too.

## Depends on
Nothing open.

## Done when
node tools/ont-check/ont-check.mjs --config example/ont.config.json --gap example/issues/0003-serve-the-hold-queue.md   # SLICE_DONE
node --test 'example/app/*.test.mjs' 'example/e2e/*.test.mjs'

## Pre-authorized
- commit: allowed on the task branch
- PR: not yet
```

`--gap` with a ticket lists the slice's concepts that are still target, with their checks, and the slice's automatic checks that have no test, and exits 1 until there are none. Tests passing then means those checks hold. Pre-authorized lines answer in advance the permissions an agent would otherwise stop and ask for: committing, opening a pull request, driving a browser. A missing line means the repository default.

What a ticket no longer carries: expected behavior (it is in the check catalogue, written before the ticket and kept after it closes), the files to touch (the agent finds them), and a hand-written finish condition (it is derived). If a slice needs a check the catalogue lacks, the check is added to the catalogue first.

Not every ticket is a slice. Refactoring, infrastructure, performance and dependency updates do not change meaning and are ordinary tickets without IDs. With an external contractor, a ticket is also the agreement about what is delivered and accepted; the ontology does not replace that.

## Why commands

An agent can run a list of commands and see whether they pass. It cannot reliably judge whether "the hold queue works" is true. A duration ("work on it for two hours") is not a finish condition either. Commands make the stopping point objective, and that is what lets the human step away.

The same reasoning favors writing the description well before implementation starts. A precise target, with IDs, decisions, checks and a labelled mockup, lengthens the stretch an agent can work alone. Prose by itself does not lengthen it. What does is a checkable condition at the end. The ontology supplies the vocabulary, the catalogue the cases, and the derived finish condition the stopping point.

## Slices and control tests

Order the slices by what everything else depends on, and close each with a test that would expose a wrong foundation. A typical first stage is the one whose mistakes would poison everything after it: a classification, a routing decision, a data import. Its control test runs a realistic, deliberately messy input through the real code and scores the result against expectations, with a recorded baseline. Later stages may not start until the control test of the stage they build on passes.

This is how the approach meets the objection that full specifications ignore what you learn during implementation. The ontology is complete enough to work from, and implementation still teaches things. When a slice teaches something, it goes into the decision log, and the ontology changes before the next slice.

## Reporting back

- Claims carry evidence or a label: measured, inferred or guessed.
- Long unattended runs keep a decision trail (one line per decision, with a pointer to the evidence) outside the repository, attached to the ticket when the work is handed back.
- A paused task leaves a resume note on the ticket: branch, what is done and verified, what is open, the first action on resume.

<!-- ont: inv.ticket-has-ids@679ecd, inv.ticket-checks-related@4a64b7 -->
## Reference

The fields of a ticket, its rules and checks are in the reference: [Ticket](../reference.md#ticket). When tickets are files in the repository, the tool checks them; tickets kept in a tracker are not checked, though `--gap` still computes the gap they are cut from. Tickets written before the check catalogue may still carry one-line GIVEN/WHEN/THEN scenarios, which the tool validates as before.

## How it fails in practice

- **Done when written as prose only.** The agent stops when it feels done. Use the derived condition; if the slice's checks do not exist yet, the ticket is not ready.
- **Tickets without IDs** for product work. The agent builds from the ticket text and drifts from the ontology.
- **Behavior described in the ticket** instead of in the catalogue. It is lost when the ticket closes, and the next rewrite cannot find it.
- **Stages started out of order** because a later stage is more visible. The control test of the earlier stage exists to stop exactly that.

## In the example

[`example/issues/0003-serve-the-hold-queue.md`](../../example/issues/0003-serve-the-hold-queue.md): a slice of six concepts and six checks of the hold queue, which is not built yet. `--gap` with it prints `SLICE_OPEN: 6`.
