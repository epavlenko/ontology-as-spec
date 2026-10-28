// Command line front end of the lending library. State lives in a JSON file.
// Usage: node app/cli.mjs <command> [args] [--today YYYY-MM-DD]
//   seed                      reset the state to the sample collection
//   checkout <item> <member>  return <item>   renew <item>
//   hold <title> <member>     loans <member>
// The state file is $LIBRARY_STATE, or lending-library.json in the system temp directory.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkout,
  emptyState,
  memberView,
  placeHold,
  Refusal,
  renew,
  returnItem,
} from "./library.mjs";

const FILE = process.env.LIBRARY_STATE || join(tmpdir(), "lending-library.json");
const args = process.argv.slice(2);
const t = args.indexOf("--today");
const today = t >= 0 ? args.splice(t, 2)[1] : new Date().toISOString().slice(0, 10);
const [command, a, b] = args;

const seed = () => {
  const s = emptyState();
  s.members = { ana: { name: "Ana" }, ben: { name: "Ben" }, carl: { name: "Carl" } };
  s.titles = { dune: { name: "Dune" }, drill: { name: "Cordless drill" } };
  s.items = { "dune-1": { title: "dune" }, "dune-2": { title: "dune" }, "drill-1": { title: "drill" } };
  return s;
};
// A state file that is not the library's state stops every command before it changes anything. The
// state is the library's when its collections have the right shape, every loan and hold names an item,
// a title and a member it holds, and its dates are days.
const isObject = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const has = (o, k) => typeof k === "string" && Object.hasOwn(o, k) && isObject(o[k]);
const isDay = (x) => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x));
const isLibrary = (s) =>
  isObject(s) &&
  [s.members, s.titles, s.items].every(isObject) &&
  Object.values(s.members).every((m) => isObject(m) && (m.borrowLimit === undefined || Number.isInteger(m.borrowLimit))) &&
  Object.values(s.titles).every((t) => isObject(t) && typeof t.name === "string") &&
  Object.values(s.items).every((i) => isObject(i) && has(s.titles, i.title)) &&
  Array.isArray(s.loans) &&
  s.loans.every(
    (l) =>
      isObject(l) && has(s.items, l.item) && has(s.members, l.member) && isDay(l.due) && Number.isInteger(l.renewals) && (l.returned === null || isDay(l.returned)),
  ) &&
  Array.isArray(s.holds) &&
  s.holds.every((h) => isObject(h) && has(s.titles, h.title) && has(s.members, h.member) && isDay(h.placed));
const load = () => {
  if (!existsSync(FILE)) return seed();
  try {
    const s = JSON.parse(readFileSync(FILE, "utf8"));
    if (isLibrary(s)) return s;
  } catch {}
  console.error(`error: the state in ${FILE} cannot be read; nothing was changed`);
  process.exit(3);
};
const save = (s) => writeFileSync(FILE, JSON.stringify(s, null, 1));

const state = command === "seed" ? seed() : load();
try {
  switch (command) {
    case "seed":
      console.log("seeded: members ana, ben, carl; items dune-1, dune-2, drill-1");
      break;
    // ont: action.checkout
    case "checkout": {
      const loan = checkout(state, { item: a, member: b, today });
      console.log(`checked out ${a} to ${b}, due ${loan.due}`);
      break;
    }
    // ont: action.return
    case "return":
      returnItem(state, { item: a, today });
      console.log(`returned ${a}`);
      break;
    // ont: action.renew
    case "renew": {
      const loan = renew(state, { item: a, today });
      console.log(`renewed ${a}, due ${loan.due}, renewals ${loan.renewals}`);
      break;
    }
    // ont: action.place-hold
    case "hold": {
      const hold = placeHold(state, { title: a, member: b, today });
      console.log(`hold ${hold.id} on ${a} for ${b}`);
      break;
    }
    // ont: view.member.loans
    case "loans": {
      const v = memberView(state, a, today);
      for (const l of v.loans)
        console.log(`loan  ${l.item}  ${l.title}  due ${l.due}${l.overdue ? "  OVERDUE" : ""}`);
      for (const h of v.holds) console.log(`hold  ${h.title}  position ${h.position}`);
      if (!v.loans.length && !v.holds.length) console.log("nothing on loan, no holds");
      break;
    }
    default:
      console.error("commands: seed, checkout, return, renew, hold, loans");
      process.exit(2);
  }
  save(state);
} catch (e) {
  if (!(e instanceof Refusal)) throw e;
  console.log(`refused: ${e.message}`);
  process.exit(1);
}
