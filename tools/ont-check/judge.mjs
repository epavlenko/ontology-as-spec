// Judged checks (D-60): a test runs the product on a fixed sample, and a model judges the output
// against the check's case. The judge gets the case and the output and nothing else: not the code,
// not the test, not an expected text. A verdict is written outside the repository, named by the check
// and the date, when JUDGE_VERDICTS names a directory; every run of a day is kept in that file.
//   const { pass, verdict } = judge({ checks: "checks.md", id: "check.member.limit-refusal-explained", output });
// The judge is a command the project chooses, set in JUDGE: it reads the prompt on stdin and answers
// with PASS or FAIL, in capitals, as its first word, then why. An answer that starts otherwise, or whose
// first line holds both words, is not a verdict: judge() fails rather than guess.
// ont: rule.judge-sees-the-check, rule.verdict-kept
import { spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { parseChecks, read } from "./lib.mjs";

export const judgePrompt = (check, output) =>
  [
    "You judge one check of a product, from its case and the product's output alone.",
    "",
    `GIVEN ${check.given}`,
    `WHEN ${check.when}`,
    `THEN ${check.then}`,
    "",
    "The product's output:",
    "<<<",
    output,
    ">>>",
    "",
    "Answer PASS on the first line if the output shows that THEN holds, otherwise FAIL; then say why in one sentence.",
  ].join("\n");

// A blind derivation (D-62): a model that sees only the ontology and the catalogue says what should
// happen in a case the catalogue does not hold. The owner's answer is the THEN of a judged check kept
// outside the catalogue, and judge() compares the derived answer with it.
// ont: action.derive-blind
export const blindPrompt = ({ ontology, catalogue, given, when }) =>
  [
    "Here are a product's ontology and its catalogue of checks. You have not seen its code.",
    "",
    "<<< ontology",
    ontology,
    ">>>",
    "",
    "<<< catalogue",
    catalogue,
    ">>>",
    "",
    `GIVEN ${given}`,
    `WHEN ${when}`,
    "",
    "Say what should happen, in the product's terms, in one or two sentences.",
  ].join("\n");

// PASS or FAIL, from the first word of the answer; null when the answer is not a verdict. Only the words
// in capitals count, as the prompt asks, so that "Pass, Fail" is no more a verdict than "PASS, FAIL".
export const verdictOf = (answer) => {
  const first = answer.split("\n")[0].replace(/\*\*/g, "").trim();
  const word = first.match(/^(PASS|FAIL)(?=$|[\s.,:;—–-])/)?.[1];
  return word && !(/\bPASS\b/.test(first) && /\bFAIL\b/.test(first)) ? word : null;
};

// The screens of a view's judged checks (D-83): the snapshot of each state, and its image when the
// product took one, in the directory JUDGE_SCREENS names, by date, view and state, for the owner to
// judge layout and style on. Returns the files written; nothing without JUDGE_SCREENS.
// ont: rule.screens-kept
export function keepScreen({ view, state, text, image, screens = process.env.JUDGE_SCREENS, date = new Date().toISOString().slice(0, 10) }) {
  if (!screens) return [];
  mkdirSync(screens, { recursive: true });
  const base = join(screens, `${date}-${view}-${state}`);
  const written = [];
  if (text !== undefined) {
    writeFileSync(`${base}.txt`, text);
    written.push(`${base}.txt`);
  }
  if (image) {
    const to = `${base}${extname(image) || ".png"}`;
    copyFileSync(image, to);
    written.push(to);
  }
  return written;
}

export function judge({
  checks,
  id,
  output,
  command = process.env.JUDGE,
  verdicts = process.env.JUDGE_VERDICTS,
  date = new Date().toISOString().slice(0, 10),
}) {
  const check = parseChecks(read(checks)).find((c) => c.id === id);
  if (!check) throw new Error(`${id} is not in ${checks}`);
  if (check.proof !== "judged") throw new Error(`${id} is proven ${check.proof || "by nothing"}, not judged`);
  if (!command) throw new Error("no judge: set JUDGE to a command that reads the prompt on stdin");
  const r = spawnSync(command, { shell: true, input: judgePrompt(check, output), encoding: "utf8" });
  if (r.status !== 0) throw new Error(`the judge failed: ${r.stderr.trim()}`);
  const verdict = r.stdout.trim();
  if (verdicts) {
    const dir = join(verdicts, id);
    mkdirSync(dir, { recursive: true });
    // A later run of the same day is added after the earlier ones, which stay as evidence.
    const file = join(dir, `${date}.md`);
    if (!existsSync(file)) writeFileSync(file, `# ${id} · ${date}\n`);
    appendFileSync(file, `\n## Run at ${new Date().toISOString()}\n\n${verdict}\n\n### Output\n\n${output}\n`);
  }
  const word = verdictOf(verdict);
  if (!word) throw new Error(`the judge did not answer with PASS or FAIL first: ${verdict.split("\n")[0]}`);
  return { pass: word === "PASS", verdict };
}
