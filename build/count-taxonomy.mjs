// Recount the failure taxonomy straight from the shipped data.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
new Function("window", readFileSync(join(ROOT, "simulations/judge-lab/data.js"), "utf8"))(win);
const D = win.EvalLabData.support;

const names = { v1: "A (tuned)", v2: "B (generic)", v3: "C (small model)" };
const total = {};
const perVariant = { v1: {}, v2: {}, v3: {} };
for (const v of ["v1", "v2", "v3"]) {
  for (const it of D.items) {
    const c = it.human[v].category;
    total[c] = (total[c] || 0) + 1;
    perVariant[v][c] = (perVariant[v][c] || 0) + 1;
  }
}
const n = D.items.length * 3;
console.log(`${n} answers (${D.items.length} items x 3 variants)\n`);
console.log("category".padEnd(14), "total".padStart(6), "share".padStart(8), "   ", "A", "B", "C");
for (const [c, k] of Object.entries(total).sort((a, b) => b[1] - a[1])) {
  console.log(
    c.padEnd(14), String(k).padStart(6), `${((k / n) * 100).toFixed(1)}%`.padStart(8), "   ",
    perVariant.v1[c] || 0, perVariant.v2[c] || 0, perVariant.v3[c] || 0
  );
}
console.log("\nby variant:");
for (const v of ["v1", "v2", "v3"]) {
  const fail = Object.entries(perVariant[v]).filter(([c]) => c !== "correct").reduce((a, [, k]) => a + k, 0);
  const ok = perVariant[v].correct || 0;
  console.log(`  ${names[v].padEnd(16)} pass ${ok}/${D.items.length} (${((ok / D.items.length) * 100).toFixed(1)}%), failures ${fail}`);
}
