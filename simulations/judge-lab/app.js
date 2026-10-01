// Eval Lab — judge design and validation (modules 5, 6 and 7).
//
// Every number on the page is computed here from the recorded per-item
// verdicts. Changing a knob recomputes; nothing is pre-rendered.
//
// The one rule this file is strict about: a recorded verdict is only ever
// shown for the exact judge configuration that produced it. When the learner
// edits the judge prompt away from a recorded one, the page says so and
// offers the nearest recorded variant — it never borrows another prompt's
// numbers and presents them as this prompt's.

import {
  judgeMetrics, wilson, pct, pctInterval, kappaBand,
  sampleItems, majorityVote, thresholdVerdict, correctedPassRate,
  correctedPassRateCI, hashSeed,
} from "../common/stats.js";
import {
  el, clear, knob, select, radioGroup, textArea, button, metricTile,
  confusionTable, itemList, exportJson, Scoreboard, shell, announce,
  getPreset, syncUrl, store,
} from "../common/ui.js";

const D = window.EvalLabData.support;
const PW = window.EvalLabData.pairwise;

if (!D) {
  document.body.textContent = "The judge-lab dataset failed to load.";
  throw new Error("no dataset");
}

const itemById = new Map(D.items.map((i) => [i.id, i]));
const judgeById = new Map(D.judge_menu.map((j) => [j.id, j]));

// Guards against a preset or a shared link naming a judge that does not
// exist: fall back rather than throw, so the page always renders.
function activeJudge() {
  return judgeById.has(state.judge) ? state.judge : D.judge_menu[0].id;
}

/* ================================================================== *
 * Presets — one per lesson, so a lesson link opens a specific view
 * ================================================================== */

const PRESETS = {
  "binary-first":  { judge: "c-plain-3b",    variant: "v1", panel: "verdicts" },
  "scale":         { judge: "c-rubric-3b",   variant: "v1", panel: "verdicts" },
  "rubric":        { judge: "c-plain-3b",    variant: "v1", panel: "verdicts" },
  "fewshot":       { judge: "c-rubric-3b",   variant: "v1", panel: "verdicts" },
  "format":        { judge: "c-crit-3b",     variant: "v1", panel: "verdicts" },
  "tnr":           { judge: "c-plain-3b",    variant: "v1", panel: "agreement" },
  "kappa":         { judge: "c-plain-3b",    variant: "v1", panel: "agreement" },
  "disagreements": { judge: "c-rubric-3b",   variant: "v1", panel: "disagreements" },
  "threshold":     { judge: "c-rubric-3b",   variant: "v1", panel: "threshold" },
  "corrected":     { judge: "c-plain-3b",    variant: "v1", panel: "corrected" },
  "prevalence":    { judge: "c-plain-3b",    variant: "v1", panel: "prevalence" },
  "position":      { judge: "c-rubric-7b",   variant: "v1", panel: "position" },
  "verbosity":     { judge: "c-rubric-3b-verb", variant: "v1", panel: "verbosity" },
  "self":          { judge: "c-rubric-3b-self", variant: "v1", panel: "self" },
  "size":          { judge: "c-rubric-0.6b", variant: "v1", panel: "size" },
  "repeats":       { judge: "c-rubric-3b",   variant: "v1", panel: "repeats" },
  "validate":      { judge: "c-rubric-3b",   variant: "v1", panel: "agreement", split: "test" },
};

/* ================================================================== *
 * State
 * ================================================================== */

const presetName = getPreset() || "tnr";
const preset = PRESETS[presetName] || PRESETS.tnr;

const state = {
  judge: preset.judge,
  variant: preset.variant,
  split: preset.split || "dev",
  size: 40,
  strategy: "random",
  repeats: 1,
  threshold: 0.5,
  seed: 7,
  panel: preset.panel,
  promptText: null,      // set once the learner touches the prompt box
  validated: store.get("judge-lab-validated", false),
};

const items = () => D.items.filter((i) => (state.split === "dev" ? D.dev_ids : D.test_ids).includes(i.id));
const itemIds = () => items().map((i) => i.id);

/* ================================================================== *
 * The computation
 * ================================================================== */

/** Verdict for one item, honouring the repeats and threshold knobs. */
function verdictFor(samples) {
  if (state.repeats <= 1) return samples[0];
  const used = samples.slice(0, state.repeats);
  if (state.panel === "threshold") return thresholdVerdict(used, state.threshold);
  return majorityVote(used);
}

