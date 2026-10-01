// Lesson and quiz validator.
//
// The Academy's check-course is the authority; this is the fast pre-flight
// that runs in a second and catches the contract violations that are easiest
// to make while writing 43 lessons at once. It reads the same rules from
// curriculum/AGENT-BRIEF.md, so it is a check on our own work, not a
// replacement for the importer's dry run.
//
// Run:  node build/check-lessons.mjs

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire("C:/Users/TalGiladi/OneDrive/repos/tals-academy/package.json");
const yaml = require("js-yaml");

const problems = [];
const notes = [];
const fail = (file, msg) => problems.push(`${file}: ${msg}`);

const SECTIONS = [
  "## Why it matters", "## How it works", "## Show me", "## Try it", "## Break it",
  "## Fix it", "## How do I know it works?", "## Use / don't use", "## Reflect", "## Sources",
];
const DISALLOWED_HTML = [
  [/<div\b/i, "<div> is stripped by the importer"],
  [/<script\b/i, "<script> is not allowed"],
  [/<style\b/i, "<style> is not allowed"],
  [/<iframe\b/i, "<iframe> is not allowed"],
  [/<form\b/i, "<form> is not allowed"],
  [/<button\b/i, "<button> is not allowed"],
  [/<svg\b/i, "inline <svg> is not allowed"],
  [/\son[a-z]+\s*=\s*["']/i, "inline on*= handlers are stripped"],
  [/```mermaid[\s\S]*?```/i, null], // allowed, checked separately
];
const BANNED_HEADINGS = [/^#+\s*(answers?|answer key)\b/im];
const PROGRESS_TOOL = /(course\.py|progress\.py|course progress)\s+complete/i;

/* ------------------------------------------------------------------ *
 * Collect every file the sidebar promises
 * ------------------------------------------------------------------ */

const sidebar = readFileSync(join(ROOT, "_sidebar.md"), "utf8");
const links = [...sidebar.matchAll(/\]\(([^)]+\.md)\)/g)].map((m) => m[1]);
const seen = new Set();
for (const l of links) {
  if (seen.has(l)) fail("_sidebar.md", `"${l}" is listed more than once`);
  seen.add(l);
  if (!existsSync(join(ROOT, l))) fail("_sidebar.md", `"${l}" does not exist yet`);
}

const lessonFiles = [];
for (let m = 1; m <= 10; m++) {
  const dir = join(ROOT, "lessons", `module-${String(m).padStart(2, "0")}`);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    if (/^lesson-\d\d\.md$/.test(f)) lessonFiles.push(join("lessons", `module-${String(m).padStart(2, "0")}`, f));
  }
}

/* ------------------------------------------------------------------ *
 * Preset names each simulation actually supports
 * ------------------------------------------------------------------ */

