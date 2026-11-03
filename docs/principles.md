# Principles

Each principle names the failure it prevents. The [parts](parts/README.md) say how each one is carried out.

<!-- ont: inv.one-definition-row@002e65 -->
## 1. A concept has one ID and one definition

Every concept of the product gets an ID of the form `class.name` and a short definition: one row in the table of its entity. Everything else that mentions the concept uses the ID.

*Prevents:* three names for one idea, or one name for three ideas. Agents are literal readers. If "hold", "reservation" and "queue entry" appear in different files, an agent will build three things.

<!-- ont: inv.ids-permanent@33ab31 -->
## 2. IDs are permanent

Renaming a term changes the text of its row. The ID stays. Changing an ID is possible, but it is a decision with a reason, and the old ID is retired rather than deleted, so that the decision log, which is never edited, still resolves.

*Prevents:* broken references after every rename, and the temptation to avoid renaming a bad term because it is expensive.

## 3. The glossary comes first

A concept may not appear in the mockup, a ticket or the code before it has a glossary row. If an agent needs a concept that has no ID, the ontology is incomplete, and the agent proposes the row before it writes anything else.

*Prevents:* meaning that is born in markup or code and is never written down.

<!-- ont: inv.accepted-never-edited@a7c76a, rule.one-choice@c773d8 -->
## 4. Decisions are appended, not edited

A decision answers one question: what was chosen, why, what was rejected and which concepts it touches. Once accepted it is never edited, and a guard refuses such edits on commit and in CI. A later entry may add to it; one that contradicts any part of it supersedes it whole.

*Prevents:* the next person or agent reversing a decision whose reason they never saw, and reopening an alternative that was already rejected.

<!-- ont: ent.implementation-row@f093f9, ent.divergence@c86a47 -->
## 5. The target and the reality are separate and both are written down

The ontology describes the agreed target. An implementation table says which concepts the code already has, and a list of divergences says where the code disagrees with the target. A divergence is not an error in the ontology. It becomes a ticket, or a new decision if the target changed.

*Prevents:* the design document silently drifting toward the code, and the code being "fixed" toward a design that was abandoned.

<!-- ont: ent.specification@e6824a, rule.spec-is-source@5e8bd3, rule.behavior-in-spec@a68f16, rule.change-spec-first@a173d3 -->
## 6. The specification is the source of the code

The ontology and the check catalogue are the product's specification. They describe its behavior as completely as they can: what every view shows in each state, what the user can do there, and every outcome of every action as a check. A model writes the code from them, and a change of behavior starts in them, then the code follows. What the code does that the specification does not say is a gap in the specification: it becomes a check, or a question for the owner. Layout and style are left to the code, and the owner judges them on the mockup.

Two runs of a model do not write the same code. They write code that passes the same checks, and that is what makes them the same product. The generators of the approach only restate the ontology: tooltips, contracts and reference pages.

*Prevents:* behavior that is born in code nobody decided, and a specification that each month describes less than the product does.

<!-- ont: ent.mockup-element@54a519, rule.mockup-shows-target@d5aa5d -->
## 7. The mockup is code that names its concepts

The mockup is the first implementation of the interface, written from the specification like the rest of the code, and it may run ahead of the product's code. Every meaningful element is labelled with the concept it shows, so the reason it exists is one hover away and outlives every redesign. A map records, for each element, what it shows and what it deliberately does not do.

*Prevents:* interface elements whose reason nobody remembers, and agents building behavior a mockup merely suggested.

## 8. Consistency is checked by a machine, in both directions

The check verifies more than "every reference exists". It also verifies "every concept is referenced", "every labelled element is mapped" and "every mapped element exists". It runs on commit and in CI.

*Prevents:* drift found by rereading, which in practice means drift never found.

## 9. Work starts from IDs and ends on commands

A task names the concept IDs it touches. Its finish condition is a list of commands that must pass. An agent can run a list of commands without anyone watching. It cannot reliably decide that a prose goal has been met.

*Prevents:* agents finishing on "looks done", and humans having to supervise every step.

## 10. Write the long description first, deliver in short slices

Describing the target well before implementing it is not waterfall. A well-described target lengthens the stretch an agent can work without a human. Delivery still happens in small slices, each closed by a test, with feedback from real users between slices. When a slice teaches something new, the decision log records it and the ontology changes.

*Prevents:* the false choice between "full spec up front" and "no spec at all". See [Kent Beck's objection](comparison.md#the-objection-from-learning) and how this approach answers it.
