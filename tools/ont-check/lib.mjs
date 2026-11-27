// Shared parsing for the check and the generators. One parser for all of them: if a generator and
// the check read the ontology differently, a broken document passes unnoticed.
import { spawnSync } from "node:child_process";
import fs, { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { createHash } from "node:crypto";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const read = (path) => readFileSync(path, "utf8");
// The variables Git reads as local to one repository, which it sets for a hook and which would point a
// git command in another clone, worktree or directory at the hook's repository, its index, its objects
// or its configuration: the list `git rev-parse --local-env-vars` gives
// (https://git-scm.com/docs/git-rev-parse#Documentation/git-rev-parse.txt---local-env-vars), and the
// pairs GIT_CONFIG_KEY_<n> and GIT_CONFIG_VALUE_<n> that GIT_CONFIG_COUNT counts.
export const GIT_LOCAL_VARS = [
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_CONFIG",
  "GIT_CONFIG_PARAMETERS",
  "GIT_CONFIG_COUNT",
  "GIT_OBJECT_DIRECTORY",
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_IMPLICIT_WORK_TREE",
  "GIT_GRAFT_FILE",
  "GIT_INDEX_FILE",
  "GIT_NO_REPLACE_OBJECTS",
  "GIT_REPLACE_REF_BASE",
  "GIT_PREFIX",
  "GIT_SHALLOW_FILE",
  "GIT_COMMON_DIR",
];
let localVars = null;
const gitLocalVars = () => {
  if (!localVars) {
    // The list above first, so that the query itself runs through gitEnv, with PATH alone, as every
    // command of Git the tool runs does; Git's own list is added to it.
    localVars = new Set(GIT_LOCAL_VARS);
    const r = spawnSync("git", ["rev-parse", "--local-env-vars"], { encoding: "utf8", env: gitEnv({ PATH: process.env.PATH ?? "" }) });
    if (r.status === 0) for (const v of r.stdout.split("\n").filter(Boolean)) localVars.add(v);
  }
  return localVars;
};
const withoutLocal = (env) =>
  Object.fromEntries(Object.entries(env).filter(([k]) => !gitLocalVars().has(k) && !/^GIT_CONFIG_(KEY|VALUE)_\d+$/.test(k)));
// The environment of every command of Git the tool runs: in a repository given by its directory,
// without those variables; in the hook's own repository, given its work tree, with the hook's variables
// kept and the work tree named. Both with local replacements off, so that a commit is the content its
// SHA names, never another commit's that a refs/replace of one clone puts there (D-137).
export const gitEnv = (env = process.env, workTree = null) => ({ ...(workTree ? { ...env, GIT_WORK_TREE: workTree } : withoutLocal(env)), GIT_NO_REPLACE_OBJECTS: "1" });

// Whether a commit a record names is an object of the repository (inv.named-commits-resolve, D-145):
// git cat-file -e <commit>^{commit}, with the environment that is safe in a hook. The one test every
// record that names a commit is tested by; what a missing one does follows from the record (D-145).
// ont: inv.named-commits-resolve
export const commitResolves = (repo, commit) =>
  Boolean(repo && commit && /^[0-9a-f]{4,40}$/.test(commit)) && spawnSync("git", ["-C", repo, "cat-file", "-e", `${commit}^{commit}`], { env: gitEnv() }).status === 0;
// The problems of records whose commits do not resolve: each record with the commits it names.
export const unresolvedCommits = (repo, records, commitsOf, what = "") =>
  records.flatMap((r) =>
    commitsOf(r)
      .filter((c) => !commitResolves(repo, c))
      .map((c) => `${r.file}: ${what ? `${what} ` : ""}commit ${c} is not in the repository${repo ? "" : " (the project is not in a Git repository)"}`),
  );

// An entry is accepted when one of its lines matches this pattern. A log in another language sets
// decisions.accepted in the config.
export const DEFAULT_ACCEPTED = "^- Date:.*Status:\\s*accepted\\b";
// An entry that replaces older ones names them on a line of its own; group 1 holds the list.
export const DEFAULT_SUPERSEDES = "^- Supersedes:\\s*(.+)$";
// Where a decision was stated: a call with the time of the passage, a message, the owner's answer.
export const DEFAULT_SOURCE = "^- Source:[ \\t]*(\\S.*)$";
// A deferral names what must happen before the deferred thing is taken up again; group 1 holds it.
export const DEFAULT_RETURN_WHEN = "^- Return when:[ \\t]*(\\S.*)$";
// A process entry is about how agents work; it may extend or override rules of the approach, named in
// group 1 of its Extends or Overrides lines. An empty line matches too, so that the check reports it.
export const DEFAULT_PROCESS_LAYER = "^- Layer:[ \\t]*process\\b";
export const DEFAULT_EXTENDS = "^- Extends:[ \\t]*(.*)$";
export const DEFAULT_OVERRIDES = "^- Overrides:[ \\t]*(.*)$";

// The proofs of a check (D-154): auto and judged are automatic; review and run have no test. The
// earlier proof manual is read as before, with the checks of review, until a decision retires it.
// ont: field.check.proof, rule.tool-before-files
export const PROOFS = ["auto", "judged", "review", "run"];
export const OLD_PROOF = "manual";
export const untested = (proof) => proof === "review" || proof === "run" || proof === OLD_PROOF;
// The copy's own information (D-155): copy.json next to the tool, written by pin.mjs update, names the
// commit of the approach the copy came from; the public repository of the approach is linked at it.
// ont: field.tool-copy.copy-info
export const APPROACH_REPO = "https://github.com/epavlenko/ontology-as-spec";
export const COPY_INFO_FILE = fileURLToPath(new URL("./copy.json", import.meta.url));
export const loadCopyInfo = () => (existsSync(COPY_INFO_FILE) ? JSON.parse(readFileSync(COPY_INFO_FILE, "utf8")) : null);
// The approach's own concept IDs travel with the tool, in approach.json next to this file, so that a
// project's check resolves the rules of the approach that its agent instructions and process entries
// name. Null when the file was not copied.
export const APPROACH_FILE = fileURLToPath(new URL("./approach.json", import.meta.url));
// The checks of review and of run of the approach, with their proof (D-155); an approach.json written
// before them, whose manualChecks have no proof, reads them as manual.
// ont: concept.approach-ids
export const readApproach = (text) => {
  const { ids, retired, checks, manualChecks = [] } = JSON.parse(text);
  return {
    ids: new Set(ids),
    retired: new Map(Object.entries(retired)),
    classes: [...new Set(ids.map((x) => x.split(".")[0]))],
    checks: checks ?? manualChecks.map((c) => ({ ...c, proof: OLD_PROOF })),
  };
};
export const loadApproach = () => (existsSync(APPROACH_FILE) ? readApproach(readFileSync(APPROACH_FILE, "utf8")) : null);
// The checks of review and of run of the approach travel with it too, so that --review in a project can
// hand them to a reviewer for the kinds of artifact a change touches (D-155); each check of run carries
// the path and the anchor of its guide's section and the hash of its text (D-156), from guides.
export const renderApproach = (ONT, retired, checks = [], guides = new Map()) =>
  `${JSON.stringify(
    {
      about: "Concept IDs, retired IDs and the checks of review and of run of the Ontology as Specification approach, generated by gen-approach.mjs from its ontology, catalogue and run guide. Copy it with the tool.",
      ids: Object.keys(ONT).sort(),
      retired: Object.fromEntries([...retired].sort(([a], [b]) => a.localeCompare(b))),
      checks: checks
        .filter((c) => untested(c.proof))
        .map(({ id, heading, concepts, given, when, then, proof }) => ({
          id,
          section: heading,
          concepts,
          given,
          when,
          then,
          proof,
          ...(proof === "run" && guides.has(id) ? { guide: guides.get(id) } : {}),
        })),
    },
    null,
    2,
  )}\n`;
// The sections of a run guide: for each check its anchor names, the page, the anchor of the heading
// that follows it, as GitHub writes it, and the SHA-256 of the section's text, from that heading to the
// next anchor. Pages are read in order; the first section that names a check is its section.
export const headingAnchor = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
export const guideSections = (pages, base, parse) => {
  const out = new Map();
  for (const f of pages) {
    const text = read(f);
    const anchors = parse(text);
    anchors.forEach((a, i) => {
      const rest = text.slice(a.index + a.raw.length, anchors[i + 1]?.index);
      const heading = rest.match(/^[ \t]*\n?[ \t]*#{2,3}[ \t]+(.+?)[ \t#]*$/m)?.[1];
      const body = rest.trim();
      for (const { id } of a.refs)
        if (id.startsWith("check.") && !out.has(id))
          out.set(id, {
            path: relative(base, f).split("\\").join("/"),
            anchor: heading ? headingAnchor(heading) : "",
            hash: createHash("sha256").update(body).digest("hex").slice(0, 12),
          });
    });
  }
  return out;
};

// Every key of the configuration the loader reads, and nothing else (D-96): the loader reads the
// configuration only through guardConfig, which refuses a key not listed here, and a test checks that
// the tool's README describes each one. A list's items are written "docSets[].files"; "classes" is an
// object whose keys are the project's own.
// ont: inv.tool-options-documented
export const CONFIG_KEYS = [
  "classes", "scoped", "ontology", "root", "agentInstructions", "glossaryOut", "mockup", "notYetShown", "oracle", "adapter", "systemTests",
  "headings.implementation", "headings.retired", "headings.otherWords", "headings.divergences", "headings.history",
  "decisions.file", "decisions.entry", "decisions.ref", "decisions.accepted", "decisions.supersedes", "decisions.source",
  "decisions.returnWhen", "decisions.processLayer", "decisions.extends", "decisions.overrides",
  "code[].dir", "code[].match", "reviewPaths[].dir", "reviewPaths[].concepts",
  "manualRuns.dir", "manualRuns.require", "verdicts.dir", "verdicts.require", "records.latinOnly", "records.sealsFrom", "spend.fromLogs", "goals", "statements.todoHeadings", "reviewRounds.dir", "reviewRounds.gatesFrom", "taskRecords.dir", "mergeGate.paths", "mergeGate.rules", "mergeGate.codes", "mergeGate.taskState", "mergeGate.verdicts", "ci.workflow", "budget.newInput", "budget.output", "budget.reserve", "protocolReleases.file", "releases.dir", "releases.pin", "releases.tool", "codeNames.require", "codeNames.owner", "approachIds.out",
  "contracts.out", "contracts.classes", "contracts.propertyCase", "map.file", "map.idColumn", "features.dir", "features.cover",
  "tests.dir", "tests.match", "tests.cover", "tests.checks",
  "testSuites[].name", "testSuites[].dir", "testSuites[].match", "testSuites[].cover", "testSuites[].checks",
  "checks.file", "checks.require", "checks.axes[].name", "checks.axes[].values", "checks.axes[].each", "checks.cannotOccur",
  "tickets.dir", "tickets.match",
  "docSets[].name", "docSets[].dir", "docSets[].match", "docSets[].files", "docSets[].cover", "docSets[].checks", "docSets[].scope",
  "references[].out", "references[].title", "references[].intro", "references[].classes", "references[].implementedOnly",
  "references[].ids", "references[].kinds", "references[].types", "references[].checks",
  "external[].ontology", "external[].checks",
];
// A key and every key above it: "checks.axes[].name" lets the loader read checks, checks.axes and the
// name of each of its items.
const KEY_PATHS = new Set(
  CONFIG_KEYS.flatMap((k) => k.split(".").map((_, i, a) => a.slice(0, i + 1).join("."))).flatMap((k) => [k, k.replace(/\[\]$/, "")]),
);
const FREE_KEYS = new Set(["classes", "goals", "mergeGate.codes"]);
// The configuration as the loader may read it: an object or a list of it refuses a key that CONFIG_KEYS
// does not list, by whatever way the key is reached — a property, its descriptor, `in`, or the list of
// keys, which shows only the listed ones; values are returned as they are, objects in them guarded too.
export function guardConfig(value, path = "") {
  if (value === null || typeof value !== "object" || FREE_KEYS.has(path)) return value;
  const index = (prop) => typeof prop === "string" && /^\d+$/.test(prop);
  // The path of a key of this object or list, or null for what is not a key (a symbol, a method of a list).
  const keyOf = (target, prop) => {
    if (typeof prop === "symbol") return null;
    if (Array.isArray(target)) return index(prop) ? `${path}[]` : null;
    const key = path ? `${path}.${prop}` : prop;
    if (!KEY_PATHS.has(key)) throw new Error(`configuration key ${key} is read by the loader but not listed in CONFIG_KEYS (D-96)`);
    return key;
  };
  return new Proxy(value, {
    get(target, prop, receiver) {
      const key = keyOf(target, prop);
      return key === null ? Reflect.get(target, prop, receiver) : guardConfig(target[prop], key);
    },
    has(target, prop) {
      keyOf(target, prop);
      return Reflect.has(target, prop);
    },
    getOwnPropertyDescriptor(target, prop) {
      const key = keyOf(target, prop);
      const d = Reflect.getOwnPropertyDescriptor(target, prop);
      return d && key !== null && "value" in d ? { ...d, value: guardConfig(d.value, key) } : d;
    },
    ownKeys(target) {
      if (Array.isArray(target)) return Reflect.ownKeys(target);
      return Reflect.ownKeys(target).filter((k) => typeof k === "symbol" || KEY_PATHS.has(path ? `${path}.${k}` : k));
    },
  });
}

// Loads ont.config.json and resolves every path against the config file's directory. text, when given,
// is the configuration to use instead of the file's content, such as its staged version.
export function loadConfig(configPath, text) {
  const file = resolve(configPath);
  const base = dirname(file);
  const raw = guardConfig(JSON.parse(text ?? read(file)));
  const at = (p) => (p ? resolve(base, p) : null);
  // Headings in another language are set in the config. Known divergences are found by the start of
  // their heading line, so "### Known divergences between code and ontology" matches the default.
  // Every key is named here, not spread from the config, so that the README test sees each one (D-96);
  // a key given as null, such as an implementation heading before code exists, stays null.
  const headings = {
    implementation: raw.headings?.implementation === undefined ? "## Implementation status" : raw.headings.implementation,
    retired: raw.headings?.retired === undefined ? "## Retired IDs" : raw.headings.retired,
    otherWords: raw.headings?.otherWords === undefined ? "## Other words" : raw.headings.otherWords,
    divergences: raw.headings?.divergences === undefined ? "### Known divergences" : raw.headings.divergences,
    history: raw.headings?.history === undefined ? "## Revision history" : raw.headings.history,
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
      sourceLine: new RegExp(raw.decisions.source ?? DEFAULT_SOURCE, "im"),
      returnWhen: new RegExp(raw.decisions.returnWhen ?? DEFAULT_RETURN_WHEN, "im"),
      processLayer: new RegExp(raw.decisions.processLayer ?? DEFAULT_PROCESS_LAYER, "im"),
      extends: new RegExp(raw.decisions.extends ?? DEFAULT_EXTENDS, "im"),
      overrides: new RegExp(raw.decisions.overrides ?? DEFAULT_OVERRIDES, "im"),
    },
    // Files of the agents' instructions, such as AGENTS.md, whose IDs and entries the check resolves.
    agentInstructions: (raw.agentInstructions ?? []).map(at),
    // Directories of code whose "ont:" names the check reads, besides the files of the implementation table.
    code: (raw.code ?? []).map((c) => ({ dir: at(c.dir), match: new RegExp(c.match ?? ".") })),
    // When set, an implemented concept that the files of its row do not name fails the check (D-66).
    // Directories of data whose changed files touch the concepts named, for --review (D-80).
    reviewPaths: (raw.reviewPaths ?? []).map((p) => ({ dir: at(p.dir), concepts: p.concepts ?? [] })),
    // Verdict records, one file per verdict, and whether every check of review or run of implemented
    // concepts needs a current record (D-157); kept as cfg.manualRuns, the name of its IDs.
    // Whether records of runs and rounds hold Latin letters only: a project's rule of language, such as
    // this repository's English only (D-03, D-151), not the approach's.
    // sealsFrom: where it is set at the base of a pull request, the guard requires a seal of every record
    // of the process written after the commit that brought the key into main (D-167).
    records: { latinOnly: raw.records?.latinOnly === true, sealsFrom: raw.records?.sealsFrom === true },
    // Spend counted from the session logs, and the goals with their tasks, the units of a budget (D-169).
    spend: { fromLogs: raw.spend?.fromLogs === true },
    goals: (() => {
      const g = raw.goals ?? {};
      for (const [k, v] of Object.entries(g)) if (!Array.isArray(v) || v.some((t) => typeof t !== "string")) throw new Error(`goals.${k} is not a list of tasks (D-169)`);
      return Object.fromEntries(Object.entries(g).map(([k, v]) => [k, [...v]]));
    })(),
    // The headings of the section What to do of a task's statement, whose numbered items a record of a gate
    // change names (D-170); "What to do" by default.
    statements: { todoHeadings: [...(raw.statements?.todoHeadings ?? ["What to do"])] },
    // The key was manualRuns; it is read as verdicts, and both at once are an error (D-157).
    manualRuns: (() => {
      if (raw.manualRuns && raw.verdicts) throw new Error("the configuration sets both manualRuns and verdicts: keep verdicts, the name of manualRuns since D-157");
      const v = raw.verdicts ?? raw.manualRuns;
      return v && { dir: at(v.dir), require: v.require === true };
    })(),
    // The keys of an earlier version the configuration still uses, each with the key to write instead.
    oldKeys: raw.manualRuns ? [["manualRuns", "verdicts"]] : [],
    // Records of the rounds of review, one file per round (D-99).
    // gatesFrom: the UTC time from which a round's finding `not fixable` carries the meaning of D-152.
    reviewRounds: raw.reviewRounds && {
      dir: at(raw.reviewRounds.dir),
      gatesFrom: (() => {
        const t = raw.reviewRounds.gatesFrom ?? null;
        const real = typeof t === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(t) && new Date(t).toISOString().replace(".000Z", "Z") === t;
        if (t !== null && !real) throw new Error(`reviewRounds.gatesFrom ${JSON.stringify(t)} is not a UTC time to the second, such as 2026-11-21T09:35:15Z (D-152)`);
        return t;
      })(),
    },
    // Records of a task's done and of the executor's spend, one file each (D-107, D-108).
    taskRecords: raw.taskRecords && { dir: at(raw.taskRecords.dir) },
    // The merge gate on the server (D-158): the gate paths, which the guard holds, as paths from the root of
    // the repository, and the rule file of the ruleset of main and the permissions of Actions.
    // ont: field.merge-gate.gate-paths, field.merge-gate.rule-file, field.merge-gate.ci-workflow
    // codes: for each task whose gate a gate proof probes, the codes of the guard that refuse by its rules
    // (D-170). taskState: the guard holds the merge by the state of the task where the configuration at the
    // base of a pull request sets it (D-185); the guard reads it from the base, never from here.
    // ont: field.merge-gate.task-state
    mergeGate: raw.mergeGate && { paths: [...(raw.mergeGate.paths ?? [])], rules: at(raw.mergeGate.rules), codes: Object.fromEntries(Object.entries(raw.mergeGate.codes ?? {}).map(([k, v]) => [k, [...v]])), taskState: raw.mergeGate.taskState === true, verdicts: raw.mergeGate.verdicts === true },
    // The workflow file of the project's full check in CI (D-158); a configuration without it is reported.
    ci: raw.ci && { workflow: at(raw.ci.workflow) },
    // The approach's own releases (D-109): the file of their entries, in the approach's repository only.
    protocolReleases: raw.protocolReleases && { file: at(raw.protocolReleases.file ?? "releases.md") },
    // A product's releases and deployments, one file each, and the pin of the protocol whose hash a
    // release records (D-111).
    releases: raw.releases && { dir: at(raw.releases.dir), pin: at(raw.releases.pin) },
    // A task's default limits of new input and output tokens and their multiplier; the approach sets no
    // number, and a limit left out is null (D-108).
    budget: {
      newInput: raw.budget?.newInput ?? null,
      output: raw.budget?.output ?? null,
      // A reserve of 1 or more with at most two decimal digits, as a statement's line is (D-150); any
      // other value is refused at load, so that the cap stays exact.
      reserve: (() => {
        const r = raw.budget?.reserve ?? null;
        if (r !== null && !(typeof r === "number" && r >= 1 && /^\d+(\.\d{1,2})?$/.test(String(r))))
          throw new Error(`budget.reserve ${JSON.stringify(r)} is not a number of 1 or more with at most two digits after the point (D-150)`);
        return r;
      })(),
    },
    // When owner is set, a file of the code directories that names no defined concept fails the check (D-75).
    codeNames: { require: raw.codeNames?.require === true, owner: raw.codeNames?.owner === true },
    // Set only in the approach's own repository: where gen-approach.mjs writes the approach's IDs.
    approachIds: raw.approachIds && { out: at(raw.approachIds.out) },
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
    testSuites: [
      ...(raw.tests ? [{ name: "", dir: raw.tests.dir, match: raw.tests.match, cover: raw.tests.cover, checks: raw.tests.checks }] : []),
      ...(raw.testSuites ?? []),
    ].map(
      (t) => ({
        name: t.name ?? "",
        // "." and the empty path are the configuration's directory, as release.mjs reads them (D-146).
        dir: resolve(base, t.dir || "."),
        match: new RegExp(t.match ?? "\\.test\\.[a-z]+$"),
        cover: t.cover ?? [],
        // Checks the suite must implement, such as the checks it runs with a judge (D-60).
        checks: t.checks ?? [],
      }),
    ),
    checks: raw.checks && {
      file: at(raw.checks.file),
      require: raw.checks.require ?? ["inv", "rule"],
      // Axes the catalogue must cover (D-62): "outcome" for the outcome axis of every action, or
      // { "name", "values", "each" } for an axis of the project's own.
      axes: (raw.checks.axes ?? []).map((a) => (a === "outcome" ? OUTCOME_AXIS : { name: a.name, values: a.values, each: a.each ?? [] })),
      cannotOccur: raw.checks.cannotOccur ?? "^- Cannot occur:",
    },
    tickets: raw.tickets && {
      dir: at(raw.tickets.dir),
      match: new RegExp(raw.tickets.match ?? "\\.md$"),
    },
    // Documentation: sets of hand-written pages anchored to concepts, and generated reference pages.
    docSets: (raw.docSets ?? []).map((d) => ({
      name: d.name ?? "",
      dir: at(d.dir),
      // A set of pages named one by one, such as a README and the agent instructions, instead of every
      // page under a directory; a README named here is read like any page (D-96).
      files: d.files ? d.files.map(at) : null,
      match: new RegExp(d.match ?? "\\.md$"),
      cover: d.cover ?? [],
      // Proofs whose checks the set must name, ["run"] for a run guide (D-156); the earlier ["manual"]
      // asks for the checks of run and for those still manual, and the check says to write run.
      checks: (d.checks ?? []).flatMap((p) => (p === OLD_PROOF ? ["run", OLD_PROOF] : [p])).filter((p, i, a) => a.indexOf(p) === i),
      oldChecks: (d.checks ?? []).includes(OLD_PROOF),
      scope: d.scope ?? "implemented",
    })),
    references: (raw.references ?? []).map((r) => ({
      out: at(r.out),
      title: r.title,
      intro: r.intro,
      classes: r.classes,
      implementedOnly: r.implementedOnly,
      ids: r.ids,
      kinds: r.kinds,
      types: r.types,
      checks: r.checks,
    })),
    // Other ontologies whose IDs may appear here as examples, such as a worked example inside the
    // repository of a method: their IDs and checks are known, but they are not this ontology's.
    external: (raw.external ?? []).map((e) => ({ ontology: at(e.ontology), checks: at(e.checks) })),
    notYetShown: raw.notYetShown ?? [],
    // The oracle (D-93): formal forms in behavior blocks of the ontology, traces in the catalogue.
    oracle: Boolean(raw.oracle),
    // The code adapter and the files of tests written against a system (D-101, D-102).
    adapter: at(raw.adapter),
    systemTests: (raw.systemTests ?? []).map(at),
  };
}

// Files under dir (recursively) whose relative path matches the pattern, README.md excluded. A directory
// whose name matches is not a file to read.
export const isFile = (path) => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};
export const listFiles = (dir, match) =>
  existsSync(dir)
    ? readdirSync(dir, { recursive: true })
        .map(String)
        .filter((f) => match.test(f) && !/(^|\/)README\.md$/.test(f))
        .sort()
        .map((f) => join(dir, f))
        .filter(isFile)
    : [];

