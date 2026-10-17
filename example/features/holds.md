# Holds

IDs: `action.place-hold`, `ent.hold`, `derived.queue-position`

A member joins the queue for a title when every copy is out and sees their position.

## Preconditions

- Fresh state from `seed`.

## Scenarios

- **Refused while a copy is free.** `node app/cli.mjs hold dune ana --today 2026-10-01` prints `refused: An item of dune is available`.
- **Placed when every copy is out.** Check out `dune-1` and `dune-2` to `ben`, then `node app/cli.mjs hold dune ana --today 2026-10-01` prints `hold H1 on dune for ana`; `loans ana` prints `hold  Dune  position 1`.

## Gotchas

- Returning a copy does not serve the queue yet (see "Known divergences" in the ontology): the item becomes available to anyone.
