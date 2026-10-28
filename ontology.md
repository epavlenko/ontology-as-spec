# Ontology as Specification — ontology of the approach

Created: 2026-10-22
Status: maintained
Source of truth for the approach's concepts. Decisions and their reasons live in [decisions.md](./decisions.md); the checks in [checks.md](./checks.md).

The approach described with itself: the concepts its artifacts are made of, the rules they follow, and how each is realised. The tables follow the same rules as any product ontology made with the approach, and `tools/ont-check/ont-check.mjs --config ont.config.json` checks them. [docs/reference.md](docs/reference.md) is generated from this file and the checks; the pages in `docs/` explain it for people.

## How to read this

One section per entity of the approach, one row per concept, rows grouped by kind in the configured order. Fields and relations name their entity. Types use the neutral vocabulary; `contracts/approach.schema.json` is generated from them.

"Implemented" has a particular meaning here. A concept is implemented when it is realised: by the tool, for what the tool enforces, or by the page of `docs/` that states it, for rules people follow and procedures they carry out. Which rules the tool cannot enforce is visible in the check catalogue: their checks are manual.

## Concept

| Kind      | ID                             | Term                    | Type                       | Definition                                                                                                                                                            |
| --------- | ------------------------------ | ----------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entity    | `ent.concept`                  | Concept                 |                            | Something in the product that people talk about, with one permanent ID and one definition row.                                                                        |
| Field     | `field.concept.id`             | ID                      | text                       | `class.name` in lowercase; a field or a relation adds its entity, `field.loan.due-date`. Never changes.                                                               |
|           | `field.concept.kind`           | Kind                    | text                       | One of the classes the configuration lists, in the order rows are grouped; by default entity, field, relation, derived, concept, rule, invariant, hook, action, view. |
|           | `field.concept.term`           | Term                    | text                       | The name people use. It may change; the ID does not.                                                                                                                  |
|           | `field.concept.type`           | Type                    | text optional              | For fields and relations only: a type from the neutral vocabulary.                                                                                                    |
|           | `field.concept.definition`     | Definition              | text                       | What the concept is, in one or two sentences. Tooltips, reference pages and contracts quote it.                                                                       |
| Relation  | `edge.concept.entity`          | Belongs to              | ref `ent.concept` optional | The entity a field or relation belongs to, named in its ID.                                                                                                           |
| Derived   | `derived.implemented`          | Implemented             |                            | A concept listed in the implementation table.                                                                                                                         |
|           | `derived.target`               | Target                  |                            | A concept not listed in the implementation table: agreed, not built yet.                                                                                              |
| Rule      | `rule.kind-order`              | Kind order              |                            | Rows are grouped by kind in the order of the classes the configuration lists.                                                                                         |
|           | `rule.scoped-ids`              | Entity in field IDs     |                            | Fields and relations name their entity in the ID; other classes do not.                                                                                               |
|           | `rule.definition-says-what`    | Definitions say what    |                            | A definition is short and says what the thing is, not how it is built.                                                                                                |
|           | `rule.concept-with-its-entity` | Concept with its entity |                            | A concept that involves several entities sits with the entity it constrains or changes.                                                                               |
| Invariant | `inv.one-definition-row`       | One definition row      |                            | Every ID has exactly one definition row, in one table.                                                                                                                |
|           | `inv.known-classes`            | Known classes           |                            | Every ID belongs to a class the configuration lists.                                                                                                                  |
|           | `inv.kind-named-once`          | Kind named once         |                            | The Kind cell names the kind on the first row of its group and is empty on the rest.                                                                                  |
|           | `inv.field-in-its-entity`      | Field with its entity   |                            | A field or relation sits in the table of the entity its ID names, and a table holds one entity.                                                                       |
|           | `inv.references-defined`       | References defined      |                            | Every ID used anywhere has a definition row; the decision log may also use retired IDs.                                                                               |
|           | `inv.concept-referenced`       | Referenced              |                            | Every concept is referred to somewhere besides its own row.                                                                                                           |
|           | `inv.concept-tried`            | Tried                   |                            | Every concept has a mockup element, a ticket or an implementation. Reported as information.                                                                           |
|           | `inv.ids-permanent`            | IDs are permanent       |                            | Renaming a term changes its row's text, never its ID.                                                                                                                 |
|           | `inv.no-restated-definition`   | No restated definition  |                            | Notes under a table add detail and never restate a definition.                                                                                                        |
|           | `inv.one-concept-per-term`     | One concept per term    |                            | A term names one concept, apart from fields and relations of different entities and a relation named after the entity it refers to. Reported as information.          |
| Action    | `action.add-concept`           | Add a concept           |                            | Write its definition row first, in its entity's section; then its checks, map row, mockup element and anchors.                                                        |
|           | `action.rename-term`           | Rename a term           |                            | Change the term and definition, keep the ID, regenerate, reread anchored sections.                                                                                    |
|           | `action.change-id`             | Change an ID            |                            | Replace it everywhere but the decision log and retire the old one, with a decision.                                                                                   |
|           | `action.remove-concept`        | Remove a concept        |                            | Remove its row and every reference, retire its ID with a dash, record a decision.                                                                                     |

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

