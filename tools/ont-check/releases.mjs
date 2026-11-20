// Releases (D-109, D-110, D-111). A release of the protocol is an entry of releases.md and an annotated
// tag on its release commit; a project learns of newer ones from its local clone of the approach. A
// release of a product is a record of the commit its checks passed on, with the hash of its pin, and a
// deployment puts a release into an environment.
// ont: ent.protocol-release, field.protocol-release.version, field.protocol-release.verified, field.protocol-release.date, edge.protocol-release.changes, inv.release-tagged, derived.newer-releases, field.tool-copy.approach-clone, ent.product-release, field.product-release.version, field.product-release.commit, field.product-release.checks, field.product-release.tool, field.product-release.date, edge.product-release.pin, inv.product-release-intact, rule.intact-is-not-run, ent.deployment, field.deployment.environment, field.deployment.time, edge.deployment.release, derived.running-now, inv.deployment-of-release
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
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

// What is wrong with the releases of the protocol in a repository (inv.release-tagged).
export function protocolReleaseProblems(repo, rel = RELEASES_FILE) {
  const path = join(repo, rel);
  const { entries, malformed } = existsSync(path) ? parseReleasesFile(read(path)) : { entries: [], malformed: [] };
  const problems = [...malformed];
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(e.version)) problems.push(`v${e.version}: two entries`);
    seen.add(e.version);
    const tag = `refs/tags/v${e.version}`;
    if (!git(repo, "rev-parse", "--verify", "-q", tag).ok) {
      problems.push(`v${e.version}: the release commit has no tag; release.mjs --resume tags it after running the checks again`);
      continue;
    }
    if (git(repo, "cat-file", "-t", tag).out !== "tag") problems.push(`v${e.version}: the tag is not annotated`);
    const commit = git(repo, "rev-parse", `${tag}^{commit}`).out;
    const parent = git(repo, "rev-parse", "-q", "--verify", `${commit}^`).out;
    if (parent !== e.verified) problems.push(`v${e.version}: the parent of the tagged commit is ${parent.slice(0, 7) || "none"}, not the verified commit ${e.verified.slice(0, 7)}`);
    else {
      const changed = git(repo, "diff", "--name-only", e.verified, commit).out.split("\n").filter(Boolean);
      if (changed.length !== 1 || changed[0] !== rel) problems.push(`v${e.version}: the release commit changes ${changed.join(", ") || "nothing"}, not only ${rel}`);
    }
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
  for (const t of releaseTags(clone)) {
    if (t.tag === START_TAG || !t.version) continue;
    const text = git(clone, "show", `refs/tags/${t.tag}:${releasesRel}`);
    const e = text.ok ? parseReleasesFile(text.out).entries.find((x) => x.version === t.version) : null;
    if (e) entries.push(e);
  }
  const newer = entries.filter((e) => !isAncestor(clone, e.verified, pinCommit)).sort((a, b) => compareVersions(a.version, b.version));
  if (!newer.length) return ["no newer version among the releases the approach clone knows (to learn of new ones: git fetch --tags in the clone)"];
  return newer.map((e) => {
    const changes = changesBetween(clone, previousVerified(clone, entries, e.version), e.verified, decisionsRel);
    const rules = changes.filter((c) => c.accepted && c.concepts.some((x) => used.has(x)));
    return (
      `version ${e.version} was released (${e.date}); changes: ${changes.map((c) => c.id).join(", ") || "none"}` +
      `; of them, change this project's rules: ${rules.map((c) => `${c.id} (${c.concepts.filter((x) => used.has(x)).join(", ")})`).join(", ") || "none"}`
    );
  });
}

// The checks a release of a product runs: the project's check and each test suite of the configuration
// at its commit.
export function requiredChecks(configText) {
  const raw = JSON.parse(configText);
  const suites = [...(raw.tests ? [{ name: "" }] : []), ...(raw.testSuites ?? [])];
  return ["ont-check", ...suites.map((s) => `suite ${s.name || "tests"}`)];
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
        const [check, result] = l.replace(/^-\s*/, "").split(" · ").map((x) => x.trim());
        return { check, result };
      });
      const r = { file: name, version: field("Version"), commit: field("Commit"), pin: field("Pin"), tool: field("Tool"), date: field("Date"), checks };
      const wrong = [
        !SEMVER.test(r.version) && `version ${r.version} is not three numbers of Semantic Versioning`,
        !/^[0-9a-f]{40}$/.test(r.commit ?? "") && `commit ${r.commit ?? "(none)"} is not a full commit`,
        !/^[0-9a-f]{64}$/.test(r.pin ?? "") && `pin ${r.pin ?? "(none)"} is not a SHA-256`,
        !r.tool && "no tool",
        !/^\d{4}-\d{2}-\d{2}$/.test(r.date ?? "") && `date ${r.date ?? "(none)"} is not a date`,
        !checks.length && "no checks",
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

// What is wrong with the records of releases and deployments (inv.product-release-intact,
// inv.deployment-of-release). Integrity only: it does not prove the checks were run (rule.intact-is-not-run).
export function productReleaseProblems({ top, cfgRel, pinRel, releases, deployments }) {
  const out = [];
  const versions = new Map();
  for (const r of releases) {
    if (versions.has(r.version)) out.push(`${r.file}: version ${r.version} is also ${versions.get(r.version)}`);
    versions.set(r.version, r.file);
    if (!git(top, "cat-file", "-e", `${r.commit}^{commit}`).ok || !isAncestor(top, r.commit, "HEAD")) {
      out.push(`${r.file}: commit ${r.commit.slice(0, 7)} is not in the project's history`);
      continue;
    }
    const pin = spawnSync("git", ["-C", top, "show", `${r.commit}:${pinRel}`], { env: gitEnv(), maxBuffer: 1 << 28 });
    if (pin.status !== 0) out.push(`${r.file}: the pin ${pinRel} is not at commit ${r.commit.slice(0, 7)}`);
    else if (sha256(pin.stdout) !== r.pin) out.push(`${r.file}: the pin's hash is not the hash of ${pinRel} at commit ${r.commit.slice(0, 7)}`);
    const config = git(top, "show", `${r.commit}:${cfgRel}`);
    const required = config.ok ? requiredChecks(config.out) : null;
    const given = r.checks.map((c) => c.check);
    if (!required) out.push(`${r.file}: no configuration ${cfgRel} at commit ${r.commit.slice(0, 7)}`);
    else if (required.join("|") !== given.join("|")) out.push(`${r.file}: the checks ${given.join(", ")} are not the ones the configuration at ${r.commit.slice(0, 7)} requires, ${required.join(", ")}`);
    const failed = r.checks.filter((c) => c.result !== "pass");
    if (failed.length) out.push(`${r.file}: checks not passed: ${failed.map((c) => `${c.check} · ${c.result ?? "(none)"}`).join(", ")}`);
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
        return files.length ? node(["--test", ...files], join(wt, cfgDir)) : { status: 1, stdout: "", stderr: `no test files in ${s.dir}` };
      },
      { label: `suite ${s.name || "tests"}` },
    ),
  );
  return runAtCommit({ top, commit, commands: [check, ...suites] });
}

export const releaseRecordText = ({ version, commit, pin, tool, date, results }) =>
  [`Version: ${version}`, `Commit: ${commit}`, `Pin: ${pin}`, `Tool: ${tool}`, `Date: ${date}`, "Checks:", ...results.map((r) => `- ${r.command} · ${r.result}`), ""].join("\n");
