---
id: "05.2"
module: 5
minutes: 14
practice_minutes: 35
prerequisites: ["05.1"]
objectives:
  - Say which question each scale — binary, graded, pairwise — can answer, and which one it cannot.
  - Choose where to put a pass line on a graded judge score, and show what the choice costs in pass rate and in agreement.
  - Measure a pairwise judge's swap consistency and explain why a single-order pairwise run cannot detect its own bias.
volatility: concept
sources:
  - title: "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (Zheng et al., 2023)"
    url: https://arxiv.org/abs/2306.05685
  - title: "Judging the Judges: A Systematic Investigation of Position Bias in Pairwise Comparative Assessments by LLMs (Wang et al., 2024)"
    url: https://arxiv.org/abs/2406.07791
  - title: "Large Language Models are not Fair Evaluators (Wang et al., 2023)"
    url: https://arxiv.org/abs/2305.17926
last_verified: "2026-10-01"
---

# 05.2 · Binary, Likert and pairwise

Three scales, three different questions, and a trap in the middle one: a graded judge score does not
remove the pass/fail decision, it only moves it somewhere you have to choose and write down. This lesson
is about knowing which scale answers the question you actually have.

## Why it matters

A team has a binary judge on a support assistant, a TPR of 0.90 and a TNR of 0.78 on dev. Somebody argues
the binary is throwing away information: *"the judge probably knows the answer is a 3, not a 2 — we should
let it say so."* The judge is moved to a 1-to-5 scale.

Three weeks later the eval reports that answers the humans fail score **3.1 on average** and answers they
pass score **3.8**, and a slide concludes the judge is "close to human judgement". It is. It is also
close to useless, for a reason nobody wrote down: **there is no pass line.** The nightly job prints a mean
score. The release gate needs a pass or a fail, so somebody picks 4, and one day somebody else picks 4,
and on the day they pick 3.5, and the gate quietly changed without a commit.

The information the team gained is the distance between a 3 and a 4. The information the gate needs is
which side of a line the answer is on. Those are different questions, and only one of them can be handed
to a pipeline.

The same thing happens one scale over. Switch a judge from grading one answer to comparing two, and the
scoreboard looks fine — the judge picks the better answer 98% of the time — while the judge changes its
mind on **more than half** of the items the moment you swap which answer is shown first.

## How it works

### What each scale is for

| | The judge is asked | The output is | Good at | Cannot do |
| --- | --- | --- | --- | --- |
| **Binary** | does this answer satisfy rule *k*? | pass or fail | gating; a TNR you can quote; a disagreement that is a fact | tell you *how far* from the line an answer is |
| **Graded** (Likert, 1–5, 0–10) | how good is this answer? | a point on a scale | showing a trend; ranking candidates before you have labels | gating, unless you pick a line; agreeing with itself |
| **Pairwise** | which of these two answers is better? | A or B | comparing two systems where no absolute bar exists | measuring one answer absolutely; trusting a single ordering |

### Binary

Two labels means a 2×2 table, which means TPR, TNR and kappa all exist. That is the whole argument, and
it is a structural one rather than a matter of taste: **a scale with *k* points has *k* × *k* cells to
agree in and you cannot fill them with 94 items.** Module 6 comes back to the multi-class version, where
people reach for accuracy on a five-point scale and discover that "mostly 4s" scores 80% while agreeing
with nobody.

### Graded: the decision is moved, not removed

The lab does not ship a Likert judge, and that is deliberate — it ships the thing a Likert judge turns
into. Set **Repeats** to 5 and the same judge is asked the same question five times at temperature. Each
answer is 0 or 1, so their mean is a score in [0, 1] with five possible values, and the page's threshold
knob turns that score back into a pass or a fail. This is exactly the mechanism every graded judge uses,
with the fiction of the scale replaced by a number you can count.

On all 94 items of the tuned system, scoring `Llama 3.2 3B · Rubric · 0 shots`, here is how the 94 scores
are distributed across the five possible values:

| Share of the 5 repeats that said pass | 0/5 | 1/5 | 2/5 | 3/5 | 4/5 | 5/5 |
| --- | --- | --- | --- | --- | --- | --- |
| Items | 17 | 17 | 10 | 6 | 17 | 27 |

**50 of the 94 items land in the interior** — one to four repeats out of five. That is the end-avoidance
the literature describes, reproduced exactly: half the set sits in a band where a 3 and a 4 are the same
argument, and the 17 items at 1/5 and the 17 at 4/5 are the only places where a graded score carries an
opinion you could act on.

