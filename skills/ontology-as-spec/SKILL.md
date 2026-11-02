---
name: ontology-as-spec
description: Builds and checks a product's ontology with the Ontology as Specification method. The ontology is one Markdown table per entity, every concept a row with a permanent ID, and decisions, checks, tests, code and documentation refer to those IDs, verified by a script on every commit. Use when the user asks to set up or extend a product ontology, give product concepts permanent IDs, keep specs, decisions and code consistent for coding agents, or run or fix ont-check.
license: MIT
---

# Ontology as Specification

This skill teaches you to build a product's ontology and keep it checked, by the method in https://github.com/epavlenko/ontology-as-spec. The repository is the source: the method, a worked example, templates for every file, and the check. When this skill and the repository disagree, the repository wins.

The idea in one paragraph: every concept of the product gets one name, one short definition and a permanent ID, in a table for the entity it belongs to. Decisions, checks, tests, code comments, mockups and help pages name concepts by ID. A script, `ont-check`, fails when a reference does not resolve, a concept lacks what the configuration requires, or a generated file is stale. Agents then read one definition of each thing instead of guessing from whatever document is in front of them.

## When to use it, and when not

Use it when a product has enough concepts that people argue about their names and rules, when coding agents do most of the work, or when the user asks for an ontology, a glossary with IDs, a decision log that agents must respect, or traceability from rules to tests and code.

Do not use it to generate code from a specification. The ontology is what code, tests and screens are checked against, not their source. For a throwaway script or a product with three concepts it is overhead.

## What you need

- Node 20 or later and git. The check has no dependencies and installs nothing globally.
- Network access once, to clone the repository from GitHub. Nothing else in this skill reaches the network.
- The product owner, or whoever decides what the product means. You propose definitions; they decide.

## 1. Get the tool

Clone the approach next to the project and copy the tool in with its own pin script, so that the copy records which commit it came from:

```bash
git clone https://github.com/epavlenko/ontology-as-spec ../ontology-as-spec
node ../ontology-as-spec/tools/ont-check/pin.mjs update --dir tools/ont-check
node tools/ont-check/pin.mjs verify      # PIN_OK ontology-as-spec D-nn (hash)
```

The copy is never edited in place. A fix to the tool goes to the approach, and the project takes it with the next `pin.mjs update`, which also prints the approach's decisions made since the old pin so you can carry them into the project's rules. Read `templates/README.md` in the clone: it has a starting file for every step below.

## 2. Write the ontology

Start with the ten concepts people argue about most, not with everything. Copy `templates/ontology.md` and keep its layout:

```markdown
## Loan

| Kind      | ID                       | Term                 | Type | Definition                                                  |
| --------- | ------------------------ | -------------------- | ---- | ----------------------------------------------------------- |
| Entity    | `ent.loan`               | Loan                 |      | An item lent to a member, from checkout until return.       |
| Field     | `field.loan.due-date`    | Due date             | date | When the item must be back: checkout plus the loan period.  |
| Invariant | `inv.no-renew-when-held` | No renewal when held |      | A loan cannot be renewed while someone waits for the title. |
| Action    | `action.renew`           | Renew                |      | Move the due date by the renewal rule.                      |
```

The rules the check enforces or relies on:

- **One section per entity, one row per concept.** A concept that involves several entities sits with the entity it constrains or changes. Screens get a section of their own.
- **Kinds in order**, the kind written on the first row of its group: Entity (`ent.`), Field (`field.`), Relation (`edge.`), Derived (`derived.`), Concept (`concept.`), Rule (`rule.`), Invariant (`inv.`), Hook (`hook.`), Action (`action.`), View (`view.`).
- **IDs are `class.name` and permanent.** Fields and relations name their entity: `field.loan.due-date`. Renaming a term changes the row's text, never its ID. An ID that must change moves to "Retired IDs" with its replacement and the decision.
- **Only fields and relations have a type**, from a vocabulary that belongs to no programming language: `text`, `integer` (or `integer 0..2`), `number`, `boolean`, `date`, `datetime`, `one of a, b`, `ref <entity>`, `refs <entity>`, and `optional` after any of them. JSON Schema contracts are generated from these.
- **A definition says what the thing is, in one or two sentences.** Notes under a table add detail and name concepts by ID; they never restate a definition.
- **The ontology describes the target.** What the code already does is listed in "Implementation status"; everything absent from that table is target.
- **"Deliberately out of scope"** lists what a helpful contributor would otherwise add, and why it is absent.

Once the configuration of step 4 exists, run `node tools/ont-check/format-ontology.mjs --config ont.config.json` after editing rows: it writes the kind order, the Kind cells and the alignment.

## 3. Start the decision log

Copy `templates/decisions.md`. Record the last five decisions someone would otherwise reverse. An entry looks like this:

```markdown
### D-01 · A loan cannot be renewed while someone waits for the title

- Date: 2026-01-15 · Status: accepted
- Source: the owner's message of 2026-01-15.
- Decision: what was chosen, precisely enough to implement.
- Why: the reason, including what went wrong before.
- Rejected: each alternative with its reason in brackets.
- Concepts: `inv.no-renew-when-held`, `action.renew`.
```

