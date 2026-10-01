// THROWAWAY — module 7, round 4. Deleted before reporting.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { judgeMetrics, sampleItems, majorityVote, hashSeed, pct } from "../simulations/common/stats.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
new Function("window", readFileSync(join(ROOT, "simulations/judge-lab/data.js"), "utf8"))(win);
const D = win.EvalLabData.support;
const itemById = new Map(D.items.map((i) => [i.id, i]));

function pairsFor(cfg, repeats, n, strategy, seed, ids, variant) {
  const all = ids.map((id) => itemById.get(id));
  const idx = sampleItems(all, n, strategy, seed + hashSeed(cfg));
  return idx.map((i) => {
    const it = all[i];
    const samples = D.runs[cfg][`${it.id}|${variant}`] || [0];
    return { human: it.human[variant]?.label ?? 0, judge: repeats <= 1 ? samples[0] : majorityVote(samples.slice(0, repeats)) };
  });
}
console.log("=== zero-shot vs 3-shot, x repeats, 57 dev ===");
for (const cfg of ["c-rubric-3b", "c-rubric-3b-fs3"]) {
  const row = [];
  for (let k = 1; k <= 5; k++) {
    const m = judgeMetrics(pairsFor(cfg, k, 57, "all", 7, D.dev_ids, "v1"), { resamples: 400, seed: 19 });
    row.push(`k=${k} ${m.kappa.toFixed(2)} (${m.ci.kappa.lo.toFixed(2)}-${m.ci.kappa.hi.toFixed(2)})`);
  }
  console.log("  ", D.cost[cfg].model, cfg.padEnd(16), row.join(" | "));
}
console.log("\n=== same, 37 test ===");
for (const cfg of ["c-rubric-3b", "c-rubric-3b-fs3"]) {
  const row = [];
  for (let k = 1; k <= 5; k++) {
    const m = judgeMetrics(pairsFor(cfg, k, 37, "all", 7, D.test_ids, "v1"), { resamples: 400, seed: 19 });
    row.push(`k=${k} ${m.kappa.toFixed(2)} (${m.ci.kappa.lo.toFixed(2)}-${m.ci.kappa.hi.toFixed(2)})`);
  }
  console.log("  ", D.cost[cfg].model, cfg.padEnd(16), row.join(" | "));
}

console.log("\n=== how much of the gain arrives at k=2 and k=3 (40-item preset draw) ===");
const ks = [];
for (let k = 1; k <= 5; k++) ks.push(judgeMetrics(pairsFor("c-rubric-3b", k, 40, "random", 7, D.dev_ids, "v1"), { resamples: 400, seed: 19 }).kappa);
console.log("  kappas:", ks.map((x) => x.toFixed(2)).join(" "));
console.log("  gain 1->3:", (ks[2] - ks[0]).toFixed(2), " gain 3->5:", (ks[4] - ks[2]).toFixed(2));

console.log("\n=== cost of a 200-item set at the 3B price ===");
for (let k = 1; k <= 5; k++) console.log("   k=" + k, "$" + (0.03794 * 200 * k).toFixed(4));
console.log("   wall clock, 200 calls at 540 ms serial:", (200 * 0.54).toFixed(0), "s; at k=5:", (200 * 5 * 0.54).toFixed(0), "s");

console.log("\n=== greedy vs each sampled call, 94 items, zero-shot rubric ===");
{
  let ch = 0, n = 0;
  const byCat = {};
  for (const it of D.items) {
    const s = D.runs["c-rubric-3b"][`${it.id}|v1`];
    for (let k = 1; k < 5; k++) { n++; if (s[k] !== s[0]) ch++; }
  }
  console.log("  ", ch, "of", n, "=", pct(ch / n, 1));
}
console.log("=== items where all five samples disagree (94 / 57 / 37) ===");
for (const cfg of ["c-rubric-3b", "c-rubric-3b-fs3"]) {
  let a = 0, d = 0, t = 0;
  for (const it of D.items) {
    const s = D.runs[cfg][`${it.id}|v1`];
    if (new Set(s).size > 1) { a++; if (D.dev_ids.includes(it.id)) d++; if (D.test_ids.includes(it.id)) t++; }
  }
  console.log("  ", cfg.padEnd(16), "all94", a, "dev", d, "test", t);
}
console.log("\n=== ladder: pairwise sign test 0.6B vs 7B on dev 57 (kappa endpoints) ===");
for (const cfg of ["c-rubric-0.6b", "c-rubric-7b"]) {
  const m = judgeMetrics(D.dev_ids.map((id) => ({ human: itemById.get(id).human.v1.label, judge: D.runs[cfg][`${id}|v1`][0] })), { resamples: 400, seed: 17 });
  console.log("  ", D.cost[cfg].model.padEnd(18), "kappa", m.kappa.toFixed(2), `(${m.ci.kappa.lo.toFixed(2)}-${m.ci.kappa.hi.toFixed(2)})`, "fp", m.confusion.fp, "fn", m.confusion.fn, "tn", m.confusion.tn, "tp", m.confusion.tp);
}