function pairsFor() {
  const table = D.runs[activeJudge()] || D.runs[D.judge_menu[0].id];
  const all = items();
  const idx = sampleItems(all, state.size, state.strategy, state.seed + hashSeed(state.judge));
  return idx.map((i) => {
    const it = all[i];
    const samples = table[`${it.id}|${state.variant}`] || [0];
    return {
      item: it,
      human: it.human[state.variant]?.label ?? 0,
      category: it.human[state.variant]?.category ?? "unknown",
      critique: it.human[state.variant]?.critique ?? "",
      output: it.outputs[state.variant],
      samples,
      judge: verdictFor(samples),
    };
  });
}

function compute() {
  const pairs = pairsFor();
  const m = judgeMetrics(
    pairs.map((p) => ({ human: p.human, judge: p.judge })),
    { resamples: 1000, seed: state.seed + hashSeed(state.judge + state.repeats + state.threshold) }
  );
  const passed = pairs.filter((p) => p.judge === 1).length;
  const passRate = wilson(passed, pairs.length);
  const band = kappaBand(m.kappa);

  // The corrected pass rate needs a TPR/TNR estimated on the full dev set,
  // not on the sampled subset — otherwise the correction corrects itself away.
  const devPairs = (state.split === "dev" ? items() : D.items.filter((i) => D.dev_ids.includes(i.id)))
    .map((it) => {
      const s = D.runs[activeJudge()][`${it.id}|${state.variant}`] || [0];
      return { human: it.human[state.variant]?.label ?? 0, judge: verdictFor(s) };
    });
  const devM = judgeMetrics(devPairs, { resamples: 600, seed: state.seed });
  const corrected = correctedPassRate(
    passRate.point, devM.tpr, devM.tnr
  );
  const correctedCI = correctedPassRateCI(devPairs, { resamples: 600, seed: state.seed });

  return { pairs, m, passRate, band, passed, devM, corrected, correctedCI };
}

/* ================================================================== *
 * Rendering
 * ================================================================== */

const controlsRoot = el("div");
// The scoreboard lives outside controlsRoot because buildControls() clears
// that subtree on every knob change; the board has to survive a re-render.
const boardRoot = el("div");
const resultsRoot = el("div");
const board = new Scoreboard(boardRoot, "Scoreboard — pin a run, change a knob, read the diff");

function judgeOptions() {
  return D.judge_menu.map((j) => ({ value: j.id, label: j.label }));
}

function buildControls() {
  clear(controlsRoot);
  const j = judgeById.get(activeJudge());

  controlsRoot.append(
    el("div", { class: "panel" }, [
      el("h2", { text: "The knob" }),
      select({
        label: "Judge",
        options: judgeOptions(),
        value: state.judge,
        onChange: (v) => { state.judge = v; state.promptText = null; render(); },
        hint: "Each option is a different recorded run: a model, a prompt, a number of few-shot examples.",
      }),
      select({
        label: "Answer being judged",
        options: D.variants.map((v) => ({ value: v.id, label: v.label })),
        value: state.variant,
        onChange: (v) => { state.variant = v; render(); },
        hint: D.variants.find((v) => v.id === state.variant)?.note,
      }),
      radioGroup({
        label: "Items",
        options: [
          { value: "dev", label: `Dev (${D.dev_ids.length})` },
          { value: "test", label: `Test (${D.test_ids.length})` },
        ],
        value: state.split,
        onChange: (v) => { state.split = v; render(); },
        hint: "Tune on dev. Test agreement is only revealed by pressing Validate.",
      }),
    ]),

    el("div", { class: "panel" }, [
      el("h2", { text: "Sample" }),
      knob({
        label: "How many items", min: 10, max: items().length, step: 1, value: Math.min(state.size, items().length),
        format: (v) => `${v} items`,
        onInput: (v) => { state.size = v; render(); },
        hint: "Fewer items means a wider interval on everything below.",
      }),
      radioGroup({
        label: "How to choose them",
        options: [
          { value: "random", label: "At random" },
          { value: "stratified", label: "Keep the slice mix" },
          { value: "all", label: "All of them" },
        ],
        value: state.strategy,
        onChange: (v) => { state.strategy = v; render(); },
      }),
    ]),

    el("div", { class: "panel" }, [
      el("h2", { text: "Run" }),
      knob({
        label: "Repeats", min: 1, max: 5, step: 1, value: state.repeats,
        format: (v) => (v === 1 ? "1 (greedy)" : `${v} + majority`),
        onInput: (v) => { state.repeats = v; render(); },
        hint: "The same judge asked the same question, sampled at temperature.",
      }),
      el("div", { class: "field" }, [
        el("label", { for: "seed", text: "Sampling seed" }),
        el("input", { type: "number", id: "seed", value: state.seed, min: 1, max: 9999,
          onchange: (e) => { state.seed = Number(e.target.value) || 1; render(); } }),
        el("p", { class: "hint", text: "Same seed, same items, same numbers. Change it to see how much of the result was luck." }),
      ]),
      el("div", {}, [
        button("Pin as A", () => { board.pin(snapshot()); render(); }, { variant: "primary" }),
        button("Clear A", () => { board.unpin(); render(); }),
        button("Export run", () => exportJson("eval-lab-run.json", exportPayload())),
      ]),
    ])
  );
}

