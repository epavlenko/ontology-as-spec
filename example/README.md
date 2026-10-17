# Example: Lending Library

A fictional product described with the approach, end to end. Small enough to read in twenty minutes, complete enough that every part of the approach has something to point at.

A library lends books, games and tools. Members borrow items, wait in a queue for titles that are out, renew loans, and are paused from borrowing while something is overdue. There are no fines.

| File                                                   | Part of the approach                                       |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| [ontology.md](./ontology.md)                           | the ontology, the glossary, the implementation table and known divergences |
| [decisions.md](./decisions.md)                         | the decision log                                           |
| [mockup/index.html](./mockup/index.html)               | the mockup with `data-ont`; tooltips come from `mockup/ontology.js` |
| [mockup/ontology-map.md](./mockup/ontology-map.md)     | the UI-to-ontology map                                     |
| [features/](./features/README.md)                      | the verification map, keyed by `IDs:` lines                |
| [AGENTS.md](./AGENTS.md)                               | the rules for agents: what else to update, what to run     |
| [issues/0003-serve-the-hold-queue.md](./issues/0003-serve-the-hold-queue.md) | a ticket that starts from IDs and ends in commands |
| [app/](./app/)                                         | the code: a small domain module and a command line front end |
| [ont.config.json](./ont.config.json)                   | the check's configuration for this example                 |

The code deliberately lags the ontology. Holds are placed but nothing serves the queue, and the code still computes fines that a decision abolished. Both are listed under "Known divergences" in the ontology, which is the point: the gap between target and reality is written down, not discovered.

## Run

From the repository root:

```bash
node tools/ont-check/gen-glossary.mjs --config example/ont.config.json   # glossary → mockup/ontology.js
node tools/ont-check/ont-check.mjs --config example/ont.config.json      # prints ONT_OK
node --test 'example/app/*.test.mjs'                                    # the code's own tests
```

Open `mockup/index.html` in a browser from the file system or any static server started at the repository root. Hover any labelled element to see its glossary definition.

Try breaking it: rename `data-ont="view.desk"` in the mockup, delete a row from the map, or reference `D-09` in the ontology. The check names the exact drift.
