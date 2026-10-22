# <Product> — checks

Created: YYYY-MM-DD
Status: maintained
Context: [ontology.md](./ontology.md)

What must hold, in the product's own terms, for any implementation. Tests implement checks and start their title with the check's ID. One section per entity, in the order of the ontology; a check's ID names its section. `auto` means a test implements the check; `manual` means a person or an agent with the product does, because no test can.

## Thing

| Check                        | Concepts                            | GIVEN             | WHEN                       | THEN                                       | Proof  |
| ---------------------------- | ----------------------------------- | ----------------- | -------------------------- | ------------------------------------------ | ------ |
| `check.thing.close`          | `action.close`, `field.thing.state` | an open thing     | its owner closes it        | its state is closed                        | auto   |
| `check.thing.stays-closed`   | `inv.closed-is-final`               | a closed thing    | anyone tries to reopen it  | the request is refused with the reason     | auto   |
| `check.thing.close-is-clear` | `action.close`                      | a first-time user | they look at an open thing | they can tell how to close it without help | manual |
