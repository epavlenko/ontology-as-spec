# Ontology as Specification — ontology of the approach

Created: 2026-10-22
Status: maintained
Source of truth for the approach's concepts. Decisions and their reasons live in [decisions.md](./decisions.md); the checks in [checks.md](./checks.md).

The approach described with itself: the concepts its artifacts are made of, the rules they follow, and how each is realised. The tables follow the same rules as any product ontology made with the approach, and `tools/ont-check/ont-check.mjs --config ont.config.json` checks them. [docs/reference.md](docs/reference.md) is generated from this file and the checks; the pages in `docs/` explain it for people.

## How to read this

One section per entity of the approach, one row per concept, rows grouped by kind in the configured order. Fields and relations name their entity. Types use the neutral vocabulary; `docs/approach.schema.json` is generated from them.

"Implemented" has a particular meaning here. A concept is implemented when it is realised: by the tool, for what the tool enforces, or by the page of `docs/` that states it, for rules people follow and procedures they carry out. Which rules the tool cannot enforce is visible in the check catalogue: their checks are manual.

## Concept

| Kind      | ID                           | Term                   | Type                                                                                  | Definition                                                                                                                        |
| --------- | ---------------------------- | ---------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Entity    | `ent.concept`                | Concept                |                                                                                       | Something in the product that people talk about, with one permanent ID and one definition row.                                    |
| Field     | `field.concept.id`           | ID                     | text                                                                                  | `class.name` in lowercase; a field or a relation adds its entity, `field.loan.due-date`. Never changes.                           |
|           | `field.concept.kind`         | Kind                   | one of entity, field, relation, derived, concept, rule, invariant, hook, action, view | What sort of concept it is. Rows are grouped by kind.                                                                             |
|           | `field.concept.term`         | Term                   | text                                                                                  | The name people use. It may change; the ID does not.                                                                              |
|           | `field.concept.type`         | Type                   | text optional                                                                         | For fields and relations only: a type from the neutral vocabulary.                                                                |
|           | `field.concept.definition`   | Definition             | text                                                                                  | What the concept is, in one or two sentences. Tooltips, reference pages and contracts quote it.                                   |
| Relation  | `edge.concept.entity`        | Belongs to             | ref `ent.concept` optional                                                            | The entity a field or relation belongs to, named in its ID.                                                                       |
| Derived   | `derived.implemented`        | Implemented            |                                                                                       | A concept listed in the implementation table.                                                                                     |
|           | `derived.target`             | Target                 |                                                                                       | A concept not listed in the implementation table: agreed, not built yet.                                                          |
| Rule      | `rule.kind-order`            | Kind order             |                                                                                       | Rows are grouped by kind in the configured order: entity, field, relation, derived, concept, rule, invariant, hook, action, view. |
|           | `rule.scoped-ids`            | Entity in field IDs    |                                                                                       | Fields and relations name their entity in the ID; other classes do not.                                                           |
| Invariant | `inv.one-definition-row`     | One definition row     |                                                                                       | Every ID has exactly one definition row, in one table.                                                                            |
|           | `inv.known-classes`          | Known classes          |                                                                                       | Every ID belongs to a class the configuration lists.                                                                              |
|           | `inv.kind-named-once`        | Kind named once        |                                                                                       | The Kind cell names the kind on the first row of its group and is empty on the rest.                                              |
|           | `inv.field-in-its-entity`    | Field with its entity  |                                                                                       | A field or relation sits in the table of the entity its ID names, and a table holds one entity.                                   |
|           | `inv.references-defined`     | References defined     |                                                                                       | Every ID used anywhere has a definition row; the decision log may also use retired IDs.                                           |
|           | `inv.concept-referenced`     | Referenced             |                                                                                       | Every concept is referred to somewhere besides its own row.                                                                       |
|           | `inv.concept-tried`          | Tried                  |                                                                                       | Every concept has a mockup element, a ticket or an implementation. Reported as information.                                       |
|           | `inv.ids-permanent`          | IDs are permanent      |                                                                                       | Renaming a term changes its row's text, never its ID.                                                                             |
|           | `inv.no-restated-definition` | No restated definition |                                                                                       | Notes under a table add detail and never restate a definition.                                                                    |
| Action    | `action.add-concept`         | Add a concept          |                                                                                       | Write its definition row first, in its entity's section, then refer to it.                                                        |
|           | `action.rename-term`         | Rename a term          |                                                                                       | Change the term and definition, keep the ID, regenerate, reread anchored sections.                                                |
|           | `action.change-id`           | Change an ID           |                                                                                       | Replace it everywhere but the decision log and retire the old one, with a decision.                                               |
|           | `action.remove-concept`      | Remove a concept       |                                                                                       | Remove its row and every reference, retire its ID with a dash, record a decision.                                                 |

