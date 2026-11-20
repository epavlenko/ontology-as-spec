// A task's statement and its approval (D-106), acceptance after done (D-107) and the task's budget (D-108).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { nextRound, parseRounds } from "../review-rounds.mjs";
import { acceptanceProblems, gitEnv, overlaps, parseTaskRecords, readStatement, sha256, taskBudget, taskState } from "../tasks.mjs";

const TOOLS = fileURLToPath(new URL("../", import.meta.url));
const EXAMPLE = fileURLToPath(new URL("../../../example/", import.meta.url));
// Version A of a statement: its one command of done is the one the records of done here ran.
const A_TEXT = "version A\nDone-when: npm test\n";
const A = sha256(A_TEXT);
const B = sha256("version B");
const T = (h, m = 0) => `2026-11-20T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;
const finding = (i, test = "t.test.mjs") => `- class ${i} · important · change · fixable${test ? ` · ${test}` : ""}`;

// A record of a round: its fields, then its findings, then its verdict of acceptance.
const roundText = ({ task = "t", step = "statement-review", number = 1, narrow, ceiling, start, time, hash, found = 0, tokens, contribution, acceptance, overspend, untested, commits }) =>
  [
    `Task: ${task}`,
    `Step: ${step}`,
    ...(narrow ? ["Narrow: true"] : []),
    `Number: ${number}`,
    ...(ceiling ? [`Ceiling: ${ceiling}`] : []),
    ...(start ? [`Start: ${start}`] : []),
    `Time: ${time}`,
    `By: a model (a provider)`,
    ...(commits ? [`Commits: ${commits}`] : []),
    ...(contribution ? [`Contribution: ${contribution}`] : []),
    ...(hash ? [`Statement-hash: ${hash}`] : []),
    ...(tokens ? [`Tokens-new: ${tokens[0]}`, `Tokens-cached: ${tokens[1]}`, `Tokens-out: ${tokens[2]}`] : []),
    ...(overspend ? [`Overspend: ${overspend}`] : []),
    ...(found ? ["Findings:", ...Array.from({ length: found }, (_, i) => finding(i, untested ? null : "t.test.mjs"))] : []),
    ...(acceptance === undefined ? [] : acceptance === "clean" ? ["Acceptance: clean"] : ["Acceptance:", ...acceptance]),
    "",
  ].join("\n");
const spendText = ({ task = "t", contribution = "a provider · run-1", start, end, tokens = [0, 0, 0] }) =>
  [`Record: spend`, `Task: ${task}`, `Contribution: ${contribution}`, `Start: ${start}`, `End: ${end}`, `Tokens-new: ${tokens[0]}`, `Tokens-cached: ${tokens[1]}`, `Tokens-out: ${tokens[2]}`, ""].join("\n");
const doneText = ({ task = "t", hash = A, time, result = "pass", commit = "a".repeat(40), command = "npm test" }) =>
  [`Record: done`, `Task: ${task}`, `Commit: ${commit}`, `Statement-hash: ${hash}`, `Time: ${time}`, `Checks:`, `- ${command} · ${result}`, ""].join("\n");

// Writes the records into two directories and reads them as the check does.
function scenario({ rounds = [], spend = [], done = [] }) {
  const dir = mkdtempSync(join(tmpdir(), "task-"));
  mkdirSync(join(dir, "rounds"));
  mkdirSync(join(dir, "tasks"));
  rounds.forEach((r, i) => writeFileSync(join(dir, "rounds", `r${i}.md`), roundText(r)));
  spend.forEach((s, i) => writeFileSync(join(dir, "tasks", `s${i}.md`), spendText(s)));
  done.forEach((d, i) => writeFileSync(join(dir, "tasks", `d${i}.md`), doneText(d)));
  const r = parseRounds(join(dir, "rounds"));
  const t = parseTaskRecords(join(dir, "tasks"));
  return { dir, ...r, records: t };
}
const state = (sc, { statement = null, defaults = { newInput: null, output: null, reserve: null } } = {}) =>
  taskState({ rounds: sc.rounds, spend: sc.records.spend, done: sc.records.done, task: "t", defaults, statement }).lines.join("\n");
const fileOf = (hash) => ({ hash, doneWhen: ["npm test"], budget: { newInput: null, output: null } });
const approvedA = { step: "statement-review", number: 1, ceiling: 2, time: T(9), hash: A };

test("[check.task-statement.needs-review] a task with no round of the review of its statement needs one", () => {
  assert.match(state(scenario({})), /statement: it needs a review of the statement/);
});

test("[check.task-statement.findings-next] after a round of the statement with findings, the next round is what derived.next-round says", () => {
  const sc = scenario({ rounds: [{ ...approvedA, found: 2 }] });
  assert.match(state(sc, { statement: fileOf(A) }), /statement: round 2, within the ceiling of 2/);
});

test("[check.task-statement.changed-after-approval] a statement edited after a clean round needs a full round of the new version, within the ceiling", () => {
  const sc = scenario({ rounds: [approvedA] });
  const out = state(sc, { statement: fileOf(B) });
  assert.match(out, /statement: the statement changed after its approval: next is full round 2 of the new version, within the ceiling of 2/);
  assert.match(out, /result: work is not allowed/);
});

test("[check.task-statement.later-version-findings] a full round of version B with findings after a clean narrow round of A: no work, no acceptance for A, the next round from B", () => {
  const rounds = [
    { step: "statement-review", number: 1, ceiling: 1, time: T(9), hash: A, found: 2 },
    { step: "statement-review", number: 1, narrow: true, time: T(10), hash: A },
    { step: "statement-review", number: 2, time: T(11), hash: B, found: 2 },
    { step: "result-review", number: 1, ceiling: 2, time: T(13), hash: A, acceptance: "clean" },
  ];
  const sc = scenario({ rounds, done: [{ hash: A, time: T(12) }] });
  const out = state(sc, { statement: fileOf(B) });
  assert.match(out, /statement: narrow round 2, on the fixes of the last round/);
  assert.doesNotMatch(out, /ended clean|approved/);
  assert.match(out, /result: work is not allowed/);
  assert.deepEqual(acceptanceProblems(sc.rounds, sc.records.done), ["r3.md: acceptance of t refused: the record of done d0.md was made with no approval in force for its version of the statement"]);
  // Ordered full rounds first, the clean narrow round would have ended the step: by time it does not.
  assert.notEqual(nextRound(sc.rounds.filter((r) => r.step === "statement-review")).next, "clean");
});

test("[check.task-statement.changed-after-six] a statement edited after six full rounds is a question to the owner", () => {
  const rounds = [5, 4, 3, 2, 1, 0].map((found, i) => ({ step: "statement-review", number: i + 1, ceiling: i ? undefined : 1, time: T(9 + i), hash: A, found }));
  assert.match(state(scenario({ rounds }), { statement: fileOf(B) }), /statement: the statement changed after 6 full rounds: a question to the owner/);
});

test("[check.task-statement.approved] a clean round of the version in the file lets work start", () => {
  const out = state(scenario({ rounds: [approvedA] }), { statement: fileOf(A) });
  assert.match(out, /statement: approved, version [0-9a-f]{12}: work may start under it/);
  assert.match(out, /result: the executor works, then records done/);
  // Without the file the version cannot be compared, and no work is allowed.
  assert.match(state(scenario({ rounds: [approvedA] })), /give --statement <file>[\s\S]*work is not allowed/);
});

test("[check.review-round.by-time] the last round by time decides the step, not the narrow rounds after the full ones", () => {
  const rounds = parseRounds(
    scenario({
      rounds: [
        { step: "statement-review", number: 1, ceiling: 3, time: T(9), hash: A, found: 1 },
        { step: "statement-review", number: 1, narrow: true, time: T(10), hash: A },
        { step: "statement-review", number: 2, time: T(11), hash: B, found: 2 },
      ],
    }).dir + "/rounds",
  ).rounds;
  const n = nextRound(rounds);
  assert.equal(n.next, "full");
  assert.match(n.say, /round 3, within the ceiling of 3/);
});

test("[check.review-round.numbers-go-on] a next narrow round takes the next free number, and three narrow rounds count over the step", () => {
  const base = [
    { step: "statement-review", number: 1, ceiling: 2, time: T(8), hash: A, found: 3 },
    { step: "statement-review", number: 2, time: T(9), hash: A, found: 3 },
    { step: "statement-review", number: 1, narrow: true, time: T(10), hash: A, found: 2 },
    { step: "statement-review", number: 2, narrow: true, time: T(11), hash: A },
    { step: "statement-review", number: 3, time: T(12), hash: B, found: 3 },
  ];
  const n = nextRound(scenario({ rounds: base }).rounds);
  assert.equal(n.next, "narrow");
  assert.equal(n.number, 3);
  assert.match(n.say, /narrow round 3/);
  // Narrow round 3 of B with fewer findings: no fourth narrow round.
  const more = nextRound(scenario({ rounds: [...base, { step: "statement-review", number: 3, narrow: true, time: T(13), hash: B, found: 2 }] }).rounds);
  assert.equal(more.next, "question");
  assert.match(more.say, /after 3 narrow rounds/);
});

test("[check.review-round.contribution-needs-start] a contribution without a start, a start after the time, a contribution with no ID and an acceptance of a statement are refused", () => {
  const sc = scenario({
    rounds: [
      { ...approvedA, contribution: "openai · s1" },
      { ...approvedA, number: 2, contribution: "openai · s2", start: T(10), time: T(9) },
      { ...approvedA, number: 3, contribution: "openai", start: T(8) },
      { ...approvedA, number: 4, acceptance: "clean" },
    ],
  });
  const m = sc.malformed.join("\n");
  assert.match(m, /r0\.md: a contribution without a start/);
  assert.match(m, /r1\.md: start 2026-11-20T10:00:00Z is after its time/);
  assert.match(m, /r2\.md: contribution openai is not "provider · ID"/);
  assert.match(m, /r3\.md: an acceptance on a review that is not of the result/);
  assert.equal(sc.rounds.length, 0);
});

const limits = (newInput, output, reserve = null) => ({ newInput, output, reserve });

test("[check.task-statement.budget-limits] the stop follows the limits, the reserve is 1 when not set, cached tokens are not summed, and output alone stops", () => {
  const sc = scenario({
    rounds: [{ ...approvedA, tokens: [600, 5000, 100] }],
    spend: [{ start: T(10), end: T(11), tokens: [300, 9000, 100] }],
  });
  const ok = state(sc, { statement: fileOf(A), defaults: limits(1000, 1000) });
  assert.match(ok, /BUDGET t: new input 900 of 1000 × 1 = 1000, output 200 of 1000 × 1 = 1000; known for 2 of 2 contributions; budget.reserve is not set, so the reserve is 1/);
  assert.match(ok, /result: the executor works/);
  // budget.newInput moves the stop.
  assert.match(state(sc, { statement: fileOf(A), defaults: limits(900, 1000) }), /result: the budget is exhausted: a question to the owner/);
  // With a reserve of 2 a limit of 500 stops at 1000.
  const reserved = state(sc, { statement: fileOf(A), defaults: limits(500, 1000, 2) });
  assert.match(reserved, /new input 900 of 500 × 2 = 1000/);
  assert.match(reserved, /result: the executor works/);
  // The statement's own limit replaces the configuration's.
  assert.match(state(sc, { statement: { hash: A, budget: { newInput: 800, output: null } }, defaults: limits(1000, 1000) }), /new input 900 of 800[\s\S]*; exhausted|exhausted/);
  // Output alone past its limit, new input within.
  const b = taskBudget({ rounds: sc.rounds, spend: sc.records.spend, task: "t", defaults: limits(1000, 150) });
  assert.equal(b.exhausted, true);
  assert.equal(b.used.newInput, 900);
});

test("[check.task-statement.budget-silent] with no limit anywhere nothing is said of a budget", () => {
  const sc = scenario({ rounds: [{ ...approvedA, tokens: [10 ** 9, 0, 10 ** 9] }] });
  const out = state(sc, { statement: fileOf(A) });
  assert.doesNotMatch(out, /BUDGET|budget/);
  assert.equal(taskBudget({ rounds: sc.rounds, spend: [], task: "t", defaults: limits(null, null) }), null);
});

// The commit a round of the result reviewed is the one the records of done name, "a" forty times.
const finalRound = (extra = {}) => ({ step: "result-review", number: 1, ceiling: 2, time: T(12), hash: A, acceptance: "clean", commits: `${"b".repeat(7)}..${"a".repeat(7)}`, ...extra });

test("[check.task-statement.budget-final-exact] a clean final round that spends the budget exactly ends the task with no question and no overspend", () => {
  const sc = scenario({ rounds: [{ ...approvedA, tokens: [500, 0, 10] }, finalRound({ tokens: [500, 0, 10] })], done: [{ time: T(11) }] });
  const out = state(sc, { statement: fileOf(A), defaults: limits(1000, 1000) });
  assert.match(out, /result: done: the last round and its acceptance are clean/);
  assert.doesNotMatch(out, /question|overspend/);
});

test("[check.task-statement.budget-final-over] a clean final round past the budget ends the task and says the overspend, which its record must name", () => {
  const named = scenario({ rounds: [{ ...approvedA, tokens: [500, 0, 10] }, finalRound({ tokens: [600, 0, 10], overspend: "new input 1100 of 1000" })], done: [{ time: T(11) }] });
  const st = taskState({ rounds: named.rounds, spend: [], done: named.records.done, task: "t", defaults: limits(1000, 1000), statement: fileOf(A) });
  const out = st.lines.join("\n");
  assert.match(out, /result: done, with an overspend: new input 1100 of 1000, output 20 of 1000; report it to the owner/);
  assert.match(out, /BUDGET t: .*; overspend: new input 1100 of 1000/);
  assert.doesNotMatch(out, /question/);
  assert.deepEqual(st.errors, []);
  const unnamed = scenario({ rounds: [{ ...approvedA, tokens: [500, 0, 10] }, finalRound({ tokens: [600, 0, 10] })], done: [{ time: T(11) }] });
  const st2 = taskState({ rounds: unnamed.rounds, spend: [], done: unnamed.records.done, task: "t", defaults: limits(1000, 1000), statement: fileOf(A) });
  assert.match(st2.errors.join("\n"), /does not name the overspend/);
});

test("[check.task-statement.budget-statement-over] a clean review of the statement past the budget blocks the start of work", () => {
  const sc = scenario({ rounds: [{ ...approvedA, tokens: [1200, 0, 10] }] });
  const out = state(sc, { statement: fileOf(A), defaults: limits(1000, 1000) });
  assert.match(out, /statement: approved, version [0-9a-f]{12}, but the budget is exhausted: a question to the owner; work may not start/);
  assert.match(out, /result: the budget is exhausted: a question to the owner/);
});

test("[check.task-statement.budget-after-change] an exhausted budget stops the round a changed statement would need", () => {
  const sc = scenario({ rounds: [{ ...approvedA, tokens: [1000, 0, 10] }] });
  assert.match(state(sc, { statement: fileOf(B), defaults: limits(1000, 1000) }), /statement: the budget is exhausted: a question to the owner/);
});

test("[check.task-statement.budget-executor-only] the executor's spend alone, with no round of the result, exhausts the budget", () => {
  const sc = scenario({ rounds: [{ ...approvedA, tokens: [0, 0, 0] }], spend: [{ start: T(10), end: T(11), tokens: [2000, 0, 10] }] });
  assert.match(state(sc, { statement: fileOf(A), defaults: limits(1000, 1000) }), /result: the budget is exhausted: a question to the owner/);
});

test("[check.task-statement.budget-converging] rounds that converge give a question when the budget is exhausted", () => {
  const rounds = scenario({
    rounds: [
      { step: "result-review", number: 1, ceiling: 1, time: T(9), found: 3 },
      { step: "result-review", number: 2, time: T(10), found: 2 },
    ],
  }).rounds;
  assert.equal(nextRound(rounds).next, "full");
  const n = nextRound(rounds, { exhausted: true });
  assert.equal(n.next, "budget");
  assert.match(n.say, /the budget is exhausted: a question to the owner/);
});

test("[check.task-result.clean-needs-acceptance] a round of the result clean on merging with no verdict of acceptance does not end the step, and with the budget exhausted the next action is the question, in --task and in --rounds", () => {
  const rounds = [{ ...approvedA, tokens: [600, 0, 10] }, finalRound({ acceptance: undefined, tokens: [600, 0, 10] })];
  const sc = scenario({ rounds, done: [{ time: T(11) }] });
  const rr = sc.rounds.filter((r) => r.step === "result-review");
  assert.equal(nextRound(rr).next, "acceptance");
  assert.match(nextRound(rr).say, /gives no verdict of acceptance yet: a round that gives it follows/);
  assert.equal(nextRound(rr, { exhausted: true }).next, "budget");
  // --task, within the budget and past it.
  assert.match(state(sc, { statement: fileOf(A), defaults: limits(10000, 10000) }), /result: the last round is clean on merging and gives no verdict of acceptance yet/);
  const spent = state(sc, { statement: fileOf(A), defaults: limits(1000, 1000) });
  assert.match(spent, /result: the budget is exhausted: a question to the owner/);
  assert.doesNotMatch(spent, /result: done|ended clean/);
  // --rounds, through the check, with the configuration's limits.
  const within = checkWith(sc, { budget: { newInput: 10000, output: 10000 } }, ["--rounds"]);
  assert.match(within.stdout, /ROUNDS t · result-review: 1 full, 0 narrow · next: the last round is clean on merging and gives no verdict of acceptance yet/);
  const past = checkWith(sc, { budget: { newInput: 1000, output: 1000 } }, ["--rounds"]);
  assert.match(past.stdout, /ROUNDS t · result-review: 1 full, 0 narrow · next: the budget is exhausted: a question to the owner/);
  assert.match(past.stdout, /ROUNDS t · statement-review: 1 full, 0 narrow · next: the step ended clean/);
  // With a clean verdict of acceptance the step ends clean, past the budget too.
  const accepted = scenario({ rounds: [{ ...approvedA, tokens: [600, 0, 10] }, finalRound({ tokens: [600, 0, 10] })], done: [{ time: T(11) }] });
  assert.match(checkWith(accepted, { budget: { newInput: 1000, output: 1000 } }, ["--rounds"]).stdout, /ROUNDS t · result-review: 1 full, 0 narrow · next: the step ended clean/);
  [sc, accepted].forEach((x) => rmSync(x.dir, { recursive: true, force: true }));
});

test("[check.task-result.acceptance-not-clean] a verdict of acceptance that finds an item not done makes the round not clean", () => {
  const sc = scenario({
    rounds: [approvedA, finalRound({ acceptance: ["- item not done · important · change · fixable · t.test.mjs"] })],
    done: [{ time: T(11) }],
  });
  assert.deepEqual(acceptanceProblems(sc.rounds, sc.records.done), []);
  assert.match(state(sc, { statement: fileOf(A) }), /result: round 2, within the ceiling of 2/);
  // The same round with acceptance clean ends the task.
  const clean = scenario({ rounds: [approvedA, finalRound()], done: [{ time: T(11) }] });
  assert.match(state(clean, { statement: fileOf(A) }), /result: done/);
});

// The check on a copy of the example, with the records of rounds and of a task in its configuration.
function checkWith(sc, extra = {}, args = []) {
  const cfgDir = mkdtempSync(join(tmpdir(), "task-cfg-"));
  cpSync(EXAMPLE, cfgDir, { recursive: true, filter: (src) => !src.startsWith(join(EXAMPLE, "releases")) });
  const cfgPath = join(cfgDir, "ont.config.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  writeFileSync(cfgPath, JSON.stringify({ ...cfg, reviewRounds: { dir: join(sc.dir, "rounds") }, taskRecords: { dir: join(sc.dir, "tasks") }, ...extra }));
  const r = spawnSync("node", [join(TOOLS, "ont-check.mjs"), "--config", cfgPath, ...args], { encoding: "utf8" });
  rmSync(cfgDir, { recursive: true, force: true });
  return r;
}

test("[check.task-result.acceptance-refused] acceptance with no record of done, before it, after a failed check or for another version is refused", () => {
  const approve = (task) => ({ ...approvedA, task });
  const accept = (task, hash = A) => finalRound({ task, hash });
  const sc = scenario({
    rounds: ["a", "b", "c", "d", "e"].flatMap((t) => [approve(t), accept(t)]).map((r, i) => (i === 9 ? { ...r, hash: B } : r)),
    done: [
      { task: "b", time: T(13) },
      { task: "c", time: T(11), result: "fail" },
      { task: "d", time: T(11) },
      { task: "e", time: T(11) },
    ],
  });
  const p = acceptanceProblems(sc.rounds, sc.records.done).join("\n");
  assert.match(p, /acceptance of a refused: there is no record of done/);
  assert.match(p, /acceptance of b refused: it was given before the record of done was made/);
  assert.match(p, /acceptance of c refused: the record of done d1\.md has a check that failed/);
  assert.match(p, /acceptance of e refused: it names another version of the statement/);
  assert.doesNotMatch(p, /acceptance of d /);
  const r = checkWith(sc);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /verdicts of acceptance refused \(4\)/);
  rmSync(sc.dir, { recursive: true, force: true });
});

test("[check.task-result.acceptance-bound] an acceptance is refused for a done of another commit, for an approval given after the done, for an approval withdrawn before it, and for a statement file of another version", () => {
  // The record of done is of commit "c…", the round reviewed "a…".
  const other = scenario({ rounds: [approvedA, finalRound()], done: [{ time: T(11), commit: "c".repeat(40) }] });
  assert.deepEqual(acceptanceProblems(other.rounds, other.records.done), ["r1.md: acceptance of t refused: the record of done d0.md is of commit ccccccc, not of the commit the round reviewed, aaaaaaa"]);
  assert.match(state(other, { statement: fileOf(A) }), /result: the verdict of acceptance of r1\.md is refused: the record of done d0\.md is of commit ccccccc/);
  assert.doesNotMatch(state(other, { statement: fileOf(A) }), /result: done/);
  // A round with no commit it reviewed.
  const none = scenario({ rounds: [approvedA, finalRound({ commits: null })], done: [{ time: T(11) }] });
  assert.match(acceptanceProblems(none.rounds, none.records.done).join("\n"), /names no commit it reviewed/);
  // Done at 11 and accepted at 12, under a round of the statement with findings at 10; A approved only at 13.
  const late = scenario({
    rounds: [
      { step: "statement-review", number: 1, ceiling: 2, time: T(10), hash: A, found: 1 },
      finalRound(),
      { step: "statement-review", number: 1, narrow: true, time: T(13), hash: A },
    ],
    done: [{ time: T(11) }],
  });
  assert.deepEqual(acceptanceProblems(late.rounds, late.records.done), ["r1.md: acceptance of t refused: the record of done d0.md was made with no approval in force for its version of the statement"]);
  // Approved at 9 and done at 11, the approval withdrawn by a round with findings at 11:30, accepted at 12.
  const withdrawn = scenario({ rounds: [approvedA, { step: "statement-review", number: 2, time: T(11, 30), hash: A, found: 1 }, finalRound()], done: [{ time: T(11) }] });
  assert.match(acceptanceProblems(withdrawn.rounds, withdrawn.records.done).join("\n"), /refused: no approval is in force for that version of the statement/);
  // Everything bound, but the statement's file is now version B.
  const bound = scenario({ rounds: [approvedA, finalRound()], done: [{ time: T(11) }] });
  assert.deepEqual(acceptanceProblems(bound.rounds, bound.records.done), []);
  assert.match(state(bound, { statement: fileOf(A) }), /result: done: the last round and its acceptance are clean/);
  const st = taskState({ rounds: bound.rounds, spend: [], done: bound.records.done, task: "t", defaults: limits(null, null), statement: fileOf(B) });
  assert.doesNotMatch(st.lines.join("\n"), /result: done/);
  [other, none, late, withdrawn, bound].forEach((sc) => rmSync(sc.dir, { recursive: true, force: true }));
});

test("[check.task-spend.overlap] one session recorded over intervals that overlap is an error, and a record that begins after it ends is not summed", () => {
  const sc = scenario({
    rounds: [
      { ...approvedA, contribution: "openai · s1", start: T(10, 15), time: T(10, 45), tokens: [100, 0, 10] },
      { ...approvedA, number: 2, contribution: "openai · s9", start: T(12), time: T(11), tokens: [5000, 0, 10] },
    ],
    spend: [
      { contribution: "openai · s1", start: T(10), end: T(10, 30), tokens: [100, 0, 10] },
      { contribution: "openai · s2", start: T(12), end: T(11), tokens: [7000, 0, 10] },
      // Touching intervals of one session do not overlap.
      { contribution: "openai · s1", start: T(10, 45), end: T(11), tokens: [1, 0, 1] },
    ],
  });
  assert.equal(overlaps(sc.rounds, sc.records.spend).length, 1);
  assert.match(overlaps(sc.rounds, sc.records.spend)[0], /r0\.md .* and s0\.md .*: one contribution, openai · s1, over intervals that overlap/);
  assert.match(sc.malformed.join("\n"), /r1\.md: start .* is after its time/);
  assert.match(sc.records.malformed.join("\n"), /s1\.md: start .* is after its end/);
  // The overlapping pair is not summed twice: the spend is refused and the stop holds (D-118).
  const b = taskBudget({ rounds: sc.rounds, spend: sc.records.spend, task: "t", defaults: limits(10 ** 6, 10 ** 6) });
  assert.equal(b.used, null);
  assert.equal(b.conflict.length, 1);
  assert.equal(b.exhausted, true);
  const r = checkWith(sc, {}, ["--task", "t"]);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /contributions recorded twice over intervals that overlap \(1\)/);
  assert.match(r.stdout, /task records that cannot be read \(1\)/);
  assert.match(r.stdout, /review round records that cannot be read \(1\)/);
  rmSync(sc.dir, { recursive: true, force: true });
});

test("[check.task-spend.overlap-not-summed] two records of one session with equal start and end in one second overlap, and an overlap refuses the sum and stops the next step", () => {
  const sc = scenario({
    rounds: [{ ...approvedA, tokens: [0, 0, 0] }],
    spend: [
      { contribution: "openai · s1", start: T(10), end: T(10), tokens: [400, 0, 10] },
      { contribution: "openai · s1", start: T(10), end: T(10), tokens: [400, 0, 10] },
    ],
  });
  assert.equal(overlaps(sc.rounds, sc.records.spend).length, 1);
  const out = state(sc, { statement: fileOf(A), defaults: limits(1000, 1000) });
  assert.match(out, /BUDGET t: the spend cannot be summed, 1 pair of records of one contribution overlap: s0\.md .* and s1\.md .*; the budget is exhausted: a question to the owner, until the records are corrected/);
  assert.match(out, /result: the budget is exhausted: a question to the owner/);
  assert.doesNotMatch(out, /new input 800|new input 400/);
  // One record of the session alone is summed once and leaves the budget open.
  const one = scenario({ rounds: [{ ...approvedA, tokens: [0, 0, 0] }], spend: [{ contribution: "openai · s1", start: T(10), end: T(10), tokens: [400, 0, 10] }] });
  assert.match(state(one, { statement: fileOf(A), defaults: limits(1000, 1000) }), /BUDGET t: new input 400 of 1000 × 1 = 1000/);
  assert.match(state(one, { statement: fileOf(A), defaults: limits(1000, 1000) }), /result: the executor works/);
  [sc, one].forEach((x) => rmSync(x.dir, { recursive: true, force: true }));
});

test("[check.task-result.done-commands] an acceptance is refused when the record of done ran other commands than the statement's commands of done", () => {
  const text = "version C\nDone-when: false\n";
  const C = sha256(text);
  const sc = scenario({ rounds: [{ ...approvedA, hash: C }, finalRound({ hash: C })], done: [{ time: T(11), hash: C, command: "true" }] });
  writeFileSync(join(sc.dir, "statement.md"), text);
  const r = checkWith(sc, {}, ["--task", "t", "--statement", join(sc.dir, "statement.md")]);
  assert.match(r.stdout, /TASK t · result: the verdict of acceptance of r1\.md is refused: the commands of the record of done d0\.md, "true", are not the statement's commands of done, "false"/);
  assert.doesNotMatch(r.stdout, /result: done/);
  // The same record against a statement whose command of done is the one it ran is done.
  const same = scenario({ rounds: [approvedA, finalRound()], done: [{ time: T(11) }] });
  writeFileSync(join(same.dir, "statement.md"), A_TEXT);
  assert.match(checkWith(same, {}, ["--task", "t", "--statement", join(same.dir, "statement.md")]).stdout, /TASK t · result: done: the last round and its acceptance are clean/);
  [sc, same].forEach((x) => rmSync(x.dir, { recursive: true, force: true }));
});

test("[check.task-result.rounds-agree] with no record of done, --rounds and --task both refuse the verdict of acceptance and neither calls the step clean", () => {
  const sc = scenario({ rounds: [approvedA, finalRound()] });
  const rounds = checkWith(sc, {}, ["--rounds"]);
  assert.equal(rounds.status, 1, rounds.stdout);
  assert.match(rounds.stdout, /verdicts of acceptance refused \(1\):\n  r1\.md: acceptance of t refused: there is no record of done/);
  assert.match(rounds.stdout, /ROUNDS t · result-review: 1 full, 0 narrow · next: the verdict of acceptance of r1\.md is refused: there is no record of done; the result needs a verdict of acceptance that holds/);
  assert.doesNotMatch(rounds.stdout, /result-review: .* next: the step ended clean/);
  assert.match(state(sc, { statement: fileOf(A) }), /result: the verdict of acceptance of r1\.md is refused: there is no record of done/);
  // Past the budget, both give the stop.
  const past = checkWith(sc, { budget: { newInput: 0, output: 0 } }, ["--rounds"]);
  assert.match(past.stdout, /ROUNDS t · result-review: .* next: the verdict of acceptance of r1\.md is refused: there is no record of done; the budget is exhausted: a question to the owner/);
  rmSync(sc.dir, { recursive: true, force: true });
});

test("[check.task-spend.overlap-across-tasks] records of one session that overlap across two tasks stop the budget of each, as the check finds them", () => {
  const sc = scenario({
    rounds: [{ ...approvedA, tokens: [0, 0, 0] }, { ...approvedA, task: "u", tokens: [0, 0, 0] }],
    spend: [
      { task: "t", contribution: "openai · s1", start: T(10), end: T(11), tokens: [100, 0, 10] },
      { task: "u", contribution: "openai · s1", start: T(10, 30), end: T(11, 30), tokens: [100, 0, 10] },
    ],
  });
  for (const task of ["t", "u"]) {
    const st = taskState({ rounds: sc.rounds, spend: sc.records.spend, done: [], task, defaults: limits(100000, 100000), statement: fileOf(A) });
    const out = st.lines.join("\n");
    assert.match(out, new RegExp(`BUDGET ${task}: the spend cannot be summed, 1 pair of records of one contribution overlap: s0\\.md .*task t\\) and s1\\.md .*task u\\): one contribution, openai · s1`));
    assert.match(out, /result: the budget is exhausted: a question to the owner/);
    assert.doesNotMatch(out, /new input 100|new input 200|work may start/);
  }
  const r = checkWith(sc, { budget: { newInput: 100000, output: 100000 } }, ["--task", "t", "--rounds"]);
  assert.match(r.stdout, /contributions recorded twice over intervals that overlap \(1\)/);
  assert.match(r.stdout, /BUDGET t: the spend cannot be summed/);
  assert.match(r.stdout, /ROUNDS t · statement-review: 1 full, 0 narrow · next: the step ended clean/);
  rmSync(sc.dir, { recursive: true, force: true });
});

test("[check.task-statement.budget-one-action] after a round of the result with the budget spent, --task names one next action, the stop", () => {
  const sc = scenario({ rounds: [{ ...approvedA, tokens: [600, 0, 10] }, { step: "result-review", number: 1, ceiling: 2, time: T(12), found: 1, tokens: [600, 0, 10] }] });
  const out = state(sc, { statement: fileOf(A), defaults: limits(1000, 1000) });
  assert.match(out, /statement: approved, version [0-9a-f]{12}, but the budget is exhausted: a question to the owner; work may not go on/);
  assert.match(out, /result: the budget is exhausted: a question to the owner/);
  assert.doesNotMatch(out, /work may (start|go on) under it|round 2/);
  // Within the budget, the same rounds let work go on, and the next is round 2.
  const within = state(sc, { statement: fileOf(A), defaults: limits(10000, 10000) });
  assert.match(within, /statement: approved, version [0-9a-f]{12}: work may go on under it/);
  assert.match(within, /result: round 2, within the ceiling of 2/);
  rmSync(sc.dir, { recursive: true, force: true });
});

test("[check.task-statement.budget-executor-no-round] the executor's spend past the limit with no round at all, through the check, is the stop", () => {
  const sc = scenario({ spend: [{ start: T(10), end: T(11), tokens: [2000, 0, 10] }] });
  assert.equal(sc.rounds.length, 0);
  const r = checkWith(sc, { budget: { newInput: 1000, output: 1000 } }, ["--task", "t"]);
  assert.match(r.stdout, /TASK t · statement: the budget is exhausted: a question to the owner/);
  assert.match(r.stdout, /TASK t · result: work is not allowed/);
  assert.match(r.stdout, /BUDGET t: new input 2000 of 1000 × 1 = 1000, output 10 of 1000 × 1 = 1000; known for 1 of 1 contributions; .*overspend: new input 2000 of 1000/);
  rmSync(sc.dir, { recursive: true, force: true });
});

test("[check.task-statement.budget-final-over] through the check, --task fails when the record of acceptance does not name the overspend", () => {
  const sc = scenario({ rounds: [{ ...approvedA, tokens: [500, 0, 10] }, finalRound({ tokens: [600, 0, 10] })], done: [{ time: T(11) }] });
  // A file whose SHA-256 is version A's.
  writeFileSync(join(sc.dir, "statement.md"), A_TEXT);
  const r = checkWith(sc, { budget: { newInput: 1000, output: 1000 } }, ["--task", "t", "--statement", join(sc.dir, "statement.md")]);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /TASK t · result: done, with an overspend/);
  assert.match(r.stdout, /task records that do not say what --task found \(1\)/);
  rmSync(sc.dir, { recursive: true, force: true });
});

// done.mjs in a repository of its own, the statement outside it.
const git = (cwd, ...a) => {
  const r = spawnSync("git", ["-C", cwd, ...a], { encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.org", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.org" } });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};

test("[check.task-result.done-recorded] done.mjs records done only under an approval in force and when every command passes on the commit", () => {
  const repo = mkdtempSync(join(tmpdir(), "done-repo-"));
  const outside = mkdtempSync(join(tmpdir(), "done-statement-"));
  try {
    git(repo, "init", "-q", "-b", "main");
    mkdirSync(join(repo, "rounds"));
    mkdirSync(join(repo, "tasks"));
    writeFileSync(join(repo, "ont.config.json"), JSON.stringify({ classes: { ent: "Entity" }, ontology: "ontology.md", reviewRounds: { dir: "rounds" }, taskRecords: { dir: "tasks" } }));
    writeFileSync(join(repo, "committed.txt"), "x");
    writeFileSync(join(repo, ".gitignore"), "rounds/\ntasks/\n");
    git(repo, "add", ".");
    git(repo, "commit", "-q", "-m", "first");
    const head = git(repo, "rev-parse", "HEAD");
    // A file in the work tree only: the commands run on the commit, where it is not.
    writeFileSync(join(repo, "uncommitted.txt"), "y");
    const pass = join(outside, "pass.md");
    writeFileSync(pass, "# A statement\n\nDone-when: test -f committed.txt\nDone-when: test ! -f uncommitted.txt\n");
    const fail = join(outside, "fail.md");
    writeFileSync(fail, "# Another\n\nDone-when: test -f missing.txt\n");
    const loose = join(outside, "loose.md");
    writeFileSync(loose, "# Not reviewed\n\nDone-when: true\n");
    const approve = (file, number, time) => writeFileSync(join(repo, "rounds", `${number}.md`), roundText({ task: "t", step: "statement-review", number, ceiling: number === 1 ? 2 : undefined, time, hash: readStatement(file).hash }));
    const done = (file) => spawnSync("node", [join(TOOLS, "done.mjs"), "t", "--statement", file, "--config", join(repo, "ont.config.json")], { encoding: "utf8" });
    approve(pass, 1, T(9));
    const ok = done(pass);
    assert.equal(ok.status, 0, ok.stdout);
    const files = readdirSync(join(repo, "tasks"));
    assert.equal(files.length, 1);
    const rec = readFileSync(join(repo, "tasks", files[0]), "utf8");
    assert.match(rec, new RegExp(`Commit: ${head}`));
    assert.match(rec, new RegExp(`Statement-hash: ${readStatement(pass).hash}`));
    assert.match(rec, /- test -f committed\.txt · pass\n- test ! -f uncommitted\.txt · pass/);
    assert.equal(parseTaskRecords(join(repo, "tasks")).done.length, 1);
    approve(fail, 2, T(10));
    const bad = done(fail);
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /no record of done written: 1 of 1 commands of done failed/);
    const unapproved = done(loose);
    assert.equal(unapproved.status, 1);
    assert.match(unapproved.stdout, /the approval in force is for version/);
    assert.equal(readdirSync(join(repo, "tasks")).length, 1);
    assert.equal(git(repo, "worktree", "list").split("\n").length, 1);
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

// A repository with an approved statement for a task, the statement outside it (done.mjs).
function doneRepo(task) {
  const repo = mkdtempSync(join(tmpdir(), "done-repo-"));
  const outside = mkdtempSync(join(tmpdir(), "done-statement-"));
  git(repo, "init", "-q", "-b", "main");
  mkdirSync(join(repo, "rounds"));
  mkdirSync(join(repo, "tasks"));
  writeFileSync(join(repo, "ont.config.json"), JSON.stringify({ classes: { ent: "Entity" }, ontology: "ontology.md", reviewRounds: { dir: "rounds" }, taskRecords: { dir: "tasks" } }));
  writeFileSync(join(repo, ".gitignore"), "rounds/\ntasks/\n");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "first");
  const statement = join(outside, "s.md");
  writeFileSync(statement, "# A statement\n\nDone-when: true\n");
  writeFileSync(join(repo, "rounds", "1.md"), roundText({ task, step: "statement-review", number: 1, ceiling: 2, time: T(9), hash: readStatement(statement).hash }));
  const done = (name, env = process.env) => spawnSync("node", [join(TOOLS, "done.mjs"), name, "--statement", statement, "--config", join(repo, "ont.config.json")], { encoding: "utf8", env });
  const clean = () => [repo, outside].forEach((d) => rmSync(d, { recursive: true, force: true }));
  return { repo, outside, done, clean };
}

test("[check.task-result.task-name] done.mjs refuses a task that is not lower-case letters, digits and hyphens, and the records refuse one", () => {
  const { repo, outside, done, clean } = doneRepo("Big Task");
  try {
    for (const name of ["Big Task", "../escape", "a/b"]) {
      const r = done(name);
      assert.equal(r.status, 1, r.stdout);
      assert.match(r.stdout, /no record of done written: the task .* is not lower-case letters, digits and hyphens/);
    }
    assert.deepEqual(readdirSync(join(repo, "tasks")), []);
    assert.deepEqual(readdirSync(outside), ["s.md"]);
    // A round or a record of done that names such a task is malformed.
    assert.match(parseRounds(join(repo, "rounds")).malformed.join("\n"), /task Big Task is not lower-case letters, digits and hyphens/);
    writeFileSync(join(repo, "tasks", "d.md"), doneText({ task: "../x", time: T(10) }));
    assert.match(parseTaskRecords(join(repo, "tasks")).malformed.join("\n"), /task \.\.\/x is not lower-case letters, digits and hyphens/);
  } finally {
    clean();
  }
});

test("[check.task-result.git-env-of-hook] the variables Git sets for a hook of another repository do not reach a git command in this one", () => {
  // Every variable Git names as local to a repository is dropped; the others stay.
  const local = spawnSync("git", ["rev-parse", "--local-env-vars"], { encoding: "utf8" }).stdout.split("\n").filter(Boolean);
  const given = Object.fromEntries([...local, "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0"].map((k) => [k, "x"]));
  const kept = gitEnv({ ...given, GIT_AUTHOR_NAME: "t", PATH: "/bin" });
  assert.deepEqual(Object.keys(kept).sort(), ["GIT_AUTHOR_NAME", "PATH"]);
  // done.mjs run from a hook of another repository whose configuration makes a repository bare.
  const { repo, done, clean } = doneRepo("t");
  const other = mkdtempSync(join(tmpdir(), "other-repo-"));
  try {
    git(other, "init", "-q");
    const hook = { GIT_DIR: join(other, ".git"), GIT_INDEX_FILE: join(other, ".git", "index"), GIT_ALTERNATE_OBJECT_DIRECTORIES: join(other, ".git", "objects") };
    for (const extra of [{ GIT_CONFIG_PARAMETERS: "'core.bare'='true'" }, { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.bare", GIT_CONFIG_VALUE_0: "true" }]) {
      const r = done("t", { ...process.env, ...hook, ...extra });
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /^DONE t: 1 commands passed on [0-9a-f]{7}/);
    }
    assert.equal(readdirSync(join(repo, "tasks")).length >= 1, true);
  } finally {
    clean();
    rmSync(other, { recursive: true, force: true });
  }
});
