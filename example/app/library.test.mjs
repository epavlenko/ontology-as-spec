import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
// Each title starts with the IDs of the checks it implements, from checks.md. The drift check reads
// the tags: every automatic check of implemented concepts needs a test, and this unit suite must cover
// every implemented invariant, rule and derived value.
import {
  checkout,
  DEFAULT_LIMIT,
  emptyState,
  MAX_RENEWALS,
  memberView,
  placeHold,
  Refusal,
  renew,
  returnItem,
} from "./library.mjs";

const library = () => {
  const s = emptyState();
  s.members = { ana: {}, ben: { borrowLimit: 1 } };
  s.titles = { dune: { name: "Dune" } };
  s.items = { "dune-1": { title: "dune" }, "dune-2": { title: "dune" } };
  return s;
};

test("[check.loan.due-in-21-days] a loan is due 21 days after checkout", () => {
  const loan = checkout(library(), { item: "dune-1", member: "ana", today: "2026-10-01" });
  assert.equal(loan.due, "2026-10-22");
});

test("[check.item.one-open-loan] an item cannot be on two loans", () => {
  const s = library();
  checkout(s, { item: "dune-1", member: "ana", today: "2026-10-01" });
  assert.throws(() => checkout(s, { item: "dune-1", member: "ben", today: "2026-10-01" }), Refusal);
});

test("[check.member.borrow-limit] a member cannot exceed the borrow limit", () => {
  const s = library();
  checkout(s, { item: "dune-1", member: "ben", today: "2026-10-01" });
  assert.throws(() => checkout(s, { item: "dune-2", member: "ben", today: "2026-10-01" }), /1 of 1/);
});

test("[check.loan.renew-twice] renewal adds 14 days, at most twice", () => {
  const s = library();
  checkout(s, { item: "dune-1", member: "ana", today: "2026-10-01" });
  assert.equal(renew(s, { item: "dune-1", today: "2026-10-20" }).due, "2026-11-05");
  assert.equal(renew(s, { item: "dune-1", today: "2026-11-01" }).due, "2026-11-19");
  assert.throws(() => renew(s, { item: "dune-1", today: "2026-11-10" }), /renewed 2 times/);
});

test("[check.loan.renew-while-held] renewal is refused while someone waits for the title", () => {
  const s = library();
  checkout(s, { item: "dune-1", member: "ana", today: "2026-10-01" });
  checkout(s, { item: "dune-2", member: "ben", today: "2026-10-01" });
  placeHold(s, { title: "dune", member: "ana", today: "2026-10-02" });
  assert.throws(() => renew(s, { item: "dune-2", today: "2026-10-10" }), /1 member\(s\) waiting/);
});

test("[check.hold.only-when-all-out] a hold is refused while an item is available, placed once all are out", () => {
  const s = library();
  s.members.carl = {};
  assert.throws(() => placeHold(s, { title: "dune", member: "ana", today: "2026-10-01" }), /available/);
  checkout(s, { item: "dune-1", member: "ana", today: "2026-10-01" });
  checkout(s, { item: "dune-2", member: "carl", today: "2026-10-01" });
  assert.equal(placeHold(s, { title: "dune", member: "ana", today: "2026-10-01" }).title, "dune");
});

test("[check.loan.overdue-after-due, check.loan.return-closes-loan] the member view marks overdue loans", () => {
  const s = library();
  checkout(s, { item: "dune-1", member: "ana", today: "2026-10-01" });
  assert.equal(memberView(s, "ana", "2026-10-22").loans[0].overdue, false);
  assert.equal(memberView(s, "ana", "2026-10-23").loans[0].overdue, true);
  returnItem(s, { item: "dune-1", today: "2026-10-23" });
  assert.deepEqual(memberView(s, "ana", "2026-10-23").loans, []);
});

test("[check.hold.position-shown] holds are numbered in placement order", () => {
  const s = library();
  s.members = { ana: {}, ben: {}, carl: {} };
  checkout(s, { item: "dune-1", member: "ben", today: "2026-10-01" });
  checkout(s, { item: "dune-2", member: "ben", today: "2026-10-01" });
  placeHold(s, { title: "dune", member: "ana", today: "2026-10-02" });
  placeHold(s, { title: "dune", member: "carl", today: "2026-10-03" });
  assert.equal(memberView(s, "ana", "2026-10-03").holds[0].position, 1);
  assert.equal(memberView(s, "carl", "2026-10-03").holds[0].position, 2);
});

// The contract is generated from the ontology (contracts/ontology.schema.json). How code follows it is
// this project's choice; here a test compares the code's limits with the contract's.
const contract = JSON.parse(readFileSync(new URL("../contracts/ontology.schema.json", import.meta.url)));

test("[field.loan.renewals, field.member.borrow-limit] the code's limits fit the contract", () => {
  const { loan, member } = contract.$defs;
  assert.equal(MAX_RENEWALS, loan.properties.renewals.maximum);
  assert.ok(DEFAULT_LIMIT >= member.properties.borrowLimit.minimum);
});
