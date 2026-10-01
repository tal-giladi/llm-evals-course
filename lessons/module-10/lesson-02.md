---
id: "10.2"
module: 10
minutes: 18
practice_minutes: 45
prerequisites: ["10.1", "04.4"]
objectives:
  - Decompose the variance of a system difference into the two systems' own variance and their shared item term, and say which part pairing removes.
  - Measure how far a difference moves when the items are re-partitioned, and explain why a single unpaired result is a draw from a distribution rather than a number.
  - State a p-value as a decision rule under a named null, with its denominator, and say what it does not tell you.
volatility: concept
sources:
  - title: "The Design and Analysis of Experiments (Dean & Voss, 1998)"
    url: https://link.springer.com/book/10.1007/978-1-4757-5482-1
  - title: "How to Design A/B Tests (Kohavi, Tang & Xu, 2021)"
    url: https://exp-platform.com/Documents/2013-02-CUPED-ImprovingSensitivityOfControlledExperiments.pdf
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 10.2 · Paired versus unpaired

An A/B test that splits your item set in half buys you nothing for free: it halves the evidence behind each
arm and hands item difficulty straight back into the variance. This lesson puts the same two systems on the
same 94 items, measures what the pairing actually saves — which is not always as much as the textbook says
— and explains what the sign test on the page is for.

## Why it matters

A support bot's traffic is split 50/50 for a week. Variant B reads **19 points** better than A. The
dashboard says B is better by 19. Three weeks later, on a fresh split, the same two systems read **34
points** apart — and it is not even the same one in front.

Both numbers come from the same 94-item eval set, the same judge, the same week. Nothing about the systems
changed. What changed is **which items each arm happened to get**, and nobody recorded how much of the
fifteen-point swing was the systems and how much was the partition.

This is the specific failure of an unpaired release decision. It does not announce itself. The number is a
plausible, reportable, medium-sized improvement, and the only way to find out that it is half item-difficulty
is to draw a second partition and watch it move. Most teams never draw the second one, because the first one
looked fine.

The fix is not a better formula. It is recognising that when both systems answer the same items, you already
have a paired experiment, and pairing is the difference between a number you measured and a number you drew.

## How it works

### What pairing removes, in one line of algebra

Let $X_i$ be A's verdict on item $i$ and $Y_i$ be B's, each 0 or 1. Both systems saw the same items, so the
difference you care about is the mean of the per-item differences $D_i = X_i - Y_i$. Write out its variance:

$$\operatorname{Var}(\bar{D}) = \frac{1}{n}\operatorname{Var}(X - Y) = \frac{1}{n}\Big(\operatorname{Var}(X) + \operatorname{Var}(Y) - 2\operatorname{Cov}(X,Y)\Big)$$

If you throw the pairing away and measure each system on its own items, the estimate is $\bar{X} - \bar{Y}$
over two independent samples and the covariance term disappears:

$$\operatorname{Var}_{\text{unpaired}}(\bar{X} - \bar{Y}) = \frac{1}{n}\operatorname{Var}(X) + \frac{1}{n}\operatorname{Var}(Y)$$

So pairing removes $2\operatorname{Cov}(X,Y)$, and nothing else. The item-difficulty term is that
covariance: items that are hard make *both* systems fail, items that are easy make both pass, and a shared
item inherits that from both sides at once.

### The popular version of this, corrected

The textbook line is that pairing buys a large variance reduction and therefore lets you use far fewer
items. Compute the covariance term on this corpus — 94 items, `c-rubric-3b`, 3 repeats — and the size of the
win depends entirely on how alike the two systems are:

| Pair | Items where both agree | Per-item correlation | Variance factor | Items needed, unpaired |
|---|---|---|---|---|
| A vs B | 49 of 94 (52.1%) | 0.098 | **×1.11** | 99 (×1.05) |
| A vs C | 47 of 94 (50.0%) | 0.147 | **×1.15** | 101 (×1.07) |
| B vs C | 64 of 94 (68.1%) | 0.033 | **×1.03** | 96 (×1.02) |
| A vs D (A, padded) | 84 of 94 (**89.4%**) | **0.790** | **×4.75** | **205 (×2.18)** |

The first three rows are the correction. When two systems genuinely behave differently — a different prompt,
a different model — their per-item verdicts on this corpus barely correlate, the covariance term is small, and
pairing buys you 3–15% of variance, which is one or two extra items out of a hundred. Pairing is not a magic
multiplier.

