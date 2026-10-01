---
id: "05.4"
module: 5
minutes: 14
practice_minutes: 40
prerequisites: ["05.3"]
objectives:
  - State how many few-shot examples to write and choose them by counting the failure categories they represent.
  - Measure what a few-shot example set changes — verdict stability — separately from what it does not change.
  - Price the exemplars as input tokens on every call and say when the count makes them not worth it.
volatility: concept
sources:
  - title: "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (Zheng et al., 2023)"
    url: https://arxiv.org/abs/2306.05685
  - title: "G-Eval: NLG Evaluation using GPT-4 with Human Alignment (Liu et al., 2023)"
    url: https://arxiv.org/abs/2303.16634
  - title: "Large Language Models are not Fair Evaluators (Wang et al., 2023)"
    url: https://arxiv.org/abs/2305.17926
last_verified: "2026-10-01"
---

# 05.4 · Few-shot examples

Three worked examples in the judge prompt is the smallest change in this module and the one people most
often get wrong, because it usually works on the metric they were watching and does nothing to the
metric that mattered. This lesson is about measuring the two effects separately: the one exemplars
actually buy, and the one they quietly cost.

## Why it matters

A team has a rubric judge with a TNR of 0.78. Somebody says the standard trick will push it higher, and
adds three examples to the prompt: a good answer labelled PASS, another good answer labelled PASS, and
a third one — also good, also PASS. Three clean passes, because those were the easiest answers to find
in the repository.

The nightly number goes up. On the tuned system the three-shot judge passes **54.3%** of the 94 items
against the zero-shot judge's **53.2%** — one point of "improvement", entirely in the wrong direction
relative to the humans' 50.0%. And the kappa barely moves at all: **0.77 → 0.74** on a single verdict.
Six months later the team is proud of the exemplar set, and their TNR on missing citations has not
changed.

Meanwhile the thing the examples *did* fix is not in the headline at all. The zero-shot judge's five
samples of the same item disagree on **50 of the 94 items**. With three exemplars in the prompt, that
falls to **35 of 94**. That is a real, measurable 30% reduction in how often the judge waffles — and
nobody put it on the slide, because the slide had room for the pass rate.

The pattern repeats constantly: the change you made improved a number you were not reporting and made a
number you were reporting slightly worse. Choosing which examples to write is not a formatting decision.

## How it works

### What a few-shot example actually does

An example is three things at once: a statement of the format you want back, a demonstration of where the
boundary sits, and a prior on how often the answer is PASS. All three are set by what you chose, and
people choose badly on all three because they are choosing by convenience — "here are three answers that
were easy to find".

Three things determine whether an example set is worth writing:

1. **How many.** Two or three is the useful range. One teaches format without teaching a prior. Five or
   more starts to crowd the rules out of the prompt on a small context and costs input tokens on every
   call forever, for a gain that has usually flattened by the third.
2. **Which.** Chosen by counting your failure categories, not by finding good answers. The rule: **at
   least one example per category that decides the gate, at least one from the hardest slice, and a mix
   of PASS and FAIL.** An exemplar set that is all the easy case is a prior toward PASS, and it is a prior
   you did not write down anywhere.
3. **What order.** Recorded in the key, because the same three examples in a different order are a
   different judge. This is not a theoretical worry; lesson [5.3](lesson-03.md) is about what happens
   when an unkeyed field moves.

### The honest measurement on this corpus

Two menu entries use the identical rubric prompt and the identical 3B model, differing only in whether
three worked examples are in the prompt: `Llama 3.2 3B · Rubric · 0 shots` and
`Llama 3.2 3B · Rubric · 3 shots`. Both score the tuned system's answers on the same items.

**On a single greedy verdict**, the exemplars make no improvement:

| Set | Split | Kappa | TPR | TNR | Accuracy | Judge pass rate | Disagreements |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 shots | all 94 | 0.77 (0.62–0.89) | 91.5% | 85.1% | 88.3% | 53.2% | 11 |
| 3 shots | all 94 | 0.74 (0.60–0.87) | 91.5% | 83.0% | 87.2% | 54.3% | 12 |
| 0 shots | dev 57 | 0.79 (0.59–0.93) | 96.7% | 81.5% | 89.5% | 59.6% | 6 |
| 3 shots | dev 57 | 0.72 (0.51–0.89) | 90.0% | 81.5% | 86.0% | 56.1% | 8 |
| 0 shots | test 37 | 0.73 (0.49–0.94) | 82.4% | 90.0% | 86.5% | 43.2% | 5 |
| 3 shots | test 37 | 0.78 (0.56–0.95) | 94.1% | 85.0% | 89.2% | 51.4% | 4 |

