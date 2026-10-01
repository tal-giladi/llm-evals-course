---
id: "07.5"
module: 7
minutes: 15
practice_minutes: 35
prerequisites: ["07.4", "06.4"]
objectives:
  - Measure run-to-run noise in a judge and explain what one greedy verdict therefore means.
  - Apply a majority vote over repeats and say what it buys, what it costs, and at what k the gain saturates.
  - Write the tie rule for an even number of repeats into the config so the operating point is not a surprise.
volatility: concept
sources:
  - title: "Self-Consistency Improves Chain of Thought Reasoning in Language Models (Wang et al., 2022)"
    url: https://arxiv.org/abs/2203.11171
  - title: "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (Zheng et al., 2023)"
    url: https://arxiv.org/abs/2306.05685
  - title: "A Coefficient of Agreement for Nominal Scales (J. Cohen, 1960)"
    url: https://doi.org/10.1177/001316446002000104
last_verified: "2026-10-01"
---

# 07.5 · Repeats, temperature and majority vote

A judge asked the same question twice at temperature can answer differently, and every one of those answers
costs a full model call. This lesson is about what buying several of them actually buys: a narrower interval,
a verdict that stops depending on which sample you drew — and a point estimate that does not improve
monotonically, which is the part nobody warns you about.

## Why it matters

Your nightly gate says a build failed. The previous night's run of the same build passed. Same prompt, same
model, same items, same temperature, same everything you wrote down. You re-run it and the gate passes.

The team's conclusion is that the gate is flaky and should be widened. The team's conclusion is wrong, and
the reason is in [7.3](lesson-03.md): two independent single-sample runs of this same judge on the same 57
items differ by a **median of 3.5 points** of pass rate, and by 10 or more points about one time in twenty.
A single verdict is one draw from a distribution, and nobody wrote down the width of that distribution.

So the fix looks obvious — ask the judge five times and take the majority — and it does work. It also costs
five times as much, and it has two properties nobody checks: the gain saturates at two or three repeats, and
**an even number of repeats is a stricter test than the odd number above it**, which is why on this corpus
four repeats outscore five.

## How it works

### One greedy verdict is one draw

The lab records five samples per item for every judge. Sample 0 is the greedy call; samples 1 to 4 are
temperature samples. On the tuned system's answers under `Llama 3.2 3B · Rubric · 0 shots`, across all 94
items:

| | Count | Share |
| --- | --- | --- |
| Item-sample pairs where a temperature sample disagreed with the greedy verdict | 92 of 376 | **24.5%** |
| Items where the five recorded samples are not all the same | **50 of 94** | 53.2% |
| … on the 57 dev items | 28 of 57 | 49.1% |
| … on the 37 test items | 22 of 37 | 59.5% |

A quarter of the time the greedy verdict is not what the same judge would have said at temperature, and on
half the items the five samples do not agree. This is not a broken judge; it is a judge with a wide
distribution, and a single verdict reads one point of it.

### What the majority vote does, on this draw

The preset configuration: `Llama 3.2 3B · Rubric · 0 shots`, the tuned system, the dev split, 40 items drawn
at random at seed 7, greedy or majority-voted, bootstrap at 400 resamples.

| Repeats | Kappa | Kappa 95% CI | Cost of the run |
| --- | --- | --- | --- |
| 1 (greedy) | 0.70 | 0.46–0.90 | $1.5176 |
| 2 + majority | 0.85 | 0.66–1.00 | $3.0352 |
| 3 + majority | 0.85 | 0.65–1.00 | $4.5528 |
| 4 + majority | 0.90 | 0.73–1.00 | $6.0704 |
| 5 + majority | 0.85 | 0.65–1.00 | $7.5880 |

Read the first two rows: **the whole gain arrives at k = 2.** One repeat to two is +0.15; two to three is
+0.00; three to five is −0.00 on this draw. Repeats buy variance reduction, and variance reduction saturates
almost immediately on a binary verdict, because a binary verdict has very little variance left to remove.

Seven of the 40 items on this draw change verdict between 1 and 5 repeats. That is **17.5% of your gate**,
decided by which samples happened to come back.

### Why four repeats beats five

This is the row that should surprise you, and it is not noise — it is the vote rule. The lab passes an item
when more than half the samples said pass, and "more than half" of an **even** number of samples means a
strict majority:

| Repeats | Samples needed to pass | Share of samples required |
| --- | --- | --- |
| 2 | 2 of 2 | 100% |
| 3 | 2 of 3 | 67% |
| 4 | 3 of 4 | **75%** |
| 5 | 3 of 5 | 60% |

**Four repeats is a strictly stricter test than five.** Any item whose samples split 3–2 passes at five
repeats and fails at four. On this draw three of the 40 items do exactly that, and that is the entire gap
between the 0.90 in row four and the 0.85 in row five.

So "five is better than four" is not a fact about judging. It is a fact about which threshold you picked, and
you picked it by accident, by choosing an even number. The pass rates tell the same story: 52.5% at four
repeats against 60.0% at five, on identical items and identical samples.

### And what it costs

At the recorded $0.03794 a call and 540 ms, on this 40-item draw: $1.5176 for one verdict, $7.5880 for five.
On a 200-item nightly set that is **$7.59 a run at k = 1 and $37.94 at k = 5**, and serially, 108 seconds
becomes 540 seconds. Repeats are bought with money, not with cleverness, and the exchange rate is fixed by
your provider.

### The overlap nobody reports

[5.4](../module-05/lesson-04.md) measured that few-shot examples cut the items whose five samples disagree
from 50 of 94 to 35 of 94. The majority vote also reduces that disagreement. They attack the same number, so
run both and you cannot afterwards say which one you paid for:

| Judge, on the 57 dev items | 1 repeat | 3 repeats | 5 repeats | Items with disagreeing samples (of 94) |
| --- | --- | --- | --- | --- |
| `Llama 3.2 3B · Rubric · 0 shots` | 0.79 (0.59–0.93) | 0.86 (0.69–0.96) | 0.89 (0.76–1.00) | **50** |
| `Llama 3.2 3B · Rubric · 3 shots` | 0.72 (0.51–0.88) | 1.00 (1.00–1.00) | 1.00 (1.00–1.00) | **35** |

The three-shot judge reaches 1.00 at three repeats and stays there — with a 1.00–1.00 interval, which is
the shape of a result with nothing left in the bootstrap to vary. On the 37 held-out items **both judges
reach 1.00 at five repeats.** The aggregation and the exemplars are not additive, because both are buying
the same thing, and at the top of that table there is nothing left to measure. A kappa of exactly 1.00 with a
1.00–1.00 interval is not a good judge. It is a small set with no remaining disagreement.

## Show me

The preset opens the lab on `Llama 3.2 3B · Rubric · 0 shots` with the repeats panel on screen. The panel
prints all five repeat counts at once — kappa, kappa interval, and the cost of that run at the current
sample size — and highlights the row your Repeats knob is on. The knob is in the Run panel and runs from
`1 (greedy)` to `5 + majority`, and the label tells you which rule is in force.

The cost panel under the tiles prices the run at $0.03794 a call and 540 ms, and prints both the current cost
and the cost at five repeats. Set the knob to 5 and watch the "Cost at 5 repeats" line stop changing — you
are at the ceiling of what this configuration costs.

Two other panels on the same page belong to this lesson:

- **Threshold.** With repeats above 1, the threshold knob turns the same repeats into a probability-weighted
  score and applies a line to it. That is what you should use when `k` is even and the majority rule is
  quietly stricter than you meant — [6.4](../module-06/lesson-04.md) is where that score and its threshold come
  from, and the pair is the answer to the "which k" question this lesson raises.
- **Answer being judged** and **Items.** Change `k` and nothing else, then change the draw and re-read. The
  gap between "repeats helped" and "this draw was lucky" is the seed knob.

> [!NOTE]
> > Every verdict and every repeat in this panel is a recorded run of the lab's seeded educational model,
> > filed under the label `Llama 3.2 3B · Rubric · 0 shots`. The price sheet is the lab's own, and the
> > improvement from repeats is real arithmetic on recorded verdicts — it is not a claim about what sampling
> > does to any real judge in the wild.

## Try it

**Predict first**, before opening the page:

1. One greedy verdict costs $1.5176 on this 40-item draw. What does five repeats cost, and how many times
   more is that?
2. The majority vote passes an item when more than half the samples pass. At four repeats and at five, how
   many samples must pass? Which of the two is the stricter test?
3. If three repeats moves kappa from 0.79 to 0.86 and five repeats moves it to 0.89, what do you predict for
   ten? Now go and look for the ceiling.

[Simulation: judge-lab](../../simulations/judge-lab/index.html?preset=repeats)

