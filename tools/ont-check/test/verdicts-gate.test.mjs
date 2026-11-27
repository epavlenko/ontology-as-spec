// The gate of verdicts (D-187): the verdicts of a change hold its merge, the one issue after the narrow
// round, one end of a step, and the verdicts of the record of a round. Each attack of items 2 to 6 of the
// statement of task enforcement-verdicts-tests is a test here, on repositories whose records the tool's
// writers wrote, and so is each usual path.
// ont: field.merge-gate.verdicts, rule.verdicts-hold-merge, derived.change-list, derived.change-verdict, rule.one-issue-after-narrow, field.fixes-record.issue, field.task-result.fix-tests, field.manual-run.class, field.manual-run.carried
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../lib.mjs";
import { changeList } from "../merge-gate.mjs";
import { sealed } from "../seal.mjs";
import { sha256 } from "../tasks.mjs";

const TOP = fileURLToPath(new URL("../../../", import.meta.url));
const TOOLS = join(TOP, "tools/ont-check");
const ROOT_CFG = JSON.parse(readFileSync(join(TOP, "ont.config.json"), "utf8"));
const RULES = JSON.parse(readFileSync(join(TOP, ".github/merge-gate.json"), "utf8"));
const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.org", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.org" };
for (const k of ["ONT_CLAUDE_LOGS", "ONT_CODEX_LOGS", "ONT_EXECUTOR_SESSIONS", "ONT_GOAL_STATEMENT", "NODE_TEST_CONTEXT"]) delete GIT_ENV[k];

const temps = [];
after(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })));
const temp = (name = "ont-verdicts-") => {
  const d = mkdtempSync(join(tmpdir(), name));
  temps.push(d);
  return d;
};
const writeFile = (text) => {
  const f = join(temp("ont-file-"), "file.txt");
  writeFileSync(f, text);
  return f;
};

function registry(entries) {
  const d = temp("ont-registry-");
  writeFileSync(join(d, "entries.json"), JSON.stringify(entries));
  writeFileSync(join(d, "registry.mjs"), `import { readFileSync } from "node:fs";\nconst e = JSON.parse(readFileSync(${JSON.stringify(join(d, "entries.json"))}, "utf8"))[process.argv[2]];\nif (!e) process.exit(1);\nconsole.log(JSON.stringify(e));\n`);
  return `${process.execPath} ${join(d, "registry.mjs")}`;
}
const answered = (question, meaning) => ({ question, options: [{ key: "a", meaning }], answer: { by: "owner", date: "2026-11-26", option: "a" } });

function statement() {
  const f = join(temp("ont-statement-"), "statement.md");
  writeFileSync(f, "# A statement\n\n## What to do\n\n1. one\n2. two\n\nGate-paths: tools/ont-check/\nDone-when: true\nGoal: g\nBudget-new-input: 100000000\nBudget-output: 100000000\nBudget-reserve: 1.5\n");
  return { file: f, hash: sha256(readFileSync(f)) };
}

