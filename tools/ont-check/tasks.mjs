// A task's statement, its approval, its record of done and its budget (D-152, D-108). The
// statement is a file, often outside the repository, named by its SHA-256; the records of done and of
// the executor's spend are files in the directory the configuration names under taskRecords.
// ont: ent.owner-approval, inv.owner-approval-sourced, field.owner-approval.task, field.owner-approval.by, field.owner-approval.source, field.owner-approval.time, edge.owner-approval.statement, ent.task-statement, field.task-statement.file, field.task-statement.done-when, field.task-statement.budget, derived.approval, derived.statement-state, derived.task-budget, derived.budget-report, derived.task-next, rule.work-under-approval, rule.budget-before-next, rule.no-default-budget, ent.task-result, field.task-result.task, field.task-result.commit, field.task-result.budget, field.task-result.checks, field.task-result.time, edge.task-result.statement, inv.acceptance-after-done, rule.acceptance-against-approved, ent.task-spend, field.task-spend.contribution, field.task-spend.start, field.task-spend.end, field.task-spend.tokens-new, field.task-spend.tokens-cached, field.task-spend.tokens-out, edge.task-spend.task, inv.contributions-apart, inv.named-commits-resolve
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { commitResolves, gitEnv, listFiles, read, unresolvedCommits } from "./lib.mjs";
import { CAUSE_CHECK, outsideRecord } from "./manual-runs.mjs";
import { pendingBriefs } from "./briefs.mjs";
import { logSpend, overspendOf, snapshotSpend, spendLines, spendMarks } from "./spend.mjs";
import { BUDGET_QUESTION, SHA256, TASK_NAME, blockAt, blockLines, blockedSay, byTime, endsStep, gateSay, isClean, isLegacy, nextRound, notFixableIn, parseContribution, parseRounds, realTime } from "./review-rounds.mjs";

export const sha256 = (data) => createHash("sha256").update(data).digest("hex");

// The records of rounds of a project, as the check, --task, --rounds and done.mjs all read them: by one
// function, with the configuration's records.latinOnly and the root of the repository, in which a filed
// finding's file is looked up (D-152), and reviewRounds.gatesFrom, from which a round of the review of the
// result gives its Statement-hash: (every round without the key). top is that root, or "" outside a Git
// repository.
// at: where the guard of the merge gate reads the records of a commit as data (D-185): the directories of
// rounds and of task records copied from Git's objects, the root a filed finding is looked up in, and the
// clone in which the commits records name resolve; by default the configuration's, in the working tree.
export function readRoundRecords(cfg, at = null) {
  const top = at?.top ?? spawnSync("git", ["-C", cfg.base, "rev-parse", "--show-toplevel"], { encoding: "utf8", env: gitEnv() }).stdout?.trim() ?? "";
  return { ...parseRounds(at?.roundsDir ?? cfg.reviewRounds.dir, { latinOnly: cfg.records.latinOnly, root: at?.root ?? (top || null), hashFrom: cfg.reviewRounds.gatesFrom ?? "" }), top };
}

// The lines of a statement the tool reads; the rest of it is for people and the reviewer.
// ont: field.task-statement.gate-paths
export function readStatement(file) {
  const text = readFileSync(file);
  const lines = text.toString("utf8").split("\n");
  const value = (name) => lines.map((l) => l.match(new RegExp(`^${name}:\\s*(.*?)\\s*$`))).filter(Boolean).map((m) => m[1]);
  const number = (name) => {
    const v = value(name)[0];
    return v !== undefined && /^\d+$/.test(v.replaceAll("_", "")) ? Number(v.replaceAll("_", "")) : null;
  };
  const budget = { newInput: number("Budget-new-input"), output: number("Budget-output"), reserve: reserveOf(value("Budget-reserve")[0]) };
  // A line of the budget the statement gives that the tool cannot read: --task names it, rather than
  // stopping by the configuration's number in its place (D-150).
  const wrong = BUDGET_ALL.filter(([k, name]) => value(name)[0] !== undefined && budget[k] === null).map(([, name]) => `${name}: ${value(name)[0]} is not ${name === RESERVE_LINE ? "a number of 1 or more, a whole number or a decimal with a point" : "a whole number"}`);
  // The goal the task is part of, its unit of budget where spend is counted from the logs (D-169).
  const goal = value("Goal")[0] ?? null;
  if (goal !== null && !TASK_NAME.test(goal)) wrong.push(`Goal: ${goal} is not lower-case letters, digits and hyphens`);
  // The gate paths the task may change (field.task-statement.gate-paths, D-185): the lines Gate-paths:, each
  // one or more paths in the syntax of mergeGate.paths, apart by commas or spaces; none without the line.
  const gatePaths = gatePathsOf(value("Gate-paths").join(" "));
  return { file, hash: sha256(text), doneWhen: value("Done-when").filter(Boolean), budget, wrong, goal, gatePaths, text: text.toString("utf8") };
}

// The gate paths of a line, apart by commas or spaces, as a statement, a brief, a round and an approval
// write them (D-185); a record carries them on one line Gate-paths:, apart by ", ".
export const gatePathsOf = (line) => [...new Set(String(line ?? "").split(/[\s,]+/).map((p) => p.replace(/^`|`$/g, "")).filter(Boolean))];
export const gatePathsLine = (paths) => (paths?.length ? [`Gate-paths: ${paths.join(", ")}`] : []);

// The state of spend of a task from the session logs (D-169), by spend.mjs logSpend, with the records the
// check reads; null where the configuration does not set spend.fromLogs. Where the environment gives no
// logs, as in CI, the latest snapshot of spend of the task whose Task-statement-hash: is the version that
// applies, with the inputs that are missing: a reader with no logs compares what the writer saw; with no
// snapshot of that version, none, and the limits are the version's own as versionLimits gives them, the
// configuration's where no record of it holds them, never a snapshot of another version (D-175).
// version is the version of the statement whose limits apply (D-174): round.mjs record gives its brief's;
// given none, the version in force, as --task, round.mjs brief, --rounds and done.mjs read it (versionInForce,
// D-175). The unit is the goal the task's line Goal: names, by goalLineOf, from the statement given or else
// from the task's records of that version, or of another only where none of that version copies the budget,
// or else the task itself (D-179).
// ont: derived.task-budget, derived.log-spend
export function spendOf({ cfg, task, statement = null, version, inputs = null, env = process.env }) {
  if (cfg.spend?.fromLogs !== true) return null;
  const { rounds, records } = inputs ?? readTaskInputs(cfg);
  const pending = pendingBriefs(cfg.base);
  const v = version !== undefined ? version : versionInForce({ rounds, approvals: records.approvals, task, statement, pending });
  const l = versionLimits({ task, version: v, statement, pending, done: records.done, approvals: records.approvals, snapshots: records.snapshots, defaults: cfg.budget });
  const limits = { newInput: l.newInput, output: l.output, reserve: l.reserve, hash: l.version };
  const goalLine = goalLineOf({ task, statement, version: v, pending, done: records.done, snapshots: records.snapshots });
  const sp = logSpend({ cfg, task, goalLine, rounds, pending, limits, approvedOf: (t) => approvedHash(rounds, t, null, records.approvals), readStatementFile: readStatement, env });
  if (sp?.missing?.length && !sp.errors?.length) {
    const snap = (records.snapshots ?? []).filter((x) => x.task === task && v && x.limits?.task?.hash === v).sort(byTimeFile).at(-1);
    if (snap) return { ...snapshotSpend(snap), missing: sp.missing };
  }
  return sp;
}

// What is wrong with the line Overspend: of a round written with a snapshot of spend (D-169): it is the
// text the snapshot it names gives, by its sums and limits, and absent when the snapshot is within them;
// CI, which has no logs, compares it so, and a later spend does not change it.
export function snapshotOverspendProblems(end, snapshots = []) {
  const name = `${end.file}: the record of acceptance`;
  const snap = snapshots.find((x) => x.file === end.spendRecord);
  if (!snap) return [`${name} names the snapshot of spend ${end.spendRecord}, which is not a record of the task records`];
  const want = overspendOf(snapshotSpend(snap));
  if (want && !end.overspend) return [`${name} does not name the overspend its snapshot gives (${want})`];
  if (want && end.overspend !== want) return [`${name} names the overspend as "${end.overspend}", not as its snapshot gives it, "${want}"`];
  if (!want && end.overspend) return [`${name} names an overspend, "${end.overspend}", where its snapshot gives none`];
  return [];
}

// The task's line Goal:, { line, of }, from which goalOf of spend.mjs gives the unit of its budget
// (field.task-statement.goal, D-179): the statement's where a file is given, its line or none. With no file,
// as CI and round.mjs record read, that of the records of version, the version that applies, that copy the
// statement's lines of the budget: its kept brief of the version, or else its latest record of done of it,
// or else its latest snapshot of spend of it, whose Unit: is the goal where it is not the task; the record's
// line decides, and so does its absence, the task's own unit, whatever an older version named. Only where no
// record of the version copies those lines, as for a version whose only record is the owner's approval, the
// latest by time of the task's records of another version that carries a line; line null where none does,
// and the task is its own unit.
export function goalLineOf({ task, statement = null, version = null, pending = [], done = [], snapshots = [] }) {
  if (statement) return { line: statement.goal ?? null, of: "the statement" };
  const briefOf = (b) => ({ line: b.brief.Goal ?? null, time: b.briefTime ?? "", of: `the kept brief of ${task}, ${b.step}` });
  const doneOf = (d) => ({ line: d.goal ?? null, time: d.time, of: `the record of done ${d.file}` });
  const snapOf = (x) => ({ line: x.unit && x.unit !== task ? x.unit : null, time: x.time, of: `the snapshot of spend ${x.file}` });
  const briefs = pending.filter((b) => b.task === task && b.brief);
  const dones = done.filter((d) => d.task === task).sort(byTimeFile);
  const snaps = snapshots.filter((x) => x.task === task).sort(byTimeFile);
  if (version) {
    const own =
      briefs.filter((b) => b.brief["Statement-hash"] === version && b.brief["Budget-new-input"] !== undefined).map(briefOf).at(-1) ??
      dones.filter((d) => d.statementHash === version && d.budget).map(doneOf).at(-1) ??
      snaps.filter((x) => x.limits?.task?.hash === version).map(snapOf).at(-1);
    if (own) return { line: own.line, of: own.of };
  }
  const last = [...briefs.map(briefOf), ...dones.map(doneOf), ...snaps.map(snapOf)].filter((x) => x.line).sort((a, b) => a.time.localeCompare(b.time)).at(-1);
  return last ? { line: last.line, of: last.of } : { line: null, of: "no record" };
}

// The version of a task's statement whose limits apply where the reader reads the task as it stands
// (derived.task-budget, D-174): the version of the approval in force; with none, the file given, the
// version under review; with neither, the version of the task's kept brief, the round under way, or else
// the version its latest round names. null for a task whose records name no version.
export function versionInForce({ rounds = [], approvals = [], task, statement = null, pending = [] }) {
  const approved = approvedHash(rounds, task, null, approvals);
  if (approved) return approved;
  if (statement?.hash) return statement.hash;
  const kept = pending.find((b) => b.task === task && b.brief?.["Statement-hash"]);
  if (kept) return kept.brief["Statement-hash"];
  return rounds.filter((r) => r.task === task && r.statementHash).sort((a, b) => a.time.localeCompare(b.time)).at(-1)?.statementHash ?? null;
}

