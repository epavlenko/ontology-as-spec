// Records of the process written by the tool (D-167 to D-171): the seal and its start by the base of a
// pull request, records never edited, the writers of rounds, of fixes, of the owner's approval and answer
// to a gate, of the gate records and of a run outside a review, and spend from the session logs. Each
// attack of item 7 of the statement of task enforcement-tool-records is a test here, and so is the usual
// path, every record written by the tool passing the guard and the full check.
// ont: ent.process-record, field.process-record.seal, inv.record-sealed, inv.records-immutable, rule.records-by-tool, action.brief-round, action.record-round, derived.log-spend
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../lib.mjs";
import { guard, localRecordNotes } from "../merge-gate.mjs";
import { nextRound, parseRounds, stepPayoff } from "../review-rounds.mjs";
import { sealState, sealed } from "../seal.mjs";
import { logSpend, overspendOf, roundSpend, snapshotSpend } from "../spend.mjs";
import { applyFixes, approvedHash, goalLineOf, readStatement, readTaskInputs, sha256, snapshotOverspendProblems, spendOf, taskNext, taskState, versionInForce, versionLimits } from "../tasks.mjs";

const TOP = fileURLToPath(new URL("../../../", import.meta.url));
const TOOLS = join(TOP, "tools/ont-check");
const ROOT_CFG = JSON.parse(readFileSync(join(TOP, "ont.config.json"), "utf8"));
const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.org", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.org" };
for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "NODE_TEST_CONTEXT", "ONT_CLAUDE_LOGS", "ONT_CODEX_LOGS", "ONT_EXECUTOR_SESSIONS", "ONT_GOAL_STATEMENT", "ONT_REGISTRY_CMD", "ONT_GH_CMD"]) delete GIT_ENV[k];
const temps = [];
after(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })));
const temp = (name = "ont-records-") => {
  const d = mkdtempSync(join(tmpdir(), name));
  temps.push(d);
  return d;
};
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const T0 = Date.parse("2026-11-01T10:00:00Z");
const at = (minutes) => iso(T0 + minutes * 60000);

// A project: the templates with a copy of the tool, the directories of records and the keys of this task,
// in a repository with one commit on main.
function project({ fromLogs = true, seals = false, goals = { g: ["t", "u"] } } = {}) {
  const dir = temp("ont-project-");
  cpSync(join(TOP, "templates"), dir, { recursive: true });
  cpSync(TOOLS, join(dir, "tools/ont-check"), { recursive: true, filter: (src) => !src.includes(join("tools", "ont-check", "test")) });
  const cfg = JSON.parse(readFileSync(join(dir, "ont.config.json"), "utf8"));
  Object.assign(cfg, {
    reviewRounds: { dir: "reviews/rounds" },
    taskRecords: { dir: "reviews/tasks" },
    verdicts: { dir: "reviews/runs" },
    records: { latinOnly: true, ...(seals ? { sealsFrom: true } : {}) },
    mergeGate: { paths: ROOT_CFG.mergeGate.paths, codes: { t: ["SEAL_MISSING", "SEAL_WRONG", "RECORD_CHANGED", "RECORD_REMOVED"], other: ["GATE_PATH_UNAPPROVED"] }, rules: ".github/merge-gate.json" },
    spend: { fromLogs },
    goals,
    statements: { todoHeadings: ["What to do"] },
  });
  const put = (p, text) => {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), text);
  };
  put("ont.config.json", JSON.stringify(cfg, null, 2));
  put(".github/merge-gate.json", readFileSync(join(TOP, ".github/merge-gate.json"), "utf8"));
  for (const d of ["reviews/rounds", "reviews/tasks", "reviews/runs"]) put(`${d}/.keep`, "");
  const git = (...a) => {
    const r = spawnSync("git", ["-C", dir, ...a], { encoding: "utf8", env: GIT_ENV });
    assert.equal(r.status, 0, `git ${a.join(" ")}: ${r.stderr}`);
    return r.stdout.trim();
  };
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-q", "-m", "main");
  const commit = (msg = "step") => (git("add", "-A"), git("commit", "-q", "--allow-empty", "-m", msg), git("rev-parse", "HEAD"));
  const tool = (script, args, env = {}, cwd = dir) => {
    const r = spawnSync(process.execPath, [join(cwd, "tools/ont-check", script), ...args, "--config", join(cwd, "ont.config.json")], { cwd, encoding: "utf8", env: { ...GIT_ENV, ...env } });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const config = () => loadConfig(join(dir, "ont.config.json"));
  return { dir, put, git, commit, tool, config };
}

// A statement outside the repository: three items, one command of done, its budget and, optionally, a goal.
function statement({ goal = null, budget = [1000, 1000], extra = "" } = {}) {
  const f = join(temp("ont-statement-"), "statement.md");
  writeFileSync(f, `# A statement\n\n## What to do\n\n1. one\n2. two\n3. three\n\n${extra}Done-when: true\n${goal ? `Goal: ${goal}\n` : ""}Budget-new-input: ${budget[0]}\nBudget-output: ${budget[1]}\nBudget-reserve: 1.5\n`);
  return { file: f, hash: sha256(readFileSync(f)) };
}
// A clean round of the review of a statement, written as records were before the writers.
const cleanStatementRound = (task, hash, time, number = 1) => ["Task: " + task, "Step: statement-review", `Number: ${number}`, `Time: ${time}`, "By: a model (a provider)", `Statement-hash: ${hash}`, ""].join("\n");

// Session logs: Claude, one file a session; Codex, one rollout a session.
function logs() {
  const d = temp("ont-logs-");
  const claude = join(d, "claude");
  const codex = join(d, "codex");
  mkdirSync(claude, { recursive: true });
  mkdirSync(codex, { recursive: true });
  const claudeSession = (id, entries) =>
    writeFileSync(
      join(claude, `${id}.jsonl`),
      entries
        .map((e) =>
          e.user
            ? JSON.stringify({ type: "user", sessionId: id, timestamp: e.time, message: { role: "user", content: e.user } })
            : JSON.stringify({ type: "assistant", sessionId: id, timestamp: e.time, message: { id: e.msg, role: "assistant", usage: { input_tokens: e.new, cache_creation_input_tokens: e.created ?? 0, cache_read_input_tokens: e.cached ?? 0, output_tokens: e.out } } }),
        )
        .join("\n") + "\n",
    );
  const codexSession = (id, entries) =>
    writeFileSync(
      join(codex, `rollout-${id}.jsonl`),
      [
        JSON.stringify({ timestamp: entries[0]?.time ?? at(0), type: "session_meta", payload: { id } }),
        JSON.stringify({ timestamp: entries[0]?.time ?? at(0), type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "# AGENTS.md instructions for the project\n\nnot the first message" }] } }),
        ...entries.map((e) =>
          e.user
            ? JSON.stringify({ timestamp: e.time, type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: e.user }] } })
            : JSON.stringify({ timestamp: e.time, type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { input_tokens: e.input, cached_input_tokens: e.cached, output_tokens: e.out } } } }),
        ),
      ].join("\n") + "\n",
    );
  const env = (extra = {}) => ({ ONT_CLAUDE_LOGS: claude, ONT_CODEX_LOGS: codex, ONT_EXECUTOR_SESSIONS: "exec-1", ...extra });
  return { claude, codex, claudeSession, codexSession, env };
}

// The records and functions of a project, as the tool reads them.
const inputsOf = (p) => readTaskInputs(p.config());
// The limits of the version in force, as every reader asks them (D-174), and the task's line Goal:, which
// gives the goal (D-179).
const spendIn = (p, task, st, env) => {
  const cfg = p.config();
  const inputs = inputsOf(p);
  const statement = st ? readStatement(st.file) : null;
  const version = versionInForce({ rounds: inputs.rounds, approvals: inputs.records.approvals, task, statement });
  const l = versionLimits({ task, version, statement, done: inputs.records.done, approvals: inputs.records.approvals, snapshots: inputs.records.snapshots, defaults: cfg.budget });
  return logSpend({ cfg, task, goalLine: goalLineOf({ task, statement, version, done: inputs.records.done, snapshots: inputs.records.snapshots }), rounds: inputs.rounds, limits: { newInput: l.newInput, output: l.output, reserve: l.reserve, hash: l.version }, approvedOf: (t) => approvedHash(inputs.rounds, t, null, inputs.records.approvals), readStatementFile: readStatement, env });
};

// A brief and the reviewer's reply to it: the brief's lines word for word, then the reply's own.
const briefLines = (out) => out.split("\n").filter((l) => /^(Task|Step|Narrow|Number|Statement-hash|Goal|Budget-new-input|Budget-output|Budget-reserve|Commits|Done|Cause|Brief-time): /.test(l)).join("\n");
const writeReply = (lines, rest) => {
  const f = join(temp("ont-reply-"), "reply.md");
  writeFileSync(f, `${lines}\n${rest}\n`);
  return f;
};
const writeFile = (text) => {
  const f = join(temp("ont-file-"), "file.txt");
  writeFileSync(f, text);
  return f;
};

// ── The seal ──────────────────────────────────────────────────────────────────────────────────────

test("[check.process-record.seal-computed] a sealed record is valid; an edit, a seal not first and a format the tool does not know are wrong", () => {
  const body = "Task: t\nStep: statement-review\nNumber: 1\nTime: 2026-11-01T10:00:00Z\n";
  const s = sealed(body);
  assert.match(s, /^Seal: v1 [0-9a-f]{64}\n/);
  assert.equal(sealState(s).state, "valid");
  assert.equal(sealState(body).state, "missing");
  const edited = sealState(s.replace("Number: 1", "Number: 2"));
  assert.equal(edited.state, "wrong");
  assert.match(edited.why, /not the hash of its text/);
  assert.equal(sealState(`${body}${s.split("\n")[0]}\n`).state, "wrong");
  assert.match(sealState(s.replace("Seal: v1", "Seal: v9")).why, /format v9/);
  // The seal is of the format, not of the tool: the same body gives the same seal.
  assert.equal(sealed(body), s);
});

// A repository whose main may bring the key of seals by a merge, and pull requests from it, for the guard.
function gateRepo() {
  const p = project({ fromLogs: false });
  const pr = (from, steps) => {
    const name = `pr${Math.random().toString(36).slice(2, 8)}`;
    p.git("checkout", "-q", "-b", name, from);
    const commits = [];
    for (const s of steps) {
      s(p);
      commits.push(p.commit());
    }
    p.git("checkout", "-q", "main");
    return { base: from, head: commits.at(-1), commits };
  };
  // The task's branch brings the key and a round recorded by hand on it, then merges into main.
  const bringKey = (roundTime) => {
    p.git("checkout", "-q", "-b", "task", "main");
    const c = JSON.parse(readFileSync(join(p.dir, "ont.config.json"), "utf8"));
    c.records.sealsFrom = true;
    p.put("ont.config.json", JSON.stringify(c, null, 2));
    p.put("reviews/rounds/20261101T100000Z-t-statement-1.md", cleanStatementRound("t", sha256("a"), roundTime));
    p.commit("the key");
    p.git("checkout", "-q", "main");
    p.git("merge", "-q", "--no-ff", "-m", "merge the task", "task");
    return p.git("rev-parse", "HEAD");
  };
  return { ...p, pr, bringKey };
}
const handRound = (time, number = 2) => (p) => p.put(`reviews/rounds/${time.replace(/[-:]/g, "")}-t-statement-${number}.md`, cleanStatementRound("t", sha256("b"), time, number));
const later = () => iso(Date.now() + 120000);

test("[check.process-record.seals-start-by-base] a base without the key needs no seal; a base whose merge brought it needs one after that merge, and a round of the branch before it carries over", () => {
  const r = gateRepo();
  const without = r.pr(r.git("rev-parse", "main"), [handRound(later())]);
  assert.deepEqual(guard({ cfg: r.config(), base: without.base, head: without.head }).records, []);
  // The round recorded on the task's branch before the merge is in the base and passed its own pull request.
  const base = r.bringKey(at(0));
  const sealedNeeded = r.pr(base, [handRound(later(), 3)]);
  const g = guard({ cfg: r.config(), base: sealedNeeded.base, head: sealedNeeded.head });
  assert.deepEqual(g.records.map((x) => x.code), ["SEAL_MISSING"]);
  // A round written before the start of seals, carried by a later pull request, reads as before.
  const before = r.pr(base, [handRound(at(5), 4)]);
  assert.deepEqual(guard({ cfg: r.config(), base: before.base, head: before.head }).records, []);
  // A sealed round passes.
  const ok = r.pr(base, [(p) => p.put("reviews/rounds/x-t-statement-5.md", sealed(cleanStatementRound("t", sha256("c"), later(), 5)))]);
  assert.deepEqual(guard({ cfg: r.config(), base: ok.base, head: ok.head }).records, []);
});

test("[check.process-record.hand-record-refused] with the key in the base, a round written by hand and a sealed round edited after are refused with their codes", () => {
  const r = gateRepo();
  const base = r.bringKey(at(0));
  const hand = r.pr(base, [handRound(later())]);
  const out = spawnSync(process.execPath, [join(r.dir, "tools/ont-check/merge-gate.mjs"), "guard", "--base", hand.base, "--head", hand.head, "--config", join(r.dir, "ont.config.json")], { encoding: "utf8", env: GIT_ENV });
  assert.equal(out.status, 1, out.stdout);
  assert.match(out.stdout, /^CODE SEAL_MISSING$/m);
  assert.match(out.stdout, /^GATE_REFUSED$/m);
  assert.match(out.stdout, /reviews\/rounds\/\d{8}T\d{6}Z-t-statement-2\.md: written after seals start/);
  const edited = r.pr(base, [(p) => p.put("reviews/rounds/x-t-statement-6.md", sealed(cleanStatementRound("t", sha256("c"), later(), 6)).replace("Number: 6", "Number: 7"))]);
  const g = guard({ cfg: r.config(), base: edited.base, head: edited.head });
  assert.deepEqual(g.records.map((x) => x.code), ["SEAL_WRONG"]);
});

test("[check.process-record.records-immutable] a record of the base edited or removed, and one added earlier in the pull request edited or removed, are refused", () => {
  const r = gateRepo();
  r.put("reviews/tasks/20261101T100000Z-t-approval.md", "Record: approval\nTask: t\n");
  const base = r.commit("a record on main");
  const codes = (steps) => {
    const x = r.pr(base, steps);
    return guard({ cfg: r.config(), base: x.base, head: x.head }).records.map((y) => `${y.code} ${y.path}`);
  };
  assert.deepEqual(codes([(p) => p.put("reviews/tasks/20261101T100000Z-t-approval.md", "Record: approval\nTask: t\nBy: owner\n")]), ["RECORD_CHANGED reviews/tasks/20261101T100000Z-t-approval.md"]);
  assert.deepEqual(codes([(p) => p.git("rm", "-q", "reviews/tasks/20261101T100000Z-t-approval.md")]), ["RECORD_REMOVED reviews/tasks/20261101T100000Z-t-approval.md"]);
  const f = "reviews/rounds/20261101T110000Z-t-statement-2.md";
  assert.deepEqual(codes([(p) => p.put(f, cleanStatementRound("t", sha256("b"), at(60), 2)), (p) => p.put(f, cleanStatementRound("t", sha256("b"), at(60), 3))]), [`RECORD_CHANGED ${f}`]);
  assert.deepEqual(codes([(p) => p.put(f, cleanStatementRound("t", sha256("b"), at(60), 2)), (p) => p.git("rm", "-q", f)]), [`RECORD_REMOVED ${f}`]);
  // A new record is no change of a record.
  assert.deepEqual(codes([(p) => p.put(f, cleanStatementRound("t", sha256("b"), at(60), 2))]), []);
});

test("[check.process-record.check-informs] the full check names a record edited in the working tree and a record without a seal after the start as information, and passes", () => {
  const p = project({ fromLogs: false, seals: true });
  p.put("reviews/tasks/20261101T100000Z-t-approval.md", "Record: approval\nTask: t\nStatement-hash: " + sha256("a") + "\nBy: owner\nSource: words\nTime: 2026-11-01T10:00:00Z\n");
  p.commit("a record");
  p.put("reviews/tasks/20261101T100000Z-t-approval.md", "Record: approval\nTask: t\nStatement-hash: " + sha256("a") + "\nBy: owner\nSource: other words\nTime: 2026-11-01T10:00:00Z\n");
  p.put("reviews/rounds/x-t-statement-1.md", cleanStatementRound("t", sha256("a"), later()));
  const notes = localRecordNotes(p.config());
  assert.ok(notes.some((n) => /20261101T100000Z-t-approval\.md: a record of HEAD is changed/.test(n)), notes.join("\n"));
  assert.ok(notes.some((n) => /x-t-statement-1\.md: it has no line Seal:/.test(n)), notes.join("\n"));
  const r = p.tool("ont-check.mjs", []);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /info · records of the process with no valid seal after seals start, or changed in the working tree/);
});

test("[check.process-record.check-predicts-guard] a branch that brings the key while its base has none is told of no refusal; after its merge, a later record without a seal is named as refused", () => {
  const p = project({ fromLogs: false });
  p.git("checkout", "-q", "-b", "task");
  const c = JSON.parse(readFileSync(join(p.dir, "ont.config.json"), "utf8"));
  c.records.sealsFrom = true;
  p.put("ont.config.json", JSON.stringify(c, null, 2));
  p.commit("the key");
  p.put("reviews/rounds/x-t-statement-1.md", cleanStatementRound("t", sha256("a"), later()));
  p.commit("a round by hand");
  // The guard of main reads the start at the base, which has no key: it refuses nothing, and neither is said.
  const onTask = localRecordNotes(p.config());
  assert.deepEqual(onTask.filter((n) => /the guard refuses/.test(n)), [], onTask.join("\n"));
  assert.equal(guard({ cfg: p.config(), base: p.git("rev-parse", "main"), head: p.git("rev-parse", "HEAD") }).records.length, 0);
  p.git("checkout", "-q", "main");
  p.git("merge", "-q", "--no-ff", "-m", "merge the task", "task");
  p.git("checkout", "-q", "-b", "next");
  p.put("reviews/rounds/y-t-statement-2.md", cleanStatementRound("t", sha256("b"), later(), 2));
  p.commit("a later round by hand");
  const onNext = localRecordNotes(p.config());
  assert.ok(onNext.some((n) => /y-t-statement-2\.md: .*the guard refuses it \(SEAL_MISSING\)/.test(n)), onNext.join("\n"));
  assert.ok(!onNext.some((n) => /x-t-statement-1\.md/.test(n)), onNext.join("\n"));
  assert.deepEqual(guard({ cfg: p.config(), base: p.git("rev-parse", "main"), head: p.git("rev-parse", "HEAD") }).records.map((x) => `${x.code} ${x.path}`), ["SEAL_MISSING reviews/rounds/y-t-statement-2.md"]);
});

