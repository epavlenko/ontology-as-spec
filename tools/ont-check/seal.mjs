// The seal of a record of the process (D-167): the first line of every record a writer of the tool
// writes, "Seal: v1 <sha256>", the SHA-256 of the rest of the file after a fixed prefix of its format.
// The seal does not depend on the version of the tool, only on the version of its format, so that the
// guard of main and a writer on a branch compute it alike while the format is the same; a later format is
// v2, and v1 is still read. It shows that a record was written by a writer and not edited since; it does
// not stop a deliberate forgery, since the prefix is public (the owner's answer 1036 a, docs/limitations.md).
// ont: ent.process-record, field.process-record.seal, inv.record-sealed, rule.records-by-tool, edge.process-record.guard
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gitEnv } from "./lib.mjs";

// The prefix of each format of the seal, by its version: a new format is added here, never changed.
export const SEAL_FORMATS = { v1: "ont-check seal v1" };
export const SEAL_LINE = /^Seal: (v\d+) ([0-9a-f]{64})$/;
const hash = (text) => createHash("sha256").update(text).digest("hex");
// The seal of a body in a format: the hash of the prefix, a line feed and the body.
export const sealOf = (body, version = "v1") => hash(`${SEAL_FORMATS[version]}\n${body}`);
// The text of a record with its seal on its first line.
export const sealed = (body) => `Seal: v1 ${sealOf(body)}\n${body}`;
// The state of a record's seal: valid, missing (no line Seal: at all) or wrong (a line Seal: that is not
// the first, a format the tool does not know, or a hash that is not the body's), with why.
export function sealState(text) {
  const nl = text.indexOf("\n");
  const first = nl < 0 ? text : text.slice(0, nl);
  const body = nl < 0 ? "" : text.slice(nl + 1);
  const m = first.match(SEAL_LINE);
  const other = (m ? body : text).split("\n").some((l) => /^Seal:/.test(l));
  if (!m) return other ? { state: "wrong", why: "its line Seal: is not the first line" } : { state: "missing", why: "it has no line Seal:" };
  if (other) return { state: "wrong", why: "it has more than one line Seal:" };
  if (!Object.hasOwn(SEAL_FORMATS, m[1])) return { state: "wrong", why: `its seal is of format ${m[1]}, which the tool does not know` };
  return sealOf(body, m[1]) === m[2] ? { state: "valid" } : { state: "wrong", why: "its seal is not the hash of its text: it was edited after it was written, or written by hand" };
}

// The time now, in UTC to the second, after the given times: a writer waits until the second has passed the
// time of the records its record must follow, a round its record of done, a gate change the earlier one of
// its item, so that "later" is never a tie of one second (D-167).
export function timeAfter(...times) {
  const last = times.filter(Boolean).sort().at(-1) ?? "";
  const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const cell = new Int32Array(new SharedArrayBuffer(4));
  while (now() <= last) Atomics.wait(cell, 0, 0, 50);
  return now();
}

// The time a record says it was written, its line Time:, or null.
export const recordTime = (text) => text.match(/^Time:[ \t]*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\s*$/m)?.[1] ?? null;

// Writes a sealed record into dir, never over another: the name is name(i) for the first free i from 1.
export function writeSealed(dir, name, body) {
  mkdirSync(dir, { recursive: true });
  for (let i = 1; i < 100; i++) {
    const file = name(i);
    try {
      writeFileSync(join(dir, file), sealed(body), { flag: "wx" });
      return file;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
  }
  throw new Error(`no free name for the record in ${dir}`);
}

// Where seals start (D-167): only when the configuration at commit, the base of a pull request, sets
// records.sealsFrom to true, at the committer time of the commit of its first-parent history that brought
// the key in, the merge into main; null when the key is not set there. A record whose Time: is after it
// needs a valid seal; one before it, in the base or on the branch of the task, reads as before.
export function sealsStart(top, commit, configPath = "ont.config.json") {
  const git = (...a) => spawnSync("git", ["-C", top, ...a], { encoding: "utf8", env: gitEnv(), maxBuffer: 1 << 26 });
  const keyAt = (c) => {
    const r = git("show", `${c}:${configPath}`);
    if (r.status !== 0) return false;
    try {
      return JSON.parse(r.stdout)?.records?.sealsFrom === true;
    } catch {
      return false;
    }
  };
  if (!keyAt(commit)) return null;
  const log = git("log", "--first-parent", "--format=%H %cI", commit, "--", configPath);
  if (log.status !== 0) return null;
  // From the newest back, the oldest commit of the history whose configuration still sets the key.
  let start = null;
  for (const line of log.stdout.split("\n").filter(Boolean)) {
    const [c, time] = line.split(" ");
    if (!keyAt(c)) break;
    start = new Date(time).toISOString().replace(/\.\d{3}Z$/, "Z");
  }
  return start;
}
