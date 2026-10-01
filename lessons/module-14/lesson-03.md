---
id: "14.3"
module: 14
minutes: 19
practice_minutes: 50
prerequisites: ["14.2", "04.4"]
objectives:
  - Compute a PSI between two windows of the same input mix and read it against the three thresholds, including the case where a category disappears entirely.
  - Explain, with the decomposition, why this course's own held-out split scores 0.762 against dev and what that says about building a monitor on a dev mix.
  - Derive an alert band from a Wilson half-width at a stated sample size, and say what the band costs in false alarms at that size.
  - Decide, for one metric, whether the movement is in the input mix or in the measurement, and name which of the two you would page somebody about.
volatility: implementation
sources:
  - title: "Common pitfalls and recommended practices — scikit-learn"
    url: https://scikit-learn.org/stable/common_pitfalls.html
  - title: "Population stability index"
    url: https://en.wikipedia.org/wiki/Population_stability_index
  - title: "The Design and Analysis of Experiments (Dean & Voss, 1998)"
    url: https://link.springer.com/book/10.1007/978-1-4757-5482-1
  - title: "Sampling — OpenTelemetry"
    url: https://opentelemetry.io/docs/concepts/sampling/
last_verified: "2026-10-01"
---

# 14.3 · Drift in the input mix, and the alert band

Two numbers decide whether an online eval is worth keeping: how far the input mix has moved since the
baseline, and how wide the measurement of any rate is at the size you are actually sampling. Get the
first wrong and you page people for a season change; get the second wrong and you page people every
Monday. This lesson computes both — including the row that says this course's own held-out split is a
different population from dev, not a second sample of it — and shows why the alert band has to be the
one number you never choose by feel.

## Why it matters

A team ships a monitor. It is a good monitor: a judge, a sample, a threshold somebody agreed to in a
design review. On Monday morning it fires. The pass rate moved 4 points.

It was at 90% on Friday. It is 86% on Monday. The model did not change, the prompt did not change, the
judge did not change. What changed is that **Monday's traffic is not Friday's traffic**, and the monitor
was built on a baseline describing Friday.

The on-call engineer looks at the panel for eleven minutes, finds nothing, and closes it. On Tuesday it
fires again. On Wednesday, again. By the end of the second week the engineer no longer opens the panel
first thing in the morning, and by the end of the third week the monitor's owner is being asked, in a
planning meeting, whether it is worth keeping.

**A monitor that cries wolf is worse than no monitor**, and the reason is not the noise. It is that you
spend the team's attention, which is the only thing a monitor has. Every false alarm is a small payment
against a fixed budget, and the budget does not refill while the real problem is still unsignalled. A
monitor that is switched off is an honest zero. A monitor that is ignored is an honest zero with a
dashboard on top of it, and the dashboard is worse, because somebody still believes it.

The other failure is the mirror image, and it is the one that ships later. The team widens the band — once,
without writing down why — and the monitor goes quiet. A real regression arrives, moves the pass rate by
nine points, and the band swallows it. **Both mistakes come from the same place**: a threshold chosen
without knowing how wide the measurement is. Fix the width first, and both mistakes get harder.

## How it works

### PSI: has the mix moved?

`psi(expected, actual)` in [`evallab/online.py`](../../labs/common/evallab/online.py) is one line per
bucket, summed:

```python
def psi(expected: dict, actual: dict, eps: float = 1e-6) -> float:
    """... The usual reading is under 0.1 stable, 0.1 to 0.25 worth a look,
    over 0.25 assume something moved. ..."""
    keys = set(expected) | set(actual)
    total = 0.0
    for k in sorted(keys):
        e = expected.get(k, 0.0)
        a = actual.get(k, 0.0)
        e = max(e, eps)
        a = max(a, eps)
        total += (a - e) * math.log(a / e)
    return total
```

`mix(items, key)` produces the two proportion maps it wants, and here is the sweep, all five rows,
computed by [`build/m14-numbers.py`](../../build/m14-numbers.py) against the real intent mix of the 57
dev items — `policy_fact 0.421`, `boundary 0.281`, `how_to 0.158`, `out_of_scope 0.088`,
`exception 0.053`:

```
window                       psi     reading
the same mix, re-sampled       0.000   stable
held-out test split            0.762   assume something moved
one category thinned by half   0.163   worth a look
a new category appears at 10%  1.162   assume something moved
everything collapses onto one category  0.485   assume something moved
```

Three properties of that table are the lesson.

**The zero row is the control.** The same 57 items, re-measured, scores `0.000`. A drift metric that is
non-zero on identical data is broken, and you cannot know it is not broken unless you have a row like
this. Run it on every deploy of the metric.

**A new category is the loudest thing that can happen.** `1.162` for a tenth of traffic arriving from
nowhere, against `0.163` for a whole existing category being halved. The metric is not symmetric, and it
should not be: a category at 10% that was not in the baseline is a feature or an attack, and either way it
is a thing that did not happen last week.

**`eps` is not free, and the direction it points is the point.** Flooring a zero bucket at `1e-6` instead
of dividing by zero is a convenience, and it buys a large *finite* contribution — which is the right
direction, because the thing that vanished is exactly what you want to be told about.

### The row to build the module on: 0.762

The second row is the one that matters, and it is not a hypothetical window. It is **this course's own
held-out test split, measured against dev's mix**.

| | dev (57) | held-out test (37) |
|---|---|---|
| `policy_fact` | 0.421 | 0.270 |
| `boundary` | 0.281 | 0.405 |
| `how_to` | 0.158 | 0.270 |
| `out_of_scope` | 0.088 | 0.054 |
| `exception` | **0.053** | **absent** |
| **PSI** | | **0.762** |

Decomposed, bucket by bucket:

```
  boundary       0.281 -> 0.405   +0.046
  exception      0.053 -> 0.000   +0.572
  how_to         0.158 -> 0.270   +0.060
  out_of_scope   0.088 -> 0.054   +0.016
  policy_fact    0.421 -> 0.270   +0.067
```

**Three quarters of the 0.762 is one category that is not there.** The `exception` slice is three items
out of 57 in dev and **zero out of 37** in test — which [04.2](../module-04/lesson-02.md) already told
you, and read there as a good thing: a split that matched on everything would be the same set twice. Read
here it is the other fact about the same split. **The test split is not a second sample of the dev
population. It is a different population**, and a monitor built on dev's mix reads `0.762` on it and
says "assume something moved" — correctly, and on the very first day, about data that has not changed
since the baseline was recorded.

That is the shape the one-validation rule takes in production, and it is *not* the shape 04.2 gave it.
04.2's argument was about honesty: read test once, because every prompt edit you make after reading test
converts the number into a scoreboard for your own search. The production argument is about physics: **the
population moves, so a second reading of "test" is a reading of a different week.** The one-validation rule
and the drift check are the same defence from two sides — one protects the number from your own search,
the other protects it from the calendar. A team with a drift check and no one-validation rule still rots
its held-out number, and a team with the rule and no drift check still builds a monitor that fires on day
one.

The operational rule falls out of the row: **a drift threshold tuned on one mix is a claim about that
mix, and production is not obliged to keep supplying it.** Re-baseline deliberately, on a date, with the
old and new mixes printed side by side — never silently, because a silently re-baselined monitor has no
history and therefore no way to tell a season change from a regression.

### The band: a threshold derived from a width

The second number is not about the mix. It is about how wide the measurement of *any* rate is at the
sample size you actually have, and that is the number the alert threshold has to be derived from.
`Band` in [`evallab/online.py`](../../labs/common/evallab/online.py) does exactly one thing — compute a
Wilson interval at the baseline and the sample size, and let you compare a threshold against it:

```python
@property
def half_width(self) -> float:
    w = self.interval
    return (w.hi - w.lo) / 2

def explain(self, value: float) -> str:
    ...
    + (" The band is narrower than the measurement's own half-width, "
       "so it will fire on noise." if self.sensitivity < self.half_width else "")
```

