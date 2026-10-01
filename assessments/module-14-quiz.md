# Module 14 quiz — The loop in production

This quiz checks what happens once an eval suite stops being a suite and becomes a monitor: sampling that
drops the volume and never the failures, with two numbers on the panel that estimate different things; a
guardrail separated from an eval by what it costs and what it can see, rather than by how strict it is;
a drift check on the input mix and an alert band derived from the width of the measurement rather than
from a round number; and the loop that turns a production trace into a labelled item the suite runs.

Every question is a situation you will meet in your own work, not a definition. Four options, one correct.
**Pass mark: 70%** — seven of the ten questions. You can retake it; the questions do not change, so a
second attempt is worth taking only after you have re-read the lesson behind the one you got wrong.

What it covers, in the order the lessons build it:

- [14.1 · Sampling production traces](../lessons/module-14/lesson-01.md) — deciding the outcome before
  sampling, hashing the request id instead of flipping a coin, and why a rate over a set selected for its
  failures rises while the failure count stays exactly where it was.
- [14.2 · Guardrails versus evals](../lessons/module-14/lesson-02.md) — the same 57 requests scored both ways
  against the human labels, the cross-tab and the two denominators, the categories no check was written
  for, and the question you have to answer in writing before a boolean goes in the request path.
- [14.3 · Drift in the input mix, and the alert band](../lessons/module-14/lesson-03.md) — PSI against a dated
  baseline, the decomposition of this course's own 0.762, and the band you derive from a Wilson half-width
  at the sample size you actually have.
- [14.4 · Trace, labelled failure, new test case](../lessons/module-14/lesson-04.md) — where `error.type`
  actually lives, why an empty list from a monitoring loop is the worst possible return value, and the one
  field in a test case nothing computes for you.

Two reminders before you start. First, **nothing here is a measurement of a named production system.** The
failures in 14.1 and 14.4 are planted at a known rate, the judge is the course's shipped educational
model, and 14.3's counts are arithmetic over this dataset's own items — the 0.762 is the distance between
two halves of a 94-item teaching set, and the false-alarm and catch rates are exact binomial
probabilities for a stated `n`, a stated baseline and a stated band. What transfers is the method and the
two denominators, not the number. Second, the spine of the module is that **a number is only a measurement
of the population it was computed over** — over traffic, over the kept sample, over a set selected for its
failures, or over the baseline mix your calendar still looks like. Most of the questions below are about
naming that population correctly, which is why several tempting options are perfectly good arithmetic
attached to the wrong denominator.