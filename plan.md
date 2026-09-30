# Eval Lab: LLM Evals & Observability by Experiment — course plan

Written 2026-09-30. First draft, not yet reviewed.

**Status**

| Item | State |
|---|---|
| Plan | First draft, awaiting Tal's review |
| Decisions on open questions | Not made — listed as questions in §12 |
| Spike | Not started (planning only). Proposed scope in §10 phase 1 |
| Lessons, labs, datasets, recordings, Python package | Not started |

Throughout this plan, **Verified** marks something measured on the rag-course spike
(`rag-course/spike/`, 2026-09-29) that this course reuses; everything else is a proposal or a
target. Nothing has been measured for this course yet.

Source: TODO_FOR_TAL.md item #5 (APPROVED 2026-09-29):

> Eval design, LLM-as-judge, tracing, regression suites. Same constraint as #4: many quick
> labs where the learner tweaks parameters (judge prompt, rubric, sample size, model,
> thresholds) and immediately sees results change.

Working title only; the name is an open question (§12).

---

## 1. One-paragraph pitch

A public, experiment-first course on evaluating and observing LLM applications, for software
developers with no ML or statistics background. Every lesson is built around one **knob**
(judge prompt, rubric, scale, few-shot examples, judge model, sample size, repeats,
threshold, answer order…). The learner turns the knob in a **browser Eval Lab** and quickly
sees how the judge's verdicts, its agreement with human labels, the confidence interval and
the release decision change. The course starts where good eval practice starts — reading
traces and naming failures — and ends with a regression suite in CI and online monitoring on
real tracing tools. A **browser-only fundamentals path** needs no install and no API key; a
**production path** moves the same experiments into Python, OpenTelemetry and CI on a
CPU-only laptop.

---

## 2. Target learner and outcome

**Learner (public audience):** a working software developer (any language, basic Python)
who has shipped or prototyped an LLM feature — a chatbot, a RAG app, an agent, an
extraction pipeline — and now changes prompts or models "by vibes", cannot tell whether a
change made things better, and does not trust the LLM-as-judge scores a tool gives them.

**Assumed:** Python basics, HTTP/JSON, git, has called an LLM API. **Not assumed:** ML
background, statistics beyond averages and percentages, any eval or tracing tool, Docker
(only on the production path; on-ramp and setup checks included).

**Two paths**

| Path | Modules | Needs | Estimated time |
|---|---|---|---|
| Fundamentals (browser only) | M1–M10 | A modern browser | ~14–18 h |
| Production | M11–M14 + capstone | Python, Docker, CPU laptop | +15–20 h |
| Advanced (optional) | M15 | Same as production | +3–5 h |

**Outcome — by the end of the fundamentals path they can:**

1. Do error analysis: read traces, write open notes, group them into a failure taxonomy and
   count it — before writing any metric.
2. Choose the right check for each failure: code assertion, reference metric, LLM judge or
   human review — and say why.
3. Build an eval set with a dev/test split and a sample size chosen from a confidence
   interval, not from habit.
4. Write an LLM judge (binary first, rubric, few-shot, critique-then-verdict) and **validate
   it against human labels** with TPR/TNR, Cohen's kappa and a disagreement review.
5. Recognise and correct judge biases (position, verbosity, self-preference) and trade judge
   size, repeats and cost against agreement.
6. Correct a measured pass rate for known judge error and report it with an interval.
7. Evaluate RAG answers (grounding, abstention) and agents (end state, trajectory, tool
   calls) with the same method.
8. Compare two systems with a paired test and set a release gate that balances false alarms
   against missed regressions.

**Production path adds:**

9. Instrument an app with OpenTelemetry (GenAI semantic conventions) and read it in a local
   tracing UI: spans, tokens, cost, latency, sessions, user feedback.
10. Run a regression suite in CI with cached judge calls, repeats, tolerances and a budget.
11. Run online evals on sampled production traces, alert on drift, and turn every new
    failure into a test case.

**Hardware:** a CPU-only laptop is enough for the whole course. No paid API is required for
the learner; a paid model is an optional "bring your own key" judge. Build-time recordings
may use one (open question §12.4).

---

## 3. What already exists (research, 2026-09-30)

### Free / public courses and readings

