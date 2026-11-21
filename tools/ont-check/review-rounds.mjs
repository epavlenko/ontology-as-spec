// Records of review rounds (D-99, D-152): one file per round of review of a task, in the directory the
// configuration names under reviewRounds, with what the round cost and found. From them the tool says
// what follows the last round of each step, and, once a step has ten applications, what it paid off.
// ont: ent.review-round, field.review-round.task, field.review-round.step, field.review-round.narrow, field.review-round.number, field.review-round.time, field.review-round.commits, field.review-round.by, field.review-round.tokens-new, field.review-round.tokens-cached, field.review-round.tokens-out, field.review-round.checks-listed, field.review-round.checks-given, field.review-round.checks-carried, field.review-round.findings, field.review-round.start, field.review-round.contribution, field.review-round.acceptance, field.review-round.overspend, edge.review-round.runs, edge.review-round.statement, derived.next-round, derived.step-payoff, rule.rounds-converge, rule.findings-filed, rule.ready-after-clean-round, inv.review-rounds-well-formed, rule.records-english-in-repo
import { realpathSync } from "node:fs";
import { basename, isAbsolute, join, normalize, relative, sep } from "node:path";
import { isFile, listFiles, read } from "./lib.mjs";
import { outsideRecord } from "./manual-runs.mjs";

export const STEPS = ["statement-review", "result-review"];
// The line Ceiling: of a record made before D-152 is read, as a whole number, and decides nothing.
const FIELDS = ["Task", "Step", "Narrow", "Number", "Ceiling", "Start", "Time", "Commits", "By", "Contribution", "Statement-hash", "Tokens-new", "Tokens-cached", "Tokens-out", "Checks-listed", "Checks-given", "Checks-carried", "Runs", "Overspend"];
const COUNTS = ["number", "ceiling", "tokens-new", "tokens-cached", "tokens-out", "checks-listed", "checks-given", "checks-carried"];
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
// A time is real when it reads back as itself: 2026-99-99T99:99:99Z has the shape and is no time.
export const realTime = (t) => TIME.test(t ?? "") && !Number.isNaN(Date.parse(t)) && new Date(t).toISOString().replace(".000Z", "Z") === t;

// The values of the fourth field of a finding line (rule.findings-filed, D-152): fixable within the task,
// not fixable without changing what the owner decided, or filed, an unlikely case as a limitation and a
// finding outside the statement for later, each with the file it is filed in as its last field.
export const FIXES = ["fixable", "not fixable", "limitation", "later"];
export const LIMITATIONS_FILE = "docs/limitations.md";
export const LATER_DIR = "issues/";
// A finding: "- class · important · change · fixable · path/to/test.mjs", the test once the fix is made;
// "- class · important · change · later · issues/0007-x.md", the file it is filed in.
export const parseFinding = (line) => {
  const [cls, weight, of, fix, last] = line.replace(/^-\s*/, "").split("·").map((x) => x.trim());
  const filed = fix === "limitation" || fix === "later";
  const wrong = [
    !cls && "no class",
    !["important", "nit"].includes(weight) && `weight ${weight ?? "(none)"} is not important or nit`,
    !["change", "before"].includes(of) && `${of ?? "(none)"} is not change or before`,
    !FIXES.includes(fix) && `${fix ?? "(none)"} is not fixable, not fixable, limitation or later`,
    fix === "limitation" && last !== LIMITATIONS_FILE && `a limitation names ${last || "no file"}, not ${LIMITATIONS_FILE}`,
    fix === "later" && !(last ?? "").startsWith(LATER_DIR) && `a finding for later names ${last || "no file"}, not a file under ${LATER_DIR}`,
  ].filter(Boolean);
  return { cls, weight, ofChange: of === "change", fixable: fix === "fixable", filed: filed ? fix : null, file: filed ? last || null : null, test: filed ? null : last || null, wrong };
};

