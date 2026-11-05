// Writes the approach's concept IDs, retired IDs and manual checks to the file named by approachIds.out (D-53), so
// that they travel with the tool and a project's check can resolve the rules of the approach that its
// agent instructions and process entries name. Run in the approach's own repository.
// Usage: node tools/ont-check/gen-approach.mjs [--config ont.config.json]
// ont: concept.approach-ids
import { writeFileSync } from "node:fs";
import { relative } from "node:path";
import { loadConfig, parseChecks, parseGlossary, parseRetired, read, renderApproach } from "./lib.mjs";

const arg = process.argv.indexOf("--config");
const cfg = loadConfig(arg > 0 ? process.argv[arg + 1] : "ont.config.json");
if (!cfg.approachIds) throw new Error("no approachIds in the config: only the approach's own repository generates them");
const md = read(cfg.ontology);
const { ONT } = parseGlossary(md);
const checks = cfg.checks ? parseChecks(read(cfg.checks.file)) : [];
writeFileSync(cfg.approachIds.out, renderApproach(ONT, parseRetired(md, cfg.headings.retired), checks));
console.log(`${relative(process.cwd(), cfg.approachIds.out)}: ${Object.keys(ONT).length} IDs`);
