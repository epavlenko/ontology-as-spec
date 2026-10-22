# Decisions about this repository

The approach applied to itself: decisions about how the approach is described and packaged, in the same format as a product decision log. Entries are never edited. One entry answers one question; a later entry adds to an earlier one or supersedes it whole (D-26).

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

### D-12 · The accepted status is configurable, for logs in other languages

- Date: 2026-10-21 · Status: accepted
- Decision: the guard reads the line that marks an entry accepted from `decisions.accepted` in the config, a regex; the default stays `^- Date:.*Status:\s*accepted\b`. Nothing else about the log format changes.
- Why: the first project to adopt the approach keeps its decision log in another language, and the guard counted none of its entries as accepted, so it guarded nothing and said GUARD_OK. The entry heading and the reference were already configurable; the status was the one hardcoded English word.
- Rejected: a list of known translations in the tool (grows without end); requiring English status lines in every log (the log is written for the team, in its language).

### D-13 · Test suites per kind of concept, in the configuration, not in the ontology

- Date: 2026-10-22 · Status: accepted
- Decision: the check's configuration lists test suites under `testSuites`, each with a name, a directory, a file pattern and the classes whose implemented concepts it must prove. The check requires the tag in that suite and names the suite in what it reports. `--coverage` prints what proves each implemented concept, one column per suite and one for the scenarios. The older single `tests` key keeps working as one unnamed suite. The example has a unit suite for invariants, rules and derived values and an end-to-end suite, which runs the command line front end, for actions and views.
- Why: one test set could not say that an action proven only by a unit test was never tried the way a person uses it, or that a hook needs a test that controls time. Kinds of tests are the team's process, not the product's meaning: a different team could test the same product differently while the ontology stays the same. So the policy lives next to the check, and the ontology gains no test concepts.
- Rejected: test suites as concepts in the ontology (mixes process into meaning and would sit in the entity tables); a suite named per tag, such as `[e2e:action.renew]` (a second tag format, and the directory already says it); the key name "suites" (too generic in a configuration that also has scenarios); conversational test dialogs as the example's second suite (specific to chat products; end-to-end tests through the interface are the common case).

### D-14 · A check catalogue states what must hold, for any implementation

- Date: 2026-10-22 · Status: accepted
- Decision: what must hold is a catalogue of checks (`checks.md`): one section per entity, one row per check with an ID `check.<section>.<name>`, the concepts it proves, GIVEN, WHEN and THEN in the product's terms, and `auto` or `manual`. Every concept of a required class (invariants, rules, hooks and actions in the example) has a check, including concepts not built yet. Tests implement checks and start their title with the check's ID; every automatic check of implemented concepts needs a test. The catalogue replaces the verification map (`features/`) and the scenarios in tickets; the tool still reads both for existing projects. This supersedes the scenario part of D-08.
- Why: the ontology states a rule in a sentence and a test proves it in the terms of one implementation; between them nothing persistent held the cases. Ticket scenarios disappeared with the ticket, and the verification map repeated the tests as recipes nothing ran. A catalogue in the product's terms survives a rewrite of the code or of the tests, the same split behavior-driven development makes between scenarios and step definitions. The owner asked that the set of checks work for any implementation of both the code and the tests.
- Rejected: checks as rows in the ontology (examples with data would bury the definitions the entity tables exist to show); keeping ticket scenarios (lost when the ticket closes); keeping the verification map and renaming it (recipes that repeat tests rot; manual checks fit in the catalogue as `manual`); Gherkin feature files (a second format and a runner, while one table row per check is enough); generating tests from checks deterministically (binding a check to an implementation depends on the implementation; tests are written from checks the way code is written from the ontology).

### D-15 · The gap between target and implementation is computed

- Date: 2026-10-22 · Status: accepted
- Decision: `ont-check.mjs --gap` prints the work left by entity: concepts absent from the implementation table, with their checks; automatic checks of implemented concepts without a test; and the known divergences. Known divergences list only code that contradicts the target; what is simply not built yet is no longer written there.
- Why: the target ontology and the implementation table already hold the gap, so a hand-kept backlog of "target only" lines duplicates them and drifts. On its first run the report found a concept implemented in the example's code but missing from the table.
- Rejected: a generated backlog file in the repository (one more artifact to keep current; the report is cheap to run); keeping "target only" lines in the divergences (a second, hand-kept copy of the gap).

