# 7. Agent rules

<!-- ont: ent.agent-rules@99af23 -->

## What it is

A section in the repository's agent instructions (`AGENTS.md` or its equivalent) that tells any agent how to keep meaning current. It has two parts: a table of what else to update when something changes, and a short list of rules the check cannot enforce.

| You changed                                        | Also update                                                                                                                                        | Verify                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| A concept, rule, invariant or view in the ontology | run `format-ontology.mjs`; regenerate the tooltips; a revision history line; a decision entry when the reason is new                               | the check                       |
| A rule, invariant, hook or action in the ontology  | its check in the catalogue, before the code                                                                                                        | the check                       |
| The mockup                                         | the ontology first; `data-ont` on every new meaningful element and its map row                                                                     | the check, a browser smoke test |
| Code                                               | the rows and checks it implements first; an `ont:` comment naming the concepts the code implements; the implementation table and known divergences | the check, the tests            |
| A change about to be merged                        | `ont-check --review <base>`; an agent of another provider that did not write it gives each listed check a verdict with the change-review skill     | the reviewer's verdicts         |
| Your mind about an earlier decision                | a new dated entry that supersedes the old one                                                                                                      | the check                       |
| A concept becomes implemented                      | tests that implement its automatic checks, titled with the check IDs                                                                               | the check, the tests            |
| A definition row that a help page explains         | reread the sections the check lists, then `stamp-docs.mjs`; regenerate the reference pages                                                         | the check                       |

Generated files are never edited by hand; the check compares them with what the generators write.

Rules the check cannot enforce:

- A change of behavior starts in the ontology, its rows or its checks; the code and its tests are written from it after (`rule.ontology-changes-first`). The code, the mockup included, is written from the ontology: what it would do that the ontology does not say, including what an element deliberately does not do, is a gap in the ontology, so add the row or the check, or ask, before writing it (`rule.ontology-is-source`, `rule.behavior-in-ontology`, `rule.limits-in-ontology`).
- IDs are permanent. Renaming a term changes its row's text, never its ID. An ID that has to change goes under "Retired IDs" with its replacement; only the decision log keeps using it (`inv.ids-permanent`, `action.change-id`).
- Removing a concept is a decision: write the entry and retire the ID; the check then finds every reference left (`action.remove-concept`).
- The ontology describes the target. When the code disagrees, record the divergence; do not silently change either side (`rule.divergence-becomes-work`).
- Code that implements a concept names its ID next to it in a comment, `// ont: rule.renewal` (`rule.code-names-concepts`).
- What a partial implementation leaves out is a target concept, named in the note of its row. A note alone hides the work from `--gap` (`rule.partial-noted`).
- A choice the owner has not explicitly approved, such as a value you picked when asked to tune something, is recorded as tentative; the owner's approval accepts it (`rule.unconfirmed-tentative`).
- A question you can recommend an answer to is a tentative entry, not a line under open questions: your recommendation is its decision, the other options are rejected. The entry gives you no permission to act on the recommendation; your task or the owner does. When the owner answers, the entry names the answer on its `Source:` line (`rule.question-as-tentative`, `action.answer-tentative`).
- Name where a decision was made on its `Source:` line. When sources disagree, follow the owner's latest word; an answer someone gave for the owner keeps the entry tentative (`rule.source-precedence`).
- What you put off outside any slice gets an entry with a `Return when:` line, not a note that nobody will read again (`rule.deferral-returns`).
- A number is held as its role needs. A rule's value or a requirement is held by a check. A model's assumptions are held by a snapshot of its base scenario, each change of them is a short entry about its topic, and no check requires the model to reach its goal (`rule.number-by-role`, `rule.chosen-value-checked`).
- A consistency review reports what would mislead a reader or an agent, or would break a check. Style, the completeness of lists and compliance that changes nothing are not findings (`rule.findings-mislead`).
- Every change ends with a commit of its own files, never another agent's (`rule.commit-finished-work`).
- A rule here that comes from a rule of the approach or from a decision names it, by ID or entry; a rule that departs from the approach cites the process entry of the log that decided it (`rule.agent-rule-source`, `rule.departure-by-entry`).

<!-- ont: rule.strongest-step@4002fd -->

## Why a table

Agents follow explicit procedures well and infer side effects badly. "Remember to keep docs in sync" produces nothing. "You changed the mockup, so add the map row and run this command" produces the map row. The table turns the dependency graph between artifacts into instructions, and the Verify column turns each instruction into something checkable.

The list after the table holds only the rules no check enforces; it exists because some rules have no mechanical check yet. Writing them down is the fallback. When a rule keeps being broken, it should move from the list into the check. Encoding a lesson in structure beats repeating it in prose.

The same order applies to every correction of an agent (`rule.strongest-step`). A mistake an agent made once it will make again, so the correction is held at the strongest step that can hold it. First the structure of the code, so the mistake cannot be written: a type, a boundary in the import graph, a single way to do a thing. Then a check of the tool, a test or a lint, which fail the build. Then a rule in the agent instructions, which an agent may not read. Last, what a reviewer remembers, which does not scale with the number of changes. A rule in the instructions is the fallback for what nothing else can hold, and the list after the table is where it goes. The order follows Lauren Tan's account of how a team of agents keeps a codebase trustworthy at hundreds of changes a day ([talk, 2026-09-21](https://x.com/poteto/status/2102050467505430555)).

<!-- ont: rule.agent-rules-short@66c9df, rule.agent-rules-point-at-files@13a4c3, rule.start-from-ids@8804d9, rule.findings-mislead@0229fa, rule.commit-finished-work@8ad234 -->

