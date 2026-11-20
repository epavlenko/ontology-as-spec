// Rounds of review (D-97, D-99) and the records of a review from the reviewer's table (D-100).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { recordVerdicts } from "../manual-runs.mjs";
import { nextRound, parseRounds, renderRounds } from "../review-rounds.mjs";

const TOOLS = fileURLToPath(new URL("../", import.meta.url));
const EXAMPLE = fileURLToPath(new URL("../../../example/", import.meta.url));

// A round of a step, with findings of the change of distinct classes, each fixable and tested unless said.
const round = (number, found, { narrow = false, ceiling = 3, untested = 0, notFixable = 0, before = 0, task = "t", step = "result-review" } = {}) => ({
  task,
  step,
  narrow,
  number,
  ceiling: number === 1 && !narrow ? ceiling : null,
  tokens: { new: 100, cached: 10, out: 5 },
  findings: [
    ...Array.from({ length: found }, (_, i) => ({
      cls: `class ${i}`,
      weight: "important",
      ofChange: true,
      fixable: i >= notFixable,
      test: i < untested ? null : "test.mjs",
    })),
    ...Array.from({ length: before }, (_, i) => ({ cls: `old ${i}`, weight: "nit", ofChange: false, fixable: true, test: null })),
  ],
});
const full = (counts, opts) => counts.map((n, i) => round(i + 1, n, opts));

test("[check.review-round.within-ceiling] within the ceiling the step has another round", () => {
  assert.equal(nextRound([round(1, 2)]).next, "full");
  assert.match(nextRound([round(1, 2)]).say, /round 2, within the ceiling of 3/);
});

test("[check.review-round.converging] past the ceiling, full rounds go on while they converge, then a narrow round", () => {
  assert.match(nextRound(full([3, 2, 1])).say, /round 4: past the ceiling/);
  assert.equal(nextRound(full([3, 2, 2])).next, "narrow");
  // Two findings of one class count once: 2, then 2 of a single class, converges.
  const same = full([3, 2]);
  same.push({ ...round(3, 0), findings: [0, 1].map(() => ({ cls: "one", weight: "nit", ofChange: true, fixable: true, test: "t.mjs" })) });
  assert.equal(nextRound(same).next, "full");
});

test("[check.review-round.six-in-all] six full rounds of a step in all, then a narrow round", () => {
  assert.equal(nextRound(full([6, 5, 4, 3, 2, 1], { ceiling: 1 })).next, "narrow");
  assert.equal(nextRound(full([6, 5, 4, 3, 2], { ceiling: 1 })).next, "full");
  // A ceiling above six does not give a seventh full round.
  assert.equal(nextRound(full([6, 5, 4, 3, 2, 1], { ceiling: 7 })).next, "narrow");
  assert.equal(nextRound(full([1, 1, 1, 1, 1, 1], { ceiling: 7 })).next, "narrow");
});

test("[check.review-round.narrow-needs-test] a narrow round that found fewer, one finding without a test, goes to the owner", () => {
  const rounds = [...full([3, 2, 2]), round(1, 1, { narrow: true, untested: 1 })];
  assert.equal(nextRound(rounds).next, "question");
  assert.match(nextRound(rounds).say, /no test/);
  // Fewer and every finding tested: the next narrow round.
  assert.equal(nextRound([...full([3, 2, 2]), round(1, 1, { narrow: true })]).next, "narrow");
  // A full round whose findings have no test does not open a narrow one.
  assert.equal(nextRound(full([3, 2, 2], { untested: 1 })).next, "question");
});

test("[check.review-round.narrow-three] findings left after three narrow rounds go to the owner", () => {
  const rounds = [...full([4, 4, 4]), round(1, 3, { narrow: true }), round(2, 2, { narrow: true }), round(3, 1, { narrow: true })];
  assert.match(nextRound(rounds).say, /after 3 narrow rounds/);
  // A narrow round with as many findings as the one before goes to the owner too.
  assert.match(nextRound([...full([2, 2, 2]), round(1, 2, { narrow: true })]).say, /as many findings/);
});

