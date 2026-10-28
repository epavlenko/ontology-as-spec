import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const GUARD = fileURLToPath(new URL("../guard-decisions.mjs", import.meta.url));
const EXAMPLE = fileURLToPath(new URL("../../../example/", import.meta.url));

// Each case commits the example to a throwaway repository, changes the decision log one way and
// runs the guard against that commit, on the working tree and on the staged version. prepare(dir)
// may change the copy before the base commit.
const run = (edit, prepare = () => {}) => {
  const dir = mkdtempSync(join(tmpdir(), "guard-"));
  const git = (...args) => {
    const r = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
  };
  try {
    cpSync(EXAMPLE, dir, { recursive: true });
    prepare(dir);
    git("init", "-q");
    git("add", ".");
    git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "base");
    const path = join(dir, "decisions.md");
    const text = readFileSync(path, "utf8");
    const changed = edit(text);
    assert.notEqual(changed, text, "the edit changed nothing");
    writeFileSync(path, changed);
    git("add", "decisions.md");
    const guard = (...extra) => {
      const r = spawnSync("node", [GUARD, "--config", join(dir, "ont.config.json"), ...extra], {
        cwd: dir,
        encoding: "utf8",
      });
      return { code: r.status, out: r.stdout + r.stderr };
    };
    return [guard(), guard("--staged")];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const allowed = [
  ["[check.decision.free-sections] a new accepted entry", (t) => t.replace("## Tentative", "### D-07 · A new rule\n\n- Date: 2026-10-21 · Status: accepted\n- Decision: x.\n\n## Tentative")],
  ["[check.decision.free-sections] an edit of a tentative entry", (t) => t.replace("a week may be needed", "two weeks may be needed")],
  ["[check.decision.free-sections] a new open question", (t) => t.replace("## Open questions\n", "## Open questions\n\n- Another question?\n")],
];
for (const [name, edit] of allowed)
  test(name.replace(/^(\[[^\]]+\]) /, "$1 allows "), () => {
    for (const r of run(edit)) {
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /GUARD_OK/);
    }
  });

