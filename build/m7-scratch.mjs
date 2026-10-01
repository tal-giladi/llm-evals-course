// THROWAWAY — module 7 number check. Deleted before reporting.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  judgeMetrics, sampleItems, majorityVote, hashSeed, pct,
} from "../simulations/common/stats.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
new Function("window", readFileSync(join(ROOT, "simulations/judge-lab/data.js"), "utf8"))(win);
new Function("window", readFileSync(join(ROOT, "simulations/judge-lab/data-pairwise.js"), "utf8"))(win);
const D = win.EvalLabData.support;
const PW = win.EvalLabData.pairwise;
const itemById = new Map(D.items.map((i) => [i.id, i]));

console.log("=== DATASET SHAPE ===");
console.log("items", D.items.length, "dev", D.dev_ids.length, "test", D.test_ids.length);
console.log("variants:", D.variants.map((v) => `${v.id}=${v.label}`).join(" | "));
console.log("variant notes:", D.variants.map((v) => `${v.id}: ${v.note}`).join("\n                  "));
console.log("repeats recorded:", D.repeats);
console.log("judge_menu:");
for (const j of D.judge_menu) console.log("  ", j.id.padEnd(18), j.label.padEnd(34), j.prompt_variant, j.family ?? "", j.self ?? "");
console.log("pairwise keys:", Object.keys(PW));
console.log("pairwise models:", PW.models.map((m) => `${m.id}=${m.label}`).join(" | "));
console.log("pairwise items:", PW.items.length);
console.log("pairwise runs ids:", Object.keys(PW.runs));
console.log("pairwise sample entry:", JSON.stringify(PW.runs[PW.models[0].id]["p01"]));
console.log("pairwise entry keys:", Object.keys(PW.runs[PW.models[0].id]["p01"]));

console.log("\n=== 07.1 POSITION ===");
for (const model of PW.models) {
  const table = PW.runs[model.id];
  let flips = 0, n = 0, firstWins = 0, abCorrect = 0, baCorrect = 0, abN = 0, baN = 0;
  let bothA = 0, bothB = 0, ties = 0;
  for (const id of Object.keys(table)) {
    const e = table[id];
    for (let k = 0; k < e.AB.length; k++) {
      n++;
      if (e.AB[k] !== e.BA[k]) flips++;
      if (e.AB[k] === "A" && e.BA[k] === "B") firstWins++;
      if (e.AB[k] === "A") abCorrect++;
      abN++;
      if (e.BA[k] === "B") baCorrect++;
      baN++;
      if (e.AB[k] === "A" && e.BA[k] === "B") bothA++;
      else if (e.AB[k] === "B" && e.BA[k] === "A") bothB++;
      else ties++;
    }
  }
  const dec = bothA + bothB;
  console.log(
    model.label.padEnd(20),
    "n=" + n,
    "swapCons=" + pct(1 - flips / n, 1),
    "flips=" + flips,
    "firstWins=" + pct(firstWins / n, 1),
    "| A-B correct=" + pct(abCorrect / abN, 1),
    "B-A correct=" + pct(baCorrect / baN, 1),
    "|| bothA=" + bothA, "bothB=" + bothB, "ties=" + ties,
    "decisive=" + dec, "bothA share of decisive=" + (dec ? pct(bothA / dec, 1) : "—"),
    "A share of all n=" + pct(bothA / n, 1)
  );
}
// per-model detail for the 3B judge
console.log("\n-- 3B judge, per pair --");
{
  const mid = PW.models.find((m) => m.label.includes("3B") && m.label.includes("Llama"));
  const table = PW.runs[mid.id];
  for (const id of Object.keys(table)) {
    const e = table[id];
    const agreeAB = e.AB.filter((v, k) => e.AB[k] === e.BA[k]).length;
    console.log("  ", id, "AB=[" + e.AB.join(",") + "]", "BA=[" + e.BA.join(",") + "]", "consistent " + agreeAB + "/" + e.AB.length);
  }
}
console.log("\npairwise item example:", JSON.stringify(PW.items[0]));
console.log("pairwise run model objects:", JSON.stringify(PW.models));

