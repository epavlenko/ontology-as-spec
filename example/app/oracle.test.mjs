// The code compared with the oracle (the approach's oracle prototype, rule.code-compared-with-oracle): library.mjs
// and the ontology's formal forms run the same random sequences of implemented actions and days. After
// every step both are observed: accepted or not, open loans, overdue marks, queues and availability.
// A difference fails unless it is one of the known divergences of ontology.md, matched by its
// condition; a matched divergence ends its sequence, since the states then differ. A failing sequence
// is written to a file with its seed; ORACLE_SEED=<seed> runs that sequence alone.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseGlossary } from "../../tools/ont-check/lib.mjs";
import { Oracle, readForms, readTraces } from "../../tools/ont-check/oracle.mjs";
import * as library from "./library.mjs";

const HERE = fileURLToPath(new URL("../", import.meta.url));
const md = readFileSync(join(HERE, "ontology.md"), "utf8");
const { rows } = parseGlossary(md);
const forms = readForms(md, rows);
const sample = readTraces(readFileSync(join(HERE, "checks.md"), "utf8")).sample;

const MEMBERS = sample.filter((o) => o.ent === "member").map((o) => o.id);
const ITEMS = sample.filter((o) => o.ent === "item").map((o) => o.id);
const TITLES = sample.filter((o) => o.ent === "title").map((o) => o.id);
// The actions the implementation table lists as implemented, with how each is called in the code.
const ACTIONS = {
  "action.checkout": (lib, s, a, today) => lib.checkout(s, { item: a.item, member: a.member, today }),
  "action.return": (lib, s, a, today) => lib.returnItem(s, { item: a.item, today }),
  "action.renew": (lib, s, a, today) => lib.renew(s, { item: a.item, today }),
  "action.place-hold": (lib, s, a, today) => lib.placeHold(s, { title: a.title, member: a.member, today }),
};

const mulberry = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// A sequence: days and actions over the sample, with a few names that do not exist.
function sequence(seed, length) {
  const rnd = mulberry(seed);
  const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
  const steps = [];
  let day = "2026-10-01";
  for (let i = 0; i < length; i++) {
    if (rnd() < 0.25) {
      day = library.addDays(day, 1 + Math.floor(rnd() * 12));
      steps.push({ day });
      continue;
    }
    const action = pick(Object.keys(ACTIONS));
    const member = rnd() < 0.05 ? "zoe" : pick(MEMBERS);
    const item = rnd() < 0.05 ? "dune-9" : pick(ITEMS);
    const title = rnd() < 0.05 ? "atlas" : pick(TITLES);
    const args = { "action.checkout": { item, member }, "action.return": { item, condition: "good" }, "action.renew": { item }, "action.place-hold": { title, member } }[action];
    const actor = action === "action.checkout" || action === "action.return" ? "staff" : action === "action.place-hold" ? member : pick(MEMBERS);
    steps.push({ day, action, args, actor });
  }
  return steps;
}

const codeState = () => {
  const s = library.emptyState();
  for (const o of sample) {
    if (o.ent === "member") s.members[o.id] = { borrowLimit: o.fields["borrow-limit"] };
    if (o.ent === "title") s.titles[o.id] = { name: o.id };
    if (o.ent === "item") s.items[o.id] = { title: o.fields["copy-of"] };
  }
  return s;
};

// What a member sees (memberView, the code's own view) and what is available, on both sides.
const observe = (lib, s, o, today) => {
  const code = {
    loans: MEMBERS.flatMap((m) => lib.memberView(s, m, today).loans.map((l) => `${m} ${l.item} ${l.due} ${l.renewals} ${l.overdue ? "overdue" : ""}`)).sort(),
    queues: MEMBERS.flatMap((m) => lib.memberView(s, m, today).holds.map((h) => `${m} ${h.title} ${h.position}`)).sort(),
    available: ITEMS.map((i) => `${i} ${lib.isAvailable(s, i)}`),
  };
  const st = o.state;
  const oracle = {
    loans: st.loans.filter((l) => l["returned-on"] === null && MEMBERS.includes(l.member)).map((l) => `${l.member} ${l.item} ${l["due-date"]} ${l.renewals} ${o.eval(`derived.overdue(the loan "${l.id}")`) ? "overdue" : ""}`).sort(),
    queues: st.holds.filter((h) => h.state === "waiting" && MEMBERS.includes(h.member)).map((h) => `${h.member} ${h["waits-for"]} ${o.eval(`derived.queue-position(the hold "${h.id}")`)}`).sort(),
    available: ITEMS.map((i) => `${i} ${o.eval(`derived.available(the item "${i}")`)}`),
  };
  return { code, oracle };
};

