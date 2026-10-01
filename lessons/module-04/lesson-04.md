---
id: "04.4"
module: 4
minutes: 16
practice_minutes: 40
prerequisites: ["04.3"]
objectives:
  - Work the Wilson interval by hand on a small sample and get the same numbers the lab prints.
  - Choose a sample size by naming the change you need to detect and reading the width of the interval that size buys.
  - Say why "we tested on 30" is not a claim about a system, and state the width the number came with.
volatility: concept
sources:
  - title: "Probable Inference, the Law of Succession, and Statistical Inference (E. B. Wilson, 1927)"
    url: https://doi.org/10.1080/01621459.1927.10502953
  - title: "Interval Estimation for a Binomial Proportion (Brown, Cai & DasGupta, 2001)"
    url: https://doi.org/10.1214/ss/1009213286
  - title: "Hamel Husain — Evals FAQ"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 04.4 · Sample size and confidence intervals

"How many items do I need" has one honest answer and it is not a number. It is: **enough that the
interval is narrower than the smallest change you need to be able to detect.** This lesson does the
arithmetic by hand so you can check it, then works backwards from a change to a size.

## Why it matters

A team picks 30 items because 30 is what fits in a Friday. They run their new prompt against the old
one on those 30 and the pass rate goes from 60.0% to 76.7%. That is 5 items out of 30 flipping, they
write it up as a 17-point improvement, and they ship.

Nothing is wrong with any of those numbers. 5 out of 30 is exactly 16.7%. The problem is that on 30
items this population produces draws of the *same unchanged system* that land more than 20 points
apart, so a 17-point move is not a measurement — it is an ordinary Thursday. The team's prompt
change might have been worth 17 points. It might have been worth nothing. The run cannot tell them,
and the write-up says 17 points because that is the only number the run produced.

They then build the next eval on the same 30 items, because 30 items is what the suite already has,
and the habit outlives the decision.

This is the failure [1.1](../module-01/lesson-01.md) named and this module has now earned the right to
name precisely. A pass rate is a fact about the system and the sample. Without the interval it is a
fact about the sample.

## How it works

### The interval, by hand

Everything the labs print is the **Wilson score interval**, and it is five lines of arithmetic. Take
the 20-item draw the eval lab opens on at seed 11: **8 items pass out of 20**. So

$$p = \frac{8}{20} = 0.400, \qquad z = 1.96, \qquad z^2 = 3.8415$$

$$\text{denominator} = 1 + \frac{z^2}{n} = 1 + \frac{3.8415}{20} = 1.1921$$

$$\text{centre} = p + \frac{z^2}{2n} = 0.400 + \frac{3.8415}{40} = 0.400 + 0.0960 = 0.4960$$

$$\text{margin} = z\sqrt{\frac{p(1-p) + z^2/4n}{n}} = 1.96\sqrt{\frac{0.240 + 0.0480}{20}} = 1.96\sqrt{0.01440} = 0.2352$$

$$lo = \frac{0.4960 - 0.2352}{1.1921} = \frac{0.2608}{1.1921} = 0.2188 = \textbf{21.9\%}$$

$$hi = \frac{0.4960 + 0.2352}{1.1921} = \frac{0.7312}{1.1921} = 0.6134 = \textbf{61.3\%}$$

That is the lab's line: **40.0% (21.9%–61.3%)**, width 39 points. Do the same six numbers for
10 out of 20 and you get **50.0% (29.9%–70.1%)**, width 40; for 16 out of 30, **53.3% (36.1%–69.8%)**,
width 34.

Why Wilson and not the familiar `p ± 1.96·√(p(1−p)/n)`? Because that one runs past 100% near $p = 1$,
which is exactly where eval sets live once a feature is good. On 20 items with 20 passes the Wilson
interval is **83.9%–100.0%**, which is honest; the normal approximation gives 100% ± 9.6% and calls
109.6% a confidence interval. Wilson is what the labs use everywhere, and the arithmetic above is
worth being able to do without a spreadsheet.

### The lab's size table, read as a price list

The panel titled **Sample size against interval width** runs the same population, the same judge and
the same seed through every size from 10 to 94 in steps of 5. At seed 11:

| Items | Pass rate | Wilson 95% CI | Width |
|---|---|---|---|
| 10 | 40.0% | 16.8%–68.7% | 52 pts |
| 15 | 40.0% | 19.8%–64.3% | 44 pts |
| 20 | 40.0% | 21.9%–61.3% | 39 pts |
| 25 | 44.0% | 26.7%–62.9% | 36 pts |
| 30 | 53.3% | 36.1%–69.8% | 34 pts |
| 35 | 51.4% | 35.6%–67.0% | 31 pts |
| 40 | 52.5% | 37.5%–67.1% | 30 pts |
| 45 | 53.3% | 39.1%–67.1% | 28 pts |
| 50 | 52.0% | 38.5%–65.2% | 27 pts |
| 55 | 54.5% | 41.5%–67.0% | 25 pts |
| 60 | 53.3% | 40.9%–65.4% | 24 pts |
| 65 | 55.4% | 43.3%–66.8% | 23 pts |
| 70 | 54.3% | 42.7%–65.4% | 23 pts |
| 75 | 53.3% | 42.2%–64.2% | 22 pts |
| 80 | 52.5% | 41.7%–63.1% | 21 pts |
| 85 | 51.8% | 41.3%–62.1% | 21 pts |
| 90 | 52.2% | 42.0%–62.2% | 20 pts |

Two columns of that table are the lesson. The **pass rate** column wanders between 40.0% and 55.4%
with no reason in it — that is the sample moving, not the system. The **width** column falls from 52
points to 20, and that is the only part of the table that is buying anything.

### Why the interval halves when you quadruple

Read the width column at three sizes: **20 → 39 points, 40 → 30 points, 80 → 21 points.** Doubling the
sample from 20 to 40 bought 9 points. Doubling it again, from 40 to 80, bought 9 more. Quadrupling
outright, 20 to 80, bought 18 — roughly half the original width, which is the only thing that works.

That is not a quirk of this population. The margin of a proportion's interval goes as $1/\sqrt{n}$, so
the width goes as $2/\sqrt{n}$, and halving the width means multiplying $n$ by four:

$$w \propto \frac{1}{\sqrt{n}} \qquad\Rightarrow\qquad \frac{w_1}{w_2} = 2 \iff n_2 = 4 n_1$$

This is why "just add a few more items" never feels like it works. Every doubling you buy back roughly
a third of the width you had. It is the single most common disappointment in eval work: a team doubles
its set, sees the interval shrink by a third, and concludes that sampling noise is not the problem.

### Choosing the size, backwards

The size is not chosen from a habit. It is chosen from the change:

> **Name the smallest improvement you would refuse to ship without. Take the size whose interval is
> narrower than that number.**

Two examples, both from the arithmetic in this lesson.

**You need to see a 15-point change.** A width of 15 points or less needs roughly **157** items at a
pass rate near 50%. This course's entire population is 94 items, which reads **50.0% (40.1%–59.9%)**
— a 20-point-wide interval. **On this population you cannot buy a 15-point interval at any price.**
There is no sampling strategy and no seed that produces it, because the whole set is 94 items wide. If
your decision needs 15 points, the decision is not available to you on this set, and the honest move
is to say so rather than to quote the 50.0%.

**You need to see a 10-point change.** That needs roughly **345** items — nearly four times what
exists. Three times the population, at real labelling cost. Nobody in this course is going to tell you
that is free.

Now the direction that actually works, which is the one teams miss: **do not buy a narrower interval
when you should buy a smaller change to detect.** If you cannot resolve 10 points, the eval's job is
not to measure the difference between prompt A and prompt B — it is to catch a regression. A
regression is bigger than 10 points, and a 20-point interval catches a 20-point regression perfectly
well. Write the target down as "no drop larger than 10 points", not as "prompt B is better than prompt
A", and the size you already have is the right size.

And while you are choosing: notice that the intervals overlap even at the full population. The tuned
system reads **50.0% (40.1%–59.9%)**; a candidate at 59.6% on the same 94 items reads **49.5%–68.9%**,
and at 66.0% it reads **55.9%–74.7%**. Both overlap. Two *unpaired* interval comparisons at n = 94
cannot resolve a 10-point difference — which is why the right tool for comparing two systems is a
paired one over the same items, where the item-to-item difficulty cancels out. Module 10 is where that
lives. This lesson's job is to make sure you arrive there knowing the size of your noise.

## Show me

The sample-size preset opens at 20 items, random, seed 11. The **Your sample** panel reads **Pass rate
40.0% (21.9%–61.3%)**, **Items drawn 20**, **Interval width 39 pts**, and the tile is coloured because
39 points is wide.

