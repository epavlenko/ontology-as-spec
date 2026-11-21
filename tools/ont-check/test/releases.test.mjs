// Releases of the protocol (D-109), what a project learns of them (D-110), and releases of a product
// with their deployments (D-111). Every release here is made in a temporary repository.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { blobAt, fileAt, kindAt, parseProductRecords, parseReleasesFile, productReleaseProblems, protocolReleaseProblems, releaseNews, releaseTag, repoPath, runningNow } from "../releases.mjs";
import { sha256 } from "../tasks.mjs";

const TOOLS = fileURLToPath(new URL("../", import.meta.url));
const TEMPLATES = fileURLToPath(new URL("../../../templates/", import.meta.url));
const ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.org", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.org" };
const made = [];
after(() => made.forEach((d) => rmSync(d, { recursive: true, force: true })));
const temp = (name) => {
  const d = mkdtempSync(join(tmpdir(), name));
  made.push(d);
  return d;
};
const git = (cwd, ...a) => {
  const r = spawnSync("git", ["-C", cwd, ...a], { encoding: "utf8", env: ENV });
  assert.equal(r.status, 0, `git ${a.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};
const node = (cwd, script, ...a) => spawnSync(process.execPath, [script, ...a], { cwd, encoding: "utf8", env: ENV });
const commitAll = (repo, message) => {
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", message);
  return git(repo, "rev-parse", "HEAD");
};
const entry = (id, concept) =>
  `### ${id} · A decision\n\n- Date: 2026-11-20 · Status: accepted\n- Decision: something.\n- Why: a reason.\n- Rejected: nothing.\n- Concepts: \`${concept}\`.\n\n`;
const addEntry = (repo, id, concept = "action.close") => {
  const p = join(repo, "decisions.md");
  writeFileSync(p, readFileSync(p, "utf8").replace("## Tentative", `${entry(id, concept)}## Tentative`));
  return commitAll(repo, `${id}`);
};

// A small repository of an approach: the templates, a test that fails while the file "fail" exists, and
// the releases of the protocol in its configuration. Its first commit carries the tag v0.1.
function approachRepo() {
  const repo = temp("approach-");
  cpSync(TEMPLATES, repo, { recursive: true });
  const cfg = JSON.parse(readFileSync(join(repo, "ont.config.json"), "utf8"));
  writeFileSync(join(repo, "ont.config.json"), JSON.stringify({ ...cfg, protocolReleases: { file: "releases.md" } }, null, 2));
  writeFileSync(join(repo, "package.json"), JSON.stringify({ private: true, scripts: { test: "node t.js" } }));
  writeFileSync(join(repo, "t.js"), 'process.exit(require("fs").existsSync("fail") ? 1 : 0);\n');
  git(repo, "init", "-q", "-b", "main");
  const first = commitAll(repo, "first");
  git(repo, "tag", "-a", "v0.1", "-m", "v0.1");
  return { repo, first };
}
const release = (repo, ...a) => node(repo, join(TOOLS, "release.mjs"), ...a);
const check = (repo) => node(repo, join(TOOLS, "ont-check.mjs"), "--config", join(repo, "ont.config.json"));
const tagged = (repo, tag) => spawnSync("git", ["-C", repo, "rev-parse", "-q", "--verify", `refs/tags/${tag}`]).status === 0;

test("[check.protocol-release.changes-from-log] from v0.1, read as 0.1.0 with no entry, the changes of 0.2.0 are the entries between the verified commits", () => {
  const { repo } = approachRepo();
  assert.deepEqual(protocolReleaseProblems(repo).problems, []);
  addEntry(repo, "D-02");
  const verified = addEntry(repo, "D-03");
  const r = release(repo, "0.2.0");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const message = git(repo, "tag", "-l", "--format=%(contents)", "v0.2.0");
  assert.match(message, /- D-02 · A decision\n- D-03 · A decision/);
  assert.doesNotMatch(message, /D-01/);
  assert.match(readFileSync(join(repo, "releases.md"), "utf8"), new RegExp(`## v0\\.2\\.0 · \\d{4}-\\d{2}-\\d{2}\\n\\n- Verified: ${verified}`));
  assert.deepEqual(protocolReleaseProblems(repo).problems, []);
  // 0.3.0 counts from the verified commit of 0.2.0, not from v0.1.
  addEntry(repo, "D-04");
  assert.equal(release(repo, "0.3.0").status, 0);
  assert.match(git(repo, "tag", "-l", "--format=%(contents)", "v0.3.0"), /^v0\.3\.0[\s\S]*- D-04 · A decision$/);
  assert.doesNotMatch(git(repo, "tag", "-l", "--format=%(contents)", "v0.3.0"), /D-03/);
  // A version not greater than the last is refused.
  assert.match(release(repo, "0.2.5").stdout, /not greater than 0\.3\.0/);
});

test("[check.protocol-release.released-on-green] on green the release commit is a child of the verified one, changes only releases.md and is tagged; on a failure nothing is written", () => {
  const { repo } = approachRepo();
  const verified = addEntry(repo, "D-02");
  assert.equal(release(repo, "0.2.0").status, 0);
  const commit = git(repo, "rev-parse", "v0.2.0^{commit}");
  assert.equal(commit, git(repo, "rev-parse", "HEAD"));
  assert.equal(git(repo, "rev-parse", `${commit}^`), verified);
  assert.equal(git(repo, "diff", "--name-only", verified, commit), "releases.md");
  assert.equal(git(repo, "cat-file", "-t", "refs/tags/v0.2.0"), "tag");
  assert.equal(check(repo).status, 0, check(repo).stdout);
  // A failing test: no commit, no tag.
  writeFileSync(join(repo, "fail"), "");
  const head = commitAll(repo, "breaks the test");
  const r = release(repo, "0.3.0");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /npm test failed on [0-9a-f]{7}; nothing written/);
  assert.equal(git(repo, "rev-parse", "HEAD"), head);
  assert.equal(tagged(repo, "v0.3.0"), false);
  assert.equal(git(repo, "status", "--porcelain"), "");
  // A work tree that is not clean is refused before anything runs.
  rmSync(join(repo, "fail"));
  assert.match(release(repo, "0.3.0").stdout, /the work tree is not clean/);
});

// A release commit made by hand, as if release.mjs stopped before the tag.
const releaseCommitWithoutTag = (repo, version, verified) => {
  const p = join(repo, "releases.md");
  writeFileSync(p, `# Releases\n\n## v${version} · 2026-11-20\n\n- Verified: ${verified}\n`);
  return commitAll(repo, `Release v${version}`);
};

test("[check.protocol-release.untagged] a release commit without its tag fails the check, and --resume tags it", () => {
  const { repo } = approachRepo();
  const verified = addEntry(repo, "D-02");
  const commit = releaseCommitWithoutTag(repo, "0.2.0", verified);
  assert.match(protocolReleaseProblems(repo).problems.join("\n"), /v0\.2\.0: the release commit has no tag/);
  const c = check(repo);
  assert.equal(c.status, 1);
  assert.match(c.stdout, /releases of the protocol that do not hold \(1\)/);
  const r = release(repo, "--resume");
  assert.equal(r.status, 0, r.stdout);
  assert.equal(git(repo, "rev-parse", "v0.2.0^{commit}"), commit);
  assert.deepEqual(protocolReleaseProblems(repo).problems, []);
  assert.equal(check(repo).status, 0);
});

test("[check.protocol-release.tag-without-entry] a tag with no entry fails the check, v0.1 aside", () => {
  const { repo } = approachRepo();
  git(repo, "tag", "-a", "v0.3.0", "-m", "v0.3.0");
  const p = protocolReleaseProblems(repo).problems;
  assert.deepEqual(p, ["tag v0.3.0 has no entry in releases.md"]);
  assert.equal(check(repo).status, 1);
});

test("[check.protocol-release.resume-reruns] --resume refuses to tag when the tests fail again on the verified commit", () => {
  const { repo } = approachRepo();
  writeFileSync(join(repo, "fail"), "");
  const verified = commitAll(repo, "a verified commit whose test fails");
  releaseCommitWithoutTag(repo, "0.2.0", verified);
  rmSync(join(repo, "fail"), { force: true });
  const r = release(repo, "--resume");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /npm test failed; no tag/);
  assert.equal(tagged(repo, "v0.2.0"), false);
  // A release commit that changes more than releases.md is refused too.
  const { repo: other } = approachRepo();
  const v = addEntry(other, "D-02");
  writeFileSync(join(other, "releases.md"), `# Releases\n\n## v0.2.0 · 2026-11-20\n\n- Verified: ${v}\n`);
  writeFileSync(join(other, "extra.txt"), "x");
  commitAll(other, "Release v0.2.0 and more");
  assert.match(release(other, "--resume").stdout, /changes extra\.txt, releases\.md, not only releases\.md; no tag/);
  assert.equal(tagged(other, "v0.2.0"), false);
});

