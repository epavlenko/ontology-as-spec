// Every file of the tool, every flag a script of the tool reads and every key of the configuration it reads is described in
// the tool's README (D-96).
// ont: inv.tool-options-documented
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const TOOLS = fileURLToPath(new URL("../", import.meta.url));
const readme = readFileSync(`${TOOLS}README.md`, "utf8");
const scripts = readdirSync(TOOLS).filter((f) => f.endsWith(".mjs"));

// The flags a script reads from its command line, by the helpers the scripts use to read them; other
// strings that start with two dashes, such as the arguments the tool passes to git, are not its flags.
export const flagsOf = (text) =>
  new Set([...text.matchAll(/\b(?:flag|opt|value|values|includes|indexOf)\("(--[a-z][a-z-]*)"\)/g)].map((m) => m[1]));
// A list: a key of the configuration, `raw.docSets` or `raw.checks.axes`, mapped item by item; its
// path, "checks.axes", and the name of its item.
export const listsOf = (text) => [...text.matchAll(/\braw\.((?:[a-zA-Z]+\??\.)*[a-zA-Z]+) \?\? \[\]\)(?:,?\s*\])?\.map\(\s*\(?([A-Za-z_$][\w$]*)\)? =>/g)].map((m) => Object.assign(m, { 1: m[1].replaceAll("?", "") }));
// The keys the loader reads from the configuration: a top-level key, `raw.manualRuns`; a key of an
// object, `raw.manualRuns.dir` or `raw.codeNames?.owner`, as "manualRuns.dir"; and a key of each item
// of a list, `(raw.docSets ?? []).map((d) => … d.files …)`, as "docSets[].files".
export const keysOf = (text) => {
  const keys = new Set();
  for (const m of text.matchAll(/\braw\.([a-zA-Z]+)(?:\??\.([a-zA-Z]+))?/g)) {
    keys.add(m[1]);
    if (m[2] && m[2] !== "map") keys.add(`${m[1]}.${m[2]}`);
  }
  // A list: the first .map after the key, its item's name, and the keys read on the item up to the
  // end of the call.
  for (const m of listsOf(text)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const open = text.lastIndexOf(".map(", i) + 4;
    for (i = open + 1; i < text.length && depth > 0; i++) depth += text[i] === "(" ? 1 : text[i] === ")" ? -1 : 0;
    for (const k of text.slice(open, i).matchAll(new RegExp(`\\b${m[2]}\\.([a-zA-Z]+)`, "g"))) keys.add(`${m[1]}[].${k[1]}`);
  }
  return keys;
};
// A key is described when the README names it, or one of its subkeys, in backticks; a key of a list
// item is described when the row of its list names it in quotes, as `{ "name", "dir" }` does.
const rowOf = (text, k) => text.split("\n").find((l) => l.startsWith(`| \`${k}\``)) ?? "";
const describesKey = (text, k) => {
  const item = k.match(/^([a-zA-Z.]+)\[\]\.([a-zA-Z]+)$/);
  if (item) return rowOf(text, item[1]).includes(`"${item[2]}"`);
  return new RegExp("`" + k.replace(".", "\\.") + "(?:\\.[a-zA-Z]+)*`").test(text);
};
const describesFlag = (text, f) => new RegExp(`${f}(?![a-z-])`).test(text);
const undocumented = (text) => ({
  files: scripts.filter((f) => !text.includes(`| \`${f}\``)).sort(),
  flags: [...new Set(scripts.flatMap((f) => [...flagsOf(readFileSync(TOOLS + f, "utf8"))]))].filter((f) => !describesFlag(text, f)).sort(),
  keys: [...keysOf(readFileSync(`${TOOLS}lib.mjs`, "utf8"))].filter((k) => !describesKey(text, k)).sort(),
});

test("[check.tool-copy.options-documented] every flag and configuration key is in the tool's README", () => {
  assert.ok(flagsOf(readFileSync(`${TOOLS}ont-check.mjs`, "utf8")).has("--run"));
  const keys = keysOf(readFileSync(`${TOOLS}lib.mjs`, "utf8"));
  for (const k of ["oracle", "manualRuns.dir", "codeNames.owner", "docSets[].files", "testSuites[].checks"]) assert.ok(keys.has(k), k);
  assert.deepEqual(undocumented(readme), { files: [], flags: [], keys: [] });
});

test("[check.tool-copy.options-documented] the loader names every key it passes on, so the test sees each one", () => {
  // An object spread from the configuration, `...raw.headings` or `...r` of a list item, would pass on
  // keys the test cannot see.
  const loader = readFileSync(`${TOOLS}lib.mjs`, "utf8");
  assert.deepEqual(loader.match(/\.\.\.(?:raw\.[a-zA-Z]+|[a-z])\s*[,}]/g), null);
  const keys = keysOf(loader);
  for (const k of ["headings.otherWords", "headings.history", "references[].title", "checks.axes[].each", "tests.cover"]) assert.ok(keys.has(k), k);
  // Every list the loader maps item by item is one the test reads, so a key of its items is not missed.
  const body = loader.slice(loader.indexOf("export function loadConfig"), loader.indexOf("\n}\n", loader.indexOf("export function loadConfig")));
  // Every .map in the loader's body but .map(at), which maps paths, is a list the test reads, whatever
  // its item is called or however it is written.
  const mapped = body.match(/\.map\(/g).length - (body.match(/\.map\(at\)/g) ?? []).length;
  assert.equal(listsOf(body).length, mapped, "a list of the configuration the test does not read");
  // A list added under another name, or with its item destructured, is caught.
  for (const added of ["axesCopy: (raw.checks.axes ?? []).map((axis) => axis.secret),", "names: (raw.docSets ?? []).map(({ name }) => name),"]) {
    const more = body.replace("return {", `return {\n    ${added}`);
    const counted = more.match(/\.map\(/g).length - (more.match(/\.map\(at\)/g) ?? []).length;
    const fails = listsOf(more).length !== counted || [...keysOf(more)].some((k) => !describesKey(readme, k));
    assert.ok(fails, `not caught: ${added}`);
  }
});

test("[check.tool-copy.options-documented] a flag or a key taken out of the README fails", () => {
  const without = readme.replace("| `oracle.mjs`", "| x").replaceAll("--run", "--xx").replace(/`oracle(?:\.[a-zA-Z]+)*`/g, "`x`");
  const r = undocumented(without);
  assert.ok(r.flags.includes("--run"), JSON.stringify(r));
  assert.ok(r.keys.includes("oracle"), JSON.stringify(r));
  assert.ok(r.files.includes("oracle.mjs"), JSON.stringify(r));
  // A key of an object and a key of a list item, taken out of their rows, fail too.
  const nested = undocumented(
    readme.replace("`manualRuns.dir`", "`x`").replace('"files", ', "").replace("`headings.history`", "`x`").replace('"title", ', "").replace('{ "name", "values", "each" }', "{ }"),
  );
  assert.ok(nested.keys.includes("headings.history"), JSON.stringify(nested));
  assert.ok(nested.keys.includes("references[].title"), JSON.stringify(nested));
  for (const k of ["checks.axes[].name", "checks.axes[].values", "checks.axes[].each"]) assert.ok(nested.keys.includes(k), JSON.stringify(nested));
  assert.ok(nested.keys.includes("manualRuns.dir"), JSON.stringify(nested));
  assert.ok(nested.keys.includes("docSets[].files"), JSON.stringify(nested));
});
