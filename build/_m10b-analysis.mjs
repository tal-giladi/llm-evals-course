// THROWAWAY recompute for module 10 after the app fixes. Delete when done.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = globalThis;
new Function(readFileSync(join(ROOT, "simulations/judge-lab/data.js"), "utf8")).call(globalThis);
const D = globalThis.window.EvalLabData.support;
const S = await import(pathToFileURL(join(ROOT, "simulations/common/stats.js")).href);
const { pairedComparison, simulateGate, sampleItems, wilson, pct } = S;

const JUDGE = "c-rubric-3b";           // state.judge, hardcoded
let st = { judge: JUDGE, n: 94, seed: 23, tolerance: 0.05, repeats: 3 };

function verdict(id, v, reps = 3) {
  const s = D.runs[st.judge][`${id}|${v}`] || [0];
  if (reps <= 1) return s[0];
  const u = s.slice(0, reps);
  return u.reduce((a, b) => a + b, 0) * 2 > u.length ? 1 : 0;
}
// EXACT replica of the fixed chosen()
function chosen(n = st.n) {
  return sampleItems(D.items, Math.min(n, D.items.length), n >= D.items.length ? "all" : "random", st.seed)
    .map((i) => D.items[i].id);
}

/* ================= 10.1 : A/B panel ================= */
console.log("=== A/B panel, default state (n=94) ===");
function ab(aV, bV, n = 94, reps = 3, seed = 23) {
  const ids = chosen(n);
  const pa = ids.map((id) => ({ human: D.items.find((x) => x.id === id).human[aV]?.label ?? 0, judge: verdict(id, aV, reps) }));
  const pb = ids.map((id) => ({ human: D.items.find((x) => x.id === id).human[bV]?.label ?? 0, judge: verdict(id, bV, reps) }));
  const pc = pairedComparison(pa, pb, { resamples: 1000, seed });
  const fixed = ids.filter((id) => verdict(id, bV, reps) > verdict(id, aV, reps));
  const broke = ids.filter((id) => verdict(id, bV, reps) < verdict(id, aV, reps));
  const a = pa.filter((x) => x.judge === 1).length, b = pb.filter((x) => x.judge === 1).length;
  console.log(`  ${aV} vs ${bV} n=${ids.length} r=${reps}: A ${a}/${ids.length} ${pct(a / ids.length)}  B ${b}/${ids.length} ${pct(b / ids.length)}  diff ${(pc.delta * 100).toFixed(1)} CI [${(pc.ci.lo * 100).toFixed(1)}, ${(pc.ci.hi * 100).toFixed(1)}] half ${((pc.ci.hi - pc.ci.lo) * 50).toFixed(1)} p=${pc.pValue.toFixed(3)} fixed ${fixed.length} broke ${broke.length} ties ${pc.ties}`);
  return { pc, a, b, ids, fixed, broke };
}
const r1 = ab("v1", "v2");
console.log("  fixed:", r1.fixed.join(", "));
console.log("  broke:", r1.broke.join(", "));
ab("v1", "v3"); ab("v2", "v3"); ab("v1", "v1padded"); ab("v2", "v1padded");

console.log("\n=== A/B panel with the Items knob now live (seed 23, repeats 3) ===");
for (const n of [10, 20, 30, 40, 60, 80, 94]) {
  ab("v1", "v2", n);
}
console.log("\n  overlap between draws (seed 23):");
const s20 = new Set(chosen(20)), s40 = new Set(chosen(40)), s60 = new Set(chosen(60)), s94 = new Set(chosen(94));
const ov = (a, b) => [...a].filter((x) => b.has(x)).length;
console.log(`   20∩40=${ov(s20, s40)}  20∩60=${ov(s20, s60)}  40∩60=${ov(s40, s60)}  40∩94=${ov(s40, s94)}`);
console.log(`   20 items: ${chosen(20).join(",")}`);
console.log(`   40 items: ${chosen(40).join(",")}`);

