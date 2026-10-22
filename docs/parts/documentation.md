# 9. Documentation anchored to the ontology

<!-- ont: ent.doc-section@496f3f, ent.reference-page@b1ec8f -->
## What it is

Documentation for people, written by people or agents, with the ontology as its source. It is treated the way the interface and the code are: the explanations are written by hand and anchored to concept IDs, and only what restates the ontology is generated.

| | Written by hand | Anchored to IDs | Generated |
| - | - | - | - |
| Interface | the mockup | `data-ont` on elements, the map | tooltips |
| Code | code and tests | test tags, the implementation table | contracts |
| Documentation | explanations and guides | an anchor on each section | reference pages: terms, fields, checks |

A section names the concepts it explains in an HTML comment that readers do not see:

```markdown
<!-- ont: action.renew@1709a8, rule.renewal@ee5883, field.loan.renewals@040473 -->
## How renewal works

If you need an item longer, renew it from "My loans". Each renewal adds 14 days …
```

## Why

Documentation describes the same product as the ontology, in the words of its readers. Without a link between them it drifts the same way design documents and code drift: a rule changes in the ontology, the help page keeps the old one, and nobody notices. An anchor makes the link explicit without filling the text with IDs.

Generating the prose itself is rejected for the same reason the approach does not generate code: the result is not deterministic, and meaning is kept by references, not by generation. An agent may draft a page from the ontology; the draft is then anchored and checked like any other page.

<!-- ont: ent.doc-set@1bdb9f, inv.anchors-resolve@974479, inv.doc-set-covers@c1b7c5, inv.reference-current@fcb818, inv.doc-set-names-unique@4e4245 -->
## How it is written

- **Anchors.** `<!-- ont: id, id -->` directly above the section it describes. IDs are concepts or checks. A stamp after `@` is a short hash of what the section relied on when it was last reread: the concept's term, type and definition, and the notes of its section that name it. `stamp-docs.mjs` writes it.
- **Doc sets.** The configuration lists them: a name, unique among the sets, a directory, and the classes whose concepts the set must explain, either the implemented ones (help for users describes what exists) or all of them (a design guide describes the target).

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

<!-- ont: rule.anchor-every-section@e93938, rule.reread-then-stamp@3d0dd6, rule.readers-words@3dbebd -->
## Reference

The fields of a doc section, a doc set and a reference page, their rules and checks are in the reference: [Doc section](../reference.md#doc-section), [Doc set](../reference.md#doc-set) and [Reference page](../reference.md#reference-page). Every section that explains a concept carries an anchor; a section without one is not checked. A stamp says that someone reread the section, not that they got it right, so stamping without reading silences the signal. Pages explain in the readers' words; a page that copies definitions is a reference page written by hand, and should be generated instead.

## How it fails in practice

- **Anchors on everything.** A section that mentions a concept in passing is not an explanation of it. Anchor what the section is about.
- **Stamping in bulk** after a large change to clear the list. The list is the reading plan; clearing it without reading defeats it.

## In the example

[`example/help/`](../../example/help/README.md): three help pages for members, anchored and stamped, covering every implemented action, view and rule, and a generated terms page with only what the app does today.
