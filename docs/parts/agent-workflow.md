# 8. Agent workflow

## What it is

How implementation work is framed for agents so that it stays inside the ontology and can run without supervision. Three habits:

1. **Start from IDs.** Every task names the ontology IDs it touches. The agent reads their glossary rows, the relevant ontology sections and the decisions that mention them before writing code.
2. **Finish on commands.** A ticket's "Done when" ends with a block of commands that must pass. That block is the finish condition, for the agent and for any loop that runs the agent until done.
3. **Deliver in slices, each closed by a test.** Implementation is split into stages in dependency order, and each stage ends with a control test that shows the stage works before the next one builds on it.

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

## Done when
- [ ] Observable acceptance criteria.

## Proof commands
node --test 'example/app/*.test.mjs'
node tools/ont-check/ont-check.mjs --config example/ont.config.json

## Pre-authorized
- commit: allowed on the task branch
- PR: not yet
```

The last two sections are what make a ticket executable without a conversation. Proof commands are the finish line. Pre-authorized lines answer in advance the permissions an agent would otherwise stop and ask for: committing, opening a pull request, driving a browser. A missing line means the repository default.

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

Nothing in this part is checked by the drift check. Tickets live in a tracker. A project can add a ticket template and a bot that rejects tickets without IDs or proof commands.

## How it fails in practice

- **Done when written as prose only.** The agent stops when it feels done. Write the commands into the ticket before starting; if they cannot be written, the ticket is not ready.
- **Tickets without IDs** for product work. The agent builds from the ticket text and drifts from the ontology.
- **Stages started out of order** because a later stage is more visible. The control test of the earlier stage exists to stop exactly that.

## In the example

[`example/issues/0003-serve-the-hold-queue.md`](../../example/issues/0003-serve-the-hold-queue.md).
