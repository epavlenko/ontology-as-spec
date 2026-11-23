// The merge gate on the server (D-158): the full check and the guard, the gate paths and the records of a
// gate change and of a gate proof, the rule file, the early hook, the workflow of the templates.
// ont: ent.merge-gate, field.merge-gate.full-check, field.merge-gate.guard, field.merge-gate.gate-paths, field.merge-gate.rule-file, rule.ci-from-main, inv.gate-change-approved
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../lib.mjs";
import { guard, isGatePath } from "../merge-gate.mjs";
import { approvedHash, parseTaskRecords, readRoundRecords, readTaskInputs, sha256 } from "../tasks.mjs";

const TOP = fileURLToPath(new URL("../../../", import.meta.url));
const TOOLS = join(TOP, "tools/ont-check");
const ROOT_CFG = JSON.parse(readFileSync(join(TOP, "ont.config.json"), "utf8"));
const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.org", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.org" };
for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) delete GIT_ENV[k];
const temps = [];
after(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })));
const temp = (name) => {
  const d = mkdtempSync(join(tmpdir(), name));
  temps.push(d);
  return d;
};
const read = (p) => readFileSync(join(TOP, p), "utf8");

// The lines of a workflow, and the commands of its steps.
const runs = (yml) => [...yml.matchAll(/^\s+run: (.*)$/gm)].map((m) => m[1]);
const stepRun = (yml, name) => {
  const at = yml.indexOf(`- name: ${name}`);
  assert.ok(at >= 0, `the step ${name}`);
  return yml.slice(at).match(/^\s+run: (.*)$/m)[1];
};
const onBlock = (yml) => yml.match(/^on:\n((?: {2}.*\n|\n)*)/m)[1];
const jobs = (yml) => [...yml.slice(yml.indexOf("\njobs:\n")).matchAll(/^ {2}([a-z][a-z-]*):$/gm)].map((m) => m[1]);
const permissions = (yml) => yml.match(/^permissions:\n((?: {2}.*\n)*)/m)[1].trim().split("\n").map((l) => l.trim());

const FULL = read(".github/workflows/ont-check.yml");
const GUARD = read(".github/workflows/ont-gate-guard.yml");
const TEMPLATE = read("templates/.github/workflows/ont-check.yml");
const PKG = JSON.parse(read("package.json"));

