// Checks a model judges (D-60 of the approach): the test runs the library on a fixed sample, and a
// judge reads the refusal next to the check's case. Without a judge in JUDGE, the test is skipped.
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { judge } from "../../tools/ont-check/judge.mjs";
import { checkout, emptyState, Refusal } from "../app/library.mjs";

const CHECKS = fileURLToPath(new URL("../checks.md", import.meta.url));
const skip = !process.env.JUDGE && "no judge: set JUDGE to a command that reads a prompt on stdin";

test("[check.member.limit-refusal-explained] a refusal at the borrow limit says why", { skip }, () => {
  const state = emptyState();
  state.members.ana = { name: "Ana" };
  state.titles.dune = { name: "Dune" };
  for (let i = 1; i <= 6; i += 1) state.items[`dune-${i}`] = { title: "dune" };
  for (let i = 1; i <= 5; i += 1) checkout(state, { item: `dune-${i}`, member: "ana", today: "2026-10-01" });
  let output = "";
  try {
    checkout(state, { item: "dune-6", member: "ana", today: "2026-10-01" });
  } catch (e) {
    if (!(e instanceof Refusal)) throw e;
    output = e.message;
  }
  const { pass, verdict } = judge({ checks: CHECKS, id: "check.member.limit-refusal-explained", output });
  assert.ok(pass, verdict);
});
