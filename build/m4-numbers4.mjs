// Throwaway part 4: TNR intervals and per-slice TNR from a recorded judge run.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
new Function("window", readFileSync(join(ROOT, "simulations/judge-lab/data.js"), "utf8"))(win);
const D = win.EvalLabData.support;
const { wilson, confusion, tnr, tpr, cohensKappa, majorityVote } = await import(
  pathToFileURL(join(ROOT, "simulations/common/stats.js")).href
);
const pct = (x, d = 1) => (x === null ? "undefined" : (x * 100).toFixed(d) + "%");
const pctI = (ci) => `${pct(ci.lo)}-${pct(ci.hi)}`;

console.log("=== Wilson intervals on a TNR, by how many failing items you kept ===");
for (const [c, m] of [[1, 2], [2, 2], [1, 3], [2, 3], [3, 3], [5, 6], [4, 6], [8, 10], [9, 10], [5, 10], [6, 10], [16, 20], [18, 20], [19, 20], [8, 12], [10, 12]]) {
  const ci = wilson(c, m);
  console.log(`  ${c}/${m} caught = ${pct(ci.point)} [${pct(ci.lo)}, ${pct(ci.hi)}] width ${Math.round((ci.hi - ci.lo) * 100)} pts`);
}

console.log("\n=== per-slice TNR from recorded judge runs (variant v1, majority of 5) ===");
const menu = Object.fromEntries(D.judge_menu.map((j) => [j.id, j]));
for (const rid of ["c-plain-3b", "c-rubric-3b", "c-crit-3b"]) {
  const run = D.runs[rid];
  const pairs = D.items.map((it) => ({ human: it.human.v1.label, judge: majorityVote(run[`${it.id}|v1`]) }));
  const c = confusion(pairs);
  console.log(`\n  ${rid} — ${menu[rid].label}`);
  console.log(`    overall: judge pass ${c.tp + c.fp}/${pairs.length}, TPR ${pct(tpr(c))}, TNR ${pct(tnr(c))}, kappa ${cohensKappa(c).toFixed(2)}`);
  const by = new Map();
  D.items.forEach((it, i) => {
    const k = it.slice.intent;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(pairs[i]);
  });
  for (const [k, ps] of by) {
    const cc = confusion(ps);
    console.log(`      ${k.padEnd(14)} n=${String(cc.n).padStart(2)} humanFail=${cc.tn + cc.fp} judgeCaught=${cc.tn} TNR ${tnr(cc) === null ? "undefined" : pct(tnr(cc))}`);
  }
}

console.log("\n=== the n=20 seed-11 random draw: what a slice table with no failing item does to TNR ===");
{
  const { sampleItems } = await import(pathToFileURL(join(ROOT, "simulations/common/stats.js")).href);
  const run = D.runs["c-rubric-3b"];
  for (const strategy of ["random", "stratified"]) {
    const idx = sampleItems(D.items.map((_, i) => i), 20, strategy, 11);
    const pairs = idx.map((i) => ({
      human: D.items[i].human.v1.label,
      judge: majorityVote(run[`${D.items[i].id}|v1`]),
    }));
    const c = confusion(pairs);
    console.log(`  ${strategy}: overall TNR ${tnr(c) === null ? "undefined" : pct(tnr(c))} on ${c.tn + c.fp} human failures caught ${c.tn}`);
    const by = new Map();
    idx.forEach((i, j) => {
      const k = D.items[i].slice.intent;
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(pairs[j]);
    });
    for (const [k, ps] of by) {
      const cc = confusion(ps);
      console.log(`      ${k.padEnd(14)} drawn ${ps.length}  humanFail ${cc.tn + cc.fp}  caught ${cc.tn}  TNR ${tnr(cc) === null ? "undefined" : pct(tnr(cc))}`);
    }
  }
}

console.log("\n=== 04.1: the 40-item proposed allocation, category by category ===");
{
  const cat = new Map();
  for (const it of D.items) {
    const k = it.human.v1.category;
    if (!cat.has(k)) cat.set(k, []);
    cat.get(k).push(it);
  }
  const take = { correct: 12, no_citation: 12, wrong_fact: 8, over_refusal: 6, out_of_scope: 2 };
  let total = 0;
  for (const [k, n] of Object.entries(take)) {
    total += n;
    const avail = cat.get(k).length;
    const isFail = k !== "correct";
    const ci = isFail ? null : null;
    console.log(`  ${k.padEnd(14)} take ${String(n).padStart(2)} of ${String(avail).padStart(2)} available`);
  }
  console.log(`  total ${total}`);
  console.log("\n  checkable claim: with m failing items of a category in the set, a check that catches all m");
  for (const k of ["out_of_scope", "over_refusal", "wrong_fact", "no_citation"]) {
    const m = take[k];
    const ci = wilson(m, m);
    console.log(`    ${k.padEnd(14)} m=${String(m).padStart(2)} -> TNR 100% [${pct(ci.lo)}, ${pct(ci.hi)}] width ${Math.round((ci.hi - ci.lo) * 100)} pts`);
  }
}
