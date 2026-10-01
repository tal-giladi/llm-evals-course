---
id: "07.1"
module: 7
minutes: 15
practice_minutes: 35
prerequisites: ["05.2"]
objectives:
  - Explain why a pairwise run that shows every pair in one order cannot detect position bias, in terms of two effects that point the same way.
  - Run the swap test on every pair, combine the two orders into one verdict, and report the tie rate alongside the accuracy.
  - Price the swap test in calls and latency, and decide where in a nightly eval it earns that cost.
volatility: concept
sources:
  - title: "Judging the Judges: A Systematic Investigation of Position Bias in Pairwise Comparative Assessments by LLMs (Wang et al., 2024)"
    url: https://arxiv.org/abs/2406.07791
  - title: "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (Zheng et al., 2023)"
    url: https://arxiv.org/abs/2306.05685
  - title: "Large Language Models are not Fair Evaluators (Wang et al., 2023)"
    url: https://arxiv.org/abs/2305.17926
last_verified: "2026-10-01"
---

# 07.1 · Position bias

Lesson [5.2](../module-05/lesson-02.md) left a pairwise judge at 97.9% accuracy and called it a trap without
building the instrument that detects it. This lesson builds it: judge every pair in both orders, count a win
only when the same answer wins twice, and report the share of comparisons that turned out to be undecidable —
which on this corpus is between 47.9% and 66.7% of them.

## Why it matters

A team is comparing two candidate prompts head to head. They build 40 pairs of answers from their eval set,
ask a judge which is better, and report a single number on the pull request. Every judge on the lab's menu
scores between **97.9% and 100%** on that number. Nobody queries it, because what would you query? The judge
answered the question it was asked, and it answered it correctly almost every time.

Then the team swaps the presentation order to "show each candidate second half the time" and reruns, because
somebody noticed the winner always appeared on top. The headline number barely moves. The individual verdicts
move constantly.

Here is the whole thing on this corpus — 12 pairs, 4 recorded repeats each, every pair judged as **A–B** and
again as **B–A**, 48 comparisons per judge:

| Judge | Same winner in both orders | Verdict flips on swap | A–B order accuracy | B–A order accuracy |
| --- | --- | --- | --- | --- |
| Qwen3 1.7B | 66.7% | 33.3% | 97.9% | 31.3% |
| **Llama 3.2 3B** | **47.9%** | **52.1%** | **97.9%** | **50.0%** |
| Flow-Judge 3.8B | 66.7% | 33.3% | 100.0% | 33.3% |
| Prometheus 2 7B | 50.0% | 50.0% | 97.9% | 47.9% |

Read the two accuracy columns together. In A–B order every judge looks nearly perfect. In B–A order — the
*same pairs*, the *same questions*, the same judge, the only change being which answer is printed first —
three of the four land at or below what a coin would have managed. Llama 3.2 3B goes from 47 of 48 correct to
24 of 48 correct, and it does not do that by answering differently. It does that by answering the same thing
about the same pair, one question mark earlier or later.

The single-order number was never measuring the judge. It was measuring the judge **plus the printing
order**, and on a pairwise eval those two are the same variable.

## How it works

### Why one order is structurally blind

A single-order pairwise run contains two effects stacked on top of each other:

1. **Quality.** The better answer is more likely to be chosen.
2. **Position.** The answer read first is more likely to be chosen, for reasons that have nothing to do with
   quality.

In the A–B order used here, answer A is both the first-read answer and, in every one of the 12 pairs, the
known better answer. The two effects therefore point in the same direction and **add**. You cannot separate a
sum of two unknowns from one observation. That is not a weak test; it is not a test.

And the contamination is not a rounding error. Compare the Llama 3.2 3B row above: **97.9% one-order
accuracy against 47.9% swap consistency.** The number a single-order run reports is roughly twice the number
the judge actually earns.

### The swap test, by hand

The measurement is one line of arithmetic over both orders. For every pair and every repeat, compare the two
verdicts. For Llama 3.2 3B across its 48 comparisons:

$$\text{swap consistency} = 1 - \frac{\text{comparisons whose verdict changed}}{\text{comparisons}} = 1 - \frac{25}{48} = \frac{23}{48} = 47.9\%$$

