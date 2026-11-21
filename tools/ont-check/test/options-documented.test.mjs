// Every file of the tool, every flag a script of the tool reads and every key of the configuration it
// reads is described in the tool's README (D-96). The keys are the loader's own table, CONFIG_KEYS: the
// loader reads the configuration only through guardConfig, which refuses any other key, so the table
// cannot fall behind the code however the code is written.
// ont: inv.tool-options-documented
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { CONFIG_KEYS, guardConfig, loadConfig } from "../lib.mjs";

const TOOLS = fileURLToPath(new URL("../", import.meta.url));
const readme = readFileSync(`${TOOLS}README.md`, "utf8");
const scripts = readdirSync(TOOLS).filter((f) => f.endsWith(".mjs"));

// The flags a script reads from its command line, by the helpers the scripts use to read them; other
// strings that start with two dashes, such as the arguments the tool passes to git, are not its flags.
export const flagsOf = (text) =>
  new Set([...text.matchAll(/\b(?:flag|opt|value|values|includes|indexOf)\("(--[a-z][a-z-]*)"\)/g)].map((m) => m[1]));
// A key is described when the README names it, or one of its subkeys, in backticks; a key of a list
// item is described when the row of its list names it in quotes, as `{ "name", "dir" }` does.
const rowOf = (text, k) => text.split("\n").find((l) => l.startsWith(`| \`${k}\``)) ?? "";
const describesKey = (text, k) => {
  const item = k.match(/^([a-zA-Z.]+)\[\]\.([a-zA-Z]+)$/);
  if (item) return rowOf(text, item[1]).includes(`"${item[2]}"`);
  return new RegExp("`" + k.replaceAll(".", "\\.") + "(?:\\.[a-zA-Z]+)*`").test(text);
};
const describesFlag = (text, f) => new RegExp(`${f}(?![a-z-])`).test(text);
const undocumented = (text) => ({
  files: scripts.filter((f) => !text.includes(`| \`${f}\``)).sort(),
  flags: [...new Set(scripts.flatMap((f) => [...flagsOf(readFileSync(TOOLS + f, "utf8"))]))].filter((f) => !describesFlag(text, f)).sort(),
  keys: CONFIG_KEYS.filter((k) => !describesKey(text, k)).sort(),
});

test("[check.tool-copy.options-documented] every file, flag and configuration key is in the tool's README", () => {
  assert.ok(flagsOf(readFileSync(`${TOOLS}ont-check.mjs`, "utf8")).has("--run"));
  for (const k of ["oracle", "manualRuns.dir", "codeNames.owner", "docSets[].files", "testSuites[].checks", "checks.axes[].each", "headings.otherWords"])
    assert.ok(CONFIG_KEYS.includes(k), k);
  assert.deepEqual(undocumented(readme), { files: [], flags: [], keys: [] });
});

test("[check.tool-copy.options-documented] a file, a flag or a key taken out of the README fails", () => {
  const without = readme
    .replace("| `oracle.mjs`", "| x")
    .replaceAll("--run", "--xx")
    .replace(/`oracle(?:\.[a-zA-Z]+)*`/g, "`x`")
    .replace("`manualRuns.dir`", "`x`")
    .replace('"files", ', "")
    .replace('{ "name", "values", "each" }', "{ }");
  const r = undocumented(without);
  assert.ok(r.files.includes("oracle.mjs"), JSON.stringify(r));
  assert.ok(r.flags.includes("--run"), JSON.stringify(r));
  for (const k of ["oracle", "manualRuns.dir", "docSets[].files", "checks.axes[].name", "checks.axes[].values", "checks.axes[].each"])
    assert.ok(r.keys.includes(k), JSON.stringify(r));
});

