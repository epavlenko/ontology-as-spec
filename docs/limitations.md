# Limitations and open questions

What the approach does not do, what has not been tested, and what could make it stronger. Much of the tool was added after the project the approach came from; those additions are listed under "Implemented, not yet tried in a real project". No proposal is open.

## Weaknesses

### Code does not refer to IDs

The check reads the ontology, the mockup, the map, the decision log, the implementation table, the check catalogue, the tickets, the anchors in documentation and the tags in tests. It does not read product code, and product code does not mention concept IDs. A tagged test ties a concept to behavior only as far as the test goes. The generated contracts carry IDs, but whether the code follows them is up to the project's own checks. Code that behaves differently from the ontology in a way no test exercises passes. The implementation table and the list of divergences are maintained by hand. In the project where the approach took shape, this is partly a matter of timing: most of the target model had not reached code yet. In general it is a real gap. The [Spec Growth Engine](comparison.md#the-spec-growth-engine) closes a version of it by reading code structure.

### A tag says what a test implements, not that it does

An invariant such as "an item is on at most one open loan" is written in prose, and the check catalogue gives the case with data that proves it. A test names the check in a tag, and the check requires such a test for every automatic check of implemented concepts. It cannot see whether the test actually does what the check says: a test tagged `[check.item.one-open-loan]` that asserts nothing passes. Manual checks are run by people, and nothing records that they were.

### Notes can still restate a definition

Each concept has one definition row, in the table of its entity, and no second table explains it again. The notes under a table may still describe a concept in words of their own, and the check compares IDs, not text. In the project where the approach took shape, an explanatory table listed five items where the glossary row listed four; the layout removes the second table, not the temptation.

### The mockup cannot show time

A mockup shows a state: overdue, reserved, suspended. It cannot show a loan becoming overdue, a reminder arriving two days before the due date, or a reservation passing to the next person after three days. Hooks, derived values that depend on the date, and rules with durations need tests against code. A partial substitute is to use the mockup with persistent state and real data for a week or two, so that time-based states actually occur. A person still has to notice them.

### The implementation table trusts its author

The check confirms that the files named in the table exist, not that they implement the concept. For the classes that tests must cover, a tagged test is required as well, which is a mechanical counterpart, though a weak one (see above). For the other classes, "implemented" still means "someone said so".

### The decision guard compares text with one earlier commit

`guard-decisions.mjs` refuses an edit or removal of an accepted entry, comparing with `HEAD` before a commit and with the base of a push or pull request in CI. It sees text, not intent: a typo fix in an accepted entry is refused too, by design. `git commit --no-verify` skips the hook, and only CI catches that. A rewritten history removes the base it compares with. It does not check that a superseding entry names the entry it supersedes.

### Test tags are read anywhere in a test file

The tool cannot parse the syntax of every test framework, so it reads a tag wherever it appears in a test file, not only in a title. A fixture string that looks like a tag counts as one: an invalid one fails the check, a valid one claims proof the test does not give. Fixtures that need such strings build them from parts.

### Reference pages show the target

A generated reference page shows each concept's definition, which describes the target. A page limited to implemented concepts still shows the target definition of a concept that is only partly built: the example's terms page says the borrow limit is set by staff, while the code fixes it at five. The note column of the implementation table is not on the page.

### Small, homegrown tooling

The check parses Markdown tables and HTML attributes with regular expressions. It assumes a particular table layout and backticked IDs. The generic version in this repository is its first version. It has been exercised on the example and on the approach's own ontology, and derived from a check that ran for weeks in one project; it has not been used in a second real product yet.

### No per-change process

There is no equivalent of Spec Kit's clarify and analyze commands or OpenSpec's delta specs. Changes to meaning are reviewed as ordinary diffs of the ontology and the decision log, which works while the ontology is small and one person owns it.

## Open questions

- **Scale.** One ontology file with about 150 concepts was workable. At what size should it split, and along which lines: by bounded context, by product surface?
- **Several products sharing concepts.** When a word means different things in two neighbouring products, one ontology with namespaces, or two ontologies with a mapping?
- **How much behavior belongs in the ontology.** Too little, and agents guess. Too much, and the ontology becomes the verbose spec that Böckeler criticizes. Where is the line?
- **Two languages.** The target model can be written in the team's language while code and user documentation use another. The approach handles this as two vocabularies with recorded divergences. Whether that holds up with a larger team is untested.
- **Versioning.** Should the ontology be versioned against releases, or is the decision log enough history?

## Implemented, not yet tried in a real project

