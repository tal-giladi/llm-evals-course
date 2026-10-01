// Throwaway part 3: correct-proportional stratified sampler, per-slice TNR, 04.1/04.4 cases.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
new Function("window", readFileSync(join(ROOT, "simulations/judge-lab/data.js"), "utf8"))(win);
const D = win.EvalLabData.support;
const S = await import(pathToFileURL(join(ROOT, "simulations/common/stats.js")).href);
const { wilson, sampleItems, mulberry32, confusion, tnr, tpr, cohensKappa } = S;

const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";
const pctI = (ci) => `${pct(ci.lo)}-${pct(ci.hi)}`;
const ALL = D.items.map((_, i) => i);
console.log("runs shape:", JSON.stringify(D.runs).slice(0, 400));
console.log("cost:", JSON.stringify(D.cost));

/* ---- a CORRECT proportional stratified sampler, by slice.intent ---- */
function propStratified(size, seed) {
  const rng = mulberry32(seed);
  const by = new Map();
  ALL.forEach((i) => {
    const k = D.items[i].slice.intent;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(i);
  });
  const keys = [...by.keys()].sort();
  const quotas = keys.map((k) => {
    const share = (by.get(k).length / ALL.length) * size;
    const take = Math.min(by.get(k).length, Math.floor(share));
    return { k, bucket: by.get(k).slice(), take, frac: share - Math.floor(share) };
  });
  let remaining = size - quotas.reduce((a, q) => a + q.take, 0);
  quotas.sort((a, b) => b.frac - a.frac);
  for (const q of quotas) {
    if (remaining <= 0) break;
    const extra = Math.min(remaining, q.bucket.length - q.take);
    q.take += extra; remaining -= extra;
  }
  const out = [];
  for (const q of quotas) {
    const b = q.bucket;
    for (let i = b.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      [b[i], b[j]] = [b[j], b[i]];
    }
    out.push(...b.slice(0, q.take));
  }
  return out.sort((a, b) => a - b);
}

console.log("\n=== CORRECT proportional stratified, n=20, 200 seeds ===");
{
  let missFail = 0, exc0f = 0, oos0f = 0, any0 = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const idx = propStratified(20, seed);
    const drawn = new Set(idx);
    const fails = new Map();
    for (const i of idx) {
      const k = D.items[i].slice.intent;
      if (D.items[i].human.v1.label === 0) fails.set(k, (fails.get(k) || 0) + 1);
    }
    if ([...fails.keys()].length < 5) missFail++;
    if (!fails.get("exception")) exc0f++;
    if (!fails.get("out_of_scope")) oos0f++;
    const drawnKeys = new Set(idx.map((i) => D.items[i].slice.intent));
    if (drawnKeys.size < 5) any0++;
  }
  console.log(`  a slice with no failing item: ${missFail}/200 | exception no-fail ${exc0f}/200 | out_of_scope no-fail ${oos0f}/200 | a slice never drawn ${any0}/200`);
}

console.log("\n=== CORRECT proportional stratified, quotas at n=20 ===");
{
  const by = new Map();
  ALL.forEach((i) => {
    const k = D.items[i].slice.intent;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(i);
  });
  for (const n of [20, 30, 40, 57, 94]) {
    const shares = [...by].map(([k, b]) => `${k} ${((b.length / 94) * n).toFixed(2)}`).join("  ");
    console.log(`  n=${String(n).padStart(2)}: ${shares}`);
  }
}

/* ---- per-slice TNR from a recorded judge run ---- */
console.log("\n=== runs ===");
const runKeys = Object.keys(D.runs);
console.log("  run ids:", runKeys.join(", "));
const sampleRun = D.runs[runKeys[0]];
console.log("  shape of", runKeys[0], ":", Array.isArray(sampleRun) ? `array len ${sampleRun.length}, first=${JSON.stringify(sampleRun[0]).slice(0, 200)}` : typeof sampleRun);

if (Array.isArray(sampleRun) && sampleRun.length === 94) {
  for (const rid of runKeys) {
    const r = D.runs[rid];
    const pairs = ALL.map((i) => ({ human: D.items[i].human.v1.label, judge: r[i] }));
    const c = confusion(pairs);
    console.log(`\n  ${rid}: pass ${c.tp + c.fp}/${pairs.length} TPR ${pct(tpr(c))} TNR ${pct(tnr(c))} kappa ${cohensKappa(c).toFixed(2)}`);
    const by = new Map();
    for (const i of ALL) {
      const k = D.items[i].slice.intent;
      if (!by.has(k)) by.set(k, []);
      by.get(k).push({ human: D.items[i].human.v1.label, judge: r[i] });
    }
    for (const [k, ps] of by) {
      const cc = confusion(ps);
      console.log(`      ${k.padEnd(14)} n=${String(cc.n).padStart(2)} humanFail=${cc.tn + cc.fp} judgeCaught=${cc.tn} TNR ${tnr(cc) === null ? "undefined" : pct(tnr(cc))}  judgeMissed=${cc.fp}`);
    }
  }
}

