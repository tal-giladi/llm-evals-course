---
id: "06.2"
module: 6
minutes: 17
practice_minutes: 45
prerequisites: ["06.1"]
objectives:
  - Read a confusion matrix with humans as rows and the judge as columns, and get TPR, TNR and accuracy off it without a formula lookup.
  - Show why accuracy is a statement about your eval set rather than about the judge, using a re-weighted copy of one judge's own verdicts.
  - Say which of the two rates a release gate has to be built on, and what the other one lets through.
volatility: concept
sources:
  - title: "Evaluating the Effectiveness of LLM-Evaluators (Eugene Yan)"
    url: https://eugeneyan.com/writing/llm-evaluators/
  - title: "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (Zheng et al., 2023)"
    url: https://arxiv.org/abs/2306.05685
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 06.2 · TPR, TNR and the confusion matrix

Everything a judge gets wrong arrives in one of two shapes: it passes something the humans failed, or
it fails something the humans passed. Those shapes have different consequences and only one of them is
a release blocker, which is why a single accuracy number cannot tell you whether a judge is safe.

## Why it matters

The plain judge in this lab is `You are grading an answer. Is it good? Reply PASS or FAIL.` — the
restatement from [5.3](../module-05/lesson-03.md). Run it over the 94 items of the handbook-tuned
system, greedy first sample, and read the two rates it produces:

- It passes **89.4%** of the answers humans passed.
- It fails **51.1%** of the answers humans failed.

Which means it passes **23 of the 47 real failures**. Nearly half the system's actual faults go
straight through a check that everybody on the team calls a judge.

The reason this survives is the accuracy tile. The same run reads **70.2%** accuracy — 66 of 94 verdicts
right — which on a dashboard looks like a working eval. It looks even better on the set people actually
use. Turn the sample knob up and accuracy climbs, because the failures are the minority class and a
minority class is easy to get right by saying pass. **Accuracy at 70.2% and a check that cannot fail
are the same measurement.** This lesson takes the two apart.

## How it works

### The matrix, and the two rates

Four cells, and the names only matter once you fix the rows. **Rows are humans, columns are the judge**,
so a cell counts items where the two disagreed in a particular direction:

| | Judge passes | Judge fails |
|---|---|---|
| **Humans passed** | `tp` — both right | `fn` — the judge missed a fault |
| **Humans failed** | `fp` — false alarm | `tn` — both right |

The two rates read straight off it, and the denominators are the whole argument:

$$\text{TPR} = \frac{tp}{tp + fn} \quad\text{— of the answers that were good, how many did the judge pass?}$$

$$\text{TNR} = \frac{tn}{tn + fp} \quad\text{— of the answers that were bad, how many did the judge fail?}$$

$$\text{accuracy} = \frac{tp + tn}{n} \quad\text{— of everything, how often did the two agree?}$$

Work it on ten items so you can check it. Human passes: 5 items. Human failures: 5. The judge passes 6
of the 10, so `tp = 4`, `fn = 1`, `fp = 2`, `tn = 3`:

$$\text{TPR} = \frac{4}{4+1} = 80\% \qquad \text{TNR} = \frac{3}{3+2} = 60\% \qquad \text{accuracy} = \frac{4+3}{10} = 70\%$$

Now the real run. All 94 items, variant A, greedy first sample, rows human and columns judge:

| | Judge passes | Judge fails | Total |
|---|---|---|---|
| **Humans passed (47)** | `tp` 42 | `fn` 5 | 47 |
| **Humans failed (47)** | `fp` 23 | `tn` 24 | 47 |
| **Total** | 65 | 29 | 94 |

$$\text{TPR} = \frac{42}{47} = 89.4\% \qquad \text{TNR} = \frac{24}{47} = 51.1\% \qquad \text{accuracy} = \frac{66}{94} = 70.2\%$$

And the rubric judge on the same items, same day, same answers: `tp 43, fp 7, fn 4, tn 40` — TPR
**91.5%**, TNR **85.1%**, accuracy **88.3%**. Read those two rows of the table against each other.
Both judges pass good answers at about the same rate. The entire 18-point accuracy gap is the bottom
row: the rubric judge fails 40 of the failures, the plain judge fails 24 of them.

> [!IMPORTANT]
> The plain judge is not "lenient". It is **nearly blind in one direction only**, and that is the
> direction that matters. The 8 false alarms it produces per 40 items cost a human's afternoon; the 3
> real faults it lets through per 40 items cost a user who was told something that was not true.

### Why accuracy lies, in the lab's own numbers