## Retired ID

| Kind      | ID                            | Term               | Type                       | Definition                                                                                      |
| --------- | ----------------------------- | ------------------ | -------------------------- | ----------------------------------------------------------------------------------------------- |
| Entity    | `ent.retired-id`              | Retired ID         |                            | An ID that had to change, kept so that the decision log, which is never edited, still resolves. |
| Relation  | `edge.retired-id.replaced-by` | Replaced by        | ref `ent.concept` optional | The concept that replaces it; none for a removed concept.                                       |
|           | `edge.retired-id.decision`    | Retired by         | ref `ent.decision`         | The decision that retired it.                                                                   |
| Invariant | `inv.retired-not-defined`     | Not defined again  |                            | A retired ID has no definition row.                                                             |
|           | `inv.retired-only-in-log`     | Only in the log    |                            | A retired ID appears nowhere but the decision log.                                              |
|           | `inv.replacement-exists`      | Replacement exists |                            | The replacement of a retired ID has a definition row.                                           |

## Decision

| Kind      | ID                                | Term                 | Type                         | Definition                                                                   |
| --------- | --------------------------------- | -------------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| Entity    | `ent.decision`                    | Decision             |                              | One choice about the product, with its reason and the alternatives rejected. |
| Field     | `field.decision.number`           | Number               | text                         | `D-nn`, unique in the log.                                                   |
|           | `field.decision.status`           | Status               | one of accepted, tentative   | Accepted entries are final; a tentative one may change without a new entry.  |
|           | `field.decision.date`             | Date                 | date                         | When the choice was made.                                                    |
|           | `field.decision.choice`           | Decision             | text                         | What was chosen, precisely enough to implement.                              |
|           | `field.decision.why`              | Why                  | text                         | The reason, including what went wrong before.                                |
|           | `field.decision.rejected`         | Rejected             | text optional                | Each alternative with its reason in brackets.                                |
| Relation  | `edge.decision.concepts`          | Concepts             | refs `ent.concept`           | The concepts the choice touches.                                             |
|           | `edge.decision.supersedes`        | Supersedes           | refs `ent.decision` optional | Earlier entries this one replaces, each whole.                               |
| Rule      | `rule.one-choice`                 | One choice           |                              | An entry records one choice that can be reversed on its own.                 |
| Invariant | `inv.accepted-never-edited`       | Never edited         |                              | An accepted entry is never edited or removed.                                |
|           | `inv.decision-numbers-unique`     | Unique numbers       |                              | No entry number is used twice.                                               |
|           | `inv.decision-references-resolve` | References resolve   |                              | Every `D-nn` the ontology or the map refers to has an entry.                 |
|           | `inv.superseded-whole`            | Superseded whole     |                              | A new entry replaces an older one completely, never a part of it.            |
| Action    | `action.supersede-decision`       | Supersede a decision |                              | Write a new entry that replaces the old one whole and says why.              |

## Implementation row

| Kind      | ID                                | Term               | Type              | Definition                                                                                  |
| --------- | --------------------------------- | ------------------ | ----------------- | ------------------------------------------------------------------------------------------- |
| Entity    | `ent.implementation-row`          | Implementation row |                   | A claim that a concept exists in the product, with the files and a note on what is partial. |
| Field     | `field.implementation-row.files`  | Files              | text              | Paths of the files that realise the concept.                                                |
|           | `field.implementation-row.note`   | Note               | text optional     | What is partial or missing.                                                                 |
| Relation  | `edge.implementation-row.concept` | Concept            | ref `ent.concept` | The concept the row claims.                                                                 |
| Invariant | `inv.implementation-files-exist`  | Files exist        |                   | Every file the table names exists.                                                          |