The **Items you drew** panel underneath shows twelve rows with a ✓ or a ✗ each. Count the ✓s — eight
of the twenty drawn items are passes, and the rest carry a ✗. The meta line on a failing row reads
`policy fact · easy · no citation`: that is a **human** verdict of fail, which is why the pass rate
tile reads 40.0%. The tuned system passes 47 of all 94; the tile on a 20-item draw reads 40.0% because
those twenty are a different set. This is the eval lab's pass rate and it is the human labelling, not a
judge's verdict — Module 6 is where the two come apart.

Now turn **Seed** from 11 to 10, holding everything else. The pass rate becomes **75.0%
(53.1%–88.8%)**. Seed 3 gives **40.0%**. Seed 34 gives **25.0% (11.2%–46.9%)**. Over the 200 seeds the
knob offers, a 20-item draw of this population lands anywhere between **25.0% and 75.0%** — a
50-point range on an unchanged system, an unchanged check and an unchanged population. That range is
the interval, measured by hand instead of by formula, and it is the same fact as "39 points wide" said
differently.

Set **All of them** and the seed stops mattering: 94 items, **50.0% (40.1%–59.9%)**, width 20. The
number did not get truer. It got narrower, which is the same thing.

## Try it

**Predict first**, on paper, before you open anything:

1. Your suite reads 60.0% on 30 items. Write the smallest pass rate on those same 30 items that this
   population would produce by accident, using the width the table gives you.
2. You need to detect a 15-point improvement. What does the arithmetic say about whether this
   94-item set can support that, and what do you do with the answer?
3. Doubling a sample from 20 to 40 bought you 9 points of interval. How much would doubling from 40 to
   80 buy, and why is it not 18?

[Simulation: eval-set](../../simulations/eval-set/index.html?preset=sample-size)

1. **Do the Wilson arithmetic yourself on a real row.** With the lab open at 20 items and seed 11,
   write down the 8 passes out of 20 and compute the six quantities in **How it works** by hand. Check
   each against the tile. Then set the seed to 10, count the new passes, and do it again — the only
   thing that changed is the numerator.
2. **Read the size table as a price list and pick a target.** Write down the width at 10, 20, 40 and
   80. Now name the smallest improvement you would refuse to ship without, and find the width you
   would need. Write the sentence "at n = … I can resolve a … point change, not a … point change" and
   keep it.
3. **Prove the quartering rule.** From the size table, record the width at 10, 20, 40 and 80 and
   multiply each width by $\sqrt{n}$. If the constant is the same, the width really does go as
   $1/\sqrt{n}$ and your next doubling buys a third of what the last one did.
4. **Find the floor.** Set **All of them** and note the width at 94. Then answer the question this
   course cannot: what would you have to add to reach a 15-point interval? The arithmetic in
   **How it works** says roughly 157 items — so what does the missing 63 cost you, and what does that
   tell you about which decisions you should be asking this eval to support?
5. **Turn the seed and watch the width stay put.** At 20 items, set the seed to 3, 10, 34 and 91. The
   pass rate moves across 50 points and the width barely moves — it is 36 to 40 points every time.
   Write down what that means about the two numbers, and which of them you would put on a dashboard
   with no other number beside it.

## Break it

Set the size to 30, which is what fits in a Friday, and read the top line of the size table: **53.3%
(36.1%–69.8%)**, 34 points wide.

Now imagine the write-up. "Prompt B scores 53.3% against prompt A's 40.0% on 30 items — a 13-point
improvement." Both numbers are real. Both intervals are real. And the whole claim fits inside the
interval of either one: 40.0% sits comfortably inside 36.1%–69.8%, and so does 53.3%. The run cannot
distinguish a 13-point improvement from the 34 points of noise sitting on top of it, which is why the
same table shows prompt A reading 40.0% at n = 20 and 52.5% at n = 40 without anything changing.

The quieter break is free. Take the 30-item figure and drop the interval — the tile still renders, the
dashboard still accepts it, and "53.3% on 30 items" is a sentence a reader will accept as a measurement.
It is the same sentence, with the only part of it that knew how much was the system removed.

The lie has a name and it is the one this course opened with: **a pass rate with no interval is a
statement about which items you happened to pick.** "We tested on 30" is not a weak claim about the
system. It is a precise claim about the sample, and 30 items on this population is a 34-point-wide
claim.

## Fix it

Four changes, and the first is the one that changes the conversation:

1. **Never publish a pass rate without its interval and its item count.** "53.3% (36.1%–69.8%) on 30
   items" is a claim. "53.3%" is a rumour. Three numbers, always, and the item count is the one people
   leave off.
