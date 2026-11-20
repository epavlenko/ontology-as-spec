// A check's trace on the code, changes of the forms, and the test that compares the code with the oracle
// (D-101, D-102, D-103). Each case copies the example, changes one thing, and runs the check.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { allowedDivergences, compareTest, mutants, traceTest } from "../code-traces.mjs";

// compareTest takes a title and a function, and no runner of its own.
const compareTestArity = () => compareTest.length;
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
  const refused = /no test of systemTests registers the comparison with the oracle/;
  const without = check((dir) => rmSync(join(dir, "app/oracle.test.mjs")));
  assert.equal(without.code, 1, without.out);
  assert.match(without.out, refused);
  // A file that only mentions the oracle, or the check's tag, in a comment does not count; a registered test does.
  // The tag is built from parts, so that this file does not carry it as a tag of its own.
  const tag = `[${"check"}.formal-form.code-compared]`;
  for (const text of ["// new Oracle(\n", `// ${tag}\n`, `// compareTest(test, "${tag} x", () => {});\n`]) {
    const mention = check((dir) => writeFileSync(join(dir, "app/oracle.test.mjs"), text));
    assert.equal(mention.code, 1, mention.out);
    assert.match(mention.out, refused);
  }
  const whole = check();
  assert.doesNotMatch(whole.out, refused);
});

test("[check.trace.runs-on-code] a traced check of built concepts that no test runs on the code fails the check", () => {
  const r = check((dir) => patch(dir, "traces/traces.test.mjs", 'checkTest("[check.item.one-open-loan] its trace on the code");\n', ""));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /traced checks of implemented concepts that no test runs on the code \(checkTest\) \(1\):\n {2}check\.item\.one-open-loan/);
  // A trace that takes an action not built yet is listed, as information.
  assert.match(r.out, /whose trace takes an action not implemented yet \(2\):\n {2}check\.member\.borrow-limit: action\.set-borrow-limit/);
  // Without an adapter, the traced checks of built concepts fail the check; an adapter that leaves out an
  // action the traces take fails it too.
  // Tests named only in comments are no tests: every traced check of built concepts is then missing.
  const commented = check((dir) => {
    const path = join(dir, "traces/traces.test.mjs");
    writeFileSync(path, readFileSync(path, "utf8").replace(/^checkTest\(/gm, "// checkTest("));
  });
  assert.equal(commented.code, 1, commented.out);
  assert.match(commented.out, /no test runs on the code \(checkTest\) \(11\)/);
  const none = check((dir) => patch(dir, "ont.config.json", '  "adapter": "app/adapter.mjs",\n', ""));
  assert.equal(none.code, 1, none.out);
  assert.match(none.out, /no adapter to run them on the code/);
  const short = check((dir) => patch(dir, "app/adapter.mjs", '  "action.renew": (s, a, actor, today) => library.renew(s, { item: a.item, today }),\n', ""));
  assert.equal(short.code, 1, short.out);
  assert.match(short.out, /implemented actions that traces take and the adapter does not run \(1\):\n {2}action\.renew/);
});

test("[check.formal-form.mutation-survives] --mutate lists the changes of the forms that no trace fails on", () => {
  const r = check(null, "--mutate");
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^MUTATE \d+ changes of the forms · \d+ failed by a trace · \d+ survive$/m);
  assert.match(r.out, /refuse when open > limit → refuse when open >= limit/);
  // A form on one line is changed too, after its first " = ", and the trace of its check fails on it.
  const md = readFileSync(join(EXAMPLE, "ontology.md"), "utf8");
  assert.ok([...mutants(md)].some((m) => m.from === "rule.loan-period = 21 days" && m.to === "rule.loan-period = 22 days"));
  assert.doesNotMatch(r.out, /rule\.loan-period = 21 days → /);
  assert.doesNotMatch(r.out, /empty tests/);
});

test("[check.formal-form.empty-test] --mutate names a test of a check that passes on a change its trace fails on", () => {
  const r = check((dir) => appendFileSync(join(dir, "traces/traces.test.mjs"), 'checkTest("[check.item.one-open-loan] asserts nothing", () => {});\n'), "--mutate");
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\(empty tests\) \(1\):\n {2}\[check\.item\.one-open-loan\] asserts nothing: line \d+/);
  assert.doesNotMatch(r.out, /\[check\.item\.one-open-loan\] its trace on the code:/);
});

