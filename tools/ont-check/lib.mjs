// Shared parsing for the check and the generators. One parser for all of them: if a generator and
// the check read the ontology differently, a broken document passes unnoticed.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const read = (path) => readFileSync(path, "utf8");

// An entry is accepted when one of its lines matches this pattern. A log in another language sets
// decisions.accepted in the config.
export const DEFAULT_ACCEPTED = "^- Date:.*Status:\\s*accepted\\b";
// An entry that replaces older ones names them on a line of its own; group 1 holds the list.
export const DEFAULT_SUPERSEDES = "^- Supersedes:\\s*(.+)$";

// Loads ont.config.json and resolves every path against the config file's directory.
export function loadConfig(configPath) {
  const file = resolve(configPath);
  const base = dirname(file);
  const raw = JSON.parse(read(file));
  const at = (p) => (p ? resolve(base, p) : null);
  // Headings in another language are set in the config. Known divergences are found by the start of
  // their heading line, so "### Known divergences between code and ontology" matches the default.
  const headings = {
    implementation: "## Implementation status",
    retired: "## Retired IDs",
    divergences: "### Known divergences",
    ...raw.headings,
  };
  // classes: an array of class names, or an object { class: "Kind label" }. The order is the order
  // of kinds inside every definition table; labels, when given, are checked in the Kind column.
  const classes = Array.isArray(raw.classes) ? raw.classes : Object.keys(raw.classes);
  return {
    file,
    base,
    root: at(raw.root ?? "."),
    classes,
    kinds: Array.isArray(raw.classes) ? null : raw.classes,
    scoped: raw.scoped ?? [],
    headings,
    ontology: at(raw.ontology),
    decisions: raw.decisions && {
      file: at(raw.decisions.file),
      entry: new RegExp(raw.decisions.entry ?? "^### (D-\\d+) · .+$", "gm"),
      ref: new RegExp(raw.decisions.ref ?? "\\bD-\\d+\\b", "g"),
      accepted: new RegExp(raw.decisions.accepted ?? DEFAULT_ACCEPTED, "im"),
      supersedes: new RegExp(raw.decisions.supersedes ?? DEFAULT_SUPERSEDES, "im"),
    },
    glossaryOut: at(raw.glossaryOut),
    contracts: raw.contracts && {
      out: at(raw.contracts.out),
      classes: raw.contracts.classes ?? ["field", "edge"],
      propertyCase: raw.contracts.propertyCase ?? "camel",
    },
    mockup: (raw.mockup ?? []).map(at),
    map: raw.map && { file: at(raw.map.file), idColumn: raw.map.idColumn ?? 2 },
    features: raw.features && {
      dir: at(raw.features.dir),
      cover: raw.features.cover ?? [],
    },
    // Test suites: each names the classes whose implemented concepts it must prove. The older
    // single "tests" key is a suite without a name.
    testSuites: [...(raw.tests ? [{ name: "", ...raw.tests }] : []), ...(raw.testSuites ?? [])].map(
      (t) => ({
        name: t.name ?? "",
        dir: at(t.dir),
        match: new RegExp(t.match ?? "\\.test\\.[a-z]+$"),
        cover: t.cover ?? [],
      }),
    ),
    checks: raw.checks && {
      file: at(raw.checks.file),
      require: raw.checks.require ?? ["inv", "rule"],
    },
    tickets: raw.tickets && {
      dir: at(raw.tickets.dir),
      match: new RegExp(raw.tickets.match ?? "\\.md$"),
    },
    // Documentation: sets of hand-written pages anchored to concepts, and generated reference pages.
    docSets: (raw.docSets ?? []).map((d) => ({
      name: d.name ?? "",
      dir: at(d.dir),
      match: new RegExp(d.match ?? "\\.md$"),
      cover: d.cover ?? [],
      scope: d.scope ?? "implemented",
    })),
    references: (raw.references ?? []).map((r) => ({ ...r, out: at(r.out) })),
    // Other ontologies whose IDs may appear here as examples, such as a worked example inside the
    // repository of a method: their IDs and checks are known, but they are not this ontology's.
    external: (raw.external ?? []).map((e) => ({ ontology: at(e.ontology), checks: at(e.checks) })),
    notYetShown: raw.notYetShown ?? [],
  };
}

// Files under dir (recursively) whose relative path matches the pattern, README.md excluded.
export const listFiles = (dir, match) =>
  existsSync(dir)
    ? readdirSync(dir, { recursive: true })
        .map(String)
        .filter((f) => match.test(f) && !/(^|\/)README\.md$/.test(f))
        .sort()
        .map((f) => join(dir, f))
    : [];

// Tags in tests and ticket scenarios: [check.loan.renew-while-held] or [rule.renewal, field.loan.renewals].
export const tagIds = (text, classes) => {
  const id = `(?:${classes.join("|")})\\.[a-z0-9-]+(?:\\.[a-z0-9-]+)*`;
  return [...text.matchAll(new RegExp(`\\[(${id}(?:\\s*,\\s*${id})*)\\]`, "g"))].flatMap((m) =>
    m[1].split(",").map((x) => x.trim()),
  );
};

export const idPattern = (classes) =>
  new RegExp(`^(?:${classes.join("|")})\\.[a-z0-9-]+(?:\\.[a-z0-9-]+)*$`);

