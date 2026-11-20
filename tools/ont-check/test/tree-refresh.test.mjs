// The tree kept current by the protocol (D-105): a temporary copy of this repository with its hooks
// enabled by core.hooksPath, real merges and pulls, and a place outside the repository, never the page a
// clone of this machine serves.
// ont: rule.tree-refreshed-after-merge, field.ontology-tree.place, field.ontology-tree.built-from, derived.tree-stale
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const TMP = [];
const temp = (prefix) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  TMP.push(dir);
  return dir;
};
process.on("exit", () => TMP.forEach((d) => rmSync(d, { recursive: true, force: true })));

// Git as a fresh clone sees it: no global or system configuration, and none of the variables a hook
// that runs these tests could have set for this repository.
const ENV = {
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_"))),
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.org",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.org",
  GIT_EDITOR: "true",
};
const sh = (cwd, cmd, args) => {
  const r = spawnSync(cmd, args, { cwd, env: ENV, encoding: "utf8" });
  return { code: r.status, out: r.stdout + r.stderr, stdout: r.stdout };
};

// A clone of a copy of this repository's files: one commit on main, the post-merge hook enabled the way
// the project enables its hooks, and a place for the tree in a directory of its own.
const repo = () => {
  const dir = temp("ont-refresh-");
  cpSync(REPO, dir, { recursive: true, filter: (src) => !/^(\.git|node_modules)(\/|$)/.test(relative(REPO, src)) });
  // The pre-commit hook runs the whole check on every commit; it is not what these tests are about.
  rmSync(join(dir, ".githooks/pre-commit"), { force: true });
  const r = clone(dir);
  r.git("init", "-q", "-b", "main");
  r.git("config", "core.hooksPath", ".githooks");
  r.git("add", "-A");
  r.git("commit", "-q", "-m", "start");
  return r;
};
const clone = (dir) => {
  const place = join(temp("ont-place-"), "tree.html");
  const git = (...args) => {
    const r = sh(dir, "git", args);
    if (!["merge", "pull", "diff"].includes(args[0])) assert.equal(r.code, 0, `git ${args.join(" ")}\n${r.out}`);
    return r;
  };
  const gen = (...args) => sh(dir, "node", [join(dir, "tools/ont-check/gen-tree.mjs"), ...args]);
  const edit = (file, from, to) => {
    const path = join(dir, file);
    const text = readFileSync(path, "utf8");
    assert.ok(text.includes(from), `fixture text not found in ${file}: ${from}`);
    writeFileSync(path, text.replace(from, to));
  };
  const commit = (file, from, to, message = `edit ${file}`) => {
    edit(file, from, to);
    git("commit", "-q", "-am", message);
    return git("rev-parse", "HEAD").out.trim();
  };
  const sha = (ref) => git("rev-parse", "--verify", ref).out.trim();
  const mark = () => {
    if (!existsSync(place)) return null;
    const m = readFileSync(place, "utf8").match(/<footer class="built" data-commit="([^"]*)"(?: data-config="([^"]*)")?/);
    return m && { commit: m[1], config: m[2] ?? null };
  };
  const setPlace = () => git("config", "--local", "ont.treeOut", place);
  return { dir, place, git, gen, edit, commit, sha, mark, setPlace };
};
// A branch b with one commit that changes no input of the tree, made from main and left for a merge.
const branch = (r, name = "b") => {
  r.git("checkout", "-q", "-b", name);
  r.commit("README.md", "# Ontology as Specification", "# Ontology as Specification\n", `on ${name}`);
  r.git("checkout", "-q", "main");
};