function presetsFor(sim) {
  const file = join(ROOT, "simulations", sim, "app.js");
  if (!existsSync(file)) return null;
  const src = readFileSync(file, "utf8");
  const block = src.match(/const PRESETS\s*=\s*\{([\s\S]*?)\n\};/);
  if (!block) return [];
  // Entries are top-level lines inside the block. Keys may be quoted
  // ("thumbs-down":) or bare (grounding:); the nested object properties
  // (variant:, panel:) are indented further and must not be picked up.
  const keys = [];
  for (const line of block[1].split(/\r?\n/)) {
    const m = line.match(/^\s{1,4}["']?([A-Za-z0-9_-]+)["']?\s*:\s*[\[{]/);
    if (m) keys.push(m[1]);
  }
  return keys;
}

/* ------------------------------------------------------------------ *
 * Lessons
 * ------------------------------------------------------------------ */

const seenIds = new Set();
const idOrder = [];

for (const rel of lessonFiles) {
  const src = readFileSync(join(ROOT, rel), "utf8");

  // --- front matter ---
  const fm = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!fm) { fail(rel, "no YAML front matter"); continue; }
  let meta;
  try { meta = yaml.load(fm[1]); } catch (e) { fail(rel, `front matter will not parse: ${e.message}`); continue; }

  for (const key of ["id", "module", "minutes", "prerequisites", "objectives", "volatility", "sources", "last_verified"]) {
    if (meta[key] === undefined) fail(rel, `front matter is missing "${key}"`);
  }
  if (!/^\d\d\.\d+$/.test(String(meta.id || ""))) {
    fail(rel, `id "${meta.id}" is not in the expected form "NN.M"`);
  }
  if (seenIds.has(meta.id)) fail(rel, `id "${meta.id}" is used more than once`);
  seenIds.add(meta.id);
  idOrder.push({ id: meta.id, rel });

  if (!["concept", "implementation"].includes(meta.volatility)) {
    fail(rel, `volatility must be concept or implementation, found "${meta.volatility}"`);
  }
  if (!Array.isArray(meta.objectives) || meta.objectives.length < 2) {
    fail(rel, "needs at least two objectives");
  }
  for (const o of meta.objectives || []) {
    if (!/[a-z]/i.test(o)) fail(rel, "an objective has no measurable verb");
  }
  if (!Array.isArray(meta.sources) || meta.sources.length === 0) {
    fail(rel, "needs at least one source");
  }
  for (const s of meta.sources || []) {
    if (!s.url || !/^https?:\/\//.test(s.url)) fail(rel, `source "${s.title}" has no http(s) url`);
    if (!s.title) fail(rel, "a source has no title");
  }

  // --- body ---
  const body = src.slice(fm[0].length);
  const h1s = body.match(/^# .+$/gm) || [];
  if (h1s.length !== 1) fail(rel, `expected exactly one H1, found ${h1s.length}`);
  else if (!/^# \d\d\.\d+ · .+$/.test(h1s[0])) {
    fail(rel, `H1 "${h1s[0]}" is not in the form "# NN.M · Title"`);
  }

  const idMatch = String(meta.id).match(/(\d\d)\.(\d)/);
  const expectModule = Number(idMatch?.[1]);
  if (expectModule && meta.module !== expectModule) {
    fail(rel, `module is ${meta.module} but the id says module ${expectModule}`);
  }

  // Intro paragraph immediately after the H1.
  const afterH1 = body.split(/^# .+$/m)[1] || "";
  const intro = afterH1.trim().split(/\r?\n\r?\n/)[0] || "";
  if (!intro || intro.startsWith("#") || intro.startsWith("-") || intro.startsWith("|") ||
      intro.startsWith("<") || /^[*_`]/.test(intro)) {
    fail(rel, "the paragraph after the H1 must be one plain prose paragraph");
  }

  for (const s of SECTIONS) {
    if (!body.includes(s)) fail(rel, `missing section "${s.replace(/^## /, "")}"`);
  }
  const h2s = (body.match(/^## .+$/gm) || []).map((h) => h.slice(3).trim());
  const extra = h2s.filter((h) => !SECTIONS.includes(`## ${h}`));
  for (const e of extra) fail(rel, `unexpected section "## ${e}" (keep one fixed section set)`);

  for (const [re, msg] of DISALLOWED_HTML) {
    if (msg && re.test(body)) fail(rel, `${msg}`);
  }
  for (const re of BANNED_HEADINGS) if (re.test(body)) fail(rel, "answer key heading present");
  if (PROGRESS_TOOL.test(body)) fail(rel, "lesson calls a progress tool");

  // Simulation links must name a preset that exists.
  for (const m of body.matchAll(/\]\(\.\.\/\.\.\/simulations\/([a-z-]+)\/index\.html([^)]*)\)/g)) {
    const [, sim, qs] = m;
    if (!existsSync(join(ROOT, "simulations", sim, "index.html"))) {
      fail(rel, `links to simulations/${sim} which does not exist`);
      continue;
    }
    const known = presetsFor(sim);
    const used = qs.match(/preset=([a-z0-9-]+)/);
    if (used && known && !known.includes(used[1])) {
      fail(rel, `preset "${used[1]}" is not a preset in ${sim} (has: ${known.join(", ")})`);
    }
    if (!used && known && known.length > 0) {
      notes.push(`${rel}: ${sim} link has no ?preset= but ${sim} has presets to choose from`);
    }
  }

  // Relative links must resolve. Strip any query string or fragment first —
  // a simulation link carries ?preset=… and that is not part of the path.
  for (const m of body.matchAll(/\]\((\.\.\/[^)#][^)]*)\)/g)) {
    const target = join(ROOT, dirname(rel), m[1].split(/[?#]/)[0]);
    if (!existsSync(target)) fail(rel, `broken relative link "${m[1]}"`);
  }

  // Prerequisites must be real and earlier.
  for (const p of meta.prerequisites || []) {
    if (!seenIds.has(p)) fail(rel, `prerequisite "${p}" is not an earlier lesson id`);
  }

  // --- quiz ---
  const quizPath = rel.replace(/\.md$/, ".quiz.yaml");
  if (!existsSync(join(ROOT, quizPath))) { fail(rel, "has no .quiz.yaml"); continue; }
  checkQuiz(quizPath);
}

function checkQuiz(path) {
  let data;
  try { data = yaml.load(readFileSync(join(ROOT, path), "utf8")); }
  catch (e) { fail(path, `will not parse: ${e.message}`); return; }
  if (!Array.isArray(data)) { fail(path, "top level must be a list of questions"); return; }
  if (data.length < 3 || data.length > 5) fail(path, `has ${data.length} questions; lesson quizzes need 3–5`);

  const positions = [];
  const ids = new Set();
  for (const [i, q] of data.entries()) {
    const at = `q${i + 1}`;
    if (!q.id) fail(path, `${at} has no id`);
    else if (ids.has(q.id)) fail(path, `id "${q.id}" reused`);
    ids.add(q.id);
    if (!q.question || String(q.question).length < 15) fail(path, `${q.id} has no real question`);
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      fail(path, `${q.id} has ${q.options?.length ?? 0} options; exactly 4 required`);
    } else {
      // The Academy drops a question unless every option is a non-empty
      // string, so a value that parsed as a map (from a ": " in the source)
      // has to fail here too rather than pass as a length-4 array.
      q.options.forEach((o, k) => {
        if (typeof o !== "string") {
          fail(path, `${q.id} option ${k} parsed as ${typeof o}, not a string — it contains ": " and needs a >- block scalar`);
        } else if (!o.trim()) {
          fail(path, `${q.id} option ${k} is empty`);
        }
      });
      if (typeof q.question !== "string" || !q.question.trim()) {
        fail(path, `${q.id} question is not a non-empty string`);
      }
      if (typeof q.explanation !== "string" || !q.explanation.trim()) {
        fail(path, `${q.id} explanation is not a non-empty string`);
      }
      const uniq = new Set(q.options.map((o) => String(o).trim().toLowerCase()));
      if (uniq.size !== 4) fail(path, `${q.id} has duplicate options`);
      if (uniq.size > 0 && /^(all|none) of the above/i.test(String(q.options[0]).trim())) {
        fail(path, `${q.id} uses "all/none of the above"`);
      }
      // The Academy enforces option-length balance twice, and the stricter
      // rule is the one in the actual importer
      // (tals-academy/src/lib/importer/quiz-files.ts):
      //   len(correct) > longestWrong * 1.5 && len(correct) - longestWrong > 30
      // The looser 1.8x + 20 rule in scripts/quiz-files.ts is only the
      // dry-run helper, so match the importer or the course will be rejected
      // on a question our own check called fine.
      const len = (s) => String(s).trim().length;
      const correct = q.options[q.correct];
      if (correct !== undefined) {
        const longestWrong = Math.max(...q.options.filter((_, k) => k !== q.correct).map(len));
        if (len(correct) > longestWrong * 1.5 && len(correct) - longestWrong > 30) {
          fail(path, `${q.id} correct option is ${len(correct)} chars against a longest wrong option of ${longestWrong} ` +
            `(importer limit: >${(longestWrong * 1.5).toFixed(0)} and more than 30 longer)`);
        }
      }
    }
    if (![0, 1, 2, 3].includes(q.correct)) fail(path, `${q.id} correct=${q.correct}, must be 0–3`);
    else positions.push(q.correct);
    if (!q.explanation || String(q.explanation).length < 25) {
      fail(path, `${q.id} explanation is missing or too short`);
    }
    if (q.source) fail(path, `${q.id} has a source field, which is the old fingerprint format`);
  }
  if (new Set(positions).size < 2) {
    notes.push(`${path}: correct answers are all at the same position (${positions.join(",")})`);
  }
}

/* ------------------------------------------------------------------ *
 * Module quizzes
 * ------------------------------------------------------------------ */

for (let m = 1; m <= 10; m++) {
  const id = String(m).padStart(2, "0");
  const page = join(ROOT, "assessments", `module-${id}-quiz.md`);
  const qy = join(ROOT, "assessments", `module-${id}-quiz.quiz.yaml`);
  if (!existsSync(page) && !existsSync(qy)) continue;

  if (existsSync(page)) {
    const src = readFileSync(page, "utf8");
    if (/^#+\s*(answers?|answer key)/im.test(src)) {
      fail(`module-${id}-quiz.md`, "has an Answers heading, which switches the importer to the old format");
    }
    if (src.length > 6000) notes.push(`module-${id}-quiz.md: intro page is long (${src.length} chars)`);
  }
  if (existsSync(qy)) {
    let data;
    try { data = yaml.load(readFileSync(qy, "utf8")); }
    catch (e) { fail(`module-${id}-quiz.quiz.yaml`, `will not parse: ${e.message}`); continue; }
    if (!Array.isArray(data)) fail(`module-${id}-quiz.quiz.yaml`, "top level must be a list");
    else {
      if (data.length < 8 || data.length > 10) {
        fail(`module-${id}-quiz.quiz.yaml`, `has ${data.length} questions; module quizzes need 8–10`);
      }
      const positions = [];
      data.forEach((q, i) => {
        if (!Array.isArray(q.options) || q.options.length !== 4) {
          fail(`module-${id}-quiz.quiz.yaml`, `${q.id} needs exactly 4 options`);
        } else {
          q.options.forEach((o, k) => {
            if (typeof o !== "string" || !o.trim()) {
              fail(`module-${id}-quiz.quiz.yaml`, `${q.id} option ${k} is not a non-empty string (a ": " in the source?)`);
            }
          });
          if (typeof q.explanation !== "string" || !q.explanation.trim()) {
            fail(`module-${id}-quiz.quiz.yaml`, `${q.id} has no explanation`);
          }
          const len2 = (s) => String(s).trim().length;
          const correct = q.options[q.correct];
          if (correct !== undefined) {
            const longestWrong = Math.max(...q.options.filter((_, k) => k !== q.correct).map(len2));
            if (len2(correct) > longestWrong * 1.5 && len2(correct) - longestWrong > 30) {
              fail(`module-${id}-quiz.quiz.yaml`, `${q.id} correct option is much longer (${len2(correct)} vs ${longestWrong})`);
            }
          }
        }
        if (![0, 1, 2, 3].includes(q.correct)) fail(`module-${id}-quiz.quiz.yaml`, `${q.id} correct out of range`);
        else positions.push(q.correct);
      });
      if (new Set(positions).size < 3) {
        notes.push(`module-${id}-quiz.quiz.yaml: correct answers spread over only ${new Set(positions).size} positions`);
      }
    }
  } else {
    fail(`module-${id}-quiz.md`, "module quiz page exists but has no .quiz.yaml");
  }
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

console.log(`\nChecked ${lessonFiles.length} lessons.\n`);
if (notes.length) {
  console.log(`Notes (${notes.length}):`);
  for (const n of notes.slice(0, 25)) console.log(`  ~ ${n}`);
  if (notes.length > 25) console.log(`  … and ${notes.length - 25} more`);
  console.log("");
}
if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("No problems found.\n");