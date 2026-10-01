// TEMPORARY scratch script #2 for module 3. Deleted before reporting.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = globalThis;
new Function(readFileSync(join(ROOT, "simulations/code-checks/data.js"), "utf8"))();

const { validateSchema, parseJsonLoose, rougeL, tokenF1, numericMatch, exactMatch } =
  await import("../simulations/common/codemetrics.js");
const { wilson, pct, pctInterval } = await import("../simulations/common/stats.js");

const D = window.EvalLabData.recipe;
const items = D.items;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log("=== 1. deep equality after lenient parse ===");
for (const v of D.variants) {
  let parse = 0, deep = 0, parsedButDifferent = [];
  for (const it of items) {
    const p = parseJsonLoose(it.outputs[v.id]);
    if (!p.ok) continue;
    parse++;
    if (eq(p.data, JSON.parse(it.reference))) deep++;
    else parsedButDifferent.push(it.id);
  }
  console.log(v.id, v.label, `parses ${parse}/20, deep-equal to reference ${deep}/20, parsed-but-different: ${parsedButDifferent.join(",") || "none"}`);
}

console.log("\n=== 2. v2 exact match: raw vs fence-stripped vs deep ===");
let raw = 0, stripped = 0;
for (const it of items) {
  if (exactMatch(it.outputs.v2, it.reference)) raw++;
  const p = parseJsonLoose(it.outputs.v2);
  if (p.ok && eq(p.data, JSON.parse(it.reference))) stripped++;
}
console.log(`raw string exact match ${raw}/20; after parse ${stripped}/20`);

console.log("\n=== 3. why do 4 v3 items fail to parse? ===");
for (const id of ["r01", "r03", "r07", "r08"]) {
  const it = items.find((x) => x.id === id);
  const out = it.outputs.v3;
  const p = parseJsonLoose(out);
  console.log(`${id}: ok=${p.ok} tail=${JSON.stringify(out.slice(-120))}`);
  try { JSON.parse(out); } catch (e) { console.log(`   JSON.parse error: ${e.message}`); }
  // repair the trailing comma and retry
  const repaired = out.replace(/,\s*("notes")/g, ' $1');
  const q = parseJsonLoose(repaired);
  if (q.ok) {
    const errs = validateSchema(q.data, D.schema);
    console.log(`   repaired-parses=${q.ok} recovered=${q.recovered} schema errors: ${errs.map((e) => `${e.path} ${e.rule}: ${e.message}`).join(" | ") || "none"}`);
  } else console.log("   still unparseable after repair");
}

console.log("\n=== 4. schema error strings on a real item, edited ===");
const r04 = items.find((x) => x.id === "r04");
const base = JSON.parse(r04.reference);
const clone = () => JSON.parse(JSON.stringify(base));
let d1 = clone(); delete d1.ingredients[0].unit;
let d2 = clone(); d2.ingredients[0].qty = "700 g";
let d3 = clone(); d3.prep_minutes = 900;
let d4 = clone(); d4.tags = [];
let d5 = clone(); d5.difficulty = "hard";
let d6 = clone(); d6.steps = "Mix flour";
let d7 = clone(); delete d7.ingredients[0];
let d8 = clone(); d8.oven_celsius = "180C";
for (const [label, obj] of [["missing unit in ingredients[0]", d1], ["qty as a string", d2], ["prep 900 > maximum 600", d3], ["tags empty", d4], ["extra top-level key", d5], ["steps not an array", d6], ["first ingredient deleted", d7], ["oven_celsius a string", d8]]) {
  const errs = validateSchema(obj, D.schema);
  console.log(`${label}: ${errs.map((e) => `${e.path} ${e.rule}: ${e.message}`).join(" ; ") || "NO ERRORS"}`);
}

console.log("\n=== 5. numeric metric: what is it actually comparing? ===");
const it0 = items[0];
console.log("Number(v3 output of r01) =", Number(it0.outputs.v3), "isFinite:", Number.isFinite(Number(it0.outputs.v3)));
console.log("Number(reference) =", Number(it0.reference), "isFinite:", Number.isFinite(Number(it0.reference)));
console.log("numericMatch ->", numericMatch(it0.outputs.v1, it0.reference, 0.2, true));
console.log("numericMatch('230', '230', 0.01, true) ->", numericMatch("230", "230", 0.01, true));
console.log("180 F in K:", (180 - 32) * 5 / 9, "K =", ((180 - 32) * 5 / 9 + 273.15).toFixed(2));
console.log("  absolute gap 350 - 180 =", 350 - 180);
console.log("  relative gap on 350 K:", ((350 - 180) / 350).toFixed(4));

