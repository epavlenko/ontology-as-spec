import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
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

test("[check.concept.untried] lists a concept with no mockup element, ticket or code as information", () => {
  const r = run((p) => p("ontology.md", "| `edge.item.copy-of`     | `app/library.mjs` |                                           |\n", ""));
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

test("[check.check.section-key] a section heading in another language carries its key in a code span", () => {
  const rename = (p, dir) => {
    p("ontology.md", "\n## Loan\n", "\n## Préstamo `loan`\n");
    p("checks.md", "\n## Loan\n", "\n## Préstamo `loan`\n");
    spawnSync("node", [join(TOOLS, "gen-reference.mjs"), "--config", join(dir, "ont.config.json")]);
  };
  const ok = run(rename);
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, /ONT_OK/);
  const gap = run((p, dir) => {
    rename(p, dir);
    p("app/library.test.mjs", "[check.loan.renew-twice] ", "[rule.renewal] ");
  }, "--gap");
  assert.doesNotMatch(gap.out, /checks outside their section/);
  assert.match(gap.out, /GAP · Préstamo `loan`\n(?:  .*\n)*?  check\.loan\.renew-twice  no test yet/);
});

test("[check.check.section-key-unmatched] --gap still counts a waiting check whose key names no ontology section", () => {
  const r = run(
    (p, dir) => {
      p("ontology.md", "\n## Hold\n", "\n## Reserva\n");
      p("checks.md", "\n## Hold\n", "\n## Reserva `hold`\n");
      writeFileSync(
        join(dir, "issues", "0005-reserved-items-at-the-desk.md"),
        "# #5 Reserved items at the desk\n\n## Slice\n\nIDs: `action.checkout`.\n\nChecks: `check.hold.reserved-for-holder-only`.\n",
      );
    },
    "--gap",
    "$DIR/issues/0005-reserved-items-at-the-desk.md",
  );
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /GAP · checks under no ontology section\n {2}check\.hold\.reserved-for-holder-only {2}waits for concept\.reservation/);
  assert.match(r.out, /SLICE_OPEN: 1/);
});

test("[check.ticket.slice-open] --gap with a ticket reports the open slice and exits 1", () => {
  const r = run(null, "--gap", "$DIR/issues/0003-serve-the-hold-queue.md");
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /concept\.reservation {2}target · checks: check\.hold\.reserve-on-return/);
  assert.match(r.out, /GAP · known divergences\n {2}- \*\*Hold\.\*\*/);
  assert.match(r.out, /SLICE_OPEN: 7/);
  assert.match(r.out, /ONT_OK/);
});

test("[check.ticket.slice-open] --gap exits 1 for an open slice whatever the ticket file is called", () => {
  const r = run(
    (p, dir) => {
      renameSync(join(dir, "issues", "0003-serve-the-hold-queue.md"), join(dir, "issues", "0003-serve-the-hold-queue.txt"));
      p("ont.config.json", '"dir": "issues"', '"dir": "issues", "match": "\\\\.(md|txt)$"');
    },
    "--gap",
    "$DIR/issues/0003-serve-the-hold-queue.txt",
  );
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /SLICE_OPEN: 7/);
});

// A ticket for two concepts the example has built and tested, and a line to add under its known
// divergences: the cases of a slice that is done apart from one thing.
const renewal = (more = "") => (p, dir) =>
  writeFileSync(
    join(dir, "issues", "0001-renewal.md"),
    `# #1 Renewal\n\n## Slice\n\nIDs: \`action.renew\`, \`inv.no-renew-when-held\`.\n\nChecks: \`check.loan.renew-while-held\`.\n${more}`,
  );
const divergence = (line) => (p) =>
  p("ontology.md", "a new decision if the target changed.\n", `a new decision if the target changed.\n\n- ${line}`);

test("[check.ticket.slice-done] --gap with a ticket whose slice is built prints SLICE_DONE", () => {
  const r = run(renewal(), "--gap", "$DIR/issues/0001-renewal.md");
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /GAP · nothing open\nSLICE_DONE/);
});

