# Example: Lending Library

A fictional product described with the approach, end to end. Small enough to read in twenty minutes, complete enough that every part of the approach has something to point at.

A library lends books, games and tools. Members borrow items, wait in a queue for titles that are out, renew loans, and are paused from borrowing while something is overdue. There are no fines.

| File                                                   | Part of the approach                                       |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| [ontology.md](./ontology.md)                           | the ontology: one definition table per entity and one for screens, the implementation table, known divergences and retired IDs |
| [decisions.md](./decisions.md)                         | the decision log                                           |
| [mockup/index.html](./mockup/index.html)               | the mockup with `data-ont`; tooltips come from `mockup/ontology.js` |
| [mockup/ontology-map.md](./mockup/ontology-map.md)     | the UI-to-ontology map                                     |
| [checks.md](./checks.md)                               | the check catalogue: what must hold, for any implementation |
| [AGENTS.md](./AGENTS.md)                               | the rules for agents: what else to update, what to run     |
| [issues/](./issues/)                                   | two tickets, each a slice of the gap, done when `--gap` with it prints `SLICE_DONE` |
| [help/](./help/README.md)                              | help for members, anchored to concepts, and the generated terms page |
| [app/](./app/)                                         | the code: a small domain module, a command line front end, and unit tests whose titles name the checks they implement |
| [e2e/](./e2e/)                                         | end-to-end tests that run the command line front end as a user does, also named by check |
| [contracts/ontology.schema.json](./contracts/ontology.schema.json) | the contracts: JSON Schema generated from the types of fields and relations |
| [ont.config.json](./ont.config.json)                   | the check's configuration for this example                 |

The code deliberately lags the ontology. Holds are placed but nothing serves the queue, and the code still computes fines that a decision abolished. Both are listed under "Known divergences" in the ontology, which is the point: the gap between target and reality is written down, not discovered.

## Run

From the repository root:

```bash
node tools/ont-check/gen-glossary.mjs --config example/ont.config.json   # definition rows → mockup/ontology.js
node tools/ont-check/gen-contracts.mjs --config example/ont.config.json  # field and relation types → contracts/ontology.schema.json
node tools/ont-check/gen-reference.mjs --config example/ont.config.json  # definition rows → help/terms.md
node tools/ont-check/ont-check.mjs --config example/ont.config.json      # prints ONT_OK
node tools/ont-check/ont-check.mjs --config example/ont.config.json --gap   # what is left to build
node --test 'example/app/*.test.mjs' 'example/e2e/*.test.mjs'          # unit and end-to-end tests
```

Open `mockup/index.html` in a browser from the file system or any static server started at the repository root. Hover any labelled element to see its glossary definition.

Try breaking it: rename `data-ont="view.desk"` in the mockup, delete a row from the map, reference `D-09` in the ontology, or remove the `[check.loan.renew-twice]` tag from a test. The check names the exact drift. Run it with `--gap` to see what is left to build, or with `--gap example/issues/0003-serve-the-hold-queue.md` for one ticket's slice. Edit an accepted entry in `decisions.md` and run `node tools/ont-check/guard-decisions.mjs --config example/ont.config.json`: the guard names the entry.
