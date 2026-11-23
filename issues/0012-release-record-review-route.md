# #12 A changed record of a product release does not reach its check in --review

A finding of round 4 of the review of the statement of task enforcement-review-run, class "release record does not trigger its run", filed as `later`: it was there before that change, and it belongs to the publication gate, task enforcement-config-release of the goal enforcement.

## Slice

IDs: `derived.review-checks`, `rule.intact-is-not-run`.

Checks: `check.product-release.verified-by-reviewer`.

Why now: `--review` maps changed files to the sections of the approach's catalogue, and no route leads from a changed record of a product release to the section Product release (tools/ont-check/review.mjs, the table of sections). A project that adds a release record and asks `--review` what needs verification is not given the check that the release was verified, so the verdict on it is never asked for before merge.

## Out of scope

- The publication gate itself, which is the rest of task enforcement-config-release.

## Depends on

Task enforcement-review-run (the check becomes a run).
