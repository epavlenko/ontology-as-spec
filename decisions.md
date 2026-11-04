# Decisions about this repository

The approach applied to itself: decisions about how the approach is described and packaged, in the same format as a product decision log. Entries are never edited. One entry answers one question; a later entry adds to an earlier one or supersedes it whole (D-26). History lists only what the entries do not show (D-33). From D-47 on, every accepted entry names its source.

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

### D-27 · A consistency review reports what would mislead or break, not every imperfection

- Date: 2026-10-22 · Status: accepted
- Decision: a consistency review of a project made with the approach reports what would mislead a reader or an agent, or would break a check. Style, the completeness of lists and compliance with a rule that changes nothing are not findings. The rule is in the agent rules (part 7, the template, the example, this repository's `AGENTS.md`) and in the approach's ontology with a manual check.
- Why: a review of this repository listed nine findings, and half of them misled no one: a missing table row, a link that could cite a newer decision, a hook trigger the check would not use. Lists like that cost the owner's attention and teach agents that review output is noise. The check itself already has the same boundary: it keeps to references between artifacts and does not grow into a linter of style.
- Rejected: a severity scale for findings (agents rank everything as medium); leaving it to judgment without a written rule (the next agent repeats the long list).

### D-28 · A ticket stays open while a divergence of its own remains or a check it lists waits

- Date: 2026-10-23 · Status: accepted
- Supersedes: D-16
- Decision: `ont-check.mjs --gap <ticket>` prints `SLICE_DONE` only when nothing of the slice is left: every concept of the slice is implemented, every automatic check of the slice is tested, no automatic check the ticket lists waits for a concept outside the slice, and no known divergence names only concepts of the slice. A waiting check is printed with the concepts it waits for. A divergence that also names concepts outside the slice is printed apart and does not keep the ticket open. The checks a ticket lists are those on its `Checks:` line; a check named elsewhere in the ticket, such as under out of scope, must exist but is not part of the slice. What still holds of D-16: a ticket for product work names the concepts (`IDs:`) and the checks of the slice, why now, what is out of scope, what it depends on and what the agent may do; it carries no expected behavior, no files to touch and no hand-written finish condition; the finish condition is `SLICE_DONE` and passing tests; the check requires that the checks a ticket lists exist and name at least one of its IDs; work that does not change meaning stays an ordinary ticket.
- Why: D-16 counted only what is missing, a concept outside the implementation table or an automatic check without a test. A slice that brings code back to the target has nothing missing once its rows and tests exist: in the example, #4 Suspend borrowing instead of fines printed `SLICE_DONE` with its line under known divergences still in place. A check the ticket listed dropped out of the count when it also needed a concept of another slice, so the ticket closed without it. And a check named under out of scope counted as one the ticket lists.
- Rejected: keeping the ticket open for every divergence that names any of its concepts (a line that spans two slices would hold the first one open for work outside it); matching a divergence to its ticket by the ticket's number in the line (a second link to keep current, while both already name the concepts, and tickets kept in a tracker have no file to match); refusing a listed check that needs a concept outside the slice (a slice that depends on another may list it; it should wait, not fail); reading checks anywhere in the ticket (out of scope and notes name checks too).

### D-29 · What a partial implementation leaves out is a target concept, not only a note

- Date: 2026-10-23 · Status: accepted
- Decision: when an implementation row is partial, its note names the target concept that will add what is missing. If no concept covers the missing part, one is added like any other, with a check when its class needs one. `--gap` then lists the missing part as target, with its checks, and a ticket can take it. This adds to D-15, which still holds.
- Why: `--gap` reads only the implementation table, so a concept with a row counts as built whatever its note says. In the example, the target has staff set a member's borrow limit, and the row said "fixed at 5, staff cannot change it": the work existed only in a note, and neither `--gap` nor a ticket would ever show it.
- Rejected: a partial status in the implementation table that `--gap` counts (a third state to keep current, and the note would still have to say what is missing); reading the note column (free text); recording the shortfall as a divergence (the code does not contradict the target, it stops short of it, and D-15 keeps divergences for contradictions).

### D-30 · The heading of known divergences is configurable

- Date: 2026-10-23 · Status: accepted
- Decision: `--gap` reads the known divergences under the heading that `headings.divergences` in the configuration names, matched at the start of a line. The default stays `### Known divergences`.
- Why: the heading was written into the tool in English. In an ontology written in another language, `--gap` showed no divergences and did not say so, and since D-28 a ticket would also close with its divergence still open. The headings of the implementation table and of retired IDs were already configurable, and D-12 made the accepted status configurable for the same reason.
- Rejected: requiring the English heading (the ontology is written for the team, in its language); an error when the heading is missing (an ontology has no divergences before there is code).

### D-31 · A known divergence names its concepts, and the check requires it

- Date: 2026-10-23 · Status: accepted
- Decision: the check fails on a line under known divergences that names no concept of the ontology by ID, in backticks. The approach's ontology gets the invariant `inv.divergence-names-concepts` and its check.
- Why: since D-28, `--gap` matches a divergence to a ticket by the IDs the line names. A line without IDs belonged to no slice: `--gap` with a ticket never showed it, and the ticket could close while the line stood. Part 3 and the lifecycle already said that a line names the IDs involved, but nothing enforced it.
- Rejected: information instead of an error (the line is fixed by naming the concepts, and until then the gap of every ticket is wrong); counting a line without IDs against every ticket (it would keep every slice open); matching the ticket's number written in the line (rejected in D-28).

### D-32 · Before the first commit the guard says it is off instead of failing

- Date: 2026-10-24 · Status: accepted
- Decision: when no `--base` is given and the repository has no commit yet, or is not a git repository, `guard-decisions.mjs` prints `GUARD_OFF`, says that accepted entries are not protected until the first commit, and exits 0. A `--base` that is given and not found stays an error. The advice to write a superseding entry is printed only when an entry was edited or removed.
- Why: a project that adopted the approach worked for a day without a commit, because agents there commit only when asked. On every run the guard failed with "commit HEAD not found" and advice about editing entries that nobody had edited, so the failure read as noise. Before the first commit the guard cannot protect anything; it can say so plainly.
- Rejected: failing as before (a failure without a violation teaches people to ignore the guard); passing with `GUARD_OK` (claims a protection that does not exist); a copy of the accepted entries kept outside git (a second record to keep current, for a state that ends with the first commit).

### D-33 · The decision log's History lists only what the entries do not show

- Date: 2026-10-24 · Status: accepted
- Decision: the History section of a decision log lists the events that have no entry of their own: the log created, a tentative entry accepted. A new entry needs no History line, because it carries its own date and `--decisions` lists every entry. A tentative entry is accepted by changing its status and adding a History line. Lines written before this rule stay. The ontology's revision history does not change.
- Why: every decision was written down three times: as the entry, as a line in the ontology's revision history and as a line in the log's History, which repeated the entry's title and date. A project that adopted the approach counted the two history lines among the six places one small change touched.
- Rejected: generating History from the entries (a generated section inside a hand-written file, while `--decisions` already lists them); dropping the ontology's revision history instead (it records changes of meaning that have no entry); dropping History altogether (the log would have no place for the events that are not entries).

### D-34 · A choice the owner has not approved is tentative

- Date: 2026-10-24 · Status: accepted
- Decision: an entry whose choice the owner has not explicitly approved, such as a value an agent picked after being asked to tune the model, is recorded as tentative, and the owner's approval accepts it (D-33). The rule is in part 2 and in the agent rules, with a manual check. Entries get no separate field for who decided.
- Why: in a project that adopted the approach, an agent recorded every entry as accepted, including values it had chosen itself. The log looked more agreed than it was. The tentative status already means a course that may change without a new entry, and `--decisions` already lists tentative entries, so the owner gets a list to review without a new mechanism.
- Rejected: a "proposed by, approved by" field (a second way to say what the status says, and an accepted entry, which is never edited, could not record a later approval); leaving it to the agent's judgment (that judgment produced the problem).

### D-35 · A value a decision chose is held by a check, and tuning toward a recorded target needs no entry

- Date: 2026-10-24 · Status: accepted
- Decision: a value or a target that a decision chose, such as a default, a price or the result a model must reach, is held by an automatic check, so that a later change cannot drop it unnoticed. When values are tuned toward a target, the log records the target and why, and a check holds the target; tuning that keeps the check passing needs no new entry. A value gets an entry of its own, short and about that value alone, when its choice has a reason someone could dispute, such as a price set by a market corridor. The approach's ontology gets two rules, one for checks and one for the log, each with a manual check.
- Why: in a project that adopted the approach, the defaults of a model (prices, conversions, meetings a month) were the main result of two decisions, and no check held them: a later edit could drop the model below its target with every test passing. The same values sat inside a long entry about the structure of the offer, so changing one price meant superseding the whole entry and restating it (D-26), and an entry still in force quoted the old prices.
- Rejected: an entry for every change of a default (the log turns into a changelog, and every number lives in two places); keeping defaults out of the log entirely (their reasons, such as a market corridor, would be lost); a check for every default (pins numbers nobody decided and makes tuning a chore; the target is what was decided).

### D-36 · `--decisions` shows which later entries name each entry

- Date: 2026-10-24 · Status: accepted
- Decision: `ont-check.mjs --decisions` gains a column with the later entries that mention each entry by its number. The approach's ontology gets `derived.named-by` and its check. The hint about partial replacement stays as it is.
- Why: a reader of an older entry could not see that a later one changed what it describes unless the later one superseded it. The hint that catches partial replacement knows English phrases only, so in a log in another language it never fires. Numbers are the same in every language, and the column shows where to look without letting an entry be changed in part, which D-26 rejected.
- Rejected: a "refined in D-nn" line in the older entry (accepted entries are never edited); configurable phrases for the hint (every log would list its own phrasings, and they would still miss prose); listing the mentions on every run of the check (most mentions are ordinary references, so the list would be noise).

### D-37 · A formatter writes the kind order, the Kind cells and the alignment of definition tables

- Date: 2026-10-24 · Status: accepted
- Decision: `format-ontology.mjs` puts the definition rows of every table in the order of the configured classes, writes the kind on the first row of each group and clears it on the rest, and aligns the columns of those tables. The text and the other tables stay as they are. The check still reports rows out of order and wrong Kind cells, and its message names the formatter.
- Why: both rules follow from the IDs and the configuration, yet each cost an agent a run of the check and an edit; a project that adopted the approach counted them as iterations that add no meaning. The rules help readers, so they stay, and the tool that already knows them writes them.
- Rejected: dropping the rules (tables would differ from entity to entity); letting `ont-check.mjs` rewrite the file (a check that changes what it checks hides the drift it reports); formatting every table of the file (the other tables have no format rule of the check, and rewriting them would change files for nothing).

### D-38 · Concepts realised in the same files may share an implementation row

- Date: 2026-10-24 · Status: accepted
- Decision: the first cell of an implementation row may list several IDs, ``| `a`, `b` | `path` | note |``, and each of them counts as implemented in those files. A concept realised only in part keeps a row of its own, whose note names the target concept that adds what is missing (D-29). `edge.implementation-row.concept` becomes a list.
- Why: in a project where every concept was built in the same two files, the table had 164 rows repeating the same paths. Deriving the table from the IDs mentioned in code was suggested instead, but there 13 of the 164 built concepts are not mentioned in the code at all, and a mention is not an implementation. A shared row keeps the claim explicit and the table short.
- Rejected: deriving the table from the code (both reasons above); an empty Files cell (the claim would lose where to look); one row per entity (an entity often has concepts in different files and in different states).

### D-39 · A section heading in another language carries its key in a code span

- Date: 2026-10-25 · Status: accepted
- Decision: the key of an ontology or catalogue section, which a check's ID names and by which `--gap` and the reference pages place the checks of an entity, is the code span in its heading when there is one, ``## Préstamo `loan` ``, and otherwise the heading's Latin letters and digits in lowercase, joined by hyphens. A key written in a heading is one code span of lowercase letters, digits and hyphens. The check requires that each ontology section with definition rows has a key of its own and that every catalogue section's key names one of them, and it reports a heading whose code span is not such a key. `--gap` and the reference pages list each check once, and `--gap` lists a check whose key names no section apart instead of leaving it out. Headings without a code span keep their key. A heading that carried a code span as formatting takes it as its key now; to keep the old key, write that key in the span, ``## Loan `loan-renewal` ``. The approach's ontology gets `inv.section-keys-match` and its checks.
- Why: the key kept only the Latin letters and digits of the heading. A project that writes its ontology in Russian got an empty key for most sections, and two headings that share a Latin word got the same key ("Loan" and "Состояние Loan" both give `loan`), so a check could not name its section, and `--gap` could not list a check that waits or has no test under its entity. Since D-28 a ticket could then close while a check it lists still waits. Two reviews of the first version of this entry found that a key written in one file and not in the other still let such a ticket close without a word, and that two sections with one key counted a check twice; the check now refuses both. D-12 and D-30 fixed the same kind of gap for the accepted status and the divergences heading.
- Rejected: transliterating the heading (long, unstable IDs that change when the heading is reworded); the entity's ID as the key (sections such as Screens have no entity); a key in the configuration per heading (a second place to keep in step with the headings); taking any code span as it is (two spans, or one with capitals or spaces, gave keys nobody wrote); placing checks by the concepts they name (a check names concepts of several entities).

### D-40 · A number is held as its role needs: a rule's value and a requirement by a check, a model's assumptions by a snapshot and an entry per change

- Date: 2026-10-25 · Status: accepted
- Supersedes: D-35
- Decision: how a number is held depends on the role it plays, and a project says which role its numbers play, in its ontology or its agent rules.
  - The value of a product rule, such as a loan period of 21 days, sits in the rule's definition and is held by its check; changing it is a decision.
  - A target that is a requirement on the product, such as a page that opens within two seconds, is held by a check; settings tuned to meet it need no entry.
  - The assumptions of a model whose results inform people, such as the prices and conversion rates of a business model, make up its base scenario. Each change of them is a short entry about one topic, tentative when an agent chose the values (D-34). A check holds a snapshot of the base scenario's results, so that an unintended change fails and an intended one updates the snapshot together with its entry. No check requires the model to reach its goal: whether it does is what the model shows.
  - Data that people edit in the product, such as the prices in a shop's catalogue, stays out of the log.
  What still holds of D-35: a value a decision chose is held by an automatic check; a value with a reason of its own gets a short entry about that value alone, so that changing it later supersedes that entry and not a long one about the structure of an offer. The approach's ontology retires `rule.target-not-tuning` for `rule.number-by-role`, and `rule.chosen-value-checked` says what holds a model.
- Why: D-35 let a check hold a model's target and let values be tuned toward it without entries. In a model whose purpose is to show the gap between what is needed and what is real, that check turns an honest gap into a failing test, and the way to make it pass is to tune the assumptions until the model shows what one hoped for. Tuning without entries also hides from the people who agreed on the base scenario that it changed and who changed it. What D-35 said is right for requirements, where the target is what the product must meet, and wrong for a model's goal, which is the question the model answers.
- Rejected: keeping D-35 (the failure above); an entry for every change of every number (settings tuned toward a requirement would fill the log); a register of assumptions edited in place (a new format, and the reasons for past values would survive only in version control).

### D-41 · Manual checks are run from a run guide, a doc set that covers them

- Date: 2026-10-25 · Status: accepted
- Decision: how to run a manual check is written in a run guide: a doc set (D-18) whose sections anchor the checks they explain, with where to start, the steps and what shows after each, what to keep as evidence and the traps a run gets lost in. A section names its checks by ID and does not restate their GIVEN, WHEN and THEN. A doc set may list `checks: ["manual"]`: within its scope, every manual check whose concepts are implemented, or every manual check with scope all, must be named in one of its anchors, and the check reports one that is not. The catalogue gains no column and the approach's ontology no entity; it gains `field.doc-set.checks`, `rule.guide-runs-check` and their checks. This adds to D-14 and D-18, which still hold.
- Why: D-14 replaced the verification map with the catalogue and rejected keeping the map, because its recipes repeated tests, and said that a manual check fits in the catalogue. Its case does, in the product's terms; how to run it does not, and it had no other place, while an automatic check has its test. A project that adopted the approach kept its map for this reason, cut it down to paths, locators, evidence and traps, and anchored it as a doc set. The one thing it could not say is that every manual check has a way to be run, so a manual check without one was a hole nothing reported.
- Rejected: a column or a link in the catalogue (paths and locators in a catalogue written in the product's terms, and a second link kept by hand, while the guide's anchor already names the check); a sentence in part 6 alone (the hole would stay unreported); a guide for every view, action and hook (completeness that tells nobody anything where a test already proves them); a new kind of artifact (a doc set already has anchors, coverage and stamps).

### D-42 · Finished work is committed where the repository allows it, and the guard names what is not yet protected

- Date: 2026-10-25 · Status: accepted
- Decision: a finished task, its checks passing, ends with a commit where the repository's rules let agents commit; where they do not, the agent tells the owner which accepted entries are not protected yet. The guard lists, as information, accepted entries that the commit it compares with does not have. Projects run the guard in their test command, so that this list and `GUARD_OFF` show on every run; the approach's own `npm test` does. The protocol does not ask for a commit after every change. The approach's ontology gets `rule.commit-finished-work` with a manual check, and the guard's list has an automatic one.
- Why: the guard protects only entries that are in a commit. A project that adopted the approach asked whether agents should commit after every change. That would fight owners who let agents commit only when asked, and a commit in the middle of a change records a state whose checks fail. What the guard needs is narrower: accepted entries reach a commit soon after they are accepted, and until then someone knows they are not protected.
- Rejected: a commit after every change (it conflicts with repositories that leave commits to the owner, and it records half-done states); leaving it unsaid (new accepted entries stay editable without anyone noticing); failing the guard on accepted entries that are not committed yet (every new entry would fail until its commit, which is the normal course).

### D-43 · The commit that ends a task is local; pushing needs the owner's permission

- Date: 2026-10-26 · Status: accepted
- Decision: the commit that ends a finished task (D-42) is a local commit of the task's own changes. The guard compares with it, and nothing leaves the machine. Pushing it, or publishing anything, needs the owner's explicit permission, given in the task or by the owner directly. `rule.commit-finished-work` says so. D-42 still holds; this adds to it.
- Why: the guard needs a commit, not a push, so an owner who keeps publishing for themselves can let agents commit without letting them publish. The owner of several projects that use the approach decided exactly that. Only the task's own changes go into the commit, because several agents may work in one checkout.
- Rejected: pushing at the end of every task (publishing reaches other people and is the owner's to decide); one permission for committing and pushing together (an owner who withholds pushes would also withhold the local commit the guard needs); committing everything in the working tree (it would take in another agent's unfinished work).

### D-44 · Verification has two layers, and product checks follow from the ontology through profiles written as recipes

- Date: 2026-10-26 · Status: accepted
- Source: the owner's answer of 2026-10-28, which accepted it whole.
- Decision:
  - Verification has two layers. The ontology layer is what the tool checks in any project: structure, references, decisions, coverage and the gap. The product layer is what a project's catalogue and tests check: the product that agents build from the ontology. In this repository the tool's own tests are the product layer of the tool and implement checks that are the ontology layer of every other project.
  - Product checks are bound to the ontology one way. A concept's class says which suite must prove it (D-13), and a suite may also name checks it must implement (`edge.test-suite.checks`). A check's proof says how: `auto`, `judged` or `manual`. The proof says where the result is kept. The tool checks the class, the suite and the proof; where a verdict or evidence is kept is a rule for people (`rule.verdict-kept`, `rule.manual-evidence-kept`).
  - A judged check is run by a test, and a model judges the output against its THEN without seeing the code. Judged checks are automatic: they count wherever automatic checks do, in the gap, in a finished slice and in a check a ticket waits for. The suite that runs judged checks names them: a product's ontology gains no marker for generated values, and the tool cannot tell a generated value from another. The judged proof changes the proofs D-14 allowed, `auto` or `manual`; the entry that builds it supersedes D-14 whole.
  - A profile is a recipe in the documentation for a property of the product. It has no configuration key and no check of its own: what it requires must be checkable through the configuration and the catalogue, and the rest is a recommendation. The profiles for now are model output and interface; the recipe for model and data scenarios is D-40.
  - The profiles recommend two procedures: a blind walk of the product before a release (`action.walk-blind`), which turns behavior that contradicts the target into a known divergence and a missing case into a check, and an independent critic for changes of rules, mechanisms and risky code (`action.critique-change`). How often a project runs its costly suites is its own choice.
  - The ontology layer gains two checks: a guard that names a definition changed without a decision entry or a history line (`derived.meaning-changed`), and information on two concepts that share a term (`inv.one-concept-per-term`).
  - All of these are target concepts in the approach's ontology, described on a draft page of `docs/`: `concept.ontology-layer`, `concept.product-layer`, `edge.test-suite.checks`, `inv.suite-implements-checks`, `inv.judged-check-tested`, `rule.judge-sees-the-check`, `rule.verdict-kept`, `ent.profile`, `rule.profile-requires-checkable`, `action.walk-blind`, `action.critique-change`, `derived.meaning-changed` and `inv.one-concept-per-term`. Each mechanism is built under a decision of its own.
- Why: four projects on the protocol each reinvented part of verifying their product: an ad hoc browser run, a run-guide skill, manual checks of extracted claims, a manual check of a model's verdicts. An outside team's practice showed the cost of proofs that nothing ties to the specification: a key scenario proven only offline, tasks merged while their checks failed. The ontology already shows which properties a product has, so the proofs can follow from it instead of being invented in every project. Writing the proposal as target concepts first showed what its first draft missed. Nothing in a product's ontology tells a generated value apart, so the suite has to name the judged checks. Where a result is kept cannot be checked by the tool. And a strict rule of unique terms would have found eight terms shared by twelve pairs in the approach's own ontology, all legitimate, and a refined rule still three, so shared terms are information. An independent review of the model added that judged checks must count wherever automatic ones do, that the definitions of a well-formed check and of a doc set's checks had kept two proofs, and that a blind walk must not turn what is simply not built into divergences.
- Rejected: a `profiles` key in the configuration (a second way to say what suites and doc sets already say); a marker for generated values in every product ontology (a new convention in every project, while the suite can name its checks); requiring a quality-assurance methodology of every project (rules the tool cannot check, which D-27 treats as noise); a live-service profile now (no project on the protocol needs it yet); shared terms as an error (twelve false alarms in this repository's own ontology, three of them left by the refined rule).

### D-45 · The source project is not named, also after publication

- Date: 2026-10-26 · Status: accepted
- Decision: the repository does not name the project the approach came from, also once the repository is public. The README keeps saying that the approach took shape in a product project developed largely by coding agents. This answers the question D-02 left for publication, and the open question "When to name the source project" closes. D-02 still holds; this adds to it.
- Why: the product is not public, so its name would give a reader nothing to open or check. What a reader can check is the approach itself: the example, the tool and its tests. A name would also draw questions to a product this repository does not document (D-01).
- Rejected: naming it with a link (the product is not public); naming it without a link (a name the reader cannot follow adds nothing they can check); keeping the question open until the product is public (a question that waits for an outside event stays open for months, and a new entry can name the product then).

### D-46 · The repository is published as an early version, and outside contributions are not accepted yet

- Date: 2026-10-26 · Status: accepted
- Decision: when the repository becomes public, it is published as an early version in active development, and the commit published is tagged `v0.1`. The README opens with the status and where to start, and says that pull requests are not accepted yet; questions and reports of errors are welcome as GitHub issues. Accepting outside contributions is a later decision.
- Why: the rules change every few days; D-28 to D-44 were written in four days. A reader who arrives from a link should see at once that the approach is early and where to begin, and a tag gives readers a fixed version to cite. Reviewing outside contributions takes time the approach itself needs, and while the rules move this fast a patch would be outdated before it was reviewed.
- Rejected: publishing without a status (a reader takes a moving draft for a settled method); waiting until a team outside the author's projects has used the approach (the approach is useful to readers now, and an outside team is more likely to try a public repository); accepting pull requests from the start (no process to review them yet, and the rules change faster than a review would take).

### D-47 · An entry names its source, and sources rank by who said it and when

- Date: 2026-10-26 · Status: accepted
- Source: the owner's answer of 2026-10-26 to question 146, which mechanisms to take from an outside team's process.
- Decision: an entry names where the decision was made, on a line of its own, `- Source:`: a call with the time of the passage, a message with its date, the owner's answer to a question, or a document by its path and section. When the sources of one decision disagree, the entry follows the one that ranks highest and names it: the owner's latest explicit statement, then the owner's earlier statements, then the project's documents, then answers others gave for the owner. An entry that rests only on the last is tentative until the owner confirms it (D-34). Once a log names a source, every entry accepted after that names its own: the guard fails on an entry accepted since its base commit without one, whether it is new or was tentative. The pattern of the line is configurable as `decisions.source`. The approach's ontology gains `field.decision.source`, `rule.source-precedence` and `inv.sourced-since-first` with their checks, and this log names sources from this entry on.
- Why: an entry that does not say where it was decided cannot be checked against its origin. A reader who doubts it does not know whom to ask or which call to replay, and an agent cannot tell the owner's decision from a colleague's guess. An outside team kept the source of every decision, and a written order between the owner's latest decisions, the owner's earlier answers, the documents and answers others gave for the owner; it settled conflicts between its documents by that order instead of asking again. Requiring the line only from the first source on lets a log adopt it without editing accepted entries, which the guard forbids. The guard enforces it rather than the check, because only the guard knows which entries were accepted since its base.
- Rejected: a source on every accepted entry (every existing log would fail, and its accepted entries cannot be edited to add one); the source inside the Why line (neither a reader nor the guard finds it there); ranking sources by medium, a call over a message or the reverse (what decides is who said it and when); line numbers as references to a document (they shift with every edit).

### D-48 · A question with a recommendation is a tentative entry, and the owner's answer accepts it

- Date: 2026-10-26 · Status: accepted
- Source: the owner's answer of 2026-10-26 to question 146, which mechanisms to take from an outside team's process.
- Decision: a question that has options and a recommendation is written at once as a tentative entry: the recommendation is its decision, the other options are its rejected alternatives with their reasons, and the reasons for the recommendation are its why. Open questions keep only questions nobody can recommend an answer to yet. The owner answers the entry. Taking the recommendation accepts it as it stands; picking another option rewrites it to that option and accepts it; dropping the question removes it, and History says so. An accepted entry names the answer on its Source line (D-47), and History records the acceptance (D-33). The check lists the tentative entries on every run, as information. This adds to D-34, which still holds; the approach's ontology gains `rule.question-as-tentative`, `action.answer-tentative` and `derived.waiting-for-owner`.
- Why: D-34 gave the log a status for what the owner has not approved, but no way from a question to that status. A question waited under Open questions while its analysis stayed in a chat, and the owner had to rebuild the options to answer it. An outside team put its questions to the owner with options and a proposed answer, and the answers became entries directly. Writing the recommendation as a tentative entry keeps the analysis in the log, lets agents work with the recommended course in the meantime, and turns the answer into a change of status rather than new writing. The list on every run keeps a waiting question in sight.
- Rejected: keeping such questions under Open questions until they are answered (the analysis is lost, and nobody works from the recommendation); an entry per option (several entries for one question, against D-26); accepting an entry the owner has not answered after a deadline (an approval the owner did not give, against D-34); a separate list of recommendations (a third place to look besides the entries and the open questions).

### D-49 · What is put off is put off by an entry that says when to take it up again

- Date: 2026-10-26 · Status: accepted
- Source: the owner's answer of 2026-10-26 to question 146, which mechanisms to take from an outside team's process.
- Decision: a target concept, a mechanism or anything left out of scope is put off by an entry, a deferral, that names on a line of its own, `- Return when:`, what must happen before it is taken up again. The deferral stays in force until an entry supersedes it: one that builds the thing, drops it or defers it again with another condition. The check lists the deferrals in force with their conditions on every run, as information; whether a condition holds, people judge. Work left for another slice is not deferred: the gap keeps it. The pattern of the line is configurable as `decisions.returnWhen`. The approach's ontology gains `field.decision.return-when`, `derived.deferral-in-force` and `rule.deferral-returns`.
- Why: a goal put off without a condition is forgotten or reopened at random. Target concepts stay in the gap, but nothing said when one that was put off should come back, and what is out of scope and not in the ontology had no place at all. An outside team kept every deferral with its reason and the trigger that brings it back, and a sweep found none untracked. The condition belongs to the decision to put something off, so it goes into the log next to the reason.
- Rejected: a list of deferred items apart from the log (a second record of decisions, with no history and no guard); a date instead of a condition (a date passes whether or not anything changed; a condition may still be a date where the date is what matters); marking deferred concepts in the ontology (the ontology says what the product is; why and until when something waits is a decision); failing the check when a condition holds (the tool cannot tell).

### D-50 · A catalogue is complete when every value of every axis has a check, and a blind derivation tests that it suffices

- Date: 2026-10-26 · Status: accepted
- Source: the owner's answer of 2026-10-26 to question 146, which mechanisms to take from an outside team's process.
- Decision: the completeness of a check catalogue is measured by forks, not by the number of checks: axes along which behavior diverges, each with its values. Every action has the outcome axis: success, refusal, empty, error and silence; a project may add axes of its own. Every value of every axis is covered by a check, and each action's outcomes by its own checks, unless the catalogue says why a value cannot occur. Two checks whose cases differ only in data are one. Whether the catalogue suffices is tested by a blind derivation: someone who sees only the ontology and the catalogue says what should happen in a case the catalogue does not hold, and a mismatch with the owner's answer adds a check, or an open question when the owner does not know. Until judged checks exist, the owner compares; with them, a model derives and a judge compares its answer with the owner's answers, kept outside the catalogue. All of it is target: `concept.completeness-axis`, `inv.axis-values-covered`, `rule.check-not-redundant` and `action.derive-blind`, explained on the draft page. It is built together with judged checks under a decision of its own, which also decides how a check names the value it covers.
- Why: the check requires a check per concept, and nothing asks whether an action's checks cover its forks: a renewal checked only for success says nothing about the refusal that matters most. The owner's own method for a set of example dialogues measured completeness by forks, removed examples that repeated others, and tested the set by blind derivation; it found missing outcomes and repeated examples where counting did not. The outcome is the fork every action has; the other axes depend on the product. A blind derivation needs a reader who has not seen the code, which a model given only the catalogue is, and comparing its answer with the owner's is what the judged proof of D-44 would do.
- Rejected: the number of checks per action as the measure (many checks of the success path cover one fork); a fixed set of axes for every product (only the outcome applies to every action); a check for every combination of values (the combinations multiply; a combination needs a check of its own only where the behavior differs); building the coverage check first, on its own (projects would write checks to satisfy it before the derivation that shows which cases matter exists; the two are one method).

### D-51 · Forbidden terms are deferred until a pilot on one project

- Date: 2026-10-26 · Status: accepted
- Source: the owner's answer of 2026-10-26 to question 146, which mechanisms to take from an outside team's process.
- Decision: entries that name words which must no longer appear, such as a retired name of a thing, with a check that searches the doc sets for them, are deferred.
- Return when: one project has piloted forbidden terms in its own check and reported what they caught and what they flagged by mistake.
- Why: a word a decision retired can live on in documentation the IDs do not reach: a page that still uses the old name passes every check. An outside team kept, with each decision, the phrases that must never appear and searched its documents for them, and it caught stale wording. But a forbidden word also appears where it belongs, in the entry that forbids it, in quotes and in history, and how much noise that makes is unknown; D-27 counts false alarms as noise. A pilot on one project shows whether the catches are worth it before every project gets the check.
- Rejected: building it now (no project has tried it); dropping it (the gap is real: text the IDs do not see).

### D-52 · A tentative entry supersedes nothing until it is accepted

- Date: 2026-10-26 · Status: accepted
- Source: the owner's answer of 2026-10-27 to question 155.
- Decision: an entry's `Supersedes:` line takes effect when the entry is accepted. Until then, the entries it names stay in force: `--decisions` shows them in force, and a deferral among them stays on the list of deferrals, while the tentative entry waits for the owner's answer with the others. The check still confirms that every entry a tentative entry names exists and is older. `derived.in-force` becomes an entry that no accepted entry supersedes. This adds to D-25 and D-48.
- Why: a tentative entry is a proposal the owner has not answered (D-34, D-48). Today the check counts its `Supersedes:` line at once: `--decisions` shows the accepted entry it names as superseded, and a deferral it names drops off the list of deferrals, so a proposal reads as the decision in force. An independent review of D-49 found the second case.
- Rejected: leaving it as it is (a proposal hides the accepted entry it would replace); forbidding `Supersedes:` lines in tentative entries (the recommendation for a question is often to replace an earlier entry, and D-48 writes it as a tentative entry); counting tentative supersession differently in the list of deferrals only (two views of one log would disagree).

### D-53 · Agent instructions name the rules of the approach they follow, and a project departs from one only by an entry

- Date: 2026-10-27 · Status: accepted
- Source: the owner's answer of 2026-10-27 to question 238, and the owner's message of the same day to build it now rather than hold it for a later version.
- Decision: two layers.
  - A project's ontology stays about the product. How agents work is described by the approach's own ontology, in part 7, Agent rules.
  - A process rule in a project's agent instructions, such as its `AGENTS.md` or `CLAUDE.md`, that comes from a rule of the approach or from a decision names that rule's ID or that entry (`rule.agent-rule-source`), as in "(`rule.commit-finished-work`, overridden by D-63)", where D-63 is an entry of the project's log. In the instructions, `D-nn` is always an entry of the project's log, and a rule of the approach is cited by its ID. The files stay prose; commands and matters of style name nothing.
  - A project departs from a rule of the approach, more strictly or more loosely, only by an entry of its log with a `Layer: process` line and an `Extends:` or `Overrides:` line naming the rule, and the instruction that departs cites the entry (`rule.departure-by-entry`, `field.decision.layer`, `edge.decision.extends`, `edge.decision.overrides`).
  - The configuration lists the instruction files under `agentInstructions` (`field.agent-rules.files`). The check fails on a concept ID they mention that neither the project's ontology nor the approach defines, or that is retired, and on an entry they cite that the log does not have or that is superseded (`inv.agent-rule-references-resolve`). It fails on an entry with an `Extends:` or `Overrides:` line that lacks `Layer: process`, or on such a line that names nothing, an ID the approach does not define, or, while the entry is in force, one it has retired (`inv.departure-well-formed`). The approach's IDs travel with the tool in `tools/ont-check/approach.json`, which `gen-approach.mjs` writes from the approach's ontology (`concept.approach-ids`, `inv.approach-ids-current`).
  - Which lines are process rules, and whether a rule in prose is stricter or looser than the approach, the tool cannot tell: a process rule that names no source is a manual check for review, and the catalogue says so.
  - This repository's `AGENTS.md`, the example's and the template's name the sources of their rules.
- Why: a project's agent instructions could depart from the approach without anyone noticing. In one project that uses the approach, the instructions said by default not to commit and not to open a pull request, which narrowed `rule.commit-finished-work` without saying so; nothing showed whether the project meant to depart from the approach, or why. The process is already described by the approach's ontology, so a project's ontology need not take it in; what was missing is a link from each process rule to the rule it follows or changes, and a record of each departure with its reason. The owner wanted it in place before the repository is shown to readers outside the projects that use it.
- Rejected: writing the agent instructions entirely in the format of the ontology, with an ID for every rule (a project's ontology would mix how agents work with what the product is, and every command and matter of style would carry an ID that nothing refers to); leaving it as it is (a departure from the approach stays invisible, as in the case above); holding it for a later version (the owner asked for it now).

### D-54 · Every change ends with a commit; who approves what is the user's choice

- Date: 2026-10-28 · Status: accepted
- Source: the owner's message of 2026-10-28.
- Supersedes: D-42, D-43
- Decision: every change ends with a commit of its own files, never another agent's, since several agents may work in one checkout. The approach does not say who approves a commit or a push, or when to push: that is the user's choice, which a project writes in its own instructions if it wants it there. A project that does not let agents commit departs from the rule by a process entry (D-53). What still holds of D-42: the guard lists, as information, accepted entries that the commit it compares with does not have, and projects run the guard in their test command, so that this list and `GUARD_OFF` show on every run. `rule.commit-finished-work` says so; its ID stays.
- Why: D-42 and D-43 tied the commit to a finished task and wrote permissions into the approach: a commit where the owner lets agents commit, a push only with the owner's approval. Who approves what differs from one user to the next, and the approach gains nothing by deciding it: the guard needs a commit, not a permission. A commit after every change protects an accepted entry as soon as it exists and keeps every step easy to undo. D-42 rejected it because some owners leave commits to themselves, which is now that owner's departure, written as a process entry, rather than the approach's default; and because a commit in the middle of a change records a state whose checks fail, which the pre-commit hook refuses where it runs.
- Rejected: keeping the permissions in the rule (they are each user's taste, which the project's own instructions already state); a commit only at the end of a task (accepted entries stay unprotected while the task runs, and a long task cannot be undone step by step); a push after every commit (whether and when to publish is the user's choice).

### D-55 · Pull requests are welcome, and the owner decides what to merge

- Date: 2026-10-28 · Status: accepted
- Source: the owner's answer of 2026-10-28 to question 267: "let them open pull requests; I can accept them or not. I would like users to take part in developing the protocol" (translated from Russian).
- Supersedes: D-46
- Decision: anyone may open a pull request, and the owner decides whether to merge it; issues stay open for questions and reports of errors. A change to the approach itself starts in its ontology and check catalogue and comes with a decision entry marked tentative, which the owner accepts when merging, naming the pull request on its Source line (D-47, D-48). Before a pull request, `npm test` passes. A contribution is licensed under the license of the file it changes, as [GitHub's terms](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#6-contributions-under-repository-license) already provide, with no contributor license agreement. `CONTRIBUTING.md` says how. What still holds of D-46: the repository is published as an early version in active development, with the tag `v0.1` on the commit first published, and the README opens with the status and where to start.
- Why: the owner wants users to take part in developing the approach, and merging stays the owner's choice, so a pull request commits the owner to nothing. D-46 kept pull requests out because there was no process to review them and the rules moved too fast. The process is the approach's own: a change starts in the ontology and the catalogue, the check and the tests say whether it holds, and its entry stays tentative until the owner accepts it. The licenses already allow any use, the owner's included, so an agreement would add work for contributors and protect nothing the owner needs.
- Rejected: keeping pull requests out for now (it turns away the users the owner wants to involve); a contributor license agreement (the licenses already allow any use, and an agreement keeps casual contributors away); an issue before every pull request (a small fix would wait for a discussion nobody needs).

### D-56 · A new mechanism is decided before it is built; limitations do not track what projects have used

- Date: 2026-10-28 · Status: accepted
- Source: the owner's message of 2026-10-28: "remove from limitations what was used and what was not used in projects" (translated from Russian).
- Supersedes: D-24
- Decision: a new mechanism, such as a check, a generator or a format rule, is recorded as a decision before it is implemented. `docs/limitations.md` lists what the approach does not do, the open questions and the open proposals; it no longer lists the mechanisms added after the source project, nor which of them projects have used. What still holds of D-24: D-05 no longer holds, since the six proposals it kept back are implemented (D-08 to D-11).
- Why: the list of mechanisms and their use in projects is a record of adoption, not a limitation. It grew with every decision, repeated what the reference and the log already say, and went out of date whenever a project adopted a mechanism, while nothing in this repository can see what private projects use.
- Rejected: keeping the list without the marks of use (a second changelog next to the decision log); keeping the marks up to date (it needs reading private projects, which this repository cannot do and must not name).

### D-57 · Code names the concepts it implements, and the check reads the names

- Date: 2026-10-28 · Status: accepted
- Source: the owner's message of 2026-10-28, on the options for "product code does not refer to IDs": "do it now: the same, plus the rule that code names the concepts it implements" (translated from Russian).
- Decision: code that implements a concept names its ID next to it in a comment, `// ont: inv.no-renew-when-held`, the form of a doc anchor without the HTML around it, so any comment syntax works (`rule.code-names-concepts`). The check reads these names in the files of the implementation table and in the code directories the configuration lists under `code`. It fails on a name the ontology does not define or has retired (`inv.code-names-resolve`); it lists, as information, implemented concepts that the files of their row do not name; and `--coverage` shows the files that name each concept (`derived.named-in-code`). A name is not an implementation: the implementation table still says where a concept is built (D-38), and what the code does is still proven by tests. The tool's own code and the example name their concepts. The documentation no longer says that product code does not refer to concept IDs: that was an observation of the project the approach came from, not a rule of the approach.
- Why: tying code to the concepts it realises is the point of the approach, and the documentation described its absence as if it were a property of the approach. In one project the code already names 151 of its 164 built concepts (D-38). A comment is plain text in any language, so the check reads it without a parser per language (D-11), and an agent that changes a concept finds its code by searching for the ID.
- Rejected: IDs anywhere in code without a marker (property paths such as action.type look like IDs); square brackets, as in test tags (array indexes look the same); failing on a concept that its files do not name (a name is not an implementation, and some concepts have no single place in code, D-38); deriving the implementation table from the names (D-38).

### D-58 · The gap says what each target waits for, and --next proposes the next slice of what is ready

- Date: 2026-10-28 · Status: accepted
- Source: the owner's message of 2026-10-28: "from what you propose, do (a), (b), (c) and (d)" (translated from Russian).
- Decision:
  - `--gap` says what each target concept waits for (`derived.readiness`): a ticket that takes it; a condition, when an accepted deferral in force names it; the owner, when only tentative entries name it, or when an accepted entry that names it names a tentative entry; another target that its definition row or one of its checks names and that is not ready; or nothing, and then it is ready. A deferral that names no concept is shown with the gap too.
  - `--next` proposes the next slice (`derived.next-slice`): the ready targets of the first ontology section that has any, the ready targets they depend on, and the checks whose concepts the slice and the code cover, as the `IDs:` and `Checks:` lines of a ticket. With nothing ready, it says what the targets wait for.
  - Work is taken from what is ready, through a ticket (`rule.take-ready`). An entry names the concepts it decides by ID, since that is how the tool learns that they wait; D-44, which is tentative, now names all of its target concepts.
  - This repository keeps its tickets in `issues/`, which the check reads like the example's, and `npm run gap` and `npm run next` run the two reports.
  - On the owner's machine, a job outside the repository runs `--next` on a timer and, when a new slice appears, wakes the agent that maintains the approach; the agent cuts the ticket and builds it until `SLICE_DONE`. The job compares the output with its previous run and costs nothing while nothing changes. It is not part of the approach; part 8 describes such a loop.
- Why: the gap listed every target alike, so a loop that took work from it would build what the owner had not approved: all seventeen targets of the approach wait for the tentative D-44, four of them through D-50, which names it. What a target waits for is already written in the log, the ontology, the catalogue and the tickets, so it can be computed rather than kept by hand. A proposed slice saves cutting it by hand, and a job that wakes the agent only on a change keeps the loop cheap.
- Rejected: a status column in the ontology (a second place for what the log decides); readiness kept by hand in tickets (it goes out of date as entries are accepted); a scheduled agent that wakes on every run (a model call even when nothing changed); building a target that waits for the owner because a loop found it (an approval the owner did not give, D-34).

### D-59 · The guard names silent changes of meaning, and the check lists terms that two concepts share

- Date: 2026-10-28 · Status: accepted
- Source: the owner's message of 2026-10-28: "build everything that is not built, except what is deferred" (translated from Russian). This builds the two checks of the ontology layer that D-44 agreed.
- Decision: the guard compares the definition rows with its base commit. A row whose term, type or definition changed fails unless a decision entry added or changed since the base, or a line added to the ontology's revision history, names its ID (`derived.meaning-changed`, `inv.meaning-change-decided`). The heading of the history is configurable as `headings.history`, by default `## Revision history`. A new row and a removed one are not changes of a definition, and the Kind cell and the alignment are formatting. The check lists, as information, terms that name more than one concept, apart from fields and relations of different entities and a relation that is named after the entity it refers to (`inv.one-concept-per-term`).
- Why: a definition could change without a trace: the next reader saw the new meaning and nothing about the change, while the tooltips, the contracts and the reference pages followed it. The guard already compares the log with a base commit, so it compares the definitions too; a history line is enough for a change of wording, and a change that rests on a choice gets an entry, as the agent rules ask. Shared terms are information, as D-44 found: the approach's own ontology has three legitimate ones.
- Rejected: a decision entry for every change of a definition (a change of wording is not a choice); counting changes of the Kind cell or the alignment (formatting, which the formatter rewrites); shared terms as an error (D-44).

### D-60 · A check catalogue states what must hold, proven by a test, by a judge or by a person

- Date: 2026-10-28 · Status: accepted
- Source: the owner's message of 2026-10-28: "build everything that is not built, except what is deferred" (translated from Russian). This builds the judged proof that D-44 agreed; D-44 asked the entry that builds it to supersede D-14 whole.
- Supersedes: D-14
- Decision: what must hold is a catalogue of checks (`checks.md`): one section per entity, one row per check with an ID `check.<section>.<name>`, the concepts it proves, GIVEN, WHEN and THEN in the product's terms, and its proof. The proof is `auto` when a test implements the check, `judged` when a test runs the product on a fixed sample and a model judges the output against the check's THEN, and `manual` when only a person or an agent with a browser can run it. Every concept of a required class has a check, including concepts not built yet. Tests implement checks and start their title with the check's ID. Every automatic check of implemented concepts needs a test, and a judged check counts as automatic wherever automatic checks count: in the gap, in a finished slice and in a check a ticket waits for. A test suite may name the checks it must implement (`edge.test-suite.checks`), and the check fails while one of them, of implemented concepts, has no test in that suite (`inv.suite-implements-checks`). The suite that runs judged checks names them, and the check fails on a judged check of implemented concepts that no suite names (`inv.judged-check-tested`). `tools/ont-check/judge.mjs` gives the judge the check's case and the product's output and nothing else (`rule.judge-sees-the-check`), runs the command the project sets in `JUDGE`, and writes the verdict, named by the check and the date, where `JUDGE_VERDICTS` points, outside the repository (`rule.verdict-kept`). The catalogue replaced the verification map and the scenarios in tickets; the tool still reads both for existing projects. This restates what still holds of D-14.
- Why: D-14 allowed two proofs, a test or a person, and values a model writes fit neither: an exact expected text breaks on every harmless change, and a manual check of them is seldom run (D-44). A judged check keeps the case in the product's terms and leaves the judging to a model that sees only the case and the output. Nothing in a product's ontology tells a generated value apart, so the suite names its judged checks, which also lets a suite require a key scenario end to end. The example shows one judged check: a refusal at the borrow limit, judged by whatever command the project sets, and skipped without one.
- Rejected: an expected text for generated values (it breaks on harmless changes); a marker for generated values in the ontology (D-44); a judge that reads the code or the test (it would judge the implementation, not the product); verdicts kept in the repository (every run would change it, and a verdict is evidence, kept like the evidence of a manual check); a judge built into the tool (it would tie the approach to one model and one provider).

### D-61 · The two layers, the profiles, the blind walk and the critic are built as documentation

- Date: 2026-10-28 · Status: accepted
- Source: the owner's message of 2026-10-28: "build everything that is not built, except what is deferred" (translated from Russian). This builds the concepts of D-44 that people follow rather than the tool.
- Decision: part 6 explains the two layers (`concept.ontology-layer`, `concept.product-layer`). `docs/profiles.md` holds the profiles as recipes, for model output, for an interface, and for model and data scenarios: each says what to configure, what that requires, which the tool checks, and what it only recommends (`ent.profile`, `rule.profile-requires-checkable`). Part 3 describes the blind walk (`action.walk-blind`) and part 7 the independent critic (`action.critique-change`), both recommended, each with a manual check. They leave the draft page.
- Why: D-44 gave profiles no configuration key and no check of their own, so a profile can require only what the configuration and the catalogue already check, and the rest is advice. The blind walk and the critic are things people and agents do. For such concepts the approach's ontology counts a page of `docs/` that states them as their implementation.
- Rejected: a `profiles` key in the configuration (D-44); a check that a blind walk or a critique took place (nothing records either, and a check of compliance that changes nothing is noise, D-27); making the two procedures required (D-44 recommends them).

### D-62 · A check names the axis values it covers, and the catalogue rules out what cannot occur

- Date: 2026-10-28 · Status: accepted
- Source: the owner's message of 2026-10-28: "build everything that is not built, except what is deferred" (translated from Russian). This builds the complete catalogue of D-50 together with the judged checks of D-60, as D-50 asked, and decides how a check names the value it covers.
- Decision: a check may have a seventh cell, Covers, with the axis values it covers: `refusal`, or `time: days later` for an axis of the project's own (`concept.completeness-axis`). A line of the catalogue, `- Cannot occur: `action.return` refusal — why`, rules values out for the concepts it names, or for the whole catalogue when it names none. The configuration turns the check on by listing axes under `checks.axes`: `"outcome"` for the outcome axis of every action, with the values success, refusal, empty, error and silence, or `{ "name", "values", "each" }` for an axis of the project's own. The check then fails on a value that no check covers and no line rules out, for each concept of the classes under `each` or for the catalogue as a whole, and on a value that no configured axis has (`inv.axis-values-covered`). Whether two checks differ only in data is a reviewer's call (`rule.check-not-redundant`). A blind derivation gives a model the ontology, the catalogue and a case's GIVEN and WHEN through `blindPrompt` in `judge.mjs`, and `judge` compares its answer with the owner's answer, kept as the THEN of a judged check outside the repository (`action.derive-blind`). The example lists the outcome axis and covers the five outcomes of its six actions.
- Why: D-50 left open how a check names the value it covers. A last, optional cell keeps every existing catalogue valid, and a value written as a word reads in any language. Silence and some refusals cannot happen in a given product, so the catalogue says why rather than carrying a check that proves nothing. The tool does not turn the outcome axis on by itself: every existing catalogue would fail at once, and a project turns it on when it is ready to cover its actions. In the example, looking for the outcome error of a checkout showed that the command line front end crashed on a state file it could not read; it now stops with a message and changes nothing.
- Rejected: the value in the check's ID or in its THEN (neither is read reliably); the outcome axis on for every project at once (every existing catalogue would fail); a check that finds checks differing only in data (it needs to know what the behavior is); a blind derivation by a reviewer who has seen the code (it would test what the reviewer knows, not what the catalogue says).

### D-63 · A string that holds the ont: marker counts as a name

- Date: 2026-10-28 · Status: accepted
- Source: the owner's answer of 2026-10-28 to the question whether code names should be read only after the start of a comment: "a", keep reading them as text (translated from Russian).
- Decision: the check keeps reading the `ont:` marker as text wherever it stands in the files it reads for names (D-57), so a string that holds the marker and an ID counts as a name: an ID that does not resolve fails the check (`inv.code-names-resolve`), and one that resolves counts as named (`derived.named-in-code`). Code that needs such a string, such as the tests of a tool that reads the marker, builds it from parts. In Markdown, code blocks and inline code are examples and are not read. The limitations state this together with the same limit of test tags.
- Why: a string that holds the marker occurs in code that works with the marker itself, not in a product's code; a name that does not resolve fails with its file; and building a fixture from parts takes one line.
- Rejected: reading the marker only after the start of a comment, `//`, `#`, `/*`, `*`, `--` or `<!--` (comments that start with `;`, `%`, `'`, `"` or `!` would no longer count, adding `'` and `"` would count strings again, and a string that holds `// ont:` would still count); telling strings from comments by the syntax of each language (a parser per language, D-11, D-57).

### D-64 · A project's copy of the tool is updated and verified by the tool itself

- Date: 2026-10-28 · Status: accepted
- Source: the owner's answer of 2026-10-28 to the question about files left behind in the projects' pinned copies of the tool, option "b": "fix this in ontology-as-spec itself, for all projects: when a copy is updated, the files the approach removed are deleted from the copy, and the verification of the pin reports extra files in the copy's directory" (translated from Russian).
- Decision: `tools/ont-check/pin.mjs` ships with the tool (`ent.tool-copy`). `pin.mjs update --dir DIR`, run from a clone of the approach, copies `tools/ont-check` of a commit without its tests, and the approach's LICENSE, into the project's directory, deletes the files of the old pin that the commit no longer has, and writes the pin (`action.update-copy`, `field.tool-copy.pin`): the repository, the commit, its date, the last decision of the approach there and the hash of every file, in the format the projects' pins already use, `upstream.json` in the directory unless `--pin` names another file. It prints the commits and the decisions since the old pin, and the files in the directory that no pin names, which it leaves in place. `pin.mjs verify`, run from the copy, fails on a file of the pin that is missing or changed and on any other file in the directory, subdirectories included (`inv.copy-matches-pin`). Files a project keeps there on purpose, such as a note on how it updates its copy, are listed under `own` in the pin; update keeps them and verify skips them. The lifecycle page describes the update (`docs/lifecycle.md`).
- Why: each project copied the tool with a script of its own, and none of them deleted a file the approach had removed, while their verifications looked only at the top of the directory or at the files the pin named, so a stale file stayed and passed. One tool in the approach gives every project the same update and the same verification, and a fix reaches all of them with their next copy.
- Rejected: deleting every file that the new commit does not have (it would delete a project's own notes kept beside the copy); leaving the scripts in the projects and describing the rule (each would need the same fix again); a pin format of its own (the projects' pins would all have to be rewritten).

### D-66 · A configuration may require every implemented concept to be named in its code

- Date: 2026-11-03 · Status: accepted
- Source: the owner's answer of 2026-11-03, "yes", to the proposal to protect the `ont:` names from comment cleanups (translated from Russian).
- Decision: the configuration takes `"codeNames": { "require": true }`. With it, an implemented concept that the files of its implementation row do not name in an `ont:` comment fails the check (`inv.implemented-named`); without it, the check lists such concepts as information, as before (D-38, D-57). The limitations say that `ont:` names are comments and that a project which removes comments, by hand or by an agent, sets the key and tells its cleanup to keep the names.
- Why: agent toolkits now ship skills that delete comments before review, and a project of the approach runs one. A deleted name left the check passing with one line of information, so the link from code to concept could disappear unseen. A failing check is the strongest place to hold it; a rule in the agent instructions alone can be skipped.
- Rejected: making names required for every project (D-38 keeps a name apart from an implementation, and projects adopting the approach start without names); a marker other than a comment, such as a decorator or an attribute (a different syntax per language, against D-57); relying on a line in the agent instructions only (an agent that deletes comments may not read it).
- Concepts: `inv.implemented-named`, `derived.named-in-code`, `rule.code-names-concepts`.

### D-67 · A correction is held at the strongest step that can hold it

- Date: 2026-11-03 · Status: accepted
- Source: the owner's answer of 2026-11-03, "yes", to the proposal to add the rule after a talk on keeping agents trustworthy at hundreds of changes a day (translated from Russian).
- Decision: a correction of an agent is held at the strongest step that can hold it, in this order: the structure of the code, so the mistake cannot be written; a check of the tool, a test or a lint; a rule in the agent instructions; a reviewer's memory last (`rule.strongest-step`). Part 7 explains the order under "Why a table", with the talk as its source, the template's list of rules the check cannot enforce opens with it, and a manual check asks the reviewer whether a correction held only in prose could have been held by something stronger.
- Why: part 7 already said that a rule which keeps being broken should become a check, but only for the rules already written down. Corrections went into the instructions by habit, where an agent may not read them, and the next agent repeated the mistake. The talk by Lauren Tan (https://x.com/poteto/status/2102050467505430555) describes the same order from a codebase that takes hundreds of agent changes a day.
- Rejected: a check of the tool (whether a correction could have been held more strongly is a judgment about the code, which the tool does not read); leaving the sentence in part 7 as it was (it covered only rules already in the list, not each correction as it happens).
- Concepts: `rule.strongest-step`, `ent.agent-rules`.

### D-68 · A ticket is cut when its work starts and kept when it is done

- Date: 2026-11-03 · Status: accepted
- Source: the owner's answer of 2026-11-03, "yes", to the proposal to say who cuts a ticket, when, and what happens to it after `SLICE_DONE` (translated from Russian).
- Decision: a ticket is cut when work on its slice starts, not ahead of it, by whoever starts the work, the owner or an agent that takes the slice `--next` proposes; what the agent may do then is the owner's choice, on the ticket's pre-authorized lines (`rule.cut-when-started`). When `--gap` with the ticket prints `SLICE_DONE` and the tests pass, the ticket is closed and kept as the record of the slice: a file stays in the tickets directory, a tracker entry is closed, not deleted (`rule.ticket-closed-on-done`). Part 8 explains both, and that a ticket in a tracker takes nothing in `--gap`, since the check reads only ticket files.
- Why: part 8 said what a ticket is cut from and when it is done, but not when it is cut, by whom, or what happens to it after. A ticket takes its concepts out of what `--next` offers, so tickets cut ahead to keep a queue would make untouched work look taken; and the gap is already the queue, computed fresh each time.
- Rejected: a backlog of tickets cut ahead (it hides ready work from `--next`, and the gap already orders the work); deleting a ticket when it is done (it is the only record of which slice was built when and within which limits); a check that open tickets are being worked on (nothing in the repository records that work is going on).
- Concepts: `rule.cut-when-started`, `rule.ticket-closed-on-done`, `ent.ticket`, `action.cut-slice`.

### D-69 · The interface profile recommends a feature map and a command line that drives the product

- Date: 2026-11-03 · Status: accepted
- Source: the owner's answer of 2026-11-03, "yes", to the proposal to write the feature map, the command line and the handling of user reports into the interface profile (translated from Russian).
- Decision: the interface profile recommends, besides the blind walk, a feature map kept as a doc set that covers views and actions, one anchored section per screen or feature with how a user reaches it, how to drive it and its traps, and a command line that drives the product, so run guides and the blind walk name commands rather than improvised steps. Both are recommendations, as D-61 made the profiles; the tool checks the doc set, not the command line. Part 3 adds that a report from a user is reproduced with the run guides and the map and sorted like a finding of the blind walk: a known divergence, a check written before the fix, or the gap or a decision.
- Why: Lauren Tan's verification skills (https://x.com/poteto/status/2094457600259842065) let agents check their own changes on a product's screens through exactly these two parts, and keeping the map up to date there takes a daily maintenance run because nothing notices when it goes stale. As a doc set anchored to the ontology, the check notices. A project of the approach already keeps its run guides that way.
- Rejected: a new kind of artifact for the feature map (a doc set already holds anchored sections and reports gaps and stale sections); requiring the map or the command line in the profile (the tool cannot check that a command line drives the product, D-44 requires only what the tool checks); describing user reports as a separate process (they are findings like the blind walk's, with the same three outcomes).
- Concepts: `ent.profile`, `ent.doc-set`, `action.walk-blind`.

### D-70 · When several agents start at once, one coordinator cuts their tickets on the main branch

- Date: 2026-11-03 · Status: accepted
- Source: the owner's answer of 2026-11-03, "yes", to the proposal to say who cuts the tickets of agents that work in parallel (translated from Russian).
- Decision: when several agents start work at the same time, one coordinator cuts all their tickets and commits them to the main branch before any of them starts: it runs `--next`, commits the ticket, and runs `--next` again for the next agent, so no concept is in two tickets (`rule.coordinator-cuts`). This adds to D-68: the work starts with handing it out, so the tickets are still cut when it starts. Part 8 explains it.
- Why: D-68 relies on a ticket taking its concepts, but only agents that see the ticket respect that. Agents on branches or checkouts of their own do not see one another's tickets until they are merged, so each would take the same slice from `--next` and build it twice. Agent toolkits that run many agents at once give the handing out of work to one coordinator for the same reason (https://github.com/cursor/plugins/blob/main/pstack/skills/poteto-mode/playbooks/orchestrate.md).
- Rejected: each agent cutting its own ticket and pushing it at once (two agents may still read `--next` before either push lands); a lock file or a field in the ticket that marks it taken (a second mechanism for what a committed ticket already does).
- Concepts: `rule.coordinator-cuts`, `rule.cut-when-started`, `derived.readiness`.

### D-71 · A slice is one change a reviewer can read

- Date: 2026-11-03 · Status: accepted
- Source: the owner's answer of 2026-11-03, "yes", to the proposal to limit a slice to one reviewable change (translated from Russian).
- Decision: a slice is one change that a reviewer can read with its own evidence. When what `--next` proposes is more than that, it is split along its dependencies, the part the rest depends on is built first, and the rest stays in the gap for `--next` to offer again (`rule.slice-one-change`). No number of concepts marks the limit; the reviewer judges, so the check is manual. Part 8 explains it under "Slices and control tests".
- Why: `--next` cuts by ontology section, and a section can hold three concepts or twenty, so a proposed slice could become a change too large to review, whose tests prove little one by one. Agent toolkits that land many changes a day keep each change small and checked before the next for the same reason (https://github.com/cursor/plugins/blob/main/pstack/skills/principle-sequence-verifiable-units/SKILL.md).
- Rejected: a limit on the number of concepts in `--next` (one concept can take a day and five an hour, so any number would be invented); leaving the size to the section (sections are drawn for meaning, not for review).
- Concepts: `rule.slice-one-change`, `derived.next-slice`, `action.cut-slice`.

### D-72 · A question that a run can answer is settled by a prototype before it reaches the owner

- Date: 2026-11-03 · Status: accepted
- Source: the owner's answer of 2026-11-03, "yes, and the third", to the proposal to settle questions of fact by a prototype instead of asking the owner (translated from Russian).
- Decision: a question that a run can answer, such as whether something is fast enough, fits a screen or works with a service, is answered by a throwaway prototype before it reaches the owner, and the result, with where it came from, is the evidence on its entry (`rule.run-settles-question`). A question of fact is then closed; a choice stays tentative and waits for the owner with what the run showed (D-34, D-48 still hold). Only what no run settles, the meaning of the product, a preference or a price, waits for the owner. Part 2 explains it, and the template's rules list it.
- Why: every question with a recommendation waits for the owner as a tentative entry (D-48), including questions a run would settle in minutes, so concepts waited for the owner's time on the agent's own work. Agent toolkits settle such forks by a prototype and ask the operator only what no run can settle (https://github.com/cursor/plugins/blob/main/pstack/skills/poteto-mode/playbooks/multi-phase-plan.md).
- Rejected: letting an agent accept a choice on a prototype's result (a choice is the owner's, D-34; the run informs it); asking the owner first and prototyping on request (the owner then answers what the agent could have measured).
- Concepts: `rule.run-settles-question`, `rule.question-as-tentative`, `rule.unconfirmed-tentative`.

## Tentative

### D-73 · The ontology is the source of the code: it describes behavior as completely as it can, and a model writes the code from it

- Date: 2026-11-03 · Status: tentative
- Source: the owner's messages of 2026-11-03: "the ontology should describe all behavior as far as possible, so that all the code is generated by a model", "first the ontology changes, then the code is generated or written from it by a model", "the mockup is already code, not specification", his answer "a" to where behavior ends and appearance begins, and his "yes" to the ontology being the specification, with the check catalogue as part of it (translated from Russian).
- Decision: the ontology is the product's specification: its tables of concepts and its catalogue of checks, kept in two files so that cases with data do not bury the definitions (D-14). A model writes the product's code from it, and the mockup is code too: the first implementation of the interface, written from the ontology like the rest, which may run ahead of the product's code (`rule.ontology-is-source`, `rule.mockup-shows-target`). The ontology describes behavior as completely as it can: what every view shows in each state and what the user can do there, and every outcome of every action as a check; layout and style are the implementation's, and the owner judges them on the mockup (`rule.behavior-in-ontology`). What the code does that the ontology does not say is a gap in the ontology and becomes a check or a question, not a choice left to the code. A change of behavior starts in the ontology, its rows or its checks, then the code and its tests (`rule.ontology-changes-first`). Two runs of a model do not write the same code; they write code that passes the same checks, and that is what the same product means here. The deterministic generators keep restating the ontology: tooltips, contracts and reference pages. The decision log explains why the ontology is as it is and is not part of it. The concepts people argue about are where adoption starts, not the limit of the ontology. The reason D-18 gives, that code is written by hand, is replaced by this entry; its decision on documentation stands.
- Why: the approach grew out of the owner's need to keep, for every element of the mockup, the reason it exists. Its texts then said that the ontology is not a full specification of behavior, that code and mockup are edited directly, that the mockup is a specification and that a concept nobody discusses needs no ID. None of it was the owner's decision: it came from an agent's answer to the owner's question of 2026-10-17 and from the brief for this repository, which passed that answer on as a finding, and the first commit wrote it down. The owner's position is the opposite: describe first, so that agents work longer on their own (his message of 2026-10-17), and write the code from the description.
- Rejected: staying spec-anchored with a narrow generated slice (the owner's position); regenerating the code from the ontology by a script (behavior needs a model; a script restates only what the ontology states mechanically); the mockup as part of the specification (a mockup holds decisions the ontology does not state, and an agent then builds what the mockup merely suggests); layout and style in the ontology (they are judged better on the mockup than read in a table); a specification as a concept of its own beside the ontology (a third word for what the approach's name already says); a page of its own about spec-as-source (a second home for the position, which the rows hold and the principles explain).
- Concepts: `rule.ontology-is-source`, `rule.behavior-in-ontology`, `rule.ontology-changes-first`, `rule.mockup-shows-target`.

### D-74 · What a mockup element does not do is written in the ontology, and the map only links elements to concepts

- Date: 2026-11-04 · Status: tentative
- Source: the owner's answer "a" of 2026-11-04 to whether the map's column of what an element does not do moves into the ontology (translated from Russian).
- Decision: what an element deliberately does not do, such as a button that is never offered, a value nobody edits or an amount that is never shown, is behavior, so it is written in the ontology: in a definition, a note of the screen or "Deliberately out of scope" (`rule.limits-in-ontology`). The map keeps what each element shows on its screen and the concept behind it; its column of what the element does not do is removed and `field.map-row.does-not-do` is retired. Adds to D-73: the ontology describes behavior as completely as it can, and this is the part of it the map held.
- Why: the map held behavior that the ontology did not state. A model that writes the code from the ontology would not see it, and the same limit lived in two places, which drift apart.
- Rejected: keeping the column and requiring every item to be in the ontology too (the same limit twice, kept in step by hand); keeping the column as the only record (behavior outside the ontology, against D-73).
- Concepts: `rule.limits-in-ontology`, `ent.map-row`, `rule.behavior-in-ontology`.

## Open questions

## History

- 2026-10-28: D-44 accepted by the owner.
- 2026-10-27: D-52 accepted by the owner.
- 2026-10-26: D-39 accepted by the owner.
- 2026-10-24: from D-32 on, History lists only events that have no entry of their own (D-33).
- 2026-10-23: D-31: a known divergence names its concepts.
- 2026-10-23: D-30: configurable heading of known divergences.
- 2026-10-23: D-29: what a partial implementation leaves out is a target concept.
- 2026-10-23: D-28: a ticket stays open while a divergence of its own remains or a listed check waits; D-16 superseded.
- 2026-10-22: D-27: what a consistency review reports.
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
