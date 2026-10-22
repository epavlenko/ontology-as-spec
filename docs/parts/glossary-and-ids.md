# 1. Glossary and permanent IDs

<!-- ont: ent.concept@58346b, inv.one-definition-row@002e65, rule.kind-order@e49569, inv.kind-named-once@608893, inv.field-in-its-entity@c2f44b, rule.concept-with-its-entity@053a4a -->
## What it is

The definitions of every concept, one table row each, with a permanent ID that everything else uses: the mockup tooltips, the map, the decision log, the checks, the tickets and the tests. Together these rows are the glossary. They do not sit in a separate section. The ontology has one section per entity, and each section is one table holding the entity and everything that belongs to it: its fields, relations, derived values, rules, invariants, hooks and actions. Screens get a section of their own, because each shows several entities.

```markdown
## Loan

| Kind      | ID                       | Term                 | Type         | Definition                                                     |
| --------- | ------------------------ | -------------------- | ------------ | -------------------------------------------------------------- |
| Entity    | `ent.loan`               | Loan                 |              | An item lent to a member, from checkout until return.          |
| Field     | `field.loan.due-date`    | Due date             | date         | When the item must be back: checkout plus the loan period.     |
|           | `field.loan.renewals`    | Renewals             | integer 0..2 | How many times the loan was renewed. A fact the system counts. |
| Rule      | `rule.loan-period`       | Loan period          |              | 21 days from checkout.                                         |
| Invariant | `inv.no-renew-when-held` | No renewal when held |              | A loan cannot be renewed while someone waits for the title.    |
| Action    | `action.renew`           | Renew                |              | Move the due date by the renewal rule.                         |

- `rule.loan-period` is the same for every title (D-01).
```

Rows are grouped by kind in the order of the classes the configuration lists, and the kind is written on the first row of its group. Whatever entity a reader opens, the fields come first, then the rules, then what people and the system do. Notes under the table add detail, such as who sets a field, which decision explains a rule, or which invariants an action can break. They refer to concepts by ID and never restate a definition.

The alternative is a separate glossary table plus per-kind tables (entities, fields, rules, views) that explain the same concepts again. It gives every concept two homes, and in practice the two drift apart. One row per concept leaves nothing to drift from, and grouping by entity is how people look things up: "what is there about loans?"

<!-- ont: rule.scoped-ids@bf92d2, inv.known-classes@9d9f45 -->
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

<!-- ont: ent.contract@67c18d, inv.typed-fields@245354, inv.contract-current@955923 -->
## Types and contracts

Field and relation rows have one more cell, Type, in a vocabulary that belongs to no programming language. The other kinds leave it empty, and a table without fields, such as the screens, may leave the column out.

| Type | Meaning |
| ---- | ------- |
| `text`, `number`, `boolean` | a string, a number, true or false |
| `integer`, `integer 0..2`, `integer 1..` | a whole number, optionally with bounds |
| `date`, `datetime` | a calendar day, a moment |
| `one of good, worn, damaged` | one value from a list |
| ``ref `ent.title` ``, ``refs `ent.title` `` | a reference to one entity, or to many |
| any of them followed by `optional` | may be absent |

`tools/ont-check/gen-contracts.mjs` turns the types into a JSON Schema with one definition per entity. Each property carries its concept ID (`"x-ont": "field.loan.due-date"`), and references carry their target (`"x-ont-ref": "ent.title"`). Derived values are not in the contract, because they are never stored.

JSON Schema is the neutral part. Any stack can validate data against it or generate types from it, and the approach does not say which. A project decides how its code follows the contract: generated types, validation at the boundary, or a test that compares its constants with the schema, as the example does.

<!-- ont: ent.retired-id@b03cc7, inv.retired-not-defined@6c864b, inv.retired-only-in-log@94f601, inv.replacement-exists@dcf75f -->
## Retired IDs

IDs are permanent, but sometimes one has to change: a class is renamed, a field gets its entity, a concept is removed. The old ID then moves to a "Retired IDs" table with its replacement, or a dash for a removed concept, and the decision that retired it. The decision log, whose accepted entries are never edited, keeps resolving the old ID through this table. Everywhere else the check reports the old ID with its replacement.

<!-- ont: inv.ids-permanent@33ab31, inv.no-restated-definition@21be03, rule.definition-says-what@8e95f9, inv.references-defined@060f13, inv.concept-referenced@b457ed, inv.concept-tried@739910 -->
## Reference

The fields of a definition row, the rules every row follows and the checks that hold them are in the reference: [Concept](../reference.md#concept), [Retired ID](../reference.md#retired-id) and [Contract](../reference.md#contract). The automatic checks there are what the tool enforces. The manual ones are what it cannot: that a rename kept the ID, that a definition says what a thing is rather than how it is stored, that notes add detail instead of restating the definition, and that a concept involving several entities sits with the one it changes.

## How it fails in practice

- **Definitions written as implementation notes.** They age with the code. Keep the "how" in the implementation table's note column.
- **Notes that grow into a second definition.** A note that starts with "A loan is…" is a definition in the wrong place. Move what is missing into the row.
- **Too many concepts too early.** A concept that nobody discusses does not need an ID. Start with the ten concepts people argue about. The check lists concepts with no mockup element, ticket or implementation, which is where this shows first.
- **Glossary rows that restate the term** ("Due date: the due date"). The definition must answer the question a newcomer would ask.

## In the example

[`example/ontology.md`](../../example/ontology.md): five entity sections and a screens section, 39 concepts in ten classes, typed fields and relations with the generated [`contracts/ontology.schema.json`](../../example/contracts/ontology.schema.json), and six retired IDs from the change that put the entity into field and relation IDs.
