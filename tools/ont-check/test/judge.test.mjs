import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { blindPrompt, judge, judgedReport, judgedRunProblems, judgePrompt, keepScreen } from "../judge.mjs";

// A stand-in judge: it keeps what it was given and answers by a rule the test chooses.
const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), "judge-"));
  const checks = join(dir, "checks.md");
  writeFileSync(
    checks,
    [
      "## Member",
      "",
      "| Check | Concepts | GIVEN | WHEN | THEN | Proof |",
      "| ----- | -------- | ----- | ---- | ---- | ----- |",
      "| `check.member.limit-explained` | `inv.within-limit` | ana has five loans | she borrows a sixth | the refusal names her limit | judged |",
      "| `check.member.limit` | `inv.within-limit` | ana has five loans | she borrows a sixth | refused | auto |",
      "",
    ].join("\n"),
  );
  const seen = join(dir, "seen.txt");
  const command = (answer) =>
    `node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{require('fs').writeFileSync('${seen}',s);console.log('${answer}')})"`;
  return { dir, checks, seen, command };
};

test("[rule.judge-sees-the-check] the judge gets the check's case and the output, nothing else", () => {
  const { dir, checks, seen, command } = fixture();
  try {
    const r = judge({ checks, id: "check.member.limit-explained", output: "ana already has 5 of 5 loans", command: command("PASS it names the limit") });
    assert.equal(r.pass, true);
    const prompt = readFileSync(seen, "utf8");
    assert.match(prompt, /GIVEN ana has five loans\nWHEN she borrows a sixth\nTHEN the refusal names her limit/);
    assert.match(prompt, /<<<\nana already has 5 of 5 loans\n>>>/);
    assert.doesNotMatch(prompt, /check\.member|inv\.within-limit|judge\.mjs|\.test\./);
    assert.equal(prompt, judgePrompt({ given: "ana has five loans", when: "she borrows a sixth", then: "the refusal names her limit" }, "ana already has 5 of 5 loans"));
    assert.equal(judge({ checks, id: "check.member.limit-explained", output: "refused", command: command("FAIL no limit named") }).pass, false);
    assert.throws(() => judge({ checks, id: "check.member.limit", output: "x", command: command("PASS") }), /proven auto, not judged/);
    assert.throws(() => judge({ checks, id: "check.member.limit-explained", output: "x", command: "" }), /no judge/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("[rule.verdict-kept] the verdict is written outside the repository, named by the check and the date", () => {
  const { dir, checks, command } = fixture();
  try {
    const verdicts = join(dir, "verdicts");
    judge({ checks, id: "check.member.limit-explained", output: "you have too many loans", command: command("FAIL no limit named"), verdicts, date: "2026-10-28" });
    judge({ checks, id: "check.member.limit-explained", output: "ana already has 5 of 5 loans", command: command("PASS it names the limit"), verdicts, date: "2026-10-28" });
    // A later run of the day does not erase the earlier one.
    const kept = readFileSync(join(verdicts, "check.member.limit-explained", "2026-10-28.md"), "utf8");
    const run = (verdict, output) => `\\n## Run at \\S+\\n\\n${verdict}\\n\\n### Output\\n\\n${output}\\n`;
    assert.match(kept, new RegExp(`^# check\\.member\\.limit-explained · 2026-10-28\\n${run("FAIL no limit named", "you have too many loans")}${run("PASS it names the limit", "ana already has 5 of 5 loans")}$`));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("judge() takes the verdict from the first word of the answer, and fails on an answer that is not one", () => {
  const { dir, checks, command } = fixture();
  try {
    const verdict = (answer) => judge({ checks, id: "check.member.limit-explained", output: "x", command: command(answer) }).pass;
    assert.equal(verdict("PASS"), true);
    assert.equal(verdict("**PASS** — it names the limit"), true);
    assert.equal(verdict("FAIL: no limit named"), false);
    for (const answer of ["PASS/FAIL: FAIL", "PASS? No, FAIL.", "PASSED", "It passes", "PASS, FAIL", "Pass, Fail", "Pass"])
      assert.throws(() => verdict(answer), /did not answer with PASS or FAIL first/, answer);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("[action.derive-blind] a blind derivation gives the model the ontology, the catalogue and the case, not the answer", () => {
  const prompt = blindPrompt({ ontology: "| Rule | `rule.renewal` | Renewal rule | | Up to 2 renewals. |", catalogue: "| `check.loan.renew-twice` | ... |", given: "ana renewed twice", when: "she renews again" });
  assert.match(prompt, /<<< ontology\n\| Rule \| `rule\.renewal`/);
  assert.match(prompt, /<<< catalogue\n\| `check\.loan\.renew-twice`/);
  assert.match(prompt, /GIVEN ana renewed twice\nWHEN she renews again/);
  assert.doesNotMatch(prompt, /THEN/);
});

test("[check.check.screen-kept] keeps the snapshot of a view's state by date, view and state, and nothing without a directory", () => {
  const dir = mkdtempSync(join(tmpdir(), "screens-"));
  try {
    const screens = join(dir, "screens");
    const image = join(dir, "shot.png");
    writeFileSync(image, "png");
    const written = keepScreen({ view: "view.member.loans", state: "empty", text: "nothing on loan, no holds\n", image, screens, date: "2026-11-05" });
    assert.deepEqual(readdirSync(screens).sort(), ["2026-11-05-view.member.loans-empty.png", "2026-11-05-view.member.loans-empty.txt"]);
    assert.equal(readFileSync(join(screens, "2026-11-05-view.member.loans-empty.txt"), "utf8"), "nothing on loan, no holds\n");
    assert.equal(written.length, 2);
    const none = join(dir, "none");
    // Without a directory, the environment's own included: test:judged sets JUDGE_SCREENS, and done.mjs
    // runs npm test in that environment too (D-186).
    const kept = process.env.JUDGE_SCREENS;
    delete process.env.JUDGE_SCREENS;
    try {
      assert.deepEqual(keepScreen({ view: "view.member.loans", state: "empty", text: "x", screens: undefined }), []);
    } finally {
      if (kept !== undefined) process.env.JUDGE_SCREENS = kept;
    }
    assert.ok(!existsSync(none));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The judged command (field.test-suite.judged-command, answer 1042 b, D-186).
test("[check.test-suite.judged-command] test:judged fails with no JUDGE, with JUDGE_VERDICTS missing or inside the repository, with JUDGE_SCREENS inside it, and with a judge that fails a test; it exits 0 with a judge that passes all; neither test nor test:ci runs the judged suite", () => {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.match(pkg.scripts["test:judged"], /judge\.mjs --suite example\/judged$/);
  for (const s of ["test", "test:ci"]) assert.ok(!/judged/.test(pkg.scripts[s]), `${s}: ${pkg.scripts[s]}`);
  const dir = mkdtempSync(join(tmpdir(), "ont-judged-cmd-"));
  try {
    const judgeOf = (word) => {
      const f = join(dir, `${word}.mjs`);
      writeFileSync(f, `process.stdin.resume();process.stdin.on("end",()=>console.log("${word} because the output says so"));\n`);
      return `${process.execPath} ${f}`;
    };
    const outside = (k) => join(dir, k);
    const run = (env) => {
      const e = { ...process.env, ...env };
      for (const k of ["JUDGE", "JUDGE_VERDICTS", "JUDGE_SCREENS", "NODE_TEST_CONTEXT"]) if (!(k in env)) delete e[k];
      const r = spawnSync("npm", ["run", "--silent", "test:judged"], { cwd: root, encoding: "utf8", env: e });
      return { code: r.status, out: `${r.stdout}${r.stderr}` };
    };
    const all = { JUDGE: judgeOf("PASS"), JUDGE_VERDICTS: outside("verdicts"), JUDGE_SCREENS: outside("screens") };
    const cases = [
      [{ ...all, JUDGE: undefined }, /JUDGE is not set/],
      [{ ...all, JUDGE_VERDICTS: undefined }, /JUDGE_VERDICTS is not set/],
      [{ ...all, JUDGE_VERDICTS: join(root, "tmp-verdicts") }, /JUDGE_VERDICTS is .*inside the repository/],
      [{ ...all, JUDGE_SCREENS: join(root, "example") }, /JUDGE_SCREENS is .*inside the repository/],
      [{ ...all, JUDGE: judgeOf("FAIL") }, /failed: not ok/],
    ];
    for (const [env, why] of cases) {
      const r = run(Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined)));
      assert.notEqual(r.code, 0, r.out);
      assert.match(r.out, why);
    }
    const ok = run(all);
    assert.equal(ok.code, 0, ok.out);
    assert.match(ok.out, /^JUDGED \d+ passed in 2 files, none skipped$/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("[check.test-suite.judged-command] a report with a skipped or a todo test is refused like a failed one", () => {
  const r = judgedReport("ok 1 - a # SKIP no judge\nok 2 - b # TODO later\nnot ok 3 - c\nok 4 - d\n");
  assert.equal(r.failed.length, 1);
  assert.equal(r.skipped.length, 2);
  assert.equal(r.passed, 1);
  assert.deepEqual(judgedRunProblems({ env: {}, root: "/r", files: [], screens: true }).length, 4);
});
