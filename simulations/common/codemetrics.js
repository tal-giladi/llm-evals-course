// Eval Lab — code-based evaluators.
//
// These run live in the learner's browser, against the recipe-extraction
// dataset. Unlike a judge there is no model call: the learner can read the
// whole evaluator and know exactly why an item passed or failed. That is
// the point of module 3 — reach for code first whenever code can tell.
//
// Plain ES module. No dependencies.

/* ------------------------------------------------------------------ *
 * Text basics
 * ------------------------------------------------------------------ */

export function normalise(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function exactMatch(pred, ref) {
  return normalise(pred) === normalise(ref) ? 1 : 0;
}

export function contains(pred, needle, opts = {}) {
  const hay = normalise(pred);
  const nd = normalise(needle);
  const hit = opts.caseSensitive ? String(pred).includes(needle) : hay.includes(nd);
  return hit ? 1 : 0;
}

export function regexMatch(pred, pattern, flags = "") {
  try {
    return new RegExp(pattern, flags).test(String(pred)) ? 1 : 0;
  } catch {
    return 0; // An invalid regex scores 0 rather than throwing into the UI.
  }
}

export function isValidRegex(pattern, flags = "") {
  try {
    new RegExp(pattern, flags);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Numbers
 * ------------------------------------------------------------------ */

/**
 * Numeric check with a relative-or-absolute tolerance.
 *
 * `tol` is absolute unless `relative` is set, in which case it is a
 * fraction of the reference. Converting 180 °F to 350 K is a huge absolute
 * error and a 1% relative one — which is the kind of thing lesson 03.3
 * makes concrete.
 */
export function numericMatch(pred, ref, tol = 0.01, relative = true) {
  const p = Number(pred);
  const r = Number(ref);
  if (!Number.isFinite(p) || !Number.isFinite(r)) return 0;
  const allowed = relative ? Math.abs(r) * tol : tol;
  return Math.abs(p - r) <= allowed ? 1 : 0;
}

/* ------------------------------------------------------------------ *
 * Token overlap metrics
 * ------------------------------------------------------------------ */

export function tokenize(s) {
  return normalise(s)
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Token-level F1 — the standard SQuAD-style overlap score.
 * Precision and recall are both reported because a judge that reads as
 * "high F1" is often just verbose.
 */
export function tokenF1(pred, ref) {
  const p = tokenize(pred);
  const r = tokenize(ref);
  if (p.length === 0 || r.length === 0) return { f1: 0, precision: 0, recall: 0 };
  const counts = new Map();
  for (const t of r) counts.set(t, (counts.get(t) || 0) + 1);
  let overlap = 0;
  for (const t of p) {
    const c = counts.get(t) || 0;
    if (c > 0) {
      overlap++;
      counts.set(t, c - 1);
    }
  }
  const precision = overlap / p.length;
  const recall = overlap / r.length;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { f1, precision, recall, overlap };
}

/** Longest common subsequence length. */
function lcsLength(a, b) {
  const prev = new Array(b.length + 1).fill(0);
  const cur = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

/**
 * ROUGE-L F-measure.
 *
 * Lesson 03.3 shows the trap: a longer candidate inflates the recall half
 * of this score, so a padded wrong answer can out-score a correct short one.
 * The lab shows precision and recall separately so the trap is visible.
 */
export function rougeL(pred, ref) {
  const p = tokenize(pred);
  const r = tokenize(ref);
  if (p.length === 0 || r.length === 0) return { f: 0, lcs: 0, precision: 0, recall: 0 };
  const lcs = lcsLength(p, r);
  const precision = lcs / p.length;
  const recall = lcs / r.length;
  const f = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { f, lcs, precision, recall };
}

/** Cosine similarity between two equal-length vectors. */
export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/* ------------------------------------------------------------------ *
 * JSON parsing and schema checking
 * ------------------------------------------------------------------ */

/**
 * Parse model output that is supposed to be JSON.
 *
 * Extraction prompts very often wrap the JSON in a code fence or add a
 * sentence of prose. This unwraps those cases and reports *how* it recovered,
 * so the lesson can show that a lenient parser hides a real formatting bug.
 */
export function parseJsonLoose(text) {
  const raw = String(text ?? "").trim();
  const attempts = [
    { kind: "exact", value: tryParse(raw) },
    { kind: "fenced", value: tryParse(stripFence(raw)) },
    { kind: "first-object", value: tryParse(firstBrace(raw)) },
  ];
  for (const a of attempts) {
    if (a.value.ok) return { ok: true, data: a.value.data, recovered: a.kind };
  }
  return { ok: false, data: null, recovered: null, raw };
}

function tryParse(s) {
  if (!s) return { ok: false };
  try {
    return { ok: true, data: JSON.parse(s) };
  } catch {
    return { ok: false };
  }
}

function stripFence(s) {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return m ? m[1].trim() : s;
}

function firstBrace(s) {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  return start >= 0 && end > start ? s.slice(start, end + 1) : s;
}

/**
 * A small JSON Schema subset — deliberately not the full spec.
 *
 * Supported: type, required, properties, additionalProperties, items,
 * enum, minimum, maximum, minItems, pattern. Unsupported keywords are
 * ignored, and the error list says which rule each failure came from, so
 * the learner can see *which* line of the schema did the work.
 */
export function validateSchema(data, schema, path = "$") {
  const errors = [];
  if (!schema || typeof schema !== "object") return errors;

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(data, t))) {
      errors.push({ path, rule: "type", message: `expected ${types.join(" or ")}` });
      return errors; // Further rules would only produce noise.
    }
  }

  if (schema.enum && !schema.enum.includes(data)) {
    errors.push({ path, rule: "enum", message: `must be one of ${schema.enum.join(", ")}` });
  }

  if (typeof data === "number") {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push({ path, rule: "minimum", message: `must be ≥ ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push({ path, rule: "maximum", message: `must be ≤ ${schema.maximum}` });
    }
  }

  if (typeof data === "string" && schema.pattern) {
    try {
      if (!new RegExp(schema.pattern).test(data)) {
        errors.push({ path, rule: "pattern", message: `must match /${schema.pattern}/` });
      }
    } catch {
      errors.push({ path, rule: "pattern", message: "pattern is not a valid regex" });
    }
  }

  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push({ path, rule: "minItems", message: `needs ≥ ${schema.minItems} items` });
    }
    if (schema.items) {
      data.forEach((v, i) => errors.push(...validateSchema(v, schema.items, `${path}[${i}]`)));
    }
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const key of schema.required || []) {
      if (!(key in data)) {
        errors.push({ path, rule: "required", message: `missing "${key}"` });
      }
    }
    const props = schema.properties || {};
    for (const [key, sub] of Object.entries(props)) {
      if (key in data) errors.push(...validateSchema(data[key], sub, `${path}.${key}`));
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(data)) {
        if (!(key in props)) {
          errors.push({ path, rule: "additionalProperties", message: `unexpected "${key}"` });
        }
      }
    }
  }

  return errors;
}

function typeMatches(v, t) {
  switch (t) {
    case "string": return typeof v === "string";
    case "number": return typeof v === "number" && !Number.isNaN(v);
    case "integer": return Number.isInteger(v);
    case "boolean": return typeof v === "boolean";
    case "array": return Array.isArray(v);
    case "object": return v !== null && typeof v === "object" && !Array.isArray(v);
    case "null": return v === null;
    default: return true;
  }
}

/* ------------------------------------------------------------------ *
 * Running a suite of code evaluators
 * ------------------------------------------------------------------ */

/**
 * Apply a named metric across a dataset and return per-item scores plus
 * the aggregate. `metric` is one of the names in METRICS below, so the
 * lesson can drive it from a <select> without touching this file.
 */
export const METRICS = {
  exact_match: {
    label: "Exact match",
    unit: "binary",
    run: (item, output) => exactMatch(output, item.reference),
  },
  contains: {
    label: "Contains substring",
    unit: "binary",
    run: (item, output) => contains(output, item.mustContain || item.reference),
  },
  regex: {
    label: "Regex",
    unit: "binary",
    run: (item, output) => regexMatch(output, item.regex || ""),
  },
  json_parse: {
    label: "JSON parses",
    unit: "binary",
    run: (item, output) => (parseJsonLoose(output).ok ? 1 : 0),
  },
  json_schema: {
    label: "JSON schema",
    unit: "binary",
    run: (item, output, ctx) => {
      const parsed = parseJsonLoose(output);
      if (!parsed.ok) return 0;
      return validateSchema(parsed.data, ctx.schema).length === 0 ? 1 : 0;
    },
  },
  numeric: {
    label: "Numeric tolerance",
    unit: "binary",
    run: (item, output, ctx) => numericMatch(output, item.reference, ctx.tolerance ?? 0.01, ctx.relative !== false),
  },
  token_f1: {
    label: "Token F1",
    unit: "score",
    run: (item, output) => tokenF1(output, item.reference).f1,
  },
  rouge_l: {
    label: "ROUGE-L",
    unit: "score",
    run: (item, output) => rougeL(output, item.reference).f,
  },
};

/** Run one metric over items and return both per-item detail and the mean. */
export function runCodeMetric(metricName, items, ctx = {}) {
  const metric = METRICS[metricName];
  if (!metric) return { rows: [], mean: 0 };
  const rows = items.map((item, i) => {
    const output = item.outputs[ctx.variant] ?? "";
    let score = 0;
    let error = null;
    try {
      score = metric.run(item, output, ctx) ?? 0;
    } catch (e) {
      error = String(e && e.message ? e.message : e);
    }
    return {
      index: i,
      id: item.id,
      score,
      error,
      output,
      reference: item.reference,
    };
  });
  const mean = rows.length ? rows.reduce((a, r) => a + r.score, 0) / rows.length : 0;
  return { rows, mean, metric };
}
