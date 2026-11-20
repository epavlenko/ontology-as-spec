// Writes the ontology as a tree for people (D-105): one HTML page with the configured ontology and the
// external ones, each entity with the rows of its table by kind, a table without an entity under its
// heading, the terms with the ID and definition on hover, the entity a field or relation refers to,
// and the entities a view shows. Nothing else: no notes, no graph, no history; the footer only says
// what the page was built from. The page is not kept in the repository. It is written on demand with
// --out, or by --refresh, which the post-merge hook runs, at the place a clone names in its own Git
// configuration (ont.treeOut), from the files of HEAD when the working tree holds the same (D-130); --stale says
// why the page at that place does not show main.
// Usage: node tools/ont-check/gen-tree.mjs [--config ont.config.json] --out tree.html [--labels labels.json]
//        node tools/ont-check/gen-tree.mjs --refresh [--squash]   # on main, at ont.treeOut, from the root ont.config.json of HEAD
//        node tools/ont-check/gen-tree.mjs --stale                # why the tree at ont.treeOut is stale, or nothing
// ont: ent.ontology-tree, edge.ontology-tree.concepts, rule.tree-structure-only, inv.tree-complete
// ont: field.ontology-tree.place, field.ontology-tree.built-from, derived.tree-stale, rule.tree-refreshed-after-merge
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
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
// It is the one form readMark accepts, its text included, and renderTree puts it last on the page (D-130).
const footer = (built, word) => {
  if (!built) return "";
  const config = built.config === null ? "" : ` data-config="${esc(built.config)}"`;
  const commit = built.commit === "no-commit" ? word("no-commit") : `<code>${esc(built.commit)}</code>`;
  const shown = [commit, ...(built.config === null ? [] : [`<code>${esc(built.config)}</code>`]), esc(built.date)].join(" · ");
  return `<footer class="built" data-commit="${esc(built.commit)}"${config} data-date="${esc(built.date)}">${word("built")} ${shown}</footer>\n`;
};

// The page: the ontologies in the order given, the two buttons that open or close every branch, and
// the footer, the last element of the page, when the page knows what it was built from.
export function renderTree(sections, label, built) {
  const word = (k) => esc(label(k) ?? WORDS[k]);
  const all = (open) => `document.querySelectorAll('details').forEach(d=>d.open=${open})`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sections.title)}</title><style>${STYLE}</style></head><body>
