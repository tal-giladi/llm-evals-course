---
id: "04.3"
module: 4
minutes: 15
practice_minutes: 35
prerequisites: ["04.2"]
objectives:
  - Define a slice as an attribute that changes the work rather than a demographic, and list the slices your own system has.
  - Read a per-slice coverage table and say, for each row, whether a true-negative rate is computable on it.
  - Argue for allocating failing items inside a slice rather than preserving the slice's share of the population.
volatility: concept
sources:
  - title: "Stratified sampling (Wikipedia)"
    url: https://en.wikipedia.org/wiki/Stratified_sampling
  - title: "Oversampling (Wikipedia)"
    url: https://en.wikipedia.org/wiki/Oversampling
  - title: "Anthropic — Define success criteria and build evaluations"
    url: https://platform.claude.com/docs/en/docs/test-and-evaluate/develop-tests
last_verified: "2026-10-01"
---

# 04.3 · Stratification and slices

A slice is a group of items where the answer is harder, or the mistake costs more, or the check behaves
differently. This lesson is about the slice your sample did not contain: a slice can be present in your
set with items in it, carry **zero** of the failures you need it for, and therefore report nothing at
all while the headline number looks perfectly healthy.

## Why it matters

A team validates its judge on a random draw of 20 items and gets a true-negative rate of 48.9%. They
set the release gate at 45% and ship the judge. The judge is, in fact, that good: on the full
94-item set it catches 23 of the 47 items the humans marked fail.

Now look at that judge one slice at a time. On `policy_fact` it catches 11 of 18 failures. On
`boundary` it catches 7 of 19. On `how_to` it catches 4 of 6. On `out_of_scope` it catches 1 of 2. And
on `exception` — the three items in the population where the handbook has an edge case — **it catches
none of the two**. A true-negative rate of 0.0% on the smallest and hardest slice, sitting inside a
healthy-looking overall number that says nothing about it.

Nothing about the validation was done wrong. The draw was random, the size was defensible, the judge
was measured against human labels. The failure is that the overall number is an **average over the
slices that happened to be in the sample**, and the slices least likely to be in the sample are the
rare ones — which are exactly the slices the judge is worst on. The number does not know it is an
average. It is printed as one figure, in one tile, with a name that suggests it applies to the
product.

The customer who finds this out asks a question with a share scheme in it.

## How it works

A **slice** is a group of items that share one attribute which changes the work: the intent behind the
question, the difficulty, the length, the language, the customer tier, the part of the product it came
from. It is not a demographic. "Users on the free plan" is a slice if being on the free plan changes
what the answer has to do; "users on the free plan" as a fairness monitoring bucket is a different
thing and belongs in a different system.

The lab's items carry two slice attributes, and the panel underneath the tiles prints both:
`slice.intent` and `slice.difficulty`. Across the 94 items:

| Intent slice | Items | Failing items for the tuned system | Pass rate |
|---|---|---|---|
| `policy_fact` | 34 | 18 | 47.1% (31.5%–63.3%) |
| `boundary` | 31 | 19 | 38.7% (23.7%–56.2%) |
| `how_to` | 19 | 6 | 68.4% (46.0%–84.6%) |
| `out_of_scope` | 7 | 2 | 71.4% (35.9%–91.8%) |
| `exception` | 3 | 2 | 33.3% (6.1%–79.2%) |

Two rows in that table are the whole lesson. `exception` is 3 items out of 94, and 2 of them fail.
`out_of_scope` is 7 items, and 2 of them fail. A random draw of 20 contains, in expectation, **0.64**
`exception` items and **1.49** `out_of_scope` items.

### A slice with zero items is a hole. A slice with zero failures is worse.

These are different states and the scoreboard treats them the same way at first glance:

- **Zero items drawn.** You know immediately. The slice is absent, the panel says `0 of 3`, and any
  rate you quote about that slice is obviously unavailable.
- **Zero failing items drawn.** You do not know immediately, because there are items in the row and
  the numbers on the row look normal. The pass rate for that slice is perfectly computable — it is
  100% — and the number that is *not* computable is the one that mattered.

The number that is not computable is the true-negative rate. It is the share of human failures the
check caught, and its denominator is the human failures in the slice:

$$\text{TNR}_{\text{slice}} = \frac{\text{real failures the check caught}}{\text{real failures in the slice}}$$

With no real failures in the slice, the denominator is zero. The rate does not exist, not as a low
number and not as an estimate — and, crucially, **the slice then contributes nothing to the overall
rate**. It is not weighted in at zero, which would be pessimistic. It is simply gone. So the overall
true-negative rate gets recomputed over the surviving slices, the rare hard ones are exactly the ones
that went missing, and the headline number goes **up** rather than down.

