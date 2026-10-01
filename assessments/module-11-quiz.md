# Module 11 quiz — Taking the suite to production

This quiz checks what changes when the eval leaves the browser tab: that a suite run from a shell has to
reproduce itself on a second machine before it is allowed to gate anything; that a port between two
languages is proved against generated fixtures with a tolerance written in advance, not eyeballed; that a
cache key and a pinned judge build are what stop a suite reporting numbers from a judge it never ran; and
that no framework hands you your judge's agreement with your humans, whatever its dashboard leads with.

Every question is a situation you will meet in your own work, not a definition. Four options, one correct.
**Pass mark: 70%** — seven of the ten questions. You can retake it; the questions do not change, so a
second attempt is worth taking only after you have re-read the lesson behind the one you got wrong.

What it covers, in the order the lessons build it:

- [11.1 · Your first eval run in Python](../lessons/module-11/lesson-01.md) — `doctor` as the first command on
  every machine, one report read field by field, and the knobs that move a pass rate without changing what
  is being measured.
- [11.2 · Porting the statistics, and proving they agree](../lessons/module-11/lesson-02.md) — closed-form
  statistics against `1e-9` and bootstrap intervals against no equality at all, the fixture generated from
  the reference engine, and the shape that does not throw and is entirely wrong.
- [11.3 · A judge through Ollama on your laptop](../lessons/module-11/lesson-03.md) — the nine components of the
  cache key, the one a container can pin, and what a judge that is no longer the same judge does to a suite
  that passed validation six weeks ago.
- [11.4 · Mapping the same suite onto a framework](../lessons/module-11/lesson-04.md) — what promptfoo, Inspect
  and DeepEval hand you and what they do not, and the difference between a framework's `expected_output`
  and a verdict a person reached.

Two reminders before you start. First, **no lesson in this course requires an API key or a model
download.** The default judge replays verdicts recorded at build time, and `doctor` says so in its output
before you install anything. Second, the lab behind these lessons carries an educational-model banner:
**the 94 support questions, the four answer variants, the human labels and every recorded verdict are
generated for teaching, and the judge names in the menu are labels runs are filed under rather than
published measurements of those models in the wild** — while every statistic computed from those verdicts is
computed for real, in Python, on your machine. The framework table in 11.4 is a reading of three projects'
documentation, not a benchmark of this course against them: nothing in this repository has been run against
promptfoo, Inspect, DeepEval or Ollama.