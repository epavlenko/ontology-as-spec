# Lifecycle of a change

How each kind of change moves through the artifacts. The [agent rules](parts/agent-rules.md) table is the short form of this page.

## A new concept

1. Add a definition row in the section of the entity it constrains or changes, in its kind's group: kind, ID, term, type, a definition that says what it is. A field or a relation names the entity in its ID and has a type.
2. If it needs more than one line, add a note under the table. Refer to related concepts by ID; do not restate the definition.
3. If the concept exists because of a choice, add a decision entry with the rejected alternatives.
4. Regenerate the tooltip glossary and, for a field or a relation, the contracts.
5. If it appears in the interface, add the map row, then the `data-ont` element in the mockup.
6. If a doc set covers its class, explain it on a page with an anchor; regenerate the reference pages.
7. Add a revision history line to the ontology.
8. Run the check.

Order matters. The definition row comes first, so that nothing else can mention a concept that is not defined.

A concept arrives with something that will try it: a mockup element, a ticket or code. The ontology may run ahead of the code, together with the mockup; that is how a target is designed. What it should not do is grow concepts that nothing has tried. The check lists them as information, "concepts with no mockup element, ticket or implementation yet". Each one is a question for review: show it, plan it, or drop it.

## Renaming a term

Change the term and, if needed, the definition in its row. Leave the ID. Update the prose where the term appears. Regenerate the tooltips and the reference pages; reread the doc sections the check lists as anchored to a changed definition, then stamp them. If the rename reflects a change of meaning rather than wording, it is a decision.

## Changing IDs

Rare. It is justified when an ID itself misleads: a class name collides with a term in a neighbouring product, or fields need their entity in the ID because two entities now share a field name. It needs a decision entry that says why the permanence rule is broken. The new IDs replace the old ones in one commit across every artifact except the decision log, and each old ID gets a row under "Retired IDs" with its replacement and the decision. The check confirms nothing was missed: an old ID anywhere but the decision log is reported with its replacement.

## Removing a concept

Remove its definition row, its map rows and its mockup elements in one commit, with a decision entry, and list the ID under "Retired IDs" with a dash for the replacement. The check fails if any reference remains outside the decision log. Decision entries that mention the concept stay as they are; the retired table is what keeps their IDs resolvable.

## Changing your mind

Write a new decision entry that supersedes the old one and says why. Never edit the old entry. Then change the ontology, the map and the mockup to match, and mention the new decision where the change would otherwise look arbitrary.

## Implementing a concept

1. The concept has its checks in the catalogue. If one is missing, it is written first.
2. A ticket cuts the slice from the gap (`ont-check.mjs --gap`): IDs, checks, out of scope, dependencies, permissions.
3. The agent reads the definition rows, the checks and the decisions for those IDs.
4. Code, a test for each automatic check whose title starts with the check's ID, then the implementation table row with a note on anything partial.
5. Remove the matching line from known divergences, if there was one.
6. `--gap` with the ticket prints `SLICE_DONE`, and the tests pass.

## Finding a divergence

Code disagrees with the ontology. Do not change either side silently. Add a line to known divergences with the IDs involved. Then either open a ticket to bring the code to the target, or, if the code is right and the target was wrong, write a decision and change the ontology.

## Adopting the approach

Start small. The approach pays off before every part is in place.

1. **Ten concepts.** Write the ten concepts people argue about most, with IDs and one-line definitions, in an `ontology.md` with one table per entity.
2. **Decision log.** Record the last five decisions that someone would otherwise reverse.
3. **Check.** Copy `tools/ont-check`, write `ont.config.json` with only the ontology and the decisions, and run it and `guard-decisions.mjs` in CI. The config may omit the mockup, map, checks and tickets until they exist.
4. **Agent rules.** Add the "what else to update" table to your agent instructions.
5. **Checks.** Write a check for each invariant and rule, in the product's terms, in `checks.md`.
6. **Target and reality.** When code exists, add the implementation table and the divergences. Tag the tests with the checks they implement, and add `testSuites` to the config: which suite must prove which kind of concept.
7. **Mockup.** When there is a mockup, label it and add the map.

The [templates](../templates/README.md) have a starting file for each step.
