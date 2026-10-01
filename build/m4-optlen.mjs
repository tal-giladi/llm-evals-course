// Throwaway: option-length audit for the module-4 quiz files (no yaml dep).
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "lessons/module-04/lesson-01.quiz.yaml",
  "lessons/module-04/lesson-02.quiz.yaml",
  "lessons/module-04/lesson-03.quiz.yaml",
  "lessons/module-04/lesson-04.quiz.yaml",
  "assessments/module-04-quiz.quiz.yaml",
];

for (const f of files) {
  const lines = readFileSync(join(ROOT, f), "utf8").split(/\r?\n/);
  const opts = [];
  let cur = null;
  let correct = null;
  let id = null;
  const flush = () => { if (cur) opts.push({ id, text: cur, correct }); cur = null; };
  for (const ln of lines) {
    const q = ln.match(/^- id: (\S+)/);
    if (q) { flush(); id = q[1]; correct = null; opts.length && null; opts; continue; }
    const optStart = ln.match(/^ {4}- (?:>-\s*)?(.*)$/);
    if (optStart && id) { flush(); cur = optStart[1].trim(); continue; }
    const cont = ln.match(/^ {6}(?:>-\s*)?(.*)$/);
    if (cont && cur !== null) { cur += (cur.endsWith("-") || cont[1].startsWith(" ") ? "" : " ") + cont[1].trim(); continue; }
    const c = ln.match(/^ {2}correct: (\d+)/);
    if (c) { correct = Number(c[1]); continue; }
  }
  flush();
  // regroup: options come in runs of 4 between correct markers; rebuild per question
  const qs = [];
  let bucket = [];
  let c = null;
  let startId = null;
  const flushQ = () => { if (bucket.length) qs.push({ id: startId, opts: bucket, correct: c }); bucket = []; c = null; };
  let idPending = null;
  for (const ln of lines) {
    const qm = ln.match(/^- id: (\S+)/);
    if (qm) { flushQ(); idPending = qm[1]; continue; }
    if (ln === "  options:") { startId = idPending; continue; }
    const os = ln.match(/^ {4}- (?:>-\s*)?(.*)$/);
    if (os && startId) { bucket.push(os[1].trim()); continue; }
    const ct = ln.match(/^ {6}(?:>-\s*)?(.*)$/);
    if (ct && bucket.length) { bucket[bucket.length - 1] += " " + ct[1].trim(); continue; }
    const cm = ln.match(/^ {2}correct: (\d+)/);
    if (cm) { c = Number(cm[1]); continue; }
  }
  flushQ();
  console.log("== " + f + "  (" + qs.length + " questions, correct=" + qs.map((q) => q.correct).join(",") + ")");
  for (const q of qs) {
    const L = q.opts.map((o) => o.length);
    const lw = Math.max(...L.filter((_, i) => i !== q.correct));
    const flag = L[q.correct] > lw * 1.6 ? "  <-- FLAG" : "";
    console.log("  " + q.id + " correct=" + q.correct + " lens=[" + L.join(", ") + "] worst=" + L[q.correct] + " longestWrong=" + lw + " ratio=" + (L[q.correct] / lw).toFixed(2) + flag);
  }
}