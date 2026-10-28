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
  // A project on the older key has no suite that names judged checks, so the example's judged check goes too.
  const r = run((p) => {
    p(
      "ont.config.json",
      /"testSuites": \[[\s\S]*?\n  \],/.exec(readFileSync(join(EXAMPLE, "ont.config.json"), "utf8"))[0],
      '"tests": { "dir": ".", "match": "\\\\.test\\\\.mjs$", "cover": ["inv", "rule", "derived", "action"] },',
    );
    p("checks.md", /^\| `check\.member\.limit-refusal-explained` .*\n/m.exec(readFileSync(join(EXAMPLE, "checks.md"), "utf8"))[0], "");
  });
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

test("[check.decision.tentative-supersedes-nothing] a tentative entry's Supersedes line takes effect when it is accepted", () => {
  const proposal = entry("07", ["Supersedes: D-04", "Decision: renewal is shown differently."]).replace("Status: accepted", "Status: tentative");
  const before = run((p) => p("decisions.md", "## Tentative", proposal), "--decisions");
  assert.equal(before.code, 0, before.out);
  assert.match(before.out, /\| D-04 +\| Renewal is refused while someone waits, and the member sees why +\| in force +\| D-07 +\|/);
  assert.match(before.out, /\| D-07 +\| Entry 07 +\| tentative +\|/);
  const after = run((p) => p("decisions.md", "## Tentative", proposal.replace("Status: tentative", "Status: accepted")), "--decisions");
  assert.match(after.out, /\| D-04 +\| Renewal is refused while someone waits, and the member sees why +\| superseded by D-07 +\|/);
  // A deferral that a tentative entry would supersede stays on the list of deferrals.
  const e = (n, lines) => entry(n, lines).replace("\n\n## Tentative", "");
  const deferral = run((p) =>
    p(
      "decisions.md",
      "## Tentative",
      [
        e("07", ["Return when: a second branch opens", "Decision: one branch for now."]),
        e("08", ["Supersedes: D-07", "Decision: a second branch now."]).replace("Status: accepted", "Status: tentative"),
        "## Tentative",
      ].join("\n\n"),
    ),
  );
  assert.match(deferral.out, /deferrals in force, each with the condition for taking it up again \(1\):\n {2}D-07: a second branch opens\n/);
});

// Checks a model judges run in the suites that name them (D-60).
const rowOf = (id) => new RegExp(`^\\| \`${id.replace(/\./g, "\\.")}\` .*$`, "m").exec(readFileSync(join(EXAMPLE, "checks.md"), "utf8"))[0];
const judgedRow = (id) => rowOf(id).replace(/\| auto( *)\|/, "| judged$1|");

test("[check.check.judged-untested] fails on a judged check of implemented concepts that no suite runs with a judge", () => {
  const r = run((p) => p("checks.md", rowOf("check.loan.renew-twice"), judgedRow("check.loan.renew-twice")));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /judged checks of implemented concepts that no test suite names[^\n]*\(1\):\n {2}check\.loan\.renew-twice\n/);
});

test("[check.test-suite.unimplemented-check] fails on a check a suite names and none of its tests implements", () => {
  const r = run((p) => p("ont.config.json", '"dir": "e2e",', '"dir": "e2e",\n      "checks": ["check.loan.renew-twice"],'));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /checks the end-to-end suite names, of implemented concepts, that none of its tests implements \(1\):\n {2}check\.loan\.renew-twice\n/);
});

test("[check.ticket.judged-check-waits] a listed judged check that needs a concept of another slice keeps the ticket open", () => {
  const r = run(
    (p, dir) => {
      p("checks.md", rowOf("check.hold.reserved-for-holder-only"), judgedRow("check.hold.reserved-for-holder-only"));
      writeFileSync(
        join(dir, "issues", "0005-reserved-items-at-the-desk.md"),
        "# #5 Reserved items at the desk\n\n## Slice\n\nIDs: `action.checkout`.\n\nChecks: `check.hold.reserved-for-holder-only`.\n",
      );
    },
    "--gap",
    "$DIR/issues/0005-reserved-items-at-the-desk.md",
  );
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /check\.hold\.reserved-for-holder-only {2}waits for concept\.reservation/);
  assert.match(r.out, /SLICE_OPEN: 1/);
});

