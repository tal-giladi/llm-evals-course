// Throwaway: replicate exactly what simulations/eval-set/app.js computes.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
new Function("window", readFileSync(join(ROOT, "simulations/judge-lab/data.js"), "utf8"))(win);
const D = win.EvalLabData.support;
const { wilson, sampleItems } = await import(pathToFileURL(join(ROOT, "simulations/common/stats.js")).href);

const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";
const pctI = (ci) => `${pct(ci.lo)}-${pct(ci.hi)}`;
const rateOver = (indices) => {
  const pass = indices.filter((i) => D.items[i].human.v1.label === 1).length;
  return { pass, n: indices.length, ci: wilson(pass, indices.length) };
};

console.log("=== POPULATION ===");
console.log("items:", D.items.length, "dev_ids:", D.dev_ids.length, "test_ids:", D.test_ids.length);
for (const v of ["v1", "v2", "v3"]) {
  const p = D.items.filter((i) => i.human[v].label === 1).length;
  console.log(`  ${v}: ${p}/${D.items.length} = ${pct(p / D.items.length)}  CI ${pctI(wilson(p, D.items.length))}`);
}

console.log("\n=== SLICES (intent x difficulty), whole population ===");
const byIntent = new Map();
const byPair = new Map();
for (const it of D.items) {
  const k = it.slice.intent;
  if (!byIntent.has(k)) byIntent.set(k, { n: 0, f1: 0, f2: 0, f3: 0 });
  const s = byIntent.get(k);
  s.n++;
  if (it.human.v1.label === 0) s.f1++;
  if (it.human.v2.label === 0) s.f2++;
  if (it.human.v3.label === 0) s.f3++;
  const p = `${k} / ${it.slice.difficulty}`;
  byPair.set(p, (byPair.get(p) || 0) + 1);
}
for (const [k, s] of [...byIntent].sort((a, b) => b[1].n - a[1].n)) {
  console.log(`  ${k.padEnd(16)} n=${String(s.n).padStart(3)}  fails v1=${String(s.f1).padStart(3)} v2=${String(s.f2).padStart(3)} v3=${String(s.f3).padStart(3)}`);
}
console.log("  intent x difficulty counts:");
for (const [k, c] of [...byPair].sort()) console.log(`    ${k.padEnd(34)} ${c}`);