// ── Rounds: the brief and the record ──────────────────────────────────────────────────────────────

// A project with task t approved by a clean round of its statement, as before the writers.
function approved({ fromLogs = false, goal = null, budget, goals } = {}) {
  const p = project({ fromLogs, ...(goals ? { goals } : {}) });
  const st = statement({ goal, budget });
  p.put("reviews/rounds/20261101T100000Z-t-statement-1.md", cleanStatementRound("t", st.hash, at(0)));
  p.commit("approved");
  return { p, st };
}
const doneRecord = (p, commit, st, time, name = `${time.replace(/[-:]/g, "")}-t-done.md`) =>
  p.put(`reviews/tasks/${name}`, ["Record: done", "Task: t", `Commit: ${commit}`, `Statement-hash: ${st.hash}`, `Budget-new-input: ${readStatement(st.file).budget.newInput}`, `Budget-output: ${readStatement(st.file).budget.output}`, "Budget-reserve: 1.5", `Time: ${time}`, "Checks:", "- true · pass", ""].join("\n"));
const resultRound = ({ st, commit, time, number = 1, narrow = false, findings = [], acceptance = "clean" }) =>
  [
    "Task: t",
    "Step: result-review",
    `Narrow: ${narrow}`,
    `Number: ${number}`,
    `Time: ${time}`,
    `Commits: ${commit}`,
    "By: a model (a provider)",
    `Statement-hash: ${st.hash}`,
    ...(findings.length ? ["Findings:", ...findings] : []),
    ...(acceptance === "clean" ? ["Acceptance: clean"] : acceptance ? ["Acceptance:", ...acceptance] : []),
    "",
  ].join("\n");

test("[check.round-brief.refused-off-round] a brief is refused when the next action is work, the statement is not corrected, or no newer record of done is on a new tree", () => {
  const { p, st } = approved();
  const brief = (step, file = st.file) => p.tool("round.mjs", ["brief", "t", "--step", step, "--statement", file]);
  // The next action is work on the result: no round of either step.
  const work = brief("result");
  assert.equal(work.code, 1, work.out);
  assert.match(work.out, /no brief written: .*the executor works under version/);
  assert.match(brief("statement").out, /not a round of the review of its statement/);
  // A round of the statement with findings, the file not corrected since.
  const q = project({ fromLogs: false });
  const s2 = statement();
  q.put("reviews/rounds/20261101T100000Z-t-statement-1.md", ["Task: t", "Step: statement-review", "Number: 1", `Time: ${at(0)}`, "By: m (p)", `Statement-hash: ${s2.hash}`, "Findings:", "- a gap · important · change · fixable", ""].join("\n"));
  q.commit();
  assert.match(q.tool("round.mjs", ["brief", "t", "--step", "statement", "--statement", s2.file]).out, /no brief written: the statement is version [0-9a-f]{12}, the version 20261101T100000Z-t-statement-1\.md found findings in: correct it first/);
  // A round of the result with findings, then: no newer done; a newer done on the same commit; one on the
  // commit that holds only the record of the round and of done.
  const c1 = p.git("rev-parse", "HEAD");
  doneRecord(p, c1, st, at(10));
  p.put("reviews/rounds/20261101T103000Z-t-result-1.md", resultRound({ st, commit: c1, time: at(30), findings: ["- a bug · important · change · fixable"], acceptance: ["- an item not met · important · change · fixable"] }));
  p.commit("round 1");
  assert.match(brief("result").out, /no record of done newer than the last round/);
  doneRecord(p, c1, st, at(40));
  p.commit();
  assert.match(brief("result").out, /no record of done newer than the last round/);
  p.put("app.mjs", "// a fix\n");
  const c2 = p.commit("a fix");
  doneRecord(p, c2, st, at(45));
  p.put("reviews/rounds/20261101T105500Z-t-result-2.md", resultRound({ st, commit: c2, time: iso(T0 + 55 * 60000), number: 2, findings: ["- a bug · important · change · fixable"], acceptance: ["- an item not met · important · change · fixable"] }));
  const roundOnly = p.commit("the records of a round alone");
  doneRecord(p, roundOnly, st, at(60));
  p.commit();
  assert.match(brief("result").out, /no record of done newer than the last round 20261101T105500Z-t-result-2\.md/);
  assert.equal(readdirSync(join(p.dir, ".git")).includes("ont-briefs") ? readdirSync(join(p.dir, ".git/ont-briefs")).length : 0, 0);
});

