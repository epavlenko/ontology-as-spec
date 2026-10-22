// End-to-end tests: the command line front end run as a separate process, the way a librarian or a
// member uses it, with a throwaway state file. Each title starts with the IDs of the checks it
// implements, from checks.md; this suite must cover every implemented action and view.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../app/cli.mjs", import.meta.url));

// A fresh library: seeds the state, then returns a function that runs one command against it.
const library = (t) => {
  const dir = mkdtempSync(join(tmpdir(), "library-e2e-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { ...process.env, LIBRARY_STATE: join(dir, "state.json") };
  const cli = (...args) => {
    const r = spawnSync("node", [CLI, ...args], { env, encoding: "utf8" });
    return { code: r.status, out: (r.stdout + r.stderr).trim() };
  };
  cli("seed");
  return cli;
};

test("[check.loan.due-in-21-days, check.item.one-open-loan] checkout sets the due date and refuses a second loan of the same item", (t) => {
  const cli = library(t);
  assert.equal(cli("checkout", "dune-1", "ana", "--today", "2026-10-01").out, "checked out dune-1 to ana, due 2026-10-22");
  const again = cli("checkout", "dune-1", "ben", "--today", "2026-10-01");
  assert.equal(again.code, 1);
  assert.equal(again.out, "refused: Item dune-1 is already on loan");
});

test("[check.loan.return-closes-loan] a returned item leaves the member's loans", (t) => {
  const cli = library(t);
  cli("checkout", "dune-1", "ana", "--today", "2026-10-01");
  assert.match(cli("loans", "ana", "--today", "2026-10-23").out, /dune-1 {2}Dune {2}due 2026-10-22 {2}OVERDUE/);
  assert.equal(cli("return", "dune-1", "--today", "2026-10-23").out, "returned dune-1");
  assert.equal(cli("loans", "ana", "--today", "2026-10-23").out, "nothing on loan, no holds");
});

test("[check.loan.renew-while-held] renewal moves the due date and is refused while someone waits", (t) => {
  const cli = library(t);
  cli("checkout", "dune-1", "ana", "--today", "2026-10-01");
  assert.equal(cli("renew", "dune-1", "--today", "2026-10-20").out, "renewed dune-1, due 2026-11-05, renewals 1");
  cli("checkout", "dune-2", "ben", "--today", "2026-10-01");
  cli("hold", "dune", "ana", "--today", "2026-10-02");
  assert.equal(cli("renew", "dune-2", "--today", "2026-10-10").out, "refused: 1 member(s) waiting for this title");
});

test("[check.hold.only-when-all-out, check.hold.position-shown] a hold is placed only when every copy is out, in order", (t) => {
  const cli = library(t);
  assert.equal(cli("hold", "dune", "ana", "--today", "2026-10-01").out, "refused: An item of dune is available");
  cli("checkout", "dune-1", "ben", "--today", "2026-10-01");
  cli("checkout", "dune-2", "ben", "--today", "2026-10-01");
  assert.equal(cli("hold", "dune", "ana", "--today", "2026-10-01").out, "hold H1 on dune for ana");
  assert.equal(cli("loans", "ana", "--today", "2026-10-01").out, "hold  Dune  position 1");
  cli("hold", "dune", "carl", "--today", "2026-10-02");
  assert.equal(cli("loans", "carl", "--today", "2026-10-02").out, "hold  Dune  position 2");
});