console.log("\n=== 07.2 VERBOSITY ===");
// Is v1padded literally v1 plus two sentences?
{
  const it = itemById.get("s01");
  console.log("s01 v1     :", JSON.stringify(it.outputs.v1));
  console.log("s01 v1padded:", JSON.stringify(it.outputs.v1padded));
  console.log("output keys:", Object.keys(it.outputs));
  let sameExceptLonger = 0, total = 0;
  let sentDiff = [];
  for (const id of D.dev_ids) {
    const o = itemById.get(id).outputs;
    total++;
    const a = o.v1, b = o.v1padded;
    if (b && a && b.startsWith(a)) sameExceptLonger++;
    if (a && b) {
      const sa = a.match(/[^.!?]+[.!?]/g)?.length ?? 0;
      const sb = b.match(/[^.!?]+[.!?]/g)?.length ?? 0;
      sentDiff.push(sb - sa);
    }
  }
  console.log("dev items whose padded copy starts with the original:", sameExceptLonger, "/", total);
  const counts = {};
  for (const x of sentDiff) counts[x] = (counts[x] || 0) + 1;
  console.log("extra-sentence histogram:", JSON.stringify(counts));
  console.log("avg len v1:", (D.dev_ids.reduce((s, id) => s + itemById.get(id).outputs.v1.length, 0) / D.dev_ids.length).toFixed(1),
    "avg len padded:", (D.dev_ids.reduce((s, id) => s + itemById.get(id).outputs.v1padded.length, 0) / D.dev_ids.length).toFixed(1));
}
for (const [label, cfg] of [["Rubric judge, no verbosity bias", "c-rubric-3b"], ["Verbosity-biased judge", "c-rubric-3b-verb"]]) {
  const base = judgeMetrics(D.dev_ids.map((id) => ({
    human: itemById.get(id).human.v1.label, judge: D.runs[cfg][`${id}|v1`][0],
  })), { resamples: 400, seed: 11 });
  const padded = judgeMetrics(D.dev_ids.map((id) => ({
    human: itemById.get(id).human.v1.label, judge: D.runs[cfg][`${id}|v1padded`][0],
  })), { resamples: 400, seed: 11 });
  let flips = 0;
  for (const id of D.dev_ids) if (D.runs[cfg][`${id}|v1`][0] !== D.runs[cfg][`${id}|v1padded`][0]) flips++;
  let falseToTrue = 0, trueToFalse = 0;
  for (const id of D.dev_ids) {
    const a = D.runs[cfg][`${id}|v1`][0], b = D.runs[cfg][`${id}|v1padded`][0];
    if (a === 0 && b === 1) falseToTrue++;
    if (a === 1 && b === 0) trueToFalse++;
  }
  console.log(label.padEnd(36), "base", pct(base.judgePassRate), "padded", pct(padded.judgePassRate),
    "delta", ((padded.judgePassRate - base.judgePassRate) * 100).toFixed(1) + " pts",
    "| flips", flips, `(0->1: ${falseToTrue}, 1->0: ${trueToFalse})`,
    "| base kappa", base.kappa.toFixed(2), "padded kappa", padded.kappa.toFixed(2),
    "| base TNR", pct(base.tnr), "padded TNR", pct(padded.tnr));
  console.log("    base confusion", JSON.stringify(base.confusion), "padded confusion", JSON.stringify(padded.confusion));
}
// all 94 too
console.log("-- verbosity on all 94 --");
for (const [label, cfg] of [["no bias", "c-rubric-3b"], ["biased", "c-rubric-3b-verb"]]) {
  const ids = D.items.map((i) => i.id);
  const base = judgeMetrics(ids.map((id) => ({ human: itemById.get(id).human.v1.label, judge: D.runs[cfg][`${id}|v1`][0] })), { resamples: 400, seed: 11 });
  const padded = judgeMetrics(ids.map((id) => ({ human: itemById.get(id).human.v1.label, judge: D.runs[cfg][`${id}|v1padded`][0] })), { resamples: 400, seed: 11 });
  console.log(" ", label.padEnd(9), pct(base.judgePassRate), "->", pct(padded.judgePassRate), ((padded.judgePassRate - base.judgePassRate) * 100).toFixed(1) + " pts");
}

