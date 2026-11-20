// Releases (D-109, D-110, D-111). A release of the protocol is an entry of releases.md and an annotated
// tag on its release commit; a project learns of newer ones from its local clone of the approach. A
// release of a product is a record of the commit its checks passed on, with the hash of its pin, and a
// deployment puts a release into an environment.
// ont: ent.protocol-release, field.protocol-release.version, field.protocol-release.verified, field.protocol-release.date, edge.protocol-release.changes, inv.release-tagged, derived.newer-releases, field.tool-copy.approach-clone, ent.product-release, field.product-release.version, field.product-release.commit, field.product-release.checks, field.product-release.tool, field.product-release.date, edge.product-release.pin, inv.product-release-intact, rule.intact-is-not-run, ent.deployment, field.deployment.environment, field.deployment.time, edge.deployment.release, derived.running-now, inv.deployment-of-release
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, join, posix } from "node:path";
import { listFiles, read } from "./lib.mjs";
import { blockLines, realTime } from "./review-rounds.mjs";
import { cleanEnv, gitEnv, runAtCommit, sha256 } from "./tasks.mjs";

// Semantic Versioning 2.0.0, three numbers (https://semver.org/spec/v2.0.0.html).
export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export const compareVersions = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number));
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};
// The tag made before releases were recorded: the starting point, read as 0.1.0, with no entry.
export const START_TAG = "v0.1";
export const START_VERSION = "0.1.0";
export const RELEASES_FILE = "releases.md";

export const git = (repo, ...args) => {
  const r = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8", env: gitEnv(), maxBuffer: 1 << 28 });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
};
const isAncestor = (repo, a, b) => spawnSync("git", ["-C", repo, "merge-base", "--is-ancestor", a, b], { env: gitEnv() }).status === 0;

