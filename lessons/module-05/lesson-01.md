---
id: "05.1"
module: 5
minutes: 15
practice_minutes: 40
prerequisites: ["02.3", "03.4", "04.1"]
objectives:
  - Write one binary judge question per row of a failure taxonomy, and name the single category each one decides.
  - Break a judge's total catch rate into a per-category rate on a labelled set, and say which one decides whether it can gate.
  - Price a suite of one-question judges against a single vague judge and say what the difference buys.
volatility: concept
sources:
  - title: "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (Zheng et al., 2023)"
    url: https://arxiv.org/abs/2306.05685
  - title: "A Coefficient of Agreement for Nominal Scales (J. Cohen, 1960)"
    url: https://doi.org/10.1177/001316446002000104
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 05.1 · One failure per judge, binary first

A judge is a program that answers one question. This lesson is about writing that question — one per row
of the taxonomy you built in [2.3](../module-02/lesson-03.md), phrased so that two people would have
given it the same answer, and kept binary so that a disagreement is a fact rather than a debate about a
3 versus a 4.

## Why it matters

A team writes one judge, prompted `Is this answer good? Reply PASS or FAIL`, and wires it into their
nightly eval. It is a reasonable-looking piece of work. There is one judge, one prompt, one pass rate on
the dashboard.

On the 94-item support set, scoring the answers of the handbook-tuned system, that judge reports a pass
rate of **69.1%**. The humans who labelled the same answers report **50.0%**. Nobody panics, because
69.1% is a pass rate and pass rates go up.

Here is what 69.1% is made of. The judge waved through **23 of the 47 answers the humans failed**, and
those 23 are not one bug. They are four:

| Failure category | Items the humans failed | The vague judge caught |
| --- | --- | --- |
| `no_citation` — right fact, nothing to verify it against | 27 | 15 (55.6%) |
| `wrong_fact` — states a rule the handbook contradicts | 12 | 5 (41.7%) |
| `over_refusal` — refuses a question the handbook answers | 6 | 3 (50.0%) |
| `out_of_scope` — invents a rule the handbook does not contain | 2 | 1 (50.0%) |
| **Total** | **47** | **24 (51.1%)** |

Read the four rates in the last column: 55.6%, 41.7%, 50.0%, 50.0%. Not one of them is a decision. That is
what a judge asked "is this answer good?" looks like once you break its total down — a set of coins.

And that is the whole problem with the fix. Nobody can repair that judge, because nobody can say what it
would have to get right instead. "Answer the four questions the taxonomy already asks" is not a prompt
you can paste into a text box; it is four prompts, four confusion tables, and four TNRs. A single vague
judge is not a cheap version of four focused ones. It is a different measurement that nobody chose.

## How it works

### One judge, one question

Write the judge's question so that its answer is one word, and so that the word is decided by something
you already wrote down. Lesson [3.4](../module-03/lesson-04.md) decided *whether* a category gets a judge;
this is the sentence that judge is asked. Three of them for this taxonomy:

```
CITATION JUDGE
Does the answer name the handbook section it came from, in those words?
Answer PASS if the section is named. Answer FAIL otherwise.

FACT JUDGE
Does the answer state the rule the handbook states for this question?
Answer PASS if it matches. Answer FAIL if it contradicts or adds a condition.

REFUSAL JUDGE
Did the answer decline to answer a question the handbook answers directly?
Answer PASS if it answered. Answer FAIL if it refused.
```

Three things make that a judge rather than a wish. Each question names **one** category, so each has its
own confusion table and its own TNR. Each has an answer that is checkable — a section name, a rule, a
refusal — so when it is wrong you can point at the item. And each is binary.

### Why binary first

A binary verdict is the only scale on which a disagreement is a **fact**. Two people, or two runs of the
same judge, either said the same word or they did not; the disagreement is a row in a table you can
count. Move to five points and the same disagreement becomes "the second reader thought it was a 3 and I
thought it was a 4" — an argument about the scale that no amount of data settles, because the scale was
never yours to begin with.

It is also the only scale on which the number that decides gating exists. TNR — of the answers the
humans rejected, the share the judge also rejects — is defined on two labels. There is no TNR for a
star rating, and the usual substitute, an accuracy on a graded score, is the number Module 1 spent its
first lesson dismantling.