The fourth row is where the classic claim is true. A and A-padded are the *same answers with a paragraph
added*, they agree on 89.4% of items, and unpaired measurement costs you **2.18 times the items** to reach
the same confidence. The pairing advantage is largest exactly where the systems are most alike — which is
where release decisions are most often made, because small changes are the ones people argue about for a
month.

### The bigger win on this page is the item budget, not the variance

Even with a variance factor of ×1.03, the unpaired design on this page costs you half the evidence per arm.
Paired, both systems are measured on all **94** items. Unpaired, each system is measured on **47**.

That is not a subtle penalty and it is not visible in a variance formula. It is visible in what the estimate
does when you draw it again. Hold the systems fixed, hold the item set fixed, and vary **only the partition**,
using the lab's own split rule (a seeded random 47/47 split of the same 94 items):

| Pair | Paired difference (every seed) | Unpaired difference over 12 partitions | Range |
|---|---|---|---|
| A vs B | **+26.6** (12.8 to 39.4) | 21.3 … 40.4, sd 6.6 | **19.1 pts** |
| B vs C | **+19.2** (8.5 to 30.9) | 10.6 … 34.0, sd 6.4 | **23.4 pts** |
| A vs D | **+4.3** (−2.1 to 10.6) | −8.5 … +17.0, sd 8.5 | **25.5 pts** |

The paired column does not move, and it is not a trick of the seeding: the paired estimate is computed over
all 94 items in every partition, because every partition contains all 94 items. The unpaired column is a
random variable that nobody measured.

The third row is the one to read twice. The unpaired split of A against A-padded comes out **negative on
three of twelve partitions** — −8.5, −6.4 and −2.1 points — meaning three times out of twelve the padded
variant looks *better* than the original. On the held-out 37 items the same sweep runs from **−29.5 to
+35.1**, a range of nearly 65 points, and the sign flips on five of twelve. One partition is not a small
sample you can reason around. It is a coin you have already flipped and are about to act on.

And there is a reason the weak system lands so badly. C passes **9 of 94** items. A 47-item split leaves it
measured on anywhere from **1 to 7 passing items** — and the half that gets 1 prints a pass rate of 2.1% for
a system whose true rate on all 94 is 9.6%.

> [!IMPORTANT]
> The lab's unpaired block is cheaper than a real split, and you should know by how much. It never runs a
> second system: it re-partitions one set of recorded verdicts and reuses them, which costs nothing. A
> production traffic split spends a second full pass over half your items, draws them from the population
> rather than from a fixed set, and adds the full item-difficulty variance on top. Every unpaired figure on
> this page is therefore a **lower bound** on what throwing away the pairing costs.

### The sign test, and what a p-value is for

The panel's fourth tile is an exact two-sided sign test. It answers one narrow question:

> **Null:** the two systems are interchangeable, so on an item where they disagree, a fair coin decides.
> **Question:** how often would a split at least this lopsided appear anyway?

Ignore every item both systems graded the same way — it carries no information about which is better. Count
what is left, $w$ for A and $l$ for B, and ask how often a coin would land $w$-or-more or $l$-or-more out of
$w+l$ tosses:

$$p = \min\!\left(1,\ \frac{2}{2^{\,w+l}}\sum_{i=0}^{\min(w,l)}\binom{w+l}{i}\right)$$

For the default preset, 35 against 10 on 45 disagreements:

$$p = \frac{2}{2^{45}}\sum_{i=0}^{10}\binom{45}{i} \approx 0.00025 \quad\Rightarrow\quad \text{the tile prints } \mathbf{0.000}$$

For A against D, 7 against 3 on 10 disagreements:

$$p = \frac{2}{2^{10}}\left(1 + 10 + 45 + 120\right) = \frac{352}{1024} = \mathbf{0.344}$$

Three things follow, and they are the whole lesson:

**A p-value is a decision rule under a stated null, not a score.** `0.000` does not mean you are 99.9%
confident A is better. It means: *if these two systems were really interchangeable, a split this lopsided
would happen about twice in ten thousand times.* Confidence in the systems being different is a different
quantity and the page does not compute it.

**The p-value depends only on the split, never on the size of the effect.** Six disagreements all going one
way gives $p = 2/2^6 = 0.031$ — "significant". Seven against three on ten gives $p = 0.344$ — not. And look
at how little it takes to cross the line: thirteen against four on seventeen disagreements gives $p = 0.049$,
which is significant by one thousandth; move one disagreement to the other side and the same seventeen items
give $0.077$, which is not. **Never quote a p-value without the split it came from.**

