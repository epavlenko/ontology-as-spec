# Profiles

<!-- ont: ent.profile@d94262, rule.profile-requires-checkable@e0c6e7 -->

## What a profile is

A profile is a recipe for a property of the product that its ontology shows: what to put in the configuration, what that requires, and what is only recommended. It is not a key of the configuration. A project follows it by writing the settings it lists and the checks it asks for. What a profile requires is something the tool checks through the configuration and the catalogue; everything else in it is a recommendation, and a project that skips one breaks no check.

## Model output

For a product in which a model writes values that people read: a summary of a meeting, the claims extracted from an interview, a reply to a member.

Configure a suite that runs the judged checks and names them ([part 6](parts/checks-and-tests.md#checks-a-model-judges)):

```json
{
  "name": "judged",
  "dir": "judged",
  "match": "\\.judged\\.mjs$",
  "cover": [],
  "checks": ["check.member.limit-refusal-explained"]
}
```

Required, and checked by the tool: every judged check of implemented concepts is named by a suite and has a test in it.

Recommended: every value a model writes that people read has a judged check, run on a fixed sample. `JUDGE` names the model the project trusts to judge, and `JUDGE_VERDICTS` a directory outside the repository. The suite is kept apart and run before a release, or when a prompt or a model changes, since each run costs a call to a model.

## Interface

For a product with screens.

Configure an end-to-end suite that covers actions and views ([part 6](parts/checks-and-tests.md#test-suites)):

```json
{
  "name": "end-to-end",
  "dir": "e2e",
  "match": "\\.test\\.mjs$",
  "cover": ["action", "view"]
}
```

Required, and checked by the tool: every implemented action and view has a test in that suite.

Recommended: when the product carries `data-ont` labels, a test that every implemented screen shows the elements its map lists; and a [blind walk](parts/target-and-reality.md#walking-the-product-blind) before a release.

Recommended, so that an agent can check its own work on the screens:

- **A feature map as a doc set.** One section per screen or feature, anchored by its view and action IDs: what it is for, how a user reaches it (the clicks and keys), how to drive it, and the traps where a run gets lost. The tool then lists the implemented views and actions that no section explains, and the sections to reread after a definition changed, so the map cannot go stale unseen ([part 9](parts/documentation.md#how-it-is-written)):

  ```json
  {
    "name": "features",
    "dir": "docs/features",
    "cover": ["view", "action"],
    "scope": "implemented"
  }
  ```

- **A command line that drives the product.** Open a screen, act on it, take a snapshot or a screenshot, read the state, each one command with a clear error and output a program can read. The run guides and the blind walk then name commands to run instead of steps to improvise, and an agent's evidence is the same from one run to the next. The tool does not check it; it is the product's own code.

Both follow Lauren Tan's verification skills, a command line plus a feature map, which let agents check their own changes on a product's screens ([article, 2026-08-31](https://x.com/poteto/status/2094457600259842065); [example](https://github.com/poteto/verification-skill-example)). The difference is where the map comes from: there an agent writes it from the running product, here its sections are anchored to the ontology, so the check also sees a screen of the target that the map does not explain.

## Model and data scenarios

For a product whose results inform people's decisions, such as a business model with prices and conversion rates.

Configure a test that compares the results of the base scenario with a snapshot, as [part 2](parts/decision-log.md#reference) describes for a model's assumptions.

Required, and checked by the tool: the check that holds the snapshot is automatic and has a test.

Recommended: each change of an assumption is a short decision entry about its topic, tentative when an agent chose the values, and no check requires the model to reach its goal.

<!-- ont: rule.value-checked-against-source@52bea9, inv.review-path-checked@53e736, inv.review-paths-known@b3168e -->

## Research

For a product whose result answers questions from collected evidence: a study of a market, a sample of cases, the bases of a set of rules.

The ontology starts from the goal, not from the data. First the decisions the research must serve; then, for each, the evidence it needs, written as a question to the sample; then the fields of a case that answer those questions; then the findings and the recommendations they lead to. A field that serves no evidence and a decision that no evidence serves both show up as gaps.

Every value carries its kind and its sources. A fact comes from a primary document, a claim from what the subject says of itself, an estimate from a third party or from a calculation of your own. A source has a type and the date it was read, and may have the date it was published. A value is never of a higher kind than its source's type allows, and a finding names the cases for it and against it, even when there are none against. In a hypothetical study of how tool libraries charge for membership:

```markdown
| Kind      | ID                       | Term                      | Type              | Definition                                                                       |
| --------- | ------------------------ | ------------------------- | ----------------- | -------------------------------------------------------------------------------- |
| Entity    | `ent.case`               | Case                      |                   | One library of the sample.                                                       |
| Field     | `field.case.fee`         | Membership fee            | number optional   | The yearly fee in euros.                                                         |
| Relation  | `edge.case.sources`      | Sources                   | refs `ent.source` | Where each value of the case comes from.                                         |
| Rule      | `rule.kind-from-source`  | Kind from source          |                   | A primary source gives a fact, a self-report a claim, anything else an estimate. |
| Invariant | `inv.no-unsourced-value` | No value without a source |                   | Every filled field of a case has a kind and at least one source.                 |
```

```json
{ "fee": { "value": 25, "kind": "fact", "sources": ["fees-page-2026"] } }
```

Configure the directory of the cases under `reviewPaths`, with the concept of their sources, and give that concept a manual check of values against their source:

```json
"reviewPaths": [{ "dir": "cases", "concepts": ["edge.case.sources"] }]
```

```markdown
| `check.case.value-matches-source` | `edge.case.sources` | a case value that a change adds or alters | the reviewer opens its source | the source says what the value says, at the kind the value claims | manual |
```

Required, and checked by the tool: the rules of kind and source are rules and invariants of the project's ontology, so `checks.require` asks for their checks and the automatic ones have tests; every concept under `reviewPaths` is defined and has a manual check. A change to a case then hands that check to the reviewer of the change, who opens the source of each value the change adds or alters and records a verdict ([part 7](parts/agent-rules.md#an-independent-critic)); a source it cannot open is `not-run`, with the reason.

Recommended: values kept as `{ value, kind, sources }`, so that a contract generated from the types checks the value and a test checks its kind and sources. Whether and how often the sources are read again, since pages of prices and texts of laws change, is the project's choice.
