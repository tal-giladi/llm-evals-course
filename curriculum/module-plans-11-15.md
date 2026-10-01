# Module plans 11–15 — the production path

**Status: plans only. No lesson content has been written.** Written after the Modules 1–10 build so
that the browser path is settled before the Python path is designed around it.

Read this to decide whether to build. Read `plan.md` §7 and §10 for the original intent; this file
records what the finished browser path implies, and where I would depart from the plan.

---

## The shape of the whole path

Modules 1–10 are one loop taught by hand: look at outputs, choose a check, measure, improve. Every
lab is a static page and every statistic is computed in the browser.

Modules 11–15 are the same loop with the hand taken away. Nothing new is *taught* — the ideas are
done. What is added is everything about the loop you cannot do in a browser:

- it runs on a schedule rather than when you click,
- it costs money every time it runs,
- it has to be reproducible on someone else's machine,
- it needs the production app instrumented before you can measure it at all.

**This is the honest pitch for the module sequence**, and it is why M11–M13 in that order is
right: you cannot put a regression suite in CI before you can run the suite locally (M11), and you
cannot run it in CI before the app is instrumented (M12).

### What the browser path already made possible

Two things this path inherits that the original plan did not anticipate, both of which change the
work:

1. **The cache-keying rule is already taught** in lesson 05.3 — item id, system output, model
   build, full prompt text, rubric, few-shot ids and order, answer order, decoding settings, sample
   index. Module 13's judge-call caching is that lesson applied, not a new idea. M13 can be short
   for that reason.
2. **The `evallab` statistics already exist in JavaScript** in `simulations/common/stats.js` and
   are the reference implementation. Module 11's core exercise is porting them, and the port doubles
   as the correctness test — the Python and JavaScript must agree to a stated tolerance, which is
   both a teaching device and a genuine regression check.

### The one thing that should go wrong in each module

Each module below names a failure that only exists in production, so the module has a reason to
exist rather than being a transcription exercise.

---

## M11 · From lab to code (4 lessons)

**Purpose:** the same experiments, reproducible on a machine you did not type on.

| # | Lesson | The production-only failure it teaches |
|---|---|---|
| 11.1 | Your first eval run in Python | A suite that passes locally and fails in CI because a path resolved differently |
| 11.2 | Porting the statistics, and proving they agree | Reimplementing kappa "approximately" and getting a different answer on a small set |
| 11.3 | A judge through Ollama on your laptop | Judge output that changes when Ollama restarts — model build, quantisation, and pinning |
| 11.4 | Mapping the same suite onto a framework | Reaching for a tool first and ending up unable to explain which number is which |

**Deliverables:** `evallab` in `labs/common/`; `labs/module-11/` with starter code, tests and a
`solution/`; a `doctor` command checking Python, Docker and model availability.

**Deliberate constraint — resolved by Tal: the live model stays optional.** The shipped dataset is
the same educational-model data the browser path uses, and the labs must run with **no API key**.
A live Ollama judge is an *extra*, not a requirement. This is not a compromise — it is the same
zero-setup guarantee that made Part 1 work, and dropping it would make the course fail the people
who can least afford a paid model.

**Docker earns its place here, and the reason is the module's own lesson.** The failure M11 exists
to teach is a suite that passes on your machine and fails on someone else's, and the usual culprit
is the judge: a different model build or quantisation gives different verdicts. Running Ollama
inside a pinned container with a pinned model tag is what makes the judge reproducible at all — so
`docker compose up` for the judge is the *answer* to M11's problem, not setup tax. Docker stays in
the production path, used for three things and always for the same reason (pinning something the
rest of the path depends on):

| Where | Container | What it pins |
|---|---|---|
| M11 | Ollama + a pinned model tag | the judge, so verdicts are identical across machines |
| M12 | optional MLflow backend (ClickHouse/Postgres) | the trace store behind the local UI |
| M13 | the CI job image | Python version, eval dependencies, `evallab` itself |

