# The parts

Eight parts. The first three hold meaning, the next three tie artifacts to it, and the last two make agents work inside it.

| #   | Part                                                    | Holds or ties                                                          |
| --- | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | [Glossary and permanent IDs](glossary-and-ids.md)       | one definition per concept, the ID everything else uses                |
| 2   | [Decision log](decision-log.md)                         | why the ontology is the way it is                                      |
| 3   | [Target and reality](target-and-reality.md)             | what exists in code, what is target, where they disagree               |
| 4   | [Mockup as UI specification](mockup-as-ui-spec.md)      | interface elements labelled with concepts; the map                     |
| 5   | [Drift check](drift-check.md)                           | one script that cross-checks all of the above                          |
| 6   | [Verification map](verification-map.md)                | how to prove each implemented concept works, keyed by ID               |
| 7   | [Agent rules](agent-rules.md)                           | what else to update when something changes, and what the check cannot see |
| 8   | [Agent workflow](agent-workflow.md)                     | tasks that start from IDs, state behavior as tagged scenarios, finish on commands, and ship in slices |

Each file follows the same outline: what it is, the format, the rules, what the check enforces, what it cannot enforce, and how it fails in practice. The [example](../../example/README.md) has a working instance of every part.

A smaller adoption works. Parts 1, 2 and 5 alone already pay off. Add part 3 when code exists, part 4 when there is a mockup, and part 6 when there are user-visible features to prove.
