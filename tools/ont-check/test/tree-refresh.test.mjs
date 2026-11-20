// The tree kept current by the protocol (D-105): a temporary copy of this repository with its hooks
// enabled by core.hooksPath, real merges and pulls, and a place outside the repository, never the page a
// clone of this machine serves.
// ont: rule.tree-refreshed-after-merge, field.ontology-tree.place, field.ontology-tree.built-from, derived.tree-stale
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, cpSync, existsSync, linkSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, renameSync, rmSync, statSync, symlinkSync, unlinkSync, lstatSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, sep } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildTree, markOf, readMark, workingTree } from "../gen-tree.mjs";

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
const sh = (cwd, cmd, args, timeout = 120000) => {
  // A command that waits for ever, as a read of a named pipe with no writer does, fails the test.
  const r = spawnSync(cmd, args, { cwd, env: ENV, encoding: "utf8", timeout });
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
  // The mark of the page at the place, its commit and configuration, read as the stale report reads it:
  // the footer last on the page. Wherever a test reads it, the page also carries a whole date, UTC to
  // the second and a real day, so that no test of a written page passes on a page whose date the stale
  // report would refuse; and wherever the mark is not clean, the stale report, run on the same place,
  // names it, so that no test makes such a page without asking the report (check.ontology-tree.mark).
  const mark = () => {
    if (!existsSync(place)) return null;
    const html = readFileSync(place, "utf8");
    const m = html.match(/\n<footer class="built" data-commit="([^"]*)"(?: data-config="([^"]*)")? data-date="([^"]*)" data-page="[0-9a-f]{64}">[^\n]*<\/footer>\n<\/body><\/html>\n$/);
    if (!m) return null;
    const d = m[3];
    assert.match(d, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/, `the date of the page at ${place}`);
    assert.equal(new Date(d).toISOString().replace(".000Z", "Z"), d, `a real date: ${d}`);
    if (m[1] === "no-commit" || m[1].endsWith("+working-tree")) {
      assert.equal(git("config", "--local", "ont.treeOut").out.trim(), place, "the stale report reads this page");
      const why = m[1] === "no-commit" ? "built outside Git (no-commit)" : `built from files that differ from commit ${m[1].replace(/\+working-tree$/, "")} (+working-tree)`;
      const s = gen("--stale");
      assert.equal(s.code, 0, s.out);
      assert.ok(s.out.includes(`TREE_STALE ${place}: ${why}\n`), `the stale report names the page marked ${m[1]}:\n${s.out}`);
    }
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

// The footer the generator writes for a mark, in its own words, with the SHA-256 of the bytes of the
// page before it, written out here rather than taken from the generator, so that a page whose footer's
// text and attributes disagree is made by hand, and a page changed before its footer can be given the
// hash computed again, as whoever forges a mark would (D-134).
const hashOf = (before, { commit, config, date }) =>
  createHash("sha256").update(Buffer.from(before, "utf8")).update(`\0${commit}\0${config ?? ""}\0${date}`).digest("hex");
const footerOf = ({ commit, config, date }, before) =>
  `<footer class="built" data-commit="${commit}"${config === undefined ? "" : ` data-config="${config}"`} data-date="${date}" data-page="${hashOf(before, { commit, config, date })}">Built from ${
    commit === "no-commit" ? "no commit" : `<code>${commit}</code>`
  }${config === undefined ? "" : ` · <code>${config}</code>`} · ${date}</footer>`;
const FOOTER = /<footer class="built"[^\n]*<\/footer>/;
const withFooter = (page, mark) => {
  assert.match(page, FOOTER, "the page has a footer to replace");
  return page.replace(FOOTER, (_, at) => footerOf(mark, page.slice(0, at)));
};
// A page whose footer, the generator's own at its end, is given the hash of what is before it.
const rehashed = (html) => {
  const at = html.lastIndexOf('<footer class="built"');
  const f = html.slice(at).match(/data-commit="([^"]*)"(?: data-config="([^"]*)")? data-date="([^"]*)"/);
  const fields = { commit: f[1], config: f[2], date: f[3] };
  return html.slice(0, at) + html.slice(at).replace(/ data-page="[0-9a-f]{64}"/, ` data-page="${hashOf(html.slice(0, at), fields)}"`);
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

