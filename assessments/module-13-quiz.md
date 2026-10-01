# Module 13 quiz — Gating the suite in CI

This quiz checks what it takes for a suite that runs to become a suite that gates: a gate that decides on a
point estimate and reports the interval beside it rather than obeying it, because the interval is the width
of the measurement and not the decision; a drop counted in passes rather than in edits; a judge cache keyed
on every input a verdict depends on, with the misses printed; repeats, a tolerance and a quarantine list
each priced before it is used; and a per-run ceiling plus a six-line comment somebody can read in ten
seconds.

Every question is a situation you will meet in your own work, not a definition. Four options, one correct.
**Pass mark: 70%** — seven of the ten questions. You can retake it; the questions do not change, so a
second attempt is worth taking only after you have re-read the lesson behind the one you got wrong.

What it covers, in the order the lessons build it:

- [13.1 · The suite in GitHub Actions](../lessons/module-13/lesson-01.md) — the five things a runner decides
  for you, `run_gate`'s three outcomes and the one a two-state CI check cannot express, the two bugs the
  function shipped with, and why a drop is measured in passes.
- [13.2 · Caching judge calls](../lessons/module-13/lesson-02.md) — the nine fields in the cache key, the one
  that does not look like a correctness field, the only observable symptom of a key that is too loose, and
  why the hit rate is a property of your development pattern.
- [13.3 · Flaky evals: repeats, tolerances, quarantine](../lessons/module-13/lesson-03.md) — the judge's rate
  of disagreement with itself, the three tools in the order you should reach for them, the honest limit
  where a widened tolerance and a hidden regression print the same line, and what a quarantine entry has to
  carry.
- [13.4 · The eval budget, and the report on the pull request](../lessons/module-13/lesson-04.md) — two
  ceilings in two currencies, the two orderings that make a ceiling mean anything, and the six lines of a
  pull-request comment.

Two reminders before you start. First, **the judge verdicts behind every number here are the course's
shipped educational model** — a recorded run filed under a judge id, not a measurement of any named model
in the wild — and the price per call is a teaching figure chosen so the arithmetic checks. What travels is
the shape: `items × repeats × price`, and the ratio between a cached and an uncached run. Second, two of
`run_gate`'s three outcomes exist because **"not blocked" and "fine" are different claims**: a real drop
inside a tolerance the team chose is neither a regression to be blocked nor a clean pass, and several
questions here are about what a workflow is allowed to do with that third sentence.