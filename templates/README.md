# Templates

<!-- ont: ent.tool-copy@cea475, concept.oracle@88e2a7 -->

Starting files for every artifact. The set is itself a valid, tiny project: `node tools/ont-check/ont-check.mjs --config templates/ont.config.json` passes on it, so a broken template is caught in CI.

Copy what you need, replace the placeholder concepts (`ent.thing`, `field.thing.state`, `view.thing.page`, `action.close`) with your own, and adjust the paths in `ont.config.json`.

| File                                   | Part                                                            |
| -------------------------------------- | --------------------------------------------------------------- |
| `ontology.md`                          | one definition table per entity, screens, implementation status, divergences, retired IDs (parts 1 and 3) |
| `decisions.md`                         | decision log (part 2)                                           |
| `mockup/index.html`                    | wiring for `data-ont` and generated tooltips (part 4)            |
| `mockup/ontology-map.md`               | UI-to-ontology map (part 4)                                     |
| `contracts/ontology.schema.json`       | contracts generated from the field types (part 1)               |
| `help/thing.md`, `help/terms.md`       | a help page anchored to concepts, and the generated terms page (part 9) |
| `verify/close.md`                     | a run guide: how an agent carries out a check of run, with the step of the fresh reader (parts 6 and 9) |
| `ont.config.json`                      | configuration of the check (part 5)                             |
| `checks.md`                            | check catalogue: what must hold, for any implementation (part 6) |
| `agents-section.md`                    | the section to paste into `AGENTS.md` (part 7)                  |
| `issue.md`                             | ticket shape: a slice of the gap, its limits and permissions (part 8); checked through `tickets` in the config |
| `.github/workflows/ont-check.yml`     | the workflow of the project's full check in CI: it verifies the pinned copy of the tool with `pin.mjs verify --pin`, runs the check, guards the decisions against the pull request's base and runs the test command; copy it to `.github/workflows/` and write in the values of its `env` ([lifecycle](../docs/lifecycle.md#a-projects-ci)) |

Start with `ontology.md`, `decisions.md` and a config that has only those two (remove `mockup`, `map`, `glossaryOut`, `contracts`, `checks`, `tickets`, `docSets` and `references`, and set `"implementation": null` under `headings` until code exists). Write checks for invariants and rules as soon as they exist; they come before the code. When code has tests, tag them with the IDs of the checks they implement and add `"testSuites"`: one entry per suite the team runs, such as `{ "name": "unit", "dir": "<tests>", "cover": ["inv", "rule"] }`. Run `tools/ont-check/guard-decisions.mjs` from the start, in the test command too: the decision log is the first file worth guarding, and there the guard shows `GUARD_OFF` before the first commit and the accepted entries that are not committed yet.

A project records its releases, and its deployments if it has any, by naming `releases` in `ont.config.json`: `{ "dir": "releases", "pin": "<the pin of the copy of the tool>" }`; `release.mjs --product <version>` writes a release ([lifecycle](../docs/lifecycle.md#releases-of-the-product)).

The templates leave the [oracle](../docs/parts/oracle.md) off (part 10). A project turns it on with `"oracle": true` once its rules have settled: a behavior block under each table with the formal forms of its rows, and a traces block in each section of `checks.md`, written as in [the example](../example/ontology.md); `ont-check.mjs --run` runs the traces.

After editing a definition row, regenerate the tooltips, the contracts and the reference pages:

```bash
node tools/ont-check/gen-glossary.mjs --config ont.config.json
node tools/ont-check/gen-contracts.mjs --config ont.config.json
node tools/ont-check/gen-reference.mjs --config ont.config.json
```
