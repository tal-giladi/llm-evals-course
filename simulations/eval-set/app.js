// Eval Lab — building the eval set (module 4).
//
// Three questions the lab answers, all on the same 94 items:
//
//   1. How many items do I need?  -> watch the interval, not the point estimate.
//   2. Which items?              -> random vs stratified, and what a slice miss costs.
//   3. Where is the split?        -> tune on dev, validate once on test.
//
// There is no model call. This is sampling and arithmetic, which is exactly
// why module 4 is the cheapest module in the course.

import { wilson, pct, pctInterval, sampleItems, hashSeed, judgeMetrics } from "../common/stats.js";
import {
  el, clear, knob, radioGroup, button, metricTile, itemList,
  Scoreboard, shell, announce, getPreset, syncUrl,
} from "../common/ui.js";

const D = window.EvalLabData.support;
if (!D) { document.body.textContent = "Dataset failed to load."; throw new Error("no data"); }

const PRESETS = {
  "sample-size":  { size: 20 },
  "stratify":     { size: 20, strategy: "stratified" },
  "split":        { size: 40, focus: "split" },
  "target":       { size: 30, focus: "target" },
};

const presetName = getPreset() || "sample-size";
const preset = PRESETS[presetName] || PRESETS.sampleSize;

const state = {
  size: preset.size ?? 20,
  strategy: preset.strategy || "random",
  seed: 11,
  split: "dev",
  focus: preset.focus || "size",
  sliceFilter: "all",
};

const controlsRoot = el("div");
const resultsRoot = el("div");

/** Human pass rate for the tuned system, restricted to a set of item indices. */
function rateOver(indices) {
  const pass = indices.filter((i) => D.items[i].human.v1.label === 1).length;
  return { pass, n: indices.length, ci: wilson(pass, indices.length) };
}

function drawnIndices() {
  const all = D.items.map((_, i) => i);
  return sampleItems(all, state.size, state.strategy, state.seed);
}

