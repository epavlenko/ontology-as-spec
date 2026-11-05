// The checks to review for a change (D-77): the manual checks of the project whose concepts the change
// touches, and the manual checks of the approach for the kinds of artifact it touches. A reviewer that
// did not write the change gives each of them a verdict (skills/change-review).
// ont: derived.review-checks
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { parseAnchors } from "./docs.mjs";
import { codeNames, parseChecks, parseGlossary } from "./lib.mjs";

// Sections of the approach's catalogue whose manual checks concern each kind of artifact.
export const KIND_SECTIONS = {
  ontology: ["Concept", "Retired ID"],
  decisions: ["Decision"],
  catalogue: ["Check"],
  code: ["Implementation row", "Divergence"],
  mockup: ["Mockup element", "Map row"],
  tests: ["Test", "Check", "Test suite"],
  docs: ["Doc section", "Doc set", "Reference page"],
  tickets: ["Ticket"],
  "agent rules": ["Agent rules"],
};
// Checks of the Concept section that concern the code rather than the rows (D-73).
const CODE_CONCEPT_CHECKS = ["check.concept.code-from-ontology", "check.concept.ontology-changed-first"];

const git = (cwd, ...args) => {
  const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", maxBuffer: 1 << 26 });
  return r.status === 0 ? r.stdout : null;
};
const lines = (s) => (s ?? "").split("\n").filter(Boolean);
const inDir = (f, d) => f === d || f.startsWith(d + sep);

// What a section explaining a concept relies on, as in the stamps of doc sections (D-23): its term,
// type, definition and the notes of its section that name it. A concept whose signature differs, or
// that is new or gone, is touched.
const signatures = (md, classes) => {
  const sig = new Map();
  if (!md) return sig;
  const { ONT, rows, notes } = parseGlossary(md);
  for (const r of rows) {
    const said = (notes.get(r.heading) ?? []).filter((l) => l.includes(`\`${r.id}\``));
    sig.set(r.id, [ONT[r.id].name, r.type ?? "", ONT[r.id].def, ...said].join("|"));
  }
  return sig;
};
const changedKeys = (a, b) => [...new Set([...a.keys(), ...b.keys()])].filter((k) => a.get(k) !== b.get(k));

// The sections of a doc page by their anchor: the text from one anchor to the next.
const docSections = (text) => {
  const anchors = parseAnchors(text);
  return new Map(
    anchors.map((a, i) => [
      a.refs.map((r) => r.id).sort().join(","),
      text.slice(a.index + a.raw.length, anchors[i + 1]?.index).trim(),
    ]),
  );
};

export function reviewChange({ cfg, base, checks, approachChecks, implRows, ids }) {
  const top = git(cfg.base, "rev-parse", "--show-toplevel")?.trim();
  if (!top) return { error: "--review needs a git repository" };
  if (git(top, "rev-parse", "--verify", "--quiet", `${base}^{commit}`) === null) return { error: `--review: no commit ${base}` };
  const changed = [
    ...new Set([...lines(git(top, "diff", "--name-only", base, "--")), ...lines(git(top, "ls-files", "--others", "--exclude-standard"))]),
  ].map((f) => resolve(top, f));
  const before = (f) => git(top, "show", `${base}:${relative(top, f).split(sep).join("/")}`) ?? "";
  const now = (f) => (existsSync(f) ? readFileSync(f, "utf8") : "");
  const diffLines = (f) =>
    lines(git(top, "diff", base, "--", relative(top, f)))
      .filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l))
      .join("\n");
  const touched = new Set();
  const kinds = new Set();
  const add = (xs) => xs.forEach((x) => touched.add(x));
  const own = new Set([cfg.ontology, cfg.checks?.file, cfg.decisions?.file, cfg.map?.file].filter(Boolean));
  for (const f of changed) {
    if (f === cfg.ontology) {
      kinds.add("ontology");
      add(changedKeys(signatures(before(f)), signatures(now(f))));
    } else if (f === cfg.checks?.file) {
      kinds.add("catalogue");
      const [a, b] = [before(f), now(f)].map((t) => new Map(parseChecks(t).map((c) => [c.id, c])));
      for (const id of changedKeys(new Map([...a].map(([k, c]) => [k, JSON.stringify(c)])), new Map([...b].map(([k, c]) => [k, JSON.stringify(c)]))))
        add([...(a.get(id)?.concepts ?? []), ...(b.get(id)?.concepts ?? [])]);
    } else if (f === cfg.decisions?.file) kinds.add("decisions");
    if (cfg.mockup.includes(f) || f === cfg.map?.file) {
      kinds.add("mockup");
      add(ids(diffLines(f)));
    }
    if (cfg.agentInstructions.includes(f)) kinds.add("agent rules");
    if (cfg.tickets && inDir(f, cfg.tickets.dir) && cfg.tickets.match.test(relative(cfg.tickets.dir, f))) {
      kinds.add("tickets");
      for (const t of [before(f), now(f)]) add(ids(t.match(/^(?:Ontology )?IDs:(.*)$/m)?.[1] ?? ""));
    }
    if (cfg.testSuites.some((s) => inDir(f, s.dir) && s.match.test(relative(s.dir, f)))) kinds.add("tests");
    const doc = cfg.docSets.some((d) => inDir(f, d.dir));
    if (doc) {
      kinds.add("docs");
      const [a, b] = [docSections(before(f)), docSections(now(f))];
      for (const key of changedKeys(a, b)) add(key.split(",").filter(Boolean));
    }
    if (own.has(f) || doc) continue;
    const rel = relative(cfg.root, f);
    const rows = implRows.filter(([, files]) => files.includes(rel));
    const names = [...new Set([...codeNames(before(f)), ...codeNames(now(f))])];
    const inCode = cfg.code.some((c) => inDir(f, c.dir) && c.match.test(relative(c.dir, f)));
    if (rows.length || names.length || inCode) {
      kinds.add("code");
      add(rows.map(([id]) => id));
      add(names);
    }
  }
  const manual = (c) => c.proof === "manual";
  const project = checks.filter((c) => manual(c) && c.concepts.some((x) => touched.has(x)));
  const sections = new Set([...kinds].flatMap((k) => KIND_SECTIONS[k]));
  const taken = new Set(project.map((c) => c.id));
  const approach = (approachChecks ?? []).filter(
    (c) => !taken.has(c.id) && (sections.has(c.section) || (kinds.has("code") && CODE_CONCEPT_CHECKS.includes(c.id))),
  );
  return { changed, touched: [...touched].sort(), kinds: [...kinds], project, approach };
}

export const renderReview = (r, base, root) => {
  const show = (c) => `  ${c.id} [${c.concepts.join(", ")}]\n    GIVEN ${c.given} · WHEN ${c.when} · THEN ${c.then}`;
  if (!r.project.length && !r.approach.length) return `REVIEW ${base}: nothing to review (${r.changed.length} files changed)`;
  return [
    `REVIEW ${base}: ${r.changed.length} files changed: ${r.changed.map((f) => relative(root, f)).join(", ")}`,
    `Touched concepts (${r.touched.length}): ${r.touched.join(", ") || "none"}`,
    `Kinds of artifact: ${r.kinds.join(", ") || "none"}`,
    `Manual checks of the project whose concepts the change touches (${r.project.length}):`,
    ...r.project.map(show),
    `Manual checks of the approach for these kinds of artifact (${r.approach.length}):`,
    ...r.approach.map((c) => `${show(c)}\n    (${c.section})`),
    "Give each check a verdict: pass, fail, not run (applicable but could not be run, with the reason) or not applicable (with the reason).",
  ].join("\n");
};
