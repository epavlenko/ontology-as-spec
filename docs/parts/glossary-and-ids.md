# 1. Glossary and permanent IDs

## What it is

A section of the ontology document, a three-column table: ID, term, definition. It is the single source of short definitions. Everything else, from the prose of the ontology to the mockup tooltips, the map, the decision log, the scenarios and the tickets, refers to concepts by these IDs.

```markdown
| ID                      | Term              | Definition                                                     |
| ----------------------- | ----------------- | -------------------------------------------------------------- |
| `field.due-date`        | Due date          | When the item must be back: checkout plus the loan period.     |
| `inv.one-loan-per-item` | One loan per item | An item is on at most one open loan.                           |
```

The rest of the ontology explains concepts at length: tables of entities and fields, the rules, the invariants, the views. The glossary is the short form and the index.

## ID format

`class.name`, lowercase, hyphens inside names, dots for sub-names: `view.title.page`. The class says what kind of thing it is, so a reader knows how to treat it before reading the definition. A typical set:

| Class      | Kind of concept                                       | Example                         |
| ---------- | ----------------------------------------------------- | ------------------------------- |
| `ent`      | entity: a thing with identity                         | `ent.loan`                      |
| `field`    | stored attribute                                      | `field.due-date`                |
| `edge`     | relation between entities                             | `edge.copy-of`                  |
| `rule`     | a rule with parameters                                | `rule.loan-period`              |
| `inv`      | invariant: must always hold                           | `inv.one-loan-per-item`         |
| `derived`  | computed value, never stored or typed in              | `derived.overdue`               |
| `concept`  | a notion that is none of the above                    | `concept.suspension`            |
| `hook`     | something the system does on its own                  | `hook.due-reminder`             |
| `view`     | a screen or a part of one                             | `view.member.loans`             |
| `action`   | something a person does                               | `action.renew`                  |

Projects add classes as they need them: `type.*` for kinds of an entity, `trigger.*` for conditions shown to the user, `regime.*` for how a field is maintained, `plan.*` for parts of a composite structure. The class list lives in the check's configuration, so an unknown class is an error rather than silently ignored.

## Rules

- **A new concept gets a glossary row first**, then appears anywhere else.
- **IDs are permanent.** Renaming a term changes the second and third columns only. Renaming a whole class (for example when a word collides with a term in a neighbouring product) is allowed, but it is a decision with a reason and the old IDs are replaced everywhere in one change.
- **One definition.** The definition in the glossary is the one that tooltips show and agents quote. Longer explanations elsewhere in the ontology elaborate it and must not contradict it.
- **Definitions are short and say what the thing is, not how it is built.** "When the item must be back", not "a DATE column on loans".
- **Removing a concept** removes it from the glossary, the map and the mockup in one change, with a decision entry saying why.

## What the check enforces

- Every ID mentioned in backticks in the ontology text exists in the glossary.
- Every glossary ID belongs to a configured class.
- No glossary ID is duplicated.
- No glossary row is dead: each concept is mentioned in the ontology text, the map, the mockup or the implementation table.
- The generated tooltip file equals what the generator would produce now. This catches both a forgotten regeneration and a hand edit.

## What it cannot enforce

- That the long explanation elsewhere in the ontology agrees with the glossary definition. The check sees IDs, not meaning. If an entity table lists five items and the glossary row lists four, nothing fails. See [limitations](../limitations.md#definitions-can-drift-inside-the-ontology).
- That a rename kept the ID. A changed ID looks like a removed concept plus a new one, which the check accepts if all references were updated.
- That the concept is a good one.

## How it fails in practice

- **Definitions written as implementation notes.** They age with the code. Keep the "how" in the implementation table's note column.
- **Too many concepts too early.** A concept that nobody discusses does not need an ID. Start with the ten concepts people argue about.
- **Glossary rows that restate the term** ("Due date: the due date"). The definition must answer the question a newcomer would ask.

## In the example

[`example/ontology.md`](../../example/ontology.md), section "Glossary": 36 concepts in ten classes.
