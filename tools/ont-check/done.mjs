#!/usr/bin/env node
// The executor's record of done (D-152): runs the commands of done of the task's statement on the
// commit, in a temporary worktree, and writes the record only under an approval in force for the
// statement's version and when every command passed.
//   node tools/ont-check/done.mjs <task> --statement FILE [--config ont.config.json] [--commit REF] [--evidence FILE]
// The commands are the statement's lines "Done-when:", run from the directory of the configuration.
// --evidence FILE: what the statement asks the record to name besides the commands, such as each row of
// the catalogue the task changed; each line of the file that is not blank goes under a line "Evidence:"
// after the checks, and where the configuration sets records.latinOnly the file holds only English text
// and paths of the repository, or nothing is written (field.task-result.evidence, D-166).
// After the narrow round that follows a confirmed condition, the record of done ends the range of fixes
// (rule.fixes-held-by-tests, D-164): its commit is the end fixesRange gives, and it comes after the
// commit the narrow round reviewed.
// ont: rule.records-by-tool, field.process-record.seal, action.record-done, ent.task-result, field.task-result.evidence, inv.acceptance-after-done, rule.work-under-approval, rule.fixes-held-by-tests
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pendingBriefs } from "./briefs.mjs";
import { loadConfig } from "./lib.mjs";
import { workCommit } from "./merge-gate.mjs";
import { outsideRecord } from "./manual-runs.mjs";
import { TASK_NAME } from "./review-rounds.mjs";
import { sealed, timeAfter } from "./seal.mjs";
import { approvedHash, budgetLines, fixesRange, gitEnv, readStatement, readTaskInputs, runAtCommit, spendOf, taskNext } from "./tasks.mjs";

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
const inputs = readTaskInputs(cfg);
const { rounds, malformed, records } = inputs;
// The owner's approvals count as the check counts them (D-121).
const { approvals } = records;
// The spend first, from the session logs where the configuration counts it so (D-169): without the inputs
// no record of done is written, and a spent reserve of the goal or of the task refuses it below, by the
// task's next action. A project without spend.fromLogs writes done as before.
const spendNow = spendOf({ cfg, task, statement, inputs });
if (spendNow?.errors?.length) refuse(spendNow.errors.join("; "));
if (spendNow?.missing?.length) refuse(`the spend cannot be counted: the environment does not give ${spendNow.missing.join("; ")}`);
// The task's one next action, as --task gives it (derived.task-next, D-152), asked for new work, before
// any refusal of done.mjs's own, so that it refuses with the action --task and --rounds give: an
// unreadable record, a spent budget, an open gate, a statement under review or changed. Done is recorded
// only when it is a step of the work on the result; a task done already does not stand for new work.
const next = taskNext({ rounds, spend: records.spend, done: records.done, approvals, task, defaults: cfg.budget, statement, malformed, needFile: true, gatesFrom: cfg.reviewRounds.gatesFrom, forWork: true, spendNow, pending: pendingBriefs(cfg.base), snapshots: records.snapshots });
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
// The evidence, read and held to the rule of language before any command runs (D-166).
const evidenceFile = value("--evidence");
let evidence = [];
if (argv.includes("--evidence")) {
  if (!evidenceFile || evidenceFile.startsWith("--")) refuse("give the evidence with --evidence FILE");
  let text;
  try {
    text = readFileSync(evidenceFile, "utf8");
  } catch (e) {
    refuse(`the evidence ${evidenceFile} cannot be read: ${e.code ?? e.message}`);
  }
  const outside = cfg.records.latinOnly ? outsideRecord(text, 1, { latinOnly: true }) : [];
  if (outside.length) refuse(`the evidence ${evidenceFile} holds what a record here may not: ${outside.join("; ")}`);
  evidence = text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => (/^-\s/.test(l) ? l : `- ${l}`));
  if (!evidence.length) refuse(`the evidence ${evidenceFile} has no line that is not blank`);
}
const git = (...a) => spawnSync("git", ["-C", cfg.base, ...a], { encoding: "utf8", env: gitEnv() });
const top = git("rev-parse", "--show-toplevel").stdout.trim();
// The commit of done: --commit, or the commit that ended the work at HEAD, under any commits of records
// alone, the one the writer of verdicts and the guard name too (derived.change-verdict, D-186).
const commit = value("--commit") ? git("rev-parse", "--verify", `${value("--commit")}^{commit}`).stdout.trim() : workCommit(cfg) ?? "";
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
// The tests of the fixes (field.task-result.fix-tests, D-186): where this record ends a range of fixes,
// each test a record of fixes of the narrow round names is run alone on the commit, apart from the commands
// of done, by its name, and must have run and passed: one not found, skipped, marked todo or failed writes
// no record. The guard counts a decision by a test only by this block.
// ont: field.task-result.fix-tests, rule.one-issue-after-narrow
const fixTests = [];
if (range?.from && !range.done) {
  const named = (records.fixes ?? []).filter((f) => f.task === task && f.round === range.narrow.file).flatMap((f) => f.tests);
  const seen = new Set();
  const quote = (x) => `'${String(x).replaceAll("'", "'\\''")}'`;
  const pattern = (x) => `^${String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
  const tests = named.filter((t) => !seen.has(`${t.file} · ${t.test}`) && seen.add(`${t.file} · ${t.test}`));
  const ran = runAtCommit({ top, commit, dir: "", commands: tests.map((t) => `node --test --test-reporter=tap --test-name-pattern=${quote(pattern(t.test))} ${quote(t.file)}`) });
  if (ran.error) refuse(ran.error);
  const not = [];
  tests.forEach((t, i) => {
    const out = ran.results[i]?.output ?? "";
    const line = out.split("\n").map((l) => l.trim()).find((l) => /^(not )?ok \d+ - /.test(l) && l.replace(/^(not )?ok \d+ - /, "").replace(/\s+#\s*(SKIP|TODO)\b.*$/i, "") === t.test);
    if (!line) not.push(`${t.file} · ${t.test}: not found in a run of its file`);
    else if (/^not ok/.test(line) || ran.results[i].result !== "pass") not.push(`${t.file} · ${t.test}: failed`);
    else if (/#\s*(SKIP|TODO)\b/i.test(line)) not.push(`${t.file} · ${t.test}: ${/#\s*SKIP/i.test(line) ? "skipped" : "marked todo"}`);
    else fixTests.push(`- ${t.file} · ${t.test} · passed`);
  });
  if (not.length) refuse(`the tests of the fixes of ${range.narrow.file} did not all run and pass on ${commit.slice(0, 7)}: ${not.join("; ")}`);
}
// After the approval in force and every round of the task, never in the same second (D-167).
const time = timeAfter(...approvals.filter((a) => a.task === task).map((a) => a.time), ...rounds.filter((r) => r.task === task).map((r) => r.time));
mkdirSync(cfg.taskRecords.dir, { recursive: true });
// The statement's limits go into the record, for the check and --rounds, which read no statement (D-147),
// and its goal, the scope of the budget they read (D-172).
const text = [`Record: done`, `Task: ${task}`, `Commit: ${commit}`, `Statement-hash: ${statement.hash}`, ...budgetLines(statement.budget), ...(statement.goal ? [`Goal: ${statement.goal}`] : []), `Time: ${time}`, `Checks:`, ...run.results.map((r) => `- ${r.command} · ${r.result}`), ...(evidence.length ? ["Evidence:", ...evidence] : []), ...(fixTests.length ? ["Fix-tests:", ...fixTests] : []), ""].join("\n");
// A record is never written over another: two records of one second take the next free name.
let name;
for (let i = 1; ; i++) {
  name = `${time.replaceAll(/[-:]/g, "")}-${task}-done${i > 1 ? `-${i}` : ""}.md`;
  try {
    // With its seal (D-167).
    writeFileSync(join(cfg.taskRecords.dir, name), sealed(text), { flag: "wx" });
    break;
  } catch (e) {
    if (e.code !== "EEXIST") refuse(`the record was not written: ${e.message}`);
  }
}
console.log(`DONE ${task}: ${run.results.length} commands passed on ${commit.slice(0, 7)}; recorded in ${relative(process.cwd(), join(cfg.taskRecords.dir, name))}`);
if (range?.from && !range.done && range.acceptance === "held" && !commit.startsWith(range.from))
  console.log(`RANGE ${task}: this record of done ends the range of fixes after the narrow round ${range.narrow.file}, from ${range.from} to ${commit.slice(0, 12)} (rule.fixes-held-by-tests)`);