test("[check.ontology-tree.refreshed-on-main] the first merge into main after the place is set writes the page, and so does a pull --ff-only", () => {
  const r = repo();
  r.setPlace();
  branch(r);
  assert.equal(r.mark(), null);
  const m = r.git("merge", "-q", "b");
  assert.equal(m.code, 0, m.out);
  assert.match(m.out, /built from [0-9a-f]{40}/);
  assert.deepEqual(r.mark(), { commit: r.sha("refs/heads/main"), config: "ont.config.json" });
  assert.equal(r.sha("refs/heads/main"), r.sha("b"), "the merge was a fast-forward");

  // A clone that follows main of a remote: a new commit there, and the pull writes the page again.
  const c = clone(temp("ont-clone-"));
  assert.equal(sh(c.dir, "git", ["clone", "-q", r.dir, "."]).code, 0);
  c.git("config", "core.hooksPath", ".githooks");
  c.setPlace();
  const old = c.sha("refs/heads/main");
  const fresh = r.commit("README.md", "# Ontology as Specification", "# Ontology as Specification\n\n", "on the remote");
  const p = c.git("pull", "--ff-only");
  assert.equal(p.code, 0, p.out);
  assert.notEqual(fresh, old);
  assert.deepEqual(c.mark(), { commit: fresh, config: "ont.config.json" });
  assert.equal(c.gen("--stale").out, "");
});

test("[check.ontology-tree.refresh-skipped] another branch, no place, or a squash merge writes no page", () => {
  const r = repo();
  r.setPlace();
  r.git("checkout", "-q", "-b", "x");
  branch(r, "y");
  r.git("checkout", "-q", "x");
  const other = r.git("merge", "-q", "y");
  assert.equal(other.code, 0, other.out);
  assert.doesNotMatch(other.out, /tree/);
  assert.equal(existsSync(r.place), false, "a merge into another branch");

  r.git("checkout", "-q", "main");
  r.git("config", "--local", "--unset", "ont.treeOut");
  const none = r.git("merge", "-q", "y");
  assert.equal(none.code, 0, none.out);
  assert.doesNotMatch(none.out, /tree/);
  assert.equal(existsSync(r.place), false, "a merge into main without a place");

  r.setPlace();
  branch(r, "z");
  const squash = r.git("merge", "--squash", "z");
  assert.equal(squash.code, 0, squash.out);
  assert.match(squash.out, /tree: not written to .*tree\.html: a squash merge leaves main where it was/);
  assert.equal(existsSync(r.place), false, "a squash merge");
});

test("[check.ontology-tree.dirty-inputs] an uncommitted change of the ontology, or of ont.config.json, stops the hook, which names the file", () => {
  for (const [file, from, to] of [
    ["ontology.md", "# Ontology as Specification", "# Ontology as Specification, changed"],
    ["ont.config.json", '"ontology": "ontology.md",', '"ontology":  "ontology.md",'],
  ]) {
    const r = repo();
    r.setPlace();
    branch(r);
    r.edit(file, from, to);
    const m = r.git("merge", "-q", "b");
    assert.equal(m.code, 0, m.out);
    assert.match(m.out, new RegExp(`tree: not written to .*: these files differ from HEAD .*: ${file.replace(".", "\\.")}\n`));
    assert.equal(existsSync(r.place), false, file);
  }
});

test("[check.ontology-tree.place-inside-refused] a place inside the repository, or a link to one of its files, is refused; a place outside it is written", () => {
  const r = repo();
  const before = (file) => readFileSync(join(r.dir, file), "utf8");
  const ontology = before("ontology.md");
  // A relative place is taken from the root: here, the ontology itself.
  r.git("config", "--local", "ont.treeOut", "ontology.md");
  branch(r, "b1");
  const own = r.git("merge", "-q", "b1");
  assert.equal(own.code, 0, own.out);
  assert.match(own.out, /tree: not written to .*ontology\.md: it is inside the repository, at .*, where the page would overwrite its files/);
  assert.equal(before("ontology.md"), ontology);

  // A link outside the repository to a tracked file, and a dangling link to a file not yet there.
  const outside = temp("ont-links-");
  const readme = before("README.md");
  symlinkSync(join(r.dir, "README.md"), join(outside, "to-readme.html"));
  symlinkSync(join(r.dir, "docs", "new-tree.html"), join(outside, "dangling.html"));
  for (const [link, name] of [["to-readme.html", "b2"], ["dangling.html", "b3"]]) {
    r.git("config", "--local", "ont.treeOut", join(outside, link));
    const readmeNow = before("README.md");
    branch(r, name);
    const m = r.git("merge", "-q", name);
    assert.equal(m.code, 0, m.out);
    assert.match(m.out, new RegExp(`tree: not written to .*${link.replace(".", "\\.")}: it is inside the repository`), link);
    assert.notEqual(before("README.md"), readme, "the merge itself is done");
    assert.ok(!before("README.md").includes("<!doctype html>"), link);
    assert.ok(before("README.md").startsWith(readmeNow.slice(0, 20)), link);
  }
  assert.equal(existsSync(join(r.dir, "docs", "new-tree.html")), false);

  // A place outside the repository is written.
  r.setPlace();
  branch(r, "b4");
  const ok = r.git("merge", "-q", "b4");
  assert.equal(ok.code, 0, ok.out);
  assert.deepEqual(r.mark(), { commit: r.sha("refs/heads/main"), config: "ont.config.json" });
});

