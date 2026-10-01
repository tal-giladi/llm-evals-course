// Eval Lab — evaluating agents (module 9).
//
// The lesson: an agent that reaches the right answer has not necessarily
// done the right thing. End-state scoring is cheap and blind; trajectory
// scoring is expensive and can catch a run that should have been blocked.
//
// A quarter of this dataset (10 of 40 runs) ends correctly by a wrong
// route, which is the case an end-state metric scores as a pass.

import { wilson, pct, pctInterval } from "../common/stats.js";
import { TraceViewer, el, clear, knob, radioGroup, button, metricTile,
         itemList, exportJson, shell, announce, getPreset, syncUrl } from "../common/ui.js";

const D = window.EvalLabData.agent;
if (!D) { document.body.textContent = "Dataset failed to load."; throw new Error("no data"); }

const PRESETS = {
  "end-state":   { mode: "end" },
  "trajectory":  { mode: "trajectory" },
  "steps":       { mode: "steps" },
  // The trace view is the same scoring as trajectory — it exists so lesson
  // 09.4 can open straight onto the runs that fail, with the spans on screen.
  "trace":       { mode: "trajectory" },
};

const presetName = getPreset() || "end-state";
const preset = PRESETS[presetName] || PRESETS["end-state"];

const state = { mode: preset.mode, selected: D.runs[0].id };

const controlsRoot = el("div");
const resultsRoot = el("div");
const traceHost = el("div");

/** A run "passes" under each scoring mode, and the two disagree a lot. */
function verdictFor(run, mode) {
  switch (mode) {
    case "end":
      // Did it reach an acceptable end state, however it got there?
      return run.end_state === "ok" || run.end_state === "ok_but_wrong_path" ? 1 : 0;
    case "trajectory":
      // Every step correct: the route matters.
      return run.first_bad_step === -1 ? 1 : 0;
    case "steps":
      // Share of steps that were correct.
      return run.steps.length ? Math.max(0, (run.steps.length - Math.max(0, run.first_bad_step + 1)) / run.steps.length) : 0;
    default:
      return 0;
  }
}

function aggregate(mode, runs) {
  const scored = runs.map((r) => ({ run: r, score: verdictFor(r, mode) }));
  const mean = scored.reduce((a, s) => a + s.score, 0) / scored.length;
  const binary = mode !== "steps";
  return {
    scored,
    mean,
    ci: binary ? wilson(scored.filter((s) => s.score === 1).length, scored.length) : null,
  };
}

function modePanel(runs) {
  const rows = ["end", "trajectory", "steps"].map((mode) => {
    const a = aggregate(mode, runs);
    return el("tr", { class: mode === state.mode ? "diff-up" : "" }, [
      el("th", { scope: "row", text: { end: "End state", trajectory: "Trajectory", steps: "Per-step" }[mode] }),
      el("td", { text: pct(a.mean) }),
      el("td", { text: a.ci ? pctInterval(a.ci) : "—" }),
      el("td", { text: String(a.scored.filter((s) => s.score === 1).length) }),
    ]);
  });
  const endA = aggregate("end", runs).mean;
  const trajA = aggregate("trajectory", runs).mean;
  const hidden = runs.filter((r) => r.end_state === "ok_but_wrong_path").length;

  return el("div", { class: "panel" }, [
    el("h2", { text: "Three ways to score the same 40 runs" }),
    el("table", {}, [
      el("thead", {}, [el("tr", {}, [
        el("th", { scope: "col", text: "Scoring" }),
        el("th", { scope: "col", text: "Pass rate" }),
        el("th", { scope: "col", text: "Wilson 95% CI" }),
        el("th", { scope: "col", text: "Runs passed" }),
      ])]),
      el("tbody", {}, rows),
    ]),
    hidden
      ? el("div", { class: "callout warn" }, [
          el("strong", { text: `${hidden} runs reached the right answer by a wrong route. ` }),
          "End-state scoring calls them passes. Trajectory scoring does not. Which one you want depends on " +
          "what you are actually protecting: the answer the user sees, or the side effects on the way there — " +
          "cost, rate limits, and writes to systems that are hard to undo.",
        ])
      : null,
  ]);
}

