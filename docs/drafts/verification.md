# Draft: verification in two layers

> Draft. This page describes the targets of D-44 and D-50, both accepted. Nothing on it is built yet: the concepts it explains are target concepts of the approach's ontology, and each mechanism is built under a decision of its own.

<!-- ont: concept.completeness-axis@a17be3, inv.axis-values-covered@3a3db0, rule.check-not-redundant@2f43b8, action.derive-blind@73594f -->
## When the catalogue is complete

A catalogue with a check for every concept can still miss what matters: a renewal checked only for success says nothing about the refusal a member meets when someone waits for the title. Completeness is measured by forks, not by the number of checks. The forks are the axes along which behavior diverges, each with its values. Every action has one axis, its outcome: success, refusal, empty when there is nothing to act on, error, and silence when no answer comes back. A product adds axes of its own, such as who acts first or how much time passes. Every value of every axis is covered by a check, and each action's outcomes by its own checks, unless the catalogue says why a value cannot occur.

More checks are not better. Two checks whose cases differ only in the data, another member and another title with the same behavior, are one: a check whose removal loses no value or combination of values that the others cover goes.

Whether the catalogue suffices is tested by deriving blind. Someone who sees only the ontology and the catalogue, not the code, says what should happen in a case the catalogue does not hold, and the answer is compared with the owner's. A match means the case follows from what is written. A mismatch means a check is missing, or that the owner does not know the answer either, which is an open question. Until judged checks are built, the owner compares. With them, a model derives and a judge compares its answer with answers the owner wrote and kept outside the catalogue, where neither the model nor the agents that build the product see them.

D-50 records this target. It is built together with judged checks, under a decision of its own, which also decides how a check names the value it covers.
