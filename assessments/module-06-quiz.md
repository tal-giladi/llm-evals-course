# Module 6 quiz — Validating the judge

This quiz checks the five things Module 6 exists to install: that the human labels are part of the
instrument rather than a given, that TPR and TNR say what accuracy cannot, that kappa is the number you
can gate on and the disagreement list is the number you can act on, that the threshold knob is a
tuned parameter, and that a corrected pass rate has to be published with its denominator or not at
all.

Every question is a situation you will meet in your own work, not a definition. Four options, one
correct. **Pass mark: 70%** — seven of the nine questions. You can retake it; the questions do not
change, so a second attempt is worth taking only after you have re-read the lesson behind the one you
got wrong.

What it covers, in the order the lessons build it:

- [06.1 · Who writes the human labels](lessons/module-06/lesson-01.md) — who should label which
  failure category, why a spot-check of the biggest category verifies nothing about the judgement
  calls, and what measuring label agreement would take.
- [06.2 · TPR, TNR and the confusion matrix](lessons/module-06/lesson-02.md) — reading the matrix with
  humans as rows, which rate a gate is built on, and why accuracy rises as a judge gets less useful.
- [06.3 · Cohen's kappa and the disagreement review](lessons/module-06/lesson-03.md) — kappa by hand,
  the case where it stops being comparable between sets, and grouping 28 disagreements into a fix list.
- [06.4 · Thresholds and the probability-weighted score](lessons/module-06/lesson-04.md) — what the
  threshold actually trades, why the pass rate cannot pick it, and why more repeats is not a dial.
- [06.5 · Correcting a pass rate for judge error](lessons/module-06/lesson-05.md) — the Rogan–Gladen
  correction by hand, the vanishing denominator, and when the honest answer is not to correct.

Two reminders before you start. First, the lab behind these lessons is unusual: **every judge verdict on
that page comes from a seeded educational model of judge behaviour, and every statistic is computed
for real in your browser from those recorded verdicts.** The model names in the judge menu — Qwen3,
Llama 3.2 3B, Flow-Judge, Prometheus — are the labels under which recorded runs are filed, never
published benchmark results for those models. Second, these questions are about what you would *do* with
a number, because the arithmetic is the easy half; knowing when not to publish one is the rest.