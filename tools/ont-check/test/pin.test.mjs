import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const PIN = fileURLToPath(new URL("../pin.mjs", import.meta.url));

// A small approach repository with two commits: the second removes sub/b.mjs and adds c.mjs, and a
// project that keeps its copy in tools/oas with the pin beside it.
const setup = () => {
  const root = mkdtempSync(join(tmpdir(), "pin-"));
  const src = join(root, "approach");
  const git = (...args) => assert.equal(spawnSync("git", args, { cwd: src }).status, 0, args.join(" "));
  const put = (file, text) => {
    mkdirSync(join(src, file, ".."), { recursive: true });
    writeFileSync(join(src, file), text);
  };
  mkdirSync(src);
  git("init", "-q");
  put("LICENSE", "MIT\n");
  put("decisions.md", "### D-01 · One\n");
  put("tools/ont-check/a.mjs", "export const a = 1;\n");
  put("tools/ont-check/sub/b.mjs", "export const b = 2;\n");
  put("tools/ont-check/test/a.test.mjs", "// a test\n");
  git("add", ".");
  git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "one");
  rmSync(join(src, "tools/ont-check/sub"), { recursive: true });
  put("tools/ont-check/c.mjs", "export const c = 3;\n");
  put("decisions.md", "### D-01 · One\n\n### D-02 · Two\n");
  git("add", "-A");
  git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "two");
  const dir = join(root, "project", "tools", "oas");
  const pinFile = join(root, "project", "tools", "oas.upstream.json");
  const run = (...args) => {
    const r = spawnSync("node", [PIN, ...args, "--dir", dir, "--pin", pinFile], { encoding: "utf8" });
    return { code: r.status, out: r.stdout + r.stderr };
  };
  return { root, dir, pinFile, update: (ref) => run("update", "--from", src, "--ref", ref), verify: () => run("verify") };
};

test("[check.tool-copy.removed-file-deleted] updating the copy deletes what the approach removed and pins every file", () => {
  const { root, dir, pinFile, update, verify } = setup();
  try {
    assert.equal(update("HEAD~1").code, 0);
    assert.ok(existsSync(join(dir, "sub", "b.mjs")));
    assert.ok(!existsSync(join(dir, "test")), "the tests stay in the approach");
    assert.equal(JSON.parse(readFileSync(pinFile, "utf8")).protocol, "D-01");
    const r = update("HEAD");
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /Decisions since D-01 \(1\), to read and carry into the project:\n {2}D-02 · Two/);
    assert.match(r.out, /Files deleted from the copy, which the approach no longer has \(1\):\n {2}sub\/b\.mjs/);
    assert.ok(!existsSync(join(dir, "sub")), "an emptied directory goes too");
    const pin = JSON.parse(readFileSync(pinFile, "utf8"));
    assert.deepEqual(Object.keys(pin.files).sort(), ["LICENSE", "a.mjs", "c.mjs"]);
    assert.equal(pin.protocol, "D-02");
    assert.match(verify().out, /^PIN_OK ontology-as-spec D-02 \([0-9a-f]{7}\)/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("[check.tool-copy.extra-file] verifying the pin names files it does not hold, changed and missing ones, and keeps the project's own", () => {
  const { root, dir, pinFile, update, verify } = setup();
  try {
    update("HEAD");
    mkdirSync(join(dir, "old"));
    writeFileSync(join(dir, "old", "stale.mjs"), "// left from an earlier copy\n");
    writeFileSync(join(dir, "a.mjs"), "export const a = 9;\n");
    rmSync(join(dir, "c.mjs"));
    writeFileSync(join(dir, "NOTES.md"), "How this project updates its copy.\n");
    const r = verify();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /does not match its pin D-02 \([0-9a-f]{7}\) \(4\):\n {2}changed: a\.mjs\n {2}missing: c\.mjs\n {2}not in the pin: NOTES\.md\n {2}not in the pin: old\/stale\.mjs\n/);
    // A file the project keeps on purpose is listed as its own; an update leaves it and names strangers.
    const pin = JSON.parse(readFileSync(pinFile, "utf8"));
    writeFileSync(pinFile, JSON.stringify({ ...pin, own: ["NOTES.md"] }));
    const again = update("HEAD");
    assert.match(again.out, /no pin names, left in place[^\n]*\(1\):\n {2}old\/stale\.mjs/);
    assert.ok(existsSync(join(dir, "NOTES.md")));
    assert.match(verify().out, /\(1\):\n {2}not in the pin: old\/stale\.mjs\n/);
    rmSync(join(dir, "old"), { recursive: true });
    assert.equal(verify().code, 0);
    assert.deepEqual(JSON.parse(readFileSync(pinFile, "utf8")).own, ["NOTES.md"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
