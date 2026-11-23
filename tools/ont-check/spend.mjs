#!/usr/bin/env node
// Spend from the session logs (D-169): counted again from the logs each time it is asked, with no base,
// mark or cursor kept, only where the configuration sets spend.fromLogs. --task, --rounds, round.mjs and
// done.mjs ask it first; only --task names an action by the budget.
//   node tools/ont-check/spend.mjs <task> --statement FILE [--config ont.config.json]
// The inputs come from the environment and never from the repository: the directories of the logs,
// ONT_CLAUDE_LOGS and ONT_CODEX_LOGS, each one or more directories separated as PATH separates them; the
// sessions of the executor of the unit, ONT_EXECUTOR_SESSIONS, IDs separated by commas or white space; and,
// for a task of a goal, the goal's statement, ONT_GOAL_STATEMENT, whose version must be approved in force.
// The unit of the budget is the goal the task's line Goal: names, read from the statement given or else from
// the task's records of the version that applies that copy it, or else the task itself; goals is the composition of a goal, which
// a line must name the task in, and by which a goal's own commands count it whole (D-179). The unit starts at its first
// brief of a round, or, for the rounds before the writers, at its first record of a round of the review of
// its statement; the logs are read whole and the events after the start counted. An event is a message of Claude, once by its ID, or a
// record token_count of Codex, whose part is the difference of its running totals with the record before it
// in the same session; each gives new input, cached input and output. The spend of the unit is the events
// after its start in the executor's sessions and in the sessions whose first message names the unit or one
// of its tasks; the spend of a task of a goal is only the sessions whose first message names that task; the
// spend of a round is the reviewer's session from the message that holds its brief up to the next brief.
// ont: derived.log-spend, field.task-statement.goal, field.spend-snapshot.unit, derived.task-budget, rule.budget-before-next, inv.contributions-apart
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, delimiter, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const ENV = { claude: "ONT_CLAUDE_LOGS", codex: "ONT_CODEX_LOGS", executor: "ONT_EXECUTOR_SESSIONS", goal: "ONT_GOAL_STATEMENT" };
const ms = (t) => (t ? Date.parse(t) : NaN);

// The files of logs under the directories, each a .jsonl file, those last changed before since left out:
// a file not written to after the start holds no event after it.
function logFiles(dirs, since) {
  const out = [];
  const walk = (d) => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".jsonl")) {
        // A file that cannot be read, such as a link to a file removed, holds no event.
        let mtime;
        try {
          mtime = statSync(p).mtimeMs;
        } catch {
          continue;
        }
        if (since !== null && mtime < since) continue;
        out.push(p);
      }
    }
  };
  for (const d of dirs) walk(d);
  return out.sort();
}
const lines = (file) => {
  const out = [];
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return out;
  }
  for (const l of text.split("\n")) {
    if (!l.trim()) continue;
    try {
      out.push(JSON.parse(l));
    } catch {
      // A line cut by a session still writing is not an event.
    }
  }
  return out;
};
const textOf = (content) =>
  typeof content === "string" ? content : Array.isArray(content) ? content.filter((c) => c && (c.type === "text" || c.type === "input_text") && typeof c.text === "string").map((c) => c.text).join("\n") : "";
// What a harness puts before the first message of a person or an agent is not that message: the
// instructions of a project and the environment, which begin so.
const injected = (t) => /^\s*(<[a-z_-]+>|# AGENTS\.md instructions)/i.test(t);

// A session of Claude: the file is the session, by its name, which also carries the session's own ID; an
// event is a message of the assistant, once by its ID, with the usage of its last line.
export function readClaude(file) {
  const ids = new Set([basename(file, ".jsonl")]);
  const messages = [];
  const byId = new Map();
  for (const o of lines(file)) {
    if (o.sessionId) ids.add(o.sessionId);
    if (o.type === "user" && !o.isMeta && o.message?.role === "user") {
      const text = textOf(o.message.content);
      if (text && !injected(text)) messages.push({ time: ms(o.timestamp), text });
    }
    const u = o.type === "assistant" && o.message?.id && o.message.usage;
    if (u) {
      const e = { key: `claude:${o.message.id}`, time: ms(o.timestamp), new: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0), cached: u.cache_read_input_tokens ?? 0, out: u.output_tokens ?? 0 };
      const was = byId.get(e.key);
      if (!was || e.out >= was.out) byId.set(e.key, was ? { ...e, time: was.time } : e);
    }
  }
  return { file, provider: "claude", ids, messages, events: [...byId.values()] };
}

