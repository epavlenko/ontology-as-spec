// --review <base>: the checks to review for a change (D-77). Each case copies the example into a git
// repository of its own, commits it, changes one artifact and asks which checks a reviewer must run.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const TOOLS = fileURLToPath(new URL("../", import.meta.url));
const EXAMPLE = fileURLToPath(new URL("../../../example/", import.meta.url));
const ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };

const patch = (dir, file, from, to) => {
  const path = join(dir, file);
  const text = readFileSync(path, "utf8");
  assert.ok(text.includes(from), `fixture text not found in ${file}: ${from}`);
  writeFileSync(path, text.replace(from, to));
};

// before edits the committed base, after edits the working tree; returns the output of --review HEAD.
const review = ({ before, after } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), "ont-review-"));
  try {
    cpSync(EXAMPLE, dir, { recursive: true, filter: (src) => !src.startsWith(join(EXAMPLE, "releases")) });
    before?.(dir);
    const git = (...args) => spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", env: ENV });
    git("init", "-q");
    git("add", "-A");
    git("commit", "-q", "-m", "base");
    after?.(dir);
    const r = spawnSync("node", [join(TOOLS, "ont-check.mjs"), "--config", join(dir, "ont.config.json"), "--review", "HEAD"], {
      encoding: "utf8",
    });
    return r.stdout + r.stderr;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

// The IDs of the checks listed under one heading of the review: of review or of run, the project's or
// the approach's (D-155).
const listed = (out, which, kind = "review") => {
  const start = out.indexOf(`Checks of ${kind} of the ${which}`);
  assert.ok(start >= 0, `no list of the ${which}'s checks in:\n${out}`);
  const rest = out.slice(start).split("\n").slice(1);
  const end = rest.findIndex((l) => !l.startsWith("  "));
  return rest
    .slice(0, end < 0 ? undefined : end)
    .map((l) => l.match(/^ {2}(check\.\S+)/)?.[1])
    .filter(Boolean);
};

const RENEW_EXPLAINED =
  "| `check.loan.renew-explained` | `action.renew` | ana's renewal is refused | she reads the screen | she understands why and when she can renew | review | |\n";

test("[check.agent-rules.review-definition-changed] lists the manual check of a concept whose definition changed", () => {
  const out = review({
    before: (dir) => patch(dir, "checks.md", "| `check.loan.overdue-in-real-time`", RENEW_EXPLAINED + "| `check.loan.overdue-in-real-time`"),
    after: (dir) =>
      patch(dir, "ontology.md", "refused while someone waits for the title. |", "refused, with the reason, while someone waits for the title. |"),
  });
  assert.match(out, /Touched concepts \(1\): action\.renew\n/);
  assert.deepEqual(listed(out, "project"), ["check.loan.renew-explained"]);
  assert.ok(listed(out, "approach").includes("check.concept.definition-says-what"), out);
});

test("[check.agent-rules.review-code-changed] lists the manual checks of the concepts a changed code file names", () => {
  const out = review({ after: (dir) => appendFileSync(join(dir, "app/library.mjs"), "// a change\n") });
  assert.deepEqual(listed(out, "project"), []);
  assert.deepEqual(listed(out, "project", "run"), ["check.loan.overdue-in-real-time"]);
  const approach = listed(out, "approach");
  assert.ok(approach.includes("check.implementation-row.true"), out);
  assert.ok(approach.includes("check.concept.code-from-ontology"), out);
  assert.ok(approach.includes("check.agent-rules.code-reviewed-for-errors"), out);
  assert.ok(!approach.includes("check.concept.definition-says-what"), out);
});

test("[check.agent-rules.review-code-changed] a file a doc set names one by one is still read as code (D-96)", () => {
  const out = review({
    before: (dir) => patch(dir, "ont.config.json", '"docSets": [', '"docSets": [\n    { "name": "pages", "files": ["app/library.mjs"], "cover": [] },'),
    after: (dir) => appendFileSync(join(dir, "app/library.mjs"), "// a change\n"),
  });
  assert.match(out, /Kinds of artifact: [^\n]*code/);
  assert.match(out, /Kinds of artifact: [^\n]*docs/);
  assert.deepEqual(listed(out, "project", "run"), ["check.loan.overdue-in-real-time"]);
});

test("[check.agent-rules.review-code-errors-listed] lists the check of errors and security for a new code file that names no concept", () => {
  const out = review({ after: (dir) => writeFileSync(join(dir, "app/format.mjs"), "export const pad = (s) => String(s).padStart(2, '0');\n") });
  assert.match(out, /Kinds of artifact: code\n/);
  assert.ok(listed(out, "approach").includes("check.agent-rules.code-reviewed-for-errors"), out);
});

test("[check.agent-rules.review-catalogue-changed] lists the approach's checks of the catalogue when a check changes", () => {
  const out = review({
    after: (dir) => patch(dir, "checks.md", "her loans show it overdue the next day", "her loans show it overdue on the next day"),
  });
  assert.match(out, /Kinds of artifact: catalogue\n/);
  assert.ok(listed(out, "approach").includes("check.check.product-terms"), out);
  assert.deepEqual(listed(out, "approach", "run"), ["check.check.blind-derivation"]);
  assert.ok(!listed(out, "approach").includes("check.check.blind-derivation"), out);
});

test("[check.agent-rules.review-ticket-changed] lists the approach's checks of tickets when a ticket changes", () => {
  const out = review({ after: (dir) => appendFileSync(join(dir, "issues/0003-serve-the-hold-queue.md"), "\nA note.\n") });
  assert.match(out, /Kinds of artifact: tickets\n/);
  assert.ok(listed(out, "approach").includes("check.ticket.no-behavior"), out);
});

test("[check.agent-rules.review-doc-changed] counts a changed section as touched when another section of its page has the same anchor", () => {
  const out = review({
    before: (dir) => appendFileSync(join(dir, "help/borrowing.md"), "\n<!-- ont: action.return -->\n## Returning late\n\nBring it back anyway.\n"),
    after: (dir) => patch(dir, "help/borrowing.md", "The loan closes at once", "The loan closes at the desk at once"),
  });
  assert.match(out, /Touched concepts \(1\): action\.return\n/);
  assert.ok(listed(out, "approach").includes("check.doc-section.anchored"), out);
});

// reviewPaths (D-80): a changed data file touches the concepts its directory names.
const withData = (concepts) => (dir) => {
  patch(dir, "checks.md", "| `check.loan.overdue-in-real-time`", RENEW_EXPLAINED + "| `check.loan.overdue-in-real-time`");
  if (concepts) patch(dir, "ont.config.json", '"root": "."', `"root": ".",\n  "reviewPaths": [{ "dir": "data", "concepts": ${JSON.stringify(concepts)} }]`);
  mkdirSync(join(dir, "data"), { recursive: true });
  writeFileSync(join(dir, "data/renewals.json"), '{ "renewals": { "value": 2, "kind": "fact", "sources": ["rules-page"] } }\n');
};
const changeData = (dir) => writeFileSync(join(dir, "data/renewals.json"), '{ "renewals": { "value": 3, "kind": "fact", "sources": ["rules-page"] } }\n');

test("[check.agent-rules.review-path-touches] lists the manual check of the concept a changed data file's directory names", () => {
  const out = review({ before: withData(["action.renew"]), after: changeData });
  assert.match(out, /Touched concepts \(1\): action\.renew\n/);
  assert.deepEqual(listed(out, "project"), ["check.loan.renew-explained"]);
});

test("[check.agent-rules.review-path-absent] finds nothing to review in a changed data file without reviewPaths", () => {
  const out = review({ before: withData(null), after: changeData });
  assert.match(out, /REVIEW HEAD: nothing to review \(1 files changed\)/);
});

test("[check.agent-rules.review-path-unknown] fails on a concept under reviewPaths that the ontology does not define", () => {
  const out = review({ before: withData(["field.case.no-such"]) });
  assert.match(out, /ERROR · concepts under reviewPaths that the ontology does not define \(1\):\n {2}field\.case\.no-such\n/);
});

test("[check.agent-rules.review-path-unchecked] fails on a concept under reviewPaths without a manual check", () => {
  const out = review({ before: withData(["edge.loan.item"]) });
  assert.match(out, /ERROR · concepts under reviewPaths without a check of review or run in the catalogue \(1\):\n {2}edge\.loan\.item\n/);
});

test("[check.agent-rules.review-skips-runs] leaves the records of manual runs out of the change it reviews", () => {
  const out = review({
    after: (dir) => {
      mkdirSync(join(dir, "verify/runs"), { recursive: true });
      writeFileSync(join(dir, "verify/runs/20261105T090000Z-check.loan.overdue-in-real-time-a1b2.md"), "Check: check.loan.overdue-in-real-time\n");
    },
  });
  assert.match(out, /REVIEW HEAD: nothing to review \(0 files changed\)/);
});

test("[check.agent-rules.review-nothing] says there is nothing to review when nothing changed", () => {
  const out = review();
  assert.match(out, /REVIEW HEAD: nothing to review \(0 files changed\)/);
});

// The checks of a judge and of the screens go to the reviewer only when the change touches a judge, its
// verdicts, a judged check, a view or a screen, or when what a changed file is cannot be told (D-98).
const JUDGE = ["check.check.judge-sees-the-check", "check.check.verdict-kept"];
const SCREENS = ["check.check.view-states-judged", "check.check.screens-outside"];
const has = (out, ids) => ids.filter((id) => listed(out, "approach").includes(id));

test("[check.agent-rules.review-judge-screens-touched] a fix of code and its unit test that touch no judge and no view get none of them", () => {
  const out = review({
    after: (dir) => {
      appendFileSync(join(dir, "app/library.mjs"), "// a change\n");
      appendFileSync(join(dir, "app/library.test.mjs"), "// a change\n");
    },
  });
  assert.ok(listed(out, "approach").includes("check.test.does-what-it-says"), out);
  assert.deepEqual(has(out, [...JUDGE, ...SCREENS]), [], out);
});

test("[check.agent-rules.review-judge-screens-touched] a changed test of a judged suite gets them", () => {
  const out = review({ after: (dir) => appendFileSync(join(dir, "judged/library.judged.mjs"), "// a change\n") });
  assert.deepEqual(has(out, [...JUDGE, ...SCREENS]), [...JUDGE, ...SCREENS], out);
});

test("[check.agent-rules.review-judge-screens-touched] a unit test that starts to call the judge gets the checks of a judge", () => {
  const out = review({ after: (dir) => appendFileSync(join(dir, "app/library.test.mjs"), "import { judge } from '../../tools/ont-check/judge.mjs';\nawait judge();\n") });
  assert.deepEqual(has(out, JUDGE), JUDGE, out);
});

test("[check.agent-rules.review-judge-screens-touched] a unit test that calls the judge through an adapter, with a space before the call, gets them", () => {
  const out = review({
    before: (dir) => writeFileSync(join(dir, "app/ask.mjs"), "export { judge } from '../../tools/ont-check/judge.mjs';\n"),
    after: (dir) => appendFileSync(join(dir, "app/library.test.mjs"), "import * as a from './ask.mjs';\nawait a.judge /* the model */ (1);\n"),
  });
  assert.deepEqual(has(out, JUDGE), JUDGE, out);
});

test("[check.agent-rules.review-judge-screens-touched] a changed view row gets the checks of the screens", () => {
  const out = review({
    after: (dir) => {
      patch(dir, "ontology.md", "Titles with search, availability and queue length.", "Titles with search, availability, the queue's length.");
      appendFileSync(join(dir, "app/library.mjs"), "// a change\n");
    },
  });
  assert.deepEqual(has(out, SCREENS), SCREENS, out);
});

test("[check.agent-rules.review-judge-screens-touched] a changed judged check of the catalogue gets them", () => {
  const out = review({
    after: (dir) => patch(dir, "checks.md", "ana already has five loans, her limit", "ana already has five loans, which is her limit"),
  });
  assert.deepEqual(has(out, [...JUDGE, ...SCREENS]), [...JUDGE, ...SCREENS], out);
});

test("[check.agent-rules.review-judge-screens-touched] a file the configuration does not know keeps them, in doubt", () => {
  // A changed unit test lists the Check section; a file beside it that nothing describes keeps them all.
  // Alone, such a file brings nothing to review (D-80, check.agent-rules.review-path-absent): doubt keeps
  // a check that would be listed, and adds none.
  const out = review({
    after: (dir) => {
      appendFileSync(join(dir, "app/library.test.mjs"), "// a change\n");
      writeFileSync(join(dir, "notes.txt"), "a note\n");
    },
  });
  assert.deepEqual(has(out, [...JUDGE, ...SCREENS]), [...JUDGE, ...SCREENS], out);
});