/* ---- 04.1: category -> how many items to measure it ---- */
console.log("\n=== 04.1 allocation ===");
const cat = new Map();
for (const it of D.items) {
  const c = it.human.v1.category;
  if (!cat.has(c)) cat.set(c, { n: 0, ids: [], intents: new Map() });
  const x = cat.get(c); x.n++; x.ids.push(it.id);
  x.intents.set(it.slice.intent, (x.intents.get(it.slice.intent) || 0) + 1);
}
for (const [k, x] of [...cat].sort((a, b) => b[1].n - a[1].n)) {
  console.log(`  ${k.padEnd(14)} n=${String(x.n).padStart(2)}  ${[...x.intents].sort().map(([a, b]) => `${a}=${b}`).join(" ")}`);
}
// worst case: if you take n items of a category, the interval on its pass rate
console.log("\n  width of a Wilson interval on a slice's pass rate, by items taken:");
for (const n of [2, 3, 5, 8, 12, 20]) {
  const rows = [];
  for (const ph of [0.0, 0.5, 1.0]) {
    const p = Math.round(ph * n);
    const ci = wilson(p, n);
    rows.push(`${p}/${n}=${pct(ci.point)} [${pct(ci.lo)},${pct(ci.hi)}] w=${Math.round((ci.hi - ci.lo) * 100)}`);
  }
  console.log(`    n=${String(n).padStart(2)}: ${rows.join("   ")}`);
}
console.log("\n  TNR measurable only with enough failing items: if a slice has m failing items,");
console.log("  the TNR of a judge that catches all m is 1.0 and one that catches 0 is 0.0 —");
for (const m of [1, 2, 3, 5, 10]) {
  const ci = wilson(m, m);
  console.log(`    m=${String(m).padStart(2)} caught: ${pct(ci.point)} [${pct(ci.lo)}, ${pct(ci.hi)}]`);
}

/* ---- 04.4: can you detect a change ---- */
console.log("\n=== 04.4 detect-a-change ===");
for (const [n, a, b] of [[20, 8, 10], [20, 8, 12], [40, 21, 24], [57, 30, 34], [94, 47, 53], [94, 47, 56], [94, 47, 50]]) {
  const ca = wilson(a, n), cb = wilson(b, n);
  console.log(`  n=${String(n).padStart(2)}: ${a}/${n} ${pct(ca.point)} [${pct(ca.lo)},${pct(ca.hi)}] vs ${b}/${n} ${pct(cb.point)} [${pct(cb.lo)},${pct(cb.hi)}] overlap=${cb.lo <= ca.hi && ca.lo <= cb.hi}`);
}
console.log("\n  n needed for a target half-width at p=0.5:");
for (const target of [20, 15, 12, 10, 8, 5]) {
  let n = 2;
  while (Math.round((wilson(n / 2, n).hi - wilson(n / 2, n).lo) * 100) > target && n < 200000) n += 1;
  const ci = wilson(Math.round(n / 2), n);
  console.log(`    full width <= ${target} pts: n=${n} -> ${pct(ci.point)} [${pct(ci.lo)}, ${pct(ci.hi)}] width ${Math.round((ci.hi - ci.lo) * 100)}`);
}
console.log("\n  same, at p=0.9 (pass rate near 1):");
for (const target of [15, 10, 5]) {
  let n = 2;
  while (Math.round((wilson(Math.round(n * 0.9), n).hi - wilson(Math.round(n * 0.9), n).lo) * 100) > target && n < 200000) n += 1;
  const p = Math.round(n * 0.9);
  const ci = wilson(p, n);
  console.log(`    full width <= ${target} pts: n=${n} -> ${p}/${n}=${pct(ci.point)} [${pct(ci.lo)}, ${pct(ci.hi)}] width ${Math.round((ci.hi - ci.lo) * 100)}`);
}

console.log("\n=== seed sweep at n=20 for the lesson's seed table ===");
for (const seed of [1, 2, 3, 10, 11, 12, 25, 50, 100, 200]) {
  const idx = sampleItems(ALL, 20, "random", seed);
  const p = idx.filter((i) => D.items[i].human.v1.label === 1).length;
  const ci = wilson(p, 20);
  console.log(`  seed ${String(seed).padStart(3)}: ${p}/20 = ${pct(ci.point)} [${pct(ci.lo)}, ${pct(ci.hi)}] width ${Math.round((ci.hi - ci.lo) * 100)} pts`);
}

console.log("\n=== dev vs test, small slices ===");
const devRows = D.dev_ids.map((id) => D.items.find((i) => i.id === id)).filter(Boolean);
const testRows = D.items.filter((i) => D.test_ids.includes(i.id));
for (const [nm, rows] of [["dev", devRows], ["test", testRows]]) {
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.slice.intent)) by.set(r.slice.intent, []);
    by.get(r.slice.intent).push(r);
  }
  for (const [k, rs] of by) {
    const p = rs.filter((r) => r.human.v1.label === 1).length;
    const ci = wilson(p, rs.length);
    console.log(`  ${nm} ${k.padEnd(14)} ${p}/${rs.length} = ${pct(ci.point)} [${pct(ci.lo)}, ${pct(ci.hi)}] width ${Math.round((ci.hi - ci.lo) * 100)}`);
  }
}