function snapshot() {
  const r = compute();
  return {
    caption: `${judgeById.get(activeJudge()).label} · ${state.split} · n=${r.pairs.length} · ${state.repeats} repeat${state.repeats > 1 ? "s" : ""}`,
    tiles: tilesFor(r),
  };
}

function exportPayload() {
  const r = compute();
  return {
    judge: state.judge, variant: state.variant, split: state.split,
    n: r.pairs.length, repeats: state.repeats, threshold: state.threshold,
    metrics: {
      kappa: r.m.kappa, tpr: r.m.tpr, tnr: r.m.tnr,
      accuracy: r.m.accuracy, passRate: r.passRate,
    },
    disagreements: r.pairs.filter((p) => p.human !== p.judge)
      .map((p) => ({ id: p.item.id, human: p.human, judge: p.judge, category: p.category })),
  };
}

function tilesFor(r) {
  return [
    { label: "Judge pass rate", value: pct(r.passRate.point), interval: pctInterval(r.passRate), tone: "neutral" },
    { label: "Kappa vs humans", value: r.m.kappa === null ? "—" : r.m.kappa.toFixed(2),
      interval: r.m.ci?.kappa ? `${r.m.ci.kappa.lo.toFixed(2)}–${r.m.ci.kappa.hi.toFixed(2)}` : "",
      tone: r.band.tone, note: r.band.label },
    { label: "TPR", value: pct(r.m.tpr), interval: r.m.ci?.tpr ? pctInterval(r.m.ci.tpr) : "", note: "of good answers, judge passes" },
    { label: "TNR", value: pct(r.m.tnr), interval: r.m.ci?.tnr ? pctInterval(r.m.ci.tnr) : "", note: "of bad answers, judge fails" },
    { label: "Accuracy", value: pct(r.m.accuracy), interval: r.m.ci?.accuracy ? pctInterval(r.m.ci.accuracy) : "", note: "misleading on its own" },
  ];
}

function agreementPanel(r) {
  const pane = el("div", { class: "panel" }, [
    el("h2", { text: "Does the judge agree with the humans?" }),
    el("div", { class: "tiles" }, tilesFor(r).map((t) => metricTile(t))),
  ]);
  pane.append(
    confusionTable(r.m.confusion, "Rows are human labels, columns are judge verdicts"),
    el("p", { class: "muted small" },
      `n = ${r.m.n}. The kappa interval is a bootstrap over these items, so it says how much of the ` +
      `number is the judge and how much is the sample.`),
    r.m.accuracy !== null && r.m.tpr !== null
      ? el("div", { class: `callout ${r.m.tnr < 0.7 ? "warn" : ""}` }, [
          `The judge passes ${pct(r.m.tpr)} of the answers humans passed. It fails ${pct(r.m.tnr)} of the ones humans failed. `,
          r.m.tnr < 0.7
            ? "A true-negative rate that low means most real failures sail through — this judge cannot be a release gate."
            : "That is a judge you could put in front of a gate.",
        ])
      : null,
    el("h3", { text: "Cost of this run" }),
    costPanel()
  );
  return pane;
}

function costPanel() {
  const c = D.cost[activeJudge()];
  const r = compute();
  const perRun = c.cost_usd * r.pairs.length;
  return el("div", {}, [
    el("table", {}, [
      el("tbody", {}, [
        el("tr", {}, [el("th", { scope: "row", text: "Model" }), el("td", { text: c.model })]),
        el("tr", {}, [el("th", { scope: "row", text: "Tokens per call" }), el("td", { text: `${c.input_tokens} in / ${c.output_tokens} out` })]),
        el("tr", {}, [el("th", { scope: "row", text: "Latency per call" }), el("td", { text: `${c.latency_ms} ms` })]),
        el("tr", {}, [el("th", { scope: "row", text: "Cost of this run" }), el("td", { text: `$${perRun.toFixed(4)} (${r.pairs.length} calls)` })]),
        el("tr", {}, [el("th", { scope: "row", text: "Cost at 5 repeats" }), el("td", { text: `$${(perRun * 5).toFixed(4)}` })]),
      ]),
    ]),
  ]);
}

