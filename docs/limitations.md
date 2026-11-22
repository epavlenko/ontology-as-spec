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

<!-- ont: field.task-statement.budget@86d641, derived.task-budget@43edc0 -->
### A task's reserve is read with two decimal digits

A statement's `Budget-reserve:` and the configuration's `budget.reserve` take at most two digits after the point, so the cap of a task's budget is exact. The configuration is JSON, and its parser rounds a long fraction to a number before the tool reads it, so a value that rounds to two digits passes the check. A record of done that `done.mjs` itself wrote before the rule, with a reserve of three digits such as `1.125`, is refused by the check even beside a later, correct one. If the approved statement still gives that reserve, correct the statement and have the corrected version approved first; then remove the old record, record done again, and give again in a new round the acceptance given for it. An `Overspend:` line in the earlier text is refused and written again. Each arises from a configuration edited by hand or a record the earlier tool wrote (D-150).

<!-- ont: derived.approval@7ae7ed, derived.statement-state@749d42 -->
### A later version of a statement is trusted to keep the owner's items

A finding `not fixable` is a question to the owner, and only his record of approval of a new version answers it; a clean round of review cannot. When the author edits a statement for any other reason, a clean round of its review approves the new version. The tool compares versions by their hash only: it does not see whether a version approved by a round still holds every item the owner decided, with its source, nor whether an edit changed one of them, which would need his approval. The reviewer of the new version judges that, against the owner's words (D-152).

<!-- ont: rule.rounds-converge@771d2a, derived.next-round@9e91d6 -->
### The tool does not see whether the design changed after stagnation

When the rounds stagnate, `--task` and `--rounds` say to change the design of the solution rather than patch it, and then what `derived.next-round` names follows, except after the one round that follows a confirmed condition, where the owner is asked instead and nothing is redesigned before his approval (D-153). The tool reads only the records of rounds: it cannot tell a new design from another patch, nor whether the next round read the whole change. The reviewer of that round judges both (D-152).

<!-- ont: rule.findings-filed@a0eba5 -->
### A filed finding is trusted to belong where it is filed

The tool checks that a finding filed as `limitation` or `later` names `docs/limitations.md` or a file under `issues/` that holds its class word for word, and refuses it in a verdict of acceptance. It does not see whether the finding is a rare history, whether the step of usual work the notes name is real, whether the finding is outside the approved statement, or whether the text there says what the finding means. The executor decides that (`rule.executor-triage`); the reviewer of the next round, if there is one, may name a wrong filing as a finding (D-153).

<!-- ont: field.review-round.condition@b7e15c, derived.next-round@9e91d6 -->
### A full round after a confirmed condition counts as the one round

Once a reviewer of the result has confirmed the goal's condition, the one round allowed after it should be narrow. The tool counts whatever round is recorded next, narrow or full, as that one round: a full round written in its place ends the step when it is clean and is the owner's question when it is not, and it opens no second round (D-153).

<!-- ont: rule.executor-triage@6569c2, rule.findings-filed@a0eba5 -->
### A finding filed in the round that ends the step is seen by no reviewer

The executor files a rare history in the commit of the round's record. When that round is the one that ends the step, the confirmed condition or the one round after it, no later reviewer reads the filing: by the owner's answer "1020 b", the executor decides and the merge follows, so whether such a filing is right rests on the executor alone (D-153).

<!-- ont: inv.named-commits-resolve@ba7f87, inv.acceptance-after-done@84529f -->
### A record of acceptance of a wrong commit, corrected later, still fails the check

A round of the result whose verdict of acceptance names a commit that is not the one the record of done is of is refused by the check. A later round that corrects it ends the step, but the refused verdict of the earlier record is still reported by the check until that record is moved or removed (D-153).

<!-- ont: rule.findings-filed@a0eba5 -->
### A filing is looked up in the working tree, not in the commit of the record

The tool looks up the file a filed finding names, and the class it holds, in the working tree of the repository, not in the commit of the round's record. A filing written but not yet committed, or removed after the commit, is read as the working tree has it (D-153).

<!-- ont: derived.budget-report@63246a -->
### The tool prints the marks of the budget, not that they were sent

`--task` prints a line `REPORT` with the marks of half the limit and the limit that the spend has passed, each run it is given. It keeps no record of which marks were reported: the executor sends the owner one report with every mark not yet reported, and the tool does not see that it was sent, nor stops when it was not (D-152).

<!-- ont: rule.records-english-in-repo@6e97a3 -->
### Records refuse a path strictly

A record of a run or of a round may name no path outside the repository, and the check finds one without reading Markdown. After a line's web URLs and HTML end tags are dropped, it refuses a prefix that names something on a machine anywhere in the line (`/home/`, `/Users/`, `/tmp/`, `~/`, a drive such as `C:/`, `\\server`, `file:`, `mailto:`), an absolute path or a URL of another scheme where no letter or digit stands before it, and any `..` next to a slash. So a path inside the repository written with `..`, such as `docs/../README.md`, or one after a combining mark, is refused too, and is written from the repository's root instead. A web URL is taken up to a comma or a bracket, so one with a comma in it is cut there (D-151).

<!-- ont: inv.accepted-never-edited@a7c76a, rule.guard-from-acceptance@beced5 -->
### The decision guard compares text with one earlier commit