console.log("\n=== interval width by item count, repeats 3, seed 23 (now what the panel shows) ===");
for (const n of [20, 40, 94]) {
  const ids = chosen(n);
  const pa = ids.map((id) => ({ human: 0, judge: verdict(id, "v1", 3) }));
  const pb = ids.map((id) => ({ human: 0, judge: verdict(id, "v2", 3) }));
  const pc = pairedComparison(pa, pb, { resamples: 1000, seed: 23 });
  console.log(`  n=${n} r=3: diff ${(pc.delta * 100).toFixed(1)} CI [${(pc.ci.lo * 100).toFixed(1)}, ${(pc.ci.hi * 100).toFixed(1)}] width ${((pc.ci.hi - pc.ci.lo) * 100).toFixed(1)} half ${((pc.ci.hi - pc.ci.lo) * 50).toFixed(1)} p=${pc.pValue.toFixed(3)}`);
}
for (const n of [20, 40, 94]) for (const r of [1, 5]) {
  const ids = chosen(n);
  const pa = ids.map((id) => ({ human: 0, judge: verdict(id, "v1", r) }));
  const pb = ids.map((id) => ({ human: 0, judge: verdict(id, "v2", r) }));
  const pc = pairedComparison(pa, pb, { resamples: 1000, seed: 23 });
  console.log(`  n=${n} r=${r}: diff ${(pc.delta * 100).toFixed(1)} CI [${(pc.ci.lo * 100).toFixed(1)}, ${(pc.ci.hi * 100).toFixed(1)}] half ${((pc.ci.hi - pc.ci.lo) * 50).toFixed(1)}`);
}

console.log("\n=== dev/held-out (unchanged: dataset's own split) ===");
function cmp(ids, aV, bV, reps = 3) {
  const pa = ids.map((id) => ({ human: D.items.find((x) => x.id === id).human[aV]?.label ?? 0, judge: verdict(id, aV, reps) }));
  const pb = ids.map((id) => ({ human: D.items.find((x) => x.id === id).human[bV]?.label ?? 0, judge: verdict(id, bV, reps) }));
  const pc = pairedComparison(pa, pb, { resamples: 1000, seed: 23 });
  const fx = ids.filter((id) => verdict(id, bV, reps) > verdict(id, aV, reps)).length;
  const bk = ids.filter((id) => verdict(id, bV, reps) < verdict(id, aV, reps)).length;
  console.log(`  n=${ids.length} ${aV} vs ${bV}: diff ${(pc.delta * 100).toFixed(1)} CI [${(pc.ci.lo * 100).toFixed(1)}, ${(pc.ci.hi * 100).toFixed(1)}] half ${((pc.ci.hi - pc.ci.lo) * 50).toFixed(1)} p=${pc.pValue.toFixed(3)} (${pc.wins} vs ${pc.losses}) fixed ${fx} broke ${bk}`);
  return pc;
}
cmp(D.dev_ids, "v1", "v2"); cmp(D.test_ids, "v1", "v2");
cmp(D.dev_ids, "v1", "v1padded"); cmp(D.test_ids, "v1", "v1padded");
for (const [nm, ids] of [["dev", D.dev_ids], ["test", D.test_ids]]) {
  for (const v of ["v1", "v2"]) {
    const p = ids.filter((id) => D.items.find((x) => x.id === id).human[v]?.label === 1).length;
    console.log(`  human pass ${nm} ${v}: ${p}/${ids.length} ${pct(p / ids.length)}`);
  }
}

