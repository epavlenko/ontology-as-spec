# UI-to-ontology map · Lending Library mockup

Every meaningful element of the mockup carries a `data-ont` attribute with a concept ID from the [ontology](../ontology.md) glossary. The tooltip comes from the glossary (`ontology.js`, generated) unless the element has its own. `tools/ont-check/ont-check.mjs` checks that this map and the mockup contain the same set of IDs.

Map rules:

- A row answers three questions: what the element shows, which concept stands behind it, what it deliberately does not do.
- A new concept gets a glossary row first, then a row here, then `data-ont` in the mockup. The check fails on any gap.
- IDs built from a template (`derived.available`, `derived.overdue`) are declared in a comment in `index.html` so the check sees them.

## Navigation

| Element          | ID                  | What it shows                 | What it does not do                |
| ---------------- | ------------------- | ----------------------------- | ---------------------------------- |
| Tab "Catalog"    | `view.catalog`      | opens the catalog             |                                    |
| Tab "Title page" | `view.title.page`   | opens a title                 |                                    |
| Tab "My loans"   | `view.member.loans` | opens the member's own screen | does not show other members' loans |
| Tab "Desk"       | `view.desk`         | opens the staff screen        |                                    |

## Catalog and title page

| Element                      | ID                       | What it shows                                         | What it does not do                                             |
| ---------------------------- | ------------------------ | ----------------------------------------------------- | --------------------------------------------------------------- |
| "N available" / "N in queue" | `derived.queue-position` | availability or the queue length of each title        | does not say which copy is free: members wait for titles (D-02) |
| Status badge "available"     | `derived.available`      | the item can be lent now                              | a reserved or damaged item is never shown as available          |
| Column "Condition"           | `field.item.condition`   | good, worn or damaged, as recorded at the last return | members cannot edit it                                          |
| Queue list                   | `derived.queue-position` | waiting members in placement order                    | no drag handle: nobody reorders the queue                       |
| Reservation note             | `concept.reservation`    | what happens to a returned item when someone waits    |                                                                 |
| "3 days"                     | `rule.pickup-window`     | how long a reserved item waits (tentative, D-05)      |                                                                 |
| "Place hold"                 | `action.place-hold`      | joins the queue                                       | not offered while an item is available                          |
| "Cancel my hold"             | `action.cancel-hold`     | leaves the queue                                      |                                                                 |

## My loans

| Element                        | ID                            | What it shows                                        | What it does not do                                       |
| ------------------------------ | ----------------------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| Suspension note                | `concept.suspension`          | borrowing is paused until the overdue item is back   | never shows an amount of money: there are no fines (D-03) |
| "(why)" in the suspension note | `inv.suspended-cannot-borrow` | the rule behind the pause                            |                                                           |
| Column "Due"                   | `field.loan.due-date`         | due date of each loan                                |                                                           |
| Status badge "overdue"         | `derived.overdue`             | the due date has passed                              | not a stored status; recomputed every day                 |
| Column "Renewed"               | `field.loan.renewals`         | renewals used out of two                             |                                                           |
| "Renew"                        | `action.renew`                | renews the loan                                      | stays visible when refused (D-04)                         |
| "N people are waiting"         | `inv.no-renew-when-held`      | why renewal is refused                               |                                                           |
| Reminder line                  | `hook.due-reminder`           | that one reminder comes two days before the due date | the mockup cannot send it: time-based, see the ontology   |

## Desk

| Element         | ID                            | What it shows                              | What it does not do                   |
| --------------- | ----------------------------- | ------------------------------------------ | ------------------------------------- |
| "Check out"     | `action.checkout`             | lends the item to the member               |                                       |
| Refusal message | `inv.suspended-cannot-borrow` | why checkout is refused, and what lifts it | no override button at the desk        |
| "Return"        | `action.return`               | takes the item back                        |                                       |
| "Loans: 2 of 5" | `field.member.borrow-limit`   | open loans against the member's limit      |                                       |
| "Change limit"  | `action.set-borrow-limit`     | changes the member's limit                 | members cannot change their own limit |
