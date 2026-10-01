// Eval Lab — check this device.
//
// The fundamentals path is recorded-only, so this page has to be able to say
// "everything works" on a machine with no WebGPU, no WebLLM and no storage.
// It never contacts the network: reachability is reported as "not checked"
// rather than tested, because a check that phones home is not a check.
//
// Live judges (WebLLM / Ollama / your own key) belong to the full Eval Lab,
// not to this page. This one only answers the question a learner actually has
// on module 1: can this browser run the labs?

import { el, clear, button, shell, announce } from "../common/ui.js";

const controlsRoot = el("div");
const resultsRoot = el("div");

function checkWebAssembly() {
  try {
    // A minimal module that validates and returns 1.
    const bytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 127,
      3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 161, 15, 11]);
    return { ok: typeof WebAssembly === "object" && !!new WebAssembly.Module(bytes), detail: "ES modules and WebAssembly" };
  } catch (e) {
    return { ok: false, detail: String(e.message || e) };
  }
}

function checkModules() {
  // If this module loaded at all, ES module imports work.
  return { ok: true, detail: "ES modules loaded" };
}

function checkWebGPU() {
  if (!("gpu" in navigator)) {
    return { ok: false, optional: true, detail: "not present — needed only for live judges in the browser" };
  }
  return { ok: true, optional: true, detail: "present — live judges can run here" };
}

function checkStorage() {
  try {
    const k = "evallab-check";
    window.localStorage.setItem(k, "1");
    const v = window.localStorage.getItem(k);
    window.localStorage.removeItem(k);
    return v === "1"
      ? { ok: true, detail: "available — your notes and pinned runs persist" }
      : { ok: false, detail: "writes silently fail" };
  } catch (e) {
    return {
      ok: false, optional: true,
      detail: "blocked (normal inside a sandboxed frame) — the labs still work, nothing is kept between visits",
    };
  }
}

function checkViewport() {
  return { ok: window.innerWidth >= 360, detail: `${window.innerWidth}px wide` };
}

function checkReducedMotion() {
  const m = window.matchMedia("(prefers-reduced-motion: reduce)");
  return m.matches
    ? { ok: true, optional: true, detail: "reduced motion is on and the labs honour it" }
    : { ok: true, optional: true, detail: "animations are enabled" };
}

function benchmark() {
  // Time 2,000 bootstrap-style resamples so the learner knows whether the
  // statistics will be instant on their machine.
  const t0 = performance.now();
  let acc = 0;
  for (let b = 0; b < 2000; b++) {
    for (let i = 0; i < 50; i++) acc += Math.random();
  }
  const ms = performance.now() - t0;
  return { ms, acc };
}

function row(label, r) {
  const glyph = r.ok ? "✓" : r.optional ? "—" : "✗";
  const tone = r.ok ? "good" : r.optional ? "warn" : "bad";
  const verdict = r.ok ? "works" : r.optional ? "not needed here" : "will not work";
  return el("tr", {}, [
    el("th", { scope: "row" }, [el("span", { class: "row-glyph", "aria-hidden": "true", text: glyph }), document.createTextNode(label)]),
    el("td", { class: `tone-${tone}`, text: verdict }),
    el("td", { class: "muted", text: r.detail }),
  ]);
}

function render() {
  const results = [
    checkModules(), checkWebAssembly(), checkStorage(), checkViewport(), checkReducedMotion(), checkWebGPU(),
  ];
  const blocking = results.filter((r) => !r.ok && !r.optional);

  clear(resultsRoot).append(
    el("div", { class: "panel" }, [
      el("h2", { text: "Can this browser run the course?" }),
      blocking.length === 0
        ? el("div", { class: "callout" }, [
            el("strong", { text: "Yes. " }),
            "Every lesson from 1 to 10 works on this device with no install, no key and no network.",
          ])
        : el("div", { class: "callout warn" }, [
            el("strong", { text: `${blocking.length} check(s) failed. ` }),
            "The lessons still load, but some will be slow or partly unreadable. Try a current Chrome, Edge, " +
            "Firefox or Safari, and make sure JavaScript is enabled for this site.",
          ]),
      el("table", {}, [
        el("thead", {}, [el("tr", {}, [
          el("th", { scope: "col", text: "Check" }),
          el("th", { scope: "col", text: "Result" }),
          el("th", { scope: "col", text: "Detail" }),
        ])]),
        el("tbody", {}, results.map((r, i) => row(
          ["ES modules", "WebAssembly", "Local storage", "Viewport at least 360px", "Reduced motion", "WebGPU"][i],
          r
        ))),
      ]),
    ]),

    el("div", { class: "panel" }, [
      el("h2", { text: "How fast is this device?" }),
      el("p", { class: "muted", text: "Every metric in the course is computed on this machine. The target is " +
        "that changing a knob feels instant, including the bootstrap intervals." }),
      el("p", { id: "bench", text: "Run the benchmark." }),
      button("Run benchmark", () => {
        const b = benchmark();
        const verdict = b.ms < 120 ? "fast" : b.ms < 400 ? "usable" : "slow";
        document.getElementById("bench").textContent =
          `100,000 resamples took ${b.ms.toFixed(0)} ms — ${verdict}.`;
        announce(`Benchmark: ${b.ms.toFixed(0)} milliseconds, ${verdict}.`);
      }, { variant: "primary" }),
      el("p", { class: "hint", text: "Below about 120 ms is comfortable, above 400 ms the knobs will feel sticky " +
        "and you may want a smaller sample size while experimenting." }),
    ]),

    el("div", { class: "panel" }, [
      el("h2", { text: "What this page did not do" }),
      el("p", { text: "It made no network requests. A device check that phones home is not a check, and a " +
        "sandboxed iframe could not do it anyway. Model downloads and live judges are part of the full Eval " +
        "Lab, which you open separately and only if you want to." }),
    ])
  );
}

shell({
  title: "Check this device",
  subtitle: "Sixty seconds before you start module 1.",
  controls: el("div", {}, [
    el("div", { class: "panel" }, [
      el("h2", { text: "Why bother" }),
      el("p", { text: "Every lab in modules 1 to 10 runs entirely in this browser. There is nothing to install " +
        "and no API key to buy, so the only thing that can go wrong is the browser itself. This page tells you " +
        "whether it will." }),
      el("p", { class: "hint", text: "Re-run it on a different device if something looks wrong in a lab." }),
    ]),
  ]),
  results: resultsRoot,
  footer: el("p", {}, "Educational model. No data leaves this page and none is collected."),
});

render();