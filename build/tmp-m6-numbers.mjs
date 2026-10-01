// Throwaway: every number quoted in Module 6, computed with the shipped engine.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  judgeMetrics, wilson, pct, pctInterval, sampleItems, majorityVote,
  thresholdVerdict, correctedPassRate, correctedPassRateCI, hashSeed, confusion, cohensKappa,
} from "../simulations/common/stats.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
new Function("window", readFileSync(join(ROOT, "simulations/judge-lab/data.js"), "utf8"))(win);
const D = win.EvalLabData.support;
const judgeLabel = new Map(D.judge_menu.map((j) => [j.id, j.label]));

/* --- exact replica of app.js compute() ------------------------------- */
function stateFor(o) {
  return {
    judge: o.judge, variant: o.variant ?? "v1", split: o.split ?? "dev",
    size: o.size ?? 40, strategy: o.strategy ?? "random", repeats: o.repeats ?? 1,
    threshold: o.threshold ?? 0.5, seed: o.seed ?? 7, panel: o.panel ?? "agreement",
  };
}
function itemsFor(s) {
  return D.items.filter((i) => (s.split === "dev" ? D.dev_ids : D.test_ids).includes(i.id));
}
function verdictFor(s, samples) {
  if (s.repeats <= 1) return samples[0];
  const used = samples.slice(0, s.repeats);
  if (s.panel === "threshold") return thresholdVerdict(used, s.threshold);
  return majorityVote(used);
}
function pairsFor(s) {
  const table = D.runs[s.judge];
  const all = itemsFor(s);
  const idx = sampleItems(all, s.size, s.strategy, s.seed + hashSeed(s.judge));
  return idx.map((i) => {
    const it = all[i];
    const samples = table[`${it.id}|${s.variant}`] || [0];
    return {
      item: it, human: it.human[s.variant]?.label ?? 0,
      category: it.human[s.variant]?.category ?? "unknown",
      critique: it.human[s.variant]?.critique ?? "",
      output: it.outputs[s.variant], samples, judge: verdictFor(s, samples),
    };
  });
}
function compute(o) {
  const s = stateFor(o);
  const pairs = pairsFor(s);
  const m = judgeMetrics(pairs.map((p) => ({ human: p.human, judge: p.judge })),
    { resamples: 1000, seed: s.seed + hashSeed(s.judge + s.repeats + s.threshold) });
  const passed = pairs.filter((p) => p.judge === 1).length;
  const passRate = wilson(passed, pairs.length);
  const devPairs = (s.split === "dev" ? itemsFor(s) : D.items.filter((i) => D.dev_ids.includes(i.id)))
    .map((it) => {
      const t = D.runs[s.judge][`${it.id}|${s.variant}`] || [0];
      return { human: it.human[s.variant]?.label ?? 0, judge: verdictFor(s, t) };
    });
  const devM = judgeMetrics(devPairs, { resamples: 600, seed: s.seed });
  const corrected = correctedPassRate(passRate.point, devM.tpr, devM.tnr);
  const correctedCI = correctedPassRateCI(devPairs, { resamples: 600, seed: s.seed });
  return { s, pairs, m, passRate, passed, devM, corrected, correctedCI, band: kappaBand(m.kappa) };
}
function kappaBand(k) {
  if (k === null) return "undefined";
  if (k < 0.2) return "slight";
  if (k < 0.4) return "fair";
  if (k < 0.6) return "moderate";
  if (k < 0.8) return "substantial";
  return "almost perfect";
}
function line(r) {
  const c = r.m.confusion;
  return `${judgeLabel.get(r.s.judge)} | ${r.s.split} n=${r.pairs.length} strat=${r.s.strategy} reps=${r.s.repeats} thr=${r.s.threshold} seed=${r.s.seed}` +
    `\n   confusion tp ${c.tp} fp ${c.fp} fn ${c.fn} tn ${c.tn}` +
    `\n   TPR ${pct(r.m.tpr)} ${pctInterval(r.m.ci.tpr)}  TNR ${pct(r.m.tnr)} ${pctInterval(r.m.ci.tnr)}` +
    `\n   kappa ${r.m.kappa?.toFixed(3)} ${r.m.ci.kappa ? `${r.m.ci.kappa.lo.toFixed(2)}-${r.m.ci.kappa.hi.toFixed(2)}` : ""} (${kappaBand(r.m.kappa)})` +
    `\n   accuracy ${pct(r.m.accuracy)} ${pctInterval(r.m.ci.accuracy)}  prevalence ${pct(r.m.prevalence)}  judgePass ${pct(r.m.judgePassRate)}` +
    `\n   passRate ${pct(r.passRate.point)} ${pctInterval(r.passRate)} (${r.passed}/${r.pairs.length})` +
    `\n   devM(${r.s.split === "dev" ? "dev" : "dev-for-correction"}) TPR ${pct(r.devM.tpr)} TNR ${pct(r.devM.tnr)} acc ${pct(r.devM.accuracy)} kappa ${r.devM.kappa?.toFixed(3)} n=${r.devM.n}` +
    (r.corrected ? `\n   corrected ${(r.corrected.value * 100).toFixed(1)}% denom ${r.corrected.denom.toFixed(4)} stable ${r.corrected.stable} outOfRange ${r.corrected.outOfRange}` +
      ` ci ${r.correctedCI ? `${(r.correctedCI.lo * 100).toFixed(1)}-${(r.correctedCI.hi * 100).toFixed(1)}` : "—"}` : "\n   corrected NULL (denominator vanished)");
}

