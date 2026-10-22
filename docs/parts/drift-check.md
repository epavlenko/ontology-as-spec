# 5. Drift check

## What it is

One script that reads every artifact holding or referring to meaning and checks that the references are whole. It exits non-zero on drift and runs in two places: a pre-commit hook on the paths it covers, and CI. The generic version is [`tools/ont-check`](../../tools/ont-check/README.md).

A run on the example:

```text
$ node tools/ont-check/ont-check.mjs --config example/ont.config.json
glossary 39 · retired 6 · mockup 22 · map 22 · implemented 25 · checks 20 · unit 15 · end-to-end 10 · tickets 1
ONT_OK
```

A run after someone renamed `data-ont="view.desk"` to `view.counter` in the mockup without touching anything else:

```text
ERROR · data-ont in the mockup but not in the glossary (1):
  view.counter
ERROR · data-ont in the mockup but not in the map (1):
  view.counter
glossary 39 · retired 6 · mockup 23 · map 22 · implemented 25 · checks 20 · unit 15 · end-to-end 10 · tickets 1
DRIFT: 2
```

## What it checks

| Check | Direction | Severity |
| ----- | --------- | -------- |
| IDs in the ontology text exist in the glossary | text → glossary | error |
| glossary IDs use configured classes; no duplicates | glossary | error |
| rows follow the kind order; Kind cells name the kind on the first row of each group | definition tables | error |
| a field or relation sits in the table of the entity its ID names; one entity per table | definition tables | error |
| fields and relations have a valid type; the generated contracts are current | definition tables → contracts | error |
| retired IDs have no row, their replacement exists, and only the decision log uses them | retired table → everything | error |
| generated tooltips equal the generator's output | glossary → generated file | error |
| `data-ont` IDs exist in the glossary | mockup → glossary | error |
| map and mockup have the same IDs | mockup ↔ map | error |
| dynamic classes have a live template | mockup | error |
| IDs in the map and the decision log exist in the glossary (the log may also use retired IDs) | map, log → glossary | error |
| `D-nn` references have entries; entries are unique | ontology, map → log | error |
| implementation table IDs exist; files exist | table → glossary, files | error |
| glossary rows are referenced somewhere | glossary → everything | error |
| checks are unique, in their section, complete; their concepts exist | catalogue → glossary | error |
| every concept of a required class has a check | glossary → catalogue | error |
| automatic checks of implemented concepts have a test; tests name only known, automatic checks of implemented concepts | catalogue ↔ tests | error |
| concept tags in tests exist and name only implemented concepts | tests → glossary, table | error |
| implemented concepts of the classes a test suite covers are proven by that suite | table → test suites | error |
| tickets have an `IDs:` line; the checks they list exist and name the ticket's IDs | tickets → glossary, catalogue | error |
| concepts with no mockup element, ticket or implementation | glossary → mockup, tickets, table | info |
| interface-facing concepts not yet in the mockup | glossary → mockup | info |

Two flags print reports on top of the check. `--coverage` shows, for each implemented concept, how many checks name it and which suites prove it. `--gap` lists the work left by entity: target concepts with their checks, automatic checks without a test and the known divergences; given a ticket, it narrows to the ticket's slice and exits 1 until the slice is done.

The "both directions" part matters. Checking only that references resolve catches typos. Checking also that every concept is referenced, every labelled element is mapped and every implemented concept has a way to be proven catches the slower failure: things that quietly stop being connected.

A separate script, `guard-decisions.mjs`, checks history rather than state: it refuses an edit or removal of an accepted decision entry since an earlier commit ([part 2](decision-log.md#what-the-check-enforces)).

## Design choices

- **One parser for the generator and the check.** If the two read the glossary differently, a malformed row can pass the check and still break the tooltips.
- **IDs are recognized in backticks only** in Markdown, and only for configured classes. Prose stays prose; a version number like `v1.2` is not an ID.
- **Errors and information are separate.** "Not yet in the mockup" is a backlog, not a failure. Failing on it would push people to add meaningless labels.
- **Plain text output, one line per finding.** Agents read it and fix the exact line.
- **No dependencies.** It runs wherever Node runs, in a hook, in CI, in an agent's sandbox.

## What it cannot check

- Meaning. It does not know whether a definition is right, whether two prose descriptions of the same concept agree, or whether an element labelled `action.renew` renews anything.
- Code behavior. Product code does not refer to IDs. Tests do, through tags, but the check reads only the tags, so code that contradicts the ontology in a way no test exercises passes.
- Whether a tagged test proves what its tag says.

These are listed with possible remedies in [limitations](../limitations.md).

## How it fails in practice

- **The hook covers too few paths.** If code changes do not trigger the check, the implementation table goes stale without a signal. Include the code paths that implement concepts, even though the check does not read code. The point is the reminder.
- **The hook is bypassed** with `--no-verify`. CI runs the same check and the guard, so the drift reaches the branch but not unnoticed.
- **Someone adds a rule to silence a finding.** A finding means two artifacts disagree. Fix one of them.
- **The check grows into a linter of style.** Keep it about references between artifacts.

## In the example

`example/ont.config.json` configures the check for the example. `tools/ont-check/test/` breaks the example in thirty-nine different ways and asserts that each break is named, and runs the guard on edits it must allow and edits it must refuse.
