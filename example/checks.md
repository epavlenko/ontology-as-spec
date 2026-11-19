# Lending Library — checks

Created: 2026-10-22
Status: maintained
Context: [ontology.md](./ontology.md)

What must hold, stated in the product's own terms so that it applies to any implementation: this command line app, a web app, or a rewrite in another language. The ontology says what a concept is; a check gives the case with data that proves it. Tests implement checks and start their title with the check's ID, `test("[check.loan.renew-while-held] …")`.

Rules:

- One section per entity, in the order of the ontology, then Screens. A check's ID names its section: `check.loan.*` sits under Loan.
- A row: ID, the concepts it proves, GIVEN, WHEN, THEN, how it is proven, and the outcomes it covers. `auto` means a test implements it; `manual` means a person or an agent with the product does, because no test can.
- Every invariant, rule, hook and action has at least one check, including those not built yet: the check is written before the code.
- An automatic check whose concepts are all implemented needs a test. A test may not implement a check whose concepts are not all implemented.
- Members and items in examples come from the sample collection: members ana, ben and carl; Dune with copies `dune-1` and `dune-2`.

`tools/ont-check/ont-check.mjs` checks all of these. `--coverage` shows which checks and suites prove each implemented concept; `--gap` lists what is left.

Outcomes: the checks of every action cover success, refusal, empty, error and silence, each named in the Covers column, or a Cannot occur line says why one cannot happen.

- Cannot occur: `action.checkout`, `action.return`, `action.renew`, `action.place-hold`, `action.cancel-hold`, `action.set-borrow-limit` silence — the library calls no other service, so every action answers in its own process.
- Cannot occur: `action.return` refusal — no rule refuses a return; an item that is not on loan is nothing to act on.

The oracle runs the traces below each table with `ont-check.mjs --run`. Every trace starts from this sample collection.

<details><summary>Traces</summary>

```traces
sample
  member ana borrow-limit=5
  member ben borrow-limit=5
  member carl borrow-limit=5
  title Dune
  item dune-1 copy-of=Dune condition=good
  item dune-2 copy-of=Dune condition=good
```

</details>

## Member

| Check                                   | Concepts                                                               | GIVEN                                                 | WHEN                                      | THEN                                                                          | Proof  | Covers           |
| --------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------- | ------ | ---------------- |
| `check.member.borrow-limit`             | `inv.within-limit`, `field.member.borrow-limit`                        | ben's borrow limit is 1 and he has a loan             | the desk checks out a second item to ben  | refused: ben already has 1 of 1 loans                                         | auto   |                  |
| `check.member.limit-refusal-explained`  | `inv.within-limit`, `action.checkout`                                  | ana already has five loans, her limit                 | she checks out a sixth item               | the refusal tells her that she already has as many loans as her limit allows  | judged | refusal          |
| `check.member.suspended-cannot-hold`    | `inv.suspended-cannot-borrow`, `action.place-hold`                     | ana has an overdue loan and every copy of Dune is out | ana places a hold on Dune                 | refused, with the overdue item named                                          | auto   | refusal          |
| `check.member.suspended-cannot-borrow`  | `inv.suspended-cannot-borrow`, `concept.suspension`, `action.checkout` | ana has an overdue loan                               | the desk checks out another item to ana   | refused, with the overdue item named; after she returns it, checkout succeeds | auto   | refusal          |
| `check.member.set-borrow-limit`         | `action.set-borrow-limit`, `field.member.borrow-limit`                 | ben has 2 loans and a borrow limit of 5               | the desk sets ben's limit to 3, then to 1 | his limit is 3; the second change is refused: ben has 2 open loans            | auto   | success, refusal |
| `check.member.set-limit-unknown-member` | `action.set-borrow-limit`                                              | no member has the code `zoe`                          | the desk sets zoe's borrow limit to 3     | refused: no member `zoe`; nothing changes                                     | auto   | empty            |

<details><summary>Traces</summary>