test("[check.round-brief.allowed] the first round after done is briefed from a linked worktree, a round of acceptance alone on the same result, and a round after the analysis of the cause with a new record of done", () => {
  const { p, st } = approved();
  const c1 = p.git("rev-parse", "HEAD");
  doneRecord(p, c1, st, at(10));
  p.commit("done");
  const wt = join(temp("ont-wt-"), "wt");
  p.git("worktree", "add", "-q", "--detach", wt, "HEAD");
  const first = p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", st.file], {}, wt);
  assert.equal(first.code, 0, first.out);
  assert.match(first.out, /^Number: 1$/m);
  assert.match(first.out, new RegExp(`^Commits: ${c1}$`, "m"));
  const gitDir = spawnSync("git", ["-C", wt, "rev-parse", "--git-dir"], { encoding: "utf8", env: GIT_ENV }).stdout.trim();
  assert.ok(existsSync(join(gitDir, "ont-briefs", "t-result-review.brief")), "the brief is kept in the worktree's own Git directory");
  assert.ok(!existsSync(join(wt, "ont-briefs")));
  // A clean round with no verdict of acceptance: a round for it alone, on the same result.
  p.put("reviews/rounds/20261101T103000Z-t-result-1.md", resultRound({ st, commit: c1, time: at(30), acceptance: null }));
  p.commit("round 1");
  const acc = p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", st.file]);
  assert.equal(acc.code, 0, acc.out);
  assert.match(acc.out, /for the verdict of acceptance alone on the same result/);
  assert.match(acc.out, new RegExp(`^Commits: ${c1}$`, "m"));
  // Stagnation: the same important class twice; the analysis of the cause, a new done on a new tree, a round.
  const q = approved();
  const d1 = q.p.git("rev-parse", "HEAD");
  doneRecord(q.p, d1, q.st, at(10));
  q.p.put("reviews/rounds/20261101T103000Z-t-result-1.md", resultRound({ st: q.st, commit: d1, time: at(30), findings: ["- a design flaw · important · change · fixable"], acceptance: null }));
  q.p.put("app.mjs", "// the first fix\n");
  const d2 = q.p.commit("fix");
  doneRecord(q.p, d2, q.st, at(40));
  q.p.put("reviews/rounds/20261101T105000Z-t-result-2.md", resultRound({ st: q.st, commit: d2, time: at(50), number: 2, findings: ["- a design flaw · important · change · fixable"], acceptance: null }));
  q.p.commit();
  assert.match(q.p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", q.st.file]).out, /no record of done newer/);
  q.p.put("app.mjs", "// the fix the analysis of the cause chose\n");
  const d3 = q.p.commit("the fix of the cause");
  doneRecord(q.p, d3, q.st, at(70));
  q.p.commit();
  const afterCause = q.p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", q.st.file, "--cause", writeFile("The earlier fix patched one caller; the cause is the shared reader.\n")]);
  assert.equal(afterCause.code, 0, afterCause.out);
  assert.match(afterCause.out, /^Number: 3$/m);
  assert.match(afterCause.out, new RegExp(`^Commits: ${d3}$`, "m"));
});

// A task whose rounds of the result stagnate: round 1 and round 2 find the same important class, on two
// results; with condition, round 2 is C, the reviewer having confirmed the goal's condition. The next action
// is the analysis of the cause (D-182), and a new record of done on a new tree follows it.
function stagnating({ condition = false } = {}) {
  const q = approved();
  const d1 = q.p.git("rev-parse", "HEAD");
  doneRecord(q.p, d1, q.st, at(10));
  q.p.put("reviews/rounds/20261101T103000Z-t-result-1.md", resultRound({ st: q.st, commit: d1, time: at(30), findings: ["- a reader drops records · important · change · fixable"], acceptance: null }));
  q.p.put("app.mjs", "// the first fix\n");
  const d2 = q.p.commit("fix");
  doneRecord(q.p, d2, q.st, at(40));
  const r2 = resultRound({ st: q.st, commit: d2, time: at(50), number: 2, findings: ["- a reader drops records · important · change · fixable"], acceptance: null });
  q.p.put("reviews/rounds/20261101T105000Z-t-result-2.md", condition ? r2.replace("Statement-hash:", "Condition: holds\nStatement-hash:") : r2);
  q.p.commit("round 2");
  const next = q.p.tool("ont-check.mjs", ["--task", "t", "--statement", q.st.file]);
  q.p.put("app.mjs", "// the fix the analysis of the cause chose\n");
  const d3 = q.p.commit("the fix of the cause");
  doneRecord(q.p, d3, q.st, at(70));
  q.p.commit("done");
  return { ...q, d3, next };
}
const ANALYSIS = "The earlier fix patched one caller of the reader; the one cause is the reader itself, which drops a record it cannot parse. The cause lies in the design of the reader, so the reader changes.\n";

test("[check.round-brief.cause-required] on stagnation, by the branch stagnation and by a stagnating C, brief refuses without --cause or with an empty file and writes with it, full after the branch and narrow after C, the hash on Cause: and the analysis printed; --cause where no stagnation is named is refused", () => {
  for (const [condition, narrow, number] of [[false, "false", "3"], [true, "true", "1"]]) {
    const q = stagnating({ condition });
    const of = condition ? "a stagnating C" : "the branch stagnation";
    // NEXT names the analysis of the cause, never a change of design alone.
    assert.match(q.next.out, /^NEXT t: .*first a short analysis of the cause, why the earlier fix of a reader drops records did not hold and the one cause behind it; by it, change the design where the cause lies in it, otherwise fix the error/m, `${of}: ${q.next.out}`);
    assert.doesNotMatch(q.next.out, /do not patch it/);
    if (condition) assert.match(q.next.out, /^NEXT t: the reviewer confirmed the goal's condition in 20261101T105000Z-t-result-2\.md, and the rounds stagnate .*then narrow round 1, the one round after it$/m);
    else assert.match(q.next.out, /then full round 3$/m);
    const brief = (...extra) => q.p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", q.st.file, ...extra]);
    const kept = () => existsSync(join(q.p.dir, ".git/ont-briefs/t-result-review.brief"));
    const without = brief();
    assert.equal(without.code, 1, `${of}: ${without.out}`);
    assert.match(without.out, /no brief written: the next action is the analysis of the cause: .*give it with --cause FILE/);
    assert.ok(!kept(), `${of}: no brief kept without --cause`);
    const empty = brief("--cause", writeFile("  \n"));
    assert.equal(empty.code, 1, empty.out);
    assert.match(empty.out, /no brief written: --cause .* is empty/);
    assert.ok(!kept());
    const file = writeFile(ANALYSIS);
    const withCause = brief("--cause", file);
    assert.equal(withCause.code, 0, `${of}: ${withCause.out}`);
    assert.match(withCause.out, new RegExp(`^Narrow: ${narrow}$`, "m"));
    assert.match(withCause.out, new RegExp(`^Number: ${number}$`, "m"));
    assert.match(withCause.out, new RegExp(`^Commits: ${q.d3}$`, "m"));
    assert.match(withCause.out, new RegExp(`^Cause: ${sha256(readFileSync(file))}$`, "m"));
    assert.ok(withCause.out.includes(ANALYSIS.trim()), "the analysis is printed for the reviewer's brief");
    assert.ok(kept());
    assert.match(readFileSync(join(q.p.dir, ".git/ont-briefs/t-result-review.brief"), "utf8"), new RegExp(`^Cause: ${sha256(readFileSync(file))}$`, "m"));
  }
  // The first round of the result, with no stagnation: --cause is refused, and the brief is written without it.
  const { p, st } = approved();
  doneRecord(p, p.git("rev-parse", "HEAD"), st, at(10));
  p.commit("done");
  const refused = p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", st.file, "--cause", writeFile(ANALYSIS)]);
  assert.equal(refused.code, 1, refused.out);
  assert.match(refused.out, /no brief written: --cause is given, and the next action names no stagnation/);
  const plain = p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", st.file]);
  assert.equal(plain.code, 0, plain.out);
  assert.doesNotMatch(plain.out, /^Cause:/m);
});

test("[check.round-brief.record-refused] a reply that differs from the brief, no brief, a finding without triage, a finding of acceptance filed, and no session of the logs with the brief are refused", () => {
  const { p, st } = approved();
  const c1 = p.git("rev-parse", "HEAD");
  doneRecord(p, c1, st, at(10));
  p.commit("done");
  const record = (reply, triage) => p.tool("round.mjs", ["record", "t", "--from", reply, ...(triage ? ["--triage", triage] : [])]);
  const none = record(writeReply("Task: t", "By: m"));
  assert.match(none.out, /no brief of a round of t is kept/);
  const b = p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", st.file]);
  assert.equal(b.code, 0, b.out);
  const lines = briefLines(b.out);
  const differs = record(writeReply(lines.replace("Number: 1", "Number: 2"), "By: m\nCondition: not yet\nAcceptance: pass"));
  assert.match(differs.out, /does not begin with the brief's lines word for word/);
  const untriaged = record(writeReply(lines, "By: m\nCondition: not yet\nAcceptance: pass\n\n| a bug | nit | change |"));
  assert.match(untriaged.out, /give the executor's triage/);
  const triaged = record(writeReply(lines, "By: m\nCondition: not yet\nAcceptance: pass\n\n| a bug | nit | change |"), writeFile("other · not fixable\n"));
  assert.match(triaged.out, /the finding a bug has no triage/);
  p.put("docs/limitations.md", "an item not met\n");
  const filed = record(writeReply(lines, "By: m\nCondition: not yet\nAcceptance: fail\n- an item not met · important · change"), writeFile("an item not met · limitation\n"));
  assert.match(filed.out, /the finding of acceptance an item not met is filed as limitation/);
  assert.equal(readdirSync(join(p.dir, "reviews/rounds")).filter((f) => f.includes("result")).length, 0);
  // Where spend is counted from the logs, no session holding the brief refuses the record.
  const q = approved({ fromLogs: true, goals: {} });
  const d = q.p.git("rev-parse", "HEAD");
  doneRecord(q.p, d, q.st, at(10));
  q.p.commit("done");
  const L = logs();
  L.claudeSession("exec-1", [{ user: "work on t", time: at(1) }, { msg: "m1", time: at(2), new: 10, out: 5 }]);
  const qb = q.p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", q.st.file], L.env());
  assert.equal(qb.code, 0, qb.out);
  const lost = q.p.tool("round.mjs", ["record", "t", "--from", writeReply(briefLines(qb.out), "By: m\nCondition: not yet\nAcceptance: pass")], L.env());
  assert.match(lost.out, /no session of the logs holds the brief of the round/);
});

test("[check.round-brief.record-written] a reply that begins with the brief's lines is recorded with its seal, its triage, its brief time, its spend and the snapshot it names, and the brief is used once", () => {
  const q = approved({ fromLogs: true, goals: {} });
  const d = q.p.git("rev-parse", "HEAD");
  doneRecord(q.p, d, q.st, at(10));
  q.p.commit("done");
  const L = logs();
  L.claudeSession("exec-1", [{ user: "work on t", time: at(1) }, { msg: "m1", time: at(2), new: 10, out: 5 }]);
  const b = q.p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", q.st.file], L.env());
  const lines = briefLines(b.out);
  const soon = (s) => iso(Date.now() + s * 1000);
  L.codexSession("reviewer-1", [{ user: `${lines}\n\nReview the result.`, time: soon(1) }, { input: 1000, cached: 400, out: 50, time: soon(2) }, { input: 1500, cached: 600, out: 80, time: soon(3) }]);
  p_issue(q.p);
  const r = q.p.tool("round.mjs", ["record", "t", "--from", writeReply(lines, "By: gpt (OpenAI, Codex)\nCondition: not yet\nAcceptance: pass\n\n| a bug | important | change |\n| a rare case | nit | change |"), "--triage", writeFile("a bug · usual path: the executor records done\na rare case · later: issues/0001-rare.md\n")], L.env());
  assert.equal(r.code, 0, r.out);
  const file = readdirSync(join(q.p.dir, "reviews/rounds")).find((f) => f.includes("result-1"));
  const text = readFileSync(join(q.p.dir, "reviews/rounds", file), "utf8");
  assert.equal(sealState(text).state, "valid");
  assert.match(text, /^- a bug · important · change · fixable$/m);
  assert.match(text, /^- a rare case · nit · change · later · issues\/0001-rare\.md$/m);
  assert.match(text, /a bug: usual path, the step it breaks: the executor records done/);
  assert.match(text, /^Tokens-new: 900$/m);
  assert.match(text, /^Tokens-cached: 600$/m);
  assert.match(text, /^Tokens-out: 80$/m);
  const snap = text.match(/^Spend-record: (\S+)$/m)[1];
  assert.equal(sealState(readFileSync(join(q.p.dir, "reviews/tasks", snap), "utf8")).state, "valid");
  const inputs = inputsOf(q.p);
  assert.deepEqual(inputs.malformed, []);
  const round = inputs.rounds.find((x) => x.file === file);
  assert.equal(round.briefTime, lines.match(/^Brief-time: (\S+)$/m)[1]);
  assert.equal(round.doneFile, lines.match(/^Done: (\S+)$/m)[1]);
  assert.equal(round.spendRecord, snap);
  assert.ok(inputs.records.snapshots.some((s) => s.file === snap && s.round === file && s.sums.round.new === 900));
  assert.match(q.p.tool("round.mjs", ["record", "t", "--from", writeReply(lines, "By: m")], L.env()).out, /no brief of a round of t is kept/);
});
test("[check.round-brief.cause-recorded] a round briefed with the analysis of the cause is recorded with Cause:, read beside the rounds without it by the reader, --task and the full check; a Cause: that is not a SHA-256 cannot be read", () => {
  const q = stagnating();
  const file = writeFile(ANALYSIS);
  const b = q.p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", q.st.file, "--cause", file]);
  assert.equal(b.code, 0, b.out);
  const lines = briefLines(b.out);
  assert.match(lines, /^Cause: [0-9a-f]{64}$/m, "the reply repeats Cause: with the brief's other lines");
  const r = q.p.tool("round.mjs", ["record", "t", "--from", writeReply(lines, "By: gpt (OpenAI, Codex)\nCondition: not yet\nAcceptance: clean")]);
  assert.equal(r.code, 0, r.out);
  const name = readdirSync(join(q.p.dir, "reviews/rounds")).find((f) => f.includes("result-3"));
  const text = readFileSync(join(q.p.dir, "reviews/rounds", name), "utf8");
  assert.match(text, new RegExp(`^Cause: ${sha256(readFileSync(file))}$`, "m"));
  assert.equal(sealState(text).state, "valid");
  q.p.commit("round 3");
  const inputs = inputsOf(q.p);
  assert.deepEqual(inputs.malformed, []);
  const rounds = inputs.rounds.filter((x) => x.task === "t" && x.step === "result-review");
  assert.deepEqual(rounds.map((x) => [x.number, x.cause]), [[1, null], [2, null], [3, sha256(readFileSync(file))]]);
  // --task reads the new round beside the old ones: no record it cannot read, and the step ended clean.
  const task = q.p.tool("ont-check.mjs", ["--task", "t", "--statement", q.st.file]);
  assert.doesNotMatch(task.out, /cannot be read|correct the records/, task.out);
  assert.match(task.out, /^NEXT t: .*merge/m, task.out);
  const check = q.p.tool("ont-check.mjs", []);
  assert.match(check.out, /ONT_OK/, check.out);
  // A Cause: that is not a SHA-256 makes the record unreadable.
  const dir = temp("ont-cause-");
  writeFileSync(join(dir, "r.md"), ["Task: t", "Step: result-review", "Number: 1", `Time: ${at(5)}`, "By: m", "Cause: not-a-hash", ""].join("\n"));
  const { malformed } = parseRounds(dir);
  assert.equal(malformed.length, 1);
  assert.match(malformed[0], /cause not-a-hash is not a SHA-256/);
});
// The reply of round 1 of the review of the result of task enforcement-tool-records, reduced to its lines
// of verdicts, findings and acceptance, as its reviewer wrote them (D-172).
const ROUND1_VERDICTS = [
  "| Check | Verdict | Evidence or reason |",
  "| --- | --- | --- |",
  "| `check.concept.code-from-ontology` | fail | `ontology.md:472` defines goal-scoped spend. The documented recording call can save a task-only snapshot for a goal member at `tools/ont-check/round.mjs:259`. |",
];
const ROUND1_FINDINGS = [
  "| Class | Weight | Origin | Path | Fixability | Evidence |",
  "| --- | --- | --- | --- | --- | --- |",
  "| Goal budget scope lost when recording a round | important | change | usual path. After `NEXT` calls for a result round, brief it with the approved goal-member statement, then record the returned reply with the command in the agent rules. | fixable | `docs/parts/agent-rules.md:155` gives the call without `--statement`. `tools/ont-check/round.mjs:259` then passes `null` to spend calculation and `tools/ont-check/spend.mjs:201` treats the member as a standalone task. The snapshot can charge the shared executor session to the task and omit the goal reserve. `--rounds` loses the same scope at `tools/ont-check/ont-check.mjs:1559`. The brief and done paths do pass the statement. |",
  "| Goal acceptance disagrees with its own overspend snapshot | important | change | usual path. Record an already-briefed clean acceptance of the goal when the review takes it past reserve, then run the full check. | fixable | `tools/ont-check/spend.mjs:200` identifies the goal itself as a goal. The writer emits a task part and a goal part at `:297`. The snapshot reader drops the goal part when `Unit` equals `Task` at `:306`. A direct comparison produced different strings for the same snapshot, which the full check refuses at `tools/ont-check/tasks.mjs:75`. |",
  "| Run freshness checks only endpoint content | important | change | rare history. A file outside the record directories is committed after a run starts, then restored before recording or review. | fixable | `tools/ont-check/ont-check.mjs:1328` compares the start commit directly to the working tree. It misses intervening committed changes that cancel out. The same helper governs `--run-record`, current verdicts in the full check, and review carryover. |",
  "| Record history omits merge additions and file modes | important | change | rare history. A record is first introduced by merge resolution, or its file mode changes later in the PR while its blob stays the same. | fixable | `tools/ont-check/merge-gate.mjs:255` collects additions with a path-limited log that omits merge diffs by default. The first-add comparison at `:262` checks blob IDs alone. The base-record comparison at `:243` separately sees mode changes. |",
  "| Gate proof does not corroborate the merge refusal | important | change | rare history. The required check is red, but the saved GitHub response reports a different reason for refusing that merge attempt. | fixable | `tools/ont-check/gate-record.mjs:123` accepts any response with a message unless it says `merged: true`. The check log and other required check conclusions are verified separately at `:117` and `:121`. The response is never tied to the required check that the resulting proof credits. |",
  "| Usual-path test omits the gate-proof writer | important | change | usual path. Run the required `npm test` before recording done and rely on the usual-path test to prove the writers' records pass both checks. | fixable | The proof test at `tools/ont-check/test/tool-records.test.mjs:803` checks output and parsing in isolation. The usual-path test at `:868` takes a gate-change record through the guard and full check but never takes a writer-produced gate proof through them. Its fixture also leaves `goals` empty at `:820`, so it misses the scope loss in this repository's goal-member path. |",
  "| Rollout diagnostics predict the wrong guard result | nit | change | usual path. Run the full check on the transition PR after writing the seven gate-change records in the format that `main` still reads. | fixable | `tools/ont-check/merge-gate.mjs:295` derives the diagnostic cutoff from the branch's `HEAD` and `:309` says the guard refuses these records. The base has no seal key and its guard accepts all seven. The full check still passes. |",
  "| Audit dispositions are missing | nit | change | usual path. Hand off the enforcement goal after checking which task-two audit rows have evidence and which wait for a later gate. | fixable | `docs/limitations.md:81` gives the required budget-report delivery limitation, and `tools/ont-check/test/tool-records.test.mjs:612` distinguishes payoff by round identity. The audit allocation still shows the ten original gaps without an explicit disposition for rows waiting on later tasks. The reader deferral at `tools/ont-check/approve.mjs:14` also leaves the follow-up task unnamed. |",
  "| Catalogue uses invocation syntax for behavioral cases | nit | change | rare history. This affects catalogue review rather than execution of the approved workflow. | fixable | `checks.md:187`, `:266`, and `:332` use command names in the cases despite the check at `checks.md:153`. |",
  "| Agent rules exceed the one-screen check | nit | before | rare history. The check fails on prose length. The current workflow still has the commands it needs. | fixable | The Rules section starts at `AGENTS.md:21` and already exceeded one screen on `main`. |",
];
const ROUND1_ACCEPTANCE = "Acceptance: refused. The documented round-recording step can save incorrect goal-budget evidence, and the writer can produce a clean goal acceptance that the full check rejects against its own snapshot. The approved writer and test requirements also have the gaps listed above.";

test("[check.round-brief.skill-reply] the reply the change-review skill asks for, Acceptance: refused with its reason and the findings under it and the table of findings of six columns, is recorded, its classes as the triage spells them; refused with no finding under it is refused", () => {
  const { p, st } = approved();
  const c1 = p.git("rev-parse", "HEAD");
  doneRecord(p, c1, st, at(10));
  p.commit("done");
  const b = p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", st.file]);
  assert.equal(b.code, 0, b.out);
  const lines = briefLines(b.out);
  const accFindings = ["- round recording with the wrong goal-budget evidence · important · change", "- writer and test requirements of items 4 and 7 · important · change"];
  const reply = (acc) => writeReply(lines, ["By: gpt-6.2-sol (OpenAI, Codex)", "", ...ROUND1_VERDICTS, "", ...ROUND1_FINDINGS, "", ...acc, "Condition: not yet", "Verdict: fix first"].join("\n"));
  const classes = ROUND1_FINDINGS.slice(2).map((r) => r.split("|")[1].trim());
  assert.equal(classes.length, 10);
  const lower = (c) => c[0].toLowerCase() + c.slice(1);
  const triage = writeFile([...classes.map((c) => `${lower(c)} · usual path: the executor records the round`), "round recording with the wrong goal-budget evidence · usual path: the executor records the round", "writer and test requirements of items 4 and 7 · usual path: npm test before done", ""].join("\n"));
  // Refused with its reason alone: the writer asks for the findings under it, and writes nothing.
  const bare = p.tool("round.mjs", ["record", "t", "--from", reply([ROUND1_ACCEPTANCE]), "--triage", triage]);
  assert.equal(bare.code, 1, bare.out);
  assert.match(bare.out, /Acceptance: refused with no finding under it/);
  const r = p.tool("round.mjs", ["record", "t", "--from", reply([ROUND1_ACCEPTANCE, ...accFindings]), "--triage", triage]);
  assert.equal(r.code, 0, r.out);
  const file = readdirSync(join(p.dir, "reviews/rounds")).find((f) => f.includes("-t-result-1"));
  const text = readFileSync(join(p.dir, "reviews/rounds", file), "utf8");
  assert.match(text, /^- goal budget scope lost when recording a round · important · change · fixable$/m);
  assert.match(text, /^- agent rules exceed the one-screen check · nit · before · fixable$/m);
  assert.match(text, /^Acceptance:\n- round recording with the wrong goal-budget evidence · important · change · fixable\n- writer and test requirements of items 4 and 7 · important · change · fixable$/m);
  const inputs = inputsOf(p);
  assert.deepEqual(inputs.malformed, []);
  const round = inputs.rounds.find((x) => x.file === file);
  assert.equal(round.findings.length, 10);
  assert.deepEqual(round.acceptance.findings.map((f) => f.cls), ["round recording with the wrong goal-budget evidence", "writer and test requirements of items 4 and 7"]);
  // No row of the table of verdicts is read as a finding.
  assert.ok(round.findings.every((f) => !f.cls.startsWith("check.")));
  // A class given both in the table of findings and under the refusal: the notes give its step once.
  const q = approved();
  doneRecord(q.p, q.p.git("rev-parse", "HEAD"), q.st, at(10));
  q.p.commit("done");
  const qb = q.p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", q.st.file]);
  assert.equal(qb.code, 0, qb.out);
  const ql = briefLines(qb.out);
  const both = q.p.tool("round.mjs", ["record", "t", "--from", writeReply(ql, ["By: m (p)", "", ROUND1_FINDINGS[0], ROUND1_FINDINGS[1], "| Same class | important | change | usual | fixable | x |", "", "Acceptance: refused. An item is not met.", "- Same class · important · change", "Condition: not yet"].join("\n")), "--triage", writeFile("same class · usual path: the executor records the round\n")]);
  assert.equal(both.code, 0, both.out);
  const bothText = readFileSync(join(q.p.dir, "reviews/rounds", readdirSync(join(q.p.dir, "reviews/rounds")).find((f) => f.includes("-t-result-1"))), "utf8");
  assert.equal(bothText.split("\n").filter((l) => l === "- same class: usual path, the step it breaks: the executor records the round").length, 1, bothText);
});
// The ticket a finding is filed in, holding its class.
function p_issue(p) {
  p.put("issues/0001-rare.md", "# 1 rare\n\na rare case\n");
}

// ── Records of fixes ──────────────────────────────────────────────────────────────────────────────

test("[check.fixes-record.test-taken] a record of fixes gives a round's fixable finding its test, so that the narrow round follows, and refuses a class the round does not have", () => {
  const { p, st } = approved();
  const c1 = p.git("rev-parse", "HEAD");
  doneRecord(p, c1, st, at(10));
  p.put("reviews/rounds/20261101T103000Z-t-result-1.md", resultRound({ st, commit: c1, time: at(30), findings: ["- a bug · important · change · fixable"], acceptance: null }));
  p.put("tests/a.test.mjs", "test('holds the bug', () => {});\n");
  p.commit();
  const before = inputsOf(p);
  assert.equal(nextRound(before.rounds.filter((r) => r.step === "result-review")).next, "full");
  const bad = p.tool("round.mjs", ["fixes", "t", "--round", "20261101T103000Z-t-result-1.md", "--from", writeFile("another bug · tests/a.test.mjs · holds the bug\n")]);
  assert.match(bad.out, /another bug is not the class of a fixable finding/);
  const ok = p.tool("round.mjs", ["fixes", "t", "--round", "20261101T103000Z-t-result-1.md", "--from", writeFile("a bug · tests/a.test.mjs · holds the bug\n")]);
  assert.equal(ok.code, 0, ok.out);
  const after = inputsOf(p);
  assert.deepEqual(after.malformed, []);
  const r = after.rounds.find((x) => x.file === "20261101T103000Z-t-result-1.md");
  assert.equal(r.findings[0].test, "tests/a.test.mjs · holds the bug");
  assert.equal(nextRound(after.rounds.filter((x) => x.step === "result-review")).next, "narrow");
  assert.equal(readFileSync(join(p.dir, "reviews/rounds/20261101T103000Z-t-result-1.md"), "utf8"), resultRound({ st, commit: c1, time: at(30), findings: ["- a bug · important · change · fixable"], acceptance: null }));
  assert.deepEqual(applyFixes(before.rounds, []), before.rounds);
});

// ── Spend from the logs ───────────────────────────────────────────────────────────────────────────

test("[check.spend-snapshot.counted-from-logs] each message once, Codex by differences, two rounds of one session apart, and counting again or a shared session doubles nothing", () => {
  const { p, st } = approved({ fromLogs: true, goals: {} });
  const L = logs();
  // The unit starts at the round of its statement written before the writers, at(0); the executor's session
  // also names the task.
  p.put("reviews/rounds/20261101T103000Z-t-result-1.md", resultRound({ st, commit: p.git("rev-parse", "HEAD"), time: at(30), acceptance: null }).replace("Statement-hash:", `Brief-time: ${at(20)}\nStatement-hash:`));
  p.put("reviews/rounds/20261101T105000Z-t-result-2.md", resultRound({ st, commit: p.git("rev-parse", "HEAD"), time: at(50), number: 2, acceptance: null }).replace("Statement-hash:", `Brief-time: ${at(40)}\nStatement-hash:`));
  p.commit();
  L.claudeSession("exec-1", [
    { user: "Work on task t", time: at(10) },
    { msg: "early", time: at(-1), new: 1000, out: 1000 },
    { msg: "a", time: at(21), new: 10, created: 5, cached: 100, out: 7 },
    { msg: "a", time: at(21), new: 10, created: 5, cached: 100, out: 7 },
    { msg: "b", time: at(22), new: 1, out: 1 },
  ]);
  // A reviewer given both briefs in one session; a second Codex session of another round of nothing.
  const brief = (n, t) => `Task: t\nStep: result-review\nNarrow: false\nNumber: ${n}\nBrief-time: ${t}`;
  L.codexSession("rev-1", [
    { input: 500, cached: 100, out: 10, time: at(-1) },
    { user: brief(1, at(20)), time: at(20) },
    { input: 800, cached: 300, out: 30, time: at(25) },
    { user: brief(2, at(40)), time: at(40) },
    { input: 1000, cached: 350, out: 45, time: at(45) },
  ]);
  L.codexSession("rev-2", [{ user: "Review of task t, a check", time: at(21) }, { input: 100, cached: 0, out: 1, time: at(23) }]);
  const sp = spendIn(p, "t", st, L.env());
  // Claude: 15 + 1 new, 100 cached, 8 out; rev-1 after the start: (500-200)… differences 800-300 - (500-100) = 100 new, 200 cached, 20 out, then 150, 50, 15; rev-2: 100, 0, 1.
  assert.deepEqual(sp.used.task, { new: 16 + 100 + 150 + 100, cached: 100 + 200 + 50, out: 8 + 20 + 15 + 1 });
  const again = spendIn(p, "t", st, L.env());
  assert.deepEqual(again.used, sp.used);
  assert.deepEqual(roundSpend(sp.sessions, { task: "t", step: "result-review", number: "1", briefTime: at(20) }).sum, { new: 100, cached: 200, out: 20 });
  assert.deepEqual(roundSpend(sp.sessions, { task: "t", step: "result-review", number: "2", briefTime: at(40) }).sum, { new: 150, cached: 50, out: 15 });
});

test("[check.spend-snapshot.goal-unit] a task of a goal counts in the goal and in its own sessions; a goal command counts the goal; a task with no goal starts at its first brief; a task not in the goal is an error; the goal's statement is needed and approved", () => {
  const goals = { g: ["t", "u"] };
  const { p, st } = approved({ fromLogs: true, goal: "g", goals });
  const gst = statement({ budget: [100000, 100000] });
  p.put("reviews/rounds/20261101T095000Z-g-statement-1.md", cleanStatementRound("g", gst.hash, at(-10)));
  p.commit();
  const L = logs();
  L.claudeSession("exec-1", [{ user: "the goal g", time: at(-5) }, { msg: "e1", time: at(1), new: 10, out: 1 }]);
  L.claudeSession("rev-t", [{ user: "Review task t", time: at(2) }, { msg: "t1", time: at(3), new: 20, out: 2 }]);
  L.claudeSession("rev-u", [{ user: "Review task u", time: at(2) }, { msg: "u1", time: at(3), new: 40, out: 4 }]);
  L.claudeSession("other", [{ user: "Review task tu", time: at(2) }, { msg: "o1", time: at(3), new: 80, out: 8 }]);
  const missing = spendIn(p, "t", st, L.env());
  assert.match(missing.missing.join(";"), /ONT_GOAL_STATEMENT/);
  const sp = spendIn(p, "t", st, L.env({ ONT_GOAL_STATEMENT: gst.file }));
  assert.equal(sp.unit, "g");
  // The goal's start is its statement's first round, at(-10).
  assert.deepEqual(sp.used.unit, { new: 70, cached: 0, out: 7 });
  assert.deepEqual(sp.used.task, { new: 20, cached: 0, out: 2 });
  assert.equal(sp.limits.unit.newInput, 100000);
  // A goal's statement that is not the approved version is refused.
  const other = statement({ budget: [1, 1] });
  assert.match(spendIn(p, "t", st, L.env({ ONT_GOAL_STATEMENT: other.file })).errors.join(";"), /is version [0-9a-f]{12}, and version [0-9a-f]{12} is approved in force/);
  // The goal command counts the whole goal.
  const whole = spendIn(p, "g", gst, L.env());
  assert.deepEqual(whole.used.unit, { new: 70, cached: 0, out: 7 });
  // A task not listed in its goal, and a goal not listed, are errors.
  const v = statement({ goal: "g" });
  assert.match(spendIn(p, "v", v, L.env()).errors.join(";"), /does not list v among its tasks/);
  assert.match(spendIn(p, "w", statement({ goal: "nogoal" }), L.env()).errors.join(";"), /lists no goal nogoal/);
  // A task with no goal is its own unit, from its first brief, the round of its statement written by the tool.
  const q = project({ fromLogs: true, goals: {} });
  const qs = statement();
  q.put("reviews/rounds/x-t-statement-1.md", cleanStatementRound("t", qs.hash, at(25)).replace("Statement-hash:", `Brief-time: ${at(20)}\nStatement-hash:`));
  q.commit();
  const M = logs();
  M.claudeSession("exec-1", [{ user: "work", time: at(1) }, { msg: "before", time: at(2), new: 10, out: 1 }, { msg: "after", time: at(21), new: 3, out: 1 }]);
  const own = spendIn(q, "t", qs, M.env());
  assert.equal(own.unit, "t");
  assert.equal(own.start, at(20));
  assert.deepEqual(own.used.task, { new: 3, cached: 0, out: 1 });
});

test("[check.spend-snapshot.budget-stops] past the goal's reserve within the task's, --task names the question, --rounds names no action by the budget, and brief and done refuse", () => {
  const goals = { g: ["t"] };
  const { p, st } = approved({ fromLogs: true, goal: "g", goals, budget: [100000, 100000] });
  const gst = statement({ budget: [100, 100] });
  p.put("reviews/rounds/20261101T095000Z-g-statement-1.md", cleanStatementRound("g", gst.hash, at(-10)));
  p.commit();
  const L = logs();
  L.claudeSession("exec-1", [{ user: "the goal g", time: at(-5) }, { msg: "e1", time: at(1), new: 500, out: 1 }]);
  const env = L.env({ ONT_GOAL_STATEMENT: gst.file });
  const cfg = p.config();
  const inputs = inputsOf(p);
  const spendNow = spendOf({ cfg, task: "t", statement: readStatement(st.file), inputs, env });
  assert.equal(spendNow.exhausted, true);
  const args = { rounds: inputs.rounds, spend: [], done: [], approvals: [], task: "t", defaults: cfg.budget, statement: readStatement(st.file), spendNow };
  const t = taskState({ ...args });
  assert.match(t.lines.at(-1), /^NEXT t: the budget is exhausted: a question to the owner \(the reserve of the goal g is spent\)$/);
  const r = taskState({ ...args, statement: null, needFile: false, budgetActions: false });
  assert.doesNotMatch(r.lines.at(-1), /budget/);
  assert.ok(r.lines.some((l) => /^SPEND t: from the session logs .*goal g new input 500 of 100 × 1.5 = 150/.test(l)), r.lines.join("\n"));
  assert.match(p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", st.file], env).out, /the reserve of the goal g is spent/);
  assert.match(p.tool("done.mjs", ["t", "--statement", st.file], env).out, /no record of done written: .*budget is exhausted/);
});

test("[check.spend-snapshot.goal-kept-on-record] a task of a goal briefed and recorded as the agent rules give the commands keeps its goal: the snapshot has the goal's part and reserve, and --rounds counts the goal from the brief and from the record of done", () => {
  const goals = { g: ["t"] };
  const { p, st } = approved({ fromLogs: true, goal: "g", goals, budget: [100000, 100000] });
  const gst = statement({ budget: [200000, 300000] });
  p.put("reviews/rounds/20261101T095000Z-g-statement-1.md", cleanStatementRound("g", gst.hash, at(-10)));
  p.commit("the goal approved");
  const L = logs();
  L.claudeSession("exec-1", [{ user: "the goal g", time: at(-5) }, { msg: "e1", time: at(1), new: 500, out: 50 }]);
  const env = L.env({ ONT_GOAL_STATEMENT: gst.file });
  const done = p.tool("done.mjs", ["t", "--statement", st.file], env);
  assert.equal(done.code, 0, done.out);
  const doneFile = readdirSync(join(p.dir, "reviews/tasks")).find((f) => f.endsWith("-t-done.md"));
  assert.match(readFileSync(join(p.dir, "reviews/tasks", doneFile), "utf8"), /^Goal: g$/m);
  p.commit("done");
  const b = p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", st.file], env);
  assert.equal(b.code, 0, b.out);
  assert.match(b.out, /^Goal: g$/m);
  const lines = briefLines(b.out);
  const soon = (s) => iso(Date.now() + s * 1000);
  L.codexSession("rev-t", [{ user: `${lines}\n\nReview the result of task t.`, time: soon(1) }, { input: 700, cached: 0, out: 70, time: soon(2) }]);
  // While the brief is kept, --rounds reads the goal from it.
  const kept = p.tool("ont-check.mjs", ["--rounds"], env);
  assert.match(kept.out, /^SPEND t: from the session logs since \S+: goal g new input \d+ of 200000 × 1\.5 = 300000/m);
  // A statement given of another version than the brief's is refused.
  const other = statement({ goal: "g", budget: [100000, 100000], extra: "Another version.\n\n" });
  assert.match(p.tool("round.mjs", ["record", "t", "--from", writeReply(lines, "By: gpt (OpenAI, Codex)\nCondition: holds\nAcceptance: clean"), "--statement", other.file], env).out, /no record written: the statement .* is version [0-9a-f]{12}, and the brief's is [0-9a-f]{12}/);
  // The record as docs/parts/agent-rules.md gives it, with no statement.
  const r = p.tool("round.mjs", ["record", "t", "--from", writeReply(lines, "By: gpt (OpenAI, Codex)\nCondition: holds\nAcceptance: clean")], env);
  assert.equal(r.code, 0, r.out);
  const round = readdirSync(join(p.dir, "reviews/rounds")).find((f) => f.includes("-t-result-1"));
  const snap = readFileSync(join(p.dir, "reviews/rounds", round), "utf8").match(/^Spend-record: (\S+)$/m)[1];
  const text = readFileSync(join(p.dir, "reviews/tasks", snap), "utf8");
  assert.match(text, /^Unit: g$/m);
  assert.match(text, /^Unit-limit-new: 200000$/m);
  assert.match(text, /^Unit-limit-out: 300000$/m);
  assert.match(text, /^Unit-reserve: 1\.5$/m);
  assert.match(text, new RegExp(`^Unit-statement-hash: ${gst.hash}$`, "m"));
  assert.match(text, /^Task-limit-new: 100000$/m);
  // The executor's shared session counts for the goal, not for the task.
  assert.match(text, /^Unit-new: 1200$/m);
  assert.match(text, /^Task-new: 700$/m);
  // After the record, the brief is gone: --rounds reads the goal from the record of done.
  p.commit("the round");
  const after = p.tool("ont-check.mjs", ["--rounds"], env);
  assert.match(after.out, /^SPEND t: from the session logs since \S+: goal g new input 1200 of 200000 × 1\.5 = 300000/m);
});

test("[check.spend-snapshot.statement-round-limits] a round of the review of a statement briefed from it and recorded with no statement before any record of done keeps the task's limits and reserve in its snapshot, and --rounds keeps the goal and the limits after the brief is used", () => {
  const p = project({ fromLogs: true, goals: { g: ["t"] } });
  const gst = statement({ budget: [20000000, 9000000] });
  p.put("reviews/rounds/20261101T095000Z-g-statement-1.md", cleanStatementRound("g", gst.hash, iso(Date.now() - 60000)));
  p.commit("the goal approved");
  const st = statement({ goal: "g", budget: [3000000, 700000] });
  const L = logs();
  L.claudeSession("exec-1", [{ user: "work on t", time: iso(Date.now() - 1000) }]);
  const env = L.env({ ONT_GOAL_STATEMENT: gst.file });
  const b = p.tool("round.mjs", ["brief", "t", "--step", "statement", "--statement", st.file], env);
  assert.equal(b.code, 0, b.out);
  // The brief carries the statement's limits and reserve, after its goal.
  assert.match(b.out, /^Goal: g\nBudget-new-input: 3000000\nBudget-output: 700000\nBudget-reserve: 1\.5$/m);
  const lines = briefLines(b.out);
  const soon = (s) => iso(Date.now() + s * 1000);
  L.codexSession("rev-s", [{ user: `${lines}\n\nReview the statement of task t.`, time: soon(1) }, { input: 400, cached: 0, out: 40, time: soon(2) }]);
  // Recorded as docs/parts/agent-rules.md gives it, with no statement, before any record of done.
  const r = p.tool("round.mjs", ["record", "t", "--from", writeReply(lines, "By: gpt (OpenAI, Codex)\n\n| a choice | important | change |"), "--triage", writeFile("a choice · usual path: the executor corrects the statement\n")], env);
  assert.equal(r.code, 0, r.out);
  assert.equal(readdirSync(join(p.dir, "reviews/tasks")).filter((f) => f.endsWith("-done.md")).length, 0);
  const round = readdirSync(join(p.dir, "reviews/rounds")).find((f) => f.includes("-t-statement-1"));
  const snap = readFileSync(join(p.dir, "reviews/rounds", round), "utf8").match(/^Spend-record: (\S+)$/m)[1];
  const text = readFileSync(join(p.dir, "reviews/tasks", snap), "utf8");
  assert.match(text, /^Unit: g$/m);
  assert.match(text, /^Unit-limit-new: 20000000$/m);
  assert.match(text, /^Task-limit-new: 3000000$/m);
  assert.match(text, /^Task-limit-out: 700000$/m);
  assert.match(text, /^Task-reserve: 1\.5$/m);
  assert.match(text, new RegExp(`^Task-statement-hash: ${st.hash}$`, "m"));
  // The brief is used and no record of done is there: --rounds takes the goal and the limits from the snapshot.
  p.commit("the round");
  const after = p.tool("ont-check.mjs", ["--rounds"], env);
  assert.match(after.out, /^SPEND t: from the session logs since \S+: goal g new input \d+ of 20000000 × 1\.5 = 30000000, output \d+ of 9000000 × 1\.5 = 13500000; task t new input 400 of 3000000 × 1\.5 = 4500000, output 40 of 700000 × 1\.5 = 1050000$/m);
});

test("[check.spend-snapshot.revised-statement-limits] a revised statement reviewed and recorded with no statement while an earlier version is approved, then approved by that round, keeps its own limits: the snapshot names the revised version with them, and the rounds before any record of done count against them", () => {
  const p = project({ fromLogs: true, goals: { g: ["t"] } });
  // The configuration's limits, which no reader takes while a record of the version holds its own.
  const cfg = JSON.parse(readFileSync(join(p.dir, "ont.config.json"), "utf8"));
  p.put("ont.config.json", JSON.stringify({ ...cfg, budget: { newInput: 95000, output: 10000, reserve: 1.25 } }, null, 2));
  const gst = statement({ budget: [20000000, 9000000] });
  p.put("reviews/rounds/20261101T095000Z-g-statement-1.md", cleanStatementRound("g", gst.hash, iso(Date.now() - 120000)));
  // Version A of the task's statement, approved in force, with limits of its own.
  const a = statement({ goal: "g", budget: [1000000, 200000] });
  p.put("reviews/rounds/20261101T095500Z-t-statement-1.md", cleanStatementRound("t", a.hash, iso(Date.now() - 60000)));
  p.commit("the goal and version A approved");
  const b = statement({ goal: "g", budget: [3000000, 700000], extra: "Revised.\n\n" });
  const L = logs();
  L.claudeSession("exec-1", [{ user: "work on t", time: iso(Date.now() - 1000) }]);
  const env = L.env({ ONT_GOAL_STATEMENT: gst.file });
  // The next action names the round of the new version; its brief carries B's limits.
  const br = p.tool("round.mjs", ["brief", "t", "--step", "statement", "--statement", b.file], env);
  assert.equal(br.code, 0, br.out);
  assert.match(br.out, new RegExp(`^Statement-hash: ${b.hash}\nGoal: g\nBudget-new-input: 3000000\nBudget-output: 700000\nBudget-reserve: 1\\.5$`, "m"));
  const lines = briefLines(br.out);
  const soon = (s) => iso(Date.now() + s * 1000);
  L.codexSession("rev-b", [{ user: `${lines}\n\nReview the statement of task t.`, time: soon(1) }, { input: 400, cached: 0, out: 40, time: soon(2) }]);
  // Recorded as docs/parts/agent-rules.md gives it, with no statement, while A is approved in force.
  const r = p.tool("round.mjs", ["record", "t", "--from", writeReply(lines, "By: gpt (OpenAI, Codex)")], env);
  assert.equal(r.code, 0, r.out);
  const round = readdirSync(join(p.dir, "reviews/rounds")).find((f) => f.includes("-t-statement-2"));
  assert.ok(round, readdirSync(join(p.dir, "reviews/rounds")).join(", "));
  const snap = readFileSync(join(p.dir, "reviews/rounds", round), "utf8").match(/^Spend-record: (\S+)$/m)[1];
  const text = readFileSync(join(p.dir, "reviews/tasks", snap), "utf8");
  assert.match(text, new RegExp(`^Task-statement-hash: ${b.hash}$`, "m"));
  assert.match(text, /^Task-limit-new: 3000000$/m);
  assert.match(text, /^Task-limit-out: 700000$/m);
  assert.match(text, /^Task-reserve: 1\.5$/m);
  assert.match(text, /^Unit: g$/m);
  // The clean round approves B; no record of done is there; the brief is used.
  p.commit("the round of B");
  const inputs = inputsOf(p);
  assert.equal(approvedHash(inputs.rounds, "t", null, inputs.records.approvals), b.hash);
  assert.equal(inputs.records.done.length, 0);
  const rounds = p.tool("ont-check.mjs", ["--rounds"], env);
  assert.match(rounds.out, /^SPEND t: from the session logs since \S+: goal g new input \d+ of 20000000 × 1\.5 = 30000000, output \d+ of 9000000 × 1\.5 = 13500000; task t new input 400 of 3000000 × 1\.5 = 4500000, output 40 of 700000 × 1\.5 = 1050000$/m);
  assert.match(rounds.out, /^BUDGET t: new input \d+ of 3000000 × 1\.5 = 4500000, output \d+ of 700000 × 1\.5 = 1050000/m);
  // The task's lines name none of the configuration's limits.
  assert.doesNotMatch(rounds.out.slice(rounds.out.indexOf("ROUNDS t ")), /95000|1\.25/);
  // The next action, given B's file, reads the same limits.
  const task = p.tool("ont-check.mjs", ["--task", "t", "--statement", b.file], env);
  assert.match(task.out, /^SPEND t: from the session logs since \S+: .*task t new input 400 of 3000000 × 1\.5 = 4500000, output 40 of 700000 × 1\.5 = 1050000$/m);
  assert.match(task.out, /^NEXT t: the executor works under version [0-9a-f]{12}, then records done/m);
});

test("[check.spend-snapshot.revised-statement-stop] a revised statement whose own limits are below the spend while the approved version's are above: --task and round.mjs brief take the budget of the version in force alike, the round --task names is the round brief writes, and past the approved version's reserve both stop", () => {
  const p = project({ fromLogs: true, goals: { g: ["t"] } });
  const gst = statement({ budget: [20000000, 9000000] });
  p.put("reviews/rounds/20261101T095000Z-g-statement-1.md", cleanStatementRound("g", gst.hash, iso(Date.now() - 120000)));
  // Version A, approved in force, whose reserve is well above the spend.
  const a = statement({ goal: "g", budget: [1000000, 200000] });
  p.put("reviews/rounds/20261101T095500Z-t-statement-1.md", cleanStatementRound("t", a.hash, iso(Date.now() - 60000)));
  const work = p.commit("the goal and version A approved");
  // A's record of done carries its limits and its goal, which every reader takes for the version in force.
  const doneTime = iso(Date.now() - 40000);
  p.put(`reviews/tasks/${doneTime.replace(/[-:]/g, "")}-t-done.md`, ["Record: done", "Task: t", `Commit: ${work}`, `Statement-hash: ${a.hash}`, "Goal: g", "Budget-new-input: 1000000", "Budget-output: 200000", "Budget-reserve: 1.5", `Time: ${doneTime}`, "Checks:", "- true · pass", ""].join("\n"));
  p.commit("done of A");
  // Version B, proposed, whose own limits the spend is past.
  const b = statement({ goal: "g", budget: [100, 100], extra: "Revised.\n\n" });
  const L = logs();
  L.claudeSession("exec-1", [{ user: "work on t", time: iso(Date.now() - 30000) }, { msg: "e1", time: iso(Date.now() - 20000), new: 500, out: 50 }]);
  const env = L.env({ ONT_GOAL_STATEMENT: gst.file });
  const task = p.tool("ont-check.mjs", ["--task", "t", "--statement", b.file], env);
  assert.match(task.out, /^SPEND t: from the session logs since \S+: goal g new input 500 of 20000000 × 1\.5 = 30000000, output 50 of 9000000 × 1\.5 = 13500000; task t new input 500 of 1000000 × 1\.5 = 1500000, output 50 of 200000 × 1\.5 = 300000$/m);
  assert.match(task.out, /^NEXT t: the statement changed after its approval: next is full round 2 of the new version$/m);
  const br = p.tool("round.mjs", ["brief", "t", "--step", "statement", "--statement", b.file], env);
  assert.equal(br.code, 0, br.out);
  assert.match(br.out, /^BRIEF t: full round 2 of the statement/m);
  // The brief still carries B's own limits, for the round's record (D-174).
  assert.match(br.out, /^Budget-new-input: 100\nBudget-output: 100$/m);
  // Past A's reserve too: --task names the question, and brief refuses for the budget.
  L.claudeSession("exec-2", [{ user: "work on t", time: iso(Date.now() - 10000) }, { msg: "e2", time: iso(Date.now() - 5000), new: 2000000, out: 50 }]);
  const env2 = L.env({ ONT_GOAL_STATEMENT: gst.file, ONT_EXECUTOR_SESSIONS: "exec-1,exec-2" });
  const over = p.tool("ont-check.mjs", ["--task", "t", "--statement", b.file], env2);
  assert.match(over.out, /^NEXT t: the budget is exhausted: a question to the owner \(the reserve of the task t is spent\)$/m);
  const refused = p.tool("round.mjs", ["brief", "t", "--step", "statement", "--statement", b.file], env2);
  assert.notEqual(refused.code, 0, refused.out);
  assert.match(refused.out, /^ERROR · no brief written: .*the budget is exhausted: a question to the owner \(the reserve of the task t is spent\)/m);
});

test("[check.spend-snapshot.approval-only-record] the owner's approval written by approve.mjs is the only record of the approved version, and a revised version is read before any record of done: --task and round.mjs brief count the goal against the approved version's limits and both stop past the goal's reserve; an approval written before its limits reads as before, the goal still counted", () => {
  // A task t of goal g whose version A has a finding not fixable, which only the owner's approval answers.
  const setup = () => {
    const p = project({ fromLogs: true, goals: { g: ["t"] } });
    const gst = statement({ budget: [1000, 1000] });
    p.put("reviews/rounds/20261101T095000Z-g-statement-1.md", cleanStatementRound("g", gst.hash, at(-10)));
    const a = statement({ goal: "g", budget: [1000000, 200000] });
    p.put("reviews/rounds/20261101T100000Z-t-statement-1.md", ["Task: t", "Step: statement-review", "Number: 1", `Time: ${at(0)}`, "By: m (p)", `Statement-hash: ${a.hash}`, "Findings:", "- a choice · important · change · not fixable", ""].join("\n"));
    p.commit("the goal approved, version A reviewed");
    return { p, gst, a };
  };
  // A spend past the goal's reserve, 1000 × 1.5, and well within A's.
  const L = logs();
  L.claudeSession("exec-1", [{ user: "the goal g", time: at(-5) }, { msg: "e1", time: at(5), new: 2000, out: 1 }]);
  const { p, gst, a } = setup();
  const env = L.env({ ONT_GOAL_STATEMENT: gst.file });
  const cmd = registry({ 7: { question: `Approve task t, version ${a.hash.slice(0, 12)}?`, options: [{ key: "a", meaning: "approve" }], answer: { by: "owner", date: "2026-11-23", option: "a" } } });
  const ok = p.tool("approve.mjs", ["t", "--statement", a.file, "--english", writeFile("approve it"), "--question", "7", "--kind", "approval"], { ONT_REGISTRY_CMD: cmd });
  assert.equal(ok.code, 0, ok.out);
  const approvalFile = readdirSync(join(p.dir, "reviews/tasks")).find((f) => f.endsWith("-t-approval.md"));
  const approvalText = readFileSync(join(p.dir, "reviews/tasks", approvalFile), "utf8");
  // The record of the approval carries A's limits and reserve.
  assert.match(approvalText, /^Budget-new-input: 1000000\nBudget-output: 200000\nBudget-reserve: 1\.5$/m);
  p.commit("A approved by the owner");
  const inputs = inputsOf(p);
  assert.deepEqual(inputs.records.malformed, []);
  assert.equal(inputs.records.done.length, 0);
  assert.equal(approvedHash(inputs.rounds, "t", null, inputs.records.approvals), a.hash);
  // Version B, revised, with the same goal; no record of done and no kept brief of either version.
  const b = statement({ goal: "g", budget: [1000000, 200000], extra: "Revised.\n\n" });
  const task = p.tool("ont-check.mjs", ["--task", "t", "--statement", b.file], env);
  assert.match(task.out, /^SPEND t: from the session logs since \S+: goal g new input 2000 of 1000 × 1\.5 = 1500, output 1 of 1000 × 1\.5 = 1500; task t new input 0 of 1000000 × 1\.5 = 1500000, output 0 of 200000 × 1\.5 = 300000; past the reserve$/m);
  assert.match(task.out, /^NEXT t: the budget is exhausted: a question to the owner \(the reserve of the goal g is spent\)$/m);
  const refused = p.tool("round.mjs", ["brief", "t", "--step", "statement", "--statement", b.file], env);
  assert.notEqual(refused.code, 0, refused.out);
  assert.match(refused.out, /^ERROR · no brief written: .*the budget is exhausted: a question to the owner \(the reserve of the goal g is spent\)/m);
  // An approval written before the record carried limits: the configuration's limits, none here, and the goal still counted.
  const q = setup();
  q.p.put("reviews/tasks/20261101T110000Z-t-approval.md", ["Record: approval", "Kind: approval", "Task: t", `Statement-hash: ${q.a.hash}`, "By: owner", "Question: 7", 'Source: question 7, answered 2026-11-01, option a: "approve it" (translated from Russian)', `Time: ${at(60)}`, ""].join("\n"));
  q.p.commit("A approved before the lines");
  const old = inputsOf(q.p);
  assert.deepEqual(old.records.malformed, []);
  assert.equal(old.records.approvals[0].budget, null);
  const qb = statement({ goal: "g", budget: [1000000, 200000], extra: "Revised.\n\n" });
  const qenv = L.env({ ONT_GOAL_STATEMENT: q.gst.file });
  const before = q.p.tool("ont-check.mjs", ["--task", "t", "--statement", qb.file], qenv);
  assert.match(before.out, /^SPEND t: from the session logs since \S+: goal g new input 2000 of 1000 × 1\.5 = 1500, output 1 of 1000 × 1\.5 = 1500; task t new input 0, no limit, output 0, no limit; past the reserve$/m);
  assert.match(before.out, /^NEXT t: the budget is exhausted: a question to the owner \(the reserve of the goal g is spent\)$/m);
  assert.match(q.p.tool("round.mjs", ["brief", "t", "--step", "statement", "--statement", qb.file], qenv).out, /^ERROR · no brief written: .*the reserve of the goal g is spent/m);
});

test("[check.spend-snapshot.goal-agrees] the unit is the goal a statement names on Goal:, within the configuration's composition: a line that names a goal that does not list the task and a goal named for a task listed under none are errors of --task, round.mjs brief and done.mjs; a member of a goal whose statement has no line is its own unit with its own limits, no error, and --task of the goal still counts it; a record of done whose line names a goal that does not list the task is an error of the check", () => {
  const p = project({ fromLogs: true, goals: { g: ["t"], h: ["x"] } });
  const gst = statement({ budget: [100000, 100000] });
  p.put("reviews/rounds/20261101T095000Z-g-statement-1.md", cleanStatementRound("g", gst.hash, at(-10)));
  // The approved statement of t, a member of g, has no line Goal: (item 7).
  const none = statement({ extra: "No goal.\n\n", budget: [5000, 6000] });
  p.put("reviews/rounds/20261101T100000Z-t-statement-1.md", cleanStatementRound("t", none.hash, at(0)));
  const work = p.commit("approved");
  const st = statement({ goal: "g" });
  const L = logs();
  // The executor's work before t's first round counts for the goal alone; t's reviewer's session for both.
  L.claudeSession("exec-1", [{ user: "the goal g", time: at(-8) }, { msg: "e0", time: at(-5), new: 100, out: 10 }, { msg: "e1", time: at(1), new: 10, out: 1 }]);
  L.claudeSession("rev-t", [{ user: "Review task t", time: at(2) }, { msg: "t1", time: at(3), new: 20, out: 2 }]);
  const env = L.env({ ONT_GOAL_STATEMENT: gst.file });
  // A statement whose line names g, which lists t: the spend is the goal's.
  assert.equal(spendIn(p, "t", st, env).unit, "g");
  const cases = [
    [statement({ goal: "h", extra: "Another goal.\n\n" }), "t", /the statement names the goal h on Goal:, and the configuration does not list t among its tasks/],
    [statement({ goal: "g", extra: "Not listed.\n\n" }), "w", /the statement names the goal g on Goal:, and the configuration does not list w among its tasks/],
  ];
  for (const [s, task, why] of cases) {
    assert.match(spendIn(p, task, s, env).errors.join(";"), why);
    const t = p.tool("ont-check.mjs", ["--task", task, "--statement", s.file], env);
    assert.notEqual(t.code, 0, t.out);
    assert.match(t.out, why);
    assert.match(p.tool("round.mjs", ["brief", task, "--step", "statement", "--statement", s.file], env).out, new RegExp(`^ERROR · no brief written: .*${why.source}`, "m"));
    assert.match(p.tool("done.mjs", [task, "--statement", s.file], env).out, new RegExp(`no record of done written: .*${why.source}`));
  }
  // The approved statement of t with no line Goal: t is its own unit, with its own limits, from its own
  // first round, with no error (D-179).
  const sp = spendIn(p, "t", none, env);
  assert.deepEqual(sp.errors ?? [], []);
  assert.equal(sp.unit, "t");
  assert.equal(sp.goal, false);
  assert.deepEqual(sp.used.task, { new: 30, cached: 0, out: 3 });
  assert.equal(sp.limits.task.newInput, 5000);
  const plain = p.tool("ont-check.mjs", ["--task", "t", "--statement", none.file], env);
  assert.equal(plain.code, 0, plain.out);
  assert.doesNotMatch(plain.out, /ERROR|goal g/, plain.out);
  assert.match(plain.out, /^SPEND t: from the session logs since \S+: task t new input 30 of 5000 × 1\.5 = 7500, output 3 of 6000 × 1\.5 = 9000$/m);
  // round.mjs brief takes a revised statement with no line too: the brief is written, with no line Goal:.
  const revised = statement({ extra: "No goal, revised.\n\n", budget: [5000, 6000] });
  const br = p.tool("round.mjs", ["brief", "t", "--step", "statement", "--statement", revised.file], env);
  assert.equal(br.code, 0, br.out);
  assert.doesNotMatch(br.out, /^Goal:/m, br.out);
  // The goal's command still counts t, by the composition: the executor's work and t's sessions.
  const whole = spendIn(p, "g", gst, env);
  assert.deepEqual(whole.used.unit, { new: 130, cached: 0, out: 13 });
  const goal = p.tool("ont-check.mjs", ["--task", "g", "--statement", gst.file], env);
  assert.match(goal.out, /^SPEND g: from the session logs since \S+: goal g new input 130 of 100000 × 1\.5 = 150000/m);
  // A record of done of t whose line names h, which does not list t: the full check names it.
  const time = at(30);
  p.put(`reviews/tasks/${time.replace(/[-:]/g, "")}-t-done.md`, ["Record: done", "Task: t", `Commit: ${work}`, `Statement-hash: ${none.hash}`, "Budget-new-input: 5000", "Budget-output: 6000", "Budget-reserve: 1.5", "Goal: h", `Time: ${time}`, "Checks:", "- true · pass", ""].join("\n"));
  p.commit("done naming another goal");
  const check = p.tool("ont-check.mjs", [], env);
  assert.notEqual(check.code, 0, check.out);
  assert.match(check.out, /records whose line Goal: names a goal the configuration does not list the task under/);
  assert.match(check.out, /-t-done\.md: the record of done names the goal h on Goal:, and the configuration does not list t among its tasks/);
});

test("[check.spend-snapshot.snapshot-of-version] with no logs, no kept brief and no record of done of the version in force, a reader takes only a snapshot of spend of that version: after the approval of a newer version with no snapshot of it, --rounds shows none of the older version's limits as the newer one's", () => {
  const p = project({ fromLogs: true, goals: {} });
  const cfg = JSON.parse(readFileSync(join(p.dir, "ont.config.json"), "utf8"));
  p.put("ont.config.json", JSON.stringify({ ...cfg, budget: { newInput: 95000, output: 10000, reserve: 1.25 } }, null, 2));
  p.commit("the configuration's limits");
  const a = statement({ budget: [1234567, 234567] });
  const L = logs();
  L.claudeSession("exec-1", [{ user: "work on t", time: iso(Date.now() - 1000) }]);
  const env = L.env();
  // Version A reviewed and approved by a round written by the tool, with a snapshot of A's limits.
  const br = p.tool("round.mjs", ["brief", "t", "--step", "statement", "--statement", a.file], env);
  assert.equal(br.code, 0, br.out);
  const lines = briefLines(br.out);
  const soon = (s) => iso(Date.now() + s * 1000);
  L.codexSession("rev-a", [{ user: `${lines}\n\nReview the statement of task t.`, time: soon(1) }, { input: 400, cached: 0, out: 40, time: soon(2) }]);
  const r = p.tool("round.mjs", ["record", "t", "--from", writeReply(lines, "By: gpt (OpenAI, Codex)")], env);
  assert.equal(r.code, 0, r.out);
  const roundA = readdirSync(join(p.dir, "reviews/rounds")).find((f) => f.includes("-t-statement-1"));
  const snap = readFileSync(join(p.dir, "reviews/rounds", roundA), "utf8").match(/^Spend-record: (\S+)$/m)[1];
  assert.match(readFileSync(join(p.dir, "reviews/tasks", snap), "utf8"), /^Task-limit-new: 1234567$/m);
  // Version B approved after it by a clean round with no snapshot of its own; no record of done.
  const b = statement({ budget: [3000000, 700000], extra: "Revised.\n\n" });
  const timeA = readFileSync(join(p.dir, "reviews/rounds", roundA), "utf8").match(/^Time: (\S+)$/m)[1];
  const timeB = iso(Date.parse(timeA) + 1000);
  p.put(`reviews/rounds/${timeB.replace(/[-:]/g, "")}-t-statement-2.md`, cleanStatementRound("t", b.hash, timeB, 2));
  p.commit("A's round and B's approval");
  const inputs = inputsOf(p);
  assert.equal(approvedHash(inputs.rounds, "t", null, inputs.records.approvals), b.hash);
  // CI: no logs. The reader asks B's limits and finds no record of B: the configuration's, never A's.
  const rounds = p.tool("ont-check.mjs", ["--rounds"], {});
  const own = rounds.out.slice(rounds.out.indexOf("ROUNDS t "));
  assert.doesNotMatch(own, /1234567|234567/, own);
  assert.match(own, /^BUDGET t: new input \d+ of 95000 × 1\.25 = 118750, output \d+ of 10000 × 1\.25 = 12500/m);
  const sp = spendOf({ cfg: p.config(), task: "t", inputs, env: {} });
  assert.equal(sp.fromSnapshot, undefined);
  // The version asked is A: its snapshot is taken.
  assert.equal(spendOf({ cfg: p.config(), task: "t", version: a.hash, inputs, env: {} }).fromSnapshot, snap);
});

test("[check.task-statement.limits-by-version] the limits of a version come from the records of that version alone: its file, its kept brief, its record of done, the owner's approval or its snapshot of spend, and the configuration's where none holds them; the task's line Goal: is the statement's where one is given, or else that of the records of the version that applies, its line or its absence, or the latest line of another version only where no record of that version copies the budget", () => {
  const defaults = { newInput: 95000, output: 10000, reserve: 1.25 };
  const H = (c) => c.repeat(64);
  const statementOf = { hash: H("a"), budget: { newInput: 1, output: 2, reserve: 1.5 }, goal: "g" };
  const pending = [{ task: "t", brief: { "Statement-hash": H("b"), Goal: "g", "Budget-new-input": "3", "Budget-output": "none", "Budget-reserve": "2" } }];
  const done = [
    { task: "t", file: "c.md", time: at(1), statementHash: H("c"), budget: { newInput: 5, output: 6, reserve: null }, goal: null },
    { task: "t", file: "f.md", time: at(2), statementHash: H("f"), budget: { newInput: 99, output: 99, reserve: 3 }, goal: "other" },
  ];
  const snapshots = [{ task: "t", unit: "g", file: "d.md", time: at(3), limits: { task: { newInput: 7, output: 8, reserve: 1.5, hash: H("d") }, unit: {} } }];
  // The owner's approval of version 1 with its limits (D-176), and one of version 2 written before them.
  const approvals = [
    { task: "t", file: "1.md", time: at(4), statementHash: H("1"), budget: { newInput: 11, output: 12, reserve: 1.5 } },
    { task: "t", file: "2.md", time: at(5), statementHash: H("2"), budget: null },
  ];
  const of = (version) => versionLimits({ task: "t", version, statement: statementOf, pending, done, approvals, snapshots, defaults });
  assert.deepEqual(of(H("a")), { newInput: 1, output: 2, reserve: 1.5, version: H("a"), from: "statement" });
  // A limit the version gives as none is the configuration's.
  assert.deepEqual(of(H("b")), { newInput: 3, output: 10000, reserve: 2, version: H("b"), from: "brief" });
  assert.deepEqual(of(H("c")), { newInput: 5, output: 6, reserve: 1.25, version: H("c"), from: "done", file: "c.md" });
  assert.deepEqual(of(H("1")), { newInput: 11, output: 12, reserve: 1.5, version: H("1"), from: "approval", file: "1.md" });
  assert.deepEqual(of(H("d")), { newInput: 7, output: 8, reserve: 1.5, version: H("d"), from: "snapshot", file: "d.md" });
  // An approval written before its limits reads as before: the configuration's.
  assert.deepEqual(of(H("2")), { newInput: 95000, output: 10000, reserve: 1.25, version: H("2"), from: "configuration" });
  // A version no record holds: the configuration's, whatever other versions hold.
  assert.deepEqual(of(H("e")), { newInput: 95000, output: 10000, reserve: 1.25, version: H("e"), from: "configuration" });
  // The task's line Goal: (D-179): the statement's where one is given, even with no line; with no version, or
  // a version no record of which copies the budget, the latest of its records that carries one, whatever
  // version each names: the snapshot d, whose unit is the goal g, after the record of done f, and a kept
  // brief after both.
  assert.deepEqual(goalLineOf({ task: "t", statement: statementOf, done, snapshots }), { line: "g", of: "the statement" });
  assert.deepEqual(goalLineOf({ task: "t", statement: { ...statementOf, goal: null }, done, snapshots }), { line: null, of: "the statement" });
  assert.deepEqual(goalLineOf({ task: "t", done, snapshots }), { line: "g", of: "the snapshot of spend d.md" });
  assert.deepEqual(goalLineOf({ task: "t", done }), { line: "other", of: "the record of done f.md" });
  assert.deepEqual(goalLineOf({ task: "t", done, snapshots, pending: [{ task: "t", step: "result-review", briefTime: at(9), brief: { Goal: "h" } }] }), { line: "h", of: "the kept brief of t, result-review" });
  assert.deepEqual(goalLineOf({ task: "u", done, snapshots }), { line: null, of: "no record" });
  // With the version that applies, its own records decide, their line or its absence: the record of done c,
  // with no line, is the task's own unit though the later snapshot d names g; the snapshot d and the kept
  // brief b name g; the version 1, whose only record is the owner's approval, falls to the latest line of
  // another version.
  assert.deepEqual(goalLineOf({ task: "t", version: H("c"), done, snapshots }), { line: null, of: "the record of done c.md" });
  assert.deepEqual(goalLineOf({ task: "t", version: H("f"), done, snapshots }), { line: "other", of: "the record of done f.md" });
  assert.deepEqual(goalLineOf({ task: "t", version: H("d"), done, snapshots }), { line: "g", of: "the snapshot of spend d.md" });
  assert.deepEqual(goalLineOf({ task: "t", version: H("b"), pending: [{ task: "t", step: "statement-review", briefTime: at(0), ...pending[0] }], done, snapshots }), { line: "g", of: "the kept brief of t, statement-review" });
  assert.deepEqual(goalLineOf({ task: "t", version: H("1"), done, snapshots }), { line: "g", of: "the snapshot of spend d.md" });
  // Records of another task give nothing.
  assert.equal(versionLimits({ task: "u", version: H("c"), done, defaults }).from, "configuration");
  // The version in force: the approval's, else the file's, else the kept brief's, else the latest round's.
  const round = (hash, time, findings = []) => ({ task: "t", step: "statement-review", time, statementHash: hash, findings, file: `${time}.md` });
  assert.equal(versionInForce({ rounds: [round(H("a"), at(1))], task: "t", statement: { hash: H("b") } }), H("a"));
  assert.equal(versionInForce({ rounds: [round(H("a"), at(1), [{ cls: "x", weight: "important", ofChange: true, fixable: true }])], task: "t", statement: { hash: H("b") } }), H("b"));
  assert.equal(versionInForce({ rounds: [round(H("a"), at(1), [{ cls: "x", weight: "important", ofChange: true, fixable: true }])], task: "t", pending }), H("b"));
  assert.equal(versionInForce({ rounds: [round(H("a"), at(1), [{ cls: "x", weight: "important", ofChange: true, fixable: true }])], task: "t" }), H("a"));
  assert.equal(versionInForce({ rounds: [], task: "t" }), null);
});

test("[check.spend-snapshot.overspend-by-snapshot] a round with findings past the reserve has no Overspend and the question follows; a clean acceptance past it names the snapshot's, which a later spend does not change", () => {
  const { p, st } = approved({ fromLogs: true, goals: {}, budget: [10, 10] });
  const c1 = p.git("rev-parse", "HEAD");
  doneRecord(p, c1, st, at(10));
  p.commit("done");
  const L = logs();
  L.claudeSession("exec-1", [{ user: "work on t", time: at(1) }, { msg: "m1", time: at(2), new: 5, out: 1 }]);
  const b = p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", st.file], L.env());
  assert.equal(b.code, 0, b.out);
  const lines = briefLines(b.out);
  const soon = (s) => iso(Date.now() + s * 1000);
  L.codexSession("rev-1", [{ user: lines, time: soon(1) }, { input: 1000, cached: 0, out: 100, time: soon(2) }]);
  const found = p.tool("round.mjs", ["record", "t", "--from", writeReply(lines, "By: m\nCondition: not yet\nAcceptance: fail\n- an item not met · important · change"), "--triage", writeFile("an item not met · usual path: acceptance\n")], L.env());
  assert.equal(found.code, 0, found.out);
  const first = readdirSync(join(p.dir, "reviews/rounds")).find((f) => f.includes("result-1"));
  assert.doesNotMatch(readFileSync(join(p.dir, "reviews/rounds", first), "utf8"), /^Overspend:/m);
  const cfg = p.config();
  const inputs = inputsOf(p);
  const sp = spendOf({ cfg, task: "t", statement: readStatement(st.file), inputs, env: L.env() });
  const next = taskNext({ rounds: inputs.rounds, done: inputs.records.done, approvals: [], task: "t", defaults: cfg.budget, statement: readStatement(st.file), needFile: true, spendNow: sp });
  assert.equal(next.kind, "question");
  // A clean acceptance past the reserve: briefed before the reserve was spent, recorded as it is.
  const q = approved({ fromLogs: true, goals: {}, budget: [10, 10] });
  const d = q.p.git("rev-parse", "HEAD");
  doneRecord(q.p, d, q.st, at(10));
  q.p.commit("done");
  const M = logs();
  M.claudeSession("exec-1", [{ user: "work on t", time: at(1) }]);
  const qb = q.p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", q.st.file], M.env());
  const ql = briefLines(qb.out);
  M.codexSession("rev-1", [{ user: ql, time: soon(1) }, { input: 1000, cached: 0, out: 100, time: soon(2) }]);
  const clean = q.p.tool("round.mjs", ["record", "t", "--from", writeReply(ql, "By: m\nCondition: not yet\nAcceptance: pass")], M.env());
  assert.equal(clean.code, 0, clean.out);
  const end = inputsOf(q.p).rounds.find((r) => r.step === "result-review");
  assert.equal(end.overspend, "new input 1000 of 15, output 100 of 15");
  // A later spend leaves the snapshot, and what the check compares, as it was.
  M.codexSession("rev-late", [{ user: "Review task t again", time: soon(3) }, { input: 99999, cached: 0, out: 9999, time: soon(4) }]);
  const after = inputsOf(q.p);
  assert.deepEqual(snapshotOverspendProblems(end, after.records.snapshots), []);
  assert.equal(overspendOf(snapshotSpend(after.records.snapshots[0])), end.overspend);
  const check = q.p.tool("ont-check.mjs", [], M.env());
  assert.equal(check.code, 0, check.out);
});

test("[check.spend-snapshot.done-names-goal-overspend] a clean acceptance recorded past the goal's reserve while the task is within its own: --task names on NEXT the goal's overspend to report and the merge, from the logs and, with no logs, from the round's snapshot; --rounds names no action by the budget", () => {
  const goals = { g: ["t"] };
  const { p, st } = approved({ fromLogs: true, goal: "g", goals, budget: [100000, 100000] });
  const gst = statement({ budget: [100, 100] });
  p.put("reviews/rounds/20261101T095000Z-g-statement-1.md", cleanStatementRound("g", gst.hash, at(-10)));
  doneRecord(p, p.git("rev-parse", "HEAD"), st, at(10));
  p.commit("the goal approved, done");
  const L = logs();
  L.claudeSession("exec-1", [{ user: "the goal g", time: at(-5) }]);
  const env = L.env({ ONT_GOAL_STATEMENT: gst.file });
  // Briefed within the reserve; the round's own spend passes the goal's, 100 × 1.5, and not the task's.
  const b = p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", st.file], env);
  assert.equal(b.code, 0, b.out);
  const lines = briefLines(b.out);
  const soon = (s) => iso(Date.now() + s * 1000);
  L.codexSession("rev-t", [{ user: `${lines}\n\nReview the result of task t.`, time: soon(1) }, { input: 1000, cached: 0, out: 100, time: soon(2) }]);
  const r = p.tool("round.mjs", ["record", "t", "--from", writeReply(lines, "By: m\nCondition: holds\nAcceptance: pass")], env);
  assert.equal(r.code, 0, r.out);
  p.commit("the round");
  const end = inputsOf(p).rounds.find((x) => x.step === "result-review");
  assert.equal(end.overspend, "goal g: new input 1000 of 150, output 100 of 150");
  const said = /^NEXT t: done, with an overspend: goal g: new input 1000 of 150, output 100 of 150; report it to the owner, and the last round and its acceptance are clean: merge \(rule\.ready-after-clean-round\)$/m;
  const task = p.tool("ont-check.mjs", ["--task", "t", "--statement", st.file], env);
  assert.equal(task.code, 0, task.out);
  assert.match(task.out, said);
  // With no logs, as in CI: the snapshot the round names gives the same overspend.
  const ci = p.tool("ont-check.mjs", ["--task", "t", "--statement", st.file], {});
  assert.match(ci.out, said);
  // --rounds names no action by the budget: the merge alone.
  const rounds = p.tool("ont-check.mjs", ["--rounds"], env);
  assert.match(rounds.out, /^NEXT t: done: the last round and its acceptance are clean: merge/m);
});

test("[check.spend-snapshot.goal-own-overspend] a goal's own clean acceptance recorded past the goal's reserve: the Overspend round.mjs record writes has the task's part alone, the text its snapshot gives, and the full check and --task with no logs accept it", () => {
  const p = project({ fromLogs: true, goals: { g: ["t"] } });
  const gst = statement({ budget: [100, 100] });
  p.put("reviews/rounds/20261101T095000Z-g-statement-1.md", cleanStatementRound("g", gst.hash, at(-10)));
  const work = p.commit("the goal approved");
  const doneTime = iso(Date.now() - 40000);
  p.put(`reviews/tasks/${doneTime.replace(/[-:]/g, "")}-g-done.md`, ["Record: done", "Task: g", `Commit: ${work}`, `Statement-hash: ${gst.hash}`, "Budget-new-input: 100", "Budget-output: 100", "Budget-reserve: 1.5", `Time: ${doneTime}`, "Checks:", "- true · pass", ""].join("\n"));
  p.commit("done of the goal");
  const L = logs();
  L.claudeSession("exec-1", [{ user: "the goal g", time: iso(Date.now() - 30000) }]);
  const env = L.env();
  // Briefed within the reserve; the reviewer's session passes it, 100 × 1.5.
  const b = p.tool("round.mjs", ["brief", "g", "--step", "result", "--statement", gst.file], env);
  assert.equal(b.code, 0, b.out);
  const lines = briefLines(b.out);
  const soon = (s) => iso(Date.now() + s * 1000);
  L.codexSession("rev-g", [{ user: `${lines}\n\nReview the result of goal g.`, time: soon(1) }, { input: 1000, cached: 0, out: 100, time: soon(2) }]);
  const r = p.tool("round.mjs", ["record", "g", "--from", writeReply(lines, "By: m\nCondition: holds\nAcceptance: pass")], env);
  assert.equal(r.code, 0, r.out);
  p.commit("the goal's round");
  const inputs = inputsOf(p);
  const end = inputs.rounds.find((x) => x.task === "g" && x.step === "result-review");
  // One part: the goal is its own unit, one sum against one set of limits (D-179).
  assert.equal(end.overspend, "new input 1000 of 150, output 100 of 150");
  const snap = inputs.records.snapshots.find((x) => x.file === end.spendRecord);
  assert.equal(snap.unit, "g");
  assert.equal(overspendOf(snapshotSpend(snap)), end.overspend);
  assert.deepEqual(snapshotOverspendProblems(end, inputs.records.snapshots), []);
  // The live state of spend gives the same text the snapshot does.
  assert.equal(overspendOf(spendOf({ cfg: p.config(), task: "g", statement: readStatement(gst.file), inputs, env })), end.overspend);
  // The full check, as CI runs it with no logs, validates the record against its snapshot.
  const check = p.tool("ont-check.mjs", [], {});
  assert.equal(check.code, 0, check.out);
  assert.doesNotMatch(check.out, /Overspend: is not the tool's/);
  const said = /^NEXT g: done, with an overspend: new input 1000 of 150, output 100 of 150; report it to the owner, and the last round and its acceptance are clean: merge \(rule\.ready-after-clean-round\)$/m;
  assert.match(p.tool("ont-check.mjs", ["--task", "g", "--statement", gst.file], {}).out, said);
  assert.match(p.tool("ont-check.mjs", ["--task", "g", "--statement", gst.file], env).out, said);
});

test("[check.spend-snapshot.goal-line-of-version] a task whose older version's record of done names Goal: g and whose revised statement has no line: its brief, recorded by round.mjs record with no file and no goal's statement, counts the task as its own unit in the snapshot and the record, and --rounds keeps it so", () => {
  const p = project({ fromLogs: true, goals: { g: ["t"] } });
  const gst = statement({ budget: [20000000, 9000000] });
  p.put("reviews/rounds/20261101T095000Z-g-statement-1.md", cleanStatementRound("g", gst.hash, iso(Date.now() - 120000)));
  // Version A names the goal, is approved, and its record of done copies the line.
  const a = statement({ goal: "g", budget: [1000000, 200000] });
  p.put("reviews/rounds/20261101T095500Z-t-statement-1.md", cleanStatementRound("t", a.hash, iso(Date.now() - 60000)));
  const work = p.commit("the goal and version A approved");
  const doneTime = iso(Date.now() - 40000);
  p.put(`reviews/tasks/${doneTime.replace(/[-:]/g, "")}-t-done.md`, ["Record: done", "Task: t", `Commit: ${work}`, `Statement-hash: ${a.hash}`, "Goal: g", "Budget-new-input: 1000000", "Budget-output: 200000", "Budget-reserve: 1.5", `Time: ${doneTime}`, "Checks:", "- true · pass", ""].join("\n"));
  p.commit("done of A");
  // Version B, revised, with no line Goal: and limits of its own.
  const b = statement({ budget: [3000000, 700000], extra: "Revised, out of the goal.\n\n" });
  const L = logs();
  L.claudeSession("exec-1", [{ user: "work on t", time: iso(Date.now() - 30000) }]);
  const env = L.env();
  const br = p.tool("round.mjs", ["brief", "t", "--step", "statement", "--statement", b.file], env);
  assert.equal(br.code, 0, br.out);
  assert.doesNotMatch(br.out, /^Goal:/m, br.out);
  const lines = briefLines(br.out);
  const soon = (s) => iso(Date.now() + s * 1000);
  L.codexSession("rev-b", [{ user: `${lines}\n\nReview the statement of task t.`, time: soon(1) }, { input: 400, cached: 0, out: 40, time: soon(2) }]);
  const before = inputsOf(p);
  // Recorded as docs/parts/agent-rules.md gives it, with no statement, and no goal's statement in the environment.
  const r = p.tool("round.mjs", ["record", "t", "--from", writeReply(lines, "By: gpt (OpenAI, Codex)")], env);
  assert.equal(r.code, 0, r.out);
  const round = readdirSync(join(p.dir, "reviews/rounds")).find((f) => f.includes("-t-statement-2"));
  assert.ok(round, readdirSync(join(p.dir, "reviews/rounds")).join(", "));
  const recordText = readFileSync(join(p.dir, "reviews/rounds", round), "utf8");
  assert.match(recordText, new RegExp(`^Statement-hash: ${b.hash}$`, "m"));
  const snap = recordText.match(/^Spend-record: (\S+)$/m)[1];
  const text = readFileSync(join(p.dir, "reviews/tasks", snap), "utf8");
  assert.match(text, /^Unit: t$/m);
  assert.match(text, /^Unit-limit-new: 3000000$/m);
  assert.match(text, new RegExp(`^Unit-statement-hash: ${b.hash}$`, "m"));
  assert.doesNotMatch(text, new RegExp(gst.hash));
  // The readers with no file: the kept brief of B decides, not A's record of done.
  const pending = [{ task: "t", step: "statement-review", briefTime: lines.match(/^Brief-time: (\S+)$/m)[1], brief: Object.fromEntries(lines.split("\n").map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()])) }];
  assert.deepEqual(goalLineOf({ task: "t", version: b.hash, pending, done: before.records.done, snapshots: before.records.snapshots }), { line: null, of: "the kept brief of t, statement-review" });
  assert.deepEqual(goalLineOf({ task: "t", version: a.hash, pending, done: before.records.done, snapshots: before.records.snapshots }).line, "g");
  // After the round, with the brief used, B's snapshot decides: --rounds counts t as its own unit.
  p.commit("the round of B");
  const rounds = p.tool("ont-check.mjs", ["--rounds"], env);
  assert.match(rounds.out, /^SPEND t: from the session logs since \S+: task t new input 400 of 3000000 × 1\.5 = 4500000, output 40 of 700000 × 1\.5 = 1050000$/m);
  assert.equal(spendOf({ cfg: p.config(), task: "t", inputs: inputsOf(p), env }).unit, "t");
});

test("[check.spend-snapshot.no-logs-project] a project that does not count spend from the logs records done with no logs, with its seal", () => {
  const { p, st } = approved({ fromLogs: false });
  const r = p.tool("done.mjs", ["t", "--statement", st.file]);
  assert.equal(r.code, 0, r.out);
  const f = readdirSync(join(p.dir, "reviews/tasks")).find((x) => x.endsWith("-t-done.md"));
  assert.equal(sealState(readFileSync(join(p.dir, "reviews/tasks", f), "utf8")).state, "valid");
  assert.deepEqual(inputsOf(p).records.malformed, []);
});

test("[check.review-round.payoff-by-identity] the payoff sums the tokens of each round by its full identity, never mixing a round of the statement with one of the result of the same number", () => {
  const rounds = [];
  for (let i = 0; i < 10; i++)
    for (const step of ["statement-review", "result-review"])
      rounds.push({ task: `t${i}`, step, narrow: false, number: 1, time: at(i), file: `${i}-${step}`, findings: [], tokens: { new: null, cached: null, out: null }, spendRecord: `${i}-${step}-snap` });
  const sums = { "statement-review": { new: 1, cached: 2, out: 3 }, "result-review": { new: 100, cached: 200, out: 300 } };
  const p = stepPayoff(rounds, { tokensOf: (r) => sums[r.step] });
  assert.deepEqual(p.find((x) => x.step === "statement-review").tokens, { new: 10, cached: 20, out: 30, unknown: { new: 0, cached: 0, out: 0 } });
  assert.deepEqual(p.find((x) => x.step === "result-review").tokens, { new: 1000, cached: 2000, out: 3000, unknown: { new: 0, cached: 0, out: 0 } });
});

// ── A run outside a review ────────────────────────────────────────────────────────────────────────

const EXAMPLE = join(TOP, "example");
const RUN_CHECK = "check.loan.overdue-in-real-time";
function exampleCopy() {
  const dir = temp("ont-example-");
  cpSync(EXAMPLE, dir, { recursive: true, filter: (src) => !src.startsWith(join(EXAMPLE, "releases")) });
  const git = (...a) => spawnSync("git", ["-C", dir, ...a], { encoding: "utf8", env: GIT_ENV }).stdout.trim();
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-q", "-m", "the copy");
  const check = (...args) => {
    const r = spawnSync(process.execPath, [join(TOOLS, "ont-check.mjs"), "--config", join(dir, "ont.config.json"), ...args], { encoding: "utf8", env: GIT_ENV });
    return { code: r.status, out: r.stdout + r.stderr };
  };
  return { dir, git, check };
}
const notCurrent = (out) => (out.match(/(info|ERROR) · checks of review or run of implemented concepts with no current record \(\d+\):\n((?: {2}.*\n)+)/)?.[2] ?? "").includes(RUN_CHECK);

test("[check.manual-run.run-handoff] a run outside a review is recorded on its committed state, stays current and is carried until a change outside the records, and is refused after a change between its start and its record", () => {
  const e = exampleCopy();
  writeFileSync(join(e.dir, "app/library.mjs"), `${readFileSync(join(e.dir, "app/library.mjs"), "utf8")}\n// a change the review reads\n`);
  e.git("add", "-A");
  e.git("commit", "-q", "-m", "a change of the code");
  const args = ["--verdict", "pass", "--performer", "agent", "--by", "an agent (a provider)", "--evidence", "notes kept outside"];
  assert.match(e.check("--run-start", RUN_CHECK).out, /RUN check\.loan\.overdue-in-real-time: started on/);
  const rec = e.check("--run-record", RUN_CHECK, ...args);
  assert.match(rec.out, /RECORDED the run of check\.loan\.overdue-in-real-time/);
  const file = readdirSync(join(e.dir, "verify/runs")).find((f) => f.includes(RUN_CHECK));
  const text = readFileSync(join(e.dir, "verify/runs", file), "utf8");
  assert.equal(sealState(text).state, "valid");
  assert.match(text, /^Origin: run$/m);
  assert.match(text, new RegExp(`^Commit: ${e.git("rev-parse", "HEAD")}$`, "m"));
  assert.ok(!notCurrent(e.check().out), "current after the run");
  // Committed in the example's own directory of verdicts, it stays current.
  e.git("add", "-A");
  e.git("commit", "-q", "-m", "the record of the run");
  assert.ok(!notCurrent(e.check().out), "current after its commit in verify/runs");
  // Carried by the review while nothing outside the records changed.
  const review = e.check("--review", "HEAD~2");
  assert.match(review.out, new RegExp(`CARRY ${RUN_CHECK.replaceAll(".", "\\.")}: ${file}`));
  // A change of the mockup: no longer current, in the full check too, and not carried.
  const mockup = readdirSync(join(e.dir, "mockup")).find((f) => f.endsWith(".html"));
  writeFileSync(join(e.dir, "mockup", mockup), `${readFileSync(join(e.dir, "mockup", mockup), "utf8")}\n<!-- changed -->\n`);
  assert.ok(notCurrent(e.check().out), "not current after the mockup changed");
  assert.doesNotMatch(e.check("--review", "HEAD~2").out, /^CARRY /m);
  e.git("checkout", "--", ".");
  // A change not committed since the start, and a commit of a fix since it, are refused.
  e.check("--run-start", RUN_CHECK);
  writeFileSync(join(e.dir, "app", "fix.mjs"), "// a fix\n");
  assert.match(e.check("--run-record", RUN_CHECK, ...args).out, /changed outside the records: the run is not of one state/);
  assert.match(e.check("--run-start", RUN_CHECK).out, /the working copy differs from HEAD outside the records/);
  e.git("add", "-A");
  e.git("commit", "-q", "-m", "a fix");
  e.check("--run-start", RUN_CHECK);
  writeFileSync(join(e.dir, "app", "fix.mjs"), "// another fix\n");
  e.git("add", "-A");
  e.git("commit", "-q", "-m", "another fix");
  assert.match(e.check("--run-record", RUN_CHECK, ...args).out, /changed outside the records: the run is not of one state/);
});

// ── The owner's approval and answer to a gate ────────────────────────────────────────────────────

// A registry's command: prints the entry of the question it is given from a file of entries.
function registry(entries) {
  const d = temp("ont-registry-");
  writeFileSync(join(d, "entries.json"), JSON.stringify(entries));
  writeFileSync(join(d, "registry.mjs"), `import { readFileSync } from "node:fs";\nconst e = JSON.parse(readFileSync(${JSON.stringify(join(d, "entries.json"))}, "utf8"))[process.argv[2]];\nif (!e) process.exit(1);\nconsole.log(JSON.stringify(e));\n`);
  return `${process.execPath} ${join(d, "registry.mjs")}`;
}

test("[check.owner-approval.by-registry] no answer, an answer of another version, a gate with no round and an option that does not approve are refused; an approval and an answer to a gate are written from the registry, with the limits and the reserve of the version", () => {
  const p = project({ fromLogs: false });
  const st = statement();
  p.put("reviews/rounds/20261101T100000Z-t-statement-1.md", ["Task: t", "Step: statement-review", "Number: 1", `Time: ${at(0)}`, "By: m (p)", `Statement-hash: ${st.hash}`, "Findings:", "- a choice · important · change · not fixable", ""].join("\n"));
  p.commit();
  const opts = [{ key: "a", meaning: "approve" }, { key: "b", meaning: "reject" }];
  const h = st.hash.slice(0, 12);
  const cmd = registry({
    1: { question: `Approve task t, version ${h}?`, options: opts },
    2: { question: `Approve task t, version 000000000000?`, options: opts, answer: { by: "owner", date: "2026-11-22", option: "a" } },
    3: { question: `Approve task t, version ${h}?`, options: opts, answer: { by: "owner", date: "2026-11-22", option: "b" } },
    4: { question: `Approve task t, version ${h}?`, options: opts, answer: { by: "owner", date: "2026-11-22", option: "a" } },
    5: { question: "Task t: the gate of 20261101T100000Z-t-statement-1.md", options: [{ key: "a", meaning: "answer" }], answer: { by: "owner", date: "2026-11-23", option: "a" } },
  });
  const english = writeFile("yes, approve it");
  const approve = (...a) => p.tool("approve.mjs", ["t", "--statement", st.file, "--english", english, ...a], { ONT_REGISTRY_CMD: cmd });
  assert.match(approve("--question", "1", "--kind", "approval").out, /no answer of the owner to question 1/);
  assert.match(approve("--question", "2", "--kind", "approval").out, /does not name version/);
  assert.match(approve("--question", "5", "--kind", "gate").out, /give --round FILE/);
  assert.match(approve("--question", "3", "--kind", "approval").out, /means reject: it does not approve the version/);
  assert.match(p.tool("approve.mjs", ["t", "--statement", st.file, "--english", english, "--question", "4", "--kind", "approval"]).out, /gives no ONT_REGISTRY_CMD/);
  assert.equal(readdirSync(join(p.dir, "reviews/tasks")).filter((f) => f.endsWith(".md")).length, 0);
  const ok = approve("--question", "4", "--kind", "approval");
  assert.equal(ok.code, 0, ok.out);
  const gate = approve("--question", "5", "--kind", "gate", "--round", "reviews/rounds/20261101T100000Z-t-statement-1.md");
  assert.equal(gate.code, 0, gate.out);
  const inputs = inputsOf(p);
  assert.deepEqual(inputs.records.malformed, []);
  const [a, g] = inputs.records.approvals.sort((x, y) => x.kind.localeCompare(y.kind));
  assert.equal(a.kind, "approval");
  // Each record carries the limits and the reserve of the version it names (field.owner-approval.budget).
  assert.deepEqual(a.budget, { newInput: 1000, output: 1000, reserve: 1.5 });
  assert.deepEqual(g.budget, { newInput: 1000, output: 1000, reserve: 1.5 });
  assert.equal(a.source, 'question 4, answered 2026-11-22, option a: "yes, approve it" (translated from Russian)');
  assert.equal(g.kind, "gate");
  assert.equal(g.round, "20261101T100000Z-t-statement-1.md");
  for (const f of readdirSync(join(p.dir, "reviews/tasks")).filter((x) => x.endsWith(".md"))) assert.equal(sealState(readFileSync(join(p.dir, "reviews/tasks", f), "utf8")).state, "valid");
  assert.equal(approvedHash(inputs.rounds, "t", null, inputs.records.approvals), st.hash);
});

// ── Gate records ──────────────────────────────────────────────────────────────────────────────────

test("[check.gate-change.writer] one sealed record per item covers the gate paths and passes the guard; an unknown item and a path off the diff are refused; --refresh adds records on the new commit and keeps the old", () => {
  const { p, st } = approved();
  p.git("checkout", "-q", "-b", "work");
  p.put("tools/ont-check/extra.mjs", "// item 1\n");
  p.put(".github/workflows/ont-check.yml", `${readFileSync(join(p.dir, ".github/workflows/ont-check.yml"), "utf8")}# item 2\n`);
  p.commit("gate paths");
  const change = (...a) => p.tool("gate-record.mjs", ["change", "t", "--statement", st.file, "--base", "main", ...a]);
  assert.match(change("--clause", "9", "--paths", "tools/ont-check/extra.mjs").out, /has no item 9: its items are 1, 2, 3/);
  assert.match(change("--clause", "1", "--paths", "tools/ont-check/lib.mjs").out, /tools\/ont-check\/lib\.mjs is not a gate path the diff of the branch from main changes/);
  const one = change("--clause", "1", "--paths", "tools/ont-check/extra.mjs");
  assert.equal(one.code, 0, one.out);
  assert.match(one.out, /UNCOVERED gate paths of the diff no record of t names yet: \.github\/workflows\/ont-check\.yml/);
  const two = change("--clause", "2", "--paths", ".github/workflows/ont-check.yml");
  assert.equal(two.code, 0, two.out);
  assert.doesNotMatch(two.out, /UNCOVERED/);
  p.commit("records");
  let g = guard({ cfg: p.config(), base: p.git("rev-parse", "main"), head: p.git("rev-parse", "HEAD") });
  assert.deepEqual(g.refused, []);
  assert.deepEqual(g.records, []);
  // A page changed after the records: the old records bind to an earlier commit; --refresh writes new ones.
  p.put("help/page.md", "a change of a page\n");
  p.commit("a page");
  g = guard({ cfg: p.config(), base: p.git("rev-parse", "main"), head: p.git("rev-parse", "HEAD") });
  assert.equal(g.refused.length, 2);
  const before = readdirSync(join(p.dir, "reviews/tasks")).filter((f) => f.includes("gate-change"));
  const texts = before.map((f) => readFileSync(join(p.dir, "reviews/tasks", f), "utf8"));
  const refresh = p.tool("gate-record.mjs", ["change", "t", "--refresh", "--statement", st.file, "--base", "main"]);
  assert.equal(refresh.code, 0, refresh.out);
  const now = readdirSync(join(p.dir, "reviews/tasks")).filter((f) => f.includes("gate-change"));
  assert.equal(now.length, 4);
  assert.deepEqual(before.map((f) => readFileSync(join(p.dir, "reviews/tasks", f), "utf8")), texts);
  const fresh = now.filter((f) => !before.includes(f));
  // One record for each item, on the new commit, written after the earlier ones.
  assert.deepEqual(fresh.map((f) => f.replace(/^\d{8}T\d{6}Z-/, "")).sort(), ["t-gate-change-1.md", "t-gate-change-2.md"]);
  assert.ok(fresh.every((f) => before.every((b) => f.slice(0, 16) > b.slice(0, 16))));
  assert.ok(fresh.every((f) => readFileSync(join(p.dir, "reviews/tasks", f), "utf8").includes(`Commit: ${p.git("rev-parse", "HEAD")}`)));
  p.commit("records again");
  g = guard({ cfg: p.config(), base: p.git("rev-parse", "main"), head: p.git("rev-parse", "HEAD") });
  assert.deepEqual(g.refused, []);
  assert.deepEqual(g.records, []);
  assert.deepEqual(inputsOf(p).records.malformed, []);
});

// A command of gh api that answers from files: the pull request, its check runs, its workflow runs and
// the log of a job.
function ghStub(answers) {
  const d = temp("ont-gh-");
  writeFileSync(join(d, "answers.json"), JSON.stringify(answers));
  writeFileSync(join(d, "gh.mjs"), `import { readFileSync } from "node:fs";\nconst a = JSON.parse(readFileSync(${JSON.stringify(join(d, "answers.json"))}, "utf8"));\nconst path = process.argv[3];\nconst k = Object.keys(a).find((x) => path.includes(x));\nif (!k) { console.error("no answer for " + path); process.exit(1); }\nprocess.stdout.write(typeof a[k] === "string" ? a[k] : JSON.stringify(a[k]));\n`);
  return `${process.execPath} ${join(d, "gh.mjs")}`;
}

test("[check.gate-proof.writer] a refusal whose check passed, holds another gate's code or has another required check red, and a task not merged, are refused; a refusal of this gate's code alone is written", () => {
  const { p, st } = approved();
  const c = p.git("rev-parse", "HEAD");
  doneRecord(p, c, st, at(10));
  p.commit("done");
  const H = "a".repeat(40);
  const B = "b".repeat(40);
  const answers = (guardConclusion, log, check = "success") => ({
    "pulls/7": { head: { sha: H }, base: { sha: B }, merged: false },
    "check-runs": { check_runs: [{ name: "ont-gate-guard", conclusion: guardConclusion, id: 11 }, { name: "ont-check", conclusion: check, id: 12 }] },
    "actions/runs": { workflow_runs: [{ name: "ont-gate-guard", id: 99, html_url: "https://github.com/o/r/actions/runs/99" }] },
    "jobs/11/logs": log,
  });
  const response = writeFile(JSON.stringify({ message: "Repository rule violations found. Required status check \"ont-gate-guard\" is failing." }));
  const proof = (a) => p.tool("gate-record.mjs", ["proof", "t", "--gate", "t", "--check", "ont-gate-guard", "--pr", "7", "--kind", "refusal", "--repo", "o/r", "--response", response], { ONT_GH_CMD: ghStub(a) });
  assert.match(proof(answers("success", "GATE_OK")).out, /ended success on the head, not failure/);
  assert.match(proof(answers("failure", "CODE SEAL_MISSING\nCODE GATE_PATH_UNAPPROVED\nGATE_REFUSED")).out, /holds GATE_PATH_UNAPPROVED, a code of another rule/);
  assert.match(proof(answers("failure", "CODE SEAL_MISSING\nGATE_REFUSED", "failure")).out, /the other required checks are not all green on the head: ont-check failure/);
  const ok = proof(answers("failure", "CODE SEAL_MISSING\nGATE_REFUSED"));
  assert.equal(ok.code, 0, ok.out);
  const f = readdirSync(join(p.dir, "reviews/tasks")).find((x) => x.endsWith("-t-gate-proof.md"));
  const text = readFileSync(join(p.dir, "reviews/tasks", f), "utf8");
  assert.equal(sealState(text).state, "valid");
  assert.match(text, new RegExp(`^Head: ${H}$`, "m"));
  assert.match(text, /^Run: 99 · https:\/\/github\.com\/o\/r\/actions\/runs\/99$/m);
  assert.deepEqual(inputsOf(p).records.malformed, []);
  // A task with no record of done on main: not merged.
  const q = approved();
  assert.match(q.p.tool("gate-record.mjs", ["proof", "t", "--gate", "t", "--check", "ont-gate-guard", "--pr", "7", "--kind", "refusal", "--repo", "o/r", "--response", response], { ONT_GH_CMD: ghStub(answers("failure", "CODE SEAL_MISSING")) }).out, /the task t is not merged/);
});

test("[check.gate-proof.checked-base] a pass records the first parent of its merge commit, not the base read back after the merge, and is refused when that parent is not an ancestor of the head; a refusal records the base it is given", () => {
  const { p, st } = approved();
  doneRecord(p, p.git("rev-parse", "HEAD"), st, at(10));
  p.commit("done");
  const [H, CHECKED, LATER, M] = ["a", "c", "d", "e"].map((x) => x.repeat(40));
  const answers = ({ status = "ahead", parents = [CHECKED, H], kind = "pass" } = {}) => ({
    "pulls/7": { head: { sha: H }, base: { sha: LATER }, merged: kind === "pass", merge_commit_sha: kind === "pass" ? M : null },
    "check-runs": { check_runs: [{ name: "ont-gate-guard", conclusion: kind === "pass" ? "success" : "failure", id: 11, check_suite: { id: 5 } }, { name: "ont-check", conclusion: "success", id: 12, check_suite: { id: 6 } }] },
    "actions/runs": { workflow_runs: [{ name: "ont-check", id: 98, check_suite_id: 6, html_url: "https://github.com/o/r/actions/runs/98" }, { name: "guard", id: 99, check_suite_id: 5, html_url: "https://github.com/o/r/actions/runs/99" }] },
    "jobs/11/logs": kind === "pass" ? "GATE_OK" : "CODE SEAL_MISSING\nGATE_REFUSED",
    [`commits/${M}`]: { sha: M, parents: parents.map((sha) => ({ sha })) },
    [`compare/${CHECKED}...${H}`]: { status },
  });
  const proof = (a, extra = []) => p.tool("gate-record.mjs", ["proof", "t", "--gate", "t", "--check", "ont-gate-guard", "--pr", "7", "--repo", "o/r", ...extra], { ONT_GH_CMD: ghStub(a) });
  const written = () => readdirSync(join(p.dir, "reviews/tasks")).filter((x) => /-t-gate-proof(-\d+)?\.md$/.test(x)).sort();
  const behind = proof(answers({ status: "diverged" }), ["--kind", "pass"]);
  assert.equal(behind.code, 1, behind.out);
  assert.match(behind.out, /the first parent of the merge, cccccccccccc, is not an ancestor of the head aaaaaaaaaaaa \(diverged\)/);
  assert.match(proof(answers({ parents: [CHECKED, LATER] }), ["--kind", "pass"]).out, /is not a merge of the head aaaaaaaaaaaa into main/);
  assert.deepEqual(written(), []);
  const ok = proof(answers(), ["--kind", "pass"]);
  assert.equal(ok.code, 0, ok.out);
  const text = readFileSync(join(p.dir, "reviews/tasks", written()[0]), "utf8");
  assert.equal(sealState(text).state, "valid");
  assert.match(text, new RegExp(`^Base: ${CHECKED}$`, "m"));
  assert.doesNotMatch(text, new RegExp(LATER));
  assert.match(text, new RegExp(`^Merge: ${M}$`, "m"));
  assert.match(text, /^Run: 99 · https:\/\/github\.com\/o\/r\/actions\/runs\/99$/m);
  // A refusal records the base read before main moved on, given with --base.
  const response = writeFile(JSON.stringify({ message: "Repository rule violations found. Required status check \"ont-gate-guard\" is failing." }));
  const refusal = proof(answers({ kind: "refusal" }), ["--kind", "refusal", "--response", response, "--base", CHECKED]);
  assert.equal(refusal.code, 0, refusal.out);
  const r = written().map((f) => readFileSync(join(p.dir, "reviews/tasks", f), "utf8")).find((x) => /^Kind: refusal$/m.test(x));
  assert.match(r, new RegExp(`^Base: ${CHECKED}$`, "m"));
  assert.match(proof(answers(), ["--kind", "pass", "--base", CHECKED]).out, /a pass takes its base from the first parent of its merge commit/);
  assert.deepEqual(inputsOf(p).records.malformed, []);
});

// ── The usual path ────────────────────────────────────────────────────────────────────────────────

test("[check.process-record.usual-path] rounds, a verdict, done, the owner's approval and answer to a gate, spend, a gate change and a gate proof written by the tool for a task of a goal pass the guard and the full check", () => {
  // Main with the key of seals, merged in, so that every record of the pull request needs its seal; the task
  // t is a task of the goal g, whose statement is approved on main, as in this repository.
  const p = project({ fromLogs: true, goals: { g: ["t"] } });
  const gst = statement({ budget: [20000000, 20000000] });
  p.put("reviews/rounds/20261101T095000Z-g-statement-1.md", cleanStatementRound("g", gst.hash, iso(Date.now() - 60000)));
  p.commit("the goal approved");
  p.git("checkout", "-q", "-b", "key");
  const c = JSON.parse(readFileSync(join(p.dir, "ont.config.json"), "utf8"));
  c.records.sealsFrom = true;
  p.put("ont.config.json", JSON.stringify(c, null, 2));
  p.commit("the key");
  p.git("checkout", "-q", "main");
  p.git("merge", "-q", "--no-ff", "-m", "merge the key", "key");
  const base = p.git("rev-parse", "HEAD");
  p.git("checkout", "-q", "-b", "task");
  const st = statement({ goal: "g", budget: [10000000, 10000000] });
  const L = logs();
  L.claudeSession("exec-1", [{ user: "work on t", time: iso(Date.now() - 1000) }]);
  const env = L.env({ ONT_GOAL_STATEMENT: gst.file });
  const soon = (s) => iso(Date.now() + s * 1000);
  // A round of the statement with a finding of a choice not fixable, by the writer, then the owner's
  // answer to its gate and his approval, from the registry.
  const sb = p.tool("round.mjs", ["brief", "t", "--step", "statement", "--statement", st.file], env);
  assert.equal(sb.code, 0, sb.out);
  const sl = briefLines(sb.out);
  L.codexSession("rev-s", [{ user: sl, time: soon(1) }, { input: 100, cached: 0, out: 10, time: soon(2) }]);
  const sr = p.tool("round.mjs", ["record", "t", "--from", writeReply(sl, "By: m (p)\n\n| a choice | important | change |"), "--triage", writeFile("a choice · not fixable\n")], env);
  assert.equal(sr.code, 0, sr.out);
  const round = readdirSync(join(p.dir, "reviews/rounds")).find((f) => f.includes("-t-statement-1"));
  const h = st.hash.slice(0, 12);
  const cmd = registry({
    8: { question: `Task t: the gate of ${round}`, options: [{ key: "a", meaning: "answer" }], answer: { by: "owner", date: "2026-11-23", option: "a" } },
    9: { question: `Approve task t, version ${h}?`, options: [{ key: "a", meaning: "approve" }], answer: { by: "owner", date: "2026-11-23", option: "a" } },
  });
  const english = writeFile("yes");
  assert.equal(p.tool("approve.mjs", ["t", "--statement", st.file, "--english", english, "--question", "8", "--kind", "gate", "--round", round], { ONT_REGISTRY_CMD: cmd }).code, 0);
  assert.equal(p.tool("approve.mjs", ["t", "--statement", st.file, "--english", english, "--question", "9", "--kind", "approval"], { ONT_REGISTRY_CMD: cmd }).code, 0);
  // The work: a gate path changed, then the run of a check of run, then done.
  p.put("tools/ont-check/extra.mjs", "// the work\n");
  p.put("app/close.mjs", "// ont: action.close\nexport const close = (thing) => ({ ...thing, state: \"closed\" });\n");
  const work = p.commit("the work");
  // The gate change on the last commit outside the records, before any commit of records.
  const gc = p.tool("gate-record.mjs", ["change", "t", "--statement", st.file, "--clause", "1", "--paths", "tools/ont-check/extra.mjs", "--base", base]);
  assert.equal(gc.code, 0, gc.out);
  const run = ["--verdict", "pass", "--performer", "agent", "--by", "an agent (a provider)", "--evidence", "notes kept outside"];
  assert.equal(p.tool("ont-check.mjs", ["--run-start", "check.thing.close-is-clear"]).code, 0);
  const rr = p.tool("ont-check.mjs", ["--run-record", "check.thing.close-is-clear", ...run]);
  assert.match(rr.out, /RECORDED the run/);
  const done = p.tool("done.mjs", ["t", "--statement", st.file], env);
  assert.equal(done.code, 0, done.out);
  p.commit("done");
  // The round of the result, clean: the reviewer gives a verdict to each check --review lists, carrying
  // the run outside the review it names, and the executor records that table with --review --record.
  const rb = p.tool("round.mjs", ["brief", "t", "--step", "result", "--statement", st.file], env);
  assert.equal(rb.code, 0, rb.out);
  const rl = briefLines(rb.out);
  L.codexSession("rev-r", [{ user: rl, time: soon(3) }, { input: 200, cached: 0, out: 20, time: soon(4) }]);
  const listed = p.tool("ont-check.mjs", ["--review", "main"]);
  const ids = [...listed.out.slice(listed.out.indexOf("REVIEW ")).matchAll(/^ {2}(check\.\S+) \[/gm)].map((m) => m[1]);
  assert.ok(ids.includes("check.thing.close-is-clear"), listed.out);
  const carry = new Map([...listed.out.matchAll(/^CARRY (check\.\S+): (\S+),/gm)].map((m) => [m[1], m[2]]));
  assert.ok(carry.has("check.thing.close-is-clear"), listed.out);
  const verdicts = ["| Check | Verdict | Evidence |", "| --- | --- | --- |", ...ids.map((id) => (carry.has(id) ? `| ${id} | carried | ${carry.get(id)} |` : `| ${id} | pass | read in the review |`))];
  const recorded = p.tool("ont-check.mjs", ["--review", "main", "--record", writeFile(["By: m (p)", "", ...verdicts, ""].join("\n"))]);
  assert.match(recorded.out, new RegExp(`RECORDED ${ids.length - carry.size} verdicts, ${carry.size} carried`), recorded.out);
  const rres = p.tool("round.mjs", ["record", "t", "--from", writeReply(rl, ["By: m (p)", "", ...verdicts, "", "Condition: holds", "Acceptance: clean"].join("\n"))], env);
  assert.equal(rres.code, 0, rres.out);
  // Every snapshot of the task is of its goal, with the goal's part and reserve.
  const snaps = readdirSync(join(p.dir, "reviews/tasks")).filter((f) => f.includes("-t-spend-snapshot"));
  assert.equal(snaps.length, 2);
  for (const f of snaps) {
    const text = readFileSync(join(p.dir, "reviews/tasks", f), "utf8");
    assert.match(text, /^Unit: g$/m, f);
    assert.match(text, /^Unit-limit-new: 20000000$/m, f);
    assert.match(text, /^Unit-reserve: 1\.5$/m, f);
  }
  const head = p.commit("the records");
  assert.ok(work);
  // The reviewer's verdicts are among the records the guard and the full check read.
  const reviewed = p.git("diff", "--name-only", base, head, "--", "reviews/runs").split("\n").filter((f) => f.endsWith(".md"));
  assert.equal(reviewed.length, ids.length - carry.size + 1, reviewed.join("\n"));
  const ofReview = reviewed.map((f) => readFileSync(join(p.dir, f), "utf8")).filter((t) => /^Origin: review$/m.test(t));
  assert.equal(ofReview.length, ids.length - carry.size);
  for (const t of ofReview) assert.equal(sealState(t).state, "valid");
  const g = guard({ cfg: p.config(), base, head });
  assert.deepEqual(g.records, []);
  assert.deepEqual(g.refused, []);
  const out = spawnSync(process.execPath, [join(p.dir, "tools/ont-check/merge-gate.mjs"), "guard", "--base", base, "--head", head, "--config", join(p.dir, "ont.config.json")], { encoding: "utf8", env: GIT_ENV });
  assert.match(out.stdout, /^GATE_OK$/m);
  const check = p.tool("ont-check.mjs", []);
  assert.equal(check.code, 0, check.out);
  assert.doesNotMatch(check.out, /records of the process with no valid seal/);
  const task = p.tool("ont-check.mjs", ["--task", "t", "--statement", st.file], env);
  assert.match(task.out, /^NEXT t: done: the last round and its acceptance are clean: merge/m);
  // After the merge, the proof of the gate t, by the writer, in the pull request after it.
  p.git("checkout", "-q", "main");
  p.git("merge", "-q", "--no-ff", "-m", "merge the task", "task");
  const merged = p.git("rev-parse", "HEAD");
  p.git("checkout", "-q", "-b", "next");
  const H = "a".repeat(40);
  const gh = ghStub({
    "pulls/7": { head: { sha: H }, base: { sha: merged }, merged: false },
    "check-runs": { check_runs: [{ name: "ont-gate-guard", conclusion: "failure", id: 11 }, { name: "ont-check", conclusion: "success", id: 12 }] },
    "actions/runs": { workflow_runs: [{ name: "ont-gate-guard", id: 99, html_url: "https://github.com/o/r/actions/runs/99" }] },
    "jobs/11/logs": "CODE SEAL_MISSING\nGATE_REFUSED",
  });
  const response = writeFile(JSON.stringify({ message: "Repository rule violations found. Required status check \"ont-gate-guard\" is failing." }));
  const proof = p.tool("gate-record.mjs", ["proof", "t", "--gate", "t", "--check", "ont-gate-guard", "--pr", "7", "--kind", "refusal", "--repo", "o/r", "--response", response], { ONT_GH_CMD: gh });
  assert.equal(proof.code, 0, proof.out);
  const proofHead = p.commit("the proof");
  const pg = guard({ cfg: p.config(), base: merged, head: proofHead });
  assert.deepEqual(pg.records, []);
  assert.deepEqual(pg.refused, []);
  const after = p.tool("ont-check.mjs", []);
  assert.equal(after.code, 0, after.out);
  assert.doesNotMatch(after.out, /records of the process with no valid seal/);
  assert.equal(inputsOf(p).records.gateProofs.length, 1);
});

// ── Forms of records the next writer writes (D-186) ──────────────────────────────────────────────

const ROUND_CHECKS = "Round-checks: check.review-round.filed-right, check.review-round.whole-class";
const withRoundChecks = (text) => text.replace(/\n$/, `\n${ROUND_CHECKS}\n`);
test("[check.review-round.round-checks-read] a round of the statement with Round-checks:, as the writer of task enforcement-verdicts-tests writes it, approves its version and blocks no task; without a seal after the start of seals the guard refuses it, SEAL_MISSING", () => {
  const p = project({ fromLogs: false });
  const st = statement();
  p.put("reviews/rounds/20261101T100000Z-t-statement-1.md", withRoundChecks(cleanStatementRound("t", st.hash, at(0))));
  p.commit("a round with Round-checks:");
  const inputs = inputsOf(p);
  assert.deepEqual(inputs.malformed, []);
  assert.deepEqual(inputs.rounds[0].roundChecks, ["check.review-round.filed-right", "check.review-round.whole-class"]);
  assert.equal(approvedHash(inputs.rounds, "t", null, inputs.records.approvals), st.hash);
  const next = p.tool("ont-check.mjs", ["--task", "t", "--statement", st.file]);
  assert.match(next.out, /^NEXT t: the executor works under version/m, next.out);
  const rounds = p.tool("ont-check.mjs", ["--rounds"]);
  assert.equal(rounds.code, 0, rounds.out);
  assert.match(rounds.out, /^NEXT t: /m, rounds.out);
  assert.doesNotMatch(rounds.out, /records that cannot be read|BLOCKED|correct the records/, rounds.out);
  // After the start of seals, the same round unsealed is refused by the guard, as any record; sealed it passes.
  const r = gateRepo();
  const base = r.bringKey(at(0));
  const bare = r.pr(base, [(q) => q.put("reviews/rounds/x-t-statement-2.md", withRoundChecks(cleanStatementRound("t", sha256("b"), later(), 2)))]);
  assert.deepEqual(guard({ cfg: r.config(), base: bare.base, head: bare.head }).records.map((x) => x.code), ["SEAL_MISSING"]);
  const ok = r.pr(base, [(q) => q.put("reviews/rounds/x-t-statement-3.md", sealed(withRoundChecks(cleanStatementRound("t", sha256("c"), later(), 3))))]);
  assert.deepEqual(guard({ cfg: r.config(), base: ok.base, head: ok.head }).records, []);
});

const fixesRecord = (lines) => ["Record: fixes", "Task: t", "Round: 20261101T103000Z-t-result-1.md", `Time: ${at(40)}`, ...lines, ""].join("\n");
test("[check.fixes-record.issue-read] a record of fixes with Issue: and no tests, as the writer of task enforcement-verdicts-tests writes it, and one with Issue: and valid tests are read, the tests reaching their round; Issue: that is no commit, neither, and a valid issue beside a wrong line of a test are not", () => {
  const { p, st } = approved();
  const c1 = p.git("rev-parse", "HEAD");
  doneRecord(p, c1, st, at(10));
  p.put("reviews/rounds/20261101T103000Z-t-result-1.md", resultRound({ st, commit: c1, time: at(30), findings: ["- a bug · important · change · fixable"], acceptance: null }));
  p.put("tests/a.test.mjs", "test('holds the bug', () => {});\n");
  p.commit();
  const read = (name, lines) => {
    rmSync(join(p.dir, "reviews/tasks"), { recursive: true, force: true });
    p.put(`reviews/tasks/${name}`, fixesRecord(lines));
    return inputsOf(p);
  };
  const issueOnly = read("20261101T104000Z-t-fixes.md", [`Issue: ${c1}`, "Issue-findings:", "- a stale line", "Filed:", "- a slip · later · issues/0001-a-slip.md"]);
  assert.deepEqual(issueOnly.malformed, []);
  assert.equal(issueOnly.records.fixes[0].issue, c1);
  // A bullet with a tab after its marker, as the reader of records has always read it, is still a test.
  const tab = read("20261101T104000Z-t-fixes.md", ["Tests:", "-\ta bug · tests/a.test.mjs · holds the bug"]);
  assert.deepEqual(tab.malformed, []);
  assert.equal(tab.records.fixes[0].tests[0].test, "holds the bug");
  // A line Tests: in the notes after the head is text, as the reader of records has always read it.
  const notes = read("20261101T104000Z-t-fixes.md", ["Tests:", "- a bug · tests/a.test.mjs · holds the bug", "", "## Notes", "", "Tests: used a local fixture"]);
  assert.deepEqual(notes.malformed, []);
  assert.equal(notes.records.fixes[0].tests.length, 1);
  // A commit in capitals is a commit of seven to forty hexadecimal characters too.
  assert.deepEqual(read("20261101T104000Z-t-fixes.md", [`Issue: ${c1.slice(0, 7).toUpperCase()}`, "Issue-findings:", "- a stale line"]).malformed, []);
  const mixed = read("20261101T104000Z-t-fixes.md", [`Issue: ${c1.slice(0, 7)}`, "Tests:", "- a bug · tests/a.test.mjs · holds the bug"]);
  assert.deepEqual(mixed.malformed, []);
  assert.equal(mixed.rounds.find((x) => x.file === "20261101T103000Z-t-result-1.md").findings[0].test, "tests/a.test.mjs · holds the bug");
  for (const [lines, why] of [
    [["Issue: not-a-commit"], /issue not-a-commit is not a commit/],
    [[], /no line under Tests:/],
    [[`Issue: ${c1}`, "Tests:", "- a bug · tests/a.test.mjs"], /is not "class · file · name"/],
    [[`Issue: ${c1}`, "Tests:", "- a bug · ../outside.mjs · holds the bug"], /is not a path of the repository/],
    // A line under Tests: that is no bullet, alone or after a valid one, is refused beside a valid issue.
    [[`Issue: ${c1}`, "Tests:", "a bug tests/a.test.mjs holds the bug"], /under Tests: is not "- class · file · name"/],
    [[`Issue: ${c1}`, "Tests:", "- a bug · tests/a.test.mjs · holds the bug", "not a line of a test"], /under Tests: is not "- class · file · name"/],
    // Every value of Tests: is read by one grammar: a second header, a line after a blank, a value inline.
    [[`Issue: ${c1}`, "Tests:", "- a bug · tests/a.test.mjs · holds the bug", "Tests:", "- a bug · tests/a.test.mjs"], /Tests: given more than once/],
    [[`Issue: ${c1}`, "Tests:", "- a bug · tests/a.test.mjs · holds the bug", "", "not a line of a test"], /under Tests: is not "- class · file · name"/],
    [[`Issue: ${c1}`, "Tests: a bug · tests/a.test.mjs"], /Tests: holds "a bug · tests\/a\.test\.mjs" on its own line/],
    // A line of a test is exactly class · file · name: a fourth field is refused, Issue: or not.
    [[`Issue: ${c1}`, "Tests:", "- a bug · tests/a.test.mjs · holds the bug · extra"], /has more fields than class · file · name/],
    [["Tests:", "- a bug · tests/a.test.mjs · holds the bug · extra"], /has more fields than class · file · name/],
    // A second Issue: that is no commit is refused, whatever the first.
    [[`Issue: ${c1}`, "Issue: not-a-commit", "Tests:", "- a bug · tests/a.test.mjs · holds the bug"], /Issue: given more than once/],
  ]) {
    const r = read("20261101T104000Z-t-fixes.md", lines);
    assert.match(r.records.malformed.join("\n"), why, lines.join(" / "));
    assert.equal(r.records.fixes.length, 0);
  }
});

test("[check.fixes-record.issue-read] the definition of a record of fixes, in the ontology and in the generated contract, names both forms: its tests, and the one issue with or without tests", () => {
  const row = readFileSync(join(TOP, "ontology.md"), "utf8").split("\n").find((l) => /^\|[^|]*\|\s*`ent\.fixes-record`\s*\|/.test(l));
  assert.ok(row, "the row of ent.fixes-record");
  assert.match(row, /the tests that hold them, or the one issue of verdicts after the narrow round \(`field\.fixes-record\.issue`\) with or without tests, never neither/);
  const schema = readFileSync(join(TOP, "contracts/approach.schema.json"), "utf8");
  assert.match(schema, /the tests that hold them, or the one issue of verdicts after the narrow round \(field\.fixes-record\.issue\) with or without tests, never neither/);
});