1. **Read the whole table before you touch the knob.** Write the five kappas down: 0.70, 0.85, 0.85, 0.90,
   0.85. Identify the row where the point estimate turns down, and explain it using the sample-count rule
   rather than by calling it noise. Then write the rule into a sentence you would put in a config file.
2. **Compute the sample threshold yourself.** For k = 2, 3, 4 and 5, write how many passing samples are
   required and what share of the samples that is. Mark on the table which rows are stricter than the row
   below them. You should find exactly one.
3. **Find the saturation point.** Set Repeats to 2, then 3, then 5, and record kappa and cost each time. Find
   where the kappa stops improving and the cost does not. Write the sentence you would put in a runbook:
   *"we use k = 3 at $0.11382 a call; k = 5 costs two-thirds more per item for a difference inside the
   interval."*
4. **Show the noise floor directly.** With Repeats at 1, click **Pin as A**. Move the seed, watch the tiles,
   then move it back. Count how many of the 40 verdicts change when only the seed changes. Compare that
   number to the 7 items that change between one and five repeats — and then decide whether a seed knob is a
   legitimate part of a reproducible eval.
5. **Break it deliberately.** Set Repeats to 4 and read the TNR; set it to 5 and read it again. Three items
   on this draw moved between those two settings. Now write down what your gate would have blocked in one
   case and allowed in the other, purely because you chose an even number.

## Break it

**Report the k = 4 row as your best configuration.** It is the highest point estimate on the table, it is
the one you will quote, and it is higher than k = 5 because four is a stricter test — that is, because you
accidentally raised your bar and 3 items fell below it. The lie: **a repeat count is an operating point, and
reporting the maximum over five operating points is selecting, not measuring.** If you tune `k` for the best
dev kappa and ship that number, you have fitted your gate to the dev set, exactly the failure Module 4 built
the split to catch.

**The cheaper break is believing 1.00.** Push to five repeats on the three-shot judge and the kappa reads
1.00 with an interval of 1.00–1.00. It looks like a solved problem. It is zero disagreements in a bootstrap
over 57 items: there is nothing left to vary, so the interval cannot be anything but a point. Lesson [5.4](../module-05/lesson-04.md) calls this the shape you should distrust most, and it is the shape a small dev set produces *automatically* once you aggregate hard enough.

**The third break is forgetting to write `k` down.** A run at five repeats costs 5× a run at one and is
stored in the same column of the same table. Nothing downstream can tell them apart, the dashboard cannot,
and the first person to compare this week against last week is comparing two different measurements without
knowing it.

## Fix it

Four changes, all on the page:

1. **Put the repeat count in the result key.** `repeats: 3`, next to the model version, the prompt hash, the
   threshold and the sample seed. The export on this page already carries `repeats`; keep it. A run whose
   repeat count is not recorded is a run nobody can reproduce.
2. **Choose `k` for the interval, not for the point estimate.** On this draw the whole gain arrives at
   `k = 2` and three is a sensible ceiling: $4.5528 on this draw against $7.5880 at five, for a point
   estimate inside the other's interval. Then state the number of calls you are actually making per nightly
   run, because on a 200-item set `k = 3` is $22.7640 and `k = 5` is $37.9400.
3. **If you use an even `k`, write the tie rule.** `PASS if 3 or more of 4 samples pass` is a sentence a
   reviewer can check. `majority vote` is not, because on four samples the majority rule means unanimity is
   required at k = 2 and a strict 3-of-4 at k = 4. Or skip the problem: set Repeats above 1 and use the
   **threshold** panel, which makes the operating point a number you set deliberately rather than one you
   inherited from the sample count.
4. **Spend the repeats where they gate, not where they trend.** Repeats on the nightly dashboard tile are
   $37.94 a run and buy a number nobody blocks a release on. Repeats on the release gate, on the one judge
   whose TNR you trust, buy a verdict that does not change when you re-run it. Same knob, very different
   bill.

And the ceiling: repeats cannot make a biased judge unbiased. [7.1](lesson-01.md)'s position bias and
[7.2](lesson-02.md)'s verbosity bias are properties of the distribution you are sampling from — averaging
five draws from a biased distribution narrows the interval around the wrong number. If the padding probe from
[7.2](lesson-02.md) fails, fix the judge; do not sample it harder.

## How do I know it works?

**Challenge, on dev.** Write the target before you run:

