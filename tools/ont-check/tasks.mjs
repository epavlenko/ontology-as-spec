// A task's statement, its approval, its record of done and its budget (D-106, D-107, D-108). The
// statement is a file, often outside the repository, named by its SHA-256; the records of done and of
// the executor's spend are files in the directory the configuration names under taskRecords.
// ont: ent.task-statement, field.task-statement.file, field.task-statement.done-when, field.task-statement.budget, derived.approval, derived.statement-state, derived.task-budget, rule.work-under-approval, rule.budget-before-next, rule.no-default-budget, ent.task-result, field.task-result.task, field.task-result.commit, field.task-result.checks, field.task-result.time, edge.task-result.statement, inv.acceptance-after-done, rule.acceptance-against-approved, ent.task-spend, field.task-spend.contribution, field.task-spend.start, field.task-spend.end, field.task-spend.tokens-new, field.task-spend.tokens-cached, field.task-spend.tokens-out, edge.task-spend.task, inv.contributions-apart
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { gitEnv, listFiles, read } from "./lib.mjs";
import { BUDGET_QUESTION, FULL_ROUNDS, SHA256, TASK_NAME, blockLines, byTime, isClean, nextRound, parseContribution, realTime } from "./review-rounds.mjs";

export const sha256 = (data) => createHash("sha256").update(data).digest("hex");

// The lines of a statement the tool reads; the rest of it is for people and the reviewer.
export function readStatement(file) {
  const text = readFileSync(file);
  const lines = text.toString("utf8").split("\n");
  const value = (name) => lines.map((l) => l.match(new RegExp(`^${name}:\\s*(.*?)\\s*$`))).filter(Boolean).map((m) => m[1]);
  const number = (name) => {
    const v = value(name)[0];
    return v !== undefined && /^\d+$/.test(v.replaceAll("_", "")) ? Number(v.replaceAll("_", "")) : null;
  };
  return {
    file,
    hash: sha256(text),
    doneWhen: value("Done-when").filter(Boolean),
    budget: { newInput: number("Budget-new-input"), output: number("Budget-output") },
  };
}

// Records of done and of spend, with what is wrong with each.
export function parseTaskRecords(dir) {
  const spend = [];
  const done = [];
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
      const wrong = [
        !task && "no task",
        task && !TASK_NAME.test(task) && `task ${task} is not lower-case letters, digits and hyphens`,
        !/^[0-9a-f]{40}$/.test(commit ?? "") && `commit ${commit ?? "(none)"} is not a full commit`,
        !SHA256.test(hash ?? "") && `statement hash ${hash ?? "(none)"} is not a SHA-256`,
        !realTime(time) && `time ${time ?? "(none)"} is not a UTC time to the second`,
        !checks.length && "no checks",
        ...checks.filter((c) => !c.command || !["pass", "fail"].includes(c.result)).map((c) => `check ${c.command ?? ""} has no result pass or fail`),
      ].filter(Boolean);
      if (wrong.length) malformed.push(`${name}: ${wrong.join("; ")}`);
      else done.push({ file: name, task, commit, statementHash: hash, time, checks });
    } else malformed.push(`${name}: Record ${kind ?? "(none)"} is not spend or done`);
  }
  return { spend, done, malformed };
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

