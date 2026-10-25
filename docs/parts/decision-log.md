# 2. Decision log

<!-- ont: ent.decision@4607b2, rule.one-choice@c773d8, inv.superseded-whole@768dfb -->
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

The guard cannot see a commit made with `--no-verify`, which then fails in CI, or a rewritten history, which removes the commit it compares with. Before the first commit there is nothing to compare with: the guard prints `GUARD_OFF` and says that accepted entries are not protected yet, rather than failing on every run. Once there are commits, it also lists accepted entries that the commit does not have yet: they are protected only after they are committed, so a finished task ends with a commit where the repository lets agents commit ([part 7](agent-rules.md#reference)), and the guard runs in the project's test command, where this list is seen.

<!-- ont: inv.decision-has-reason@03ecfb, inv.rejected-recorded@b6fb01, rule.cite-decisions@b77959, rule.product-decisions-only@4f3292, inv.supersession-named@bc24b3, inv.meaning-change-decided@641c3e, inv.decision-numbers-unique@ba43af, inv.decision-references-resolve@abba7d, inv.supersedes-older@e84800, rule.number-by-role@367261, rule.unconfirmed-tentative@f4a9a4 -->
## Reference

A log has four sections: Accepted, Tentative, Open questions and History. History lists only what the entries do not show: when the log was created, when a tentative entry was accepted. A new entry needs no line there, since it carries its date and `--decisions` lists every entry. The fields of an entry, the rules a log follows and the checks that hold them are in the reference: [Decision](../reference.md#decision).

Two of those rules carry the log's purpose. An entry always says why, so that the next reader knows whether there was a deeper reason. It lists the rejected alternatives, because they are what stops an agent from proposing the same alternative again. Both are manual checks: the tool sees that an entry exists, not that its reason is a reason.

One entry answers one question, and the parts of one answer stay together: what was chosen, how it works, its direct consequences. A later entry may add to an earlier one without changing anything in it, and both stay in force. If it contradicts any part, it supersedes the earlier entry whole: it names it on a line of its own, `- Supersedes: D-05`, and restates what still holds, because "supersedes the … part of D-nn" leaves every later reader to work out what of D-nn still applies. The check confirms that every entry named there exists and is older, and `ont-check.mjs --decisions` lists every entry as in force, tentative or superseded by what, and which later entries name it, so that a reader of an old entry finds what came after it in any language. The tool also lists, as information, entries replaced only in part in prose ("supersedes the … part of", "no longer applies") until some entry supersedes them whole. Whether an entry answers one question or two, and whether a later entry adds or contradicts, is a reviewer's call.

An entry the owner has not explicitly approved is tentative. That includes a value an agent picked when it was asked to tune something: the agent chose, the owner did not. The owner accepts the entry by changing its status, and History records when. Whether a changed number is an entry depends on the role the number plays. The value of a product rule, such as a loan period of 21 days, sits in the rule's definition, and changing it is a decision. Settings tuned to meet a requirement, such as a cache sized so that a page opens within two seconds, need no entry: the requirement is the decision, and its check holds it. The assumptions of a model whose results inform people, such as the prices and conversion rates of a business model, are its base scenario, which the people who use the model agree on; each change of them is a short entry about one topic, tentative when an agent chose the values. Data that people edit in the product stays out of the log. Keep a value with a reason of its own, such as a price set by a market corridor, in a short entry of its own, so that changing it later supersedes that entry and not a long one about the structure of the offer.

## How it fails in practice

- **Decisions recorded as outcomes without the fight.** "We use suspension" without "fines kept people away" is useless the day someone proposes fines again.
- **The log becomes a changelog.** Not every edit is a decision. A decision is a choice between alternatives that someone could reasonably make differently.
- **Superseded entries silently edited to match the new state.** That destroys the one thing the log is for.
- **Numbers inside a long entry.** An entry that fixes the structure of an offer and lists every price and rate has to be superseded whole whenever one of them is tuned, and until then it quotes numbers that no longer hold. Give each topic of values a short entry of its own, and let a check hold what they produce.

## In the example

[`example/decisions.md`](../../example/decisions.md): five accepted decisions, one tentative, one open question.