// A session of Codex: an event is a record token_count, whose part is the difference of its running totals
// with the record before it in the same session; new input is the input not read from the cache.
export function readCodex(file) {
  const ids = new Set([basename(file, ".jsonl")]);
  const messages = [];
  const events = [];
  let prev = { input: 0, cached: 0, out: 0 };
  lines(file).forEach((o, i) => {
    const p = o.payload ?? {};
    if (o.type === "session_meta" && p.id) ids.add(p.id);
    if (o.type === "response_item" && p.type === "message" && p.role === "user") {
      const text = textOf(p.content);
      if (text && !injected(text)) messages.push({ time: ms(o.timestamp), text });
    }
    const t = o.type === "event_msg" && p.type === "token_count" && p.info?.total_token_usage;
    if (t) {
      const now = { input: t.input_tokens ?? 0, cached: t.cached_input_tokens ?? 0, out: t.output_tokens ?? 0 };
      events.push({ key: `codex:${file}#${i}`, time: ms(o.timestamp), new: now.input - now.cached - (prev.input - prev.cached), cached: now.cached - prev.cached, out: now.out - prev.out });
      prev = now;
    }
  });
  return { file, provider: "codex", ids, messages, events };
}

const dirsOf = (v) => (v ?? "").split(delimiter).map((x) => x.trim()).filter(Boolean);
// The sessions of the logs the environment names, each with its first message.
// One read serves the calls of one run, such as --rounds over every task: a read from an earlier start holds
// every file a later start needs, and the sums filter the events by time.
let cache = null;
export function readSessions(env = process.env, since = null) {
  const key = `${env[ENV.claude] ?? ""}\0${env[ENV.codex] ?? ""}`;
  const from = since ?? -Infinity;
  if (cache && cache.key === key && cache.from <= from) return cache.sessions;
  const sessions = readFresh(env, since);
  cache = { key, from, sessions };
  return sessions;
}
function readFresh(env, since) {
  const claude = logFiles(dirsOf(env[ENV.claude]), since).map(readClaude);
  const codex = logFiles(dirsOf(env[ENV.codex]), since).map(readCodex);
  return [...claude, ...codex].map((s) => ({ ...s, first: s.messages.slice().sort((a, b) => a.time - b.time)[0]?.text ?? "" }));
}

// Whether a text names a task or a goal: the name as a word of its own, never as a part of a longer name,
// so that a goal enforcement is not named by enforcement-tool-records.
export const names = (text, name) => new RegExp(`(?<![a-z0-9-])${name.replace(/[-]/g, "\\-")}(?![a-z0-9]|-[a-z0-9])`).test(text ?? "");

const zero = () => ({ new: 0, cached: 0, out: 0 });
// The sum of the events of sessions within [from, to): each event once, by its key.
export function sumEvents(sessions, from = -Infinity, to = Infinity) {
  const seen = new Set();
  const s = zero();
  for (const x of sessions)
    for (const e of x.events) {
      if (!(e.time > from && e.time < to) || seen.has(e.key)) continue;
      seen.add(e.key);
      s.new += e.new;
      s.cached += e.cached;
      s.out += e.out;
    }
  return s;
}

// The lines of a brief that identify it in a message: its task, step, number and time.
const briefMarks = (b) => [`Task: ${b.task}`, `Step: ${b.step}`, `Number: ${b.number}`, `Brief-time: ${b.briefTime}`];
const holdsBrief = (text, b) => {
  const ls = new Set(text.split("\n").map((l) => l.trim()));
  return briefMarks(b).every((m) => ls.has(m));
};
const isBriefText = (text) => /^Brief-time:\s*\S/m.test(text) && /^Task:\s*\S/m.test(text);
// The spend of one round: in each session with a message that holds its brief, the events from that
// message up to the next message of that session that holds any brief. found is false when no session
// holds it.
export function roundSpend(sessions, brief) {
  const parts = [];
  for (const s of sessions) {
    const at = s.messages.filter((m) => holdsBrief(m.text, brief));
    if (!at.length) continue;
    const from = Math.min(...at.map((m) => m.time));
    const next = s.messages.filter((m) => m.time > from && isBriefText(m.text) && !holdsBrief(m.text, brief)).map((m) => m.time);
    parts.push({ s, from, to: next.length ? Math.min(...next) : Infinity });
  }
  if (!parts.length) return { found: false, sum: zero() };
  const sum = zero();
  for (const p of parts) {
    const x = sumEvents([p.s], p.from - 1, p.to);
    sum.new += x.new;
    sum.cached += x.cached;
    sum.out += x.out;
  }
  return { found: true, sum, sessions: parts.map((p) => p.s) };
}