function thresholdPanel(r) {
  const pane = el("div", { class: "panel challenge" }, [
    el("h2", { text: "Where do you put the threshold?" }),
    knob({
      label: "Pass if at least this share of repeats said pass",
      min: 0, max: 1, step: 0.05, value: state.threshold,
      format: (v) => v.toFixed(2),
      onInput: (v) => { state.threshold = v; render(); },
      hint: "Set repeats above 1 first — a threshold over one sample can only be 0 or 1.",
    }),
  ]);
  pane.append(
    el("div", { class: "tiles" }, [
      metricTile({ label: "Kappa", value: r.m.kappa?.toFixed(2) ?? "—", interval: r.m.ci?.kappa ? `${r.m.ci.kappa.lo.toFixed(2)}–${r.m.ci.kappa.hi.toFixed(2)}` : "", tone: r.band.tone }),
      metricTile({ label: "TPR", value: pct(r.m.tpr) }),
      metricTile({ label: "TNR", value: pct(r.m.tnr) }),
      metricTile({ label: "Pass rate", value: pct(r.passRate.point), interval: pctInterval(r.passRate) }),
    ]),
    el("p", { class: "hint" },
      "Raising the threshold makes the judge stricter: fewer false alarms, more real problems missed. " +
      "Lowering it does the reverse. The kappa number is what tells you whether the trade was worth making — " +
      "not the pass rate.")
  );
  return pane;
}

function correctedPanel(r) {
  const c = r.corrected;
  const pane = el("div", { class: "panel" }, [
    el("h2", { text: "Correct the pass rate for judge error" }),
    el("p", { class: "muted" },
      "The judge never saw the human labels, so its pass rate is wrong. Using its measured TPR and TNR on the " +
      "full dev set, the observed pass rate implies a corrected one."),
  ]);
  if (!c) {
    pane.append(el("div", { class: "callout warn" },
      "The correction is undefined here: TPR + TNR is so close to 1 that the denominator vanishes. " +
      "This judge is barely better than a coin and no pass rate can be trusted."));
    return pane;
  }
  pane.append(
    el("div", { class: "tiles" }, [
      metricTile({ label: "Judge pass rate", value: pct(r.passRate.point), interval: pctInterval(r.passRate) }),
      metricTile({ label: "Corrected", value: pct(c.value), tone: c.stable ? "neutral" : "warn",
        interval: r.correctedCI ? `${pct(r.correctedCI.lo)}–${pct(r.correctedCI.hi)}` : "" }),
      metricTile({ label: "Judge TPR", value: pct(r.devM.tpr), note: "measured on all dev items" }),
      metricTile({ label: "Judge TNR", value: pct(r.devM.tnr), note: "measured on all dev items" }),
    ]),
    c.outOfRange
      ? el("div", { class: "callout warn" }, "The correction landed outside 0–100%. That is not a bug in the arithmetic: it means this judge is so close to useless that the data cannot support any estimate. Report the raw pass rate with its interval and say why you are not correcting it.")
      : !c.stable
        ? el("div", { class: "callout warn" }, "TPR + TNR is barely above 1, so the correction multiplies a small numerator by a small denominator. Treat the corrected number as a direction, not a value.")
        : el("div", { class: "callout" }, "Stable enough to quote — but quote the interval with it, and say which judge produced the correction.")
  );
  return pane;
}