function buildControls() {
  clear(controlsRoot);
  controlsRoot.append(
    el("div", { class: "panel" }, [
      el("h2", { text: "Sample" }),
      knob({
        label: "How many items", min: 5, max: D.items.length, step: 1, value: state.size,
        format: (v) => `${v} of ${D.items.length}`,
        onInput: (v) => { state.size = v; render(); },
        hint: "The whole cost of a judge run is this number times the price of one call.",
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
      knob({
        label: "Seed", min: 1, max: 200, step: 1, value: state.seed,
        onInput: (v) => { state.seed = v; render(); },
        hint: "Change it and watch the same size give different answers.",
      }),
    ]),
    el("div", { class: "panel" }, [
      el("h2", { text: "Split" }),
      radioGroup({
        label: "Which half",
        options: [
          { value: "dev", label: `Dev (${D.dev_ids.length}) — tune here` },
          { value: "test", label: `Test (${D.test_ids.length}) — validate once` },
        ],
        value: state.split,
        onChange: (v) => { state.split = v; render(); },
      }),
      el("p", { class: "hint", text: "If you tune the judge prompt on test, test is no longer a held-out set." }),
    ])
  );
}

function sizePanel() {
  // What the interval would be at each size, for the whole population.
  const rows = [];
  for (let n = 10; n <= D.items.length; n += 5) {
    const indices = sampleItems(D.items.map((_, i) => i), n, state.strategy, state.seed);
    const r = rateOver(indices);
    rows.push(el("tr", { class: n === state.size ? "diff-up" : "" }, [
      el("th", { scope: "row", text: String(n) }),
      el("td", { text: pct(r.ci.point) }),
      el("td", { text: pctInterval(r.ci) }),
      el("td", { text: `${Math.round((r.ci.hi - r.ci.lo) * 100)} pts` }),
    ]));
  }
  return el("div", { class: "panel" }, [
    el("h2", { text: "Sample size against interval width" }),
    el("p", { class: "muted", text: "Same population, same judge, same seed. Only the sample size changes." }),
    el("table", {}, [
      el("thead", {}, [el("tr", {}, [
        el("th", { scope: "col", text: "Items" }),
        el("th", { scope: "col", text: "Pass rate" }),
        el("th", { scope: "col", text: "Wilson 95% CI" }),
        el("th", { scope: "col", text: "Width" }),
      ])]),
      el("tbody", {}, rows),
    ]),
    el("p", { class: "hint", text: "The interval halves only when you quadruple the sample. That is why " +
      "\"we tested on 30\" is usually not a strong claim." }),
  ]);
}

function stratificationPanel(indices) {
  const drawn = new Set(indices);
  const slices = new Map();
  for (const it of D.items) {
    const k = it.slice.intent;
    if (!slices.has(k)) slices.set(k, { total: 0, drawn: 0, failures: 0 });
    slices.get(k).total++;
    if (drawn.has(D.items.indexOf(it))) {
      slices.get(k).drawn++;
      if (it.human.v1.label === 0) slices.get(k).failures++;
    }
  }
  const rows = [...slices].map(([name, s]) => el("tr", {}, [
    el("th", { scope: "row", text: name.replace(/_/g, " ") }),
    el("td", { text: `${s.drawn} of ${s.total}` }),
    el("td", { text: String(s.failures) }),
    el("td", { text: s.failures === 0 ? "none seen" : "measured" , class: s.failures === 0 ? "tone-bad" : "" }),
  ]));
  const missing = [...slices].filter(([, s]) => s.failures === 0).map(([k]) => k);

  return el("div", { class: "panel" }, [
    el("h2", { text: "What your sample actually contains" }),
    el("table", {}, [
      el("thead", {}, [el("tr", {}, [
        el("th", { scope: "col", text: "Slice" }),
        el("th", { scope: "col", text: "Sampled" }),
        el("th", { scope: "col", text: "Failing items" }),
        el("th", { scope: "col", text: "TNR measurable?" }),
      ])]),
      el("tbody", {}, rows),
    ]),
    missing.length
      ? el("div", { class: "callout warn" }, [
          el("strong", { text: "Slices with no failing items: " }),
          missing.map((m) => m.replace(/_/g, " ")).join(", "),
          ". A slice with zero failures contributes nothing to the true-negative rate, so the judge looks " +
          "better than it is on exactly the population you care about. This is why a set built from real " +
          "traffic has to be stratified by intent, not sampled uniformly.",
        ])
      : el("div", { class: "callout" }, "Every slice in this sample contains at least one failing item, so the true-negative rate is measurable in each."),
  ]);
}

function splitPanel() {
  const devRows = D.dev_ids.map((id) => D.items.find((i) => i.id === id)).filter(Boolean);
  const testRows = D.items.filter((i) => D.test_ids.includes(i.id));
  const cmp = (rows) => {
    const pass = rows.filter((r) => r.human.v1.label === 1).length;
    return { pass, n: rows.length, ci: wilson(pass, rows.length) };
  };
  const d = cmp(devRows), t = cmp(testRows);
  return el("div", { class: "panel" }, [
    el("h2", { text: "Dev and test are different populations wearing the same coat" }),
    el("table", {}, [
      el("thead", {}, [el("tr", {}, [
        el("th", { scope: "col", text: "" }),
        el("th", { scope: "col", text: "Items" }),
        el("th", { scope: "col", text: "Pass rate" }),
        el("th", { scope: "col", text: "Wilson 95% CI" }),
      ])]),
      el("tbody", {}, [
        el("tr", {}, [el("th", { scope: "row", text: "Dev" }), el("td", { text: String(d.n) }),
          el("td", { text: pct(d.ci.point) }), el("td", { text: pctInterval(d.ci) })]),
        el("tr", {}, [el("th", { scope: "row", text: "Test" }), el("td", { text: String(t.n) }),
          el("td", { text: pct(t.ci.point) }), el("td", { text: pctInterval(t.ci) })]),
      ]),
    ]),
    el("div", { class: "callout" }, [
      el("strong", { text: "The split is balanced by difficulty, not identical. " }),
      "That is deliberate. A split that matches on every attribute gives you a test set that tells you nothing " +
      "you did not already know. The test set should be a slightly different draw from the same population — " +
      "like a fresh week of traffic.",
    ]),
  ]);
}

function render() {
  buildControls();
  clear(resultsRoot);
  const indices = drawnIndices();
  const r = rateOver(indices);

  resultsRoot.append(
    el("div", { class: "panel" }, [
      el("h2", { text: "Your sample" }),
      el("div", { class: "tiles" }, [
        metricTile({ label: "Pass rate", value: pct(r.ci.point), interval: pctInterval(r.ci),
          tone: (r.ci.hi - r.ci.lo) < 0.2 ? "ok" : "warn" }),
        metricTile({ label: "Items drawn", value: String(r.n) }),
        metricTile({ label: "Interval width", value: `${Math.round((r.ci.hi - r.ci.lo) * 100)} pts`,
          note: "narrower than 20 pts is usually worth having" }),
      ]),
      el("p", { class: "hint", text: "The point estimate is the easy part. The interval is what tells you " +
        "whether a change you are about to make is real." }),
    ]),
    sizePanel(),
    stratificationPanel(indices),
    splitPanel(),
    el("div", { class: "panel" }, [
      el("h2", { text: "The items you drew" }),
      itemList(indices.slice(0, 12).map((i) => ({
        glyph: D.items[i].human.v1.label === 1 ? "✓" : "✗",
        tone: D.items[i].human.v1.label === 1 ? "good" : "bad",
        title: D.items[i].question,
        meta: `${D.items[i].slice.intent.replace(/_/g, " ")} · ${D.items[i].slice.difficulty} · ${D.items[i].human.v1.category.replace(/_/g, " ")}`,
      })), { limit: 12 }),
    ])
  );
  announce(`Sampled ${r.n} items, pass rate ${pct(r.ci.point)}, interval ${pctInterval(r.ci)}.`);
  syncUrl({ preset: presetName, n: state.size, seed: state.seed, strategy: state.strategy });
}

shell({
  title: "Eval Lab — building the eval set",
  subtitle: "How many items, which ones, and where the line between dev and test goes.",
  controls: controlsRoot,
  results: resultsRoot,
  footer: el("p", {}, "Educational model. Every interval here is computed live from the human labels in the support set."),
});

render();