function helpers(dir) {
  const put = (p, text) => {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), text);
  };
  const add = (p, text) => put(p, `${readFileSync(join(dir, p), "utf8")}${text}`);
  const git = (...a) => {
    const r = spawnSync("git", ["-C", dir, ...a], { encoding: "utf8", env: GIT_ENV });
    assert.equal(r.status, 0, `git ${a.join(" ")}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const commit = (msg = "step") => {
    git("add", "-A");
    const r = spawnSync("git", ["-C", dir, "commit", "-q", "--allow-empty", "-m", msg], { encoding: "utf8", env: GIT_ENV });
    assert.equal(r.status, 0, r.stderr);
    return git("rev-parse", "HEAD");
  };
  const tool = (script, args, env = {}) => {
    const r = spawnSync(process.execPath, [join(dir, "tools/ont-check", script), ...args, "--config", join(dir, "ont.config.json")], { cwd: dir, encoding: "utf8", env: { ...GIT_ENV, ...env } });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const gate = (base = git("rev-parse", "main"), head = git("rev-parse", "HEAD")) => {
    const r = spawnSync(process.execPath, [join(dir, "tools/ont-check/merge-gate.mjs"), "guard", "--base", base, "--head", head, "--config", join(dir, "ont.config.json")], { encoding: "utf8", env: GIT_ENV });
    return { code: r.status, out: `${r.stdout}${r.stderr}`, codes: [...r.stdout.matchAll(/^CODE (\S+)$/gm)].map((m) => m[1]) };
  };
  // The list of the change from a base, by --review --json: each check with its stamp.
  const list = (from = "main") => {
    const r = tool("ont-check.mjs", ["--review", from, "--json"]);
    const line = r.out.split("\n").find((l) => l.startsWith("REVIEW_JSON "));
    assert.ok(line, r.out);
    return JSON.parse(line.slice(12)).checks;
  };
  // The reviewer's table of verdicts recorded by --record, then committed: every check of the list a pass
  // but those given, and those omitted left out of the table.
  const verdicts = (from = "main", given = {}, { omit = [], by = "reviewer (other)" } = {}) => {
    // A check given that the list of the change does not hold, as the one --review --record adds after a
    // failed analysis of the cause, is a row too.
    const ids = [...new Set([...list(from).map((c) => c.id), ...Object.keys(given)])];
    const rows = ids
      .filter((id) => !omit.includes(id))
      .map((id) => `| ${id} | ${given[id]?.[0] ?? "pass"} | ${given[id]?.[1] ?? "read the change"} |`);
    const r = tool("ont-check.mjs", ["--review", from, "--record", writeFile(`By: ${by}\n\n${rows.join("\n")}\n`)]);
    return r;
  };
  return { dir, put, add, git, commit, tool, gate, list, verdicts };
}

const ENGLISH = writeFile("yes");
// The base: main with the keys of the merge by the state of the task and, by default, of verdicts, seals,
// the goal g and the owner's permission to publish it; the task's branch from it.
function base({ verdicts = true, suite = false } = {}) {
  const dir = temp("ont-base-");
  cpSync(join(TOP, "templates"), dir, { recursive: true });
  cpSync(TOOLS, join(dir, "tools/ont-check"), { recursive: true, filter: (src) => !src.includes(join("tools", "ont-check", "test")) });
  const p = helpers(dir);
  const cfg = JSON.parse(readFileSync(join(dir, "ont.config.json"), "utf8"));
  Object.assign(cfg, {
    reviewRounds: { dir: "reviews/rounds" },
    taskRecords: { dir: "reviews/tasks" },
    verdicts: { dir: "reviews/runs" },
    records: { latinOnly: true, sealsFrom: true },
    mergeGate: { paths: ROOT_CFG.mergeGate.paths, codes: { t: ["TASK_UNNAMED"] }, rules: ".github/merge-gate.json", taskState: true, ...(verdicts ? { verdicts: true } : {}) },
    spend: { fromLogs: false },
    goals: { g: ["t"] },
    statements: { todoHeadings: ["What to do"] },
    // Where asked, the tests under app/ are a suite, so that a change of them lists the checks of tests.
    // and the tickets are under issues/ alone, so that a file at the root is one nothing describes.
    ...(suite ? { testSuites: [{ name: "unit", dir: "app", match: "\\.test\\.mjs$", cover: [] }], tickets: { dir: "issues", match: "^\\d{4}-.*\\.md$" } } : {}),
  });
  p.put("ont.config.json", JSON.stringify(cfg, null, 2));
  p.put(".github/merge-gate.json", JSON.stringify(RULES, null, 2));
  for (const d of ["reviews/rounds", "reviews/tasks", "reviews/runs"]) p.put(`${d}/.keep`, "");
  p.put("docs/page.md", "# A page\n\nA line of text.\n");
  p.put("app/work.mjs", "// ont: ent.thing\nexport const work = 1;\n");
  p.put("app/fix.test.mjs", 'import { test } from "node:test";\ntest("the fix of the gap", () => {});\ntest("the fix of the slip", () => {});\ntest.skip("a skipped fix", () => {});\n// a fix named in a comment alone\n');
  p.git("init", "-q", "-b", "main");
  p.commit("main");
  const cmd = registry({ 50: answered("Publish the work of g?", "publish") });
  const r = p.tool("approve.mjs", ["--kind", "publish", "--scope", "g", "--question", "50", "--english", ENGLISH], { ONT_REGISTRY_CMD: cmd });
  assert.equal(r.code, 0, r.out);
  p.commit("the permission to publish");
  p.git("checkout", "-q", "-b", "task");
  return p;
}
const copy = (p) => {
  const dir = temp("ont-copy-");
  cpSync(p.dir, dir, { recursive: true });
  return helpers(dir);
};

const briefLines = (out) => out.split("\n").filter((l) => /^(Task|Step|Narrow|Number|Statement-hash|Goal|Budget-new-input|Budget-output|Budget-reserve|Gate-paths|Commits|Done|Cause|Round-checks|Brief-time): /.test(l)).join("\n");
const reply = (lines, rest) => writeFile(`${lines}\n${rest}\n`);
// A round by round.mjs; where its brief names the checks of the record of a round, the reviewer's table of
// verdicts, every check of the list a pass but those given, is recorded after the brief and before the round.
function round(p, st, step, rest, triage = null, extra = [], { given = {}, verdicts = true } = {}) {
  const b = p.tool("round.mjs", ["brief", "t", "--step", step, "--statement", st.file, ...extra]);
  assert.equal(b.code, 0, b.out);
  if (verdicts && /^Round-checks: /m.test(b.out)) {
    const v = p.verdicts("main", given);
    assert.equal(v.code, 0, v.out);
  }
  const r = p.tool("round.mjs", ["record", "t", "--from", reply(briefLines(b.out), rest), ...(triage ? ["--triage", writeFile(triage)] : [])]);
  r.brief = b.out;
  return r;
}
const resultRound = (p, st, rest = "By: m (p)\n\nCondition: holds\nAcceptance: clean", triage = null, opts = {}) => {
  const r = round(p, st, "result", rest, triage, opts.extra ?? [], opts);
  assert.equal(r.code, 0, r.out);
  return p.commit("a round of the result");
};
const recordDone = (p, st) => {
  const d = p.tool("done.mjs", ["t", "--statement", st.file]);
  assert.equal(d.code, 0, d.out);
  return d;
};

// The approved state of task t, once; each test takes a copy.
let approvedOnce = null;
const approved = (opts = {}) => {
  const key = JSON.stringify(opts);
  if (!approvedOnce?.[key]) {
    const p = base(opts);
    const st = statement();
    const r = round(p, st, "statement", "By: m (p)");
    assert.equal(r.code, 0, r.out);
    p.commit("a round of the statement");
    approvedOnce = { ...approvedOnce, [key]: { p, st } };
  }
  return { p: copy(approvedOnce[key].p), st: approvedOnce[key].st };
};
// The work: a line of code that names a concept, so that the list of the change holds checks of code.
const work = (p, line = `export const more = ${Math.random()};\n`) => {
  p.add("app/work.mjs", line);
  return p.commit("the work");
};
// The usual path: the work, done, the verdicts of its list, then a clean round of the result.
function reviewed(p, st, given = {}, opts = {}) {
  const w = work(p);
  recordDone(p, st);
  p.commit("done");
  const v = p.verdicts("main", given, opts);
  assert.equal(v.code, 0, v.out);
  p.commit("the verdicts");
  return w;
}
const runs = (p) => readdirSync(join(p.dir, "reviews/runs")).filter((f) => f.endsWith(".md")).map((f) => readFileSync(join(p.dir, "reviews/runs", f), "utf8"));

// ── Usual paths ──────────────────────────────────────────────────────────────────────────────────────

test("[check.merge-gate.verdicts-usual-path] a task's pull request with verdicts for its whole list passes, and so does it after an update of the branch with main", () => {
  const { p, st } = approved();
  const w = reviewed(p, st);
  resultRound(p, st);
  assert.ok(p.list().some((c) => c.id === "check.agent-rules.code-reviewed-for-errors"));
  // The writer wrote the verdicts on the commit of the work, not on the commit of done.
  assert.ok(runs(p).every((t) => t.includes(`Commit: ${w.slice(0, 7)}`)), runs(p).join("\n"));
  const g = p.gate();
  assert.deepEqual(g.codes, [], g.out);
  assert.match(g.out, /^GATE_OK$/m);
  // main moves on, and the branch is updated with it: the checked commit stays, and so do the verdicts.
  p.git("checkout", "-q", "main");
  p.add("docs/page.md", "A line of main.\n");
  p.commit("main moves on");
  p.git("checkout", "-q", "task");
  p.git("merge", "-q", "--no-edit", "main");
  const u = p.gate();
  assert.deepEqual(u.codes, [], u.out);
});

test("[check.merge-gate.verdicts-usual-path] a fail of the check of errors in code whose class the round filed for later, a lone not-run with its reason, and a pull request of records alone pass", () => {
  const { p, st } = approved();
  p.put("issues/0001-a-slip.md", "# A slip\n\nThe class: a slip of code.\n");
  reviewed(p, st, { "check.agent-rules.code-reviewed-for-errors": ["fail", "[a slip of code] app/work.mjs:3 names a value twice"], "check.concept.code-from-ontology": ["not run", "it needs the running product, which this change has not"] });
  resultRound(p, st, "By: m (p)\n\n| a slip of code | nit | change |\n\nCondition: holds\nAcceptance: clean", "a slip of code · later: issues/0001-a-slip.md\n");
  assert.ok(runs(p).some((t) => /Verdict: fail/.test(t) && /Class: a slip of code/.test(t)));
  const g = p.gate();
  assert.deepEqual(g.codes, [], g.out);
  // The pull request of records alone after the merge: no verdict is asked of it.
  p.git("checkout", "-q", "main");
  p.git("merge", "-q", "--no-ff", "--no-edit", "task");
  p.git("checkout", "-q", "-b", "records");
  p.put("reviews/tasks/README.md", "# Records\n");
  p.commit("a readme of records");
  const r = p.gate();
  assert.ok(!r.codes.some((c) => c.startsWith("VERDICT_")), r.out);
});

test("[check.merge-gate.verdicts-switch] a base without mergeGate.verdicts holds no verdict; the pull request that brings the key is not held by it; after its merge the same change is", () => {
  const { p, st } = approved({ verdicts: false });
  work(p);
  recordDone(p, st);
  p.commit("done");
  resultRound(p, st);
  const off = p.gate();
  assert.deepEqual(off.codes, [], off.out);
  // The pull request brings the key: its base has none, so it is not held by it.
  const cfg = JSON.parse(readFileSync(join(p.dir, "ont.config.json"), "utf8"));
  cfg.mergeGate.verdicts = true;
  const q = copy(p);
  q.git("checkout", "-q", "main");
  q.git("checkout", "-q", "-b", "key");
  q.put("ont.config.json", JSON.stringify(cfg, null, 2));
  q.commit("the key of verdicts");
  q.git("checkout", "-q", "main");
  q.git("merge", "-q", "--no-ff", "--no-edit", "key");
  // After its merge, the same change on the new base is held.
  q.git("checkout", "-q", "task");
  q.git("merge", "-q", "--no-edit", "main");
  recordDone(q, st);
  q.commit("done again");
  resultRound(q, st);
  const on = q.gate();
  assert.ok(on.codes.includes("VERDICT_MISSING"), on.out);
});

// A record of a verdict written by hand with a seal, as a forger could (answer 1036 a): the gate holds
// what it reads, not who wrote it.
function forge(p, { check, commit, stamp, verdict, evidence = "", cls = "", carried = "", origin = "review", time = new Date(Date.now() + 1000) }) {
  const t = time.toISOString().replace(/\.\d{3}Z$/, "Z");
  const text = sealed([`Check: ${check}`, `Time: ${t}`, `Commit: ${commit}`, `Stamp: ${stamp}`, `Verdict: ${verdict}`, "By: reviewer (other)", ...(verdict === "pass" || verdict === "fail" ? ["Performer: agent"] : []), ...(evidence ? [`Evidence: ${evidence}`] : []), ...(cls ? [`Class: ${cls}`] : []), ...(carried ? [`Carried: ${carried}`] : []), `Origin: ${origin}`, ""].join("\n"));
  p.put(`reviews/runs/${t.replace(/[-:]/g, "")}-${check}-abcd.md`, text);
}
// A pass forged on a commit for every check of the list but those given.
const forgeAll = (p, commit, except = [], from = "main") => p.list(from).filter((c) => !except.includes(c.id)).forEach((c, i) => forge(p, { check: c.id, commit: commit.slice(0, 7), stamp: c.stamp, verdict: "pass", evidence: "read", time: new Date(Date.now() + 1000 + i * 1000) }));
const CODE = "check.agent-rules.code-reviewed-for-errors";
const OTHER = "check.concept.code-from-ontology";

test("[check.merge-gate.verdict-missing] no record of a check of the list, a record of main before the change, verdicts only in the reviewer's reply, an early pass before a fix of a read file, and a refused carry are each VERDICT_MISSING", () => {
  // The writer refuses a table without a check of the list, so a check is left with no record only when
  // the records are written apart; here every check but one has its record on the checked commit.
  {
    const { p, st } = approved();
    const w = work(p);
    recordDone(p, st);
    p.commit("done");
    forgeAll(p, w, [OTHER]);
    p.commit("the verdicts but one");
    resultRound(p, st);
    const g = p.gate();
    assert.deepEqual([...new Set(g.codes)], ["VERDICT_MISSING"], g.out);
    assert.ok(g.out.includes(OTHER), g.out);
  }
  // A record of main at the same stamp, made before the change: not of this change.
  {
    const { p, st } = approved();
    p.git("checkout", "-q", "main");
    p.put("app/work.mjs", "// ont: ent.thing\nexport const work = 2;\n");
    const m = p.commit("main's own change");
    const stamp = p.list("HEAD~1").find((c) => c.id === OTHER).stamp;
    forge(p, { check: OTHER, commit: m.slice(0, 7), stamp, verdict: "pass", evidence: "read it" });
    p.commit("main's verdict");
    p.git("checkout", "-q", "task");
    p.git("merge", "-q", "--no-edit", "main");
    const w = work(p);
    recordDone(p, st);
    p.commit("done");
    forgeAll(p, w, [OTHER]);
    p.commit("the verdicts but the one main has");
    resultRound(p, st);
    const g = p.gate();
    assert.ok(g.codes.includes("VERDICT_MISSING") && g.out.includes(OTHER), g.out);
  }
  // The verdicts only in the reply of the reviewer of the round, no record of them.
  {
    const { p, st } = approved();
    work(p);
    recordDone(p, st);
    p.commit("done");
    resultRound(p, st, `By: m (p)\n\n| ${CODE} | pass | read |\n| ${OTHER} | pass | read |\n\nCondition: holds\nAcceptance: clean`);
    const g = p.gate();
    assert.deepEqual([...new Set(g.codes)], ["VERDICT_MISSING"], g.out);
  }
  // An early pass, then a fix of the file the check reads, with no new verdict.
  {
    const { p, st } = approved();
    reviewed(p, st);
    work(p, "export const fixed = 1;\n");
    recordDone(p, st);
    p.commit("done again");
    resultRound(p, st);
    const g = p.gate();
    assert.ok(g.codes.includes("VERDICT_MISSING"), g.out);
  }
  // A carry after a file read for it changed: --record refuses the table, and no record is written.
  {
    const { p, st } = approved();
    reviewed(p, st);
    const old = readdirSync(join(p.dir, "reviews/runs")).find((f) => f.includes(OTHER));
    work(p, "export const fixed = 2;\n");
    recordDone(p, st);
    p.commit("done again");
    const r = p.verdicts("main", { [OTHER]: ["carried", `${old} · app/work.mjs`] });
    assert.notEqual(r.code, 0, r.out);
    assert.match(r.out, /changed since its commit/);
    resultRound(p, st);
    assert.ok(p.gate().codes.includes("VERDICT_MISSING"));
  }
});

test("[check.merge-gate.verdict-failed] a late fail after a pass, a fail without a class, a fail of a class no round filed, and a carried fail are each VERDICT_FAILED", () => {
  // A late fail after an early pass, its class filed nowhere.
  {
    const { p, st } = approved();
    reviewed(p, st);
    const v = p.verdicts("main", { [OTHER]: ["fail", "[a gap of meaning] app/work.mjs:2 names no concept it implements"] }, { omit: [] });
    assert.equal(v.code, 0, v.out);
    p.commit("a later fail");
    resultRound(p, st);
    const g = p.gate();
    assert.ok(g.codes.includes("VERDICT_FAILED") && g.out.includes("a gap of meaning"), g.out);
  }
  // A fail without a class: the writer refuses it; a forged one holds the merge.
  {
    const { p, st } = approved();
    const w = reviewed(p, st);
    const r = p.verdicts("main", { [OTHER]: ["fail", "app/work.mjs:2 is wrong"] });
    assert.notEqual(r.code, 0);
    assert.match(r.out, /names no class/);
    forge(p, { check: OTHER, commit: w.slice(0, 7), stamp: p.list().find((c) => c.id === OTHER).stamp, verdict: "fail", evidence: "app/work.mjs:2 is wrong" });
    p.commit("a forged fail");
    resultRound(p, st);
    const g = p.gate();
    assert.ok(g.codes.includes("VERDICT_FAILED"), g.out);
  }
  // A fail carried with no new pass.
  {
    const { p, st } = approved();
    reviewed(p, st, { [OTHER]: ["fail", "[a gap of meaning] app/work.mjs:2"] });
    const old = readdirSync(join(p.dir, "reviews/runs")).find((f) => f.includes(OTHER));
    // A later second: two records of done in one second are ordered by file name, and "-done-2.md" sorts
    // before "-done.md".
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);
    p.put("docs/page.md", "# A page\n\nA line that no check reads.\n");
    p.put("docs/limitations.md", "# Limitations\n\n- a gap of meaning\n");
    p.commit("a page");
    recordDone(p, st);
    p.commit("done again");
    const r = p.verdicts("main", { [OTHER]: ["carried", `${old} · app/work.mjs`] });
    assert.equal(r.code, 0, r.out);
    assert.ok(runs(p).some((t) => /Carried: /.test(t) && /Verdict: fail/.test(t)));
    p.commit("the carry");
    resultRound(p, st, "By: m (p)\n\n| a gap of meaning | nit | change |\n\nCondition: holds\nAcceptance: clean", "a gap of meaning · limitation\n");
    const g = p.gate();
    assert.ok(g.codes.includes("VERDICT_FAILED") && /carried fail/.test(g.out), g.out);
  }
});

test("[check.merge-gate.verdict-unreasoned] a not-run without a reason after an earlier pass is VERDICT_UNREASONED; the writer refuses it", () => {
  const { p, st } = approved();
  const w = reviewed(p, st);
  const r = p.verdicts("main", { [OTHER]: ["not run", ""] });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /without its reason/);
  forge(p, { check: OTHER, commit: w.slice(0, 7), stamp: p.list().find((c) => c.id === OTHER).stamp, verdict: "not-run" });
  p.commit("a forged not-run");
  resultRound(p, st);
  const g = p.gate();
  assert.deepEqual([...new Set(g.codes)], ["VERDICT_UNREASONED"], g.out);
});

test("[check.merge-gate.verdict-not-of-change] the check of errors in code given on uncommitted changes or on a commit of records alone is VERDICT_NOT_OF_CHANGE", () => {
  const { p, st } = approved();
  work(p);
  recordDone(p, st);
  const d = p.commit("done");
  // Given while a record was not yet committed: the writer names the working tree.
  p.put("reviews/tasks/notes.txt", "a note outside the records\n");
  const v = p.verdicts("main");
  assert.equal(v.code, 0, v.out);
  assert.ok(runs(p).every((t) => /\+working-tree/.test(t)));
  p.git("rm", "-q", "--cached", "--ignore-unmatch", "reviews/tasks/notes.txt");
  rmSync(join(p.dir, "reviews/tasks/notes.txt"));
  p.commit("the verdicts");
  forge(p, { check: CODE, commit: d.slice(0, 7), stamp: p.list().find((c) => c.id === CODE).stamp, verdict: "pass", evidence: "read" });
  p.commit("a verdict on the commit of done");
  resultRound(p, st);
  const g = p.gate();
  assert.ok(g.codes.includes("VERDICT_NOT_OF_CHANGE"), g.out);
});

test("[check.merge-gate.verdicts-run-nothing] a module of the pull request that throws when imported is not imported by the guard, which computes the list from Git's objects", () => {
  const { p, st } = approved();
  const mark = join(temp("ont-mark-"), "imported");
  p.put("app/boom.mjs", `// ont: ent.thing\nimport { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(mark)}, "imported");\nthrow new Error("imported");\n`);
  reviewed(p, st);
  resultRound(p, st);
  const g = p.gate();
  assert.deepEqual(g.codes, [], g.out);
  assert.throws(() => readFileSync(mark), /ENOENT/);
});

