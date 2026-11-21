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
// outside the repository, in every project; and, where the configuration sets records.latinOnly, as this
// repository does for its rule of English only (D-03), no letter of a script other than Latin. Each
// problem names its line, from 1, and the token that breaks the rule.
//
// By construction rather than by a pattern of what a path looks like: the line is cut into tokens, the
// target of a Markdown link whole, the rest at white space and at the marks of Markdown and quotes, an
// HTML end tag such as </svg> dropped first. A token is then one of: a URL of the web, http or https,
// which is allowed; a URL of any other scheme, file: or another, which names something on one machine
// and is outside; an absolute path, /x, ~/x, C:\x, C:/x or \\server; or a relative path, which must not
// leave the repository by "..". A token without a slash or a backslash is a word, a commit range such
// as main..HEAD included.
// ont: rule.records-english-in-repo
const NOT_LATIN = /[^\P{L}\p{Script=Latin}]/u;
// Strict, and simple on purpose (D-151): the check does not read Markdown or find where words end beyond
// one rule. A line loses its web URLs and its HTML end tags; then it is refused for
// - a prefix that names something on a machine, anywhere: /home/, /Users/, /root/, /tmp/, /var/, /etc/,
//   /mnt/, /opt/, ~/, C:\ or C:/ (any drive), \\server, file:, mailto:;
// - an absolute path or a URL of another scheme where no letter or digit stands before it, so that a
//   mark, a quote, an emoji or an underscore before a slash starts a path;
// - any ".." next to a slash: a path in a record is written as the repository's own, normalised.
// A false refusal, such as docs/../x for docs/x, or a path after a combining mark, is the cost, and is
// recorded in docs/limitations.md; a path let through would be the worse error.
const WEB_URL = /\bhttps?:\/\/[^\s<>`"'|,;()\[\]]+/gi;
const END_TAG = /<\/[A-Za-z][A-Za-z0-9-]*>/g;
const LOCAL_PREFIX = /(\/(?:home|Users|root|tmp|var|etc|mnt|opt)\/|~\/|[A-Za-z]:[\\/]|\\\\[^\s\\]|(?<![\p{L}\p{N}])(?:file|mailto):)/giu;
// A URL of another scheme has a slash or an @ anywhere after its colon, as app:x/y or app:x@y.
const ABSOLUTE = /(?<![\p{L}\p{N}.~-])(\/[^\s/]|(?!https?:)[a-z][a-z0-9+.-]*:[^\s:]*[\/@])/giu;
// The target of a Markdown link or autolink with a scheme other than http and https, such as (about:config), names
// a place on a machine whatever follows its colon.
// The same in an autolink, <about:config>.
const LINK_SCHEME = /\]\(\s*<?((?!https?:)[a-z][a-z0-9+.-]*:)/giu;
const AUTOLINK_SCHEME = /<((?!https?:)[a-z][a-z0-9+.-]*:)[^\s<>]*>/giu;
const UP = /(?:^|[^.])(\.\.[\\/]|[\\/]\.\.(?![^\s\\/.]))/gu;
const wordAt = (line, i) => line.slice(i).match(/^[^\s<>`"'|,;()\[\]*]+/)?.[0] ?? line.slice(i, i + 20);
export function outsideRecord(text, from = 1, { latinOnly = false } = {}) {
  const problems = [];
  text.split("\n").forEach((line, i) => {
    const at = `line ${i + from}`;
    const plain = line.replace(WEB_URL, " ").replace(END_TAG, " ");
    if (latinOnly) {
      const letter = plain.match(NOT_LATIN);
      if (letter) problems.push(`${at}: the letter ${letter[0]} is not English text`);
    }
    const named = new Set();
    const name = (start, what) => {
      // The word the match is in, from its start, to name it in the refusal.
      let s0 = start;
      while (s0 > 0 && !/[\s<>`"'|,;()\[\]*]/.test(plain[s0 - 1])) s0--;
      const w = wordAt(plain, s0).replace(/[.:!?]+$/, "");
      if (!named.has(w)) problems.push(`${at}: ${w} ${what}`), named.add(w);
    };
    for (const m of plain.matchAll(LOCAL_PREFIX)) name(m.index, "is a path outside the repository");
    for (const m of plain.matchAll(ABSOLUTE)) name(m.index, "is a path outside the repository");
    for (const m of line.matchAll(LINK_SCHEME)) name(m.index + m[0].length - m[1].length, "is a link outside the repository");
    for (const m of line.matchAll(AUTOLINK_SCHEME)) name(m.index + 1, "is a link outside the repository");
    for (const m of plain.matchAll(UP)) name(m.index + m[0].length - m[1].length, "leaves the repository, or may: write the path from the repository's root, without ..");
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
  // The reviewer is named on the By: line itself; a value on the next line is no value (D-151).
  const by = text.match(/^By:[ \t]*(\S.*?)[ \t]*$/m)?.[1];
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
