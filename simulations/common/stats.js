// Eval Lab — statistics engine.
//
// Every number the lab shows is computed here, in the learner's browser, from
// per-item verdicts. Nothing is pre-rendered: change a knob, re-run, recompute.
//
// The engine never sees a "judge score" on its own. Agreement against human
// labels is computed alongside every pass rate, on purpose.
//
// Plain ES module. No dependencies. Works in a sandboxed iframe and in Node.

/* ------------------------------------------------------------------ *
 * Deterministic randomness
 *
 * The bootstrap resamples 1,000 times per recompute, so the generator
 * has to be seeded or the same knob would show different intervals on
 * every click. mulberry32 is tiny and good enough for resampling.
 * ------------------------------------------------------------------ */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string into a 32-bit integer seed, so presets are stable across sessions. */
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const Z95 = 1.959964;

/* ------------------------------------------------------------------ *
 * Proportions
 * ------------------------------------------------------------------ */

/**
 * Wilson score interval for a binomial proportion.
 *
 * The lab uses this instead of the normal approximation because eval sets
 * are small and pass rates sit near 1, where the normal interval runs
 * past 1 and is simply wrong. See lesson 04.4.
 */
export function wilson(successes, n, z = Z95) {
  if (n === 0) return { lo: 0, hi: 1, point: 0, n: 0 };
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return {
    point: p,
    lo: Math.max(0, (centre - margin) / denom),
    hi: Math.min(1, (centre + margin) / denom),
    n,
  };
}

/** Format a proportion as a percentage with one decimal. */
export function pct(x, digits = 1) {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return (x * 100).toFixed(digits) + "%";
}

/** Format an interval as "62.1%–78.4%". */
export function pctInterval(ci, digits = 1) {
  if (!ci || ci.n === 0) return "—";
  return `${pct(ci.lo, digits)}–${pct(ci.hi, digits)}`;
}

/* ------------------------------------------------------------------ *
 * Confusion matrix and judge-vs-human agreement
 * ------------------------------------------------------------------ */

/**
 * Build a confusion matrix from item-level pairs.
 *
 * A "pair" is `{ human, judge }` where both are 1 (pass) or 0 (fail).
 * Rows are the human label, columns are the judge verdict.
 */
export function confusion(pairs) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const p of pairs) {
    if (p.human === 1 && p.judge === 1) tp++;
    else if (p.human === 0 && p.judge === 1) fp++;
    else if (p.human === 1 && p.judge === 0) fn++;
    else tn++;
  }
  return { tp, fp, fn, tn, n: pairs.length };
}

/** True positive rate — of what humans passed, how much did the judge pass? */
export function tpr(c) {
  const d = c.tp + c.fn;
  return d === 0 ? null : c.tp / d;
}

/** True negative rate — of what humans failed, how much did the judge fail? */
export function tnr(c) {
  const d = c.tn + c.fp;
  return d === 0 ? null : c.tn / d;
}

export function accuracy(c) {
  return c.n === 0 ? null : (c.tp + c.tn) / c.n;
}

/** Share of items humans marked as passing. Drives the "prevalence" lesson. */
export function prevalence(c) {
  return c.n === 0 ? null : (c.tp + c.fn) / c.n;
}

/**
 * Cohen's kappa — chance-corrected agreement.
 *
 * kappa = (observed agreement - expected agreement) / (1 - expected agreement)
 *
 * High accuracy alone is misleading when almost everything passes: a judge
 * that always says "pass" scores 95% accuracy on a set where 95% is good.
 * Kappa subtracts what a coin that always guesses the majority class would
 * have scored, which is why the lab shows it next to accuracy.
 */
export function cohensKappa(c) {
  if (c.n === 0) return null;
  const po = accuracy(c);
  const humanPos = (c.tp + c.fn) / c.n;
  const humanNeg = (c.tn + c.fp) / c.n;
  const judgePos = (c.tp + c.fp) / c.n;
  const judgeNeg = (c.tn + c.fn) / c.n;
  const pe = humanPos * judgePos + humanNeg * judgeNeg;
  if (Math.abs(1 - pe) < 1e-12) return null; // degenerate: no variation to correct
  return (po - pe) / (1 - pe);
}

