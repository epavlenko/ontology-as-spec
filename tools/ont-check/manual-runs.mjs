// Records of manual runs (D-78): one file per run of a manual check, in the directory the configuration
// names under manualRuns. A record says which check ran, when, on which commit, with which stamp and
// verdict, by whom, and where the evidence is; the evidence itself stays outside the repository
// (rule.manual-evidence-kept).
// ont: ent.manual-run, edge.manual-run.check, field.manual-run.time, field.manual-run.commit, field.manual-run.stamp, field.manual-run.verdict, field.manual-run.by, field.manual-run.evidence, derived.current-run
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

// Every record of the directory, with what is wrong with it.
export function parseRuns(dir, known) {
  const runs = [];
  const malformed = [];
  for (const f of listFiles(dir, /\.md$/)) {
    const pairs = read(f)
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
