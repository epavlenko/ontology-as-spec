---
name: change-review
description: Reviews a change before it is merged, in a project that uses the Ontology as Specification method, against the manual checks the change touches. The tool lists the project's manual checks whose concepts the diff touches and the approach's manual checks for the kinds of artifact it changes; the reviewer gives each a verdict with evidence. Use when asked to review a branch, a pull request or a diff before merge in a repository with an ont.config.json, and you did not write the change.
license: MIT
---

<!-- ont: rule.reviewed-before-merge@779cd7, derived.review-checks@947a8a, rule.run-recorded@2b45ff, rule.value-checked-against-source@52bea9, rule.code-reviewed-for-errors@3dbf61 -->

# Change review

You review a change you did not write, before it is merged. The approach behind it is https://github.com/epavlenko/ontology-as-spec; its rule is that the reviewer is an agent of another provider than the author's, so that the two do not share blind spots. If you wrote the change, or your provider is the author's, even with another model, say so and stop. If you do not know the author's provider, say so in the answer and go on.

You read and report. You do not edit files, commit, push or merge, and you do not message anyone on the author's behalf. The one exception is the records of step 4.

<!-- ont: derived.review-checks@947a8a -->
## What you get

- The base of the change: a branch, a tag or a commit, such as `main`.
- The change itself: the working tree or the branch checked out against that base.
- The IDs the change claims to touch, if the author gave them. Do not ask for the author's summary or conclusions, and do not rely on one if it is in front of you: a reviewer handed the author's conclusions tends to confirm them.

<!-- ont: derived.review-checks@947a8a -->
## 1. List the checks

From the directory with `ont.config.json`:

```bash
node <path-to-tool>/ont-check.mjs --config ont.config.json --review <base>
```

It prints the files changed, the concepts the change touches, the kinds of artifact it changes, then two lists:

- **the project's manual checks** whose concepts the change touches, through a changed definition row, a changed check, a changed file that names the concept in `ont:` or is in its implementation row, a changed doc section anchored to it, or a changed ticket that lists it;
- **the approach's manual checks** for the kinds of artifact the change touches: the ontology, the decision log, the check catalogue, code, the mockup and its map, tests, documentation, tickets, agent rules.

Each check comes with its GIVEN, WHEN and THEN. If it prints `nothing to review`, say so; your review is then only the errors you see in the diff.

Read the rest of the check's output too. An `ERROR` there is a finding. Tell apart the errors the change brings from those the base already had: run the same check on a checkout of the base in a temporary directory (`git worktree add /tmp/base <base>`), and remove it after. Report the errors the base already had apart, as earlier problems; they do not block this change unless it touches them.

<!-- ont: rule.reviewed-before-merge@779cd7 -->
## 2. Give each check a verdict

Take the checks one by one. For each, read what its THEN demands, find the evidence in the change, and give one verdict:

- **pass**: the change satisfies THEN. Name the file and line that show it.
- **fail**: it does not. Name the file and line, and what THEN expected.
- **not run**: the check applies to this change but you could not carry it out, for example because it needs the running product, a person, or data you do not have. Say what is missing. Never write `not applicable` for a check you could not run.
- **not applicable**: the check does not concern this change, although the tool listed it, for example a check of the Decision section when the decision log only gained a line of history. Say why in one sentence.

Checks of the approach often ask about the whole kind of artifact, such as "a definition says what the thing is, in a sentence or two". Judge them on what the change adds or alters, not on the rest of the file.

<!-- ont: rule.code-reviewed-for-errors@3dbf61 -->
### Errors and security

When the change touches code, the tool lists the approach's check of errors and security, `check.agent-rules.code-reviewed-for-errors`. Read the diff for:

- **errors of correctness**: a wrong bound or condition, a case the rules of the ontology name that the code mishandles, an error swallowed, state left half changed;
- **a secret in the code**: a key, a token or a password, in the code, a fixture or a configuration file;
- **unchecked input** that reaches a database query, a shell command, a file path or a page without being validated or escaped;
- **access wider than the change needs**: a permission, a scope, an open endpoint or a role it did not have before;
- **a dependency with a known flaw**.

Report each one found with its file and line, and the concept it breaks where there is one, such as the rule whose bound the code gets wrong. Never try a literal that looks like a key or a token against the service it seems to belong to. The check fails if you find any; it passes if you find none; it is `not run` when judging needs a run you cannot make, such as a dependency audit without network.

