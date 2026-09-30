// Eval Lab — dataset and recorded-run generator.
//
// Run:  node build/generate.mjs
//
// Reads the authored corpus in build/lib/corpus.mjs, injects controlled
// failures into system outputs, labels them from the injection (so the human
// label is correct by construction), then runs every judge configuration
// from build/lib/judge.mjs over every item and writes the result as a plain
// script file into each simulation's folder.
//
// The browser never loads this file and never runs a model. Everything it
// needs is already in the emitted data.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { mulberry32, hashSeed } from "../simulations/common/stats.js";
import { HANDBOOK, OUT_OF_SCOPE, RECIPES, AGENT_RUNS, PAIRWISE, RAG } from "./lib/corpus.mjs";
import { MODELS, PROMPTS, FEWSHOT, buildRun, FAMILY, SYSTEM_FAMILY } from "./lib/judge.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEED = 20260930;

/* ================================================================== *
 * 1. Support bot items
 *
 * Three system variants over the same handbook. The differences are the
 * ones the course is about: a tuned prompt that cites its source, a generic
 * prompt that answers from memory, and a small model with no retrieval.
 * ================================================================== */

const CITED = (fact, text) => `${text} (Handbook — ${fact.section})`;

function buildSupportItems() {
  const sources = [
    ...HANDBOOK.map((f) => ({ ...f, out_of_scope: false })),
    ...OUT_OF_SCOPE.map((f) => ({ ...f, out_of_scope: true })),
  ];

  return sources.map((f, i) => {
    const rng = mulberry32(hashSeed(f.id) ^ SEED);
    const id = `s${String(i + 1).padStart(2, "0")}`;

    // What a correct answer looks like, whether or not the handbook covers it.
    const correct = f.out_of_scope ? f.good : CITED(f, f.good);
    const wrong = f.bad[(rng() * f.bad.length) | 0];
    const extra = `${correct} In practice many teams round this to a whole month and review it each quarter.`;

    // Failure mixture per variant. v1 is the tuned system, v3 the weak one.
    // The tuned system still fails about half the time, which is what gives
    // the true-negative rate a denominator worth reading: kappa estimated on
    // 45 failures is a measurement, kappa estimated on 12 is a rumour.
    const mixture = f.out_of_scope
      ? {
          v1: [["ok", 0.55], ["abstain_ok", 0.20], ["confabulate", 0.25]],
          v2: [["ok", 0.14], ["confabulate", 0.72], ["refuse", 0.14]],
          v3: [["ok", 0.05], ["confabulate", 0.82], ["refuse", 0.13]],
        }
      : {
          v1: [["ok", 0.48], ["uncited", 0.26], ["wrong_fact", 0.15], ["refuse", 0.11]],
          v2: [["ok", 0.26], ["uncited", 0.32], ["wrong_fact", 0.18], ["refuse", 0.13], ["extra", 0.11]],
          v3: [["ok", 0.07], ["uncited", 0.22], ["wrong_fact", 0.34], ["refuse", 0.25], ["extra", 0.12]],
        };

    const outputs = {};
    const human = {};

    for (const variant of ["v1", "v2", "v3"]) {
      const roll = rng();
      let acc = 0, mode = "ok";
      for (const [m, p] of mixture[variant]) {
        acc += p;
        if (roll < acc) { mode = m; break; }
      }

      if (mode === "ok") {
        outputs[variant] = correct;
        human[variant] = { label: 1, category: "correct", critique: "Correct and cited." };
      } else if (mode === "abstain_ok") {
        outputs[variant] = `${f.good} The handbook does not cover this, so ask the People team.`;
        human[variant] = { label: 1, category: "correct", critique: "Correctly declines to invent a policy." };
      } else if (mode === "uncited") {
        outputs[variant] = f.good;
        human[variant] = { label: 0, category: "no_citation", critique: "Right answer, but nothing ties it to the handbook, so it is not verifiable." };
      } else if (mode === "refuse") {
        outputs[variant] = f.refuse;
        human[variant] = { label: 0, category: "over_refusal", critique: "The handbook answers this directly, so refusing loses a point the user wanted." };
      } else if (mode === "extra") {
        outputs[variant] = extra;
        human[variant] = { label: 0, category: "extra", critique: "Adds a practice the handbook does not state." };
      } else {
        outputs[variant] = wrong;
        human[variant] = {
          label: 0,
          category: f.out_of_scope ? "out_of_scope" : "wrong_fact",
          critique: f.out_of_scope
            ? "States a policy as fact when the handbook is silent."
            : "Contradicts the handbook section it is answering from.",
        };
      }
    }

    // A padded copy of the tuned answer. The verbosity probe in module 7
    // needs two texts that differ only in length.
    outputs.v1padded = `${outputs.v1} It is worth noting that this policy was clarified in the 2024 handbook refresh, and that the People team publishes a summary each quarter alongside the full document. In addition, teams sometimes localise the rule for their own country, and your local lead can confirm whether that applies to you.`;

    return {
      id,
      question: f.q,
      section: f.section,
      out_of_scope: f.out_of_scope,
      slice: { intent: f.intent, difficulty: f.difficulty, section: f.section, out_of_scope: f.out_of_scope },
      outputs,
      human,
    };
  });
}

