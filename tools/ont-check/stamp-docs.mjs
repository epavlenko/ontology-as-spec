// Stamps the anchors of hand-written documentation with the current stamps of the concepts and checks
// they name: run it after rereading the sections the check listed as anchored to something changed.
// Usage: node tools/ont-check/stamp-docs.mjs [--config path/to/ont.config.json] [file.md ...]
// Without files, stamps every page of every doc set.
import { readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { stampAnchors, stampOf } from "./docs.mjs";
import { listFiles, loadConfig, parseChecks, parseGlossary, read } from "./lib.mjs";

const argv = process.argv.slice(2);
const arg = argv.indexOf("--config");
const cfg = loadConfig(arg >= 0 ? argv[arg + 1] : "ont.config.json");
const only = argv.filter((a, i) => a.endsWith(".md") && argv[i - 1] !== "--config").map((f) => resolve(f));
const { ONT, rows, notes } = parseGlossary(read(cfg.ontology));
const checks = cfg.checks ? parseChecks(read(cfg.checks.file)) : [];
const checkById = new Map(checks.map((c) => [c.id, c]));
const generated = new Set(cfg.references.map((r) => r.out));
const files = cfg.docSets
  .flatMap((d) => listFiles(d.dir, d.match))
  .filter((f) => !generated.has(f) && (!only.length || only.includes(f)));
for (const f of files) {
  const before = readFileSync(f, "utf8");
  const after = stampAnchors(before, (id) => stampOf(id, ONT, rows, checkById, notes));
  if (after !== before) {
    writeFileSync(f, after);
    console.log(`stamped ${relative(process.cwd(), f)}`);
  }
}
