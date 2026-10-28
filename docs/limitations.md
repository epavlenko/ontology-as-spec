# Limitations and open questions

What the approach does not do, what has not been tested, and what could make it stronger. Two proposals are open and one is deferred, under [Proposed strengthening](#proposed-strengthening).

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

`guard-decisions.mjs` refuses an edit or removal of an accepted entry, comparing with `HEAD` before a commit and with the base of a push or pull request in CI. It sees text, not intent: a typo fix in an accepted entry is refused too, by design. `git commit --no-verify` skips the hook, and only CI catches that. A rewritten history removes the base it compares with. It does not check that a new entry which replaces an older one names it on its `Supersedes:` line; it checks only that the entries named there exist and are older. Before the first commit it has nothing to compare with and says `GUARD_OFF`: until then, accepted entries are protected by review only. It sees that an entry accepted since its base has a `Source:` line, not that the line names where the decision was really made. When the first source arrives within the commits it compares, it asks a source only of the entries numbered after that one, so an older tentative entry accepted in the same commits goes unasked.

### Test tags are read anywhere in a test file

The tool cannot parse the syntax of every test framework, so it reads a tag wherever it appears in a test file, not only in a title. A fixture string that looks like a tag counts as one: an invalid one fails the check, a valid one claims proof the test does not give. Fixtures that need such strings build them from parts.

### Reference pages show the target

A generated reference page shows each concept's definition, which describes the target. A page limited to implemented concepts still shows the target definition of a concept that is only partly built: the example's terms page says the borrow limit is set by staff, while the code fixes it at five. The note column of the implementation table is not on the page.

### Small, homegrown tooling

The check parses Markdown tables and HTML attributes with regular expressions. It assumes a particular table layout and backticked IDs. The generic version in this repository is its first version, derived from a check that ran for weeks in one project. Since then four private projects have used it, that project among them. Each keeps a copy of the tool pinned to a commit of this repository and runs it in a commit hook or in CI; all four write their ontology and decision log in Russian, and their tests that name checks are written in TypeScript, JavaScript and Ruby. All four are projects its author works on; no other team has used it yet.

### No per-change process

There is no equivalent of Spec Kit's clarify and analyze commands or OpenSpec's delta specs. Changes to meaning are reviewed as ordinary diffs of the ontology and the decision log, which works while the ontology is small and one person owns it.

## Open questions

- **Scale.** One ontology file with about 150 concepts was workable. At what size should it split, and along which lines: by bounded context, by product surface?
- **Several products sharing concepts.** When a word means different things in two neighbouring products, one ontology with namespaces, or two ontologies with a mapping?
- **How much behavior belongs in the ontology.** Too little, and agents guess. Too much, and the ontology becomes the verbose spec that Böckeler criticizes. Where is the line?
- **Two languages.** The target model can be written in the team's language while code and user documentation use another. The approach handles this as two vocabularies with recorded divergences. Whether that holds up with a larger team is untested.
- **Versioning.** Should the ontology be versioned against releases, or is the decision log enough history?

## Proposed strengthening

Two proposals are open, and one is deferred. The open ones are target concepts of the approach's ontology, explained on a [draft page](drafts/verification.md); nothing of the three is built.

- **Verification in two layers**, in which a project's product checks follow from its ontology through profiles written as recipes. It is tentative, under [D-44](../decisions.md).
- **A complete catalogue**: every value of every axis along which behavior diverges covered by a check, and a blind derivation that tests whether the catalogue suffices. Accepted as a target in [D-50](../decisions.md), it is built together with the judged checks of D-44.
- **Forbidden terms**: words a decision retired, searched for in the doc sets. Deferred in [D-51](../decisions.md) until one project has piloted them.