// What is wrong with the file a filed finding names (rule.findings-filed): it is a file of the repository,
// whose root is given, and holds the finding's class word for word.
const filedWrong = (x, root) => {
  if (!x.filed || !x.file || x.wrong.length) return null;
  if (!root) return `${x.file} cannot be looked up: the project is not in a Git repository`;
  const rel = normalize(x.file);
  if (isAbsolute(rel) || rel.split(sep).includes("..")) return `${x.file} is not a path of the repository`;
  const path = join(root, rel);
  if (!isFile(path)) return `${x.file} is not a file of the repository`;
  // The file read is the one the path resolves to, every symbolic link followed, and it is inside the
  // repository: a link that leads out of it holds nothing of the repository's.
  let real;
  try {
    const inside = relative(realpathSync(root), realpathSync(path));
    real = !inside.startsWith("..") && !isAbsolute(inside);
  } catch {
    real = false;
  }
  if (!real) return `${x.file} resolves to a file outside the repository`;
  if (!read(path).includes(x.cls)) return `${x.file} does not hold the class "${x.cls}"`;
  return null;
};

// A contribution, one run of a model: "provider · ID" (D-108).
export const parseContribution = (v) => {
  const [provider, id, ...rest] = (v ?? "").split("·").map((x) => x.trim());
  return provider && id && !rest.length ? { provider, id, key: `${provider} · ${id}` } : null;
};
export const SHA256 = /^[0-9a-f]{64}$/;
// A task's name: lower-case letters, digits and hyphens, since it names files of records (D-115).
export const TASK_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// The lines of a block: after a line "Name:" alone, the lines "- …" up to the first other line.
export const blockLines = (text, name) => blockAt(text, name)?.map((b) => b.line) ?? null;
// The same, with the number of each line in the file, from 1.
const blockAt = (text, name) => {
  const lines = text.split("\n");
  const at = lines.findIndex((l) => new RegExp(`^${name}:\\s*$`).test(l));
  if (at < 0) return null;
  const out = [];
  for (let i = at + 1; i < lines.length; i++) {
    if (/^-\s/.test(lines[i])) out.push({ line: lines[i], n: i + 1 });
    else if (lines[i].trim()) break;
  }
  return out;
};