console.log("\n=== 6. r02: the same answer with and without its chat wrapper ===");
const r02 = items.find((x) => x.id === "r02");
const withChat = r02.outputs.v3;
const bare = withChat.match(/\{[\s\S]*\}/)[0];
for (const [label, s] of [["with chat wrapper", withChat], ["json only", bare]]) {
  const r = rougeL(s, r02.reference);
  const f = tokenF1(s, r02.reference);
  console.log(`${label}: ROUGE-L f=${r.f.toFixed(3)} lcs=${r.lcs} p=${r.precision.toFixed(3)} r=${r.recall.toFixed(3)} | F1=${f.f1.toFixed(3)} p=${f.precision.toFixed(3)} r=${f.recall.toFixed(3)} | tokens=${s.length}`);
}

console.log("\n=== 7. threshold sweep, ROUGE-L, variant C (v3) ===");
const scores = items.map((it) => rougeL(it.outputs.v3, it.reference));
const bad = ["r01", "r03", "r07", "r08"];
for (const t of [0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0]) {
  const passIdx = scores.map((s, i) => (s.f >= t ? i : -1)).filter((i) => i >= 0);
  const passBad = passIdx.filter((i) => bad.includes(items[i].id)).map((i) => items[i].id);
  console.log(`t=${t}: ${passIdx.length}/20 pass; unparseable ones passing: ${passBad.length ? passBad.join(",") : "none"}`);
}
console.log("unparseable items' ROUGE-L:", bad.map((id) => `${id}=${rougeL(items.find((x) => x.id === id).outputs.v3, items.find((x) => x.id === id).reference).f.toFixed(3)}`).join(" "));

console.log("\n=== 8. Wilson intervals I might quote ===");
for (const [s, n] of [[20, 20], [16, 20], [15, 20], [9, 20], [4, 20], [1, 20], [0, 20]]) {
  console.log(`${s}/${n} = ${pct(s / n)} (${pctInterval(wilson(s, n))})`);
}

console.log("\n=== 9. exact display text for a v3 failing item (detailFor) ===");
for (const id of bad) {
  const it = items.find((x) => x.id === id);
  const p = parseJsonLoose(it.outputs.v3);
  console.log(`${id}: parsed.ok=${p.ok} -> detail "Output is not JSON at all." ; rouge ${rougeL(it.outputs.v3, it.reference).f.toFixed(2)}`);
}

console.log("\n=== 10. contains metric: what needle does it use? ===");
console.log("r09 mustContain:", JSON.stringify(items[8].mustContain), "| name:", JSON.stringify(items[8].name));
console.log("sample mustContain values:", items.slice(0, 6).map((i) => JSON.stringify(i.mustContain)).join(", "));

console.log("\n=== 11. does the padded output really carry a doubled number? ===");
const v3item = items[3];
const parsed = parseJsonLoose(v3item.outputs.v3);
const doubled = JSON.parse(JSON.stringify(parsed.data));
doubled.ingredients[0].qty = Math.round(doubled.ingredients[0].qty * 2);
const verbose = `${v3item.outputs.v3}\nActually, double the first ingredient — it gives a better crumb and the mixture rises more evenly in the tin. I have found this works reliably even at altitude, and many readers prefer the lighter texture that results.`;
console.log("reference qty[0] =", parsed.data.ingredients[0].qty, "| doubled object qty[0] =", doubled.ingredients[0].qty);
console.log("does the padded TEXT contain the doubled number?", verbose.includes(String(doubled.ingredients[0].qty)));
console.log("padded text mentions doubling? ", verbose.includes("double the first ingredient"));

console.log("\n=== 12. filler token overlap with the reference ===");
const filler = "Actually, double the first ingredient it gives a better crumb and the mixture rises more evenly in the tin I have found this works reliably even at altitude and many readers prefer the lighter texture that results";
const fillerTokens = filler.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter(Boolean);
const refTokens = new Set(r04.reference.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter(Boolean));
const shared = fillerTokens.filter((t) => refTokens.has(t));
console.log(`filler tokens ${fillerTokens.length}, shared with r04 reference: ${shared.length} [${shared.join(",")}]`);

console.log("\n=== 13. per-variant summary table ===");
for (const v of D.variants) {
  const set = items;
  const em = set.filter((i) => exactMatch(i.outputs[v.id], i.reference)).length;
  const jp = set.filter((i) => parseJsonLoose(i.outputs[v.id]).ok).length;
  const js = set.filter((i) => { const p = parseJsonLoose(i.outputs[v.id]); return p.ok && validateSchema(p.data, D.schema).length === 0; }).length;
  const co = set.filter((i) => (i.outputs[v.id].toLowerCase().includes((i.mustContain || i.reference).toLowerCase()))).length;
  const rl = set.reduce((a, i) => a + rougeL(i.outputs[v.id], i.reference).f, 0) / 20;
  const prec = set.reduce((a, i) => a + rougeL(i.outputs[v.id], i.reference).precision, 0) / 20;
  const rec = set.reduce((a, i) => a + rougeL(i.outputs[v.id], i.reference).recall, 0) / 20;
  console.log(`${v.id} ${v.label}: exact ${em}/20, contains ${co}/20, json_parse ${jp}/20, json_schema ${js}/20, rouge ${rl.toFixed(3)} (p ${prec.toFixed(3)} r ${rec.toFixed(3)})`);
}