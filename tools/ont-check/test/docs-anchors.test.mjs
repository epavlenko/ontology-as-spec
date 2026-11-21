// The approach's docs explain every concept of the releases of the protocol and of a product, of the
// deployment and of a task's statement, result and spend, with the task's budget and the lines a round
// gives for them: each is named by an anchor of a section of the approach's doc set (round 1 of the
// review of the result of task releases-and-task).
// ont: edge.doc-section.explains
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseAnchors } from "../docs.mjs";
import { docSetFiles, loadConfig, parseGlossary } from "../lib.mjs";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const cfg = loadConfig(`${ROOT}ont.config.json`);
const { rows } = parseGlossary(readFileSync(cfg.ontology, "utf8"));
const OWNERS = ["protocol-release", "product-release", "deployment", "task-statement", "task-result", "task-spend"];
const OF_ROUND = ["field.review-round.start", "field.review-round.contribution", "field.review-round.acceptance", "field.review-round.overspend", "edge.review-round.statement", "derived.task-budget"];

test("[check.doc-section.task-release-anchored] every concept of releases, deployments and tasks, the budget and the lines of a round for them is anchored in the approach's docs", () => {
  const ids = rows.map((r) => r.id).filter((id) => OWNERS.includes(id.split(".")[1]) || OF_ROUND.includes(id));
  assert.ok(ids.length >= 40, `only ${ids.length} concepts found`);
  const approach = cfg.docSets.find((d) => d.name === "approach");
  const generated = new Set(cfg.references.map((r) => r.out));
  const anchored = new Set(
    docSetFiles(approach)
      .filter((f) => !generated.has(f))
      .flatMap((f) => parseAnchors(readFileSync(f, "utf8")).flatMap((a) => a.refs.map((r) => r.id))),
  );
  assert.deepEqual(ids.filter((id) => !anchored.has(id)), []);
});