/* ================= 10.2 : confirm variance factors over all 94 ================= */
console.log("\n=== 10.2 check: variance decomposition over all 94 judge verdicts (R=3) ===");
const ALL = D.items.map((i) => i.id);
for (const [aV, bV] of [["v1", "v2"], ["v1", "v3"], ["v2", "v3"], ["v1", "v1padded"], ["v2", "v1padded"]]) {
  const X = ALL.map((id) => verdict(id, aV)), Y = ALL.map((id) => verdict(id, bV));
  const mean = (z) => z.reduce((a, b) => a + b, 0) / z.length;
  const varr = (z) => { const m = mean(z); return z.reduce((a, b) => a + (b - m) ** 2, 0) / z.length; };
  const cov = varr(X) + varr(Y) - varr(X.map((x, i) => x - Y[i]));
  const agree = X.filter((x, i) => x === Y[i]).length;
  const ratio = (varr(X) + varr(Y)) / varr(X.map((x, i) => x - Y[i]));
  console.log(`  ${aV} vs ${bV}: agree ${agree}/94 = ${pct(agree / 94)} corr ${(cov / 2 / Math.sqrt(varr(X) * varr(Y))).toFixed(3)} variance x${ratio.toFixed(2)} items x${Math.sqrt(ratio).toFixed(2)} -> ${Math.ceil(94 * ratio)}`);
}

