# Glossary

Each term links to the lesson that introduces it.

## A

- **Abstention** — saying "the handbook does not cover this" instead of inventing an answer.
  [Lesson 8.3](lessons/module-08/lesson-03.md)
- **Agreement** — how far a judge's verdicts match human labels on the same items.
  [Lesson 6.2](lessons/module-06/lesson-02.md)
- **Axial coding** — grouping open-coded notes into categories and counting them.
  [Lesson 2.3](lessons/module-02/lesson-03.md)

## C

- **Cache key** — the set of inputs a stored judge verdict is tied to. Change one of them and the
  verdict is no longer reusable, which is what stops a cache returning a result for a prompt you
  never ran. [Lesson 5.3](lessons/module-05/lesson-03.md), [module 11](lessons/module-11/lesson-03.md)
- **Chances-corrected agreement** — agreement with what a coin guessing the majority class would have
  scored removed. This is what Cohen's kappa corrects for. [Lesson 6.3](lessons/module-06/lesson-03.md)
- **Cohen's kappa** (κ) — chance-corrected agreement between two raters or a judge and a human.
  [Lesson 6.3](lessons/module-06/lesson-03.md)
- **Corrected pass rate** — an observed pass rate adjusted for the judge's measured false-alarm and
  miss rates. [Lesson 6.5](lessons/module-06/lesson-05.md)
- **Cut-off point** — any single answer a judge produces that is difficult or expensive to reproduce.

## D

- **Dev set** — the items you tune judge prompts and thresholds against. Tuning on the test set turns
  the test set into a dev set. [Lesson 4.2](lessons/module-04/lesson-02.md)
- **Distribution shift** — production inputs drifting away from the ones in your eval set.
  [Lesson 10.3](lessons/module-10/lesson-03.md)

## E

- **End-state scoring** — grading an agent run only on the result it reached, ignoring how it got there.
  [Lesson 9.1](lessons/module-09/lesson-01.md)
- **Error analysis** — reading outputs, naming failures in your own words, and counting them, before
  writing any metric. [Lesson 2.1](lessons/module-02/lesson-01.md)
- **evallab** — the Python package the production path uses, in `labs/common/`. Its statistics are a
  port of the browser engine's, and a parity test keeps the two honest.
  [Lesson 11.1](lessons/module-11/lesson-01.md)
- **Eval set** — the fixed set of items with known answers used to measure a system.
  [Lesson 4.1](lessons/module-04/lesson-01.md)

## F

- **False alarm** — the judge says pass when humans say fail. The error that matters most for a gate.
  [Lesson 6.2](lessons/module-06/lesson-02.md)
- **Few-shot examples** — worked examples in the judge prompt showing what pass and fail look like.
  [Lesson 5.4](lessons/module-05/lesson-04.md)

## G

- **Grounding** — every claim in an answer traces to a supplied passage.
  [Lesson 8.2](lessons/module-08/lesson-02.md)
- **Ground truth** — labels treated as correct because people produced them, not because a model did.
  [Lesson 6.1](lessons/module-06/lesson-01.md)

## H

- **Held-out test set** — items kept back and looked at once, at the end, to check you did not overfit
  your dev set. [Lesson 4.2](lessons/module-04/lesson-02.md)

## L

- **LLM-as-judge** — using a language model to grade another model's output.
  [Lesson 5.1](lessons/module-05/lesson-01.md)

## M

- **Majority vote** — running the judge several times at temperature and taking the majority verdict,
  to stabilise it. [Lesson 7.5](lessons/module-07/lesson-05.md)
- **Miss** — the judge says fail when humans say pass.

## N

- **Null hypothesis** — the default assumption that two systems are identical until the data makes that
  hard to believe. [Lesson 10.2](lessons/module-10/lesson-02.md)

## O

- **Open coding** — writing a note about a failure in your own words, before naming it.
  [Lesson 2.2](lessons/module-02/lesson-02.md)
- **Over-refusal** — refusing a question the system should have answered.
  [Lesson 8.3](lessons/module-08/lesson-03.md)

## P

- **Paired comparison** — comparing two systems on the *same* items so item difficulty cancels out.
  [Lesson 10.1](lessons/module-10/lesson-01.md)
- **Parity test** — a test that runs the same computation in two implementations and fails when they
  disagree. The whole cost of porting a statistic is this test; without it a port is a guess.
  [Lesson 11.2](lessons/module-11/lesson-02.md)
- **Pass rate** — the share of items a check marked as passing. Meaningless without its sample size and
  its agreement with humans. [Lesson 1.1](lessons/module-01/lesson-01.md)
- **Position bias** — an LLM judge favouring whichever answer it read first.
  [Lesson 7.1](lessons/module-07/lesson-01.md)
- **Prevalence** — the share of items in a set that a check should pass. Accuracy depends on it heavily;
  kappa does not. [Lesson 6.2](lessons/module-06/lesson-02.md)
- **Probability-weighted verdict** — deriving a verdict from the share of repeated samples that said
  pass, so the threshold becomes a knob. [Lesson 6.4](lessons/module-06/lesson-04.md)

## R

- **Release gate** — an automatic check that blocks a change. Every gate has a false alarm rate and a
  missed regression rate. [Lesson 10.3](lessons/module-10/lesson-03.md)
- **Rogan–Gladen estimator** — the standard formula for correcting a pass rate for known judge error.
  [Lesson 6.5](lessons/module-06/lesson-05.md)
- **Rubric** — the explicit criteria a judge grades against. [Lesson 5.3](lessons/module-05/lesson-03.md)

## S

- **Self-preference** — a judge being kinder to output written by the same model family it is.
  [Lesson 7.3](lessons/module-07/lesson-03.md)
- **Slice** — a subgroup of your eval items, such as one intent or difficulty, that can be measured
  separately. [Lesson 4.3](lessons/module-04/lesson-03.md)
- **Stratification** — sampling so every slice keeps its proportion, instead of letting rare slices
  disappear at random. [Lesson 4.3](lessons/module-04/lesson-03.md)
- **Success criteria** — the decidable statement of what "good" means for one feature.
  [Lesson 1.2](lessons/module-01/lesson-02.md)
- **Swap consistency** — whether a pairwise judge gives the same verdict when the two answers are
  swapped. [Lesson 7.1](lessons/module-07/lesson-01.md)

## T

- **Test set** — see *held-out test set*. [Lesson 4.2](lessons/module-04/lesson-02.md)
- **Trace** — the record of everything one request did: retrieval, tool calls, model calls, tokens, cost.
  [Lesson 2.1](lessons/module-02/lesson-01.md)
- **Trajectory scoring** — grading an agent run on the steps it took, not just the state it reached.
  [Lesson 9.1](lessons/module-09/lesson-01.md)
- **True negative rate** (TNR) — of the items humans failed, the share the judge also failed.
  [Lesson 6.2](lessons/module-06/lesson-02.md)
- **True positive rate** (TPR) — of the items humans passed, the share the judge also passed.
  [Lesson 6.2](lessons/module-06/lesson-02.md)

## V

- **Validation** — using the held-out test set once, at the end, to check the judge generalises.
  [Lesson 4.2](lessons/module-04/lesson-02.md)
- **Verbosity bias** — an LLM judge rewarding longer answers regardless of content.
  [Lesson 7.2](lessons/module-07/lesson-02.md)

## W

- **Wilson score interval** — the confidence interval used throughout this course for a proportion. It
  stays inside 0–100% and behaves sensibly on small samples, which the normal approximation does not.
  [Lesson 4.4](lessons/module-04/lesson-04.md)