// Shared parsing for ont-check and gen-glossary. One parser for both tools: if the generator and
// the check read the glossary differently, a broken document passes unnoticed.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const read = (path) => readFileSync(path, "utf8");

// An entry is accepted when one of its lines matches this pattern. A log in another language sets
// decisions.accepted in the config.
export const DEFAULT_ACCEPTED = "^- Date:.*Status:\\s*accepted\\b";

// Loads ont.config.json and resolves every path against the config file's directory.
export function loadConfig(configPath) {
  const file = resolve(configPath);
  const base = dirname(file);
  const raw = JSON.parse(read(file));
  const at = (p) => (p ? resolve(base, p) : null);
  const headings = {
    implementation: "## Implementation status",
    retired: "## Retired IDs",
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
    tests: raw.tests && {
      dir: at(raw.tests.dir),
      match: new RegExp(raw.tests.match ?? "\\.test\\.[a-z]+$"),
      cover: raw.tests.cover ?? [],
    },
    tickets: raw.tickets && {
      dir: at(raw.tickets.dir),
      match: new RegExp(raw.tickets.match ?? "\\.md$"),
    },
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

// Tags in test titles and ticket scenarios: [inv.one-loan-per-item] or [rule.renewal, field.renewals].
export const tagIds = (text, classes) => {
  const id = `(?:${classes.join("|")})\\.[a-z0-9-]+(?:\\.[a-z0-9-]+)*`;
  return [...text.matchAll(new RegExp(`\\[(${id}(?:\\s*,\\s*${id})*)\\]`, "g"))].flatMap((m) =>
    m[1].split(",").map((x) => x.trim()),
  );
};

export const idPattern = (classes) =>
  new RegExp(`^(?:${classes.join("|")})\\.[a-z0-9-]+(?:\\.[a-z0-9-]+)*$`);

// IDs are written in backticks in Markdown: `field.due-date`. Anything else is prose.
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
// concept, in tables grouped by entity. Returns { ONT: { id: { name, def } }, rows } in document
// order; each row knows its table (a run of consecutive table lines), its Kind and Type cells and
// its line.
export function parseGlossary(md) {
  const ONT = {};
  const rows = [];
  let table = 0;
  let inTable = false;
  for (const line of md.split("\n")) {
    const pipe = line.startsWith("|");
    if (pipe && !inTable) table += 1;
    inTable = pipe;
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
    rows.push({ table, kind, id, type: type?.replace(/`/g, "") ?? null, line });
  }
  if (!rows.length) throw new Error("The glossary is empty: no | Kind | `id` | Term | Definition | rows");
  return { ONT, rows };
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