**The sign test's effective sample size is the number of disagreements, not the number of items.** It also
throws magnitude away completely: every flip counts as exactly one, so the test cannot tell whether the 35
wins on the default preset were 35 small wins or 35 wins and 34 ties you did not notice. Use it beside the
bootstrap interval, not instead of it — and when the two disagree, believe the interval, because the interval
is the one that used the magnitudes.

## Show me

This lesson's preset opens the lab on **A — handbook-tuned prompt** against **B — generic prompt** with the
comparison toggle already on **Unpaired — split the items**. Judge `c-rubric-3b`, all 94 items, 3 repeats.
The four tiles still read the paired numbers —

| Tile | Value |
|---|---|
| A pass rate | **55.3%** (52/94) |
| B pass rate | **28.7%** (27/94) |
| Difference | **+26.6 pts**, interval **12.8 to 39.4** |
| Sign test p | **0.000** — *significant* |

— and the block underneath reads:

> **The same data, unpaired.** A 59.6% on half the items, B 27.7% on the other half. Difference 31.9 points
> — and now the two halves differ in difficulty as well as in quality, which is exactly the variance the
> paired design removes.

Do this, in order:

1. **Reconcile the split by hand before you believe it.** 59.6% of 47 is 28 passes for A and 27.7% of 47 is
   13 for B. A has 52 over all 94, so the other half holds 24; B has 27, so the other half holds 14. The
   split is real, the halves are unequal in difficulty (A: 59.6% against 51.1%; B: 27.7% against 29.8%),
   and 31.9 is what you get from averaging over a partition rather than over the set.
2. **Notice what did not change and read it properly.** The tiles are untouched by the toggle, because the
   paired comparison never depended on the split. That is the strength of the paired design in one
   observation: it is a property of the item set, not of a draw.
3. **Redraw the partition twelve times.** The page shows one. Take the lab's own rule — a seeded random
   47/47 split — and vary the seed over 1, 7, 11, 23, 43, 77, 101, 404, 777, 1234, 9999, 65535. For A
   against B the difference runs **21.3, 23.4, 23.4, 23.4, 23.4, 27.7, 27.7, 29.8, 31.9, 31.9, 31.9, 40.4**
   — the same two systems, the same 94 items, the same judge. The paired answer over the same twelve seeds
   is **+26.6 every time**.
4. **Switch B to `D — A, padded` and redraw.** The unpaired difference over those twelve seeds is
   **2.1, 2.1, 14.9, 4.3, 4.3, 8.5, −8.5, −6.4, 17.0, −2.1, 17.0, 0.0**. Three are negative. The paired
   answer is **+4.3** with an interval of **−2.1 to 10.6** — the one number that does not care how you cut
   it.
5. **Recompute the sign test by hand for both.** 35 against 10 on 45 disagreements gives 0.000; 7 against 3
   on 10 gives 0.344. Then compute 6 against 0 and notice it lands at 0.031 — significant — and write down
   what that says about quoting a p-value without its split.

> [!NOTE]
> The partition sweep in steps 3 and 4 is the lab's own split rule re-run at other seeds on the same
> recorded verdicts; the page shows one partition and the sweep is four lines of arithmetic. As everywhere
> in this lab, the 94 questions, the four variants and the human labels are generated for teaching and
> every verdict comes from a seeded educational model of judge behaviour. No figure here measures a named
> support bot in the wild.

## Try it

**Predict first**, on paper:

1. Two systems answer the same 94 items and you compare them paired. Then you compare them unpaired on two
   47-item halves. Which is noisier, and by roughly how much? Name the term that accounts for the difference.
2. A p-value of 0.031 came from six disagreements, all in the same direction, on a slice of four items. A
   p-value of 0.344 came from ten disagreements. Which is more evidence, and what is each one evidence *of*?
3. A and A-padded agree on 84 of 94 items; A and B agree on 49. Which pair loses more from being measured
   unpaired, and why is the answer not simply "whichever has the smaller pass rate"?

[Simulation: ab-gates](../../simulations/ab-gates/index.html?preset=unpaired)

1. **Count the disagreements and run the sign test by hand.** On the default preset the split is 35 against
   10 on 45 items. Write $p = 2\sum_{i=0}^{10}\binom{45}{i}/2^{45}$ and get 0.00025. Then do 7 against 3 and
   get 0.344. Record the number of disagreements beside each p-value, which is the habit [10.1](lesson-01.md)
   asks for.
2. **Do the partition sweep on paper for A against D.** Twelve partitions, one line each, the difference
   written down. Count how many are negative. Then decide what you would tell a stakeholder who saw one of
   the positive ones.