// The limits and the reserve of one version of a task's statement (derived.task-budget, D-174, D-176): the
// one function every reader asks, given the version that applies to what it reads. They are that version's
// own lines, from the file of that version where it is given, or else as a record of that version copies
// them: the task's kept brief that names the version, with its lines Budget-, its latest record of done of
// the version that carries them, or its latest record of the owner's approval of the version that carries
// them; or else, where none holds the lines, the limits of the task's latest snapshot of spend whose
// Task-statement-hash: is the version, which its writer compared with. A record of another version gives
// nothing. Each limit and the reserve the configuration's where none of these holds it, or the version
// holds none. from says where they came from: statement, brief, done, approval, snapshot or configuration;
// file the record's file. The goal is no part of a version: goalLineOf reads it (D-179).
const byTimeFile = (a, b) => a.time.localeCompare(b.time) || a.file.localeCompare(b.file);
const briefNumber = (v) => (v === undefined || v === "none" || !/^\d+$/.test(v) ? null : Number(v));
export function versionLimits({ task, version, statement = null, pending = [], done = [], approvals = [], snapshots = [], defaults }) {
  const of = (() => {
    if (!version) return null;
    if (statement?.hash === version) return { budget: statement.budget, from: "statement" };
    const b = pending.find((x) => x.task === task && x.brief?.["Statement-hash"] === version && x.brief["Budget-new-input"] !== undefined)?.brief;
    if (b) return { budget: { newInput: briefNumber(b["Budget-new-input"]), output: briefNumber(b["Budget-output"]), reserve: reserveOf(b["Budget-reserve"]) }, from: "brief" };
    const d = done.filter((x) => x.task === task && x.statementHash === version && x.budget).sort(byTimeFile).at(-1);
    if (d) return { budget: d.budget, from: "done", file: d.file };
    const a = approvals.filter((x) => x.task === task && x.statementHash === version && x.budget).sort(byTimeFile).at(-1);
    if (a) return { budget: a.budget, from: "approval", file: a.file };
    const s = snapshots.filter((x) => x.task === task && x.limits?.task?.hash === version).sort(byTimeFile).at(-1);
    if (s) return { budget: s.limits.task, from: "snapshot", file: s.file };
    return null;
  })();
  const own = of?.budget ?? {};
  return { newInput: own.newInput ?? defaults?.newInput ?? null, output: own.output ?? defaults?.output ?? null, reserve: own.reserve ?? defaults?.reserve ?? null, version: version ?? null, from: of?.from ?? "configuration", ...(of?.file ? { file: of.file } : {}) };
}

// The reserve of a statement or of a record of done (field.task-statement.budget, D-150): the multiplier
// of the limits at which the task stops, a number of 1 or more written as a whole number or a decimal
// with a point, such as 1.5; null when the line is not given or cannot be read.
export const RESERVE_LINE = "Budget-reserve";
// At most two decimal digits, as 1.5 or 1.25: the cap is then exact in whole numbers by construction, and
// a reserve such as 1.9300000000000002 is not a reserve but a line the tool cannot read (D-150).
export const reserveOf = (v) => (v !== undefined && v !== null && /^\d+(\.\d{1,2})?$/.test(String(v)) && Number(v) >= 1 ? Number(v) : null);

// The limits of a statement as a record of done carries them (field.task-result.budget, D-147): each a
// whole number or none. done.mjs writes these lines from the statement it read, and the check and
// --rounds, which are given no statement, read the limits from them.
export const BUDGET_LINES = [["newInput", "Budget-new-input"], ["output", "Budget-output"]];
// With the reserve, a line of its own a record of done made before D-150 lacks (D-150).
export const BUDGET_ALL = [...BUDGET_LINES, ["reserve", RESERVE_LINE]];
export const budgetLines = (budget) => BUDGET_ALL.map(([k, name]) => `${name}: ${budget?.[k] ?? "none"}`);

// Every record a task's next action reads, as the check, --task, --rounds and done.mjs all read them, by
// this one function (D-152): the records of rounds by readRoundRecords, the records of done, of spend and
// of approval, and both through resolveRecords, so that a commit a record names and the repository lacks
// counts the same for each. records.done holds only the records of done whose commit resolves.
// A late record (lateRecords) is given to no reader: it is in malformed, which blocks every task.
// at: as readRoundRecords takes it, for the guard of the merge gate, which reads the records at the head of a
// pull request through this same function (D-185).
export function readTaskInputs(cfg, at = null) {
  const { rounds: parsedRounds0, malformed: unreadable, top } = readRoundRecords(cfg, at);
  const parsed = cfg.taskRecords ? parseTaskRecords(at?.tasksDir ?? cfg.taskRecords.dir, { latinOnly: cfg.records.latinOnly }) : { spend: [], done: [], approvals: [], publications: [], gateChanges: [], gateProofs: [], snapshots: [], fixes: [], malformed: [] };
  // The tests of the findings that records of fixes give (D-168), before any reader sees the rounds.
  const withTests = applyFixes(parsedRounds0, parsed.fixes);
  const late = lateRecords({ rounds: withTests, done: parsed.done, approvals: parsed.approvals, gatesFrom: cfg.reviewRounds.gatesFrom ?? null });
  const kept = (x) => !late.some((l) => l.record === x);
  const malformed = [...unreadable, ...late.map((l) => l.text)];
  const resolved = resolveRecords(top, { done: parsed.done.filter(kept), rounds: withTests.filter(kept), approvals: parsed.approvals });
  // A record of done made since the start of the gate of verdicts is read by the rule of the new result
  // (derived.step-end, D-187); one made before it is read as before.
  const from = verdictsStart(top, cfg);
  const done = resolved.done.map((d) => ({ ...d, sinceVerdicts: from !== null && d.time >= from }));
  return { rounds: resolved.rounds, malformed, top, resolved, records: { ...parsed, done, malformed: [...parsed.malformed, ...resolved.malformed] } };
}

// The start of the gate of verdicts (D-187), as the start of seals (D-181): the time of the oldest commit
// of the first-parent history of HEAD, among those that change the configuration, from which on every one
// sets mergeGate.verdicts; null where HEAD's configuration does not set it, or outside Git. The rules of
// D-187 over records that were made before, the new result among them, read those records as before.
// ont: derived.step-end, field.merge-gate.verdicts
export function verdictsStart(top, cfg) {
  if (!top || !cfg?.file) return null;
  const path = relative(top, cfg.file).split("\\").join("/");
  if (path.startsWith("..")) return null;
  const git = (...a) => spawnSync("git", ["-C", top, ...a], { encoding: "utf8", env: gitEnv(), maxBuffer: 1 << 26 });
  const keyAt = (c) => {
    const r = git("show", `${c}:${path}`);
    if (r.status !== 0) return false;
    try {
      return JSON.parse(r.stdout)?.mergeGate?.verdicts === true;
    } catch {
      return false;
    }
  };
  if (!keyAt("HEAD")) return null;
  const log = git("log", "--first-parent", "--format=%H %cI", "HEAD", "--", path);
  if (log.status !== 0) return null;
  let start = null;
  for (const line of log.stdout.split("\n").filter(Boolean)) {
    const [c, time] = line.split(" ");
    if (!keyAt(c)) break;
    start = new Date(time).toISOString().replace(/\.\d{3}Z$/, "Z");
  }
  return start;
}

// The late records of every task (D-152): a round of the review of the result, with its verdict of
// acceptance, or a record of done, that names another version of the statement than the one last
// approved when it ended, or none, and ends after that version's approval. No reader handles one: it is
// a record that cannot be read, which blocks every task until the executor moves or removes it. A
// legacy record (isLegacy), before gatesFrom, is never late: it reads as it did.
export function lateRecords({ rounds, done = [], approvals = [], gatesFrom = null }) {
  const v = (h) => (h ? `version ${h.slice(0, 12)}` : "no version");
  return [...rounds.filter((r) => r.step === "result-review"), ...done].flatMap((record) => {
    if (isLegacy(record, gatesFrom)) return [];
    const w = taskView({ rounds, approvals, task: record.task, before: record.time }).window;
    if (!w || record.statementHash === w.hash || record.time <= w.from) return [];
    return [{ record, text: `${record.file}: a late record: it names ${v(record.statementHash)}, after version ${w.hash.slice(0, 12)} was approved at ${w.from}; move it out of the records or remove it` }];
  });
}

// The limits and the reserve a record of done or of the owner's approval carries (field.task-result.budget,
// field.owner-approval.budget), with what is wrong with its lines: a record made before the lines existed
// carries no limits, budget null (D-147, D-176); one made before the line of the reserve carries none, as one
// whose statement gives none (D-150).
// ont: field.task-result.budget, field.owner-approval.budget
function recordLimits(field) {
  const limits = BUDGET_LINES.map(([k, name]) => [k, name, field(name)]);
  const given = limits.filter(([, , v]) => v !== null);
  const reserveLine = field(RESERVE_LINE);
  const wrong = [
    given.length === 1 && `${given[0][1]} is given without ${limits.find(([, , v]) => v === null)[1]}`,
    ...given.filter(([, , v]) => v !== "none" && !/^\d+$/.test(v)).map(([, name, v]) => `${name.toLowerCase()} ${v} is not a whole number or none`),
    reserveLine !== null && !given.length && `${RESERVE_LINE} is given without the limits`,
    reserveLine !== null && reserveLine !== "none" && reserveOf(reserveLine) === null && `${RESERVE_LINE.toLowerCase()} ${reserveLine} is not a number of 1 or more, or none`,
  ].filter(Boolean);
  const budget = given.length ? { ...Object.fromEntries(limits.map(([k, , v]) => [k, v === "none" ? null : Number(v)])), reserve: reserveOf(reserveLine) } : null;
  return { budget, wrong };
}