The lab prints this in its own words, in the warn callout under the slice table:

> **Slices with no failing items:** exception, out of scope. A slice with zero failures contributes
> nothing to the true-negative rate, so the judge looks better than it is on exactly the population
> you care about.

### Keeping the slice mix is not the same as covering the failure

Set **How to choose them** to **Keep the slice mix** and the draw changes: 20 items, 9 `policy_fact`,
5 `boundary`, 4 `how_to`, 1 `exception`, 1 `out_of_scope` — roughly the population proportions, and a
different set of items, so the pass rate moves from 40.0% to **50.0% (29.9%–70.1%)**.

And the slice table still reports **none seen** on `exception` and on `out_of_scope`. Every slice is
now represented, and two of them still cannot tell you anything about a check.

That is not a defect in the knob. It is arithmetic. A mix-preserving draw of 20 gives you 0.64
`exception` items and 1.49 `out_of_scope` items; the `out_of_scope` one is a failing item only two
times in seven, so the expected number of `out_of_scope` **failures** in your stratified sample is
1.49 × 2/7 ≈ 0.43. You cannot measure a rate on 0.43 of an item, and no amount of preserving the mix
will change that — **the mix is 3 in 94, and preserving a share of 3% gives you shares of 3%.**

Turn the seed knob through its 200 values at n = 20 and count:

| Strategy | Draws of 20 leaving at least one slice with no failing item | `out_of_scope` with none | `exception` with none |
|---|---|---|---|
| At random | **178 of 200** | 127 | 117 |
| Keep the slice mix | **180 of 200** | 128 | 130 |

Nine times in ten, a 20-item sample of this population cannot tell you how a check behaves on its
two smallest slices. Stratifying by slice guarantees that every slice is *drawn from*; it does not
guarantee that any slice's **failures** are drawn, because failures are rarer than slices and the rare
failures are the ones in the rare slices.

That is the distinction this lesson exists to install. **Stratification is about which slices you draw
from. Allocation is about how many failing items you end up with inside each one.** You need both, and
the second is not automatic from the first.

### What it actually costs

The honest number is uncomfortable. Holding the seed at 11 and raising the size at random:

| Size | `out_of_scope` drawn | of which failing | Slice table verdict |
|---|---|---|---|
| 30 | 0 of 7 | 0 | `none seen` |
| 40 | 1 of 7 | 0 | `none seen` |
| 57 | 1 of 7 | 0 | `none seen` |
| 70 | 4 of 7 | 0 | `none seen` |
| 80 | 6 of 7 | 1 | measured |
| 94 | 7 of 7 | 2 | measured |

You need 80 items — 85% of the population — before random sampling at this seed gives the
`out_of_scope` slice a single failing item. Over all 200 seeds, a random draw of 57 still leaves a
slice with no failing item **53 times in 200**. Random sampling is not a cheap way to cover rare
slices; on this population it is an expensive one that mostly fails.

## Show me

The stratify preset opens at 20 items with **Keep the slice mix** already selected. The **Your sample**
panel reads **Pass rate 50.0% (29.9%–70.1%)**, **Items drawn 20**, **Interval width 40 pts** — and the
tile is coloured on the interval, because 40 points is wide.

The panel below it, titled **What your sample actually contains**, has four columns: `Slice`,
`Sampled`, `Failing items`, `TNR measurable?`. Two rows read `none seen`:

| Slice | Sampled | Failing items | TNR measurable? |
|---|---|---|---|
| policy fact | 9 of 34 | 6 | measured |
| boundary | 5 of 31 | 1 | measured |
| exception | 1 of 3 | 0 | **none seen** |
| how to | 4 of 19 | 3 | measured |
| out of scope | 1 of 7 | 0 | **none seen** |

That table is the lesson. There are 20 items in the sample, the pass rate is a real 50.0%, and two of
the five slices in your product have contributed nothing to any rate you are about to quote. Neither
row is flagged red in a way a dashboard would catch — the row is present, the count is present, and
the only warning is the two words in the last column.

Switch **How to choose them** to **At random** and the table changes shape entirely (at seed 11:
`exception` 0 of 3, `out_of_scope` 0 of 7, so both slices vanish rather than reporting nothing) and the
pass rate drops to **40.0% (21.9%–61.3%)**. Same system, same seed, same size, a 10-point difference
in the headline and a completely different set of slices underneath it. That is the risk being priced.

