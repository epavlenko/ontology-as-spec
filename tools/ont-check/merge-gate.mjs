#!/usr/bin/env node
// The merge gate on the server (D-158): the guard that main's workflow ont-gate-guard runs on a pull
// request, the confirmation before a merge that the head is past the reviewed commit by records alone,
// and the ruleset of main to send to GitHub.
//   node tools/ont-check/merge-gate.mjs guard --base <commit> --head <commit> [--config ont.config.json]
//   node tools/ont-check/merge-gate.mjs records-only --reviewed <commit> --head <commit> [--base <commit>] [--config ont.config.json]
//   node tools/ont-check/merge-gate.mjs ruleset [--config ont.config.json]
//   node tools/ont-check/merge-gate.mjs switch-on [--repo <owner>/<repo>] [--config ont.config.json]
//   node tools/ont-check/merge-gate.mjs rules --repo <owner>/<repo> [--fields token|all] [--config ont.config.json]
// guard reads the pull request only as data: the paths of the diff from the merge base of --base and
// --head to --head, and the records of rounds and tasks at --head, read from Git's objects into a
// temporary directory outside the working tree. It runs nothing of the pull request and changes neither
// the working tree nor the index. A change of a gate path (mergeGate.paths) passes only when records of a
// gate change added by the pull request, for the version of their task's statement approved in force at
// the head, name the path and are bound to the commit they name: their paths change up to it, the record
// is added by its child, and outside reviews/ the head is that commit merged with main.
// records-only passes when --reviewed is in --head, --head contains --base, and outside reviews/ the tree
// of --head is the tree of --reviewed merged with --base as Git merges them (D-165). After the narrow round
// that follows a confirmed condition, the commit it compares with is the one of the record of done that
// ends the range of fixes, which the records at --head give by tasks.mjs fixesRange, the one function that
// reads the range; without that record, --reviewed (rule.fixes-held-by-tests).
// Both fail closed: a Git command that fails is an error, never a diff or a history without changes.
// ruleset prints the ruleset of the rule file (mergeGate.rules) as the GitHub API takes it.
// switch-on prints the steps that switch the gate on after the merge of the task that brings it, in their
// order, each with its calls of gh api, from the rule file (rule.gate-switched-on, D-163).
// The guard also holds the records of the process (D-167): a record the base holds is never changed or
// removed, a record the pull request adds is at the head as the commit that added it wrote it, and, where
// the configuration at the base sets records.sealsFrom, a record it adds whose time is after the start of
// seals has a valid seal. It prints one code for each rule a pull request breaks (field.process-record.refusal-code).
// Where the configuration at the base sets mergeGate.taskState, the guard holds the merge by the state of the
// task too (rule.merge-by-task-state, D-185): a pull request that changes a path that is no record of the
// process is a change of a task, named by the records of done and of gate changes it adds, whose next action
// at the head, by tasks.mjs taskNext on the records at the head, is the merge, whose head outside the
// records is the commit that ended the task merged with main, none of whose commits outside the records was
// made before the task's first approval, and whose publication the owner allowed, by a record of the base or
// of the pull request for the task or for a goal the configuration at the base lists it under; a pull
// request of records alone needs a permission to publish on the base (rule.records-only-pr); and a gate path
// changes only within the gate paths of the approval in force (inv.gate-path-in-approval).
// rules reads the ruleset of main, and with --fields all the settings of Actions, through gh api (the command
// ONT_GH_CMD names, gh by default), and compares them with the rule file (inv.rules-match-file, D-185):
// RULES_DRIFT for a difference, RULES_UNREAD for a field of the token's that it could not read.
// ont: ent.merge-gate, field.merge-gate.guard, field.merge-gate.gate-paths, field.merge-gate.rule-file, edge.merge-gate.changes
// ont: inv.record-sealed, inv.records-immutable, field.process-record.seals-from, field.process-record.refusal-code
// ont: rule.ci-from-main, inv.gate-change-approved, rule.merge-what-was-checked, rule.main-through-gate, rule.gate-switched-on, rule.fixes-held-by-tests
// ont: field.merge-gate.task-state, edge.publish-permission.guard, rule.merge-by-task-state, rule.records-only-pr, derived.pr-task, inv.gate-path-in-approval, inv.rules-match-file, action.compare-rules
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gitEnv, loadConfig } from "./lib.mjs";
import { LATER_DIR, LIMITATIONS_FILE, parseRounds } from "./review-rounds.mjs";
import { recordTime, sealState, sealsStart } from "./seal.mjs";
import { approvalEvents, approvalInForce, approvedHash, fixesRange, parseTaskRecords, readTaskInputs, reviewedCommit, taskNext } from "./tasks.mjs";

// The directory of the records of the process: commits that change only files under it change no gate.
export const RECORDS_DIR = "reviews/";

// The codes the guard prints, one for each rule a pull request breaks (field.process-record.refusal-code):
// a gate path changed without an approval; a record added after the start of seals without a seal, or with
// one that is not its text's; a record of the base, or one the pull request added earlier, changed; and
// one removed. A gate proof of a refusal names the gate whose code alone is in the guard's output.
// Where the configuration at the base sets mergeGate.taskState, the codes of the merge by the state of the
// task (D-185): a change of a task no record of done names, or whose records name two tasks; a task whose
// next action at the head is not the merge; a head outside the records that is not the commit that ended the
// task merged with main; a commit of the work made before the task's first approval; no permission to
// publish; a gate path outside the gate paths of the approval in force. And the codes of the comparison of
// the rules of main on GitHub with the rule file: a difference, and a field the token's reading did not give.
export const TASK_CODES = ["TASK_UNNAMED", "TASK_NOT_DONE", "TASK_HEAD_UNREVIEWED", "WORK_BEFORE_APPROVAL", "MERGE_UNPERMITTED", "GATE_PATH_OUTSIDE_APPROVAL"];
export const RULES_CODES = ["RULES_DRIFT", "RULES_UNREAD"];
export const GUARD_CODES = ["GATE_PATH_UNAPPROVED", "SEAL_MISSING", "SEAL_WRONG", "RECORD_CHANGED", "RECORD_REMOVED", ...TASK_CODES, ...RULES_CODES];

// Whether a path of the repository is a gate path: a pattern ending in "/" names everything under it,
// and "*" any name within one part of a path; any other pattern names that path alone.
export function isGatePath(path, patterns) {
  return patterns.some((p) => {
    if (p.endsWith("/")) return path.startsWith(p);
    const re = new RegExp(`^${p.split("*").map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*")}$`);
    return re.test(path);
  });
}

const git = (top, ...args) => spawnSync("git", ["-C", top, ...args], { encoding: "utf8", env: gitEnv(), maxBuffer: 1 << 28 });
const out = (r) => (r.status === 0 ? r.stdout : null);
const isCommit = (top, c) => /^[0-9a-f]{7,40}$/.test(c ?? "") && git(top, "cat-file", "-e", `${c}^{commit}`).status === 0;
const full = (top, c) => out(git(top, "rev-parse", "--verify", "--quiet", `${c}^{commit}`))?.trim() ?? null;
const lines0 = (text) => (text ?? "").split("\0").filter(Boolean);