// IDs are written in backticks in Markdown: `field.loan.due-date`. Anything else is prose.
export const backtickIds = (text, classes) => {
  const isId = idPattern(classes);
  return [...text.matchAll(/`([a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+)`/g)]
    .map((m) => m[1])
    .filter((x) => isId.test(x));
};

// A section runs from its heading to the next heading of the same or a higher level.
export function section(md, heading) {
  const start = md.indexOf(heading);
  if (start < 0) throw new Error(`Section "${heading}" not found`);
  const level = heading.match(/^#+/)[0].length;
  const next = new RegExp(`\\n#{1,${level}} `, "g");
  next.lastIndex = start + heading.length;
  const end = next.exec(md);
  return md.slice(start, end ? end.index : undefined);
}

// A definition row: | Kind | `id` | Term | Definition |, or | Kind | `id` | Term | Type | Definition |
// in tables that carry types. The Kind cell holds no backticks, which keeps implementation rows
// (| `id` | `path` | note |) and retired rows out.
const ID_CELL = /^`([a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+)`$/;

// The glossary is the set of definition rows, wherever they sit in the ontology: one row per
// concept, in tables grouped by entity. Returns { ONT: { id: { name, def } }, rows, notes } in
// document order; each row knows its table (a run of consecutive table lines), its section heading,
// its Kind and Type cells and its line. notes maps each section heading to the lines of text outside
// its tables: the notes that add detail to its concepts.
export function parseGlossary(md) {
  const ONT = {};
  const rows = [];
  const notes = new Map();
  let table = 0;
  let inTable = false;
  let heading = "";
  for (const line of md.split("\n")) {
    if (/^## /.test(line)) heading = line.slice(3).trim();
    const pipe = line.startsWith("|");
    if (pipe && !inTable) table += 1;
    inTable = pipe;
    if (!pipe && line.trim() && !/^#/.test(line)) notes.set(heading, [...(notes.get(heading) ?? []), line.trim()]);
    if (!/^\|.*\|\s*$/.test(line)) continue;
    const cells = line.trim().slice(1, -1).split("|").map((c) => c.trim());
    if (cells.length < 4 || cells.length > 5 || cells[0].includes("`")) continue;
    const m = cells[1].match(ID_CELL);
    if (!m) continue;
    const [kind, , name] = cells;
    const [type, def] = cells.length === 5 ? [cells[3], cells[4]] : [null, cells[3]];
    const id = m[1];
    if (ONT[id]) throw new Error(`Duplicate ID in the glossary: ${id}`);
    ONT[id] = { name, def: def.replace(/`/g, "") };
    rows.push({ table, heading, kind, id, type: type?.replace(/`/g, "") ?? null, line });
  }
  if (!rows.length) throw new Error("The glossary is empty: no | Kind | `id` | Term | Definition | rows");
  return { ONT, rows, notes };
}

// The check catalogue: | `check.section.name` | `id`, `id` | GIVEN | WHEN | THEN | auto or manual |,
// under one "## Section" per entity. A check states what must hold in product terms, for any
// implementation; tests implement it and carry its ID in their title.
export const slug = (heading) => heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export function parseChecks(md) {
  const checks = [];
  let heading = "";
  for (const line of md.split("\n")) {
    if (/^## /.test(line)) heading = line.slice(3).trim();
    if (!/^\|.*\|\s*$/.test(line)) continue;
    const cells = line.trim().slice(1, -1).split("|").map((c) => c.trim());
    const m = cells[0].match(/^`(check\.[a-z0-9-]+(?:\.[a-z0-9-]+)*)`$/);
    if (!m) continue;
    const [, concepts = "", given = "", when = "", then = "", proof = ""] = cells;
    checks.push({
      id: m[1],
      section: slug(heading),
      concepts: [...concepts.matchAll(/`([^`]+)`/g)].map((x) => x[1]),
      given,
      when,
      then,
      proof,
      cells: cells.length,
    });
  }
  return checks;
}

// Implementation status: | `id` | `path`, `path` | note | under the implementation heading.
// Returns the rows as [id, files] pairs; an empty list when the heading is unset or absent.
export function parseImplemented(md, heading) {
  if (!heading || !md.includes(heading)) return [];
  return [...section(md, heading).matchAll(/^\|\s*`([a-z][a-z0-9.-]+)`\s*\|([^|]*)\|/gm)].map((r) => [
    r[1],
    [...r[2].matchAll(/`([^`]+)`/g)].map((x) => x[1]),
  ]);
}

// Retired IDs: | `old.id` | `new.id` or — | D-nn |. An ID that had to change stays resolvable here,
// so append-only records such as the decision log never need editing.
export function parseRetired(md, heading) {
  if (!heading || !md.includes(heading)) return new Map();
  return new Map(
    [...section(md, heading).matchAll(/^\|\s*`([a-z][a-z0-9.-]+)`\s*\|([^|]*)\|/gm)].map((m) => [
      m[1],
      (m[2].match(/`([^`]+)`/) ?? [])[1] ?? null,
    ]),
  );
}

export const renderGlossary = (ONT, sourceName) =>
  `// Generated by tools/ont-check/gen-glossary.mjs from ${sourceName}. Do not edit by hand.
window.ONT = ${JSON.stringify(ONT, null, 1)};
`;
