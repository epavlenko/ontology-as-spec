# 8. Agent workflow

## What it is

How implementation work is framed for agents so that it stays inside the ontology and can run without supervision. Five habits:

1. **Start from the gap.** What is left to build is computed, not listed by hand: target concepts without an implementation, automatic checks without a test, known divergences. `ont-check.mjs --gap` prints it and says what each target waits for; `--next` proposes the next slice of what is ready.
2. **Cut a slice.** A ticket takes a part of the gap: the concepts and checks to build now, what to leave, what it depends on, what the agent may do. What the slice means is already in the ontology and the check catalogue; the ticket does not repeat it.
3. **Finish on commands.** The finish condition is derived: `--gap` with the ticket prints `SLICE_DONE`, and the tests pass. That block is the finish condition, for the agent and for any loop that runs the agent until done.
4. **Review before merge.** An agent of another provider that did not write the slice reviews it against the checks `ont-check --review <base>` lists, with a verdict for each ([part 7](agent-rules.md#an-independent-critic)).
5. **Deliver in slices, each closed by a test.** Slices are ordered by dependency, and each ends with a control test that shows it works before the next one builds on it.

<!-- ont: ent.ticket@030195, rule.ticket-without-behavior@6b6048, action.cut-slice@2b0910, field.ticket.why-now@32d849, field.ticket.out-of-scope@c3f1a2, field.ticket.pre-authorized@5d1fa4, edge.ticket.depends-on@80b97a -->
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

`--gap` with a ticket lists what is left of the slice: its concepts that are still target, with their checks; its automatic checks that have no test; the checks on its `Checks:` line that wait for a concept outside the slice; and the known divergences that name only its concepts. It exits 1 until nothing is left. Only the `Checks:` line lists the checks of the slice; a check named under out of scope is not one of them. A divergence that also names concepts outside the slice is shown apart and does not count: the slice that covers all of its concepts closes it.

Passing tests then mean the slice's checks hold as far as each test does what its check says, and the tool cannot see that. The reviewer reads the new tests next to their checks, and runs the slice's manual checks or reports them as not run.

Pre-authorized lines answer in advance the permissions an agent would otherwise stop and ask for: committing, opening a pull request, driving a browser. A missing line means the repository default.

What a ticket no longer carries: expected behavior (it is in the check catalogue, written before the ticket and kept after it closes), the files to touch (the agent finds them), and a hand-written finish condition (it is derived). If a slice needs a check the catalogue lacks, the check is added to the catalogue first.

Not every ticket is a slice. Refactoring, infrastructure, performance and dependency updates do not change meaning and are ordinary tickets without IDs. With an external contractor, a ticket is also the agreement about what is delivered and accepted; the ontology does not replace that.

<!-- ont: rule.cut-when-started@03d590, rule.ticket-closed-on-done@109f27, rule.coordinator-cuts@f7168b -->
## When a ticket is cut and closed

A ticket is cut when work on its slice starts (`rule.cut-when-started`). Cutting it earlier, to keep a queue, costs more than it seems: a ticket takes its concepts, so `--gap` shows them as "in ticket" and `--next` no longer offers them, and work that nobody does looks taken. The queue the approach keeps is the gap itself, computed fresh each time. Whoever starts the work cuts the ticket, the owner or an agent that takes the slice `--next` proposes; what the agent may do then, commit, push, open a pull request, is the owner's choice, written on the ticket's pre-authorized lines.

When `--gap` with the ticket prints `SLICE_DONE` and the tests pass, the ticket is closed and kept (`rule.ticket-closed-on-done`). A file stays in the tickets directory and a tracker entry is closed, not deleted: the ticket is the record of which slice was built when and within which limits. The check reads only tickets that are files in the repository, so a ticket in a tracker takes nothing in `--gap`, and its concepts stay offered by `--next` while it is open.

A ticket takes its concepts only for agents that can see it. Agents that work at once, each on a branch or a checkout of its own, do not see one another's tickets until they are merged, so each would take the same slice from `--next` and build it twice. When several agents start together, one coordinator cuts all their tickets and commits them to the main branch before any of them starts (`rule.coordinator-cuts`): the coordinator runs `--next`, commits the ticket, and runs it again for the next agent, so no concept is in two tickets. That is still cutting when the work starts, since the work starts with handing it out.

<!-- ont: rule.take-ready@38f877, derived.readiness@346c38, derived.next-slice@187668 -->
## Ready, waiting and deferred

Not every target can be built now. `--gap` says what each one waits for:

- a ticket that already takes it;
- a condition, when an accepted deferral in force names it;
- the owner, when only tentative entries name it, or when an accepted entry that names it names a tentative one;
- another target that its definition row or one of its checks names, while that one is not ready;
- nothing: it is ready.

```text
GAP · Hold
  rule.pickup-window  target, in ticket issues/0003-serve-the-hold-queue.md · checks: …
  action.cancel-hold  target, ready · checks: check.hold.cancel, check.hold.nothing-to-act-on, …
```

Work is taken from what is ready. `--next` proposes the next slice: the ready targets of the first ontology section that has any, the ready targets they depend on, and the checks whose concepts the slice and the code cover, written as the `IDs:` and `Checks:` lines of a ticket. In the example, a check of the state file names both the borrow limit and the cancelling of a hold, so the two are built together.

```text
NEXT · Member
IDs: `action.set-borrow-limit`, `action.cancel-hold`
Checks: `check.member.set-borrow-limit`, `check.member.set-limit-unknown-member`, `check.hold.cancel`, …
```

With nothing ready, it says what the targets wait for, such as `NEXT · nothing ready: 3 wait for the owner (D-07)`. With no target left, it says what else the gap holds, such as `NEXT · no target concept left, but the gap still holds 1 known divergence (--gap lists them)`, and what is deferred, `NEXT · nothing left to build except what is deferred: D-07`; `NEXT · nothing left to build` means that nothing is open or put off. The tool learns that a target waits from the decision log, so an entry names the concepts it decides by ID: a tentative entry that describes a concept without naming it leaves that concept looking ready.

A loop can watch it. A job runs `--next` on a timer and, when a new slice appears, wakes an agent that cuts the ticket and builds it until `SLICE_DONE`. A job that only compares the output with its previous run costs nothing while nothing changes. What the agent may commit, push or merge stays the owner's choice.

## Why commands

An agent can run a list of commands and see whether they pass. It cannot reliably judge whether "the hold queue works" is true. A duration ("work on it for two hours") is not a finish condition either. Commands make the stopping point objective, and that is what lets the human step away.

The same reasoning favors writing the description well before implementation starts. A precise target, with IDs, decisions, checks and a labelled mockup, lengthens the stretch an agent can work alone. Prose by itself does not lengthen it. What does is a checkable condition at the end. The ontology supplies the vocabulary, the catalogue the cases, and the derived finish condition the stopping point.

<!-- ont: rule.slice-one-change@8c5fb0 -->
## Slices and control tests

A slice is one change a reviewer can read, with its own evidence (`rule.slice-one-change`). `--next` proposes the ready targets of one ontology section and what they depend on, and a section can hold three concepts or twenty. When the proposal is more than one change, split it along its dependencies and build first the part the rest depends on; the rest stays in the gap, and `--next` offers it again. No number of concepts marks the limit, since one concept can take a day and five can take an hour; the reviewer is the judge, which is why the check is manual.

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

[`example/issues/0003-serve-the-hold-queue.md`](../../example/issues/0003-serve-the-hold-queue.md): a slice of six concepts and six checks of the hold queue, which is not built yet. `--gap` with it prints `SLICE_OPEN: 7`: the six concepts and the divergence the slice closes. [`example/issues/0004-suspend-instead-of-fines.md`](../../example/issues/0004-suspend-instead-of-fines.md): the slice that closes the other divergence, the fines a decision abolished.