A judge with no position bias and a clear opinion would score near 100%. A judge that answers at random gets
50%. **47.9% is below the coin.** That is worse than biased: it means the judge is reading position as signal
and discarding whatever opinion it has about the answers.

You can see it on a single pair. Pair `p03`, Llama 3.2 3B, four repeats each:

| Order | Repeat 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- |
| A shown first | A | A | A | A |
| B shown first | B | B | B | B |

Four out of four flipped. Not "it wobbles a bit" — it reverses completely, every time, on the only axis
that changed.

### Combining two orders into one verdict

The fix is not to average, because a pairwise verdict is not a number. It is a rule:

> **Run the pair in both orders. Count a win for an answer only if it wins in both positions. If the two
> orders disagree, the comparison is a tie.**

Here is what that rule does to this corpus, and it is worth reading both columns:

| Judge | Wins for A (both orders) | Wins for B (both orders) | Ties | Of the decisive comparisons, A was right |
| --- | --- | --- | --- | --- |
| Qwen3 1.7B | 15 | 1 | 32 (66.7%) | 93.8% |
| Llama 3.2 3B | 24 | 1 | 23 (47.9%) | 96.0% |
| Flow-Judge 3.8B | 16 | 0 | 32 (66.7%) | 100.0% |
| Prometheus 2 7B | 23 | 1 | 24 (50.0%) | 95.8% |

Now the accuracy is **earned**. Of the 25 comparisons Llama 3.2 3B decided, it picked the known better answer
24 times — 96.0%, not 97.9%, and now it means something. Every unit of the difference between the two numbers
was position bias that the single-order run was crediting to the judge.

And look at the tie column, because it is the number nobody reports. **This judge decided fewer than half
of the comparisons it was given.** Per pair rather than per comparison, Llama 3.2 3B has **0 of 12** pairs
where all four repeats agree in both orders; Flow-Judge 3.8B has 4 of 12. The tie rate is the honest
statement of how much work your pairwise eval actually did.

### What the swap costs

The swap test is **two calls per pair instead of one** — a 2× bill and, run serially, 2× the latency. At the
lab's recorded prices, over the 12 pairs in this corpus:

| Judge | One order | Both orders | Serial latency per pair |
| --- | --- | --- | --- |
| Qwen3 1.7B | $0.2693 | $0.5386 | 760 ms |
| Llama 3.2 3B | $0.4553 | $0.9106 | 1080 ms |
| Prometheus 2 7B | $1.1846 | $2.3693 | 2500 ms |

That is the honest bill, and it is the reason the fix is not "always judge both orders on everything". It is
also the reason the fix is not optional: a judge that decides 52% of your comparisons by coin flip is not a
measurement, and doubling the calls is how you find that out.

## Show me

The preset for this lesson opens the lab on `Prometheus 2 7B · Rubric · 0 shots` with the position panel
open. The panel reads the whole pairwise corpus itself and prints the three columns the rule needs:

| Judge | Swap-consistent | Verdict flips on swap | Picks whichever it read first |
| --- | --- | --- | --- |
| Qwen3 1.7B | 66.7% | 33.3% | 31.3% |
| Llama 3.2 3B | 47.9% | 52.1% | 50.0% |
| Flow-Judge 3.8B | 66.7% | 33.3% | 33.3% |
| Prometheus 2 7B | 50.0% | 50.0% | 47.9% |

The third column is the position bias stated directly: the share of comparisons where the judge chose
whichever answer it happened to read first. Note what is **absent**: the panel never shows a one-order
accuracy, because that number is the thing the whole lesson exists to disqualify.

The agreement panel above it is still scoring the preset's own system — the 94-item support set, not the
pairwise corpus — so read the cost box there for the single-judge prices used in the table above. The
prompt box at the bottom is the same rubric text as everywhere else in this lab: three clauses, `PASS only
if all three hold`. Nothing about that prompt mentions order. The bias is not in the instructions.