// The known divergences of ontology.md: each with the condition under which it may appear and its
// whole allowed effect. The code's observation must equal the oracle's with exactly that effect applied;
// anything else that differs fails.
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const KNOWN = [
  {
    // The code lends to, or queues, a member with an overdue loan; the oracle refuses by the invariant.
    // Allowed effect: the one loan or the one hold the code made, as the code makes it for anyone.
    ticket: "#4 Suspend borrowing instead of fines",
    when: (step, o) => ["action.checkout", "action.place-hold"].includes(step.action) && o.eval(`concept.suspension(the member "${step.args.member}")`) === true,
    allows: (step, r) => {
      if (!(r.codeAccepted && r.oracle.kind === "refused" && r.oracle.by === "inv.suspended-cannot-borrow")) return false;
      const { code, oracle } = r.obs;
      if (step.action === "action.checkout") {
        const loan = `${step.args.member} ${step.args.item} ${library.addDays(step.day, library.LOAN_DAYS)} 0 `;
        const available = oracle.available.map((x) => (x.startsWith(`${step.args.item} `) ? `${step.args.item} false` : x));
        return same(code.loans, [...oracle.loans, loan].sort()) && same(code.queues, oracle.queues) && same(code.available, available);
      }
      const position = oracle.queues.filter((q) => q.split(" ")[1] === step.args.title).length + 1;
      return same(code.queues, [...oracle.queues, `${step.args.member} ${step.args.title} ${position}`].sort()) && same(code.loans, oracle.loans) && same(code.available, oracle.available);
    },
  },
  {
    // A returned item of a title someone waits for: the oracle reserves it, the code makes it available.
    // Allowed effect: that one item available in the code, not in the oracle; nothing else.
    ticket: "#3 Serve the hold queue",
    when: (step, o) => step.action === "action.return" && o.eval(`some h in holds where h.state = "waiting" and h.waits-for = (the item "${step.args.item}").copy-of`) === true,
    allows: (step, r) => {
      if (!(r.codeAccepted && r.oracle.kind === "ok")) return false;
      const { code, oracle } = r.obs;
      const available = oracle.available.map((x) => (x === `${step.args.item} false` ? `${step.args.item} true` : x));
      return !same(available, oracle.available) && same(code.available, available) && same(code.loans, oracle.loans) && same(code.queues, oracle.queues);
    },
  },
];

