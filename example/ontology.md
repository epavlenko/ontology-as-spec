# Lending Library — ontology

Created: 2026-10-17
Status: working draft, fictional example for this repository
Source of truth: this file. Decisions and their reasons live in [decisions.md](./decisions.md).

The ontology describes the entities, fields, relations, rules and screens of a small lending library app: members borrow items, wait in a queue for titles that are out, and return items on time or late. It describes the **target model**. What the code already does is listed in "Implementation status" at the end; everything not listed there is target.

## How to read this

**One section per entity**, in the order a loan happens: Member, Title, Item, Loan, Hold. Screens come after them, because each screen shows several entities.

**One row per concept.** Each section is one table, and every concept of the product is a row in exactly one of them: kind, permanent ID, term, type, definition. Only fields and relations have a type; the contracts in `contracts/ontology.schema.json` are generated from these types (`tools/ont-check/gen-contracts.mjs`). Together the rows are the glossary. The mockup tooltips are generated from them (`mockup/ontology.js`, by `tools/ont-check/gen-glossary.mjs`). The notes under a table add detail and refer to concepts by ID. They never restate a definition.

**Rows are grouped by kind**, always in this order: Entity, Field, Relation, Derived, Concept, Rule, Invariant, Hook, Action, View. The kind is written on the first row of its group. A concept that involves several entities sits with the entity it constrains or changes. Derived values are computed, never stored and never typed in. Hooks are what the system does on its own, without a person pressing a button.

**Identifiers.** Every concept has a permanent ID of the form `class.name`. Fields and relations also name their entity: `field.loan.due-date`, `edge.item.copy-of`. The ID never changes when the term is renamed; only the row's text changes. The mockup, the map, the decision log, the check catalogue, the tickets, the tests, the help pages and the implementation table refer to concepts by ID. When an ID has to change, the old one moves to "Retired IDs", so that the decision log, which is never edited, still resolves.

**Types** are written in a vocabulary that belongs to no programming language: `text`, `integer` with an optional range such as `integer 0..2`, `number`, `boolean`, `date`, `datetime`, `one of` a list of values, `ref` or `refs` an entity, and `optional` after any of them. Derived values have no type in the contract, because they are never stored.

`tools/ont-check/ont-check.mjs` checks the kind order, the Kind cells, that every field and relation sits in its entity's table and has a valid type, and that the generated contracts are current.

## Member

| Kind      | ID                            | Term                    | Type        | Definition                                                                                           |
| --------- | ----------------------------- | ----------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| Entity    | `ent.member`                  | Member                  |             | A person registered with the library who can borrow.                                                 |
| Field     | `field.member.borrow-limit`   | Borrow limit            | integer 1.. | Maximum number of open loans for a member. Set by staff; default 5.                                  |
| Concept   | `concept.suspension`          | Suspension              |             | A member with an overdue loan. Not stored and not timed: ends when the last overdue item comes back. |
| Invariant | `inv.within-limit`            | Within the limit        |             | Open loans never exceed the member's borrow limit.                                                   |
|           | `inv.suspended-cannot-borrow` | Suspended cannot borrow |             | A member with an overdue loan cannot check out or place holds until it is back.                      |
| Action    | `action.set-borrow-limit`     | Set borrow limit        |             | Change a member's borrow limit. Refused while the member has more open loans than the new limit.     |

- `concept.suspension` starts the moment one of the member's loans becomes `derived.overdue`. It replaces money fines, which do not exist (D-03).
- `inv.suspended-cannot-borrow` blocks `action.checkout` and `action.place-hold`. Nobody can override it at the desk.
- `action.set-borrow-limit` is done by staff at the desk; members never change their own limit.

## Title

| Kind   | ID          | Term  | Type | Definition                                                                        |
| ------ | ----------- | ----- | ---- | --------------------------------------------------------------------------------- |
| Entity | `ent.title` | Title |      | A work in the catalog: a book, a board game, a tool model. Has one or more items. |

- A member borrows items, not titles, but waits for titles, not items: whichever copy comes back first serves the queue (D-02). Items belong to a title through `edge.item.copy-of`; holds through `edge.hold.waits-for`.

## Item

