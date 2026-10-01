# Module 5 quiz — Designing an LLM judge

This quiz checks the five things Module 5 exists to install: that a judge answers exactly one question,
that binary is the scale a gate can be built on, that a rubric earns its place by naming clauses real
answers violate, that few-shot examples buy stability rather than accuracy, and that a recorded verdict
belongs to an exact key that one character of editing changes.

Every question is a situation you will meet in your own work, not a definition. Four options, one
correct. **Pass mark: 70%** — seven of the nine questions. You can retake it; the questions do not
change, so a second attempt is worth taking only after you have re-read the lesson behind the one you got
wrong.

What it covers, in the order the lessons build it:

- [05.1 · One failure per judge, binary first](lessons/module-05/lesson-01.md) — one question per taxonomy
  row, why a judge asked "is this good?" produces four coins instead of a decision, and what four
  per-category judges cost.
- [05.2 · Binary, Likert and pairwise](lessons/module-05/lesson-02.md) — what each scale can answer, why a
  graded score still collapses to a line you have to write down, and the swap test that makes position
  bias visible.
- [05.3 · Rubrics that decide something](lessons/module-05/lesson-03.md) — the four prompt texts the lab
  ships, the test that separates a clause from a restatement, the rule-to-category mapping, and the
  refusal to show you another prompt's numbers.
- [05.4 · Few-shot examples](lessons/module-05/lesson-04.md) — how many, which ones, and why an exemplar
  set is a rubric clause you did not write down.
- [05.5 · Verdict-first or critique-first](lessons/module-05/lesson-05.md) — what a recorded reason buys,
  what it costs, and why the critique is the fastest route into Module 6's disagreement review.

Two reminders before you start. First, the lab behind these lessons is unusual: **every judge verdict on
that page comes from a seeded educational model of judge behaviour, and every statistic is computed for
real in your browser from those recorded verdicts.** The model names in the judge menu — Qwen3, Llama
3.2 3B, Flow-Judge, Prometheus — are the labels under which recorded runs are filed, never published
benchmark results for those models. Second, most of these questions are about what you would *do* next,
because the arithmetic is the easy half; the discipline is not.