| Kind      | ID                                | Term                          | Type                             | Definition                                                                                                                                                                                                                                               |
| --------- | --------------------------------- | ----------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entity    | `ent.decision`                    | Decision                      |                                  | One choice about the product, with its reason and the alternatives rejected.                                                                                                                                                                             |
| Field     | `field.decision.number`           | Number                        | text                             | `D-nn`, unique in the log.                                                                                                                                                                                                                               |
|           | `field.decision.status`           | Status                        | one of accepted, tentative       | Accepted entries are final; a tentative one may change without a new entry, and its acceptance is a line in History.                                                                                                                                     |
|           | `field.decision.date`             | Date                          | date                             | When the choice was made.                                                                                                                                                                                                                                |
|           | `field.decision.choice`           | Decision                      | text                             | What was chosen, precisely enough to implement.                                                                                                                                                                                                          |
|           | `field.decision.why`              | Why                           | text                             | The reason, including what went wrong before.                                                                                                                                                                                                            |
|           | `field.decision.rejected`         | Rejected                      | text optional                    | Each alternative with its reason in brackets.                                                                                                                                                                                                            |
|           | `field.decision.title`            | Title                         | text                             | One line that states the decision, not the topic: "No money fines", not "Fines".                                                                                                                                                                         |
|           | `field.decision.source`           | Source                        | text optional                    | Where the choice was made: a call with the time of the passage, a message with its date, the owner's answer to a question, a document by its path; named on a `Source:` line.                                                                            |
|           | `field.decision.return-when`      | Return when                   | text optional                    | What must happen before what the entry puts off is taken up again; named on a `Return when:` line, it makes the entry a deferral.                                                                                                                        |
|           | `field.decision.layer`            | Layer                         | one of product, process optional | Product by default; process for an entry about how agents work rather than about the product, marked by a `Layer: process` line.                                                                                                                         |
| Relation  | `edge.decision.concepts`          | Concepts                      | refs `ent.concept`               | The concepts the choice touches.                                                                                                                                                                                                                         |
|           | `edge.decision.supersedes`        | Supersedes                    | refs `ent.decision` optional     | Earlier entries this one replaces, each whole, named on a `Supersedes:` line; they are replaced once this entry is accepted.                                                                                                                             |
|           | `edge.decision.extends`           | Extends                       | refs `ent.concept` optional      | Rules of the approach that a process entry adds to for the project, named on an `Extends:` line.                                                                                                                                                         |
|           | `edge.decision.overrides`         | Overrides                     | refs `ent.concept` optional      | Rules of the approach that a process entry changes for the project, named on an `Overrides:` line.                                                                                                                                                       |
| Derived   | `derived.in-force`                | In force                      |                                  | An entry that no accepted entry names on its `Supersedes:` line; a tentative entry's line takes effect when it is accepted.                                                                                                                              |
|           | `derived.named-by`                | Named by                      |                                  | The later entries that mention an entry by its number.                                                                                                                                                                                                   |
|           | `derived.meaning-changed`         | Meaning changed silently      |                                  | A definition row whose term, type or definition changed since the base commit while no decision entry or revision history line of the change names its ID.                                                                                               |
|           | `derived.waiting-for-owner`       | Waiting for the owner         |                                  | A tentative entry that no entry supersedes; the check lists it as information until the owner answers.                                                                                                                                                   |
|           | `derived.deferral-in-force`       | Deferral in force             |                                  | An accepted entry with a `Return when:` line that is in force; the check lists it with its condition as information.                                                                                                                                     |
| Rule      | `rule.one-choice`                 | One question                  |                                  | An entry answers one question; the parts of one answer, its mechanism and its direct consequences, stay together.                                                                                                                                        |
|           | `rule.cite-decisions`             | Cite by number                |                                  | The ontology refers to a decision by number where a rule would otherwise look arbitrary.                                                                                                                                                                 |
|           | `rule.product-decisions-only`     | Product decisions only        |                                  | The log holds what someone working on the product needs; personal and strategic decisions live elsewhere.                                                                                                                                                |
|           | `rule.unconfirmed-tentative`      | Unconfirmed is tentative      |                                  | A choice the owner has not explicitly approved, such as a value an agent picked, is tentative until the owner accepts it.                                                                                                                                |
|           | `rule.number-by-role`             | Numbers by their role         |                                  | Whether a changed number is an entry depends on its role: a rule's value, yes; settings tuned toward a requirement, no; a model's assumptions, a short entry about their topic, tentative when an agent chose them; data people edit in the product, no. |
|           | `rule.source-precedence`          | Sources by precedence         |                                  | When the sources of a choice disagree, the entry follows the owner's latest statement, then the owner's earlier ones, then the project's documents, then answers others gave for the owner; an entry that rests only on the last is tentative.           |
|           | `rule.question-as-tentative`      | Question as a tentative entry |                                  | A question with options and a recommendation is written as a tentative entry: the recommendation is its decision, the other options are rejected; open questions keep only questions without a recommendation.                                           |
|           | `rule.deferral-returns`           | Deferred with a condition     |                                  | What is put off, a target concept or anything out of scope, is put off by an entry that says when to take it up again.                                                                                                                                   |
| Invariant | `inv.accepted-never-edited`       | Never edited                  |                                  | An accepted entry is never edited or removed.                                                                                                                                                                                                            |
|           | `inv.decision-numbers-unique`     | Unique numbers                |                                  | No entry number is used twice.                                                                                                                                                                                                                           |
|           | `inv.decision-references-resolve` | References resolve            |                                  | Every `D-nn` the ontology or the map refers to has an entry.                                                                                                                                                                                             |
|           | `inv.superseded-whole`            | Superseded whole              |                                  | A later entry that contradicts any part of an earlier one supersedes it whole and restates what still holds; one that only adds to it leaves it in force.                                                                                                |
|           | `inv.decision-has-reason`         | Has a reason                  |                                  | Every entry says why; if there was no deeper reason, it says that.                                                                                                                                                                                       |
|           | `inv.rejected-recorded`           | Rejected recorded             |                                  | Every entry lists the alternatives that were rejected, with their reasons, when there were any.                                                                                                                                                          |
|           | `inv.supersession-named`          | Names what it replaces        |                                  | A superseding entry names every entry it supersedes on its `Supersedes:` line.                                                                                                                                                                           |
|           | `inv.supersedes-older`            | Supersedes what exists        |                                  | Every entry on a `Supersedes:` line exists and is older than the entry that names it.                                                                                                                                                                    |
|           | `inv.meaning-change-decided`      | Changes of meaning decided    |                                  | A change to meaning that rests on a choice has a decision entry.                                                                                                                                                                                         |
|           | `inv.sourced-since-first`         | Sourced from the first source |                                  | Once the log names a source, every entry accepted after that names its own.                                                                                                                                                                              |
|           | `inv.departure-well-formed`       | Departure well formed         |                                  | An entry with an `Extends:` or `Overrides:` line has `Layer: process`, and every such line names concepts of the approach that exist and, while the entry is in force, are not retired.                                                                  |
| Action    | `action.answer-tentative`         | Answer a tentative entry      |                                  | The owner takes the recommendation, picks another option or drops the question: the entry is accepted, rewritten and accepted, or withdrawn; an accepted one names the answer on its `Source:` line.                                                     |
|           | `action.supersede-decision`       | Supersede a decision          |                                  | Write a new entry that replaces the old one whole and says why.                                                                                                                                                                                          |

## Implementation row

| Kind      | ID                                | Term                    | Type               | Definition                                                                                                                                                                                                                                                            |
| --------- | --------------------------------- | ----------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entity    | `ent.implementation-row`          | Implementation row      |                    | A claim that one or more concepts exist in the product, with the files and a note on what is partial.                                                                                                                                                                 |
| Field     | `field.implementation-row.files`  | Files                   | text               | Paths of the files that realise the concept.                                                                                                                                                                                                                          |
|           | `field.implementation-row.note`   | Note                    | text optional      | What is partial or missing.                                                                                                                                                                                                                                           |
| Relation  | `edge.implementation-row.concept` | Concepts                | refs `ent.concept` | The concepts the row claims; concepts realised in the same files may share a row.                                                                                                                                                                                     |
| Derived   | `derived.named-in-code`           | Named in code           |                    | The files that name a concept in an `ont:` comment: those of the implementation table and of the code directories the configuration lists; `--coverage` shows them, and the check lists implemented concepts that the files of their row do not name, as information. |
| Rule      | `rule.code-names-concepts`        | Code names its concepts |                    | Code that implements a concept names its ID next to it in a comment, `// ont: inv.no-renew-when-held`; a name is not an implementation, so the implementation table still says where a concept is built.                                                              |
|           | `rule.table-with-code`            | Updated with the code   |                    | A change to behavior updates the implementation table in the same change.                                                                                                                                                                                             |
|           | `rule.partial-noted`              | Partial noted           |                    | The note of a partial row names the target concept that adds what is missing; no note means complete as far as the author knows.                                                                                                                                      |
| Invariant | `inv.code-names-resolve`          | Code names resolve      |                    | Every ID that code names in an `ont:` comment is defined and not retired.                                                                                                                                                                                             |
|           | `inv.implementation-files-exist`  | Files exist             |                    | Every file the table names exists.                                                                                                                                                                                                                                    |
|           | `inv.implementation-true`         | Row is true             |                    | The files a row names do realise the concept.                                                                                                                                                                                                                         |

## Divergence