// The pages of a doc set: those it names that exist, or every page under its directory but a README.
// ont: field.doc-set.files
export const docSetFiles = (d) => (d.files ? d.files.filter(isFile) : listFiles(d.dir, d.match));

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

// Code blocks and inline code in Markdown show anchors and names as examples; they are not the page's
// own. A code block is fenced by three or more backticks or tildes, at the start of a line or of a list
// item, and closed by a fence of the same character at least as long, indented by up to three spaces
// more than the fence's list item; or else it runs to the end of that item or of the page. Or it is
// indented by four spaces or a tab more than the list item it is in, where it does not continue a
// paragraph. Block quotes are not followed: a fence inside one is read as text. markdownRuns returns the
// text in runs, [{ code, text }], which joined give the text back.
export const markdownRuns = (md) => {
  const runs = [];
  // The open fence: its run of backticks or tildes, and the column where its list item's content starts,
  // 0 outside a list.
  let fence = null;
  // Whether an indented line starts or continues a code block here: at the start, and after a blank line,
  // a heading, a fenced block or an indented block; not after a line of text.
  let indentable = true;
  // The column where the content of the list item the text is in starts, 0 outside a list. A line
  // indented less ends the item after a blank line.
  let item = 0;
  let blank = true;
  for (const line of md.split(/(?<=\n)/)) {
    const body = line.replace(/\r?\n$/, "");
    const indent = body.match(/^ */)[0].length;
    if (fence?.column && body.trim() && indent < fence.column) fence = null;
    if (!fence && body.trim() && indent < item && blank) item = 0;
    const marker = fence ? null : body.match(/^ {0,3}(?:[-+*]|\d{1,9}[.)]) {1,4}(?=\S)/);
    if (marker) item = marker[0].length;
    let code = true;
    const open = fence ? null : body.match(/^( {0,3}(?:(?:[-+*]|\d{1,9}[.)]) {1,4})?)( {0,3})(`{3,}|~{3,})(.*)$/);
    if (fence) {
      const m = body.match(/^( *)(`{3,}|~{3,})[ \t]*$/);
      if (m && m[1].length - fence.column <= 3 && m[2][0] === fence.run[0] && m[2].length >= fence.run.length) fence = null;
      indentable = true;
    } else if (open && !(open[3][0] === "`" && open[4].includes("`")))
      fence = { run: open[3], column: /[-+*.)] +$/.test(open[1]) ? open[1].length : 0 };
    else if (!body.trim()) {
      code = false;
      indentable = true;
    } else if (!(indentable && (indent >= item + 4 || (!item && /^\t/.test(body))))) {
      code = false;
      indentable = /^ {0,3}#{1,6}(?:[ \t]|$)/.test(body);
    }
    blank = !body.trim();
    if (runs.at(-1)?.code === code) runs.at(-1).text += line;
    else runs.push({ code, text: line });
  }
  return runs;
};
export const withoutExamples = (md) =>
  markdownRuns(md)
    .map((r) => (r.code ? "" : r.text.replace(/`[^`\n]*`/g, "")))
    .join("");

// Code names the concepts it implements in a comment, "// ont: rule.renewal, inv.within-limit", the
// form of a doc anchor without the HTML comment (D-57). The marker is read as text, without a parser
// per language, so any comment syntax works. Every name after it counts, whatever its class, so that
// a misspelled class fails like a misspelled name. A stamp after @ is dropped, so a doc anchor in a file
// of the implementation table names its concepts too; in Markdown, examples are not read.
// ont: derived.named-in-code, inv.code-names-resolve
const ID_REF = "[a-z][a-z0-9-]*(?:\\.[a-z0-9-]+)+(?:@[0-9a-f]+)?";
export const codeNames = (text, markdown = false) =>
  [...(markdown ? withoutExamples(text) : text).matchAll(new RegExp(`\\bont:[ \\t]*(${ID_REF}(?:[ \\t]*,[ \\t]*${ID_REF})*)`, "g"))]
    .flatMap((m) => m[1].split(","))
    .map((x) => x.trim().replace(/@.*$/, ""));

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

// The check catalogue: | `check.section.name` | `id`, `id` | GIVEN | WHEN | THEN | auto, judged, review or run |,
// under one "## Section" per entity. A check states what must hold in product terms, for any
// implementation; tests implement it and carry its ID in their title.
export const slug = (heading) => heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// The key of an ontology or catalogue section, which a check's ID names: the code span in the heading,
// so that a heading in any language can carry one (`## Préstamo \`loan\``), or else the Latin letters
// and digits of the heading. A key written in a heading is one span of lowercase letters, digits and
// hyphens; the check reports any other.
export const keySpans = (heading) => [...heading.matchAll(/`([^`]*)`/g)].map((m) => m[1]);
export const SECTION_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const sectionKey = (heading) => slug(keySpans(heading)[0] ?? heading);
// Completeness axes (D-62): the forks along which behavior diverges. Every action has the outcome axis,
// which a configuration turns on by listing "outcome"; a project may add axes of its own. A value is
// written `axis: value`, or alone for the outcome axis.
// ont: concept.completeness-axis
export const OUTCOME_AXIS = { name: "outcome", values: ["success", "refusal", "empty", "error", "silence"], each: ["action"] };
export const axisValue = (v) => {
  const m = v.match(/^([^:]+):\s*(.+)$/);
  return m ? [m[1].trim(), m[2].trim()] : ["outcome", v.trim()];
};
// A line of the catalogue that rules values out, `- Cannot occur: `action.renew` silence — why`: the
// concepts it names, the values, and the reason after the dash. Without concepts it rules a value out
// for the whole catalogue.
export const parseCannotOccur = (md, prefix) =>
  [...md.matchAll(new RegExp(`${prefix}[ \\t]*(.*)$`, "gm"))].map((m) => {
    const dash = m[1].match(/\s+[—-]\s+/);
    const [head, reason] = dash ? [m[1].slice(0, dash.index), m[1].slice(dash.index + dash[0].length)] : [m[1], ""];
    const ids = [...head.matchAll(/`([^`]+)`/g)].map((x) => x[1]);
    const values = head.replace(/`[^`]+`,?/g, "").split(",").map((v) => v.trim()).filter(Boolean);
    return { ids, values, reason: reason.trim(), line: m[0] };
  });

export function parseChecks(md) {
  const checks = [];
  let heading = "";
  for (const line of md.split("\n")) {
    if (/^## /.test(line)) heading = line.slice(3).trim();
    if (!/^\|.*\|\s*$/.test(line)) continue;
    const cells = line.trim().slice(1, -1).split("|").map((c) => c.trim());
    const m = cells[0].match(/^`(check\.[a-z0-9-]+(?:\.[a-z0-9-]+)*)`$/);
    if (!m) continue;
    const [, concepts = "", given = "", when = "", then = "", proof = "", covers = ""] = cells;
    checks.push({
      id: m[1],
      heading,
      section: sectionKey(heading),
      concepts: [...concepts.matchAll(/`([^`]+)`/g)].map((x) => x[1]),
      given,
      when,
      then,
      proof,
      // An optional seventh cell names the axis values the check covers (D-62).
      covers: covers.split(",").map((v) => v.trim()).filter(Boolean),
      cells: cells.length,
    });
  }
  return checks;
}

