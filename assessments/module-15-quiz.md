# Module 15 quiz — The advanced module

This is the optional module, and the quiz is written so that the four lessons on their own are enough
to pass it. Nothing here needs a benchmark result, a model, or anything you have not already read in
modules 1 to 14. What the module adds is the four places where the loop you have built so far has to
be held to a stricter standard: what a public score is and is not evidence for, which scorer you
reach for when a property is decidable and which when it is not, what an agreement figure actually
measures, and how to run the migration that keeps arriving on a Tuesday.

Every question is a situation rather than a definition — four options, one defensible, and in most
cases three that a reader who skimmed will find reasonable. **Pass mark: 70%** — seven of the ten
questions, or six of the nine. You can retake it, and the questions do not change, so a second
attempt is only worth taking after re-reading the lesson behind the one you got wrong.

What it covers, in the order the lessons build it:

- [15.1 · Public benchmarks and contamination](../lessons/module-15/lesson-01.md) — the one line in
  CI that catches the only contamination you can catch yourself, the sixteen-judge selection table
  and why its top rows are the ones most in need of a held-out run, and the `exception` slice that
  has three items on dev and none on test.
- [15.2 · Reward models, judges and verifiers](../lessons/module-15/lesson-02.md) — the decidability
  test, a three-line citation verifier measured against the same labels as a judge on all six
  variant-and-split cells, and the coverage table whose `missed by both` column is zero everywhere.
- [15.3 · Annotation at scale, and inter-annotator agreement](../lessons/module-15/lesson-03.md) —
  one model, one item set, one answer set and five sets of instructions producing disagreement from
  0.0% to 21.1%, the interval that makes `0.894` a weaker claim than it looks, and the queue size
  that rate implies at 600 items.
- [15.4 · Evaluating a model migration](../lessons/module-15/lesson-04.md) — the argument order that
  turns the worst run in the dataset into a ship-it story, the same change blocking on dev and
  passing held-out, the cache key that invalidates itself, and the slice table the decision
  actually lives in.

One reminder before you start, and several of the questions turn on it. **Nothing in this module is a
published benchmark result, and no benchmark was run.** The shipped educational model is not an LLM;
the judge verdicts are a seeded recording, and where a number looks too good — five judge
configurations at kappa 1.000 on a held-out split, a coverage table with a zero in its last column,
a latency figure identical to three decimals across two model builds — the lesson says what the
number is about. So the options that recite a headline are the traps here, not the answers. What
transfers out of the module is the method: hold everything else still and change one thing, report
the held-out number next to the selected one, and name the set the decision has to be made on.