// A complete catalogue covers every outcome of every action, or rules one out (D-62).
test("[check.check.axis-value-uncovered] fails on an outcome of an action that no check covers and nothing rules out", () => {
  const without = (p) => {
    // The Cannot occur line of silence comes first in the file, then the two checks of the Loan section.
    p("checks.md", "`action.return`, `action.renew`, `action.place-hold`, `action.cancel-hold`", "`action.return`, `action.place-hold`, `action.cancel-hold`");
    p("checks.md", "`action.checkout`, `action.return`, `action.renew`, `action.place-hold`", "`action.checkout`, `action.return`, `action.place-hold`");
    p("checks.md", "`action.checkout`, `action.return`, `action.renew`", "`action.checkout`, `action.return`");
  };
  const r = run(without);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /axis values that no check covers and no Cannot occur line rules out \(1\):\n {2}action\.renew: empty, error, silence\n/);
  const ruled = run((p) => {
    without(p);
    p("checks.md", "\n## Member\n", "\n- Cannot occur: `action.renew` empty, error, silence — a fixture.\n\n## Member\n");
  });
  assert.equal(ruled.code, 0, ruled.out);
  const strange = run((p) => p("checks.md", "| success, refusal |", "| success, maybe |"));
  assert.equal(strange.code, 1, strange.out);
  assert.match(strange.out, /axis values that no configured axis has \(1\):\n {2}check\.member\.set-borrow-limit: maybe\n/);
});

test("[check.check.axis-value-uncovered] a Cannot occur line without concepts rules a value out for every action, and one without a reason rules nothing out", () => {
  const silence = "- Cannot occur: `action.checkout`, `action.return`, `action.renew`, `action.place-hold`, `action.cancel-hold`, `action.set-borrow-limit` silence — ";
  const everywhere = run((p) => p("checks.md", silence, "- Cannot occur: silence — "));
  assert.equal(everywhere.code, 0, everywhere.out);
  const unexplained = run((p) => p("checks.md", "- Cannot occur: `action.return` refusal — no rule refuses a return; an item that is not on loan is nothing to act on.", "- Cannot occur: `action.return` refusal"));
  assert.equal(unexplained.code, 1, unexplained.out);
  assert.match(unexplained.out, /Cannot occur lines without a value, or without a reason after a dash \(1\):\n {2}- Cannot occur: `action\.return` refusal\n/);
  assert.match(unexplained.out, /axis values that no check covers and no Cannot occur line rules out \(1\):\n {2}action\.return: refusal\n/);
});

// The ontology layer lists terms that name more than one concept (D-59).
test("[check.concept.term-shared] lists a term that two concepts share as information", () => {
  const r = run((p, dir) => {
    p("ontology.md", "| `rule.loan-period`       | Loan period          |", "| `rule.loan-period`       | Due date             |");
    for (const g of ["gen-glossary.mjs", "gen-reference.mjs"])
      spawnSync("node", [join(TOOLS, g), "--config", join(dir, "ont.config.json")]);
  });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /info · terms that name more than one concept[^\n]*\(1\):\n {2}Due date: field\.loan\.due-date, rule\.loan-period\n/);
});

// What each target waits for, and the next slice to build (D-58).
test("[check.ticket.gap-readiness] --gap says what each target waits for", () => {
  const r = run((p) => {
    p(
      "decisions.md",
      "## Tentative",
      [
        "### D-07 · Entry 07\n\n- Date: 2026-10-22 · Status: tentative\n- Decision: reminders by text message too, `hook.due-reminder`.",
        "### D-08 · Entry 08\n\n- Date: 2026-10-22 · Status: accepted\n- Return when: a second branch opens\n- Decision: the catalogue screen waits, `view.catalog`.",
        "## Tentative",
      ].join("\n\n"),
    );
    p("checks.md", "| `check.screens.refusal-understandable` | `view.desk`, `action.checkout` |", "| `check.screens.refusal-understandable` | `view.desk`, `action.checkout`, `view.catalog` |");
  }, "--gap");
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /\n {2}action\.cancel-hold {2}target, ready · checks: check\.hold\.cancel, /);
  assert.match(r.out, /\n {2}rule\.pickup-window {2}target, in ticket issues\/0003-serve-the-hold-queue\.md · /);
  assert.match(r.out, /\n {2}hook\.due-reminder {2}target, waits for the owner \(D-07\) · /);
  assert.match(r.out, /\n {2}view\.catalog {2}target, deferred until a second branch opens \(D-08\) · /);
  assert.match(r.out, /\n {2}view\.desk {2}target, waits for view\.catalog · /);
});