```traces
check.member.borrow-limit
  given
    2026-10-01 staff action.set-borrow-limit member=ben limit=1
    2026-10-01 staff action.checkout item=dune-1 member=ben
  when
    2026-10-02 staff action.checkout item=dune-2 member=ben
  then
    outcome refused by inv.within-limit
    says "ben already has 1 of 1 loans"
check.member.limit-refusal-explained
  given
    title Misc
    item misc-1 copy-of=Misc condition=good
    item misc-2 copy-of=Misc condition=good
    item misc-3 copy-of=Misc condition=good
    item misc-4 copy-of=Misc condition=good
    item misc-5 copy-of=Misc condition=good
    item misc-6 copy-of=Misc condition=good
    2026-10-01 staff action.checkout item=misc-1 member=ana
    2026-10-01 staff action.checkout item=misc-2 member=ana
    2026-10-01 staff action.checkout item=misc-3 member=ana
    2026-10-01 staff action.checkout item=misc-4 member=ana
    2026-10-01 staff action.checkout item=misc-5 member=ana
  when
    2026-10-02 staff action.checkout item=misc-6 member=ana
  then
    outcome refused by inv.within-limit
    says "ana already has 5 of 5 loans"
check.member.suspended-cannot-hold
  given
    2026-10-01 staff action.checkout item=dune-1 member=ana
    2026-10-25 staff action.checkout item=dune-2 member=ben
  when
    2026-10-25 ana action.place-hold title=Dune member=ana
  then
    outcome refused by inv.suspended-cannot-borrow
    says "dune-1"
check.member.suspended-cannot-borrow
  given
    2026-10-01 staff action.checkout item=dune-1 member=ana
  when
    2026-10-25 staff action.checkout item=dune-2 member=ana
    2026-10-25 staff action.return item=dune-1 condition=good
    2026-10-25 staff action.checkout item=dune-2 member=ana
  then
    outcome refused by inv.suspended-cannot-borrow
    says "dune-1"
    outcome ok
    outcome ok
check.member.set-borrow-limit
  given
    2026-10-01 staff action.checkout item=dune-1 member=ben
    2026-10-01 staff action.checkout item=dune-2 member=ben
  when
    2026-10-02 staff action.set-borrow-limit member=ben limit=3
    2026-10-02 staff action.set-borrow-limit member=ben limit=1
  then
    outcome ok
    outcome refused by action.set-borrow-limit
    says "ben has 2 open loans"
    assert (the member "ben").borrow-limit = 3
check.member.set-limit-unknown-member
  when
    2026-10-02 staff action.set-borrow-limit member=zoe limit=3
  then
    outcome empty
    says "zoe"
```

</details>

## Item

| Check                      | Concepts                                   | GIVEN                      | WHEN                                | THEN                                 | Proof | Covers  |
| -------------------------- | ------------------------------------------ | -------------------------- | ----------------------------------- | ------------------------------------ | ----- | ------- |
| `check.item.one-open-loan` | `inv.one-loan-per-item`, `action.checkout` | `dune-1` is on loan to ana | the desk checks out `dune-1` to ben | refused: `dune-1` is already on loan | auto  | refusal |

<details><summary>Traces</summary>

```traces
check.item.one-open-loan
  given
    2026-10-01 staff action.checkout item=dune-1 member=ana
  when
    2026-10-02 staff action.checkout item=dune-1 member=ben
  then
    outcome refused by inv.one-loan-per-item
    says "dune-1 is already on loan"
```

</details>

## Loan