| Kind      | ID                              | Term                   | Type               | Definition                                                                                                                                                                                                                                                       |
| --------- | ------------------------------- | ---------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entity    | `ent.divergence`                | Divergence             |                    | A place where the product does something the target does not want.                                                                                                                                                                                               |
| Field     | `field.divergence.description`  | Description            | text               | What the product does instead, and the ticket or decision that will settle it.                                                                                                                                                                                   |
| Relation  | `edge.divergence.concepts`      | Concepts               | refs `ent.concept` | The concepts involved.                                                                                                                                                                                                                                           |
| Rule      | `rule.divergence-contradicts`   | Only contradictions    |                    | A divergence records behavior that contradicts the target; what is not built yet is the gap, not a divergence.                                                                                                                                                   |
|           | `rule.divergence-becomes-work`  | Becomes work           |                    | Each divergence becomes a ticket, or a decision when the target was what changed.                                                                                                                                                                                |
|           | `rule.second-vocabulary`        | Second vocabulary      |                    | A project may keep the vocabulary of what shipped apart from the target's; where they disagree, it is a divergence, never a silent edit of either.                                                                                                               |
| Invariant | `inv.divergence-names-concepts` | Concepts named         |                    | Every line under known divergences names at least one concept by ID.                                                                                                                                                                                             |
| Action    | `action.walk-blind`             | Walk the product blind |                    | Use the product as a user, from the ontology, the catalogue, the map and the run guides but not the code: behavior that contradicts the target becomes a known divergence, a case the catalogue lacks becomes a check, and what is not built is already the gap. |

## Mockup element

| Kind      | ID                            | Term                 | Type              | Definition                                                                             |
| --------- | ----------------------------- | -------------------- | ----------------- | -------------------------------------------------------------------------------------- |
| Entity    | `ent.mockup-element`          | Mockup element       |                   | A meaningful element of the mockup, labelled with a concept by `data-ont`.             |
| Relation  | `edge.mockup-element.concept` | Shows                | ref `ent.concept` | The concept the element stands for.                                                    |
| Rule      | `rule.one-mockup`             | One mockup           |                   | One mockup for the whole product, in plain HTML that runs from the file system.        |
|           | `rule.mockup-shows-target`    | Shows the target     |                   | The mockup shows the target, not the code, and may run ahead of it.                    |
|           | `rule.mockup-data-fictional`  | Fictional data       |                   | Data in a shared mockup is fictional; real data only in a private copy.                |
| Invariant | `inv.mockup-matches-map`      | Mockup matches map   |                   | The mockup and the map name the same set of IDs.                                       |
|           | `inv.tooltips-generated`      | Tooltips generated   |                   | The tooltip file equals what the generator writes from the definitions.                |
|           | `inv.dynamic-ids-declared`    | Dynamic IDs declared |                   | An ID built from a template is declared, and every declared class has a live template. |
|           | `inv.label-is-true`           | Label is true        |                   | An element labelled with a concept behaves as that concept.                            |

## Map row

| Kind     | ID                          | Term                | Type              | Definition                                                                           |
| -------- | --------------------------- | ------------------- | ----------------- | ------------------------------------------------------------------------------------ |
| Entity   | `ent.map-row`               | Map row             |                   | A row of the UI-to-ontology map: one mockup element and its concept.                 |
| Field    | `field.map-row.shows`       | What it shows       | text              | What the element shows, on this screen.                                              |
|          | `field.map-row.does-not-do` | What it does not do | text optional     | What the element deliberately does not do.                                           |
| Relation | `edge.map-row.concept`      | Concept             | ref `ent.concept` | The concept behind the element.                                                      |
| Rule     | `rule.map-by-screen`        | Grouped by screen   |                   | The map is grouped by screen, one row per element; several elements may share an ID. |

## Check

| Kind      | ID                              | Term                     | Type                        | Definition                                                                                                                                                                                                                 |
| --------- | ------------------------------- | ------------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entity    | `ent.check`                     | Check                    |                             | A case with data that must hold for any implementation, in the product's terms.                                                                                                                                            |
| Field     | `field.check.given`             | GIVEN                    | text                        | The state to start from.                                                                                                                                                                                                   |
|           | `field.check.when`              | WHEN                     | text                        | The event.                                                                                                                                                                                                                 |
|           | `field.check.then`              | THEN                     | text                        | The observable result.                                                                                                                                                                                                     |
|           | `field.check.proof`             | Proof                    | one of auto, judged, manual | `auto` when a test implements it, `judged` when a test runs it and a model judges the output against its THEN, `manual` when only a person or an agent with the product can. `auto` and `judged` checks are automatic.     |
| Relation  | `edge.check.concepts`           | Proves                   | refs `ent.concept`          | The concepts the check proves.                                                                                                                                                                                             |
| Concept   | `concept.ontology-layer`        | Ontology layer           |                             | What the tool checks in any project: the ontology and the artifacts that refer to it.                                                                                                                                      |
|           | `concept.product-layer`         | Product layer            |                             | What a project's catalogue and tests check: the product that agents build from the ontology.                                                                                                                               |
|           | `concept.completeness-axis`     | Completeness axis        |                             | A fork along which behavior diverges, with its values. Every action has the outcome axis: success, refusal, empty, error, silence; a project may add axes of its own.                                                      |
| Rule      | `rule.check-in-product-terms`   | In the product's terms   |                             | GIVEN, WHEN and THEN use concrete data from a fixed sample and the product's words; no function names, commands or selectors.                                                                                              |
|           | `rule.unreachable-reported`     | Unreachable reported     |                             | A manual check that could not be run is reported as not run, never verified through another path.                                                                                                                          |
|           | `rule.manual-evidence-kept`     | Evidence kept            |                             | Evidence of a manual check is kept outside the repository, named by check and date.                                                                                                                                        |
|           | `rule.chosen-value-checked`     | Chosen values checked    |                             | A value a decision chose, or a target that is a requirement, is held by an automatic check; a model's assumptions are held by a snapshot of its base scenario's results, never by a check that the model reaches its goal. |
|           | `rule.judge-sees-the-check`     | The judge sees the check |                             | A judge gets the check's GIVEN, WHEN and THEN and the product's output, not the code or the test.                                                                                                                          |
|           | `rule.verdict-kept`             | Verdict kept             |                             | The verdict of a judged check is kept outside the repository, named by check and date, like the evidence of a manual check.                                                                                                |
|           | `rule.check-not-redundant`      | No redundant check       |                             | Two checks whose cases differ only in data, not in behavior, are one: a check whose removal loses no value or combination of values that the others cover goes.                                                            |
| Invariant | `inv.check-ids-unique`          | Unique                   |                             | No check ID is used twice.                                                                                                                                                                                                 |
|           | `inv.check-in-its-section`      | In its section           |                             | A check's ID names the key of the catalogue section it sits in: the code span in the heading, or else the heading's Latin letters and digits in lowercase.                                                                 |
|           | `inv.check-well-formed`         | Well formed              |                             | A check has concepts, GIVEN, WHEN, THEN and a proof: `auto`, `judged` or `manual`.                                                                                                                                         |
|           | `inv.required-concepts-checked` | Checks before code       |                             | Every concept of a required class has a check, built or not.                                                                                                                                                               |
|           | `inv.auto-check-tested`         | Automatic checks tested  |                             | Every automatic check whose concepts are all implemented has a test.                                                                                                                                                       |
|           | `inv.section-keys-match`        | Section keys match       |                             | Each ontology section with definition rows has a key of its own, every catalogue section's key names one of them, and a key written in a heading is one code span of lowercase letters, digits and hyphens.                |
|           | `inv.judged-check-tested`       | Judged checks tested     |                             | Every judged check whose concepts are all implemented has a test that runs it with a judge.                                                                                                                                |
|           | `inv.axis-values-covered`       | Every axis value covered |                             | Every value of every axis is covered by a check, the outcome axis by each action's own checks, unless the catalogue says why the value cannot occur.                                                                       |
| Action    | `action.derive-blind`           | Derive blind             |                             | Someone who sees only the ontology and the catalogue says what should happen in a case the catalogue does not hold; a mismatch with the owner's answer adds a check, or an open question when the owner does not know.     |

