// Rounds of review (D-99, D-152) and the records of a review from the reviewer's table (D-100).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { recordVerdicts } from "../manual-runs.mjs";
import { BRANCHES, GRAMMAR, nextRound, parseRounds, readRecord, renderRounds } from "../review-rounds.mjs";

const TOOLS = fileURLToPath(new URL("../", import.meta.url));
const EXAMPLE = fileURLToPath(new URL("../../../example/", import.meta.url));

// A round of a step, with findings of the change of distinct classes, each fixable and tested unless said.
const round = (number, found, { narrow = false, untested = 0, notFixable = 0, before = 0, task = "t", step = "result-review", time } = {}) => ({
  task,
  step,
  narrow,
  number,
  ...(time ? { time } : {}),
  tokens: { new: 100, cached: 10, out: 5 },
  findings: [
    ...Array.from({ length: found }, (_, i) => ({
      cls: `class ${i}`,
      weight: "important",
      ofChange: true,
      fixable: i >= notFixable,
      filed: null,
      test: i < untested ? null : "test.mjs",
    })),
    ...Array.from({ length: before }, (_, i) => ({ cls: `old ${i}`, weight: "nit", ofChange: false, fixable: true, filed: null, test: null })),
  ],
});
const full = (counts, opts) => counts.map((n, i) => round(i + 1, n, opts));
// A round by its findings named: "a" an important finding of class a, "a:nit" a nit, "a:not" one not
// fixable, "a:later" and "a:limitation" filed ones, "a:untested" one with no test yet.
const named = (number, names, { narrow = false, step = "result-review", time, acceptance, condition = false } = {}) => {
  const f = (n) => {
    const [cls, how = ""] = n.split(":");
    return { cls, weight: how === "nit" ? "nit" : "important", ofChange: true, fixable: !["not", "later", "limitation"].includes(how), filed: ["later", "limitation"].includes(how) ? how : null, test: how === "untested" || ["later", "limitation"].includes(how) ? null : "t.mjs" };
  };
  return { task: "t", step, narrow, number, ...(time ? { time } : {}), tokens: { new: 1, cached: 0, out: 1 }, findings: names.map(f), ...(acceptance ? { acceptance: { findings: acceptance.map(f) } } : {}), ...(condition ? { condition: true } : {}) };
};
// Rounds one after the other, the full ones numbered first, as records with no time sort.
const seq = (...lists) => lists.map((names, i) => named(i + 1, names));

test("[check.review-round.converging] while each round finds fewer important classes, the next is a narrow round when every finding is tested, a full one when not", () => {
  const tested = seq(["a", "b", "c"], ["d", "e"], ["f"]);
  assert.equal(nextRound(tested).next, "narrow");
  assert.equal(nextRound(tested).number, 1);
  const untested = seq(["a", "b", "c"], ["d", "e"], ["f:untested"]);
  assert.equal(nextRound(untested).next, "full");
  assert.equal(nextRound(untested).number, 4);
  // Two findings of one class count once: 2 classes, then 1 class written twice, converges.
  assert.equal(nextRound(seq(["a", "b"], ["c", "c"])).next, "narrow");
});