/** Landis & Koch style reading of kappa, used for the headline verdict. */
export function kappaBand(k) {
  if (k === null) return { label: "undefined", tone: "muted" };
  if (k < 0.2) return { label: "slight", tone: "bad" };
  if (k < 0.4) return { label: "fair", tone: "warn" };
  if (k < 0.6) return { label: "moderate", tone: "warn" };
  if (k < 0.8) return { label: "substantial", tone: "ok" };
  return { label: "almost perfect", tone: "good" };
}

/**
 * The full agreement panel for one set of item pairs, with bootstrap
 * intervals on every rate.
 */
export function judgeMetrics(pairs, opts = {}) {
  const resamples = opts.resamples ?? 1000;
  const seed = opts.seed ?? 12345;
  const c = confusion(pairs);
  const base = {
    confusion: c,
    n: c.n,
    accuracy: accuracy(c),
    tpr: tpr(c),
    tnr: tnr(c),
    prevalence: prevalence(c),
    kappa: cohensKappa(c),
    judgePassRate: c.n === 0 ? null : (c.tp + c.fp) / c.n,
  };
  if (c.n === 0) return base;

  const rng = mulberry32(seed);
  const accs = [], tprs = [], tnrs = [], kappas = [], passRates = [];
  for (let b = 0; b < resamples; b++) {
    const sample = [];
    for (let i = 0; i < c.n; i++) sample.push(pairs[(rng() * c.n) | 0]);
    const cb = confusion(sample);
    accs.push(accuracy(cb));
    const t = tpr(cb), u = tnr(cb);
    if (t !== null) tprs.push(t);
    if (u !== null) tnrs.push(u);
    const k = cohensKappa(cb);
    if (k !== null) kappas.push(k);
    passRates.push((cb.tp + cb.fp) / cb.n);
  }
  base.ci = {
    accuracy: percentileCI(accs),
    tpr: percentileCI(tprs),
    tnr: percentileCI(tnrs),
    kappa: percentileCI(kappas),
    judgePassRate: percentileCI(passRates),
  };
  return base;
}

function percentileCI(values) {
  if (values.length === 0) return null;
  const s = values.slice().sort((a, b) => a - b);
  const lo = s[Math.floor(0.025 * (s.length - 1))];
  const hi = s[Math.ceil(0.975 * (s.length - 1))];
  return { lo, hi, point: s[(s.length / 2) | 0] };
}

export { percentileCI };

/* ------------------------------------------------------------------ *
 * Correcting a pass rate for judge error
 * ------------------------------------------------------------------ */

/**
 * Rogan–Gladen style correction.
 *
 * The judge sees the answers, not the humans, so its pass rate is wrong in a
 * way we can estimate: it passes some things humans rejected (false alarms)
 * and rejects some things humans accepted (missed faults). If we know the
 * judge's TPR and TNR from the dev set, the observed pass rate implies a
 * corrected pass rate:
 *
 *     observed = TPR·S + (1 − TNR)·(1 − S)
 *   =>        S = (observed + TNR − 1) / (TPR + TNR − 1)
 *
 * The denominator is the problem. When TPR + TNR approaches 1 the judge is
 * barely better than chance and the correction explodes. The lab flags that
 * instead of hiding it — see lesson 06.5.
 */
export function correctedPassRate(observed, tprValue, tnrValue) {
  if (observed === null || tprValue === null || tnrValue === null) return null;
  const denom = tprValue + tnrValue - 1;
  if (Math.abs(denom) < 1e-6) return null;
  const s = (observed + tnrValue - 1) / denom;
  return {
    value: s,
    // Stable only if the judge is meaningfully better than a coin AND the
    // answer lands inside the possible range of a pass rate.
    stable: Math.abs(denom) > 0.2 && s >= 0 && s <= 1,
    outOfRange: s < 0 || s > 1,
    denom,
  };
}

/**
 * Bootstrap the corrected pass rate so the interval carries both the
 * sampling noise on the observed rate and the uncertainty in TPR/TNR.
 */
