// The tree kept current by the protocol (D-105): a temporary copy of this repository with its hooks
// enabled by core.hooksPath, real merges and pulls, and a place outside the repository, never the page a
// clone of this machine serves.
// ont: rule.tree-refreshed-after-merge, field.ontology-tree.place, field.ontology-tree.built-from, derived.tree-stale
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildTree, markOf } from "../gen-tree.mjs";

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
  // A command that waits for ever, as a read of a named pipe with no writer does, fails the test.
  const r = spawnSync(cmd, args, { cwd, env: ENV, encoding: "utf8", timeout: 120000 });
  if (r.error) return { code: null, out: `${cmd} ${args.join(" ")}: ${r.error.message}`, stdout: "" };
  return { code: r.status, out: r.stdout + r.stderr, stdout: r.stdout };
};

// A clone of a copy of this repository's files: one commit on main, the post-merge hook enabled the way
// the project enables its hooks, and a place for the tree in a directory of its own.
const repo = (prefix = "ont-refresh-") => {
  const dir = temp(prefix);
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
  // The mark of the page at the place, its commit and configuration; wherever a test reads it, the page
  // also carries a whole date, UTC to the second and a real day, so that no test of a written page
  // passes on a page whose date the stale report would refuse.
  const mark = () => {
    if (!existsSync(place)) return null;
    const html = readFileSync(place, "utf8");
    const m = html.match(/<footer class="built" data-commit="([^"]*)"(?: data-config="([^"]*)")?/);
    if (!m) return null;
    const d = (html.match(/<footer class="built"[^>]* data-date="([^"]*)"/) ?? [])[1];
    assert.match(d ?? "", /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/, `the date of the page at ${place}`);
    assert.equal(new Date(d).toISOString().replace(".000Z", "Z"), d, `a real date: ${d}`);
    return { commit: m[1], config: m[2] ?? null };
  };
  const date = () => (readFileSync(place, "utf8").match(/<footer class="built"[^>]* data-date="([^"]*)"/) ?? [])[1] ?? null;
  const setPlace = () => git("config", "--local", "ont.treeOut", place);
  return { dir, place, git, gen, edit, commit, sha, mark, date, setPlace };
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

  assert.match(r.date(), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);

  // A clone that follows main of a remote, with the page of its main already at the place: a new commit
  // there, and the pull writes that page again.
  const c = clone(temp("ont-clone-"));
  assert.equal(sh(c.dir, "git", ["clone", "-q", r.dir, "."]).code, 0);
  c.git("config", "core.hooksPath", ".githooks");
  c.setPlace();
  const old = c.sha("refs/heads/main");
  assert.equal(c.gen("--refresh").code, 0);
  assert.deepEqual(c.mark(), { commit: old, config: "ont.config.json" }, "the old page is in place");
  const page = readFileSync(c.place, "utf8");
  const fresh = r.commit("README.md", "# Ontology as Specification", "# Ontology as Specification\n\n", "on the remote");
  const p = c.git("pull", "--ff-only");
  assert.equal(p.code, 0, p.out);
  assert.match(p.out, new RegExp(`built from ${fresh}`));
  assert.notEqual(fresh, old);
  assert.notEqual(readFileSync(c.place, "utf8"), page, "the page is written again");
  assert.deepEqual(c.mark(), { commit: fresh, config: "ont.config.json" });
  assert.match(c.date(), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.equal(c.gen("--stale").out, "");

  // A clone whose path contains #, which a URL built from the path by hand reads as a fragment.
  const h = repo("ont-refresh-#-");
  assert.match(h.dir, /#/);
  h.setPlace();
  branch(h);
  const hm = h.git("merge", "-q", "b");
  assert.equal(hm.code, 0, hm.out);
  assert.match(hm.out, /built from [0-9a-f]{40}/);
  assert.deepEqual(h.mark(), { commit: h.sha("refs/heads/main"), config: "ont.config.json" });
  assert.equal(h.gen("--stale").out, "");

  // The same mistake anywhere in the tool: no script makes a file URL out of a path by hand.
  const tools = join(REPO, "tools/ont-check");
  for (const f of readdirSync(tools).filter((f) => f.endsWith(".mjs")))
    assert.doesNotMatch(readFileSync(join(tools, f), "utf8"), /new URL\(`file:\/\/\$\{|["'`]file:\/\/["'`]\s*\+/, f);
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

  // No place in the clone's own configuration, while the user's global one names a place: that one is
  // not the clone's, and the merge into main writes nothing there either.
  r.git("checkout", "-q", "main");
  r.git("config", "--local", "--unset", "ont.treeOut");
  const global = join(temp("ont-global-"), "global-tree.html");
  const gitconfig = join(temp("ont-gitconfig-"), "gitconfig");
  writeFileSync(gitconfig, `[ont]\n\ttreeOut = ${global}\n`);
  const env = { ...ENV, GIT_CONFIG_GLOBAL: gitconfig };
  const seen = spawnSync("git", ["config", "--get", "ont.treeOut"], { cwd: r.dir, env, encoding: "utf8" });
  assert.equal(seen.stdout.trim(), global, "the global configuration is read");
  const run = spawnSync("git", ["merge", "-q", "y"], { cwd: r.dir, env, encoding: "utf8" });
  const none = { code: run.status, out: run.stdout + run.stderr };
  assert.equal(none.code, 0, none.out);
  assert.doesNotMatch(none.out, /tree/);
  assert.equal(existsSync(r.place), false, "a merge into main without a place");
  assert.equal(existsSync(global), false, "the place of the global configuration");
  assert.equal(spawnSync("node", [join(r.dir, "tools/ont-check/gen-tree.mjs"), "--stale"], { cwd: r.dir, env, encoding: "utf8" }).stdout, "");

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

  // An input reached through a linked directory: the link points to the root, so the file read is the
  // commit's ontology.md, but the commit has no via/ontology.md, and the page is not clean.
  const d = repo();
  d.setPlace();
  symlinkSync(".", join(d.dir, "via"));
  d.edit("ont.config.json", '"ontology": "ontology.md",', '"ontology": "via/ontology.md",');
  d.git("add", "-A");
  d.git("commit", "-q", "-m", "the ontology through a linked directory");
  assert.equal(d.gen("--out", d.place).code, 0);
  assert.deepEqual(d.mark(), { commit: `${d.sha("HEAD")}+working-tree`, config: "ont.config.json" }, "a linked directory");
  assert.match(d.gen("--stale").out, /\+working-tree/);
  // A committed directory replaced, not yet committed, by a link to a copy of it: the commit holds
  // sub/ontology.md with the same bytes, but the path read passes through a link.
  const w = repo();
  w.setPlace();
  mkdirSync(join(w.dir, "sub"));
  cpSync(join(w.dir, "ontology.md"), join(w.dir, "sub", "ontology.md"));
  w.edit("ont.config.json", '"ontology": "ontology.md",', '"ontology": "sub/ontology.md",');
  w.git("add", "-A");
  w.git("commit", "-q", "-m", "the ontology in a directory");
  assert.equal(w.gen("--out", w.place).code, 0);
  assert.deepEqual(w.mark(), { commit: w.sha("HEAD"), config: "ont.config.json" }, "the directory as committed");
  renameSync(join(w.dir, "sub"), join(w.dir, "copy"));
  symlinkSync("copy", join(w.dir, "sub"));
  assert.equal(w.gen("--out", w.place).code, 0);
  assert.deepEqual(w.mark(), { commit: `${w.sha("HEAD")}+working-tree`, config: "ont.config.json" }, "the directory replaced by a link");

  // Paths through a linked directory followed by ..: via points to deep/inner, so via/.. is deep, while
  // the path normalised by hand is the root. The labels file read there has the bytes of the committed
  // labels.json at the root, and the ontology read there is another; neither is the commit's file at the
  // path asked for, and the ontology the page shows is the one read.
  const u = repo();
  u.setPlace();
  mkdirSync(join(u.dir, "deep", "inner"), { recursive: true });
  symlinkSync(join("deep", "inner"), join(u.dir, "via"));
  writeFileSync(join(u.dir, "labels.json"), "{}\n");
  writeFileSync(join(u.dir, "deep", "labels.json"), "{}\n");
  u.git("add", "-A");
  u.git("commit", "-q", "-m", "a labels file, and a link into a directory");
  assert.equal(u.gen("--labels", "labels.json", "--out", u.place).code, 0);
  assert.deepEqual(u.mark(), { commit: u.sha("HEAD"), config: "ont.config.json" }, "the labels file at the root");
  const ul = u.gen("--labels", `via${"/"}..${"/"}labels.json`, "--out", u.place);
  assert.equal(ul.code, 0, ul.out);
  assert.deepEqual(u.mark(), { commit: `${u.sha("HEAD")}+working-tree`, config: "ont.config.json" }, "a labels file through via/..");
  cpSync(join(u.dir, "ontology.md"), join(u.dir, "deep", "ontology.md"));
  u.edit("deep/ontology.md", "# Ontology as Specification", "# Ontology as Specification, read through via");
  u.edit("ont.config.json", '"ontology": "ontology.md",', '"ontology": "via/../ontology.md",');
  u.git("add", "-A");
  u.git("commit", "-q", "-m", "the ontology through via/..");
  const uo = u.gen("--out", u.place);
  assert.equal(uo.code, 0, uo.out);
  assert.match(readFileSync(u.place, "utf8"), /<h3>Ontology as Specification, read through via /, "the ontology read is the one at the path as given");
  assert.deepEqual(u.mark(), { commit: `${u.sha("HEAD")}+working-tree`, config: "ont.config.json" }, "an ontology through via/..");
  // And the configuration itself asked for through via/..: deep/ont.config.json, a copy of the root's.
  u.git("checkout", "-q", "HEAD~1", "--", "ont.config.json");
  u.git("commit", "-q", "-am", "the ontology at the root again");
  cpSync(join(u.dir, "ont.config.json"), join(u.dir, "deep", "ont.config.json"));
  for (const f of ["ontology.md", "example/ontology.md", "templates/ontology.md"]) {
    mkdirSync(join(u.dir, "deep", f, ".."), { recursive: true });
    cpSync(join(u.dir, f), join(u.dir, "deep", f));
  }
  const uc = u.gen("--config", `via${"/"}..${"/"}ont.config.json`, "--out", u.place);
  assert.equal(uc.code, 0, uc.out);
  assert.equal(u.mark().commit, `${u.sha("HEAD")}+working-tree`, "a configuration through via/..");

  // A committed ontology whose name begins with two dots lies inside the repository and is clean.
  const t = repo();
  t.setPlace();
  cpSync(join(t.dir, "ontology.md"), join(t.dir, "..ontology.md"));
  t.edit("ont.config.json", '"ontology": "ontology.md",', '"ontology": "..ontology.md",');
  t.git("add", "-A");
  t.git("commit", "-q", "-m", "the ontology named with two dots");
  assert.equal(t.gen("--out", t.place).code, 0);
  assert.deepEqual(t.mark(), { commit: t.sha("HEAD"), config: "ont.config.json" }, "..ontology.md");

  // HEAD moves to a new commit while the mark is made: the files read are compared with the commit the
  // mark names, which they are, not with the new HEAD, which changed the ontology.
  const h = repo();
  const built = buildTree(join(h.dir, "ont.config.json"));
  const first = h.sha("HEAD");
  let moved = null;
  const hm = markOf(built, { onHead: () => (moved = h.commit("ontology.md", "# Ontology as Specification", "# Ontology as Specification, moved")) });
  assert.notEqual(moved, first, "HEAD moved");
  assert.deepEqual(hm, { commit: first, config: "ont.config.json", dirty: [] });

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
  // A place that is a directory, a named pipe with no writer, or a device: each is reported as not a
  // regular file without being opened, and the report ends with 0 at once.
  mkdirSync(r.place);
  assert.match(stale(), /TREE_STALE .*tree\.html: the place is a directory, not a regular file\n/);
  rmSync(r.place, { recursive: true });
  assert.equal(sh(r.dir, "mkfifo", [r.place]).code, 0);
  assert.match(stale(), /TREE_STALE .*tree\.html: the place is a named pipe, not a regular file\n/);
  rmSync(r.place);
  r.git("config", "--local", "ont.treeOut", "/dev/null");
  assert.match(stale(), /TREE_STALE \/dev\/null: the place is a device, not a regular file\n/);
  r.setPlace();
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
  // A date that is not one, one of another form, and one of the right form that no calendar has.
  for (const date of ["not-a-date", "2026-11-20", "2026-11-20T09:30:00.000Z", "2026-13-40T25:61:61Z", "2026-02-30T00:00:00Z"]) {
    writeFileSync(r.place, page.replace(/ data-date="[^"]*"/, ` data-date="${date}"`));
    assert.match(stale(), new RegExp(`: the mark's date, ${date.replace(/\./g, "\\.")}, is not a date and time of the form 2026-11-20T09:30:00Z\n`), date);
  }
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

test("[field.ontology-tree.place] [rule.tree-refreshed-after-merge] every file the implementation table gives for a concept of the tree names it", () => {
  const md = readFileSync(join(REPO, "ontology.md"), "utf8");
  const table = md.slice(md.indexOf("## Implementation status"));
  const tree = /^(ent\.ontology-tree|edge\.ontology-tree\.|field\.ontology-tree\.|derived\.tree-|rule\.tree-|inv\.tree-)/;
  const rows = [...table.matchAll(/^\| `([a-z]+\.[^`]+)` \| ([^|]*) \|/gm)].filter((m) => tree.test(m[1]));
  assert.ok(rows.length >= 8, "the tree's rows of the implementation table");
  for (const [, id, cell] of rows)
    for (const [, file] of cell.matchAll(/`([^`]+)`/g)) {
      const names = [...readFileSync(join(REPO, file), "utf8").matchAll(/ont:([^\n]*)/g)].flatMap((m) => m[1].split(/[\s,]+/).map((x) => x.replace(/@.*$/, "")));
      assert.ok(names.includes(id), `${file} does not name ${id}`);
    }
});

test("[rule.tree-refreshed-after-merge] every page that tells of the hook names the merges it misses and the command after them, under an anchor of the refresh", () => {
  for (const file of ["docs/parts/documentation.md", "AGENTS.md", "tools/ont-check/README.md"]) {
    const text = readFileSync(join(REPO, file), "utf8");
    // The anchored sections that tell of the post-merge hook, each from its anchor to the next; the
    // usage lines above the first section only list the commands.
    const sections = text.split(/(?=^<!-- ont:[^\n]*-->\n#+ )/m).filter((x) => x.startsWith("<!-- ont:") && /post-merge/.test(x));
    assert.ok(sections.length, `${file} tells of the hook`);
    for (const section of sections) {
      const anchor = section.match(/^<!-- ont:([^\n]*)-->/)?.[1] ?? "";
      assert.match(anchor, /\brule\.tree-refreshed-after-merge\b/, `${file}: the anchor of the section`);
      assert.doesNotMatch(section, /every merge/, `${file} promises every merge`);
      assert.match(section, /git merge --continue/, `${file}: a merge ended after a conflict`);
      assert.match(section, /rebase/, `${file}: a rebase`);
      assert.match(section, /gen-tree\.mjs --refresh/, `${file}: the command after them`);
    }
  }
});

test("[rule.check-in-product-terms] the automatic checks of the tree say their cases without a command, a flag or a script", () => {
  const rows = readFileSync(join(REPO, "checks.md"), "utf8").split("\n").filter((l) => /^\| `check\.ontology-tree\.[^`]+` \|.*\| auto \|$/.test(l));
  assert.ok(rows.length >= 10, "the tree's automatic checks");
  for (const row of rows) {
    const [, id, , given, when, then] = row.split("|").map((c) => c.trim());
    const cases = [given, when, then].join(" | ");
    assert.doesNotMatch(cases, /`git [a-z]|(^|[\s`(])--[a-z]|\.mjs\b/, id);
  }
});