test("[check.ticket.next-slice] --next proposes the next slice, or says what the targets wait for", () => {
  const r = run(null, "--next");
  assert.equal(r.code, 0, r.out);
  // A check that names both brings the cancel-hold action into the slice of the borrow limit.
  assert.match(r.out, /NEXT · Member\nIDs: `action\.set-borrow-limit`, `action\.cancel-hold`\nChecks: `check\.member\.set-borrow-limit`, `check\.member\.set-limit-unknown-member`, [^\n]*`check\.hold\.state-unreadable`\n/);
  const none = run(
    (p) =>
      p(
        "decisions.md",
        "## Tentative",
        "### D-07 · Entry 07\n\n- Date: 2026-10-22 · Status: accepted\n- Return when: a second branch opens\n- Decision: later: `action.set-borrow-limit`, `field.item.condition`, `hook.due-reminder`, `action.cancel-hold`, `view.catalog`, `view.title.page`, `view.desk`.\n\n## Tentative",
      ),
    "--next",
  );
  assert.equal(none.code, 0, none.out);
  assert.match(none.out, /NEXT · nothing ready: 8 are in tickets; 7 are deferred until a second branch opens \(D-07\)\n/);
});

test("[check.ticket.next-slice] --next says what the gap still holds when no target is left", () => {
  const dir = mkdtempSync(join(tmpdir(), "ont-check-"));
  try {
    const write = (file, lines) => writeFileSync(join(dir, file), lines.join("\n"));
    write("ont.config.json", [JSON.stringify({ classes: { ent: "Entity", action: "Action" }, ontology: "ontology.md", checks: { file: "checks.md", require: ["action"] } })]);
    write("app.mjs", ["// ont: ent.item, action.lend", ""]);
    const ontology = (divergence) => [
      "# Ontology", "", "## Item", "",
      "| Kind   | ID            | Term | Definition    |",
      "| ------ | ------------- | ---- | ------------- |",
      "| Entity | `ent.item`    | Item | A thing lent. |",
      "| Action | `action.lend` | Lend | Lend an item. |", "",
      "## Implementation status", "",
      "| Concept                   | Files     | Note |",
      "| ------------------------- | --------- | ---- |",
      "| `ent.item`, `action.lend` | `app.mjs` |      |", "",
      "### Known divergences", "", ...(divergence ? ["- `action.lend` lends for 14 days, not 21."] : []), "",
    ];
    const catalogue = (proof) => [
      "## Item", "",
      "| Check | Concepts | GIVEN | WHEN | THEN | Proof |",
      "| ----- | -------- | ----- | ---- | ---- | ----- |",
      `| \`check.item.lend\` | \`action.lend\` | an item on the shelf | a member borrows it | it is lent | ${proof} |`, "",
    ];
    const next = () => spawnSync("node", [join(TOOLS, "ont-check.mjs"), "--config", join(dir, "ont.config.json"), "--next"], { encoding: "utf8" }).stdout;
    write("ontology.md", ontology(true));
    write("checks.md", catalogue("auto"));
    assert.match(next(), /NEXT · no target concept left, but the gap still holds 1 known divergence and 1 automatic check without a test \(--gap lists them\)\n/);
    write("ontology.md", ontology(false));
    write("checks.md", catalogue("manual"));
    assert.match(next(), /NEXT · nothing left to build\n/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Code names the concepts it implements in ont: comments (D-57).
test("[check.implementation-row.code-name-unknown] fails on an ID named in code that the ontology does not define", () => {
  // A property path such as action.type is code, not a name: only ont: comments are read.
  const r = run((p) =>
    p("app/library.mjs", "// ont: derived.overdue\n", "// ont: derived.overdue, derived.overdew\nconst kindOf = (action) => action.type;\n"),
  );
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /IDs named in code that the ontology does not define \(1\):\n {2}app\/library\.mjs: derived\.overdew\n/);
});

test("[check.implementation-row.code-name-unknown] fails on a name whose class the ontology does not have", () => {
  const r = run((p) => p("app/library.mjs", "// ont: derived.overdue\n", "// ont: derived.overdue, deriveds.overdue\n"));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /IDs named in code that the ontology does not define \(1\):\n {2}app\/library\.mjs: deriveds\.overdue\n/);
});

test("[check.implementation-row.code-name-unknown] does not read examples in a Markdown file, only its anchors", () => {
  const fence = "`".repeat(3);
  const r = run((p, dir) => {
    p("ontology.md", "| `derived.overdue`        | `app/library.mjs` |", "| `derived.overdue`        | `app/library.mjs`, `app/overdue.md` |");
    p("app/library.mjs", "// ont: derived.overdue\n", "");
    writeFileSync(
      join(dir, "app", "overdue.md"),
      ["# Overdue", "", "<!-- ont: derived.overdue -->", "", "A name reads `// on" + "t: derived.overdew`.", "", fence, "<!-- on" + "t: derived.overdew -->", fence, ""].join("\n"),
    );
  });
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /do not name/);
});

test("[check.implementation-row.code-name-unknown] reads the code directories under code, nested ones too", () => {
  // The default pattern matches every path, and a directory is not read as a file.
  const r = run((p, dir) => {
    p("ont.config.json", '"agentInstructions": ["AGENTS.md"],', '"agentInstructions": ["AGENTS.md"],\n  "code": [{ "dir": "app" }],');
    mkdirSync(join(dir, "app", "nested"));
    writeFileSync(join(dir, "app", "nested", "util.mjs"), "// ont: derived.overdew\n");
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /IDs named in code that the ontology does not define \(1\):\n {2}app\/nested\/util\.mjs: derived\.overdew\n/);
});

test("[check.implementation-row.code-name-retired] fails on a retired ID named in code", () => {
  const r = run((p) => p("app/library.mjs", "// ont: derived.overdue\n", "// ont: derived.overdue, field.due-date\n"));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /retired IDs named in code \(1\):\n {2}app\/library\.mjs: field\.due-date, now field\.loan\.due-date\n/);
});

test("[check.implementation-row.unnamed-in-code] lists an implemented concept its files do not name, and --coverage shows where each is named", () => {
  const r = run((p) => p("app/library.mjs", "// ont: derived.queue-position\n", ""), "--coverage");
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /info · implemented concepts that the files of their row do not name \(1\):\n {2}derived\.queue-position\n/);
  assert.match(r.out, /\| `derived\.overdue` +\|[^\n]*\| app\/library\.mjs +\|/);
  assert.match(r.out, / named in code 24 /);
});

