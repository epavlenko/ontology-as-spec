# Templates

Starting files for every artifact. The set is itself a valid, tiny project: `node tools/ont-check/ont-check.mjs --config templates/ont.config.json` passes on it, so a broken template is caught in CI.

Copy what you need, replace the placeholder concepts (`ent.thing`, `field.state`, `view.thing.page`, `action.close`) with your own, and adjust the paths in `ont.config.json`.

| File                                   | Part                                                            |
| -------------------------------------- | --------------------------------------------------------------- |
| `ontology.md`                          | glossary, ontology body, implementation status, divergences (parts 1 and 3) |
| `decisions.md`                         | decision log (part 2)                                           |
| `mockup/index.html`                    | wiring for `data-ont` and generated tooltips (part 4)            |
| `mockup/ontology-map.md`               | UI-to-ontology map (part 4)                                     |
| `ont.config.json`                      | configuration of the check (part 5)                             |
| `features/README.md`, `features/thing.md` | verification map and one scenario file (part 6)              |
| `agents-section.md`                    | the section to paste into `AGENTS.md` (part 7)                  |
| `issue.md`                             | ticket shape with tagged GIVEN/WHEN/THEN scenarios (part 8); checked through `tickets` in the config |

Start with `ontology.md`, `decisions.md` and a config that has only those two (remove `mockup`, `map`, `features`, `tickets`, `glossaryOut`, and set `"implementation": null` under `headings` until code exists). When code has tests, tag them with the IDs they prove and add `"tests": { "dir": "<tests>", "cover": ["inv", "rule"] }`. Run `tools/ont-check/guard-decisions.mjs` from the start: the decision log is the first file worth guarding.

After editing the glossary, regenerate the tooltips:

```bash
node tools/ont-check/gen-glossary.mjs --config ont.config.json
```
