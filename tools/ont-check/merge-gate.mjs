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
// the head, name the path and the commit after which the pull request changes nothing outside reviews/.
// records-only passes when --reviewed is in --head and every commit after it, and not in --base, changes
// files under reviews/ alone; a merge, by what it changes against all of its parents.
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
import { approvedHash, parseTaskRecords } from "./tasks.mjs";

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

// The files a commit changes on its own: against its parent, or, for a merge, the files that differ from
// every parent, so that a clean merge of main into the branch changes nothing of its own.
export function ownChanges(top, commit) {
  const parents = out(git(top, "rev-list", "--parents", "-n", "1", commit))?.trim().split(" ").slice(1) ?? [];
  const args = parents.length > 1 ? ["diff-tree", "-r", "-c", "--no-commit-id", "--name-only", "-z", commit] : ["diff-tree", "-r", "--root", "--no-renames", "--no-commit-id", "--name-only", "-z", commit];
  return lines0(out(git(top, ...args)));
}

// The commits after `from` in `head`, and not in `base`, that change a file outside the records, each
// with those files.
export function outsideRecords(top, { from, head, base = null }) {
  const commits = (out(git(top, "rev-list", head, `^${from}`, ...(base ? [`^${base}`] : []))) ?? "").split("\n").filter(Boolean);
  return commits.map((c) => ({ commit: c, files: ownChanges(top, c).filter((f) => !f.startsWith(RECORDS_DIR)) })).filter((c) => c.files.length);
}

// Copies the files under a directory of the repository at a commit into a temporary directory, from Git's
// objects, so that they are read as data and never written into the working tree.
function filesAt(top, commit, dir, into) {
  const listed = lines0(out(git(top, "ls-tree", "-r", "-z", "--full-tree", "--name-only", commit, "--", dir)));
  for (const path of listed) {
    const blob = spawnSync("git", ["-C", top, "cat-file", "blob", `${commit}:${path}`], { env: gitEnv(), maxBuffer: 1 << 28 });
    if (blob.status !== 0) continue;
    const to = join(into, path);
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, blob.stdout);
  }
  return join(into, dir);
}

// The guard: what the pull request from base to head changes among the gate paths, and which of those
// changes no record of a gate change approves, with the reason.
export function guard({ cfg, base, head }) {
  const top = out(git(cfg.base, "rev-parse", "--show-toplevel"))?.trim();
  if (!top) return { errors: ["not in a Git repository"] };
  if (!cfg.mergeGate) return { errors: [`the configuration ${cfg.file} names no mergeGate`] };
  const missing = [["base", base], ["head", head]].filter(([, c]) => !isCommit(top, c));
  if (missing.length) return { errors: missing.map(([k, c]) => `the ${k} ${c ?? "(none)"} is not a commit of this clone`) };
  const [b, h] = [full(top, base), full(top, head)];
  const mb = out(git(top, "merge-base", b, h))?.trim();
  if (!mb) return { errors: [`the base ${b} and the head ${h} have no common commit`] };
  const changed = lines0(out(git(top, "diff", "--no-renames", "--no-ext-diff", "--no-textconv", "--name-only", "-z", mb, h)));
  const gated = changed.filter((p) => isGatePath(p, cfg.mergeGate.paths));
  if (!gated.length) return { changed, gated, approved: [], refused: [], notes: [] };
  // The records at the head, read from Git's objects as data.
  const tmp = mkdtempSync(join(tmpdir(), "ont-gate-"));
  try {
    const rel = (d) => relative(top, d).split("\\").join("/");
    const roundsDir = cfg.reviewRounds ? filesAt(top, h, rel(cfg.reviewRounds.dir), tmp) : null;
    const tasksDir = cfg.taskRecords ? filesAt(top, h, rel(cfg.taskRecords.dir), tmp) : null;
    const rounds = roundsDir && existsSync(roundsDir) ? parseRounds(roundsDir, { latinOnly: cfg.records.latinOnly, root: null, hashFrom: cfg.reviewRounds.gatesFrom ?? "" }).rounds : [];
    const records = tasksDir && existsSync(tasksDir) ? parseTaskRecords(tasksDir, { latinOnly: cfg.records.latinOnly }) : { gateChanges: [], approvals: [], malformed: [] };
    const recordsPath = cfg.taskRecords ? rel(cfg.taskRecords.dir) : null;
    const notes = [];
    const valid = [];
    for (const g of records.gateChanges) {
      const why = [];
      // Only a record the pull request adds speaks for it; one already on main approved an earlier change.
      if (!changed.includes(`${recordsPath}/${g.file}`)) continue;
      const approved = approvedHash(rounds, g.task, null, records.approvals);
      if (approved !== g.statementHash) why.push(`version ${g.statementHash.slice(0, 12)} of the statement of ${g.task} is not approved in force${approved ? ` (${approved.slice(0, 12)} is)` : ""}`);
      if (!isCommit(top, g.commit) || git(top, "merge-base", "--is-ancestor", g.commit, h).status !== 0) why.push(`commit ${g.commit.slice(0, 12)} is not in the head`);
      else if (git(top, "merge-base", "--is-ancestor", g.commit, b).status === 0) why.push(`commit ${g.commit.slice(0, 12)} is already in the base, not a commit of the pull request`);
      else {
        const after = outsideRecords(top, { from: g.commit, head: h, base: b });
        if (after.length) why.push(`after commit ${g.commit.slice(0, 12)} the pull request changes files outside ${RECORDS_DIR}: ${after.map((c) => `${c.commit.slice(0, 12)} (${c.files.join(", ")})`).join("; ")}`);
      }
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
    if (git(top, "merge-base", "--is-ancestor", reviewed, head).status !== 0) return say([`ERROR · the reviewed commit ${reviewed} is not in the head ${head}: the head is not past what was reviewed`]), 1;
    const after = outsideRecords(top, { from: reviewed, head, base: base ?? null });
    if (after.length) return say([`ERROR · the head is past the reviewed commit by commits outside ${RECORDS_DIR} (${after.length}):`, ...after.map((c) => `  ${c.commit}: ${c.files.join(", ")}`)]), 1;
    return say([`RECORDS_ONLY: the head is past the reviewed commit by records under ${RECORDS_DIR} alone`]), 0;
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
