// The checks to review for a change (D-77): the manual checks of the project whose concepts the change
// touches, and the manual checks of the approach for the kinds of artifact it touches. A reviewer that
// did not write the change gives each of them a verdict (skills/change-review).
// ont: derived.review-checks
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { parseAnchors } from "./docs.mjs";
import { codeNames, gitEnv, parseChecks, parseGlossary } from "./lib.mjs";

// Sections of the approach's catalogue whose manual checks concern each kind of artifact.
export const KIND_SECTIONS = {
  ontology: ["Concept"],
  decisions: ["Decision"],
  catalogue: ["Check"],
  code: ["Implementation row"],
  mockup: ["Mockup element", "Map row"],
  tests: ["Test", "Check"],
  docs: ["Doc section"],
  tickets: ["Ticket"],
  "agent rules": ["Agent rules"],
};
// Checks of the Concept section that concern the code rather than the rows (D-73).
// The check of errors and security in code goes with every change of code too (D-81).
const CODE_CONCEPT_CHECKS = ["check.concept.code-from-ontology", "check.concept.ontology-changed-first", "check.agent-rules.code-reviewed-for-errors"];
// Checks of the Check section that concern a judge or the screens (D-98): listed only when the change
// touches a judge, its verdicts, a judged check, a view or a screen, or when what a file is cannot be told.
const JUDGE_CHECKS = ["check.check.judge-sees-the-check", "check.check.verdict-kept"];
const SCREEN_CHECKS = ["check.check.view-states-judged", "check.check.screens-outside"];
const SCREEN_FILE = /\.(?:png|jpe?g|gif|webp|svg)$/i;