// Records of done, of spend, of the owner's approval, of a gate change and of a gate proof, with what is
// wrong with each. opts.latinOnly is the configuration's records.latinOnly: where it is set, a record of
// a gate change or of a gate proof holds only English text and paths of the repository, as a record of a
// round does (D-151, D-158); a record of spend, of done or of approval is read as before, with no rule of
// language (D-162), but for the lines of the evidence of a record of done, held to it there (D-166).
// ont: field.task-result.evidence, rule.records-english-in-repo
// ont: ent.gate-change, field.gate-change.task, field.gate-change.item, field.gate-change.paths, field.gate-change.commit, field.gate-change.time, edge.gate-change.statement, inv.gate-records-well-formed
// ont: ent.gate-proof, field.gate-proof.kind, field.gate-proof.probe, field.gate-proof.result, field.gate-proof.refused-by, field.gate-proof.head, field.gate-proof.base, field.gate-proof.main-after, field.gate-proof.check, field.gate-proof.run, field.gate-proof.required, field.gate-proof.answer, field.gate-proof.merge, field.gate-proof.time, edge.gate-proof.gate
export function parseTaskRecords(dir, { latinOnly = false } = {}) {
  const spend = [];
  const done = [];
  const approvals = [];
  const publications = [];
  const gateChanges = [];
  const gateProofs = [];
  const snapshots = [];
  const fixes = [];
  const malformed = [];
  for (const f of listFiles(dir, /\.md$/)) {
    const text = read(f);
    const field = (name) => text.match(new RegExp(`^${name}:[ \\t]*(.*?)\\s*$`, "m"))?.[1] ?? null;
    const name = basename(f);
    const kind = field("Record");
    const task = field("Task");
    if (kind === "spend") {
      const contribution = parseContribution(field("Contribution"));
      const [start, end] = [field("Start"), field("End")];
      const counts = ["Tokens-new", "Tokens-cached", "Tokens-out"].map((k) => [k, field(k)]);
      const wrong = [
        !task && "no task",
        task && !TASK_NAME.test(task) && `task ${task} is not lower-case letters, digits and hyphens`,
        !contribution && `contribution ${field("Contribution") ?? "(none)"} is not "provider · ID"`,
        !realTime(start) && `start ${start ?? "(none)"} is not a UTC time to the second`,
        !realTime(end) && `end ${end ?? "(none)"} is not a UTC time to the second`,
        realTime(start) && realTime(end) && start > end && `start ${start} is after its end ${end}`,
        ...counts.filter(([, v]) => v !== null && !/^\d+$/.test(v)).map(([k, v]) => `${k.toLowerCase()} ${v} is not a whole number`),
      ].filter(Boolean);
      if (wrong.length) malformed.push(`${name}: ${wrong.join("; ")}`);
      else {
        const n = (k) => (field(k) === null ? null : Number(field(k)));
        spend.push({ file: name, task, contribution, start, end, tokens: { new: n("Tokens-new"), cached: n("Tokens-cached"), out: n("Tokens-out") } });
      }
    } else if (kind === "done") {
      const checks = (blockLines(text, "Checks") ?? []).map((l) => {
        const [command, result] = l.replace(/^-\s*/, "").split(" · ").map((x) => x.trim());
        return { command, result };
      });
      const [commit, hash, time] = [field("Commit"), field("Statement-hash"), field("Time")];
      // What the statement asks the record to name besides the commands, under Evidence: (D-166).
      const evidenceAt = blockAt(text, "Evidence");
      const evidence = (evidenceAt ?? []).map((b) => b.line.replace(/^-\s*/, "").trim());
      // The tests of the records of fixes of the range, each run alone by done.mjs, "- file · name · passed"
      // (field.task-result.fix-tests, D-187).
      // ont: field.task-result.fix-tests
      const fixTests = (blockLines(text, "Fix-tests") ?? []).map((l) => {
        const parts = l.replace(/^-\s*/, "").split(" · ").map((x) => x.trim());
        return { file: parts[0], test: parts.slice(1, -1).join(" · "), result: parts.at(-1) };
      });
      const lim = recordLimits(field);
      const wrong = [
        ...lim.wrong,
        ...fixTests.filter((t) => !t.file || !t.test || t.result !== "passed").map((t) => `the test of a fix "${[t.file, t.test].filter(Boolean).join(" · ")}" is not "file · name · passed"`),
        !task && "no task",
        task && !TASK_NAME.test(task) && `task ${task} is not lower-case letters, digits and hyphens`,
        !/^[0-9a-f]{40}$/.test(commit ?? "") && `commit ${commit ?? "(none)"} is not a full commit`,
        !SHA256.test(hash ?? "") && `statement hash ${hash ?? "(none)"} is not a SHA-256`,
        !realTime(time) && `time ${time ?? "(none)"} is not a UTC time to the second`,
        !checks.length && "no checks",
        ...checks.filter((c) => !c.command || !["pass", "fail"].includes(c.result)).map((c) => `check ${c.command ?? ""} has no result pass or fail`),
        evidenceAt && !evidenceAt.length && "Evidence: has no line under it",
        // The evidence, new text no earlier record carries, holds English only where records do (D-166).
        ...(evidenceAt ?? []).flatMap((b) => outsideOf(b.line, latinOnly).map((p) => p.replace(/^line 1:/, `line ${b.n}:`))),
      ].filter(Boolean);
      if (wrong.length) malformed.push(`${name}: ${wrong.join("; ")}`);
      else {
        const budget = lim.budget;
        // The goal the statement names on Goal:, from which a reader given no file reads the scope of the
        // budget, held to the configuration's goals (goalLineOf, D-179); a record made before the line names none.
        const goal = field("Goal");
        if (goal !== null && !TASK_NAME.test(goal)) malformed.push(`${name}: goal ${goal} is not lower-case letters, digits and hyphens`);
        else done.push({ file: name, task, commit, statementHash: hash, time, checks, budget, evidence, goal, fixTests });
      }
    } else if (kind === "approval" && field("Kind") === "publish") {
      // The owner's permission to publish the work of a goal or of a task (D-185): no version, a scope.
      const g = publicationOf(field);
      if (g.wrong.length) malformed.push(`${name}: ${g.wrong.join("; ")}`);
      else publications.push({ file: name, ...g.record });
    } else if (kind === "approval") {
      // The owner's approval of a version of a statement (D-121): valid only by the owner and with the
      // owner's words it rests on.
      const [hash, by, source, time] = [field("Statement-hash"), field("By"), field("Source"), field("Time")];
      // The limits and the reserve of the version it approves, as approve.mjs copies them (D-176); a record
      // written before the lines carries none and reads as before.
      const lim = recordLimits(field);
      const wrong = [
        ...lim.wrong,
        !task && "no task",
        task && !TASK_NAME.test(task) && `task ${task} is not lower-case letters, digits and hyphens`,
        !SHA256.test(hash ?? "") && `statement hash ${hash ?? "(none)"} is not a SHA-256`,
        by !== "owner" && `by ${by ?? "(none)"}, not by owner: only the owner's approval is recorded so`,
        !source && "no source: the owner's words or answer it rests on, with the date",
        !realTime(time) && `time ${time ?? "(none)"} is not a UTC time to the second`,
      ].filter(Boolean);
      if (wrong.length) malformed.push(`${name}: ${wrong.join("; ")}`);
      // The gate paths the version allows its task to change, as approve.mjs copies them (D-185).
      else approvals.push({ file: name, task, statementHash: hash, by, source, time, kind: field("Kind") ?? "approval", question: field("Question"), round: field("Round"), budget: lim.budget, gatePaths: field("Gate-paths") === null ? null : gatePathsOf(field("Gate-paths")) });
    } else if (kind === "spend-snapshot") {
      const g = snapshotOf(text, name);
      if (g.wrong.length) malformed.push(`${name}: ${g.wrong.join("; ")}`);
      else snapshots.push(g.record);
    } else if (kind === "fixes") {
      const g = fixesOf(text, name);
      if (g.wrong.length) malformed.push(`${name}: ${g.wrong.join("; ")}`);
      else fixes.push(g.record);
    } else if (kind === "gate-change") {
      const g = gateChangeOf(text, name, { latinOnly });
      if (g.wrong.length) malformed.push(`${name}: ${g.wrong.join("; ")}`);
      else gateChanges.push(g.record);
    } else if (kind === "gate-proof") {
      const g = gateProofOf(text, name, { latinOnly });
      if (g.wrong.length) malformed.push(`${name}: ${g.wrong.join("; ")}`);
      else gateProofs.push(g.record);
    } else malformed.push(`${name}: Record ${kind ?? "(none)"} is not spend, spend-snapshot, done, approval, fixes, gate-change or gate-proof`);
  }
  return { spend, done, approvals, publications, gateChanges, gateProofs, snapshots, fixes, malformed };
}

// The owner's permission to publish (ent.publish-permission, D-185): Record: approval with Kind: publish, the
// scope, a goal of the configuration's goals or a task, By: owner, the question of the registry, the source and
// the time; it names no version of a statement and approves none.
// ont: ent.publish-permission, field.publish-permission.scope, field.publish-permission.question, field.publish-permission.by, field.publish-permission.source, field.publish-permission.time
export function publicationOf(field) {
  const [scope, by, question, source, time] = ["Scope", "By", "Question", "Source", "Time"].map(field);
  const wrong = [
    !scope && "no scope: the goal or the task whose work it allows to publish",
    scope && !TASK_NAME.test(scope) && `scope ${scope} is not lower-case letters, digits and hyphens`,
    field("Statement-hash") !== null && "a permission to publish names no version of a statement",
    field("Task") !== null && "a permission to publish names its scope on Scope:, not a task on Task:",
    by !== "owner" && `by ${by ?? "(none)"}, not by owner: only the owner allows to publish`,
    !/^\d+$/.test(question ?? "") && `question ${question ?? "(none)"} is not the number of a question of the registry`,
    !source && "no source: the owner's answer it rests on, with the date",
    !realTime(time) && `time ${time ?? "(none)"} is not a UTC time to the second`,
  ].filter(Boolean);
  return { wrong, record: { kind: "publish", scope, by, question, source, time } };
}

// A snapshot of spend (D-169): the three sums of a unit of budget, of its task and of one round, from the
// session logs at the time a writer ran, with the limits and the reserve they were compared with and the
// versions of the approved statements those came from; round.mjs record writes it with the round, which
// names it on Spend-record:. The file is <time>-<task>-spend-snapshot.md.
// ont: ent.spend-snapshot, field.spend-snapshot.unit, field.spend-snapshot.sums, field.spend-snapshot.limits, field.spend-snapshot.round, edge.spend-snapshot.task, edge.spend-snapshot.round
export const SNAPSHOT_SUMS = ["Unit", "Task", "Round"];
export const SNAPSHOT_COUNTS = ["new", "cached", "out"];
export const SNAPSHOT_LIMITS = ["Unit", "Task"];
export function snapshotOf(text, name) {
  const f = (k) => lineOf(text, k);
  const [task, unit, round, time, start] = ["Task", "Unit", "Round", "Time", "Unit-start"].map(f);
  const sums = Object.fromEntries(SNAPSHOT_SUMS.map((s) => [s.toLowerCase(), Object.fromEntries(SNAPSHOT_COUNTS.map((c) => [c, f(`${s}-${c}`)]))]));
  const limits = Object.fromEntries(
    SNAPSHOT_LIMITS.map((s) => [s.toLowerCase(), { newInput: f(`${s}-limit-new`), output: f(`${s}-limit-out`), reserve: f(`${s}-reserve`), hash: f(`${s}-statement-hash`) }]),
  );
  const wrong = [
    !task && "no task",
    task && !TASK_NAME.test(task) && `task ${task} is not lower-case letters, digits and hyphens`,
    !unit && "no unit",
    unit && !TASK_NAME.test(unit) && `unit ${unit} is not lower-case letters, digits and hyphens`,
    !realTime(time) && `time ${time ?? "(none)"} is not a UTC time to the second`,
    start !== null && start !== "none" && !realTime(start) && `unit start ${start} is not a UTC time to the second or none`,
    ...Object.entries(sums).flatMap(([s, c]) => Object.entries(c).filter(([, v]) => v !== null && !/^\d+$/.test(v)).map(([k, v]) => `${s} ${k} ${v} is not a whole number`)),
    ...Object.values(sums.unit).some((v) => v === null) ? ["the sums of the unit are not all given"] : [],
    ...Object.entries(limits).flatMap(([s, l]) => [
      ...["newInput", "output"].filter((k) => l[k] !== null && l[k] !== "none" && !/^\d+$/.test(l[k])).map((k) => `${s} limit ${l[k]} is not a whole number or none`),
      l.reserve !== null && l.reserve !== "none" && reserveOf(l.reserve) === null && `${s} reserve ${l.reserve} is not a number of 1 or more, or none`,
      l.hash !== null && l.hash !== "none" && !SHA256.test(l.hash) && `${s} statement hash ${l.hash} is not a SHA-256 or none`,
    ]),
  ].filter(Boolean);
  const n = (v) => (v === null ? null : Number(v));
  const lim = (l) => ({ newInput: l.newInput === null || l.newInput === "none" ? null : Number(l.newInput), output: l.output === null || l.output === "none" ? null : Number(l.output), reserve: reserveOf(l.reserve), hash: l.hash === "none" ? null : l.hash });
  return {
    wrong,
    record: {
      file: name, task, unit, round: round === "none" ? null : round, time, start: start === "none" ? null : start,
      sums: Object.fromEntries(Object.entries(sums).map(([s, c]) => [s, c.new === null ? null : { new: n(c.new), cached: n(c.cached), out: n(c.out) }])),
      limits: { unit: lim(limits.unit), task: lim(limits.task) },
    },
  };
}

// A record of fixes has a closed grammar, the one its writers emit (rule.records-by-tool, D-186): an
// optional first line Seal:, then lines of fields of a known set, each at most once, Record:, Task:, Round:,
// Time: and Issue:, then blocks of a known set, each at most once, its name alone on a line and one line
// "- …" or more under it, a space or a tab after the marker: Tests:, "- class · file · name", and those the
// writer of task enforcement-verdicts-tests adds, Issue-findings:, "- class", and Filed:, "- class ·
// limitation or later · file"; blank lines only at its end. Any other line, a heading, a section of notes,
// an unknown field, a block given twice, a value on a block's own line, a line of another form, is refused,
// Issue: or not; a record holds valid tests, a valid issue or both, never neither.
// ont: ent.fixes-record, field.fixes-record.round, field.fixes-record.tests, field.fixes-record.issue, edge.fixes-record.round
const FIXES_FIELDS = ["Record", "Task", "Round", "Time", "Issue"];
const FIXES_BLOCKS = { Tests: 3, "Issue-findings": 1, Filed: 3 };
export function fixesOf(text, name) {
  const lines = text.replace(/\n+$/, "").split("\n");
  const wrong = [];
  const fields = {};
  const blocks = {};
  let i = /^Seal:/.test(lines[0] ?? "") ? 1 : 0;
  for (; i < lines.length; i++) {
    const m = lines[i].match(/^([A-Za-z][A-Za-z-]*):[ \t]*(.*?)\s*$/);
    if (!m || !FIXES_FIELDS.includes(m[1])) break;
    if (m[1] in fields) wrong.push(`line ${i + 1}: ${m[1]}: given more than once`);
    else fields[m[1]] = m[2];
  }
  let open = null;
  for (; i < lines.length; i++) {
    const l = lines[i];
    const head = l.match(/^([A-Za-z][A-Za-z-]*):(.*)$/);
    if (head && head[1] in FIXES_BLOCKS && !head[2].trim()) {
      if (head[1] in blocks) wrong.push(`line ${i + 1}: ${head[1]}: given more than once`);
      open = head[1];
      blocks[open] = blocks[open] ?? [];
    } else if (open && /^-[ \t]/.test(l)) {
      const parts = l.replace(/^-[ \t]+/, "").split(" · ").map((x) => x.trim());
      if (parts.length !== FIXES_BLOCKS[open] || parts.some((x) => !x)) wrong.push(`line ${i + 1}: "${l.trim()}" under ${open}: is not ${open === "Tests" ? '"- class · file · name"' : open === "Filed" ? '"- class · limitation or later · file"' : '"- class"'}`);
      else blocks[open].push(parts);
    } else wrong.push(`line ${i + 1}: "${l.trim()}" is not a line of a record of fixes: a field of ${FIXES_FIELDS.join(", ")}, a block ${Object.keys(FIXES_BLOCKS).join(", ")} or a line "- …" under one`);
  }
  for (const [b, entries] of Object.entries(blocks)) if (!entries.length) wrong.push(`${b}: has no line under it`);
  const { Task: task = null, Round: round = null, Time: time = null, Issue: issue = null } = fields;
  const tests = (blocks.Tests ?? []).map(([cls, file, test]) => ({ cls, file, test }));
  // The blocks the writer of this task adds, read by the same grammar: the classes of the table of findings of
  // the one issue, and the rare findings filed (field.fixes-record.issue, D-187).
  const issueFindings = (blocks["Issue-findings"] ?? []).map(([cls]) => cls);
  const filed = (blocks.Filed ?? []).map(([cls, fix, file]) => ({ cls, fix, file }));
  wrong.push(
    ...[
      fields.Record !== "fixes" && `Record: ${fields.Record ?? "(none)"} is not fixes`,
      !task && "no task",
      task && !TASK_NAME.test(task) && `task ${task} is not lower-case letters, digits and hyphens`,
      !round && "no round: the file of the round whose findings it tests",
      round && !/^[^/\\]+\.md$/.test(round) && `round ${round} is not the file name of a record of a round`,
      !realTime(time) && `time ${time ?? "(none)"} is not a UTC time to the second`,
      !tests.length && issue === null && "no line under Tests:",
      issue !== null && !/^[0-9a-fA-F]{7,40}$/.test(issue) && `issue ${issue || "(none)"} is not a commit of seven to forty hexadecimal characters`,
      ...tests.filter((t) => !repoPath(t.file)).map((t) => `${t.file} is not a path of the repository`),
      // The blocks of the one issue come only with Issue:, as their writer emits them, and a filing is a
      // limitation or for later (D-186).
      ...["Issue-findings", "Filed"].filter((b) => b in blocks && issue === null).map((b) => `${b}: is given without Issue:`),
      ...(blocks.Filed ?? []).filter(([, fix]) => !["limitation", "later"].includes(fix)).map(([cls, fix]) => `the filed line of ${cls} is ${fix}, not limitation or later`),
      ...filed.filter((f) => !["limitation", "later"].includes(f.fix) || !repoPath(f.file)).map((f) => `the filed line "${[f.cls, f.fix, f.file].join(" · ")}" is not "class · limitation or later · file"`),
    ].filter(Boolean),
  );
  return { wrong, record: { file: name, task, round, time, tests, issue, issueFindings, filed } };
}

