# Limitations and open questions

What the approach does not do, the open questions, and what could make it stronger. What is deferred is under [Deferred](#deferred).

<!-- ont: -->
## Weaknesses

<!-- ont: rule.code-names-concepts@701aa5, derived.named-in-code@5e7772 -->
### The check reads names in code, not what code does

Code names the concepts it implements in `ont:` comments, and the check confirms that every name resolves and lists implemented concepts that the files of their row do not name. It does not read what the code does. A tagged test ties a concept to behavior as far as the test goes, so code that behaves differently from the ontology where no test looks passes. A project that turns the [oracle](parts/oracle.md) on also compares its code with the ontology's formal forms on random sequences of actions (`rule.code-compared-with-oracle`); that comparison reaches only the actions the code implements and the state the project's test reads, and the project writes the test itself. The generated contracts carry IDs, and whether the code follows them is up to the project's own checks. The [Spec Growth Engine](comparison.md#the-spec-growth-engine) reads code structure instead. With an adapter (D-101), a check's trace also runs on the code itself, so a traced check holds the code's records and refusals for its case; the derived values an assertion reads are still computed by the forms from the code's records, and a check without a trace, or whose trace takes an action the adapter does not run, is held as before.

<!-- ont: rule.ontology-is-source@df6b8f, action.derive-blind@73594f -->
### A model does not write the same code twice

The ontology is the source of the code, and a model writes it. Two runs write different code; what makes them the same product is that both pass the same checks. Where the catalogue has no check, two runs may behave differently and the check does not notice; where the ontology has formal forms, the comparison with the oracle notices it for the actions the code implements. A blind derivation from the ontology and the catalogue finds such cases before code is written, and a behavior found later becomes a check.

<!-- ont: inv.test-does-what-check-says@2b7515 -->
### A tag says what a test implements, not that it does

An invariant such as "an item is on at most one open loan" is written in prose, and the check catalogue gives the case with data that proves it. A test names the check in a tag, and the check requires such a test for every automatic check of implemented concepts. It cannot see whether the test actually does what the check says: a test tagged `[check.item.one-open-loan]` that asserts nothing passes. Manual checks are run by a person or an agent; a project may record each run (`manualRuns` in the configuration of the tool, D-78), and the check then lists manual checks without a current run, but it cannot see whether a recorded run was done as its guide says. `--mutate` (D-102) changes the forms one line at a time: a test of a check written against a system must fail on the oracle with every change its check's trace fails on, or it is reported as empty; a test that calls the code directly, not through a system, is not run there, and a change no trace fails on is only listed, since some changes alter nothing that can be observed. On the example it lists 21 of 95 changes; among them, a member at the borrow limit refused one loan early, `open > limit` turned into `open >= limit`, which no check of the example's catalogue tells apart. The checks of the tool count what a project's files register and run, not what they mean: an adapter that answers for the code instead of calling it, or a divergence whose stated effect accepts everything, passes them, and the reviewer of the change reads those two files (`concept.code-adapter`, D-101).

<!-- ont: inv.no-restated-definition@21be03 -->
### Notes can still restate a definition

Each concept has one definition row, in the table of its entity, and no second table explains it again. The notes under a table may still describe a concept in words of their own, and the check compares IDs, not text. In the project where the approach took shape, an explanatory table listed five items where the glossary row listed four; the layout removes the second table, not the temptation.

<!-- ont: ent.mockup-element@54a519 -->
### The mockup cannot show time

A mockup shows a state: overdue, reserved, suspended. It cannot show a loan becoming overdue, a reminder arriving two days before the due date, or a reservation passing to the next person after three days. Hooks, derived values that depend on the date, and rules with durations need tests against code, or traces on the [oracle](parts/oracle.md), where a day is a step; the real calendar passing by itself still needs a run on the live product. A partial substitute is to use the mockup with persistent state and real data for a week or two, so that time-based states actually occur. A person still has to notice them.

<!-- ont: inv.implementation-true@182ebf -->
### The implementation table trusts its author

The check confirms that the files named in the table exist and which of them name the concept in an `ont:` comment, not that they implement it. For the classes that tests must cover, a tagged test is required as well. For the other classes, a row is a claim that a reviewer confirms.

<!-- ont: inv.accepted-never-edited@a7c76a -->
### The decision guard compares text with one earlier commit

`guard-decisions.mjs` refuses an edit or removal of an accepted entry, comparing with `HEAD` before a commit and with the base of a push or pull request in CI. It sees text, not intent: a typo fix in an accepted entry is refused too, by design. `git commit --no-verify` skips the hook, and only CI catches that. A rewritten history removes the base it compares with. It compares the definition rows with the ontology of the same commit, found under its path, under the path the base's configuration names, or under the path git finds it renamed from; when it finds none, it says so and compares nothing. It does not check that a new entry which replaces an older one names it on its `Supersedes:` line; it checks only that the entries named there exist and are older. Before the first commit it has nothing to compare with and says `GUARD_OFF`: until then, accepted entries are protected by review only. It sees that an entry accepted since its base has a `Source:` line, not that the line names where the decision was really made. When the first source arrives within the commits it compares, it asks a source only of the entries numbered after that one, so an older tentative entry accepted in the same commits goes unasked.

<!-- ont: inv.test-names-known-checks@1384c7, inv.code-names-resolve@052349 -->
### Test tags and code names are read anywhere in a file

The tool cannot parse the syntax of every language and test framework, so it reads a tag wherever it appears in a test file, not only in a title, and an `ont:` name wherever it appears in a file it reads for names, not only in a comment. A fixture string that looks like a tag or a name counts as one: an invalid one fails the check, a valid one claims a proof or a name the code does not give. Fixtures that need such strings build them from parts. The same holds for the owner of a code file under `codeNames.owner`: a name ties the file to a concept, and does not prove that the ontology describes everything the file does. Only in Markdown are code blocks and inline code left out, as examples, found as CommonMark finds them, except that a code block inside a block quote is read as text.

<!-- ont: rule.code-names-concepts@701aa5 -->
### Code names live in comments

`ont:` names are comments, and some projects forbid comments or run an agent that deletes them. Such a cleanup deletes the names with the rest, and by default the check only lists implemented concepts their files no longer name, as information. A project that removes comments sets `codeNames.require` in the configuration, so the check fails instead, and tells its cleanup to keep `ont:` names.

<!-- ont: derived.readiness@346c38 -->
### Readiness reads names, not intent

The tool learns that a target waits from the decision log, by the entries that name it. A tentative entry that describes a concept without its ID leaves the concept looking ready, and an accepted entry that mentions a concept in passing counts as naming it. A target that no entry names counts as agreed, since the ontology is the agreed target.

<!-- ont: ent.reference-page@b1ec8f -->
### Reference pages show the target

A generated reference page shows each concept's definition, which describes the target. A page limited to implemented concepts still shows the target definition of a concept that is only partly built: the example's terms page says the borrow limit is set by staff, while the code fixes it at five. The note column of the implementation table is not on the page.

<!-- ont: inv.section-declared@1b1726 -->
### The check reads headings at the top level of a page

Every section of a doc set declares what it explains, and the check finds the sections by their headings. It reads Markdown itself, without a library ([part 5](parts/drift-check.md#design-choices)), and it reads the blocks pages are written in: headings of hashes and underlined ones, code, HTML blocks, rules. A heading inside a block quote or a list item, such as `> ## Notes`, it does not read as a section, so such a section is not required to declare anything. None of the doc sets the approach knows of has one; a project that writes them anchors them by hand, and the reviewer of a change sees them.

<!-- ont: inv.ontology-connected@423c04, rule.link-is-real@452652 -->
### Joined is not right

The check sees that every piece of the ontology is joined to the rest by IDs. It does not see whether a link is true, and one link joins two pieces however large they are. A graph can pass with a link that relates nothing in the product, or with every entity pointing at one that means nothing. The reviewer of a change reads each link it adds (`rule.link-is-real`); the tool does not.

<!-- ont: inv.typed-fields@7e1493 -->
### Types are checked only with contracts

The vocabulary of types is checked where contracts are generated: a project without `contracts` in its configuration may write a type the vocabulary does not have, and nothing reports it. The graph does not read such a type as a link, so it cannot join a piece of the ontology; it only goes unnoticed.

<!-- ont: concept.oracle@88e2a7, rule.form-follows-rows@8006af, inv.form-names-defined@50002b -->
### The oracle runs what its language can say

The forms restate the rows in a small language of records, actions, refusals and days. What the language cannot say stays in prose: screens (views are not in the oracle), the real calendar, errors of reading a state file, lists of references, and processes about text and files, such as parsing a page or comparing a commit. Most rules of the approach itself are of the second kind: they are about pages and commits, and the check's code, not the oracle, runs them. A form also restates its row: where the two disagree the row is the meaning (D-73), and the check sees only that the form's names are defined, not that it says what the row says; a trace that fails, or a reviewer, finds that.

<!-- ont: -->
## Open questions

- **Scale.** One ontology file with about 150 concepts was workable. At what size should it split, and along which lines: by bounded context, by product surface?
- **Several products sharing concepts.** When a word means different things in two neighbouring products, one ontology with namespaces, or two ontologies with a mapping?
- **How much behavior belongs in the ontology.** Too little, and agents guess. Too much, and the ontology becomes the verbose spec that Böckeler criticizes. Formal forms (D-93) put behavior under the tables, folded, so the tables stay the overview; whether people still read the ontology when every row has a form is not known yet.
- **Two languages.** The target model can be written in the team's language while code and user documentation use another. The approach handles this as two vocabularies with recorded divergences. Does it hold up with a larger team?
- **Versioning.** Should the ontology be versioned against releases, or is the decision log enough history?

<!-- ont: -->
## Deferred

- **Other words**: words a project lists for its concepts are searched for in its tickets, doc sets and mockup (D-91). No project has listed any yet, so how many false alarms the check raises is not known; the first project that lists words reports it.