// A Git command that failed. The guard and records-only fail closed on it: no caller reads a failure as a
// diff or a history without changes (rule.merge-what-was-checked, inv.gate-change-approved).
export class GitError extends Error {}
const failed = (args, r) => new GitError(`git ${args.join(" ")} failed: ${(r.stderr || r.error?.message || `exit ${r.status}`).trim().split("\n")[0]}`);
function must(top, ...args) {
  const r = git(top, ...args);
  if (r.status !== 0) throw failed(args, r);
  return r.stdout;
}
// Whether a is an ancestor of b: Git answers 0 or 1, and anything else is an error.
function isAncestor(top, a, b) {
  const args = ["merge-base", "--is-ancestor", a, b];
  const r = git(top, ...args);
  if (r.status === 0 || r.status === 1) return r.status === 0;
  throw failed(args, r);
}
// The merge base of two commits, or null when they have none.
function mergeBase(top, a, b) {
  const args = ["merge-base", a, b];
  const r = git(top, ...args);
  if (r.status === 0) return r.stdout.trim();
  if (r.status === 1 && !r.stderr.trim()) return null;
  throw failed(args, r);
}
// The paths whose content differs between two commits or trees.
const changedBetween = (top, a, b) => lines0(must(top, "diff", "--no-renames", "--no-ext-diff", "--no-textconv", "--name-only", "-z", a, b));
const outside = (paths) => paths.filter((f) => !f.startsWith(RECORDS_DIR));
// Whether a commit's tree holds a path, read from Git's objects.
const holds = (top, commit, path) => must(top, "ls-tree", "--name-only", "-z", commit, "--", path) !== "";

// The tree of `commit` merged with `base` as Git merges them, with the paths that conflict; without a
// base, the commit's own tree.
export function mergedTree(top, commit, base = null) {
  if (!base) return { tree: must(top, "rev-parse", "--verify", `${commit}^{tree}`).trim(), conflicts: [] };
  const args = ["merge-tree", "--write-tree", "--name-only", "--no-messages", "-z", commit, base];
  const r = git(top, ...args);
  if (r.status !== 0 && r.status !== 1) throw failed(args, r);
  const [tree, ...conflicts] = lines0(r.stdout);
  if (!/^[0-9a-f]{40,64}$/.test(tree ?? "")) throw failed(args, r);
  return { tree, conflicts: r.status === 1 ? [...new Set(conflicts)] : [] };
}

// What the head holds outside the records that `commit` merged with `base` does not: the paths that
// conflict outside reviews/, and the paths outside reviews/ whose content differs. Both empty when the
// head is past `commit` by records and by a clean merge of base alone, whatever the history between.
export function pastByRecords(top, { commit, head, base = null }) {
  const m = mergedTree(top, commit, base);
  const conflicts = outside(m.conflicts);
  return { conflicts, differ: conflicts.length ? [] : outside(changedBetween(top, m.tree, head)) };
}

// records-only: whether the head is past the reviewed commit by records alone, merged with the base.
export function recordsOnly({ top, reviewed, head, base = null }) {
  try {
    if (!isAncestor(top, reviewed, head)) return { errors: [`the reviewed commit ${reviewed} is not in the head ${head}: the head is not past what was reviewed`] };
    if (base && !isAncestor(top, base, head)) return { errors: [`the head ${full(top, head)} does not contain the base ${full(top, base)}: update the branch with main and confirm again`] };
    const p = pastByRecords(top, { commit: reviewed, head, base });
    if (p.conflicts.length) return { errors: [`the reviewed commit and the base conflict outside ${RECORDS_DIR}: ${p.conflicts.join(", ")}; their resolution is a change no reviewer read, so it needs a review of its own`] };
    if (p.differ.length) {
      const commits = must(top, "rev-list", head, `^${reviewed}`, ...(base ? [`^${base}`] : []), "--", ...p.differ).split("\n").filter(Boolean);
      return {
        errors: [
          `outside ${RECORDS_DIR} the head is not the reviewed commit${base ? " merged with the base" : ""}: ${p.differ.join(", ")}`,
          ...(commits.length ? ["the commits of the branch that change them:", ...commits.map((c) => `  ${c}`)] : ["the merge of the base changes them: its resolution is a change no reviewer read"]),
        ],
      };
    }
    return { errors: [] };
  } catch (e) {
    if (e instanceof GitError) return { errors: [e.message] };
    throw e;
  }
}

// Copies the files under a directory of the repository at a commit into a temporary directory, from Git's
// objects, so that they are read as data and never written into the working tree.
function filesAt(top, commit, dir, into) {
  const listed = lines0(must(top, "ls-tree", "-r", "-z", "--full-tree", "--name-only", commit, "--", dir));
  for (const path of listed) {
    const args = ["cat-file", "blob", `${commit}:${path}`];
    const blob = spawnSync("git", ["-C", top, ...args], { env: gitEnv(), maxBuffer: 1 << 28 });
    if (blob.status !== 0) throw failed(args, { ...blob, stderr: String(blob.stderr ?? "") });
    const to = join(into, path);
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, blob.stdout);
  }
  return join(into, dir);
}

// Why a record of a gate change the pull request adds approves nothing, or [] when it is bound to the
// commit it names (inv.gate-change-approved, field.gate-change.commit): the commit is in the head and not
// in the base, it is the last commit of the pull request that changes a path outside reviews/, by its own
// diff from its first parent, with none after it but a merge doing so, never a later commit of records
// alone, each path the record lists changes between the main it was based on and it, the record is
// added by a commit whose one parent it is, and outside reviews/ the head is that commit merged with the
// main the head contains.
function unbound(top, { g, file, b, h, mb, children }) {
  const short = g.commit.slice(0, 12);
  if (!isCommit(top, g.commit) || !isAncestor(top, g.commit, h)) return [`commit ${short} is not in the head`];
  if (isAncestor(top, g.commit, b)) return [`commit ${short} is already in the base, not a commit of the pull request`];
  const why = [];
  const own = mergeBase(top, g.commit, b);
  const made = new Set(own ? changedBetween(top, own, g.commit) : []);
  for (const p of g.paths) if (!made.has(p)) why.push(`${p} does not change between the merge base and commit ${short}`);
  const commit = full(top, g.commit);
  const parents = must(top, "rev-list", "--parents", "-n", "1", commit).trim().split(" ").slice(1);
  const ownDiff = parents.length ? changedBetween(top, parents[0], commit) : lines0(must(top, "ls-tree", "-r", "-z", "--name-only", commit));
  if (!outside(ownDiff).length) why.push(`commit ${short} changes nothing outside ${RECORDS_DIR}: the record names a commit of records alone, not the last commit of the pull request outside ${RECORDS_DIR}`);
  const laterOutside = must(top, "rev-list", "--no-merges", h, `^${commit}`, `^${b}`)
    .split("\n")
    .filter(Boolean)
    .filter((c) => outside(changedBetween(top, `${c}^`, c)).length);
  if (laterOutside.length) why.push(`commit ${short} is not the last commit of the pull request outside ${RECORDS_DIR}: ${laterOutside.map((c) => c.slice(0, 12)).join(", ")} after it change paths outside ${RECORDS_DIR}`);
  if (holds(top, commit, file) || !(children.get(commit) ?? []).some((c) => holds(top, c, file))) why.push(`the record is not added by the commit right after commit ${short}, whose one parent it is`);
  const after = pastByRecords(top, { commit, head: h, base: mb });
  if (after.conflicts.length) why.push(`commit ${short} and main conflict outside ${RECORDS_DIR}: ${after.conflicts.join(", ")}`);
  if (after.differ.length) why.push(`outside ${RECORDS_DIR} the head is not commit ${short} merged with main: ${after.differ.join(", ")}`);
  return why;
}

