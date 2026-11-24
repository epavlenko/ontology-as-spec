#!/usr/bin/env node
// The writer of the owner's approval of a version, of his answer to a gate (D-170) and of his permission to
// publish the work of a goal or of a task (D-185).
//   node tools/ont-check/approve.mjs <task> --statement FILE --question N --kind approval|gate [--round FILE] --english FILE [--config ont.config.json]
//   node tools/ont-check/approve.mjs --kind publish --scope <goal|task> --question N --english FILE [--config ont.config.json]
// The owner's answer is taken from the registry of questions by the command the environment names,
// ONT_REGISTRY_CMD, run with the number of the question; the repository names no such command. The command
// prints one object of JSON: { "number": N, "question": "<text>", "options": [{ "key": "a", "meaning":
// "approve" | "answer" | "reject" | "defer" }], "answer": { "by": "owner", "date": "YYYY-MM-DD", "option":
// "a" } }, with no answer while the owner has not answered. No record is written when the registry has no
// answer of the owner; when the text of the question does not name the task and, for an approval, the
// first 12 characters of the hash of the version, or, for a gate, the file of the round whose gate it
// closes, which --round gives and is required; or when the option chosen does not approve, for an
// approval, or does not answer, for a gate. Source: is the number of the question, the date of the answer,
// the option chosen and the English translation of the owner's words from --english, marked "translated
// from Russian"; the original stays in the registry. A record of a gate closes the gate of the round it
// names and approves no version (D-185). The record carries the statement's limits and reserve,
// Budget-new-input:, Budget-output: and Budget-reserve:, as done.mjs writes them, so that it is a record of
// the version it names for the limits by version (D-176), and an approval its gate paths, Gate-paths:, the
// lines of its statement, which the guard reads (D-185).
// A permission to publish names no statement: the question names its scope, a goal of the configuration's
// goals or a task, and the option chosen means publish; the record is Record: approval, Kind: publish,
// Scope:, By: owner, Question:, Source: and Time:, with no Statement-hash:. The registry is outside the
// repository and CI does not read it: this writer compares the answer with it when it writes, and the guard
// reads the record's seal, its kind and its scope (D-185).
// ont: action.record-approval, field.owner-approval.budget, field.owner-approval.kind, field.owner-approval.question, field.owner-approval.round, field.owner-approval.gate-paths, inv.owner-approval-sourced, rule.records-by-tool
// ont: action.record-publication, ent.publish-permission, field.publish-permission.scope, field.publish-permission.question, field.publish-permission.by, field.publish-permission.source, field.publish-permission.time, field.task-statement.gate-paths
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./lib.mjs";
import { outsideRecord } from "./manual-runs.mjs";
import { TASK_NAME } from "./review-rounds.mjs";
import { writeSealed } from "./seal.mjs";
import { budgetLines, gatePathsLine, readStatement, readTaskInputs } from "./tasks.mjs";

export const REGISTRY_ENV = "ONT_REGISTRY_CMD";
const MEANS = { approval: ["approve"], gate: ["approve", "answer"], publish: ["publish"] };

// Why the registry's answer gives no record, or null (D-170). For a permission to publish, task is its
// scope, and the option chosen means publish, never approve: the answer that starts the work of the same
// scope is no permission to publish it (D-185).
export function answerWrong({ entry, task, hash, kind, round }) {
  if (!entry || typeof entry !== "object") return "the registry gave no question";
  const q = String(entry.question ?? "");
  const a = entry.answer;
  if (!a || a.by !== "owner" || !a.option) return `the registry has no answer of the owner to question ${entry.number ?? "?"}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date ?? "")) return `the answer to question ${entry.number} has no date YYYY-MM-DD`;
  if (!q.includes(task)) return kind === "publish" ? `question ${entry.number} does not name the scope ${task}` : `question ${entry.number} does not name the task ${task}`;
  if (kind === "approval" && !q.includes(hash.slice(0, 12))) return `question ${entry.number} does not name version ${hash.slice(0, 12)} of the statement: its answer is about another version, or none`;
  if (kind === "gate" && !q.includes(round)) return `question ${entry.number} does not name the round ${round} whose gate it would close`;
  const option = (entry.options ?? []).find((o) => o.key === a.option);
  if (!option) return `the option ${a.option} chosen is not an option of question ${entry.number}`;
  if (!MEANS[kind].includes(option.meaning)) return `the option ${a.option} chosen means ${option.meaning ?? "nothing the tool reads"}: it does not ${kind === "approval" ? "approve the version" : kind === "publish" ? "allow to publish" : "answer the gate"}`;
  return null;
}

function main(argv) {
  const value = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
  const refuse = (why) => (console.log(`ERROR · no record written: ${why}`), 1);
  if (value("--kind") === "publish") return publish({ argv, value, refuse });
  const task = argv[0];
  if (!task || !TASK_NAME.test(task)) return refuse("give the task first: approve.mjs <task> --statement FILE --question N --kind approval|gate --english FILE");
  const cfg = loadConfig(value("--config") ?? "ont.config.json");
  if (!cfg.reviewRounds || !cfg.taskRecords) return refuse("the configuration names no reviewRounds or no taskRecords");
  const file = value("--statement");
  if (!file || !existsSync(file)) return refuse("give the statement with --statement FILE");
  const statement = readStatement(file);
  // A line of the budget the tool cannot read would be carried as none (D-150, D-176).
  if (statement.wrong.length) return refuse(`the statement's ${statement.wrong.join("; ")}`);
  const n = value("--question");
  if (!/^\d+$/.test(n ?? "")) return refuse("give the number of the question with --question N");
  const kind = value("--kind");
  if (!["approval", "gate"].includes(kind)) return refuse("give --kind approval, --kind gate or --kind publish");
  const roundArg = value("--round");
  if (kind === "gate" && !roundArg) return refuse("an answer to a gate names the round whose gate it closes: give --round FILE");
  const round = roundArg ? basename(roundArg) : null;
  const { rounds } = readTaskInputs(cfg);
  if (round && !rounds.some((r) => r.task === task && r.file === round)) return refuse(`--round ${round} is no record of a round of ${task}`);
  const english = englishOf(value("--english"));
  if (english.why) return refuse(english.why);
  const got = registryEntry(n);
  if (got.why) return refuse(got.why);
  const { entry } = got;
  const why = answerWrong({ entry: { number: Number(n), ...entry }, task, hash: statement.hash, kind, round });
  if (why) return refuse(why);
  const time = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const body = [
    "Record: approval",
    `Kind: ${kind}`,
    `Task: ${task}`,
    `Statement-hash: ${statement.hash}`,
    // The limits and the reserve of the version it approves (field.owner-approval.budget, D-176).
    ...budgetLines(statement.budget),
    // The gate paths the version allows its task to change, from its lines Gate-paths: (D-185).
    ...(kind === "approval" ? gatePathsLine(statement.gatePaths) : []),
    "By: owner",
    `Question: ${n}`,
    ...(round ? [`Round: ${round}`] : []),
    `Source: question ${n}, answered ${entry.answer.date}, option ${entry.answer.option}: "${english.text}" (translated from Russian)`,
    `Time: ${time}`,
    "",
  ].join("\n");
  const name = writeSealed(cfg.taskRecords.dir, (i) => `${time.replace(/[-:]/g, "")}-${task}-${kind === "gate" ? "gate-answer" : "approval"}${i > 1 ? `-${i}` : ""}.md`, body);
  console.log(`RECORDED the owner's ${kind === "gate" ? "answer to the gate of" : "approval of"} ${kind === "gate" ? round : `version ${statement.hash.slice(0, 12)}`} in ${relative(process.cwd(), join(cfg.taskRecords.dir, name))}`);
  return 0;
}

