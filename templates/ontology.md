# <Product> — ontology

Created: YYYY-MM-DD
Status: working draft
Source of truth: this file. Decisions and their reasons live in [decisions.md](./decisions.md).

What the product is for, in two sentences. This document describes the **target model**. What the code already does is listed in "Implementation status"; everything else is target.

## How to read this

**One section per entity**, then a section for screens. **One row per concept**: kind, permanent ID, term, definition. Together the rows are the glossary; the tooltips are generated from them. Notes under a table add detail and refer to concepts by ID; they never restate a definition.

**Rows are grouped by kind**, in this order: Entity, Field, Relation, Derived, Concept, Rule, Invariant, Hook, Action, View. The kind is written on the first row of its group. A concept that involves several entities sits with the entity it constrains or changes.

**Identifiers.** `class.name`, permanent: renaming a term changes the row's text, never its ID. Fields and relations name their entity: `field.thing.state`. When an ID has to change, the old one moves to "Retired IDs".

## Thing

| Kind      | ID                    | Term            | Definition                            |
| --------- | --------------------- | --------------- | ------------------------------------- |
| Entity    | `ent.thing`           | Thing           | The main object people work with.     |
| Field     | `field.thing.state`   | State           | Open or closed.                       |
| Invariant | `inv.closed-is-final` | Closed is final | A closed thing is never reopened.     |
| Action    | `action.close`        | Close           | Close a thing. It cannot be reopened. |

- `field.thing.state` is set by the system; `action.close` is the only way to change it. `inv.closed-is-final` follows from D-01.

## Screens

| Kind | ID                | Term       | Definition                |
| ---- | ----------------- | ---------- | ------------------------- |
| View | `view.thing.page` | Thing page | One thing with its state. |

- `view.thing.page` shows one `ent.thing` with `field.thing.state` and offers `action.close`.

## Deliberately out of scope

What a helpful contributor would otherwise add, and why it is absent.

## Implementation status

Is this already in the code, or is it the target? Everything absent from the table is target. The check verifies that IDs exist and the listed files exist; completeness is a human judgment, recorded in the note. A row looks like `| ent.thing | src/thing.ts | note |` with the ID and paths in backticks. Group the rows under the same entity headings as above when the table grows.

| ID  | Implemented in | Note |
| --- | -------------- | ---- |

### Known divergences between code and ontology

A divergence is not an error in the ontology. Each line names the IDs involved and becomes a ticket, or a new decision if the target changed.

## Retired IDs

IDs that had to change. The decision log keeps using them; everywhere else the check requires the new ID. A row looks like `| old.id | new.id | D-nn |` with both IDs in backticks; write — for a removed concept.

| Retired ID | Replaced by | Decision |
| ---------- | ----------- | -------- |

## Revision history

- YYYY-MM-DD: first version.