## Divergence

| Kind     | ID                             | Term                | Type               | Definition                                                                                                     |
| -------- | ------------------------------ | ------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------- |
| Entity   | `ent.divergence`               | Divergence          |                    | A place where the product does something the target does not want.                                             |
| Field    | `field.divergence.description` | Description         | text               | What the product does instead, and the ticket or decision that will settle it.                                 |
| Relation | `edge.divergence.concepts`     | Concepts            | refs `ent.concept` | The concepts involved.                                                                                         |
| Rule     | `rule.divergence-contradicts`  | Only contradictions |                    | A divergence records behavior that contradicts the target; what is not built yet is the gap, not a divergence. |

## Mockup element

| Kind      | ID                            | Term                 | Type              | Definition                                                                             |
| --------- | ----------------------------- | -------------------- | ----------------- | -------------------------------------------------------------------------------------- |
| Entity    | `ent.mockup-element`          | Mockup element       |                   | A meaningful element of the mockup, labelled with a concept by `data-ont`.             |
| Relation  | `edge.mockup-element.concept` | Shows                | ref `ent.concept` | The concept the element stands for.                                                    |
| Invariant | `inv.mockup-matches-map`      | Mockup matches map   |                   | The mockup and the map name the same set of IDs.                                       |
|           | `inv.tooltips-generated`      | Tooltips generated   |                   | The tooltip file equals what the generator writes from the definitions.                |
|           | `inv.dynamic-ids-declared`    | Dynamic IDs declared |                   | An ID built from a template is declared, and every declared class has a live template. |

## Map row

| Kind     | ID                          | Term                | Type              | Definition                                                           |
| -------- | --------------------------- | ------------------- | ----------------- | -------------------------------------------------------------------- |
| Entity   | `ent.map-row`               | Map row             |                   | A row of the UI-to-ontology map: one mockup element and its concept. |
| Field    | `field.map-row.shows`       | What it shows       | text              | What the element shows, on this screen.                              |
|          | `field.map-row.does-not-do` | What it does not do | text optional     | What the element deliberately does not do.                           |
| Relation | `edge.map-row.concept`      | Concept             | ref `ent.concept` | The concept behind the element.                                      |

## Check

| Kind      | ID                              | Term                    | Type                | Definition                                                                                      |
| --------- | ------------------------------- | ----------------------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| Entity    | `ent.check`                     | Check                   |                     | A case with data that must hold for any implementation, in the product's terms.                 |
| Field     | `field.check.given`             | GIVEN                   | text                | The state to start from.                                                                        |
|           | `field.check.when`              | WHEN                    | text                | The event.                                                                                      |
|           | `field.check.then`              | THEN                    | text                | The observable result.                                                                          |
|           | `field.check.proof`             | Proof                   | one of auto, manual | `auto` when a test implements it, `manual` when only a person or an agent with the product can. |
| Relation  | `edge.check.concepts`           | Proves                  | refs `ent.concept`  | The concepts the check proves.                                                                  |
| Invariant | `inv.check-ids-unique`          | Unique                  |                     | No check ID is used twice.                                                                      |
|           | `inv.check-in-its-section`      | In its section          |                     | A check's ID names the catalogue section it sits in.                                            |
|           | `inv.check-well-formed`         | Well formed             |                     | A check has concepts, GIVEN, WHEN, THEN and `auto` or `manual`.                                 |
|           | `inv.required-concepts-checked` | Checks before code      |                     | Every concept of a required class has a check, built or not.                                    |
|           | `inv.auto-check-tested`         | Automatic checks tested |                     | Every automatic check whose concepts are all implemented has a test.                            |

## Test