- **Kappa at 5 repeats ≥ kappa at 1 repeat, and the gap larger than the noise floor.** On the 57 dev items
  the rubric judge goes 0.79 (0.59–0.93) → 0.89 (0.76–1.00); the gap is 0.10, and the intervals overlap
  heavily. It passes on direction and is honest that it is not separable on size.
- **A non-greedy verdict that does not change with the seed.** The check is not "kappa is high", it is
  "switching the sampling seed moves 0 items". On this draw, seven of 40 items change between one and five
  repeats; before you ship, you need to be able to say how many change when only the seed moves.
- **The repeat count and the tie rule written into the config**, both of them, in the same block as the model
  version.

**Then one held-out validation** on the 37 test items, and this is where the lesson lands. The same judge, the
same five recorded samples:

| Repeats | Dev kappa (57) | Test kappa (37) |
| --- | --- | --- |
| 1 | 0.79 (0.59–0.93) | 0.73 (0.47–0.89) |
| 2 | 0.90 (0.76–1.00) | 0.78 (0.53–0.95) |
| 3 | 0.86 (0.69–0.96) | 0.84 (0.63–1.00) |
| 4 | 0.93 (0.82–1.00) | 0.89 (0.68–1.00) |
| 5 | 0.89 (0.76–1.00) | **1.00 (1.00–1.00)** |

The direction holds — five repeats beats one on the split the judge was not tuned on, 1.00 against 0.73. And
the shape at the end is exactly the one [5.4](../module-05/lesson-04.md) told you to distrust: on 37 items
with five repeats there are no disagreements left, so the bootstrap has nothing to resample and the interval
collapses to a point. **A 1.00–1.00 interval is the absence of evidence wearing the costume of certainty.**
Repeats on a small held-out set do not produce a confident result; they produce a set with nothing left in
it, and you cannot tell those apart unless you write the sample size next to the number.

## Use / don't use

**Do** use 3 to 5 repeats on the judge that gates a release, and check that the verdict survives a change of
seed. Three is usually enough; the cost of finding that out is three runs.

**Don't** put 5 repeats on every judge on every nightly run. A 200-item set at 3B is $22.7640 at k = 3 and
$37.9400 at k = 5, and 540 seconds of serial wall clock instead of 324. Spend it on the one judge whose TNR
you would block a release on.

**Don't use an even `k` without writing the tie rule**, and don't quote a point estimate that is the maximum
over the repeat counts you tried.

**Don't read a repeat gain as a prompt or judge improvement.** Essentially all of the gain on this corpus
arrives at `k = 2`, and [5.4](../module-05/lesson-04.md)'s exemplar work showed the same held-out split
reaching 1.00 at five repeats without them. Aggregation and prompt design buy overlapping things, and a
single number cannot tell you which one you got.

What teams actually do: 1 greedy verdict for the nightly trend, 3 or 5 repeats with a fixed, recorded seed
for the release gate; a tie rule written next to the repeat count; and an eval set large enough that a 1.00
with a 1.00–1.00 interval is a real result rather than an artefact of 37 items.

## Reflect

1. Your gate fails overnight, passes on re-run, and you find that this judge on 57 items differs by 3 to 12
   points of pass rate between runs. Write the ticket comment that moves this from "the gate is flaky" to
   "the gate is under-sampled", including the number you would put in it.
2. On this draw, k = 4 reads a higher kappa than k = 5. Write the two sentences that explain this to a
   teammate who thinks you have found a bug in the lab — and say what you would put in the config so that
   nobody has to be told.
3. Your 200-item nightly set costs $7.59 at one repeat and $37.94 at five. You have a fixed budget of $25 a
   night. Decide where the repeats go, name the judge you would give them to, and write the one sentence
   that would justify the choice to somebody who only cares about missed regressions.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Xuezhi Wang et al., [Self-Consistency Improves Chain of Thought Reasoning in Language
  Models](https://arxiv.org/abs/2203.11171) (2022) — sampling several answers and marginalising is the idea
  this lesson applies to a judge's verdict, including why it saturates quickly.
- Lianmin Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot
  Arena](https://arxiv.org/abs/2306.05685) (2023) — the consistency analyses that first reported how much of
  a judge's apparent reliability is one lucky sample.
- J. Cohen, [A Coefficient of Agreement for Nominal Scales](https://doi.org/10.1177/001316446002000104)
  (1960) — kappa, and why the corrected-agreement number is what survives averaging over samples.