test("[check.ticket.own-divergence] a divergence that names only the slice's concepts keeps the ticket open", () => {
  const r = run(
    (p, dir) => {
      renewal()(p, dir);
      divergence("**Loan.** The desk can renew a loan while someone waits (`action.renew`, `inv.no-renew-when-held`).")(p);
    },
    "--gap",
    "$DIR/issues/0001-renewal.md",
  );
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /GAP · known divergences\n {2}- \*\*Loan\.\*\* The desk can renew/);
  assert.match(r.out, /SLICE_OPEN: 1/);
});

test("[check.ticket.shared-divergence] a divergence that also names a concept outside the slice is shown apart, not counted", () => {
  const r = run(
    (p, dir) => {
      renewal()(p, dir);
      divergence("**Loan.** Renewal ignores holds placed at the desk (`action.renew`, `action.place-hold`).")(p);
    },
    "--gap",
    "$DIR/issues/0001-renewal.md",
  );
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /GAP · known divergences partly outside the slice \(not counted\)\n {2}- \*\*Loan\.\*\* Renewal ignores/);
  assert.doesNotMatch(r.out, /GAP · known divergences\n/);
  assert.match(r.out, /SLICE_DONE/);
});

test("[check.ticket.check-waits] a listed check that needs a concept of another slice keeps the ticket open", () => {
  const r = run(
    (p, dir) =>
      writeFileSync(
        join(dir, "issues", "0005-reserved-items-at-the-desk.md"),
        "# #5 Reserved items at the desk\n\n## Slice\n\nIDs: `action.checkout`.\n\nChecks: `check.hold.reserved-for-holder-only`.\n",
      ),
    "--gap",
    "$DIR/issues/0005-reserved-items-at-the-desk.md",
  );
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /GAP · Hold\n {2}check\.hold\.reserved-for-holder-only {2}waits for concept\.reservation/);
  assert.match(r.out, /SLICE_OPEN: 1/);
});

test("[check.ticket.checks-line-only] a check named outside the Checks line is not part of the slice", () => {
  const r = run(renewal("\n## Out of scope\n\n`check.hold.cancel` comes with a later slice.\n"), "--gap", "$DIR/issues/0001-renewal.md");
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /check\.hold\.cancel/);
  assert.match(r.out, /GAP · nothing open\nSLICE_DONE/);
});

test("reads the known divergences under the heading the config names", () => {
  const r = run(
    (p) => {
      p("ontology.md", "### Known divergences between code and ontology", "### Where the code contradicts the target");
      p("ont.config.json", '"retired": "## Retired IDs"', '"retired": "## Retired IDs",\n    "divergences": "### Where the code contradicts"');
    },
    "--gap",
    "$DIR/issues/0004-suspend-instead-of-fines.md",
  );
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /GAP · known divergences\n {2}- \*\*Member\.\*\*/);
  assert.match(r.out, /SLICE_OPEN: 3/);
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

// A new accepted entry for the example's log, inserted before its Tentative section.
const entry = (n, lines) =>
  `### D-${n} · Entry ${n}\n\n- Date: 2026-10-22 · Status: accepted\n${lines.map((l) => `- ${l}\n`).join("")}\n## Tentative`;

test("[check.decision.partial-supersession] lists an entry that replaces only part of another as information", () => {
  const r = run((p) =>
    p("decisions.md", "## Tentative", `${entry("07", ["Decision: supersedes the button part of D-04."])}\n\n${entry("08", ["Decision: D-02 no longer applies to holds on items."]).replace("\n\n## Tentative", "")}`),
  );
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /info · entries replaced only in part and not yet superseded whole[^\n]*\n {2}D-07 → D-04\n {2}D-08 → D-02/);
});

