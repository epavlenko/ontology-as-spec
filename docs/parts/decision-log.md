# 2. Decision log

<!-- ont: ent.decision@4607b2, rule.one-choice@886b23, inv.superseded-whole@e39f3c -->
## What it is

A dated, append-only list of product decisions. Each entry records the decision, the reason, the rejected alternatives and the concepts it touches, by ID. It is the ontology's memory: the ontology says what the product is, and the log says why.

```markdown
### D-03 · No money fines; an overdue loan suspends borrowing

- Date: 2026-10-17 · Status: accepted
- Decision: there are no fines. A member with an overdue loan is suspended …
- Why: fines kept members with a late book away from the library altogether …
- Rejected: fines with a cap (still keeps people away); a suspension for a fixed number of days after return (punishes the return itself).
- Concepts: `concept.suspension`, `derived.overdue`, `inv.suspended-cannot-borrow`.
```

It descends from [Architecture Decision Records](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions) (Michael Nygard, 2011). Two things differ. It records product decisions rather than architecture, and every entry names the concepts it touches by ID, so the log can be read from a concept ("why is renewal refused here?") as well as in date order.

<!-- ont: inv.accepted-never-edited@a7c76a, action.supersede-decision@0d21ae -->
## The guard

A second script, `tools/ont-check/guard-decisions.mjs`, enforces the never-edit rule. It takes every entry that was accepted in an earlier commit and fails if its text changed or the entry disappeared. New entries, tentative entries, open questions and history may change freely. It runs in the pre-commit hook against `HEAD` and in CI against the base of the push or pull request:

```text
$ node tools/ont-check/guard-decisions.mjs --config example/ont.config.json --staged
ERROR · decisions.md: accepted entries edited since HEAD (1):
  D-01, first change: - Why: members like one number. Per-title periods made the desk explain the rule on every
decisions.md: 5 accepted entries in HEAD
Write a new entry that supersedes the old one instead of editing it.
DRIFT: 1
```

The guard cannot see a commit made with `--no-verify`, which then fails in CI, or a rewritten history, which removes the commit it compares with.

<!-- ont: inv.decision-has-reason@03ecfb, inv.rejected-recorded@b6fb01, rule.cite-decisions@b77959, rule.product-decisions-only@4f3292, inv.supersession-named@c45c0b, inv.meaning-change-decided@641c3e, inv.decision-numbers-unique@ba43af, inv.decision-references-resolve@abba7d -->
## Reference

A log has four sections: Accepted, Tentative, Open questions and History. The fields of an entry, the rules a log follows and the checks that hold them are in the reference: [Decision](../reference.md#decision).

Two of those rules carry the log's purpose. An entry always says why, so that the next reader knows whether there was a deeper reason. It lists the rejected alternatives, because they are what stops an agent from proposing the same alternative again. Both are manual checks: the tool sees that an entry exists, not that its reason is a reason.

One entry records one choice. The test: if someone could one day want to replace half of it, it is two entries. An entry is then superseded whole, because "supersedes the … part of D-nn" leaves every later reader to work out what of D-nn still applies. The tool lists such partial supersessions as information; it cannot judge whether a new entry bundles two choices.

## How it fails in practice

- **Decisions recorded as outcomes without the fight.** "We use suspension" without "fines kept people away" is useless the day someone proposes fines again.
- **The log becomes a changelog.** Not every edit is a decision. A decision is a choice between alternatives that someone could reasonably make differently.
- **Superseded entries silently edited to match the new state.** That destroys the one thing the log is for.

## In the example

[`example/decisions.md`](../../example/decisions.md): five accepted decisions, one tentative, one open question.
