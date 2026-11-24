#!/usr/bin/env node
// The writer of the records of rounds (D-183), in two steps, and of the tests of their fixes.
//   node tools/ont-check/round.mjs brief <task> --step statement|result --statement FILE [--cause FILE] [--config ont.config.json]
//   node tools/ont-check/round.mjs record <task> --from REPLY --triage FILE [--step statement|result] [--statement FILE] [--config ont.config.json]
//   node tools/ont-check/round.mjs fixes <task> --round FILE --from FILE [--config ont.config.json]
// brief refuses unless the task's next action, as --task gives it, is a round of that step: for the
// statement, while the file is the version the last round with findings read, it is not corrected yet; for
// the result, it needs a record of done newer than the step's last round on a commit whose tree differs,
// the records of that step's own rounds aside, from the commit of the record of done that round checked,
// except for a round that gives the verdict of acceptance alone, on the same result, when the last round
// has none or one the tool refuses. When the next action names stagnation, it needs --cause FILE, the
// analysis of the cause (D-182), whose SHA-256 the brief carries on Cause: and whose text it prints after the
// lines; --cause is refused elsewhere (D-183). It writes the brief into ont-briefs/ of the Git directory and
// prints its lines, which the executor puts at the top of the reviewer's brief.
// record takes the brief, used once, and the reviewer's reply, whose first lines are the brief's word for
// word, Cause: among them, which it copies into the record, then By:, for a round of the result Condition: and Acceptance: clean, or refused with its findings
// under it, and the table of the findings on merging, as skills/change-review asks for them (D-172); the
// scope of the budget and the task's limits and reserve of the round's record and its snapshot are those of
// the brief's version, which its lines Goal: and Budget-, written by brief from the statement, carry
// (D-172, D-174), while brief stops for the budget by the version in force, as --task does (D-175);
// it refuses a reply that differs from the brief, or no brief, and a
// finding without the executor's triage, "class · usual path: <step>", "class · not fixable", "class ·
// limitation" or "class · later: issues/NNNN.md", a filed finding whose file does not hold its class, and a
// finding of acceptance filed. Where spend is counted from the logs, it finds the reviewer's session by the
// brief, refusing when none holds it, and writes a snapshot of spend with the round, which names it.
// fixes writes a record of the tests that hold the fixes of a round's findings, by class.
// ont: field.review-round.gate-paths, field.task-statement.gate-paths, field.review-round.brief-time, field.review-round.done, field.review-round.spend-record, action.brief-round, action.record-round, action.record-fixes, ent.round-brief, ent.fixes-record, field.review-round.cause, rule.records-by-tool, rule.executor-triage, rule.findings-filed
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { briefText, pendingBriefs, readBrief, removeBrief, writeBrief } from "./briefs.mjs";
import { gitEnv, loadConfig } from "./lib.mjs";
import { outsideRecord } from "./manual-runs.mjs";
import { CAUSE, LATER_DIR, LIMITATIONS_FILE, TASK_NAME, isClean } from "./review-rounds.mjs";
import { timeAfter, writeSealed } from "./seal.mjs";
import { overspendOf, roundSpend, snapshotLines } from "./spend.mjs";
import { BUDGET_ALL, readStatement, readTaskInputs, reviewedCommit, sha256, spendOf, stepNext, taskNext } from "./tasks.mjs";

const STEP = { statement: "statement-review", result: "result-review" };
const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const compact = (t) => t.replace(/[-:]/g, "");

