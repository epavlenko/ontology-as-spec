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

## Member

| Check                                   | Concepts                                                               | GIVEN                                                 | WHEN                                      | THEN                                                                          | Proof  | Covers           |
| --------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------- | ------ | ---------------- |
| `check.member.borrow-limit`             | `inv.within-limit`, `field.member.borrow-limit`                        | ben's borrow limit is 1 and he has a loan             | the desk checks out a second item to ben  | refused: ben already has 1 of 1 loans                                         | auto   |                  |
| `check.member.limit-refusal-explained`  | `inv.within-limit`, `action.checkout`                                  | ana already has five loans, her limit                 | she checks out a sixth item               | the refusal tells her that she already has as many loans as her limit allows  | judged | refusal          |
| `check.member.suspended-cannot-hold`    | `inv.suspended-cannot-borrow`, `action.place-hold`                     | ana has an overdue loan and every copy of Dune is out | ana places a hold on Dune                 | refused, with the overdue item named                                          | auto   | refusal          |
| `check.member.suspended-cannot-borrow`  | `inv.suspended-cannot-borrow`, `concept.suspension`, `action.checkout` | ana has an overdue loan                               | the desk checks out another item to ana   | refused, with the overdue item named; after she returns it, checkout succeeds | auto   | refusal          |
| `check.member.set-borrow-limit`         | `action.set-borrow-limit`, `field.member.borrow-limit`                 | ben has 2 loans and a borrow limit of 5               | the desk sets ben's limit to 3, then to 1 | his limit is 3; the second change is refused: ben has 2 open loans            | auto   | success, refusal |
| `check.member.set-limit-unknown-member` | `action.set-borrow-limit`                                              | no member has the code `zoe`                          | the desk sets zoe's borrow limit to 3     | refused: no member `zoe`; nothing changes                                     | auto   | empty            |

## Item

| Check                      | Concepts                                   | GIVEN                      | WHEN                                | THEN                                 | Proof | Covers  |
| -------------------------- | ------------------------------------------ | -------------------------- | ----------------------------------- | ------------------------------------ | ----- | ------- |
| `check.item.one-open-loan` | `inv.one-loan-per-item`, `action.checkout` | `dune-1` is on loan to ana | the desk checks out `dune-1` to ben | refused: `dune-1` is already on loan | auto  | refusal |

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

## Screens

| Check                                  | Concepts                       | GIVEN                                  | WHEN                              | THEN                                                                   | Proof  | Covers  |
| -------------------------------------- | ------------------------------ | -------------------------------------- | --------------------------------- | ---------------------------------------------------------------------- | ------ | ------- |
| `check.screens.refusal-understandable` | `view.desk`, `action.checkout` | a librarian who has not read the rules | a checkout is refused at the desk | the message alone tells them why and what would make checkout possible | manual | refusal |

## History

- 2026-10-28: `check.hold.unknown-member`: a hold, like a loan, is placed only for a member the library has.
- 2026-10-23: `check.member.set-borrow-limit` for `action.set-borrow-limit`, the staff action the borrow limit's definition already implied.
- 2026-10-22: `check.member.suspended-cannot-hold`, so that ticket #4 Suspend borrowing instead of fines covers both halves of the invariant.
- 2026-10-22: catalogue created from the scenario files and ticket #3 Serve the hold queue: reservation on return and the pickup window (D-14 of the approach).
