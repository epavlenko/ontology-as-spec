import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { evaluate, names, parse, schemaOf } from "../expr.mjs";
import { parseGlossary } from "../lib.mjs";
import { Oracle, readForms, readTraces } from "../oracle.mjs";

const TOOLS = fileURLToPath(new URL("../", import.meta.url));
const EXAMPLE = fileURLToPath(new URL("../../../example/", import.meta.url));

// Each case copies the example, breaks one thing in its forms or traces, and expects the check to
// name exactly that (D-93).
const run = (edit, ...args) => {
  const dir = mkdtempSync(join(tmpdir(), "ont-oracle-"));
  try {
    cpSync(EXAMPLE, dir, { recursive: true });
    const patch = (file, from, to) => {
      const path = join(dir, file);
      const text = readFileSync(path, "utf8");
      assert.ok(text.includes(from), `fixture text not found in ${file}: ${from}`);
      writeFileSync(path, text.replace(from, to));
    };
    edit?.(patch);
    const r = spawnSync("node", [join(TOOLS, "ont-check.mjs"), "--config", join(dir, "ont.config.json"), ...args], { encoding: "utf8" });
    return { code: r.status, out: r.stdout + r.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("the example's forms and traces are consistent, and every trace holds on the oracle", () => {
  const r = run(null, "--run");
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /RUN 30 passed · 0 failed · 10 not traced/);
  assert.match(r.out, /ONT_OK/);
});

test("[check.formal-form.missing] an action row without a form is named", () => {
  const cancel = /\naction\.cancel-hold\(title, member, reason: optional text\) by member or staff\n(?: {2}.*\n)+/;
  const r = run((p) => {
    const text = readFileSync(join(EXAMPLE, "ontology.md"), "utf8");
    p("ontology.md", text.match(cancel)[0], "\n");
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /ERROR · rows without a formal form \(1\):\n  action\.cancel-hold \(Hold\)\n/);
});

test("[check.formal-form.unknown-name] a field the entity does not have and a call to a form that does not exist are named", () => {
  const r = run((p) => {
    p("ontology.md", "derived.overdue(loan) = loan.returned-on = null and today > loan.due-date", "derived.overdue(loan) = loan.returned-on = null and today > loan.due");
    p("ontology.md", "and not concept.reservation(item)", "and not concept.booking(item)");
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /ERROR · names in formal forms that are not defined \(2\):/);
  assert.match(r.out, /derived\.available: concept\.booking/);
  assert.match(r.out, /derived\.overdue: loan\.due\n/);
});

test("[check.formal-form.out-of-order] a form out of the order of the rows, a form of another section and an unfolded block are named", () => {
  const r = run((p) => {
    p("ontology.md", "derived.overdue(loan) = loan.returned-on = null and today > loan.due-date\nrule.loan-period = 21 days", "rule.loan-period = 21 days\nderived.overdue(loan) = loan.returned-on = null and today > loan.due-date");
    p("ontology.md", "inv.one-loan-per-item\n", "inv.one-loan-per-item\n  refuse when false\nderived.queue-position(hold) = 1\n");
    p("ontology.md", '<details><summary>Behavior</summary>\n\n```behavior\nconcept.suspension', '```behavior\nconcept.suspension');
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /ERROR · formal forms that break the form of their block \(rule\.form-follows-rows\) \(3\):/);
  assert.match(r.out, /section Member: the behavior block at line \d+ is not folded in <details>/);
  assert.match(r.out, /section Item, line \d+: derived\.queue-position is not a row of this section/);
  assert.match(r.out, /section Loan, line \d+: derived\.overdue is out of the order of the rows/);
});

test("[check.trace.untraced] a check without a trace or a reason, and a trace of no check, are named", () => {
  const r = run((p) => {
    p("checks.md", "check.item.one-open-loan\n  given", "check.item.no-such-check\n  given");
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /ERROR · checks with no trace and no Not traced line \(1\):\n  check\.item\.one-open-loan\n/);
  assert.match(r.out, /ERROR · traces or Not traced lines that name no check of the catalogue \(1\):\n  check\.item\.no-such-check\n/);
});

test("[check.trace.untraced] a check with both a trace and a Not traced line is named", () => {
  const r = run((p) => {
    p("checks.md", "- Not traced: `check.hold.state-unreadable`", "- Not traced: `check.hold.cancel` — wrongly skipped.\n- Not traced: `check.hold.state-unreadable`");
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /ERROR · checks with both a trace and a Not traced line \(1\):\n  check\.hold\.cancel\n/);
});

test("[check.trace.fails] a trace whose THEN does not hold fails --run with the check and what differed", () => {
  const r = run((p) => p("checks.md", 'says "dune-1 is already on loan"', 'says "dune-2 is already on loan"'), "--run");
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /RUN check\.item\.one-open-loan · fail · .*says «dune-1 is already on loan», not «dune-2 is already on loan»/);
  assert.match(r.out, /RUN 29 passed · 1 failed · 10 not traced/);
});

test("[check.trace.fails] a refusal expected from another invariant than the one that refuses fails", () => {
  const r = run((p) => p("checks.md", "outcome refused by inv.one-loan-per-item", "outcome refused by inv.within-limit"), "--run");
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /RUN check\.item\.one-open-loan · fail · .*outcome 1 is refused by inv\.one-loan-per-item/);
});

test("[check.trace.fails] a changed form breaks the traces that depend on it", () => {
  const r = run((p) => p("ontology.md", "rule.loan-period = 21 days", "rule.loan-period = 20 days"), "--run");
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /RUN check\.loan\.due-in-21-days · fail/);
});

// The language itself, on a small schema.
const rows = [
  { id: "ent.loan", heading: "Loan", line: "| Entity | `ent.loan` | Loan | | x |", type: null },
  { id: "field.loan.due-date", heading: "Loan", line: "| Field | `field.loan.due-date` | Due | date | x |", type: "date" },
  { id: "edge.loan.item", heading: "Loan", line: "| Relation | `edge.loan.item` | Item | ref ent.item | x |", type: "ref ent.item" },
  { id: "ent.item", heading: "Item", line: "| Entity | `ent.item` | Item | | x |", type: null },
  { id: "edge.item.copy-of", heading: "Item", line: "| Relation | `edge.item.copy-of` | Copy | ref ent.title | x |", type: "ref ent.title" },
  { id: "ent.title", heading: "Title", line: "| Entity | `ent.title` | Title | | x |", type: null },
];
const schema = schemaOf(rows);

test("[check.formal-form.unchecked-name] an invariant no action names, one named only by another invariant, and a field set on a value that is not a record are named", () => {
  const r = run((p) => {
    p("ontology.md", "  refuse by inv.borrower-renews\n", "");
    p("ontology.md", "  refuse by inv.damaged-not-lent\n", "");
    p("ontology.md", '  says "{item} is already on loan"\n', '  says "{item} is already on loan"\n  refuse by inv.damaged-not-lent\n');
    p("ontology.md", 'refuse when item.condition = "damaged"', 'refuse when item.state = "damaged"');
    p("ontology.md", "  set member.borrow-limit = limit", "  let n = 1\n  set n.ghost = limit\n  set member.borrow-limit = limit");
    p("ontology.md", '  says "{item} is damaged and is not lent until repaired"\n', '  says "{item} is damaged and is not lent until repaired"\n  each i in items:\n    always false\n');
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /inv\.borrower-renews: no action or hook names it, so its names are not checked/);
  assert.match(r.out, /inv\.damaged-not-lent: item\.state/);
  assert.match(r.out, /action\.set-borrow-limit: set ghost on a value that has no fields/);
  assert.match(r.out, /inv\.damaged-not-lent: always holds only at the top of an invariant/);
});

test("[check.formal-form.cycle] a derived value and a rule that read themselves are named with the forms they go through", () => {
  const r = run((p) => {
    p("ontology.md", "derived.overdue(loan) = loan.returned-on = null and today > loan.due-date", "derived.overdue(loan) = loan.returned-on = null and derived.overdue(loan)");
    p("ontology.md", "rule.loan-period = 21 days", "rule.loan-period = rule.loan-period");
    p("ontology.md", '  says "{item} is already on loan"\n', '  says "{item} is already on loan"\n  refuse by inv.one-loan-per-item\n');
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /derived\.overdue: depends on itself through derived\.overdue → derived\.overdue/);
  assert.match(r.out, /rule\.loan-period: depends on itself through rule\.loan-period → rule\.loan-period/);
  assert.match(r.out, /inv\.one-loan-per-item: depends on itself through inv\.one-loan-per-item → inv\.one-loan-per-item/);
});

test("[check.formal-form.write-out-of-type] a write below an integer's range and one outside a one-of list stop the run with the form, the field and its type", () => {
  const low = run((p) => p("ontology.md", "  set member.borrow-limit = limit", "  set member.borrow-limit = limit - 3"), "--run");
  assert.equal(low.code, 1, low.out);
  assert.match(low.out, /action\.set-borrow-limit writes 0 to field\.member\.borrow-limit, outside its type integer 1\.\./);
  const odd = run((p) => p("ontology.md", "    set item.condition = condition", '    set item.condition = "broken"'), "--run");
  assert.equal(odd.code, 1, odd.out);
  assert.match(odd.out, /action\.return writes "broken" to field\.item\.condition, outside its type one of good, worn, damaged/);
  const text = run((p) => p("ontology.md", "  set loan.returned-on = today", '  set loan.returned-on = "banana"'), "--run");
  assert.equal(text.code, 1, text.out);
  assert.match(text.out, /action\.return writes "banana" to field\.loan\.returned-on, outside its type date optional/);
  const day = run((p) => p("ontology.md", "  set loan.returned-on = today", '  set loan.returned-on = "2026-02-30"'), "--run");
  assert.equal(day.code, 1, day.out);
  assert.match(day.out, /action\.return writes "2026-02-30" to field\.loan\.returned-on, outside its type date optional/);
  for (const at of ["2026-10-01T00:00:00+99:99", "2026-10-01T00:00:00+00:60"]) {
    const zone = run((p) => p("ontology.md", "placed-at = now", `placed-at = "${at}"`), "--run");
    assert.equal(zone.code, 1, zone.out);
    assert.match(zone.out, new RegExp(`action\\.place-hold writes "${at.replace(/\+/g, "\\+")}" to field\\.hold\\.placed-at, outside its type datetime`));
  }
  const other = run((p) => p("ontology.md", "item = item, member = member", "item = item, member = item"), "--run");
  assert.equal(other.code, 1, other.out);
  assert.match(other.out, /action\.checkout writes "[a-z]+-\d+" to edge\.loan\.member, outside its type ref ent\.member/);
});

test("[check.formal-form.unknown-name] names are typed by entity: a relation leads on, a loop variable is seen only inside its loop", () => {
  const ok = names(parse("loan.item.copy-of = loan.item.copy-of and some i in items where i.copy-of = loan.item.copy-of"), { schema, scope: { loan: "loan" }, forms: new Map() });
  assert.deepEqual(ok.bad, []);
  const bad = names(parse("loan.item.due-date = null or (some i in items where true) and i.copy-of = null"), { schema, scope: { loan: "loan" }, forms: new Map() });
  assert.deepEqual(bad.bad, ["item.due-date", "i"]);
});

test("the language computes dates across a month, compares an object with its id, and ends every expression", () => {
  const state = { loans: [{ id: "l1", item: "i1", "due-date": "2026-01-30" }], items: [{ id: "i1", "copy-of": "T" }], titles: [{ id: "T" }] };
  const byId = new Map([...state.loans, ...state.items, ...state.titles].map((o) => [o.id, o]));
  const ctx = { state, byId, today: "2026-01-30" };
  assert.equal(evaluate(parse("today + 3 days"), ctx, {}), "2026-02-02");
  assert.equal(evaluate(parse("some l in loans where l.item = the item \"i1\""), { ...ctx, byId }, {}), true);
  assert.equal(evaluate(parse("(first l in loans where true by l.due-date).item.copy-of"), ctx, {}), "T");
  assert.equal(evaluate(parse("count(l in loans where l.due-date > today)"), ctx, {}), 0);
});

test("[check.trace.untraced] a trace replaced by a Not traced line is refused when the oracle can run the check", () => {
  const trace = /\ncheck\.item\.one-open-loan\n(?: {2}.*\n)+/;
  const r = run((p) => {
    const text = readFileSync(join(EXAMPLE, "checks.md"), "utf8");
    p("checks.md", text.match(trace)[0], "\n");
    p("checks.md", "- Not traced: `check.hold.state-unreadable`", "- Not traced: `check.item.one-open-loan` — skipped for now.\n- Not traced: `check.hold.state-unreadable`");
  }, "--run");
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /ERROR · checks on a Not traced line that the oracle can run \([^)]*\) \(1\):\n  check\.item\.one-open-loan\n/);
});

for (const id of ["check.loan.overdue-after-due", "check.loan.return-closes-loan", "check.hold.position-shown"]) {
  test(`[check.trace.untraced] ${id} names a view but sits under its entity: its trace cannot be replaced by a Not traced line`, () => {
    const trace = new RegExp(`\\n${id.replace(/\./g, "\\.")}\\n(?: {2}.*\\n)+`);
    const r = run((p) => {
      const text = readFileSync(join(EXAMPLE, "checks.md"), "utf8");
      p("checks.md", text.match(trace)[0], "\n");
      p("checks.md", "- Not traced: `check.hold.state-unreadable`", `- Not traced: \`${id}\` — it names a view.\n- Not traced: \`check.hold.state-unreadable\``);
    }, "--run");
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, new RegExp(`ERROR · checks on a Not traced line that the oracle can run \\([^)]*\\) \\(1\\):\\n  ${id.replace(/\./g, "\\.")}\\n`));
  });
}

test("[check.trace.fails] a reminder sent a day late, or with another text, fails the trace of the reminder", () => {
  const late = run((p) => p("ontology.md", "today = l.due-date - 2 days", "today = l.due-date - 1 days"), "--run");
  assert.equal(late.code, 1, late.out);
  assert.match(late.out, /RUN check\.loan\.due-reminder · fail · .*ana was not notified by hook\.due-reminder on 2026-10-20/);
  const text = run((p) => {
    p("ontology.md", 'notify l.member "{l.item} is due on {l.due-date}"', 'notify l.member "unrelated message"');
    p("ontology.md", 'notify head.member "{item} is waiting for you until {today + rule.pickup-window}"', 'notify head.member "unrelated message"');
  }, "--run");
  assert.equal(text.code, 1, text.out);
  assert.match(text.out, /RUN check\.loan\.due-reminder · fail/);
  assert.match(text.out, /RUN check\.hold\.reserve-on-return · fail/);
});

test("the oracle logs every step with its actor and day, refused or not", () => {
  const md = readFileSync(join(EXAMPLE, "ontology.md"), "utf8");
  const { rows } = parseGlossary(md);
  const sample = readTraces(readFileSync(join(EXAMPLE, "checks.md"), "utf8")).sample;
  const o = new Oracle(rows, readForms(md, rows), sample);
  o.advance("2026-10-01");
  o.act("action.checkout", { item: "dune-1", member: "ana" }, "staff");
  o.act("action.checkout", { item: "dune-1", member: "ben" }, "staff");
  o.advance("2026-10-02");
  assert.deepEqual(o.log.map((e) => [e.day, e.actor, e.step, e.outcome ?? "", e.by ?? ""]), [
    ["2026-10-01", "staff", "action.checkout", "ok", ""],
    ["2026-10-01", "staff", "action.checkout", "refused", "inv.one-loan-per-item"],
    ["2026-10-02", "system", "day", "", ""],
  ]);
});