### The arithmetic, by hand

Here is the vague judge's table on all 94 items of the tuned system, greedy verdict, one sample:

| | Judge says pass | Judge says fail | Total |
| --- | --- | --- | --- |
| **Human says pass** | 42 | 5 | 47 |
| **Human says fail** | 23 | 24 | 47 |
| **Total** | 65 | 29 | 94 |

TPR is 42 ÷ 47 = **89.4%**. TNR is 24 ÷ 47 = **51.1%**. Accuracy is 66 ÷ 94 = **70.2%**.

Kappa needs the agreement a coin would have managed by accident. Observed agreement is 66/94 = 0.7021.
The humans say pass on exactly half the set, so chance agreement is exactly 0.5 no matter what the judge
did. Therefore

$$\kappa = \frac{0.7021 - 0.5000}{1 - 0.5000} = 0.404$$

which the page shows as **0.40**. Worth checking the rubric judge on the same 94 items the same way:
`tp 43, fp 7, fn 4, tn 40`, accuracy 83/94 = 0.8830, and because the humans still split 47/47,

$$\kappa = \frac{0.8830 - 0.5000}{1 - 0.5000} = 0.766$$

which the page shows as **0.77**. When your humans split 50/50 the whole formula collapses to
$\kappa = 2 \times \text{accuracy} - 1$, which is a free sanity check you can do in your head.

### What the questions cost

Every judge call is a model call, and this is the first module in the course where a design decision is
a line item. At the price the lab records for its 3B menu entry — $0.03794 a call, 540 ms — one judge
over 40 items is **$1.5176**. Four judges over the same 40 items is 160 calls and **$6.0704**.

So splitting one vague judge into four per-category judges costs four times as much and buys you four
numbers you can act on instead of one you cannot. That trade only makes sense after you have a taxonomy
to split on ([2.3](../module-02/lesson-03.md)) and a labelled set to measure the four against
([4.1](../module-04/lesson-01.md)). It is also why nobody does this first: it is expensive, it is slow,
and before those two lessons you would not know which four questions to ask.

## Show me

The judge lab opens on a menu of **16 recorded judge configurations**, one per lesson and one per idea.
Every entry is a real combination of a model, a prompt style and a number of few-shot examples, and the
label tells you all three: `Llama 3.2 3B · Rubric · 0 shots`, `Qwen3 0.6B · Plain · 0 shots`,
`Prometheus 2 7B · Stepwise · 0 shots`. There are four prompt styles — Plain, Rubric, Stepwise and
Critique-first — and five models. The 16 entries are the menu of recorded runs; they are not published
benchmark results for those models, and nothing on this page should ever be quoted as one.

The preset for this lesson opens on `Llama 3.2 3B · Plain · 0 shots`, variant A, on a random draw of 40
dev items with seed 7. The tiles read: judge pass rate **67.5%** (27 of 40), kappa **0.43**
(0.13–0.69), TPR **86.4%**, TNR **55.6%**, accuracy **72.5%**. The confusion table is
`tp 19, fp 8, fn 3, tn 10`. The prompt box at the bottom of the page shows the entire judge:

```
You are grading an answer. Is it good? Reply PASS or FAIL.
```

That is five lines of nothing above and one line of instruction below, and it is the whole judge.

The page prices the run in the same panel: $0.03794 a call, 40 calls, **$1.5176**, or **$7.5880** at five
repeats, 540 ms a call.

> [!IMPORTANT]
> **These labs use an educational model.** The judge verdicts behind every tile are produced by a seeded,
> parameterised model of judge behaviour, not by a real LLM. The model names in the Judge menu are the
> *menu the lab offers* — the labels under which recorded runs are filed — and not measurements of
> Llama, Qwen, Prometheus or Flow-Judge in the wild. Every statistic is computed for real in your
> browser from those recorded verdicts, so the arithmetic is exact and the judge is a stand-in. If you
> find a number from this module in a blog post attached to a named model, it has been quoted wrong.

## Try it

**Predict first, on paper.** A judge is asked `Is this answer good?` over the tuned system's answers:

1. Out of the 47 answers the humans failed, how many do you think it waves through — 5, 15, or 30?
2. Are its misses concentrated in one failure category or spread across all four?
3. If you split it into one judge per category, how many model calls does a 40-item run cost now?

Write all three down before you open anything.

[Simulation: judge-lab](../../simulations/judge-lab/index.html?preset=binary-first)

1. **Count the table before you read the tiles.** Cover the tiles and read `tp 19, fp 8, fn 3, tn 10`.
   Compute TPR, TNR and accuracy yourself. Then look. The gap between your TPR and 86.4% is the point
   estimate of a rate you read as a percentage.
2. **Break the 8 down by category.** The eight false alarms on this draw are the lesson. Put each item in
   one of the four taxonomy buckets before you go further. On the full 94 the split is 12 `no_citation`,
   7 `wrong_fact`, 3 `over_refusal`, 1 `out_of_scope` — the total failure is 23 and no single edit to the
   prompt reaches more than 12 of them.
3. **Swap one variable, not the model.** Change only the Judge dropdown to `Llama 3.2 3B · Rubric ·
   0 shots` and leave the items, seed, variant and repeats alone. Predict the new TNR first. On these
   same 40 items the rubric judge reads TPR **95.8%** and TNR **81.3%** against the plain judge's 86.4%
   and 55.6%, and the pass rate *falls* from 67.5% to 65.0%. The number got worse and the judge got
   better, and that direction is the lesson.
4. **Price your own four.** Take the four-category taxonomy from [2.3](../module-02/lesson-03.md) and
   price it two ways at $0.03794 a call: one vague judge over 40 items, and one judge per category over
   the same 40. Say out loud how often you would run each. The interesting question is not which is
   cheaper — it is which one you would be willing to block a release on.
5. **Find the judge that has no question.** Read the four prompt styles in the prompt box as you switch
   between menu entries. Which ones name a checkable thing about the answer, and which one only names a
   feeling? Write down the sentence that tells them apart; you will use it for the rest of the module.

## Break it

The knob here is **what the judge is allowed to know**, and the page hands it to you: the prompt box at
the bottom is editable, and typing into it produces a warning you are about to spend the rest of this
module on. But the quieter break needs no editing at all.

Give the same two judges the three systems in this corpus, scoring all 94 items of each, greedy verdicts:

| System | Human pass rate | Vague judge | Rubric judge |
| --- | --- | --- | --- |
| A — handbook-tuned prompt | **50.0%** (47/94) | 69.1% | 53.2% |
| B — generic prompt | **27.7%** (26/94) | 63.8% | 29.8% |
| C — small model, no retrieval | **8.5%** (8/94) | 52.1% | 17.0% |

The humans see a 41.5-point gap between the best and the worst system. The vague judge sees a 17.0-point
gap. It still orders them correctly, which is exactly why it survives: a dashboard with three numbers in
descending order looks like an eval working.

The lie, named: **a judge answering a question nobody agreed on measures the judge's taste, and reports
it as a rate.** It is 12.5 points optimistic on system A, 36.1 points optimistic on system B, and 43.6
points optimistic on system C. The error is not noise and it is not a bias you can average away — it is a
consistent direction, because "good" for this judge means something, just not the thing the humans meant.
A judge that is 51% aligned with you reads on a dashboard as 51% aligned with everyone.

The second break is the one people actually reach for: **one judge, many questions.** Ask a single judge
to report `no_citation` and `wrong_fact` and `over_refusal` in one call and average them into one score.
Now it has no TNR at all, because the three categories have different counts and different fix costs, and
the average is a number with no referent. The per-category rates you need to act are exactly the thing
the averaging destroys.

## Fix it

Four changes, all visible on the page:

1. **One question per taxonomy row, with the category's name in the question.** Not "is this good" and not
   "grade it on quality" — "does the answer name the handbook section it came from". If the question does
   not contain the category's name, nobody on the team can tell whether a bad verdict is a bad judge or a
   bad category.
2. **Binary, with the decision written as a conjunction.** `PASS only if <rule 1> and <rule 2>, otherwise
   FAIL`. That last line is doing real work: it removes the judge's freedom to decide that two of three
   is good enough, which is where most of a lenient judge's generosity comes from.