/* ===================== 06.1 : the human labels ======================= */
console.log("=".repeat(78));
console.log("06.1  HUMAN LABELS — 94 items, v1");
{
  const cats = new Map();
  for (const it of D.items) {
    const h = it.human.v1;
    cats.set(h.category, (cats.get(h.category) ?? 0) + 1);
  }
  console.log("human label counts, variant A:", JSON.stringify([...cats].sort((a, b) => b[1] - a[1])));
  const slices = new Map();
  for (const it of D.items) {
    const k = `${it.slice.intent}/${it.slice.difficulty}${it.slice.out_of_scope ? "/oos" : ""}`;
    slices.set(k, (slices.get(k) ?? 0) + 1);
  }
  console.log("slices:", JSON.stringify([...slices].sort((a, b) => b[1] - a[1])));
  const diffDev = new Map();
  for (const it of D.items) diffDev.set(`${(D.dev_ids.includes(it.id) ? "dev" : "test")}/${it.slice.difficulty}`,
    (diffDev.get(`${(D.dev_ids.includes(it.id) ? "dev" : "test")}/${it.slice.difficulty}`) ?? 0) + 1);
  console.log("split x difficulty:", JSON.stringify([...diffDev]));
  const cites = (label) => D.items.filter((it) => (String(it.outputs.v1 ?? "").includes("(Handbook")) === (label === 1));
  const passItems = D.items.filter((it) => it.human.v1.label === 1);
  const failItems = D.items.filter((it) => it.human.v1.label === 0);
  const citesPass = passItems.filter((it) => String(it.outputs.v1).includes("(Handbook")).length;
  const citesFail = failItems.filter((it) => String(it.outputs.v1).includes("(Handbook")).length;
  console.log(`citation: ${citesPass}/${passItems.length} of human passes cite, ${citesFail}/${failItems.length} of human failures cite`);
  const perCatCites = new Map();
  for (const it of failItems) perCatCites.set(it.human.v1.category, perCatCites.get(it.human.v1.category) ?? { n: 0, c: 0 });
  for (const it of failItems) { const e = perCatCites.get(it.human.v1.category); e.n++; if (String(it.outputs.v1).includes("(Handbook")) e.c++; }
  console.log("citation rate per failure category:", JSON.stringify([...perCatCites]));

  // Output length of human-labelled answers — the reading cost of a label.
  const lens = D.items.map((it) => String(it.outputs.v1).split(/\s+/).length);
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const sorted = lens.slice().sort((a, b) => a - b);
  console.log(`answer length words: mean ${mean.toFixed(1)} median ${sorted[47]} min ${sorted[0]} max ${sorted[93]}`);
  const chars = D.items.map((it) => String(it.outputs.v1).length);
  console.log(`answer length chars: total ${chars.reduce((a, b) => a + b, 0)}`);
  // critique availability
  const withCrit = D.items.filter((it) => it.human.v1.critique).length;
  console.log("items with a written critique:", withCrit);
  const critChars = D.items.map((it) => String(it.human.v1.critique || "").length);
  console.log("critique chars: mean", (critChars.reduce((a, b) => a + b, 0) / critChars.length).toFixed(0));

  // sensitivity: relabel the 6 over_refusal items as correct (they are arguably
  // a judgement call) and recompute the plain judge's agreement on all 94.
  const base = D.items.map((it) => ({ human: it.human.v1.label, judge: D.runs["c-plain-3b"][`${it.id}|v1`][0] }));
  const rub = D.items.map((it) => ({ human: it.human.v1.label, judge: D.runs["c-rubric-3b"][`${it.id}|v1`][0] }));
  const m1 = judgeMetrics(base, { resamples: 400, seed: 7 });
  const m2 = judgeMetrics(rub, { resamples: 400, seed: 7 });
  console.log(`plain  all94: ${JSON.stringify(m1.confusion)} kappa ${m1.kappa.toFixed(3)} tpr ${pct(m1.tpr)} tnr ${pct(m1.tnr)} acc ${pct(m1.accuracy)}`);
  console.log(`rubric all94: ${JSON.stringify(m2.confusion)} kappa ${m2.kappa.toFixed(3)} tpr ${pct(m2.tpr)} tnr ${pct(m2.tnr)} acc ${pct(m2.accuracy)}`);
  const flipped = D.items.filter((it) => it.human.v1.category === "over_refusal");
  console.log("over_refusal items:", flipped.length);
  const alt = D.items.map((it) => ({ human: it.human.v1.category === "over_refusal" ? 1 : it.human.v1.label, judge: D.runs["c-rubric-3b"][`${it.id}|v1`][0] }));
  const m3 = judgeMetrics(alt, { resamples: 400, seed: 7 });
  console.log(`rubric with over_refusal relabelled PASS: ${JSON.stringify(m3.confusion)} kappa ${m3.kappa.toFixed(3)} tpr ${pct(m3.tpr)} tnr ${pct(m3.tnr)} acc ${pct(m3.accuracy)} humanPass ${m3.prevalence.toFixed(3)}`);
  const alt2 = D.items.map((it) => ({ human: it.human.v1.category === "over_refusal" ? 1 : it.human.v1.label, judge: D.runs["c-plain-3b"][`${it.id}|v1`][0] }));
  const m4 = judgeMetrics(alt2, { resamples: 400, seed: 7 });
  console.log(`plain  with over_refusal relabelled PASS: ${JSON.stringify(m4.confusion)} kappa ${m4.kappa.toFixed(3)} tpr ${pct(m4.tpr)} tnr ${pct(m4.tnr)} acc ${pct(m4.accuracy)} humanPass ${m4.prevalence.toFixed(3)}`);
  // how many dev/test
  console.log("dev ids overlap check:", D.dev_ids.length + D.test_ids.length, "unique", new Set([...D.dev_ids, ...D.test_ids]).size);
  // how many over_refusal in dev vs test
  console.log("over_refusal dev:", flipped.filter((i) => D.dev_ids.includes(i.id)).length, "test:", flipped.filter((i) => D.test_ids.includes(i.id)).length);
}