// The round brief may give (D-183): the step's next action, by the branches of derived.task-next, read
// for that step; refused with why, or { narrow, number, done, cause } of the round it allows, cause true
// when the next action is the analysis of the cause after stagnation (D-182), which needs --cause.
export function briefAllowed({ cfg, task, step, statement, inputs, head, spendNow = null, git }) {
  const { rounds, malformed, records } = inputs;
  // The next action by the one call --task makes, with the same inputs: the budget is that of the version
  // in force, as --task reads it, so the round --task names is the round brief writes, and a round brief
  // refuses for the budget is one --task names the question for (rule.budget-before-next, D-175).
  const args = { rounds, spend: records.spend, done: records.done, approvals: records.approvals, task, defaults: cfg.budget, statement, malformed, needFile: true, gatesFrom: cfg.reviewRounds.gatesFrom, head, spendNow, pending: pendingBriefs(cfg.base), snapshots: records.snapshots };
  const next = taskNext(args);
  const refuse = (why) => ({ refused: why });
  if (["question", "correct", "done"].includes(next.kind)) return refuse(`the task's next action is not a round: ${next.say}`);
  const of = rounds.filter((r) => r.task === task && r.step === step).sort((a, b) => a.time.localeCompare(b.time));
  const nextOf = (narrow) => Math.max(0, ...of.filter((r) => r.narrow === narrow).map((r) => r.number)) + 1;
  if (step === "statement-review") {
    if (!["no review", "under review", "changed"].includes(next.branch)) return refuse(`the task's next action is not a round of the review of its statement: ${next.say}`);
    // A statement not corrected since the last round with findings is not reviewed again.
    const found = of.filter((r) => !isClean(r)).at(-1);
    if (found && found.statementHash === statement.hash) return refuse(`the statement is version ${statement.hash.slice(0, 12)}, the version ${found.file} found findings in: correct it first`);
    if (next.branch !== "under review") return { narrow: false, number: nextOf(false), next };
    const r = stepNext({ rounds, done: records.done, approvals: records.approvals, task, step, statement, gatesFrom: cfg.reviewRounds.gatesFrom, head });
    if (!["full", "narrow", CAUSE].includes(r.next)) return refuse(`the next action of the review of the statement is not a round: ${r.say}`);
    return { narrow: r.next === CAUSE ? r.narrow : r.next === "narrow", number: r.number, cause: r.next === CAUSE, next };
  }
  if (next.branch !== "step" || next.kind !== "work") return refuse(`the task's next action is not a round of the review of its result: ${next.say}`);
  const view = next.view;
  const result = next.result;
  // The first round of the result of the version in force, once its record of done is there.
  if (view.window && !view.results.length) {
    const d = view.done.at(-1);
    return d ? { narrow: false, number: nextOf(false), done: d, next } : refuse(`no record of done of version ${view.window.hash.slice(0, 12)} yet: ${next.say}`);
  }
  const last = view.results.at(-1) ?? of.at(-1);
  // A round for the verdict of acceptance alone, on the same result (D-183).
  if (["acceptance", "refused"].includes(result?.next)) {
    const d = view.done.find((x) => last && x.commit.startsWith(reviewedCommit(last) ?? "\0")) ?? view.done.at(-1);
    if (!d) return refuse(`no record of done to give the verdict of acceptance for: ${next.say}`);
    return { narrow: Boolean(last?.narrow), number: nextOf(Boolean(last?.narrow)), done: d, acceptanceOnly: true, next };
  }
  if (!["full", "narrow", CAUSE].includes(result?.next)) return refuse(`the next action of the review of the result is not a round: ${next.say}`);
  // A new result: a record of done after the last round, on a commit whose tree differs, the records of the
  // rounds of this step aside, from the commit of the record of done that round checked.
  const checked = view.done.find((x) => last && x.commit.startsWith(reviewedCommit(last) ?? "\0"));
  const roundsRel = relative(git.top, cfg.reviewRounds.dir).split("\\").join("/");
  const tasksRel = cfg.taskRecords ? relative(git.top, cfg.taskRecords.dir).split("\\").join("/") : null;
  // The records of the rounds of this step, their snapshots of spend and the task's records of done are no
  // new result: a commit that holds only them gives none (D-183).
  const own = new Set([
    ...of.flatMap((r) => [`${roundsRel}/${r.file}`, ...(r.spendRecord && tasksRel ? [`${tasksRel}/${r.spendRecord}`] : [])]),
    ...(tasksRel ? records.done.filter((d) => d.task === task).map((d) => `${tasksRel}/${d.file}`) : []),
  ]);
  const differs = (d) => {
    if (!checked) return true;
    const diff = git.run("diff", "--no-renames", "--name-only", checked.commit, d.commit);
    return diff.status !== 0 || diff.stdout.split("\n").filter(Boolean).some((p) => !own.has(p));
  };
  const fresh = view.done.filter((d) => last && d.time > last.time && differs(d)).at(-1);
  if (!fresh)
    return refuse(
      `no record of done newer than the last round ${last?.file ?? "(none)"} on a commit whose tree differs from ${checked ? `${checked.commit.slice(0, 12)}, the commit of ${checked.file} it checked,` : "the commit it checked"} outside the records of the rounds of this step: fix the findings, commit, record done with done.mjs, then brief the round`,
    );
  // After a stagnating C the one narrow round, after the branch stagnation a full one (derived.next-round).
  return { narrow: result.next === CAUSE ? result.narrow : result.next === "narrow", number: result.number, done: fresh, cause: result.next === CAUSE, next };
}

