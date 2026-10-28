# ont-check

The drift check, the decision guard, and the generators of tooltips, contracts and reference pages. Node 20 or later, no dependencies. Copy the whole directory into a project, `approach.json` included: it holds the approach's own IDs, which agent instructions and process entries name. What it checks and why is described in [part 5](../../docs/parts/drift-check.md).

```bash
node tools/ont-check/gen-glossary.mjs --config path/to/ont.config.json   # glossary → generated tooltips
node tools/ont-check/ont-check.mjs    --config path/to/ont.config.json   # ONT_OK, or the drift and exit code 1
node tools/ont-check/ont-check.mjs    --config path/to/ont.config.json --coverage   # also: what proves each implemented concept
node tools/ont-check/ont-check.mjs    --config path/to/ont.config.json --gap [ticket.md]   # also: the work left, or one ticket's slice (exit 1 until done)
node tools/ont-check/ont-check.mjs    --config path/to/ont.config.json --decisions   # also: every decision entry, in force, tentative or superseded, and the later entries that name it
node tools/ont-check/format-ontology.mjs --config path/to/ont.config.json   # kind order, Kind cells and aligned definition tables
node tools/ont-check/gen-contracts.mjs --config path/to/ont.config.json   # field and relation types → JSON Schema
node tools/ont-check/gen-reference.mjs --config path/to/ont.config.json   # reference pages from the ontology and the checks
node tools/ont-check/gen-approach.mjs  --config ont.config.json   # in the approach's own repository: approach.json from its ontology
node tools/ont-check/stamp-docs.mjs  --config path/to/ont.config.json [page.md …]   # after rereading: stamp the anchors
node tools/ont-check/guard-decisions.mjs --config path/to/ont.config.json [--base REF] [--staged]   # GUARD_OK, or GUARD_OFF before the first commit; lists accepted entries not committed yet
```

Without `--config`, every script looks for `ont.config.json` in the current directory. A ticket path after `--gap` is relative to the current directory. The guard also takes `--file path/to/decisions.md` for a log without a config, and several `--config` and `--file` arguments at once.

## Files

| File               | What it does                                                                      |
| ------------------ | --------------------------------------------------------------------------------- |
| `ont-check.mjs`    | the check                                                                         |
| `guard-decisions.mjs` | fails if an entry accepted in an earlier commit (`--base`, default `HEAD`) was edited or removed, or if an entry accepted since then names no source while the log names sources; `--staged` reads the staged log |
| `gen-glossary.mjs` | writes `window.ONT = {...}` from the definition rows                              |
| `format-ontology.mjs` | writes the kind order, the Kind cells and the alignment of the definition tables |
| `gen-contracts.mjs` | writes the JSON Schema, one definition per entity, from the Type cells           |
| `docs.mjs`         | anchors in documentation, stamps, and the reference page renderer                 |
| `gen-reference.mjs` | writes the reference pages listed under `references`                            |
| `stamp-docs.mjs`   | rewrites anchors with the current stamps                                          |
| `contracts.mjs`    | the type vocabulary and the schema builder, shared by the generator and the check |
| `lib.mjs`          | the one parser every script uses, and the config loader                            |
| `ont-tooltips.js`  | browser runtime for the mockup: sets `title` from `window.ONT` on `[data-ont]` elements |
| `approach.json`    | the approach's concept IDs and retired IDs, which agent instructions and process entries of a project may name; generated, copy it with the tool |
| `gen-approach.mjs` | writes `approach.json` from the approach's ontology, in the approach's own repository |
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
| `headings.divergences` | the start of the heading of the known divergences; default `### Known divergences`; the section may be absent | no |
| `root` | base directory for paths in the implementation table; default the config's directory | no |
| `code` | code directories whose `ont:` names the check also reads, besides the files of the implementation table: `[{"dir": "src", "match": "\\.ts$"}]` | no |
| `agentInstructions` | the files of the agents' instructions, such as `["AGENTS.md"]`; the check resolves the IDs and the entries they mention | no |
| `approachIds.out` | only in the approach's own repository: where `gen-approach.mjs` writes the approach's IDs | no |
| `decisions.file` | the decision log | no |
| `decisions.entry` | regex for an entry heading with the number in group 1; default `^### (D-\d+) · .+$` | no |
| `decisions.ref` | regex for a reference to an entry; default `\bD-\d+\b` | no |
| `decisions.supersedes` | regex for the line that names the entries an entry supersedes, with the list in group 1; default `^- Supersedes:\s*(.+)$`, case-insensitive | no |
| `decisions.source` | regex for the line that names where an entry was decided, with the source in group 1; default `^- Source:[ \t]*(\S.*)$`, case-insensitive. Once the log has one, the guard requires it on every entry accepted since its base | no |
| `decisions.processLayer` | regex for the line that marks an entry about how agents work; default `^- Layer:[ \t]*process\b`, case-insensitive | no |
| `decisions.extends`, `decisions.overrides` | regexes for the lines that name the rules of the approach a process entry extends or overrides, in group 1; defaults `^- Extends:[ \t]*(\S.*)$` and `^- Overrides:[ \t]*(\S.*)$` | no |
| `decisions.returnWhen` | regex for the line that makes an entry a deferral, with the condition in group 1; default `^- Return when:[ \t]*(\S.*)$`, case-insensitive | no |
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
| `docSets` | a list of documentation sets, each `{ "name", "dir", "match", "cover", "checks", "scope" }`: the classes the set must explain, the proofs whose checks it must name (`["manual"]` for a run guide), `implemented` (default) or `all` of their concepts and checks | no |
| `references` | a list of generated pages, each `{ "out", "title", "intro", "classes", "implementedOnly", "ids", "kinds", "types", "checks" }` | no |
| `external` | other ontologies whose IDs may appear as examples, each `{ "ontology", "checks" }`: their IDs and checks are known but not this ontology's | no |
| `notYetShown` | classes reported (as information) when a concept has no mockup element yet | no |