test("[check.review-round.not-fixable] a finding not fixable within the task goes to the owner", () => {
  assert.match(nextRound(full([3, 2, 1], { notFixable: 1 })).say, /not fixable/);
  // Within the ceiling too: the first round's finding that is not fixable goes to the owner.
  assert.match(nextRound([round(1, 1, { notFixable: 1 })]).say, /not fixable/);
});

test("[check.review-round.clean-ends] a round whose only finding was there before the change ends the step clean", () => {
  assert.equal(nextRound([round(1, 2), round(2, 0, { before: 1 })]).next, "clean");
});

const record = (fields, findings = []) =>
  [...Object.entries(fields).map(([k, v]) => `${k}: ${v}`), ...(findings.length ? ["Findings:", ...findings] : []), ""].join("\n");
const OK = { Task: "t", Step: "result-review", Number: 1, Ceiling: 3, Time: "2026-11-20T10:00:00Z", By: "a model" };

test("[check.review-round.malformed] names each record of rounds that cannot be read", () => {
  const dir = mkdtempSync(join(tmpdir(), "rounds-"));
  try {
    const { Task, ...noTask } = OK;
    writeFileSync(join(dir, "a.md"), record(noTask));
    writeFileSync(join(dir, "b.md"), record({ ...OK, Step: "final" }));
    writeFileSync(join(dir, "c.md"), record({ ...OK, Number: 2, "Tokens-new": -5 }));
    writeFileSync(join(dir, "d.md"), record({ ...OK, Number: 3 }, ["- a class · change · fixable"]));
    writeFileSync(join(dir, "e.md"), record(OK));
    writeFileSync(join(dir, "f.md"), record(OK));
    writeFileSync(join(dir, "g.md"), record({ ...OK, Number: 4, Time: "2026-99-99T99:99:99Z" }));
    const { malformed, rounds } = parseRounds(dir);
    assert.ok(malformed.some((m) => m.startsWith("a.md: no task")), malformed.join("\n"));
    assert.ok(malformed.some((m) => m.startsWith("b.md: step final")), malformed.join("\n"));
    assert.ok(malformed.some((m) => m.startsWith("c.md: tokens-new -5 is not a whole number")), malformed.join("\n"));
    assert.ok(malformed.some((m) => m.startsWith("d.md: finding 1: weight change")), malformed.join("\n"));
    assert.ok(malformed.some((m) => m.startsWith("e.md and f.md: both round 1")), malformed.join("\n"));
    assert.ok(malformed.some((m) => m.startsWith("g.md: time 2026-99-99T99:99:99Z")), malformed.join("\n"));
    assert.equal(rounds.length, 2);
    // Through the check: the records fail it.
    const cfgDir = mkdtempSync(join(tmpdir(), "rounds-cfg-"));
    cpSync(EXAMPLE, cfgDir, { recursive: true });
    const cfgPath = join(cfgDir, "ont.config.json");
    const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
    writeFileSync(cfgPath, JSON.stringify({ ...cfg, reviewRounds: { dir } }));
    const r = spawnSync("node", [join(TOOLS, "ont-check.mjs"), "--config", cfgPath], { encoding: "utf8" });
    rmSync(cfgDir, { recursive: true, force: true });
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /review round records that cannot be read \(6\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("[check.review-round.payoff-after-ten] a step's payoff is printed after ten applications, its rounds taken together", () => {
  const nine = Array.from({ length: 9 }, (_, i) => round(1, i % 3 ? 0 : 1, { task: `task ${i}`, step: "statement-review" }));
  assert.doesNotMatch(renderRounds(nine), /PAYOFF/);
  const ten = [...nine, ...full([2, 1, 0], { task: "task 9", step: "statement-review" })];
  const out = renderRounds(ten);
  assert.match(out, /PAYOFF statement-review: 10 applications, 12 rounds, tokens 1200 new · 120 cached · 60 out/);
  assert.match(out, /findings of the change 6 important · 0 nit, 6 applications found nothing/);
  // A count a round left out is not a zero: the sum says for how many rounds it is known.
  const partial = ten.map((r, i) => (i < 4 ? { ...r, tokens: { new: 100, cached: null, out: null } } : r));
  assert.match(renderRounds(partial), /tokens 1200 new · 80 cached \(known for 8 of 12 rounds\) · 40 out \(known for 8 of 12 rounds\)/);
});

// --record: a review's table of verdicts.
const listed = new Map([
  ["check.a", { id: "check.a" }],
  ["check.b", { id: "check.b" }],
]);
const stamp = (c) => `s-${c.id}`;
const runs = [
  { file: "20261120T090000Z-check.b-abcd.md", check: "check.b", stamp: "s-check.b", commit: "abc+working-tree" },
  { file: "20261120T090000Z-check.a-efgh.md", check: "check.a", stamp: "old", commit: "abc" },
];
const now = new Date("2026-11-20T12:00:00Z");
const table = (rows, by = "By: a model of a provider") => [by, "", "| Check | Verdict | Evidence |", "| --- | --- | --- |", ...rows].join("\n");

test("[check.manual-run.record-verdicts] one record for each new verdict, none for a carried one", () => {
  const r = recordVerdicts({
    text: table(["| check.a | pass | notes outside |", "| check.b | carried | 20261120T090000Z-check.b-abcd.md · app/library.mjs |"]),
    listed,
    runs,
    stamp,
    commit: "abc123",
    now,
    changedSince: (since, files) => (assert.deepEqual([since, files], ["abc", ["app/library.mjs"]]), []),
    runs: runs.map((x) => (x.check === "check.b" ? { ...x, commit: "abc" } : x)),
  });
  assert.deepEqual(r.problems, []);
  assert.equal(r.records.length, 1);
  assert.equal(r.carried, 1);
  assert.match(r.records[0].file, /^20261120T120000Z-check\.a-[a-z]{4}\.md$/);
  assert.equal(
    r.records[0].text,
    "Check: check.a\nTime: 2026-11-20T12:00:00Z\nCommit: abc123\nStamp: s-check.a\nVerdict: pass\nBy: a model of a provider\nEvidence: notes outside\n",
  );
});

test("[check.manual-run.record-refused] a table with a check not listed, twice, missing, carried at another stamp, or a carried code check is refused", () => {
  const refused = (rows, extra = {}) => recordVerdicts({ text: table(rows), listed: extra.listed ?? listed, runs, stamp, commit: "c", now });
  const r1 = refused(["| check.a | pass | |", "| check.b | pass | |", "| check.z | pass | |"]);
  assert.ok(r1.problems.includes("check.z: not a check the review lists"), r1.problems.join("\n"));
  const r2 = refused(["| check.a | pass | |", "| check.a | fail | |", "| check.b | pass | |"]);
  assert.ok(r2.problems.includes("check.a: given twice"), r2.problems.join("\n"));
  const r3 = refused(["| check.a | pass | |"]);
  assert.ok(r3.problems.includes("check.b: listed, with neither a new verdict nor a carried one"), r3.problems.join("\n"));
  const r4 = refused(["| check.a | carried | 20261120T090000Z-check.a-efgh.md |", "| check.b | pass | |"]);
  assert.ok(r4.problems.some((p) => p.startsWith("check.a: carries 20261120T090000Z-check.a-efgh.md, given at stamp old")), r4.problems.join("\n"));
  const code = "check.agent-rules.code-reviewed-for-errors";
  const r5 = refused([`| ${code} | carried | x.md |`], { listed: new Map([[code, { id: code }]]) });
  assert.ok(r5.problems.some((p) => p.includes("never carried")), r5.problems.join("\n"));
  const carry = "| check.b | carried | 20261120T090000Z-check.b-abcd.md";
  const r6 = refused(["| check.a | pass | |", `${carry} |`]);
  assert.ok(r6.problems.some((p) => p.includes("without the files read for it")), r6.problems.join("\n"));
  const committed = runs.map((x) => ({ ...x, commit: "abc" }));
  const r7 = recordVerdicts({ text: table(["| check.a | pass | |", `${carry} · app/library.mjs, app/cli.mjs |`]), listed, runs: committed, stamp, commit: "c", now, changedSince: () => ["app/cli.mjs"] });
  assert.ok(r7.problems.some((p) => p.includes("app/cli.mjs changed since its commit")), r7.problems.join("\n"));
  // A record of uncommitted changes has no commit that holds what was read: it is not carried.
  const r8 = recordVerdicts({ text: table(["| check.a | pass | |", `${carry} · app/library.mjs |`]), listed, runs, stamp, commit: "c", now, changedSince: () => [] });
  assert.ok(r8.problems.some((p) => p.includes("given on uncommitted changes (abc+working-tree)")), r8.problems.join("\n"));
  for (const r of [r1, r2, r3, r4, r5, r6, r7, r8]) assert.deepEqual(r.records, []);
  assert.ok(recordVerdicts({ text: table(["| check.a | pass | |", "| check.b | pass | |"], ""), listed, runs, stamp, commit: "c", now }).problems.includes("no By: line naming the reviewer"));
});

test("[check.manual-run.record-verdicts] --review --record writes the records into the directory of manualRuns", () => {
  const dir = mkdtempSync(join(tmpdir(), "record-"));
  try {
    cpSync(EXAMPLE, dir, { recursive: true });
    const git = (...a) => spawnSync("git", ["-C", dir, ...a], { encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
    git("init", "-q");
    git("add", "-A");
    git("commit", "-q", "-m", "base");
    writeFileSync(join(dir, "app/format.mjs"), "export const pad = (s) => String(s).padStart(2, '0');\n");
    // The change is committed, so its records name a commit that holds what was read.
    git("add", "-A");
    git("commit", "-q", "-m", "change");
    const cli = (...a) => spawnSync("node", [join(TOOLS, "ont-check.mjs"), "--config", join(dir, "ont.config.json"), "--review", "HEAD~1", ...a], { encoding: "utf8" });
    const out = cli().stdout;
    const ids = [...out.slice(out.indexOf("REVIEW HEAD")).matchAll(/^ {2}(check\.\S+)/gm)].map((m) => m[1]);
    assert.ok(ids.length > 0);
    mkdirSync(join(dir, "verify/runs"), { recursive: true });
    const before = readdirSync(join(dir, "verify/runs")).length;
    // The table is the reviewer's, outside the change.
    const tableFile = join(mkdtempSync(join(tmpdir(), "table-")), "table.md");
    writeFileSync(tableFile, table(ids.map((id) => `| ${id} | pass | |`)));
    const r = cli("--record", tableFile);
    assert.match(r.stdout, new RegExp(`RECORDED ${ids.length} verdicts, 0 carried`), r.stdout);
    assert.equal(readdirSync(join(dir, "verify/runs")).length, before + ids.length);
    // A later round carries the verdicts over app/format.mjs, changed since: refused; over files with no
    // snapshot in the record's commit, refused; over a tracked file left alone, it holds.
    writeFileSync(join(dir, "app/format.mjs"), "export const pad = (s) => String(s).padStart(3, '0');\n");
    const records = readdirSync(join(dir, "verify/runs")).filter((f) => ids.some((id) => f.includes(id)));
    const carry = (file) => table(ids.map((id) => `| ${id} | ${id === "check.agent-rules.code-reviewed-for-errors" ? "pass" : "carried"} | ${id === "check.agent-rules.code-reviewed-for-errors" ? "" : `${records.find((f) => f.includes(`-${id}-`))} · ${file}`} |`));
    writeFileSync(tableFile, carry("app/format.mjs"));
    const refused = cli("--record", tableFile);
    assert.match(refused.stdout, /app\/format\.mjs changed since its commit/, refused.stdout);
    // An ignored file and a path that does not exist have no snapshot in the record's commit either.
    writeFileSync(join(dir, ".gitignore"), "secret.txt\n");
    writeFileSync(join(dir, "secret.txt"), "x\n");
    for (const file of ["secret.txt", "app/nowhere.mjs"]) {
      writeFileSync(tableFile, carry(file));
      assert.match(cli("--record", tableFile).stdout, new RegExp(`${file.replace(".", "\\.")} changed since its commit`));
    }
    writeFileSync(tableFile, carry("app/library.mjs"));
    const held = cli("--record", tableFile);
    assert.match(held.stdout, new RegExp(`RECORDED 1 verdicts, ${ids.length - 1} carried`), held.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