test("[check.merge-gate.full-check-steps] the full check runs on pull requests with a read-only token, every check and every suite but the judged", () => {
  assert.deepEqual(onBlock(FULL).trim().split("\n").map((l) => l.trim()), ["pull_request:"]);
  assert.deepEqual(jobs(FULL), ["ont-check"]);
  assert.match(FULL, /^ {4}name: ont-check$/m);
  assert.deepEqual(permissions(FULL), ["contents: read"]);
  assert.doesNotMatch(FULL, /write|secrets\./);
  const commands = runs(FULL);
  assert.ok(commands.includes("npm run check"), "the check of the approach, the example and the templates");
  assert.match(PKG.scripts.check, /--config ont\.config\.json .*--config example\/ont\.config\.json .*--config templates\/ont\.config\.json/);
  assert.ok(commands.includes('npm run --silent guard -- --base "$BASE"'));
  assert.match(FULL, /BASE: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
  assert.ok(commands.includes("npm run --silent test:ci"));
  // Every suite of the three configurations, and the example's system tests, is in test:ci but the judged,
  // and npm test runs test:ci and the judged.
  const globs = [...PKG.scripts["test:ci"].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const covered = (file) => globs.some((g) => new RegExp(`^${g.replace(/[.]/g, "\\.").replace(/\*/g, "[^/]*")}$`).test(file));
  for (const c of ["ont.config.json", "example/ont.config.json", "templates/ont.config.json"]) {
    const j = JSON.parse(read(c));
    const base = dirname(c) === "." ? "" : `${dirname(c)}/`;
    for (const s of j.testSuites ?? []) {
      const sample = `${base}${s.dir}/x${s.name === "judged" ? ".judged.mjs" : ".test.mjs"}`;
      assert.ok(new RegExp(s.match).test(sample));
      assert.equal(covered(sample), s.name !== "judged", `${c}: suite ${s.name}`);
    }
    for (const f of j.systemTests ?? []) assert.ok(covered(`${base}${f}`), `${c}: ${f}`);
  }
  assert.ok(!globs.some((g) => /judged/.test(g)));
  assert.match(PKG.scripts.test, /npm run --silent test:ci/);
  assert.match(PKG.scripts.test, /example\/judged\/\*\.judged\.mjs/);
});

test("[check.merge-gate.base-missing] the step that guards decisions fails on a base that is no commit and passes on a commit", () => {
  const step = stepRun(FULL, "Accepted decisions are not edited");
  const run = (BASE) => spawnSync("sh", ["-c", step], { cwd: TOP, encoding: "utf8", env: { ...GIT_ENV, BASE } });
  const missing = run("0123456789abcdef0123456789abcdef01234567");
  assert.notEqual(missing.status, 0, missing.stdout);
  assert.match(missing.stdout, /0123456789abcdef0123456789abcdef01234567 not found/);
  const head = spawnSync("git", ["-C", TOP, "rev-parse", "HEAD"], { encoding: "utf8", env: GIT_ENV }).stdout.trim();
  const ok = run(head);
  assert.equal(ok.status, 0, ok.stdout);
  assert.match(ok.stdout, /GUARD_OK/);
});

test("[check.merge-gate.guard-from-main] the guard runs on pull_request_target from main, reads the event through the environment and runs main's guard", () => {
  assert.deepEqual(onBlock(GUARD).trim().split("\n").map((l) => l.trim()), ["pull_request_target:", "types: [opened, synchronize, reopened, edited]"]);
  assert.deepEqual(jobs(GUARD), ["ont-gate-guard"]);
  assert.match(GUARD, /^ {4}name: ont-gate-guard$/m);
  assert.deepEqual(permissions(GUARD), ["contents: read"]);
  assert.doesNotMatch(GUARD, /secrets\.|write/);
  // main is checked out, and no ref or repository of the pull request.
  assert.doesNotMatch(GUARD, /^\s+(ref|repository):/m);
  assert.deepEqual([...GUARD.matchAll(/uses: (\S+)/g)].map((m) => m[1]), ["actions/checkout@v7", "actions/setup-node@v7"]);
  // The event's values reach the steps only as the values of variables, never inside a command.
  for (const line of GUARD.split("\n").filter((l) => l.includes("${{"))) assert.match(line, /^\s+[A-Z_]+: \$\{\{ github\.[a-z_.]+ \}\}$/, line);
  assert.deepEqual(runs(GUARD), [
    'git fetch --no-tags --quiet "https://github.com/$REPO" "$HEAD_SHA" "$BASE_SHA"',
    'node tools/ont-check/merge-gate.mjs guard --base "$BASE_SHA" --head "$HEAD_SHA"',
  ]);
});

// A repository whose main has a copy of the tool, the configuration with the gate paths of the approach,
// a workflow, the example's product code and test, and a clean round of the statement of task t.
const A = sha256("version A\n");
const B = sha256("version B\n");
const ROUND = (hash) => ["Task: t", "Step: statement-review", "Number: 1", "Time: 2026-11-23T10:00:00Z", "By: a model (a provider)", `Statement-hash: ${hash}`, ""].join("\n");
const CHANGE = ({ commit, paths, hash = A, item = "2" }) =>
  ["Record: gate-change", "Task: t", `Statement-hash: ${hash}`, `Item: ${item}`, "Paths:", ...paths.map((p) => `- ${p}`), `Commit: ${commit}`, "Time: 2026-11-23T11:00:00Z", ""].join("\n");
function gateRepo() {
  const repo = temp("gate-repo-");
  const git = (...a) => {
    const r = spawnSync("git", ["-C", repo, ...a], { encoding: "utf8", env: GIT_ENV });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  const put = (p, text) => {
    mkdirSync(dirname(join(repo, p)), { recursive: true });
    writeFileSync(join(repo, p), text);
  };
  git("init", "-q", "-b", "main");
  cpSync(TOOLS, join(repo, "tools/ont-check"), { recursive: true, filter: (src) => !src.includes(`${join("tools", "ont-check", "test")}`) });
  put("ont.config.json", JSON.stringify({ classes: { ent: "Entity" }, ontology: "ontology.md", reviewRounds: { dir: "reviews/rounds" }, taskRecords: { dir: "reviews/tasks" }, records: { latinOnly: true }, mergeGate: ROOT_CFG.mergeGate }, null, 2));
  put(".github/workflows/ont-check.yml", "name: ont-check\n");
  put("example/app/library.mjs", "export const lend = () => 1;\n");
  put("example/app/library.test.mjs", "// a test\n");
  put("reviews/rounds/20261123T100000Z-t-statement-1.md", ROUND(A));
  put("reviews/tasks/.keep", "");
  git("add", "-A");
  git("commit", "-q", "-m", "main");
  const base = git("rev-parse", "HEAD");
  let n = 0;
  // A pull request from main: each step changes files and is committed; the commits are kept apart.
  const pr = (steps) => {
    git("checkout", "-q", "-b", `pr${++n}`, base);
    const commits = [];
    for (const s of steps) {
      s({ put, git, commits, rm: (p) => git("rm", "-q", p), mv: (a, b) => git("mv", a, b) });
      git("add", "-A");
      git("commit", "-q", "--allow-empty", "-m", `step ${commits.length + 1}`);
      commits.push(git("rev-parse", "HEAD"));
    }
    git("checkout", "-q", "main");
    return { base, head: commits.at(-1), commits };
  };
  const cfg = () => loadConfig(join(repo, "ont.config.json"));
  return { repo, git, put, pr, base, cfg };
}

test("[check.merge-gate.gate-path-unapproved] the guard refuses a change of a gate path without an approval, and passes product code and records", () => {
  const { pr, cfg } = gateRepo();
  const workflow = ({ put }) => put(".github/workflows/ont-check.yml", "name: weakened\n");
  const run = (p) => guard({ cfg: cfg(), base: p.base, head: p.head });
  const rec = (paths, hash) => ({ put, commits }) => put("reviews/tasks/20261123T110000Z-t-gate-change.md", CHANGE({ commit: commits.at(-1), paths, hash }));

  const none = run(pr([workflow]));
  assert.deepEqual(none.refused, [{ path: ".github/workflows/ont-check.yml", why: "no record of a gate change of the pull request approves it" }]);

  const unapproved = run(pr([workflow, rec([".github/workflows/ont-check.yml"], B)]));
  assert.equal(unapproved.refused.length, 1);
  assert.match(unapproved.notes.join("\n"), /version [0-9a-f]{12} of the statement of t is not approved in force/);

  const partial = run(pr([({ put }) => (workflow({ put }), put("example/app/library.test.mjs", "// weakened\n")), rec([".github/workflows/ont-check.yml"], A)]));
  assert.deepEqual(partial.refused, [{ path: "example/app/library.test.mjs", why: "no record of a gate change of the pull request names it" }]);
  assert.deepEqual(partial.approved.map((a) => a.path), [".github/workflows/ont-check.yml"]);

  const later = run(pr([workflow, rec([".github/workflows/ont-check.yml"], A), ({ put }) => put("example/app/library.mjs", "export const lend = () => 2;\n")]));
  assert.equal(later.refused.length, 1);
  assert.match(later.notes.join("\n"), /outside reviews\/ the head is not commit [0-9a-f]{12} merged with main: example\/app\/library\.mjs/);

  const deleted = run(pr([({ rm }) => rm("example/app/library.test.mjs")]));
  assert.deepEqual(deleted.refused.map((r) => r.path), ["example/app/library.test.mjs"]);
  const renamed = run(pr([({ mv }) => mv("example/app/library.test.mjs", "example/app/other.test.mjs")]));
  assert.deepEqual(renamed.refused.map((r) => r.path).sort(), ["example/app/library.test.mjs", "example/app/other.test.mjs"]);

  const product = run(pr([({ put }) => put("example/app/library.mjs", "export const lend = () => 3;\n")]));
  assert.deepEqual([product.gated, product.refused], [[], []]);
  const records = run(pr([({ put }) => put("reviews/rounds/20261123T120000Z-t-result-1.md", "Task: t\n")]));
  assert.deepEqual([records.gated, records.refused], [[], []]);
});

test("[check.merge-gate.gate-path-approved] a record of a gate change for the approved version, naming the commit and the paths, approves the change", () => {
  const { pr, cfg } = gateRepo();
  const p = pr([
    ({ put }) => put("example/app/library.test.mjs", "// a stronger test\n"),
    ({ put, commits }) => put("reviews/tasks/20261123T110000Z-t-gate-change.md", CHANGE({ commit: commits.at(-1), paths: ["example/app/library.test.mjs"] })),
    ({ put }) => put("reviews/rounds/20261123T120000Z-t-result-1.md", "Task: t\n"),
  ]);
  const r = guard({ cfg: cfg(), base: p.base, head: p.head });
  assert.deepEqual(r.refused, []);
  assert.deepEqual(r.approved, [{ path: "example/app/library.test.mjs", by: ["20261123T110000Z-t-gate-change.md"] }]);
});

test("[check.merge-gate.gate-path-approved] a version approved by a round whose one finding is filed for later is approved for the guard as for --task, and a ticket without the class approves nothing", () => {
  const { git, put, pr, cfg } = gateRepo();
  // Round 2 of the statement approves version B with its one finding filed in a ticket at the head.
  const CLASS = "a filing the guard reads";
  const filed = (ticket) => [
    ({ put }) => {
      put("issues/0001-a-filing.md", ticket);
      put("reviews/rounds/20261123T103000Z-t-statement-2.md", [ROUND(B).replace("Number: 1", "Number: 2").replace("10:00:00Z", "10:30:00Z").trimEnd(), "Findings:", `- ${CLASS} · important · change · later · issues/0001-a-filing.md`, ""].join("\n"));
    },
    ({ put }) => put("example/app/library.test.mjs", "// a stronger test\n"),
    ({ put, commits }) => put("reviews/tasks/20261123T110000Z-t-gate-change.md", CHANGE({ commit: commits.at(-1), paths: ["example/app/library.test.mjs"], hash: B })),
  ];
  // What --task reads as approved, from the working tree at the head.
  const forTask = (p) => {
    git("checkout", "-q", p.head);
    try {
      const c = cfg();
      return approvedHash(readRoundRecords(c).rounds, "t", null, parseTaskRecords(c.taskRecords.dir, { latinOnly: true }).approvals);
    } finally {
      git("checkout", "-q", "main");
    }
  };

  const held = pr(filed(`# ${CLASS}\n`));
  assert.equal(forTask(held), B);
  const r = guard({ cfg: cfg(), base: held.base, head: held.head });
  assert.deepEqual(r.refused, [], r.notes.join("\n"));
  assert.deepEqual(r.approved, [{ path: "example/app/library.test.mjs", by: ["20261123T110000Z-t-gate-change.md"] }]);

  // The ticket is read from the head, not from the working tree: one in the working tree that holds the
  // class does not make the head's filing right.
  const wrong = pr(filed("# another class\n"));
  put("issues/0001-a-filing.md", `# ${CLASS}\n`);
  const refused = guard({ cfg: cfg(), base: wrong.base, head: wrong.head });
  assert.deepEqual(refused.refused, [{ path: "example/app/library.test.mjs", why: "no record of a gate change of the pull request approves it" }]);
  assert.match(refused.notes.join("\n"), /version [0-9a-f]{12} of the statement of t is not approved in force \([0-9a-f]{12} is\)/);
  assert.equal(refused.notes.join("\n").match(/\(([0-9a-f]{12}) is\)/)[1], A.slice(0, 12));
});

test("[check.merge-gate.guard-runs-nothing] main's guard refuses a head that replaces the guard, runs nothing of it and leaves the clone as it was", () => {
  const { repo, git, pr } = gateRepo();
  const marker = join(repo, "ran-from-the-pull-request");
  const p = pr([
    ({ put }) => {
      put("tools/ont-check/merge-gate.mjs", `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "ran");\nconsole.log("GATE_OK");\n`);
      put(".github/workflows/ont-check.yml", "name: weakened\n");
    },
  ]);
  const before = [git("rev-parse", "HEAD"), git("status", "--porcelain"), git("diff", "--cached", "--name-only")];
  const r = spawnSync("node", ["tools/ont-check/merge-gate.mjs", "guard", "--base", p.base, "--head", p.head], { cwd: repo, encoding: "utf8", env: GIT_ENV });
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /tools\/ont-check\/merge-gate\.mjs: no record of a gate change of the pull request approves it/);
  assert.match(r.stdout, /\.github\/workflows\/ont-check\.yml/);
  assert.match(r.stdout, /GATE_REFUSED$/m);
  assert.ok(!existsSync(marker), "nothing of the head ran");
  assert.deepEqual([git("rev-parse", "HEAD"), git("status", "--porcelain"), git("diff", "--cached", "--name-only")], before);
});

test("[check.merge-gate.paths-match] the gate paths take the workflows, the hooks, the configurations, the tool and the example's tests, not its product", () => {
  const paths = ROOT_CFG.mergeGate.paths;
  for (const p of [".github/workflows/ont-check.yml", ".githooks/pre-commit", "package.json", "ont.config.json", "example/ont.config.json", "tools/ont-check/lib.mjs", "templates/ontology.md", "example/app/library.test.mjs", "example/app/adapter.mjs", "example/e2e/cli.test.mjs", "example/traces/traces.test.mjs", "example/judged/screens.judged.mjs"])
    assert.ok(isGatePath(p, paths), p);
  for (const p of ["example/app/library.mjs", "example/ontology.md", "ontology.md", "reviews/tasks/x.md", "example/app/sub/library.test.mjs", "docs/lifecycle.md"]) assert.ok(!isGatePath(p, paths), p);
});

test("[check.merge-gate.rule-file] the ruleset requires a pull request merged by a merge commit, both checks by name and app, an up-to-date branch, and no bypass", () => {
  const cfg = loadConfig(join(TOP, "ont.config.json"));
  assert.equal(cfg.mergeGate.rules, join(TOP, ".github/merge-gate.json"));
  const { ruleset, actions } = JSON.parse(read(".github/merge-gate.json"));
  assert.equal(ruleset.target, "branch");
  assert.equal(ruleset.enforcement, "active");
  assert.deepEqual(ruleset.conditions.ref_name.include, ["refs/heads/main"]);
  assert.deepEqual(ruleset.bypass_actors, []);
  const rule = (type) => ruleset.rules.find((r) => r.type === type);
  assert.ok(rule("deletion") && rule("non_fast_forward"));
  assert.deepEqual(rule("pull_request").parameters.allowed_merge_methods, ["merge"]);
  const checks = rule("required_status_checks").parameters;
  assert.equal(checks.strict_required_status_checks_policy, true);
  assert.deepEqual(checks.required_status_checks.map((c) => c.context).sort(), [...jobs(FULL), ...jobs(GUARD)].sort());
  for (const c of checks.required_status_checks) assert.equal(c.integration_id, 15368, "the GitHub Actions app");
  assert.deepEqual(actions.permissions, { enabled: true, allowed_actions: "all" });
  assert.equal(actions.workflow.default_workflow_permissions, "read");
  const policy = actions.policies.find((p) => p.conditions.workflow_path.include.includes(".github/workflows/ont-gate-guard.yml"));
  assert.equal(policy.enforcement, "active");
  assert.deepEqual(policy.rules, [{ type: "restrict_action_events", parameters: { allowed_events: ["pull_request_target"] } }]);
});

test("[check.merge-gate.ruleset-printed] the ruleset of the rule file is printed for the GitHub API, and a missing rule file is an error", () => {
  const cli = (cfg) => spawnSync("node", [join(TOOLS, "merge-gate.mjs"), "ruleset", "--config", cfg], { cwd: TOP, encoding: "utf8" });
  const ok = cli(join(TOP, "ont.config.json"));
  assert.equal(ok.status, 0, ok.stdout);
  assert.deepEqual(JSON.parse(ok.stdout), JSON.parse(read(".github/merge-gate.json")).ruleset);
  const dir = temp("ruleset-");
  writeFileSync(join(dir, "none.json"), JSON.stringify({ classes: { ent: "Entity" } }));
  writeFileSync(join(dir, "missing.json"), JSON.stringify({ classes: { ent: "Entity" }, mergeGate: { paths: [], rules: "gone.json" } }));
  const none = cli(join(dir, "none.json"));
  assert.equal(none.status, 1);
  assert.match(none.stdout, /names no mergeGate\.rules/);
  const missing = cli(join(dir, "missing.json"));
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /the rule file .*gone\.json cannot be read/);
});

test("[check.merge-gate.records-only-since-review] the head may be past the reviewed commit only by records, a clean merge of main among them", () => {
  const { repo, git, put } = gateRepo();
  const reviewed = git("rev-parse", "HEAD");
  const commit = (p, text) => (put(p, text), git("add", "-A"), git("commit", "-q", "-m", p), git("rev-parse", "HEAD"));
  const cli = (args) => spawnSync("node", ["tools/ont-check/merge-gate.mjs", "records-only", ...args], { cwd: repo, encoding: "utf8", env: GIT_ENV });
  git("checkout", "-q", "-b", "task");
  const rounds = commit("reviews/rounds/20261123T130000Z-t-result-1.md", "Task: t\n");
  // main goes on, and the branch is updated with it by a clean merge.
  git("checkout", "-q", "main");
  const main = commit("docs/other.md", "other\n");
  git("checkout", "-q", "task");
  git("merge", "-q", "--no-edit", "main");
  const merged = git("rev-parse", "HEAD");
  const ok = cli(["--reviewed", reviewed, "--head", merged, "--base", main]);
  assert.equal(ok.status, 0, ok.stdout);
  assert.match(ok.stdout, /RECORDS_ONLY/);
  assert.equal(cli(["--reviewed", reviewed, "--head", rounds]).status, 0);
  const changed = commit("example/app/library.test.mjs", "// changed after the review\n");
  const bad = cli(["--reviewed", reviewed, "--head", changed, "--base", main]);
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /outside reviews\/ the head is not the reviewed commit merged with the base: example\/app\/library\.test\.mjs/);
  assert.match(bad.stdout, new RegExp(`  ${changed}$`, "m"));
  git("checkout", "-q", "main");
  const outside = cli(["--reviewed", changed, "--head", main]);
  assert.equal(outside.status, 1);
  assert.match(outside.stdout, /the reviewed commit [0-9a-f]{40} is not in the head/);
});

