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
  s.members = { ana: { name: "Ana" }, ben: { name: "Ben" } };
  s.titles = { dune: { name: "Dune" }, drill: { name: "Cordless drill" } };
  s.items = { "dune-1": { title: "dune" }, "dune-2": { title: "dune" }, "drill-1": { title: "drill" } };
  return s;
};
const load = () => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : seed());
const save = (s) => writeFileSync(FILE, JSON.stringify(s, null, 1));

const state = command === "seed" ? seed() : load();
try {
  switch (command) {
    case "seed":
      console.log("seeded: members ana, ben; items dune-1, dune-2, drill-1");
      break;
    case "checkout": {
      const loan = checkout(state, { item: a, member: b, today });
      console.log(`checked out ${a} to ${b}, due ${loan.due}`);
      break;
    }
    case "return":
      returnItem(state, { item: a, today });
      console.log(`returned ${a}`);
      break;
    case "renew": {
      const loan = renew(state, { item: a, today });
      console.log(`renewed ${a}, due ${loan.due}, renewals ${loan.renewals}`);
      break;
    }
    case "hold": {
      const hold = placeHold(state, { title: a, member: b, today });
      console.log(`hold ${hold.id} on ${a} for ${b}`);
      break;
    }
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
