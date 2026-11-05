// Documentation anchored to the ontology. People write the explanations; a section names the concepts
// it explains in an anchor that readers do not see:
//   <!-- ont: action.renew, inv.no-renew-when-held@3f2a91 -->
// The optional @stamp is a short hash of what the section relied on when it was last reread: for a
// concept its term, type, definition and the notes that name it, for a check its case. The check can
// then say which sections to reread after one of them changed. Reference pages, which only restate
// the ontology and the check catalogue, are generated.
// ont: ent.reference-page, inv.reference-current
import { createHash } from "node:crypto";
import { markdownRuns, sectionKey, withoutExamples } from "./lib.mjs";

const ANCHOR = /<!--\s*ont:\s*([^>]*?)\s*-->/g;

// Code blocks and inline code show anchors as examples; they are not anchors of the page, and they are
// kept as they are written.
const outsideExamples = (text, f) =>
  markdownRuns(text)
    .map((r) => (r.code ? r.text : r.text.split(/(`[^`\n]*`)/).map((part, i) => (i % 2 ? part : f(part))).join("")))
    .join("");

// Every anchor in a text, outside code blocks and inline code: [{ index, raw, refs: [{ id, stamp }] }].
export const parseAnchors = (text) =>
  [...withoutExamples(text).matchAll(ANCHOR)].map((m) => ({
    index: m.index,
    raw: m[0],
    refs: m[1]
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => {
        const [id, stamp = null] = x.split("@");
        return { id, stamp };
      }),
  }));

// Every section of a hand-written page declares what it explains (D-84): the line right above each
// heading of the second or third level, outside examples, is an anchor, with IDs or empty,
// "<!-- ont: -->", when the section explains no concept. Headings are read as CommonMark reads them:
// a line of hashes, or a paragraph underlined with dashes, outside HTML blocks. Returns the headings that declare nothing,
// with their line numbers. Text above the first such heading is the page's intro and declares nothing.
// ont: inv.section-declared
const ANCHOR_LINE = /^ {0,3}<!--\s*ont:[^>]*-->\s*$/;
const ATX_HEADING = /^ {0,3}(#{1,6})(?:[ \t]|$)/;
const UNDERLINE = /^ {0,3}-+[ \t]*$/;
// A paragraph that starts like a list item, a quote or a table row is not underlined into a heading.
const NOT_A_PARAGRAPH = /^ {0,3}(?:[-*+][ \t]|\d+[.)][ \t]|>|\|)/;
// HTML blocks hold no sections: a comment runs to the line that closes it, other blocks to a blank line.
const COMMENT_START = /^ {0,3}<!--/;
const HTML_START = /^ {0,3}<\/?[A-Za-z][A-Za-z0-9-]*(?:[ \t>]|\/>|$)/;
export const undeclaredSections = (text) => {
  const found = [];
  const check = (above, line, heading) => ANCHOR_LINE.test(above) || found.push({ line, heading });
  let line = 0;
  let above = "";
  let para = null;
  let html = null;
  for (const run of markdownRuns(text)) {
    const ls = run.text.split("\n");
    if (run.text.endsWith("\n")) ls.pop();
    for (const l of ls) {
      line++;
      if (run.code) {
        above = "code";
        para = html = null;
        continue;
      }
      if (html) {
        html.text += `\n${l}`;
        if (html.comment ? l.includes("-->") : !l.trim()) {
          above = html.text.trim();
          html = null;
        }
        continue;
      }
      if (!l.trim()) {
        para = null;
        continue;
      }
      const atx = l.match(ATX_HEADING);
      if (atx) {
        if (atx[1].length === 2 || atx[1].length === 3) check(above, line, l.trim());
        para = null;
      } else if (para && UNDERLINE.test(l)) {
        if (!NOT_A_PARAGRAPH.test(para.text)) check(para.above, para.line, para.text);
        para = null;
      } else if (COMMENT_START.test(l)) {
        para = null;
        if (!l.includes("-->", l.indexOf("<!--") + 4)) {
          html = { comment: true, text: l };
          continue;
        }
      } else if (!para && HTML_START.test(l)) {
        html = { comment: false, text: l };
        continue;
      } else if (!para) para = { line, above, text: l.trim() };
      above = l.trim();
    }
  }
  return found;
};

const hash = (text) => createHash("sha256").update(text).digest("hex").slice(0, 6);

// The stamp of a concept covers what a section explaining it relies on: its term, type and
// definition, and the notes of its section that name it. The stamp of a check covers its case:
// concepts, GIVEN, WHEN, THEN and proof.
export const stampOf = (id, ONT, rows, checkById, notes = new Map()) => {
  if (ONT[id]) {
    const row = rows.find((r) => r.id === id);
    const said = (notes.get(row?.heading) ?? []).filter((l) => l.includes(`\`${id}\``));
    return hash([ONT[id].name, row?.type ?? "", ONT[id].def, ...said].join("|"));
  }
  const c = checkById.get(id);
  return c ? hash([c.concepts.join(","), c.given, c.when, c.then, c.proof].join("|")) : null;
};

