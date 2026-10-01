// Eval Lab — code-based checks (module 3).
//
// The point of this lab: these evaluators run live, in your browser, and you
// can read all of them. When a check can be decided by code, a model is the
// expensive and less trustworthy way to reach the same answer.
//
// The recipe-extraction set is used because correctness is fully decidable:
// there is one right JSON object and you know what it is.

import {
  METRICS, runCodeMetric, validateSchema, parseJsonLoose, isValidRegex,
  rougeL, tokenF1, numericMatch,
} from "../common/codemetrics.js";
import { wilson, pct, pctInterval } from "../common/stats.js";
import {
  el, clear, knob, select, radioGroup, textArea, button, metricTile,
  itemList, exportJson, Scoreboard, shell, announce, getPreset, syncUrl,
} from "../common/ui.js";

const D = window.EvalLabData.recipe;
if (!D) { document.body.textContent = "Dataset failed to load."; throw new Error("no data"); }

const PRESETS = {
  "assertions": { metric: "exact_match", variant: "v1" },
  "regex":      { metric: "json_parse", variant: "v3" },
  "schema":     { metric: "json_schema", variant: "v3" },
  "numbers":    { metric: "numeric", variant: "v3" },
  "overlap":    { metric: "rouge_l", variant: "v3" },
  "rougetrap":  { metric: "rouge_l", variant: "v3", trick: true },
};

const presetName = getPreset() || "assertions";
const preset = PRESETS[presetName] || PRESETS.assertions;

const state = {
  metric: preset.metric,
  variant: preset.variant,
  size: D.items.length,
  tolerance: 0.01,
  relative: true,
  regex: "^\\s*[\\{\\[]",
  trick: !!preset.trick,
};

const controlsRoot = el("div");
const boardRoot = el("div");
const resultsRoot = el("div");
const board = new Scoreboard(boardRoot, "Scoreboard — pin a check, change it, read what it now misses");

/** The "padded wrong answer" from the recipe set, used by the ROUGE trap. */
function itemsInPlay() {
  const base = D.items.slice(0, state.size);
  if (!state.trick) return base;
  // Same tokens, wrong number, plus filler — the shape of answer that flatters
  // an overlap metric and would sail past a human skimming.
  return base.map((it) => {
    const parsed = parseJsonLoose(it.outputs[state.variant]);
    if (!parsed.ok) return it;
    const doubled = JSON.parse(JSON.stringify(parsed.data));
    if (Array.isArray(doubled.ingredients) && doubled.ingredients.length) {
      doubled.ingredients[0].qty = Math.round(doubled.ingredients[0].qty * 2);
    }
    const verbose = `${it.outputs[state.variant]}\nActually, double the first ingredient — it gives a better ` +
      `crumb and the mixture rises more evenly in the tin. I have found this works reliably even at altitude, ` +
      `and many readers prefer the lighter texture that results.`;
    return { ...it, outputs: { ...it.outputs, [state.variant]: verbose }, doubled };
  });
}

function compute() {
  const items = itemsInPlay();
  const metric = state.metric;
  const ctx = {
    variant: state.variant,
    schema: D.schema,
    tolerance: state.tolerance,
    relative: state.relative,
  };

  if (metric === "regex") {
    // A hand-written regex check, run live over the raw outputs.
    const valid = isValidRegex(state.regex);
    const rows = items.map((it, i) => ({
      index: i,
      id: it.id,
      score: valid && new RegExp(state.regex).test(it.outputs[state.variant]) ? 1 : 0,
      output: it.outputs[state.variant],
      reference: it.reference,
    }));
    const passed = rows.filter((r) => r.score === 1).length;
    return { rows, mean: items.length ? passed / items.length : 0, label: "Regex", valid,
             ci: wilson(passed, items.length) };
  }

  const out = runCodeMetric(metric, items, ctx);
  return {
    rows: out.rows,
    mean: out.mean,
    label: METRICS[metric]?.label ?? metric,
    ci: wilson(rows_binary(out.rows), items.length),
  };
}

function rows_binary(rows) {
  return rows.reduce((a, r) => a + r.score, 0);
}

