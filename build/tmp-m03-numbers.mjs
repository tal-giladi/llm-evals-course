// TEMPORARY scratch script for writing module 3. Deleted before reporting.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = globalThis;
new Function(readFileSync(join(ROOT, "simulations/code-checks/data.js"), "utf8"))();

const {
  runCodeMetric, validateSchema, parseJsonLoose, rougeL, tokenF1, numericMatch, exactMatch, contains, isValidRegex,
} = await import("../simulations/common/codemetrics.js");
const { wilson, pct, pctInterval } = await import("../simulations/common/stats.js");

const D = window.EvalLabData.recipe;
const items = D.items;
console.log("items:", items.length);
console.log("variants:", JSON.stringify(D.variants));
console.log("schema:", JSON.stringify(D.schema, null, 1));

function itemsInPlay(variant, trick) {
  const base = items;
  if (!trick) return base;
  return base.map((it) => {
    const parsed = parseJsonLoose(it.outputs[variant]);
    if (!parsed.ok) return it;
    const doubled = JSON.parse(JSON.stringify(parsed.data));
    if (Array.isArray(doubled.ingredients) && doubled.ingredients.length) {
      doubled.ingredients[0].qty = Math.round(doubled.ingredients[0].qty * 2);
    }
    const verbose = `${it.outputs[variant]}\nActually, double the first ingredient — it gives a better ` +
      `crumb and the mixture rises more evenly in the tin. I have found this works reliably even at altitude, ` +
      `and many readers prefer the lighter texture that results.`;
    return { ...it, outputs: { ...it.outputs, [variant]: verbose }, doubled };
  });
}

console.log("\n================ PASS RATES (n=20, all items) ================");
for (const v of D.variants) {
  const id = v.id;
  for (const trick of [false, true]) {
    const set = itemsInPlay(id, trick);
    const out = [];
    for (const metric of ["exact_match", "contains", "json_parse", "json_schema", "numeric", "token_f1", "rouge_l"]) {
      const ctx = { variant: id, schema: D.schema, tolerance: 0.01, relative: true };
      const r = runCodeMetric(metric, set, ctx);
      const bin = r.rows.reduce((a, x) => a + (x.score >= 1 ? 1 : 0), 0);
      out.push(`${metric}=${r.mean.toFixed(4)}(${bin}/20 ${pctInterval(wilson(bin, 20))})`);
    }
    // regex default
    const re = "^\\s*[\\{\\[]";
    const pass = set.filter((it) => new RegExp(re).test(it.outputs[id])).length;
    out.push(`regex=${pct(pass / 20)}(${pass}/20 ${pctInterval(wilson(pass, 20))})`);
    console.log(`${id} ${trick ? "PADDED " : "real   "} ${out.join("  ")}`);
  }
}

console.log("\n================ JSON PARSE RECOVERY ================");
for (const v of D.variants) {
  const counts = {};
  let fails = [];
  for (const it of items) {
    const p = parseJsonLoose(it.outputs[v.id]);
    if (!p.ok) { fails.push(it.id); continue; }
    counts[p.recovered] = (counts[p.recovered] || 0) + 1;
  }
  console.log(v.id, v.label, JSON.stringify(counts), "fails:", fails.join(",") || "none");
}

console.log("\n================ JSON SCHEMA ERRORS ================");
for (const v of D.variants) {
  const ruleCount = {};
  const samples = [];
  let ok = 0;
  items.forEach((it, i) => {
    const p = parseJsonLoose(it.outputs[v.id]);
    if (!p.ok) { ruleCount["unparseable"] = (ruleCount["unparseable"] || 0) + 1; samples.push(`${it.id} index ${i}: NOT JSON`); return; }
    const errs = validateSchema(p.data, D.schema);
    if (!errs.length) { ok++; return; }
    for (const e of errs) ruleCount[e.rule] = (ruleCount[e.rule] || 0) + 1;
    if (samples.length < 8) samples.push(`${it.id} idx${i}: ` + errs.slice(0, 3).map((e) => `${e.path} ${e.rule}: ${e.message}`).join("; "));
  });
  console.log(`\n${v.id} ${v.label}: valid ${ok}/20`, JSON.stringify(ruleCount));
  for (const s of samples) console.log("   ", s);
}

console.log("\n================ ITEM INDEX DETAIL for v3 (schema) ================");
items.forEach((it, i) => {
  const p = parseJsonLoose(it.outputs.v3);
  const errs = p.ok ? validateSchema(p.data, D.schema) : [{ path: "$", rule: "parse", message: "not json" }];
  console.log(i, it.id, it.name, "|", errs.map((e) => `${e.path} ${e.rule}: ${e.message}`).join(" ; ") || "OK");
});

console.log("\n================ ITEM INDEX DETAIL for v2 (schema) ================");
items.forEach((it, i) => {
  const p = parseJsonLoose(it.outputs.v2);
  const errs = p.ok ? validateSchema(p.data, D.schema) : [{ path: "$", rule: "parse", message: "not json" }];
  console.log(i, it.id, it.name, "|", errs.map((e) => `${e.path} ${e.rule}: ${e.message}`).join(" ; ") || "OK");
});