That last clause is the entire lesson, and it is **computed rather than asserted**. If the band you chose
is narrower than the half-width of the measurement you are taking, the code says so out loud, in the
same string that reports the value:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import Band; print(Band('pass rate',0.90,20).explain(0.87)); print(Band('pass rate',0.90,200).explain(0.87)); print(Band('pass rate',0.90,200).explain(0.80))"
```

```
pass rate is 0.870 against a baseline of 0.900 on n=20 (Wilson 0.699-0.972, half-width 0.137). The band is 0.850-0.950. does not fire. The band is narrower than the measurement's own half-width, so it will fire on noise.
pass rate is 0.870 against a baseline of 0.900 on n=200 (Wilson 0.851-0.934, half-width 0.042). The band is 0.850-0.950. does not fire.
pass rate is 0.800 against a baseline of 0.900 on n=200 (Wilson 0.851-0.934, half-width 0.042). The band is 0.850-0.950. FIRES.
```

The same 5-point band, the same baseline, two sample sizes. At `n=200` the band is *wider* than the
half-width (`0.042`) and the sentence is gone, and `0.80` fires while `0.87` does not — a monitor that
can tell a real drop from a bad day. At `n=20` the band is a third of the half-width (`0.137`), the
sentence is there, and the monitor cannot tell them apart at all.

The sweep, and the half-width is the only column that matters:

| n | Wilson 95% | half-width | 5-point band | fires on 0.85? | on 0.95? |
|---|---|---|---|---|---|
| 20 | 0.699–0.972 | **0.137** | 0.85–0.95 | no | no |
| 50 | 0.786–0.957 | **0.085** | 0.85–0.95 | no | no |
| 100 | 0.826–0.945 | **0.060** | 0.85–0.95 | no | no |
| 200 | 0.851–0.934 | **0.042** | 0.85–0.95 | no | no |
| 500 | 0.871–0.923 | **0.026** | 0.85–0.95 | no | no |

Read the "fires" columns first, because they look like a bug: nothing fires anywhere, because `0.85` and
`0.95` are exactly on the band edges and `fires` is a strict comparison. That is not the point. The point
is in the next table, which is the cost of the band and is pure arithmetic on the same widths.

### What a 5-point band costs at each sample size

Assume the system really is at 0.90 and nothing has changed. Draw a window of `n` requests, compute the
pass rate, and ask how often it falls outside `0.85–0.95`. This is a binomial, and it is the number
nobody writes down before shipping an alert:

| n | false alarms on a healthy day | catches a true drop to 0.80 | catches a true drop to 0.70 |
|---|---|---|---|
| 20 | **25.45%** | 60.0% | 89.4% |
| 50 | 23.39% | 81.1% | 99.3% |
| 100 | 6.36% | 87.1% | 100.0% |
| 200 | 1.30% | 95.7% | 100.0% |
| 500 | 0.02% | 99.8% | 100.0% |

**At `n=20`, one healthy day in four wakes somebody up** — equivalently, only **74.5%** of healthy
windows land inside the band. And the same row says a real ten-point drop is caught only 60% of the
time, so two times in five the monitor misses the thing it was built for. Both columns are bad at once,
and they are bad for the same reason: twenty requests is not enough to measure a rate. At `n=200` the
false-alarm rate is `1.3%` and the catch rate is `95.7%`, and the band is a monitor. At `n=500` it is
`0.02%` and `99.8%`.

This is [10.3](../module-10/lesson-03.md)'s trade, restated in the units a production monitor lives in,
and the answer is the same: **you cannot buy sensitivity with a threshold, you buy it with sample size.**
Every other move — a narrower band, a cleverer aggregation, a smarter rule — moves the cost to somewhere
else or hides it.

So the two numbers do two different jobs and the band is derived from both:

| Question | Answered by | Number |
|---|---|---|
| Has the **input** moved? | PSI against the baseline mix | `0.762` on this course's own held-out split |
| Is the **movement** bigger than the measurement? | the Wilson half-width at this `n` | `0.137` at `n=20`, `0.042` at `n=200` |
| When do we **wake somebody**? | a band at least as wide as the half-width | `0.850–0.950`, and the sentence saying so when it is not |

The first row is why a monitor needs two alerts rather than one. A pass rate inside its band while PSI
reads `0.48` is not a healthy system — it is a system being measured on a population it no longer serves,
and the pass rate is answering a question nobody asked. **Drift first, then the rate**: if the mix moved,
the rate is not comparable, and the only honest thing to do is re-baseline and re-measure, not to page.

## Show me

Everything below is the shipped code in this repository, with no model and no API key.

The whole module in one command — the PSI sweep, the band sweep, the `explain` strings, the sampling
sweep and the regression list:

```console
$ py build/m14-numbers.py
```

```
=== PSI: the production mix moving away from dev ===
baseline mix: {boundary: 0.281, exception: 0.053, how_to: 0.158, out_of_scope: 0.088, policy_fact: 0.421}