/* ===================== 06.2 : TPR / TNR ============================== */
console.log("=".repeat(78));
console.log("06.2  TPR/TNR");
for (const judge of ["c-plain-3b", "c-rubric-3b", "c-step-3b", "c-crit-3b"]) {
  console.log(line(compute({ judge, size: 94, strategy: "all", seed: 7 })));
}
console.log("--- default sample of 40 at seed 7 (what the preset opens on) ---");
for (const judge of ["c-plain-3b", "c-rubric-3b"]) {
  console.log(line(compute({ judge, size: 40, strategy: "random", seed: 7 })));
}
console.log("--- prevalence grid (app.js formula) ---");
for (const judge of ["c-plain-3b", "c-rubric-3b"]) {
  const m = judgeMetrics(D.items.map((it) => ({ human: it.human.v1.label, judge: D.runs[judge][`${it.id}|v1`][0] })), { resamples: 1, seed: 7 });
  const rows = [];
  for (let p = 0.5; p <= 0.9500001; p += 0.05) {
    const acc = m.tpr * p + m.tnr * (1 - p);
    const judgePos = m.tpr * p + (1 - m.tnr) * (1 - p);
    const pe = p * judgePos + (1 - p) * (1 - judgePos);
    const kappa = Math.abs(1 - pe) < 1e-9 ? null : (acc - pe) / (1 - pe);
    rows.push(`${(p * 100).toFixed(0)}%: acc ${pct(acc)} kappa ${kappa === null ? "—" : kappa.toFixed(2)}`);
  }
  console.log(judgeLabel.get(judge), "tpr", pct(m.tpr), "tnr", pct(m.tnr));
  console.log("   " + rows.join(" | "));
  // always-pass judge for comparison
  const alwaysPass = { tpr: 1, tnr: 0 };
  const r2 = [];
  for (let p = 0.5; p <= 0.9500001; p += 0.05) {
    const acc = alwaysPass.tpr * p + alwaysPass.tnr * (1 - p);
    const judgePos = alwaysPass.tpr * p + (1 - alwaysPass.tnr) * (1 - p);
    const pe = p * judgePos + (1 - p) * (1 - judgePos);
    const kappa = Math.abs(1 - pe) < 1e-9 ? null : (acc - pe) / (1 - pe);
    r2.push(`${(p * 100).toFixed(0)}%: ${pct(acc)} / ${kappa === null ? "—" : kappa.toFixed(2)}`);
  }
  console.log("   always-pass judge: " + r2.join(" | "));
}
/* by category */
console.log("--- plain judge, all 94, by human category ---");
{
  const rows = new Map();
  for (const it of D.items) {
    const j = D.runs["c-plain-3b"][`${it.id}|v1`][0];
    const cat = it.human.v1.category;
    const e = rows.get(cat) ?? { n: 0, caught: 0 };
    e.n++;
    if (cat !== "correct" ? j === 0 : j === 1) e.caught++;
    rows.set(cat, e);
  }
  for (const [k, v] of [...rows].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`   ${k.padEnd(14)} n ${String(v.n).padStart(2)}  agreed ${v.caught}  ${pct(v.caught / v.n)}`);
  }
  const rows2 = new Map();
  for (const it of D.items) {
    const j = D.runs["c-rubric-3b"][`${it.id}|v1`][0];
    const cat = it.human.v1.category;
    const e = rows2.get(cat) ?? { n: 0, caught: 0 };
    e.n++;
    if (cat !== "correct" ? j === 0 : j === 1) e.caught++;
    rows2.set(cat, e);
  }
  console.log("--- rubric judge, all 94, by human category ---");
  for (const [k, v] of [...rows2].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`   ${k.padEnd(14)} n ${String(v.n).padStart(2)}  agreed ${v.caught}  ${pct(v.caught / v.n)}`);
  }
}