// The rounds with the tests the records of fixes give (D-168): a finding fixable with no test of its own
// takes the test of the latest record of fixes of its round that names its class, as "file · name".
export function applyFixes(rounds, fixes = []) {
  if (!fixes.length) return rounds;
  return rounds.map((r) => {
    const of = fixes.filter((f) => f.round === r.file && f.task === r.task).sort((a, b) => a.time.localeCompare(b.time));
    if (!of.length) return r;
    const testOf = (cls) => of.flatMap((f) => f.tests).filter((t) => t.cls === cls).at(-1);
    const fill = (x) => (x.fixable && !x.test && testOf(x.cls) ? { ...x, test: `${testOf(x.cls).file} · ${testOf(x.cls).test}` } : x);
    return { ...r, findings: r.findings.map(fill), acceptance: r.acceptance && { findings: r.acceptance.findings.map(fill) } };
  });
}

const FULL_COMMIT = /^[0-9a-f]{40}$/;
const lineOf = (text, name) => text.match(new RegExp(`^${name}:[ \\t]*(.*?)\\s*$`, "m"))?.[1] ?? null;
// A path of the repository as a record names it: relative, with "/" between parts, no part "." or "..".
const repoPath = (p) => Boolean(p) && !p.startsWith("/") && !p.includes("\\") && p.split("/").every((part) => part && part !== "." && part !== "..");
// The text of a record outside the repository's language or tree, where the configuration asks for it.
const outsideOf = (text, latinOnly) => (latinOnly ? outsideRecord(text, 1, { latinOnly }) : []);

// A record of a gate change (D-158): a pull request's change of gate paths, the work of a task under the
// approved version of its statement, named by the item of What to do that allows it, the paths and the
// commit that made it; the file is <time>-<task>-gate-change.md.
export function gateChangeOf(text, name, { latinOnly = false } = {}) {
  const [task, hash, item, commit, time] = ["Task", "Statement-hash", "Item", "Commit", "Time"].map((k) => lineOf(text, k));
  const paths = (blockLines(text, "Paths") ?? []).map((l) => l.replace(/^-\s*/, "").replace(/^`(.*)`$/, "$1").trim());
  const wrong = [
    !task && "no task",
    task && !TASK_NAME.test(task) && `task ${task} is not lower-case letters, digits and hyphens`,
    task && TASK_NAME.test(task) && !new RegExp(`^\\d{8}T\\d{6}Z-${task}-gate-change(?:-[0-9]+){0,2}\\.md$`).test(name) && `the file is not named <time>-${task}-gate-change.md or <time>-${task}-gate-change-<item>.md`,
    !SHA256.test(hash ?? "") && `statement hash ${hash ?? "(none)"} is not a SHA-256`,
    !item && "no item of What to do that allows the change",
    !FULL_COMMIT.test(commit ?? "") && `commit ${commit ?? "(none)"} is not a full commit`,
    !paths.length && "no paths",
    ...paths.filter((p) => !repoPath(p)).map((p) => `path ${p || "(empty)"} is not a path of the repository`),
    !realTime(time) && `time ${time ?? "(none)"} is not a UTC time to the second`,
    ...outsideOf(text, latinOnly),
  ].filter(Boolean);
  return { wrong, record: { file: name, task, statementHash: hash, item, paths, commit, time } };
}

// A record of a gate proof (D-158): a live probe of a gate on GitHub, a refusal or a pass, of a pull
// request or of a push; the file is <time>-<task>-gate-proof.md, by the task whose gate it probes. The
// result agrees with the kind: a refusal, of a pull request or of a push, was refused, and a pass is an
// ordinary merge through the gate, of a pull request, merged. A kind is one of the two by its own name,
// never by a name every object inherits, such as constructor. A refusal for being behind, whose
// Refused-by names the branch up to date with main, out of date or behind, keeps the base read before
// main moved on and the tip of main after, Main-after, as two commits: a base equal to the tip was read
// after main moved on.
export const PROOF_KINDS = { refusal: "refused", pass: "merged" };
export function gateProofOf(text, name, { latinOnly = false } = {}) {
  const f = Object.fromEntries(["Gate", "Kind", "Probe", "Result", "Refused-by", "Head", "Base", "Main-after", "Check", "Run", "Required", "Answer", "Merge", "Time"].map((k) => [k, lineOf(text, k)]));
  const pr = f.Probe?.match(/^pr (\d+)$/);
  const push = f.Probe?.match(/^push (\S+)$/);
  const pair = (v) => /^\S.* · \S+$/.test(v ?? "");
  const runOk = /^\d+ · https:\/\/\S+$/.test(f.Run ?? "");
  const results = ["refused", "merged", "pushed"];
  const kind = Object.hasOwn(PROOF_KINDS, f.Kind ?? "") ? f.Kind : null;
  const probe = pr ? "pr" : push ? "push" : null;
  const expected = kind ? PROOF_KINDS[kind] : null;
  const behind = f.Kind === "refusal" && /up to date|out of date|\bbehind\b/i.test(f["Refused-by"] ?? "");
  const wrong = [
    !f.Gate && "no gate: the task whose gate was probed",
    f.Gate && !TASK_NAME.test(f.Gate) && `gate ${f.Gate} is not lower-case letters, digits and hyphens`,
    f.Gate && TASK_NAME.test(f.Gate) && !new RegExp(`^\\d{8}T\\d{6}Z-${f.Gate}-gate-proof\\.md$`).test(name) && `the file is not named <time>-${f.Gate}-gate-proof.md`,
    !kind && `kind ${f.Kind ?? "(none)"} is not refusal or pass`,
    !probe && `probe ${f.Probe ?? "(none)"} is not "pr <number>" or "push <ref>"`,
    !results.includes(f.Result) && `result ${f.Result ?? "(none)"} is not refused, merged or pushed`,
    expected && results.includes(f.Result) && f.Result !== expected && `result ${f.Result} disagrees with the kind ${kind}, whose result is ${expected}`,
    kind === "pass" && probe === "push" && "a pass is a merge of a pull request, not a push",
    f.Kind === "refusal" && !f["Refused-by"] && "a refusal names no check or rule that refused it",
    f.Kind === "refusal" && !f.Answer && "a refusal has no answer of GitHub",
    behind && !f["Main-after"] && "a refusal for being behind has no Main-after: the tip of main read after it moved on",
    f["Main-after"] && !behind && "Main-after is the tip of main of a refusal for being behind, and this record is none",
    f["Main-after"] && !FULL_COMMIT.test(f["Main-after"]) && `main-after ${f["Main-after"]} is not a full commit`,
    behind && f["Main-after"] && f.Base === f["Main-after"] && "the base is the tip of main after it moved on: it was read after main moved, not before",
    f.Kind === "pass" && !FULL_COMMIT.test(f.Merge ?? "") && `a pass has no merge commit in full (${f.Merge ?? "none"})`,
    ...(pr
      ? [
          !FULL_COMMIT.test(f.Head ?? "") && `head ${f.Head ?? "(none)"} is not a full commit`,
          !FULL_COMMIT.test(f.Base ?? "") && `base ${f.Base ?? "(none)"} is not a full commit`,
          !pair(f.Check) && `check ${f.Check ?? "(none)"} is not "<name> · <result>"`,
          !runOk && `run ${f.Run ?? "(none)"} is not "<number> · <address>"`,
          !pair(f.Required) && `required ${f.Required ?? "(none)"} is not "<name> · <result>"`,
        ]
      : []),
    !realTime(f.Time) && `time ${f.Time ?? "(none)"} is not a UTC time to the second`,
    ...outsideOf(text, latinOnly),
  ].filter(Boolean);
  const record = {
    file: name, gate: f.Gate, kind: f.Kind, probe: f.Probe, result: f.Result, refusedBy: f["Refused-by"], head: f.Head, base: f.Base, mainAfter: f["Main-after"],
    check: f.Check, run: f.Run, required: f.Required, answer: f.Answer, merge: f.Merge, time: f.Time,
  };
  return { wrong, record };
}

// The records whose commits do not resolve in the repository (inv.named-commits-resolve, D-145, D-148),
// by the one test of lib.mjs, sorted by what the record proves. Where its meaning rests on the commit, a
// missing one is an error: a record of done cannot be read and binds no acceptance, so the task is not
// done; the round that would end its task, as endingRound says, names a commit on Commits: that is not
// there, and its acceptance is refused for it by endingWhy, in the check, --task and --rounds alike.
// Every other round, and every manual run, proves what it proves without the commit, which a clone made
// after a rewrite of the history may lack: information, "names a commit this clone does not have". The
// check, --task and --rounds read the records through this: the rounds it gives carry the commits of
// their line Commits: that the repository lacks, as missing.
const hexOf = (range) => (range ?? "").split("..").map((c) => c.trim()).filter((c) => /^[0-9a-f]{7,40}$/.test(c));
export const MISSING_COMMIT = "names a commit this clone does not have";
export function resolveRecords(top, { done = [], rounds = [], runs = [], approvals = [] }) {
  const lacks = (c) => !commitResolves(top, c);
  const where = top ? "" : " (the project is not in a Git repository)";
  const kept = done.filter((d) => commitResolves(top, d.commit));
  const marked = rounds.map((r) => ({ ...r, missing: hexOf(r.commits).filter(lacks) }));
  // The round that would end each task, by the records of done as they are written: a record of done
  // whose own commit is missing is an error of its own, and the round that accepts it is held to its
  // commits too, while --task and --rounds, which read only the records that resolve, refuse it.
  const ending = new Set([...new Set(marked.map((r) => r.task))].map((task) => endingRound({ rounds: marked, done, approvals, task })).filter(Boolean));
  const note = (r, commits) => commits.map((c) => `${r.file}: ${MISSING_COMMIT}, ${c}${where}`);
  const runCommit = (r) => [String(r.commit ?? "").replace(/\+working-tree$/, "")];
  return {
    done: kept,
    rounds: marked,
    malformed: unresolvedCommits(top, done, (d) => [d.commit]),
    problems: [...ending].flatMap((r) => r.missing.map((c) => `${r.file}: ${missingWhy(r.task, c)}${where}`)),
    notes: [...marked.filter((r) => !ending.has(r)).flatMap((r) => note(r, r.missing)), ...runs.flatMap((r) => note(r, runCommit(r).filter(lacks)))],
  };
}
const missingWhy = (task, c) => `the round gives the acceptance of the latest record of done of ${task}, and its line Commits: names commit ${c}, which is not in the repository`;

