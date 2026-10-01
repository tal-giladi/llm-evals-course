// SCRATCH — temporary verification for module 2 lessons. Delete before finishing.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const g = globalThis;
g.window = g;

const load = (p) => {
  const src = readFileSync(join(ROOT, p), "utf8");
  (0, eval)(src);
};

load("simulations/judge-lab/data.js");
load("simulations/error-analysis/data-traces.js");

const data = window.EvalLabData;
console.log("datasets:", Object.keys(data));

const sup = Object.values(data).find((d) => d.items && d.items[0]?.human?.v1?.category);
console.log("support dataset title:", sup?.title, "items:", sup?.items?.length);

const counts = {};
for (const it of sup.items) {
  for (const v of ["v1", "v2", "v3"]) {
    const c = it.human[v].category;
    counts[c] = (counts[c] || 0) + 1;
  }
}
console.log("ALL 94 x 3 category counts:", counts);
console.log("total:", Object.values(counts).reduce((a, b) => a + b, 0));

for (const v of ["v1", "v2", "v3"]) {
  const c = {};
  for (const it of sup.items) {
    const k = it.human[v].category;
    c[k] = (c[k] || 0) + 1;
  }
  console.log(v, JSON.stringify(c), "pass:", sup.items.filter((i) => i.human[v].label === 1).length);
}

// Traces
const T = data["support-traces"].traces;
console.log("traces:", T.length);
console.log("with error:", T.filter((t) => t.spans.some((s) => s.error)).length);
console.log("thumbs down:", T.filter((t) => t.user_feedback === "thumbs down").length);
console.log("thumbs up:", T.filter((t) => t.user_feedback === "thumbs up").length);
console.log("no feedback:", T.filter((t) => !t.user_feedback).length);
const errKinds = {};
for (const t of T) for (const s of t.spans) if (s.error) errKinds[s.error] = (errKinds[s.error] || 0) + 1;
console.log("error kinds:", errKinds);
const models = {};
for (const t of T) { const s = t.spans.find((x) => x.kind === "chat"); models[s.model] = (models[s.model] || 0) + 1; }
console.log("models:", models);
const sections = {};
for (const t of T) sections[t.section] = (sections[t.section] || 0) + 1;
console.log("sections:", sections);
console.log("span counts:", [...new Set(T.map((t) => t.spans.length))]);

// overlap: error AND thumbs down
console.log("error & thumbs down:", T.filter((t) => t.spans.some((s) => s.error) && t.user_feedback === "thumbs down").length);
console.log("thumbs down & no error:", T.filter((t) => !t.spans.some((s) => s.error) && t.user_feedback === "thumbs down").length);

// default random shuffle first 20
let list = T.slice();
for (let i = list.length - 1; i > 0; i--) {
  const j = (i * 7919 + 13) % (i + 1);
  [list[i], list[j]] = [list[j], list[i]];
}
const first20 = list.slice(0, 20);
console.log("default batch 20 ids:", first20.map((t) => t.id).join(","));
console.log("default batch 20 with error:", first20.filter((t) => t.spans.some((s) => s.error)).length);
console.log("default batch 20 thumbs down:", first20.filter((t) => t.user_feedback === "thumbs down").length);
console.log("default batch 20 questions:", first20.map((t, i) => `${i + 1}. ${t.id} ${t.question}`));

// error-filtered first 20
const errList = T.filter((t) => t.spans.some((s) => s.error));
console.log("errors batch size:", errList.length, "first 20:", errList.slice(0, 20).map((t) => t.id).join(","));
const tdList = T.filter((t) => t.user_feedback === "thumbs down");
console.log("thumbs down batch size:", tdList.length, "ids:", tdList.map((t) => t.id).join(","));
console.log("thumbs down categories (v1):", tdList.map((t) => sup.items.find((i) => i.id === t.id)?.human.v1.category).join(","));

// cross-tab: category by strategy
const cat = (id) => sup.items.find((i) => i.id === id)?.human.v1.category;
const tally = (arr) => { const c = {}; for (const t of arr) { const k = cat(t.id) || "?"; c[k] = (c[k] || 0) + 1; } return c; };
console.log("random20 v1 cats:", tally(first20));
console.log("errors v1 cats:", tally(errList));
console.log("thumbsdown v1 cats:", tally(tdList));

// shares
console.log("v1 correct share:", sup.items.filter((i) => i.human.v1.label === 1).length / 94);
for (const [k, n] of Object.entries(counts)) console.log(k, n, (n / 282 * 100).toFixed(1) + "% of all", (n / 94).toFixed(1) + "% of items(×3)");