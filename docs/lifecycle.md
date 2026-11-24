# Lifecycle of a change

How each kind of change moves through the artifacts. The [agent rules](parts/agent-rules.md) table is the short form of this page.

<!-- ont: ent.merge-gate@572acd, rule.main-through-gate@65a8ba, rule.ci-from-main@e2531a, inv.gate-change-approved@e3880c, ent.gate-change@f99bb2, rule.merge-what-was-checked@4ce98e -->
## Merging into main

Main is changed only through a pull request that GitHub merges, by a merge commit, once two checks passed on its head and its branch contains main (D-165). The ruleset of main requires both by name and by the GitHub Actions app that reports them, and lets no one bypass it; its settings and the permissions of Actions are kept in `.github/merge-gate.json`, from which an agent creates the ruleset through the GitHub API (`node tools/ont-check/merge-gate.mjs ruleset` prints it).

- **The full check**, `ont-check`, runs on `pull_request`: the check of the approach, the example and the templates, the guard of decisions against the pull request's base, which fails when that base is not found, and every test suite but the judged. It runs the pull request's code, so a pull request could weaken it by editing it.
- **The guard**, `ont-gate-guard`, runs on `pull_request_target`, so its definition and code come from main. It fetches the pull request's commits as data, lists the paths the final diff changes and reads the records at its head; it runs nothing of the pull request. It refuses a change of a gate path, any file through which the full check could be weakened, that no record of a gate change approves: the record names the task, the approved version of its statement by its hash, the item of What to do that allows the change, the paths, and the last commit of the pull request that changes a path outside `reviews/`, never a later commit of records alone such as a record of done, after which the pull request has only commits of records.

The executor merges through the API with the merge method and the head's commit as the condition, `gh api -X PUT repos/<owner>/<repo>/pulls/<n>/merge -f merge_method=merge -f sha=<head>`, after `node tools/ont-check/merge-gate.mjs records-only --reviewed <reviewed> --head <head> --base <main>` confirms that the head is past the commit the reviewer of the result checked only by records under `reviews/`: outside them, the head's tree must be the reviewed commit merged with main as Git merges them, so a resolution that takes main's version of a reviewed file, or a merge that conflicts outside `reviews/`, is refused and needs a review of its own. After the narrow round that follows a confirmed condition, the commit compared is that of the record of done that ends the range of fixes, which records-only finds in the records at the head, and without it the reviewed commit, never the head (`rule.fixes-held-by-tests`). An update of the branch with main changes the head and asks for that again. A Git command that fails, in the guard or here, is an error, never a diff without changes. The guard binds a record of a gate change to its commit: that commit is the last of the pull request that changes a path outside `reviews/`, each path the record lists changes between the merge base and it, the record is added by the commit whose one parent it is, and after it the head changes nothing outside `reviews/` but by merging main.

<!-- ont: rule.merge-by-task-state@305ad5, rule.records-only-pr@846d6f, derived.pr-task@66b6c5, field.merge-gate.task-state@fba10b, inv.gate-path-in-approval@b3be3a, ent.publish-permission@fecd62, action.record-publication@eb7ff4 -->
### The state of the task

Where the configuration at the base of a pull request sets `mergeGate.taskState`, the guard also holds the merge by the state of the task (D-185). It decides by paths: a pull request that changes any file that is not a record of the process, a ticket, a page or a line of text among them, is a change of a task. Its task is the one its records of done and of gate changes name, records it adds and the writers sealed; its description is never read. With no record of done, or records of two tasks, the guard refuses it, `TASK_UNNAMED`. It then reads the task's next action at the head, by the function `--task` asks, from the records at the head and no statement's file: only the merge passes, `TASK_NOT_DONE` otherwise, so the approval in force, the record of done, its rounds, an acceptance that holds and no open gate are all required. Outside `reviews/` the head must be the commit that ended the task merged with main, what `records-only` confirms, `TASK_HEAD_UNREVIEWED`; no commit of the work may be older than the task's first approval, `WORK_BEFORE_APPROVAL`, but for the files the filed findings of the rounds of its statement name; and the owner must have allowed its publication, `MERGE_UNPERMITTED`. A gate path changes only within the line `Gate-paths:` of the approval in force, which the statement gives and the clean round of its review or the owner's approval carries, `GATE_PATH_OUTSIDE_APPROVAL`.

