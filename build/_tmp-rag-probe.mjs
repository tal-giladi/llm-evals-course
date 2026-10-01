// THROWAWAY — dump the RAG dataset readably. Delete when done.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
new Function("window", readFileSync(join(ROOT, "simulations/rag-evals/data.js"), "utf8"))(win);
const D = win.EvalLabData.rag;

console.log("dataset:", D.dataset, "|", D.title);
console.log("variants:", JSON.stringify(D.variants, null, 1));
console.log("judge_menu:", JSON.stringify(D.judge_menu, null, 1));
console.log("n items:", D.items.length);
console.log("\n=== ITEMS ===");
for (const it of D.items) {
  console.log(`\n${it.id} | should_abstain=${it.should_abstain} | passages=${it.passages.length}`);
  console.log(`  Q: ${it.question}`);
  for (const p of it.passages) console.log(`  P: ${p}`);
  for (const v of ["v1", "v2", "v3"]) {
    const h = it.human[v];
    console.log(`  ${v} [label=${h.label} cat=${h.category}] :: ${it.outputs[v]}`);
    if (v === "v1") console.log(`      critique: ${h.critique}`);
  }
}
console.log("\n=== RUN TABLE KEYS ===");
for (const j of D.judge_menu) {
  const t = D.runs[j.id] || {};
  const keys = Object.keys(t);
  console.log(`\n${j.id} (${j.label}) — ${keys.length} keys`);
  for (const it of D.items) {
    console.log(`  ${it.id}: A=${JSON.stringify(t[`${it.id}|v1`])} B=${JSON.stringify(t[`${it.id}|v2`])} C=${JSON.stringify(t[`${it.id}|v3`])}`);
  }
}