### D-16 · A ticket is a slice of the gap, done when the check says so

- Date: 2026-10-22 · Status: accepted
- Decision: a ticket for product work names the concepts (`IDs:`) and checks of the slice, why now, what is out of scope, what it depends on and what the agent may do. It no longer carries expected behavior, files to touch or a hand-written finish condition. The finish condition is derived: `ont-check.mjs --gap <ticket>` prints `SLICE_DONE` (every concept of the slice implemented, every automatic check of the slice tested) and the tests pass. The check requires that the checks a ticket lists exist and name at least one of its IDs. Work that does not change meaning stays an ordinary ticket.
- Why: with a target ontology and a check catalogue, a ticket that restates scope and behavior is a third copy of the same meaning. What only a ticket holds is process: which part now, in which order, within which limits, and, with an external contractor, what is delivered and accepted.
- Rejected: no tickets at all (loses the limits, the order, the unit of review and the permissions); tickets with their own scenarios (D-14 moved them to the catalogue); priority in the ontology (process, not meaning, as with test suites in D-13).

### D-17 · One decision is one choice, superseded whole

- Date: 2026-10-22 · Status: accepted
- Decision: a decision log entry records one choice that can be reversed on its own. Parts with different rejected alternatives, or with reasons that do not depend on each other, are separate entries. An entry is superseded whole; when only part of an older entry has to change, the new entries split it, and each supersedes it completely. The rule is written into part 2, the principles and the headers of every log, and the check reports, as information, an entry that supersedes only part of another. Entries accepted before this rule stay as they are, because they cannot be edited; they are split when they are next superseded.
- Why: this log already shows the cost. D-08 bundled three mechanisms, so D-14 had to supersede "the scenario part of D-08", and a reader now has to work out what of D-08 still holds. D-09 and D-10 also each record two choices. Separate entries keep every choice traceable to its own reason and its own replacement.
- Rejected: one entry per ticket or per change (groups choices by when they were made, not by what can be reversed); no rule, review only (the log above shows it does not hold); an error instead of information for partial supersession (the older entry cannot be fixed, so the error could never be cleared).

### D-18 · Documentation is written by hand, anchored to the ontology, and its reference pages are generated

- Date: 2026-10-22 · Status: accepted
- Decision: pages for people are written by people or agents. Each section names the concepts or checks it explains in an anchor readers do not see, `<!-- ont: id@stamp -->`. The configuration lists doc sets, each with the classes it must explain and whether it covers implemented concepts or all of them; the check reports concepts no page of a set explains, unknown or retired IDs in anchors, and, as information, sections anchored to a definition that changed after their stamp. `stamp-docs.mjs` writes the stamps after a section has been reread. Pages that only restate the ontology and the checks, such as a list of terms, are generated by `gen-reference.mjs` and compared whole. Doc sets are process and live in the configuration; help that is part of the product, a help screen or a bot's answer, is a concept in the ontology. This is part 9.
- Why: documentation describes the same product as the ontology and drifts from it like any other artifact. The interface and the code are already handled this way: written by hand, anchored to IDs, the mechanical part generated. The owner asked for documentation with the ontology as its source on the same footing.
- Rejected: generating the prose from the ontology (not deterministic; the approach keeps meaning by reference, not generation); IDs visible in the text (hurts the readers the pages are for); doc sets as concepts in the ontology (process, as with test suites in D-13); an error for a changed definition (a reread is a judgment the check cannot make, so it can only list what to reread).

### D-19 · The approach has its own ontology and check catalogue

- Date: 2026-10-22 · Status: accepted
- Decision: `ontology.md` and `checks.md` at the root describe the approach with itself: one section per entity of the approach (concept, retired ID, decision, implementation row, divergence, mockup element, map row, check, test, test suite, ticket, contract, doc section, doc set, reference page), with fields, relations, rules and invariants, and a check for every rule and invariant. A concept counts as implemented when it is realised: by the tool for what the tool enforces, by a page of `docs/` for rules people follow and procedures they carry out. Rules the tool cannot enforce have manual checks. The tests of the tool implement the automatic checks and carry their IDs. A root `ont.config.json` runs the check on it in the hook and in CI. The configuration gains `external`: ontologies and catalogues whose IDs may appear as examples, here the example and the templates, known but not this ontology's.
- Why: the rules of the approach lived in prose across `docs/`, the principles, the agent rules and the code of the check, and they had already drifted once (the lifecycle page told readers to edit old decisions after the guard forbade it). Described as an ontology, every rule has one row, the tool's tests say which rules they prove, and the manual checks list what nothing enforces. It is also the second project the approach runs on, which the limitations named as missing.
- Rejected: a separate repository for the approach's ontology (it would drift from the tool it describes); describing only what the tool enforces (hides the rules people must follow, which matter as much); no `external` key and renaming example IDs in quoted text (the decision log quotes example IDs in accepted entries that cannot be edited).

