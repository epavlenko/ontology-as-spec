# Why not spec-as-source

Spec-as-source means the specification is the primary artifact and code is regenerated from it. In Böckeler's words, at that level "the human never touches the code". This approach does not aim there, for three reasons.

## The ontology is a model of concepts, not a full specification of behavior

The ontology says what a loan, a hold and a suspension are, which rules and invariants hold, and which views and actions exist. It does not say how a screen lays out, which error message appears in which order, how a retry behaves, or what a database migration looks like. Those are real decisions. They live in the mockup, in the code and sometimes in tickets. The ontology does not contain them, and it would become unreadable if it tried.

The test for spec-as-source is that the product can be reproduced from the specification. That test fails here on purpose. Two teams given the same ontology would build products that agree on every concept and differ in a hundred details.

## Code and mockup are edited directly

Agents and people edit the mockup and the code by hand. Nothing is generated except the tooltip glossary. What keeps meaning intact is not generation but reference: everything points at the same IDs, and a check notices when the pointers break.

## "The human never touches the code" no longer distinguishes anything

When agents write nearly all the code, no human touches it in any of the three levels. The useful question moves from "who edits the code?" to "what is the code checked against, and how?". For this approach, the answer is that interface, decisions, implementation status and verification are checked against concepts, and code is checked against tests. The link between code and concepts is the [weakest part](limitations.md#code-does-not-refer-to-ids).

## A narrow step toward spec-as-source

Some parts of the ontology are precise enough to generate from. Fields with types, enumerations of states and the shape of a relation could produce schemas or contracts directly. That would make a thin slice of the product spec-as-source while leaving the rest anchored. It is listed under [proposed strengthening](limitations.md#proposed-strengthening) and has not been tried.

## What this costs and what it buys

Not generating code means accepting that code can diverge from the ontology without the check noticing. In exchange, the ontology stays short enough to read, changes cheaply when something is learned, and avoids what Böckeler warns spec-as-source may combine: "the downsides of both MDD and LLMs: Inflexibility and non-determinism."