Now move the line. Same 94 items, same judge, same five samples, one knob:

| Threshold | Judge pass rate | Kappa | TPR | TNR | Real failures let through |
| --- | --- | --- | --- | --- | --- |
| 0.20 | 81.9% | 0.36 | 100.0% | 36.2% | 30 |
| 0.40 | 63.8% | 0.72 | 100.0% | 72.3% | 13 |
| **0.50** | **53.2%** | **0.94** | **100.0%** | **93.6%** | **3** |
| 0.60 | 53.2% | 0.94 | 100.0% | 93.6% | 3 |
| 0.80 | 46.8% | 0.94 | 93.6% | 100.0% | 0 |
| 1.00 | 28.7% | 0.57 | 57.4% | 100.0% | 0 |

The middle row is the interesting one, and you can check it by hand. At 0.40 the judge passes 60 of 94;
`FP 13, FN 0`, so `TP 47, TN 34` and accuracy is 81/94 = 0.8617. The humans split 47/47, so chance
agreement is again exactly 0.5:

$$\kappa = \frac{0.8617 - 0.5000}{1 - 0.5000} = 0.723$$

which is the 0.72 in the table. At 0.50 the judge passes 50 of 94 with `FP 3, FN 0`, so accuracy is
91/94 = 0.9681 and $\kappa = (0.9681 - 0.5) / 0.5 = 0.936$. At 0.80 the arithmetic gives **the same
number** — `(0.9681 − 0.5) / 0.5 = 0.936` — from a completely different place: at 0.50 it passes 3 real
failures and loses no good answers, and at 0.80 it passes none and loses 3 good ones. Two identical-looking
kappas, two different judges.

The last row is the lesson in one line: at 1.00 you have not tightened the judge, you have demanded
unanimity. It throws away **20 of the 47 answers the humans passed** and the kappa falls to **0.57**,
because a judge that fails 43% of the good answers is not a strict judge, it is a different judge that
happens to be worse.

And the trap for anyone doing this with one sample: over a single verdict the score is only ever 0 or 1,
so a threshold can only be 0 or 1. The page says so in the hint under the knob, and it is worth
believing — a "graded" judge run once is a binary judge wearing a decimal point.

### Pairwise

Pairwise asks a different question: given two answers, which is better? It has one real advantage and one
real trap.

The advantage is that it needs no absolute bar. "Is this 4 out of 5?" presupposes that 4 is the same thing
across a dataset of leave-policy questions and a dataset of refund-policy questions. "Which of these two
answers is better?" does not, and humans are considerably more consistent when asked it that way. That is
why every preference leaderboard in the industry is pairwise.

The trap is **position bias**: the answer shown first is more likely to be chosen, for reasons that have
nothing to do with quality. It cannot be seen by looking harder at a single run, because in a single run
position bias and quality point the same way — the good answer wins. You only see it by **swapping** and
asking again.

The lab's pairwise corpus is built for exactly that: 12 pairs, each shown in both orders, four repeats
each — 48 comparisons per judge — with a known better answer in every pair. The measurement is a
swap-consistency rate, and here it is:

| Judge | Same winner after swapping | Changed its mind | Picked whichever it read first |
| --- | --- | --- | --- |
| Qwen3 1.7B | 66.7% | 33.3% | 31.3% |
| **Llama 3.2 3B** | **47.9%** | **52.1%** | **50.0%** |
| Flow-Judge 3.8B | 66.7% | 33.3% | 33.3% |
| Prometheus 2 7B | 50.0% | 50.0% | 47.9% |

Read the middle row before anything else. Llama 3.2 3B gives the *same* answer in both orders on 47.9% of
comparisons — worse than the 50% a coin flipping one way or the other would manage. A judge that changes
its mind more often than chance when you move a label has no opinion about the answers at all.

Now read the accuracy column that does not exist here: every one of these judges picks the known better
answer on **97.9% to 100%** of the comparisons when it reads it first. On that number alone, all four
judges are excellent. Position bias is invisible in the number a single-order pairwise run reports, and
that is the entire reason the swap test exists.

## Show me

This lesson's preset opens the lab on `Llama 3.2 3B · Rubric · 0 shots`, variant A, 40 dev items at seed
7: pass rate **65.0%** (26 of 40), kappa **0.79** (0.56–0.95), TPR **95.8%**, TNR **81.3%**, accuracy
**90.0%**, confusion `tp 23, fp 3, fn 1, tn 13`.

Two other panels on the same page hold the rest of this lesson, and both are reached by changing one
control rather than one preset:

- **Repeats and majority vote.** Move the Repeats knob from 1 to 5 and watch the table build:

  | Repeats | Kappa | Kappa 95% CI | Cost of the run |
  | --- | --- | --- | --- |
  | 1 (greedy) | 0.79 | 0.57–0.95 | $1.5176 |
  | 2 + majority | 0.85 | 0.64–1.00 | $3.0352 |
  | 3 + majority | 0.95 | 0.80–1.00 | $4.5528 |
  | 4 + majority | 0.95 | 0.80–1.00 | $6.0704 |
  | 5 + majority | 0.95 | 0.81–1.00 | $7.5880 |

  The interval narrows as the repeats rise — that is the per-item noise being averaged out — and the
  bill goes up in lockstep. Repeats are the honest way to turn one verdict into a graded one, and they
  cost five times as much to do it.

- **Where do you put the threshold?** That panel is the same threshold sweep as the table above, on your
  current sample, live.

- **Position bias: judge the same pair twice.** The pairwise panel, with the swap table above. Module 7
  opens the lab on it and does the thing this lesson deliberately does not: it builds the fix.

> [!NOTE]
> The pairwise corpus, like everything else here, is a seeded educational model. The model names in that
> table are the labels under which recorded runs are filed. The swap rates are real arithmetic on
> recorded verdicts and are not published bias measurements for those models.

## Try it

**Predict first.** Before touching the page, write down:

1. Set Repeats to 5 and the threshold to 1.00. Does kappa go up (stricter) or down? Roughly to what?
2. With Repeats at 1, what is the most extreme threshold you can set, and what verdict does it produce?
3. For the pairwise judge with a 47.9% swap-consistency rate: if you ran it on 100 pairs in one order
   only, roughly what share of its "wins" would you expect to be wrong?

[Simulation: judge-lab](../../simulations/judge-lab/index.html?preset=scale)

1. **Build the threshold sweep yourself.** Repeats to 5, then walk the threshold from 0.00 to 1.00 in
   0.05 steps, recording kappa and TNR at each stop. Find the threshold that maximises kappa on your
   sample. Then note *why* it is the maximum: the graded score has turned into a binary judge again, and
   the threshold is the rubric you did not write down.
2. **Count the interior.** How many of the 40 items on this draw score between 1/5 and 4/5? On the full
   94 it is 50 — just over half. Then write down what you would tell a team that read "the judge is
   uncertain on half our answers" as a finding.
3. **Buy the same answer twice.** Record kappa at Repeats 1 and at Repeats 5, and the cost of each. The
   question to answer is not "which is better" but "which one do I want to be true on a Tuesday when the
   nightly job has a 20-minute budget".
4. **Find the pairwise trap by construction.** Read the position table again and compute the swap
   consistency a coin would score: 50.0%. Then count how many of the four judges are below it. A judge
   below the coin is not biased — it is worse than biased, and it is the one nobody would have caught
   from a single-order run.
5. **Write the sentence you would put on the dashboard.** Your graded judge produces a mean of 3.1 on
   human failures and 3.8 on human passes. Write the one line that turns that into something a gate can
   act on. If you cannot write it without inventing a threshold that is not in the code, the judge is
   not finished.

## Break it

Two ways to break a scale, and the graded one is the more common.

**Break the graded scale by moving its line.** Take the sweep table above and look at what the same
underlying judge does across it. At threshold 0.20 it lets 30 real failures through and has a kappa of
0.36; at 0.50 it lets 3 through and reads 0.94; at 1.00 it lets none through, throws away 20 good
answers and reads 0.57. Nothing about the judge changed. The lie is named: **an unstated threshold is a
hidden rubric, and a hidden rubric is one nobody validated.** The page cannot detect this for you either —
the threshold is a control, not part of the recorded key, which is exactly why it has to be written into
the prompt or the config file where a reviewer can find it.

**Break the pairwise scale by not swapping.** A single-order pairwise run on these 12 pairs reports 97.9%
to 100% correct for every judge on the menu. Ship that number, put it on the slide, and every reader
concludes the judge is reliable. It is not: the same judge changes its answer on up to 52.1% of the
items when the two answers trade places. The lie has a name too — **a pairwise score that reports only
accuracy is reporting the part of the measurement that cannot see the bias.**

The third break is the one people reach for first, and it deserves naming even though it is not the
biggest: grading a judge on a 1–5 scale and reporting accuracy. At four and five correct answers out of
five, a judge that always says 4 scores 80% and has not agreed with anybody about anything. Module 1's
first lesson is about this number and it does not get better because it came out of a rubric.

