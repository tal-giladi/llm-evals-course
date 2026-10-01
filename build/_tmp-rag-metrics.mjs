// THROWAWAY — compute every number module 8 quotes. Delete when done.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { judgeMetrics, wilson, pct, pctInterval, confusion, tpr, tnr, accuracy, cohensKappa } from "../simulations/common/stats.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
new Function("window", readFileSync(join(ROOT, "simulations/rag-evals/data.js"), "utf8"))(win);
const D = win.EvalLabData.rag;
const V = ["v1", "v2", "v3"];
const VN = { v1: "A grounded/abstains", v2: "B no abstain instruction", v3: "C small model" };
const J = D.judge_menu.map((j) => j.id);
const JN = Object.fromEntries(D.judge_menu.map((j) => [j.id, j.label]));

function pairs(judge, variant, items = D.items) {
  const t = D.runs[judge];
  return items.map((it) => ({ id: it.id, human: it.human[variant].label, judge: (t[`${it.id}|${variant}`] || [0])[0],
    category: it.human[variant].category, passages: it.passages.length }));
}
function maj(judge, variant, items = D.items) {
  const t = D.runs[judge];
  return items.map((it) => { const s = t[`${it.id}|${variant}`] || [0];
    return { id: it.id, human: it.human[variant].label, judge: s.reduce((a, b) => a + b, 0) * 2 > s.length ? 1 : 0,
      category: it.human[variant].category, passages: it.passages.length }; });
}

const line = (s) => console.log(s);

line("=========== 1. CATEGORY COUNTS (human labels, 20 items) ===========");
for (const v of V) {
  const cats = {};
  for (const it of D.items) cats[it.human[v].category] = (cats[it.human[v].category] || 0) + 1;
  line(`${v} ${VN[v]}: ` + Object.entries(cats).map(([k, n]) => `${k}=${n}`).join("  "));
  const pass = D.items.filter((it) => it.human[v].label === 1).length;
  const w = wilson(pass, 20);
  line(`   grounded (label=1): ${pass}/20 = ${pct(pass / 20)}  Wilson ${pctInterval(w)}`);
}

line("\n=========== 2. PASSAGES: how many items retrieved nothing ===========");
const empty = D.items.filter((it) => it.passages.length === 0);
const one = D.items.filter((it) => it.passages.length === 1);
const two = D.items.filter((it) => it.passages.length > 1);
line(`0 passages: ${empty.length} -> ${empty.map((i) => i.id).join(", ")}`);
line(`1 passage : ${one.length} -> ${one.map((i) => i.id).join(", ")}`);
line(`2+        : ${two.length} -> ${two.map((i) => i.id).join(", ")}`);
line(`should_abstain=true: ${D.items.filter((i) => i.should_abstain).map((i) => `${i.id}(p=${i.passages.length})`).join(", ")}`);

line("\n=========== 3. 'RETRIEVAL SUCCEEDED' METRIC on these 20 items ===========");
// A "retrieval hit" metric: the question is covered by what came back.
const covers = (it) => {
  if (it.passages.length === 0) return 0;
  // g16: passages present but the question is not covered -> generator's should_abstain flag
  return it.should_abstain ? 0 : 1;
};
const hit = D.items.filter(covers).length;
line(`context precision style (a passage was returned): ${D.items.filter((i) => i.passages.length > 0).length}/20 = ${pct(D.items.filter((i) => i.passages.length > 0).length / 20)}`);
line(`coverage (returned passage actually answers the question): ${hit}/20 = ${pct(hit / 20)}  Wilson ${pctInterval(wilson(hit, 20))}`);
line(`unanswerable questions: ${D.items.length - hit} -> ${D.items.filter((it) => !covers(it)).map((i) => `${i.id}(p=${i.passages.length},sa=${i.should_abstain})`).join(", ")}`);

line("\n=========== 4. groundPanel, exactly as app.js computes it (n=20, resamples 800, seed 5) ===========");
for (const v of V) {
  for (const j of J) {
    const p = pairs(j, v);
    const m = judgeMetrics(p, { resamples: 800, seed: 5 });
    const band = m.kappa;
    line(`${VN[v].padEnd(24)} ${JN[j].padEnd(24)} pass ${pct(m.judgePassRate)} [${pctInterval(m.ci.judgePassRate)}]  kappa ${m.kappa.toFixed(2)} [${m.ci.kappa.lo.toFixed(2)}-${m.ci.kappa.hi.toFixed(2)}]  TPR ${pct(m.tpr)}  TNR ${pct(m.tnr)}  acc ${pct(m.accuracy)}  c=${JSON.stringify(m.confusion)}`);
  }
  line("");
}

line("\n=========== 5. comparePanel, as app.js computes it (all 20 items, resamples 500, seed 9) ===========");
for (const j of J) {
  line(`judge ${JN[j]}`);
  for (const v of V) {
    const pp = D.items.map((it) => ({ human: it.human[v].label, judge: (D.runs[j][`${it.id}|${v}`] || [0])[0] }));
    const m = judgeMetrics(pp, { resamples: 500, seed: 9 });
    const ci = wilson(pp.filter((x) => x.judge === 1).length, pp.length);
    line(`   ${VN[v].padEnd(24)} grounded ${pct(ci.point)} [${pctInterval(ci)}]  kappa ${m.kappa.toFixed(2)}  TNR ${pct(m.tnr)}  acc ${pct(m.accuracy)}  c=${JSON.stringify(m.confusion)}`);
  }
}