test("[check.manual-run.record-classes] --record refuses a fail with no class and a not-run with no reason, and writes classes, carries and the last commit outside the records", () => {
  const { p, st } = approved();
  const w = reviewed(p, st, { [OTHER]: ["fail", "[a gap] [a slip] app/work.mjs:2"] });
  const fail = runs(p).find((t) => t.includes(OTHER));
  assert.match(fail, /^Class: a gap · a slip$/m);
  assert.match(fail, new RegExp(`^Commit: ${w.slice(0, 7)}`, "m"));
  for (const [v, e, why] of [["fail", "no class here", /names no class/], ["not run", "", /without its reason/], ["not applicable", "", /without its reason/]]) {
    const r = p.verdicts("main", { [OTHER]: [v, e] });
    assert.notEqual(r.code, 0, r.out);
    assert.match(r.out, why);
  }
  const old = readdirSync(join(p.dir, "reviews/runs")).find((f) => f.includes(OTHER));
  const r = p.verdicts("main", { [OTHER]: ["carried", `${old} · app/work.mjs`] });
  assert.equal(r.code, 0, r.out);
  const carry = runs(p).find((t) => t.includes(`Carried: ${old}`));
  assert.ok(carry && /^Verdict: fail$/m.test(carry) && /^Class: a gap · a slip$/m.test(carry) && carry.includes(`Commit: ${w.slice(0, 7)}`), carry);
});

test("[check.agent-rules.reviewed-before-merge] that a change was reviewed is computed from its records: a verdict for each check of its list, a not-run with its reason among them, passes; a check without one, a fail of a class not decided and the check of errors in code on a commit of records alone are refused", () => {
  const { p, st } = approved();
  const w = work(p);
  recordDone(p, st);
  const d = p.commit("done");
  const variants = [
    [[], null],
    [[OTHER], "VERDICT_MISSING"],
    [[OTHER], "VERDICT_FAILED", { check: OTHER, verdict: "fail", evidence: "[a gap] app/work.mjs:2", cls: "a gap" }],
    [[CODE], "VERDICT_NOT_OF_CHANGE", { check: CODE, verdict: "pass", evidence: "read", on: d }],
  ];
  for (const [except, code, extra] of variants) {
    const q = copy(p);
    forgeAll(q, w, except);
    if (!except.length) forge(q, { check: OTHER, commit: w.slice(0, 7), stamp: q.list().find((c) => c.id === OTHER).stamp, verdict: "not-run", evidence: "it needs the running product", time: new Date(Date.now() + 9000) });
    if (extra) forge(q, { ...extra, commit: (extra.on ?? w).slice(0, 7), stamp: q.list().find((c) => c.id === extra.check).stamp, time: new Date(Date.now() + 9000) });
    q.commit("the verdicts");
    resultRound(q, st);
    const g = q.gate();
    assert.deepEqual([...new Set(g.codes)], code ? [code] : [], g.out);
  }
});

// ── After a narrow round with findings (item 3) ──────────────────────────────────────────────────────

const narrowFile = (p) => readdirSync(join(p.dir, "reviews/rounds")).find((f) => /-t-result-narrow-1\.md$/.test(f));
// The commit the narrow round reviewed, the last of its line Commits:, which the one issue starts from.
const narrowCommit = (p) => readFileSync(join(p.dir, "reviews/rounds", narrowFile(p)), "utf8").match(/^Commits: (?:\S+\.\.)?(\S+)$/m)[1];
// The path to the narrow round with a finding of the usual path, by the writers: the work, done and its
// verdicts; round C with a finding and the condition confirmed; its fix, done and the verdicts of the fix;
// the narrow round with the finding "a slip". Then the fixes of the narrow round, committed.
let narrowedOnce = {};
function narrowed(opts = {}) {
  const key = JSON.stringify(opts);
  if (!narrowedOnce[key]) {
    const { p, st } = approved(opts);
    reviewed(p, st);
    resultRound(p, st, "By: m (p)\n\n| a gap | important | change |\n\nCondition: holds\nAcceptance: clean", "a gap · usual path: the work\n");
    work(p, "export const gapFixed = 1;\n");
    recordDone(p, st);
    p.commit("done");
    const v = p.verdicts("main");
    assert.equal(v.code, 0, v.out);
    p.commit("the verdicts of the fix");
    const narrow = resultRound(p, st, "By: m (p)\n\n| a slip | important | change |\n\nCondition: holds\nAcceptance: clean", "a slip · usual path: the work\n");
    const fix = work(p, "export const slipFixed = 1;\n");
    narrowedOnce[key] = { p, st, narrow: narrowCommit(p), fix };
  }
  return { ...narrowedOnce[key], p: copy(narrowedOnce[key].p) };
}
// The one issue of verdicts on the diff of the fixes, its record of fixes, and done.
function issue(p, st, narrow, { given = {}, findings = "", tests = "a slip · app/fix.test.mjs · the fix of the slip\n", filed = "", at = null } = {}) {
  const v = p.verdicts(narrow, given);
  assert.equal(v.code, 0, v.out);
  const commit = at ?? p.git("rev-parse", "HEAD");
  p.commit("the issue of verdicts");
  const fx = p.tool("round.mjs", ["fixes", "t", "--round", narrowFile(p), "--issue", commit, ...(tests ? ["--from", writeFile(tests)] : []), ...(findings ? ["--findings", writeFile(findings)] : []), ...(filed ? ["--filed", writeFile(filed)] : [])]);
  assert.equal(fx.code, 0, fx.out);
  return commit;
}

test("[check.merge-gate.issue-usual-path] after a narrow round with findings: the whole issue, its fixes and done; an issue that found nothing with done on its commit; and a fix after the issue that lists a check of the docs, held by the range", () => {
  // The whole issue, with a finding of its own fixed by a test, then done.
  {
    const { p, st, narrow } = narrowed();
    issue(p, st, narrow, { findings: "| a gap of the issue | important | change |\n", tests: "a slip · app/fix.test.mjs · the fix of the slip\na gap of the issue · app/fix.test.mjs · the fix of the gap\n" });
    const d = recordDone(p, st);
    assert.match(readFileSync(join(p.dir, "reviews/tasks", readdirSync(join(p.dir, "reviews/tasks")).filter((f) => /-done/.test(f)).sort().at(-1)), "utf8"), /^Fix-tests:\n- app\/fix\.test\.mjs · the fix of the slip · passed$/m, d.out);
    p.commit("done");
    const g = p.gate();
    assert.deepEqual(g.codes, [], g.out);
  }
  // A fix after the issue that touches a page of the docs: the check of docs it lists is held by the
  // range, with no new verdict; the record of fixes is written after the commit of its fixes.
  {
    const { p, st, narrow } = narrowed();
    const at = p.git("rev-parse", "HEAD");
    issue(p, st, narrow, { at, findings: "| a stale page | important | change |\n", tests: "a slip · app/fix.test.mjs · the fix of the slip\na stale page · app/fix.test.mjs · the fix of the gap\n" });
    const before = p.list().map((c) => c.id);
    p.put("help/thing.md", `${readFileSync(join(p.dir, "help/thing.md"), "utf8")}\nA line of the fix.\n`);
    p.commit("a fix of the docs after the issue");
    // The final list holds checks that neither the issue's list nor the narrow round's chose.
    assert.ok(p.list().some((c) => !before.includes(c.id)), JSON.stringify(p.list()));
    recordDone(p, st);
    p.commit("done");
    const g = p.gate();
    assert.deepEqual(g.codes, [], g.out);
  }
  // An issue that found nothing, with done on its own commit.
  {
    const { p, st, narrow } = narrowed();
    issue(p, st, narrow);
    recordDone(p, st);
    p.commit("done");
    const g = p.gate();
    assert.deepEqual(g.codes, [], g.out);
  }
});

