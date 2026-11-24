# #18 The branch of stagnation names a change of design before the analysis of its cause

Finding of round 6 of the review of the result of task enforcement-tool-records, there before that task: class "Stagnation instructions require redesign before checking the cause". When the rounds stagnate, `NEXT` and the texts say to change the design of the solution, even where an analysis of the cause finds isolated errors of implementation (`checks.md` around 223, `docs/parts/agent-rules.md` around 109). The owner's answer to question 1074 asks for an analysis of the cause first, and a change of design only where the cause is in the design; the separate task stagnation-cause carries it out.

## Later, from the review of the statement of task stagnation-cause

- class "Count-only remedy exceeds the quoted decision" (rounds 3 and 4): the statement applies the choice of the owner's answer to question 1074 (a change of design only where the analysis puts the cause, otherwise the error fixed) also to stagnation by a count with no repeated class, on his words of 2026-11-23 on changing the design without an analysis of the problem; the reviewer reads the answer as about a returning class only. The executor thread holds the sources enough; a question to the owner only if a result review finds the choice wrong on the usual path.
- class "Stagnating confirmation briefs the narrow round as full" (round 4, there before): after a confirmation of the condition that stagnates, `round.mjs brief` marks the brief full while `NEXT` names the narrow round (`tools/ont-check/round.mjs` around 102, `tools/ont-check/review-rounds.mjs` around 364).
- class "Multiple repeated classes can require different remedies" (round 3): the analysis and the choice for each of several repeated classes.
- class "Post-analysis filing can reset the comparison window" (round 3): filing after the analysis a finding already recorded, and its effect on the count of stagnation.

## Slice

IDs: `derived.next-round`, `rule.rounds-converge`, `rule.whole-class`.

Checks: `check.review-round.redesign-after-stagnation`, `check.review-round.stagnation-count`, `check.review-round.stagnation-repeat`, `check.review-round.condition-stagnation`.

Why now: every task of the goal that stagnates meets it; it is outside the approved statement of task enforcement-tool-records, so it is its own task.

## Depends on

Task enforcement-tool-records, whose round writer the new step extends.
