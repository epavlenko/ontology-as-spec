import assert from "node:assert/strict";
import { test } from "node:test";
import { checkout, emptyState, memberView, placeHold, Refusal, renew, returnItem } from "./library.mjs";

const library = () => {
  const s = emptyState();
  s.members = { ana: {}, ben: { borrowLimit: 1 } };
  s.titles = { dune: { name: "Dune" } };
  s.items = { "dune-1": { title: "dune" }, "dune-2": { title: "dune" } };
  return s;
};

test("a loan is due 21 days after checkout", () => {
  const loan = checkout(library(), { item: "dune-1", member: "ana", today: "2026-10-01" });
  assert.equal(loan.due, "2026-10-22");
});

test("an item cannot be on two loans", () => {
  const s = library();
  checkout(s, { item: "dune-1", member: "ana", today: "2026-10-01" });
  assert.throws(() => checkout(s, { item: "dune-1", member: "ben", today: "2026-10-01" }), Refusal);
});

test("a member cannot exceed the borrow limit", () => {
  const s = library();
  checkout(s, { item: "dune-1", member: "ben", today: "2026-10-01" });
  assert.throws(() => checkout(s, { item: "dune-2", member: "ben", today: "2026-10-01" }), /1 of 1/);
});

test("renewal adds 14 days, at most twice", () => {
  const s = library();
  checkout(s, { item: "dune-1", member: "ana", today: "2026-10-01" });
  assert.equal(renew(s, { item: "dune-1", today: "2026-10-20" }).due, "2026-11-05");
  assert.equal(renew(s, { item: "dune-1", today: "2026-11-01" }).due, "2026-11-19");
  assert.throws(() => renew(s, { item: "dune-1", today: "2026-11-10" }), /renewed 2 times/);
});

test("renewal is refused while someone waits for the title", () => {
  const s = library();
  checkout(s, { item: "dune-1", member: "ana", today: "2026-10-01" });
  checkout(s, { item: "dune-2", member: "ben", today: "2026-10-01" });
  placeHold(s, { title: "dune", member: "ana", today: "2026-10-02" });
  assert.throws(() => renew(s, { item: "dune-2", today: "2026-10-10" }), /1 member\(s\) waiting/);
});

test("a hold is refused while an item is available", () => {
  assert.throws(
    () => placeHold(library(), { title: "dune", member: "ana", today: "2026-10-01" }),
    /available/,
  );
});

test("the member view marks overdue loans", () => {
  const s = library();
  checkout(s, { item: "dune-1", member: "ana", today: "2026-10-01" });
  assert.deepEqual(memberView(s, "ana", "2026-10-23").loans[0].overdue, true);
  returnItem(s, { item: "dune-1", today: "2026-10-23" });
  assert.deepEqual(memberView(s, "ana", "2026-10-23").loans, []);
});