- `concept.ontology-layer` and `concept.product-layer` meet in this repository: the tool's own tests are the product layer of the tool, and the checks they implement are the ontology layer of every other project.

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

| Kind      | ID                            | Term                  | Type                      | Definition                                                                                        |
| --------- | ----------------------------- | --------------------- | ------------------------- | ------------------------------------------------------------------------------------------------- |
| Entity    | `ent.test-suite`              | Test suite            |                           | A kind of test the team runs, such as unit or end-to-end, and the classes it must prove.          |
| Field     | `field.test-suite.name`       | Name                  | text                      | Unique among the suites.                                                                          |
|           | `field.test-suite.cover`      | Covers                | text                      | The classes whose implemented concepts the suite must prove.                                      |
| Relation  | `edge.test-suite.checks`      | Checks                | refs `ent.check` optional | Checks the suite must implement, such as a key scenario end to end or the checks a judge decides. |
| Invariant | `inv.suite-names-unique`      | Unique names          |                           | No two suites share a name.                                                                       |
|           | `inv.suite-not-empty`         | Not empty             |                           | Every suite has test files.                                                                       |
|           | `inv.suite-covers-classes`    | Covers its classes    |                           | Every implemented concept of a covered class is proven by a test of the suite.                    |
|           | `inv.suite-implements-checks` | Implements its checks |                           | Every check a suite names, of implemented concepts, is implemented by a test of that suite.       |

## Ticket

| Kind      | ID                             | Term                   | Type                       | Definition                                                                                                                                                                                                                                                                                                                                |
| --------- | ------------------------------ | ---------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entity    | `ent.ticket`                   | Ticket                 |                            | A slice of the gap: what to build now, within which limits.                                                                                                                                                                                                                                                                               |
| Field     | `field.ticket.why-now`         | Why now                | text                       | Why this slice comes before the rest of the gap.                                                                                                                                                                                                                                                                                          |
|           | `field.ticket.out-of-scope`    | Out of scope           | text optional              | What not to build, though it is target too.                                                                                                                                                                                                                                                                                               |
|           | `field.ticket.pre-authorized`  | Pre-authorized         | text optional              | Permissions the agent would otherwise stop and ask for.                                                                                                                                                                                                                                                                                   |
| Relation  | `edge.ticket.concepts`         | Slice                  | refs `ent.concept`         | The concepts to build.                                                                                                                                                                                                                                                                                                                    |
|           | `edge.ticket.checks`           | Checks                 | refs `ent.check` optional  | The checks of the slice, on the ticket's `Checks:` line.                                                                                                                                                                                                                                                                                  |
|           | `edge.ticket.depends-on`       | Depends on             | refs `ent.ticket` optional | Slices that must be done first.                                                                                                                                                                                                                                                                                                           |
| Derived   | `derived.gap`                  | Gap                    |                            | The work left: target concepts with their checks, automatic checks without a test, known divergences.                                                                                                                                                                                                                                     |
|           | `derived.slice-done`           | Slice done             |                            | Nothing of the slice left: its concepts implemented, its automatic checks tested, none of the checks it lists waiting for a concept outside it, and no known divergence that names only its concepts.                                                                                                                                     |
|           | `derived.readiness`            | Readiness              |                            | What a target concept waits for: a ticket that takes it, an accepted deferral in force that names it, the owner while only tentative entries name it or an accepted entry naming it names a tentative one, or another target that its definition row or one of its checks names; otherwise it is ready. `--gap` shows it for each target. |
|           | `derived.next-slice`           | Next slice             |                            | What `--next` proposes for the next ticket: the ready targets of the first ontology section that has any, the ready targets they depend on, and the checks whose concepts the slice and the code cover.                                                                                                                                   |
| Rule      | `rule.ticket-without-behavior` | No behavior in tickets |                            | A ticket does not describe behavior; behavior is in the check catalogue, written before the ticket.                                                                                                                                                                                                                                       |
|           | `rule.take-ready`              | Build what is ready    |                            | Work is taken from what `--gap` marks ready, through a ticket; a target that waits for the owner, a condition or another target is not built ahead of it.                                                                                                                                                                                 |
| Invariant | `inv.ticket-has-ids`           | Names its concepts     |                            | A ticket has an `IDs:` line.                                                                                                                                                                                                                                                                                                              |
|           | `inv.ticket-checks-related`    | Related checks         |                            | Every check a ticket lists exists and names one of its concepts.                                                                                                                                                                                                                                                                          |
| Action    | `action.cut-slice`             | Cut a slice            |                            | Take part of the gap and write the ticket with its limits and permissions.                                                                                                                                                                                                                                                                |

## Agent rules

| Kind      | ID                                  | Term                           | Type | Definition                                                                                                                                                                           |
| --------- | ----------------------------------- | ------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Entity    | `ent.agent-rules`                   | Agent rules                    |      | The section of the agents' instructions that says what else to update when something changes, and what to run.                                                                       |
| Field     | `field.agent-rules.files`           | Files                          | text | The files that hold the agents' instructions, listed in the configuration under `agentInstructions`; the check reads the IDs and entries they mention.                               |
| Concept   | `concept.approach-ids`              | Approach IDs                   |      | The approach's concept IDs and retired IDs, generated into `tools/ont-check/approach.json` and copied with the tool, so that a project's check resolves the rules of the approach.   |
| Rule      | `rule.agent-rules-short`            | Short                          |      | The section is short enough to be read at the start of every session.                                                                                                                |
|           | `rule.agent-rules-point-at-files`   | Points at files                |      | Every row names a path or a command.                                                                                                                                                 |
|           | `rule.start-from-ids`               | Start from IDs                 |      | Every task starts by naming the IDs it touches; a task that cannot is not about meaning, or the ontology is incomplete.                                                              |
|           | `rule.findings-mislead`             | Findings that matter           |      | A consistency review reports what would mislead a reader or an agent, or would break a check. Style, the completeness of lists and compliance that changes nothing are not findings. |
|           | `rule.commit-finished-work`         | Every change committed         |      | Every change ends with a commit of its own files; who approves a commit or a push is the user's choice.                                                                              |
|           | `rule.agent-rule-source`            | Rule names its source          |      | A process rule in the agent instructions that comes from a rule of the approach or from a decision names that rule's ID or that entry; commands and matters of style name nothing.   |
|           | `rule.departure-by-entry`           | Departure by entry             |      | A project departs from a rule of the approach, stricter or looser, only by a process entry that extends or overrides it, and the instruction that departs cites that entry.          |
| Invariant | `inv.agent-rule-references-resolve` | Instruction references resolve |      | Every concept ID the agent instructions mention is defined, in the project's ontology or the approach's, and not retired; every entry they cite exists and is in force.              |
|           | `inv.approach-ids-current`          | Approach IDs current           |      | The generated approach IDs match the approach's ontology.                                                                                                                            |
| Action    | `action.critique-change`            | Critique a change              |      | Review a significant change as an agent that did not write it, from the diff and the IDs it touches, without the author's conclusions.                                               |