> [!NOTE]
> > The pairwise corpus is recorded by the same seeded educational model as the rest of the lab. The model
> > names in the table are the labels recorded runs are filed under, not measurements of those models in the
> > wild. The rates are exact arithmetic on the recorded verdicts: 48 comparisons per judge, no sampling,
> > no model in the loop when you read them.

## Try it

**Predict first**, before opening the page:

1. A judge scores 97.9% on 48 pairwise comparisons in A–B order. After the swap test it gives the same winner
   in both orders on 48% of comparisons. Is the second number evidence the first was wrong, or noise on top
   of a good result?
2. If you judge every pair in both orders and count a win only when the same answer wins twice, what happens
   to the number of pairs that produce a usable answer?
3. How many model calls does a 40-pair pairwise eval cost with the swap test, at $0.03794 a call?

[Simulation: judge-lab](../../simulations/judge-lab/index.html?preset=position)

1. **Read the panel, then find the one-order number yourself.** For `Llama 3.2 3B`, count how many of the 48
   A–B verdicts said A. It should be 47. Now count how many of the 48 B–A verdicts said B. It should be 24.
   Write both numbers down next to the panel's 47.9% swap consistency and say what the difference between
   97.9% and 50.0% is made of.
2. **Count the ties, then count the decisive comparisons.** Apply the both-orders rule yourself for one judge
   and check you get 23 ties out of 48. Then divide: of the 25 comparisons it decided, how many did it get
   right? That quotient is the number you are allowed to report as accuracy.
3. **Change one knob and re-read.** Switch the Judge dropdown between the four pairwise menu entries and
   watch the first column move between 47.9% and 66.7% while the underlying corpus does not change at all.
   Predict which entry scores lowest before you switch. Two of the four are below what a coin would manage.
4. **Find the pair that reverses completely.** Work through the 12 pairs for one judge and find the pair
   where all four repeats flip. Note the consistency rate for that single pair: 0%. Then ask what a
   calibration set of that pair is worth on its own.
5. **Price it against the alternative.** The pairwise eval is for comparing two systems. On this lab's price
   sheet, a 40-pair A–B run with the 3B judge is 40 × $0.03794 = **$1.5176**. Write the number for the same
   40 pairs judged in both orders, and then for the same 40 pairs at five repeats in both orders. Say how
   often you would run each, and which one a release gate needs.

## Break it

**Report the one-order number.** Take the A–B column — 97.9%, 97.9%, 100.0%, 97.9% — put it on the dashboard,
and label it "pairwise accuracy". The lie has a name: **a one-order pairwise score measures the printing
order and reports it as the judge.** Nobody catches it because the number is high, it is in the right
direction on every pair, and it is stable across runs — all three of the properties people check.

**The quieter break is averaging.** Instead of the both-orders rule, average the two verdicts into a
confidence and keep whichever side is larger. That produces a number on every pair, which feels better than
a 47.9% tie rate. What it actually does is reintroduce position bias with a half-strength vote: on a
contested comparison, the judge that picked first *twice out of two orders* and the one that picked first
*once* come out equal, and the second judge has no evidence. Discarding contested items is not throwing
information away; it is refusing to invent a verdict you do not have.

**The third break is the one that happens by accident.** Judge both orders, and then let the pair where the
judge answered the same way twice decide the tiebreak on its own. On this corpus the decisive comparisons
are 93.8%–100% accurate, so a small contested set does not usually mislead you. That is luck, not a property
— it holds because A wins every pair in the corpus. On a hard set, where the better answer wins about half
the time, the survivors are no better than a coin, and your tiebreak is a coin with a good record.

## Fix it

Three changes, all visible on the page:

1. **Judge every pair in both orders, and make the swap part of the run record.** `order: [AB, BA]` next to
   the pair id, so a verdict with one recorded order is visibly incomplete rather than silently identical to
   one with two. On a run where the judge agrees with itself, the swap costs nothing extra in information and
   buys you the swap-consistency number for free.
2. **Count a win only twice, and call everything else a tie.** Write the rule as a sentence a reviewer can
   check — *"A wins only if it wins in both orders; a disagreement is a tie"* — and put it in the same place
   as the rubric version ([5.3](../module-05/lesson-03.md)).