The first six were proposals until [D-08 to D-11](../decisions.md); later additions name their decision. They work on the example and are covered by the check's tests. None has been used in a real project.

- **Tests linked to IDs.** A test title starts with the IDs it proves, now the IDs of checks: `test("[check.item.one-open-loan] an item cannot be on two loans")`. The check requires a tagged test for every implemented concept of the classes a test suite covers, and refuses a tag on something not implemented. See [part 6](parts/checks-and-tests.md#tests-that-name-checks).
- **Test suites per kind of concept.** The configuration lists the test suites (unit, integration, end-to-end, or whatever the team runs) and the classes each must cover, and the check names the suite a missing test belongs to. `--coverage` prints what proves each implemented concept. Added with [D-13](../decisions.md). See [part 6](parts/checks-and-tests.md#test-suites).
- **Check catalogue.** Formerly GIVEN/WHEN/THEN scenarios in tickets and the verification map. What must hold is a catalogue of checks in the product's terms, one section per entity, independent of the implementation; tests implement checks and carry their IDs. Every invariant, rule, hook and action has a check before it is built, and every automatic check of implemented concepts has a test. Added with [D-14](../decisions.md). See [part 6](parts/checks-and-tests.md).
- **The gap is computed.** `ont-check.mjs --gap` lists target concepts with their checks, automatic checks without a test and known divergences, by entity. Known divergences keep only code that contradicts the target. Added with [D-15](../decisions.md).
- **Tickets are slices of the gap.** A ticket names the concepts and checks to build now, what to leave, what it depends on and what the agent may do. Its finish condition is derived: `--gap` with the ticket prints `SLICE_DONE`. Added with [D-16](../decisions.md). See [part 8](parts/agent-workflow.md#tickets-are-slices-of-the-gap).
- **One home per definition.** The ontology has one table per entity, and every concept is one row in one of them, grouped by kind in a fixed order. There is no separate glossary table and no per-kind table that explains the concepts again. The check enforces the kind order, the Kind cells and that each field or relation sits with its entity. See [part 1](parts/glossary-and-ids.md).
- **No concept without feedback.** Formerly "do not expand the ontology ahead of the code". The ontology may run ahead of the code together with the mockup; what it should not do is grow concepts nothing has tried. The check lists, as information, every concept with no mockup element, no ticket and no implementation row. See [lifecycle](lifecycle.md#a-new-concept).
- **Contracts from fields, independent of the implementation language.** Field and relation rows carry a type in a neutral vocabulary (`text`, `integer 0..2`, `date`, `one of good, worn, damaged`, `ref ent.title`, `optional`). `gen-contracts.mjs` generates a JSON Schema per entity with the concept ID on every property, and the check requires a valid type on every field and relation and a current schema. How the code follows the schema is the project's choice; the example compares its constants with it in a tagged test. See [part 1](parts/glossary-and-ids.md#types-and-contracts).
- **One decision, one choice.** A decision log entry records one choice that can be reversed on its own and is superseded whole. The check reports, as information, an entry that supersedes only part of another. Added with [D-17](../decisions.md). See [part 2](parts/decision-log.md#reference).
- **Documentation anchored to the ontology.** Pages for people carry anchors naming the concepts each section explains; doc sets in the configuration say which classes each set must explain; a stamp marks sections to reread after a definition changed; reference pages are generated; doc set names are unique; a stamp also covers the notes that name a concept. Added with [D-18](../decisions.md), [D-22](../decisions.md) and [D-23](../decisions.md). See [part 9](parts/documentation.md).
- **The approach described with itself.** `ontology.md` and `checks.md` at the root of the repository hold the approach's concepts, rules and checks; the tool's tests implement the checks; the check runs on them like on any product. Manual checks are what the tool cannot enforce. Added with [D-19](../decisions.md).
- **`docs/` as a doc set of the approach's ontology.** The rules, formats and "what the check enforces / cannot enforce" lists of the parts moved into the approach's ontology and check catalogue; the parts explain and point to the generated [reference](reference.md). Added with [D-20](../decisions.md).
- **Accepted status in any language.** The guard reads the line that marks an entry accepted from the configuration, so a log written in another language is guarded too. Added with [D-12](../decisions.md).
- **Guarded decisions.** `tools/ont-check/guard-decisions.mjs` compares every accepted entry with an earlier commit and fails if one changed or disappeared. It runs in the pre-commit hook and in CI. See [part 2](parts/decision-log.md#the-guard).

## Proposed strengthening

None open. The six proposals of the first version are implemented, in the form listed above (D-08 to D-11), and none of them has been used in a real project yet.
