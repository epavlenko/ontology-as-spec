// The merge by the state of the task (D-185): which changes need a task, how a pull request is tied to its
// task by the records it adds, what the guard reads of the statement and of the owner's permission, the
// owner's answer to a gate that approves no version, the gate paths of an approval, and the comparison of
// the rules of main on GitHub with the rule file. Each attack of item 6 of the statement of task
// enforcement-task-state is a test here, on repositories whose records the tool's writers wrote, and so is
// each usual path.
// ont: rule.merge-by-task-state, rule.records-only-pr, derived.pr-task, field.merge-gate.task-state, inv.gate-path-in-approval, inv.rules-match-file, action.compare-rules, ent.publish-permission, action.record-publication
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../lib.mjs";
import { compareRules, guard } from "../merge-gate.mjs";
import { sealed } from "../seal.mjs";
import { approvedHash, readStatement, readTaskInputs, sha256, taskNext } from "../tasks.mjs";

const TOP = fileURLToPath(new URL("../../../", import.meta.url));
const TOOLS = join(TOP, "tools/ont-check");
const ROOT_CFG = JSON.parse(readFileSync(join(TOP, "ont.config.json"), "utf8"));
const RULES = JSON.parse(readFileSync(join(TOP, ".github/merge-gate.json"), "utf8"));
const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.org", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.org" };
for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMITTER_DATE", "GIT_AUTHOR_DATE", "NODE_TEST_CONTEXT", "ONT_CLAUDE_LOGS", "ONT_CODEX_LOGS", "ONT_EXECUTOR_SESSIONS", "ONT_GOAL_STATEMENT", "ONT_REGISTRY_CMD", "ONT_GH_CMD"]) delete GIT_ENV[k];
const temps = [];
after(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })));
const temp = (name = "ont-task-state-") => {
  const d = mkdtempSync(join(tmpdir(), name));
  temps.push(d);
  return d;
};
const writeFile = (text) => {
  const f = join(temp("ont-file-"), "file.txt");
  writeFileSync(f, text);
  return f;
};

// A registry's command: prints the entry of the question it is given from a file of entries.
function registry(entries) {
  const d = temp("ont-registry-");
  writeFileSync(join(d, "entries.json"), JSON.stringify(entries));
  writeFileSync(join(d, "registry.mjs"), `import { readFileSync } from "node:fs";\nconst e = JSON.parse(readFileSync(${JSON.stringify(join(d, "entries.json"))}, "utf8"))[process.argv[2]];\nif (!e) process.exit(1);\nconsole.log(JSON.stringify(e));\n`);
  return `${process.execPath} ${join(d, "registry.mjs")}`;
}
const answered = (question, meaning = "approve") => ({ question, options: [{ key: "a", meaning }], answer: { by: "owner", date: "2026-11-24", option: "a" } });

// A command of gh api that answers by the end of the path asked: a value is printed as JSON, an object with
// error makes the call fail.
function ghStub(answers) {
  const d = temp("ont-gh-");
  writeFileSync(join(d, "answers.json"), JSON.stringify(answers));
  writeFileSync(
    join(d, "gh.mjs"),
    `import { readFileSync } from "node:fs";\nconst a = JSON.parse(readFileSync(${JSON.stringify(join(d, "answers.json"))}, "utf8"));\nconst path = process.argv[3];\nconst k = Object.keys(a).find((x) => path.endsWith(x));\nif (!k || a[k]?.error) { console.error(k ? a[k].error : "no answer for " + path); process.exit(1); }\nprocess.stdout.write(JSON.stringify(a[k]));\n`,
  );
  return `${process.execPath} ${join(d, "gh.mjs")}`;
}
// GitHub's answers that are the rule file's, every field; edit changes them.
function githubAnswers(edit = () => {}) {
  const ruleset = structuredClone({ id: 1, ...RULES.ruleset });
  const actions = structuredClone(RULES.actions);
  const a = {
    "repos/o/r/rulesets": [{ id: 1, name: ruleset.name, enforcement: ruleset.enforcement }],
    "repos/o/r/rulesets/1": ruleset,
    "repos/o/r/actions/permissions": actions.permissions,
    "repos/o/r/actions/permissions/workflow": actions.workflow,
    "repos/o/r/actions/policies": { policies: actions.policies.map((p, i) => ({ id: 5 + i, name: p.name })) },
    ...Object.fromEntries(actions.policies.map((p, i) => [`repos/o/r/actions/policies/${5 + i}`, p])),
  };
  edit(a);
  return a;
}
const apiOf = (answers) => (path) => {
  const k = Object.keys(answers).find((x) => path.endsWith(x));
  if (!k || answers[k]?.error) throw new Error(k ? answers[k].error : `no answer for ${path}`);
  return structuredClone(answers[k]);
};

// A statement outside the repository: two items, one command of done, a goal, its budget and, where given,
// its gate paths.
function statement({ gatePaths = ["tools/ont-check/"], done = "true", extra = "", goal = "g" } = {}) {
  const f = join(temp("ont-statement-"), "statement.md");
  writeFileSync(f, `# A statement\n\n## What to do\n\n1. one\n2. two\n\n${extra}${gatePaths.length ? `Gate-paths: ${gatePaths.join(" ")}\n` : ""}Done-when: ${done}\n${goal ? `Goal: ${goal}\n` : ""}Budget-new-input: 100000000\nBudget-output: 100000000\nBudget-reserve: 1.5\n`);
  return { file: f, hash: sha256(readFileSync(f)) };
}

