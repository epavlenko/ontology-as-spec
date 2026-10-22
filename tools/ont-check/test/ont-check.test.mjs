import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const TOOLS = fileURLToPath(new URL("../", import.meta.url));
const EXAMPLE = fileURLToPath(new URL("../../../example/", import.meta.url));

// Each case copies the example, breaks one thing and expects the check to name exactly that.
const run = (edit, ...args) => {
  const dir = mkdtempSync(join(tmpdir(), "ont-check-"));
  try {
    cpSync(EXAMPLE, dir, { recursive: true });
    const patch = (file, from, to) => {
      const path = join(dir, file);
      const text = readFileSync(path, "utf8");
      assert.ok(text.includes(from), `fixture text not found in ${file}: ${from}`);
      writeFileSync(path, text.replace(from, to));
    };
    edit?.(patch, dir);
    const r = spawnSync(
      "node",
      [join(TOOLS, "ont-check.mjs"), "--config", join(dir, "ont.config.json"), ...args.map((a) => a.replace("$DIR", dir))],
      { encoding: "utf8" },
    );
    return { code: r.status, out: r.stdout + r.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("the example is consistent", () => {
  const r = run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /ONT_OK/);
});

test("lists a concept with no mockup element, ticket or code as information", () => {
  const r = run((p) => p("ontology.md", "| `edge.item.copy-of`     | `app/library.mjs` |                  |\n", ""));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /info · concepts with no mockup element, ticket or implementation yet \(1\):\n  edge\.item\.copy-of/);
});

test("accepts the older single tests key as one unnamed suite", () => {
  const r = run((p) =>
    p(
      "ont.config.json",
      /"testSuites": \[[\s\S]*?\n  \],/.exec(readFileSync(join(EXAMPLE, "ont.config.json"), "utf8"))[0],
      '"tests": { "dir": ".", "match": "\\\\.test\\\\.mjs$", "cover": ["inv", "rule", "derived", "action"] },',
    ),
  );
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, / tested \d+ /);
});

test("--gap with a ticket reports the open slice and exits 1", () => {
  const r = run(null, "--gap", "$DIR/issues/0003-serve-the-hold-queue.md");
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /concept\.reservation {2}target · checks: check\.hold\.reserve-on-return/);
  assert.match(r.out, /SLICE_OPEN: 6/);
  assert.match(r.out, /ONT_OK/);
});

test("--gap with a ticket whose slice is built prints SLICE_DONE", () => {
  const r = run(
    (p, dir) =>
      writeFileSync(
        join(dir, "issues", "0001-renewal.md"),
        "# #1 Renewal\n\n## Slice\n\nIDs: `action.renew`, `inv.no-renew-when-held`.\n\nChecks: `check.loan.renew-while-held`.\n",
      ),
    "--gap",
    "$DIR/issues/0001-renewal.md",
  );
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /GAP · nothing open\nSLICE_DONE/);
});

test("still reads the older verification map", () => {
  const r = run((p, dir) => {
    mkdirSync(join(dir, "features"));
    writeFileSync(join(dir, "features", "loans.md"), "# Loans\n\nNo IDs line here.\n");
    p("ont.config.json", '"checks": {', '"features": { "dir": "features", "cover": [] },\n  "checks": {');
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /scenario files without an `IDs:` line/);
});

test("lists an entry that supersedes only part of another as information", () => {
  const r = run((p) =>
    p(
      "decisions.md",
      "## Tentative",
      "### D-07 · Renewal shown with its count\n\n- Date: 2026-10-22 · Status: accepted\n- Decision: supersedes the button part of D-04.\n\n## Tentative",
    ),
  );
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /info · entries that supersede only part of another[^\n]*\n {2}D-07 → D-04/);
});

