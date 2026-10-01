// Eval Lab — error analysis (module 2).
//
// The workflow the course asks you to do before writing a single metric:
//
//   read a trace -> write a note in your own words (open coding)
//                 -> attach that note to a tag (axial coding)
//                 -> count the tags -> decide where to stop
//
// Your notes and tags stay in this browser (localStorage, wrapped in try/catch
// because a sandboxed iframe may refuse) and can be exported as JSON. Nothing
// is uploaded.

import { pct } from "../common/stats.js";
import { TraceViewer, el, clear, knob, radioGroup, select, button, metricTile,
         itemList, exportJson, shell, announce, store, getPreset, syncUrl } from "../common/ui.js";

const D = window.EvalLabData["support-traces"];
if (!D) { document.body.textContent = "Traces failed to load."; throw new Error("no data"); }

/* ------------------------------------------------------------------ *
 * The taxonomy starts empty. That is the point.
 *
 * The labels a learner sees below are the ones this course ended up with;
 * a learner is expected to arrive at their own, and can type their own tags
 * in. The tag list is a suggestion, not an answer key.
 * ------------------------------------------------------------------ */

const SUGGESTED_TAGS = [
  { id: "no_citation", label: "Right answer, no source" },
  { id: "wrong_fact", label: "Contradicts the handbook" },
  { id: "over_refusal", label: "Refuses a question it should answer" },
  { id: "out_of_scope", label: "Invents policy where there is none" },
  { id: "extra", label: "Adds an unsupported claim" },
  { id: "wrong_slice", label: "Retrieval returned the wrong section" },
  { id: "slow", label: "Unacceptably slow" },
];

const state = {
  strategy: "random",
  slice: "all",
  n: 20,
  cursor: 0,
  pool: [],
  current: null,
};

const notes = store.get("ea-notes", {});
const tags = store.get("ea-tags", {});
const readOrder = store.get("ea-order", []);

function persist() {
  store.set("ea-notes", notes);
  store.set("ea-tags", tags);
  store.set("ea-order", readOrder);
}

