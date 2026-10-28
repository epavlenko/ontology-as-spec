// Drift check between the ontology and everything that refers to it: the generated tooltips,
// contracts and reference pages, the mockup and its map, the decision log, the implementation table,
// the check catalogue, the tests, the tickets, the documentation, and the older verification map.
// Usage: node tools/ont-check/ont-check.mjs [--config path/to/ont.config.json] [--coverage]
//          [--gap [path/to/ticket.md]] [--next] [--decisions]
// --coverage also prints which checks and test suites prove each implemented concept, and where code names it.
// --gap also prints the work left: target concepts with their checks, untested checks, divergences;
//   with a ticket, only its slice, and the exit code is 1 until the slice is done. Without one, each
//   target says what it waits for: a ticket, a deferral, the owner, another target, or nothing (ready).
// --next also prints the next slice to build, as IDs: and Checks: lines for a ticket.
// --decisions also prints every entry of the decision log: in force, tentative or superseded by what,
//   and the later entries that name it.
// Exit code 1 on any error. Prints ONT_OK when everything is consistent.
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
  backtickIds,
  codeNames,
  idPattern,
  listFiles,
  loadApproach,
  loadConfig,
  axisValue,
  parseCannotOccur,
  parseChecks,
  parseGlossary,
  parseImplemented,
  parseRetired,
  read,
  renderApproach,
  renderGlossary,
  SECTION_KEY,
  section,
  keySpans,
  sectionKey,
  tagIds,
} from "./lib.mjs";
import { buildContracts, renderContracts } from "./contracts.mjs";
import { parseAnchors, renderReference, stampOf } from "./docs.mjs";

const groupBy = (xs, key) =>
  xs.reduce((m, x) => m.set(key(x), [...(m.get(key(x)) ?? []), x]), new Map());

const arg = process.argv.indexOf("--config");
const cfg = loadConfig(arg > 0 ? process.argv[arg + 1] : "ont.config.json");
const { classes } = cfg;
const ids = (text) => backtickIds(text, classes);
const diff = (a, b) => [...a].filter((x) => !b.has(x)).sort();
const errors = [];
const report = (label, items, fatal = true, limit = Infinity) => {
  if (!items.length) return;
  const shown = items.length > limit ? [...items.slice(0, limit), `… ${items.length - limit} more`] : items;
  console.log(`${fatal ? "ERROR" : "info"} · ${label} (${items.length}):\n  ${shown.join("\n  ")}`);
  if (fatal) errors.push(label);
};

const md = read(cfg.ontology);
const { ONT, rows, notes } = parseGlossary(md);
const glossary = new Set(Object.keys(ONT));
const retired = parseRetired(md, cfg.headings.retired);
const retiredSection = retired.size ? section(md, cfg.headings.retired) : "";
// The ontology text: everything except the ID cell of each definition row and the retired table.
const body = new Set(
  ids(
    rows.reduce(
      (text, r) => text.replace(r.line, r.line.replace(`\`${r.id}\``, "")),
      md.replace(retiredSection, ""),
    ),
  ),
);

// IDs of external ontologies (examples quoted in the text of a method, fixtures in its tests) are
// known but not this ontology's: they are skipped wherever IDs are resolved.
const external = new Set(
  cfg.external.flatMap((e) => [
    ...(e.ontology ? Object.keys(parseGlossary(read(e.ontology)).ONT) : []),
    ...(e.ontology ? [...parseRetired(read(e.ontology), cfg.headings.retired).keys()] : []),
    ...(e.checks ? parseChecks(read(e.checks)).map((c) => c.id) : []),
  ]),
);
const ours = (set) => new Set([...set].filter((x) => glossary.has(x) || !external.has(x)));

// The approach's own IDs, copied with the tool (D-53): agent instructions and process entries of a
// project name rules of the approach, which its ontology does not define.
const approach = loadApproach();
// File names such as `action.yml` or `view.tsx` look like IDs of the approach's classes and are not.
const FILE_NAME = /\.(md|mdx|txt|json|jsonc|ya?ml|toml|ini|lock|m?js|cjs|jsx|tsx?|html?|css|scss|py|rb|go|rs|java|kt|swift|sh|sql|csv|svg|png|jpe?g)$/;
const anyIds = (text) =>
  backtickIds(text, [...new Set([...classes, ...(approach?.classes ?? [])])]).filter((x) => !FILE_NAME.test(x));
const ofApproach = (x) => Boolean(approach?.ids.has(x) || approach?.retired.has(x));

// The glossary is the only source of IDs: everything that refers to a concept must find it there.
// A retired ID resolves in the decision log, which is never edited; anywhere else it is drift.
// ont: inv.references-defined, inv.known-classes, ent.retired-id, edge.retired-id.replaced-by, edge.retired-id.decision, inv.retired-not-defined, inv.retired-only-in-log, inv.replacement-exists
const retiredUse = [];
const unknown = (label, where, set, allowRetired = false) => {
  const missing = diff(ours(set), glossary);
  const old = missing.filter((x) => retired.has(x));
  if (!allowRetired)
    retiredUse.push(...old.map((x) => `${x} in ${where}, now ${retired.get(x) ?? "removed"}`));
  report(label, missing.filter((x) => !retired.has(x)));
};
const isId = idPattern(classes);
report(
  "glossary IDs of a class not listed in the config",
  [...glossary].filter((x) => !isId.test(x)),
);
unknown("IDs in the ontology text but not in the glossary", "the ontology text", body);
report(
  "retired IDs still defined in the glossary",
  [...retired.keys()].filter((x) => glossary.has(x)),
);
report(
  "retired IDs replaced by an ID not in the glossary",
  [...retired].filter(([, now]) => now && !glossary.has(now)).map(([x, now]) => `${x} → ${now}`),
);

// Definition tables: kinds in the configured order, the kind named on the first row of each group,
// and a field or relation in the table of the entity its ID names (field.loan.due-date → ent.loan).
// ont: ent.concept, field.concept.id, field.concept.kind, field.concept.term, field.concept.type, field.concept.definition, edge.concept.entity, rule.kind-order, rule.scoped-ids, inv.one-definition-row, inv.kind-named-once, inv.field-in-its-entity
const cls = (id) => id.split(".")[0];
const tables = groupBy(rows, (r) => r.table);
const outOfOrder = [];
const badKind = [];
const misplaced = [];
const twoEntities = [];
for (const t of tables.values()) {
  const ents = t.filter((r) => cls(r.id) === "ent");
  if (ents.length > 1) twoEntities.push(ents.map((r) => r.id).join(", "));
  const entity = ents[0]?.id.split(".")[1];
  t.forEach((r, i) => {
    const prev = t[i - 1];
    if (prev && classes.indexOf(cls(r.id)) < classes.indexOf(cls(prev.id)))
      outOfOrder.push(`${r.id} after ${prev.id}`);
    if (cfg.kinds) {
      const want = !prev || cls(prev.id) !== cls(r.id) ? cfg.kinds[cls(r.id)] : "";
      if (r.kind !== want)
        badKind.push(`${r.id}: "${r.kind}", expected ${want ? `"${want}"` : "an empty cell inside its group"}`);
    }
    if (cfg.scoped.includes(cls(r.id))) {
      const [c, owner, ...name] = r.id.split(".");
      if (!name.length) misplaced.push(`${r.id}: expected ${c}.<entity>.<name>`);
      else if (!glossary.has(`ent.${owner}`)) misplaced.push(`${r.id}: no entity ent.${owner}`);
      else if (owner !== entity)
        misplaced.push(`${r.id}: belongs in the table of ent.${owner}${entity ? `, not ent.${entity}` : ""}`);
    }
  });
}
report("definition rows out of kind order (run format-ontology.mjs)", outOfOrder);
report("Kind cells that do not match the row's class (run format-ontology.mjs)", badKind);
report("fields or relations outside their entity's table", misplaced);
report("definition tables with more than one entity", twoEntities);

