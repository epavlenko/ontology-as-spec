// The oracle (D-93): formal forms read from folded behavior blocks of the ontology, traces read from
// folded traces blocks of the catalogue, an interpreter that runs actions, days and hooks on records of
// entities, and the structural checks of forms and traces. The oracle checks the ontology and the
// code; it is not the product (rule.oracle-not-the-product).
// ont: ent.formal-form, edge.formal-form.concept, concept.oracle, ent.trace, edge.trace.check
import { FormError, addDays, evaluate, idOf, names, parse, schemaOf } from "./expr.mjs";

const FORM_CLASSES = ["derived", "concept", "rule", "inv", "hook", "action"];
const REQUIRED = ["derived", "rule", "inv", "hook", "action"];
const cls = (id) => id.split(".")[0];

// Fenced blocks of a language, with the heading of their section, their line, whether a <details>
// folds them, and their lines.
export function blocks(md, lang) {
  const lines = md.split("\n");
  const out = [];
  let heading = "";
  for (let i = 0; i < lines.length; i++) {
    if (/^## /.test(lines[i])) heading = lines[i].slice(3).trim();
    if (lines[i].trim() !== "```" + lang) continue;
    const start = i;
    const body = [];
    for (i++; i < lines.length && lines[i].trim() !== "```"; i++) body.push({ text: lines[i], line: i + 1 });
    const before = lines.slice(0, start).reverse().find((l) => l.trim());
    const after = lines.slice(i + 1).find((l) => l.trim());
    const folded = /^<details>/.test(before?.trim() ?? "") || /<summary>/.test(before ?? "");
    out.push({ heading, line: start + 1, folded: folded && /^<\/details>/.test(after?.trim() ?? ""), body });
  }
  return out;
}

// Entries of a block: a line at column 0 opens an entry; indented lines belong to it.
const entries = (block) => {
  const out = [];
  for (const l of block.body) {
    if (!l.text.trim() || l.text.trim().startsWith("#")) continue;
    if (!/^\s/.test(l.text)) out.push({ head: l.text.trim(), line: l.line, body: [] });
    else if (out.length) out.at(-1).body.push({ text: l.text.replace(/\s+$/, ""), indent: l.text.match(/^\s*/)[0].length, line: l.line });
  }
  return out;
};

// Split on commas outside parentheses and quotes.
const splitTop = (s) => {
  const parts = [];
  let depth = 0, q = false, cur = "";
  for (const c of s) {
    if (c === '"') q = !q;
    if (!q && c === "(") depth++;
    if (!q && c === ")") depth--;
    if (!q && !depth && c === ",") { parts.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
};

const template = (t) => {
  const parts = [];
  let i = 0;
  for (const m of t.matchAll(/\{([^}]*)\}/g)) {
    parts.push({ s: t.slice(i, m.index) });
    parts.push({ e: parse(m[1]), src: m[1] });
    i = m.index + m[0].length;
  }
  parts.push({ s: t.slice(i) });
  return parts;
};

const params = (s) =>
  (s ?? "").split(",").map((x) => x.trim()).filter(Boolean).map((x) => {
    const [name, type] = x.split(":").map((y) => y.trim());
    return { name, type: type ?? null };
  });

// Statements of an action or a hook, nested by indentation.
function statements(lines, problems, id) {
  const tree = [];
  const stack = [{ indent: -1, list: tree }];
  for (let i = 0; i < lines.length; i++) {
    const { text, indent, line } = lines[i];
    const t = text.trim();
    while (stack.length > 1 && indent <= stack.at(-1).indent) stack.pop();
    const list = stack.at(-1).list;
    const fail = (msg) => problems.push(`${id}, line ${line}: ${msg}`);
    try {
      let m;
      if ((m = t.match(/^let ([a-z][a-z0-9-]*) = (.+)$/))) list.push({ s: "let", name: m[1], e: parse(m[2]), line });
      else if ((m = t.match(/^(refuse|empty) when (.+)$/))) {
        const next = lines[i + 1]?.text.trim().match(/^says "(.*)"$/);
        if (next) i++;
        list.push({ s: m[1], e: parse(m[2]), says: next ? template(next[1]) : [{ s: "" }], line });
      } else if ((m = t.match(/^refuse by ((?:inv|rule)\.[a-z0-9-]+)$/))) list.push({ s: "refuse-by", id: m[1], line });
      else if ((m = t.match(/^always (.+)$/))) list.push({ s: "always", e: parse(m[1]), line });
      else if ((m = t.match(/^create ([a-z][a-z0-9-]*): (.+)$/))) list.push({ s: "create", ent: m[1], fields: splitTop(m[2]).map((f) => { const [k, ...v] = f.split("="); return { f: k.trim(), e: parse(v.join("=").trim()) }; }), line });
      else if ((m = t.match(/^set ([a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+) = (.+)$/))) {
        const segs = m[1].split(".");
        list.push({ s: "set", target: parse(segs.slice(0, -1).join(".")), f: segs.at(-1), e: parse(m[2]), line });
      } else if ((m = t.match(/^each ([a-z][a-z0-9-]*) in ([a-z][a-z0-9-]*)(?: where (.+))?:$/))) {
        const node = { s: "each", v: m[1], c: m[2], where: m[3] ? parse(m[3]) : null, body: [], line };
        list.push(node);
        stack.push({ indent, list: node.body });
      } else if ((m = t.match(/^if (.+):$/))) {
        const node = { s: "if", e: parse(m[1]), body: [], line };
        list.push(node);
        stack.push({ indent, list: node.body });
      } else if ((m = t.match(/^notify (.+?) "(.*)"(?: offering (action\.[a-z0-9-]+)\((.*)\))?$/))) {
        list.push({ s: "notify", to: parse(m[1]), text: template(m[2]), offer: m[3] ? { id: m[3], args: splitTop(m[4]).map((a) => { const [k, ...v] = a.split("="); return { name: k.trim(), e: parse(v.join("=").trim()) }; }) } : null, line });
      } else fail(`not a statement: ${t}`);
    } catch (e) {
      fail(e.message);
    }
  }
  return tree;
}

// Formal forms of an ontology: Map(id → form), with the problems of their blocks.
export function readForms(md, rows) {
  const problems = [];
  const order = [];
  const forms = new Map();
  const bySection = new Map();
  for (const r of rows) bySection.set(r.heading, [...(bySection.get(r.heading) ?? []), r.id]);
  const seenSections = new Set();
  for (const b of blocks(md, "behavior")) {
    const ids = bySection.get(b.heading) ?? [];
    if (seenSections.has(b.heading)) problems.push(`section ${b.heading}: more than one behavior block`);
    seenSections.add(b.heading);
    // ont: rule.form-follows-rows
    if (!b.folded) problems.push(`section ${b.heading}: the behavior block at line ${b.line} is not folded in <details>`);
    let last = -1;
    for (const en of entries(b)) {
      const m = en.head.match(/^([a-z]+\.[a-z0-9-]+)(?:\(([^)]*)\))?(.*)$/);
      if (!m || !FORM_CLASSES.includes(cls(m[1]))) { problems.push(`section ${b.heading}, line ${en.line}: a form starts with an ID of a derived value, concept, rule, invariant, hook or action: ${en.head}`); continue; }
      const [, id, ps, rest] = m;
      const at = ids.indexOf(id);
      if (at < 0) { problems.push(`section ${b.heading}, line ${en.line}: ${id} is not a row of this section`); continue; }
      if (at < last) problems.push(`section ${b.heading}, line ${en.line}: ${id} is out of the order of the rows`);
      last = Math.max(last, at);
      if (forms.has(id)) { problems.push(`${id}: two forms`); continue; }
      order.push(id);
      const form = { id, heading: b.heading, line: en.line, params: params(ps), class: cls(id) };
      try {
        const head = rest.trim();
        if (form.class === "derived" || form.class === "concept") {
          const src = [head.replace(/^=\s*/, ""), ...en.body.map((l) => l.text.trim())].join(" ");
          if (!head.startsWith("=")) throw new FormError("parse", "a derived value or a concept is written ID(params) = expression");
          form.e = parse(src);
        } else if (form.class === "rule") {
          form.values = {};
          if (head.startsWith("=")) form.value = parse(head.replace(/^=\s*/, ""));
          const refusing = [];
          for (const l of en.body) {
            const v = l.text.trim().match(/^([a-z][a-z0-9-]*) = (.+)$/);
            if (v) form.values[v[1]] = parse(v[2]);
            else refusing.push(l);
          }
          form.body = statements(refusing, problems, id);
        } else if (form.class === "inv") {
          form.body = statements(en.body, problems, id);
        } else if (form.class === "action") {
          const by = head.match(/^by (.+)$/);
          if (!by) throw new FormError("parse", "an action is written ID(params) by staff, member or both");
          form.roles = by[1].split(/\s+or\s+/).map((x) => x.trim());
          form.body = statements(en.body, problems, id);
        } else if (form.class === "hook") {
          const on = head.match(/^on (day|action\.[a-z0-9-]+)$/);
          if (!on) throw new FormError("parse", "a hook is written ID on day, or ID on action.name");
          form.on = on[1];
          form.body = statements(en.body, problems, id);
        }
      } catch (e) {
        problems.push(`${id}, line ${en.line}: ${e.message}`);
        continue;
      }
      forms.set(id, form);
    }
  }
  return { forms, order, problems };
}

// The structural checks: a form for every row of a required class, every name defined.
export function checkForms({ forms, problems }, rows) {
  const schema = schemaOf(rows);
  const missing = [];
  // ont: inv.form-per-row
  for (const r of rows) if (REQUIRED.includes(cls(r.id)) && !forms.has(r.id)) missing.push(`${r.id} (${r.heading})`);
  const badNames = [];
  // ont: inv.form-names-defined
  const scopeOf = (f, extra = {}) => {
    const s = { ...extra };
    for (const p of f.params ?? []) s[p.name] = schema.entities[p.name] && !p.type ? p.name : "scalar";
    return s;
  };
  const check = (f, tree, scope, what) => {
    const r = names(tree, { schema, scope, forms });
    for (const b of r.bad) badNames.push(`${f.id}${what ? ` (${what})` : ""}: ${b}`);
  };
  const walkStmts = (f, list, scope) => {
    for (const st of list ?? []) {
      if (st.s === "let") { check(f, st.e, scope, "let"); scope = { ...scope, [st.name]: entityType(st.e, scope) }; }
      if (st.s === "refuse" || st.s === "empty") { check(f, st.e, scope); for (const t of st.says) if (t.e) check(f, t.e, scope, "says"); }
      if (st.s === "refuse-by" && !forms.has(st.id)) badNames.push(`${f.id}: ${st.id}`);
      if (st.s === "create") {
        const e = schema.entities[st.ent];
        if (!e) badNames.push(`${f.id}: create ${st.ent}`);
        for (const x of st.fields) { if (e && !e.fields[x.f]) badNames.push(`${f.id}: ${st.ent}.${x.f}`); check(f, x.e, scope); }
      }
      if (st.s === "set") {
        const t = names(st.target, { schema, scope, forms });
        for (const b of t.bad) badNames.push(`${f.id}: ${b}`);
        if (t.type.ent && !schema.entities[t.type.ent].fields[st.f]) badNames.push(`${f.id}: ${t.type.ent}.${st.f}`);
        check(f, st.e, scope);
      }
      if (st.s === "each") {
        const e = schema.byCollection[st.c];
        if (!e) badNames.push(`${f.id}: ${st.c}`);
        const s = { ...scope, [st.v]: e ? e.name : "scalar" };
        if (st.where) check(f, st.where, s);
        walkStmts(f, st.body, s);
      }
      if (st.s === "if") { check(f, st.e, scope); walkStmts(f, st.body, scope); }
      if (st.s === "notify") {
        check(f, st.to, scope);
        for (const t of st.text) if (t.e) check(f, t.e, scope, "text");
        if (st.offer) { if (!forms.has(st.offer.id)) badNames.push(`${f.id}: ${st.offer.id}`); for (const a of st.offer.args) check(f, a.e, scope); }
      }
    }
    return scope;
  };
  const entityType = (tree, scope) => {
    const t = names(tree, { schema, scope, forms }).type;
    return t.ent ?? "scalar";
  };
  for (const f of forms.values()) {
    const scope = scopeOf(f);
    if (f.e) check(f, f.e, scope);
    if (f.value) check(f, f.value, scope);
    for (const v of Object.values(f.values ?? {})) check(f, v, scope);
    if (f.class === "inv") for (const st of f.body ?? []) if (st.s === "always") check(f, st.e, {}, "always");
    if (f.class === "rule" || f.class === "inv") {
      // A rule's or an invariant's refusal is read in the scope of the actions that name it: its
      // names are checked there, with the action's parameters and lets.
      continue;
    }
    if (f.class === "hook" && f.on !== "day") {
      const a = forms.get(f.on);
      if (!a) { badNames.push(`${f.id}: ${f.on}`); continue; }
      walkStmts(f, f.body, walkStmts(a, a.body, scopeOf(a, { actor: "scalar" })));
      continue;
    }
    const after = walkStmts(f, f.body, scope);
    // The refusals an action names are checked in its scope at the point it names them.
    const named = (list, s) => {
      for (const st of list ?? []) {
        if (st.s === "let") s = { ...s, [st.name]: entityType(st.e, s) };
        if (st.s === "refuse-by" && forms.has(st.id)) {
          const g = forms.get(st.id);
          const rs = { ...s, ...Object.fromEntries(Object.keys(g.values ?? {}).map((k) => [k, "scalar"])) };
          walkStmts(g, g.body, rs);
        }
        if (st.s === "each" || st.s === "if") named(st.body, s);
      }
    };
    named(f.body, scopeOf(f));
    void after;
  }
  return { missing, badNames: [...new Set(badNames)], problems };
}

// ---------- the interpreter ----------

export class Oracle {
  constructor(rows, formsRead, sample) {
    this.schema = schemaOf(rows);
    this.forms = formsRead.forms;
    this.order = formsRead.order;
    this.state = {};
    for (const e of Object.values(this.schema.entities)) this.state[e.collection] = [];
    this.today = null;
    this.seq = 0;
    this.notifications = [];
    this.log = [];
    for (const o of sample ?? []) this.put(o.ent, o.id, o.fields);
  }
  put(ent, id, fields) {
    const e = this.schema.entities[ent];
    if (!e) throw new FormError("trace", `no entity ${ent}`);
    const rec = { id };
    for (const k of Object.keys(e.fields)) if (k !== "id") rec[k] = null;
    Object.assign(rec, fields);
    this.state[e.collection].push(rec);
  }
  byId() {
    const m = new Map();
    for (const list of Object.values(this.state)) for (const o of list) m.set(o.id, o);
    return m;
  }
  ctx(state, actor) {
    const byId = new Map();
    for (const list of Object.values(state)) for (const o of list) byId.set(o.id, o);
    const self = this;
    const c = {
      state, byId, today: this.today, now: `${this.today}T${String(this.seq).padStart(6, "0")}`, actor,
      ruleValue(id) {
        const f = self.forms.get(id);
        if (!f) throw new FormError("name", `no form ${id}`);
        if (f.value) return evaluate(f.value, c, {});
        return { __rule: id, values: Object.fromEntries(Object.entries(f.values).map(([k, v]) => [k, evaluate(v, c, {})])) };
      },
      call(id, args) {
        const f = self.forms.get(id);
        if (!f) throw new FormError("name", `no form ${id}`);
        return evaluate(f.e, c, Object.fromEntries(f.params.map((p, i) => [p.name, args[i]])));
      },
    };
    return c;
  }
  text(parts, c, env) {
    return parts.map((p) => (p.e ? String(idOf(evaluate(p.e, c, env)) ?? "") : p.s)).join("");
  }
  // Runs statements; returns { outcome } on a refusal or an empty case, else null.
  exec(list, c, env, owner, effects) {
    for (const st of list) {
      if (st.s === "let") env[st.name] = evaluate(st.e, c, env);
      else if (st.s === "refuse" || st.s === "empty") {
        if (evaluate(st.e, c, env) === true) return { kind: st.s === "refuse" ? "refused" : "empty", by: owner, message: this.text(st.says, c, env) };
      } else if (st.s === "refuse-by") {
        const g = this.forms.get(st.id);
        const genv = { ...env };
        if (g.values) for (const [k, v] of Object.entries(g.values)) genv[k] = evaluate(v, c, {});
        const r = this.exec(g.body, c, genv, st.id, effects);
        if (r) return r;
      } else if (st.s === "create") {
        const e = this.schema.entities[st.ent];
        const rec = { id: `${st.ent}-${++this.seq}` };
        for (const k of Object.keys(e.fields)) if (k !== "id") rec[k] = null;
        for (const x of st.fields) rec[x.f] = idOf(evaluate(x.e, c, env));
        c.state[e.collection].push(rec);
        c.byId.set(rec.id, rec);
      } else if (st.s === "set") {
        let t = evaluate(st.target, c, env);
        if (typeof t === "string") t = c.byId.get(t);
        if (!t || typeof t !== "object") throw new FormError("eval", `set ${st.f} on nothing`);
        t[st.f] = idOf(evaluate(st.e, c, env));
      } else if (st.s === "each") {
        const items = [...(c.state[st.c] ?? [])].filter((x) => !st.where || evaluate(st.where, c, { ...env, [st.v]: x }) === true);
        for (const x of items) { const r = this.exec(st.body, c, { ...env, [st.v]: x }, owner, effects); if (r) return r; }
      } else if (st.s === "if") {
        if (evaluate(st.e, c, env) === true) { const r = this.exec(st.body, c, env, owner, effects); if (r) return r; }
      } else if (st.s === "notify") {
        const to = idOf(evaluate(st.to, c, env));
        const n = { to, by: owner, text: this.text(st.text, c, env), offers: [] };
        if (st.offer) {
          const args = Object.fromEntries(st.offer.args.map((a) => [a.name, idOf(evaluate(a.e, c, env))]));
          effects.offers.push({ n, id: st.offer.id, args, actor: to });
        }
        effects.notifications.push(n);
      }
    }
    return null;
  }
  // An action: its entity parameters must name objects, the actor must have its role, then its
  // statements run on a copy of the state, which replaces the state only when nothing refuses.
  act(id, args, actor, dry = false) {
    const f = this.forms.get(id);
    if (!f || f.class !== "action") throw new FormError("trace", `no action form ${id}`);
    const byId = this.byId();
    const env = {};
    for (const p of f.params) {
      const v = args[p.name] ?? null;
      const ent = !p.type && this.schema.entities[p.name];
      if (ent) {
        const o = byId.get(v);
        if (!o || !this.state[ent.collection].includes(o)) return { kind: "empty", by: id, message: `no ${p.name} ${v}` };
        env[p.name] = o;
      } else env[p.name] = v;
    }
    const role = actor === "staff" ? "staff" : byId.get(actor) && this.state[this.schema.entities.member?.collection ?? "members"]?.includes(byId.get(actor)) ? "member" : null;
    if (!f.roles.includes(role)) return { kind: "refused", by: id, message: `not permitted for ${actor}` };
    const state = structuredClone(this.state);
    const c = this.ctx(state, actor);
    for (const p of f.params) if (env[p.name] && typeof env[p.name] === "object") env[p.name] = c.byId.get(env[p.name].id);
    const effects = { notifications: [], offers: [] };
    this.seq++;
    c.now = `${this.today}T${String(this.seq).padStart(6, "0")}`;
    const r = this.exec(f.body, c, env, id, effects);
    if (r) return r;
    for (const h of this.order.map((x) => this.forms.get(x)).filter((h) => h.class === "hook" && h.on === id)) {
      const hr = this.exec(h.body, c, { ...env }, h.id, effects);
      if (hr) return hr;
    }
    if (dry) return { kind: "ok", by: id, message: "" };
    this.state = state;
    this.settle(effects);
    return { kind: "ok", by: id, message: "" };
  }
  // Every day from the day after today up to date is processed in turn; the first step only sets it.
  advance(date) {
    if (this.today === null) { this.today = date; return; }
    if (date < this.today) throw new FormError("trace", `${date} is before ${this.today}`);
    while (this.today < date) this.day(addDays(this.today, 1));
  }
  day(date) {
    this.today = date;
    const effects = { notifications: [], offers: [] };
    const state = structuredClone(this.state);
    const c = this.ctx(state, "system");
    for (const h of this.order.map((x) => this.forms.get(x)).filter((h) => h.class === "hook" && h.on === "day")) {
      const r = this.exec(h.body, c, {}, h.id, effects);
      if (r) throw new FormError("eval", `${h.id} refused on ${date}: ${r.message}`);
    }
    this.state = state;
    this.settle(effects);
  }
  // ont: inv.traces-pass
  holdsAlways(when) {
    const c = this.ctx(this.state, "system");
    for (const f of this.forms.values()) for (const st of f.class === "inv" ? f.body : []) if (st.s === "always" && evaluate(st.e, c, {}) !== true) throw new FormError("invariant", `${f.id} does not hold after ${when}`);
  }
  settle(effects, when = "a step") {
    this.holdsAlways(when);
    for (const o of effects.offers) if (this.act(o.id, o.args, o.actor, true).kind === "ok") o.n.offers.push(o.id);
    this.notifications.push(...effects.notifications);
  }
  eval(src, actor = "staff") {
    return evaluate(parse(src), this.ctx(this.state, actor), {});
  }
}

// ---------- traces ----------

const value = (v) => {
  if (v === "null") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^\d+$/.test(v)) return Number(v);
  return v.replace(/^"|"$/g, "");
};
const kv = (s) => Object.fromEntries([...s.matchAll(/([a-z][a-z0-9-]*)=("[^"]*"|\S+)/g)].map((m) => [m[1], value(m[2])]));

export function readTraces(md) {
  const problems = [];
  const traces = new Map();
  let sample = [];
  for (const b of blocks(md, "traces")) {
    if (!b.folded) problems.push(`section ${b.heading}: the traces block at line ${b.line} is not folded in <details>`);
    for (const en of entries(b)) {
      if (en.head === "sample") { sample = en.body.map((l) => object(l.text.trim())); continue; }
      if (!/^check\.[a-z0-9.-]+$/.test(en.head)) { problems.push(`line ${en.line}: a trace starts with a check ID: ${en.head}`); continue; }
      if (traces.has(en.head)) { problems.push(`${en.head}: two traces`); continue; }
      const t = { id: en.head, heading: b.heading, line: en.line, given: [], when: [], then: [] };
      let part = null;
      for (const l of en.body) {
        const s = l.text.trim();
        if (["given", "when", "then"].includes(s)) { part = s; continue; }
        if (!part) { problems.push(`${en.head}, line ${l.line}: a step outside given, when or then`); continue; }
        t[part].push({ text: s, line: l.line });
      }
      traces.set(t.id, t);
    }
  }
  return { traces, sample, problems };
}

const object = (s) => {
  const m = s.match(/^([a-z][a-z0-9-]*) ("[^"]+"|\S+)(.*)$/);
  if (!m) throw new FormError("trace", `not an object: ${s}`);
  return { ent: m[1], id: value(m[2]), fields: kv(m[3]) };
};

// One step: "2026-10-01 day", "2026-10-01 staff action.checkout item=dune-1 member=ana",
// an object line "item misc-1 copy-of=Misc", or "assert expression".
function step(o, s, outcomes) {
  let m;
  if ((m = s.match(/^assert (.+)$/))) {
    const v = o.eval(m[1]);
    if (v !== true) throw new FormError("then", `assert ${m[1]} is ${JSON.stringify(v)}`);
    return;
  }
  if ((m = s.match(/^(\d{4}-\d{2}-\d{2}) day$/))) { o.advance(m[1]); return; }
  if ((m = s.match(/^(\d{4}-\d{2}-\d{2}) (\S+) (action\.[a-z0-9-]+)(.*)$/))) {
    o.advance(m[1]);
    outcomes?.push(o.act(m[3], kv(m[4]), m[2]));
    return;
  }
  const obj = object(s);
  o.put(obj.ent, obj.id, obj.fields);
}

// Runs a trace: given, when (with its outcomes), then. Returns { ok, error }.
export function runTrace(rows, formsRead, sample, t) {
  const o = new Oracle(rows, formsRead, sample);
  try {
    for (const s of t.given) {
      const before = [];
      step(o, s.text, before);
      for (const r of before) if (r.kind !== "ok") throw new FormError("given", `line ${s.line}: ${s.text} was ${r.kind}${r.by ? ` by ${r.by}` : ""}: ${r.message}`);
    }
    const from = o.notifications.length;
    const outcomes = [];
    for (const s of t.when) step(o, s.text, outcomes);
    const notified = o.notifications.slice(from);
    let i = -1;
    for (const s of t.then) {
      const x = s.text;
      let m;
      if ((m = x.match(/^outcome (ok|refused|empty)(?: by ([a-z]+\.[a-z0-9-]+))?$/))) {
        i++;
        const r = outcomes[i];
        if (!r) throw new FormError("then", `line ${s.line}: no outcome ${i + 1}`);
        if (r.kind !== m[1] || (m[2] && r.by !== m[2])) throw new FormError("then", `line ${s.line}: outcome ${i + 1} is ${r.kind} by ${r.by} («${r.message}»), expected ${m[1]}${m[2] ? ` by ${m[2]}` : ""}`);
      } else if ((m = x.match(/^says "(.*)"$/))) {
        const r = outcomes[i];
        if (!r || !r.message.includes(m[1])) throw new FormError("then", `line ${s.line}: outcome ${i + 1} says «${r?.message}», not «${m[1]}»`);
      } else if ((m = x.match(/^notified (\S+) by (hook\.[a-z0-9-]+)(?: offering (action\.[a-z0-9-]+))?( once)?$/))) {
        const hits = notified.filter((n) => n.to === m[1] && n.by === m[2]);
        if (!hits.length) throw new FormError("then", `line ${s.line}: ${m[1]} was not notified by ${m[2]}`);
        if (m[4] && hits.length !== 1) throw new FormError("then", `line ${s.line}: ${m[1]} was notified ${hits.length} times by ${m[2]}`);
        if (m[3] && !hits.every((n) => n.offers.includes(m[3]))) throw new FormError("then", `line ${s.line}: the notification does not offer ${m[3]}`);
      } else if ((m = x.match(/^not notified (\S+)$/))) {
        if (notified.some((n) => n.to === m[1])) throw new FormError("then", `line ${s.line}: ${m[1]} was notified`);
      } else step(o, x, null);
    }
    if (i + 1 !== outcomes.length) throw new FormError("then", `${outcomes.length} action(s) in WHEN, ${i + 1} outcome line(s) in THEN`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Not-traced lines of the catalogue: "- Not traced: `check.id` — reason".
export const notTraced = (md) =>
  new Map([...md.matchAll(/^- Not traced: `(check\.[a-z0-9.-]+)`\s+—\s+(.+)$/gm)].map((m) => [m[1], m[2].trim()]));

// ont: inv.trace-per-check
export function checkTraces(read, checks, md) {
  const skipped = notTraced(md);
  const ids = new Set(checks.map((c) => c.id));
  const untraced = checks.filter((c) => !read.traces.has(c.id) && !skipped.has(c.id)).map((c) => c.id);
  const unknown = [...read.traces.keys(), ...skipped.keys()].filter((x) => !ids.has(x));
  const both = [...skipped.keys()].filter((x) => read.traces.has(x));
  return { untraced, unknown, both, skipped, problems: read.problems };
}
