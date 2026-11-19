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

**Behavior blocks** (tentative: the approach's oracle prototype): under a table, a folded block states the behavior of its rows in the form language, each form starting with its row's ID, in the order of the rows. `ont-check.mjs --run` runs the traces of `checks.md` on them.

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

<details><summary>Behavior</summary>

```behavior
concept.suspension(member) = some l in loans where l.member = member and derived.overdue(l)
inv.within-limit
  refuse when count(l in loans where l.member = member and l.returned-on = null) >= member.borrow-limit
  says "{member} already has {count(l in loans where l.member = member and l.returned-on = null)} of {member.borrow-limit} loans"
inv.suspended-cannot-borrow
  refuse when concept.suspension(member)
  says "{member} has an overdue item: {(first l in loans where l.member = member and derived.overdue(l) by l.due-date).item}"
action.set-borrow-limit(member, limit: integer) by staff
  let open = count(l in loans where l.member = member and l.returned-on = null)
  refuse when open > limit
  says "{member} has {open} open loans, more than {limit}"
  set member.borrow-limit = limit
```

</details>

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
|           | `inv.damaged-not-lent`  | Damaged not lent  |                            | A damaged item is not lent until it is repaired.                                      |

<details><summary>Behavior</summary>

```behavior
derived.available(item) = item.condition != "damaged" and (no l in loans where l.item = item and l.returned-on = null) and not concept.reservation(item)
inv.one-loan-per-item
  refuse when some l in loans where l.item = item and l.returned-on = null
  says "{item} is already on loan"
inv.damaged-not-lent
  refuse when item.condition = "damaged"
  says "{item} is damaged and is not lent until repaired"
```

</details>

- `field.item.condition` is set by staff during `action.return`; members never edit it.
- An item is reserved through `concept.reservation`, described under Hold.

## Loan

| Kind      | ID                       | Term                 | Type             | Definition                                                                                                  |
| --------- | ------------------------ | -------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Entity    | `ent.loan`               | Loan                 |                  | An item lent to a member, from checkout until return.                                                       |
| Field     | `field.loan.due-date`    | Due date             | date             | When the item must be back: checkout plus the loan period, moved by renewals.                               |
|           | `field.loan.renewals`    | Renewals             | integer 0..2     | How many times the loan was renewed. A fact the system counts.                                              |
|           | `field.loan.returned-on` | Returned on          | date optional    | The day the item came back; empty while the loan is open.                                                   |
|           | `field.loan.reminded`    | Reminded             | boolean          | Whether the due reminder was sent for this loan, so that it is sent once.                                   |
| Relation  | `edge.loan.item`         | Lent item            | ref `ent.item`   | The item this loan lends.                                                                                   |
|           | `edge.loan.member`       | Borrower             | ref `ent.member` | The member who borrowed the item.                                                                           |
| Derived   | `derived.overdue`        | Overdue              |                  | The loan is open and the due date has passed.                                                               |
| Rule      | `rule.loan-period`       | Loan period          |                  | 21 days from checkout.                                                                                      |
|           | `rule.renewal`           | Renewal rule         |                  | Up to 2 renewals per loan, each adds 14 days to the current due date.                                       |
| Invariant | `inv.no-renew-when-held` | No renewal when held |                  | A loan cannot be renewed while someone waits for the title.                                                 |
|           | `inv.borrower-renews`    | Borrower renews      |                  | Only the member who borrowed the item renews its loan.                                                      |
| Hook      | `hook.due-reminder`      | Due reminder         |                  | Two days before the due date the member is notified once, with renew if allowed.                            |
| Action    | `action.checkout`        | Check out            |                  | Open a loan for an item and a member. Refused with a reason if a rule would break.                          |
|           | `action.return`          | Return               |                  | Close the loan and record the item's condition.                                                             |
|           | `action.renew`           | Renew                |                  | Move the due date by the renewal rule. Only the borrower renews; refused while someone waits for the title. |

<details><summary>Behavior</summary>

```behavior
derived.overdue(loan) = loan.returned-on = null and today > loan.due-date
rule.loan-period = 21 days
rule.renewal
  limit = 2
  adds = 14 days
  refuse when loan.renewals >= limit
  says "both renewals of {loan.item} are used"
inv.no-renew-when-held
  refuse when some h in holds where h.state = "waiting" and h.waits-for = loan.item.copy-of
  says "someone is waiting for {loan.item.copy-of}"
inv.borrower-renews
  refuse when loan.member != actor
  says "{loan.item} is lent to {loan.member}"
hook.due-reminder on day
  each l in loans where l.returned-on = null and not l.reminded and today = l.due-date - 2 days:
    notify l.member "{l.item} is due on {l.due-date}" offering action.renew(item = l.item)
    set l.reminded = true
action.checkout(item, member) by staff
  refuse by inv.within-limit
  refuse by inv.suspended-cannot-borrow
  refuse by inv.one-loan-per-item
  refuse by inv.damaged-not-lent
  refuse when some h in holds where h.state = "waiting" and h.reserved-item = item and h.member != member
  says "{item} is reserved for someone else"
  create loan: item = item, member = member, due-date = today + rule.loan-period, renewals = 0, reminded = false
  each h in holds where h.state = "waiting" and h.reserved-item = item and h.member = member:
    set h.state = "served"
action.return(item, condition: optional text) by staff
  let loan = first l in loans where l.item = item and l.returned-on = null by l.due-date
  empty when loan = null
  says "{item} is not on loan"
  set loan.returned-on = today
  if condition != null:
    set item.condition = condition
action.renew(item) by member
  let loan = first l in loans where l.item = item and l.returned-on = null by l.due-date
  empty when loan = null
  says "{item} is not on loan"
  refuse by rule.renewal
  refuse by inv.no-renew-when-held
  refuse by inv.borrower-renews
  set loan.due-date = loan.due-date + rule.renewal.adds
  set loan.renewals = loan.renewals + 1
```

</details>

- `field.loan.due-date` and `field.loan.renewals` are set by the system at `action.checkout` and `action.renew`; nobody types them in.
- `field.loan.returned-on` is set by `action.return`; a loan is open while it is empty. `field.loan.reminded` is set by `hook.due-reminder`.
- `rule.loan-period` is the same for every title (D-01).
- `action.checkout` and `action.return` are done by staff, `action.renew` by the member who borrowed the item (`inv.borrower-renews`, D-11). Checkout is refused when it would break `inv.within-limit`, `inv.suspended-cannot-borrow`, `inv.one-loan-per-item` or `inv.damaged-not-lent` (D-13), or when the item is reserved for someone else (`concept.reservation`).
- When several refusals apply, the one named is the first in the order its row stands in this ontology: for checkout the order above, for renewal `rule.renewal`, `inv.no-renew-when-held`, `inv.borrower-renews` (D-12).
- `action.return` triggers `hook.hold-ready` when someone waits for the title.
- A refused `action.renew` stays visible with the reason (D-04).

## Hold

| Kind      | ID                        | Term           | Type                                       | Definition                                                                                             |
| --------- | ------------------------- | -------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Entity    | `ent.hold`                | Hold           |                                            | A member's place in the queue for a title whose items are all out.                                     |
| Field     | `field.hold.placed-at`    | Placed at      | datetime                                   | When the member joined the queue; it orders the queue.                                                 |
|           | `field.hold.state`        | State          | one of waiting, served, cancelled, expired | Waiting in the queue, served by a checkout, cancelled, or expired after the pickup window.             |
|           | `field.hold.reserved-on`  | Reserved on    | date optional                              | The day a returned item was set aside for this hold.                                                   |
| Relation  | `edge.hold.waits-for`     | waits-for      | ref `ent.title`                            | The hold is a place in this title's queue.                                                             |
|           | `edge.hold.member`        | Holder         | ref `ent.member`                           | The member waiting in the queue.                                                                       |
|           | `edge.hold.reserved-item` | Reserved item  | ref `ent.item` optional                    | The returned item set aside for this hold, for the pickup window.                                      |
| Derived   | `derived.queue-position`  | Queue position |                                            | The hold's place in the title's queue, by placement time.                                              |
| Concept   | `concept.reservation`     | Reservation    |                                            | A returned item set aside for the head of the queue for the pickup window.                             |
| Rule      | `rule.pickup-window`      | Pickup window  |                                            | A reserved item waits 3 days for the member at the head of the queue.                                  |
| Invariant | `inv.queue-order`         | Queue order    |                                            | Holds are served in the order they were placed. Nobody reorders the queue.                             |
| Hook      | `hook.hold-ready`         | Hold ready     |                                            | On return of a held title the item is reserved and the head of the queue is notified.                  |
|           | `hook.hold-expire`        | Hold expired   |                                            | After the pickup window the reservation passes to the next hold, and its member is notified.           |
| Action    | `action.place-hold`       | Place hold     |                                            | Join the title's queue. Only when no item is available.                                                |
|           | `action.cancel-hold`      | Cancel hold    |                                            | Leave the queue. Staff cancelling for a member give a reason. A reserved item passes to the next hold. |

<details><summary>Behavior</summary>

```behavior
derived.queue-position(hold) = 1 + count(h in holds where h.state = "waiting" and h.waits-for = hold.waits-for and h.placed-at < hold.placed-at)
concept.reservation(item) = some h in holds where h.state = "waiting" and h.reserved-item = item
rule.pickup-window = 3 days
inv.queue-order
  always every h in holds where h.reserved-item = null or h.state != "waiting" or (no e in holds where e.state = "waiting" and e.waits-for = h.waits-for and e.reserved-item = null and e.placed-at < h.placed-at)
hook.hold-ready on action.return
  let head = first h in holds where h.state = "waiting" and h.waits-for = item.copy-of and h.reserved-item = null by h.placed-at
  if head != null:
    set head.reserved-item = item
    set head.reserved-on = today
    notify head.member "{item} is waiting for you until {today + rule.pickup-window}"
hook.hold-expire on day
  each h in holds where h.state = "waiting" and h.reserved-item != null and today > h.reserved-on + rule.pickup-window:
    set h.state = "expired"
    let next = first n in holds where n.state = "waiting" and n.waits-for = h.waits-for and n.reserved-item = null by n.placed-at
    if next != null:
      set next.reserved-item = h.reserved-item
      set next.reserved-on = today
      notify next.member "{h.reserved-item} is waiting for you until {today + rule.pickup-window}"
action.place-hold(title, member) by member
  refuse by inv.suspended-cannot-borrow
  refuse when some i in items where i.copy-of = title and derived.available(i)
  says "a copy of {title} is available"
  create hold: waits-for = title, member = member, placed-at = now, state = "waiting"
action.cancel-hold(title, member, reason: optional text) by member or staff
  let hold = first h in holds where h.state = "waiting" and h.waits-for = title and h.member = member by h.placed-at
  empty when hold = null
  says "{member} has no hold on {title}"
  refuse when actor = "staff" and (reason = null or reason = "")
  says "give the reason for cancelling the hold of {member}"
  set hold.state = "cancelled"
  if hold.reserved-item != null:
    let next = first n in holds where n.state = "waiting" and n.waits-for = title and n.reserved-item = null by n.placed-at
    if next != null:
      set next.reserved-item = hold.reserved-item
      set next.reserved-on = today
      notify next.member "{hold.reserved-item} is waiting for you until {today + rule.pickup-window}"
```

</details>

- A reserved item is not `derived.available` to anyone but the member it waits for.
- `rule.pickup-window` is tentative (D-05).
- `field.hold.placed-at` orders the queue. `edge.hold.reserved-item` and `field.hold.reserved-on` record `concept.reservation`; `field.hold.state` says how the hold ended.
- `hook.hold-expire` closes the expired hold before serving the next one, whose member is notified as by `hook.hold-ready` (D-09). `action.cancel-hold` passes a reserved item on in the same way (D-10).
- `inv.queue-order` refuses no action: it is a property of the state, which holds after every step.

## Screens

| Kind | ID                  | Term       | Type                                       | Definition                                                                                 |
| ---- | ------------------- | ---------- | ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| View | `view.catalog`      | Catalog    | shows `ent.title`, `ent.item`, `ent.hold`  | Titles with search, availability and queue length.                                         |
|      | `view.title.page`   | Title page | shows `ent.title`, `ent.item`, `ent.hold`  | A title with its items, their condition and availability, and the queue.                   |
|      | `view.member.loans` | My loans   | shows `ent.member`, `ent.loan`, `ent.hold` | A member's open loans and holds: due dates, overdue marks, renew buttons, queue positions. |
|      | `view.desk`         | Desk       | shows `ent.member`, `ent.item`, `ent.loan` | Staff screen for checkout and return, with the reason when a checkout is refused.          |

Each note says what the screen shows in each state and what can be done there. Layout and style are the mockup's.

- `view.catalog` lists each `ent.title`, with a search. While an item of the title is `derived.available`, the row says how many are; while none is, it gives the queue length instead, and never which copy will come back first (D-02). From here a member opens a title.
- `view.title.page` lists the title's items, each with its `field.item.condition` and whether it is `derived.available`. Members never edit the condition. The queue is listed by `derived.queue-position` and cannot be reordered (`inv.queue-order`). It also says how long a returned item is kept for the head of the queue (`concept.reservation`, `rule.pickup-window`). While no item is available, a member not in the queue can `action.place-hold` and a member in it can `action.cancel-hold`; while an item is available, the page does not offer `action.place-hold`, and a hold placed any other way is refused with the reason. While the member is suspended, `action.place-hold` is refused, with the overdue item named (`inv.suspended-cannot-borrow`).
- `view.member.loans` shows the member's own open loans and holds, never another member's. Each loan shows its `field.loan.due-date`, its `field.loan.renewals` out of two and, once it is `derived.overdue`, the overdue mark. Each loan offers `action.renew`; while someone waits for the title, the button stays visible and disabled, with the number of people waiting (`inv.no-renew-when-held`, D-04), and once the loan has used both renewals of `rule.renewal`, it stays visible and disabled with that reason (D-08). Each hold shows its `derived.queue-position`. While the member is suspended, a note says borrowing is paused until the overdue item is back, with the rule behind it, and never shows an amount of money (`concept.suspension`, D-03). The screen also says that `hook.due-reminder` comes two days before a due date. With no open loan and no hold, it says the member has nothing on loan and nothing on hold, and leads to `view.catalog`.
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
- **Loan.** Renewal does not know who renews, so any member can renew another member's loan (`inv.borrower-renews`). Ticket: #5 Only the borrower renews a loan.
- **Hold.** Nothing serves the queue, so a returned item becomes available to anyone, ahead of the members waiting for it (`concept.reservation`, `inv.queue-order`). Ticket: #3 Serve the hold queue: reservation on return and the pickup window.

## Other words

Words people may use for a concept that are not its term. The tickets, the help pages and the mockup use the term instead; the check names any of them that use one of these words.

| Word | Concept |
| ---- | ------- |
| queue entry | `ent.hold` |

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

- 2026-11-19: what the oracle's forms showed the ontology did not say, tentative: the next hold's member is notified when a reservation passes on (D-09), a cancelled hold passes its reservation on (D-10), only the borrower renews, `inv.borrower-renews` (D-11), the first refusal in the order of the rows is named (D-12), a damaged item is refused by `inv.damaged-not-lent` (D-13).
- 2026-11-18: the screens name the entities they show: `view.catalog`, `view.title.page`, `view.member.loans`, `view.desk`, so that the ontology is one graph.
- 2026-11-05: `view.member.loans` with both renewals used: the same, now with its source (D-08, superseding D-07).
- 2026-11-05: `view.member.loans` with both renewals used keeps the renew button visible and disabled, with the reason (D-07).
- 2026-11-05: `view.member.loans` with no loans and no holds says so and leads to the catalog.
- 2026-11-04: each screen's note says what it shows in each state and what can be done there; what the map said elements do not do is written here, and the map no longer has that column.
- 2026-10-23: `action.set-borrow-limit`, the staff action the borrow limit's definition already implied, so that `--gap` shows it as work; notes on partial rows name the target concept that adds what is missing.
- 2026-10-22: known divergences keep only behavior that contradicts the target; what is not built yet comes from `--gap`. `derived.queue-position` added to the implementation table, which `--gap` showed missing.
- 2026-10-21: types for fields and relations, contracts generated from them; relations `edge.loan.item`, `edge.loan.member` and `edge.hold.member`, which the code already had.
- 2026-10-21: one section per entity with one definition row per concept, grouped by kind; the separate glossary table and the per-kind tables merged into them. Fields and relations name their entity (D-06); the old IDs retired.
- 2026-10-17: first version: entities, fields, rules, invariants, derived values, hooks, views, actions; fines replaced by suspension (D-03).
