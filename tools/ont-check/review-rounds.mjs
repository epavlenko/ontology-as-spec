// Records of review rounds (D-97, D-99): one file per round of review of a task, in the directory the
// configuration names under reviewRounds, with what the round cost and found. From them the tool says
// what follows the last round of each step, and, once a step has ten applications, what it paid off.
// ont: ent.review-round, field.review-round.task, field.review-round.step, field.review-round.narrow, field.review-round.number, field.review-round.ceiling, field.review-round.time, field.review-round.commits, field.review-round.by, field.review-round.tokens-new, field.review-round.tokens-cached, field.review-round.tokens-out, field.review-round.checks-listed, field.review-round.checks-given, field.review-round.checks-carried, field.review-round.findings, edge.review-round.runs, derived.next-round, derived.step-payoff, rule.round-ceilings, rule.rounds-converge, rule.ready-after-clean-round, inv.review-rounds-well-formed
import { basename } from "node:path";
import { listFiles, read } from "./lib.mjs";

export const STEPS = ["statement-review", "result-review"];
const FIELDS = ["Task", "Step", "Narrow", "Number", "Ceiling", "Time", "Commits", "By", "Tokens-new", "Tokens-cached", "Tokens-out", "Checks-listed", "Checks-given", "Checks-carried", "Runs"];
const COUNTS = ["number", "ceiling", "tokens-new", "tokens-cached", "tokens-out", "checks-listed", "checks-given", "checks-carried"];
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
// A time is real when it reads back as itself: 2026-99-99T99:99:99Z has the shape and is no time.
const realTime = (t) => TIME.test(t ?? "") && !Number.isNaN(Date.parse(t)) && new Date(t).toISOString().replace(".000Z", "Z") === t;
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
    const findingLines = (text.split(/^Findings:\s*$/m)[1] ?? "").split("\n").filter((l) => /^-\s/.test(l));
    const findings = findingLines.map(parseFinding);
    const wrong = [
      repeated.length && `${repeated.join(", ")} given more than once`,
      !fields.task && "no task",
      !STEPS.includes(fields.step) && `step ${fields.step ?? "(none)"} is not one of ${STEPS.join(", ")}`,
      fields.narrow && !["true", "false"].includes(fields.narrow) && `narrow ${fields.narrow} is not true or false`,
      !realTime(fields.time) && `time ${fields.time ?? "(none)"} is not a UTC time to the second`,
      !fields.by && "no author",
      ...COUNTS.filter((k) => fields[k] !== undefined && !/^\d+$/.test(fields[k])).map((k) => `${k} ${fields[k]} is not a whole number`),
      (fields.number === "0" || fields.ceiling === "0") && "a number or a ceiling starts at 1",
      fields.number === undefined && "no number",
      ...findings.flatMap((x, i) => x.wrong.map((w) => `finding ${i + 1}: ${w}`)),
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
      time: fields.time,
      by: fields.by,
      tokens: { new: n("tokens-new"), cached: n("tokens-cached"), out: n("tokens-out") },
      findings,
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

// Findings of the change, counted by class: two findings of one class count once.
const classes = (r) => new Set(r.findings.filter((x) => x.ofChange).map((x) => x.cls)).size;
const ofChange = (r) => r.findings.filter((x) => x.ofChange);
const allFixable = (r) => ofChange(r).every((x) => x.fixable);
const allTested = (r) => ofChange(r).every((x) => x.fixable && x.test);

// What follows the last round of a step of a task (derived.next-round).
export function nextRound(stepRounds) {
  const order = (a, b) => a.narrow - b.narrow || a.number - b.number;
  const all = [...stepRounds].sort(order);
  const full = all.filter((r) => !r.narrow);
  const narrow = all.filter((r) => r.narrow);
  const last = all.at(-1);
  if (!last) return { next: "first round" };
  if (!classes(last)) return { next: "clean", say: "the step ended clean" };
  const ask = (why) => ({ next: "question", say: `a question to the owner: ${why}` });
  // A finding not fixable within the task goes to the owner, whatever round found it.
  if (!allFixable(last)) return ask("a finding is not fixable within the task");
  if (!last.narrow) {
    const ceiling = full[0]?.ceiling;
    if (!ceiling) return ask("the task set no ceiling for this step (rule.round-ceilings)");
    // Six full rounds of a step in all, whatever the ceiling.
    if (full.length < Math.min(ceiling, FULL_ROUNDS)) return { next: "full", say: `round ${full.length + 1}, within the ceiling of ${ceiling}` };
    const prev = full.at(-2);
    const converging = prev && classes(last) < classes(prev) && allFixable(last);
    if (converging && full.length < FULL_ROUNDS) return { next: "full", say: `round ${full.length + 1}: past the ceiling, the rounds converge` };
    if (allTested(last)) return { next: "narrow", say: "narrow round 1, on the fixes of the last round" };
    return ask("a finding of the last round has no test that holds its fix");
  }
  const before = narrow.length > 1 ? narrow.at(-2) : full.at(-1);
  if (!before || classes(last) >= classes(before)) return ask("the narrow round found as many findings as the round before, or more");
  if (!allTested(last)) return ask("a finding of the narrow round has no test that holds its fix");
  if (narrow.length >= NARROW_ROUNDS) return ask(`findings left after ${NARROW_ROUNDS} narrow rounds`);
  return { next: "narrow", say: `narrow round ${narrow.length + 1}` };
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

export function renderRounds(rounds) {
  const lines = [];
  const tasks = [...new Set(rounds.map((r) => r.task))].sort();
  for (const t of tasks)
    for (const step of STEPS) {
      const of = rounds.filter((r) => r.task === t && r.step === step);
      if (!of.length) continue;
      const n = nextRound(of);
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