// Implementation status: | `id` | `path`, `path` | note |. Files must exist; completeness is a human call.
// Set "implementation": null under headings until there is code.
// ont: ent.implementation-row, field.implementation-row.files, field.implementation-row.note, edge.implementation-row.concept, inv.implementation-files-exist, derived.implemented, derived.target
const implRows = parseImplemented(md, cfg.headings.implementation);
const implemented = new Set(implRows.map(([id]) => id));
const implFiles = [...new Set(implRows.flatMap(([, files]) => files))];
unknown("IDs in the implementation table but not in the glossary", "the implementation table", implemented);
report(
  "files from the implementation table not found",
  implFiles.filter((f) => !existsSync(resolve(cfg.root, f))),
);

// Code names the concepts it implements in a comment, "// ont: rule.renewal" (D-57). The names in the
// files of the implementation table and of the configured code directories resolve; an implemented
// concept that the files of its row do not name is listed as information, since a name is not an
// implementation and the table still says where a concept is built (D-38).
// ont: derived.named-in-code, inv.code-names-resolve
const namedIn = new Map();
{
  const files = new Set([
    ...implFiles.map((f) => resolve(cfg.root, f)).filter((f) => existsSync(f)),
    ...cfg.code.flatMap((c) => listFiles(c.dir, c.match)),
  ]);
  const undefinedNames = [];
  const retiredNames = [];
  for (const f of files) {
    const rel = relative(cfg.root, f);
    for (const x of new Set(codeNames(read(f), /\.(md|markdown)$/i.test(f)))) {
      if (glossary.has(x)) namedIn.set(x, [...(namedIn.get(x) ?? []), rel]);
      else if (external.has(x)) continue;
      else if (retired.has(x)) retiredNames.push(`${rel}: ${x}, now ${retired.get(x) ?? "removed"}`);
      else undefinedNames.push(`${rel}: ${x}`);
    }
  }
  report("IDs named in code that the ontology does not define", undefinedNames);
  report("retired IDs named in code", retiredNames);
  const rowFiles = new Map();
  for (const [id, fs] of implRows) rowFiles.set(id, [...(rowFiles.get(id) ?? []), ...fs]);
  report(
    "implemented concepts that the files of their row do not name",
    [...rowFiles].filter(([id, fs]) => glossary.has(id) && !fs.some((f) => namedIn.get(id)?.includes(f))).map(([id]) => id),
    false,
    20,
  );
}

// Known divergences: bullets under the configured heading, each naming the concepts involved.
// --gap matches a divergence to a ticket by those IDs, so a line that names none belongs to no slice.
// ont: ent.divergence, field.divergence.description, edge.divergence.concepts, inv.divergence-names-concepts
const divHeading = cfg.headings.divergences
  ? md.split("\n").find((l) => l.startsWith(cfg.headings.divergences))
  : null;
const divergenceLines = divHeading ? section(md, divHeading).split("\n").filter((l) => /^- /.test(l)) : [];
report(
  "known divergences that name no concept by ID",
  divergenceLines.filter((l) => !ids(l).some((x) => glossary.has(x))).map((l) => l.slice(0, 70)),
);

// Generated tooltips are compared whole: catches both a forgotten regeneration and a hand edit.
// ont: inv.tooltips-generated
if (cfg.glossaryOut) {
  const expected = renderGlossary(ONT, relative(cfg.base, cfg.ontology));
  const actual = existsSync(cfg.glossaryOut) ? read(cfg.glossaryOut) : "";
  report(
    "generated glossary differs from the ontology (run gen-glossary.mjs)",
    actual === expected ? [] : [relative(cfg.base, cfg.glossaryOut)],
  );
}

// Contracts: every field and relation row has a type from the vocabulary, and the generated
// JSON Schema equals what the generator would write now.
if (cfg.contracts) {
  const { problems, schema } = buildContracts(rows, ONT, cfg);
  report("types that cannot become a contract", problems);
  if (!problems.length) {
    const actual = existsSync(cfg.contracts.out) ? read(cfg.contracts.out) : "";
    report(
      "generated contracts differ from the ontology (run gen-contracts.mjs)",
      actual === renderContracts(schema) ? [] : [relative(cfg.base, cfg.contracts.out)],
    );
  }
}

// The approach's own repository writes its IDs next to the tool, and they match its ontology (D-53).
// ont: inv.approach-ids-current
if (cfg.approachIds) {
  const actual = existsSync(cfg.approachIds.out) ? read(cfg.approachIds.out) : "";
  report(
    "generated approach IDs differ from the ontology (run gen-approach.mjs)",
    actual === renderApproach(ONT, retired) ? [] : [relative(cfg.base, cfg.approachIds.out)],
  );
}