### The judge number behind the table

The judge lab records the run this course uses as its weak example — a plain binary prompt, no rules,
no examples. Over all 94 items it catches **23 of 47** human failures, a true-negative rate of
**48.9%**. Per slice:

| Slice | Human failures | Caught | TNR |
|---|---|---|---|
| `policy_fact` | 18 | 11 | 61.1% |
| `boundary` | 19 | 7 | 36.8% |
| `how_to` | 6 | 4 | 66.7% |
| `out_of_scope` | 2 | 1 | 50.0% |
| `exception` | 2 | 0 | **0.0%** |

Measure that same run on 20-item draws instead of on all 94, and the figure it reports ranges from
**11.1%** to **88.9%** with a median of 46.2%, depending only on which items the seed picked. The judge
never changed; neither did the system; the interval on the headline number is not the only thing to
read. **The number you report is a weighted average, and the weights are an accident of the draw.**

## Try it

**Predict first**, on paper, before you open anything:

1. A random draw of 20 from this population contains how many `exception` items, on average? And how
   many `out_of_scope` **failures**?
2. Your sample contains 20 `out_of_scope` items and zero of them fail. Does the set contain a hole in
   `out_of_scope`? What can and cannot you say about the check on that slice?
3. Your set has 3 `exception` items and 2 of them fail, and the check catches both. What is the TNR,
   and what is the interval on it?

[Simulation: eval-set](../../simulations/eval-set/index.html?preset=stratify)

1. **Read the slice table before the pass rate.** On the preset, two rows say `none seen`. Write the
   failing-item count for every row next to its `TNR measurable?` verdict, then decide which rows you
   are allowed to quote a rate for.
2. **Prove the arithmetic yourself.** A proportional draw of 20 from 94 items gives `exception` 3 ×
   20 ÷ 94 = 0.64 items. Multiply that by 2/7 for `out_of_scope` failures and 0.43. Write both down,
   then find the smallest size at which you would expect one full failing item in each of the two rare
   slices, and check your answer against the table in **How it works**.
3. **Turn the seed across its range and count.** Hold the size at 20, switch between **At random** and
   **Keep the slice mix**, and turn the seed from 1 to 40. For each, record whether a `none seen` row
   appears. Extrapolate from what you have seen to the full 200 the knob offers, and say whether the
   difference between the two strategies is the kind of difference you can act on.
4. **Buy coverage with size, and see what it costs.** Raise the size from 20 to 40, then 57, then 80,
   holding the seed at 11 and the strategy on **At random**. Record the `out_of_scope` row at each size.
   At which size does `none seen` finally become `measured`, and what fraction of the population had
   you spent by then?
5. **Name the slices your own system has.** Write down five attributes that change the work rather than
   the person, count how many items of each exist in your product's real traffic, and put the failing
   count beside it. Any row where the failing count is zero is a row your eval cannot currently say
   anything about, and it is not fixed by making the set bigger.

## Break it

Put the headline number on the slide and leave the slice table below the fold.

The number is defensible — it is a real 50.0% (29.9%–70.1%) computed over 20 items with human labels —
and it is a statement about the judge over the slices that survived the draw. It is not a statement
about the judge over your product, because `exception` and `out_of_scope` were not in the denominator
and nobody was told so. A release decision taken on that slide is a decision about the three slices
that happened to have items in them.

The sharper version is to compare the wrong thing. The overall true-negative rate of that weak judge is
48.9% on all 94 items, and a 20-item draw will hand you anywhere from 11.1% to 88.9%. A team that
validates on 20 items, reads 88.9%, and sets the gate at 80% has not made a lucky decision. It has
made a decision whose accuracy depended on a seed.

The lie has a name and it is worth saying out loud in a review: **an average over the slices your
sample happened to contain, printed as one number about the product.** The missing slices do not
appear in it as zeros. They do not appear at all, and they are always the ones with the fewest items.

## Fix it

Four changes, and each one is a line in the table rather than a change to a number:

1. **Read the per-slice table before the headline, every run.** If a row says `none seen`, that row
   does not exist for this run and nothing on the scoreboard says so. Make it a hard rule that a run
   with a `none seen` row is not a release candidate.
2. **Allocate failing items, not just slices.** Stratify to guarantee every slice is drawn from, then
   over-sample the slices whose failing count is small — take **all 7** `out_of_scope` items and **all
   3** `exception` items rather than 1.49 and 0.64 of them. This is the allocation argument from
   [4.1](lesson-01.md) applied inside a slice rather than across the whole set.
