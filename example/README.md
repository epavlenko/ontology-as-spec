# Example: Lending Library

A fictional product described with the approach, end to end. Small enough to read in twenty minutes, complete enough that every part of the approach has something to point at.

A library lends books, games and tools. Members borrow items, wait in a queue for titles that are out, renew loans, and are paused from borrowing while something is overdue. There are no fines.

| File                                                   | Part of the approach                                       |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| [ontology.md](./ontology.md)                           | the ontology: one definition table per entity and one for screens, with the formal forms of its rows in behavior blocks for the oracle, the implementation table, known divergences and retired IDs |
| [decisions.md](./decisions.md)                         | the decision log                                           |
| [mockup/index.html](./mockup/index.html)               | the mockup with `data-ont`; tooltips come from `mockup/ontology.js` |
| [mockup/ontology-map.md](./mockup/ontology-map.md)     | the UI-to-ontology map                                     |
| [checks.md](./checks.md)                               | the check catalogue: what must hold, for any implementation, and a trace of each check for the oracle |
| [AGENTS.md](./AGENTS.md)                               | the rules for agents: what else to update, what to run     |
| [issues/](./issues/)                                   | two tickets, each a slice of the gap, done when `--gap` with it prints `SLICE_DONE` |
| [help/](./help/README.md)                              | help for members, anchored to concepts, and the generated terms page |
| [verify/](./verify/)                                   | run guides: how to run the manual checks of what is built |
| [app/](./app/)                                         | the code: a small domain module, a command line front end, unit tests whose titles name the checks they implement, and a test that compares the code with the oracle on random sequences of actions |
| [judged/](./judged/)                                   | a test that a model judges: the library refuses a checkout at the limit, and a judge in `JUDGE` reads the refusal next to its check; skipped without one |
| [e2e/](./e2e/)                                         | end-to-end tests that run the command line front end as a user does, also named by check |
| [releases/](./releases/)                               | one release of the example, 1.0.0: the commit its check and test suites passed on, the hash of the approach's IDs it was checked against, each suite passed; the check finds it intact, and `release.mjs --verify 1.0.0 --config example/ont.config.json` runs them again |
| [contracts/ontology.schema.json](./contracts/ontology.schema.json) | the contracts: JSON Schema generated from the types of fields and relations |
| [ont.config.json](./ont.config.json)                   | the check's configuration for this example                 |

The code deliberately lags the ontology. Holds are placed but nothing serves the queue, and the code still computes fines that a decision abolished. Both are listed under "Known divergences" in the ontology, which is the point: the gap between target and reality is written down, not discovered.

<!-- ont: concept.oracle@88e2a7, ent.trace@eb1f36, derived.gap@14d3ee -->
## Run

From the repository root:

```bash
node tools/ont-check/gen-glossary.mjs --config example/ont.config.json   # definition rows → mockup/ontology.js
node tools/ont-check/gen-contracts.mjs --config example/ont.config.json  # field and relation types → contracts/ontology.schema.json
node tools/ont-check/gen-reference.mjs --config example/ont.config.json  # definition rows → help/terms.md
node tools/ont-check/ont-check.mjs --config example/ont.config.json      # prints ONT_OK
node tools/ont-check/ont-check.mjs --config example/ont.config.json --gap   # what is left to build
node tools/ont-check/ont-check.mjs --config example/ont.config.json --run   # every trace of the catalogue, run on the oracle
node --test example/traces/traces.test.mjs                                # the traces of built checks, run on the code through app/adapter.mjs
node tools/ont-check/ont-check.mjs --config example/ont.config.json --mutate   # changes of the forms no trace fails on, and empty tests
node --test 'example/app/*.test.mjs' 'example/e2e/*.test.mjs'          # unit and end-to-end tests
```

Open `mockup/index.html` in a browser from the file system or any static server started at the repository root. Hover any labelled element to see its glossary definition.

Try breaking it: rename `data-ont="view.desk"` in the mockup, delete a row from the map, reference `D-99` in the ontology, or remove the `[check.loan.renew-twice]` tag from a test. The check names the exact drift. Run it with `--gap` to see what is left to build, or with `--gap example/issues/0003-serve-the-hold-queue.md` for one ticket's slice. Edit an accepted entry in `decisions.md` and run `node tools/ont-check/guard-decisions.mjs --config example/ont.config.json`: the guard names the entry.