test("[check.review-round.no-ceiling] past six full and three narrow rounds the step goes on while it converges, and a line Ceiling: changes nothing", () => {
  const classes = (k, p) => Array.from({ length: k }, (_, i) => `${p}${i}`);
  const fulls = [7, 6, 5, 4, 3, 2, 1].map((k, i) => named(i + 1, classes(k + 4, `f${i}-`), { time: `2026-11-20T0${i}:00:00Z` }));
  // Seven full rounds converging, the last untested: an eighth full round, never a question.
  const untested = [...fulls.slice(0, -1), { ...fulls.at(-1), findings: fulls.at(-1).findings.map((x) => ({ ...x, test: null })) }];
  assert.deepEqual([nextRound(untested).next, nextRound(untested).number], ["full", 8]);
  const narrows = [4, 3, 2, 1].map((k, i) => named(i + 1, classes(k, `n${i}-`), { narrow: true, time: `2026-11-20T1${i}:00:00Z` }));
  for (let i = 0; i <= narrows.length; i++) {
    const n = nextRound([...fulls, ...narrows.slice(0, i)]);
    assert.equal(n.next, "narrow", `${i} narrow rounds: ${n.say}`);
    assert.equal(n.number, i + 1);
  }
  // Records with and without a ceiling read alike.
  const dir = mkdtempSync(join(tmpdir(), "rounds-ceiling-"));
  try {
    for (const [i, ceiling] of [[1, "Ceiling: 1\n"], [2, ""]]) writeFileSync(join(dir, `r${i}.md`), `Task: t\nStep: result-review\nNumber: ${i}\n${ceiling}Time: 2026-11-20T1${i}:00:00Z\nBy: a model\nFindings:\n- c${i}a · important · change · fixable · t.mjs\n${i === 1 ? "- c1b · important · change · fixable · t.mjs\n" : ""}`);
    const { rounds, malformed } = parseRounds(dir);
    assert.deepEqual(malformed, []);
    assert.equal(nextRound(rounds).next, "narrow");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("[check.review-round.stagnation-count] a round with as many important classes as the round before changes the design; one fewer goes on", () => {
  const same = nextRound(seq(["a", "b"], ["c", "d"]));
  assert.equal(same.next, "redesign");
  assert.match(same.say, /change the design of the solution, do not patch it; then full round 3/);
  assert.equal(same.number, 3);
  assert.doesNotMatch(same.say, /question/);
  // More is stagnation too; exactly one fewer is not.
  assert.equal(nextRound(seq(["a"], ["c", "d"])).next, "redesign");
  assert.equal(nextRound(seq(["a", "b", "c"], ["d", "e"])).next, "narrow");
});

test("[check.review-round.stagnation-repeat] an important class that was important before changes the design even when the count falls; a nit on either side is no repeat", () => {
  const repeat = nextRound(seq(["a", "x"], ["b", "c", "d"], ["a"]));
  assert.equal(repeat.next, "redesign");
  assert.match(repeat.say, /repeated: a/);
  assert.deepEqual(repeat.classes, ["a"]);
  // A nit before, important now, with fewer important classes: no repeat.
  assert.equal(nextRound(seq(["a:nit", "b", "c"], ["a"])).next, "narrow");
  // Important before, a nit now: no repeat, and a round with nits only is no stagnation.
  assert.equal(nextRound(seq(["a", "b"], ["a:nit"])).next, "narrow");
});

test("[check.review-round.nits-only] two rounds with nits only, of the same classes, are followed by another round", () => {
  const n = nextRound(seq(["a:nit", "b:nit"], ["a:nit", "b:nit"]));
  assert.equal(n.next, "narrow");
  assert.doesNotMatch(n.say, /design/);
  // Nits are not counted with the important classes: one important class and two nits after two
  // important classes is one fewer.
  assert.equal(nextRound(seq(["a", "b"], ["c", "x:nit", "y:nit"])).next, "narrow");
});

test("[check.review-round.stagnation-reset] after a clean round, or after the owner's approval, the first round with findings is not stagnation", () => {
  const t = (h) => `2026-11-20T${String(h).padStart(2, "0")}:00:00Z`;
  const rounds = [named(1, ["a", "b"], { time: t(1) }), named(2, [], { time: t(2), step: "statement-review" }), named(3, ["a", "b"], { time: t(3) })].map((r) => ({ ...r, step: "statement-review" }));
  assert.equal(nextRound(rounds).next, "narrow");
  // Without the clean round between them the same rounds stagnate.
  assert.equal(nextRound([rounds[0], rounds[2]]).next, "redesign");
  // The owner's approval at 02:00: the rounds before it are not read, and numbers go on.
  const result = [named(1, ["a", "b"], { time: t(1) }), named(2, ["a", "b"], { time: t(3) })];
  assert.equal(nextRound(result, { since: t(2) }).next, "narrow");
  assert.equal(nextRound(result).next, "redesign");
  const none = nextRound([named(1, ["a:not"], { time: t(1) })], { since: t(2) });
  assert.deepEqual([none.next, none.number], ["first round", 2]);
});

test("[check.review-round.stagnation-reset] a round of the result clean on merging resets the comparison only when its acceptance holds", () => {
  const middle = (acceptance) => ({ ...named(2, []), ...(acceptance ? { acceptance: { findings: [] } } : {}) });
  const rounds = (m) => [named(1, ["a"]), m, named(3, ["a"])];
  // No acceptance: nothing ended, class a repeats.
  assert.equal(nextRound(rounds(middle(false))).next, "redesign");
  // An acceptance refused: nothing ended either.
  assert.equal(nextRound(rounds(middle(true)), { held: (r) => r.number !== 2 }).next, "redesign");
  // An acceptance that holds ended the step: class a is the first finding after it.
  assert.equal(nextRound(rounds(middle(true))).next, "narrow");
});

test("[check.review-round.branch-order] not fixable comes before stagnation, findings only in the acceptance are findings, and no branch of a step knows the budget", () => {
  // The last round would stagnate by its two important classes; its finding not fixable goes first.
  const notFixable = seq(["a", "b"], ["c", "d", "e:not"]);
  assert.equal(nextRound(seq(["a", "b"], ["c", "d"])).next, "redesign");
  assert.equal(nextRound(notFixable).next, "question");
  // Findings in the verdict of acceptance only: not clean, and compared as findings.
  const onlyAcceptance = [named(1, ["a"]), named(2, [], { acceptance: ["a"] })];
  assert.equal(nextRound(onlyAcceptance).next, "redesign");
  assert.equal(nextRound([named(1, ["a", "b"]), named(2, [], { acceptance: ["c"] })]).next, "narrow");
  assert.equal(nextRound([]).next, "first round");
  assert.equal(nextRound([named(1, [])]).next, "acceptance");
  const refusedRound = [named(1, [], { acceptance: [] })];
  assert.equal(nextRound(refusedRound, { refused: () => "no record of done" }).next, "refused");
  assert.equal(nextRound(refusedRound).next, "clean");
  // The budget is ordered by the next action of the task only: a step given "exhausted" ignores it.
  assert.equal(nextRound(notFixable, { exhausted: true }).next, "question");
  assert.ok(!BRANCHES.some((b) => /budget/.test(b)));
});

test("[check.review-round.branch-order-documented] the ontology lists the branches of the next round by the names and in the order the code takes them, and the guide and the skill point to it without restating them", () => {
  const read = (rel) => readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), "utf8");
  const ontology = read("ontology.md").split("\n").find((l) => l.includes("`derived.next-round`") && l.startsWith("| Derived"));
  assert.ok(ontology, "ontology.md");
  const at = BRANCHES.map((b, i) => ontology.indexOf(`(${i + 1}) ${b}:`));
  assert.ok(at.every((x) => x >= 0), `ontology.md: ${BRANCHES.filter((b, i) => at[i] < 0).join(", ")} missing`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, "ontology.md: out of order");
  assert.equal(ontology.indexOf(`(${BRANCHES.length + 1})`), -1, "ontology.md: a branch the code does not take");
  // The guide's section on rounds and the skill restate no branch and no round that follows
  // stagnation or a confirmation; each points once to the definition and the line NEXT.
  const section = (text, from, to) => text.slice(text.indexOf(from), text.indexOf(to, text.indexOf(from)));
  const guide = section(read("docs/parts/agent-rules.md"), "## Rounds of review", "## What a review costs");
  const skill = read("skills/change-review/SKILL.md");
  for (const [name, text] of [["agent-rules.md", guide], ["SKILL.md", skill]]) {
    assert.ok(text.length > 100, name);
    for (const b of BRANCHES) assert.doesNotMatch(text, new RegExp(`\\(\\d\\) ${b}:`), `${name}: restates branch ${b}`);
    assert.doesNotMatch(text, /(full|narrow) round (follows|after it)|the next round is (full|narrow)|one narrow round alone/, `${name}: says which round follows`);
    assert.equal(text.match(/the line `NEXT <task>:` of `--task` and `--rounds`, given by the ordered branches of (\[)?`derived\.next-round`/g)?.length, 1, `${name}: one pointer to the branches`);
  }
  const guideAll = read("docs/parts/agent-rules.md");
  // The code takes them in that order: each history gives the branch of its name.
  assert.equal(nextRound([named(1, ["a:not"])]).branch, "open gate");
  assert.equal(nextRound([]).branch, "no round");
  assert.equal(nextRound([named(1, [], { condition: true })]).branch, "condition confirmed");
  assert.equal(nextRound([named(1, [])]).branch, "no acceptance");
  assert.equal(nextRound([named(1, [], { acceptance: [] })], { refused: () => "x" }).branch, "acceptance refused");
  assert.equal(nextRound([named(1, [], { acceptance: [] })]).branch, "clean");
  assert.equal(nextRound(seq(["a"], ["a"])).branch, "stagnation");
  assert.equal(nextRound([named(1, ["a"])]).branch, "next round");
  // The guide to rounds says the budget is ordered by the task's next action.
  assert.match(guideAll, /The budget is no branch of a step/);
});

test("[check.review-round.not-fixable] a gate opened by a finding not fixable holds over later rounds, a clean acceptance too, until the owner's approval", () => {
  const t = (h) => `2026-11-20T${String(h).padStart(2, "0")}:00:00Z`;
  const rounds = [named(1, ["a:not"], { time: t(1) }), named(2, [], { time: t(2), acceptance: [] })];
  const n = nextRound(rounds);
  assert.equal(n.next, "question");
  assert.match(n.say, /only his approval of a version answers it/);
  assert.notEqual(n.next, "clean");
  // The owner's approval after it closes the gate; the clean round after the approval ends the step.
  assert.equal(nextRound(rounds, { since: t(1) }).next, "clean");
  // A gate of the other step holds this one too.
  assert.equal(nextRound([named(1, ["a"], { time: t(3) })], { gate: ["s.md"] }).next, "question");
});

test("[check.review-round.narrow-needs-test] a narrow round with fewer important classes, one finding without a test, is followed by a full round", () => {
  const rounds = [named(1, ["a", "b"]), named(1, ["c:untested"], { narrow: true })];
  const n = nextRound(rounds);
  assert.deepEqual([n.next, n.number], ["full", 2]);
  assert.match(n.say, /no test/);
  assert.equal(nextRound([named(1, ["a", "b"]), named(1, ["c"], { narrow: true })]).next, "narrow");
});

test("[check.review-round.not-fixable] a finding not fixable goes to the owner, in the review of a statement and of a result", () => {
  for (const step of ["statement-review", "result-review"]) {
    const first = nextRound([named(1, ["a:not"], { step })]);
    assert.equal(first.next, "question", step);
    assert.match(first.say, /without changing what the owner decided/);
    assert.equal(nextRound([named(1, ["a", "b", "c"], { step }), named(2, ["d", "e:not"], { step })]).next, "question");
  }
});

test("[check.review-round.filed] a filed finding names a file of the repository holding its class, is no finding in an acceptance, and counts neither in the comparison nor as a repeat", () => {
  const root = mkdtempSync(join(tmpdir(), "rounds-root-"));
  try {
    mkdirSync(join(root, "docs"));
    mkdirSync(join(root, "issues"));
    mkdirSync(join(root, "rounds"));
    writeFileSync(join(root, "docs", "limitations.md"), "# Limitations\n\n- a rare case: what it costs.\n");
    writeFileSync(join(root, "issues", "0001-outside.md"), "# Outside thing\n\nThe outside thing, for later.\n");
    const rec = (name, number, lines, extra = []) => writeFileSync(join(root, "rounds", name), [`Task: t`, `Step: result-review`, `Number: ${number}`, `Time: 2026-11-20T1${number}:00:00Z`, `By: a model`, `Findings:`, ...lines, ...extra, ""].join("\n"));
    rec("ok-1.md", 1, ["- a rare case · important · change · limitation · docs/limitations.md", "- outside thing · nit · change · later · issues/0001-outside.md"]);
    rec("no-file.md", 2, ["- outside thing · important · change · later · issues/0002-none.md"]);
    rec("no-class.md", 3, ["- absent class · important · change · limitation · docs/limitations.md"]);
    rec("not-issues.md", 4, ["- outside thing · important · change · later · docs/limitations.md"]);
    rec("acceptance.md", 5, ["- x · nit · before · fixable"], ["Acceptance:", "- a rare case · important · change · limitation · docs/limitations.md"]);
    const { rounds, malformed } = parseRounds(join(root, "rounds"), { root });
    assert.deepEqual(rounds.map((r) => r.file), ["ok-1.md"]);
    const has = (file, what) => assert.ok(malformed.some((m) => m.startsWith(`${file}:`) && m.includes(what)), `${file}: ${what}\n${malformed.join("\n")}`);
    has("no-file.md", "finding 1, line 7: issues/0002-none.md is not a file of the repository");
    has("no-class.md", 'finding 1, line 7: docs/limitations.md does not hold the class "absent class"');
    has("not-issues.md", "not a file under issues/");
    has("acceptance.md", "acceptance finding 1, line 9: limitation in a verdict of acceptance");
    // A symbolic link of the repository that leads out of it holds nothing of the repository's.
    const outside = mkdtempSync(join(tmpdir(), "rounds-outside-"));
    try {
      writeFileSync(join(outside, "x.md"), "linked thing\n");
      symlinkSync(join(outside, "x.md"), join(root, "issues", "0003-link.md"));
      symlinkSync(join(root, "issues", "0001-outside.md"), join(root, "issues", "0004-inside.md"));
      rec("link-out.md", 6, ["- linked thing · important · change · later · issues/0003-link.md"]);
      rec("link-in.md", 7, ["- outside thing · nit · change · later · issues/0004-inside.md"]);
      const again = parseRounds(join(root, "rounds"), { root });
      assert.ok(again.malformed.some((m) => m.startsWith("link-out.md:") && m.includes("issues/0003-link.md resolves to a file outside the repository")), again.malformed.join("\n"));
      assert.ok(again.rounds.some((r) => r.file === "link-in.md"), again.malformed.join("\n"));
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
    // A round whose only findings are filed is clean; without the root of a repository a filed finding
    // cannot be looked up.
    assert.equal(nextRound([{ ...rounds[0], step: "statement-review" }]).next, "clean");
    assert.ok(parseRounds(join(root, "rounds")).malformed.some((m) => m.startsWith("ok-1.md:") && m.includes("cannot be looked up")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  // Filed findings count neither in the comparison of rounds nor in the search for repeats, even beside
  // other findings.
  assert.equal(nextRound(seq(["a", "b"], ["c", "x:later", "y:limitation"])).next, "narrow");
  assert.equal(nextRound(seq(["a", "b"], ["c", "a:later"])).next, "narrow");
  assert.equal(nextRound(seq(["a:later", "b", "d"], ["a", "c:later"])).next, "narrow");
});

test("[check.review-round.clean-ends] a round whose only finding was there before the change ends the step clean", () => {
  // A round of the result ends its step with its verdict of acceptance clean (D-119).
  assert.equal(nextRound([round(1, 2), { ...round(2, 0, { before: 1 }), acceptance: { findings: [] } }]).next, "clean");
  assert.equal(nextRound([round(1, 2), round(2, 0, { before: 1, step: "statement-review" })].map((r) => ({ ...r, step: "statement-review" }))).next, "clean");
});

const record = (fields, findings = []) =>
  [...Object.entries(fields).map(([k, v]) => `${k}: ${v}`), ...(findings.length ? ["Findings:", ...findings] : []), ""].join("\n");
const OK = { Task: "t", Step: "result-review", Number: 1, Time: "2026-11-20T10:00:00Z", By: "a model" };

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
    assert.ok(malformed.some((m) => m.startsWith("d.md: finding 1, line 7: weight change")), malformed.join("\n"));
    assert.ok(malformed.some((m) => m.startsWith("e.md and f.md: both round 1")), malformed.join("\n"));
    assert.ok(malformed.some((m) => m.startsWith("g.md: time 2026-99-99T99:99:99Z")), malformed.join("\n"));
    assert.equal(rounds.length, 2);
    // Through the check: the records fail it.
    const cfgDir = mkdtempSync(join(tmpdir(), "rounds-cfg-"));
    cpSync(EXAMPLE, cfgDir, { recursive: true, filter: (src) => !src.startsWith(join(EXAMPLE, "releases")) });
    const cfgPath = join(cfgDir, "ont.config.json");
    const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
    // Rounds before gatesFrom, as these, need no line Statement-hash: (D-152).
    writeFileSync(cfgPath, JSON.stringify({ ...cfg, reviewRounds: { dir, gatesFrom: "2099-01-01T00:00:00Z" } }));
    const r = spawnSync("node", [join(TOOLS, "ont-check.mjs"), "--config", cfgPath], { encoding: "utf8" });
    rmSync(cfgDir, { recursive: true, force: true });
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /records that cannot be read, of rounds by their grammar and late records of another version \(6\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// A valid record of a round, its head and its notes, for the mutations of the grammar.
const VALID = [
  "Task: t",
  "Step: result-review",
  "Number: 1",
  "Time: 2026-11-20T10:00:00Z",
  "By: a model",
  "Statement-hash: " + "a".repeat(64),
  "Commits: abc1234",
  "Findings:",
  "- a · important · change · fixable · t.mjs",
  "- b · nit · change · fixable",
  "",
  "Acceptance:",
  "- c · important · change · fixable",
  "",
  "## Notes",
  "",
  "Anything here, - even this",
  "  - and an indented line, Task: x, # and a hash",
];
const HEAD = VALID.indexOf("## Notes");

// Every mutation of the head of the valid record that the grammar refuses: a line inserted at each place
// that is never allowed there, each field or block given twice, each line indented, the blocks swapped.
function mutations() {
  const out = [];
  const at = (i, line, why) => out.push({ why: `${why} at ${i + 1}`, lines: [...VALID.slice(0, i), line, ...VALID.slice(i)] });
  const never = ["# a heading of one hash", "#no space", "### a heading of three", "Verdict: fix first", "task: t", " Task: t", "  - a · important · change · fixable", "\t- a · important · change · fixable", "Findings: none", "Acceptance: not clean", "-no space", "* a · important · change · fixable", "Findings:", "Acceptance: clean", "Acceptance:"];
  for (let i = 0; i <= HEAD; i++) for (const l of never) at(i, l, JSON.stringify(l));
  // A finding line where no block is open: among the fields, and after each blank line.
  for (let i = 0; i <= HEAD; i++) if (i < 8 || VALID[i - 1] === "") at(i, "- d · important · change · fixable", "a finding outside a block");
  // A field after the blocks.
  for (let i = 8; i <= HEAD; i++) at(i, "Runs: x.md", "a field after the fields");
  // Each line of the head given twice, but a finding or a blank line, which may repeat.
  VALID.slice(0, HEAD).forEach((l, i) => l && !l.startsWith("- ") && out.push({ why: `line ${i + 1} twice`, lines: [...VALID.slice(0, i + 1), l, ...VALID.slice(i + 1)] }));
  // Each line of the head indented.
  VALID.slice(0, HEAD).forEach((l, i) => l && out.push({ why: `line ${i + 1} indented`, lines: VALID.map((x, j) => (j === i ? `  ${x}` : x)) }));
  // The blocks swapped.
  out.push({ why: "acceptance before findings", lines: [...VALID.slice(0, 7), ...VALID.slice(11, 14), ...VALID.slice(7, 11), ...VALID.slice(HEAD)] });
  return out;
}

test("[check.review-round.strict-head] the grammar of a record reads the valid record and refuses every mutation of its head, naming the line", () => {
  const ok = readRecord(VALID.join("\n"));
  assert.deepEqual(ok.errors, []);
  assert.deepEqual([ok.findings.length, ok.accepted.length, ok.acceptance], [2, 1, ""]);
  const all = mutations();
  assert.ok(all.length > 250, `${all.length} mutations`);
  for (const m of all) {
    const r = readRecord(m.lines.join("\n"));
    assert.ok(r.errors.length && r.errors.every((e) => /^line \d+: /.test(e)), `${m.why}: ${JSON.stringify(r.errors)}`);
  }
  // Through parseRounds the same records are unreadable, and the valid one reads.
  const dir = mkdtempSync(join(tmpdir(), "rounds-grammar-"));
  try {
    writeFileSync(join(dir, "valid.md"), VALID.join("\n"));
    all.slice(0, 40).forEach((m, i) => writeFileSync(join(dir, `m${String(i).padStart(3, "0")}.md`), m.lines.join("\n").replace("Number: 1", `Number: ${i + 2}`)));
    const { rounds, malformed } = parseRounds(dir);
    assert.deepEqual(rounds.map((r) => r.file), ["valid.md"]);
    assert.equal(malformed.length, 40);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("[check.review-round.strict-head] each kind of line of the grammar is a row of its table, and a record of the repository reads", () => {
  assert.deepEqual(GRAMMAR.map((r) => r.kind), ["blank", "field", "findings", "acceptance", "accepted clean", "finding"]);
  const { malformed } = parseRounds(fileURLToPath(new URL("../../../reviews/rounds/", import.meta.url)), { latinOnly: true, root: fileURLToPath(new URL("../../../", import.meta.url)) });
  assert.deepEqual(malformed, []);
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
    "Check: check.a\nTime: 2026-11-20T12:00:00Z\nCommit: abc123\nStamp: s-check.a\nVerdict: pass\nBy: a model of a provider\nPerformer: agent\nEvidence: notes outside\n",
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
    cpSync(EXAMPLE, dir, { recursive: true, filter: (src) => !src.startsWith(join(EXAMPLE, "releases")) });
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
    const ids = [...out.slice(out.indexOf("REVIEW HEAD")).matchAll(/^ {2}(check\.\S+) \[/gm)].map((m) => m[1]);
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

// The round C of the condition confirmed and the one round after it (D-153). A finding "a:before" is one
// that was there before the change.
const C = (number, names, opts = {}) => named(number, names, { condition: true, ...opts });
const before = (r) => ({ ...r, findings: [...r.findings, { cls: "old", weight: "important", ofChange: false, fixable: true, filed: null, test: null }] });

test("[check.review-round.condition-branch] after C one narrow round alone, then its fixes held by tests, never the owner's gate; C or the round after it ends the step only with no finding left and an acceptance that holds", () => {
  // C with no finding left and a clean acceptance that holds ends the step, a finding there before too.
  assert.equal(nextRound([C(1, [], { acceptance: [] })]).next, "clean");
  assert.equal(nextRound([before(C(1, [], { acceptance: [] }))]).next, "clean");
  assert.equal(nextRound([C(1, ["r:later"], { acceptance: [] })]).next, "clean");
  // C with a finding left, a nit too, with no acceptance or one refused: one narrow round.
  for (const [why, rounds, opts] of [
    ["a finding", [C(1, ["a:untested"], { acceptance: [] })], {}],
    ["a nit", [C(1, ["a:nit"], { acceptance: [] })], {}],
    ["no acceptance", [C(1, [])], {}],
    ["refused", [C(1, [], { acceptance: [] })], { refused: () => "no record of done" }],
  ]) {
    const n = nextRound(rounds, opts);
    assert.deepEqual([n.branch, n.next, n.number], ["condition confirmed", "narrow", 1], `${why}: ${n.say}`);
    assert.match(n.say, /the one round after it/);
  }
  // The round after C, narrow or full, with nothing left and an acceptance that holds ends the step.
  assert.equal(nextRound([C(1, ["a"]), named(1, [], { narrow: true, acceptance: [] })]).next, "clean");
  assert.equal(nextRound([C(1, ["a"]), named(2, [], { acceptance: [] })]).next, "clean");
  assert.equal(nextRound([C(1, ["a"]), before(named(1, [], { narrow: true, acceptance: [] }))]).next, "clean");
  // The round after C with a finding left: its fixes with tests, then done; with no acceptance or one that
  // does not hold, that verdict again on the same result; never a question nor a round (D-164).
  for (const [why, rounds, opts, next] of [
    ["a finding", [C(1, ["a"]), named(1, ["b"], { narrow: true, acceptance: [] })], {}, "fixes"],
    ["full, no acceptance", [C(1, ["a"]), named(2, [])], {}, "acceptance"],
    ["not held", [C(1, ["a"]), named(1, ["b"], { narrow: true, acceptance: [] })], { held: (r) => !r.narrow }, "acceptance"],
  ]) {
    const n = nextRound(rounds, opts);
    assert.deepEqual([n.branch, n.next], ["condition confirmed", next], `${why}: ${n.say}`);
    assert.match(n.say, /rule\.fixes-held-by-tests/);
    assert.doesNotMatch(n.say, /a question to the owner|(narrow|full) round \d/);
  }
  // A repeat of Condition: holds adds nothing: the round after C is still the last one allowed.
  assert.equal(nextRound([C(1, ["a"]), C(1, ["b"], { narrow: true, acceptance: [] })]).next, "fixes");
  // An open gate comes first.
  assert.equal(nextRound([C(1, ["a:not"])]).branch, "open gate");
  assert.equal(nextRound([C(1, ["a"]), named(1, ["b:not"], { narrow: true, acceptance: [] })]).branch, "open gate");
  // After C ended the step, a new round with findings is read afresh.
  assert.equal(nextRound([C(1, [], { acceptance: [] }), named(2, ["a"])]).next, "narrow");
});

test("[check.review-round.condition-stagnation] a C that stagnates, by a repeated class or by no fewer classes, changes the design, then the one narrow round", () => {
  for (const [why, rounds, classes] of [
    ["repeated", [named(1, ["a", "b"]), C(2, ["a"])], ["a"]],
    ["no fewer", [named(1, ["a"]), C(2, ["b"])], []],
  ]) {
    const n = nextRound(rounds);
    assert.deepEqual([n.branch, n.next, n.number, n.classes], ["condition confirmed", "redesign", 1, classes], `${why}: ${n.say}`);
    assert.match(n.say, /change the design of the solution, do not patch it; then narrow round 1, the one round after it/);
  }
  // Without C the same rounds go to a full round.
  assert.equal(nextRound([named(1, ["a", "b"]), named(2, ["a"])]).number, 3);
});

test("[check.review-round.condition-well-formed] a record gives Condition: holds only, and only on a review of the result", () => {
  const dir = mkdtempSync(join(tmpdir(), "rounds-condition-"));
  try {
    const rec = (name, step, line) => writeFileSync(join(dir, name), [`Task: t`, `Step: ${step}`, `Number: 1`, `Time: 2026-11-20T10:00:00Z`, `By: a model`, line, ""].join("\n"));
    rec("holds.md", "result-review", "Condition: holds");
    rec("not-yet.md", "statement-review", "Condition: not yet");
    rec("blank.md", "result-review", "Condition:");
    rec("statement.md", "statement-review", "Condition: holds");
    const { rounds, malformed } = parseRounds(dir);
    assert.deepEqual(rounds.map((r) => [r.file, r.condition]), [["holds.md", true]]);
    const has = (file, what) => assert.ok(malformed.some((m) => m.startsWith(`${file}:`) && m.includes(what)), `${file}: ${what}\n${malformed.join("\n")}`);
    has("not-yet.md", "condition not yet is not holds");
    has("blank.md", "condition (blank) is not holds");
    has("statement.md", "a condition on a review that is not of the result");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("[check.review-round.triage-record] the weight and the filing are the executor's line, whatever the reviewer's advice in the notes says", () => {
  const root = mkdtempSync(join(tmpdir(), "rounds-triage-"));
  try {
    mkdirSync(join(root, "issues"));
    mkdirSync(join(root, "rounds"));
    writeFileSync(join(root, "issues", "0001-x.md"), "# X\n\nThe tool: a rare thing.\n");
    const rec = (name, number, line, note, condition = true) =>
      writeFileSync(join(root, "rounds", name), [`Task: t`, `Step: result-review`, `Number: ${number}`, `Time: 2026-11-20T1${number}:00:00Z`, `By: a model`, ...(condition ? [`Condition: holds`] : []), `Findings:`, ...[line].flat(), "", "## Notes", "", note, ""].join("\n"));
    rec("kept.md", 1, "- a usual thing · important · change · fixable · t.mjs", "- a usual thing: reviewer's mark rare; the executor names the step of usual work it breaks: recording done.");
    rec("filed.md", 2, "- a rare thing · important · change · later · issues/0001-x.md", "- a rare thing: reviewer's mark usual; the executor names no step of usual work.");
    // The weight both ways against the reviewer's: raised from nit to important, lowered from important to nit.
    rec("prev.md", 3, ["- a raised thing · important · change · fixable · t.mjs", "- a lowered thing · important · change · fixable · t.mjs"], "- both important here.", false);
    rec("raised.md", 4, "- a raised thing · important · change · fixable · t.mjs", "- a raised thing: reviewer's weight nit; the executor's important.", false);
    rec("lowered.md", 5, "- a lowered thing · nit · change · fixable · t.mjs", "- a lowered thing: reviewer's weight important; the executor's nit.", false);
    const { rounds, malformed } = parseRounds(join(root, "rounds"), { root });
    assert.deepEqual(malformed, []);
    const [kept, filed, prev, raised, lowered] = ["kept.md", "filed.md", "prev.md", "raised.md", "lowered.md"].map((f) => rounds.find((r) => r.file === f));
    // Raised to important, the class repeats an important one: stagnation. Lowered to nit: no repeat.
    assert.deepEqual(nextRound([prev, raised]).classes, ["a raised thing"]);
    assert.equal(nextRound([prev, lowered]).next, "narrow");
    // Kept fixable against the advice rare, in C: it counts, and the one narrow round follows.
    assert.match(nextRound([kept]).say, /narrow round 1, the one round after it/);
    // Filed against the advice usual: it counts neither as a finding nor in the comparison.
    assert.equal(nextRound([{ ...filed, acceptance: { findings: [] } }]).next, "clean");
    // As the one round after C, its only finding filed, it ends the step.
    assert.equal(nextRound([kept, { ...filed, number: 1, narrow: true, condition: false, acceptance: { findings: [] } }]).next, "clean");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("[check.review-round.triage-documented] the change-review skill asks the reviewer of a result for a line Condition: in every reply and a mark usual or rare on each finding", () => {
  const skill = readFileSync(fileURLToPath(new URL("../../../skills/change-review/SKILL.md", import.meta.url)), "utf8");
  assert.match(skill, /`Condition: holds` or `Condition: not yet`/);
  assert.match(skill, /a reply without (it|one) is an error/i);
  assert.match(skill, /`usual` or `rare`/);
  assert.match(skill, /advice/);
});
