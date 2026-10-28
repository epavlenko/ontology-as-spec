# Lifecycle of a change

How each kind of change moves through the artifacts. The [agent rules](parts/agent-rules.md) table is the short form of this page.

<!-- ont: action.add-concept@3509fd -->
## A new concept

1. Add a definition row in the section of the entity it constrains or changes: ID, term, type, a definition that says what it is. A field or a relation names the entity in its ID and has a type. `format-ontology.mjs` puts the row in its kind's group and writes the Kind cell.
2. If it needs more than one line, add a note under the table. Refer to related concepts by ID; do not restate the definition.
3. If its class is one the check catalogue requires (invariants and rules by default; also hooks and actions in the example), write its check: a case with data, in the product's terms.
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

<!-- ont: action.change-id@7b44e1 -->
## Changing IDs

Rare. It is justified when an ID itself misleads: a class name collides with a term in a neighbouring product, or fields need their entity in the ID because two entities now share a field name. It needs a decision entry that says why the permanence rule is broken. The new IDs replace the old ones in one commit across every artifact except the decision log, and each old ID gets a row under "Retired IDs" with its replacement and the decision. The check confirms nothing was missed: an old ID anywhere but the decision log is reported with its replacement.

<!-- ont: action.remove-concept@7f8c20 -->
## Removing a concept

Remove its definition row, its checks, its map rows, its mockup elements, its implementation row and the anchors that name it in one commit, with a decision entry, and list the ID under "Retired IDs" with a dash for the replacement. Tests that implemented its checks go too, or are retagged. The check fails if any reference remains outside the decision log. Decision entries that mention the concept stay as they are; the retired table is what keeps their IDs resolvable.

<!-- ont: action.supersede-decision@0d21ae -->
## Changing your mind

Write a new decision entry that supersedes the old one whole, names it on a `- Supersedes:` line, and says why. Never edit the old entry. Then change the ontology, the checks, the map and the mockup to match, reread the doc sections the check lists as anchored to a changed definition, and mention the new decision where the change would otherwise look arbitrary.

<!-- ont: action.cut-slice@2b0910 -->
## Implementing a concept

1. The concept has its checks in the catalogue. If one is missing, it is written first.
2. A ticket cuts the slice from the gap (`ont-check.mjs --gap`): IDs, checks, out of scope, dependencies, permissions.
3. The agent reads the definition rows, the checks and the decisions for those IDs.
4. Code, a test for each automatic check whose title starts with the check's ID, then the implementation table row. If the code leaves part of the concept out, the row's note names the target concept that adds it; if there is none, add one, with its check, like any new concept.
5. Remove the matching line from known divergences, if there was one; while it stays, `--gap` keeps the slice open.
6. `--gap` with the ticket prints `SLICE_DONE`, and the tests pass.

## Finding a divergence

Code disagrees with the ontology. Do not change either side silently. Add a line to known divergences with the IDs involved. Then either open a ticket to bring the code to the target, or, if the code is right and the target was wrong, write a decision and change the ontology.

<!-- ont: ent.tool-copy@cea475, action.update-copy@32bd58, inv.copy-matches-pin@0599d6 -->
## Updating the copy of the tool

A project keeps a copy of `tools/ont-check` in a directory of its own, pinned to one commit of the approach, and does not edit it: a fix to the tool is made in the approach and reaches the project with its next copy. `pin.mjs`, which ships with the tool, makes the copy and checks it.

```bash
node ../ontology-as-spec/tools/ont-check/pin.mjs update --dir tools/ontology-as-spec --pin tools/ontology-as-spec.upstream.json
node tools/ontology-as-spec/pin.mjs verify --pin tools/ontology-as-spec.upstream.json
```

The update copies the tool of the clone's `HEAD`, or of `--ref`, without its tests and with the approach's LICENSE, deletes the files the approach removed since the old pin, and writes the pin: the commit, its date, the last decision of the approach and the hash of every file. It lists the decisions since the old pin, which the project reads and carries into its own rules, and the files in the directory that no pin names, which it leaves in place. The verification runs with the check, and fails on a file that is missing or changed and on any file in the directory that the pin does not name. A note the project keeps beside the copy is listed under `own` in the pin.

## Adopting the approach

Start small. The approach pays off before every part is in place.

1. **Ten concepts.** Write the ten concepts people argue about most, with IDs and one-line definitions, in an `ontology.md` with one table per entity.
2. **Decision log.** Record the last five decisions that someone would otherwise reverse.
3. **Check.** Copy `tools/ont-check` with `pin.mjs update` (see above), write `ont.config.json` with only the ontology and the decisions, and run it and `guard-decisions.mjs` in the test command and in CI. The config may omit the mockup, map, checks and tickets until they exist.
4. **Agent rules.** Add the "what else to update" table to your agent instructions.
5. **Checks.** Write a check for each invariant and rule, in the product's terms, in `checks.md`.
6. **Target and reality.** When code exists, add the implementation table and the divergences. Tag the tests with the checks they implement, and add `testSuites` to the config: which suite must prove which kind of concept.
7. **Mockup.** When there is a mockup, label it and add the map.
8. **Documentation.** When there are pages for people, anchor their sections and list them as a doc set; generate the reference pages.

The [templates](../templates/README.md) have a starting file for each step.