export function correctedPassRateCI(pairs, opts = {}) {
  const resamples = opts.resamples ?? 1000;
  const seed = opts.seed ?? 999;
  const c = confusion(pairs);
  if (c.n === 0) return null;
  const observed = (c.tp + c.fp) / c.n;
  const rng = mulberry32(seed);
  const vals = [];
  for (let b = 0; b < resamples; b++) {
    const sample = [];
    for (let i = 0; i < c.n; i++) sample.push(pairs[(rng() * c.n) | 0]);
    const cb = confusion(sample);
    const t = tpr(cb), u = tnr(cb);
    if (t === null || u === null) continue;
    const corr = correctedPassRate((cb.tp + cb.fp) / cb.n, t, u);
    if (corr && Number.isFinite(corr.value)) vals.push(corr.value);
  }
  if (vals.length === 0) return null;
  vals.sort((a, b) => a - b);
  return {
    lo: vals[Math.floor(0.025 * (vals.length - 1))],
    hi: vals[Math.ceil(0.975 * (vals.length - 1))],
    observed,
    corrected: correctedPassRate(observed, tpr(c), tnr(c)),
  };
}

/* ------------------------------------------------------------------ *
 * Sampling, repeats, voting
 * ------------------------------------------------------------------ */

/**
 * Draw a subset of item indices.
 *
 * @param items    the array to sample FROM. **Must be the item objects**, not
 *                 an array of indices — stratification groups on `item.slice`,
 *                 and passing indices silently collapses every item into one
 *                 bucket, turning "stratified" into a second random draw.
 * @param size     how many to take
 * @param strategy "all" | "random" | "stratified"
 * @param seed     makes the draw reproducible
 * @returns        indices into `items`, ascending
 *
 * "stratified" keeps the proportion of every slice, which is what lesson 04.3
 * is about: a random sample of 20 from a set that is 5% "hard refusals" is
 * almost never going to contain one.
 */
export function sampleItems(items, size, strategy, seed) {
  if (!items.length) return [];
  const n = Math.max(0, Math.min(items.length, size | 0));
  if (strategy === "all" || n === items.length) return items.map((_, i) => i);
  const rng = mulberry32(seed);
  if (strategy === "stratified") {
    const bySlice = new Map();
    items.forEach((it, i) => {
      // Accept a bare string, or an item carrying a slice descriptor.
      const k = (typeof it === "string" ? it : it && it.slice) || "all";
      if (!bySlice.has(k)) bySlice.set(k, []);
      bySlice.get(k).push(i);
    });
    const keys = [...bySlice.keys()].sort();
    const out = [];
    let remaining = n;
    // Largest-remainder allocation so the total is exactly n.
    const quotas = keys.map((k) => {
      const share = (bySlice.get(k).length / items.length) * n;
      const take = Math.min(bySlice.get(k).length, Math.floor(share));
      remaining -= take;
      return { k, bucket: bySlice.get(k), take, frac: share - Math.floor(share) };
    });
    quotas.sort((a, b) => b.frac - a.frac);
    for (const q of quotas) {
      if (remaining <= 0) break;
      const extra = Math.min(remaining, q.bucket.length - q.take);
      q.take += extra;
      remaining -= extra;
    }
    for (const q of quotas) {
      const bucket = q.bucket.slice();
      for (let i = bucket.length - 1; i > 0; i--) {
        const j = (rng() * (i + 1)) | 0;
        [bucket[i], bucket[j]] = [bucket[j], bucket[i]];
      }
      out.push(...bucket.slice(0, q.take));
    }
    return out.sort((a, b) => a - b);
  }
  // Simple random sample without replacement (partial Fisher–Yates).
  const idx = items.map((_, i) => i);
  for (let i = 0; i < n; i++) {
    const j = i + ((rng() * (idx.length - i)) | 0);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, n).sort((a, b) => a - b);
}

/** Majority verdict over repeated judge samples. Ties resolve to 0 (fail) — the safe side. */
export function majorityVote(samples) {
  if (!samples || samples.length === 0) return null;
  let ones = 0;
  for (const s of samples) if (s === 1) ones++;
  return ones * 2 > samples.length ? 1 : 0;
}

/**
 * Combine repeated samples into one score in [0,1] and apply a threshold.
 * This is the probability-weighted verdict from lesson 06.4 — the score is
 * the share of samples that said "pass", so moving the threshold knob moves
 * the operating point without re-running the judge.
 */
export function thresholdVerdict(samples, threshold) {
  if (!samples || samples.length === 0) return null;
  let ones = 0;
  for (const s of samples) if (s === 1) ones++;
  return ones / samples.length >= threshold ? 1 : 0;
}

/* ------------------------------------------------------------------ *
 * Comparing two systems on the same items
 * ------------------------------------------------------------------ */

