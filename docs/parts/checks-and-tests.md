# 6. Checks and tests

## What it is

A catalogue of checks: what must hold, stated in the product's own terms, so that it applies to any implementation. The ontology says what a concept is; a check gives the case with data that proves it. Tests implement checks, and a test carries the ID of the check it implements at the start of its title.

```markdown
## Loan

| Check                         | Concepts                                 | GIVEN                                | WHEN                | THEN                        | Proof |
| ----------------------------- | ---------------------------------------- | ------------------------------------ | ------------------- | --------------------------- | ----- |
| `check.loan.renew-while-held` | `inv.no-renew-when-held`, `action.renew` | ana waits for Dune, ben has `dune-2` | ben renews `dune-2` | refused: someone is waiting | auto  |
```

```js
test("[check.loan.renew-while-held] renewal is refused while someone waits for the title", () => { … });
```

The catalogue has one section per entity, in the order of the ontology, and a check's ID names its section. The same check can be implemented by a unit test of the code that applies the rule and by an end-to-end test through the interface. If the product is rewritten in another language or moves from a command line to the web, the catalogue does not change; the tests are written again against it.

## Why

The ontology states an invariant in a sentence. A test proves it in the terms of one implementation: a function, a command, a selector. Between the two there was nothing persistent. Examples with data lived in tickets, which close, and then survived only as test code. A rewrite had to dig the cases out of old tests.

The catalogue is that missing layer. It is the same split behavior-driven development makes between scenarios in the language of the product and the step definitions that bind them to code. A check is written before the code, from the ontology; a test is written by whoever implements the check, a person or an agent, the way code is written from the ontology.

## Format

- One row per check: ID, the concepts it proves, GIVEN, WHEN, THEN, and the proof.
- IDs have the form `check.<section>.<name>`, where the section is the catalogue heading in lowercase: `check.loan.renew-while-held` under "## Loan", `check.screens.*` under "## Screens".
- GIVEN, WHEN and THEN use concrete data from a fixed sample (members, items, dates) and the product's terms. No function names, commands or selectors.
- Proof is `auto` when a test implements the check, `manual` when only a person or an agent using the product can: time passing on the calendar, whether a message is understandable, an external channel no test can reach.

## Tests that name checks

A test starts its title with the IDs of the checks it implements, in square brackets. The tag is plain text in the title, so it works with any test runner and shows up in its output. A test may also name a concept directly, `[field.loan.renewals]`, for something that is not a product check, such as comparing the code's constants with the generated contract.

## Test suites

Different kinds of concepts need different kinds of proof. A rule is proven by a fast test of the code that applies it. An action is proven only when it works the way a person uses it, through the interface. A hook is proven only by a test that controls time. The configuration says which suite must prove which kind of concept:

```json
"testSuites": [
  { "name": "unit",        "dir": "test/unit",        "cover": ["inv", "rule", "derived"] },
  { "name": "integration", "dir": "test/integration", "cover": ["hook"] },
  { "name": "end-to-end",  "dir": "test/e2e",         "cover": ["action", "view"] }
]
```

The names and the split are the project's; these three are common. Unit tests run the code in isolation. Integration tests run it with its real database and services, here with a clock the test controls. End-to-end tests drive the product from the outside, through its interface. A suite proves a concept when one of its tests names the concept or a check that lists it.

The suites themselves, how to run them and what they cost, belong to the team's process and its agent instructions, not to the ontology. A different team could test the same product with different suites, and neither the ontology nor the catalogue would change.

`ont-check.mjs --coverage` prints what proves each implemented concept: how many checks name it, how many of them are manual, and which suites prove it.

```text
| concept                  | checks       | unit | end-to-end |
| ------------------------ | ------------ | ---- | ---------- |
| `derived.overdue`        | 2 (1 manual) | yes  |            |
| `action.renew`           | 3            | yes  | yes        |
| `edge.loan.item`         |              |      |            |
```

## Rules

- **Checks come before code.** Every invariant, rule, hook and action (configurable) has a check, including those not built yet.
- **A test implements a check of implemented concepts only.** A test for a check whose concepts are still target means the implementation table or the test is wrong.
- **Every automatic check of implemented concepts has a test.** A manual check has none; it is run by a person or an agent, and its evidence goes to an ignored directory, named by check and date.
- **Report an unreachable path as unreachable.** A manual check that could not be run is not verified through a different path.

## What the check enforces

- Check IDs are unique and sit in their section; every row has six cells, at least one concept, GIVEN, WHEN, THEN and `auto` or `manual`.
- Every concept a check names exists in the glossary; a retired ID is reported with its replacement.
- Every concept of a required class has a check.
- Every automatic check whose concepts are all implemented is named by a test; no test names a manual check, an unknown check or a check of concepts not built.
- Every implemented concept of a class a test suite covers is proven by that suite. Suite names are unique, and every suite has test files.

## What it cannot enforce

- That the tests pass. The check reads tags; the test command runs the tests.
- That a test does what its check says. A tagged test that asserts nothing satisfies the check.
- That anyone ran a manual check.
- That the checks are the right ones. A check that restates the rule ("GIVEN a held title WHEN renewing THEN refused") is correct and proves nothing new; a good check names the member, the item and the dates.

## How it fails in practice

- **Checks written after the code**, copied from what the tests already do. They then describe the implementation, not the product. Write them from the ontology, before the ticket starts.
- **Manual as a way out.** A check marked `manual` because its test is hard to write, not impossible. Review every manual check: could a suite with a controlled clock or a test double do it?
- **Tags added to old tests wholesale** to satisfy the check. A tag is a claim that the test implements the check. Read the test before tagging it.

## Before the catalogue

Earlier versions kept a verification map: a directory of scenario files, one per feature, with an `IDs:` line. The tool still reads it under the `features` key, so existing projects keep working, but a new project uses the catalogue. The scenarios were recipes that nothing ran, and most of them repeated tests.

## In the example

[`example/checks.md`](../../example/checks.md): twenty checks, two of them manual, for every invariant, rule, hook and action, including the hold queue that is not built yet. Two test suites implement them: unit tests in [`example/app/library.test.mjs`](../../example/app/library.test.mjs) and end-to-end tests in [`example/e2e/cli.test.mjs`](../../example/e2e/cli.test.mjs), which run the command line front end as a separate process.
