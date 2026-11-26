// The proofs review and run (D-154 to D-157): how the tool reads them, how it reads the files of the
// earlier proof manual, the verdict records with their performer, the stamps, the approach's checks of
// run with their guides, and the order of an update. Most cases copy the example into a git repository
// of its own and run the check on it.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseAnchors } from "../docs.mjs";
import { headingAnchor, parseChecks, parseGlossary, readApproach } from "../lib.mjs";
import { parseRuns, recordVerdicts, runStamp } from "../manual-runs.mjs";

const TOOLS = fileURLToPath(new URL("../", import.meta.url));
const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const EXAMPLE = join(REPO, "example");
const ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.org", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.org" };
const OVERDUE = "check.loan.overdue-in-real-time";

const patch = (dir, file, from, to) => {
  const path = join(dir, file);
  const text = readFileSync(path, "utf8");
  assert.ok(text.includes(from), `fixture text not found in ${file}: ${from}`);
  writeFileSync(path, text.replace(from, to));
};
const git = (dir, ...a) => spawnSync("git", ["-C", dir, ...a], { encoding: "utf8", env: ENV });
// A copy of the example, edited by before, committed, then edited by after; fn gets the directory.
const inExample = (fn, { before, after } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), "ont-kinds-"));
  try {
    cpSync(EXAMPLE, dir, { recursive: true, filter: (src) => !src.startsWith(join(EXAMPLE, "releases")) });
    before?.(dir);
    git(dir, "init", "-q", "-b", "main");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "base");
    after?.(dir);
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
const check = (dir, args = [], tool = TOOLS) => {
  const r = spawnSync("node", [join(tool, "ont-check.mjs"), "--config", join(dir, "ont.config.json"), ...args], { encoding: "utf8" });
  return { code: r.status, out: r.stdout + r.stderr };
};
// A catalogue row of the example's Loan section, put before the check of overdue.
const addCheck = (dir, id, concept, proof) =>
  patch(dir, "checks.md", `| \`${OVERDUE}\``, `| \`${id}\` | \`${concept}\` | ana's loan | she reads the screen | she understands it | ${proof} | |\n| \`${OVERDUE}\``);
// The IDs listed under one heading of a report or of --review.
const listedUnder = (out, heading) => {
  const start = out.indexOf(heading);
  if (start < 0) return null;
  const rest = out.slice(start).split("\n").slice(1);
  const end = rest.findIndex((l) => !l.startsWith("  "));
  return rest
    .slice(0, end < 0 ? undefined : end)
    .map((l) => l.match(/^ {2}(check\.[a-z0-9.-]+)/)?.[1])
    .filter(Boolean);
};
const reviewList = (out, kind, which) => listedUnder(out, `Checks of ${kind} of the ${which}`) ?? [];

test("[check.check.manual-read-as-before] a catalogue that keeps the proof manual passes, says what to write, and --review lists it with the checks of review", () => {
  inExample(
    (dir) => {
      const r = check(dir);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /info · checks whose proof is the earlier manual, read as before \(write review when [^\n]*\) \(1\):\n {2}check\.loan\.overdue-in-real-time\n/);
      assert.doesNotMatch(r.out, /malformed checks/);
      const rv = check(dir, ["--review", "HEAD"]);
      assert.deepEqual(reviewList(rv.out, "review", "project"), [OVERDUE], rv.out);
      assert.deepEqual(reviewList(rv.out, "run", "project"), [], rv.out);
      assert.match(rv.out, /check\.loan\.overdue-in-real-time \[derived\.overdue\] stamp [0-9a-f]{8} \(proof manual, read as review\)/);
    },
    {
      before: (dir) => {
        const f = join(dir, "checks.md");
        writeFileSync(f, readFileSync(f, "utf8").replace(/(`check\.loan\.overdue-in-real-time`[^\n]*\| )run( +\|)/, "$1manual$2"));
      },
      after: (dir) => appendFileSync(join(dir, "app/library.mjs"), "// a change\n"),
    },
  );
});