// The project helpers on a directory: a copy of the templates with the tool, its records and the keys of the
// gate, in a repository.
function helpers(dir) {
  const put = (p, text) => {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), text);
  };
  const git = (...a) => {
    const r = spawnSync("git", ["-C", dir, ...a], { encoding: "utf8", env: GIT_ENV });
    assert.equal(r.status, 0, `git ${a.join(" ")}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const commit = (msg = "step", env = {}) => {
    git("add", "-A");
    const r = spawnSync("git", ["-C", dir, "commit", "-q", "--allow-empty", "-m", msg], { encoding: "utf8", env: { ...GIT_ENV, ...env } });
    assert.equal(r.status, 0, r.stderr);
    return git("rev-parse", "HEAD");
  };
  const tool = (script, args, env = {}) => {
    const r = spawnSync(process.execPath, [join(dir, "tools/ont-check", script), ...args, "--config", join(dir, "ont.config.json")], { cwd: dir, encoding: "utf8", env: { ...GIT_ENV, ...env } });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const config = () => loadConfig(join(dir, "ont.config.json"));
  // The guard of main on the pull request from main to HEAD, by its command: its codes and its output.
  const gate = (base = git("rev-parse", "main"), head = git("rev-parse", "HEAD")) => {
    const r = spawnSync(process.execPath, [join(dir, "tools/ont-check/merge-gate.mjs"), "guard", "--base", base, "--head", head, "--config", join(dir, "ont.config.json")], { encoding: "utf8", env: GIT_ENV });
    return { code: r.status, out: r.stdout, codes: [...r.stdout.matchAll(/^CODE (\S+)$/gm)].map((m) => m[1]) };
  };
  return { dir, put, git, commit, tool, config, gate };
}

const ENGLISH = writeFile("yes");
// The base: main with the key of the merge by the state of the task, seals, the goals and, where given, the
// owner's permission to publish of a scope, written by approve.mjs; the task's branch from it.
function base({ publish = "g", goals = { g: ["t", "u"], other: ["x"] }, taskState = true } = {}) {
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
    mergeGate: { paths: ROOT_CFG.mergeGate.paths, codes: { t: ["TASK_UNNAMED"] }, rules: ".github/merge-gate.json", ...(taskState ? { taskState: true } : {}) },
    spend: { fromLogs: false },
    goals,
    statements: { todoHeadings: ["What to do"] },
  });
  p.put("ont.config.json", JSON.stringify(cfg, null, 2));
  p.put(".github/merge-gate.json", JSON.stringify(RULES, null, 2));
  for (const d of ["reviews/rounds", "reviews/tasks", "reviews/runs"]) p.put(`${d}/.keep`, "");
  p.put("docs/page.md", "# A page\n\nA line of text.\n");
  p.git("init", "-q", "-b", "main");
  p.commit("main");
  if (publish) {
    const cmd = registry({ 50: answered(`Publish the work of ${publish}?`, "publish") });
    const r = p.tool("approve.mjs", ["--kind", "publish", "--scope", publish, "--question", "50", "--english", ENGLISH], { ONT_REGISTRY_CMD: cmd });
    assert.equal(r.code, 0, r.out);
    p.commit("the permission to publish");
  }
  p.git("checkout", "-q", "-b", "task");
  return p;
}
// A copy of a repository, its history and its working tree, so that each test starts from one state.
const copy = (p) => {
  const dir = temp("ont-copy-");
  cpSync(p.dir, dir, { recursive: true });
  return helpers(dir);
};

// The brief's lines, which the reviewer's reply begins with word for word.
const briefLines = (out) => out.split("\n").filter((l) => /^(Task|Step|Narrow|Number|Statement-hash|Goal|Budget-new-input|Budget-output|Budget-reserve|Gate-paths|Commits|Done|Brief-time): /.test(l)).join("\n");
const reply = (lines, rest) => writeFile(`${lines}\n${rest}\n`);
// A round of the statement by round.mjs, its reply the reviewer's, then committed.
function statementRound(p, st, rest = "By: m (p)", triage = null, task = "t") {
  const b = p.tool("round.mjs", ["brief", task, "--step", "statement", "--statement", st.file]);
  assert.equal(b.code, 0, b.out);
  const r = p.tool("round.mjs", ["record", task, "--from", reply(briefLines(b.out), rest), ...(triage ? ["--triage", writeFile(triage)] : [])]);
  assert.equal(r.code, 0, r.out);
  return p.commit("a round of the statement");
}
// A round of the result by round.mjs, clean with the condition confirmed by default, then committed.
function resultRound(p, st, rest = "By: m (p)\n\nCondition: holds\nAcceptance: clean", triage = null) {
  const b = p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", st.file]);
  assert.equal(b.code, 0, b.out);
  const r = p.tool("round.mjs", ["record", "t", "--from", reply(briefLines(b.out), rest), ...(triage ? ["--triage", writeFile(triage)] : [])]);
  assert.equal(r.code, 0, r.out);
  return p.commit("a round of the result");
}
const recordDone = (p, st, task = "t") => {
  const d = p.tool("done.mjs", [task, "--statement", st.file]);
  assert.equal(d.code, 0, d.out);
};
// The work of the task outside the gate paths, then its record of done, committed.
function workAndDone(p, st, path = "docs/page.md") {
  p.put(path, `${readFileSync(join(p.dir, path), "utf8")}A line of the work, ${Math.random()}.\n`);
  const c = p.commit("the work");
  recordDone(p, st);
  p.commit("done");
  return c;
}

// The approved state of task t, once: a base with the permission to publish goal g, and a clean round of the
// statement with its gate paths; each test takes a copy.
let approvedOnce = null;
const approved = () => {
  if (!approvedOnce) {
    const p = base();
    const st = statement();
    statementRound(p, st);
    approvedOnce = { p, st };
  }
  return { p: copy(approvedOnce.p), st: approvedOnce.st };
};
// The usual path to its end: the work, done and a clean round of the result.
const finished = () => {
  const { p, st } = approved();
  const work = workAndDone(p, st);
  resultRound(p, st);
  return { p, st, work };
};

// ── Usual paths ──────────────────────────────────────────────────────────────────────────────────────

test("[check.merge-gate.task-state-usual-path] a task's pull request with the whole chain, a clean last full round, the permission to publish of its goal and a gate path within Gate-paths: passes the guard", () => {
  const { p, st } = approved();
  p.put("tools/ont-check/extra.mjs", "// the work on the gate\n");
  p.put("docs/page.md", "# A page\n\nThe work.\n");
  p.commit("the work");
  const gc = p.tool("gate-record.mjs", ["change", "t", "--statement", st.file, "--clause", "1", "--paths", "tools/ont-check/extra.mjs", "--base", "main"]);
  assert.equal(gc.code, 0, gc.out);
  recordDone(p, st);
  p.commit("the gate change and done");
  resultRound(p, st);
  const g = p.gate();
  assert.equal(g.code, 0, g.out);
  assert.match(g.out, /^GATE_OK$/m);
  assert.deepEqual(g.codes, []);
  // The approval in force carries the statement's gate paths, from the brief into the round.
  const inputs = readTaskInputs(p.config());
  assert.deepEqual(inputs.rounds.find((r) => r.step === "statement-review").gatePaths, ["tools/ont-check/"]);
});

test("[check.merge-gate.task-state-usual-path] a task's pull request after a narrow round with findings, their fixes, the record of their tests and a new record of done passes the guard", () => {
  const { p, st } = approved();
  workAndDone(p, st);
  // Round C confirms the condition with a finding of the usual path; the fix, done, then the narrow round,
  // which has a finding of its own and a clean acceptance.
  resultRound(p, st, "By: m (p)\n\n| a gap | important | change |\n\nCondition: holds\nAcceptance: clean", "a gap · usual path: the work\n");
  p.put("docs/page.md", `${readFileSync(join(p.dir, "docs/page.md"), "utf8")}The fix of the gap.\n`);
  p.put("app/fix.test.mjs", 'test("the fix of the gap", () => {});\n');
  p.commit("the fix");
  recordDone(p, st);
  p.commit("done");
  const narrow = resultRound(p, st, "By: m (p)\n\n| a slip | important | change |\n\nCondition: holds\nAcceptance: clean", "a slip · usual path: the work\n");
  assert.ok(narrow);
  assert.ok(readdirSync(join(p.dir, "reviews/rounds")).some((f) => /-t-result-narrow-1\.md$/.test(f)));
  // The fixes of the narrow round with their tests, then the record of done that ends the range.
  p.put("docs/page.md", `${readFileSync(join(p.dir, "docs/page.md"), "utf8")}The fix of the slip.\n`);
  p.put("app/fix.test.mjs", 'test("the fix of the gap", () => {});\ntest("the fix of the slip", () => {});\n');
  p.commit("the fixes of the narrow round");
  const round = readdirSync(join(p.dir, "reviews/rounds")).find((f) => /-t-result-narrow-1\.md$/.test(f));
  const fx = p.tool("round.mjs", ["fixes", "t", "--round", round, "--from", writeFile("a slip · app/fix.test.mjs · the fix of the slip\n")]);
  assert.equal(fx.code, 0, fx.out);
  recordDone(p, st);
  p.commit("the record of the tests and done");
  const inputs = readTaskInputs(p.config());
  const next = taskNext({ rounds: inputs.rounds, done: inputs.records.done, approvals: inputs.records.approvals, task: "t", malformed: inputs.malformed, head: p.git("rev-parse", "HEAD") });
  assert.equal(next.branch, "done", next.say);
  assert.ok(next.result.fixes?.done);
  const g = p.gate();
  assert.deepEqual(g.codes, [], g.out);
  assert.match(g.out, /^GATE_OK$/m);
});

// A command of gh api that answers by a part of the path asked, as GitHub answers the writer of a gate proof:
// the pull request, its check runs, its workflow runs and the log of a job, a text printed as it is.
function proofStub(answers) {
  const d = temp("ont-gh-proof-");
  writeFileSync(join(d, "answers.json"), JSON.stringify(answers));
  writeFileSync(join(d, "gh.mjs"), `import { readFileSync } from "node:fs";\nconst a = JSON.parse(readFileSync(${JSON.stringify(join(d, "answers.json"))}, "utf8"));\nconst k = Object.keys(a).find((x) => process.argv[3].includes(x));\nif (!k) process.exit(1);\nprocess.stdout.write(typeof a[k] === "string" ? a[k] : JSON.stringify(a[k]));\n`);
  return `${process.execPath} ${join(d, "gh.mjs")}`;
}

test("[check.merge-gate.task-state-usual-path] the first pull request of records alone after the merge, a gate proof written by gate-record.mjs proof, with the permission to publish on the base, passes the guard and the full check", () => {
  const { p } = finished();
  p.git("checkout", "-q", "main");
  p.git("merge", "-q", "--no-ff", "-m", "merge the task", "task");
  const merged = p.git("rev-parse", "HEAD");
  p.git("checkout", "-q", "-b", "records");
  // The refusal probe of the gate of t, as the writer records it from GitHub's answers.
  const gh = proofStub({
    "pulls/7": { head: { sha: "a".repeat(40) }, base: { sha: merged }, merged: false },
    "check-runs": { check_runs: [{ name: "ont-gate-guard", conclusion: "failure", id: 11 }, { name: "ont-check", conclusion: "success", id: 12 }] },
    "actions/runs": { workflow_runs: [{ name: "ont-gate-guard", id: 99, html_url: "https://github.com/o/r/actions/runs/99" }] },
    "jobs/11/logs": "CODE TASK_UNNAMED\nGATE_REFUSED\n",
  });
  const response = writeFile(JSON.stringify({ message: 'Repository rule violations found. Required status check "ont-gate-guard" is failing.' }));
  const proof = p.tool("gate-record.mjs", ["proof", "t", "--gate", "t", "--check", "ont-gate-guard", "--pr", "7", "--kind", "refusal", "--repo", "o/r", "--response", response, "--base", merged], { ONT_GH_CMD: gh });
  assert.equal(proof.code, 0, proof.out);
  p.commit("the gate proof");
  const records = readTaskInputs(p.config()).records;
  assert.equal(records.gateProofs.length, 1);
  assert.deepEqual(records.malformed, []);
  const g = p.gate();
  assert.deepEqual(g.codes, [], g.out);
  assert.match(g.out, /^GATE_OK$/m);
  const check = p.tool("ont-check.mjs", []);
  assert.equal(check.code, 0, check.out);
  assert.match(check.out, /^ONT_OK$/m);
});

// ── TASK_UNNAMED ────────────────────────────────────────────────────────────────────────────────────

test("[check.merge-gate.task-unnamed] a line of text changed with no record of done, records of done of two tasks, and a file under reviews/ that is no record are changes of a task no record names", () => {
  // A line of text, no record of done.
  const a = base();
  a.put("docs/page.md", "# A page\n\nAnother line of text.\n");
  a.commit("a line");
  const ga = a.gate();
  assert.deepEqual(ga.codes, ["TASK_UNNAMED"], ga.out);
  assert.match(ga.out, /docs\/page\.md, so it is a change of a task, and it adds no record of done/);
  // Two tasks: the records of done of t and of u in one pull request.
  const { p, st } = approved();
  const stU = statement({ gatePaths: [] });
  statementRound(p, stU, "By: m (p)", null, "u");
  workAndDone(p, st);
  recordDone(p, stU, "u");
  p.commit("done of u");
  resultRound(p, st);
  const gb = p.gate();
  assert.deepEqual(gb.codes, ["TASK_UNNAMED"], gb.out);
  assert.match(gb.out, /name more than one task: t, u/);
  // A file under reviews/ that is no record: a change of a task, not a pull request of records.
  const c = base();
  c.put("reviews/rounds/README.md", "# Notes\n");
  c.commit("a note");
  const gc = c.gate();
  assert.deepEqual(gc.codes, ["TASK_UNNAMED"], gc.out);
});

// ── TASK_NOT_DONE ───────────────────────────────────────────────────────────────────────────────────

// A record of done as done.mjs writes it, sealed, for the histories the writer refuses to write.
const forgedDone = (p, st, commit, time, checks = ["- true · pass"]) =>
  p.put(`reviews/tasks/${time.replace(/[-:]/g, "")}-t-done.md`, sealed(["Record: done", "Task: t", `Commit: ${commit}`, `Statement-hash: ${st.hash}`, "Budget-new-input: 100000000", "Budget-output: 100000000", "Budget-reserve: 1.5", "Goal: g", `Time: ${time}`, "Checks:", ...checks, ""].join("\n")));
const soon = (s = 2) => new Date(Date.now() + s * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");

test("[check.merge-gate.task-not-done] no approval in force, an answer to a gate alone, done with no round of the result, a last round with a finding, an acceptance that does not hold, an open gate and a record that cannot be read are each refused", () => {
  const notDone = (p) => {
    const g = p.gate();
    assert.ok(g.codes.includes("TASK_NOT_DONE"), g.out);
    assert.deepEqual(g.codes.filter((c) => !["TASK_NOT_DONE", "GATE_PATH_UNAPPROVED"].includes(c)), [], g.out);
    return g;
  };
  // No approval in force: a round of a new version with findings withdraws the approval after done.
  {
    const { p, st } = finished();
    const v2 = statement({ extra: "A change.\n\n" });
    statementRound(p, v2, "By: m (p)\n\n| a hole | important | change |", "a hole · usual path: the statement\n");
    assert.equal(approvedHash(readTaskInputs(p.config()).rounds, "t", null, readTaskInputs(p.config()).records.approvals), null);
    assert.ok(st);
    notDone(p);
  }
  // The owner's answer to a gate alone: no version is approved.
  {
    const p = base();
    const st = statement();
    statementRound(p, st, "By: m (p)\n\n| a choice | important | change |", "a choice · not fixable\n");
    const round = readdirSync(join(p.dir, "reviews/rounds")).find((f) => f.includes("-t-statement-1"));
    const cmd = registry({ 8: answered(`Task t: the gate of ${round}`, "answer") });
    assert.equal(p.tool("approve.mjs", ["t", "--statement", st.file, "--english", ENGLISH, "--question", "8", "--kind", "gate", "--round", round], { ONT_REGISTRY_CMD: cmd }).code, 0);
    p.commit("the answer");
    // done.mjs does not write done with no approval in force; a record written as it writes it names the task.
    p.put("docs/page.md", "# A page\n\nThe work.\n");
    const c = p.commit("the work");
    assert.equal(p.tool("done.mjs", ["t", "--statement", st.file]).code, 1);
    forgedDone(p, st, c, soon());
    p.commit("done");
    const g = notDone(p);
    assert.match(g.out, /NEXT t: /);
  }
  // Done with no round of the result.
  {
    const { p, st } = approved();
    workAndDone(p, st);
    assert.match(notDone(p).out, /full round 1 of the review of the result/);
  }
  // The last round has a finding on merging.
  {
    const { p, st } = approved();
    workAndDone(p, st);
    resultRound(p, st, "By: m (p)\n\n| a gap | important | change |\n\nCondition: not yet\nAcceptance: clean", "a gap · usual path: the work\n");
    notDone(p);
  }
  // The acceptance does not hold: a record of done made after it has none of its own.
  {
    const { p, st } = approved();
    workAndDone(p, st);
    resultRound(p, st, "By: m (p)\n\nCondition: not yet\nAcceptance: clean");
    workAndDone(p, st);
    assert.match(notDone(p).out, /was made after it and has no acceptance of its own/);
  }
  // An open gate of the owner at the head.
  {
    const { p, st } = approved();
    workAndDone(p, st);
    resultRound(p, st, "By: m (p)\n\n| a choice | important | change |\n\nCondition: not yet\nAcceptance: clean", "a choice · not fixable\n");
    assert.match(notDone(p).out, /a question to the owner/);
  }
  // A record that cannot be read.
  {
    const { p } = finished();
    p.put("reviews/rounds/20261124T120000Z-t-statement-9.md", sealed("Task: t\nStep: statement-review\n"));
    p.commit("a record that cannot be read");
    assert.match(notDone(p).out, /correct the records that cannot be read/);
  }
});

test("[check.merge-gate.task-not-done] done.mjs writes no record when a command fails, and a sealed record of done with a check that failed gives an acceptance that does not hold", () => {
  const p = base();
  const st = statement({ done: "false" });
  statementRound(p, st);
  p.put("docs/page.md", "# A page\n\nThe work.\n");
  const c = p.commit("the work");
  const d = p.tool("done.mjs", ["t", "--statement", st.file]);
  assert.equal(d.code, 1);
  assert.match(d.out, /commands of done failed/);
  forgedDone(p, st, c, soon(), ["- false · fail"]);
  p.commit("done");
  resultRound(p, st, "By: m (p)\n\nCondition: not yet\nAcceptance: clean");
  const g = p.gate();
  assert.deepEqual(g.codes, ["TASK_NOT_DONE"], g.out);
  assert.match(g.out, /has a check that failed/);
});

// ── TASK_HEAD_UNREVIEWED ────────────────────────────────────────────────────────────────────────────

test("[check.merge-gate.head-unreviewed] a path of the task changed after the record of done that ends it is refused; main merged into the branch after the acceptance passes", () => {
  const { p } = finished();
  const clean = copy(p);
  p.put("docs/page.md", "# A page\n\nA change no reviewer read.\n");
  p.commit("after the end");
  const g = p.gate();
  assert.deepEqual(g.codes, ["TASK_HEAD_UNREVIEWED"], g.out);
  assert.match(g.out, /docs\/page\.md/);
  // main moves on, and the branch is updated with it by a clean merge.
  clean.git("checkout", "-q", "main");
  clean.put("docs/other.md", "# Another page\n");
  clean.commit("main moves on");
  clean.git("checkout", "-q", "task");
  clean.git("merge", "-q", "--no-ff", "-m", "merge main", "main");
  const after = clean.gate();
  assert.deepEqual(after.codes, [], after.out);
});

// ── WORK_BEFORE_APPROVAL ────────────────────────────────────────────────────────────────────────────

test("[check.merge-gate.work-before-approval] a commit outside the records made before the task's first approval is refused; work after v1 is approved, then v2 approved, passes", () => {
  const p = base();
  const st = statement();
  p.put("docs/early.md", "# Work before the approval\n");
  p.commit("early work", { GIT_COMMITTER_DATE: "2026-01-01T10:00:00Z" });
  statementRound(p, st);
  workAndDone(p, st);
  resultRound(p, st);
  const g = p.gate();
  assert.deepEqual(g.codes, ["WORK_BEFORE_APPROVAL"], g.out);
  // v1 approved, work, then v2 approved: the work came after the first approval.
  const { p: q, st: v1 } = approved();
  q.put("docs/page.md", "# A page\n\nWork under v1.\n");
  q.commit("work under v1");
  const v2 = statement({ extra: "Version 2.\n\n" });
  assert.notEqual(v1.hash, v2.hash);
  statementRound(q, v2);
  workAndDone(q, v2);
  resultRound(q, v2);
  const ok = q.gate();
  assert.deepEqual(ok.codes, [], ok.out);
});

// ── MERGE_UNPERMITTED ───────────────────────────────────────────────────────────────────────────────

test("[check.merge-gate.merge-unpermitted] no permission to publish, one of another goal, the pull request's own task added to a goal, and an approval in place of a permission are refused; so is a pull request of records alone with none on the base", () => {
  const chain = (p) => {
    const st = statement();
    statementRound(p, st);
    workAndDone(p, st);
    resultRound(p, st);
    return st;
  };
  const refused = (p, also = []) => {
    const g = p.gate();
    assert.deepEqual(g.codes.filter((c) => !also.includes(c)), ["MERGE_UNPERMITTED"], g.out);
    return g;
  };
  // None on the base.
  const none = base({ publish: null });
  chain(none);
  refused(none);
  // One of another goal.
  const other = base({ publish: "other" });
  chain(other);
  refused(other);
  // The pull request adds its task to the goal the permission is of, after its approval: the goals are the
  // base's.
  const own = base({ publish: "other", goals: { other: ["x"] } });
  const ownSt = statement({ goal: null });
  statementRound(own, ownSt);
  const c = JSON.parse(readFileSync(join(own.dir, "ont.config.json"), "utf8"));
  c.goals.other.push("t");
  own.put("ont.config.json", JSON.stringify(c, null, 2));
  own.commit("t in goal other");
  workAndDone(own, ownSt);
  resultRound(own, ownSt);
  refused(own, ["GATE_PATH_UNAPPROVED"]);
  // The owner's approval of the statement of the same scope, in place of a permission to publish.
  const appr = base({ publish: null });
  const st = statement();
  const cmd = registry({ 9: answered(`Approve task t, version ${st.hash.slice(0, 12)}?`) });
  assert.equal(appr.tool("approve.mjs", ["t", "--statement", st.file, "--english", ENGLISH, "--question", "9", "--kind", "approval"], { ONT_REGISTRY_CMD: cmd }).code, 0);
  appr.commit("the owner's approval");
  workAndDone(appr, st);
  resultRound(appr, st);
  refused(appr);
  // A pull request of records alone with no permission on the base.
  const rec = base({ publish: null });
  rec.put("reviews/tasks/20261124T120000Z-t-gate-proof.md", sealed("Record: gate-proof\nGate: t\nTime: 2026-11-24T12:00:00Z\n"));
  rec.commit("a record");
  assert.match(refused(rec).out, /records alone/);
});

// ── GATE_PATH_OUTSIDE_APPROVAL ──────────────────────────────────────────────────────────────────────

test("[check.merge-gate.gate-path-outside-approval] a gate path with a record of a gate change but outside Gate-paths: of the approval, and one changed under an approval with no Gate-paths:, are refused", () => {
  const run = (st, path) => {
    const p = base();
    statementRound(p, st);
    p.put(path, "# a gate path\n");
    p.commit("the work");
    const gc = p.tool("gate-record.mjs", ["change", "t", "--statement", st.file, "--clause", "1", "--paths", path, "--base", "main"]);
    assert.equal(gc.code, 0, gc.out);
    recordDone(p, st);
    p.commit("the gate change and done");
    resultRound(p, st);
    return p.gate();
  };
  const outside = run(statement({ gatePaths: ["tools/ont-check/"] }), ".github/workflows/extra.yml");
  assert.deepEqual(outside.codes, ["GATE_PATH_OUTSIDE_APPROVAL"], outside.out);
  assert.match(outside.out, /\.github\/workflows\/extra\.yml: not within the gate paths tools\/ont-check\//);
  const none = run(statement({ gatePaths: [] }), "tools/ont-check/extra.mjs");
  assert.deepEqual(none.codes, ["GATE_PATH_OUTSIDE_APPROVAL"], none.out);
  assert.match(none.out, /no gate paths of the approval in force/);
});

// ── The key at the base ─────────────────────────────────────────────────────────────────────────────

test("[check.merge-gate.task-state-switch] a base without mergeGate.taskState holds no rule of the task's state; a base with it does", () => {
  const off = base({ taskState: false, publish: null });
  off.put("docs/page.md", "# A page\n\nAnother line.\n");
  off.commit("a line");
  const g = off.gate();
  assert.deepEqual(g.codes, [], g.out);
  assert.equal(guard({ cfg: off.config(), base: off.git("rev-parse", "main"), head: off.git("rev-parse", "HEAD") }).taskState, false);
  // The pull request that brings the key is not held by it; the next one is.
  const c = JSON.parse(readFileSync(join(off.dir, "ont.config.json"), "utf8"));
  c.mergeGate.taskState = true;
  off.put("ont.config.json", JSON.stringify(c, null, 2));
  off.commit("the key");
  assert.deepEqual(off.gate().codes.filter((x) => x !== "GATE_PATH_UNAPPROVED"), []);
  off.git("checkout", "-q", "main");
  off.git("merge", "-q", "--no-ff", "-m", "merge the key", "task");
  off.git("checkout", "-q", "-b", "next");
  off.put("docs/page.md", "# A page\n\nA line after the key.\n");
  off.commit("a line");
  assert.deepEqual(off.gate().codes, ["TASK_UNNAMED"]);
});

// ── The owner's answer to a gate ────────────────────────────────────────────────────────────────────

test("[check.owner-approval.gate-answer-not-approval] the next action of an open gate names the owner's answer to the gate of that round, not a new version; the answer to a gate closes the gate it names and no other, approves no version, and is followed by a round of the statement on that step and by work on the step of the result", () => {
  const p = base();
  const st = statement();
  // Two rounds of the statement with a finding not fixable each.
  statementRound(p, st, "By: m (p)\n\n| a choice | important | change |", "a choice · not fixable\n");
  // A second round with a gate while the first is open, which no writer briefs: written as round.mjs writes.
  const v2 = statement({ extra: "Corrected.\n\n" });
  const t2 = soon(1);
  const r2 = `${t2.replace(/[-:]/g, "")}-t-statement-2.md`;
  p.put(`reviews/rounds/${r2}`, sealed(["Task: t", "Step: statement-review", "Narrow: false", "Number: 2", `Time: ${t2}`, "By: m (p)", `Statement-hash: ${v2.hash}`, "Findings:", "- a second choice · important · change · not fixable", ""].join("\n")));
  p.commit("a second round");
  const r1 = readdirSync(join(p.dir, "reviews/rounds")).find((f) => f.includes("-t-statement-1"));
  const inputs = () => readTaskInputs(p.config());
  const before = approvedHash(inputs().rounds, "t", null, inputs().records.approvals);
  const cmd = registry({ 8: answered(`Task t: the gate of ${r1}`, "answer"), 9: answered(`Task t: the gate of ${r2}`, "answer") });
  assert.equal(p.tool("approve.mjs", ["t", "--statement", v2.file, "--english", ENGLISH, "--question", "8", "--kind", "gate", "--round", r1], { ONT_REGISTRY_CMD: cmd }).code, 0);
  p.commit("the answer to the first gate");
  const next = (statementFile) => {
    const i = inputs();
    return taskNext({ rounds: i.rounds, done: i.records.done, approvals: i.records.approvals, task: "t", malformed: i.malformed, statement: statementFile ? readStatement(statementFile) : null, needFile: Boolean(statementFile) });
  };
  // The other gate stays open; no version is approved.
  let n = next(v2.file);
  assert.equal(n.branch, "open gate", n.say);
  // The question names the owner's answer to the gate of that round, never a new version to approve.
  assert.match(n.say, /his answer to the gate of the round, recorded with approve\.mjs --kind gate --round, closes that gate alone, and the version keeps its approval or its lack of one/);
  assert.doesNotMatch(n.say, /approval of a version answers it|new version/);
  assert.match(n.say, new RegExp(r2));
  assert.doesNotMatch(n.say, new RegExp(r1));
  assert.equal(approvedHash(inputs().rounds, "t", null, inputs().records.approvals), before);
  // Both answered: the next is a full round of the statement, numbered after the others, not work.
  assert.equal(p.tool("approve.mjs", ["t", "--statement", v2.file, "--english", ENGLISH, "--question", "9", "--kind", "gate", "--round", r2], { ONT_REGISTRY_CMD: cmd }).code, 0);
  p.commit("the answer to the second gate");
  n = next(v2.file);
  assert.equal(approvedHash(inputs().rounds, "t", null, inputs().records.approvals), before);
  assert.equal(n.kind, "review", n.say);
  assert.match(n.say, /full round 3/);
  assert.equal(p.tool("done.mjs", ["t", "--statement", v2.file]).code, 1);
  // On the step of the result: a gate there, answered, is followed by work under the approval in force.
  const { p: q, st: s } = approved();
  workAndDone(q, s);
  resultRound(q, s, "By: m (p)\n\n| a choice | important | change |\n\nCondition: not yet\nAcceptance: clean", "a choice · not fixable\n");
  const rr = readdirSync(join(q.dir, "reviews/rounds")).find((f) => f.includes("-t-result-1"));
  const qi = () => readTaskInputs(q.config());
  const approvedBefore = approvedHash(qi().rounds, "t", null, qi().records.approvals);
  const cmd2 = registry({ 10: answered(`Task t: the gate of ${rr}`, "answer") });
  assert.equal(q.tool("approve.mjs", ["t", "--statement", s.file, "--english", ENGLISH, "--question", "10", "--kind", "gate", "--round", rr], { ONT_REGISTRY_CMD: cmd2 }).code, 0);
  q.commit("the answer");
  const i = qi();
  const after = taskNext({ rounds: i.rounds, done: i.records.done, approvals: i.records.approvals, task: "t", malformed: i.malformed, statement: readStatement(s.file), needFile: true });
  assert.equal(approvedHash(i.rounds, "t", null, i.records.approvals), approvedBefore);
  assert.equal(after.kind, "work", after.say);
  assert.match(after.say, /full round 2/);
});

// ── The permission to publish ───────────────────────────────────────────────────────────────────────

test("[check.publish-permission.by-registry] a question that does not name the scope, and an option that approves the start of the work rather than its publication, write nothing; an answer that means publish writes the record", () => {
  const p = base({ publish: null });
  const cmd = registry({
    1: answered("Publish the work?", "publish"),
    2: answered("Start the work of g?", "approve"),
    3: answered("Publish the work of goal g?", "publish"),
  });
  const pub = (n, scope = "g") => p.tool("approve.mjs", ["--kind", "publish", "--scope", scope, "--question", n, "--english", ENGLISH], { ONT_REGISTRY_CMD: cmd });
  assert.match(pub("1").out, /does not name the scope g/);
  assert.match(pub("2").out, /means approve: it does not allow to publish/);
  assert.match(pub("3", "nothing").out, /neither a goal/);
  assert.match(p.tool("approve.mjs", ["--kind", "publish", "--scope", "g", "--question", "3", "--english", ENGLISH, "--statement", ENGLISH], { ONT_REGISTRY_CMD: cmd }).out, /names no statement/);
  assert.equal(readdirSync(join(p.dir, "reviews/tasks")).filter((f) => f.endsWith("-publish.md")).length, 0);
  const ok = pub("3");
  assert.equal(ok.code, 0, ok.out);
  const file = readdirSync(join(p.dir, "reviews/tasks")).find((f) => f.endsWith("-g-publish.md"));
  const text = readFileSync(join(p.dir, "reviews/tasks", file), "utf8");
  assert.match(text, /^Seal: v1 /);
  assert.match(text, /^Record: approval\nKind: publish\nScope: g\nBy: owner\nQuestion: 3\nSource: question 3, answered 2026-11-24, option a: "yes" \(translated from Russian\)\nTime: /m);
  assert.doesNotMatch(text, /Statement-hash:/);
  const records = readTaskInputs(p.config()).records;
  assert.deepEqual(records.publications.map((x) => x.scope), ["g"]);
  assert.deepEqual(records.approvals, []);
  assert.deepEqual(records.malformed, []);
});

test("[check.task-statement.gate-paths-carried] the statement's lines Gate-paths: go into the brief and the round of its review, and into the owner's approval; an approval of a statement with none carries none", () => {
  const p = base();
  const st = statement({ gatePaths: ["tools/ont-check/", ".github/workflows/ont-gate-guard.yml"] });
  assert.deepEqual(readStatement(st.file).gatePaths, ["tools/ont-check/", ".github/workflows/ont-gate-guard.yml"]);
  const b = p.tool("round.mjs", ["brief", "t", "--step", "statement", "--statement", st.file]);
  assert.match(b.out, /^Gate-paths: tools\/ont-check\/, \.github\/workflows\/ont-gate-guard\.yml$/m);
  const r = p.tool("round.mjs", ["record", "t", "--from", reply(briefLines(b.out), "By: m (p)")]);
  assert.equal(r.code, 0, r.out);
  const round = readdirSync(join(p.dir, "reviews/rounds")).find((f) => f.includes("-t-statement-1"));
  assert.match(readFileSync(join(p.dir, "reviews/rounds", round), "utf8"), /^Gate-paths: tools\/ont-check\/, \.github\/workflows\/ont-gate-guard\.yml$/m);
  const cmd = registry({ 9: answered(`Approve task t, version ${st.hash.slice(0, 12)}?`) });
  assert.equal(p.tool("approve.mjs", ["t", "--statement", st.file, "--english", ENGLISH, "--question", "9", "--kind", "approval"], { ONT_REGISTRY_CMD: cmd }).code, 0);
  const none = statement({ gatePaths: [] });
  const cmd2 = registry({ 10: answered(`Approve task u, version ${none.hash.slice(0, 12)}?`) });
  assert.equal(p.tool("approve.mjs", ["u", "--statement", none.file, "--english", ENGLISH, "--question", "10", "--kind", "approval"], { ONT_REGISTRY_CMD: cmd2 }).code, 0);
  const approvals = readTaskInputs(p.config()).records.approvals;
  assert.deepEqual(approvals.find((a) => a.task === "t").gatePaths, ["tools/ont-check/", ".github/workflows/ont-gate-guard.yml"]);
  assert.equal(approvals.find((a) => a.task === "u").gatePaths, null);
});

// ── The rules of main on GitHub ─────────────────────────────────────────────────────────────────────

test("[check.merge-gate.rules-compared] the fields the token reads: a required check missing, the rule switched off and another target drift; an answer without a field and a failed call are not read; every field with an extra actor that bypasses drifts", () => {
  const cmp = (edit, fields = "token") => compareRules({ rules: RULES, repo: "o/r", fields, api: apiOf(githubAnswers(edit)) });
  assert.deepEqual(cmp(() => {}), { drift: [], unread: [], notRead: [], read: cmp(() => {}).read });
  assert.ok(cmp(() => {}).read.includes("required_status_checks.required_status_checks"));
  const checks = (a) => a["repos/o/r/rulesets/1"].rules.find((r) => r.type === "required_status_checks").parameters;
  assert.match(cmp((a) => (checks(a).required_status_checks = checks(a).required_status_checks.slice(0, 1))).drift.join("\n"), /required_status_checks\.required_status_checks/);
  assert.match(cmp((a) => (a["repos/o/r/rulesets/1"].enforcement = "disabled")).drift.join("\n"), /enforcement: "disabled" on GitHub/);
  assert.match(cmp((a) => (a["repos/o/r/rulesets/1"].conditions.ref_name.include = ["refs/heads/other"])).drift.join("\n"), /conditions\.ref_name\.include/);
  assert.match(cmp((a) => delete checks(a).strict_required_status_checks_policy).unread.join("\n"), /strict_required_status_checks_policy: not in GitHub's answer/);
  assert.match(cmp((a) => (a["repos/o/r/rulesets/1"] = { error: "HTTP 403" })).unread.join("\n"), /the ruleset main: .*HTTP 403/);
  // The token's fields alone do not read who bypasses; every field does.
  const extra = (a) => a["repos/o/r/rulesets/1"].bypass_actors.push({ actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" });
  assert.deepEqual(cmp(extra).drift, []);
  assert.match(cmp(extra, "all").drift.join("\n"), /bypass_actors/);
  // Where GitHub does not give the actors, the comparison of every field says so and refuses nothing.
  const hidden = cmp((a) => delete a["repos/o/r/rulesets/1"].bypass_actors, "all");
  assert.deepEqual([hidden.drift, hidden.unread], [[], []]);
  assert.match(hidden.notRead.join("\n"), /bypass_actors/);
});

test("[check.merge-gate.rules-compared] every parameter of every rule the rule file names is compared, so one approval required where the file says none is a difference, and a list GitHub gives as null is not read", () => {
  const cmp = (edit, fields = "token") => compareRules({ rules: RULES, repo: "o/r", fields, api: apiOf(githubAnswers(edit)) });
  const param = (a, type) => a["repos/o/r/rulesets/1"].rules.find((r) => r.type === type).parameters;
  assert.equal(param(githubAnswers(), "pull_request").required_approving_review_count, 0);
  for (const fields of ["token", "all"]) {
    const one = cmp((a) => (param(a, "pull_request").required_approving_review_count = 1), fields);
    assert.match(one.drift.join("\n"), /pull_request\.required_approving_review_count: 1 on GitHub, 0 in the rule file/, fields);
    assert.match(cmp((a) => (param(a, "required_status_checks").do_not_enforce_on_create = true), fields).drift.join("\n"), /required_status_checks\.do_not_enforce_on_create/, fields);
    assert.match(cmp((a) => delete param(a, "pull_request").dismiss_stale_reviews_on_push, fields).unread.join("\n"), /pull_request\.dismiss_stale_reviews_on_push: not in GitHub's answer/, fields);
  }
  // A null list of excluded refs is not the empty list of the file: the field is not read, and refused.
  const nul = cmp((a) => (a["repos/o/r/rulesets/1"].conditions.ref_name.exclude = null));
  assert.deepEqual(nul.drift, []);
  assert.match(nul.unread.join("\n"), /conditions\.ref_name\.exclude: null in GitHub's answer/);
  assert.match(cmp((a) => (param(a, "pull_request").allowed_merge_methods = null)).unread.join("\n"), /pull_request\.allowed_merge_methods: null/);
  assert.match(cmp((a) => (a["repos/o/r/rulesets/1"].rules = null)).unread.join("\n"), /^rules: null/m);
});

test("[check.merge-gate.rules-compared] merge-gate.mjs rules refuses a null list of excluded refs, RULES_UNREAD, and --task names the question to the owner when GitHub requires an approval the rule file does not", () => {
  const { p, st } = approved();
  const nul = p.tool("merge-gate.mjs", ["rules", "--repo", "o/r"], { ONT_GH_CMD: ghStub(githubAnswers((a) => (a["repos/o/r/rulesets/1"].conditions.ref_name.exclude = null))) });
  assert.equal(nul.code, 1, nul.out);
  assert.match(nul.out, /^CODE RULES_UNREAD$/m);
  assert.doesNotMatch(nul.out, /^RULES_OK$/m);
  p.git("remote", "add", "origin", "https://github.com/o/r.git");
  const one = ghStub(githubAnswers((a) => (a["repos/o/r/rulesets/1"].rules.find((r) => r.type === "pull_request").parameters.required_approving_review_count = 1)));
  const t = p.tool("ont-check.mjs", ["--task", "t", "--statement", st.file], { ONT_GH_CMD: one });
  assert.match(t.out, /^NEXT t: the rules of main on GitHub differ from the rule file: a question to the owner, who alone changes them \(pull_request\.required_approving_review_count: 1 on GitHub, 0 in the rule file\)$/m, t.out);
});

test("[check.merge-gate.rules-compared] merge-gate.mjs rules exits 0 on the rule file's rules and prints its codes on others; --task names the question to the owner on a difference, and says why when it cannot compare", () => {
  const { p, st } = approved();
  const rules = (answers, fields = "token") => p.tool("merge-gate.mjs", ["rules", "--repo", "o/r", "--fields", fields], { ONT_GH_CMD: ghStub(answers) });
  const ok = rules(githubAnswers());
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, /^RULES_OK$/m);
  const drift = rules(githubAnswers((a) => (a["repos/o/r/rulesets/1"].enforcement = "evaluate")));
  assert.equal(drift.code, 1);
  assert.match(drift.out, /^CODE RULES_DRIFT$/m);
  const unread = rules({ "repos/o/r/rulesets": { error: "gh: not logged in" } });
  assert.equal(unread.code, 1);
  assert.match(unread.out, /^CODE RULES_UNREAD$/m);
  // --task, with the executor's gh, on a clone whose origin is on GitHub.
  p.git("remote", "add", "origin", "https://github.com/o/r.git");
  const bypass = ghStub(githubAnswers((a) => a["repos/o/r/rulesets/1"].bypass_actors.push({ actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" })));
  const t = p.tool("ont-check.mjs", ["--task", "t", "--statement", st.file], { ONT_GH_CMD: bypass });
  assert.match(t.out, /^NEXT t: the rules of main on GitHub differ from the rule file: a question to the owner/m, t.out);
  const same = p.tool("ont-check.mjs", ["--task", "t", "--statement", st.file], { ONT_GH_CMD: ghStub(githubAnswers()) });
  assert.match(same.out, /^RULES t: the rules of main on o\/r are the rule file's/m, same.out);
  assert.match(same.out, /^NEXT t: the executor works under version/m, same.out);
  const cannot = p.tool("ont-check.mjs", ["--task", "t", "--statement", st.file], { ONT_GH_CMD: "false" });
  assert.match(cannot.out, /^RULES t: rules not compared: /m, cannot.out);
  assert.match(cannot.out, /^NEXT t: the executor works under version/m, cannot.out);
});

test("[check.merge-gate.rules-drift-workflow] the guard compares the token's fields on each pull request after its own step, and a workflow on main compares every field once a day and on demand", () => {
  const guardWf = readFileSync(join(TOP, ".github/workflows/ont-gate-guard.yml"), "utf8");
  assert.match(guardWf, /- name: The rules of main on GitHub are the rule file's\n {8}if: success\(\) \|\| failure\(\)\n {8}env:\n {10}GH_TOKEN: \$\{\{ github\.token \}\}\n {10}REPO: \$\{\{ github\.repository \}\}\n {8}run: node tools\/ont-check\/merge-gate\.mjs rules --repo "\$REPO" --fields token\n/);
  const drift = readFileSync(join(TOP, ".github/workflows/ont-rules-drift.yml"), "utf8");
  assert.match(drift, /^on:\n {2}schedule:\n {4}- cron: "[^"]+"\n {2}workflow_dispatch:\n/m);
  assert.match(drift, /^permissions:\n {2}contents: read\n/m);
  assert.doesNotMatch(drift, /secrets\.|write/);
  assert.match(drift, /run: node tools\/ont-check\/merge-gate\.mjs rules --repo "\$REPO" --fields all\n/);
});