function buildPool() {
  let list = D.traces;
  if (state.slice !== "all") list = list.filter((t) => t.section === state.slice);
  if (state.strategy === "thumbs_down") list = list.filter((t) => t.user_feedback === "thumbs down");
  if (state.strategy === "errors") list = list.filter((t) => t.spans.some((s) => s.error));
  if (state.strategy === "random") {
    // Deterministic shuffle so a shared link reopens the same set.
    list = list.slice();
    for (let i = list.length - 1; i > 0; i--) {
      const j = (i * 7919 + 13) % (i + 1);
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
  state.pool = list.slice(0, Math.min(state.n, list.length));
  state.cursor = 0;
  state.current = state.pool[0] || null;
}

/** Failure modes discovered so far, in the order they were first seen. */
function discovered() {
  const seen = [];
  for (const id of readOrder) {
    for (const t of tags[id] || []) {
      if (!seen.includes(t)) seen.push(t);
    }
  }
  return seen;
}

const controlsRoot = el("div");
const traceHost = el("div");
const resultsRoot = el("div");

function buildControls() {
  clear(controlsRoot);
  const sections = [...new Set(D.traces.map((t) => t.section))].sort();

  controlsRoot.append(
    el("div", { class: "panel" }, [
      el("h2", { text: "What you are reading" }),
      select({
        label: "Slice",
        options: [{ value: "all", label: "All sections" },
                  ...sections.map((s) => ({ value: s, label: s }))],
        value: state.slice,
        onChange: (v) => { state.slice = v; buildPool(); render(); },
      }),
      radioGroup({
        label: "Sampling strategy",
        options: [
          { value: "random", label: "Random" },
          { value: "errors", label: "Only traces with a span error" },
          { value: "thumbs_down", label: "Only thumbs down" },
        ],
        value: state.strategy,
        onChange: (v) => { state.strategy = v; buildPool(); render(); },
        hint: "Each one over-samples a different thing. None of them is neutral.",
      }),
      knob({
        label: "Traces in this batch", min: 5, max: D.traces.length, step: 5, value: state.n,
        format: (v) => `${v}`,
        onInput: (v) => { state.n = v; buildPool(); render(); },
      }),
    ]),

    el("div", { class: "panel" }, [
      el("h2", { text: "Progress" }),
      el("p", { class: "muted", text: `${readOrder.length} traces read. ` +
        `${discovered().length} distinct failure modes named.` }),
      button("Start over", () => {
        for (const k of Object.keys(notes)) delete notes[k];
        for (const k of Object.keys(tags)) delete tags[k];
        readOrder.length = 0;
        persist(); buildPool(); render();
      }),
      button("Export notes and tags", () => exportJson("error-analysis.json", {
        notes, tags, readOrder, discovered: discovered(),
      })),
    ])
  );
}

function renderTrace() {
  clear(traceHost);
  if (!state.current) {
    traceHost.append(el("p", { class: "muted", text: "No traces match that filter." }));
    return;
  }
  const t = state.current;
  traceHost.append(
    el("h2", { text: t.question }),
    el("p", { class: "muted small" },
      `${t.trace_id} · ${t.section} · user feedback: ${t.user_feedback || "none recorded"}`),
    el("div", { class: "trace-holder" })
  );
  const holder = traceHost.querySelector(".trace-holder");
  new TraceViewer(holder).render(t.spans);
}

function renderCoding() {
  clear(resultsRoot);
  const t = state.current;
  if (!t) { resultsRoot.append(el("p", { class: "muted", text: "Pick a trace first." })); return; }

  const note = notes[t.id] || "";
  const assigned = tags[t.id] || [];

  const noteBox = el("textarea", { rows: 4, "aria-label": "Your note about this trace" });
  noteBox.value = note;
  noteBox.addEventListener("input", (e) => { notes[t.id] = e.target.value; persist(); });

  const tagBoxes = SUGGESTED_TAGS.map((tag) => {
    const id = `tag-${tag.id}`;
    const input = el("input", { type: "checkbox", id });
    input.checked = assigned.includes(tag.id);
    input.addEventListener("change", () => {
      const cur = new Set(tags[t.id] || []);
      if (input.checked) cur.add(tag.id); else cur.delete(tag.id);
      tags[t.id] = [...cur];
      persist();
      renderCounts();
    });
    return el("div", { class: "radio" }, [
      input, el("label", { for: id, text: tag.label }),
    ]);
  });

  resultsRoot.append(
    el("div", { class: "panel" }, [
      el("h2", { text: "Open coding: what is wrong here, in your words" }),
      noteBox,
      el("p", { class: "hint", text: "Write the observation before you pick a label. If you cannot write it, " +
        "you have not understood the failure yet, and a tag would only hide that." }),
      el("div", {}, [
        button("Save and next", () => { next(); }, { variant: "primary" }),
        button("Skip", () => { next(); }),
      ]),
    ]),
    el("div", { class: "panel" }, [
      el("h2", { text: "Axial coding: group it" }),
      el("div", { class: "radio-row" }, tagBoxes),
      el("details", {}, [
        el("summary", { text: "Write your own tag" }),
        customTagInput(t),
      ]),
    ]),
    el("div", { class: "panel" }, [
      el("h2", { text: "Where the batch stands" }),
      el("div", { id: "counts" }),
    ])
  );
  renderCounts();
}

function customTagInput(t) {
  const input = el("input", { type: "text", "aria-label": "New tag name", placeholder: "e.g. wrong tone for an angry user" });
  return el("div", {}, [
    input,
    el("div", {}, [
      button("Add tag", () => {
        const name = input.value.trim();
        if (!name) return;
        const id = `custom:${name.toLowerCase().replace(/\W+/g, "-")}`;
        if (!SUGGESTED_TAGS.some((s) => s.id === id)) {
          SUGGESTED_TAGS.push({ id, label: name });
        }
        const cur = new Set(tags[t.id] || []);
        cur.add(id);
        tags[t.id] = [...cur];
        persist();
        render();
        announce(`Tag ${name} added.`);
      }),
    ]),
  ]);
}

function renderCounts() {
  const host = document.getElementById("counts");
  if (!host) return;
  const counts = new Map();
  for (const id of readOrder) {
    for (const tag of tags[id] || []) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  const rows = [...counts].sort((a, b) => b[1] - a[1]).map(([tagId, n]) => {
    const label = SUGGESTED_TAGS.find((s) => s.id === tagId)?.label || tagId;
    return el("tr", {}, [
      el("th", { scope: "row", text: label }),
      el("td", { text: String(n) }),
      el("td", { text: pct(n / Math.max(1, readOrder.length), 0) }),
    ]);
  });
  const known = counts.size;
  const read = readOrder.length;
  const saturated = known > 0 && read >= 20 && (counts.get([...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a))[0]) || 0) / read < 0.6;

  host.replaceChildren(
    el("p", { class: "muted", text: `${read} traces read, ${known} distinct failure modes.` }),
    known
      ? el("table", {}, [
          el("thead", {}, [el("tr", {}, [
            el("th", { scope: "col", text: "Failure mode" }),
            el("th", { scope: "col", text: "Traces" }),
            el("th", { scope: "col", text: "Share" }),
          ])]),
          el("tbody", {}, rows),
        ])
      : el("p", { class: "muted", text: "No tags yet. Open-code a few traces first." }),
    saturated
      ? el("div", { class: "callout" }, [
          el("strong", { text: "You can probably stop. " }),
          `After ${read} traces the largest category is under 60% of what you have read, and new traces are ` +
          `mostly landing in categories you already have. Reading more is now costing time for little new information — ` +
          "which is the point at which the taxonomy is good enough to start choosing checks.",
        ])
      : el("div", { class: "callout warn" },
        "Under 20 traces, a taxonomy is a guess. Most first-pass categories change once you have read a few dozen."),
    el("div", {}, [
      button("Next trace", () => next(), { variant: "primary" }),
    ])
  );
}

function next() {
  if (state.current && !readOrder.includes(state.current.id)) readOrder.push(state.current.id);
  state.cursor++;
  state.current = state.pool[state.cursor] || null;
  persist();
  render();
  if (!state.current) announce("End of batch.");
}

function render() {
  buildControls();
  renderTrace();
  renderCoding();
  syncUrl({ preset: getPreset(), strategy: state.strategy, n: state.n, slice: state.slice });
  announce(`${readOrder.length} traces read, ${discovered().length} failure modes.`);
}

shell({
  title: "Eval Lab — error analysis",
  subtitle: "Read traces, name failures in your own words, then count them. Before any metric exists.",
  controls: controlsRoot,
  results: resultsRoot,
  footer: el("p", {}, [
    "Your notes and tags are stored in this browser only and can be exported as JSON. ",
    "Educational model: the traces are generated, the workflow is real.",
  ]),
});

buildPool();
render();