test("[check.ontology-tree.mark] changed inputs, a symbolic link whose target changed, and a configuration outside Git are not clean", () => {
  // Inputs changed and not committed: the commit, marked +working-tree, and the stale report says so.
  const r = repo();
  r.setPlace();
  r.edit("ontology.md", "# Ontology as Specification", "# Ontology as Specification, changed");
  assert.equal(r.gen("--out", r.place).code, 0);
  assert.deepEqual(r.mark(), { commit: `${r.sha("HEAD")}+working-tree`, config: "ont.config.json" });
  const s = r.gen("--stale");
  assert.equal(s.code, 0);
  assert.match(s.out, /built from files that differ from commit [0-9a-f]{40} \(\+working-tree\)/);

  // A symbolic link committed as it is, whose target changed: git diff sees no change, the mark does.
  const l = repo();
  l.setPlace();
  cpSync(join(l.dir, "ontology.md"), join(l.dir, "real.md"));
  symlinkSync("real.md", join(l.dir, "link.md"));
  l.edit("ont.config.json", '"ontology": "ontology.md",', '"ontology": "link.md",');
  l.git("add", "-A");
  l.git("commit", "-q", "-m", "the ontology through a link");
  assert.equal(l.gen("--out", l.place).code, 0);
  assert.deepEqual(l.mark(), { commit: `${l.sha("HEAD")}+working-tree`, config: "ont.config.json" }, "a link is never the commit's file");
  l.edit("real.md", "# Ontology as Specification", "# Ontology as Specification, changed");
  assert.equal(l.git("diff", "--quiet", "--", "link.md").code, 0, "git diff does not see the target of a link");
  const out = l.gen("--out", l.place);
  assert.equal(out.code, 0, out.out);
  assert.deepEqual(l.mark(), { commit: `${l.sha("HEAD")}+working-tree`, config: "ont.config.json" });
  assert.match(l.gen("--stale").out, /\+working-tree/);

  // A configuration outside Git: no-commit, no configuration, and stale.
  const outside = temp("ont-outside-");
  cpSync(join(REPO, "example"), outside, { recursive: true });
  const o = r.gen("--config", join(outside, "ont.config.json"), "--out", r.place);
  assert.equal(o.code, 0, o.out);
  assert.deepEqual(r.mark(), { commit: "no-commit", config: null });
  assert.match(readFileSync(r.place, "utf8"), /<footer class="built" data-commit="no-commit" data-date="[^"]+">Built from no commit · /);
  assert.match(r.gen("--stale").out, /built outside Git \(no-commit\)/);
});

test("[check.ontology-tree.refresh-error] the generator refuses the committed ontology: the merge succeeds and the error is shown", () => {
  const r = repo();
  r.setPlace();
  r.git("checkout", "-q", "-b", "b");
  r.commit("ontology.md", "refs `ent.concept` | The definition rows the tree shows.", "refs `ent.absent`  | The definition rows the tree shows.");
  r.git("checkout", "-q", "main");
  const m = r.git("merge", "-q", "b");
  assert.equal(m.code, 0, m.out);
  assert.equal(r.sha("refs/heads/main"), r.sha("b"), "the merge is done");
  assert.match(m.out, /edge\.ontology-tree\.concepts: ent\.absent is not an entity of the glossary/);
  assert.match(m.out, /post-merge: the ontology tree was not written; the merge itself is done/);
  assert.equal(existsSync(r.place), false);
});

