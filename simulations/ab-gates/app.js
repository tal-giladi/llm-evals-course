// Eval Lab — comparing systems and release gates (module 10).
//
// Two questions with one answer each:
//
//   1. Did the change help?  -> paired comparison on the same items, plus the
//      list of items that flipped. The flips are the result; the delta is the
//      summary of them.
//
//   2. Can I put a gate on it? -> every gate has two failure modes, and this
//      panel prices both: how often a healthy build is blocked, and how often
//      a broken one gets through.

import {
  judgeMetrics, wilson, pct, pctInterval, pairedComparison, sampleItems,
  simulateGate, hashSeed,
} from "../common/stats.js";
import {
  el, clear, knob, select, radioGroup, button, metricTile,
  itemList, exportJson, Scoreboard, shell, announce, getPreset, syncUrl,
} from "../common/ui.js";

const D = window.EvalLabData.support;
if (!D) { document.body.textContent = "Dataset failed to load."; throw new Error("no data"); }

const PRESETS = {
  ab:       { panel: "ab", a: "v1", b: "v2" },
  paired:   { panel: "ab", a: "v1", b: "v2" },
  unpaired: { panel: "ab", a: "v1", b: "v2", unpaired: true },
  gate:     { panel: "gate" },
  safety:   { panel: "safety" },
};

const presetName = getPreset() || "ab";
const preset = PRESETS[presetName] || PRESETS.ab;

const state = {
  panel: preset.panel,
  a: preset.a || "v1",
  b: preset.b || "v2",
  judge: "c-rubric-3b",
  n: 94,
  seed: 23,
  tolerance: 0.05,
  repeats: 3,
  unpaired: !!preset.unpaired,
};

const controlsRoot = el("div");
const boardRoot = el("div");
const resultsRoot = el("div");
const board = new Scoreboard(boardRoot, "Scoreboard");

const label = (v) => D.variants.find((x) => x.id === v)?.label || v;

function verdict(itemId, variant) {
  const s = D.runs[state.judge][`${itemId}|${variant}`] || [0];
  if (state.repeats <= 1) return s[0];
  const used = s.slice(0, state.repeats);
  return used.reduce((a, b) => a + b, 0) * 2 > used.length ? 1 : 0;
}

function chosen() {
  // "all" short-circuits in sampleItems and returns every index, which made
  // the Items knob inert. Draw a real sample so the knob does something.
  return sampleItems(
    D.items, Math.min(state.n, D.items.length),
    state.n >= D.items.length ? "all" : "random", state.seed
  ).map((i) => D.items[i].id);
}

function buildPairs(aVariant, bVariant) {
  return chosen().map((id) => {
    const it = D.items.find((x) => x.id === id);
    return {
      item: it,
      a: verdict(id, aVariant),
      b: verdict(id, bVariant),
      humanA: it.human[aVariant]?.label ?? 0,
      humanB: it.human[bVariant]?.label ?? 0,
      variantA: aVariant,
      variantB: bVariant,
    };
  });
}

