// Quiz YAML repair.
//
// A plain YAML scalar cannot contain ": " or " #". Agents writing long quiz
// options hit this constantly, and the failure is silent on import: a quiz
// file that does not parse is dropped whole, taking every question with it.
//
// This rewrites any offending plain scalar into a `>-` block scalar, which
// can contain colons safely. It only changes quoting, never wording.
//
// Run:  node build/fix-quiz-yaml.mjs

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire("C:/Users/TalGiladi/OneDrive/repos/tals-academy/package.json");
const yaml = require("js-yaml");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.quiz\.yaml$/.test(entry)) out.push(full);
  }
  return out;
}

// A plain scalar is unsafe if it contains ": " or " #", or ends with ":".
function unsafe(text) {
  return /:\s/.test(text) || /\s#/.test(text) || /:$/.test(text.trim());
}

function fixFile(path) {
  const before = readFileSync(path, "utf8");
  const lines = before.split(/\r?\n/);
  const out = [];
  let changed = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    // Match: indent, optional "- ", optional "key: ", value
    const m = line.match(/^(\s*)(- )?([A-Za-z_][\w.-]*:\s+)?(\S.*)$/);
    if (!m) { out.push(line); i++; continue; }

    const [, indent, dash, keyPart, firstValue] = m;
    // A block scalar, a flow collection or an already-quoted value is fine.
    if (/^[>|[\]{}"']/.test(firstValue) || keyPart === undefined && dash === undefined) {
      out.push(line); i++; continue;
    }
    if (!unsafe(firstValue)) { out.push(line); i++; continue; }

    // Gather continuation lines: more indented, and not the start of a new
    // list item or mapping key.
    const cont = [];
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j];
      if (next.trim() === "") break;
      const nm = next.match(/^(\s*)(\S.*)$/);
      if (!nm) break;
      if (nm[1].length <= indent.length) break;      // dedented: stop
      if (/^-\s/.test(nm[2]) || /^[A-Za-z_][\w.-]*:\s/.test(nm[2])) break;
      cont.push(nm[2]);
      j++;
    }

    const body = [firstValue, ...cont];
    out.push(`${indent}${dash || ""}${dash ? "" : ""}${dash ? "" : ""}`.trimEnd() + (dash ? "" : ""));
    // Rebuild the line with a block scalar header.
    out[out.length - 1] = `${indent}${dash || ""}${dash ? "" : keyPart || ""}>-`;
    if (!dash) {
      // "key: >-" form
      out[out.length - 1] = `${indent}${keyPart}>-`;
    }
    const childIndent = `${indent}  `;
    for (const c of body) out.push(`${childIndent}${c}`);
    changed++;
    i = j;
  }

  const after = out.join("\n");
  if (after === before) return false;

  // Only write it back if it now parses and the *structure* is sound.
  // Exact string comparison is too strict: folding a multi-line plain scalar
  // into a block scalar normalises its whitespace, which is harmless.
  //
  // When the original does not parse there is no "before" data to compare
  // against — which is the common case here — so fall back to checking that
  // the result is a well-formed quiz instead.
  let newData;
  try { newData = yaml.load(after); }
  catch (e) {
    console.log(`  SKIP ${path.replace(ROOT + "\\", "")}: repair did not parse (${e.message.split("\n")[0]})`);
    return false;
  }
  const wellFormed = Array.isArray(newData) && newData.length > 0 && newData.every(
    (q) => q && q.id && Array.isArray(q.options) && q.options.length === 4 &&
           Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3 && q.explanation
  );
  if (!wellFormed) {
    console.log(`  SKIP ${path.replace(ROOT + "\\", "")}: repair did not produce a well-formed quiz`);
    return false;
  }

  let oldData = null;
  try { oldData = yaml.load(before); } catch { oldData = null; }
  if (oldData) {
    const shape = (d) => JSON.stringify(d.map((q) => ({
      id: q.id,
      correct: q.correct,
      n: q.options.length,
      optText: q.options.map((o) => String(o).replace(/\s+/g, " ").trim()),
      q: String(q.question || "").replace(/\s+/g, " ").trim(),
      e: String(q.explanation || "").replace(/\s+/g, " ").trim(),
    })));
    if (shape(oldData) !== shape(newData)) {
      console.log(`  SKIP ${path.replace(ROOT + "\\", "")}: repair changed the data, not just the quoting`);
      return false;
    }
  }
  writeFileSync(path, after, "utf8");
  return true;
}

let fixed = 0;
for (const f of walk(join(ROOT, "lessons")).concat(walk(join(ROOT, "assessments")))) {
  let parsed = true;
  try { yaml.load(readFileSync(f, "utf8")); } catch { parsed = false; }
  if (parsed) continue;
  if (fixFile(f)) { console.log(`  fixed ${f.replace(ROOT + "\\", "")}`); fixed++; }
  else console.log(`  UNFIXED ${f.replace(ROOT + "\\", "")}`);
}
console.log(fixed ? `\nRepaired ${fixed} quiz file(s).\n` : "\nNothing to repair.\n");