line("\n=========== 6. UNGROUNDED ANSWERS THE JUDGE MISSED (human=1, judge=0) ===========");
for (const v of V) {
  for (const j of J) {
    const p = pairs(j, v);
    const missed = p.filter((x) => x.human === 1 && x.judge === 0);
    const fp = p.filter((x) => x.human === 0 && x.judge === 1);
    line(`${VN[v].padEnd(24)} ${JN[j].padEnd(24)} missed(good failed)=${missed.length} [${missed.map((x) => x.id).join(",")}]  falseAlarm(bad passed)=${fp.length} [${fp.map((x) => x.id).join(",")}]`);
  }
  line("");
}

line("\n=========== 7. MAJORITY OF 5 REPEATS ===========");
for (const v of V) {
  for (const j of J) {
    const g = pairs(j, v), mj = maj(j, v);
    const mg = judgeMetrics(mj, { resamples: 800, seed: 5 });
    const flips = g.filter((x, i) => x.judge !== mj[i].judge).length;
    line(`${VN[v].padEnd(24)} ${JN[j].padEnd(24)} greedy kappa ${judgeMetrics(g, { resamples: 800, seed: 5 }).kappa.toFixed(2)} TNR ${pct(tnr(confusion(g)))} | majority kappa ${mg.kappa.toFixed(2)} TNR ${pct(tnr(confusion(mj)))} TPR ${pct(tpr(confusion(mj)))} | greedy!=majority on ${flips}/20`);
  }
  line("");
}

line("\n=========== 8. REPEAT DISAGREEMENT (run-to-run noise on the same item) ===========");
for (const j of J) {
  for (const v of V) {
    let flips = 0, tot = 0;
    for (const it of D.items) { const s = D.runs[j][`${it.id}|${v}`]; if (s.some((x) => x !== s[0])) flips++; tot++; }
    line(`${JN[j].padEnd(24)} ${VN[v].padEnd(24)} flips on ${flips}/${tot} = ${pct(flips / tot)}`);
  }
  line("");
}

line("\n=========== 9. DEV/TEST SPLIT: first 10 (g01-g10) vs last 10 (g11-g20) ===========");
const dev = D.items.slice(0, 10), test = D.items.slice(10);
for (const j of J) {
  for (const v of V) {
    const dm = judgeMetrics(pairs(j, v, dev), { resamples: 800, seed: 5 });
    const tm = judgeMetrics(pairs(j, v, test), { resamples: 800, seed: 5 });
    line(`${JN[j].padEnd(24)} ${VN[v].padEnd(24)} dev(10) kappa ${dm.kappa.toFixed(2)} TPR ${pct(dm.tpr)} TNR ${pct(dm.tnr)} c=${JSON.stringify(dm.confusion)}  |  test(10) kappa ${tm.kappa.toFixed(2)} TPR ${pct(tm.tpr)} TNR ${pct(tm.tnr)} c=${JSON.stringify(tm.confusion)}`);
  }
  line("");
}

line("\n=========== 10. DEV/TEST per CATEGORY, g-strict and g-claim on v2 ===========");
for (const j of ["g-plain", "g-claim", "g-strict"]) {
  for (const v of V) {
    const cats = {};
    for (const it of D.items) { const c = it.human[v].category; cats[c] = cats[c] || { n: 0, agree: 0 }; cats[c].n++;
      const jd = (D.runs[j][`${it.id}|${v}`] || [0])[0]; if (jd === it.human[v].label) cats[c].agree++; }
    line(`${JN[j].padEnd(24)} ${VN[v].padEnd(24)} ` + Object.entries(cats).map(([c, o]) => `${c}: ${o.agree}/${o.n}`).join("  "));
  }
  line("");
}

line("\n=========== 11. ANSWERS WITH A FABRICATED NUMBER (inventory for the claim lesson) ===========");
for (const it of D.items) {
  for (const v of V) {
    const h = it.human[v];
    if (h.category === "ungrounded") {
      const nums = (it.outputs[v].match(/[\d,]+/g) || []).join(",");
      line(`${it.id} ${v} cat=${h.category} passages=${it.passages.length} nums=[${nums}]`);
      line(`     Q: ${it.question}`);
      line(`     A: ${it.outputs[v]}`);
      if (it.passages.length) it.passages.forEach((p) => line(`     P: ${p}`));
    }
  }
}

line("\n=========== 12. CLAIM COUNTS (split answer into atomic claims by hand) ===========");
line("g06 v1: 'One month, or three for senior staff. It is waived during probation.' -> 3 claims (1 month general / 3 months senior / waived in probation)");
line("g01 v1: 'At most 5 unused days carry over into the next year; anything above that is lost.' -> 2 claims");
line("g19 v1: 'Up to 3 days a week, from an approved country.' -> 2 claims");

line("\n=========== 13. COST table present? ===========");
line("cost key: " + (D.cost ? JSON.stringify(D.cost) : "ABSENT"));
line("top-level keys: " + Object.keys(D).join(", "));