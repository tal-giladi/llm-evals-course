// THROWAWAY — module 7, round 3. Deleted before reporting.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { judgeMetrics, pairedComparison, pct } from "../simulations/common/stats.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
new Function("window", readFileSync(join(ROOT, "simulations/judge-lab/data.js"), "utf8"))(win);
const D = win.EvalLabData.support;
const itemById = new Map(D.items.map((i) => [i.id, i]));

function paddingTestAll(label, cfg, ids) {
  const A = ids.map((id) => ({ human: itemById.get(id).human.v1.label, judge: D.runs[cfg][`${id}|v1`][0] }));
  const B = ids.map((id) => ({ human: itemById.get(id).human.v1.label, judge: D.runs[cfg][`${id}|v1padded`][0] }));
  const r = pairedComparison(A, B, { resamples: 1000, seed: 5 });
  console.log(label.padEnd(44), "delta", (r.delta * 100).toFixed(1) + " pts", "flips", r.fixed, "/", r.wins + r.losses, "p =", r.pValue.toFixed(4));
}
console.log("=== padding probe, ALL 94 items ===");
paddingTestAll("honest judge, 94", "c-rubric-3b", D.items.map((i) => i.id));
paddingTestAll("verbosity-biased judge, 94", "c-rubric-3b-verb", D.items.map((i) => i.id));
paddingTestAll("honest judge, 37 test", "c-rubric-3b", D.test_ids);
paddingTestAll("verbosity-biased judge, 37 test", "c-rubric-3b-verb", D.test_ids);

console.log("\n=== THE CONFOUND: family and size move together in this menu ===");
console.log("(judge family: qwen for Qwen3 + Prometheus 2, llama for Llama 3.2, flow for Flow-Judge)");
for (const v of ["v1", "v2", "v3"]) {
  const hp = D.dev_ids.filter((id) => itemById.get(id).human[v].label === 1).length;
  const row = ["c-rubric-0.6b", "c-rubric-1.7b", "c-rubric-3b", "c-rubric-3.8b", "c-rubric-7b"].map((cfg) => {
    const m = judgeMetrics(D.dev_ids.map((id) => ({ human: itemById.get(id).human[v].label, judge: D.runs[cfg][`${id}|${v}`][0] })), { resamples: 400, seed: 17 });
    return `${D.cost[cfg].model}: ${pct(m.judgePassRate)} (k=${m.kappa.toFixed(2)})`;
  });
  console.log("  ", D.variants.find((x) => x.id === v).label.padEnd(26), `human ${hp}/57`, "|", row.join(" | "));
}

console.log("\n=== 07.3 same-judge noise floor, pass rates on dev 57 ===");
for (const v of ["v1", "v2", "v3"]) {
  const a = judgeMetrics(D.dev_ids.map((id) => ({ human: itemById.get(id).human[v].label, judge: D.runs["c-rubric-3b"][`${id}|${v}`][0] })), { resamples: 300, seed: 13 });
  const b = judgeMetrics(D.dev_ids.map((id) => ({ human: itemById.get(id).human[v].label, judge: D.runs["c-rubric-3b-self"][`${id}|${v}`][0] })), { resamples: 300, seed: 13 });
  console.log("  ", v, "run 1", pct(a.judgePassRate), "k", a.kappa.toFixed(2), "| run 2", pct(b.judgePassRate), "k", b.kappa.toFixed(2));
}

console.log("\n=== 07.2 held-out validation (37 test items) ===");
for (const [label, cfg] of [["honest", "c-rubric-3b"], ["verbosity-biased", "c-rubric-3b-verb"]]) {
  for (const variant of ["v1", "v1padded"]) {
    const m = judgeMetrics(D.test_ids.map((id) => ({ human: itemById.get(id).human.v1.label, judge: D.runs[cfg][`${id}|${variant}`][0] })), { resamples: 400, seed: 11 });
    console.log("  ", label.padEnd(18), variant.padEnd(9), "pass", pct(m.judgePassRate), "TNR", pct(m.tnr), "conf", JSON.stringify(m.confusion));
  }
}

console.log("\n=== 07.1 per-pair: how many of the 12 pairs are unanimous in BOTH orders ===");
const pwin = {};
new Function("window", readFileSync(join(ROOT, "simulations/judge-lab/data-pairwise.js"), "utf8"))(pwin);
const PW = pwin.EvalLabData.pairwise;
for (const m of PW.models) {
  let bothUnanimousA = 0, bothUnanimousB = 0, mixed = 0;
  for (const id of Object.keys(PW.runs[m.id])) {
    const e = PW.runs[m.id][id];
    if (new Set(e.AB).size === 1 && new Set(e.BA).size === 1 && e.AB[0] === e.BA[0]) {
      if (e.AB[0] === "A") bothUnanimousA++; else bothUnanimousB++;
    } else mixed++;
  }
  console.log("  ", m.label.padEnd(18), "AB=BA unanimous:", bothUnanimousA, "for A /", bothUnanimousB, "for B | contested pairs:", mixed, "of 12");
}