| Kind      | ID                              | Term                | Type                 | Definition                                                       |
| --------- | ------------------------------- | ------------------- | -------------------- | ---------------------------------------------------------------- |
| Entity    | `ent.test`                      | Test                |                      | Code that implements checks and starts its title with their IDs. |
| Relation  | `edge.test.checks`              | Implements          | refs `ent.check`     | The checks the test implements.                                  |
|           | `edge.test.suite`               | In suite            | ref `ent.test-suite` | The suite the test belongs to.                                   |
| Invariant | `inv.test-names-known-checks`   | Known checks        |                      | A test names only checks the catalogue has.                      |
|           | `inv.test-only-implemented`     | Only what is built  |                      | A test proves only concepts that are implemented.                |
|           | `inv.no-manual-tested`          | Manual stays manual |                      | No test implements a manual check.                               |
|           | `inv.test-does-what-check-says` | Does what it says   |                      | A test does what the check it names says.                        |

## Test suite

| Kind      | ID                         | Term               | Type | Definition                                                                               |
| --------- | -------------------------- | ------------------ | ---- | ---------------------------------------------------------------------------------------- |
| Entity    | `ent.test-suite`           | Test suite         |      | A kind of test the team runs, such as unit or end-to-end, and the classes it must prove. |
| Field     | `field.test-suite.name`    | Name               | text | Unique among the suites.                                                                 |
|           | `field.test-suite.cover`   | Covers             | text | The classes whose implemented concepts the suite must prove.                             |
| Invariant | `inv.suite-names-unique`   | Unique names       |      | No two suites share a name.                                                              |
|           | `inv.suite-not-empty`      | Not empty          |      | Every suite has test files.                                                              |
|           | `inv.suite-covers-classes` | Covers its classes |      | Every implemented concept of a covered class is proven by a test of the suite.           |

## Ticket

| Kind      | ID                            | Term               | Type                       | Definition                                                                                            |
| --------- | ----------------------------- | ------------------ | -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Entity    | `ent.ticket`                  | Ticket             |                            | A slice of the gap: what to build now, within which limits.                                           |
| Field     | `field.ticket.why-now`        | Why now            | text                       | Why this slice comes before the rest of the gap.                                                      |
|           | `field.ticket.out-of-scope`   | Out of scope       | text optional              | What not to build, though it is target too.                                                           |
|           | `field.ticket.pre-authorized` | Pre-authorized     | text optional              | Permissions the agent would otherwise stop and ask for.                                               |
| Relation  | `edge.ticket.concepts`        | Slice              | refs `ent.concept`         | The concepts to build.                                                                                |
|           | `edge.ticket.checks`          | Checks             | refs `ent.check` optional  | The checks of the slice.                                                                              |
|           | `edge.ticket.depends-on`      | Depends on         | refs `ent.ticket` optional | Slices that must be done first.                                                                       |
| Derived   | `derived.gap`                 | Gap                |                            | The work left: target concepts with their checks, automatic checks without a test, known divergences. |
|           | `derived.slice-done`          | Slice done         |                            | Every concept of the slice implemented and every automatic check of it tested.                        |
| Invariant | `inv.ticket-has-ids`          | Names its concepts |                            | A ticket has an `IDs:` line.                                                                          |
|           | `inv.ticket-checks-related`   | Related checks     |                            | Every check a ticket lists exists and names one of its concepts.                                      |
| Action    | `action.cut-slice`            | Cut a slice        |                            | Take part of the gap and write the ticket with its limits and permissions.                            |

## Contract

| Kind      | ID                     | Term         | Type | Definition                                                                          |
| --------- | ---------------------- | ------------ | ---- | ----------------------------------------------------------------------------------- |
| Entity    | `ent.contract`         | Contract     |      | A JSON Schema per entity, generated from the types of its fields and relations.     |
| Invariant | `inv.typed-fields`     | Fields typed |      | Every field and relation has a type from the vocabulary, and no other kind has one. |
|           | `inv.contract-current` | Current      |      | The contract equals what the generator writes now.                                  |

## Doc section

| Kind      | ID                          | Term            | Type               | Definition                                                                  |
| --------- | --------------------------- | --------------- | ------------------ | --------------------------------------------------------------------------- |
| Entity    | `ent.doc-section`           | Doc section     |                    | A hand-written section of a page for people, anchored to what it explains.  |
| Field     | `field.doc-section.stamp`   | Stamp           | text optional      | A short hash of each definition as it was when the section was last reread. |
| Relation  | `edge.doc-section.explains` | Explains        | refs `ent.concept` | The concepts and checks the section explains.                               |
|           | `edge.doc-section.set`      | In set          | ref `ent.doc-set`  | The doc set the page belongs to.                                            |
| Derived   | `derived.to-reread`         | To reread       |                    | A section anchored to a definition that changed after its stamp.            |
| Invariant | `inv.anchors-resolve`       | Anchors resolve |                    | Every anchor names IDs of concepts or checks that exist.                    |