<div class="bar"><button onclick="${all(true)}">${word("expand-all")}</button><button onclick="${all(false)}">${word("collapse-all")}</button> ${word("hint")}</div>
${sections.html.join("\n")}
${footer(built, word)}</body></html>
`;
}

// The mark a page carries, read back (D-130): only the footer footer() writes, the last element of the
// page, directly before the </body></html> that ends it with nothing but white space between and after,
// and only when the page before it ends in plain text: no comment, tag, quoted value, element whose
// content is text, such as a title, a script, a style or a textarea, or <template> left open, so that
// the footer is one a person sees. The report reads that position and no other. The footer the
// generator would write for its attributes, in the generator's own words, is made again and must be the
// element found, byte for byte, so that a text saying something else than the attributes, another
// commit or other words, is no mark either; the refresh writes no labels, so the words are the page's
// own. Anything else, the same fields in a comment or an attribute included, is no mark: null. A field
// present but empty is null.
const MARK = /(<footer class="built" data-commit="([^"<>]*)"(?: data-config="([^"<>]*)")? data-date="([^"<>]*)">[^\n]*<\/footer>)[ \t\n\r\f]*<\/body><\/html>[ \t\n\r\f]*$/;
const unesc = (s) => s.replace(/&(amp|lt|gt|quot);/g, (_, c) => ({ amp: "&", lt: "<", gt: ">", quot: '"' })[c]);
export function readMark(html) {
  const m = html.match(MARK);
  if (!m || !endsInText(html.slice(0, m.index))) return null;
  const [commit, config, date] = [m[2], m[3], m[4]].map((s) => (s === undefined ? null : unesc(s)));
  if (footer({ commit, config, date }, (k) => esc(WORDS[k])) !== `${m[1]}\n`) return null;
  const v = (s) => (s ? s : null);
  return { commit: v(commit), config: v(config), date: v(date) };
}
// Whether HTML read to its end is in plain text, directly in <body>: every comment, declaration and tag
// closed, a quoted value of an attribute too, every element whose content is raw text closed by its end
// tag, and every other element opened after <html> and <body> closed by its own end tag, nested ones each
// by theirs, so that the footer is a child of <body> and of no <template>, <details>, <dialog> or other
// element that could fold it away. Elements without end tags, such as <meta> and <br>, are not counted.
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW_TEXT = new Set(["script", "style", "textarea", "title", "xmp", "iframe", "noembed", "noframes", "noscript", "plaintext"]);
const endsInText = (html) => {
  const lower = html.toLowerCase();
  const open = [];
  let i = 0;
  for (;;) {
    const lt = html.indexOf("<", i);
    if (lt < 0) return open.length === 2 && open[0] === "html" && open[1] === "body";
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      if (end < 0) return false;
      i = end + 3;
      continue;
    }
    if (html.startsWith("<!", lt) || html.startsWith("<?", lt)) {
      const end = html.indexOf(">", lt);
      if (end < 0) return false;
      i = end + 1;
      continue;
    }
    const tag = html.slice(lt, lt + 64).match(/^<(\/?)([A-Za-z][^\s/>]*)/);
    if (!tag) {
      i = lt + 1;
      continue;
    }
    let j = lt + tag[0].length;
    for (let quote = null; j < html.length; j++) {
      const c = html[j];
      if (quote) quote = c === quote ? null : quote;
      else if (c === '"' || c === "'") quote = c;
      else if (c === ">") break;
    }
    if (j >= html.length) return false;
    i = j + 1;
    const name = tag[2].toLowerCase();
    // In HTML a slash before > closes nothing: <template/> opens a template as <template> does.
    if (tag[1]) {
      if (open[open.length - 1] !== name) return false;
      open.pop();
    } else if (!VOID.has(name) && !RAW_TEXT.has(name)) open.push(name);
    if (!tag[1] && RAW_TEXT.has(name)) {
      const close = name === "plaintext" ? -1 : lower.indexOf(`</${name}`, i);
      if (close < 0) return false;
      const gt = html.indexOf(">", close);
      if (gt < 0) return false;
      i = gt + 1;
    }
  }
};

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

// Git, run in a directory, without the variables a hook may have set for another repository, and with
// local replacements off, so that a commit is the content its SHA names (D-130). Returns the output, or
// null when git fails, as it does outside a repository or for a path HEAD lacks.
const HOOK_FREE = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(DIR|WORK_TREE|INDEX_FILE|PREFIX)$/.test(k)));
const git = (cwd, args, encoding = "utf8") => {
  try {
    const out = execFileSync("git", args, { cwd, encoding, env: gitEnv(HOOK_FREE), stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 });
    return encoding === "utf8" ? out.replace(/\n$/, "") : out;
  } catch {
    return null;
  }
};

// A path as it was asked for, from the directory of whatever names it, its parts kept as they are: a
// .. after a linked directory goes up from the link's target, as the file system takes it, which
// resolve() would take away by hand, pointing at another file than the one read.
const asked = (from, path) => (isAbsolute(path) ? path : `${from}${sep}${path}`);

// The kind of a file that is not a regular one, in words, or null for a regular file.
const kindOf = (st) =>
  st.isFile()
    ? null
    : st.isSymbolicLink()
      ? "a symbolic link"
      : st.isDirectory()
        ? "a directory"
        : st.isFIFO()
          ? "a named pipe"
          : st.isSocket()
            ? "a socket"
            : st.isCharacterDevice() || st.isBlockDevice()
              ? "a device"
              : "not a file";
// The bytes of a regular file and its status; any other kind throws an error with its kind, before it
// is opened. The file is opened without waiting and checked again once open, so that one replaced by a
// named pipe between the two is not read either. With noFollow, a symbolic link at the path is a kind
// of its own and is not followed, at the check or at the open.
const readRegular = (path, { noFollow = false } = {}) => {
  const fail = (kind) => Object.assign(new Error(`${path} is ${kind}, not a regular file`), { kind });
  const before = kindOf((noFollow ? lstatSync : statSync)(path));
  if (before) throw fail(before);
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK | (noFollow ? constants.O_NOFOLLOW : 0));
  } catch (e) {
    if (e.code === "ELOOP") throw fail("a symbolic link");
    throw e;
  }
  try {
    const st = fstatSync(fd);
    const now = kindOf(st);
    if (now) throw fail(now);
    return { bytes: readFileSync(fd), st };
  } finally {
    closeSync(fd);
  }
};

// An input's path to the working tree (D-130), the one function that takes it there, for the refresh,
// the page on demand and its mark alike: the path as the configuration gives it, from the directory of
// whatever names it, never normalised; only its . and empty parts are dropped, which lead nowhere else.
// A .. part, or a part that is a symbolic link or is missing, the file included, each prefix taken by
// the file system as it stands, makes it not the commit's file, whatever file it leads to: { why }.
// Given the root of a repository, the path must lie inside it, by its parts, and rel is its path from
// the root; a path with no .. and no link is the path the file system takes, so its parts are the file's.
export const inputAt = (path, top = null) => {
  const parts = (p) => p.split(sep).filter((x, k) => k === 0 || (x !== "" && x !== "."));
  const at = parts(path);
  if (at.includes("..")) return { why: "its path has a .. part" };
  for (let k = 1; k < at.length; k++) {
    const prefix = at.slice(0, k + 1).join(sep);
    let st;
    try {
      st = lstatSync(prefix, { throwIfNoEntry: false });
    } catch {}
    if (!st) return { why: `${prefix} does not exist` };
    if (st.isSymbolicLink()) return { why: `${prefix} is a symbolic link` };
  }
  if (top === null) return { at: at.join(sep) };
  const root = parts(top);
  if (at.length <= root.length || root.some((x, k) => at[k] !== x)) return { why: "it lies outside the repository" };
  return { at: at.join(sep), rel: at.slice(root.length).join("/") };
};

// The files of the working tree, for the page on demand (D-130): each read once, at the path as asked
// for, only when it is a regular file, and opened without waiting; inputAt looks at the path before the
// read and again after it, with the file at the path then the file read, so that a link swapped for a
// file, or a file for a link, while it is read is not clean. The bytes kept are the bytes the page
// shows. onRead, for the tests, runs after each read.
export const workingTree = ({ cwd = process.cwd(), onRead } = {}) => {
  const inputs = [];
  return {
    inputs,
    start: cwd,
    at: asked,
    dir: dirname,
    file: (path) => path,
    read(path) {
      const before = inputAt(path).why;
      const { bytes, st } = readRegular(path);
      onRead?.(path);
      const now = lstatSync(path, { throwIfNoEntry: false });
      const link = Boolean(before || inputAt(path).why) || !now || now.dev !== st.dev || now.ino !== st.ino;
      inputs.push({ path, bytes, linked: link });
      return bytes.toString("utf8");
    },
  };
};

// The regular file a commit holds at a path, walked from the root one directory at a time (D-130): a
// part before another, or before a .., must be a directory of the commit, never a symbolic link it
// holds; a .. goes back to the directory walked from, and never above the root; the last must be a
// regular file. Returns { bytes }, or { why } it holds none.
const inCommit = (top, sha, path) => {
  const walked = [];
  const tree = () => {
    const last = walked.at(-1);
    if (!last || last.type === "tree") return null;
    return last.mode === "120000" ? `${last.at} is a symbolic link in the commit` : `${last.at} is not a directory in the commit`;
  };
  for (const part of path.split("/").filter((p) => p !== "" && p !== ".")) {
    const why = tree();
    if (why) return { why };
    if (part === "..") {
      if (!walked.length) return { why: "it leads above the root of the repository" };
      walked.pop();
      continue;
    }
    const dir = walked.map((w) => w.name).join("/");
    const list = git(top, ["ls-tree", "-z", dir ? `${sha}:${dir}` : sha]);
    const entry = (list ?? "").split("\0").map((e) => e.match(/^(\d+) (\w+) ([0-9a-f]+)\t(.*)$/s)).find((m) => m && m[4] === part);
    const at = dir ? `${dir}/${part}` : part;
    if (!entry) return { why: `the commit holds no ${at}` };
    walked.push({ name: part, at, mode: entry[1], type: entry[2], object: entry[3] });
  }
  const file = walked.at(-1);
  if (!file) return { why: "it names the root, not a file" };
  if (file.mode === "120000") return { why: `${file.at} is a symbolic link in the commit` };
  if (file.type !== "blob" || !/^100(644|755)$/.test(file.mode)) return { why: `${file.at} is not a regular file in the commit` };
  return { bytes: git(top, ["cat-file", "blob", file.object], "buffer") };
};

// The files of one commit, for the refresh (D-130): the page is built from nothing but that commit, so
// it is the commit's by construction. A path is the commit's, from its root; an absolute one is
// refused. inputs keeps each file read, its path as the configuration gives it and its bytes, for the
// comparison with the working tree that the refresh makes before it writes.
const fromCommit = (top, sha) => ({
  inputs: [],
  start: "",
  at: (from, path) => {
    if (isAbsolute(path)) throw new Error(`${path}: the configuration names a path outside the commit`);
    return from ? `${from}/${path}` : path;
  },
  dir: (path) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ""),
  file: (path) => join(top, path),
  read(path) {
    const { bytes, why } = inCommit(top, sha, path);
    if (why) throw new Error(`${path} in commit ${sha}: ${why}`);
    this.inputs.push({ path, bytes });
    return bytes.toString("utf8");
  },
});

// Whether the working tree holds a file of the commit as the commit does (D-105, D-130): its path, as
// the configuration gives it, taken by inputAt, so that a .. part or a symbolic link on it, the file
// included, is not the same whatever file it leads to; and the file a regular one, read without waiting
// and never through a link, with the commit's bytes. A missing file, a named pipe or any other kind is
// not the same, and is never opened.
const sameInWorkingTree = (top, path, bytes) => {
  const { at, why } = inputAt(asked(top, path), top);
  if (why) return false;
  try {
    return readRegular(at, { noFollow: true }).bytes.equals(bytes);
  } catch {
    return false;
  }
};

// Builds the page from a configuration, every file read once from one source, the working tree or a
// commit, the ontologies at the paths the configuration names from its directory as asked.
export function buildTree(configPath, labelsFile, source = workingTree()) {
  const configAt = source.at(source.start, configPath);
  const configText = source.read(configAt);
  const cfg = loadConfig(source.file(configAt), configText);
  const raw = JSON.parse(configText);
  const files = [raw.ontology, ...(raw.external ?? []).map((e) => e.ontology)].map((p) => source.at(source.dir(configAt), p));
  const texts = files.map((f) => source.read(f));
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
  const label = labelsFile ? loadLabels(source.read(source.at(source.start, labelsFile)), known) : () => null;
  const html = texts.map((md) => renderOntology(md, cfg, label));
  return { title: (texts[0].match(/^# (.+)$/m) ?? [, "Ontology"])[1], html, label, inputs: source.inputs, files, configAt };
}

// What a page on demand is built from (field.ontology-tree.built-from). The repository is the one the
// file system finds at the configuration's directory as asked; its commit is read once, and every
// input is compared with that commit, not with a HEAD that may move meanwhile. An input is clean when
// its path, as given, had no .. part and no symbolic link when it was read and has none now, lies
// inside the repository, and the commit holds a regular file at that path whose bytes are the bytes
// read (D-130). dirty lists the inputs that are not clean. onHead, for the tests, runs once the commit
// is read.
export function markOf(built, { onHead } = {}) {
  const dir = dirname(built.configAt);
  const top = git(dir, ["rev-parse", "--show-toplevel"]);
  const head = top === null ? null : git(dir, ["rev-parse", "--verify", "--quiet", "HEAD"]);
  if (top === null || head === null) return { commit: "no-commit", config: null, dirty: [] };
  onHead?.(head);
  // Outside is only a path whose form relative to the root is .. or starts with ../; a file named
  // ..ontology.md is inside.
  const inRepo = (path) => {
    const rel = relative(top, path);
    return rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel) ? null : rel.split(sep).join("/");
  };
  const dirty = [];
  for (const { path, bytes, linked } of built.inputs) {
    const { rel } = inputAt(path, top);
    const same = rel !== undefined && !linked && inCommit(top, head, rel).bytes?.equals(bytes);
    if (!same) dirty.push(rel ?? path);
  }
  // The configuration is named by the file the file system reached, which is the path normalised
  // whenever the page is clean.
  let reached = resolve(built.configAt);
  try {
    reached = realpathSync.native(built.configAt);
  } catch {}
  const config = inRepo(reached) ?? built.configAt;
  return { commit: dirty.length ? `${head}+working-tree` : head, config, dirty: [...new Set(dirty)] };
}

// The date of a mark: UTC to the second, the only form the generator writes, and a real date. A string
// of that form that no calendar has, such as February 30, is taken by Date for another day, so the
// date is compared with what Date makes of it.
const DATE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;
const dateOf = (d) => d.toISOString().replace(/\.\d+Z$/, "Z");
export const isMarkDate = (s) => DATE.test(s) && !Number.isNaN(Date.parse(s)) && dateOf(new Date(s)) === s;

// The file a place names (field.ontology-tree.place, D-130): its base name in its directory as the
// file system resolves that directory, a link or a .. on the way taken as the file system takes it,
// so that the file checked, the file written and the file the stale report reads are one. The system's
// own realpath does it: Node's realpathSync without .native takes a .. away by hand first. The place is
// not an input: it is the one path the file system resolves, links and .. followed. Returns { at }, or
// { why } no file can be named.
const placeAt = (path) => {
  const name = basename(path);
  if (!name || name === "." || name === ".." || path.endsWith(sep)) return { why: "it names a directory, not a file" };
  try {
    return { at: join(realpathSync.native(dirname(path)), name) };
  } catch {
    return { why: `its directory, ${dirname(path)}, does not exist` };
  }
};

// Why no page may be written at a file placeAt named, or null: it is a symbolic link, which is never
// followed; it is not a regular file; or it has more than one link, so that another name of it, a file
// of the repository perhaps, would change with it, which no check of the path can see.
const unwritable = (at) => {
  const st = lstatSync(at, { throwIfNoEntry: false });
  if (!st) return null;
  if (st.isSymbolicLink()) return "it is a symbolic link; set the place to the file itself";
  const kind = kindOf(st);
  if (kind) return `it is ${kind}, not a regular file`;
  return st.nlink > 1 ? `the file there has ${st.nlink} links, and another of them may be a file of the repository` : null;
};

// The page is written to a new file in the directory placeAt resolved and renamed over the file there,
// never written into it: one that changed between the check and the write is replaced, not changed,
// and whoever holds the old file keeps its bytes.
const writePage = (at, built, mark) => {
  const why = unwritable(at);
  if (why) throw new Error(`${at}: ${why}`);
  const date = dateOf(new Date());
  const html = renderTree({ title: built.title, html: built.html }, built.label, { commit: mark.commit, config: mark.config, date });
  const old = lstatSync(at, { throwIfNoEntry: false });
  const tmp = join(dirname(at), `.${basename(at)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    writeFileSync(tmp, html, { flag: "wx" });
    if (old) chmodSync(tmp, old.mode & 0o7777);
    renameSync(tmp, at);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
};

