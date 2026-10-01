// SCRATCH — Wilson intervals + hypergeometric for the module 2 lessons.
const z = 1.96;
function wilson(k, n) {
  const p = k / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  const den = 1 + z * z / n;
  return [( (c - m) / den * 100).toFixed(1), ((c + m) / den * 100).toFixed(1)];
}
// 5 of 20 default batch has an error chip
console.log("5/20:", wilson(5, 20));
// 27/94 true rate
console.log("27/94:", wilson(27, 94), "point", (27 / 94 * 100).toFixed(1));
// 12/94 wrong fact (v1)
console.log("12/94:", wilson(12, 94));
// 6/11 thumbs down labelled correct
console.log("6/11:", wilson(6, 11));
// 2/94 invented policy
console.log("2/94:", wilson(2, 94));
// shares
const t = { no_citation: 78, wrong_fact: 60, extra: 27, over_refusal: 22, out_of_scope: 14, correct: 81 };
for (const [k, v] of Object.entries(t)) console.log(k, v, (v / 282 * 100).toFixed(1) + "%");
// priority score share*severity/effort
const sev = { no_citation: 2, wrong_fact: 3, extra: 1, over_refusal: 3, out_of_scope: 4 };
const eff = { no_citation: 1, wrong_fact: 2, extra: 1, over_refusal: 1, out_of_scope: 2 };
const score = {};
for (const k of ["no_citation", "wrong_fact", "extra", "over_refusal", "out_of_scope"]) {
  score[k] = +((t[k] / 282 * 100) * sev[k] / eff[k]).toFixed(1);
}
console.log("priority score:", score, "ranked:", Object.entries(score).sort((a, b) => b[1] - a[1]));
console.log("frequency-only rank:", Object.entries(t).filter(([k]) => k !== "correct").sort((a, b) => b[1] - a[1]).map(([k]) => k));

// hypergeometric: P(0 of the 2 out_of_scope failures in m of 94)
const C = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
for (const m of [20, 30, 40, 60, 94]) {
  console.log(`P(0 of 2 in ${m}) =`, (C(92, m) / C(94, m)).toFixed(3));
}
for (const m of [20, 30, 40]) console.log(`expected out_of_scope in ${m} =`, (m * 2 / 94).toFixed(2));
// 22 over_refusal out of 282
console.log("22/282 =", (22 / 282 * 100).toFixed(1));
// A system: 47/94 pass
console.log("47/94", (47 / 94 * 100).toFixed(1), wilson(47, 94));
console.log("8/94", (8 / 94 * 100).toFixed(1), wilson(8, 94));
console.log("26/94", (26 / 94 * 100).toFixed(1), wilson(26, 94));