// The English translation of the owner's words, from --english FILE, on one line, held to the rule of
// language of records, or why there is none.
function englishOf(file) {
  if (!file || !existsSync(file)) return { why: "give the English translation of the owner's words with --english FILE" };
  const text = readFileSync(file, "utf8").trim().replace(/\s+/g, " ");
  if (!text) return { why: `${file} is empty` };
  const outside = outsideRecord(text, 1, { latinOnly: true });
  if (outside.length || /"/.test(text)) return { why: `the translation holds what a record may not: ${[...outside, ...(/"/.test(text) ? ["a double quote"] : [])].join("; ")}` };
  return { text };
}

// The registry's entry of question n, by the command of ONT_REGISTRY_CMD, or why there is none.
function registryEntry(n) {
  const cmd = process.env[REGISTRY_ENV];
  if (!cmd) return { why: `the environment gives no ${REGISTRY_ENV}: the command that reads the owner's answer from the registry` };
  const r = spawnSync(`${cmd} ${n}`, { shell: true, encoding: "utf8" });
  if (r.status !== 0) return { why: `the registry's command failed: ${(r.stderr || `exit ${r.status}`).trim().split("\n")[0]}` };
  try {
    return { entry: JSON.parse(r.stdout) };
  } catch {
    return { why: "the registry's command did not print one object of JSON" };
  }
}

// The owner's permission to publish the work of a goal or of a task (ent.publish-permission, D-185), from
// the registry's answer, with no statement: the scope is a goal of the configuration's goals or a task one of
// them lists or a record names.
function publish({ argv, value, refuse }) {
  const cfg = loadConfig(value("--config") ?? "ont.config.json");
  if (!cfg.taskRecords) return refuse("the configuration names no taskRecords");
  if (argv.includes("--statement")) return refuse("a permission to publish names no statement: give --scope <goal|task> alone");
  const scope = value("--scope");
  if (!TASK_NAME.test(scope ?? "")) return refuse("give the goal or the task whose work it allows to publish with --scope <goal|task>");
  const goals = cfg.goals ?? {};
  const known = Object.hasOwn(goals, scope) || Object.values(goals).some((ts) => (ts ?? []).includes(scope)) || (cfg.reviewRounds && readTaskInputs(cfg).rounds.some((r) => r.task === scope));
  if (!known) return refuse(`${scope} is neither a goal of the configuration's goals nor a task a goal lists or a record names`);
  const n = value("--question");
  if (!/^\d+$/.test(n ?? "")) return refuse("give the number of the question with --question N");
  const english = englishOf(value("--english"));
  if (english.why) return refuse(english.why);
  const got = registryEntry(n);
  if (got.why) return refuse(got.why);
  const { entry } = got;
  const why = answerWrong({ entry: { number: Number(n), ...entry }, task: scope, hash: "", kind: "publish", round: null });
  if (why) return refuse(why);
  const time = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const body = [
    "Record: approval",
    "Kind: publish",
    `Scope: ${scope}`,
    "By: owner",
    `Question: ${n}`,
    `Source: question ${n}, answered ${entry.answer.date}, option ${entry.answer.option}: "${english.text}" (translated from Russian)`,
    `Time: ${time}`,
    "",
  ].join("\n");
  const name = writeSealed(cfg.taskRecords.dir, (i) => `${time.replace(/[-:]/g, "")}-${scope}-publish${i > 1 ? `-${i}` : ""}.md`, body);
  console.log(`RECORDED the owner's permission to publish the work of ${scope} in ${relative(process.cwd(), join(cfg.taskRecords.dir, name))}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = main(process.argv.slice(2));
