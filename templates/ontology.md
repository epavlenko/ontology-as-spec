# <Product> — ontology

Created: YYYY-MM-DD
Status: working draft
Source of truth: this file. Decisions and their reasons live in [decisions.md](./decisions.md).

What the product is for, in two sentences. This document describes the **target model**. What the code already does is listed in "Implementation status"; everything else is target.

**Identifiers.** Every concept has a permanent ID of the form `class.name`. The ID never changes when the term is renamed. The mockup, the map, the decision log, the scenarios and the tickets refer to concepts by ID. The full list is the "Glossary" section.

## Entities

| ID          | Entity | What it is                         |
| ----------- | ------ | ---------------------------------- |
| `ent.thing` | Thing  | the main object people work with   |

## Fields

| ID            | Field | Of    | Who sets it | Notes                       |
| ------------- | ----- | ----- | ----------- | --------------------------- |
| `field.state` | state | thing | the system  | open or closed (`action.close`) |

## Invariants

1. `inv.closed-is-final` A closed thing is never reopened (D-01).

## Views

| ID                | View       | What it shows                  |
| ----------------- | ---------- | ------------------------------ |
| `view.thing.page` | Thing page | one thing with its state       |

### Deliberately out of scope

What a helpful contributor would otherwise add, and why it is absent.

## Glossary

The single source of short definitions. Tooltips are generated from this table. Rule: a new concept gets a row here first.

| ID                    | Term             | Definition                                         |
| --------------------- | ---------------- | -------------------------------------------------- |
| `ent.thing`           | Thing            | The main object people work with.                  |
| `field.state`         | State            | Open or closed.                                    |
| `inv.closed-is-final` | Closed is final  | A closed thing is never reopened.                  |
| `view.thing.page`     | Thing page       | One thing with its state.                          |
| `action.close`        | Close            | Close a thing. It cannot be reopened.              |

## Implementation status

Is this already in the code, or is it the target? Everything absent from the table is target. The check verifies that IDs exist and the listed files exist; completeness is a human judgment, recorded in the note. A row looks like `| ent.thing | src/thing.ts | note |` with the ID and paths in backticks.

| ID  | Implemented in | Note |
| --- | -------------- | ---- |

### Known divergences between code and ontology

A divergence is not an error in the ontology. Each line names the IDs involved and becomes a ticket, or a new decision if the target changed.

## Revision history

- YYYY-MM-DD: first version.