## Contract

| Kind      | ID                     | Term         | Type | Definition                                                                          |
| --------- | ---------------------- | ------------ | ---- | ----------------------------------------------------------------------------------- |
| Entity    | `ent.contract`         | Contract     |      | A JSON Schema per entity, generated from the types of its fields and relations.     |
| Invariant | `inv.typed-fields`     | Fields typed |      | Every field and relation has a type from the vocabulary, and no other kind has one. |
|           | `inv.contract-current` | Current      |      | The contract equals what the generator writes now.                                  |

## Doc section

| Kind      | ID                          | Term                   | Type               | Definition                                                                                                                                                                  |
| --------- | --------------------------- | ---------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entity    | `ent.doc-section`           | Doc section            |                    | A hand-written section of a page for people, anchored to what it explains.                                                                                                  |
| Field     | `field.doc-section.stamp`   | Stamp                  | text optional      | A short hash of what the section relies on for each concept it explains, the term, type, definition and the notes that name it, as it was when the section was last reread. |
| Relation  | `edge.doc-section.explains` | Explains               | refs `ent.concept` | The concepts and checks the section explains.                                                                                                                               |
|           | `edge.doc-section.set`      | In set                 | ref `ent.doc-set`  | The doc set the page belongs to.                                                                                                                                            |
| Derived   | `derived.to-reread`         | To reread              |                    | A section anchored to a concept whose definition, type or notes changed after its stamp.                                                                                    |
| Rule      | `rule.anchor-every-section` | Every section anchored |                    | Every section that explains a concept has an anchor; unanchored sections are not checked.                                                                                   |
|           | `rule.reread-then-stamp`    | Reread, then stamp     |                    | A section listed as anchored to a changed definition is reread, fixed if needed, and only then stamped.                                                                     |
|           | `rule.readers-words`        | Readers' words         |                    | Pages explain in the readers' words; they do not copy definitions, which reference pages restate.                                                                           |
|           | `rule.guide-runs-check`     | A guide runs its check |                    | A section that explains how to run a check lets someone who has not seen the product run it, and names the check instead of restating its case.                             |
| Invariant | `inv.anchors-resolve`       | Anchors resolve        |                    | Every anchor names IDs of concepts or checks that exist.                                                                                                                    |

## Doc set

| Kind      | ID                         | Term                 | Type                    | Definition                                                                                                                                   |
| --------- | -------------------------- | -------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Entity    | `ent.doc-set`              | Doc set              |                         | A set of pages for one audience, and the classes or checks it must explain.                                                                  |
| Field     | `field.doc-set.name`       | Name                 | text                    | Unique among the sets.                                                                                                                       |
|           | `field.doc-set.cover`      | Covers               | text                    | The classes whose concepts the set must explain.                                                                                             |
|           | `field.doc-set.scope`      | Scope                | one of implemented, all | Whether the set explains what is built or the whole target.                                                                                  |
|           | `field.doc-set.checks`     | Checks               | text optional           | The proofs whose checks the set must name in its anchors, such as manual for a run guide.                                                    |
| Invariant | `inv.doc-set-covers`       | Explains its classes |                         | Every concept of a covered class, within the scope, is explained by an anchored section, and every check of a covered proof is named by one. |
|           | `inv.doc-set-names-unique` | Unique names         |                         | No two doc sets share a name.                                                                                                                |

## Reference page

| Kind      | ID                      | Term           | Type | Definition                                                                      |
| --------- | ----------------------- | -------------- | ---- | ------------------------------------------------------------------------------- |
| Entity    | `ent.reference-page`    | Reference page |      | A page that only restates the ontology and the checks, generated, never edited. |
| Invariant | `inv.reference-current` | Current        |      | A reference page equals what the generator writes now.                          |

## Profile

| Kind   | ID                                | Term                          | Type | Definition                                                                                                                              |
| ------ | --------------------------------- | ----------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Entity | `ent.profile`                     | Profile                       |      | A recipe for a property of the product that its ontology shows: what to configure, what is required and what is recommended.            |
| Rule   | `rule.profile-requires-checkable` | Requires only what is checked |      | A profile requires only what the tool checks through the configuration and the catalogue; everything else it lists is a recommendation. |

- `ent.profile` is realised by a page of `docs/`, like a procedure. It has no configuration key: a project follows a profile by putting its settings in the configuration and writing its checks with the proof it asks for.

## Implementation status

Where each concept is realised. Tool files enforce or generate; pages of `docs/` state the rules people follow and the procedures they carry out.

### Concept

| ID                             | Implemented in                                                                                    | Note                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `ent.concept`                  | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`                                        |                                                                                   |
| `field.concept.id`             | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`                                        |                                                                                   |
| `field.concept.kind`           | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`                                        |                                                                                   |
| `field.concept.term`           | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`                                        |                                                                                   |
| `field.concept.type`           | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`                                        |                                                                                   |
| `field.concept.definition`     | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`                                        |                                                                                   |
| `edge.concept.entity`          | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`                                        |                                                                                   |
| `derived.implemented`          | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`                                        |                                                                                   |
| `derived.target`               | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`                                        |                                                                                   |
| `rule.kind-order`              | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`, `tools/ont-check/format-ontology.mjs` |                                                                                   |
| `rule.scoped-ids`              | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`                                        |                                                                                   |
| `rule.definition-says-what`    | `docs/parts/glossary-and-ids.md`                                                                  | reviewed, not checked                                                             |
| `rule.concept-with-its-entity` | `docs/parts/glossary-and-ids.md`                                                                  | reviewed, not checked                                                             |
| `inv.one-definition-row`       | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`                                        |                                                                                   |
| `inv.known-classes`            | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`                                        |                                                                                   |
| `inv.kind-named-once`          | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`, `tools/ont-check/format-ontology.mjs` |                                                                                   |
| `inv.field-in-its-entity`      | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`                                        |                                                                                   |
| `inv.references-defined`       | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`                                        |                                                                                   |
| `inv.concept-referenced`       | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`                                        |                                                                                   |
| `inv.concept-tried`            | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`                                        |                                                                                   |
| `inv.one-concept-per-term`     | `tools/ont-check/ont-check.mjs`                                                                   |                                                                                   |
| `inv.ids-permanent`            | `docs/parts/glossary-and-ids.md`                                                                  | a rule for people; the check sees a changed ID only as a removal plus an addition |
| `inv.no-restated-definition`   | `docs/parts/glossary-and-ids.md`                                                                  | reviewed, not checked                                                             |
| `action.add-concept`           | `docs/lifecycle.md`                                                                               | a procedure                                                                       |
| `action.rename-term`           | `docs/lifecycle.md`                                                                               | a procedure                                                                       |
| `action.change-id`             | `docs/lifecycle.md`                                                                               | a procedure                                                                       |
| `action.remove-concept`        | `docs/lifecycle.md`                                                                               | a procedure                                                                       |

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

