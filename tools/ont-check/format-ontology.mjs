// Writes the parts of the ontology's format that follow from the IDs and the configuration, so that
// nobody has to get them right by hand: definition rows in the order of the configured classes, the
// kind on the first row of each group and an empty Kind cell on the rest, and aligned columns in the
// definition tables. The text and the other tables are left as they are.
// Usage: node tools/ont-check/format-ontology.mjs [--config ont.config.json]
import { writeFileSync } from "node:fs";
import { relative } from "node:path";
import { loadConfig, read } from "./lib.mjs";

const arg = process.argv.indexOf("--config");
const cfg = loadConfig(arg > 0 ? process.argv[arg + 1] : "ont.config.json");
const { classes, kinds } = cfg;

// Cells split on unescaped pipes, so that a `\|` inside a cell survives the rewrite.
const cellsOf = (line) => line.trim().slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim());
const ID_CELL = /^`([a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+)`$/;
// A definition row as the parser reads it: four or five cells, no backticks in Kind, an ID cell.
const isDefinition = (cs) => cs.length >= 4 && cs.length <= 5 && !cs[0].includes("`") && ID_CELL.test(cs[1]);
const classOf = (cs) => cs[1].match(ID_CELL)[1].split(".")[0];
const rank = (cs) => (classes.includes(classOf(cs)) ? classes.indexOf(classOf(cs)) : classes.length);
const isSeparator = (cs) => cs.every((c) => /^:?-+:?$/.test(c));

const md = read(cfg.ontology);
const lines = md.split("\n");
let moved = 0;
for (let i = 0; i < lines.length; i++) {
  if (!lines[i].startsWith("|")) continue;
  let end = i;
  while (end < lines.length && lines[end].startsWith("|")) end++;
  const block = lines.slice(i, end).map(cellsOf);
  const at = block.flatMap((cs, k) => (isDefinition(cs) ? [k] : []));
  if (at.length) {
    const rows = at.map((k) => block[k]);
    const sorted = rows
      .map((cs, n) => ({ cs, n }))
      .sort((a, b) => rank(a.cs) - rank(b.cs) || a.n - b.n)
      .map((x) => x.cs);
    moved += sorted.filter((cs, n) => cs !== rows[n]).length;
    if (kinds)
      sorted.forEach((cs, n) => {
        const label = kinds[classOf(cs)];
        if (label !== undefined) cs[0] = n > 0 && classOf(sorted[n - 1]) === classOf(cs) ? "" : label;
      });
    at.forEach((k, n) => (block[k] = sorted[n]));
    const columns = Math.max(...block.map((cs) => cs.length));
    const width = Array.from({ length: columns }, (_, c) =>
      Math.max(3, ...block.filter((cs) => !isSeparator(cs)).map((cs) => (cs[c] ?? "").length)),
    );
    const out = block.map((cs) =>
      isSeparator(cs)
        ? `| ${width.map((w) => "-".repeat(w)).join(" | ")} |`
        : `| ${width.map((w, c) => (cs[c] ?? "").padEnd(w)).join(" | ")} |`,
    );
    lines.splice(i, end - i, ...out);
  }
  i = end - 1;
}

const formatted = lines.join("\n");
const name = relative(process.cwd(), cfg.ontology);
if (formatted === md) console.log(`${name}: already formatted`);
else {
  writeFileSync(cfg.ontology, formatted);
  console.log(`${name}: formatted${moved ? `, ${moved} rows moved into kind order` : ""}`);
}
