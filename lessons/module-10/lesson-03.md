---
id: "10.3"
module: 10
minutes: 18
practice_minutes: 50
prerequisites: ["10.2", "04.4"]
objectives:
  - Name both failure modes of a pass-rate gate and say which knob moves each of them, and in which direction.
  - Check in under a minute whether a gate simulator's two rates are independent measurements or one event counted twice.
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
ways a gate can be wrong, shows what the shipped gate simulator can and cannot tell you about them, and ends
with the specification you write instead of a bare threshold.

## Why it matters

A team ships a gate on their support bot's eval: **block the release if the pass rate drops more than three
points**. It runs for eleven nights. On the twelfth it blocks a release that changed nothing but a
logging line, and the engineer who owns the pipeline spends the morning rerunning the eval to prove it.

They loosen the gate to ten points. It goes green immediately and stays green for four weeks. Then a prompt
change ships that quietly breaks every answer about parental leave, and the gate does not fire, because ten
points was set to make the false alarms stop.

Neither team was wrong about the threshold. Both were working with a threshold and no idea how far the
measured number moves when nothing has changed at all. Three points is smaller than the noise; ten points is
larger than the regressions they care about. The threshold is not the thing being chosen — the **ratio of the
threshold to the noise** is, and nobody computed it.

The honest deliverable from this lesson is therefore not *ship a gate*. It is: *here is the false-alarm rate
we accept, here is the miss rate we accept, here is what each one buys, and here is what I could not
measure.* A gate with one number on it is a coin with a label; a gate with two named rates and the width of
the measurement beside them is a decision somebody can review.

## How it works

### Two failure modes, always

A gate compares a candidate build against the current one on the same items and fires when the drop exceeds
a tolerance. It can be wrong in exactly two ways, and they are not two versions of one thing:

| Failure mode | What happened | Who pays |
|---|---|---|
| **False alarm** | the build was fine; the gate blocked it anyway | the engineer, today, in a morning of re-running |
| **Missed regression** | the build was broken; the gate stayed quiet | the user, next week, in a support ticket |

They trade. There is exactly one knob that moves one without the other — the tolerance — and it moves both
the wrong way. Tighten it to catch more regressions and you raise false alarms. Loosen it to stop blocking
healthy releases and you stop catching regressions.

The only knobs that improve **both** are more items and more repeats, and both cost money on every single
run. At 94 items and 3 repeats this lab makes **282 judged verdicts per gate run**; at 20 items and one
repeat it makes **20**. That is a factor of fourteen, on every run, forever.

### A tolerance only means something next to a width

Before you can price the tolerance you need to know how far the measured difference moves when **nothing
changed**. The paired bootstrap interval on the A/B panel is exactly that quantity, and it is on the same
page as the pass rates. A against B, `c-rubric-3b`:

| Items | Repeats | Difference | 95% interval | Half-width |
|---|---|---|---|---|
| 20 | 1 | +20.0 pts | −15.0 to 50.0 | **32.5 pts** |
| 20 | 3 | +15.0 pts | −15.0 to 45.0 | **30.0 pts** |
| 40 | 1 | +20.0 pts | −2.5 to 40.0 | **21.3 pts** |
| 40 | 3 | +22.5 pts | 5.0 to 42.5 | **18.8 pts** |
| 94 | 1 | +23.4 pts | 8.5 to 37.2 | **14.4 pts** |
| 94 | 3 | +26.6 pts | 12.8 to 39.4 | **13.3 pts** |

Read the last two columns together. On 94 items with three repeats the measurement of a real 27-point
difference carries **±13.3 points**. A five-point tolerance on that measurement is **38% of the noise** —
you have set the gate to fire on ordinary variation and sleep through ordinary variation. On 20 items with
one repeat the half-width is **32.5 points**, so the same five-point tolerance is 15% of the noise there and
nothing on the panel would tell you.

Note also which column moved what. Going from 20 to 94 items takes the half-width from 32.5 to 13.3 — a
factor of 2.4, against the $\sqrt{94/20} \approx 2.2$ the $1/\sqrt{n}$ rule predicts. Going from one repeat
to three takes it from 14.4 to 13.3 at 94 items. **Items buy back item-sample noise, which is the bigger
term; repeats buy back verdict noise, which on this data is the smaller one.** That is why "just run it
three times" is not the answer, and it is also why repeats are not free: three repeats costs three times as
much per run to buy a 1.1-point improvement in the width.

