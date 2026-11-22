# #11 The texts name the action on stagnation only through the NEXT line

A finding of round 5 of the review of the result of task triage-rules, filed as `later` under the owner's answer "1032 a" of 2026-11-22: four texts restate the action on stagnation without the open gate.

## Slice

IDs: `rule.rounds-converge`, `derived.next-round`.

Checks: `check.review-round.branch-order-documented`.

Why now: ontology.md (`rule.rounds-converge`), docs/parts/agent-rules.md, skills/change-review/SKILL.md and docs/limitations.md each say that on stagnation the executor changes the design of the solution, but not that an open gate over the task comes first and the owner is asked before any redesign. The tool's `NEXT <task>:` line is right, and an executor who follows it is never misled, so the case is rare; a reader of the prose alone could redesign before the owner answers.

## Out of scope

- Any change of `derived.next-round` or of the tool's behaviour.
- Other restatements of the branches beyond the action on stagnation.

## Depends on

Nothing open.

## Done when

```bash
npm run gap -- issues/0011-stagnation-action-only-in-next.md   # SLICE_DONE
npm test
```

Its check already passes today, so `SLICE_DONE` proves nothing on its own; the slice is done only when the four texts no longer restate the action on stagnation and point to the `NEXT <task>:` line and the branches of `derived.next-round` instead, and a test holds that none of them names the action without that pointer.

## Pre-authorized

- commit: allowed on the task branch
- PR: not yet
- browser verification: not needed