The owner's permission to publish is a record of its own, written by `node tools/ont-check/approve.mjs --kind publish --scope <goal or task> --question <N> --english <file>` from his answer in the registry, whose option has the value `publish`: `Kind: publish` and `Scope:`, a goal of `goals` or a task, and no version of a statement. The writer compares the answer with the registry; CI, which does not read the registry, reads the record's seal, its kind and its scope, and the goals from the configuration at the base, so a pull request cannot put its task into another permission. A pull request of records alone, of probes, verdicts or rounds, needs no chain and passes on any permission to publish the base holds.

<!-- ont: inv.rules-match-file@02c02f, action.compare-rules@1e7984, field.merge-gate.drift-workflow@795ef7 -->
### The rules on GitHub

`node tools/ont-check/merge-gate.mjs rules --repo <owner>/<repo>` compares the rules of main on GitHub with `.github/merge-gate.json` (D-185). The guard's last step runs it on each pull request with `--fields token`, the fields its read-only token reads: the ruleset, its enforcement, its target and condition, the types of its rules, the methods of merge, the required checks by name and app and the branch up to date with main; a difference is `RULES_DRIFT`, and a field it could not read `RULES_UNREAD`, both a refusal. GitHub gives the actors that bypass a ruleset only with the right to write, so `--fields all`, with them and the settings of Actions, runs in `--task` before each step with the executor's `gh`, where a difference is the question to the owner, and in the daily workflow `.github/workflows/ont-rules-drift.yml` on main, which runs even when the rule of pull requests is taken off and says what its token cannot read.

<!-- ont: rule.gate-switched-on@2e2b00 -->
### Switching the gate on

After the merge of the task that brings the gate, the executor runs `node tools/ont-check/merge-gate.mjs switch-on --repo <owner>/<repo>` and takes the steps it prints, in their order (D-163). It prints them from `.github/merge-gate.json`, each with its `gh api` calls and the values of the rule file it sets or compares, so that the steps cannot fall behind the settings they apply; a readback that differs from the rule file stops the switch-on. Each Actions policy is read back by its own call, since the list of policies gives summaries and only the policy's own response holds the conditions and rules to compare. The order matters: GitHub blocks `pull_request_target` in a public repository without an event policy that allows it, so the policy comes before the pull request of records on which both checks must first pass, and the ruleset is created only after that pull request showed them; the first gate proof keeps what it showed.

The positive proof is the merge of the pull request of the next task through the gate, after that task starts.

<!-- ont: ent.gate-proof@402ba8, inv.gate-records-well-formed@282c3f -->
### Proving the gate

A gate is proven on GitHub after the merge of the task that brings it: the probes the gate refuses, such as a pull request whose check is broken on purpose, and later an ordinary merge through it. Each is recorded as a gate proof in `reviews/tasks/`: the gate, refusal or pass, the probe and its result, the head and base of the pull request, read before the attempt, the check, its run and the required check with their results, GitHub's answer to a refused attempt or the merge commit of a pass, and the time, in English with paths of the repository. The probe refused for being behind keeps the base and head read before main moves on and, on a line of its own, `Main-after`, the tip of main read after it moved; the check refuses such a record without that tip, without the base, or whose base is the tip, read too late. The pull request of a probe is closed and its branch deleted. The check refuses a record of a gate change or of a gate proof that lacks a line its kind needs, and a gate proof whose kind is not refusal or pass, or whose result disagrees with its kind: a refusal was refused, and a pass, the merge of a pull request, merged.

<!-- ont: rule.early-pre-commit@1e697f -->
### The early hook

`npm install` sets the clone's hooks to `.githooks/`; its pre-commit hook runs the check and the guard of decisions on the content of the commit, its index, whatever paths it changes. It is an early signal, not a gate: `--no-verify` and a clone without hooks skip it, and only the checks on the server hold a merge.

<!-- ont: rule.tree-after-server-merge@2794d3 -->
### The tree after a merge on the server

A merge made on GitHub runs no hook in any clone, so the executor brings the clone that serves the ontology tree to it: in that clone, on main, or in a temporary worktree of main when the clone is on another branch, it confirms that `git config --path ont.treeOut` gives an absolute path, runs `git pull --ff-only`, confirms that HEAD is the merge commit on `origin/main`, runs `node tools/ont-check/gen-tree.mjs --stale`, and when the tree is stale `--refresh` and `--stale` again. Since `--stale` says nothing of a fresh tree, it then confirms that the page's footer, `built from`, names the merge commit.

