// The boundary of the reads of the checker the guard runs (derived.change-list, D-188, D-189). Imported
// first by ont-check.mjs: given --confine <root>, every read of a file in the run, of any reader of the
// checker and whatever named the path, the configuration, a listing of a directory, a row of the
// implementation table, a ticket or a link, goes through one function, readBoundary, which takes the real
// path and ends the run on one outside the checked tree, naming it, before anything is read. The checker's
// own files beside this module, the approach's IDs, the copy information, the pin and the table of HTML
// entities, are the only others it reads. A read is refused by ending the process, so that no reader that
// catches an error goes on without the file.
// ont: derived.change-list
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
// The files of the checker itself it reads by their own constants, never by a path of the tree.
export const OWN_FILES = ["approach.json", "copy.json", "upstream.json", "html-entities.json"].map((f) => join(HERE, f));
// The code exit of a run that tried to read outside its tree, and the line that names the path.
export const OUTSIDE_EXIT = 3;
export const OUTSIDE_LINE = "READ_OUTSIDE";

// The functions of node:fs as they were before the boundary, which it calls itself.
const orig = { realpathSync: fs.realpathSync, lstatSync: fs.lstatSync, readlinkSync: fs.readlinkSync, writeSync: fs.writeSync };

// The real path of p: its links resolved, a link that resolves to nothing by its target, and a path that does
// not exist by the real path of the nearest part of it that does, with the rest joined.
export function realPath(p, depth = 0) {
  const abs = resolve(p);
  try {
    return orig.realpathSync(abs);
  } catch {}
  try {
    if (depth < 40 && orig.lstatSync(abs).isSymbolicLink()) return realPath(resolve(dirname(abs), orig.readlinkSync(abs)), depth + 1);
  } catch {}
  const parent = dirname(abs);
  return parent === abs ? abs : join(realPath(parent, depth), basename(abs));
}

// The test of the boundary: for a root, a function that gives the real path of a path outside it, or null for
// one inside it.
export function outsideOf(root) {
  const base = realPath(root);
  return (p) => {
    const real = realPath(p);
    const rel = relative(base, real);
    return rel === ".." || rel.startsWith(`..${sep}`) || rel.startsWith(sep) || /^[A-Za-z]:/.test(rel) ? real : null;
  };
}

// The path a function of node:fs was given: a string, a Buffer or a file URL; a descriptor is null, since it
// was opened through the boundary.
const pathOf = (p) => (typeof p === "string" ? p : Buffer.isBuffer(p) ? p.toString() : p instanceof URL ? fileURLToPath(p) : null);

// The one function every read goes through once the boundary is set.
let boundary = null;
export function readBoundary(p) {
  if (!boundary) return;
  const path = pathOf(p);
  if (path === null) return;
  const real = boundary.outside(path);
  if (!real || boundary.own.has(real)) return;
  orig.writeSync(2, `${OUTSIDE_LINE} ${real}${real !== resolve(path) ? ` (named as ${path})` : ""}: the checker reads only the files of its tree, ${boundary.root}\n`);
  process.exit(OUTSIDE_EXIT);
}

// The functions of node:fs that read a file, list a directory or tell of a path, sync, with a callback and
// with a promise, whose first argument is the path; for a copy, the source too.
const READERS = ["access", "accessSync", "exists", "existsSync", "lstat", "lstatSync", "open", "openSync", "opendir", "opendirSync", "readdir", "readdirSync", "readFile", "readFileSync", "readlink", "readlinkSync", "realpath", "realpathSync", "stat", "statSync", "statfs", "statfsSync", "createReadStream", "watch", "watchFile", "cp", "cpSync", "copyFile", "copyFileSync", "glob", "globSync"];
const PROMISE_READERS = ["access", "lstat", "open", "opendir", "readdir", "readFile", "readlink", "realpath", "stat", "statfs", "cp", "copyFile", "glob"];

// Sets the boundary at root for the rest of the run.
export function confineReads(root) {
  boundary = { root: realPath(root), outside: outsideOf(root), own: new Set(OWN_FILES.map((f) => realPath(f))) };
  const wrap = (f) => {
    const g = function (p, ...rest) {
      readBoundary(p);
      return f.call(this, p, ...rest);
    };
    for (const k of Object.keys(f)) g[k] = typeof f[k] === "function" ? wrap(f[k]) : f[k];
    return g;
  };
  for (const k of READERS) if (typeof fs[k] === "function") fs[k] = wrap(fs[k]);
  for (const k of PROMISE_READERS) if (typeof fs.promises[k] === "function") fs.promises[k] = wrap(fs.promises[k]);
  syncBuiltinESMExports();
}

// Given --confine <root>, the boundary is set as this module is evaluated, before any other module of the
// checker is.
const at = process.argv.indexOf("--confine");
if (at > 0) {
  const root = process.argv[at + 1];
  if (!root || root.startsWith("--") || !fs.existsSync(root)) {
    orig.writeSync(2, "--confine needs the root of the checked tree, a directory\n");
    process.exit(2);
  }
  confineReads(root);
}
