# Loans

IDs: `action.checkout`, `action.return`, `view.member.loans`, `derived.overdue`, `inv.one-loan-per-item`, `inv.within-limit`, `rule.loan-period`

A librarian lends an item to a member and takes it back. The member sees open loans with due dates; a loan past its due date is marked overdue.

## Preconditions

- Fresh state from `seed`: members `ana`, `ben`; items `dune-1`, `dune-2` (title Dune), `drill-1`.

## Scenarios

- **Checkout sets the due date.** `node app/cli.mjs checkout dune-1 ana --today 2026-10-01` prints `due 2026-10-22`.
- **One loan per item.** `node app/cli.mjs checkout dune-1 ben --today 2026-10-01` prints `refused: Item dune-1 is already on loan` and exits 1.
- **Overdue mark.** `node app/cli.mjs loans ana --today 2026-10-23` prints the Dune line with `OVERDUE`; with `--today 2026-10-22` it does not.
- **Return.** `node app/cli.mjs return dune-1 --today 2026-10-23`, then `loans ana` prints `nothing on loan, no holds`.

## Gotchas

- Without `--today` the CLI uses the real date; every scenario passes it explicitly.
- The state file outlives the shell; reuse `seed` between scenarios.