// The round whose clean verdict of acceptance would end a task (D-148): the last round by time of the
// review of its result, clean on merging and in its acceptance, whose acceptance holds for the latest
// record of done by every rule of acceptanceWhy; null when there is none. The question is answered here
// once: resolveRecords holds only this round to the commits of its line Commits:, and endingWhy, which
// --task, --rounds and the check ask through stepNext, refuses its acceptance when one is missing. A
// round with a finding on merging, or one followed by another round, ends nothing, whatever it names.
// Whether it ends its step is the one end of a step, endsStep (derived.next-round, D-153).
export function endingRound({ rounds, done = [], approvals = [], task, statement = null }) {
  const last = taskView({ rounds, done, approvals, task }).results.at(-1);
  return last && endsStep(last, (r) => !acceptanceWhy(r, rounds, done, statement, { approvals, latest: true })) ? last : null;
}
// Why the acceptance of the last round of the review of a task's result does not end the task, or null:
// acceptanceWhy for the latest record of done, then a commit of its line Commits: that the repository
// does not have, as resolveRecords marked it (D-148).
export function endingWhy(r, { rounds, done = [], approvals = [], statement = null }) {
  const why = acceptanceWhy(r, rounds, done, statement, { approvals, latest: true });
  if (why) return why;
  return r.missing?.length ? `its line Commits: names commit ${r.missing.join(", ")}, which is not in the repository` : null;
}

// Two records of one contribution whose intervals overlap, even in part, or that begin in the same
// second, as two equal intervals do, even of no length (inv.contributions-apart, D-118), of one task or
// of two, with the tasks each names. A record that begins after it ends is malformed and never reaches
// here. The check and every task's budget read these same pairs (D-124).
export function overlapPairs(rounds, spend) {
  const runs = [
    ...rounds.filter((r) => r.contribution && r.start).map((r) => ({ file: r.file, task: r.task, key: r.contribution.key, start: r.start, end: r.time })),
    ...spend.map((s) => ({ file: s.file, task: s.task, key: s.contribution.key, start: s.start, end: s.end })),
  ];
  const out = [];
  runs.forEach((a, i) =>
    runs.slice(i + 1).forEach((b) => {
      if (a.key === b.key && (a.start === b.start || (a.start < b.end && b.start < a.end)))
        out.push({
          tasks: [a.task, b.task],
          text: `${a.file} (${a.start}–${a.end}${a.task === b.task ? "" : `, task ${a.task}`}) and ${b.file} (${b.start}–${b.end}${a.task === b.task ? "" : `, task ${b.task}`}): one contribution, ${a.key}, over intervals that overlap`,
        });
    }),
  );
  return out;
}
export const overlaps = (rounds, spend) => overlapPairs(rounds, spend).map((p) => p.text);

const ofTask = (rounds, task, step) => byTime(rounds.filter((r) => r.task === task && (!step || r.step === step)));

// The owner's records of a task that approve a version and close every gate before them: his approvals,
// never his answers to a gate, each of which closes the gate of the round it names alone and approves no
// version (D-185). A record with no line Kind: is an approval.
export const ownerApprovals = (approvals, task) => approvals.filter((a) => a.task === task && a.kind !== "gate");
export const answeredRounds = (approvals, task) => new Set(approvals.filter((a) => a.task === task && a.kind === "gate" && a.round).map((a) => a.round));

// The events that give or withdraw an approval of a task's statement, by time: each round of the review
// of the statement, and each record of the owner's approval, never his answer to a gate (D-121, D-185). At
// the same second a round comes before an approval, which answers it. Each event carries the gate paths
// its version allows, its line Gate-paths:, or null where it has none (D-185).
export const approvalEvents = (rounds, task, approvals = []) =>
  [
    ...ofTask(rounds, task, "statement-review").map((r) => ({ kind: "round", time: r.time, hash: isClean(r) ? r.statementHash : null, round: r, file: r.file, gatePaths: r.gatePaths ?? null })),
    ...ownerApprovals(approvals, task).map((a) => ({ kind: "approval", time: a.time, hash: a.statementHash, approval: a, file: a.file, gatePaths: a.gatePaths ?? null })),
  ]
    .map((e, i) => ({ ...e, i }))
    .sort((a, b) => a.time.localeCompare(b.time) || (a.kind === b.kind ? a.i - b.i : a.kind === "round" ? -1 : 1));

// The hash of the version under an approval in force (derived.approval, D-121): the last by time of a
// round of the review of the statement and a record of the owner's approval decides: a clean round that
// names the version it read, or the owner's approval of a version, approves that version; a round with
// findings approves none. With a time, the approval in force then: the last such event before it (D-117).
export function approvedHash(rounds, task, before = null, approvals = []) {
  return approvalInForce(rounds, task, before, approvals)?.hash ?? null;
}
// The event of the approval in force, with the gate paths it allows (D-185), or null.
export function approvalInForce(rounds, task, before = null, approvals = []) {
  const last = approvalEvents(rounds, task, approvals)
    .filter((e) => before === null || e.time < before)
    .at(-1);
  return last?.hash ? last : null;
}

// The task view (D-152): the one place every reader of a task takes its records of the result from, the
// branches of its next action, the acceptance, the round that ends it and the commits it
// is held to, the lines of --task, the overspend the check compares, and done.mjs through taskNext; none
// reads the task's rounds of the result or records of done whole. Its current version is the version of
// the approval in force, or, while a later round withdraws it, the version last approved; its window starts at the first of the events at the end of the history that
// approve that version, a clean round of the statement or a record of the owner's approval. A record is
// the view's by its own Statement-hash and its time both (inWindow), never by time alone: every other
// round of the result and record of done of the task is in others, of another version or of an earlier
// window, which --task lists as not read and which count only for the numbers of rounds and the budget.
// A record of another version after the start is late (lateRecords) and never reaches here, so the
// others are records of earlier windows. With no version ever approved, as for a task recorded before
// D-106, every record is read and window is null.
// With before, the view as it stood at that time, from the records before it.
export const inWindow = (rec, w) => Boolean(w) && rec.statementHash === w.hash && rec.time > w.from;
export function taskView({ rounds, done = [], approvals = [], task, before = null }) {
  const at = (x) => before === null || x.time < before;
  const events = approvalEvents(rounds, task, approvals).filter(at);
  const results = ofTask(rounds, task, "result-review").filter(at);
  const records = done.filter((d) => d.task === task && at(d)).sort((a, b) => a.time.localeCompare(b.time));
  const j = events.findLastIndex((e) => e.hash);
  if (j < 0) return { window: null, results, done: records, others: [] };
  const hash = events[j].hash;
  let i = j;
  while (i > 0 && events[i - 1].hash === hash) i--;
  const window = { hash, from: events[i].time, inForce: j === events.length - 1 };
  const own = (x) => inWindow(x, window);
  return {
    window,
    results: results.filter(own),
    done: records.filter(own),
    others: [...results, ...records].filter((x) => !own(x) && x.statementHash).sort((a, b) => a.time.localeCompare(b.time)),
  };
}

// The commit a round reviewed: the commit of its line Commits:, or the last of its range.
export const reviewedCommit = (r) => {
  const c = (r.commits ?? "").split("..").at(-1).trim();
  return /^[0-9a-f]{7,40}$/.test(c) ? c : null;
};

// The range of fixes after the narrow round (rule.fixes-held-by-tests, D-164, D-165): the one function
// that --task, --rounds, done.mjs, --review, the check's current records and merge-gate.mjs records-only
// ask. It rests only on records that exist: in the rounds of the review of the result that the step
// compares, after a round C with Condition: holds, the last round, the narrow round, when it does not end
// the step; it starts after the commit that round reviewed, and ends at the commit of the first record of
// done of the window after it on another commit, every check of it passed and, where the statement's file
// is given, its commands the file's, or, while there is none, at head: the working copy's HEAD, for
// done.mjs the commit it records done on. The state of the narrow round's verdict of acceptance is read
// by the records as they were when it was given (inv.acceptance-after-done). null off the path.
// ont: rule.fixes-held-by-tests
export function fixesRange({ rounds, done = [], approvals = [], task, head = null, statement = null }) {
  const { all, held, view } = resultWindow({ rounds, done, approvals, task });
  const last = all.at(-1);
  if (!last) return null;
  // The window of the last round: the rounds after the end of the step before it (derived.step-end).
  const before = stepEnds({ all, done: view.done, held }).filter((e) => e.time < last.time).at(-1);
  const window = all.filter((r) => !before || r.time > before.time);
  const at = window.findIndex((r) => r.condition);
  if (at < 0 || at === window.length - 1) return null;
  if (endsStep(last, (r) => !endingWhy(r, { rounds, done, approvals, statement }))) return null;
  const from = reviewedCommit(last);
  const why = last.acceptance ? acceptanceWhy(last, rounds, done, null, { approvals }) : null;
  const ran = (d) => d.checks.every((c) => c.result === "pass") && (!statement || sameCommands(d, statement));
  const ends = from ? (view.done.find((d) => d.time > last.time && !d.commit.startsWith(from) && ran(d)) ?? null) : null;
  return { task, c: window[at], narrow: last, from, acceptance: !last.acceptance ? "missing" : why ? "refused" : "held", why, done: ends, end: ends ? ends.commit : head };
}
// The ends of the step of the review of a task's result, in their order (derived.step-end, D-187): the one
// function --task, done.mjs, the guard, the brief, the window of stagnation and the windows of the verdicts
// of the record of a round read, through stepNext, fixesRange and roundWindow. From the start of the
// window, or the end before, the step ends at the first of: a round that ended it, held by the records as
// they were when it was given (endsStep); or, after a round C with Condition: holds and the narrow round
// right after it that did not end it, the first record of done after that narrow round on another commit,
// every check of it passed, which ends the range of fixes. The step's end is the last of them.
// ont: derived.step-end
export function stepEnds({ all, done = [], held = () => true }) {
  const ends = [];
  let from = null;
  for (;;) {
    const win = all.filter((r) => from === null || r.time > from);
    if (!win.length) break;
    const i = win.findIndex((r) => endsStep(r, held));
    const c = win.findIndex((r) => r.condition);
    let end = i >= 0 ? { kind: "round", time: win[i].time, commit: reviewedCommit(win[i]), file: win[i].file, round: win[i] } : null;
    if (c >= 0 && c + 1 < win.length && (i < 0 || i > c + 1)) {
      const n = win[c + 1];
      const f = reviewedCommit(n);
      const d = f ? done.filter((x) => x.time > n.time && !x.commit.startsWith(f) && x.checks.every((k) => k.result === "pass")).sort((a, b) => a.time.localeCompare(b.time) || a.file.localeCompare(b.file))[0] : null;
      if (d && (!end || d.time < end.time)) end = { kind: "done", time: d.time, commit: d.commit, file: d.file, done: d, narrow: n };
    }
    if (!end) break;
    ends.push(end);
    from = end.time;
  }
  return ends;
}
// Whether a commit a record names is the commit of an end, either given in full or abbreviated.
const sameCommit = (a, b) => Boolean(a && b) && (a.startsWith(b) || b.startsWith(a));
// The end of the step of a task's result and the window that is open after it, or that the last end closed
// (derived.step-end, rule.round-verdicts): the rounds after the end before the last one, up to that last end.
export function roundWindow({ rounds, done = [], approvals = [], task }) {
  const { all, held, view } = resultWindow({ rounds, done, approvals, task });
  const ends = stepEnds({ all, done: view.done, held });
  return { all, ends, end: ends.at(-1) ?? null, view };
}

