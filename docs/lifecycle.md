# Lifecycle of a change

How each kind of change moves through the artifacts. The [agent rules](parts/agent-rules.md) table is the short form of this page.

## A new concept

1. Add a glossary row: ID, term, a definition that says what it is.
2. Explain it in the ontology where it belongs, such as the entity table, the rules or the views. Refer to related concepts by ID.
3. If the concept exists because of a choice, add a decision entry with the rejected alternatives.
4. Regenerate the tooltip glossary.
5. If it appears in the interface, add the map row, then the `data-ont` element in the mockup.
6. Add a revision history line to the ontology.
7. Run the check.

Order matters. The glossary row comes first, so that nothing else can mention a concept that is not defined.

## Renaming a term

Change the term and, if needed, the definition in the glossary row. Leave the ID. Update the prose where the term appears. Regenerate the tooltips. If the rename reflects a change of meaning rather than wording, it is a decision.

## Renaming a class of IDs

Rare. It is justified when the class name itself misleads, for example when it collides with a term in a neighbouring product. It needs a decision entry that says why the permanence rule is broken. All IDs of the class change in one commit across every artifact, and the check confirms nothing was missed.

## Removing a concept

Remove it from the glossary, the map and the mockup in one commit, with a decision entry. The check fails if any reference remains. Decision entries that mention the concept keep their text but should no longer use its ID. Write the old term in plain words with a pointer to the decision that removed it.

## Changing your mind

Write a new decision entry that supersedes the old one and says why. Never edit the old entry. Then change the ontology, the map and the mockup to match, and mention the new decision where the change would otherwise look arbitrary.

## Implementing a concept

1. A ticket names the IDs, the scope, Done when and proof commands.
2. The agent reads the glossary rows, the ontology sections and the decisions for those IDs.
3. Code, then the implementation table row with a note on anything partial.
4. If the concept is a view, an action or a hook, add a verification scenario with the ID on its `IDs:` line.
5. Remove the matching line from known divergences, if there was one.
6. Proof commands green, including the check.

## Finding a divergence

Code disagrees with the ontology. Do not change either side silently. Add a line to known divergences with the IDs involved. Then either open a ticket to bring the code to the target, or, if the code is right and the target was wrong, write a decision and change the ontology.

## Adopting the approach

Start small. The approach pays off before every part is in place.

1. **Glossary of ten.** Write the ten concepts people argue about most, with IDs and one-line definitions. Put them in an `ontology.md`.
2. **Decision log.** Record the last five decisions that someone would otherwise reverse.
3. **Check.** Copy `tools/ont-check`, write `ont.config.json` with only the ontology and the decisions, and run it in CI. The config may omit the mockup, map and scenarios until they exist.
4. **Agent rules.** Add the "what else to update" table to your agent instructions.
5. **Target and reality.** When code exists, add the implementation table and the divergences.
6. **Mockup.** When there is a mockup, label it and add the map.
7. **Verification map.** When implemented features need proving, add scenario files.

The [templates](../templates/README.md) have a starting file for each step.