console.log("\n=== 07.3 SELF-PREFERENCE ===");
const cfgA = "c-rubric-3b", cfgB = "c-rubric-3b-self";
for (const v of ["v1", "v2", "v3"]) {
  const base = judgeMetrics(D.dev_ids.map((id) => ({ human: itemById.get(id).human[v].label, judge: D.runs[cfgA][`${id}|${v}`][0] })), { resamples: 300, seed: 13 });
  const self = judgeMetrics(D.dev_ids.map((id) => ({ human: itemById.get(id).human[v].label, judge: D.runs[cfgB][`${id}|${v}`][0] })), { resamples: 300, seed: 13 });
  let flips = 0, ftt = 0, ttf = 0;
  for (const id of D.dev_ids) {
    const a = D.runs[cfgA][`${id}|${v}`][0], b = D.runs[cfgB][`${id}|${v}`][0];
    if (a !== b) flips++;
    if (a === 0 && b === 1) ftt++;
    if (a === 1 && b === 0) ttf++;
  }
  const humanPass = D.dev_ids.filter((id) => itemById.get(id).human[v].label === 1).length;
  console.log(D.variants.find((x) => x.id === v).label.padEnd(22),
    "human pass", `${humanPass}/57`, "| plain", pct(base.judgePassRate), "kappa", base.kappa.toFixed(2), "TNR", pct(base.tnr), "TPR", pct(base.tpr),
    "| self", pct(self.judgePassRate), "kappa", self.kappa.toFixed(2), "TNR", pct(self.tnr), "TPR", pct(self.tpr),
    "| delta", ((self.judgePassRate - base.judgePassRate) * 100).toFixed(1), "flips", flips, `(0->1 ${ftt}, 1->0 ${ttf})`);
  console.log("      plain conf", JSON.stringify(base.confusion), " self conf", JSON.stringify(self.confusion));
}
// human pass rates on the three variants, dev only
for (const v of ["v1", "v2", "v3"]) {
  const hp = D.dev_ids.filter((id) => itemById.get(id).human[v].label === 1).length;
  console.log("  human pass dev", v, hp, "/57", pct(hp / 57));
}

console.log("\n=== 07.4 SIZE LADDER ===");
const ladder = ["c-rubric-0.6b", "c-rubric-1.7b", "c-rubric-3b", "c-rubric-3.8b", "c-rubric-7b"];
for (const cfg of ladder) {
  const m = judgeMetrics(D.dev_ids.map((id) => ({ human: itemById.get(id).human.v1.label, judge: D.runs[cfg][`${id}|v1`][0] })), { resamples: 400, seed: 17 });
  const c = D.cost[cfg];
  console.log(c.model.padEnd(18),
    "kappa", m.kappa.toFixed(2),
    `(${m.ci.kappa.lo.toFixed(2)}-${m.ci.kappa.hi.toFixed(2)})`,
    "TPR", pct(m.tpr), "TNR", pct(m.tnr), "acc", pct(m.accuracy),
    "cost", "$" + c.cost_usd.toFixed(5), "lat", c.latency_ms + "ms",
    "| run57 $" + (c.cost_usd * 57).toFixed(4), "conf", JSON.stringify(m.confusion));
}
{
  const c0 = D.cost["c-rubric-0.6b"].cost_usd, c6 = D.cost["c-rubric-7b"].cost_usd;
  console.log("cost ratio 7b/0.6b:", (c6 / c0).toFixed(2), "x; 7b run of 57 = $" + (c6 * 57).toFixed(4), "0.6b run of 57 = $" + (c0 * 57).toFixed(4));
  console.log("latency ratio:", D.cost["c-rubric-7b"].latency_ms / D.cost["c-rubric-0.6b"].latency_ms);
}
// same ladder on the 37 held-out items, for the validation step
console.log("-- ladder on the 37 test items --");
for (const cfg of ladder) {
  const m = judgeMetrics(D.test_ids.map((id) => ({ human: itemById.get(id).human.v1.label, judge: D.runs[cfg][`${id}|v1`][0] })), { resamples: 400, seed: 17 });
  console.log(D.cost[cfg].model.padEnd(18), "kappa", m.kappa.toFixed(2), `(${m.ci.kappa.lo.toFixed(2)}-${m.ci.kappa.hi.toFixed(2)})`, "TPR", pct(m.tpr), "TNR", pct(m.tnr), "n=" + m.n);
}

