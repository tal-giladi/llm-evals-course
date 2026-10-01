// Throwaway part 5: last few numbers.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
new Function("window", readFileSync(join(ROOT, "simulations/judge-lab/data.js"), "utf8"))(win);
const D = win.EvalLabData.support;
const { wilson, sampleItems, confusion, tnr, majorityVote } = await import(
  pathToFileURL(join(ROOT, "simulations/common/stats.js")).href
);
const pct = (x) => (x === null ? "undefined" : (x * 100).toFixed(1) + "%");
const ALL = D.items.map((_, i) => i);

console.log("=== real items for the rare category ===");
for (const id of ["s89", "s90", "s17", "s18"]) {
  const it = D.items.find((x) => x.id === id);
  console.log(`  ${id} [${it.slice.intent}/${it.slice.difficulty}] q="${it.question}"`);
  console.log(`     human: label ${it.human.v1.label} category ${it.human.v1.category} — ${it.human.v1.critique}`);
  console.log(`     output A: ${it.outputs.v1}`);
}
console.log("\n=== a no_citation item and a wrong_fact item ===");
for (const id of ["s01", "s10"]) {
  const it = D.items.find((x) => x.id === id);
  console.log(`  ${id} [${it.slice.intent}/${it.slice.difficulty}] q="${it.question}"`);
  console.log(`     human: label ${it.human.v1.label} category ${it.human.v1.category} — ${it.human.v1.critique}`);
  console.log(`     output A: ${it.outputs.v1}`);
}

console.log("\n=== weak judge (c-plain-3b) TNR measured on eval-set draws ===");
{
  const run = D.runs["c-plain-3b"];
  const pairsAll = D.items.map((it) => ({ human: it.human.v1.label, judge: majorityVote(run[`${it.id}|v1`]) }));
  const cAll = confusion(pairsAll);
  console.log(`  all 94: TNR ${pct(tnr(cAll))} (${cAll.tn}/${cAll.tn + cAll.fp} human failures caught)`);
  const vals = [];
  for (let seed = 1; seed <= 200; seed++) {
    const idx = sampleItems(ALL, 20, "random", seed);
    const c = confusion(idx.map((i) => pairsAll[i]));
    if (c.tn + c.fp > 0) vals.push({ seed, t: c.tn / (c.tn + c.fp), n: c.tn + c.fp });
  }
  const ts = vals.map((v) => v.t).sort((a, b) => a - b);
  console.log(`  n=20 random over 200 seeds: min ${pct(ts[0])}, median ${pct(ts[99])}, max ${pct(ts[ts.length - 1])}`);
  console.log(`  draws with 0 human failures in them (TNR undefined): ${200 - vals.length}/200`);
  const idx = sampleItems(ALL, 20, "random", 11);
  const c = confusion(idx.map((i) => pairsAll[i]));
  console.log(`  seed 11 n=20: TNR ${pct(c.tn / (c.tn + c.fp))} (${c.tn}/${c.tn + c.fp}), overall judge pass ${c.tp + c.fp}/20`);
  const idx2 = sampleItems(ALL, 57, "random", 11);
  const c2 = confusion(idx2.map((i) => pairsAll[i]));
  console.log(`  seed 11 n=57: TNR ${pct(c2.tn / (c2.tn + c2.fp))} (${c2.tn}/${c2.tn + c2.fp})`);
}

console.log("\n=== seeds that give the extremes at n=20 ===");
{
  const rows = [];
  for (let seed = 1; seed <= 200; seed++) {
    const idx = sampleItems(ALL, 20, "random", seed);
    const p = idx.filter((i) => D.items[i].human.v1.label === 1).length;
    rows.push({ seed, p, ci: wilson(p, 20) });
  }
  rows.sort((a, b) => a.p - b.p);
  console.log("  lowest: ", rows.slice(0, 3).map((r) => `seed ${r.seed} ${r.p}/20 ${pct(r.ci.point)} [${pct(r.ci.lo)}, ${pct(r.ci.hi)}]`).join(" | "));
  console.log("  highest:", rows.slice(-3).reverse().map((r) => `seed ${r.seed} ${r.p}/20 ${pct(r.ci.point)} [${pct(r.ci.lo)}, ${pct(r.ci.hi)}]`).join(" | "));
}

console.log("\n=== 04.4: the lab size table, seed 11, random, exactly as sizePanel() prints it ===");
for (let n = 10; n <= 94; n += 5) {
  const idx = sampleItems(ALL, n, "random", 11);
  const p = idx.filter((i) => D.items[i].human.v1.label === 1).length;
  const ci = wilson(p, n);
  console.log(`| ${n} | ${pct(ci.point)} | ${pct(ci.lo)}–${pct(ci.hi)} | ${Math.round((ci.hi - ci.lo) * 100)} pts |`);
}

console.log("\n=== 04.4: detect a 10-point change, paired view ===");
{
  const a = wilson(47, 94), b = wilson(56, 94);
  console.log(`  47/94 ${pct(a.point)} [${pct(a.lo)}, ${pct(a.hi)}]  vs 56/94 ${pct(b.point)} [${pct(b.lo)}, ${pct(b.hi)}] overlap ${b.lo <= a.hi}`);
  const c = wilson(47, 94), d = wilson(59, 94);
  console.log(`  47/94 [${pct(c.lo)}, ${pct(c.hi)}]  vs 59/94 ${pct(d.point)} [${pct(d.lo)}, ${pct(d.hi)}] overlap ${d.lo <= c.hi}`);
  const e = wilson(47, 94), f = wilson(62, 94);
  console.log(`  47/94 [${pct(e.lo)}, ${pct(e.hi)}]  vs 62/94 ${pct(f.point)} [${pct(f.lo)}, ${pct(f.hi)}] overlap ${f.lo <= e.hi}`);
}

console.log("\n=== dev/test identical-split illustration ===");
{
  // If test were a copy of a 37-item draw of the same population, the numbers coincide.
  const dev = D.dev_ids.map((id) => D.items.find((i) => i.id === id)).filter(Boolean);
  const first37 = dev.slice(0, 37);
  const p = first37.filter((r) => r.human.v1.label === 1).length;
  const ci = wilson(p, 37);
  console.log(`  dev's own first 37 items: ${p}/37 = ${pct(ci.point)} [${pct(ci.lo)}, ${pct(ci.hi)}]`);
  console.log(`  real test 37: 17/37 = ${pct(wilson(17, 37).point)} [${pct(wilson(17, 37).lo)}, ${pct(wilson(17, 37).hi)}]`);
}
