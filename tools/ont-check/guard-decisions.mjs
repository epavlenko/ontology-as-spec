// Guards the decision log: an accepted entry is never edited or removed. Compares every entry that
// was accepted in an earlier commit with the current version of the log and fails if any changed.
// New entries, tentative entries and the other sections (open questions, history) may change freely.
// Usage: node tools/ont-check/guard-decisions.mjs [--config ont.config.json]... [--file decisions.md]...
//          [--base REF] [--staged]
// --base   the commit to compare with; default HEAD
// --staged compare the staged version (for a pre-commit hook) instead of the working tree
// Exit code 1 on any change. Prints GUARD_OK when every accepted entry is intact, and GUARD_OFF when
// there is no commit yet to compare with: before the first commit nothing is protected. Accepted entries
// that are not in the commit yet are listed as information, since they are protected only once committed.
// Once the log names a source on a Source line, every entry accepted after the first source must name one.
// A definition changed since the base must be named by a new or changed decision entry or a new history line.
// ont: inv.accepted-never-edited, field.decision.source, inv.sourced-since-first
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { backtickIds, DEFAULT_ACCEPTED, DEFAULT_SOURCE, loadConfig, parseGlossary, read, section } from "./lib.mjs";

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
    const { file, entry, accepted, sourceLine } = cfg.decisions;
    return { file, entry: entry.source, accepted, sourceLine, ontology: cfg.ontology, history: cfg.headings.history, classes: cfg.classes };
  }),
  ...files.map((f) => ({
    file: resolve(f),
    entry: DEFAULT_ENTRY,
    accepted: new RegExp(DEFAULT_ACCEPTED, "im"),
    sourceLine: new RegExp(DEFAULT_SOURCE, "im"),
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
let unsourcedCount = 0;
let silentCount = 0;
for (const { file, entry, accepted, sourceLine, ontology, history, classes } of targets) {
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
  // A log the base does not have yet protects nothing, but the entries it accepts still need sources.
  if (before.status !== 0) console.log(`info · ${name}: not in ${base}, no accepted entry to protect yet`);
  const now = staged ? git(cwd, "show", `:${path}`).stdout : existsSync(file) ? read(file) : "";
  const old = before.status !== 0 ? new Map() : entries(before.stdout, entry);
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
  // An accepted entry the commit does not have yet is not protected until it is committed (D-42).
  const fresh = [...cur]
    .filter(([id, b]) => accepted.test(b) && !(old.has(id) && accepted.test(old.get(id))))
    .map(([id]) => id);
  if (fresh.length && !staged)
    console.log(`info · ${name}: accepted entries not in ${base} yet, protected once committed (${fresh.length}): ${fresh.join(", ")}`);
  // Once the log names a source, every entry accepted after that names its own (D-47): where it was
  // decided, or the owner's answer that accepted it. If the base already named sources, that is every
  // entry accepted since the base. If the first source came later, the guard cannot tell which entries
  // were accepted before it, and asks only entries numbered after the first one with a source; those
  // before it were accepted earlier or are older entries, which cannot be edited to add one.
  const number = (id) => (/\d/.test(id) ? Number(id.replace(/\D+/g, "")) : null);
  const adopted = [...old.values()].some((b) => sourceLine.test(b));
  const first = Math.min(...[...cur].filter(([, b]) => sourceLine.test(b)).map(([id]) => number(id) ?? Infinity));
  const unsourced = fresh.filter(
    (id) => !sourceLine.test(cur.get(id)) && (adopted || (number(id) !== null && number(id) > first)),
  );
  if (unsourced.length) {
    console.log(`ERROR · ${name}: entries accepted since ${base} without a source, while the log names sources (${unsourced.length}): ${unsourced.join(", ")}`);
    errors.push("unsourced");
    unsourcedCount += unsourced.length;
  }
  // A definition whose term, type or definition changed since the base is named by a decision entry
  // added or changed since then, or by a line added to the revision history (D-59). New and removed
  // rows follow their own rules; the Kind cell and the alignment are formatting, not meaning.
  // ont: derived.meaning-changed
  if (ontology) {
    const ontPath = `./${basename(ontology)}`;
    const was = git(dirname(ontology), "show", `${base}:${ontPath}`);
    if (was.status === 0) {
      const is = staged ? git(dirname(ontology), "show", `:${ontPath}`).stdout : existsSync(ontology) ? read(ontology) : "";
      const meaning = (md) => {
        const { ONT, rows } = parseGlossary(md);
        const norm = (t) => (t ?? "").replace(/\s+/g, " ").trim();
        return new Map(rows.map((r) => [r.id, [ONT[r.id].name, r.type, ONT[r.id].def].map(norm).join(" | ")]));
      };
      const [before, after] = [meaning(was.stdout), meaning(is)];
      const historyLines = (md) => new Set(md.includes(history) ? section(md, history).split("\n").filter((l) => l.trim()) : []);
      const oldHistory = historyLines(was.stdout);
      const named = new Set([
        ...[...cur].filter(([id, b]) => old.get(id) !== b).flatMap(([, b]) => backtickIds(b, classes)),
        ...[...historyLines(is)].filter((l) => !oldHistory.has(l)).flatMap((l) => backtickIds(l, classes)),
      ]);
      const silent = [...after].filter(([id, m]) => before.has(id) && before.get(id) !== m && !named.has(id)).map(([id]) => id);
      if (silent.length) {
        console.log(`ERROR · ${relative(process.cwd(), ontology)}: definitions changed since ${base} with no decision entry or history line naming them (${silent.length}): ${silent.join(", ")}`);
        errors.push("silent");
        silentCount += silent.length;
      }
    }
  }
  console.log(`${name}: ${[...old.values()].filter((b) => accepted.test(b)).length} accepted entries in ${base}`);
}

if (errors.length) {
  if (violations) console.log("Write a new entry that supersedes the old one instead of editing it.");
  if (unsourcedCount) console.log("Name on a Source line where each was decided, or the owner's answer that accepted it.");
  if (silentCount) console.log("Add a line to the revision history that names each changed definition, or a decision entry when the change rests on a choice.");
  console.log(`DRIFT: ${errors.length}`);
  process.exit(1);
}
console.log(off.length ? "GUARD_OFF" : "GUARD_OK");