// The records of rounds and of tasks at a commit, read from Git's objects into tmp as data, never from the
// working tree; a Git command that fails throws GitError. The files a filed finding may name, the
// limitations and the tickets for later (rule.findings-filed), are copied from the same commit, and tmp is
// the root they are looked up in, so that a round is clean for the guard as it is for --task.
function recordsAt({ cfg, top, head, tmp }) {
  const rel = (d) => relative(top, d).split("\\").join("/");
  const roundsDir = cfg.reviewRounds ? filesAt(top, head, rel(cfg.reviewRounds.dir), tmp) : null;
  const tasksDir = cfg.taskRecords ? filesAt(top, head, rel(cfg.taskRecords.dir), tmp) : null;
  if (roundsDir) for (const filed of [LIMITATIONS_FILE, LATER_DIR.replace(/\/$/, "")]) filesAt(top, head, filed, tmp);
  const rounds = roundsDir && existsSync(roundsDir) ? parseRounds(roundsDir, { latinOnly: cfg.records.latinOnly, root: tmp, hashFrom: cfg.reviewRounds.gatesFrom ?? "" }).rounds : [];
  const records = tasksDir && existsSync(tasksDir) ? parseTaskRecords(tasksDir, { latinOnly: cfg.records.latinOnly }) : { gateChanges: [], approvals: [], publications: [], done: [], malformed: [] };
  // Every record a task's next action reads, as --task reads them, by the one function, at the head (D-185).
  const inputs = () => readTaskInputs(cfg, { roundsDir: roundsDir && existsSync(roundsDir) ? roundsDir : join(tmp, "absent"), tasksDir: tasksDir && existsSync(tasksDir) ? tasksDir : join(tmp, "absent"), root: tmp, top });
  return { rounds, records, inputs, recordsPath: cfg.taskRecords ? rel(cfg.taskRecords.dir) : null };
}

