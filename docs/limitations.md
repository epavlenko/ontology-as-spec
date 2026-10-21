# Limitations and open questions

What the approach does not do, what has not been tested, and what could make it stronger. Four former proposals are implemented in the tool and the example but have not been used in a real project. The proposals in the last section have not been implemented or tried.

## Weaknesses

### Code does not refer to IDs

The check reads the ontology, the mockup, the map, the decision log, the implementation table, the scenarios, the tickets and the tags in test titles. It does not read product code, and product code does not mention concept IDs. A tagged test ties a concept to behavior only as far as the test goes. Code that behaves differently from the ontology in a way no test exercises passes. The implementation table and the list of divergences are maintained by hand. In the project where the approach took shape, this is partly a matter of timing: most of the target model had not reached code yet. In general it is a real gap. The [Spec Growth Engine](comparison.md#the-spec-growth-engine) closes a version of it by reading code structure.

### A tag says what a test proves, not that it proves it

An invariant such as "an item is on at most one open loan" is written in prose. A test names it in a tag, and the check requires such a test for every implemented invariant, rule and derived value. The check cannot see whether the test actually exercises the rule: a test tagged `[inv.one-loan-per-item]` that asserts nothing passes. Tickets state expected behavior as tagged GIVEN/WHEN/THEN scenarios, but the check does not match a scenario to the test that implements it. Verification scenarios in `features/` remain recipes, not automated checks.

### Notes can still restate a definition

Each concept has one definition row, in the table of its entity, and no second table explains it again. The notes under a table may still describe a concept in words of their own, and the check compares IDs, not text. In the project where the approach took shape, an explanatory table listed five items where the glossary row listed four; the layout removes the second table, not the temptation.

### The mockup cannot show time

A mockup shows a state: overdue, reserved, suspended. It cannot show a loan becoming overdue, a reminder arriving two days before the due date, or a reservation passing to the next person after three days. Hooks, derived values that depend on the date, and rules with durations need tests against code. A partial substitute is to use the mockup with persistent state and real data for a week or two, so that time-based states actually occur. A person still has to notice them.

### The implementation table trusts its author

The check confirms that the files named in the table exist, not that they implement the concept. For the classes that tests must cover, a tagged test is required as well, which is a mechanical counterpart, though a weak one (see above). For the other classes, "implemented" still means "someone said so".

### The decision guard compares text with one earlier commit

`guard-decisions.mjs` refuses an edit or removal of an accepted entry, comparing with `HEAD` before a commit and with the base of a push or pull request in CI. It sees text, not intent: a typo fix in an accepted entry is refused too, by design. `git commit --no-verify` skips the hook, and only CI catches that. A rewritten history removes the base it compares with. It does not check that a superseding entry names the entry it supersedes.

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

## Implemented, not yet tried in a real project

These were proposals until [D-08 and D-09](../decisions.md). They work on the example and are covered by the check's tests. None has been used in a real project.

- **Tests linked to IDs.** A test title starts with the IDs it proves: `test("[inv.one-loan-per-item] an item cannot be on two loans")`. The check requires a tagged test for every implemented concept of the classes listed under `tests.cover` (invariants, rules and derived values in the example), and refuses a tag naming a concept the implementation table does not list. See [part 6](parts/verification-map.md#tests-that-name-ids).
- **GIVEN/WHEN/THEN scenarios in tickets.** A ticket states its expected behavior as one-line scenarios, each starting with the tag its test will carry: `- [inv.queue-order] GIVEN … WHEN … THEN …`. The check requires at least one scenario per ticket, the three keywords on every line and tags from the ticket's `IDs:` line. See [part 8](parts/agent-workflow.md#scenarios).
- **One home per definition.** The ontology has one table per entity, and every concept is one row in one of them, grouped by kind in a fixed order. There is no separate glossary table and no per-kind table that explains the concepts again. The check enforces the kind order, the Kind cells and that each field or relation sits with its entity. See [part 1](parts/glossary-and-ids.md).
- **Guarded decisions.** `tools/ont-check/guard-decisions.mjs` compares every accepted entry with an earlier commit and fails if one changed or disappeared. It runs in the pre-commit hook and in CI. See [part 2](parts/decision-log.md#what-the-check-enforces).

## Proposed strengthening

Neither is implemented. Both came out of comparing the approach with SDD tools.

1. **Do not expand the ontology ahead of the code.** When the target model is far ahead of the implementation, new concepts add review cost without feedback. Freeze expansion until delivery stages have reached code, and let what implementation teaches drive the next additions.
2. **Generate contracts from fields.** Generate schemas or typed contracts from the field and relation rows of each entity table. It is a narrow, deterministic step toward spec-as-source for the part of the ontology that is precise enough.