function prevalencePanel(r) {
  // Re-weight the same judgements as if the set had a different mix of
  // good and bad answers. No judge is re-run; only the population changes.
  const trueP = r.m.prevalence ?? 0.5;
  const grid = [];
  for (let p = 0.5; p <= 0.99; p += 0.05) {
    const acc = r.m.tpr * p + r.m.tnr * (1 - p);
    const judgePos = r.m.tpr * p + (1 - r.m.tnr) * (1 - p);
    const pe = p * judgePos + (1 - p) * (1 - judgePos);
    const kappa = Math.abs(1 - pe) < 1e-9 ? null : (acc - pe) / (1 - pe);
    grid.push({ p, acc, kappa });
  }
  const pane = el("div", { class: "panel" }, [
    el("h2", { text: "Why accuracy lies" }),
    el("p", { class: "muted" },
      "This judge is unchanged. Only the assumed mix of good and bad answers changes. At 95% good answers, " +
      "a judge that always says pass scores 95% accuracy and is worthless."),
    el("table", {}, [
      el("thead", {}, [el("tr", {}, [
        el("th", { scope: "col", text: "Good answers in the set" }),
        el("th", { scope: "col", text: "Accuracy" }),
        el("th", { scope: "col", text: "Kappa" }),
      ])]),
      el("tbody", {}, grid.map((g) => el("tr", { class: Math.abs(g.p - trueP) < 0.026 ? "diff-up" : "" }, [
        el("td", { text: pct(g.p, 0) }),
        el("td", { text: pct(g.acc) }),
        el("td", { text: g.kappa === null ? "—" : g.kappa.toFixed(2) }),
      ]))),
    ]),
    el("p", { class: "hint" },
      "The row nearest your real set is highlighted. Accuracy is a statement about your eval set, " +
      "not about the judge. Kappa is a statement about the judge."),
  ]);
  return pane;
}

function disagreementsPanel(r) {
  const bad = r.pairs.filter((p) => p.human !== p.judge);
  const byCategory = new Map();
  for (const p of bad) {
    if (!byCategory.has(p.category)) byCategory.set(p.category, []);
    byCategory.get(p.category).push(p);
  }
  const pane = el("div", { class: "panel" }, [
    el("h2", { text: `Disagreements: ${bad.length} of ${r.pairs.length}` }),
    el("p", { class: "muted" },
      "A number tells you the judge is off. Only reading these tells you how to fix it."),
  ]);
  for (const [cat, list] of [...byCategory].sort((a, b) => b[1].length - a[1].length)) {
    const humanSays = list[0].human === 1 ? "human passed it" : "human failed it";
    pane.append(
      el("h3", { text: `${cat.replace(/_/g, " ")} — ${list.length} (${humanSays})` }),
      itemList(list.slice(0, 4).map((p) => ({
        glyph: p.human === 1 ? "✗" : "✓",
        tone: p.human === 1 ? "bad" : "warn",
        title: p.item.question,
        detail: `Judge: ${p.judge === 1 ? "pass" : "fail"} — human: ${p.human === 1 ? "pass" : "fail"}`,
        meta: `Output: ${truncate(p.output, 150)}`,
      })), { limit: 4 })
    );
  }
  return pane;
}

function positionPanel() {
  const pane = el("div", { class: "panel" }, [
    el("h2", { text: "Position bias: judge the same pair twice" }),
    el("p", { class: "muted" },
      "Every pair has a known better answer (A, in this corpus). Each judge sees it as A–B and as B–A. " +
      "A judge without position bias gives the same winner both times."),
  ]);
  const rows = [];
  for (const model of PW.models) {
    const table = PW.runs[model.id];
    let flips = 0, n = 0, firstWins = 0;
    for (const id of Object.keys(table)) {
      const e = table[id];
      for (let k = 0; k < e.AB.length; k++) {
        n++;
        if (e.AB[k] !== e.BA[k]) flips++;
        // In BA order the first-read answer is B, so a B verdict there is a first-position win.
        if (e.AB[k] === "A" && e.BA[k] === "B") firstWins++;
      }
    }
    const consistency = 1 - flips / n;
    rows.push(el("tr", {}, [
      el("th", { scope: "row", text: model.label }),
      el("td", { text: pct(consistency, 0) }),
      el("td", { text: pct(flips / n, 0) }),
      el("td", { text: pct(firstWins / n, 0) }),
    ]));
  }
  pane.append(
    el("table", {}, [
      el("thead", {}, [el("tr", {}, [
        el("th", { scope: "col", text: "Judge" }),
        el("th", { scope: "col", text: "Swap-consistent" }),
        el("th", { scope: "col", text: "Verdict flips on swap" }),
        el("th", { scope: "col", text: "Picks whichever it read first" }),
      ])]),
      el("tbody", {}, rows),
    ]),
    el("p", { class: "hint" },
      "The fix is to judge both orders and combine: only count a win for an answer that wins in both " +
      "positions, and treat a disagreement as a tie. That halves the number of calls and removes the bias — " +
      "at the cost of discarding contested items.")
  );
  return pane;
}

