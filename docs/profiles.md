# Profiles

<!-- ont: ent.profile@d94262, rule.profile-requires-checkable@e0c6e7 -->
## What a profile is

A profile is a recipe for a property of the product that its ontology shows: what to put in the configuration, what that requires, and what is only recommended. It is not a key of the configuration. A project follows it by writing the settings it lists and the checks it asks for. What a profile requires is something the tool checks through the configuration and the catalogue; everything else in it is a recommendation, and a project that skips one breaks no check.

## Model output

For a product in which a model writes values that people read: a summary of a meeting, the claims extracted from an interview, a reply to a member.

Configure a suite that runs the judged checks and names them ([part 6](parts/checks-and-tests.md#checks-a-model-judges)):

```json
{ "name": "judged", "dir": "judged", "match": "\\.judged\\.mjs$", "cover": [], "checks": ["check.member.limit-refusal-explained"] }
```

Required, and checked by the tool: every judged check of implemented concepts is named by a suite and has a test in it.

Recommended: every value a model writes that people read has a judged check, run on a fixed sample. `JUDGE` names the model the project trusts to judge, and `JUDGE_VERDICTS` a directory outside the repository. The suite is kept apart and run before a release, or when a prompt or a model changes, since each run costs a call to a model.

## Interface

For a product with screens.

Configure an end-to-end suite that covers actions and views ([part 6](parts/checks-and-tests.md#test-suites)):

```json
{ "name": "end-to-end", "dir": "e2e", "match": "\\.test\\.mjs$", "cover": ["action", "view"] }
```

Required, and checked by the tool: every implemented action and view has a test in that suite.

Recommended: when the product carries `data-ont` labels, a test that every implemented screen shows the elements its map lists; and a [blind walk](parts/target-and-reality.md#walking-the-product-blind) before a release.

## Model and data scenarios

For a product whose results inform people's decisions, such as a business model with prices and conversion rates.

Configure a test that compares the results of the base scenario with a snapshot, as [part 2](parts/decision-log.md#reference) describes for a model's assumptions.

Required, and checked by the tool: the check that holds the snapshot is automatic and has a test.

Recommended: each change of an assumption is a short decision entry about its topic, tentative when an agent chose the values, and no check requires the model to reach its goal.