// The unit of the budget of a task (field.task-statement.goal, D-179): the goal its line Goal: names, line,
// where the task has one, or else the task itself, with no error; a goal itself is its own unit, whose
// members are the tasks goals lists under it, those whose statements have no line included. goals is the
// composition: a line that names a goal goals does not list, or one whose list does not hold the task, is
// an error, and so is a task listed under two goals. of names the text the line is read from, a statement,
// a kept brief, a record of done or a snapshot of spend.
export function goalOf(cfg, task, { line = null, of = "the statement" } = {}) {
  const goals = cfg.goals ?? {};
  if (Object.hasOwn(goals, task)) return { unit: task, goal: true, members: [...goals[task]], isGoal: true };
  const under = Object.keys(goals).filter((g) => goals[g].includes(task));
  if (under.length > 1) return { error: `the configuration lists ${task} under more than one goal, ${under.join(", ")}` };
  if (line === null || line === undefined) return { unit: task, goal: false, members: [task] };
  if (!Object.hasOwn(goals, line)) return { error: `${of} names the goal ${line} on Goal:, and the configuration lists no goal ${line} under goals` };
  if (!goals[line].includes(task)) return { error: `${of} names the goal ${line} on Goal:, and the configuration does not list ${task} among its tasks` };
  return { unit: line, goal: true, members: [...goals[line]] };
}

// What is wrong with a line Goal: against the configuration's goals (D-179), or null: line is the goal the
// line names, or null where the text has none, which is never wrong; of names the text.
export function goalLineProblem(cfg, task, { line = null, of = "the statement" } = {}) {
  if (line === null || line === undefined) return null;
  return goalOf(cfg, task, { line, of }).error ?? null;
}

// The start of a unit: the earliest time of a brief of a round of any of its tasks or of the goal itself,
// a brief kept by round.mjs and not yet recorded among them; for a round recorded before the writers, with
// no Brief-time:, the time of a round of the review of the statement. null when no round has begun.
export function unitStart(rounds, members, pending = []) {
  const of = (t) => members.includes(t);
  const times = [
    ...rounds.filter((r) => of(r.task) && r.briefTime).map((r) => r.briefTime),
    ...rounds.filter((r) => of(r.task) && !r.briefTime && r.step === "statement-review").map((r) => r.time),
    ...pending.filter((b) => of(b.task)).map((b) => b.briefTime),
  ].filter(Boolean);
  return times.length ? times.sort()[0] : null;
}

// The cap of a limit with its reserve, exact in whole numbers (D-150), and whether a spend reached it.
export const capOf = (limit, reserve) => {
  if (limit === null || limit === undefined) return null;
  const r = reserve ?? 1;
  const den = 10 ** (String(r).split(".")[1] ?? "").length;
  return (limit * Math.round(r * den)) / den;
};
export const reached = (used, cap, strict = false) => cap !== null && (strict ? used > cap : used >= cap);