test("[check.ontology-tree.refresh-by-hand] a merge ended after a conflict leaves the page behind, the report says so, and --refresh rewrites it", () => {
  const origin = repo();
  const c = clone(temp("ont-clone-"));
  assert.equal(sh(c.dir, "git", ["clone", "-q", origin.dir, "."]).code, 0);
  c.git("config", "core.hooksPath", ".githooks");
  c.setPlace();
  assert.equal(c.gen("--refresh").code, 0);
  const old = c.sha("refs/heads/main");
  assert.deepEqual(c.mark(), { commit: old, config: "ont.config.json" });

  c.commit("README.md", "# Ontology as Specification", "# Ontology as Specification, here");
  origin.commit("README.md", "# Ontology as Specification", "# Ontology as Specification, there");
  const p = c.git("pull", "--no-rebase");
  assert.notEqual(p.code, 0, "the pull stops on the conflict");
  c.edit("README.md", /<<<<<<<[\s\S]*?>>>>>>> [^\n]*\n/.exec(readFileSync(join(c.dir, "README.md"), "utf8"))[0], "# Ontology as Specification, both\n");
  c.git("add", "README.md");
  const end = c.git("merge", "--continue");
  assert.equal(end.code, 0, end.out);
  const main = c.sha("refs/heads/main");
  assert.notEqual(main, old);
  assert.deepEqual(c.mark(), { commit: old, config: "ont.config.json" }, "git does not run post-merge after merge --continue");
  assert.match(c.gen("--stale").out, new RegExp(`built from ${old}, but main is ${main}`));

  const f = c.gen("--refresh");
  assert.equal(f.code, 0, f.out);
  assert.deepEqual(c.mark(), { commit: main, config: "ont.config.json" });
  assert.equal(c.gen("--stale").out, "");
});

test("[check.ontology-tree.stale] each reason is reported; a current page, compared with refs/heads/main, and no place are not", () => {
  const r = repo();
  r.setPlace();
  const stale = () => {
    const s = r.gen("--stale");
    assert.equal(s.code, 0, s.out);
    return s.out;
  };
  assert.match(stale(), /TREE_STALE .*tree\.html: the file does not exist\n/);
  writeFileSync(r.place, "<!doctype html><html><body>a tree</body></html>\n");
  assert.match(stale(), /: the page carries no mark of what it was built from\n/);

  const first = r.sha("refs/heads/main");
  assert.equal(r.gen("--refresh").code, 0);
  assert.equal(stale(), "", "a page of main");
  // The same page with a part of its mark taken away: the commit is main's, and still it is reported.
  const page = readFileSync(r.place, "utf8");
  for (const [attr, reason] of [
    ["config", "the mark names no configuration"],
    ["date", "the mark carries no date"],
    ["commit", "the mark names no commit"],
  ]) {
    const partial = page.replace(new RegExp(` data-${attr}="[^"]*"`), "");
    assert.notEqual(partial, page, attr);
    writeFileSync(r.place, partial);
    assert.match(stale(), new RegExp(`: ${reason}\n`), attr);
  }
  writeFileSync(r.place, page.replace(/ data-date="[^"]*"/, ' data-date=""'));
  assert.match(stale(), /: the mark carries no date\n/, "an empty date");
  writeFileSync(r.place, page);
  assert.equal(stale(), "");
  const second = r.commit("README.md", "# Ontology as Specification", "# Ontology as Specification\n");
  assert.match(stale(), new RegExp(`: built from ${first}, but main is ${second}\n`));

  // From the example's configuration on a clean main: every file it read is HEAD's, and still stale.
  const ex = r.gen("--config", "example/ont.config.json", "--out", r.place);
  assert.equal(ex.code, 0, ex.out);
  assert.deepEqual(r.mark(), { commit: second, config: "example/ont.config.json" });
  const other = stale();
  assert.match(other, /: built from another configuration, example\/ont\.config\.json, not the ont\.config\.json at the root\n/);
  assert.doesNotMatch(other, /but main is/);

  // A tag named main on the first commit: the short name would be the tag, the report takes the branch.
  r.git("tag", "main", first);
  assert.equal(r.git("rev-parse", "main").stdout.trim(), first, "the short name is the tag");
  assert.equal(r.gen("--refresh").code, 0);
  assert.deepEqual(r.mark(), { commit: second, config: "ont.config.json" });
  assert.equal(stale(), "");

  unlinkSync(r.place);
  r.git("config", "--local", "--unset", "ont.treeOut");
  assert.equal(stale(), "", "no place");
});
