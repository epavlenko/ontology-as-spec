# Ontology as Specification

A way to specify a product for AI coding agents: one model of the product's concepts and behavior that agents write the UI and the code from, and that the decisions, the tests and the code all refer to, kept consistent by an automatic check.

**Status.** An early version, v0.1, in active development: the rules still change every few days, and each change is an entry in [decisions.md](decisions.md). Four private projects use it. Issues and pull requests are welcome ([CONTRIBUTING.md](CONTRIBUTING.md)). More under [Status and origin](#status-and-origin).

**Where to start.** Read the [summary](#summary) and [the idea](#the-idea), run [the example](#try-it-in-two-minutes), then read [Adopting the approach](docs/lifecycle.md#adopting-the-approach). Every rule and check is listed in [docs/reference.md](docs/reference.md).

## Summary

When AI agents write most of the code, the description of the product becomes the main input to development. That description is usually scattered, and its parts drift apart. This approach keeps it in one place: a list of the product's concepts, each with a permanent ID and one definition. Everything else points at those IDs, and a script fails the build when the pointers stop matching. Agents then know what each thing is and why it is that way, so they can work longer without a human.

## The problem

The description of a product lives in many places: design docs, mockups, tickets, chats and the code itself. Each place names and defines things its own way, and nothing connects them. Over time they drift apart. Agents read only what is in front of them and remember nothing between sessions, so they take whichever version they see. Feature specs help with one change at a time, but nothing keeps the shared concepts consistent across all changes.

An example. You ask an agent to add holds to a library app. The design doc calls them "holds", the mockup says "reservations", and the code has `queueEntry`. The agent builds a fourth thing.

Last month you decided that a loan cannot be renewed while someone is waiting for the book. The reason lives in an old chat. The next agent "fixes" it.

## The idea

Give every product concept one name, one short definition and a permanent ID, in a table for the entity it belongs to, grouped by kind. Fields and relations also get a type:

```markdown
## Loan

| Kind      | ID                       | Term                 | Type | Definition                                                  |
| --------- | ------------------------ | -------------------- | ---- | ----------------------------------------------------------- |
| Entity    | `ent.loan`               | Loan                 |      | An item lent to a member, from checkout until return.       |
| Field     | `field.loan.due-date`    | Due date             | date | When the item must be back: checkout plus the loan period.  |
| Invariant | `inv.no-renew-when-held` | No renewal when held |      | A loan cannot be renewed while someone waits for the title. |
| Action    | `action.renew`           | Renew                |      | Move the due date by the renewal rule.                      |
```

These tables, one per entity with short notes under each, are the "ontology". It is a plain Markdown file written for people and agents to read, not a formal model in OWL or RDF. Each concept is defined once, and a reader who wants everything about loans opens one section.

Then everything that touches meaning refers to the IDs:

- **Decisions.** Each decision is logged with its date, where it was made, its reason, the rejected alternatives and the IDs it affects; what is put off is logged with the condition for taking it up again. Old entries are never edited; a new entry replaces them, and a guard refuses edits to accepted entries.
- **The UI.** Each meaningful element of the interface mockup carries `data-ont="action.renew"`, and its tooltip comes from the definition. A map lists each element with its concept, screen by screen; what an element deliberately does not do is written in the ontology.
- **The code.** Code names the concepts it implements in a comment, `// ont: inv.no-renew-when-held`, and the check confirms that every name exists. A table says which concepts are already implemented and in which files, and a list says where the code still disagrees with the agreed target. Fields and relations have types in a neutral vocabulary, and a JSON Schema per entity is generated from them, so any language can check its data or generate its types from the same source.
- **Checks and tests.** A catalogue of checks says what must hold, as GIVEN/WHEN/THEN cases in the product's terms, for any implementation. Each test names the check it implements: `test("[check.loan.renew-while-held] renewal is refused while someone waits")`. The configuration says which test suite must prove which kind of concept: rules by unit tests, actions by end-to-end tests.
- **Documentation.** Pages for people are written from the ontology, by a person or an agent, and each section names the concepts it explains in an anchor readers do not see. The check says which concepts no page explains and which sections to reread after a definition changed. Reference pages, such as a list of terms, are generated.
- **Tasks.** The work left is computed: concepts not yet built, checks without a test, known divergences, and what each target waits for. `--next` proposes the next slice of what is ready. A ticket is a slice of that gap with its limits and permissions, and it is done when the check says so.

One script checks all of these against each other, in both directions, on every commit and in CI. It also checks the shape of the ontology: kinds in order, every field in its entity's table.

## Who it is for

Teams and solo builders whose code is mostly written by coding agents, and the person who owns what the product means: a founder, a product owner, a tech lead. It pays off when the product has enough concepts that people argue about their names and rules, and when agents run long tasks without supervision.

The ontology, its tables of concepts and its catalogue of checks, is the specification: a model writes the code from it, the mockup included, and a change of behavior starts in it. See [principle 6](docs/principles.md#6-the-ontology-is-the-source-of-the-code).

## Try it in two minutes

Requires Node 20 or later.

```bash
node tools/ont-check/ont-check.mjs --config example/ont.config.json   # prints ONT_OK
node --test 'tools/ont-check/test/*.test.mjs'                        # the check catches each kind of drift
```

Then open `example/mockup/index.html` in a browser and hover over the elements. Rename a `data-ont` value or delete a row from `example/mockup/ontology-map.md`, run the check again, and read what it reports.

To adopt the approach, start with ten definition rows for the concepts your team argues about most, then grow the ontology until it describes the product's behavior. See [Adopting the approach](docs/lifecycle.md#adopting-the-approach) and the [templates](templates/README.md).

## What's in this repository

| Path                                                         | What it is                                                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| [example/](example/README.md)                                | a fictional lending library described end to end: ontology, decisions, mockup, map, checks, a ticket, code and tests |
| [docs/reference.md](docs/reference.md)                       | every concept, rule and check of the approach, generated from its ontology                                           |
| [docs/principles.md](docs/principles.md)                     | the principles and the failures each one prevents                                                                    |
| [docs/parts/](docs/parts/README.md)                          | the nine parts, one file each: what it is, why, how it works, how it fails                                           |
| [docs/profiles.md](docs/profiles.md)                         | recipes for a property of a product: model output, interface, model and data scenarios                               |
| [docs/lifecycle.md](docs/lifecycle.md)                       | how a change travels: new concept, rename, removal, superseded decision, implementation, adoption                    |
| [docs/comparison.md](docs/comparison.md)                     | spec-driven development tools and older practices, with links to primary sources                                     |
| [docs/limitations.md](docs/limitations.md)                   | weaknesses, open questions and open proposals                                                                        |
| [templates/](templates/README.md)                            | starting files for every artifact                                                                                    |
| [skills/ontology-as-spec/](skills/ontology-as-spec/SKILL.md) | an agent skill that walks an agent through adopting the approach and points back here (MIT)                          |
| [skills/change-review/](skills/change-review/SKILL.md)       | an agent skill that reviews a change before merge against the manual checks it touches (MIT)                         |
| [tools/ont-check/](tools/ont-check/README.md)                | the check, the decision guard, and the generators of tooltips, contracts and reference pages; Node, no dependencies  |
| [ontology.md](ontology.md), [checks.md](checks.md)           | the approach described with itself: its concepts, rules and checks, checked like any product                         |
| [decisions.md](decisions.md)                                 | decisions about this repository                                                                                      |

## How it compares

Birgitta Böckeler [describes three levels](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) of spec-driven development: spec-first, spec-anchored and spec-as-source. In this approach the ontology is the specification and the source of the code, and it is anchored to concepts rather than features. A feature spec describes one change and then ages. A concept keeps its ID for the life of the product. We call this **concept-anchored**. Tools such as Spec Kit, Kiro and OpenSpec work per feature or per change. None of them ties the interface to a shared vocabulary. The full comparison, including older practices such as Domain-Driven Design and decision records, is in [docs/comparison.md](docs/comparison.md).

## Status and origin

This is an early version, v0.1, in active development. Each change to a rule of the approach is an entry in [decisions.md](decisions.md); an entry marked tentative is a proposal, not yet a rule.

The approach took shape in 2026 in a product project developed largely by coding agents. Over about six weeks its ontology grew to roughly 150 concepts, with the check running in CI and on every commit that touched meaning. This repository describes the approach and does not document that product or name it. The example is fictional.

Since then the generic check in `tools/ont-check` has been used in four private projects, that product among them. [Limitations](docs/limitations.md) lists what the approach does not do.

Questions and reports of errors are welcome as GitHub issues, and changes as pull requests; the owner decides what to merge ([CONTRIBUTING.md](CONTRIBUTING.md)). Maintained by Jevgenijs Pavlenko.

## License

Copyright © 2026 Jevgenijs Pavlenko.

- The text in `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `decisions.md`, `ontology.md`, `checks.md` and `docs/` is licensed under [Creative Commons Attribution 4.0 International](LICENSE-CC-BY-4.0) (CC BY 4.0). You may copy, adapt and use it for any purpose, including commercially, as long as you credit the authors and link the source.
- The tool in `tools/`, the templates in `templates/` and the example in `example/` are licensed under the [MIT License](LICENSE). Copy them into your own repositories freely; keep the copyright notice with the tool.
- Everything else, the configuration (`ont.config.json`, `package.json`), the generated contract in `contracts/`, the hook in `.githooks/` and the CI in `.github/`, is licensed under the [MIT License](LICENSE) too.
- A contribution is licensed under the license of the file it changes, with no contributor license agreement ([CONTRIBUTING.md](CONTRIBUTING.md#license-of-contributions)).