Greedy, the three-shot judge is *worse* on dev (0.79 → 0.72) and better on the held-out split
(0.73 → 0.78). Those two facts are both inside their own intervals, which is the honest reading: **on a
single sample, three exemplars bought nothing you can measure.**

**What they did buy is stability.** Count the items where the judge's five samples at temperature are not
all the same:

| Judge | Items whose five samples disagree (tuned system, 94) | On the 57 dev items |
| --- | --- | --- |
| `Llama 3.2 3B · Plain · 0 shots` | 54 | 32 |
| `Llama 3.2 3B · Rubric · 0 shots` | 50 | 28 |
| `Llama 3.2 3B · Rubric · 3 shots` | **35** | **18** |
| `Llama 3.2 3B · Critique-first · 2 shots` | 40 | — |

50 down to 35 on the full set, 28 down to 18 on dev: about a third fewer items where the judge cannot
make up its mind. That is what exemplars buy — a tighter distribution around the same place. They do
not move the centre, which is exactly why the kappa on a single verdict does not move.

**Which is why you have to aggregate before you compare.** Take five samples per item and take the
majority:

| Set | Split | Kappa | Kappa 95% CI | TPR | TNR | Accuracy | Disagreements |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 shots | all 94 | 0.94 | 0.85–1.00 | 100.0% | 93.6% | 96.8% | 3 |
| 3 shots | all 94 | **1.00** | 1.00–1.00 | 100.0% | 100.0% | 100.0% | 0 |
| 0 shots | dev 57 | 0.89 | 0.76–1.00 | 100.0% | 88.9% | 94.7% | 3 |
| 3 shots | dev 57 | **1.00** | 1.00–1.00 | 100.0% | 100.0% | 100.0% | 0 |
| 0 shots | test 37 | **1.00** | 1.00–1.00 | 100.0% | 100.0% | 100.0% | 0 |
| 3 shots | test 37 | **1.00** | 1.00–1.00 | 100.0% | 100.0% | 100.0% | 0 |

This is the table the folklore is built on — 0 shots reads 0.94 and 3 shots reads 1.00 on 94 items —
and it is worth being precise about what happened, because the popular reading of it is wrong. **The
zero-shot judge also reaches 1.00 on the held-out 37 with five repeats.** So the jump is mostly the
aggregation, not the exemplars. What the exemplars did was make each individual verdict steadier, which
is what let the majority land on the right answer more often.

And a kappa of exactly 1.00 with an interval of 1.00–1.00 is not a triumph. With zero disagreements the
bootstrap has nothing to vary, so the interval collapses to a point. That is the absence of evidence, not
confidence in it — and it is exactly the shape of result you should distrust most, because it is what
tuning on a small split always produces.

### The cost you did not write down

Exemplars are **input tokens on every call, forever**. Three worked examples at a couple of hundred
tokens each is roughly +600 input tokens per verdict, on every verdict, for every item, on every run.

This lab's price sheet does not charge you for it, and that is worth being honest about: both 3B rubric
entries are listed at **660 input tokens, 38 output, $0.03794, 540 ms** — the 0-shot and the 3-shot judge
are priced identically. The menu is not modelling the exemplar cost at all. A real price sheet charges
per input token, which means a three-example prompt roughly doubles the input side of every call in your
judge suite. With four per-category judges over 200 items nightly, that is the difference between a
judge layer you run every commit and one you run nightly.

## Show me

The preset for this lesson opens the lab on `Llama 3.2 3B · Rubric · 0 shots` — the zero-shot entry —
variant A, on a random draw of 40 dev items at seed 7: pass rate **65.0%** (26 of 40), kappa **0.79**
(0.56–0.95), TPR **95.8%**, TNR **81.3%**, accuracy **90.0%**, confusion `tp 23, fp 3, fn 1, tn 13`.

The experiment is four clicks and it is the whole lesson:

1. **Pin as A.** That is your zero-shot baseline, on a seed and a sample you can come back to.
2. **Switch the Judge dropdown** to `Llama 3.2 3B · Rubric · 3 shots`. Nothing else changes — same model,
   same rubric text, same items, same seed, same repeats.
