// Drift check between the ontology, its glossary, the generated tooltips, the mockup, the
// UI-to-ontology map, the decision log, the implementation table, the verification map, the tests
// and the tickets.
// Usage: node tools/ont-check/ont-check.mjs [--config path/to/ont.config.json]
// Exit code 1 on any error. Prints ONT_OK when everything is consistent.
import { existsSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  backtickIds,
  idPattern,
  listFiles,
  loadConfig,
  parseGlossary,
  read,
  renderGlossary,
  section,
  tagIds,
} from "./lib.mjs";

const arg = process.argv.indexOf("--config");
const cfg = loadConfig(arg > 0 ? process.argv[arg + 1] : "ont.config.json");
const { classes } = cfg;
const ids = (text) => backtickIds(text, classes);
const diff = (a, b) => [...a].filter((x) => !b.has(x)).sort();
const errors = [];
const report = (label, items, fatal = true) => {
  if (!items.length) return;
  console.log(`${fatal ? "ERROR" : "info"} · ${label} (${items.length}):\n  ${items.join("\n  ")}`);
  if (fatal) errors.push(label);
};

const md = read(cfg.ontology);
const glossarySection = section(md, cfg.headings.glossary);
const ONT = parseGlossary(md, cfg.headings.glossary);
const glossary = new Set(Object.keys(ONT));
const body = new Set(ids(md.replace(glossarySection, "")));

// The glossary is the only source of IDs: everything that refers to a concept must find it there.
const isId = idPattern(classes);
report(
  "glossary IDs of a class not listed in the config",
  [...glossary].filter((x) => !isId.test(x)),
);
report("IDs in the ontology text but not in the glossary", diff(body, glossary));