| Kind      | ID                      | Term              | Type                       | Definition                                                                            |
| --------- | ----------------------- | ----------------- | -------------------------- | ------------------------------------------------------------------------------------- |
| Entity    | `ent.item`              | Item              |                            | One physical copy of a title; the thing that is actually lent.                        |
| Field     | `field.item.condition`  | Condition         | one of good, worn, damaged | Good, worn or damaged, recorded at return. A damaged item is not lent until repaired. |
| Relation  | `edge.item.copy-of`     | copy-of           | ref `ent.title`            | The item is a physical copy of the title.                                             |
| Derived   | `derived.available`     | Available         |                            | The item is not on loan, not reserved and not damaged.                                |
| Invariant | `inv.one-loan-per-item` | One loan per item |                            | An item is on at most one open loan.                                                  |

- `field.item.condition` is set by staff during `action.return`; members never edit it.
- An item is reserved through `concept.reservation`, described under Hold.

## Loan

| Kind      | ID                       | Term                 | Type             | Definition                                                                         |
| --------- | ------------------------ | -------------------- | ---------------- | ---------------------------------------------------------------------------------- |
| Entity    | `ent.loan`               | Loan                 |                  | An item lent to a member, from checkout until return.                              |
| Field     | `field.loan.due-date`    | Due date             | date             | When the item must be back: checkout plus the loan period, moved by renewals.      |
|           | `field.loan.renewals`    | Renewals             | integer 0..2     | How many times the loan was renewed. A fact the system counts.                     |
| Relation  | `edge.loan.item`         | Lent item            | ref `ent.item`   | The item this loan lends.                                                          |
|           | `edge.loan.member`       | Borrower             | ref `ent.member` | The member who borrowed the item.                                                  |
| Derived   | `derived.overdue`        | Overdue              |                  | The loan is open and the due date has passed.                                      |
| Rule      | `rule.loan-period`       | Loan period          |                  | 21 days from checkout.                                                             |
|           | `rule.renewal`           | Renewal rule         |                  | Up to 2 renewals per loan, each adds 14 days to the current due date.              |
| Invariant | `inv.no-renew-when-held` | No renewal when held |                  | A loan cannot be renewed while someone waits for the title.                        |
| Hook      | `hook.due-reminder`      | Due reminder         |                  | Two days before the due date the member is notified once, with renew if allowed.   |
| Action    | `action.checkout`        | Check out            |                  | Open a loan for an item and a member. Refused with a reason if a rule would break. |
|           | `action.return`          | Return               |                  | Close the loan and record the item's condition.                                    |
|           | `action.renew`           | Renew                |                  | Move the due date by the renewal rule. Refused while someone waits for the title.  |

- `field.loan.due-date` and `field.loan.renewals` are set by the system at `action.checkout` and `action.renew`; nobody types them in.
- `rule.loan-period` is the same for every title (D-01).
- `action.checkout` and `action.return` are done by staff, `action.renew` by the member. Checkout is refused when it would break `inv.one-loan-per-item`, `inv.within-limit` or `inv.suspended-cannot-borrow`.
- `action.return` triggers `hook.hold-ready` when someone waits for the title.
- A refused `action.renew` stays visible with the reason (D-04).

## Hold

| Kind      | ID                       | Term           | Type             | Definition                                                                            |
| --------- | ------------------------ | -------------- | ---------------- | ------------------------------------------------------------------------------------- |
| Entity    | `ent.hold`               | Hold           |                  | A member's place in the queue for a title whose items are all out.                    |
| Relation  | `edge.hold.waits-for`    | waits-for      | ref `ent.title`  | The hold is a place in this title's queue.                                            |
|           | `edge.hold.member`       | Holder         | ref `ent.member` | The member waiting in the queue.                                                      |
| Derived   | `derived.queue-position` | Queue position |                  | The hold's place in the title's queue, by placement time.                             |
| Concept   | `concept.reservation`    | Reservation    |                  | A returned item set aside for the head of the queue for the pickup window.            |
| Rule      | `rule.pickup-window`     | Pickup window  |                  | A reserved item waits 3 days for the member at the head of the queue.                 |
| Invariant | `inv.queue-order`        | Queue order    |                  | Holds are served in the order they were placed. Nobody reorders the queue.            |
| Hook      | `hook.hold-ready`        | Hold ready     |                  | On return of a held title the item is reserved and the head of the queue is notified. |
|           | `hook.hold-expire`       | Hold expired   |                  | After the pickup window the reservation passes to the next hold.                      |
| Action    | `action.place-hold`      | Place hold     |                  | Join the title's queue. Only when no item is available.                               |
|           | `action.cancel-hold`     | Cancel hold    |                  | Leave the queue. Staff cancelling for a member give a reason.                         |