| Check                             | Concepts                                                                | GIVEN                                                          | WHEN                                                                           | THEN                                                                                                     | Proof  | Covers           |
| --------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------ | ---------------- |
| `check.loan.due-in-21-days`       | `rule.loan-period`, `field.loan.due-date`, `action.checkout`            | nothing is on loan                                             | the desk checks out `dune-1` to ana on 2026-10-01                              | the loan is due on 2026-10-22                                                                            | auto   | success          |
| `check.loan.renew-twice`          | `rule.renewal`, `field.loan.renewals`, `action.renew`                   | ana's loan of `dune-1` is due on 2026-10-22                    | ana renews it, then again, then a third time                                   | due 2026-11-05, then 2026-11-19; the third renewal is refused                                            | auto   | success, refusal |
| `check.loan.renew-while-held`     | `inv.no-renew-when-held`, `action.renew`                                | ben has `dune-2`, ana has `dune-1` and waits for Dune          | ben renews `dune-2`                                                            | refused, and ben is told that someone is waiting                                                         | auto   | refusal          |
| `check.loan.overdue-after-due`    | `derived.overdue`, `view.member.loans`                                  | ana's loan is due on 2026-10-22                                | ana looks at her loans on 2026-10-22 and on 2026-10-23                         | not overdue on the 22nd, overdue on the 23rd                                                             | auto   |                  |
| `check.loan.overdue-in-real-time` | `derived.overdue`                                                       | ana borrowed an item and nobody sets the date by hand          | its due date passes on the calendar                                            | her loans show it overdue the next day without anyone doing anything                                     | manual |                  |
| `check.loan.return-closes-loan`   | `action.return`, `view.member.loans`                                    | ana has `dune-1`                                               | the desk takes `dune-1` back                                                   | ana has nothing on loan                                                                                  | auto   | success          |
| `check.loan.nothing-to-act-on`    | `action.checkout`, `action.return`, `action.renew`                      | no item has the code `dune-9`, and `dune-2` is on the shelf    | ana checks out `dune-9`, the desk takes back `dune-2`, and ana renews `dune-2` | each is refused with a message that names the item, as unknown or not on loan, and nothing changes       | auto   | empty            |
| `check.loan.state-unreadable`     | `action.checkout`, `action.return`, `action.renew`, `action.place-hold` | the state file holds something that is not the library's state | the desk runs any of these commands                                            | it stops with a message that the state cannot be read, exits with status 3 and leaves the file as it was | auto   | error            |
| `check.loan.due-reminder`         | `hook.due-reminder`, `action.renew`                                     | ana's loan is due on 2026-10-22 and nobody waits for Dune      | the day 2026-10-20 is processed                                                | ana is notified once, with the renew action offered                                                      | auto   |                  |

<details><summary>Traces</summary>

```traces
check.loan.due-in-21-days
  when
    2026-10-01 staff action.checkout item=dune-1 member=ana
  then
    outcome ok
    assert (first l in loans where l.item = "dune-1" by l.due-date).due-date = "2026-10-22"
check.loan.renew-twice
  given
    2026-10-01 staff action.checkout item=dune-1 member=ana
  when
    2026-10-02 ana action.renew item=dune-1
    assert (first l in loans where l.item = "dune-1" by l.due-date).due-date = "2026-11-05"
    2026-10-03 ana action.renew item=dune-1
    assert (first l in loans where l.item = "dune-1" by l.due-date).due-date = "2026-11-19"
    2026-10-04 ana action.renew item=dune-1
  then
    outcome ok
    outcome ok
    outcome refused by rule.renewal
    says "both renewals"
    assert (first l in loans where l.item = "dune-1" by l.due-date).renewals = 2
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
check.loan.overdue-after-due
  given
    2026-10-01 staff action.checkout item=dune-1 member=ana
  when
    2026-10-22 day
    assert not derived.overdue(first l in loans where l.item = "dune-1" by l.due-date)
    2026-10-23 day
  then
    assert derived.overdue(first l in loans where l.item = "dune-1" by l.due-date)
check.loan.return-closes-loan
  given
    2026-10-01 staff action.checkout item=dune-1 member=ana
  when
    2026-10-05 staff action.return item=dune-1 condition=good
  then
    outcome ok
    assert no l in loans where l.member = "ana" and l.returned-on = null
check.loan.nothing-to-act-on
  when
    2026-10-01 staff action.checkout item=dune-9 member=ana
    2026-10-01 staff action.return item=dune-2
    2026-10-01 ana action.renew item=dune-2
  then
    outcome empty
    says "dune-9"
    outcome empty
    says "dune-2"
    outcome empty
    says "dune-2"
    assert count(l in loans) = 0
check.loan.due-reminder
  given
    2026-10-01 staff action.checkout item=dune-1 member=ana
  when
    2026-10-20 day
    2026-10-21 day
  then
    notified ana by hook.due-reminder on 2026-10-20 offering action.renew says "dune-1 is due on 2026-10-22" once
```

</details>

- Not traced: `check.loan.overdue-in-real-time` — the calendar passing by itself belongs to the implementation; in the oracle a day is a step.
- Not traced: `check.loan.state-unreadable` — an error of reading the state file, which the oracle does not have.

## Hold