- **An accepted entry is never edited.** A later entry adds to it or supersedes it whole, on a `- Supersedes: D-nn` line. The guard refuses edits to accepted entries.
- **What the owner has not explicitly approved is tentative**, including a value you picked when asked to tune something. A question you ask with a recommendation is written as a tentative entry; the owner's answer accepts it.
- **Every entry names its source**: the call with the time of the passage, the message with its date, the owner's answer. When sources disagree, the owner's latest word wins.
- **What is put off** gets an entry with a `- Return when:` line.

## 4. Configure and run the check

Copy `templates/ont.config.json` next to the ontology and remove the keys for parts the project does not have yet: `glossaryOut`, `contracts`, `mockup`, `map`, `checks`, `tickets`, `notYetShown`, `docSets`, `references`, and the template's `agents-section.md` under `agentInstructions` (point it at the project's own `AGENTS.md` or `CLAUDE.md` instead). Then run both scripts, and put them in the project's test command and in CI:

```bash
node tools/ont-check/ont-check.mjs --config ont.config.json          # ONT_OK, or each problem and exit code 1
node tools/ont-check/guard-decisions.mjs --config ont.config.json    # GUARD_OK, or the edited accepted entries
```

Fix every line the check prints; do not weaken the configuration to make it pass. Add the section from `templates/agents-section.md` to the project's agent instructions: it tells every later agent what else to update after each kind of change.

## 5. Write the checks and tag the tests

Copy `templates/checks.md`. Every invariant and rule gets at least one check: GIVEN, WHEN, THEN, in the product's own terms, true for any implementation. `auto` means a test proves it, `manual` that a person does, `judged` that a model judges the product's output.

```markdown
| Check                         | Concepts                 | GIVEN                      | WHEN              | THEN                                    | Proof |
| ----------------------------- | ------------------------ | -------------------------- | ----------------- | --------------------------------------- | ----- |
| `check.loan.renew-while-held` | `inv.no-renew-when-held` | a loan whose title is held | the member renews | the renewal is refused, with the reason | auto  |
```

A test starts its title with the check's ID: `test("[check.loan.renew-while-held] renewal is refused while someone waits")`. A tag is a claim that the test does what the check says; do not tag a test that does not. `testSuites` in the configuration says which suite must prove which kind of concept, and `--coverage` shows what proves each implemented concept.

## 6. Connect the code

- Code that implements a concept names it next to the code: `// ont: inv.no-renew-when-held`, in any comment syntax. The check fails on a name that does not resolve.
- When a concept is built, add its row to "Implementation status" with the files. What a partial implementation leaves out is named in the note of its row.
- When the code disagrees with the ontology, add a line under "Known divergences" naming the IDs. Do not silently change either side: a divergence becomes a ticket, or a new decision if the target changed.

## 7. Plan the work from the gap

```bash
node tools/ont-check/ont-check.mjs --config ont.config.json --gap    # concepts not built, checks without a test, divergences, what each target waits for
node tools/ont-check/ont-check.mjs --config ont.config.json --next   # the next slice of what is ready, as IDs: and Checks: lines
```

A ticket is a slice of the gap: an `IDs:` line, a `Checks:` line, what is out of scope, dependencies and permissions. It does not describe behavior; new behavior goes into the check catalogue first. The ticket is done when `--gap <ticket>` prints `SLICE_DONE`.

Later parts, when the product has them: labelling the mockup with `data-ont` and a map of its elements, and anchoring help pages so the check says which sections to reread after a definition changed. Both are described in `docs/parts/` of the repository.

## Rules for you, the agent

- **Start every task from the IDs it touches.** If a concept you need has no ID, propose its definition row, in its entity's table, before writing code or markup.
- **Never invent product meaning.** You propose; the owner decides. Record your proposal as a tentative entry with your recommendation.
- **Change meaning in the ontology first**, then the checks, then the code and tests. Generated files (tooltips, contracts, reference pages) are regenerated, never edited by hand.
- **Removing a concept is a decision**: write the entry and retire the ID; the check then finds every reference left.
- **Report what misleads.** A consistency review lists what would mislead a reader or an agent, or would break a check, not style or the completeness of lists.

## Read more

- The method and why it works: `README.md` and `docs/principles.md`.
- The nine parts, one page each: `docs/parts/`.
- Adopting it in a running project, step by step, and updating the copy of the tool: `docs/lifecycle.md`.
- Every rule and check of the approach: `docs/reference.md`.
- A fictional lending library described end to end: `example/`. Run `node tools/ont-check/ont-check.mjs --config example/ont.config.json` in the clone to see `ONT_OK`.
- Known limits: `docs/limitations.md`.

## Licence

This skill is licensed under the MIT License. Copyright (c) 2026 Jevgenijs Pavlenko. The repository's text is licensed under CC BY 4.0 and its tool, templates and example under MIT; see `LICENSE` and `LICENSE-CC-BY-4.0` there.