// Rewrites every anchor with the current stamps: what a person runs after rereading the sections.
export const stampAnchors = (text, stamp) =>
  outsideExamples(text, (part) => part.replace(ANCHOR, (_, inner) => {
    const refs = inner
      .split(",")
      .map((x) => x.trim().split("@")[0])
      .filter(Boolean)
      .map((id) => (stamp(id) ? `${id}@${stamp(id)}` : id));
    return refs.length ? `<!-- ont: ${refs.join(", ")} -->` : "<!-- ont: -->";
  }));

const cell = (s) => String(s ?? "").replace(/\|/g, "\\|");
const table = (head, body) => {
  const width = head.map((h, i) => Math.max(h.length, 3, ...body.map((r) => r[i].length)));
  const line = (r) => `| ${r.map((c, i) => c.padEnd(width[i])).join(" | ")} |`;
  return [line(head), line(width.map((w) => "-".repeat(w))), ...body.map(line)].join("\n");
};

// A reference page: one section per ontology section, a table of the selected concepts and, if asked,
// the checks of that section. Options: title, intro, classes, implementedOnly, ids, kinds, types, checks.
export function renderReference(ref, { ONT, rows, checks, implemented, kinds, sourceName }) {
  const out = [
    `<!-- Generated by tools/ont-check/gen-reference.mjs from ${sourceName}. Do not edit by hand. -->`,
    "",
    `# ${ref.title}`,
    "",
  ];
  if (ref.intro) out.push(ref.intro, "");
  const wanted = (id) =>
    (!ref.classes || ref.classes.includes(id.split(".")[0])) && (!ref.implementedOnly || implemented.has(id));
  const sections = [...new Set(rows.map((r) => r.heading))];
  // A check is shown once, under the first section its key names.
  const owner = new Map();
  for (const heading of sections)
    for (const c of checks) if (!owner.has(c.id) && c.section === sectionKey(heading)) owner.set(c.id, heading);
  for (const heading of sections) {
    const rs = rows.filter((r) => r.heading === heading && wanted(r.id));
    const cs = ref.checks
      ? checks.filter((c) => owner.get(c.id) === heading && (!ref.implementedOnly || c.concepts.every((x) => implemented.has(x))))
      : [];
    if (!rs.length && !cs.length) continue;
    out.push(`## ${heading}`, "");
    if (rs.length) {
      const head = [
        ...(ref.kinds ? ["Kind"] : []),
        "Term",
        ...(ref.ids ? ["ID"] : []),
        ...(ref.types ? ["Type"] : []),
        "Definition",
      ];
      const body = rs.map((r) => [
        ...(ref.kinds ? [kinds?.[r.id.split(".")[0]] ?? r.id.split(".")[0]] : []),
        cell(ONT[r.id].name),
        ...(ref.ids ? [`\`${r.id}\``] : []),
        ...(ref.types ? [cell(r.type ?? "")] : []),
        cell(ONT[r.id].def),
      ]);
      out.push(table(head, body), "");
    }
    if (cs.length) {
      const head = ["Check", "Concepts", "GIVEN", "WHEN", "THEN", "Proof"];
      const body = cs.map((c) => [
        `\`${c.id}\``,
        c.concepts.map((x) => `\`${x}\``).join(", "),
        cell(c.given),
        cell(c.when),
        cell(c.then),
        c.proof,
      ]);
      out.push(table(head, body), "");
    }
  }
  return `${out.join("\n").trimEnd()}\n`;
}
