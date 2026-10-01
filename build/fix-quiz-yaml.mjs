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
// Note this does not always make YAML *throw*: `Do not gate on it: it fails
// 6 of 6 times` parses happily as a one-key map, and the Academy then drops
// the whole question as "options must be 4 non-empty strings". So the damage
// is silent either way, which is why this runs on every file, not just the
// ones that fail to parse.
function unsafe(text) {
  return /:\s/.test(text) || /\s#/.test(text) || /:$/.test(text.trim());
}

/** Mirrors the Academy's per-question rules. */
function healthy(data) {
  return Array.isArray(data) && data.length > 0 && data.every(
    (q) => q && q.id
      && typeof q.question === "string" && q.question.trim()
      && Array.isArray(q.options) && q.options.length === 4
      && q.options.every((o) => typeof o === "string" && o.trim())
      && Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3
      && typeof q.explanation === "string" && q.explanation.trim()
  );
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
  if (!healthy(newData)) {
    console.log(`  SKIP ${path.replace(ROOT + "\\", "")}: repair did not produce a well-formed quiz`);
    return false;
  }

  // Where the original did parse, the only acceptable change is quoting: same
  // question ids, same correct indices, same option texts. An option that
  // parsed as a map has to come back as the string it was written as, so
  // compare against a reconstruction of what the author wrote.
  let oldData = null;
  try { oldData = yaml.load(before); } catch { oldData = null; }
  if (Array.isArray(oldData) && oldData.length === newData.length) {
    const norm = (v) => String(v).replace(/\s+/g, " ").trim();
    for (let i = 0; i < oldData.length; i++) {
      const o = oldData[i], n = newData[i];
      const oldOpts = (o.options || []).map((x) =>
        x && typeof x === "object" ? Object.entries(x).map(([k, val]) => `${k}: ${val}`).join(" ") : norm(x));
      if (o.id !== n.id || o.correct !== n.correct) {
        console.log(`  SKIP ${path.replace(ROOT + "\\", "")}: repair changed id or correct index`);
        return false;
      }
      if (oldOpts.length === n.options.length && oldOpts.some((t, k) => t !== norm(n.options[k]))) {
        console.log(`  SKIP ${path.replace(ROOT + "\\", "")}: repair changed option text`);
        return false;
      }
    }
  }
  writeFileSync(path, after, "utf8");
  return true;
}

let fixed = 0, failed = 0;
for (const f of walk(join(ROOT, "lessons")).concat(walk(join(ROOT, "assessments")))) {
  let data = null;
  try { data = yaml.load(readFileSync(f, "utf8")); } catch { /* needs repair */ }
  if (healthy(data)) continue;          // already fine, or a file to hand-check
  if (fixFile(f)) { console.log(`  fixed ${f.replace(ROOT + "\\", "")}`); fixed++; }
  else { console.log(`  UNFIXED ${f.replace(ROOT + "\\", "")}`); failed++; }
}
console.log(fixed || failed
  ? `\nRepaired ${fixed} quiz file(s), ${failed} still need hand repair.\n`
  : "\nNothing to repair.\n");
if (failed) process.exitCode = 1;
