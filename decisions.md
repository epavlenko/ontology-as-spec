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

## Open questions

- When to name the source project.

## History

- 2026-10-21: D-08: tests linked to IDs, scenarios in tickets, decision guard.
- 2026-10-17: D-07: licenses.
- 2026-10-17: D-01…D-06.