<!-- ont: rule.copy-verified-in-ci@1eddb8, inv.ci-workflow-present@9cc80d -->
### A project's CI

The templates give a project the workflow of its full check, `templates/.github/workflows/ont-check.yml`. The project copies it to `.github/workflows/` and writes in its directory of the tool, its configuration, its test command and, when its copy of the tool is pinned, the pin `pin.mjs` wrote, inside the copy's directory or outside it; the workflow then runs `pin.mjs verify --pin` first, so that an edited copy turns the check red. The project's configuration names the workflow under `ci.workflow`; the check reports a configuration that names none, and fails when the file it names is missing.

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

The update also writes `copy.json` in the copy's directory, naming the commit it copied from, and lists it under `own`: the copied files stay the commit's, so the verification passes at once, and `--review` links each check of run of the approach to its section of the [run guide](run-guide.md) at that commit, wherever the pin lives (D-165).

<!-- ont: rule.tool-before-files@9d5ec3, field.tool-copy.copy-info@cd7554 -->
### Moving to a new format

When the approach changes a format, as when the proof `manual` became `review` and `run` and the key `manualRuns` became `verdicts` (D-154, D-165), the new version of the tool reads the earlier format as before, names what to move, and keeps reading it until a decision retires that reading; an older tool does not read the new format. So a project updates in this order (`rule.tool-before-files`):

1. Update the copy with the `pin.mjs` of the version you update to, the one of its clone, or of its copy with `--ref`, not the copy you have: an older `pin.mjs` does not write what the new version expects, such as `copy.json`.
2. Run the check. It passes on the earlier files and lists what to move: checks whose proof is `manual`, a doc set that lists `["manual"]`, the key `manualRuns`. A run guide that lists `["manual"]` still asks for a section of every earlier manual check, so the first update loses none.
3. Move the files: each check `manual` becomes `review`, when a reviewer gives the verdict reading the change, or `run`, when an agent carries it out on the product, with its section in a run guide; the guide's set lists `["run"]`; the key becomes `verdicts`. A check that became `run` needs a new verdict, since its stamp changed; a check that became `review` keeps its records.

The copy's README describes every file of the tool, every flag a script reads and every key of the configuration, which the loader lists in a table and reads through a guard that refuses any other; a test of the approach fails when one is missing, so a project can learn from the README alone what the copy it took can do.

<!-- ont: ent.protocol-release@1658b5, inv.release-tagged@b9f60e, action.release-protocol@7efb0e, derived.newer-releases@55e02f, field.tool-copy.approach-clone@23b84e, edge.protocol-release.changes@29d6cb, field.protocol-release.version@8478cc, field.protocol-release.verified@39bde7, field.protocol-release.date@10466a -->
## Releases of the approach

A release of the approach has a version of [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) with three numbers and two commits: the verified commit, on which `npm test` and the check passed, and the release commit, its child, which only adds the release's entry to `releases.md`, `## v<version> · <date>` with `- Verified: <commit>`. The [annotated tag](https://git-scm.com/docs/git-tag) `v<version>` is on the release commit. The tag `v0.1`, made before releases were recorded, is the starting point, read as 0.1.0, and has no entry (D-109).

```bash
node tools/ont-check/release.mjs 0.2.0     # in a clean work tree: the checks on HEAD, then the release commit and its tag
node tools/ont-check/release.mjs --resume  # when it stopped before the tag: the checks again on the verified commit, then the tag
```

