# 3. Target and reality

<!-- ont: ent.implementation-row@f093f9, ent.divergence@c86a47, rule.divergence-contradicts@792674 -->
## What it is

The ontology describes the **target model**: the product as agreed, not as built. Two sections at the end of the ontology say how far the code has come:

- **Implementation status**, a table from ID to the files that implement it, with a note on what is partial. Concepts built in the same files may share a row. It follows the entity sections of the ontology, one subheading per entity, so the status of a concept is found where its definition is.
- **Known divergences**, a list of places where the code disagrees with the target. Each line names the IDs involved and points at the ticket that closes it, or says that a decision is pending.

```markdown
### Hold

| ID                  | Implemented in    | Note                                                             |
| ------------------- | ----------------- | ---------------------------------------------------------------- |
| `ent.hold`          | `app/library.mjs` | placement only; nothing serves the queue until `hook.hold-ready` |
| `action.place-hold` | `app/cli.mjs`     |                                                                  |

### Known divergences

- **Member.** The code still stores `fineCents` … D-03 replaced fines with `concept.suspension`; the field is not removed.
- **Hold.** Nothing serves the queue: `hook.hold-ready`, `hook.hold-expire` … Ticket: #3 Serve the hold queue: reservation on return and the pickup window.
```

Anything not in the implementation table is target.

## Why keep them apart

A design document that is edited to match the code stops being a design. A design document that ignores the code misleads everyone who reads it as a description of the product. Keeping both, side by side, answers two different questions without mixing them: "what are we building?" and "what do we have?".

It also gives agents a precise instruction. An agent implementing a ticket builds toward the ontology. When it finds the code disagreeing, it does not quietly "fix" the ontology to match. It records a divergence.

<!-- ont: inv.implementation-files-exist@07da6e, inv.implementation-true@182ebf, rule.table-with-code@a2eb21, rule.partial-noted@164c8d, rule.divergence-becomes-work@5253b4, rule.second-vocabulary@82a1d4, inv.divergence-names-concepts@56bf0a -->
## Reference

`ont-check.mjs --gap` reads the table the other way round: every concept not in it is target, and together with untested checks and the known divergences that is the work left. Divergences therefore list only code that contradicts the target; what is simply not built yet comes from the table. For the same reason a note cannot hold work: a concept with a row counts as built, whatever its note says is missing. The note of a partial row names the target concept that adds what is missing, and when no concept covers it, one is added with its check. In the example, the borrow limit is fixed at five until staff can set it, and setting it is a target action with its own check.

The fields of an implementation row and of a divergence, their rules and their checks are in the reference: [Implementation row](../reference.md#implementation-row) and [Divergence](../reference.md#divergence). The tool confirms that the files a row names exist and, through the names in the code, which of them name the concept; that the files realise it, and that the table stays current with the code, are manual checks. It also fails on a divergence that names no concept: `--gap` matches divergences to tickets by their IDs, and a line without them would belong to no slice.

<!-- ont: rule.code-names-concepts@701aa5, inv.code-names-resolve@052349, derived.named-in-code@9f8511 -->
## Code names its concepts

Code that implements a concept names its ID next to it, in a comment:

```js
// ont: rule.renewal, inv.no-renew-when-held
export function renew(state, { item, today }) {
```

The comment has the form of a doc anchor without the HTML around it, so it works in any language: `# ont: …` in Python or Ruby, `-- ont: …` in SQL, `<!-- ont: … -->` in markup. A reader of the code sees which concepts it realises, and an agent that changes a concept finds its code by searching for the ID.

The check reads these names in the files of the implementation table and in the code directories the configuration lists under `code`. It fails on a name the ontology does not define or has retired, and lists, as information, implemented concepts that the files of their row do not name. `--coverage` shows, for each implemented concept, the files that name it. Only `ont:` comments are read, so a property path in code that looks like an ID is not mistaken for one. A name is not an implementation: the table still says where a concept is built, and what the code does is proven by the tests that name its checks.

<!-- ont: action.walk-blind@2e8dcb -->
## Walking the product blind

Code that behaves differently from the ontology where no test looks passes every check. The cheapest way to find it is to use the product as a person would, knowing what it should do and not how it is built. An agent gets the ontology, the catalogue, the map and the run guides, but not the code, and walks the product before a release. A difference is one of three things. Behavior that contradicts the target becomes a known divergence. A case the catalogue does not have becomes a check. What is simply not built yet is already the gap, and adds nothing. In the lending library, a walker reads that renewal is refused while someone waits for the title, places a hold as ben, renews as ana at the desk, and records a divergence if the renewal goes through; finding the hold queue unserved adds nothing, since its concepts are target.

A blind walk is recommended before a release; it is not required, since nothing records that it happened.

## How it fails in practice

- **The table stops being updated** because nothing fails when it is stale in the "not yet listed" direction. Tie the update to the ticket's Done when.
- **Divergences pile up without tickets.** A divergence list that only grows is a second backlog nobody reads. Every line names a ticket or a pending decision.
- **The note column becomes a design discussion.** It records the state of the code. Arguments go to the decision log.

## In the example

[`example/ontology.md`](../../example/ontology.md), sections "Implementation status" and "Known divergences": 25 concepts implemented and two divergences, each with its ticket: the fines a decision abolished but the code still computes, and the hold queue nothing serves yet.
