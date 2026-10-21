# Decisions about this repository

The approach applied to itself: decisions about how the approach is described and packaged, in the same format as a product decision log. Entries are never edited; new entries supersede old ones.

## Accepted

### D-01 · The repository describes the approach, not the product it came from

- Date: 2026-10-17 · Status: accepted
- Decision: the documentation describes the approach in general terms. Examples use a fictional lending library. Nothing from the source project's ontology, decisions or interface is copied.
- Why: the source project's documents are private. A fictional domain everyone understands also keeps the reader's attention on the method rather than on an unfamiliar product.
- Rejected: an anonymized excerpt of the real ontology (still recognizable, and too product-specific to teach from); a toy domain with no time-based behavior (would hide the mockup's main blind spot).

### D-02 · The source project is not named for now

- Date: 2026-10-17 · Status: accepted
- Decision: the README says the approach emerged in a product project developed largely by coding agents, without naming it.
- Why: the product is not public. Naming it can be reconsidered when the repository is published.
- Rejected: naming it with a link (the repository is private); naming it without a link (deferred to publication).

### D-03 · English only

- Date: 2026-10-17 · Status: accepted
- Decision: all documents are in English.
- Why: the discussion of spec-driven development and all primary sources are in English, and the repository is meant to be published. Two languages would drift apart, which is the failure this approach exists to prevent.
- Rejected: Russian only (narrows the audience); both languages (double maintenance, guaranteed drift).

### D-04 · Description, templates and a generic check, all exercised by CI

- Date: 2026-10-17 · Status: accepted
- Decision: the repository ships the description, templates for every artifact and a generic, dependency-free version of the check. CI runs the check on the example and on the templates, and runs the check's own tests.
- Why: a check that runs on a worked example turns the claim "consistency is checked in both directions" into something a reader can try and break. Running it on the templates keeps the templates valid.
- Rejected: description only (claims without a demonstration); a published package (premature before a second real project has used it).

### D-05 · Proposed strengthening stays a proposal

- Date: 2026-10-17 · Status: accepted
- Decision: the improvements that came out of the comparison with SDD tools (tests linked to IDs, WHEN/THEN scenarios in tickets, not expanding the ontology ahead of code, contracts generated from fields) and from reading the check (one home per definition, guarding accepted decisions) are described in `docs/limitations.md` and are not implemented in the tool or the example.
- Why: none has been tried in a real project. Shipping them as part of the approach would present untested ideas as practice.
- Rejected: implementing tests-linked-to-IDs in the example now (would blur what is practiced and what is proposed).

### D-06 · "Concept-anchored" as the term for the category

- Date: 2026-10-17 · Status: accepted
- Decision: the approach is called "Ontology as Specification"; in the comparison it is placed as concept-anchored, a variant of Böckeler's spec-anchored level.
- Why: "ontology" is the word the practice used and is memorable; "concept-anchored" places it in the existing vocabulary and says what is anchored. The README explains that the ontology is semi-formal, not OWL or RDF.
- Rejected: "concept-anchored development" as the name (precise but forgettable); "ontology-driven development" (suggests generation from a formal model).

### D-07 · CC BY 4.0 for the text, MIT for the tool, templates and example

- Date: 2026-10-17 · Status: accepted
- Decision: `README.md`, `docs/` and `decisions.md` are licensed under CC BY 4.0. `tools/`, `templates/` and `example/` are licensed under MIT. Copyright holder: Jevgenijs Pavlenko.
- Why: the goal is for the approach to spread while authorship stays with its author. CC BY allows any reuse with attribution. Templates and the example exist to be copied into other repositories, and MIT puts no conditions on the copies beyond keeping the notice.
- Rejected: CC BY-SA for the text (copyleft on adaptations adds friction for companies and publishers and protects only the wording, since the approach itself can be retold in other words under any license); CC BY-NC (would stop consultants and companies from teaching and using it); Apache 2.0 for the tool (its patent grant is unnecessary for a small script); one license for everything (Creative Commons licenses are not recommended for software, and MIT fits prose poorly).

### D-08 · Tests linked to IDs, scenarios in tickets and the decision guard are implemented

- Date: 2026-10-21 · Status: accepted
- Decision: three of the six proposals in `docs/limitations.md` are implemented in the tool, the example and the templates, and D-05 no longer applies to them. Tests name the IDs they prove in a tag at the start of the title, and the check requires a test for every implemented concept of the configured classes. Tickets state expected behavior as one-line GIVEN/WHEN/THEN scenarios tagged with IDs, and the check validates them. `guard-decisions.mjs` fails a commit or a CI run that edits or removes an accepted decision entry. Not expanding the ontology ahead of code, generated contracts and one home per definition stay proposals under D-05.
- Why: the three are mechanical and small, and each closes a gap the limitations name: "implemented" without proof, acceptance criteria in prose, and a never-edit rule enforced by review only. The example is where they can be tried and broken before a real project. The documentation says they have not been used in a real project, so practice and proposal stay distinguishable.
- Rejected: Gherkin feature files (a second format and a runner for what fits in one tagged line); EARS sentences (they state requirements, while a scenario with data is what becomes a test); a separate file mapping tests to IDs (drifts from the tests it describes); guarding decisions in CI only (the pre-commit hook stops the edit before it is committed); implementing all six (the other three are open questions, not mechanics).

### D-09 · One definition table per entity, grouped by kind; changed IDs are retired, not deleted

- Date: 2026-10-21 · Status: accepted
- Decision: the ontology has one section per entity and one for screens. Each section is one table in which every concept is a row: kind, ID, term, definition. Rows are grouped by kind in the order of the configured classes, and the kind is written on the first row of each group. There is no separate glossary table; the definition rows are the glossary. Fields and relations name their entity in the ID (`field.loan.due-date`) and sit in its table. An ID that has to change moves to a "Retired IDs" table with its replacement, so the decision log resolves it without being edited. This implements "one home per definition", and D-05 no longer applies to it.
- Why: in the earlier layout a concept was defined in the glossary and explained again in a per-kind table, and the two drifted. Per-kind tables also scattered one entity over many sections, which is hard to read once there are many entities with many fields. The guard (D-08) made a rename impossible without a retired table: an accepted entry that uses an old ID cannot be edited, and the check would otherwise fail on it.
- Rejected: keeping the glossary and checking that explanatory rows agree with it (compares text, which the check cannot do reliably); per-kind tables sorted by entity (still two places for one entity's rules and fields); a subheading per kind inside each entity (many tiny tables); the entity in every ID (rules, invariants and actions often involve several entities); deleting old IDs and editing old decisions (breaks the never-edit rule the guard enforces).

### D-10 · "No concept without feedback" replaces "do not expand the ontology ahead of the code"

- Date: 2026-10-21 · Status: accepted
- Decision: the proposal to freeze the ontology until code catches up is replaced by a weaker rule: a concept arrives with something that will try it, a mockup element, a ticket or code. The check lists concepts with none of these as information, not as an error. The proposal to generate contracts from fields is restated as language-neutral (JSON Schema generated from typed field and relation rows) and stays a proposal under D-05.
- Why: the owner pointed out that the ontology running ahead of the code together with the mockup is normal: that is how a target is designed before it is built. The real cost is concepts that nothing has tried, which add review load without feedback. A list keeps them visible without blocking design work. Contracts must not tie the approach to an implementation language.
- Rejected: the freeze as originally proposed (blocks designing ahead in the mockup); an error instead of information (would push people to add placeholder tickets or mockup labels to silence it); dropping the proposal (loses the signal); contracts as TypeScript or another language's types (ties the approach to one stack).

### D-11 · Contracts generated from typed fields, in JSON Schema

- Date: 2026-10-21 · Status: accepted
- Decision: field and relation rows carry a Type cell in a neutral vocabulary (`text`, `integer` with bounds, `number`, `boolean`, `date`, `datetime`, `one of …`, `ref`/`refs` an entity, `optional`). `gen-contracts.mjs` generates a JSON Schema with one definition per entity and the concept ID on every property. The check requires a valid type on every field and relation, none on other kinds, and a current schema. How code follows the schema is left to each project. This implements the last proposal of D-05, restated in D-10.
- Why: the shape of stored data is the part of the ontology precise enough to generate from, and it is where agents most often invent names and values. A generated contract puts concept IDs where code can reach them, which narrows the weakness "code does not refer to IDs". JSON Schema keeps the approach independent of the implementation language, which the owner made a condition.
- Rejected: types of one language, such as TypeScript (ties the approach to a stack); a check that reads the code's own types (one parser per language); types in notes or in the definition text (not parseable without a second convention, and tooltips would show them); a type column on every table including screens (empty cells for kinds that have no shape).

## Open questions

- When to name the source project.

## History

- 2026-10-21: D-11: contracts generated from typed fields.
- 2026-10-21: D-10: no concept without feedback; contracts restated as language-neutral.
- 2026-10-21: D-09: one definition table per entity; retired IDs.
- 2026-10-21: D-08: tests linked to IDs, scenarios in tickets, decision guard.
- 2026-10-17: D-07: licenses.
- 2026-10-17: D-01…D-06.