test("[check.merge-gate.pre-commit-index] the hook checks what the commit holds, its index, whatever paths the commit changes", () => {
  const repo = temp("hook-repo-");
  const log = join(temp("hook-log-"), "log");
  const git = (...a) => spawnSync("git", ["-C", repo, ...a], { encoding: "utf8", env: { ...GIT_ENV, HOOK_LOG: log } });
  git("init", "-q", "-b", "main");
  mkdirSync(join(repo, ".githooks"));
  cpSync(join(TOP, ".githooks/pre-commit"), join(repo, ".githooks/pre-commit"));
  chmodSync(join(repo, ".githooks/pre-commit"), 0o755);
  // A check that fails when the files it is run on hold "broken", and says where it ran.
  writeFileSync(join(repo, "check.mjs"), 'import { appendFileSync, existsSync } from "node:fs";\nappendFileSync(process.env.HOOK_LOG, process.cwd() + "\\n");\nprocess.exit(existsSync("broken") ? 1 : 0);\n');
  // A guard of decisions that says where it ran, and passes as the commit holds it.
  writeFileSync(join(repo, "guard.mjs"), 'import { appendFileSync } from "node:fs";\nappendFileSync(process.env.HOOK_LOG + ".guard", process.cwd() + "\\n");\n');
  writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "p", private: true, type: "module", scripts: { check: "node check.mjs", guard: "node guard.mjs" } }));
  git("add", "-A");
  git("commit", "-q", "--no-verify", "-m", "start");
  git("config", "core.hooksPath", ".githooks");
  const ran = () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").length : 0);

  writeFileSync(join(repo, "broken"), "x\n");
  git("add", "broken");
  rmSync(join(repo, "broken"));
  const staged = git("commit", "-q", "-m", "broken in the index, fixed in the working tree");
  assert.notEqual(staged.status, 0, "the index is checked");
  assert.equal(ran(), 1);
  git("rm", "-q", "--cached", "broken");

  writeFileSync(join(repo, "broken"), "x\n");
  writeFileSync(join(repo, "notes.md"), "notes\n");
  git("add", "notes.md");
  const tree = git("commit", "-q", "-m", "broken in the working tree only");
  assert.equal(tree.status, 0, tree.stderr);
  assert.equal(ran(), 2);

  mkdirSync(join(repo, "reviews"));
  writeFileSync(join(repo, "reviews/round.md"), "a record\n");
  git("add", "reviews/round.md");
  const record = git("commit", "-q", "-m", "a record alone");
  assert.equal(record.status, 0, record.stderr);
  assert.equal(ran(), 3, "the hook runs on a commit of a record too");
  assert.ok(readFileSync(log, "utf8").trim().split("\n").every((d) => d !== repo), "the check ran outside the working tree");

  // An unfinished edit of the guard of decisions, left unstaged, that would refuse every commit: the
  // commit of a whole staged change is made, by the guard the commit holds, run where the check ran.
  rmSync(join(repo, "broken"));
  writeFileSync(join(repo, "guard.mjs"), "process.exit(1);\n");
  writeFileSync(join(repo, "more.md"), "more\n");
  git("add", "more.md");
  const unstaged = git("commit", "-q", "-m", "a whole change, the guard broken in the working tree only");
  assert.equal(unstaged.status, 0, unstaged.stderr);
  assert.equal(ran(), 4);
  const guards = readFileSync(`${log}.guard`, "utf8").trim().split("\n");
  assert.equal(guards.length, 3, "the guard ran on each commit the check passed");
  assert.ok(guards.every((d) => d !== repo), "the guard ran outside the working tree");
  assert.equal(git("worktree", "list").stdout.trim().split("\n").length, 1, "the temporary worktree is removed");
});