// Every record of the directory, with what is wrong with it. opts.latinOnly is the configuration's
// records.latinOnly; opts.root, the root of the repository, in which a filed finding's file is looked up.
// The check, --task, --rounds and done.mjs read the records only through readRoundRecords of tasks.mjs,
// which gives both from the configuration (D-152).
export function parseRounds(dir, opts = {}) {
  const rounds = [];
  const malformed = [];
  for (const f of listFiles(dir, /\.md$/)) {
    const text = read(f);
    const pairs = text
      .split("\n")
      .map((l) => l.match(new RegExp(`^(${FIELDS.join("|")}):\\s*(.*?)\\s*$`)))
      .filter(Boolean)
      .map((m) => [m[1].toLowerCase(), m[2]]);
    const fields = Object.fromEntries(pairs.filter(([, v]) => v !== ""));
    const repeated = [...new Set(pairs.map(([k]) => k).filter((k, i, a) => a.indexOf(k) !== i))];
    const findingsAt = (blockAt(text, "Findings") ?? []).map((b) => ({ ...parseFinding(b.line), n: b.n }));
    const findings = findingsAt.map(({ n, ...x }) => x);
    // The verdict of acceptance (D-107, D-152): "Acceptance: clean", or "Acceptance:" and its finding lines.
    const acceptLine = text.match(/^Acceptance:[ \t]*(.*?)\s*$/m);
    const acceptAt = (blockAt(text, "Acceptance") ?? []).map((b) => ({ ...parseFinding(b.line), n: b.n }));
    const acceptance = !acceptLine ? null : { value: acceptLine[1], findings: acceptAt.map(({ n, ...x }) => x) };
    const contribution = fields.contribution === undefined ? null : parseContribution(fields.contribution);
    const wrong = [
      repeated.length && `${repeated.join(", ")} given more than once`,
      !fields.task && "no task",
      fields.task && !TASK_NAME.test(fields.task) && `task ${fields.task} is not lower-case letters, digits and hyphens`,
      !STEPS.includes(fields.step) && `step ${fields.step ?? "(none)"} is not one of ${STEPS.join(", ")}`,
      fields.narrow && !["true", "false"].includes(fields.narrow) && `narrow ${fields.narrow} is not true or false`,
      !realTime(fields.time) && `time ${fields.time ?? "(none)"} is not a UTC time to the second`,
      fields.start !== undefined && !realTime(fields.start) && `start ${fields.start} is not a UTC time to the second`,
      fields.contribution !== undefined && !contribution && `contribution ${fields.contribution} is not "provider · ID"`,
      fields.contribution !== undefined && fields.start === undefined && "a contribution without a start",
      realTime(fields.start) && realTime(fields.time) && fields.start > fields.time && `start ${fields.start} is after its time ${fields.time}`,
      fields["statement-hash"] !== undefined && !SHA256.test(fields["statement-hash"]) && `statement hash ${fields["statement-hash"]} is not a SHA-256`,
      acceptance && fields.step !== "result-review" && "an acceptance on a review that is not of the result",
      acceptance && !(acceptance.value === "clean" || (acceptance.value === "" && acceptance.findings.length)) && "an acceptance that is neither clean nor a list of findings",
      !fields.by && "no author",
      ...COUNTS.filter((k) => fields[k] !== undefined && !/^\d+$/.test(fields[k])).map((k) => `${k} ${fields[k]} is not a whole number`),
      (fields.number === "0" || fields.ceiling === "0") && "a number or a ceiling starts at 1",
      fields.number === undefined && "no number",
      ...findingsAt.flatMap((x, i) => x.wrong.map((w) => `finding ${i + 1}, line ${x.n}: ${w}`)),
      ...findingsAt.map((x, i) => [x, i, filedWrong(x, opts.root)]).filter(([, , w]) => w).map(([x, i, w]) => `finding ${i + 1}, line ${x.n}: ${w}`),
      ...acceptAt.flatMap((x, i) => x.wrong.map((w) => `acceptance finding ${i + 1}, line ${x.n}: ${w}`)),
      // An item of the approved statement that is not met is not put off (rule.findings-filed).
      ...acceptAt.filter((x) => x.filed).map((x) => `acceptance finding ${acceptAt.indexOf(x) + 1}, line ${x.n}: ${x.filed} in a verdict of acceptance, where an item of the approved statement not met is not put off`),
      ...outsideRecord(text, 1, opts),
    ].filter(Boolean);
    const name = basename(f);
    if (wrong.length) {
      malformed.push(`${name}: ${wrong.join("; ")}`);
      continue;
    }
    const n = (k) => (fields[k] === undefined ? null : Number(fields[k]));
    rounds.push({
      file: name,
      task: fields.task,
      step: fields.step,
      narrow: fields.narrow === "true",
      number: n("number"),
      start: fields.start ?? null,
      time: fields.time,
      by: fields.by,
      contribution,
      statementHash: fields["statement-hash"] ?? null,
      commits: fields.commits ?? null,
      tokens: { new: n("tokens-new"), cached: n("tokens-cached"), out: n("tokens-out") },
      findings,
      acceptance: acceptance && { findings: acceptance.findings },
      overspend: fields.overspend ?? null,
    });
  }
  const seen = new Map();
  for (const r of rounds) {
    const key = `${r.task}|${r.step}|${r.narrow}|${r.number}`;
    if (seen.has(key)) malformed.push(`${seen.get(key)} and ${r.file}: both round ${r.number}${r.narrow ? " (narrow)" : ""} of ${r.step} of ${r.task}`);
    else seen.set(key, r.file);
  }
  return { rounds, malformed };
}

// Rounds in the order they ended; records without a time, as in a test, keep the full rounds before the
// narrow ones, by number.
export const byTime = (rounds) => [...rounds].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "") || a.narrow - b.narrow || a.number - b.number);

