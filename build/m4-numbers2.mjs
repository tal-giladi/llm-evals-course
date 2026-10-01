// Throwaway part 2: slice panel across sizes/strategies, dev/test, Wilson by hand.
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
const ALL = D.items.map((_, i) => i);

function panel(strategy, n, seed) {
  const idx = sampleItems(ALL, n, strategy, seed);
  const drawn = new Set(idx);
  const t = new Map();
  for (let i = 0; i < ALL.length; i++) {
    const k = D.items[i].slice.intent;
    if (!t.has(k)) t.set(k, { total: 0, drawn: 0, failures: 0, ids: [] });
    const s = t.get(k); s.total++;
    if (drawn.has(i)) { s.drawn++; s.ids.push(D.items[i].id); if (D.items[i].human.v1.label === 0) s.failures++; }
  }
  const missFail = [...t].filter(([, s]) => s.failures === 0).map(([k]) => k);
  const missDraw = [...t].filter(([, s]) => s.drawn === 0).map(([k]) => k);
  const p = idx.filter((i) => D.items[i].human.v1.label === 1).length;
  const ci = wilson(p, idx.length);
  return { idx, t, missFail, missDraw, p, ci };
}

console.log("=== stratified draw indices, seed 11 ===");
for (const n of [10, 20, 30, 57]) {
  const idx = sampleItems(ALL, n, "stratified", 11);
  console.log(`  n=${n}: [${idx.slice(0, 12).join(",")}${n > 12 ? ",..." : ""}] max=${Math.max(...idx)} isFirstN=${idx.every((v, j) => v === j)}`);
}

console.log("\n=== slice panel, seed 11, by strategy and size ===");
for (const strategy of ["random", "stratified"]) {
  for (const n of [10, 20, 30, 40, 50, 57, 60, 70, 80, 94]) {
    const r = panel(strategy, n, 11);
    const drawnTxt = [...r.t].map(([k, s]) => `${k}:${s.drawn}`).join(" ");
    const failTxt = [...r.t].map(([k, s]) => `${k}:${s.failures}`).join(" ");
    console.log(`  ${strategy.padEnd(10)} n=${String(n).padStart(2)} ${pct(r.ci.point).padStart(6)} ${pctI(r.ci).padEnd(18)} drawn {${drawnTxt}} fail {${failTxt}}`);
    console.log(`      no-fail slices: ${r.missFail.length ? r.missFail.join(", ") : "none"} | never drawn: ${r.missDraw.length ? r.missDraw.join(", ") : "none"}`);
  }
}

console.log("\n=== seed sweep n=20 (200 seeds) ===");
for (const strategy of ["random", "stratified"]) {
  let missDraw = 0, missFail = 0, exc0 = 0, oos0 = 0, exc0f = 0, oos0f = 0;
  const passes = [];
  for (let seed = 1; seed <= 200; seed++) {
    const r = panel(strategy, 20, seed);
    if (r.missDraw.length) missDraw++;
    if (r.missFail.length) missFail++;
    if (r.t.get("exception").drawn === 0) exc0++;
    if (r.t.get("out_of_scope").drawn === 0) oos0++;
    if (r.t.get("exception").failures === 0) exc0f++;
    if (r.t.get("out_of_scope").failures === 0) oos0f++;
    passes.push(r.p);
  }
  passes.sort((a, b) => a - b);
  console.log(`  ${strategy}: seeds with >=1 slice never drawn ${missDraw}/200 | >=1 slice with no failing item ${missFail}/200`);
  console.log(`     exception drawn=0 in ${exc0}/200, exception failures=0 in ${exc0f}/200`);
  console.log(`     out_of_scope drawn=0 in ${oos0}/200, out_of_scope failures=0 in ${oos0f}/200`);
  console.log(`     pass counts: min ${passes[0]}, p25 ${passes[49]}, median ${passes[99]}, p75 ${passes[149]}, max ${passes[199]}`);
}

console.log("\n=== seed sweep n=40 (200 seeds) ===");
for (const strategy of ["random"]) {
  let missFail = 0, exc0f = 0, oos0f = 0, oos0 = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const r = panel(strategy, 40, seed);
    if (r.missFail.length) missFail++;
    if (r.t.get("exception").failures === 0) exc0f++;
    if (r.t.get("out_of_scope").failures === 0) oos0f++;
    if (r.t.get("out_of_scope").drawn === 0) oos0++;
  }
  console.log(`  random n=40: >=1 slice with no failing item ${missFail}/200 | exception failures=0 ${exc0f}/200 | oos failures=0 ${oos0f}/200 | oos never drawn ${oos0}/200`);
}

