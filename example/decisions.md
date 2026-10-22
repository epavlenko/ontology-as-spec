# Lending Library — decisions

Created: 2026-10-17
Status: maintained
Context: [ontology.md](./ontology.md)

Log of product decisions about the ontology and the interface. Each entry has a date, a status, the decision, the reason, the rejected alternatives and the affected concepts by ID.

Log rules:

- An entry is never edited after it is accepted. A later entry either adds to it, leaving it in force, or supersedes it whole and names it on a `- Supersedes: D-nn` line.
- One entry answers one question; the parts of one answer stay together.
- "Tentative" means a chosen course that may still change without a separate entry. Removing the flag is an entry.
- `tools/ont-check/ont-check.mjs` checks the IDs mentioned here against the glossary and the retired IDs, and every `D-nn` reference in the ontology and the map against this log.

## Accepted

### D-01 · A loan is 21 days with a fixed rule, not a per-title setting

- Date: 2026-10-17 · Status: accepted
- Decision: every loan lasts `rule.loan-period` from checkout. Titles do not carry their own loan period.
- Why: members remember one number. Per-title periods made the desk explain the rule on every checkout in the pilot.
- Rejected: 7 days for new titles and 28 for the rest (a second rule nobody remembers); a period chosen at the desk (unequal treatment).
- Concepts: `rule.loan-period`, `field.due-date`, `action.checkout`.

### D-02 · Members wait for titles, not for items

- Date: 2026-10-17 · Status: accepted
- Decision: a hold is placed on a title (`edge.waits-for`). Whichever item of the title comes back first serves the head of the queue.
- Why: members want the book, not copy number 3. A hold on a specific item waits longer for nothing.
- Rejected: holds on items (longer waits, more holds to manage); both (two queues for one title).
- Concepts: `ent.hold`, `edge.waits-for`, `ent.item`, `hook.hold-ready`.

### D-03 · No money fines; an overdue loan suspends borrowing

- Date: 2026-10-17 · Status: accepted
- Decision: there are no fines. A member with an overdue loan is suspended (`concept.suspension`): no checkouts and no holds until the overdue item comes back. The suspension ends at that moment.
- Why: fines kept members with a late book away from the library altogether, so the book stayed out longer. Suspension asks for exactly one thing, the item.
- Rejected: fines with a cap (still keeps people away); a suspension for a fixed number of days after return (punishes the return itself).
- Concepts: `concept.suspension`, `derived.overdue`, `inv.suspended-cannot-borrow`.

### D-04 · Renewal is refused while someone waits, and the member sees why

- Date: 2026-10-17 · Status: accepted
- Decision: `action.renew` is refused when the title has a waiting hold (`inv.no-renew-when-held`). The renew button stays visible, disabled, with the reason.
- Why: a hidden button reads as a bug; a visible reason explains the queue and tells the member someone is waiting.
- Rejected: hide the button (looks broken); allow renewal and shorten it (a rule nobody can predict).
- Concepts: `action.renew`, `inv.no-renew-when-held`, `view.member.loans`.

### D-06 · Fields and relations name their entity in the ID

- Date: 2026-10-21 · Status: accepted
- Decision: the ID of a field or a relation includes its entity: `field.loan.due-date`, `edge.item.copy-of`. The six earlier IDs are retired and listed under "Retired IDs" in the ontology, so the entries above that use them still resolve. Other classes keep names without an entity.
- Why: the ontology is organised by entity, and two entities will soon have fields with the same name, such as the status of a loan and of an item. A global status field ID would be ambiguous, and renaming later touches more artifacts.
- Rejected: the entity in every ID (rules, invariants and actions often involve several entities, and their owner would be arbitrary); keeping global field names and renaming on the first collision (the rename then happens in a larger ontology).
- Concepts: `field.loan.due-date`, `field.loan.renewals`, `field.member.borrow-limit`, `field.item.condition`, `edge.item.copy-of`, `edge.hold.waits-for`.

## Tentative

### D-05 · A reserved item waits three days

- Date: 2026-10-17 · Status: tentative
- Course: `rule.pickup-window` is 3 days.
- Why tentative: not tested with members who visit only on weekends; a week may be needed.
- Concepts: `rule.pickup-window`, `concept.reservation`, `hook.hold-expire`.

## Open questions

- Should staff be able to extend a borrow limit for a single loan, or only change `field.member.borrow-limit`?

## History

- 2026-10-21: D-06: fields and relations name their entity.
- 2026-10-17: log created with D-01…D-05.