3. **Put the failing count next to every rate you quote.** "TNR 61.1%" is a claim. "TNR 61.1% on 18
   failures" is a claim somebody can check, and on 2 failures it is a claim nobody should be making.
4. **Say "unmeasured" out loud, and gate on something else for that slice.** Two failing items cannot
   be measured — the interval on a perfect 2 out of 2 runs from 34.2%. A team that knows this gates
   the `exception` slice on a hand-written assertion; a team that does not reads 100% and sleeps.

None of those four makes the judge better. They stop the number from being about a population nobody
chose.

## How do I know it works?

**Challenge, on dev.** Take the stratified preset and write down five targets before turning any knob:

- **Every slice in the table has at least one failing item, or is named in writing as unmeasured.** Two
  options only. There is no third option in which a slice with `none seen` is quietly counted as fine.
- **Your quoted per-slice rates carry their failing counts.** A TNR beside the number of human failures
  it was computed from, on every row you publish.
- **The rare slices are present by allocation, not by luck.** If `exception` and `out_of_scope` are in
  the set because you put all 3 and all 7 there, a different seed changes nothing. If they are in there
  because the draw happened to include them, the set is not finished.

Then do the check that catches a team which has only done the first item: set **All of them** and read
the per-slice rates for the tuned system — `policy_fact` 47.1% (31.5%–63.3%), `boundary` 38.7%
(23.7%–56.2%), `how_to` 68.4% (46.0%–84.6%), `out_of_scope` 71.4% (35.9%–91.8%), `exception` 33.3%
(6.1%–79.2%). The last one is the worst rate on the whole set and it is three items wide. Write down
which of those five numbers you would have put in a release note on a 20-item draw, and whether you
would have been right.

**Validation, once.** On the 37 held-out items from [4.2](lesson-02.md), the `out_of_scope` slice is
**2 items and the tuned system passes both** — 100.0%, interval 34.2%–100.0%. That is the whole lesson
landing on the held-out half: a perfect score on a slice that contains no failures, on the one run you
get to make. Your test set has the same coverage hole your dev set had, and finding it there is what
the validation run is for.

## Use / don't use

**Do use slices** for anything where the answer's difficulty or the cost of being wrong varies by
audience. Support bot, retrieval assistant, code reviewer: the cases that differ are the ones you will
be paged for, and a single number over all of them is a number about the easy half.

**Do allocate to rare slices deliberately.** The cost is that your eval set no longer matches your
traffic, and every pass rate on it needs to say so. That is a small price for being able to say
anything about the cases that are 3 items out of 94. Teams that over-sample rare slices and then
**weight** the per-slice rates back to production proportions get both properties at once, and that is
worth doing once a slice has enough items to have an interval.

**Don't use slices for fairness or compliance monitoring.** A slice built to compare outcomes across
groups is a different artefact with different legal exposure, and it does not belong in the suite that
gates releases. Keep the two apart.

**Don't build more than five or six slices.** Each one costs a number you now have to maintain, and a
suite with twenty slices has twenty numbers, none of which anybody reads. The lab has five intents and
three difficulties; that is enough to show every mechanism in this lesson, and more than enough to
show that the two rare slices were the ones that mattered.

What teams actually do: define three to five slices once, from the error analysis in
[2.3](../module-02/lesson-03.md) rather than from a brainstorm; check out the whole rare stratum
whenever it has fewer than about ten failing items; and keep a line in the scoreboard for
**slices with no failing items**, which is a number that should be zero before anything is released.

## Reflect

1. Your report shows an overall true-negative rate of 61%. Two slices contributed nothing because they
   contained no failures. Write the sentence you add under that 61%, and say what a reader would now
   believe about your check that they did not believe before.
2. Take the smallest slice in your product's traffic. Compute how many failing items a random sample of
   30 would be expected to contain, then compute how many you would get by taking the whole stratum.
   Which of those two numbers is your eval set's real coverage, and what would you have to hand-write
   to make it the other one?

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- [Stratified sampling](https://en.wikipedia.org/wiki/Stratified_sampling) — what proportional
  allocation guarantees, which is presence in every stratum and nothing more.
- [Oversampling](https://en.wikipedia.org/wiki/Oversampling) — drawing a stratum at more than its
  population rate, which is the only way a rare stratum ends up with a measurable number of failures.
- Anthropic, [Define success criteria and build
  evaluations](https://platform.claude.com/docs/en/docs/test-and-evaluate/develop-tests) — the same
  split of "test cases" and "slice definitions", and the same warning that a slice without examples
  is a slice you have not evaluated.
