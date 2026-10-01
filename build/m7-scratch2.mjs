// THROWAWAY — module 7, round 2. Deleted before reporting.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { judgeMetrics, sampleItems, majorityVote, pairedComparison, hashSeed, pct } from "../simulations/common/stats.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
new Function("window", readFileSync(join(ROOT, "simulations/judge-lab/data.js"), "utf8"))(win);
const D = win.EvalLabData.support;
const itemById = new Map(D.items.map((i) => [i.id, i]));

console.log("human keys on an item:", Object.keys(itemById.get("s01").human));
console.log("s01 human.v1padded:", JSON.stringify(itemById.get("s01").human.v1padded ?? null));
let paddedLabelMatches = 0;
for (const it of D.items) {
  if ((it.human.v1padded?.label ?? it.human.v1.label) === it.human.v1.label) paddedLabelMatches++;
}
console.log("padded human label equals v1 label on", paddedLabelMatches, "of", D.items.length, "items");

// ---- sign tests: two runs of the same judge, and the padding probe ----
console.log("\n=== SIGN TESTS (pairedComparison's exact two-sided binomial, k=0.5) ===");
function signTest(label, ids, variant, cfgA, cfgB) {
  const A = ids.map((id) => ({ human: itemById.get(id).human[variant].label, judge: D.runs[cfgA][`${id}|${variant}`][0] }));
  const B = ids.map((id) => ({ human: itemById.get(id).human[variant].label, judge: D.runs[cfgB][`${id}|${variant}`][0] }));
  const r = pairedComparison(A, B, { resamples: 1000, seed: 5 });
  console.log(label.padEnd(46), "delta", ((r.delta) * 100).toFixed(1) + " pts",
    "flips", r.fixed, "/", r.wins + r.losses, "p =", r.pValue.toFixed(4));
}
signTest("v1: same judge, two recorded runs", D.dev_ids, "v1", "c-rubric-3b", "c-rubric-3b-self");
signTest("v2: same judge, two recorded runs", D.dev_ids, "v2", "c-rubric-3b", "c-rubric-3b-self");
signTest("v3: same judge, two recorded runs", D.dev_ids, "v3", "c-rubric-3b", "c-rubric-3b-self");

// verbosity: compare v1 vs v1padded within each judge (these are different keys -> different RNG stream)
function paddingTest(label, cfg) {
  const A = D.dev_ids.map((id) => ({ human: itemById.get(id).human.v1.label, judge: D.runs[cfg][`${id}|v1`][0] }));
  const B = D.dev_ids.map((id) => ({ human: itemById.get(id).human.v1.label, judge: D.runs[cfg][`${id}|v1padded`][0] }));
  const r = pairedComparison(A, B, { resamples: 1000, seed: 5 });
  console.log(label.padEnd(46), "delta", (r.delta * 100).toFixed(1) + " pts",
    "flips", r.fixed, "/", r.wins + r.losses, "p =", r.pValue.toFixed(4));
}
console.log("\n-- padding probe, 57 dev --");
paddingTest("honest judge: v1 -> padded copy", "c-rubric-3b");
paddingTest("verbosity-biased judge: v1 -> padded", "c-rubric-3b-verb");

console.log("\n-- padding probe, all 94 --");
paddingTest("honest judge, 94", "c-rubric-3b");
paddingTest("verbosity-biased judge, 94", "c-rubric-3b-verb");

console.log("\n=== LADDER CI WIDTHS vs ITEM COUNT (Llama 3.2 3B, v1) ===");
function widthsFor(cfg, variant, ns, trials = 60) {
  const rows = [];
  for (const n of ns) {
    const ws = [];
    for (let s = 1; s <= trials; s++) {
      const idx = sampleItems(D.dev_ids.map((id) => itemById.get(id)), n, "random", s * 1013 + hashSeed(cfg));
      const pairs = idx.map((i) => {
        const it = D.dev_ids[i];
        const obj = itemById.get(it);
        return { human: obj.human[variant].label, judge: D.runs[cfg][`${it}|${variant}`][0] };
      });
      const m = judgeMetrics(pairs, { resamples: 400, seed: 17 });
      if (m.ci?.kappa) ws.push(m.ci.kappa.hi - m.ci.kappa.lo);
    }
    ws.sort((a, b) => a - b);
    rows.push({ n, meanW: ws.reduce((a, b) => a + b, 0) / ws.length, medW: ws[(ws.length / 2) | 0] });
  }
  return rows;
}
for (const n of [20, 30, 40, 57]) {
  const r = widthsFor("c-rubric-3b", "v1", [n]);
  console.log(`  n=${String(n).padStart(2)}  mean kappa-CI width ${r[0].meanW.toFixed(3)}  median ${r[0].medW.toFixed(3)}`);
}
console.log("  -> items cost, at the 3B price: n=20 $", (0.03794 * 20).toFixed(4), " n=57 $", (0.03794 * 57).toFixed(4));
console.log("  -> upgrade money 7B-3B over 57 items $", (0.09872 * 57 - 0.03794 * 57).toFixed(4),
  "= that many extra 3B items:", Math.round((0.09872 * 57 - 0.03794 * 57) / 0.03794));

