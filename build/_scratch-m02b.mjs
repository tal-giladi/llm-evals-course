// SCRATCH — alternate aggregations to see if 57/56/20/14/27/108 corresponds to anything real.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const g = globalThis; g.window = g;
(0, eval)(readFileSync(join(ROOT, "simulations/judge-lab/data.js"), "utf8"));

const sup = window.EvalLabData["support"];
console.log("keys:", Object.keys(sup));
const items = sup.items;
console.log("variants/labels meta:", JSON.stringify(sup.variants ?? sup.systems ?? sup.labels ?? null));
console.log("sample item keys:", Object.keys(items[0]));
console.log("dev size:", items.filter((i) => i.split === "dev").length, "test:", items.filter((i) => i.split === "test").length);
const tally = (arr) => { const c = {}; for (const k of arr) c[k] = (c[k] || 0) + 1; return c; };

const VS = ["v1", "v2", "v3"];
const cat = (i, v) => i.human[v].category;

// all
console.log("ALL:", tally(items.flatMap((i) => VS.map((v) => cat(i, v)))));
// dev only
const dev = items.filter((i) => i.split === "dev");
console.log("DEV n=", dev.length, tally(dev.flatMap((i) => VS.map((v) => cat(i, v)))));
// union per item
const uniq = new Set();
const uCount = {};
for (const i of items) {
  const s = new Set(VS.map((v) => cat(i, v)));
  for (const k of s) uCount[k] = (uCount[k] || 0) + 1;
  uniq.add(s.size);
}
console.log("items-where-category-appears:", uCount, "total:", Object.values(uCount).reduce((a, b) => a + b, 0));
// v1+v2
console.log("v1+v2:", tally(items.flatMap((i) => ["v1", "v2"].map((v) => cat(i, v)))));
// merge no_citation+extra
const merged = tally(items.flatMap((i) => VS.map((v) => cat(i, v) === "extra" ? "no_citation" : cat(i, v))));
console.log("extra folded into no_citation:", merged);
// how many items are out_of_scope
console.log("items flagged out_of_scope:", items.filter((i) => i.out_of_scope).length);