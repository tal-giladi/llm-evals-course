// Eval Lab — shared UI kit.
//
// Every simulation in the course is built from these pieces so that a knob
// behaves the same way everywhere. Constraints that come from the hosting
// contract and are load-bearing here:
//
//   * no network requests, no external fonts, no bundler
//   * runs inside a sandboxed iframe (allow-scripts only): no cookies,
//     no parent access, no alert()/prompt(), no popups, no top navigation
//   * localStorage is best-effort and always wrapped in try/catch
//   * nothing may depend on colour alone; every state carries a glyph
//     and a word ("pass", "fail", "fixed", "broke")
//   * keyboard-operable, labelled, responsive from 360 px
//
// Plain ES module, no dependencies.

/* ------------------------------------------------------------------ *
 * Tiny DOM helpers
 * ------------------------------------------------------------------ */

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/* ------------------------------------------------------------------ *
 * Storage and URL state
 * ------------------------------------------------------------------ */

export const store = {
  get(key, fallback = null) {
    try {
      const v = window.localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback; // Sandboxed iframe: no storage. Everything still works.
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};

/**
 * Read the `?preset=…` query string. Every lesson links straight into a
 * specific starting configuration, so a shared link reopens the same view.
 */
export function getPreset() {
  try {
    return new URLSearchParams(window.location.search).get("preset") || "";
  } catch {
    return "";
  }
}

/** Write the current configuration into the URL so the view is shareable. */
export function syncUrl(state) {
  try {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) {
      if (v !== null && v !== undefined && v !== "") params.set(k, String(v));
    }
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  } catch {
    /* sandboxed: history may be blocked. Not fatal. */
  }
}

/* ------------------------------------------------------------------ *
 * Accessibility primitives
 * ------------------------------------------------------------------ */

let liveNode = null;

/**
 * The ARIA live region. Every metric change is announced here in words,
 * because the visual change is a number moving and a screen reader user
 * gets nothing from watching digits.
 */
export function announce(message) {
  if (!liveNode) {
    liveNode = el("div", {
      class: "sr-only",
      role: "status",
      "aria-live": "polite",
      "aria-atomic": "true",
    });
    document.body.appendChild(liveNode);
  }
  liveNode.textContent = ""; // Re-setting identical text does not re-announce.
  window.setTimeout(() => { liveNode.textContent = message; }, 30);
}

/** A visible note that every simulation carries, per the educational-model rule. */
export function educationalBanner(name = "Eval Lab") {
  return el("p", { class: "banner" }, [
    el("strong", { text: `${name} — educational model. ` }),
    "The judge runs shown here come from a seeded model of judge behaviour, not from a real LLM. ",
    "Every statistic on this page is computed for real, in your browser, from those recorded verdicts. ",
    "Your thresholds, samples and comparisons are genuine computations.",
  ]);
}

/* ------------------------------------------------------------------ *
 * Controls
 * ------------------------------------------------------------------ */

let uid = 0;
const nextId = () => `ev-${++uid}`;

/** A labelled range slider. Used for threshold, sample size, padding, tolerance. */
export function knob({ label, min, max, step = 1, value, format = String, onInput, hint }) {
  const id = nextId();
  const out = el("output", { class: "knob-value", for: id, text: format(value) });
  const input = el("input", {
    type: "range", id, min, max, step, value,
    oninput: (e) => {
      const v = Number(e.target.value);
      out.textContent = format(v);
      onInput(v);
    },
  });
  return el("div", { class: "knob" }, [
    el("div", { class: "knob-head" }, [el("label", { for: id, text: label }), out]),
    input,
    hint ? el("p", { class: "hint", text: hint }) : null,
  ]);
}

/** A labelled <select>. */
export function select({ label, options, value, onChange, hint }) {
  const id = nextId();
  const sel = el("select", { id, onchange: (e) => onChange(e.target.value) },
    options.map((o) => el("option", { value: o.value, selected: o.value === value }, [o.label])));
  return el("div", { class: "field" }, [
    el("label", { for: id, text: label }),
    sel,
    hint ? el("p", { class: "hint", text: hint }) : null,
  ]);
}

/** A native radio group — keyboard operable and announced as a group. */
export function radioGroup({ label, options, value, onChange, hint }) {
  const id = nextId();
  return el("fieldset", { class: "field radios" }, [
    el("legend", { text: label }),
    el("div", { class: "radio-row" }, options.map((o) => {
      const rid = `${id}-${o.value}`;
      return el("div", { class: "radio" }, [
        el("input", {
          type: "radio", id: rid, name: id, value: o.value, checked: o.value === value,
          onchange: () => onChange(o.value),
        }),
        el("label", { for: rid, text: o.label, title: o.title || "" }),
      ]);
    })),
    hint ? el("p", { class: "hint", text: hint }) : null,
  ]);
}

/** A text area for free-form judge prompts. */
export function textArea({ label, value, rows = 6, onInput, hint, spellcheck = false }) {
  const id = nextId();
  const area = el("textarea", { id, rows, spellcheck, oninput: (e) => onInput(e.target.value) });
  area.value = value;
  return el("div", { class: "field" }, [
    el("label", { for: id, text: label }),
    area,
    hint ? el("p", { class: "hint", text: hint }) : null,
  ]);
}

export function button(label, onClick, opts = {}) {
  return el("button", {
    type: "button",
    class: opts.variant ? `btn ${opts.variant}` : "btn",
    onclick: onClick,
    title: opts.title || "",
  }, [label]);
}

/* ------------------------------------------------------------------ *
 * Readouts
 * ------------------------------------------------------------------ */

/** A metric with its interval. Always text — no chart is the only way to read a result. */
export function metricTile({ label, value, interval, tone = "neutral", note }) {
  return el("div", { class: `tile tone-${tone}` }, [
    el("span", { class: "tile-label", text: label }),
    el("span", { class: "tile-value", text: value }),
    interval ? el("span", { class: "tile-ci", text: interval }) : null,
    note ? el("span", { class: "tile-note", text: note }) : null,
  ]);
}

/**
 * The confusion matrix as a real <table>. Rows are humans, columns are the
 * judge — the orientation used throughout the course.
 */
export function confusionTable(c, title = "Judge vs human labels") {
  return el("div", { class: "matrix-wrap" }, [
    el("table", { class: "matrix" }, [
      el("caption", { text: title }),
      el("thead", {}, [el("tr", {}, [
        el("th", { scope: "col", text: "Human ↓ / Judge →" }),
        el("th", { scope: "col", class: "good" }, [
          el("span", { class: "cell-n", text: String(c.tp) }), el("span", { class: "cell-l", text: "judge pass" })]),
        el("th", { scope: "col", class: "bad" }, [
          el("span", { class: "cell-n", text: String(c.fn) }), el("span", { class: "cell-l", text: "judge fail" })]),
      ])]),
      el("tbody", {}, [
        el("tr", {}, [
          el("th", { scope: "row", text: "human pass" }),
          el("td", { class: "good" }, [String(c.tp)]),
          el("td", { class: "bad" }, [String(c.fn), el("span", { class: "cell-l", text: "missed" })]),
        ]),
        el("tr", {}, [
          el("th", { scope: "row", text: "human fail" }),
          el("td", { class: "bad" }, [String(c.fp), el("span", { class: "cell-l", text: "false alarm" })]),
          el("td", { class: "good" }, [String(c.tn)]),
        ]),
      ]),
    ]),
  ]);
}

/** A pass/fail list. Each row states the outcome in words, never colour only. */
export function itemList(items, { limit = 20, empty = "Nothing to show." } = {}) {
  if (!items.length) return el("p", { class: "muted", text: empty });
  const shown = items.slice(0, limit);
  return el("div", {}, [
    el("ul", { class: "item-list" }, shown.map((it) =>
      el("li", { class: it.tone ? `row tone-${it.tone}` : "row" }, [
        el("span", { class: "row-glyph", "aria-hidden": "true", text: it.glyph || "" }),
        el("div", { class: "row-body" }, [
          el("p", { class: "row-title", text: it.title }),
          it.detail ? el("p", { class: "row-detail", text: it.detail }) : null,
          it.meta ? el("p", { class: "row-meta", text: it.meta }) : null,
        ]),
      ])
    )),
    items.length > shown.length
      ? el("p", { class: "muted small", text: `…and ${items.length - shown.length} more (use Export to see all).` })
      : null,
  ]);
}

/** Export arbitrary JSON as a download. No network, no server. */
export function exportJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------------ *
 * Scoreboard with A/B pinning
 * ------------------------------------------------------------------ */

/**
 * A two-slot scoreboard. "Pin as A" stores the current results; changing a
 * knob then shows the diff against that pinned run, which is how every
 * "what did my change actually do?" moment in the course works.
 */
export class Scoreboard {
  constructor(root, title = "Scoreboard") {
    this.root = root;
    this.snapshot = null;
    this.title = title;
    this.mount();
  }

  mount() {
    this.a = el("div", { class: "slot" }, [el("h3", { text: "A — pinned" }), el("p", { class: "muted", text: "Nothing pinned yet." })]);
    this.b = el("div", { class: "slot" }, [el("h3", { text: "B — current" })]);
    this.diff = el("div", { class: "diff", hidden: true });
    clear(this.root).append(
      el("h2", { text: this.title }),
      el("div", { class: "slots" }, [this.a, this.b]),
      this.diff,
    );
  }

  pin(current) {
    this.snapshot = { tiles: current.tiles, caption: current.caption, flips: null };
    this.renderA();
    announce(`Pinned as A. ${this.summarise(current)}`);
  }

  unpin() {
    this.snapshot = null;
    this.renderA();
  }

  update(current) {
    clear(this.b).append(
      el("h3", { text: "B — current" }),
      el("p", { class: "slot-caption", text: current.caption || "" }),
      this.tiles(current),
    );
    if (this.snapshot) this.renderDiff(current);
  }

  renderA() {
    if (!this.snapshot) {
      clear(this.a).append(
        el("h3", { text: "A — pinned" }),
        el("p", { class: "muted", text: "Nothing pinned yet. Pin a run, then change a knob." }),
      );
      this.diff.hidden = true;
      return;
    }
    clear(this.a).append(
      el("h3", { text: "A — pinned" }),
      el("p", { class: "slot-caption", text: this.snapshot.caption || "" }),
      this.tiles(this.snapshot),
    );
  }

  tiles(run) {
    return el("div", { class: "tiles" }, run.tiles.map((t) => metricTile(t)));
  }

  renderDiff(current) {
    const a = this.snapshot;
    const rows = [];
    for (let i = 0; i < Math.max(a.tiles.length, current.tiles.length); i++) {
      const ta = a.tiles[i], tb = current.tiles[i];
      if (!ta || !tb) continue;
      const changed = ta.value !== tb.value;
      const direction = changed
        ? (this.numeric(tb.value) >= this.numeric(ta.value) ? "up" : "down")
        : "flat";
      rows.push(el("tr", { class: changed ? `diff-${direction}` : "" }, [
        el("th", { scope: "row", text: ta.label }),
        el("td", { text: ta.value }),
        el("td", { text: tb.value }),
        el("td", { text: changed ? `${direction === "up" ? "▲ up" : "▼ down"}` : "— unchanged" }),
      ]));
    }
    clear(this.diff).append(
      el("h3", { text: "A → B" }),
      el("table", { class: "diff-table" }, [
        el("thead", {}, [el("tr", {}, [
          el("th", { scope: "col", text: "Metric" }),
          el("th", { scope: "col", text: "A (pinned)" }),
          el("th", { scope: "col", text: "B (current)" }),
          el("th", { scope: "col", text: "Change" }),
        ])]),
        el("tbody", {}, rows),
      ]),
      current.flips
        ? el("p", { class: "muted small", text: `${current.flips.fixed} item(s) fixed, ${current.flips.broke} item(s) broke.` })
        : null,
    );
    this.diff.hidden = false;
    announce(
      `Compared with the pinned run. ${this.summarise(current)} ` +
      (current.flips ? `${current.flips.fixed} fixed, ${current.flips.broke} broke.` : "")
    );
  }

  numeric(v) {
    const m = String(v).match(/-?[\d.]+/);
    return m ? Number(m[0]) : 0;
  }

  summarise(run) {
    return run.tiles.map((t) => `${t.label} ${t.value}`).join(", ") + ".";
  }
}

/* ------------------------------------------------------------------ *
 * Trace viewer
 * ------------------------------------------------------------------ */

/**
 * Render a span tree as nested lists. The tree is readable with a screen
 * reader because it is a list, not a canvas — that is the text alternative
 * the accessibility rules ask for.
 */
export class TraceViewer {
  constructor(root) {
    this.root = root;
    this.root.classList.add("trace-viewer");
  }

  render(spans) {
    const byId = new Map(spans.map((s) => [s.id, { ...s, children: [] }]));
    const roots = [];
    for (const s of byId.values()) {
      if (s.parent && byId.has(s.parent)) byId.get(s.parent).children.push(s);
      else roots.push(s);
    }
    const t0 = Math.min(...spans.map((s) => s.start_ms));
    const span = Math.max(...spans.map((s) => s.duration_ms)) || 1;
    clear(this.root).append(this.node({ id: "trace", name: `trace (${spans.length} spans)`, kind: "trace", start_ms: t0, duration_ms: span, children: roots }, t0, span));
  }

  node(span, t0, total) {
    const bar = el("span", { class: "span-bar" });
    bar.style.width = Math.max(2, (span.duration_ms / total) * 100) + "%";
    bar.style.marginLeft = Math.min(70, ((span.start_ms - t0) / total) * 100) + "%";

    const kids = el("div", { class: "span-children" },
      span.children.map((c) => this.node(c, t0, total)));

    const head = el("button", {
      type: "button",
      class: "span-head",
      "aria-expanded": "true",
      onclick: (e) => {
        const open = kids.style.display !== "none";
        kids.style.display = open ? "none" : "";
        e.currentTarget.setAttribute("aria-expanded", String(!open));
      },
    }, [
      el("span", { class: "span-kind", text: `[${span.kind}]` }),
      el("span", { class: "span-name", text: span.name }),
      el("span", { class: "span-time", text: `${span.duration_ms} ms` }),
    ]);

    return el("div", { class: "span-node" }, [
      el("div", { class: "span-row" }, [head, bar]),
      el("div", { class: "span-detail" }, [
        span.model ? el("span", { class: "chip", text: span.model }) : null,
        span.input_tokens !== undefined ? el("span", { class: "chip", text: `in ${span.input_tokens} tok` }) : null,
        span.output_tokens !== undefined ? el("span", { class: "chip", text: `out ${span.output_tokens} tok` }) : null,
        span.cost_usd !== undefined ? el("span", { class: "chip", text: `$${span.cost_usd.toFixed(4)}` }) : null,
        span.tool ? el("span", { class: "chip", text: `tool ${span.tool}` }) : null,
        span.error ? el("span", { class: "chip bad", text: `error: ${span.error}` }) : null,
      ]),
      kids,
    ]);
  }
}

/* ------------------------------------------------------------------ *
 * Layout shell
 * ------------------------------------------------------------------ */

/**
 * Standard simulation chrome: heading, educational-model banner, two
 * columns (controls left, results right) collapsing to one under 820 px.
 */
export function shell({ title, subtitle, controls, results, footer }) {
  document.body.classList.add("evallab");
  const app = el("div", { class: "app" });
  app.append(
    el("header", { class: "app-head" }, [
      el("h1", { text: title }),
      subtitle ? el("p", { class: "subtitle", text: subtitle }) : null,
      educationalBanner("Eval Lab"),
    ]),
    el("div", { class: "app-body" }, [
      el("section", { class: "col controls", "aria-label": "Experiment controls" }, [controls]),
      el("section", { class: "col results", "aria-label": "Results" }, [results]),
    ]),
    footer ? el("footer", { class: "app-foot" }, [footer]) : null,
  );
  clear(document.body).appendChild(app);
  return app;
}
