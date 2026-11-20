// Records of manual runs (D-78): one file per run of a manual check, in the directory the configuration
// names under manualRuns. A record says which check ran, when, on which commit, with which stamp and
// verdict, by whom, and where the evidence is; the evidence itself stays outside the repository
// (rule.manual-evidence-kept).
// ont: ent.manual-run, rule.records-english-in-repo, edge.manual-run.check, field.manual-run.time, field.manual-run.commit, field.manual-run.stamp, field.manual-run.verdict, field.manual-run.by, field.manual-run.evidence, derived.current-run
import { createHash } from "node:crypto";
import { basename } from "node:path";
import { listFiles, read } from "./lib.mjs";
import { stampOf } from "./docs.mjs";

export const VERDICTS = ["pass", "fail", "not-run", "not-applicable"];
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
// A time is real when it reads back as itself: 2026-99-99T99:99:99Z has the shape and is no time.
const realTime = (t) => TIME.test(t ?? "") && !Number.isNaN(Date.parse(t)) && new Date(t).toISOString().replace(".000Z", "Z") === t;
const NAME = /^(\d{8}T\d{6}Z)-(check\.[a-z0-9.-]+)-[a-z0-9]{4}\.md$/;
const compact = (t) => (t ?? "").replace(/[-:]/g, "");

// The stamp of a run covers the check's case and the stamps of its concepts, so that a change to either
// makes the run no longer current, as a changed definition makes a doc section stale (D-23).
export const runStamp = (c, ONT, rows, checkById, notes) =>
  createHash("sha256")
    .update([stampOf(c.id, ONT, rows, checkById, notes) ?? `${c.given}|${c.when}|${c.then}`, ...c.concepts.map((x) => stampOf(x, ONT, rows, checkById, notes) ?? x)].join("|"))
    .digest("hex")
    .slice(0, 8);