test("a changed definition marks the sections to reread, and stamping clears it", () => {
  const dir = mkdtempSync(join(tmpdir(), "ont-docs-"));
  try {
    cpSync(EXAMPLE, dir, { recursive: true });
    const cfg = join(dir, "ont.config.json");
    const node = (script, ...args) =>
      spawnSync("node", [join(TOOLS, script), "--config", cfg, ...args], { encoding: "utf8" });
    const onto = join(dir, "ontology.md");
    writeFileSync(onto, readFileSync(onto, "utf8").replace("Close the loan and record the item's condition.", "Close the loan, record the item's condition and serve the queue."));
    for (const g of ["gen-glossary.mjs", "gen-reference.mjs", "gen-contracts.mjs"]) node(g);
    const before = node("ont-check.mjs");
    assert.equal(before.status, 0, before.stdout);
    assert.match(before.stdout, /help docs sections anchored to a definition changed since review[^\n]*\n {2}help\/borrowing\.md: action\.return/);
    node("stamp-docs.mjs");
    const after = node("ont-check.mjs");
    assert.equal(after.status, 0, after.stdout);
    assert.doesNotMatch(after.stdout, /changed since review/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const cases = [
  ["an ID in the ontology text missing from the glossary", "IDs in the ontology text but not in the glossary",
    (p) => p("ontology.md", "- `concept.suspension` starts", "- `concept.suspended` starts")],
  ["a hand edit of the generated glossary", "generated glossary differs",
    (p) => p("mockup/ontology.js", "\"Member\"", "\"Patron\"")],
  ["a data-ont with an unknown ID", "data-ont in the mockup but not in the glossary",
    (p) => p("mockup/index.html", 'data-ont="view.desk"', 'data-ont="view.counter"')],
  ["a mockup element missing from the map", "data-ont in the mockup but not in the map",
    (p) => p("mockup/ontology-map.md", "| `field.member.borrow-limit`   |", "|                               |")],
  ["a map row for an element the mockup lost", "IDs in the map but not in the mockup",
    (p) => p("mockup/index.html", 'data-ont="hook.due-reminder"', "")],
  ["a decision reference without an entry", "decision references without an entry",
    (p) => p("ontology.md", "(D-03)", "(D-09)")],
  ["a duplicated decision entry", "duplicate entries in the decision log",
    (p) => p("decisions.md", "### D-02 ·", "### D-01 ·")],
  ["an unknown ID in the decision log", "IDs in the decision log but not in the glossary",
    (p) => p("decisions.md", "`field.due-date`, `action.checkout`", "`field.due-on`, `action.checkout`")],
  ["a missing implementation file", "files from the implementation table not found",
    (p) => p("ontology.md", "| `action.checkout`        | `app/cli.mjs` ", "| `action.checkout`        | `app/desk.mjs`")],
  ["a dynamic class without a template", "class declared dynamic but the mockup has no data-ont template",
    (p) => p("mockup/index.html", 'data-ont="derived.${s}"', 'data-ont="derived.overdue"')],
  ["a glossary row nobody refers to", "glossary concepts nobody refers to",
    (p) => p("ontology.md", "\n\n- `view.catalog` shows", "\n|      | `view.history`      | History    | Past loans of a member. |\n\n- `view.catalog` shows")],
  ["definition rows out of kind order", "definition rows out of kind order",
    (p) => p("ontology.md", "| Hook      | `hook.due-reminder`  ", "| Rule      | `rule.due-reminder`  ")],
  ["a Kind cell that names the wrong kind", "Kind cells that do not match the row's class",
    (p) => p("ontology.md", "| Rule      | `rule.loan-period`", "| Rules     | `rule.loan-period`")],
  ["a field in another entity's table", "fields or relations outside their entity's table",
    (p) => p("ontology.md", "| Field     | `field.member.borrow-limit`", "| Field     | `field.loan.borrow-limit`")],
  ["a field without a type", "types that cannot become a contract",
    (p) => p("ontology.md", "| date             |", "|                  |")],
  ["a type outside the vocabulary", "types that cannot become a contract",
    (p) => p("ontology.md", "| integer 0..2     |", "| int 0..2         |")],
  ["a reference to something that is not an entity", "types that cannot become a contract",
    (p) => p("ontology.md", "| ref `ent.item`   |", "| ref `ent.items`  |")],
  ["a hand edit of the generated contracts", "generated contracts differ",
    (p) => p("contracts/ontology.schema.json", '"maximum": 2', '"maximum": 3')],
  ["a contract the ontology changed under", "generated contracts differ",
    (p) => p("ontology.md", "| integer 0..2     |", "| integer 0..3     |")],
  ["a retired ID used in the mockup", "retired IDs still in use outside the decision log",
    (p) => p("mockup/index.html", 'data-ont="field.loan.due-date"', 'data-ont="field.due-date"')],
  ["a retired ID that is still defined", "retired IDs still defined in the glossary",
    (p) => p("ontology.md", "| `edge.copy-of`         |", "| `edge.item.copy-of`    |")],
  ["an implemented invariant no test names", "implemented concepts without a test in the unit suite",
    (p) => p("app/library.test.mjs", "[check.item.one-open-loan] ", "")],
  ["a test tag with an unknown ID", "IDs in unit tests but not in the glossary",
    (p) => p("app/library.test.mjs", "[field.loan.renewals, field.member.borrow-limit]", "[field.loan.renewal-count]")],
  ["a test that proves a concept the table does not list", "IDs in unit tests but not in the implementation table",
    (p) => p("app/library.test.mjs", "[field.loan.renewals, field.member.borrow-limit]", "[field.loan.renewals, field.item.condition]")],
  ["an implemented action with no end-to-end test", "implemented concepts without a test in the end-to-end suite",
    (p) => p("e2e/cli.test.mjs", "[check.loan.renew-while-held] ", "")],
  ["two test suites with the same name", "test suites with the same name",
    (p) => p("ont.config.json", '"name": "end-to-end"', '"name": "unit"')],
  ["a test suite whose directory has no tests", "no end-to-end test files found",
    (p) => p("ont.config.json", '"dir": "e2e"', '"dir": "e2e-missing"')],
  ["a check listed twice", "duplicate checks in the catalogue",
    (p) => p("checks.md", "| `check.hold.cancel`", "| `check.hold.cancel` | `action.cancel-hold` | a | b | c | auto |\n| `check.hold.cancel`")],
  ["a check under another entity's section", "checks outside their section",
    (p) => p("checks.md", "| `check.hold.cancel`  ", "| `check.loan.cancel`  ")],
  ["a check without a valid proof", "malformed checks",
    (p, dir) => {
      const f = join(dir, "checks.md");
      writeFileSync(f, readFileSync(f, "utf8").replace(/(`check\.hold\.cancel`[^\n]*\| )auto( *\|)/, "$1maybe$2"));
    }],
  ["a check naming an unknown concept", "IDs in the check catalogue but not in the glossary",
    (p) => p("checks.md", "`inv.queue-order`  ", "`inv.queue-orders` ")],
  ["an invariant without a check", "concepts without a check",
    (p) => p("checks.md", "`inv.queue-order`  ", "`derived.available`")],
  ["an automatic check of implemented concepts without a test", "automatic checks of implemented concepts without a test",
    (p) => p("app/library.test.mjs", "[check.loan.renew-twice] ", "[rule.renewal] ")],
  ["a test tag naming a check not in the catalogue", "checks in unit tests but not in the catalogue",
    (p) => p("app/library.test.mjs", "[check.loan.renew-twice]", "[check.loan.renew-thrice]")],
  ["a test implementing a manual check", "manual checks tagged in end-to-end tests",
    (p) => p("e2e/cli.test.mjs", "[check.loan.return-closes-loan]", "[check.loan.return-closes-loan, check.loan.overdue-in-real-time]")],
  ["a test implementing a check of concepts not built", "checks in unit tests whose concepts are not all implemented",
    (p) => p("app/library.test.mjs", "[check.loan.renew-twice]", "[check.loan.renew-twice, check.hold.cancel]")],
  ["a ticket listing a check not in the catalogue", "checks in tickets but not in the catalogue",
    (p) => p("issues/0003-serve-the-hold-queue.md", "`check.hold.served-in-order`", "`check.hold.served-first`")],
  ["a ticket listing a check that names none of its IDs", "ticket checks that name none of the ticket's IDs",
    (p) => p("issues/0003-serve-the-hold-queue.md", "`check.hold.served-in-order`", "`check.loan.renew-twice`")],
  ["an older ticket scenario without THEN", "ticket scenarios without an ID tag or GIVEN … WHEN … THEN",
    (p) => p("issues/0003-serve-the-hold-queue.md", "## Out of scope", "## Scenarios\n\n- [inv.queue-order] GIVEN two holds WHEN a copy comes back\n\n## Out of scope")],
  ["a doc anchor naming an unknown concept", "IDs in help docs anchors but not in the glossary",
    (p) => p("help/holds.md", "<!-- ont: action.place-hold@", "<!-- ont: action.place-holds, action.place-hold@")],
  ["a doc anchor that is not an ID", "anchors in help docs that are not IDs",
    (p) => p("help/holds.md", "<!-- ont: action.place-hold@", "<!-- ont: Place hold, action.place-hold@")],
  ["an implemented action the help does not explain", "implemented concepts the help docs do not explain",
    (p) => p("help/borrowing.md", "<!-- ont: action.return@", "<!-- ont: ent.loan@")],
  ["a retired ID in a doc anchor", "retired IDs still in use outside the decision log",
    (p) => p("help/borrowing.md", "field.loan.due-date@", "field.due-date@")],
  ["a hand edit of a generated reference page", "generated reference differs",
    (p) => p("help/terms.md", "Every word the library app uses", "Every term the library app uses")],
];

for (const [name, label, edit] of cases)
  test(`fails on ${name}`, () => {
    const r = run(edit);
    assert.equal(r.code, 1, r.out);
    assert.ok(r.out.includes(label), `expected "${label}" in:\n${r.out}`);
  });