// Implementation status: | `id` | `path`, `path` | note |. Files must exist; completeness is a human call.
// Set "implementation": null under headings until there is code.
const implSection = cfg.headings.implementation ? section(md, cfg.headings.implementation) : "";
const implRows = [...implSection.matchAll(/^\|\s*`([a-z][a-z0-9.-]+)`\s*\|([^|]*)\|/gm)];
const implemented = new Set(implRows.map((r) => r[1]));
const implFiles = [
  ...new Set(implRows.flatMap((r) => [...r[2].matchAll(/`([^`]+)`/g)].map((x) => x[1]))),
];
report("IDs in the implementation table but not in the glossary", diff(implemented, glossary));
report(
  "files from the implementation table not found",
  implFiles.filter((f) => !existsSync(resolve(cfg.root, f))),
);

// Generated tooltips are compared whole: catches both a forgotten regeneration and a hand edit.
if (cfg.glossaryOut) {
  const expected = renderGlossary(ONT, relative(cfg.base, cfg.ontology));
  const actual = existsSync(cfg.glossaryOut) ? read(cfg.glossaryOut) : "";
  report(
    "generated glossary differs from the ontology (run gen-glossary.mjs)",
    actual === expected ? [] : [relative(cfg.base, cfg.glossaryOut)],
  );
}

// Mockup: data-ont attributes plus quoted IDs in scripts ('view.catalog').
const classAlt = classes.join("|");
const html = cfg.mockup.map(read).join("\n");
const used = new Set([
  ...[...html.matchAll(/data-ont="([a-z][a-z0-9.-]+)"/g)].map((m) => m[1]),
  ...[...html.matchAll(new RegExp(`'((?:${classAlt})\\.[a-z0-9.-]+)'`, "g"))].map((m) => m[1]),
]);
if (cfg.mockup.length) {
  report("data-ont in the mockup but not in the glossary", diff(used, glossary));
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
  report("IDs in the map but not in the glossary", diff(mapped, glossary));
  report("IDs in the map but not in the mockup", diff(mapped, used));
  report("data-ont in the mockup but not in the map", diff(used, mapped));
}

// Decision log: IDs exist, references point at real entries, entries are not duplicated.
if (cfg.decisions) {
  const dec = read(cfg.decisions.file);
  report("IDs in the decision log but not in the glossary", diff(new Set(ids(dec)), glossary));
  const entries = [...dec.matchAll(cfg.decisions.entry)].map((m) => m[1]);
  const refSources = [md, cfg.map ? read(cfg.map.file) : ""].join("\n");
  const refs = new Set([...refSources.matchAll(cfg.decisions.ref)].map((m) => m[0]));
  report("decision references without an entry in the log", diff(refs, new Set(entries)));
  report(
    "duplicate entries in the decision log",
    entries.filter((x, i) => entries.indexOf(x) !== i),
  );
}

// Tests name the concepts they prove in a tag: test("[inv.one-loan-per-item] an item …").
// A test may only prove what the implementation table claims, and every implemented concept of a
// covered class needs a test: the table and the test suite have to agree.
let tested = new Set();
if (cfg.tests) {
  const files = listFiles(cfg.tests.dir, cfg.tests.match);
  report("no test files found", files.length ? [] : [relative(cfg.base, cfg.tests.dir)]);
  tested = new Set(files.flatMap((f) => tagIds(read(f), classes)));
  report("IDs in tests but not in the glossary", diff(tested, glossary));
  report(
    "IDs in tests but not in the implementation table",
    diff(tested, implemented).filter((x) => glossary.has(x)),
  );
  const cover = new RegExp(`^(?:${cfg.tests.cover.join("|")})\\.`);
  report(
    "implemented concepts without a test",
    cfg.tests.cover.length ? diff(implemented, tested).filter((x) => cover.test(x)) : [],
  );
}

// Tickets: an `IDs:` line, and expected behavior as tagged one-line scenarios under "## Scenarios":
// - [hook.hold-ready] GIVEN … WHEN … THEN …
// The tag is the one the test will carry once the scenario is implemented.
let ticketIds = new Set();
if (cfg.tickets) {
  const files = listFiles(cfg.tickets.dir, cfg.tickets.match);
  const name = (f) => relative(cfg.base, f);
  const noLine = [];
  const noScenarios = [];
  const malformed = [];
  const outside = [];
  for (const f of files) {
    const text = read(f);
    const line = text.match(/^(?:Ontology )?IDs:(.*)$/m);
    if (!line) noLine.push(name(f));
    const own = new Set(line ? ids(line[1]) : []);
    const bullets = /^## Scenarios$/m.test(text)
      ? section(text, "## Scenarios").split("\n").filter((l) => /^- /.test(l))
      : [];
    if (!bullets.length) noScenarios.push(name(f));
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
  report("tickets without scenarios", noScenarios);
  report("ticket scenarios without an ID tag or GIVEN … WHEN … THEN", malformed);
  report("scenario tags not on the ticket's `IDs:` line", outside);
  report("IDs in tickets but not in the glossary", diff(ticketIds, glossary));
}

// A concept nobody refers to is a dead glossary row.
report(
  "glossary concepts nobody refers to",
  diff(glossary, new Set([...body, ...mapped, ...used, ...implemented, ...tested, ...ticketIds])),
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
  report("IDs in the verification map but not in the glossary", diff(featureIds, glossary));
  const cover = new RegExp(`^(?:${cfg.features.cover.join("|")})\\.`);
  report(
    "implemented concepts without a verification scenario",
    cfg.features.cover.length ? diff(implemented, featureIds).filter((x) => cover.test(x)) : [],
  );
}

// Informational: what the mockup has not shown yet, what the prose has not explained yet.
if (cfg.mockup.length && cfg.notYetShown.length) {
  const ui = new RegExp(`^(?:${cfg.notYetShown.join("|")})\\.`);
  report(
    "glossary concepts with no mockup element yet",
    diff(glossary, used).filter((x) => ui.test(x)),
    false,
  );
}
report(
  "glossary concepts not mentioned in the ontology text",
  diff(glossary, body).filter((x) => !/^(?:view|action)\./.test(x)),
  false,
);

console.log(
  [
    `glossary ${glossary.size}`,
    `mockup ${used.size}`,
    `map ${mapped.size}`,
    `implemented ${implemented.size}`,
    `scenarios ${featureIds.size}`,
    ...(cfg.tests ? [`tested ${tested.size}`] : []),
    ...(cfg.tickets ? [`tickets ${listFiles(cfg.tickets.dir, cfg.tickets.match).length}`] : []),
  ].join(" · "),
);
if (errors.length) {
  console.log(`DRIFT: ${errors.length}`);
  process.exit(1);
}
console.log("ONT_OK");