`labs/common/` ships a `docker-compose.yml` for the first, and the `doctor` command reports which of
the three are present so a learner on a machine that cannot run containers is told which lessons
are affected rather than hitting an error halfway through.

**Estimate:** 4 lessons, 5 lab files, 1 shared package.

---

## M12 · Tracing and observability (5 lessons)

**Purpose: see what the app actually did, before you can evaluate it.**

The plan's M12 is correct that OTel GenAI semantic conventions are the substrate. They are also
still a **"Development" status** spec, so this module is `volatility: implementation` throughout and
pins a version. Say that in the lesson.

| # | Lesson | Note |
|---|---|---|
| 12.1 | OpenTelemetry in twenty minutes | Enough to read a span tree, not enough to run a collector |
| 12.2 | The GenAI semantic conventions | `gen_ai.*` attributes: model, tokens, tool calls |
| 12.3 | Instrumenting the support bot by hand | The version you write yourself and therefore understand |
| 12.4 | Auto-instrumentation, and when to stop trusting it | Auto-instrumentation is a first draft, not a finished trace |
| 12.5 | Reading traces in MLflow: cost, latency, sessions, PII | **MLflow Tracing**, per the decision above |

**The one that should go wrong:** PII in a trace. A learner ships a trace containing customer data
to a backend they thought was private, and finds it in the span attributes. This is the failure that
makes the redaction lesson non-optional, and it is why **M12 comes before M13** — do not put a CI
job in front of an uninstrumented app.

**Scope boundary:** PII redaction and trace sampling are one lesson together, not two. Both are
"decide before it ships" topics.

---

## M13 · Regression suites in CI (4 lessons)

**Purpose:** make the gate run without a human, and keep it honest when it flakes.

| # | Lesson | Note |
|---|---|---|
| 13.1 | The suite in GitHub Actions | First run is red for a reason that is not the feature |
| 13.2 | Caching judge calls | Applies lesson 05.3's keying. The single biggest cost lever |
| 13.3 | Flaky evals: repeats, tolerances, quarantine | A gate that blocks 1 PR in 8 is a gate the team will disable |
| 13.4 | The eval budget, and the report on the PR | A per-PR cost ceiling, and a result a human can read in ten seconds |

**Shortest module in the path, on purpose.** 05.3 already taught the keying and 10.3 already taught
the two failure rates; M13 is the application.

**The one that should go wrong:** a developer pushes a real regression and the gate passes because
the tolerance is wide enough to hide it. The fix is not a tighter threshold — 10.3 established that
this trades against false alarms — it is more items on the failing slice.

---

## M14 · Online evals and monitoring (4 lessons)

**Purpose:** the eval set is always behind the product. This closes the loop.

| # | Lesson | Note |
|---|---|---|
| 14.1 | Sampling production traces | 100% sampling is unaffordable; the sample has to be unbiased |
| 14.2 | Guardrails versus evals | Block now, measure later — and why a guardrail is not an eval |
| 14.3 | Drift in the input mix, and the alert band | The band comes from the interval, not from a round number |
| 14.4 | Trace → labelled failure → new test case | The loop that makes the suite grow instead of rotting |

**The one that should go wrong:** the alert fires on day one because last week's traffic is not this
week's traffic, and the on-call engineer learns to ignore it. A monitor that cries wolf is worse
than no monitor, and 14.3 is where that is argued.

**Closing the arc:** 14.4 lands the course's argument in a loop — the failure you find in
production becomes a test case in the suite, which is the thing 02.1 was arguing for before any
number existed.

---

## M15 · Advanced topics (4 lessons, optional)

Explicitly optional and explicitly skippable. Its purpose is to answer "what is next" without
pretending to be essential.

| # | Lesson |
|---|---|
| 15.1 | Public benchmarks and contamination |
| 15.2 | Reward models, judges and verifiers — when to want which |
| 15.3 | Annotation at scale, and inter-annotator agreement as a design constraint |
| 15.4 | Evaluating a model migration: old vs new on the whole suite |

