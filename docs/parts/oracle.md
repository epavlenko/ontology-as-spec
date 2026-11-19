# 10. The oracle (prototype)

Tentative: this part describes the prototype of D-93 on its branch. It is not adopted.

<!-- ont: ent.formal-form@c38589, concept.oracle@88e2a7, rule.oracle-not-the-product@f49d52 -->
## What it is

A definition row says what a concept is in words. A formal form says the same in a small form language that a program can run: how a derived value or a rule is computed, what an invariant refuses, what an action or a hook does. The tool's interpreter, the oracle, runs the forms. An action is a step with an actor and a day; it is refused by the forms it names, or its statements change records of entities. A hook runs on each day, or after an action.

The oracle is not the product. A model still writes the product's code from the ontology ([principle 6](../principles.md#6-the-ontology-is-the-source-of-the-code)), and nothing deploys or serves the oracle. It answers two questions the check cannot: whether the ontology says enough to decide every case of the catalogue, and whether the code does what the ontology says.

<!-- ont: rule.form-follows-rows@8006af, inv.form-per-row@953997, inv.form-names-defined@50002b, edge.formal-form.concept@5f50bc -->
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

**Expressions.** A name is a parameter, a loop variable, a collection (an entity's term in the plural: `loans`), `today`, `now` or `actor`. After a dot comes a field or relation of the entity, written as the last part of its ID (`due-date` for `field.loan.due-date`); a relation leads on to its entity (`loan.item.copy-of`). A derived value or a concept is called by its ID (`derived.overdue(l)`), a rule's value read by its ID (`rule.loan-period`, `rule.renewal.adds`), an object found by its term and ID (`the item "dune-1"`). Operators: `and`, `or`, `not`, comparisons, `+` and `-` on numbers and on a date and a duration (`21 days`). Over a collection: `some`, `no`, `every x in c where …`, `count(x in c where …)`, `first x in c where … by …`. `where` takes everything to its right; parentheses end it. There are no loops, no assignment inside expressions and no functions of one's own, so every expression ends.

**Statements** of actions, hooks, rules and invariants: `let`, `refuse when … says …`, `empty when … says …` (nothing to act on), `refuse by` an invariant or a rule, `create`, `set`, `each x in c where …:`, `if …:`, `notify … offering` an action when it is allowed, and `always` for an invariant that must hold after every step. An action's parameters that are named after an entity must name an object, or the action is empty; `by staff`, `by member` or both say who may do it. An action runs on a copy of the state, which replaces the state only when nothing refused.

The check reports a row of a derived value, rule, invariant, hook or action without a form, a form out of the order of the rows or outside a folded block, and every name a form uses that the ontology does not define, typed by entity: `loan.due` fails when the loan has no field `due`.

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

<!-- ont: rule.code-compared-with-oracle@39c0ea -->
## Code compared with the oracle

A project with an oracle runs its code and the oracle on the same random sequences of implemented actions and days, and compares after every step what both can observe: accepted or refused, the open records and what is available. A difference fails the test, unless it matches a known divergence of the ontology with its condition; a matched divergence ends its sequence, since the states then differ. The test also fails when it compares nothing, and it keeps a failing sequence with its seed so that it can be run again. The example's `example/app/oracle.test.mjs` is such a test. This is model-based testing of a state machine, as in [QuickCheck](https://dl.acm.org/doi/10.1145/351240.351266) (Claessen and Hughes, 2000) and its [testing of command sequences](https://research.chalmers.se/publication/232550) (Hughes, 2016); refusals by preconditions descend from [Design by Contract](https://se.inf.ethz.ch/~meyer/publications/computer/contract.pdf) (Meyer, 1992).

<!-- ont: -->
## How it fails

- A form restates a definition and can say something else. The row is the meaning; the form is fixed like code, and the trace of a check shows where they part.
- The oracle runs only what the forms say. A view is not run, and a check of one stays judged on the mockup.
- Two expressions can compute the same value differently; the language has no types beyond what the ontology's rows say.

<!-- ont: -->
## Reference

The concepts of this part are on the [reference](../reference.md) page, under Formal form and Trace.