test("[check.merge-gate.hook-installed] installing the dependencies sets the clone's hooks to those of the repository", () => {
  const repo = temp("install-");
  spawnSync("git", ["-C", repo, "init", "-q"], { env: GIT_ENV });
  cpSync(join(TOP, "package.json"), join(repo, "package.json"));
  assert.equal(spawnSync("git", ["-C", repo, "config", "core.hooksPath"], { encoding: "utf8", env: GIT_ENV }).stdout.trim(), "");
  const r = spawnSync("npm", ["install", "--no-audit", "--no-fund", "--offline", "--no-package-lock"], { cwd: repo, encoding: "utf8", env: GIT_ENV });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(spawnSync("git", ["-C", repo, "config", "core.hooksPath"], { encoding: "utf8", env: GIT_ENV }).stdout.trim(), ".githooks");
});

test("[check.merge-gate.ci-workflow-reported] a configuration without a CI workflow is reported, one that names a missing file fails", () => {
  const dir = temp("ci-");
  cpSync(join(TOP, "templates"), join(dir, "t"), { recursive: true });
  const cfgPath = join(dir, "t", "ont.config.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  const check = () => spawnSync("node", [join(TOOLS, "ont-check.mjs"), "--config", cfgPath], { cwd: dir, encoding: "utf8" });
  const named = check();
  assert.equal(named.status, 0, named.stdout);
  assert.doesNotMatch(named.stdout, /no CI workflow is named/);
  delete cfg.ci;
  writeFileSync(cfgPath, JSON.stringify(cfg));
  const none = check();
  assert.equal(none.status, 0, none.stdout);
  assert.match(none.stdout, /info · no CI workflow is named \(ci\.workflow\)/);
  writeFileSync(cfgPath, JSON.stringify({ ...cfg, ci: { workflow: ".github/workflows/gone.yml" } }));
  const missing = check();
  assert.notEqual(missing.status, 0);
  assert.match(missing.stdout, /ERROR · the CI workflow .*gone\.yml that ci\.workflow names is not a file/);
  assert.doesNotMatch(missing.stdout, /ONT_OK/);
});

// Records of the directory of task records, read as the check reads them.
const records = (files) => {
  const dir = temp("records-");
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return parseTaskRecords(dir, { latinOnly: true });
};
const C40 = "a".repeat(40);

test("[check.gate-change.read] a record of a gate change in its form is read, and each one out of form is refused with the reason", () => {
  const good = CHANGE({ commit: C40, paths: [".github/workflows/ont-check.yml", "example/app/library.test.mjs"] });
  const r = records({
    "20261123T110000Z-t-gate-change.md": good,
    "20261123T110001Z-t-gate-change.md": good.replace(/Paths:\n(- .*\n)+/, ""),
    "20261123T110002Z-t-gate-change.md": good.replace(C40, "abc1234"),
    "20261123T110003Z-t-gate-change.md": good.replace("Item: 2\n", ""),
    "20261123T110004Z-t-proof.md": good,
    "20261123T110005Z-t-gate-change.md": good.replace("Item: 2", "Item: пункт 2"),
  });
  assert.deepEqual(r.gateChanges, [{ file: "20261123T110000Z-t-gate-change.md", task: "t", statementHash: A, item: "2", paths: [".github/workflows/ont-check.yml", "example/app/library.test.mjs"], commit: C40, time: "2026-11-23T11:00:00Z" }]);
  const m = r.malformed.join("\n");
  assert.match(m, /110001Z-t-gate-change\.md: no paths/);
  assert.match(m, /110002Z-t-gate-change\.md: commit abc1234 is not a full commit/);
  assert.match(m, /110003Z-t-gate-change\.md: no item of What to do/);
  assert.match(m, /110004Z-t-proof\.md: the file is not named <time>-t-gate-change\.md/);
  assert.match(m, /110005Z-t-gate-change\.md: line 4: the letter п is not English text/);
  assert.equal(r.malformed.length, 5);
});

const PROOF = (lines) => ["Record: gate-proof", "Gate: enforcement-merge-gate", ...lines, "Time: 2026-11-24T10:00:00Z", ""].join("\n");
const PR_LINES = ["Probe: pr 12", `Head: ${"b".repeat(40)}`, `Base: ${"c".repeat(40)}`, "Check: ont-check · failure", "Run: 345 · https://github.com/owner/repo/actions/runs/345", "Required: ont-check · failure"];
const REFUSAL = PROOF(["Kind: refusal", "Result: refused", "Refused-by: ont-check", "Answer: Required status check \"ont-check\" is failing.", ...PR_LINES]);
const PASS = PROOF(["Kind: pass", "Result: merged", `Merge: ${"d".repeat(40)}`, ...PR_LINES.map((l) => l.replace("failure", "success"))]);

test("[check.gate-proof.read] records of a refusal and of a pass are read with their fields, and each one out of form is refused with the reason", () => {
  const name = (i) => `20261124T10000${i}Z-enforcement-merge-gate-gate-proof.md`;
  const r = records({
    [name(0)]: REFUSAL,
    [name(1)]: PASS,
    [name(2)]: REFUSAL.replace(/^Answer: .*\n/m, ""),
    [name(3)]: REFUSAL.replace(/^Refused-by: .*\n/m, ""),
    [name(4)]: PASS.replace(/^Merge: .*\n/m, ""),
    [name(5)]: REFUSAL.replace(/^Head: .*\n/m, ""),
    [name(6)]: REFUSAL.replace("Result: refused", "Result: merged"),
    [name(7)]: REFUSAL.replace("Refused-by: ont-check", "Refused-by: /home/someone/log.txt"),
    [name(8)]: REFUSAL.replace("Kind: refusal", "Kind: constructor"),
    [name(9)]: REFUSAL.replace("Kind: refusal", "Kind: attack"),
    "20261124T100010Z-enforcement-merge-gate-gate-proof.md": PASS.replace("Result: merged", "Result: pushed"),
    "20261124T100011Z-enforcement-merge-gate-gate-proof.md": PASS.replace("Probe: pr 12", "Probe: push refs/heads/main"),
  });
  assert.deepEqual(
    r.gateProofs.map((p) => [p.file, p.kind, p.probe, p.result, p.head, p.base, p.check, p.run, p.required, p.refusedBy, p.answer, p.merge]),
    [
      [name(0), "refusal", "pr 12", "refused", "b".repeat(40), "c".repeat(40), "ont-check · failure", "345 · https://github.com/owner/repo/actions/runs/345", "ont-check · failure", "ont-check", 'Required status check "ont-check" is failing.', null],
      [name(1), "pass", "pr 12", "merged", "b".repeat(40), "c".repeat(40), "ont-check · success", "345 · https://github.com/owner/repo/actions/runs/345", "ont-check · success", null, null, "d".repeat(40)],
    ],
  );
  const m = r.malformed.join("\n");
  assert.match(m, new RegExp(`${name(2)}: a refusal has no answer of GitHub`));
  assert.match(m, new RegExp(`${name(3)}: a refusal names no check or rule that refused it`));
  assert.match(m, new RegExp(`${name(4)}: a pass has no merge commit in full`));
  assert.match(m, new RegExp(`${name(5)}: head \\(none\\) is not a full commit`));
  assert.match(m, new RegExp(`${name(6)}: result merged disagrees with the kind refusal`));
  assert.match(m, new RegExp(`${name(7)}: .*/home/someone/log\\.txt is a path outside the repository`));
  // A kind is refusal or pass by that name: not a name every object inherits, nor any other.
  assert.match(m, new RegExp(`${name(8)}: kind constructor is not refusal or pass`));
  assert.match(m, new RegExp(`${name(9)}: kind attack is not refusal or pass`));
  // A pass is an ordinary merge of a pull request: recorded as pushed, or as a push, it is refused.
  assert.match(m, /100010Z-enforcement-merge-gate-gate-proof\.md: result pushed disagrees with the kind pass/);
  assert.match(m, /100011Z-enforcement-merge-gate-gate-proof\.md: a pass is a merge of a pull request, not a push/);
  assert.equal(r.malformed.length, 10);
});

const BEHIND = PROOF(["Kind: refusal", "Result: refused", "Refused-by: the branch up to date with main", "Answer: Head branch is out of date with the base branch.", ...PR_LINES.map((l) => l.replace("failure", "success")), `Main-after: ${"e".repeat(40)}`]);

test("[check.gate-proof.read] a refusal for being behind keeps the base read before main moved on and the tip of main after, as two commits, and one without the earlier base is refused", () => {
  const name = (i) => `20261124T10010${i}Z-enforcement-merge-gate-gate-proof.md`;
  const r = records({
    [name(0)]: BEHIND,
    [name(1)]: BEHIND.replace(/^Main-after: .*\n/m, ""),
    [name(2)]: BEHIND.replace(/^Base: .*\n/m, ""),
    [name(3)]: BEHIND.replace(`Base: ${"c".repeat(40)}`, `Base: ${"e".repeat(40)}`),
    [name(4)]: BEHIND.replace(`Main-after: ${"e".repeat(40)}`, "Main-after: main"),
    [name(5)]: REFUSAL.replace("Time:", `Main-after: ${"e".repeat(40)}\nTime:`),
  });
  assert.deepEqual(
    r.gateProofs.map((p) => [p.file, p.refusedBy, p.head, p.base, p.mainAfter]),
    [[name(0), "the branch up to date with main", "b".repeat(40), "c".repeat(40), "e".repeat(40)]],
  );
  const m = r.malformed.join("\n");
  assert.match(m, new RegExp(`${name(1)}: a refusal for being behind has no Main-after`));
  assert.match(m, new RegExp(`${name(2)}: base \\(none\\) is not a full commit`));
  assert.match(m, new RegExp(`${name(3)}: the base is the tip of main after it moved on: it was read after main moved`));
  assert.match(m, new RegExp(`${name(4)}: main-after main is not a full commit`));
  assert.match(m, new RegExp(`${name(5)}: Main-after is the tip of main of a refusal for being behind, and this record is none`));
  assert.equal(r.malformed.length, 5);
});

test("[check.owner-approval.read-as-before] where records are English only, the records of spend, of done and of approval are read as before, and only the records of a gate change and of a gate proof are held to it", () => {
  const approval = ["Record: approval", "Task: t", `Statement-hash: ${A}`, "By: owner", 'Source: the owner\'s answer to question 1, "Да"', "Time: 2026-11-21T13:52:40Z", ""].join("\n");
  const spend = ["Record: spend", "Task: t", "Contribution: сессия · s1", "Start: 2026-11-21T10:00:00Z", "End: 2026-11-21T10:30:00Z", "Tokens-new: 10", ""].join("\n");
  const done = ["Record: done", "Task: t", `Commit: ${C40}`, `Statement-hash: ${A}`, "Time: 2026-11-21T11:00:00Z", "Checks:", "- npm test · pass", "Note: готово", ""].join("\n");
  const r = records({
    "20261121T135240Z-t-approval.md": approval,
    "20261121T100000Z-t-spend.md": spend,
    "20261121T110000Z-t-done.md": done,
    "20261123T110000Z-t-gate-change.md": CHANGE({ commit: C40, paths: ["package.json"], item: "пункт 2" }),
    "20261124T100000Z-enforcement-merge-gate-gate-proof.md": REFUSAL.replace("Refused-by: ont-check", "Refused-by: проверка"),
  });
  assert.deepEqual(r.approvals.map((x) => x.file), ["20261121T135240Z-t-approval.md"]);
  assert.deepEqual(r.spend.map((x) => x.file), ["20261121T100000Z-t-spend.md"]);
  assert.deepEqual(r.done.map((x) => x.file), ["20261121T110000Z-t-done.md"]);
  assert.equal(r.malformed.length, 2, r.malformed.join("\n"));
  assert.match(r.malformed.join("\n"), /20261123T110000Z-t-gate-change\.md: line 4: the letter п is not English text/);
  assert.match(r.malformed.join("\n"), /20261124T100000Z-enforcement-merge-gate-gate-proof\.md: line \d+: the letter п is not English text/);
  // The configuration names no start of a rule for the earlier kinds, and the loader reads no such key.
  assert.equal(ROOT_CFG.taskRecords.latinAfter, undefined);
  assert.equal(loadConfig(join(TOP, "ont.config.json")).taskRecords.latinAfter, undefined);
  // This repository's records are read with none refused, and the record of round-rules, corrected in
  // place (item 8), holds Latin letters only.
  assert.deepEqual(parseTaskRecords(join(TOP, "reviews/tasks"), { latinOnly: true }).malformed, []);
  assert.match(read("reviews/tasks/20261121T135240Z-round-rules-approval.md"), /^[\x00-\x7F]*$/);
});

test("[check.tool-copy.copy-verified-in-ci] the templates' step verifies a pinned copy, fails on an edited one, and is skipped with no pin", () => {
  const project = temp("pinned-");
  const update = spawnSync("node", [join(TOOLS, "pin.mjs"), "update", "--from", TOP, "--ref", "HEAD", "--dir", join(project, "vendor/oas"), "--pin", join(project, "pins/oas.json")], { cwd: project, encoding: "utf8" });
  assert.equal(update.status, 0, update.stdout + update.stderr);
  const step = stepRun(TEMPLATE, "The copy of the tool matches its pin");
  const run = (ONT_PIN) => spawnSync("sh", ["-c", step], { cwd: project, encoding: "utf8", env: { ...process.env, ONT_TOOL: "vendor/oas", ONT_PIN } });
  const ok = run("pins/oas.json");
  assert.equal(ok.status, 0, ok.stdout);
  writeFileSync(join(project, "vendor/oas/lib.mjs"), readFileSync(join(project, "vendor/oas/lib.mjs"), "utf8") + "// edited\n");
  const edited = run("pins/oas.json");
  assert.equal(edited.status, 1);
  assert.match(edited.stdout, /changed: lib\.mjs/);
  const none = run("");
  assert.equal(none.status, 0);
  assert.match(none.stdout, /No pin is named/);
});

test("[check.tool-copy.template-workflow] the templates' workflow runs as the approach's does, with the project's tool, configuration, pin and tests", () => {
  assert.deepEqual(onBlock(TEMPLATE).trim().split("\n").map((l) => l.trim()), onBlock(FULL).trim().split("\n").map((l) => l.trim()));
  assert.deepEqual(jobs(TEMPLATE), ["ont-check"]);
  assert.deepEqual(permissions(TEMPLATE), ["contents: read"]);
  for (const k of ["ONT_TOOL", "ONT_CONFIG", "ONT_PIN", "ONT_TEST"]) assert.match(TEMPLATE, new RegExp(`^ {2}${k}: \\S`, "m"), k);
  const commands = runs(TEMPLATE);
  assert.match(commands[0], /node "\$ONT_TOOL\/pin\.mjs" verify --pin "\$ONT_PIN"/);
  assert.ok(commands.includes('node "$ONT_TOOL/ont-check.mjs" --config "$ONT_CONFIG"'));
  const guardStep = stepRun(TEMPLATE, "Accepted decisions are not edited");
  assert.equal(guardStep, 'node "$ONT_TOOL/guard-decisions.mjs" --config "$ONT_CONFIG" --base "$BASE"');
  assert.equal(commands.at(-1), "$ONT_TEST");
  // The guard of the templates fails on a base that is not found, as the approach's does.
  const missing = spawnSync("sh", ["-c", guardStep], { cwd: TOP, encoding: "utf8", env: { ...GIT_ENV, ONT_TOOL: "tools/ont-check", ONT_CONFIG: "templates/ont.config.json", BASE: "0123456789abcdef0123456789abcdef01234567" } });
  assert.notEqual(missing.status, 0, missing.stdout);
  assert.match(missing.stdout, /not found/);
});

test("[check.ontology-tree.after-server-merge] the rules for agents give the step after a merge on GitHub in its order", () => {
  const rule = read("AGENTS.md").match(/^- \*\*The tree after a merge on GitHub\.\*\*.*$/m)?.[0];
  assert.ok(rule, "the rule is in AGENTS.md");
  const order = ["git config --path ont.treeOut", "git pull --ff-only", "origin/main", "gen-tree.mjs --stale", "gen-tree.mjs --refresh", "`--stale` again", "built from"];
  const at = order.map((s) => rule.indexOf(s));
  assert.ok(at.every((i) => i >= 0), JSON.stringify(order.filter((_, i) => at[i] < 0)));
  assert.deepEqual([...at].sort((a, b) => a - b), at);
  assert.match(rule, /rule\.tree-after-server-merge/);
});

// The object file of a loose object of a repository, removed so that Git fails to read it.
const dropObject = (repo, oid) => rmSync(join(repo, ".git/objects", oid.slice(0, 2), oid.slice(2)));

test("[check.merge-gate.git-fails-closed] a Git command that fails is an error of the guard and of records-only, never an empty change", () => {
  const { repo, git, pr, cfg, put } = gateRepo();
  const p = pr([({ put }) => put(".github/workflows/ont-check.yml", "name: weakened\n")]);
  dropObject(repo, git("rev-parse", `${p.head}:.github/workflows`));
  const r = guard({ cfg: cfg(), base: p.base, head: p.head });
  assert.ok(r.errors?.length, JSON.stringify(r));
  assert.match(r.errors.join("\n"), /git [a-z-]+ .*failed/);
  const cli = spawnSync("node", ["tools/ont-check/merge-gate.mjs", "guard", "--base", p.base, "--head", p.head], { cwd: repo, encoding: "utf8", env: GIT_ENV });
  assert.equal(cli.status, 1, cli.stdout);
  assert.doesNotMatch(cli.stdout, /GATE_OK/);

  // A head past the reviewed commit by a commit whose tree is missing, then a commit of a record.
  git("checkout", "-q", "-b", "task", p.base);
  const reviewed = git("rev-parse", "HEAD");
  put("docs/x/a.md", "a change after the review\n");
  git("add", "-A");
  git("commit", "-q", "-m", "a change");
  const changed = git("rev-parse", "HEAD");
  put("reviews/rounds/20261123T130000Z-t-result-1.md", "Task: t\n");
  git("add", "-A");
  git("commit", "-q", "-m", "a record");
  const head = git("rev-parse", "HEAD");
  dropObject(repo, git("rev-parse", `${changed}:docs/x`));
  const ro = spawnSync("node", ["tools/ont-check/merge-gate.mjs", "records-only", "--reviewed", reviewed, "--head", head], { cwd: repo, encoding: "utf8", env: GIT_ENV });
  assert.equal(ro.status, 1, ro.stdout);
  assert.match(ro.stdout, /ERROR · git [a-z-]+ .*failed/);
  assert.doesNotMatch(ro.stdout, /RECORDS_ONLY/);
});

test("[check.merge-gate.resolution-kept] records-only compares the head's tree with the reviewed commit merged with main, so a resolution that drops a reviewed change is refused", () => {
  const { repo, git, put } = gateRepo();
  const commit = (path, text, msg = path) => (put(path, text), git("add", "-A"), git("commit", "-q", "-m", msg), git("rev-parse", "HEAD"));
  const cli = (args) => spawnSync("node", ["tools/ont-check/merge-gate.mjs", "records-only", ...args], { cwd: repo, encoding: "utf8", env: GIT_ENV });
  const start = git("rev-parse", "HEAD");
  git("checkout", "-q", "-b", "task");
  const reviewed = commit("example/app/library.test.mjs", "// the reviewed test\n");
  git("checkout", "-q", "main");
  const main = commit("docs/other.md", "other\n");
  // The branch is updated with main by a merge whose resolution takes main's version of the reviewed test.
  git("checkout", "-q", "-b", "dropped", reviewed);
  git("merge", "-q", "--no-commit", "--no-ff", "main");
  git("checkout", "main", "--", "example/app/library.test.mjs");
  git("commit", "-q", "--no-edit");
  const dropped = cli(["--reviewed", reviewed, "--head", git("rev-parse", "HEAD"), "--base", main]);
  assert.equal(dropped.status, 1, dropped.stdout);
  assert.match(dropped.stdout, /the head is not the reviewed commit merged with the base: example\/app\/library\.test\.mjs/);
  // A clean merge of main, then a record.
  git("checkout", "-q", "-b", "clean", reviewed);
  git("merge", "-q", "--no-edit", "main");
  const clean = commit("reviews/rounds/20261123T130000Z-t-result-1.md", "Task: t\n");
  const ok = cli(["--reviewed", reviewed, "--head", clean, "--base", main]);
  assert.equal(ok.status, 0, ok.stdout);
  assert.match(ok.stdout, /RECORDS_ONLY/);
  // main changes the same test: the merge conflicts, and the resolution that keeps the branch's version is
  // still a change no reviewer read.
  git("checkout", "-q", "-b", "main2", main);
  const main2 = commit("example/app/library.test.mjs", "// main's test\n");
  git("checkout", "-q", "-b", "conflict", reviewed);
  spawnSync("git", ["-C", repo, "merge", "-q", "--no-edit", "main2"], { env: GIT_ENV });
  git("checkout", "--ours", "--", "example/app/library.test.mjs");
  git("add", "-A");
  git("commit", "-q", "--no-edit");
  const conflict = cli(["--reviewed", reviewed, "--head", git("rev-parse", "HEAD"), "--base", main2]);
  assert.equal(conflict.status, 1, conflict.stdout);
  assert.match(conflict.stdout, /the reviewed commit and the base conflict outside reviews\/: example\/app\/library\.test\.mjs/);
  // A head that does not contain the main it is given.
  const behind = cli(["--reviewed", reviewed, "--head", reviewed, "--base", main]);
  assert.equal(behind.status, 1, behind.stdout);
  assert.match(behind.stdout, /the head [0-9a-f]{40} does not contain the base [0-9a-f]{40}/);
  assert.ok(start);
  // After a narrow round that follows a confirmed condition (rule.fixes-held-by-tests, D-165): the narrow
  // round reviewed the reviewed commit, and a fix of the test follows it. With no record of done after it
  // the head is compared with the reviewed commit and refused; the record of done on the fix ends the
  // range of fixes, and the head, updated with main by a clean merge and with records after it, is
  // compared with that record's commit merged with main, and passes.
  git("checkout", "-q", "-b", "fixes", reviewed);
  const rec = (path, lines) => put(path, [...lines, ""].join("\n"));
  const done = (name, at, time) => rec(`reviews/tasks/${name}`, ["Record: done", "Task: t", `Commit: ${at}`, `Statement-hash: ${A}`, `Time: ${time}`, "Checks:", "- npm test · pass"]);
  done("20261123T110000Z-t-done.md", reviewed, "2026-11-23T11:00:00Z");
  rec("reviews/rounds/20261123T120000Z-t-result-1.md", ["Task: t", "Step: result-review", "Number: 1", "Time: 2026-11-23T12:00:00Z", "By: a model (a provider)", `Commits: ${reviewed.slice(0, 7)}`, `Statement-hash: ${A}`, "Condition: holds", "Findings:", "- a · important · change · fixable · t.test.mjs", "Acceptance: clean"]);
  rec("reviews/rounds/20261123T130000Z-t-result-narrow-1.md", ["Task: t", "Step: result-review", "Narrow: true", "Number: 1", "Time: 2026-11-23T13:00:00Z", "By: a model (a provider)", `Commits: ${reviewed.slice(0, 7)}`, `Statement-hash: ${A}`, "Findings:", "- b · important · change · fixable · t.test.mjs", "Acceptance: clean"]);
  git("add", "-A");
  git("commit", "-q", "-m", "the rounds");
  const fix = commit("example/app/library.test.mjs", "// the fixed test\n", "the fix");
  const noDone = cli(["--reviewed", reviewed, "--head", fix]);
  assert.equal(noDone.status, 1, noDone.stdout);
  assert.match(noDone.stdout, /the head is not the reviewed commit: example\/app\/library\.test\.mjs/);
  done("20261123T140000Z-t-done.md", fix, "2026-11-23T14:00:00Z");
  git("add", "-A");
  git("commit", "-q", "-m", "done");
  git("merge", "-q", "--no-edit", "main");
  const after = commit("reviews/notes.md", "a record of the process\n", "a record after the end of the range");
  const kept = cli(["--reviewed", reviewed, "--head", after, "--base", main]);
  assert.equal(kept.status, 0, kept.stdout);
  assert.match(kept.stdout, /^RECORDS_ONLY: outside reviews\/ the head is the commit of the record of done 20261123T140000Z-t-done\.md, which ends the range of fixes after the narrow round 20261123T130000Z-t-result-narrow-1\.md \(rule\.fixes-held-by-tests\) merged with the base/);
  // A change outside the records after the record of done is past the range, and refused.
  const past = commit("example/app/library.test.mjs", "// a change after done\n", "past the range");
  const refused = cli(["--reviewed", reviewed, "--head", past, "--base", main]);
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(refused.stdout, /example\/app\/library\.test\.mjs/);
});

test("[check.merge-gate.gate-change-bound] a record of a gate change approves only the commit it names: its paths, its next commit, and nothing but records and main after it", () => {
  const { repo, git, put, base, cfg } = gateRepo();
  const T = "example/app/library.test.mjs";
  const W = ".github/workflows/ont-check.yml";
  const P = "example/app/library.mjs";
  const commit = (files, msg) => {
    for (const [path, text] of Object.entries(files)) put(path, text);
    git("add", "-A");
    git("commit", "-q", "-m", msg);
    return git("rev-parse", "HEAD");
  };
  const record = (named, paths) => ({ "reviews/tasks/20261123T110000Z-t-gate-change.md": CHANGE({ commit: named, paths }) });
  const round = { "reviews/rounds/20261123T120000Z-t-result-1.md": "Task: t\n" };
  let n = 0;
  const branch = () => git("checkout", "-q", "-b", `bound${++n}`, base);
  const run = () => guard({ cfg: cfg(), base, head: git("rev-parse", "HEAD") });

  // A path the named commit does not change.
  branch();
  const c1 = commit({ [T]: "// a stronger test\n" }, "test");
  commit(record(c1, [T, W]), "record");
  const unchanged = run();
  assert.deepEqual(unchanged.refused.map((r) => r.path), [T]);
  assert.match(unchanged.notes.join("\n"), new RegExp(`approves nothing: .*${W.replace(/[./]/g, "\\$&")} does not change between the merge base and commit [0-9a-f]{12}`));

  // A record added two commits after the commit it names.
  branch();
  const c2 = commit({ [T]: "// a stronger test\n" }, "test");
  commit(round, "round");
  commit(record(c2, [T]), "record");
  const late = run();
  assert.deepEqual(late.refused.map((r) => r.path), [T]);
  assert.match(late.notes.join("\n"), /approves nothing: .*the record is not added by the commit right after commit [0-9a-f]{12}/);

  // After the record, a merge of main whose resolution takes main's version of a product file.
  git("checkout", "-q", "main");
  const main = commit({ "docs/other.md": "other\n" }, "main goes on");
  branch();
  const c3 = commit({ [T]: "// a stronger test\n", [P]: "export const lend = () => 2;\n" }, "test and product");
  commit(record(c3, [T]), "record");
  git("merge", "-q", "--no-commit", "--no-ff", "main");
  git("checkout", "main", "--", P);
  git("commit", "-q", "--no-edit");
  const resolved = guard({ cfg: cfg(), base: main, head: git("rev-parse", "HEAD") });
  assert.deepEqual(resolved.refused.map((r) => r.path), [T]);
  assert.match(resolved.notes.join("\n"), /outside reviews\/ the head is not commit [0-9a-f]{12} merged with main: example\/app\/library\.mjs/);

  // A clean merge of main and a round after the record pass.
  branch();
  const c4 = commit({ [T]: "// a stronger test\n" }, "test");
  commit(record(c4, [T]), "record");
  git("merge", "-q", "--no-edit", "main");
  commit(round, "round");
  const ok = guard({ cfg: cfg(), base: main, head: git("rev-parse", "HEAD") });
  assert.deepEqual(ok.refused, [], JSON.stringify(ok.notes));
  assert.deepEqual(ok.approved, [{ path: T, by: ["20261123T110000Z-t-gate-change.md"] }]);
  assert.ok(repo);
});

// The steps the rules for agents and the lifecycle give, found in this order.
const inOrder = (text, steps) => {
  const at = [];
  let from = 0;
  for (const s of steps) {
    const i = text.indexOf(s, from);
    assert.ok(i >= 0, `${s} after ${steps[at.length - 1] ?? "the start"}`);
    at.push(i);
    from = i + s.length;
  }
};

test("[check.merge-gate.switch-on-steps] switch-on prints the steps that switch the gate on from the rule file, in their order, each with its gh api calls", () => {
  const rules = JSON.parse(read(".github/merge-gate.json"));
  const cli = (...args) => spawnSync("node", [join(TOOLS, "merge-gate.mjs"), "switch-on", ...args], { cwd: TOP, encoding: "utf8", env: GIT_ENV });
  const r = cli("--repo", "owner/repo");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  // The steps, by their numbered titles, each with the lines under it.
  const steps = r.stdout.split(/\n(?=\d+\. )/).slice(1).map((t) => ({ title: t.split("\n")[0], text: t }));
  const titles = steps.map((x) => x.title);
  assert.deepEqual(titles, [
    "1. Allow pull_request_target for the guard's workflow by the Actions policy, the event policy.",
    "2. Read the Actions settings back and compare them with the rule file.",
    "3. Open the preflight pull request of the task's records alone and wait for both checks.",
    "4. Create the ruleset active from the rule file.",
    "5. Read the ruleset back and compare it with the rule file.",
    "6. Make the three refusal probes.",
    "7. Record a gate proof of each probe.",
    "8. Close the probes' pull requests and delete their branches.",
  ]);
  for (const x of steps) assert.match(x.text, /^ {3}\$ .*gh api /m, `${x.title} has its gh api call`);
  const [policy, readback, preflight, create, ruleset, probes, proofs, close] = steps.map((x) => x.text);
  // The event policy, before the preflight: its body is the rule file's, sent to the policies of Actions.
  const body = policy.match(/^ {3}\$ echo '(.*)' \| gh api -X POST repos\/owner\/repo\/actions\/policies --input -$/m);
  assert.ok(body, policy);
  assert.deepEqual(JSON.parse(body[1]), rules.actions.policies[0]);
  assert.ok(rules.actions.policies[0].rules[0].parameters.allowed_events.includes("pull_request_target"));
  assert.deepEqual(rules.actions.policies[0].conditions.workflow_path.include, [".github/workflows/ont-gate-guard.yml"]);
  // Each policy is read back by its own call, found by its name in the list, since the list gives summaries.
  const p0 = rules.actions.policies[0];
  inOrder(readback, [
    "the list gives summaries, and only the call of the policy gives its conditions and its rules to compare",
    `$ gh api repos/owner/repo/actions/policies --jq '.policies[] | select(.name == "${p0.name}") | .id'`,
    "$ gh api repos/owner/repo/actions/policies/<id> --jq '{name, enforcement, conditions, rules: [.rules[] | {type, parameters}]}'",
    "$ gh api repos/owner/repo/actions/permissions\n",
    "$ gh api repos/owner/repo/actions/permissions/workflow\n",
  ]);
  assert.ok(!/^ {3}\$ gh api repos\/owner\/repo\/actions\/policies$/m.test(readback), "no readback by the list alone");
  assert.match(readback, /enforcement active, workflows \.github\/workflows\/ont-gate-guard\.yml, excluded \[\], rules restrict_action_events, events pull_request_target/);
  assert.match(readback, /A difference stops here/);
  // The preflight: both checks, under their names and from their app, read on its head.
  for (const c of rules.ruleset.rules.find((x) => x.type === "required_status_checks").parameters.required_status_checks) assert.ok(preflight.includes(`${c.context} · success · app ${c.integration_id}`), c.context);
  assert.match(preflight, /\$ gh api repos\/owner\/repo\/commits\/<head>\/check-runs --jq '.*\.app\.id/);
  assert.match(preflight, /records alone/);
  assert.match(create, /\$ node tools\/ont-check\/merge-gate\.mjs ruleset \| gh api -X POST repos\/owner\/repo\/rulesets --input -/);
  // The readback of the ruleset, compared with the rule file.
  for (const want of ["enforcement active on refs/heads/main", "a pull request required, merged by merge alone", "the required checks ont-check from app 15368 and ont-gate-guard from app 15368", "strict, the branch up to date with main, true", "no bypass, bypass actors []", "A difference stops here"]) assert.ok(ruleset.includes(want), want);
  assert.match(ruleset, /\$ gh api repos\/owner\/repo\/rulesets\/<id> --jq/);
  // Probe 3: its base and head before main moves on, the tip of main after, then the attempt.
  inOrder(probes, ["refused by ont-check", "refused by ont-gate-guard", "(3)", "before main moves on, read its head and its base", "gh api repos/owner/repo/pulls/<n> --jq '[.head.sha, .base.sha] | @tsv'", "then main moves on", "then read the tip of main", "gh api repos/owner/repo/commits/main --jq .sha", "refused for being behind", "GitHub's answer naming the branch out of date", "$ gh api -X PUT repos/owner/repo/pulls/<n>/merge -f merge_method=merge -f sha=<head>"]);
  inOrder(proofs, ["reviews/tasks/<time>-<task>-gate-proof.md", "Kind: refusal", "Answer", "read in step 6 before the attempt, never read again here", "The first holds the preflight observation", "Preflight: pr <n>", "The third", "Base the base kept before main moved on", "Main-after the tip of main read after it moved"]);
  assert.doesNotMatch(proofs, /\$ gh api repos\/owner\/repo\/pulls\/<n> --jq/, "the proofs read no base again");
  inOrder(close, ["$ gh api -X PATCH repos/owner/repo/pulls/<n> -f state=closed", "$ gh api -X DELETE repos/owner/repo/git/refs/heads/<branch>"]);
  assert.match(r.stdout, /The proof of a pass is the merge of the next task's pull request through the gate/);
  // A rule file with no policy that allows the event gives no steps.
  const dir = temp("switch-on-");
  const cfg = { ...ROOT_CFG, mergeGate: { ...ROOT_CFG.mergeGate, rules: "rules.json" } };
  writeFileSync(join(dir, "rules.json"), JSON.stringify({ ...rules, actions: { ...rules.actions, policies: [] } }));
  writeFileSync(join(dir, "ont.config.json"), JSON.stringify(cfg));
  const none = cli("--config", join(dir, "ont.config.json"));
  assert.equal(none.status, 1, none.stdout);
  assert.match(none.stdout, /ERROR · the rule file rules\.json gives no steps: rules\.json holds no Actions policy that allows pull_request_target/);
  // The rules for agents and the lifecycle point to the command and do not list the steps.
  const rule = read("AGENTS.md").match(/^- \*\*Switch the gate on\.\*\*.*$/m)?.[0];
  assert.ok(rule, "the rule is in AGENTS.md");
  const page = read("docs/lifecycle.md");
  const section = page.slice(page.indexOf("### Switching the gate on"), page.indexOf("### Proving the gate"));
  for (const [where, text] of [["AGENTS.md", rule], ["docs/lifecycle.md", section]]) {
    assert.match(text, /`node tools\/ont-check\/merge-gate\.mjs switch-on --repo <owner>\/<repo>`/, where);
    assert.match(text, /D-163/, where);
    assert.doesNotMatch(text, /refused by `ont-check`|^\d+\. /m, `${where} lists no steps`);
  }
  assert.match(rule, /rule\.gate-switched-on/);
});

test("[check.merge-gate.commands-run] the commands of merge-gate.mjs the rules, the lifecycle and the README give are read by the tool, and the workflows the README names exist", () => {
  const head = spawnSync("git", ["-C", TOP, "rev-parse", "HEAD"], { encoding: "utf8", env: GIT_ENV }).stdout.trim();
  const readme = read("tools/ont-check/README.md");
  const commands = [];
  for (const file of ["AGENTS.md", "docs/lifecycle.md"]) for (const m of read(file).matchAll(/`([^`]*merge-gate\.mjs (?:guard|records-only|ruleset|switch-on)[^`]*)`/g)) commands.push([file, m[1]]);
  for (const m of readme.matchAll(/^(node tools\/ont-check\/merge-gate\.mjs [^#\n]*)/gm)) commands.push(["tools/ont-check/README.md", m[1]]);
  assert.ok(commands.filter(([, c]) => /records-only/.test(c)).length >= 3, JSON.stringify(commands));
  for (const [file, text] of commands) {
    const cmd = text
      .split(" | ")[0]
      .replace(/\[(--base [^\]]+)\]/g, "$1")
      .replace(/\[--config [^\]]+\]/g, "")
      .replace(/<[^>]+>|\bSHA\b/g, head)
      .trim();
    const argv = cmd.split(/\s+/);
    if (argv[0] !== "node") argv.unshift("node");
    argv[1] = argv[1].replace(/^(?:tools\/ont-check\/)?merge-gate\.mjs$/, "tools/ont-check/merge-gate.mjs");
    const r = spawnSync(argv[0], argv.slice(1), { cwd: TOP, encoding: "utf8", env: GIT_ENV });
    assert.equal(r.status, 0, `${file}: ${text}\n${r.stdout}`);
    assert.doesNotMatch(r.stdout, /ERROR/, `${file}: ${text}`);
  }
  const workflows = [...readme.matchAll(/`(\.github\/workflows\/[^`]+)`/g)].map((m) => m[1]);
  assert.ok(workflows.length >= 2);
  for (const w of workflows) assert.ok(existsSync(join(TOP, w)), w);
});