## Reference

The rules for the section itself are in the reference: [Agent rules](../reference.md#agent-rules). Keep it short, because it is read at the start of every session and long sections are skimmed. Let every row name a path or a command. Let every task start by naming the IDs it touches: if an agent cannot name them, the task is not about meaning, or the ontology is incomplete. The tool enforces none of this directly; it enforces the consequences, because a skipped row usually fails the check. The same restraint applies to reviews: a consistency review reports what would mislead someone or break a check, not every imperfection it can find. And every change ends with a commit, since the guard protects only accepted entries that are in a commit, and a commit keeps each step easy to undo. The commit holds only the change's own files, since other agents may work in the same checkout. Who approves a commit or a push, and when to push, the approach leaves to the user; a project that does not let agents commit writes that as a process entry, as the next section shows.

<!-- ont: rule.agent-rule-source@695801, rule.departure-by-entry@4fa94e, inv.agent-rule-references-resolve@8ed1db, inv.departure-well-formed@706f17, inv.approach-ids-current@195640 -->

## Where a rule comes from

A project's ontology is about its product. How its agents work is described by the approach's own ontology: the rules of this part and of the decision log are concepts of the approach, with IDs like any product's. So a process rule in a project's agent instructions, one that says how agents work rather than what the product is, names where it comes from: the rule of the approach it follows, by ID, or the entry of the project's log that decided it.

```markdown
- Every change ends with a commit of its own files (`rule.commit-finished-work`).
```

In the instructions, `D-nn` always means an entry of the project's own log; a rule of the approach is cited by its ID, never by the approach's entry numbers. The files stay prose, and commands and matters of style name nothing.

A project may depart from a rule of the approach, more strictly or more loosely, but only by an entry of its log that says so. A `Layer: process` line marks the entry as one about how agents work, and an `Extends:` or `Overrides:` line names the rule; the instruction that departs cites the entry. In one project that uses the approach, the agent instructions said by default not to commit and not to open a pull request. That narrowed `rule.commit-finished-work`, and nothing said so: an agent that knew the approach could not tell whether the project meant it, or why. Written as a departure, it is an entry:

```markdown
### D-63 · Agents leave commits and pull requests to the owner

- Date: 2026-10-27 · Status: accepted
- Source: the owner's message of 2026-10-27
- Layer: process
- Overrides: `rule.commit-finished-work`
- Decision: agents do not commit or open a pull request unless the task asks; a finished task ends with a list of the accepted entries that are not protected yet.
- Why: …
```

and an instruction that cites it:

```markdown
- Do not commit or open a pull request unless the task asks; say which accepted entries are not protected yet (`rule.commit-finished-work`, overridden by D-63).
```

The configuration lists the instruction files under `agentInstructions`. The check fails on a concept ID they mention that neither the project's ontology nor the approach defines, or that is retired, and on an entry they cite that the log does not have or that a later entry supersedes. It also fails on an entry with an `Extends:` or `Overrides:` line that lacks `Layer: process`, or on such a line that is empty or names something the approach does not define; while the entry is in force, a rule the approach has retired fails too, and a superseded entry, which is history, may still name one. A retired ID of the project stays retired where the approach has the same ID, and file names such as `action.yml` are not read as IDs. The approach's IDs travel with the tool, in `tools/ont-check/approach.json`, which the approach generates from its own ontology; a project copies it with the other files of the tool.

What the tool cannot tell is which lines are process rules, and whether a rule written in prose is stricter or looser than the approach. A reviewer reads the instructions for that: a process rule that names no source is a finding, and so is a departure without an entry.

<!-- ont: action.critique-change@79fa01, derived.review-checks@9ae058, rule.reviewed-before-merge@7ac9d0 -->

## An independent critic

Before a change is merged, an agent of another provider that did not write it reviews it. Two agents of the same provider tend to share blind spots, and a reviewer handed the author's conclusions tends to confirm them, so the critic gets the diff and the IDs it touches, not the author's summary.

`ont-check --review <base>` gives the critic its checks: the manual checks of the project whose concepts the change touches, through a changed definition row, a changed check, a changed file that names the concept in `ont:` or is in its implementation row, a changed doc section anchored to it or a changed ticket that lists it, or a changed file under a directory the configuration names under `reviewPaths`, which data files without `ont:` names need; and the manual checks of the approach for the kinds of artifact the change touches, such as the Decision section when the decision log changed. The approach's manual checks travel with the tool. The critic follows the [change-review skill](../../skills/change-review/SKILL.md) and gives each check a verdict: pass, fail, not run when the check applies but could not be carried out, such as one that needs the running product, or not applicable, each with its evidence or reason. A check that could not be run is never written off as not applicable.

## How it fails in practice

- **The table describes an older layout of the repository.** When paths move, update the table in the same change. Include the agent instructions file in the paths that trigger the check.
- **Rules that should be checks stay rules forever.** Review the list from time to time and ask which item could be a check.
- **A correction goes into the instructions by habit.** The agent is told once more in prose, and the next agent repeats the mistake. Ask first whether the code, a check, a test or a lint can make it impossible.
- **Instructions that quietly differ from the approach.** A project's rule says less or more than the rule of the approach it replaces, and nothing records the choice. Write the departure as a process entry and cite it from the instruction.
- **Reviews that list everything.** A finding that misleads no one costs the reader's attention and teaches agents that the list is noise. Report what would mislead a reader or an agent, or would break a check, and leave style and completeness alone.

## In the example

[`example/AGENTS.md`](../../example/AGENTS.md).
