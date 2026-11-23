# <Product> — checks

Created: YYYY-MM-DD
Status: maintained
Context: [ontology.md](./ontology.md)

What must hold, in the product's own terms, for any implementation. Tests implement checks and start their title with the check's ID. One section per entity, in the order of the ontology; a check's ID names its section. `auto` means a test implements the check; `judged` that a test runs it and a model judges the output; `review` that a reviewer of another provider gives it a verdict reading the change before merge; `run` that an agent carries it out on the working product or the mockup, by its section in `verify/`, or a person where the project chooses so.

## Thing

| Check                        | Concepts                            | GIVEN             | WHEN                       | THEN                                       | Proof  |
| ---------------------------- | ----------------------------------- | ----------------- | -------------------------- | ------------------------------------------ | ------ |
| `check.thing.close`          | `action.close`, `field.thing.state` | an open thing     | its owner closes it        | its state is closed                        | auto   |
| `check.thing.stays-closed`   | `inv.closed-is-final`               | a closed thing    | anyone tries to reopen it  | the request is refused with the reason     | auto   |
| `check.thing.close-is-clear` | `action.close`                      | a first-time user | they look at an open thing | they can tell how to close it without help | run    |