/** Split into dev and test, balanced by difficulty, with a fixed seed. */
export function splitDevTest(items, seed = SEED) {
  const rng = mulberry32(seed);
  const byDifficulty = new Map();
  for (const it of items) {
    const k = it.slice.difficulty;
    if (!byDifficulty.has(k)) byDifficulty.set(k, []);
    byDifficulty.get(k).push(it);
  }
  const dev = [], test = [];
  for (const list of byDifficulty.values()) {
    const shuffled = list.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const cut = Math.round(shuffled.length * 0.6);
    dev.push(...shuffled.slice(0, cut));
    test.push(...shuffled.slice(cut));
  }
  return { dev, test };
}

/* ================================================================== *
 * 2. Judge configurations — the recorded menu
 * ================================================================== */

const CONFIGS = [
  { id: "c-plain-1.7b",  model: "qwen3-1.7b",     prompt_variant: "plain",          fewshot: 0 },
  { id: "c-plain-3b",    model: "llama-3.2-3b",   prompt_variant: "plain",          fewshot: 0 },
  { id: "c-plain-0.6b",  model: "qwen3-0.6b",     prompt_variant: "plain",          fewshot: 0, with_critique: true },
  { id: "c-plain-7b",    model: "prometheus-7b",  prompt_variant: "plain",          fewshot: 0 },
  { id: "c-rubric-0.6b", model: "qwen3-0.6b",     prompt_variant: "rubric",         fewshot: 0 },
  { id: "c-rubric-1.7b", model: "qwen3-1.7b",     prompt_variant: "rubric",         fewshot: 0 },
  { id: "c-rubric-3b",   model: "llama-3.2-3b",   prompt_variant: "rubric",         fewshot: 0 },
  { id: "c-rubric-3.8b", model: "flow-judge-3.8b", prompt_variant: "rubric",        fewshot: 0 },
  { id: "c-rubric-7b",   model: "prometheus-7b",  prompt_variant: "rubric",         fewshot: 0 },
  { id: "c-step-3b",     model: "llama-3.2-3b",   prompt_variant: "stepwise",       fewshot: 2 },
  { id: "c-step-7b",     model: "prometheus-7b",  prompt_variant: "stepwise",       fewshot: 0 },
  { id: "c-crit-3.8b",   model: "flow-judge-3.8b", prompt_variant: "critique_first", fewshot: 3, with_critique: true },
  { id: "c-crit-3b",     model: "llama-3.2-3b",   prompt_variant: "critique_first", fewshot: 2 },
  { id: "c-rubric-3b-fs3", model: "llama-3.2-3b", prompt_variant: "rubric",         fewshot: 3 },
  { id: "c-rubric-3b-verb", model: "llama-3.2-3b", prompt_variant: "rubric",       fewshot: 0, verbosity_bias: true },
  { id: "c-rubric-3b-self", model: "llama-3.2-3b", prompt_variant: "rubric",       fewshot: 0, self_preference: true },
];

/* ================================================================== *
 * 3. Recorded runs
 * ================================================================== */

