# Run guide of the approach

How to carry out the approach's checks of run (`run` in [checks.md](../checks.md)): the checks an agent carries out on the working product, in the mockup or blind, rather than reading the change. What must hold is in the catalogue; each section here says only where to start, the steps and what shows after each, what to keep as evidence and where a run gets lost (D-156). `--review` lists a check of run with the path and anchor of its section here, and, in a project, a link to this page at the commit its copy of the tool came from (D-165).

The reviewer of a change gives each check of run it lists a verdict in its table, as for a check of review: it carries the check out by its section, or has it carried out, or gives `not-run` with the reason. A failed check holds the merge, but in the range of fixes after the narrow round that follows a confirmed condition, where a fail of the one issue of verdicts fixed with a test does not (`rule.fixes-held-by-tests`); a `not-run` with its reason does not on its own. The evidence is kept outside the repository, named by the check and the date (`rule.manual-evidence-kept`), and the record of the verdict names who carried the check out on its `Performer:` line (D-165).

Some cases need someone who has not seen something: the product, or the code. The reviewer has seen both, so for those cases the section gives a step of a fresh reader: the reviewer gives a fresh reader, a model without context, only what the case lets it see, takes its result, and gives the verdict on that result (`rule.guide-runs-check`).

<!-- ont: check.mockup-element.label-is-true@9b1d03 -->
## An element does what its label says

Start in the project's mockup, the file `mockup` of its configuration, opened from the file system in a browser, and the project's ontology map.

1. Take the elements the change touches that are labelled with an action: the rows of the map it changed, or the elements whose `data-ont` it changed, that name an action. An element mapped to a view, a field or a derived value has no action to compare with and is not this check's; when the change touches no element labelled with an action, the verdict is `not-applicable`.
2. For each, read the action's definition row in the ontology.
3. Use the element in the mockup as a user would: click it, fill what it asks for. What shows is what the mockup does.
4. Compare what it did with the definition. A difference is a fail, named with the element, the action and what each says.

Keep, named by the check's ID and the date: for each element, what was clicked and what showed after it, a screenshot where the mockup can take one.

Traps:

- A tooltip is generated from the definition, so it always agrees with it; the check is about what the element does, not what its tooltip says.
- An element the mockup deliberately leaves without behavior says so in the ontology (`rule.limits-in-ontology`); it is not a fail.

<!-- ont: check.mockup-element.one-plain-mockup@72fbcf -->
## One mockup that runs without a build

Start from a fresh clone of the project, with no packages installed.

1. List the mockup files of the configuration. There is one mockup for the product: one entry page, which may link others of the same mockup.
2. Open the entry page from the file system, `file://`, in a browser, without a server and without running a build or an install. It shows its screens; the browser's console shows no error of a missing file.
3. Compare its screens with the ontology: they show the target, including what is agreed and not built yet, not only what the code does today.

Keep, named by the check's ID and the date: the list of files, the console's output, and a screenshot of the entry page.

Traps:

- A browser that blocks local scripts may show an empty page; try another browser before calling it a fail, and say which one was used.
- A second mockup of one screen, kept as an older version, is a second mockup.

<!-- ont: check.doc-section.guide-runs-check@200c7d -->
## A section of a run guide lets a fresh reader run its check

Start with the sections of run guides the change adds or changes, the doc sets of the configuration that list `checks: ["run"]`.

1. For each section, read the check it names in the catalogue. The section names it and does not restate its GIVEN, WHEN and THEN.
2. **Fresh reader.** Give a fresh reader, a model without context, the section and access to the working product, and nothing else: not the code, not the catalogue, not the change. Ask it to follow the section and report what it did and what showed after each step.
3. Read its report against the check's THEN. When it reached the state the check describes, the section runs its check. When it got lost, the place it got lost is a fail of the section, named with the step.

Keep, named by the check's ID and the date: what the fresh reader was given, its report, and the verdict with the step where it got lost, if it did.

Traps:

- The reviewer following the section itself proves nothing: it has seen the product and fills the gaps without noticing.
- A fresh reader that is given the catalogue too reads the THEN and aims at it; give it the section alone.

<!-- ont: check.check.blind-derivation@a508cc -->
## Deriving a case blind

Start with cases the catalogue does not hold, with the owner's answer kept outside the catalogue, such as judged checks in a file outside the repository. `blindPrompt` of `tools/ont-check/judge.mjs` builds what the fresh reader gets.

1. **Fresh reader.** Give a fresh reader, a model without context, the project's ontology, its catalogue, and the case's GIVEN and WHEN, and nothing else: not the code, not the owner's answer. Ask it what should happen, in the product's terms.
2. Compare its answer with the owner's, with `judge` of `judge.mjs` or by reading both. A match means the case follows from what is written.
3. A mismatch is a fail of the catalogue: it adds a check, or, when the owner does not know the answer either, an open question.

Keep, named by the check's ID and the date: the cases, the fresh reader's answers and the comparison.

Traps:

- The reviewer cannot derive blind itself: it has seen the code and the change.
- A case the catalogue already holds proves nothing; take cases it does not.

<!-- ont: check.product-release.verified-by-reviewer@4b716f -->
## A release verified before it is trusted

Start in the project's repository, with the release's version and the tool the release names.

1. Run `node <tool>/release.mjs --verify <version> --config <the project's configuration>`. It checks the integrity of the version and its records, then runs the checks of the release again on its commit and compares them with its record.
2. It prints `VERIFIED <version>` with each command of the release and its result on the release's commit, or names what differs and exits with a code that is not 0.

Keep, named by the check's ID and the date: the command and its whole output.

Traps:

- A release that is intact is not a release that ran: integrity alone does not show that its checks pass on its commit (`rule.intact-is-not-run`); only `--verify` runs them.
- `--verify` runs the tool of the release's commit, not the copy of today; a commit without its tool cannot be verified, and the output says so: report it as `not-run` with that reason.

Probe line, not to be merged.
