// --review <base>: the checks to review for a change (D-77). Each case copies the example into a git
// repository of its own, commits it, changes one artifact and asks which checks a reviewer must run.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    cpSync(EXAMPLE, dir, { recursive: true });
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

// The IDs of the checks listed under one heading of the review: the project's or the approach's.
const listed = (out, which) => {
  const start = out.indexOf(`Manual checks of the ${which}`);
  assert.ok(start >= 0, `no list of the ${which}'s checks in:\n${out}`);
  const rest = out.slice(start).split("\n").slice(1);
  const end = rest.findIndex((l) => !l.startsWith("  "));
  return rest
    .slice(0, end < 0 ? undefined : end)
    .map((l) => l.match(/^ {2}(check\.\S+)/)?.[1])
    .filter(Boolean);
};

const RENEW_EXPLAINED =
  "| `check.loan.renew-explained` | `action.renew` | ana's renewal is refused | she reads the screen | she understands why and when she can renew | manual | |\n";

test("[check.agent-rules.review-definition-changed] lists the manual check of a concept whose definition changed", () => {
  const out = review({
    before: (dir) => patch(dir, "checks.md", "| `check.loan.overdue-in-real-time`", RENEW_EXPLAINED + "| `check.loan.overdue-in-real-time`"),
    after: (dir) =>
      patch(dir, "ontology.md", "Refused while someone waits for the title.  |", "Refused, with the reason, while someone waits for the title. |"),
  });
  assert.match(out, /Touched concepts \(1\): action\.renew\n/);
  assert.deepEqual(listed(out, "project"), ["check.loan.renew-explained"]);
  assert.ok(listed(out, "approach").includes("check.concept.definition-says-what"), out);
});

test("[check.agent-rules.review-code-changed] lists the manual checks of the concepts a changed code file names", () => {
  const out = review({ after: (dir) => appendFileSync(join(dir, "app/library.mjs"), "// a change\n") });
  assert.deepEqual(listed(out, "project"), ["check.loan.overdue-in-real-time"]);
  const approach = listed(out, "approach");
  assert.ok(approach.includes("check.implementation-row.true"), out);
  assert.ok(approach.includes("check.concept.code-from-ontology"), out);
  assert.ok(!approach.includes("check.concept.definition-says-what"), out);
});

test("[check.agent-rules.review-catalogue-changed] lists the approach's checks of the catalogue when a check changes", () => {
  const out = review({
    after: (dir) => patch(dir, "checks.md", "her loans show it overdue the next day", "her loans show it overdue on the next day"),
  });
  assert.match(out, /Kinds of artifact: catalogue\n/);
  assert.ok(listed(out, "approach").includes("check.check.product-terms"), out);
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

test("[check.agent-rules.review-nothing] says there is nothing to review when nothing changed", () => {
  const out = review();
  assert.match(out, /REVIEW HEAD: nothing to review \(0 files changed\)/);
});