## Doc set

| Kind      | ID                    | Term                 | Type                    | Definition                                                                               |
| --------- | --------------------- | -------------------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| Entity    | `ent.doc-set`         | Doc set              |                         | A set of pages for one audience, and the classes it must explain.                        |
| Field     | `field.doc-set.name`  | Name                 | text                    | Unique among the sets.                                                                   |
|           | `field.doc-set.cover` | Covers               | text                    | The classes whose concepts the set must explain.                                         |
|           | `field.doc-set.scope` | Scope                | one of implemented, all | Whether the set explains what is built or the whole target.                              |
| Invariant | `inv.doc-set-covers`  | Explains its classes |                         | Every concept of a covered class, within the scope, is explained by an anchored section. |

## Reference page

| Kind      | ID                      | Term           | Type | Definition                                                                      |
| --------- | ----------------------- | -------------- | ---- | ------------------------------------------------------------------------------- |
| Entity    | `ent.reference-page`    | Reference page |      | A page that only restates the ontology and the checks, generated, never edited. |
| Invariant | `inv.reference-current` | Current        |      | A reference page equals what the generator writes now.                          |

## Implementation status

Where each concept is realised. Tool files enforce or generate; pages of `docs/` state the rules people follow and the procedures they carry out.

### Concept

| ID                           | Implemented in                                             | Note                                                                              |
| ---------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `ent.concept`                | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                                                                   |
| `field.concept.id`           | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                                                                   |
| `field.concept.kind`         | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                                                                   |
| `field.concept.term`         | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                                                                   |
| `field.concept.type`         | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                                                                   |
| `field.concept.definition`   | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                                                                   |
| `edge.concept.entity`        | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                                                                   |
| `derived.implemented`        | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                                                                   |
| `derived.target`             | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                                                                   |
| `rule.kind-order`            | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                                                                   |
| `rule.scoped-ids`            | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                                                                   |
| `inv.one-definition-row`     | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                                                                   |
| `inv.known-classes`          | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                                                                   |
| `inv.kind-named-once`        | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                                                                   |
| `inv.field-in-its-entity`    | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                                                                   |
| `inv.references-defined`     | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                                                                   |
| `inv.concept-referenced`     | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                                                                   |
| `inv.concept-tried`          | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                                                                   |
| `inv.ids-permanent`          | `docs/parts/glossary-and-ids.md`                           | a rule for people; the check sees a changed ID only as a removal plus an addition |
| `inv.no-restated-definition` | `docs/parts/glossary-and-ids.md`                           | reviewed, not checked                                                             |
| `action.add-concept`         | `docs/lifecycle.md`                                        | a procedure                                                                       |
| `action.rename-term`         | `docs/lifecycle.md`                                        | a procedure                                                                       |
| `action.change-id`           | `docs/lifecycle.md`                                        | a procedure                                                                       |
| `action.remove-concept`      | `docs/lifecycle.md`                                        | a procedure                                                                       |

### Retired ID

| ID                            | Implemented in                                             | Note |
| ----------------------------- | ---------------------------------------------------------- | ---- |
| `ent.retired-id`              | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `edge.retired-id.replaced-by` | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `edge.retired-id.decision`    | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `inv.retired-not-defined`     | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `inv.retired-only-in-log`     | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `inv.replacement-exists`      | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |

### Decision

| ID                                | Implemented in                                                         | Note                                              |
| --------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------- |
| `ent.decision`                    | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                   |
| `field.decision.number`           | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                   |
| `field.decision.status`           | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                   |
| `field.decision.date`             | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                   |
| `field.decision.choice`           | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                   |
| `field.decision.why`              | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                   |
| `field.decision.rejected`         | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                   |
| `edge.decision.concepts`          | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                   |
| `edge.decision.supersedes`        | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                   |
| `rule.one-choice`                 | `docs/parts/decision-log.md`                                           | reviewed; the check reports partial supersessions |
| `inv.accepted-never-edited`       | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                   |
| `inv.decision-numbers-unique`     | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                   |
| `inv.decision-references-resolve` | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                   |
| `inv.superseded-whole`            | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                   |
| `action.supersede-decision`       | `docs/lifecycle.md`                                                    | a procedure                                       |

