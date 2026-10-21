# ont-check

The drift check, the decision guard and the tooltip generator. Node 20 or later, no dependencies. What it checks and why is described in [part 5](../../docs/parts/drift-check.md).

```bash
node tools/ont-check/gen-glossary.mjs --config path/to/ont.config.json   # glossary → generated tooltips
node tools/ont-check/ont-check.mjs    --config path/to/ont.config.json   # ONT_OK, or the drift and exit code 1
node tools/ont-check/guard-decisions.mjs --config path/to/ont.config.json [--base REF] [--staged]   # GUARD_OK
```

Without `--config`, all three look for `ont.config.json` in the current directory. The guard also takes `--file path/to/decisions.md` for a log without a config, and several `--config` and `--file` arguments at once.

## Files

| File               | What it does                                                                      |
| ------------------ | --------------------------------------------------------------------------------- |
| `ont-check.mjs`    | the check                                                                         |
| `guard-decisions.mjs` | fails if an entry accepted in an earlier commit (`--base`, default `HEAD`) was edited or removed; `--staged` reads the staged log |
| `gen-glossary.mjs` | writes `window.ONT = {...}` from the definition rows                              |
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
| `glossaryOut` | the generated tooltip file | no |
| `mockup` | list of mockup HTML files | no |
| `map.file`, `map.idColumn` | the UI-to-ontology map and the 1-based column holding IDs; default 2 | no |
| `features.dir`, `features.cover` | the verification map directory and the classes every implemented ID of which must be covered | no |
| `tests.dir`, `tests.match`, `tests.cover` | where the tests are, a regex for test file paths (default `\.test\.[a-z]+$`), and the classes every implemented ID of which must be named by a test | no |
| `tickets.dir`, `tickets.match` | where ticket files are, and a regex for their paths (default `\.md$`; `README.md` is skipped) | no |
| `notYetShown` | classes reported (as information) when a concept has no mockup element yet | no |

Every optional part can be left out. The checks that depend on it are then skipped.

## Formats it expects

- **Definition rows:** ``| Kind | `class.name` | Term | Definition |``, anywhere in the ontology. A table is a run of consecutive table lines; the Kind cell holds no backticks. Together the rows are the glossary.
- **Retired IDs:** ``| `old.id` | `new.id` | D-nn |`` under `headings.retired`; a dash instead of the new ID for a removed concept.
- **IDs in Markdown:** in backticks. Other text is not read as IDs.
- **Implementation rows:** ``| `class.name` | `path`, `path` | note |`` inside the implementation section.
- **Mockup:** `data-ont="class.name"` attributes, and IDs in single quotes inside scripts (`'view.catalog'`). IDs built from templates are declared in a comment `/* data-ont dynamic: 'class.a','class.b' */`, and the markup must contain `data-ont="class.${`.
- **Decision entries:** headings matched by `decisions.entry`.
- **Scenario files:** an `IDs:` line at the start of a line.
- **Test tags:** IDs in square brackets anywhere in a test file, normally at the start of a test title: `test("[inv.one-loan-per-item] …")`, `test("[rule.renewal, field.renewals] …")`. Only configured classes are read, so `[0]` or `[x.y]` is not a tag.
- **Tickets:** an `IDs:` or `Ontology IDs:` line, and a `## Scenarios` section whose bullets read `- [id, id] GIVEN … WHEN … THEN …`.
- **Decision status (guard):** an entry is accepted when its `- Date:` line contains `Status: accepted`.

## Hooks

Run the check on commits that touch any file it reads, and on the code paths that implement concepts. The second set is a reminder to update the implementation table, even though the check does not read code. Run the guard with `--staged` on every commit, and in CI with `--base` set to the commit before the push or the base of the pull request. This repository's own hook is `.githooks/pre-commit` and its CI is `.github/workflows/check.yml`; enable the hook with `git config core.hooksPath .githooks`.

## Tests

```bash
node --test 'tools/ont-check/test/*.test.mjs'
```
