# 3. Target and reality

## What it is

The ontology describes the **target model**: the product as agreed, not as built. Two sections at the end of the ontology say how far the code has come:

- **Implementation status**, a table from ID to the files that implement it, with a note on what is partial. It follows the entity sections of the ontology, one subheading per entity, so the status of a concept is found where its definition is.
- **Known divergences**, a list of places where the code disagrees with the target. Each line names the IDs involved and points at the ticket that closes it, or says that a decision is pending.

```markdown
### Hold

| ID                  | Implemented in    | Note                                         |
| ------------------- | ----------------- | -------------------------------------------- |
| `ent.hold`          | `app/library.mjs` | placement only; nothing serves the queue yet |
| `action.place-hold` | `app/cli.mjs`     |                                              |

### Known divergences

- **Member.** The code still stores `fineCents` … D-03 replaced fines with `concept.suspension`; the field is not removed.
- **Hold.** Nothing serves the queue: `hook.hold-ready`, `hook.hold-expire` … Ticket: #3 Serve the hold queue: reservation on return and the pickup window.
```

Anything not in the implementation table is target.

## Why keep them apart

A design document that is edited to match the code stops being a design. A design document that ignores the code misleads everyone who reads it as a description of the product. Keeping both, side by side, answers two different questions without mixing them: "what are we building?" and "what do we have?".

It also gives agents a precise instruction. An agent implementing a ticket builds toward the ontology. When it finds the code disagreeing, it does not quietly "fix" the ontology to match. It records a divergence.

## Rules

- **A divergence is not an error in the ontology.** Each line either becomes a ticket or, if the target itself changed, a new decision.
- **Behavior changes in code update the table** in the same change.
- **Partial implementations say what is missing** in the note column. "Implemented" with no note means complete as far as the author knows.
- **A second vocabulary is allowed for what shipped.** A project may keep a separate glossary of terms as they exist in code and user documentation. When the two disagree, the disagreement is a known divergence, never a silent edit of either.

## What the check enforces

- Every ID in the implementation table exists in the glossary.
- Every file named in the table exists.
- Every automatic check of implemented concepts has a test, and every concept a test suite covers is proven by it (see [part 6](checks-and-tests.md)).

`ont-check.mjs --gap` reads the table the other way round: every concept not in it is target, and together with untested checks and the known divergences that is the work left. Divergences therefore list only code that contradicts the target; what is simply not built yet comes from the table.

## What it cannot enforce

- That the named file actually implements the concept. The table can point at a file that has nothing to do with it. Completeness is a human judgment, and the ontology should say so in plain words next to the table.
- That code which behaves differently from the ontology is listed as a divergence. Code does not refer to IDs, so the check cannot see behavior. See [limitations](../limitations.md#code-does-not-refer-to-ids).

## How it fails in practice

- **The table stops being updated** because nothing fails when it is stale in the "not yet listed" direction. Tie the update to the ticket's Done when.
- **Divergences pile up without tickets.** A divergence list that only grows is a second backlog nobody reads. Every line names a ticket or a pending decision.
- **The note column becomes a design discussion.** It records the state of the code. Arguments go to the decision log.

## In the example

[`example/ontology.md`](../../example/ontology.md), sections "Implementation status" and "Known divergences": 19 concepts implemented, four divergences, including a field that a decision abolished but the code still computes.
