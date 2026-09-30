// Eval Lab — the educational judge model.
//
// This is NOT a language model. It is a seeded, parameterised model of how
// LLM judges behave, and it is what produces the "recorded" verdicts the lab
// replays. Every simulation carries a banner saying so.
//
// Why model it rather than record a real model? Because the whole point of
// the course is the *relationship* between knobs and numbers, and that
// relationship is governed by four things:
//
//   1. discriminability  — how well the judge separates good from bad
//   2. leniency         — how readily it says "pass" (the bias that makes
//                         accuracy look great and TNR look terrible)
//   3. verbosity bias   — whether length buys a point
//   4. position bias    — whether it prefers the answer it read first
//
// Setting those four separately is the only way to show a learner that a
// "better" prompt can make accuracy go up while kappa goes down. A recorded
// run hides the mechanism behind a number; this makes the mechanism explicit
// and every number in the lab is still computed for real from the verdicts.
//
// Swapping in real recordings later means replacing the generated verdicts
// in the data files. No simulation code changes, because nothing here is
// imported by the browser.

import { mulberry32, hashSeed } from "../../simulations/common/stats.js";

/* ------------------------------------------------------------------ *
 * Parameters
 * ------------------------------------------------------------------ */

export const MODELS = {
  "qwen3-0.6b":    { label: "Qwen3 0.6B",       d: 0.70, costIn: 0.00002, costOut: 0.00006, inTok: 620, outTok: 34, ms: 210 },
  "qwen3-1.7b":    { label: "Qwen3 1.7B",       d: 1.05, costIn: 0.00003, costOut: 0.00009, inTok: 640, outTok: 36, ms: 380 },
  "llama-3.2-3b":  { label: "Llama 3.2 3B",     d: 1.35, costIn: 0.00005, costOut: 0.00013, inTok: 660, outTok: 38, ms: 540 },
  "flow-judge-3.8b": { label: "Flow-Judge 3.8B", d: 1.60, costIn: 0.00006, costOut: 0.00015, inTok: 680, outTok: 40, ms: 700 },
  "prometheus-7b": { label: "Prometheus 2 7B",  d: 1.85, costIn: 0.00012, costOut: 0.00028, inTok: 720, outTok: 44, ms: 1250 },
};

export const PROMPTS = {
  plain: {
    label: "Plain binary prompt",
    short: "Plain",
    // A vague "is this answer good?" prompt. Generous, because "good" is
    // doing all the work and every borderline answer reads as good.
    // Generosity is the bias that buys a high true-positive rate and
    // destroys the true-negative rate: the judge waves through failures.
    generosity: 1.15,
    dBonus: -0.28,
    text: "You are grading an answer. Is it good? Reply PASS or FAIL.",
  },
  rubric: {
    label: "Binary + explicit rubric",
    short: "Rubric",
    generosity: 0.15,
    dBonus: 0.22,
    text: "Grade the answer against these rules:\n1. It states the handbook fact correctly.\n2. It cites the handbook section.\n3. It adds nothing that is not in the handbook.\nReply PASS only if all three hold, otherwise FAIL.",
  },
  stepwise: {
    label: "Stepwise, one question per rule",
    short: "Stepwise",
    generosity: 0.0,
    dBonus: 0.34,
    text: "Answer each question in turn, then give the verdict.\nQ1: Does the answer state the handbook fact correctly? YES/NO\nQ2: Does it cite the handbook section? YES/NO\nQ3: Does it add anything not in the handbook? YES/NO\nVerdict is PASS only if Q1 and Q2 are YES and Q3 is NO.",
  },
  critique_first: {
    label: "Critique, then verdict",
    short: "Critique-first",
    generosity: -0.12,
    dBonus: 0.18,
    text: "First write one sentence naming the most important thing wrong with the answer, if anything. Then, on a new line, write VERDICT: PASS or VERDICT: FAIL.",
  },
};

export const FEWSHOT = { 0: 0, 1: 0.14, 2: 0.24, 3: 0.28 };

/** The family a model belongs to, used for the self-preference probe. */
export const FAMILY = {
  "qwen3-0.6b": "qwen", "qwen3-1.7b": "qwen", "llama-3.2-3b": "llama",
  "flow-judge-3.8b": "flow", "prometheus-7b": "qwen",
};

/** Which model family produced each system variant (for the self-preference probe). */
export const SYSTEM_FAMILY = { v1: "gpt", v2: "gpt", v3: "qwen" };

/* ------------------------------------------------------------------ *
 * The verdict sampler
 * ------------------------------------------------------------------ */

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

