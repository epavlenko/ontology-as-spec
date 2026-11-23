#!/usr/bin/env node
// The writer of the owner's approval of a version and of his answer to a gate (D-170).
//   node tools/ont-check/approve.mjs <task> --statement FILE --question N --kind approval|gate [--round FILE] --english FILE [--config ont.config.json]
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
// from Russian"; the original stays in the registry. A record of a gate closes the gate; whether it
// approves the version is read by --task as an approval until a later task of the goal tells them apart.
// ont: action.record-approval, field.owner-approval.kind, field.owner-approval.question, field.owner-approval.round, inv.owner-approval-sourced, rule.records-by-tool
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./lib.mjs";
import { outsideRecord } from "./manual-runs.mjs";
import { TASK_NAME } from "./review-rounds.mjs";
import { writeSealed } from "./seal.mjs";
import { readStatement, readTaskInputs } from "./tasks.mjs";

export const REGISTRY_ENV = "ONT_REGISTRY_CMD";
const MEANS = { approval: ["approve"], gate: ["approve", "answer"] };

// Why the registry's answer gives no record, or null (D-170).
export function answerWrong({ entry, task, hash, kind, round }) {
  if (!entry || typeof entry !== "object") return "the registry gave no question";
  const q = String(entry.question ?? "");
  const a = entry.answer;
  if (!a || a.by !== "owner" || !a.option) return `the registry has no answer of the owner to question ${entry.number ?? "?"}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date ?? "")) return `the answer to question ${entry.number} has no date YYYY-MM-DD`;
  if (!q.includes(task)) return `question ${entry.number} does not name the task ${task}`;
  if (kind === "approval" && !q.includes(hash.slice(0, 12))) return `question ${entry.number} does not name version ${hash.slice(0, 12)} of the statement: its answer is about another version, or none`;
  if (kind === "gate" && !q.includes(round)) return `question ${entry.number} does not name the round ${round} whose gate it would close`;
  const option = (entry.options ?? []).find((o) => o.key === a.option);
  if (!option) return `the option ${a.option} chosen is not an option of question ${entry.number}`;
  if (!MEANS[kind].includes(option.meaning)) return `the option ${a.option} chosen means ${option.meaning ?? "nothing the tool reads"}: it does not ${kind === "approval" ? "approve the version" : "answer the gate"}`;
  return null;
}

function main(argv) {
  const value = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
  const refuse = (why) => (console.log(`ERROR · no record written: ${why}`), 1);
  const task = argv[0];
  if (!task || !TASK_NAME.test(task)) return refuse("give the task first: approve.mjs <task> --statement FILE --question N --kind approval|gate --english FILE");
  const cfg = loadConfig(value("--config") ?? "ont.config.json");
  if (!cfg.reviewRounds || !cfg.taskRecords) return refuse("the configuration names no reviewRounds or no taskRecords");
  const file = value("--statement");
  if (!file || !existsSync(file)) return refuse("give the statement with --statement FILE");
  const statement = readStatement(file);
  const n = value("--question");
  if (!/^\d+$/.test(n ?? "")) return refuse("give the number of the question with --question N");
  const kind = value("--kind");
  if (!MEANS[kind]) return refuse("give --kind approval or --kind gate");
  const roundArg = value("--round");
  if (kind === "gate" && !roundArg) return refuse("an answer to a gate names the round whose gate it closes: give --round FILE");
  const round = roundArg ? basename(roundArg) : null;
  const { rounds } = readTaskInputs(cfg);
  if (round && !rounds.some((r) => r.task === task && r.file === round)) return refuse(`--round ${round} is no record of a round of ${task}`);
  const englishFile = value("--english");
  if (!englishFile || !existsSync(englishFile)) return refuse("give the English translation of the owner's words with --english FILE");
  const english = readFileSync(englishFile, "utf8").trim().replace(/\s+/g, " ");
  if (!english) return refuse(`${englishFile} is empty`);
  const outside = outsideRecord(english, 1, { latinOnly: true });
  if (outside.length || /"/.test(english)) return refuse(`the translation holds what a record may not: ${[...outside, ...(/"/.test(english) ? ["a double quote"] : [])].join("; ")}`);
  const cmd = process.env[REGISTRY_ENV];
  if (!cmd) return refuse(`the environment gives no ${REGISTRY_ENV}: the command that reads the owner's answer from the registry`);
  const r = spawnSync(`${cmd} ${n}`, { shell: true, encoding: "utf8" });
  if (r.status !== 0) return refuse(`the registry's command failed: ${(r.stderr || `exit ${r.status}`).trim().split("\n")[0]}`);
  let entry;
  try {
    entry = JSON.parse(r.stdout);
  } catch {
    return refuse("the registry's command did not print one object of JSON");
  }
  const why = answerWrong({ entry: { number: Number(n), ...entry }, task, hash: statement.hash, kind, round });
  if (why) return refuse(why);
  const time = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const body = [
    "Record: approval",
    `Kind: ${kind}`,
    `Task: ${task}`,
    `Statement-hash: ${statement.hash}`,
    "By: owner",
    `Question: ${n}`,
    ...(round ? [`Round: ${round}`] : []),
    `Source: question ${n}, answered ${entry.answer.date}, option ${entry.answer.option}: "${english}" (translated from Russian)`,
    `Time: ${time}`,
    "",
  ].join("\n");
  const name = writeSealed(cfg.taskRecords.dir, (i) => `${time.replace(/[-:]/g, "")}-${task}-${kind === "gate" ? "gate-answer" : "approval"}${i > 1 ? `-${i}` : ""}.md`, body);
  console.log(`RECORDED the owner's ${kind === "gate" ? "answer to the gate of" : "approval of"} ${kind === "gate" ? round : `version ${statement.hash.slice(0, 12)}`} in ${relative(process.cwd(), join(cfg.taskRecords.dir, name))}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = main(process.argv.slice(2));