function verbosityPanel() {
  const pane = el("div", { class: "panel" }, [
    el("h2", { text: "Verbosity bias: the same answer, padded" }),
    el("p", { class: "muted" },
      "Answer A and answer D contain the same content. D has two extra sentences. " +
      "Compare how each judge scores them."),
  ]);
  const rows = [];
  for (const [label, cfg] of [
    ["Rubric judge, no verbosity bias", "c-rubric-3b"],
    ["Verbosity-biased judge", "c-rubric-3b-verb"],
  ]) {
    const base = judgeMetrics(D.dev_ids.map((id) => ({
      human: itemById.get(id).human.v1.label, judge: D.runs[cfg][`${id}|v1`][0],
    })), { resamples: 400, seed: 11 });
    const padded = judgeMetrics(D.dev_ids.map((id) => ({
      human: itemById.get(id).human.v1.label, judge: D.runs[cfg][`${id}|v1padded`][0],
    })), { resamples: 400, seed: 11 });
    const gain = padded.judgePassRate - base.judgePassRate;
    rows.push(el("tr", { class: gain > 0.02 ? "diff-up" : "" }, [
      el("th", { scope: "row", text: label }),
      el("td", { text: pct(base.judgePassRate) }),
      el("td", { text: pct(padded.judgePassRate) }),
      el("td", { text: `${gain >= 0 ? "+" : ""}${pct(gain)}` }),
    ]));
  }
  pane.append(
    el("table", {}, [
      el("thead", {}, [el("tr", {}, [
        el("th", { scope: "col", text: "Judge" }),
        el("th", { scope: "col", text: "Passes the original" }),
        el("th", { scope: "col", text: "Passes the padded copy" }),
        el("th", { scope: "col", text: "Change" }),
      ])]),
      el("tbody", {}, rows),
    ]),
    el("p", { class: "hint" },
      "Padding never adds a single correct fact. If a judge's verdict moves when the content is held " +
      "constant and only the length changes, you are measuring verbosity, not quality. Test for this " +
      "before you trust a judge on open-ended answers.")
  );
  return pane;
}

function selfPanel() {
  const cfgA = "c-rubric-3b";
  const cfgB = "c-rubric-3b-self";
  const rows = [];
  for (const v of ["v1", "v2", "v3"]) {
    const base = judgeMetrics(D.dev_ids.map((id) => ({
      human: itemById.get(id).human[v].label, judge: D.runs[cfgA][`${id}|${v}`][0],
    })), { resamples: 300, seed: 13 });
    const self = judgeMetrics(D.dev_ids.map((id) => ({
      human: itemById.get(id).human[v].label, judge: D.runs[cfgB][`${id}|${v}`][0],
    })), { resamples: 300, seed: 13 });
    const d = (self.judgePassRate - base.judgePassRate) * 100;
    rows.push(el("tr", { class: Math.abs(d) > 2 ? "diff-up" : "" }, [
      el("th", { scope: "row", text: D.variants.find((x) => x.id === v).label }),
      el("td", { text: pct(base.judgePassRate) }),
      el("td", { text: pct(self.judgePassRate) }),
      el("td", { text: `${d >= 0 ? "+" : ""}${d.toFixed(1)} pts` }),
    ]));
  }
  return el("div", { class: "panel" }, [
    el("h2", { text: "Self-preference" }),
    el("p", { class: "muted" },
      "Self-preference is a judge being kinder to answers written by the same model family it is. " +
      "Variant C was produced by a Qwen-family model; the Llama judge is the one being tested here."),
    el("table", {}, [
      el("thead", {}, [el("tr", {}, [
        el("th", { scope: "col", text: "System" }),
        el("th", { scope: "col", text: "Plain rubric judge" }),
        el("th", { scope: "col", text: "Self-preference judge" }),
        el("th", { scope: "col", text: "Change" }),
      ])]),
      el("tbody", {}, rows),
    ]),
    el("p", { class: "hint" },
      "When you are comparing a new model against the one already in production, the judge and the system " +
      "often share a family. The cheapest defence is to pick a judge from a different family than the " +
      "thing you are judging.")
  ]);
}