// The hash of the version under an approval in force: the last round by time of the review of the
// statement is clean and names the version it read (derived.approval). With a time, the approval in
// force then: the last such round that ended before it (D-117).
export function approvedHash(rounds, task, before = null) {
  const last = ofTask(rounds, task, "statement-review")
    .filter((r) => before === null || r.time < before)
    .at(-1);
  return last && isClean(last) && last.statementHash ? last.statementHash : null;
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
export function acceptanceWhy(r, rounds, done, statement = null) {
  const records = done.filter((d) => d.task === r.task).sort((a, b) => a.time.localeCompare(b.time));
  const before = records.filter((d) => d.time < r.time).at(-1);
  const reviewed = reviewedCommit(r);
  if (!records.length) return "there is no record of done";
  if (!before) return "it was given before the record of done was made";
  if (before.checks.some((c) => c.result !== "pass")) return `the record of done ${before.file} has a check that failed`;
  if (r.statementHash !== before.statementHash) return `it names another version of the statement than the record of done ${before.file}`;
  if (approvedHash(rounds, r.task, before.time) !== before.statementHash) return `the record of done ${before.file} was made with no approval in force for its version of the statement`;
  if (approvedHash(rounds, r.task, r.time) !== before.statementHash) return "no approval is in force for that version of the statement";
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
export function acceptanceProblems(rounds, done) {
  const out = [];
  for (const r of rounds.filter((x) => x.acceptance)) {
    const why = acceptanceWhy(r, rounds, done);
    if (why) out.push(`${r.file}: acceptance of ${r.task} refused: ${why}`);
  }
  return out;
}

// A task's spend against its limits (derived.task-budget); null when no limit is set.
export function taskBudget({ rounds, spend, task, defaults, statement }) {
  const own = statement?.budget ?? {};
  const limits = {
    newInput: own.newInput ?? defaults?.newInput ?? null,
    output: own.output ?? defaults?.output ?? null,
  };
  if (limits.newInput === null && limits.output === null) return null;
  const reserve = defaults?.reserve ?? 1;
  const cap = (k) => (limits[k] === null ? null : limits[k] * reserve);
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
      noReserve: defaults?.reserve === null || defaults?.reserve === undefined,
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
  const reached = (k, strict) => cap(k) !== null && (strict ? used[k] > cap(k) : used[k] >= cap(k));
  return {
    limits,
    reserve,
    noReserve: defaults?.reserve === null || defaults?.reserve === undefined,
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
export const overspendText = (b) =>
  ["newInput", "output"]
    .filter((k) => b.cap[k] !== null)
    .map((k) => `${LABEL[k]} ${b.used[k]} of ${b.cap[k]}`)
    .join(", ");

// The next round of one step of a task, as --task and --rounds both give it (D-123): derived.next-round,
// with the task's budget and with a clean verdict of acceptance that does not hold read as refused.
export function stepNext({ rounds, done = [], task, step, exhausted = false, statement = null }) {
  return nextRound(ofTask(rounds, task, step), { exhausted, refused: (r) => acceptanceWhy(r, rounds, done, statement) });
}

// What a task needs next, its statement, its result and its budget, as lines; and the errors of its
// records that only --task can see (derived.statement-state, rule.budget-before-next). With the budget
// exhausted and the task not done, every line that names a next action names the stop (D-124).
export function taskState({ rounds, spend, done = [], task, defaults, statement }) {
  const b = taskBudget({ rounds, spend, task, defaults, statement });
  const exhausted = Boolean(b?.exhausted);
  const errors = [];
  const say = (part, text) => `TASK ${task} · ${part}: ${text}`;
  const st = ofTask(rounds, task, "statement-review");
  const last = st.at(-1);
  const hash = statement?.hash ?? null;
  let statementLine;
  let approved = false;
  if (!last) statementLine = exhausted ? BUDGET_QUESTION : "it needs a review of the statement";
  else if (!isClean(last)) statementLine = stepNext({ rounds, done, task, step: "statement-review", exhausted, statement }).say;
  else if (!hash) statementLine = "the last round is clean; give --statement <file> to compare the version it read with the file";
  else if (last.statementHash !== hash) {
    const full = st.filter((r) => !r.narrow);
    const next = Math.max(0, ...full.map((r) => r.number)) + 1;
    const ceiling = full.find((r) => r.ceiling)?.ceiling;
    statementLine =
      full.length >= FULL_ROUNDS
        ? `the statement changed after ${FULL_ROUNDS} full rounds: a question to the owner`
        : exhausted
          ? BUDGET_QUESTION
          : `the statement changed after its approval: next is full round ${next} of the new version${ceiling ? (next <= ceiling ? `, within the ceiling of ${ceiling}` : `, past the ceiling of ${ceiling}`) : ""}`;
  } else approved = true;
  const rr = ofTask(rounds, task, "result-review");
  const end = rr.at(-1);
  const n = approved && end ? stepNext({ rounds, done, task, step: "result-review", exhausted, statement }) : null;
  const finished = n?.next === "clean";
  let resultLine;
  if (!approved) resultLine = "work is not allowed: no approval in force for the statement";
  else if (!end) resultLine = exhausted ? BUDGET_QUESTION : "the executor works, then records done with done.mjs";
  else if (finished) {
    if (b?.over) {
      resultLine = `done, with an overspend: ${overspendText(b)}; report it to the owner`;
      if (!end.overspend) errors.push(`${end.file}: the record of acceptance does not name the overspend (${overspendText(b)})`);
    } else resultLine = "done: the last round and its acceptance are clean";
  } else resultLine = n.say;
  if (approved)
    statementLine = finished
      ? `approved, version ${hash.slice(0, 12)}: the task is done`
      : exhausted
        ? `approved, version ${hash.slice(0, 12)}, but ${BUDGET_QUESTION}; work may not ${end ? "go on" : "start"}`
        : `approved, version ${hash.slice(0, 12)}: work may ${end ? "go on" : "start"} under it`;
  const lines = [say("statement", statementLine), say("result", resultLine)];
  if (b?.conflict.length)
    lines.push(`BUDGET ${task}: the spend cannot be summed, ${b.conflict.length} pair${b.conflict.length > 1 ? "s" : ""} of records of one contribution overlap: ${b.conflict.join("; ")}; ${BUDGET_QUESTION}, until the records are corrected`);
  else if (b) {
    const limit = (k) => (b.limits[k] === null ? `${LABEL[k]} ${b.used[k]}, no limit` : `${LABEL[k]} ${b.used[k]} of ${b.limits[k]} × ${b.reserve} = ${b.cap[k]}`);
    lines.push(
      `BUDGET ${task}: ${limit("newInput")}, ${limit("output")}; known for ${b.known} of ${b.parts} contributions` +
        (b.noReserve ? "; budget.reserve is not set, so the reserve is 1" : "") +
        (b.over ? `; overspend: ${overspendText(b)}` : b.exhausted ? "; exhausted" : ""),
    );
  }
  return { lines, errors, approved, budget: b };
}

// The environment of a command run on a commit: without the variable a running test runner sets, which
// would make a test runner started by the command report to it instead of failing.
export const cleanEnv = () => {
  const env = gitEnv();
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