// What a record may hold, since it sits in the repository (rule.records-english-in-repo, D-151): no path
// outside the repository, absolute or leaving it by "..", in every project; and, where the configuration
// sets records.latinOnly, as this repository does for its rule of English only (D-03), no letter of a
// script other than Latin. A URL is allowed. Each problem names its line, from 1.
// ont: rule.records-english-in-repo
const URL_RE = /\b[a-z][a-z0-9+.-]*:\/\/[^\s<>()`"'|]+/gi;
const NOT_LATIN = /[^\P{L}\p{Script=Latin}]/u;
// An end tag such as </svg> is no path; a link in angle brackets, (</x>), is.
const ABSOLUTE = /(?:^|[\s(\[`"'=,;|]|\(<)(\/[^\s/)>\]`"',;|]|~\/|[A-Za-z]:\\)/;
const leaves = (token) => {
  let depth = 0;
  for (const part of token.split(/[\\/]/)) {
    if (part === "..") depth--;
    else if (part && part !== ".") depth++;
    if (depth < 0) return true;
  }
  return false;
};
export function outsideRecord(text, from = 1, { latinOnly = false } = {}) {
  const problems = [];
  text.split("\n").forEach((line, i) => {
    const plain = line.replace(URL_RE, " ");
    const at = `line ${i + from}`;
    const letter = latinOnly && plain.match(NOT_LATIN);
    if (letter) problems.push(`${at}: the letter ${letter[0]} is not English text`);
    const abs = plain.match(ABSOLUTE);
    if (abs) problems.push(`${at}: ${plain.slice(abs.index).trim().split(/[\s)>\]`"',;|]/)[0]} is a path outside the repository`);
    const up = plain.split(/[\s()<>\[\]`"',;|]+/).find((t) => /[\\/]/.test(t) && /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(t) && leaves(t.replace(/:\d+(?:-\d+)?$/, "")));
    if (up) problems.push(`${at}: ${up} leaves the repository`);
  });
  return problems;
}

// Every record of the directory, with what is wrong with it.
export function parseRuns(dir, known, opts = {}) {
  const runs = [];
  const malformed = [];
  for (const f of listFiles(dir, /\.md$/)) {
    const text = read(f);
    const pairs = text
      .split("\n")
      .map((l) => l.match(/^(Check|Time|Commit|Stamp|Verdict|By|Evidence):\s*(.*?)\s*$/))
      .filter(Boolean)
      .map((m) => [m[1].toLowerCase(), m[2].replace(/^`|`$/g, "")]);
    const fields = Object.fromEntries(pairs);
    const repeated = [...new Set(pairs.map(([k]) => k).filter((k, i, a) => a.indexOf(k) !== i))];
    const name = basename(f);
    const named = name.match(NAME);
    const wrong = [
      repeated.length && `${repeated.join(", ")} given more than once`,
      !known.has(fields.check) && `unknown check ${fields.check ?? "(none)"}`,
      !VERDICTS.includes(fields.verdict) && `verdict ${fields.verdict ?? "(none)"} is not one of ${VERDICTS.join(", ")}`,
      !realTime(fields.time) && `time ${fields.time ?? "(none)"} is not a UTC time to the second, such as 2026-11-05T14:30:00Z`,
      !fields.commit && "no commit",
      !fields.stamp && "no stamp",
      !fields.by && "no author",
      !named && "the name is not <UTC time>-<check>-<4 characters>.md, such as 20261105T143000Z-check.loan.overdue-in-real-time-k3f9.md",
      named && (named[2] !== fields.check || named[1] !== compact(fields.time)) && "the name does not match the record's check and time",
      ...outsideRecord(text, 1, opts),
    ].filter(Boolean);
    if (wrong.length) malformed.push(`${name}: ${wrong.join("; ")}`);
    else runs.push({ file: name, ...fields });
  }
  const seen = new Map();
  const ambiguous = [];
  for (const r of runs) {
    const key = `${r.check}|${r.time}|${r.by}`;
    if (seen.has(key)) ambiguous.push(`${seen.get(key)} and ${r.file}: ${r.check} at ${r.time} by ${r.by}`);
    else seen.set(key, r.file);
  }
  return { runs, malformed, ambiguous };
}

// The current run of a check: its latest run, by time and then by file name, whose verdict is pass or
// fail and whose stamp is the check's stamp now. not-run and not-applicable are not runs.
export const currentRun = (runs, id, stamp) =>
  runs
    .filter((r) => r.check === id && r.stamp === stamp && (r.verdict === "pass" || r.verdict === "fail"))
    .sort((a, b) => a.time.localeCompare(b.time) || a.file.localeCompare(b.file))
    .at(-1);

// The records of a review, from the reviewer's table of verdicts (D-100). A row reads
// | check.id | verdict | evidence |, where the verdict is one of VERDICTS or `carried`, and a carried
// verdict gives the file of the record it carries and, after " · ", the files the reviewer read for it,
// none of which may have changed since the record's commit (D-95); a `By:` line names the reviewer. A record is written for each new verdict and none for a carried one. The table is refused
// whole when a check is not listed, is given twice, a listed check has neither, a carried record is
// not of its check or not at its stamp now, or the check of errors in code is carried.
// ont: action.record-verdicts
const CODE_CHECK = "check.agent-rules.code-reviewed-for-errors";
export function recordVerdicts({ text, listed, runs, stamp, commit, now, changedSince = () => [], source = "the table", latinOnly = false }) {
  const by = text.match(/^By:\s*(.+?)\s*$/m)?.[1];
  const lines = text.split("\n");
  const rows = lines
    .map((l) => l.match(/^\|\s*`?(check\.[a-z0-9.-]+)`?\s*\|\s*([a-z-]+)\s*\|\s*(.*?)\s*\|\s*$/))
    .filter(Boolean)
    .map((m) => ({ check: m[1], verdict: m[2], evidence: m[3].replace(/^`|`$/g, "") }));
  const problems = [];
  if (!by) problems.push("no By: line naming the reviewer");
  // What the records would hold, the By: line and the rows, is read as a record is (D-151).
  lines.forEach((l, i) => {
    if (/^By:/.test(l) || /^\|\s*`?check\./.test(l)) problems.push(...outsideRecord(l, i + 1, { latinOnly }).map((p) => `${source}: ${p}`));
  });
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.check)) problems.push(`${r.check}: given twice`);
    seen.add(r.check);
    const c = listed.get(r.check);
    if (!c) {
      problems.push(`${r.check}: not a check the review lists`);
      continue;
    }
    if (r.verdict === "carried") {
      if (r.check === CODE_CHECK) problems.push(`${r.check}: the check of errors in code reads every new diff and is never carried`);
      const [file, read = ""] = r.evidence.split("·").map((x) => x.trim());
      const files = read.split(",").map((x) => x.trim()).filter(Boolean);
      const run = runs.find((x) => x.file === file);
      if (!run) problems.push(`${r.check}: carries ${file || "(no record)"}, which is no record of a run`);
      else if (run.check !== r.check) problems.push(`${r.check}: carries ${file}, a record of ${run.check}`);
      else if (run.stamp !== stamp(c)) problems.push(`${r.check}: carries ${file}, given at stamp ${run.stamp}, and the check's stamp is now ${stamp(c)}`);
      else if (!files.length) problems.push(`${r.check}: carries ${file} without the files read for it`);
      // A verdict given on changes not yet committed read files no commit holds, so nothing can show they
      // are the same now; it is given again.
      else if (/\+working-tree$/.test(run.commit)) problems.push(`${r.check}: carries ${file}, given on uncommitted changes (${run.commit}), which no commit holds to compare with`);
      else {
        const changed = changedSince(run.commit, files);
        if (changed.length) problems.push(`${r.check}: carries ${file}, and ${changed.join(", ")} changed since its commit ${run.commit}`);
      }
    } else if (!VERDICTS.includes(r.verdict)) problems.push(`${r.check}: verdict ${r.verdict} is not one of ${[...VERDICTS, "carried"].join(", ")}`);
  }
  for (const id of listed.keys()) if (!seen.has(id)) problems.push(`${id}: listed, with neither a new verdict nor a carried one`);
  if (problems.length) return { problems, records: [], carried: 0 };
  const time = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  const records = rows
    .filter((r) => r.verdict !== "carried")
    .map((r) => {
      const tail = createHash("sha256").update(`${r.check}|${time}|${by}`).digest("hex").replace(/[^a-z]/g, "").slice(0, 4).padEnd(4, "x");
      return {
        file: `${compact(time)}-${r.check}-${tail}.md`,
        text: [`Check: ${r.check}`, `Time: ${time}`, `Commit: ${commit}`, `Stamp: ${stamp(listed.get(r.check))}`, `Verdict: ${r.verdict}`, `By: ${by}`, ...(r.evidence ? [`Evidence: ${r.evidence}`] : []), ""].join("\n"),
      };
    });
  return { problems, records, carried: rows.length - records.length };
}
