# 10. The oracle

The ontology run by the tool (D-93).

<!-- ont: ent.formal-form@c38589, concept.oracle@88e2a7, rule.oracle-not-the-product@f49d52 -->
## What it is

A definition row says what a concept is in words. A formal form says the same in a small form language that a program can run: how a derived value or a rule is computed, what an invariant refuses, what an action or a hook does. The tool's interpreter, the oracle, runs the forms. An action is a step with an actor and a day; it is refused by the forms it names, or its statements change records of entities. A hook runs on each day, or after an action.

The oracle is not the product. A model still writes the product's code from the ontology ([principle 6](../principles.md#6-the-ontology-is-the-source-of-the-code)), and nothing deploys or serves the oracle. It answers two questions the check cannot: whether the ontology says enough to decide every case of the catalogue, and whether the code does what the ontology says.

<!-- ont: rule.form-follows-rows@8006af, inv.form-per-row@953997, inv.form-names-defined@50002b, edge.formal-form.concept@5f50bc, inv.forms-end@2d3163, inv.writes-in-type@33e649 -->
## Forms

The forms of a section sit in one folded behavior block under its table, in the order of the rows, each starting with its row's ID. A reader of the ontology sees the tables and notes as before; the block opens on a click.

````markdown
<details><summary>Behavior</summary>

```behavior
derived.overdue(loan) = loan.returned-on = null and today > loan.due-date
rule.renewal
  limit = 2
  adds = 14 days
  refuse when loan.renewals >= limit
  says "both renewals of {loan.item} are used"
action.renew(item) by member
  let loan = first l in loans where l.item = item and l.returned-on = null by l.due-date
  empty when loan = null
  says "{item} is not on loan"
  refuse by rule.renewal
  refuse by inv.no-renew-when-held
  set loan.due-date = loan.due-date + rule.renewal.adds
  set loan.renewals = loan.renewals + 1
```

</details>
````

