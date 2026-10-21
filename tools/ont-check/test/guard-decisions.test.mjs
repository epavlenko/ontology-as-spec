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
  ["a new accepted entry", (t) => t.replace("## Tentative", "### D-07 · A new rule\n\n- Date: 2026-10-21 · Status: accepted\n- Decision: x.\n\n## Tentative")],
  ["an edit of a tentative entry", (t) => t.replace("a week may be needed", "two weeks may be needed")],
  ["a new open question", (t) => t.replace("## Open questions\n", "## Open questions\n\n- Another question?\n")],
];
for (const [name, edit] of allowed)
  test(`allows ${name}`, () => {
    for (const r of run(edit)) {
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /GUARD_OK/);
    }
  });

const refused = [
  ["an edit of an accepted entry", "accepted entries edited", (t) => t.replace("members remember one number", "members like one number")],
  ["a removed accepted entry", "accepted entries removed", (t) => t.replace(/### D-04 ·[\s\S]*?(?=## Tentative)/, "")],
];
for (const [name, label, edit] of refused)
  test(`refuses ${name}`, () => {
    for (const r of run(edit)) {
      assert.equal(r.code, 1, r.out);
      assert.ok(r.out.includes(label), `expected "${label}" in:\n${r.out}`);
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