test("[check.decision.partial-supersession] an entry superseded whole leaves the list of partial replacements", () => {
  const r = run((p) =>
    p("decisions.md", "## Tentative", `${entry("07", ["Decision: supersedes the button part of D-04."])}\n\n${entry("08", ["Supersedes: D-04", "Decision: renewal is shown differently."]).replace("\n\n## Tentative", "")}`),
  );
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /entries replaced only in part/);
});

test("[check.decision.named-by] --decisions names the later entries that mention an entry", () => {
  const r = run((p) => p("decisions.md", "## Tentative", entry("07", ["Decision: adds a second reminder to the rule of D-04."])), "--decisions");
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /\| D-04 +\| Renewal is refused while someone waits, and the member sees why +\| in force +\| D-07 +\|/);
  // The last entry ends at the next heading: the history after it, which lists D-01…D-05, names nothing.
  assert.match(r.out, /\| D-01 +\| A loan is 21 days with a fixed rule, not a per-title setting +\| in force +\| +\|/);
});

test("[check.implementation-row.grouped] concepts realised in the same files may share an implementation row", () => {
  const r = run((p) =>
    p(
      "ontology.md",
      "| `edge.loan.item`         | `app/library.mjs` |                                                   |\n| `edge.loan.member`       | `app/library.mjs` |                                                   |\n",
      "| `edge.loan.item`, `edge.loan.member` | `app/library.mjs` | |\n",
    ),
  );
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, / implemented 25 /);
});

