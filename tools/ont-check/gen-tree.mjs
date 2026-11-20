// Writes the ontology as a tree for people (D-105): one HTML page with the configured ontology and the
// external ones, each entity with the rows of its table by kind, a table without an entity under its
// heading, the terms with the ID and definition on hover, the entity a field or relation refers to,
// and the entities a view shows. Nothing else: no notes, no graph, no history; the footer only says
// what the page was built from. The page is not kept in the repository. It is written on demand with
// --out, or by --refresh, which the post-merge hook runs, at the place a clone names in its own Git
// configuration (ont.treeOut); --stale says why the page at that place does not show main.
// Usage: node tools/ont-check/gen-tree.mjs [--config ont.config.json] --out tree.html [--labels labels.json]
//        node tools/ont-check/gen-tree.mjs --refresh [--squash]   # on main, at ont.treeOut, from the root ont.config.json
//        node tools/ont-check/gen-tree.mjs --stale                # why the tree at ont.treeOut is stale, or nothing
// ont: ent.ontology-tree, edge.ontology-tree.concepts, rule.tree-structure-only, inv.tree-complete
// ont: field.ontology-tree.place, field.ontology-tree.built-from, derived.tree-stale, rule.tree-refreshed-after-merge
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { REF_TYPE, parseShows } from "./contracts.mjs";
import { gitEnv, loadConfig, parseGlossary } from "./lib.mjs";

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
  built: "Built from",
  "no-commit": "no commit",
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
  // The configured classes first, then any other class the rows have, in the order they appear: an
  // external ontology may use classes this configuration does not list, and its rows are shown too.
  const groups = (rs) =>
    [...new Set([...classes.filter((c) => c !== "ent"), ...rs.map((r) => cls(r.id))])]
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
  // Every definition row exactly once (inv.tree-complete), held here as well as by the tests, so that a
  // layout no test foresaw cannot drop a row without the generator saying so.
  const shown = branches.join("").match(/data-ont="[^"]+"/g) ?? [];
  const lost = rows.filter((r) => shown.filter((x) => x === `data-ont="${r.id}"`).length !== 1);
  if (lost.length) throw new Error(`the tree would not show these rows exactly once: ${lost.map((r) => r.id).join(", ")}`);
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
.empty{color:var(--muted);font-size:12px;padding:2px 0 2px 18px}
footer.built{margin-top:24px;color:var(--muted);font-size:11px}`;

// What a page was built from, in its footer (field.ontology-tree.built-from): the commit, with
// +working-tree when a file read is not that commit's, or no-commit outside Git; the configuration's
// path from the root of the repository, except outside Git; and the date. The footer is not the tree.
const footer = (built, word) => {
  if (!built) return "";
  const config = built.config === null ? "" : ` data-config="${esc(built.config)}"`;
  const commit = built.commit === "no-commit" ? word("no-commit") : `<code>${esc(built.commit)}</code>`;
  const shown = [commit, ...(built.config === null ? [] : [`<code>${esc(built.config)}</code>`]), esc(built.date)].join(" · ");
  return `<footer class="built" data-commit="${esc(built.commit)}"${config} data-date="${esc(built.date)}">${word("built")} ${shown}</footer>\n`;
};

// The page: the ontologies in the order given, the two buttons that open or close every branch, and
// the footer when the page knows what it was built from.
export function renderTree(sections, label, built) {
  const word = (k) => esc(label(k) ?? WORDS[k]);
  const all = (open) => `document.querySelectorAll('details').forEach(d=>d.open=${open})`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sections.title)}</title><style>${STYLE}</style></head><body>
<div class="bar"><button onclick="${all(true)}">${word("expand-all")}</button><button onclick="${all(false)}">${word("collapse-all")}</button> ${word("hint")}</div>
${sections.html.join("\n")}
${footer(built, word)}</body></html>
`;
}

// The mark a page carries, read back: { commit, config } or null for a page without one.
export function readMark(html) {
  const m = html.match(/<footer class="built" data-commit="([^"]*)"(?: data-config="([^"]*)")?/);
  return m ? { commit: m[1], config: m[2] ?? null } : null;
}

