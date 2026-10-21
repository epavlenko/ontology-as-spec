import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const TOOLS = fileURLToPath(new URL("../", import.meta.url));
const EXAMPLE = fileURLToPath(new URL("../../../example/", import.meta.url));

// Each case copies the example, breaks one thing and expects the check to name exactly that.
const run = (edit) => {
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
    const r = spawnSync("node", [join(TOOLS, "ont-check.mjs"), "--config", join(dir, "ont.config.json")], {
      encoding: "utf8",
    });
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
  ["an implemented action with no scenario", "implemented concepts without a verification scenario",
    (p) => p("features/holds.md", "IDs: `action.place-hold`, ", "IDs: ")],
  ["a scenario file without an IDs line", "scenario files without an `IDs:` line",
    (p) => p("features/holds.md", "IDs: ", "Concepts: ")],
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
  ["a retired ID used in the mockup", "retired IDs still in use outside the decision log",
    (p) => p("mockup/index.html", 'data-ont="field.loan.due-date"', 'data-ont="field.due-date"')],
  ["a retired ID that is still defined", "retired IDs still defined in the glossary",
    (p) => p("ontology.md", "| `edge.copy-of`         |", "| `edge.item.copy-of`    |")],
  ["an implemented invariant no test names", "implemented concepts without a test",
    (p) => p("app/library.test.mjs", "[inv.one-loan-per-item] ", "")],
  ["a test tag with an unknown ID", "IDs in tests but not in the glossary",
    (p) => p("app/library.test.mjs", "[inv.one-loan-per-item]", "[inv.one-loan-per-copy]")],
  ["a test that proves a concept the table does not list", "IDs in tests but not in the implementation table",
    (p) => p("app/library.test.mjs", "[action.place-hold]", "[action.place-hold, hook.hold-ready]")],
  ["a ticket without scenarios", "tickets without scenarios",
    (p) => p("issues/0003-serve-the-hold-queue.md", "## Scenarios", "## Behavior")],
  ["a ticket scenario without THEN", "ticket scenarios without an ID tag or GIVEN … WHEN … THEN",
    (p) => p("issues/0003-serve-the-hold-queue.md", "THEN it is not, although", "and it is not, although")],
  ["a ticket scenario tag not on the ticket's IDs line", "scenario tags not on the ticket's `IDs:` line",
    (p) => p("issues/0003-serve-the-hold-queue.md", "- [inv.queue-order]", "- [inv.queue-order, ent.member]")],
];

for (const [name, label, edit] of cases)
  test(`fails on ${name}`, () => {
    const r = run(edit);
    assert.equal(r.code, 1, r.out);
    assert.ok(r.out.includes(label), `expected "${label}" in:\n${r.out}`);
  });
