# Contributing

Ontology as Specification is an early version, v0.1, in active development: the rules still change every few days, each with an entry in [decisions.md](decisions.md). See [Status and origin](README.md#status-and-origin). Questions, reports of errors and changes are welcome; the owner decides what to merge ([D-55](decisions.md)).

## Issues

Open an issue for a question or a report of an error: a check that passes where it should fail or fails where it should pass, a rule that the documentation states one way and the tool enforces another, an example that does not run. Say which file it is about and, for the tool, the command and its output.

## Pull requests

Anyone may open a pull request, and the owner decides whether to merge it. A small fix, such as a typo or a broken link, needs no issue first; for a larger change, an issue first saves work on both sides.

### Changing the approach itself

The approach is described with itself, so a change to one of its rules travels like a change to any product made with it ([lifecycle](docs/lifecycle.md)):

1. Start in [ontology.md](ontology.md) and [checks.md](checks.md): the definition rows of the concepts the change adds or changes, in the section of their entity, and their checks, in the product's terms.
2. Add an entry to [decisions.md](decisions.md), under Tentative, with the decision, why, and the alternatives you rejected, and `Status: tentative` on its date line. The owner accepts it when merging and names the pull request on its `Source:` line. An accepted entry is never edited: to change one, write a new entry that supersedes it whole.
3. Explain the change in `docs/`, under an anchor that names its concepts, and list a new mechanism in [docs/limitations.md](docs/limitations.md) as not yet used in a project.
4. If the tool changes, implement it in `tools/ont-check`, with tests whose titles start with the IDs of the checks they implement.
5. Keep the example and the templates consistent, and add a line to the revision history of the ontology.

Write in English, and take examples from the fictional lending library in `example/`, or use generic placeholders.

### Before you open it

```bash
npm run format     # kind order, Kind cells and aligned definition tables
npm run generate   # tooltips, contracts, reference pages and the approach's IDs
npm test           # the check on the approach, the example and the templates, the decision guard, and all tests
```

`npm test` prints `ONT_OK` three times and `GUARD_OK`, and every test passes; after `format` and `generate`, nothing is left to commit. To run the check and the guard on every commit, enable the hook once: `git config core.hooksPath .githooks`.

## License of contributions

A contribution is licensed under the license of the file it changes: CC BY 4.0 for the text, and MIT for the tool, the templates, the example and the configuration ([License](README.md#license)). That is GitHub's default: "Whenever you add Content to a repository containing notice of a license, you license that Content under the same terms" ([Terms of Service, D.6](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#6-contributions-under-repository-license)). There is no contributor license agreement, and you keep the copyright of what you write.
