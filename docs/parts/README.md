# The parts

Nine parts. The first three hold meaning, the next three tie artifacts to it, the next two make agents work inside it, and the last ties documentation to it.

| #   | Part                                               | Holds or ties                                                             |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | [Glossary and permanent IDs](glossary-and-ids.md)  | one definition per concept, the ID everything else uses                   |
| 2   | [Decision log](decision-log.md)                    | why the ontology is the way it is                                         |
| 3   | [Target and reality](target-and-reality.md)        | what exists in code, what is target, where they disagree                  |
| 4   | [Mockup as UI specification](mockup-as-ui-spec.md) | interface elements labelled with concepts; the map                        |
| 5   | [Drift check](drift-check.md)                      | one script that cross-checks all of the above                             |
| 6   | [Checks and tests](checks-and-tests.md)            | what must hold for any implementation, and the tests that implement it    |
| 7   | [Agent rules](agent-rules.md)                      | what else to update when something changes, and what the check cannot see |
| 8   | [Agent workflow](agent-workflow.md)                | the gap computed, tickets as slices of it, a derived finish condition     |
| 9   | [Documentation](documentation.md)                  | pages for people anchored to concepts; reference pages generated          |

Each file explains one part: what it is, why, how it works, and how it fails in practice. Its Reference section points to the generated [reference](../reference.md), which holds the part's concepts, their fields and rules, and the checks that hold them: automatic ones the tool enforces, manual ones a reviewer does. The [example](../../example/README.md) has a working instance of every part.

Recipes that combine the parts for a property of a product are on [profiles](../profiles.md).

A smaller adoption works. Parts 1, 2 and 5 alone already pay off. Add part 3 when code exists, part 4 when there is a mockup, part 6 as soon as there are invariants and rules to check, and part 9 when there is documentation for people.