// Agent instructions name rules of the approach and entries of the project's log (D-53).
test("[check.agent-rules.unknown-id] fails on an ID in the agent instructions that nothing defines", () => {
  // A file name such as `action.yml` looks like an ID of the approach's classes and is not one.
  const r = run((p) => p("AGENTS.md", "(`rule.start-from-ids`)", "(`rule.start-from-ids`, `rule.start-from-idz`, `action.yml`)"));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /IDs in the agent instructions that neither the ontology nor the approach defines \(1\):\n {2}AGENTS\.md: rule\.start-from-idz\n/);
});

test("[check.agent-rules.retired-id] fails on an ID in the agent instructions that the project or the approach retired", () => {
  const r = run((p) => p("AGENTS.md", "(`rule.start-from-ids`)", "(`rule.start-from-ids`, `field.due-date`, `rule.target-not-tuning`)"));
  assert.equal(r.code, 1, r.out);
  assert.match(
    r.out,
    /retired IDs in the agent instructions \(2\):\n {2}AGENTS\.md: field\.due-date, now field\.loan\.due-date\n {2}AGENTS\.md: rule\.target-not-tuning, now rule\.number-by-role\n/,
  );
});

test("[check.agent-rules.retired-id] a retired ID of the project stays retired where the approach has the same ID", () => {
  const r = run((p) => {
    p(
      "ontology.md",
      "| `edge.waits-for`       | `edge.hold.waits-for`       | D-06     |",
      "| `edge.waits-for`       | `edge.hold.waits-for`       | D-06     |\n| `ent.ticket` | — | D-06 |",
    );
    p("AGENTS.md", "(`rule.start-from-ids`)", "(`rule.start-from-ids`, `ent.ticket`)");
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /retired IDs in the agent instructions \(1\):\n {2}AGENTS\.md: ent\.ticket, now removed\n/);
});

test("[check.agent-rules.unknown-entry] fails on an entry the agent instructions cite that is missing or superseded", () => {
  const r = run((p) => {
    p("AGENTS.md", "(`rule.start-from-ids`)", "(`rule.start-from-ids`, D-63, D-04)");
    p("decisions.md", "## Tentative", entry("07", ["Supersedes: D-04", "Decision: renewal is shown differently."]));
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /decision entries the agent instructions cite that the log does not have \(1\):\n {2}AGENTS\.md: D-63\n/);
  assert.match(r.out, /superseded decision entries the agent instructions cite \(cite the entry in force\) \(1\):\n {2}AGENTS\.md: D-04, superseded by D-07\n/);
});

test("[check.decision.departure-malformed] fails on an entry that extends or overrides the approach wrongly", () => {
  const ok = run((p) =>
    p("decisions.md", "## Tentative", entry("07", ["Layer: process", "Overrides: `rule.commit-finished-work`", "Decision: agents leave commits to the owner."])),
  );
  assert.equal(ok.code, 0, ok.out);
  const e = (n, lines) => entry(n, lines).replace("\n\n## Tentative", "");
  const bad = run((p) =>
    p(
      "decisions.md",
      "## Tentative",
      [
        e("07", ["Layer: process", "Overrides: `rule.commit-unfinished-work`", "Decision: x."]),
        e("08", ["Extends: `rule.commit-finished-work`", "Decision: y."]),
        "## Tentative",
      ].join("\n\n"),
    ),
  );
  assert.equal(bad.code, 1, bad.out);
  assert.match(
    bad.out,
    /process entries that extend or override the approach wrongly \(2\):\n {2}D-07: rule\.commit-unfinished-work is not a concept of the approach\n {2}D-08: no Layer: process line\n/,
  );
});

test("[check.decision.departure-malformed] checks every Extends and Overrides line; a superseded entry may name a retired rule", () => {
  const e = (n, lines) => entry(n, lines).replace("\n\n## Tentative", "");
  const r = run((p) =>
    p(
      "decisions.md",
      "## Tentative",
      [
        e("07", ["Layer: process", "Overrides: `rule.number-by-role`", "Overrides: `rule.target-not-tuning`", "Decision: x."]),
        e("08", ["Layer: product", "Overrides:", "Decision: y."]),
        "## Tentative",
      ].join("\n\n"),
    ),
  );
  assert.equal(r.code, 1, r.out);
  assert.match(
    r.out,
    /wrongly \(3\):\n {2}D-07: rule\.target-not-tuning is retired, now rule\.number-by-role\n {2}D-08: no Layer: process line\n {2}D-08: an Extends or Overrides line that names no rule of the approach\n/,
  );
  const history = run((p) =>
    p(
      "decisions.md",
      "## Tentative",
      [
        e("07", ["Layer: process", "Overrides: `rule.target-not-tuning`", "Decision: x."]),
        e("08", ["Supersedes: D-07", "Layer: process", "Overrides: `rule.number-by-role`", "Decision: y."]),
        "## Tentative",
      ].join("\n\n"),
    ),
  );
  assert.equal(history.code, 0, history.out);
});

test("[check.agent-rules.approach-ids-stale] the approach IDs next to the tool match the approach's ontology", () => {
  const dir = mkdtempSync(join(tmpdir(), "ont-approach-"));
  try {
    cpSync(EXAMPLE, dir, { recursive: true });
    const cfg = join(dir, "ont.config.json");
    writeFileSync(cfg, readFileSync(cfg, "utf8").replace('"root":', '"approachIds": { "out": "approach-ids.json" },\n  "root":'));
    writeFileSync(join(dir, "approach-ids.json"), "{}\n");
    const node = (script) => spawnSync("node", [join(TOOLS, script), "--config", cfg], { encoding: "utf8" });
    const stale = node("ont-check.mjs");
    assert.equal(stale.status, 1, stale.stdout);
    assert.match(stale.stdout, /generated approach IDs differ from the ontology \(run gen-approach\.mjs\) \(1\):\n {2}approach-ids\.json\n/);
    assert.match(node("gen-approach.mjs").stdout, /approach-ids\.json: 40 IDs/);
    const fresh = node("ont-check.mjs");
    assert.equal(fresh.status, 0, fresh.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
    (p) => {
      p("e2e/cli.test.mjs", "[check.loan.renew-while-held] ", "");
      p("e2e/cli.test.mjs", "[check.loan.state-unreadable] ", "");
    }],
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
