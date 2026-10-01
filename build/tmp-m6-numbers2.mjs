// Throwaway pass 2: full-population sweep, citation format, corrected-rate edge cases.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  judgeMetrics, pct, pctInterval, sampleItems, thresholdVerdict, majorityVote,
  correctedPassRate, correctedPassRateCI, hashSeed, confusion,
} from "../simulations/common/stats.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
new Function("window", readFileSync(join(ROOT, "simulations/judge-lab/data.js"), "utf8"))(win);
const D = win.EvalLabData.support;
const label = new Map(D.judge_menu.map((j) => [j.id, j.label]));

function verdictFor(s, samples) {
  if (s.repeats <= 1) return samples[0];
  const used = samples.slice(0, s.repeats);
  if (s.panel === "threshold") return thresholdVerdict(used, s.threshold);
  return majorityVote(used);
}
function itemsFor(s) {
  if (s.split === "full") return D.items;
  return D.items.filter((i) => (s.split === "dev" ? D.dev_ids : D.test_ids).includes(i.id));
}
function pairsFor(s) {
  const all = itemsFor(s);
  const idx = sampleItems(all, s.size, s.strategy, s.seed + hashSeed(s.judge));
  return idx.map((i) => {
    const it = all[i];
    const samples = D.runs[s.judge][`${it.id}|${s.variant}`] || [0];
    return { item: it, human: it.human[s.variant]?.label ?? 0, category: it.human[s.variant]?.category ?? "unknown", critique: it.human[s.variant]?.critique ?? "", samples, judge: verdictFor(s, samples) };
  });
}
function compute(o) {
  const s = { judge: o.judge, variant: o.variant ?? "v1", split: o.split ?? "dev", size: o.size ?? 40, strategy: o.strategy ?? "random", repeats: o.repeats ?? 1, threshold: o.threshold ?? 0.5, seed: o.seed ?? 7, panel: o.panel ?? "agreement" };
  const pairs = pairsFor(s);
  const m = judgeMetrics(pairs.map((p) => ({ human: p.human, judge: p.judge })), { resamples: 1000, seed: s.seed + hashSeed(s.judge + s.repeats + s.threshold) });
  const passed = pairs.filter((p) => p.judge === 1).length;
  const passRate = { point: pairs.length ? passed / pairs.length : 0, lo: 0, hi: 1, n: pairs.length };
  const devPairs = (s.split === "dev" ? itemsFor(s) : D.items.filter((i) => D.dev_ids.includes(i.id)))
    .map((it) => ({ human: it.human[s.variant]?.label ?? 0, judge: verdictFor(s, D.runs[s.judge][`${it.id}|${s.variant}`] || [0]) }));
  const devM = judgeMetrics(devPairs, { resamples: 600, seed: s.seed });
  return { s, pairs, m, passRate, passed, devM, corrected: correctedPassRate(passRate.point, devM.tpr, devM.tnr), correctedCI: correctedPassRateCI(devPairs, { resamples: 600, seed: s.seed }) };
}

console.log("=".repeat(78));
console.log("SAMPLE ARRAYS");
{
  const arr = D.runs["c-rubric-3b"]["s01|v1"];
  console.log("c-rubric-3b s01|v1 samples:", JSON.stringify(arr));
  let min = 99, max = 0;
  for (const k of Object.keys(D.runs)) for (const key of Object.keys(D.runs[k])) {
    const n = D.runs[k][key].length; min = Math.min(min, n); max = Math.max(max, n);
  }
  console.log("sample-array lengths across every recorded run:", min, "to", max);
}