test("[check.merge-gate.issue-missing] no issue named, an issue missing a check, records of the issue on another commit, and an issue that found nothing followed by done on a later commit are ISSUE_MISSING; on a change with no narrow round a check with no record is VERDICT_MISSING", () => {
  // No record of fixes names an issue.
  {
    const { p, st } = narrowed();
    const fx = p.tool("round.mjs", ["fixes", "t", "--round", narrowFile(p), "--from", writeFile("a slip · app/fix.test.mjs · the fix of the slip\n")]);
    assert.equal(fx.code, 0, fx.out);
    recordDone(p, st);
    p.commit("done");
    assert.deepEqual([...new Set(p.gate().codes)], ["ISSUE_MISSING"]);
  }
  // An issue missing a check of its list: every record but one on the commit of the issue.
  {
    const { p, st, narrow, fix } = narrowed();
    forgeAll(p, fix, [OTHER], narrow);
    p.commit("the issue but one");
    const fx = p.tool("round.mjs", ["fixes", "t", "--round", narrowFile(p), "--issue", fix, "--from", writeFile("a slip · app/fix.test.mjs · the fix of the slip\n")]);
    assert.equal(fx.code, 0, fx.out);
    recordDone(p, st);
    p.commit("done");
    const g = p.gate();
    assert.deepEqual([...new Set(g.codes)], ["ISSUE_MISSING"], g.out);
    assert.ok(g.out.includes(OTHER), g.out);
  }
  // The records of the issue on another commit than the one the record of fixes names.
  {
    const { p, st, narrow } = narrowed();
    const v = p.verdicts(narrow);
    assert.equal(v.code, 0, v.out);
    p.commit("the issue");
    const later = work(p, "export const later = 1;\n");
    const fx = p.tool("round.mjs", ["fixes", "t", "--round", narrowFile(p), "--issue", later, "--from", writeFile("a slip · app/fix.test.mjs · the fix of the slip\n")]);
    assert.equal(fx.code, 0, fx.out);
    recordDone(p, st);
    p.commit("done");
    assert.ok(p.gate().codes.includes("ISSUE_MISSING"));
  }
  // An issue that found nothing, the narrow round's finding filed, and done on a later commit.
  {
    const { p, st, narrow } = narrowed();
    p.put("issues/0002-a-slip.md", "a slip\n");
    const at = p.commit("the slip filed");
    issue(p, st, narrow, { tests: "", filed: "a slip · later · issues/0002-a-slip.md\n", at });
    p.put("docs/page.md", "# A page\n\nA later line.\n");
    p.commit("a later commit");
    recordDone(p, st);
    p.commit("done");
    const g = p.gate();
    assert.ok(g.codes.includes("ISSUE_MISSING") && /found nothing/.test(g.out), g.out);
  }
  // No narrow round: a check of the list with no record is VERDICT_MISSING, never held by a range.
  {
    const { p, st } = approved();
    const w = work(p);
    recordDone(p, st);
    p.commit("done");
    forgeAll(p, w, [OTHER]);
    p.commit("the verdicts but one");
    resultRound(p, st);
    assert.deepEqual([...new Set(p.gate().codes)], ["VERDICT_MISSING"]);
  }
});

test("[check.merge-gate.fix-untested] a finding of the issue with no decision, and a decision by a test the record of done does not show passed, are FIX_UNTESTED", () => {
  {
    const { p, st, narrow } = narrowed();
    issue(p, st, narrow, { findings: "| a gap of the issue | important | change |\n" });
    recordDone(p, st);
    p.commit("done");
    const g = p.gate();
    assert.deepEqual([...new Set(g.codes)], ["FIX_UNTESTED"], g.out);
    assert.match(g.out, /a gap of the issue/);
  }
  {
    // The test of the decision is named only after the record of done that ended the range.
    const { p, st, narrow } = narrowed();
    issue(p, st, narrow, { findings: "| a gap of the issue | important | change |\n" });
    recordDone(p, st);
    p.commit("done");
    const fx = p.tool("round.mjs", ["fixes", "t", "--round", narrowFile(p), "--from", writeFile("a gap of the issue · app/fix.test.mjs · the fix of the gap\n")]);
    assert.equal(fx.code, 0, fx.out);
    p.commit("a late record of fixes");
    const g = p.gate();
    assert.deepEqual([...new Set(g.codes)], ["FIX_UNTESTED"], g.out);
  }
});

test("[check.task-result.fix-tests] done.mjs runs each test of the records of fixes of the range alone: a passing one is written under Fix-tests:, a skipped one and one not in its file write no record", () => {
  for (const [name, why] of [["a skipped fix", /skipped/], ["a fix named in a comment alone", /not found/]]) {
    const { p, st, narrow } = narrowed();
    issue(p, st, narrow, { tests: `a slip · app/fix.test.mjs · ${name}\n` });
    const d = p.tool("done.mjs", ["t", "--statement", st.file]);
    assert.notEqual(d.code, 0, d.out);
    assert.match(d.out, why);
  }
});

// ── One end of a step (item 4) ───────────────────────────────────────────────────────────────────────

// The work, its record of done and the verdicts of the list of the change, each committed.
const doneWithVerdicts = (p, st, line = `export const w${Math.random().toString(36).slice(2, 7)} = 1;\n`) => {
  work(p, line);
  recordDone(p, st);
  p.commit("done");
  const v = p.verdicts("main");
  assert.equal(v.code, 0, v.out);
  p.commit("the verdicts");
};
// Each end of a step by the writers, with the gate of verdicts: (1) a clean full round with the condition
// confirmed; (2) a clean round without it; (3) the condition confirmed with a finding and a clean narrow
// round; (4) the same with the verdict of acceptance in a round of acceptance alone; (5) a narrow round with
// a finding and the range ended by a record of done.
const C_WITH_GAP = "By: m (p)\n\n| a gap | important | change |\n\nCondition: holds\nAcceptance: clean";
const ENDINGS = {
  1: (p, st) => {
    doneWithVerdicts(p, st);
    resultRound(p, st);
  },
  2: (p, st) => {
    doneWithVerdicts(p, st);
    resultRound(p, st, "By: m (p)\n\nCondition: not yet\nAcceptance: clean");
  },
  3: (p, st) => {
    doneWithVerdicts(p, st);
    resultRound(p, st, C_WITH_GAP, "a gap · usual path: the work\n");
    doneWithVerdicts(p, st);
    resultRound(p, st);
  },
  4: (p, st) => {
    doneWithVerdicts(p, st);
    resultRound(p, st, C_WITH_GAP, "a gap · usual path: the work\n");
    doneWithVerdicts(p, st);
    // The narrow round clean on merging with no verdict of acceptance, which round.mjs record refuses to
    // write: a record of it with its seal, as an earlier writer could leave one (D-167).
    const t = new Date(Date.now() + 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
    p.put(`reviews/rounds/${t.replace(/[-:]/g, "")}-t-result-narrow-1.md`, sealed(["Task: t", "Step: result-review", "Narrow: true", "Number: 1", `Time: ${t}`, `Commits: ${p.git("rev-parse", "HEAD~1")}`, "By: m (p)", `Statement-hash: ${st.hash}`, "Condition: holds", ""].join("\n")));
    p.commit("the narrow round with no acceptance");
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);
    const r = round(p, st, "result", "By: m (p)\n\nCondition: holds\nAcceptance: clean");
    assert.match(r.brief, /for the verdict of acceptance alone on the same result/, r.brief);
    assert.equal(r.code, 0, r.out);
    p.commit("the acceptance alone");
  },
  5: (p, st) => {
    doneWithVerdicts(p, st);
    resultRound(p, st, C_WITH_GAP, "a gap · usual path: the work\n");
    doneWithVerdicts(p, st);
    const narrow = resultRound(p, st, "By: m (p)\n\n| a slip | important | change |\n\nCondition: holds\nAcceptance: clean", "a slip · usual path: the work\n");
    work(p, "export const slip = 1;\n");
    issue(p, st, narrowCommit(p));
    recordDone(p, st);
    p.commit("done ends the range");
  },
};

test("[check.review-round.step-end-one] after each end of a step a second record of done on another commit leads --task, the brief and the guard to one narrow round, never to done, the merge or a round of acceptance alone; its clean verdict ends the step", () => {
  for (const [n, end] of Object.entries(ENDINGS)) {
    const { p, st } = approved();
    end(p, st);
    const merged = p.gate();
    assert.deepEqual(merged.codes, [], `ending ${n}: ${merged.out}`);
    // A second record of done on another commit, in a later second: a new result.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);
    doneWithVerdicts(p, st, `export const again${n} = 1;\n`);
    const task = p.tool("ont-check.mjs", ["--task", "t", "--statement", st.file]);
    const next = task.out.match(/^NEXT t: .*$/m)?.[0] ?? "";
    assert.match(next, /is a new result after the end of the step at .*: narrow round \d+, one round on it/, `ending ${n}: ${task.out}`);
    const g = p.gate();
    assert.deepEqual(g.codes, ["TASK_NOT_DONE"], `ending ${n}: ${g.out}`);
    assert.ok(g.out.includes(next.replace(/^NEXT t: /, "")), `ending ${n}: the guard and --task give one end: ${g.out}`);
    // The first round of the new window, which asks no verdicts of the record of a round; its clean verdict,
    // with the acceptance of the new record of done, ends the step: the merge.
    const r = round(p, st, "result", "By: m (p)\n\nCondition: holds\nAcceptance: clean", null, [], { verdicts: false });
    assert.match(r.brief, /^Narrow: true$/m, `ending ${n}: ${r.brief}`);
    assert.doesNotMatch(r.brief, /for the verdict of acceptance alone|^Round-checks:/m, `ending ${n}`);
    assert.equal(r.code, 0, `ending ${n}: ${r.out}`);
    p.commit("the narrow round on the new result");
    const after = p.gate();
    assert.deepEqual(after.codes, [], `ending ${n}: ${after.out}`);
  }
});

