#!/usr/bin/env node
// Releases of the protocol and of a product (D-109, D-111).
//   node tools/ont-check/release.mjs <version>    in the approach's repository: a release of the protocol
//   node tools/ont-check/release.mjs --resume     tags a release commit left without its tag
//   node tools/ont-check/release.mjs --product <version> [--config ont.config.json] [--commit REF]
//   node tools/ont-check/release.mjs --verify <version> [--config ont.config.json]
// A release of the protocol needs a clean work tree; it runs npm test and the check on HEAD, and on
// green commits only the entry of releases.md, the release commit, and tags it v<version>. --resume
// checks the shape of the release commit, runs both again on its parent in a temporary worktree and only
// then tags it. --product runs the project's check and test suites from the configuration of the commit
// in a temporary worktree and writes the record of the release only when all pass; --verify runs them
// again and compares the results with the record.
// ont: action.release-protocol, action.release-product, action.verify-release, inv.release-tagged, rule.intact-is-not-run
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./lib.mjs";
import {
  RELEASES_FILE,
  RELEASES_HEAD,
  SEMVER,
  START_VERSION,
  changesBetween,
  compareVersions,
  entryText,
  git,
  parseProductRecords,
  parseReleasesFile,
  previousVerified,
  releaseRecordText,
  releaseTags,
  runReleaseChecks,
} from "./releases.mjs";
import { cleanEnv, runAtCommit, sha256 } from "./tasks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const value = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
const refuse = (why) => {
  console.log(`ERROR · ${why}`);
  process.exit(1);
};
const today = () => new Date().toISOString().slice(0, 10);
const tail = (out) => out.split("\n").slice(-15).join("\n");
// The tool's place inside a worktree of the repository, or the tool itself when it lives outside it.
const toolIn = (top) => {
  const rel = relative(top, HERE);
  return rel.startsWith("..") || isAbsolute(rel) ? null : rel;
};

if (argv.includes("--product") || argv.includes("--verify")) product();
else protocol();

function protocol() {
  const top = git(process.cwd(), "rev-parse", "--show-toplevel").out;
  if (!top) refuse("not in a Git repository");
  const config = join(top, "ont.config.json");
  const path = join(top, RELEASES_FILE);
  const { entries } = existsSync(path) ? parseReleasesFile(readFileSync(path, "utf8")) : { entries: [] };
  const tagMessage = (version, verified) => {
    const changes = changesBetween(top, previousVerified(top, entries, version), verified);
    return `v${version}\n\nChanges, entries of the decision log since the release before:\n${changes.map((c) => `- ${c.id} · ${c.title}`).join("\n") || "- none"}\n`;
  };
  const tag = (version, commit, verified) => {
    const r = git(top, "tag", "-a", `v${version}`, commit, "-m", tagMessage(version, verified));
    if (!r.ok) refuse(`the tag v${version} was not made: ${r.err}`);
  };
  // npm test and the check, in a worktree of the commit with the tool of that commit.
  const checksIn = (repo) => [
    Object.assign((wt) => spawnSync("npm", ["test"], { cwd: wt, env: cleanEnv(), encoding: "utf8", maxBuffer: 1 << 28 }), { label: "npm test" }),
    Object.assign(
      (wt) => spawnSync(process.execPath, [join(toolIn(repo) === null ? HERE : join(wt, toolIn(repo)), "ont-check.mjs"), "--config", join(wt, "ont.config.json")], { cwd: wt, env: cleanEnv(), encoding: "utf8", maxBuffer: 1 << 28 }),
      { label: "ont-check" },
    ),
  ];
  const checks = (dir, tool) => [
    Object.assign(() => spawnSync("npm", ["test"], { cwd: dir, env: cleanEnv(), encoding: "utf8", maxBuffer: 1 << 28 }), { label: "npm test" }),
    Object.assign(() => spawnSync(process.execPath, [join(tool, "ont-check.mjs"), "--config", join(dir, "ont.config.json")], { cwd: dir, env: cleanEnv(), encoding: "utf8", maxBuffer: 1 << 28 }), { label: "ont-check" }),
  ];

  if (argv.includes("--resume")) {
    const untagged = entries.filter((e) => !git(top, "rev-parse", "--verify", "-q", `refs/tags/v${e.version}`).ok);
    if (!untagged.length) refuse("no release commit is waiting for its tag");
    for (const e of untagged) {
      // The release commit: a child of the verified commit, on the way to HEAD, that changes only releases.md.
      const commit = git(top, "rev-list", "--parents", "HEAD").out
        .split("\n")
        .map((l) => l.split(" "))
        .find(([, ...parents]) => parents.length === 1 && parents[0] === e.verified)?.[0];
      if (!commit) refuse(`v${e.version}: no commit on the way to HEAD is a child of the verified commit ${e.verified.slice(0, 7)}`);
      const changed = git(top, "diff", "--name-only", e.verified, commit).out.split("\n").filter(Boolean);
      if (changed.join() !== RELEASES_FILE) refuse(`v${e.version}: the release commit ${commit.slice(0, 7)} changes ${changed.join(", ")}, not only ${RELEASES_FILE}; no tag`);
      const run = runAtCommit({ top, commit: e.verified, commands: checksIn(top) });
      if (run.error) refuse(run.error);
      const failed = run.results.filter((r) => r.result !== "pass");
      if (failed.length) refuse(`v${e.version}: on the verified commit ${e.verified.slice(0, 7)} ${failed.map((f) => f.command).join(" and ")} failed; no tag\n${tail(failed[0].output)}`);
      tag(e.version, commit, e.verified);
      console.log(`RELEASED v${e.version}: tagged ${commit.slice(0, 7)}, after the checks passed again on ${e.verified.slice(0, 7)}`);
    }
    return;
  }

  const version = argv[0]?.replace(/^v/, "");
  if (!version || !SEMVER.test(version)) refuse("give the version, three numbers of Semantic Versioning: release.mjs 0.2.0");
  if (git(top, "status", "--porcelain").out) refuse("the work tree is not clean; commit or remove the changes first");
  const known = [START_VERSION, ...releaseTags(top).map((t) => t.version).filter(Boolean), ...entries.map((e) => e.version)];
  const highest = known.sort(compareVersions).at(-1);
  if (compareVersions(version, highest) <= 0) refuse(`version ${version} is not greater than ${highest}`);
  const verified = git(top, "rev-parse", "HEAD").out;
  for (const c of checks(top, HERE)) {
    const r = c();
    if (r.status !== 0) refuse(`${c.label} failed on ${verified.slice(0, 7)}; nothing written\n${tail(`${r.stdout}${r.stderr}`)}`);
  }
  if (!existsSync(config)) refuse(`no ${relative(process.cwd(), config)}`);
  const before = existsSync(path) ? readFileSync(path, "utf8") : RELEASES_HEAD;
  writeFileSync(path, `${before.replace(/\n*$/, "\n\n")}${entryText({ version, date: today(), verified })}`);
  const add = git(top, "add", RELEASES_FILE);
  // The checks ran on the verified commit; the release commit adds only the entry, so the hooks are not run again.
  const commit = add.ok && git(top, "commit", "--no-verify", "-q", "-m", `Release v${version}`, "--", RELEASES_FILE);
  if (!commit?.ok) refuse(`the release commit was not made: ${commit?.err ?? add.err}`);
  const head = git(top, "rev-parse", "HEAD").out;
  tag(version, head, verified);
  console.log(`RELEASED v${version}: release commit ${head.slice(0, 7)}, a child of the verified ${verified.slice(0, 7)}, tagged v${version}`);
}

