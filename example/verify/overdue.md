# Run guide: a loan becomes overdue on its own

> Example run guide (part 6 of the approach): how to run a manual check of the catalogue with the command line front end. What must hold is in `../checks.md`; this page says only how to get there, what shows after each step, what to keep and where a run gets lost.

<!-- ont: check.loan.overdue-in-real-time@092c60 -->
## Overdue without anyone setting the date

Start on a machine whose clock nobody sets by hand, with a state file of its own: `export LIBRARY_STATE=$HOME/overdue-run.json`. From the repository root:

1. `node example/app/cli.mjs seed` prints `seeded: members ana, ben, carl; items dune-1, dune-2, drill-1`.
2. `node example/app/cli.mjs checkout drill-1 ana` prints `checked out drill-1 to ana, due …`. Note the due date: 21 days from today.
3. On the day after that date, `node example/app/cli.mjs loans ana` prints the line of `drill-1`. Compare it with the THEN of the check.

Keep, named by the check's ID and the date: the output of steps 2 and 3, each with the day it was run.

Traps:

- `--today` sets the date by hand. A run with it does not count: it is the path the unit tests already take, and this check exists for the case where nobody sets the date. If the day after the due date cannot be waited for, report the check as not run.
- Without `LIBRARY_STATE`, every run on the machine shares one state file, and a `seed` from another run between steps 2 and 3 erases the loan.