console.log("\n=== 07.5 REPEATS (preset config: c-rubric-3b, v1, dev, n=40, random, seed 7) ===");
function pairsFor(cfg, repeats, n, strategy, seed, ids, variant) {
  const all = ids.map((id) => itemById.get(id));
  const idx = sampleItems(all, n, strategy, seed + hashSeed(cfg));
  return idx.map((i) => {
    const it = all[i];
    const samples = D.runs[cfg][`${it.id}|${variant}`] || [0];
    let judge;
    if (repeats <= 1) judge = samples[0];
    else judge = majorityVote(samples.slice(0, repeats));
    return { human: it.human[variant]?.label ?? 0, judge };
  });
}
for (const [label, n, strategy, seed, ids, variant] of [
  ["preset draw (40 dev, random, seed 7, v1)", 40, "random", 7, D.dev_ids, "v1"],
  ["all 57 dev", 57, "all", 7, D.dev_ids, "v1"],
  ["37 test", 37, "all", 7, D.test_ids, "v1"],
]) {
  console.log("--", label);
  for (let k = 1; k <= 5; k++) {
    const m = judgeMetrics(pairsFor("c-rubric-3b", k, n, strategy, seed, ids, variant), { resamples: 400, seed: 19 });
    const cost = D.cost["c-rubric-3b"].cost_usd * n * k;
    console.log("   k=" + k, "kappa", m.kappa.toFixed(2), `(${m.ci.kappa.lo.toFixed(2)}-${m.ci.kappa.hi.toFixed(2)})`,
      "TPR", pct(m.tpr), "TNR", pct(m.tnr), "pass", pct(m.judgePassRate),
      "cost $" + cost.toFixed(4), "conf", JSON.stringify(m.confusion));
  }
}
// non-unanimous items at each k on all 57 dev
for (const cfg of ["c-rubric-3b", "c-rubric-3b-fs3"]) {
  let nonU = 0, devNonU = 0, testNonU = 0;
  for (const it of D.items) {
    const s = D.runs[cfg][`${it.id}|v1`];
    if (!s) continue;
    if (new Set(s).size > 1) {
      nonU++;
      if (D.dev_ids.includes(it.id)) devNonU++;
      if (D.test_ids.includes(it.id)) testNonU++;
    }
  }
  console.log("non-unanimous over 5 samples:", D.cost[cfg].model, cfg, "all94:", nonU, "dev:", devNonU, "test:", testNonU);
}
// preset draw: how many of 40 change verdict between k=1 and k=5
{
  const p1 = pairsFor("c-rubric-3b", 1, 40, "random", 7, D.dev_ids, "v1");
  const p5 = pairsFor("c-rubric-3b", 5, 40, "random", 7, D.dev_ids, "v1");
  let changed = 0;
  for (let i = 0; i < p1.length; i++) if (p1[i].judge !== p5[i].judge) changed++;
  console.log("preset draw: verdicts changed 1 -> 5 repeats:", changed, "of", p1.length);
}