# Course details — not imported

Used to register the course in the Academy and fill the Admin form.

- **Suggested slug:** `llm-evals`
- **GitHub repo:** `tal-giladi/llm-evals-course` (public, unless Tal decides otherwise)
- **Free or paid:** suggest **free**. The whole fundamentals path runs on a browser with no paid model.
  Recommend keeping it free even when the production path is added, to match the other lab courses.
- **Risk notice:** none. No physical, legal, security or health risk. The production path asks learners
  to run containers against their own machine only.

## One-line summary

Evaluate and observe LLM applications by experiment: build an eval set, write and validate an LLM
judge, compare two systems with a paired test, and set a release gate that catches real regressions.

## Who it is for

Software developers who have shipped or prototyped an LLM feature — a chatbot, a RAG app, an agent, an
extraction pipeline — and now change prompts or models by feel, cannot tell whether a change helped,
and do not trust the scores an LLM judge gives them.

## Format

Markdown lessons with embedded interactive simulations (tier A, static, no install) plus a module quiz
after each module. 10 modules, 43 lessons, about 14–18 hours for the fundamentals path.

## Prerequisites

- Python basics are helpful but **not required** for Modules 1–10.
- HTTP and JSON literacy.
- Git.
- Having called an LLM API at least once.
- **Not assumed:** ML background, statistics beyond averages and percentages, any eval or tracing tool,
  Docker.

## What you will learn

- Run error analysis: read traces, open-code failures, group them into a counted taxonomy.
- Choose code, a reference metric, an LLM judge or a human per failure category, with a stated reason.
- Size an eval set from a confidence interval rather than from habit.
- Write a binary LLM judge and validate it with TPR, TNR, accuracy and Cohen's kappa.
- Detect and correct position, verbosity and self-preference bias in a judge.
- Correct a pass rate for measured judge error and report it with an interval.
- Evaluate RAG answers for grounding and abstention, and agents for end state and trajectory.
- Compare two systems on the same items and set a release gate under noise.