// The whole state of spend of a task (D-169): its unit, the start, the sums of the unit and of the task,
// the limits each was compared with, and whether either is spent; null where the configuration does not
// set spend.fromLogs; with missing, the inputs the environment does not give. limits are the task's limits
// and reserve of the version of its statement that applies, as derived.task-budget gives them for that
// version (D-174); goalLine the task's line Goal:, { line, of }, as goalLineOf of tasks.mjs reads it from the
// statement given or else from the task's records (D-179); approvedOf(task) the version approved in force.
export function logSpend({ cfg, task, goalLine = {}, rounds, pending = [], limits, approvedOf, readStatementFile, env = process.env, sessions = null }) {
  if (cfg.spend?.fromLogs !== true) return null;
  // The scope of the budget: the goal the task's line Goal: names, or else the task (D-179).
  const u = goalOf(cfg, task, goalLine);
  if (u.error) return { errors: [u.error], missing: [] };
  const members = [...new Set([...u.members, u.unit])];
  const missing = [];
  if (!dirsOf(env[ENV.claude]).length && !dirsOf(env[ENV.codex]).length) missing.push(`${ENV.claude} or ${ENV.codex}, the directories of the session logs`);
  const executor = (env[ENV.executor] ?? "").split(/[\s,]+/).filter(Boolean);
  if (!executor.length) missing.push(`${ENV.executor}, the sessions of the executor`);
  // The limits of the goal, from its statement, whose version must be the one approved in force.
  let unitLimits = null;
  const errors = [];
  if (u.goal && !u.isGoal) {
    const file = env[ENV.goal];
    if (!file) missing.push(`${ENV.goal}, the statement of the goal ${u.unit}`);
    else if (!existsSync(file)) errors.push(`${ENV.goal} names ${file}, which is not a file`);
    else {
      const gs = readStatementFile(file);
      const approved = approvedOf(u.unit);
      if (approved !== gs.hash) errors.push(`the statement of the goal ${u.unit} given by ${ENV.goal} is version ${gs.hash.slice(0, 12)}, and ${approved ? `version ${approved.slice(0, 12)}` : "no version"} is approved in force`);
      else unitLimits = { newInput: gs.budget.newInput, output: gs.budget.output, reserve: gs.budget.reserve, hash: gs.hash };
    }
  }
  if (missing.length || errors.length) return { unit: u.unit, goal: u.goal, missing, errors };
  const taskLimits = limits;
  if (!u.goal || u.isGoal) unitLimits = taskLimits;
  const start = unitStart(rounds, members, pending);
  const all = sessions ?? readSessions(env, start === null ? null : ms(start));
  const from = start === null ? Infinity : ms(start);
  const isExecutor = (s) => executor.some((id) => s.ids.has(id));
  const ofUnit = all.filter((s) => isExecutor(s) || members.some((t) => names(s.first, t)));
  const ofTask = u.goal && !u.isGoal ? all.filter((s) => names(s.first, task)) : ofUnit;
  const used = { unit: sumEvents(ofUnit, from), task: sumEvents(ofTask, from) };
  const side = (k) => {
    const l = k === "unit" ? unitLimits : taskLimits;
    const cap = { newInput: capOf(l.newInput, l.reserve), output: capOf(l.output, l.reserve) };
    return {
      limits: l,
      cap,
      exhausted: reached(used[k].new, cap.newInput) || reached(used[k].out, cap.output),
      over: reached(used[k].new, cap.newInput, true) || reached(used[k].out, cap.output, true),
    };
  };
  const unitSide = side("unit");
  const taskSide = side("task");
  return {
    unit: u.unit, goal: u.goal, isGoal: u.isGoal === true, members, start, used, missing: [], errors: [], sessions: all,
    limits: { unit: unitSide.limits, task: taskSide.limits }, cap: { unit: unitSide.cap, task: taskSide.cap },
    exhausted: unitSide.exhausted || taskSide.exhausted, over: unitSide.over || taskSide.over,
    which: [unitSide.exhausted && (u.goal ? `the goal ${u.unit}` : `the task ${task}`), u.goal && !u.isGoal && taskSide.exhausted && `the task ${task}`].filter(Boolean),
  };
}

// The text of an overspend from a snapshot or a state of spend (field.review-round.overspend, D-169): for
// the task, and for its goal when the unit is a goal other than the task, past its cap, "new input N of C,
// output N of C" each with a cap; none within. A goal itself, isGoal, is its own unit: its unit and its task
// are one sum against one set of limits, so it has the task's part alone, as snapshotSpend reads a snapshot
// whose Unit: is its Task: (D-179).
const LABEL = { newInput: ["new", "new input"], output: ["out", "output"] };
export function overspendOf({ unit, goal, isGoal = false, used, cap }) {
  const part = (k) => {
    const c = cap[k];
    const over = ["newInput", "output"].some((x) => c[x] !== null && used[k][LABEL[x][0]] > c[x]);
    return over ? ["newInput", "output"].filter((x) => c[x] !== null).map((x) => `${LABEL[x][1]} ${used[k][LABEL[x][0]]} of ${c[x]}`).join(", ") : null;
  };
  const t = part("task");
  const g = goal && !isGoal ? part("unit") : null;
  return [t, g && `goal ${unit}: ${g}`].filter(Boolean).join("; ") || null;
}

// The state of spend a snapshot gives, for a reader that has no logs, as CI (D-169).
export function snapshotSpend(s) {
  const cap = { unit: { newInput: capOf(s.limits.unit.newInput, s.limits.unit.reserve), output: capOf(s.limits.unit.output, s.limits.unit.reserve) }, task: { newInput: capOf(s.limits.task.newInput, s.limits.task.reserve), output: capOf(s.limits.task.output, s.limits.task.reserve) } };
  const used = { unit: s.sums.unit, task: s.sums.task ?? s.sums.unit };
  const goal = s.unit !== s.task;
  const ex = (k, strict) => reached(used[k].new, cap[k].newInput, strict) || reached(used[k].out, cap[k].output, strict);
  return { unit: s.unit, goal, used, cap, limits: s.limits, start: s.start, exhausted: ex("unit") || ex("task"), over: ex("unit", true) || ex("task", true), fromSnapshot: s.file, which: [] };
}

