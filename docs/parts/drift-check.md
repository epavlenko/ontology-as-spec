# 5. Drift check

## What it is

One script that reads every artifact holding or referring to meaning and checks that the references are whole. It exits non-zero on drift and runs in two places: a pre-commit hook on the paths it covers, and CI. The generic version is [`tools/ont-check`](../../tools/ont-check/README.md).

A run on the example:

```text
$ node tools/ont-check/ont-check.mjs --config example/ont.config.json
glossary 40 · retired 6 · mockup 23 · map 23 · implemented 25 · checks 22 · unit 15 · end-to-end 10 · tickets 2 · help 15
ONT_OK
```

A run after someone renamed `data-ont="view.desk"` to `view.counter` in the mockup without touching anything else:

```text
ERROR · data-ont in the mockup but not in the glossary (1):
  view.counter
ERROR · data-ont in the mockup but not in the map (1):
  view.counter
glossary 40 · retired 6 · mockup 24 · map 23 · implemented 25 · checks 22 · unit 15 · end-to-end 10 · tickets 2 · help 15
DRIFT: 2
```

<!-- ont: inv.references-defined@060f13, inv.concept-referenced@b457ed, inv.concept-tried@739910 -->
## Reference

Every automatic check in the [reference](../reference.md) is something this script, or the guard, verifies; each one is implemented by a test in `tools/ont-check/test/` that carries its ID. Every manual check is something it cannot verify, and a reviewer does instead. The checks that run across artifacts are under [Concept](../reference.md#concept): every ID used anywhere is defined, every concept is referred to, and, as information, every concept has been tried by a mockup element, a ticket or code.

Three flags print reports on top of the check. `--coverage` shows, for each implemented concept, how many checks name it and which suites prove it. `--decisions` lists every entry of the decision log as in force, tentative or superseded by what. `--gap` lists the work left by entity: target concepts with their checks, automatic checks without a test and the known divergences; given a ticket, it narrows to the ticket's slice and exits 1 until the slice is done.

The "both directions" part matters. Checking only that references resolve catches typos. Checking also that every concept is referenced, every labelled element is mapped and every implemented concept has a way to be proven catches the slower failure: things that quietly stop being connected.

A separate script, `guard-decisions.mjs`, checks history rather than state: it refuses an edit or removal of an accepted decision entry since an earlier commit ([part 2](decision-log.md#the-guard)).

What the script cannot see, beyond the manual checks, is meaning and code behavior. It does not know whether a definition is right, and code that contradicts the ontology where no test looks passes. [Limitations](../limitations.md) lists these with possible remedies.

## Design choices

- **One parser for the generator and the check.** If the two read the glossary differently, a malformed row can pass the check and still break the tooltips.
- **IDs are recognized in backticks only** in Markdown, and only for configured classes. Prose stays prose; a version number like `v1.2` is not an ID.
- **Errors and information are separate.** "Not yet in the mockup" is a backlog, not a failure. Failing on it would push people to add meaningless labels.
- **Plain text output, one line per finding.** Agents read it and fix the exact line.
- **No dependencies.** It runs wherever Node runs, in a hook, in CI, in an agent's sandbox.

## How it fails in practice

- **The hook covers too few paths.** If code changes do not trigger the check, the implementation table goes stale without a signal. Include the code paths that implement concepts, even though the check does not read code. The point is the reminder.
- **The hook is bypassed** with `--no-verify`. CI runs the same check and the guard, so the drift reaches the branch but not unnoticed.
- **Someone adds a rule to silence a finding.** A finding means two artifacts disagree. Fix one of them.
- **The check grows into a linter of style.** Keep it about references between artifacts.

## In the example

`example/ont.config.json` configures the check for the example. `tools/ont-check/test/` breaks the example in fifty-two different ways and asserts that each break is named, and runs the guard on edits it must allow and edits it must refuse.