test("[check.trace.code-diverges] on the code a trace may differ only for a check the adapter names with its known divergence, and only in THEN", () => {
  const md = readFileSync(join(EXAMPLE, "ontology.md"), "utf8");
  const { rows } = parseGlossary(md);
  const formsRead = readForms(md, rows);
  const { traces, sample } = readTraces(readFileSync(join(EXAMPLE, "checks.md"), "utf8"));
  const trace = traces.get("check.item.one-open-loan");
  const setup = { rows, formsRead, sample };
  // A code that refuses nothing differs from the oracle on this trace in its THEN.
  const lax = { isCode: true, today: null, put() {}, advance() {}, act: (id) => ({ kind: "ok", by: id, message: "" }), eval: () => true, notifications: [] };
  assert.throws(() => traceTest(trace, setup)(lax), /check\.item\.one-open-loan: /);
  // Named by the adapter with the ticket of a divergence whose line names one of the check's concepts: allowed.
  const catalogue = new Map([["check.item.one-open-loan", { concepts: ["inv.one-loan-per-item", "action.checkout"] }]]);
  const line = "- **Item.** The code lends an item twice (`inv.one-loan-per-item`). Ticket: #9 One loan per item.";
  // The divergence states its whole effect: the failing lines of THEN it accepts.
  const only = (failures) => failures.length === 1 && /outcome 1 is ok/.test(failures[0]);
  // The trace with an assertion added, which the lax code still holds and a worse one does not.
  const asserted = { ...trace, then: [...trace.then, { text: 'assert count(l in loans where l.item = "dune-1") = 1', line: 999 }] };
  const allowed = allowedDivergences({ diverges: { "check.item.one-open-loan": { ticket: "#9 One loan per item", allows: only } } }, [line], catalogue);
  const r = traceTest(asserted, { ...setup, allowed })(lax);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.diverged, /^#9 One loan per item: .*outcome 1 is ok/);
  // Another error inside the same trace, beyond the effect the divergence accepts, fails it.
  const worse = { ...lax, eval: () => false };
  assert.throws(() => traceTest(asserted, { ...setup, allowed })(worse), /outcome 1 is ok.*; .*assert/);
  // A ticket no divergence line has, a line that names none of the check's concepts, or no stated effect, allows nothing.
  assert.equal(allowedDivergences({ diverges: { "check.item.one-open-loan": { ticket: "#8 Other", allows: only } } }, [line], catalogue).size, 0);
  assert.equal(allowedDivergences({ diverges: { "check.item.one-open-loan": { ticket: "#9 One loan per item", allows: only } } }, ["- Ticket: #9 One loan per item (`inv.other`)."], catalogue).size, 0);
  assert.equal(allowedDivergences({ diverges: { "check.item.one-open-loan": { ticket: "#9 One loan per item" } } }, [line], catalogue).size, 0);
  // The ticket is matched whole: an empty one, or #9 against a line of #99, allows nothing.
  const other = "- **Item.** The code lends an item twice (`inv.one-loan-per-item`). Ticket: #99 Another ticket.";
  assert.equal(allowedDivergences({ diverges: { "check.item.one-open-loan": { ticket: "#9", allows: only } } }, [other], catalogue).size, 0);
  assert.equal(allowedDivergences({ diverges: { "check.item.one-open-loan": { ticket: "", allows: only } } }, [other], catalogue).size, 0);
  // A code that throws, or fails before THEN, is not a divergence.
  const broken = { ...lax, act: () => { throw new Error("unexpected database failure"); } };
  assert.throws(() => traceTest(trace, { ...setup, allowed })(broken), /unexpected database failure/);
  // On the oracle a divergence allows nothing.
  assert.throws(() => traceTest(trace, { ...setup, allowed })({ ...lax, isCode: false }));
});

test("[check.trace.runs-on-code] a registered test runs: a runner passed to skip it is not taken", () => {
  // The tool hands each registered test to node:test itself, so the example's tests run on the code even
  // when a file tries to skip them.
  const root = mkdtempSync(join(tmpdir(), "code-traces-skip-"));
  const dir = join(root, "example");
  try {
    cpSync(EXAMPLE, dir, { recursive: true });
    symlinkSync(join(TOOLS, ".."), join(root, "tools"));
    patch(dir, "traces/traces.test.mjs", "adapter });", "adapter, test: (await import(\"node:test\")).test.skip });");
    // A run of node:test of its own, not a subtest of this one.
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const r = spawnSync("node", ["--test", join(dir, "traces/traces.test.mjs")], { encoding: "utf8", env });
    assert.match(r.stdout, /ℹ pass 11/, r.stdout);
    assert.match(r.stdout, /ℹ skipped 0/, r.stdout);
    assert.equal(compareTestArity(), 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
