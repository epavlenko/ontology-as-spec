// Judged checks (D-60): a test runs the product on a fixed sample, and a model judges the output
// against the check's case. The judge gets the case and the output and nothing else: not the code,
// not the test, not an expected text. A verdict is written outside the repository, named by the check
// and the date, when JUDGE_VERDICTS names a directory.
//   const { pass, verdict } = judge({ checks: "checks.md", id: "check.member.limit-refusal-explained", output });
// The judge is a command the project chooses, set in JUDGE: it reads the prompt on stdin and answers
// PASS or FAIL on its first line, then why.
// ont: rule.judge-sees-the-check, rule.verdict-kept
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
    writeFileSync(join(dir, `${date}.md`), `# ${id} · ${date}\n\n${verdict}\n\n## Output\n\n${output}\n`);
  }
  return { pass: /^PASS\b/i.test(verdict), verdict };
}
