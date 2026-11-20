// Records of review rounds (D-97, D-99): one file per round of review of a task, in the directory the
// configuration names under reviewRounds, with what the round cost and found. From them the tool says
// what follows the last round of each step, and, once a step has ten applications, what it paid off.
// ont: ent.review-round, field.review-round.task, field.review-round.step, field.review-round.narrow, field.review-round.number, field.review-round.ceiling, field.review-round.time, field.review-round.commits, field.review-round.by, field.review-round.tokens-new, field.review-round.tokens-cached, field.review-round.tokens-out, field.review-round.checks-listed, field.review-round.checks-given, field.review-round.checks-carried, field.review-round.findings, field.review-round.start, field.review-round.contribution, field.review-round.acceptance, field.review-round.overspend, edge.review-round.runs, edge.review-round.statement, derived.next-round, derived.step-payoff, rule.round-ceilings, rule.rounds-converge, rule.ready-after-clean-round, inv.review-rounds-well-formed
import { basename } from "node:path";
import { listFiles, read } from "./lib.mjs";

export const STEPS = ["statement-review", "result-review"];
const FIELDS = ["Task", "Step", "Narrow", "Number", "Ceiling", "Start", "Time", "Commits", "By", "Contribution", "Statement-hash", "Tokens-new", "Tokens-cached", "Tokens-out", "Checks-listed", "Checks-given", "Checks-carried", "Runs", "Overspend"];
const COUNTS = ["number", "ceiling", "tokens-new", "tokens-cached", "tokens-out", "checks-listed", "checks-given", "checks-carried"];
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
// A time is real when it reads back as itself: 2026-99-99T99:99:99Z has the shape and is no time.
export const realTime = (t) => TIME.test(t ?? "") && !Number.isNaN(Date.parse(t)) && new Date(t).toISOString().replace(".000Z", "Z") === t;
// The approach's numbers (rule.rounds-converge): full rounds of a step in all, and narrow rounds.
export const FULL_ROUNDS = 6;
export const NARROW_ROUNDS = 3;

