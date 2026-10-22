# 9. Documentation anchored to the ontology

## What it is

Documentation for people, written by people or agents, with the ontology as its source. It is treated the way the interface and the code are: the explanations are written by hand and anchored to concept IDs, and only what restates the ontology is generated.

| | Written by hand | Anchored to IDs | Generated |
| - | - | - | - |
| Interface | the mockup | `data-ont` on elements, the map | tooltips |
| Code | code and tests | test tags, the implementation table | contracts |
| Documentation | explanations and guides | an anchor on each section | reference pages: terms, fields, checks |

A section names the concepts it explains in an HTML comment that readers do not see:

```markdown
<!-- ont: action.renew@3a0bfa, rule.renewal@ee5883, field.loan.renewals@d73680 -->
## How renewal works

If you need an item longer, renew it from "My loans". Each renewal adds 14 days …
```

## Why

Documentation describes the same product as the ontology, in the words of its readers. Without a link between them it drifts the same way design documents and code drift: a rule changes in the ontology, the help page keeps the old one, and nobody notices. An anchor makes the link explicit without filling the text with IDs.

Generating the prose itself is rejected for the same reason the approach does not generate code: the result is not deterministic, and meaning is kept by references, not by generation. An agent may draft a page from the ontology; the draft is then anchored and checked like any other page.

## Format

- **Anchors.** `<!-- ont: id, id -->` directly above the section it describes. IDs are concepts or checks. A stamp after `@` is a short hash of the definition the section was last reread against; `stamp-docs.mjs` writes it.
- **Doc sets.** The configuration lists them: a name, a directory, and the classes whose concepts the set must explain, either the implemented ones (help for users describes what exists) or all of them (a design guide describes the target).

```json
"docSets": [
  { "name": "help", "dir": "help", "cover": ["action", "view", "rule"], "scope": "implemented" }
],
"references": [
  { "out": "help/terms.md", "title": "Terms", "classes": ["ent", "rule", "action", "view"], "implementedOnly": true }
]
```

- **Reference pages.** `gen-reference.mjs` writes each page under `references`: one section per ontology section, a table of the selected classes, and optionally the IDs, kinds, types and the checks of that section.

## Doc sets are process, help in the product is meaning

Which sets of documentation a team keeps, for whom and where, is process, like test suites: it lives in the configuration, not in the ontology. A different team could document the same product differently, and the ontology would not change.

Help that is part of the product is different. A help screen in the app, or a chat bot's answer to "how does it work", is something a user can open or ask for. Those are concepts of the product, rows in the ontology like any other view or action, and their content is anchored and checked like any page. The test is simple: if a user can open it or ask for it, it is product; if it is a file for the team, it is process.

## Rules

- **Every section that explains a concept has an anchor.** A section without one is not checked.
- **Reread, then stamp.** When the check lists a section as anchored to a changed definition, a person or an agent rereads it, fixes it if needed, and only then runs `stamp-docs.mjs`. Stamping without reading silences the signal.
- **Never edit a generated reference page.** Change the ontology or the catalogue and regenerate.
- **Write in the readers' words.** The page explains; the ontology defines. A page that copies definitions is a reference page written by hand: generate it instead.

## What the check enforces

- Every ID in an anchor exists in the glossary or the check catalogue; a retired ID is reported with its replacement.
- Every concept of a covered class, implemented or all according to the set's scope, is explained by some anchored section of the set.
- Every generated reference page equals what the generator would write now.
- As information: sections whose stamp is older than the current definition.

## What it cannot enforce

- That the section says what the definition says. The stamp says that someone reread it, not that they got it right.
- That a page without anchors is not documentation. Unanchored pages are simply not checked.

## How it fails in practice

- **Anchors on everything.** A section that mentions a concept in passing is not an explanation of it. Anchor what the section is about.
- **Stamping in bulk** after a large change to clear the list. The list is the reading plan; clearing it without reading defeats it.

## In the example

[`example/help/`](../../example/help/README.md): three help pages for members, anchored and stamped, covering every implemented action, view and rule, and a generated terms page with only what the app does today.
