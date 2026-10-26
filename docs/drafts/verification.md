# Draft: verification in two layers

> Draft. This page describes the targets of D-44, which is tentative, and of D-50, which is accepted. Nothing on it is built yet: the concepts it explains are target concepts of the approach's ontology, and each mechanism is built under a decision of its own.

<!-- ont: concept.ontology-layer@0c2853, concept.product-layer@4e4ce9 -->
## Two layers

A project made with the approach is checked twice. The tool checks the ontology and the artifacts that refer to it: that every ID is defined and used, that the mockup and the map agree, that accepted decisions stay as they were, that the gap is computed. That is the ontology layer, and it is the same in every project. The catalogue and the tests check something else: the product that agents build from the ontology, whether it behaves as the checks say. That is the product layer, and it depends on what the product is.

The two meet in this repository. The tool is the approach's product, so its own tests are the product layer of the tool, and the checks they implement are the ontology layer of every other project.

<!-- ont: inv.suite-implements-checks@a2592f -->
## How a product check is bound to the ontology

Every product check reaches the ontology the same way. The class of a concept says which suite must prove it, as part 6 describes: actions and views end to end, rules and invariants in unit tests. A suite may also name checks it must implement, which covers what classes cannot: a key scenario that runs through several actions must be proven end to end as a whole, not only action by action. The proof of a check says how it is proven, and the proof says where the result is kept. The tool can check the class, the suite and the proof; where a result is kept outside the repository stays a rule for people.

<!-- ont: inv.judged-check-tested@39910a, rule.judge-sees-the-check@2d7cba, rule.verdict-kept@10793d -->
## Checks a model judges

Some values are written by a model: a summary of an event, the claims extracted from an interview, a reply to a member. A test that compares them with an exact text breaks on every harmless change, and a manual check of them is seldom run. A judged check sits between the two. A test runs the product on a fixed sample, and a model reads the output next to the check's THEN and says whether it holds.

The judge reads the check's case and the product's output, never the code or the test, so that it judges the product and not the implementation. Nothing in a product's ontology tells a generated value from another, so the suite that runs judged checks names them; the tool can then require a test for each. A verdict is kept outside the repository, named by the check and the date, like the evidence of a manual check. Judged checks are automatic checks, so they count wherever automatic ones do: in the gap, in a finished slice and in a check a ticket waits for. Each run costs a call to a model, so a project may keep their suite apart and run it on purpose; how often is the project's choice.

<!-- ont: ent.profile@d94262, rule.profile-requires-checkable@e0c6e7 -->
## Profiles

A profile is a recipe for a property of the product that its ontology shows. It says what to put in the configuration, what it requires and what it recommends. It is not a key of the configuration: a project follows it by writing the settings it lists and the checks it asks for. What a profile requires must be something the tool can check through the configuration and the catalogue; everything else it lists is a recommendation.

- **Model output**, for products where a model writes values people read: a suite of judged checks that names them, kept apart if its cost calls for it.
- **Interface**, for products with views: an end-to-end suite covering actions and views, and, when the product carries `data-ont` labels, a test that every implemented screen shows the elements its map lists.
- **Model and data scenarios**, for products whose results inform people: the base scenario held by a snapshot, as D-40 describes.

<!-- ont: action.walk-blind@2e8dcb -->
## Walking the product blind

Code that behaves differently from the ontology where no test looks passes every check. The cheapest way to find it is to use the product as a person would, knowing what it should do and not how it is built. An agent gets the ontology, the catalogue, the map and the run guides, but not the code, and walks the product before a release. A difference is one of three things. Behavior that contradicts the target becomes a known divergence. A case the catalogue does not have becomes a check. What is simply not built yet is already the gap, and adds nothing. In the lending library, a walker reads that renewal is refused while someone waits for the title, places a hold as ben, renews as ana at the desk, and records a divergence if the renewal goes through; finding the hold queue unserved adds nothing, since its concepts are target.

<!-- ont: concept.completeness-axis@a17be3, inv.axis-values-covered@3a3db0, rule.check-not-redundant@2f43b8, action.derive-blind@73594f -->
## When the catalogue is complete

A catalogue with a check for every concept can still miss what matters: a renewal checked only for success says nothing about the refusal a member meets when someone waits for the title. Completeness is measured by forks, not by the number of checks. The forks are the axes along which behavior diverges, each with its values. Every action has one axis, its outcome: success, refusal, empty when there is nothing to act on, error, and silence when no answer comes back. A product adds axes of its own, such as who acts first or how much time passes. Every value of every axis is covered by a check, and each action's outcomes by its own checks, unless the catalogue says why a value cannot occur.

More checks are not better. Two checks whose cases differ only in the data, another member and another title with the same behavior, are one: a check whose removal loses no value or combination of values that the others cover goes.

Whether the catalogue suffices is tested by deriving blind. Someone who sees only the ontology and the catalogue, not the code, says what should happen in a case the catalogue does not hold, and the answer is compared with the owner's. A match means the case follows from what is written. A mismatch means a check is missing, or that the owner does not know the answer either, which is an open question. Until judged checks are built, the owner compares. With them, a model derives and a judge compares its answer with answers the owner wrote and kept outside the catalogue, where neither the model nor the agents that build the product see them.

D-50 records this target. It is built together with judged checks, under a decision of its own, which also decides how a check names the value it covers.

<!-- ont: action.critique-change@79fa01 -->
## An independent critic

A significant change, such as a rule of the approach, a new mechanism or risky code, is reviewed by an agent that did not write it. The critic gets the diff, the IDs it touches and their checks, and not the author's summary, since a reviewer handed the author's conclusions tends to confirm them. It reports what would mislead a reader or an agent, or break a check, as part 7 asks of every review.

<!-- ont: inv.one-concept-per-term@2eb96c, derived.meaning-changed@8d5a8c -->
## Checks of the ontology layer still to come

Two gaps of the ontology layer matter most when agents edit the ontology. A definition can change without a decision or a line of history, so its meaning shifts and nobody sees it; a guard over the change can name such a definition. And two concepts can carry one term, so prose that uses the term is ambiguous. A strict rule against shared terms would be wrong: in this repository's own ontology it found eight terms shared by twelve pairs of concepts, all legitimate, such as two fields termed Name in different entities and a relation named after the entity it refers to. Leaving those cases out still leaves three legitimate pairs, such as two invariants termed Current, one for contracts and one for reference pages. So shared terms are listed as information, for a reviewer to look at.