test("[check.ontology-tree.dirty-inputs] a file of the tree changed, replaced by a link or a named pipe, or removed in the working tree: the hook writes nothing and names it", () => {
  const r = repo();
  r.setPlace();
  assert.equal(r.gen("--refresh").code, 0);
  const page = readFileSync(r.place);
  const title = "# Ontology as Specification";
  const inputs = ["ont.config.json", "ontology.md", "example/ontology.md", "templates/ontology.md"];
  const at = (f) => join(r.dir, f);
  const linkTo = (text) => () => {
    writeFileSync(at("other.md"), text);
    rmSync(at("ontology.md"));
    symlinkSync("other.md", at("ontology.md"));
  };
  const cases = [
    ["the ontology changed", ["ontology.md"], () => r.edit("ontology.md", title, `${title}, changed`)],
    ["the configuration changed", ["ont.config.json"], () => r.edit("ont.config.json", '"ontology": "ontology.md",', '"ontology": "example/ontology.md",')],
    ["the ontology replaced by a link to another text", ["ontology.md"], () => linkTo(readFileSync(at("ontology.md"), "utf8").replace(title, `${title}, through a link`))()],
    ["the ontology replaced by a link to the same text", ["ontology.md"], () => linkTo(readFileSync(at("ontology.md"), "utf8"))()],
    [
      "the ontology replaced by a named pipe with no writer",
      ["ontology.md"],
      () => {
        rmSync(at("ontology.md"));
        assert.equal(sh(r.dir, "mkfifo", [at("ontology.md")]).code, 0);
      },
    ],
    ["every input removed", inputs, () => inputs.forEach((f) => rmSync(at(f)))],
  ];
  cases.forEach(([what, named, change], k) => {
    branch(r, `b${k}`);
    change();
    // A hook that read the named pipe would wait for ever, and the merge with it; both end in time.
    const m = sh(r.dir, "git", ["merge", "-q", `b${k}`], 30000);
    assert.equal(m.code, 0, `${what}: ${m.out}`);
    assert.equal(r.sha("refs/heads/main"), r.sha(`b${k}`), `${what}: the merge is done`);
    const said = m.out.match(/tree: not written to (.*): the working tree differs from commit ([0-9a-f]{40}) at ([^;\n]*); the page there is kept/);
    assert.ok(said, `${what}: the merge says why it wrote nothing:\n${m.out}`);
    assert.equal(said[1], r.place, what);
    assert.equal(said[2], r.sha("refs/heads/main"), what);
    assert.deepEqual(said[3].split(", "), named, `${what}: the files named`);
    assert.doesNotMatch(m.out, /built from/, what);
    assert.ok(readFileSync(r.place).equals(page), `${what}: the page at the place keeps its bytes`);
    for (const f of [...inputs, "other.md"]) rmSync(at(f), { force: true });
    r.git("checkout", "-q", "--", ...inputs);
    assert.equal(r.git("status", "--porcelain").out, "", what);
  });
  // The working tree holds the committed files again: the next merge writes the commit's page.
  branch(r, "clean");
  const m = r.git("merge", "-q", "clean");
  assert.equal(m.code, 0, m.out);
  assert.match(m.out, /built from [0-9a-f]{40}\n/);
  assert.deepEqual(r.mark(), { commit: r.sha("refs/heads/main"), config: "ont.config.json" });
  assert.equal(r.gen("--stale").out, "");

  // The configuration, committed, names its ontology at detour/../ontology.md, with detour the committed
  // directory: the path as the configuration gives it has a .., so it is not the commit's file, though
  // the path normalised by hand is the committed ontology.md (D-134). Then detour is replaced, not
  // committed, by a link to a directory that holds another ontology, which the file system reaches at
  // that path: named too, and nothing of it reaches the page.
  const kept = readFileSync(r.place);
  mkdirSync(at("detour"));
  writeFileSync(at("detour/keep.md"), "a committed directory\n");
  r.edit("ont.config.json", '"ontology": "ontology.md",', '"ontology": "detour/../ontology.md",');
  r.git("add", "-A");
  r.git("commit", "-q", "-m", "the ontology through detour/..");
  for (const [what, change] of [
    ["through the committed directory", () => {}],
    [
      "through a link that leads to another ontology",
      () => {
        mkdirSync(at("elsewhere/inner"), { recursive: true });
        writeFileSync(at("elsewhere/ontology.md"), readFileSync(at("ontology.md"), "utf8").replace(title, `${title}, reached through detour`));
        rmSync(at("detour"), { recursive: true });
        symlinkSync(join("elsewhere", "inner"), at("detour"));
        assert.match(readFileSync(`${r.dir}${sep}detour${sep}..${sep}ontology.md`, "utf8"), /, reached through detour/, "the file system reaches the other ontology");
      },
    ],
  ]) {
    const name = `dot${what.length}`;
    branch(r, name);
    change();
    const d = sh(r.dir, "git", ["merge", "-q", name], 30000);
    assert.equal(d.code, 0, `${what}: ${d.out}`);
    const said = d.out.match(/tree: not written to (.*): the working tree differs from commit ([0-9a-f]{40}) at ([^;\n]*); the page there is kept/);
    assert.ok(said, `${what}: the merge says why it wrote nothing:\n${d.out}`);
    assert.deepEqual(said[3].split(", "), ["detour/../ontology.md"], `${what}: the path as the configuration gives it`);
    assert.ok(readFileSync(r.place).equals(kept), `${what}: the page at the place keeps its bytes`);
    assert.doesNotMatch(readFileSync(r.place, "utf8"), /reached through detour/, what);
  }
});

