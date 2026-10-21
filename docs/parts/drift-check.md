# 5. Drift check

## What it is

One script that reads every artifact holding or referring to meaning and checks that the references are whole. It exits non-zero on drift and runs in two places: a pre-commit hook on the paths it covers, and CI. The generic version is [`tools/ont-check`](../../tools/ont-check/README.md).

A run on the example:

```text
$ node tools/ont-check/ont-check.mjs --config example/ont.config.json
glossary 36 · retired 6 · mockup 22 · map 22 · implemented 19 · scenarios 14 · tested 11 · tickets 1
ONT_OK
```

A run after someone renamed `data-ont="view.desk"` to `view.counter` in the mockup without touching anything else:

```text
ERROR · data-ont in the mockup but not in the glossary (1):
  view.counter
ERROR · data-ont in the mockup but not in the map (1):
  view.counter
glossary 36 · retired 6 · mockup 23 · map 22 · implemented 19 · scenarios 14 · tested 11 · tickets 1
DRIFT: 2
```

## What it checks

| Check | Direction | Severity |
| ----- | --------- | -------- |
| IDs in the ontology text exist in the glossary | text → glossary | error |
| glossary IDs use configured classes; no duplicates | glossary | error |
| rows follow the kind order; Kind cells name the kind on the first row of each group | definition tables | error |
| a field or relation sits in the table of the entity its ID names; one entity per table | definition tables | error |
| retired IDs have no row, their replacement exists, and only the decision log uses them | retired table → everything | error |
| generated tooltips equal the generator's output | glossary → generated file | error |
| `data-ont` IDs exist in the glossary | mockup → glossary | error |
| map and mockup have the same IDs | mockup ↔ map | error |
| dynamic classes have a live template | mockup | error |
| IDs in the map and the decision log exist in the glossary (the log may also use retired IDs) | map, log → glossary | error |
| `D-nn` references have entries; entries are unique | ontology, map → log | error |
| implementation table IDs exist; files exist | table → glossary, files | error |
| glossary rows are referenced somewhere | glossary → everything | error |
| scenario files have an `IDs:` line; their IDs exist | scenarios → glossary | error |
| implemented concepts of verifiable classes have a scenario | table → scenarios | error |
| test tags exist and name only implemented concepts | tests → glossary, table | error |
| implemented concepts of covered classes have a tagged test | table → tests | error |
| tickets have an `IDs:` line and scenarios; each scenario has a tag from that line and GIVEN … WHEN … THEN | tickets → glossary | error |
| interface-facing concepts not yet in the mockup | glossary → mockup | info |

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

`example/ont.config.json` configures the check for the example. `tools/ont-check/test/` breaks the example in twenty-four different ways and asserts that each break is named, and runs the guard on edits it must allow and edits it must refuse.