The lab has a panel that re-weights **the same verdicts** as if the set had a different mix of good and
bad answers. No judge is re-run; only the assumed prevalence moves. For the plain judge, holding its
measured TPR at 89.4% and TNR at 51.1% and asking what accuracy would be on a set that was 95% good:

| Good answers in the set | 50% | 70% | 85% | 95% |
|---|---|---|---|---|
| Accuracy, plain judge | 70.2% | 77.9% | 83.6% | **87.4%** |
| Kappa, plain judge | 0.40 | 0.43 | 0.39 | **0.23** |
| Accuracy, rubric judge | 88.3% | 89.6% | 90.5% | **91.2%** |
| Kappa, rubric judge | 0.77 | 0.76 | 0.67 | **0.45** |

Look down the plain judge's two rows. As the set gets more skewed toward good answers, **accuracy goes
up and kappa goes down** — 70.2% to 87.4% on the left, 0.40 to 0.23 on the right. The same judge, the
same verdicts, the same day. And at the far right, a judge that always says pass scores **95%
accuracy and kappa 0.00**: on a set that is 95% good, saying pass to everything is indistinguishable
from being right, right up until the 5% of users it was built for.

That is what "accuracy is a statement about your eval set, not about the judge" means. It is not a
slogan. It is a number that goes up as your judge gets less useful.

### Which rate gates

TPR protects you from a judge that is too harsh. TNR protects you from a judge that is too generous.
Only one of those has a failure mode that reaches a user:

- **Low TPR** — the judge fails good answers. Cost: time, because a human re-reads things that were
  fine. Annoying, visible, recoverable.
- **Low TNR** — the judge passes bad ones. Cost: the gate is decorative. Everything the taxonomy from
  Module 2 says your system gets wrong now ships, and the gate's green light is the artefact recording
  that.

So a gate is built on TNR and TPR is the floor you keep it above. The lab says it in one line: below
0.70 TNR the page warns that **most real failures sail through and this judge cannot be a release
gate**. The plain judge reads 51.1%. It is not a near miss.

The per-category view is where the single total stops being enough, and it is free — you already have
the categories from the labels:

| Human category | Items, variant A | Plain judge agrees | Rubric judge agrees |
|---|---|---|---|
| `correct` | 47 | 42 (89.4%) | 43 (91.5%) |
| `no_citation` | 27 | 15 (55.6%) | 22 (81.5%) |
| `wrong_fact` | 12 | 5 (41.7%) | 10 (83.3%) |
| `over_refusal` | 6 | 3 (50.0%) | 6 (100%) |
| `out_of_scope` | 2 | 1 (50.0%) | 2 (100%) |

The plain judge's overall 51.1% TNR is an average over categories that range from 50.0% to 55.6% —
uniformly bad, which is what "it has no clause that catches anything" looks like from the other side.
The rubric judge's 85.1% hides a category at 81.5%, and a per-category target of 0.85 would fail it.
Two numbers, two different decisions, and the total alone would have told you neither.

## Show me

This lesson's preset opens the lab on `Llama 3.2 3B · Plain · 0 shots`, variant A, on **40 dev items at
seed 7**. The tiles read **TPR 86.4%** (70.4%–100.0%), **TNR 55.6%** (31.3%–77.8%), **accuracy 72.5%**
(57.5%–85.0%), **kappa 0.43** (0.13–0.69), judge pass rate **67.5%** (52.0%–79.9%), and the confusion
table reads `tp 19, fp 8, fn 3, tn 10`.

Do this, in order:

1. Count the two denominators yourself. Of the 40 drawn items, 22 were passed by humans and 18 failed
   them, so TPR is 19/22 and TNR is 10/18. Nothing about those two numbers needs the page.
2. Read the callout under the table. TNR is below 0.70, so the page says the judge cannot be a release
   gate. That is the page deciding for you, from one number, what a team argued about for a month.
3. Switch the Judge dropdown to `Llama 3.2 3B · Rubric · 0 shots`, same 40 items, same seed: TPR
   **95.8%** (86.4%–100.0%), TNR **81.3%** (60.0%–100.0%), accuracy **90.0%**, kappa **0.79**
   (0.56–0.95), confusion `tp 23, fp 3, fn 1, tn 13`. TPR moved 9 points, TNR moved 26, accuracy moved
   18. Almost the whole story is in the bottom row of the matrix.
4. Switch the panel to **Why accuracy lies** and hold everything above. Move your real set's mix up the
   table and watch the two rows of that panel go in opposite directions.

> [!NOTE]
> Every verdict behind those tiles comes from a seeded educational model of judge behaviour, not from
> a live LLM; the model names in the Judge menu are the labels recorded runs are filed under. Every
> statistic is computed for real in your browser from those recorded verdicts. The confusion counts are
> a property of this dataset, not a claim about how Llama 3.2 3B grades anything.

