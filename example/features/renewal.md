# Renewal

IDs: `action.renew`, `rule.renewal`, `inv.no-renew-when-held`, `field.loan.renewals`

A member renews a loan to keep the item longer. Each renewal adds 14 days, at most twice, and never while someone waits for the title.

## Preconditions

- Fresh state from `seed`, then `node app/cli.mjs checkout dune-1 ana --today 2026-10-01`.

## Scenarios

- **Renewal moves the due date.** `node app/cli.mjs renew dune-1 --today 2026-10-20` prints `due 2026-11-05, renewals 1`.
- **At most twice.** A second renewal prints `due 2026-11-19, renewals 2`; a third prints `refused: Already renewed 2 times`.
- **Refused while held.** From fresh state: check out `dune-1` to `ana` and `dune-2` to `ben`, `node app/cli.mjs hold dune ana --today 2026-10-02`, then `renew dune-2` prints `refused: 1 member(s) waiting for this title`.

## Gotchas

- The CLI prints the reason but not the disabled button of the mockup (D-04); that part is target.