const git = (cwd, ...args) => {
  const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", maxBuffer: 1 << 26, env: gitEnv() });
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

// The sections of a doc page by their anchor: the text from one anchor to the next. Two sections of a
// page may explain the same concepts, so each key also counts which of them it is.
const docSections = (text) => {
  const anchors = parseAnchors(text);
  const seen = new Map();
  return new Map(
    anchors.map((a, i) => {
      const ids = a.refs.map((r) => r.id).sort().join(",");
      seen.set(ids, (seen.get(ids) ?? 0) + 1);
      return [`${ids}#${seen.get(ids)}`, text.slice(a.index + a.raw.length, anchors[i + 1]?.index).trim()];
    }),
  );
};

export function reviewChange({ cfg, base, checks, approachChecks, implRows, ids }) {
  const top = git(cfg.base, "rev-parse", "--show-toplevel")?.trim();
  if (!top) return { error: "--review needs a git repository" };
  if (git(top, "rev-parse", "--verify", "--quiet", `${base}^{commit}`) === null) return { error: `--review: no commit ${base}` };
  const changed = [
    ...new Set([...lines(git(top, "diff", "--name-only", base, "--")), ...lines(git(top, "ls-files", "--others", "--exclude-standard"))]),
  ]
    .map((f) => resolve(top, f))
    // The records of manual runs are the review's own result, not part of the change it reviews (D-82).
    .filter((f) => !(cfg.manualRuns && inDir(f, cfg.manualRuns.dir)) && !(cfg.reviewRounds && inDir(f, cfg.reviewRounds.dir)));
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
  let judged = false;
  let screens = false;
  let doubt = false;
  for (const f of changed) {
    const known =
      own.has(f) ||
      cfg.mockup.includes(f) ||
      cfg.agentInstructions.includes(f) ||
      cfg.docSets.some((d) => (d.files ? d.files.includes(f) : inDir(f, d.dir))) ||
      (cfg.tickets && inDir(f, cfg.tickets.dir)) ||
      cfg.testSuites.some((s) => inDir(f, s.dir)) ||
      cfg.reviewPaths.some((p) => inDir(f, p.dir)) ||
      cfg.code.some((c) => inDir(f, c.dir));
    // A judge is touched by a judged suite, by judge.mjs itself, or by any file of code whose old or new
    // text names a judge at all, called, imported or passed on; in doubt the checks stay.
    const CODE_FILE = /\.(?:[cm]?[jt]sx?|py|rb|go|rs|java|kt|sh)$/;
    const usesJudge = (t) => CODE_FILE.test(f) && /\bjudge\b/i.test(t);
    if (
      cfg.testSuites.some((s) => s.checks.length && inDir(f, s.dir) && s.match.test(relative(s.dir, f))) ||
      /(^|[\/])judge\.mjs$/.test(f) ||
      usesJudge(now(f)) ||
      usesJudge(before(f))
    )
      judged = true;
    if (SCREEN_FILE.test(f)) screens = true;
    // A file that is no artifact the configuration knows, and names no concept, may still be anything.
    if (!known && !SCREEN_FILE.test(f) && !implRows.some(([, files]) => files.includes(relative(cfg.root, f))) && !codeNames(now(f)).length && !codeNames(before(f)).length)
      doubt = true;
    if (f === cfg.ontology) {
      kinds.add("ontology");
      add(changedKeys(signatures(before(f)), signatures(now(f))));
    } else if (f === cfg.checks?.file) {
      kinds.add("catalogue");
      const [a, b] = [before(f), now(f)].map((t) => new Map(parseChecks(t).map((c) => [c.id, c])));
      for (const id of changedKeys(new Map([...a].map(([k, c]) => [k, JSON.stringify(c)])), new Map([...b].map(([k, c]) => [k, JSON.stringify(c)])))) {
        add([...(a.get(id)?.concepts ?? []), ...(b.get(id)?.concepts ?? [])]);
        if (a.get(id)?.proof === "judged" || b.get(id)?.proof === "judged") judged = true;
      }
    } else if (f === cfg.decisions?.file) kinds.add("decisions");
    if (cfg.mockup.includes(f) || f === cfg.map?.file) {
      kinds.add("mockup");
      screens = true;
      add(ids(diffLines(f)));
    }
    if (cfg.agentInstructions.includes(f)) kinds.add("agent rules");
    if (cfg.tickets && inDir(f, cfg.tickets.dir) && cfg.tickets.match.test(relative(cfg.tickets.dir, f))) {
      kinds.add("tickets");
      for (const t of [before(f), now(f)]) add(ids(t.match(/^(?:Ontology )?IDs:(.*)$/m)?.[1] ?? ""));
    }
    if (cfg.testSuites.some((s) => inDir(f, s.dir) && s.match.test(relative(s.dir, f)))) kinds.add("tests");
    // Data files carry no ont: names; reviewPaths says which concepts a change of them touches (D-80).
    for (const p of cfg.reviewPaths) if (inDir(f, p.dir)) add(p.concepts);
    // A page a set names one by one may also be code or agent instructions, so it is read as those too (D-96).
    const docDir = cfg.docSets.some((d) => !d.files && inDir(f, d.dir));
    const doc = docDir || cfg.docSets.some((d) => d.files?.includes(f));
    if (doc) {
      kinds.add("docs");
      const [a, b] = [docSections(before(f)), docSections(now(f))];
      for (const key of changedKeys(a, b)) add(key.split("#")[0].split(",").filter(Boolean));
    }
    if (own.has(f) || docDir) continue;
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
  if ([...touched].some((x) => x.startsWith("view."))) screens = true;
  const relevant = (c) =>
    (!JUDGE_CHECKS.includes(c.id) || judged || doubt) && (!SCREEN_CHECKS.includes(c.id) || screens || judged || doubt);
  const approach = (approachChecks ?? []).filter(
    (c) =>
      !taken.has(c.id) &&
      relevant(c) &&
      (sections.has(c.section) ||
        (kinds.has("code") && CODE_CONCEPT_CHECKS.includes(c.id)) ||
        (JUDGE_CHECKS.includes(c.id) && judged) ||
        (SCREEN_CHECKS.includes(c.id) && (screens || judged))),
  );
  return { changed, touched: [...touched].sort(), kinds: [...kinds], project, approach };
}

export const renderReview = (r, base, root, stamp = () => "") => {
  const show = (c) => `  ${c.id} [${c.concepts.join(", ")}] stamp ${stamp(c)}\n    GIVEN ${c.given} · WHEN ${c.when} · THEN ${c.then}`;
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