### What this panel can actually tell you

The gate panel is the only place in the course that prints a false-alarm rate, and it is worth knowing
exactly what that number is. Three checks, each of which takes under a minute:

**Check one: do the two tiles add to 100%?** Read the grid, add the two columns in every row. They add to
**100.00% on every row, at every tolerance from 0 to 30 points, for every baseline variant.** Two
independent failure modes measured on two different builds cannot sum to one by construction. What the page
is printing is one event — *did the gate fire* — labelled twice, and the two labels are complements.

**Check two: does the planted regression change anything?** The panel is supposed to price the same gate on
a healthy build and on a broken one. It builds the broken build by copying the runs and forcing one item to
fail, and then measures pass rates from the **original** copy — so the regression is written and never read.
Pass `regressionIndex` of 0, of 7, or `null`, and the false-alarm rate is identical to the last decimal
place. The number labelled *missed regressions* is therefore not a miss rate at all. It is
`1 − false alarms`, computed on the same healthy runs.

**Check three: do the seeds do anything?** The simulator is documented as 400 trials of a seeded generator.
The generator is created and never called; each trial's comparison depends only on the trial index modulo
the repeat count, so the 400 trials are at most `repeats` distinct comparisons repeated. Set the seed to 1,
7, 11, 23, 43, 77, 101, 404, 777, 1234, 9999 or 65535 and every cell in the grid is unchanged. A rate
quoted with no error bar usually means the bar is hard; here it means the bar is *impossible*, because the
quantity does not vary.

And one more, visible without any code: **move the `Items` knob.** The four tiles keep reading
`Items 94` at every setting, because the item set behind the headline is always the whole 94. Only the
grid's rows respond to item count. A knob that does not size the gate is a knob that will be quoted as
though it did.

### The one trade this panel does show

Despite all of the above, the tolerance sweep is real, and it is the trade the callout describes — in a
single column. Hold the item count and repeats at 94 and 3 and move the tolerance:

| Tolerance | False alarms | Missed (on the same runs) |
|---|---|---|
| 0 pts | **67%** (266/400) | 34% |
| 5 pts | **33%** (133/400) | 67% |
| 10 pts | **0%** | 100% |
| 20 pts | **0%** | 100% |

Tightening the tolerance from 10 points to 0 raises the fire rate from 0% to 67%. That is exactly the
statement *tightening the tolerance to catch more regressions is what raises false alarms*, and it is
verifiable on the page. What the panel cannot show is the other half — a configuration where **more** items
or **more** repeats improves both rates — because both rates are one event. At 20 items and 3 repeats the
grid reads 67% / 34%; at 94 items and 5 repeats it reads 0% / 100%. Both configurations are on the same
page, both have the same number of judged verdicts within a factor of two, and neither is better than the
other. A grid that can only be read as a trade when it is actually a lookup table is a page that will be
quoted for a conclusion it does not support.

### The specification you write instead

The deliverable from setting a gate is a paragraph, and it has four numbers in it:

> **Gate: pass rate on 94 frozen items, 3 repeats, judge `c-rubric-3b`, majority vote.** Fire when the
> candidate's pass rate is more than **5 points** below the current build's on those items.
> **Measurement half-width on this set: ±13.3 points**, so the panel's own grid puts this setting at firing
> about **one run in three** with no change at all. **We accept that**: we would rather block a healthy build
> three nights in ten than miss a parental-leave regression. **We accept missing any regression smaller than
> 13 points**, because nothing below that is separable from verdict noise on this item set. **To halve the
> width, buy 4× the items; to bring it under 5 points so that a 10-point regression is visible, buy about
> 7×.**

Every clause is checkable, and the two trade-offs are visible in the same sentence instead of hidden behind
one green tick. The gate that fails in production is almost never the one with the wrong threshold; it is
the one where nobody ever said which of the two errors the team had decided to make.

## Show me

