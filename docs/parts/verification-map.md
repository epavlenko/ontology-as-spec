# 6. Verification map

## What it is

A directory of scenario files, one per user-visible feature, each saying how to prove the feature works the way a user sees it. Every file starts with an `IDs:` line listing the concepts it proves:

```markdown
# Renewal

IDs: `action.renew`, `rule.renewal`, `inv.no-renew-when-held`, `field.renewals`

A member renews a loan to keep the item longer. …

## Scenarios

- **Refused while held.** … `renew dune-2` prints `refused: 1 member(s) waiting for this title`.
```

The check requires that every implemented concept of a verifiable class (by default `view`, `action`, `hook`) appears on some `IDs:` line. Implementing such a concept therefore means writing down, in the same change, how to prove it.

## Why

The implementation table says "this exists". The scenario says "and this is how you would know it works". Without the second, an implemented concept is a claim. With it, any agent can verify a feature without a setup conversation, and a reviewer can ask for the evidence of a specific concept.

Scenarios here are recipes, not test code. They can be driven by a person, by an agent with a browser, or turned into automated end-to-end tests. Each scenario pairs an action with an observable result. Where an automated test already covers a step, the scenario cites it.

## Tests that name IDs

Scenarios prove a feature the way a user sees it. Invariants, rules and derived values are proven better by automated tests, and a test says which concepts it proves with a tag at the start of its title:

```js
test("[inv.one-loan-per-item] an item cannot be on two loans", () => { … });
test("[rule.renewal, field.loan.renewals] renewal adds 14 days, at most twice", () => { … });
```

The tag is plain text in the title, so it works with any test runner and shows up in its output. When a ticket's scenario becomes a test, the test carries the scenario's tag (see [part 8](agent-workflow.md#scenarios)).

The check reads the tags from the test suites in the configuration and enforces two directions:

- every implemented concept of a class a suite covers is named by at least one test in that suite;
- a test names only concepts the implementation table lists. A tag on something "not implemented" means either the table or the tag is wrong.

This gives the implementation table a mechanical counterpart for the classes that tests can prove.

## Test suites

Different kinds of concepts need different kinds of proof. A rule is proven by a fast test of the code that applies it. An action is proven only when it works the way a person uses it, through the interface. A hook is proven only by a test that controls time. The configuration says which suite must prove which kind of concept:

```json
"testSuites": [
  { "name": "unit",        "dir": "test/unit",        "cover": ["inv", "rule", "derived"] },
  { "name": "integration", "dir": "test/integration", "cover": ["hook"] },
  { "name": "end-to-end",  "dir": "test/e2e",         "cover": ["action", "view"] }
]
```

The names and the split are the project's; these three are common. Unit tests run the code in isolation. Integration tests run it with its real database and services, here with a clock the test controls. End-to-end tests drive the product from the outside, through its interface. The check names the suite in what it reports: "implemented concepts without a test in the end-to-end suite: `action.renew`".

The suites themselves, how to run them and what they cost, belong to the team's process and its agent instructions, not to the ontology. The ontology describes the product. A different team could test the same product with different suites, and the ontology would not change.

`ont-check.mjs --coverage` prints what proves each implemented concept, one column per suite and one for the scenarios:

```text
| concept                  | unit | end-to-end | scenarios |
| ------------------------ | ---- | ---------- | --------- |
| `inv.no-renew-when-held` | yes  |            | yes       |
| `action.renew`           |      | yes        | yes       |
| `edge.loan.item`         |      |            |           |
```

An empty row is not an error when no suite covers the class. It shows where the proof is thinnest.

## Format

- H1 title, the `IDs:` line, one paragraph on the user-visible behavior.
- Preconditions: the state to start from.
- Scenarios: labelled bullets, each an action and the exact observable result.
- Gotchas: traps that can waste or invalidate a run.
- An index file listing the features with one line each.

Keep implementation details out: user paths, stable handles, required state, observable proof.

## Rules

- **A row added to the implementation table for a verifiable class comes with a scenario** in the same change.
- **Report an unreachable path as unreachable.** A scenario that could not be run is not verified through a different path.
- **Evidence outside the repository.** Screenshots and logs from a run go to an ignored directory, named by feature and date.

## What the check enforces

- Every scenario file has an `IDs:` line.
- Every ID on those lines exists in the glossary.
- Every implemented `view`, `action` or `hook` (configurable) is covered.
- Every implemented concept of a class a test suite covers is named by a test tag in that suite, every tagged ID exists, and every tagged ID is in the implementation table. Suite names are unique, and every suite has test files.

## What it cannot enforce

- That the scenario passes. The check confirms the recipe exists, not that anyone ran it. Tests are run by the test command, not by the check.
- That the scenario or the test actually exercises the concept it lists. A tagged test that asserts nothing satisfies the check.
- Coverage of fields and entities. They are usually proven through views, actions and the tests of rules, and requiring a scenario or a test per field would produce noise. A project that wants it adds the classes to the configuration.

## How it fails in practice

- **Scenarios rot when the interface changes**, because nothing runs them. Cite an automated test for each step where one exists; tagged tests are found by searching for the ID.
- **Tags added to old tests wholesale** to satisfy the check. A tag is a claim that the test proves the concept. Read the test before tagging it.
- **One giant scenario file lists every ID** to satisfy the check. Split by feature; one file per thing a user would name.

## In the example

[`example/features/`](../../example/features/README.md): three scenario files covering the five implemented views and actions, run against the command line front end. Two test suites: unit tests in [`example/app/library.test.mjs`](../../example/app/library.test.mjs), tagged with the invariants, rules and derived values they prove, and end-to-end tests in [`example/e2e/cli.test.mjs`](../../example/e2e/cli.test.mjs), which run the command line front end as a separate process and prove the actions and the view.
