// THROWAWAY — second pass. Delete when done.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { judgeMetrics, wilson, pct, pctInterval, confusion, majorityVote } from "../simulations/common/stats.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
new Function("window", readFileSync(join(ROOT, "simulations/rag-evals/data.js"), "utf8"))(win);
const D = win.EvalLabData.rag;
const V = ["v1", "v2", "v3"];
const VN = { v1: "A", v2: "B", v3: "C" };
const J = ["g-plain", "g-claim", "g-strict"];
const JN = { "g-plain": "g-plain  Qwen3 1.7B Plain", "g-claim": "g-claim  Llama 3.2 3B Stepwise", "g-strict": "g-strict  Prometheus 2 7B Stepwise 3-shot" };
const line = (s) => console.log(s);

// Retrieval-side read: does the returned passage set answer the question?
const MISS = new Set(["g04", "g07", "g08", "g15", "g16", "g18"]);
const HIT = D.items.filter((it) => !MISS.has(it.id));
const MISSED = D.items.filter((it) => MISS.has(it.id));

line("=========== A. RETRIEVAL vs ANSWER, split by inspection ===========");
line(`retrieval hit  : ${HIT.length}/20 = ${pct(HIT.length / 20)}  Wilson ${pctInterval(wilson(HIT.length, 20))}  -> ${HIT.map((i) => i.id).join(",")}`);
line(`retrieval miss : ${MISSED.length}/20 = ${pct(MISSED.length / 20)}  -> ${MISSED.map((i) => `${i.id}(p=${i.passages.length})`).join(",")}`);
for (const it of MISSED) line(`   ${it.id} "${it.question}"  <- ${it.passages.length ? `"${it.passages[0]}"` : "(nothing returned)"}`);
line("");
for (const v of V) {
  const h = HIT.filter((it) => it.human[v].label === 1).length;
  const m = MISSED.filter((it) => it.human[v].label === 1).length;
  line(`variant ${VN[v]}: grounded among retrieval HIT  ${h}/${HIT.length} = ${pct(h / HIT.length)}  Wilson ${pctInterval(wilson(h, HIT.length))}`);
  line(`variant ${VN[v]}: grounded among retrieval MISS ${m}/${MISSED.length} = ${pct(m / MISSED.length)}`);
}

line("\n=========== B. abstainPanel, exactly as app.js computes it ===========");
for (const v of V) {
  const empty = D.items.filter((it) => it.passages.length === 0);
  const answeredAnyway = empty.filter((it) => it.human[v].category === "should_have_abstained");
  const abstained = empty.filter((it) => it.human[v].category === "grounded" && it.should_abstain);
  const falseRefusals = D.items.filter((it) => it.human[v].category === "over_refusal");
  line(`variant ${VN[v]}: empty-retrieval=${empty.length}  answered-anyway=${answeredAnyway.length} [${answeredAnyway.map((i) => i.id)}]  correctly-abstained=${abstained.length} [${abstained.map((i) => i.id)}]  over-refusals=${falseRefusals.length} [${falseRefusals.map((i) => i.id)}]`);
  for (const it of empty) line(`    ${it.id} p=${it.passages.length} sa=${it.should_abstain} cat=${it.human[v].category} :: ${it.outputs[v]}`);
}

line("\n=========== C. 'missed' panel as app.js counts it (human !== judge, BOTH directions) ===========");
for (const v of V) {
  for (const j of J) {
    const p = D.items.map((it) => ({ it, human: it.human[v].label, judge: (D.runs[j][`${it.id}|${v}`] || [0])[0] }));
    const bad = p.filter((x) => x.human !== x.judge);
    line(`panel title would read "Ungrounded answers the judge missed (${bad.length})"  [${JN[j].slice(0, 8)} variant ${VN[v]}]  ids=[${bad.map((x) => x.it.id).join(",")}]  (truly missed good: ${bad.filter((x) => x.human === 1).length})`);
  }
}

line("\n=========== D. MAJORITY VOTE detail, g-plain ===========");
for (const v of V) {
  line(`variant ${VN[v]}`);
  for (const it of D.items) {
    const s = D.runs["g-plain"][`${it.id}|${v}`];
    line(`  ${it.id} h=${it.human[v].label} cat=${it.human[v].category.padEnd(22)} samples=${JSON.stringify(s)} greedy=${s[0]} majority=${majorityVote(s)}`);
  }
}

