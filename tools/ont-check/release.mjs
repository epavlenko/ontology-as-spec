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
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  RELEASABLE,
  inHistory,
  parseProductRecords,
  pinAt,
  productReleaseProblems,
  releaseRecordProblems,
  runMatchesRecord,
  parseReleasesFile,
  previousVerified,
  releaseCommitProblems,
  releaseRecordText,
  releaseTags,
  runReleaseChecks,
} from "./releases.mjs";
import { cleanEnv, gitEnv, runAtCommit } from "./tasks.mjs";

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

// The tree of a commit with one file at the root of the repository replaced by a blob.
const treeWith = (top, commit, name, blob) => {
  const entries = git(top, "ls-tree", "-z", commit).out.split("\0").filter(Boolean).filter((l) => l.split("\t")[1] !== name);
  const r = spawnSync("git", ["-C", top, "mktree", "-z"], { input: [...entries, `100644 blob ${blob}\t${name}`].map((l) => `${l}\0`).join(""), encoding: "utf8", env: gitEnv() });
  return r.status === 0 ? r.stdout.trim() : null;
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
      // The release commit: a child of the verified commit, on the way to HEAD, that adds exactly this
      // entry to releases.md and changes nothing else (D-114).
      const children = git(top, "rev-list", "--parents", "HEAD").out
        .split("\n")
        .map((l) => l.split(" "))
        .filter(([, ...parents]) => parents.length === 1 && parents[0] === e.verified)
        .map(([c]) => c);
      if (!children.length) refuse(`v${e.version}: no commit on the way to HEAD is a child of the verified commit ${e.verified.slice(0, 7)}`);
      const why = children.map((c) => releaseCommitProblems(top, c, e));
      const commit = children.find((c, i) => !why[i].length);
      if (!commit) refuse(`v${e.version}: ${why.flat().join("; ")}; no tag`);
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
  const existed = existsSync(path);
  const before = existed ? readFileSync(path, "utf8") : RELEASES_HEAD;
  const restore = () => (existed ? writeFileSync(path, before) : rmSync(path, { force: true }));
  const date = today();
  writeFileSync(path, `${before.replace(/\n*$/, "\n\n")}${entryText({ version, date, verified })}`);
  // The release commit is made from the verified commit's tree with the entry, by Git's plumbing, which
  // runs no hook: the checks ran on the verified commit, and the commit adds only the entry. The tag goes
  // on the commit this returned, after checking it is the release commit of this entry, and the branch
  // moves to it only from the verified commit (D-114).
  const blob = git(top, "hash-object", "-w", "--", RELEASES_FILE);
  const tree = blob.ok && treeWith(top, verified, RELEASES_FILE, blob.out);
  const made = tree && git(top, "commit-tree", tree, "-p", verified, "-m", `Release v${version}`);
  if (!made?.ok || !/^[0-9a-f]{40}$/.test(made.out)) {
    restore();
    refuse(`the release commit was not made: ${made?.err ?? blob.err ?? "no tree"}`);
  }
  const commit = made.out;
  const wrong = releaseCommitProblems(top, commit, { version, date, verified });
  if (wrong.length) {
    restore();
    refuse(`the commit made is not the release commit: ${wrong.join("; ")}; no tag`);
  }
  const moved = git(top, "update-ref", "-m", `release v${version}`, "HEAD", commit, verified);
  if (!moved.ok) {
    restore();
    refuse(`HEAD is no longer the verified commit ${verified.slice(0, 7)}, so the release commit ${commit.slice(0, 7)} is not taken: ${moved.err}`);
  }
  git(top, "reset", "-q", "--", RELEASES_FILE);
  tag(version, commit, verified);
  console.log(`RELEASED v${version}: release commit ${commit.slice(0, 7)}, a child of the verified ${verified.slice(0, 7)}, tagged v${version}`);
}

