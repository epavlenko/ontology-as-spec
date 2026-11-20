// Records of manual runs (D-78). Each case copies the example, writes records into its verify/runs
// and runs the check. The example sets manualRuns without require.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseChecks, parseGlossary } from "../lib.mjs";
import { outsideRecord, recordVerdicts, runStamp } from "../manual-runs.mjs";
import { parseRounds } from "../review-rounds.mjs";

const TOOLS = fileURLToPath(new URL("../", import.meta.url));
const EXAMPLE = fileURLToPath(new URL("../../../example/", import.meta.url));
const CHECK = "check.loan.overdue-in-real-time";

const patch = (dir, file, from, to) => {
  const path = join(dir, file);
  const text = readFileSync(path, "utf8");
  assert.ok(text.includes(from), `fixture text not found in ${file}: ${from}`);
  writeFileSync(path, text.replace(from, to));
};

// The stamp of a check as the copy in dir has it now.
const stampIn = (dir, id) => {
  const { ONT, rows, notes } = parseGlossary(readFileSync(join(dir, "ontology.md"), "utf8"));
  const checks = parseChecks(readFileSync(join(dir, "checks.md"), "utf8"));
  const byId = new Map(checks.map((c) => [c.id, c]));
  return runStamp(byId.get(id), ONT, rows, byId, notes);
};

const record = (dir, name, fields) => {
  mkdirSync(join(dir, "verify/runs"), { recursive: true });
  const text = Object.entries({ Check: CHECK, Commit: "abc1234", By: "gpt-6.1-sol, OpenAI", ...fields })
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  writeFileSync(join(dir, "verify/runs", name), `# Manual run\n\n${text}\n`);
};