A release's changes are the entries the decision log gained since the verified commit of the release before, or the commit of `v0.1`; the tag's message lists them, and nothing is written by hand, as [Keep a Changelog](https://keepachangelog.com) would have it written. The check of the approach fails on an entry without its tag, on a tag without its entry, `v0.1` aside, and on a tag that is not a release: one that is not annotated, or whose commit is not the release commit of its entry, the child of the verified commit that adds exactly that entry, every entry before it kept: the two logs are compared as ordered lists of whole entries, so a second copy of an earlier entry added with it is refused, by the check and by a project's news alike (D-126). More: the release commit's `releases.md` is byte for byte the verified commit's with the entry appended as `release.mjs` appends it, by the same function, and every entry is read strictly, its heading, one blank line and one line `- Verified:`, so an entry with a second line `- Verified:` or a line of another kind cannot be read and no reader takes the first of two values (D-140). `release.mjs` makes that commit with Git's plumbing, which runs no hook, and tags the commit it made, not HEAD read again; `--resume` tags no other (D-114). Releasing the approach is a publication, which waits for the owner.

A project learns of releases from its own clone of the approach, which a clone of the project names once: `git config --local ont.approachClone ../ontology-as-spec`. The check then says, as information that never fails it, which releases the clone knows are newer than the pin, those whose verified commit is not an ancestor of the pin's commit, each read from its tag rather than from the clone's work tree, with its changes and those of them that change the project's rules: accepted entries that name a concept of the approach the project's agent instructions, decision log or ontology use. It also says when there is none among those the clone knows, when the pin's commit is not in the clone, and when no clone is named. A tag of the clone that is not a release, by the one test the check of the approach asks too, `v` and three numbers, annotated, on the release commit of its own entry, is named, and the releases are then not known in full: it is never skipped in silence, and a lightweight tag is never counted (D-114, D-122). The check uses no network: `git fetch --tags` in the clone brings new releases (D-110).

<!-- ont: ent.product-release@436295, inv.product-release-intact@2a3de9, rule.intact-is-not-run@dc4e4c, action.release-product@0cc122, action.verify-release@a268e3, ent.deployment@312e1c, inv.deployment-of-release@cab7dd, derived.running-now@007e11, edge.product-release.pin@e7c05b, field.product-release.version@806641, field.product-release.commit@fdbf8c, field.product-release.checks@823688, field.product-release.tool@45fde1, field.product-release.date@10466a, edge.deployment.release@e74146, field.deployment.environment@10b3dc, field.deployment.time@f8bd33 -->
## Releases of the product

A project that names `releases` in its configuration, a directory and the pin of the protocol, records its releases there, one file each, named by its version, `1.0.0.md`: the version, the commit, the SHA-256 of the pin at that commit, the file `releases.pin` names in the configuration of that commit, so that a later move of the pin leaves the release as it was, each check run with its result, the version of the tool and the date. The version of the tool is the commit of the approach the pin at the release's commit names, or that commit itself when the pin names none, as in the approach's own example; the check compares the record's `Tool:` with it. It says which tool the commit carries, not that it ran (D-141). The checks run with the tool of the commit, in the directory `releases.tool` of the configuration at that commit names, or else the directory of its pin, where a copy keeps `upstream.json`; a commit that lacks the tool, the pin or a suite's directory cannot be run, and the action says what it lacks rather than run into it (D-142). Each of these paths is read by one function from the directory of the configuration, where `.` and the empty path are the root of the repository, always at the commit (D-146), and is held to its kind at the commit: the configuration, the pin and the tool must be files and each suite's place a directory, so a `releases.pin` that names a directory is refused by the release, the check and `--verify`, never hashed as Git's listing of it (D-149). `release.mjs --product <version>` makes a temporary worktree at the commit, runs there the project's check and each test suite of the configuration of that commit, and writes the record only when none failed and each ran a test (D-111). A suite whose tests were skipped, as a judged suite without its judge, is recorded as skipped with how many of how many, never as passed (D-116). It refuses a commit outside the history of HEAD before anything runs, and validates the record it would write by the function the check uses before writing it, so it never writes a record the check refuses (D-125). It opens the file exclusively and never writes over one that exists (D-127).

The check finds every record intact: its commit is in the project's history, the pin's hash is the one at that commit, its checks are exactly those the configuration at that commit requires, not today's, each passed or skipped, a skipped one with its counts, and only a test suite skipped: the project's check passes or fails (D-127). That is integrity, not proof: a record can be written by hand. `release.mjs --verify <version>` checks the integrity of the whole version first, every record of it, read or not, and runs nothing for a version that does not hold or has two records (D-127); then it runs the checks again on the commit, with the tool, the pin and the suites read from that commit and its configuration, so that a later move of the tool's directory leaves the release as it was, and says the tool it ran with (D-142), and compares them with the record, where a suite the record says was skipped may pass, and one skipped again gives the same counts (D-125). A reviewer of a release, and anyone who does not trust its record, runs it.

A deployment, optional, is a file in the same directory with the release, the environment and the time, under any name but a version's, so a release never meets it (D-127). Every deployment names a release with a record, and `ont-check --releases` prints, for each environment, the release of its latest deployment: what runs there now.

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
