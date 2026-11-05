// Lending library domain: pure functions over a plain state object. Dates are ISO days (YYYY-MM-DD).
// A refused action throws Refusal with the reason a person reads at the desk.

// ont: rule.loan-period, rule.renewal, field.member.borrow-limit
export const LOAN_DAYS = 21;
export const RENEW_DAYS = 14;
export const MAX_RENEWALS = 2;
export const DEFAULT_LIMIT = 5;
const FINE_CENTS_PER_DAY = 10;

export class Refusal extends Error {}

const DAY = 86_400_000;
export const addDays = (iso, n) => new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);
const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

// ont: ent.member, ent.title, ent.item, edge.item.copy-of, ent.loan, ent.hold
export const emptyState = () => ({ members: {}, titles: {}, items: {}, loans: [], holds: [] });

const openLoans = (state) => state.loans.filter((l) => !l.returned);
const openLoanOf = (state, item) => openLoans(state).find((l) => l.item === item);
const waitingHolds = (state, title) =>
  state.holds.filter((h) => h.title === title && !h.closed).sort((a, b) => (a.placed < b.placed ? -1 : 1));

// ont: derived.overdue
export const isOverdue = (loan, today) => !loan.returned && today > loan.due;
export const isAvailable = (state, item) => !openLoanOf(state, item);

// ont: inv.one-loan-per-item, inv.within-limit, edge.loan.item, edge.loan.member, field.loan.due-date, field.loan.renewals
export function checkout(state, { item, member, today }) {
  if (!state.items[item]) throw new Refusal(`No item ${item}`);
  if (!state.members[member]) throw new Refusal(`No member ${member}`);
  if (openLoanOf(state, item)) throw new Refusal(`Item ${item} is already on loan`);
  const limit = state.members[member].borrowLimit ?? DEFAULT_LIMIT;
  const mine = openLoans(state).filter((l) => l.member === member).length;
  if (mine >= limit) throw new Refusal(`${member} already has ${mine} of ${limit} loans`);
  const loan = {
    id: `L${state.loans.length + 1}`,
    item,
    member,
    checkout: today,
    due: addDays(today, LOAN_DAYS),
    renewals: 0,
    returned: null,
    fineCents: 0,
  };
  state.loans.push(loan);
  return loan;
}

export function returnItem(state, { item, today }) {
  const loan = openLoanOf(state, item);
  if (!loan) throw new Refusal(`Item ${item} is not on loan`);
  loan.returned = today;
  if (today > loan.due) loan.fineCents += daysBetween(loan.due, today) * FINE_CENTS_PER_DAY;
  return loan;
}

// ont: rule.renewal, inv.no-renew-when-held
export function renew(state, { item, today }) {
  const loan = openLoanOf(state, item);
  if (!loan) throw new Refusal(`Item ${item} is not on loan`);
  if (loan.renewals >= MAX_RENEWALS) throw new Refusal(`Already renewed ${MAX_RENEWALS} times`);
  const title = state.items[item].title;
  const waiting = waitingHolds(state, title).length;
  if (waiting) throw new Refusal(`${waiting} member(s) waiting for this title`);
  loan.renewals += 1;
  loan.due = addDays(loan.due, RENEW_DAYS);
  return loan;
}

// ont: edge.hold.waits-for, edge.hold.member
export function placeHold(state, { title, member, today }) {
  if (!state.titles[title]) throw new Refusal(`No title ${title}`);
  if (!state.members[member]) throw new Refusal(`No member ${member}`);
  const copies = Object.entries(state.items).filter(([, it]) => it.title === title);
  if (copies.some(([id]) => isAvailable(state, id))) throw new Refusal(`An item of ${title} is available`);
  const hold = { id: `H${state.holds.length + 1}`, title, member, placed: today, closed: null };
  state.holds.push(hold);
  return hold;
}

// ont: derived.queue-position
export function memberView(state, member, today) {
  const loans = openLoans(state)
    .filter((l) => l.member === member)
    .map((l) => ({
      item: l.item,
      title: state.titles[state.items[l.item].title].name,
      due: l.due,
      overdue: isOverdue(l, today),
      renewals: l.renewals,
      waiting: waitingHolds(state, state.items[l.item].title).length,
    }));
  const holds = state.holds
    .filter((h) => h.member === member && !h.closed)
    .map((h) => ({
      title: state.titles[h.title].name,
      position: waitingHolds(state, h.title).indexOf(h) + 1,
    }));
  return { loans, holds };
}
