# Verification map

How to prove, the way a member or a librarian sees it, that an implemented concept works. One file per feature. Each file starts with an H1 title and an `IDs:` line listing the concepts it proves. `tools/ont-check/ont-check.mjs` enforces two rules:

- every ID on an `IDs:` line exists in the glossary;
- every implemented ID of class `view`, `action` or `hook` (the "Implementation status" table) appears on some `IDs:` line.

Adding a row to the implementation table therefore means adding or extending a scenario in the same change.

Each file has three sections: `Scenarios` (what to do and what you must see), `Preconditions`, `Gotchas`. Scenarios use the command line front end; run them from `example/` with a throwaway state file:

```bash
export LIBRARY_STATE=$(mktemp)
node app/cli.mjs seed
```

## Features

- [Loans](./loans.md): checkout, return, the member's loans and the overdue mark.
- [Renewal](./renewal.md): renewing, the renewal limit and refusal while someone waits.
- [Holds](./holds.md): placing a hold when every copy is out.