**15.4 is the one worth building first** if M15 is built at all. It is the most common real
production task and it uses only what the course already teaches.

**Deliberately not built here:** running `lm-evaluation-harness` on CPU. It is slow enough on a
laptop that it would break the course's "this is quick" promise, and the plan already links
`full-ml-engineer-course` M13 for it.

---

## Capstone — on the learner's own feature (resolved by Tal)

The learner takes **an LLM feature of their own**, ideally one they have already shipped, and carries
it through the whole loop: error analysis, a labelled dev/test set, at least one validated judge, an
instrumented app, a CI regression suite and a sampled online eval. The rubric below is unchanged
from `plan.md` §9.

| Criterion | "Meets the bar" |
|---|---|
| Error analysis | ≥ 50 traces open-coded; a counted taxonomy; the top failure chosen with a reason |
| Eval set | dev/test split by slice; sample size justified from an interval |
| Check selection | each top failure mapped to code, judge or human, with a reason |
| Judge validation | one binary judge with TPR/TNR and kappa on dev, one held-out validation, disagreements reviewed |
| Bias control | position/verbosity checked where relevant; repeats justified |
| Honest reporting | pass rates with intervals, corrected for judge error where a judge is used |
| Tracing | app instrumented with OTel GenAI attributes; cost and latency visible in MLflow |
| Regression suite | CI job with cached judge calls, a stated budget, and a gate that blocks a planted regression |
| Online loop | a sampled online judge and one new failure turned into a test case |
| Reproducibility | one command re-runs the suite to a stated tolerance |

**The consequence to plan around: this cannot be verified by us.** Nothing we ship can check
whether a capstone was done honestly, so the assessment has to be structured rather than graded.
Three things make that workable, and all three are already partly written:

1. **`templates/eval-design-review.md` is the deliverable.** It is written against exactly this
   rubric, and every row is a number with a sample size and a reason next to it. A capstone that is
   two pages of that sheet is checkable by a human reader even though we cannot run it.
2. **The portfolio framing is a feature, not a weakness.** A capstone on the learner's own codebase
   is the thing they put in front of a hiring manager or their team, and that is worth more than a
   marked exercise.
3. **The module quizzes still carry the objective grading.** All ten exist already, so the course's
   *assessed* content is unchanged — the capstone is the ungraded, self-directed piece.

`projects/capstone.md` is therefore written as a brief with a definition-of-done checklist rather
than as an assignment with a marking scheme. If you would rather have a gradable capstone later, the
cleanest way is a second one: the support bot from Modules 1–10, with a fixed dataset, which we
*could* verify. Worth considering once the path is built.

---

## Resolved questions — closed 2026-10-01

These were open when the plan was drafted. All three are now settled and folded into the text above.

1. **Does the Python path require a live model?** No — recorded data by default, Ollama optional.
2. **Docker?** Yes, kept, and used specifically to pin the judge, the trace store and the CI image.
3. **Capstone on the learner's own feature?** Yes. `templates/eval-design-review.md` is the
   deliverable, the module quizzes carry the objective grading, and a verified variant on the
   course's own support bot is available as a later addition if you want gradable work.

---

## What I would cut if this needs to shrink

In order, with reasons:

1. **M15 entirely.** Optional by design, and the material it covers has homes elsewhere.
2. **12.4 auto-instrumentation.** Convenient, but learners who hand-instrument in 12.3 can skip it
   and nothing later depends on it.
3. **14.1 as a standalone lesson.** It folds into 14.3 without loss.
4. **M13's 13.4 budget lesson.** A real gap, but one that can be a `templates/` sheet instead of a
   lesson without anyone noticing.

**Do not cut:** M12 in any form. Without tracing, M13 and M14 have nothing to read, and the course
teaches a loop that cannot be closed.

---

