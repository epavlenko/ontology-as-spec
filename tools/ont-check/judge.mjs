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
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gitEnv, parseChecks, read } from "./lib.mjs";

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

// The judged command (field.test-suite.judged-command, answer 1042 b, D-186): `npm run --silent
// test:judged` runs the judged suite with the judge JUDGE names, and fails when JUDGE is not set, when
// JUDGE_VERDICTS, or for a suite with judged checks of views JUDGE_SCREENS, is not set or is inside the
// repository, when a test is skipped or marked todo, and when one does not pass. CI does not run it, and
// npm test no longer runs the judged suite: the executor runs it on changes that touch what it judges and
// before a release.
//   node tools/ont-check/judge.mjs --suite example/judged
// ont: field.test-suite.judged-command
export function judgedRunProblems({ env = process.env, root, files, screens }) {
  // Inside the repository by the real paths, symbolic links followed, of the path's deepest existing
  // directory and of the root, and by whole parts of the path, so that "..evidence" is a name in it.
  const real = (p) => {
    let at = resolve(root, p);
    const rest = [];
    while (!existsSync(at) && dirname(at) !== at) {
      rest.unshift(basename(at));
      at = dirname(at);
    }
    return join(realpathSync(at), ...rest);
  };
  const inside = (p) => {
    const rel = relative(realpathSync(resolve(root)), real(p));
    return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
  };
  const wrong = [];
  if (!env.JUDGE) wrong.push("JUDGE is not set: set it to the command of the judge, which reads a prompt on stdin");
  for (const [k, need] of [["JUDGE_VERDICTS", true], ["JUDGE_SCREENS", screens]]) {
    if (!need) continue;
    if (!env[k]) wrong.push(`${k} is not set: set it to a directory outside the repository`);
    else if (inside(env[k])) wrong.push(`${k} is ${env[k]}, inside the repository: the verdicts and screens are kept outside it`);
  }
  if (!files.length) wrong.push("the judged suite has no file");
  return wrong;
}
// The tests a TAP report of node --test failed, skipped or left todo, and how many passed.
export function judgedReport(tap) {
  const lines = tap.split("\n").map((l) => l.trim()).filter((l) => /^(not )?ok \d+ - /.test(l));
  return {
    failed: lines.filter((l) => l.startsWith("not ok")),
    skipped: lines.filter((l) => /#\s*(SKIP|TODO)\b/i.test(l)),
    passed: lines.filter((l) => l.startsWith("ok") && !/#\s*(SKIP|TODO)\b/i.test(l)).length,
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const at = process.argv.indexOf("--suite");
  const dir = at > 0 ? process.argv[at + 1] : null;
  if (!dir || !existsSync(dir)) {
    console.log(`ERROR · give the judged suite with --suite DIR: ${dir ?? "(none)"} is no directory`);
    process.exit(2);
  }
  const root = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", env: gitEnv() }).stdout?.trim() || process.cwd();
  const files = readdirSync(dir).filter((f) => f.endsWith(".judged.mjs")).sort().map((f) => join(dir, f));
  const screens = files.some((f) => /\bJUDGE_SCREENS\b/.test(read(f)));
  const wrong = judgedRunProblems({ root, files, screens });
  if (wrong.length) {
    console.log(`ERROR · the judged tests do not run (${wrong.length}):\n${wrong.map((w) => `  ${w}`).join("\n")}`);
    process.exit(1);
  }
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...files], { encoding: "utf8", env, maxBuffer: 1 << 26 });
  const rep = judgedReport(r.stdout ?? "");
  const problems = [...rep.failed.map((l) => `failed: ${l}`), ...rep.skipped.map((l) => `skipped or todo: ${l}`), ...(r.status !== 0 && !rep.failed.length ? [`node --test ended with ${r.status}: ${(r.stderr ?? "").trim().split("\n").slice(-3).join(" / ")}`] : []), ...(!rep.passed ? ["no judged test passed"] : [])];
  if (problems.length) {
    console.log(`ERROR · the judged tests (${problems.length}):\n${problems.map((p) => `  ${p}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`JUDGED ${rep.passed} passed in ${files.length} files, none skipped`);
}
