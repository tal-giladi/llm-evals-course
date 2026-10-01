// Throwaway: the JavaScript engine's answers for lessons 11.1 / 11.2. Delete when done.
import { readFileSync } from "node:fs";
import {
  wilson, confusion, tpr, tnr, accuracy, cohensKappa, pairedComparison,
} from "../simulations/common/stats.js";

const D = JSON.parse(readFileSync(new URL("../datasets/support.json", import.meta.url), "utf8"));
const byId = new Map(D.items.map((i) => [i.id, i]));

const pairsFor = (judgeId, variant, ids) =>
  ids.map((id) => ({
    human: byId.get(id).human[variant].label,
    judge: D.runs[judgeId][`${id}|${variant}`][0],
  }));

console.log("=== JS: plain judge, dev, v1 ===");
const c = confusion(pairsFor("c-plain-3b", "v1", D.dev_ids));
console.log(c, "tpr", tpr(c), "tnr", tnr(c), "acc", accuracy(c), "kappa", cohensKappa(c));
console.log("wilson 38/57:", wilson(38, 57));

console.log();
console.log("=== JS: rubric judge, dev, v1 ===");
const c2 = confusion(pairsFor("c-rubric-3b", "v1", D.dev_ids));
console.log(c2, "tpr", tpr(c2), "tnr", tnr(c2), "acc", accuracy(c2), "kappa", cohensKappa(c2));
console.log("wilson 34/57:", wilson(34, 57));

console.log();
console.log("=== JS: pairedComparison v1 vs v2, rubric judge ===");
const r = pairedComparison(pairsFor("c-rubric-3b", "v1", D.dev_ids),
                           pairsFor("c-rubric-3b", "v2", D.dev_ids), { resamples: 0 });
console.log(r);

console.log();
console.log("=== JS: confusion() given TUPLES instead of {human, judge} ===");
const tuples = D.dev_ids.map((id) => [byId.get(id).human.v1.label,
                                     D.runs["c-plain-3b"][`${id}|v1`][0]]);
const bad = confusion(tuples);
console.log(bad, "tpr", tpr(bad), "tnr", tnr(bad), "acc", accuracy(bad), "kappa", cohensKappa(bad));
console.log("kappa band of the bad matrix:", cohensKappa(bad));

console.log();
console.log("=== JS: pairedComparison given tuples -> judge undefined ===");
try {
  const badCmp = pairedComparison(tuples, tuples, { resamples: 0 });
  console.log(badCmp);
} catch (e) {
  console.log("threw:", e.message);
}