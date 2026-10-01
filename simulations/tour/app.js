// Eval Lab — tour (module 1).
//
// A guided walk through the loop the whole course runs on, using one small
// real computation: thirty items from the support set, a generous judge and
// a strict one, and the disagreement between them. Nothing is a mock-up.

import { judgeMetrics, pct, pctInterval, kappaBand } from "../common/stats.js";
import { el, clear, metricTile, confusionTable, shell, announce } from "../common/ui.js";

const steps = [
  {
    title: "1 · Look at it",
    body: "Before any metric exists, you read the outputs. Twenty questions from the support set, with " +
          "what a human said about each one. This is the only step in this course that cannot be skipped, " +
          "and it is the one teams skip most.",
  },
  {
    title: "2 · Measure",
    body: "Pick a check for each failure. Code when correctness is decidable. A judge when the failure is " +
          "about meaning. A human when you genuinely cannot decide any other way. The cost of the check and " +
          "its trustworthiness are not the same thing.",
  },
  {
    title: "3 · Improve",
    body: "Change one thing. Re-run. Read the scoreboard, the interval and the list of items that flipped. " +
          "A change that moves the number without moving the interval is not evidence.",
  },
];

function demoPairs() {
  // A deliberately mixed sample: some good answers, some without citations,
  // some contradicting the handbook.
  const rows = [
    [1, 1], [1, 1], [1, 0], [1, 1], [0, 1], [1, 1], [1, 0], [0, 1], [1, 1], [1, 1],
    [0, 1], [1, 0], [1, 1], [0, 1], [1, 1], [1, 1], [0, 0], [1, 0], [1, 1], [0, 1],
  ].map(([human, judge]) => ({ human, judge }));
  return rows;
}

const controls = el("div");
const results = el("div");

function render() {
  const pairs = demoPairs();
  const m = judgeMetrics(pairs, { resamples: 1000, seed: 3 });
  const band = kappaBand(m.kappa);
  const passed = pairs.filter((p) => p.judge === 1).length;

  clear(controls).append(
    el("div", { class: "panel" }, [
      el("h2", { text: "The loop" }),
      ...steps.map((s) => el("div", { class: "callout" }, [
        el("strong", { text: s.title }),
        el("p", { text: s.body }),
      ])),
    ]),
    el("div", { class: "panel" }, [
      el("h2", { text: "What you will build" }),
      el("p", { text: "A failure taxonomy, an eval set with a dev/test split, an LLM judge validated against " +
        "human labels, and a release gate that blocks a regression you would otherwise have shipped." }),
      el("p", { class: "hint", text: "Modules 1 to 10 need nothing but a browser." }),
    ])
  );

  clear(results).append(
    el("div", { class: "panel" }, [
      el("h2", { text: "A live example, on 20 items" }),
      el("p", { class: "muted", text: "One judge, asked to pass or fail each answer. The humans labelled the same " +
        "20 items by hand. These numbers are computed live, not printed in the lesson." }),
      el("div", { class: "tiles" }, [
        metricTile({ label: "Judge pass rate", value: pct(passed / pairs.length) }),
        metricTile({ label: "Kappa", value: m.kappa.toFixed(2), tone: band.tone, note: band.label,
          interval: m.ci.kappa ? `${m.ci.kappa.lo.toFixed(2)}–${m.ci.kappa.hi.toFixed(2)}` : "" }),
        metricTile({ label: "TPR", value: pct(m.tpr), note: "of good answers, judge passes" }),
        metricTile({ label: "TNR", value: pct(m.tnr), note: "of bad answers, judge fails" }),
      ]),
      confusionTable(m.confusion, "Rows are human labels, columns are the judge"),
      el("div", { class: "callout warn" }, [
        el("strong", { text: "Look at the TNR. " }),
        `The judge passes ${pct(m.tpr)} of the answers humans passed, but fails only ${pct(m.tnr)} of the ones ` +
        `humans failed. Four in five real problems sail through. A judge like that is a number generator, not a gate — ` +
        `and modules 5 to 7 are about how to tell the difference before you trust it.`,
      ]),
      el("p", { class: "hint", text: "Every other lab in the course is a bigger version of this page: turn a knob, watch the agreement move." }),
    ])
  );
  announce("Eval Lab tour loaded.");
}

shell({
  title: "Eval Lab — tour",
  subtitle: "What the course is for, and what a judge score actually means.",
  controls,
  results,
});

render();