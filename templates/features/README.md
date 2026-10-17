# Verification map

One file per user-visible feature. Each file starts with an H1 title and an `IDs:` line with the concepts it proves. The check requires every implemented `view`, `action` and `hook` to appear on some `IDs:` line.

Sections of a file: `Preconditions`, `Scenarios` (an action and the exact observable result), `Gotchas`.

## Features

- [Thing](./thing.md): closing a thing.
