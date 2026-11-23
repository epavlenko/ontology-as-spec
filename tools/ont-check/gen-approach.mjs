// Writes the approach's concept IDs, retired IDs and checks of review and of run to the file named by
// approachIds.out (D-53, D-155), so that they travel with the tool and a project's check can resolve the
// rules of the approach that its agent instructions and process entries name, and hand its checks to a
// reviewer. Each check of run carries the path, the anchor and the hash of its section in the approach's
// run guide, the doc set that lists checks: ["run"] (D-156); a check of run with no section there, or
// whose section has no heading to anchor, fails the generator. Run in the approach's own repository.
// Usage: node tools/ont-check/gen-approach.mjs [--config ont.config.json]
// ont: concept.approach-ids
import { existsSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseAnchors } from "./docs.mjs";
import { docSetFiles, guideSections, headingAnchor, loadConfig, parseChecks, parseGlossary, parseRetired, read, renderApproach } from "./lib.mjs";

const arg = process.argv.indexOf("--config");
const cfg = loadConfig(arg > 0 ? process.argv[arg + 1] : "ont.config.json");
if (!cfg.approachIds) throw new Error("no approachIds in the config: only the approach's own repository generates them");
const md = read(cfg.ontology);
const { ONT } = parseGlossary(md);
const checks = cfg.checks ? parseChecks(read(cfg.checks.file)) : [];
const guides = guideSections(cfg.docSets.filter((d) => d.checks.includes("run")).flatMap((d) => docSetFiles(d)), cfg.base, parseAnchors);
// Each check of run has its section, and the anchor is a heading of the page it names.
const missing = checks
  .filter((c) => c.proof === "run")
  .flatMap((c) => {
    const g = guides.get(c.id);
    if (!g) return [`${c.id}: no section of a run guide names it`];
    const page = join(cfg.base, g.path);
    const anchors = existsSync(page) ? [...read(page).matchAll(/^#{2,3}[ \t]+(.+?)[ \t#]*$/gm)].map((m) => m[1]) : [];
    return g.anchor && anchors.some((h) => headingAnchor(h) === g.anchor) ? [] : [`${c.id}: the anchor #${g.anchor} is no heading of ${g.path}`];
  });
if (missing.length) {
  console.log(`ERROR · checks of run without a section of the run guide (${missing.length}):\n  ${missing.join("\n  ")}`);
  process.exit(1);
}
writeFileSync(cfg.approachIds.out, renderApproach(ONT, parseRetired(md, cfg.headings.retired), checks, guides));
console.log(`${relative(process.cwd(), cfg.approachIds.out)}: ${Object.keys(ONT).length} IDs, ${checks.filter((c) => c.proof === "review").length} checks of review, ${checks.filter((c) => c.proof === "run").length} of run`);