function detailFor(row, items) {
  const it = items[row.index];
  if (!it) return {};
  if (state.metric === "json_schema" || state.metric === "json_parse") {
    const parsed = parseJsonLoose(it.outputs[state.variant]);
    if (!parsed.ok) return { detail: "Output is not JSON at all.", tone: "bad", glyph: "✗" };
    if (state.metric === "json_schema") {
      const errs = validateSchema(parsed.data, D.schema);
      if (errs.length) {
        return {
          detail: errs.slice(0, 3).map((e) => `${e.path} ${e.rule}: ${e.message}`).join("; "),
          tone: "bad", glyph: "✗",
        };
      }
    }
    return { detail: `Parsed (${parsed.recovered === "exact" ? "clean" : `recovered from ${parsed.recovered}`}).`, tone: "good", glyph: "✓" };
  }
  if (state.metric === "rouge_l") {
    const r = rougeL(it.outputs[state.variant], it.reference);
    return {
      detail: `ROUGE-L ${r.f.toFixed(2)} — precision ${r.precision.toFixed(2)}, recall ${r.recall.toFixed(2)}. ` +
        (r.precision < 0.6 ? "Low precision: lots of tokens that are not in the reference. " : "") +
        (r.recall < 0.6 ? "Low recall: most of the reference is missing. " : ""),
      tone: r.f > 0.8 ? "warn" : "bad", glyph: "△",
    };
  }
  if (state.metric === "token_f1") {
    const r = tokenF1(it.outputs[state.variant], it.reference);
    return { detail: `F1 ${r.f.toFixed(2)} (precision ${r.precision.toFixed(2)}, recall ${r.recall.toFixed(2)})`,
             tone: "warn", glyph: "△" };
  }
  if (state.metric === "numeric") {
    const ok = numericMatch(it.outputs[state.variant], it.reference, state.tolerance, state.relative);
    return { detail: ok ? "Within tolerance." : "Outside tolerance.",
             tone: ok ? "good" : "bad", glyph: ok ? "✓" : "✗" };
  }
  return { detail: `Score ${row.score.toFixed(2)}`, tone: row.score === 1 ? "good" : "bad", glyph: row.score === 1 ? "✓" : "✗" };
}

function buildControls() {
  clear(controlsRoot);
  controlsRoot.append(
    el("div", { class: "panel" }, [
      el("h2", { text: "Which check" }),
      select({
        label: "Metric",
        options: [
          { value: "exact_match", label: "Exact match" },
          { value: "contains", label: "Contains a substring" },
          { value: "regex", label: "Regex" },
          { value: "json_parse", label: "JSON parses" },
          { value: "json_schema", label: "JSON matches the schema" },
          { value: "numeric", label: "Numeric tolerance" },
          { value: "token_f1", label: "Token F1" },
          { value: "rouge_l", label: "ROUGE-L" },
        ],
        value: state.metric,
        onChange: (v) => { state.metric = v; render(); },
        hint: "All of these run in this page. There is no model call and nothing leaves the browser.",
      }),
      select({
        label: "System output",
        options: D.variants.map((v) => ({ value: v.id, label: v.label })),
        value: state.variant,
        onChange: (v) => { state.variant = v; render(); },
      }),
      knob({
        label: "How many recipes", min: 5, max: D.items.length, step: 1, value: state.size,
        format: (v) => `${v}`,
        onInput: (v) => { state.size = v; render(); },
      }),
      el("div", {}, [
        button("Pin as A", () => { board.pin(snapshot()); render(); }, { variant: "primary" }),
        button("Export", () => exportJson("code-checks.json", {
          metric: state.metric, variant: state.variant, rows: compute().rows.map((r) => ({ id: r.id, score: r.score })),
        })),
      ]),
    ]),

    state.metric === "regex"
      ? el("div", { class: "panel" }, [
          el("h2", { text: "Your regex" }),
          textArea({
            label: "Pattern", value: state.regex, rows: 3,
            onInput: (v) => { state.regex = v; render(); },
            hint: "Tried against every raw output. An invalid pattern scores 0 rather than crashing.",
          }),
        ])
      : null,

    state.metric === "numeric"
      ? el("div", { class: "panel" }, [
          el("h2", { text: "Tolerance" }),
          knob({
            label: "Allowed error", min: 0.001, max: 0.2, step: 0.001, value: state.tolerance,
            format: (v) => (state.relative ? `${(v * 100).toFixed(1)}%` : v.toFixed(3)),
            onInput: (v) => { state.tolerance = v; render(); },
          }),
          radioGroup({
            label: "Relative or absolute",
            options: [{ value: "rel", label: "Relative to the value" }, { value: "abs", label: "Absolute" }],
            value: state.relative ? "rel" : "abs",
            onChange: (v) => { state.relative = v === "rel"; render(); },
            hint: "180 °F is a huge absolute miss and a 1% relative one.",
          }),
        ])
      : null,

    el("div", { class: "panel" }, [
      el("h2", { text: "Break the metric" }),
      el("p", { class: "muted", text: "Turn on the padded answer: the first quantity is doubled and two " +
        "sentences of confident filler are added. The content is wrong; the wording is more like the reference." }),
      el("div", {}, [
        button(state.trick ? "Show the real outputs" : "Show the padded outputs",
          () => { state.trick = !state.trick; render(); }, { variant: state.trick ? "primary" : "" }),
      ]),
    ])
  );
}