test("[check.ontology-tree.replaced-commit] a local replacement of main's ontology or commit does not reach the page, by a merge through the hook or on demand", () => {
  const r = repo();
  r.setPlace();
  const start = r.sha("refs/heads/main");
  const title = "# Ontology as Specification";
  r.git("checkout", "-q", "-b", "other");
  const other = r.commit("ontology.md", title, `${title}, of another commit`);
  const otherText = readFileSync(join(r.dir, "ontology.md"), "utf8");
  r.git("checkout", "-q", "main");
  // Git now reads main's ontology, the object its commit names, as the other commit's wherever
  // replacements are honoured. A merge of a branch that leaves the ontology as it is keeps that object,
  // so Git does not touch the file in the working tree, which holds main's own text: the merge, through
  // the hook, writes the page of main's own ontology, never the text the replacement puts in its place.
  r.git("replace", r.git("rev-parse", `${start}:ontology.md`).out.trim(), r.git("rev-parse", `${other}:ontology.md`).out.trim());
  branch(r, "b");
  assert.match(r.git("show", "b:ontology.md").out, /, of another commit/, "the replacement is in force");
  const m = r.git("merge", "-q", "b");
  assert.equal(m.code, 0, m.out);
  const main = r.sha("refs/heads/main");
  assert.equal(main, r.sha("b"), "the merge is done");
  assert.doesNotMatch(readFileSync(join(r.dir, "ontology.md"), "utf8"), /of another commit/, "the working tree holds main's own ontology");
  assert.match(m.out, new RegExp(`built from ${main}\n`), m.out);
  assert.deepEqual(r.mark(), { commit: main, config: "ont.config.json" });
  const page = readFileSync(r.place, "utf8");
  assert.ok(!page.includes("of another commit"), "the page shows main's own ontology, nothing of the other commit");
  assert.equal(r.gen("--stale").out, "");
  // And a replacement of main's commit itself by the other commit.
  r.git("replace", "-d", r.git("rev-parse", `${start}:ontology.md`).out.trim());
  // A branch made on main's real commit before main is replaced, to merge through the hook after.
  r.git("checkout", "-q", "-b", "c");
  const c = r.commit("README.md", "", "a change of the branch c\n");
  r.git("checkout", "-q", "main");
  r.git("replace", main, other);
  assert.match(r.git("show", `${main}:ontology.md`).out, /, of another commit/, "the replacement is in force");
  // The working tree holds the other commit's ontology: on demand it is not main's, whatever the
  // replacement says.
  writeFileSync(join(r.dir, "ontology.md"), otherText);
  const o = r.gen("--out", r.place);
  assert.equal(o.code, 0, o.out);
  assert.deepEqual(r.mark(), { commit: `${main}+working-tree`, config: "ont.config.json" });
  // And through the hook, with main's commit still replaced: the merge of c writes c's own tree, built
  // from c's real files, and nothing the replacement of main would put in its place.
  r.git("reset", "-q", "--hard");
  r.git("clean", "-q", "-fd");
  const h = r.git("merge", "-q", c);
  assert.equal(h.code, 0, h.out);
  assert.equal(r.sha("refs/heads/main"), c, "the merge is done");
  assert.doesNotMatch(readFileSync(r.place, "utf8"), /of another commit/, "the hook never writes the replacement's text");
  assert.deepEqual(r.mark(), { commit: c, config: "ont.config.json" });
  // And with the commit the merge brings replaced while the hook runs: Git checks the replacement's
  // files out, the hook reads the real commit, finds the working tree differing from it, and keeps the
  // page; the replacement's text never reaches it.
  r.git("replace", "-d", main);
  // The replacement is a commit on main as d is, so that Git still fast-forwards to d.
  r.git("checkout", "-q", "-b", "e");
  const e = r.commit("ontology.md", title, `${title}, of another commit`);
  r.git("checkout", "-q", "main");
  r.git("checkout", "-q", "-b", "d");
  const d = r.commit("README.md", "", "a change of the branch d\n");
  r.git("checkout", "-q", "main");
  r.git("replace", d, e);
  const kept = readFileSync(r.place);
  const hd = r.git("merge", "-q", d);
  assert.equal(hd.code, 0, hd.out);
  assert.equal(r.sha("refs/heads/main"), d, "the merge fast-forwards to d");
  assert.match(readFileSync(join(r.dir, "ontology.md"), "utf8"), /of another commit/, "Git checked the replacement's files out");
  assert.match(hd.out, /the working tree differs from commit/, hd.out);
  assert.ok(readFileSync(r.place).equals(kept), "the page is kept");
  assert.doesNotMatch(readFileSync(r.place, "utf8"), /of another commit/, "the hook never writes the replacement's text");
});