2. **Write the target change down before you size the set, not after.** The size is a consequence of
   the smallest change you need to detect. A suite sized by habit has no target, which is why it can
   never be shown to be good enough.
3. **Spend your budget on regression detection rather than on resolving small wins.** A 20-point
   interval on 94 items catches a 20-point regression. If that is the job, the job is done and the set
   does not need to be four times bigger.
4. **When the target is out of reach, say so in writing.** "This eval can resolve a 20-point drop, not
   a 10-point one" is a sentence that changes decisions. "Our eval set is 94 items" is not, because it
   is a fact about the inventory rather than about the measurement.

None of those four made the system better. They made the number's size visible, which is the thing a
point estimate can never do for itself.

## How do I know it works?

**Challenge, on dev.** Write your target sentence before you touch the knobs. Then hit three targets:

- **Every number you plan to publish has an interval and an item count attached**, including the ones
  in the headline of a slide. A pass rate alone does not count as a result.
- **Your stated resolution is narrower than your stated target change**, or you have written down why
  the job is regression detection instead. Both are defensible; having neither is not.
- **Your set size is chosen, not inherited.** You can name the width that size buys, from the table,
  and you can say what resolution you would have to give up to go smaller.

Then do the experiment that catches a team which has only written the sentence down: **set the size to
20 and turn the seed across its range.** You will see the pass rate swing between 25.0% and 75.0% while
the width sits at 36 to 40 points the whole time. Now set **All of them** and watch the swing
disappear. Everything the seed was doing is now gone, because there is no longer anything left to
sample.

**Validation, once.** Take the 37 held-out items from [4.2](lesson-02.md). Your dev figure carries a
25-point interval and test carries a 31-point interval, and the 6.7-point gap between them sits inside
both. Write the resolution sentence for the held-out half explicitly: on 37 items this eval can
resolve a drop of about 30 points and nothing smaller. Then ask, on paper, what you would have done
differently if the test number had come back 25 points down. If the answer is "shipped, and then
looked at", that sentence is your gate, and it is now written down before you need it.

## Use / don't use

**Do size the set from the decision.** A nightly regression gate, a weekly dashboard, a release
blocker and a one-off investigation want different numbers, and the difference is usually tens of
items rather than hundreds. A gate that only has to catch a 20-point drop does not need to resolve a
5-point improvement, and paying for the second is how eval projects get cancelled.

**Do use cheap checks to carry cheap decisions.** A code assertion on 500 items is free and its
interval is not the thing anyone argues about. The expensive, carefully sized set belongs to the check
whose verdict is hard to reverse — usually the judge, because tuning it is what
[4.2](lesson-02.md)'s test set is protecting.

**Don't pick the size by what you already have.** That produces a suite that can justify exactly the
decisions you wanted to justify before you built it, which is the failure wearing a methodology's
clothes.

**Don't treat a wide interval as a reason to stop reporting.** The alternative to 39 points is not a
better number, it is no number, and a team with no number makes the decision on vibes instead. Report
the wide one and let the width be part of the argument.

What teams actually do in production, in the order the cost climbs: run code checks on every pull
request over as many items as they are free on; run the judge suite nightly on 30 to 60 items and
gate only on regressions larger than its interval; re-read a frozen human-labelled set of 30 to 50
items every couple of weeks, where the interval is widest and the decision is least automated. The
per-run judge cost on this course's recorded pricing is $0.03794 a call, so 40 items is $1.5176 and
60 items is about $2.28 — trivial against the hours a team spends arguing about whether 5 points of
pass rate is real.

## Reflect

1. Your next eval decision is "is prompt B better than prompt A". Write the resolution sentence for
   the set you have. If it says you cannot answer the question, write down what you would change —
   and whether the change is 50 more items or a different question.
2. A team doubles its suite from 30 to 60 items and the interval narrows from 34 points to 25. They
   call that a success. Write the one sentence that explains what they actually bought, and what they
   would have to buy to halve it.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- E. B. Wilson, [Probable Inference, the Law of Succession, and Statistical
  Inference](https://doi.org/10.1080/01621459.1927.10502953) (1927) — the interval every lab in this
  course prints, and the one that behaves at pass rates near 100% where the normal approximation does
  not.
- Lawrence Brown, T. Cai and Abhijit DasGupta, [Interval Estimation for a Binomial
  Proportion](https://doi.org/10.1214/ss/1009213286) (2001) — why the Wilson interval is the right
  default for small samples, and what it costs to use it.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the habit behind this lesson:
  the size of the set follows from the decision, and the interval is part of the number.