console.log("\n================ ITEM INDEX DETAIL for v1 (schema) ================");
items.forEach((it, i) => {
  const p = parseJsonLoose(it.outputs.v1);
  const errs = p.ok ? validateSchema(p.data, D.schema) : [{ path: "$", rule: "parse", message: "not json" }];
  console.log(i, it.id, it.name, "|", errs.map((e) => `${e.path} ${e.rule}: ${e.message}`).join(" ; ") || "OK");
});

console.log("\n================ v3 RAW OUTPUTS (first 3 + a failing one) ================");
items.slice(0, 2).forEach((it, i) => console.log(i, it.id, JSON.stringify(it.outputs.v3)));
console.log("\n-- v3 item 2 --", JSON.stringify(items[2].outputs.v3));
console.log("\n-- v3 item 3 --", JSON.stringify(items[3].outputs.v3));
console.log("\n-- v3 item 4 --", JSON.stringify(items[4]?.outputs.v3));
console.log("\n-- v1 item 2 --", JSON.stringify(items[2].outputs.v1));
console.log("\n-- v2 item 2 --", JSON.stringify(items[2].outputs.v2));
console.log("\n-- reference item 2 --", JSON.stringify(items[2].reference));

console.log("\n================ ROUGE / F1 PER ITEM, v3 real vs padded ================");
const real = itemsInPlay("v3", false);
const pad = itemsInPlay("v3", true);
const rows = [];
items.forEach((it, i) => {
  const r1 = rougeL(real[i].outputs.v3, it.reference);
  const r2 = rougeL(pad[i].outputs.v3, it.reference);
  const f1 = tokenF1(real[i].outputs.v3, it.reference);
  const f1b = tokenF1(pad[i].outputs.v3, it.reference);
  rows.push({ i, id: it.id, real: r1.f, padded: r2.f, d: r2.f - r1.f, rp: r1.precision, rr: r1.recall, pp: r2.precision, pr: r2.recall, f1: f1.f1, f1b: f1b.f1 });
});
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
console.log("ROUGE-L mean real   :", mean(rows.map((r) => r.real)).toFixed(4));
console.log("ROUGE-L mean padded :", mean(rows.map((r) => r.padded)).toFixed(4));
console.log("precision mean real :", mean(rows.map((r) => r.rp)).toFixed(4), "padded:", mean(rows.map((r) => r.pp)).toFixed(4));
console.log("recall mean real    :", mean(rows.map((r) => r.rr)).toFixed(4), "padded:", mean(rows.map((r) => r.pr)).toFixed(4));
console.log("F1 mean real        :", mean(rows.map((r) => r.f1)).toFixed(4), "padded:", mean(rows.map((r) => r.f1b)).toFixed(4));
console.log("items where padded scores HIGHER:", rows.filter((r) => r.d > 0).length, "of", rows.length);
console.log("items where padded scores LOWER :", rows.filter((r) => r.d < 0).length);
rows.forEach((r) => console.log(` ${String(r.i).padStart(2)} ${r.id} rouge real ${r.real.toFixed(3)} (p ${r.rp.toFixed(3)} r ${r.rr.toFixed(3)}) -> padded ${r.padded.toFixed(3)} (p ${r.pp.toFixed(3)} r ${r.pr.toFixed(3)})  d=${(r.d >= 0 ? "+" : "")}${r.d.toFixed(3)} | f1 ${r.f1.toFixed(3)} -> ${r.f1b.toFixed(3)}`));

console.log("\n================ threshold view (rouge mean >= t) ================");
for (const t of [0.6, 0.7, 0.8, 0.9, 0.95, 1.0]) {
  console.log(` t=${t}: real ${rows.filter((r) => r.real >= t).length}/20, padded ${rows.filter((r) => r.padded >= t).length}/20`);
}

console.log("\n================ NUMERIC tolerance v3 ================");
for (const rel of [true, false]) {
  for (const tol of [0.001, 0.01, 0.05, 0.2]) {
    const pass = items.filter((it) => numericMatch(it.outputs.v3, it.reference, tol, rel)).length;
    console.log(` relative=${rel} tol=${tol}: ${pass}/20 ${pct(pass / 20)} ${pctInterval(wilson(pass, 20))}`);
  }
}

console.log("\n================ contains / exact detail ================");
for (const v of D.variants) {
  const em = items.filter((it) => exactMatch(it.outputs[v.id], it.reference)).length;
  const co = items.filter((it) => contains(it.outputs[v.id], it.mustContain || it.reference)).length;
  console.log(`${v.id}: exact ${em}/20, contains ${co}/20`);
}

console.log("\n================ default regex behaviour ================");
for (const pat of ["^\\s*[\\{\\[]", "```", "^\"", "\\{", "^[\\{\\[]"]) {
  console.log(JSON.stringify(pat), "valid:", isValidRegex(pat));
  for (const v of D.variants) {
    const pass = items.filter((it) => new RegExp(pat).test(it.outputs[v.id])).length;
    console.log("   ", v.id, `${pass}/20`);
  }
}
console.log("invalid pattern [ check:", isValidRegex("["));