test("[check.concept.formatted] format-ontology.mjs writes the kind order and the Kind cells", () => {
  const dir = mkdtempSync(join(tmpdir(), "ont-format-"));
  try {
    cpSync(EXAMPLE, dir, { recursive: true });
    const cfg = join(dir, "ont.config.json");
    const node = (script) => spawnSync("node", [join(TOOLS, script), "--config", cfg], { encoding: "utf8" });
    const onto = join(dir, "ontology.md");
    const invariant = "| Invariant | `inv.no-renew-when-held` | No renewal when held |                  | A loan cannot be renewed while someone waits for the title.                        |\n";
    const hook = "| Hook      | `hook.due-reminder`      | Due reminder         |                  | Two days before the due date the member is notified once, with renew if allowed.   |\n";
    const text = readFileSync(onto, "utf8");
    assert.ok(text.includes(invariant + hook), "fixture rows not found");
    writeFileSync(
      onto,
      text
        .replace(invariant + hook, hook + invariant)
        .replace("|           | `field.loan.renewals`", "| Field     | `field.loan.renewals`"),
    );
    const broken = node("ont-check.mjs");
    assert.equal(broken.status, 1, broken.stdout);
    assert.match(broken.stdout, /definition rows out of kind order \(run format-ontology\.mjs\)/);
    assert.match(node("format-ontology.mjs").stdout, /formatted, 2 rows moved into kind order/);
    assert.equal(readFileSync(onto, "utf8"), text);
    const fixed = node("ont-check.mjs");
    assert.equal(fixed.status, 0, fixed.stdout);
    assert.match(node("format-ontology.mjs").stdout, /already formatted/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("[check.decision.in-force-report] --decisions lists each entry as in force, tentative or superseded", () => {
  const r = run((p) => p("decisions.md", "## Tentative", entry("07", ["Supersedes: D-04", "Decision: renewal is shown differently."])), "--decisions");
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /\| D-04 +\| Renewal is refused while someone waits, and the member sees why +\| superseded by D-07 +\|/);
  assert.match(r.out, /\| D-05 +\| A reserved item waits three days +\| tentative +\|/);
  assert.match(r.out, /\| D-07 +\| Entry 07 +\| in force +\|/);
});

test("[check.decision.waiting-listed] lists a tentative entry as waiting for the owner's answer", () => {
  const r = run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /info · tentative entries, waiting for the owner's answer \(1\):\n {2}D-05 · A reserved item waits three days\n/);
  const accepted = run((p) => p("decisions.md", "Status: tentative", "Status: accepted"));
  assert.equal(accepted.code, 0, accepted.out);
  assert.doesNotMatch(accepted.out, /waiting for the owner's answer/);
});

test("[check.decision.deferrals-listed] lists the deferrals in force with their conditions", () => {
  const e = (n, lines) => entry(n, lines).replace("\n\n## Tentative", "");
  const r = run((p) =>
    p(
      "decisions.md",
      "## Tentative",
      [
        e("07", ["Return when: a second branch opens", "Decision: one branch for now."]),
        e("08", ["Return when: members ask for text messages", "Decision: reminders by e-mail only."]),
        e("09", ["Supersedes: D-08", "Decision: reminders by e-mail and text message."]),
        e("10", ["Return when: a third branch opens", "Decision: no mobile app."]).replace("Status: accepted", "Status: tentative"),
        "## Tentative",
      ].join("\n\n"),
    ),
  );
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /info · deferrals in force, each with the condition for taking it up again \(1\):\n {2}D-07: a second branch opens\n/);
  // A tentative deferral is not in force: it waits with the other tentative entries.
  assert.match(r.out, /waiting for the owner's answer \(2\):\n {2}D-10 · Entry 10\n {2}D-05 · /);
});

test("[check.doc-section.reread-after-change] a changed definition marks the sections to reread, and stamping clears it", () => {
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

test("anchors inside code are examples, not anchors", () => {
  const r = run((p) =>
    p("help/holds.md", "# Waiting for a title\n", "# Waiting for a title\n\n```markdown\n<!-- ont: action.unknown -->\n```\n\nAn inline `<!-- ont: action.unknown -->` too.\n"),
  );
  assert.equal(r.code, 0, r.out);
});

test("[check.doc-section.reread-after-note-change] a changed note marks the sections that rely on it", () => {
  const r = run((p) =>
    p("ontology.md", "- `action.return` triggers `hook.hold-ready` when someone waits for the title.", "- `action.return` triggers `hook.hold-ready` when someone waits for the title, and prints who it is for."),
  );
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /help docs sections anchored to a definition changed since review[^\n]*\n {2}help\/borrowing\.md: action\.return/);
});

const cases = [
  ["[check.concept.unknown-id] an ID in the ontology text missing from the glossary", "IDs in the ontology text but not in the glossary",
    (p) => p("ontology.md", "- `concept.suspension` starts", "- `concept.suspended` starts")],
  ["[check.mockup-element.tooltips-stale] a hand edit of the generated glossary", "generated glossary differs",
    (p) => p("mockup/ontology.js", "\"Member\"", "\"Patron\"")],
  ["[check.concept.unknown-id] a data-ont with an unknown ID", "data-ont in the mockup but not in the glossary",
    (p) => p("mockup/index.html", 'data-ont="view.desk"', 'data-ont="view.counter"')],
  ["[check.mockup-element.map-and-mockup-differ] a mockup element missing from the map", "data-ont in the mockup but not in the map",
    (p) => p("mockup/ontology-map.md", "| `field.member.borrow-limit`   |", "|                               |")],
  ["[check.mockup-element.map-and-mockup-differ] a map row for an element the mockup lost", "IDs in the map but not in the mockup",
    (p) => p("mockup/index.html", 'data-ont="hook.due-reminder"', "")],
  ["[check.decision.unknown-reference] a decision reference without an entry", "decision references without an entry",
    (p) => p("ontology.md", "(D-03)", "(D-09)")],
  ["[check.decision.duplicate-number] a duplicated decision entry", "duplicate entries in the decision log",
    (p) => p("decisions.md", "### D-02 ·", "### D-01 ·")],
  ["[check.concept.unknown-id] an unknown ID in the decision log", "IDs in the decision log but not in the glossary",
    (p) => p("decisions.md", "`field.due-date`, `action.checkout`", "`field.due-on`, `action.checkout`")],
  ["[check.implementation-row.missing-file] a missing implementation file", "files from the implementation table not found",
    (p) => p("ontology.md", "| `action.checkout`        | `app/cli.mjs` ", "| `action.checkout`        | `app/desk.mjs`")],
  ["[check.mockup-element.dynamic-without-template] a dynamic class without a template", "class declared dynamic but the mockup has no data-ont template",
    (p) => p("mockup/index.html", 'data-ont="derived.${s}"', 'data-ont="derived.overdue"')],
  ["[check.concept.dead-row] a glossary row nobody refers to", "glossary concepts nobody refers to",
    (p) => p("ontology.md", "\n\n- `view.catalog` shows", "\n|      | `view.history`      | History    | Past loans of a member. |\n\n- `view.catalog` shows")],
  ["[check.concept.out-of-order] definition rows out of kind order", "definition rows out of kind order",
    (p) => p("ontology.md", "| Hook      | `hook.due-reminder`  ", "| Rule      | `rule.due-reminder`  ")],
  ["[check.concept.wrong-kind-label] a Kind cell that names the wrong kind", "Kind cells that do not match the row's class",
    (p) => p("ontology.md", "| Rule      | `rule.loan-period`", "| Rules     | `rule.loan-period`")],
  ["[check.concept.field-elsewhere] a field in another entity's table", "fields or relations outside their entity's table",
    (p) => p("ontology.md", "| Field     | `field.member.borrow-limit`", "| Field     | `field.loan.borrow-limit`")],
  ["[check.contract.untyped-field] a field without a type", "types that cannot become a contract",
    (p) => p("ontology.md", "| date             |", "|                  |")],
  ["[check.contract.bad-type] a type outside the vocabulary", "types that cannot become a contract",
    (p) => p("ontology.md", "| integer 0..2     |", "| int 0..2         |")],
  ["[check.contract.bad-type] a reference to something that is not an entity", "types that cannot become a contract",
    (p) => p("ontology.md", "| ref `ent.item`   |", "| ref `ent.items`  |")],
  ["[check.contract.stale] a hand edit of the generated contracts", "generated contracts differ",
    (p) => p("contracts/ontology.schema.json", '"maximum": 2', '"maximum": 3')],
  ["[check.contract.stale] a contract the ontology changed under", "generated contracts differ",
    (p) => p("ontology.md", "| integer 0..2     |", "| integer 0..3     |")],
  ["[check.retired-id.used-outside-log] a retired ID used in the mockup", "retired IDs still in use outside the decision log",
    (p) => p("mockup/index.html", 'data-ont="field.loan.due-date"', 'data-ont="field.due-date"')],
  ["[check.retired-id.still-defined] a retired ID that is still defined", "retired IDs still defined in the glossary",
    (p) => p("ontology.md", "| `edge.copy-of`         |", "| `edge.item.copy-of`    |")],
  ["[check.test-suite.uncovered-concept] an implemented invariant no test names", "implemented concepts without a test in the unit suite",
    (p) => p("app/library.test.mjs", "[check.item.one-open-loan] ", "")],
  ["[check.concept.unknown-id] a test tag with an unknown ID", "IDs in unit tests but not in the glossary",
    (p) => p("app/library.test.mjs", "[field.loan.renewals, field.member.borrow-limit]", "[field.loan.renewal-" + "count]")],
  ["[check.test.proves-unbuilt] a test that proves a concept the table does not list", "IDs in unit tests but not in the implementation table",
    (p) => p("app/library.test.mjs", "[field.loan.renewals, field.member.borrow-limit]", "[field.loan.renewals, field.item.condition]")],
  ["[check.test-suite.uncovered-concept] an implemented action with no end-to-end test", "implemented concepts without a test in the end-to-end suite",
    (p) => p("e2e/cli.test.mjs", "[check.loan.renew-while-held] ", "")],
  ["[check.test-suite.duplicate-name] two test suites with the same name", "test suites with the same name",
    (p) => p("ont.config.json", '"name": "end-to-end"', '"name": "unit"')],
  ["[check.test-suite.empty] a test suite whose directory has no tests", "no end-to-end test files found",
    (p) => p("ont.config.json", '"dir": "e2e"', '"dir": "e2e-missing"')],
  ["[check.check.duplicate] a check listed twice", "duplicate checks in the catalogue",
    (p) => p("checks.md", "| `check.hold.cancel`", "| `check.hold.cancel` | `action.cancel-hold` | a | b | c | auto |\n| `check.hold.cancel`")],
  ["[check.check.wrong-section] a check under another entity's section", "checks outside their section",
    (p) => p("checks.md", "| `check.hold.cancel`  ", "| `check.loan.cancel`  ")],
  ["[check.check.malformed] a check without a valid proof", "malformed checks",
    (p, dir) => {
      const f = join(dir, "checks.md");
      writeFileSync(f, readFileSync(f, "utf8").replace(/(`check\.hold\.cancel`[^\n]*\| )auto( *\|)/, "$1maybe$2"));
    }],
  ["[check.concept.unknown-id] a check naming an unknown concept", "IDs in the check catalogue but not in the glossary",
    (p) => p("checks.md", "`inv.queue-order`  ", "`inv.queue-orders` ")],
  ["[check.check.required-missing] an invariant without a check", "concepts without a check",
    (p) => p("checks.md", "`inv.queue-order`  ", "`derived.available`")],
  ["[check.check.untested] an automatic check of implemented concepts without a test", "automatic checks of implemented concepts without a test",
    (p) => p("app/library.test.mjs", "[check.loan.renew-twice] ", "[rule.renewal] ")],
  ["[check.test.unknown-check] a test tag naming a check not in the catalogue", "checks in unit tests but not in the catalogue",
    (p) => p("app/library.test.mjs", "[check.loan.renew-twice]", "[check.loan.renew-" + "thrice]")],
  ["[check.test.tags-manual] a test implementing a manual check", "manual checks tagged in end-to-end tests",
    (p) => p("e2e/cli.test.mjs", "[check.loan.return-closes-loan]", "[check.loan.return-closes-loan, check.loan.overdue-in-real-time]")],
  ["[check.test.proves-unbuilt] a test implementing a check of concepts not built", "checks in unit tests whose concepts are not all implemented",
    (p) => p("app/library.test.mjs", "[check.loan.renew-twice]", "[check.loan.renew-twice, check.hold.cancel]")],
  ["[check.ticket.unknown-check] a ticket listing a check not in the catalogue", "checks in tickets but not in the catalogue",
    (p) => p("issues/0003-serve-the-hold-queue.md", "`check.hold.served-in-order`", "`check.hold.served-first`")],
  ["[check.ticket.unrelated-check] a ticket listing a check that names none of its IDs", "ticket checks that name none of the ticket's IDs",
    (p) => p("issues/0003-serve-the-hold-queue.md", "`check.hold.served-in-order`", "`check.loan.renew-twice`")],
  ["an older ticket scenario without THEN", "ticket scenarios without an ID tag or GIVEN … WHEN … THEN",
    (p) => p("issues/0003-serve-the-hold-queue.md", "## Out of scope", "## Scenarios\n\n- [inv.queue-order] GIVEN two holds WHEN a copy comes back\n\n## Out of scope")],
  ["[check.concept.unknown-id] a doc anchor naming an unknown concept", "IDs in help docs anchors but not in the glossary",
    (p) => p("help/holds.md", "<!-- ont: action.place-hold@", "<!-- ont: action.place-holds, action.place-hold@")],
  ["[check.doc-section.not-an-id] a doc anchor that is not an ID", "anchors in help docs that are not IDs",
    (p) => p("help/holds.md", "<!-- ont: action.place-hold@", "<!-- ont: Place hold, action.place-hold@")],
  ["[check.doc-set.unexplained] an implemented action the help does not explain", "implemented concepts the help docs do not explain",
    (p) => p("help/borrowing.md", "<!-- ont: action.return@", "<!-- ont: ent.loan@")],
  ["[check.retired-id.used-outside-log] a retired ID in a doc anchor", "retired IDs still in use outside the decision log",
    (p) => p("help/borrowing.md", "field.loan.due-date@", "field.due-date@")],
  ["[check.reference-page.stale] a hand edit of a generated reference page", "generated reference differs",
    (p) => p("help/terms.md", "Every word the library app uses", "Every term the library app uses")],
  ["[check.concept.duplicate-row] a second definition row with the same ID", "Duplicate ID in the glossary",
    (p) => p("ontology.md", "| Action    | `action.checkout`", "|           | `hook.due-reminder` | Again | x |\n| Action    | `action.checkout`")],
  ["[check.concept.unknown-class] a definition row of a class the config does not list", "glossary IDs of a class not listed in the config",
    (p) => p("ontology.md", "| Entity | `ent.title` |", "|        | `type.title` | Type | x |\n| Entity | `ent.title` |")],
  ["[check.retired-id.unknown-replacement] a retired ID replaced by an undefined one", "retired IDs replaced by an ID not in the glossary",
    (p) => p("ontology.md", "| `field.loan.due-date`       | D-06", "| `field.loan.due-on`         | D-06")],
  ["[check.divergence.no-concept] a known divergence that names no concept", "known divergences that name no concept by ID",
    divergence("**Loan.** The desk sees no reason when a renewal is refused.")],
  ["[check.check.section-key-unmatched] a catalogue section whose key names no ontology section", "catalogue sections whose key names no ontology section",
    (p) => { p("ontology.md", "\n## Hold\n", "\n## Reserva\n"); p("checks.md", "\n## Hold\n", "\n## Reserva `hold`\n"); }],
  ["[check.check.section-key-shared] two ontology sections with one key", "ontology sections that share a key",
    (p) => p("ontology.md", "\n## Item\n", "\n## Item `loan`\n")],
  ["[check.check.section-key-malformed] a heading whose code span is not a key", "section headings whose code span is not one key",
    (p) => { p("ontology.md", "\n## Loan\n", "\n## Loan `Loan V2`\n"); p("checks.md", "\n## Loan\n", "\n## Loan `Loan V2`\n"); }],
  ["[check.doc-set.unguided-check] a manual check of built concepts that no run guide names", "manual checks the verify docs do not explain how to run",
    (p) => p("verify/overdue.md", "<!-- ont: check.loan.overdue-in-real-time@", "<!-- ont: derived.overdue@")],
  ["[check.ticket.no-ids] a ticket without an IDs line", "tickets without an `IDs:` line",
    (p) => p("issues/0003-serve-the-hold-queue.md", "IDs: `hook.hold-ready`", "Concepts: `hook.hold-ready`")],
  ["[check.doc-set.duplicate-name] two doc sets with the same name", "doc sets with the same name",
    (p) => p("ont.config.json", '"docSets": [', '"docSets": [\n    { "name": "help", "dir": "help", "cover": [] },')],
  ["[check.decision.supersedes-older] a Supersedes line naming no entry", "Supersedes lines that name no older entry",
    (p) => p("decisions.md", "## Tentative", entry("07", ["Supersedes: D-09", "Decision: x."]))],
  ["[check.decision.supersedes-older] a Supersedes line naming a newer entry", "Supersedes lines that name no older entry",
    (p) => p("decisions.md", "- Date: 2026-10-17 · Status: accepted\n- Decision: a hold is placed on a title", "- Date: 2026-10-17 · Status: accepted\n- Supersedes: D-04\n- Decision: a hold is placed on a title")],
];

// Each case name starts with the check from the approach's catalogue (checks.md) that it implements.
for (const [name, label, edit] of cases)
  test(name.replace(/^(\[[^\]]+\]) /, "$1 fails on "), () => {
    const r = run(edit);
    assert.equal(r.code, 1, r.out);
    assert.ok(r.out.includes(label), `expected "${label}" in:\n${r.out}`);
  });