console.log("\n=== seed sweep n=57 (200 seeds) ===");
{
  let missFail = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const r = panel("random", 57, seed);
    if (r.missFail.length) missFail++;
  }
  console.log(`  random n=57: >=1 slice with no failing item ${missFail}/200`);
}

console.log("\n=== DEV / TEST, exact ===");
const devRows = D.dev_ids.map((id) => D.items.find((i) => i.id === id)).filter(Boolean);
const testRows = D.items.filter((i) => D.test_ids.includes(i.id));
for (const [name, rows] of [["Dev", devRows], ["Test", testRows]]) {
  const p = rows.filter((r) => r.human.v1.label === 1).length;
  const ci = wilson(p, rows.length);
  console.log(`  ${name}: ${rows.length} items, ${p} pass = ${pct(ci.point)}, CI ${pctI(ci)}, width ${Math.round((ci.hi - ci.lo) * 100)} pts`);
  const d = new Map(), s = new Map(), c = new Map();
  for (const r of rows) {
    d.set(r.slice.difficulty, (d.get(r.slice.difficulty) || 0) + 1);
    s.set(r.slice.intent, (s.get(r.slice.intent) || 0) + 1);
    const k = r.human.v1.category; c.set(k, (c.get(k) || 0) + 1);
  }
  console.log("     difficulty:", [...d].sort().map(([k, v]) => `${k} ${v}`).join(" / "));
  console.log("     intent:", [...s].sort().map(([k, v]) => `${k} ${v}`).join(" / "));
  console.log("     v1 category:", [...c].sort().map(([k, v]) => `${k} ${v}`).join(" / "));
  // per-slice pass
  const ps = new Map();
  for (const r of rows) {
    if (!ps.has(r.slice.intent)) ps.set(r.slice.intent, { n: 0, p: 0 });
    const x = ps.get(r.slice.intent); x.n++; if (r.human.v1.label === 1) x.p++;
  }
  for (const [k, x] of [...ps].sort()) console.log(`     slice ${k}: ${x.p}/${x.n}`);
}

console.log("\n=== population slice pass rates (v1) ===");
{
  const ps = new Map();
  for (const r of D.items) {
    if (!ps.has(r.slice.intent)) ps.set(r.slice.intent, { n: 0, p: 0 });
    const x = ps.get(r.slice.intent); x.n++; if (r.human.v1.label === 1) x.p++;
  }
  for (const [k, x] of [...ps].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${k.padEnd(14)} ${x.p}/${x.n} = ${pct(x.p / x.n)}  CI ${pctI(wilson(x.p, x.n))}`);
}

console.log("\n=== category x intent, population, v1 ===");
{
  const t = new Map();
  for (const r of D.items) {
    const k = r.human.v1.category;
    if (!t.has(k)) t.set(k, { n: 0, intents: new Set(), ids: [] });
    const x = t.get(k); x.n++; x.intents.add(r.slice.intent); x.ids.push(r.id);
  }
  for (const [k, x] of [...t].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  ${k.padEnd(14)} n=${String(x.n).padStart(2)}  intents=${[...x.intents].sort().join("/")}`);
    console.log(`      ids: ${x.ids.join(" ")}`);
  }
}

console.log("\n=== Wilson by hand, the cases lessons will use ===");
for (const [p, n] of [[8, 20], [10, 20], [17, 37], [30, 57], [21, 40], [47, 94], [10, 20], [19, 20], [15, 20], [16, 30], [24, 57], [31, 57]]) {
  const ci = wilson(p, n);
  const z = 1.959964, z2 = z * z, ph = p / n;
  const denom = 1 + z2 / n;
  const centre = ph + z2 / (2 * n);
  const margin = z * Math.sqrt((ph * (1 - ph) + z2 / (4 * n)) / n);
  console.log(`  ${p}/${n} = ${pct(ph)}: centre=${centre.toFixed(4)} margin=${margin.toFixed(4)} denom=${denom.toFixed(4)} -> [${pct(ci.lo)}, ${pct(ci.hi)}] width ${Math.round((ci.hi - ci.lo) * 100)} pts`);
}

console.log("\n=== interval width vs n at a FIXED rate (50%) ===");
for (const n of [10, 20, 30, 40, 60, 80, 94, 160, 320, 376]) {
  const ci = wilson(Math.round(n * 0.5), n);
  console.log(`  n=${String(n).padStart(3)}: ${pct(ci.point)} [${pct(ci.lo)}, ${pct(ci.hi)}] width ${Math.round((ci.hi - ci.lo) * 100)} pts`);
}
