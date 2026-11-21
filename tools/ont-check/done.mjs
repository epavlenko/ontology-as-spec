#!/usr/bin/env node
// The executor's record of done (D-107): runs the commands of done of the task's statement on the
// commit, in a temporary worktree, and writes the record only under an approval in force for the
// statement's version and when every command passed.
//   node tools/ont-check/done.mjs <task> --statement FILE [--config ont.config.json] [--commit REF]
// The commands are the statement's lines "Done-when:", run from the directory of the configuration.
// ont: action.record-done, ent.task-result, inv.acceptance-after-done, rule.work-under-approval
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { loadConfig } from "./lib.mjs";
import { TASK_NAME, parseRounds } from "./review-rounds.mjs";
import { approvedHash, budgetLines, gitEnv, parseTaskRecords, readStatement, runAtCommit } from "./tasks.mjs";

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
if (!statement.doneWhen.length) refuse("the statement has no line Done-when: with a command of done");
// A record of done carries the statement's budget; a line of it the tool cannot read is refused, never
// written as none (D-150).
if (statement.wrong?.length) refuse(`the statement's ${statement.wrong.join("; ")}`);
const { rounds } = parseRounds(cfg.reviewRounds.dir);
// The owner's approvals count as the check counts them (D-121).
const { approvals } = parseTaskRecords(cfg.taskRecords.dir);
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
