# Limitations and open questions

What the approach does not do, what has not been tested, and what could make it stronger. Proposals in the last section are proposals: none of them has been implemented or tried.

## Weaknesses

### Code does not refer to IDs

The check reads the ontology, the mockup, the map, the decision log, the implementation table and the scenarios. It does not read code, and code does not mention concept IDs. Code that behaves differently from the ontology therefore passes. The implementation table and the list of divergences are maintained by hand. In the project where the approach took shape, this is partly a matter of timing: most of the target model had not reached code yet. In general it is a real gap. The [Spec Growth Engine](comparison.md#the-spec-growth-engine) closes a version of it by reading code structure.

### No executable acceptance criteria at the concept level

An invariant such as "an item is on at most one open loan" is written in prose. Nothing turns it into a test, and nothing links an existing test to it. Verification scenarios are recipes, not automated checks. Stage control tests exist, but they are tied to stages, not to concepts.

### Definitions can drift inside the ontology

The glossary is the single source of short definitions, but the rest of the ontology explains the same concepts at length, often in tables of its own. The check compares IDs, not text. A list of five items in an explanatory table and four in the glossary row passes. This has happened in practice.

### The mockup cannot show time

A mockup shows a state: overdue, reserved, suspended. It cannot show a loan becoming overdue, a reminder arriving two days before the due date, or a reservation passing to the next person after three days. Hooks, derived values that depend on the date, and rules with durations need tests against code. A partial substitute is to use the mockup with persistent state and real data for a week or two, so that time-based states actually occur. A person still has to notice them.

### The implementation table trusts its author

The check confirms that the files named in the table exist, not that they implement the concept. "Implemented" means "someone said so".

### Accepted decisions can be edited

The rule "never edit an accepted entry" is enforced by review only.

### Small, homegrown tooling

The check parses Markdown tables and HTML attributes with regular expressions. It assumes a particular table layout and backticked IDs. The generic version in this repository is its first version. It has been exercised on the example and derived from a check that ran for weeks in one project, and it has not been used in a second real project yet.

### No per-change process

There is no equivalent of Spec Kit's clarify and analyze commands or OpenSpec's delta specs. Changes to meaning are reviewed as ordinary diffs of the ontology and the decision log, which works while the ontology is small and one person owns it.

## Open questions

- **Scale.** One ontology file with about 150 concepts was workable. At what size should it split, and along which lines: by bounded context, by product surface?
- **Several products sharing concepts.** When a word means different things in two neighbouring products, one ontology with namespaces, or two ontologies with a mapping?
- **How much behavior belongs in the ontology.** Too little, and agents guess. Too much, and the ontology becomes the verbose spec that Böckeler criticizes. Where is the line?
- **Two languages.** The target model can be written in the team's language while code and user documentation use another. The approach handles this as two vocabularies with recorded divergences. Whether that holds up with a larger team is untested.
- **Versioning.** Should the ontology be versioned against releases, or is the decision log enough history?

## Proposed strengthening

None of these is implemented. The first four came out of comparing the approach with SDD tools. The last two came out of reading the check's blind spots.

1. **Link tests to IDs.** Tests name the concept IDs they prove, for example in the test title or a tag. The check then requires every implemented ID of selected classes, invariants and rules first, to be covered by at least one test. This closes most of the gap between "implemented" and "proven", and gives the implementation table a mechanical counterpart.
2. **WHEN/THEN scenarios in tickets.** A ticket that implements a concept states its expected behavior as scenarios in the EARS or Given/When/Then style, each tagged with the ID. They become the tests of proposal 1.
3. **Do not expand the ontology ahead of the code.** When the target model is far ahead of the implementation, new concepts add review cost without feedback. Freeze expansion until delivery stages have reached code, and let what implementation teaches drive the next additions.
4. **Generate contracts from fields.** Generate schemas or typed contracts from the field, enumeration and relation tables of the ontology. It is a narrow, deterministic step toward spec-as-source for the part of the ontology that is precise enough.
5. **One home per definition.** Either forbid restating definitions in the explanatory tables, which would then only add detail, or check that every table row describing an ID is consistent with its glossary row.
6. **Guard accepted decisions.** A pre-commit or CI step compares accepted decision entries with the previous commit and fails if any changed.