function product() {
  const cfg = loadConfig(value("--config") ?? "ont.config.json");
  if (!cfg.releases) refuse("the configuration names no releases: the directory of records and the pin");
  const top = git(cfg.base, "rev-parse", "--show-toplevel").out;
  const cfgRel = relative(top, cfg.file).split("\\").join("/");
  const pinRel = relative(top, cfg.releases.pin).split("\\").join("/");
  const tool = toolIn(top);
  const { releases } = parseProductRecords(cfg.releases.dir);
  const run = (commit) =>
    tool === null
      ? refuse("the tool must be inside the repository, so that the worktree has the tool of the commit")
      : runReleaseChecks({ top, commit, cfgRel, toolRel: tool });

  if (argv.includes("--verify")) {
    const version = value("--verify");
    const r = releases.find((x) => x.version === version);
    if (!r) refuse(`no record of release ${version}`);
    const res = run(r.commit);
    if (res.error) refuse(res.error);
    const got = res.results.map((x) => `${x.command} · ${x.result}`);
    const want = r.checks.map((c) => `${c.check} · ${c.result}`);
    const failed = res.results.filter((x) => x.result !== "pass");
    if (failed.length || got.join("|") !== want.join("|"))
      refuse(`release ${version} is not verified on ${r.commit.slice(0, 7)}: the run gave ${got.join(", ")}; the record says ${want.join(", ")}${failed.length ? `\n${tail(failed[0].output)}` : ""}`);
    console.log(`VERIFIED ${version}: ${got.join(", ")} on ${r.commit.slice(0, 7)}`);
    return;
  }

  const version = value("--product")?.replace(/^v/, "");
  if (!version || !SEMVER.test(version)) refuse("give the version, three numbers of Semantic Versioning: --product 1.0.0");
  if (releases.some((r) => r.version === version)) refuse(`release ${version} has a record already`);
  const commit = git(cfg.base, "rev-parse", "--verify", `${value("--commit") ?? "HEAD"}^{commit}`).out;
  if (!commit) refuse(`no commit ${value("--commit") ?? "HEAD"}`);
  const pin = spawnSync("git", ["-C", top, "show", `${commit}:${pinRel}`], { maxBuffer: 1 << 28 });
  if (pin.status !== 0) refuse(`the pin ${pinRel} is not at commit ${commit.slice(0, 7)}`);
  const res = run(commit);
  if (res.error) refuse(res.error);
  const failed = res.results.filter((x) => x.result !== "pass");
  if (failed.length) refuse(`${failed.map((f) => f.command).join(" and ")} failed on ${commit.slice(0, 7)}; no record written\n${tail(failed[0].output)}`);
  // The version of the tool: the commit of the approach its pin names, or the commit itself when the
  // tool is the approach's own, as in the approach's example.
  let toolVersion = commit;
  try {
    toolVersion = JSON.parse(pin.stdout.toString("utf8")).commit ?? commit;
  } catch {}
  mkdirSync(cfg.releases.dir, { recursive: true });
  const file = join(cfg.releases.dir, `${version}.md`);
  writeFileSync(file, releaseRecordText({ version, commit, pin: sha256(pin.stdout), tool: toolVersion, date: today(), results: res.results }));
  console.log(`RELEASED ${version}: ${res.results.map((x) => x.command).join(", ")} passed on ${commit.slice(0, 7)}; recorded in ${relative(process.cwd(), resolve(file))}`);
}
