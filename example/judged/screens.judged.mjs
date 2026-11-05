// The screen My loans in each state its note describes (D-83 of the approach): the test sets the state
// up through the command line, takes the screen as text, keeps it where JUDGE_SCREENS points for the
// owner to judge layout and style, and a judge reads it next to the check's case. Without a judge in
// JUDGE, the tests are skipped.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { judge, keepScreen } from "../../tools/ont-check/judge.mjs";

const CLI = fileURLToPath(new URL("../app/cli.mjs", import.meta.url));
const CHECKS = fileURLToPath(new URL("../checks.md", import.meta.url));
const skip = !process.env.JUDGE && "no judge: set JUDGE to a command that reads a prompt on stdin";

// A fresh library on which the steps run; returns ana's screen My loans on the given day.
const screen = (t, steps, today) => {
  const dir = mkdtempSync(join(tmpdir(), "library-screens-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { ...process.env, LIBRARY_STATE: join(dir, "state.json") };
  const cli = (...args) => spawnSync("node", [CLI, ...args], { env, encoding: "utf8" }).stdout.trim();
  cli("seed");
  for (const s of steps) cli(...s);
  return cli("loans", "ana", "--today", today);
};

const judgeScreen = (id, state, output) => {
  keepScreen({ view: "view.member.loans", state, text: `${output}\n` });
  const { pass, verdict } = judge({ checks: CHECKS, id, output });
  assert.ok(pass, verdict);
};

test("[check.screens.loans-shown] My loans shows only the member's open loans, with due dates, renewals and the overdue mark", { skip }, (t) => {
  const output = screen(
    t,
    [
      ["checkout", "drill-1", "ana", "--today", "2026-09-01"],
      ["return", "drill-1", "--today", "2026-09-05"],
      ["checkout", "dune-1", "ana", "--today", "2026-10-01"],
      ["renew", "dune-1", "--today", "2026-10-10"],
      ["checkout", "drill-1", "ana", "--today", "2026-10-20"],
      ["checkout", "dune-2", "ben", "--today", "2026-10-20"],
    ],
    "2026-11-06",
  );
  judgeScreen("check.screens.loans-shown", "loans", output);
});

test("[check.screens.loans-renew-held] My loans shows renewal refused while someone waits, with how many", { skip }, (t) => {
  const output = screen(
    t,
    [
      ["checkout", "dune-1", "ana", "--today", "2026-10-01"],
      ["checkout", "dune-2", "ben", "--today", "2026-10-01"],
      ["hold", "dune", "carl", "--today", "2026-10-02"],
    ],
    "2026-10-03",
  );
  judgeScreen("check.screens.loans-renew-held", "renew-held", output);
});

test("[check.screens.loans-renew-exhausted] My loans shows renewal refused once both renewals are used", { skip }, (t) => {
  const output = screen(
    t,
    [
      ["checkout", "dune-1", "ana", "--today", "2026-10-01"],
      ["renew", "dune-1", "--today", "2026-10-10"],
      ["renew", "dune-1", "--today", "2026-10-20"],
    ],
    "2026-10-21",
  );
  judgeScreen("check.screens.loans-renew-exhausted", "renew-exhausted", output);
});

test("[check.screens.loans-empty] My loans with nothing on loan or on hold says so and points to the catalog", { skip }, (t) => {
  judgeScreen("check.screens.loans-empty", "empty", screen(t, [], "2026-10-01"));
});