3. Read the scoreboard diff. Then **set Repeats to 5** on both, one at a time, and read it again.
4. The prompt box at the bottom of the page shows the same three rubric clauses either way: the lab keys
   the example set separately from the prompt text, and the Judge menu label is where you can see which
   entry you are on. Note what that means for the key — the examples and their order are part of what
   makes the verdict reproducible, and they are not in the prompt you can read.

> [!NOTE]
> Both rubric entries are recorded runs of the lab's seeded educational model, filed under the labels
> `Llama 3.2 3B · Rubric · 0 shots` and `Llama 3.2 3B · Rubric · 3 shots`. Those are the names under
> which the runs are recorded, not measurements of a named model in the wild, and nothing here is a
> statement about what few-shot prompting does to any real model.

## Try it

**Predict first.** Before opening the page, answer these on paper:

1. Switching from `Rubric · 0 shots` to `Rubric · 3 shots` on the same 40 items — does kappa go up or
   down, and by roughly how much?
2. Set Repeats to 5 on both. Now which one moves more?
3. If your exemplar set is three clean, cited, easy answers with no FAIL among them, in which direction
   does the judge's pass rate move?

[Simulation: judge-lab](../../simulations/judge-lab/index.html?preset=fewshot)

1. **Run the A/B.** Pin the zero-shot entry, switch to the three-shot entry, read the diff, then run
   both at Repeats 5. Write down the four numbers for each — kappa, TNR, pass rate, cost — before you
   look at anything else. You are testing whether the story in this lesson survives your own sample.
2. **Count the stability directly.** How many of the 40 items on this draw change their verdict when you
   go from Repeats 1 to Repeats 5, on each entry? Then say which of those two numbers is the one an
   exemplar set can actually influence.
3. **Choose examples by count.** The tuned system has 47 failures: 27 `no_citation`, 12 `wrong_fact`,
   6 `over_refusal`, 2 `out_of_scope`. Its 94 items are 18 easy, 46 medium, 30 hard. Write the three
   exemplars you would actually pick, naming for each one the category and the difficulty it represents.
   Then check your three cover all four categories — if they cannot, that is a finding about your rubric,
   not about your exemplars.
4. **Do the negative experiment.** Find three PASS examples from the 47 answers the humans passed on the
   tuned system and add nothing else. Which number do you expect to move, and which do you expect to
   stay? Now compare that prediction against the three-shot entry's numbers above and explain the
   difference.
5. **Price it honestly.** Take your own rubric prompt and count its tokens. Then add three worked
   examples and count again, using your provider's price sheet. Write the monthly number for your real
   judge suite size, and say whether it changes how often you would run it.

## Break it

**The all-easy exemplar set.** Three clean, cited, unambiguous answers with no FAIL among them do not
just fail to teach the failure — they set a prior toward PASS, and the effect is visible in the corpus.
On a single greedy verdict the three-shot rubric judge passes a little more of *every* system:

| System | 0 shots | 3 shots | Change |
| --- | --- | --- | --- |
| A — handbook-tuned | 53.2% | 54.3% | +1.1 points |
| B — generic prompt | 29.8% | 31.9% | +2.1 points |
| C — small model, no retrieval | 17.0% | 18.1% | +1.1 points |

Small, but the same direction on all three, including on the system that is already being failed 83% of
the time. A judge nudged uniformly toward passing is a judge whose threshold has moved, and you did not
move it in the prompt. The lie: **an exemplar set is a rubric clause you are writing without noticing,
and it is the one clause nobody puts in the review.**

**The other break is to believe the headline.** Drop three examples in, watch the kappa go 0.79 → 0.95 on
a dev draw at five repeats, and conclude the exemplars fixed the judge. The table above is the thing that
disproves it: the zero-shot judge reaches 1.00 on the held-out split at five repeats too, and the
three-shot dev kappa of 1.00 has an interval of 1.00–1.00 because there is nothing left to vary. The lie
is named: **a kappa pinned at 1.00 on a small dev split is the shape of overfitting, not the shape of a
good judge.** If your exemplar tuning produced one, the button to press is **Validate on test**, and you
should press it before you celebrate.

The third break is mundane and permanent: the examples are in the prompt, the prompt is in the key, and
the set gets rebuilt every time the eval set grows. An exemplar set that references item `s42` breaks the
moment item `s42` is re-labelled — and there is no number anywhere that will tell you it broke.

## Fix it

Three changes:

1. **Pick examples by category count, not by convenience.** One per category that decides the gate, at
   least one from the hardest slice, and at least one FAIL if the category has failures. On this corpus
   that means at least one `no_citation` example, because that category is 27 of the 47 failures — three
   clean cited answers would leave the judge that has never seen the failure mode you care about most.
2. **Measure stability, not just the verdict.** The metric an exemplar set moves is how often repeated
   samples of the same item disagree: 50/94 to 35/94 here. Report that next to the kappa, because it is
   the number the exemplars are actually responsible for and it is the one that survives into a noisy
   production run.
3. **Put the examples in the key, and freeze the ids.** The exemplars' ids and their order are part of
   what makes a verdict reproducible — exactly like the rubric version in [5.3](lesson-03.md). Pin them
   to item ids in your eval set rather than pasting text, so a re-labelled item is a loud failure rather
   than a silent drift.

And the ceiling: if the judge is at kappa 0.79 with a TNR of 0.78 because the rubric does not cover the
category that matters, three examples will not fix it. Examples teach a format and a boundary. Only a
clause changes what is being looked at.

## How do I know it works?

**Challenge, on dev.** For an exemplar set of three, set the target before you write it:

- **The zero-shot baseline is measured first, on the same items and the same seed.** A set of examples
  with nothing to compare against is a preference, not a result.
- **Non-unanimous items fall by a third or more.** 50/94 → 35/94 is the effect size this corpus shows.
  Anything smaller is inside the noise and should be reported as nothing.
- **The pass rate does not drift toward PASS on the systems the judge is already failing.** If B and C go
  up while A goes down, the exemplar set is a threshold change wearing a prompt edit.
- **Kappa does not pin at 1.00 on dev.** If it does, you have tuned on dev and the next step is the
  held-out set.

**Then one held-out validation**, and this is where the exemplar story either survives or does not. At
five repeats on the 37 test items: zero-shot kappa **1.00**, three-shot kappa **1.00**. Both perfect, both
on 37 items, both with nothing left in the bootstrap. That is the correct amount of humility to carry out
of this lesson: the two judges are indistinguishable on the evidence you have, the exemplar set is
defensible because it is cheap and it stabilises the verdict, and neither of those is a claim that three
examples made your judge smarter.

## Use / don't use

**Do use** two or three examples, chosen by category count, on judges that are already close. They are
cheap in tokens, they are the fastest fix for a judge that returns malformed output, and the stability
gain is real and measurable.

**Don't use** examples as a substitute for a clause. If the judge's TNR is low on a category, the
category has no rule, and an example is not a rule — it is a demonstration of a rule the judge may or may
not have internalised. Teams reach for examples here because they are faster to write than a clause, and
then spend a quarter re-measuring the same number.

**Don't use** more than you can hold in context.** Five examples on a small-context judge will crowd out
the rubric, and the first thing to go is the rule, because the rules are the oldest tokens.

What teams actually do: three examples, chosen from the categories that gate, pinned to item ids, hashed
into the result key, and frozen — a change to the exemplar set is a new judge with its own key and its own
re-validation, not a tweak. And they check the exemplar set against the taxonomy after every error
analysis round, because the failure categories move and a stale exemplar set teaches last quarter's
problem.

## Reflect

1. Your three-shot judge passes 1.1 points more of the tuned system, 2.1 points more of the generic one
   and 1.1 points more of the small-model one than your zero-shot judge, on a single verdict. Write the
   one sentence that explains this to a stakeholder who is pleased the number went up.
2. On the dev split the three-shot judge reaches kappa 1.00 with a 1.00–1.00 interval at five repeats, and
   the zero-shot judge reaches 1.00 on the held-out split at five repeats. What does that pair of facts
   say about how many of the 94 items you would need before you could claim three examples made the judge
   better?
3. Write the specification for your own three examples: category, difficulty, verdict, and the count from
   your error analysis that justifies each one. If a row has no count, delete the example.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Lianmin Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot
  Arena](https://arxiv.org/abs/2306.05685) (2023) — few-shot examples as part of the reference-guided
  judge design, and the paper whose consistency analysis this lesson turns on.
- Yang Liu et al., [G-Eval: NLG Evaluation using GPT-4 with Human
  Alignment](https://arxiv.org/abs/2303.16634) (2023) — evaluation criteria with explicit reasoning steps,
  the structural alternative to leaning on examples alone.
- Peiyi Wang et al., [Large Language Models are not Fair Evaluators](https://arxiv.org/abs/2305.17926)
  (2023) — the reason a judge is unstable enough for a consistency rate to be worth reporting at all.