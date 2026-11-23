#!/usr/bin/env node
// The writer of the records of a gate (D-170): a gate change, and a gate proof.
//   node tools/ont-check/gate-record.mjs change <task> --statement FILE --clause N --paths <path,path> --base REF [--config ont.config.json]
//   node tools/ont-check/gate-record.mjs change <task> --refresh --statement FILE --base REF [--config ont.config.json]
//   node tools/ont-check/gate-record.mjs proof <task> --gate <gate> --check <required check> --pr N --kind refusal|pass --repo <owner>/<repo> [--response FILE] [--config ont.config.json]
// change writes a record of a gate change for those gate paths of the final diff of the branch, from the
// merge base of --base and HEAD to HEAD, with HEAD as the commit of the change, named
// <time>-<task>-gate-change-<item>.md; it refuses with no approval in force for the version of the
// statement, an item N that the section What to do of that version does not have, or a path that is not a
// gate path the diff changes. Different items are different records; together they cover the gate paths of
// the diff, and the writer names those no record of the branch covers yet. After any commit outside
// reviews/, --refresh writes the records again on the new HEAD with the same items, one record for each, and
// leaves the old ones, which a record never overwrites; the guard reads the latest of each item.
// proof writes a record of a gate proof of a pull request, its fields from the pull request and its runs by
// gh api (the command ONT_GH_CMD names, gh by default): a refusal counts only when the check given is red
// on the head, its output holds a code of this gate's (mergeGate.codes) and no code of another gate, every
// other required check is green on that head, and GitHub's answer, --response, refuses the merge; a pass,
// when the pull request was merged and the check was green. It is allowed whenever the task has a record of
// done whose commit is on main, never by the task's next action.
// ont: action.record-gate-change, action.record-gate-proof, ent.gate-change, ent.gate-proof, inv.gate-change-approved, rule.records-by-tool
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gitEnv, loadConfig } from "./lib.mjs";
import { GUARD_CODES, RECORDS_DIR, isGatePath } from "./merge-gate.mjs";
import { TASK_NAME } from "./review-rounds.mjs";
import { timeAfter, writeSealed } from "./seal.mjs";
import { approvedHash, readStatement, readTaskInputs } from "./tasks.mjs";

const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const compact = (t) => t.replace(/[-:]/g, "");

// The numbers of the items of What to do of a statement, under any heading the configuration gives.
export function todoItems(text, headings = ["What to do"]) {
  const lines = text.split("\n");
  const at = lines.findIndex((l) => headings.some((h) => l.trim() === `## ${h}`));
  if (at < 0) return null;
  const items = [];
  for (let i = at + 1; i < lines.length && !/^## /.test(lines[i]); i++) {
    const m = lines[i].match(/^(\d+)\.\s/);
    if (m) items.push(m[1]);
  }
  return items;
}

