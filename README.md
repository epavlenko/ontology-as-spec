# Ontology as Specification

A way to specify a product for AI coding agents: one model of the product's concepts that the UI, the decisions and the code all refer to, kept consistent by an automatic check.

## Summary

When AI agents write most of the code, the description of the product becomes the main input to development. That description is usually scattered, and its parts drift apart. This approach keeps it in one place: a list of the product's concepts, each with a permanent ID and one definition. Everything else points at those IDs, and a script fails the build when the pointers stop matching. Agents then know what each thing is and why it is that way, so they can work longer without a human.

## The problem

The description of a product lives in many places: design docs, mockups, tickets, chats and the code itself. Each place names and defines things its own way, and nothing connects them. Over time they drift apart. Agents read only what is in front of them and remember nothing between sessions, so they take whichever version they see. Feature specs help with one change at a time, but nothing keeps the shared concepts consistent across all changes.

An example. You ask an agent to add holds to a library app. The design doc calls them "holds", the mockup says "reservations", and the code has `queueEntry`. The agent builds a fourth thing.

Last month you decided that a loan cannot be renewed while someone is waiting for the book. The reason lives in an old chat. The next agent "fixes" it.

## The idea

Give every product concept one name, one short definition and a permanent ID:

```markdown
| ID                       | Term                 | Definition                                                   |
| ------------------------ | -------------------- | ------------------------------------------------------------ |
| `action.renew`           | Renew                | Move the due date by the renewal rule. Refused while someone waits for the title. |
| `inv.no-renew-when-held` | No renewal when held | A loan cannot be renewed while someone waits for the title.  |
```

This list, with the longer explanations around it, is the "ontology". It is a plain Markdown file written for people and agents to read, not a formal model in OWL or RDF.

Then everything that touches meaning refers to the IDs:

- **Decisions.** Each decision is logged with its date, its reason, the rejected alternatives and the IDs it affects. Old entries are never edited; a new entry replaces them.
- **The UI.** Each meaningful element of the interface mockup carries `data-ont="action.renew"`, and its tooltip comes from the definition. A map records what each element shows and what it deliberately does not do.
- **The code.** A table says which concepts are already implemented and in which files, and a list says where the code still disagrees with the agreed target.
- **Verification.** A scenario for each implemented feature names the IDs it proves.
- **Tasks.** A ticket names the IDs it touches and ends with the commands that must pass.

One script checks all of these against each other, in both directions, on every commit and in CI.

## Who it is for

Teams and solo builders whose code is mostly written by coding agents, and the person who owns what the product means: a founder, a product owner, a tech lead. It pays off when the product has enough concepts that people argue about their names and rules, and when agents run long tasks without supervision.

It is not a tool for generating code from a specification. See [why not spec-as-source](docs/why-not-spec-as-source.md).

## Try it in two minutes

Requires Node 20 or later.

```bash
node tools/ont-check/ont-check.mjs --config example/ont.config.json   # prints ONT_OK
node --test 'tools/ont-check/test/*.test.mjs'                        # the check catches each kind of drift
```

Then open `example/mockup/index.html` in a browser and hover over the elements. Rename a `data-ont` value or delete a row from `example/mockup/ontology-map.md`, run the check again, and read what it reports.

To adopt the approach, start with ten glossary rows for the concepts your team argues about most. See [Adopting the approach](docs/lifecycle.md#adopting-the-approach) and the [templates](templates/README.md).

## What's in this repository

| Path | What it is |
| ---- | ---------- |
| [example/](example/README.md) | a fictional lending library described end to end: ontology, decisions, mockup, map, scenarios, a ticket and code |
| [docs/principles.md](docs/principles.md) | the principles and the failures each one prevents |
| [docs/parts/](docs/parts/README.md) | the eight parts, one file each: format, rules, what the check catches and what it does not |
| [docs/lifecycle.md](docs/lifecycle.md) | how a change travels: new concept, rename, removal, superseded decision, implementation, adoption |
| [docs/comparison.md](docs/comparison.md) | spec-driven development tools and older practices, with links to primary sources |
| [docs/why-not-spec-as-source.md](docs/why-not-spec-as-source.md) | why the ontology does not generate the product |
| [docs/limitations.md](docs/limitations.md) | weaknesses, open questions and proposed strengthening |
| [templates/](templates/README.md) | starting files for every artifact |
| [tools/ont-check/](tools/ont-check/README.md) | the check and the tooltip generator; Node, no dependencies |
| [decisions.md](decisions.md) | decisions about this repository |

## How it compares

Birgitta Böckeler [describes three levels](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) of spec-driven development: spec-first, spec-anchored and spec-as-source. This approach is spec-anchored, but what stays anchored is a concept rather than a feature. A feature spec describes one change and then ages. A concept keeps its ID for the life of the product. We call this **concept-anchored**. Tools such as Spec Kit, Kiro and OpenSpec work per feature or per change. None of them ties the interface to a shared vocabulary. The full comparison, including older practices such as Domain-Driven Design and decision records, is in [docs/comparison.md](docs/comparison.md).

## Status and origin

The approach took shape in 2026 in a product project developed largely by coding agents. Over about six weeks its ontology grew to roughly 150 concepts and 40 decisions, with the check running in CI and on every commit that touched meaning. This repository describes the approach and does not document that product. The example is fictional.

The generic check in `tools/ont-check` is its first version and has not yet been used in a second real project. The code in the source project does not yet refer to concept IDs, so the check cannot see when code behavior contradicts the ontology. Everything under [Proposed strengthening](docs/limitations.md#proposed-strengthening) is a proposal that has not been tried.

Questions and suggestions are welcome as GitHub issues. Maintained by Jevgenijs Pavlenko.

## License

Copyright © 2026 Jevgenijs Pavlenko.

- The text in `README.md`, `docs/` and `decisions.md` is licensed under [Creative Commons Attribution 4.0 International](LICENSE-CC-BY-4.0) (CC BY 4.0). You may copy, adapt and use it for any purpose, including commercially, as long as you credit the author and link the source.
- The tool in `tools/`, the templates in `templates/` and the example in `example/` are licensed under the [MIT License](LICENSE). Copy them into your own repositories freely; keep the copyright notice with the tool.