// The reviewer's reply (D-183, D-172), as skills/change-review asks for it: its first lines are the brief's
// word for word; then By:, and for a round of the result Condition: and Acceptance: clean or Acceptance:
// refused with its reason, the findings of acceptance under it as lines "- class · weight · origin"; the
// findings on merging as the rows of the table of findings, | class | weight | origin | path | fixability
// | evidence |, of which the writer reads the first three cells, the rest the reviewer's advice, the
// executor's triage deciding; a row of three cells is read the same. Acceptance: pass and fail, the names
// before, are read as clean and refused.
const ACCEPT = { clean: "pass", pass: "pass", refused: "fail", fail: "fail" };
const ORIGIN = { change: "change", "of this change": "change", before: "before", "there before": "before" };
const cellsOf = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim());
export function parseReply(text, brief, step) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const want = briefText(brief).split("\n");
  const wrong = [];
  for (let i = 0; i < want.length; i++) if (lines[i] !== want[i]) wrong.push(`line ${i + 1} of the reply is ${JSON.stringify(lines[i] ?? "(none)")}, and the brief's is ${JSON.stringify(want[i])}`);
  if (wrong.length) return { wrong: [`the reply does not begin with the brief's lines word for word: ${wrong.slice(0, 3).join("; ")}`] };
  const rest = lines.slice(want.length);
  const field = (k) => rest.map((l) => l.match(new RegExp(`^${k}:[ \\t]*(.*?)\\s*$`))).filter(Boolean).map((m) => m[1]);
  const by = field("By")[0];
  if (!by) wrong.push("the reply has no line By: naming the reviewer");
  let condition = null;
  let acceptance = null;
  const acceptFindings = [];
  if (step === "result-review") {
    condition = field("Condition")[0] ?? null;
    if (!["holds", "not yet"].includes(condition)) wrong.push(`Condition: ${condition ?? "(none)"} is not holds or not yet`);
    const at = rest.findIndex((l) => /^Acceptance:/.test(l));
    const given = at < 0 ? null : rest[at].replace(/^Acceptance:\s*/, "").trim();
    // The word, with the reason a refusal may give after it: "refused. why", "refused: why".
    const word = given?.match(/^([a-z]+)\b[.:,;]?/)?.[1] ?? given;
    acceptance = ACCEPT[word] ?? null;
    if (!acceptance) wrong.push(`Acceptance: ${given ?? "(none)"} is not clean or refused`);
    else if (acceptance === "pass" && !/^[a-z]+\.?$/.test(given)) wrong.push(`Acceptance: ${given} gives more than clean`);
    for (let i = at + 1; at >= 0 && i < rest.length && /^- /.test(rest[i]); i++) {
      const [cls, weight, of] = rest[i].replace(/^-\s*/, "").split("·").map((x) => x.trim());
      acceptFindings.push({ cls: cls?.replace(/^`|`$/g, ""), weight, of: ORIGIN[of ?? "change"] ?? of });
    }
    if (acceptance === "fail" && !acceptFindings.length) wrong.push("Acceptance: refused with no finding under it: give a line \"- <class> · important or nit · change or before\" under it for each item not met");
    if (acceptance === "pass" && acceptFindings.length) wrong.push("Acceptance: clean with findings under it");
  } else if (field("Acceptance").length || field("Condition").length) wrong.push("a reply to a round of the statement gives no Acceptance: and no Condition:");
  // The rows of the table of findings: a weight in the second cell and an origin in the third; the header,
  // its rule and the rows of the table of verdicts have neither.
  const findings = rest
    .filter((l) => /^\s*\|/.test(l))
    .map(cellsOf)
    .filter((c) => c.length >= 3 && ["important", "nit"].includes(c[1].toLowerCase()) && ORIGIN[c[2].toLowerCase()])
    .map((c) => ({ cls: c[0].replace(/^`|`$/g, ""), weight: c[1].toLowerCase(), of: ORIGIN[c[2].toLowerCase()] }));
  for (const f of [...findings, ...acceptFindings]) {
    if (!f.cls) wrong.push("a finding with no class");
    if (!["important", "nit"].includes(f.weight)) wrong.push(`the finding ${f.cls}: weight ${f.weight ?? "(none)"} is not important or nit`);
    if (!["change", "before"].includes(f.of)) wrong.push(`the finding ${f.cls}: ${f.of} is not change or before`);
    if (/·/.test(f.cls ?? "")) wrong.push(`the finding ${f.cls}: a class holds no ·`);
  }
  return { wrong, by, condition, acceptance, findings, acceptFindings };
}