| Check                                  | Concepts                                        | GIVEN                                                           | WHEN                                                         | THEN                                                                                 | Proof | Covers           |
| -------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ----- | ---------------- |
| `check.hold.only-when-all-out`         | `action.place-hold`                             | `dune-2` is on the shelf                                        | ana places a hold on Dune                                    | refused: a copy is available; once both are out, it is placed                        | auto  | success, refusal |
| `check.hold.position-shown`            | `derived.queue-position`, `view.member.loans`   | both copies of Dune are out                                     | ana, then carl, place holds on Dune                          | ana sees position 1, carl position 2                                                 | auto  |                  |
| `check.hold.reserve-on-return`         | `hook.hold-ready`, `concept.reservation`        | ana waits for Dune and both copies are out                      | ben returns `dune-1`                                         | `dune-1` is reserved for ana for three days                                          | auto  |                  |
| `check.hold.reserved-not-available`    | `derived.available`, `concept.reservation`      | `dune-1` is reserved for ana                                    | anyone asks whether it is available                          | it is not, although no loan is open                                                  | auto  |                  |
| `check.hold.reserved-for-holder-only`  | `concept.reservation`, `action.checkout`        | `dune-1` is reserved for ana                                    | the desk checks it out to ben, then to ana                   | refused for ben; for ana it succeeds and closes her hold                             | auto  | refusal          |
| `check.hold.served-in-order`           | `inv.queue-order`                               | ana placed her hold before carl                                 | a copy of Dune comes back                                    | it is reserved for ana, not carl                                                     | auto  |                  |
| `check.hold.window-still-open`         | `rule.pickup-window`                            | `dune-1` was reserved for ana on 2026-10-10                     | the day 2026-10-13 is processed                              | the reservation still stands                                                         | auto  |                  |
| `check.hold.expiry-passes-on`          | `hook.hold-expire`, `rule.pickup-window`        | `dune-1` was reserved for ana on 2026-10-10 and carl waits next | the day 2026-10-14 is processed                              | ana's hold is closed as expired and `dune-1` is reserved for carl                    | auto  |                  |
| `check.hold.cancel`                    | `action.cancel-hold`, `derived.queue-position`  | ana and carl wait for Dune, in that order                       | ana cancels her hold                                         | she leaves the queue and carl is at position 1                                       | auto  | success          |
| `check.hold.nothing-to-act-on`         | `action.place-hold`, `action.cancel-hold`       | no title has the code `atlas`, and ben has no hold on Dune      | ana places a hold on `atlas`, and ben cancels a hold on Dune | each is refused with a message that names the title, and nothing changes             | auto  | empty            |
| `check.hold.unknown-member`            | `action.place-hold`                             | no member is called `zoe`, and both copies of Dune are out      | zoe places a hold on Dune                                    | it is refused with a message that names the member, and nothing changes              | auto  | empty            |
| `check.hold.staff-cancel-needs-reason` | `action.cancel-hold`                            | ana waits for Dune                                              | the desk cancels her hold without a reason                   | refused, and the desk is asked for the reason                                        | auto  | refusal          |
| `check.hold.state-unreadable`          | `action.cancel-hold`, `action.set-borrow-limit` | the state file holds something that is not the library's state  | the desk cancels a hold or sets a borrow limit               | it stops with a message that the state cannot be read, and leaves the file as it was | auto  | error            |

<details><summary>Traces</summary>

