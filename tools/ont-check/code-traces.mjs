// Traces on the code, mutations of the forms, and tests of checks that run on either (D-101, D-102).
// A project's adapter tells how its code takes the steps of a trace: how each implemented action is
// called, how a refusal of the code reads in the ontology's terms, and the code's state as records of
// the ontology. A trace then runs on the code as it runs on the oracle, and a test of a check written
// against a system runs on both: on the code, and on the oracle with one of its forms changed, where it
// must fail whenever the check's trace does.
// ont: concept.code-adapter, rule.trace-runs-on-code, derived.surviving-mutation, rule.test-fails-on-mutant
import { FormError } from "./expr.mjs";
import { loadConfig, parseChecks, parseGlossary, read, section } from "./lib.mjs";
import { Oracle, readForms, readTraces, runTrace } from "./oracle.mjs";

// What a project's tests of systemTests take from the tool: ont-check, when it loads them, gives them its
// own copy as globalThis.__ontCheck, so that they run wherever the project keeps its copy of the tool.
export { Oracle, parseGlossary, readForms, readTraces };

// The code as a system that takes the steps of a trace.
export class CodeSystem {
  constructor(adapter, rows, formsRead, sample) {
    this.adapter = adapter;
    this.isCode = true;
    // An oracle with no records only reads the code's state, projected into the ontology's records.
    this.view = new Oracle(rows, formsRead, []);
    this.state = adapter.init();
    this.today = null;
    for (const o of sample ?? []) this.put(o.ent, o.id, o.fields);
  }
  put(ent, id, fields) {
    this.adapter.put(this.state, ent, id, fields);
  }
  // The code has no hooks of its own to run on a day; a day only moves its calendar.
  advance(date) {
    if (this.today !== null && date < this.today) throw new FormError("trace", `${date} is before ${this.today}`);
    this.today = date;
    this.adapter.day?.(this.state, date);
  }
  act(id, args, actor) {
    const run = this.adapter.actions[id];
    if (!run) throw new FormError("trace", `the adapter does not run ${id}`);
    try {
      run(this.state, args, actor, this.today);
      return { kind: "ok", by: id, message: "" };
    } catch (e) {
      const r = this.adapter.refusal(e);
      if (!r) throw e;
      return { kind: r.kind ?? "refused", by: r.by ?? null, message: r.message ?? e.message };
    }
  }
  eval(src, actor = "staff") {
    this.view.state = this.adapter.project(this.state, this.today);
    this.view.today = this.today;
    return this.view.eval(src, actor);
  }
  get notifications() {
    return this.adapter.notifications?.(this.state) ?? [];
  }
}

// A trace may differ on the code only for a check the adapter names under `diverges`, as
// { ticket, allows(failures) }: the ticket of a known divergence whose line names one of the check's
// concepts, and the whole effect that divergence may have, as the failing lines of THEN it accepts. Every
// line of THEN is checked; a failure the divergence does not accept, a case that cannot even be set up, or
// a code that throws fails (rule.trace-runs-on-code).
export function allowedDivergences(adapter, lines, catalogue) {
  const allowed = new Map();
  for (const [check, d] of Object.entries(adapter.diverges ?? {})) {
    const concepts = catalogue.get(check)?.concepts ?? [];
    const line = lines.find((l) => l.includes(d.ticket) && concepts.some((x) => l.includes(`\`${x}\``)));
    if (line && typeof d.allows === "function") allowed.set(check, d);
  }
  return allowed;
}

// A test of a check that runs on a system: by default its trace. Registered tests are collected for
// --mutate when the registry is open; otherwise each runs as a test of node:test on the code.
export const registry = () => (globalThis.__ontCheckTests ??= { open: false, tests: [] });
export function traceTest(trace, { rows, formsRead, sample, allowed = new Map() }) {
  return (system) => {
    const d = system.isCode ? allowed.get(trace.id) : null;
    const r = runTrace(rows, formsRead, sample, trace, system, { collect: Boolean(d) });
    if (r.ok) return { ok: true };
    if (d && r.part === "then" && !r.thrown && r.failures && d.allows(r.failures)) return { ok: true, diverged: `${d.ticket}: ${r.failures.join("; ")}` };
    throw new Error(`${trace.id}: ${r.failures?.join("; ") ?? r.error}`);
  };
}

