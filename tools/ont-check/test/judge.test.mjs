import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { blindPrompt, judge, judgePrompt } from "../judge.mjs";

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
    judge({ checks, id: "check.member.limit-explained", output: "ana already has 5 of 5 loans", command: command("PASS it names the limit"), verdicts, date: "2026-10-28" });
    const kept = readFileSync(join(verdicts, "check.member.limit-explained", "2026-10-28.md"), "utf8");
    assert.match(kept, /^# check\.member\.limit-explained · 2026-10-28\n\nPASS it names the limit\n\n## Output\n\nana already has 5 of 5 loans\n$/);
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