function product() {
  const cfg = loadConfig(value("--config") ?? "ont.config.json");
  if (!cfg.releases) refuse("the configuration names no releases: the directory of records and the pin");
  const top = git(cfg.base, "rev-parse", "--show-toplevel").out;
  const cfgRel = relative(top, cfg.file).split("\\").join("/");
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
    // The record's integrity first, as the check finds it: a run cannot vouch for a record whose commit,
    // pin or checks do not hold (D-116).
    const broken = productReleaseProblems({ top, cfgRel, releases: [r], deployments: [] });
    if (broken.length) refuse(`release ${version} is not intact, so it is not run:\n${broken.map((b) => `  ${b}`).join("\n")}`);
    const res = run(r.commit);
    if (res.error) refuse(res.error);
    const got = res.results.map((x) => `${x.command} · ${x.result}${x.result === "skipped" ? ` · ${x.detail}` : ""}`);
    const want = r.checks.map((c) => `${c.check} · ${c.result}${c.result === "skipped" ? ` · ${c.detail}` : ""}`);
    // Each check gives the result its record says, a skipped one with the same counts; a check the record
    // says was skipped may pass now, where the run had what it lacked, such as a judge (D-125).
    const same = runMatchesRecord(r.checks, res.results);
    const failed = res.results.filter((x) => !RELEASABLE.has(x.result));
    if (failed.length || !same)
      refuse(`release ${version} is not verified on ${r.commit.slice(0, 7)}: the run gave ${got.join(", ")}; the record says ${want.join(", ")}${failed.length ? `\n${tail(failed[0].output)}` : ""}`);
    console.log(`VERIFIED ${version}: ${res.results.map((x) => `${x.command} · ${x.result}${x.detail ? ` (${x.detail})` : ""}`).join(", ")} on ${r.commit.slice(0, 7)}`);
    return;
  }

  const version = value("--product")?.replace(/^v/, "");
  if (!version || !SEMVER.test(version)) refuse("give the version, three numbers of Semantic Versioning: --product 1.0.0");
  if (releases.some((r) => r.version === version)) refuse(`release ${version} has a record already`);
  const commit = git(cfg.base, "rev-parse", "--verify", `${value("--commit") ?? "HEAD"}^{commit}`).out;
  if (!commit) refuse(`no commit ${value("--commit") ?? "HEAD"}`);
  // The rules of the check, before anything runs: a commit of the history, the pin of its configuration
  // (D-125).
  if (!inHistory(top, commit)) refuse(`commit ${commit.slice(0, 7)} is not in the project's history, the history of HEAD; no record written`);
  const pin = pinAt(top, cfgRel, commit);
  if (pin.error) refuse(`${pin.error}; no record written`);
  const res = run(commit);
  if (res.error) refuse(res.error);
  // A release is written with checks that passed or were skipped, never with one that failed or ran no
  // test (D-116); the record says which were skipped.
  const failed = res.results.filter((x) => !RELEASABLE.has(x.result));
  if (failed.length) refuse(`${failed.map((f) => `${f.command} ${f.result === "fail" ? "failed" : "ran no test"}`).join(" and ")} on ${commit.slice(0, 7)}; no record written\n${tail(failed[0].output)}`);
  // The version of the tool: the commit of the approach its pin names, or the commit itself when the
  // tool is the approach's own, as in the approach's example.
  let toolVersion = commit;
  try {
    toolVersion = JSON.parse(pin.bytes.toString("utf8")).commit ?? commit;
  } catch {}
  // The record is validated as the check validates it, by the same function, before it is written
  // (D-125): the action never writes a record the check refuses.
  const record = { version, commit, pin: pin.hash, tool: toolVersion, date: today(), results: res.results };
  const checks = res.results.map((x) => ({ check: x.command, result: x.result, detail: x.detail }));
  const wrong = releaseRecordProblems({ top, cfgRel, r: { ...record, file: `${version}.md`, checks } });
  if (wrong.length) refuse(`the record would not hold: ${wrong.join("; ")}; no record written`);
  mkdirSync(cfg.releases.dir, { recursive: true });
  const file = join(cfg.releases.dir, `${version}.md`);
  writeFileSync(file, releaseRecordText(record));
  const skipped = res.results.filter((x) => x.result === "skipped");
  console.log(`RELEASED ${version}: ${res.results.map((x) => `${x.command} · ${x.result}`).join(", ")} on ${commit.slice(0, 7)}${skipped.length ? `; skipped, as the record says: ${skipped.map((x) => `${x.command} (${x.detail})`).join(", ")}` : ""}; recorded in ${relative(process.cwd(), resolve(file))}`);
}
