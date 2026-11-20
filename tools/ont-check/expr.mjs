// The form language's expressions: tokenizer, recursive-descent parser, evaluator, and a name check
// typed by the ontology's own entities, fields and relations (D-93). No dependencies.
// ont: ent.formal-form, inv.form-names-defined
const KEYWORDS = new Set(["and", "or", "not", "some", "no", "every", "in", "where", "count", "first", "by", "today", "now", "actor", "the", "true", "false", "null", "day", "days"]);
const ID_CLASSES = new Set(["derived", "concept", "rule"]);

export class FormError extends Error {
  constructor(kind, msg) {
    super(msg);
    this.kind = kind;
  }
}

function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"') {
      const j = src.indexOf('"', i + 1);
      if (j < 0) throw new FormError("parse", "unterminated text");
      out.push({ t: "str", v: src.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9]/.test(src[j])) j++;
      out.push({ t: "num", v: Number(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[a-z_]/i.test(c)) {
      let j = i;
      while (j < src.length && /[a-z0-9_-]/i.test(src[j])) j++;
      while (src[j - 1] === "-") j--;
      const w = src.slice(i, j);
      out.push(KEYWORDS.has(w) ? { t: "kw", v: w } : { t: "name", v: w });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (["!=", "<=", ">="].includes(two)) { out.push({ t: "op", v: two }); i += 2; continue; }
    if ("=<>+-().,".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    throw new FormError("parse", `unexpected character ${c}`);
  }
  return out;
}

export function parse(src) {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const is = (t, v) => toks[p] && toks[p].t === t && (v === undefined || toks[p].v === v);
  const take = (t, v) => {
    if (!is(t, v)) throw new FormError("parse", `expected ${v ?? t} at token ${p + 1}${toks[p] ? ` (${toks[p].v})` : " (end)"}`);
    return toks[p++];
  };
  const expr = () => or();
  const or = () => { let l = and(); while (is("kw", "or")) { p++; l = { k: "or", l, r: and() }; } return l; };
  const and = () => { let l = not(); while (is("kw", "and")) { p++; l = { k: "and", l, r: not() }; } return l; };
  const not = () => (is("kw", "not") ? (p++, { k: "not", e: not() }) : cmp());
  const cmp = () => {
    const l = sum();
    if (is("op") && ["=", "!=", "<", "<=", ">", ">="].includes(peek().v)) {
      const op = toks[p++].v;
      return { k: "cmp", op, l, r: sum() };
    }
    return l;
  };
  const sum = () => {
    let l = term();
    while (is("op", "+") || is("op", "-")) {
      const op = toks[p++].v;
      l = { k: "arith", op, l, r: term() };
    }
    return l;
  };
  const loop = () => {
    const v = take("name").v;
    take("kw", "in");
    const c = take("name").v;
    let where = null;
    if (is("kw", "where")) { p++; where = expr(); }
    return { v, c, where };
  };
  const term = () => {
    if (is("num")) {
      const n = toks[p++].v;
      if (is("kw", "day") || is("kw", "days")) { p++; return { k: "dur", days: n }; }
      return { k: "lit", v: n };
    }
    if (is("str")) return { k: "lit", v: toks[p++].v };
    if (is("kw", "true")) { p++; return { k: "lit", v: true }; }
    if (is("kw", "false")) { p++; return { k: "lit", v: false }; }
    if (is("kw", "null")) { p++; return { k: "lit", v: null }; }
    for (const w of ["today", "now", "actor"]) if (is("kw", w)) { p++; return path({ k: w }); }
    if (is("op", "(")) { p++; const e = expr(); take("op", ")"); return path(e); }
    if (is("kw", "the")) { p++; const term = take("name").v; const id = take("str").v; return path({ k: "the", term, id }); }
    if (is("kw", "some") || is("kw", "no") || is("kw", "every")) {
      const q = toks[p++].v;
      const l = loop();
      if (q === "every" && !l.where) throw new FormError("parse", "every needs where");
      return { k: "quant", q, ...l };
    }
    if (is("kw", "count")) { p++; take("op", "("); const l = loop(); take("op", ")"); return { k: "count", ...l }; }
    if (is("kw", "first")) { p++; const l = loop(); take("kw", "by"); return { k: "first", ...l, by: sum() }; }
    if (is("name")) {
      const w = toks[p++].v;
      if (ID_CLASSES.has(w) && is("op", ".")) {
        p++;
        const id = `${w}.${take("name").v}`;
        if (is("op", "(")) {
          p++;
          const args = [];
          if (!is("op", ")")) { args.push(expr()); while (is("op", ",")) { p++; args.push(expr()); } }
          take("op", ")");
          return path({ k: "call", id, args });
        }
        return path({ k: "ref", id });
      }
      return path({ k: "var", name: w });
    }
    throw new FormError("parse", `unexpected ${peek() ? peek().v : "end"}`);
  };
  const path = (base) => {
    let node = base;
    // After a dot comes the last part of a field's ID, which may be a word of the language:
    // `field.manual-run.by` is read as `r.by`.
    while (is("op", ".")) { p++; node = { k: "field", of: node, f: (is("kw") ? toks[p++] : take("name")).v }; }
    return node;
  };
  const tree = expr();
  if (p !== toks.length) throw new FormError("parse", `unexpected ${toks[p].v} after the end`);
  return tree;
}

// The ontology's schema for forms: entities by name (the ID without `ent.`), their collection (the
// term in lowercase plus s) and their fields and relations, by the last segment of the ID.
export function schemaOf(rows) {
  const entities = {};
  for (const r of rows) if (r.id.startsWith("ent.")) {
    const name = r.id.slice(4);
    const term = (r.line.split("|")[3] ?? name).trim().toLowerCase().replace(/\s+/g, "-");
    entities[name] = { id: r.id, name, collection: `${term}s`, fields: { id: { id: null, ref: null } } };
  }
  for (const r of rows) {
    const m = r.id.match(/^(field|edge)\.([a-z0-9-]+)\.([a-z0-9-]+)$/);
    if (!m || !entities[m[2]]) continue;
    const ref = (r.type ?? "").match(/\bref ent\.([a-z0-9-]+)/);
    entities[m[2]].fields[m[3]] = { id: r.id, ref: ref ? ref[1] : null, type: r.type };
  }
  const byCollection = Object.fromEntries(Object.values(entities).map((e) => [e.collection, e]));
  return { entities, byCollection };
}

// Every name of a form, typed: a parameter or loop variable of an entity, a collection, a field or
// relation of the entity it is read on (relations lead on to their entity), an ID that has a form.
// ctx: { schema, scope: { name: entityName | "scalar" }, forms: Map(id → { params, values }) }
export function names(tree, ctx) {
  const bad = [];
  const used = [];
  const ent = (name) => ({ ent: name });
  const SCALAR = { scalar: true };
  // A name already reported: what is read on it is not reported again.
  const UNKNOWN = { scalar: true, unknownOk: true };
  const walk = (n, scope) => {
    if (!n) return SCALAR;
    switch (n.k) {
      case "lit": case "dur": case "today": case "now": return SCALAR;
      case "actor": return SCALAR;
      case "the": {
        const e = Object.values(ctx.schema.entities).find((x) => x.name === n.term);
        used.push(n.term);
        if (!e) { bad.push(n.term); return UNKNOWN; }
        return ent(e.name);
      }
      case "var": {
        used.push(n.name);
        if (n.name in scope) return scope[n.name] === "scalar" ? SCALAR : ent(scope[n.name]);
        if (ctx.schema.byCollection[n.name]) return { list: ctx.schema.byCollection[n.name].name };
        bad.push(n.name);
        return UNKNOWN;
      }
      case "field": {
        const of = walk(n.of, scope);
        used.push(n.f);
        if (of.ent) {
          const f = ctx.schema.entities[of.ent].fields[n.f];
          if (!f) { bad.push(`${of.ent}.${n.f}`); return UNKNOWN; }
          return f.ref ? ent(f.ref) : SCALAR;
        }
        if (of.rule) {
          if (!(ctx.forms.get(of.rule)?.values ?? {})[n.f]) bad.push(`${of.rule}.${n.f}`);
          return SCALAR;
        }
        if (of.unknownOk) return UNKNOWN;
        bad.push(`.${n.f} of a value that has no fields`);
        return SCALAR;
      }
      case "ref": {
        used.push(n.id);
        const f = ctx.forms.get(n.id);
        if (!f) { bad.push(n.id); return SCALAR; }
        return n.id.startsWith("rule.") ? { rule: n.id } : SCALAR;
      }
      case "call": {
        used.push(n.id);
        const f = ctx.forms.get(n.id);
        if (!f) bad.push(n.id);
        else if ((f.params ?? []).length !== n.args.length) bad.push(`${n.id} takes ${(f.params ?? []).length} argument(s)`);
        n.args.forEach((a) => walk(a, scope));
        return f?.returns ? ent(f.returns) : SCALAR;
      }
      case "quant": case "count": case "first": {
        used.push(n.c);
        const e = ctx.schema.byCollection[n.c];
        if (!e) bad.push(n.c);
        const s = { ...scope, [n.v]: e ? e.name : "scalar" };
        walk(n.where, s);
        walk(n.by, s);
        return n.k === "first" && e ? ent(e.name) : SCALAR;
      }
      case "or": case "and": case "cmp": case "arith": walk(n.l, scope); walk(n.r, scope); return SCALAR;
      case "not": walk(n.e, scope); return SCALAR;
    }
    return SCALAR;
  };
  const type = walk(tree, ctx.scope);
  return { bad, used, type };
}

const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const addDays = (d, n) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
export const idOf = (v) => (v && typeof v === "object" && "id" in v ? v.id : v);
const truthy = (v) => v === true;

// ctx: { state: { collection: [records] }, byId: Map, today, now, actor, forms, schema, call(id, args) }
export function evaluate(tree, ctx, env) {
  const ev = (n, e) => {
    switch (n.k) {
      case "lit": return n.v;
      case "dur": return { days: n.days };
      case "today": return ctx.today;
      case "now": return ctx.now;
      case "actor": return ctx.actor;
      case "the": return ctx.byId.get(n.id) ?? null;
      case "var":
        if (n.name in e) return e[n.name];
        if (n.name in ctx.state) return ctx.state[n.name];
        throw new FormError("name", `unknown name ${n.name}`);
      case "ref": return ctx.ruleValue(n.id);
      case "call": return ctx.call(n.id, n.args.map((a) => ev(a, e)));
      case "field": {
        let o = ev(n.of, e);
        if (o && typeof o === "object" && o.__rule) return o.values[n.f] ?? null;
        if (typeof o === "string" && ctx.byId.has(o)) o = ctx.byId.get(o);
        if (o === null || o === undefined) return null;
        if (typeof o !== "object") throw new FormError("eval", `field ${n.f} of a value that is not an object`);
        return o[n.f] ?? null;
      }
      case "not": return !truthy(ev(n.e, e));
      case "and": return truthy(ev(n.l, e)) && truthy(ev(n.r, e));
      case "or": return truthy(ev(n.l, e)) || truthy(ev(n.r, e));
      case "cmp": {
        const a = idOf(ev(n.l, e));
        const b = idOf(ev(n.r, e));
        if (n.op === "=") return a === b || (a == null && b == null);
        if (n.op === "!=") return !(a === b || (a == null && b == null));
        if (a == null || b == null) return false;
        if (typeof a !== typeof b) throw new FormError("eval", `cannot compare ${typeof a} with ${typeof b}`);
        return { "<": a < b, "<=": a <= b, ">": a > b, ">=": a >= b }[n.op];
      }
      case "arith": {
        const a = ev(n.l, e);
        const b = ev(n.r, e);
        if (a == null || b == null) return null;
        if (isDate(a) && b && typeof b === "object" && "days" in b) return addDays(a, n.op === "+" ? b.days : -b.days);
        if (a && typeof a === "object" && "days" in a && b && typeof b === "object" && "days" in b) return { days: n.op === "+" ? a.days + b.days : a.days - b.days };
        if (typeof a === "number" && typeof b === "number") return n.op === "+" ? a + b : a - b;
        throw new FormError("eval", `cannot ${n.op} these values`);
      }
      case "quant": case "count": case "first": {
        const list = ctx.state[n.c] ?? [];
        const hits = list.filter((x) => !n.where || truthy(ev(n.where, { ...e, [n.v]: x })));
        if (n.k === "count") return hits.length;
        if (n.k === "first") {
          let best = null;
          let bk = null;
          for (const x of hits) {
            const k = ev(n.by, { ...e, [n.v]: x });
            if (best === null || (k != null && (bk == null || k < bk))) { best = x; bk = k; }
          }
          return best;
        }
        if (n.q === "some") return hits.length > 0;
        if (n.q === "no") return hits.length === 0;
        return hits.length === list.length;
      }
    }
    throw new FormError("eval", `unknown node ${n.k}`);
  };
  return ev(tree, env);
}
