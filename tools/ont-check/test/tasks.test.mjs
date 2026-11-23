// A task's statement and its approval, acceptance after done (D-152) and the task's budget (D-108).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { nextRound, parseRounds } from "../review-rounds.mjs";
import { TASK_BRANCHES, acceptanceProblems, budgetLines, gitEnv, overlaps, parseTaskRecords, readRoundRecords, readStatement, readTaskInputs, reserveOf, resolveRecords, sha256, stepNext, taskBudget, taskIds, taskNext, taskState } from "../tasks.mjs";
import { loadConfig } from "../lib.mjs";

const TOOLS = fileURLToPath(new URL("../", import.meta.url));
const EXAMPLE = fileURLToPath(new URL("../../../example/", import.meta.url));
// Version A of a statement: its one command of done is the one the records of done here ran.
const A_TEXT = "version A\nDone-when: npm test\n";
const A = sha256(A_TEXT);
// Version B of a statement, a file with its command of done as A has.
const B = sha256("version B\nDone-when: npm test\n");
// A time after every record done.mjs writes now, which it stamps with the clock: a later approval of
// another version at a fixture's time would make those records late (D-152).
const FUTURE = (h) => `2099-01-01T${String(h).padStart(2, "0")}:00:00Z`;
const T = (h, m = 0) => `2026-11-20T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;
// A repository whose three commits the records here name: every commit a record names resolves in the
// project's repository (inv.named-commits-resolve, D-143), and the check runs in it.
const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.org", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.org" };
const REPO = mkdtempSync(join(tmpdir(), "task-repo-"));
after(() => rmSync(REPO, { recursive: true, force: true }));
const inRepo = (...a) => spawnSync("git", ["-C", REPO, ...a], { encoding: "utf8", env: GIT_ENV }).stdout.trim();
inRepo("init", "-q", "-b", "main");
const [CB, CA, CC] = ["b", "a", "c"].map((m) => (inRepo("commit", "-q", "--allow-empty", "-m", m), inRepo("rev-parse", "HEAD")));
const finding = (i, test = "t.test.mjs", prefix = "class", fix = "fixable") => `- ${prefix} ${i} · important · change · ${fix}${test ? ` · ${test}` : ""}`;

// A record of a round: its fields, then its findings, then its verdict of acceptance.
const roundText = ({ task = "t", step = "statement-review", number = 1, narrow, prefix = "class", fix = "fixable", start, time, hash, found = 0, tokens, contribution, acceptance, overspend, untested, commits, condition, extra = [] }) =>
  [
    `Task: ${task}`,
    `Step: ${step}`,
    ...(narrow ? ["Narrow: true"] : []),
    `Number: ${number}`,
    ...(start ? [`Start: ${start}`] : []),
    `Time: ${time}`,
    `By: a model (a provider)`,
    ...(commits ? [`Commits: ${commits}`] : []),
    ...(contribution ? [`Contribution: ${contribution}`] : []),
    ...(hash ? [`Statement-hash: ${hash}`] : []),
    ...(tokens ? [`Tokens-new: ${tokens[0]}`, `Tokens-cached: ${tokens[1]}`, `Tokens-out: ${tokens[2]}`] : []),
    ...(overspend ? [`Overspend: ${overspend}`] : []),
    ...(condition ? ["Condition: holds"] : []),
    ...(found || extra.length ? ["Findings:", ...Array.from({ length: found }, (_, i) => finding(i, untested || fix !== "fixable" ? null : "t.test.mjs", prefix, fix)), ...extra] : []),
    ...(acceptance === undefined ? [] : acceptance === "clean" ? ["Acceptance: clean"] : ["Acceptance:", ...acceptance]),
    "",
  ].join("\n");
const spendText = ({ task = "t", contribution = "a provider · run-1", start, end, tokens = [0, 0, 0] }) =>
  [`Record: spend`, `Task: ${task}`, `Contribution: ${contribution}`, `Start: ${start}`, `End: ${end}`, `Tokens-new: ${tokens[0]}`, `Tokens-cached: ${tokens[1]}`, `Tokens-out: ${tokens[2]}`, ""].join("\n");
const doneText = ({ task = "t", hash = A, time, result = "pass", commit = CA, command = "npm test", budget }) =>
  [`Record: done`, `Task: ${task}`, `Commit: ${commit}`, `Statement-hash: ${hash}`, ...(budget ? [`Budget-new-input: ${budget[0]}`, `Budget-output: ${budget[1]}`, ...(budget[2] === undefined ? [] : [`Budget-reserve: ${budget[2]}`])] : []), `Time: ${time}`, `Checks:`, `- ${command} · ${result}`, ""].join("\n");

// Writes the records into two directories and reads them as the check does.
const approvalText = ({ task = "t", hash = A, by = "owner", source = '"1007 a", the owner, 2026-11-20', time }) =>
  [`Record: approval`, `Task: ${task}`, `Statement-hash: ${hash}`, ...(by === null ? [] : [`By: ${by}`]), ...(source === null ? [] : [`Source: ${source}`]), `Time: ${time}`, ""].join("\n");
function scenario({ rounds = [], spend = [], done = [], approvals = [] }) {
  const dir = mkdtempSync(join(tmpdir(), "task-"));
  mkdirSync(join(dir, "rounds"));
  mkdirSync(join(dir, "tasks"));
  rounds.forEach((r, i) => writeFileSync(join(dir, "rounds", `r${i}.md`), roundText(r)));
  spend.forEach((s, i) => writeFileSync(join(dir, "tasks", `s${i}.md`), spendText(s)));
  done.forEach((d, i) => writeFileSync(join(dir, "tasks", `d${i}.md`), doneText(d)));
  approvals.forEach((a, i) => writeFileSync(join(dir, "tasks", `a${i}.md`), approvalText(a)));
  const r = parseRounds(join(dir, "rounds"));
  const t = parseTaskRecords(join(dir, "tasks"));
  return { dir, ...r, records: t };
}
const state = (sc, { statement = null, defaults = { newInput: null, output: null, reserve: null } } = {}) =>
  taskState({ rounds: sc.rounds, spend: sc.records.spend, done: sc.records.done, approvals: sc.records.approvals, task: "t", defaults, statement }).lines.join("\n");
const fileOf = (hash) => ({ hash, doneWhen: ["npm test"], budget: { newInput: null, output: null } });
const approvedA = { step: "statement-review", number: 1, time: T(9), hash: A };

test("[check.task-statement.needs-review] a task with no round of the review of its statement needs one", () => {
  assert.match(state(scenario({})), /NEXT t: it needs a review of the statement/);
});

test("[check.task-statement.findings-next] after a round of the statement with findings, the next round is what derived.next-round says", () => {
  const sc = scenario({ rounds: [{ ...approvedA, found: 2 }] });
  assert.match(state(sc, { statement: fileOf(A) }), /NEXT t: narrow round 1, on the fixes of the last round/);
});

test("[check.task-statement.changed-after-approval] a statement edited after a clean round needs a full round of the new version with the next free number, after any number of rounds", () => {
  const sc = scenario({ rounds: [approvedA] });
  const out = state(sc, { statement: fileOf(B) });
  assert.match(out, /NEXT t: the statement changed after its approval: next is full round 2 of the new version$/m);
  assert.match(out, /result: work is not allowed/);
  // Eight full rounds and four narrow ones, the last clean: full round 9, never a question.
  const many = [
    ...Array.from({ length: 8 }, (_, i) => ({ step: "statement-review", number: i + 1, time: T(1 + i), hash: A, found: 10 - i })),
    ...Array.from({ length: 4 }, (_, i) => ({ step: "statement-review", number: i + 1, narrow: true, time: T(10 + i), hash: A, found: i === 3 ? 0 : 1 })),
  ];
  const after = state(scenario({ rounds: many }), { statement: fileOf(B) });
  assert.match(after, /NEXT t: the statement changed after its approval: next is full round 9 of the new version/);
  assert.doesNotMatch(after, /question/);
});

test("[check.task-statement.later-version-findings] a full round of version B with findings after a clean narrow round of A: no work, no acceptance for A, the next round from B", () => {
  const rounds = [
    { step: "statement-review", number: 1, time: T(9), hash: A, found: 2 },
    { step: "statement-review", number: 1, narrow: true, time: T(10), hash: A },
    { step: "statement-review", number: 2, time: T(11), hash: B, found: 2 },
    { step: "result-review", number: 1, time: T(13), hash: A, acceptance: "clean" },
  ];
  const sc = scenario({ rounds, done: [{ hash: A, time: T(12) }] });
  const out = state(sc, { statement: fileOf(B) });
  assert.match(out, /NEXT t: narrow round 2, on the fixes of the last round/);
  assert.doesNotMatch(out, /ended clean|approved/);
  assert.match(out, /result: work is not allowed/);
  assert.deepEqual(acceptanceProblems(sc.rounds, sc.records.done), ["r3.md: acceptance of t refused: the record of done d0.md was made with no approval in force for its version of the statement"]);
  // Ordered full rounds first, the clean narrow round would have ended the step: by time it does not.
  assert.notEqual(nextRound(sc.rounds.filter((r) => r.step === "statement-review")).next, "clean");
});

test("[check.task-statement.approved] a clean round of the version in the file lets work start", () => {
  const out = state(scenario({ rounds: [approvedA] }), { statement: fileOf(A) });
  assert.match(out, /statement: approved, version [0-9a-f]{12}\n/);
  assert.match(out, /NEXT t: the executor works under version [0-9a-f]{12}, then records done/);
  // Without the file the version cannot be compared, and no work is allowed.
  assert.match(state(scenario({ rounds: [approvedA] })), /work is not allowed[\s\S]*NEXT t: give --statement <file>/);
});

test("[check.review-round.by-time] the last round by time decides the step, not the narrow rounds after the full ones", () => {
  const rounds = parseRounds(
    scenario({
      rounds: [
        { step: "statement-review", number: 1, time: T(9), hash: A, found: 1 },
        { step: "statement-review", number: 1, narrow: true, time: T(10), hash: A },
        { step: "statement-review", number: 2, time: T(11), hash: B, found: 2 },
      ],
    }).dir + "/rounds",
  ).rounds;
  // The clean narrow round of A ended the step; the full round of B is the first after it, its finding
  // tested: narrow round 2, the next free number.
  const n = nextRound(rounds);
  assert.equal(n.next, "narrow");
  assert.equal(n.number, 2);
});

test("[check.review-round.numbers-go-on] a next narrow round takes the next free number over every narrow round of the step", () => {
  const base = [
    { step: "statement-review", number: 1, time: T(8), hash: A, found: 3 },
    { step: "statement-review", number: 2, time: T(9), hash: A, found: 3 },
    { step: "statement-review", number: 1, narrow: true, time: T(10), hash: A, found: 2 },
    { step: "statement-review", number: 2, narrow: true, time: T(11), hash: A },
    { step: "statement-review", number: 3, time: T(12), hash: B, found: 3 },
  ];
  const n = nextRound(scenario({ rounds: base }).rounds);
  assert.equal(n.next, "narrow");
  assert.equal(n.number, 3);
  assert.match(n.say, /narrow round 3/);
  // Narrow round 3 of B with fewer important classes of other names: narrow round 4, no ceiling of three.
  const four = nextRound(scenario({ rounds: [...base, { step: "statement-review", number: 3, narrow: true, time: T(13), hash: B, found: 2, prefix: "other" }] }).rounds);
  assert.deepEqual([four.next, four.number], ["narrow", 4]);
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
  assert.match(ok, /BUDGET t: new input 900 of 1000 × 1 = 1000, output 200 of 1000 × 1 = 1000; known for 2 of 2 contributions; neither Budget-reserve: of the statement nor budget.reserve is set, so the reserve is 1/);
  assert.match(ok, /NEXT t: the executor works/);
  // budget.newInput moves the stop.
  assert.match(state(sc, { statement: fileOf(A), defaults: limits(900, 1000) }), /NEXT t: (.*: )?the budget is exhausted: a question to the owner/);
  // With a reserve of 2 a limit of 500 stops at 1000.
  const reserved = state(sc, { statement: fileOf(A), defaults: limits(500, 1000, 2) });
  assert.match(reserved, /new input 900 of 500 × 2 = 1000/);
  assert.match(reserved, /NEXT t: the executor works/);
  // The statement's own limit replaces the configuration's.
  assert.match(state(sc, { statement: { hash: A, doneWhen: ["npm test"], budget: { newInput: 800, output: null } }, defaults: limits(1000, 1000) }), /new input 900 of 800[\s\S]*; exhausted|exhausted/);
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
const finalRound = (extra = {}) => ({ step: "result-review", number: 1, time: T(12), hash: A, acceptance: "clean", commits: `${CB.slice(0, 7)}..${CA.slice(0, 7)}`, ...extra });

test("[check.task-statement.budget-final-exact] a clean final round that spends the budget exactly ends the task with no question and no overspend", () => {
  const sc = scenario({ rounds: [{ ...approvedA, tokens: [500, 0, 10] }, finalRound({ tokens: [500, 0, 10] })], done: [{ time: T(11) }] });
  const out = state(sc, { statement: fileOf(A), defaults: limits(1000, 1000) });
  assert.match(out, /NEXT t: done: the last round and its acceptance are clean/);
  assert.doesNotMatch(out, /question|overspend/);
});

test("[check.task-statement.budget-final-over] a clean final round past the budget ends the task and says the overspend, which its record must name", () => {
  const named = scenario({ rounds: [{ ...approvedA, tokens: [500, 0, 10] }, finalRound({ tokens: [600, 0, 10], overspend: "new input 1100 of 1000, output 20 of 1000" })], done: [{ time: T(11) }] });
  const st = taskState({ rounds: named.rounds, spend: [], done: named.records.done, task: "t", defaults: limits(1000, 1000), statement: fileOf(A) });
  const out = st.lines.join("\n");
  assert.match(out, /NEXT t: done, with an overspend: new input 1100 of 1000, output 20 of 1000; report it to the owner/);
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
  assert.match(out, /statement: approved, version [0-9a-f]{12}\n/);
  assert.match(out, /NEXT t: (.*: )?the budget is exhausted: a question to the owner/);
});

test("[check.task-statement.budget-after-change] an exhausted budget stops the round a changed statement would need", () => {
  const sc = scenario({ rounds: [{ ...approvedA, tokens: [1000, 0, 10] }] });
  assert.match(state(sc, { statement: fileOf(B), defaults: limits(1000, 1000) }), /NEXT t: (.*: )?the budget is exhausted: a question to the owner/);
});

test("[check.task-statement.budget-executor-only] the executor's spend alone, with no round of the result, exhausts the budget", () => {
  const sc = scenario({ rounds: [{ ...approvedA, tokens: [0, 0, 0] }], spend: [{ start: T(10), end: T(11), tokens: [2000, 0, 10] }] });
  assert.match(state(sc, { statement: fileOf(A), defaults: limits(1000, 1000) }), /NEXT t: (.*: )?the budget is exhausted: a question to the owner/);
});

test("[check.task-statement.budget-converging] rounds that converge give a question when the budget is exhausted", () => {
  const rounds = scenario({
    rounds: [
      { step: "result-review", number: 1, time: T(9), found: 3 },
      { step: "result-review", number: 2, time: T(10), found: 2, prefix: "other" },
    ],
  }).rounds;
  assert.equal(nextRound(rounds).next, "narrow");
  // The task's next action, with the budget exhausted, is the question, ahead of the converging step.
  const n = taskNext({ rounds, spend: [{ task: "t", contribution: "a · 1", start: T(8), end: T(8), tokens: { new: 2000, cached: 0, out: 0 } }], task: "t", defaults: limits(1000, 1000) });
  assert.equal(n.branch, "budget question");
  assert.equal(n.say, "the budget is exhausted: a question to the owner");
});

test("[check.task-result.clean-needs-acceptance] a round of the result clean on merging with no verdict of acceptance does not end the step, and with the budget exhausted the next action is the question, in --task and in --rounds", () => {
  const rounds = [{ ...approvedA, tokens: [600, 0, 10] }, finalRound({ acceptance: undefined, tokens: [600, 0, 10] })];
  const sc = scenario({ rounds, done: [{ time: T(11) }] });
  const rr = sc.rounds.filter((r) => r.step === "result-review");
  assert.equal(nextRound(rr).next, "acceptance");
  assert.match(nextRound(rr).say, /gives no verdict of acceptance yet: a round that gives it follows/);
  // --task, within the budget and past it.
  assert.match(state(sc, { statement: fileOf(A), defaults: limits(10000, 10000) }), /NEXT t: the last round is clean on merging and gives no verdict of acceptance yet/);
  const spent = state(sc, { statement: fileOf(A), defaults: limits(1000, 1000) });
  assert.match(spent, /NEXT t: (.*: )?the budget is exhausted: a question to the owner/);
  assert.doesNotMatch(spent, /NEXT t: done|ended clean/);
  // --rounds, through the check, with the configuration's limits.
  const within = checkWith(sc, { budget: { newInput: 10000, output: 10000 } }, ["--rounds"]);
  assert.match(within.stdout, /NEXT t: the last round is clean on merging and gives no verdict of acceptance yet/);
  const past = checkWith(sc, { budget: { newInput: 1000, output: 1000 } }, ["--rounds"]);
  assert.match(past.stdout, /NEXT t: (.*: )?the budget is exhausted: a question to the owner/);
  assert.match(past.stdout, /ROUNDS t · statement-review: 1 full, 0 narrow\n/);
  // The state of the result in --rounds is --task's, never clean while its acceptance is absent.
  for (const out of [within.stdout, past.stdout]) {
    assert.match(out, /TASK t · result: the last round of its review, r1\.md, is clean on merging, with no verdict of acceptance\n/);
    assert.doesNotMatch(out, /result-review.*clean|step ended clean|NEXT t: done/);
  }
  assert.equal(past.stdout.split("\n").filter((l) => l.startsWith("NEXT t:")).length, 1);
  // With a clean verdict of acceptance the step ends clean, past the budget too.
  const accepted = scenario({ rounds: [{ ...approvedA, tokens: [600, 0, 10] }, finalRound({ tokens: [600, 0, 10] })], done: [{ time: T(11) }] });
  assert.match(checkWith(accepted, { budget: { newInput: 1000, output: 1000 } }, ["--rounds"]).stdout, /NEXT t: done/);
  [sc, accepted].forEach((x) => rmSync(x.dir, { recursive: true, force: true }));
});

test("[check.task-result.acceptance-not-clean] a verdict of acceptance that finds an item not done makes the round not clean", () => {
  const sc = scenario({
    rounds: [approvedA, finalRound({ acceptance: ["- item not done · important · change · fixable · t.test.mjs"] })],
    done: [{ time: T(11) }],
  });
  assert.deepEqual(acceptanceProblems(sc.rounds, sc.records.done), []);
  assert.match(state(sc, { statement: fileOf(A) }), /NEXT t: narrow round 1, on the fixes of the last round/);
  // The same round with acceptance clean ends the task.
  const clean = scenario({ rounds: [approvedA, finalRound()], done: [{ time: T(11) }] });
  assert.match(state(clean, { statement: fileOf(A) }), /NEXT t: done/);
});

// The check on a copy of the example, with the records of rounds and of a task in its configuration.
function checkWith(sc, extra = {}, args = []) {
  const cfgDir = mkdtempSync(join(REPO, "task-cfg-"));
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
  // Through the check, e's round, which names B after A's approval, is late: a record that cannot be
  // read, never compared with a record of done (D-152).
  const r = checkWith(sc);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /verdicts of acceptance refused \(3\)/);
  assert.match(r.stdout, /r9\.md: a late record: it names version [0-9a-f]{12}, after version [0-9a-f]{12} was approved/);
  assert.doesNotMatch(r.stdout, /acceptance of e refused/);
  rmSync(sc.dir, { recursive: true, force: true });
});

test("[check.task-result.acceptance-bound] an acceptance is refused for a done of another commit, for an approval given after the done, for an approval withdrawn before it, and for a statement file of another version", () => {
  // The record of done is of commit "c…", the round reviewed "a…".
  const other = scenario({ rounds: [approvedA, finalRound()], done: [{ time: T(11), commit: CC }] });
  assert.deepEqual(acceptanceProblems(other.rounds, other.records.done), [`r1.md: acceptance of t refused: the record of done d0.md is of commit ${CC.slice(0, 7)}, not of the commit the round reviewed, ${CA.slice(0, 7)}`]);
  assert.match(state(other, { statement: fileOf(A) }), new RegExp(`NEXT t: the verdict of acceptance of r1\\.md is refused: the record of done d0\\.md is of commit ${CC.slice(0, 7)}`));
  assert.doesNotMatch(state(other, { statement: fileOf(A) }), /NEXT t: done/);
  // A round with no commit it reviewed.
  const none = scenario({ rounds: [approvedA, finalRound({ commits: null })], done: [{ time: T(11) }] });
  assert.match(acceptanceProblems(none.rounds, none.records.done).join("\n"), /names no commit it reviewed/);
  // Done at 11 and accepted at 12, under a round of the statement with findings at 10; A approved only at 13.
  const late = scenario({
    rounds: [
      { step: "statement-review", number: 1, time: T(10), hash: A, found: 1 },
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
  assert.match(state(bound, { statement: fileOf(A) }), /NEXT t: done: the last round and its acceptance are clean/);
  const st = taskState({ rounds: bound.rounds, spend: [], done: bound.records.done, task: "t", defaults: limits(null, null), statement: fileOf(B) });
  assert.doesNotMatch(st.lines.join("\n"), /NEXT t: done/);
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
  assert.match(r.stdout, /records that cannot be read, of rounds by their grammar and late records of another version \(1\)/);
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
  assert.match(out, /BUDGET t: the spend cannot be summed, 1 pair of records of one contribution overlap: s0\.md .* and s1\.md .*/);
  assert.match(out, /NEXT t: (.*: )?the budget is exhausted: a question to the owner/);
  assert.doesNotMatch(out, /new input 800|new input 400/);
  // One record of the session alone is summed once and leaves the budget open.
  const one = scenario({ rounds: [{ ...approvedA, tokens: [0, 0, 0] }], spend: [{ contribution: "openai · s1", start: T(10), end: T(10), tokens: [400, 0, 10] }] });
  assert.match(state(one, { statement: fileOf(A), defaults: limits(1000, 1000) }), /BUDGET t: new input 400 of 1000 × 1 = 1000/);
  assert.match(state(one, { statement: fileOf(A), defaults: limits(1000, 1000) }), /NEXT t: the executor works/);
  [sc, one].forEach((x) => rmSync(x.dir, { recursive: true, force: true }));
});

test("[check.task-result.done-commands] an acceptance is refused when the record of done ran other commands than the statement's commands of done", () => {
  const text = "version C\nDone-when: false\n";
  const C = sha256(text);
  const sc = scenario({ rounds: [{ ...approvedA, hash: C }, finalRound({ hash: C })], done: [{ time: T(11), hash: C, command: "true" }] });
  writeFileSync(join(sc.dir, "statement.md"), text);
  const r = checkWith(sc, {}, ["--task", "t", "--statement", join(sc.dir, "statement.md")]);
  assert.match(r.stdout, /NEXT t: the verdict of acceptance of r1\.md is refused: the commands of the record of done d0\.md, "true", are not the statement's commands of done, "false"/);
  assert.doesNotMatch(r.stdout, /NEXT t: done/);
  // The same record against a statement whose command of done is the one it ran is done.
  const same = scenario({ rounds: [approvedA, finalRound()], done: [{ time: T(11) }] });
  writeFileSync(join(same.dir, "statement.md"), A_TEXT);
  assert.match(checkWith(same, {}, ["--task", "t", "--statement", join(same.dir, "statement.md")]).stdout, /NEXT t: done: the last round and its acceptance are clean/);
  [sc, same].forEach((x) => rmSync(x.dir, { recursive: true, force: true }));
});

test("[check.task-result.rounds-agree] with no record of done, --rounds and --task both refuse the verdict of acceptance and neither calls the step clean", () => {
  const sc = scenario({ rounds: [approvedA, finalRound()] });
  const rounds = checkWith(sc, {}, ["--rounds"]);
  assert.equal(rounds.status, 1, rounds.stdout);
  assert.match(rounds.stdout, /verdicts of acceptance refused \(1\):\n  r1\.md: acceptance of t refused: there is no record of done/);
  assert.match(rounds.stdout, /NEXT t: the verdict of acceptance of r1\.md is refused: there is no record of done; the result needs a verdict of acceptance that holds/);
  assert.doesNotMatch(rounds.stdout, /result-review: .* next: the step ended clean/);
  assert.match(state(sc, { statement: fileOf(A) }), /NEXT t: the verdict of acceptance of r1\.md is refused: there is no record of done/);
  // Past the budget, both give the stop.
  const past = checkWith(sc, { budget: { newInput: 0, output: 0 } }, ["--rounds"]);
  assert.match(past.stdout, /NEXT t: the budget is exhausted: a question to the owner/);
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
    assert.match(out, new RegExp(`NEXT ${task}: (.*: )?the budget is exhausted: a question to the owner`));
    assert.doesNotMatch(out, /new input 100|new input 200|work may start/);
  }
  const r = checkWith(sc, { budget: { newInput: 100000, output: 100000 } }, ["--task", "t", "--rounds"]);
  assert.match(r.stdout, /contributions recorded twice over intervals that overlap \(1\)/);
  assert.match(r.stdout, /BUDGET t: the spend cannot be summed/);
  // One action line each from --rounds and --task, the question, and no other line asks it.
  const next = r.stdout.split("\n").filter((l) => l.startsWith("NEXT t:"));
  assert.equal(next.length, 2, r.stdout);
  for (const l of next) assert.match(l, /the budget is exhausted: a question to the owner/);
  assert.doesNotMatch(r.stdout.split("\n").filter((l) => !l.startsWith("NEXT")).join("\n"), /question to the owner/);
  rmSync(sc.dir, { recursive: true, force: true });
});

test("[check.task-statement.budget-one-action] after a round of the result with the budget spent, --task names one next action, the stop", () => {
  const sc = scenario({ rounds: [{ ...approvedA, tokens: [600, 0, 10] }, { step: "result-review", number: 1, time: T(12), hash: A, found: 1, tokens: [600, 0, 10] }] });
  const out = state(sc, { statement: fileOf(A), defaults: limits(1000, 1000) });
  assert.match(out, /statement: approved, version [0-9a-f]{12}\n/);
  assert.match(out, /NEXT t: (.*: )?the budget is exhausted: a question to the owner/);
  assert.doesNotMatch(out, /work may (start|go on) under it|round 2/);
  // Within the budget, the same rounds let work go on, and the next is round 2.
  const within = state(sc, { statement: fileOf(A), defaults: limits(10000, 10000) });
  assert.match(within, /statement: approved, version [0-9a-f]{12}\n/);
  assert.match(within, /NEXT t: narrow round 1, on the fixes of the last round/);
  rmSync(sc.dir, { recursive: true, force: true });
});

test("[check.task-statement.budget-executor-no-round] the executor's spend past the limit with no round at all, through the check, is the stop", () => {
  const sc = scenario({ spend: [{ start: T(10), end: T(11), tokens: [2000, 0, 10] }] });
  assert.equal(sc.rounds.length, 0);
  const r = checkWith(sc, { budget: { newInput: 1000, output: 1000 } }, ["--task", "t"]);
  assert.match(r.stdout, /NEXT t: (.*: )?the budget is exhausted: a question to the owner/);
  assert.match(r.stdout, /TASK t · result: work is not allowed/);
  assert.match(r.stdout, /BUDGET t: new input 2000 of 1000 × 1 = 1000, output 10 of 1000 × 1 = 1000; known for 1 of 1 contributions; .*overspend: new input 2000 of 1000/);
  // --rounds, from the same records, names the same question: the task is named by its spend alone.
  const rounds = checkWith(sc, { budget: { newInput: 1000, output: 1000 } }, ["--rounds"]).stdout;
  assert.doesNotMatch(rounds, /ROUNDS: no records/);
  assert.equal([...rounds.matchAll(/^NEXT t: (.*)$/gm)][0]?.[1], [...r.stdout.matchAll(/^NEXT t: (.*)$/gm)][0][1], rounds);
  rmSync(sc.dir, { recursive: true, force: true });
});

test("[check.task-statement.budget-final-over] through the check, --task fails when the record of acceptance does not name the overspend", () => {
  const sc = scenario({ rounds: [{ ...approvedA, tokens: [500, 0, 10] }, finalRound({ tokens: [600, 0, 10] })], done: [{ time: T(11) }] });
  // A file whose SHA-256 is version A's.
  writeFileSync(join(sc.dir, "statement.md"), A_TEXT);
  const r = checkWith(sc, { budget: { newInput: 1000, output: 1000 } }, ["--task", "t", "--statement", join(sc.dir, "statement.md")]);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /NEXT t: done, with an overspend/);
  assert.match(r.stdout, /task records that do not say what --task found \(1\)/);
  rmSync(sc.dir, { recursive: true, force: true });
});

test("[check.task-statement.question-alone] a finding not fixable makes the question the one next action, and the owner's approval of a new version lifts it", () => {
  const rounds = [approvedA, { step: "result-review", number: 1, time: T(12), hash: A, found: 1, fix: "not fixable" }];
  const out = state(scenario({ rounds }), { statement: fileOf(A) });
  assert.match(out, /statement: approved, version [0-9a-f]{12}\n/);
  assert.match(out, /NEXT t: a question to the owner: a finding cannot be fixed without changing what the owner decided/);
  assert.doesNotMatch(out, /work may|narrow round|full round|records done/);
  // The owner answers with version B, approved: the question is lifted, and the next round of the
  // result takes the next free number.
  const sc = scenario({ rounds, approvals: [{ hash: B, time: T(13) }] });
  const after = state(sc, { statement: fileOf(B) });
  assert.match(after, /statement: approved by the owner \(a0\.md\), version [0-9a-f]{12}\n/);
  assert.match(after, /NEXT t: the executor works under version [0-9a-f]{12}, then records done with done\.mjs/);
  assert.doesNotMatch(after, /question/);
  rmSync(sc.dir, { recursive: true, force: true });
});

test("[check.task-statement.budget-report] REPORT names half from exactly half and limit from exactly the limit, for each kind apart, beside the next action", () => {
  const spendOf = (tokens) => [{ start: T(10), end: T(11), tokens }];
  const report = (tokens, rounds = [approvedA], extra = {}) => state(scenario({ rounds, spend: spendOf(tokens), ...extra }), { statement: fileOf(A), defaults: limits(1000, 100, 2) });
  const line = (out) => out.split("\n").find((l) => l.startsWith("REPORT")) ?? null;
  assert.equal(line(report([499, 0, 49])), null);
  assert.match(line(report([500, 0, 49])), /^REPORT t: new input 500 of 1000: half$/);
  assert.match(line(report([999, 0, 50])), /^REPORT t: new input 999 of 1000: half · output 50 of 100: half$/);
  assert.match(line(report([1000, 0, 99])), /new input 1000 of 1000: half, limit · output 99 of 100: half$/);
  assert.match(line(report([0, 0, 100])), /^REPORT t: output 100 of 100: half, limit$/);
  // One contribution that passes both marks gives both, and work goes on.
  const both = report([1500, 0, 0]);
  assert.match(line(both), /new input 1500 of 1000: half, limit/);
  assert.match(both, /NEXT t: the executor works/);
  // Past the reserve, with a round with findings: the question, and the marks beside it.
  const past = report([2500, 0, 0], [approvedA, { step: "result-review", number: 1, time: T(12), hash: A, found: 1 }]);
  assert.match(past, /NEXT t: (.*: )?the budget is exhausted: a question to the owner/);
  assert.match(line(past), /half, limit/);
  // A clean round of acceptance past the reserve: done, no question.
  const doneOut = report([2500, 0, 0], [approvedA, finalRound()], { done: [{ time: T(11) }] });
  assert.match(doneOut, /NEXT t: done, with an overspend/);
  assert.doesNotMatch(doneOut, /question/);
  assert.match(line(doneOut), /half, limit/);
  // Records of one contribution that overlap: the question, and no REPORT.
  const overlap = state(scenario({ rounds: [approvedA], spend: [...spendOf([600, 0, 0]), { start: T(10, 30), end: T(12), tokens: [600, 0, 0] }] }), { statement: fileOf(A), defaults: limits(1000, 100, 2) });
  assert.match(overlap, /the spend cannot be summed/);
  // The question is named once, on the line NEXT; the line BUDGET says the state only.
  assert.deepEqual(overlap.split("\n").filter((l) => /question to the owner/.test(l)).map((l) => l.split(":")[0]), ["NEXT t"]);
  assert.match(overlap, /NEXT t: (.*: )?the budget is exhausted: a question to the owner/);
  assert.equal(line(overlap), null);
  // A line of the statement's budget the tool cannot read: the question, and no REPORT.
  const unreadable = state(scenario({ rounds: [approvedA], spend: spendOf([1500, 0, 0]) }), { statement: { ...fileOf(A), wrong: ["Budget-reserve: 1,5 is not a number"] }, defaults: limits(1000, 100, 2) });
  assert.match(unreadable, /cannot be read: a question to the owner/);
  assert.equal(line(unreadable), null);
});

test("[check.review-round.malformed-blocks] a record of rounds that cannot be read, by its language, with no task or of another task, blocks every task in --task, --rounds and done.mjs", () => {
  // Each a later round of the statement with findings that the reader drops: read, it would withdraw
  // the approval of the round before; dropped, it must leave none in force.
  const kinds = {
    language: (hash) => roundText({ step: "statement-review", number: 2, time: T(10), hash, found: 1 }).replace("class 0", "класс 0"),
    "no task": (hash) => roundText({ step: "statement-review", number: 2, time: T(10), hash, found: 1 }).replace("Task: t\n", ""),
    "another task": (hash) => roundText({ task: "u", step: "final", number: 1, time: T(10), hash, found: 1 }),
    // An important finding indented under Findings:, which a lenient reader would pass over, approving
    // the version with no finding read.
    "indented finding": (hash) => roundText({ step: "statement-review", number: 2, time: T(10), hash, found: 1 }).replace("\n- class 0", "\n  - class 0"),
    "unknown line": (hash) => roundText({ step: "statement-review", number: 2, time: T(10), hash, found: 1 }).replace("Findings:", "Verdict: fix first\nFindings:"),
  };
  const latin = { records: { latinOnly: true } };
  for (const [kind, text] of Object.entries(kinds)) {
    const sc = scenario({ rounds: [approvedA] });
    writeFileSync(join(sc.dir, "rounds", "r1.md"), text(A));
    writeFileSync(join(sc.dir, "statement.md"), A_TEXT);
    for (const args of [["--task", "t", "--statement", join(sc.dir, "statement.md")], ["--rounds"]]) {
      const r = checkWith(sc, latin, args);
      assert.equal(r.status, 1, `${kind} ${args[0]}: ${r.stdout}`);
      const lines = r.stdout.split("\n").filter((l) => /^NEXT/.test(l));
      assert.ok(lines.length > 0, `${kind} ${args[0]}: ${r.stdout}`);
      for (const l of lines) assert.match(l, /correct the records that cannot be read first: the one next action \(r1\.md\)/, `${kind} ${args[0]}`);
      assert.doesNotMatch(r.stdout, /^TASK|approved/m, `${kind} ${args[0]}`);
    }
    rmSync(sc.dir, { recursive: true, force: true });
    // done.mjs refuses, by the same reader with the configuration's records.latinOnly.
    const { repo, done, clean } = doneRepo("t");
    try {
      assert.equal(done("t").status, 0, kind);
      const cfg = JSON.parse(readFileSync(join(repo, "ont.config.json"), "utf8"));
      writeFileSync(join(repo, "ont.config.json"), JSON.stringify({ ...cfg, records: { latinOnly: true } }));
      writeFileSync(join(repo, "rounds", "2.md"), text(sha256("x")).replace("Task: t\n", kind === "no task" ? "" : "Task: t\n"));
      const r = done("t");
      assert.equal(r.status, 1, `${kind}: ${r.stdout}`);
      assert.match(r.stdout, /no record of done written: correct the records that cannot be read first/, kind);
    } finally {
      clean();
    }
  }
});

test("[check.task-statement.later-version-findings] after a later round of the statement withdraws the owner's approval, --rounds, as --task, lets no work on the result go on", () => {
  const rounds = [
    { step: "statement-review", number: 1, time: T(9), hash: A, found: 2 },
    { step: "result-review", number: 1, time: T(12), hash: A, found: 1 },
    { step: "statement-review", number: 2, time: T(13), hash: B, found: 1, prefix: "other" },
  ];
  const sc = scenario({ rounds, approvals: [{ hash: A, time: T(10) }] });
  writeFileSync(join(sc.dir, "statement.md"), A_TEXT);
  const r = checkWith(sc, {}, ["--task", "t", "--statement", join(sc.dir, "statement.md"), "--rounds"]);
  assert.match(r.stdout, /TASK t · result: work is not allowed: no approval in force for the statement/);
  // The one next action of the task, in --task and --rounds alike, is the next round of the statement,
  // never work on the result.
  const next = r.stdout.split("\n").filter((l) => l.startsWith("NEXT t:"));
  assert.equal(next.length, 2, r.stdout);
  for (const l of next) assert.match(l, /^NEXT t: full round 3: a finding of the last round has no test|^NEXT t: narrow round 1/);
  assert.equal(next[0], next[1]);
  // While the owner's approval is in force, both give the next round of the result.
  const before = scenario({ rounds: rounds.slice(0, 2), approvals: [{ hash: A, time: T(10) }] });
  assert.match(checkWith(before, {}, ["--rounds"]).stdout, /NEXT t: narrow round 1/);
  [sc, before].forEach((x) => rmSync(x.dir, { recursive: true, force: true }));
});

// Step histories, each read by --task, with the file of the version in force, and by --rounds: both
// give the next action of the review of the result by the one function stepNext, so they agree.
const B_TEXT = "version B\nDone-when: npm test\n";
const HISTORIES = {
  "a first finding": { rounds: [approvedA, { step: "result-review", number: 1, time: T(10), hash: A, found: 1 }], file: A_TEXT, next: /narrow round 1, on the fixes/ },
  "a repeated class": { rounds: [approvedA, { step: "result-review", number: 1, time: T(10), hash: A, found: 1 }, { step: "result-review", number: 2, time: T(11), hash: A, found: 1 }], file: A_TEXT, next: /the rounds stagnate \(repeated: class 0\)/ },
  "a finding not fixable": { rounds: [approvedA, { step: "result-review", number: 1, time: T(10), hash: A, found: 1, fix: "not fixable" }], file: A_TEXT, next: /a question to the owner: a finding cannot be fixed/ },
  "no acceptance between": {
    rounds: [approvedA, { step: "result-review", number: 1, time: T(10), hash: A, found: 1 }, finalRound({ number: 2, acceptance: undefined }), { step: "result-review", number: 3, time: T(13), hash: A, found: 1 }],
    done: [{ time: T(11) }],
    file: A_TEXT,
    next: /the rounds stagnate \(repeated: class 0\)/,
  },
  // The reported case: a clean acceptance of A, then version B approved by a clean round, then a first
  // finding on B. The acceptance of A held for A; judged against the file of B it would not.
  "acceptance of A, then B": {
    rounds: [
      approvedA,
      { step: "result-review", number: 1, time: T(10), hash: A, found: 1 },
      finalRound({ number: 2 }),
      { step: "statement-review", number: 2, time: T(13), hash: B },
      { step: "result-review", number: 3, time: T(14), hash: B, found: 1 },
    ],
    done: [{ time: T(11) }],
    file: B_TEXT,
    next: /narrow round 1, on the fixes/,
  },
  "a gate, then a clean acceptance": {
    rounds: [approvedA, { step: "result-review", number: 1, time: T(10), hash: A, found: 1, fix: "not fixable" }, finalRound({ number: 2 })],
    done: [{ time: T(11) }],
    file: A_TEXT,
    next: /a question to the owner: a finding cannot be fixed/,
  },
  "approval withdrawn": {
    rounds: [{ step: "statement-review", number: 1, time: T(9), hash: A, found: 2 }, { step: "result-review", number: 1, time: T(12), hash: A, found: 1 }, { step: "statement-review", number: 2, time: T(13), hash: B, found: 1, prefix: "other" }],
    approvals: [{ hash: A, time: T(10) }],
    file: A_TEXT,
    // The next action is the statement's next round, not work on the result.
    next: /^(narrow|full) round \d/,
  },
};

test("[check.review-round.entry-points-agree] --task and --rounds give one next action for every task any record names, in every history", () => {
  const more = {
    ...HISTORIES,
    // Round 10 of round-rules: a task with no round, its spend at the cap, and a round of the result clean
    // on merging with no verdict of acceptance; with a second task of spend only, below the cap.
    "the budget at the cap, no round": { rounds: [], spend: [{ start: T(10), end: T(11), tokens: [1000, 0, 10] }, { task: "u", contribution: "b · 1", start: T(10), end: T(11), tokens: [10, 0, 1] }], file: A_TEXT, budget: { newInput: 1000, output: 1000 }, next: /the budget is exhausted: a question to the owner/ },
    "no acceptance yet": { rounds: [approvedA, finalRound({ acceptance: undefined })], done: [{ time: T(11) }], file: A_TEXT, next: /gives no verdict of acceptance yet/ },
    "an approval of another task only": { rounds: [approvedA, { step: "result-review", number: 1, time: T(10), hash: A, found: 1 }], approvals: [{ task: "u", time: T(9) }], file: A_TEXT, next: /narrow round 1, on the fixes/ },
  };
  for (const [name, h] of Object.entries(more)) {
    const sc = scenario({ rounds: h.rounds, spend: h.spend ?? [], done: h.done ?? [], approvals: h.approvals ?? [] });
    writeFileSync(join(sc.dir, "statement.md"), h.file);
    const tasks = taskIds({ rounds: sc.rounds, ...sc.records });
    const rounds = checkWith(sc, h.budget ? { budget: h.budget } : {}, ["--rounds"]).stdout;
    for (const t of tasks) {
      const r = checkWith(sc, h.budget ? { budget: h.budget } : {}, ["--task", t, "--statement", join(sc.dir, "statement.md")]).stdout;
      const of = (out) => [...out.matchAll(new RegExp(`^NEXT ${t}: (.*)$`, "gm"))].map((m) => m[1]);
      assert.equal(of(rounds).length, 1, `${name}, --rounds, ${t}:\n${rounds}`);
      assert.equal(of(r).length, 1, `${name}, --task, ${t}:\n${r}`);
      if (t === "t") assert.match(of(r)[0], h.next, `${name}, --task:\n${r}`);
      assert.equal(of(rounds)[0], of(r)[0], `${name}, ${t}: --task and --rounds disagree`);
    }
    // The same from the function all ask, given the file and given none.
    const one = (statement, needFile) => taskNext({ rounds: sc.rounds, done: sc.records.done, approvals: sc.records.approvals, task: "t", statement, needFile }).say;
    if (!h.spend) assert.equal(one(readStatement(join(sc.dir, "statement.md")), true), one(null, false), name);
    rmSync(sc.dir, { recursive: true, force: true });
  }
});

test("[check.task-statement.question-alone] a gate opened by a finding not fixable holds over a later clean acceptance, in --task, --rounds and done.mjs, until the owner's approval", () => {
  const rounds = [approvedA, { step: "result-review", number: 1, time: T(10), hash: A, found: 1, fix: "not fixable" }, finalRound({ number: 2 })];
  const sc = scenario({ rounds, done: [{ time: T(11) }] });
  writeFileSync(join(sc.dir, "statement.md"), A_TEXT);
  const r = checkWith(sc, {}, ["--task", "t", "--statement", join(sc.dir, "statement.md"), "--rounds"]);
  assert.match(r.stdout, /NEXT t: a question to the owner: a finding cannot be fixed[^\n]*\(r1\.md\)/);
  // --rounds names the same one action.
  assert.equal(r.stdout.split("\n").filter((l) => /^NEXT t: a question to the owner: a finding cannot be fixed/.test(l)).length, 2, r.stdout);
  assert.doesNotMatch(r.stdout, /NEXT t: done|the task is done|step ended clean/);
  // The owner's approval after the gate closes it: the clean acceptance after it ends the task.
  const answered = scenario({ rounds: [...rounds.slice(0, 2), finalRound({ number: 2, time: T(13) })], done: [{ time: T(12, 30) }], approvals: [{ hash: A, time: T(12) }] });
  assert.match(state(answered, { statement: fileOf(A) }), /NEXT t: done/);
  [sc, answered].forEach((x) => rmSync(x.dir, { recursive: true, force: true }));
  // done.mjs refuses while the gate is open, and records done after the owner's approval.
  const { repo, done, clean } = doneRepo("t");
  try {
    // The round names the version it read: one after the approval that names none cannot be read (D-152).
    const hash = readRoundRecords({ base: repo, reviewRounds: { dir: join(repo, "rounds") }, records: { latinOnly: false } }).rounds.find((x) => x.step === "statement-review").statementHash;
    writeFileSync(join(repo, "rounds", "2.md"), roundText({ task: "t", step: "result-review", number: 1, time: T(10), hash, found: 1, fix: "not fixable" }));
    const refused = done("t");
    assert.equal(refused.status, 1, refused.stdout);
    assert.match(refused.stdout, /no record of done written: the task's next action is not work on the result: a question to the owner: a finding cannot be fixed[^\n]*\(2\.md\)/);
    writeFileSync(join(repo, "tasks", "a.md"), approvalText({ hash, time: T(11) }));
    assert.equal(done("t").status, 0);
  } finally {
    clean();
  }
});

test("[check.task-statement.question-alone] with a gate open, an edited statement is not a new round: --task, --rounds and done.mjs all give the question", () => {
  const rounds = [approvedA, { step: "result-review", number: 1, time: T(10), hash: A, found: 1, fix: "not fixable" }];
  const sc = scenario({ rounds });
  writeFileSync(join(sc.dir, "b.md"), B_TEXT);
  const r = checkWith(sc, {}, ["--task", "t", "--statement", join(sc.dir, "b.md"), "--rounds"]);
  const next = r.stdout.split("\n").filter((l) => l.startsWith("NEXT t:"));
  assert.equal(next.length, 2, r.stdout);
  for (const l of next) assert.match(l, /^NEXT t: a question to the owner: a finding cannot be fixed/);
  assert.doesNotMatch(r.stdout, /full round \d of the new version/);
  rmSync(sc.dir, { recursive: true, force: true });
  const { repo, outside, done, clean } = doneRepo("t");
  try {
    writeFileSync(join(repo, "rounds", "2.md"), roundText({ task: "t", step: "result-review", number: 1, time: T(10), found: 1, fix: "not fixable" }));
    const edited = join(outside, "s.md");
    writeFileSync(edited, readFileSync(edited, "utf8") + "\nAn edit.\n");
    const d = done("t");
    assert.equal(d.status, 1, d.stdout);
    assert.match(d.stdout, /no record of done written/);
  } finally {
    clean();
  }
});

test("[check.task-statement.gates-from] a finding not fixable in a round before reviewRounds.gatesFrom opens no gate over the task; one at exactly that time does", () => {
  const rounds = (time) => [approvedA, { step: "result-review", number: 1, time, hash: A, found: 1, fix: "not fixable" }, finalRound({ number: 2 })];
  const next = (time, gatesFrom) => {
    const sc = scenario({ rounds: rounds(time), done: [{ time: T(11) }] });
    const n = taskNext({ rounds: sc.rounds, done: sc.records.done, approvals: [], task: "t", statement: fileOf(A), needFile: true, gatesFrom });
    rmSync(sc.dir, { recursive: true, force: true });
    return n.branch;
  };
  // Before the key: read as before D-152, a question at that round only; the clean acceptance after it ends the task.
  assert.equal(next(T(10), T(10, 1)), "done");
  // At exactly the key, and with no key, the gate holds.
  assert.equal(next(T(10), T(10)), "open gate");
  assert.equal(next(T(10), null), "open gate");
  // Before the key and the last round of its step, it is still the question at that round.
  const sc = scenario({ rounds: rounds(T(10)).slice(0, 2) });
  assert.match(taskNext({ rounds: sc.rounds, task: "t", statement: fileOf(A), needFile: true, gatesFrom: T(11) }).say, /a question to the owner: a finding cannot be fixed/);
  rmSync(sc.dir, { recursive: true, force: true });
  // The key is a UTC time to the second, or the configuration is refused.
  const dir = mkdtempSync(join(tmpdir(), "gates-from-"));
  try {
    writeFileSync(join(dir, "ont.config.json"), JSON.stringify({ classes: { ent: "Entity" }, ontology: "ontology.md", reviewRounds: { dir: "rounds", gatesFrom: "2026-11-21" } }));
    assert.throws(() => loadConfig(join(dir, "ont.config.json")), /reviewRounds\.gatesFrom "2026-11-21" is not a UTC time/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("[check.task-statement.gates-from] the records of task releases-and-task read as on main: done, its old findings not fixable before this repository's gatesFrom", () => {
  const cfg = loadConfig(fileURLToPath(new URL("../../../ont.config.json", import.meta.url)));
  assert.equal(cfg.reviewRounds.gatesFrom, "2026-11-21T09:35:15Z");
  const { rounds, malformed } = readRoundRecords(cfg);
  assert.deepEqual(malformed, []);
  const records = parseTaskRecords(cfg.taskRecords.dir);
  const at = (gatesFrom) => taskNext({ rounds, spend: records.spend, done: records.done, approvals: records.approvals, task: "releases-and-task", defaults: cfg.budget, gatesFrom });
  assert.equal(at(cfg.reviewRounds.gatesFrom).branch, "done");
  // Read by the meaning of D-152, with no key, its old findings would hold it.
  assert.equal(at(null).branch, "open gate");
});

test("[check.task-statement.task-next-documented] the ontology and the guide list the branches of a task's next action by the names and in the order the code takes them", () => {
  const ontology = readFileSync(fileURLToPath(new URL("../../../ontology.md", import.meta.url)), "utf8").split("\n").find((l) => /^\|\s*\|\s*`derived\.task-next`/.test(l));
  const guide = readFileSync(fileURLToPath(new URL("../../../docs/parts/agent-rules.md", import.meta.url)), "utf8").split("\n").find((l) => l.startsWith("`ont-check --task <task> --statement <file>` prints the state"));
  for (const [name, text] of [["ontology.md", ontology], ["agent-rules.md", guide]]) {
    assert.ok(text, name);
    const at = TASK_BRANCHES.map((b, i) => text.indexOf(`(${i + 1}) ${b}:`));
    assert.ok(at.every((x) => x >= 0), `${name}: ${TASK_BRANCHES.filter((b, i) => at[i] < 0).join(", ")} missing`);
    assert.deepEqual([...at].sort((a, b) => a - b), at, `${name}: out of order`);
    assert.equal(text.indexOf(`(${TASK_BRANCHES.length + 1})`), -1, `${name}: a branch the code does not take`);
  }
});

// The NEXT line of --task and of --rounds for task t in a repository of done.mjs, read by the functions
// the check and done.mjs read the records with.
const inputsOf = (repo) => {
  const cfg = loadConfig(join(repo, "ont.config.json"));
  return { cfg, ...readTaskInputs(cfg) };
};
const askTask = (repo, file) => {
  const { cfg, rounds, records, malformed } = inputsOf(repo);
  return taskState({ rounds, spend: records.spend, done: records.done, approvals: records.approvals, task: "t", defaults: cfg.budget, statement: file ? readStatement(file) : null, malformed }).lines.at(-1);
};
const askRounds = (repo) => {
  const { cfg, rounds, records } = inputsOf(repo);
  return `NEXT t: ${taskNext({ rounds, spend: records.spend, done: records.done, approvals: records.approvals, task: "t", defaults: cfg.budget }).say}`;
};

test("[check.task-statement.done-of-version] a record of done made before the approval of its version was withdrawn and given again is not reused", () => {
  const rounds = [
    approvedA,
    // A round of the statement with findings withdraws A's approval, and a clean one gives it again.
    { step: "statement-review", number: 2, time: T(11), hash: A, found: 1 },
    { step: "statement-review", number: 3, time: T(12), hash: A },
    // An acceptance given after the second approval, of the record of done made before the withdrawal.
    finalRound({ time: T(13) }),
  ];
  const sc = scenario({ rounds, done: [{ time: T(10) }] });
  const n = taskNext({ rounds: sc.rounds, done: sc.records.done, approvals: [], task: "t", statement: fileOf(A), needFile: true });
  assert.notEqual(n.branch, "done");
  assert.match(acceptanceProblems(sc.rounds, sc.records.done).join("\n"), /r3\.md: acceptance of t refused: the record of done d0\.md was made before the approval in force when the acceptance was given/);
  // The window of A has no record of done of its own: the executor records done again under it.
  const w = taskNext({ rounds: sc.rounds.filter((x) => x.step === "statement-review"), done: sc.records.done, task: "t", statement: fileOf(A), needFile: true });
  assert.match(w.say, /^the executor works under version [0-9a-f]{12}, then records done with done\.mjs$/);
  rmSync(sc.dir, { recursive: true, force: true });
});

test("[check.task-statement.done-of-version] after version A is accepted and a clean round approves version B, the task is not done: --task, --rounds and done.mjs all give work under B", () => {
  const rounds = [approvedA, finalRound(), { step: "statement-review", number: 2, time: T(13), hash: B }];
  const sc = scenario({ rounds, done: [{ time: T(11) }] });
  writeFileSync(join(sc.dir, "b.md"), B_TEXT);
  const r = checkWith(sc, {}, ["--task", "t", "--statement", join(sc.dir, "b.md"), "--rounds"]);
  const next = r.stdout.split("\n").filter((l) => l.startsWith("NEXT t:"));
  assert.equal(next.length, 2, r.stdout);
  for (const l of next) assert.match(l, /^NEXT t: the executor works under version [0-9a-f]{12}, then records done with done\.mjs$/);
  assert.equal(next[0], next[1]);
  assert.doesNotMatch(r.stdout, /NEXT t: done|the task is done/);
  // Before B's approval, A's acceptance ends the task.
  const before = scenario({ rounds: rounds.slice(0, 2), done: [{ time: T(11) }] });
  assert.equal(taskNext({ rounds: before.rounds, done: before.records.done, task: "t" }).branch, "done");
  [sc, before].forEach((x) => rmSync(x.dir, { recursive: true, force: true }));
  // done.mjs records done for B in that interval: the action is work on the result.
  const { repo, outside, done, clean } = doneRepo("t");
  try {
    const b = join(outside, "b.md");
    writeFileSync(b, "# B\n\nDone-when: true\n");
    assert.equal(done("t").status, 0);
    // The record of done is stamped with the clock: dated back before the rounds that follow it.
    const [first] = readdirSync(join(repo, "tasks"));
    writeFileSync(join(repo, "tasks", first), readFileSync(join(repo, "tasks", first), "utf8").replace(/^Time: .*$/m, `Time: ${T(22)}`));
    const recs = parseTaskRecords(join(repo, "tasks")).done;
    writeFileSync(join(repo, "rounds", "2.md"), roundText({ task: "t", step: "result-review", number: 1, time: T(23), hash: readStatement(join(outside, "s.md")).hash, acceptance: "clean", commits: recs[0].commit.slice(0, 7) }));
    writeFileSync(join(repo, "rounds", "3.md"), roundText({ task: "t", step: "statement-review", number: 2, time: T(23, 30), hash: readStatement(b).hash }));
    const forB = spawnSync("node", [join(TOOLS, "done.mjs"), "t", "--statement", b, "--config", join(repo, "ont.config.json")], { encoding: "utf8" });
    assert.equal(forB.status, 0, forB.stdout);
    // After the fresh record of done of B, the next action is the first round of the review of its
    // result, with the next free number, in --task and --rounds alike; a statement-less --task asks
    // for the file rather than calling the task done.
    const both = [askTask(repo, b), askRounds(repo)];
    for (const l of both) assert.match(l, /^NEXT t: the record of done \S+ of version [0-9a-f]{12} has no round of review yet: full round 2 of the review of the result$/);
    assert.equal(askTask(repo, null), "NEXT t: give --statement <file> to compare the version it names with the file");
  } finally {
    clean();
  }
});

// Version B approved by the owner after version A, its record of done and a clean acceptance of it
// (D-152); then a record of A made after B's approval, which is late: a record that cannot be read.
const ofB = { rounds: [approvedA], done: [{ time: T(11), hash: B }], approvals: [{ hash: B, time: T(10) }] };
const acceptB = (extra = {}) => finalRound({ hash: B, ...extra });
const nextLines = (r) => r.stdout.split("\n").filter((l) => l.startsWith("NEXT t:"));

test("[check.task-statement.late-record-blocks] a round of A, with a clean acceptance or a finding, or a record of done of A, after B's approval blocks the task in --task, --rounds and the check", () => {
  const kinds = {
    "clean acceptance": { rounds: [{ step: "result-review", number: 2, time: T(13), hash: A, acceptance: "clean", commits: CA.slice(0, 7) }], late: "r2.md" },
    finding: { rounds: [{ step: "result-review", number: 2, time: T(13), hash: A, found: 1, fix: "not fixable", prefix: "late" }], late: "r2.md" },
    "record of done": { done: [{ time: T(13), hash: A }], late: "d1.md" },
  };
  for (const [kind, extra] of Object.entries(kinds)) {
    const sc = scenario({ ...ofB, rounds: [...ofB.rounds, acceptB(), ...(extra.rounds ?? [])], done: [...ofB.done, ...(extra.done ?? [])] });
    writeFileSync(join(sc.dir, "b.md"), B_TEXT);
    const r = checkWith(sc, {}, ["--task", "t", "--statement", join(sc.dir, "b.md"), "--rounds"]);
    assert.equal(r.status, 1, `${kind}: ${r.stdout}`);
    const next = nextLines(r);
    assert.equal(next.length, 2, `${kind}: ${r.stdout}`);
    for (const l of next) assert.equal(l, `NEXT t: correct the records that cannot be read first: the one next action (${extra.late})`, kind);
    assert.match(r.stdout, new RegExp(`${extra.late.replace(".", "\\.")}: a late record: it names version ${A.slice(0, 12)}, after version ${B.slice(0, 12)} was approved at ${T(10)}`), kind);
    // No reader handles it: no acceptance is compared with B's record of done, no gate is opened.
    assert.doesNotMatch(r.stdout, /acceptance of t refused|a question to the owner|^TASK/m, kind);
    rmSync(sc.dir, { recursive: true, force: true });
  }
});

test("[check.task-statement.late-record-blocks] done.mjs refuses while a late round or record of done of another version stands", () => {
  for (const kind of ["round", "done"]) {
    const { repo, done, clean } = doneRepo("t");
    try {
      const other = sha256("x");
      if (kind === "round") writeFileSync(join(repo, "rounds", "2.md"), roundText({ task: "t", step: "result-review", number: 1, time: T(10), hash: other, found: 1 }));
      else writeFileSync(join(repo, "tasks", "late.md"), doneText({ hash: other, time: T(10), commit: git(repo, "rev-parse", "HEAD") }));
      const r = done("t");
      assert.equal(r.status, 1, `${kind}: ${r.stdout}`);
      assert.match(r.stdout, new RegExp(`no record of done written: correct the records that cannot be read first: the one next action \\((2|late)\\.md\\): \\S+: a late record: it names version ${other.slice(0, 12)}`), kind);
    } finally {
      clean();
    }
  }
});

test("[check.task-statement.gate-across-versions] a gate opened by a round of A holds over a reviewer's clean approval of B and B's clean acceptance, in --task, --rounds and done.mjs, until the owner's approval", () => {
  const rounds = [approvedA, { step: "result-review", number: 1, time: T(10), hash: A, found: 1, fix: "not fixable" }, { step: "statement-review", number: 2, time: T(11), hash: B }, acceptB({ number: 2, time: T(13) })];
  const sc = scenario({ rounds, done: [{ time: T(12), hash: B }] });
  writeFileSync(join(sc.dir, "b.md"), B_TEXT);
  const r = checkWith(sc, {}, ["--task", "t", "--statement", join(sc.dir, "b.md"), "--rounds"]);
  const next = nextLines(r);
  assert.equal(next.length, 2, r.stdout);
  for (const l of next) assert.match(l, /^NEXT t: a question to the owner: a finding cannot be fixed[^\n]*\(r1\.md\)$/);
  // Only the owner's approval clears it: a clean acceptance after it ends the task.
  const answered = scenario({ rounds: [...rounds.slice(0, 3), acceptB({ number: 2, time: T(15) })], done: [{ time: T(12), hash: B }], approvals: [{ hash: B, time: T(14) }] });
  const a = checkWith(answered, {}, ["--rounds"]);
  assert.match(a.stdout, /^NEXT t: done: the last round and its acceptance are clean: merge \(rule\.ready-after-clean-round\)$/m, a.stdout);
  [sc, answered].forEach((x) => rmSync(x.dir, { recursive: true, force: true }));
  const { repo, outside, clean } = doneRepo("t");
  try {
    const s = readStatement(join(outside, "s.md")).hash;
    const b = join(outside, "b.md");
    writeFileSync(b, "# B\n\nDone-when: true\n");
    writeFileSync(join(repo, "rounds", "2.md"), roundText({ task: "t", step: "result-review", number: 1, time: T(10), hash: s, found: 1, fix: "not fixable" }));
    writeFileSync(join(repo, "rounds", "3.md"), roundText({ task: "t", step: "statement-review", number: 2, time: T(11), hash: readStatement(b).hash }));
    const forB = () => spawnSync("node", [join(TOOLS, "done.mjs"), "t", "--statement", b, "--config", join(repo, "ont.config.json")], { encoding: "utf8" });
    const refused = forB();
    assert.equal(refused.status, 1, refused.stdout);
    assert.match(refused.stdout, /no record of done written: the task's next action is not work on the result: a question to the owner: a finding cannot be fixed[^\n]*\(2\.md\)/);
    writeFileSync(join(repo, "tasks", "a.md"), approvalText({ hash: readStatement(b).hash, time: T(12) }));
    const ok = forB();
    assert.equal(ok.status, 0, ok.stdout);
  } finally {
    clean();
  }
});

test("[check.review-round.result-names-version] a round of the result of another task with a blank Statement-hash:, or none, at or after gatesFrom cannot be read, and stays so after the owner's approval; one before gatesFrom reads", () => {
  const gated = (sc) => ({ reviewRounds: { dir: join(sc.dir, "rounds"), gatesFrom: T(11) } });
  for (const [kind, time, approvals] of [["blank", T(12), []], ["none", T(12), []], ["none", T(11), []], ["none", T(12), [{ task: "u", hash: A, time: T(13) }]]]) {
    const sc = scenario({ rounds: [approvedA], approvals });
    const text = roundText({ task: "u", step: "result-review", number: 1, time, found: 1 }).replace("Number: 1\n", `Number: 1\n${kind === "blank" ? "Statement-hash:\n" : ""}`);
    writeFileSync(join(sc.dir, "rounds", "r9.md"), text);
    writeFileSync(join(sc.dir, "statement.md"), A_TEXT);
    const r = checkWith(sc, gated(sc), ["--task", "t", "--statement", join(sc.dir, "statement.md")]);
    const label = `${kind} at ${time}${approvals.length ? " with a later approval" : ""}`;
    assert.equal(r.status, 1, `${label}: ${r.stdout}`);
    assert.equal(nextLines(r).join("\n"), "NEXT t: correct the records that cannot be read first: the one next action (r9.md)", label);
    assert.match(r.stdout + r.stderr, kind === "blank" ? /r9\.md: statement hash is blank/ : /r9\.md: no line Statement-hash: on a round at or after reviewRounds\.gatesFrom/, label);
    rmSync(sc.dir, { recursive: true, force: true });
  }
  // Before gatesFrom the omission reads as it did.
  const sc = scenario({ rounds: [approvedA] });
  writeFileSync(join(sc.dir, "rounds", "r9.md"), roundText({ task: "u", step: "result-review", number: 1, time: T(10, 59), found: 1 }));
  writeFileSync(join(sc.dir, "statement.md"), A_TEXT);
  const r = checkWith(sc, gated(sc), ["--task", "t", "--statement", join(sc.dir, "statement.md")]);
  assert.doesNotMatch(r.stdout, /r9\.md|correct the records/, r.stdout);
  rmSync(sc.dir, { recursive: true, force: true });
});

test("[check.task-statement.budget-one-action] done.mjs refuses a record of done at the budget's cap, while work goes on and after the task is done alike", () => {
  const { repo, outside, done, clean } = doneRepo("t");
  try {
    const cfg = JSON.parse(readFileSync(join(repo, "ont.config.json"), "utf8"));
    writeFileSync(join(repo, "ont.config.json"), JSON.stringify({ ...cfg, budget: { newInput: 1000, output: 1000 } }));
    // Work goes on, the spend exactly at the cap: refused, with the question of the budget.
    writeFileSync(join(repo, "tasks", "s.md"), spendText({ start: T(9, 30), end: T(9, 40), tokens: [1000, 0, 0] }));
    const atCap = done("t");
    assert.equal(atCap.status, 1, atCap.stdout);
    assert.match(atCap.stdout, /no record of done written: the task's next action is not work on the result: the budget is exhausted: a question to the owner/);
    // Within the budget, done is recorded; the task is then reviewed and done, and the spend reaches the
    // cap: a fresh record of done is new work, and is refused too.
    writeFileSync(join(repo, "tasks", "s.md"), spendText({ start: T(9, 30), end: T(9, 40), tokens: [10, 0, 0] }));
    assert.equal(done("t").status, 0);
    const rec = parseTaskRecords(join(repo, "tasks")).done[0];
    const later = new Date(Date.parse(rec.time) + 60000).toISOString().replace(".000Z", "Z");
    writeFileSync(join(repo, "rounds", "2.md"), roundText({ task: "t", step: "result-review", number: 1, time: later, hash: rec.statementHash, acceptance: "clean", commits: rec.commit.slice(0, 7) }));
    assert.match(askTask(repo, join(outside, "s.md")), /NEXT t: done: the last round and its acceptance are clean/);
    writeFileSync(join(repo, "tasks", "s.md"), spendText({ start: T(9, 30), end: T(9, 40), tokens: [1000, 0, 0] }));
    const fresh = done("t");
    assert.equal(fresh.status, 1, fresh.stdout);
    assert.match(fresh.stdout, /the budget is exhausted: a question to the owner/);
  } finally {
    clean();
  }
});

test("[check.task-statement.budget-one-action] with an approval in force and the budget exhausted, --task names the question on one line only", () => {
  const histories = [
    [{ ...approvedA, tokens: [1200, 0, 10] }],
    [{ ...approvedA, tokens: [600, 0, 10] }, { step: "result-review", number: 1, time: T(12), hash: A, found: 1, tokens: [600, 0, 10] }],
    [{ ...approvedA, tokens: [600, 0, 10] }, { step: "result-review", number: 1, time: T(12), hash: A, found: 1, fix: "not fixable", tokens: [600, 0, 10] }],
    // Exactly at the limit times the reserve of 1, with a live gate.
    [{ ...approvedA, tokens: [400, 0, 10] }, { step: "result-review", number: 1, time: T(12), hash: A, found: 1, fix: "not fixable", tokens: [600, 0, 10] }],
  ];
  for (const rounds of histories) {
    const out = state(scenario({ rounds }), { statement: fileOf(A), defaults: limits(1000, 1000) });
    const lines = out.split("\n");
    assert.equal(lines.filter((l) => l.startsWith("NEXT")).length, 1, out);
    assert.deepEqual(lines.filter((l) => !l.startsWith("NEXT") && /question to the owner|the executor works|round \d|work may/.test(l)), [], out);
    assert.match(out, /statement: approved, version [0-9a-f]{12}\n/);
    // Exactly the question of the budget, also where a gate is open: the budget comes first.
    assert.match(out, /NEXT t: the budget is exhausted: a question to the owner$/);
  }
});

test("[check.review-round.stagnation-reset] only a round of the result whose acceptance held resets the comparison: one with no acceptance or a refused one does not", () => {
  const r1 = { step: "result-review", number: 1, time: T(10), hash: A, found: 1 };
  const r3 = { step: "result-review", number: 3, time: T(13), hash: A, found: 1 };
  const next = (middle, done) => {
    const sc = scenario({ rounds: [approvedA, r1, middle, r3], done });
    const n = stepNext({ rounds: sc.rounds, done: sc.records.done, approvals: [], task: "t", step: "result-review" });
    rmSync(sc.dir, { recursive: true, force: true });
    return n.next;
  };
  // The clean acceptance held for the record of done before it: the step ended, and class 0 again is the
  // first finding after it.
  assert.equal(next(finalRound({ number: 2 }), [{ time: T(11) }]), "narrow");
  // No record of done: the acceptance is refused, nothing ended, class 0 repeats.
  assert.equal(next(finalRound({ number: 2 }), []), "redesign");
  // Clean on merging with no acceptance: nothing ended either.
  assert.equal(next(finalRound({ number: 2, acceptance: undefined }), [{ time: T(11) }]), "redesign");
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
    const approve = (file, number, time) => writeFileSync(join(repo, "rounds", `${number}.md`), roundText({ task: "t", step: "statement-review", number, time, hash: readStatement(file).hash }));
    const done = (file) => spawnSync("node", [join(TOOLS, "done.mjs"), "t", "--statement", file, "--config", join(repo, "ont.config.json")], { encoding: "utf8" });
    approve(pass, 1, T(9));
    const ok = done(pass);
    assert.equal(ok.status, 0, ok.stdout);
    const files = readdirSync(join(repo, "tasks"));
    assert.equal(files.length, 1);
    const rec = readFileSync(join(repo, "tasks", files[0]), "utf8");
    assert.match(rec, new RegExp(`Commit: ${head}`));
    assert.match(rec, new RegExp(`Statement-hash: ${readStatement(pass).hash}\nBudget-new-input: none\nBudget-output: none\nBudget-reserve: none\n`));
    assert.match(rec, /- test -f committed\.txt · pass\n- test ! -f uncommitted\.txt · pass/);
    assert.equal(parseTaskRecords(join(repo, "tasks")).done.length, 1);
    approve(fail, 2, FUTURE(1));
    const bad = done(fail);
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /no record of done written: 1 of 1 commands of done failed/);
    const unapproved = done(loose);
    assert.equal(unapproved.status, 1);
    assert.match(unapproved.stdout, /the task's next action is not work on the result: the statement changed after its approval/);
    assert.equal(readdirSync(join(repo, "tasks")).length, 1);
    // A statement whose budget line the tool cannot read is refused, under an approval in force, and no
    // record is written with the reserve as none (D-150).
    const comma = join(outside, "comma.md");
    writeFileSync(comma, "# A comma\n\nDone-when: true\nBudget-new-input: 100\nBudget-reserve: 1,5\n");
    approve(comma, 3, FUTURE(2));
    const c = done(comma);
    assert.equal(c.status, 1, c.stdout);
    assert.match(c.stdout, /Budget-reserve: 1,5 is not a number/);
    assert.equal(readdirSync(join(repo, "tasks")).length, 1);
    assert.equal(git(repo, "worktree", "list").split("\n").length, 1);
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("[check.task-result.evidence] done.mjs writes the evidence a statement asks the record of done to name, under Evidence:, read with the record; where records are English only a Cyrillic line is refused by both", () => {
  const outside = mkdtempSync(join(tmpdir(), "done-evidence-"));
  const repos = [];
  // A repository with an approved statement whose command of done passes, records English only or not.
  const project = (latinOnly) => {
    const repo = mkdtempSync(join(tmpdir(), "done-repo-"));
    repos.push(repo);
    git(repo, "init", "-q", "-b", "main");
    mkdirSync(join(repo, "rounds"));
    mkdirSync(join(repo, "tasks"));
    writeFileSync(join(repo, "ont.config.json"), JSON.stringify({ classes: { ent: "Entity" }, ontology: "ontology.md", reviewRounds: { dir: "rounds" }, taskRecords: { dir: "tasks" }, ...(latinOnly ? { records: { latinOnly: true } } : {}) }));
    writeFileSync(join(repo, ".gitignore"), "rounds/\ntasks/\n");
    git(repo, "add", ".");
    git(repo, "commit", "-q", "-m", "first");
    const statement = join(outside, `s-${repos.length}.md`);
    writeFileSync(statement, `# A statement ${repos.length}\n\nDone-when: true\n`);
    writeFileSync(join(repo, "rounds", "1.md"), roundText({ task: "t", step: "statement-review", number: 1, time: T(9), hash: readStatement(statement).hash }));
    const done = (evidence) => spawnSync("node", [join(TOOLS, "done.mjs"), "t", "--statement", statement, "--config", join(repo, "ont.config.json"), "--evidence", evidence], { encoding: "utf8" });
    return { repo, done, files: () => readdirSync(join(repo, "tasks")) };
  };
  const good = join(outside, "good.txt");
  writeFileSync(good, "check.task-result.evidence, a row changed in checks.md\n\n- the code at tools/ont-check/done.mjs\n");
  const cyrillic = join(outside, "cyrillic.txt");
  writeFileSync(cyrillic, "check.task-result.evidence\nряд каталога\n");
  try {
    const english = project(true);
    // A Cyrillic line is refused, naming its letter and its line in the file, and nothing is written.
    const refused = english.done(cyrillic);
    assert.equal(refused.status, 1, refused.stdout);
    assert.match(refused.stdout, /no record of done written: the evidence .*line 2: the letter р is not English text/);
    assert.deepEqual(english.files(), []);
    // A file of evidence that is not there is refused too.
    assert.match(english.done(join(outside, "missing.txt")).stdout, /no record of done written: the evidence .* cannot be read/);
    // English evidence is written under Evidence:, after the checks, one line each, and read with the record.
    const ok = english.done(good);
    assert.equal(ok.status, 0, ok.stdout);
    const [file] = english.files();
    const rec = readFileSync(join(english.repo, "tasks", file), "utf8");
    assert.match(rec, /\nChecks:\n- true · pass\nEvidence:\n- check\.task-result\.evidence, a row changed in checks\.md\n- the code at tools\/ont-check\/done\.mjs\n$/);
    const read = parseTaskRecords(join(english.repo, "tasks"), { latinOnly: true });
    assert.deepEqual(read.malformed, []);
    assert.deepEqual(read.done[0].evidence, ["check.task-result.evidence, a row changed in checks.md", "the code at tools/ont-check/done.mjs"]);
    // The reader refuses a record of done whose evidence holds a Cyrillic word where records are English
    // only, naming its line in the record, and reads it where they are not.
    const hand = rec.replace("- the code at", "- код at");
    const dir = join(outside, "hand");
    mkdirSync(dir);
    writeFileSync(join(dir, "20261123T100000Z-t-done.md"), hand);
    const line = hand.split("\n").findIndex((l) => l.startsWith("- код")) + 1;
    const latin = parseTaskRecords(dir, { latinOnly: true });
    assert.equal(latin.done.length, 0);
    assert.match(latin.malformed.join("\n"), new RegExp(`20261123T100000Z-t-done\\.md: line ${line}: the letter к is not English text`));
    assert.deepEqual(parseTaskRecords(dir).malformed, []);
    assert.equal(parseTaskRecords(dir).done[0].evidence[1], "код at tools/ont-check/done.mjs");
    // Where records are not English only, the Cyrillic evidence is written and read.
    const other = project(false);
    const free = other.done(cyrillic);
    assert.equal(free.status, 0, free.stdout);
    assert.deepEqual(parseTaskRecords(join(other.repo, "tasks")).done[0].evidence, ["check.task-result.evidence", "ряд каталога"]);
    // A record of done made without it carries none.
    assert.deepEqual(parseTaskRecords(join(TOOLS, "../../reviews/tasks"), { latinOnly: true }).done.find((d) => d.task === "enforcement-merge-gate").evidence, []);
  } finally {
    for (const r of repos) rmSync(r, { recursive: true, force: true });
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
  writeFileSync(join(repo, "rounds", "1.md"), roundText({ task, step: "statement-review", number: 1, time: T(9), hash: readStatement(statement).hash }));
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
  // Every variable Git names as local to a repository is dropped; the others stay. The one the tool sets
  // itself, local replacements off, is its own value, never the hook's (D-137).
  const local = spawnSync("git", ["rev-parse", "--local-env-vars"], { encoding: "utf8" }).stdout.split("\n").filter(Boolean);
  const given = Object.fromEntries([...local, "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0"].map((k) => [k, "x"]));
  const kept = gitEnv({ ...given, GIT_AUTHOR_NAME: "t", PATH: "/bin" });
  assert.deepEqual(Object.keys(kept).sort(), ["GIT_AUTHOR_NAME", "GIT_NO_REPLACE_OBJECTS", "PATH"]);
  assert.equal(kept.GIT_NO_REPLACE_OBJECTS, "1");
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

// Round 3 of the review of the result of task releases-and-task (D-121, D-128).
const withFindings = { step: "statement-review", number: 1, time: T(9), hash: A, found: 2 };

test("[check.owner-approval.after-findings] after rounds with findings the owner's approval of the file's version lets work start and done be recorded, and a later round with findings withdraws it", () => {
  const before = scenario({ rounds: [withFindings] });
  assert.match(state(before, { statement: fileOf(A) }), /result: work is not allowed/);
  const sc = scenario({ rounds: [withFindings], approvals: [{ time: T(10) }] });
  assert.deepEqual(sc.records.malformed, []);
  const out = state(sc, { statement: fileOf(A) });
  assert.match(out, /statement: approved by the owner \(a0\.md\), version [0-9a-f]{12}\n/);
  assert.match(out, /NEXT t: the executor works under version [0-9a-f]{12}, then records done with done\.mjs/);
  // The approval holds for its version only.
  assert.match(state(sc, { statement: fileOf(B) }), /NEXT t: the statement changed after its approval/);
  // An acceptance under the owner's approval holds; the check refuses none.
  const accepted = scenario({ rounds: [withFindings, finalRound()], approvals: [{ time: T(10) }], done: [{ time: T(11) }] });
  assert.deepEqual(acceptanceProblems(accepted.rounds, accepted.records.done, accepted.records.approvals), []);
  assert.match(state(accepted, { statement: fileOf(A) }), /NEXT t: done: the last round and its acceptance are clean/);
  // A later round of the statement with findings withdraws it.
  const later = scenario({ rounds: [withFindings, { ...withFindings, number: 2, time: T(11) }], approvals: [{ time: T(10) }] });
  assert.match(state(later, { statement: fileOf(A) }), /result: work is not allowed/);
  // done.mjs counts it as the check does.
  const { repo, outside, clean } = doneRepo("t");
  try {
    const statement = join(outside, "s.md");
    const hash = readStatement(statement).hash;
    writeFileSync(join(repo, "rounds", "1.md"), roundText({ task: "t", step: "statement-review", number: 1, time: T(9), hash, found: 2 }));
    const run = () => spawnSync("node", [join(TOOLS, "done.mjs"), "t", "--statement", statement, "--config", join(repo, "ont.config.json")], { encoding: "utf8" });
    const refused = run();
    assert.equal(refused.status, 1, refused.stdout);
    writeFileSync(join(repo, "tasks", "approval.md"), approvalText({ hash, time: T(10) }));
    const ok = run();
    assert.equal(ok.status, 0, ok.stdout);
    assert.match(ok.stdout, /^DONE t: 1 commands passed/);
  } finally {
    clean();
  }
  [before, sc, accepted, later].forEach((x) => rmSync(x.dir, { recursive: true, force: true }));
});

test("[check.owner-approval.needs-source] a record of the owner's approval without a source, or by anyone but the owner, is refused and approves nothing", () => {
  const sc = scenario({ rounds: [withFindings], approvals: [{ time: T(10), source: null }, { time: T(10, 30), by: "an agent" }] });
  assert.equal(sc.records.approvals.length, 0);
  assert.match(sc.records.malformed.join("\n"), /a0\.md: no source: the owner's words or answer it rests on, with the date/);
  assert.match(sc.records.malformed.join("\n"), /a1\.md: by an agent, not by owner/);
  assert.match(state(sc, { statement: fileOf(A) }), /result: work is not allowed/);
  writeFileSync(join(sc.dir, "statement.md"), A_TEXT);
  const r = checkWith(sc, {}, ["--task", "t", "--statement", join(sc.dir, "statement.md")]);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /task records that cannot be read \(2\)/);
  assert.match(r.stdout, /TASK t · result: work is not allowed/);
  assert.doesNotMatch(r.stdout, /ONT_OK/);
  rmSync(sc.dir, { recursive: true, force: true });
});

test("[check.task-result.latest-done] a record of done of a newer commit after the acceptance leaves the task not done, in --task and in --rounds", () => {
  const sc = scenario({ rounds: [approvedA, finalRound()], done: [{ time: T(11) }, { time: T(13), commit: CC }] });
  const out = state(sc, { statement: fileOf(A) });
  assert.doesNotMatch(out, /the task is done|NEXT t: done/);
  assert.match(out, new RegExp(`NEXT t: the verdict of acceptance of r1\\.md is refused: the record of done d1\\.md, of commit ${CC.slice(0, 7)}, was made after it and has no acceptance of its own`));
  assert.match(out, new RegExp(`TASK t · done: recorded in d1\\.md, commit ${CC.slice(0, 7)}, .*no round of the review of the result has followed it yet`));
  const r = checkWith(sc, {}, ["--rounds"]);
  assert.match(r.stdout, /NEXT t: the verdict of acceptance of r1\.md is refused: the record of done d1\.md/);
  assert.doesNotMatch(r.stdout, /result-review: .* next: the step ended clean/);
  // The general check does not refuse the acceptance of the earlier record: a newer result waits for its round.
  assert.doesNotMatch(r.stdout, /verdicts of acceptance refused/);
  rmSync(sc.dir, { recursive: true, force: true });
});

test("[check.task-statement.overspend-computed] the line Overspend: is the tool's own text, required past the limit by --task and by the check alike", () => {
  const rounds = (overspend) => [{ ...approvedA, tokens: [500, 0, 10] }, finalRound({ tokens: [600, 0, 10], ...(overspend ? { overspend } : {}) })];
  const exact = "new input 1100 of 1000, output 20 of 1000";
  const cases = { wrong: "new input 1101 of 1000, output 20 of 1000", missing: null, exact };
  for (const [name, line] of Object.entries(cases)) {
    const sc = scenario({ rounds: rounds(line), done: [{ time: T(11) }] });
    const st = taskState({ rounds: sc.rounds, spend: [], done: sc.records.done, task: "t", defaults: limits(1000, 1000), statement: fileOf(A) });
    const general = checkWith(sc, { budget: { newInput: 1000, output: 1000 } }, []);
    const rounds2 = checkWith(sc, { budget: { newInput: 1000, output: 1000 } }, ["--rounds"]);
    if (name === "exact") {
      assert.deepEqual(st.errors, []);
      assert.equal(general.status, 0, general.stdout);
      assert.equal(rounds2.status, 0, rounds2.stdout);
    } else {
      assert.equal(st.errors.length, 1, name);
      assert.match(st.errors[0], name === "wrong" ? /names the overspend as "new input 1101 of 1000, output 20 of 1000", not as the tool computes it, "new input 1100 of 1000, output 20 of 1000"/ : /does not name the overspend/);
      for (const r of [general, rounds2]) {
        assert.equal(r.status, 1, `${name}: ${r.stdout}`);
        assert.match(r.stdout, /records of acceptance whose line Overspend: is not the tool's \(1\)/);
        assert.doesNotMatch(r.stdout, /ONT_OK/);
      }
    }
    rmSync(sc.dir, { recursive: true, force: true });
  }
  // Within the limit, a line Overspend: names what the tool does not find.
  const within = scenario({ rounds: rounds("new input 1100 of 1000"), done: [{ time: T(11) }] });
  const st = taskState({ rounds: within.rounds, spend: [], done: within.records.done, task: "t", defaults: limits(5000, 5000), statement: fileOf(A) });
  assert.match(st.errors.join("\n"), /names an overspend, "new input 1100 of 1000", where the tool finds none/);
  rmSync(within.dir, { recursive: true, force: true });
});

// Round 4 of the review of the result of task releases-and-task (D-143, D-144).
test("[check.task-result.commits-resolve] a record of done and a round that name a commit the repository does not have bind no acceptance, and the check fails", () => {
  const ghost = "1".repeat(40);
  const sc = scenario({ rounds: [approvedA, finalRound({ commits: `${CB.slice(0, 7)}..${ghost.slice(0, 7)}` })], done: [{ time: T(11), commit: ghost }] });
  writeFileSync(join(sc.dir, "statement.md"), A_TEXT);
  const r = checkWith(sc, {}, ["--task", "t", "--statement", join(sc.dir, "statement.md")]);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, new RegExp(`task records that cannot be read \\(1\\):\n  d0\\.md: commit ${ghost} is not in the repository`));
  assert.match(r.stdout, /ERROR · rounds that give the acceptance of a task whose commits are not in the repository \(1\):\n  r1\.md: the round gives the acceptance of the latest record of done of t, and its line Commits: names commit 1111111, which is not in the repository/);
  assert.doesNotMatch(r.stdout, /the task is done|NEXT t: done/);
  assert.doesNotMatch(r.stdout, /ONT_OK/);
  // The same records with a commit of the repository: the task is done.
  const real = scenario({ rounds: [approvedA, finalRound()], done: [{ time: T(11) }] });
  writeFileSync(join(real.dir, "statement.md"), A_TEXT);
  const ok = checkWith(real, {}, ["--task", "t", "--statement", join(real.dir, "statement.md")]);
  assert.equal(ok.status, 0, ok.stdout);
  assert.match(ok.stdout, /NEXT t: done: the last round and its acceptance are clean/);
  for (const d of [sc.dir, real.dir]) rmSync(d, { recursive: true, force: true });
});

test("[check.task-statement.limits-one-function] the statement's limits, read from its file or from the record of done, decide the overspend for --task, --rounds and the check alike, and numbers are written one way", () => {
  const big = "version big\nDone-when: npm test\nBudget-new-input: 3000000\nBudget-output: 1500000\n";
  const BIG = sha256(big);
  // A spend of 150 under the statement's 3000000, past the project's 100: no overspend anywhere.
  const sc = scenario({
    rounds: [{ ...approvedA, hash: BIG }, finalRound({ hash: BIG, tokens: [150, 0, 0] })],
    done: [{ time: T(11), hash: BIG, budget: [3000000, 1500000] }],
  });
  writeFileSync(join(sc.dir, "statement.md"), big);
  const r = checkWith(sc, { budget: { newInput: 100, output: 100 } }, ["--task", "t", "--statement", join(sc.dir, "statement.md"), "--rounds"]);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /NEXT t: done: the last round and its acceptance are clean/);
  assert.match(r.stdout, /BUDGET t: new input 150 of 3000000 × 1 = 3000000/);
  assert.match(r.stdout, /NEXT t: done/);
  assert.doesNotMatch(r.stdout, /Overspend|overspend/);
  assert.match(r.stdout, /ONT_OK/);
  // A fractional limit with reserve, 101 × 1.5: the tool's own line is taken by each.
  const frac = scenario({
    rounds: [approvedA, finalRound({ tokens: [152, 0, 0], overspend: "new input 152 of 151.5, output 0 of 1500" })],
    done: [{ time: T(11), budget: ["none", "none"] }],
  });
  writeFileSync(join(frac.dir, "statement.md"), A_TEXT);
  const f = checkWith(frac, { budget: { newInput: 101, output: 1000, reserve: 1.5 } }, ["--task", "t", "--statement", join(frac.dir, "statement.md"), "--rounds"]);
  assert.equal(f.status, 0, f.stdout);
  assert.match(f.stdout, /NEXT t: done, with an overspend: new input 152 of 151\.5, output 0 of 1500; report it to the owner/);
  assert.match(f.stdout, /ONT_OK/);
  // A record of done whose limits are not the statement's is refused by --task.
  const wrong = scenario({
    rounds: [{ ...approvedA, hash: BIG }, finalRound({ hash: BIG, tokens: [150, 0, 0] })],
    done: [{ time: T(11), hash: BIG, budget: [100, 1500000] }],
  });
  writeFileSync(join(wrong.dir, "statement.md"), big);
  const w = checkWith(wrong, { budget: { newInput: 100, output: 100 } }, ["--task", "t", "--statement", join(wrong.dir, "statement.md")]);
  assert.equal(w.status, 1, w.stdout);
  assert.match(w.stdout, /d0\.md: the record of done carries the limits Budget-new-input: 100, Budget-output: 1500000, Budget-reserve: none, not the statement's, Budget-new-input: 3000000, Budget-output: 1500000, Budget-reserve: none/);
  for (const d of [sc.dir, frac.dir, wrong.dir]) rmSync(d, { recursive: true, force: true });
});

// Round 5 of the review of the result of task releases-and-task (D-145, D-147).
test("[check.task-result.missing-commit-information] in a real git clone, old records that name a commit the clone does not have are information and the check passes; a record of done of such a commit leaves the task not done", () => {
  const top = mkdtempSync(join(tmpdir(), "task-clone-"));
  const at = (dir, ...a) => spawnSync("git", ["-C", dir, ...a], { encoding: "utf8", env: GIT_ENV });
  const src = join(top, "src");
  mkdirSync(src);
  at(src, "init", "-q", "-b", "main");
  cpSync(EXAMPLE, join(src, "example"), { recursive: true, filter: (p) => !p.startsWith(join(EXAMPLE, "releases")) });
  const cfgPath = join(src, "example", "ont.config.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  writeFileSync(cfgPath, JSON.stringify({ ...cfg, reviewRounds: { dir: "../reviews/rounds" }, taskRecords: { dir: "../reviews/tasks" } }));
  at(src, "add", "-A");
  at(src, "commit", "-q", "-m", "base");
  const base = at(src, "rev-parse", "HEAD").stdout.trim();
  // A commit on a branch that is deleted, as a rewrite of the history leaves it: the source still has
  // the object, a clone does not.
  at(src, "checkout", "-q", "-b", "side");
  at(src, "commit", "-q", "--allow-empty", "-m", "lost");
  const lost = at(src, "rev-parse", "HEAD").stdout.trim();
  at(src, "checkout", "-q", "main");
  at(src, "branch", "-q", "-D", "side");
  // An old round of another task, with a finding and no acceptance, and a manual run, both of the lost commit.
  mkdirSync(join(src, "reviews", "rounds"), { recursive: true });
  mkdirSync(join(src, "reviews", "tasks"), { recursive: true });
  mkdirSync(join(src, "example", "verify", "runs"), { recursive: true });
  writeFileSync(join(src, "reviews", "rounds", "old-1.md"), roundText({ task: "old", step: "result-review", number: 1, time: T(8), hash: A, found: 1, commits: `${base.slice(0, 7)}..${lost.slice(0, 7)}` }));
  writeFileSync(
    join(src, "example", "verify", "runs", "20261105T090000Z-check.loan.overdue-in-real-time-a1b2.md"),
    `# Manual run\n\nCheck: check.loan.overdue-in-real-time\nCommit: ${lost.slice(0, 7)}\nBy: a model, a provider\nTime: 2026-11-05T09:00:00Z\nStamp: 0000\nVerdict: pass\n`,
  );
  at(src, "add", "-A");
  at(src, "commit", "-q", "-m", "records");
  const clone = join(top, "clone");
  assert.equal(spawnSync("git", ["clone", "-q", "--no-local", src, clone], { encoding: "utf8", env: GIT_ENV }).status, 0);
  assert.notEqual(at(clone, "cat-file", "-e", `${lost}^{commit}`).status, 0, "the clone does not have the lost commit");
  const check = (...args) => spawnSync("node", [join(TOOLS, "ont-check.mjs"), "--config", join(clone, "example", "ont.config.json"), ...args], { encoding: "utf8" });
  const ok = check();
  assert.equal(ok.status, 0, ok.stdout);
  assert.match(ok.stdout, new RegExp(`info · rounds of review whose commits this clone does not have [^\\n]*\\(1\\):\\n  old-1\\.md: names a commit this clone does not have, ${lost.slice(0, 7)}`));
  assert.match(ok.stdout, new RegExp(`info · verdict records whose commit this clone does not have [^\\n]*\\(1\\):\\n  20261105T090000Z-check\\.loan\\.overdue-in-real-time-a1b2\\.md: names a commit this clone does not have, ${lost.slice(0, 7)}`));
  assert.match(ok.stdout, /ONT_OK/);
  // A record of done of the lost commit, and the round that accepts it: the task is not done, and the check fails.
  writeFileSync(join(clone, "reviews", "rounds", "t-1.md"), roundText(approvedA));
  mkdirSync(join(clone, "reviews", "tasks"), { recursive: true });
  writeFileSync(join(clone, "reviews", "tasks", "d-1.md"), doneText({ time: T(11), commit: lost }));
  writeFileSync(join(clone, "reviews", "rounds", "t-2.md"), roundText(finalRound({ commits: `${base.slice(0, 7)}..${lost.slice(0, 7)}` })));
  writeFileSync(join(top, "statement.md"), A_TEXT);
  const done = check("--task", "t", "--statement", join(top, "statement.md"));
  assert.equal(done.status, 1, done.stdout);
  assert.match(done.stdout, new RegExp(`ERROR · task records that cannot be read \\(1\\):\n  d-1\\.md: commit ${lost} is not in the repository`));
  assert.match(done.stdout, /ERROR · rounds that give the acceptance of a task whose commits are not in the repository \(1\):\n  t-2\.md:/);
  assert.doesNotMatch(done.stdout, /the task is done|NEXT t: done/);
  assert.doesNotMatch(done.stdout, /ONT_OK/);
  rmSync(top, { recursive: true, force: true });
});

test("[check.task-statement.limits-of-approval] after version A is approved and done is recorded, the owner's approval of version B with another budget gives B's limits, and --task gives one next action", () => {
  const aText = "version A\nDone-when: npm test\nBudget-new-input: 3000000\nBudget-output: 1500000\n";
  const bText = "version B\nDone-when: npm test\nBudget-new-input: 4000000\nBudget-output: 1500000\n";
  const [HA, HB] = [sha256(aText), sha256(bText)];
  const sc = scenario({
    rounds: [{ ...approvedA, hash: HA, tokens: [100, 0, 10] }],
    done: [{ time: T(11), hash: HA, budget: [3000000, 1500000] }],
    approvals: [{ hash: HB, time: T(13) }],
  });
  writeFileSync(join(sc.dir, "b.md"), bText);
  const r = checkWith(sc, { budget: { newInput: 100, output: 100 } }, ["--task", "t", "--statement", join(sc.dir, "b.md"), "--rounds"]);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /TASK t · statement: approved by the owner \(a0\.md\), version [0-9a-f]{12}\n/);
  assert.match(r.stdout, /BUDGET t: new input 100 of 4000000 × 1 = 4000000, output 10 of 1500000 × 1 = 1500000/);
  // --task, given B's file, reads B's limits; --rounds, given no file, knows only the configuration's
  // until a record of done of B carries them (D-147), so its NEXT line is the question of the budget.
  const taskPart = r.stdout.slice(r.stdout.lastIndexOf("TASK t · statement"));
  assert.doesNotMatch(taskPart, /ERROR|not the statement's|exhausted|question/);
  assert.match(taskPart, /NEXT t: the executor works under version [0-9a-f]{12}, then records done/);
  assert.match(r.stdout, /ONT_OK/);
  // Without the file, as to the check and --rounds, A's record of done gives no limits for B: the project's.
  const st = taskBudget({ rounds: sc.rounds, spend: [], done: sc.records.done, approvals: sc.records.approvals, task: "t", defaults: limits(100, 100), statement: null });
  assert.deepEqual(st.limits, { newInput: 100, output: 100 });
  // Under A's approval, A's record of done gives A's limits.
  const onlyA = taskBudget({ rounds: sc.rounds, spend: [], done: sc.records.done, approvals: [], task: "t", defaults: limits(100, 100), statement: null });
  assert.deepEqual(onlyA.limits, { newInput: 3000000, output: 1500000 });
  // A record of done of B whose limits are not B's file's is still refused.
  const wrong = scenario({
    rounds: [{ ...approvedA, hash: HA }],
    done: [{ time: T(11), hash: HA, budget: [3000000, 1500000] }, { time: T(14), hash: HB, budget: [3000000, 1500000] }],
    approvals: [{ hash: HB, time: T(13) }],
  });
  writeFileSync(join(wrong.dir, "b.md"), bText);
  const w = checkWith(wrong, {}, ["--task", "t", "--statement", join(wrong.dir, "b.md")]);
  assert.equal(w.status, 1, w.stdout);
  assert.match(w.stdout, /d1\.md: the record of done carries the limits Budget-new-input: 3000000, Budget-output: 1500000, Budget-reserve: none, not the statement's, Budget-new-input: 4000000, Budget-output: 1500000, Budget-reserve: none/);
  for (const d of [sc.dir, wrong.dir]) rmSync(d, { recursive: true, force: true });
});

// Round 6 of the review of the result of task releases-and-task (D-148).
test("[check.task-result.ending-round-one-function] a commit missing from Commits: of the round that would end the task refuses its acceptance in the check, --task and --rounds alike; a round that ends nothing is only information", () => {
  const ghost = "1".repeat(7);
  const run = (sc) => {
    writeFileSync(join(sc.dir, "statement.md"), A_TEXT);
    return checkWith(sc, {}, ["--task", "t", "--statement", join(sc.dir, "statement.md"), "--rounds"]);
  };
  // The last round, clean on merging and in its acceptance, whose range starts at a commit the repository lacks.
  const clean = scenario({ rounds: [approvedA, finalRound({ commits: `${ghost}..${CA.slice(0, 7)}` })], done: [{ time: T(11) }] });
  const c = run(clean);
  assert.equal(c.status, 1, c.stdout);
  assert.match(c.stdout, /ERROR · rounds that give the acceptance of a task whose commits are not in the repository \(1\):\n  r1\.md: the round gives the acceptance of the latest record of done of t, and its line Commits: names commit 1111111, which is not in the repository/);
  assert.match(c.stdout, /NEXT t: the verdict of acceptance of r1\.md is refused: its line Commits: names commit 1111111, which is not in the repository/);
  assert.match(c.stdout, /NEXT t: the verdict of acceptance of r1\.md is refused: its line Commits: names commit 1111111/);
  assert.doesNotMatch(c.stdout, /the task is done|NEXT t: done|result-review: [^\n]*the step ended clean|ONT_OK/);
  // The same round with a finding on merging and a clean acceptance ends nothing: its missing commit is information.
  const found = scenario({ rounds: [approvedA, finalRound({ commits: `${ghost}..${CA.slice(0, 7)}`, found: 1 })], done: [{ time: T(11) }] });
  const f = run(found);
  assert.equal(f.status, 0, f.stdout);
  assert.doesNotMatch(f.stdout, /rounds that give the acceptance of a task whose commits are not in the repository/);
  assert.match(f.stdout, /info · rounds of review whose commits this clone does not have [^\n]*\(1\):\n  r1\.md: names a commit this clone does not have, 1111111/);
  assert.doesNotMatch(f.stdout, /the task is done|NEXT t: done/);
  assert.match(f.stdout, /ONT_OK/);
  // A clean round followed by a later clean round that names commits the repository has: the first ends nothing, the task is done.
  const later = scenario({ rounds: [approvedA, finalRound({ commits: `${ghost}..${CA.slice(0, 7)}` }), finalRound({ number: 2, time: T(13) })], done: [{ time: T(11) }] });
  const l = run(later);
  assert.equal(l.status, 0, l.stdout);
  assert.match(l.stdout, /info · rounds of review whose commits this clone does not have [^\n]*\(1\):\n  r1\.md: names a commit this clone does not have, 1111111/);
  assert.match(l.stdout, /NEXT t: done: the last round and its acceptance are clean/);
  assert.match(l.stdout, /NEXT t: done/);
  assert.match(l.stdout, /ONT_OK/);
  for (const d of [clean.dir, found.dir, later.dir]) rmSync(d, { recursive: true, force: true });
});

test("[check.task-statement.reserve-of-statement] a statement's line Budget-reserve: is read with its limits, by --task from the file and by the check and --rounds from the record of done, so a spend between the limit and the limit times the reserve lets the next round go", () => {
  const withReserve = "version R\nDone-when: npm test\nBudget-new-input: 3000000\nBudget-output: 1500000\nBudget-reserve: 1.5\n";
  const without = "version N\nDone-when: npm test\nBudget-new-input: 3000000\nBudget-output: 1500000\n";
  const [HR, HN] = [sha256(withReserve), sha256(without)];
  // A spend of 3200000 new input and 1000000 output, past the limit of 3000000 and within 3000000 × 1.5, and a round of the result with a finding.
  const spent = (hash) => [{ ...approvedA, hash }, { step: "result-review", number: 1, time: T(12), hash, found: 1, tokens: [3200000, 0, 1000000], commits: `${CB.slice(0, 7)}..${CA.slice(0, 7)}` }];
  const sc = scenario({ rounds: spent(HR), done: [{ time: T(11), hash: HR, budget: [3000000, 1500000, 1.5] }] });
  writeFileSync(join(sc.dir, "statement.md"), withReserve);
  const r = checkWith(sc, { budget: { newInput: 100, output: 100 } }, ["--task", "t", "--statement", join(sc.dir, "statement.md"), "--rounds"]);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /BUDGET t: new input 3200000 of 3000000 × 1\.5 = 4500000, output 1000000 of 1500000 × 1\.5 = 2250000; known for 1 of 2 contributions\n/);
  assert.match(r.stdout, /NEXT t: narrow round 1, on the fixes of the last round/);
  assert.match(r.stdout, /NEXT t: narrow round 1, on the fixes of the last round/);
  assert.doesNotMatch(r.stdout, /exhausted|question to the owner/);
  assert.match(r.stdout, /ONT_OK/);
  // Without the line the reserve is 1: the same spend stops the next round, in --task and --rounds alike.
  const no = scenario({ rounds: spent(HN), done: [{ time: T(11), hash: HN, budget: [3000000, 1500000] }] });
  writeFileSync(join(no.dir, "statement.md"), without);
  const n = checkWith(no, {}, ["--task", "t", "--statement", join(no.dir, "statement.md"), "--rounds"]);
  assert.match(n.stdout, /NEXT t: (.*: )?the budget is exhausted: a question to the owner/);
  assert.match(n.stdout, /NEXT t: (.*: )?the budget is exhausted: a question to the owner/);
  assert.match(n.stdout, /so the reserve is 1/);
  // The statement's reserve comes before the configuration's, as its limits do.
  const st = taskBudget({ rounds: sc.rounds, spend: [], done: sc.records.done, task: "t", defaults: limits(100, 100, 2), statement: readStatement(join(sc.dir, "statement.md")) });
  assert.equal(st.reserve, 1.5);
  assert.deepEqual(st.limits, { newInput: 3000000, output: 1500000 });
  // done.mjs writes the line, and --task refuses a record of done of the version whose reserve is not the file's, and a line it cannot read.
  assert.deepEqual(budgetLines(readStatement(join(sc.dir, "statement.md")).budget), ["Budget-new-input: 3000000", "Budget-output: 1500000", "Budget-reserve: 1.5"]);
  const other = scenario({ rounds: spent(HR), done: [{ time: T(11), hash: HR, budget: [3000000, 1500000] }] });
  writeFileSync(join(other.dir, "statement.md"), withReserve);
  const o = checkWith(other, {}, ["--task", "t", "--statement", join(other.dir, "statement.md")]);
  assert.equal(o.status, 1, o.stdout);
  assert.match(o.stdout, /d0\.md: the record of done carries the limits Budget-new-input: 3000000, Budget-output: 1500000, Budget-reserve: none, not the statement's, Budget-new-input: 3000000, Budget-output: 1500000, Budget-reserve: 1\.5/);
  const comma = join(other.dir, "comma.md");
  writeFileSync(comma, "version C\nDone-when: npm test\nBudget-new-input: 3000000\nBudget-output: 1500000\nBudget-reserve: 1,5\n");
  assert.deepEqual(readStatement(comma).wrong, ["Budget-reserve: 1,5 is not a number of 1 or more, a whole number or a decimal with a point"]);
  // A reserve has at most two decimal digits, in a statement and in the configuration (D-150).
  assert.equal(reserveOf("1.25"), 1.25);
  assert.equal(reserveOf("1.9300000000000002"), null);
  const cfgBad = join(other.dir, "bad.config.json");
  writeFileSync(cfgBad, JSON.stringify({ classes: { ent: "Entity" }, ontology: "ontology.md", budget: { newInput: 3000000, reserve: 1.9300000000000002 } }));
  assert.throws(() => loadConfig(cfgBad), /budget\.reserve 1\.9300000000000002 is not a number of 1 or more with at most two digits/);
  // The cap is exact: 3000000 × 1.1 is 3300000, so a spend of exactly 3300000 stops (D-150).
  const exact = taskBudget({ rounds: [{ task: "t", step: "result-review", number: 1, time: T(12), tokens: { new: 3300000, cached: 0, out: 0 }, findings: [] }], spend: [], done: [], task: "t", defaults: limits(3000000, null, 1.1), statement: null });
  assert.equal(exact.cap.newInput, 3300000);
  assert.equal(exact.exhausted, true, "a spend of exactly the limit times the reserve stops");
  // A line of the budget the tool cannot read stops the task with one answer, and done.mjs refuses it
  // rather than writing the reserve as none (D-150).
  const bad = scenario({ rounds: spent(sha256(readFileSync(comma))), done: [] });
  writeFileSync(join(bad.dir, "statement.md"), readFileSync(comma));
  const c = checkWith(bad, {}, ["--task", "t", "--statement", join(bad.dir, "statement.md")]);
  assert.match(c.stdout, /a line of the statement's budget cannot be read/);
  assert.doesNotMatch(c.stdout, /work may (start|go on)/, c.stdout);
  assert.doesNotMatch(c.stdout, /NEXT t: the budget is exhausted/, "the result line names the unreadable line, not a spent budget");
  for (const d of [sc.dir, no.dir, other.dir, bad.dir]) rmSync(d, { recursive: true, force: true });
});

test("[check.task-result.latest-done] at the budget's cap, the state of the result says a clean acceptance of an earlier record of done is refused, never clean, in --task and in --rounds", () => {
  const sc = scenario({ rounds: [approvedA, finalRound()], done: [{ time: T(11) }, { time: T(13), commit: CC }], spend: [{ start: T(13, 10), end: T(13, 20), tokens: [1000, 0, 0] }] });
  const refused = new RegExp(`TASK t · result: the last round of its review, r1\\.md, is clean on merging, its verdict of acceptance is refused: the record of done d1\\.md, of commit ${CC.slice(0, 7)}, was made after it`);
  const out = state(sc, { statement: fileOf(A), defaults: limits(1000, 1000) });
  assert.match(out, /NEXT t: the budget is exhausted: a question to the owner/);
  assert.match(out, refused);
  assert.doesNotMatch(out, /its acceptance is clean/);
  const r = checkWith(sc, { budget: limits(1000, 1000) }, ["--rounds"]);
  assert.match(r.stdout, /NEXT t: the budget is exhausted: a question to the owner/);
  assert.match(r.stdout, refused);
  assert.doesNotMatch(r.stdout, /its acceptance is clean/);
  rmSync(sc.dir, { recursive: true, force: true });
});

test("[check.task-statement.gates-from] a round of the result at gatesFrom that names a version, with no approval history, is not legacy: --task, --rounds and done.mjs give no round of the result", () => {
  const sc = scenario({ rounds: [{ step: "result-review", number: 1, time: T(12), hash: A, found: 1 }] });
  writeFileSync(join(sc.dir, "statement.md"), A_TEXT);
  const gated = { reviewRounds: { dir: join(sc.dir, "rounds"), gatesFrom: T(11) } };
  for (const args of [["--task", "t", "--statement", join(sc.dir, "statement.md")], ["--rounds"]]) {
    const r = checkWith(sc, gated, args);
    assert.equal(nextLines(r).join("\n"), "NEXT t: it needs a review of the statement", `${args[0]}: ${r.stdout}`);
    assert.match(r.stdout, /TASK t · result: work is not allowed/, args[0]);
    assert.doesNotMatch(r.stdout, /narrow round|full round \d+ of the review of the result/, args[0]);
  }
  rmSync(sc.dir, { recursive: true, force: true });
  const { repo, outside, done, clean } = doneRepo("t");
  try {
    const cfg = JSON.parse(readFileSync(join(repo, "ont.config.json"), "utf8"));
    writeFileSync(join(repo, "ont.config.json"), JSON.stringify({ ...cfg, reviewRounds: { dir: "rounds", gatesFrom: T(11) } }));
    rmSync(join(repo, "rounds", "1.md"));
    writeFileSync(join(repo, "rounds", "2.md"), roundText({ task: "t", step: "result-review", number: 1, time: T(12), hash: readStatement(join(outside, "s.md")).hash, found: 1 }));
    const r = done("t");
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /no record of done written: the task's next action is not work on the result: it needs a review of the statement/);
    assert.doesNotMatch(r.stdout, /round of the review of the result/);
  } finally {
    clean();
  }
});

test("[check.review-round.result-names-version] a round of the result with no Statement-hash: before gatesFrom, after the owner's approval of its task, is legacy: it is not late and blocks no task", () => {
  const sc = scenario({ rounds: [{ step: "result-review", number: 1, time: T(10, 30), found: 1 }], approvals: [{ time: T(10) }] });
  writeFileSync(join(sc.dir, "statement.md"), A_TEXT);
  const gated = { reviewRounds: { dir: join(sc.dir, "rounds"), gatesFrom: T(11) } };
  for (const args of [["--task", "t", "--statement", join(sc.dir, "statement.md")], ["--rounds"]]) {
    const r = checkWith(sc, gated, args);
    assert.doesNotMatch(r.stdout + r.stderr, /r0\.md: a late record|correct the records/, `${args[0]}: ${r.stdout}`);
    assert.equal(nextLines(r).length, 1, `${args[0]}: ${r.stdout}`);
  }
  rmSync(sc.dir, { recursive: true, force: true });
});

test("[check.task-statement.gates-from] a task whose records all predate gatesFrom and name versions keeps the statement's branches: the real releases-and-task asks for the file, and for a full round when the file changed", () => {
  const cfg = loadConfig(fileURLToPath(new URL("../../../ont.config.json", import.meta.url)));
  const { rounds } = readRoundRecords(cfg);
  const records = parseTaskRecords(cfg.taskRecords.dir);
  const at = (statement, needFile) => taskState({ rounds, spend: records.spend, done: records.done, approvals: records.approvals, task: "releases-and-task", defaults: cfg.budget, statement, gatesFrom: cfg.reviewRounds.gatesFrom, needFile }).next;
  assert.equal(at(null, true).branch, "no version");
  assert.equal(at(null, true).say, "give --statement <file> to compare the version it names with the file");
  assert.equal(at(fileOf(B), true).branch, "changed");
  assert.match(at(fileOf(B), true).say, /^the statement changed after its approval: next is full round \d+ of the new version$/);
  // --rounds, given no file, compares no version: the task is done, as on main.
  assert.equal(at(null, false).branch, "done");
});

test("[check.task-statement.gates-from] before gatesFrom, an approval withdrawn by a later round of the statement with findings allows no work: --task and --rounds give the statement's next round, never a round of the result", () => {
  const rounds = [approvedA, { step: "result-review", number: 1, time: T(9, 30), hash: A, found: 1 }, { step: "statement-review", number: 2, time: T(10), hash: B, found: 1 }];
  const sc = scenario({ rounds });
  writeFileSync(join(sc.dir, "b.md"), B_TEXT);
  const gated = { reviewRounds: { dir: join(sc.dir, "rounds"), gatesFrom: T(11) } };
  const outs = [["--task", "t", "--statement", join(sc.dir, "b.md")], ["--rounds"]].map((args) => checkWith(sc, gated, args).stdout);
  for (const out of outs) {
    assert.match(out, /TASK t · result: work is not allowed/, out);
    assert.match(out, /TASK t · statement: the last round of its review, r2\.md, found findings of the change/, out);
  }
  // The one next action is the statement's, by the branch under review, the same in both.
  const next = taskNext({ rounds: sc.rounds, task: "t", statement: fileOf(B), needFile: true, gatesFrom: T(11) });
  assert.equal(next.branch, "under review");
  assert.equal(next.say, stepNext({ rounds: sc.rounds, task: "t", step: "statement-review", gatesFrom: T(11) }).say);
  for (const out of outs) assert.deepEqual(nextLines({ stdout: out }), [`NEXT t: ${next.say}`]);
  rmSync(sc.dir, { recursive: true, force: true });
});

// done.mjs, --task and --rounds in one repository of doneRepo: the NEXT lines of the two views, by the
// reader and the function the two commands use (readTaskInputs, taskState), and the refusal of done.mjs
// (D-152).
const threeViews = (repo, outside, done) => {
  const cfg = loadConfig(join(repo, "ont.config.json"));
  const { rounds, malformed, records } = readTaskInputs(cfg);
  const view = (statement, needFile) =>
    taskState({ rounds, spend: records.spend, done: records.done, approvals: records.approvals, task: "t", defaults: cfg.budget, statement, malformed, gatesFrom: cfg.reviewRounds.gatesFrom ?? null, needFile }).lines.filter((l) => l.startsWith("NEXT t:"));
  return { task: view(readStatement(join(outside, "s.md")), true), rounds: view(null, false), done: done("t") };
};

test("[check.review-round.result-names-version] a clean round of the statement with no Statement-hash: at or after gatesFrom cannot be read: --task, --rounds and done.mjs ask to correct it", () => {
  const { repo, outside, done, clean } = doneRepo("t");
  try {
    const cfg = JSON.parse(readFileSync(join(repo, "ont.config.json"), "utf8"));
    writeFileSync(join(repo, "ont.config.json"), JSON.stringify({ ...cfg, reviewRounds: { dir: "rounds", gatesFrom: T(8) } }));
    writeFileSync(join(repo, "rounds", "1.md"), roundText({ task: "t", step: "statement-review", number: 1, time: T(9) }));
    const v = threeViews(repo, outside, done);
    assert.deepEqual(v.task, ["NEXT t: correct the records that cannot be read first: the one next action (1.md)"]);
    assert.deepEqual(v.rounds, v.task);
    assert.equal(v.done.status, 1, v.done.stdout);
    assert.match(v.done.stdout, /no record of done written: correct the records that cannot be read first: the one next action \(1\.md\): 1\.md: no line Statement-hash: on a round at or after reviewRounds\.gatesFrom/);
  } finally {
    clean();
  }
});

test("[check.task-statement.budget-one-action] with no approval in force, done.mjs refuses with the action --task and --rounds give: the budget question at the cap, the gate when one is open", () => {
  for (const [kind, extra, want] of [
    ["cap", { found: 1 }, /the budget is exhausted: a question to the owner/],
    ["gate", { found: 1, fix: "not fixable" }, /a question to the owner: a finding cannot be fixed/],
  ]) {
    const { repo, outside, done, clean } = doneRepo("t");
    try {
      const cfg = JSON.parse(readFileSync(join(repo, "ont.config.json"), "utf8"));
      writeFileSync(join(repo, "ont.config.json"), JSON.stringify({ ...cfg, ...(kind === "cap" ? { budget: { newInput: 1000, output: 1000 } } : {}) }));
      writeFileSync(join(repo, "rounds", "1.md"), roundText({ task: "t", step: "statement-review", number: 1, time: T(9), hash: readStatement(join(outside, "s.md")).hash, ...extra }));
      if (kind === "cap") writeFileSync(join(repo, "tasks", "s.md"), spendText({ start: T(9, 30), end: T(9, 40), tokens: [1000, 0, 0] }));
      const v = threeViews(repo, outside, done);
      assert.equal(v.task.length, 1, kind);
      assert.match(v.task[0], want, kind);
      assert.deepEqual(v.rounds, v.task, kind);
      assert.equal(v.done.status, 1, v.done.stdout);
      assert.equal(v.done.stdout.trim(), `ERROR · no record of done written: the task's next action is not work on the result: ${v.task[0].slice("NEXT t: ".length)}`, kind);
    } finally {
      clean();
    }
  }
});

test("[check.task-statement.budget-one-action] an approved statement whose budget line cannot be read, or that has no command of done, makes done.mjs refuse with the action --task gives: the question to the owner", () => {
  for (const [kind, text, want] of [
    ["unreadable budget", "# A statement\n\nDone-when: true\nBudget-new-input: 100\nBudget-reserve: 1,5\n", /^NEXT t: a line of the statement's budget cannot be read: a question to the owner, with no next round \(Budget-reserve: 1,5 is not/],
    ["no Done-when", "# A statement\n", /^NEXT t: the approved statement has no line Done-when: with a command of done: a question to the owner, with no next round$/],
  ]) {
    const { repo, outside, done, clean } = doneRepo("t");
    try {
      writeFileSync(join(outside, "s.md"), text);
      writeFileSync(join(repo, "rounds", "1.md"), roundText({ task: "t", step: "statement-review", number: 1, time: T(9), hash: readStatement(join(outside, "s.md")).hash }));
      const v = threeViews(repo, outside, done);
      assert.equal(v.task.length, 1, kind);
      assert.match(v.task[0], want, kind);
      assert.equal(v.done.status, 1, v.done.stdout);
      assert.equal(v.done.stdout.trim(), `ERROR · no record of done written: the task's next action is not work on the result: ${v.task[0].slice("NEXT t: ".length)}`, kind);
    } finally {
      clean();
    }
  }
});

test("[check.task-statement.budget-one-action] under an approval in force, a legacy last round of the result with a finding not fixable is the owner's question: done.mjs refuses with it, as --task and --rounds give it", () => {
  const { repo, outside, done, clean } = doneRepo("t");
  try {
    const cfg = JSON.parse(readFileSync(join(repo, "ont.config.json"), "utf8"));
    writeFileSync(join(repo, "ont.config.json"), JSON.stringify({ ...cfg, reviewRounds: { dir: "rounds", gatesFrom: T(11) } }));
    writeFileSync(join(repo, "rounds", "2.md"), roundText({ task: "t", step: "result-review", number: 1, time: T(10), hash: readStatement(join(outside, "s.md")).hash, found: 1, fix: "not fixable" }));
    const v = threeViews(repo, outside, done);
    assert.equal(v.task.length, 1, v.task.join("\n"));
    assert.match(v.task[0], /^NEXT t: a question to the owner: a finding cannot be fixed/);
    assert.deepEqual(v.rounds, v.task);
    assert.equal(v.done.status, 1, v.done.stdout);
    assert.equal(v.done.stdout.trim(), `ERROR · no record of done written: the task's next action is not work on the result: ${v.task[0].slice("NEXT t: ".length)}`);
  } finally {
    clean();
  }
});

// The condition confirmed (D-153), read alike by --task, --rounds, the check and done.mjs, under version
// V of a statement whose command of done is true, so that done.mjs can run it: its approval, a record of
// done of commit a and rounds of its result that review that commit.
const V_TEXT = "version V\nDone-when: true\n";
const V = sha256(V_TEXT);
const approvedV = { step: "statement-review", number: 1, time: T(9), hash: V };
const doneV = { time: T(10), hash: V, command: "true" };
const resultV = (number, extra = {}) => ({ step: "result-review", number, time: T(10 + number + (extra.narrow ? 5 : 0)), hash: V, commits: CA.slice(0, 7), acceptance: "clean", ...extra });
const BEFORE = ["- old · important · before · fixable"];
// Every reader of one history: the NEXT lines of --task and --rounds, the errors of the check, and the
// exit of done.mjs, 0 when it ran the command of done on the commit and recorded done, 1 when it refused,
// with its output. done.mjs runs in a clone of the repository with a committed configuration naming the
// same records, so that its command runs for real in the worktree it makes at the commit.
function readers(h, budget = null, { skipDone = false, args = null } = {}) {
  const sc = scenario({ rounds: [approvedV, ...h.rounds], done: [doneV, ...(h.done ?? [])], approvals: h.approvals ?? [] });
  const file = join(sc.dir, "v.md");
  writeFileSync(file, V_TEXT);
  const extra = budget ? { budget } : {};
  const r = checkWith(sc, extra, args ?? ["--task", "t", "--statement", file, "--rounds"]);
  if (skipDone) {
    rmSync(sc.dir, { recursive: true, force: true });
    return { next: nextLines(r), out: r.stdout, status: r.status };
  }
  // A clone of the repository of commits a, b and c, which the records name, so that they resolve.
  const own = mkdtempSync(join(tmpdir(), "done-own-"));
  git(own, "clone", "-q", REPO, ".");
  writeFileSync(join(own, "ont.config.json"), JSON.stringify({ classes: { ent: "Entity" }, ontology: "ontology.md", reviewRounds: { dir: join(sc.dir, "rounds") }, taskRecords: { dir: join(sc.dir, "tasks") }, ...extra }));
  git(own, "add", ".");
  git(own, "commit", "-q", "-m", "config");
  const d = spawnSync("node", [join(TOOLS, "done.mjs"), "t", "--statement", file, "--config", join(own, "ont.config.json")], { encoding: "utf8" });
  rmSync(own, { recursive: true, force: true });
  rmSync(sc.dir, { recursive: true, force: true });
  return { next: nextLines(r), out: r.stdout, status: r.status, done: d.status, doneOut: d.stdout };
}
const ENDS = /^NEXT t: done/;
const NARROW = /^NEXT t: the reviewer confirmed the goal's condition in r\d+\.md: narrow round 1, the one round after it/;
// After the round after C that did not end the step, neither a question nor a round (D-164): its fixes held
// by tests, or, with no verdict of acceptance or one refused, that verdict again on the same result.
const FIXES = /^NEXT t: the reviewer confirmed the goal's condition in r1\.md and r2\.md is the one round after it: fix its findings of the usual path with tests, get one issue of verdicts on the diff of the fixes \(--review [0-9a-f]{7} --record\), fix the findings of the usual path of that issue with tests, then record done with done\.mjs; no round and no question follow \(rule\.fixes-held-by-tests\)$/;
const AGAIN = (why) => new RegExp(`^NEXT t: r2\\.md, the one round after the confirmed condition in r1\\.md, ${why}: its reviewer gives it (again )?on the same result, recorded after it as the narrow round's; no new round \\(rule\\.fixes-held-by-tests\\)$`);
const NO_ACCEPTANCE = "has no verdict of acceptance";
const REFUSED = "has a verdict of acceptance the tool refuses \\(the record of done d0\\.md is of commit [0-9a-f]{7}, not of the commit the round reviewed, [0-9a-f]{7}\\)";
// A clean last round with its acceptance holding, a clean narrow round included: the merge.
const CLEAN_MERGE = /^NEXT t: done: the last round and its acceptance are clean: merge \(rule\.ready-after-clean-round\)$/;
const MERGE = /^NEXT t: done: the record of done d1\.md ends the range of fixes after r2\.md, whose verdict of acceptance holds: merge \(rule\.fixes-held-by-tests\)$/;
// The cases of the branch condition confirmed, each on its side of its boundary, with the case of
// derived.next-round its rounds fall under.
const CONDITION_CASES = {
  "C, nothing left, acceptance holds": { rounds: [resultV(1, { condition: true })], next: ENDS, doneMjs: 0 },
  "C, a finding there before only": { rounds: [resultV(1, { condition: true, extra: BEFORE })], next: ENDS, doneMjs: 0 },
  "C, a finding left": { rounds: [resultV(1, { condition: true, found: 1 })], next: NARROW, doneMjs: 0 },
  "C, a nit left": { rounds: [resultV(1, { condition: true, extra: ["- small · nit · change · fixable · t.test.mjs"] })], next: NARROW, doneMjs: 0 },
  "C, no acceptance": { rounds: [resultV(1, { condition: true, acceptance: undefined })], next: NARROW, doneMjs: 0 },
  "C, acceptance refused": { rounds: [resultV(1, { condition: true, commits: CB.slice(0, 7) })], next: NARROW, doneMjs: 0 },
  "after C, narrow, nothing left": { rounds: [resultV(1, { condition: true, found: 1 }), resultV(1, { narrow: true, extra: BEFORE })], next: ENDS, doneMjs: 0 },
  "after C, full, nothing left": { rounds: [resultV(1, { condition: true, found: 1 }), resultV(2)], next: ENDS, doneMjs: 0 },
  "after C, a finding left": { rounds: [resultV(1, { condition: true, found: 1 }), resultV(1, { narrow: true, found: 1, prefix: "other" })], next: FIXES, doneMjs: 0 },
  "after C, no acceptance": { rounds: [resultV(1, { condition: true, found: 1 }), resultV(2, { acceptance: undefined })], next: AGAIN(NO_ACCEPTANCE), doneMjs: 0 },
  "after C, acceptance refused": { rounds: [resultV(1, { condition: true, found: 1 }), resultV(1, { narrow: true, commits: CB.slice(0, 7) })], next: AGAIN(REFUSED), doneMjs: 0 },
  "after C, Condition: holds again": { rounds: [resultV(1, { condition: true, found: 1 }), resultV(1, { narrow: true, condition: true, found: 1, prefix: "other" })], next: FIXES, doneMjs: 0 },
};

test("[check.review-round.condition-branch] --task, --rounds, the check and done.mjs give each case of the condition confirmed alike", () => {
  for (const [name, h] of Object.entries(CONDITION_CASES)) {
    const r = readers(h);
    assert.equal(r.next.length, 2, `${name}: ${r.out}`);
    assert.equal(r.next[0], r.next[1], `${name}: --task and --rounds disagree`);
    assert.match(r.next[0], h.next, `${name}: ${r.out}`);
    assert.equal(r.done, h.doneMjs, `${name}, done.mjs: ${r.doneOut}`);
    // done.mjs records done after its command passed for real, or refuses with the same question.
    if (h.doneMjs === 0) assert.match(r.doneOut, /^DONE t: 1 commands passed on [0-9a-f]{7}/, name);
    else assert.match(r.doneOut, h.next, name);
    // The check passes, but where the history holds a refused verdict of acceptance, which it reports.
    const refusedHere = name.includes("acceptance refused");
    assert.equal(r.status, refusedHere ? 1 : 0, `${name}, the check: ${r.out}`);
    if (refusedHere) assert.match(r.out, /verdicts of acceptance refused/, name);
    assert.doesNotMatch(r.out, /names an overspend/, name);
    // The check's own decision that the step ended (ont-check.mjs, ended), the check run alone, with no
    // --task to report the line: an Overspend: line on the last round, within a budget that finds none, is
    // refused by it exactly when the step ended, and read as nothing otherwise.
    const last = h.rounds.length - 1;
    const marked = readers({ ...h, rounds: h.rounds.map((x, i) => (i === last ? { ...x, overspend: "new input 1 of 2, output 1 of 2" } : x)) }, null, { skipDone: true, args: [] });
    const ended = h.next === ENDS;
    assert.equal(/names an overspend, "new input 1 of 2, output 1 of 2", where the tool finds none/.test(marked.out), ended, `${name}, the check's end of the step: ${marked.out}`);
    assert.equal(marked.status, ended || refusedHere ? 1 : 0, `${name}, the check with Overspend:: ${marked.out}`);
  }
});

test("[check.review-round.condition-gate] after C only a finding not fixable and a spent budget are questions: the gate holds over the task, a reviewer's approval of a new version too, until the owner's approval; an open gate comes first; both ends by C at the budget's limit end the task", () => {
  // (e) A finding not fixable in the narrow round after C is the question to the owner.
  const failed = [resultV(1, { condition: true, found: 1 }), resultV(1, { narrow: true, found: 1, fix: "not fixable", prefix: "nf" })];
  const GATE = /^NEXT t: a question to the owner: a finding cannot be fixed without changing what the owner decided, and only his approval of a version answers it \(r2\.md\)$/;
  const gate = readers({ rounds: failed });
  for (const l of gate.next) assert.match(l, GATE, gate.out);
  assert.equal(gate.done, 1, gate.doneOut);
  assert.match(gate.doneOut, /a finding cannot be fixed/);
  const W_TEXT = "version W\nDone-when: true\n";
  const W = sha256(W_TEXT);
  // A clean round of the statement approves W, a record of done of W and a clean acceptance of it.
  const approvedW = { step: "statement-review", number: 2, time: T(20), hash: W };
  const reviewer = readers({ rounds: [...failed, approvedW, { ...resultV(3), time: T(22), hash: W }], done: [{ time: T(21), hash: W, command: "true" }] });
  for (const l of reviewer.next) assert.match(l, GATE, reviewer.out);
  assert.equal(reviewer.done, 1, reviewer.doneOut);
  // The owner's approval of V closes it: work goes on.
  const owner = readers({ rounds: failed, approvals: [{ hash: V, time: T(20) }] });
  for (const l of owner.next) assert.doesNotMatch(l, /a question to the owner/, owner.out);
  assert.equal(owner.done, 0, `${owner.out}\n${owner.doneOut}`);
  // A finding not fixable before C: its gate is named first.
  const first = readers({ rounds: [resultV(1, { found: 1, fix: "not fixable", prefix: "nf" }), resultV(2, { condition: true, found: 1 }), resultV(3, { found: 1, prefix: "other" })] });
  for (const l of first.next) assert.match(l, /^NEXT t: a question to the owner: a finding cannot be fixed/, first.out);
  // Both ends by C past the budget are ends: done with an overspend, which the check requires named.
  const budget = { newInput: 100, output: 100 };
  for (const [name, rounds] of [
    ["C", [resultV(1, { condition: true, tokens: [500, 0, 10] })]],
    ["after C", [resultV(1, { condition: true, found: 1, tokens: [500, 0, 10] }), resultV(1, { narrow: true })]],
  ]) {
    const r = readers({ rounds }, budget);
    // The overspend is reported with the merge, never in its place (derived.task-next).
    for (const l of r.next) assert.match(l, /^NEXT t: done, with an overspend: new input 500 of 100, output 10 of 100; report it to the owner, and the last round and its acceptance are clean: merge \(rule\.ready-after-clean-round\)$/, `${name}: ${r.out}`);
    assert.match(r.out, /does not name the overspend|Overspend: is not the tool's/, name);
  }
  // The range of fixes closed past the budget by the record of done after the narrow round: the merge too.
  const closed = readers({ rounds: [resultV(1, { condition: true, found: 1, tokens: [500, 0, 10] }), resultV(1, { narrow: true, found: 1, prefix: "other" })], done: [{ time: T(17), hash: V, command: "true", commit: CC }] }, budget, { skipDone: true });
  assert.equal(closed.next.length, 2, closed.out);
  for (const l of closed.next) assert.match(l, /^NEXT t: done, with an overspend: new input 500 of 100, output 10 of 100; report it to the owner, and the record of done d1\.md ends the range of fixes after r2\.md, whose verdict of acceptance holds: merge \(rule\.fixes-held-by-tests\)$/, closed.out);
  // (zh) Past the budget, the round after C that does not end the step is the budget question, and done.mjs
  // refuses; within it, the same round is the fixes, never a question.
  const over = readers({ rounds: [resultV(1, { condition: true, found: 1, tokens: [500, 0, 10] }), resultV(1, { narrow: true, found: 1, prefix: "other" })] }, budget);
  for (const l of over.next) assert.match(l, /^NEXT t: the budget is exhausted: a question to the owner$/, over.out);
  assert.equal(over.done, 1, over.doneOut);
  const within = readers({ rounds: [resultV(1, { condition: true, found: 1, tokens: [50, 0, 10] }), resultV(1, { narrow: true, found: 1, prefix: "other" })] }, budget);
  for (const l of within.next) assert.match(l, FIXES, within.out);
});

// Every reader of the range of fixes gives it the same end before done (item 0 of the statement of task
// enforcement-after-condition): --task and --rounds, through taskState, the working copy's HEAD, as the
// verdicts do; once a record of done ends the range, its commit, whatever HEAD is.
test("[check.review-round.fixes-after-narrow] --task and --rounds end the range of fixes at the HEAD they are given before done, and at the record of done after it", () => {
  const C1 = resultV(1, { condition: true, found: 1 });
  const narrow = resultV(1, { narrow: true, found: 1, prefix: "other" });
  const of = (h, head, needFile) => {
    const sc = scenario({ rounds: [approvedV, ...h.rounds], done: [doneV, ...(h.done ?? [])] });
    rmSync(sc.dir, { recursive: true, force: true });
    const statement = needFile ? { hash: V, doneWhen: ["true"], budget: { newInput: null, output: null } } : null;
    return taskState({ rounds: sc.rounds, spend: sc.records.spend, done: sc.records.done, approvals: sc.records.approvals, task: "t", defaults: { newInput: null, output: null, reserve: null }, statement, needFile, head }).next.result.fixes;
  };
  for (const needFile of [true, false]) {
    const reader = needFile ? "--task" : "--rounds";
    const open = of({ rounds: [C1, narrow] }, CB, needFile);
    assert.equal(open?.from, CA.slice(0, 7), reader);
    assert.equal(open.done, null, reader);
    assert.equal(open.end, CB, `${reader}: the end before done is the HEAD given`);
    const ended = of({ rounds: [C1, narrow], done: [{ time: T(17), hash: V, command: "true", commit: CC }] }, CB, needFile);
    assert.equal(ended.end, ended.done.commit, `${reader}: the record of done ends the range`);
  }
});

// The path after the narrow round (rule.fixes-held-by-tests, D-164), items (a), (b), (v), (g) and (d) of item 3 of the
// statement of task enforcement-after-condition, its letters transliterated; (e) and (zh) are in condition-gate: what --task, --rounds, the check and done.mjs give.
test("[check.review-round.fixes-after-narrow] after C and the narrow round, its findings are fixed with tests and recorded done, then the merge; with no verdict of acceptance that verdict first, never the merge", () => {
  const C1 = resultV(1, { condition: true, found: 1 });
  const ACCEPTANCE_FINDING = ["- item 3 not done · important · change · fixable · t.test.mjs"];
  for (const [name, h, next, doneMjs] of [
    // (a) Findings of the usual path in the narrow round, its acceptance holding: the fixes, then done.
    ["(a) findings of the usual path", { rounds: [C1, resultV(1, { narrow: true, found: 2, prefix: "other" })] }, FIXES, 0],
    // (b) Only a finding of acceptance: the same.
    ["(b) only a finding of acceptance", { rounds: [C1, resultV(1, { narrow: true, acceptance: ACCEPTANCE_FINDING })] }, FIXES, 0],
    // (v) A clean narrow round with a clean acceptance: done, and the next action is the merge at once, no
    // fixes, no issue of verdicts and no record of done before it.
    ["(v) a clean narrow round", { rounds: [C1, resultV(1, { narrow: true })] }, CLEAN_MERGE, 0],
    // (g) No verdict of acceptance: that verdict, never the merge.
    ["(g) no verdict of acceptance", { rounds: [C1, resultV(1, { narrow: true, found: 1, prefix: "other", acceptance: undefined })] }, AGAIN(NO_ACCEPTANCE), 0],
    // (d) A record of done on a later commit after the narrow round: done, the merge.
    ["(d) done after the narrow round", { rounds: [C1, resultV(1, { narrow: true, found: 1, prefix: "other" })], done: [{ time: T(17), hash: V, command: "true", commit: CC }] }, MERGE, 0],
  ]) {
    const r = readers(h);
    assert.equal(r.next.length, 2, `${name}: ${r.out}`);
    assert.equal(r.next[0], r.next[1], `${name}: --task and --rounds disagree`);
    assert.match(r.next[0], next, `${name}: ${r.out}`);
    assert.doesNotMatch(r.next[0], /a question to the owner|(narrow|full) round \d/, name);
    if (name.startsWith("(g)")) assert.doesNotMatch(r.next[0], /done:|merge/, name);
    if (name.startsWith("(v)")) assert.doesNotMatch(r.next[0], /fix|issue of verdicts|record done/, name);
    // The check passes: no verdict of acceptance is refused on the path.
    assert.equal(r.status, 0, `${name}, the check: ${r.out}`);
    assert.equal(r.done, doneMjs, `${name}, done.mjs: ${r.doneOut}`);
    assert.match(r.doneOut, /^DONE t: 1 commands passed on [0-9a-f]{7}/, name);
    // done.mjs, on a commit after the narrow round's, says that its record ends the range of fixes.
    if (next === FIXES) assert.match(r.doneOut, /^RANGE t: this record of done ends the range of fixes after the narrow round r2\.md, from [0-9a-f]{7} to [0-9a-f]{12} \(rule\.fixes-held-by-tests\)$/m, name);
  }
});