// The checks of the record of a round (rule.round-verdicts, D-187), whose verdicts the reviewer of the next
// round gives on the rounds before it in the open window of the step.
export const ROUND_CHECKS = ["check.review-round.filed-right", "check.review-round.whole-class"];
export const CAUSE_ROUND_CHECK = CAUSE_CHECK;
// The open window of a step of a task (rule.round-verdicts): its rounds after the end of the step, by
// stepEnds for the result, by the last clean round for the statement, and after the owner's last approval;
// from is the time it opens at, or null.
export function openWindow({ rounds, done = [], approvals = [], task, step }) {
  if (step === "result-review") {
    const w = roundWindow({ rounds, done, approvals, task });
    const from = w.end?.time ?? null;
    return { rounds: w.all.filter((r) => from === null || r.time > from), from };
  }
  const since = ownerApprovals(approvals, task).map((a) => a.time).sort().at(-1) ?? null;
  const of = ofTask(rounds, task, "statement-review").filter((r) => since === null || r.time > since);
  const end = of.filter((r) => endsStep(r)).at(-1);
  const from = [since, end?.time].filter(Boolean).sort().at(-1) ?? null;
  return { rounds: of.filter((r) => from === null || r.time > from), from };
}
// A round with a finding of the change, filed or not, which the next round's verdicts of the record of a
// round look back at.
export const hasFindings = (r) => [...r.findings, ...(r.acceptance?.findings ?? [])].some((x) => x.ofChange);
// The failed analyses of the cause a window leaves pending, by the one derivation both the writer of the next
// brief and the guard read (rule.round-verdicts, D-187, D-188, D-190). A fail counts when it is the latest
// verdict of the check given for its round, between that round's brief and its record, the round asking for
// it on Round-checks:, so that a verdict of another task, or one given before the rule, is read as before and
// asks nothing. The latest verdict of the check after the fail decides it, of any kind, given for a round of
// the window or, outside a round, of the one issue (ofIssue), up to until: only a pass on a corrected
// analysis decides it, of a round whose Cause: is another than the failed round's, or of the issue, whose
// evidence names the hash of another analysis; a later fail, a not-run or a not-applicable leaves it failed.
// Only a verdict given is read, never a carry, which the writer refuses for this check: a carried pass was
// given on another analysis than the Cause: of the round it would reach, so it decides nothing (D-191, D-192).
// A verdict is of a round only when that round's brief named an analysis, on Cause:: a verdict of the check in
// a round with no Cause:, listed by its diff alone, read no analysis, and neither clears nor reopens a failed
// one (D-193).
// Each pending fail with its round, the latest verdict after it, and the hash of the analysis it failed.
export function causeFailures(runs, windowRounds = [], { ofIssue = () => false, until = "9999" } = {}) {
  const spanOf = (x) => windowRounds.find((r) => r.cause && r.briefTime && x.time >= r.briefTime && x.time <= r.time);
  const of = runs
    .filter((x) => x.check === CAUSE_ROUND_CHECK && !x.carried && x.time <= until && (spanOf(x) || ofIssue(x)))
    .sort((a, b) => a.time.localeCompare(b.time) || a.file.localeCompare(b.file));
  const pending = [];
  for (const r of windowRounds.filter((r) => r.briefTime && (r.roundChecks ?? []).includes(CAUSE_ROUND_CHECK))) {
    const v = of.filter((x) => spanOf(x) === r).at(-1);
    if (v?.verdict !== "fail") continue;
    const last = of.filter((x) => x.time > v.time).at(-1) ?? null;
    const at = last && spanOf(last);
    const corrected = last?.verdict === "pass" && (at ? Boolean(at.cause) && at.cause !== r.cause : [...String(last.evidence ?? "").matchAll(/\b[0-9a-f]{64}\b/g)].some((m) => m[0] !== r.cause));
    if (!corrected) pending.push({ run: v, round: r, last, analysis: r.cause ?? null });
  }
  return pending;
}
// The latest pending fail of the analysis of the cause in the window, by causeFailures, with the hash of the
// analysis it failed, which the next brief may not give again; null when none is pending.
export function failedCause(runs, windowRounds = [], opts = {}) {
  const f = causeFailures(runs, windowRounds, opts).sort((a, b) => a.run.time.localeCompare(b.run.time) || a.run.file.localeCompare(b.run.file)).at(-1);
  return f ? { ...f.run, analysis: f.analysis } : null;
}

// Whether a record of done ran exactly the statement's commands of done, in their order (D-123).
const sameCommands = (d, statement) => {
  const ran = d.checks.map((c) => c.command);
  const want = statement.doneWhen ?? [];
  return ran.length === want.length && ran.every((c, i) => c === want[i]);
};
// The rounds of the review of a task's result that its step compares (D-152): those of the task view
// after the owner's last approval and the start of the window, and whether an earlier round's acceptance
// held, by the records as they were when it was given. stepNext and fixesRange read them alike.
function resultWindow({ rounds, done = [], approvals = [], task }) {
  const ownerSince = ownerApprovals(approvals, task).map((a) => a.time).sort().at(-1) ?? null;
  const view = taskView({ rounds, done, approvals, task });
  const since = view.window ? [ownerSince, view.window.from].filter(Boolean).sort().at(-1) : ownerSince;
  const all = byTime(view.results).filter((r) => since === null || r.time > since);
  return { all, held: (r) => !acceptanceWhy(r, rounds, done, null, { approvals }), view };
}
// Whether a verdict record given on commit is held by a range of fixes (rule.fixes-held-by-tests, D-165):
// its commit, with no "+working-tree", comes after the commit the narrow round reviewed and is in the
// range's end, and, once a record of done ends the range, the working tree holds that end's files outside
// the directories of records given, so that a stamp changed since was changed by a fix of the range. A Git
// command that fails holds nothing.
export function heldByFixes(top, range, commit, recordDirs = []) {
  const c = String(commit ?? "").replace(/\+working-tree$/, "");
  if (!top || !range?.from || !range.end || !/^[0-9a-f]{7,40}$/.test(c)) return false;
  const git = (...a) => spawnSync("git", ["-C", top, ...a], { encoding: "utf8", env: gitEnv() });
  const ancestor = (a, b) => git("merge-base", "--is-ancestor", a, b).status === 0;
  const full = (x) => git("rev-parse", "--verify", "--quiet", `${x}^{commit}`).stdout.trim();
  if (!full(c) || full(c) === full(range.from) || !ancestor(range.from, c) || !ancestor(c, range.end)) return false;
  if (!range.done) return true;
  const diff = git("diff", "--no-renames", "--name-only", "-z", range.end, "--", ".", ...recordDirs.map((d) => `:!${d}`));
  return diff.status === 0 && diff.stdout === "";
}

// Why a verdict of acceptance is refused, or null (inv.acceptance-after-done, D-117): it follows the
// record of done, which follows the approval in force; the acceptance, the record and that approval
// name one version of the statement, the approval is still in force when the acceptance is given, the
// record's commit is the one the round reviewed, and, when the statement's file is given, its version
// is the file's and the record's commands are exactly its commands of done (D-123).
// With latest, as the state of a task reads it, the acceptance must be of the latest record of done: a
// record of done made after it, of a newer result, has no acceptance of its own yet (D-128).
export function acceptanceWhy(r, rounds, done, statement = null, { approvals = [], latest = false } = {}) {
  // The records of done are read through the task view (D-152): the record an acceptance is of is the
  // latest of the view as it stood when it was given, and, with latest, it must be the latest of the view
  // now; a record of another version or of an earlier window stands for neither. Only where the view has
  // none is the latest record before the acceptance named, so that the refusal says why.
  const records = done.filter((d) => d.task === r.task).sort((a, b) => a.time.localeCompare(b.time));
  const then = taskView({ rounds, done, approvals, task: r.task, before: r.time });
  const before = (then.window && then.done.at(-1)) || records.filter((d) => d.time < r.time).at(-1);
  const reviewed = reviewedCommit(r);
  if (!records.length) return "there is no record of done";
  if (!before) return "it was given before the record of done was made";
  const now = taskView({ rounds, done, approvals, task: r.task });
  const newest = now.window ? now.done.at(-1) : records.at(-1);
  if (latest && newest && newest !== before) return `the record of done ${newest.file}, of commit ${newest.commit.slice(0, 7)}, was made after it and has no acceptance of its own`;
  if (latest && !newest) return `the record of done ${before.file} is not of the version approved now`;
  if (before.checks.some((c) => c.result !== "pass")) return `the record of done ${before.file} has a check that failed`;
  if (r.statementHash !== before.statementHash) return `it names another version of the statement than the record of done ${before.file}`;
  if (approvedHash(rounds, r.task, before.time, approvals) !== before.statementHash) return `the record of done ${before.file} was made with no approval in force for its version of the statement`;
  if (approvedHash(rounds, r.task, r.time, approvals) !== before.statementHash) return "no approval is in force for that version of the statement";
  // The record of done and the acceptance are of one window of that version: a record made before its
  // approval was withdrawn and given again is not this window's (D-152).
  if (!inWindow(before, then.window)) return `the record of done ${before.file} was made before the approval in force when the acceptance was given, which a later round withdrew and gave again`;
  if (!reviewed) return "the round names no commit it reviewed (Commits:)";
  if (!before.commit.startsWith(reviewed)) return `the record of done ${before.file} is of commit ${before.commit.slice(0, 7)}, not of the commit the round reviewed, ${reviewed.slice(0, 7)}`;
  if (statement?.hash && statement.hash !== before.statementHash) return `the statement's file is version ${statement.hash.slice(0, 12)}, not the version ${before.statementHash.slice(0, 12)} the record of done names`;
  const ran = before.checks.map((c) => c.command);
  const want = statement ? (statement.doneWhen ?? []) : null;
  if (want && (ran.length !== want.length || ran.some((c, i) => c !== want[i])))
    return `the commands of the record of done ${before.file}, ${ran.map((c) => `"${c}"`).join(", ")}, are not the statement's commands of done, ${want.map((c) => `"${c}"`).join(", ") || "none"}`;
  return null;
}

// Why each verdict of acceptance is refused (inv.acceptance-after-done).
export function acceptanceProblems(rounds, done, approvals = []) {
  const out = [];
  for (const r of rounds.filter((x) => x.acceptance)) {
    const why = acceptanceWhy(r, rounds, done, null, { approvals });
    if (why) out.push(`${r.file}: acceptance of ${r.task} refused: ${why}`);
  }
  return out;
}

// The latest record of done of a task, whatever follows it.
export const latestDone = (done, task) => done.filter((d) => d.task === task).sort((a, b) => a.time.localeCompare(b.time)).at(-1) ?? null;

// A task's spend against its limits (derived.task-budget); null when no limit is set.
// The limits are those of version, the version that applies to what the reader reads, or, given none, of
// the version in force (versionInForce), by versionLimits (D-174); the reserve is read the same way, from
// the same place, as the limits, or 1 where neither the version nor the configuration sets one (D-150).
export function taskBudget({ rounds, spend, done = [], approvals = [], task, defaults, statement, version, pending = [], snapshots = [] }) {
  const v = version !== undefined ? version : versionInForce({ rounds, approvals, task, statement, pending });
  const { newInput, output, reserve: given } = versionLimits({ task, version: v, statement, pending, done, approvals, snapshots, defaults });
  const limits = { newInput, output };
  if (limits.newInput === null && limits.output === null) return null;
  const reserve = given ?? 1;
  // The reserve as a fraction of whole numbers, num / den, from its decimal digits, so that the cap and
  // the comparison with it are exact: 3000000 × 1.1 is 3300000, never 3300000.0000000005 (D-150).
  const digits = String(reserve).split(".")[1] ?? "";
  const den = 10 ** digits.length;
  const num = Math.round(reserve * den);
  const cap = (k) => (limits[k] === null ? null : (limits[k] * num) / den);
  const parts = [...rounds.filter((r) => r.task === task), ...spend.filter((s) => s.task === task)];
  // Records of one contribution that overlap would count it twice: the spend is not summed at all, and
  // the stop holds until they are corrected (D-118); the pairs are those of every task's records, as the
  // check finds them, that involve this task (D-124).
  const conflict = overlapPairs(rounds, spend)
    .filter((p) => p.tasks.includes(task))
    .map((p) => p.text);
  if (conflict.length)
    return {
      limits,
      reserve,
      noReserve: given === null,
      used: null,
      conflict,
      known: 0,
      parts: parts.length,
      cap: { newInput: cap("newInput"), output: cap("output") },
      exhausted: true,
      over: false,
    };
  const sum = (k) => parts.reduce((a, p) => a + (p.tokens[k] ?? 0), 0);
  const used = { newInput: sum("new"), output: sum("out") };
  const known = parts.filter((p) => p.tokens.new !== null && p.tokens.out !== null).length;
  // Compared in whole numbers: used × den against limit × num.
  const reached = (k, strict) => {
    if (limits[k] === null) return false;
    const [a, b] = [BigInt(used[k]) * BigInt(den), BigInt(limits[k]) * BigInt(num)];
    return strict ? a > b : a >= b;
  };
  return {
    limits,
    reserve,
    noReserve: given === null,
    used,
    conflict: [],
    known,
    parts: parts.length,
    cap: { newInput: cap("newInput"), output: cap("output") },
    exhausted: reached("newInput", false) || reached("output", false),
    over: reached("newInput", true) || reached("output", true),
  };
}

const LABEL = { newInput: "new input", output: "output" };
// Numbers are written one way wherever the tool writes or compares them (D-147): as JavaScript writes
// them, a whole number or a decimal with a point, such as 151.5 for a limit of 101 with a reserve of 1.5.
export const num = (n) => String(n);
export const overspendText = (b) =>
  ["newInput", "output"]
    .filter((k) => b.cap[k] !== null)
    .map((k) => `${LABEL[k]} ${num(b.used[k])} of ${num(b.cap[k])}`)
    .join(", ");