3. **Test the "pairing is always a huge win" claim on this data.** Work out the per-item agreement rate for
   A vs B, A vs C, B vs C and A vs D from the flip list — agreed items are the ones on neither list. Rank
   the four pairs by agreement, then by the variance factor in the table above. Where do they line up and
   where do they not?
4. **Watch the interval refuse to care.** Toggle paired, note the difference and both ends of the interval.
   Toggle unpaired, note the new difference. Toggle back. Then compute, for A vs B, how much of the
   19.1-point partition range is already inside the paired interval's 26.6-point width. What does that
   overlap tell you about which number should go in the runbook?
5. **Price the split.** The paired run costs 94 judged answers per repeat. The unpaired run costs 47 + 47 on
   the same total. Write the sentence you would send to the person proposing the traffic split, and say what
   the eval set already gives you that the split would throw away.

## Break it

**Split the eval set and call it an A/B.** The lab's own comment is honest about it — *the two halves differ
in difficulty as well as in quality* — and the practical version of that error is shipping the first
partition you draw. The lie: **an unpaired difference is one draw from a distribution whose spread you
measured after you already used it.**

**Report the unpaired number as the effect size.** A vs B reads 31.9 on one partition and 40.4 on another,
and both get pasted into a deck as "the candidate is about 31 points better". The true effect is not 31.9;
it is 26.6 with an interval, and 31.9 is one noisy estimate of it. The lie: **a partition-dependent number
quoted without its spread is a random variable wearing a decimal point.**

**Read `0.000` as certainty.** The tile prints three decimals because three decimals is the format, not
because the answer has three decimal places — the value is about 0.00025. And it is the probability of a
lopsided split *under a null*, not the probability that B is the same as A. The lie: **a p-value is a rate
under a hypothesis, and presenting it as a probability about the world inverts what it measures.**

**Quote a p-value without its split.** Six against zero is "significant" at 0.031 and comes from six
items. Thirteen against four is 0.049 and comes from seventeen. Neither number means anything without the
count, and the count is not printed next to the tile. The lie: **a p-value's denominator is the sample, and
removing it turns a measurement into a vibe.**

**Treat `p > 0.05` as proof of no difference.** A vs D prints 0.344 and the correct reading is *we cannot
tell these two systems apart on 94 items*. That is not *they are the same*. The difference could be four
points and real, or eleven and real, and the run cannot choose between them. The lie: **failing to reject a
null is a statement about the size of your evidence, not about the size of the effect.**

**Trust the sign test over the interval.** They agree on this data, which is reassuring and not the point.
The sign test discards magnitudes — every flip counts as one — so on a comparison where the systems differ
by a handful of small flips and the interval says something different, the interval is the measurement and
the sign test is a vote. The lie: **a test that throws away how big the changes were cannot adjudicate a
question about how big they were.**

## Fix it

1. **Pair everything you can, and say why in the runbook.** `Both systems answered the same 94 items; the
   comparison is paired, so item difficulty is common to both sides and cancels in the difference.` One
   sentence, and it is the sentence that makes the number defensible six months later.
2. **Print the covariance term when you claim a power win.** `Per-item verdict correlation 0.098, variance
   factor ×1.11.` Without it, "pairing is more powerful" is an assertion; with it, it is a measurement, and
   the measurement is sometimes disappointingly small — which is itself worth knowing before you size an eval.
3. **Size the eval for the smallest difference you must detect, using the interval.** On A vs B the paired
   interval is 12.8 to 39.4 on 94 items; on 40 items it is 5.0 to 42.5; on 20 it is −15.0 to 45.0. The
   half-width tells you the item count, in the units the decision is made in.
4. **Write the null next to the p-value, every time.** `Sign test p 0.000 under "the two systems are
   interchangeable on the items where they disagree"; 35 against 10 on 45 disagreements.` Never a bare number.
5. **Redraw any partition-dependent number before you act on it.** If the number came from a split, run it on
   at least five more partitions and record the range. If the range straddles zero, the honest deliverable is
   a larger item set, not a decision.

## How do I know it works?

**Challenge, on dev.** The dataset's own dev split is **57 items** (`dev_ids`) — the half where any tuning of
this eval would have happened. On A against B, require all four of these:

- **The runbook says paired, with the reason.** `94 items (57 dev, 37 held out), both systems on every item,
  paired; difference +19.3 pts, 95% interval 3.5 to 35.1, sign test p 0.043 on 18 against 7 over 25
  disagreements.` Note the interval's lower end on 57 items is 3.5, against 12.8 on 94 — the margin you can
  quote is a property of the denominator.