test("[check.protocol-release.entry-in-commit] a tag on a commit that adds only the heading, the entry of another version or changes an earlier entry fails the check, and --resume does not tag it", () => {
  // The tag on a commit that adds only the heading of releases.md; the entry comes in a later commit.
  const { repo } = approachRepo();
  const verified = addEntry(repo, "D-02");
  writeFileSync(join(repo, "releases.md"), "# Releases\n");
  const heading = commitAll(repo, "only the heading");
  git(repo, "tag", "-a", "v0.2.0", heading, "-m", "v0.2.0");
  writeFileSync(join(repo, "releases.md"), `# Releases\n\n## v0.2.0 · 2026-11-20\n\n- Verified: ${verified}\n`);
  commitAll(repo, "the entry, later");
  assert.match(protocolReleaseProblems(repo).problems.join("\n"), new RegExp(`^v0\\.2\\.0: the release commit ${heading.slice(0, 7)} adds no entry, not exactly the entry of v0\\.2\\.0 verified on ${verified.slice(0, 7)}$`));
  assert.equal(check(repo).status, 1);
  // The same commits with no tag: --resume finds no release commit of the entry and tags nothing.
  git(repo, "tag", "-d", "v0.2.0");
  const r = release(repo, "--resume");
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /v0\.2\.0: the release commit [0-9a-f]{7} adds no entry, not exactly the entry of v0\.2\.0 .*; no tag/);
  assert.equal(tagged(repo, "v0.2.0"), false);
  // A commit that adds the entry of another version, and one that changes an earlier entry.
  const { repo: other } = approachRepo();
  const v2 = addEntry(other, "D-02");
  writeFileSync(join(other, "releases.md"), `# Releases\n\n## v0.2.0 · 2026-11-20\n\n- Verified: ${v2}\n`);
  const c2 = commitAll(other, "Release v0.2.0");
  git(other, "tag", "-a", "v0.2.0", c2, "-m", "v0.2.0");
  assert.deepEqual(protocolReleaseProblems(other).problems, []);
  const v3 = addEntry(other, "D-03");
  writeFileSync(join(other, "releases.md"), `# Releases\n\n## v0.2.0 · 2026-11-19\n\n- Verified: ${v2}\n\n## v0.3.0 · 2026-11-20\n\n- Verified: ${v3}\n`);
  const c3 = commitAll(other, "Release v0.3.0, the date of v0.2.0 changed");
  git(other, "tag", "-a", "v0.3.0", c3, "-m", "v0.3.0");
  const p3 = protocolReleaseProblems(other).problems.join("\n");
  assert.match(p3, /v0\.3\.0: the release commit [0-9a-f]{7} changes or removes the entries of v0\.2\.0/);
});

test("[check.protocol-release.commit-returned] the release tags the commit it made, not what HEAD is after a hook moved it", () => {
  const { repo } = approachRepo();
  const verified = addEntry(repo, "D-02");
  // A post-commit hook that makes a commit of its own: a release that re-read HEAD would tag that one.
  mkdirSync(join(repo, "hooks"));
  writeFileSync(join(repo, "hooks", "post-commit"), "#!/bin/sh\n[ -f hooked ] && exit 0\necho x > hooked && git add hooked && git commit -q -m hooked\n", { mode: 0o755 });
  const verifiedNow = commitAll(repo, "the hook");
  git(repo, "config", "core.hooksPath", "hooks");
  const r = release(repo, "0.2.0");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const commit = git(repo, "rev-parse", "v0.2.0^{commit}");
  assert.equal(git(repo, "rev-parse", `${commit}^`), verifiedNow);
  assert.equal(git(repo, "diff", "--name-only", verifiedNow, commit), "releases.md");
  assert.equal(git(repo, "rev-parse", "HEAD"), commit);
  assert.equal(git(repo, "status", "--porcelain"), "");
  assert.deepEqual(protocolReleaseProblems(repo).problems, []);
  assert.notEqual(verified, verifiedNow);
});

test("[check.protocol-release.news-unreadable] a tag of the approach clone with no entry of its version at its commit is said, never read as no newer version", () => {
  const { repo, first } = approachRepo();
  const verified = addEntry(repo, "D-02");
  writeFileSync(join(repo, "releases.md"), "# Releases\n");
  const heading = commitAll(repo, "only the heading");
  git(repo, "tag", "-a", "v0.2.0", heading, "-m", "v0.2.0");
  writeFileSync(join(repo, "releases.md"), `# Releases\n\n## v0.2.0 · 2026-11-20\n\n- Verified: ${verified}\n`);
  commitAll(repo, "the entry, later");
  const news = releaseNews({ clone: repo, pinCommit: first, used: new Set() });
  assert.equal(news.length, 2, news.join("\n"));
  assert.match(news[0], /^the releases of the approach clone are not known in full: tag v0\.2\.0: its commit has no entry of 0\.2\.0 in releases\.md; it is not counted$/);
  assert.equal(news[1], "no newer version among the releases of the approach clone that can be read");
  assert.ok(!news.some((l) => /among the releases the approach clone knows/.test(l)));
});

