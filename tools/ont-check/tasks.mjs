// A task's statement, its approval, its record of done and its budget (D-152, D-108). The
// statement is a file, often outside the repository, named by its SHA-256; the records of done and of
// the executor's spend are files in the directory the configuration names under taskRecords.
// ont: ent.owner-approval, inv.owner-approval-sourced, field.owner-approval.task, field.owner-approval.by, field.owner-approval.source, field.owner-approval.time, edge.owner-approval.statement, ent.task-statement, field.task-statement.file, field.task-statement.done-when, field.task-statement.budget, derived.approval, derived.statement-state, derived.task-budget, derived.budget-report, rule.work-under-approval, rule.budget-before-next, rule.no-default-budget, ent.task-result, field.task-result.task, field.task-result.commit, field.task-result.budget, field.task-result.checks, field.task-result.time, edge.task-result.statement, inv.acceptance-after-done, rule.acceptance-against-approved, ent.task-spend, field.task-spend.contribution, field.task-spend.start, field.task-spend.end, field.task-spend.tokens-new, field.task-spend.tokens-cached, field.task-spend.tokens-out, edge.task-spend.task, inv.contributions-apart, inv.named-commits-resolve
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { commitResolves, gitEnv, listFiles, read, unresolvedCommits } from "./lib.mjs";
import { BUDGET_QUESTION, SHA256, TASK_NAME, blockLines, blockedSay, byTime, isClean, nextRound, notFixableIn, parseContribution, parseRounds, realTime } from "./review-rounds.mjs";

export const sha256 = (data) => createHash("sha256").update(data).digest("hex");

// The records of rounds of a project, as the check, --task, --rounds and done.mjs all read them: by one
// function, with the configuration's records.latinOnly and the root of the repository, in which a filed
// finding's file is looked up (D-152). top is that root, or "" outside a Git repository.
export function readRoundRecords(cfg) {
  const top = spawnSync("git", ["-C", cfg.base, "rev-parse", "--show-toplevel"], { encoding: "utf8", env: gitEnv() }).stdout?.trim() ?? "";
  return { ...parseRounds(cfg.reviewRounds.dir, { latinOnly: cfg.records.latinOnly, root: top || null }), top };
}

// The lines of a statement the tool reads; the rest of it is for people and the reviewer.
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
  return { file, hash: sha256(text), doneWhen: value("Done-when").filter(Boolean), budget, wrong };
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

