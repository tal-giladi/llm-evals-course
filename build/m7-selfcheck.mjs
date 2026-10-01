// THROWAWAY — verify what c-rubric-3b-self actually is. Deleted before reporting.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mulberry32, hashSeed } from "../simulations/common/stats.js";
import { MODELS, PROMPTS, FEWSHOT, FAMILY, SYSTEM_FAMILY } from "./lib/judge.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
new Function("window", readFileSync(join(ROOT, "simulations/judge-lab/data.js"), "utf8"))(win);
const D = win.EvalLabData.support;

console.log("FAMILY:", JSON.stringify(FAMILY));
console.log("SYSTEM_FAMILY:", JSON.stringify(SYSTEM_FAMILY));
const judgeModel = "llama-3.2-3b";
for (const v of ["v1", "v2", "v3", "v1padded"]) {
  console.log("  variant", v, "system family =", SYSTEM_FAMILY[v] ?? "(inherits v1)", "| judge family =", FAMILY[judgeModel],
    "| match:", (SYSTEM_FAMILY[v] ?? SYSTEM_FAMILY.v1) === FAMILY[judgeModel]);
}

// Regenerate c-rubric-3b-self exactly and compare to shipped.
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function latentFor(truth, cfg, lengthZ, variant) {
  const model = MODELS[cfg.model];
  const prompt = PROMPTS[cfg.prompt_variant];
  const few = FEWSHOT[cfg.fewshot] ?? 0;
  const d = model.d + prompt.dBonus + few;
  const generosity = prompt.generosity - few * 0.05;
  let latent = d * (truth === 1 ? 1 : -1) + generosity;
  if (cfg.verbosity_bias) latent += lengthZ * 0.45;
  if (cfg.self_preference && FAMILY[cfg.model] === SYSTEM_FAMILY[variant]) latent += 0.22;
  return latent;
}

const allLens = [];
for (const it of D.items) for (const v of ["v1", "v2", "v3", "v1padded"]) allLens.push(it.outputs[v].length);
const meanLen = allLens.reduce((a, b) => a + b, 0) / allLens.length;
const sdLen = Math.sqrt(allLens.reduce((a, b) => a + (b - meanLen) ** 2, 0) / allLens.length) || 1;

function regen(cfg, it, variant) {
  const truth = variant === "v1padded" ? it.human.v1.label : (it.human[variant]?.label ?? 0);
  const z = (it.outputs[variant].length - meanLen) / sdLen;
  const rng = mulberry32(hashSeed(`${cfg.id}|${it.id}|${variant}`));
  const latent = latentFor(truth, cfg, z, variant === "v1padded" ? "v1" : variant);
  const out = [];
  for (let s = 0; s < 5; s++) {
    const noise = gauss(rng) * (s === 0 ? 0.40 : 0.80);
    const p = sigmoid(1.35 * latent + noise);
    out.push(rng() < p ? 1 : 0);
  }
  return out;
}

const cfgs = [
  { id: "c-rubric-3b", model: "llama-3.2-3b", prompt_variant: "rubric", fewshot: 0 },
  { id: "c-rubric-3b-verb", model: "llama-3.2-3b", prompt_variant: "rubric", fewshot: 0, verbosity_bias: true },
  { id: "c-rubric-3b-self", model: "llama-3.2-3b", prompt_variant: "rubric", fewshot: 0, self_preference: true },
];
for (const cfg of cfgs) {
  let match = 0, total = 0;
  for (const it of D.items) for (const v of ["v1", "v2", "v3", "v1padded"]) {
    total++;
    const mine = regen(cfg, it, v);
    const theirs = D.runs[cfg.id][`${it.id}|${v}`];
    if (JSON.stringify(mine) === JSON.stringify(theirs)) match++;
  }
  console.log(`regenerated ${cfg.id}: ${match}/${total} item-variant sample vectors match the shipped data`);
}

// z for the padded copy vs the original
{
  const zs = D.dev_ids.map((id) => {
    const it = D.items.find((x) => x.id === id);
    return {
      id,
      z1: (it.outputs.v1.length - meanLen) / sdLen,
      zp: (it.outputs.v1padded.length - meanLen) / sdLen,
    };
  });
  const avg1 = zs.reduce((s, x) => s + x.z1, 0) / zs.length;
  const avgp = zs.reduce((s, x) => s + x.zp, 0) / zs.length;
  console.log("mean z(v1) on dev:", avg1.toFixed(3), "mean z(v1padded) on dev:", avgp.toFixed(3),
    "delta:", (avgp - avg1).toFixed(3), "-> latent bonus", (0.45 * (avgp - avg1)).toFixed(3));
  console.log("pooled meanLen", meanLen.toFixed(1), "sdLen", sdLen.toFixed(1));
}