# Ontology as Specification

Keep a product's meaning in the repository as a semi-formal ontology in which every concept has a permanent ID. Make every other artifact, including the mockup, the decision log, the implementation table, the verification scenarios and the tickets, refer to concepts by those IDs. Run a check that keeps the references whole in both directions.

This approach is **concept-anchored**. In Birgitta Böckeler's terms ([spec-first, spec-anchored, spec-as-source](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)) it is spec-anchored, but the unit that stays anchored is a concept rather than a feature. A feature spec describes one change and then ages. A concept has one ID and one definition, and every artifact that touches it points back at it for as long as the product lives.

## The problem it addresses

When most of the code is written by coding agents, the expensive failure is not bad code. It is an agent building the wrong thing confidently. The cause is usually lost meaning:

- The same idea has three names in the doc, the mockup and the code, and an agent treats them as three things.
- A decision was made in a conversation, its reason was never written down, and the next agent reverses it.
- The design document describes where the product is going. Nobody can tell which parts already exist.
- A mockup shows a button whose behavior is defined nowhere.

Feature-level specs (Spec Kit, Kiro, OpenSpec) help with one change at a time. They do not keep a shared vocabulary consistent across all changes, and they do not tie the interface to that vocabulary.

## The idea in six points

1. **One concept, one ID, one definition.** A glossary table lists every concept as `class.name` (`field.due-date`, `inv.one-loan-per-item`, `view.member.loans`) with a short definition. IDs never change; renaming a term changes only its text.
2. **Decisions are appended, never edited.** Every product decision has a date, a reason, the rejected alternatives and the concept IDs it touches. A changed mind is a new entry that supersedes the old one.
3. **Target and reality are kept apart on purpose.** The ontology describes the target model. An implementation table maps IDs to the files that implement them, and a list of known divergences says where the code disagrees.
4. **The mockup is the UI specification.** Every meaningful element carries `data-ont="<id>"`; its tooltip is generated from the glossary. A map records what each element shows and what it deliberately does not do.
5. **A check keeps it whole.** One script cross-checks the glossary, the ontology text, the generated tooltips, the mockup, the map, the decision log, the implementation table and the verification scenarios. It runs on commit and in CI.
6. **Agents start from IDs and finish on commands.** Agent rules say what else to update when something changes. Tickets name the IDs they touch, and their "Done when" is a list of commands.

## What "ontology" means here

The ontology is a semi-formal Markdown document of tables and prose, written for people and agents to read. It is not OWL, RDF or a formal logic. It names entities, fields, relations, rules, invariants, derived values, automatic behaviors, views and actions, and it says how they relate. Its job is to be the one place where a concept is defined, so that everything else can point at it.

## Where it came from

The approach took shape in 2026 in a product project developed largely by coding agents. Over about six weeks that ontology grew to roughly 150 concepts and 40 decisions, with the check running in CI and on every commit that touched meaning. This repository describes the approach and does not document that product. The example is fictional.

Status: a working practice in one project, with a tool generalized from it. Everything under [Proposed strengthening](docs/limitations.md#proposed-strengthening) is a proposal that has not been tried.

## Repository map

| Path | What it is |
| ---- | ---------- |
| [docs/principles.md](docs/principles.md) | the principles behind the approach |
| [docs/parts/](docs/parts/README.md) | the eight parts, one file each: format, rules, what the check catches and what it does not |
| [docs/lifecycle.md](docs/lifecycle.md) | how a change travels: new concept, rename, removal, superseded decision, implementation |
| [docs/comparison.md](docs/comparison.md) | spec-driven development tools and older practices, with links to primary sources |
| [docs/why-not-spec-as-source.md](docs/why-not-spec-as-source.md) | why the ontology does not generate the product, and why that is fine |
| [docs/limitations.md](docs/limitations.md) | weaknesses, open questions, proposed strengthening |
| [example/](example/README.md) | a fictional lending library described end to end, with mockup, scenarios and code |
| [templates/](templates/README.md) | empty starting points for every artifact |
| [tools/ont-check/](tools/ont-check/README.md) | the check and the glossary generator; Node, no dependencies |
| [decisions.md](decisions.md) | decisions about this repository and the approach itself |

## Try it

```bash
node tools/ont-check/ont-check.mjs --config example/ont.config.json   # ONT_OK
node --test 'tools/ont-check/test/*.test.mjs'                        # the check fails on each kind of drift
```

Then open `example/mockup/index.html` and hover over the elements.

To adopt it, copy `templates/` into your repository, write the first ten glossary rows for the concepts you argue about most, and point `ont.config.json` at your files. See [Adopting](docs/lifecycle.md#adopting-the-approach).

## License

Copyright © 2026 Jevgenijs Pavlenko.

- The text in `README.md`, `docs/` and `decisions.md` is licensed under [Creative Commons Attribution 4.0 International](LICENSE-CC-BY-4.0) (CC BY 4.0). You may copy, adapt and use it for any purpose, including commercially, as long as you credit the author and link the source.
- The tool in `tools/`, the templates in `templates/` and the example in `example/` are licensed under the [MIT License](LICENSE). Copy them into your own repositories freely; keep the copyright notice with the tool.