This lesson's preset opens the lab on the **Set a gate under noise** panel, baseline **A — handbook-tuned
prompt**, tolerance **5 points**, repeats **3**, `Items` **94**. The four tiles read:

| Tile | Value |
|---|---|
| False alarms | **0.0%** — *healthy build, gate fires anyway* |
| Missed regressions | **100.0%** — *broken build, gate stays quiet* |
| Tolerance | **5 pts** |
| Items | **94** |

A zero false-alarm rate renders as a healthy tile, and the gate it describes misses every regression the
page has. That pairing is the lesson in two numbers.

Do this, in order:

1. **Add the two columns of the grid.** At the default 5-point tolerance, `n94/r1` reads `0% / 100%`,
   `n94/r3` reads `33% / 67%`, `n94/r5` reads `0% / 100%`. Nine rows, every one summing to 100%. You have
   just established in ten seconds that the panel is printing one event twice.
2. **Sweep the tolerance and watch one column move.** Hold 94 items and 3 repeats. Move the tolerance from
   5 to 0 and the false-alarm rate goes 33% → 67%. Move it to 10 and it goes to 0%. That is the trade, in
   one column, and it is the only part of the callout this panel actually demonstrates.
3. **Switch the A dropdown and watch the whole grid change.** With A set to `B — generic prompt` at the same
   5-point tolerance the grid reads `0/100, 33/67, 0/100, 0/100, 0/100, 0/100, 0/100, 33/67, 0/100`. The
   gate's behaviour is a property of the **baseline system's recorded run-to-run spread**, not of your eval
   set and not of the regression you are trying to catch. Set A to `D — A, padded` and it changes again.
4. **Move the `Items` knob and confirm the headline does not move.** Whatever you set it to, the tiles read
   `Items 94` and the two rates stay at 0.0% and 100.0%. The grid's rows are the only place item count
   enters, and that is worth knowing before you quote a configuration you did not actually run.
5. **Go and measure the noise you would gate on.** Switch to the A/B panel, set `Repeats` to 1 and read A's
   pass rate: **53.2%** (50/94). Set it to 3: **55.3%** (52/94). Set it to 5: **53.2%** again. The five
   recorded samples behind that knob give **53.2%, 58.5%, 55.3%, 52.1% and 55.3%** — a 6.4-point spread with
   no change to the system, and 50 of the 94 items carry at least one disagreement across those samples.
   Your five-point tolerance has to live inside that.

> [!NOTE]
> One more reading note, and it is the same rule as Module 6: at `Repeats 2` this panel's majority rule
> requires **both** recorded samples to pass, because a tie resolves to fail. A's pass rate at `Repeats 2`
> is **42.6%** (40/94) against 53.2% at 1 and 55.3% at 3. That is not the system getting worse; it is the
> tie rule, and it is why an even repeat count is the worst setting on any majority-vote threshold.
> Every number here is computed from a seeded educational model of judge behaviour on generated support
> items, for real, in your browser — and none of it measures a named support bot in the wild.

## Try it

**Predict first**, on paper:

1. A gate compares two builds on 94 items and the difference carries a half-width of 13.3 points. You set
   the tolerance to 5 points. Roughly what happens on a night when nothing changed, and why?
2. A gate's two numbers always add to 100%. Name one thing that would have to be true for that not to be a
   bug, and say what you would check first.
3. You can spend your budget on 282 judged verdicts a run. Name two ways to spend them and say which
   failure mode each one reduces.

[Simulation: ab-gates](../../simulations/ab-gates/index.html?preset=gate)

1. **Add up the grid, every row.** Write the nine rows out on paper and add the two columns. Then sweep the
   tolerance from 0 to 30 in steps of 5 and add every row again. Write down the single sentence that
   describes what the panel is actually measuring.
2. **Read the real noise off the A/B panel.** Set `Repeats` to 1, then 2, then 3, then 4, then 5, and
   record A's pass rate at each: **53.2%, 42.6%, 55.3%, 47.9%, 53.2%**. Work out which of those moves are
   verdict noise and which are the tie rule, then state the width a five-point tolerance has to live inside.
