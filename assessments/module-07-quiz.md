# Module 7 quiz — Judge biases, models and cost

This quiz checks the five things Module 7 exists to install: that a pairwise run in one order cannot see its
own position bias, that a verbosity probe holds content fixed and changes only length, that a family prior and
a change in run-to-run noise look different on a dashboard and have to be told apart, that a judge-size
ladder on a normal eval set cannot be ranked, and that repeats narrow an interval rather than make a biased
judge honest.

Every question is a situation you will meet in your own work, not a definition. Four options, one correct.
**Pass mark: 70%** — seven of the ten questions. You can retake it; the questions do not change, so a second
attempt is worth taking only after you have re-read the lesson behind the one you got wrong.

What it covers, in the order the lessons build it:

- [07.1 · Position bias](lessons/module-07/lesson-01.md) — why a one-order pairwise run adds position to
  quality instead of separating them, the both-orders rule, the tie rate, and what doubling the calls buys.
- [07.2 · Verbosity bias](lessons/module-07/lesson-02.md) — the padding probe, why direction rather than
  size is what proves an effect, and why the biased judge reads *stricter* on short answers.
- [07.3 · Self-preference](lessons/module-07/lesson-03.md) — a judge kinder to its own family, the paired
  probe that isolates it, why the judge menu cannot, and the noise floor every bias reading has to clear.
- [07.4 · Judge size, agreement and cost](lessons/module-07/lesson-04.md) — a five-rung ladder that is not
  monotone, choosing against a target instead of a ranking, and spending a judge upgrade on eval items.
- [07.5 · Repeats, temperature and majority vote](lessons/module-07/lesson-05.md) — one greedy verdict as a
  single draw, where majority voting saturates, why four repeats is stricter than five, and what a
  1.00–1.00 interval actually means.

Two reminders before you start. First, the lab behind these lessons is unusual: **every judge verdict on
that page comes from a seeded educational model of judge behaviour, and every statistic is computed for real
in your browser from those recorded verdicts.** The model names in the judge menu — Qwen3, Llama 3.2 3B,
Flow-Judge, Prometheus — are the labels under which recorded runs are filed, never published benchmark
results for those models, and no number from these lessons should be quoted as one. Second, most of these
questions are about what you would *do* next: four of the ten ask you to tell a bias from a coincidence, and
that is the skill the whole module is built on.