// The entries of releases.md: "## v0.2.0 · 2026-11-21" and, under it, "- Verified: <commit>".
export function parseReleasesFile(text) {
  const entries = [];
  const malformed = [];
  const parts = text.split(/^(?=## )/m).filter((p) => p.startsWith("## "));
  for (const p of parts) {
    const head = p.split("\n")[0];
    const m = head.match(/^## v(\S+) · (\S+)\s*$/);
    const verified = p.match(/^- Verified: (\S+)\s*$/m)?.[1];
    const wrong = [
      !m && `heading ${head} is not "## v<version> · <date>"`,
      m && !SEMVER.test(m[1]) && `version ${m[1]} is not three numbers of Semantic Versioning`,
      m && !/^\d{4}-\d{2}-\d{2}$/.test(m[2]) && `date ${m[2]} is not a date`,
      !/^[0-9a-f]{40}$/.test(verified ?? "") && `verified commit ${verified ?? "(none)"} is not a full commit`,
    ].filter(Boolean);
    if (wrong.length) malformed.push(`${head}: ${wrong.join("; ")}`);
    else entries.push({ version: m[1], date: m[2], verified });
  }
  return { entries, malformed };
}

export const entryText = ({ version, date, verified }) => `## v${version} · ${date}\n\n- Verified: ${verified}\n`;
export const RELEASES_HEAD =
  "# Releases\n\nOne entry per release of the approach, written by `tools/ont-check/release.mjs`: its version, its date and the commit its tests and check passed on. The release commit adds only its entry and carries the annotated tag `v<version>`. The changes of a release are the entries of the decision log between its verified commit and the one of the release before, or the commit of `v0.1`; they are derived, not written here.\n\n";

// The entries of a decision log, with whether each is accepted and the concepts it names.
export function decisionEntries(text) {
  const out = [];
  const parts = text.split(/^(?=### D-\d+ · )/m).filter((p) => p.startsWith("### D-"));
  for (const p of parts) {
    const [, id, title] = p.match(/^### (D-\d+) · (.+)$/m);
    const concepts = [...(p.match(/^- Concepts:(.*)$/m)?.[1] ?? "").matchAll(/`([a-z]+\.[a-z0-9.-]+)`/g)].map((x) => x[1]);
    out.push({ id, title: title.trim(), accepted: /Status:\s*accepted/i.test(p), concepts });
  }
  return out;
}
const decisionsAt = (repo, commit, rel) => {
  if (!commit) return [];
  const r = git(repo, "show", `${commit}:${rel}`);
  return r.ok ? decisionEntries(r.out) : [];
};
// The entries the log gained from one commit to another (edge.protocol-release.changes).
export function changesBetween(repo, from, to, rel = "decisions.md") {
  const before = new Set(decisionsAt(repo, from, rel).map((e) => e.id));
  return decisionsAt(repo, to, rel).filter((e) => !before.has(e.id));
}

// The tags of releases a clone has, by version: v0.1 as 0.1.0, every other tag v<semver>.
export function releaseTags(repo) {
  const r = git(repo, "tag", "-l", "v*");
  return (r.ok ? r.out.split("\n").filter(Boolean) : []).map((tag) => ({
    tag,
    version: tag === START_TAG ? START_VERSION : SEMVER.test(tag.slice(1)) ? tag.slice(1) : null,
  }));
}

// Where the changes of a release start: the verified commit of the release before it, or v0.1.
export function previousVerified(repo, entries, version) {
  const before = entries.filter((e) => compareVersions(e.version, version) < 0).sort((a, b) => compareVersions(a.version, b.version)).at(-1);
  if (before) return before.verified;
  const start = git(repo, "rev-parse", "--verify", "-q", `refs/tags/${START_TAG}^{commit}`);
  return start.ok ? start.out : null;
}

const sameEntry = (a, b) => a.version === b.version && a.date === b.date && a.verified === b.verified;

// What is wrong with a commit as the release commit of an entry (inv.release-tagged, D-114): its one
// parent is the entry's verified commit, it changes only releases.md, and that file gains exactly this
// entry, every entry before it kept as it was. A commit that only adds the heading, or adds the entry of
// another version, is no release commit.
export function releaseCommitProblems(repo, commit, e, rel = RELEASES_FILE) {
  const parents = git(repo, "rev-list", "--parents", "-n", "1", commit).out.split(" ").slice(1);
  if (parents.length !== 1 || parents[0] !== e.verified)
    return [`the parent of the release commit ${commit.slice(0, 7)} is ${parents.map((p) => p.slice(0, 7)).join(" and ") || "none"}, not the verified commit ${e.verified.slice(0, 7)}`];
  const changed = git(repo, "diff", "--name-only", e.verified, commit).out.split("\n").filter(Boolean);
  if (changed.length !== 1 || changed[0] !== rel) return [`the release commit ${commit.slice(0, 7)} changes ${changed.join(", ") || "nothing"}, not only ${rel}`];
  const at = (c) => {
    const r = git(repo, "show", `${c}:${rel}`);
    return r.ok ? parseReleasesFile(r.out) : { entries: [], malformed: [] };
  };
  const [before, after] = [at(e.verified), at(commit)];
  const same = sameEntry;
  const added = after.entries.filter((x) => !before.entries.some((y) => same(x, y)));
  const lost = before.entries.filter((x) => !after.entries.some((y) => same(x, y)));
  const wrong = [
    after.malformed.length && `the release commit ${commit.slice(0, 7)} has entries that cannot be read: ${after.malformed.join("; ")}`,
    lost.length && `the release commit ${commit.slice(0, 7)} changes or removes the entries of ${lost.map((x) => `v${x.version}`).join(", ")}`,
    !(added.length === 1 && same(added[0], e)) &&
      `the release commit ${commit.slice(0, 7)} adds ${added.map((x) => `the entry of v${x.version} verified on ${x.verified.slice(0, 7)}`).join(", ") || "no entry"}, not exactly the entry of v${e.version} verified on ${e.verified.slice(0, 7)}`,
  ].filter(Boolean);
  return wrong;
}

// Whether a tag is a release (inv.release-tagged, D-122): the one function the check of the approach and
// the news of a project both ask. A tag is a release only when it is v and three numbers, annotated, and
// on the release commit of its entry: the entry given, as the check reads it from releases.md, or else
// the one the tag's commit has. Anything else is an invalid tag, with why.
export function releaseTag(repo, tag, rel = RELEASES_FILE, given = null) {
  const version = tag !== START_TAG && tag.startsWith("v") && SEMVER.test(tag.slice(1)) ? tag.slice(1) : null;
  if (!version) return { tag, version: null, entry: null, problems: [`tag ${tag} is not v and three numbers of Semantic Versioning`] };
  const ref = `refs/tags/${tag}`;
  const problems = [];
  if (git(repo, "cat-file", "-t", ref).out !== "tag") problems.push("the tag is not annotated");
  const commit = git(repo, "rev-parse", "-q", "--verify", `${ref}^{commit}`).out;
  const text = git(repo, "show", `${ref}:${rel}`);
  const entry = given ?? (text.ok ? parseReleasesFile(text.out).entries.find((x) => x.version === version) : null);
  if (!entry) problems.push(`its commit has no entry of ${version} in ${rel}`);
  else problems.push(...releaseCommitProblems(repo, commit, entry, rel));
  return { tag, version, commit, entry: problems.length ? null : entry, problems };
}

// What is wrong with the releases of the protocol in a repository (inv.release-tagged).
export function protocolReleaseProblems(repo, rel = RELEASES_FILE) {
  const path = join(repo, rel);
  const { entries, malformed } = existsSync(path) ? parseReleasesFile(read(path)) : { entries: [], malformed: [] };
  const problems = [...malformed];
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(e.version)) problems.push(`v${e.version}: two entries`);
    seen.add(e.version);
    if (!git(repo, "rev-parse", "--verify", "-q", `refs/tags/v${e.version}`).ok) {
      problems.push(`v${e.version}: the release commit has no tag; release.mjs --resume tags it after running the checks again`);
      continue;
    }
    problems.push(...releaseTag(repo, `v${e.version}`, rel, e).problems.map((p) => `v${e.version}: ${p}`));
  }
  for (const t of releaseTags(repo))
    if (t.tag !== START_TAG && !entries.some((e) => `v${e.version}` === t.tag)) problems.push(`tag ${t.tag} has no entry in ${rel}`);
  return { entries, problems };
}

// For a project: the releases its approach clone knows that are newer than its pin (derived.newer-releases).
// Each entry is read from its tag, not from the clone's work tree, which may be on an older commit.
export function releaseNews({ clone, pinCommit, used = new Set(), decisionsRel = "decisions.md", releasesRel = RELEASES_FILE }) {
  if (!clone || !existsSync(clone) || !git(clone, "rev-parse", "--git-dir").ok)
    return ["no information about releases: ont.approachClone is not set or cannot be read (git config --local ont.approachClone <path>)"];
  if (!pinCommit || !git(clone, "cat-file", "-e", `${pinCommit}^{commit}`).ok)
    return [`the comparison is not possible: the commit of the pin ${pinCommit ? pinCommit.slice(0, 12) : "(none)"} is not in the approach clone`];
  const entries = [];
  // A tag whose commit is no release commit of its own entry is said, never skipped (D-114): the clone's
  // releases are then not known in full.
  const unread = [];
  for (const t of releaseTags(clone)) {
    if (t.tag === START_TAG) continue;
    const r = releaseTag(clone, t.tag, releasesRel);
    if (r.problems.length) unread.push(t.version ? `tag ${t.tag}: ${r.problems.join("; ")}` : r.problems.join("; "));
    else entries.push(r.entry);
  }
  const incomplete = unread.map((u) => `the releases of the approach clone are not known in full: ${u}; it is not counted`);
  const newer = entries.filter((e) => !isAncestor(clone, e.verified, pinCommit)).sort((a, b) => compareVersions(a.version, b.version));
  if (!newer.length)
    return [
      ...incomplete,
      incomplete.length
        ? "no newer version among the releases of the approach clone that can be read"
        : "no newer version among the releases the approach clone knows (to learn of new ones: git fetch --tags in the clone)",
    ];
  return [...incomplete, ...newer.map((e) => {
    const changes = changesBetween(clone, previousVerified(clone, entries, e.version), e.verified, decisionsRel);
    const rules = changes.filter((c) => c.accepted && c.concepts.some((x) => used.has(x)));
    return (
      `version ${e.version} was released (${e.date}); changes: ${changes.map((c) => c.id).join(", ") || "none"}` +
      `; of them, change this project's rules: ${rules.map((c) => `${c.id} (${c.concepts.filter((x) => used.has(x)).join(", ")})`).join(", ") || "none"}`
    );
  })];
}

// The checks a release of a product runs: the project's check and each test suite of the configuration
// at its commit.
export function requiredChecks(configText) {
  const raw = JSON.parse(configText);
  const suites = [...(raw.tests ? [{ name: "" }] : []), ...(raw.testSuites ?? [])];
  return ["ont-check", ...suites.map((s) => `suite ${s.name || "tests"}`)];
}

// The results a check of a release can have (D-116): a test suite whose every test passed is pass; one
// with tests skipped and none failed is skipped, with how many; one that ran no test is not run; any
// failure is fail. A release is written, and is intact, only with pass and skipped.
export const RESULTS = ["pass", "skipped", "not-run", "fail"];
export const RELEASABLE = new Set(["pass", "skipped"]);
// The result of a run of node --test with the TAP reporter, from its summary lines. The runner reports a
// file that defines no test as a test of its own, named by the file's path, which passed: those are not
// tests that ran.
export function suiteResult(run, files = []) {
  const out = `${run.stdout ?? ""}`;
  const count = (k) => Number(out.match(new RegExp(`^# ${k} (\\d+)$`, "m"))?.[1] ?? NaN);
  const [all, passed, skipped, todo] = ["tests", "pass", "skipped", "todo"].map(count);
  const names = new Set(files);
  const empty = out.split("\n").filter((l) => names.has(l.match(/^ok \d+ - (.*)$/)?.[1])).length;
  const [tests, pass] = [all - empty, passed - empty];
  if (run.status !== 0) return { result: "fail", detail: null };
  if (Number.isNaN(all)) return { result: "fail", detail: "no summary of the test runner" };
  if (tests === 0) return { result: "not-run", detail: "no test ran" };
  const left = skipped + todo;
  if (left > 0) return { result: "skipped", detail: `${left} of ${tests} tests skipped` };
  return pass === tests ? { result: "pass", detail: null } : { result: "fail", detail: `${pass} of ${tests} tests passed` };
}

// How many tests of a suite were skipped, as a record says it (D-116, D-125).
export const SKIPPED = /^\d+ of \d+ tests skipped$/;

// Whether a run of the checks of a release gives what its record says (action.verify-release, D-125):
// the same checks in the same order, each with the same result, and a skipped one with the same counts;
// a check the record says was skipped may pass, where the run had what the release lacked.
export function runMatchesRecord(checks, results) {
  return (
    results.length === checks.length &&
    results.every((x, i) => {
      const c = checks[i];
      if (x.command !== c.check) return false;
      if (c.result === "skipped") return x.result === "pass" || (x.result === "skipped" && x.detail === c.detail);
      return x.result === c.result;
    })
  );
}

// Records of releases and of deployments in the directory of releases.
export function parseProductRecords(dir) {
  const releases = [];
  const deployments = [];
  const malformed = [];
  for (const f of listFiles(dir, /\.md$/)) {
    const text = read(f);
    const name = basename(f);
    const field = (k) => text.match(new RegExp(`^${k}:[ \\t]*(.*?)\\s*$`, "m"))?.[1] ?? null;
    if (field("Version") !== null) {
      const checks = (blockLines(text, "Checks") ?? []).map((l) => {
        const [check, result, detail] = l.replace(/^-\s*/, "").split(" · ").map((x) => x.trim());
        return { check, result, detail: detail ?? null };
      });
      const r = { file: name, version: field("Version"), commit: field("Commit"), pin: field("Pin"), tool: field("Tool"), date: field("Date"), checks };
      const wrong = [
        !SEMVER.test(r.version) && `version ${r.version} is not three numbers of Semantic Versioning`,
        !/^[0-9a-f]{40}$/.test(r.commit ?? "") && `commit ${r.commit ?? "(none)"} is not a full commit`,
        !/^[0-9a-f]{64}$/.test(r.pin ?? "") && `pin ${r.pin ?? "(none)"} is not a SHA-256`,
        !r.tool && "no tool",
        !/^\d{4}-\d{2}-\d{2}$/.test(r.date ?? "") && `date ${r.date ?? "(none)"} is not a date`,
        !checks.length && "no checks",
        ...checks.filter((c) => !RESULTS.includes(c.result)).map((c) => `check ${c.check ?? ""} has the result ${c.result ?? "(none)"}, not one of ${RESULTS.join(", ")}`),
      ].filter(Boolean);
      if (wrong.length) malformed.push(`${name}: ${wrong.join("; ")}`);
      else releases.push(r);
    } else if (field("Release") !== null) {
      const d = { file: name, release: field("Release"), environment: field("Environment"), time: field("Time") };
      const wrong = [!d.environment && "no environment", !realTime(d.time) && `time ${d.time ?? "(none)"} is not a UTC time to the second`].filter(Boolean);
      if (wrong.length) malformed.push(`${name}: ${wrong.join("; ")}`);
      else deployments.push(d);
    } else malformed.push(`${name}: neither a release (Version:) nor a deployment (Release:)`);
  }
  return { releases, deployments, malformed };
}

export const inHistory = (top, commit) => git(top, "cat-file", "-e", `${commit}^{commit}`).ok && isAncestor(top, commit, "HEAD");

// The pin of a release, by the configuration at its commit (edge.product-release.pin, D-125): the file
// its releases.pin names, from the repository's top; a later move of the pin leaves an old release as it
// was.
export function pinAt(top, cfgRel, commit) {
  const config = git(top, "show", `${commit}:${cfgRel}`);
  if (!config.ok) return { error: `no configuration ${cfgRel} at commit ${commit.slice(0, 7)}` };
  let raw;
  try {
    raw = JSON.parse(config.out);
  } catch {
    return { error: `the configuration ${cfgRel} at commit ${commit.slice(0, 7)} is not JSON` };
  }
  if (!raw.releases?.pin) return { error: `the configuration ${cfgRel} at commit ${commit.slice(0, 7)} names no releases.pin` };
  const rel = posix.normalize(posix.join(posix.dirname(cfgRel), raw.releases.pin));
  if (rel.startsWith("..")) return { error: `the pin ${raw.releases.pin} of the configuration at commit ${commit.slice(0, 7)} is outside the repository` };
  const file = spawnSync("git", ["-C", top, "show", `${commit}:${rel}`], { env: gitEnv(), maxBuffer: 1 << 28 });
  if (file.status !== 0) return { rel, error: `the pin ${rel} is not at commit ${commit.slice(0, 7)}` };
  return { rel, bytes: file.stdout, hash: sha256(file.stdout), config: config.out };
}

// What is wrong with one record of a release (inv.product-release-intact, D-125): the one validation the
// check and release.mjs share, which refuses before writing any record the check would refuse.
export function releaseRecordProblems({ top, cfgRel, r }) {
  if (!inHistory(top, r.commit)) return [`${r.file}: commit ${r.commit.slice(0, 7)} is not in the project's history`];
  const out = [];
  const pin = pinAt(top, cfgRel, r.commit);
  if (pin.error) out.push(`${r.file}: ${pin.error}`);
  else if (pin.hash !== r.pin) out.push(`${r.file}: the pin's hash is not the hash of ${pin.rel} at commit ${r.commit.slice(0, 7)}`);
  const config = git(top, "show", `${r.commit}:${cfgRel}`);
  let required = null;
  try {
    required = config.ok ? requiredChecks(config.out) : null;
  } catch {}
  const given = r.checks.map((c) => c.check);
  if (!required) out.push(`${r.file}: no configuration ${cfgRel} at commit ${r.commit.slice(0, 7)} that can be read`);
  else if (required.join("|") !== given.join("|")) out.push(`${r.file}: the checks ${given.join(", ")} are not the ones the configuration at ${r.commit.slice(0, 7)} requires, ${required.join(", ")}`);
  const failed = r.checks.filter((c) => !RELEASABLE.has(c.result));
  if (failed.length) out.push(`${r.file}: checks not passed: ${failed.map((c) => `${c.check} · ${c.result ?? "(none)"}`).join(", ")}`);
  const uncounted = r.checks.filter((c) => c.result === "skipped" && !SKIPPED.test(c.detail ?? ""));
  if (uncounted.length) out.push(`${r.file}: skipped with no count: ${uncounted.map((c) => c.check).join(", ")}`);
  return out;
}

// What is wrong with the records of releases and deployments (inv.product-release-intact,
// inv.deployment-of-release). Integrity only: it does not prove the checks were run (rule.intact-is-not-run).
export function productReleaseProblems({ top, cfgRel, releases, deployments }) {
  const out = [];
  const versions = new Map();
  for (const r of releases) {
    if (versions.has(r.version)) out.push(`${r.file}: version ${r.version} is also ${versions.get(r.version)}`);
    versions.set(r.version, r.file);
    out.push(...releaseRecordProblems({ top, cfgRel, r }));
  }
  for (const d of deployments) if (!versions.has(d.release)) out.push(`${d.file}: a deployment of ${d.release}, which has no record of a release`);
  return out;
}

// For each environment, the release of its latest deployment by time (derived.running-now).
export function runningNow(deployments) {
  const now = new Map();
  for (const d of [...deployments].sort((a, b) => a.time.localeCompare(b.time))) now.set(d.environment, d);
  return now;
}

// Runs the checks of a release on the commit in a temporary worktree: the check of the configuration at
// the commit and each of its test suites, with the tool of that commit at toolRel (D-111).
export function runReleaseChecks({ top, commit, cfgRel, toolRel }) {
  const config = git(top, "show", `${commit}:${cfgRel}`);
  if (!config.ok) return { error: `no configuration ${cfgRel} at commit ${commit.slice(0, 7)}` };
  const raw = JSON.parse(config.out);
  const cfgDir = cfgRel.includes("/") ? cfgRel.slice(0, cfgRel.lastIndexOf("/")) : "";
  const node = (args, cwd) => spawnSync(process.execPath, args, { cwd, env: cleanEnv(), encoding: "utf8", maxBuffer: 1 << 28 });
  const check = Object.assign((wt) => node([join(wt, toolRel, "ont-check.mjs"), "--config", join(wt, cfgRel)], wt), { label: "ont-check" });
  const suites = [...(raw.tests ? [{ name: "", ...raw.tests }] : []), ...(raw.testSuites ?? [])].map((s) =>
    Object.assign(
      (wt) => {
        const files = listFiles(join(wt, cfgDir, s.dir), new RegExp(s.match ?? "\\.test\\.[a-z]+$"));
        if (!files.length) return { status: 0, stdout: "", stderr: `no test files in ${s.dir}`, result: "not-run", detail: "no test files" };
        const run = node(["--test", "--test-reporter=tap", ...files], join(wt, cfgDir));
        return { ...run, ...suiteResult(run, files) };
      },
      { label: `suite ${s.name || "tests"}` },
    ),
  );
  return runAtCommit({ top, commit, commands: [check, ...suites] });
}

export const releaseRecordText = ({ version, commit, pin, tool, date, results }) =>
  [`Version: ${version}`, `Commit: ${commit}`, `Pin: ${pin}`, `Tool: ${tool}`, `Date: ${date}`, "Checks:", ...results.map((r) => `- ${r.command} · ${r.result}${r.detail ? ` · ${r.detail}` : ""}`), ""].join("\n");