/* ================= 10.3 : gate panel ================= */
console.log("\n=== gate panel: exact replica ===");
function gateRuns(ids, reps) {
  const runs = [];
  for (let s = 0; s < reps; s++) {
    runs.push(ids.map((id) => (D.runs[st.judge][`${id}|v1`] || [0])[s % 5]));
  }
  return runs;
}
function gate(aV, tol, reps, n, seed, regCount = null) {
  const ids = chosen(n).slice(0, n);
  const runs = [];
  for (let s = 0; s < reps; s++) runs.push(ids.map((id) => (D.runs[st.judge][`${id}|${aV}`] || [0])[s % 5]));
  const h = simulateGate(runs, { tolerance: tol, repeats: reps, n: ids.length, seed, regressionIndex: null, ...(regCount ? { regressionCount: regCount } : {}) });
  const b = simulateGate(runs, { tolerance: tol, repeats: reps, n: ids.length, seed, regressionIndex: 0, ...(regCount ? { regressionCount: regCount } : {}) });
  return { h, b, ids };
}
console.log("default preset (n=94, A=v1, tol .05, repeats 3, seed 23):");
{
  const { h, b } = gate("v1", 0.05, 3, 94, 23);
  console.log(`  FALSE ALARMS ${pct(h.falseAlarmRate)} (${(h.falseAlarmRate * 400).toFixed(0)}/400)   MISSED ${pct(b.missedRate)} (${(b.missedRate * 400).toFixed(0)}/400)   broken items ${b.brokenItems}`);
}
console.log("\ngrid at tol 5 pts (gridRows uses chosen().slice(0,n)):");
for (const n of [20, 40, 94]) {
  for (const reps of [1, 3, 5]) {
    const { h, b } = gate("v1", 0.05, reps, n, 23);
    console.log(`  n=${String(n).padStart(2)} r=${reps}: FA ${pct(h.falseAlarmRate, 0)} (${(h.falseAlarmRate * 400).toFixed(0)})  MS ${pct(b.missedRate, 0)} (${(b.missedRate * 400).toFixed(0)})  broken ${b.brokenItems}`);
  }
}
console.log("\ntolerance sweep at n=94 r=3 (the knob's whole range):");
for (const tol of [0.00, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.10, 0.12, 0.15, 0.20, 0.25, 0.30]) {
  const { h, b } = gate("v1", tol, 3, 94, 23);
  console.log(`  tol ${(tol * 100).toFixed(0).padStart(2)}: FA ${pct(h.falseAlarmRate).padStart(6)} (${(h.falseAlarmRate * 400).toFixed(0)})  MS ${pct(b.missedRate).padStart(6)} (${(b.missedRate * 400).toFixed(0)})`);
}
console.log("\ntolerance sweep at n=20 r=1:");
for (const tol of [0.00, 0.02, 0.05, 0.10, 0.15, 0.20]) {
  const { h, b } = gate("v1", tol, 1, 20, 23);
  console.log(`  tol ${(tol * 100).toFixed(0).padStart(2)}: FA ${pct(h.falseAlarmRate).padStart(6)}  MS ${pct(b.missedRate).padStart(6)}`);
}
console.log("\nseed sweep at n=94 r=3 tol .05:");
for (const sd of [1, 7, 11, 23, 43, 99, 101, 777, 1234, 65535]) {
  const { h, b } = gate("v1", 0.05, 3, 94, sd);
  console.log(`  seed ${String(sd).padStart(5)}: FA ${pct(h.falseAlarmRate).padStart(6)} (${(h.falseAlarmRate * 400).toFixed(0)})  MS ${pct(b.missedRate).padStart(6)} (${(b.missedRate * 400).toFixed(0)})`);
}
console.log("\nseed sweep at n=20 r=1 tol .05:");
for (const sd of [1, 7, 11, 23, 43, 99, 101, 777, 1234, 65535]) {
  const { h, b } = gate("v1", 0.05, 1, 20, sd);
  console.log(`  seed ${String(sd).padStart(5)}: FA ${pct(h.falseAlarmRate).padStart(6)}  MS ${pct(b.missedRate).padStart(6)}`);
}
console.log("\nItems knob now live on the headline tiles (tol .05, repeats 3, A=v1, seed 23):");
for (const n of [20, 40, 60, 94]) {
  const { h, b, ids } = gate("v1", 0.05, 3, n, 23);
  console.log(`  Items ${String(n).padStart(2)}: FA ${pct(h.falseAlarmRate).padStart(6)}  MS ${pct(b.missedRate).padStart(6)}  (ids ${ids.length})`);
}
console.log("\nwhat the planted regression actually is:");
for (const n of [20, 40, 94]) {
  const ids = chosen(n).slice(0, n);
  for (const reps of [1, 3]) {
    const brokenCount = Math.max(1, Math.round(n * 0.1));
    const broken = ids.slice(0, brokenCount);
    const pass = broken.filter((id) => verdict(id, "v1", reps) === 1).length;
    console.log(`  n=${n} r=${reps}: broken items = first ${brokenCount} (${broken.join(",")}), of which A passes ${pass} -> planted drop ${((pass / n) * 100).toFixed(2)} pts`);
  }
}
console.log("\nregressionCount sweep at n=94 r=3 tol .05 (manual, not on the panel):");
for (const c of [1, 3, 9, 19, 30]) {
  const { h, b } = gate("v1", 0.05, 3, 94, 23, c);
  console.log(`  regressionCount ${String(c).padStart(2)}: FA ${pct(h.falseAlarmRate)}  MS ${pct(b.missedRate)}`);
}
console.log("\nother baselines at tol .05, n=94, repeats 3/1/5:");
for (const a of ["v2", "v3", "v1padded"]) {
  for (const reps of [1, 3, 5]) {
    const ids = chosen(94);
    const runs = [];
    for (let s = 0; s < reps; s++) runs.push(ids.map((id) => (D.runs[JUDGE][`${id}|${a}`] || [0])[s % 5]));
    const h = simulateGate(runs, { tolerance: 0.05, repeats: reps, n: 94, seed: 23, regressionIndex: null });
    const b = simulateGate(runs, { tolerance: 0.05, repeats: reps, n: 94, seed: 23, regressionIndex: 0 });
    console.log(`  A=${a} r=${reps}: FA ${pct(h.falseAlarmRate)}  MS ${pct(b.missedRate)}`);
  }
}

/* ================= 10.4 : safety panel unchanged at n=94 ================= */
console.log("\n=== 10.4 check: safety panel at n=94 ===");
for (const v of D.variants) {
  const ids = chosen(94);
  const over = ids.filter((id) => D.items.find((x) => x.id === id).human[v.id]?.category === "over_refusal").length;
  const wrong = ids.filter((id) => ["wrong_fact", "out_of_scope"].includes(D.items.find((x) => x.id === id).human[v.id]?.category)).length;
  const unlab = ids.filter((id) => D.items.find((x) => x.id === id).human[v.id]?.category === undefined).length;
  console.log(`  ${v.id.padEnd(8)} over ${over}  wrong ${wrong}  share ${pct(wrong / ids.length, 0)}  unlabelled ${unlab}`);
}