// The executor's triage (rule.executor-triage, D-183): one line for each finding, "class · usual path:
// <step>", "class · not fixable", "class · limitation" or "class · later: issues/NNNN.md". A class is matched
// to the reply's whatever its case, as a reviewer begins a row of a table with a capital, and recorded as
// the triage spells it (D-172).
export function parseTriage(text) {
  const out = new Map();
  const wrong = [];
  text.split("\n").forEach((l, i) => {
    if (!l.trim()) return;
    const at = l.lastIndexOf(" · ");
    const [cls, what] = at < 0 ? [l.trim(), ""] : [l.slice(0, at).replace(/^-\s*/, "").trim(), l.slice(at + 3).trim()];
    let t = null;
    if (/^usual path:\s*\S/.test(what)) t = { fix: "fixable", step: what.replace(/^usual path:\s*/, "") };
    else if (what === "not fixable") t = { fix: "not fixable" };
    else if (what === "limitation") t = { fix: "limitation", file: LIMITATIONS_FILE };
    else if (/^later:\s*\S/.test(what)) t = { fix: "later", file: what.replace(/^later:\s*/, "") };
    if (!t) wrong.push(`line ${i + 1} of the triage, ${JSON.stringify(l)}, is not "class · usual path: <step>", "class · not fixable", "class · limitation" or "class · later: ${LATER_DIR}NNNN.md"`);
    else if (out.has(cls.toLowerCase())) wrong.push(`the triage gives the class ${cls} twice`);
    else out.set(cls.toLowerCase(), { ...t, cls });
  });
  return { triage: out, wrong };
}