### Implementation row

| ID                                | Implemented in                                             | Note |
| --------------------------------- | ---------------------------------------------------------- | ---- |
| `ent.implementation-row`          | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `field.implementation-row.files`  | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `field.implementation-row.note`   | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `edge.implementation-row.concept` | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `inv.implementation-files-exist`  | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |

### Divergence

| ID                             | Implemented in                     | Note                  |
| ------------------------------ | ---------------------------------- | --------------------- |
| `ent.divergence`               | `tools/ont-check/ont-check.mjs`    |                       |
| `field.divergence.description` | `tools/ont-check/ont-check.mjs`    |                       |
| `edge.divergence.concepts`     | `tools/ont-check/ont-check.mjs`    |                       |
| `rule.divergence-contradicts`  | `docs/parts/target-and-reality.md` | reviewed, not checked |

### Mockup element

| ID                            | Implemented in                                                                                         | Note |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ | ---- |
| `ent.mockup-element`          | `tools/ont-check/ont-check.mjs`, `tools/ont-check/gen-glossary.mjs`, `tools/ont-check/ont-tooltips.js` |      |
| `edge.mockup-element.concept` | `tools/ont-check/ont-check.mjs`, `tools/ont-check/gen-glossary.mjs`, `tools/ont-check/ont-tooltips.js` |      |
| `inv.mockup-matches-map`      | `tools/ont-check/ont-check.mjs`, `tools/ont-check/gen-glossary.mjs`, `tools/ont-check/ont-tooltips.js` |      |
| `inv.tooltips-generated`      | `tools/ont-check/ont-check.mjs`, `tools/ont-check/gen-glossary.mjs`, `tools/ont-check/ont-tooltips.js` |      |
| `inv.dynamic-ids-declared`    | `tools/ont-check/ont-check.mjs`, `tools/ont-check/gen-glossary.mjs`, `tools/ont-check/ont-tooltips.js` |      |

### Map row

| ID                          | Implemented in                  | Note |
| --------------------------- | ------------------------------- | ---- |
| `ent.map-row`               | `tools/ont-check/ont-check.mjs` |      |
| `field.map-row.shows`       | `tools/ont-check/ont-check.mjs` |      |
| `field.map-row.does-not-do` | `tools/ont-check/ont-check.mjs` |      |
| `edge.map-row.concept`      | `tools/ont-check/ont-check.mjs` |      |

### Check

| ID                              | Implemented in                                             | Note |
| ------------------------------- | ---------------------------------------------------------- | ---- |
| `ent.check`                     | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `field.check.given`             | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `field.check.when`              | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `field.check.then`              | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `field.check.proof`             | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `edge.check.concepts`           | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `inv.check-ids-unique`          | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `inv.check-in-its-section`      | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `inv.check-well-formed`         | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `inv.required-concepts-checked` | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `inv.auto-check-tested`         | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |

### Test

| ID                              | Implemented in                   | Note                  |
| ------------------------------- | -------------------------------- | --------------------- |
| `ent.test`                      | `tools/ont-check/ont-check.mjs`  |                       |
| `edge.test.checks`              | `tools/ont-check/ont-check.mjs`  |                       |
| `edge.test.suite`               | `tools/ont-check/ont-check.mjs`  |                       |
| `inv.test-names-known-checks`   | `tools/ont-check/ont-check.mjs`  |                       |
| `inv.test-only-implemented`     | `tools/ont-check/ont-check.mjs`  |                       |
| `inv.no-manual-tested`          | `tools/ont-check/ont-check.mjs`  |                       |
| `inv.test-does-what-check-says` | `docs/parts/checks-and-tests.md` | reviewed, not checked |

### Test suite

