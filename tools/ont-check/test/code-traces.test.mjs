// A check's trace on the code, changes of the forms, and the test that compares the code with the oracle
// (D-101, D-102, D-103). Each case copies the example, changes one thing, and runs the check.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { traceTest } from "../code-traces.mjs";
import { parseGlossary } from "../lib.mjs";
import { readForms, readTraces } from "../oracle.mjs";

const TOOLS = fileURLToPath(new URL("../", import.meta.url));
const EXAMPLE = fileURLToPath(new URL("../../../example/", import.meta.url));

const check = (edit, ...args) => {
  // The copy sits where the example does, beside the tools, which its tests import.
  const root = mkdtempSync(join(tmpdir(), "code-traces-"));
  const dir = join(root, "example");
  try {
    cpSync(EXAMPLE, dir, { recursive: true });
    symlinkSync(join(TOOLS, ".."), join(root, "tools"));
    edit?.(dir);
    const r = spawnSync("node", [join(TOOLS, "ont-check.mjs"), "--config", join(dir, "ont.config.json"), ...args], { encoding: "utf8" });
    return { code: r.status, out: r.stdout + r.stderr };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};
const patch = (dir, file, from, to) => {
  const path = join(dir, file);
  const text = readFileSync(path, "utf8");
  assert.ok(text.includes(from), `fixture text not found in ${file}: ${from}`);
  writeFileSync(path, text.replace(from, to));
};

test("[check.formal-form.compare-required] with the oracle on and actions built, a test must run the oracle", () => {
  const without = check((dir) => rmSync(join(dir, "app/oracle.test.mjs")));
  assert.equal(without.code, 1, without.out);
  assert.match(without.out, /no test of the suites runs the oracle to compare the code with it/);
  const whole = check();
  assert.doesNotMatch(whole.out, /no test of the suites runs the oracle/);
});

test("[check.trace.runs-on-code] a traced check of built concepts that no test runs on the code fails the check", () => {
  const r = check((dir) => patch(dir, "traces/traces.test.mjs", 'checkTest("[check.item.one-open-loan] its trace on the code");\n', ""));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /traced checks of implemented concepts that no test runs on the code \(checkTest\) \(1\):\n {2}check\.item\.one-open-loan/);
  // A trace that takes an action the adapter does not run is listed, as information.
  assert.match(r.out, /whose trace takes an action the adapter does not run \(2\):\n {2}check\.member\.borrow-limit: action\.set-borrow-limit/);
});

test("[check.formal-form.mutation-survives] --mutate lists the changes of the forms that no trace fails on", () => {
  const r = check(null, "--mutate");
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^MUTATE \d+ changes of the forms · \d+ failed by a trace · \d+ survive$/m);
  assert.match(r.out, /refuse when open > limit → refuse when open >= limit/);
  assert.doesNotMatch(r.out, /empty tests/);
});

test("[check.formal-form.empty-test] --mutate names a test of a check that passes on a change its trace fails on", () => {
  const r = check((dir) => appendFileSync(join(dir, "traces/traces.test.mjs"), 'checkTest("[check.item.one-open-loan] asserts nothing", () => {});\n'), "--mutate");
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\(empty tests\) \(1\):\n {2}\[check\.item\.one-open-loan\] asserts nothing: line \d+/);
  assert.doesNotMatch(r.out, /\[check\.item\.one-open-loan\] its trace on the code:/);
});

test("[check.trace.code-diverges] on the code a trace may differ only where a known divergence names a concept of its check", () => {
  const md = readFileSync(join(EXAMPLE, "ontology.md"), "utf8");
  const { rows } = parseGlossary(md);
  const formsRead = readForms(md, rows);
  const { traces, sample } = readTraces(readFileSync(join(EXAMPLE, "checks.md"), "utf8"));
  const trace = traces.get("check.item.one-open-loan");
  // A code that refuses nothing differs from the oracle on this trace.
  const lax = { isCode: true, today: null, put() {}, advance() {}, act: (id) => ({ kind: "ok", by: id, message: "" }), eval: () => true, notifications: [] };
  const setup = { rows, formsRead, sample, concepts: ["inv.one-loan-per-item", "action.checkout"] };
  assert.throws(() => traceTest(trace, { ...setup, diverged: new Set() })(lax), /check\.item\.one-open-loan: /);
  const allowed = traceTest(trace, { ...setup, diverged: new Set(["inv.one-loan-per-item"]) })(lax);
  assert.equal(allowed.ok, true);
  assert.match(allowed.diverged, /outcome/);
  // On the oracle, a divergence allows nothing.
  assert.throws(() => traceTest(trace, { ...setup, diverged: new Set(["inv.one-loan-per-item"]) })({ ...lax, isCode: false }));
});
