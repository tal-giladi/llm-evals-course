// Throwaway pass 3: lock down the exact figures each lesson quotes.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { judgeMetrics, wilson, pct, pctInterval, sampleItems, thresholdVerdict, majorityVote, correctedPassRate, correctedPassRateCI, hashSeed } from "../simulations/common/stats.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
new Function("window", readFileSync(join(ROOT, "simulations/judge-lab/data.js"), "utf8"))(win);
const D = win.EvalLabData.support;
const label = new Map(D.judge_menu.map((j) => [j.id, j.label]));

function compute(o) {
  const s = { judge: o.judge, variant: o.variant ?? "v1", split: o.split ?? "dev", size: o.size ?? 40, strategy: o.strategy ?? "random", repeats: o.repeats ?? 1, threshold: o.threshold ?? 0.5, seed: o.seed ?? 7, panel: o.panel ?? "agreement" };
  const all = s.split === "full" ? D.items : D.items.filter((i) => (s.split === "dev" ? D.dev_ids : D.test_ids).includes(i.id));
  const verdict = (samples) => {
    if (s.repeats <= 1) return samples[0];
    const used = samples.slice(0, s.repeats);
    return s.panel === "threshold" ? thresholdVerdict(used, s.threshold) : majorityVote(used);
  };
  const idx = sampleItems(all, s.size, s.strategy, s.seed + hashSeed(s.judge));
  const pairs = idx.map((i) => {
    const it = all[i];
    const samples = D.runs[s.judge][`${it.id}|${s.variant}`] || [0];
    return { item: it, human: it.human[s.variant]?.label ?? 0, category: it.human[s.variant]?.category ?? "unknown", judge: verdict(samples) };
  });
  const m = judgeMetrics(pairs.map((p) => ({ human: p.human, judge: p.judge })), { resamples: 1000, seed: s.seed + hashSeed(s.judge + s.repeats + s.threshold) });
  const passed = pairs.filter((p) => p.judge === 1).length;
  const passRate = wilson(passed, pairs.length);
  const devAll = s.split === "dev" ? all : D.items.filter((i) => D.dev_ids.includes(i.id));
  const devPairs = devAll.map((it) => ({ human: it.human[s.variant]?.label ?? 0, judge: verdict(D.runs[s.judge][`${it.id}|${s.variant}`] || [0]) }));
  const devM = judgeMetrics(devPairs, { resamples: 600, seed: s.seed });
  return { s, pairs, m, passRate, passed, devM, corrected: correctedPassRate(passRate.point, devM.tpr, devM.tnr), correctedCI: correctedPassRateCI(devPairs, { resamples: 600, seed: s.seed }) };
}
function full(tag, r) {
  const c = r.m.confusion;
  console.log(`${tag}\n  n ${r.pairs.length} tp ${c.tp} fp ${c.fp} fn ${c.fn} tn ${c.tn}`);
  console.log(`  tpr ${pct(r.m.tpr)} tnr ${pct(r.m.tnr)} acc ${pct(r.m.accuracy)} kappa ${r.m.kappa.toFixed(3)} (${r.m.ci.kappa.lo.toFixed(2)}-${r.m.ci.kappa.hi.toFixed(2)}) prevalence ${pct(r.m.prevalence)}`);
  console.log(`  judge pass ${pct(r.passRate.point)} ${pctInterval(r.passRate)} (${r.passed}/${r.pairs.length})`);
  console.log(`  devTPR ${pct(r.devM.tpr)} (${r.devM.confusion.tp}/${r.devM.confusion.tp + r.devM.confusion.fn}) devTNR ${pct(r.devM.tnr)} (${r.devM.confusion.tn}/${r.devM.confusion.tn + r.devM.confusion.fp}) denom ${(r.devM.tpr + r.devM.tnr - 1).toFixed(4)}`);
  console.log(`  corrected ${r.corrected ? (r.corrected.value * 100).toFixed(2) + "%" : "NULL"} stable ${r.corrected?.stable} oor ${r.corrected?.outOfRange} ci ${r.correctedCI ? (r.correctedCI.lo * 100).toFixed(1) + "-" + (r.correctedCI.hi * 100).toFixed(1) : "—"}`);
}

