# Tickets

Slices of this repository's own gap. `npm run next` proposes the next slice of what is ready; a ticket takes it in a file named `NNNN-short-title.md`, in the shape of [templates/issue.md](../templates/issue.md), with its `IDs:` and `Checks:` lines. It is done when `npm run gap -- issues/NNNN-short-title.md` prints `SLICE_DONE` and `npm test` passes ([part 8](../docs/parts/agent-workflow.md)).
