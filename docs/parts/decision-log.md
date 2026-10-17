# 2. Decision log

## What it is

A dated, append-only list of product decisions. Each entry records the decision, the reason, the rejected alternatives and the concepts it touches, by ID. It is the ontology's memory: the ontology says what the product is, and the log says why.

```markdown
### D-03 · No money fines; an overdue loan suspends borrowing

- Date: 2026-10-17 · Status: accepted
- Decision: there are no fines. A member with an overdue loan is suspended …
- Why: fines kept members with a late book away from the library altogether …
- Rejected: fines with a cap (still keeps people away); a suspension for a fixed number of days after return (punishes the return itself).
- Concepts: `concept.suspension`, `derived.overdue`, `inv.suspended-cannot-borrow`.
```

It descends from [Architecture Decision Records](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions) (Michael Nygard, 2011). Two things differ. It records product decisions rather than architecture, and every entry names the concepts it touches by ID, so the log can be read from a concept ("why is renewal refused here?") as well as in date order.

## Format

- A heading `### D-nn · <the decision in one line>`. The one-line title states the decision, not the topic: "No money fines", not "Fines".
- Date and status: accepted or tentative.
- Decision, Why, Rejected (each alternative with its reason in brackets), Concepts.
- Sections: Accepted, Tentative, Open questions, History.

"Tentative" is a chosen course that may still change without a new entry, for example because it has not been tested on real data. Removing the flag is an entry.

## Rules

- **Never edit an accepted entry.** Write a new one that says "supersedes D-nn" and why. The old entry stays, so the reasoning trail stays.
- **A decision without a reason is incomplete.** If the reason is "we felt like it", write that. The next reader deserves to know there was no deeper reason.
- **Rejected alternatives are mandatory when there were any.** They are what stops an agent from proposing the same alternative again.
- **The ontology refers to decisions by number** where a rule would otherwise look arbitrary: "There are no money fines (D-03)."
- **Keep personal and strategic decisions elsewhere.** The log holds what someone working on the product needs.

## What the check enforces

- Every ID mentioned in the log exists in the glossary.
- Every `D-nn` referenced in the ontology or the map has an entry.
- No entry number is used twice.

## What it cannot enforce

- That an old entry was not edited. Version control shows it; a review rule or a hook that compares accepted entries against the previous commit would enforce it.
- That a change to the ontology that needed a decision got one.

## How it fails in practice

- **Decisions recorded as outcomes without the fight.** "We use suspension" without "fines kept people away" is useless the day someone proposes fines again.
- **The log becomes a changelog.** Not every edit is a decision. A decision is a choice between alternatives that someone could reasonably make differently.
- **Superseded entries silently edited to match the new state.** That destroys the one thing the log is for.

## In the example

[`example/decisions.md`](../../example/decisions.md): four accepted decisions, one tentative, one open question.