test("[check.check.no-manual-left] no catalogue of the approach, the example or the templates holds the proof manual", () => {
  for (const f of ["checks.md", "example/checks.md", "templates/checks.md"]) {
    const manual = parseChecks(readFileSync(join(REPO, f), "utf8")).filter((c) => c.proof === "manual");
    assert.deepEqual(manual.map((c) => c.id), [], f);
  }
  // The approach's checks of run are the five the statement of the change names, and the example's two.
  const run = (f) => parseChecks(readFileSync(join(REPO, f), "utf8")).filter((c) => c.proof === "run").map((c) => c.id).sort();
  assert.deepEqual(run("checks.md"), [
    "check.check.blind-derivation",
    "check.doc-section.guide-runs-check",
    "check.mockup-element.label-is-true",
    "check.mockup-element.one-plain-mockup",
    "check.product-release.verified-by-reviewer",
  ]);
  assert.deepEqual(run("example/checks.md"), [OVERDUE, "check.screens.refusal-understandable"]);
  assert.deepEqual(run("templates/checks.md"), ["check.thing.close-is-clear"]);
});

test("[check.check.coverage-kinds] --coverage counts the checks of review and of run of a concept apart", () => {
  inExample(
    (dir) => {
      const r = check(dir, ["--coverage"]);
      const line = r.out.split("\n").find((l) => /^\|\s*`derived\.overdue`/.test(l));
      assert.ok(line, r.out);
      assert.match(line, /\(1 review, 1 run\)/);
    },
    { before: (dir) => addCheck(dir, "check.loan.overdue-explained", "derived.overdue", "review") },
  );
});

test("[check.test.tags-manual] tests that name a check of review, of run, of the earlier manual or of run of the approach, and a suite that names a check of run, fail", () => {
  inExample(
    (dir) => {
      const r = check(dir);
      assert.equal(r.code, 1, r.out);
      assert.deepEqual(listedUnder(r.out, "ERROR · checks of review or run tagged in end-to-end tests"), [
        "check.loan.overdue-in-real-time",
        "check.loan.renew-explained",
        "check.loan.renew-old",
        "check.mockup-element.label-is-true",
      ]);
      assert.deepEqual(listedUnder(r.out, "ERROR · checks of review or run the judged suite names"), [OVERDUE]);
    },
    {
      before: (dir) => {
        addCheck(dir, "check.loan.renew-explained", "action.renew", "review");
        addCheck(dir, "check.loan.renew-old", "action.renew", "manual");
        patch(dir, "e2e/cli.test.mjs", "[check.loan.return-closes-loan]", `[check.loan.return-closes-loan, ${OVERDUE}, check.loan.renew-explained, check.loan.renew-old, check.mockup-element.label-is-true]`);
        patch(dir, "ont.config.json", '"check.member.limit-refusal-explained",', `"check.member.limit-refusal-explained",\n        "${OVERDUE}",`);
      },
    },
  );
});

test("[check.trace.untraced-kinds] checks of review, run and the earlier manual may go untraced; an automatic one may not", () => {
  inExample(
    (dir) => {
      const r = check(dir);
      assert.deepEqual(listedUnder(r.out, "ERROR · checks on a Not traced line that the oracle can run"), ["check.loan.untraced-auto"], r.out);
    },
    {
      before: (dir) => {
        addCheck(dir, "check.loan.renew-explained", "action.renew", "review");
        addCheck(dir, "check.loan.renew-old", "action.renew", "manual");
        addCheck(dir, "check.loan.untraced-auto", "action.renew", "auto");
        patch(
          dir,
          "checks.md",
          `- Not traced: \`${OVERDUE}\``,
          "- Not traced: `check.loan.renew-explained` — read on the screen.\n- Not traced: `check.loan.renew-old` — read on the screen.\n- Not traced: `check.loan.untraced-auto` — no reason the oracle cannot run it.\n" +
            `- Not traced: \`${OVERDUE}\``,
        );
      },
    },
  );
});