const run = (edit) => {
  const dir = mkdtempSync(join(tmpdir(), "ont-runs-"));
  try {
    cpSync(EXAMPLE, dir, { recursive: true });
    edit?.(dir);
    const r = spawnSync("node", [join(TOOLS, "ont-check.mjs"), "--config", join(dir, "ont.config.json")], { encoding: "utf8" });
    return { code: r.status, out: r.stdout + r.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const NONE = /(info|ERROR) · manual checks of implemented concepts with no current run \(\d+\):\n((?: {2}.*\n)+)/;
const noRun = (out) => (out.match(NONE)?.[2] ?? "").includes(CHECK);
const failed = (out) => out.includes(`info · manual checks whose last current run failed (1):\n  ${CHECK}`);
const requireRuns = (dir) => patch(dir, "ont.config.json", '"manualRuns": { "dir": "verify/runs" }', '"manualRuns": { "dir": "verify/runs", "require": true }');

test("[check.manual-run.none] lists a manual check without a record as information", () => {
  const r = run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /info · manual checks of implemented concepts with no current run/);
  assert.ok(noRun(r.out), r.out);
});

test("[check.manual-run.current-pass] does not list a check whose current run passed", () => {
  const r = run((dir) => record(dir, `20261105T090000Z-${CHECK}-a1b2.md`, { Time: "2026-11-05T09:00:00Z", Stamp: stampIn(dir, CHECK), Verdict: "pass" }));
  assert.equal(r.code, 0, r.out);
  assert.ok(!noRun(r.out), r.out);
  assert.ok(!failed(r.out), r.out);
});

test("[check.manual-run.stale] lists a check whose run was stamped before its concept changed", () => {
  const r = run((dir) => {
    record(dir, `20261105T090000Z-${CHECK}-a1b2.md`, { Time: "2026-11-05T09:00:00Z", Stamp: stampIn(dir, CHECK), Verdict: "pass" });
    patch(dir, "ontology.md", "The loan is open and the due date has passed.", "The loan is open and its due date has passed.");
  });
  assert.ok(noRun(r.out), r.out);
});

test("[check.manual-run.last-failed] lists a failed current run as information, even when runs are required", () => {
  const r = run((dir) => {
    requireRuns(dir);
    record(dir, `20261105T090000Z-${CHECK}-a1b2.md`, { Time: "2026-11-05T09:00:00Z", Stamp: stampIn(dir, CHECK), Verdict: "fail" });
  });
  assert.ok(failed(r.out), r.out);
  assert.ok(!noRun(r.out), r.out);
  assert.doesNotMatch(r.out, /ERROR · manual checks whose last current run failed/);
});

test("[check.manual-run.not-run-ignored] does not count a not-run record as a run", () => {
  const r = run((dir) => record(dir, `20261105T090000Z-${CHECK}-a1b2.md`, { Time: "2026-11-05T09:00:00Z", Stamp: stampIn(dir, CHECK), Verdict: "not-run" }));
  assert.ok(noRun(r.out), r.out);
});

test("[check.manual-run.required] fails on a manual check without a current run when runs are required", () => {
  const r = run(requireRuns);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /ERROR · manual checks of implemented concepts with no current run/);
  assert.ok(noRun(r.out), r.out);
});

test("[check.manual-run.malformed] fails on records it cannot read and says what is wrong", () => {
  const r = run((dir) => {
    record(dir, "20261105T090000Z-check.loan.no-such-aaaa.md", { Check: "check.loan.no-such", Time: "2026-11-05T09:00:00Z", Stamp: "x", Verdict: "pass" });
    record(dir, `20261105T090000Z-${CHECK}-bbbb.md`, { Time: "2026-11-05T09:00:00Z", Stamp: "x", Verdict: "passed" });
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /ERROR · manual run records that cannot be read \(2\):/);
  assert.match(r.out, /no-such-aaaa\.md: unknown check check\.loan\.no-such/);
  assert.match(r.out, /bbbb\.md: verdict passed is not one of/);
});

test("[check.manual-run.malformed] fails on a record without a commit, and it does not count as a run", () => {
  const r = run((dir) => {
    record(dir, `20261105T090000Z-${CHECK}-a1b2.md`, { Time: "2026-11-05T09:00:00Z", Stamp: stampIn(dir, CHECK), Verdict: "pass", Commit: "" });
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /a1b2\.md: no commit/);
  assert.ok(noRun(r.out), r.out);
});

test("[check.manual-run.malformed] fails on a field given twice in one record", () => {
  const r = run((dir) => {
    const name = `20261105T090000Z-${CHECK}-a1b2.md`;
    record(dir, name, { Time: "2026-11-05T09:00:00Z", Stamp: stampIn(dir, CHECK), Verdict: "fail" });
    appendFileSync(join(dir, "verify/runs", name), "Verdict: pass\n");
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /a1b2\.md: verdict given more than once/);
  assert.ok(noRun(r.out), r.out);
});

test("[check.manual-run.malformed] fails on a time that has the shape of one and is no time", () => {
  const r = run((dir) => record(dir, `20269999T999999Z-${CHECK}-a1b2.md`, { Time: "2026-99-99T99:99:99Z", Stamp: stampIn(dir, CHECK), Verdict: "pass" }));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /time 2026-99-99T99:99:99Z is not a UTC time/);
});

test("[check.manual-run.malformed] fails on a record whose file name is not its time and check", () => {
  const r = run((dir) => {
    record(dir, "x.md", { Time: "2026-11-05T09:00:00Z", Stamp: stampIn(dir, CHECK), Verdict: "pass" });
    record(dir, `20261105T100000Z-${CHECK}-c3d4.md`, { Time: "2026-11-05T09:00:00Z", Stamp: stampIn(dir, CHECK), Verdict: "pass" });
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /x\.md: the name is not <UTC time>-<check>-<4 characters>\.md/);
  assert.match(r.out, /c3d4\.md: the name does not match the record's check and time/);
});

test("[check.manual-run.same-day] takes the later of two runs on one day", () => {
  const twice = (first, second) =>
    run((dir) => {
      const stamp = stampIn(dir, CHECK);
      record(dir, `20261105T090000Z-${CHECK}-a1b2.md`, { Time: "2026-11-05T09:00:00Z", Stamp: stamp, Verdict: first });
      record(dir, `20261105T150000Z-${CHECK}-c3d4.md`, { Time: "2026-11-05T15:00:00Z", Stamp: stamp, Verdict: second });
    });
  const fixed = twice("fail", "pass");
  assert.ok(!failed(fixed.out) && !noRun(fixed.out), fixed.out);
  const broken = twice("pass", "fail");
  assert.ok(failed(broken.out), broken.out);
});

test("[check.manual-run.ambiguous] fails on two records of one check with the same time and author", () => {
  const r = run((dir) => {
    const stamp = stampIn(dir, CHECK);
    record(dir, `20261105T090000Z-${CHECK}-a1b2.md`, { Time: "2026-11-05T09:00:00Z", Stamp: stamp, Verdict: "pass" });
    record(dir, `20261105T090000Z-${CHECK}-e5f6.md`, { Time: "2026-11-05T09:00:00Z", Stamp: stamp, Verdict: "fail" });
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /ERROR · manual run records that two files claim .*\(1\):\n {2}20261105T090000Z-check\.loan\.overdue-in-real-time-a1b2\.md and 20261105T090000Z-check\.loan\.overdue-in-real-time-e5f6\.md/);
});

// A Cyrillic word, written with escapes so that this file stays English (D-03).
const CYRILLIC = "\u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0430";

test("[check.manual-run.english-in-repo] refuses a record with non-Latin letters or a path outside the repository, and names its file and line", () => {
  const at = (dir, time, evidence, tail) => {
    const name = `${time.replace(/[-:]/g, "")}-${CHECK}-${tail}.md`;
    record(dir, name, { Time: time, Stamp: stampIn(dir, CHECK), Verdict: "pass", Evidence: evidence });
    return name;
  };
  const names = {};
  const r = run((dir) => {
    names.cyrillic = at(dir, "2026-11-05T09:00:00Z", `the screen shows ${CYRILLIC}`, "aaaa");
    names.home = at(dir, "2026-11-05T09:01:00Z", "see /home/x/notes.md:4", "bbbb");
    names.up = at(dir, "2026-11-05T09:02:00Z", "see ../outside/log.md", "cccc");
    names.clean = at(dir, "2026-11-05T09:03:00Z", "https://example.org/runs/2026-11-05 and `docs/../README.md`, the reviewer's log, kept outside the repository", "dddd");
  });
  assert.equal(r.code, 1, r.out);
  // The Evidence line is the record's ninth: a heading, a blank line, then Check, Commit, By, Time, Stamp, Verdict.
  assert.match(r.out, new RegExp(`${names.cyrillic.replace(/\./g, "\\.")}: line 9: the letter . is not English text`));
  assert.match(r.out, new RegExp(`${names.home.replace(/\./g, "\\.")}: line 9: /home/x/notes\\.md:4 is a path outside the repository`));
  assert.match(r.out, new RegExp(`${names.up.replace(/\./g, "\\.")}: line 9: \\.\\./outside/log\\.md leaves the repository`));
  assert.ok(!r.out.includes(names.clean), r.out);

  // A record of a round is read the same way.
  const dir = mkdtempSync(join(tmpdir(), "rounds-"));
  try {
    const round = (findings) => ["Task: t", "Step: result-review", "Number: 1", "Ceiling: 3", "Time: 2026-11-20T10:00:00Z", "By: a model", "Findings:", findings, ""].join("\n");
    writeFileSync(join(dir, "a.md"), round("- a log in /tmp/log · nit · change · fixable"));
    writeFileSync(join(dir, "b.md"), round("- a log, kept outside the repository · nit · change · fixable").replace("Task: t", "Task: u"));
    const { malformed, rounds } = parseRounds(dir);
    assert.deepEqual(malformed, ["a.md: line 8: /tmp/log is a path outside the repository"]);
    assert.equal(rounds.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // The table of verdicts is refused whole, with its line, and no record is written.
  const listed = new Map([[CHECK, { id: CHECK }]]);
  const table = (evidence) => ["By: a model of a provider", "", "| Check | Verdict | Evidence |", "| --- | --- | --- |", `| ${CHECK} | pass | ${evidence} |`].join("\n");
  const refused = recordVerdicts({ text: table(`the screen shows ${CYRILLIC}`), listed, runs: [], stamp: () => "s", commit: "c", now: new Date(), source: "verdicts.md" });
  assert.deepEqual(refused.records, []);
  assert.ok(refused.problems.some((p) => /^verdicts\.md: line 5: the letter . is not English text$/.test(p)), refused.problems.join("\n"));
  const held = recordVerdicts({ text: table("https://example.org/x"), listed, runs: [], stamp: () => "s", commit: "c", now: new Date(), source: "verdicts.md" });
  assert.deepEqual(held.problems, []);
  assert.equal(held.records.length, 1);

  // What is no path outside: a URL, a path inside, a range of commits, an end tag, a bare "..", a slash between words.
  for (const ok of ["https://github.com/a/b", "`docs/../README.md:3`", "main..HEAD", "`<svg/></svg>`", "a `..` part", "pass/fail", "C# and F#"]) assert.deepEqual(outsideRecord(ok), [], ok);
  for (const bad of ["~/notes.md", "C:\\Users\\x", "(</srv/a b.md>)", "`../../x`", "docs/../../x"]) assert.equal(outsideRecord(bad).length, 1, bad);
});
