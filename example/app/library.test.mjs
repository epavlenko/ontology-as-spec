import assert from "node:assert/strict";
import { test } from "node:test";
// Each title starts with the concept IDs it proves. The drift check reads the tags: every implemented
// invariant, rule and derived value needs a test, and a test may only prove an implemented concept.
import { checkout, emptyState, memberView, placeHold, Refusal, renew, returnItem } from "./library.mjs";

const library = () => {
  const s = emptyState();
  s.members = { ana: {}, ben: { borrowLimit: 1 } };
  s.titles = { dune: { name: "Dune" } };
  s.items = { "dune-1": { title: "dune" }, "dune-2": { title: "dune" } };
  return s;
};

test("[rule.loan-period, field.loan.due-date] a loan is due 21 days after checkout", () => {
  const loan = checkout(library(), { item: "dune-1", member: "ana", today: "2026-10-01" });
  assert.equal(loan.due, "2026-10-22");
});

test("[inv.one-loan-per-item] an item cannot be on two loans", () => {
  const s = library();
  checkout(s, { item: "dune-1", member: "ana", today: "2026-10-01" });
  assert.throws(() => checkout(s, { item: "dune-1", member: "ben", today: "2026-10-01" }), Refusal);
});

test("[inv.within-limit, field.member.borrow-limit] a member cannot exceed the borrow limit", () => {
  const s = library();
  checkout(s, { item: "dune-1", member: "ben", today: "2026-10-01" });
  assert.throws(() => checkout(s, { item: "dune-2", member: "ben", today: "2026-10-01" }), /1 of 1/);
});

test("[rule.renewal, field.loan.renewals] renewal adds 14 days, at most twice", () => {
  const s = library();
  checkout(s, { item: "dune-1", member: "ana", today: "2026-10-01" });
  assert.equal(renew(s, { item: "dune-1", today: "2026-10-20" }).due, "2026-11-05");
  assert.equal(renew(s, { item: "dune-1", today: "2026-11-01" }).due, "2026-11-19");
  assert.throws(() => renew(s, { item: "dune-1", today: "2026-11-10" }), /renewed 2 times/);
});

test("[inv.no-renew-when-held] renewal is refused while someone waits for the title", () => {
  const s = library();
  checkout(s, { item: "dune-1", member: "ana", today: "2026-10-01" });
  checkout(s, { item: "dune-2", member: "ben", today: "2026-10-01" });
  placeHold(s, { title: "dune", member: "ana", today: "2026-10-02" });
  assert.throws(() => renew(s, { item: "dune-2", today: "2026-10-10" }), /1 member\(s\) waiting/);
});

test("[action.place-hold] a hold is refused while an item is available", () => {
  assert.throws(
    () => placeHold(library(), { title: "dune", member: "ana", today: "2026-10-01" }),
    /available/,
  );
});

test("[derived.overdue, view.member.loans] the member view marks overdue loans", () => {
  const s = library();
  checkout(s, { item: "dune-1", member: "ana", today: "2026-10-01" });
  assert.deepEqual(memberView(s, "ana", "2026-10-23").loans[0].overdue, true);
  returnItem(s, { item: "dune-1", today: "2026-10-23" });
  assert.deepEqual(memberView(s, "ana", "2026-10-23").loans, []);
});