| ID                                | Implemented in                                                         | Note                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `ent.decision`                    | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                                                              |
| `field.decision.number`           | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                                                              |
| `field.decision.status`           | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                                                              |
| `field.decision.date`             | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                                                              |
| `field.decision.choice`           | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                                                              |
| `field.decision.why`              | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                                                              |
| `field.decision.rejected`         | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                                                              |
| `field.decision.title`            | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                                                              |
| `edge.decision.concepts`          | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                                                              |
| `edge.decision.supersedes`        | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                                                              |
| `derived.in-force`                | `tools/ont-check/ont-check.mjs`                                        |                                                                                              |
| `derived.named-by`                | `tools/ont-check/ont-check.mjs`                                        |                                                                                              |
| `derived.meaning-changed`         | `tools/ont-check/guard-decisions.mjs`, `tools/ont-check/lib.mjs`       |                                                                                              |
| `rule.one-choice`                 | `docs/parts/decision-log.md`                                           | reviewed; the check reports partial supersessions                                            |
| `rule.cite-decisions`             | `docs/parts/decision-log.md`                                           | reviewed, not checked                                                                        |
| `rule.product-decisions-only`     | `docs/parts/decision-log.md`                                           | reviewed, not checked                                                                        |
| `rule.unconfirmed-tentative`      | `docs/parts/decision-log.md`                                           | reviewed, not checked                                                                        |
| `rule.number-by-role`             | `docs/parts/decision-log.md`                                           | reviewed, not checked                                                                        |
| `inv.accepted-never-edited`       | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                                                              |
| `inv.decision-numbers-unique`     | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                                                              |
| `inv.decision-references-resolve` | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                                                              |
| `inv.superseded-whole`            | `tools/ont-check/ont-check.mjs`, `tools/ont-check/guard-decisions.mjs` |                                                                                              |
| `inv.decision-has-reason`         | `docs/parts/decision-log.md`                                           | reviewed, not checked                                                                        |
| `inv.rejected-recorded`           | `docs/parts/decision-log.md`                                           | reviewed, not checked                                                                        |
| `inv.supersession-named`          | `docs/parts/decision-log.md`                                           | reviewed, not checked                                                                        |
| `inv.supersedes-older`            | `tools/ont-check/ont-check.mjs`                                        |                                                                                              |
| `inv.meaning-change-decided`      | `docs/parts/decision-log.md`, `tools/ont-check/guard-decisions.mjs`    | the guard names definitions changed silently; whether a change rests on a choice is reviewed |
| `action.supersede-decision`       | `docs/lifecycle.md`                                                    | a procedure                                                                                  |
| `field.decision.source`           | `tools/ont-check/lib.mjs`, `tools/ont-check/guard-decisions.mjs`       |                                                                                              |
| `field.decision.return-when`      | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`             |                                                                                              |
| `derived.waiting-for-owner`       | `tools/ont-check/ont-check.mjs`                                        |                                                                                              |
| `derived.deferral-in-force`       | `tools/ont-check/ont-check.mjs`                                        |                                                                                              |
| `rule.source-precedence`          | `docs/parts/decision-log.md`                                           | reviewed, not checked                                                                        |
| `rule.question-as-tentative`      | `docs/parts/decision-log.md`                                           | reviewed; the check lists tentative entries                                                  |
| `rule.deferral-returns`           | `docs/parts/decision-log.md`                                           | reviewed; the check lists deferrals with their conditions                                    |
| `inv.sourced-since-first`         | `tools/ont-check/guard-decisions.mjs`                                  |                                                                                              |
| `action.answer-tentative`         | `docs/parts/decision-log.md`                                           | a procedure                                                                                  |
| `field.decision.layer`            | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`             |                                                                                              |
| `edge.decision.extends`           | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`             |                                                                                              |
| `edge.decision.overrides`         | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`             |                                                                                              |
| `inv.departure-well-formed`       | `tools/ont-check/ont-check.mjs`                                        |                                                                                              |

### Implementation row

| ID                                | Implemented in                                             | Note                                |
| --------------------------------- | ---------------------------------------------------------- | ----------------------------------- |
| `ent.implementation-row`          | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                     |
| `field.implementation-row.files`  | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                     |
| `field.implementation-row.note`   | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                     |
| `edge.implementation-row.concept` | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                     |
| `rule.table-with-code`            | `docs/parts/target-and-reality.md`                         | reviewed, not checked               |
| `derived.named-in-code`           | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                     |
| `rule.code-names-concepts`        | `docs/parts/target-and-reality.md`                         | reviewed; the check reads the names |
| `inv.code-names-resolve`          | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                     |
| `rule.partial-noted`              | `docs/parts/target-and-reality.md`                         | reviewed, not checked               |
| `inv.implementation-files-exist`  | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |                                     |
| `inv.implementation-true`         | `docs/parts/target-and-reality.md`                         | reviewed, not checked               |

### Divergence

| ID                              | Implemented in                     | Note                                      |
| ------------------------------- | ---------------------------------- | ----------------------------------------- |
| `ent.divergence`                | `tools/ont-check/ont-check.mjs`    |                                           |
| `field.divergence.description`  | `tools/ont-check/ont-check.mjs`    |                                           |
| `edge.divergence.concepts`      | `tools/ont-check/ont-check.mjs`    |                                           |
| `rule.divergence-contradicts`   | `docs/parts/target-and-reality.md` | reviewed, not checked                     |
| `rule.divergence-becomes-work`  | `docs/parts/target-and-reality.md` | reviewed, not checked                     |
| `rule.second-vocabulary`        | `docs/parts/target-and-reality.md` | reviewed, not checked                     |
| `inv.divergence-names-concepts` | `tools/ont-check/ont-check.mjs`    |                                           |
| `action.walk-blind`             | `docs/parts/target-and-reality.md` | a procedure, recommended before a release |

### Mockup element

| ID                            | Implemented in                                                                                         | Note                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------- |
| `ent.mockup-element`          | `tools/ont-check/ont-check.mjs`, `tools/ont-check/gen-glossary.mjs`, `tools/ont-check/ont-tooltips.js` |                       |
| `edge.mockup-element.concept` | `tools/ont-check/ont-check.mjs`, `tools/ont-check/gen-glossary.mjs`, `tools/ont-check/ont-tooltips.js` |                       |
| `rule.one-mockup`             | `docs/parts/mockup-as-ui-spec.md`                                                                      | reviewed, not checked |
| `rule.mockup-shows-target`    | `docs/parts/mockup-as-ui-spec.md`                                                                      | reviewed, not checked |
| `rule.mockup-data-fictional`  | `docs/parts/mockup-as-ui-spec.md`                                                                      | reviewed, not checked |
| `inv.mockup-matches-map`      | `tools/ont-check/ont-check.mjs`, `tools/ont-check/gen-glossary.mjs`, `tools/ont-check/ont-tooltips.js` |                       |
| `inv.tooltips-generated`      | `tools/ont-check/ont-check.mjs`, `tools/ont-check/gen-glossary.mjs`, `tools/ont-check/ont-tooltips.js` |                       |
| `inv.dynamic-ids-declared`    | `tools/ont-check/ont-check.mjs`, `tools/ont-check/gen-glossary.mjs`, `tools/ont-check/ont-tooltips.js` |                       |
| `inv.label-is-true`           | `docs/parts/mockup-as-ui-spec.md`                                                                      | reviewed, not checked |

### Map row

| ID                          | Implemented in                    | Note                  |
| --------------------------- | --------------------------------- | --------------------- |
| `ent.map-row`               | `tools/ont-check/ont-check.mjs`   |                       |
| `field.map-row.shows`       | `tools/ont-check/ont-check.mjs`   |                       |
| `field.map-row.does-not-do` | `tools/ont-check/ont-check.mjs`   |                       |
| `edge.map-row.concept`      | `tools/ont-check/ont-check.mjs`   |                       |
| `rule.map-by-screen`        | `docs/parts/mockup-as-ui-spec.md` | reviewed, not checked |