console.log("### citation marker, case-insensitive");
{
  const pass = D.items.filter((i) => i.human.v1.label === 1), fail = D.items.filter((i) => i.human.v1.label === 0);
  const ci = (s) => s.toLowerCase().includes("handbook");
  console.log(`  passes citing "(Handbook — …)": ${pass.filter((i) => i.outputs.v1.includes("(Handbook")).length}/${pass.length}`);
  console.log(`  failures citing "(Handbook — …)": ${fail.filter((i) => i.outputs.v1.includes("(Handbook")).length}/${fail.length}`);
  console.log(`  passes mentioning handbook (any case): ${pass.filter((i) => ci(i.outputs.v1)).length}/${pass.length}`);
  console.log(`  failures mentioning handbook (any case): ${fail.filter((i) => ci(i.outputs.v1)).length}/${fail.length}`);
  const byCat = new Map();
  for (const i of fail) { const e = byCat.get(i.human.v1.category) ?? { n: 0, h: 0 }; e.n++; if (ci(i.outputs.v1)) e.h++; byCat.set(i.human.v1.category, e); }
  console.log("  failures mentioning handbook by category:", JSON.stringify([...byCat]));
}

console.log("\n### 06.5 the preset as it opens");
full("c-plain-3b dev 40 random seed 7", compute({ judge: "c-plain-3b", size: 40, seed: 7, panel: "corrected" }));
console.log("\n### 06.5 the unstable judge, same panel, other seed");
full("c-plain-0.6b dev 40 random seed 7", compute({ judge: "c-plain-0.6b", size: 40, seed: 7, panel: "corrected" }));
full("c-plain-0.6b dev 40 random seed 20", compute({ judge: "c-plain-0.6b", size: 40, seed: 20, panel: "corrected" }));
full("c-plain-0.6b dev all 57", compute({ judge: "c-plain-0.6b", split: "dev", size: 57, strategy: "all", panel: "corrected" }));
full("c-plain-0.6b full 94", compute({ judge: "c-plain-0.6b", split: "full", size: 94, strategy: "all", panel: "corrected" }));
console.log("\n### 06.5 the rubric judge same panel");
full("c-rubric-3b dev 40 random seed 7", compute({ judge: "c-rubric-3b", size: 40, seed: 7, panel: "corrected" }));
full("c-rubric-3b dev all 57", compute({ judge: "c-rubric-3b", split: "dev", size: 57, strategy: "all", panel: "corrected" }));

console.log("\n### 06.5 exact fixed-point arithmetic on the plain judge, all 57 dev items");
{
  const r = compute({ judge: "c-plain-3b", split: "dev", size: 57, strategy: "all", panel: "corrected" });
  const obs = r.passRate.point, T = r.devM.tpr, N = r.devM.tnr;
  console.log(`  observed ${obs.toFixed(6)} (38/57), TPR ${T.toFixed(6)} (26/30), TNR ${N.toFixed(6)} (15/27)`);
  console.log(`  numerator ${(obs + N - 1).toFixed(6)}   denominator ${(T + N - 1).toFixed(6)}`);
  console.log(`  S = ${((obs + N - 1) / (T + N - 1)).toFixed(6)}  = ${(30 / 57).toFixed(6)} (the human pass rate on those items)`);
  // sensitivity: move one human label
  const variants = [
    ["as labelled", 38, 26, 4, 15, 12],
    ["one more human PASS relabelled FAIL", 38, 25, 5, 15, 12],
    ["one more human FAIL relabelled PASS", 38, 26, 4, 16, 11],
  ];
  for (const [name, o, tp, fn, tn, fp] of variants) {
    const t = tp / (tp + fn), nn = tn / (tn + fp), ob = o / 57;
    const S = (ob + nn - 1) / (t + nn - 1);
    console.log(`  ${name.padEnd(42)} TPR ${pct(t)} TNR ${pct(nn)} denom ${(t + nn - 1).toFixed(4)} -> corrected ${(S * 100).toFixed(1)}%  (truth ${((tp + tn) / 57 * 100).toFixed(1)}%)`);
  }
}