test("[check.review-round.step-end-one] a record of done made before the start of the gate of verdicts is read as before: the old task whose second record of done follows the end of its step stays done; after the start the rule holds", () => {
  // Before the key: a narrow round with a finding, the range ended by done, then a second record of done.
  const { p, st } = approved({ verdicts: false });
  work(p);
  recordDone(p, st);
  p.commit("done");
  resultRound(p, st, C_WITH_GAP, "a gap · usual path: the work\n");
  work(p, "export const gap = 1;\n");
  recordDone(p, st);
  p.commit("done");
  resultRound(p, st, "By: m (p)\n\n| a slip | important | change |\n\nCondition: holds\nAcceptance: clean", "a slip · usual path: the work\n");
  work(p, "export const slip = 1;\n");
  const fx = p.tool("round.mjs", ["fixes", "t", "--round", narrowFile(p), "--from", writeFile("a slip · app/fix.test.mjs · the fix of the slip\n")]);
  assert.equal(fx.code, 0, fx.out);
  recordDone(p, st);
  p.commit("done ends the range");
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);
  work(p, "export const later = 1;\n");
  recordDone(p, st);
  p.commit("a second record of done, before the start");
  const nextOf = () => p.tool("ont-check.mjs", ["--task", "t", "--statement", st.file]).out.match(/^NEXT t: .*$/m)?.[0] ?? "";
  assert.match(nextOf(), /^NEXT t: done: the record of done .* ends the range of fixes/);
  // The key switched on, in a later second: the old records are read as before.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);
  const cfg = JSON.parse(readFileSync(join(p.dir, "ont.config.json"), "utf8"));
  cfg.mergeGate.verdicts = true;
  p.put("ont.config.json", JSON.stringify(cfg, null, 2));
  p.commit("the gate of verdicts switched on");
  assert.match(nextOf(), /^NEXT t: done: the record of done .* ends the range of fixes/);
  // A record of done after the start: a new result, one narrow round on it.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);
  work(p, "export const afterStart = 1;\n");
  recordDone(p, st);
  p.commit("a record of done after the start");
  assert.match(nextOf(), /is a new result after the end of the step at .*: narrow round 2, one round on it/);
});

// ── The verdicts of the record of a round (item 5) ───────────────────────────────────────────────────

const FILED = "check.review-round.filed-right";
const WHOLE = "check.review-round.whole-class";
const CAUSE = "check.review-round.redesign-after-stagnation";
// A round of the result with an important finding of the usual path whose fix has no test yet, then the
// work and a new record of done: the next round is a full one, after a round with findings.
const withFinding = (p, st, cls = "a gap") => {
  resultRound(p, st, `By: m (p)\n\n| ${cls} | important | change |\n\nCondition: not yet\nAcceptance: clean`, `${cls} · usual path: the work\n`);
  work(p, `export const fix${Math.random().toString(36).slice(2, 7)} = 1;\n`);
  recordDone(p, st);
  p.commit("done");
};

test("[check.review-round.round-verdicts-required] a round after a round with findings is refused without the verdicts of the record of a round, and written with them; after stagnation the verdict of the analysis of the cause is asked too; the first round after the end of a step needs none", () => {
  const { p, st } = approved();
  reviewed(p, st);
  withFinding(p, st);
  const without = round(p, st, "result", "By: m (p)\n\nCondition: holds\nAcceptance: clean", null, [], { verdicts: false });
  assert.notEqual(without.code, 0, without.out);
  assert.match(without.brief, new RegExp(`^Round-checks: ${FILED}, ${WHOLE}$`, "m"));
  assert.match(without.out, new RegExp(`needs the verdicts of the record of a round.*${FILED}, ${WHOLE}`));
  const v = p.verdicts("main");
  assert.equal(v.code, 0, v.out);
  const r = p.tool("round.mjs", ["record", "t", "--from", reply(briefLines(without.brief), "By: m (p)\n\nCondition: holds\nAcceptance: clean")]);
  assert.equal(r.code, 0, r.out);
  const rec = readFileSync(join(p.dir, "reviews/rounds", readdirSync(join(p.dir, "reviews/rounds")).filter((f) => /-t-result-/.test(f)).sort().at(-1)), "utf8");
  assert.match(rec, new RegExp(`^Round-checks: ${FILED}, ${WHOLE}$`, "m"));
  p.commit("the closing round");
  assert.deepEqual(p.gate().codes, []);
  // The first round after the end of a step, on a new result: no verdicts asked.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);
  work(p, "export const next = 1;\n");
  recordDone(p, st);
  p.commit("a new result");
  const first = round(p, st, "result", "By: m (p)\n\nCondition: holds\nAcceptance: clean", null, [], { verdicts: false });
  assert.equal(first.code, 0, first.out);
  assert.doesNotMatch(first.brief, /^Round-checks:/m);
  // After stagnation the analysis of the cause is asked too.
  {
    const { p: q, st: s2 } = approved();
    reviewed(q, s2);
    withFinding(q, s2);
    withFinding(q, s2);
    const cause = writeFile("The fix of a gap did not hold because the test read the old file; the design keeps one reader.\n");
    const c = round(q, s2, "result", "By: m (p)\n\nCondition: holds\nAcceptance: clean", null, ["--cause", cause], { verdicts: false });
    assert.notEqual(c.code, 0, c.out);
    assert.match(c.brief, new RegExp(`^Round-checks: ${FILED}, ${WHOLE}, ${CAUSE}$`, "m"));
    assert.match(c.out, new RegExp(CAUSE));
  }
});

test("[check.merge-gate.round-verdicts-held] a clean closing round after a round with findings, its verdicts of the record of a round given, passes; a fail of one of them decided nowhere is VERDICT_FAILED; after a failed analysis of the cause the writer of the brief refuses the same analysis given again, and a later pass on the corrected analysis passes", () => {
  // Given, all passing.
  {
    const { p, st } = approved();
    reviewed(p, st);
    withFinding(p, st);
    resultRound(p, st);
    assert.deepEqual(p.gate().codes, []);
  }
  // A fail of the filing whose class no round filed: held, the closing round clean.
  {
    const { p, st } = approved();
    reviewed(p, st);
    withFinding(p, st);
    resultRound(p, st, undefined, null, { given: { [FILED]: ["fail", "[a filing of the usual path as rare] the round before filed a gap as later"] } });
    const g = p.gate();
    assert.deepEqual([...new Set(g.codes)], ["VERDICT_FAILED"], g.out);
    assert.match(g.out, /a filing of the usual path as rare/);
  }
  // A failed analysis of the cause: the next round must carry an analysis again; given the same one and a
  // pass, it is not corrected and holds the merge; given a corrected one and a pass, the merge passes.
  for (const corrected of [false, true]) {
    const { p, st } = approved();
    reviewed(p, st);
    withFinding(p, st);
    withFinding(p, st);
    const a = writeFile("The fix did not hold; the cause is the test.\n");
    resultRound(p, st, "By: m (p)\n\n| a slip | important | change |\n\nCondition: not yet\nAcceptance: clean", "a slip · usual path: the work\n", { extra: ["--cause", a], given: { [CAUSE]: ["fail", "[a cause not named] the analysis names no cause of the repeated class"] } });
    work(p, "export const after = 1;\n");
    recordDone(p, st);
    p.commit("done");
    const no = p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", st.file]);
    assert.notEqual(no.code, 0);
    assert.match(no.out, /failed in this step and no later pass decided it: give the corrected analysis with --cause/);
    // The same analysis given again: the writer of the brief refuses it, and no round can pass it.
    if (!corrected) {
      const same = p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", st.file, "--cause", a]);
      assert.notEqual(same.code, 0, same.out);
      assert.match(same.out, /is the analysis whose verdict .* failed: give the corrected analysis/);
      continue;
    }
    resultRound(p, st, undefined, null, { extra: ["--cause", writeFile("The fix did not hold because the test read the copy, not the file; one reader now.\n")] });
    const g = p.gate();
    assert.deepEqual(g.codes, [], g.out);
  }
});

test("[check.review-round.ready-after-clean] readiness for the merge is computed from the records: a clean last round passes, a last round with a finding is TASK_NOT_DONE, and a clean step with a failed verdict of the record of a round in its window is VERDICT_FAILED", () => {
  const { p, st } = approved();
  reviewed(p, st);
  withFinding(p, st);
  const q = copy(p);
  assert.deepEqual([...new Set(p.gate().codes)], ["TASK_NOT_DONE"]);
  resultRound(p, st);
  assert.deepEqual(p.gate().codes, []);
  resultRound(q, st, undefined, null, { given: { [WHOLE]: ["fail", "[a class seen in one place] the reviewer looked only at the line shown"] } });
  assert.deepEqual([...new Set(q.gate().codes)], ["VERDICT_FAILED"]);
});

test("[check.review-round.round-verdicts-required] on the step of the statement too, a round after a round with findings names the checks of the record of a round, and its writer refuses it without them", () => {
  const p = base();
  const st = statement();
  const r1 = round(p, st, "statement", "By: m (p)\n\n| a vague item | important | change |", "a vague item · usual path: the work\n");
  assert.equal(r1.code, 0, r1.out);
  p.commit("a round of the statement with a finding");
  const st2 = { file: st.file };
  writeFileSync(st2.file, `${readFileSync(st.file, "utf8")}\nThe item made precise.\n`);
  const r2 = round(p, st2, "statement", "By: m (p)", null, [], { verdicts: false });
  assert.notEqual(r2.code, 0, r2.out);
  assert.match(r2.brief, new RegExp(`^Round-checks: ${FILED}, ${WHOLE}$`, "m"));
  assert.match(r2.out, /needs the verdicts of the record of a round/);
});

test("[check.merge-gate.round-verdicts-held] a new result passes with its own verdicts after an earlier range of fixes decided a fail of a verdict of the record of a round with a test", () => {
  const { p, st } = approved();
  reviewed(p, st);
  resultRound(p, st, "By: m (p)\n\n| a gap | important | change |\n\nCondition: holds\nAcceptance: clean", "a gap · usual path: the work\n");
  work(p, "export const gapFixed = 1;\n");
  recordDone(p, st);
  p.commit("done");
  // The narrow round, after a round with findings: its verdict of the filing fails, with a class.
  const narrow = resultRound(p, st, "By: m (p)\n\n| a slip | important | change |\n\nCondition: holds\nAcceptance: clean", "a slip · usual path: the work\n", { given: { [FILED]: ["fail", "[a slip of filing] the round before filed a gap of the usual path"] } });
  assert.ok(runs(p).some((t) => /^Check: check\.review-round\.filed-right$/m.test(t) && /^Verdict: fail$/m.test(t)));
  // The range of fixes decides both classes with a test, the issue and done end it: the merge passes.
  work(p, "export const slipFixed = 1;\n");
  issue(p, st, narrowCommit(p), { tests: "a slip · app/fix.test.mjs · the fix of the slip\na slip of filing · app/fix.test.mjs · the fix of the gap\n" });
  recordDone(p, st);
  p.commit("done ends the range");
  const ended = p.gate();
  assert.deepEqual(ended.codes, [], ended.out);
  // A new result after that end: one narrow round on it, the first of its window, which asks no verdicts
  // of the record of a round; with its own verdicts of the change it passes, the earlier fail not read.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);
  work(p, "export const newResult = 1;\n");
  recordDone(p, st);
  p.commit("a new result");
  const v = p.verdicts("main");
  assert.equal(v.code, 0, v.out);
  p.commit("the verdicts of the new result");
  const b = round(p, st, "result", "By: m (p)\n\nCondition: holds\nAcceptance: clean", null, [], { verdicts: false });
  assert.equal(b.code, 0, b.out);
  assert.doesNotMatch(b.brief, /^Round-checks:/m);
  p.commit("the narrow round on the new result");
  const g = p.gate();
  assert.deepEqual(g.codes, [], g.out);
});

