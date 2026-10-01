// THROWAWAY — third pass, small numbers. Delete when done.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { wilson, pct, pctInterval } from "../simulations/common/stats.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
new Function("window", readFileSync(join(ROOT, "simulations/rag-evals/data.js"), "utf8"))(win);
const D = win.EvalLabData.rag;
const line = (s) => console.log(s);

line(`a passage came back      17/20 = ${pct(17 / 20)}  Wilson ${pctInterval(wilson(17, 20))}`);
line(`passage answers the Q   14/20 = ${pct(14 / 20)}  Wilson ${pctInterval(wilson(14, 20))}`);
line(`of the 17 returned, 14 relevant = ${pct(14 / 17)}  Wilson ${pctInterval(wilson(14, 17))}`);
line(`drop from 85.0 to 70.0 = ${(85 - 70).toFixed(1)} points`);
for (const [v, k] of [["A", 12], ["B", 11], ["C", 9]]) line(`variant ${v} grounded ${k}/20 = ${pct(k / 20)} Wilson ${pctInterval(wilson(k, 20))}`);
line(`variant B: 70.0% -> 55.0% = ${(70 - 55).toFixed(1)} points`);

line("\ncosts over 20 items (greedy, 1 verdict per answer):");
for (const [k, c] of Object.entries(D.cost)) {
  line(`  ${k.padEnd(9)} $${c.cost_usd.toFixed(5)}/call  x20 = $${(c.cost_usd * 20).toFixed(4)}   x5 repeats x20 = $${(c.cost_usd * 100).toFixed(4)}   ${c.latency_ms} ms`);
}
line(`38 claim verdicts at g-claim price = $${(38 * 0.03794).toFixed(4)}`);
line(`20 answer verdicts at g-claim price = $${(20 * 0.03794).toFixed(4)}`);

line("\nclaim tally for variant B (hand split, stated in the lesson):");
const tally = { g01: 2, g02: 2, g03: 3, g04: 2, g05: 2, g06: 3, g07: 2, g08: 3, g09: 1, g10: 1, g11: 2, g12: 2, g13: 2, g14: 2, g15: 2, g16: 2, g17: 2, g18: 1, g19: 2, g20: 0 };
const ung = { g02: 2, g04: 2, g07: 2, g08: 3, g10: 1, g13: 2, g15: 2, g18: 1, g20: 0 };
const tot = Object.values(tally).reduce((a, b) => a + b, 0);
const tu = Object.values(ung).reduce((a, b) => a + b, 0);
line(`  claims total ${tot}, ungrounded claims ${tu} = ${pct(tu / tot)}`);
line(`  answers with >=1 ungrounded claim: ${Object.keys(ung).length}/20 = ${pct(Object.keys(ung).length / 20)}`);
line(`  answers with 0 claims: g20 (all variants) = 1`);

line("\nvariant A and C claim tallies for comparison (same rule):");
const tallyA = { g01: 2, g02: 2, g03: 3, g04: 2, g05: 2, g06: 3, g07: 3, g08: 2, g09: 1, g10: 1, g11: 2, g12: 2, g13: 2, g14: 2, g15: 3, g16: 2, g17: 2, g18: 1, g19: 2, g20: 0 };
const talllyC = { g01: 2, g02: 3, g03: 3, g04: 2, g05: 2, g06: 0, g07: 2, g08: 3, g09: 1, g10: 1, g11: 3, g12: 2, g13: 2, g14: 2, g15: 2, g16: 2, g17: 2, g18: 0, g19: 2, g20: 0 };
line(`  A: ${Object.values(tallyA).reduce((a, b) => a + b, 0)} claims`);
line(`  C: ${Object.values(talllyC).reduce((a, b) => a + b, 0)} claims`);