console.log("\n### 06.4 threshold on the TEST split (does the dev-chosen 0.50 hold?)");
for (const t of [0.2, 0.4, 0.5, 0.8, 0.95]) {
  const r = compute({ judge: "c-rubric-3b", split: "test", size: 37, strategy: "all", seed: 7, repeats: 5, threshold: t, panel: "threshold" });
  const c = r.m.confusion;
  console.log(`  test thr ${t.toFixed(2)} tp ${c.tp} fp ${c.fp} fn ${c.fn} tn ${c.tn} kappa ${r.m.kappa.toFixed(2)} (${r.m.ci.kappa.lo.toFixed(2)}-${r.m.ci.kappa.hi.toFixed(2)}) tpr ${pct(r.m.tpr)} tnr ${pct(r.m.tnr)} pass ${pct(r.passRate.point)}`);
}
console.log("### 06.4 dev split sweep, repeats 5, all 57");
for (const t of [0.2, 0.4, 0.5, 0.6, 0.8, 0.95, 1]) {
  const r = compute({ judge: "c-rubric-3b", split: "dev", size: 57, strategy: "all", seed: 7, repeats: 5, threshold: t, panel: "threshold" });
  const c = r.m.confusion;
  console.log(`  dev thr ${t.toFixed(2)} tp ${c.tp} fp ${c.fp} fn ${c.fn} tn ${c.tn} kappa ${r.m.kappa.toFixed(2)} (${r.m.ci.kappa.lo.toFixed(2)}-${r.m.ci.kappa.hi.toFixed(2)}) tpr ${pct(r.m.tpr)} tnr ${pct(r.m.tnr)} pass ${pct(r.passRate.point)}`);
}
console.log("### 06.4 how many repeats does the verdict actually need? per-item sample spread");
{
  let allOnes = 0, mixed = 0, allZero = 0, none = 0;
  for (const it of D.items) {
    const s = D.runs["c-rubric-3b"][`${it.id}|v1`];
    const ones = s.reduce((a, b) => a + b, 0);
    if (ones === 5) allOnes++; else if (ones === 0) allZero++; else mixed++;
    if (!s) none++;
  }
  console.log(`  c-rubric-3b v1: ${allOnes} items all 5 samples passed, ${mixed} mixed, ${allZero} all 5 failed`);
  let a = 0, b = 0, c2 = 0;
  for (const it of D.items) {
    const s = D.runs["c-plain-3b"][`${it.id}|v1`];
    const ones = s.reduce((x, y) => x + y, 0);
    if (ones === 5) a++; else if (ones === 0) c2++; else b++;
  }
  console.log(`  c-plain-3b v1:  ${a} all pass, ${b} mixed, ${c2} all fail`);
  let d = 0, e = 0;
  for (const it of D.items) { const s = D.runs["c-crit-3b"][`${it.id}|v1`]; const o = s.reduce((x, y) => x + y, 0); if (o === 0 || o === 5) d++; else e++; }
  console.log(`  c-crit-3b v1:   ${d} unanimous, ${e} mixed`);
}

console.log("\n### 06.2 default view of the tnr preset (c-plain-3b, dev, 40, seed 7)");
full("tnr preset opening", compute({ judge: "c-plain-3b", size: 40, seed: 7 }));
console.log("\n### 06.2 same page after Validate (test, all 37)");
full("plain 3b test", compute({ judge: "c-plain-3b", split: "test", size: 37, strategy: "all" }));
full("rubric 3b test", compute({ judge: "c-rubric-3b", split: "test", size: 37, strategy: "all" }));
full("plain 3b dev", compute({ judge: "c-plain-3b", split: "dev", size: 57, strategy: "all" }));
full("rubric 3b dev", compute({ judge: "c-rubric-3b", split: "dev", size: 57, strategy: "all" }));

console.log("\n### 06.1 human label content");
{
  const crit = D.items.map((i) => i.human.v1.critique);
  const uniq = new Set(crit);
  console.log(`  ${crit.length} critiques, ${uniq.size} distinct strings`);
  const words = D.items.map((i) => String(i.outputs.v1).split(/\s+/).filter(Boolean).length);
  console.log(`  answer words: mean ${(words.reduce((a, b) => a + b, 0) / 94).toFixed(1)}, max ${Math.max(...words)}`);
  const cw = crit.map((c) => c.split(/\s+/).filter(Boolean).length);
  console.log(`  critique words: mean ${(cw.reduce((a, b) => a + b, 0) / 94).toFixed(1)}`);
  console.log("  sample critiques:");
  for (const i of D.items.slice(0, 3)) console.log(`    [${i.id} ${i.human.v1.category}] "${i.human.v1.critique}"`);
  // categories per variant
  for (const v of ["v1", "v2", "v3"]) {
    const m = new Map();
    for (const i of D.items) m.set(i.human[v].category, (m.get(i.human[v].category) ?? 0) + 1);
    console.log(`  ${v} human categories:`, JSON.stringify([...m].sort((a, b) => b[1] - a[1])));
  }
}