### D-20 · docs/ is a doc set of the approach's ontology; its reference is generated

- Date: 2026-10-22 · Status: accepted
- Decision: the rules, formats and the "what the check enforces" and "what it cannot enforce" lists of the parts are removed from `docs/`. Each of their rules became a row of the approach's ontology with a check; those the tool cannot enforce have manual checks, twenty-one of them added for this. `docs/` is a doc set of that ontology covering every entity, rule, invariant and action, its sections carry anchors, and `docs/reference.md` is generated from the ontology and the catalogue. Each part keeps what it is, why, how it works and how it fails, and ends with a Reference section that points to its entities in the reference. Anchors inside code, fenced or inline, are examples and are not read.
- Why: each rule of the approach was written in up to six places (a part, the principles, the agent rules, the lifecycle, a template, the code of the check), and they had drifted. The lists of what the check enforces were hand-kept copies of the code. Now a rule has one row, the reference is regenerated, the parts are checked against it, and the manual checks are the honest list of what nothing enforces.
- Rejected: generating the parts themselves (the explanations are why the parts exist); keeping the Rules sections next to the ontology (two homes again, the failure D-09 removed from product ontologies); moving only what the tool enforces (would drop the rules people follow, which the old sections held).

### D-21 · The approach's own files: text under CC BY 4.0, configuration and generated data under MIT

- Date: 2026-10-22 · Status: accepted
- Decision: the files added after D-07 get the license of their kind. `ontology.md`, `checks.md` and `AGENTS.md` are text and are licensed under CC BY 4.0, like `README.md`, `docs/` and `decisions.md`. The configuration (`ont.config.json`, `package.json`), the hook, the CI and the generated contract are licensed under MIT, like the tool. The contract moves from `docs/approach.schema.json` to `contracts/approach.schema.json`, so that nothing in `docs/` is licensed differently from what D-07 says. D-07 still holds for everything it names.
- Why: D-07 named the text, the tool, the templates and the example, and the repository has since gained files it does not cover. Text that people read and adapt fits CC BY; configuration and machine-readable data are used like code, and Creative Commons licenses are not recommended for software.
- Rejected: CC BY for the contract (it is consumed by tools, not read); leaving the contract in `docs/` under MIT (a file in `docs/` licensed against D-07, which would be a partial supersession); one license for everything (rejected in D-07 for the same reasons).

### D-22 · Doc set names are unique, and the check says so

- Date: 2026-10-22 · Status: accepted
- Decision: the check reports two doc sets with the same name, as it already does for test suites. The approach's ontology gets the invariant and its check.
- Why: the definition of a doc set already said its name is unique, but nothing enforced it, and two sets with one name merge their anchors in every report. Test suites had the rule and the check from the start; doc sets should not differ.
- Rejected: leaving it to review (the definition claimed a rule nothing held); deriving the name from the directory (two sets may share a directory with different file patterns).

### D-23 · A stamp covers the notes that name a concept, not only its row

- Date: 2026-10-22 · Status: accepted
- Decision: the stamp of a concept in a doc anchor is a hash of its term, type and definition and of the lines of notes in its section that name it in backticks. A changed note therefore lists the sections anchored to that concept as sections to reread, like a changed definition. Stamps written before this change are rewritten once with `stamp-docs.mjs` after the sections are reread.
- Why: notes carry detail a page relies on, such as who performs an action or which decision explains a rule. With only the row in the stamp, a changed note left a help page stale without any signal.
- Rejected: the whole section's notes in every stamp of the section (a note about one concept would list sections about all the others); notes as rows of their own with IDs (notes are detail, not concepts, and IDs for them would undo one home per definition).