### Check

| ID                              | Implemented in                                                | Note                                                                                                       |
| ------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `ent.check`                     | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`    |                                                                                                            |
| `field.check.given`             | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`    |                                                                                                            |
| `field.check.when`              | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`    |                                                                                                            |
| `field.check.then`              | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`    |                                                                                                            |
| `field.check.proof`             | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`    |                                                                                                            |
| `edge.check.concepts`           | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`    |                                                                                                            |
| `concept.ontology-layer`        | `docs/parts/checks-and-tests.md`                              |                                                                                                            |
| `concept.product-layer`         | `docs/parts/checks-and-tests.md`                              |                                                                                                            |
| `concept.completeness-axis`     | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`    |                                                                                                            |
| `rule.check-in-product-terms`   | `docs/parts/checks-and-tests.md`                              | reviewed, not checked                                                                                      |
| `rule.unreachable-reported`     | `docs/parts/checks-and-tests.md`                              | reviewed, not checked                                                                                      |
| `rule.manual-evidence-kept`     | `docs/parts/checks-and-tests.md`                              | reviewed, not checked                                                                                      |
| `rule.chosen-value-checked`     | `docs/parts/checks-and-tests.md`                              | reviewed, not checked                                                                                      |
| `inv.check-ids-unique`          | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`    |                                                                                                            |
| `inv.check-in-its-section`      | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`    |                                                                                                            |
| `inv.check-well-formed`         | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`    |                                                                                                            |
| `inv.required-concepts-checked` | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`    |                                                                                                            |
| `inv.auto-check-tested`         | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`    |                                                                                                            |
| `inv.section-keys-match`        | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`    |                                                                                                            |
| `inv.judged-check-tested`       | `tools/ont-check/ont-check.mjs`                               |                                                                                                            |
| `inv.axis-values-covered`       | `tools/ont-check/ont-check.mjs`                               |                                                                                                            |
| `rule.check-not-redundant`      | `docs/parts/checks-and-tests.md`                              | reviewed, not checked                                                                                      |
| `action.derive-blind`           | `tools/ont-check/judge.mjs`, `docs/parts/checks-and-tests.md` | a procedure                                                                                                |
| `rule.judge-sees-the-check`     | `tools/ont-check/judge.mjs`, `docs/parts/checks-and-tests.md` | the helper gives the judge the case and the output only; a test that calls a judge another way is reviewed |
| `rule.verdict-kept`             | `tools/ont-check/judge.mjs`, `docs/parts/checks-and-tests.md` | the helper writes the verdict where `JUDGE_VERDICTS` points; that it is outside the repository is reviewed |

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

| ID                            | Implemented in                                             | Note |
| ----------------------------- | ---------------------------------------------------------- | ---- |
| `ent.test-suite`              | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `field.test-suite.name`       | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `field.test-suite.cover`      | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `inv.suite-names-unique`      | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `inv.suite-not-empty`         | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `inv.suite-covers-classes`    | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `edge.test-suite.checks`      | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `inv.suite-implements-checks` | `tools/ont-check/ont-check.mjs`                            |      |

### Ticket

| ID                             | Implemented in                  | Note                                                     |
| ------------------------------ | ------------------------------- | -------------------------------------------------------- |
| `ent.ticket`                   | `tools/ont-check/ont-check.mjs` |                                                          |
| `field.ticket.why-now`         | `docs/parts/agent-workflow.md`  | written by people; the tool does not read it             |
| `field.ticket.out-of-scope`    | `docs/parts/agent-workflow.md`  | written by people; the tool does not read it             |
| `field.ticket.pre-authorized`  | `docs/parts/agent-workflow.md`  | written by people; the tool does not read it             |
| `edge.ticket.concepts`         | `tools/ont-check/ont-check.mjs` |                                                          |
| `edge.ticket.checks`           | `tools/ont-check/ont-check.mjs` |                                                          |
| `edge.ticket.depends-on`       | `docs/parts/agent-workflow.md`  | written by people; the tool does not read it             |
| `derived.gap`                  | `tools/ont-check/ont-check.mjs` | |
| `derived.slice-done`           | `tools/ont-check/ont-check.mjs` | |
| `derived.readiness`            | `tools/ont-check/ont-check.mjs` |                                                          |
| `derived.next-slice`           | `tools/ont-check/ont-check.mjs` |                                                          |
| `rule.take-ready`              | `docs/parts/agent-workflow.md`  | reviewed; `--gap` and `--next` show what is ready        |
| `rule.ticket-without-behavior` | `docs/parts/agent-workflow.md`  | reviewed, not checked                                    |
| `inv.ticket-has-ids`           | `tools/ont-check/ont-check.mjs` |                                                          |
| `inv.ticket-checks-related`    | `tools/ont-check/ont-check.mjs` |                                                          |
| `action.cut-slice`             | `docs/parts/agent-workflow.md`  | a procedure; `--gap` lists what to cut from              |

### Agent rules

| ID                                  | Implemented in                                                | Note                                                                     |
| ----------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `ent.agent-rules`                   | `docs/parts/agent-rules.md`                                   |                                                                          |
| `rule.agent-rules-short`            | `docs/parts/agent-rules.md`                                   |                                                                          |
| `rule.agent-rules-point-at-files`   | `docs/parts/agent-rules.md`                                   |                                                                          |
| `rule.start-from-ids`               | `docs/parts/agent-rules.md`                                   |                                                                          |
| `rule.findings-mislead`             | `docs/parts/agent-rules.md`                                   | reviewed, not checked                                                    |
| `rule.commit-finished-work`         | `docs/parts/agent-rules.md`                                   | reviewed, not checked                                                    |
| `action.critique-change`            | `docs/parts/agent-rules.md`                                   | a procedure, recommended for changes of rules, mechanisms and risky code |
| `field.agent-rules.files`           | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs`    |                                                                          |
| `concept.approach-ids`              | `tools/ont-check/gen-approach.mjs`, `tools/ont-check/lib.mjs` |                                                                          |
| `rule.agent-rule-source`            | `docs/parts/agent-rules.md`                                   | reviewed; the check resolves what the rules name                         |
| `rule.departure-by-entry`           | `docs/parts/agent-rules.md`                                   | reviewed; the check confirms the process entries                         |
| `inv.agent-rule-references-resolve` | `tools/ont-check/ont-check.mjs`                               |                                                                          |
| `inv.approach-ids-current`          | `tools/ont-check/ont-check.mjs`                               |                                                                          |

### Contract

| ID                     | Implemented in                                                       | Note |
| ---------------------- | -------------------------------------------------------------------- | ---- |
| `ent.contract`         | `tools/ont-check/contracts.mjs`, `tools/ont-check/gen-contracts.mjs` |      |
| `inv.typed-fields`     | `tools/ont-check/contracts.mjs`, `tools/ont-check/gen-contracts.mjs` |      |
| `inv.contract-current` | `tools/ont-check/contracts.mjs`, `tools/ont-check/gen-contracts.mjs` |      |

### Doc section

