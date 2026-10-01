---
id: "06.4"
module: 6
minutes: 17
practice_minutes: 45
prerequisites: ["06.3"]
objectives:
  - Build a probability-weighted judge score out of repeated verdicts and explain what the threshold knob changes about it.
  - Read a threshold sweep as a trade between false alarms and missed faults, and say which of the two you can afford.
  - Choose the repeats and the threshold on dev and check once on the held-out half, naming the cost of the whole thing.
volatility: concept
sources:
  - title: "Logprobs for evaluation (OpenAI Cookbook)"
    url: https://developers.openai.com/cookbook/examples/using_logprobs
  - title: "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (Zheng et al., 2023)"
    url: https://arxiv.org/abs/2306.05685
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 06.4 · Thresholds and the probability-weighted score

A judge asked once gives you one sample of a distribution, and half the time on this dataset that
sample is the wrong answer. Repeating the question costs money; thresholding the repeats costs
nothing, and it is the cheapest quality improvement in this module.

## Why it matters

The nightly job grades 57 items with `Llama 3.2 3B · Rubric · 0 shots` and puts the pass rate on the
dashboard. Nothing is wrong on any given night. The problem is that the number is a **single sample of
a wobbling process**, and the wobble is not small. On the 94 items of the handbook-tuned system, this
judge does not return the same verdict five times on **50 of them** — 27 items pass all five samples, 17
fail all five, and the remaining 50 split somewhere in between. Take one sample and you are reading a
coin weighted about half and half on half your eval set.

The consequences are concrete. Two runs of an unchanged system, an unchanged prompt and an unchanged
set produce different pass rates, and the difference shows up in a dashboard as a change. Somebody
investigates. Nothing is there. Meanwhile a real regression of the same size is invisible, because it
looks exactly like the wobble.

[6.3](lesson-03.md) found the shape of the problem by reading items: **all 9 missed faults across both
of that module's judges begin with a fail sample**, and the other four samples say pass. That is not a
prompt defect and you cannot fix it in the rubric. It is a defect in *how the verdict is taken*, and it
has a fix that costs one extra model call and a knob.

## How it works

### The score is a share, not a bit

Ask the judge the same question $k$ times at temperature. The **probability-weighted score** is the
share of those samples that said pass:

$$s = \frac{\#\text{samples that said PASS}}{k} \in \left[0, \tfrac{1}{k}, \tfrac{2}{k}, \ldots, 1\right]$$

and the verdict is a threshold on that score:

$$\text{verdict} = \begin{cases} \text{PASS} & s \geq t \\ \text{FAIL} & s < t \end{cases}$$

Two things follow immediately, and both are worth internalising:

- **With $k = 1$ the score is only ever 0 or 1**, so the threshold is either "pass everything" or "fail
  everything" and there is no operating point between them. The page says this in the hint under the
  knob, and the code says it more firmly: at one repeat the threshold is bypassed entirely and the
  first sample is the verdict.
- **With $k$ repeats there are only $k+1$ distinct scores.** At five repeats the knob moves in steps of
  0.05 over twenty positions and several of them are the same operating point. On the dev half,
  **0.05 and 0.20 produce an identical confusion matrix** (one pass out of five is enough), **0.50 and
  0.60 are identical** (three out of five), and **0.95 and 1.00 are identical** (five out of five).
  A knob with duplicate positions is not a knob; it is a menu, and the menu has six items.

### The sweep, and what the knob trades

`Llama 3.2 3B · Rubric · 0 shots`, variant A, **all 94 items, 5 recorded samples per item**, moving
the threshold with nothing else touched:

| Threshold | `tp` | `fp` | `fn` | `tn` | Kappa (95%) | TPR | TNR | Judge pass rate |
|---|---|---|---|---|---|---|---|---|
| 0.00 | 47 | 47 | 0 | 0 | 0.00 (0.00–0.00) | 100.0% | **0.0%** | 100.0% |
| 0.20 | 47 | 30 | 0 | 17 | 0.36 (0.23–0.51) | 100.0% | 36.2% | 81.9% |
| 0.40 | 47 | 13 | 0 | 34 | 0.72 (0.58–0.86) | 100.0% | 72.3% | 63.8% |
| **0.50** | 47 | **3** | **0** | 44 | **0.94** (0.85–1.00) | 100.0% | 93.6% | 53.2% |
| 0.60 | 47 | 3 | 0 | 44 | 0.94 (0.85–1.00) | 100.0% | 93.6% | 53.2% |
| 0.80 | 44 | 0 | 3 | 47 | 0.94 (0.85–1.00) | 93.6% | 100.0% | 46.8% |
| 1.00 | 27 | 0 | **20** | 47 | 0.57 (0.42–0.72) | 57.4% | 100.0% | 28.7% |

The humans passed 47 of those 94, so the human pass rate is **50.0%**. Read the four rows the sweep
argues about:

- At **0.00** the judge passes everything. TNR is **0.0%** — it has no failure direction at all. This
  is the degenerate "check" from [6.2](lesson-02.md), and the threshold at the far left is how you get
  one by accident.
- At **0.20** you have removed every missed fault — `fn` is 0 — and paid for it with **30 false
  alarms**. An engineer reads 30 answers per night and none of them were broken.
- At **1.00** you have removed every false alarm and paid with **20 missed faults**. The judge now fails
  a fifth of the good answers, TPR has collapsed to 57.4%, and the faults ship.
- At **0.50** you have **3 false alarms and 0 missed faults**, and kappa is **0.94**.

That last row is the whole point of the panel: the threshold moved the judge's kappa from 0.36 to 0.94
without a single word of the prompt changing, and it did it by moving **which kind of mistake you
accept** rather than by making the judge smarter.

### Why kappa, not the pass rate, picks the threshold

Look at the pass rate column next to the humans' 50.0%. At threshold 0.80 the judge reads **46.8%** —
the number in the whole sweep closest to what the humans said. If you chose the threshold by making the
pass rate look like the human pass rate, you would choose 0.80, and you would have chosen a judge with
kappa **0.94** *and 3 missed faults* over one with kappa **0.94** and none.

The pass rate cannot express that trade, because a pass rate is one number and the trade is two
directions. Kappa can, at least partially, because it is computed against the humans and not against
your intuition about what a good number looks like. Where two thresholds tie on kappa — 0.50 and 0.80
both read 0.94 here — the tie-break is which direction you can afford to be wrong in, and that is a
question about your team, not about the data. A team that reads ten items a night should buy the 0
missed faults. A team shipping an unreviewed answer to an employment question should buy the 0 false
alarms.

### Repeats are not a dial either

Set the threshold to 0.50 and move only the **Repeats** knob, on all 57 dev items with the rubric
judge:

| Repeats | `tp` | `fp` | `fn` | `tn` | Kappa (95%) | Cost of the run |
|---|---|---|---|---|---|---|
| 1 | 29 | 5 | 1 | 22 | 0.79 (0.60–0.93) | $2.1626 |
| 2 | 30 | 10 | 0 | 17 | **0.64** (0.45–0.83) | $4.3252 |
| 3 | 29 | 3 | 1 | 24 | 0.86 (0.72–0.96) | $6.4877 |
| 4 | 30 | 6 | 0 | 21 | **0.79** (0.62–0.93) | $8.6503 |
| 5 | 30 | 3 | 0 | 24 | 0.89 (0.76–1.00) | $10.8129 |

Four repeats is worth less than three, and five is worth barely more than one. At two repeats the
threshold of 0.50 means "at least one of two said pass", which is the most generous possible operating
point, and the false alarms jump from 5 to 10. The ladder is not a dial because each repeat re-rolls
the whole comparison; what you are buying is a better estimate of a per-item probability, and that
estimate gets better smoothly while the **verdict** it produces jumps around. Pick the repeat count
and the threshold together, on dev, and expect the pair you choose to matter more than either alone.

## Show me

This lesson's preset opens the lab on `Llama 3.2 3B · Rubric · 0 shots`, variant A, **40 dev items at
seed 7**, with **Repeats at 1**. Do this in order:

1. **Set Repeats to 5 first.** Watch the confusion matrix not change at all — the threshold is
   bypassed at one repeat, and that is the knob doing nothing in front of you. Then move the threshold
   to 0.20: the matrix changes immediately.
2. **Sweep the threshold on those 40 items** and record kappa, TPR, TNR and the pass rate at 0.20, 0.50,
   0.80 and 1.00. You should read, at 0.50, `tp 24, fp 1, fn 0, tn 15` with kappa **0.95**
   (0.83–1.00), TPR 100.0%, TNR 93.8%, pass rate **62.5%** (47.0%–75.8%). At 0.20 you read kappa
   **0.35** with TNR 31.3%. At 1.00, kappa **0.66** with TPR 70.8% and 7 missed faults.
3. **Find the duplicate positions yourself.** Move the knob to 0.05, then 0.10, then 0.15, then 0.20.
   The numbers do not move. Do the same across 0.50 to 0.60, and again from 0.95 to 1.00. Six distinct
   operating points, twenty knob positions.
4. **Set Repeats to 3, then 4, then 5, holding the threshold at 0.50**, and write the cost each time
   from the table under the confusion matrix: 540 ms and $0.03794 a call, so 40 items is $1.5176 per
   repeat. Five repeats is **$7.5880** for the same 40 items and $10.8129 for the full 57-item dev half.
5. **Press Validate on test** and repeat step 2 on the held-out 37 items. At the same 0.50 threshold the
   rubric judge reads `tp 17, fp 0, fn 0, tn 20` and kappa **1.00** (1.00–1.00). Move it to 0.95 and the
   same 37 items read kappa **0.37** (0.13–0.63) with **11** missed faults.

> [!NOTE]
> The five recorded samples per item come from a seeded educational model of judge behaviour, not from
> a live LLM, and the model names in the Judge menu are the labels runs are filed under. Every matrix,
> rate, interval and dollar figure on the page is computed in your browser from those recorded samples.

## Try it

**Predict first**, on paper:

1. With 5 repeats, what is the coarsest threshold you can set that is not identical to 0.05? Now with
   3 repeats — what does the same question give?
2. A judge at threshold 0.20 reads a 81.9% pass rate against a human pass rate of 50.0%. Is it
   plausible that this judge is useless? Answer with the false-alarm count, not the pass rate.
3. More repeats should make agreement better. Look at the ladder in **How it works** and predict which
   of 2, 3 and 4 repeats scores worst.

[Simulation: judge-lab](../../simulations/judge-lab/index.html?preset=threshold)

1. **Set Repeats to 5 and sweep the threshold across the whole range**, recording kappa, TPR, TNR and
   the pass rate at 0.00, 0.20, 0.40, 0.50, 0.60, 0.80, 0.95 and 1.00. Then work out which two of those
   positions are the same operating point as 0.50, and prove it by reading the confusion matrix rather
   than by trusting the tiles.
2. **Do the pass-rate trap on purpose.** Find the threshold whose pass rate is closest to the humans'
   50.0%. On the full 94 that is 0.80 at 46.8%. Now count its missed faults — 3 — and its neighbour at
   0.50 — 0 — with the same kappa. Write the sentence that explains why you are not choosing 0.80.
3. **Price the knob.** Hold 57 dev items and move Repeats from 1 to 5 at threshold 0.50, writing the
   cost of each run: $2.1626, $4.3252, $6.4877, $8.6503, $10.8129. Now decide what a nightly job should
   spend, and say which of those five runs you would put on a dashboard.
4. **Break the same judge with repeats instead of thresholds.** Switch the Judge dropdown to
   `Llama 3.2 3B · Plain · 0 shots` and sweep again. At 0.50 and 5 repeats it reads kappa **0.47** on
   these 40 items with TNR 44.4%; at 0.20, kappa **0.06**. Compare that with the rubric judge's row and
   say what the threshold can and cannot repair.
5. **Check the threshold on the half you did not tune on.** Press **Validate on test**, then repeat the
   sweep on the 37 held-out items. Write down the threshold you would have chosen on dev and the
   threshold that looks best on test, and say what the difference between those two sentences means for
   your process.

## Break it

**Choose the threshold by matching the pass rate.** The pass rate is the number everybody recognises
and the humans' rate is known, so aligning them feels like calibration. On the full 94 the closest
match is threshold 0.80 at 46.8% against a human 50.0%, and that judge misses 3 real faults where the
0.50 judge misses none at the same kappa. The lie: **a pass rate is the quantity you are trying to
estimate, so you cannot use it to choose the tool that estimates it.** Agreement with the humans is the
thing being calibrated; the pass rate is an output of the calibration.

**Leave repeats at 1 and believe the knob.** The threshold slider is right there, it responds to
clicks, and at one repeat it is not connected to anything — the first sample is the verdict. You spend
an afternoon sweeping it, record six identical readings, and conclude that the operating point does not
matter. The lie: **a control that looks live is worse than one that is missing**, because it buys a
decision you did not make.

**Tune the threshold on test.** The test half is 37 items and the sweep on it is beautiful: at 0.50
the rubric judge reads kappa 1.00 with no disagreements at all. That is a reason to suspect the split,
not to ship. You have now chosen the operating point on the only data you promised not to touch, and
the next run of that same configuration has nothing to validate against. The lie: **a perfect score on
37 items is usually a leak, not a judge.**

**Treat repeats as a dial.** Four repeats scoring below three in the table above is not a bug; it is
what happens when you re-roll a comparison five times and read whichever row came out best. The lie:
**more samples make the score better, and the verdict it produces is not monotone in the number of
samples.**

**The free one.** Pick the threshold once and never record it in the run's key. Then six months later
the dashboard reads 57.9% and nobody can say whether the judge changed or the knob did — the same
missing-provenance failure as [5.3](../module-05/lesson-03.md), one level down.

## Fix it

1. **Grade with repeats, and record the repeat count and the threshold in the run's key.** On this
   corpus, 5 samples at threshold 0.50 takes the rubric judge on the 57 dev items from kappa 0.79 to
   **0.89**, and turns a run of 5 false alarms and 1 missed fault into 3 false alarms and none. Both
   numbers belong in every result row next to the kappa, because a verdict without them is not
   reproducible.
2. **Choose the threshold on dev, from the trade, not from the pass rate.** Write down what a false
   alarm costs your team in reading time and what a missed fault costs in the release. The rubric judge
   on the full 94 at 0.50 gives you 3 false alarms and 0 missed faults — start there and adjust from the
   table, not from the number you wish the judge read.
3. **Use the largest repeat count you can afford and no more, and expect a non-monotone ladder.** Five
   repeats over 57 dev items is $10.8129 at this course's recorded pricing, against $2.1626 for one.
   Pick the repeats first, from the budget; pick the threshold second, from the sweep.
4. **Validate the operating point once, on the half you did not tune it on.** The 0.50 threshold chosen
   on dev holds on test: kappa 1.00 (1.00–1.00) with `fp 0, fn 0` on 37 items. Record it as the judge's
   configuration, because a threshold that is not in the key is a threshold that will be re-chosen by
   whoever is looking at the dashboard next month.

## How do I know it works?

**Challenge, on dev.** The operating point is right when all of these hold:

- **Kappa at the chosen threshold is at or above your target, with the interval printed.** On the 57
  dev items, the rubric judge at threshold 0.50 reads **0.89** (0.76–1.00) and at 0.20 reads **0.31**
  (0.14–0.49). You cannot tell those two apart from the pass rate alone: 86.0% versus 57.9% tells you
  almost nothing about which judge is usable.
- **Both cells of the trade are written down**: false alarms and missed faults, at the operating point
  you chose. On the full 94 at 0.50 that is `fp 3, fn 0`; at 0.80 it is `fp 0, fn 3`.
- **The threshold is a value your scores can actually take.** With 5 repeats, 0.05 and 0.20 are the
  same setting; with 3 repeats, 0.34 and 0.50 collapse too. If you cannot say what the score has to be
  for the threshold to fire, you have chosen a number, not an operating point.
- **Repeats and threshold are in the run key**, along with the prompt hash from
  [5.3](../module-05/lesson-03.md).

**Validation, once.** Press **Validate on test** and sweep once more:

| Threshold, 5 repeats | Dev, n = 57 | Test, n = 37 |
|---|---|---|
| 0.20 | kappa 0.31, 19 false alarms, 0 missed | kappa 0.43, 11 false alarms, 0 missed |
| 0.50 | kappa 0.89, 3 false alarms, 0 missed | kappa 1.00, 0 false alarms, 0 missed |
| 0.95 | kappa 0.69, 0 false alarms, 9 missed | kappa 0.37, 0 false alarms, 11 missed |

The 0.50 you picked on dev is the 0.50 that works on test, which is the whole reason for having chosen
it on dev. The 0.95 row is the reason the button exists: a threshold that looks reasonable at the
strict end of the knob misses 9 faults in development and 11 in held-out data, and the pass rate never
warns you.

## Use / don't use

**Do use repeats and a threshold for every judge that gates a release.** The cost at this course's
recorded pricing is $0.03794 a call and 540 ms — 40 items at 5 repeats is $7.5880, which is a rounding
error next to the hour an engineer spends reading false alarms.

**Do record the operating point in the key.** Repeats, threshold, prompt hash, model build: all four,
in every result row. A judge run without them cannot be reproduced and therefore cannot be improved.

**Don't use logprobs where they are not available.** The probability-weighted score works with any
judge because it is built from repeated binary verdicts, which every model can produce. Where a model
does expose a probability of the `PASS` token, you can read the score directly instead of sampling five
times — cheaper and lower variance — but the threshold you apply is the same knob, and the same
trade.

**Don't pick an operating point that has never been validated.** A threshold is a tuned parameter
like any other; it lives on dev and gets checked once on test, like the rubric clause count from
[5.4](../module-05/lesson-04.md) and the sample size from [4.4](../module-04/lesson-04.md).

**Don't turn the threshold up to make the numbers look tidy.** Threshold 1.00 on this corpus gives
TNR 100.0% and TPR 57.4%, a judge that fails nearly half of the good answers and still reads as
"strict". A perfect TNR with a collapsed TPR is the mirror image of the always-pass judge, and it is
caught by the same pair of tiles.

What teams actually do in production: 3 repeats at threshold 0.5 as the default for a nightly gate,
because it is the cheapest point that removes missed faults on a set this size; 5 repeats for the
release-blocking run, where a false alarm costs an hour of reading rather than a day's delay. The
threshold is a per-judge constant in the config file, changed only with a pull request that includes
the dev sweep. Nobody edits it at 2am to make an alert go away, and when somebody proposes to, the
number they have to show is the sweep table, not the pass rate.

## Reflect

1. Your judge reads a 81.9% pass rate against the humans' 50.0%, and 30 false alarms on 47 items.
   Write the one sentence that tells a stakeholder what that pass rate is actually made of.
2. The repeats ladder goes 0.79, 0.64, 0.86, 0.79, 0.89. Write why four repeats is worse than three,
   and say what you would do if your budget only covered three.
3. On 37 held-out items your threshold of 0.50 reads kappa 1.00 with no disagreements. Write the two
   sentences you would put in the runbook, including what you would check before believing it.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- OpenAI Cookbook, [using
  logprobs](https://developers.openai.com/cookbook/examples/using_logprobs) — where the
  probability-weighted score comes from when a model exposes a probability for the verdict token
  rather than only a sampled one.
- Lianmin Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot
  Arena](https://arxiv.org/abs/2306.05685) (2023) — the measured run-to-run variation of a judge's
  verdicts, which is the reason a single sample is treated as a sample here rather than as an answer.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the discipline underneath the
  knob: the operating point is a parameter like any other, so it is chosen on the split reserved for
  choosing and checked once on the split reserved for checking.