3. **Report the tie rate next to the accuracy, every time.** `accuracy 96.0% on 25 of 48 comparisons
   (tie rate 47.9%)`. A tie rate above about 20% means the judge is not sharp enough to gate on and the fix
   is a different judge, not more pairs. A tie rate near zero means the judge is stable enough that you can
   drop back to one order and save the doubling — that is the measurement telling you the cost is optional.

And the ceiling: if swap consistency is 47.9%, swapping does not make the judge good, it makes it
*honestly bad*. A judge below the coin on consistency needs a different prompt or a different model, not a
second call. The swap test is a diagnostic as much as a correction.

## How do I know it works?

**Challenge, on dev.** Write the target before you run anything:

- **Swap consistency above 0.90 on the pairs you have**, judged in both orders. The lab's four pairwise menu
  entries score 47.9%, 50.0%, 66.7% and 66.7% on 48 comparisons each, so all four fail this on the first
  run. That is the correct outcome to expect from a single un-tuned judge, and it is the number you needed
  before shipping a pairwise gate.
- **Tie rate reported alongside accuracy, from the same run.** Not an average of two runs, not the tie rate
  on the pairs you liked — the tie rate on all of them.
- **Two orders recorded in the result key for every comparison**, so the run can be re-audited without
  re-paying for it.

Then, **once**, the held-out check. Take the pairs your judge was tuned on out of the picture and ask a
different question: does the both-orders rule order two real systems correctly where a one-order run does
not? A judge that is swap-consistent will agree with your humans about the winner; a judge that is not will
produce a verdict that reverses when you change the template, and you will find that out from a diff of two
pull requests rather than from an eval.

## Use / don't use

**Use the swap test** on the pairwise set where the decision is actually made — a weekly head-to-head between
two candidate prompts, a model migration, a rubric rewrite. It is the only measurement that tells you whether
a pairwise judge has an opinion.

**Don't pay for it on everything.** Two calls per pair is the most expensive shape per decision in this
course. A nightly trend does not need it; a calibration set of 30 to 50 pairs re-run before each release does,
and it is a fixed cost you can schedule.

**Don't use pairwise for one answer.** The swap test doubles the cost of the one shape in the course that
still cannot produce a TNR. If your question is "is this answer good enough", you want the binary judge from
[5.1](../module-05/lesson-01.md); the position bias in [5.2](../module-05/lesson-02.md) is the cost of a
shape you chose on purpose.

What teams actually do: a frozen pairwise calibration set of 30 to 50 pairs with a known better answer, both
orders, on every judge before it is promoted — plus a `tie` outcome wired into whatever consumes the
comparison, because a comparison pipeline that cannot represent "undecidable" will silently resolve ties by
whatever its default is, and that default is usually the first answer.

## Reflect

1. Your pairwise eval reports 97.9% accuracy on 48 comparisons and the swap test says the judge gives the
   same answer in both orders 47.9% of the time. Write the two sentences you would send to the team that
   built it. What number do you replace 97.9% with, and what do you add beside it?
2. On this corpus, the both-orders rule leaves 23 of 48 comparisons undecided for the 3B judge. List the two
   costs of that and the one thing you would still pay for. Then say what you would change if you needed the
   number up to 40 pairs decided.
3. Design the smallest probe that would tell you a pairwise judge is safe to run in one order from now on.
   Name the number, the sample size you would need, and why it is cheaper than always swapping.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Peiyi Wang et al., [Judging the Judges: A Systematic Investigation of Position Bias in Pairwise
  Comparative Assessments by LLMs](https://arxiv.org/abs/2406.07791) (2024) — the swap-consistency framing
  this lesson is built on, and the argument that a one-order comparison cannot detect its own bias.
- Lianmin Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot
  Arena](https://arxiv.org/abs/2306.05685) (2023) — where pairwise comparison became the default, and the
  first reports of how reliably large judges hold a position.
- Peiyi Wang et al., [Large Language Models are not Fair Evaluators](https://arxiv.org/abs/2305.17926)
  (2023) — position bias measured directly on a fixed corpus, including the consistency rate as the
  diagnostic rather than accuracy.