- A reserved item is not `derived.available` to anyone but the member it waits for.
- `rule.pickup-window` is tentative (D-05).
- `hook.hold-expire` closes the expired hold before serving the next one.

## Screens

| Kind | ID                  | Term       | Definition                                                                                 |
| ---- | ------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| View | `view.catalog`      | Catalog    | Titles with search, availability and queue length.                                         |
|      | `view.title.page`   | Title page | A title with its items, their condition and availability, and the queue.                   |
|      | `view.member.loans` | My loans   | A member's open loans and holds: due dates, overdue marks, renew buttons, queue positions. |
|      | `view.desk`         | Desk       | Staff screen for checkout and return, with the reason when a checkout is refused.          |

Each note says what the screen shows in each state and what can be done there. Layout and style are the mockup's.

- `view.catalog` lists each `ent.title`, with a search. While an item of the title is `derived.available`, the row says how many are; while none is, it gives the queue length instead, and never which copy will come back first (D-02). From here a member opens a title.
- `view.title.page` lists the title's items, each with its `field.item.condition` and whether it is `derived.available`. Members never edit the condition. The queue is listed by `derived.queue-position` and cannot be reordered (`inv.queue-order`). It also says how long a returned item is kept for the head of the queue (`concept.reservation`, `rule.pickup-window`). While no item is available, a member not in the queue can `action.place-hold` and a member in it can `action.cancel-hold`; while an item is available, the page does not offer `action.place-hold`, and a hold placed any other way is refused with the reason. While the member is suspended, `action.place-hold` is refused, with the overdue item named (`inv.suspended-cannot-borrow`).
- `view.member.loans` shows the member's own open loans and holds, never another member's. Each loan shows its `field.loan.due-date`, its `field.loan.renewals` out of two and, once it is `derived.overdue`, the overdue mark. Each loan offers `action.renew`; while someone waits for the title, the button stays visible and disabled, with the number of people waiting (`inv.no-renew-when-held`, D-04). Each hold shows its `derived.queue-position`. While the member is suspended, a note says borrowing is paused until the overdue item is back, with the rule behind it, and never shows an amount of money (`concept.suspension`, D-03). The screen also says that `hook.due-reminder` comes two days before a due date.
- `view.desk` is for staff, who enter an item and a member. `action.checkout` opens the loan, or is refused with a message that alone tells the librarian which rule stops it and what would make checkout possible (`inv.one-loan-per-item`, `inv.within-limit`, `inv.suspended-cannot-borrow`); nothing at the desk overrides a refusal. `action.return` closes the loan and records the item's condition. The screen shows the member's open loans against `field.member.borrow-limit`, and staff change the limit with `action.set-borrow-limit`.

## Deliberately out of scope

Money fines, reading history and recommendations, inter-library loans, staff reordering the queue, holds on a specific item.

## Implementation status

The table answers "is this already in the code or is it the target". Everything absent from it is target. It follows the entity sections above. `tools/ont-check/ont-check.mjs` checks that the IDs exist in the glossary and the listed files exist; whether the concept is fully implemented there is a human judgment, recorded in the note.

### Member

| ID                          | Implemented in    | Note                                       |
| --------------------------- | ----------------- | ------------------------------------------ |
| `ent.member`                | `app/library.mjs` |                                            |
| `field.member.borrow-limit` | `app/library.mjs` | fixed at 5 until `action.set-borrow-limit` |
| `inv.within-limit`          | `app/library.mjs` |                                            |

### Title

| ID          | Implemented in    | Note |
| ----------- | ----------------- | ---- |
| `ent.title` | `app/library.mjs` |      |

### Item

| ID                      | Implemented in    | Note                                      |
| ----------------------- | ----------------- | ----------------------------------------- |
| `ent.item`              | `app/library.mjs` | no condition until `field.item.condition` |
| `edge.item.copy-of`     | `app/library.mjs` |                                           |
| `inv.one-loan-per-item` | `app/library.mjs` |                                           |