/**
 * Produce one verdict.
 *
 * `truth`  — the human label (1 pass, 0 fail)
 * `opts`   — judge config plus the item context
 * `rng`    — seeded generator, so a given (config, item) is always the same
 */
export function verdictFor(truth, opts, rng) {
  const model = MODELS[opts.model];
  const prompt = PROMPTS[opts.prompt_variant];
  const few = FEWSHOT[opts.fewshot] ?? 0;

  // 1. Signal: how sharply this judge separates passes from failures.
  const d = model.d + prompt.dBonus + few;

  // 2. Generosity: positive means the judge says "pass" too readily. Few-shot
  //    examples show the standard, so they pull generosity back a little, but
  //    most of their value is that they sharpen the separation itself.
  const generosity = prompt.generosity - few * 0.05;

  let latent = d * (truth === 1 ? 1 : -1) + generosity;

  // 3. Verbosity bias: the judge rewards length. Measured as how far the
  //    answer sits above the mean answer length of the whole corpus.
  if (opts.verbosity_bias) {
    latent += opts.lengthZ * 0.45;
  }

  // 4. Self-preference: a judge from the same family as the system that
  //    produced the answer is measurably more generous to it.
  if (opts.self_preference && FAMILY[opts.model] === SYSTEM_FAMILY[opts.variant]) {
    latent += 0.22;
  }

  // 5. Run-to-run noise. Sample 0 is greedy (temperature 0); the rest are
  //    sampled, which is why the repeats knob has anything to average over.
  const noise = gauss(rng) * (opts.sampleIndex === 0 ? 0.40 : 0.80);

  const p = sigmoid(1.35 * latent + noise);
  return rng() < p ? 1 : 0;
}

function gauss(rng) {
  // Box–Muller, one draw.
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ------------------------------------------------------------------ *
 * Critique text
 * ------------------------------------------------------------------ */

const PASS_REASONS = [
  "States the handbook fact correctly and cites the section.",
  "Correct, grounded and cited.",
  "Matches the handbook rule exactly.",
  "No unsupported additions; the citation is present.",
];
const FAIL_REASONS = {
  wrong_fact: "The stated rule contradicts the handbook section.",
  no_citation: "The fact is right but no handbook section is cited, so it is not verifiable.",
  over_refusal: "Refuses a question the handbook answers directly.",
  out_of_scope: "The handbook does not cover this, yet the answer states a rule as fact.",
  extra: "Adds a detail the handbook does not contain.",
  format: "Output is not in the required shape, so it cannot be checked.",
};

export function critiqueFor(category, verdict, rng) {
  if (verdict === 1) return PASS_REASONS[(rng() * PASS_REASONS.length) | 0];
  const key = category || "wrong_fact";
  return FAIL_REASONS[key] || FAIL_REASONS.wrong_fact;
}

/* ------------------------------------------------------------------ *
 * A recorded run
 * ------------------------------------------------------------------ */

/**
 * Build the recorded verdicts for one (judge config, item, variant).
 * Every run stores its own repeat samples, so repeats, majority voting and
 * a probability-weighted threshold all work without re-running anything.
 */
export function buildRun({ itemId, variant, truth, config, repeats = 5, lengthZ = 0, rng }) {
  const model = MODELS[config.model];
  const prompt = PROMPTS[config.prompt_variant];
  const samples = [];
  for (let s = 0; s < repeats; s++) {
    samples.push(verdictFor(truth, {
      model: config.model,
      prompt_variant: config.prompt_variant,
      fewshot: config.fewshot,
      verbosity_bias: config.verbosity_bias,
      self_preference: config.self_preference,
      variant,
      lengthZ,
      sampleIndex: s,
    }, rng));
  }
  const p = samples.reduce((a, b) => a + b, 0) / samples.length;
  // Sample 0 is the greedy call, so it is the one whose critique we keep.
  const critique = prompt.id === "critique_first" || config.with_critique
    ? critiqueFor(itemId, samples[0], rng)
    : null;

  const outTokens = config.with_critique ? model.outTok + 40 : model.outTok;
  return {
    samples,
    p: Math.round(p * 1000) / 1000,
    verdict: samples[0],
    critique,
    input_tokens: model.inTok,
    output_tokens: outTokens,
    latency_ms: Math.round(model.ms * (0.8 + rng() * 0.5)),
    cost_usd: Math.round((model.inTok * model.costIn + outTokens * model.costOut) * 1e6) / 1e6,
  };
}

export { sigmoid, hashSeed, mulberry32 };
