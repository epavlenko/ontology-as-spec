#!/usr/bin/env node
// A project's copy of the tool, pinned to one commit of the approach (D-64). The copy is tools/ont-check
// without its tests, and the approach's LICENSE, in a directory of the project; the pin names the commit,
// its date, the last decision of the approach there, and the hash of every file of the copy.
//   node path/to/ontology-as-spec/tools/ont-check/pin.mjs update --dir tools/ontology-as-spec [--pin FILE] [--ref REF] [--from CLONE] [--dry-run]
//   node tools/ontology-as-spec/pin.mjs verify [--dir DIR] [--pin FILE]
// update copies the files of commit REF (default HEAD) of the clone it runs from, or of --from, deletes
// the files of the old pin that the commit no longer has, and writes the pin; it prints the commits and
// the decisions since the old pin, and the files in the directory that neither pin names, which it
// leaves for the project to remove or to list as its own. verify fails on a file the pin names that is missing or changed, and on a
// file in the copy's directory that the pin does not name. The pin is upstream.json in the copy's
// directory unless --pin names another file. Files a project keeps in that directory on purpose are
// listed under "own" in the pin: update leaves them and verify skips them.
// ont: ent.tool-copy, field.tool-copy.pin, inv.copy-matches-pin, action.update-copy
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOL = "tools/ont-check/";
const argv = process.argv.slice(2);
const [mode] = argv;
const value = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
const dir = resolve(value("--dir") ?? (mode === "verify" ? HERE : ""));
const pinFile = resolve(value("--pin") ?? join(dir, "upstream.json"));
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const posix = (p) => p.split(sep).join("/");
// Every file under a directory, by its path relative to it, with "/" between parts.
const walk = (d) =>
  existsSync(d) ? readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [posix(relative(dir, join(d, e.name)))])) : [];
// The files of the directory that belong to neither the copy nor the pin: the pin itself, and the
// project's own files the pin lists.
const outside = (pin) => new Set([posix(relative(dir, pinFile)), ...(pin?.own ?? [])]);

if (mode === "verify") {
  if (!existsSync(pinFile)) {
    console.log(`ERROR · no pin at ${relative(process.cwd(), pinFile)}`);
    process.exit(1);
  }
  const pin = JSON.parse(readFileSync(pinFile, "utf8"));
  const problems = [];
  for (const [file, hash] of Object.entries(pin.files)) {
    const path = join(dir, file);
    if (!existsSync(path)) problems.push(`missing: ${file}`);
    else if (sha256(readFileSync(path)) !== hash) problems.push(`changed: ${file}`);
  }
  const skip = outside(pin);
  for (const file of walk(dir)) if (!(file in pin.files) && !skip.has(file)) problems.push(`not in the pin: ${file}`);
  if (problems.length) {
    console.log(`ERROR · the copy in ${relative(process.cwd(), dir) || "."} does not match its pin ${pin.protocol} (${pin.commit.slice(0, 7)}) (${problems.length}):\n  ${problems.join("\n  ")}`);
    console.log("Copy the tool again with pin.mjs update; a fix to the tool goes to the approach, not to the copy.");
    process.exit(1);
  }
  console.log(`PIN_OK ontology-as-spec ${pin.protocol} (${pin.commit.slice(0, 7)})`);
} else if (mode === "update" && value("--dir")) {
  const clone = resolve(value("--from") ?? join(HERE, "..", ".."));
  const git = (...args) => {
    const r = spawnSync("git", ["-C", clone, ...args], { maxBuffer: 1 << 26 });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.toString().trim()}`);
    return r.stdout;
  };
  const commit = git("rev-parse", `${value("--ref") ?? "HEAD"}^{commit}`).toString().trim();
  const old = existsSync(pinFile) ? JSON.parse(readFileSync(pinFile, "utf8")) : null;
  const sources = Object.fromEntries([
    ...git("ls-tree", "-r", "--name-only", commit, TOOL)
      .toString()
      .split("\n")
      .filter((f) => f && !f.startsWith(`${TOOL}test/`))
      .map((f) => [f.slice(TOOL.length), f]),
    ...(git("ls-tree", "--name-only", commit, "LICENSE").toString().trim() ? [["LICENSE", "LICENSE"]] : []),
  ]);
  const decisions = [...git("show", `${commit}:decisions.md`).toString().matchAll(/^### D-(\d+) · (.+)$/gm)];
  const last = Math.max(...decisions.map((m) => Number(m[1])));
  const protocol = `D-${String(last).padStart(2, "0")}`;
  const skip = outside(old);
  // What the approach removed since the old pin goes; a file no pin names is the project's to judge.
  const stale = Object.keys(old?.files ?? {}).filter((f) => !(f in sources) && existsSync(join(dir, f)));
  const strangers = walk(dir).filter((f) => !(f in sources) && !(f in (old?.files ?? {})) && !skip.has(f));
  if (old) {
    console.log(`Commits ${old.commit.slice(0, 7)}..${commit.slice(0, 7)}:`);
    console.log(git("log", "--oneline", `${old.commit}..${commit}`).toString().trimEnd() || "  none");
    const since = Number(String(old.protocol ?? "D-0").slice(2));
    const fresh = decisions.filter((m) => Number(m[1]) > since);
    console.log(`\nDecisions since ${old.protocol} (${fresh.length}), to read and carry into the project:`);
    for (const m of fresh) console.log(`  D-${m[1]} · ${m[2]}`);
  }
  const added = Object.keys(sources).filter((f) => !(f in (old?.files ?? {})));
  if (added.length) console.log(`\nFiles new to the copy (${added.length}):\n  ${added.join("\n  ")}`);
  if (stale.length) console.log(`\nFiles deleted from the copy, which the approach no longer has (${stale.length}):\n  ${stale.join("\n  ")}`);
  if (strangers.length)
    console.log(`\nFiles in the directory that no pin names, left in place; remove them or list them under "own" in the pin, or verify fails (${strangers.length}):\n  ${strangers.join("\n  ")}`);
  if (argv.includes("--dry-run")) process.exit(0);
  for (const f of stale) {
    rmSync(join(dir, f));
    // Directories left empty go too.
    for (let d = dirname(join(dir, f)); d.startsWith(dir + sep) && !readdirSync(d).length; d = dirname(d)) rmdirSync(d);
  }
  const files = {};
  for (const [name, path] of Object.entries(sources)) {
    const data = git("show", `${commit}:${path}`);
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), data);
    files[name] = sha256(data);
  }
  const origin = spawnSync("git", ["-C", clone, "remote", "get-url", "origin"], { encoding: "utf8" });
  const pin = {
    repository: old?.repository ?? (origin.status === 0 ? origin.stdout.trim() : clone),
    commit,
    date: git("log", "-1", "--format=%cs", commit).toString().trim(),
    protocol,
    files,
    ...(old?.own?.length ? { own: old.own } : {}),
  };
  mkdirSync(dirname(pinFile), { recursive: true });
  writeFileSync(pinFile, `${JSON.stringify(pin, null, 2)}\n`);
  console.log(`\nThe copy in ${relative(process.cwd(), dir) || "."} is at ${commit.slice(0, 7)} of ${pin.date}, protocol ${protocol}.`);
} else {
  console.log("Usage: pin.mjs update --dir DIR [--pin FILE] [--ref REF] [--from CLONE] [--dry-run]\n       pin.mjs verify [--dir DIR] [--pin FILE]");
  process.exit(2);
}