test("[check.merge-gate.round-verdicts-held] a failed analysis of the cause in the last narrow round is decided by the one issue's pass on the corrected analysis, whose hash its evidence names; the issue's pass on the same analysis leaves VERDICT_FAILED", () => {
  for (const corrected of [true, false]) {
    const { p, st } = approved();
    reviewed(p, st);
    withFinding(p, st);
    // The same class again with the condition confirmed: the rounds stagnate, and the one round after C is
    // a narrow round after the analysis of the cause.
    resultRound(p, st, "By: m (p)\n\n| a gap | important | change |\n\nCondition: holds\nAcceptance: clean", "a gap · usual path: the work\n");
    work(p, "export const afterC = 1;\n");
    recordDone(p, st);
    p.commit("done");
    const analysis = "The fix of a gap did not hold; the cause is the test.\n";
    const narrow = resultRound(p, st, "By: m (p)\n\n| a slip | important | change |\n\nCondition: holds\nAcceptance: clean", "a slip · usual path: the work\n", { extra: ["--cause", writeFile(analysis)], given: { [CAUSE]: ["fail", "[a cause not named] the analysis names no cause of the repeated class"] } });
    assert.match(readFileSync(join(p.dir, "reviews/rounds", narrowFile(p)), "utf8"), /^Cause: [0-9a-f]{64}$/m);
    // No round follows the narrow round after C: the one issue gives the verdict on the analysis.
    work(p, "export const slipFixed = 1;\n");
    const listed = p.tool("ont-check.mjs", ["--review", narrowCommit(p)]);
    assert.match(listed.out, new RegExp(`^CAUSE t: .*${CAUSE} is listed`, "m"), listed.out);
    const fixedText = "The fix of a gap did not hold because the test read the copy, not the file; one reader now.\n";
    const hash = sha256(corrected ? fixedText : analysis);
    issue(p, st, narrowCommit(p), { given: { [CAUSE]: ["pass", `the analysis ${hash} names the cause and the change follows from it`] } });
    recordDone(p, st);
    p.commit("done ends the range");
    const g = p.gate();
    assert.deepEqual([...new Set(g.codes)], corrected ? [] : ["VERDICT_FAILED"], g.out);
    if (!corrected) assert.match(g.out, /no later pass in the window was given on a corrected analysis/);
  }
});

test("[check.review-round.round-verdicts-required] a failed verdict of the analysis of the cause that no round of the window asked for, of another task or given before the rule, does not hold the brief; one a round asked for on Round-checks: does", () => {
  // Before the start: a failed verdict of the analysis with no round that named it on Round-checks:.
  {
    const { p, st } = approved();
    reviewed(p, st);
    withFinding(p, st);
    forge(p, { check: CAUSE, commit: p.git("rev-parse", "--short", "HEAD"), stamp: "00000000", verdict: "fail", evidence: "[a cause not named] an earlier task's analysis", cls: "a cause not named" });
    p.commit("an old failed verdict of the analysis");
    const b = p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", st.file]);
    assert.equal(b.code, 0, b.out);
    assert.doesNotMatch(b.out, /^Cause:/m);
  }
  // After the start: the verdict a round asked for holds the next brief until a corrected analysis.
  {
    const { p, st } = approved();
    reviewed(p, st);
    withFinding(p, st);
    withFinding(p, st);
    resultRound(p, st, "By: m (p)\n\n| a slip | important | change |\n\nCondition: not yet\nAcceptance: clean", "a slip · usual path: the work\n", { extra: ["--cause", writeFile("The cause is the test.\n")], given: { [CAUSE]: ["fail", "[a cause not named] the analysis names no cause"] } });
    work(p, "export const after = 1;\n");
    recordDone(p, st);
    p.commit("done");
    const b = p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", st.file]);
    assert.notEqual(b.code, 0, b.out);
    assert.match(b.out, /failed in this step and no later pass decided it/);
  }
});

// ── Findings of round 1 of the review of the result ──────────────────────────────────────────────────

test("[check.merge-gate.verdicts-usual-path] records of gate changes after the work, then done, then the verdicts: done, the writer of verdicts and the guard name one commit, the one that ended the work", () => {
  const { p, st } = approved();
  p.put("tools/ont-check/extra.mjs", "// ont: ent.thing\nexport const extra = 1;\n");
  const w = work(p);
  const gc = p.tool("gate-record.mjs", ["change", "t", "--statement", st.file, "--clause", "1", "--paths", "tools/ont-check/extra.mjs", "--base", "main"]);
  assert.equal(gc.code, 0, gc.out);
  p.commit("the record of the gate change");
  recordDone(p, st);
  p.commit("done");
  const v = p.verdicts("main");
  assert.equal(v.code, 0, v.out);
  p.commit("the verdicts");
  const done = readFileSync(join(p.dir, "reviews/tasks", readdirSync(join(p.dir, "reviews/tasks")).filter((f) => /-t-done/.test(f)).sort().at(-1)), "utf8");
  assert.match(done, new RegExp(`^Commit: ${w}$`, "m"));
  assert.ok(runs(p).every((t) => t.includes(`Commit: ${w.slice(0, 7)}`)));
  resultRound(p, st);
  const g = p.gate();
  assert.deepEqual(g.codes, [], g.out);
});

test("[check.merge-gate.issue-missing] the one issue is held only by verdicts given on its own diff: records on the commit of the issue given on another diff, from main, are ISSUE_MISSING; on the diff from the narrow round's commit they hold it", () => {
  for (const own of [false, true]) {
    const { p, st, narrow, fix } = narrowed();
    const v = p.verdicts(own ? narrow : "main");
    assert.equal(v.code, 0, v.out);
    assert.ok(runs(p).some((t) => t.includes(`Base: ${own ? narrow : p.git("rev-parse", "main")}`)));
    p.commit("verdicts on the commit of the issue");
    const fx = p.tool("round.mjs", ["fixes", "t", "--round", narrowFile(p), "--issue", fix, "--from", writeFile("a slip · app/fix.test.mjs · the fix of the slip\n")]);
    assert.equal(fx.code, 0, fx.out);
    recordDone(p, st);
    p.commit("done");
    const g = p.gate();
    assert.deepEqual([...new Set(g.codes)], own ? [] : ["ISSUE_MISSING"], g.out);
  }
});