| Course / resource | Format | Strength | Gap we aim at |
|---|---|---|---|
| Hamel Husain & Shreya Shankar — [AI Evals for Engineers & PMs](https://maven.com/parlance-labs/evals) (Maven, paid) + free [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/), [blog](https://hamel.dev/blog/posts/evals/), [cold-start talk](https://maven.com/p/5fb214) | Cohort course | The best practical method: error analysis first, binary judges, validate judge vs human labels with splits | Paid, cohort-scheduled; method, not a hands-on playground |
| DeepLearning.AI — [Evaluating AI Agents](https://www.deeplearning.ai/short-courses/evaluating-ai-agents/) (Arize, ~2 h) | Free short course, notebooks | Tracing, code checks vs judge, experiments | Tied to Phoenix; judge validation light |
| DeepLearning.AI — [Automated Testing for LLMOps](https://www.deeplearning.ai/short-courses/automated-testing-llmops/) (CircleCI, ~1 h) | Free short course | Evals in CI | Vendor-tied; no judge calibration |
| DeepLearning.AI — [Quality and Safety for LLM Applications](https://www.deeplearning.ai/short-courses/quality-safety-llm-applications/), [Evaluating and Debugging Generative AI](https://www.deeplearning.ai/short-courses/evaluating-debugging-generative-ai/), [Building and Evaluating Advanced RAG](https://www.deeplearning.ai/short-courses/building-evaluating-advanced-rag/) | Free short courses | Monitoring metrics; experiment tracking; "RAG triad" | Short, vendor-tied |
| Hugging Face — [Evaluation Guidebook](https://huggingface.co/spaces/OpenEvals/evaluation-guidebook) ([repo](https://github.com/huggingface/evaluation-guidebook)) | Free text guide | Benchmarks, contamination, judge pitfalls | Model evaluation, not applications; no tracing |
| OpenAI Cookbook — [getting started with evals](https://developers.openai.com/cookbook/examples/evaluation/getting_started_with_openai_evals), [logprobs for evaluation](https://developers.openai.com/cookbook/examples/using_logprobs) | Free notebooks | Concrete API recipes | Single-vendor |
| Anthropic — [Define success criteria and build evaluations](https://platform.claude.com/docs/en/docs/test-and-evaluate/develop-tests) | Free docs | Clear success criteria and grading methods | Very little on observability |
| Arize — [LLM Evaluation Basics](https://courses.arize.com/l/pdp/llm-evaluation-basics); Evidently — [LLM evaluation course](https://www.evidentlyai.com/llm-evaluation-course-practice), [aligning a judge with human labels](https://www.evidentlyai.com/blog/how-to-align-llm-judge-with-human-labels) | Free vendor courses | Short and practical | Each tied to its tool |
| Eugene Yan — [Evaluating the Effectiveness of LLM-Evaluators](https://eugeneyan.com/writing/llm-evaluators/), [evals](https://eugeneyan.com/writing/evals/) | Free essays | Best synthesis of judge research | No labs |
| Papers — [MT-Bench / Chatbot Arena judges](https://arxiv.org/abs/2306.05685), [LLM-as-a-Judge survey](https://arxiv.org/abs/2411.15594), [EvalGen: Who Validates the Validators?](https://arxiv.org/abs/2404.12272) | — | Bias findings; "criteria drift" | — |

Langfuse has docs and guides but no formal course ([docs](https://langfuse.com/docs),
[guides](https://langfuse.com/guides)).

### Tools (all free to run locally)

| Tool | License | Runs | Use in this course |
|---|---|---|---|
| [promptfoo](https://github.com/promptfoo/promptfoo) | MIT | Node, CPU, local web viewer | Candidate for the framework-mapping lesson and CI (M11, M13) |
| [Inspect AI](https://github.com/UKGovernmentBEIS/inspect_ai) ([docs](https://inspect.aisi.org.uk/)) | MIT | Python, CPU, Ollama models | Candidate for the framework-mapping lesson |
| [DeepEval](https://github.com/confident-ai/deepeval) | Apache-2.0 | Python, pytest style | Candidate for the framework-mapping lesson |
| [RAGAS](https://github.com/explodinggradients/ragas) | Apache-2.0 | Python | M8: its metrics validated against human labels |
| [OpenAI evals](https://github.com/openai/evals), [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) | MIT | Python; harness slow on CPU | M15 benchmarks only |
| [Arize Phoenix](https://github.com/Arize-ai/phoenix) | Elastic License 2.0 (source-available, not OSI) | `pip install`, CPU, lightest tracing UI | Candidate tracing UI (M12) |
| [Langfuse](https://github.com/langfuse/langfuse) ([self-hosting](https://langfuse.com/self-hosting)) | MIT core + enterprise features | Docker: Postgres, ClickHouse, Redis, S3 — heavy for a laptop | Candidate tracing UI (M12) |
| [MLflow Tracing](https://mlflow.org/docs/latest/genai/tracing/) | Apache-2.0 | Python, local UI | Candidate tracing UI (M12) |
| [OpenLLMetry](https://github.com/traceloop/openllmetry) | Apache-2.0 | OTel instrumentation | M12 auto-instrumentation |
| [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) ([agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/)) | Spec, status "Development" | — | The trace format of the whole course, including the browser trace viewer |
| [Evidently](https://github.com/evidentlyai/evidently) | Apache-2.0 | Python | M14 drift reports (candidate) |
| [ChainForge](https://github.com/ianarawjo/ChainForge) ([browser playground](https://chainforge.ai/play/)) | MIT | Browser, Python evaluators via Pyodide | Closest thing to an in-browser eval tool; not a course, needs API keys for models |

### Interactive judge-calibration tools that exist (none is a course)

- EvalGen prototype inside ChainForge ([paper](https://arxiv.org/abs/2404.12272)) — grade
  outputs, criteria emerge, assertions are aligned to your grades.
- [LangSmith Align Evals](https://www.langchain.com/blog/introducing-align-evals) — edit a
  judge prompt and see agreement with human labels; commercial, hosted.
- [Potato judge calibration](https://potatoannotator.readthedocs.io/en/latest/ai-intelligence/judge_calibration/)
  — running kappa, confusion matrix, disagreements; open source, server app.
- We found **no fully client-side tool** where you edit a rubric, a small judge runs in the
  browser, and agreement updates immediately. That is the slot this course's lab fills.

### Our own courses (overlap check)

| Course | What it covers | Depth | How this course relates |
|---|---|---|---|
| `ai-engineer` | M3 "Evaluation Foundations" (3.1–3.5: golden set, metrics, **LLM-as-judge and calibration**, **regression suites and CI gating**); 5.5 RAG metrics; 8.4 baseline; 10.4 tracing (OTel + Langfuse/LangSmith); 11.4 red-teaming | ~1 h on evals, ~12 min on tracing, inside a job-prep course | This is the deep version. ai-engineer M3 and 10.4 can link here (question §12.10). |
| `ai-native-org` | M7 "Agent Evaluation" (07.1–07.6: task datasets, graders incl. judges, statistics, paired comparison, evals in the loop); lab `labs/module-07/` (C# EvalHarness, calibration set, CI gate); simulation `simulations/evaluation/` (presets `biased-judge`, `one-run`, `paired`); 11.4 observability and cost | ~1.5 h reading + 8 h practice, agent-coding focus, C# | Strongest overlap. Its simulation is a **synthetic educational model**; ours runs on **recorded real judge outputs and live small judges**. We reuse its statistical framing (Wilson interval, paired comparison) and its simulation conventions, and do not duplicate its agent-coding angle. |
| `rag-course` (plan only) | §5 evaluation design (evidence coverage, grounding, abstention); M10 "Evaluation as a discipline" (synthetic questions, labelling, judge basics); M13 tracing + regression suite | Planned | Shares the lab engine (§4.2) and the company-handbook corpus (§6). rag-course keeps retrieval metrics; this course owns judges, tracing and regression suites. rag-course M10 links here for depth. |
| `ai-security-course` | 24.1 security evaluation (ASR with Wilson CI, regression); 25.1 automated red teaming (garak, PyRIT, promptfoo); 23.1 guardrails | One long lesson each, with labs | M10 includes one safety / over-refusal slice as a release gate and links there for attacks. |
| `full-ml-engineer-course` | M13 model evaluation (perplexity, contamination, eval harness); M15/M16 reward models and verifiers | Model training side | M15 (optional) links there for benchmarks and reward models. |
| `ai-inference` | 8.3 observability for inference (TTFT/TPOT, golden signals, dashboards) | 12 min, infra only | M12 covers application-level traces and links there for serving metrics. |

Nothing in our courses covers hands-on judge validation on real data, OTel GenAI
conventions, a local tracing UI as a lab, online evals or drift monitoring in depth.

### Intended differentiator

The survey above is not exhaustive. Among what we found, the good method (Husain & Shankar)
is paid and cohort-based, the free courses are short and tied to one vendor's tool, and the
interactive calibration tools are hosted or server-based and are not courses. Our intended
differentiator is the combination of: (a) turning judge and statistics knobs on **real
recorded judge runs** with immediate results, (b) every judge **scored against human labels**
with a held-out test set, (c) a **live small judge in the browser** for free-form prompt
edits, with no key and no install, (d) error analysis on real traces from the first module,
and (e) a production path on vendor-neutral OpenTelemetry. The methodology backbone is
Husain & Shankar's "look at your data, binary judges, validate the validator", taught
through play.

---

## 4. The core problem: quick eval runs with visible results

Requirements from Tal's constraint:

- A knob change (judge prompt, rubric, scale, few-shot, model, sample size, repeats,
  threshold, answer order) shows new results quickly — **targets** in §4.5, to verify.
- **Zero setup** for the fundamentals path: open a lesson, it works. No Python, Docker or key.
- **Lots of demos:** every lesson embeds a ready preset.
- **Side-by-side:** judge A vs judge B, system A vs system B, on the same items.
- **Metrics, not vibes:** every change shows agreement with human labels, an interval, and
  the list of items that flipped.
- Runs on static hosting (GitHub Pages) and on a CPU-only laptop, and imports into Tal's
  Academy (`ai-native-org/curriculum/course-outline.md` §19).

The expensive part of an eval run is **calling the judge model** over many items. Everything
downstream of the verdicts — thresholds, sampling, agreement, intervals, pass-rate
correction, A/B diffs — is cheap arithmetic.

### 4.1 Options considered

| Option | Speed per knob | Setup | Verdict |
|---|---|---|---|
| Colab / Kaggle notebooks calling an API or local model | Seconds to minutes per re-run | Google account, keys or GPU quota | Too slow and fragile for play. Optional companion only. |
| Hosted judge server (HF Space / Gradio) | Fast when warm | None for learner | Costs money, rate limits, cold starts, dies when unmaintained. No. |
| Local tools (promptfoo / Inspect / Phoenix + Ollama) | 10 s – minutes per run on CPU | Node or Python, model pulls | Right for the production path, wrong for first contact. |
| Learner's own API key only | Fast | Paid key | Violates "free". Optional mode only. |
| **Static in-browser lab over recorded judge runs + live small judge** | Milliseconds for recorded knobs; ~1 min for a live 20-item run (target) | None | **Chosen for the fundamentals path.** Same approach as rag-course §4. |

### 4.2 Architecture: "Eval Lab" (static, in-browser; shared engine with RAG Lab)

**Everything expensive is precomputed at build time; everything interactive is cheap enough
to run in the browser.** This reuses the rag-course spike's design and code patterns
(Verified there: static site, precomputed artefacts, knob change in 5–50 ms warm, config
state in the URL, A/B pin-and-diff, per-type breakdown, Transformers.js in the browser
matching Node build output).

**Build time (ours, a Node script per dataset):**

1. Load items: input, system outputs from 2–4 system variants, reference answers where they
   exist, trace ids, **human labels** (binary pass/fail + failure category + a one-line
   critique; Likert or pairwise where the source dataset has them).
2. Read each lesson's **judge grid** from a YAML file: which judge prompts, rubrics, scales,
   few-shot sets, judge models, answer orders and repeat counts that lesson needs. The grid
   is the union of lesson grids, not a full cross product (see §4.6 compute risk).
3. Run every judge configuration on every item with a pinned model build and pinned decoding
   settings. Store per call: parsed verdict, **score-token probabilities** (top-5 logprobs,
   so a probability-weighted score and a threshold knob are possible), the critique text,
   input/output token counts, measured latency and an estimated cost.
4. Repeats: one sample at temperature 0 plus N samples (proposal: 5) at a set temperature, so
   the learner can see run-to-run noise and majority voting without re-running anything.
5. Pairwise configs are recorded in both answer orders (A–B and B–A).
6. Embed items and outputs with the rag-course embedding models (reference-similarity
   metrics, clustering in error analysis).
7. Record traces of the demo apps in OTel GenAI JSON (§6).
8. Write compact artefacts: verdicts and probabilities as typed arrays per (dataset, judge
   config); critiques and traces as lazily loaded JSON.

**Run time (learner's browser, no server), in a Web Worker:**

- **Recorded-config knobs** (choose judge prompt / rubric / scale / few-shot / model / order
  from the recorded menu): lookup, no model call.
- **Threshold** on the probability-weighted score → verdicts → all metrics recomputed.
- **Sample size** → seeded random or stratified subset; the interval widens or narrows live.
- **Repeats and voting** → majority or mean over the recorded samples.
- **Agreement with humans:** confusion matrix, TPR/TNR, accuracy, Cohen's kappa, with
  bootstrap intervals; the **disagreement list** (item, human label, judge verdict, critique).
- **Corrected pass rate:** the observed judge pass rate corrected for the judge's measured
  TPR/TNR (Rogan–Gladen style), with an interval that includes judge uncertainty.
- **System A vs B:** paired bootstrap on the same items; list of items that flipped
  (fixed / broke).
- **Bias probes:** position swap (both orders recorded), verbosity (recorded outputs with
  padded variants), self-preference (judge and system from the same model family).
- **Cost/latency panel:** tokens, estimated cost and latency per run, next to agreement.
- **Code-based evaluators run live in JavaScript:** exact match, contains, regex, JSON parse +
  schema check (vendored small validator), numeric tolerance, token F1, ROUGE-L, embedding
  similarity against a reference (precomputed vectors; query-time embedding via
  Transformers.js as in rag-course). Learners edit the regex or schema and see pass/fail move.
- **Trace viewer:** span tree, timings, tokens, tool calls, errors; filter and search; an
  **annotation panel** for open coding (free-text notes) and axial coding (tags → counts).
  Annotations stay in the browser and can be exported as JSON.
- **State in the URL:** every configuration is a shareable link (Verified in rag-course).
- **Challenge mode:** "reach kappa ≥ X on dev with a judge under Y tokens, then validate once
  on test".

**Free-form judge prompts (the "edit anything" mode).** When the learner edits the judge
prompt or rubric text beyond the recorded menu, there is no recording for it (§4.4). The lab
then offers, on a **quick set** of 20–30 dev items:

1. *In-browser judge* — [WebLLM](https://github.com/mlc-ai/web-llm) with a small model
   (Qwen3-0.6B / 1.7B or Llama-3.2-1B; roughly 0.4–1.3 GB one-time download, size shown
   first). Needs WebGPU. WebLLM accepts `logprobs` / `top_logprobs` (checked in its source),
   so probability-weighted scores work live too.
2. *Local Ollama* — the learner's own `ollama serve` URL, CPU is fine.
3. *Bring your own key* — any OpenAI-compatible endpoint; key kept only in the learner's
   browser. Optional, never required.
4. *Recorded-only* — if none of the above is available, every lesson still works from the
   recorded menu; the free-form exercise becomes "pick the closest recorded variant and
   explain the difference".

A live run is saved in the browser as **"Live run — model, date"** and shown next to the
recorded runs with the same metrics, so the learner compares their prompt to ours.

**Shared engine with rag-course ("lab kit").** Both courses need the same parts: data loader
with lazy fetch, URL state, scoreboard with A/B pin and diff, dev/test split with a
**Validate** button, recorded-output keying (§4.4), model adapters (Transformers.js, WebLLM,
Ollama, bring-your-own key), a device check and benchmark page, and accessible controls.
Proposal: build them once as plain ES modules and vendor the same copy into each course's
`simulations/common/`, because Academy simulations may not load code from elsewhere. Where
the shared code lives is question §12.2.

### 4.3 Two delivery tiers (the Academy constraint)

The Academy import contract (`ai-native-org/curriculum/course-outline.md` §19.6) says
simulations are embedded in a sandboxed iframe (`allow-scripts` only), vendor everything and
make **no network requests**. That fits recorded runs but not a 0.4–1.3 GB model download.
Proposal:

| Tier | Where | Contains | Network |
|---|---|---|---|
| **A. Embedded lesson simulations** | `simulations/<name>/`, embedded with a `Simulation:` link | Recorded runs for that lesson's preset(s), all JS evaluators, trace viewer, annotation | None; data ships next to the simulation (loaded as script files if a sandboxed iframe cannot `fetch` sibling files — to verify in the spike) |
| **B. Full Eval Lab** | `playground/`, a standalone page on GitHub Pages, linked (not embedded) | Every dataset and recorded config, free-form prompts, live judges (WebLLM / Ollama / key), bring-your-own data | Model files and optional endpoints |

Every lesson must be completable in tier A; tier B adds free-form play. The same constraint
applies to rag-course's live embedding and WebLLM features, so the answer should be shared
(question §12.3).

### 4.4 Recorded outputs — rules (same principle as rag-course §4.5)

- A recorded judge verdict is tied to an exact key: dataset item id and version, the system
  output being judged, judge model id + build + quantisation, the **full judge prompt text**
  (hash), rubric and scale, few-shot example ids and order, answer order, decoding settings
  and sample index.
- It is shown only on an exact key match, labelled **"Recorded run — model, date"**.
- If the learner edits one character of the judge prompt, the key no longer matches. The UI
  says "No recorded run for this exact judge", shows the diff to the nearest recorded
  variant, and offers a live run or recorded-only. Results of another prompt are never shown
  as the result of the learner's prompt.
- The same keying is taught as a production technique in M13 (judge-call caching in CI).

### 4.5 Performance targets (to verify, not promises)

| Stage | Target | Evidence so far |
|---|---|---|
| Cold load of an embedded simulation (tier A, default preset) | < 2 s on broadband | rag-course default config ~1.1 MB (Verified) |
| Switch to another recorded judge config (first visit) | < 300 ms | rag-course first-visit config ~100–180 ms (Verified, one machine) |
| Warm knob change (threshold, sample size, repeats, order) incl. all metrics | < 100 ms | rag-course warm knob 5–50 ms (Verified, one machine) |
| Bootstrap intervals (1 000 resamples × 500 items) | < 250 ms in a worker | Not measured |
| JS code evaluators over 500 items (regex, schema, ROUGE-L) | < 200 ms | Not measured |
| Trace viewer: open a 200-span trace | < 300 ms | Not built |
| Live judge, WebLLM 0.6–1.7B, 20 items, verdict + short critique | < 60 s on WebGPU | Not built |
| Live judge, Ollama CPU 1.7B, 20 items | < 90 s | Not built |
| Live judge, bring-your-own API, 20 items | < 20 s | Not built |
| Model download (once, size shown first) | < 2 min on broadband for ≤ 1.3 GB | Not measured |

Verification matrix before launch, as in rag-course: Chrome, Edge, Firefox, Safari ×
Windows, macOS, Linux, including one low-end laptop; a "test this device" page reused from
the lab kit. Lessons state timings as typical ranges.

### 4.6 Risks and mitigations

- *Build-time compute for recordings.* Rough estimate: ~400 items × ~40 judge configs × ~3
  samples ≈ 50k judge calls per dataset. With verdict-first outputs (a few tokens) plus
  critiques for a subset, that is still tens of hours on a CPU laptop. Mitigations: lesson
  grids instead of cross products; verdict-only calls for most configs; free GPU sessions
  (Kaggle / Colab) with checkpointed, resumable runs; optionally a paid API for one strong
  judge (question §12.4).
- *Judge model drift.* Open models are pinned by build and quantisation; any paid model is
  recorded with its dated id, and recordings are never silently refreshed.
- *Academy sandbox vs live models* — §4.3.
- *WebGPU missing / weak devices:* recorded-only covers every lesson; Ollama and key modes
  cover live runs.
- *Small judges are weak judges.* That is a lesson, not only a risk: the lab shows agreement
  per model size, and the recorded menu includes at least one strong judge so learners see
  the gap.
- *Human labels are expensive and subjective.* Public datasets bring their own labels;
  our own datasets need a labelling pass (question §12.5). Inter-annotator agreement on a
  subset is measured and shown, not hidden.
- *Dataset licences:* only permissive sources (§6). Chatbot Arena outputs are CC-BY-NC and
  are excluded; SummEval's source articles need checking before use.
- *OTel GenAI conventions are still "Development".* Pin a version, show the opt-in flag, and
  mark M12 lessons `volatility: implementation`.
- *Test labels are downloadable in a static site.* Honour system, as in rag-course.

---

## 5. Evaluation design (the statistics the lab computes)

### 5.1 Labels

Each item has:

- `human`: binary pass/fail (primary), plus `category` from the dataset's failure taxonomy
  and a one-line `critique`. Public datasets keep their native labels (pairwise preference,
  Likert 0–4) alongside a derived binary label with the rule stated.
- `slice`: dataset-specific tags (intent, difficulty, persona, language, answer length).
- `split`: dev or test, balanced by slice.
- `annotators`: for the agreement subset, labels from two or more people.

### 5.2 Judge-vs-human metrics

- Confusion matrix, **TPR** (judge passes what humans pass) and **TNR** (judge fails what
  humans fail) as the headline pair; accuracy and Cohen's kappa next to them; all with
  bootstrap intervals.
- Why accuracy alone misleads at low failure rates is shown with the prevalence knob.
- Likert and pairwise judges: agreement after the stated mapping, plus rank correlation for
  Likert and swap-consistency for pairwise.

### 5.3 From judge verdicts to a system score

- Observed pass rate with a Wilson interval (as in ai-native-org 07.4).
- Corrected pass rate using the judge's dev-set TPR/TNR, with an interval that includes both
  sampling noise and judge uncertainty. The lab shows when the correction is unstable
  (TPR + TNR close to 1).

### 5.4 Comparing systems

- Paired comparison on the same items (paired bootstrap), with the flip list.
- Release gate simulator: gate threshold × repeats × sample size → false-alarm rate and
  missed-regression rate, estimated from the recorded runs.

### 5.5 Dev and held-out test

- Introduced in M4 and used for every judge from M5 on: judge prompts and thresholds are
  tuned on dev; test agreement is behind a **Validate** button (one use per challenge), as
  in rag-course §5.4.

---

## 6. Demo datasets

**Core: three datasets of our own plus three public ones.**

| Dataset | Teaches | Source / status | License |
|---|---|---|---|
| **Support bot over the company handbook** — ~300 questions × 3 system variants (good prompt, sloppy prompt, weak model), with traces | The main thread: error analysis, binary judges, grounding, abstention, A/B, regression gates, tracing | Ours; reuses the fictional handbook corpus planned in rag-course §6 (to write once, used by both) | Ours |
| **Recipe → JSON extraction** — ~200 baking recipes, expected JSON, outputs from 3 variants | Code-based evals: parse, schema, field accuracy, numeric tolerance; when code beats a judge | Ours; recipes from baking-course | Ours |
| **Kitchen-assistant agent traces** — ~150 multi-step tool-calling runs (search recipe, convert units, scale, set timer) | Agent evals: end state vs trajectory, tool-call correctness, step-level failure labels | Ours; generated at build time | Ours |
| [MT-Bench human judgments](https://huggingface.co/datasets/lmsys/mt_bench_human_judgments) — ~3K expert pairwise votes | Pairwise judging, position bias, agreement with experts | Public | CC-BY-4.0 |
| [HelpSteer2](https://huggingface.co/datasets/nvidia/HelpSteer2) subset — responses rated 0–4 on five attributes | Likert scales, multi-attribute rubrics, collapsing to binary | Public | CC-BY-4.0 |
| [JudgeBench](https://huggingface.co/datasets/ScalerLab/JudgeBench) — 620 hard pairs with objective correctness | Where judges fail: correctness beyond style; judge size matters | Public | MIT |

Optional / later: [SummEval](https://github.com/Yale-LILY/SummEval) (MIT labels; CNN/DM
articles fetched separately, licence to check) for faithfulness;
[TruthfulQA](https://huggingface.co/datasets/truthfulqa/truthful_qa) (Apache-2.0) and
[HaluEval](https://huggingface.co/datasets/pminervini/HaluEval) (Apache-2.0 on the HF
mirror) for hallucination; a small refusal / over-refusal set for the M10 safety slice
(candidate: XSTest, licence to verify). Excluded: Chatbot Arena conversations (outputs
CC-BY-NC), UltraFeedback (labels come from GPT-4, not humans; 940 MB), RewardBench as a
whole (mixed per-subset licences).

**Judge models on the recorded menu (proposal):** Qwen3-0.6B, Qwen3-1.7B, Llama-3.2-3B
(Llama 3.2 Community License), Flow-Judge-v0.1 (3.8B, Apache-2.0, a fine-tuned judge), and
optionally one strong model (open 7B+ such as Prometheus-2 7B on a free GPU, or a paid API —
question §12.4). Live in-browser: the WebLLM builds of Qwen3-0.6B / 1.7B and Llama-3.2-1B.
Re-verified at build time.

---

## 7. Course structure (5 parts, 15 modules, ~64 lessons)

Every lesson follows the same loop: **failure → predict → turn the knob → read the
scoreboard → explain why → "in production" note**, mapped onto the Academy lesson sections
(§15). Module numbers start at 1 to match the Academy's `Module N` convention.

### Part 1 — Look at it (browser only)

**M1. Why evals.** (4 lessons) Vibes vs evals; the loop *analyse → measure → improve*; what
"good" means for one feature (success criteria); tour of the Eval Lab; first challenge:
a prompt change that "feels better" and measurably is not.

**M2. Error analysis: look at your data.** (4) Reading traces in the trace viewer; open
coding (notes on 30 traces); axial coding into a failure taxonomy and counts; when to stop
reading. **Knobs:** number of traces read (new failure modes found vs traces read),
sampling strategy (random / by slice / by user feedback).

**M3. Code-based checks.** (4) Assertions, regex and JSON schema on the recipe extraction set;
reference metrics (exact match, token F1, ROUGE-L, embedding similarity) and their
thresholds — including a lab where ROUGE rewards a wrong answer; choosing code vs judge vs
human per failure category. **Knobs:** regex / schema text, metric, similarity threshold.

**M4. Building the eval set.** (4) From taxonomy to test cases; synthetic inputs by
dimensions (persona × intent × difficulty, recorded generations); dev/test split and the
one-validation rule; sample size and confidence intervals. **Knobs:** sample size,
stratification, split seed.

### Part 2 — Judge it (browser only)

**M5. Designing an LLM judge.** (5) One failure per judge, binary pass/fail first; binary vs
Likert vs pairwise; rubric specificity; few-shot examples (how many, which ones);
critique-then-verdict vs verdict-first; reference-guided vs reference-free. **Knobs:** judge
prompt variant, scale, rubric, few-shot set, output order. Free-form edits run live (§4.2).

**M6. Validating the judge.** (5) Human labels as ground truth and who should write them;
TPR/TNR, kappa, confusion matrix and the disagreement review; threshold on the
probability-weighted score; criteria drift (the learner labels 20 items, then sees their own
rubric change — after EvalGen); correcting a pass rate for judge error. **Knobs:** threshold,
prevalence, judge config, dev vs test.

**M7. Judge biases, models and cost.** (5) Position bias and swap-and-combine (MT-Bench);
verbosity bias (padded answers); self-preference; judge model size vs agreement vs cost;
repeats, temperature and majority vote. **Knobs:** answer order, padding, judge model,
repeats, temperature.

### Part 3 — Apply it (browser only)

**M8. Evaluating RAG answers.** (4) Retrieval vs answer failures (links rag-course M1 for
retrieval metrics, no duplication); grounding judges with claim-by-claim checking;
abstention and false refusal; RAGAS-style metrics validated against human labels.
**Knobs:** grounding judge variant, claim granularity, abstention threshold.

**M9. Evaluating agents and conversations.** (4) End-state vs trajectory evals; tool-call
correctness with code; multi-turn conversations and simulated users (recorded); locating the
failing step in a trace. **Knobs:** end-state vs trajectory scoring, step-label granularity.

**M10. Comparing systems and release gates.** (4) A/B on the same items and the flip list;
paired vs unpaired comparison; setting a gate under noise (false alarms vs missed
regressions); a safety / over-refusal slice as a gate (links ai-security-course for
attacks). **Knobs:** gate threshold, repeats, sample size, slice weights.

— *End of the fundamentals path.* —

### Part 4 — Ship it (Python + Docker, CPU-only)

**M11. From lab to code.** (4) The same experiments as plain Python + pytest; export a lab
config and reproduce its metrics (tolerance stated); a local judge through Ollama; one
lesson mapping the mechanism onto an eval framework (§12.7). Setup checks for Windows, macOS,
Linux and Docker.

**M12. Tracing and observability.** (5) OpenTelemetry basics; GenAI semantic conventions
(model, tokens, tool calls, agent spans); instrumenting the support bot by hand and with
auto-instrumentation; a local tracing UI (§12.6): cost, latency, sessions, user feedback;
PII redaction and trace sampling.

**M13. Regression suites in CI.** (4) The suite in GitHub Actions; caching judge calls with the
§4.4 key; flaky evals: repeats, tolerances, quarantine; eval budget per pull request and an
eval report posted on the PR.

**M14. Online evals and monitoring.** (4) Sampling production traces for online judges;
guardrails (block now) vs evals (measure later); drift in input mix and pass rate, alert bands
from intervals; closing the loop: trace → labelled failure → new test case → suite.

### Part 5 — Beyond (optional) and capstone

**M15. Advanced topics.** (4) Public benchmarks and contamination (a tiny model with
lm-evaluation-harness on CPU; links full-ml-engineer-course M13); reward models vs judges vs
verifiers (links full-ml M15/M16); annotation operations at scale and inter-annotator
agreement; evaluating a model migration (old vs new model on the full suite).

**Capstone.** The learner takes an LLM feature (ideally their own), does error analysis,
builds a labelled dev/test set, validates at least one judge, instruments the app, and ships
a CI regression suite plus an online-eval job. Graded with §9.

Module quizzes: one per module (8–10 scenario questions); each lesson has 3–5 questions
(§14).

---

## 8. Public learning experience

### 8.1 Positioning

The course home page states: for software developers, no ML or statistics background; two
paths (browser-only fundamentals, then production); what each needs and how long it takes
(§2); no paid API needed.

### 8.2 Accessibility

- Native buttons, radio groups and range inputs; keyboard-operable, visible focus, labelled.
- Metric changes announced in an ARIA live region ("kappa 0.61 → 0.72, 4 items fixed,
  1 broke").
- Every chart has a text alternative: confusion matrix as a table, intervals as numbers,
  trace tree as a nested list.
- Results never depend on colour alone: ✓/✗, "pass"/"fail", "fixed"/"broke" carry meaning.
- Responsive from 360 px (Academy §19.6).

### 8.3 Setup checks and troubleshooting

- Browser check page (from the lab kit): WebAssembly, WebGPU, storage quota, reachability of
  model files; each failure links to a fix and to recorded-only mode.
- Live judges: model size shown before download; retry; Ollama URL and CORS setup; what to do
  behind a corporate proxy.
- Production path: Python and Docker checks for Windows (WSL2), macOS (Apple Silicon), Linux,
  with a `doctor` command.

---

## 9. Capstone rubric

| Criterion | What "meets the bar" looks like |
|---|---|
| Error analysis | ≥ 50 traces open-coded; a failure taxonomy with counts; the top failures chosen with a reason |
| Eval set | Dev/test split by slice; sample size justified with an interval |
| Check selection | Each top failure mapped to code, judge or human review, with a reason |
| Judge validation | At least one binary judge with TPR/TNR and kappa on dev and one test validation; disagreements reviewed |
| Bias control | Position / verbosity bias checked where relevant; repeats justified |
| Honest reporting | Pass rates with intervals; corrected for judge error where a judge is used |
| Tracing | App instrumented with OTel GenAI attributes; cost and latency per request visible in a local UI |
| Regression suite | CI job with cached judge calls, stated budget and a gate that blocks a planted regression |
| Online loop | Sampled online judge on recent traces and one new failure turned into a test case |
| Reproducibility | One command re-runs the suite with the same numbers (within stated tolerance) |

A one-page eval design review defends each judge and gate with numbers.

---

## 10. Build phases

1. **Spike** (not started). Scope proposal: one embedded tier-A simulation — MT-Bench pairwise
   subset (~300 items), 3 small judges × 3 prompts × both orders × 5 repeats, recorded with
   Ollama; knobs for judge, prompt, order, threshold, sample size, repeats; agreement,
   kappa, intervals, flip list; one WebLLM live run on 20 items in tier B. It must answer:
   does it load and run inside a sandboxed `allow-scripts` iframe with no network; real
   recording throughput per judge call on CPU and on a free GPU; data size per config;
   whether logprob-weighted thresholds behave. Checkpoint: Tal signs off before phase 2.
2. **Lab kit:** extract the shared engine from the rag-course spike (§4.2), plus judge
   metrics, bootstrap, corrected pass rate, trace viewer and annotation. Done early because
   both courses depend on it.
3. **Datasets and labels:** handbook support bot (shared with rag-course phase 3), recipe
   extraction, kitchen agent traces; human labelling pass and agreement subset; public
   dataset subsets with licence notes.
4. **Recordings:** lesson judge grids, recorded runs, traces.
5. **Fundamentals Parts 1–2** (M1–M7) + browser setup check.
6. **Fundamentals Part 3** (M8–M10) + full Eval Lab (tier B) with live judges.
7. **Performance verification** on the browser/OS matrix (§4.5).
8. **Production path:** Python code, Docker, tracing UI, CI; M11–M14.
9. **Optional M15 + capstone.**
10. **QA:** Academy pre-publish checklist (§19.9 of the ai-native-org contract), every preset
    loads, every challenge solvable, keyboard-only walkthrough, links and licences verified.

---

## 11. Success criteria

- A learner with only a browser completes M1–M10, including every challenge, in tier A.
- Knob changes meet the §4.5 targets on the verification matrix.
- Every judge in the course is shown with its agreement against human labels; no judge score
  is ever presented without it.
- No recorded run is ever shown for a judge prompt it was not recorded for.
- Every lesson works without WebGPU, Ollama or an API key (recorded-only).
- All controls are keyboard-operable and no result depends on colour alone.
- Lab configs reproduce their metrics in Python within the stated tolerance.
- The capstone runs on a CPU-only machine and its CI gate catches a planted regression.
- The course imports into the Academy with no hand edits and passes its checklist.

---

## 12. Open decisions for Tal

1. **Name:** keep "LLM Evals & Observability", or "Eval Lab: LLM Evals & Observability by
   Experiment" to match "RAG Lab: Retrieval by Experiment"? Folder stays `llm-evals-course`.
2. **Shared lab kit:** build the shared engine once for both courses — in a shared folder
   vendored into each course, in its own repo, or inside rag-course with this course
   copying it?
3. **Academy sandbox:** accept the two tiers in §4.3 (embedded recorded-only simulations +
   a linked standalone lab for live judges), or ask the Academy to allow network access /
   larger downloads for these two courses' simulations?
4. **Build-time recordings:** open models only (Ollama on CPU plus free Kaggle/Colab GPU), or
   also one paid strong judge recorded once at our cost (as rag-course decided for recorded
   answers)? If paid, which provider and what budget?
5. **Human labels for our datasets:** who labels — Tal as the single domain expert, Claude
   drafts with Tal spot-checking a sample, or both with the agreement between them used as a
   lesson?
6. **Tracing UI for the production path:** Phoenix (lightest, Elastic License 2.0), Langfuse
   (MIT core, heavy Docker stack), MLflow Tracing (Apache-2.0, light), or teach OTel with two
   of them?
7. **Eval framework lesson:** which one to map onto — promptfoo, Inspect AI or DeepEval — or
   none beyond plain pytest?
8. **Python package:** one shared package for both courses (with rag-course's `raglab`), or a
   separate `evallab`?
9. **Language:** English only, or add a small Hebrew judging set (as rag-course has a Hebrew
   retrieval set)?
10. **Overlap with our courses:** should ai-engineer M3 / 10.4 and ai-native-org M7 link to
    this course as the deep version, and should rag-course M10 be trimmed to point here?
11. **Spike:** build the spike proposed in §10 phase 1 before any lessons, as with
    rag-course?
12. **Academy listing:** repo `tal-giladi/llm-evals-course`, free, hidden until launch?
13. **Build order vs rag-course:** build both courses' shared parts (lab kit, handbook corpus)
    together, or finish rag-course first?

---

## 13. Revision log

**2026-09-30 — first draft.** Written from TODO item #5, rag-course/plan.md and spike,
research on public courses, tools and datasets, and an overlap check against ai-engineer,
ai-native-org, rag-course, ai-security-course, full-ml-engineer-course and ai-inference.
Layout and quiz format follow the ai-native-org Academy import contract (§19).

---

## 14. Repository layout (Academy-native, as ai-native-org)

```text
llm-evals-course/
  plan.md                  ← this file
  CLAUDE.md                ← build guide for agents (lesson template, Academy contract rules)
  README.md                ← H1 = course title; first paragraph = catalog description; two paths
  _sidebar.md              ← the only table of contents; "- **Module N — Title**" lines
  index.html               ← docsify shell (search, copy-code, KaTeX, mermaid, quiz rendering)
  assets/site/             ← docsify shell code
  COURSE-MAP.md            ← outline and dependency graph for learners
  PROGRESS.md              ← build progress
  TODO_FOR_TAL.md          ← handoff / open items
  glossary.md              ← terms linked to the lesson that introduces them
  curriculum/              ← module plans, sources (never imported)
  lessons/module-NN/
    lesson-MM.md           ← front matter + "# NN.M · Title"
    lesson-MM.quiz.yaml    ← 3–5 questions, 4 options, correct 0–3, explanation
    lesson-MM.instructor.md← notes, never in the sidebar
  assessments/
    module-NN-quiz.md      ← short intro page
    module-NN-quiz.quiz.yaml ← 8–10 scenario questions
    capstone.md, capstone-rubric.md
  simulations/<name>/      ← tier-A embedded labs (index.html + .js + .css + recorded data)
  simulations/common/      ← vendored lab kit (shared with rag-course)
  playground/              ← tier-B full Eval Lab (standalone, live judges)
  labs/module-NN/          ← production-path labs: README spec + starter code + tests + solution/
  labs/common/             ← shared Python helpers (goes into every module zip)
  build/                   ← Node scripts: prepare data, run judge grids, record traces
  datasets/                ← our datasets, public subsets, human labels, licences
  templates/               ← eval design review, failure taxonomy sheet, judge prompt template
  projects/                ← capstone scaffold
  docker/                  ← compose files for the tracing UI and Ollama
  research/                ← modernisation pipeline (same protocol as other courses)
  references/              ← reading list
  scripts/check.py         ← Academy pre-publish checks (as ai-native-org)
  spike/                   ← prototype; folded into simulations/ + playground/ + build/ later
```

Hosting: GitHub Pages for the docsify site and the tier-B lab. Large data artefacts and model
files follow rag-course's decisions (#5 and §13.7 there) unless question §12.2 changes them.

---

## 15. Lesson template

Front matter as in the Academy contract (`id`, `module`, `minutes`, `practice_minutes`,
`prerequisites`, `objectives`, `volatility`, `sources`, `last_verified`), then
`# NN.M · Title`, then the Academy's section order carrying the experiment loop:

1. `## Why it matters` — header facts (path, knob of the lesson) and **the failure**: a real
   case where the eval gives the wrong answer.
2. `## How it works` — the mechanism, with a small worked example (kappa by hand on 10 items,
   a Wilson interval, a swap test).
3. `## Show me` — a recorded run that demonstrates the effect.
4. `## Try it` — **Predict** (write down what the knob will do), then the embedded simulation
   (`[Simulation: …](../../simulations/<name>/index.html?preset=…)` on its own line) with 2–5
   guided experiments on dev items.
5. `## Break it` — set the knob to make the eval lie (e.g. a verbose-loving judge ranks the
   worse system first).
6. `## Fix it` — the change that repairs it, shown on the scoreboard.
7. `## How do I know it works?` — **Challenge:** reach a target on dev, then one held-out
   validation.
8. `## Use / don't use` — in production: cost, latency, what teams actually do.
9. `## Reflect` — one or two questions to answer in writing.
10. `## Sources`.

Knowledge check: `lesson-MM.quiz.yaml` (3–5 questions; four similar-length options; one
correct; `correct` spread over 0–3; teaching `explanation`). No answer keys in markdown, no
`<div>` or `<iframe>` in content, relative links only.