/* ===================== 06.3 : kappa + disagreements ================== */
console.log("=".repeat(78));
console.log("06.3  DISAGREEMENTS");
for (const judge of ["c-plain-3b", "c-rubric-3b"]) {
  const r = compute({ judge, size: 94, strategy: "all", seed: 7 });
  const bad = r.pairs.filter((p) => p.human !== p.judge);
  console.log(`${judgeLabel.get(judge)}: ${bad.length} disagreements of 94`);
  const by = new Map();
  for (const p of bad) {
    const k = p.category;
    const e = by.get(k) ?? { n: 0, fp: 0, fn: 0 };
    e.n++;
    if (p.human === 0) e.fp++; else e.fn++;
    by.set(k, e);
  }
  for (const [k, v] of [...by].sort((a, b) => b[1].n - a[1].n)) console.log(`   ${k.padEnd(14)} ${v.n}  (judge passed ${v.fp} the human failed, judge failed ${v.fn} the human passed)`);
}
{
  // how many disagreements would remain if each failure category's items were removed
  const plain = D.items.map((it) => ({ it, human: it.human.v1.label, judge: D.runs["c-plain-3b"][`${it.id}|v1`][0] }));
  const cats = [...new Set(plain.map((p) => p.it.human.v1.category))];
  console.log("plain judge kappa with each failure category dropped:");
  for (const c of cats) {
    const keep = plain.filter((p) => p.it.human.v1.category !== c);
    const m = judgeMetrics(keep.map((p) => ({ human: p.human, judge: p.judge })), { resamples: 1, seed: 7 });
    console.log(`   drop ${c.padEnd(14)} n ${m.n} kappa ${m.kappa.toFixed(2)} acc ${pct(m.accuracy)} tnr ${pct(m.tnr)}`);
  }
  const rub = D.items.map((it) => ({ it, human: it.human.v1.label, judge: D.runs["c-rubric-3b"][`${it.id}|v1`][0] }));
  console.log("rubric judge kappa with each failure category dropped:");
  for (const c of cats) {
    const keep = rub.filter((p) => p.it.human.v1.category !== c);
    const m = judgeMetrics(keep.map((p) => ({ human: p.human, judge: p.judge })), { resamples: 1, seed: 7 });
    console.log(`   drop ${c.padEnd(14)} n ${m.n} kappa ${m.kappa.toFixed(2)} acc ${pct(m.accuracy)} tnr ${pct(m.tnr)}`);
  }
}