// A round's findings are those of its verdict on merging and of its verdict of acceptance (D-107). Those
// of the change that are not filed decide (rule.findings-filed): a filed finding makes no round unclean.
const found = (r) => [...r.findings, ...(r.acceptance?.findings ?? [])];
const ofChange = (r) => found(r).filter((x) => x.ofChange && !x.filed);
export const isClean = (r) => !ofChange(r).length;
const allFixable = (r) => ofChange(r).every((x) => x.fixable);
const allTested = (r) => ofChange(r).every((x) => x.fixable && x.test);
// The important classes of a round, which alone are compared (D-152): two findings of one class count
// once, and a nit, a finding not fixable and a filed one count never.
const important = (r) => new Set(ofChange(r).filter((x) => x.weight === "important" && x.fixable).map((x) => x.cls));

// What follows the last round by time of a step of a task (derived.next-round, D-152), by its branches in
// order. A next round takes the next free number of its kind over every round of the step; the rounds
// compared are those after the last end of the step, its last clean round or the owner's last record of
// approval, whose time is since: rounds before the approval are not read by the branches at all.
export const BUDGET_QUESTION = "the budget is exhausted: a question to the owner";
// A step of the review of a result ends clean only with a clean verdict of acceptance in its last round
// (D-119); without one, what follows is the round that gives it, or the question when the budget is
// exhausted.
export const NO_ACCEPTANCE = "the last round is clean on merging and gives no verdict of acceptance yet: a round that gives it follows, after done.mjs records done";
export const NOT_FIXABLE = "a question to the owner: a finding cannot be fixed without changing what the owner decided";
// refused(round) says why a clean verdict of acceptance does not hold, or null (inv.acceptance-after-done):
// such a round does not end its step either (D-123). tasks.mjs stepNext gives it, for --task and --rounds.
// ended(round) says whether an earlier round ended its step, which resets the comparison of rounds: a
// clean round of the statement, or a clean round of the result whose verdict of acceptance held; by
// default, one that refused does not hold for.
export function nextRound(stepRounds, { exhausted = false, refused = () => null, since = null, ended = null } = {}) {
  const every = byTime(stepRounds);
  const nextOf = (narrow) => Math.max(0, ...every.filter((r) => r.narrow === narrow).map((r) => r.number)) + 1;
  const [nextFull, nextNarrow] = [nextOf(false), nextOf(true)];
  const all = since === null ? every : every.filter((r) => r.time > since);
  const last = all.at(-1);
  if (!last) {
    if (exhausted) return { next: "budget", say: BUDGET_QUESTION };
    return every.length ? { next: "first round", number: nextFull, say: `the owner approved a later version: work goes on under it, then full round ${nextFull}` } : { next: "first round" };
  }
  const clean = isClean(last);
  if (clean && last.step === "result-review" && !last.acceptance) return exhausted ? { next: "budget", say: BUDGET_QUESTION } : { next: "acceptance", say: NO_ACCEPTANCE };
  const why = clean && last.step === "result-review" ? refused(last) : null;
  if (why)
    return exhausted
      ? { next: "budget", say: `the verdict of acceptance of ${last.file} is refused: ${why}; ${BUDGET_QUESTION}` }
      : { next: "refused", say: `the verdict of acceptance of ${last.file} is refused: ${why}; the result needs a verdict of acceptance that holds` };
  if (clean) return { next: "clean", say: "the step ended clean" };
  if (exhausted) return { next: "budget", say: BUDGET_QUESTION };
  // A finding not fixable without changing what the owner decided goes to him, ahead of stagnation.
  if (!allFixable(last)) return { next: "question", say: NOT_FIXABLE };
  // Stagnation: only the rounds after the last end of the step are compared, a round that ended it or the
  // owner's approval; the first round with findings after it is not stagnation. A round of the result
  // clean on merging whose acceptance is absent or refused ended nothing, so it resets nothing (D-152).
  const ends = ended ?? ((r) => isClean(r) && (r.step !== "result-review" || (r.acceptance && !refused(r))));
  const window = all.slice(all.findLastIndex((r) => r !== last && ends(r)) + 1);
  const now = important(last);
  const earlier = window.slice(0, -1);
  if (now.size && earlier.length) {
    const repeated = [...now].filter((c) => earlier.some((r) => important(r).has(c)));
    const fewer = now.size < important(earlier.at(-1)).size;
    if (repeated.length || !fewer)
      return {
        next: "redesign",
        number: nextFull,
        classes: repeated,
        say: `the rounds stagnate (${repeated.length ? `repeated: ${repeated.join(", ")}` : `${now.size} important classes, no fewer than the round before`}): change the design of the solution, do not patch it; then full round ${nextFull}`,
      };
  }
  if (allTested(last)) return { next: "narrow", number: nextNarrow, say: `narrow round ${nextNarrow}, on the fixes of the last round` };
  return { next: "full", number: nextFull, say: `full round ${nextFull}: a finding of the last round has no test that holds its fix` };
}

