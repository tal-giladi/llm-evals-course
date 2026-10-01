// THROWAWAY — fourth pass. Delete when done.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { judgeMetrics, wilson, pct, pctInterval, confusion } from "../simulations/common/stats.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
new Function("window", readFileSync(join(ROOT, "simulations/rag-evals/data.js"), "utf8"))(win);
const D = win.EvalLabData.rag;
const line = (s) => console.log(s);
const J = ["g-plain", "g-claim", "g-strict"];
const JN = { "g-plain": "g-plain ", "g-claim": "g-claim", "g-strict": "g-strict" };

const P = (j, v, sub) => sub.map((it) => ({ human: it.human[v].label, judge: (D.runs[j][`${it.id}|${v}`] || [0])[0] }));

line("=== prefix readings, variant B (what the 'Questions' knob shows), all 3 judges ===");
for (const nn of [5, 10, 12, 14, 15, 20]) {
  const sub = D.items.slice(0, nn);
  for (const j of J) {
    const m = judgeMetrics(P(j, "v2", sub), { resamples: 800, seed: 5 });
    line(`n=${String(nn).padStart(2)} ${JN[j]} variant B: Grounded ${pct(m.judgePassRate)} [${pctInterval(m.ci.judgePassRate)}] kappa ${m.kappa.toFixed(2)} TPR ${pct(m.tpr)} TNR ${pct(m.tnr)} ${JSON.stringify(m.confusion)}`);
  }
  line("");
}

line("=== held-out remainder (items n+1..20), variant B ===");
for (const nn of [10, 14]) {
  const sub = D.items.slice(nn);
  for (const j of J) {
    const m = judgeMetrics(P(j, "v2", sub), { resamples: 800, seed: 5 });
    line(`held-out ${sub.length} (items ${nn + 1}-20) ${JN[j]} variant B: kappa ${m.kappa.toFixed(2)} [${m.ci.kappa.lo.toFixed(2)}-${m.ci.kappa.hi.toFixed(2)}] TPR ${pct(m.tpr)} TNR ${pct(m.tnr)} ${JSON.stringify(m.confusion)}`);
  }
  line("");
}

line("=== dev(1-10) / test(11-20) for ALL judges, ALL variants ===");
for (const v of ["v1", "v2", "v3"]) {
  for (const j of J) {
    const d = judgeMetrics(P(j, v, D.items.slice(0, 10)), { resamples: 800, seed: 5 });
    const t = judgeMetrics(P(j, v, D.items.slice(10)), { resamples: 800, seed: 5 });
    line(`${JN[j]} variant ${v}: dev kappa ${d.kappa.toFixed(2)} TPR ${pct(d.tpr)} TNR ${pct(d.tnr)} ${JSON.stringify(d.confusion)} | test kappa ${t.kappa.toFixed(2)} TPR ${pct(t.tpr)} TNR ${pct(t.tnr)} ${JSON.stringify(t.confusion)}`);
  }
  line("");
}

line("=== human grounded rate on prefixes (variant B) ===");
for (const nn of [10, 14, 20]) {
  const sub = D.items.slice(0, nn);
  const k = sub.filter((it) => it.human.v2.label === 1).length;
  line(`variant B first ${nn}: ${k}/${nn} = ${pct(k / nn)} Wilson ${pctInterval(wilson(k, nn))}`);
}

line("\n=== per-category agreement, variant B, all judges (greedy) ===");
for (const j of J) {
  const cats = {};
  for (const it of D.items) { const c = it.human.v2.category; cats[c] = cats[c] || { n: 0, ok: 0, ids: [] };
    cats[c].n++; if ((D.runs[j][`${it.id}|v2`] || [0])[0] === it.human.v2.label) { cats[c].ok++; cats[c].ids.push(it.id); } }
  line(`${JN[j]}: ` + Object.entries(cats).map(([c, o]) => `${c} ${o.ok}/${o.n} [${o.ids.join(",")}]`).join("  |  "));
}

line("\n=== abstention ledger by behaviour, all variants ===");
const EMPTY = D.items.filter((it) => it.passages.length === 0);
const SA = D.items.filter((it) => it.should_abstain);
const MISS = new Set(["g04", "g07", "g08", "g15", "g16", "g18"]);
const HIT = D.items.filter((it) => !MISS.has(it.id));
const NOASSERT = (t) => /^i cannot help/i.test(t.trim());
for (const v of ["v1", "v2", "v3"]) {
  const confEmpty = EMPTY.filter((it) => !NOASSERT(it.outputs[v]));
  const abstSA = SA.filter((it) => NOASSERT(it.outputs[v]) || /does not (describe|mention)/i.test(it.outputs[v]));
  const overHit = HIT.filter((it) => NOASSERT(it.outputs[v]));
  line(`variant ${v}: answered-an-empty-retrieval ${confEmpty.length}/3 [${confEmpty.map((i) => i.id)}]  abstained on should_abstain ${abstSA.length}/2 [${abstSA.map((i) => i.id)}]  refused an answerable hit ${overHit.length}/14 [${overHit.map((i) => i.id)}]`);
}
line(`\nempty-retrieval items: ${EMPTY.map((i) => i.id).join(", ")}`);
line(`should_abstain items:  ${SA.map((i) => i.id).join(", ")}`);
line(`retrieval-hit items:   ${HIT.length}, of which refused by label: ${HIT.filter((i) => ["v1", "v2", "v3"].some((v) => i.human[v].category === "over_refusal")).map((i) => i.id).join(", ")}`);
line(`\ndev(1-10) empty-retrieval: ${D.items.slice(0, 10).filter((i) => i.passages.length === 0).map((i) => i.id).join(", ")}`);
line(`test(11-20) empty-retrieval: ${D.items.slice(10).filter((i) => i.passages.length === 0).map((i) => i.id).join(", ")}`);
line(`dev(1-10) should_abstain: ${D.items.slice(0, 10).filter((i) => i.should_abstain).map((i) => i.id).join(", ")}`);
line(`test(11-20) should_abstain: ${D.items.slice(10).filter((i) => i.should_abstain).map((i) => i.id).join(", ")}`);
line(`dev retrieval-miss: ${D.items.slice(0, 10).filter((i) => MISS.has(i.id)).map((i) => i.id).join(", ")} (${D.items.slice(0, 10).filter((i) => MISS.has(i.id)).length}/10)`);
line(`test retrieval-miss: ${D.items.slice(10).filter((i) => MISS.has(i.id)).map((i) => i.id).join(", ")} (${D.items.slice(10).filter((i) => MISS.has(i.id)).length}/10)`);
line("\nitemList shows at most 8; the 'missed' panel for preset grounding:");
const bad = D.items.filter((it) => it.human.v2.label !== (D.runs["g-plain"][`${it.id}|v2`] || [0])[0]);
line(`  count ${bad.length} ids ${bad.map((i) => i.id).join(",")}`);
line("\ng20 samples:");
for (const v of ["v1", "v2", "v3"]) for (const j of J) line(`  g20|${v} ${j.padEnd(9)} ${JSON.stringify(D.runs[j][`g20|${v}`])}`);
line("\ng08 samples:");
for (const v of ["v1", "v2", "v3"]) for (const j of J) line(`  g08|${v} ${j.padEnd(9)} ${JSON.stringify(D.runs[j][`g08|${v}`])}`);