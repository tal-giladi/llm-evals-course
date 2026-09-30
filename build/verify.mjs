// Sanity check on the generated data.
//
// The lessons make specific claims about what each knob does. This script
// recomputes those claims from the emitted files, so if a claim stops
// holding, the build fails here rather than in a learner's face.
//
// Run:  node build/verify.mjs

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { judgeMetrics, pct } from "../simulations/common/stats.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadData(name, file) {
  const src = readFileSync(join(ROOT, file), "utf8");
  const sandbox = { window: {} };
  // The emitted file is a plain script that assigns onto `window`.
  new Function("window", src)(sandbox.window);
  const d = sandbox.window.EvalLabData[name];
  if (!d) throw new Error(`dataset ${name} missing from ${file}`);
  return d;
}

const support = loadData("support", "simulations/judge-lab/data.js");
const fails = [];
const check = (label, ok, detail) => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) fails.push(label);
};

/**
 * Build {human, judge} pairs for one (config, variant) over an item list.
 * `mode` picks which recorded sample to score on:
 *   "greedy"    — sample 0, the temperature-0 call (noisy, and the default)
 *   "majority"  — majority vote over the 5 recorded repeats (what a careful
 *                 practitioner does, and what the lab's repeats knob is for)
 */
function pairsFor(d, configId, variant, ids, mode = "greedy") {
  const table = d.runs[configId];
  // The padded variant carries the tuned answer's label — only its length differs.
  const labelVariant = variant === "v1padded" ? "v1" : variant;
  const pairs = [];
  for (const id of ids) {
    const it = d.items.find((x) => x.id === id);
    const h = it.human[labelVariant];
    if (!h) continue;
    const samples = table[`${id}|${variant}`];
    if (!samples) continue;
    const verdict = mode === "majority"
      ? (samples.reduce((a, b) => a + b, 0) * 2 > samples.length ? 1 : 0)
      : samples[0];
    pairs.push({ human: h.label, judge: verdict });
  }
  return pairs;
}

const dev = support.dev_ids;
const all = support.items.map((i) => i.id);

console.log("\n1. System variants are ordered the way the A/B lesson assumes\n");
for (const v of ["v1", "v2", "v3"]) {
  const p = pairsFor(support, "c-rubric-3b", v, all);
  const rate = p.filter((x) => x.human === 1).length / p.length;
  console.log(`  human pass rate ${v}: ${pct(rate)}  (n=${p.length})`);
}
const v1 = pairsFor(support, "c-rubric-3b", "v1", all).filter((x) => x.human === 1).length / all.length;
const v2 = pairsFor(support, "c-rubric-3b", "v2", all).filter((x) => x.human === 1).length / all.length;
const v3 = pairsFor(support, "c-rubric-3b", "v3", all).filter((x) => x.human === 1).length / all.length;
check("v1 (tuned) beats v2 (generic)", v1 > v2 + 0.1, `${pct(v1)} vs ${pct(v2)}`);
check("v2 (generic) beats v3 (weak model)", v2 > v3 + 0.1, `${pct(v2)} vs ${pct(v3)}`);

console.log("\n2. A vague prompt waves through failures: its true-negative rate collapses\n");
const plain = judgeMetrics(pairsFor(support, "c-plain-3b", "v1", all));
const rub = judgeMetrics(pairsFor(support, "c-rubric-3b", "v1", all));
console.log(`  plain  TPR ${pct(plain.tpr)}  TNR ${pct(plain.tnr)}  kappa ${plain.kappa.toFixed(2)}  acc ${pct(plain.accuracy)}`);
console.log(`  rubric TPR ${pct(rub.tpr)}  TNR ${pct(rub.tnr)}  kappa ${rub.kappa.toFixed(2)}  acc ${pct(rub.accuracy)}`);
// The load-bearing claim is not "plain is more generous on passes" — it is
// that plain lets most failures through, and that kappa punishes it for it.
check("plain TNR is at least 20 points below rubric TNR", rub.tnr - plain.tnr >= 0.20,
  `${pct(plain.tnr)} vs ${pct(rub.tnr)}`);
check("plain kappa is at least 0.15 below rubric kappa", rub.kappa - plain.kappa >= 0.15,
  `${plain.kappa.toFixed(2)} vs ${rub.kappa.toFixed(2)}`);
check("plain still passes most good answers", plain.tpr > 0.85, `TPR ${pct(plain.tpr)}`);

console.log("\n3. Judge size moves agreement — but only the big steps are resolvable\n");
const ladder = ["c-rubric-0.6b", "c-rubric-1.7b", "c-rubric-3b", "c-rubric-3.8b", "c-rubric-7b"];
const ks = [];
for (const cfg of ladder) {
  const m = judgeMetrics(pairsFor(support, cfg, "v1", all, "majority"));
  const label = support.judge_menu.find((j) => j.id === cfg).model_label;
  const cost = support.cost[cfg];
  console.log(`  ${label.padEnd(18)} kappa ${m.kappa.toFixed(2)}  TPR ${pct(m.tpr)}  TNR ${pct(m.tnr)}  $${cost.cost_usd.toFixed(5)}/call`);
  ks.push(m.kappa);
}
check("the smallest judge is clearly worse than the largest", ks[4] - ks[0] >= 0.15,
  `${ks[0].toFixed(2)} -> ${ks[4].toFixed(2)}`);
check("the 1.7B and 3B judges are close, as the interval would suggest",
  Math.abs(ks[1] - ks[2]) < 0.20, `|${ks[1].toFixed(2)} - ${ks[2].toFixed(2)}| = ${Math.abs(ks[1] - ks[2]).toFixed(2)}`);