3. **Report the rate per category, not just the total.** The rubric judge's total TNR on the tuned system
   is 85.1%; per category it is 81.5% `no_citation`, 83.3% `wrong_fact`, 100% `over_refusal`, 100%
   `out_of_scope`. The total would let you ship a judge that catches every refusal and half the missing
   citations; the per-category table will not.
4. **Pin the key.** A verdict belongs to an exact configuration: the item, the system's answer, the model
   build, the full prompt text, the rubric, the few-shot ids and their order, the answer order, the
   decoding settings, the sample index. Lesson [5.3](lesson-03.md) is entirely about what happens when one
   of those changes by one character.

## How do I know it works?

**Challenge, on dev.** For one failure category from your own taxonomy, write the binary judge question,
then set targets before you run anything:

- **TNR ≥ 0.80 on dev** — of the items your humans labelled with this category, the judge must catch at
  least four in five. The vague judge scores 0.511 on the tuned system and fails this immediately. A
  check that misses one real failure in five cannot gate a release, whatever its pass rate says.
- **TPR ≥ 0.90 on dev**, on the items humans passed. A judge that catches failures by failing everything
  passes this challenge and still cannot ship. The plain judge scores 0.894 on TPR; the rubric judge
  scores 0.915 on the full 94 and 0.967 on the 57 dev items.
- **A written reason for the question**, in one sentence somebody could disagree with, naming the
  category.

Then **one held-out validation**, and it is one-way. Press **Validate on test** for the 37 items you have
not tuned against. For `Llama 3.2 3B · Rubric · 0 shots` on the tuned system: dev kappa **0.79**
(0.59–0.93) with TNR 81.5%; test kappa **0.73** (0.49–0.94) with TNR 90.0%. It holds. A judge whose test
kappa collapses is a judge you tuned to dev, and the split exists to find that out.

Write the target as a sentence with numbers in it — *"TNR ≥ 0.80 and TPR ≥ 0.90 on 40 dev items, kappa
≥ 0.75 on the 37 held-out"* — and that sentence is the contract every judge in this module has to meet.

## Use / don't use

**Do use** one binary judge per failure category, on the schedule the category deserves, for the
categories where no rule decides but people agree often enough to measure. That is most of a production
eval's judge layer, and it is cheap enough to be boring: 40 items at the 3B price is $1.5176 a run,
200 items is $7.5880, and a nightly suite of four judges over 200 items is under $31.

**Don't use** one vague judge across every category. It will cost you a quarter of what four focused
judges cost, and it will hand you a single number that no disagreement you find can be attributed to. If
you are tempted by that quarter, note where the saving lands: you still have to read the disagreements by
hand, and with one judge you cannot tell which question to fix.

**Don't gate on the pass rate.** Gate on the TNR of the category the gate is for. A release gate that
compares two pass rates is comparing two things that both moved when the judge changed, and Lesson
[5.2](lesson-02.md) is about the scale you choose before that comparison is even possible.

What teams actually do, in the order the cost climbs: one judge per category for the categories in the
top half of the taxonomy; code checks for everything decidable, free, on every commit; a frozen
hand-labelled set of 30 to 50 items that only grows; and the whole judge layer re-validated whenever the
model behind it is upgraded. That last one is not optional bookkeeping. A judge is a model, and models
change under you.

## Reflect

1. Your taxonomy has nine rows and someone has proposed a single judge covering all nine. Write the
   one-sentence reply that gets the proposal rejected, using a number from the table at the top of this
   lesson rather than the word "rigorous".
2. Take one category where your humans disagree with each other about half the time. What would you have
   to measure before you could honestly write a judge question for it — and what would you do if the
   measurement came back saying they disagree?

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Lianmin Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot
  Arena](https://arxiv.org/abs/2306.05685) (2023) — the reference point for judging an LLM with an LLM,
  and the paper whose position-bias findings Module 7 takes apart.
- J. Cohen, [A Coefficient of Agreement for Nominal Scales](https://doi.org/10.1177/001316446002000104)
  (1960) — kappa, and why agreement has to be corrected for what a coin guessing the majority label
  would have managed.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the discipline this module
  installs: define the criterion, get agreement between humans first, then automate it.