function abPanel() {
  const pairs = buildPairs(state.a, state.b);
  const pa = pairs.map((p) => ({ human: p.humanA, judge: p.a }));
  const pb = pairs.map((p) => ({ human: p.humanB, judge: p.b }));

  const mA = judgeMetrics(pa, { resamples: 700, seed: state.seed });
  const mB = judgeMetrics(pb, { resamples: 700, seed: state.seed });

  const passA = pa.filter((x) => x.judge === 1).length / pa.length;
  const passB = pb.filter((x) => x.judge === 1).length / pb.length;

  // Paired: the same items, so item difficulty cancels.
  const paired = pairedComparison(pa, pb, { resamples: 1000, seed: state.seed });

  // Unpaired: throw the pairing away, as an A/B with different items would.
  let unpaired = null;
  if (state.unpaired) {
    const ia = sampleItems(pairs.map((_, i) => i), Math.floor(pairs.length / 2), "random", state.seed);
    const ib = pairs.map((_, i) => i).filter((i) => !ia.includes(i));
    const ra = ia.filter((i) => pairs[i].a === 1).length / Math.max(1, ia.length);
    const rb = ib.filter((i) => pairs[i].b === 1).length / Math.max(1, ib.length);
    unpaired = { a: ra, b: rb, delta: ra - rb };
  }

  const fixed = pairs.filter((p) => p.b > p.a);
  const broke = pairs.filter((p) => p.b < p.a);

  const pane = el("div", { class: "panel" }, [
    el("h2", { text: `${label(state.a)} vs ${label(state.b)}` }),
    el("div", { class: "tiles" }, [
      metricTile({ label: "A pass rate", value: pct(passA) }),
      metricTile({ label: "B pass rate", value: pct(passB) }),
      metricTile({ label: "Difference", value: `${paired.delta >= 0 ? "+" : ""}${(paired.delta * 100).toFixed(1)} pts`,
        interval: `${(paired.ci.lo * 100).toFixed(1)} to ${(paired.ci.hi * 100).toFixed(1)}`,
        tone: paired.ci.lo > 0 ? "good" : paired.ci.hi < 0 ? "bad" : "warn" }),
      metricTile({ label: "Sign test p", value: paired.pValue.toFixed(3), note: paired.pValue < 0.05 ? "significant" : "not significant" }),
    ]),
    el("div", { class: "callout" }, [
      // paired.delta is A − B, so a positive interval means A is the better
      // system. Reading this as "B is better" was backwards.
      paired.ci.lo > 0
        ? `The whole interval is above zero: ${label(state.a)} is the better system on this set, not just on one lucky draw.`
        : paired.ci.hi < 0
          ? `The whole interval is below zero: ${label(state.b)} is the worse system on this set.`
          : el("span", [
              el("strong", { text: "The interval crosses zero. " }),
              "On these items you cannot tell the two systems apart. That is a real answer, and it is the " +
              "answer most A/B results of six points on twenty items actually are.",
            ]),
    ]),
    unpaired
      ? el("div", {}, [
          el("h3", { text: "The same data, unpaired" }),
          el("p", { class: "muted", text: `A ${pct(unpaired.a)} on half the items, B ${pct(unpaired.b)} on the other half. ` +
            `Difference ${(unpaired.delta * 100).toFixed(1)} points — and now the two halves differ in difficulty as ` +
            `well as in quality, which is exactly the variance the paired design removes.` }),
        ])
      : null,
  ]);

  pane.append(
    el("div", { class: "panel" }, [
      el("h2", { text: `What flipped — ${fixed.length} fixed, ${broke.length} broke` }),
      el("p", { class: "muted", text: "This list is the result. The number above is a summary of it." }),
      itemList([
        ...fixed.map((p) => ({
          glyph: "▲", tone: "good", title: p.item.question,
          detail: p.b === 1 ? "Now passes" : "Still fails, but scores differently",
          meta: `${label(state.a)} → ${label(state.b)}`,
        })),
        ...broke.map((p) => ({
          glyph: "▼", tone: "bad", title: p.item.question,
          detail: "Used to pass, does not any more",
          meta: `${label(state.a)} → ${label(state.b)}`,
        })),
      ], { limit: 14, empty: "Nothing flipped. The two systems are indistinguishable on this set." }),
    ])
  );
  return pane;
}

function gatePanel() {
  const ids = chosen();
  // The judge has already produced five samples per item; those samples are
  // the run-to-run noise the gate has to live with.
  const runs = [];
  for (let s = 0; s < D.repeats; s++) {
    runs.push(ids.map((id) => {
      const v = D.runs[state.judge][`${id}|${state.a}`] || [0];
      return v[s % v.length];
    }));
  }
  const healthy = simulateGate(runs, {
    tolerance: state.tolerance, repeats: state.repeats, n: ids.length,
    seed: state.seed, regressionIndex: null,
  });
  const broken = simulateGate(runs, {
    tolerance: state.tolerance, repeats: state.repeats, n: ids.length,
    seed: state.seed, regressionIndex: 0,
  });

  return el("div", { class: "panel challenge" }, [
    el("h2", { text: "Set a gate under noise" }),
    el("p", { class: "muted" },
      "The gate fires when the candidate build's pass rate drops more than the tolerance below the current " +
      "one, on the same items. Both numbers below come from the recorded run-to-run spread, not from theory."),
    el("div", { class: "tiles" }, [
      metricTile({ label: "False alarms", value: pct(healthy.falseAlarmRate), tone: healthy.falseAlarmRate > 0.2 ? "bad" : "ok",
        note: "healthy build, gate fires anyway" }),
      metricTile({ label: "Missed regressions", value: pct(broken.missedRate), tone: broken.missedRate > 0.2 ? "bad" : "ok",
        note: "broken build, gate stays quiet" }),
      metricTile({ label: "Tolerance", value: `${(state.tolerance * 100).toFixed(0)} pts` }),
      metricTile({ label: "Items", value: String(ids.length) }),
    ]),
    el("div", { class: "callout" }, [
      el("strong", { text: "Read both numbers together. " }),
      "Tightening the tolerance to catch more regressions is what raises false alarms. The only knobs that " +
      "move both in the right direction are more items and more repeats — which cost money on every run. " +
      "That is the real trade, and it belongs in the same conversation as the gate threshold.",
    ]),
    el("table", {}, [
      el("thead", {}, [el("tr", {}, [
        el("th", { scope: "col", text: "Items" }), el("th", { scope: "col", text: "Repeats" }),
        el("th", { scope: "col", text: "Tolerance" }),
        el("th", { scope: "col", text: "False alarms" }), el("th", { scope: "col", text: "Missed" }),
      ])]),
      el("tbody", {}, gridRows()),
    ]),
  ]);
}

