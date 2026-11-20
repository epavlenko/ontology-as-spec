# Lifecycle of a change

How each kind of change moves through the artifacts. The [agent rules](parts/agent-rules.md) table is the short form of this page.

<!-- ont: action.add-concept@3509fd, inv.ontology-connected@423c04, rule.form-follows-rows@8006af, ent.trace@eb1f36 -->
## A new concept

1. Add a definition row in the section of the entity it constrains or changes: ID, term, type, a definition that says what it is. A field or a relation names the entity in its ID and has a type. A new entity is joined to the rest in the same change, by a relation of its own or of another entity that refers to it; a view names the entities it shows ([One graph](parts/glossary-and-ids.md#one-graph)). `format-ontology.mjs` puts the row in its kind's group and writes the Kind cell.
2. If it needs more than one line, add a note under the table. Refer to related concepts by ID; do not restate the definition.
3. If its class is one the check catalogue requires (invariants and rules by default; also hooks and actions in the example), write its check: a case with data, in the product's terms.
   If the project runs the [oracle](parts/oracle.md), a derived value, rule, invariant, hook or action also gets its formal form in the behavior block under its table, and each check gets a trace, or a line that says why it has none; `ont-check.mjs --run` runs the traces.
4. If the concept exists because of a choice, add a decision entry with the rejected alternatives.
5. Regenerate the tooltip glossary and, for a field or a relation, the contracts.
6. If it appears in the interface, add the map row, then the `data-ont` element in the mockup.
7. If a doc set covers its class, explain it on a page with an anchor; regenerate the reference pages.
8. Add a revision history line to the ontology.
9. Run the check.

Order matters. The definition row comes first, so that nothing else can mention a concept that is not defined.

A concept arrives with something that will try it: a mockup element, a ticket or code. The ontology may run ahead of the code, together with the mockup; that is how a target is designed. What it should not do is grow concepts that nothing has tried. The check lists them as information, "concepts with no mockup element, ticket or implementation yet". Each one is a question for review: show it, plan it, or drop it.

<!-- ont: action.rename-term@677881 -->
## Renaming a term

Change the term and, if needed, the definition in its row. Leave the ID. Update the prose where the term appears. Regenerate the tooltips and the reference pages; reread the doc sections the check lists as anchored to a changed definition, then stamp them. If the rename reflects a change of meaning rather than wording, it is a decision.

<!-- ont: action.change-id@7b44e1, rule.other-thing-new-id@e25b9e -->
## Changing IDs

Rare. It is justified when an ID itself misleads: a class name collides with a term in a neighbouring product, or fields need their entity in the ID because two entities now share a field name. It needs a decision entry that says why the permanence rule is broken. The new IDs replace the old ones in one commit across every artifact except the decision log, and each old ID gets a row under "Retired IDs" with its replacement and the decision. The check confirms nothing was missed: an old ID anywhere but the decision log is reported with its replacement.

An ID also changes when the concept becomes another thing. A better account of the same thing keeps its ID, with a line in the revision history or a decision: "due date" that now counts days the library is open still names the date a loan is due. But if a change would make an ID name something else, say `field.loan.due-date` coming to mean the date a reminder is sent, every artifact that names it would silently point at the new meaning. Then the old ID is retired with its replacement and a decision, and the other thing gets an ID of its own. The tool cannot tell the two cases apart; the reviewer of the change does.

<!-- ont: action.remove-concept@7f8c20 -->
## Removing a concept

Remove its definition row, its checks, its map rows, its mockup elements, its implementation row and the anchors that name it in one commit, with a decision entry, and list the ID under "Retired IDs" with a dash for the replacement. Tests that implemented its checks go too, or are retagged. The check fails if any reference remains outside the decision log. Decision entries that mention the concept stay as they are; the retired table is what keeps their IDs resolvable.

<!-- ont: action.supersede-decision@0d21ae -->
## Changing your mind

Write a new decision entry that supersedes the old one whole, names it on a `- Supersedes:` line, and says why. Never edit the old entry. Then change the ontology, the checks, the map and the mockup to match, reread the doc sections the check lists as anchored to a changed definition, and mention the new decision where the change would otherwise look arbitrary.

<!-- ont: action.cut-slice@2b0910, rule.code-compared-with-oracle@39c0ea -->
## Implementing a concept

1. The concept has its checks in the catalogue. If one is missing, it is written first.
2. A ticket cuts the slice from the gap (`ont-check.mjs --gap`): IDs, checks, out of scope, dependencies, permissions.
3. The agent reads the definition rows, the checks and the decisions for those IDs.
4. Code, a test for each automatic check whose title starts with the check's ID, then the implementation table row. If the code leaves part of the concept out, the row's note names the target concept that adds it; if there is none, add one, with its check, like any new concept.
5. Remove the matching line from known divergences, if there was one; while it stays, `--gap` keeps the slice open.
6. `--gap` with the ticket prints `SLICE_DONE`, and the tests pass. With the oracle, the test that compares the code with it on random sequences of the implemented actions passes too; a difference it finds is a bug, or a known divergence.

<!-- ont: ent.divergence@c86a47, rule.divergence-becomes-work@5253b4 -->
## Finding a divergence

Code disagrees with the ontology. Do not change either side silently. Add a line to known divergences with the IDs involved. Then either open a ticket to bring the code to the target, or, if the code is right and the target was wrong, write a decision and change the ontology.

<!-- ont: ent.tool-copy@cea475, action.update-copy@32bd58, inv.copy-matches-pin@0599d6, inv.tool-options-documented@bc5a7a -->
## Updating the copy of the tool

A project keeps a copy of `tools/ont-check` in a directory of its own, pinned to one commit of the approach, and does not edit it: a fix to the tool is made in the approach and reaches the project with its next copy. `pin.mjs`, which ships with the tool, makes the copy and checks it.

```bash
node ../ontology-as-spec/tools/ont-check/pin.mjs update --dir tools/ontology-as-spec --pin tools/ontology-as-spec.upstream.json
node tools/ontology-as-spec/pin.mjs verify --pin tools/ontology-as-spec.upstream.json
```

The update copies the tool of the clone's `HEAD`, or of `--ref`, without its tests and with the approach's LICENSE, deletes the files the approach removed since the old pin, and writes the pin: the commit, its date, the last decision of the approach and the hash of every file. It lists the decisions since the old pin, which the project reads and carries into its own rules, and the files in the directory that no pin names, which it leaves in place. The verification runs with the check, and fails on a file that is missing or changed and on any file in the directory that the pin does not name. A note the project keeps beside the copy is listed under `own` in the pin.

The copy's README describes every file of the tool, every flag a script reads and every key of the configuration, which the loader lists in a table and reads through a guard that refuses any other; a test of the approach fails when one is missing, so a project can learn from the README alone what the copy it took can do.

<!-- ont: ent.protocol-release@1658b5, inv.release-tagged@03dba1, action.release-protocol@7efb0e, derived.newer-releases@717644, field.tool-copy.approach-clone@23b84e, edge.protocol-release.changes@29d6cb, field.protocol-release.version@8478cc, field.protocol-release.verified@39bde7, field.protocol-release.date@10466a -->
## Releases of the approach

A release of the approach has a version of [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) with three numbers and two commits: the verified commit, on which `npm test` and the check passed, and the release commit, its child, which only adds the release's entry to `releases.md`, `## v<version> · <date>` with `- Verified: <commit>`. The [annotated tag](https://git-scm.com/docs/git-tag) `v<version>` is on the release commit. The tag `v0.1`, made before releases were recorded, is the starting point, read as 0.1.0, and has no entry (D-109).

```bash
node tools/ont-check/release.mjs 0.2.0     # in a clean work tree: the checks on HEAD, then the release commit and its tag
node tools/ont-check/release.mjs --resume  # when it stopped before the tag: the checks again on the verified commit, then the tag
```

A release's changes are the entries the decision log gained since the verified commit of the release before, or the commit of `v0.1`; the tag's message lists them, and nothing is written by hand, as [Keep a Changelog](https://keepachangelog.com) would have it written. The check of the approach fails on an entry without its tag, on a tag without its entry, `v0.1` aside, and on a tag whose commit is not the release commit of its entry: the child of the verified commit that adds exactly that entry, every entry before it kept. `release.mjs` makes that commit with Git's plumbing, which runs no hook, and tags the commit it made, not HEAD read again; `--resume` tags no other (D-114). Releasing the approach is a publication, which waits for the owner.

A project learns of releases from its own clone of the approach, which a clone of the project names once: `git config --local ont.approachClone ../ontology-as-spec`. The check then says, as information that never fails it, which releases the clone knows are newer than the pin, those whose verified commit is not an ancestor of the pin's commit, each read from its tag rather than from the clone's work tree, with its changes and those of them that change the project's rules: accepted entries that name a concept of the approach the project's agent instructions, decision log or ontology use. It also says when there is none among those the clone knows, when the pin's commit is not in the clone, and when no clone is named. A tag of the clone whose commit is not the release commit of its own entry is named, and the releases are then not known in full: it is never skipped in silence (D-114). The check uses no network: `git fetch --tags` in the clone brings new releases (D-110).

<!-- ont: ent.product-release@436295, inv.product-release-intact@be0a6e, rule.intact-is-not-run@dc4e4c, action.release-product@5d9af1, action.verify-release@8d0d50, ent.deployment@805192, inv.deployment-of-release@cab7dd, derived.running-now@007e11, edge.product-release.pin@eae7d6, field.product-release.version@3ee240, field.product-release.commit@fdbf8c, field.product-release.checks@f2c185, field.product-release.tool@b9b182, field.product-release.date@10466a, edge.deployment.release@e74146, field.deployment.environment@10b3dc, field.deployment.time@f8bd33 -->
## Releases of the product

A project that names `releases` in its configuration, a directory and the pin of the protocol, records its releases there, one file each: the version, the commit, the SHA-256 of the pin at that commit, each check run with its result, the version of the tool and the date. `release.mjs --product <version>` makes a temporary worktree at the commit, runs there the project's check and each test suite of the configuration of that commit, and writes the record only when none failed and each ran a test (D-111). A suite whose tests were skipped, as a judged suite without its judge, is recorded as skipped with how many, never as passed (D-116).

The check finds every record intact: its commit is in the project's history, the pin's hash is the one at that commit, its checks are exactly those the configuration at that commit requires, not today's, each passed or skipped. That is integrity, not proof: a record can be written by hand. `release.mjs --verify <version>` checks the record's integrity first and runs nothing for a record that does not hold; then it runs the checks again on the commit and compares them with the record, where a suite the record says was skipped may pass. A reviewer of a release, and anyone who does not trust its record, runs it.

A deployment, optional, is a file in the same directory with the release, the environment and the time. Every deployment names a release with a record, and `ont-check --releases` prints, for each environment, the release of its latest deployment: what runs there now.

<!-- ont: action.add-concept@3509fd, ent.decision@4607b2, action.update-copy@32bd58, ent.agent-rules@99af23, ent.check@d0dcbc, ent.implementation-row@f093f9, ent.mockup-element@54a519, ent.doc-set@ca5d70 -->
<!-- ont: concept.oracle@88e2a7 -->
## Adopting the approach

Start small. The approach pays off before every part is in place.

1. **Ten concepts.** Write the ten concepts people argue about most, with IDs and one-line definitions, in an `ontology.md` with one table per entity. This is where the ontology starts, not where it stops: it grows until it describes the product's behavior.
2. **Decision log.** Record the last five decisions that someone would otherwise reverse.
3. **Check.** Copy `tools/ont-check` with `pin.mjs update` (see above), write `ont.config.json` with only the ontology and the decisions, and run it and `guard-decisions.mjs` in the test command and in CI. The config may omit the mockup, map, checks and tickets until they exist.
4. **Agent rules.** Add the "what else to update" table to your agent instructions.
5. **Checks.** Write a check for each invariant and rule, in the product's terms, in `checks.md`.
6. **Target and reality.** When code exists, add the implementation table and the divergences. Tag the tests with the checks they implement, and add `testSuites` to the config: which suite must prove which kind of concept.
7. **Mockup.** When there is a mockup, the first implementation of the interface, label it and add the map.
8. **Documentation.** When there are pages for people, anchor their sections and list them as a doc set; generate the reference pages.
9. **Oracle.** When the rules have settled, set `"oracle": true`, write the formal forms under the tables and a trace for each check, and run `--run`; then compare the code with the oracle ([part 10](parts/oracle.md)).

The [templates](../templates/README.md) have a starting file for each step.
