#!/usr/bin/env node
// The executor's record of done (D-152): runs the commands of done of the task's statement on the
// commit, in a temporary worktree, and writes the record only under an approval in force for the
// statement's version and when every command passed.
//   node tools/ont-check/done.mjs <task> --statement FILE [--config ont.config.json] [--commit REF]
// The commands are the statement's lines "Done-when:", run from the directory of the configuration.
// After the narrow round that follows a confirmed condition, the record of done ends the range of fixes
// (rule.fixes-held-by-tests, D-162): its commit is the end fixesRange gives, and it comes after the
// commit the narrow round reviewed.
// ont: action.record-done, ent.task-result, inv.acceptance-after-done, rule.work-under-approval, rule.fixes-held-by-tests
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { loadConfig } from "./lib.mjs";
import { TASK_NAME } from "./review-rounds.mjs";
import { approvedHash, budgetLines, fixesRange, gitEnv, readStatement, readTaskInputs, runAtCommit, taskNext } from "./tasks.mjs";

const argv = process.argv.slice(2);
const value = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
const refuse = (why) => {
  console.log(`ERROR · no record of done written: ${why}`);
  process.exit(1);
};
const task = argv[0];
if (!task || task.startsWith("--")) refuse("give the task first: done.mjs <task> --statement FILE");
// The task names the record's file, so it is only what TASK_NAME allows (D-115): never a path.
if (!TASK_NAME.test(task)) refuse(`the task ${JSON.stringify(task)} is not lower-case letters, digits and hyphens`);
const cfg = loadConfig(value("--config") ?? "ont.config.json");
if (!cfg.reviewRounds || !cfg.taskRecords) refuse("the configuration names no reviewRounds or no taskRecords");
const file = value("--statement");
if (!file) refuse("give the statement with --statement FILE");
const statement = readStatement(file);
// The records of rounds are read as the check reads them; one that cannot be read blocks every task, so
// that an approval it would have withdrawn is never taken for one in force (D-152).
// Every record is read as the check reads it, by readTaskInputs, the commits records name resolved too.
const { rounds, malformed, records } = readTaskInputs(cfg);
// The owner's approvals count as the check counts them (D-121).
const { approvals } = records;
// The task's one next action, as --task gives it (derived.task-next, D-152), asked for new work, before
// any refusal of done.mjs's own, so that it refuses with the action --task and --rounds give: an
// unreadable record, a spent budget, an open gate, a statement under review or changed. Done is recorded
// only when it is a step of the work on the result; a task done already does not stand for new work.
const next = taskNext({ rounds, spend: records.spend, done: records.done, approvals, task, defaults: cfg.budget, statement, malformed, needFile: true, gatesFrom: cfg.reviewRounds.gatesFrom, forWork: true });
// Done is recorded only on an action of kind work, never by the name of a branch (D-152).
if (next.kind === "correct" && malformed.length) refuse(`${next.say}: ${malformed.join("; ")}`);
if (next.kind !== "work") refuse(`the task's next action is not work on the result: ${next.say}`);
// Safety nets after the action, which refuses both first: a statement with no command of done, and a
// line of its budget the tool cannot read, which a record of done never writes as none (D-150).
if (!statement.doneWhen.length) refuse("the statement has no line Done-when: with a command of done");
if (statement.wrong?.length) refuse(`the statement's ${statement.wrong.join("; ")}`);
// A safety net after the action: done is recorded only under an approval in force for the file's version.
const approved = approvedHash(rounds, task, null, approvals);
if (approved !== statement.hash)
  refuse(
    approved
      ? `the approval in force is for version ${approved.slice(0, 12)}, the file is ${statement.hash.slice(0, 12)}`
      : "no approval is in force for the statement: its last round of review is not clean or names no version, and no approval of the owner follows it",
  );
const git = (...a) => spawnSync("git", ["-C", cfg.base, ...a], { encoding: "utf8", env: gitEnv() });
const top = git("rev-parse", "--show-toplevel").stdout.trim();
const commit = git("rev-parse", "--verify", `${value("--commit") ?? "HEAD"}^{commit}`).stdout.trim();
if (!commit) refuse(`no commit ${value("--commit") ?? "HEAD"}`);
// The range of fixes ends at the commit done is recorded on, by the one function that gives it: a record of
// done after the narrow round is of a commit after the one that round reviewed.
const range = fixesRange({ rounds, done: records.done, approvals, task, head: commit, statement });
if (range?.from && !range.done && git("merge-base", "--is-ancestor", range.from, commit).status !== 0)
  refuse(`after the narrow round ${range.narrow.file}, done is recorded on the last commit of its fixes, after the commit it reviewed, ${range.from}; ${commit.slice(0, 7)} is not after it`);
const run = runAtCommit({ top, commit, dir: relative(top, cfg.base), commands: statement.doneWhen });
if (run.error) refuse(run.error);
const failed = run.results.filter((r) => r.result !== "pass");
if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f.command}\n${f.output.split("\n").slice(-15).join("\n")}`);
  refuse(`${failed.length} of ${run.results.length} commands of done failed on ${commit.slice(0, 7)}`);
}
const time = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
mkdirSync(cfg.taskRecords.dir, { recursive: true });
// The statement's limits go into the record, for the check and --rounds, which read no statement (D-147).
const text = [`Record: done`, `Task: ${task}`, `Commit: ${commit}`, `Statement-hash: ${statement.hash}`, ...budgetLines(statement.budget), `Time: ${time}`, `Checks:`, ...run.results.map((r) => `- ${r.command} · ${r.result}`), ""].join("\n");
// A record is never written over another: two records of one second take the next free name.
let name;
for (let i = 1; ; i++) {
  name = `${time.replaceAll(/[-:]/g, "")}-${task}-done${i > 1 ? `-${i}` : ""}.md`;
  try {
    writeFileSync(join(cfg.taskRecords.dir, name), text, { flag: "wx" });
    break;
  } catch (e) {
    if (e.code !== "EEXIST") refuse(`the record was not written: ${e.message}`);
  }
}
console.log(`DONE ${task}: ${run.results.length} commands passed on ${commit.slice(0, 7)}; recorded in ${relative(process.cwd(), join(cfg.taskRecords.dir, name))}`);
if (range?.from && !range.done && range.acceptance === "held" && !commit.startsWith(range.from))
  console.log(`RANGE ${task}: this record of done ends the range of fixes after the narrow round ${range.narrow.file}, from ${range.from} to ${commit.slice(0, 12)} (rule.fixes-held-by-tests)`);
