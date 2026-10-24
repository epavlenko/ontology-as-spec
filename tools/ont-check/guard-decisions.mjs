// Guards the decision log: an accepted entry is never edited or removed. Compares every entry that
// was accepted in an earlier commit with the current version of the log and fails if any changed.
// New entries, tentative entries and the other sections (open questions, history) may change freely.
// Usage: node tools/ont-check/guard-decisions.mjs [--config ont.config.json]... [--file decisions.md]...
//          [--base REF] [--staged]
// --base   the commit to compare with; default HEAD
// --staged compare the staged version (for a pre-commit hook) instead of the working tree
// Exit code 1 on any change. Prints GUARD_OK when every accepted entry is intact, and GUARD_OFF when
// there is no commit yet to compare with: before the first commit nothing is protected.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { DEFAULT_ACCEPTED, loadConfig, read } from "./lib.mjs";

const argv = process.argv.slice(2);
const values = (flag) => argv.flatMap((a, i) => (argv[i - 1] === flag ? [a] : []));
const named = values("--base").at(-1);
const base = named ?? "HEAD";
const staged = argv.includes("--staged");
const DEFAULT_ENTRY = "^### (D-\\d+) · .+$";

const configs = values("--config");
const files = values("--file");
if (!configs.length && !files.length) configs.push("ont.config.json");
const targets = [
  ...configs.map((c) => {
    const cfg = loadConfig(c);
    if (!cfg.decisions) throw new Error(`${c}: no decisions file in the config`);
    const { file, entry, accepted } = cfg.decisions;
    return { file, entry: entry.source, accepted };
  }),
  ...files.map((f) => ({
    file: resolve(f),
    entry: DEFAULT_ENTRY,
    accepted: new RegExp(DEFAULT_ACCEPTED, "im"),
  })),
];

const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8" });

// Entries keyed by number: the text from the heading to the next heading of level 1 to 3.
const entries = (text, entry) => {
  const re = new RegExp(entry, "gm");
  const heads = [...text.matchAll(re)];
  return new Map(
    heads.map((m) => {
      const rest = text.slice(m.index + m[0].length);
      const end = rest.search(/\n#{1,3} /);
      const body = m[0] + (end < 0 ? rest : rest.slice(0, end));
      return [m[1], body.replace(/[ \t]+$/gm, "").trimEnd()];
    }),
  );
};

const errors = [];
const off = [];
let violations = 0;
for (const { file, entry, accepted } of targets) {
  const cwd = dirname(file);
  const path = `./${basename(file)}`;
  const name = relative(process.cwd(), file);
  if (git(cwd, "rev-parse", "--verify", "--quiet", `${base}^{commit}`).status !== 0) {
    // Without a commit there is nothing to compare with. Failing here would be a failure without a
    // violation, so the guard says that it is off instead. A base that was named and is missing is an
    // error, as in CI with a wrong base.
    if (!named) {
      const repo = git(cwd, "rev-parse", "--git-dir").status === 0;
      console.log(
        `GUARD_OFF · ${name}: ${repo ? "no commit yet" : "not a git repository"}; accepted entries are not protected until the first commit`,
      );
      off.push(name);
      continue;
    }
    console.log(`ERROR · ${name}: commit ${base} not found`);
    errors.push(name);
    continue;
  }
  const before = git(cwd, "show", `${base}:${path}`);
  if (before.status !== 0) {
    console.log(`info · ${name}: not in ${base}, nothing to guard`);
    continue;
  }
  const now = staged ? git(cwd, "show", `:${path}`).stdout : existsSync(file) ? read(file) : "";
  const old = entries(before.stdout, entry);
  const cur = entries(now, entry);
  const changed = [];
  const removed = [];
  for (const [id, body] of old) {
    if (!accepted.test(body)) continue;
    if (!cur.has(id)) removed.push(id);
    else if (cur.get(id) !== body) {
      const a = body.split("\n");
      const b = cur.get(id).split("\n");
      const i = a.findIndex((l, n) => l !== b[n]);
      changed.push(`${id}, first change: ${(b[i < 0 ? a.length : i] ?? "(lines removed)").slice(0, 90)}`);
    }
  }
  for (const [label, items] of [
    [`accepted entries edited since ${base}`, changed],
    [`accepted entries removed since ${base}`, removed],
  ])
    if (items.length) {
      console.log(`ERROR · ${name}: ${label} (${items.length}):\n  ${items.join("\n  ")}`);
      errors.push(label);
      violations += items.length;
    }
  console.log(`${name}: ${[...old.values()].filter((b) => accepted.test(b)).length} accepted entries in ${base}`);
}

if (errors.length) {
  if (violations) console.log("Write a new entry that supersedes the old one instead of editing it.");
  console.log(`DRIFT: ${errors.length}`);
  process.exit(1);
}
console.log(off.length ? "GUARD_OFF" : "GUARD_OK");