**Expressions.** A name is a parameter, a loop variable, a collection (an entity's term in the plural: `loans`), `today`, `now` or `actor`. After a dot comes a field or relation of the entity, written as the last part of its ID (`due-date` for `field.loan.due-date`); a relation leads on to its entity (`loan.item.copy-of`). A derived value or a concept is called by its ID (`derived.overdue(l)`), a rule's value read by its ID (`rule.loan-period`, `rule.renewal.adds`), an object found by its term and ID (`the item "dune-1"`). Operators: `and`, `or`, `not`, comparisons, `+` and `-` on numbers and on a date and a duration (`21 days`). Over a collection: `some`, `no`, `every x in c where …`, `count(x in c where …)`, `first x in c where … by …`. `where` takes everything to its right; parentheses end it. There are no loops, no assignment inside expressions and no functions of one's own; the only way an expression could fail to end is a form that reads itself, and the check refuses that.

**Statements** of actions, hooks, rules and invariants: `let`, `refuse when … says …`, `empty when … says …` (nothing to act on), `refuse by` an invariant or a rule, `create`, `set`, `each x in c where …:`, `if …:`, `notify … offering` an action when it is allowed, and `always`, at the top of an invariant only, for what must hold after every step. An action's parameters that are named after an entity must name an object, or the action is empty; `by staff`, `by member` or both say who may do it. An action runs on a copy of the state, which replaces the state only when nothing refused. A value written to a field must be of the field's type, read with the same vocabulary as the contracts (`integer 1..`, `one of …`, `date optional`, …), and a relation must name a record of its entity; a write outside it stops the run and names the form, because the rows forbid the value and the ontology does not say what happens instead. Writing empty is not checked: a record starts with every field empty.

The check reports a row of a derived value, rule, invariant, hook or action without a form, a form out of the order of the rows or outside a folded block, every name a form uses that the ontology does not define, typed by entity (`loan.due` fails when the loan has no field `due`), a field set on a value that is not a record, an `always` anywhere but at the top of an invariant, a refusal of a rule or an invariant that no action or hook names (its names are read in the scope of what names it, down the chain of refusals), and a derived value, concept or rule value that reads itself, or a rule or invariant that names itself by `refuse by`, directly or through other forms.

<!-- ont: ent.trace@eb1f36, edge.trace.check@1c9da9, inv.trace-per-check@1eb13e, inv.traces-pass@523e74 -->
## Traces

A trace is a check's case as steps: the GIVEN and the WHEN as actions and days, the THEN as outcomes, messages, notifications and assertions. It sits in a folded traces block of its check's section in the catalogue; a sample block holds the collection every trace starts from. A check that the oracle cannot run is listed on a `- Not traced:` line with the reason; the check allows that only for a check of a section of views (the screens), a manual check or one that covers the error outcome, so that a trace cannot be dropped by writing a reason. A notification is checked by its recipient, the hook or action that sent it, its day and its text: `notified ana by hook.due-reminder on 2026-10-20 offering action.renew says "dune-1 is due" once`. The oracle logs every step, with its actor and day.

```text
check.loan.renew-while-held
  given
    2026-10-01 staff action.checkout item=dune-2 member=ben
    2026-10-01 staff action.checkout item=dune-1 member=ana
    2026-10-02 ana action.place-hold title=Dune member=ana
  when
    2026-10-05 ben action.renew item=dune-2
  then
    outcome refused by inv.no-renew-when-held
    says "someone is waiting for Dune"
```

Days pass one by one: a step on a later day processes every day in between, so a hook on a day is never skipped. `ont-check.mjs --run` runs every trace and prints each check with ok, fail or skip and its reason; the run fails when a trace does not hold, when a check has neither a trace nor a reason, and when a trace names no check.

<!-- ont: rule.code-compared-with-oracle@39c0ea, inv.code-compared@fb0f39 -->
## Code compared with the oracle

A project with an oracle runs its code and the oracle on the same random sequences of implemented actions and days, and compares after every step what both can observe: accepted or refused, the open records and what is available. A difference fails the test, unless it matches a known divergence of the ontology with its condition; a matched divergence ends its sequence, since the states then differ. The test also fails when it compares nothing, and it keeps a failing sequence with its seed so that it can be run again. The example's `example/app/oracle.test.mjs` is such a test. This is model-based testing of a state machine, as in [QuickCheck](https://dl.acm.org/doi/10.1145/351240.351266) (Claessen and Hughes, 2000) and its [testing of command sequences](https://research.chalmers.se/publication/232550) (Hughes, 2016); refusals by preconditions descend from [Design by Contract](https://se.inf.ethz.ch/~meyer/publications/computer/contract.pdf) (Meyer, 1992).

With the oracle on and an action built, the check fails unless a test of the project's suites runs the oracle (D-103). What that test compares is the reviewer's to read: a test that runs the oracle and compares nothing would pass a reading of names.

<!-- ont: concept.code-adapter@1e5b96, rule.trace-runs-on-code@fa4aba, inv.trace-run-on-code@12378d -->
## A check's trace on the code

A comparison on random sequences finds where the code and the oracle part; a trace says, for one check, that they agree on its case. A project's adapter (`adapter` in the configuration) calls each implemented action in the code, reads a refusal of the code as the row that refused it, and shows the code's state as records of the ontology. A trace then runs on the code as `--run` runs it on the oracle, by a test of the project, `checkTest("[check.id] …")` of the tool's `code-traces.mjs`; the check fails on a traced check whose concepts are all built and whose trace takes only actions the adapter runs, when no test runs it on the code (D-101). On the code a trace may differ only where a known divergence names one of the check's concepts. The adapter translates and hides nothing; what the code does not keep is left empty. The derived values an assertion reads are computed by the forms from the code's records, so a trace on the code holds what the code keeps and how it refuses, not its own computation of a derived value; the comparison reads the code's own views for that.

<!-- ont: derived.surviving-mutation@25b6cb, rule.test-fails-on-mutant@432c9a, inv.no-empty-test@f071ae -->
## Changes of the forms

`ont-check --mutate` changes one line of a form at a time, a number by one, a comparison turned, and and or swapped, a not dropped, true and false swapped, and runs every trace on the oracle with it (D-102). A change that no trace fails on survives and is listed: either the catalogue does not hold that case, as when no check tells a member at the limit from one above it, or the change alters nothing that can be observed, which only a reader can tell. A test of a check written against a system, listed under `systemTests`, then runs on the oracle with each change its check's trace fails on; a test that passes there is empty, and the check fails. This is mutation testing, as [Stryker](https://stryker-mutator.io/docs/mutation-testing-elements/mutant-states-and-metrics/) applies it to code, applied to the forms of the ontology; the code is not changed.

<!-- ont: -->
## How it fails

- A form restates a definition and can say something else. The row is the meaning; the form is fixed like code, and the trace of a check shows where they part.
- The oracle runs only what the forms say. A view is not run, and a check of one stays judged on the mockup.
- Two expressions can compute the same value differently; the language has no types beyond what the ontology's rows say.

<!-- ont: -->
## Reference

The concepts of this part are on the [reference](../reference.md) page, under Formal form and Trace.