### D-24 · No proposals are held back; D-05 is superseded

- Date: 2026-10-22 · Status: accepted
- Supersedes: D-05
- Decision: D-05 no longer holds. The six proposals it kept back are implemented (D-08 to D-11), and none is open. A new mechanism is recorded as a decision before it is implemented and listed in `docs/limitations.md` as not yet tried in a real project.
- Why: D-05 was replaced piece by piece, by D-08, D-09 and D-11, so the log still showed it as an accepted decision whose text is no longer true, and a reader had to assemble four later entries to learn that nothing of it remains. D-17 asks that an entry be superseded whole, by one entry.
- Rejected: leaving D-05 as it is (it reads as a rule in force); editing D-05 (accepted entries are never edited).

### D-25 · Supersession is written on a line of its own, and the check reads it

- Date: 2026-10-22 · Status: accepted
- Decision: an entry that replaces older ones names them on a line `- Supersedes: D-nn, D-nn`, each whole. The check requires that every entry named there exists and is older than the entry naming it. `ont-check.mjs --decisions` lists every entry of the log as in force, tentative or superseded, and by what. The hint about partial replacement now also reads "D-nn no longer applies", and it leaves out older entries that some entry supersedes whole, so it lists only bundled entries still waiting to be split. The line's pattern is configurable, like the accepted status (D-12).
- Why: supersession was written in prose, so the tool could not show which entries still hold, and the hint knew one phrase and missed the piecemeal replacement of D-05. The approach's ontology already had the relation, `edge.decision.supersedes`; it now has a place in the text that a tool can read.
- Rejected: a "superseded" status written into the old entry (accepted entries are never edited); inferring supersession from prose alone (phrasings vary; the line is the record, the hint only information); a generated page of decisions in force (a report on demand is enough while logs are small).

### D-26 · One entry answers one question; a later entry adds to it or supersedes it whole

- Date: 2026-10-22 · Status: accepted
- Supersedes: D-17
- Decision: a decision log entry answers one question, and the parts of one answer stay together: what was chosen, how it works and its direct consequences. A later entry may add to an earlier one without changing anything in it; both stay in force. A later entry that contradicts any part of an earlier one supersedes it whole, names it on its `Supersedes:` line and restates what of it still holds. Older entries that answer several questions are split when they are next superseded. What still holds of D-17: the rule is written into part 2, the principles and the headers of every log, and the check reports, as information, entries replaced only in part, as D-25 extended it.
- Why: D-17's test, a choice that can be reversed on its own, splits almost any decision about a mechanism into pieces. Read literally, it called for ten new entries that would restate D-18, D-19 and D-25 without adding a reason. The failure D-17 was written against is narrower: an entry changed in part, so that a reader cannot tell what of it still holds.
- Rejected: keeping D-17's test (it makes reviews pedantic and the log longer without making it clearer); allowing a later entry to change part of an earlier one with a pointer to that part (the reader still has to merge two texts to know what holds).

## Tentative

None.

## Open questions

- When to name the source project.

## History

- 2026-10-22: D-26: one question per entry; D-17 superseded.
- 2026-10-22: D-25: supersession on a line of its own.
- 2026-10-22: D-24: D-05 superseded whole.
- 2026-10-22: D-23: stamps cover notes.
- 2026-10-22: D-22: unique doc set names.
- 2026-10-22: D-21: licenses of the approach's own files.
- 2026-10-22: D-20: docs/ as a doc set of the approach's ontology.
- 2026-10-22: D-19: the approach's own ontology.
- 2026-10-22: D-18: documentation anchored to the ontology.
- 2026-10-22: D-17: one decision, one choice.
- 2026-10-22: D-14: check catalogue. D-15: computed gap. D-16: tickets as slices.
- 2026-10-22: D-13: test suites per kind of concept.
- 2026-10-21: D-12: configurable accepted status.
- 2026-10-21: D-11: contracts generated from typed fields.
- 2026-10-21: D-10: no concept without feedback; contracts restated as language-neutral.
- 2026-10-21: D-09: one definition table per entity; retired IDs.
- 2026-10-21: D-08: tests linked to IDs, scenarios in tickets, decision guard.
- 2026-10-17: D-07: licenses.
- 2026-10-17: D-01…D-06.