function changeMode({ cfg, argv, value, refuse, git, top }) {
  const task = argv[1];
  const refresh = argv.includes("--refresh");
  const file = value("--statement");
  if (!file || !existsSync(file)) return refuse("give the statement with --statement FILE");
  const statement = readStatement(file);
  const { rounds, records } = readTaskInputs(cfg);
  const approved = approvedHash(rounds, task, null, records.approvals);
  if (approved !== statement.hash) return refuse(`version ${statement.hash.slice(0, 12)} of the statement of ${task} has no approval in force${approved ? `: version ${approved.slice(0, 12)} has` : ""}`);
  const baseRef = value("--base");
  if (!baseRef) return refuse("give the base of the pull request with --base REF, such as main");
  const head = git("rev-parse", "--verify", "HEAD").stdout.trim();
  const mb = git("merge-base", baseRef, head).stdout.trim();
  if (!mb) return refuse(`the base ${baseRef} and HEAD have no common commit`);
  const changed = git("diff", "--no-renames", "--name-only", "-z", mb, head).stdout.split("\0").filter(Boolean);
  const gated = changed.filter((p) => isGatePath(p, cfg.mergeGate?.paths ?? []));
  const own = git("diff", "--no-renames", "--name-only", "-z", `${head}^`, head);
  if (own.status === 0 && !own.stdout.split("\0").filter(Boolean).some((p) => !p.startsWith(RECORDS_DIR)))
    return refuse(`HEAD ${head.slice(0, 12)} changes nothing outside ${RECORDS_DIR}: a record of a gate change names the last commit of the branch outside it; write the records before the commit of records`);
  const items = todoItems(statement.text, cfg.statements.todoHeadings) ?? [];
  const recordsRel = relative(top, cfg.taskRecords.dir).split("\\").join("/");
  // The records of this task the branch adds, committed or not yet, the latest of each item: those the
  // merge base does not hold.
  const ofBranch = records.gateChanges.filter((g) => g.task === task && git("cat-file", "-e", `${mb}:${recordsRel}/${g.file}`).status !== 0);
  const latest = new Map();
  for (const g of [...ofBranch].sort((a, b) => a.time.localeCompare(b.time) || a.file.localeCompare(b.file))) latest.set(g.item, g);
  let plan;
  if (refresh) {
    if (!latest.size) return refuse(`the branch adds no record of a gate change of ${task} to write again: give --clause N --paths`);
    plan = [...latest.values()].map((g) => ({ item: g.item, paths: g.paths.filter((p) => gated.includes(p)) })).filter((x) => x.paths.length);
  } else {
    const clause = value("--clause");
    if (!items.includes(clause)) return refuse(`the section What to do of version ${statement.hash.slice(0, 12)} has no item ${clause ?? "(none)"}${items.length ? `: its items are ${items.join(", ")}` : ""}`);
    const paths = (value("--paths") ?? "").split(",").map((p) => p.trim()).filter(Boolean);
    if (!paths.length) return refuse("give the gate paths of the item with --paths <path,path>");
    const not = paths.filter((p) => !gated.includes(p));
    if (not.length) return refuse(`${not.join(", ")} ${not.length > 1 ? "are not gate paths" : "is not a gate path"} the diff of the branch from ${baseRef} changes`);
    plan = [{ item: clause, paths }];
  }
  // After the records of the branch of this task, so that the guard's latest of an item is the new one.
  const time = timeAfter(...ofBranch.map((g) => g.time));
  const written = plan.map((x) =>
    writeSealed(
      cfg.taskRecords.dir,
      (i) => `${compact(time)}-${task}-gate-change-${x.item}${i > 1 ? `-${i}` : ""}.md`,
      ["Record: gate-change", `Task: ${task}`, `Statement-hash: ${statement.hash}`, `Item: ${x.item}`, "Paths:", ...x.paths.map((p) => `- ${p}`), `Commit: ${head}`, `Time: ${time}`, ""].join("\n"),
    ),
  );
  for (const w of written) console.log(`RECORDED ${relative(process.cwd(), join(cfg.taskRecords.dir, w))}`);
  const covered = new Set([...[...latest.values()].filter((g) => !plan.some((x) => x.item === g.item)).flatMap((g) => g.paths), ...plan.flatMap((x) => x.paths)]);
  const open = gated.filter((p) => !covered.has(p));
  if (open.length) console.log(`UNCOVERED gate paths of the diff no record of ${task} names yet: ${open.join(", ")}; each needs the item of What to do that allows it`);
  console.log("Commit the records alone, right after this commit: the guard binds them to it.");
  return 0;
}

