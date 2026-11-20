// The adapter between the example's code and the approach's oracle (rule.trace-runs-on-code, D-101):
// how each implemented action is called in the code, how a refusal of the code reads in the ontology's
// terms, and the code's state as records of the ontology, so that a trace runs on the code as it runs on
// the oracle. It translates and hides nothing: what the code does not keep is left empty.
// ont: action.checkout, action.return, action.renew, action.place-hold
import * as library from "./library.mjs";

export const actions = {
  "action.checkout": (s, a, actor, today) => library.checkout(s, { item: a.item, member: a.member, today }),
  "action.return": (s, a, actor, today) => library.returnItem(s, { item: a.item, today }),
  "action.renew": (s, a, actor, today) => library.renew(s, { item: a.item, today }),
  "action.place-hold": (s, a, actor, today) => library.placeHold(s, { title: a.title, member: a.member, today }),
};

export const init = () => library.emptyState();

export function put(s, ent, id, fields) {
  if (ent === "member") s.members[id] = { borrowLimit: fields["borrow-limit"] ?? undefined };
  else if (ent === "title") s.titles[id] = { name: id };
  else if (ent === "item") s.items[id] = { title: fields["copy-of"] };
  else throw new Error(`the code keeps no ${ent} given from outside`);
}

// A refusal of the code, as the ontology names it: which row refused, and its kind. The code says why in
// words a person reads at the desk; each reason is the refusal of one row.
const REASONS = [
  [/^No (item|member|title) /, "empty", null],
  [/already has \d+ of \d+ loans/, "refused", "inv.within-limit"],
  [/is already on loan/, "refused", "inv.one-loan-per-item"],
  [/is not on loan/, "empty", null],
  [/^Already renewed \d+ times/, "refused", "rule.renewal"],
  [/waiting for this title/, "refused", "inv.no-renew-when-held"],
  [/^An item of .* is available/, "refused", "action.place-hold"],
];
export function refusal(e) {
  if (!(e instanceof library.Refusal)) return null;
  const [, kind, by] = REASONS.find(([re]) => re.test(e.message)) ?? [null, "refused", null];
  return { kind, by, message: e.message };
}

// The code's state as the ontology's records. Holds the code has not closed wait; the code serves none.
export function project(s) {
  return {
    members: Object.entries(s.members).map(([id, m]) => ({ id, "borrow-limit": m.borrowLimit ?? library.DEFAULT_LIMIT })),
    titles: Object.keys(s.titles).map((id) => ({ id })),
    items: Object.entries(s.items).map(([id, it]) => ({ id, "copy-of": it.title, condition: null })),
    loans: s.loans.map((l) => ({ id: l.id, item: l.item, member: l.member, "due-date": l.due, renewals: l.renewals, "returned-on": l.returned, reminded: null })),
    // The code orders a queue by the day a hold was placed and then by when it was placed that day, its
    // place in the list; the time keeps that order, as the oracle's does.
    holds: s.holds.map((h, i) => ({ id: h.id, member: h.member, "waits-for": h.title, state: h.closed ? "served" : "waiting", "placed-at": `${h.placed}T00:00:00.${String(i + 1).padStart(6, "0")}Z`, "reserved-on": null, "reserved-item": null })),
  };
}