// What is wrong with the line Overspend: of the round that ends a task (field.review-round.overspend,
// D-128, D-147): it is exactly overspendText of the task's budget when the spend is past the limit, and
// absent otherwise. --task and the check compare it alike, the budget's limits given by versionLimits.
export function overspendProblems(end, b) {
  const line = end.overspend;
  const name = `${end.file}: the record of acceptance`;
  if (b?.conflict?.length) return [];
  if (b?.over && !line) return [`${name} does not name the overspend (${overspendText(b)})`];
  if (b?.over && line !== overspendText(b)) return [`${name} names the overspend as "${line}", not as the tool computes it, "${overspendText(b)}"`];
  if (!b?.over && line) return [`${name} names an overspend, "${line}", where the tool finds none`];
  return [];
}

// The next round of one step of a task, as --task and --rounds both give it (D-123): derived.next-round,
// with the task's budget and with a clean verdict of acceptance that does not hold read as refused.
// A record of the owner's approval after the last round of the review of the statement ends that step
// (D-121); a verdict of acceptance holds only for the latest record of done (D-128).
// The owner's last record of approval for the task ends both steps (D-152): the rounds before it are not
// read by the branches of derived.next-round, so a question it answered is lifted.
export function stepNext({ rounds, done = [], approvals = [], task, step, statement = null, gatesFrom = null, head = null }) {
  const all = ofTask(rounds, task, step);
  // The owner's last approval closes gates and starts the comparison of the statement's rounds; the
  // review of the result starts at its version window, which that approval may have opened (D-152).
  // His answer to a gate closes that gate alone, and starts no comparison (D-185).
  const ownerSince = ownerApprovals(approvals, task).map((a) => a.time).sort().at(-1) ?? null;
  const answered = answeredRounds(approvals, task);
  const view = taskView({ rounds, done, approvals, task });
  const window = step === "result-review" ? view.window : null;
  const since = window ? [ownerSince, window.from].filter(Boolean).sort().at(-1) : ownerSince;
  // The rounds of the review of the result are the window's, by version and time; the numbers go on over
  // every round of the step (D-152).
  const of = step === "result-review" ? view.results : all;
  // An open gate holds the whole task, both steps, until the owner's newer approval (D-152).
  const gates = openGatesBy({ rounds, done, approvals, task, gatesFrom });
  const held = (r) => !acceptanceWhy(r, rounds, done, null, { approvals });
  // The range of fixes after the narrow round, by the one function that reads it (D-164), its end before
  // done head, the working copy's HEAD, as for every other reader of it.
  const fixes = step === "result-review" ? fixesRange({ rounds, done, approvals, task, statement, head }) : null;
  // The ends of the step (derived.step-end, D-187): the window of the last round starts after the end before
  // it, and a record of done of the window made after the last end on another commit is a new result,
  // whose next action is one narrow round on it.
  const seen = step === "result-review" ? byTime(of).filter((r) => since === null || r.time > since) : [];
  const ends = step === "result-review" ? stepEnds({ all: seen, done: view.done, held }) : [];
  const lastRound = seen.at(-1);
  const windowFrom = step !== "result-review" ? undefined : lastRound ? (ends.filter((e) => e.time < lastRound.time).at(-1)?.time ?? null) : null;
  const go = () => nextRound(of, { numbered: all, since, gateSince: ownerSince, held, gate: gates.notFixable, answered, fixes, gatesFrom, windowFrom, refused: (r) => endingWhy(r, { rounds, done, approvals, statement }) });
  if (gates.notFixable.length) return go();
  if (step === "statement-review") {
    const last = approvalEvents(rounds, task, approvals).at(-1);
    if (last?.kind === "approval") return { next: "clean", say: `the owner approved version ${last.hash.slice(0, 12)} (${last.file})` };
  }
  // Work on the result goes on only under an approval in force, as --task says (rule.work-under-approval):
  // a later round of the statement with findings withdraws even the owner's approval. A task none of
  // whose records names a version reads as it did (byVersion).
  if (step === "result-review" && all.length && byVersion({ rounds, done, approvals, task }) && !approvedHash(rounds, task, null, approvals)) return { next: "no-approval", say: NO_APPROVAL };
  // An earlier round's acceptance held when it held by the records as they were when it was given, for
  // the version the round read: no statement is given to it, so --task, with a file of a later version,
  // and --rounds, with none, find the same end of the step (D-152). Only the last round, which would end
  // the task now, is held to the file --task is given (D-123).
  const end = ends.at(-1);
  const fresh = end && !seen.some((r) => r.time > end.time) ? view.done.filter((d) => d.sinceVerdicts && d.time > end.time && !sameCommit(d.commit, end.commit)).sort((a, b) => a.time.localeCompare(b.time)).at(-1) : null;
  if (fresh && !gates.notFixable.length) {
    const number = Math.max(0, ...all.filter((r) => r.narrow).map((r) => r.number)) + 1;
    return { next: "narrow", number, branch: "next round", newResult: fresh, say: `the record of done ${fresh.file}, of commit ${fresh.commit.slice(0, 7)}, is a new result after the end of the step at ${end.file}: narrow round ${number}, one round on it, whose clean verdict ends the step (derived.step-end)` };
  }
  return go();
}

// Whether a task is read by versions of its statement (D-152): the one test of it, which --task,
// --rounds and done.mjs read through taskNext and stepNext. A task is versioned once any record of it
// names a version of its statement, a round of either step with Statement-hash:, a record of done or a
// record of the owner's approval, or when it has no record yet; never by the time of its records, which
// decides only how each record is read (isLegacy). A task none of whose records names a version, as one
// recorded before D-106, skips the statement's branches and reads as it did.
export const byVersion = ({ rounds, done = [], approvals = [], task }) => {
  const own = [...rounds, ...done, ...approvals].filter((r) => r.task === task);
  return !own.length || own.some((r) => r.statementHash);
};

// The open gates of a task (D-152): the rounds of either step, after the owner's last record of approval
// for the task, with a finding `not fixable`. While one is open, the next action of --task and --rounds is
// the question to the owner and done.mjs refuses; only a newer approval of the owner closes it.
// A round whose time is before gatesFrom, the configuration's reviewRounds.gatesFrom, was written when
// `not fixable` meant not fixable within the task: it opens no gate, and is a question at that round only,
// when it is the last of its step (D-152). Without the key every round carries the meaning of D-152.
// The rounds are every round of the task, whatever version each names, never a window's: a reviewer's
// clean round that approves another version closes nothing.
// The round after the confirmed condition opens no gate of its own (D-164): its fixes are held by tests.
// The owner's approval closes the gates of every round before it; his answer to a gate closes the gate of
// the round it names alone, and the other gates stay open (D-185).
export const openGatesBy = ({ rounds, task, gatesFrom = null, approvals = [] }) => {
  const own = ofTask(rounds, task).filter((r) => !isLegacy(r, gatesFrom));
  const since = ownerApprovals(approvals, task).map((a) => a.time).sort().at(-1) ?? null;
  const answered = answeredRounds(approvals, task);
  return { notFixable: notFixableIn(own, since).filter((f) => !answered.has(f)) };
};
export const openGates = (args) => openGatesBy(args).notFixable;
// Every task any record names: a round, a record of spend, of done or of the owner's approval (D-152).
export const taskIds = ({ rounds = [], spend = [], done = [], approvals = [] }) => [...new Set([...rounds, ...spend, ...done, ...approvals].map((r) => r.task).filter(Boolean))].sort();
export const NO_APPROVAL = "work is not allowed: no approval in force for the statement";

// The one next action of a whole task (derived.task-next, D-152): the first that holds of these
// branches, in this order, which ontology.md and docs/parts/agent-rules.md list by the same names and
// numbers. --task, --rounds, done.mjs and the check all ask it; every other line of --task and --rounds
// says a state only.
export const TASK_BRANCHES = ["unreadable record", "rules drift", "done", "budget question", "open gate", "no review", "under review", "no version", "changed", "step"];
// The kind of the action of each branch but the step, whose kind its result gives (taskNext).
export const TASK_KINDS = { "unreadable record": "correct", "rules drift": "question", done: "done", "budget question": "question", "open gate": "question", "no review": "review", "under review": "review", "no version": "correct", changed: "review" };
export const NO_FILE = "give --statement <file> to compare the version it names with the file";
// The rules of main on GitHub differ from the rule file, as --task compares them before each step with the
// executor's gh (inv.rules-match-file, D-185): only the owner changes them (his answer 1036 a).
export const RULES_QUESTION = "the rules of main on GitHub differ from the rule file: a question to the owner, who alone changes them";
// head: the working copy's HEAD, or for done.mjs the commit it records done on, the end of the range of
// fixes before its record of done (rule.fixes-held-by-tests).
// needFile: the caller, --task or done.mjs, compares the version with a statement's file; --rounds and the
// check do not. gatesFrom: the configuration's reviewRounds.gatesFrom.
// forWork: done.mjs, which asks for new work on the result, so the branch done does not stand for it: a
// new record of done after the task is done meets the budget and every other branch (D-152).
// The next action after a clean last round whose acceptance holds, a clean narrow round after the confirmed
// condition included: the change is merged at once, with no fixes, no issue of verdicts and no new record
// of done (rule.ready-after-clean-round, D-164).
// ont: derived.task-next, rule.ready-after-clean-round
const CLEAN_DONE = "done: the last round and its acceptance are clean: merge (rule.ready-after-clean-round)";
// The action of the branch done: the merge, and past the budget its overspend reported with it, never in
// its place (derived.task-next, rule.ready-after-clean-round). over is the text of the overspend, or null.
const doneSay = (result, over) => {
  const merge = result.fixes ? result.say : CLEAN_DONE.replace(/^done: /, "");
  return over ? `done, with an overspend: ${over}; report it to the owner, and ${merge}` : `done: ${merge}`;
};
// The overspend the branch done reports, by the state of spend the budget question reads (D-169): where
// spend is counted from the logs, spendNow, the sums of the goal and of the task; with none given, the
// snapshot of spend the round that ends the task names, which its writer and the check compare its line
// Overspend: with; or else the task's budget summed from the records (derived.task-next).
export function doneOverspend({ b, spendNow = null, end = null, snapshots = [] }) {
  if (spendNow?.used) return overspendOf(spendNow);
  const snap = end?.spendRecord ? snapshots.find((x) => x.file === end.spendRecord) : null;
  if (snap) return overspendOf(snapshotSpend(snap));
  return b?.over ? overspendText(b) : null;
}
// spendNow: the state of spend from the logs, or from a snapshot, where the configuration counts spend from
// the logs (D-169); budgetActions: false for --rounds, which shows the sums and names no action by the
// budget, neither the question nor the overspend to report on the branch done; only --task, run before
// each step, does.
// version, pending and snapshots: the version whose limits apply, as a round's writer gives its brief's,
// and the kept briefs and snapshots of spend versionLimits reads them from (D-174).
// rules: what --task found comparing the rules of main on GitHub with the rule file, { drift: [...] }, or null
// where they were not compared (D-185).
export function taskNext({ rounds, spend = [], done = [], approvals = [], task, defaults, statement = null, malformed = [], needFile = false, gatesFrom = null, forWork = false, head = null, spendNow = null, budgetActions = true, version, pending = [], snapshots = [], rules = null }) {
  const b = taskBudget({ rounds, spend, done, approvals, task, defaults, statement, version, pending, snapshots });
  const spent = spendNow?.used ? spendNow.exhausted : b?.exhausted;
  const unreadable = (statement?.wrong ?? []).length > 0;
  // The approved version of the file gives no command of done: no result can be recorded or accepted
  // under it, a question to the owner, as an unreadable line of its budget is (D-152).
  const noDone = Boolean(statement) && !(statement.doneWhen ?? []).length && statement.hash === approvedHash(rounds, task, null, approvals);
  const events = approvalEvents(rounds, task, approvals);
  const last = events.at(-1);
  const approvedNow = approvedHash(rounds, task, null, approvals);
  const st = ofTask(rounds, task, "statement-review");
  const rr = ofTask(rounds, task, "result-review");
  // A task none of whose records names a version has no statement branches: its rounds read as they did.
  const versioned = byVersion({ rounds, done, approvals, task });
  const step = (name) => stepNext({ rounds, done, approvals, task, step: name, statement, gatesFrom, head });
  const fileOk = !statement || statement.hash === approvedNow;
  const result = approvedNow ? step("result-review") : !versioned ? step(rr.length || !st.length ? "result-review" : "statement-review") : null;
  const gatesBy = openGatesBy({ rounds, done, approvals, task, gatesFrom });
  const gates = gatesBy.notFixable;
  const nextFull = Math.max(0, ...st.filter((r) => !r.narrow).map((r) => r.number)) + 1;
  const nextResult = Math.max(0, ...rr.filter((r) => !r.narrow).map((r) => r.number)) + 1;
  // The current version window, which every branch below reads for the version: its rounds of the result
  // and its record of done (D-152).
  const view = taskView({ rounds, done, approvals, task });
  const window = view.window;
  const branch = {
    "unreadable record": () => malformed.length && blockedSay(malformed),
    "rules drift": () => rules?.drift?.length && `${RULES_QUESTION} (${rules.drift.join("; ")})`,
    "open gate": () => gates.length && gateSay(gates),
    done: () =>
      !forWork &&
      (window ? view.results.length && (!needFile || statement?.hash === window.hash) : rr.length) &&
      result?.next === "clean" && doneSay(result, budgetActions ? doneOverspend({ b, spendNow, end: view.results.at(-1), snapshots }) : null),
    "budget question": () =>
      unreadable
        ? `a line of the statement's budget cannot be read: a question to the owner, with no next round (${statement.wrong.join("; ")})`
        : noDone
          ? "the approved statement has no line Done-when: with a command of done: a question to the owner, with no next round"
          : b?.conflict?.length
          ? `the spend cannot be summed while records of one contribution overlap: ${BUDGET_QUESTION}, until the records are corrected`
          : budgetActions && spent && (spendNow?.used && spendNow.which?.length ? `${BUDGET_QUESTION} (the reserve of ${spendNow.which.join(" and ")} is spent)` : BUDGET_QUESTION),
    "no review": () => versioned && !last && "it needs a review of the statement",
    "under review": () => versioned && last?.kind === "round" && !isClean(last.round) && step("statement-review").say,
    "no version": () => versioned && needFile && !statement && NO_FILE,
    changed: () => versioned && statement && last && approvedNow !== statement.hash && `the statement changed after its approval: next is full round ${nextFull} of the new version`,
    step: () => {
      if (!result) return NO_APPROVAL;
      // No round of the result has read the version in force yet: the work under it, then its first round.
      if (window && !view.results.length)
        return view.done.length
          ? `the record of done ${view.done.at(-1).file} of version ${window.hash.slice(0, 12)} has no round of review yet: full round ${nextResult} of the review of the result`
          : `the executor works under version ${window.hash.slice(0, 12)}, then records done with done.mjs`;
      if (result.next === "first round" && !result.say) return "the executor works, then records done with done.mjs";
      return result.say;
    },
  };
  // The kind of the action, set where it is decided (D-152): work, on which alone done.mjs records done;
  // review, a round of the statement's review or its approval first; question, the owner is asked; correct,
  // the records or the file given; done. Within the step, a question derived.next-round asks, as a legacy
  // finding not fixable in the last round does, is a question too.
  const kind = (name) =>
    name === "step" ? (!result || result.next === "no-approval" ? "review" : result.next === "question" ? "question" : "work") : TASK_KINDS[name];
  for (const name of TASK_BRANCHES) {
    const say = branch[name]();
    if (say) return { branch: name, kind: kind(name), say, budget: b, approved: Boolean(approvedNow) && fileOk && Boolean(statement || !needFile), result, unreadable, view };
  }
}

