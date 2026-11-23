// The briefs of rounds (D-168): one file for each round round.mjs brief has given and round.mjs record has
// not yet recorded, in the directory ont-briefs/ of the Git directory of the working copy, so that a
// linked worktree keeps its own, and nothing of it is in the tree. A brief is used once: the record of
// its round removes it.
// ont: ent.round-brief, field.round-brief.lines, edge.round-brief.round, edge.round-brief.statement
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { gitEnv } from "./lib.mjs";

// The lines of a brief, in their order; Goal: only when the statement names one, the scope of the budget
// round.mjs record takes from the brief (D-172), and the statement's limits and reserve, each a number or
// none, which it takes with it (D-173); Done: only for a round of the review of the result.
export const BRIEF_BUDGET = ["Budget-new-input", "Budget-output", "Budget-reserve"];
export const BRIEF_FIELDS = ["Task", "Step", "Narrow", "Number", "Statement-hash", "Goal", ...BRIEF_BUDGET, "Commits", "Done", "Brief-time"];

// The directory of the briefs: ont-briefs/ under git rev-parse --git-dir, or null outside Git.
export function briefsDir(base) {
  const r = spawnSync("git", ["-C", base, "rev-parse", "--git-dir"], { encoding: "utf8", env: gitEnv() });
  const d = r.status === 0 ? r.stdout.trim() : "";
  if (!d) return null;
  return join(isAbsolute(d) ? d : join(base, d), "ont-briefs");
}
export const briefText = (b) => BRIEF_FIELDS.filter((k) => b[k] !== undefined && b[k] !== null).map((k) => `${k}: ${b[k]}`).join("\n");
export function parseBrief(text) {
  const b = {};
  for (const l of text.split("\n")) {
    const m = l.match(/^([A-Za-z-]+):[ \t]*(.*?)\s*$/);
    if (m && BRIEF_FIELDS.includes(m[1]) && !(m[1] in b)) b[m[1]] = m[2];
  }
  return b;
}
const fileOf = (task, step) => `${task}-${step}.brief`;
export function writeBrief(base, b) {
  const dir = briefsDir(base);
  if (!dir) throw new Error("not in a Git repository: a brief is kept in its Git directory");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, fileOf(b.Task, b.Step)), `${briefText(b)}\n`);
  return join(dir, fileOf(b.Task, b.Step));
}
export function readBrief(base, task, step) {
  const dir = briefsDir(base);
  const f = dir && join(dir, fileOf(task, step));
  return f && existsSync(f) ? { file: f, brief: parseBrief(readFileSync(f, "utf8")), text: readFileSync(f, "utf8").trimEnd() } : null;
}
export const removeBrief = (file) => rmSync(file, { force: true });
// Every brief kept and not yet recorded, as the start of a unit reads them: task, step, number and time,
// the goal it names, and the brief itself, whose version and limits a reader given no statement takes.
export function pendingBriefs(base) {
  const dir = briefsDir(base);
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".brief"))
    .map((f) => parseBrief(readFileSync(join(dir, f), "utf8")))
    .filter((b) => b.Task && b["Brief-time"])
    .map((b) => ({ task: b.Task, step: b.Step, number: b.Number, briefTime: b["Brief-time"], goal: b.Goal ?? null, brief: b }));
}