```traces
check.hold.only-when-all-out
  given
    2026-10-01 staff action.checkout item=dune-1 member=ben
  when
    2026-10-02 ana action.place-hold title=Dune member=ana
    2026-10-02 staff action.checkout item=dune-2 member=carl
    2026-10-02 ana action.place-hold title=Dune member=ana
  then
    outcome refused by action.place-hold
    says "a copy of Dune is available"
    outcome ok
    outcome ok
check.hold.position-shown
  given
    2026-10-01 staff action.checkout item=dune-1 member=ben
    2026-10-01 staff action.checkout item=dune-2 member=ben
  when
    2026-10-02 ana action.place-hold title=Dune member=ana
    2026-10-02 carl action.place-hold title=Dune member=carl
  then
    outcome ok
    outcome ok
    assert derived.queue-position(first h in holds where h.member = "ana" by h.placed-at) = 1
    assert derived.queue-position(first h in holds where h.member = "carl" by h.placed-at) = 2
check.hold.reserve-on-return
  given
    2026-10-01 staff action.checkout item=dune-1 member=ben
    2026-10-01 staff action.checkout item=dune-2 member=carl
    2026-10-02 ana action.place-hold title=Dune member=ana
  when
    2026-10-10 staff action.return item=dune-1 condition=good
  then
    outcome ok
    notified ana by hook.hold-ready on 2026-10-10 says "dune-1 is waiting for you until 2026-10-13"
    assert (first h in holds where h.member = "ana" by h.placed-at).reserved-item = "dune-1"
    assert (first h in holds where h.member = "ana" by h.placed-at).reserved-on + rule.pickup-window = "2026-10-13"
check.hold.reserved-not-available
  given
    2026-10-01 staff action.checkout item=dune-1 member=ben
    2026-10-01 staff action.checkout item=dune-2 member=carl
    2026-10-02 ana action.place-hold title=Dune member=ana
    2026-10-10 staff action.return item=dune-1 condition=good
  then
    assert not derived.available(the item "dune-1")
    assert no l in loans where l.item = "dune-1" and l.returned-on = null
check.hold.reserved-for-holder-only
  given
    2026-10-01 staff action.checkout item=dune-1 member=ben
    2026-10-01 staff action.checkout item=dune-2 member=carl
    2026-10-02 ana action.place-hold title=Dune member=ana
    2026-10-10 staff action.return item=dune-1 condition=good
  when
    2026-10-11 staff action.checkout item=dune-1 member=ben
    2026-10-11 staff action.checkout item=dune-1 member=ana
  then
    outcome refused by action.checkout
    says "reserved for someone else"
    outcome ok
    assert (first h in holds where h.member = "ana" by h.placed-at).state = "served"
check.hold.served-in-order
  given
    2026-10-01 staff action.checkout item=dune-1 member=ben
    2026-10-01 staff action.checkout item=dune-2 member=ben
    2026-10-02 ana action.place-hold title=Dune member=ana
    2026-10-03 carl action.place-hold title=Dune member=carl
  when
    2026-10-10 staff action.return item=dune-1 condition=good
  then
    outcome ok
    assert (first h in holds where h.member = "ana" by h.placed-at).reserved-item = "dune-1"
    assert (first h in holds where h.member = "carl" by h.placed-at).reserved-item = null
check.hold.window-still-open
  given
    2026-10-01 staff action.checkout item=dune-1 member=ben
    2026-10-01 staff action.checkout item=dune-2 member=carl
    2026-10-02 ana action.place-hold title=Dune member=ana
    2026-10-10 staff action.return item=dune-1 condition=good
  when
    2026-10-13 day
  then
    assert (first h in holds where h.member = "ana" by h.placed-at).state = "waiting"
    assert (first h in holds where h.member = "ana" by h.placed-at).reserved-item = "dune-1"
check.hold.expiry-passes-on
  given
    2026-10-01 staff action.checkout item=dune-1 member=ben
    2026-10-01 staff action.checkout item=dune-2 member=ben
    2026-10-02 ana action.place-hold title=Dune member=ana
    2026-10-03 carl action.place-hold title=Dune member=carl
    2026-10-10 staff action.return item=dune-1 condition=good
  when
    2026-10-14 day
  then
    assert (first h in holds where h.member = "ana" by h.placed-at).state = "expired"
    assert (first h in holds where h.member = "carl" by h.placed-at).reserved-item = "dune-1"
check.hold.cancel
  given
    2026-10-01 staff action.checkout item=dune-1 member=ben
    2026-10-01 staff action.checkout item=dune-2 member=ben
    2026-10-02 ana action.place-hold title=Dune member=ana
    2026-10-03 carl action.place-hold title=Dune member=carl
  when
    2026-10-04 ana action.cancel-hold title=Dune member=ana
  then
    outcome ok
    assert (first h in holds where h.member = "ana" by h.placed-at).state = "cancelled"
    assert derived.queue-position(first h in holds where h.member = "carl" by h.placed-at) = 1
check.hold.nothing-to-act-on
  when
    2026-10-01 ana action.place-hold title=atlas member=ana
    2026-10-01 ben action.cancel-hold title=Dune member=ben
  then
    outcome empty
    says "atlas"
    outcome empty
    says "Dune"
    assert count(h in holds) = 0
check.hold.unknown-member
  given
    2026-10-01 staff action.checkout item=dune-1 member=ben
    2026-10-01 staff action.checkout item=dune-2 member=ben
  when
    2026-10-02 zoe action.place-hold title=Dune member=zoe
  then
    outcome empty
    says "zoe"
    assert count(h in holds) = 0
check.hold.staff-cancel-needs-reason
  given
    2026-10-01 staff action.checkout item=dune-1 member=ben
    2026-10-01 staff action.checkout item=dune-2 member=ben
    2026-10-02 ana action.place-hold title=Dune member=ana
  when
    2026-10-03 staff action.cancel-hold title=Dune member=ana
  then
    outcome refused by action.cancel-hold
    says "reason"
    assert (first h in holds where h.member = "ana" by h.placed-at).state = "waiting"
```