function snapshot() {
  const r = compute();
  return {
    caption: `${r.label} · variant ${state.variant} · ${r.rows.length} recipes`,
    tiles: [{ label: "Pass rate", value: pct(r.mean), interval: pctInterval(r.ci) }],
  };
}

function render() {
  const items = itemsInPlay();
  const r = compute();
  buildControls();
  clear(resultsRoot);

  const failing = r.rows.filter((row) => row.score < 0.99);

  resultsRoot.append(
    el("div", { class: "panel" }, [
      el("h2", { text: r.label }),
      state.metric === "regex" && !r.valid
        ? el("div", { class: "callout warn" }, "That is not a valid regular expression, so it scores zero on everything. Fix the pattern.")
        : null,
      el("div", { class: "tiles" }, [
        metricTile({ label: "Pass rate", value: pct(r.mean), interval: pctInterval(r.ci), tone: r.mean > 0.9 ? "good" : r.mean > 0.6 ? "warn" : "bad" }),
        metricTile({ label: "Recipes", value: String(r.rows.length) }),
        metricTile({ label: "Failing", value: String(failing.length), tone: failing.length ? "warn" : "good" }),
      ]),
      el("p", { class: "hint", text: "The interval is a Wilson interval on the pass rate. On 20 recipes it is wide, " +
        "which is exactly why a code check that does not move the interval is not a result." }),
    ]),

    el("div", { class: "panel" }, [
      el("h2", { text: `Failing items (${failing.length})` }),
      itemList(failing.slice(0, 10).map((row) => {
        const d = detailFor(row, items);
        return {
          glyph: d.glyph || "✗",
          tone: d.tone || "bad",
          title: `${items[row.index].name}`,
          detail: d.detail || "",
          meta: `Output: ${String(row.output).slice(0, 180).replace(/\s+/g, " ")}`,
        };
      }), { empty: "Every recipe passes this check." }),
      el("details", {}, [
        el("summary", { text: "What does a passing check actually prove?" }),
        el("p", { text: "It proves this check, on these recipes, agrees with the reference. It does not prove " +
          "the recipe is right, that the model understood it, or that the same check will hold on a different " +
          "input. A check that passes 100% is often a check that cannot fail." }),
      ]),
    ]),

    el("div", { class: "panel" }, [
      el("h2", { text: "Code, judge, or a human?" }),
      el("table", {}, [
        el("thead", {}, [el("tr", {}, [
          el("th", { scope: "col", text: "Failure" }),
          el("th", { scope: "col", text: "Use" }),
          el("th", { scope: "col", text: "Because" }),
        ])]),
        el("tbody", {}, [
          el("tr", {}, [el("td", { text: "Malformed JSON" }), el("td", { text: "Code" }),
            el("td", { text: "Decidable, free, instant, and the error names the field." })]),
          el("tr", {}, [el("td", { text: "Wrong oven temperature" }), el("td", { text: "Code" }),
            el("td", { text: "The right number is known. Comparing strings is a worse judge than a judge." })]),
          el("tr", {}, [el("td", { text: "Is this step clear to a beginner?" }), el("td", { text: "Judge" }),
            el("td", { text: "No rule decides it, but people agree often enough to measure." })]),
          el("tr", {}, [el("td", { text: "Is this recipe a good idea for a dinner party?" }), el("td", { text: "Human" }),
            el("td", { text: "The targets disagree with each other. A judge would average them into mush." })]),
        ]),
      ]),
      el("p", { class: "hint", text: "Write the reason down. A check without a stated reason is a check nobody " +
        "will remember to maintain." }),
    ])
  );

  board.update(snapshot());
  board.renderA();
  syncUrl({ preset: presetName, metric: state.metric, variant: state.variant, n: state.size });
  announce(`${r.label}: ${pct(r.mean)} pass rate on ${r.rows.length} recipes.`);
}

shell({
  title: "Eval Lab — code-based checks",
  subtitle: "Recipe to JSON. Every evaluator here runs live and you can read all of it.",
  controls: el("div", {}, [controlsRoot, boardRoot]),
  results: resultsRoot,
  footer: el("p", {}, "Educational model. The outputs are generated; the evaluators are real code running in your browser."),
});

render();