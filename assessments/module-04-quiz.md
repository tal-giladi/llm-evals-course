# Module 4 quiz — Building the eval set

This quiz checks the four things Module 4 exists to install: that failure categories turn into
written test cases rather than a proportional slice of traffic, that the test set is read once and
that tuning on it destroys it, that a slice with no failing items contributes nothing to the rate you
are about to quote, and that a sample size is chosen from the interval rather than from habit.

Every question is a situation you will meet in your own work, not a definition. Four options, one
correct. **Pass mark: 70%** — seven of the ten questions. You can retake it; the questions do not
change, so a second attempt is worth taking only after you have re-read the lesson behind the one you
got wrong.

What it covers, in the order the lessons build it:

- [04.1 · From taxonomy to test cases](lessons/module-04/lesson-01.md) — the failure clause on every
  item, why `out_of_scope` takes 2 of 2 while `no_citation` takes 12 of 27, and the interval a
  category with two examples can support.
- [04.2 · Dev, test, and the one-validation rule](lessons/module-04/lesson-02.md) — what a legitimate
  split balances and what it deliberately does not, and why "keep whichever prompt read higher on
  test" measures the search rather than the system.
- [04.3 · Stratification and slices](lessons/module-04/lesson-03.md) — the `none seen` row, why a
  slice with zero failures is worse than a slice with zero items, and why keeping the slice mix does
  not produce the failures.
- [04.4 · Sample size and confidence intervals](lessons/module-04/lesson-04.md) — the Wilson interval
  worked out by hand, why the width only halves when you quadruple the sample, and how to say out
  loud what resolution your set actually has.

Two reminders before you start. First, the lab behind these lessons is unusual: **there is no model
call at all**. Every number is sampling and arithmetic computed in your browser from 94 generated
support items with recorded human labels, so the intervals are real computations on modelled data and
never measurements of a named system in the wild. Second, most of these questions are about what you
would *write down* next, because that is the part of an eval set that either survives contact with a
real team or quietly does not.