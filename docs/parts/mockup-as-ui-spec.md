# 4. Mockup as UI specification

<!-- ont: ent.mockup-element@54a519, ent.map-row@6bee30, inv.mockup-matches-map@8f55c3 -->
## What it is

A single clickable mockup of the whole product, in plain HTML. It shows the target interface. Every element that means something carries `data-ont="<id>"`. Hovering it shows the glossary definition, because the tooltips are generated from the glossary rather than written in the markup. Next to it lives the **UI-to-ontology map**, a table that says, for each labelled element, what it shows, which concept stands behind it and what it deliberately does not do.

```html
<button class="act" disabled data-ont="action.renew">Renew</button>
<span class="muted" data-ont="inv.no-renew-when-held">2 people are waiting</span>
```

```markdown
| Element  | ID             | What it shows    | What it does not do        |
| -------- | -------------- | ---------------- | -------------------------- |
| "Renew"  | `action.renew` | renews the loan  | stays visible when refused (D-04) |
```

## Why a mockup and not only prose

Interface decisions are where meaning gets lost fastest. A word on a button, a badge, a disabled state: each is a product decision, and each is invisible in a feature list. A labelled mockup makes the interface reviewable concept by concept. An agent implementing a screen can ask "which concepts are on this screen?" and get an exact list. A reviewer can hover anything and see whether the definition matches what the element does.

The "what it does not do" column is the negative specification. Many interface mistakes are things added "helpfully", like an override button, a reorder handle or a fine amount. The column says, on the record, that they are absent on purpose.

<!-- ont: inv.tooltips-generated@b5fdb9, inv.dynamic-ids-declared@544e59 -->
## How it is wired

- One mockup for the whole product, so that navigation and shared elements are designed once, in plain HTML, CSS and a little script that runs from the file system. Earlier versions are kept in history, not as parallel files.
- The generated glossary (`ontology.js`, `window.ONT = {...}`) and a small runtime that fills `title` from it for every `[data-ont]` element without its own title.
- IDs produced by templates in script (`data-ont="derived.${status}"`) are declared in a comment so the check can see them: `/* data-ont dynamic: 'derived.available','derived.overdue' */`.
- The map is grouped by screen. The order of work is: definition row, regenerate the tooltips, map row, `data-ont` in the mockup.

A small browser smoke test can add the runtime side: every labelled element really received a tooltip, and no script errors occurred.

<!-- ont: rule.one-mockup@e0579a, rule.mockup-shows-target@c317ea, rule.mockup-data-fictional@9d8937, inv.label-is-true@23b3e9, rule.map-by-screen@aabc2a -->
## Reference

The rules of the mockup and the map, and the checks that hold them, are in the reference: [Mockup element](../reference.md#mockup-element) and [Map row](../reference.md#map-row). The mockup shows the target, not the code, and may run ahead of it. Data in a shared mockup is fictional; using real data in a private copy is a strong test, because a week of living with the mockup surfaces problems no review does. Whether an element labelled `action.renew` renews anything is a manual check, and so is behavior over time, which a mockup cannot show: see [limitations](../limitations.md#the-mockup-cannot-show-time).

## How it fails in practice

- **Labels on wrappers instead of elements.** The whole card gets `view.member.loans`, and the meaningful parts inside get nothing. Label the smallest element that carries the meaning.
- **The map becomes a copy of the glossary.** Map rows describe the element on this screen, not the concept in general.
- **Mockup and product diverge silently** after the code catches up. When a screen ships, the mockup still shows the target, and the implementation table says what shipped.

## In the example

[`example/mockup/index.html`](../../example/mockup/index.html) and [`example/mockup/ontology-map.md`](../../example/mockup/ontology-map.md): four screens, 22 concepts, two dynamic IDs.