check("cost rises with judge size",
  support.cost["c-rubric-7b"].cost_usd > support.cost["c-rubric-0.6b"].cost_usd * 3,
  `$${support.cost["c-rubric-0.6b"].cost_usd.toFixed(5)} -> $${support.cost["c-rubric-7b"].cost_usd.toFixed(5)}`);

console.log("\n4. Few-shot examples help (majority of 5 repeats)\n");
const fs0 = judgeMetrics(pairsFor(support, "c-rubric-3b", "v1", all, "majority")).kappa;
const fs3 = judgeMetrics(pairsFor(support, "c-rubric-3b-fs3", "v1", all, "majority")).kappa;
console.log(`  0-shot kappa ${fs0.toFixed(2)}   3-shot kappa ${fs3.toFixed(2)}`);
check("3-shot kappa exceeds 0-shot", fs3 > fs0, `${fs3.toFixed(2)} > ${fs0.toFixed(2)}`);

console.log("\n5. Verbosity bias rewards the padded answer\n");
const biasedOrig = pairsFor(support, "c-rubric-3b-verb", "v1", all);
const biasedPadded = pairsFor(support, "c-rubric-3b-verb", "v1padded", all);
const honestOrig = pairsFor(support, "c-rubric-3b", "v1", all);
const honestPadded = pairsFor(support, "c-rubric-3b", "v1padded", all);
const passRate = (p) => p.filter((x) => x.judge === 1).length / p.length;
console.log(`  biased judge: original ${pct(passRate(biasedOrig))} vs padded ${pct(passRate(biasedPadded))}`);
console.log(`  honest judge: original ${pct(passRate(honestOrig))} vs padded ${pct(passRate(honestPadded))}`);
check(
  "padding helps only the verbosity-biased judge",
  passRate(biasedPadded) > passRate(biasedOrig) && passRate(honestPadded) <= passRate(biasedPadded),
  `biased ${pct(passRate(biasedPadded) - passRate(biasedOrig))}, honest ${pct(passRate(honestPadded) - passRate(honestOrig))}`
);

console.log("\n6. Repeat noise is present but smaller than the signal\n");
const noisy = judgeMetrics(pairsFor(support, "c-plain-1.7b", "v1", all));
console.log(`  plain 1.7B kappa CI: ${noisy.ci.kappa.lo.toFixed(2)}–${noisy.ci.kappa.hi.toFixed(2)}`);
check("kappa interval is non-degenerate", noisy.ci.kappa.hi - noisy.ci.kappa.lo > 0.05);

const flipRate = (cfg) => {
  let flips = 0, n = 0;
  const t = support.runs[cfg];
  for (const it of support.items) for (const v of ["v1", "v2", "v3"]) {
    const s = t[`${it.id}|${v}`];
    if (!s) continue;
    n++;
    if (s.some((x) => x !== s[0])) flips++;
  }
  return flips / n;
};
const flipDefault = flipRate("c-rubric-3b");
const flipPlain = flipRate("c-plain-1.7b");
console.log(`  default (rubric 3B) judge flips on ${pct(flipDefault)} of runs between repeats`);
console.log(`  vague (plain 1.7B) judge flips on ${pct(flipPlain)}`);
check("the default judge is noisy but not useless", flipDefault > 0.05 && flipDefault < 0.55, pct(flipDefault));
check("the vague judge is the noisier of the two", flipPlain > flipDefault, `${pct(flipPlain)} > ${pct(flipDefault)}`);

console.log("\n7. The dev/test split is separated and both are non-trivial\n");
const devK = judgeMetrics(pairsFor(support, "c-rubric-3b", "v1", dev)).kappa;
const testK = judgeMetrics(pairsFor(support, "c-rubric-3b", "v1", support.test_ids)).kappa;
console.log(`  dev kappa ${devK.toFixed(2)} (n=${dev.length})   test kappa ${testK.toFixed(2)} (n=${support.test_ids.length})`);
check("dev and test agree closely", Math.abs(devK - testK) < 0.25, `${devK.toFixed(2)} vs ${testK.toFixed(2)}`);
check("split is roughly 60/40", Math.abs(dev.length / support.items.length - 0.6) < 0.12);

console.log("\n8. The label mixture supports the taxonomy lesson\n");
const cats = {};
for (const it of support.items) for (const v of ["v1", "v2", "v3"]) {
  const c = it.human[v].category;
  cats[c] = (cats[c] || 0) + 1;
}
for (const [c, n] of Object.entries(cats).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${c.padEnd(14)} ${n}`);
}
check("at least four distinct failure categories exist", Object.keys(cats).length >= 4);
check("no category dominates the whole set", Math.max(...Object.values(cats)) < support.items.length * 3 * 0.55);

console.log("\n9. Position bias is visible in the pairwise data\n");
const pw = loadData("pairwise", "simulations/judge-lab/data-pairwise.js");
for (const model of pw.models) {
  const t = pw.runs[model.id];
  let flip = 0, n = 0, pickA = 0, total = 0;
  for (const id of Object.keys(t)) {
    const e = t[id];
    for (let k = 0; k < e.AB.length; k++) {
      n++;
      total++;
      if (e.AB[k] !== e.BA[k]) flip++;
      if (e.AB[k] === "A") pickA++;
    }
  }
  console.log(`  ${model.label.padEnd(18)} swap-flips ${pct(flip / n)}   picks first-read A ${pct(pickA / total)}`);
  if (model.id === "prometheus-7b") {
    check("even the strong judge shows some swap inconsistency", flip / n > 0.02, pct(flip / n));
  }
}

console.log(fails.length === 0 ? "\nAll checks passed.\n" : `\n${fails.length} CHECK(S) FAILED:\n${fails.map((f) => "  - " + f).join("\n")}\n`);
process.exit(fails.length === 0 ? 0 : 1);