test("[check.protocol-release.lightweight-tag] a lightweight tag on a valid release commit is no release, for the check of the approach and for the news of a project alike", () => {
  const { repo, first } = approachRepo();
  addEntry(repo, "D-02");
  assert.equal(release(repo, "0.2.0").status, 0);
  const commit = git(repo, "rev-parse", "v0.2.0^{commit}");
  assert.equal(releaseNews({ clone: repo, pinCommit: first, used: new Set() }).length, 1);
  git(repo, "tag", "-d", "v0.2.0");
  git(repo, "tag", "v0.2.0", commit);
  assert.equal(git(repo, "cat-file", "-t", "refs/tags/v0.2.0"), "commit");
  assert.deepEqual(protocolReleaseProblems(repo).problems, ["v0.2.0: the tag is not annotated"]);
  assert.equal(releaseTag(repo, "v0.2.0").entry, null);
  const news = releaseNews({ clone: repo, pinCommit: first, used: new Set() });
  assert.deepEqual(news, [
    "the releases of the approach clone are not known in full: tag v0.2.0: the tag is not annotated; it is not counted",
    "no newer version among the releases of the approach clone that can be read",
  ]);
});

test("[check.protocol-release.news] a project learns of newer releases from its approach clone, read by tag, and none of it fails the check", () => {
  const { repo, first } = approachRepo();
  const clone = join(temp("clone-parent-"), "early");
  git(repo, "clone", "-q", repo, clone);
  // D-02 names a rule of the approach that the templates' agent instructions use.
  addEntry(repo, "D-02", "rule.start-from-ids");
  const r2 = release(repo, "0.2.0");
  assert.equal(r2.status, 0, r2.stdout);
  const between = addEntry(repo, "D-03", "ent.thing");
  addEntry(repo, "D-04", "action.close");
  assert.equal(release(repo, "0.3.0").status, 0);
  const used = new Set(["action.close", "rule.start-from-ids"]);
  // Pinned before v0.2.0: both releases, with the changes that alter the project's rules.
  const before = releaseNews({ clone: repo, pinCommit: first, used });
  assert.equal(before.length, 2);
  assert.match(before[0], /^version 0\.2\.0 was released \(\d{4}-\d{2}-\d{2}\); changes: D-02; of them, change this project's rules: D-02 \(rule\.start-from-ids\)$/);
  assert.match(before[1], /^version 0\.3\.0 was released .*changes: D-03, D-04; of them, change this project's rules: D-04 \(action\.close\)$/);
  // Pinned between the tags: only the release whose verified commit is not an ancestor of the pin.
  const mid = releaseNews({ clone: repo, pinCommit: between, used });
  assert.equal(mid.length, 1);
  assert.match(mid[0], /^version 0\.3\.0/);
  // A clone whose work tree stays on its first commit, its tags fetched: the entries are read by tag.
  git(clone, "fetch", "-q", "--tags", "origin");
  assert.equal(git(clone, "rev-parse", "HEAD"), first);
  assert.equal(releaseNews({ clone, pinCommit: first, used }).length, 2);
  // Nothing newer, a pin the clone does not have, no clone, a clone that cannot be read.
  assert.match(releaseNews({ clone: repo, pinCommit: git(repo, "rev-parse", "HEAD"), used })[0], /^no newer version among the releases the approach clone knows \(to learn of new ones: git fetch --tags in the clone\)$/);
  assert.match(releaseNews({ clone: repo, pinCommit: "f".repeat(40), used })[0], /^the comparison is not possible: the commit of the pin ffffffffffff is not in the approach clone$/);
  assert.match(releaseNews({ clone: null, pinCommit: first, used })[0], /^no information about releases: ont\.approachClone is not set/);
  assert.match(releaseNews({ clone: join(repo, "missing"), pinCommit: first, used })[0], /^no information about releases/);
  // Through the check of a project with a copy of the tool: information, and ONT_OK.
  const project = temp("project-");
  cpSync(TEMPLATES, project, { recursive: true });
  cpSync(TOOLS, join(project, "tools", "ont-check"), { recursive: true, filter: (src) => !src.includes(`${join(TOOLS, "test")}`) });
  writeFileSync(join(project, "tools", "ont-check", "upstream.json"), JSON.stringify({ protocol: "v0.1", commit: first, files: {} }));
  git(project, "init", "-q", "-b", "main");
  const run = () => node(project, join(project, "tools", "ont-check", "ont-check.mjs"), "--config", join(project, "ont.config.json"));
  const none = run();
  assert.equal(none.status, 0, none.stdout);
  assert.match(none.stdout, /info · releases of the approach \(1\):\n  no information about releases/);
  git(project, "config", "--local", "ont.approachClone", repo);
  const news = run();
  assert.equal(news.status, 0, news.stdout);
  assert.match(news.stdout, /info · releases of the approach \(2\):\n  version 0\.2\.0 was released.*change this project's rules: D-02 \(rule\.start-from-ids\)\n  version 0\.3\.0.*rules: none\n/);
  assert.match(news.stdout, /ONT_OK/);
});

// A product with a copy of the tool, a test suite and the releases in its configuration.
function productRepo() {
  const repo = temp("product-");
  cpSync(TEMPLATES, repo, { recursive: true });
  cpSync(TOOLS, join(repo, "tools", "ont-check"), { recursive: true, filter: (src) => !src.includes(`${join(TOOLS, "test")}`) });
  writeFileSync(join(repo, "tools", "ont-check", "upstream.json"), JSON.stringify({ protocol: "v0.2.0", commit: "c".repeat(40), files: {} }));
  const cfg = JSON.parse(readFileSync(join(repo, "ont.config.json"), "utf8"));
  writeFileSync(
    join(repo, "ont.config.json"),
    JSON.stringify({ ...cfg, testSuites: [{ name: "unit", dir: "tests", match: "\\.test\\.mjs$", cover: [] }], releases: { dir: "releases", pin: "tools/ont-check/upstream.json" } }, null, 2),
  );
  mkdirSync(join(repo, "tests"));
  writeFileSync(join(repo, "tests", "a.test.mjs"), 'import { test } from "node:test";\nimport { existsSync } from "node:fs";\ntest("a", () => { if (existsSync(new URL("../fail", import.meta.url))) throw new Error("fails"); });\n');
  git(repo, "init", "-q", "-b", "main");
  return { repo, first: commitAll(repo, "first") };
}
const product = (repo, ...a) => node(repo, join(repo, "tools", "ont-check", "release.mjs"), "--config", join(repo, "ont.config.json"), ...a);
const checkProduct = (repo, ...a) => node(repo, join(repo, "tools", "ont-check", "ont-check.mjs"), "--config", join(repo, "ont.config.json"), ...a);
const problems = (repo) => {
  const { releases, deployments } = parseProductRecords(join(repo, "releases"));
  return productReleaseProblems({ top: repo, cfgRel: "ont.config.json", releases, deployments });
};
const recordText = (fields, checks) => [...Object.entries(fields).map(([k, v]) => `${k}: ${v}`), "Checks:", ...checks, ""].join("\n");

test("[check.product-release.released-intact] a release written by the action on a green commit is intact and verified", () => {
  const { repo, first } = productRepo();
  const r = product(repo, "--product", "1.0.0");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const text = readFileSync(join(repo, "releases", "1.0.0.md"), "utf8");
  assert.match(text, new RegExp(`^Version: 1\\.0\\.0\\nCommit: ${first}\\nPin: ${sha256(readFileSync(join(repo, "tools", "ont-check", "upstream.json")))}\\nTool: ${"c".repeat(40)}\\nDate: \\d{4}-\\d{2}-\\d{2}\\nChecks:\\n- ont-check · pass\\n- suite unit · pass\\n$`));
  commitAll(repo, "the release 1.0.0");
  assert.deepEqual(problems(repo), []);
  assert.equal(checkProduct(repo).status, 0, checkProduct(repo).stdout);
  const v = product(repo, "--verify", "1.0.0");
  assert.equal(v.status, 0, v.stdout);
  assert.match(v.stdout, /VERIFIED 1\.0\.0: ont-check · pass, suite unit · pass/);
  // On a commit whose test fails, the action writes nothing.
  writeFileSync(join(repo, "fail"), "");
  commitAll(repo, "breaks the test");
  const bad = product(repo, "--product", "2.0.0");
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /suite unit failed on [0-9a-f]{7}; no record written/);
  assert.deepEqual(readdirSync(join(repo, "releases")), ["1.0.0.md"]);
});

test("[check.product-release.by-hand] a record written by hand is intact, and --verify fails it on a commit whose test fails", () => {
  const { repo } = productRepo();
  writeFileSync(join(repo, "fail"), "");
  const broken = commitAll(repo, "breaks the test");
  mkdirSync(join(repo, "releases"));
  const pin = sha256(readFileSync(join(repo, "tools", "ont-check", "upstream.json")));
  writeFileSync(join(repo, "releases", "2.0.0.md"), recordText({ Version: "2.0.0", Commit: broken, Pin: pin, Tool: "c".repeat(40), Date: "2026-11-20" }, ["- ont-check · pass", "- suite unit · pass"]));
  commitAll(repo, "a record by hand");
  assert.deepEqual(problems(repo), []);
  const v = product(repo, "--verify", "2.0.0");
  assert.equal(v.status, 1);
  assert.match(v.stdout, /release 2\.0\.0 is not verified on [0-9a-f]{7}: the run gave ont-check · pass, suite unit · fail/);
});

test("[check.product-release.skipped-suite] a suite whose every test is skipped is recorded as skipped, a suite that runs no test refuses the release, and --verify holds the record to it", () => {
  const { repo } = productRepo();
  const cfg = JSON.parse(readFileSync(join(repo, "ont.config.json"), "utf8"));
  const suites = (...more) => writeFileSync(join(repo, "ont.config.json"), JSON.stringify({ ...cfg, testSuites: [...cfg.testSuites, ...more] }, null, 2));
  mkdirSync(join(repo, "judged"));
  writeFileSync(join(repo, "judged", "a.judged.mjs"), 'import { test } from "node:test";\ntest("judged by a model", { skip: "no judge" }, () => {});\n');
  mkdirSync(join(repo, "empty"));
  writeFileSync(join(repo, "empty", "a.test.mjs"), "// no test here\n");
  suites({ name: "judged", dir: "judged", match: "\\.judged\\.mjs$", cover: [] }, { name: "empty", dir: "empty", match: "\\.test\\.mjs$", cover: [] });
  commitAll(repo, "a suite of skipped tests and one with no test");
  const none = product(repo, "--product", "1.0.0");
  assert.equal(none.status, 1, none.stdout);
  assert.match(none.stdout, /suite empty ran no test on [0-9a-f]{7}; no record written/);
  suites({ name: "judged", dir: "judged", match: "\\.judged\\.mjs$", cover: [] });
  const commit = commitAll(repo, "the suite with no test removed");
  const r = product(repo, "--product", "1.0.0");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /skipped, as the record says: suite judged \(1 of 1 tests skipped\)/);
  const text = readFileSync(join(repo, "releases", "1.0.0.md"), "utf8");
  assert.match(text, /Checks:\n- ont-check · pass\n- suite unit · pass\n- suite judged · skipped · 1 of 1 tests skipped\n$/);
  commitAll(repo, "the release 1.0.0");
  assert.deepEqual(problems(repo), []);
  const v = product(repo, "--verify", "1.0.0");
  assert.equal(v.status, 0, v.stdout);
  assert.match(v.stdout, /VERIFIED 1\.0\.0: ont-check · pass, suite unit · pass, suite judged · skipped \(1 of 1 tests skipped\)/);
  // A record that says the skipped suite passed is intact, and --verify fails it.
  const pin = sha256(readFileSync(join(repo, "tools", "ont-check", "upstream.json")));
  writeFileSync(join(repo, "releases", "1.0.1.md"), recordText({ Version: "1.0.1", Commit: commit, Pin: pin, Tool: "c".repeat(40), Date: "2026-11-20" }, ["- ont-check · pass", "- suite unit · pass", "- suite judged · pass"]));
  commitAll(repo, "a record by hand that says pass");
  assert.deepEqual(problems(repo), []);
  const wrong = product(repo, "--verify", "1.0.1");
  assert.equal(wrong.status, 1, wrong.stdout);
  assert.match(wrong.stdout, /release 1\.0\.1 is not verified .*the run gave ont-check · pass, suite unit · pass, suite judged · skipped · 1 of 1 tests skipped; the record says .*suite judged · pass/);
  // A record that says a suite ran no test is not intact.
  writeFileSync(join(repo, "releases", "1.0.2.md"), recordText({ Version: "1.0.2", Commit: commit, Pin: pin, Tool: "c".repeat(40), Date: "2026-11-20" }, ["- ont-check · pass", "- suite unit · pass", "- suite judged · not-run"]));
  assert.match(problems(repo).join("\n"), /1\.0\.2\.md: checks not passed: suite judged · not-run/);
});

test("[check.product-release.verify-skipped-count] --verify compares the count of skipped tests exactly, and a skipped check with no count is not intact", () => {
  const { repo } = productRepo();
  const cfg = JSON.parse(readFileSync(join(repo, "ont.config.json"), "utf8"));
  writeFileSync(join(repo, "ont.config.json"), JSON.stringify({ ...cfg, testSuites: [...cfg.testSuites, { name: "judged", dir: "judged", match: "\\.judged\\.mjs$", cover: [] }] }, null, 2));
  mkdirSync(join(repo, "judged"));
  writeFileSync(join(repo, "judged", "a.judged.mjs"), 'import { test } from "node:test";\nfor (const n of [1, 2, 3, 4, 5]) test(`judged ${n}`, { skip: "no judge" }, () => {});\n');
  const commit = commitAll(repo, "five judged tests, all skipped");
  mkdirSync(join(repo, "releases"));
  const pin = sha256(readFileSync(join(repo, "tools", "ont-check", "upstream.json")));
  const rec = (version, judged) => writeFileSync(join(repo, "releases", `${version}.md`), recordText({ Version: version, Commit: commit, Pin: pin, Tool: "c".repeat(40), Date: "2026-11-20" }, ["- ont-check · pass", "- suite unit · pass", `- suite judged · ${judged}`]));
  rec("1.0.0", "skipped · 1 of 5 tests skipped");
  rec("1.0.1", "skipped · 5 of 5 tests skipped");
  commitAll(repo, "two records by hand");
  assert.deepEqual(problems(repo), []);
  const wrong = product(repo, "--verify", "1.0.0");
  assert.equal(wrong.status, 1, wrong.stdout);
  assert.match(wrong.stdout, /release 1\.0\.0 is not verified .*the run gave .*suite judged · skipped · 5 of 5 tests skipped; the record says .*suite judged · skipped · 1 of 5 tests skipped/);
  const right = product(repo, "--verify", "1.0.1");
  assert.equal(right.status, 0, right.stdout);
  // Skipped with no count cannot be compared: the record is not intact.
  rec("1.0.2", "skipped");
  assert.match(problems(repo).join("\n"), /1\.0\.2\.md: skipped with no count: suite judged/);
});

test("[check.product-release.commit-outside-history] --product refuses a commit outside the history of HEAD before it writes, by the rule of the check", () => {
  const { repo } = productRepo();
  git(repo, "checkout", "-q", "-b", "side");
  writeFileSync(join(repo, "side.txt"), "x");
  const side = commitAll(repo, "a commit on another branch");
  git(repo, "checkout", "-q", "main");
  const r = product(repo, "--product", "1.0.0", "--commit", side);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /^ERROR · commit [0-9a-f]{7} is not in the project's history, the history of HEAD; no record written/);
  assert.equal(readdirSync(repo).includes("releases"), false);
  // The same rule as the check: a record of that commit written by hand is refused by it.
  mkdirSync(join(repo, "releases"));
  const pin = sha256(readFileSync(join(repo, "tools", "ont-check", "upstream.json")));
  writeFileSync(join(repo, "releases", "1.0.0.md"), recordText({ Version: "1.0.0", Commit: side, Pin: pin, Tool: "c".repeat(40), Date: "2026-11-20" }, ["- ont-check · pass", "- suite unit · pass"]));
  assert.match(problems(repo).join("\n"), /1\.0\.0\.md: commit [0-9a-f]{7} is not in the project's history/);
});

test("[check.product-release.pin-moved] a pin moved to another path later leaves an earlier release intact: its pin is read by the configuration at its commit", () => {
  const { repo } = productRepo();
  assert.equal(product(repo, "--product", "1.0.0").status, 0);
  commitAll(repo, "the release 1.0.0");
  mkdirSync(join(repo, "pins"));
  git(repo, "mv", "tools/ont-check/upstream.json", "pins/upstream.json");
  const cfg = JSON.parse(readFileSync(join(repo, "ont.config.json"), "utf8"));
  // Away from the tool's directory, the pin no longer says where the tool is: releases.tool does (D-142).
  writeFileSync(join(repo, "ont.config.json"), JSON.stringify({ ...cfg, releases: { ...cfg.releases, pin: "pins/upstream.json", tool: "tools/ont-check" } }, null, 2));
  commitAll(repo, "the pin moved");
  assert.deepEqual(problems(repo), []);
  const c = checkProduct(repo);
  assert.doesNotMatch(c.stdout, /records of releases and deployments that do not hold/);
  const v = product(repo, "--verify", "1.0.0");
  assert.equal(v.status, 0, v.stdout);
  // A release of the commit after the move hashes the pin at its new path.
  const r = product(repo, "--product", "1.1.0");
  assert.equal(r.status, 0, r.stdout);
  assert.match(readFileSync(join(repo, "releases", "1.1.0.md"), "utf8"), new RegExp(`Pin: ${sha256(readFileSync(join(repo, "pins", "upstream.json")))}`));
});

test("[check.product-release.verify-intact-first] --verify refuses a record that is not intact before it runs anything", () => {
  const { repo, first } = productRepo();
  mkdirSync(join(repo, "releases"));
  writeFileSync(join(repo, "releases", "1.0.0.md"), recordText({ Version: "1.0.0", Commit: first, Pin: "e".repeat(64), Tool: "c".repeat(40), Date: "2026-11-20" }, ["- ont-check · pass", "- suite unit · pass"]));
  commitAll(repo, "a record whose pin hash is wrong");
  assert.match(problems(repo).join("\n"), /the pin's hash is not the hash/);
  const v = product(repo, "--verify", "1.0.0");
  assert.equal(v.status, 1, v.stdout);
  assert.match(v.stdout, /^ERROR · release 1\.0\.0 is not intact, so it is not run:\n  1\.0\.0\.md: the pin's hash is not the hash of tools\/ont-check\/upstream\.json at commit [0-9a-f]{7}/);
  assert.doesNotMatch(v.stdout, /VERIFIED/);
});

test("[check.product-release.broken] a pin of another commit, a commit the project lacks, and checks not of the configuration at the commit are errors", () => {
  const { repo, first } = productRepo();
  const pinAtFirst = sha256(readFileSync(join(repo, "tools", "ont-check", "upstream.json")));
  writeFileSync(join(repo, "tools", "ont-check", "upstream.json"), JSON.stringify({ protocol: "v0.3.0", commit: "d".repeat(40), files: {} }));
  const second = commitAll(repo, "a new pin");
  const pinNow = sha256(readFileSync(join(repo, "tools", "ont-check", "upstream.json")));
  mkdirSync(join(repo, "releases"));
  const ok = ["- ont-check · pass", "- suite unit · pass"];
  const base = { Tool: "c".repeat(40), Date: "2026-11-20" };
  writeFileSync(join(repo, "releases", "1.0.0.md"), recordText({ Version: "1.0.0", Commit: first, Pin: pinNow, ...base }, ok));
  writeFileSync(join(repo, "releases", "1.1.0.md"), recordText({ Version: "1.1.0", Commit: "e".repeat(40), Pin: pinNow, ...base }, ok));
  writeFileSync(join(repo, "releases", "1.2.0.md"), recordText({ Version: "1.2.0", Commit: second, Pin: pinNow, ...base, Tool: "d".repeat(40) }, ["- ont-check · pass"]));
  writeFileSync(join(repo, "releases", "1.3.0.md"), recordText({ Version: "1.3.0", Commit: first, Pin: pinAtFirst, ...base }, ok));
  const p = problems(repo).join("\n");
  assert.match(p, /1\.0\.0\.md: the pin's hash is not the hash of tools\/ont-check\/upstream\.json at commit/);
  assert.match(p, /1\.1\.0\.md: commit eeeeeee is not in the project's history/);
  assert.match(p, /1\.2\.0\.md: the checks ont-check are not the ones the configuration at [0-9a-f]{7} requires, ont-check, suite unit/);
  assert.doesNotMatch(p, /1\.3\.0/);
  const c = checkProduct(repo);
  assert.equal(c.status, 1);
  assert.match(c.stdout, /records of releases and deployments that do not hold \(3\)/);
});

test("[check.product-release.suites-changed-later] a suite added to the configuration later leaves an earlier release intact", () => {
  const { repo } = productRepo();
  assert.equal(product(repo, "--product", "1.0.0").status, 0);
  commitAll(repo, "the release 1.0.0");
  const cfg = JSON.parse(readFileSync(join(repo, "ont.config.json"), "utf8"));
  cfg.testSuites.push({ name: "e2e", dir: "e2e", match: "\\.test\\.mjs$", cover: [] });
  writeFileSync(join(repo, "ont.config.json"), JSON.stringify(cfg, null, 2));
  mkdirSync(join(repo, "e2e"));
  writeFileSync(join(repo, "e2e", "b.test.mjs"), 'import { test } from "node:test";\ntest("b", () => {});\n');
  commitAll(repo, "a second suite");
  assert.deepEqual(problems(repo), []);
  assert.equal(product(repo, "--product", "1.1.0").status, 0);
  assert.match(readFileSync(join(repo, "releases", "1.1.0.md"), "utf8"), /- ont-check · pass\n- suite unit · pass\n- suite e2e · pass/);
});

test("[check.deployment.unknown-release] a deployment of a release with no record is an error", () => {
  const { repo } = productRepo();
  mkdirSync(join(repo, "releases"));
  writeFileSync(join(repo, "releases", "deploy-1.md"), "Release: 9.9.9\nEnvironment: production\nTime: 2026-11-20T10:00:00Z\n");
  assert.deepEqual(problems(repo), ["deploy-1.md: a deployment of 9.9.9, which has no record of a release"]);
  assert.equal(checkProduct(repo).status, 1);
});

test("[check.deployment.running-now] the latest deployment in an environment is what runs there, and a project without deployments says nothing of them", () => {
  const { repo } = productRepo();
  assert.equal(product(repo, "--product", "1.0.0").status, 0);
  assert.doesNotMatch(checkProduct(repo, "--releases").stdout, /RUNNING/);
  assert.match(checkProduct(repo, "--releases").stdout, /RELEASE 1\.0\.0 · [0-9a-f]{7} · \d{4}-\d{2}-\d{2} · ont-check pass, suite unit pass/);
  writeFileSync(join(repo, "releases", "1.1.0.md"), readFileSync(join(repo, "releases", "1.0.0.md"), "utf8").replace("Version: 1.0.0", "Version: 1.1.0"));
  writeFileSync(join(repo, "releases", "deploy-b.md"), "Release: 1.1.0\nEnvironment: production\nTime: 2026-11-20T11:00:00Z\n");
  writeFileSync(join(repo, "releases", "deploy-a.md"), "Release: 1.0.0\nEnvironment: production\nTime: 2026-11-20T10:00:00Z\n");
  writeFileSync(join(repo, "releases", "deploy-c.md"), "Release: 1.0.0\nEnvironment: staging\nTime: 2026-11-20T12:00:00Z\n");
  const out = checkProduct(repo, "--releases");
  assert.equal(out.status, 0, out.stdout);
  assert.match(out.stdout, /RUNNING production: 1\.1\.0, since 2026-11-20T11:00:00Z/);
  assert.match(out.stdout, /RUNNING staging: 1\.0\.0, since 2026-11-20T12:00:00Z/);
  const { deployments } = parseProductRecords(join(repo, "releases"));
  assert.equal(runningNow(deployments).get("production").release, "1.1.0");
});

test("[check.protocol-release.docs-not-open] the limitations do not keep versions as an open question, and point to the releases of the lifecycle", () => {
  const DOCS = fileURLToPath(new URL("../../../docs/", import.meta.url));
  const page = readFileSync(join(DOCS, "limitations.md"), "utf8");
  const open = page.slice(page.indexOf("## Open questions"), page.indexOf("\n## ", page.indexOf("## Open questions") + 1));
  const questions = open.split("\n").filter((l) => l.startsWith("- "));
  assert.ok(questions.length > 0);
  assert.deepEqual(questions.filter((q) => /version|release/i.test(q)), []);
  assert.match(open, /\]\(lifecycle\.md#releases-of-the-approach\)/);
  assert.match(open, /\]\(lifecycle\.md#releases-of-the-product\)/);
  const lifecycle = readFileSync(join(DOCS, "lifecycle.md"), "utf8");
  assert.match(lifecycle, /^## Releases of the approach$/m);
  assert.match(lifecycle, /^## Releases of the product$/m);
});

// Round 3 of the review of the result of task releases-and-task (D-126, D-127).
test("[check.protocol-release.entry-counted] a release commit that adds its entry and a second copy of an earlier one is refused by the check and by the news alike", () => {
  const { repo, first } = approachRepo();
  addEntry(repo, "D-02");
  assert.equal(release(repo, "0.2.0").status, 0);
  const v3 = addEntry(repo, "D-03");
  const log = readFileSync(join(repo, "releases.md"), "utf8");
  const v2entry = log.slice(log.indexOf("## v0.2.0"));
  writeFileSync(join(repo, "releases.md"), `${log.replace(/\n*$/, "\n\n")}${v2entry.replace(/\n*$/, "\n\n")}## v0.3.0 · 2026-11-20\n\n- Verified: ${v3}\n`);
  const c3 = commitAll(repo, "v0.3.0 and a second v0.2.0");
  assert.equal(git(repo, "rev-parse", `${c3}^`), v3);
  git(repo, "tag", "-a", "v0.3.0", c3, "-m", "v0.3.0");
  const p = protocolReleaseProblems(repo).problems;
  assert.ok(p.some((x) => /^v0\.3\.0: the release commit [0-9a-f]{7} adds the entry of v0\.2\.0 verified on [0-9a-f]{7}, the entry of v0\.3\.0 verified on [0-9a-f]{7}, not exactly the entry of v0\.3\.0/.test(x)), p.join("\n"));
  assert.equal(releaseTag(repo, "v0.3.0").entry, null);
  const news = releaseNews({ clone: repo, pinCommit: first, used: new Set() });
  assert.ok(news.some((l) => /^the releases of the approach clone are not known in full: tag v0\.3\.0: /.test(l)), news.join("\n"));
  assert.ok(!news.some((l) => /^version 0\.3\.0 was released/.test(l)), news.join("\n"));
});

test("[check.product-release.verify-whole-version] a second record of a version and a skipped ont-check are refused by the check, and --verify refuses them before it runs anything", () => {
  const { repo } = productRepo();
  assert.equal(product(repo, "--product", "1.0.0").status, 0);
  const record = readFileSync(join(repo, "releases", "1.0.0.md"), "utf8");
  writeFileSync(join(repo, "releases", "duplicate.md"), record);
  const { malformed } = parseProductRecords(join(repo, "releases"));
  assert.deepEqual(malformed, ["duplicate.md: a record of release 1.0.0 is named 1.0.0.md, not duplicate.md"]);
  const c = checkProduct(repo);
  assert.equal(c.status, 1, c.stdout);
  assert.doesNotMatch(c.stdout, /ONT_OK/);
  const v = product(repo, "--verify", "1.0.0");
  assert.equal(v.status, 1, v.stdout);
  assert.match(v.stdout, /^ERROR · release 1\.0\.0 is not intact, so it is not run:\n  duplicate\.md: a record of release 1\.0\.0 is named 1\.0\.0\.md/);
  assert.doesNotMatch(v.stdout, /VERIFIED/);
  // Alone, a record whose check ont-check is skipped: only a test suite is skipped.
  rmSync(join(repo, "releases", "duplicate.md"));
  writeFileSync(join(repo, "releases", "1.0.0.md"), record.replace("- ont-check · pass", "- ont-check · skipped · 1 of 1 tests skipped"));
  assert.match(problems(repo).join("\n"), /1\.0\.0\.md: ont-check · skipped: only a test suite is skipped or not run, the check passes or fails/);
  const s = product(repo, "--verify", "1.0.0");
  assert.equal(s.status, 1, s.stdout);
  assert.match(s.stdout, /^ERROR · release 1\.0\.0 is not intact, so it is not run:\n  1\.0\.0\.md: ont-check · skipped/);
  assert.doesNotMatch(s.stdout, /VERIFIED/);
});

test("[check.product-release.never-overwritten] a deployment in a file named as a release is refused, and a release never writes over it", () => {
  const { repo } = productRepo();
  assert.equal(product(repo, "--product", "1.0.0").status, 0);
  const deployment = "Release: 1.0.0\nEnvironment: production\nTime: 2026-11-20T10:00:00Z\n";
  writeFileSync(join(repo, "releases", "1.0.1.md"), deployment);
  assert.deepEqual(parseProductRecords(join(repo, "releases")).malformed, ["1.0.1.md: a deployment is named 1.0.1.md, the name of a record of release 1.0.1"]);
  assert.equal(checkProduct(repo).status, 1);
  const r = product(repo, "--product", "1.0.1");
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /^ERROR · release 1\.0\.1 has a record already that cannot be read, 1\.0\.1\.md/);
  assert.equal(readFileSync(join(repo, "releases", "1.0.1.md"), "utf8"), deployment);
  // A file of the version's name that is neither kind is left as it was too.
  writeFileSync(join(repo, "releases", "1.0.1.md"), "notes\n");
  assert.equal(product(repo, "--product", "1.0.1").status, 1);
  assert.equal(readFileSync(join(repo, "releases", "1.0.1.md"), "utf8"), "notes\n");
});

// Round 4 of the review of the result of task releases-and-task (D-140 to D-143).
test("[check.protocol-release.entry-strict] a release commit that adds a second line Verified: to an earlier entry is refused by the check and the news, and an entry is read strictly", () => {
  const { repo, first } = approachRepo();
  addEntry(repo, "D-02");
  assert.equal(release(repo, "0.2.0").status, 0);
  assert.deepEqual(protocolReleaseProblems(repo).problems, []);
  const v3 = addEntry(repo, "D-03");
  const log = readFileSync(join(repo, "releases.md"), "utf8");
  writeFileSync(join(repo, "releases.md"), `${log.replace(/\n*$/, "\n\n")}- Verified: ${v3}\n\n## v0.3.0 · 2026-11-20\n\n- Verified: ${v3}\n`);
  const c3 = commitAll(repo, "v0.3.0 and a second line in v0.2.0");
  git(repo, "tag", "-a", "v0.3.0", c3, "-m", "v0.3.0");
  const p = protocolReleaseProblems(repo).problems.join("\n");
  assert.match(p, /## v0\.2\.0 · \d{4}-\d{2}-\d{2}: the line - Verified: is given 2 times/);
  assert.match(p, /v0\.3\.0: the release commit [0-9a-f]{7} has entries that cannot be read/);
  assert.equal(releaseTag(repo, "v0.3.0").entry, null);
  const news = releaseNews({ clone: repo, pinCommit: first, used: new Set() });
  assert.ok(news.some((l) => /^the releases of the approach clone are not known in full: tag v0\.3\.0: /.test(l)), news.join("\n"));
  assert.ok(!news.some((l) => /^version 0\.3\.0 was released/.test(l)), news.join("\n"));
  // A line of another kind in an entry, and other spacing, make it an entry that cannot be read.
  const { malformed } = parseReleasesFile(`# Releases\n\n## v0.2.0 · 2026-11-20\n\n- Verified: ${v3}\n- Note: x\n\n## v0.4.0 · 2026-11-20\n- Verified: ${v3}\n`);
  assert.match(malformed[0], /a line that is no field of an entry: "- Note: x"/);
  assert.match(malformed[1], /not written as the release action writes it/);
});

test("[check.task-result.commits-resolve] an entry of releases.md whose verified commit is not in the repository is an error", () => {
  const { repo } = approachRepo();
  writeFileSync(join(repo, "releases.md"), `# Releases\n\n## v0.2.0 · 2026-11-20\n\n- Verified: ${"1".repeat(40)}\n`);
  commitAll(repo, "an entry of a commit the repository does not have");
  assert.deepEqual(protocolReleaseProblems(repo).problems, [`v0.2.0: the verified commit ${"1".repeat(40)} is not in the repository`]);
  assert.equal(check(repo).status, 1);
});

test("[check.product-release.tool-derived] Tool: is the version of the tool the commit's pin names, compared by the check, and --verify says what it ran with", () => {
  const { repo, first } = productRepo();
  assert.equal(product(repo, "--product", "1.0.0").status, 0);
  commitAll(repo, "the release 1.0.0");
  assert.deepEqual(problems(repo), []);
  const v = product(repo, "--verify", "1.0.0");
  assert.equal(v.status, 0, v.stdout);
  assert.match(v.stdout, new RegExp(`VERIFIED 1\\.0\\.0: .* on ${first.slice(0, 7)}; with the tool tools/ont-check/ont-check\\.mjs of commit ${first.slice(0, 7)}, version cccccccccccc`));
  const text = readFileSync(join(repo, "releases", "1.0.0.md"), "utf8");
  // Text that is not a commit cannot be read; another commit is not intact. --verify runs neither.
  for (const [tool, why] of [["any text", /tool any text is not a full commit/], ["e".repeat(40), /the tool e{40} is not the version of the tool at commit [0-9a-f]{7}, c{40}/]]) {
    writeFileSync(join(repo, "releases", "1.0.0.md"), text.replace(/^Tool: .*$/m, `Tool: ${tool}`));
    const { releases, deployments, malformed } = parseProductRecords(join(repo, "releases"));
    assert.match([...malformed, ...productReleaseProblems({ top: repo, cfgRel: "ont.config.json", releases, deployments })].join("\n"), why);
    const r = product(repo, "--verify", "1.0.0");
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /^ERROR · release 1\.0\.0 is not intact, so it is not run/);
    assert.doesNotMatch(r.stdout, /VERIFIED/);
    assert.equal(checkProduct(repo).status, 1);
  }
});

test("[check.product-release.verify-moved-tool] --verify reruns with the tool at its path in the release's commit, and a commit without its tool cannot be rerun, which it says", () => {
  const { repo, first } = productRepo();
  assert.equal(product(repo, "--product", "1.0.0").status, 0);
  commitAll(repo, "the release 1.0.0");
  mkdirSync(join(repo, "moved"));
  git(repo, "mv", "tools/ont-check", "moved/ont-check");
  const cfg = JSON.parse(readFileSync(join(repo, "ont.config.json"), "utf8"));
  writeFileSync(join(repo, "ont.config.json"), JSON.stringify({ ...cfg, releases: { ...cfg.releases, pin: "moved/ont-check/upstream.json", tool: "moved/ont-check" } }, null, 2));
  commitAll(repo, "the tool moved");
  const moved = node(repo, join(repo, "moved", "ont-check", "release.mjs"), "--config", join(repo, "ont.config.json"), "--verify", "1.0.0");
  assert.equal(moved.status, 0, moved.stdout + moved.stderr);
  assert.match(moved.stdout, new RegExp(`VERIFIED 1\\.0\\.0: ont-check · pass, suite unit · pass on ${first.slice(0, 7)}; with the tool tools/ont-check/ont-check\\.mjs of commit ${first.slice(0, 7)}`));
  // A commit whose configuration names a tool's directory it does not have.
  const { repo: other } = productRepo();
  const c = JSON.parse(readFileSync(join(other, "ont.config.json"), "utf8"));
  writeFileSync(join(other, "ont.config.json"), JSON.stringify({ ...c, releases: { ...c.releases, tool: "nowhere" } }, null, 2));
  const commit = commitAll(other, "the tool named where it is not");
  mkdirSync(join(other, "releases"));
  const pin = sha256(readFileSync(join(other, "tools", "ont-check", "upstream.json")));
  writeFileSync(join(other, "releases", "1.0.0.md"), recordText({ Version: "1.0.0", Commit: commit, Pin: pin, Tool: "c".repeat(40), Date: "2026-11-20" }, ["- ont-check · pass", "- suite unit · pass"]));
  commitAll(other, "a record by hand");
  const r = product(other, "--verify", "1.0.0");
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^ERROR · release 1\.0\.0 cannot be rerun on [0-9a-f]{7}: the tool nowhere\/ont-check\.mjs is not at commit [0-9a-f]{7}/);
  assert.doesNotMatch(r.stdout + r.stderr, /MODULE_NOT_FOUND|Cannot find module|VERIFIED/);
});

// Round 5 of the review of the result of task releases-and-task (D-146).
test("[check.product-release.root-suite] a suite whose directory is the root, given as . or as the empty path, is released and verified, and one path function reads the pin, the tool and each suite", () => {
  for (const dir of [".", ""]) {
    const { repo } = productRepo();
    const cfg = JSON.parse(readFileSync(join(repo, "ont.config.json"), "utf8"));
    writeFileSync(join(repo, "ont.config.json"), JSON.stringify({ ...cfg, testSuites: [{ name: "unit", dir, match: "a\\.test\\.mjs$", cover: [] }] }, null, 2));
    const commit = commitAll(repo, `a suite at the root, "${dir}"`);
    const ok = checkProduct(repo);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    const r = product(repo, "--product", "1.0.1");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.doesNotMatch(r.stdout, /is not at commit/);
    assert.match(readFileSync(join(repo, "releases", "1.0.1.md"), "utf8"), new RegExp(`Commit: ${commit}\\n[\\s\\S]*- suite unit · pass\\n$`));
    commitAll(repo, "the release 1.0.1");
    assert.deepEqual(problems(repo), []);
    const v = product(repo, "--verify", "1.0.1");
    assert.equal(v.status, 0, v.stdout + v.stderr);
    assert.match(v.stdout, /VERIFIED 1\.0\.1: ont-check · pass, suite unit · pass/);
  }
  // The one path function: the root is "", a path that leaves the repository is none.
  assert.equal(repoPath(".", "."), "");
  assert.equal(repoPath(".", ""), "");
  assert.equal(repoPath("", undefined), "");
  assert.equal(repoPath("sub", ".."), "");
  assert.equal(repoPath(".", "tests/"), "tests");
  assert.equal(repoPath("sub", "../.."), null);
});

// Round 6 of the review of the result of task releases-and-task (D-149).
test("[check.product-release.pin-is-file] a pin that names a directory is refused by --product, the check and --verify, and every file a release reads at a commit is read only as a file", () => {
  const { repo } = productRepo();
  const cfg = JSON.parse(readFileSync(join(repo, "ont.config.json"), "utf8"));
  writeFileSync(join(repo, "ont.config.json"), JSON.stringify({ ...cfg, releases: { ...cfg.releases, pin: "tools/ont-check", tool: "tools/ont-check" } }, null, 2));
  const commit = commitAll(repo, "the pin names the tool's directory");
  const r = product(repo, "--product", "1.0.1");
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, new RegExp(`^ERROR · the pin tools/ont-check is a directory, not a file at commit ${commit.slice(0, 7)}; no record written`));
  assert.doesNotMatch(r.stdout, /RELEASED/);
  // A record written by hand with the hash of Git's listing of the directory, as the release hashed it before.
  const listing = spawnSync("git", ["-C", repo, "show", `${commit}:tools/ont-check`], { env: ENV }).stdout;
  mkdirSync(join(repo, "releases"), { recursive: true });
  writeFileSync(join(repo, "releases", "1.0.1.md"), recordText({ Version: "1.0.1", Commit: commit, Pin: sha256(listing), Tool: commit, Date: "2026-11-20" }, ["- ont-check · pass", "- suite unit · pass"]));
  commitAll(repo, "a record of the listing");
  assert.match(problems(repo).join("\n"), new RegExp(`1\\.0\\.1\\.md: the pin tools/ont-check is a directory, not a file at commit ${commit.slice(0, 7)}`));
  const c = checkProduct(repo);
  assert.equal(c.status, 1, c.stdout);
  assert.match(c.stdout, /records of releases and deployments that do not hold \(1\)/);
  const v = product(repo, "--verify", "1.0.1");
  assert.equal(v.status, 1, v.stdout);
  assert.match(v.stdout, /^ERROR · release 1\.0\.1 is not intact, so it is not run:\n  1\.0\.1\.md: the pin tools\/ont-check is a directory, not a file/);
  assert.doesNotMatch(v.stdout, /VERIFIED/);
  // The one function every file is read through: a file gives its bytes, a directory and nothing give none.
  assert.equal(kindAt(repo, commit, "tools/ont-check"), "tree");
  assert.equal(blobAt(repo, commit, "tools/ont-check").bytes, null);
  assert.equal(blobAt(repo, commit, "tools/ont-check").kind, "tree");
  assert.equal(blobAt(repo, commit, "nothing-here").kind, null);
  assert.equal(blobAt(repo, commit, "ont.config.json").bytes.toString("utf8"), readFileSync(join(repo, "ont.config.json"), "utf8"));
  // releases.md and decisions.md of the protocol, a directory of that name: no file.
  mkdirSync(join(repo, "releases.md"));
  writeFileSync(join(repo, "releases.md", "x"), "x");
  const dirCommit = commitAll(repo, "a directory named releases.md");
  assert.equal(fileAt(repo, dirCommit), null);
});