3. **Build the missing half of the trade by hand.** Take the recorded A verdicts, hold the item count at 94,
   and compute the paired bootstrap interval for A against B at `Repeats` 1, 3 and 5 — interval widths of
   **28.7, 26.6 and 26.6 points**, half-widths of 14.4, 13.3 and 13.3. Repeats buy almost nothing here. Now
   cut the item count instead: a random draw of 40 items at seed 23 gives a 37.5-point interval and a draw
   of 20 gives 60.0. Then ask what item count would halve the 94-item half-width and check it against the
   four-times rule of thumb on the page. This is the knob the panel says moves both rates, measured on a
   number you can quote.
4. **Write the specification.** Fill in all four numbers for a gate on this eval at 94 items and 3 repeats:
   tolerance, half-width, accepted false-alarm rate, accepted miss rate. Then halve the false-alarm rate on
   paper and write what that costs per run in judge calls. If the cost is unacceptable, change something and
   say what you gave up.
5. **Find the knob that lies.** Set `Repeats` to 2 and read the gate panel, then the A/B panel. Write down
   the pass rate at each repeat count from 1 to 5 and identify the setting where the number moves for a
   reason that has nothing to do with the system.

## Break it

**Ship one number.** A gate with a threshold and nothing else has one failure rate, which somebody chose
without knowing they were choosing it. The lie: **a single green tick reads as "we tested this" when what
was tested is one of the two ways of being wrong.**

**Read `0.0%` false alarms as a healthy gate.** The tile is green, the number is zero, and the miss tile
beside it reads 100.0%. The lie: **a rate of zero next to a rate of one hundred is not a gate that never
fires — it is a gate that never fires, described twice.**

**Set a tolerance without a half-width.** Five points against a ±13.3 measurement is a 38% noise threshold.
It fires on ordinary variation and the team learns to re-run, which costs more engineering time than the
regressions it was built to catch. The lie: **a threshold smaller than the noise is not strict, it is
random with a CI badge on it.**

**Treat "more items and more repeats" as free.** 282 verdicts a night at 94 × 3, every night, is a line item
someone has to approve — and the measurement says repeats buy 14.4 → 13.3 while items buy 30.0 → 13.3. The
lie: **the knob that helps both is the one you price last, which is how it becomes unaffordable.**

**Trust the grid as a recommendation.** The nine cells do not form a Pareto frontier. 20 items at 3 repeats
reads 67% / 34% and 94 items at 5 repeats reads 0% / 100%, at comparable cost, and nothing on the page tells
you which to prefer. The lie: **a table of settings is not a decision, and quoting a cell from it is
choosing without saying you chose.**

**Move the `Items` knob and believe it.** The tiles read `Items 94` whatever the knob says. The lie: **a
control that does not change the quantity supplies false provenance for every number printed beside it.**

## Fix it

1. **Publish two rates, never one.** `False alarms: 1 in 3 runs. Missed: any regression smaller than 13
   points. Both accepted deliberately, see ADR-114.` A gate with one rate has one failure mode and it is the
   one nobody chose.
