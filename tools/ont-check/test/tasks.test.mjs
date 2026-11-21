// A task's statement and its approval, acceptance after done (D-152) and the task's budget (D-108).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { nextRound, parseRounds } from "../review-rounds.mjs";
import { acceptanceProblems, budgetLines, gitEnv, overlaps, parseTaskRecords, readStatement, reserveOf, sha256, stepNext, taskBudget, taskState } from "../tasks.mjs";
import { loadConfig } from "../lib.mjs";

const TOOLS = fileURLToPath(new URL("../", import.meta.url));
const EXAMPLE = fileURLToPath(new URL("../../../example/", import.meta.url));
// Version A of a statement: its one command of done is the one the records of done here ran.
const A_TEXT = "version A\nDone-when: npm test\n";
const A = sha256(A_TEXT);
const B = sha256("version B");
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
const roundText = ({ task = "t", step = "statement-review", number = 1, narrow, prefix = "class", fix = "fixable", start, time, hash, found = 0, tokens, contribution, acceptance, overspend, untested, commits }) =>
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
    ...(found ? ["Findings:", ...Array.from({ length: found }, (_, i) => finding(i, untested || fix !== "fixable" ? null : "t.test.mjs", prefix, fix))] : []),
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
  assert.match(state(scenario({})), /statement: it needs a review of the statement/);
});

test("[check.task-statement.findings-next] after a round of the statement with findings, the next round is what derived.next-round says", () => {
  const sc = scenario({ rounds: [{ ...approvedA, found: 2 }] });
  assert.match(state(sc, { statement: fileOf(A) }), /statement: narrow round 1, on the fixes of the last round/);
});

test("[check.task-statement.changed-after-approval] a statement edited after a clean round needs a full round of the new version with the next free number, after any number of rounds", () => {
  const sc = scenario({ rounds: [approvedA] });
  const out = state(sc, { statement: fileOf(B) });
  assert.match(out, /statement: the statement changed after its approval: next is full round 2 of the new version\n/);
  assert.match(out, /result: work is not allowed/);
  // Eight full rounds and four narrow ones, the last clean: full round 9, never a question.
  const many = [
    ...Array.from({ length: 8 }, (_, i) => ({ step: "statement-review", number: i + 1, time: T(1 + i), hash: A, found: 10 - i })),
    ...Array.from({ length: 4 }, (_, i) => ({ step: "statement-review", number: i + 1, narrow: true, time: T(10 + i), hash: A, found: i === 3 ? 0 : 1 })),
  ];
  const after = state(scenario({ rounds: many }), { statement: fileOf(B) });
  assert.match(after, /statement: the statement changed after its approval: next is full round 9 of the new version/);
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
  assert.match(out, /statement: narrow round 2, on the fixes of the last round/);
  assert.doesNotMatch(out, /ended clean|approved/);
  assert.match(out, /result: work is not allowed/);
  assert.deepEqual(acceptanceProblems(sc.rounds, sc.records.done), ["r3.md: acceptance of t refused: the record of done d0.md was made with no approval in force for its version of the statement"]);
  // Ordered full rounds first, the clean narrow round would have ended the step: by time it does not.
  assert.notEqual(nextRound(sc.rounds.filter((r) => r.step === "statement-review")).next, "clean");
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
const finalRound = (extra = {}) => ({ step: "result-review", number: 1, time: T(12), hash: A, acceptance: "clean", commits: `${CB.slice(0, 7)}..${CA.slice(0, 7)}`, ...extra });

test("[check.task-statement.budget-final-exact] a clean final round that spends the budget exactly ends the task with no question and no overspend", () => {
  const sc = scenario({ rounds: [{ ...approvedA, tokens: [500, 0, 10] }, finalRound({ tokens: [500, 0, 10] })], done: [{ time: T(11) }] });
  const out = state(sc, { statement: fileOf(A), defaults: limits(1000, 1000) });
  assert.match(out, /result: done: the last round and its acceptance are clean/);
  assert.doesNotMatch(out, /question|overspend/);
});

test("[check.task-statement.budget-final-over] a clean final round past the budget ends the task and says the overspend, which its record must name", () => {
  const named = scenario({ rounds: [{ ...approvedA, tokens: [500, 0, 10] }, finalRound({ tokens: [600, 0, 10], overspend: "new input 1100 of 1000, output 20 of 1000" })], done: [{ time: T(11) }] });
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
      { step: "result-review", number: 1, time: T(9), found: 3 },
      { step: "result-review", number: 2, time: T(10), found: 2, prefix: "other" },
    ],
  }).rounds;
  assert.equal(nextRound(rounds).next, "narrow");
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
  assert.match(state(sc, { statement: fileOf(A) }), /result: narrow round 1, on the fixes of the last round/);
  // The same round with acceptance clean ends the task.
  const clean = scenario({ rounds: [approvedA, finalRound()], done: [{ time: T(11) }] });
  assert.match(state(clean, { statement: fileOf(A) }), /result: done/);
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
  const r = checkWith(sc);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /verdicts of acceptance refused \(4\)/);
  rmSync(sc.dir, { recursive: true, force: true });
});

