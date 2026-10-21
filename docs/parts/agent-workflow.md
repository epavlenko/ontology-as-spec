# 8. Agent workflow

## What it is

How implementation work is framed for agents so that it stays inside the ontology and can run without supervision. Four habits:

1. **Start from IDs.** Every task names the ontology IDs it touches. The agent reads their glossary rows, the relevant ontology sections and the decisions that mention them before writing code.
2. **State behavior as tagged scenarios.** The expected behavior is a list of GIVEN/WHEN/THEN lines, each tagged with the IDs it proves. Each line becomes a test with the same tag.
3. **Finish on commands.** A ticket's "Done when" ends with a block of commands that must pass. That block is the finish condition, for the agent and for any loop that runs the agent until done.
4. **Deliver in slices, each closed by a test.** Implementation is split into stages in dependency order, and each stage ends with a control test that shows the stage works before the next one builds on it.

## Ticket shape

```markdown
# #3 Serve the hold queue: reservation on return and the pickup window

## Outcome
What changes for the user, in two or three sentences.
Ontology IDs: `hook.hold-ready`, `hook.hold-expire`, `concept.reservation`, `rule.pickup-window`.

## Scope
Numbered, file-level.

## Out of scope
What a helpful agent would otherwise add.

## Scenarios
- [inv.queue-order] GIVEN ana placed her hold before carl WHEN a copy of Dune comes back THEN it is reserved for ana, not carl.

## Done when
- [ ] Every scenario above is a test with the same tag, and the tests pass.

## Proof commands
node --test 'example/app/*.test.mjs'
node tools/ont-check/ont-check.mjs --config example/ont.config.json

## Pre-authorized
- commit: allowed on the task branch
- PR: not yet
```

The last two sections are what make a ticket executable without a conversation. Proof commands are the finish line. Pre-authorized lines answer in advance the permissions an agent would otherwise stop and ask for: committing, opening a pull request, driving a browser. A missing line means the repository default.

## Scenarios

A scenario is one line: a tag with the IDs it proves, then GIVEN the state, WHEN the event, THEN the observable result. It uses concrete data, the way the test will.

```markdown
- [hook.hold-expire, rule.pickup-window] GIVEN `dune-1` was reserved for ana on 2026-10-10 and carl waits next WHEN the day 2026-10-14 is processed THEN ana's hold is closed as expired and `dune-1` is reserved for carl.
```

When the ticket is implemented, each line becomes a test whose title starts with the same tag (see [part 6](verification-map.md#tests-that-name-ids)). The tag carries the concept from the ticket into the test suite, where the check can see it after the ticket is closed.

Why one line and not a Gherkin file: a scenario that does not fit on a line is usually two scenarios, and one line can be copied into a test title without a second format or a runner. Why examples and not requirement sentences such as the EARS notation [Kiro uses](https://kiro.dev/docs/specs/feature-specs/): the requirement is already in the ontology as an invariant or a rule; what the ticket adds is the case with data that will prove it.

Scenarios are written before work starts, together with the proof commands. If they cannot be written, the ticket is not ready.

## Why commands

An agent can run a list of commands and see whether they pass. It cannot reliably judge whether "the hold queue works" is true. A duration ("work on it for two hours") is not a finish condition either. Commands make the stopping point objective, and that is what lets the human step away.

The same reasoning favors writing the description well before implementation starts. A precise target, with IDs, decisions and a labelled mockup, lengthens the stretch an agent can work alone. Prose by itself does not lengthen it. What does is a checkable condition at the end. The ontology supplies the vocabulary for that condition, and the proof commands supply the condition.

## Slices and control tests

Order the stages by what everything else depends on, and close each with a test that would expose a wrong foundation. A typical first stage is the one whose mistakes would poison everything after it: a classification, a routing decision, a data import. Its control test runs a realistic, deliberately messy input through the real code and scores the result against expectations, with a recorded baseline. Later stages may not start until the control test of the stage they build on passes.

This is how the approach meets the objection that full specifications ignore what you learn during implementation. The ontology is complete enough to work from, and implementation still teaches things. When a slice teaches something, it goes into the decision log, and the ontology changes before the next slice.

## Reporting back

- Claims carry evidence or a label: measured, inferred or guessed.
- Long unattended runs keep a decision trail (one line per decision, with a pointer to the evidence) outside the repository, attached to the ticket when the work is handed back.
- A paused task leaves a resume note on the ticket: branch, what is done and verified, what is open, the first action on resume.

## What the check enforces

When tickets are files in the repository (`tickets` in the configuration), the check requires of each one:

- an `IDs:` line (or `Ontology IDs:`), with IDs that exist in the glossary;
- at least one scenario under `## Scenarios`;
- an ID tag and GIVEN, WHEN and THEN, in that order, on every scenario line;
- scenario tags only from the ticket's `IDs:` line.

It does not check that a scenario has become a test. That shows on the test side: an implemented invariant, rule or derived value without a tagged test fails there. Tickets kept in a tracker are not checked; a project can add a bot that applies the same rules there.

## How it fails in practice

- **Done when written as prose only.** The agent stops when it feels done. Write the commands into the ticket before starting; if they cannot be written, the ticket is not ready.
- **Tickets without IDs** for product work. The agent builds from the ticket text and drifts from the ontology.
- **Scenarios that restate the rule** instead of giving a case: "GIVEN a held title WHEN renewing THEN renewal is refused". It is correct and proves nothing new. Name the member, the item and the dates.
- **Stages started out of order** because a later stage is more visible. The control test of the earlier stage exists to stop exactly that.

## In the example

[`example/issues/0003-serve-the-hold-queue.md`](../../example/issues/0003-serve-the-hold-queue.md): six tagged scenarios for a feature that is not implemented yet.