// The configuration's key manualRuns is read as verdicts (D-157).
test("[check.manual-run.old-key] manualRuns is read as verdicts with a note, verdicts alone says nothing, both are an error", () => {
  const record = (dir, stamp) => {
    mkdirSync(join(dir, "verify/runs"), { recursive: true });
    const commit = git(dir, "rev-parse", "--short", "HEAD").stdout.trim();
    writeFileSync(
      join(dir, `verify/runs/20261122T090000Z-${OVERDUE}-a1b2.md`),
      `Check: ${OVERDUE}\nTime: 2026-11-22T09:00:00Z\nCommit: ${commit}\nStamp: ${stamp}\nVerdict: pass\nBy: gpt-6.1-sol, OpenAI\nPerformer: agent\n`,
    );
  };
  const stampIn = (dir) => {
    const { ONT, rows, notes } = parseGlossary(readFileSync(join(dir, "ontology.md"), "utf8"));
    const byId = new Map(parseChecks(readFileSync(join(dir, "checks.md"), "utf8")).map((c) => [c.id, c]));
    return runStamp(byId.get(OVERDUE), ONT, rows, byId, notes);
  };
  const noRecord = (out) => (listedUnder(out, "info · checks of review or run of implemented concepts with no current record") ?? []).includes(OVERDUE);
  inExample((dir) => {
    patch(dir, "ont.config.json", '"verdicts": { "dir": "verify/runs" }', '"manualRuns": { "dir": "verify/runs" }');
    record(dir, stampIn(dir));
    const r = check(dir);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /info · configuration keys of an earlier version, read as before \(rename them\) \(1\):\n {2}manualRuns: write verdicts\n/);
    assert.ok(!noRecord(r.out), r.out);
  });
  inExample((dir) => {
    record(dir, stampIn(dir));
    const r = check(dir);
    assert.equal(r.code, 0, r.out);
    assert.doesNotMatch(r.out, /configuration keys of an earlier version/);
    assert.ok(!noRecord(r.out), r.out);
  });
  inExample((dir) => {
    patch(dir, "ont.config.json", '"verdicts": { "dir": "verify/runs" }', '"verdicts": { "dir": "verify/runs" },\n  "manualRuns": { "dir": "verify/runs" }');
    const r = check(dir);
    assert.notEqual(r.code, 0, r.out);
    assert.match(r.out, /sets both manualRuns and verdicts/);
    assert.doesNotMatch(r.out, /ONT_OK/);
  });
});

test("[check.manual-run.due-kinds] with require, a check of review, one of run and one still manual without a record all fail", () => {
  inExample(
    (dir) => {
      const r = check(dir);
      assert.equal(r.code, 1, r.out);
      const due = listedUnder(r.out, "ERROR · checks of review or run of implemented concepts with no current record");
      for (const id of [OVERDUE, "check.loan.renew-explained", "check.loan.renew-old"]) assert.ok(due?.includes(id), `${id}\n${r.out}`);
    },
    {
      before: (dir) => {
        patch(dir, "ont.config.json", '"verdicts": { "dir": "verify/runs" }', '"verdicts": { "dir": "verify/runs", "require": true }');
        addCheck(dir, "check.loan.renew-explained", "action.renew", "review");
        addCheck(dir, "check.loan.renew-old", "action.renew", "manual");
      },
    },
  );
});

test("[check.manual-run.stamp-kinds] review keeps the stamp of manual, run has its own; an approach's check of run stamps its proof and its guide", () => {
  const md = readFileSync(join(EXAMPLE, "ontology.md"), "utf8");
  const { ONT, rows, notes } = parseGlossary(md);
  const base = parseChecks(readFileSync(join(EXAMPLE, "checks.md"), "utf8")).find((c) => c.id === OVERDUE);
  const stampAs = (proof) => {
    const c = { ...base, proof };
    return runStamp(c, ONT, rows, new Map([[c.id, c]]), notes);
  };
  assert.equal(stampAs("review"), stampAs("manual"));
  assert.notEqual(stampAs("run"), stampAs("review"));
  assert.notEqual(stampAs("run"), stampAs("manual"));
  // A check of the approach in a project: no row of the project's, so its case and its concepts' IDs.
  const approach = readApproach(readFileSync(join(TOOLS, "approach.json"), "utf8")).checks;
  const outside = (c) => runStamp(c, ONT, rows, new Map(), notes);
  const reviewCheck = approach.find((c) => c.proof === "review");
  const { proof, ...asBefore } = reviewCheck;
  assert.equal(outside(reviewCheck), outside({ ...asBefore, proof: "manual" }), "the stamp of a check of review of the approach is that of its earlier manual");
  const runCheck = approach.find((c) => c.proof === "run");
  assert.ok(runCheck.guide?.hash, JSON.stringify(runCheck));
  assert.notEqual(outside(runCheck), outside({ ...runCheck, proof: "review" }), "the proof is in the stamp of a check of run");
  assert.notEqual(outside(runCheck), outside({ ...runCheck, guide: { ...runCheck.guide, hash: "000000000000" } }), "the guide's hash is in it");
});