test("[check.merge-gate.fix-untested] a filing of a finding of the narrow round in the record of fixes counts only in a valid destination that holds the class at the head: a filing in an unrelated file is refused by the writer, and one whose file is removed before done does not decide the finding", () => {
  // An unrelated file that holds the class: the writer refuses it.
  {
    const { p, narrow } = narrowed();
    p.put("docs/page.md", "# A page\n\na slip\n");
    const at = p.commit("a page that names the class");
    const v = p.verdicts(narrow);
    assert.equal(v.code, 0, v.out);
    p.commit("the issue");
    const fx = p.tool("round.mjs", ["fixes", "t", "--round", narrowFile(p), "--issue", at, "--filed", writeFile("a slip · later · docs/page.md\n")]);
    assert.notEqual(fx.code, 0, fx.out);
    assert.match(fx.out, /not a file under issues\//);
  }
  // A ticket that holds the class decides it; the same ticket removed before done does not.
  for (const removed of [false, true]) {
    const { p, st, narrow } = narrowed();
    p.put("issues/0003-a-slip.md", "# A slip\n\na slip\n");
    const at = p.commit("the slip filed");
    issue(p, st, narrow, { tests: "", filed: "a slip · later · issues/0003-a-slip.md\n", at });
    if (removed) {
      p.put("issues/0003-a-slip.md", "# A ticket\n\nNothing here now.\n");
      p.commit("the ticket emptied");
    }
    recordDone(p, st);
    p.commit("done");
    const g = p.gate();
    if (!removed) assert.deepEqual(g.codes, [], g.out);
    else assert.ok(g.codes.includes("FIX_UNTESTED") && /"a slip"/.test(g.out), g.out);
  }
});

test("[check.merge-gate.issue-usual-path] an empty list of the issue, without a finding and with one, and a final diff that lists the checks of a judge only by a change of a test and a later file the configuration does not know: each passes, the range holding what the final list adds", () => {
  // The fix in a file that lists no check: the issue's list is empty.
  for (const finding of [false, true]) {
    const { p, st, narrow } = narrowed();
    // The fixture's fix of the code taken back, so that the diff from the narrow round holds the page alone.
    p.git("checkout", narrow, "--", "app/work.mjs");
    p.put("docs/page.md", `${readFileSync(join(p.dir, "docs/page.md"), "utf8")}A line no check reads.\n`);
    const at = p.commit("a fix no check reads");
    assert.deepEqual(p.list(narrow), []);
    const v = p.verdicts(narrow);
    assert.equal(v.code, 0, v.out);
    issue(p, st, narrow, { at, ...(finding ? { findings: "| a stale line | important | change |\n", tests: "a slip · app/fix.test.mjs · the fix of the slip\na stale line · app/fix.test.mjs · the fix of the gap\n" } : {}) });
    recordDone(p, st);
    p.commit("done");
    const g = p.gate();
    assert.deepEqual(g.codes, [], `${finding ? "with" : "without"} a finding: ${g.out}`);
  }
  // A change of a test in one commit and a later file nothing describes in another: the final diff lists
  // the checks of a judge, which neither the issue's diff nor the narrow round's lists.
  {
    const { p, st, narrow } = narrowed({ suite: true });
    p.git("checkout", narrow, "--", "app/work.mjs");
    p.add("app/fix.test.mjs", "// a change of a test\n");
    const at = p.commit("a fix of a test");
    const JUDGE = "check.check.judge-sees-the-check";
    assert.ok(!p.list(narrow).some((c) => c.id === JUDGE), JSON.stringify(p.list(narrow)));
    // The issue finds a setting missing; its fix, the later file, is held by a test of the range.
    issue(p, st, narrow, { at, findings: "| a setting missing | important | change |\n", tests: "a slip · app/fix.test.mjs · the fix of the slip\na setting missing · app/fix.test.mjs · the fix of the gap\n" });
    p.put("config/settings.json", '{ "a": 1 }\n');
    p.commit("a file the configuration does not know");
    assert.ok(p.list().some((c) => c.id === JUDGE), JSON.stringify(p.list()));
    // The later file alone lists no check of a judge either: only the final diff does.
    assert.ok(!p.list(at).some((c) => c.id === JUDGE), JSON.stringify(p.list(at)));
    recordDone(p, st);
    p.commit("done");
    const g = p.gate();
    assert.deepEqual(g.codes, [], g.out);
  }
});

test("[check.merge-gate.round-verdicts-held] a failed analysis is not given again: the next brief refuses the same analysis and asks the corrected one; and at the merge a pass outside the rounds counts only from the one issue, on its own diff", () => {
  // The brief: a fail on analysis A; the next brief refuses A given again, and refuses no analysis at all.
  {
    const { p, st } = approved();
    reviewed(p, st);
    withFinding(p, st);
    withFinding(p, st);
    const a = writeFile("The cause is the test.\n");
    resultRound(p, st, "By: m (p)\n\n| a slip | important | change |\n\nCondition: not yet\nAcceptance: clean", "a slip · usual path: the work\n", { extra: ["--cause", a], given: { [CAUSE]: ["fail", "[a cause not named] the analysis names no cause"] } });
    work(p, "export const second = 1;\n");
    recordDone(p, st);
    p.commit("done");
    const same = p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", st.file, "--cause", a]);
    assert.notEqual(same.code, 0, same.out);
    assert.match(same.out, /is the analysis whose verdict .* failed: give the corrected analysis/);
    const none = p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", st.file]);
    assert.notEqual(none.code, 0, none.out);
    assert.match(none.out, /failed in this step and no later pass decided it|the next action is the analysis of the cause/);
  }
  // The merge: after the last narrow round, a pass naming a corrected analysis given on another diff of the
  // commit of the issue is no pass of the issue; the issue's own verdict is a not-run: VERDICT_FAILED.
  {
    const { p, st } = approved();
    reviewed(p, st);
    withFinding(p, st);
    resultRound(p, st, "By: m (p)\n\n| a gap | important | change |\n\nCondition: holds\nAcceptance: clean", "a gap · usual path: the work\n");
    work(p, "export const afterC = 1;\n");
    recordDone(p, st);
    p.commit("done");
    resultRound(p, st, "By: m (p)\n\n| a slip | important | change |\n\nCondition: holds\nAcceptance: clean", "a slip · usual path: the work\n", { extra: ["--cause", writeFile("The cause is the test.\n")], given: { [CAUSE]: ["fail", "[a cause not named] the analysis names no cause"] } });
    work(p, "export const slipFixed = 1;\n");
    const other = p.verdicts("main", { [CAUSE]: ["pass", `the analysis ${sha256("A corrected analysis.\n")} names the cause`] });
    assert.equal(other.code, 0, other.out);
    issue(p, st, narrowCommit(p), { given: { [CAUSE]: ["not run", "the reviewer of the issue was given no analysis"] } });
    recordDone(p, st);
    p.commit("done ends the range");
    const g = p.gate();
    assert.ok(g.codes.includes("VERDICT_FAILED") && /no later pass in the window was given on a corrected analysis/.test(g.out), g.out);
  }
});

// ── Findings of round 2 of the review of the result ──────────────────────────────────────────────────

test("[check.merge-gate.verdicts-run-nothing] the list of the change is computed only from paths inside the checked tree: a configuration at the checked commit that names a path out of it, by \"..\" or by a link, is refused, and nothing out of the tree is read", () => {
  const p = base();
  const outside = join(temp("ont-outside-"), "secret.md");
  writeFileSync(outside, "# a file outside\n");
  const cfg = JSON.parse(readFileSync(join(p.dir, "ont.config.json"), "utf8"));
  const tryList = (edit) => {
    const q = copy(p);
    const c = structuredClone(cfg);
    edit(c, q);
    q.put("ont.config.json", JSON.stringify(c, null, 2));
    const commit = q.commit("a configuration that names a path");
    try {
      return { list: changeList({ cfg: loadConfig(join(q.dir, "ont.config.json")), top: q.dir, commit, from: q.git("rev-parse", "main"), tmp: temp("ont-list-") }) };
    } catch (e) {
      return { error: e.message };
    }
  };
  const up = tryList((c) => (c.ontology = "../../outside.md"));
  assert.match(up.error ?? "", /names paths outside its tree/, JSON.stringify(up));
  const link = tryList((c, q) => {
    symlinkSync(outside, join(q.dir, "linked.md"));
    c.ontology = "linked.md";
  });
  assert.match(link.error ?? "", /names paths outside its tree/, JSON.stringify(link));
  const inside = tryList((c, q) => q.put("notes.md", "# notes\n"));
  assert.ok(Array.isArray(inside.list), JSON.stringify(inside));
});

test("[check.merge-gate.verdict-failed] a class filed by an earlier round waives no later fail of the same class: only the round that ended the step, or the records of fixes of its range, decide it", () => {
  for (const filedAtEnd of [false, true]) {
    const { p, st } = approved();
    p.put("issues/0004-a-slip-of-code.md", "# A slip\n\na slip of code\n");
    reviewed(p, st);
    // Round 1 files the class for later, with a gap of the usual path beside it.
    resultRound(p, st, "By: m (p)\n\n| a slip of code | nit | change |\n| a gap | important | change |\n\nCondition: not yet\nAcceptance: clean", "a slip of code · later: issues/0004-a-slip-of-code.md\na gap · usual path: the work\n");
    work(p, "export const gapFixed = 1;\n");
    recordDone(p, st);
    p.commit("done");
    // A later fail of the check of errors in code with the same class; the closing round files it, or not.
    const rest = filedAtEnd ? "By: m (p)\n\n| a slip of code | nit | change |\n\nCondition: not yet\nAcceptance: clean" : "By: m (p)\n\nCondition: not yet\nAcceptance: clean";
    resultRound(p, st, rest, filedAtEnd ? "a slip of code · later: issues/0004-a-slip-of-code.md\n" : null, { given: { [CODE]: ["fail", "[a slip of code] app/work.mjs:4 names a value twice"] } });
    const g = p.gate();
    assert.deepEqual([...new Set(g.codes)], filedAtEnd ? [] : ["VERDICT_FAILED"], g.out);
  }
});

test("[check.merge-gate.issue-missing] records of runs outside a review on the commit of the issue name no base and hold no issue; and the writer of fixes takes the class of a fail of the issue only from a record given on the issue's own diff", () => {
  // Runs outside a review, Origin: run, for every check of the issue's list on its commit: ISSUE_MISSING.
  {
    const { p, st, narrow, fix } = narrowed();
    p.list(narrow).forEach((c, i) => forge(p, { check: c.id, commit: fix, stamp: c.stamp, verdict: "pass", evidence: "a run", origin: "run", time: new Date(Date.now() + 1000 + i * 1000) }));
    p.commit("runs outside a review");
    const fx = p.tool("round.mjs", ["fixes", "t", "--round", narrowFile(p), "--issue", fix, "--from", writeFile("a slip · app/fix.test.mjs · the fix of the slip\n")]);
    assert.equal(fx.code, 0, fx.out);
    recordDone(p, st);
    p.commit("done");
    assert.ok(p.gate().codes.includes("ISSUE_MISSING"));
  }
  // A fail given on another diff of the commit of the issue: its class is no class of the issue.
  {
    const { p, fix } = narrowed();
    const v = p.verdicts("main", { [OTHER]: ["fail", "[a gap of another diff] app/work.mjs:2"] });
    assert.equal(v.code, 0, v.out);
    p.commit("a fail on another diff");
    const fx = p.tool("round.mjs", ["fixes", "t", "--round", narrowFile(p), "--issue", fix, "--from", writeFile("a gap of another diff · app/fix.test.mjs · the fix of the gap\n")]);
    assert.notEqual(fx.code, 0, fx.out);
    assert.match(fx.out, /a gap of another diff is not the class of a fixable finding/);
  }
});

// ── Findings of round 3 of the review of the result ──────────────────────────────────────────────────

test("[check.merge-gate.verdicts-run-nothing] the guard reads no file out of the checked tree: a link out of it under a directory the configuration names, and a configuration that is itself a link out of it, are refused before anything is read; a link inside the tree is not", () => {
  const p = base();
  const outside = join(temp("ont-outside-"), "secret.md");
  writeFileSync(outside, "# a file outside\n");
  // A configuration out of the tree that cannot be parsed: had the guard read it, its error would say so.
  const outsideCfg = join(temp("ont-outside-"), "ont.config.json");
  writeFileSync(outsideCfg, "not a configuration {\n");
  const cfg = loadConfig(join(p.dir, "ont.config.json"));
  const tryList = (edit) => {
    const q = copy(p);
    edit(q);
    const commit = q.commit("a link in the tree");
    try {
      return { list: changeList({ cfg: { ...cfg, file: join(q.dir, "ont.config.json") }, top: q.dir, commit, from: q.git("rev-parse", "main"), tmp: temp("ont-list-") }) };
    } catch (e) {
      return { error: e.message };
    }
  };
  // A file found under the doc set's directory, help/, that links out of the tree.
  const under = tryList((q) => symlinkSync(outside, join(q.dir, "help/linked.md")));
  assert.match(under.error ?? "", /names paths outside its tree/, JSON.stringify(under));
  assert.match(under.error, /help\/linked\.md \(a link\)/);
  // The configuration itself a link out of the tree: refused by its path, never parsed.
  const self = tryList((q) => {
    rmSync(join(q.dir, "ont.config.json"));
    symlinkSync(outsideCfg, join(q.dir, "ont.config.json"));
  });
  assert.match(self.error ?? "", /names paths outside its tree/, JSON.stringify(self));
  assert.match(self.error, /ont\.config\.json \(a link\)/);
  assert.doesNotMatch(self.error, /JSON|Unexpected|token/);
  // A link whose target is in the tree.
  const inside = tryList((q) => symlinkSync("thing.md", join(q.dir, "help/alias.md")));
  assert.ok(Array.isArray(inside.list), JSON.stringify(inside));
});

test("[check.merge-gate.round-verdicts-held] a fail of a verdict of the record of a round whose class only an earlier round of the window filed is VERDICT_FAILED; filed by the round that ended the step, it passes", () => {
  for (const filedAtEnd of [false, true]) {
    const { p, st } = approved();
    p.put("issues/0004-a-slip-of-filing.md", "# A slip\n\na slip of filing\n");
    reviewed(p, st);
    // Round 1 files the class for later, with a gap of the usual path beside it.
    resultRound(p, st, "By: m (p)\n\n| a slip of filing | nit | change |\n| a gap | important | change |\n\nCondition: not yet\nAcceptance: clean", "a slip of filing · later: issues/0004-a-slip-of-filing.md\na gap · usual path: the work\n");
    work(p, "export const gapFixed = 1;\n");
    recordDone(p, st);
    p.commit("done");
    // The closing round's verdict of the whole class fails with the same class; that round files it, or not.
    const rest = filedAtEnd ? "By: m (p)\n\n| a slip of filing | nit | change |\n\nCondition: not yet\nAcceptance: clean" : "By: m (p)\n\nCondition: not yet\nAcceptance: clean";
    resultRound(p, st, rest, filedAtEnd ? "a slip of filing · later: issues/0004-a-slip-of-filing.md\n" : null, { given: { [WHOLE]: ["fail", "[a slip of filing] the round before looked at one place of its class"] } });
    const g = p.gate();
    assert.deepEqual([...new Set(g.codes)], filedAtEnd ? [] : ["VERDICT_FAILED"], g.out);
    if (!filedAtEnd) assert.match(g.out, /a slip of filing.*a verdict of the record of a round/);
  }
});

test("[check.merge-gate.fix-untested] a fail of the one issue whose class only the narrow round filed is FIX_UNTESTED: only the records of fixes decide the findings of the issue", () => {
  for (const filedInFixes of [false, true]) {
    const { p, st } = approved();
    p.put("issues/0005-a-nit-of-code.md", "# A nit\n\na nit of code\n");
    reviewed(p, st);
    resultRound(p, st, "By: m (p)\n\n| a gap | important | change |\n\nCondition: holds\nAcceptance: clean", "a gap · usual path: the work\n");
    work(p, "export const gapFixed = 1;\n");
    recordDone(p, st);
    p.commit("done");
    const v = p.verdicts("main");
    assert.equal(v.code, 0, v.out);
    p.commit("the verdicts of the fix");
    // The narrow round files the class for later beside a finding of the usual path.
    resultRound(p, st, "By: m (p)\n\n| a slip | important | change |\n| a nit of code | nit | change |\n\nCondition: holds\nAcceptance: clean", "a slip · usual path: the work\na nit of code · later: issues/0005-a-nit-of-code.md\n");
    work(p, "export const slipFixed = 1;\n");
    // The issue fails the check of errors in code with the class the narrow round filed.
    issue(p, st, narrowCommit(p), { given: { [CODE]: ["fail", "[a nit of code] app/work.mjs:5 names a value twice"] }, ...(filedInFixes ? { filed: "a nit of code · later · issues/0005-a-nit-of-code.md\n" } : {}) });
    recordDone(p, st);
    p.commit("done ends the range");
    const g = p.gate();
    if (filedInFixes) assert.deepEqual(g.codes, [], g.out);
    else {
      assert.deepEqual([...new Set(g.codes)], ["FIX_UNTESTED"], g.out);
      assert.match(g.out, /a nit of code/);
    }
  }
});

test("[check.merge-gate.round-verdicts-held] after the last narrow round the latest verdict of the analysis of the cause decides it: the issue's pass on the corrected analysis followed by its fail leaves VERDICT_FAILED", () => {
  const { p, st } = approved();
  reviewed(p, st);
  withFinding(p, st);
  resultRound(p, st, "By: m (p)\n\n| a gap | important | change |\n\nCondition: holds\nAcceptance: clean", "a gap · usual path: the work\n");
  work(p, "export const afterC = 1;\n");
  recordDone(p, st);
  p.commit("done");
  resultRound(p, st, "By: m (p)\n\n| a slip | important | change |\n\nCondition: holds\nAcceptance: clean", "a slip · usual path: the work\n", { extra: ["--cause", writeFile("The fix of a gap did not hold; the cause is the test.\n")], given: { [CAUSE]: ["fail", "[a cause not named] the analysis names no cause of the repeated class"] } });
  work(p, "export const slipFixed = 1;\n");
  const hash = sha256("The fix of a gap did not hold because the test read the copy, not the file; one reader now.\n");
  issue(p, st, narrowCommit(p), { given: { [CAUSE]: ["pass", `the analysis ${hash} names the cause and the change follows from it`] } });
  p.commit("the record of fixes");
  // The reviewer of the issue then fails the same check on the issue's own diff, on the commit of the issue.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);
  const again = p.verdicts(narrowCommit(p), { [CAUSE]: ["fail", `[a cause not named] the analysis ${hash} names no cause either`] });
  assert.equal(again.code, 0, again.out);
  assert.ok(runs(p).some((t) => t.includes(CAUSE) && /^Verdict: fail$/m.test(t) && /^Commit: [0-9a-f]{7,40}$/m.test(t) && /names no cause either/.test(t)));
  p.commit("the latest verdict of the issue");
  recordDone(p, st);
  p.commit("done ends the range");
  const g = p.gate();
  assert.deepEqual([...new Set(g.codes)], ["VERDICT_FAILED"], g.out);
  assert.match(g.out, /the latest verdict of the check after it, .* is a fail/);
});

// ── Findings of narrow round 1 of the review of the result ───────────────────────────────────────────

test("[check.merge-gate.verdicts-run-nothing] the checker the guard runs reads no file out of the checked tree, whatever names it: a row of the implementation table that names one by a relative path or by a link is refused at the read itself, and gives no list; the usual tree reads as before", () => {
  const p = base();
  const cfg = loadConfig(join(p.dir, "ont.config.json"));
  // A row of the implementation table that names a file: the configuration names no path out of the tree.
  const withRow = (q, file) => q.put("ontology.md", readFileSync(join(q.dir, "ontology.md"), "utf8").replace("| --- | -------------- | ---- |\n", `| --- | -------------- | ---- |\n| \`ent.thing\` | \`${file}\` | |\n`));
  const tryList = (edit) => {
    const q = copy(p);
    const tmp = temp("ont-list-");
    // The file out of the tree, beside the guard's working tree of the list, which "../" from it reaches.
    writeFileSync(join(tmp, "secret.mjs"), "// ont: ent.thing\nexport const secret = 1;\n");
    edit(q, tmp);
    const commit = q.commit("a row of the implementation table");
    try {
      return { list: changeList({ cfg: { ...cfg, file: join(q.dir, "ont.config.json") }, top: q.dir, commit, from: q.git("rev-parse", "main"), tmp }) };
    } catch (e) {
      return { error: e.message };
    }
  };
  // By a relative path: no scan of the configuration sees it, the read refuses it.
  const up = tryList((q) => withRow(q, "../secret.mjs"));
  assert.match(up.error ?? "", /would read a path outside its tree, which the guard refuses, and gives no list: .*secret\.mjs/, JSON.stringify(up));
  // The usual tree, a row naming a file of the tree: its list, as before.
  const inside = tryList((q) => withRow(q, "app/work.mjs"));
  assert.ok(Array.isArray(inside.list) && inside.list.length, JSON.stringify(inside));
  // The hold is the read, not the scan before it: the checker run with --confine alone, as the guard runs it,
  // refuses a row that names a file out of the tree by a relative path and by a link, naming its real path.
  const outside = join(temp("ont-outside-"), "secret.mjs");
  writeFileSync(outside, "// ont: ent.thing\nexport const secret = 1;\n");
  const confined = (edit) => {
    const q = copy(p);
    edit(q);
    q.commit("a row of the implementation table");
    const r = spawnSync(process.execPath, [join(q.dir, "tools/ont-check/ont-check.mjs"), "--config", join(q.dir, "ont.config.json"), "--review", "main", "--json", "--confine", q.dir], { cwd: q.dir, encoding: "utf8", env: GIT_ENV });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  for (const r of [
    confined((q) => withRow(q, relative(q.dir, outside))),
    confined((q) => {
      symlinkSync(outside, join(q.dir, "app/linked.mjs"));
      withRow(q, "app/linked.mjs");
    }),
  ]) {
    assert.equal(r.code, 3, r.out);
    assert.match(r.out, new RegExp(`^READ_OUTSIDE ${realpathSync(outside).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m"), r.out);
    assert.doesNotMatch(r.out, /^REVIEW_JSON /m);
  }
  const usual = confined((q) => withRow(q, "app/work.mjs"));
  assert.equal(usual.code, 0, usual.out);
  assert.match(usual.out, /^REVIEW_JSON /m);
  // --confine is the guard's alone: without --review and --json it is refused.
  const alone = spawnSync(process.execPath, [join(p.dir, "tools/ont-check/ont-check.mjs"), "--config", join(p.dir, "ont.config.json"), "--confine", p.dir], { cwd: p.dir, encoding: "utf8", env: GIT_ENV });
  assert.equal(alone.status, 2, alone.stderr);
});

test("[check.merge-gate.round-verdicts-held] the writer of the brief and the guard derive a failed analysis of the cause by one function: after a fail, a pass on the corrected analysis and a not-run, both hold the failure; after a fail and a pass on the corrected analysis, both clear it", () => {
  const { p, st } = approved();
  reviewed(p, st);
  withFinding(p, st);
  withFinding(p, st);
  // The round after stagnation fails the analysis of the cause.
  resultRound(p, st, "By: m (p)\n\n| a slip | important | change |\n\nCondition: not yet\nAcceptance: clean", "a slip · usual path: the work\n", { extra: ["--cause", writeFile("The cause is the test.\n")], given: { [CAUSE]: ["fail", "[a cause not named] the analysis names no cause"] } });
  work(p, "export const slipFixed = 1;\n");
  recordDone(p, st);
  p.commit("done");
  const corrected = writeFile("The fix of a slip did not hold because the test read the copy, not the file; one reader now.\n");
  const pass = { [CAUSE]: ["pass", `the analysis ${sha256(readFileSync(corrected))} names the cause`] };
  const third = () => writeFile(`A third analysis of the cause, ${Math.random()}.\n`);
  const notRun = { [CAUSE]: ["not run", "the reviewer was given no time for the analysis"] };
  const held = /failed in this step and no later pass decided it: give the corrected analysis with --cause/;
  const brief = (q) => q.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", st.file]);
  const guarded = (q) => /failed the analysis of the cause of .*no later pass in the window was given on a corrected analysis/.test(q.gate().out);
  // Fail, pass: the guard, after the pass in the closing round, clears it ...
  {
    const q = copy(p);
    resultRound(q, st, undefined, null, { extra: ["--cause", corrected], given: pass });
    const g = q.gate();
    assert.ok(!guarded(q), g.out);
    assert.deepEqual(g.codes, [], g.out);
  }
  // ... and so does the writer of the next brief, after the pass in a round with a finding.
  const q = copy(p);
  resultRound(q, st, "By: m (p)\n\n| a nick | important | change |\n\nCondition: not yet\nAcceptance: clean", "a nick · usual path: the work\n", { extra: ["--cause", corrected], given: pass });
  work(q, "export const nickFixed = 1;\n");
  recordDone(q, st);
  q.commit("done");
  assert.doesNotMatch(brief(q).out, held);
  // Fail, pass, not run: the guard, with the not-run in the closing round, holds it ...
  {
    const r = copy(q);
    resultRound(r, st, undefined, null, { extra: ["--cause", third()], given: notRun });
    assert.ok(guarded(r), r.gate().out);
    assert.ok(r.gate().codes.includes("VERDICT_FAILED"));
  }
  // ... and so does the writer of the next brief, with the not-run in a round with a finding.
  resultRound(q, st, "By: m (p)\n\n| a dent | important | change |\n\nCondition: not yet\nAcceptance: clean", "a dent · usual path: the work\n", { extra: ["--cause", third()], given: notRun });
  work(q, "export const dentFixed = 1;\n");
  recordDone(q, st);
  q.commit("done");
  const b = brief(q);
  assert.notEqual(b.code, 0, b.out);
  assert.match(b.out, held);
});
