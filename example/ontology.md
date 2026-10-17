# Lending Library — ontology

Created: 2026-10-17
Status: working draft, fictional example for this repository
Source of truth: this file. Decisions and their reasons live in [decisions.md](./decisions.md).

The ontology describes the entities, fields, relations, rules and views of a small lending library app: members borrow items, wait in a queue for titles that are out, and return items on time or late. It describes the **target model**. What the code already does is listed in "Implementation status" at the end; everything not listed there is target.

**Identifiers.** Every concept has a permanent ID of the form `class.name` (`field.due-date`, `inv.one-loan-per-item`). The ID never changes when the term is renamed; only the glossary text changes. The mockup (`data-ont` attributes and tooltips), the UI-to-ontology map, the decision log, the verification scenarios, the tickets and the implementation table refer to concepts by ID. The full list is the "Glossary" section; it is also the source of the mockup tooltips.

## Entities

| ID            | Entity | What it is                                                         |
| ------------- | ------ | ------------------------------------------------------------------ |
| `ent.member`  | Member | a person registered with the library who can borrow                |
| `ent.title`   | Title  | a work in the catalog: a book, a board game, a tool model          |
| `ent.item`    | Item   | one physical copy of a title; the thing that is actually lent      |
| `ent.loan`    | Loan   | an item lent to a member, from checkout until return               |
| `ent.hold`    | Hold   | a member's place in the queue for a title whose items are all out  |

A title has one or more items through `edge.copy-of`. A member borrows items, not titles, but waits for titles, not items: whichever copy comes back first serves the queue (D-02).

## Fields

| ID                      | Field          | Of     | Who sets it                                    | Notes                                                                |
| ----------------------- | -------------- | ------ | ---------------------------------------------- | -------------------------------------------------------------------- |
| `field.due-date`        | due date       | loan   | the system at checkout and renewal             | checkout date plus `rule.loan-period`; renewal moves it per `rule.renewal` |
| `field.renewals`        | renewals       | loan   | the system                                     | how many times this loan was renewed; a fact, not a setting          |
| `field.borrow-limit`    | borrow limit   | member | staff                                          | maximum number of open loans; default 5                              |
| `field.item-condition`  | condition      | item   | staff at return                                | good, worn or damaged; a damaged item is not lent until repaired     |

## Relations

| ID                | Edge       | From | To     | Meaning                                       |
| ----------------- | ---------- | ---- | ------ | --------------------------------------------- |
| `edge.copy-of`    | `copy-of`  | item | title  | the item is a physical copy of the title      |
| `edge.waits-for`  | `waits-for`| hold | title  | the hold is a place in this title's queue     |

## Rules

| ID                         | Rule                 | Content                                                                                          |
| -------------------------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| `rule.loan-period`         | loan period          | 21 days from checkout                                                                            |
| `rule.renewal`             | renewal              | up to 2 renewals per loan, each moves `field.due-date` 14 days past the current due date         |
| `rule.pickup-window`       | pickup window        | a reserved item waits 3 days for the member at the head of the queue, then passes to the next   |

## Invariants

1. `inv.one-loan-per-item` An item is on at most one open loan.
2. `inv.queue-order` Holds are served in the order they were placed. Staff cannot reorder the queue; they can cancel a hold with a reason.
3. `inv.no-renew-when-held` A loan cannot be renewed while the title has a waiting hold. The member sees why.
4. `inv.within-limit` A member's open loans never exceed `field.borrow-limit`.
5. `inv.suspended-cannot-borrow` A member with an overdue loan cannot check out or place holds until it is returned (`concept.suspension`, D-03).

## Derived values

Derived values are computed, never stored and never typed in by anyone.

| ID                       | Value          | Computed from                                                                  |
| ------------------------ | -------------- | ------------------------------------------------------------------------------ |
| `derived.overdue`        | overdue        | the loan is open and today is after `field.due-date`                           |
| `derived.available`      | available      | the item is not on an open loan, not reserved for a hold and not damaged       |
| `derived.queue-position` | queue position | the hold's place among the title's waiting holds, by placement time            |

**Suspension** (`concept.suspension`). The state of a member who has at least one `derived.overdue` loan. It is not a stored flag and not a penalty with a duration: it starts when a loan becomes overdue and ends at the moment the last overdue item comes back. There are no money fines (D-03).

**Reservation** (`concept.reservation`). When an item comes back and its title has waiting holds, the item is set aside for the hold at the head of the queue for `rule.pickup-window`. A reserved item is not available to anyone else.