/* ===================== 06.4 : threshold ============================== */
console.log("=".repeat(78));
console.log("06.4  THRESHOLD — c-rubric-3b, all 94, repeats 5, panel threshold");
for (const t of [0, 0.05, 0.2, 0.4, 0.5, 0.6, 0.8, 0.95, 1]) {
  const r = compute({ judge: "c-rubric-3b", size: 94, strategy: "all", seed: 7, repeats: 5, threshold: t, panel: "threshold" });
  console.log(`thr ${t.toFixed(2)}  ${JSON.stringify(r.m.confusion)}  kappa ${r.m.kappa.toFixed(3)} (${r.m.ci.kappa ? `${r.m.ci.kappa.lo.toFixed(2)}-${r.m.ci.kappa.hi.toFixed(2)}` : ""}) tpr ${pct(r.m.tpr)} tnr ${pct(r.m.tnr)} pass ${pct(r.passRate.point)} ${pctInterval(r.passRate)}`);
}
console.log("--- same judge, 1 greedy sample (no repeats) ---");
for (const t of [0.5]) {
  const r = compute({ judge: "c-rubric-3b", size: 94, strategy: "all", seed: 7, repeats: 1, panel: "threshold" });
  console.log(`greedy ${JSON.stringify(r.m.confusion)} kappa ${r.m.kappa.toFixed(3)} tpr ${pct(r.m.tpr)} tnr ${pct(r.m.tnr)} pass ${pct(r.passRate.point)}`);
}
console.log("--- c-plain-3b with repeats 5, all 94 ---");
for (const t of [0.2, 0.5, 1]) {
  const r = compute({ judge: "c-plain-3b", size: 94, strategy: "all", seed: 7, repeats: 5, threshold: t, panel: "threshold" });
  console.log(`thr ${t.toFixed(2)}  ${JSON.stringify(r.m.confusion)}  kappa ${r.m.kappa.toFixed(3)} tpr ${pct(r.m.tpr)} tnr ${pct(r.m.tnr)} pass ${pct(r.passRate.point)}`);
}
console.log("--- cost of a run ---");
for (const id of ["c-plain-3b", "c-rubric-3b"]) {
  const c = D.cost[id];
  console.log(`${judgeLabel.get(id)} | ${c.model} | ${c.input_tokens} in / ${c.output_tokens} out | ${c.latency_ms} ms | $${c.cost_usd.toFixed(5)}/call | 94 calls $${(c.cost_usd * 94).toFixed(4)} | 5x $${(c.cost_usd * 94 * 5).toFixed(4)} | 40 calls $${(c.cost_usd * 40).toFixed(4)}`);
}
console.log("--- repeats table (majority vote, agreement panel semantics) ---");
{
  const s = { judge: "c-rubric-3b", variant: "v1", split: "dev", size: 94, strategy: "all", repeats: 1, threshold: 0.5, seed: 19, panel: "verdicts" };
  for (let k = 1; k <= 5; k++) {
    s.repeats = k;
    const r = compute(s);
    console.log(`repeats ${k} ${JSON.stringify(r.m.confusion)} kappa ${r.m.kappa.toFixed(3)} ${r.m.ci.kappa ? `${r.m.ci.kappa.lo.toFixed(2)}-${r.m.ci.kappa.hi.toFixed(2)}` : ""} $${(D.cost[s.judge].cost_usd * 94 * k).toFixed(4)}`);
  }
}

