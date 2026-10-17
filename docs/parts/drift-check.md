# 5. Drift check

## What it is

One script that reads every artifact holding or referring to meaning and checks that the references are whole. It exits non-zero on drift and runs in two places: a pre-commit hook on the paths it covers, and CI. The generic version is [`tools/ont-check`](../../tools/ont-check/README.md).

A run on the example:

```text
$ node tools/ont-check/ont-check.mjs --config example/ont.config.json
glossary 36 · mockup 22 · map 22 · implemented 19 · scenarios 14
ONT_OK
```

A run after someone renamed the desk screen's ID in the mockup without touching anything else:

```text
ERROR · data-ont in the mockup but not in the glossary (1):
  view.counter
ERROR · IDs in the map but not in the mockup (1):
  view.desk
ERROR · data-ont in the mockup but not in the map (1):
  view.counter
info · glossary concepts with no mockup element yet (1):
  view.desk
glossary 36 · mockup 22 · map 22 · implemented 19 · scenarios 14
DRIFT: 3
```

## What it checks

| Check | Direction | Severity |
| ----- | --------- | -------- |
| IDs in the ontology text exist in the glossary | text → glossary | error |
| glossary IDs use configured classes; no duplicates | glossary | error |
| generated tooltips equal the generator's output | glossary → generated file | error |
| `data-ont` IDs exist in the glossary | mockup → glossary | error |
| map and mockup have the same IDs | mockup ↔ map | error |
| dynamic classes have a live template | mockup | error |
| IDs in the map and the decision log exist in the glossary | map, log → glossary | error |
| `D-nn` references have entries; entries are unique | ontology, map → log | error |
| implementation table IDs exist; files exist | table → glossary, files | error |
| glossary rows are referenced somewhere | glossary → everything | error |
| scenario files have an `IDs:` line; their IDs exist | scenarios → glossary | error |
| implemented concepts of verifiable classes have a scenario | table → scenarios | error |
| interface-facing concepts not yet in the mockup | glossary → mockup | info |
| glossary concepts not explained in the ontology text | glossary → text | info |

The "both directions" part matters. Checking only that references resolve catches typos. Checking also that every concept is referenced, every labelled element is mapped and every implemented concept has a way to be proven catches the slower failure: things that quietly stop being connected.

## Design choices

- **One parser for the generator and the check.** If the two read the glossary differently, a malformed row can pass the check and still break the tooltips.
- **IDs are recognized in backticks only** in Markdown, and only for configured classes. Prose stays prose; a version number like `v1.2` is not an ID.
- **Errors and information are separate.** "Not yet in the mockup" is a backlog, not a failure. Failing on it would push people to add meaningless labels.
- **Plain text output, one line per finding.** Agents read it and fix the exact line.
- **No dependencies.** It runs wherever Node runs, in a hook, in CI, in an agent's sandbox.

## What it cannot check

- Meaning. It does not know whether a definition is right, whether two prose descriptions of the same concept agree, or whether an element labelled `action.renew` renews anything.
- Code behavior. Code does not refer to IDs, so code that contradicts the ontology passes.
- Whether an accepted decision entry was edited.

These are listed with possible remedies in [limitations](../limitations.md).

## How it fails in practice

- **The hook covers too few paths.** If code changes do not trigger the check, the implementation table goes stale without a signal. Include the code paths that implement concepts, even though the check does not read code. The point is the reminder.
- **Someone adds a rule to silence a finding.** A finding means two artifacts disagree. Fix one of them.
- **The check grows into a linter of style.** Keep it about references between artifacts.

## In the example

`example/ont.config.json` configures the check for the example. `tools/ont-check/test/` breaks the example in thirteen different ways and asserts that each break is named.