/**
 * Paired bootstrap for system A against system B.
 *
 * Paired because both systems answered the *same* items: the item-to-item
 * difficulty cancels out, and what is left is the difference. Unpaired would
 * throw that away and need far more items to reach the same confidence.
 */
export function pairedComparison(pairsA, pairsB, opts = {}) {
  const resamples = opts.resamples ?? 1000;
  const seed = opts.seed ?? 4242;
  const n = Math.min(pairsA.length, pairsB.length);
  if (n === 0) return null;
  const diffs = [], deltas = [], wins = [], losses = [];
  for (let i = 0; i < n; i++) {
    const d = pairsA[i].judge - pairsB[i].judge;
    diffs.push(d);
    if (d > 0) wins.push(i);
    else if (d < 0) losses.push(i);
  }
  const mean = diffs.reduce((a, b) => a + b, 0) / n;
  const rng = mulberry32(seed);
  const boot = [];
  for (let b = 0; b < resamples; b++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += diffs[(rng() * n) | 0];
    boot.push(s / n);
  }
  const ci = percentileCI(boot);
  // A paired sign test: how often would a difference this large appear if
  // the two systems were actually identical?
  let positive = 0;
  for (const d of diffs) if (d > 0) positive++;
  const pTwoSided = twoSidedBinomialP(positive, wins.length + losses.length);
  return {
    n,
    delta: mean,
    ci,
    wins: wins.length,
    losses: losses.length,
    ties: n - wins.length - losses.length,
    flipIndices: wins.concat(losses),
    pValue: pTwoSided,
    // "System B is better on these items" — the readable flip list.
    fixed: wins.length,
    broke: losses.length,
  };
}

function twoSidedBinomialP(successes, trials) {
  if (trials === 0) return 1;
  // Exact two-sided binomial test under p = 0.5.
  let total = 0;
  const k = Math.min(successes, trials - successes);
  for (let i = 0; i <= k; i++) {
    let p = 1;
    for (let j = 0; j < i; j++) p *= (trials - j) / (j + 1);
    total += p;
  }
  total = (total * 2) / Math.pow(2, trials);
  return Math.min(1, total);
}

/* ------------------------------------------------------------------ *
 * Release gate simulator (module 10)
 * ------------------------------------------------------------------ */

/**
 * Given a recorded run per item, estimate what a CI gate would do.
 *
 * A gate compares the pass rate of the candidate build against the current
 * one. It fires an alert when the drop is larger than a tolerance — so every
 * gate has two failure modes and the lab prices both:
 *
 *   false alarm      — the build was fine, the gate blocked it anyway
 *   missed regression — the build was broken, the gate let it through
 *
 * The knobs are the tolerance, the repeats (noise floor) and the sample
 * size (width of the interval). Everything is estimated from the recorded
 * run-to-run spread, so the numbers move when the learner turns a knob.
 */
export function simulateGate(runs, opts) {
  const {
    tolerance = 0.05,
    repeats = 1,
    n = null,
    seed = 777,
    regressionIndex = null, // which item index carries a planted regression
  } = opts;

  const items = n ?? runs.length;
  const rng = mulberry32(seed);

  const drawPassRate = (runIdx) => {
    let ones = 0;
    for (let i = 0; i < items; i++) {
      const r = runs[(i + runIdx) % runs.length];
      ones += r[i] ? 1 : 0;
    }
    return ones / items;
  };

  // Run-to-run spread from the repeated judge samples we already recorded.
  const trials = 400;
  const healthyDrops = [];
  for (let t = 0; t < trials; t++) {
    const a = drawPassRate(0);
    const b = drawPassRate(t % runs.length);
    healthyDrops.push(a - b);
  }

  let fired = 0, missed = 0;
  const withRegression = regressionIndex !== null;
  for (let t = 0; t < trials; t++) {
    const before = drawPassRate(0);
    const afterRuns = runs.map((r) => r.slice());
    if (withRegression) {
      const idx = regressionIndex % items;
      for (const r of afterRuns) r[idx] = 0;
    }
    const after = drawPassRate(t % runs.length);
    const fires = before - after > tolerance;
    if (fires) fired++;
    if (withRegression && !fires) missed++;
  }
  return {
    falseAlarmRate: fired / trials,
    missedRate: withRegression ? missed / trials : null,
    n: items,
    repeats,
    tolerance,
  };
}
