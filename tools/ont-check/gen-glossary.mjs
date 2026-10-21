// Generates the tooltip glossary (window.ONT) from the definition rows of the ontology.
// Usage: node tools/ont-check/gen-glossary.mjs [--config path/to/ont.config.json]
import { writeFileSync } from "node:fs";
import { relative } from "node:path";
import { loadConfig, parseGlossary, read, renderGlossary } from "./lib.mjs";

const arg = process.argv.indexOf("--config");
const cfg = loadConfig(arg > 0 ? process.argv[arg + 1] : "ont.config.json");
if (!cfg.glossaryOut) throw new Error("glossaryOut is not set in the config");
const { ONT } = parseGlossary(read(cfg.ontology));
writeFileSync(cfg.glossaryOut, renderGlossary(ONT, relative(cfg.base, cfg.ontology)));
console.log(`${relative(process.cwd(), cfg.glossaryOut)}: ${Object.keys(ONT).length} concepts`);
