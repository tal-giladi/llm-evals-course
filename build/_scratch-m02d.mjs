// SCRATCH — default batch composition for lesson 02.3 / 02.4 examples.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const g = globalThis; g.window = g;
(0, eval)(readFileSync(join(ROOT, "simulations/error-analysis/data-traces.js"), "utf8"));
(0, eval)(readFileSync(join(ROOT, "simulations/judge-lab/data.js"), "utf8"));
const T = window.EvalLabData["support-traces"].traces;
const sup = window.EvalLabData["support"];
const cat = (id) => sup.items.find((i) => i.id === id)?.human.v1.category;

let list = T.slice();
for (let i = list.length - 1; i > 0; i--) { const j = (i * 7919 + 13) % (i + 1); [list[i], list[j]] = [list[j], list[i]]; }
const b20 = list.slice(0, 20);
const sec = {};
for (const t of b20) sec[t.section] = (sec[t.section] || 0) + 1;
console.log("default 20 sections:", sec);
const unseen = [...new Set(T.map((t) => t.section))].filter((s) => !sec[s]);
console.log("sections not in default 20:", unseen);
console.log("Investing count:", T.filter((t) => t.section === "Investing").map((t) => t.id));
console.log("Hiring count:", T.filter((t) => t.section === "Hiring").map((t) => t.id));
console.log("Planning count:", T.filter((t) => t.section === "Planning").map((t) => t.id));
// first 10 of 'Working here'
console.log("first 10 Working here:", T.filter((t) => t.section === "Working here").slice(0, 10).map((t) => `${t.id}/${cat(t.id)}`));
// out_of_scope items (7)
console.log("out_of_scope items:", sup.items.filter((i) => i.out_of_scope).map((i) => `${i.id}(${i.human.v1.category})`));
// traces for out_of_scope items, thumbs down flag
for (const i of sup.items.filter((x) => x.out_of_scope)) {
  const t = T.find((x) => x.id === i.id);
  console.log(" oos trace", i.id, "feedback:", t.user_feedback, "err:", !!t.spans.find((s) => s.error));
}
// thumbs-down traces with category
console.log("thumbs down:", T.filter((t) => t.user_feedback === "thumbs down").map((t) => `${t.id}/${cat(t.id)}`).join(" "));
// thumbs up
console.log("thumbs up:", T.filter((t) => t.user_feedback === "thumbs up").map((t) => `${t.id}/${cat(t.id)}`).join(" "));
// out-of-scope questions in the default 20
console.log("oos in default 20:", b20.filter((t) => sup.items.find((i) => i.id === t.id).out_of_scope).map((t) => `${t.id}/${cat(t.id)}`));
// error traces: all no_citation?
console.log("error traces categories:", [...new Set(T.filter((t) => t.spans.some((s) => s.error)).map((t) => cat(t.id)))]);
// how many of the 27 error traces are in the default 20
console.log("errors in default 20:", b20.filter((t) => t.spans.some((s) => s.error)).map((t) => t.id));
// total cost
const costs = T.map((t) => t.spans.find((s) => s.kind === "chat").cost_usd).sort((a, b) => a - b);
const med = costs[Math.floor(costs.length / 2)];
console.log("cost median", med, "min", costs[0], "max", costs[costs.length - 1], "sum", costs.reduce((a, b) => a + b, 0).toFixed(4));
console.log("20 cheapest-batch cost approx:", med * 20);
// durations
const root = T.map((t) => t.spans[0].duration_ms).sort((a, b) => a - b);
console.log("root median", root[47], "min", root[0], "max", root[93]);
// trace 3 and 5 of default batch detail (lesson 02.2 quotes them)
for (const t of [b20[2], b20[4]]) {
  console.log(t.id, t.question, t.user_feedback, JSON.stringify(t.spans.map((s) => ({ n: s.name, d: s.duration_ms, ot: s.output_tokens, e: s.error }))));
}