## When the system acts

Hooks are the things the system does on its own, without a person pressing a button.

| ID                   | When                                         | What the system does                                                          |
| -------------------- | -------------------------------------------- | ----------------------------------------------------------------------------- |
| `hook.due-reminder`  | two days before `field.due-date`             | notifies the member once, with the renew action if renewal is allowed         |
| `hook.hold-ready`    | an item of a held title is returned          | reserves the item (`concept.reservation`) and notifies the member at the head  |
| `hook.hold-expire`   | `rule.pickup-window` passes without checkout | releases the reservation and serves the next hold; the expired hold is closed  |

## Views

| ID                    | View         | What it shows                                                                                     |
| --------------------- | ------------ | ------------------------------------------------------------------------------------------------- |
| `view.catalog`        | Catalog      | titles with search; each row shows how many items are available or the queue length              |
| `view.title.page`     | Title page   | the title, its items with condition and availability, the queue with positions, the hold action   |
| `view.member.loans`   | My loans     | the member's open loans with due dates, overdue marks, renew buttons and holds with positions     |
| `view.desk`           | Desk         | staff screen: checkout and return by item, member lookup, the reason a checkout is refused        |

## Actions

| ID                    | Action      | Who    | Effect                                                                                |
| --------------------- | ----------- | ------ | ------------------------------------------------------------------------------------- |
| `action.checkout`     | Check out   | staff  | opens a loan; refused when any invariant would break, with the reason shown           |
| `action.return`       | Return      | staff  | closes the loan, records condition, triggers `hook.hold-ready`                        |
| `action.renew`        | Renew       | member | moves the due date per `rule.renewal`; refused per `inv.no-renew-when-held`           |
| `action.place-hold`   | Place hold  | member | adds the member to the title's queue; only when no item is available                  |
| `action.cancel-hold`  | Cancel hold | member or staff | leaves the queue; staff give a reason                                         |

### Deliberately out of scope

Money fines, reading history and recommendations, inter-library loans, staff reordering the queue, holds on a specific item.

## Glossary

The single source of short definitions. The mockup tooltips are generated from this table (`mockup/ontology.js`, by `tools/ont-check/gen-glossary.mjs`), and the map is checked against it. Rule: a new concept gets a row here first, then appears anywhere else.

| ID                            | Term                       | Definition                                                                                                  |
| ----------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `ent.member`                  | Member                     | A person registered with the library who can borrow.                                                        |
| `ent.title`                   | Title                      | A work in the catalog: a book, a board game, a tool model. Has one or more items.                           |
| `ent.item`                    | Item                       | One physical copy of a title; the thing that is actually lent.                                              |
| `ent.loan`                    | Loan                       | An item lent to a member, from checkout until return.                                                       |
| `ent.hold`                    | Hold                       | A member's place in the queue for a title whose items are all out.                                          |
| `field.due-date`              | Due date                   | When the item must be back: checkout plus the loan period, moved by renewals.                               |
| `field.renewals`              | Renewals                   | How many times the loan was renewed. A fact the system counts.                                              |
| `field.borrow-limit`          | Borrow limit               | Maximum number of open loans for a member. Set by staff; default 5.                                         |
| `field.item-condition`        | Condition                  | Good, worn or damaged, recorded at return. A damaged item is not lent until repaired.                       |
| `edge.copy-of`                | copy-of                    | The item is a physical copy of the title.                                                                   |
| `edge.waits-for`              | waits-for                  | The hold is a place in this title's queue.                                                                  |
| `rule.loan-period`            | Loan period                | 21 days from checkout.                                                                                      |
| `rule.renewal`                | Renewal rule               | Up to 2 renewals per loan, each adds 14 days to the current due date.                                       |
| `rule.pickup-window`          | Pickup window              | A reserved item waits 3 days for the member at the head of the queue.                                       |
| `inv.one-loan-per-item`       | One loan per item          | An item is on at most one open loan.                                                                        |
| `inv.queue-order`             | Queue order                | Holds are served in the order they were placed. Nobody reorders the queue.                                  |
| `inv.no-renew-when-held`      | No renewal when held       | A loan cannot be renewed while someone waits for the title.                                                 |
| `inv.within-limit`            | Within the limit           | Open loans never exceed the member's borrow limit.                                                          |
| `inv.suspended-cannot-borrow` | Suspended cannot borrow    | A member with an overdue loan cannot check out or place holds until it is back.                             |
| `derived.overdue`             | Overdue                    | The loan is open and the due date has passed.                                                               |
| `derived.available`           | Available                  | The item is not on loan, not reserved and not damaged.                                                      |
| `derived.queue-position`      | Queue position             | The hold's place in the title's queue, by placement time.                                                   |
| `concept.suspension`          | Suspension                 | A member with an overdue loan. Not stored and not timed: ends when the last overdue item comes back.        |
| `concept.reservation`         | Reservation                | A returned item set aside for the head of the queue for the pickup window.                                  |
| `hook.due-reminder`           | Due reminder               | Two days before the due date the member is notified once, with renew if allowed.                            |
| `hook.hold-ready`             | Hold ready                 | On return of a held title the item is reserved and the head of the queue is notified.                       |
| `hook.hold-expire`            | Hold expired               | After the pickup window the reservation passes to the next hold.                                            |
| `view.catalog`                | Catalog                    | Titles with search, availability and queue length.                                                          |
| `view.title.page`             | Title page                 | A title with its items, their condition and availability, and the queue.                                    |
| `view.member.loans`           | My loans                   | A member's open loans and holds: due dates, overdue marks, renew buttons, queue positions.                  |
| `view.desk`                   | Desk                       | Staff screen for checkout and return, with the reason when a checkout is refused.                           |
| `action.checkout`             | Check out                  | Open a loan for an item and a member. Refused with a reason if a rule would break.                          |
| `action.return`               | Return                     | Close the loan and record the item's condition.                                                             |
| `action.renew`                | Renew                      | Move the due date by the renewal rule. Refused while someone waits for the title.                           |
| `action.place-hold`           | Place hold                 | Join the title's queue. Only when no item is available.                                                     |
| `action.cancel-hold`          | Cancel hold                | Leave the queue; staff give a reason.                                                                       |