## Try it

**Predict first**, on paper:

1. A judge passes 90% of the good answers and 55% of the bad ones. On this dataset — 47 good, 47 bad —
   how many of the system's real failures reach the user? What is its accuracy?
2. Your eval set is 95% good answers. What accuracy does a judge that always says pass get? What is the
   thing about it you would have to know before reporting that number?
3. A judge reads TPR 95.8% and TNR 81.3% on 40 items. Which of those two is the gate, and what happens
   to real faults if you build the gate on the other one?

[Simulation: judge-lab](../../simulations/judge-lab/index.html?preset=tnr)

1. **Do the ten-item arithmetic first, then check the real one.** With the page open, write `tp 19, fp
   8, fn 3, tn 10` and compute TPR, TNR and accuracy yourself. Then switch to **All of them** on both
   splits in turn and confirm you can reproduce 42/47, 24/47 and 66/94 by hand from the table.
2. **Find the number that hides the other one.** On the plain judge over all 94 items, the overall TNR
   is 51.1%. Now read the per-category table above and say which single category you would fix first if
   you could fix exactly one — and what its ceiling would be for the overall number.
3. **Build the always-pass judge by hand.** At 95% good answers, a judge that passes everything scores
   95% accuracy. Work out what it scores at 50%, and confirm against the prevalence panel. Then write
   the sentence you would put in a review: what single number on the panel would have caught this?
4. **Read the cost of getting it wrong.** Open the cost table under the confusion matrix: 660 input and
   38 output tokens per call, 540 ms, **$0.03794** a call. A 40-item run is **$1.5176**; 94 items is
   **$3.5664**. Then work out what 8 false alarms costs at the other end — not in dollars, in the
   engineer-hours of reading items the gate should have stopped. Which cost belongs on the page?
5. **Press Validate on test, once, and hold both halves apart.** Plain judge: dev **0.43**
   (0.20–0.64) on 57 items, test **0.37** (0.12–0.63) on 37. Rubric judge: dev **0.79** (0.60–0.93),
   test **0.73** (0.49–0.94). Write down which of those four numbers has an interval wide enough that
   you would refuse to act on the difference between two judges inside it.

## Break it

**Publish accuracy.** The plain judge reads 70.2% on 94 items. That sentence is true, it fits on a
slide, and it is compatible with a check that passes 23 of the 47 faults the humans found. Nobody
reading it can tell which of the two they are looking at. The lie: **an accuracy number with no rates
beside it describes your eval set, and most readers will take it for a description of the judge.**

**Gate on TPR.** TPR is the friendlier number — 89.4% for the plain judge, 95.8% on the 40-item sample,
and it goes up whenever you add good answers to the set. A team picks the rate that looks healthy and
builds the gate on it. The gate then reads "this build passes 89% of what it should pass" while
releasing every build in the corpus, because the rate that was never checked is the one that reaches
users. The lie: **the higher of the two rates is the one that costs you nothing to report and
everything to rely on.**

**Trust the per-category table less than the total.** The rubric judge's 85.1% TNR reads like a pass
against a 0.85 target. Per category it is 81.5% on `no_citation` and 83.3% on `wrong_fact` and 100% on
the other two — so a single total that says "we are there" sits on top of two rows that are not. The
lie: **an average over categories with different counts and different fix costs is not a target, it
is an average.**

**The free one.** Report TPR and TNR without the item count. "TNR 51.1%" on 94 items and "TNR 50.0%" on
10 items are the same sentence; one of them is a measurement and the other is two items. The interval
is what distinguishes them, and dropping it is the same move [4.4](../module-04/lesson-04.md) named for
pass rates.

## Fix it

1. **Report four numbers for every judge, always: TPR, TNR, accuracy and kappa — each with its item
   count, and kappa with its interval.** Four numbers is not clutter; it is the minimum that makes the
   other three interpretable. The plain judge is `TPR 89.4% (42/47), TNR 51.1% (24/47), accuracy 70.2%
   (66/94), kappa 0.40` on 94 items, and you cannot misread that sentence.
2. **Gate on TNR.** Write the threshold down before you build it — on this corpus, a judge with TNR
   below 0.70 fails the gate, and the plain judge at 51.1% fails it by 19 points. Then set the TPR
   floor so a judge cannot pass by refusing everything.
3. **Compute both rates per failure category**, because your categories have different costs. A judge
   at 50% on `wrong_fact` and 100% on `over_refusal` is a different product from one at 50% on both, and
   the total cannot tell them apart.