// Records of done, of spend and of the owner's approval, with what is wrong with each.
export function parseTaskRecords(dir) {
  const spend = [];
  const done = [];
  const approvals = [];
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
      const limits = BUDGET_LINES.map(([k, name]) => [k, name, field(name)]);
      const given = limits.filter(([, , v]) => v !== null);
      const reserveLine = field(RESERVE_LINE);
      const wrong = [
        given.length === 1 && `${given[0][1]} is given without ${limits.find(([, , v]) => v === null)[1]}`,
        ...given.filter(([, , v]) => v !== "none" && !/^\d+$/.test(v)).map(([, name, v]) => `${name.toLowerCase()} ${v} is not a whole number or none`),
        reserveLine !== null && !given.length && `${RESERVE_LINE} is given without the limits`,
        reserveLine !== null && reserveLine !== "none" && reserveOf(reserveLine) === null && `${RESERVE_LINE.toLowerCase()} ${reserveLine} is not a number of 1 or more, or none`,
        !task && "no task",
        task && !TASK_NAME.test(task) && `task ${task} is not lower-case letters, digits and hyphens`,
        !/^[0-9a-f]{40}$/.test(commit ?? "") && `commit ${commit ?? "(none)"} is not a full commit`,
        !SHA256.test(hash ?? "") && `statement hash ${hash ?? "(none)"} is not a SHA-256`,
        !realTime(time) && `time ${time ?? "(none)"} is not a UTC time to the second`,
        !checks.length && "no checks",
        ...checks.filter((c) => !c.command || !["pass", "fail"].includes(c.result)).map((c) => `check ${c.command ?? ""} has no result pass or fail`),
      ].filter(Boolean);
      if (wrong.length) malformed.push(`${name}: ${wrong.join("; ")}`);
      else {
        // A record made before the lines existed carries no limits: budget is null (D-147); one made
        // before the line of the reserve carries none, as one whose statement gives none (D-150).
        const budget = given.length ? { ...Object.fromEntries(limits.map(([k, , v]) => [k, v === "none" ? null : Number(v)])), reserve: reserveOf(reserveLine) } : null;
        done.push({ file: name, task, commit, statementHash: hash, time, checks, budget });
      }
    } else if (kind === "approval") {
      // The owner's approval of a version of a statement (D-121): valid only by the owner and with the
      // owner's words it rests on.
      const [hash, by, source, time] = [field("Statement-hash"), field("By"), field("Source"), field("Time")];
      const wrong = [
        !task && "no task",
        task && !TASK_NAME.test(task) && `task ${task} is not lower-case letters, digits and hyphens`,
        !SHA256.test(hash ?? "") && `statement hash ${hash ?? "(none)"} is not a SHA-256`,
        by !== "owner" && `by ${by ?? "(none)"}, not by owner: only the owner's approval is recorded so`,
        !source && "no source: the owner's words or answer it rests on, with the date",
        !realTime(time) && `time ${time ?? "(none)"} is not a UTC time to the second`,
      ].filter(Boolean);
      if (wrong.length) malformed.push(`${name}: ${wrong.join("; ")}`);
      else approvals.push({ file: name, task, statementHash: hash, by, source, time });
    } else malformed.push(`${name}: Record ${kind ?? "(none)"} is not spend, done or approval`);
  }
  return { spend, done, approvals, malformed };
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
export function endingRound({ rounds, done = [], approvals = [], task, statement = null }) {
  const last = ofTask(rounds, task, "result-review").at(-1);
  if (!last || !last.acceptance || !isClean(last)) return null;
  return acceptanceWhy(last, rounds, done, statement, { approvals, latest: true }) ? null : last;
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

// The events that give or withdraw an approval of a task's statement, by time: each round of the review
// of the statement, and each record of the owner's approval (D-121). At the same second a round comes
// before an approval, which answers it.
export const approvalEvents = (rounds, task, approvals = []) =>
  [
    ...ofTask(rounds, task, "statement-review").map((r) => ({ kind: "round", time: r.time, hash: isClean(r) ? r.statementHash : null, round: r, file: r.file })),
    ...approvals.filter((a) => a.task === task).map((a) => ({ kind: "approval", time: a.time, hash: a.statementHash, approval: a, file: a.file })),
  ]
    .map((e, i) => ({ ...e, i }))
    .sort((a, b) => a.time.localeCompare(b.time) || (a.kind === b.kind ? a.i - b.i : a.kind === "round" ? -1 : 1));

// The hash of the version under an approval in force (derived.approval, D-121): the last by time of a
// round of the review of the statement and a record of the owner's approval decides: a clean round that
// names the version it read, or the owner's approval of a version, approves that version; a round with
// findings approves none. With a time, the approval in force then: the last such event before it (D-117).
export function approvedHash(rounds, task, before = null, approvals = []) {
  const last = approvalEvents(rounds, task, approvals)
    .filter((e) => before === null || e.time < before)
    .at(-1);
  return last?.hash ?? null;
}

// The commit a round reviewed: the commit of its line Commits:, or the last of its range.
export const reviewedCommit = (r) => {
  const c = (r.commits ?? "").split("..").at(-1).trim();
  return /^[0-9a-f]{7,40}$/.test(c) ? c : null;
};

// Why a verdict of acceptance is refused, or null (inv.acceptance-after-done, D-117): it follows the
// record of done, which follows the approval in force; the acceptance, the record and that approval
// name one version of the statement, the approval is still in force when the acceptance is given, the
// record's commit is the one the round reviewed, and, when the statement's file is given, its version
// is the file's and the record's commands are exactly its commands of done (D-123).
// With latest, as the state of a task reads it, the acceptance must be of the latest record of done: a
// record of done made after it, of a newer result, has no acceptance of its own yet (D-128).
export function acceptanceWhy(r, rounds, done, statement = null, { approvals = [], latest = false } = {}) {
  const records = done.filter((d) => d.task === r.task).sort((a, b) => a.time.localeCompare(b.time));
  const before = records.filter((d) => d.time < r.time).at(-1);
  const reviewed = reviewedCommit(r);
  if (!records.length) return "there is no record of done";
  if (!before) return "it was given before the record of done was made";
  const newest = records.at(-1);
  if (latest && newest !== before) return `the record of done ${newest.file}, of commit ${newest.commit.slice(0, 7)}, was made after it and has no acceptance of its own`;
  if (before.checks.some((c) => c.result !== "pass")) return `the record of done ${before.file} has a check that failed`;
  if (r.statementHash !== before.statementHash) return `it names another version of the statement than the record of done ${before.file}`;
  if (approvedHash(rounds, r.task, before.time, approvals) !== before.statementHash) return `the record of done ${before.file} was made with no approval in force for its version of the statement`;
  if (approvedHash(rounds, r.task, r.time, approvals) !== before.statementHash) return "no approval is in force for that version of the statement";
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

// The limits that apply to a task (derived.task-budget, D-147): the one function --task, --rounds, the
// check and the text of an overspend all ask. They are those of the approval in force, of the version of
// the statement it names: that version's file when it is the file given, as to --task; otherwise that
// version's limits as the latest record of done of that version carries them. A record of done of
// another version gives none: the limits of an older version are not the newer one's. With no approval
// in force, the file given, the version under review. Each limit the configuration's where the
// statement gives none, or where no record of its version carries them yet. The reserve is read the same
// way, from the same place, as the limits (D-150): the statement's line Budget-reserve:, else the
// configuration's budget.reserve, else none, which taskBudget reads as 1.
export function taskLimits({ statement = null, rounds = [], approvals = [], done = [], task, defaults }) {
  const version = approvedHash(rounds, task, null, approvals) ?? statement?.hash ?? null;
  const own =
    statement && statement.hash === version
      ? statement.budget
      : (latestDone(
          done.filter((d) => d.statementHash === version),
          task,
        )?.budget ?? {});
  return { newInput: own?.newInput ?? defaults?.newInput ?? null, output: own?.output ?? defaults?.output ?? null, reserve: own?.reserve ?? defaults?.reserve ?? null, version };
}

// A task's spend against its limits (derived.task-budget); null when no limit is set.
export function taskBudget({ rounds, spend, done = [], approvals = [], task, defaults, statement }) {
  const { version, reserve: given, ...limits } = taskLimits({ statement, rounds, approvals, done, task, defaults });
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
// absent otherwise. --task and the check compare it alike, the budget's limits given by taskLimits.
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
export function stepNext({ rounds, done = [], approvals = [], task, step, exhausted = false, statement = null }) {
  const of = ofTask(rounds, task, step);
  const since = approvals.filter((a) => a.task === task).map((a) => a.time).sort().at(-1) ?? null;
  // An open gate holds the whole task, both steps, until the owner's newer approval (D-152).
  const gate = openGates({ rounds, approvals, task });
  const held = (r) => !acceptanceWhy(r, rounds, done, null, { approvals });
  const go = () => nextRound(of, { exhausted, since, held, gate, refused: (r) => endingWhy(r, { rounds, done, approvals, statement }) });
  if (gate.length) return go();
  if (step === "statement-review") {
    const last = approvalEvents(rounds, task, approvals).at(-1);
    if (last?.kind === "approval") return { next: "clean", say: `the owner approved version ${last.hash.slice(0, 12)} (${last.file})` };
  }
  // Work on the result goes on only under an approval in force, as --task says (rule.work-under-approval):
  // a later round of the statement with findings withdraws even the owner's approval. A task whose
  // statement was never reviewed by version, recorded before D-106, reads as it did.
  const byVersion = approvals.some((a) => a.task === task) || rounds.some((r) => r.task === task && r.step === "statement-review" && r.statementHash);
  if (step === "result-review" && of.length && byVersion && !approvedHash(rounds, task, null, approvals)) return { next: "no-approval", say: NO_APPROVAL };
  // An earlier round's acceptance held when it held by the records as they were when it was given, for
  // the version the round read: no statement is given to it, so --task, with a file of a later version,
  // and --rounds, with none, find the same end of the step (D-152). Only the last round, which would end
  // the task now, is held to the file --task is given (D-123).
  return go();
}

// The open gates of a task (D-152): the rounds of either step, after the owner's last record of approval
// for the task, with a finding `not fixable`. While one is open, the next action of --task and --rounds is
// the question to the owner and done.mjs refuses; only a newer approval of the owner closes it.
export const openGates = ({ rounds, approvals = [], task }) =>
  notFixableIn(
    ofTask(rounds, task),
    approvals.filter((a) => a.task === task).map((a) => a.time).sort().at(-1) ?? null,
  );
export const NO_APPROVAL = "work is not allowed: no approval in force for the statement";

// What a task needs next, its statement, its result and its budget, as lines; and the errors of its
// records that only --task can see (derived.statement-state, rule.budget-before-next). With the budget
// exhausted and the task not done, every line that names a next action names the stop (D-124). The
// approval in force is the last by time of the rounds of the statement and the owner's approvals
// (D-121); the task is done only when the latest record of done has its own acceptance (D-128). malformed
// is the list of records of rounds that cannot be read: while one stands, its correction is the one next
// action (D-152). When the next action is a question to the owner, it is the one line that names an
// action. The marks of the budget go on a line of their own (derived.budget-report).
export function taskState({ rounds, spend, done = [], approvals = [], task, defaults, statement, malformed = [] }) {
  const b = taskBudget({ rounds, spend, done, approvals, task, defaults, statement });
  if (malformed.length) return { lines: [`TASK ${task} · next: ${blockedSay(malformed)}`], errors: [], approved: false, budget: b };
  // A line of the statement's budget the tool cannot read stops the task as a spent budget does: no
  // next action is named under a budget the tool does not know (D-150).
  const unreadable = (statement?.wrong ?? []).length > 0;
  const exhausted = Boolean(b?.exhausted) || unreadable;
  const STOP = unreadable ? "a line of the statement's budget cannot be read: a question to the owner, with no next round" : BUDGET_QUESTION;
  const errors = [];
  const say = (part, text) => `TASK ${task} · ${part}: ${text}`;
  const st = ofTask(rounds, task, "statement-review");
  const last = approvalEvents(rounds, task, approvals).at(-1);
  const hash = statement?.hash ?? null;
  let statementLine;
  let approved = false;
  if (!last) statementLine = exhausted ? STOP : "it needs a review of the statement";
  else if (last.kind === "round" && !isClean(last.round)) statementLine = stepNext({ rounds, done, approvals, task, step: "statement-review", exhausted, statement }).say;
  else if (!hash) statementLine = `${last.kind === "approval" ? "the owner approved a version" : "the last round is clean"}; give --statement <file> to compare the version it names with the file`;
  else if (last.hash !== hash) {
    // A full round of the new version, with the next free number over every version; no round is
    // counted (derived.statement-state, D-152).
    const next = Math.max(0, ...st.filter((r) => !r.narrow).map((r) => r.number)) + 1;
    statementLine = exhausted ? STOP : `the statement changed after its approval: next is full round ${next} of the new version`;
  } else approved = true;
  const rr = ofTask(rounds, task, "result-review");
  const end = rr.at(-1);
  // The next action is given once, by stepNext, and named on one line only: the line of the step it
  // belongs to; the other line says the state alone (D-152).
  const n = approved ? stepNext({ rounds, done, approvals, task, step: "result-review", exhausted, statement }) : null;
  const finished = n?.next === "clean";
  let resultLine;
  if (!approved) resultLine = NO_APPROVAL;
  else if (!end && n.next === "first round") resultLine = "the executor works, then records done with done.mjs";
  else if (!end && n.next === "budget") resultLine = STOP;
  else if (finished) {
    resultLine = b?.over ? `done, with an overspend: ${overspendText(b)}; report it to the owner` : "done: the last round and its acceptance are clean";
    errors.push(...overspendProblems(end, b));
  } else resultLine = n.say;
  const by = last?.kind === "approval" ? ` by the owner (${last.file})` : "";
  if (approved) statementLine = `approved${by}, version ${hash.slice(0, 12)}${finished ? ": the task is done" : ""}`;
  // A step's next action named by the rounds says the budget is spent; when the cause is a line the tool
  // cannot read, it says that instead (D-150).
  const why = (t) => (unreadable && typeof t === "string" ? t.replaceAll(BUDGET_QUESTION, STOP) : t);
  const lines = [say("statement", why(statementLine)), say("result", why(resultLine))];
  errors.push(...(statement?.wrong ?? []).map((w) => `the statement's line ${w}`));
  const latest = latestDone(done, task);
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
  if (b?.conflict.length)
    lines.push(`BUDGET ${task}: the spend cannot be summed, ${b.conflict.length} pair${b.conflict.length > 1 ? "s" : ""} of records of one contribution overlap: ${b.conflict.join("; ")}; ${BUDGET_QUESTION}, until the records are corrected`);
  else if (b) {
    const limit = (k) => (b.limits[k] === null ? `${LABEL[k]} ${num(b.used[k])}, no limit` : `${LABEL[k]} ${num(b.used[k])} of ${num(b.limits[k])} × ${num(b.reserve)} = ${num(b.cap[k])}`);
    lines.push(
      `BUDGET ${task}: ${limit("newInput")}, ${limit("output")}; known for ${b.known} of ${b.parts} contributions` +
        (b.noReserve ? "; neither Budget-reserve: of the statement nor budget.reserve is set, so the reserve is 1" : "") +
        (b.over ? `; overspend: ${overspendText(b)}` : b.exhausted ? "; exhausted" : ""),
    );
    // No mark where no spend is measured: a line of the budget the tool cannot read (D-150).
    const marks = unreadable ? [] : budgetMarks(b);
    if (marks.length)
      lines.push(`REPORT ${task}: ${marks.map((m) => `${LABEL[m.kind]} ${num(b.used[m.kind])} of ${num(b.limits[m.kind])}: ${m.marks.join(", ")}`).join(" · ")}; send the owner one report of every mark not yet reported; the next action is the one the lines above name`);
  }
  return { lines, errors, approved, budget: b };
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
