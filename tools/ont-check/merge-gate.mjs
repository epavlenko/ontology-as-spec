#!/usr/bin/env node
// The merge gate on the server (D-158): the guard that main's workflow ont-gate-guard runs on a pull
// request, the confirmation before a merge that the head is past the reviewed commit by records alone,
// and the ruleset of main to send to GitHub.
//   node tools/ont-check/merge-gate.mjs guard --base <commit> --head <commit> [--config ont.config.json]
//   node tools/ont-check/merge-gate.mjs records-only --reviewed <commit> --head <commit> [--base <commit>] [--config ont.config.json]
//   node tools/ont-check/merge-gate.mjs ruleset [--config ont.config.json]
// guard reads the pull request only as data: the paths of the diff from the merge base of --base and
// --head to --head, and the records of rounds and tasks at --head, read from Git's objects into a
// temporary directory outside the working tree. It runs nothing of the pull request and changes neither
// the working tree nor the index. A change of a gate path (mergeGate.paths) passes only when records of a
// gate change added by the pull request, for the version of their task's statement approved in force at
// the head, name the path and are bound to the commit they name: their paths change up to it, the record
// is added by its child, and outside reviews/ the head is that commit merged with main.
// records-only passes when --reviewed is in --head, --head contains --base, and outside reviews/ the tree
// of --head is the tree of --reviewed merged with --base as Git merges them (D-158).
// Both fail closed: a Git command that fails is an error, never a diff or a history without changes.
// ruleset prints the ruleset of the rule file (mergeGate.rules) as the GitHub API takes it.
// ont: ent.merge-gate, field.merge-gate.guard, field.merge-gate.gate-paths, field.merge-gate.rule-file, edge.merge-gate.changes
// ont: rule.ci-from-main, inv.gate-change-approved, rule.merge-what-was-checked, rule.main-through-gate
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gitEnv, loadConfig } from "./lib.mjs";
import { parseRounds } from "./review-rounds.mjs";
import { approvedHash, parseTaskRecords, recordsBefore } from "./tasks.mjs";

// The directory of the records of the process: commits that change only files under it change no gate.
export const RECORDS_DIR = "reviews/";

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
// in the base, each path the record lists changes between the main it was based on and it, the record is
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
  if (holds(top, commit, file) || !(children.get(commit) ?? []).some((c) => holds(top, c, file))) why.push(`the record is not added by the commit right after commit ${short}, whose one parent it is`);
  const after = pastByRecords(top, { commit, head: h, base: mb });
  if (after.conflicts.length) why.push(`commit ${short} and main conflict outside ${RECORDS_DIR}: ${after.conflicts.join(", ")}`);
  if (after.differ.length) why.push(`outside ${RECORDS_DIR} the head is not commit ${short} merged with main: ${after.differ.join(", ")}`);
  return why;
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
    if (!gated.length) return { changed, gated, approved: [], refused: [], notes: [] };
    // The records at the head, read from Git's objects as data.
    const rel = (d) => relative(top, d).split("\\").join("/");
    const roundsDir = cfg.reviewRounds ? filesAt(top, h, rel(cfg.reviewRounds.dir), tmp) : null;
    const tasksDir = cfg.taskRecords ? filesAt(top, h, rel(cfg.taskRecords.dir), tmp) : null;
    const rounds = roundsDir && existsSync(roundsDir) ? parseRounds(roundsDir, { latinOnly: cfg.records.latinOnly, root: null, hashFrom: cfg.reviewRounds.gatesFrom ?? "" }).rounds : [];
    const before = cfg.taskRecords ? recordsBefore(cfg, top) : { names: null, errors: [] };
    if (before.errors.length) return { errors: before.errors };
    const records = tasksDir && existsSync(tasksDir) ? parseTaskRecords(tasksDir, { latinOnly: cfg.records.latinOnly, before: before.names }) : { gateChanges: [], approvals: [], malformed: [] };
    const recordsPath = cfg.taskRecords ? rel(cfg.taskRecords.dir) : null;
    // The commits of the pull request by their parents, so that the commit right after a named one is found.
    const children = new Map();
    for (const line of must(top, "rev-list", "--parents", h, `^${b}`).split("\n").filter(Boolean)) {
      const [c, ...parents] = line.split(" ");
      if (parents.length === 1) children.set(parents[0], [...(children.get(parents[0]) ?? []), c]);
    }
    const notes = [];
    const valid = [];
    for (const g of records.gateChanges) {
      const file = `${recordsPath}/${g.file}`;
      // Only a record the pull request adds speaks for it; one already on main approved an earlier change.
      if (!changed.includes(file)) continue;
      const why = [];
      const approved = approvedHash(rounds, g.task, null, records.approvals);
      if (approved !== g.statementHash) why.push(`version ${g.statementHash.slice(0, 12)} of the statement of ${g.task} is not approved in force${approved ? ` (${approved.slice(0, 12)} is)` : ""}`);
      why.push(...unbound(top, { g, file, b, h, mb, children }));
      if (why.length) notes.push(`${g.file}: approves nothing: ${why.join("; ")}`);
      else valid.push(g);
    }
    const malformed = records.malformed.filter((m) => /gate-change/.test(m));
    notes.push(...malformed.map((m) => `${m} (cannot be read)`));
    const approved = [];
    const refused = [];
    for (const p of gated) {
      const by = valid.filter((g) => g.paths.includes(p));
      if (by.length) approved.push({ path: p, by: by.map((g) => g.file) });
      else refused.push({ path: p, why: valid.length ? "no record of a gate change of the pull request names it" : "no record of a gate change of the pull request approves it" });
    }
    return { changed, gated, approved, refused, notes };
  } catch (e) {
    if (e instanceof GitError) return { errors: [e.message] };
    throw e;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
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
    const r = recordsOnly({ top, reviewed, head, base: base ?? null });
    if (r.errors.length) return say([`ERROR · ${r.errors[0]}`, ...r.errors.slice(1)]), 1;
    return say([`RECORDS_ONLY: outside ${RECORDS_DIR} the head is the reviewed commit${base ? " merged with the base" : ""}; it is past it by records alone`]), 0;
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
  say([`ERROR · the mode ${mode ?? "(none)"} is not guard, records-only or ruleset`]);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = main(process.argv.slice(2));
