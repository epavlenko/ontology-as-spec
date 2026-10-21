# 1. Glossary and permanent IDs

## What it is

The definitions of every concept, one table row each, with a permanent ID that everything else uses: the mockup tooltips, the map, the decision log, the scenarios, the tickets and the tests. Together these rows are the glossary. They do not sit in a separate section. The ontology has one section per entity, and each section is one table holding the entity and everything that belongs to it: its fields, relations, derived values, rules, invariants, hooks and actions. Screens get a section of their own, because each shows several entities.

```markdown
## Loan

| Kind      | ID                       | Term                 | Definition                                                        |
| --------- | ------------------------ | -------------------- | ----------------------------------------------------------------- |
| Entity    | `ent.loan`               | Loan                 | An item lent to a member, from checkout until return.             |
| Field     | `field.loan.due-date`    | Due date             | When the item must be back: checkout plus the loan period.        |
|           | `field.loan.renewals`    | Renewals             | How many times the loan was renewed. A fact the system counts.    |
| Rule      | `rule.loan-period`       | Loan period          | 21 days from checkout.                                            |
| Invariant | `inv.no-renew-when-held` | No renewal when held | A loan cannot be renewed while someone waits for the title.       |
| Action    | `action.renew`           | Renew                | Move the due date by the renewal rule.                            |

- `rule.loan-period` is the same for every title (D-01).
```

Rows are grouped by kind in one fixed order, and the kind is written on the first row of its group. Whatever entity a reader opens, the fields come first, then the rules, then what people and the system do. Notes under the table add detail, such as who sets a field, which decision explains a rule, or which invariants an action can break. They refer to concepts by ID and never restate a definition.

The alternative is a separate glossary table plus per-kind tables (entities, fields, rules, views) that explain the same concepts again. It gives every concept two homes, and in practice the two drift apart. One row per concept leaves nothing to drift from, and grouping by entity is how people look things up: "what is there about loans?"

## ID format

`class.name`, lowercase, hyphens inside names, dots for sub-names: `view.title.page`. The class says what kind of thing it is, so a reader knows how to treat it before reading the definition. Fields and relations also name their entity, `field.loan.due-date`, because several entities will have a field with the same name. Other classes do not, because a rule, an invariant or an action often involves several entities. A typical set, in the order the rows are grouped:

| Class      | Kind of concept                                       | Example                         |
| ---------- | ----------------------------------------------------- | ------------------------------- |
| `ent`      | entity: a thing with identity                         | `ent.loan`                      |
| `field`    | stored attribute                                      | `field.loan.due-date`           |
| `edge`     | relation between entities                             | `edge.item.copy-of`             |
| `derived`  | computed value, never stored or typed in              | `derived.overdue`               |
| `concept`  | a notion that is none of the above                    | `concept.suspension`            |
| `rule`     | a rule with parameters                                | `rule.loan-period`              |
| `inv`      | invariant: must always hold                           | `inv.one-loan-per-item`         |
| `hook`     | something the system does on its own                  | `hook.due-reminder`             |
| `action`   | something a person does                               | `action.renew`                  |
| `view`     | a screen or a part of one                             | `view.member.loans`             |

Projects add classes as they need them: `type.*` for kinds of an entity, `trigger.*` for conditions shown to the user, `regime.*` for how a field is maintained, `plan.*` for parts of a composite structure. The class list lives in the check's configuration, with the label of each kind, in the order the rows are grouped. An unknown class is an error rather than silently ignored.

## Retired IDs

IDs are permanent, but sometimes one has to change: a class is renamed, a field gets its entity, a concept is removed. The old ID then moves to a "Retired IDs" table with its replacement, or a dash for a removed concept, and the decision that retired it. The decision log, whose accepted entries are never edited, keeps resolving the old ID through this table. Everywhere else the check reports the old ID with its replacement.

## Rules

- **A new concept gets a definition row first**, in the section of the entity it constrains or changes, then appears anywhere else.
- **IDs are permanent.** Renaming a term changes the Term and Definition cells only. Changing an ID (for example when a class name collides with a term in a neighbouring product) is allowed, but it is a decision with a reason: the new ID replaces the old one everywhere in one change, and the old one goes to "Retired IDs".
- **One definition.** The definition row is the one that tooltips show and agents quote. Notes elaborate it and must not restate or contradict it.
- **Definitions are short and say what the thing is, not how it is built.** "When the item must be back", not "a DATE column on loans".
- **Removing a concept** removes its row, its map rows and its mockup elements in one change, with a decision entry saying why, and lists the ID under "Retired IDs".

## What the check enforces

- Every ID mentioned in backticks in the ontology text exists in the glossary.
- Every glossary ID belongs to a configured class.
- No ID has two definition rows.
- Inside each table, rows follow the configured kind order, and the Kind cell names the kind on the first row of each group and is empty on the others.
- A field or relation sits in the table of the entity its ID names, and that entity exists; one table holds at most one entity.
- A retired ID has no definition row, its replacement exists, and it appears nowhere except the decision log.
- No glossary row is dead: each concept is mentioned in the ontology text, the map, the mockup or the implementation table.
- The generated tooltip file equals what the generator would produce now. This catches both a forgotten regeneration and a hand edit.

## What it cannot enforce

- That a note does not restate or contradict the definition. The check sees IDs, not meaning. See [limitations](../limitations.md#notes-can-still-restate-a-definition).
- That a concept sits with the right entity, beyond fields and relations.
- That a rename kept the ID. A changed ID looks like a removed concept plus a new one, which the check accepts if all references were updated.
- That the concept is a good one.

## How it fails in practice

- **Definitions written as implementation notes.** They age with the code. Keep the "how" in the implementation table's note column.
- **Notes that grow into a second definition.** A note that starts with "A loan is…" is a definition in the wrong place. Move what is missing into the row.
- **Too many concepts too early.** A concept that nobody discusses does not need an ID. Start with the ten concepts people argue about. The check lists concepts with no mockup element, ticket or implementation, which is where this shows first.
- **Glossary rows that restate the term** ("Due date: the due date"). The definition must answer the question a newcomer would ask.

## In the example

[`example/ontology.md`](../../example/ontology.md): five entity sections and a screens section, 36 concepts in ten classes, and six retired IDs from the change that put the entity into field and relation IDs.