Every optional part can be left out. The checks that depend on it are then skipped.

## Formats it expects

- **Definition rows:** ``| Kind | `class.name` | Term | Definition |``, anywhere in the ontology. A table is a run of consecutive table lines; the Kind cell holds no backticks. Together the rows are the glossary.
- **Type cells:** a fifth column, ``| Kind | `id` | Term | Type | Definition |``. Vocabulary: `text`, `number`, `boolean`, `integer` with optional bounds (`integer 0..2`, `integer 1..`), `date`, `datetime`, `one of a, b, c`, ``ref `ent.x` ``, ``refs `ent.x` ``, each optionally followed by `optional`.
- **Retired IDs:** ``| `old.id` | `new.id` | D-nn |`` under `headings.retired`; a dash instead of the new ID for a removed concept.
- **IDs in Markdown text:** in backticks; other text is not read as IDs. Doc anchors and test tags, below, have their own forms.
- **Implementation rows:** ``| `class.name` | `path`, `path` | note |`` inside the implementation section. Concepts realised in the same files may share a row: ``| `class.a`, `class.b` | `path` | |``.
- **Known divergences:** bullets under a heading that starts with `headings.divergences`, by default `### Known divergences`, each naming the concepts involved in backticks; the check fails on a line that names none. `--gap` prints them. With a ticket it prints only those naming its concepts: a line that names only concepts of the slice keeps it open, and one that also names other concepts is shown apart and not counted.
- **Mockup:** `data-ont="class.name"` attributes, and IDs in single quotes inside scripts (`'view.catalog'`). IDs built from templates are declared in a comment `/* data-ont dynamic: 'class.a','class.b' */`, and the markup must contain `data-ont="class.${`.
- **Decision entries:** headings matched by `decisions.entry`.
- **Checks:** ``| `check.section.name` | `id`, `id` | GIVEN | WHEN | THEN | auto or manual |`` under `## Section` headings; the second part of the ID is the section's key: the code span in the heading (``## Préstamo `loan` ``), one span of lowercase letters, digits and hyphens, or else the heading's Latin letters and digits in lowercase, joined by hyphens. Each ontology section with definition rows needs a key of its own, and every catalogue section's key must name one of them.
- **Scenario files (older):** an `IDs:` line at the start of a line.
- **Test tags:** IDs in square brackets anywhere in a test file, normally at the start of a test title: `test("[check.loan.renew-while-held] …")`, or a concept for what is not a product check, `test("[field.loan.renewals] …")`. Only `check` and configured classes are read, so `[0]` or `[x.y]` is not a tag.
- **Tickets:** an `IDs:` or `Ontology IDs:` line, and a `Checks:` line with the checks of the slice in backticks. A check named elsewhere in a ticket must exist but is not part of the slice. Older tickets may have a `## Scenarios` section whose bullets read `- [id, id] GIVEN … WHEN … THEN …`.
- **Doc anchors:** `<!-- ont: id, id@stamp -->` in pages of a doc set; IDs are concepts or checks, stamps are optional and written by `stamp-docs.mjs`.
- **Supersession:** an entry that replaces older ones names them on a line matched by `decisions.supersedes`, by default `- Supersedes: D-05, D-07`. The line of a tentative entry takes effect when the entry is accepted.
- **Decision status (guard):** an entry is accepted when one of its lines matches `decisions.accepted`, by default a `- Date:` line containing `Status: accepted`. The check lists the entries that are not, as waiting for the owner's answer.
- **Sources (guard):** a line matched by `decisions.source`, by default `- Source: call of 2026-10-24, 00:41`. Once any entry has one, the guard fails on an entry accepted since its base without one, new or accepted from tentative; when the first source is newer than the base, only entries numbered after it are asked.
- **Code names:** `ont: id, id` in a comment of the code that implements the concepts, `// ont: rule.renewal`, in the files of the implementation table and of the directories under `code`. A stamp after `@` is ignored, so a doc anchor in such a file names its concepts too. Only these comments are read: a property path in code that looks like an ID is not one.
- **Agent instructions:** IDs in backticks, of the project's ontology or of the approach, and entries of the project's log by the pattern of `decisions.ref`. In them `D-nn` is always an entry of the project's log; a rule of the approach is named by its ID. The project's retired IDs come first, and file names such as `action.yml` are not IDs.
- **Process entries:** `- Layer: process`, and `- Extends:` or `- Overrides:` with the IDs of the rules of the approach in backticks. Every such line is checked, and an empty one fails; a superseded entry may name a rule the approach has retired since.
- **Deferrals:** a line matched by `decisions.returnWhen`, by default `- Return when: a second branch opens`. The check lists every accepted deferral in force with its condition, as information.

## Hooks

Run the check on commits that touch any file it reads, and on the code paths that implement concepts. The second set is a reminder to update the implementation table, even though the check does not read code. Run the guard with `--staged` on every commit, and in CI with `--base` set to the commit before the push or the base of the pull request. This repository's own hook is `.githooks/pre-commit` and its CI is `.github/workflows/check.yml`; enable the hook with `git config core.hooksPath .githooks`.

## Tests

```bash
node --test 'tools/ont-check/test/*.test.mjs'
```