// The lines of a snapshot of spend, without its seal (D-169).
export function snapshotLines({ task, sp, round = null, roundSum = null, time }) {
  const sums = (name, x) => (x ? [`${name}-new: ${x.new}`, `${name}-cached: ${x.cached}`, `${name}-out: ${x.out}`] : []);
  const lim = (name, l) => [`${name}-limit-new: ${l?.newInput ?? "none"}`, `${name}-limit-out: ${l?.output ?? "none"}`, `${name}-reserve: ${l?.reserve ?? "none"}`, `${name}-statement-hash: ${l?.hash ?? l?.version ?? "none"}`];
  return [
    "Record: spend-snapshot",
    `Task: ${task}`,
    `Unit: ${sp.unit}`,
    `Round: ${round ?? "none"}`,
    `Time: ${time}`,
    `Unit-start: ${sp.start ?? "none"}`,
    ...sums("Unit", sp.used.unit),
    ...sums("Task", sp.used.task),
    ...sums("Round", roundSum),
    ...lim("Unit", sp.limits.unit),
    ...lim("Task", sp.limits.task),
    "",
  ].join("\n");
}

// The lines --task, --rounds and the writers print of a state of spend.
export function spendLines(task, sp) {
  if (!sp) return [];
  if (sp.errors?.length) return [`SPEND ${task}: ${sp.errors.join("; ")}`];
  const notRead = sp.missing?.length ? `the session logs are not read: the environment does not give ${sp.missing.join("; ")}` : null;
  if (notRead && !sp.used) return [`SPEND ${task}: ${notRead}`];
  const side = (k, name) => {
    const c = sp.cap[k];
    const l = sp.limits[k];
    const one = (x, label) => (c[x] === null ? `${label} ${sp.used[k][LABEL[x][0]]}, no limit` : `${label} ${sp.used[k][LABEL[x][0]]} of ${l[x]} × ${l.reserve ?? 1} = ${c[x]}`);
    return `${name} ${one("newInput", "new input")}, ${one("output", "output")}`;
  };
  const src = sp.fromSnapshot ? `the snapshot ${sp.fromSnapshot}` : `the session logs since ${sp.start ?? "no round yet"}`;
  return [`SPEND ${task}: from ${src}: ${sp.goal ? `${side("unit", `goal ${sp.unit}`)}; ${side("task", `task ${task}`)}` : side("task", `task ${task}`)}${sp.over ? "; past the reserve" : sp.exhausted ? "; the reserve is spent" : ""}`, ...(notRead ? [`SPEND ${task}: ${notRead}`] : [])];
}

// The marks of the budget the spend has passed (derived.budget-report), for the unit and the task.
export function spendMarks(sp) {
  if (!sp?.used || !sp.limits) return [];
  const out = [];
  for (const k of sp.goal ? ["unit", "task"] : ["task"])
    for (const [x, label] of [["newInput", "new input"], ["output", "output"]]) {
      const l = sp.limits[k][x];
      const u = sp.used[k][LABEL[x][0]];
      if (l === null || l === undefined) continue;
      const marks = [u * 2 >= l && "half", u >= l && "limit"].filter(Boolean);
      if (marks.length) out.push(`${k === "unit" ? `goal ${sp.unit}` : "task"} ${label} ${u} of ${l}: ${marks.join(", ")}`);
    }
  return out;
}

async function main(argv) {
  const { loadConfig } = await import("./lib.mjs");
  const tasks = await import("./tasks.mjs");
  const value = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
  const task = argv[0];
  if (!task || task.startsWith("--")) return console.log("ERROR · give the task first: spend.mjs <task> --statement FILE"), 1;
  const cfg = loadConfig(value("--config") ?? "ont.config.json");
  const file = value("--statement");
  const statement = file ? tasks.readStatement(file) : null;
  const sp = tasks.spendOf({ cfg, task, statement });
  if (!sp) return console.log(`SPEND ${task}: the configuration does not set spend.fromLogs: spend is read from the records`), 0;
  for (const l of spendLines(task, sp)) console.log(l);
  for (const m of spendMarks(sp)) console.log(`REPORT ${task}: ${m}`);
  return sp.errors?.length || sp.missing?.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2)).then((c) => (process.exitCode = c));
