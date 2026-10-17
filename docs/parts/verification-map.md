# 6. Verification map

## What it is

A directory of scenario files, one per user-visible feature, each saying how to prove the feature works the way a user sees it. Every file starts with an `IDs:` line listing the concepts it proves:

```markdown
# Renewal

IDs: `action.renew`, `rule.renewal`, `inv.no-renew-when-held`, `field.renewals`

A member renews a loan to keep the item longer. …

## Scenarios

- **Refused while held.** … `renew dune-2` prints `refused: 1 member(s) waiting for this title`.
```

The check requires that every implemented concept of a verifiable class (by default `view`, `action`, `hook`) appears on some `IDs:` line. Implementing such a concept therefore means writing down, in the same change, how to prove it.

## Why

The implementation table says "this exists". The scenario says "and this is how you would know it works". Without the second, an implemented concept is a claim. With it, any agent can verify a feature without a setup conversation, and a reviewer can ask for the evidence of a specific concept.

Scenarios here are recipes, not test code. They can be driven by a person, by an agent with a browser, or turned into automated end-to-end tests. Each scenario pairs an action with an observable result. Where an automated test already covers a step, the scenario cites it.

## Format

- H1 title, the `IDs:` line, one paragraph on the user-visible behavior.
- Preconditions: the state to start from.
- Scenarios: labelled bullets, each an action and the exact observable result.
- Gotchas: traps that can waste or invalidate a run.
- An index file listing the features with one line each.

Keep implementation details out: user paths, stable handles, required state, observable proof.

## Rules

- **A row added to the implementation table for a verifiable class comes with a scenario** in the same change.
- **Report an unreachable path as unreachable.** A scenario that could not be run is not verified through a different path.
- **Evidence outside the repository.** Screenshots and logs from a run go to an ignored directory, named by feature and date.

## What the check enforces

- Every scenario file has an `IDs:` line.
- Every ID on those lines exists in the glossary.
- Every implemented `view`, `action` or `hook` (configurable) is covered.

## What it cannot enforce

- That the scenario passes. The check confirms the recipe exists, not that anyone ran it.
- That the scenario actually exercises the concept it lists.
- Coverage of fields, entities and invariants. They are usually proven through views and actions, and requiring a scenario per field would produce noise. A project that wants it adds the classes to the configuration.

## How it fails in practice

- **Scenarios rot when the interface changes**, because nothing runs them. The cheapest remedy is to cite an automated test for each step where one exists. The fuller remedy is the proposal to [link tests to IDs](../limitations.md#proposed-strengthening).
- **One giant scenario file lists every ID** to satisfy the check. Split by feature; one file per thing a user would name.

## In the example

[`example/features/`](../../example/features/README.md): three scenario files covering the five implemented views and actions, run against the command line front end.