</details>

- Not traced: `check.hold.state-unreadable` — an error of reading the state file, which the oracle does not have.

## Screens

| Check                                  | Concepts                                                                                             | GIVEN                                                                                                                               | WHEN                              | THEN                                                                                                                                                                        | Proof  | Covers  |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------- |
| `check.screens.refusal-understandable` | `view.desk`, `action.checkout`                                                                       | a librarian who has not read the rules                                                                                              | a checkout is refused at the desk | the message alone tells them why and what would make checkout possible                                                                                                      | manual | refusal |
| `check.screens.loans-shown`            | `view.member.loans`, `field.loan.due-date`, `field.loan.renewals`, `derived.overdue`, `action.renew` | ana has `dune-1`, overdue and renewed once, and `drill-1`, not due yet; ben has `dune-2`; ana returned an earlier loan of `drill-1` | ana opens My loans                | it shows only ana's open loans, never ben's nor the returned one; each with its due date and its renewals out of two, Dune marked overdue, and renewal offered on the drill | judged |         |
| `check.screens.loans-renew-held`       | `view.member.loans`, `inv.no-renew-when-held`                                                        | ana has `dune-1`, and carl waits for Dune                                                                                           | ana opens My loans                | renewal of Dune is shown as not possible, with the number of people waiting                                                                                                 | judged |         |
| `check.screens.loans-renew-exhausted`  | `view.member.loans`, `rule.renewal`                                                                  | ana's loan of `dune-1` was renewed twice, and nobody waits for Dune                                                                 | ana opens My loans                | renewal of Dune is shown as not possible, with the reason that both renewals are used                                                                                       | judged |         |
| `check.screens.loans-empty`            | `view.member.loans`                                                                                  | ana has no open loan and no hold                                                                                                    | ana opens My loans                | it says she has nothing on loan and nothing on hold, and points her to the catalog                                                                                          | judged |         |
| `check.screens.loans-suspended`        | `view.member.loans`, `concept.suspension`                                                            | ana has an overdue loan of `dune-1`                                                                                                 | ana opens My loans                | it says borrowing is paused until Dune is back, with the rule behind it, and shows no amount of money                                                                       | judged |         |
| `check.screens.loans-reminder`         | `view.member.loans`, `hook.due-reminder`                                                             | ana has a loan                                                                                                                      | ana opens My loans                | it says one reminder comes two days before a due date                                                                                                                       | judged |         |

- Not traced: `check.screens.refusal-understandable` — a screen is judged on the mockup; views are not in the oracle.
- Not traced: `check.screens.loans-shown` — a screen is judged on the mockup; views are not in the oracle.
- Not traced: `check.screens.loans-renew-held` — a screen is judged on the mockup; views are not in the oracle.
- Not traced: `check.screens.loans-renew-exhausted` — a screen is judged on the mockup; views are not in the oracle.
- Not traced: `check.screens.loans-empty` — a screen is judged on the mockup; views are not in the oracle.
- Not traced: `check.screens.loans-suspended` — a screen is judged on the mockup; views are not in the oracle.
- Not traced: `check.screens.loans-reminder` — a screen is judged on the mockup; views are not in the oracle.

## History

- 2026-10-28: `check.hold.unknown-member`: a hold, like a loan, is placed only for a member the library has.
- 2026-10-23: `check.member.set-borrow-limit` for `action.set-borrow-limit`, the staff action the borrow limit's definition already implied.
- 2026-10-22: `check.member.suspended-cannot-hold`, so that ticket #4 Suspend borrowing instead of fines covers both halves of the invariant.
- 2026-10-22: catalogue created from the scenario files and ticket #3 Serve the hold queue: reservation on return and the pickup window (D-14 of the approach).
