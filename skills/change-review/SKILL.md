---
name: change-review
description: Reviews a change before it is merged, in a project that uses the Ontology as Specification method, against the manual checks the change touches. The tool lists the project's manual checks whose concepts the diff touches and the approach's manual checks for the kinds of artifact it changes; the reviewer gives each a verdict with evidence. Use when asked to review a branch, a pull request or a diff before merge in a repository with an ont.config.json, and you did not write the change.
license: MIT
---

<!-- ont: rule.reviewed-before-merge, derived.review-checks -->

# Change review

You review a change you did not write, before it is merged. The approach behind it is https://github.com/epavlenko/ontology-as-spec; its rule is that the reviewer is an agent of another provider than the author's, so that the two do not share blind spots. If you wrote the change, or your provider is the author's, even with another model, say so and stop. If you do not know the author's provider, say so in the answer and go on.

You read and report. You do not edit files, commit, push or merge, and you do not message anyone on the author's behalf.

## What you get

- The base of the change: a branch, a tag or a commit, such as `main`.
- The change itself: the working tree or the branch checked out against that base.
- The IDs the change claims to touch, if the author gave them. Do not ask for the author's summary or conclusions, and do not rely on one if it is in front of you: a reviewer handed the author's conclusions tends to confirm them.

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

## 2. Give each check a verdict

Take the checks one by one. For each, read what its THEN demands, find the evidence in the change, and give one verdict:

- **pass**: the change satisfies THEN. Name the file and line that show it.
- **fail**: it does not. Name the file and line, and what THEN expected.
- **not run**: the check applies to this change but you could not carry it out, for example because it needs the running product, a person, or data you do not have. Say what is missing. Never write `not applicable` for a check you could not run.
- **not applicable**: the check does not concern this change, although the tool listed it, for example a check of the Decision section when the decision log only gained a line of history. Say why in one sentence.

Checks of the approach often ask about the whole kind of artifact, such as "a definition says what the thing is, in a sentence or two". Judge them on what the change adds or alters, not on the rest of the file.

## 3. Report what matters

Report what would mislead a reader or an agent, or would break a check. Style, the completeness of lists and compliance that changes nothing are not findings. Each finding names its file and line and the check or rule it breaks.

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

`ready to merge` only when no check fails and no finding of this change remains. A check that already failed on the base and that the change does not touch is an earlier problem: report it, and do not let it block. A `not run` check does not block on its own, but say who has to run it before the merge.

## Licence

This skill is licensed under the MIT License. Copyright (c) 2026 Jevgenijs Pavlenko. The repository's text is licensed under CC BY 4.0 and its tool, templates and example under MIT; see `LICENSE` and `LICENSE-CC-BY-4.0` there.