// The labels file: keys are IDs of the ontologies shown, the classes the tree groups rows by, headings
// of tables without an entity, or the words above. Any other key is an error, so that a typo or a
// retired ID does not leave a term untranslated without anyone noticing. The words are a fixed list and
// always accepted, even where one page does not need them, so one file serves every ontology.
export function loadLabels(text, known) {
  const labels = JSON.parse(text);
  const unknown = Object.keys(labels).filter((k) => !known.has(k));
  if (unknown.length) throw new Error(`labels name what the tree does not show: ${unknown.join(", ")}`);
  return (k) => labels[k] ?? null;
}

// Git, run in a directory, without the variables a hook may have set for another repository. Returns
// the output, or null when git fails, as it does outside a repository or for a path HEAD lacks.
const GIT_ENV = gitEnv();
const git = (cwd, args, encoding = "utf8") => {
  try {
    const out = execFileSync("git", args, { cwd, encoding, env: GIT_ENV, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 });
    return encoding === "utf8" ? out.replace(/\n$/, "") : out;
  } catch {
    return null;
  }
};

// Builds the page from a configuration, keeping the bytes of every file the generator read, so that
// the mark compares what was read, not what a file holds by the time it is compared.
export function buildTree(configPath, labelsFile) {
  const inputs = [];
  const take = (path) => {
    const bytes = readFileSync(path);
    inputs.push({ path: resolve(path), bytes });
    return bytes.toString("utf8");
  };
  const cfg = loadConfig(configPath, take(resolve(configPath)));
  const files = [cfg.ontology, ...cfg.external.map((e) => e.ontology)];
  const texts = files.map(take);
  // The page's own words are always on it. A kind is shown as the label of a group, so only a class
  // other than the entity's that some row of the ontologies shown has; an entity is named by its term.
  const known = new Set(Object.keys(WORDS));
  for (const md of texts) {
    const { ONT, rows } = parseGlossary(md);
    for (const id of Object.keys(ONT)) known.add(id);
    for (const r of rows) if (cls(r.id) !== "ent") known.add(cls(r.id));
    // Only the heading of a table without an entity is shown; an entity's table is named by its term.
    const tables = new Map();
    for (const r of rows) tables.set(r.table, [...(tables.get(r.table) ?? []), r]);
    for (const t of tables.values()) if (!t.some((r) => cls(r.id) === "ent")) known.add(t[0].heading);
  }
  const label = labelsFile ? loadLabels(take(labelsFile), known) : () => null;
  const html = texts.map((md) => renderOntology(md, cfg, label));
  return { title: (texts[0].match(/^# (.+)$/m) ?? [, "Ontology"])[1], html, label, inputs, files, configFile: resolve(configPath) };
}

// What the page is built from (field.ontology-tree.built-from). An input is clean when it is not a
// symbolic link, lies inside the repository and its bytes equal the content of its path in HEAD; git
// diff would compare a link itself, not what it points to. dirty lists the inputs that are not clean.
export function markOf(built) {
  const dir = dirname(built.configFile);
  const top = git(dir, ["rev-parse", "--show-toplevel"]);
  const head = top === null ? null : git(dir, ["rev-parse", "--verify", "--quiet", "HEAD"]);
  if (top === null || head === null) return { commit: "no-commit", config: null, dirty: [] };
  const realTop = realpathSync(top);
  const inRepo = (path) => {
    const real = join(realpathSync(dirname(path)), path.split(sep).at(-1));
    const rel = relative(realTop, real);
    return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel.split(sep).join("/") : null;
  };
  const name = (path) => inRepo(path) ?? path;
  const dirty = [];
  for (const { path, bytes } of built.inputs) {
    const rel = inRepo(path);
    const link = lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink() ?? true;
    const committed = rel === null || link ? null : git(top, ["show", `HEAD:${rel}`], "buffer");
    if (committed === null || !committed.equals(bytes)) dirty.push(name(path));
  }
  const config = inRepo(built.configFile);
  return { commit: dirty.length ? `${head}+working-tree` : head, config, dirty: [...new Set(dirty)] };
}

const writePage = (out, built, mark) => {
  const date = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  writeFileSync(out, renderTree({ title: built.title, html: built.html }, built.label, { commit: mark.commit, config: mark.config, date }));
};

// The clone's own place for its tree (field.ontology-tree.place): only its local Git configuration,
// never ont.config.json; a relative path is taken from the root of the repository.
const placeOf = (top) => {
  const place = git(top, ["config", "--local", "--type=path", "--get", "ont.treeOut"]);
  return place ? resolve(top, place) : null;
};
const ROOT_CONFIG = "ont.config.json";
const SELF = fileURLToPath(import.meta.url);

// What the post-merge hook runs (rule.tree-refreshed-after-merge): on main with a place set, the tree
// from the ont.config.json at the root, when every file read equals HEAD's. Silent off main or without
// a place; after a squash merge, which leaves main where it was, it says why it writes nothing.
export function refresh(cwd, { squash = false } = {}) {
  const top = git(cwd, ["rev-parse", "--show-toplevel"]);
  if (top === null) throw new Error("--refresh runs inside a Git repository");
  const place = placeOf(top);
  if (!place || git(top, ["symbolic-ref", "--quiet", "HEAD"]) !== "refs/heads/main") return [];
  if (squash)
    return [`tree: not written to ${place}: a squash merge leaves main where it was; after committing it, run node ${relative(top, SELF)} --refresh`];
  const built = buildTree(join(top, ROOT_CONFIG));
  const mark = markOf(built);
  if (mark.dirty.length)
    return [`tree: not written to ${place}: these files differ from HEAD (commit them, then run node ${relative(top, SELF)} --refresh): ${mark.dirty.join(", ")}`];
  writePage(place, built, mark);
  return [`${place}: ${built.files.length} ${built.files.length > 1 ? "ontologies" : "ontology"}, built from ${mark.commit}`];
}

// Why the tree at the clone's place does not show main (derived.tree-stale): nothing when it does, or
// when no place is set. It never fails; a stale page is one to rewrite, not a broken repository.
export function stale(cwd) {
  const top = git(cwd, ["rev-parse", "--show-toplevel"]);
  const place = top === null ? null : placeOf(top);
  if (!place) return [];
  const at = `TREE_STALE ${place}:`;
  if (!existsSync(place)) return [`${at} the file does not exist`];
  const mark = readMark(readFileSync(place, "utf8"));
  if (!mark) return [`${at} the page carries no mark of what it was built from`];
  const main = git(top, ["rev-parse", "--verify", "--quiet", "refs/heads/main"]);
  const out = [];
  if (mark.commit === "no-commit") out.push(`${at} built outside Git (no-commit)`);
  else if (mark.commit.endsWith("+working-tree")) out.push(`${at} built from files that differ from commit ${mark.commit.replace(/\+working-tree$/, "")} (+working-tree)`);
  if (mark.config !== null && mark.config !== ROOT_CONFIG) out.push(`${at} built from another configuration, ${mark.config}, not the ${ROOT_CONFIG} at the root`);
  const sha = mark.commit.replace(/\+working-tree$/, "");
  if (main === null) out.push(`${at} the repository has no branch main`);
  else if (mark.commit !== "no-commit" && sha !== main) out.push(`${at} built from ${sha}, but main is ${main}`);
  if (out.length) out.push(`  rewrite it on main with node ${relative(top, SELF)} --refresh`);
  return out;
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };
  const flag = (name) => args.includes(name);
  const modes = ["--out", "--refresh", "--stale"].filter((m) => args.includes(m));
  if (modes.length > 1) throw new Error(`${modes.join(" and ")} cannot be given together`);
  if ((flag("--refresh") || flag("--stale")) && (args.includes("--config") || args.includes("--labels")))
    throw new Error("--refresh and --stale take the ont.config.json at the root and no labels file");
  if (flag("--squash") && !flag("--refresh")) throw new Error("--squash is given only with --refresh, by the post-merge hook");
  if (flag("--refresh")) {
    try {
      for (const line of refresh(process.cwd(), { squash: flag("--squash") })) console.log(line);
    } catch (e) {
      console.error(`tree: not written: ${e.message}`);
      process.exit(1);
    }
  } else if (flag("--stale")) {
    for (const line of stale(process.cwd())) console.log(line);
  } else {
    const out = opt("--out");
    if (!out) throw new Error("--out is not set: the file to write the tree to");
    const built = buildTree(opt("--config") ?? ROOT_CONFIG, opt("--labels"));
    const mark = markOf(built);
    writePage(out, built, mark);
    console.log(`${out}: ${built.files.length} ${built.files.length > 1 ? "ontologies" : "ontology"}, built from ${mark.commit}`);
  }
}
