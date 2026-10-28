# Limitations and open questions

What the approach does not do, the open questions, and what could make it stronger. What is deferred is under [Deferred](#deferred).

## Weaknesses

### The check reads names in code, not what code does

Code names the concepts it implements in `ont:` comments, and the check confirms that every name resolves and lists implemented concepts that the files of their row do not name. It does not read what the code does. A tagged test ties a concept to behavior as far as the test goes, so code that behaves differently from the ontology where no test looks passes. The generated contracts carry IDs, and whether the code follows them is up to the project's own checks. The [Spec Growth Engine](comparison.md#the-spec-growth-engine) reads code structure instead.

### A tag says what a test implements, not that it does

An invariant such as "an item is on at most one open loan" is written in prose, and the check catalogue gives the case with data that proves it. A test names the check in a tag, and the check requires such a test for every automatic check of implemented concepts. It cannot see whether the test actually does what the check says: a test tagged `[check.item.one-open-loan]` that asserts nothing passes. Manual checks are run by people, and nothing records that they were.

### Notes can still restate a definition

Each concept has one definition row, in the table of its entity, and no second table explains it again. The notes under a table may still describe a concept in words of their own, and the check compares IDs, not text. In the project where the approach took shape, an explanatory table listed five items where the glossary row listed four; the layout removes the second table, not the temptation.

### The mockup cannot show time

A mockup shows a state: overdue, reserved, suspended. It cannot show a loan becoming overdue, a reminder arriving two days before the due date, or a reservation passing to the next person after three days. Hooks, derived values that depend on the date, and rules with durations need tests against code. A partial substitute is to use the mockup with persistent state and real data for a week or two, so that time-based states actually occur. A person still has to notice them.

### The implementation table trusts its author

The check confirms that the files named in the table exist and which of them name the concept in an `ont:` comment, not that they implement it. For the classes that tests must cover, a tagged test is required as well. For the other classes, a row is a claim that a reviewer confirms.

### The decision guard compares text with one earlier commit

`guard-decisions.mjs` refuses an edit or removal of an accepted entry, comparing with `HEAD` before a commit and with the base of a push or pull request in CI. It sees text, not intent: a typo fix in an accepted entry is refused too, by design. `git commit --no-verify` skips the hook, and only CI catches that. A rewritten history removes the base it compares with. It compares the definition rows with the ontology of the same commit, found under its path, under the path the base's configuration names, or under the path git finds it renamed from; when it finds none, it says so and compares nothing. It does not check that a new entry which replaces an older one names it on its `Supersedes:` line; it checks only that the entries named there exist and are older. Before the first commit it has nothing to compare with and says `GUARD_OFF`: until then, accepted entries are protected by review only. It sees that an entry accepted since its base has a `Source:` line, not that the line names where the decision was really made. When the first source arrives within the commits it compares, it asks a source only of the entries numbered after that one, so an older tentative entry accepted in the same commits goes unasked.

### Test tags and code names are read anywhere in a file

The tool cannot parse the syntax of every language and test framework, so it reads a tag wherever it appears in a test file, not only in a title, and an `ont:` name wherever it appears in a file it reads for names, not only in a comment. A fixture string that looks like a tag or a name counts as one: an invalid one fails the check, a valid one claims a proof or a name the code does not give. Fixtures that need such strings build them from parts. Only in Markdown are code blocks and inline code left out, as examples.

### Readiness reads names, not intent

The tool learns that a target waits from the decision log, by the entries that name it. A tentative entry that describes a concept without its ID leaves the concept looking ready, and an accepted entry that mentions a concept in passing counts as naming it. A target that no entry names counts as agreed, since the ontology is the agreed target.

### Reference pages show the target

A generated reference page shows each concept's definition, which describes the target. A page limited to implemented concepts still shows the target definition of a concept that is only partly built: the example's terms page says the borrow limit is set by staff, while the code fixes it at five. The note column of the implementation table is not on the page.

## Open questions

- **Scale.** One ontology file with about 150 concepts was workable. At what size should it split, and along which lines: by bounded context, by product surface?
- **Several products sharing concepts.** When a word means different things in two neighbouring products, one ontology with namespaces, or two ontologies with a mapping?
- **How much behavior belongs in the ontology.** Too little, and agents guess. Too much, and the ontology becomes the verbose spec that Böckeler criticizes. Where is the line?
- **Two languages.** The target model can be written in the team's language while code and user documentation use another. The approach handles this as two vocabularies with recorded divergences. Does it hold up with a larger team?
- **Versioning.** Should the ontology be versioned against releases, or is the decision log enough history?

## Deferred

- **Forbidden terms**: words a decision retired, searched for in the doc sets. Deferred in [D-51](../decisions.md) until one project has piloted them.