function main(argv) {
  const [mode, task] = argv;
  const value = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
  const refuse = (why) => (console.log(`ERROR · ${mode === "brief" ? "no brief written" : "no record written"}: ${why}`), 1);
  if (!["brief", "record", "fixes"].includes(mode)) return console.log(`ERROR · the mode ${mode ?? "(none)"} is not brief, record or fixes`), 1;
  if (!task || !TASK_NAME.test(task)) return refuse(`give the task after the mode, lower-case letters, digits and hyphens: round.mjs ${mode} <task>`);
  const cfg = loadConfig(value("--config") ?? "ont.config.json");
  if (!cfg.reviewRounds || !cfg.taskRecords) return refuse("the configuration names no reviewRounds or no taskRecords");
  const run = (...a) => spawnSync("git", ["-C", cfg.base, ...a], { encoding: "utf8", env: gitEnv(), maxBuffer: 1 << 26 });
  const top = run("rev-parse", "--show-toplevel").stdout?.trim();
  if (!top) return refuse("not in a Git repository");
  const git = { top, run };
  const inputs = readTaskInputs(cfg);
  const { rounds, records } = inputs;
  if (mode === "fixes") {
    const round = rounds.find((r) => r.task === task && r.file === value("--round")?.split("/").at(-1));
    if (!round) return refuse(`--round ${value("--round") ?? "(none)"} is no record of a round of ${task}`);
    const from = value("--from");
    if (!from || !existsSync(from)) return refuse("give the tests with --from FILE: one line \"class · file · test name\" for each finding fixed");
    const classes = new Set([...round.findings, ...(round.acceptance?.findings ?? [])].filter((x) => x.fixable).map((x) => x.cls));
    const lines = readFileSync(from, "utf8").split("\n").map((l) => l.replace(/^-\s*/, "").trim()).filter(Boolean);
    const wrong = [];
    const tests = lines.map((l) => {
      const [cls, file, name] = l.split(" · ").map((x) => x.trim());
      if (!cls || !file || !name) wrong.push(`${JSON.stringify(l)} is not "class · file · test name"`);
      else if (!classes.has(cls)) wrong.push(`${cls} is not the class of a fixable finding of ${round.file}, word for word`);
      else if (!existsSync(join(top, file)) || !readFileSync(join(top, file), "utf8").includes(name)) wrong.push(`${file} is not a file of the repository that holds the test ${JSON.stringify(name)}`);
      return `- ${cls} · ${file} · ${name}`;
    });
    if (!tests.length) wrong.push(`${from} gives no test`);
    const outside = cfg.records.latinOnly ? outsideRecord(tests.join("\n"), 1, { latinOnly: true }) : [];
    if (wrong.length || outside.length) return refuse([...wrong, ...outside].join("; "));
    const time = now();
    const body = ["Record: fixes", `Task: ${task}`, `Round: ${round.file}`, `Time: ${time}`, "Tests:", ...tests, ""].join("\n");
    const file = writeSealed(cfg.taskRecords.dir, (i) => `${compact(time)}-${task}-fixes${i > 1 ? `-${i}` : ""}.md`, body);
    console.log(`RECORDED the tests of the fixes of ${round.file} in ${relative(process.cwd(), join(cfg.taskRecords.dir, file))}`);
    return 0;
  }
  if (mode === "brief") {
    const step = STEP[value("--step")];
    if (!step) return refuse("give --step statement or --step result");
    const file = value("--statement");
    if (!file || !existsSync(file)) return refuse("give the statement with --statement FILE");
    const statement = readStatement(file);
    // The spend first, from the logs where the configuration counts it so (D-169), by the version in force,
    // as --task counts it (D-175): spend that cannot be counted refuses; a spent reserve of the goal or of
    // the task is the next action's budget question, which briefAllowed refuses, by the call --task makes.
    const sp = spendOf({ cfg, task, statement, inputs });
    if (sp?.errors?.length) return refuse(sp.errors.join("; "));
    if (sp?.missing?.length) return refuse(`the spend cannot be counted: the environment does not give ${sp.missing.join("; ")}`);
    const head = run("rev-parse", "--verify", "HEAD").stdout.trim() || null;
    const ok = briefAllowed({ cfg, task, step, statement, inputs, head, spendNow: sp, git });
    if (ok.refused) return refuse(ok.refused);
    // The analysis of the cause after stagnation (D-182, D-183): required when the next action names it,
    // refused where it does not, so that no round carries an analysis of a stagnation there was not.
    const causeFile = value("--cause");
    if (ok.cause && !causeFile) return refuse(`the next action is the analysis of the cause: ${ok.next.say}; write it and give it with --cause FILE`);
    if (!ok.cause && causeFile) return refuse(`--cause is given, and the next action names no stagnation: ${ok.next.say}`);
    if (causeFile && !existsSync(causeFile)) return refuse(`--cause ${causeFile} is not a file`);
    const cause = causeFile ? readFileSync(causeFile) : null;
    if (cause && !cause.toString("utf8").trim()) return refuse(`--cause ${causeFile} is empty: write the analysis of the cause in it`);
    const brief = {
      Task: task,
      Step: step,
      Narrow: String(ok.narrow),
      Number: String(ok.number),
      "Statement-hash": statement.hash,
      Goal: statement.goal ?? undefined,
      // The statement's limits and reserve, which record takes with the goal (D-174).
      ...Object.fromEntries(BUDGET_ALL.map(([k, name]) => [name, String(statement.budget?.[k] ?? "none")])),
      // The gate paths of the statement, on a round of its review, which record carries into the round, so
      // that a clean round approves them with the version (field.review-round.gate-paths, D-185).
      "Gate-paths": step === "statement-review" && statement.gatePaths.length ? statement.gatePaths.join(", ") : undefined,
      Commits: step === "result-review" ? ok.done.commit : head,
      Done: step === "result-review" ? ok.done.file : undefined,
      Cause: cause ? sha256(cause) : undefined,
      "Brief-time": now(),
    };
    const at = writeBrief(cfg.base, brief);
    console.log(briefText(brief));
    // The analysis goes into the reviewer's brief after the lines, which alone the reply repeats.
    if (cause) console.log(`\n## The analysis of the cause (Cause: ${brief.Cause})\n\n${cause.toString("utf8").trimEnd()}\n`);
    console.log(`BRIEF ${task}: ${ok.narrow ? "narrow" : "full"} round ${ok.number} of the ${step === "result-review" ? "result" : "statement"}${ok.acceptanceOnly ? ", for the verdict of acceptance alone on the same result" : ""}${cause ? ", after the analysis of the cause printed above, which goes into the reviewer's brief too" : ""}; the lines above go first in the reviewer's brief, and its reply begins with them word for word (kept in ${at})`);
    return 0;
  }
  // record
  const stepGiven = value("--step");
  const kept = stepGiven ? [readBrief(cfg.base, task, STEP[stepGiven])].filter(Boolean) : Object.values(STEP).map((s) => readBrief(cfg.base, task, s)).filter(Boolean);
  if (!kept.length) return refuse(`no brief of a round of ${task} is kept in this working copy: run round.mjs brief first, and give the reviewer its lines`);
  if (kept.length > 1) return refuse("briefs of both steps are kept: give --step statement or --step result");
  const { brief, file: briefFile } = kept[0];
  const step = brief.Step;
  const from = value("--from");
  if (!from || !existsSync(from)) return refuse("give the reviewer's reply with --from FILE");
  const reply = parseReply(readFileSync(from, "utf8"), brief, step);
  if (reply.wrong.length) return refuse(reply.wrong.join("; "));
  const triageFile = value("--triage");
  const all = [...reply.findings.map((f) => ({ ...f, at: "merge" })), ...reply.acceptFindings.map((f) => ({ ...f, at: "acceptance" }))];
  if (all.length && (!triageFile || !existsSync(triageFile))) return refuse("give the executor's triage of every finding with --triage FILE");
  const { triage, wrong: badTriage } = triageFile && existsSync(triageFile) ? parseTriage(readFileSync(triageFile, "utf8")) : { triage: new Map(), wrong: [] };
  const wrong = [...badTriage];
  const tri = (f) => triage.get(f.cls.toLowerCase());
  for (const f of all) {
    const t = tri(f);
    if (!t) wrong.push(`the finding ${f.cls} has no triage: usual path with its step, not fixable, limitation or later with its ticket`);
    else if (f.at === "acceptance" && (t.fix === "limitation" || t.fix === "later")) wrong.push(`the finding of acceptance ${f.cls} is filed as ${t.fix}: an item of the approved statement not met is not put off`);
    else if (t.file) {
      const path = join(top, t.file);
      if (!t.file.startsWith(t.fix === "later" ? LATER_DIR : LIMITATIONS_FILE) || !existsSync(path) || !readFileSync(path, "utf8").includes(t.cls)) wrong.push(`the finding ${t.cls} is filed in ${t.file}, which is not a file of the repository that holds its class word for word`);
    }
  }
  for (const [key, t] of triage) if (!all.some((f) => f.cls.toLowerCase() === key)) wrong.push(`the triage gives ${t.cls}, which is not a finding of the reply`);
  if (wrong.length) return refuse(wrong.join("; "));
  // Each finding by the class as the triage spells it.
  for (const f of [...reply.findings, ...reply.acceptFindings, ...all]) f.cls = tri(f).cls;
  // The spend of the round, from the reviewer's session that holds the brief (D-169). The round ends after
  // the record of done it reviews and after its brief, never in the same second.
  const time = timeAfter(brief["Brief-time"], records.done.find((d) => d.file === brief.Done)?.time);
  // The scope of the budget and the task's limits are those of the brief's version, the round's, as the
  // brief, which brief wrote from the statement, carries them, whatever version is approved in force
  // (D-172, D-174). A statement given is that version, or nothing is written.
  const statementFile = value("--statement");
  const given = statementFile && existsSync(statementFile) ? readStatement(statementFile) : null;
  if (given && given.hash !== brief["Statement-hash"]) return refuse(`the statement ${statementFile} is version ${given.hash.slice(0, 12)}, and the brief's is ${brief["Statement-hash"].slice(0, 12)}`);
  const sp = spendOf({ cfg, task, statement: given, version: brief["Statement-hash"], inputs });
  let roundSum = null;
  if (sp) {
    if (sp.errors?.length) return refuse(sp.errors.join("; "));
    if (sp.missing?.length) return refuse(`the spend cannot be counted: the environment does not give ${sp.missing.join("; ")}`);
    const b = { task, step, number: brief.Number, briefTime: brief["Brief-time"] };
    const r = roundSpend(sp.sessions, b);
    if (!r.found) return refuse(`no session of the logs holds the brief of the round (${brief["Brief-time"]}): the reviewer's session is not in ${sp.unit}'s logs, or it was not given the brief's lines`);
    roundSum = r.sum;
  }
  const kind = step === "result-review" ? "result" : "statement";
  const narrow = brief.Narrow === "true";
  const name = `${compact(time)}-${task}-${kind}-${narrow ? "narrow-" : ""}${brief.Number}.md`;
  const line = (f) => {
    const t = tri(f);
    return `- ${f.cls} · ${f.weight} · ${f.of} · ${t.fix}${t.file ? ` · ${t.file}` : ""}`;
  };
  const merging = reply.findings.map((f) => ({ ...f, ...tri(f), ofChange: f.of === "change" }));
  const cleanMerge = !merging.some((f) => f.ofChange && !["limitation", "later"].includes(f.fix));
  const ends = step === "result-review" && cleanMerge && reply.acceptance === "pass";
  let snapshot = null;
  if (sp) {
    const body = snapshotLines({ task, sp, round: name, roundSum, time });
    snapshot = writeSealed(cfg.taskRecords.dir, (i) => `${compact(time)}-${task}-spend-snapshot${i > 1 ? `-${i}` : ""}.md`, body);
  }
  const over = ends && sp ? overspendOf(sp) : null;
  const head = [
    `Task: ${task}`,
    `Step: ${step}`,
    `Narrow: ${narrow}`,
    `Number: ${brief.Number}`,
    `Time: ${time}`,
    `Commits: ${brief.Commits}`,
    ...(brief.Done ? [`Done: ${brief.Done}`] : []),
    `By: ${reply.by}`,
    `Statement-hash: ${brief["Statement-hash"]}`,
    ...(brief["Gate-paths"] ? [`Gate-paths: ${brief["Gate-paths"]}`] : []),
    `Brief-time: ${brief["Brief-time"]}`,
    ...(roundSum ? [`Tokens-new: ${roundSum.new}`, `Tokens-cached: ${roundSum.cached}`, `Tokens-out: ${roundSum.out}`] : []),
    ...(snapshot ? [`Spend-record: ${snapshot}`] : []),
    ...(over ? [`Overspend: ${over}`] : []),
    ...(reply.condition === "holds" ? ["Condition: holds"] : []),
    ...(brief.Cause ? [`Cause: ${brief.Cause}`] : []),
  ];
  // The step each fixable class breaks, once for the class, given both on merging and under acceptance.
  const fixableNotes = [...new Set(all.filter((f) => tri(f).fix === "fixable").map((f) => `- ${f.cls}: usual path, the step it breaks: ${tri(f).step}`))];
  const body = [
    ...head,
    ...(reply.findings.length ? ["Findings:", ...reply.findings.map(line)] : []),
    ...(step === "result-review" ? (reply.acceptance === "pass" ? ["Acceptance: clean"] : ["Acceptance:", ...reply.acceptFindings.map(line)]) : []),
    "",
    "## Notes",
    "",
    ...(fixableNotes.length ? fixableNotes : ["- Written by round.mjs record from the reviewer's reply and the executor's triage."]),
    "",
  ].join("\n");
  const outside = cfg.records.latinOnly ? outsideRecord(body, 1, { latinOnly: true }) : [];
  if (outside.length) return refuse(`the round would hold what a record here may not: ${outside.join("; ")}`);
  const file = writeSealed(cfg.reviewRounds.dir, (i) => (i > 1 ? name.replace(/\.md$/, `-${i}.md`) : name), body);
  removeBrief(briefFile);
  console.log(`RECORDED ${relative(process.cwd(), join(cfg.reviewRounds.dir, file))}${snapshot ? ` and its snapshot of spend ${snapshot}` : ""}${over ? `; overspend: ${over}` : ""}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = main(process.argv.slice(2));