| ID                         | Implemented in                                             | Note |
| -------------------------- | ---------------------------------------------------------- | ---- |
| `ent.test-suite`           | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `field.test-suite.name`    | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `field.test-suite.cover`   | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `inv.suite-names-unique`   | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `inv.suite-not-empty`      | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `inv.suite-covers-classes` | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |

### Ticket

| ID                            | Implemented in                  | Note                                        |
| ----------------------------- | ------------------------------- | ------------------------------------------- |
| `ent.ticket`                  | `tools/ont-check/ont-check.mjs` |                                             |
| `field.ticket.why-now`        | `tools/ont-check/ont-check.mjs` |                                             |
| `field.ticket.out-of-scope`   | `tools/ont-check/ont-check.mjs` |                                             |
| `field.ticket.pre-authorized` | `tools/ont-check/ont-check.mjs` |                                             |
| `edge.ticket.concepts`        | `tools/ont-check/ont-check.mjs` |                                             |
| `edge.ticket.checks`          | `tools/ont-check/ont-check.mjs` |                                             |
| `edge.ticket.depends-on`      | `tools/ont-check/ont-check.mjs` |                                             |
| `derived.gap`                 | `tools/ont-check/ont-check.mjs` |                                             |
| `derived.slice-done`          | `tools/ont-check/ont-check.mjs` |                                             |
| `inv.ticket-has-ids`          | `tools/ont-check/ont-check.mjs` |                                             |
| `inv.ticket-checks-related`   | `tools/ont-check/ont-check.mjs` |                                             |
| `action.cut-slice`            | `docs/parts/agent-workflow.md`  | a procedure; `--gap` lists what to cut from |

### Contract

| ID                     | Implemented in                                                       | Note |
| ---------------------- | -------------------------------------------------------------------- | ---- |
| `ent.contract`         | `tools/ont-check/contracts.mjs`, `tools/ont-check/gen-contracts.mjs` |      |
| `inv.typed-fields`     | `tools/ont-check/contracts.mjs`, `tools/ont-check/gen-contracts.mjs` |      |
| `inv.contract-current` | `tools/ont-check/contracts.mjs`, `tools/ont-check/gen-contracts.mjs` |      |

### Doc section

| ID                          | Implemented in                                                                                | Note |
| --------------------------- | --------------------------------------------------------------------------------------------- | ---- |
| `ent.doc-section`           | `tools/ont-check/docs.mjs`, `tools/ont-check/ont-check.mjs`, `tools/ont-check/stamp-docs.mjs` |      |
| `field.doc-section.stamp`   | `tools/ont-check/docs.mjs`, `tools/ont-check/ont-check.mjs`, `tools/ont-check/stamp-docs.mjs` |      |
| `edge.doc-section.explains` | `tools/ont-check/docs.mjs`, `tools/ont-check/ont-check.mjs`, `tools/ont-check/stamp-docs.mjs` |      |
| `edge.doc-section.set`      | `tools/ont-check/docs.mjs`, `tools/ont-check/ont-check.mjs`, `tools/ont-check/stamp-docs.mjs` |      |
| `derived.to-reread`         | `tools/ont-check/docs.mjs`, `tools/ont-check/ont-check.mjs`, `tools/ont-check/stamp-docs.mjs` |      |
| `inv.anchors-resolve`       | `tools/ont-check/docs.mjs`, `tools/ont-check/ont-check.mjs`, `tools/ont-check/stamp-docs.mjs` |      |

### Doc set

| ID                    | Implemented in                                             | Note |
| --------------------- | ---------------------------------------------------------- | ---- |
| `ent.doc-set`         | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `field.doc-set.name`  | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `field.doc-set.cover` | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `field.doc-set.scope` | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `inv.doc-set-covers`  | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |

### Reference page

| ID                      | Implemented in                                                  | Note |
| ----------------------- | --------------------------------------------------------------- | ---- |
| `ent.reference-page`    | `tools/ont-check/docs.mjs`, `tools/ont-check/gen-reference.mjs` |      |
| `inv.reference-current` | `tools/ont-check/docs.mjs`, `tools/ont-check/gen-reference.mjs` |      |

### Known divergences between code and ontology

None known.

## Revision history

- 2026-10-22: first version, written from `docs/parts/` and the tool (D-19).