// The clone's own place for its tree (field.ontology-tree.place): only its local Git configuration,
// never ont.config.json; a relative path is taken from the root of the repository, its parts kept.
const placeOf = (top) => {
  const place = git(top, ["config", "--local", "--type=path", "--get", "ont.treeOut"]);
  return place ? asked(top, place) : null;
};
const ROOT_CONFIG = "ont.config.json";

const within = (root, path) => {
  const rel = relative(root, path);
  return !(rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel));
};
const real = (path) => {
  try {
    return realpathSync.native(path);
  } catch {
    return path;
  }
};
// The working tree or Git directory of this repository a file placeAt named lies in, or null: the
// clone's own, its other worktrees, listed by Git with their paths ended by NUL, so that a path with a
// line break is one path, and the Git directory they share (field.ontology-tree.place).
const repositoryAt = (top, at) => {
  const worktrees = (git(top, ["worktree", "list", "--porcelain", "-z"]) ?? "")
    .split("\0")
    .filter((l) => l.startsWith("worktree "))
    .map((l) => l.slice(9));
  const common = git(top, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  return [top, ...worktrees, ...(common ? [common] : [])].find((root) => within(real(root), at)) ?? null;
};
const SELF = fileURLToPath(import.meta.url);

// What the post-merge hook runs (rule.tree-refreshed-after-merge): on main with a place set, the tree
// from the ont.config.json at the root as the commit of HEAD holds it, read once, written only when the
// working tree holds the same files at the paths the configuration gives, and naming those that differ
// when it does not (D-130). Silent
// off main or without a place; at a place inside the repository, at one that is a symbolic link, is
// not a regular file or has more than one link, or after a squash merge, which leaves main where it
// was, it says why it writes nothing.
export function refresh(cwd, { squash = false } = {}) {
  const top = git(cwd, ["rev-parse", "--show-toplevel"]);
  if (top === null) throw new Error("--refresh runs inside a Git repository");
  const place = placeOf(top);
  if (!place || git(top, ["symbolic-ref", "--quiet", "HEAD"]) !== "refs/heads/main") return [];
  const { at, why: unnamed } = placeAt(place);
  if (unnamed) return [`tree: not written to ${place}: ${unnamed}`];
  // A wrong setting would otherwise overwrite a file of the repository, the ontology itself perhaps.
  const inside = repositoryAt(top, at);
  if (inside)
    return [`tree: not written to ${place}: it is inside the repository, at ${inside}, where the page would overwrite its files; set ont.treeOut to a path outside it`];
  const why = unwritable(at);
  if (why) return [`tree: not written to ${place}: ${why}`];
  if (squash)
    return [`tree: not written to ${place}: a squash merge leaves main where it was; after committing it, run node ${relative(top, SELF)} --refresh`];
  const head = git(top, ["rev-parse", "--verify", "--quiet", "HEAD"]);
  if (head === null) throw new Error("main has no commit");
  const built = buildTree(ROOT_CONFIG, null, fromCommit(top, head));
  // The page is written only when the working tree holds the files it was built from, so that a change
  // not committed is named rather than passed over, and the page there stays as it was (D-105, D-130).
  const differ = [...new Set(built.inputs.filter(({ path, bytes }) => !sameInWorkingTree(top, path, bytes)).map(({ path }) => path))];
  if (differ.length)
    return [
      `tree: not written to ${place}: the working tree differs from commit ${head} at ${differ.join(", ")}; the page there is kept. Commit or restore ${differ.length > 1 ? "them" : "it"}, then run node ${relative(top, SELF)} --refresh`,
    ];
  writePage(at, built, { commit: head, config: ROOT_CONFIG });
  return [`${place}: ${built.files.length} ${built.files.length > 1 ? "ontologies" : "ontology"}, built from ${head}`];
}

// Why the tree at the clone's place does not show main (derived.tree-stale): nothing when it does, or
// when no place is set. It reads the file the refresh writes, the place resolved the same way, and
// never fails, a file it cannot read included; a stale page is one to rewrite, not a broken repository.
export function stale(cwd) {
  const top = git(cwd, ["rev-parse", "--show-toplevel"]);
  const place = top === null ? null : placeOf(top);
  if (!place) return [];
  const at = `TREE_STALE ${place}:`;
  const named = placeAt(place);
  if (named.why) return [`${at} ${named.why}`];
  let html;
  try {
    html = readRegular(named.at, { noFollow: true }).bytes.toString("utf8");
  } catch (e) {
    // A place of another kind is named and never opened: a read of a named pipe with no writer would
    // wait for ever, and opening a device may do what the device does; a symbolic link the refresh
    // refuses is not followed. A file this user cannot read is reported like a missing one.
    if (e.kind) return [`${at} the place is ${e.kind}, not a regular file`];
    return [e.code === "ENOENT" ? `${at} the file does not exist` : `${at} the file cannot be read (${e.code ?? e.message})`];
  }
  const mark = readMark(html);
  if (!mark) return [`${at} the page carries no mark of what it was built from`];
  const main = git(top, ["rev-parse", "--verify", "--quiet", "refs/heads/main"]);
  const out = [];
  // Silence needs the whole mark: a clean commit equal to main, the root configuration and the date.
  // A part missing is reported, not taken as current.
  const outsideGit = mark.commit === "no-commit";
  if (mark.commit === null) out.push(`${at} the mark names no commit`);
  else if (outsideGit) out.push(`${at} built outside Git (no-commit)`);
  else if (mark.commit.endsWith("+working-tree")) out.push(`${at} built from files that differ from commit ${mark.commit.replace(/\+working-tree$/, "")} (+working-tree)`);
  if (mark.config === null && !outsideGit) out.push(`${at} the mark names no configuration`);
  else if (mark.config !== null && mark.config !== ROOT_CONFIG) out.push(`${at} built from another configuration, ${mark.config}, not the ${ROOT_CONFIG} at the root`);
  if (mark.date === null) out.push(`${at} the mark carries no date`);
  else if (!isMarkDate(mark.date)) out.push(`${at} the mark's date, ${mark.date}, is not a date and time of the form 2026-11-20T09:30:00Z`);
  const sha = mark.commit?.replace(/\+working-tree$/, "");
  if (main === null) out.push(`${at} the repository has no branch main`);
  else if (sha && !outsideGit && sha !== main) out.push(`${at} built from ${sha}, but main is ${main}`);
  if (out.length) out.push(`  rewrite it on main with node ${relative(top, SELF)} --refresh`);
  return out;
}

// Run as a command, not imported: this file's path against the script Node was given, both as paths. A
// URL built from the argument by hand would read a # or a % in the clone's path as a URL's own.
const isMain = (() => {
  const arg = process.argv[1];
  if (!arg) return false;
  try {
    return realpathSync(arg) === SELF;
  } catch {
    return resolve(arg) === SELF;
  }
})();
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
    // The report never fails (derived.tree-stale): what stops it is itself reported, and it ends with 0.
    try {
      for (const line of stale(process.cwd())) console.log(line);
    } catch (e) {
      console.log(`TREE_STALE: the report could not be made: ${e.message}`);
    }
  } else {
    const out = opt("--out");
    if (!out) throw new Error("--out is not set: the file to write the tree to");
    try {
      const built = buildTree(opt("--config") ?? ROOT_CONFIG, opt("--labels"));
      const mark = markOf(built);
      const { at, why } = placeAt(asked(process.cwd(), out));
      if (why) throw new Error(`${out}: ${why}`);
      writePage(at, built, mark);
      console.log(`${out}: ${built.files.length} ${built.files.length > 1 ? "ontologies" : "ontology"}, built from ${mark.commit}`);
    } catch (e) {
      console.error(`tree: not written: ${e.message}`);
      process.exit(1);
    }
  }
}
