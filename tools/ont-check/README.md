# ont-check

The drift check, the decision guard, the tooltip generator and the contract generator. Node 20 or later, no dependencies. What it checks and why is described in [part 5](../../docs/parts/drift-check.md).

```bash
node tools/ont-check/gen-glossary.mjs --config path/to/ont.config.json   # glossary → generated tooltips
node tools/ont-check/ont-check.mjs    --config path/to/ont.config.json   # ONT_OK, or the drift and exit code 1
node tools/ont-check/ont-check.mjs    --config path/to/ont.config.json --coverage   # also: what proves each implemented concept
node tools/ont-check/ont-check.mjs    --config path/to/ont.config.json --gap [ticket.md]   # also: the work left, or one ticket's slice (exit 1 until done)
node tools/ont-check/gen-contracts.mjs --config path/to/ont.config.json   # field and relation types → JSON Schema
node tools/ont-check/guard-decisions.mjs --config path/to/ont.config.json [--base REF] [--staged]   # GUARD_OK
```

Without `--config`, all three look for `ont.config.json` in the current directory. The guard also takes `--file path/to/decisions.md` for a log without a config, and several `--config` and `--file` arguments at once.

## Files

| File               | What it does                                                                      |
| ------------------ | --------------------------------------------------------------------------------- |
| `ont-check.mjs`    | the check                                                                         |
| `guard-decisions.mjs` | fails if an entry accepted in an earlier commit (`--base`, default `HEAD`) was edited or removed; `--staged` reads the staged log |
| `gen-glossary.mjs` | writes `window.ONT = {...}` from the definition rows                              |
| `gen-contracts.mjs` | writes the JSON Schema, one definition per entity, from the Type cells           |
| `contracts.mjs`    | the type vocabulary and the schema builder, shared by the generator and the check |
| `lib.mjs`          | the one parser both use, and the config loader                                    |
| `ont-tooltips.js`  | browser runtime for the mockup: sets `title` from `window.ONT` on `[data-ont]` elements |
| `test/`            | copies the example, breaks it one way at a time, asserts the check names the break; runs the guard in a throwaway repository |

## Configuration

Paths are relative to the config file.

| Key | Meaning | Required |
| --- | ------- | -------- |
| `classes` | allowed ID classes in the order rows are grouped, either a list (`["ent", "field", "view"]`) or an object of class and Kind label (`{"ent": "Entity", "field": "Field"}`); with labels the Kind cells are checked | yes |
| `scoped` | classes whose IDs name their entity (`["field", "edge"]`): `field.loan.due-date` must sit in the table of `ent.loan` | no |
| `ontology` | the ontology Markdown file | yes |
| `headings.retired` | heading of the retired IDs table; default `## Retired IDs`; the section may be absent | no |
| `headings.implementation` | heading of the implementation table; default `## Implementation status`; `null` until code exists | no |
| `root` | base directory for paths in the implementation table; default the config's directory | no |
| `decisions.file` | the decision log | no |
| `decisions.entry` | regex for an entry heading with the number in group 1; default `^### (D-\d+) · .+$` | no |
| `decisions.ref` | regex for a reference to an entry; default `\bD-\d+\b` | no |
| `decisions.accepted` | regex for the line that marks an entry accepted, for the guard; default `^- Date:.*Status:\s*accepted\b`, case-insensitive; set it for a log in another language | no |
| `glossaryOut` | the generated tooltip file | no |
| `contracts.out`, `contracts.classes`, `contracts.propertyCase` | the generated JSON Schema; the classes that carry a type (default `["field", "edge"]`); property names from the ID's last part as `camel` (default), `snake` or `kebab` | no |
| `mockup` | list of mockup HTML files | no |
| `map.file`, `map.idColumn` | the UI-to-ontology map and the 1-based column holding IDs; default 2 | no |
| `checks.file`, `checks.require` | the check catalogue, and the classes every concept of which must have a check (default `["inv", "rule"]`) | no |
| `features.dir`, `features.cover` | the older verification map: scenario files with an `IDs:` line; still read, superseded by `checks` | no |
| `testSuites` | a list of suites, each `{ "name", "dir", "match", "cover" }`: a unique name such as `unit` or `end-to-end`, where its tests are, a regex for test file paths (default `\.test\.[a-z]+$`), and the classes every implemented ID of which must be named by a test in this suite | no |
| `tests` | the older form: one suite without a name, with the same `dir`, `match` and `cover` | no |
| `tickets.dir`, `tickets.match` | where ticket files are, and a regex for their paths (default `\.md$`; `README.md` is skipped) | no |
| `notYetShown` | classes reported (as information) when a concept has no mockup element yet | no |

Every optional part can be left out. The checks that depend on it are then skipped.

## Formats it expects

- **Definition rows:** ``| Kind | `class.name` | Term | Definition |``, anywhere in the ontology. A table is a run of consecutive table lines; the Kind cell holds no backticks. Together the rows are the glossary.
- **Type cells:** a fifth column, ``| Kind | `id` | Term | Type | Definition |``. Vocabulary: `text`, `number`, `boolean`, `integer` with optional bounds (`integer 0..2`, `integer 1..`), `date`, `datetime`, `one of a, b, c`, ``ref `ent.x` ``, ``refs `ent.x` ``, each optionally followed by `optional`.
- **Retired IDs:** ``| `old.id` | `new.id` | D-nn |`` under `headings.retired`; a dash instead of the new ID for a removed concept.
- **IDs in Markdown:** in backticks. Other text is not read as IDs.
- **Implementation rows:** ``| `class.name` | `path`, `path` | note |`` inside the implementation section.
- **Mockup:** `data-ont="class.name"` attributes, and IDs in single quotes inside scripts (`'view.catalog'`). IDs built from templates are declared in a comment `/* data-ont dynamic: 'class.a','class.b' */`, and the markup must contain `data-ont="class.${`.
- **Decision entries:** headings matched by `decisions.entry`.
- **Checks:** ``| `check.section.name` | `id`, `id` | GIVEN | WHEN | THEN | auto or manual |`` under `## Section` headings; the second part of the ID is the heading in lowercase.
- **Scenario files (older):** an `IDs:` line at the start of a line.
- **Test tags:** IDs in square brackets anywhere in a test file, normally at the start of a test title: `test("[check.loan.renew-while-held] …")`, or a concept for what is not a product check, `test("[field.loan.renewals] …")`. Only `check` and configured classes are read, so `[0]` or `[x.y]` is not a tag.
- **Tickets:** an `IDs:` or `Ontology IDs:` line; the checks they list, in backticks. Older tickets may have a `## Scenarios` section whose bullets read `- [id, id] GIVEN … WHEN … THEN …`.
- **Decision status (guard):** an entry is accepted when one of its lines matches `decisions.accepted`, by default a `- Date:` line containing `Status: accepted`.

## Hooks

Run the check on commits that touch any file it reads, and on the code paths that implement concepts. The second set is a reminder to update the implementation table, even though the check does not read code. Run the guard with `--staged` on every commit, and in CI with `--base` set to the commit before the push or the base of the pull request. This repository's own hook is `.githooks/pre-commit` and its CI is `.github/workflows/check.yml`; enable the hook with `git config core.hooksPath .githooks`.

## Tests

```bash
node --test 'tools/ont-check/test/*.test.mjs'
```