console.log("=".repeat(78));
console.log("THRESHOLD SWEEP — c-rubric-3b, ALL 94 items, 5 samples, v1");
for (const t of [0, 0.2, 0.4, 0.5, 0.6, 0.8, 0.95, 1]) {
  const r = compute({ judge: "c-rubric-3b", split: "full", size: 94, strategy: "all", seed: 7, repeats: 5, threshold: t, panel: "threshold" });
  const c = r.m.confusion;
  console.log(`thr ${t.toFixed(2)}  tp ${c.tp} fp ${c.fp} fn ${c.fn} tn ${c.tn}  kappa ${r.m.kappa.toFixed(2)} (${r.m.ci.kappa.lo.toFixed(2)}-${r.m.ci.kappa.hi.toFixed(2)}) tpr ${pct(r.m.tpr)} tnr ${pct(r.m.tnr)} pass ${pct(r.passRate.point)}`);
}
console.log("--- plain judge, all 94, 5 samples ---");
for (const t of [0.2, 0.5, 0.8, 1]) {
  const r = compute({ judge: "c-plain-3b", split: "full", size: 94, strategy: "all", seed: 7, repeats: 5, threshold: t, panel: "threshold" });
  const c = r.m.confusion;
  console.log(`thr ${t.toFixed(2)}  tp ${c.tp} fp ${c.fp} fn ${c.fn} tn ${c.tn}  kappa ${r.m.kappa.toFixed(2)} tpr ${pct(r.m.tpr)} tnr ${pct(r.m.tnr)} pass ${pct(r.passRate.point)}`);
}

console.log("=".repeat(78));
console.log("CITATION FORMAT — first three outputs");
for (const it of D.items.slice(0, 3)) console.log(`  [${it.id} ${it.human.v1.category}] ${JSON.stringify(it.outputs.v1)}`);
console.log("citation-pattern counts (all 94, v1):");
const pats = { "(Handbook": 0, "Handbook": 0, "handbook": 0, "§": 0 };
for (const it of D.items) for (const p of Object.keys(pats)) if (String(it.outputs.v1).includes(p)) pats[p]++;
console.log("  ", JSON.stringify(pats));
{
  const pass = D.items.filter((i) => i.human.v1.label === 1), fail = D.items.filter((i) => i.human.v1.label === 0);
  for (const p of ["(Handbook", "Handbook", "§"]) {
    console.log(`   "${p}": passes ${pass.filter((i) => String(i.outputs.v1).includes(p)).length}/${pass.length}, failures ${fail.filter((i) => String(i.outputs.v1).includes(p)).length}/${fail.length}`);
  }
  console.log("   sample fail outputs:");
  for (const i of fail.slice(0, 4)) console.log(`     [${i.id} ${i.human.v1.category}] ${JSON.stringify(i.outputs.v1)}`);
}

console.log("=".repeat(78));
console.log("DISAGREEMENTS — full 94, greedy, by human category");
for (const j of ["c-plain-3b", "c-rubric-3b"]) {
  const r = compute({ judge: j, split: "full", size: 94, strategy: "all", seed: 7 });
  const bad = r.pairs.filter((p) => p.human !== p.judge);
  const by = new Map();
  for (const p of bad) {
    const e = by.get(p.category) ?? { n: 0, fp: 0, fn: 0 };
    e.n++; if (p.human === 0) e.fp++; else e.fn++;
    by.set(p.category, e);
  }
  console.log(`${label.get(j)}: ${bad.length} disagreements; ` + [...by].map(([k, v]) => `${k} ${v.n}(fp ${v.fp} fn ${v.fn})`).join(", "));
}
console.log("--- disagreements panel as the preset opens it: c-rubric-3b, dev, 40 random, seed 7 ---");
{
  const r = compute({ judge: "c-rubric-3b", split: "dev", size: 40, strategy: "random", seed: 7 });
  const bad = r.pairs.filter((p) => p.human !== p.judge);
  console.log(`  ${bad.length} of 40: ` + bad.map((p) => `${p.item.id}/${p.category}(h${p.human}j${p.judge})`).join(", "));
}
console.log("--- plain judge dev/test halves ---");
for (const split of ["dev", "test"]) {
  for (const j of ["c-plain-3b", "c-rubric-3b"]) {
    const r = compute({ judge: j, split, size: 999, strategy: "all", seed: 7 });
    console.log(`  ${label.get(j)} ${split}: ${JSON.stringify(r.m.confusion)} kappa ${r.m.kappa.toFixed(2)} disagreements ${r.m.confusion.fp + r.m.confusion.fn}`);
  }
}