export function compare(seeds, length, lib = library) {
  const result = { compared: 0, accepted: {}, refused: {}, known: Object.fromEntries(KNOWN.map((k) => [k.ticket, 0])), failures: [] };
  for (const seed of seeds) {
    const steps = sequence(seed, length);
    const s = codeState();
    const o = new Oracle(rows, forms, sample);
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      o.advance(step.day);
      let r = { codeAccepted: true, oracle: { kind: "ok" } };
      let matched = null;
      if (step.action) {
        const candidates = KNOWN.filter((k) => k.when(step, o));
        let codeAccepted = true;
        try { ACTIONS[step.action](lib, s, step.args, step.day); }
        catch (e) { if (!(e instanceof lib.Refusal)) throw e; codeAccepted = false; }
        const oracle = o.act(step.action, step.args, step.actor);
        r = { codeAccepted, oracle };
        const tally = codeAccepted ? result.accepted : result.refused;
        tally[step.action] = (tally[step.action] ?? 0) + 1;
        const obs = observe(lib, s, o, step.day);
        r.diff = ["loans", "queues", "available"].filter((k) => JSON.stringify(obs.code[k]) !== JSON.stringify(obs.oracle[k]));
        if (codeAccepted !== (oracle.kind === "ok")) r.diff.unshift("accepted");
        r.obs = obs;
        matched = r.diff.length ? candidates.find((k) => k.allows(step, r)) : null;
      } else {
        const obs = observe(lib, s, o, step.day);
        r.diff = ["loans", "queues", "available"].filter((k) => JSON.stringify(obs.code[k]) !== JSON.stringify(obs.oracle[k]));
        r.obs = obs;
      }
      result.compared++;
      if (!r.diff.length) continue;
      if (matched) { result.known[matched.ticket]++; break; }
      const file = join(tmpdir(), `oracle-failure-${seed}.json`);
      writeFileSync(file, JSON.stringify({ seed, length, step: i, steps: steps.slice(0, i + 1), diff: r.diff, observed: r.obs, oracle: r.oracle }, null, 1));
      result.failures.push(`seed ${seed}, step ${i + 1} (${step.action ?? `day ${step.day}`}): ${r.diff.join(", ")} differ; written to ${file}`);
      break;
    }
  }
  return result;
}

const SEEDS = process.env.ORACLE_SEED ? [Number(process.env.ORACLE_SEED)] : Array.from({ length: 500 }, (_, i) => i + 1);

test("the code agrees with the oracle on 500 random sequences, apart from the known divergences", () => {
  const r = compare(SEEDS, 30);
  if (process.env.ORACLE_STATS) console.log(JSON.stringify({ compared: r.compared, accepted: r.accepted, refused: r.refused, known: r.known }));
  assert.deepEqual(r.failures, []);
  if (process.env.ORACLE_SEED) return;
  assert.ok(r.compared >= 1000, `only ${r.compared} steps compared`);
  for (const a of Object.keys(ACTIONS)) {
    assert.ok(r.accepted[a] > 0, `${a} never accepted`);
    assert.ok(r.refused[a] > 0, `${a} never refused`);
  }
  for (const [ticket, n] of Object.entries(r.known)) assert.ok(n > 0, `known divergence ${ticket} never met`);
});

test("a run that compares nothing fails", () => {
  const r = compare([], 30);
  assert.equal(r.compared, 0);
  assert.throws(() => assert.ok(r.compared >= 1000, `only ${r.compared} steps compared`));
});

test("a new difference in the code is caught: a loan period of 20 days instead of 21", () => {
  const broken = { ...library, checkout: (s, a) => { const loan = library.checkout(s, a); loan.due = library.addDays(a.today, 20); return loan; } };
  const r = compare(Array.from({ length: 50 }, (_, i) => i + 1), 30, broken);
  assert.ok(r.failures.length > 0, "the injected difference was not caught");
  assert.match(r.failures[0], /loans differ/);
});

test("a difference hidden inside known divergence #4 is caught: a suspended member's loan due in 200 days", () => {
  const broken = {
    ...library,
    checkout: (s, a) => {
      const overdue = s.loans.some((l) => !l.returned && l.member === a.member && a.today > l.due);
      const loan = library.checkout(s, a);
      if (overdue) loan.due = library.addDays(a.today, 200);
      return loan;
    },
  };
  const r = compare(SEEDS.slice(0, 500), 30, broken);
  assert.ok(r.failures.length > 0, "the difference inside the known divergence was not caught");
});

test("a difference hidden inside known divergence #3 is caught: a return of a held title that leaves the loan open", () => {
  const broken = {
    ...library,
    returnItem: (s, a) => {
      const title = s.items[a.item]?.title;
      const held = s.holds.some((h) => h.title === title && !h.closed);
      const loan = library.returnItem(s, a);
      if (held) loan.returned = null;
      return loan;
    },
  };
  const r = compare(SEEDS.slice(0, 500), 30, broken);
  assert.ok(r.failures.length > 0, "the difference inside the known divergence was not caught");
});