function buildRuns(items, configs) {
  const runs = {};      // configId -> "itemId|variant" -> [samples]
  const critiques = {}; // configId -> "itemId|variant" -> text
  const cost = {};      // configId -> per-call cost / latency / tokens

  // Length z-score, measured on the POOLED distribution of every answer in
  // every variant. This matters: the padded copy in the verbosity probe must
  // be scored against the same yardstick as the answer it padded, otherwise
  // normalising within v1padded puts it back at the mean and the bias the
  // probe is meant to expose cancels out.
  const allLens = [];
  for (const it of items) for (const v of ["v1", "v2", "v3", "v1padded"]) allLens.push(it.outputs[v].length);
  const meanLen = allLens.reduce((a, b) => a + b, 0) / allLens.length;
  const sdLen = Math.sqrt(allLens.reduce((a, b) => a + (b - meanLen) ** 2, 0) / allLens.length) || 1;

  for (const cfg of configs) {
    runs[cfg.id] = {};
    const m = MODELS[cfg.model];
    cost[cfg.id] = {
      input_tokens: m.inTok,
      output_tokens: cfg.with_critique ? m.outTok + 40 : m.outTok,
      latency_ms: m.ms,
      cost_usd: Math.round((m.inTok * m.costIn + (cfg.with_critique ? m.outTok + 40 : m.outTok) * m.costOut) * 1e6) / 1e6,
      model: m.label,
    };

    for (const it of items) {
      for (const variant of ["v1", "v2", "v3", "v1padded"]) {
        const truth = it.human[variant]?.label ?? 0;
        const category = it.human[variant]?.category ?? "wrong_fact";
        const z = (it.outputs[variant].length - meanLen) / sdLen;
        // The padded copy keeps the tuned answer's content, so its label is
        // the tuned answer's label — only its length changed.
        const paddedTruth = variant === "v1padded" ? it.human.v1.label : truth;
        const paddedCat = variant === "v1padded" ? it.human.v1.category : category;

        const rng = mulberry32(hashSeed(`${cfg.id}|${it.id}|${variant}`));
        const run = buildRun({
          itemId: paddedCat,
          variant,
          truth: paddedTruth,
          config: cfg,
          repeats: 5,
          lengthZ: z,
          rng,
        });
        runs[cfg.id][`${it.id}|${variant}`] = run.samples;
        if (run.critique) {
          critiques[cfg.id] = critiques[cfg.id] || {};
          critiques[cfg.id][`${it.id}|${variant}`] = run.critique;
        }
      }
    }
  }
  return { runs, critiques, cost };
}

/* ================================================================== *
 * 4. Pairwise runs, both orders
 * ================================================================== */

const PAIR_MODELS = ["qwen3-1.7b", "llama-3.2-3b", "flow-judge-3.8b", "prometheus-7b"];

function buildPairwise() {
  const runs = {}; // model -> pairId -> { AB: [..4], BA: [..4] }
  for (const model of PAIR_MODELS) {
    runs[model] = {};
    for (const p of PAIRWISE) {
      const entry = {};
      for (const order of ["AB", "BA"]) {
        const rng = mulberry32(hashSeed(`${model}|${p.id}|${order}`));
        const samples = [];
        for (let s = 0; s < 4; s++) {
          // Score each answer: quality (A is the better one in this corpus),
          // a length bonus, and a bonus for being read first.
          const lenBonus = (txt) => (txt.length - 220) / 700;
          const posBonus = 0.55;
          const scoreA = 1.1 + lenBonus(p.a) + (order === "AB" ? posBonus : -posBonus) + gaussish(rng) * 0.7;
          const scoreB = 0.0 + lenBonus(p.b) + (order === "BA" ? posBonus : -posBonus) + gaussish(rng) * 0.7;
          samples.push(scoreA > scoreB ? "A" : "B");
        }
        entry[order] = samples;
      }
      runs[model][p.id] = entry;
    }
  }
  return runs;
}