function sizePanel() {
  const ladder = ["c-rubric-0.6b", "c-rubric-1.7b", "c-rubric-3b", "c-rubric-3.8b", "c-rubric-7b"];
  const rows = [];
  for (const cfg of ladder) {
    const m = judgeMetrics(D.dev_ids.map((id) => ({
      human: itemById.get(id).human.v1.label, judge: D.runs[cfg][`${id}|v1`][0],
    })), { resamples: 400, seed: 17 });
    const c = D.cost[cfg];
    rows.push(el("tr", { class: cfg === state.judge ? "diff-up" : "" }, [
      el("th", { scope: "row", text: c.model }),
      el("td", { text: m.kappa?.toFixed(2) ?? "—" }),
      el("td", { text: m.ci?.kappa ? `${m.ci.kappa.lo.toFixed(2)}–${m.ci.kappa.hi.toFixed(2)}` : "—" }),
      el("td", { text: pct(m.tpr) }),
      el("td", { text: pct(m.tnr) }),
      el("td", { text: `$${c.cost_usd.toFixed(5)}` }),
      el("td", { text: `${c.latency_ms} ms` }),
    ]));
  }
  return el("div", { class: "panel" }, [
    el("h2", { text: "Judge size against agreement and cost" }),
    el("table", {}, [
      el("thead", {}, [el("tr", {}, [
        el("th", { scope: "col", text: "Model" }),
        el("th", { scope: "col", text: "Kappa" }),
        el("th", { scope: "col", text: "Kappa 95% CI" }),
        el("th", { scope: "col", text: "TPR" }),
        el("th", { scope: "col", text: "TNR" }),
        el("th", { scope: "col", text: "Cost / call" }),
        el("th", { scope: "col", text: "Latency" }),
      ])]),
      el("tbody", {}, rows),
    ]),
    el("p", { class: "hint" },
      "The bottom of the ladder is where size matters. Above roughly 2B the judges sit inside each other's " +
      "intervals, so paying seven times more for the largest one buys a difference this eval set cannot resolve. " +
      "If you need more, add items — not parameters.")
  ]);
}

function repeatsPanel(r) {
  const rows = [];
  for (let k = 1; k <= 5; k++) {
    const saved = state.repeats;
    state.repeats = k;
    const m = judgeMetrics(
      pairsFor().map((p) => ({ human: p.human, judge: p.judge })),
      { resamples: 400, seed: 19 }
    );
    state.repeats = saved;
    rows.push(el("tr", { class: k === state.repeats ? "diff-up" : "" }, [
      el("th", { scope: "row", text: k === 1 ? "1 (greedy)" : `${k} + majority` }),
      el("td", { text: m.kappa?.toFixed(2) ?? "—" }),
      el("td", { text: m.ci?.kappa ? `${m.ci.kappa.lo.toFixed(2)}–${m.ci.kappa.hi.toFixed(2)}` : "—" }),
      el("td", { text: `$${(D.cost[activeJudge()].cost_usd * r.pairs.length * k).toFixed(4)}` }),
    ]));
  }
  return el("div", { class: "panel" }, [
    el("h2", { text: "Repeats and majority vote" }),
    el("p", { class: "muted" },
      "Asking the same judge the same question at temperature gives different answers. Majority vote is a " +
      "cheap way to stabilise the verdict; it costs one model call per repeat."),
    el("table", {}, [
      el("thead", {}, [el("tr", {}, [
        el("th", { scope: "col", text: "Repeats" }),
        el("th", { scope: "col", text: "Kappa" }),
        el("th", { scope: "col", text: "Kappa 95% CI" }),
        el("th", { scope: "col", text: "Cost of this run" }),
      ])]),
      el("tbody", {}, rows),
    ]),
    el("p", { class: "hint" }, "Watch the interval narrow as repeats rise — that is the noise being averaged out."),
  ]);
}

function promptPanel() {
  const recorded = D.judge_menu.map((j) => ({ j, text: PROMPT_TEXT[j.prompt_variant] }));
  const current = state.promptText ?? PROMPT_TEXT[judgeById.get(activeJudge()).prompt_variant];
  const match = recorded.find((r) => r.text === current);

  const pane = el("div", { class: "panel" }, [
    el("h2", { text: "The judge prompt" }),
    textArea({
      label: "Prompt text",
      value: current,
      rows: 7,
      onInput: (v) => { state.promptText = v; render(); },
      hint: "Edit it. Watch what happens to the recorded results.",
    }),
  ]);

  if (match) {
    pane.append(
      el("div", { class: "callout" }, [
        el("strong", { text: `Recorded run available. ` }),
        `This exact prompt was run as “${match.j.label}”. Its numbers are the ones above.`,
      ])
    );
  } else {
    // The integrity rule: no borrowing another prompt's results.
    const nearest = nearestVariant(current, recorded);
    pane.append(
      el("div", { class: "callout warn" }, [
        el("strong", { text: "No recorded run for this exact judge. " }),
        "Changing a single character of the prompt produces a different judge, and the verdicts above were " +
        "produced by a different one. Showing them here would be reporting another prompt's result as this " +
        "prompt's.",
        el("p", { class: "small", text: "Closest recorded variant: " + (nearest ? `“${nearest.j.label}”` : "none") }),
        el("p", { class: "small", text: diffSummary(current, nearest ? PROMPT_TEXT[nearest.j.prompt_variant] : "") }),
      ]),
      el("p", { class: "hint" },
        "This is the same keying rule that makes judge-call caching safe in CI: a cache hit requires the " +
        "prompt hash, the model build, the item and the decoding settings to match exactly. " +
        "In the full Eval Lab you can run your own prompt against a live model instead.")
    );
  }
  return pane;
}