function runsPanel(runs, a) {
  const failing = a.scored.filter((s) => s.score < 1);
  return el("div", { class: "panel" }, [
    el("h2", { text: `Runs failing this scoring (${failing.length})` }),
    itemList(failing.slice(0, 10).map((s) => ({
      glyph: "✗", tone: s.score === 0 ? "bad" : "warn",
      title: s.run.task,
      detail: s.run.end_state === "ok_but_wrong_path"
        ? "Reached the right end state after a wrong step."
        : s.run.end_state === "wrong"
          ? "Ended in the wrong state."
          : `Scored ${s.score.toFixed(2)} on the per-step metric.`,
      meta: s.run.first_bad_step >= 0
        ? `first bad step: ${s.run.first_bad_step + 1} of ${s.run.steps.length} — ${s.run.steps[s.run.first_bad_step]}`
        : "no bad step",
    })), { empty: "Every run passes this scoring." }),
    el("details", {}, [
      el("summary", { text: "Locating the failing step" }),
      el("p", { text: "A binary run-level score tells you the agent failed. It tells you nothing about where. " +
        "Attaching a step index to each failure is what turns a metric into something you can debug — and it " +
        "is the difference between 'the agent is unreliable' and 'it uses the wrong unit after searching'." }),
    ]),
  ]);
}

function render() {
  const runs = D.runs;
  const a = aggregate(state.mode, runs);

  clear(controlsRoot).append(
    el("div", { class: "panel" }, [
      el("h2", { text: "How are you scoring" }),
      radioGroup({
        label: "Scoring method",
        options: [
          { value: "end", label: "End state only" },
          { value: "trajectory", label: "Trajectory — every step" },
          { value: "steps", label: "Per-step partial credit" },
        ],
        value: state.mode,
        onChange: (v) => { state.mode = v; render(); },
        hint: "End state is one check per run. Trajectory needs a check per step, which is where the cost is.",
      }),
      el("div", {}, [
        button("Export runs", () => exportJson("agent-evals.json", {
          mode: state.mode,
          runs: runs.map((r) => ({ id: r.id, end_state: r.end_state, first_bad_step: r.first_bad_step, score: verdictFor(r, state.mode) })),
        })),
      ]),
    ]),
    el("div", { class: "panel" }, [
      el("h2", { text: "One run in detail" }),
      (() => {
        const sel = el("select", { "aria-label": "Choose a run",
          onchange: (e) => { state.selected = e.target.value; render(); } },
          runs.map((r) => el("option", { value: r.id, selected: r.id === state.selected }, [`${r.id} — ${r.task.slice(0, 46)}`])));
        return el("div", { class: "field" }, [el("label", { text: "Run" }), sel]);
      })(),
    ])
  );

  clear(resultsRoot).append(
    el("div", { class: "panel" }, [
      el("h2", { text: "Agent success" }),
      el("div", { class: "tiles" }, [
        metricTile({ label: "Pass rate", value: pct(a.mean), interval: a.ci ? pctInterval(a.ci) : "per-step mean" }),
        metricTile({ label: "Runs", value: String(runs.length) }),
        metricTile({ label: "Wrong route, right answer", value: String(runs.filter((r) => r.end_state === "ok_but_wrong_path").length),
          tone: "warn", note: "invisible to end-state scoring" }),
        metricTile({ label: "Calls per run", value: (runs.reduce((a2, r) => a2 + r.spans.filter((s) => s.kind === "chat").length, 0) / runs.length).toFixed(1),
          note: "a trajectory check runs once per step" }),
      ]),
    ]),
    modePanel(runs),
    runsPanel(runs, a)
  );

  const run = runs.find((r) => r.id === state.selected) || runs[0];
  clear(traceHost).append(
    el("h2", { text: run.task }),
    el("p", { class: "muted small" },
      `${run.trace_id} · end state: ${run.end_state.replace(/_/g, " ")} · ` +
      `first bad step: ${run.first_bad_step >= 0 ? run.first_bad_step + 1 : "none"}`),
    el("div", { class: "trace-holder" })
  );
  new TraceViewer(traceHost.querySelector(".trace-holder")).render(run.spans);

  syncUrl({ preset: presetName, mode: state.mode });
  announce(`Agent scoring: ${pct(a.mean)} pass rate over ${runs.length} runs.`);
}

shell({
  title: "Eval Lab — agents and conversations",
  subtitle: "The right answer, the wrong route, and how much that costs you.",
  controls: controlsRoot,
  results: resultsRoot,
  footer: el("p", {}, "Educational model. The runs and traces are generated; the scoring arithmetic is real."),
});

render();