function gaussish(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ================================================================== *
 * 5. Recipe extraction items
 * ================================================================== */

function buildRecipes() {
  return RECIPES.map((r) => {
    const rng = mulberry32(hashSeed(r.id) ^ SEED);
    const target = {
      name: r.name,
      yields: r.yields,
      prep_minutes: r.prep,
      cook_minutes: r.bake,
      oven_celsius: r.temp_c || null,
      tags: r.tags,
      ingredients: r.ingredients.map(([name, qty, unit]) => ({ name, qty, unit })),
      steps: r.steps,
    };
    const clean = JSON.stringify(target);
    const fenced = "```json\n" + clean + "\n```";
    const prose = `Sure! Here is the recipe in JSON form:\n${clean}\nLet me know if you need anything else.`;

    const mutations = [];
    // A number mutation: wrong quantity, a plausible wrong unit conversion,
    // a missing field, a renamed field, trailing prose inside the JSON.
    mutations.push(JSON.stringify({ ...target, prep_minutes: r.prep + 5 }));
    mutations.push(JSON.stringify({ ...target, oven_celsius: r.temp_c ? Math.round((r.temp_c - 180) * 9 / 5 + 32) : null }));
    mutations.push(JSON.stringify({ ...target, ingredients: target.ingredients.slice(0, -1) }));
    mutations.push(JSON.stringify({ ...target, yields: "1 serving" }));
    const renamed = JSON.parse(clean);
    delete renamed.ingredients;
    renamed.ingredient_list = renamed.ingredients;
    mutations.push(JSON.stringify(renamed));
    mutations.push(clean.slice(0, -2) + ',\n  "notes": "Ask your mum" }');
    // Verbose but correct-ish: correct JSON padded with a prose preamble.
    mutations.push(prose);
    mutations.push(fenced);
    // ROUGE trap: right tokens, wrong number.
    const padded = JSON.parse(clean);
    padded.ingredients = padded.ingredients.map((ing, i) =>
      i === 0 ? { ...ing, qty: Math.round(ing.qty * 2) } : ing);
    mutations.push(`${prose}\nActually, double the flour. It makes a better crumb and the dough will rise more evenly in the tin. I have found this works reliably even at altitude.`);

    const variantOf = (i) => {
      const r2 = mulberry32(hashSeed(r.id + i));
      const pick = (arr) => arr[(r2() * arr.length) | 0];
      if (i === 0) return clean;                                    // tuned prompt
      if (i === 1) return pick([fenced, prose, clean, mutations[0]]); // generic
      return pick([mutations[0], mutations[1], mutations[2], mutations[3], mutations[5], mutations[6], mutations[8], prose]);
    };

    return {
      id: r.id,
      name: r.name,
      reference: clean,
      mustContain: r.name.toLowerCase(),
      regex: "^[\\s]*[\\{\\[]",
      outputs: { v1: variantOf(0), v2: variantOf(1), v3: variantOf(2) },
    };
  });
}

/* ================================================================== *
 * 6. Agent runs, as traces
 * ================================================================== */

function buildAgentRuns() {
  return AGENT_RUNS.map((run) => {
    const rng = mulberry32(hashSeed(run.id) ^ SEED);
    const spans = [];
    let clock = 40 + Math.round(rng() * 300);
    const traceId = `tr_${run.id}`;

    spans.push({ id: `${run.id}-0`, parent: null, kind: "agent", name: `run: ${run.task.slice(0, 44)}`, start_ms: clock, duration_ms: 0, model: undefined });
    let parent = `${run.id}-0`;

    run.steps.forEach((step, i) => {
      const id = `${run.id}-${i + 1}`;
      const dur = 120 + Math.round(rng() * 900);
      const start = clock;
      clock += dur + 15 + Math.round(rng() * 40);
      const isTool = step.includes("(");
      const tool = isTool ? step.slice(0, step.indexOf("(")) : null;

      if (isTool) {
        spans.push({
          id, parent, kind: "execute_tool", name: step, tool, start_ms: start, duration_ms: dur,
          output_tokens: undefined,
        });
      } else {
        const inTok = 300 + Math.round(rng() * 700);
        const outTok = 60 + Math.round(rng() * 500);
        spans.push({
          id, parent, kind: "chat", name: "plan next step", model: run.end_state === "wrong" ? "qwen3-0.6b" : "qwen3-1.7b",
          start_ms: start, duration_ms: dur, input_tokens: inTok, output_tokens: outTok,
          cost_usd: Math.round(inTok * 0.00003 + outTok * 0.00009 * 1e6) / 1e6,
        });
      }
      parent = id;
    });

    const isBad = run.end_state !== "ok";
    spans.push({
      id: `${run.id}-final`, parent, kind: "chat", name: "final answer", model: "qwen3-1.7b",
      start_ms: clock, duration_ms: 200 + Math.round(rng() * 400),
      input_tokens: 500, output_tokens: 120, cost_usd: 0.00003,
      error: isBad && run.end_state === "wrong" ? "final answer contradicted the requested conversion" : undefined,
    });
    const root = spans[0];
    root.duration_ms = clock + 400 - root.start_ms;

    return {
      id: run.id,
      task: run.task,
      trace_id: traceId,
      end_state: run.end_state,
      first_bad_step: run.first_bad_step,
      tools_expected: run.tools,
      steps: run.steps,
      spans,
    };
  });
}

/* ================================================================== *
 * 7. Emit
 * ================================================================== */

function emit(path, name, payload, headerNote) {
  mkdirSync(dirname(join(ROOT, path)), { recursive: true });
  const body = `// Generated by build/generate.mjs — do not edit by hand.
// ${headerNote}
window.EvalLabData = window.EvalLabData || {};
window.EvalLabData[${JSON.stringify(name)}] = ${JSON.stringify(payload)};
`;
  writeFileSync(join(ROOT, path), body);
  const kb = Math.round(body.length / 1024);
  console.log(`  ${path.padEnd(42)} ${String(kb).padStart(5)} KB`);
}

function main() {
  console.log("Generating Eval Lab datasets\n");

  const support = buildSupportItems();
  const { dev, test } = splitDevTest(support);
  const { runs, critiques, cost } = buildRuns(support, CONFIGS);

  const judgeMenu = CONFIGS.map((c) => ({
    id: c.id,
    label: `${MODELS[c.model].label} · ${PROMPTS[c.prompt_variant].short} · ${c.fewshot} shot${c.fewshot === 1 ? "" : "s"}${c.verbosity_bias ? " · verbosity-biased" : ""}${c.self_preference ? " · self-preference" : ""}`,
    model: c.model,
    model_label: MODELS[c.model].label,
    prompt_variant: c.prompt_variant,
    prompt_label: PROMPTS[c.prompt_variant].label,
    fewshot: c.fewshot,
    verbosity_bias: !!c.verbosity_bias,
    self_preference: !!c.self_preference,
    with_critique: !!c.with_critique,
  }));

  emit("simulations/judge-lab/data.js", "support", {
    dataset: "support",
    title: "Support bot over the company handbook",
    items: support,
    dev_ids: dev.map((i) => i.id),
    test_ids: test.map((i) => i.id),
    variants: [
      { id: "v1", label: "A — handbook-tuned prompt", note: "Retrieves the section and is told to cite it." },
      { id: "v2", label: "B — generic prompt", note: "Same model, no retrieval, no citation instruction." },
      { id: "v3", label: "C — small model, no retrieval", note: "0.6B, no retrieval." },
      { id: "v1padded", label: "D — A, padded", note: "Identical content to A with 2 extra sentences. Used by the verbosity probe." },
    ],
    judge_menu: judgeMenu,
    runs,
    critiques,
    cost,
    repeats: 5,
  }, "Support-bot items with human labels, and the recorded judge runs.");

  emit("simulations/judge-lab/data-pairwise.js", "pairwise", {
    dataset: "pairwise",
    title: "Pairwise preference pairs",
    items: PAIRWISE,
    models: PAIR_MODELS.map((m) => ({ id: m, label: MODELS[m].label })),
    runs: buildPairwise(),
  }, "Pairwise pairs with both answer orders recorded, for the position-bias probe.");

  emit("simulations/code-checks/data.js", "recipe", {
    dataset: "recipe",
    title: "Recipe to JSON extraction",
    items: buildRecipes(),
    variants: [
      { id: "v1", label: "A — schema in the prompt" },
      { id: "v2", label: "B — 'output JSON'" },
      { id: "v3", label: "C — no format instruction" },
    ],
    schema: {
      type: "object",
      required: ["name", "yields", "prep_minutes", "cook_minutes", "tags", "ingredients", "steps"],
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        yields: { type: "string" },
        prep_minutes: { type: "number", minimum: 0, maximum: 600 },
        cook_minutes: { type: "number", minimum: 0, maximum: 600 },
        oven_celsius: { type: ["number", "null"] },
        tags: { type: "array", minItems: 1, items: { type: "string" } },
        ingredients: {
          type: "array", minItems: 1,
          items: {
            type: "object", required: ["name", "qty", "unit"], additionalProperties: false,
            properties: { name: { type: "string" }, qty: { type: "number" }, unit: { type: "string" } },
          },
        },
        steps: { type: "array", minItems: 1, items: { type: "string" } },
      },
    },
  }, "Recipe extraction items with three system variants and a reference JSON object.");

  emit("simulations/agent-evals/data.js", "agent", {
    dataset: "agent",
    title: "Kitchen assistant agent runs",
    runs: buildAgentRuns(),
  }, "Multi-step agent runs with OpenTelemetry-style spans and known end states.");

  emit("simulations/rag-evals/data.js", "rag", {
    dataset: "rag",
    title: "RAG answers over the handbook",
    items: RAG,
    variants: [
      { id: "v1", label: "A — grounded, abstains" },
      { id: "v2", label: "B — no abstention instruction" },
      { id: "v3", label: "C — small model" },
    ],
  }, "RAG items with the retrieved passages, so grounding is decidable.");

  const devN = dev.length;
  console.log(`\n  support items: ${support.length} (dev ${devN} / test ${support.length - devN})`);
  console.log(`  judge configs: ${CONFIGS.length}, runs: ${CONFIGS.length * support.length * 4}`);
  console.log("\nDone.");
}

main();