// The answer of gh api for a path, as JSON or as text.
function ghApi(path, { json = true } = {}) {
  const cmd = process.env.ONT_GH_CMD || "gh";
  const r = spawnSync(`${cmd} api '${path.replace(/'/g, "")}'`, { shell: true, encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`gh api ${path} failed: ${(r.stderr || `exit ${r.status}`).trim().split("\n")[0]}`);
  return json ? JSON.parse(r.stdout) : r.stdout;
}

// Why a probe proves nothing of the gate, or null (D-170): the codes in the output of the check, the state
// of the required checks on the head and GitHub's answer.
export function proofWrong({ kind, check, run, log, others, response, gateCodes, allCodes, merged }) {
  if (!run) return `the check ${check} did not run on the head`;
  if (kind === "refusal") {
    if (run.conclusion !== "failure") return `the check ${check} ended ${run.conclusion ?? "with no conclusion"} on the head, not failure: a check that passed proves no refusal`;
    const found = allCodes.filter((c) => new RegExp(`\\b${c}\\b`).test(log));
    if (!found.some((c) => gateCodes.includes(c))) return `the output of ${check} holds no code of this gate (${gateCodes.join(", ") || "none is set under mergeGate.codes"})`;
    const foreign = found.filter((c) => !gateCodes.includes(c));
    if (foreign.length) return `the output of ${check} holds ${foreign.join(", ")}, a code of another rule: the refusal is not of this gate alone`;
    const red = others.filter((o) => o.conclusion !== "success");
    if (red.length) return `the other required checks are not all green on the head: ${red.map((o) => `${o.name} ${o.conclusion ?? "missing"}`).join(", ")}`;
    if (!response?.message || response.merged === true) return "GitHub's answer does not refuse the merge";
    return null;
  }
  if (run.conclusion !== "success") return `the check ${check} ended ${run.conclusion ?? "with no conclusion"}, not success: a pass is a merge through a green gate`;
  if (!merged) return "the pull request was not merged";
  return null;
}

function proofMode({ cfg, argv, value, refuse, git }) {
  const task = argv[1];
  const [gate, check, pr, kind, repo] = [value("--gate"), value("--check"), value("--pr"), value("--kind"), value("--repo")];
  if (!TASK_NAME.test(gate ?? "")) return refuse("give the gate with --gate <task whose gate is probed>");
  if (!check) return refuse("give the required check with --check <name>");
  if (!/^\d+$/.test(pr ?? "")) return refuse("give the pull request with --pr N");
  if (!["refusal", "pass"].includes(kind)) return refuse("give --kind refusal or --kind pass");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? "")) return refuse("give the repository with --repo <owner>/<repo>");
  // After the merge of the task: its record of done, whose commit is on main.
  const { records } = readTaskInputs(cfg);
  const done = records.done.filter((d) => d.task === task);
  const main = ["origin/main", "main"].find((ref) => git("rev-parse", "--verify", "--quiet", ref).status === 0);
  if (!done.length || !main || !done.some((d) => git("merge-base", "--is-ancestor", d.commit, main).status === 0))
    return refuse(`the task ${task} is not merged: no record of done of it has its commit on main`);
  const rules = cfg.mergeGate?.rules && existsSync(cfg.mergeGate.rules) ? JSON.parse(readFileSync(cfg.mergeGate.rules, "utf8")) : null;
  const required = (rules?.ruleset?.rules ?? []).find((r) => r.type === "required_status_checks")?.parameters?.required_status_checks?.map((c) => c.context) ?? [];
  if (!required.includes(check)) return refuse(`${check} is not a required check of the rule file`);
  let response = null;
  const respFile = value("--response");
  if (respFile) {
    try {
      response = JSON.parse(readFileSync(respFile, "utf8"));
    } catch {
      return refuse(`${respFile} is not GitHub's answer as JSON`);
    }
  } else if (kind === "refusal") return refuse("a refusal keeps GitHub's answer to the attempt to merge: give --response FILE");
  let p, runs, wf, log;
  try {
    p = ghApi(`repos/${repo}/pulls/${pr}`);
    runs = ghApi(`repos/${repo}/commits/${p.head.sha}/check-runs`).check_runs ?? [];
    wf = ghApi(`repos/${repo}/actions/runs?head_sha=${p.head.sha}`).workflow_runs ?? [];
    const run = runs.find((r) => r.name === check);
    log = run ? ghApi(`repos/${repo}/actions/jobs/${run.id}/logs`, { json: false }) : "";
  } catch (e) {
    return refuse(e.message);
  }
  const run = runs.find((r) => r.name === check);
  const others = required.filter((n) => n !== check).map((n) => runs.find((r) => r.name === n) ?? { name: n, conclusion: null });
  const gateCodes = cfg.mergeGate?.codes?.[gate] ?? [];
  const allCodes = [...new Set([...GUARD_CODES, ...Object.values(cfg.mergeGate?.codes ?? {}).flat()])];
  const why = proofWrong({ kind, check, run, log, others, response, gateCodes, allCodes, merged: p.merged === true });
  if (why) return refuse(why);
  const w = wf.find((x) => x.name === check) ?? wf[0];
  const time = now();
  const body = [
    "Record: gate-proof",
    `Gate: ${gate}`,
    `Kind: ${kind}`,
    `Probe: pr ${pr}`,
    `Result: ${kind === "refusal" ? "refused" : "merged"}`,
    ...(kind === "refusal" ? [`Refused-by: ${check}`] : []),
    `Head: ${p.head.sha}`,
    `Base: ${p.base.sha}`,
    `Check: ${check} · ${run.conclusion}`,
    `Run: ${w?.id ?? run.id} · ${w?.html_url ?? run.html_url ?? `https://github.com/${repo}/pull/${pr}`}`,
    `Required: ${check} · ${run.conclusion}`,
    ...(kind === "refusal" ? [`Answer: ${String(response.message).replace(/\s+/g, " ").trim()}`] : []),
    ...(kind === "pass" ? [`Merge: ${p.merge_commit_sha}`] : []),
    `Time: ${time}`,
    "",
  ].join("\n");
  const name = writeSealed(cfg.taskRecords.dir, (i) => `${compact(time)}-${gate}-gate-proof${i > 1 ? `-${i}` : ""}.md`, body);
  console.log(`RECORDED ${relative(process.cwd(), join(cfg.taskRecords.dir, name))}`);
  return 0;
}

function main(argv) {
  const [mode, task] = argv;
  const value = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
  const refuse = (why) => (console.log(`ERROR · no record written: ${why}`), 1);
  if (!["change", "proof"].includes(mode)) return console.log(`ERROR · the mode ${mode ?? "(none)"} is not change or proof`), 1;
  if (!task || !TASK_NAME.test(task)) return refuse(`give the task after the mode: gate-record.mjs ${mode} <task>`);
  const cfg = loadConfig(value("--config") ?? "ont.config.json");
  if (!cfg.taskRecords || !cfg.reviewRounds) return refuse("the configuration names no taskRecords or no reviewRounds");
  const git = (...a) => spawnSync("git", ["-C", cfg.base, ...a], { encoding: "utf8", env: gitEnv(), maxBuffer: 1 << 28 });
  const top = git("rev-parse", "--show-toplevel").stdout?.trim();
  if (!top) return refuse("not in a Git repository");
  return mode === "change" ? changeMode({ cfg, argv, value, refuse, git, top }) : proofMode({ cfg, argv, value, refuse, git });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = main(process.argv.slice(2));