window                       psi     reading
the same mix, re-sampled       0.000   stable
held-out test split            0.762   assume something moved
one category thinned by half   0.163   worth a look
a new category appears at 10%  1.162   assume something moved
everything collapses onto one category  0.485   assume something moved
```

The band sweep and its two `explain` lines:

```
n     baseline  wilson 95%      half-width  sens 0.05   fires on 0.85?  on 0.95?
 20  0.900     0.699-0.972      0.137      0.05               no         no
 50  0.900     0.786-0.957      0.085      0.05               no         no
100  0.900     0.826-0.945      0.060      0.05               no         no
200  0.900     0.851-0.934      0.042      0.05               no         no
500  0.900     0.871-0.923      0.026      0.05               no         no
```

```
n=20, baseline 0.90, sensitivity 0.05:
  pass rate is 0.870 against a baseline of 0.900 on n=20 (Wilson 0.699-0.972, half-width 0.137). The band is 0.850-0.950. does not fire. The band is narrower than the measurement's own half-width, so it will fire on noise.
n=200, same baseline and sensitivity:
  pass rate is 0.870 against a baseline of 0.900 on n=200 (Wilson 0.851-0.934, half-width 0.042). The band is 0.850-0.950. does not fire.
```

The drift decomposition — which category the 0.762 is actually made of:

```console
$ py -c "import sys, math; sys.path.insert(0,'labs/common'); from evallab import load, mix, psi; d=load('support'); key=lambda it:(it.slice or {}).get('intent','unknown'); b=mix(d.items_for('dev'),key); t=mix(d.items_for('test'),key); print('psi = %.3f'%psi(b,t)); [print('  %-14s %.3f -> %.3f   %+0.3f'%(k,b.get(k,0.0),t.get(k,0.0),(max(t.get(k,0.0),1e-6)-max(b.get(k,0.0),1e-6))*math.log(max(t.get(k,0.0),1e-6)/max(b.get(k,0.0),1e-6)))) for k in sorted(set(b)|set(t))]"
```

```
psi = 0.762
  boundary       0.281 -> 0.405   +0.046
  exception      0.053 -> 0.000   +0.572
  how_to         0.158 -> 0.270   +0.060
  out_of_scope   0.088 -> 0.054   +0.016
  policy_fact    0.421 -> 0.270   +0.067
