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

// Two records of one contribution whose intervals overlap, even in part (inv.contributions-apart). A
// record that begins after it ends is malformed and never reaches here.
export function overlaps(rounds, spend) {
  const runs = [
    ...rounds.filter((r) => r.contribution && r.start).map((r) => ({ file: r.file, key: r.contribution.key, start: r.start, end: r.time })),
    ...spend.map((s) => ({ file: s.file, key: s.contribution.key, start: s.start, end: s.end })),
  ];
  const out = [];
  runs.forEach((a, i) =>
    runs.slice(i + 1).forEach((b) => {
      if (a.key === b.key && a.start < b.end && b.start < a.end)
        out.push(`${a.file} (${a.start}–${a.end}) and ${b.file} (${b.start}–${b.end}): one contribution, ${a.key}, over intervals that overlap`);
    }),
  );
  return out;
}

const ofTask = (rounds, task, step) => byTime(rounds.filter((r) => r.task === task && (!step || r.step === step)));

// The hash of the version under an approval in force: the last round by time of the review of the
// statement is clean and names the version it read (derived.approval).
export function approvedHash(rounds, task) {
  const last = ofTask(rounds, task, "statement-review").at(-1);
  return last && isClean(last) && last.statementHash ? last.statementHash : null;
}

// Why each verdict of acceptance is refused (inv.acceptance-after-done).
export function acceptanceProblems(rounds, done) {
  const out = [];
  for (const r of rounds.filter((x) => x.acceptance)) {
    const records = done.filter((d) => d.task === r.task).sort((a, b) => a.time.localeCompare(b.time));
    const before = records.filter((d) => d.time <= r.time).at(-1);
    const why = !records.length
      ? "there is no record of done"
      : !before
        ? "it was given before the record of done was made"
        : before.checks.some((c) => c.result !== "pass")
          ? `the record of done ${before.file} has a check that failed`
          : r.statementHash !== before.statementHash
            ? `it names another version of the statement than the record of done ${before.file}`
            : approvedHash(rounds, r.task) !== before.statementHash
              ? "no approval is in force for that version of the statement"
              : null;
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
  const parts = [...rounds.filter((r) => r.task === task), ...spend.filter((s) => s.task === task)];
  const sum = (k) => parts.reduce((a, p) => a + (p.tokens[k] ?? 0), 0);
  const used = { newInput: sum("new"), output: sum("out") };
  const known = parts.filter((p) => p.tokens.new !== null && p.tokens.out !== null).length;
  const cap = (k) => (limits[k] === null ? null : limits[k] * reserve);
  const reached = (k, strict) => cap(k) !== null && (strict ? used[k] > cap(k) : used[k] >= cap(k));
  return {
    limits,
    reserve,
    noReserve: defaults?.reserve === null || defaults?.reserve === undefined,
    used,
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

// What a task needs next, its statement, its result and its budget, as lines; and the errors of its
// records that only --task can see (derived.statement-state, rule.budget-before-next).
export function taskState({ rounds, spend, task, defaults, statement }) {
  const b = taskBudget({ rounds, spend, task, defaults, statement });
  const exhausted = Boolean(b?.exhausted);
  const errors = [];
  const say = (part, text) => `TASK ${task} · ${part}: ${text}`;
  const lines = [];
  const st = ofTask(rounds, task, "statement-review");
  const last = st.at(-1);
  const hash = statement?.hash ?? null;
  let approved = false;
  if (!last) lines.push(say("statement", exhausted ? BUDGET_QUESTION : "it needs a review of the statement"));
  else if (!isClean(last)) lines.push(say("statement", nextRound(st, { exhausted }).say));
  else if (!hash) lines.push(say("statement", "the last round is clean; give --statement <file> to compare the version it read with the file"));
  else if (last.statementHash !== hash) {
    const full = st.filter((r) => !r.narrow);
    const next = Math.max(0, ...full.map((r) => r.number)) + 1;
    const ceiling = full.find((r) => r.ceiling)?.ceiling;
    lines.push(
      say(
        "statement",
        full.length >= FULL_ROUNDS
          ? `the statement changed after ${FULL_ROUNDS} full rounds: a question to the owner`
          : exhausted
            ? BUDGET_QUESTION
            : `the statement changed after its approval: next is full round ${next} of the new version${ceiling ? (next <= ceiling ? `, within the ceiling of ${ceiling}` : `, past the ceiling of ${ceiling}`) : ""}`,
      ),
    );
  } else {
    approved = true;
    const started = rounds.some((r) => r.task === task && r.step === "result-review");
    lines.push(
      say("statement", exhausted && !started ? `approved, version ${hash.slice(0, 12)}, but ${BUDGET_QUESTION}; work may not start` : `approved, version ${hash.slice(0, 12)}: work may start under it`),
    );
  }
  const rr = ofTask(rounds, task, "result-review");
  const end = rr.at(-1);
  if (!approved) lines.push(say("result", "work is not allowed: no approval in force for the statement"));
  else if (!end) lines.push(say("result", exhausted ? BUDGET_QUESTION : "the executor works, then records done with done.mjs"));
  else if (isClean(end) && !end.acceptance) lines.push(say("result", "the last round is clean on merging and gives no verdict of acceptance yet"));
  else if (isClean(end)) {
    if (b?.over) {
      lines.push(say("result", `done, with an overspend: ${overspendText(b)}; report it to the owner`));
      if (!end.overspend) errors.push(`${end.file}: the record of acceptance does not name the overspend (${overspendText(b)})`);
    } else lines.push(say("result", "done: the last round and its acceptance are clean"));
  } else lines.push(say("result", nextRound(rr, { exhausted }).say));
  if (b) {
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
