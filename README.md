# Eval Lab: LLM Evals & Observability by Experiment

Learn to evaluate and observe LLM applications by experimenting with them. For software developers with
no ML or statistics background. Every lesson turns one knob — a judge prompt, a rubric, a threshold, a
sample size, an answer order — in a browser lab and shows what changed.

There are two paths. The **fundamentals path** (Modules 1–10) needs nothing but a modern browser: no
Python, no Docker, no API key, no paid model, about 14–18 hours. The **production path** takes the same
experiments into Python, OpenTelemetry and CI on a CPU-only laptop.

## What you will learn

- Read traces and turn them into a counted failure taxonomy before writing a single metric.
- Choose the right check per failure — code assertion, reference metric, LLM judge, or human review — and say why.
- Build an eval set with a dev/test split and a sample size chosen from a confidence interval.
- Write an LLM judge and validate it against human labels with TPR, TNR, Cohen's kappa and a disagreement review.
- Recognise and correct judge biases: position, verbosity, self-preference.
- Correct a measured pass rate for known judge error and report it with an interval.
- Compare two systems with a paired test and set a release gate that balances false alarms against missed regressions.

## How the course is built

Every lesson follows one loop: **look at a failure → predict what the knob will do → turn the knob →
read the scoreboard → explain why it moved**. The labs are static web pages. Everything expensive was
computed before you arrived; everything you turn is computed in your browser, so a knob change is
instant and the statistics are real rather than screenshots.

> **Educational model.** The judge runs in these labs come from a seeded model of judge behaviour, not
> from a real LLM. Every statistic on every page is computed for real, in your browser, from those
> recorded verdicts. Swapping in genuine recordings replaces data files, not code.

Start with [the device check](simulations/device-check/index.html), then Module 1.