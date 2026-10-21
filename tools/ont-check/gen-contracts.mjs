// Generates the contracts (JSON Schema, one definition per entity) from the Type cells of the
// ontology's field and relation rows.
// Usage: node tools/ont-check/gen-contracts.mjs [--config path/to/ont.config.json]
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { buildContracts, renderContracts } from "./contracts.mjs";
import { loadConfig, parseGlossary, read } from "./lib.mjs";

const arg = process.argv.indexOf("--config");
const cfg = loadConfig(arg > 0 ? process.argv[arg + 1] : "ont.config.json");
if (!cfg.contracts) throw new Error("contracts is not set in the config");
const { ONT, rows } = parseGlossary(read(cfg.ontology));
const { problems, schema } = buildContracts(rows, ONT, cfg);
if (problems.length) {
  console.log(`ERROR · types that cannot become a contract (${problems.length}):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
mkdirSync(dirname(cfg.contracts.out), { recursive: true });
writeFileSync(cfg.contracts.out, renderContracts(schema));
console.log(`${relative(process.cwd(), cfg.contracts.out)}: ${Object.keys(schema.$defs).length} entities`);
