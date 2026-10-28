# 6. Checks and tests

<!-- ont: ent.check@d0dcbc, inv.required-concepts-checked@4f9fa8 -->
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

The catalogue is that missing layer. It is the split behavior-driven development tools make between scenarios in the language of the product and the code that runs them. In Cucumber's words, "A Step Definition is a method with an expression that links it to one or more Gherkin steps" ([Cucumber, Step definitions](https://cucumber.io/docs/cucumber/step-definitions/)). A check is written before the code, from the ontology; a test is written by whoever implements the check, a person or an agent, the way code is written from the ontology.

<!-- ont: ent.test@af89b6, inv.test-names-known-checks@1384c7, inv.test-only-implemented@059c2e, inv.no-manual-tested@46671b -->
## Tests that name checks

A test starts its title with the IDs of the checks it implements, in square brackets. The tag is plain text in the title, so it works with any test runner and shows up in its output. A test may also name a concept directly, `[field.loan.renewals]`, for something that is not a product check, such as comparing the code's constants with the generated contract.

The tool reads tags anywhere in a test file, not only in titles, because it cannot parse the syntax of every test framework. A string in a fixture that looks like a tag counts as one. When a fixture must contain an invalid tag, build the string from parts, as the tool's own tests do.

<!-- ont: ent.test-suite@6bf22e, inv.suite-covers-classes@39e870, inv.suite-names-unique@f69f85, inv.suite-not-empty@2cd076 -->
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

<!-- ont: edge.test-suite.checks@44582d, inv.suite-implements-checks@a2592f -->
## Checks a suite must implement

Classes say which suite proves a kind of concept. A suite may also name checks it must implement, which covers what classes cannot: a key scenario that runs through several actions must be proven end to end as a whole, not action by action. The configuration lists them on the suite, `"checks": ["check.loan.renew-while-held"]`, and the check fails on a named check of implemented concepts that none of the suite's tests implements, on one the catalogue does not have, and on a manual one, which has no test.

<!-- ont: inv.judged-check-tested@39910a, rule.judge-sees-the-check@2d7cba, rule.verdict-kept@10793d -->
## Checks a model judges

Some values are written by a model: a summary of an event, the claims extracted from an interview, a reply to a member. A test that compares them with an exact text breaks on every harmless change, and a manual check of them is seldom run. A judged check sits between the two: its proof is `judged`, a test runs the product on a fixed sample, and a model reads the output next to the check's THEN and says whether it holds.

```js
import { judge } from "../tools/ont-check/judge.mjs";
test("[check.member.limit-refusal-explained] a refusal at the borrow limit says why", () => {
  const output = refusalFor("ana", "dune-6");
  const { pass, verdict } = judge({ checks: "checks.md", id: "check.member.limit-refusal-explained", output });
  assert.ok(pass, verdict);
});
```

The judge reads the check's case and the product's output, never the code, the test or an expected text, so that it judges the product and not the implementation; `judge.mjs` builds exactly that prompt and runs the command in `JUDGE`, which the project chooses. The verdict is kept outside the repository, named by the check and the date, like the evidence of a manual check: the helper writes it where `JUDGE_VERDICTS` points. Nothing in a product's ontology tells a generated value from another, so the suite that runs judged checks names them, and the check fails on a judged check of implemented concepts that no suite names. Judged checks are automatic, so they count wherever automatic ones do: in the gap, in a finished slice and in a check a ticket waits for. Each run costs a call to a model, so a project may keep their suite apart and run it on purpose, and a test may skip itself when no judge is set.

<!-- ont: inv.check-ids-unique@31d42a, inv.check-in-its-section@03fc5e, inv.section-keys-match@f8649b, inv.check-well-formed@aa846c, inv.auto-check-tested@5246eb, rule.check-in-product-terms@e5b72b, rule.unreachable-reported@652d50, rule.manual-evidence-kept@7a3782, inv.test-does-what-check-says@2b7515, rule.chosen-value-checked@ca73cc -->
## Reference

The fields of a check, a test and a test suite, their rules and the checks that hold them are in the reference: [Check](../reference.md#check), [Test](../reference.md#test) and [Test suite](../reference.md#test-suite). A check's ID has the form `check.<section>.<name>`. The section is the key of the catalogue heading: the code span in it when there is one, ``## Préstamo `loan` ``, and otherwise the heading's Latin letters and digits in lowercase, joined by hyphens. A heading with other letters, accented ones included, therefore needs a code span, and the ontology's section of the same entity carries the same key; the tool fails when a catalogue key names no ontology section, or two ontology sections share one. Its cases use concrete data from a fixed sample and the product's words, never a function, a command or a selector.

The tool reads tags; the test command runs the tests. So the tool cannot tell whether the tests pass, whether a tagged test does what its check says, or whether anyone ran a manual check. A manual check that could not be run is reported as not run, and the evidence of those that ran is kept outside the repository, named by check and date.

A value that a decision chose, or a target that is a requirement on the product, is held by an automatic check; without one, a later edit can move the product away from what was decided while every test passes. A model whose results inform people, such as a business model, is different. Its assumptions are held by a snapshot of its base scenario: a check that records what the default values produce, so that an unintended change fails and an intended one updates the snapshot together with an entry in the log ([part 2](decision-log.md#reference)). No check requires the model to reach its goal. Whether it does is what the model is for, and a test that demands it would turn an honest gap into a failure that tuning the assumptions makes go away.

<!-- ont: rule.guide-runs-check@eb28c9 -->
## Running manual checks

A manual check is run by a person or an agent in the product, and the catalogue says what they should see, in the product's terms. How to get there is a different kind of knowledge: where to start, the steps and what shows after each one, what to keep as evidence, and the traps where a run gets lost, such as content that loads late or a notice that covers a button. For an automatic check that knowledge is the test. For a manual check it lives in a run guide, a doc set whose sections anchor the checks they explain ([part 9](documentation.md#how-it-is-written)). A section names its check by ID and does not restate GIVEN, WHEN or THEN, so the catalogue stays the one place that says what must hold; when a check's case changes, its stamp lists the section to reread.

A doc set that lists `"checks": ["manual"]` must name every manual check of implemented concepts, so a manual check without a way to run it fails the check at the moment an automatic check without a test would. The evidence of a run is kept outside the repository, named by the check's ID and the date; the guide says what to keep.

## How it fails in practice

- **Checks written after the code**, copied from what the tests already do. They then describe the implementation, not the product. Write them from the ontology, before the ticket starts.
- **Manual as a way out.** A check marked `manual` because its test is hard to write, not impossible. Review every manual check: could a suite with a controlled clock or a test double do it?
- **Tags added to old tests wholesale** to satisfy the check. A tag is a claim that the test implements the check. Read the test before tagging it.

## Before the catalogue

Earlier versions kept a verification map: a directory of scenario files, one per feature, with an `IDs:` line. The tool still reads it under the `features` key, so existing projects keep working, but a new project uses the catalogue. The scenarios were recipes that nothing ran, and most of them repeated tests.

## In the example

[`example/checks.md`](../../example/checks.md): twenty-two checks, two of them manual, for every invariant, rule, hook and action, including the hold queue that is not built yet. The manual check of a built concept has a run guide, [`example/verify/overdue.md`](../../example/verify/overdue.md). Two test suites implement the automatic ones: unit tests in [`example/app/library.test.mjs`](../../example/app/library.test.mjs) and end-to-end tests in [`example/e2e/cli.test.mjs`](../../example/e2e/cli.test.mjs), which run the command line front end as a separate process.