// What records-only compares the head with (rule.fixes-held-by-tests, D-165): after the narrow round whose
// commit is the reviewed one, whose verdict of acceptance holds, the commit of the record of done that ends
// its range of fixes, read from the records at the head; otherwise the reviewed commit itself.
export function comparedWith({ cfg, top, reviewed, head }) {
  if (!cfg.reviewRounds || !cfg.taskRecords) return { commit: reviewed, range: null };
  const tmp = mkdtempSync(join(tmpdir(), "ont-records-only-"));
  try {
    const at = recordsAt({ cfg, top, head, tmp });
    if (at.errors) return { errors: at.errors };
    const r = full(top, reviewed);
    const tasks = [...new Set(at.rounds.map((x) => x.task))];
    const range = tasks
      .map((task) => fixesRange({ rounds: at.rounds, done: at.records.done ?? [], approvals: at.records.approvals ?? [], task, head }))
      .find((x) => x?.done && x.acceptance === "held" && x.from && full(top, x.from) === r);
    if (!range) return { commit: reviewed, range: null };
    const end = full(top, range.done.commit);
    if (!end) return { errors: [`the record of done ${range.done.file} names commit ${range.done.commit}, which is not a commit of this clone`] };
    if (!isAncestor(top, r, end)) return { errors: [`the record of done ${range.done.file} is of commit ${end}, which does not contain the reviewed commit ${r}`] };
    return { commit: end, range };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// The directories of the records of the process, from the root of the repository, each ending in "/": the
// rounds, the task records and the verdicts the configuration names (D-167).
export const recordDirs = (cfg, top) =>
  [cfg.reviewRounds?.dir, cfg.taskRecords?.dir, cfg.manualRuns?.dir].filter(Boolean).map((d) => `${relative(top, d).split("\\").join("/")}/`);
// Whether a path is a record of the process: a Markdown file under one of those directories, never README.md.
export const isRecordPath = (p, dirs) => dirs.some((d) => p.startsWith(d)) && p.endsWith(".md") && !p.endsWith("/README.md");
const blobId = (top, commit, path) => out(git(top, "rev-parse", "--verify", "--quiet", `${commit}:${path}`))?.trim() ?? null;

// What the pull request from b to h, with merge base mb, does to the records of the process that a rule of
// D-167 refuses, each with its code (inv.records-immutable, inv.record-sealed): a record of the base
// changed or removed; a record added by a commit of the pull request that is not at the head as that commit
// wrote it, or is gone; and, where the configuration at b sets records.sealsFrom, a record the pull request
// adds whose Time: is after the start of seals with no seal, or with one that is not its text's. The seal is
// computed by this code, main's, never the pull request's.
export function recordProblems({ cfg, top, b, h, mb }) {
  const dirs = recordDirs(cfg, top);
  if (!dirs.length) return [];
  const problems = [];
  const status = lines0(must(top, "diff", "--no-renames", "--name-status", "-z", mb, h, "--", ...dirs));
  const added = [];
  for (let i = 0; i < status.length; i += 2) {
    const [st, path] = [status[i], status[i + 1]];
    if (!isRecordPath(path, dirs)) continue;
    if (st === "M" || st === "T") problems.push({ code: "RECORD_CHANGED", path, why: "a record of the base is changed: a record is never edited, a new one is written" });
    else if (st === "D") problems.push({ code: "RECORD_REMOVED", path, why: "a record of the base is removed" });
    else if (st === "A") added.push(path);
  }
  // Every record a commit of the pull request added, with the first commit that added it.
  const firstAdd = new Map();
  let commit = null;
  for (const line of must(top, "log", "--no-renames", "--diff-filter=A", "--format=@%H", "--name-only", h, `^${b}`, "--", ...dirs).split("\n")) {
    if (line.startsWith("@")) commit = line.slice(1);
    else if (line && isRecordPath(line, dirs)) firstAdd.set(line, commit);
  }
  for (const [path, c] of firstAdd) {
    const now = blobId(top, h, path);
    if (!now) problems.push({ code: "RECORD_REMOVED", path, why: `added by commit ${c.slice(0, 12)} of the pull request and removed since` });
    else if (now !== blobId(top, c, path)) problems.push({ code: "RECORD_CHANGED", path, why: `not as commit ${c.slice(0, 12)} of the pull request added it: a record is never edited, a new one is written` });
  }
  const cfgPath = relative(top, cfg.file).split("\\").join("/");
  const start = sealsStart(top, b, cfgPath);
  if (start)
    for (const path of added) {
      const text = must(top, "cat-file", "blob", `${h}:${path}`);
      const time = recordTime(text);
      if (time && time <= start) continue;
      const s = sealState(text);
      if (s.state === "missing") problems.push({ code: "SEAL_MISSING", path, why: `written after seals start (${start}) with no seal: records of the process are written by the tool's writers` });
      else if (s.state === "wrong") problems.push({ code: "SEAL_WRONG", path, why: `${s.why}` });
    }
  return problems;
}

// The branch of main the rule file names in its ruleset, main when none is named, as the clone has it:
// origin's first, or else its own; null when the clone has neither.
export function mainRef(cfg, top) {
  let branch = "main";
  try {
    const include = JSON.parse(readFileSync(cfg.mergeGate?.rules ?? "", "utf8"))?.ruleset?.conditions?.ref_name?.include ?? [];
    const named = include.find((r) => /^refs\/heads\/[^*~]+$/.test(r));
    if (named) branch = named.slice("refs/heads/".length);
  } catch {}
  return [`origin/${branch}`, branch].find((ref) => out(git(top, "rev-parse", "--verify", "--quiet", `${ref}^{commit}`))) ?? null;
}

// The notes of the full check and of pre-commit on the records of the working tree (D-167): information
// only, never an error, so that the refusal of a merge for a seal is the guard's alone. A record of HEAD
// changed or removed in the working tree, and, where the configuration at the base of the pull request sets
// records.sealsFrom, a record with a time after the start of seals whose seal is missing or wrong. The base
// is the one the guard reads, pull_request.base.sha, the tip of main, never HEAD, so that a branch that
// brings the key is told of no refusal the guard would not give (D-181).
export function localRecordNotes(cfg) {
  const top = out(git(cfg.base, "rev-parse", "--show-toplevel"))?.trim();
  if (!top || !out(git(top, "rev-parse", "--verify", "--quiet", "HEAD"))) return [];
  const dirs = recordDirs(cfg, top);
  if (!dirs.length) return [];
  const notes = [];
  const st = git(top, "status", "--porcelain", "--no-renames", "-z", "--", ...dirs);
  for (const entry of lines0(st.stdout)) {
    const [code, path] = [entry.slice(0, 2), entry.slice(3)];
    if (!isRecordPath(path, dirs)) continue;
    if (/M/.test(code)) notes.push(`${path}: a record of HEAD is changed in the working tree (the guard refuses it, RECORD_CHANGED)`);
    if (/D/.test(code)) notes.push(`${path}: a record of HEAD is removed in the working tree (the guard refuses it, RECORD_REMOVED)`);
  }
  const cfgPath = relative(top, cfg.file).split("\\").join("/");
  const main = mainRef(cfg, top);
  const base = main && out(git(top, "merge-base", "HEAD", main)) ? main : null;
  if (!base) {
    if (sealsStart(top, "HEAD", cfgPath)) notes.push(`no base of the pull request is found, ${main ? `HEAD and ${main} have no common commit` : "the clone has no main branch"}: which records the guard refuses for their seals is not said`);
    return notes;
  }
  const start = sealsStart(top, base, cfgPath);
  if (start)
    for (const dir of dirs) {
      const listed = lines0(git(top, "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", dir).stdout).filter((p) => isRecordPath(p, dirs));
      for (const path of listed) {
        // A record main holds is not one the pull request adds: the guard reads only those for a seal.
        if (blobId(top, base, path)) continue;
        let text;
        try {
          text = readFileSync(join(top, path), "utf8");
        } catch {
          continue;
        }
        const time = recordTime(text);
        if (time && time <= start) continue;
        const s = sealState(text);
        if (s.state !== "valid") notes.push(`${path}: ${s.why}, after seals start (${start}); the guard refuses it (${s.state === "missing" ? "SEAL_MISSING" : "SEAL_WRONG"})`);
      }
    }
  return notes;
}

// The configuration at a commit, read from Git's objects as data, or null where it has none or it is not
// JSON: the base's decides which rules the guard holds and which goals a task is part of (D-185).
export function configAt(top, commit, cfgPath) {
  const r = git(top, "show", `${commit}:${cfgPath}`);
  if (r.status !== 0) return null;
  try {
    return JSON.parse(r.stdout);
  } catch {
    return null;
  }
}

// The task of a pull request (derived.pr-task, D-185): the one task its records of done and of gate changes
// it adds name, from the records at the head; the description of the pull request is never read. null with
// why, when it adds no record of done, or its records name more than one task.
export function prTask({ done = [], gateChanges = [] }) {
  const tasks = [...new Set([...done, ...gateChanges].map((x) => x.task))].sort();
  if (!done.length) return { task: null, why: "it adds no record of done: the task of a pull request is named by the records of done it adds" };
  if (tasks.length > 1) return { task: null, why: `its records of done and of gate changes name more than one task: ${tasks.join(", ")}` };
  return { task: tasks[0], why: null };
}

// What the merge by the state of the task refuses in the pull request from b to h, with merge base mb, each
// with its code (rule.merge-by-task-state, rule.records-only-pr, D-185), where the configuration at the base,
// baseCfg, sets mergeGate.taskState: changed is its paths, at the records at the head, read by recordsAt.
function taskStateProblems({ cfg, top, b, h, mb, changed, at, baseCfg, tmp }) {
  const dirs = recordDirs(cfg, top);
  const taskPaths = changed.filter((p) => !isRecordPath(p, dirs));
  const recordsPath = at.recordsPath;
  const addedBy = (list) => list.filter((x) => recordsPath && changed.includes(`${recordsPath}/${x.file}`));
  // The permissions to publish the base holds, read from Git's objects as data.
  const basePubs = recordsPath ? parseTaskRecords(filesAt(top, b, recordsPath, join(tmp, "base")), { latinOnly: cfg.records.latinOnly }).publications : [];
  const problems = [];
  // A pull request that changes nothing publishes nothing.
  if (!changed.length) return problems;
  if (!taskPaths.length) {
    // A pull request of records alone: no chain, and a permission to publish of any goal or task on the base.
    if (!basePubs.length) problems.push({ code: "MERGE_UNPERMITTED", why: "a pull request of records alone passes on a permission to publish of the owner that the base holds, of a goal or of a task, and the base holds none" });
    return problems;
  }
  const named = prTask({ done: addedBy(at.records.done), gateChanges: addedBy(at.records.gateChanges) });
  if (!named.task) {
    problems.push({ code: "TASK_UNNAMED", why: `it changes paths that are no record of the process, ${taskPaths.slice(0, 5).join(", ")}${taskPaths.length > 5 ? ", …" : ""}, so it is a change of a task, and ${named.why}` });
    return problems;
  }
  const task = named.task;
  // The chain: the task's next action at the head, by the function --task asks, with the records at the
  // head, no statement's file, and spend by the snapshots, as CI reads it.
  const inputs = at.inputs();
  const { rounds, records, malformed } = inputs;
  const gatesFrom = baseCfg.reviewRounds?.gatesFrom ?? cfg.reviewRounds?.gatesFrom ?? null;
  const next = taskNext({ rounds, spend: records.spend, done: records.done, approvals: records.approvals, task, defaults: baseCfg.budget ?? cfg.budget, statement: null, malformed, needFile: false, gatesFrom, head: h, spendNow: null, pending: [], snapshots: records.snapshots });
  if (next.branch !== "done") problems.push({ code: "TASK_NOT_DONE", why: `the next action of ${task} at the head is not the merge: NEXT ${task}: ${next.say}` });
  else {
    // The head is what was checked: outside the records, the commit the end of the step names, the one the
    // last clean round reviewed, or after the narrow round with findings the commit of the record of done
    // that ends the range of fixes, merged with the main the head contains.
    const end = next.result?.fixes?.done ? next.result.fixes.done.commit : reviewedCommit(next.view.results.at(-1));
    const c = end && full(top, end);
    if (!c) problems.push({ code: "TASK_HEAD_UNREVIEWED", why: `the commit that ended ${task}, ${end ?? "(none)"}, is not a commit of this clone` });
    else if (!isAncestor(top, c, h)) problems.push({ code: "TASK_HEAD_UNREVIEWED", why: `the commit that ended ${task}, ${c.slice(0, 12)}, is not in the head` });
    else {
      const p = pastByRecords(top, { commit: c, head: h, base: mb });
      if (p.conflicts.length) problems.push({ code: "TASK_HEAD_UNREVIEWED", why: `the commit that ended ${task}, ${c.slice(0, 12)}, and main conflict outside ${RECORDS_DIR}: ${p.conflicts.join(", ")}` });
      else if (p.differ.length) problems.push({ code: "TASK_HEAD_UNREVIEWED", why: `outside ${RECORDS_DIR} the head is not ${c.slice(0, 12)}, the commit that ended ${task}, merged with main: ${p.differ.join(", ")}` });
    }
  }
  // No commit of the work before the task's first approval, by the committer's time. The files a filed
  // finding of a round of the review of its statement names, the limitations and the tickets, are written
  // before the approval by the rounds that file them, and are no work (D-185).
  const first = approvalEvents(rounds, task, records.approvals).find((e) => e.hash);
  if (first) {
    const filed = new Set(rounds.filter((r) => r.task === task && r.step === "statement-review").flatMap((r) => r.findings.filter((x) => x.filed && x.file).map((x) => x.file)));
    const early = [];
    for (const line of must(top, "log", "--no-merges", "--format=%H %ct", h, `^${b}`).split("\n").filter(Boolean)) {
      const [commit, ct] = line.split(" ");
      const when = new Date(Number(ct) * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
      if (when >= first.time) continue;
      const parents = must(top, "rev-list", "--parents", "-n", "1", commit).trim().split(" ").slice(1);
      const own = parents.length ? changedBetween(top, parents[0], commit) : lines0(must(top, "ls-tree", "-r", "-z", "--name-only", commit));
      if (own.some((p) => !isRecordPath(p, dirs) && !filed.has(p))) early.push(`${commit.slice(0, 12)} at ${when}`);
    }
    if (early.length) problems.push({ code: "WORK_BEFORE_APPROVAL", why: `commits outside the records were made before the first approval of ${task}, ${first.file} at ${first.time}: ${early.join(", ")}` });
  }
  // The permission to publish: on the base or added by the pull request, of the task or of a goal the
  // configuration at the base lists it under.
  const goals = Object.entries(baseCfg.goals ?? {}).filter(([, ts]) => Array.isArray(ts) && ts.includes(task)).map(([g]) => g);
  const pubs = [...basePubs, ...addedBy(at.records.publications ?? [])];
  if (!pubs.some((x) => x.scope === task || goals.includes(x.scope)))
    problems.push({ code: "MERGE_UNPERMITTED", why: `no permission of the owner to publish ${task}${goals.length ? ` or its goal ${goals.join(", ")}` : ""} is on the base or added by the pull request` });
  return problems;
}

// The guard: what the pull request from base to head changes among the gate paths, and which of those
// changes no record of a gate change approves, with the reason. A Git command that fails is an error.
export function guard({ cfg, base, head }) {
  const top = out(git(cfg.base, "rev-parse", "--show-toplevel"))?.trim();
  if (!top) return { errors: ["not in a Git repository"] };
  if (!cfg.mergeGate) return { errors: [`the configuration ${cfg.file} names no mergeGate`] };
  const missing = [["base", base], ["head", head]].filter(([, c]) => !isCommit(top, c));
  if (missing.length) return { errors: missing.map(([k, c]) => `the ${k} ${c ?? "(none)"} is not a commit of this clone`) };
  const tmp = mkdtempSync(join(tmpdir(), "ont-gate-"));
  try {
    const [b, h] = [full(top, base), full(top, head)];
    const mb = mergeBase(top, b, h);
    if (!mb) return { errors: [`the base ${b} and the head ${h} have no common commit`] };
    const changed = changedBetween(top, mb, h);
    const gated = changed.filter((p) => isGatePath(p, cfg.mergeGate.paths));
    const records = recordProblems({ cfg, top, b, h, mb });
    // The merge by the state of the task, only where the configuration at the base sets its key (D-185).
    const baseCfg = configAt(top, b, relative(top, cfg.file).split("\\").join("/"));
    const taskState = baseCfg?.mergeGate?.taskState === true;
    const at = taskState || gated.length ? recordsAt({ cfg, top, head: h, tmp: join(tmp, "head") }) : null;
    const task = taskState ? taskStateProblems({ cfg, top, b, h, mb, changed, at, baseCfg, tmp }) : [];
    if (!gated.length) return { changed, gated, approved: [], refused: [], outside: [], notes: [], records, task, taskState };
    const { rounds, records: atHead, recordsPath } = at;
    // The commits of the pull request by their parents, so that the commit right after a named one is found.
    const children = new Map();
    for (const line of must(top, "rev-list", "--parents", h, `^${b}`).split("\n").filter(Boolean)) {
      const [c, ...parents] = line.split(" ");
      if (parents.length === 1) children.set(parents[0], [...(children.get(parents[0]) ?? []), c]);
    }
    const notes = [];
    const valid = [];
    // Of the records of a gate change the pull request adds, the latest by time for each task and item: an
    // earlier one, written before a later commit outside reviews/, is kept, never edited, and speaks no more.
    const added = atHead.gateChanges.filter((g) => changed.includes(`${recordsPath}/${g.file}`));
    const latest = added.filter((g) => !added.some((o) => o !== g && o.task === g.task && o.item === g.item && (o.time > g.time || (o.time === g.time && o.file > g.file))));
    for (const g of latest) {
      const file = `${recordsPath}/${g.file}`;
      const why = [];
      const approved = approvedHash(rounds, g.task, null, atHead.approvals);
      if (approved !== g.statementHash) why.push(`version ${g.statementHash.slice(0, 12)} of the statement of ${g.task} is not approved in force${approved ? ` (${approved.slice(0, 12)} is)` : ""}`);
      why.push(...unbound(top, { g, file, b, h, mb, children }));
      if (why.length) notes.push(`${g.file}: approves nothing: ${why.join("; ")}`);
      else valid.push(g);
    }
    const malformed = atHead.malformed.filter((m) => /gate-change/.test(m));
    notes.push(...malformed.map((m) => `${m} (cannot be read)`));
    const approved = [];
    const refused = [];
    // Under the key, a gate path the approval in force of the record's task does not list on Gate-paths: is
    // outside it, and an approval with no line lists none (inv.gate-path-in-approval, D-185).
    const outsideApproval = [];
    for (const p of gated) {
      const by = valid.filter((g) => g.paths.includes(p));
      if (by.length) approved.push({ path: p, by: by.map((g) => g.file) });
      else refused.push({ path: p, why: valid.length ? "no record of a gate change of the pull request names it" : "no record of a gate change of the pull request approves it" });
      if (taskState)
        for (const g of by) {
          const e = approvalInForce(rounds, g.task, null, atHead.approvals);
          if (!e?.gatePaths?.length || !isGatePath(p, e.gatePaths))
            outsideApproval.push({ path: p, why: `${e?.gatePaths?.length ? `not within the gate paths ${e.gatePaths.join(", ")}` : "no gate paths"} of the approval in force of ${g.task}${e ? `, ${e.file}` : ""}` });
        }
    }
    return { changed, gated, approved, refused, outside: outsideApproval, notes, records, task, taskState };
  } catch (e) {
    if (e instanceof GitError) return { errors: [e.message] };
    throw e;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// The steps that switch the gate on after the merge of the task that brings it, in their order, each with
// its calls of `gh api`, from the rule file (rule.gate-switched-on, D-163): the event policy that allows
// pull_request_target for the guard's workflow first, since GitHub blocks that event in a public
// repository without one, and the guard would not run on the pull request of records; that policy read
// back by its own call, whose response holds its conditions and rules where the list gives summaries, and
// the permissions of Actions; the pull request of records with both checks under their names and from
// their app; the ruleset created active; the ruleset read back and compared; the three refusal probes,
// the third's base and head read before main moves on and the tip of main after; their gate proofs, the
// first holding what the pull request of records showed, the third both commits of main; the probes'
// pull requests closed and their branches deleted. A rule file without a ruleset that requires checks of
// an app, or without a policy that allows pull_request_target, gives no steps but an error.
export function switchOnSteps(rules, { repo = "<owner>/<repo>", file = ".github/merge-gate.json" } = {}) {
  const ruleset = rules?.ruleset;
  const rule = (type) => ruleset?.rules?.find((r) => r.type === type)?.parameters;
  const required = rule("required_status_checks");
  const checks = required?.required_status_checks ?? [];
  if (!ruleset || !checks.length || checks.some((c) => !c.context || !Number.isInteger(c.integration_id))) throw new Error(`${file} holds no ruleset that requires checks by name and by app (integration_id)`);
  const policies = (rules.actions?.policies ?? []).filter((p) => (p.rules ?? []).some((r) => r.type === "restrict_action_events" && (r.parameters?.allowed_events ?? []).includes("pull_request_target")));
  if (!policies.length) throw new Error(`${file} holds no Actions policy that allows pull_request_target`);
  const perms = rules.actions?.permissions ?? {};
  const wf = rules.actions?.workflow ?? {};
  const names = checks.map((c) => c.context);
  const app = (c) => `${c.context} · success · app ${c.integration_id}`;
  const methods = rule("pull_request")?.allowed_merge_methods ?? [];
  // A body for gh api --input -, on one line in single quotes, so that the command is copied whole.
  const body = (x) => {
    const j = JSON.stringify(x);
    if (j.includes("'")) throw new Error(`a body of ${file} holds a single quote: ${j}`);
    return `echo '${j}'`;
  };
  const R = `repos/${repo}`;
  for (const p of policies) if (String(p.name).includes("'") || String(p.name).includes('"')) throw new Error(`a policy of ${file} has a quote in its name: ${p.name}`);
  const policyId = (p) => `gh api ${R}/actions/policies --jq '.policies[] | select(.name == "${p.name}") | .id'`;
  const policyGet = `gh api ${R}/actions/policies/<id> --jq '{name, enforcement, conditions, rules: [.rules[] | {type, parameters}]}'`;
  const mainTip = `gh api ${R}/commits/main --jq .sha`;
  const shaLines = `gh api ${R}/pulls/<n> --jq '[.head.sha, .base.sha] | @tsv'`;
  const checkRuns = `gh api ${R}/commits/<head>/check-runs --jq '.check_runs[] | [.name, .conclusion, .app.id] | @tsv'`;
  const merge = `gh api -X PUT ${R}/pulls/<n>/merge -f merge_method=merge -f sha=<head>`;
  return [
    {
      title: `Allow pull_request_target for the guard's workflow by the Actions policy, the event policy`,
      say: [
        `GitHub blocks pull_request_target in a public repository that has no event policy for it, so ${names.find((n) => /guard/.test(n)) ?? names[1] ?? names[0]} would not run. List the repository's policies; when one of the same name exists, update it, \`gh api -X PUT ${R}/actions/policies/<id> --input -\` with the same body; otherwise create it:`,
      ],
      run: [`gh api ${R}/actions/policies --jq '.policies[] | [.id, .name] | @tsv'`, ...policies.map((p) => `${body(p)} | gh api -X POST ${R}/actions/policies --input -`)],
    },
    {
      title: "Read the Actions settings back and compare them with the rule file",
      say: [
        "Each policy is read back by its own call, found by its name in the list: the list gives summaries, and only the call of the policy gives its conditions and its rules to compare.",
        ...policies.map((p) => `the policy "${p.name}": enforcement ${p.enforcement}, workflows ${(p.conditions?.workflow_path?.include ?? []).join(", ")}, excluded ${JSON.stringify(p.conditions?.workflow_path?.exclude ?? [])}, rules ${p.rules.map((r) => r.type).join(", ")}, events ${p.rules.flatMap((r) => r.parameters?.allowed_events ?? []).join(", ")}`),
        `the permissions: enabled ${perms.enabled}, allowed actions ${perms.allowed_actions}; the workflows' token: ${wf.default_workflow_permissions}, approving reviews ${wf.can_approve_pull_request_reviews}`,
        `A difference stops here: set it as ${file} says, \`gh api -X PUT ${R}/actions/permissions -F enabled=${perms.enabled} -f allowed_actions=${perms.allowed_actions}\`, \`gh api -X PUT ${R}/actions/permissions/workflow -f default_workflow_permissions=${wf.default_workflow_permissions} -F can_approve_pull_request_reviews=${wf.can_approve_pull_request_reviews}\`, and read it back again.`,
      ],
      run: [...policies.flatMap((p) => [policyId(p), policyGet]), `gh api ${R}/actions/permissions`, `gh api ${R}/actions/permissions/workflow`],
    },
    {
      title: "Open the preflight pull request of the task's records alone and wait for both checks",
      say: [
        "A branch from main with the task's records alone, its rounds and verdicts under reviews/, pushed, and its pull request into main:",
        `Wait until both checks have run on its head, then read them: each must be ${checks.map(app).join(", and ")}, under that name and from that app. Keep the pull request, its head and these lines for the first gate proof.`,
      ],
      run: [`gh api ${R}/pulls -f base=main -f head=<branch> -f title=<title> -f body=<body>`, shaLines, `gh pr checks <n> --watch`, checkRuns],
    },
    {
      title: "Create the ruleset active from the rule file",
      say: [`When a ruleset of the same name exists, update it, \`node tools/ont-check/merge-gate.mjs ruleset | gh api -X PUT ${R}/rulesets/<id> --input -\`; otherwise:`],
      run: [`node tools/ont-check/merge-gate.mjs ruleset | gh api -X POST ${R}/rulesets --input -`],
    },
    {
      title: "Read the ruleset back and compare it with the rule file",
      say: [
        `It must be: enforcement ${ruleset.enforcement} on ${(ruleset.conditions?.ref_name?.include ?? []).join(", ")}; a pull request required, merged by ${methods.join(", ")} alone; the required checks ${checks.map((c) => `${c.context} from app ${c.integration_id}`).join(" and ")}; strict, the branch up to date with main, ${required.strict_required_status_checks_policy}; no bypass, bypass actors ${JSON.stringify(ruleset.bypass_actors ?? [])}. A difference stops here.`,
        "The preflight pull request now lists both checks as required: keep that for the first gate proof as well.",
      ],
      run: [
        `gh api ${R}/rulesets --jq '.[] | select(.name == "${ruleset.name}") | .id'`,
        `gh api ${R}/rulesets/<id> --jq '{enforcement, conditions, bypass_actors, rules: [.rules[] | {type, parameters}]}'`,
        `gh api ${R}/rules/branches/main`,
        `gh pr checks <n> --required`,
      ],
    },
    {
      title: "Make the three refusal probes",
      say: [
        "For each, a branch from main, pushed, its pull request, both checks waited for, then the attempt to merge, keeping GitHub's answer:",
        "(1) a check broken on purpose outside the gate paths, such as a doc section that names an ID the ontology lacks: refused by ont-check, while ont-gate-guard passes;",
        "(2) a gate path changed with no record of a gate change, such as a comment in a workflow: refused by ont-gate-guard;",
        `(3) a change outside the gate paths with both checks green; before main moves on, read its head and its base, \`${shaLines}\`, and keep them: they are the commit its green checks ran on and the commit of main it was based on, and a lookup after main moved on may give a later base; then main moves on, by the merge of the preflight pull request through the gate after \`node tools/ont-check/merge-gate.mjs records-only --reviewed <main> --head <head> --base <main>\`, which is no proof of a pass; then read the tip of main, \`${mainTip}\`, which is not the base kept; then the attempt is refused for being behind, GitHub's answer naming the branch out of date and not a check.`,
      ],
      run: [`gh api ${R}/pulls -f base=main -f head=<branch> -f title=<title> -f body=<body>`, `gh pr checks <n> --watch`, shaLines, checkRuns, `gh api '${R}/actions/runs?head_sha=<head>' --jq '.workflow_runs[] | [.name, .id, .html_url, .conclusion] | @tsv'`, mainTip, merge],
    },
    {
      title: "Record a gate proof of each probe",
      say: [
        "One file reviews/tasks/<time>-<task>-gate-proof.md for each probe, in English with paths of the repository: Record: gate-proof, Gate, Kind: refusal, Probe: pr <n>, Result: refused, Refused-by, Head, Base, Check, Run, Required, Answer, Time.",
        "Head and Base are those read in step 6 before the attempt, never read again here: after main moved on, the base GitHub gives for the third probe may be later than the one its checks ran on.",
        `The first holds the preflight observation too, on a line of its own: Preflight: pr <n> · <head> · ${checks.map(app).join(" · ")} · required ${names.join(", ")} after the ruleset was created.`,
        "The third, refused for being behind, has Refused-by: the branch up to date with main, Base the base kept before main moved on, and Main-after the tip of main read after it moved, on lines of their own; a Base equal to Main-after was read too late.",
      ],
      run: [checkRuns],
    },
    {
      title: "Close the probes' pull requests and delete their branches",
      say: ["For each probe:"],
      run: [`gh api -X PATCH ${R}/pulls/<n> -f state=closed`, `gh api -X DELETE ${R}/git/refs/heads/<branch>`],
    },
  ];
}
export const SWITCH_ON_END = "The proof of a pass is the merge of the next task's pull request through the gate, after that task starts.";

// The answer of gh api for a path, as JSON or as text, by the command ONT_GH_CMD names, gh by default; a
// command that fails or prints no JSON throws.
export function ghApi(path, { json = true } = {}) {
  const cmd = process.env.ONT_GH_CMD || "gh";
  const r = spawnSync(`${cmd} api '${path.replace(/'/g, "")}'`, { shell: true, encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`gh api ${path} failed: ${(r.stderr || r.error?.message || `exit ${r.status}`).trim().split("\n")[0]}`);
  return json ? JSON.parse(r.stdout) : r.stdout;
}

// The comparison of the rules of main on GitHub with the rule file (inv.rules-match-file, action.compare-rules,
// D-185). fields "token": only what the read-only token of a workflow reads, the ruleset by its name, its
// enforcement, target and conditions, the types of its rules, every parameter of every rule the file names, among them the methods of merge of its rule of pull
// requests, and the checks its rule of status checks requires, by name and app, with its strictness; "all"
// adds the actors that bypass it, which GitHub gives only with the right to write, and the settings of
// Actions, its permissions, the workflows' token and its policies. drift: each difference; unread: each field
// of the token's that was not read, by a failed call or an answer without it; notRead: each field beyond the
// token's that was not read, said and not refused; read: each field compared.
export function compareRules({ rules, repo, fields = "token", api = ghApi }) {
  const out = { drift: [], unread: [], notRead: [], read: [] };
  const want = rules?.ruleset;
  if (!want) return { ...out, unread: ["the rule file holds no ruleset"] };
  const call = (path, what, into) => {
    try {
      return api(path);
    } catch (e) {
      into.push(`${what}: ${e.message}`);
      return undefined;
    }
  };
  // Values compared as JSON with the keys of every object in order, as GitHub gives them in any order.
  const canon = (x) => (Array.isArray(x) ? x.map(canon) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : x);
  const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
  const sorted = (xs) => [...xs].map((x) => (typeof x === "string" ? x : JSON.stringify(canon(x)))).sort();
  // A field compared: unread where the answer lacks it, or gives null where the rule file has a value, never
  // taken for the file's value; a difference where it is not the file's.
  const compare = (name, have, wantValue, into = out.unread) => {
    if (have === undefined || (have === null && wantValue !== null)) return into.push(`${name}: ${have === null ? "null" : "not"} in GitHub's answer`);
    out.read.push(name);
    if (!same(have, wantValue)) out.drift.push(`${name}: ${JSON.stringify(have)} on GitHub, ${JSON.stringify(wantValue)} in the rule file`);
  };
  // A list compared in any order: unread where the answer gives no list where the rule file has one.
  const compareList = (name, have, wantList, into = out.unread, item = (x) => x) => {
    if (!Array.isArray(have)) return into.push(`${name}: ${have === null ? "null" : have === undefined ? "not" : "no list"} in GitHub's answer`);
    compare(name, sorted(have.map(item)), sorted((wantList ?? []).map(item)), into);
  };
  const list = call(`repos/${repo}/rulesets`, "the rulesets of the repository", out.unread);
  if (list !== undefined) {
    if (!Array.isArray(list)) out.unread.push("the rulesets of the repository: the answer is not a list");
    else {
      const found = list.filter((x) => x?.name === want.name);
      if (!found.length) out.drift.push(`no ruleset named ${want.name} on GitHub`);
      else {
        if (found.length > 1) out.drift.push(`${found.length} rulesets named ${want.name} on GitHub`);
        const have = call(`repos/${repo}/rulesets/${found[0].id}`, `the ruleset ${want.name}`, out.unread);
        if (have !== undefined) {
          compare("enforcement", have.enforcement, want.enforcement);
          compare("target", have.target, want.target);
          for (const k of ["include", "exclude"]) if (want.conditions?.ref_name?.[k] !== undefined) compareList(`conditions.ref_name.${k}`, have.conditions?.ref_name?.[k], want.conditions.ref_name[k]);
          const hr = have.rules;
          compareList("rules", Array.isArray(hr) ? hr.map((x) => x?.type) : hr, want.rules.map((x) => x.type));
          // Every parameter of every rule the rule file names, of a rule GitHub has: a list in any order, a
          // required check by its name and app, and any other value as it is (D-185).
          if (Array.isArray(hr))
            for (const w of want.rules) {
              const h = hr.find((x) => x?.type === w.type);
              if (!h) continue;
              for (const [k, v] of Object.entries(w.parameters ?? {})) {
                const name = `${w.type}.${k}`;
                const hv = h.parameters?.[k];
                if (k === "required_status_checks") compareList(name, hv, v, out.unread, (c) => ({ context: c?.context, integration_id: c?.integration_id ?? null }));
                else if (Array.isArray(v)) compareList(name, hv, v);
                else compare(name, hv, v);
              }
            }
          const actor = (x) => ({ actor_id: x?.actor_id ?? null, actor_type: x?.actor_type, bypass_mode: x?.bypass_mode });
          if (fields === "all") compareList("bypass_actors", have.bypass_actors, want.bypass_actors ?? [], out.notRead, actor);
        }
      }
    }
  }
  if (fields === "all" && rules.actions) {
    const a = rules.actions;
    const perms = call(`repos/${repo}/actions/permissions`, "the permissions of Actions", out.notRead);
    if (perms !== undefined) for (const k of Object.keys(a.permissions ?? {})) compare(`actions.permissions.${k}`, perms?.[k], a.permissions[k], out.notRead);
    const wf = call(`repos/${repo}/actions/permissions/workflow`, "the workflows' token", out.notRead);
    if (wf !== undefined) for (const k of Object.keys(a.workflow ?? {})) compare(`actions.workflow.${k}`, wf?.[k], a.workflow[k], out.notRead);
    if ((a.policies ?? []).length) {
      const pl = call(`repos/${repo}/actions/policies`, "the policies of Actions", out.notRead);
      if (pl !== undefined)
        for (const p of a.policies) {
          const f = (pl?.policies ?? []).find((x) => x?.name === p.name);
          if (!f) {
            out.drift.push(`no policy of Actions named ${p.name} on GitHub`);
            continue;
          }
          const hp = call(`repos/${repo}/actions/policies/${f.id}`, `the policy ${p.name}`, out.notRead);
          if (hp === undefined) continue;
          compare(`actions.policies[${p.name}].enforcement`, hp.enforcement, p.enforcement, out.notRead);
          compare(`actions.policies[${p.name}].conditions`, hp.conditions, p.conditions, out.notRead);
          compare(`actions.policies[${p.name}].rules`, hp.rules === undefined ? undefined : hp.rules.map((x) => ({ type: x.type, parameters: x.parameters })), p.rules.map((x) => ({ type: x.type, parameters: x.parameters })), out.notRead);
        }
    }
  }
  return out;
}

// The lines of a comparison: each field read, each one beyond the token's not read, as information, each
// difference and each field of the token's not read as an error with its code, and RULES_OK where none.
export function rulesLines(r, { repo, fields }) {
  const lines = [`RULES ${repo} · fields ${fields}: ${r.read.length} compared with the rule file`];
  for (const x of r.read) lines.push(`  read · ${x}`);
  for (const x of r.notRead) lines.push(`info · not read: ${x}`);
  if (r.drift.length) lines.push(`ERROR · the rules on GitHub differ from the rule file (${r.drift.length}):`, ...r.drift.map((x) => `  ${x}`));
  if (r.unread.length) lines.push(`ERROR · fields of the rules the token reads were not read (${r.unread.length}):`, ...r.unread.map((x) => `  ${x}`));
  if (r.drift.length) lines.push("CODE RULES_DRIFT");
  if (r.unread.length) lines.push("CODE RULES_UNREAD");
  lines.push(r.drift.length || r.unread.length ? "RULES_REFUSED" : "RULES_OK");
  return lines;
}

// The repository on GitHub of the clone, owner/repo, from the address of its remote origin, or null.
export function githubRepo(top) {
  const url = out(git(top, "remote", "get-url", "origin"))?.trim() ?? "";
  const m = url.match(/github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

function main(argv) {
  const [mode] = argv;
  const value = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
  const say = (lines) => console.log(lines.join("\n"));
  let cfg;
  try {
    cfg = loadConfig(value("--config") ?? "ont.config.json");
  } catch (e) {
    say([`ERROR · ${e.message}`]);
    return 1;
  }
  if (mode === "guard") {
    const r = guard({ cfg, base: value("--base"), head: value("--head") });
    if (r.errors) return say(r.errors.map((e) => `ERROR · ${e}`)), 1;
    const lines = [`changed ${r.changed.length} paths, ${r.gated.length} of them gate paths`];
    for (const a of r.approved) lines.push(`  approved · ${a.path} · ${a.by.join(", ")}`);
    for (const n of r.notes) lines.push(`info · ${n}`);
    if (r.refused.length) {
      lines.push(`ERROR · gate paths changed without an approval (${r.refused.length}):`, ...r.refused.map((x) => `  ${x.path}: ${x.why}`));
      lines.push("A change of a gate path needs a record of a gate change in the pull request, for the approved version of its task's statement, naming the path and the commit after which only records follow (D-158).");
    }
    if (r.records.length) lines.push(`ERROR · records of the process the pull request writes by hand, edits or removes (${r.records.length}):`, ...r.records.map((x) => `  ${x.path}: ${x.why}`));
    if (r.outside?.length) lines.push(`ERROR · gate paths outside the gate paths the approval in force allows (${r.outside.length}):`, ...r.outside.map((x) => `  ${x.path}: ${x.why}`));
    if (r.task?.length) lines.push(`ERROR · the merge by the state of the task (${r.task.length}):`, ...r.task.map((x) => `  ${x.code}: ${x.why}`));
    // One code for each rule broken, once, on a line of its own (field.process-record.refusal-code).
    const codes = [...(r.refused.length ? ["GATE_PATH_UNAPPROVED"] : []), ...new Set(r.records.map((x) => x.code)), ...(r.outside?.length ? ["GATE_PATH_OUTSIDE_APPROVAL"] : []), ...new Set((r.task ?? []).map((x) => x.code))];
    if (codes.length) {
      for (const c of GUARD_CODES.filter((c) => codes.includes(c))) lines.push(`CODE ${c}`);
      lines.push("GATE_REFUSED");
      return say(lines), 1;
    }
    lines.push("GATE_OK");
    return say(lines), 0;
  }
  if (mode === "records-only") {
    const top = out(git(cfg.base, "rev-parse", "--show-toplevel"))?.trim();
    const [reviewed, head, base] = [value("--reviewed"), value("--head"), value("--base")];
    const bad = [["reviewed", reviewed], ["head", head], ...(base !== undefined ? [["base", base]] : [])].filter(([, c]) => !top || !isCommit(top, c));
    if (bad.length) return say(bad.map(([k, c]) => `ERROR · the ${k} commit ${c ?? "(none)"} is not a commit of this clone`)), 1;
    let against;
    try {
      against = comparedWith({ cfg, top, reviewed, head });
      if (!against.errors && against.range && !isAncestor(top, reviewed, head)) return say([`ERROR · the reviewed commit ${reviewed} is not in the head ${head}: the head is not past what was reviewed`]), 1;
    } catch (e) {
      if (e instanceof GitError) return say([`ERROR · ${e.message}`]), 1;
      throw e;
    }
    if (against.errors) return say(against.errors.map((e) => `ERROR · ${e}`)), 1;
    const what = against.range ? `the commit of the record of done ${against.range.done.file}, which ends the range of fixes after the narrow round ${against.range.narrow.file} (rule.fixes-held-by-tests)` : "the reviewed commit";
    const r = recordsOnly({ top, reviewed: against.commit, head, base: base ?? null });
    if (r.errors.length) return say([`ERROR · ${r.errors[0].replace("the head is not the reviewed commit", `the head is not ${what}`)}`, ...r.errors.slice(1)]), 1;
    return say([`RECORDS_ONLY: outside ${RECORDS_DIR} the head is ${what}${base ? " merged with the base" : ""}; it is past it by records alone`]), 0;
  }
  if (mode === "ruleset") {
    if (!cfg.mergeGate?.rules) return say([`ERROR · the configuration ${cfg.file} names no mergeGate.rules`]), 1;
    try {
      const rules = JSON.parse(readFileSync(cfg.mergeGate.rules, "utf8"));
      if (!rules.ruleset) throw new Error("it holds no ruleset");
      return console.log(JSON.stringify(rules.ruleset, null, 2)), 0;
    } catch (e) {
      return say([`ERROR · the rule file ${cfg.mergeGate.rules} cannot be read: ${e.message}`]), 1;
    }
  }
  if (mode === "switch-on") {
    if (!cfg.mergeGate?.rules) return say([`ERROR · the configuration ${cfg.file} names no mergeGate.rules`]), 1;
    const file = relative(cfg.base, cfg.mergeGate.rules).split("\\").join("/");
    try {
      const steps = switchOnSteps(JSON.parse(readFileSync(cfg.mergeGate.rules, "utf8")), { repo: value("--repo") ?? "<owner>/<repo>", file });
      const lines = [`Switch the gate on after the merge of the task that brings it: these steps, in this order, from ${file} (rule.gate-switched-on, D-163).`];
      steps.forEach((st, i) => {
        lines.push("", `${i + 1}. ${st.title}.`);
        for (const l of st.say) lines.push(`   ${l}`);
        for (const r of st.run) lines.push(`   $ ${r}`);
      });
      lines.push("", SWITCH_ON_END);
      return say(lines), 0;
    } catch (e) {
      return say([`ERROR · the rule file ${file} gives no steps: ${e.message}`]), 1;
    }
  }
  if (mode === "rules") {
    if (!cfg.mergeGate?.rules) return say([`ERROR · the configuration ${cfg.file} names no mergeGate.rules`]), 1;
    const repo = value("--repo");
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? "")) return say(["ERROR · give the repository with --repo <owner>/<repo>"]), 1;
    const fields = value("--fields") ?? "token";
    if (!["token", "all"].includes(fields)) return say([`ERROR · --fields ${fields} is not token or all`]), 1;
    let rules;
    try {
      rules = JSON.parse(readFileSync(cfg.mergeGate.rules, "utf8"));
    } catch (e) {
      return say([`ERROR · the rule file ${cfg.mergeGate.rules} cannot be read: ${e.message}`]), 1;
    }
    const r = compareRules({ rules, repo, fields });
    say(rulesLines(r, { repo, fields }));
    return r.drift.length || r.unread.length ? 1 : 0;
  }
  say([`ERROR · the mode ${mode ?? "(none)"} is not guard, records-only, ruleset, switch-on or rules`]);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = main(process.argv.slice(2));