- **The disagreement count is printed next to every p-value.** 18 against 7, 20 against 3, 3 against 0. A
  p-value without its count does not pass.
- **The covariance term is on the page.** Per-item correlation 0.098 for A vs B and 0.790 for A vs D, with
  the variance factor each implies. A claim of extra power with no correlation beside it is a claim, not a
  measurement.
- **The partition sweep has been run and its range recorded.** On the 57-item dev half, A vs B unpaired over
  twelve partitions runs **5.2 to 33.3** — a 28.1-point range on half the items. A vs D over the same
  partitions runs **−8.6 to 22.9**, and it is negative on five of twelve.

**Then one held-out validation**, on `test_ids` — the remaining **37 items** — read once:

| | Dev, 57 items | Held-out, 37 items |
|---|---|---|
| Paired difference | +19.3 pts | **+37.8 pts** |
| Paired 95% interval | 3.5 to 35.1 | 16.2 to 59.5 |
| Sign test p (split) | 0.043 (18 vs 7) | 0.003 (17 vs 3) |
| Unpaired range over 12 partitions | 5.2 … 33.3 (range 28.1) | **12.9 … 45.6 (range 32.7)** |
| A vs D unpaired range | −8.6 … 22.9 (range 31.5) | **−29.5 … 35.1 (range 64.6)** |

The last row is the held-out lesson. On 37 items the unpaired design for A against D spans 65 points and
flips sign on five partitions of twelve; the paired design on the same 37 items reads **+8.1 pts, interval
0.0 to 16.2, p 0.250** — a stable number whose lower end sits exactly at zero, which is the page correctly
declining to claim three flips are evidence of anything. Write down that the pairing's advantage grows with
the smallness of the set: on 94 items A vs D gained a factor of 2.18, and on 37 items the partition range
nearly doubled again. The closer the decision is to a tie, the more the design matters and the less the
runbook should depend on a single number.

## Use / don't use

**Do pair whenever both systems can answer the same items.** It is free — you already paid for both runs —
and it removes both the item-difficulty term and half your item-budget cost.

**Do compute the correlation when you justify pairing by power.** 0.03 to 0.15 on most pairs, 0.79 on
A vs D. The number is four lines of arithmetic over per-item verdicts and it is the difference between a
credible sizing argument and an appeal to authority.

**Do use the sign test for the yes/no and the interval for the how-much.** They answer different questions
and the panel prints both. On this data they agree on every comparison, which is what makes the disagreement
case easy to recognise when you hit it.

**Don't ship an unpaired comparison when a paired one was available.** The extra cost is not the variance —
on most pairs that is 3–15%. It is that the number becomes a function of the partition, and nothing on the
page records which partition you got.

**Don't compare a candidate measured on 47 items against a baseline measured on 94.** That is not an
unpaired A/B, it is two different experiments with two different denominators, and the difference is a
blend of the systems and of the item counts.

What teams actually do: keep one frozen item set and run both arms of every comparison on all of it. When a
candidate genuinely cannot run on the old items — a new product area, a different input format — they build
the new item set first, run *both* arms on it, and only then compare. The number of items is the scarcest
resource in an eval programme and the only thing you cannot buy back after the run.

## Reflect

1. The unpaired split of A against A-padded is negative on three of twelve partitions. Write the two
   sentences you would send to a team that pasted one of those into a deck, and say what you would ask them
   to collect before the next release.
2. A p-value of 0.000 and a p-value of 0.344 come off the same panel. Write what each one licenses you to
   say about the candidate, and say what each one is *not* a probability of.
3. Per-item verdict correlation is 0.098 for A vs B and 0.790 for A vs D. Explain in two sentences why the
   smaller number does not mean pairing is useless for A vs B.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- Douglas Dean and Daniel Voss, [The Design and Analysis of
  Experiments](https://link.springer.com/book/10.1007/978-1-4757-5482-1) (1998) — blocking and the variance
  decomposition that says exactly what a paired design removes and what it does not.
- Ron Kohavi, Dixit Tang and Ya Xu, [Online Controlled
  Experiments](https://exp-platform.com/Documents/2013-02-CUPED-ImprovingSensitivityOfControlledExperiments.pdf)
  — why variance reduction is measured rather than asserted, and what it costs the next system to build.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the habit underneath the third fix:
  when a number depends on a draw you did not record, record the draw before you use the number.