// The changes of one form at a time: a number by one, a comparison turned, and or or swapped, a not
// dropped, true and false swapped. Each change is a line of a behavior block of the ontology, rewritten.
const SWAPS = [
  [/ <= /, " < "], [/ < /, " <= "], [/ >= /, " > "], [/ > /, " >= "], [/ != /, " = "],
  [/ and /, " or "], [/ or /, " and "], [/\bnot /, ""], [/\btrue\b/, "false"], [/\bfalse\b/, "true"],
];
export function* mutants(md) {
  const lines = md.split("\n");
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^```behavior\s*$/.test(l.trim())) { inBlock = true; continue; }
    if (inBlock && l.trim() === "```") { inBlock = false; continue; }
    if (!inBlock || !l.trim()) continue;
    // A line of a form's head, "derived.overdue(loan) = …", defines by its first " = ", and so do let
    // and set; what follows it is changed. A head with no " = ", such as an action's, is not.
    const head0 = !/^\s/.test(l);
    if (head0 && !l.includes(" = ")) continue;
    const assign = head0 || /^\s*(let |set )/.test(l) ? l.indexOf(" = ") + 3 : 0;
    const head = l.slice(0, assign);
    const tail = l.slice(assign);
    const changes = [];
    for (const m of tail.matchAll(/\b\d+\b/g)) changes.push(tail.slice(0, m.index) + String(Number(m[0]) + 1) + tail.slice(m.index + m[0].length));
    // In a create, "field = value" gives a field its value; only an = inside a value compares.
    const gives = /^\s*create /.test(l) ? new Set([...tail.matchAll(/(?:: |, )[a-z][a-z0-9-]* = /g)].map((m) => m.index + m[0].length - 3)) : new Set();
    for (const m of tail.matchAll(/ = /g)) if (!gives.has(m.index)) changes.push(tail.slice(0, m.index) + " != " + tail.slice(m.index + 3));
    for (const [re, to] of SWAPS) {
      const m = tail.match(re);
      if (m) changes.push(tail.slice(0, m.index) + to + tail.slice(m.index + m[0].length));
    }
    for (const c of changes) {
      const out = [...lines];
      out[i] = head + c;
      yield { line: i + 1, from: l.trim(), to: (head + c).trim(), md: out.join("\n") };
    }
  }
}

// Every mutant of the forms against every trace: which traces each one fails, and the mutants no trace
// fails (derived.surviving-mutation). A mutant the forms cannot read is invalid and left out.
export function mutate({ md, rows, sample, traces }) {
  const out = [];
  for (const m of mutants(md)) {
    const formsRead = readForms(m.md, rows);
    if (formsRead.problems.length) continue;
    const killers = [];
    for (const t of traces.values()) {
      const r = runTrace(rows, formsRead, sample, t);
      if (!r.ok) killers.push(t.id);
    }
    out.push({ ...m, formsRead, killers });
  }
  return out;
}

// The tests of checks that do not fail on a mutant their check's trace fails on (rule.test-fails-on-mutant).
export function emptyTests({ results, tests, rows, sample }) {
  const empty = [];
  for (const t of tests) {
    const killing = results.filter((m) => m.killers.includes(t.check));
    if (!killing.length) continue;
    const missed = killing.filter((m) => {
      // A test that does not throw on the mutant did not fail on it.
      try {
        t.fn(new Oracle(rows, m.formsRead, sample));
        return true;
      } catch {
        return false;
      }
    });
    if (missed.length) empty.push({ check: t.check, name: t.name, missed: missed.map((m) => `line ${m.line}: ${m.from} → ${m.to}`) });
  }
  return empty;
}

// The tests of a project's checks that run on a system, for one test file: checkTest("[check.x] …", fn)
// registers a test whose title starts with the check it implements; fn takes a system and fails by
// throwing, and without fn the test runs the check's trace. Under node:test each runs on the code
// through the adapter; when ont-check --mutate opens the registry, they are collected to run on mutants.
export const divergenceLines = (md, heading) => {
  const h = heading ? md.split("\n").find((l) => l.startsWith(heading)) : null;
  return h ? section(md, h).split("\n").filter((l) => /^- /.test(l)) : [];
};
export function codeTests({ config, adapter, test }) {
  const cfg = loadConfig(config);
  const md = read(cfg.ontology);
  const { rows } = parseGlossary(md);
  const formsRead = readForms(md, rows);
  const { traces, sample } = readTraces(read(cfg.checks.file));
  const catalogue = new Map(parseChecks(read(cfg.checks.file)).map((c) => [c.id, c]));
  const allowed = allowedDivergences(adapter, divergenceLines(md, cfg.headings.divergences), catalogue);
  return (title, fn) => {
    const id = title.match(/^\[(check\.[a-z0-9.-]+)\]/)?.[1];
    if (!id) throw new Error(`a test of a check starts with its tag: ${title}`);
    const trace = traces.get(id);
    if (!fn && !trace) throw new Error(`${id} has no trace to run`);
    const run = fn ?? traceTest(trace, { rows, formsRead, sample, allowed });
    const reg = registry();
    reg.tests.push({ kind: "check", check: id, name: title, fn: run, rows, sample });
    if (!reg.open) test(title, () => run(new CodeSystem(adapter, rows, formsRead, sample)));
  };
}

// The test that compares the code with the oracle on random sequences, tagged
// [check.formal-form.code-compared], and the other tests of a file of systemTests: registered so that the
// check sees that the comparison exists (D-103), and run under node:test only when the registry is closed.
export function compareTest(test, title, fn) {
  const id = title.match(/^\[(check\.[a-z0-9.-]+)\]/)?.[1];
  const reg = registry();
  reg.tests.push({ kind: "compare", check: id, name: title });
  if (!reg.open) test(title, fn);
}
export function plainTest(test, title, fn) {
  if (!registry().open) test(title, fn);
}