### Loan

| ID                       | Implemented in    | Note                                              |
| ------------------------ | ----------------- | ------------------------------------------------- |
| `ent.loan`               | `app/library.mjs` |                                                   |
| `edge.loan.item`         | `app/library.mjs` |                                                   |
| `edge.loan.member`       | `app/library.mjs` |                                                   |
| `field.loan.due-date`    | `app/library.mjs` |                                                   |
| `field.loan.renewals`    | `app/library.mjs` |                                                   |
| `derived.overdue`        | `app/library.mjs` |                                                   |
| `rule.loan-period`       | `app/library.mjs` |                                                   |
| `rule.renewal`           | `app/library.mjs` |                                                   |
| `inv.no-renew-when-held` | `app/library.mjs` |                                                   |
| `action.checkout`        | `app/cli.mjs`     |                                                   |
| `action.return`          | `app/cli.mjs`     | records no condition until `field.item.condition` |
| `action.renew`           | `app/cli.mjs`     |                                                   |

### Hold

| ID                       | Implemented in    | Note                                                             |
| ------------------------ | ----------------- | ---------------------------------------------------------------- |
| `ent.hold`               | `app/library.mjs` | placement only; nothing serves the queue until `hook.hold-ready` |
| `edge.hold.waits-for`    | `app/library.mjs` |                                                                  |
| `edge.hold.member`       | `app/library.mjs` |                                                                  |
| `derived.queue-position` | `app/library.mjs` |                                                                  |
| `action.place-hold`      | `app/cli.mjs`     |                                                                  |

### Screens

| ID                  | Implemented in | Note                         |
| ------------------- | -------------- | ---------------------------- |
| `view.member.loans` | `app/cli.mjs`  | `loans` command, text output |

### Known divergences between code and ontology

Places where the code does something the ontology does not want. Concepts that are simply not built yet are not listed here: `ont-check.mjs --gap` computes them from this table. Each line becomes a ticket, or a new decision if the target changed.

- **Member.** The code still stores `fineCents` on a loan and adds to it when a loan is returned late, although D-03 replaced fines with `concept.suspension`; `inv.suspended-cannot-borrow` is not enforced, so a member with an overdue loan can still borrow. Ticket: #4 Suspend borrowing instead of fines.
- **Hold.** Nothing serves the queue, so a returned item becomes available to anyone, ahead of the members waiting for it (`concept.reservation`, `inv.queue-order`). Ticket: #3 Serve the hold queue: reservation on return and the pickup window.

## Retired IDs

IDs that had to change. The decision log keeps using them, because its entries are never edited; everywhere else the check requires the new ID.

| Retired ID             | Replaced by                 | Decision |
| ---------------------- | --------------------------- | -------- |
| `field.due-date`       | `field.loan.due-date`       | D-06     |
| `field.renewals`       | `field.loan.renewals`       | D-06     |
| `field.borrow-limit`   | `field.member.borrow-limit` | D-06     |
| `field.item-condition` | `field.item.condition`      | D-06     |
| `edge.copy-of`         | `edge.item.copy-of`         | D-06     |
| `edge.waits-for`       | `edge.hold.waits-for`       | D-06     |

## Revision history

- 2026-11-04: each screen's note says what it shows in each state and what can be done there; what the map said elements do not do is written here, and the map no longer has that column.
- 2026-10-23: `action.set-borrow-limit`, the staff action the borrow limit's definition already implied, so that `--gap` shows it as work; notes on partial rows name the target concept that adds what is missing.
- 2026-10-22: known divergences keep only behavior that contradicts the target; what is not built yet comes from `--gap`. `derived.queue-position` added to the implementation table, which `--gap` showed missing.
- 2026-10-21: types for fields and relations, contracts generated from them; relations `edge.loan.item`, `edge.loan.member` and `edge.hold.member`, which the code already had.
- 2026-10-21: one section per entity with one definition row per concept, grouped by kind; the separate glossary table and the per-kind tables merged into them. Fields and relations name their entity (D-06); the old IDs retired.
- 2026-10-17: first version: entities, fields, rules, invariants, derived values, hooks, views, actions; fines replaced by suspension (D-03).
