# 4. Mockup as UI specification

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

## Format

- One mockup for the whole product, so that navigation and shared elements are designed once. Earlier versions are kept in history, not as parallel files.
- Plain HTML, CSS and a little script, runnable from the file system. No build step.
- The generated glossary (`ontology.js`, `window.ONT = {...}`) and a small runtime that fills `title` from it for every `[data-ont]` element without its own title.
- IDs produced by templates in script (`data-ont="derived.${status}"`) are declared in a comment so the check can see them: `/* data-ont dynamic: 'derived.available','derived.overdue' */`.
- The map is grouped by screen. One row per element. Several elements may share an ID.

## Rules

- **Order of work:** glossary row, then regenerate the tooltips, then the map row, then `data-ont` in the mockup.
- **The mockup may not show a concept that has no glossary row.**
- **Never hand-edit the generated glossary.**
- **The mockup shows the target, not the code.** It can and should be ahead of the implementation.
- **Data in the mockup is fictional** unless the mockup is served privately. Using real data in a private copy is a strong test: a week of living with the mockup surfaces problems that no review does.

## What the check enforces

- Every `data-ont` (and every quoted ID in the mockup's script) exists in the glossary.
- The map and the mockup contain exactly the same set of IDs, in both directions.
- Every class declared dynamic has a live `data-ont="<class>.${` template in the markup. The comment alone proves nothing.
- Informational: glossary concepts of interface-facing classes that no mockup element shows yet. This is the mockup's backlog.

A small browser smoke test can add the runtime side: every labelled element really received a tooltip from the glossary, and no script errors occurred.

## What it cannot enforce

- That an element labelled `action.renew` actually behaves like renewal. The label is a claim.
- Behavior over time. A mockup can show "overdue" but cannot show a loan becoming overdue, a reminder arriving, or a reservation expiring after three days. Those concepts need tests against code, or a person living with the mockup for long enough. See [limitations](../limitations.md#the-mockup-cannot-show-time).
- That an important element was labelled at all. An unlabelled element is invisible to the check.

## How it fails in practice

- **Labels on wrappers instead of elements.** The whole card gets `view.member.loans`, and the meaningful parts inside get nothing. Label the smallest element that carries the meaning.
- **The map becomes a copy of the glossary.** Map rows describe the element on this screen, not the concept in general.
- **Mockup and product diverge silently** after the code catches up. When a screen ships, the mockup still shows the target, and the implementation table says what shipped.

## In the example

[`example/mockup/index.html`](../../example/mockup/index.html) and [`example/mockup/ontology-map.md`](../../example/mockup/ontology-map.md): four screens, 22 concepts, two dynamic IDs.