// A record of the directory of rounds that cannot be read, of any task or of none, blocks every task:
// its correction is the one next action, for --task, --rounds and done.mjs alike (D-152), so that a
// record the reader drops leaves no older approval in force.
export const BLOCKED = "correct the records of rounds that cannot be read first: the one next action";
export const blockedSay = (malformed) => `${BLOCKED} (${malformed.map((m) => m.split(":")[0]).join(", ")})`;

// For each step with ten applications or more, one step of one task with its rounds taken together:
// the rounds, the tokens that are known and the findings of the change by weight (derived.step-payoff).
export const PAYOFF_AFTER = 10;
export function stepPayoff(rounds) {
  const out = [];
  for (const step of STEPS) {
    const of = rounds.filter((r) => r.step === step);
    const tasks = [...new Set(of.map((r) => r.task))];
    if (tasks.length < PAYOFF_AFTER) continue;
    // A sum of what is known, with how many rounds did not say: a count left out is never a zero.
    const sum = (k) => of.reduce((a, r) => a + (r.tokens[k] ?? 0), 0);
    const unknown = Object.fromEntries(["new", "cached", "out"].map((k) => [k, of.filter((r) => r.tokens[k] === null).length]));
    const found = of.flatMap(ofChange);
    const empty = tasks.filter((t) => !of.some((r) => r.task === t && ofChange(r).length)).length;
    out.push({
      step,
      applications: tasks.length,
      rounds: of.length,
      tokens: { new: sum("new"), cached: sum("cached"), out: sum("out"), unknown },
      important: found.filter((x) => x.weight === "important").length,
      nit: found.filter((x) => x.weight === "nit").length,
      empty,
    });
  }
  return out;
}

// exhaustedOf(task) says whether a task's budget is exhausted, from the configuration's limits: a
// statement's own limits are read by --task, which is run before each step (D-119). nextOf(task, step,
// rounds) gives the next round of a step; the check passes tasks.mjs stepNext, the function --task uses,
// so the two never disagree (D-123). malformed is the list of records of rounds that cannot be read:
// while one stands, the one next action of every task is to correct it (D-152).
export function renderRounds(rounds, { exhaustedOf = () => false, nextOf = null, malformed = [] } = {}) {
  const lines = [];
  if (malformed.length) lines.push(`ROUNDS: ${blockedSay(malformed)}`);
  const tasks = [...new Set(rounds.map((r) => r.task))].sort();
  for (const t of tasks)
    for (const step of STEPS) {
      const of = rounds.filter((r) => r.task === t && r.step === step);
      if (!of.length) continue;
      const n = malformed.length ? { say: blockedSay(malformed) } : nextOf ? nextOf(t, step, of) : nextRound(of, { exhausted: exhaustedOf(t) });
      const full = of.filter((r) => !r.narrow).length;
      lines.push(`ROUNDS ${t} · ${step}: ${full} full, ${of.length - full} narrow · next: ${n.say}`);
    }
  for (const p of stepPayoff(rounds))
    lines.push(
      `PAYOFF ${p.step}: ${p.applications} applications, ${p.rounds} rounds, tokens ` +
        ["new", "cached", "out"]
          .map((k) => `${p.tokens[k]} ${k}${p.tokens.unknown[k] ? ` (known for ${p.rounds - p.tokens.unknown[k]} of ${p.rounds} rounds)` : ""}`)
          .join(" · ") +
        `, findings of the change ${p.important} important · ${p.nit} nit, ${p.empty} applications found nothing`,
    );
  return lines.length ? lines.join("\n") : "ROUNDS: no records";
}