`guard-decisions.mjs` refuses an edit or removal of an accepted entry, comparing with `HEAD` before a commit and with the base of a push or pull request in CI. It sees text, not intent: a typo fix in an accepted entry is refused too, by design. `git commit --no-verify` skips the hook, and CI catches that only when its base already has the entry: CI compares with the base of the push or pull request, so an entry accepted after that base, such as one accepted and then edited on the same branch, is new to it, and the edit goes unseen. Once such an edit is committed, the hook compares the next commits with it: the edited text is the new `HEAD`, and restoring the text the entry was accepted with is then refused as an edit. Only the guard run with a base between the commit that accepted the entry and the edit sees it. The rule that would close this is a target, not built: the guard would compare each accepted entry with its text in the first commit that accepted it, and an entry accepted before the commit that brings the rule in with its text in that commit, so that entries already edited and merged do not fail every run (`rule.guard-from-acceptance`). It waits for the owner's answer to the tentative entry D-131, and ticket 6 takes it. A rewritten history removes the base it compares with. It compares the definition rows with the ontology of the same commit, found under its path, under the path the base's configuration names, or under the path git finds it renamed from; when it finds none, it says so and compares nothing. It does not check that a new entry which replaces an older one names it on its `Supersedes:` line; it checks only that the entries named there exist and are older. Before the first commit it has nothing to compare with and says `GUARD_OFF`: until then, accepted entries are protected by review only. It sees that an entry accepted since its base has a `Source:` line, not that the line names where the decision was really made. When the first source arrives within the commits it compares, it asks a source only of the entries numbered after that one, so an older tentative entry accepted in the same commits goes unasked.

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
## Kinds of checks the approach does not run yet

A check of the approach is proven by a test, by a test whose output a model judges, by a reviewer's verdict on a change, or by an agent's run on the product. The industry uses more kinds of checks than these, and the approach has no concept, no gate and no record for the following ones yet. A project can run them on its own; the approach does not ask for them, does not see them and does not count them.

- **Fuzzing.** Random and broken input, to find crashes and holes in the code that reads it. It matters where a product reads data it does not control: forms, files, an API, and the records and tables this tool parses.
- **Performance testing**: load, stress, soak and spike. How fast the product answers and how it holds up as users and data grow.
- **Dynamic security testing and penetration testing.** Attacks on the running system, by a tool, a person or an agent. The reviewer reads a change for security problems, but nothing attacks the product.
- **Calibration of a judge.** Whether the model that judges a judged check agrees with people on a sample of its verdicts.
- **Exploratory testing.** A search, by a person or an agent, for what no check was written for. The catalogue proves only the checks it holds; a blind derivation from the ontology comes closest, and it is bounded by the ontology.
- **Usability testing.** Whether people, or agents that simulate them, reach their goal in the product.
- **Red teaming.** Deliberate attacks on a product that uses a model: getting round its rules, leaking data, instructions hidden in data. The suite of attacks on the process of the approach is red teaming of the approach itself.
- **Smoke tests.** Whether the system starts at all after a build or a deployment.
- **Canary releases.** A new version on a small share of the traffic, its metrics compared with the old one.
- **Synthetic monitoring.** Scenarios run on a schedule against the product in production.
- **Observation of real users**: metrics of real use, service levels, evaluations of a model's answers on real traffic.

The approach ends at a release. The last five begin after it, and the approach has no stage after a release yet.

<!-- ont: -->
## Open questions

- **Scale.** One ontology file with about 150 concepts was workable. At what size should it split, and along which lines: by bounded context, by product surface?
- **Several products sharing concepts.** When a word means different things in two neighbouring products, one ontology with namespaces, or two ontologies with a mapping?
- **How much behavior belongs in the ontology.** Too little, and agents guess. Too much, and the ontology becomes the verbose spec that Böckeler criticizes. Formal forms (D-93) put behavior under the tables, folded, so the tables stay the overview; whether people still read the ontology when every row has a form is not known yet.
- **Two languages.** The target model can be written in the team's language while code and user documentation use another. The approach handles this as two vocabularies with recorded divergences. Does it hold up with a larger team?
- **The guard's point of comparison.** Should the guard compare an accepted entry with the text of the first commit that accepted it, rather than with `HEAD`, and from which commit on, so that edits merged before the change do not fail the check? The owner answered it with D-131 ("1008 a", 2026-11-20): the first commit that accepted the entry, from the commit that brings the rule in; the target `rule.guard-from-acceptance` waits to be built. Meanwhile the hook refuses the restore of an entry edited with `--no-verify` as an edit. Once, for the restore of D-105 on branch protocol/tree-refresh, the owner chose to commit that restore with `--no-verify` and say so in its message (the owner's answer "1006 a" of 2026-11-20); that was one choice for one restore, not a rule. The question is held by [ticket 6](../issues/0006-guard-point-of-comparison.md).

Versions are no longer an open question: a release of the approach is an entry of `releases.md` and its tag, a release of a product records the commit and the pin its checks passed on, and both are described in the lifecycle, [Releases of the approach](lifecycle.md#releases-of-the-approach) and [Releases of the product](lifecycle.md#releases-of-the-product) (D-109, D-111).

<!-- ont: -->
## Deferred

- **Other words**: words a project lists for its concepts are searched for in its tickets, doc sets and mockup (D-91). No project has listed any yet, so how many false alarms the check raises is not known; the first project that lists words reports it.