console.log("\n=== LADDER TPR / TNR intervals on dev 57 ===");
for (const cfg of ["c-rubric-0.6b", "c-rubric-1.7b", "c-rubric-3b", "c-rubric-3.8b", "c-rubric-7b"]) {
  const m = judgeMetrics(D.dev_ids.map((id) => ({ human: itemById.get(id).human.v1.label, judge: D.runs[cfg][`${id}|v1`][0] })), { resamples: 400, seed: 17 });
  console.log(D.cost[cfg].model.padEnd(18),
    "kappa", m.kappa.toFixed(2), `(${m.ci.kappa.lo.toFixed(2)}-${m.ci.kappa.hi.toFixed(2)})`,
    "| TPR", pct(m.tpr), `(${pct(m.ci.tpr.lo, 0)}-${pct(m.ci.tpr.hi, 0)})`,
    "| TNR", pct(m.tnr), `(${pct(m.ci.tnr.lo, 0)}-${pct(m.ci.tnr.hi, 0)})`,
    "| kappa width", (m.ci.kappa.hi - m.ci.kappa.lo).toFixed(2));
}

console.log("\n=== REPEATS: where the k=4 vs k=5 difference comes from ===");
function pairsFor(cfg, repeats, n, strategy, seed, ids, variant) {
  const all = ids.map((id) => itemById.get(id));
  const idx = sampleItems(all, n, strategy, seed + hashSeed(cfg));
  return idx.map((i) => {
    const it = all[i];
    const samples = D.runs[cfg][`${it.id}|${variant}`] || [0];
    return { human: it.human[variant]?.label ?? 0, judge: repeats <= 1 ? samples[0] : majorityVote(samples.slice(0, repeats)) };
  });
}
console.log("majorityVote rule: ones*2 > k  =>  k=4 needs 3 of 4 (75%), k=5 needs 3 of 5 (60%)");
for (const k of [2, 3, 4, 5]) console.log("  k=" + k, "needs", Math.floor(k / 2) + 1, "of", k, "=", (((Math.floor(k / 2) + 1) / k) * 100).toFixed(0) + "%");
for (const [label, n, strategy, seed, ids] of [
  ["preset draw 40 dev", 40, "random", 7, D.dev_ids],
  ["all 57 dev", 57, "all", 7, D.dev_ids],
]) {
  const p1 = pairsFor("c-rubric-3b", 1, n, strategy, seed, ids, "v1");
  const p4 = pairsFor("c-rubric-3b", 4, n, strategy, seed, ids, "v1");
  const p5 = pairsFor("c-rubric-3b", 5, n, strategy, seed, ids, "v1");
  let d45 = 0, d15 = 0;
  for (let i = 0; i < p1.length; i++) {
    if (p4[i].judge !== p5[i].judge) d45++;
    if (p1[i].judge !== p5[i].judge) d15++;
  }
  console.log(label, ": verdicts differing 4 vs 5 =", d45, "of", n, "| 1 vs 5 =", d15, "of", n);
}
// pass rate at each k, and the 5-vs-3 spread
for (const [label, n, strategy, seed, ids] of [["preset draw 40", 40, "random", 7, D.dev_ids], ["57 dev", 57, "all", 7, D.dev_ids], ["37 test", 37, "all", 7, D.test_ids]]) {
  const rates = [];
  for (let k = 1; k <= 5; k++) {
    const p = pairsFor("c-rubric-3b", k, n, strategy, seed, ids, "v1");
    rates.push(((p.filter((x) => x.judge === 1).length / p.length) * 100).toFixed(1));
  }
  console.log(label, "pass rate k=1..5:", rates.join(" / "), "%");
}
// single-repeat noise: how often do items change between repeat 1 and repeat 2 (all 57, all 94)
{
  let ch12 = 0, n = 0, chS = 0;
  for (const it of D.items) {
    const s = D.runs["c-rubric-3b"][`${it.id}|v1`];
    for (let k = 1; k < 5; k++) { n++; if (s[k] !== s[0]) ch12++; }
  }
  console.log("greedy vs each of 4 samples disagree:", ch12, "of", n, "=", pct(ch12 / n, 1));
}

console.log("\n=== 07.1 COST OF THE SWAP TEST ===");
for (const cfg of ["c-rubric-1.7b", "c-rubric-3b", "c-rubric-7b"]) {
  const c = D.cost[cfg];
  console.log(c.model.padEnd(18), "$" + c.cost_usd.toFixed(5), "one order over 12 pairs: $" + (c.cost_usd * 12).toFixed(4),
    "both orders: $" + (c.cost_usd * 24).toFixed(4), "| latency serial 2x", (c.latency_ms * 2) + " ms");
}
// ties per judge
console.log("\ntie rate under the both-orders rule:");
const pwin = {};
new Function("window", readFileSync(join(ROOT, "simulations/judge-lab/data-pairwise.js"), "utf8"))(pwin);
const PW = pwin.EvalLabData.pairwise;
for (const m of PW.models) {
  let ties = 0, n = 0, bothA = 0, bothB = 0;
  for (const id of Object.keys(PW.runs[m.id])) {
    const e = PW.runs[m.id][id];
    for (let k = 0; k < e.AB.length; k++) {
      n++;
      if (e.AB[k] === "A" && e.BA[k] === "B") bothA++;
      else if (e.AB[k] === "B" && e.BA[k] === "A") bothB++;
      else ties++;
    }
  }
  console.log("  ", m.label.padEnd(18), "ties", ties, "/", n, "=", pct(ties / n, 1), "| decisive", bothA + bothB, "| of decisive, A correct", pct(bothA / (bothA + bothB), 1));
}