const refused = [
  ["[check.decision.accepted-edited] an edit of an accepted entry", "accepted entries edited", (t) => t.replace("members remember one number", "members like one number")],
  ["[check.decision.accepted-edited] a removed accepted entry", "accepted entries removed", (t) => t.replace(/### D-04 ·[\s\S]*?(?=## Tentative)/, "")],
];
for (const [name, label, edit] of refused)
  test(name.replace(/^(\[[^\]]+\]) /, "$1 refuses "), () => {
    for (const r of run(edit)) {
      assert.equal(r.code, 1, r.out);
      assert.ok(r.out.includes(label), `expected "${label}" in:\n${r.out}`);
    }
  });

// Before the first commit there is nothing to compare with: the guard says it is off and passes, while
// a base that was named and is missing stays an error.
test("[check.decision.guard-off] says GUARD_OFF before the first commit", () => {
  const dir = mkdtempSync(join(tmpdir(), "guard-"));
  try {
    cpSync(EXAMPLE, dir, { recursive: true });
    assert.equal(spawnSync("git", ["init", "-q"], { cwd: dir }).status, 0);
    const guard = (...extra) => {
      const r = spawnSync("node", [GUARD, "--config", join(dir, "ont.config.json"), ...extra], { cwd: dir, encoding: "utf8" });
      return { code: r.status, out: r.stdout + r.stderr };
    };
    const off = guard();
    assert.equal(off.code, 0, off.out);
    assert.match(off.out, /no commit yet; accepted entries are not protected until the first commit\nGUARD_OFF/);
    const named = guard("--base", "HEAD");
    assert.equal(named.code, 1, named.out);
    assert.match(named.out, /commit HEAD not found/);
    assert.doesNotMatch(named.out, /Write a new entry/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("[check.decision.uncommitted-named] names accepted entries that are not committed yet", () => {
  const [plain, staged] = run((t) => t.replace("## Tentative", "### D-07 · A new rule\n\n- Date: 2026-10-21 · Status: accepted\n- Decision: x.\n\n## Tentative"));
  assert.equal(plain.code, 0, plain.out);
  assert.match(plain.out, /accepted entries not in HEAD yet, protected once committed \(1\): D-07/);
  assert.match(plain.out, /GUARD_OK/);
  assert.doesNotMatch(staged.out, /not in HEAD yet/);
});

// Once a log names a source, every entry accepted since the base names its own: a new one, and a
// tentative one accepted now. A log that names no source is not asked for one.
const sourced = (dir) => {
  const log = join(dir, "decisions.md");
  const entry = "### D-07 · A sourced rule\n\n- Date: 2026-10-26 · Status: accepted\n- Source: the owner's message of 2026-10-26\n- Decision: x.\n\n";
  writeFileSync(log, readFileSync(log, "utf8").replace("## Tentative", `${entry}## Tentative`));
};
const another = (source) => (t) =>
  t.replace("## Tentative", `### D-08 · Another rule\n\n- Date: 2026-10-26 · Status: accepted\n${source}- Decision: y.\n\n## Tentative`);
test("[check.decision.unsourced-acceptance] refuses an entry accepted without a source once the log names sources", () => {
  for (const r of run(another(""), sourced)) {
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /entries accepted since HEAD without a source, while the log names sources \(1\): D-08/);
    assert.match(r.out, /Name on a Source line where each was decided/);
  }
  for (const r of run((t) => t.replace("Status: tentative", "Status: accepted"), sourced)) {
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /without a source, while the log names sources \(1\): D-05/);
  }
  for (const r of run(another("- Source: the owner's answer of 2026-10-26\n"), sourced)) assert.equal(r.code, 0, r.out);
  for (const r of run(another(""))) assert.equal(r.code, 0, r.out);
});

// When the first source comes after the base, the guard cannot tell which entries were accepted before
// it, and asks a source only of the entries numbered after it.
test("[check.decision.unsourced-acceptance] asks a source only after the first one when the log adopts sources", () => {
  const src = "- Source: the owner's message of 2026-10-26\n";
  const two = (a, b) => (t) =>
    t.replace(
      "## Tentative",
      `### D-07 · One\n\n- Date: 2026-10-26 · Status: accepted\n${a}- Decision: x.\n\n### D-08 · Two\n\n- Date: 2026-10-26 · Status: accepted\n${b}- Decision: y.\n\n## Tentative`,
    );
  for (const r of run(two("", src))) assert.equal(r.code, 0, r.out);
  for (const r of run(two(src, ""))) {
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /without a source, while the log names sources \(1\): D-08/);
  }
});

// A log the base does not have yet: nothing to protect, but its accepted entries still need sources.
test("[check.decision.unsourced-acceptance] checks the sources of a log that is not in the base", () => {
  const dir = mkdtempSync(join(tmpdir(), "guard-"));
  try {
    cpSync(EXAMPLE, dir, { recursive: true });
    const log = join(dir, "decisions.md");
    const text = readFileSync(log, "utf8");
    rmSync(log);
    for (const args of [["init", "-q"], ["add", "."], ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "base"]])
      assert.equal(spawnSync("git", args, { cwd: dir }).status, 0);
    writeFileSync(
      log,
      text.replace(
        "## Tentative",
        "### D-07 · One\n\n- Date: 2026-10-26 · Status: accepted\n- Source: the owner's message of 2026-10-26\n- Decision: x.\n\n### D-08 · Two\n\n- Date: 2026-10-26 · Status: accepted\n- Decision: y.\n\n## Tentative",
      ),
    );
    const r = spawnSync("node", [GUARD, "--config", join(dir, "ont.config.json")], { cwd: dir, encoding: "utf8" });
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /not in HEAD, no accepted entry to protect yet/);
    assert.match(r.stdout, /without a source, while the log names sources \(1\): D-08/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// A definition changed since the base is named by a new decision entry or a new history line (D-59).
test("[check.decision.meaning-changed] fails on a definition changed with no decision entry or history line naming it", () => {
  const dir = mkdtempSync(join(tmpdir(), "guard-"));
  try {
    cpSync(EXAMPLE, dir, { recursive: true });
    for (const args of [["init", "-q"], ["add", "."], ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "base"]])
      assert.equal(spawnSync("git", args, { cwd: dir }).status, 0);
    const onto = join(dir, "ontology.md");
    const log = join(dir, "decisions.md");
    const [text, entries] = [readFileSync(onto, "utf8"), readFileSync(log, "utf8")];
    const changed = text.replace("Up to 2 renewals per loan, each adds 14 days", "Up to 3 renewals per loan, each adds 14 days");
    assert.notEqual(changed, text);
    const guard = () => {
      const r = spawnSync("node", [GUARD, "--config", join(dir, "ont.config.json")], { cwd: dir, encoding: "utf8" });
      return { code: r.status, out: r.stdout + r.stderr };
    };
    writeFileSync(onto, changed);
    const silent = guard();
    assert.equal(silent.code, 1, silent.out);
    assert.match(silent.out, /definitions changed since HEAD with no decision entry or history line naming them \(1\): rule\.renewal/);
    writeFileSync(onto, changed.replace("## Revision history\n\n", "## Revision history\n\n- 2026-10-28: `rule.renewal`: three renewals.\n"));
    assert.equal(guard().code, 0);
    writeFileSync(onto, changed);
    writeFileSync(log, entries.replace("## Tentative", "### D-07 · Three renewals\n\n- Date: 2026-10-28 · Status: tentative\n- Decision: `rule.renewal` allows three.\n\n## Tentative"));
    assert.equal(guard().code, 0);
    // Formatting is not meaning: the Kind cell and the alignment may change freely.
    writeFileSync(log, entries);
    writeFileSync(onto, text.replace("| Rule      | `rule.loan-period`       |", "| Rule | `rule.loan-period` |"));
    assert.equal(guard().code, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// A log in another language: the same edit is refused only once decisions.accepted matches its
// status line.
const localized = (setting) => (dir) => {
  const log = join(dir, "decisions.md");
  writeFileSync(log, readFileSync(log, "utf8").replaceAll("Status: accepted", "Статус: принято"));
  const config = join(dir, "ont.config.json");
  const cfg = JSON.parse(readFileSync(config, "utf8"));
  if (setting) cfg.decisions.accepted = setting;
  writeFileSync(config, JSON.stringify(cfg));
};
const edit = (t) => t.replace("members remember one number", "members like one number");
test("reads the accepted status from decisions.accepted", () => {
  for (const r of run(edit, localized(null))) assert.equal(r.code, 0, r.out);
  for (const r of run(edit, localized("^- Date:.*Статус:\\s*принято"))) {
    assert.equal(r.code, 1, r.out);
    assert.ok(r.out.includes("accepted entries edited"), r.out);
  }
});
