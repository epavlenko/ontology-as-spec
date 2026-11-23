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
import { parseTaskRecords, readTaskInputs, sha256 } from "../tasks.mjs";

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
  writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "p", private: true, type: "module", scripts: { check: "node check.mjs", guard: "true" } }));
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
  return parseTaskRecords(dir, { latinOnly: true, before: new Set() });
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
  assert.equal(r.malformed.length, 6);
});

test("[check.owner-approval.english] where records are English only from a start, an approval added after it that quotes the owner in Cyrillic is refused and its transliteration is read", () => {
  const approval = (source) => ["Record: approval", "Task: t", `Statement-hash: ${A}`, "By: owner", `Source: ${source}`, "Time: 2026-11-21T13:52:40Z", ""].join("\n");
  const r = records({ "a.md": approval('the owner\'s answer to question 1, "Да"'), "b.md": approval('the owner\'s answer to question 1, "Da" ("yes", transliterated from Russian)') });
  assert.deepEqual(r.malformed, ["a.md: line 5: the letter Д is not English text"]);
  assert.deepEqual(r.approvals.map((a) => a.file), ["b.md"]);
  // The repository's own records hold to it.
  assert.deepEqual(parseTaskRecords(join(TOP, "reviews/tasks"), { latinOnly: true, before: new Set() }).malformed, []);
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
  // After a narrow round that follows a confirmed condition (rule.fixes-held-by-tests, D-163): the narrow
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

test("[check.owner-approval.english-after-start] where records are English only, a task record of an earlier kind is held to it only when added after taskRecords.latinAfter", () => {
  const repo = temp("latin-after-");
  const g = (...a) => {
    const r = spawnSync("git", ["-C", repo, ...a], { encoding: "utf8", env: GIT_ENV });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  const approval = (source) => ["Record: approval", "Task: t", `Statement-hash: ${A}`, "By: owner", `Source: ${source}`, "Time: 2026-11-21T13:52:40Z", ""].join("\n");
  g("init", "-q", "-b", "main");
  mkdirSync(join(repo, "reviews/rounds"), { recursive: true });
  mkdirSync(join(repo, "reviews/tasks"), { recursive: true });
  writeFileSync(join(repo, "reviews/rounds/.keep"), "");
  writeFileSync(join(repo, "reviews/tasks/20261121T135240Z-t-approval.md"), approval('the owner\'s answer to question 1, "Да"'));
  g("add", "-A");
  g("commit", "-q", "-m", "an old record");
  const start = g("rev-parse", "HEAD");
  writeFileSync(join(repo, "reviews/tasks/20261123T100000Z-t-approval.md"), approval('the owner\'s answer to question 2, "Да"'));
  const config = (extra) => {
    writeFileSync(join(repo, "ont.config.json"), JSON.stringify({ classes: { ent: "Entity" }, ontology: "ontology.md", reviewRounds: { dir: "reviews/rounds" }, taskRecords: { dir: "reviews/tasks", ...extra }, records: { latinOnly: true } }));
    return readTaskInputs(loadConfig(join(repo, "ont.config.json")));
  };
  const held = config({ latinAfter: start });
  assert.deepEqual(held.records.approvals.map((a) => a.file), ["20261121T135240Z-t-approval.md"]);
  assert.deepEqual(held.records.malformed, ["20261123T100000Z-t-approval.md: line 5: the letter Д is not English text"]);
  const none = config({});
  assert.deepEqual(none.records.approvals.map((a) => a.file), ["20261121T135240Z-t-approval.md", "20261123T100000Z-t-approval.md"]);
  assert.deepEqual(none.records.malformed, []);
  writeFileSync(join(repo, "reviews/tasks/20261123T110000Z-t-gate-change.md"), CHANGE({ commit: C40, paths: ["package.json"], item: "пункт 2" }));
  assert.match(config({}).records.malformed.join("\n"), /20261123T110000Z-t-gate-change\.md: line 4: the letter п is not English text/);
  const missing = config({ latinAfter: "0".repeat(40) });
  assert.match(missing.records.malformed.join("\n"), /the commit 0{40} that taskRecords\.latinAfter names is not a commit of this clone/);
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

test("[check.merge-gate.switch-on-steps] the rules for agents and the lifecycle give the steps that switch the gate on, in their order", () => {
  const rule = read("AGENTS.md").match(/^- \*\*Switch the gate on\.\*\*.*$/m)?.[0];
  assert.ok(rule, "the rule is in AGENTS.md");
  inOrder(rule, ["records alone", "`ont-check` and `ont-gate-guard`", "GitHub Actions app", "read back the ruleset and the Actions policy with `gh api`", "activate the rule", "merge-gate.mjs ruleset | gh api", "refused by `ont-check`", "refused by `ont-gate-guard`", "refused for being behind", "GitHub's answer", "read the settings back", "no bypass", "`gate-proof`", "close the probes' pull requests", "delete their branches", "merge of the next task's pull request"]);
  assert.match(rule, /rule\.gate-switched-on/);
  const page = read("docs/lifecycle.md");
  const section = page.slice(page.indexOf("### Switching the gate on"), page.indexOf("### Proving the gate"));
  assert.ok(section.length > 30, "the section is in the lifecycle");
  inOrder(section, ["records alone", "`ont-check` and `ont-gate-guard`", "GitHub Actions app", "Reads back the ruleset and the Actions policy with `gh api`", "Activates the rule", "merge-gate.mjs ruleset | gh api", "refused by `ont-check`", "refused by `ont-gate-guard`", "refused for being behind", "GitHub's answer", "Reads the settings back", "no bypass", "gate proof", "Closes the probes' pull requests", "deletes their branches", "merge of the pull request of the next task"]);
});

test("[check.merge-gate.commands-run] the commands of merge-gate.mjs the rules, the lifecycle and the README give are read by the tool, and the workflows the README names exist", () => {
  const head = spawnSync("git", ["-C", TOP, "rev-parse", "HEAD"], { encoding: "utf8", env: GIT_ENV }).stdout.trim();
  const readme = read("tools/ont-check/README.md");
  const commands = [];
  for (const file of ["AGENTS.md", "docs/lifecycle.md"]) for (const m of read(file).matchAll(/`([^`]*merge-gate\.mjs (?:guard|records-only|ruleset)[^`]*)`/g)) commands.push([file, m[1]]);
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