console.log("=".repeat(78));
console.log("CORRECTED PASS RATE — scan for unstable / out-of-range");
for (const j of D.judge_menu.map((x) => x.id)) {
  const r = compute({ judge: j, split: "dev", size: 57, strategy: "all", seed: 7, panel: "corrected" });
  const d = r.devM.tpr + r.devM.tnr - 1;
  console.log(`${label.get(j).padEnd(34)} devTPR ${pct(r.devM.tpr)} devTNR ${pct(r.devM.tnr)} denom ${d.toFixed(4)} obsAll ${pct(r.passRate.point)}`);
}
console.log("--- random 40-item dev samples across seeds, looking for out-of-range corrections ---");
{
  const hits = [];
  for (const j of D.judge_menu.map((x) => x.id)) {
    for (let seed = 1; seed <= 60; seed++) {
      const r = compute({ judge: j, split: "dev", size: 40, strategy: "random", seed, panel: "corrected" });
      const c = r.corrected;
      if (!c) { hits.push({ j, seed, note: "NULL", denom: null }); continue; }
      if (c.outOfRange || !c.stable) {
        hits.push({ j, seed, obs: r.passRate.point, denom: c.denom, val: c.value, oor: c.outOfRange, stable: c.stable, truth: r.m.prevalence, kappa: r.m.kappa });
      }
    }
  }
  const byJudge = new Map();
  for (const h of hits) byJudge.set(h.j, (byJudge.get(h.j) ?? 0) + 1);
  console.log("unstable hits per judge over 60 seeds x 40 items:", JSON.stringify([...byJudge].map(([k, v]) => `${label.get(k)}: ${v}/60`), null, 1));
  for (const h of hits.filter((x) => x.oor).slice(0, 12)) {
    console.log(`  OUT OF RANGE ${label.get(h.j)} seed ${h.seed}: obs ${pct(h.obs)} denom ${h.denom.toFixed(3)} -> ${(h.val * 100).toFixed(1)}% (truth ${pct(h.truth)})`);
  }
  for (const h of hits.filter((x) => !x.oor && x.val !== undefined).slice(0, 12)) {
    console.log(`  unstable ${label.get(h.j)} seed ${h.seed}: obs ${pct(h.obs)} denom ${h.denom.toFixed(3)} -> ${(h.val * 100).toFixed(1)}% truth ${pct(h.truth)} stable ${h.stable}`);
  }
}
console.log("--- the preset as it opens (c-plain-3b dev 40 seed 7) and the rubric twin ---");
for (const j of ["c-plain-3b", "c-rubric-3b"]) {
  const r = compute({ judge: j, split: "dev", size: 40, strategy: "random", seed: 7, panel: "corrected" });
  console.log(`${label.get(j)}: obs ${pct(r.passRate.point)} of 40; human truth on those items ${pct(r.m.prevalence)}; devTPR ${pct(r.devM.tpr)} devTNR ${pct(r.devM.tnr)} denom ${r.corrected.denom.toFixed(3)} -> corrected ${pct(r.corrected.value)} ci ${pct(r.correctedCI.lo)}-${pct(r.correctedCI.hi)} stable ${r.corrected.stable}`);
}

console.log("=".repeat(78));
console.log("EXTRA — full 94 greedy for every menu entry (for context tables)");
for (const j of D.judge_menu.map((x) => x.id)) {
  const r = compute({ judge: j, split: "full", size: 94, strategy: "all", seed: 7 });
  const c = r.m.confusion;
  console.log(`${label.get(j).padEnd(34)} tp ${String(c.tp).padStart(2)} fp ${String(c.fp).padStart(2)} fn ${String(c.fn).padStart(2)} tn ${String(c.tn).padStart(2)}  tpr ${pct(r.m.tpr)} tnr ${pct(r.m.tnr)} acc ${pct(r.m.accuracy)} kappa ${r.m.kappa.toFixed(2)} pass ${pct(r.m.judgePassRate)}`);
}