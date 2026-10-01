// Eval Lab — evaluating RAG answers (module 8).
//
// Two failure modes that retrieval metrics cannot see, because both are
// properties of the *answer*, not of what was retrieved:
//
//   grounding — does every claim trace to a supplied passage?
//   abstention — when nothing was retrieved, did the system say so?
//
// Both are checked here against the human label, which is decidable because
// the passages are in the dataset.

import { judgeMetrics, wilson, pct, pctInterval, kappaBand } from "../common/stats.js";
import {
  el, clear, knob, select, button, metricTile, confusionTable,
  itemList, exportJson, Scoreboard, shell, announce, getPreset, syncUrl,
} from "../common/ui.js";

const D = window.EvalLabData.rag;
if (!D) { document.body.textContent = "Dataset failed to load."; throw new Error("no data"); }

const PRESETS = {
  grounding: { variant: "v2", panel: "grounding" },
  abstain:   { variant: "v2", panel: "abstention" },
  claim:    { variant: "v3", panel: "grounding" },
  compare:  { variant: "v2", panel: "compare" },
};

const presetName = getPreset() || "grounding";
const preset = PRESETS[presetName] || PRESETS.grounding;

const state = {
  variant: preset.variant,
  judge: D.judge_menu[0].id,
  n: D.items.length,
  panel: preset.panel,
  threshold: 0.5,
};

const controlsRoot = el("div");
const boardRoot = el("div");
const resultsRoot = el("div");
const board = new Scoreboard(boardRoot, "Scoreboard");

function pairs() {
  const table = D.runs[state.judge] || D.runs[D.judge_menu[0].id];
  return D.items.slice(0, state.n).map((it) => {
    const samples = table[`${it.id}|${state.variant}`] || [0];
    return {
      item: it,
      human: it.human[state.variant].label,
      category: it.human[state.variant].category,
      judge: samples[0],
      abstain: it.should_abstain,
      samples,
    };
  });
}

function groundPanel(p) {
  const m = judgeMetrics(p.map((x) => ({ human: x.human, judge: x.judge })),
    { resamples: 800, seed: 5 });
  const band = kappaBand(m.kappa);
  return el("div", { class: "panel" }, [
    el("h2", { text: "Grounding: is every claim in the passages?" }),
    el("div", { class: "tiles" }, [
      metricTile({ label: "Grounded (judge)", value: pct(m.judgePassRate), interval: pctInterval(m.ci.judgePassRate) }),
      metricTile({ label: "Kappa vs humans", value: m.kappa.toFixed(2), tone: band.tone, note: band.label }),
      metricTile({ label: "TPR", value: pct(m.tpr), note: "grounded answers kept" }),
      metricTile({ label: "TNR", value: pct(m.tnr), note: "ungrounded answers caught" }),
    ]),
    confusionTable(m.confusion, "Rows are human grounding labels, columns are the judge"),
    el("p", { class: "muted" },
      "Retrieval recall cannot see any of this. The right passage was retrieved and the answer still invented a number."),
  ]);
}

function abstainPanel(p) {
  const empty = p.filter((x) => x.item.passages.length === 0);
  const answeredAnyway = empty.filter((x) => x.category === "should_have_abstained");
  const abstained = empty.filter((x) => x.category === "grounded" && x.item.should_abstain);
  const falseRefusals = p.filter((x) => x.category === "over_refusal");

  return el("div", { class: "panel" }, [
    el("h2", { text: "Abstention: knowing when you have nothing" }),
    el("p", { class: "muted" },
      "Of the questions where retrieval returned nothing, a system has two safe moves: say the handbook does " +
      "not cover it, or ask a clarifying question. Inventing a policy is neither."),
    el("div", { class: "tiles" }, [
      metricTile({ label: "Empty-retrieval questions", value: String(empty.length) }),
      metricTile({ label: "Answered anyway", value: String(answeredAnyway.length),
        tone: answeredAnyway.length ? "bad" : "good" }),
      metricTile({ label: "Correctly abstained", value: String(abstained.length), tone: "good" }),
      metricTile({ label: "Over-refusals", value: String(falseRefusals.length),
        tone: falseRefusals.length ? "warn" : "good", note: "refused something answerable" }),
    ]),
    el("p", { class: "hint" },
      "Both directions cost you. A system that never abstains invents policy. A system that abstains too " +
      "eagerly refuses a question the passages answer, which is the failure users notice first."),
    itemList(empty.map((x) => ({
      glyph: x.category === "should_have_abstained" ? "✗" : "✓",
      tone: x.category === "should_have_abstained" ? "bad" : "good",
      title: x.item.question,
      detail: x.item.outputs[state.variant],
      meta: `passages retrieved: ${x.item.passages.length}`,
    })), { empty: "Every question in this sample retrieved something." }),
  ]);
}