| ID                          | Implemented in                                                                                | Note                  |
| --------------------------- | --------------------------------------------------------------------------------------------- | --------------------- |
| `ent.doc-section`           | `tools/ont-check/docs.mjs`, `tools/ont-check/ont-check.mjs`, `tools/ont-check/stamp-docs.mjs` |                       |
| `field.doc-section.stamp`   | `tools/ont-check/docs.mjs`, `tools/ont-check/ont-check.mjs`, `tools/ont-check/stamp-docs.mjs` |                       |
| `edge.doc-section.explains` | `tools/ont-check/docs.mjs`, `tools/ont-check/ont-check.mjs`, `tools/ont-check/stamp-docs.mjs` |                       |
| `edge.doc-section.set`      | `tools/ont-check/docs.mjs`, `tools/ont-check/ont-check.mjs`, `tools/ont-check/stamp-docs.mjs` |                       |
| `derived.to-reread`         | `tools/ont-check/docs.mjs`, `tools/ont-check/ont-check.mjs`, `tools/ont-check/stamp-docs.mjs` |                       |
| `rule.anchor-every-section` | `docs/parts/documentation.md`                                                                 | reviewed, not checked |
| `rule.reread-then-stamp`    | `docs/parts/documentation.md`                                                                 | reviewed, not checked |
| `rule.readers-words`        | `docs/parts/documentation.md`                                                                 | reviewed, not checked |
| `rule.guide-runs-check`     | `docs/parts/checks-and-tests.md`                                                              | reviewed, not checked |
| `inv.anchors-resolve`       | `tools/ont-check/docs.mjs`, `tools/ont-check/ont-check.mjs`, `tools/ont-check/stamp-docs.mjs` |                       |

### Doc set

| ID                         | Implemented in                                             | Note |
| -------------------------- | ---------------------------------------------------------- | ---- |
| `ent.doc-set`              | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `field.doc-set.name`       | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `field.doc-set.cover`      | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `field.doc-set.scope`      | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `field.doc-set.checks`     | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `inv.doc-set-covers`       | `tools/ont-check/lib.mjs`, `tools/ont-check/ont-check.mjs` |      |
| `inv.doc-set-names-unique` | `tools/ont-check/ont-check.mjs`                            |      |

### Reference page

| ID                      | Implemented in                                                  | Note |
| ----------------------- | --------------------------------------------------------------- | ---- |
| `ent.reference-page`    | `tools/ont-check/docs.mjs`, `tools/ont-check/gen-reference.mjs` |      |
| `inv.reference-current` | `tools/ont-check/docs.mjs`, `tools/ont-check/gen-reference.mjs` |      |

### Profile

| ID                                | Implemented in     | Note                  |
| --------------------------------- | ------------------ | --------------------- |
| `ent.profile`                     | `docs/profiles.md` |                       |
| `rule.profile-requires-checkable` | `docs/profiles.md` | reviewed, not checked |

### Known divergences between code and ontology

None known.

## Retired IDs

IDs that had to change. The decision log keeps using them; everywhere else the check requires the new ID.

| Retired ID               | Replaced by           | Decision |
| ------------------------ | --------------------- | -------- |
| `rule.target-not-tuning` | `rule.number-by-role` | D-40     |

## Revision history

- 2026-10-28: what each target waits for and the next slice: `derived.readiness`, `derived.next-slice` and `rule.take-ready` (D-58).
- 2026-10-28: code names its concepts in `ont:` comments: `rule.code-names-concepts`, `inv.code-names-resolve` and `derived.named-in-code` (D-57).
- 2026-10-28: `rule.commit-finished-work`: every change ends with a commit of its own files; who approves a commit or a push is the user's choice (D-54).
- 2026-10-27: agent instructions name their sources: `rule.agent-rule-source`, `rule.departure-by-entry`, `inv.agent-rule-references-resolve` and `field.agent-rules.files`, with the approach's IDs copied with the tool, `concept.approach-ids` and `inv.approach-ids-current`; process entries depart from the approach with `field.decision.layer`, `edge.decision.extends`, `edge.decision.overrides` and `inv.departure-well-formed` (D-53).
- 2026-10-27: `derived.in-force` and `edge.decision.supersedes`: a tentative entry supersedes nothing until it is accepted (D-52).
- 2026-10-26: decision sources, `field.decision.source`, `rule.source-precedence` and `inv.sourced-since-first` (D-47); questions as tentative entries, `rule.question-as-tentative`, `action.answer-tentative` and `derived.waiting-for-owner` (D-48); deferrals, `field.decision.return-when`, `derived.deferral-in-force`, accepted ones only, and `rule.deferral-returns` (D-49); target concepts of a complete catalogue, `concept.completeness-axis`, `inv.axis-values-covered`, `rule.check-not-redundant` and `action.derive-blind` (D-50).
- 2026-10-26: target concepts of verification in two layers (D-44, tentative): `concept.ontology-layer`, `concept.product-layer`, the judged proof with `inv.judged-check-tested`, `rule.judge-sees-the-check` and `rule.verdict-kept`, `edge.test-suite.checks` with `inv.suite-implements-checks`, `ent.profile` with `rule.profile-requires-checkable`, `action.walk-blind`, `action.critique-change`, `derived.meaning-changed` and `inv.one-concept-per-term`.
- 2026-10-26: `rule.commit-finished-work`: the commit is local and holds the task's own changes; pushing needs the owner's permission (D-43).
- 2026-10-25: `rule.commit-finished-work`; the guard names accepted entries that are not committed yet (D-42).
- 2026-10-25: a doc set may cover checks by proof, `field.doc-set.checks`, for a run guide of manual checks; `rule.guide-runs-check` (D-41).
- 2026-10-25: `rule.number-by-role` replaces the rule on tuning toward a target, which is retired; `rule.chosen-value-checked`: a model's assumptions are held by a snapshot of its base scenario, never by a check that it reaches its goal (D-40).
- 2026-10-25: `inv.check-in-its-section` names the section's key, the code span in its heading or else its Latin letters and digits; `inv.section-keys-match` (D-39, tentative).
- 2026-10-24: an implementation row may claim several concepts, `edge.implementation-row.concept` is a list (D-38); `format-ontology.mjs` realises `rule.kind-order` and `inv.kind-named-once` (D-37).
- 2026-10-24: `derived.named-by` (D-36); `rule.chosen-value-checked` and a rule on tuning toward a target, retired by D-40 (D-35); `rule.unconfirmed-tentative` (D-34); a tentative entry is accepted with a line in History (D-33).
- 2026-10-23: `inv.divergence-names-concepts`, enforced by the check (D-31).
- 2026-10-23: `rule.partial-noted`: the note names the target concept that adds what is missing (D-29).
- 2026-10-23: `derived.slice-done` also waits for the slice's own divergences and for listed checks that need a concept outside it; `edge.ticket.checks` is the `Checks:` line (D-28). The ticket's sections the tool does not read are realised by part 8.
- 2026-10-22: `rule.findings-mislead`: what a consistency review reports (D-27).
- 2026-10-22: one question per entry; a later entry adds to an earlier one or supersedes it whole (D-26).
- 2026-10-22: supersession on a `Supersedes:` line, `derived.in-force` and `inv.supersedes-older` (D-25).
- 2026-10-22: a stamp covers the notes that name a concept, not only its row (D-23).
- 2026-10-22: `inv.doc-set-names-unique`, enforced by the check (D-22).
- 2026-10-22: the kind of a concept is one of the configured classes, not a fixed list, as part 1 and the tool already had it.
- 2026-10-22: the rules of the parts that lived only in `docs/` added, with manual checks for those the tool cannot enforce (D-20).
- 2026-10-22: first version, written from `docs/parts/` and the tool (D-19).