test("[check.ontology-tree.replaced-commit] [inv.accepted-never-edited] every command of Git the tool runs turns local replacements off", () => {
  const tools = join(REPO, "tools/ont-check");
  let calls = 0;
  for (const f of readdirSync(tools).filter((f) => f.endsWith(".mjs"))) {
    const text = readFileSync(join(tools, f), "utf8");
    for (const [line] of text.matchAll(/(?:spawnSync|execFileSync|execSync|spawn|execFile|exec)\(\s*"git"[^\n]*/g)) {
      calls += 1;
      assert.match(line, /env: gitEnv\(/, `${f}: ${line}`);
    }
  }
  assert.ok(calls >= 6, "the tool's commands of Git");
  const lib = readFileSync(join(tools, "lib.mjs"), "utf8");
  assert.match(lib, /export const gitEnv = [^\n]*GIT_NO_REPLACE_OBJECTS: "1"/);
});

test("[check.ontology-tree.generator-missing] a missing generator is named by the merge into main, with the command that restores it", () => {
  const r = repo();
  r.setPlace();
  const gen = "tools/ont-check/gen-tree.mjs";
  branch(r, "b");
  r.git("checkout", "-q", "-b", "x");
  branch(r, "y");
  r.git("checkout", "-q", "x");
  rmSync(join(r.dir, gen));
  const other = r.git("merge", "-q", "y");
  assert.equal(other.code, 0, other.out);
  assert.doesNotMatch(other.out, /tree|gen-tree/, "a merge into another branch says nothing");
  r.git("checkout", "-q", "main");
  assert.equal(existsSync(join(r.dir, gen)), false);
  const m = r.git("merge", "-q", "b");
  assert.equal(m.code, 0, m.out);
  assert.equal(r.sha("refs/heads/main"), r.sha("b"), "the merge is done");
  assert.ok(
    m.out.includes(`post-merge: the ontology tree was not written: ${gen} is missing from the working tree; restore it with git restore --source=HEAD --worktree -- ${gen}, which leaves the index as it is, then run node ${gen} --refresh`),
    m.out,
  );
  assert.equal(existsSync(r.place), false);
  r.git("restore", gen);
  assert.equal(r.gen("--refresh").code, 0);
  assert.deepEqual(r.mark(), { commit: r.sha("refs/heads/main"), config: "ont.config.json" });
});

test("[check.ontology-tree.generator-missing] a missing import of the generator is named on main with a place, and nothing is said or run off main or without one", () => {
  const lib = "tools/ont-check/lib.mjs";
  const quiet = (m, what) => {
    assert.equal(m.code, 0, `${what}: ${m.out}`);
    assert.equal(m.out, "", `${what}: the hook says nothing, and Node, which would fail on the missing import, does not run`);
  };
  // Without a place, on main and off it: the hook asks Git and ends, before it looks for any file.
  const n = repo();
  branch(n, "b");
  n.git("checkout", "-q", "-b", "x");
  branch(n, "y");
  n.git("checkout", "-q", "x");
  rmSync(join(n.dir, lib));
  quiet(n.git("merge", "-q", "y"), "no place, another branch");
  n.git("checkout", "-q", "main");
  quiet(n.git("merge", "-q", "b"), "no place, main");
  // With a place, off main: nothing said either; on main, the import is named with its command.
  const r = repo();
  r.setPlace();
  branch(r, "b");
  r.git("checkout", "-q", "-b", "x");
  branch(r, "y");
  r.git("checkout", "-q", "x");
  rmSync(join(r.dir, lib));
  quiet(r.git("merge", "-q", "y"), "a place, another branch");
  r.git("checkout", "-q", "main");
  const m = r.git("merge", "-q", "b");
  assert.equal(m.code, 0, m.out);
  assert.equal(r.sha("refs/heads/main"), r.sha("b"), "the merge is done");
  assert.equal(
    m.out,
    `post-merge: the ontology tree was not written: ${lib} is missing from the working tree; restore it with git restore --source=HEAD --worktree -- ${lib}, which leaves the index as it is, then run node tools/ont-check/gen-tree.mjs --refresh\n`,
  );
  assert.equal(existsSync(r.place), false);
  // The command it names brings the file back whether its removal is staged or not, and leaves the
  // index as it is, so a change staged for the file is not lost.
  r.git("rm", "-q", "--cached", lib);
  const restore = r.git("restore", "--source=HEAD", "--worktree", "--", lib);
  assert.equal(restore.code, 0, restore.out);
  assert.ok(existsSync(join(r.dir, lib)), "the command the hook names brings the file back after a staged removal");
  r.git("reset", "-q", "--", lib);
  writeFileSync(join(r.dir, lib), readFileSync(join(r.dir, lib), "utf8") + "// a staged change\n");
  r.git("add", lib);
  rmSync(join(r.dir, lib));
  const again = r.git("restore", "--source=HEAD", "--worktree", "--", lib);
  assert.equal(again.code, 0, again.out);
  assert.match(r.git("show", `:${lib}`).out, /\/\/ a staged change/, "the change staged for the file is still in the index");
});

test("[check.ontology-tree.generator-missing] the hook looks for the generator and every file it imports, and for nothing else", () => {
  // The files the generator loads: its own and, from each, the files of the tool it imports by a
  // relative path, followed through those files in turn.
  const tool = join(REPO, "tools/ont-check");
  const needed = new Set();
  const visit = (f) => {
    if (needed.has(f)) return;
    needed.add(f);
    for (const [, rel] of readFileSync(join(tool, f), "utf8").matchAll(/^import [^;]*? from "\.\/([^"]+)";/gm)) visit(rel);
  };
  visit("gen-tree.mjs");
  assert.ok(needed.size >= 3, [...needed].join(", "));
  const hook = readFileSync(join(REPO, ".githooks/post-merge"), "utf8");
  const loop = hook.match(/^for f in "\$GEN" ([^;]*); do$/m);
  assert.ok(loop, "the hook's loop over the generator's files");
  const listed = new Set(["gen-tree.mjs", ...loop[1].split(/\s+/).map((p) => p.replace(/^tools\/ont-check\//, ""))]);
  assert.deepEqual([...listed].sort(), [...needed].sort());
  // And the hook asks about the branch and the place before it looks for a file or runs Node.
  const first = (re) => hook.split("\n").findIndex((l) => !l.startsWith("#") && re.test(l));
  for (const re of [/^for f in /, /\bnode /]) {
    assert.ok(first(/symbolic-ref --quiet HEAD/) < first(re) && first(/config --local --get ont\.treeOut/) < first(re), `before ${re}`);
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
    assert.match(m.out, new RegExp(`tree: not written to .*${link.replace(".", "\\.")}: it is a symbolic link; set the place to the file itself\n`), link);
    assert.notEqual(before("README.md"), readme, "the merge itself is done");
    assert.ok(!before("README.md").includes("<!doctype html>"), link);
    assert.ok(before("README.md").startsWith(readmeNow.slice(0, 20)), link);
  }
  assert.equal(existsSync(join(r.dir, "docs", "new-tree.html")), false);

  // A hard link outside the repository to the ontology: its path is outside, its file is the ontology.
  // The merge refuses it, and so does the page written on demand.
  const hard = join(outside, "hard.html");
  linkSync(join(r.dir, "ontology.md"), hard);
  r.git("config", "--local", "ont.treeOut", hard);
  branch(r, "b5");
  const hm = r.git("merge", "-q", "b5");
  assert.equal(hm.code, 0, hm.out);
  assert.match(hm.out, /tree: not written to .*hard\.html: the file there has 2 links, and another of them may be a file of the repository\n/);
  assert.equal(before("ontology.md"), ontology, "the ontology is unchanged after the merge");
  const ho = r.gen("--out", hard);
  assert.notEqual(ho.code, 0, "the page on demand is refused too");
  assert.match(ho.out, /hard\.html: the file there has 2 links/);
  assert.equal(before("ontology.md"), ontology, "the ontology is unchanged after the page on demand");
  // A place that is a named pipe is refused, not opened: a write would wait for a reader.
  const pipe = join(outside, "pipe.html");
  assert.equal(sh(r.dir, "mkfifo", [pipe]).code, 0);
  r.git("config", "--local", "ont.treeOut", pipe);
  branch(r, "b6");
  const pm = r.git("merge", "-q", "b6");
  assert.equal(pm.code, 0, pm.out);
  assert.match(pm.out, /tree: not written to .*pipe\.html: it is a named pipe, not a regular file\n/);

  // A place that is a file of another worktree of the repository, whose path contains a line break:
  // Git lists the worktrees with their paths ended by NUL, and the whole path is the worktree's.
  const wt = join(temp("ont-worktree-"), "with\nline break");
  r.git("worktree", "add", "-q", "-b", "w", wt);
  const wtOntology = readFileSync(join(wt, "ontology.md"), "utf8");
  r.git("config", "--local", "ont.treeOut", join(wt, "ontology.md"));
  branch(r, "b9");
  const wm = r.git("merge", "-q", "b9");
  assert.equal(wm.code, 0, wm.out);
  assert.match(wm.out, /tree: not written to [^]*: it is inside the repository, at [^]*with\nline break, where the page would overwrite its files/);
  assert.equal(readFileSync(join(wt, "ontology.md"), "utf8"), wtOntology, "the file of the other worktree is unchanged");

  // A place outside the repository is written; when a page is there already, the new page is a new file
  // renamed over it, so whoever holds the old one still reads its old bytes, and nothing else is left.
  r.setPlace();
  branch(r, "b4");
  const ok = r.git("merge", "-q", "b4");
  assert.equal(ok.code, 0, ok.out);
  assert.deepEqual(r.mark(), { commit: r.sha("refs/heads/main"), config: "ont.config.json" });
  const page = readFileSync(r.place, "utf8");
  const held = openSync(r.place, "r");
  const inode = statSync(r.place).ino;
  branch(r, "b7");
  const again = r.git("merge", "-q", "b7");
  assert.equal(again.code, 0, again.out);
  assert.deepEqual(r.mark(), { commit: r.sha("refs/heads/main"), config: "ont.config.json" });
  assert.notEqual(readFileSync(r.place, "utf8"), page, "the page is written again");
  assert.equal(readFileSync(held, "utf8"), page, "the old file keeps its bytes");
  closeSync(held);
  assert.notEqual(statSync(r.place).ino, inode, "a new file at the place");
  assert.deepEqual(readdirSync(dirname(r.place)), [basename(r.place)], "no file of the write is left beside the page");
  // A place that is a link outside the repository to a page outside it is refused too: a link is never
  // followed, and the page it points to and the link are unchanged.
  const served = join(temp("ont-served-"), "served.html");
  writeFileSync(served, "old\n");
  const via = join(outside, "served-link.html");
  symlinkSync(served, via);
  r.git("config", "--local", "ont.treeOut", via);
  branch(r, "b8");
  const sm = r.git("merge", "-q", "b8");
  assert.equal(sm.code, 0, sm.out);
  assert.match(sm.out, /tree: not written to .*served-link\.html: it is a symbolic link; set the place to the file itself\n/);
  assert.equal(readFileSync(served, "utf8"), "old\n");
  assert.ok(lstatSync(via).isSymbolicLink(), "the link stays a link");
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

  // An ontology asked for through a directory that is not a link, followed by ..: plain/../ontology.md
  // leads to the committed ontology.md, but the path as the configuration gives it is not normalised,
  // and a .. part is never the commit's file (D-134).
  const n = repo();
  n.setPlace();
  mkdirSync(join(n.dir, "plain"));
  writeFileSync(join(n.dir, "plain", "keep.md"), "a committed directory\n");
  n.edit("ont.config.json", '"ontology": "ontology.md",', '"ontology": "plain/../ontology.md",');
  n.git("add", "-A");
  n.git("commit", "-q", "-m", "the ontology through plain/..");
  const no = n.gen("--out", n.place);
  assert.equal(no.code, 0, no.out);
  assert.deepEqual(n.mark(), { commit: `${n.sha("HEAD")}+working-tree`, config: "ont.config.json" }, "a .. through a plain directory");
  const nb = buildTree(join(n.dir, "ont.config.json"), null, workingTree({ cwd: n.dir }));
  assert.ok(markOf(nb).dirty.includes(`${n.dir}${sep}plain${sep}..${sep}ontology.md`), "the input named at its path as given");

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
  // A configuration through via/.. into a directory, deep/sub as the file system takes it, where the
  // path normalised by hand, sub, does not exist: the repository is the one the file system finds
  // there, and the page is not clean, never outside Git.
  for (const f of ["ont.config.json", "ontology.md", "example/ontology.md", "templates/ontology.md"]) {
    mkdirSync(join(u.dir, "deep", "sub", f, ".."), { recursive: true });
    cpSync(join(u.dir, f), join(u.dir, "deep", "sub", f));
  }
  assert.equal(existsSync(join(u.dir, "sub")), false);
  const us = u.gen("--config", ["via", "..", "sub", "ont.config.json"].join("/"), "--out", u.place);
  assert.equal(us.code, 0, us.out);
  assert.equal(u.mark().commit, `${u.sha("HEAD")}+working-tree`, "a configuration through via/../sub");

  // An input that is a symbolic link when it is read, to a copy with the commit's bytes, and the
  // commit's regular file by the time it is compared: the link seen at the read makes it not clean.
  const k = repo();
  cpSync(join(k.dir, "ontology.md"), join(k.dir, "copy.md"));
  rmSync(join(k.dir, "ontology.md"));
  symlinkSync("copy.md", join(k.dir, "ontology.md"));
  const swap = (path) => {
    if (!path.endsWith(`${sep}ontology.md`) || !lstatSync(path).isSymbolicLink()) return;
    rmSync(path);
    cpSync(join(k.dir, "copy.md"), path);
  };
  const ks = markOf(buildTree(join(k.dir, "ont.config.json"), null, workingTree({ onRead: swap })));
  assert.equal(lstatSync(join(k.dir, "ontology.md")).isSymbolicLink(), false, "the link was swapped for the commit's file");
  assert.deepEqual(ks, { commit: `${k.sha("HEAD")}+working-tree`, config: "ont.config.json", dirty: ["ontology.md"] }, "a link swapped after its read");

  // An ontology that is a named pipe with no writer: the page on demand reads only a regular file, so
  // it is refused in time with the kind of the file, and no page is written.
  const f = repo();
  f.setPlace();
  rmSync(join(f.dir, "ontology.md"));
  assert.equal(sh(f.dir, "mkfifo", [join(f.dir, "ontology.md")]).code, 0);
  const fo = sh(f.dir, "node", [join(f.dir, "tools/ont-check/gen-tree.mjs"), "--out", f.place], 30000);
  assert.notEqual(fo.code, 0, fo.out);
  assert.match(fo.out, /tree: not written: .*ontology\.md is a named pipe, not a regular file\n/);
  assert.equal(existsSync(f.place), false);

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
  assert.match(readFileSync(r.place, "utf8"), /<footer class="built" data-commit="no-commit" data-date="[^"]+" data-page="[0-9a-f]{64}">Built from no commit · /);
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
    ["config", "the page carries no mark of what it was built from"],
    ["date", "the page carries no mark of what it was built from"],
    ["commit", "the page carries no mark of what it was built from"],
    ["page", "the page carries no mark of what it was built from"],
  ]) {
    const partial = page.replace(new RegExp(` data-${attr}="[^"]*"`), "");
    assert.notEqual(partial, page, attr);
    writeFileSync(r.place, partial);
    assert.match(stale(), new RegExp(`: ${reason}\n`), attr);
  }
  const main = { commit: first, config: "ont.config.json", date: r.date() };
  assert.equal(withFooter(page, main), page, "the footer as the test writes it is the generator's");
  writeFileSync(r.place, withFooter(page, { ...main, config: undefined }));
  assert.match(stale(), /: the mark names no configuration\n/, "a footer without its configuration");
  writeFileSync(r.place, withFooter(page, { ...main, date: "" }));
  assert.match(stale(), /: the mark carries no date\n/, "an empty date");
  writeFileSync(r.place, withFooter(page, { ...main, commit: "" }));
  assert.match(stale(), /: the mark names no commit\n/, "an empty commit");
  // A place that is a symbolic link to the current page: the refresh refuses it, and the report does
  // not follow it.
  const target = join(temp("ont-target-"), "page.html");
  writeFileSync(target, page);
  rmSync(r.place);
  symlinkSync(target, r.place);
  assert.match(stale(), /TREE_STALE .*tree\.html: the place is a symbolic link, not a regular file\n/);
  rmSync(r.place);
  // A date that is not one, one of another form, and one of the right form that no calendar has.
  for (const date of ["not-a-date", "2026-11-20", "2026-11-20T09:30:00.000Z", "2026-13-40T25:61:61Z", "2026-02-30T00:00:00Z"]) {
    writeFileSync(r.place, withFooter(page, { ...main, date }));
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

test("[check.ontology-tree.mark-exact] the mark is only the footer of the generator's form at the end of the page it wrote; its fields anywhere else, or any change before it, are no mark", () => {
  const r = repo();
  r.setPlace();
  assert.equal(r.gen("--refresh").code, 0);
  const stale = () => {
    const s = r.gen("--stale");
    assert.equal(s.code, 0, s.out);
    return s.out;
  };
  assert.equal(stale(), "", "the page as the generator wrote it");
  const page = readFileSync(r.place, "utf8");
  const end = "</body></html>\n";
  const foot = page.match(/<footer class="built"[^\n]*<\/footer>\n/)[0];
  assert.ok(page.endsWith(`\n${foot}${end}`), "the footer is last on the page");
  const main = { commit: r.sha("refs/heads/main"), config: "ont.config.json", date: r.date() };
  assert.deepEqual(readMark(page), main);
  assert.deepEqual(readMark(readFileSync(r.place)), main, "the page read as bytes");
  // The page without its footer: every case below keeps the three fields of main's mark on the page.
  const body = page.slice(0, page.length - foot.length - end.length);
  assert.equal(hashOf(body, main), foot.match(/data-page="([0-9a-f]{64})"/)[1], "the hash is of the bytes before the footer and of the footer's fields");
  // The footer's fields changed together, attributes and text, with the page and the hash left as they
  // are: a page built from changed files whose +working-tree is taken away is no mark (D-135).
  {
    const dirty = { ...main, commit: `${main.commit}+working-tree` };
    const built = page.replace(foot, `${footerOf(dirty, body)}\n`);
    assert.deepEqual(readMark(built), dirty, "a page marked +working-tree");
    const cleaned = built.replace(`data-commit="${dirty.commit}"`, `data-commit="${main.commit}"`).replace(`<code>${dirty.commit}</code>`, `<code>${main.commit}</code>`);
    assert.equal(readMark(cleaned), null, "its +working-tree taken away by hand");
  }
  const section = body.lastIndexOf("</section>");
  const noMark = (what, html) => {
    assert.notEqual(html, page, what);
    assert.ok(html.includes(`data-commit="${main.commit}"`) && html.includes('data-config="ont.config.json"'), what);
    writeFileSync(r.place, html);
    assert.equal(readMark(html), null, what);
    assert.match(stale(), /TREE_STALE .*tree\.html: the page carries no mark of what it was built from\n/, what);
  };
  // The fields elsewhere than in the generator's footer at the end of the page.
  for (const [what, html] of [
    ["in a comment", `${body}<!-- ${foot.trim()} -->\n${end}`],
    ["in a title attribute", `${body}<span title='${foot.trim()}'>tree</span>\n${end}`],
    ["in a footer before the end of the page", `${body.slice(0, section)}\n${foot}${body.slice(section)}${end}`],
    ["in a footer with an attribute more", `${body}${foot.replace('<footer class="built"', '<footer class="built" data-by="hand"')}${end}`],
    ["in a footer whose text says it was built from an older checkout", `${body}${foot.replace(/>Built from .*<\/footer>/, ">Built from an older checkout</footer>")}${end}`],
    ["in a footer whose text names another commit", `${body}${foot.replace(`<code>${main.commit}</code>`, `<code>${"0".repeat(40)}</code>`)}${end}`],
    ["with an element between the footer and the end of the page", `${body}${foot}<p>after the footer</p>\n${end}`],
    ["with text after the end of the page", `${body}${foot}${end}more text\n`],
  ])
    noMark(what, html);
  // The generator's footer, unchanged, at the end of a page changed before it: each is refused by the
  // hash alone, for with the hash computed again for the changed page, as a forger would, the same page
  // is a mark (D-134). An element left open folds the footer away, and one closed or drawn changes the
  // page all the same.
  const oneByte = body.replace(/<b data-ont="([^"]+)"/, (_, id) => `<b data-ont="${id}" `);
  for (const [what, html] of [
    ["after a comment left open", `${body}<!--\n${foot}${end}`],
    ["inside a template left open", `${body}<template>\n${foot}${end}`],
    ["inside nested templates of which only the inner one is closed", `${body}<template><p>x</p><template></template>\n${foot}${end}`],
    ["after a template closed", `${body}<template><template></template><p>x</p></template>\n${foot}${end}`],
    ["inside a details left open, after its summary", `${body}<details><summary>tree</summary>${foot}${end}`],
    ["inside a div left open", `${body}<div hidden>\n${foot}${end}`],
    ["after a stray end tag", `${body}</section>\n${foot}${end}`],
    ["inside a template written with a slash", `${body}<template/>\n${foot}${end}`],
    ["after an end tag of an svg that its slash closed", `${body}<svg/></svg>\n${foot}${end}`],
    ["after an end tag of a path that its slash closed, inside an svg", `${body}<svg><path/></path></svg>\n${foot}${end}`],
    ["after an end tag of a math that its slash closed", `${body}<math/></math>\n${foot}${end}`],
    ["after an svg its slash closes", `${body}<svg/>\n${foot}${end}`],
    ["after an svg whose path its slash closes", `${body}<svg><path d="M0 0"/></svg>\n${foot}${end}`],
    ["inside an svg whose unquoted attribute ends in a slash", `${body}<svg id=icon/>\n${foot}${end}`],
    ["inside a template written with a slash in an svg foreignObject", `${body}<svg><foreignObject><template/></foreignObject></svg>\n${foot}${end}`],
    ["inside a template written with a slash in a math mtext", `${body}<math><mtext><template/></mtext></math>\n${foot}${end}`],
    ["after a script left open", `${body}<script>\n${foot}${end}`],
    ["after a style left open", `${body}<style>\n${foot}${end}`],
    ["after a textarea left open", `${body}<textarea>\n${foot}${end}`],
    ["with one byte of the tree changed", `${oneByte}${foot}${end}`],
  ]) {
    assert.ok(html.endsWith(`${foot}${end}`), `the generator's footer at the end: ${what}`);
    noMark(what, html);
    assert.deepEqual(readMark(rehashed(html)), main, `with the hash computed again: ${what}`);
  }
  assert.equal(Buffer.byteLength(oneByte), Buffer.byteLength(body) + 1, "one byte more");
  // The hash is of the bytes of the file, not of the text they decode to: a page whose U+FFFD is
  // replaced by a byte that is not UTF-8, which decodes to U+FFFD again, is no mark.
  const withFffd = rehashed(`${body}<p>\uFFFD</p>\n${foot}${end}`);
  assert.deepEqual(readMark(withFffd), main, "a page with U+FFFD and its hash");
  const bytes = Buffer.from(withFffd, "utf8");
  const at = bytes.indexOf(Buffer.from("\uFFFD", "utf8"));
  const bad = Buffer.concat([bytes.subarray(0, at), Buffer.from([0xff]), bytes.subarray(at + 3)]);
  assert.equal(Buffer.from(bad.toString("utf8"), "utf8").equals(bytes), true, "the bad byte decodes to the same text");
  writeFileSync(r.place, bad);
  assert.equal(readMark(bad), null, "a byte that is not UTF-8");
  assert.match(stale(), /: the page carries no mark of what it was built from\n/, "a byte that is not UTF-8");
  // The page as the generator wrote it, and with white space added between its footer and its end,
  // which is not before the footer: the mark, and current.
  for (const [what, html] of [
    ["the page as the generator wrote it", page],
    ["white space between the footer and the end", `${body}${foot.trimEnd()} \t\n\n${end.trimEnd()}\n\n`],
  ]) {
    writeFileSync(r.place, html);
    assert.deepEqual(readMark(html), main, what);
    assert.equal(stale(), "", what);
  }
});

test("[check.ontology-tree.place-resolved] a place through a linked directory followed by .. is the file the file system reaches, for the refresh and the stale report alike", () => {
  const r = repo();
  // via points into the repository's docs, so via/.. is the root of the repository, while the path
  // normalised by hand is a file of the directory of the link.
  const o = temp("ont-via-");
  writeFileSync(join(o, "README.md"), "another file\n");
  symlinkSync(join(r.dir, "docs"), join(o, "via"));
  r.git("config", "--local", "ont.treeOut", [o, "via", "..", "README.md"].join("/"));
  branch(r, "b1");
  const before = readFileSync(join(r.dir, "README.md"), "utf8");
  const m = r.git("merge", "-q", "b1");
  assert.equal(m.code, 0, m.out);
  assert.match(m.out, /tree: not written to .*: it is inside the repository, at .*, where the page would overwrite its files; /);
  assert.equal(readFileSync(join(o, "README.md"), "utf8"), "another file\n", "the file at the path normalised by hand");
  assert.ok(!readFileSync(join(r.dir, "README.md"), "utf8").includes("<!doctype html>"), "the file of the repository");
  assert.notEqual(readFileSync(join(r.dir, "README.md"), "utf8"), before, "the merge itself is done");

  // via points to a directory deep outside the repository: the page is written beside deep, not in the
  // directory of the link, and the stale report reads it there.
  const t = temp("ont-target-");
  mkdirSync(join(t, "deep"));
  const o2 = temp("ont-via-");
  symlinkSync(join(t, "deep"), join(o2, "via"));
  r.git("config", "--local", "ont.treeOut", [o2, "via", "..", "tree.html"].join("/"));
  branch(r, "b2");
  const w = r.git("merge", "-q", "b2");
  assert.equal(w.code, 0, w.out);
  assert.match(w.out, /built from [0-9a-f]{40}\n/);
  assert.equal(existsSync(join(o2, "tree.html")), false, "nothing at the path normalised by hand");
  const mark = readMark(readFileSync(join(t, "tree.html"), "utf8"));
  assert.equal(mark.commit, r.sha("refs/heads/main"));
  assert.equal(mark.config, "ont.config.json");
  assert.equal(r.gen("--stale").out, "", "the stale report reads the page written");
  // And a page left at the path normalised by hand is not the one it reads.
  const written = readFileSync(join(t, "tree.html"), "utf8");
  rmSync(join(t, "tree.html"));
  writeFileSync(join(o2, "tree.html"), written);
  assert.match(r.gen("--stale").out, /TREE_STALE .*tree\.html: the file does not exist\n/);
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
      // The condition in general, so that a case no list names is not taken as covered, then the cases
      // as examples: a merge ended after a conflict, one made with --no-commit and committed apart, and
      // a rebase.
      assert.match(section.replace(/\s+/g, " "), /Git runs `post-merge` only when `git merge` or `git pull` itself makes the merge commit or the fast-forward/, `${file}: the condition in general`);
      assert.match(section, /git merge --continue/, `${file}: a merge ended after a conflict`);
      assert.match(section, /--no-commit/, `${file}: a merge made with --no-commit and committed apart`);
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