// What a task is, its statement, its result, its record of done and its budget, as lines of state, and
// its one next action on a line of its own, NEXT; and the errors of its records that only --task can
// see (derived.statement-state, rule.budget-before-next, derived.task-next). --rounds prints the same
// lines, given no file and needFile false (D-152).
export function taskState({ rounds, spend, done = [], approvals = [], task, defaults, statement, malformed = [], gatesFrom = null, needFile = true, head = null, spendNow = null, budgetActions = true, snapshots = [], pending = [], rules = null }) {
  const next = taskNext({ rounds, spend, done, approvals, task, defaults, statement, malformed, needFile, gatesFrom, head, spendNow, budgetActions, pending, snapshots, rules });
  const b = next.budget;
  const say = (part, text) => `TASK ${task} · ${part}: ${text}`;
  const { view } = next;
  if (next.branch === "unreadable record") return { lines: [`NEXT ${task}: ${next.say}`], errors: [], approved: false, budget: b, next };
  const errors = [];
  const last = approvalEvents(rounds, task, approvals).at(-1);
  const approvedNow = approvedHash(rounds, task, null, approvals);
  const by = last?.kind === "approval" ? ` by the owner (${last.file})` : "";
  const v = (h) => (h ? h.slice(0, 12) : "none");
  // The statement's state.
  const statementLine = !last
    ? "not reviewed yet"
    : last.kind === "round" && !isClean(last.round)
      ? `the last round of its review, ${last.file}, found findings of the change`
      : !approvedNow
        ? `the last round of its review, ${last.file}, is clean and names no version`
        : !statement
          ? `approved${by}, version ${v(approvedNow)}; the file is not given, so its version is not compared`
          : statement.hash !== approvedNow
            ? `approved${by}, version ${v(approvedNow)}; the file is version ${v(statement.hash)}, changed since`
            : `approved${by}, version ${v(approvedNow)}${next.branch === "done" ? ": the task is done" : ""}`;
  // The result's state.
  // The rounds of the result and the records of done are the task view's (D-152); the others are listed
  // as not read.
  const end = view.results.at(-1);
  // The state of the acceptance is that of the latest record of done of the window (D-152): a clean
  // verdict that does not hold for it, as of an earlier record of done, is said refused, with why, by
  // endingWhy, which the next action reads too; never clean.
  const acceptanceLabel = (r) => {
    if (!r.acceptance) return ", with no verdict of acceptance";
    if (r.acceptance.findings.length) return ", its acceptance has findings";
    const why = endingWhy(r, { rounds, done, approvals, statement });
    return why ? `, its verdict of acceptance is refused: ${why}` : ", its acceptance is clean";
  };
  const resultLine = !next.approved && next.branch !== "done"
    ? NO_APPROVAL
    : !end
      ? "no round of its review yet"
    : next.branch === "done"
      ? next.result?.fixes ? `done: ${next.result.say}` : "done: the last round and its acceptance are clean"
      : `the last round of its review, ${end.file}, ${isClean(end) ? "is clean on merging" : "found findings of the change"}${acceptanceLabel(end)}`;
  // After the narrow round no round ends the task: its record of done does, and no record carries the line
  // Overspend: then (docs/limitations.md).
  if (next.branch === "done" && !next.result?.fixes) errors.push(...(end.spendRecord ? snapshotOverspendProblems(end, snapshots) : overspendProblems(end, b)));
  // A goal a statement names that the configuration does not list, or a task it does not list in it, is an
  // error of --task (D-169).
  if (spendNow?.errors?.length) errors.push(...spendNow.errors);
  const lines = [say("statement", statementLine), say("result", resultLine)];
  errors.push(...(statement?.wrong ?? []).map((w) => `the statement's line ${w}`));
  const latest = view.done.at(-1) ?? null;
  // The limits a record of done carries are those of its own version of the statement, which the check
  // reads from it (D-147): the latest record of done of the file's version is compared with the file; a
  // record of an older version is not, since its limits were that version's.
  const ofFile = statement ? latestDone(done.filter((d) => d.statementHash === statement.hash), task) : null;
  if (ofFile?.budget && BUDGET_ALL.some(([k]) => ofFile.budget[k] !== (statement.budget?.[k] ?? null)))
    errors.push(`${ofFile.file}: the record of done carries the limits ${budgetLines(ofFile.budget).join(", ")}, not the statement's, ${budgetLines(statement.budget).join(", ")}`);
  if (latest)
    lines.push(
      say(
        "done",
        `recorded in ${latest.file}, commit ${latest.commit.slice(0, 7)}, version ${latest.statementHash.slice(0, 12)}, at ${latest.time}, ${latest.checks.length} commands ${latest.checks.every((c) => c.result === "pass") ? "passed" : "not all passed"}` +
          (end && end.time > latest.time ? `; reviewed after it in ${end.file}` : "; no round of the review of the result has followed it yet"),
      ),
    );
  if (view.others.length) lines.push(say("not read", `${view.others.map((x) => `${x.file}, of version ${v(x.statementHash)}`).join("; ")}: of an earlier approval than version ${v(view.window.hash)}`));
  if (b?.conflict.length) lines.push(`BUDGET ${task}: the spend cannot be summed, ${b.conflict.length} pair${b.conflict.length > 1 ? "s" : ""} of records of one contribution overlap: ${b.conflict.join("; ")}`);
  else if (b) {
    const limit = (k) => (b.limits[k] === null ? `${LABEL[k]} ${num(b.used[k])}, no limit` : `${LABEL[k]} ${num(b.used[k])} of ${num(b.limits[k])} × ${num(b.reserve)} = ${num(b.cap[k])}`);
    lines.push(
      `BUDGET ${task}: ${limit("newInput")}, ${limit("output")}; known for ${b.known} of ${b.parts} contributions` +
        (b.noReserve ? "; neither Budget-reserve: of the statement nor budget.reserve is set, so the reserve is 1" : "") +
        (b.over ? `; overspend: ${overspendText(b)}` : b.exhausted ? "; exhausted" : ""),
    );
    // No mark where no spend is measured: a line of the budget the tool cannot read (D-150). Where spend is
    // counted from the logs, the marks are of its sums (D-169).
    const marks = next.unreadable || spendNow?.used ? [] : budgetMarks(b);
    if (marks.length) lines.push(`REPORT ${task}: ${marks.map((m) => `${LABEL[m.kind]} ${num(b.used[m.kind])} of ${num(b.limits[m.kind])}: ${m.marks.join(", ")}`).join(" · ")}`);
  }
  if (spendNow) {
    lines.push(...spendLines(task, spendNow));
    const marks = next.unreadable ? [] : spendMarks(spendNow);
    if (marks.length) lines.push(`REPORT ${task}: ${marks.join(" · ")}`);
  }
  lines.push(`NEXT ${task}: ${next.say}`);
  return { lines, errors, approved: next.approved, budget: b, next };
}

// The marks of the budget a task's spend has passed (derived.budget-report, D-152): for new input and for
// output apart, each with a limit, "half" at half the limit or more and "limit" at the limit or more, the
// limit before the reserve, compared in whole numbers; none when the spend cannot be summed.
export function budgetMarks(b) {
  if (!b || b.conflict?.length || !b.used) return [];
  return ["newInput", "output"]
    .filter((k) => b.limits[k] !== null)
    .map((k) => ({ kind: k, marks: [BigInt(b.used[k]) * 2n >= BigInt(b.limits[k]) && "half", b.used[k] >= b.limits[k] && "limit"].filter(Boolean) }))
    .filter((m) => m.marks.length);
}

// The environment of a command run on a commit: without the variable a running test runner sets, which
// would make a test runner started by the command report to it instead of failing. The command is the
// project's, not a command of Git the tool runs, so it gets no GIT_NO_REPLACE_OBJECTS of the tool's
// (D-137 is about the tool's own commands): a test that makes a replacement sees it in force.
export const cleanEnv = () => {
  const env = gitEnv();
  delete env.GIT_NO_REPLACE_OBJECTS;
  delete env.NODE_TEST_CONTEXT;
  return env;
};

// The environment of a git command in another directory: without the variables local to the hook's
// repository (lib.mjs).
export { gitEnv };

// Runs each command in a temporary worktree at the commit, in the directory that matches dir there, and
// gives each result; the worktree is removed after (D-107).
export function runAtCommit({ top, commit, dir = "", commands }) {
  const tmp = mkdtempSync(join(tmpdir(), "ont-at-commit-"));
  const add = spawnSync("git", ["-C", top, "worktree", "add", "--detach", "--quiet", tmp, commit], { encoding: "utf8", env: gitEnv() });
  if (add.status !== 0) {
    rmSync(tmp, { recursive: true, force: true });
    return { error: `cannot make a worktree at ${commit}: ${add.stderr.trim()}` };
  }
  try {
    return {
      root: tmp,
      results: commands.map((c) => {
        const r = typeof c === "function" ? c(tmp) : spawnSync(c, { shell: true, cwd: join(tmp, dir), env: cleanEnv(), encoding: "utf8", maxBuffer: 1 << 28 });
        // A command may say its own result, as a test suite does when its tests were skipped (D-116).
        return { command: typeof c === "function" ? c.label : c, result: r.result ?? (r.status === 0 ? "pass" : "fail"), detail: r.detail ?? null, output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
      }),
    };
  } finally {
    spawnSync("git", ["-C", top, "worktree", "remove", "--force", tmp], { env: gitEnv() });
    rmSync(tmp, { recursive: true, force: true });
  }
}