// A finding: "- class · important · change · fixable · path/to/test.mjs", the test once the fix is made.
export const parseFinding = (line) => {
  const [cls, weight, of, fix, test] = line.replace(/^-\s*/, "").split("·").map((x) => x.trim());
  const wrong = [
    !cls && "no class",
    !["important", "nit"].includes(weight) && `weight ${weight ?? "(none)"} is not important or nit`,
    !["change", "before"].includes(of) && `${of ?? "(none)"} is not change or before`,
    !["fixable", "not fixable"].includes(fix) && `${fix ?? "(none)"} is not fixable or not fixable`,
  ].filter(Boolean);
  return { cls, weight, ofChange: of === "change", fixable: fix === "fixable", test: test || null, wrong };
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
export const blockLines = (text, name) => {
  const lines = text.split("\n");
  const at = lines.findIndex((l) => new RegExp(`^${name}:\\s*$`).test(l));
  if (at < 0) return null;
  const out = [];
  for (const l of lines.slice(at + 1)) {
    if (/^-\s/.test(l)) out.push(l);
    else if (l.trim()) break;
  }
  return out;
};

// Every record of the directory, with what is wrong with it.
export function parseRounds(dir) {
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
    const findings = (blockLines(text, "Findings") ?? []).map(parseFinding);
    // The verdict of acceptance (D-107): "Acceptance: clean", or "Acceptance:" and its finding lines.
    const acceptLine = text.match(/^Acceptance:[ \t]*(.*?)\s*$/m);
    const acceptance = !acceptLine ? null : { value: acceptLine[1], findings: (blockLines(text, "Acceptance") ?? []).map(parseFinding) };
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
      ...findings.flatMap((x, i) => x.wrong.map((w) => `finding ${i + 1}: ${w}`)),
      ...(acceptance?.findings ?? []).flatMap((x, i) => x.wrong.map((w) => `acceptance finding ${i + 1}: ${w}`)),
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
      ceiling: n("ceiling"),
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

// Findings of the change, counted by class: two findings of one class count once.
// A round's findings are those of its verdict on merging and of its verdict of acceptance (D-107).
const found = (r) => [...r.findings, ...(r.acceptance?.findings ?? [])];
const classes = (r) => new Set(found(r).filter((x) => x.ofChange).map((x) => x.cls)).size;
const ofChange = (r) => found(r).filter((x) => x.ofChange);
export const isClean = (r) => !classes(r);
const allFixable = (r) => ofChange(r).every((x) => x.fixable);
const allTested = (r) => ofChange(r).every((x) => x.fixable && x.test);

// What follows the last round by time of a step of a task (derived.next-round). A next round takes the
// next free number of its kind; with the task's budget exhausted, what would be another round is a
// question to the owner, ahead of the branches of convergence (D-106, D-108).
export const BUDGET_QUESTION = "the budget is exhausted: a question to the owner";
// A step of the review of a result ends clean only with a clean verdict of acceptance in its last round
// (D-119); without one, what follows is the round that gives it, or the question when the budget is
// exhausted.
export const NO_ACCEPTANCE = "the last round is clean on merging and gives no verdict of acceptance yet: a round that gives it follows, after done.mjs records done";
// refused(round) says why a clean verdict of acceptance does not hold, or null (inv.acceptance-after-done):
// such a round does not end its step either (D-123). tasks.mjs stepNext gives it, for --task and --rounds.
export function nextRound(stepRounds, { exhausted = false, refused = () => null } = {}) {
  const all = byTime(stepRounds);
  const full = all.filter((r) => !r.narrow);
  const narrow = all.filter((r) => r.narrow);
  const last = all.at(-1);
  if (!last) return exhausted ? { next: "budget", say: BUDGET_QUESTION } : { next: "first round" };
  if (!classes(last) && last.step === "result-review" && !last.acceptance) return exhausted ? { next: "budget", say: BUDGET_QUESTION } : { next: "acceptance", say: NO_ACCEPTANCE };
  const why = !classes(last) && last.step === "result-review" ? refused(last) : null;
  if (why)
    return exhausted
      ? { next: "budget", say: `the verdict of acceptance of ${last.file} is refused: ${why}; ${BUDGET_QUESTION}` }
      : { next: "refused", say: `the verdict of acceptance of ${last.file} is refused: ${why}; the result needs a verdict of acceptance that holds` };
  if (!classes(last)) return { next: "clean", say: "the step ended clean" };
  const ask = (why) => ({ next: "question", say: `a question to the owner: ${why}` });
  if (exhausted) return { next: "budget", say: BUDGET_QUESTION };
  const nextFull = Math.max(0, ...full.map((r) => r.number)) + 1;
  const nextNarrow = Math.max(0, ...narrow.map((r) => r.number)) + 1;
  // A finding not fixable within the task goes to the owner, whatever round found it.
  if (!allFixable(last)) return ask("a finding is not fixable within the task");
  if (!last.narrow) {
    const ceiling = full[0]?.ceiling ?? full.find((r) => r.ceiling)?.ceiling;
    if (!ceiling) return ask("the task set no ceiling for this step (rule.round-ceilings)");
    // Six full rounds of a step in all, whatever the ceiling.
    if (full.length < Math.min(ceiling, FULL_ROUNDS)) return { next: "full", number: nextFull, say: `round ${nextFull}, within the ceiling of ${ceiling}` };
    const prev = full.at(-2);
    const converging = prev && classes(last) < classes(prev) && allFixable(last);
    if (converging && full.length < FULL_ROUNDS) return { next: "full", number: nextFull, say: `round ${nextFull}: past the ceiling, the rounds converge` };
    if (allTested(last)) {
      if (narrow.length >= NARROW_ROUNDS) return ask(`findings left after ${NARROW_ROUNDS} narrow rounds`);
      return { next: "narrow", number: nextNarrow, say: `narrow round ${nextNarrow}, on the fixes of the last round` };
    }
    return ask("a finding of the last round has no test that holds its fix");
  }
  const before = all.at(-2);
  if (!before || classes(last) >= classes(before)) return ask("the narrow round found as many findings as the round before, or more");
  if (!allTested(last)) return ask("a finding of the narrow round has no test that holds its fix");
  if (narrow.length >= NARROW_ROUNDS) return ask(`findings left after ${NARROW_ROUNDS} narrow rounds`);
  return { next: "narrow", number: nextNarrow, say: `narrow round ${nextNarrow}` };
}

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
// so the two never disagree (D-123).
export function renderRounds(rounds, { exhaustedOf = () => false, nextOf = null } = {}) {
  const lines = [];
  const tasks = [...new Set(rounds.map((r) => r.task))].sort();
  for (const t of tasks)
    for (const step of STEPS) {
      const of = rounds.filter((r) => r.task === t && r.step === step);
      if (!of.length) continue;
      const n = nextOf ? nextOf(t, step, of) : nextRound(of, { exhausted: exhaustedOf(t) });
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
