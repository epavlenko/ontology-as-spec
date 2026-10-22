# Comparison

How the approach relates to spec-driven development (SDD) tools of 2025–2026 and to older practices it borrows from. Every characterization below links to a primary source; quotes are verbatim. Sources were read on 2026-10-17.

## The three levels

Birgitta Böckeler, [Understanding Spec-Driven-Development: Kiro, spec-kit, and Tessl](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) (martinfowler.com, 15 October 2025), distinguishes three levels of commitment to a specification:

- **Spec-first.** "A well thought-out spec is written first", then used for the task at hand.
- **Spec-anchored.** "The spec is kept even after the task is complete", and is used to evolve the feature.
- **Spec-as-source.** The spec is the main source file over time, and "the human never touches the code."

She also separates specs from a "memory bank" of always-loaded context: Kiro's steering files and Spec Kit's constitution.

**Where this approach sits.** It is spec-anchored, with a different unit. The tools she reviews anchor a spec to a feature or a change. This approach anchors meaning to a **concept**: one ID, one definition, referenced by every artifact for the life of the product. The ontology is neither a feature spec nor a memory bank. It is closer to a shared domain model that both the specs and the memory bank would point at. It is not spec-as-source; see [why not](why-not-spec-as-source.md).

## Tools

### GitHub Spec Kit

