---
id: "10.3"
module: 10
minutes: 18
practice_minutes: 50
prerequisites: ["10.2", "04.4"]
objectives:
  - Name both failure modes of a pass-rate gate and say which knob moves each of them, and in which direction.
  - Read a gate grid and say which knob trades the two rates against each other and which knobs only buy down one side.
  - Write a gate specification with four numbers: tolerance, measurement half-width, accepted false-alarm rate and accepted miss rate.
volatility: concept
sources:
  - title: "The Mythos of Model Evaluation (Bowyer et al., 2024)"
    url: https://arxiv.org/abs/2411.19994
  - title: "The Design and Analysis of Experiments (Dean & Voss, 1998)"
    url: https://link.springer.com/book/10.1007/978-1-4757-5482-1
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 10.3 · Setting a gate under noise

A release gate is a threshold on a measurement, and every measurement has a width. This lesson prices both
ways a gate can be wrong, works out which knob actually trades them against each other, and ends with the
specification you write instead of a bare threshold.

## Why it matters

A team ships a gate on their support bot's eval: **block the release if the pass rate drops more than three
points**. It runs for eleven nights. On the twelfth it blocks a release that changed nothing but a logging
line, and the engineer who owns the pipeline spends the morning re-running the eval to prove it.

They loosen the gate to ten points. It goes green immediately and stays green for four weeks. Then a prompt
change ships that quietly breaks every answer about parental leave, and the gate does not fire, because ten
points was set to make the false alarms stop.

Neither team was wrong about the threshold. Both were working with a threshold and no idea how far the
measured number moves when nothing has changed at all — and, on the panel in this module, no idea how big a
regression the gate could actually see. On the default setting here, a gate tuned to block one healthy build
in ten **misses one broken build in two**. Neither half of that sentence is visible in the other.

The honest deliverable from this lesson is therefore not *ship a gate*. It is: *here is the false-alarm rate
we accept, here is the miss rate we accept, here is what each one buys, and here is what I could not
measure.* A gate with one number on it is a coin with a label; a gate with two named rates, the width of the
measurement beside them, and a named regression attached is a decision somebody can review.

## How it works

### Two failure modes, always

A gate compares a candidate build against the current one on the same items and fires when the drop exceeds
a tolerance. It can be wrong in exactly two ways, and they are not two versions of one thing:

| Failure mode | What happened | Who pays |
|---|---|---|
| **False alarm** | the build was fine; the gate blocked it anyway | the engineer, today, in a morning of re-running |
| **Missed regression** | the build was broken; the gate stayed quiet | the user, next week, in a support ticket |

They trade, and on this panel the trade is monotone and easy to see. At **94 items, 3 repeats**, moving the
tolerance knob:

| Tolerance | False alarms | Missed regressions |
|---|---|---|
| 0 pts | **45.3%** (181/400) | **14.5%** (58/400) |
| 1 pt | 45.3% (181) | 14.5% (58) |
| 2 pts | 34.5% (138) | 22.3% (89) |
| 3 pts | 23.0% (92) | 29.0% (116) |
| 4 pts | 16.8% (67) | 42.3% (169) |
| **5 pts** (the default) | **10.0%** (40) | **52.8%** (211) |
| 6 pts | 7.0% (28) | 63.7% (255) |
| 8 pts | 1.8% (7) | 81.3% (325) |
| 10 pts | 0.3% (1) | 93.8% (375) |
| 12 pts | 0.0% (0) | 98.5% (394) |
| 15 pts and above | 0.0% (0) | 100.0% (400) |

Read the two columns against each other and the lesson is in the table. Tighten the tolerance and the miss
rate falls while the false-alarm rate climbs; loosen it and the reverse. **The two rates cross somewhere
around 3 points**, and that crossing is the only place on this page where the team's two risks are
balanced. Every other tolerance is a decision about which mistake you would rather make.

### The other two knobs buy down one side only

Now read the grid, which holds the tolerance at 5 points and varies items and repeats:

| Items | 1 repeat | 3 repeats | 5 repeats |
|---|---|---|---|
| 20 | 0% / 0% | **27% / 51%** | 20% / 53% |
| 40 | 0% / 100% | **21% / 62%** | 21% / 64% |
| 94 | 0% / 0% | **10% / 53%** | 8% / 52% |

Left number: false alarms. Right number: missed regressions.

**Items move the false-alarm rate and almost nothing else.** Going from 20 items to 94 at three repeats
takes false alarms from 27% to 10% — a two-thirds reduction for four times the budget. The miss rate over
the same move reads 51%, then 62%, then 53%, which is scatter rather than a trend.

**Repeats move the false-alarm rate and almost nothing else.** At 94 items, going from three repeats to five
takes false alarms from 10.0% to 8.0% and the miss rate from 52.8% to 52.4%.

That is not a disappointing version of the story. It is the story, and the reason is worth being able to
say out loud. **A regression is a proportion.** When a change breaks a tenth of the questions, it costs a
tenth of the pass rate whether you measured that on 20 items or on 94 — the *signal* does not grow with the
item count, only the *noise* around it shrinks. More items and more repeats are therefore the same purchase
made twice: they make the measurement quieter, which buys down false alarms and leaves a proportional
regression exactly as detectable as it was.

> [!IMPORTANT]
> > That contradicts the callout printed under the gate tiles, which says *the only knobs that move both in
> > the right direction are more items and more repeats*. The grid above is the shipped simulator's own
> > output, and its miss column does not fall: 51, 62, 53 down the item axis, and 53 against 52 as repeats
> > go from three to five at 94 items. The callout's claim holds for the **false-alarm** side and not for the
> > **miss** side. The cheapest way to find that out is the one you just did — read the two columns
> > separately instead of hunting for a cell that improves on both.

### What actually sets the miss rate

If items and repeats do not set it, something else must. The simulator plants a **block** of regressions — a
default tenth of the item set — because a real regression breaks a category of question rather than one
unlucky item. On 94 items that block is the first nine, and A passes four of them at three repeats, so the
planted drop is **4.26 points** against a **5-point** tolerance. The regression sits just under the
threshold, which is exactly why the gate is close to a coin on it.

Re-run the shipped simulation with a different block size at the same tolerance and the answer falls out:

| Broken items | Approx. drop | False alarms | Missed |
|---|---|---|---|
| 1 | 1.1 pts | 10.0% | **89.8%** |
| 3 | 3.2 pts | 10.0% | 76.5% |
| 9 (the panel's default) | 4.3 pts | 10.0% | 52.8% |
| 19 | 10.6 pts | 10.0% | **5.2%** |
| 30 | 16.0 pts | 10.0% | 0.0% |

The false-alarm column does not move at all, and it cannot: the block exists only in the broken build, so it
has no effect on what the healthy build does. The miss rate falls from nine in ten to zero. **The miss rate
is a function of how big the regression is relative to the tolerance, and of nothing else on this page.**
One broken item out of 94 is a one-point drop, and a five-point gate misses that about nine times in ten —
correctly, because a one-point drop is not the event anyone is trying to catch.

That is the sentence a gate specification has to contain. A false-alarm rate is a property of your
measurement. A miss rate is always a property of *a regression you have named*, and until you name it you
have not written a gate — you have written a number.

### A tolerance only means something next to a width

Before you can price the tolerance you need to know how far the measured difference moves when **nothing
changed**. The paired bootstrap interval on the A/B panel is exactly that quantity, and the `Items` knob now
takes you to every point on it. A against B, `c-rubric-3b`, 3 repeats, seed 23:

| Items | Difference | 95% interval | Half-width |
|---|---|---|---|
| 20 | +15.0 pts | −15.0 to 45.0 | **30.0 pts** |
| 40 | +22.5 pts | 5.0 to 42.5 | **18.8 pts** |
| 94 | +26.6 pts | 12.8 to 39.4 | **13.3 pts** |

Read the last column against the 4.26-point regression above. **The planted regression is a third of the
measurement's half-width.** That is the arithmetic behind a 52.8% miss rate, and no threshold tuning fixes a
gate whose signal is that far under its own noise: the half-width moves 30.0 → 18.8 → 13.3 as the item count
rises, but a 4.26-point drop stays a 4.26-point drop at every size.

Repeats are the smaller term again. At 94 items the half-width is **14.4** points at one repeat, **13.3** at
three and **13.3** at five. That is why "just run it three times" is not the answer, and also why repeats
are not free: three repeats costs three times as much per run to buy one point of width. At 94 × 3 this
gate makes **282 judged verdicts every run**; at 20 items and one repeat it makes **20**. That is a factor of
fourteen, on every run, forever.

### The specification you write instead

The deliverable from setting a gate is a paragraph, and it has four numbers in it:

> **Gate: pass rate on 94 frozen items, 3 repeats, judge `c-rubric-3b`, majority vote.** Fire when the
> candidate's pass rate is more than **4 points** below the current build's on those items. **The regression we
> must catch is a break of one question in ten**, which on this set the simulator plants as 9 of 94 items — a
> 4.26-point drop. At a 4-point tolerance the panel prices that at **16.8% false alarms and 42.3% missed**; at
> 5 points, 10.0% / 52.8%; at 3 points, 23.0% / 29.0%. **We take 4 points**, accepting one blocked healthy
> build in six in exchange for catching four regressions in ten instead of two. **Measurement half-width on
> this set: ±13.3 points**, so a 4-point tolerance is 30% of the noise and this gate is deliberately strict.
> **To halve the false-alarm side, buy items** — 20 items at 3 repeats reads 27% / 51% against 10% / 53% at
> 94. **To halve the miss side, name a bigger regression**: at 19 broken items the same gate reads 5.2%
> missed, and no item budget will ever get it there.

Every clause is checkable, both rates sit in the same sentence, and the last clause is the one teams leave
out: **the miss rate is bought with a decision about what counts as a regression, not with a larger eval
set.** The gate that fails in production is almost never the one with the wrong threshold. It is the one
where nobody ever said which of the two errors the team had decided to make, or how big the thing was that
they were guarding against.

## Show me

This lesson's preset opens the lab on the **Set a gate under noise** panel, baseline **A — handbook-tuned
prompt**, tolerance **5 points**, repeats **3**, `Items` **94**. The four tiles read:

| Tile | Value |
|---|---|
| False alarms | **10.0%** — *healthy build, gate fires anyway* |
| Missed regressions | **52.8%** — *broken build, gate stays quiet* |
| Tolerance | **5 pts** |
| Items | **94** |

A gate that blocks one healthy build in ten and misses one broken build in two. Those are the two halves of
the decision, and they were chosen by whoever set five points.

Do this, in order:

1. **Sweep the tolerance and read both columns.** Hold 94 items and 3 repeats, and drag the tolerance from 5
   down to 0 and back up to 15. False alarms climb 10.0% → 23.0% → 45.3%; the miss rate falls 52.8% → 29.0%
   → 14.5%; and the two cross somewhere near 3 points. That crossing is the whole trade, and it is the only
   place the panel shows one.
2. **Read the grid's two columns separately, not its cells.** At 5 points, false alarms run 27 → 21 → 10 down
   the item axis and 27 → 20 across the repeat axis. The miss column runs 51 → 62 → 53, and 51 → 53. Write
   down the sentence that describes the difference between those two columns.
3. **Read the callout against the grid.** The callout says more items and more repeats are the only knobs
   that move both rates in the right direction. The grid's miss column does not move. Say which half of the
   callout the panel supports and which half it does not, then write the replacement sentence.
4. **Move the `Items` knob and watch the headline respond.** At tolerance 5 and 3 repeats: `Items 20` reads
   **26.5% / 50.5%**, `40` reads **20.5% / 62.0%**, `60` reads **16.0% / 34.0%**, `94` reads **10.0% /
   52.8%**. The false-alarm rate falls monotonically. The miss rate swings by nearly thirty points between
   60 and 94 items — and step 5 says why.
5. **Work out what the regression actually is.** The planted block is the *first tenth of the item list*, so
   at 94 items it breaks `s01` through `s09` and at 20 items it breaks `s01` and `s02`. The 60-item draw does
   not contain the same first ninth of the corpus that the 94-item set does, so the block lands on different
   items. That is the thirty-point swing, and it is not thirty items of extra evidence.
6. **Put an error bar on the rates.** There is no seed knob on this panel, so ask it another way: the
   simulator runs 400 trials of a seeded generator and this page is seed 23. Re-running the same setting at
   ten other seeds gives a false-alarm rate of **8.8% to 12.8%** and a miss rate of **46.0% to 55.5%**.
   Four hundred trials buys you about ±2 points and no more, so the third significant figure on the tile is
   formatting.

> [!NOTE]
> > One more reading note, and it is the same rule as Module 6: at `Repeats 2` this panel's majority rule
> > requires **both** recorded samples to pass, because a tie resolves to fail. A's pass rate at `Repeats 2`
> > is **42.6%** (40/94) against 53.2% at 1 and 55.3% at 3. That is not the system getting worse; it is the
> > tie rule, and it is why an even repeat count is the worst setting on any majority-vote threshold.
> > Every number on this page is computed from a seeded educational model of judge behaviour on generated
> > support items, for real, in your browser — and none of it measures a named support bot in the wild. The
> > block sizes in the fourth table are a hand calculation with the shipped simulator's own option rather
> > than a panel readout, and the seed sweep in step 6 is the shipped simulator re-run at other seeds.

## Try it

**Predict first**, on paper:

1. A gate compares two builds on 94 items where the difference carries a half-width of 13.3 points, and the
   regression you need to catch is 4.3 points. Is the tolerance the thing that decides whether you catch it,
   or is it something else?
2. The grid's false-alarm column improves as you add items and its missed column does not. Explain why in
   one sentence, using the word *proportion*.
3. You can spend your budget on 282 judged verdicts a run. Name two ways to spend them, and say which of the
   two failure rates each one reduces.

[Simulation: ab-gates](../../simulations/ab-gates/index.html?preset=gate)

1. **Add up the grid's two columns and write two summaries, not one.** Nine cells, two columns. Produce a
   sentence about the left column and a sentence about the right one. Then find the tolerance at which the
   two rates come closest at 94 items and 3 repeats, and say what your tolerance should be if a blocked build
   costs an engineer a morning and a missed parental-leave break costs a support queue.
2. **Find the knob the callout gets half right.** Sweep the tolerance from 0 to 15 in steps of 1 at 94 items
   and 3 repeats, writing both columns down. Then sweep the repeat count 1, 3, 5 and the item count 20, 40,
   94 and do the same. Make two lists — the knobs that move the left column, and the knobs that move the
   right one — and report what is on the second list.
3. **Work out the planted regression by hand.** Take the first 9 items, count how many A passes at 3 repeats,
   divide by 94 and multiply by 100. You should land on **4.26 points**. Compare it with the tolerance of 5
   and explain why the gate is close to a coin on it. Then work out what tolerance the same regression would
   need in order to be caught nine times in ten.
4. **Watch the block move.** Set `Items` to 60 and then to 94 and record both rates at each. Work out which
   items the simulator breaks in each case — it is always the first tenth of the list — and explain the
   thirty-point swing in the miss rate without using the words "more evidence".
5. **Write the specification.** Fill in all four numbers for a gate on this eval at 94 items and 3 repeats:
   tolerance, half-width, accepted false-alarm rate, accepted miss rate. Then answer the question the
   specification forces: **what size of regression are you actually buying detection for?** If the honest
   answer is "smaller than 5 points, so a 5-point gate is the wrong gate", change the tolerance and say what
   you gave up.

## Break it

**Ship one number.** A gate with a threshold and nothing else has one failure rate, which somebody chose
without knowing they were choosing it. The lie: **a single green tick reads as "we tested this" when what
was tested is one of the two ways of being wrong.**

**Set a tolerance without a half-width.** Five points against a ±13.3 measurement is a 38% noise threshold,
and the regression you need to catch is a 4.26-point drop. The gate is being asked to resolve a signal a
third of the size of its own noise. The lie: **a threshold smaller than the noise is not strict, it is
random with a CI badge on it.**

**Believe the callout.** *The only knobs that move both in the right direction are more items and more
repeats.* The grid's miss column reads 51, 62, 53. The lie: **a caption describing one column of a table is
read as a description of the table, and the half that is wrong is the half you were about to budget
against.**

**Treat "more items and more repeats" as the answer to a miss rate.** They cut false alarms — 27% to 10% on
items, 10.0% to 8.0% on repeats — and leave the miss rate where it was, because a proportional regression is
exactly as detectable at 20 items as at 94. The lie: **a knob that reduces the noise and leaves the signal
alone cannot rescue a gate whose signal was never large enough.**

**Read a 52.8% miss rate as a verdict on your gate.** The simulator plants a fixed tenth of the item set
every time. One broken item is missed 89.8% of the time at this tolerance; nineteen are missed 5.2%. The
number is a property of *that* regression, and a team that reads it as a property of its gate will either
give up or loosen a threshold that was doing its job. The lie: **a miss rate is always a miss rate for a
named regression, and nobody named one.**

**Treat "more items and more repeats" as free.** 282 verdicts a night at 94 × 3, every night, is a line item
somebody has to approve — and the measurement says repeats buy 14.4 → 13.3 while items buy 30.0 → 13.3. The
lie: **the knob that buys down false alarms is the one you price last, which is how it becomes unaffordable.**

## Fix it

1. **Publish two rates, never one.** `False alarms: 1 in 6 runs. Missed: a one-question-in-ten break is
   caught 4 times in 10. Both accepted deliberately, see ADR-114.` A gate with one rate has one failure mode
   and it is the one nobody chose.
2. **Name the regression inside the gate's own text.** `Must catch: a break of one question in ten.` Every
   miss rate in the runbook is then a miss rate *for that thing*, and a change to what counts as a regression
   shows up as a change to the gate rather than as a silent retune.
3. **Print the measurement's half-width next to the tolerance.** `Tolerance 4 pts; paired 95% interval on
   this set ±13.3 pts (94 items, 3 repeats); planted regression 4.26 pts.` Three numbers on one line, and the
   ratio between them is the actual design decision.
4. **Buy items, not repeats, for the false-alarm side.** On this data items move the half-width by a factor
   of 2.3 and repeats by 1.08. Repeats are per-item per-run cost forever, so they are the expensive way to
   shrink the smaller term.
5. **Run the gate long enough to count its own mistakes.** Ten nightly runs at a 4-point tolerance on this
   item count produce about two false alarms and six misses. Count them, publish them, and re-tune against
   evidence rather than against the incident that annoyed you.

## How do I know it works?

**Challenge, on dev.** The dataset's dev split is **57 items**. A gate tuned on 57 items is a gate tuned on
two thirds of the evidence, so require all four of these before it goes near CI:

- **Both rates are on the page with their denominators, and both name their regression.** A against B on the
  57-item dev half reads **+19.3 pts** with a paired interval of **3.5 to 35.1**, so the half-width on dev is
  **15.8 points** — *wider* than the 13.3 on all 94. A gate tuned on dev must be tuned against 15.8, and its
  miss rate must be quoted as "missed: a drop of X points, caught Y% of the time".
- **The tolerance is below the half-width by a stated factor, and the reason is written.** `Tolerance 4 pts
  against a ±15.8 measurement: we accept ~1 false alarm in 6 because a missed parental-leave regression costs
  more than a morning of re-running.`
- **The regression size the gate is meant to catch is named, and its drop in points is computed.** A break of
  one question in ten on 57 items is **5.7 points**, not 4.3 — the plant is a *proportion* of the set, so it
  does not shrink when you shrink the eval, and the gate has to be re-checked against it at every size.
- **The gate's own error rates have been counted, not estimated.** At least ten consecutive runs with the
  threshold, and the actual false-alarm and miss counts in the ADR next to the predicted ones.

**Then one held-out validation**, on `test_ids` — the remaining **37 items** — read once:

| | Dev, 57 items | Held-out, 37 items |
|---|---|---|
| A vs B difference | +19.3 pts | +37.8 pts |
| 95% interval | 3.5 to 35.1 | 16.2 to 59.5 |
| **Half-width** | **15.8 pts** | **21.7 pts** |
| Sign test p (split) | 0.043 (18 vs 7) | 0.003 (17 vs 3) |
| Planted regression, one in ten | **5.7 pts** | **9.5 pts** |

The half-width got **worse** on the held-out half, from 15.8 to 21.7 points, while the measured effect got
larger — and the regression the gate exists to catch got *bigger* too, from 5.7 points to 9.5, because it is
a tenth of whatever set you measured. That last row is the finding. **The signal and the noise move in
opposite directions when you shrink the eval, and they meet.** On 37 items a one-in-ten break is a 9.5-point
drop against a ±21.7 measurement — well inside the noise — so this set cannot gate for that class of
regression at any tolerance, and the honest output is *collect items*, not *move the threshold*.

## Use / don't use

**Do gate on a frozen item set with both systems measured on every item.** Anything else and the gate is
measuring two different things on two different populations, which is [10.2](lesson-02.md) again.

**Do express the gate as two rates, a width and a named regression.** `±21.7 pts, tolerance 4, ~1 false alarm
in 6, and we catch 4 breaks in 10 of a one-question-in-ten class` is one line a reviewer can argue with.

**Do treat the miss rate as a statement about a named class of regression, not about your gate.** Every row
of the block-size table has the same false-alarm rate and a different miss rate, and the only thing that
changed was how many items the change broke.

**Do buy items before repeats.** They buy the same thing — a quieter measurement — items buy more of it per
unit of money, and they keep buying it when next quarter's tolerance argument comes round.

**Don't quote a false-alarm rate with no error bar.** Four hundred trials of this simulator give roughly
±2 points; a real gate varies more, with item mix, judge drift and time of day, and the rate you measured on
ten runs is itself an estimate with an interval.

**Don't tune a threshold until it stops annoying you.** Every adjustment trades the two named rates, and
doing it by feel moves both without recording either.

What teams actually do in production: run the comparison on a frozen set nightly, publish the four numbers,
and treat the *miss rate against the named regression* as the number that matters — a false alarm costs an
engineer a morning and is visible to everyone, while a missed regression is invisible until a user
complains, which is the asymmetry that makes teams set thresholds too loose without noticing they have done
it.

## Reflect

1. The tiles read `False alarms 10.0%` and `Missed regressions 52.8%`. Write the two sentences that explain
   to a team why the second number is a statement about a *particular size of regression* rather than about
   the gate.
2. The callout says more items and more repeats move both rates in the right direction, and the grid's miss
   column reads 51, 62, 53. Write the one sentence you would add to the callout, and say which knob you
   would still spend budget on.
3. You can afford 282 judged verdicts a night. Write the paragraph you would put in a budget review asking
   for 4× the items instead of 3× the repeats, and say what that buys — and what it visibly does not buy.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- Samuel Bowyer et al., [The Mythos of Model
  Evaluation](https://arxiv.org/abs/2411.19994) (2024) — why a headline metric presented without its
  uncertainty is a claim rather than a measurement, and what it costs to state the interval everywhere.
- Douglas Dean and Daniel Voss, [The Design and Analysis of
  Experiments](https://link.springer.com/book/10.1007/978-1-4757-5482-1) (1998) — the standard-error
  arithmetic behind every number on this page: a threshold means only relative to the width of the quantity
  it is applied to, and a fixed effect does not grow when the sample grows.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the habit underneath the first fix:
  when a decision has two ways to be wrong, write both of them down before you pick.