## Fix it

Three changes, all on the scoreboard:

1. **Binary for anything that gates.** Keep the graded score if it earns its place — as a diagnostic, as
   a ranking tool, as a way to sort a disagreement queue by how contested an item is — and never as the
   thing the pipeline reads. The gate reads a line, and the line is in the code.
2. **Put the pass line in the prompt, not in your head.** `PASS only if at least 4 of the 5 repeats said
   pass` is a sentence a reviewer can read. `pass if score >= 0.8`, chosen on a Tuesday, is not.
3. **Measure pairwise judges by swapping, always.** Judge every pair in both orders; count a win only for
   an answer that wins in both positions; treat the rest as a tie. That halves the calls and removes the
   bias, at the price of discarding contested items — and discarding contested items is the right trade
   when the alternative is trusting them. Module 7 does the arithmetic and the cost.

The same fix applies to repeats: if you are going to ask more than once, record that you did. Repeats at
5 on the 40-item draw are $7.5880 instead of $1.5176, and a run that quietly used 5 while the dashboard
says "greedy" is a run nobody can reproduce.

## How do I know it works?

**Challenge, on dev.** Write the scale choice into the target, not into a comment:

- **Binary judge.** TNR ≥ 0.80 and TPR ≥ 0.90 on 40 dev items, then one held-out validation on the 37
  test items. `Llama 3.2 3B · Rubric · 0 shots` gives dev kappa **0.79** (0.59–0.93) and test kappa
  **0.73** (0.49–0.94) on the tuned system. It holds.
- **Graded judge.** The threshold is written down, and you can state the pass rate and kappa at *two*
  thresholds either side of it. If those three numbers move so much that a small change in the line
  swamps the change you are trying to measure, the line is not settled and the judge is not ready.
- **Pairwise judge.** Swap consistency above 0.90 on the pairs you have, measured by judging every pair in
  both orders. The lab's 3B menu entry is at 47.9% on 48 comparisons, which fails this before it starts —
  and notice that you can only know that because you ran the swap.

Then, once, the held-out set. A scale that behaves on dev and misbehaves on test is a scale you tuned,
and Module 4 built the split for exactly this.

## Use / don't use

**Use binary** for every gate, every regression check, and every number that goes on a dashboard
somebody acts on. It is the only scale on which your TNR is a sentence you can say out loud.

**Use a graded score** for triage: which disagreements do I look at first, which system is ahead on the
hard slice, whether a prompt change moved anything at all before you care about the size. As a *trend*
across hundreds of items with a fixed threshold it is genuinely informative, and it is a much better
dashboard tile than a pass rate that nobody gates on.

**Use pairwise** when there is no absolute bar — comparing two systems, ranking candidates, building a
preference set — and never for a single answer. Pairwise is also the most expensive shape per decision:
two answers means two calls per item per order, and the swap test doubles it again.

What teams actually do: binary judges for the gate, pairwise for the weekly head-to-head between two
candidate prompts, and a graded score almost never, because the moment a graded score enters a dashboard
someone asks for the average and then asks what the average means. The cost ordering is the same as ever
— code free, judge about $0.04 a call, human your afternoon — and the scale choice does not change the
unit price. It changes what the number means.

## Reflect

1. Your graded judge returns 3.1 on human failures and 3.8 on human passes, over 94 items, with no
   threshold in the code. Write the two sentences you would put in the runbook, and say which one prevents
   the incident you are actually worried about.
2. A teammate proposes reporting pairwise agreement at 97.9% as evidence the judge is reliable. Write the
   experiment you would run to check that claim, and the sentence you would write if the experiment came
   back at 47.9%.
3. On the threshold table, why does 0.50 and 0.80 produce the same kappa while behaving completely
   differently? Answer in terms of the two cells each one moves.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Lianmin Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot
  Arena](https://arxiv.org/abs/2306.05685) (2023) — where pairwise comparison became the default way to
  evaluate a model, and the first measurements of how badly judges handle position.
- Peiyi Wang et al., [Judging the Judges: A Systematic Investigation of Position Bias in Pairwise
  Comparative Assessments by LLMs](https://arxiv.org/abs/2406.07791) (2024) — the swap test this lesson
  leaves open, and the reason a single-order pairwise run cannot detect its own bias.
- Peiyi Wang et al., [Large Language Models are not Fair Evaluators](https://arxiv.org/abs/2305.17926)
  (2023) — position bias measured directly, with the consistency rate as the diagnostic.