function gridRows() {
  const rows = [];
  for (const n of [20, 40, 94]) {
    for (const reps of [1, 3, 5]) {
      if (reps > D.repeats) continue;
      const ids = chosen().slice(0, n);
      const runs = [];
      for (let s = 0; s < reps; s++) {
        runs.push(ids.map((id) => {
          const v = D.runs[state.judge][`${id}|${state.a}`] || [0];
          return v[s % v.length];
        }));
      }
      const h = simulateGate(runs, { tolerance: state.tolerance, repeats: reps, n, seed: state.seed });
      const b = simulateGate(runs, { tolerance: state.tolerance, repeats: reps, n, seed: state.seed, regressionIndex: 0 });
      rows.push(el("tr", { class: n === Math.min(state.n, 94) && reps === state.repeats ? "diff-up" : "" }, [
        el("td", { text: String(n) }), el("td", { text: String(reps) }),
        el("td", { text: `${(state.tolerance * 100).toFixed(0)} pts` }),
        el("td", { text: pct(h.falseAlarmRate, 0) }),
        el("td", { text: pct(b.missedRate, 0) }),
      ]));
    }
  }
  return rows;
}

function safetyPanel() {
  const ids = chosen();
  const refuse = (v) => ids.filter((id) => {
    const it = D.items.find((x) => x.id === id);
    return it.human[v]?.category === "over_refusal";
  });
  const wrong = (v) => ids.filter((id) => {
    const it = D.items.find((x) => x.id === id);
    return it.human[v]?.category === "wrong_fact" || it.human[v]?.category === "out_of_scope";
  });
  const rows = D.variants.map((v) => {
    const over = refuse(v.id).length, bad = wrong(v.id).length, n = ids.length;
    return el("tr", {}, [
      el("th", { scope: "row", text: v.label }),
      el("td", { text: String(over) }),
      el("td", { text: String(bad) }),
      el("td", { text: pct(bad / n, 0) }),
    ]);
  });
  return el("div", { class: "panel" }, [
    el("h2", { text: "A safety slice as a second gate" }),
    el("p", { class: "muted", text: "An overall pass rate improves if a system becomes both more accurate and " +
      "more cautious. Refusing a question the handbook answers is a regression, and a single overall number " +
      "hides it. Give the slice its own gate." }),
    el("table", {}, [
      el("thead", {}, [el("tr", {}, [
        el("th", { scope: "col", text: "System" }),
        el("th", { scope: "col", text: "Over-refusals" }),
        el("th", { scope: "col", text: "Wrong or invented policy" }),
        el("th", { scope: "col", text: "Share of items" }),
      ])]),
      el("tbody", {}, rows),
    ]),
    el("p", { class: "hint", text: "Slice metrics are usually small, so their intervals are wide. That is " +
      "an argument for a looser threshold on the slice, not for dropping it." }),
  ]);
}

function render() {
  clear(controlsRoot).append(
    el("div", { class: "panel" }, [
      el("h2", { text: "Two systems" }),
      select({ label: "A (baseline)", options: D.variants.map((v) => ({ value: v.id, label: v.label })),
        value: state.a, onChange: (v) => { state.a = v; render(); } }),
      select({ label: "B (candidate)", options: D.variants.map((v) => ({ value: v.id, label: v.label })),
        value: state.b, onChange: (v) => { state.b = v; render(); } }),
      radioGroup({
        label: "Comparison",
        options: [{ value: "paired", label: "Paired — same items" }, { value: "unpaired", label: "Unpaired — split the items" }],
        value: state.unpaired ? "unpaired" : "paired",
        onChange: (v) => { state.unpaired = v === "unpaired"; render(); },
      }),
    ]),
    el("div", { class: "panel" }, [
      el("h2", { text: "Gate settings" }),
      knob({ label: "Tolerance", min: 0, max: 0.3, step: 0.01, value: state.tolerance,
        format: (v) => `${(v * 100).toFixed(0)} pts`, onInput: (v) => { state.tolerance = v; render(); } }),
      knob({ label: "Repeats", min: 1, max: 5, step: 1, value: state.repeats,
        onInput: (v) => { state.repeats = v; render(); } }),
      knob({ label: "Items", min: 10, max: D.items.length, step: 1, value: state.n,
        format: (v) => `${v}`, onInput: (v) => { state.n = v; render(); } }),
      el("div", {}, [
        button("Export", () => exportJson("ab-gates.json", { a: state.a, b: state.b, judge: state.judge, n: state.n })),
      ]),
    ])
  );

  clear(resultsRoot);
  if (state.panel === "gate") resultsRoot.append(gatePanel());
  else if (state.panel === "safety") resultsRoot.append(safetyPanel());
  else resultsRoot.append(abPanel());

  board.update({ caption: `${label(state.a)} vs ${label(state.b)}`, tiles: [
    { label: "B pass rate", value: pct(buildPairs(state.a, state.b).filter((p) => p.b === 1).length / Math.max(1, state.n)) },
  ] });
  board.renderA();
  syncUrl({ preset: presetName, a: state.a, b: state.b, n: state.n, tol: state.tolerance });
  announce("Comparison updated.");
}

shell({
  title: "Eval Lab — comparing systems and release gates",
  subtitle: "Paired differences, the items that flipped, and what a gate costs in false alarms.",
  controls: el("div", {}, [controlsRoot, boardRoot]),
  results: resultsRoot,
  footer: el("p", {}, "Educational model. The comparisons and the gate simulation are computed live from the recorded verdicts."),
});

render();
