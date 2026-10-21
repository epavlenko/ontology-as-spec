# Lifecycle of a change

How each kind of change moves through the artifacts. The [agent rules](parts/agent-rules.md) table is the short form of this page.

## A new concept

1. Add a definition row in the section of the entity it constrains or changes, in its kind's group: kind, ID, term, a definition that says what it is. A field or a relation names the entity in its ID.
2. If it needs more than one line, add a note under the table. Refer to related concepts by ID; do not restate the definition.
3. If the concept exists because of a choice, add a decision entry with the rejected alternatives.
4. Regenerate the tooltip glossary.
5. If it appears in the interface, add the map row, then the `data-ont` element in the mockup.
6. Add a revision history line to the ontology.
7. Run the check.

Order matters. The definition row comes first, so that nothing else can mention a concept that is not defined.

## Renaming a term

Change the term and, if needed, the definition in its row. Leave the ID. Update the prose where the term appears. Regenerate the tooltips. If the rename reflects a change of meaning rather than wording, it is a decision.

## Changing IDs

Rare. It is justified when an ID itself misleads: a class name collides with a term in a neighbouring product, or fields need their entity in the ID because two entities now share a field name. It needs a decision entry that says why the permanence rule is broken. The new IDs replace the old ones in one commit across every artifact except the decision log, and each old ID gets a row under "Retired IDs" with its replacement and the decision. The check confirms nothing was missed: an old ID anywhere but the decision log is reported with its replacement.

## Removing a concept

Remove its definition row, its map rows and its mockup elements in one commit, with a decision entry, and list the ID under "Retired IDs" with a dash for the replacement. The check fails if any reference remains outside the decision log. Decision entries that mention the concept stay as they are; the retired table is what keeps their IDs resolvable.

## Changing your mind

Write a new decision entry that supersedes the old one and says why. Never edit the old entry. Then change the ontology, the map and the mockup to match, and mention the new decision where the change would otherwise look arbitrary.

## Implementing a concept

1. A ticket names the IDs, the scope, the expected behavior as tagged GIVEN/WHEN/THEN scenarios, Done when and proof commands.
2. The agent reads the glossary rows, the ontology sections and the decisions for those IDs.
3. Code, a test per scenario whose title starts with the scenario's tag, then the implementation table row with a note on anything partial.
4. If the concept is a view, an action or a hook, add a verification scenario with the ID on its `IDs:` line.
5. Remove the matching line from known divergences, if there was one.
6. Proof commands green, including the check.

## Finding a divergence

Code disagrees with the ontology. Do not change either side silently. Add a line to known divergences with the IDs involved. Then either open a ticket to bring the code to the target, or, if the code is right and the target was wrong, write a decision and change the ontology.

## Adopting the approach

Start small. The approach pays off before every part is in place.

1. **Ten concepts.** Write the ten concepts people argue about most, with IDs and one-line definitions, in an `ontology.md` with one table per entity.
2. **Decision log.** Record the last five decisions that someone would otherwise reverse.
3. **Check.** Copy `tools/ont-check`, write `ont.config.json` with only the ontology and the decisions, and run it and `guard-decisions.mjs` in CI. The config may omit the mockup, map and scenarios until they exist.
4. **Agent rules.** Add the "what else to update" table to your agent instructions.
5. **Target and reality.** When code exists, add the implementation table and the divergences. Tag the tests that prove invariants and rules, and add `tests` to the config.
6. **Mockup.** When there is a mockup, label it and add the map.
7. **Verification map.** When implemented features need proving, add scenario files.

The [templates](../templates/README.md) have a starting file for each step.