<!-- ont: rule.value-checked-against-source@52bea9 -->
### Values with a source

If the change adds or alters values that carry a source, such as the cases of a study, open the source of each such value and check that it says what the value says, at the kind the value claims. The tool lists the project's check for this when the configuration names the directory of those values under `reviewPaths`. Give that check one verdict for the change, and say in the evidence which values you read where. A source you cannot open, behind a login or gone, makes the verdict `not run`, with the source named.

<!-- ont: rule.findings-mislead@0229fa, rule.reviewed-before-merge@779cd7, rule.findings-filed@f29b6d -->
## 3. Report what matters

Report what would mislead a reader or an agent, or would break a check. Style, the completeness of lists and compliance that changes nothing are not findings. Each finding names its file and line and the check or rule it breaks. When you find a problem, look for it across its whole class, not only where it showed, and say where else you looked (`rule.whole-class`). Give each finding a class of problem, named the same in later rounds, apart from its weight and from whether it is of this change, so that the author can tell whether the rounds converge (D-99, D-152). A finding that cannot be fixed without changing what the owner decided, an item of the approved statement with its source or his answer, is `not fixable` and goes to the owner. An unlikely case is filed in `docs/limitations.md` as `limitation`, and a finding outside the approved statement in a ticket under `issues/` as `later`; the file must hold the finding's class word for word. When the author files a finding, judge in the same round, before a verdict that may end the step, whether it belongs there: an item of the approved statement is never filed, and in a verdict of acceptance a filed finding is an error (`rule.findings-filed`).

Answer in this form:

```
Change: <base>..<head or working tree>, <n> files
Reviewer: <model and provider>; author: <model and provider, if known>
Checks: <n> of the project, <m> of the approach

| Check | Verdict | Evidence or reason |
| ----- | ------- | ------------------ |
| check.loan.renew-explained | fail | help/borrowing.md:12 says renewal is always possible; THEN expects the reason it is refused |

Findings:
- <what misleads or breaks, file:line, the check or rule>

Verdict: ready to merge | fix first | cannot tell (with what is missing)
```

`ready to merge` only when no check fails and no finding of this change remains. A check that already failed on the base and that the change does not touch is an earlier problem: report it, and do not let it block. A `not run` check does not block on its own, but say who has to run it before the merge. A verdict given in an earlier round of the same change still counts while the stamp `--review` prints for its check is the stamp it was given at and the commits since change none of the files you read for it. Give a new verdict to the checks whose stamp or files changed, and always read the new diff for errors and security.

<!-- ont: ent.manual-run@893f59, rule.run-recorded@2b45ff, action.record-verdicts@d809af, rule.records-english-in-repo@6e97a3 -->
## 4. Record each verdict

If the configuration has `manualRuns`, put your table of verdicts in a file outside the change, with a line `By: <your model and provider>` above it, and let the tool write the records from it (D-100). Write the table with paths inside the repository only, such as `tools/ont-check/lib.mjs:12`, whatever the rest of your answer is: its rows are recorded in the repository, and the tool refuses a table with an absolute path or a path that leaves the repository by `..`. Where the configuration sets `records.latinOnly`, as a project whose records are in English does, write it in English: the tool then refuses a letter of another script too. Name what you keep outside in words, such as "the reviewer's log, kept outside the repository"; a URL of the web, http or https, is allowed, while a URL of another scheme, such as `file:`, `mailto:` or a link into a local app, with or without `//`, is refused; so is any path with `..` in it, so name a file from the repository's root, such as `docs/README.md`, never `docs/../docs/README.md`. Put the `By:` value on the `By:` line itself (`rule.records-english-in-repo`, D-151).

```bash
node tools/ont-check/ont-check.mjs --config ont.config.json --review main --record /tmp/verdicts.md
```

Each row is `| check ID | verdict | evidence |`. In a later round of the same change, a verdict you do not give again is `carried`, with the file of the record it carries and the files you read for it in place of evidence: `| check ID | carried | <record file> · <file>, <file> |`. The tool refuses it when the record is of another check or another stamp, when no files are named, the record was of uncommitted changes, or one of the files changed since the record's commit, and always refuses a carried check of errors in code. It writes one record for each new verdict in the directory of `manualRuns`, with the stamp and the commit of the review, and refuses the whole table when a listed check has no verdict, a check is not listed or one is given twice. These records are the only files you create: you do not change the change itself and you do not commit; the author commits them with the change. A record reads:

```
Check: <check ID>
Time: <UTC time to the second, such as 2026-11-05T14:30:00Z>
Commit: <the commit you reviewed; for changes not yet committed, it is followed by +working-tree>
Stamp: <the stamp --review printed for the check>
Verdict: pass | fail | not-run | not-applicable
By: <your model and provider>
Evidence: <where the evidence is, outside the repository, if the check kept any: a URL, or named in words>
```

Evidence such as screenshots or data stays outside the repository; the record only links to it.

<!-- ont: ent.review-round@21a841, rule.round-recorded@649657, derived.next-round@c3332c, rule.rounds-converge@8fd85a, rule.findings-filed@f29b6d -->
## 5. Record the round

If the configuration has `reviewRounds`, the author writes a record of each round of review in that directory, one file per round, and `ont-check --rounds` says what follows it:

```
Task: <the task, named the same in every round>
Step: statement-review | result-review
Narrow: true | false
Number: <the round's number in its step, full and narrow rounds counted apart>
Time: <UTC time to the second>
Commits: <the commits reviewed>
By: <the reviewer's model and provider>
Tokens-new: <if known>
Tokens-cached: <if known>
Tokens-out: <if known>
Checks-listed: <n>
Checks-given: <n>
Checks-carried: <n>
Findings:
- <class> · important | nit · change | before · fixable | not fixable | limitation | later · <the test that holds the fix, or the file it is filed in>
```

There is no ceiling of rounds (D-152). The rounds go on while each finds fewer important classes than the one before. When the last round has at least one important finding, and either an important class of it was an important finding of an earlier round of the step or it found no fewer important classes than the one before, the rounds stagnate; rounds with nits only never stagnate, and an important finding after a round of nits only is more important classes than none, so it stagnates: `--rounds` and `--task` say so, the author changes the design of the solution rather than patching it, and the next round is full. Reviewing that round, say whether the design changed or the old one was patched again; the tool cannot tell. Nits, findings `not fixable` and filed findings are not compared, and the comparison starts again after a round that ended the step, a clean round of the statement or a clean round of the result whose acceptance held, or after the owner's approval. The head of the record, up to a heading line starting `## `, is the fields, each once, then at most one `Findings:` block, then at most one `Acceptance:` block or `Acceptance: clean`, a block being its name and the finding lines starting `- ` directly under it; any other line there, a second block, a field after the blocks, an indented finding or a line starting with # that is not `## `, makes the record unreadable. Put notes after a heading such as `## Notes`. A finding `not fixable` holds the whole task until the owner approves a version: a later clean round or acceptance does not close it. A record of a round that cannot be read blocks every task until it is corrected.

<!-- ont: edge.review-round.statement@914220, field.review-round.contribution@51b2a4, field.review-round.acceptance@ca2653, rule.acceptance-against-approved@6987aa, rule.budget-before-next@603840 -->
A round also gives, when known, `Start:` and `Contribution: <provider> · <session or task ID>`, which go together, and on a review of a statement or of a result `Statement-hash: <SHA-256 of the statement's file>`, the version read. A round of either step at or after `reviewRounds.gatesFrom` always gives it, or it cannot be read, and the version of a round of the result is the one approved when the round ends: a round of an older version after a newer approval is a late record, which blocks every task until it is moved or removed (D-152). On a review of a result, after the executor's record of done, give the verdict of acceptance beside your verdict on merging: check the result against the approved version of the statement, each item of what to do and of done when and the owner's sources, and write `Acceptance: clean`, or `Acceptance:` and a finding line for each item the result does not meet (D-152). Such a round names on `Commits:` the commit the record of done is of, the last of a range; the check refuses the acceptance otherwise (D-117). The round is clean only when both are, and a round of the result that gives no verdict of acceptance does not end the step (D-119). Before each round the author runs `ont-check --task <task> --statement <file>`; when it says the budget is exhausted, the round waits for the owner (D-108). Its line `NEXT <task>:`, the same in `--rounds`, is the task's one next action; every other line says a state. Its line `REPORT` names the marks of half the limit and the limit that the spend has passed; the author reports them to the owner and does what `NEXT` says.

<!-- ont: -->
## Licence

This skill is licensed under the MIT License. Copyright (c) 2026 Jevgenijs Pavlenko. The repository's text is licensed under CC BY 4.0 and its tool, templates and example under MIT; see `LICENSE` and `LICENSE-CC-BY-4.0` there.