test("[check.task-result.acceptance-bound] an acceptance is refused for a done of another commit, for an approval given after the done, for an approval withdrawn before it, and for a statement file of another version", () => {
  // The record of done is of commit "c…", the round reviewed "a…".
  const other = scenario({ rounds: [approvedA, finalRound()], done: [{ time: T(11), commit: CC }] });
  assert.deepEqual(acceptanceProblems(other.rounds, other.records.done), [`r1.md: acceptance of t refused: the record of done d0.md is of commit ${CC.slice(0, 7)}, not of the commit the round reviewed, ${CA.slice(0, 7)}`]);
  assert.match(state(other, { statement: fileOf(A) }), new RegExp(`result: the verdict of acceptance of r1\\.md is refused: the record of done d0\\.md is of commit ${CC.slice(0, 7)}`));
  assert.doesNotMatch(state(other, { statement: fileOf(A) }), /result: done/);
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
  const sc = scenario({ rounds: [{ ...approvedA, tokens: [600, 0, 10] }, { step: "result-review", number: 1, time: T(12), found: 1, tokens: [600, 0, 10] }] });
  const out = state(sc, { statement: fileOf(A), defaults: limits(1000, 1000) });
  assert.match(out, /statement: approved, version [0-9a-f]{12}, but the budget is exhausted: a question to the owner; work may not go on/);
  assert.match(out, /result: the budget is exhausted: a question to the owner/);
  assert.doesNotMatch(out, /work may (start|go on) under it|round 2/);
  // Within the budget, the same rounds let work go on, and the next is round 2.
  const within = state(sc, { statement: fileOf(A), defaults: limits(10000, 10000) });
  assert.match(within, /statement: approved, version [0-9a-f]{12}: work may go on under it/);
  assert.match(within, /result: narrow round 1, on the fixes of the last round/);
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

test("[check.task-statement.question-alone] a finding not fixable makes the question the one next action, and the owner's approval of a new version lifts it", () => {
  const rounds = [approvedA, { step: "result-review", number: 1, time: T(12), hash: A, found: 1, fix: "not fixable" }];
  const out = state(scenario({ rounds }), { statement: fileOf(A) });
  assert.match(out, /statement: approved, version [0-9a-f]{12}; the question to the owner on the result is the one next action/);
  assert.match(out, /result: a question to the owner: a finding cannot be fixed without changing what the owner decided/);
  assert.doesNotMatch(out, /work may|narrow round|full round|records done/);
  // The owner answers with version B, approved: the question is lifted, and the next round of the
  // result takes the next free number.
  const sc = scenario({ rounds, approvals: [{ hash: B, time: T(13) }] });
  const after = state(sc, { statement: fileOf(B) });
  assert.match(after, /statement: approved by the owner \(a0\.md\), version [0-9a-f]{12}: work may go on under it/);
  assert.match(after, /result: the owner approved a later version: work goes on under it, then full round 2/);
  assert.doesNotMatch(after, /question/);
  rmSync(sc.dir, { recursive: true, force: true });
});

test("[check.task-statement.budget-report] REPORT names half from exactly half and limit from exactly the limit, for each kind apart, beside the next action", () => {
  const spendOf = (tokens) => [{ start: T(10), end: T(11), tokens }];
  const report = (tokens, rounds = [approvedA], extra = {}) => state(scenario({ rounds, spend: spendOf(tokens), ...extra }), { statement: fileOf(A), defaults: limits(1000, 100, 2) });
  const line = (out) => out.split("\n").find((l) => l.startsWith("REPORT")) ?? null;
  assert.equal(line(report([499, 0, 49])), null);
  assert.match(line(report([500, 0, 49])), /^REPORT t: new input 500 of 1000: half; send the owner one report/);
  assert.match(line(report([999, 0, 50])), /^REPORT t: new input 999 of 1000: half · output 50 of 100: half;/);
  assert.match(line(report([1000, 0, 99])), /new input 1000 of 1000: half, limit · output 99 of 100: half;/);
  assert.match(line(report([0, 0, 100])), /^REPORT t: output 100 of 100: half, limit;/);
  // One contribution that passes both marks gives both, and work goes on.
  const both = report([1500, 0, 0]);
  assert.match(line(both), /new input 1500 of 1000: half, limit/);
  assert.match(both, /work may start under it/);
  // Past the reserve, with a round with findings: the question, and the marks beside it.
  const past = report([2500, 0, 0], [approvedA, { step: "result-review", number: 1, time: T(12), hash: A, found: 1 }]);
  assert.match(past, /result: the budget is exhausted: a question to the owner/);
  assert.match(line(past), /half, limit/);
  // A clean round of acceptance past the reserve: done, no question.
  const doneOut = report([2500, 0, 0], [approvedA, finalRound()], { done: [{ time: T(11) }] });
  assert.match(doneOut, /result: done, with an overspend/);
  assert.doesNotMatch(doneOut, /question/);
  assert.match(line(doneOut), /half, limit/);
  // Records of one contribution that overlap: the question, and no REPORT.
  const overlap = state(scenario({ rounds: [approvedA], spend: [...spendOf([600, 0, 0]), { start: T(10, 30), end: T(12), tokens: [600, 0, 0] }] }), { statement: fileOf(A), defaults: limits(1000, 100, 2) });
  assert.match(overlap, /the spend cannot be summed/);
  assert.match(overlap, /result: the budget is exhausted: a question to the owner/);
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
  };
  const latin = { records: { latinOnly: true } };
  for (const [kind, text] of Object.entries(kinds)) {
    const sc = scenario({ rounds: [approvedA] });
    writeFileSync(join(sc.dir, "rounds", "r1.md"), text(A));
    writeFileSync(join(sc.dir, "statement.md"), A_TEXT);
    for (const args of [["--task", "t", "--statement", join(sc.dir, "statement.md")], ["--rounds"]]) {
      const r = checkWith(sc, latin, args);
      assert.equal(r.status, 1, `${kind} ${args[0]}: ${r.stdout}`);
      const lines = r.stdout.split("\n").filter((l) => /^(TASK|ROUNDS|BUDGET|REPORT)/.test(l));
      assert.ok(lines.length > 0, `${kind} ${args[0]}: ${r.stdout}`);
      for (const l of lines) assert.match(l, /correct the records of rounds that cannot be read first: the one next action \(r1\.md\)/, `${kind} ${args[0]}`);
      assert.doesNotMatch(r.stdout, /work may|approved/, `${kind} ${args[0]}`);
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
      assert.match(r.stdout, /no record of done written: correct the records of rounds that cannot be read first/, kind);
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
  assert.match(r.stdout, /ROUNDS t · result-review: 1 full, 0 narrow · next: work is not allowed: no approval in force for the statement/);
  assert.doesNotMatch(r.stdout, /ROUNDS t · result-review[^\n]*(narrow round|full round|work goes on)/);
  // While the owner's approval is in force, both give the next round of the result.
  const before = scenario({ rounds: rounds.slice(0, 2), approvals: [{ hash: A, time: T(10) }] });
  assert.match(checkWith(before, {}, ["--rounds"]).stdout, /ROUNDS t · result-review: 1 full, 0 narrow · next: narrow round 1/);
  [sc, before].forEach((x) => rmSync(x.dir, { recursive: true, force: true }));
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
    approve(fail, 2, T(10));
    const bad = done(fail);
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /no record of done written: 1 of 1 commands of done failed/);
    const unapproved = done(loose);
    assert.equal(unapproved.status, 1);
    assert.match(unapproved.stdout, /the approval in force is for version/);
    assert.equal(readdirSync(join(repo, "tasks")).length, 1);
    // A statement whose budget line the tool cannot read is refused, under an approval in force, and no
    // record is written with the reserve as none (D-150).
    const comma = join(outside, "comma.md");
    writeFileSync(comma, "# A comma\n\nDone-when: true\nBudget-new-input: 100\nBudget-reserve: 1,5\n");
    approve(comma, 3, T(11));
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
  assert.match(out, /statement: approved by the owner \(a0\.md\), version [0-9a-f]{12}: work may start under it/);
  assert.match(out, /result: the executor works, then records done with done\.mjs/);
  // The approval holds for its version only.
  assert.match(state(sc, { statement: fileOf(B) }), /statement: the statement changed after its approval/);
  // An acceptance under the owner's approval holds; the check refuses none.
  const accepted = scenario({ rounds: [withFindings, finalRound()], approvals: [{ time: T(10) }], done: [{ time: T(11) }] });
  assert.deepEqual(acceptanceProblems(accepted.rounds, accepted.records.done, accepted.records.approvals), []);
  assert.match(state(accepted, { statement: fileOf(A) }), /result: done: the last round and its acceptance are clean/);
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
  assert.doesNotMatch(out, /the task is done|result: done/);
  assert.match(out, new RegExp(`result: the verdict of acceptance of r1\\.md is refused: the record of done d1\\.md, of commit ${CC.slice(0, 7)}, was made after it and has no acceptance of its own`));
  assert.match(out, new RegExp(`TASK t · done: recorded in d1\\.md, commit ${CC.slice(0, 7)}, .*no round of the review of the result has followed it yet`));
  const r = checkWith(sc, {}, ["--rounds"]);
  assert.match(r.stdout, /ROUNDS t · result-review: 1 full, 0 narrow · next: the verdict of acceptance of r1\.md is refused: the record of done d1\.md/);
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
  assert.doesNotMatch(r.stdout, /the task is done|result: done/);
  assert.doesNotMatch(r.stdout, /ONT_OK/);
  // The same records with a commit of the repository: the task is done.
  const real = scenario({ rounds: [approvedA, finalRound()], done: [{ time: T(11) }] });
  writeFileSync(join(real.dir, "statement.md"), A_TEXT);
  const ok = checkWith(real, {}, ["--task", "t", "--statement", join(real.dir, "statement.md")]);
  assert.equal(ok.status, 0, ok.stdout);
  assert.match(ok.stdout, /result: done: the last round and its acceptance are clean/);
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
  assert.match(r.stdout, /TASK t · result: done: the last round and its acceptance are clean/);
  assert.match(r.stdout, /BUDGET t: new input 150 of 3000000 × 1 = 3000000/);
  assert.match(r.stdout, /ROUNDS t · result-review: 1 full, 0 narrow · next: the step ended clean/);
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
  assert.match(f.stdout, /result: done, with an overspend: new input 152 of 151\.5, output 0 of 1500; report it to the owner/);
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
  assert.match(ok.stdout, new RegExp(`info · manual run records whose commit this clone does not have [^\\n]*\\(1\\):\\n  20261105T090000Z-check\\.loan\\.overdue-in-real-time-a1b2\\.md: names a commit this clone does not have, ${lost.slice(0, 7)}`));
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
  assert.doesNotMatch(done.stdout, /the task is done|result: done/);
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
  assert.match(r.stdout, /TASK t · statement: approved by the owner \(a0\.md\), version [0-9a-f]{12}: work may start under it/);
  assert.match(r.stdout, /BUDGET t: new input 100 of 4000000 × 1 = 4000000, output 10 of 1500000 × 1 = 1500000/);
  assert.doesNotMatch(r.stdout, /ERROR|not the statement's|exhausted|question/);
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
  assert.match(c.stdout, /TASK t · result: the verdict of acceptance of r1\.md is refused: its line Commits: names commit 1111111, which is not in the repository/);
  assert.match(c.stdout, /ROUNDS t · result-review: 1 full, 0 narrow · next: the verdict of acceptance of r1\.md is refused: its line Commits: names commit 1111111/);
  assert.doesNotMatch(c.stdout, /the task is done|result: done|result-review: [^\n]*the step ended clean|ONT_OK/);
  // The same round with a finding on merging and a clean acceptance ends nothing: its missing commit is information.
  const found = scenario({ rounds: [approvedA, finalRound({ commits: `${ghost}..${CA.slice(0, 7)}`, found: 1 })], done: [{ time: T(11) }] });
  const f = run(found);
  assert.equal(f.status, 0, f.stdout);
  assert.doesNotMatch(f.stdout, /rounds that give the acceptance of a task whose commits are not in the repository/);
  assert.match(f.stdout, /info · rounds of review whose commits this clone does not have [^\n]*\(1\):\n  r1\.md: names a commit this clone does not have, 1111111/);
  assert.doesNotMatch(f.stdout, /the task is done|result: done/);
  assert.match(f.stdout, /ONT_OK/);
  // A clean round followed by a later clean round that names commits the repository has: the first ends nothing, the task is done.
  const later = scenario({ rounds: [approvedA, finalRound({ commits: `${ghost}..${CA.slice(0, 7)}` }), finalRound({ number: 2, time: T(13) })], done: [{ time: T(11) }] });
  const l = run(later);
  assert.equal(l.status, 0, l.stdout);
  assert.match(l.stdout, /info · rounds of review whose commits this clone does not have [^\n]*\(1\):\n  r1\.md: names a commit this clone does not have, 1111111/);
  assert.match(l.stdout, /TASK t · result: done: the last round and its acceptance are clean/);
  assert.match(l.stdout, /ROUNDS t · result-review: 2 full, 0 narrow · next: the step ended clean/);
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
  assert.match(r.stdout, /TASK t · result: narrow round 1, on the fixes of the last round/);
  assert.match(r.stdout, /ROUNDS t · result-review: 1 full, 0 narrow · next: narrow round 1, on the fixes of the last round/);
  assert.doesNotMatch(r.stdout, /exhausted|question to the owner/);
  assert.match(r.stdout, /ONT_OK/);
  // Without the line the reserve is 1: the same spend stops the next round, in --task and --rounds alike.
  const no = scenario({ rounds: spent(HN), done: [{ time: T(11), hash: HN, budget: [3000000, 1500000] }] });
  writeFileSync(join(no.dir, "statement.md"), without);
  const n = checkWith(no, {}, ["--task", "t", "--statement", join(no.dir, "statement.md"), "--rounds"]);
  assert.match(n.stdout, /TASK t · result: the budget is exhausted: a question to the owner/);
  assert.match(n.stdout, /ROUNDS t · result-review: 1 full, 0 narrow · next: the budget is exhausted: a question to the owner/);
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
  assert.doesNotMatch(c.stdout, /TASK t · result: the budget is exhausted/, "the result line names the unreadable line, not a spent budget");
  for (const d of [sc.dir, no.dir, other.dir, bad.dir]) rmSync(d, { recursive: true, force: true });
});
