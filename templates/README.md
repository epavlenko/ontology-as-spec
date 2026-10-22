# Templates

Starting files for every artifact. The set is itself a valid, tiny project: `node tools/ont-check/ont-check.mjs --config templates/ont.config.json` passes on it, so a broken template is caught in CI.

Copy what you need, replace the placeholder concepts (`ent.thing`, `field.state`, `view.thing.page`, `action.close`) with your own, and adjust the paths in `ont.config.json`.

| File                                   | Part                                                            |
| -------------------------------------- | --------------------------------------------------------------- |
| `ontology.md`                          | one definition table per entity, screens, implementation status, divergences, retired IDs (parts 1 and 3) |
| `decisions.md`                         | decision log (part 2)                                           |
| `mockup/index.html`                    | wiring for `data-ont` and generated tooltips (part 4)            |
| `mockup/ontology-map.md`               | UI-to-ontology map (part 4)                                     |
| `contracts/ontology.schema.json`       | contracts generated from the field types (part 1)               |
| `help/thing.md`, `help/terms.md`       | a help page anchored to concepts, and the generated terms page (part 9) |
| `ont.config.json`                      | configuration of the check (part 5)                             |
| `checks.md`                            | check catalogue: what must hold, for any implementation (part 6) |
| `agents-section.md`                    | the section to paste into `AGENTS.md` (part 7)                  |
| `issue.md`                             | ticket shape: a slice of the gap, its limits and permissions (part 8); checked through `tickets` in the config |

Start with `ontology.md`, `decisions.md` and a config that has only those two (remove `mockup`, `map`, `checks`, `tickets`, `glossaryOut`, and set `"implementation": null` under `headings` until code exists). Write checks for invariants and rules as soon as they exist; they come before the code. When code has tests, tag them with the IDs of the checks they implement and add `"testSuites"`: one entry per suite the team runs, such as `{ "name": "unit", "dir": "<tests>", "cover": ["inv", "rule"] }`. Run `tools/ont-check/guard-decisions.mjs` from the start: the decision log is the first file worth guarding.

After editing a definition row, regenerate the tooltips and the contracts:

```bash
node tools/ont-check/gen-glossary.mjs --config ont.config.json
node tools/ont-check/gen-contracts.mjs --config ont.config.json
```