function comparePanel(p) {
  const rows = [];
  for (const v of D.variants) {
    const table = D.runs[state.judge];
    const pp = D.items.map((it) => ({
      human: it.human[v.id].label, judge: (table[`${it.id}|${v.id}`] || [0])[0],
    }));
    const m = judgeMetrics(pp, { resamples: 500, seed: 9 });
    const ci = wilson(pp.filter((x) => x.judge === 1).length, pp.length);
    rows.push(el("tr", { class: v.id === state.variant ? "diff-up" : "" }, [
      el("th", { scope: "row", text: v.label }),
      el("td", { text: pct(ci.point) }),
      el("td", { text: pctInterval(ci) }),
      el("td", { text: m.kappa.toFixed(2) }),
      el("td", { text: pct(m.tnr) }),
    ]));
  }
  return el("div", { class: "panel" }, [
    el("h2", { text: "Three prompting strategies, same questions" }),
    el("table", {}, [
      el("thead", {}, [el("tr", {}, [
        el("th", { scope: "col", text: "System" }),
        el("th", { scope: "col", text: "Grounded" }),
        el("th", { scope: "col", text: "Wilson 95% CI" }),
        el("th", { scope: "col", text: "Kappa" }),
        el("th", { scope: "col", text: "TNR" }),
      ])]),
      el("tbody", {}, rows),
    ]),
    el("p", { class: "hint" },
      "The instruction \"if the passages do not answer it, say so\" costs nothing at inference time and is the " +
      "single highest-value line in most RAG prompts. Measure it rather than assume it."),
  ]);
}

function render() {
  clear(controlsRoot);
  controlsRoot.append(
    el("div", { class: "panel" }, [
      el("h2", { text: "System" }),
      select({
        label: "Answer being evaluated",
        options: D.variants.map((v) => ({ value: v.id, label: v.label })),
        value: state.variant,
        onChange: (v) => { state.variant = v; render(); },
      }),
      select({
        label: "Grounding judge",
        options: D.judge_menu.map((j) => ({ value: j.id, label: j.label })),
        value: state.judge,
        onChange: (v) => { state.judge = v; render(); },
      }),
      knob({
        label: "Questions", min: 5, max: D.items.length, step: 1, value: state.n,
        format: (v) => `${v}`,
        onInput: (v) => { state.n = v; render(); },
      }),
      el("div", {}, [
        button("Pin as A", () => {
          const p = pairs();
          board.pin({ caption: `${state.variant} · ${state.judge}`, tiles: [
            { label: "Grounded", value: pct(p.filter((x) => x.judge === 1).length / p.length) },
          ] });
          render();
        }, { variant: "primary" }),
        button("Export", () => exportJson("rag-evals.json", {
          variant: state.variant, judge: state.judge,
          items: pairs().map((x) => ({ id: x.item.id, human: x.human, judge: x.judge, category: x.category })),
        })),
      ]),
    ])
  );

  const p = pairs();
  clear(resultsRoot);
  if (state.panel === "abstention") resultsRoot.append(abstainPanel(p));
  else resultsRoot.append(groundPanel(p));
  if (state.panel === "compare") resultsRoot.append(comparePanel(p));

  const bad = p.filter((x) => x.human !== x.judge);
  resultsRoot.append(el("div", { class: "panel" }, [
    el("h2", { text: `Ungrounded answers the judge missed (${bad.length})` }),
    itemList(bad.slice(0, 8).map((x) => ({
      glyph: x.human === 1 ? "✗" : "✓",
      tone: x.human === 1 ? "bad" : "warn",
      title: x.item.question,
      detail: x.item.outputs[state.variant],
      meta: `passages: ${x.item.passages.length}`,
    })), { empty: "The judge caught every one." }),
  ]));

  board.update({ caption: `${state.variant} · ${state.judge}`, tiles: [
    { label: "Grounded", value: pct(p.filter((x) => x.judge === 1).length / p.length) },
  ] });
  board.renderA();
  syncUrl({ preset: presetName, variant: state.variant, judge: state.judge, n: state.n });
  announce(`Grounding panel for ${state.variant}.`);
}

shell({
  title: "Eval Lab — RAG answers",
  subtitle: "Grounding and abstention: the two failures retrieval metrics cannot see.",
  controls: el("div", {}, [controlsRoot, boardRoot]),
  results: resultsRoot,
  footer: el("p", {}, "Educational model. Grounding is decidable here because the retrieved passages are in the dataset."),
});

render();
