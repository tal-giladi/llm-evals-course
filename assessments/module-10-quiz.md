# Module 10 quiz — Comparing systems and release gates

This quiz checks the last thing the fundamentals path installs: that you can look at two systems measured on
the same items and say what changed, how sure you are, and which items to look at; that you know what a
p-value is and is not; and that you can write a release gate as **two named failure rates** rather than one
threshold somebody picked by feel.

Every question is a situation you will meet in your own work, not a definition. Four options, one correct.
**Pass mark: 70%** — seven of the nine questions. You can retake it; the questions do not change, so a
second attempt is worth taking only after you have re-read the lesson behind the one you got wrong.

What it covers, in the order the lessons build it:

- [10.1 · A/B on the same items](lessons/module-10/lesson-01.md) — why the flip list is the result and the
  difference is its summary, what the interval and the sign test each answer, and why a signed number needs
  its orientation stated.
- [10.2 · Paired versus unpaired](lessons/module-10/lesson-02.md) — what pairing actually removes, when the
  textbook version of that claim is wrong, and what a single unpaired split really is.
- [10.3 · Setting a gate under noise](lessons/module-10/lesson-03.md) — the two failure modes every gate has,
  the width a threshold has to be read against, and how to tell in a minute whether a gate simulator's two
  numbers are two measurements.
- [10.4 · Slices as their own gates](lessons/module-10/lesson-04.md) — why an overall rate cannot see a
  caution regression, how to size a slice threshold, and what to publish when a slice reports zero.

Two reminders before you start. First, the lab behind these lessons is unusual: **the 94 support questions,
the four answer variants and the human labels are all generated for teaching, and every verdict on the page
comes from a seeded educational model of judge behaviour — but every statistic is computed for real in your
browser from those recorded verdicts.** The variant names are labels recorded runs are filed under, never
published benchmark results, and no number from these lessons should be quoted as a measurement of a named
support bot in the wild. Second, four of the nine questions ask you what a *missing* number means — an
absent null, an absent denominator, a knob that does not move, a label set that is not there. Those are the
questions that separate a dashboard from a measurement.