4. **Keep the rates next to the cost.** Every tile on this page has a cost table under it: $0.03794 a
   call, 540 ms. A judge that costs a cent and catches nothing is not cheap. The false alarms are the
   expensive half, and the only way to price them is to know how long a human takes to read an answer
   the gate let through.

## How do I know it works?

**Challenge, on dev.** Your judge is ready to gate when:

- **TNR ≥ 0.85 and TPR ≥ 0.90 on dev, with both denominators written next to them.** The rubric judge
  on all 57 dev items reads TNR **81.5%** (22/27) and TPR **96.7%** (29/30); the plain judge reads
  **55.6%** (15/27) and **86.7%** (26/30). On the full 94 the rubric judge reaches TNR 85.1% and the
  plain judge does not.
- **Per-category TNR is above the floor too**, with the weak category named. Rubric judge: 81.5%
  `no_citation`, 83.3% `wrong_fact`, 100% `over_refusal`, 100% `out_of_scope`. If you are shipping at
  0.85 overall, write down which categories are under it and what you are doing about them.
- **Accuracy is reported but never used as a gate.** If your threshold is an accuracy, you have built
  the gate on the rate that rises as the set gets more skewed.

**Validation, once.** Press **Validate on test** and read the test half against the dev half:

| Judge | Dev, n = 57 | Test, n = 37 |
|---|---|---|
| Plain, 0 shots | kappa 0.43 (0.20–0.64), TNR 55.6% | kappa 0.37 (0.12–0.63), TNR 45.0% |
| Rubric, 0 shots | kappa 0.79 (0.60–0.93), TNR 81.5% | kappa 0.73 (0.49–0.94), TNR 90.0% |

Both hold their shape, and on 37 items the kappa interval is 45 points wide for the rubric judge and 51
for the plain one. The plain judge's TNR falls from
55.6% to 45.0% — it was always going to miss most faults, and the held-out half is where that stops
being a development-set artefact. That is the size of the evidence you have, and it is the size you
would report.

## Use / don't use

**Do put TPR and TNR on the same screen, always, with `n`.** Two tiles and a sample count is the whole
requirement. Every disagreement about whether a judge is "good enough" in practice turns out to be a
disagreement about which of the two rates is being quoted.

**Do report per category when the taxonomy exists.** It costs nothing — you already have the category
on every item — and it is the only view that tells you whether a judge is uniformly mediocre or
excellent everywhere except the thing your users complain about.

**Don't use accuracy to compare two judges.** Two judges on two sets with different mixes will rank
differently under accuracy and under kappa, and the accuracy ranking is the one that flips when someone
adds items. The rubric judge reads 88.3% accuracy against the plain judge's 70.2% here, but the gap is
entirely TNR, and TNR is the part you can act on.

**Don't tune a rate on the same items you report it on.** Choosing the judge by its dev TNR and then
publishing that dev TNR means the number describes your search, not the judge. This is the split from
[4.2](../module-04/lesson-02.md), and the **Validate** button exists so you pay for it exactly once.

What teams actually do in production: run the agreement suite nightly and publish four tiles — kappa
with its interval, TPR, TNR and item count — against the frozen human set, with the per-category table
one click away rather than on the main page. A release gate is set on TNR at a level chosen from how
many faults a day the team is willing to read, which is a number somebody should say out loud. When a
judge's TNR drops below the gate, the usual response is not a new prompt: it is a look at the
disagreements, which is the next lesson.

## Reflect

1. A judge reads TPR 96.7% and TNR 81.5% on 57 dev items. A stakeholder reads "96.7% accurate" from a
   slide that showed the wrong tile. Write the two sentences that repair the slide and the number
   behind it.
2. Your set is 90% good answers. A new judge reads 85% accuracy against the incumbent's 78%. Work out,
   without the page, what each judge's kappa would be if TPR and TNR were unchanged, and say which of
   the two you would put in the release note.
3. The plain judge fails 24 of 47 real failures. List the three things you would do about it in order of
   cost, and say which one changes the TNR tile and which one only changes the pass rate.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- Eugene Yan, [Evaluating the Effectiveness of
  LLM-Evaluators](https://eugeneyan.com/writing/llm-evaluators/) — the synthesis behind this lesson:
  agreement with humans has to be measured before a judge is trusted, and measured as rates rather than
  as one number.
- Lianmin Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot
  Arena](https://arxiv.org/abs/2306.05685) (2023) — why a judge's failures are asymmetric, and why the
  systematic bias directions are worth separating from the random ones.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the discipline underneath the
  rates: you do not have a judge until you have measured it against humans, and the measurement is part
  of the eval.