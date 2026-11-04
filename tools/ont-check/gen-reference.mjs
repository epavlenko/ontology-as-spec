// Generates the reference pages listed under "references" in the config: the ontology's concepts by
// section and, if asked, the checks of each section. Only what the ontology and the catalogue already
// say; explanations are written from the ontology, by a person or an agent, and anchored (see docs.mjs).
// Usage: node tools/ont-check/gen-reference.mjs [--config path/to/ont.config.json]
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { renderReference } from "./docs.mjs";
import { loadConfig, parseChecks, parseGlossary, parseImplemented, read } from "./lib.mjs";

const arg = process.argv.indexOf("--config");
const cfg = loadConfig(arg > 0 ? process.argv[arg + 1] : "ont.config.json");
if (!cfg.references.length) throw new Error("references is not set in the config");
const md = read(cfg.ontology);
const { ONT, rows } = parseGlossary(md);
const implemented = new Set(parseImplemented(md, cfg.headings.implementation).map(([id]) => id));
const checks = cfg.checks ? parseChecks(read(cfg.checks.file)) : [];
for (const ref of cfg.references) {
  const page = renderReference(ref, {
    ONT,
    rows,
    checks,
    implemented,
    kinds: cfg.kinds,
    sourceName: relative(dirname(ref.out), cfg.ontology),
  });
  mkdirSync(dirname(ref.out), { recursive: true });
  writeFileSync(ref.out, page);
  console.log(`${relative(process.cwd(), ref.out)}: ${ref.title}`);
}
