// TEMPORARY scratch script #3 for module 3. Deleted before reporting.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = globalThis;
new Function(readFileSync(join(ROOT, "simulations/code-checks/data.js"), "utf8"))();

const { validateSchema, parseJsonLoose, numericMatch } = await import("../simulations/common/codemetrics.js");
const D = window.EvalLabData.recipe;
const items = D.items;

console.log("=== repair r01 by putting the missing ] back ===");
const r01 = items.find((x) => x.id === "r01");
const fixed = r01.outputs.v3.replace(',\n  "notes"', '],\n  "notes"');
const p = parseJsonLoose(fixed);
console.log("parses now:", p.ok, "recovered:", p.recovered);
if (p.ok) {
  const errs = validateSchema(p.data, D.schema);
  console.log("schema errors:", errs.map((e) => `${e.path} ${e.rule}: ${e.message}`).join(" ; ") || "none");
  console.log("has notes key:", "notes" in p.data, "| notes value:", JSON.stringify(p.data.notes));
  console.log("steps length:", p.data.steps.length);
}
console.log("\nreference r01 tail:", JSON.stringify(items[0].reference.slice(-90)));

console.log("\n=== numeric tolerance arithmetic, by hand ===");
const cases = [
  ["cook_minutes ref 45, model 46", 46, 45],
  ["cook_minutes ref 45, model 50", 50, 45],
  ["prep_minutes ref 600, model 610", 610, 600],
  ["prep_minutes ref 600, model 612", 612, 600],
  ["prep_minutes ref 5, model 10", 10, 5],
  ["prep_minutes ref 45, model 180 (F/C confusion)", 180, 45],
  ["prep_minutes ref 350, model 180", 180, 350],
];
for (const [label, p1, r1] of cases) {
  const rel1 = numericMatch(String(p1), String(r1), 0.01, true);
  const abs1 = numericMatch(String(p1), String(r1), 1, false);
  const rel5 = numericMatch(String(p1), String(r1), 0.05, true);
  const abs5 = numericMatch(String(p1), String(r1), 5, false);
  console.log(`${label.padEnd(46)} rel1%=${rel1} rel5%=${rel5} abs1=${abs1} abs5=${abs5}  (|diff|=${Math.abs(p1 - r1)}, 1% of ref=${(r1 * 0.01).toFixed(3)})`);
}

console.log("\n=== real cook_minutes / prep_minutes in references ===");
const cms = items.map((i) => JSON.parse(i.reference).cook_minutes);
const pms = items.map((i) => JSON.parse(i.reference).prep_minutes);
console.log("cook_minutes:", cms.join(", "));
console.log("prep_minutes:", pms.join(", "));
console.log("distinct cook:", [...new Set(cms)].sort((a, b) => a - b).join(", "));

console.log("\n=== 180 F in other units ===");
console.log("180 F =", ((180 - 32) * 5 / 9).toFixed(1), "C =", ((180 - 32) * 5 / 9 + 273.15).toFixed(1), "K");
console.log("350 K =", (350 - 273.15).toFixed(1), "C =", ((350 - 273.15) * 9 / 5 + 32).toFixed(1), "F");
console.log("350 F =", ((350 - 32) * 5 / 9).toFixed(1), "C");
console.log("gap 350K vs 180F written numbers:", Math.abs(350 - 180), "| as a share of 350:", (Math.abs(350 - 180) / 350).toFixed(3));
console.log("gap 350K vs 355.4K (true equivalent):", Math.abs(350 - 355.4).toFixed(1), "| share of 350:", (Math.abs(350 - 355.4) / 350).toFixed(3));
console.log("1 m = 100 cm: gap", Math.abs(1 - 100), "share of 100:", (Math.abs(1 - 100) / 100).toFixed(3));