const PROMPT_TEXT = {};
for (const j of D.judge_menu) PROMPT_TEXT[j.prompt_variant] = j.prompt_text;

function nearestVariant(text, recorded) {
  let best = null, bestScore = -1;
  for (const r of recorded) {
    let same = 0;
    const n = Math.min(text.length, r.text.length);
    for (let i = 0; i < n; i++) if (text[i] === r.text[i]) same++;
    const score = same / Math.max(text.length, r.text.length);
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return bestScore > 0.35 ? best : null;
}

function diffSummary(a, b) {
  if (!b) return "";
  const al = a.split("\n"), bl = b.split("\n");
  const changed = [];
  for (let i = 0; i < Math.max(al.length, bl.length); i++) {
    if (al[i] !== bl[i]) changed.push(`line ${i + 1}`);
  }
  return changed.length
    ? `Differs from the closest recorded prompt at ${changed.length} place(s): ${changed.slice(0, 6).join(", ")}.`
    : "Differs from the closest recorded prompt only in wording.";
}

function validatePanel(r) {
  if (state.split !== "test") {
    return el("div", { class: "panel challenge" }, [
      el("h2", { text: "Held-out validation" }),
      el("p", { text: "You have been tuning on dev. Test agreement is behind one button, and the " +
        "button only works once per judge you have pinned." }),
      button("Validate on test", () => {
        state.split = "test";
        state.validated = true;
        store.set("judge-lab-validated", true);
        render();
        announce("Validated on the held-out test set.");
      }, { variant: "primary" }),
    ]);
  }
  return el("div", { class: "panel challenge" }, [
    el("h2", { text: "Held-out test result" }),
    el("div", { class: "tiles" }, tilesFor(r).map((t) => metricTile(t))),
    el("p", { class: "muted" }, `n = ${r.m.n} on items you have not tuned against.`),
    el("p", { class: "hint" },
      "Compare this kappa with the dev kappa. If the judge was tuned on dev, a large drop here means you " +
      "tuned the prompt to dev, not to the task. That is the whole reason the split exists."),
  ]);
}

function truncate(s, n) {
  const t = String(s ?? "");
  return t.length > n ? t.slice(0, n) + "…" : t;
}

/* ================================================================== *
 * Main render
 * ================================================================== */

function render() {
  const r = compute();
  buildControls();
  clear(resultsRoot);

  resultsRoot.append(agreementPanel(r));

  switch (state.panel) {
    case "threshold":  resultsRoot.append(thresholdPanel(r)); break;
    case "corrected":  resultsRoot.append(correctedPanel(r)); break;
    case "prevalence": resultsRoot.append(prevalencePanel(r)); break;
    case "disagreements": resultsRoot.append(disagreementsPanel(r)); break;
    case "position":   resultsRoot.append(positionPanel()); break;
    case "verbosity":  resultsRoot.append(verbosityPanel()); break;
    case "self":       resultsRoot.append(selfPanel()); break;
    case "size":       resultsRoot.append(sizePanel()); break;
    case "repeats":    resultsRoot.append(repeatsPanel(r)); break;
  }

  resultsRoot.append(promptPanel());
  if (state.panel === "agreement" || state.panel === "verdicts") resultsRoot.append(validatePanel(r));

  board.update(snapshot());
  board.renderA();

  syncUrl({
    preset: presetName, judge: state.judge, variant: state.variant,
    split: state.split, n: state.size, repeats: state.repeats, seed: state.seed,
  });
}

shell({
  title: "Eval Lab — judge design and validation",
  subtitle: "Turn a knob, read the agreement with humans. Nothing here is a pre-rendered screenshot.",
  controls: el("div", {}, [controlsRoot, boardRoot]),
  results: resultsRoot,
  footer: el("p", {}, [
    "Educational model. The judge verdicts are generated by a seeded model of judge behaviour; every " +
    "statistic is computed for real in your browser from those verdicts. ",
    "In production this is where your own judge runs and your own human labels go.",
  ]),
});

render();