// Mockup: data-ont attributes plus quoted IDs in scripts ('view.catalog').
// ont: ent.mockup-element, edge.mockup-element.concept, inv.dynamic-ids-declared
const classAlt = classes.join("|");
const html = cfg.mockup.map(read).join("\n");
const used = new Set([
  ...[...html.matchAll(/data-ont="([a-z][a-z0-9.-]+)"/g)].map((m) => m[1]),
  ...[...html.matchAll(new RegExp(`'((?:${classAlt})\\.[a-z0-9.-]+)'`, "g"))].map((m) => m[1]),
]);
if (cfg.mockup.length) {
  unknown("data-ont in the mockup but not in the glossary", "the mockup", used);
  // IDs built from a template (data-ont="derived.${key}") are declared in a comment so the check
  // sees them. The comment proves nothing, so every declared class needs a live template.
  const declared = [
    ...new Set(
      [...html.matchAll(/\/\* data-ont dynamic[^*]*\*\//g)].flatMap((m) =>
        [...m[0].matchAll(/'([a-z]+)\.[a-z0-9.-]+'/g)].map((x) => x[1]),
      ),
    ),
  ];
  report(
    "class declared dynamic but the mockup has no data-ont template for it",
    declared.filter((c) => !html.includes(`data-ont="${c}.\${`)),
  );
}

// Map: the ID column of every table row. The map and the mockup describe the same set of elements.
// ont: ent.map-row, field.map-row.shows, field.map-row.does-not-do, edge.map-row.concept, inv.mockup-matches-map
let mapped = new Set();
if (cfg.map) {
  const map = read(cfg.map.file);
  const col = cfg.map.idColumn;
  mapped = new Set(
    map
      .split("\n")
      .filter((l) => l.startsWith("|"))
      .flatMap((l) => ids(l.split("|")[col] ?? "")),
  );
  unknown("IDs in the map but not in the glossary", "the map", mapped);
  report("IDs in the map but not in the mockup", diff(mapped, used));
  report("data-ont in the mockup but not in the map", diff(used, mapped));
}

// Decision log: IDs exist, references point at real entries, entries are not duplicated.
// ont: ent.decision, field.decision.number, field.decision.status, field.decision.date, field.decision.choice, field.decision.why, field.decision.rejected, field.decision.title, edge.decision.concepts, inv.decision-numbers-unique, inv.decision-references-resolve
const decisionLog = [];
if (cfg.decisions) {
  const dec = read(cfg.decisions.file);
  unknown(
    "IDs in the decision log but not in the glossary",
    "the decision log",
    new Set(ids(dec).filter((x) => glossary.has(x) || !ofApproach(x))),
    true,
  );
  const entries = [...dec.matchAll(cfg.decisions.entry)].map((m) => m[1]);
  const refSources = [md, cfg.map ? read(cfg.map.file) : ""].join("\n");
  const refs = new Set([...refSources.matchAll(cfg.decisions.ref)].map((m) => m[0]));
  report("decision references without an entry in the log", diff(refs, new Set(entries)));
  report(
    "duplicate entries in the decision log",
    entries.filter((x, i) => entries.indexOf(x) !== i),
  );
  // Supersession is written on a line of its own: "- Supersedes: D-05". Every entry named there exists
  // and is older than the entry naming it. The line takes effect when its entry is accepted (D-52): an
  // entry that no accepted entry names there is in force, since a tentative one only proposes the change.
  // ont: edge.decision.supersedes, derived.in-force, inv.supersedes-older
  const heads = [...dec.matchAll(cfg.decisions.entry)];
  // An entry runs to the next heading of level 1 to 3, as in the guard, so that the last entry does not
  // take in the open questions and the history after it.
  const log = heads.map((m, i) => {
    const rest = dec.slice(m.index + m[0].length, heads[i + 1]?.index);
    const end = rest.search(/\n#{1,3} /);
    return {
      id: m[1],
      title: m[0].replace(/^#+\s*/, "").replace(m[1], "").replace(/^\s*[·:—-]?\s*/, ""),
      body: m[0] + (end < 0 ? rest : rest.slice(0, end)),
    };
  });
  const number = (id) => (/\d/.test(id) ? Number(id.replace(/\D+/g, "")) : null);
  const refIn = (text) => [...text.matchAll(new RegExp(cfg.decisions.ref.source, "g"))].map((m) => m[0]);
  const supersededBy = new Map();
  const badSupersedes = [];
  for (const e of log) {
    const line = e.body.match(cfg.decisions.supersedes);
    for (const old of line ? refIn(line[1]) : []) {
      if (!entries.includes(old)) badSupersedes.push(`${e.id} names ${old}, which has no entry`);
      else if (number(old) !== null && number(e.id) !== null && number(old) >= number(e.id))
        badSupersedes.push(`${e.id} names ${old}, which is not older`);
      else if (cfg.decisions.accepted.test(e.body)) supersededBy.set(old, [...(supersededBy.get(old) ?? []), e.id]);
    }
  }
  report("Supersedes lines that name no older entry", badSupersedes);
  // Later entries that mention an entry by number, whatever language the log is in: where a reader of
  // an older entry looks for what came after it.
  // ont: derived.named-by
  const namedBy = new Map();
  for (const e of log)
    for (const old of new Set(refIn(e.body)))
      if (old !== e.id && entries.includes(old) && number(old) !== null && number(old) < number(e.id))
        namedBy.set(old, [...(namedBy.get(old) ?? []), e.id]);
  // One entry, one choice: an entry that replaces only part of another, in prose, shows the older one
  // bundled several choices. Information, because the older entry can no longer be edited; it leaves
  // the list once some entry supersedes the older one whole.
  // ont: inv.superseded-whole
  const ref = cfg.decisions.ref.source;
  const partly = [
    new RegExp(`\\b(?:supersedes|replaces)\\s+(?:the\\s+)?[\\w\\s,-]*?\\bpart\\s+of\\s+(${ref})`, "gi"),
    new RegExp(`(${ref})\\s+no\\s+longer\\s+applies\\b`, "gi"),
  ];
  report(
    "entries replaced only in part and not yet superseded whole (split them when they are next replaced)",
    log.flatMap((e) =>
      [...new Set(partly.flatMap((re) => [...e.body.matchAll(re)].map((x) => x[1])))]
        .filter((old) => old !== e.id && !supersededBy.has(old))
        .map((old) => `${e.id} → ${old}`),
    ),
    false,
  );
  // A question with a recommendation is written as a tentative entry, and the owner's answer accepts
  // it (D-48). Listed while it waits, so that the question stays in sight.
  // ont: derived.waiting-for-owner
  const open = log.filter((e) => !supersededBy.has(e.id));
  report(
    "tentative entries, waiting for the owner's answer",
    open.filter((e) => !cfg.decisions.accepted.test(e.body)).map((e) => `${e.id} · ${e.title}`),
    false,
  );
  // A deferral names what must happen before the thing it put off is taken up again (D-49). Listed
  // while it is in force, so that what was put off is not forgotten; a tentative deferral is not in
  // force and waits with the other tentative entries.
  // ont: field.decision.return-when, derived.deferral-in-force
  report(
    "deferrals in force, each with the condition for taking it up again",
    open
      .filter((e) => cfg.decisions.accepted.test(e.body) && cfg.decisions.returnWhen.test(e.body))
      .map((e) => `${e.id}: ${e.body.match(cfg.decisions.returnWhen)[1]}`),
    false,
  );
  // A project departs from a rule of the approach only by a process entry (D-53): its Extends or
  // Overrides line names concepts the approach defines and has not retired, and it says Layer: process.
  // ont: field.decision.layer, edge.decision.extends, edge.decision.overrides, inv.departure-well-formed
  const departures = [];
  const every = (re, text) =>
    [...text.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`))].map((m) => m[1] ?? "");
  for (const e of log) {
    const lines = [...every(cfg.decisions.extends, e.body), ...every(cfg.decisions.overrides, e.body)];
    if (!lines.length) continue;
    if (!cfg.decisions.processLayer.test(e.body)) departures.push(`${e.id}: no Layer: process line`);
    // A superseded entry is history and cannot be edited: it may name a rule the approach has retired since.
    const history = supersededBy.has(e.id);
    for (const line of lines) {
      const named = anyIds(line);
      if (!named.length) departures.push(`${e.id}: an Extends or Overrides line that names no rule of the approach`);
      for (const x of named)
        if (approach?.retired.has(x)) {
          if (!history) departures.push(`${e.id}: ${x} is retired, now ${approach.retired.get(x) ?? "removed"}`);
        } else if (!approach?.ids.has(x)) departures.push(`${e.id}: ${x} is not a concept of the approach`);
    }
  }
  if (departures.length && !approach) departures.push("approach.json is missing next to the tool: copy it with the tool");
  report("process entries that extend or override the approach wrongly", departures);
  decisionLog.push(
    ...log.map((e) => ({
      ...e,
      namedBy: (namedBy.get(e.id) ?? []).join(", "),
      state: supersededBy.has(e.id)
        ? `superseded by ${supersededBy.get(e.id).join(", ")}`
        : cfg.decisions.accepted.test(e.body)
          ? "in force"
          : "tentative",
    })),
  );
}

// Agent instructions (D-53): every concept ID they mention is defined, in the project's ontology or the
// approach's, and not retired; every entry they cite exists and is in force. In them D-nn is an entry of
// the project's log. Whether a line is a process rule that should name its source, and whether it is
// stricter or looser than the approach, is for a reviewer.
// ont: field.agent-rules.files, inv.agent-rule-references-resolve
if (cfg.agentInstructions.length) {
  const where = (f) => relative(cfg.base, f);
  report("agent instruction files that do not exist", cfg.agentInstructions.filter((f) => !existsSync(f)).map(where));
  if (!approach) report("approach.json is missing next to the tool: copy it with the tool", ["approach.json"]);
  const state = new Map(decisionLog.map((e) => [e.id, e.state]));
  const undefinedIds = [];
  const retiredIds = [];
  const missingEntries = [];
  const supersededEntries = [];
  for (const f of cfg.agentInstructions.filter((x) => existsSync(x))) {
    const text = read(f);
    // The project's own IDs come first: one it retired stays retired where the approach has the same ID.
    for (const x of new Set(anyIds(text))) {
      if (glossary.has(x) || external.has(x)) continue;
      if (retired.has(x)) retiredIds.push(`${where(f)}: ${x}, now ${retired.get(x) ?? "removed"}`);
      else if (approach?.ids.has(x)) continue;
      else if (approach?.retired.has(x)) retiredIds.push(`${where(f)}: ${x}, now ${approach.retired.get(x) ?? "removed"}`);
      else undefinedIds.push(`${where(f)}: ${x}`);
    }
    if (!cfg.decisions) continue;
    for (const d of new Set([...text.matchAll(new RegExp(cfg.decisions.ref.source, "g"))].map((m) => m[0])))
      if (!state.has(d)) missingEntries.push(`${where(f)}: ${d}`);
      else if (state.get(d).startsWith("superseded")) supersededEntries.push(`${where(f)}: ${d}, ${state.get(d)}`);
  }
  report("IDs in the agent instructions that neither the ontology nor the approach defines", undefinedIds);
  report("retired IDs in the agent instructions", retiredIds);
  report("decision entries the agent instructions cite that the log does not have", missingEntries);
  report("superseded decision entries the agent instructions cite (cite the entry in force)", supersededEntries);
}

// Check catalogue: what must hold, in product terms, for any implementation. One row per check,
// under the section of the entity it belongs to; every concept of a required class has a check.
// ont: ent.check, field.check.given, field.check.when, field.check.then, field.check.proof, edge.check.concepts, inv.check-ids-unique, inv.check-in-its-section, inv.check-well-formed, inv.required-concepts-checked, inv.section-keys-match
const checks = cfg.checks ? parseChecks(read(cfg.checks.file)) : [];
const checkById = new Map(checks.map((c) => [c.id, c]));
const checkConcepts = new Set(checks.flatMap((c) => c.concepts));
const fullyImplemented = (c) => c.concepts.every((x) => implemented.has(x));
if (cfg.checks) {
  report(
    "duplicate checks in the catalogue",
    checks.map((c) => c.id).filter((x, i, a) => a.indexOf(x) !== i),
  );
  report(
    "checks outside their section (check.<section>.<name>)",
    checks
      .filter((c) => c.id.split(".")[1] !== c.section)
      .map((c) => `${c.id} under "${c.heading}", whose key is ${c.section ? `"${c.section}"` : "empty"}`),
  );
  // Section keys (D-39). --gap and the reference pages place each check under the ontology section its
  // key names, so a key names one section with definition rows, every catalogue section's key names one
  // of them, and a key written in a heading is one code span of lowercase letters, digits and hyphens.
  const ontologySections = groupBy([...new Set(rows.map((r) => r.heading))], sectionKey);
  const catalogueSections = [...new Set(checks.map((c) => c.heading))];
  report(
    "ontology sections that share a key (give each its own key in a code span: ## Préstamo `loan`)",
    [...ontologySections].filter(([, hs]) => hs.length > 1).map(([k, hs]) => `${k || "(empty)"}: ${hs.join(" / ")}`),
  );
  report(
    "catalogue sections whose key names no ontology section (write the same key in both headings)",
    catalogueSections.filter((h) => !ontologySections.has(sectionKey(h))).map((h) => `${h} → ${sectionKey(h) || "(empty)"}`),
  );
  report(
    "section headings whose code span is not one key of lowercase letters, digits and hyphens",
    [...new Set([...ontologySections.values()].flat().concat(catalogueSections))].filter((h) => {
      const spans = keySpans(h);
      return spans.length > 1 || (spans.length === 1 && !SECTION_KEY.test(spans[0]));
    }),
  );
  report(
    "malformed checks: six or seven cells, concepts, GIVEN, WHEN, THEN, auto, judged or manual",
    checks
      .filter(
        (c) =>
          ![6, 7].includes(c.cells) ||
          !c.concepts.length ||
          !c.given ||
          !c.when ||
          !c.then ||
          !["auto", "judged", "manual"].includes(c.proof),
      )
      .map((c) => c.id),
  );
  unknown("IDs in the check catalogue but not in the glossary", "the check catalogue", checkConcepts);
  // Completeness (D-62): every value of every axis the configuration lists is covered by a check, and
  // an axis with classes by each concept of them, unless a Cannot occur line rules the value out there.
  // ont: inv.axis-values-covered
  if (cfg.checks.axes.length) {
    const axes = new Map(cfg.checks.axes.map((a) => [a.name, a]));
    const ruledOut = parseCannotOccur(read(cfg.checks.file), cfg.checks.cannotOccur);
    const valid = (v) => {
      const [a, value] = axisValue(v);
      return axes.get(a)?.values.includes(value) ? `${a}: ${value}` : null;
    };
    const strange = [];
    // Values covered or ruled out in the whole catalogue, values ruled out for every concept by a line
    // that names none, and values covered or ruled out per concept.
    const whole = new Set();
    const everywhere = new Set();
    const of = new Map();
    const add = (ids, key) => ids.forEach((x) => of.set(x, new Set([...(of.get(x) ?? []), key])));
    for (const c of checks)
      for (const v of c.covers) {
        const key = valid(v);
        if (!key) strange.push(`${c.id}: ${v}`);
        else {
          whole.add(key);
          add(c.concepts, key);
        }
      }
    // A line rules a value out only when it says why, after a dash.
    const unexplained = ruledOut.filter((r) => !r.values.length || !r.reason);
    for (const r of ruledOut.filter((r) => !unexplained.includes(r)))
      for (const v of r.values) {
        const key = valid(v);
        if (!key) strange.push(`Cannot occur: ${v}`);
        else if (r.ids.length) add(r.ids, key);
        else {
          whole.add(key);
          everywhere.add(key);
        }
      }
    report("Cannot occur lines without a value, or without a reason after a dash", unexplained.map((r) => r.line));
    report("axis values that no configured axis has", strange);
    unknown("IDs in Cannot occur lines but not in the glossary", "the check catalogue", new Set(ruledOut.flatMap((r) => r.ids)));
    report(
      "axis values that no check covers and no Cannot occur line rules out",
      [...axes.values()].flatMap((a) => {
        const lack = (have) => a.values.filter((v) => !have.has(`${a.name}: ${v}`) && !everywhere.has(`${a.name}: ${v}`));
        if (!a.each.length) return lack(whole).length ? [`${a.name}: ${lack(whole).join(", ")}`] : [];
        const isOf = new RegExp(`^(?:${a.each.join("|")})\\.`);
        return [...glossary].filter((x) => isOf.test(x) && lack(of.get(x) ?? new Set()).length).map((x) => `${x}: ${lack(of.get(x) ?? new Set()).join(", ")}`);
      }),
    );
  }
  const required = new RegExp(`^(?:${cfg.checks.require.join("|")})\\.`);
  report(
    "concepts without a check",
    cfg.checks.require.length ? diff(glossary, checkConcepts).filter((x) => required.test(x)) : [],
  );
}

// Tests carry the IDs they prove in a tag at the start of the title: a check from the catalogue,
// test("[check.loan.renew-while-held] …"), or a concept directly, test("[inv.queue-order] …").
// A test may only prove what is implemented. Each suite (unit, end-to-end, …) names the classes it
// must cover: every implemented concept of those classes needs a test in that suite, directly or
// through a check that names it.
// ont: ent.test, edge.test.checks, edge.test.suite, inv.test-names-known-checks, inv.test-only-implemented, inv.no-manual-tested, inv.auto-check-tested, ent.test-suite, field.test-suite.name, field.test-suite.cover, inv.suite-names-unique, inv.suite-not-empty, inv.suite-covers-classes
let tested = new Set();
const bySuite = new Map();
const checksTested = new Set();
const suiteName = (t) => (t.name ? `${t.name} ` : "");
const dupes = cfg.testSuites.map((t) => t.name).filter((n, i, a) => a.indexOf(n) !== i);
report("test suites with the same name", [...new Set(dupes)].map((n) => n || "(unnamed)"));
for (const t of cfg.testSuites) {
  const files = listFiles(t.dir, t.match);
  report(
    `no ${suiteName(t)}test files found`,
    files.length ? [] : [relative(cfg.base, t.dir) || "."],
  );
  const tags = [...ours(files.flatMap((f) => tagIds(read(f), [...classes, "check"])))];
  const ids = new Set(tags.filter((x) => !x.startsWith("check.")));
  const own = new Set(tags.filter((x) => x.startsWith("check.")));
  own.forEach((x) => checksTested.add(x));
  report(
    `checks in ${suiteName(t)}tests but not in the catalogue`,
    [...own].filter((x) => !checkById.has(x)).sort(),
  );
  report(
    `manual checks tagged in ${suiteName(t)}tests (mark them auto or judged)`,
    [...own].filter((x) => checkById.get(x)?.proof === "manual").sort(),
  );
  report(
    `checks in ${suiteName(t)}tests whose concepts are not all implemented`,
    [...own].filter((x) => checkById.has(x) && !fullyImplemented(checkById.get(x))).sort(),
  );
  unknown(`IDs in ${suiteName(t)}tests but not in the glossary`, `${suiteName(t)}tests`, ids);
  report(
    `IDs in ${suiteName(t)}tests but not in the implementation table`,
    diff(ids, implemented).filter((x) => glossary.has(x)),
  );
  // A suite may name checks it must implement, such as the checks it runs with a judge (D-60).
  // ont: edge.test-suite.checks, inv.suite-implements-checks
  report(`checks the ${suiteName(t)}suite names that the catalogue does not have`, t.checks.filter((x) => !checkById.has(x)));
  report(
    `manual checks the ${suiteName(t)}suite names (a manual check has no test)`,
    t.checks.filter((x) => checkById.get(x)?.proof === "manual"),
  );
  report(
    `checks the ${suiteName(t)}suite names, of implemented concepts, that none of its tests implements`,
    t.checks.filter((x) => checkById.has(x) && fullyImplemented(checkById.get(x)) && !own.has(x)),
  );
  const proven = new Set([...ids, ...[...own].flatMap((x) => checkById.get(x)?.concepts ?? [])]);
  bySuite.set(t.name, proven);
  proven.forEach((x) => tested.add(x));
  const cover = new RegExp(`^(?:${t.cover.join("|")})\\.`);
  report(
    t.name ? `implemented concepts without a test in the ${t.name} suite` : "implemented concepts without a test",
    t.cover.length ? diff(implemented, proven).filter((x) => cover.test(x)) : [],
  );
}
if (cfg.checks && cfg.testSuites.length)
  report(
    "automatic checks of implemented concepts without a test",
    checks
      .filter((c) => c.proof === "auto" && fullyImplemented(c) && !checksTested.has(c.id))
      .map((c) => c.id),
  );
// A judged check runs in a suite that names it, so that the tool knows which test runs a judge (D-60).
// ont: inv.judged-check-tested
if (cfg.checks)
  report(
    "judged checks of implemented concepts that no test suite names (the suite that runs a judge lists them under checks)",
    checks
      .filter((c) => c.proof === "judged" && fullyImplemented(c) && !cfg.testSuites.some((t) => t.checks.includes(c.id)))
      .map((c) => c.id),
  );

// Tickets: a slice of the gap between target and implementation. An `IDs:` line names the concepts
// and a `Checks:` line the checks of the slice, which must concern those concepts. A check named
// elsewhere in the ticket, such as under out of scope, must exist but is not part of the slice.
// Older tickets may still carry tagged one-line scenarios under "## Scenarios"; those are validated
// as before.
// ont: ent.ticket, edge.ticket.concepts, edge.ticket.checks, inv.ticket-has-ids, inv.ticket-checks-related
let ticketIds = new Set();
const tickets = [];
if (cfg.tickets) {
  const files = listFiles(cfg.tickets.dir, cfg.tickets.match);
  const name = (f) => relative(cfg.base, f);
  const noLine = [];
  const malformed = [];
  const outside = [];
  const unknownChecks = [];
  const unrelated = [];
  for (const f of files) {
    const text = read(f);
    const line = text.match(/^(?:Ontology )?IDs:(.*)$/m);
    if (!line) noLine.push(name(f));
    const own = new Set(line ? ids(line[1]) : []);
    const checkIds = (s) => [...new Set([...s.matchAll(/`(check\.[a-z0-9.-]+)`/g)].map((m) => m[1]))];
    const listed = checkIds(text.match(/^Checks:(.*)$/m)?.[1] ?? "");
    for (const c of checkIds(text)) if (!checkById.has(c)) unknownChecks.push(`${name(f)}: ${c}`);
    for (const c of listed)
      if (checkById.has(c) && !checkById.get(c).concepts.some((x) => own.has(x))) unrelated.push(`${name(f)}: ${c}`);
    tickets.push({ file: f, own, checks: listed });
    const bullets = /^## Scenarios$/m.test(text)
      ? section(text, "## Scenarios").split("\n").filter((l) => /^- /.test(l))
      : [];
    for (const b of bullets) {
      const tags = tagIds(b, classes);
      if (!tags.length || !/\bGIVEN\b.*\bWHEN\b.*\bTHEN\b/.test(b))
        malformed.push(`${name(f)}: ${b.slice(0, 70)}`);
      outside.push(...tags.filter((t) => !own.has(t)).map((t) => `${name(f)}: ${t}`));
      tags.forEach((t) => ticketIds.add(t));
    }
    ids(text).forEach((t) => ticketIds.add(t));
  }
  report("tickets without an `IDs:` line", noLine);
  report("ticket scenarios without an ID tag or GIVEN … WHEN … THEN", malformed);
  report("scenario tags not on the ticket's `IDs:` line", outside);
  report("checks in tickets but not in the catalogue", unknownChecks);
  report("ticket checks that name none of the ticket's IDs", unrelated);
  unknown("IDs in tickets but not in the glossary", "tickets", ticketIds);
}

// Documentation: hand-written pages carry anchors naming the concepts and checks they explain. Each
// doc set must explain every concept of its classes (the implemented ones, or all of them); a stamp
// older than the definition marks a section to reread. Reference pages are generated and compared.
// ont: ent.doc-section, field.doc-section.stamp, edge.doc-section.explains, edge.doc-section.set, derived.to-reread, inv.anchors-resolve, ent.doc-set, field.doc-set.name, field.doc-set.cover, field.doc-set.scope, field.doc-set.checks, inv.doc-set-covers, inv.doc-set-names-unique
const anchored = new Set();
const bySet = new Map();
const setDupes = cfg.docSets.map((d) => d.name).filter((n, i, a) => a.indexOf(n) !== i);
report("doc sets with the same name", [...new Set(setDupes)].map((n) => n || "(unnamed)"));
const generatedPages = new Set(cfg.references.map((r) => r.out));
for (const d of cfg.docSets) {
  const label = d.name ? `${d.name} docs` : "docs";
  const files = listFiles(d.dir, d.match).filter((f) => !generatedPages.has(f));
  report(`no ${label} pages found`, files.length ? [] : [relative(cfg.base, d.dir) || "."]);
  const ids = new Set();
  const stale = [];
  const notIds = [];
  for (const f of files) {
    for (const a of parseAnchors(read(f)))
      for (const { id, stamp } of a.refs) {
        if (!isId.test(id) && !/^check\.[a-z0-9.-]+$/.test(id)) {
          notIds.push(`${relative(cfg.base, f)}: ${id}`);
          continue;
        }
        ids.add(id);
        const now = stampOf(id, ONT, rows, checkById, notes);
        if (stamp && now && stamp !== now) stale.push(`${relative(cfg.base, f)}: ${id}`);
      }
  }
  bySet.set(d.name, ids);
  ids.forEach((x) => anchored.add(x));
  report(`anchors in ${label} that are not IDs`, notIds);
  const concepts = new Set([...ids].filter((x) => !x.startsWith("check.")));
  unknown(`IDs in ${label} anchors but not in the glossary`, label, concepts);
  report(
    `checks in ${label} anchors but not in the catalogue`,
    [...ids].filter((x) => x.startsWith("check.") && !checkById.has(x)).sort(),
  );
  const cover = new RegExp(`^(?:${d.cover.join("|")})\\.`);
  const scope = d.scope === "all" ? glossary : implemented;
  report(
    `${d.scope === "all" ? "concepts" : "implemented concepts"} the ${label} do not explain`,
    d.cover.length ? diff(scope, concepts).filter((x) => cover.test(x)) : [],
  );
  // A run guide covers checks rather than classes (D-41): every check of a listed proof, of implemented
  // concepts or of all of them, is named in an anchor of the set, so that a manual check has a way to
  // be run by the time it can be.
  report(
    `${d.checks.join(" and ")} checks the ${label} do not explain how to run`,
    checks
      .filter((c) => d.checks.includes(c.proof) && (d.scope === "all" || fullyImplemented(c)) && !ids.has(c.id))
      .map((c) => c.id),
  );
  report(
    `${label} sections anchored to a definition changed since review (reread, then run stamp-docs.mjs)`,
    stale,
    false,
  );
}
for (const ref of cfg.references) {
  const expected = renderReference(ref, {
    ONT,
    rows,
    checks,
    implemented,
    kinds: cfg.kinds,
    sourceName: relative(dirname(ref.out), cfg.ontology),
  });
  const actual = existsSync(ref.out) ? read(ref.out) : "";
  report(
    "generated reference differs from the ontology (run gen-reference.mjs)",
    actual === expected ? [] : [relative(cfg.base, ref.out)],
  );
}

// One concept per term (D-59): prose that uses a term two concepts share is ambiguous. Fields and
// relations of different entities may share one, and so may a relation named after the entity it
// refers to. Information, since what remains can still be legitimate.
// ont: inv.one-concept-per-term
{
  const entityOf = (x) => (cfg.scoped.includes(x.split(".")[0]) ? x.split(".")[1] : null);
  const typeOf = new Map(rows.map((r) => [r.id, r.type ?? ""]));
  const refersTo = (a, b) => new RegExp(`\\brefs?\\s+${b.replace(/\./g, "\\.")}\\b`).test(typeOf.get(a));
  const allowed = (a, b) =>
    (entityOf(a) && entityOf(b) && entityOf(a) !== entityOf(b)) || refersTo(a, b) || refersTo(b, a);
  const shared = [];
  for (const ids of groupBy(rows.map((r) => r.id), (x) => ONT[x].name.trim().toLowerCase()).values()) {
    const clash = ids.filter((a) => ids.some((b) => a !== b && !allowed(a, b)));
    if (clash.length) shared.push(`${ONT[clash[0]].name}: ${clash.join(", ")}`);
  }
  report("terms that name more than one concept (one concept per term is clearer)", shared, false);
}

// A concept nobody refers to is a dead glossary row.
// ont: inv.concept-referenced
report(
  "glossary concepts nobody refers to",
  diff(
    glossary,
    new Set([
      ...body,
      ...mapped,
      ...used,
      ...implemented,
      ...tested,
      ...ticketIds,
      ...checkConcepts,
      ...anchored,
    ]),
  ),
);

// Verification map: each scenario file carries an `IDs:` line with the concepts it proves.
// An implemented concept of a verifiable class without a scenario cannot be checked in the product.
let featureIds = new Set();
if (cfg.features) {
  const dir = cfg.features.dir;
  const files = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md")
    : [];
  report(
    "scenario files without an `IDs:` line",
    files.filter((f) => !/^IDs:/m.test(read(join(dir, f)))),
  );
  featureIds = new Set(
    files.flatMap((f) => {
      const line = read(join(dir, f)).match(/^IDs:(.*)$/m);
      return line ? ids(line[1]) : [];
    }),
  );
  unknown("IDs in the verification map but not in the glossary", "the verification map", featureIds);
  const cover = new RegExp(`^(?:${cfg.features.cover.join("|")})\\.`);
  report(
    "implemented concepts without a verification scenario",
    cfg.features.cover.length ? diff(implemented, featureIds).filter((x) => cover.test(x)) : [],
  );
}

// Informational: concepts nothing has tried yet. A concept arrives with feedback: a mockup element,
// a ticket or code. One that has none of them is a review item, not an error.
// ont: inv.concept-tried
report(
  "concepts with no mockup element, ticket or implementation yet",
  diff(glossary, new Set([...used, ...ticketIds, ...implemented])),
  false,
);

// Informational: what the mockup has not shown yet.
if (cfg.mockup.length && cfg.notYetShown.length) {
  const ui = new RegExp(`^(?:${cfg.notYetShown.join("|")})\\.`);
  report(
    "glossary concepts with no mockup element yet",
    diff(glossary, used).filter((x) => ui.test(x)),
    false,
  );
}
report("retired IDs still in use outside the decision log", retiredUse);

// --coverage: what proves each implemented concept: the checks that name it, one column per test
// suite, the scenarios of the older verification map, and the files that name it in code.
const flag = (name) => process.argv.indexOf(name);
if (flag("--coverage") > 0) {
  const checksOf = (x) => checks.filter((c) => c.concepts.includes(x));
  const cols = [
    ...(cfg.checks
      ? [["checks", (x) => {
          const cs = checksOf(x);
          const manual = cs.filter((c) => c.proof === "manual").length;
          return cs.length ? `${cs.length}${manual ? ` (${manual} manual)` : ""}` : "";
        }]]
      : []),
    ...cfg.testSuites.map((t) => [t.name || "tests", (x) => (bySuite.get(t.name).has(x) ? "yes" : "")]),
    ...(cfg.features ? [["scenarios", (x) => (featureIds.has(x) ? "yes" : "")]] : []),
    ["named in", (x) => (namedIn.get(x) ?? []).join(", ")],
  ];
  const head = ["concept", ...cols.map(([n]) => n)];
  const body = Object.keys(ONT)
    .filter((x) => implemented.has(x))
    .map((x) => [`\`${x}\``, ...cols.map(([, f]) => f(x))]);
  const width = head.map((h, i) => Math.max(h.length, 3, ...body.map((r) => r[i].length)));
  const line = (r) => `| ${r.map((c, i) => c.padEnd(width[i])).join(" | ")} |`;
  console.log([line(head), line(width.map((w) => "-".repeat(w))), ...body.map(line)].join("\n"));
}

// --decisions: every entry of the log, whether it is in force, tentative or superseded, and the later
// entries that name it.
if (flag("--decisions") > 0) {
  const width = (k, h) => Math.max(h.length, 3, ...decisionLog.map((e) => e[k].length));
  const w = [width("id", "Entry"), width("title", "Title"), width("state", "State"), width("namedBy", "Named by")];
  const line = (r) => `| ${r.map((c, i) => c.padEnd(w[i])).join(" | ")} |`;
  console.log(
    [
      line(["Entry", "Title", "State", "Named by"]),
      line(w.map((x) => "-".repeat(x))),
      ...[...decisionLog]
        .sort((a, b) => (Number(a.id.replace(/\D+/g, "")) || 0) - (Number(b.id.replace(/\D+/g, "")) || 0))
        .map((e) => line([e.id, e.title, e.state, e.namedBy])),
    ].join("\n"),
  );
}

// Readiness (D-58): what each target concept waits for. A ticket that takes it has it in hand. An
// accepted deferral in force that names it puts it off until its condition. The owner holds it while
// only tentative entries name it, or while an accepted entry that names it names a tentative entry.
// It waits for another target that its definition row or one of its checks names and that is not ready
// itself. The rest is ready to build, and --next proposes the next slice of it.
// ont: derived.readiness
const readiness = new Map();
const dependsOn = new Map();
{
  const targets = rows.filter((r) => !implemented.has(r.id));
  const isTarget = new Set(targets.map((r) => r.id));
  const live = decisionLog.filter((e) => !e.state.startsWith("superseded"));
  const tentative = new Set(live.filter((e) => e.state === "tentative").map((e) => e.id));
  const named = new Map(live.map((e) => [e.id, new Set(ids(e.body))]));
  const refsIn = (e) => [...e.body.matchAll(new RegExp(cfg.decisions.ref.source, "g"))].map((m) => m[0]);
  for (const r of targets) {
    const x = r.id;
    dependsOn.set(x, [
      ...new Set([
        ...ids(r.line.replace(`\`${x}\``, "")),
        ...checks.filter((c) => c.concepts.includes(x)).flatMap((c) => c.concepts),
      ]),
    ].filter((y) => y !== x && isTarget.has(y)));
    const ticket = tickets.find((t) => t.own.has(x));
    if (ticket) {
      readiness.set(x, { kind: "ticket", text: `in ticket ${relative(cfg.base, ticket.file)}` });
      continue;
    }
    const naming = live.filter((e) => named.get(e.id).has(x));
    const deferral = naming.find((e) => e.state === "in force" && cfg.decisions.returnWhen.test(e.body));
    if (deferral) {
      readiness.set(x, { kind: "deferred", text: `deferred until ${deferral.body.match(cfg.decisions.returnWhen)[1]} (${deferral.id})` });
      continue;
    }
    const accepted = naming.filter((e) => e.state === "in force");
    const pending = accepted.length
      ? [...new Set(accepted.flatMap((e) => refsIn(e).filter((d) => d !== e.id && tentative.has(d))))]
      : naming.map((e) => e.id);
    if (pending.length) readiness.set(x, { kind: "owner", text: `waits for the owner (${pending.join(", ")})` });
  }
  // Waiting spreads along the dependencies until nothing changes; a target in a ticket is not built yet either.
  for (let changed = true; changed; ) {
    changed = false;
    for (const r of targets)
      if (!readiness.has(r.id)) {
        const blocker = dependsOn.get(r.id).find((y) => readiness.has(y));
        if (blocker) {
          readiness.set(r.id, { kind: "target", text: `waits for ${blocker}` });
          changed = true;
        }
      }
  }
  for (const r of targets) if (!readiness.has(r.id)) readiness.set(r.id, { kind: "ready", text: "ready" });
}

// --gap: the work left, computed rather than listed by hand. Target concepts by section with their
// checks, automatic checks of implemented concepts that still lack a test, and the known
// divergences. --gap path/to/ticket narrows it to the ticket's slice and exits 1 until nothing of
// the slice is left: every concept implemented, every automatic check of the slice tested, no check
// the ticket lists waiting for a concept outside the slice, no divergence that names only its concepts.
// ont: derived.gap, derived.slice-done
let sliceOpen = 0;
let gapTicket = null;
if (flag("--gap") > 0) {
  const next = process.argv[flag("--gap") + 1];
  const ticket = next && !next.startsWith("--") ? tickets.find((t) => t.file === resolve(next)) : null;
  gapTicket = ticket;
  if (next && !next.startsWith("--") && !ticket) {
    console.log(`ERROR · --gap: ${next} is not a ticket the config knows`);
    errors.push("--gap");
  }
  const inScope = (x) => !ticket || ticket.own.has(x);
  const checkInScope = (c) => !ticket || ticket.checks.includes(c.id) || c.concepts.some((x) => ticket.own.has(x));
  const automatic = (c) => c.proof === "auto" || c.proof === "judged";
  const untested = (c) => automatic(c) && fullyImplemented(c) && !checksTested.has(c.id);
  // An automatic check the ticket lists cannot be tested while it needs a concept outside the slice
  // that is not built; it waits for it. Shown once the slice's own concepts of the check are built,
  // since until then they are listed as target with the check.
  const waitsFor = (c) =>
    ticket?.checks.includes(c.id) && automatic(c) && c.concepts.every((x) => !inScope(x) || implemented.has(x))
      ? c.concepts.filter((x) => !implemented.has(x))
      : [];
  // Each check is listed once, under the first ontology section its key names. A check whose key names
  // none is listed apart rather than left out, so that it still counts.
  const sections = groupBy(rows, (r) => r.heading);
  const sectionOf = new Map();
  for (const heading of sections.keys())
    for (const c of checks) if (!sectionOf.has(c.id) && c.section === sectionKey(heading)) sectionOf.set(c.id, heading);
  const checkLines = (cs) =>
    cs.flatMap((c) => {
      const missing = waitsFor(c);
      const line =
        untested(c) && checkInScope(c)
          ? `  ${c.id}  no test yet`
          : missing.length
            ? `  ${c.id}  waits for ${missing.join(", ")}`
            : null;
      if (!line) return [];
      sliceOpen += 1;
      return [line];
    });
  const out = [];
  for (const [heading, rs] of sections) {
    const lines = [];
    for (const r of rs.filter((r) => inScope(r.id))) {
      const cs = checks.filter((c) => c.concepts.includes(r.id) && checkInScope(c));
      if (!implemented.has(r.id)) {
        const status = ticket ? "" : `, ${readiness.get(r.id).text}`;
        lines.push(`  ${r.id}  target${status}${cs.length ? ` · checks: ${cs.map((c) => c.id).join(", ")}` : ""}`);
        sliceOpen += 1;
      }
    }
    lines.push(...checkLines(checks.filter((c) => sectionOf.get(c.id) === heading)));
    if (lines.length) out.push(`GAP · ${heading}`, ...lines);
  }
  const loose = checkLines(checks.filter((c) => !sectionOf.has(c.id)));
  if (loose.length) out.push("GAP · checks under no ontology section", ...loose);
  // With a ticket, a divergence that names only concepts of the slice is the slice's own work and keeps
  // it open until the line is removed. One that also names concepts outside the slice is shown apart:
  // it is closed by a slice that covers all of its concepts.
  const divergences = divergenceLines.filter((l) => !ticket || ids(l).some(inScope));
  const ownLines = divergences.filter((l) => ids(l).every(inScope));
  const sharedLines = divergences.filter((l) => !ownLines.includes(l));
  if (ticket) sliceOpen += ownLines.length;
  if (ownLines.length) out.push("GAP · known divergences", ...ownLines.map((l) => `  ${l}`));
  if (sharedLines.length)
    out.push("GAP · known divergences partly outside the slice (not counted)", ...sharedLines.map((l) => `  ${l}`));
  // A deferral that names no target concept is work put off too; without a ticket it is shown here.
  if (!ticket) {
    const put = decisionLog.filter(
      (e) => e.state === "in force" && cfg.decisions.returnWhen.test(e.body) && !ids(e.body).some((x) => readiness.has(x)),
    );
    if (put.length) out.push("GAP · deferred, with no concept yet", ...put.map((e) => `  ${e.id}: ${e.body.match(cfg.decisions.returnWhen)[1]}`));
  }
  console.log(out.length ? out.join("\n") : "GAP · nothing open");
  if (ticket) console.log(sliceOpen ? `SLICE_OPEN: ${sliceOpen}` : "SLICE_DONE");
}

// --next: the next slice to build, for a ticket: the ready targets of the first ontology section that
// has any, the ready targets they depend on, and the checks whose concepts the slice and the code
// cover. With nothing ready, what the targets wait for; with no target left, what else the gap holds,
// so that the end of the targets is not taken for the end of the work.
// ont: derived.next-slice
if (flag("--next") > 0) {
  const ready = rows.filter((r) => readiness.get(r.id)?.kind === "ready");
  if (!ready.length) {
    const waiting = groupBy(
      [...readiness.values()].map((s) => (s.kind === "target" ? "wait for other targets" : s.kind === "ticket" ? "are in tickets" : s.text.replace(/^waits/, "wait").replace(/^deferred/, "are deferred"))),
      (t) => t,
    );
    const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    const untested = checks.filter((c) => (c.proof === "auto" || c.proof === "judged") && fullyImplemented(c) && !checksTested.has(c.id)).length;
    const rest = [
      ...(divergenceLines.length ? [count(divergenceLines.length, "known divergence", "known divergences")] : []),
      ...(untested ? [count(untested, "automatic check without a test", "automatic checks without a test")] : []),
    ];
    console.log(
      readiness.size
        ? `NEXT · nothing ready: ${[...waiting].map(([t, xs]) => `${xs.length} ${t}`).join("; ")}`
        : rest.length
          ? `NEXT · no target concept left, but the gap still holds ${rest.join(" and ")} (--gap lists them)`
          : "NEXT · nothing left to build",
    );
  } else {
    const slice = new Set(ready.filter((r) => r.heading === ready[0].heading).map((r) => r.id));
    for (let grew = true; grew; ) {
      grew = false;
      for (const x of [...slice])
        for (const y of dependsOn.get(x) ?? [])
          if (!slice.has(y) && readiness.get(y)?.kind === "ready") {
            slice.add(y);
            grew = true;
          }
    }
    const ordered = rows.map((r) => r.id).filter((x) => slice.has(x));
    const sliceChecks = checks.filter((c) => c.concepts.some((x) => slice.has(x)) && c.concepts.every((x) => slice.has(x) || implemented.has(x)));
    console.log(
      [
        `NEXT · ${ready[0].heading}`,
        `IDs: ${ordered.map((x) => `\`${x}\``).join(", ")}`,
        `Checks: ${sliceChecks.map((c) => `\`${c.id}\``).join(", ") || "none yet"}`,
      ].join("\n"),
    );
  }
}

console.log(
  [
    `glossary ${glossary.size}`,
    ...(retired.size ? [`retired ${retired.size}`] : []),
    ...(cfg.mockup.length ? [`mockup ${used.size}`] : []),
    ...(cfg.map ? [`map ${mapped.size}`] : []),
    `implemented ${implemented.size}`,
    `named in code ${[...implemented].filter((x) => namedIn.has(x)).length}`,
    ...(cfg.checks ? [`checks ${checks.length}`] : []),
    ...(cfg.features ? [`scenarios ${featureIds.size}`] : []),
    ...cfg.testSuites.map((t) => `${t.name || "tested"} ${bySuite.get(t.name).size}`),
    ...(cfg.tickets ? [`tickets ${tickets.length}`] : []),
    ...cfg.docSets.map((d) => `${d.name || "docs"} ${bySet.get(d.name).size}`),
  ].join(" · "),
);
if (errors.length) {
  console.log(`DRIFT: ${errors.length}`);
  process.exit(1);
}
console.log("ONT_OK");
if (gapTicket && sliceOpen) process.exit(1);