2. **Print the measurement's half-width next to the tolerance.** `Tolerance 5 pts; paired 95% interval on
   this set ±13.3 pts (94 items, 3 repeats).` Two numbers on one line, and the ratio between them is the
   actual design decision.
3. **Size the gate for the regression you care about, then check you can see it.** "We must catch a 10-point
   regression" is a requirement; "we can only see 13.3 points" is a fact about the item count and repeat
   count. Put both in the same ADR and let the gap get funded or accepted explicitly.
4. **Buy items before repeats, and say why.** On this data items move the half-width by a factor of 2.4 and
   repeats by 1.08. Repeats are the expensive way to reduce the smaller term.
5. **Run the gate long enough to count its own mistakes.** Ten nightly runs at a 5-point tolerance on this
   item count produce about three false alarms and zero detected regressions — count them, publish them, and
   re-tune against evidence rather than against the incident that annoyed you.

## How do I know it works?

**Challenge, on dev.** The dataset's dev split is **57 items**. A gate tuned on 57 items is a gate tuned on
half the evidence, so require all four of these before it goes near CI:

- **Both rates are on the page with their denominators.** On the 57-item dev half, A against B reads **+19.3
  pts** with a paired interval of **3.5 to 35.1**, so the half-width on dev is **15.8 points** — *wider* than
  the 13.3 on all 94. A gate tuned on dev must be tuned against 15.8, not against 13.3.
- **The tolerance is below the half-width by a stated factor, and the reason is written.** `Tolerance 5 pts
  against a ±15.8 measurement: we accept ~1 false alarm in 3 runs because a missed parental-leave regression
  costs more than a morning of re-running.`
- **The regression size the gate is meant to catch is named and checked.** On the dev half, the smallest
  regression the set can distinguish is about 16 points. If the regression you are worried about is 10
  points, this eval cannot gate for it and the ADR has to say so.
- **The gate's own error rates have been counted, not estimated.** At least ten consecutive runs with the
  threshold, and the actual false-alarm and miss counts in the ADR next to the predicted ones.

**Then one held-out validation**, on `test_ids` — the remaining **37 items** — read once:

| | Dev, 57 items | Held-out, 37 items |
|---|---|---|
| A vs B difference | +19.3 pts | +37.8 pts |
| 95% interval | 3.5 to 35.1 | 16.2 to 59.5 |
| **Half-width** | **15.8 pts** | **21.7 pts** |
| Sign test p (split) | 0.043 (18 vs 7) | 0.003 (17 vs 3) |

The half-width got **worse** on the held-out half, from 15.8 to 21.7 points, while the effect got larger.
That is the normal shape and it is worth writing down explicitly: **a gate tuned on 57 items and a gate
tuned on 37 items have different noise, and neither is the gate you will run on 94.** The correct output of
a held-out check is not a threshold but the sentence *the item set is too small to gate the change we are
worried about* — which is a finding, and the reason the next thing to do is collect items rather than move
the threshold.

## Use / don't use

**Do gate on a frozen item set with both systems measured on every item.** Anything else and the gate is
measuring two different things on two different populations, which is [10.2](lesson-02.md) again.

**Do express the gate as two rates and a width.** `±21.7 pts, tolerance 5, false alarms ~1 in 3, miss
anything under 22` is one line a reviewer can argue with.

**Do count the gate's real errors for a few weeks before trusting it.** Ten runs of a 5-point tolerance on
this data will block about three healthy builds. Everyone needs to know that before the first incident, not
after.

**Don't quote a false-alarm rate that has no error bar on it.** This lab's simulator is deterministic, which
hides the question entirely. A real gate varies with item mix, judge drift and time of day, and the rate you
measured on ten runs is itself an estimate with an interval.

**Don't tune a threshold until it stops annoying you.** Every adjustment is a trade between two named
failure rates, and doing it by feel moves both without recording either.

What teams actually do: run the comparison on a frozen set nightly, publish the four numbers, and treat the
*miss rate* as the number that matters — a false alarm costs an engineer a morning and is visible to
everyone, while a missed regression is invisible until a user complains, which is the asymmetry that makes
teams set thresholds too loose without noticing they have done it.

## Reflect

1. Your gate reads `False alarms 0.0%` and `Missed regressions 100.0%`. Write the two sentences that explain
   to an engineer why both tiles cannot be describing two different builds.
2. The tolerance is 5 points and the measurement's half-width is 13.3. Write the arithmetic that shows what
   a nightly gate at that setting does on a night when nothing changed, and say what you would change first.
3. You can afford 282 judged verdicts a night. Write the sentence you would use in a budget review to get
   4× the items instead of 3× the repeats, and say what you would have to stop measuring to pay for it.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- Samuel Bowyer et al., [The Mythos of Model
  Evaluation](https://arxiv.org/abs/2411.19994) (2024) — why a headline metric presented without its
  uncertainty is a claim rather than a measurement, and what it costs to state the interval everywhere.
- Douglas Dean and Daniel Voss, [The Design and Analysis of
  Experiments](https://link.springer.com/book/10.1007/978-1-4757-5482-1) (1998) — the standard-error
  arithmetic behind every number on this page: what a threshold means only relative to the width of the
  quantity it is applied to.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the habit underneath the first fix:
  when a decision has two ways to be wrong, write both of them down before you pick.