test("[check.tool-copy.options-documented] the loader cannot read a key its table does not list", () => {
  const refused = /configuration key (\S+) is read by the loader but not listed in CONFIG_KEYS/;
  // At the top, in an object, in an item of a list, in a list inside an object: however the code reads it.
  assert.throws(() => guardConfig({ secret: 1 }).secret, refused);
  assert.throws(() => guardConfig({ manualRuns: { dir: "r", secret: 1 } }).manualRuns.secret, refused);
  assert.throws(() => guardConfig({ docSets: [{ name: "a", secret: 1 }] }).docSets.map(({ secret }) => secret), refused);
  assert.throws(() => [...guardConfig({ checks: { axes: [{ secret: 1 }] } }).checks.axes].map(($axis) => $axis?.secret), refused);
  assert.throws(() => guardConfig({ docSets: [{}] }).docSets.map ((axis$) => axis$ ["secret"]), refused);
  // Nor through a descriptor, `in`, Reflect, or the keys and entries of an object.
  assert.throws(() => Object.getOwnPropertyDescriptor(guardConfig({ hiddenRoot: "x" }), "hiddenRoot")?.value, refused);
  assert.throws(() => "hiddenRoot" in guardConfig({}), refused);
  assert.throws(() => Reflect.get(guardConfig({ hiddenRoot: "x" }), "hiddenRoot"), refused);
  assert.deepEqual(Object.keys(guardConfig({ root: ".", hiddenRoot: "x" })), ["root"]);
  assert.deepEqual(Object.entries(guardConfig({ root: ".", hiddenRoot: "x" })), [["root", "."]]);
  assert.deepEqual({ ...guardConfig({ root: ".", hiddenRoot: "x" }) }, { root: "." });
  // A descriptor of a listed key gives its value guarded too.
  const nested = Object.getOwnPropertyDescriptor(guardConfig({ manualRuns: { dir: "r", secret: 1 } }), "manualRuns").value;
  assert.throws(() => nested.secret, refused);
  // What the table lists is read as it is; the project's own classes are free.
  const ok = guardConfig({ docSets: [{ name: "a", files: ["x.md"] }], classes: { ent: "Entity", anything: "x" } });
  assert.deepEqual(ok.docSets.map((d) => [d.name, [...d.files]]), [["a", ["x.md"]]]);
  assert.equal(ok.classes.anything, "x");
  // The loader reads the configuration through the guard, and parses it nowhere else.
  const lib = readFileSync(`${TOOLS}lib.mjs`, "utf8");
  const start = lib.indexOf("export function loadConfig");
  const body = lib.slice(start, lib.indexOf("\n}\n", start));
  assert.match(body, /const raw = guardConfig\(JSON\.parse\(/);
  assert.equal(body.match(/JSON\.parse/g).length, 1);
  // and reads the file once, so its text is not parsed again around the guard.
  assert.equal(body.match(/\bread(?:FileSync)?\(/g).length, 1);
});

test("[check.tool-copy.options-documented] a configuration with every key of the table loads", () => {
  // Every branch of the loader runs, so a key read only in one of them is still checked against the table.
  const dir = mkdtempSync(join(tmpdir(), "every-key-"));
  try {
    const every = {
      classes: { ent: "Entity", field: "Field" },
      scoped: ["field"],
      ontology: "ontology.md",
      root: ".",
      agentInstructions: ["AGENTS.md"],
      glossaryOut: "g.js",
      mockup: ["m.html"],
      notYetShown: ["view"],
      oracle: true,
      adapter: "app/adapter.mjs",
      systemTests: ["traces/traces.test.mjs"],
      headings: { implementation: null, retired: "## R", otherWords: "## O", divergences: "### D", history: "## H" },
      decisions: { file: "d.md", entry: "^### (D-\\d+)", ref: "D-\\d+", accepted: "a", supersedes: "s", source: "s", returnWhen: "r", processLayer: "p", extends: "e", overrides: "o" },
      code: [{ dir: "src", match: "\\.js$" }],
      reviewPaths: [{ dir: "data", concepts: ["ent.x"] }],
      manualRuns: { dir: "runs", require: true },
      records: { latinOnly: true },
      reviewRounds: { dir: "rounds", gatesFrom: "2026-11-21T09:35:15Z" },
      taskRecords: { dir: "tasks" },
      protocolReleases: { file: "releases.md" },
      releases: { dir: "releases", pin: "tools/ontology-as-spec/upstream.json", tool: "tools/ontology-as-spec" },
      budget: { newInput: 1000, output: 500, reserve: 1.5 },
      codeNames: { require: true, owner: true },
      approachIds: { out: "a.json" },
      contracts: { out: "c.json", classes: ["field"], propertyCase: "camel" },
      map: { file: "map.md", idColumn: 2 },
      features: { dir: "f", cover: ["rule"] },
      tests: { dir: "t", match: "\\.test\\.js$", cover: ["rule"], checks: [] },
      testSuites: [{ name: "unit", dir: "u", match: "\\.js$", cover: ["inv"], checks: [] }],
      checks: { file: "checks.md", require: ["rule"], axes: ["outcome", { name: "time", values: ["now"], each: ["rule"] }], cannotOccur: "^- No:" },
      tickets: { dir: "issues", match: "\\.md$" },
      docSets: [{ name: "help", dir: "help", match: "\\.md$", cover: [], checks: [], scope: "all" }, { name: "pages", files: ["README.md"] }],
      references: [{ out: "r.md", title: "R", intro: "i", classes: ["ent"], implementedOnly: true, ids: true, kinds: true, types: true, checks: true }],
      external: [{ ontology: "e.md", checks: "ec.md" }],
    };
    // The fixture gives every key of the table.
    const has = (obj, parts) => {
      if (!parts.length) return true;
      const [p, ...rest] = parts;
      const name = p.replace("[]", "");
      if (!(name in obj)) return false;
      return p.endsWith("[]") ? obj[name].some((x) => typeof x === "object" && has(x, rest)) : has(obj[name], rest);
    };
    for (const k of CONFIG_KEYS) assert.ok(has(every, k.split(".")), `the fixture leaves out ${k}`);
    const path = join(dir, "ont.config.json");
    writeFileSync(path, JSON.stringify(every));
    const cfg = loadConfig(path);
    assert.equal(cfg.docSets[1].files.length, 1);
    assert.equal(cfg.checks.axes[1].name, "time");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
