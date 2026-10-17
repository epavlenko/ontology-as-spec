# ont-check

The drift check and the tooltip generator. Node 20 or later, no dependencies. What it checks and why is described in [part 5](../../docs/parts/drift-check.md).

```bash
node tools/ont-check/gen-glossary.mjs --config path/to/ont.config.json   # glossary → generated tooltips
node tools/ont-check/ont-check.mjs    --config path/to/ont.config.json   # ONT_OK, or the drift and exit code 1
```

Without `--config`, both look for `ont.config.json` in the current directory.

## Files

| File               | What it does                                                                      |
| ------------------ | --------------------------------------------------------------------------------- |
| `ont-check.mjs`    | the check                                                                         |
| `gen-glossary.mjs` | writes `window.ONT = {...}` from the glossary table                               |
| `lib.mjs`          | the one parser both use, and the config loader                                    |
| `ont-tooltips.js`  | browser runtime for the mockup: sets `title` from `window.ONT` on `[data-ont]` elements |
| `test/`            | copies the example, breaks it one way at a time, asserts the check names the break |

## Configuration

Paths are relative to the config file.

| Key | Meaning | Required |
| --- | ------- | -------- |
| `classes` | allowed ID classes, such as `["ent", "field", "view"]` | yes |
| `ontology` | the ontology Markdown file | yes |
| `headings.glossary` | heading of the glossary section; default `## Glossary` | no |
| `headings.implementation` | heading of the implementation table; default `## Implementation status`; `null` until code exists | no |
| `root` | base directory for paths in the implementation table; default the config's directory | no |
| `decisions.file` | the decision log | no |
| `decisions.entry` | regex for an entry heading with the number in group 1; default `^### (D-\d+) · .+$` | no |
| `decisions.ref` | regex for a reference to an entry; default `\bD-\d+\b` | no |
| `glossaryOut` | the generated tooltip file | no |
| `mockup` | list of mockup HTML files | no |
| `map.file`, `map.idColumn` | the UI-to-ontology map and the 1-based column holding IDs; default 2 | no |
| `features.dir`, `features.cover` | the verification map directory and the classes every implemented ID of which must be covered | no |
| `notYetShown` | classes reported (as information) when a concept has no mockup element yet | no |

Every optional part can be left out. The checks that depend on it are then skipped.

## Formats it expects

- **Glossary rows:** ``| `class.name` | Term | Definition |``, one per line, inside the glossary section.
- **IDs in Markdown:** in backticks. Other text is not read as IDs.
- **Implementation rows:** ``| `class.name` | `path`, `path` | note |`` inside the implementation section.
- **Mockup:** `data-ont="class.name"` attributes, and IDs in single quotes inside scripts (`'view.catalog'`). IDs built from templates are declared in a comment `/* data-ont dynamic: 'class.a','class.b' */`, and the markup must contain `data-ont="class.${`.
- **Decision entries:** headings matched by `decisions.entry`.
- **Scenario files:** an `IDs:` line at the start of a line.

## Hooks

Run the check on commits that touch any file it reads, and on the code paths that implement concepts. The second set is a reminder to update the implementation table, even though the check does not read code. This repository's own hook is `.githooks/pre-commit`; enable it with `git config core.hooksPath .githooks`.

## Tests

```bash
node --test 'tools/ont-check/test/*.test.mjs'
```