```

The tests, which assert the two properties the metric has to keep:

```console
$ py -m pytest tests/test_online.py -q
16 passed in 0.04s
```

`test_psi_is_zero_for_the_same_mix` is the control row. `test_a_category_that_disappears_is_reported_not_swallowed`
asserts `psi > 0.1` when a category is removed, and its docstring is the design statement: *"The thing
that vanished is exactly what you want to be told about."* `test_a_new_category_shows_up` asserts
`psi > 0.25` for a tenth of traffic arriving from nowhere. `test_a_band_narrower_than_the_measurement_fires_on_noise`
asserts both halves — `b.half_width > b.sensitivity` **and** the string `"will fire on noise"` is in the
explanation — and `test_the_same_band_at_a_reasonable_n_does_not` asserts the same band at `n=200` produces
neither.

> [!IMPORTANT]
> These are **counts over the shipped dataset's own items**, not measurements of a production system. The
> 0.762 is the distance between two halves of a 94-item teaching dataset, and it is the right number *for
> that dataset*; the argument it supports — that a split can be a different population rather than a
> second sample — is the argument that transfers. The false-alarm and catch rates in the band table are
> exact binomial probabilities for a stated `n`, a stated baseline and a stated band, computed from first
> principles rather than estimated; no model, judge or latency is involved anywhere in this lesson.

## Try it

**Predict first**, on paper:

1. You build the monitor on the dev mix and point it at the held-out test split. Predict the PSI, and say
   whether the resulting alert would be reporting drift or reporting the split.
2. You set the band to `±5` points on a metric with a true rate of 0.90. Predict the false-alarm rate at
   `n=20` and at `n=200`, and say which of the two numbers you would put in the design review.
3. A new category arrives at 10% of traffic and no existing category changes at all. Predict whether PSI
   moves more or less than halving an existing category, and explain the asymmetry.
4. The pass rate is inside its band and PSI reads 0.48. Predict which one a monitoring tool would page
   about by default, and say what you would want it to page about instead.

[Lab: evallab package](../../labs/common/)

1. **Compute the sweep yourself, including the zero row.** `mix()` over the dev items keyed on
   `slice.intent`, then `psi(base, base)` and `psi(base, mix(test))`. Then build the three synthetic
   windows yourself — halve one category, add a new one at 10%, collapse onto one — and put all five rows
   in a table with the reading beside each. The zero row is the one to keep: it is the control that tells
   you the metric is measuring what you think.
2. **Decompose the 0.762 by hand.** For each of the five categories, compute `(a - e) * ln(a / e)` and
   sum. Then delete the `exception` bucket from the comparison entirely — pretend the baseline never had
   it — and recompute. Write down what the PSI becomes and what you have just proved about how much of the
   signal was one missing category.
3. **Build the band table and the cost table.** `Band("pass rate", 0.90, n)` for `n` in 20, 50, 100, 200,
   500, printing the Wilson interval, the half-width and whether `explain` contains the noise sentence.
   Then, for each `n`, compute from the binomial how often a healthy day fires on a 5-point band and how
   often a true drop to 0.80 is caught. Put the two tables next to each other and write the sentence that
   says why the second one is the only one you would put in a design review.
4. **Find the sample size you actually need.** Holding the band at 5 points, find the smallest `n` in
   200/500/1000/2000 where the false-alarm rate on healthy traffic falls under 1%. Then ask your own
   system for a day's traffic and write down whether you can afford that `n` per day, or whether you need
   to pool across days — and say what pooling does to the drift check.
5. **Write the re-baseline policy as a procedure.** A named trigger, a date, the old and new mixes printed
   side by side, the PSI that caused it, and a rule about who signs it off. Then find the one sentence in
   it that stops a silent re-baseline from deleting your history.

## Break it

**Set the band from a round number.** `±5` points is defensible on a panel and indefensible on an `n=20`
metric, where the half-width is `0.137` and the monitor fires on one healthy day in four. The lie: **a
threshold chosen before you know the width of the measurement is a mood**, and the code says so in a
sentence you did not read.

**Compare this week against a baseline nobody checked.** The dev mix is a snapshot from when the set was
built. Production has moved; the `0.762` row is what that looks like when you find out. The lie: **a
baseline is a claim about a population, and a claim ages silently** — nothing tells you it is stale until
the day you compare against it.

**Alert on the pass rate and ignore the mix.** The rate is inside its band, the panel is green, and the
system has been quietly serving a different population for a month. The lie: **a rate measured on a
population you no longer serve is not a low rate, it is a number about the wrong thing** — and it gets
worse silently, because the number itself looks fine.

**Re-baseline silently on every alert.** The monitor goes quiet, the history is gone, and nobody can tell a
season change from a regression a year later. The lie: **a re-baseline is a decision, and a decision with
no record is indistinguishable from a bug.**

**Widen the band until it stops firing.** One quiet afternoon, no written reason, and a real nine-point
regression goes through without anybody noticing. The lie: **every band widening looks like prudence and
every one of them is an unmeasured miss rate** — the mirror image of the false-alarm problem, and the same
missing number in the other direction.

**Report the PSI without the decomposition.** `0.762, assume something moved` is a fine headline and a
useless instruction. The lie: **a total with no decomposition tells somebody to go and look, rather than
telling them what to look at** — and three quarters of this one was a single category that disappeared.

## Fix it

1. **Keep both alerts, and order them.** PSI first: above 0.25, the pass rate is not comparable and the
   action is to re-baseline and re-measure, not to page. Below 0.1, the pass rate and its band are the
   page. In between, somebody looks.
2. **Derive every band from a Wilson half-width at the `n` you actually sample**, and make the code say so
   when the band is narrower. `Band.explain` already prints the clause; the fix is to stop overriding
   `sensitivity` without reading the sentence.
3. **Size the window before you set the band.** Below about 1% false alarms on healthy traffic, a 5-point
   band needs a window in the high hundreds. If your daily traffic is 60 requests, the answer is to pool
   days or to alert on a longer interval — not to tighten the band.
4. **Re-baseline deliberately and on the record.** Old mix, new mix, PSI, date, and the name of whoever
   agreed. The `0.762` row is what a legitimate re-baseline looks like: a large number, a decomposition,
   and a decision.
5. **Print the decomposition with the total.** Five numbers, not one. The signal is in the buckets, and a
   vanished category is the loudest thing the metric can say.
6. **Watch the zero row in CI.** A PSI of a mix against itself must be `0.000`. The day it is not, your
   monitor is measuring something you have not read yet, and it is measuring it on the day you most need
   it to be right.

## How do I know it works?

**Challenge, on dev.** The 57 dev items, and six checks before any of this pings anybody:

- **The zero row is `0.000`.** `psi(base, base)` on the same mix, every run. A drift metric that is
  non-zero on identical data is worse than no drift metric, because it produces a number.
- **All three thresholds have a written meaning and a named action.** Under 0.1 "carry on", 0.1–0.25
  "somebody looks", over 0.25 "assume something moved and re-measure". A threshold with no action attached
  is decoration.
- **The band is at least as wide as the half-width, at the `n` you sample.** At `n=20` with a 0.90 baseline
  that means a half-width of `0.137`; if your band is 5 points, `explain` says *"The band is narrower than
  the measurement's own half-width, so it will fire on noise"* and you do not ship it.
- **The cost of the band is written down with its number.** `25.45%` false alarms at `n=20`, `1.30%` at
  `n=200`, with the catch rate beside them (`60.0%` and `95.7%`). A band whose cost has not been computed
  is a number someone liked.
- **The PSI total is always published with its decomposition.** Five buckets, and the vanished one is
  visible.
- **The re-baseline procedure exists in writing, with a name attached.** You can point at it, and it
  requires the old and new mixes to be printed together.

**Then one held-out validation**, on the split you did not build the baseline from. Run the whole monitor
against the **37 test items** and read the two answers separately:

| | dev, 57 | held-out, 37 |
|---|---|---|
| PSI against the dev baseline | 0.000 (it *is* the baseline) | **0.762** |
| Largest single bucket's contribution | — | **+0.572** (`exception`, 0.053 → absent) |
| Pass rate, human labels | 52.6% | 45.9% |
| What the monitor should have done | nothing | **re-baseline and re-measure, not page** |

The pass-rate row is [04.2](../module-04/lesson-02.md)'s table and it is here as the *control*: `52.6%`
against `45.9%`, on intervals 25 and 31 points wide, is a difference the measurement cannot resolve, and
nobody should have paged about it. The PSI row is the *signal*: `0.762` is not a number you can ignore,
and it is also not a page. The monitor that reads the drift row and says "the population is not the one my
baseline describes, so my pass rate is not comparable, so I am going to re-measure" has done the right
thing, on the very first window, without anybody widening anything.

And note what the held-out run did **not** say: it did not say the system got worse. `52.6%` to `45.9%` on
37 items is inside the noise; `0.762` is a fact about which requests you measured. **Those are two
different findings, from the same data, and conflating them is how a monitoring project turns into a
blame project.** The band lesson is the same shape: `0.137` is a width, not a verdict.

## Use / don't use

**Do monitor the input mix separately from the output rate, and treat drift as a gate on the rate.** If
PSI is over 0.25, the pass rate is not comparable and the correct action is to re-measure. A panel with
one green number and no mix chart will confidently report a rate about a population that has moved.

**Do derive the band from the half-width at the size you sample**, and keep the sentence `Band.explain`
prints. If it prints the noise warning, the band is wrong, and the answer is a bigger window rather than a
narrower band.

**Do keep a `0.000` control row in the job that computes PSI.** It is the cheapest test in this module and
the only one that tells you the metric still measures what you think.

**Do re-baseline loudly.** Old mix, new mix, the PSI, the date, the name. A re-baseline is a decision
about what you are willing to be alarmed by, and it deserves the same trail as a threshold change.

**Do keep the per-bucket decomposition with every PSI you act on.** A total of `0.762` is a task; a
decomposition is a finding.

**Don't set a band on a daily volume that cannot support it.** Sixty requests a day and a 5-point band is
a monitor that fires about one day in four, and the team's correct response will be to switch it off.

**Don't widen the band to make the noise stop without computing the miss rate you just bought.** Every
widening is a purchase, and `10.3`'s table is the price list.

**Don't treat a large PSI as a regression.** `0.762` here is a different population, not a worse system,
and paging on it is how you get paged for the season.

**Don't use this course's 0.762 as your own threshold.** It is the distance between two halves of a
94-item teaching dataset. The method transfers; the number is about this dataset, and your own baseline
mix is something you have to measure.

What teams actually do: two panels with different owners. A **drift panel** — the mix over time, the PSI
against a dated baseline, and a re-baseline button that requires a reason — run daily on cheap, unjudged
requests. And a **rate panel** with a band derived from the half-width at the daily sample size, run on the
[14.1](lesson-01.md) sample, which fires less than once a fortnight and fires because something moved.
The band is almost never the interesting number. **The interesting number is the one that tells you whether
to trust the other one**, and that is the mix.

## Reflect

1. The monitor's band is `±5` points and its daily sample is 20 requests. Write the two sentences you would
   put in the design review, quoting `25.45%` and `60.0%`, and say what you would change instead of the
   band.
2. PSI against your baseline reads `0.48` and the pass rate is inside its band. Write the message to the
   team, in three sentences, that says what happened and what the correct action is — and say what you
   would have needed on the panel to have known a week earlier.
3. Your own test split scores `0.762` against the dev mix and you are about to treat it as a second
   validation. Write down what you would tell somebody who wanted to run it twice "to reduce the
   variance", and connect it to the one-validation rule in 04.2.
4. Somebody asks why the drift threshold is 0.25 when the 5-point rate band is 0.05. Write the sentence
   that explains the two numbers measure different things, using the decomposition of the 0.762.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- scikit-learn, [Common pitfalls and recommended
  practices](https://scikit-learn.org/stable/common_pitfalls.html) — the worked drift example this
  lesson's arithmetic follows, and the reason a model validated on one input distribution is not validated
  on the next one.
- Wikipedia, [Population stability
  index](https://en.wikipedia.org/wiki/Population_stability_index) — the origin of the metric, the
  `0.1 / 0.25` conventions, and the long-standing caveat that a summed score hides which bucket moved.
  The `eps`-floored vanishing category here is that caveat made executable: it reports the vanished
  bucket loudly rather than dropping it.
- Douglas Dean and Daniel Voss, [The Design and Analysis of
  Experiments](https://link.springer.com/book/10.1007/978-1-4757-5482-1) (1998) — the reason a threshold
  cannot be chosen before the width of the measurement is known, and the arithmetic behind re-baselining
  as a decision with a date attached rather than a reflex.
- OpenTelemetry, [Sampling](https://opentelemetry.io/docs/concepts/sampling/) — where the sample size `n`
  in the band table comes from, and why an alert band over a sampled stream has to be computed at the
  sample rate you actually run rather than at the traffic you wish you ran.