line("\n=========== E. TNR GAP g-plain vs g-claim vs g-strict (TNR, greedy, per variant) ===========");
for (const v of V) {
  const row = J.map((j) => {
    const c = confusion(D.items.map((it) => ({ human: it.human[v].label, judge: (D.runs[j][`${it.id}|${v}`] || [0])[0] })));
    return `${JN[j].slice(0, 7)} TPR ${pct((c.tp) / (c.tp + c.fn))} TNR ${pct(c.tn / (c.tn + c.fp))} k ${((c.tp + c.tn) / c.n * 0).toFixed(0)}`;
  });
  line(`variant ${VN[v]}: ` + row.join(" | "));
}
line("\nfull kappa:");
for (const v of V) {
  for (const j of J) {
    const m = judgeMetrics(D.items.map((it) => ({ human: it.human[v].label, judge: (D.runs[j][`${it.id}|${v}`] || [0])[0] })), { resamples: 800, seed: 5 });
    line(`variant ${VN[v]} ${JN[j].slice(0, 8)}: kappa ${m.kappa.toFixed(2)} [${m.ci.kappa.lo.toFixed(2)}-${m.ci.kappa.hi.toFixed(2)}]  confusion ${JSON.stringify(m.confusion)}`);
  }
}

line("\n=========== F. preset defaults, spelled out ===========");
line("preset grounding -> variant v2 (B), panel grounding, judge default g-plain, n=20");
line("preset abstain   -> variant v2 (B), panel abstention");
line("preset compare   -> variant v2 (B), panel compare (groundPanel + comparePanel)");
for (const v of V) {
  const p = D.items.map((it) => ({ human: it.human[v].label, judge: (D.runs["g-plain"][`${it.id}|${v}`] || [0])[0] }));
  const m = judgeMetrics(p, { resamples: 800, seed: 5 });
  const w = wilson(p.filter((x) => x.judge === 1).length, 20);
  line(`  variant ${VN[v]} g-plain groundPanel: Grounded ${pct(m.judgePassRate)} [${pctInterval(m.ci.judgePassRate)}], Wilson ${pctInterval(w)}, kappa ${m.kappa.toFixed(2)}, TPR ${pct(m.tpr)}, TNR ${pct(m.tnr)}, ${JSON.stringify(m.confusion)}`);
}

line("\n=========== G. COSTS ===========");
for (const k of J) line(`${k}: ${JSON.stringify(D.cost[k])}  repeats=${D.repeeds ?? D.repeats}`);

line("\n=========== H. n=10 and n=15 knob readings (first n items) ===========");
for (const nn of [5, 10, 14, 15, 20]) {
  const sub = D.items.slice(0, nn);
  for (const v of ["v2"]) {
    const m = judgeMetrics(sub.map((it) => ({ human: it.human[v].label, judge: (D.runs["g-plain"][`${it.id}|${v}`] || [0])[0] })), { resamples: 800, seed: 5 });
    line(`n=${String(nn).padStart(2)} variant ${VN[v]} g-plain: Grounded ${pct(m.judgePassRate)} [${pctInterval(m.ci.judgePassRate)}] kappa ${m.kappa.toFixed(2)} TPR ${pct(m.tpr)} TNR ${pct(m.tnr)} ${JSON.stringify(m.confusion)}`);
  }
}

line("\n=========== I. g08 across judges/variants (the abstention item) ===========");
const g08 = D.items.find((i) => i.id === "g08");
for (const v of V) {
  line(`g08 variant ${VN[v]} cat=${g08.human[v].category} :: ${g08.outputs[v]}`);
  for (const j of J) line(`    ${j.padEnd(9)} samples=${JSON.stringify(D.runs[j][`g08|${v}`])}`);
}
const g16 = D.items.find((i) => i.id === "g16");
line(`g16 (passage present, should_abstain=true) variant B :: ${g16.outputs.v2}`);
const g20 = D.items.find((i) => i.id === "g20");
line(`g20 (answerable, all variants refuse) passage="${g20.passages[0]}"`);
for (const v of V) line(`    variant ${VN[v]} :: ${g20.outputs[v]}  | g-plain ${JSON.stringify(D.runs["g-plain"][`g20|${v}`])} g-claim ${JSON.stringify(D.runs["g-claim"][`g20|${v}`])} g-strict ${JSON.stringify(D.runs["g-strict"][`g20|${v}`])}`);