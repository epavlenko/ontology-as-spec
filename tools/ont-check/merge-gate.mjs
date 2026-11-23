#!/usr/bin/env node
// The merge gate on the server (D-158): the guard that main's workflow ont-gate-guard runs on a pull
// request, the confirmation before a merge that the head is past the reviewed commit by records alone,
// and the ruleset of main to send to GitHub.
//   node tools/ont-check/merge-gate.mjs guard --base <commit> --head <commit> [--config ont.config.json]
//   node tools/ont-check/merge-gate.mjs records-only --reviewed <commit> --head <commit> [--base <commit>] [--config ont.config.json]
//   node tools/ont-check/merge-gate.mjs ruleset [--config ont.config.json]
//   node tools/ont-check/merge-gate.mjs switch-on [--repo <owner>/<repo>] [--config ont.config.json]
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
// ont: ent.merge-gate, field.merge-gate.guard, field.merge-gate.gate-paths, field.merge-gate.rule-file, edge.merge-gate.changes
// ont: rule.ci-from-main, inv.gate-change-approved, rule.merge-what-was-checked, rule.main-through-gate, rule.gate-switched-on, rule.fixes-held-by-tests
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gitEnv, loadConfig } from "./lib.mjs";
import { parseRounds } from "./review-rounds.mjs";
import { approvedHash, fixesRange, parseTaskRecords } from "./tasks.mjs";

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

// The records of rounds and of tasks at a commit, read from Git's objects into tmp as data, never from the
// working tree; a Git command that fails throws GitError.
function recordsAt({ cfg, top, head, tmp }) {
  const rel = (d) => relative(top, d).split("\\").join("/");
  const roundsDir = cfg.reviewRounds ? filesAt(top, head, rel(cfg.reviewRounds.dir), tmp) : null;
  const tasksDir = cfg.taskRecords ? filesAt(top, head, rel(cfg.taskRecords.dir), tmp) : null;
  const rounds = roundsDir && existsSync(roundsDir) ? parseRounds(roundsDir, { latinOnly: cfg.records.latinOnly, root: null, hashFrom: cfg.reviewRounds.gatesFrom ?? "" }).rounds : [];
  const records = tasksDir && existsSync(tasksDir) ? parseTaskRecords(tasksDir, { latinOnly: cfg.records.latinOnly }) : { gateChanges: [], approvals: [], done: [], malformed: [] };
  return { rounds, records, recordsPath: cfg.taskRecords ? rel(cfg.taskRecords.dir) : null };
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
    const at = recordsAt({ cfg, top, head: h, tmp });
    if (at.errors) return { errors: at.errors };
    const { rounds, records, recordsPath } = at;
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
  say([`ERROR · the mode ${mode ?? "(none)"} is not guard, records-only, ruleset or switch-on`]);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = main(process.argv.slice(2));
