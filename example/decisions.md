# Lending Library — decisions

Created: 2026-10-17
Status: maintained
Context: [ontology.md](./ontology.md)

Log of product decisions about the ontology and the interface. Each entry has a date, a status, the decision, the reason, the rejected alternatives and the affected concepts by ID.

Log rules:

- An entry is never edited after it is accepted. A new entry refers to the old one and supersedes or refines it.
- "Tentative" means a chosen course that may still change without a separate entry. Removing the flag is an entry.
- `tools/ont-check/ont-check.mjs` checks the IDs mentioned here against the glossary and every `D-nn` reference in the ontology and the map against this log.

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

## Tentative

### D-05 · A reserved item waits three days

- Date: 2026-10-17 · Status: tentative
- Course: `rule.pickup-window` is 3 days.
- Why tentative: not tested with members who visit only on weekends; a week may be needed.
- Concepts: `rule.pickup-window`, `concept.reservation`, `hook.hold-expire`.

## Open questions

- Should staff be able to extend a borrow limit for a single loan, or only change `field.borrow-limit`?

## History

- 2026-10-17: log created with D-01…D-05.