## Implementation status

The table answers "is this already in the code or is it the target". Everything absent from it is target. `tools/ont-check/ont-check.mjs` checks that the IDs exist in the glossary and the listed files exist; whether the concept is fully implemented there is a human judgment, recorded in the note.

| ID                        | Implemented in      | Note                                                   |
| ------------------------- | ------------------- | ------------------------------------------------------ |
| `ent.member`              | `app/library.mjs`   |                                                        |
| `ent.title`               | `app/library.mjs`   |                                                        |
| `ent.item`                | `app/library.mjs`   | no condition yet                                       |
| `ent.loan`                | `app/library.mjs`   |                                                        |
| `ent.hold`                | `app/library.mjs`   | placement only; nothing serves the queue yet           |
| `field.due-date`          | `app/library.mjs`   |                                                        |
| `field.renewals`          | `app/library.mjs`   |                                                        |
| `field.borrow-limit`      | `app/library.mjs`   | fixed at 5, staff cannot change it                     |
| `rule.loan-period`        | `app/library.mjs`   |                                                        |
| `rule.renewal`            | `app/library.mjs`   |                                                        |
| `inv.one-loan-per-item`   | `app/library.mjs`   |                                                        |
| `inv.no-renew-when-held`  | `app/library.mjs`   |                                                        |
| `inv.within-limit`        | `app/library.mjs`   |                                                        |
| `derived.overdue`         | `app/library.mjs`   |                                                        |
| `action.checkout`         | `app/cli.mjs`       |                                                        |
| `action.return`           | `app/cli.mjs`       | condition not recorded                                 |
| `action.renew`            | `app/cli.mjs`       |                                                        |
| `action.place-hold`       | `app/cli.mjs`       |                                                        |
| `view.member.loans`       | `app/cli.mjs`       | `loans` command, text output                           |

### Known divergences between code and ontology

A divergence is not an error in the ontology: the ontology describes the agreed target. Each line becomes a ticket, or a new decision if the target changed.

- The code still stores `fineCents` on a loan and adds to it when a loan is returned late. D-03 replaced fines with `concept.suspension`; the field and the arithmetic are not removed, and `inv.suspended-cannot-borrow` is not enforced.
- Nothing serves the queue: `hook.hold-ready`, `hook.hold-expire`, `concept.reservation` and `rule.pickup-window` are absent, so a returned item becomes available to anyone. Ticket: #3 Serve the hold queue: reservation on return and the pickup window.
- `field.item-condition` is absent; `action.return` records nothing about the item.
- `hook.due-reminder`, `view.catalog`, `view.title.page`, `view.desk` and `action.cancel-hold` are target only.

## Revision history

- 2026-10-17: first version: entities, fields, rules, invariants, derived values, hooks, views, actions; fines replaced by suspension (D-03).