console.log("\n=== HUMAN FAILURE CATEGORY (v1, tuned system) ===");
const cat = new Map();
for (const it of D.items) {
  const c = it.human.v1.category;
  if (c === "correct") continue;
  cat.set(c, (cat.get(c) || 0) + 1);
}
for (const [k, c] of [...cat].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(18)} ${c}`);
console.log("  total failing:", [...cat.values()].reduce((a, b) => a + b, 0));

console.log("\n=== DEV / TEST ===");
const devRows = D.dev_ids.map((id) => D.items.find((i) => i.id === id)).filter(Boolean);
const testRows = D.items.filter((i) => D.test_ids.includes(i.id));
for (const [name, rows] of [["Dev", devRows], ["Test", testRows]]) {
  const r = rateOver(rows.map((_, i) => i).length ? [] : []);
  const p = rows.filter((x) => x.human.v1.label === 1).length;
  const idx = rows.map((x) => D.items.indexOf(x));
  const rr = rateOver(idx);
  console.log(`  ${name}: n=${rows.length} pass=${p} ${pct(rr.ci.point)} CI ${pctI(rr.ci)} width ${Math.round((rr.ci.hi - rr.ci.lo) * 100)} pts`);
  const s2 = new Map(); const df = new Map();
  for (const x of rows) {
    s2.set(x.slice.intent, (s2.get(x.slice.intent) || 0) + 1);
    df.set(x.slice.difficulty, (df.get(x.slice.difficulty) || 0) + 1);
  }
  console.log("     intent:", [...s2].sort().map(([k, v]) => `${k}=${v}`).join(" "));
  console.log("     difficulty:", [...df].sort().map(([k, v]) => `${k}=${v}`).join(" "));
  const c2 = new Map();
  for (const x of rows) { const k = x.human.v1.category; if (k !== "correct") c2.set(k, (c2.get(k) || 0) + 1); }
  console.log("     v1 fail categories:", [...c2].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" "));
}
console.log("  dev/test id lists:", D.dev_ids.join(" "), "|", D.test_ids.join(" "));

console.log("\n=== SIZE PANEL: random, seed 11 ===");
for (let n = 10; n <= D.items.length; n += 5) {
  const idx = sampleItems(D.items.map((_, i) => i), n, "random", 11);
  const r = rateOver(idx);
  console.log(`  n=${String(n).padStart(2)}  ${pct(r.ci.point).padStart(6)}  ${pctI(r.ci).padEnd(18)} ${Math.round((r.ci.hi - r.ci.lo) * 100)} pts`);
}

console.log("\n=== MAIN PANEL: seed 11, random ===");
for (const n of [10, 20, 30, 40, 57, 80, 94]) {
  const idx = sampleItems(D.items.map((_, i) => i), n, "random", 11);
  const r = rateOver(idx);
  console.log(`  n=${String(n).padStart(2)}  ${pct(r.ci.point)} (${r.pass}/${r.n})  CI ${pctI(r.ci)}  ${Math.round((r.ci.hi - r.ci.lo) * 100)} pts`);
}

console.log("\n=== MAIN PANEL: seed 11, stratified ===");
for (const n of [10, 20, 30, 40, 57, 80, 94]) {
  const idx = sampleItems(D.items.map((_, i) => i), n, "stratified", 11);
  const r = rateOver(idx);
  console.log(`  n=${String(n).padStart(2)}  ${pct(r.ci.point)} (${r.pass}/${r.n})  CI ${pctI(r.ci)}  ${Math.round((r.ci.hi - r.ci.lo) * 100)} pts`);
}

console.log("\n=== SEED SWEEP at n=20, random ===");
const seen = new Set();
for (let seed = 1; seed <= 200; seed++) {
  const idx = sampleItems(D.items.map((_, i) => i), 20, "random", seed);
  const r = rateOver(idx);
  seen.add(r.pass);
  if (seed <= 12) console.log(`  seed ${String(seed).padStart(3)}: ${r.pass}/20 = ${pct(r.ci.point)} CI ${pctI(r.ci)}`);
}
console.log("  distinct pass counts over seeds 1-200:", [...seen].sort((a, b) => a - b).join(","));

console.log("\n=== STRATIFICATION PANEL at n=20 seed 11 ===");
for (const strategy of ["random", "stratified"]) {
  const idx = sampleItems(D.items.map((_, i) => i), 20, strategy, 11);
  const drawn = new Set(idx);
  const t = new Map();
  for (let i = 0; i < D.items.length; i++) {
    const k = D.items[i].slice.intent;
    if (!t.has(k)) t.set(k, { total: 0, drawn: 0, failures: 0 });
    const s = t.get(k); s.total++;
    if (drawn.has(i)) { s.drawn++; if (D.items[i].human.v1.label === 0) s.failures++; }
  }
  console.log(`  strategy=${strategy}`);
  for (const [k, s] of t) console.log(`    ${k.padEnd(16)} ${s.drawn} of ${s.total}   failing ${s.failures}   ${s.failures === 0 ? "none seen" : "measured"}`);
}

console.log("\n=== WILSON BY HAND CHECKS ===");
for (const [p, n] of [[47, 94], [10, 20], [20, 20], [4, 10], [26, 94], [8, 94], [30, 57], [19, 37]]) {
  const ci = wilson(p, n);
  const z = 1.959964, z2 = z * z, ph = p / n;
  const denom = 1 + z2 / n;
  const centre = ph + z2 / (2 * n);
  const margin = z * Math.sqrt((ph * (1 - ph) + z2 / (4 * n)) / n);
  const lo = (centre - margin) / denom, hi = (centre + margin) / denom;
  console.log(`  ${p}/${n}: ${pct(ph)} [${pct(lo)}, ${pct(hi)}] width ${Math.round((hi - lo) * 100)} pts | centre ${centre.toFixed(4)} margin ${margin.toFixed(4)} denom ${denom.toFixed(4)}`);
}

console.log("\n=== SEED SWEEP at n=20 stratified, which slices lose all failures ===");
let miss = 0;
for (let seed = 1; seed <= 200; seed++) {
  const idx = sampleItems(D.items.map((_, i) => i), 20, "stratified", seed);
  const drawn = new Set(idx);
  const t = new Map();
  for (let i = 0; i < D.items.length; i++) {
    const k = D.items[i].slice.intent;
    if (!t.has(k)) t.set(k, { failures: 0 });
    if (drawn.has(i) && D.items[i].human.v1.label === 0) t.get(k).failures++;
  }
  const m = [...t].filter(([, s]) => s.failures === 0).map(([k]) => k);
  if (m.length) miss++;
}
console.log(`  stratified n=20: ${miss}/200 seeds leave at least one intent with no failing item`);