/* ===================== 06.5 : corrected pass rate ===================== */
console.log("=".repeat(78));
console.log("06.5  CORRECTED PASS RATE");
for (const judge of ["c-plain-3b", "c-rubric-3b", "c-step-3b", "c-crit-3b", "c-plain-0.6b", "c-plain-1.7b", "c-rubric-0.6b", "c-rubric-7b"]) {
  const r = compute({ judge, size: 94, strategy: "all", seed: 7, panel: "corrected" });
  console.log(`${judgeLabel.get(judge).padEnd(32)} obs ${pct(r.passRate.point)} ${pctInterval(r.passRate)}  devTPR ${pct(r.devM.tpr)} devTNR ${pct(r.devM.tnr)} denom ${(r.devM.tpr + r.devM.tnr - 1).toFixed(4)}` +
    (r.corrected ? ` corrected ${(r.corrected.value * 100).toFixed(1)}% stable ${r.corrected.stable} oor ${r.corrected.outOfRange} ci ${(r.correctedCI.lo * 100).toFixed(1)}-${(r.correctedCI.hi * 100).toFixed(1)}` : " corrected NULL"));
}
console.log("--- the preset as it opens: c-plain-3b, dev, random 40, seed 7 ---");
console.log(line(compute({ judge: "c-plain-3b", size: 40, strategy: "random", seed: 7, panel: "corrected" })));
console.log("--- dev split only (57 items) for the plain judge ---");
console.log(line(compute({ judge: "c-plain-3b", size: 57, strategy: "all", seed: 7, panel: "corrected" })));
console.log("--- rubric judge on all 57 dev ---");
console.log(line(compute({ judge: "c-rubric-3b", size: 57, strategy: "all", seed: 7, panel: "corrected" })));

/* ===================== validate ====================================== */
console.log("=".repeat(78));
console.log("VALIDATE — dev vs test (all items of each split)");
for (const judge of ["c-plain-3b", "c-rubric-3b"]) {
  const dv = compute({ judge, size: 57, strategy: "all", seed: 7, split: "dev" });
  const te = compute({ judge, size: 37, strategy: "all", seed: 7, split: "test" });
  console.log(`${judgeLabel.get(judge)} dev  ${JSON.stringify(dv.m.confusion)} kappa ${dv.m.kappa.toFixed(2)} ${dv.m.ci.kappa.lo.toFixed(2)}-${dv.m.ci.kappa.hi.toFixed(2)} tpr ${pct(dv.m.tpr)} tnr ${pct(dv.m.tnr)} acc ${pct(dv.m.accuracy)}`);
  console.log(`${judgeLabel.get(judge)} test ${JSON.stringify(te.m.confusion)} kappa ${te.m.kappa.toFixed(2)} ${te.m.ci.kappa.lo.toFixed(2)}-${te.m.ci.kappa.hi.toFixed(2)} tpr ${pct(te.m.tpr)} tnr ${pct(te.m.tnr)} acc ${pct(te.m.accuracy)}`);
}

/* ===================== hand-checkable kappa example =================== */
console.log("=".repeat(78));
console.log("HAND EXAMPLE — 10 items");
{
  const pairs = [
    { human: 1, judge: 1 }, { human: 0, judge: 0 }, { human: 1, judge: 1 }, { human: 0, judge: 1 },
    { human: 1, judge: 1 }, { human: 0, judge: 0 }, { human: 1, judge: 0 }, { human: 0, judge: 1 },
    { human: 0, judge: 0 }, { human: 1, judge: 1 },
  ];
  const c = confusion(pairs);
  console.log(JSON.stringify(c), cohensKappa(c).toFixed(3));
}
{
  // 6-item version for the lesson
  const pairs = [
    { human: 1, judge: 1 }, { human: 0, judge: 0 }, { human: 1, judge: 0 },
    { human: 0, judge: 0 }, { human: 1, judge: 1 }, { human: 0, judge: 1 },
  ];
  const c = confusion(pairs);
  console.log("6-item:", JSON.stringify(c), cohensKappa(c).toFixed(3), "acc", ((c.tp + c.tn) / c.n).toFixed(3));
}