[spec-driven.md](https://github.com/github/spec-kit/blob/main/spec-driven.md) describes a workflow of `/speckit.specify`, `/speckit.plan` and `/speckit.tasks` under a project **constitution** of articles such as Library-First and Test-First ("This is NON-NEGOTIABLE: All implementation MUST follow strict Test-Driven Development"). Its own rhetoric is spec-as-source: "Specifications don't serve code—code serves specifications." The repository also has [clarify](https://github.com/github/spec-kit/blob/main/templates/commands/clarify.md) and [analyze](https://github.com/github/spec-kit/blob/main/templates/commands/analyze.md) commands. Analyze is a "non-destructive cross-artifact consistency and quality analysis across spec.md, plan.md, and tasks.md". Böckeler observes that in practice Spec Kit creates a branch per spec and is "still what I would call spec-first only".

*Compared with this approach.* Spec Kit's unit is the feature, and its consistency analysis runs within one feature's artifacts. It has no product-wide vocabulary with stable IDs and no binding of interface elements to concepts. It is stronger at the per-feature process: clarifying questions, explicit planning, test-first as a rule.

### Kiro

[Kiro specs](https://kiro.dev/docs/specs/) are three files per feature or bugfix: `requirements.md`, `design.md`, `tasks.md`. [Feature specs](https://kiro.dev/docs/specs/feature-specs/) write requirements in EARS notation ("WHEN [condition/event] THE SYSTEM SHALL [expected behavior]"). [Steering](https://kiro.dev/docs/steering/) "gives Kiro persistent knowledge about your project through markdown files" (`product.md`, `tech.md`, `structure.md`), with inclusion modes and support for `AGENTS.md`. The specs page describes an Analyze Requirements step to "catch inconsistencies, ambiguities, and gaps". It says nothing about keeping specs in step with code after implementation. Böckeler: "It seems to be mostly spec-first".

*Compared with this approach.* Steering is the nearest equivalent of the agent rules ([part 7](parts/agent-rules.md)) and of the ontology's role as standing context, but steering files are free prose without IDs or checks. EARS requirements are more precise than this approach's prose about behavior; this approach puts behavior into a [check catalogue](parts/checks-and-tests.md) of GIVEN/WHEN/THEN cases with data instead, which tests implement.

### OpenSpec

[OpenSpec](https://github.com/Fission-AI/OpenSpec) keeps `openspec/specs/` as the source of truth for current behavior and puts each change in `openspec/changes/<name>/` with a proposal, design, tasks and **delta specs** under `## ADDED`, `## MODIFIED` and `## REMOVED Requirements`. Requirements use RFC 2119 keywords and are illustrated by scenarios in WHEN/THEN or GIVEN/WHEN/THEN form. Archiving a change merges its deltas into the specs: "Specs grow organically as changes are archived." It positions itself as brownfield-first.

*Compared with this approach.* OpenSpec is the closest of the tools in spirit, because its specs persist and describe the whole system. Its unit is the requirement, grouped by capability, and its deltas make change review precise, which this approach lacks. It has no concept IDs shared with the interface, and its specs describe current behavior rather than a target kept apart from reality.

### Tessl

Described in Böckeler's article as the one tool that "explicitly aspires to a spec-anchored approach, and is even exploring the spec-as-source level", with a one-to-one mapping between spec and code file and generated code marked `// GENERATED FROM SPEC - DO NOT EDIT`. On regenerating from the same spec: "I have seen the non-determinism in action".

*Compared with this approach.* Tessl tries to make the spec the source of the code. This approach does not, and treats non-deterministic regeneration as one reason not to.

### The Spec Growth Engine

Hartwig Grabowski, [The Spec Growth Engine: Spec-Anchored, Code-Coupled, Drift-Enforced Architecture for AI-Assisted Software Development](https://arxiv.org/abs/2606.27045) (arXiv, v1 June 2026, v2 October 2026). It names two failure modes, "context explosion" and "silent spec-code drift", and proposes a machine-readable spec graph (one `SPEC.md` per node, separating contract from design), a context assembler that scopes the agent to an ownership path, vertical slices ordered hardest-first, and "a drift gate that makes spec-code divergence a blocking merge condition". The gate compares an intent graph built from the specs with an evidence graph from static analysis of the code: orphan code without a spec owner, undeclared dependencies and bypassed contracts block the merge. It keeps "code as primary and treat[s] the spec as a verified contract – never as the generative source." It is a design paper with an illustrative example and no empirical evaluation.

*Compared with this approach.* This is the nearest relative. Both are spec-anchored, both make drift a blocking check, both slice delivery. The differences are complementary. The Spec Growth Engine anchors to **code structure**: its drift gate reads the code and therefore catches what this approach cannot, namely code that has no owner in the spec. This approach anchors to **product meaning**: its check reads the interface, the decision log and the verification map, which the Spec Growth Engine does not cover, and it has a glossary of concepts, which the paper does not.

## Older practices

| Practice | Source | What this approach takes | What it adds |
| -------- | ------ | ------------------------ | ------------ |
| Ubiquitous language (Domain-Driven Design) | [Martin Fowler, UbiquitousLanguage](https://martinfowler.com/bliki/UbiquitousLanguage.html), after Eric Evans | one rigorous shared vocabulary for developers and users | stable IDs for the terms, and a check that the vocabulary is actually used everywhere |
| Architecture Decision Records | [Michael Nygard, Documenting Architecture Decisions](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions) (2011) | short records in the repository; superseded records kept, not edited | product decisions instead of architecture; every entry names its concepts by ID; references checked |
| Living Documentation | Cyrille Martraire, [Living Documentation](https://www.informit.com/store/living-documentation-continuous-knowledge-sharing-by-9780134689326) (Addison-Wesley, 2019) | documentation that changes with the design, with a reconciliation mechanism that checks it | the reconciliation spans the interface mockup and the verification map, not only code and docs |
| Requirements traceability | [Sphinx-Needs](https://sphinx-needs.readthedocs.io/en/latest/), used for safety-critical work such as ISO 26262 | requirements, specifications and tests as linked objects with IDs | lightweight: Markdown tables and one script instead of a requirements toolchain; links from interface elements |
| Fitness functions | [Thoughtworks Technology Radar](https://www.thoughtworks.com/radar/techniques/architectural-fitness-function), after Ford, Parsons and Kua, *Building Evolutionary Architectures* | an automated, objective check of a property the team cares about, run continuously | the property is consistency of meaning across artifacts rather than an architectural characteristic |

## Summary

| | Unit of spec | Persists after the change | Shared IDs | Interface bound to spec | Target kept apart from reality | Drift check |
| - | - | - | - | - | - | - |
| Spec Kit | feature | per feature branch | no | no | no | within one feature (analyze) |
| Kiro | feature or bugfix | not addressed | no | no | no | requirements analysis |
| OpenSpec | requirement by capability | yes, deltas merged | no | no | no (describes current behavior) | not examined here |
| Tessl | code file | yes | no | no | no | regeneration |
| Spec Growth Engine | spec graph node | yes | spec nodes, no glossary | no | no: divergence blocks the merge | spec ↔ code structure, blocking |
| **This approach** | concept | yes | yes, permanent | yes, both directions | yes, explicitly | concepts ↔ interface, map, decisions, implementation table, checks, test tags, tickets, contracts |

## Böckeler's criticisms, applied here

- **Problem size.** In her test, Kiro turned a small bug into 4 "user stories" with "a total of 16 acceptance criteria". This approach does not produce documents per change. A small change touches the glossary only if it changes meaning. A bug fix often touches nothing but code and the implementation note.
- **Verbosity and review burden.** "I'd rather review code than all these markdown files." Partly applies. The ontology is long. But it is reviewed once per concept, not once per feature, and the glossary keeps the per-concept unit to one line. Reviewing a change to meaning means reading a few rows and a decision entry.
- **False sense of control.** She asks whether agents follow the spec, and saw them ignore and over-apply instructions. This applies fully. The check guarantees that the artifacts agree with each other. It does not guarantee that code agrees with them. See [limitations](limitations.md#code-does-not-refer-to-ids).
- **The model-driven development parallel.** She warns that spec-as-source may combine "the downsides of both MDD and LLMs: Inflexibility and non-determinism." This approach avoids the parallel by not generating code from the ontology. It generates one thing, a JSON Schema for stored fields, which is deterministic and leaves the code to the project.

## The objection from learning

Kent Beck, quoted by Martin Fowler in [Fragments: January 8](https://martinfowler.com/fragments/2026-01-08.html) (2026): descriptions of SDD "emphasize writing the whole specification before implementation", which "encodes the (to me bizarre) assumption that you aren't going to learn anything during implementation that would change the specification." Fowler adds that "the learning loop of experimentation is essential to the model building".

The objection is right about specifications that are frozen. This approach answers it in three ways. First, the ontology is never frozen. It changes through the decision log whenever implementation or users teach something, and the log keeps the reason. Second, implementation is sliced, and each slice ends with a control test, so learning arrives early and in small pieces. Third, the up-front description is there to buy autonomy, not to be correct. A precise target lets an agent work longer without a human. What it learns comes back as decisions.

## Where this approach is stronger

- One concept is referenced by the glossary, the interface, the decisions, the implementation table, the check catalogue, the tickets and the tests, and a check keeps those references whole in both directions.
- The boundary between target, implemented and divergent is explicit and maintained.
- Interface elements are bound to concepts, and the map records what each element deliberately does not do. No tool reviewed here does either.

## Where it is weaker

- Product code does not refer to IDs; test titles and the generated contracts do. Code that contradicts the ontology where no test looks passes the check. The Spec Growth Engine's drift gate, which reads code, does better here.
- The check catalogue keeps acceptance cases after the change, as OpenSpec's scenarios do, and tests carry their IDs. But the check cannot tell whether a test does what its check says, and Kiro's EARS requirements are more precise as statements.
- The tooling is small and generic only in its first version. The tools above are products.
- There is no formal per-change process comparable to Spec Kit's clarify and analyze, or OpenSpec's deltas.

[Limitations](limitations.md) lists these with proposed remedies.
