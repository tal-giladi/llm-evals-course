// TEMPORARY scratch script #4 for module 3. Deleted before reporting.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = globalThis;
new Function(readFileSync(join(ROOT, "simulations/code-checks/data.js"), "utf8"))();

const { validateSchema, parseJsonLoose, exactMatch, rougeL, contains } = await import("../simulations/common/codemetrics.js");
const { wilson, pct, pctInterval } = await import("../simulations/common/stats.js");
const D = window.EvalLabData.recipe;
const items = D.items;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isCorrect = (it, v) => { const p = parseJsonLoose(it.outputs[v]); return p.ok && eq(p.data, JSON.parse(it.reference)); };

const CHECKS = {
  contains: (it, v) => contains(it.outputs[v], it.mustContain || it.reference),
  json_parse: (it, v) => (parseJsonLoose(it.outputs[v]).ok ? 1 : 0),
  json_schema: (it, v) => { const p = parseJsonLoose(it.outputs[v]); return p.ok && validateSchema(p.data, D.schema).length === 0 ? 1 : 0; },
  exact_match: (it, v) => exactMatch(it.outputs[v], it.reference),
  "exact after parse": (it, v) => { const p = parseJsonLoose(it.outputs[v]); return p.ok && eq(p.data, JSON.parse(it.reference)) ? 1 : 0; },
};

console.log("=== confusion of each check against the true answer (object-level correctness) ===");
for (const v of D.variants) {
  const truth = items.map((it) => (isCorrect(it, v.id) ? 1 : 0));
  const nCorrect = truth.reduce((a, b) => a + b, 0);
  const nWrong = 20 - nCorrect;
  console.log(`\n${v.id} ${v.label}: truly correct ${nCorrect}/20, truly wrong ${nWrong}/20`);
  for (const [name, fn] of Object.entries(CHECKS)) {
    const v2 = items.map((it) => fn(it, v.id));
    const tp = truth.reduce((a, t, i) => a + (t === 1 && v2[i] === 1 ? 1 : 0), 0);
    const fp = truth.reduce((a, t, i) => a + (t === 0 && v2[i] === 1 ? 1 : 0), 0);
    const tnr = nWrong ? (nWrong - fp) / nWrong : null;
    const tpr = nCorrect ? tp / nCorrect : null;
    console.log(`  ${name.padEnd(18)} pass ${v2.reduce((a, b) => a + b, 0)}/20 | TNR ${tnr === null ? "—" : pct(tnr)} (caught ${nWrong - fp}/${nWrong}) | TPR ${tpr === null ? "—" : pct(tpr)} (kept ${tp}/${nCorrect})`);
  }
}

console.log("\n=== which exact_match pass on v3 / v2 is truly correct? ===");
for (const v of ["v1", "v2", "v3"]) {
  const passers = items.filter((it) => exactMatch(it.outputs[v], it.reference)).map((it) => `${it.id}(${isCorrect(it, v) ? "correct" : "WRONG"})`);
  console.log(v, passers.join(", "));
}

console.log("\n=== token lengths for the r02 hand-worked example ===");
const r02 = items.find((x) => x.id === "r02");
const { tokenize } = await import("../simulations/common/codemetrics.js");
const withChat = r02.outputs.v3;
const bare = withChat.match(/\{[\s\S]*\}/)[0];
console.log("ref tokens:", tokenize(r02.reference).length, "| with chat:", tokenize(withChat).length, "| json only:", tokenize(bare).length);
const rr = rougeL(withChat, r02.reference);
console.log(`lcs=${rr.lcs} precision=${rr.precision.toFixed(4)} recall=${rr.recall.toFixed(4)} f=${rr.f.toFixed(4)}`);
console.log("F = 2PR/(P+R) check:", (2 * rr.precision * rr.recall / (rr.precision + rr.recall)).toFixed(4));

console.log("\n=== v3 padded detail rows the learner will see ===");
const padMap = new Map();
for (const it of items) {
  const p = parseJsonLoose(it.outputs.v3);
  if (!p.ok) continue;
  const verbose = `${it.outputs.v3}\nActually, double the first ingredient — it gives a better crumb and the mixture rises more evenly in the tin. I have found this works reliably even at altitude, and many readers prefer the lighter texture that results.`;
  const a = rougeL(it.outputs.v3, it.reference), b = rougeL(verbose, it.reference);
  padMap.set(it.id, { a, b });
}
let shown = 0;
for (const it of items) {
  const m = padMap.get(it.id);
  if (!m) continue;
  if (m.b.f >= 0.99) continue;
  const det = `ROUGE-L ${m.b.f.toFixed(2)} — precision ${m.b.precision.toFixed(2)}, recall ${m.b.recall.toFixed(2)}. ` +
    (m.b.precision < 0.6 ? "Low precision: lots of tokens that are not in the reference. " : "") +
    (m.b.recall < 0.6 ? "Low recall: most of the reference is missing. " : "");
  if (shown < 4) console.log(`${it.id} ${it.name}: ${det}`);
  shown++;
}
console.log(`(${shown} items render a ROUGE detail row under the padded preset; the 4 unparseable items render "Output is not JSON at all." under json_parse/json_schema only)`);

console.log("\n=== does ROUGE detail render under rouge_l for the padded preset? count of rows < 0.99 ===");
const paddedAll = items.map((it) => {
  const p = parseJsonLoose(it.outputs.v3);
  if (!p.ok) return rougeL(it.outputs.v3, it.reference);
  const verbose = `${it.outputs.v3}\nActually, double the first ingredient — it gives a better crumb and the mixture rises more evenly in the tin. I have found this works reliably even at altitude, and many readers prefer the lighter texture that results.`;
  return rougeL(verbose, it.reference);
});
console.log("padded rows below 0.99:", paddedAll.filter((r) => r.f < 0.99).length, "of 20");
console.log("mean padded:", (paddedAll.reduce((a, r) => a + r.f, 0) / 20).toFixed(4));

console.log("\n=== exact-match-after-parse pass rates (the honest content number) ===");
for (const v of D.variants) {
  const p = items.filter((it) => CHECKS["exact after parse"](it, v.id)).length;
  console.log(`${v.id}: ${p}/20 ${pct(p / 20)} ${pctInterval(wilson(p, 20))}`);
}