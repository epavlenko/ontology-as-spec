// Writes the ontology as a tree for people (D-90): one HTML page with the configured ontology and the
// external ones, each entity with the rows of its table by kind, a table without an entity under its
// heading, the terms with the ID and definition on hover, the entity a field or relation refers to,
// and the entities a view shows. Nothing else: no notes, no graph, no history. The page is not kept in
// the repository; it is written when someone wants to see the ontology.
// Usage: node tools/ont-check/gen-tree.mjs [--config ont.config.json] --out tree.html [--labels labels.json]
// ont: ent.ontology-tree, edge.ontology-tree.concepts, rule.tree-structure-only, inv.tree-complete
import { writeFileSync } from "node:fs";
import { REF_TYPE, parseShows } from "./contracts.mjs";
import { loadConfig, parseGlossary, read } from "./lib.mjs";

// The words of the page besides the ontology's own. A labels file may replace any of them, the term
// of any concept by its ID, the label of a kind by its class, and the heading of a table without an
// entity, for readers of another language.
export const WORDS = {
  "expand-all": "Expand all",
  "collapse-all": "Collapse all",
  hint: "An entity, then the rows of its table by kind. → X: refers to the entity X. Hover a name for its ID and definition.",
  concepts: "concepts",
  entities: "entities",
  "no-rows": "only the entity itself, no other rows",
  shows: "shows:",
  many: "many",
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const cls = (id) => id.split(".")[0];

// One ontology as a tree: tables in their order; in each, the entity, then its rows grouped by kind in
// the configured order, empty kinds left out. Every definition row is one node carrying its ID.
export function renderOntology(md, { classes, kinds }, label) {
  const { ONT, rows } = parseGlossary(md);
  const ids = new Set(Object.keys(ONT));
  const tables = new Map();
  for (const r of rows) tables.set(r.table, [...(tables.get(r.table) ?? []), r]);
  const name = (id) => label(id) ?? ONT[id].name;
  const tip = (id) => `${id} — ${ONT[id].def}`;
  // A target the glossary does not define would be drawn as a bare ID or dropped, so it is refused:
  // the check reports the same rows, and the tree is written once they are fixed.
  const problems = [];
  const node = (r) => {
    const m = (r.type ?? "").trim().match(REF_TYPE);
    const refers = m && (cls(r.id) === "field" || cls(r.id) === "edge");
    if (refers && !ids.has(m[2])) problems.push(`${r.id}: ${m[2]} is not an entity of the glossary`);
    const link = refers
      ? ` <i>→ ${esc(ids.has(m[2]) ? name(m[2]) : m[2])}${m[1] === "refs" ? ` (${esc(label("many") ?? WORDS.many)})` : ""}</i>`
      : "";
    const parsed = cls(r.id) === "view" ? parseShows(r.type, ids) : null;
    if (parsed?.error) problems.push(`${r.id}: ${parsed.error}`);
    const shows = parsed?.targets;
    const what = shows ? ` <i>${esc(label("shows") ?? WORDS.shows)} ${shows.map((x) => esc(name(x))).join(", ")}</i>` : "";
    const mark = cls(r.id) === "rule" || cls(r.id) === "inv" ? " held" : "";
    return `<span class="p${mark}" data-ont="${r.id}" title="${esc(tip(r.id))}">${esc(name(r.id))}${link}${what}</span>`;
  };
  const groups = (rs) =>
    classes
      .filter((c) => c !== "ent")
      .map((c) => {
        const of = rs.filter((r) => cls(r.id) === c);
        if (!of.length) return "";
        const kind = label(c) ?? kinds?.[c] ?? c;
        return `<li class="row"><span class="g">${esc(kind)} <small>${of.length}</small></span><div class="ps">${of.map(node).join("")}</div></li>`;
      })
      .join("");
  let entities = 0;
  const branches = [...tables.values()].map((t) => {
    const ent = t.find((r) => cls(r.id) === "ent");
    const rest = t.filter((r) => r !== ent);
    const inner = groups(rest);
    if (ent) entities += 1;
    const head = ent
      ? `<b data-ont="${ent.id}" title="${esc(tip(ent.id))}">${esc(name(ent.id))}</b>${label(ent.id) ? ` <span class="en">${esc(ONT[ent.id].name)}</span>` : ""}`
      : `<b class="v">${esc(label(t[0].heading) ?? t[0].heading)}</b>`;
    const body = inner ? `<ul>${inner}</ul>` : `<div class="empty">${esc(label("no-rows") ?? WORDS["no-rows"])}</div>`;
    return `<li><details open><summary>${head} <small>${t.length}</small></summary>${body}</details></li>`;
  });
  if (problems.length) throw new Error(`the tree names what the glossary does not define:\n  ${problems.join("\n  ")}`);
  const title = (md.match(/^# (.+)$/m) ?? [, "Ontology"])[1];
  const counts = `${rows.length} ${label("concepts") ?? WORDS.concepts} · ${entities} ${label("entities") ?? WORDS.entities}`;
  return `<section><h3>${esc(title)} <small>${esc(counts)}</small></h3><ul class="tree">${branches.join("")}</ul></section>`;
}

const STYLE = `:root{--fg:#1f2328;--muted:#656d76;--line:#d0d7de;--accent:#0969da;--views:#1a7f37;--held:#bf8700}
@media (prefers-color-scheme:dark){:root{--fg:#e6edf3;--muted:#9198a1;--line:#3d444d;--accent:#4493f8;--views:#3fb950;--held:#d29922}body{background:#0d1117}}
body{font-family:system-ui,sans-serif;color:var(--fg);font-size:13px;max-width:1100px;margin:auto;padding:16px}
h3{margin:0 0 6px;font-size:15px}section{margin-bottom:24px}small{color:var(--muted);font-size:11px;font-weight:400}
.bar{margin-bottom:12px;font-size:12px;color:var(--muted)}.bar button{font:inherit;margin-right:6px;cursor:pointer;background:transparent;color:var(--fg);border:1px solid var(--line);border-radius:4px;padding:2px 8px}
ul.tree,ul.tree ul{list-style:none;margin:0;padding-left:16px}ul.tree{padding-left:4px}
ul.tree li{position:relative;padding:3px 0 3px 14px}
ul.tree li::before{content:"";position:absolute;left:0;top:0;bottom:0;border-left:1px solid var(--line)}
ul.tree li::after{content:"";position:absolute;left:0;top:12px;width:10px;border-top:1px solid var(--line)}
ul.tree li:last-child::before{bottom:auto;height:12px}
summary{cursor:pointer}summary b{color:var(--accent);font-size:13.5px}b.v{color:var(--views)}.en{color:var(--muted);font-size:12px}
li.row{display:flex;gap:8px}.g{flex:0 0 120px;color:var(--muted);font-size:12px}.ps{flex:1;line-height:1.9}
.p{display:inline-block;margin:0 5px 2px 0;padding:0 7px;border:1px solid var(--line);border-radius:10px;font-size:12px;white-space:nowrap}
.p i{font-style:normal;color:var(--accent)}.p.held{border-color:var(--held)}
.empty{color:var(--muted);font-size:12px;padding:2px 0 2px 18px}`;

// The page: the ontologies in the order given, and the two buttons that open or close every branch.
export function renderTree(sections, label) {
  const word = (k) => esc(label(k) ?? WORDS[k]);
  const all = (open) => `document.querySelectorAll('details').forEach(d=>d.open=${open})`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sections.title)}</title><style>${STYLE}</style></head><body>
<div class="bar"><button onclick="${all(true)}">${word("expand-all")}</button><button onclick="${all(false)}">${word("collapse-all")}</button> ${word("hint")}</div>
${sections.html.join("\n")}
</body></html>
`;
}

// The labels file: keys are IDs of the ontologies shown, classes of the configuration, headings of
// tables without an entity, or the words above. Any other key is an error, so that a typo or a retired
// ID does not leave a term untranslated without anyone noticing.
export function loadLabels(text, known) {
  const labels = JSON.parse(text);
  const unknown = Object.keys(labels).filter((k) => !known.has(k));
  if (unknown.length) throw new Error(`labels name what the tree does not show: ${unknown.join(", ")}`);
  return (k) => labels[k] ?? null;
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const opt = (name) => {
    const i = process.argv.indexOf(name);
    return i > 0 ? process.argv[i + 1] : null;
  };
  const cfg = loadConfig(opt("--config") ?? "ont.config.json");
  const out = opt("--out");
  if (!out) throw new Error("--out is not set: the file to write the tree to");
  const files = [cfg.ontology, ...cfg.external.map((e) => e.ontology)];
  const texts = files.map(read);
  const known = new Set([...cfg.classes, ...Object.keys(WORDS)]);
  for (const md of texts) {
    const { ONT, rows } = parseGlossary(md);
    for (const id of Object.keys(ONT)) known.add(id);
    // Only the heading of a table without an entity is shown; an entity's table is named by its term.
    const tables = new Map();
    for (const r of rows) tables.set(r.table, [...(tables.get(r.table) ?? []), r]);
    for (const t of tables.values()) if (!t.some((r) => cls(r.id) === "ent")) known.add(t[0].heading);
  }
  const labelsFile = opt("--labels");
  const label = labelsFile ? loadLabels(read(labelsFile), known) : () => null;
  const html = texts.map((md) => renderOntology(md, cfg, label));
  writeFileSync(out, renderTree({ title: (texts[0].match(/^# (.+)$/m) ?? [, "Ontology"])[1], html }, label));
  console.log(`${out}: ${files.length} ${files.length > 1 ? "ontologies" : "ontology"}`);
}