test("[check.manual-run.performer] --review --record makes the directory of verdicts, reads both spellings and escaped pipes, writes the performer on a pass or a fail only, refuses a wrong one, and carries records with or without it", () => {
  const table = (rows) => `By: gpt-6.1-sol, OpenAI\n\n| Check | Verdict | Evidence | Performer |\n| - | - | - | - |\n${rows.join("\n")}\n`;
  inExample(
    (dir) => {
      // The first verdicts of the project: its directory of verdicts does not exist yet.
      rmSync(join(dir, "verify/runs"), { recursive: true, force: true });
      const listedNow = check(dir, ["--review", "HEAD"]).out;
      const ids = [...listedNow.matchAll(/^ {2}(check\.\S+) \[/gm)].map((m) => m[1]);
      assert.ok(ids.length >= 4, listedNow);
      const [one, two, three, four, ...rest] = ids;
      const tableFile = join(mkdtempSync(join(tmpdir(), "ont-table-")), "table.md");
      const record = (rows) => {
        writeFileSync(tableFile, table(rows));
        return check(dir, ["--review", "HEAD", "--record", tableFile]);
      };
      const others = rest.map((id) => `| ${id} | pass | x |`);
      const refused = (row, problem) => {
        const r = record([row, `| ${two} | pass | x |`, `| ${three} | pass | x |`, `| ${four} | pass | x |`, ...others]);
        assert.equal(r.code, 1, r.out);
        assert.match(r.out, /the table of verdicts is refused, no record written/, r.out);
        assert.ok(r.out.includes(`  ${problem}\n`), r.out);
        assert.ok(!existsSync(join(dir, "verify/runs")), "a refused table writes nothing");
      };
      refused(`| ${one} | pass | x | robot |`, `${one}: performer robot is not one of code, model, agent, person`);
      refused(`| ${one} | not run | x | person |`, `${one}: a performer is given on a pass or a fail only, not on not-run`);
      refused(`| ${one} | pass | | person |`, `${one}: performer person without the evidence that names the person`);
      const r = record([
        `| ${one} | pass | the log, kept outside |`,
        `| ${two} | fail | [a refusal not explained] the run of a librarian, Ann \\| her notes, kept outside | person |`,
        `| ${three} | not run | no product to run |`,
        `| ${four} | not applicable | no screen |`,
        ...others,
      ]);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, new RegExp(`RECORDED ${ids.length} verdicts, 0 carried`), r.out);
      const files = readdirSync(join(dir, "verify/runs"));
      assert.equal(files.length, ids.length);
      const text = (id) => readFileSync(join(dir, "verify/runs", files.find((f) => f.includes(`-${id}-`))), "utf8");
      assert.match(text(one), /\nVerdict: pass\n[^]*\nPerformer: agent\n/);
      assert.match(text(two), /\nVerdict: fail\n[^]*\nPerformer: person\nEvidence: \[a refusal not explained\] the run of a librarian, Ann \| her notes, kept outside\nClass: a refusal not explained\n/);
      assert.match(text(three), /\nVerdict: not-run\n/);
      assert.match(text(four), /\nVerdict: not-applicable\n/);
      assert.doesNotMatch(text(three), /Performer:/);
      assert.doesNotMatch(text(four), /Performer:/);
      // The records written are read back whole.
      const back = parseRuns(join(dir, "verify/runs"), new Set(ids));
      assert.deepEqual(back.malformed, []);
      assert.equal(back.runs.find((x) => x.check === two).evidence, "[a refusal not explained] the run of a librarian, Ann | her notes, kept outside");
    },
    { after: (dir) => writeFileSync(join(dir, "app/format.mjs"), "// ont: derived.overdue\nexport const pad = (s) => String(s).padStart(2, '0');\n") },
  );
  const c = (id) => ({ id, concepts: ["derived.overdue"], given: "g", when: "w", then: "t", proof: "run" });
  const ids = ["check.a.one", "check.a.two"];
  const stamp = () => "abcd1234";
  const now = new Date("2026-11-22T10:00:00Z");
  // Carried: a record --record wrote with Performer: person, and an earlier one without the line.
  const two = new Map(ids.slice(0, 2).map((id) => [id, c(id)]));
  const runs = [
    { file: "r1.md", check: "check.a.one", stamp: "abcd1234", commit: "abc1234", performer: "person", verdict: "pass" },
    { file: "r2.md", check: "check.a.two", stamp: "abcd1234", commit: "abc1234", verdict: "pass" },
  ];
  const carried = recordVerdicts({
    text: table(["| check.a.one | carried | r1.md · docs/a.md |", "| check.a.two | carried | r2.md · docs/a.md |"]),
    listed: two,
    runs,
    stamp,
    commit: "abc1235",
    now,
    changedSince: () => [],
  });
  assert.deepEqual(carried.problems, []);
  assert.equal(carried.carried, 2);
  // Each carry is a record of its own on the commit of the review, with the carried performer (D-186).
  assert.equal(carried.records.length, 2);
  assert.match(carried.records[0].text, /\nVerdict: pass\n[^]*\nPerformer: person\n[^]*\nCarried: r1\.md\n/);
  assert.match(carried.records[1].text, /\nPerformer: agent\n[^]*\nCarried: r2\.md\n/);
  // A record whose performer is none of the four, one with a performer on a not-run, and one with
  // person and no evidence cannot be read; one without the line is read.
  const dir = mkdtempSync(join(tmpdir(), "ont-performer-"));
  try {
    const rec = (name, extra) =>
      writeFileSync(join(dir, name), `Check: check.a.one\nTime: 2026-11-22T09:00:00Z\nCommit: abc1234\nStamp: abcd1234\nVerdict: pass\nBy: gpt-6.1-sol, OpenAI\n${extra}`);
    rec("20261122T090000Z-check.a.one-aaaa.md", "Performer: robot\n");
    writeFileSync(join(dir, "20261122T090002Z-check.a.one-cccc.md"), "Check: check.a.one\nTime: 2026-11-22T09:00:02Z\nCommit: abc1234\nStamp: abcd1234\nVerdict: not-run\nBy: gpt-6.1-sol, OpenAI\nPerformer: agent\nEvidence: no product\n");
    writeFileSync(join(dir, "20261122T090003Z-check.a.one-dddd.md"), "Check: check.a.one\nTime: 2026-11-22T09:00:03Z\nCommit: abc1234\nStamp: abcd1234\nVerdict: pass\nBy: gpt-6.1-sol, OpenAI\nPerformer: person\n");
    writeFileSync(join(dir, "20261122T090001Z-check.a.one-bbbb.md"), "Check: check.a.one\nTime: 2026-11-22T09:00:01Z\nCommit: abc1234\nStamp: abcd1234\nVerdict: pass\nBy: gpt-6.1-sol, OpenAI\n");
    const { runs: read, malformed } = parseRuns(dir, new Set(["check.a.one"]));
    assert.deepEqual(malformed, [
      "20261122T090000Z-check.a.one-aaaa.md: performer robot is not one of code, model, agent, person",
      "20261122T090002Z-check.a.one-cccc.md: a performer is given on a pass or a fail only, not on not-run",
      "20261122T090003Z-check.a.one-dddd.md: performer person without the evidence that names the person",
    ]);
    assert.deepEqual(read.map((r) => r.file), ["20261122T090001Z-check.a.one-bbbb.md"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("[check.agent-rules.review-path-kinds] reviewPaths pass with a check of review, of run or still manual, and --review lists each", () => {
  inExample(
    (dir) => {
      const r = check(dir);
      assert.doesNotMatch(r.out, /concepts under reviewPaths without/, r.out);
      const rv = check(dir, ["--review", "HEAD"]);
      assert.deepEqual(reviewList(rv.out, "review", "project").sort(), ["check.loan.item-old", "check.loan.renew-explained"], rv.out);
      assert.deepEqual(reviewList(rv.out, "run", "project"), ["check.loan.due-date-run"], rv.out);
    },
    {
      before: (dir) => {
        addCheck(dir, "check.loan.renew-explained", "action.renew", "review");
        addCheck(dir, "check.loan.due-date-run", "field.loan.due-date", "run");
        addCheck(dir, "check.loan.item-old", "edge.loan.item", "manual");
        patch(dir, "verify/overdue.md", "<!-- ont: check.loan.overdue-in-real-time@", "<!-- ont: check.loan.due-date-run, check.loan.overdue-in-real-time@");
        patch(dir, "ont.config.json", '"root": "."', '"root": ".",\n  "reviewPaths": [{ "dir": "data", "concepts": ["action.renew", "field.loan.due-date", "edge.loan.item"] }]');
        mkdirSync(join(dir, "data"), { recursive: true });
        writeFileSync(join(dir, "data/loans.json"), "{}\n");
      },
      after: (dir) => writeFileSync(join(dir, "data/loans.json"), '{ "a": 1 }\n'),
    },
  );
});

test("[check.agent-rules.review-run-listed] a changed guide section lists its check of run, a changed help section anchored to it does not; a changed mockup lists the approach's checks of run of the mockup apart, with their guide", () => {
  inExample(
    (dir) => {
      const r = check(dir, ["--review", "HEAD"]);
      assert.deepEqual(reviewList(r.out, "run", "project"), [OVERDUE], r.out);
      assert.ok(!reviewList(r.out, "review", "project").includes(OVERDUE), r.out);
    },
    { after: (dir) => patch(dir, "verify/overdue.md", "Note the due date", "Write down the due date") },
  );
  // A section of the help, an ordinary doc set, anchored to the same check: its change lists no check of run.
  inExample(
    (dir) => {
      const r = check(dir, ["--review", "HEAD"]);
      assert.match(r.out, /Kinds of artifact: [^\n]*docs/, r.out);
      assert.deepEqual(reviewList(r.out, "run", "project"), [], r.out);
    },
    {
      before: (dir) => appendFileSync(join(dir, "help/borrowing.md"), `\n<!-- ont: ${OVERDUE} -->\n## When a loan is overdue\n\nA loan is overdue the moment its due date passes.\n`),
      after: (dir) => patch(dir, "help/borrowing.md", "the moment its due date passes", "as soon as its due date passes"),
    },
  );
  inExample(
    (dir) => {
      const r = check(dir, ["--review", "HEAD"]);
      const run = reviewList(r.out, "run", "approach");
      assert.deepEqual(run.sort(), ["check.mockup-element.label-is-true", "check.mockup-element.one-plain-mockup"], r.out);
      const review = reviewList(r.out, "review", "approach");
      assert.ok(review.includes("check.mockup-element.fictional-data"), r.out);
      assert.ok(!review.includes("check.mockup-element.label-is-true"), r.out);
      assert.match(r.out, /check\.mockup-element\.label-is-true [^\n]*\n[^\n]*\n {4}\(Mockup element\)\n {4}guide: docs\/run-guide\.md#an-element-does-what-its-label-says/);
    },
    { after: (dir) => patch(dir, "mockup/index.html", "<h2>Desk</h2>", "<h2>Desk </h2>") },
  );
});

// A project with its own copy of the tool, as pin.mjs makes it: the copy's approach.json is the pinned
// catalogue of the approach, and copy.json names the commit it came from.
const withCopy = (fn, { before, after } = {}) =>
  inExample(
    (dir) => fn(dir, join(dir, "tools/oas")),
    {
      before: (dir) => {
        cpSync(TOOLS, join(dir, "tools/oas"), { recursive: true, filter: (src) => !src.startsWith(join(TOOLS, "test")) });
        writeFileSync(join(dir, "tools/oas/copy.json"), JSON.stringify({ commit: "0123456789abcdef0123456789abcdef01234567" }));
        before?.(dir);
      },
      after,
    },
  );

test("[check.agent-rules.review-pin-changed] a changed copy of approach.json lists the approach's check of run whose guide changed, and no other", () => {
  withCopy(
    (dir, copy) => {
      const r = check(dir, ["--review", "HEAD"], copy);
      assert.deepEqual(reviewList(r.out, "run", "approach"), ["check.check.blind-derivation"], r.out);
    },
    {
      after: (dir) => {
        const f = join(dir, "tools/oas/approach.json");
        const a = JSON.parse(readFileSync(f, "utf8"));
        a.checks.find((c) => c.id === "check.check.blind-derivation").guide.hash = "000000000000";
        writeFileSync(f, `${JSON.stringify(a, null, 2)}\n`);
      },
    },
  );
});

test("[check.tool-copy.copy-info] --review links each check of run of the approach to its guide at the commit of copy.json", () => {
  withCopy(
    (dir, copy) => {
      const r = check(dir, ["--review", "HEAD"], copy);
      assert.match(
        r.out,
        /guide: docs\/run-guide\.md#an-element-does-what-its-label-says · https:\/\/github\.com\/epavlenko\/ontology-as-spec\/blob\/0123456789abcdef0123456789abcdef01234567\/docs\/run-guide\.md#an-element-does-what-its-label-says/,
      );
      // In the approach's own repository the guide is the working tree's, with no link.
      const own = spawnSync("node", [join(TOOLS, "ont-check.mjs"), "--config", join(REPO, "ont.config.json"), "--review", "HEAD"], { encoding: "utf8" }).stdout;
      assert.doesNotMatch(own, /github\.com\/epavlenko\/ontology-as-spec\/blob/);
    },
    { after: (dir) => patch(dir, "mockup/index.html", "<h2>Desk</h2>", "<h2>Desk </h2>") },
  );
});

test("[check.agent-rules.approach-catalogue] approach.json carries the checks of review and run with their proof and guides; the generator fails on a missing section; records of them are read", () => {
  const a = readApproach(readFileSync(join(TOOLS, "approach.json"), "utf8"));
  const catalogue = parseChecks(readFileSync(join(REPO, "checks.md"), "utf8"));
  const want = catalogue.filter((c) => c.proof === "review" || c.proof === "run");
  assert.deepEqual(a.checks.map((c) => [c.id, c.proof]).sort(), want.map((c) => [c.id, c.proof]).sort());
  const guide = readFileSync(join(REPO, "docs/run-guide.md"), "utf8");
  const headings = [...guide.matchAll(/^#{2,3}[ \t]+(.+?)[ \t#]*$/gm)].map((m) => headingAnchor(m[1]));
  for (const c of a.checks.filter((x) => x.proof === "run")) {
    assert.equal(c.guide?.path, "docs/run-guide.md", c.id);
    assert.ok(headings.includes(c.guide.anchor), `${c.id}: #${c.guide.anchor}`);
    assert.match(c.guide.hash, /^[0-9a-f]{12}$/);
  }
  for (const c of a.checks.filter((x) => x.proof === "review")) assert.equal(c.guide, undefined, c.id);
  // The generator, on a copy whose guide has lost a section, names the check and fails.
  const dir = mkdtempSync(join(tmpdir(), "ont-gen-approach-"));
  try {
    for (const f of ["ontology.md", "checks.md", "docs/run-guide.md"]) {
      mkdirSync(join(dir, f, ".."), { recursive: true });
      cpSync(join(REPO, f), join(dir, f));
    }
    const cut = readFileSync(join(dir, "docs/run-guide.md"), "utf8").replace(/<!-- ont: check\.check\.blind-derivation[^>]*-->/, "<!-- ont: -->");
    writeFileSync(join(dir, "docs/run-guide.md"), cut);
    const cfg = JSON.parse(readFileSync(join(REPO, "ont.config.json"), "utf8"));
    writeFileSync(
      join(dir, "ont.config.json"),
      JSON.stringify({ classes: cfg.classes, scoped: cfg.scoped, ontology: "ontology.md", checks: { file: "checks.md" }, approachIds: { out: "approach.json" }, docSets: [{ name: "run", files: ["docs/run-guide.md"], checks: ["run"], scope: "all" }] }),
    );
    const r = spawnSync("node", [join(TOOLS, "gen-approach.mjs"), "--config", join(dir, "ont.config.json")], { encoding: "utf8" });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /check\.check\.blind-derivation: no section of a run guide names it/);
    assert.ok(!existsSync(join(dir, "approach.json")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  // A project's record of a check of run of the approach is read, not refused as unknown.
  inExample((dir) => {
    mkdirSync(join(dir, "verify/runs"), { recursive: true });
    const commit = git(dir, "rev-parse", "--short", "HEAD").stdout.trim();
    writeFileSync(
      join(dir, "verify/runs/20261122T090000Z-check.mockup-element.label-is-true-a1b2.md"),
      `Check: check.mockup-element.label-is-true\nTime: 2026-11-22T09:00:00Z\nCommit: ${commit}\nStamp: abcd1234\nVerdict: pass\nBy: gpt-6.1-sol, OpenAI\nPerformer: agent\n`,
    );
    const r = check(dir);
    assert.equal(r.code, 0, r.out);
    assert.doesNotMatch(r.out, /verdict records that cannot be read/);
  });
});

test("[check.doc-set.old-manual-guide] a doc set that lists checks manual asks for the checks of run and those still manual, and says to write run", () => {
  inExample(
    (dir) => {
      const r = check(dir);
      assert.equal(r.code, 1, r.out);
      assert.deepEqual(listedUnder(r.out, "ERROR · run and manual checks the verify docs do not explain how to run")?.sort(), ["check.loan.overdue-in-real-time", "check.loan.renew-old"], r.out);
      assert.match(r.out, /info · verify docs list the checks of the earlier proof manual, read as run and manual \(write \["run"\]\) \(1\):\n {2}verify\n/);
    },
    {
      before: (dir) => {
        patch(dir, "ont.config.json", '"checks": [\n        "run"\n      ]', '"checks": [\n        "manual"\n      ]');
        addCheck(dir, "check.loan.renew-old", "action.renew", "manual");
        patch(dir, "verify/overdue.md", "<!-- ont: check.loan.overdue-in-real-time@", "<!-- ont: derived.overdue@");
      },
    },
  );
});

test("[check.doc-set.approach-run-guide] the run guides have a section for each check of run, with the step of the fresh reader where the case needs one", () => {
  const sections = (file) => {
    const text = readFileSync(join(REPO, file), "utf8");
    const anchors = parseAnchors(text);
    return new Map(anchors.flatMap((a, i) => a.refs.map((r) => [r.id, text.slice(a.index, anchors[i + 1]?.index)])));
  };
  const approach = sections("docs/run-guide.md");
  for (const c of parseChecks(readFileSync(join(REPO, "checks.md"), "utf8")).filter((x) => x.proof === "run")) assert.ok(approach.has(c.id), c.id);
  const fresh = (s) => /\*\*Fresh reader\.\*\* Give a fresh reader, a model without context, /.test(s);
  assert.ok(fresh(approach.get("check.check.blind-derivation")));
  assert.ok(fresh(approach.get("check.doc-section.guide-runs-check")));
  assert.ok(fresh(sections("example/verify/refusal.md").get("check.screens.refusal-understandable")));
  assert.ok(fresh(sections("templates/verify/close.md").get("check.thing.close-is-clear")));
  assert.ok(!fresh(approach.get("check.product-release.verified-by-reviewer")), "a release is verified by its command, with no reader");
});

// The order of an update (rule.tool-before-files): the tool before the proofs review and run, at the
// commit this change started from, and the tool after.
const BEFORE = "b2394bdb3667469a5416a7ee75ea0b92b08090c3";
test("[check.tool-copy.tool-before-files] the earlier tool reads the earlier files only; the new tool reads both, naming what to move", (t) => {
  if (git(REPO, "cat-file", "-e", `${BEFORE}^{commit}`).status !== 0) {
    t.skip(`this clone does not have ${BEFORE}, the commit of the earlier tool`);
    return;
  }
  const root = mkdtempSync(join(tmpdir(), "ont-before-files-"));
  try {
    // The earlier tool and the earlier example, from that commit; the moved example from the working tree.
    const archive = (path, to) => {
      mkdirSync(to, { recursive: true });
      const tar = spawnSync("git", ["-C", REPO, "archive", BEFORE, path], { env: ENV, maxBuffer: 1 << 28 });
      assert.equal(tar.status, 0, String(tar.stderr));
      assert.equal(spawnSync("tar", ["-x", "-C", to], { input: tar.stdout }).status, 0);
    };
    archive("tools/ont-check", join(root, "old"));
    archive("example", join(root, "earlier"));
    cpSync(EXAMPLE, join(root, "moved", "example"), { recursive: true });
    for (const d of ["earlier", "moved"]) {
      rmSync(join(root, d, "example", "releases"), { recursive: true, force: true });
      git(join(root, d), "init", "-q", "-b", "main");
      git(join(root, d), "add", "-A");
      git(join(root, d), "commit", "-q", "-m", "base");
    }
    const run = (tool, d) => check(join(root, d, "example"), [], tool);
    const oldTool = join(root, "old", "tools/ont-check");
    const earlier = readFileSync(join(root, "earlier", "example", "checks.md"), "utf8");
    assert.match(earlier, /\| manual +\|/, "the earlier example keeps the proof manual");
    const a = run(oldTool, "earlier");
    assert.equal(a.code, 0, a.out);
    const b = run(TOOLS, "earlier");
    assert.equal(b.code, 0, b.out);
    assert.match(b.out, /checks whose proof is the earlier manual, read as before/);
    assert.match(b.out, /manualRuns: write verdicts/);
    assert.match(b.out, /list the checks of the earlier proof manual, read as run and manual/);
    const c = run(TOOLS, "moved");
    assert.equal(c.code, 0, c.out);
    assert.doesNotMatch(c.out, /earlier (manual|version)/);
    const d = run(oldTool, "moved");
    assert.notEqual(d.code, 0, d.out);
    assert.match(d.out, /malformed checks[^\n]*\n {2}check\.loan\.overdue-in-real-time/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