// Implementation status: | `id` | `path`, `path` | note | under the implementation heading. Concepts
// realised in the same files may share a row: | `id`, `id` | `path` | |. Returns [id, files] pairs, one
// per concept; an empty list when the heading is unset or absent.
export function parseImplemented(md, heading) {
  if (!heading || !md.includes(heading)) return [];
  return [
    ...section(md, heading).matchAll(/^\|\s*(`[a-z][a-z0-9.-]+`(?:\s*,\s*`[a-z][a-z0-9.-]+`)*)\s*\|([^|]*)\|/gm),
  ].flatMap((r) => {
    const files = [...r[2].matchAll(/`([^`]+)`/g)].map((x) => x[1]);
    return [...r[1].matchAll(/`([^`]+)`/g)].map((x) => [x[1], files]);
  });
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

// Other words (D-91): words people may use for a concept that are not its term, one row each under the
// configured heading, | word | `id` |. No section, or an empty one, lists none.
export function parseOtherWords(md, heading) {
  if (!heading || !md.includes(heading)) return [];
  return [...section(md, heading).matchAll(/^\|[ \t]*([^|`\n]*?)[ \t]*\|[ \t]*`([a-z][a-z0-9.-]+)`[ \t]*\|/gm)]
    .filter((m) => m[1] && !/^:?-+:?$/.test(m[1]))
    .map((m) => ({ word: m[1], id: m[2] }));
}

// The text a reader of a page sees, with everything else blanked so that line numbers stay: in
// Markdown without code blocks, code spans, HTML comments, block quotes and quoted phrases; in HTML the
// text between tags, attributes left out, character references decoded, and in a script only the text
// between the tags of the markup it writes, since a mockup often builds its screens there, without the
// expressions it puts in. A word in a quote is cited, not used. A phrase may run over a line break, but
// not over a blank line.
const blankOut = (s) => s.replace(/[^\n]/g, " ");
const PARA = String.raw`(?:[^\n]|\n(?![ \t]*\n))`;
const QUOTED = new RegExp(String.raw`"(?:(?!")${PARA})*"|“(?:(?!”)${PARA})*”|«(?:(?!»)${PARA})*»`, "g");
const CODE_SPAN = new RegExp(String.raw`(\`+)(?!\`)(?:(?!\1)${PARA})*?(?<!\`)\1(?!\`)`, "g");
export const proseText = (md) =>
  markdownRuns(md)
    .map((r) => (r.code ? blankOut(r.text) : r.text))
    .join("")
    .replace(/<!--[\s\S]*?-->/g, blankOut)
    .replace(CODE_SPAN, blankOut)
    .replace(/^ {0,3}>.*$/gm, blankOut)
    .replace(QUOTED, blankOut);
const TAG = /<\/?[A-Za-z][^\s/>]*(?:[^>"']|"[^"]*"|'[^']*')*>/g;
// Character references, numeric and named, as the HTML standard reads them in text: a numeric one with
// or without its semicolon, a named one with it, and the legacy names the standard also reads without
// it, longest first. The names are copied from https://html.spec.whatwg.org/entities.json into
// html-entities.json; a name it does not have, or a number that is no character, is left as written.
// A reference never adds a line, so line numbers stay.
let ENTITIES = null;
const entities = () => {
  if (ENTITIES) return ENTITIES;
  const { names, legacy } = JSON.parse(readFileSync(fileURLToPath(new URL("./html-entities.json", import.meta.url)), "utf8"));
  const bare = Object.keys(legacy).sort((x, y) => y.length - x.length);
  ENTITIES = { names, legacy, pattern: new RegExp(String.raw`&(?:#(\d+);?|#[xX]([0-9a-fA-F]+);?|([A-Za-z][A-Za-z0-9]*);|(${bare.join("|")}))`, "g") };
  return ENTITIES;
};
const decode = (s) => {
  if (!s.includes("&")) return s;
  const { names, legacy, pattern } = entities();
  return s.replace(pattern, (m, d, h, n, old) => {
    let text;
    if (n) {
      text = names[n];
      // A name the standard does not have may start with a legacy one, read without its semicolon.
      const old = text === undefined && Object.keys(legacy).filter((x) => n.startsWith(x)).sort((x, y) => y.length - x.length)[0];
      if (old) text = legacy[old] + n.slice(old.length) + ";";
    }
    else if (old) text = legacy[old];
    else {
      const cp = parseInt(d ?? h, d ? 10 : 16);
      text = cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) ? undefined : String.fromCodePoint(cp);
    }
    return text === undefined ? m : text.replace(/[\r\n\t\f\v\u2028\u2029]/g, " ");
  });
};

// Text between tags. In a script it is the text between two tags of the markup one string or template
// holds, the code around them blanked first.
const between = (html, script) => {
  let out = "";
  let last = 0;
  let open = !script;
  for (const m of html.matchAll(TAG)) {
    const gap = html.slice(last, m.index);
    out += open && !(script && gap.includes(EDGE)) ? gap : blankOut(gap);
    out += blankOut(m[0]);
    last = m.index + m[0].length;
    open = true;
  }
  out += script ? blankOut(html.slice(last)) : html.slice(last);
  return out;
};

// A script read once, as JavaScript reads it: the text of its strings and templates is kept, and its
// code, comments and regular expressions are blanked, newlines kept. In the expressions a template puts
// in, ${…}, a string is a value, such as a key or a label to choose, and is blanked too; a template
// there is markup again and is kept.
// A slash starts a regular expression where an expression may start: after an operator or punctuation,
// a keyword such as return, or at the start; after a name, a number or a closing bracket it divides.
// The edge of a string or a template, so that text between tags counts only inside one of them: a
// string between two templates is not their text.
const EDGE = "\u0000";
const REGEX_AFTER = /(?:^|[(,=:[!&|?{};+\-*%<>~^]|\b(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await))\s*$/;
export const scriptText = (js) => {
  let out = "";
  let code = ""; // the code read so far on this level, to tell a regular expression from a division
  let inExpression = 0;
  let inTemplate = 0; // templates around the current point: only a top-level literal has edges
  let i = 0;
  const blank = (to) => {
    out += blankOut(js.slice(i, to));
    i = to;
  };
  const string = (q) => {
    const edge = inTemplate ? " " : EDGE;
    out += edge;
    i++;
    while (i < js.length && js[i] !== q && js[i] !== "\n") {
      if (js[i] === "\\") { out += blankOut(js.slice(i, i + 2)); i += 2; continue; }
      out += inExpression ? " " : js[i];
      i++;
    }
    if (i < js.length && js[i] === q) { out += edge; i++; }
  };
  const template = () => {
    const outer = inExpression;
    inExpression = 0;
    const edge = inTemplate ? " " : EDGE;
    inTemplate++;
    out += edge;
    i++;
    while (i < js.length && js[i] !== "`") {
      if (js[i] === "\\") { out += blankOut(js.slice(i, i + 2)); i += 2; continue; }
      if (js[i] === "$" && js[i + 1] === "{") {
        out += "  ";
        i += 2;
        inExpression++;
        const outer = inExpression;
        level("}");
        inExpression = outer - 1;
        if (js[i] === "}") { out += " "; i++; }
        continue;
      }
      out += js[i++];
    }
    if (js[i] === "`") { out += edge; i++; }
    inTemplate--;
    inExpression = outer;
  };
  const level = (close) => {
    const saved = code;
    code = "";
    let depth = 0;
    const parens = []; // for each open parenthesis, whether it holds the condition of if, while, for or with
    while (i < js.length) {
      const c = js[i];
      if (close && c === "}" && depth === 0) break;
      if (c === "/" && js[i + 1] === "/") { const e = js.indexOf("\n", i); blank(e < 0 ? js.length : e); continue; }
      if (c === "/" && js[i + 1] === "*") { const e = js.indexOf("*/", i + 2); blank(e < 0 ? js.length : e + 2); continue; }
      if (c === "'" || c === '"') { string(c); code += "0"; continue; }
      if (c === "`") { template(); code += "0"; continue; }
      if (c === "/" && REGEX_AFTER.test(code) && !/(?:\+\+|--)\s*$/.test(code)) {
        let j = i + 1;
        let cls = false;
        for (; j < js.length && js[j] !== "\n"; j++) {
          if (js[j] === "\\") j++;
          else if (js[j] === "[") cls = true;
          else if (js[j] === "]") cls = false;
          else if (js[j] === "/" && !cls) break;
        }
        j++;
        while (j < js.length && /[a-z]/i.test(js[j])) j++;
        blank(j);
        code += "0";
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      if (c === "(") parens.push(/(?<![\w$.])(?:if|while|for|with)\s*$/.test(code));
      // After the condition of if, while, for or with a statement starts, so a slash there starts a
      // regular expression, as after a semicolon.
      if (c === ")") code += parens.pop() ? ";" : ")";
      else if (!/\s/.test(c)) code += c;
      else if (!code.endsWith(" ")) code += " ";
      out += c === "\n" ? "\n" : " ";
      i++;
    }
    code = saved;
  };
  level(null);
  return out;
};
export const visibleText = (html) =>
  html
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, blankOut)
    .replace(/<!--[\s\S]*?-->/g, blankOut)
    .split(/(<script\b[^>]*>[\s\S]*?<\/script\s*>)/i)
    .map((part, i) =>
      i % 2
        ? (() => {
            const m = part.match(/^(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)$/i);
            return blankOut(m[1]) + between(scriptText(m[2]), true).replaceAll(EDGE, " ") + blankOut(m[3]);
          })()
        : between(part, false),
    )
    .join("")
    .split("\n")
    .map((l) => decode(l))
    .join("\n")
    .replace(QUOTED, blankOut);
// A word or phrase as a whole word, in any case: "queue entry" is not found in "queue entryway". The
// spaces of a phrase match white space with at most one line break, so a phrase does not run over a
// blank line.
const PHRASE_SPACE = String.raw`(?=\s)[^\S\n]*(?:\r?\n[^\S\n]*)?`;
export const wordPattern = (word) =>
  new RegExp(
    String.raw`(?<![\p{L}\p{N}_-])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, PHRASE_SPACE)}(?![\p{L}\p{N}_-])`,
    "giu",
  );

export const renderGlossary = (ONT, sourceName) =>
  `// Generated by tools/ont-check/gen-glossary.mjs from ${sourceName}. Do not edit by hand.
window.ONT = ${JSON.stringify(ONT, null, 1)};
`;

// ── The boundary of the reads of the checker the guard runs (derived.change-list, D-188, D-190) ─────────
// Given --confine <root> to ont-check.mjs, which imports this module first: every read of a file in the run,
// of any reader of the checker and whatever named the path, the configuration, a listing of a directory, a
// row of the implementation table, a ticket or a link, goes through one function, readBoundary, which takes
// the real path and ends the run on one outside the checked tree, naming it, before anything is read. The
// checker's own files beside this module, the approach's IDs, the copy information, the pin and the table
// of HTML entities, are the only others it reads. A read is refused by ending the process, so that no
// reader that catches an error goes on without the file.
// ont: derived.change-list
const TOOL_HERE = dirname(fileURLToPath(import.meta.url));
// The files of the checker itself it reads by their own constants, never by a path of the tree.
export const OWN_FILES = ["approach.json", "copy.json", "upstream.json", "html-entities.json"].map((f) => join(TOOL_HERE, f));
// The code exit of a run that tried to read outside its tree, and the line that names the path.
export const OUTSIDE_EXIT = 3;
export const OUTSIDE_LINE = "READ_OUTSIDE";

// The functions of node:fs as they were before the boundary, which it calls itself.
const orig = { realpathSync: fs.realpathSync, lstatSync: fs.lstatSync, readlinkSync: fs.readlinkSync, writeSync: fs.writeSync };

// The real path of p: its links resolved, a link that resolves to nothing by its target, and a path that does
// not exist by the real path of the nearest part of it that does, with the rest joined.
export function realPath(p, depth = 0) {
  const abs = resolve(p);
  try {
    return orig.realpathSync(abs);
  } catch {}
  try {
    if (depth < 40 && orig.lstatSync(abs).isSymbolicLink()) return realPath(resolve(dirname(abs), orig.readlinkSync(abs)), depth + 1);
  } catch {}
  const parent = dirname(abs);
  return parent === abs ? abs : join(realPath(parent, depth), basename(abs));
}

// The test of the boundary: for a root, a function that gives the real path of a path outside it, or null for
// one inside it.
export function outsideOf(root) {
  const base = realPath(root);
  return (p) => {
    const real = realPath(p);
    const rel = relative(base, real);
    return rel === ".." || rel.startsWith(`..${sep}`) || rel.startsWith(sep) || /^[A-Za-z]:/.test(rel) ? real : null;
  };
}

// The path a function of node:fs was given: a string, a Buffer or a file URL; a descriptor is null, since it
// was opened through the boundary.
const pathOf = (p) => (typeof p === "string" ? p : Buffer.isBuffer(p) ? p.toString() : p instanceof URL ? fileURLToPath(p) : null);

// The one function every read goes through once the boundary is set.
let boundary = null;
export function readBoundary(p) {
  if (!boundary) return;
  const path = pathOf(p);
  if (path === null) return;
  const real = boundary.outside(path);
  if (!real || boundary.own.has(real)) return;
  orig.writeSync(2, `${OUTSIDE_LINE} ${real}${real !== resolve(path) ? ` (named as ${path})` : ""}: the checker reads only the files of its tree, ${boundary.root}\n`);
  process.exit(OUTSIDE_EXIT);
}

// The functions of node:fs that read a file, list a directory or tell of a path, sync, with a callback and
// with a promise, whose first argument is the path; for a copy, the source too.
const READERS = ["access", "accessSync", "exists", "existsSync", "lstat", "lstatSync", "open", "openSync", "opendir", "opendirSync", "readdir", "readdirSync", "readFile", "readFileSync", "readlink", "readlinkSync", "realpath", "realpathSync", "stat", "statSync", "statfs", "statfsSync", "createReadStream", "watch", "watchFile", "cp", "cpSync", "copyFile", "copyFileSync", "glob", "globSync"];
const PROMISE_READERS = ["access", "lstat", "open", "opendir", "readdir", "readFile", "readlink", "realpath", "stat", "statfs", "cp", "copyFile", "glob"];

// Sets the boundary at root for the rest of the run.
export function confineReads(root) {
  boundary = { root: realPath(root), outside: outsideOf(root), own: new Set(OWN_FILES.map((f) => realPath(f))) };
  const wrap = (f) => {
    const g = function (p, ...rest) {
      readBoundary(p);
      return f.call(this, p, ...rest);
    };
    for (const k of Object.keys(f)) g[k] = typeof f[k] === "function" ? wrap(f[k]) : f[k];
    return g;
  };
  for (const k of READERS) if (typeof fs[k] === "function") fs[k] = wrap(fs[k]);
  for (const k of PROMISE_READERS) if (typeof fs.promises[k] === "function") fs.promises[k] = wrap(fs.promises[k]);
  syncBuiltinESMExports();
}

// Given --confine <root> to ont-check.mjs, the boundary is set as this module is evaluated: ont-check.mjs
// imports it first, so before any other module of the checker is.
const confineAt = process.argv.indexOf("--confine");
if (confineAt > 0 && basename(process.argv[1] ?? "") === "ont-check.mjs") {
  const root = process.argv[confineAt + 1];
  if (!root || root.startsWith("--") || !fs.existsSync(root)) {
    orig.writeSync(2, "--confine needs the root of the checked tree, a directory\n");
    process.exit(2);
  }
  confineReads(root);
}
