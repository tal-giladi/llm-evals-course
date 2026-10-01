---
id: "13.3"
module: 13
minutes: 20
practice_minutes: 55
prerequisites: ["13.1", "07.5"]
objectives:
  - Measure how often one judge disagrees with itself on the same item, and say what that number means for a single-run gate.
  - Choose a repeat count from a table of measured false-alarm rates rather than from a round number, and say what repeats cannot buy.
  - Explain why widening a tolerance and hiding a regression produce the same number inside the gate, and name the one procedure that tells them apart.
  - Add an entry to a quarantine list with a reason, an owner and a review date, and say what every entry costs.
volatility: implementation
sources:
  - title: "Self-Consistency Improves Chain of Thought Reasoning in Language Models (Wang et al., 2023)"
    url: https://arxiv.org/abs/2203.11171
  - title: "The Mythos of Model Evaluation (Bowyer et al., 2024)"
    url: https://arxiv.org/abs/2411.19994
  - title: "About protected branches (GitHub Docs)"
    url: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 13.3 · Flaky evals: repeats, tolerances, quarantine

The gate from lesson 13.1 blocks one healthy pull request in seven, and the reason is that your judge is a
model. This lesson measures the noise instead of guessing at it, prices the three tools that reduce it —
repeats, tolerances and quarantine — in the order they should be reached for, and ends on the tool teams
abuse, because a quarantine entry is a check that has stopped running and a gate that blocks nothing is
indistinguishable from a gate that is not there.

## Why it matters

A team puts the support bot's eval behind required status checks on a Friday. It blocks a pull request on
Monday. The diff is three lines of logging. They re-run the suite by hand and it passes, so they merge. The
next pull request is blocked on Tuesday. On Wednesday it is blocked again — and this time it is a genuine
regression, and two engineers spend a morning establishing that it is genuine, because the last two blocks
were not.

Nothing in that story is anybody's fault. The gate is doing exactly what it was configured to do, and what
it was configured to do is fire when a pass rate moves by more than a threshold. **A threshold on a
measurement fires on the measurement's noise as well as on the change.** The shipped configuration, on the
94 frozen items at a 5-point tolerance, prices out like this:

| Repeats | False alarms — healthy build, gate fires anyway | Missed — a break of one question in ten |
|---|---|---|
| 1 | **13.8%** (55/400) | 44.8% |
| 3 | **9.0%** | 50.5% |
| 5 | **7.5%** | 47.2% |

Read the first row. **One healthy build in seven.** That is not a broken gate; it is a gate that is being
run on a single sample from a model that disagrees with itself about a quarter of the time, and the honest
description of it is that the first number on the page is the number nobody will believe by the end of the
month.

A gate that blocks nothing gets deleted in a week — it is a yellow tick, and yellow ticks are not worth a
required check. A gate with a 10% false-alarm rate gets a worse fate, because it is a real gate that keeps
being wrong, and the only response a team has for a real gate that keeps being wrong is to re-run it and
then, a week later, to make it non-blocking. **It has spent the team's patience getting there, which is the
one resource a gate that blocks nothing never had to spend.** That is the failure this whole lesson is
about: a gate that blocks one healthy pull request in seven or eight is a gate the team will disable.

And the mirror of it is the reason the fix is not "tighten the threshold". The shipped test pins the far end
of the knob as precisely as the near end: at a **20-point** tolerance the 12-item regression does not block
at all, because 12.28 points is inside a 20-point band. The knob trades the two ways of being wrong and it
has never once been free. Lesson [10.3](../module-10/lesson-03.md) is the long version of this
table; what this lesson adds is that **the noise is not hypothetical, it is measurable today, on your own
items, before you ship anything.**

## How it works

Three tools, in increasing order of what they cost you. The order is the lesson.

### 1. The noise itself, counted

Your judge is a model. At temperature it disagrees with itself on the same question, and the recorded runs
in [`datasets/support.json`](../../datasets/support.json) keep five samples per item precisely so this can
be counted rather than assumed. Ask each item's first recorded sample against its other four, judge
`c-rubric-3b`, variant `v1`:

| Split | Items | Greedy vs one sample, disagree | Items where all five samples agree |
|---|---|---|---|
| dev | 57 | **52 / 228 = 22.8%** | 29 / 57 = 50.9% |
| held-out | 37 | **40 / 148 = 27.0%** | 15 / 37 = 40.5% |
| whole suite | 94 | **92 / 376 = 24.5%** | 44 / 94 = 46.8% |

**Nearly half of your eval is a single coin flip.** On 50 of the 94 items, the judge did not give the same
answer twice out of five, and on those items a pass rate computed from one sample is a number about the
sample rather than about the item. You can see what that looks like — the twelve most split items in the
dev half:

```
s01  [1, 0, 0, 0, 0]   passes 1/5       s34  [1, 1, 0, 1, 1]   passes 4/5
s03  [1, 0, 1, 1, 1]   passes 4/5       s35  [0, 0, 1, 0, 0]   passes 1/5
s04  [0, 0, 0, 0, 1]   passes 1/5       s38  [0, 1, 1, 1, 1]   passes 4/5
s12  [0, 0, 0, 0, 1]   passes 1/5       s41  [1, 1, 1, 1, 0]   passes 4/5
s21  [0, 0, 1, 0, 0]   passes 1/5       s44  [0, 0, 0, 1, 0]   passes 1/5
s24  [0, 0, 0, 1, 0]   passes 1/5       s54  [0, 0, 1, 0, 0]   passes 1/5
```

`majority_vote()` is what lesson [07.5](../module-07/lesson-05.md) gave you, and it has a rule that is
worth stating out loud because it is the single most common way to make a suite look broken when it is
not: **a tie resolves to fail.** Read the pass rate that comes out of each arity on these items:

| Repeats averaged | Pass rate | Judge calls per run |
|---|---|---|
| 1 | 50 / 94 = 53.2% | 94 |
| **2** | **40 / 94 = 42.6%** | 188 |
| 3 | 52 / 94 = 55.3% | 282 |
| 4 | 45 / 94 = 47.9% | 376 |
| 5 | 50 / 94 = 53.2% | 470 |

The arity-2 row is not a bug and it is not noise: two of two is not a majority, and the rule sends it to
fail. **Every even repeat count is the strictest setting you can ship.** A team that tries 2 repeats
because it is cheaper than 3 watches its pass rate fall by ten points and concludes the suite is
degenerate.

### 2. Repeats — the first thing to reach for, and the most expensive per run

Averaging is the first thing to reach for because it is the only one of the three that improves the
*measurement* rather than the *decision*. Price it on the 57 dev items at the shipped 5-point tolerance, 400
independent pairs of healthy runs, with a 3-item break planted as the regression:

| Repeats | False alarms | Missed a 3-item break | Judge calls per run |
|---|---|---|---|
| 1 | 94/400 = **23.5%** | 54.8% | 57 |
| 3 | 73/400 = **18.2%** | 58.8% | 171 |
| 5 | 55/400 = **13.8%** | 57.8% | 285 |

And here is what it does **not** buy. Take the standard deviation of the difference between two healthy runs
of the same build, over 400 draws:

| Repeats | sd of the healthy drop | Widest healthy gap seen |
|---|---|---|
| 1 | **5.87 pts** | 17.5 pts |
| 3 | **4.85 pts** | 14.0 pts |
| 5 | **4.45 pts** | 14.0 pts |

Three repeats costs three times as much as one and takes the noise from 5.87 points to 4.85 — a 17%
reduction for a 200% increase in cost. Five takes it to 4.45. **Repeats are the expensive way to shrink the
smaller term**, and the missed column above barely moves in either direction, for the reason lesson 10.3
gave: a regression is a proportion, and a proportional drop is exactly as detectable at one sample as at
five. Averaging buys you a quieter measurement of the same signal. That is worth something, and it is worth
knowing exactly what.

### 3. Tolerances — the honest limit of the technique

The second tool is the one everybody reaches for second, and it has a property that has to be said plainly
because it is the limit of the whole approach. On the 57 dev items, with the same 34/57 baseline, plant a
block of broken items and sweep the tolerance:

```
baseline 34 / 57
broken=1   drop= 1.75 pts  blocked@[0.5,2,5,10,20,30] = [T,F,F,F,F,F]
broken=3   drop= 5.26 pts  blocked@[0.5,2,5,10,20,30] = [T,T,T,F,F,F]
broken=12  drop=12.28 pts  blocked@[0.5,2,5,10,20,30] = [T,T,T,T,F,F]
```

Read row three and ask what tolerance you would need to *miss* a 12-item regression. Ten points, and the
row goes `[T,T,T,T,F,F]` — from the fourth column on, a change that broke 12 of 57 items and cost 12.28
points of pass rate is invisible. Now read row one and ask the same question about a 1.75-point drop, which
is what a single item is worth. There is no tolerance that blocks one and not the other; there is only the
column where you stopped looking.

**Here is the honest limit, and it is a real one: from inside the gate, a widened tolerance and a hidden
regression are the same number.** A 5-point tolerance that passes a 5.26-point real drop and a 10-point
tolerance that passes a 12.28-point one emit the same `passes:` line. Nothing in the decision distinguishes
them, because the decision was not given the information to.

The only procedure that distinguishes them is the one lesson 13.1 already runs: **plant a regression of a
size you have named and check it is still caught.** That is not a workaround; it is the reason a tolerance
is a design decision rather than a number. `test_the_tolerance_is_the_only_knob_that_trades` pins it as an
assertion — the 12-item regression must produce `[True, True, True, True, False, False]` at tolerances
`0.005, 0.02, 0.05, 0.10, 0.20, 0.30` — so a future edit that turns the gate into a coin cannot pass the
suite quietly.

### 4. Quarantine — the one that is a decision, not a knob

The first two tools adjust a number. The third records a belief. A failing eval is a claim, and sometimes
the claim is right and the code is wrong; sometimes the eval has drifted from what the product does;
occasionally the eval itself is broken and cannot be made to run again this quarter. **A quarantine list is
how you say which of those you currently believe, in a file, where a pull request can see it.** Here is
[`evallab/gate.py`](../../labs/common/evallab/gate.py), in full:

```python
@dataclass
class Quarantine:
    """Tests you have stopped believing, with the reason and an owner.

    An entry without a reason and a review date is a test that was deleted
    with extra steps, so both are required.
    """

    items: dict = field(default_factory=dict)   # test id -> {reason, owner, review_by}

    def is_quarantined(self, test_id: str) -> bool:
        return test_id in self.items

    def add(self, test_id: str, reason: str, owner: str, review_by: str) -> None:
        if not reason or not owner or not review_by:
            raise ValueError(
                f"quarantining {test_id} needs a reason, an owner and a review date; "
                "an entry without all three is a deleted test wearing a badge"
            )
        self.items[test_id] = {"reason": reason, "owner": owner, "review_by": review_by}

    def overdue(self, today: str) -> list:
        return [k for k, v in self.items.items() if v["review_by"] < today]
```

Three fields, and the constructor refuses the entry without all three. That refusal is the entire design
argument in one `raise`: **an entry without a reason, an owner and a review date is a test that was
deleted with extra steps**, and the badge is the only thing that makes it harder than `rm`. The error
message says so in the words a code reviewer needs — *an entry without all three is a deleted test wearing
a badge* — which is a sentence you can put in a pull-request template and mean.

`overdue(today)` is the other half, and it is the half that stops the list from becoming a landfill. A
quarantine entry with no expiry is a permanent deletion with a JSON file attached. A date is a claim that
somebody will look again, and `overdue` is how the list tells you when they did not.

**The gate reports which of the ids it ran are quarantined**, and this is worth being precise about,
because the code is not doing what the name suggests. `run_gate` takes `quarantined_ids` — the ids it
actually ran — and intersects them with the list:

```python
quarantined = [t for t in (quarantined_ids or []) if q.is_quarantined(t)]
```

It then computes the drop over **every** pair it was given. A quarantine entry changes what the run *says*,
not what the run *decides*. Measured, with a 9-item regression planted and the list grown from nothing to
half the suite:

| Quarantined | Of 94 | Blocked? | What changed |
|---|---|---|---|
| 0 | 0.0% | yes | reason begins `blocked: candidate is 5.3 points below the cur` |
| 1 | 1.1% | yes | identical |
| 9 | 9.6% | yes | identical |
| 47 | 50.0% | yes | identical |

Not one character of the decision moves. That is correct, and it is the reason the class is built this way:
**the gate must not be able to talk itself out of a regression by having previously written down that some
things are flaky.** What the entry buys is the opposite — the report names the ids, so the human reading
the pull request sees `s05` in the quarantine list and knows to look at it, rather than not knowing.

The shipped list, [`labs/module-13/solution/quarantine.json`](../../labs/module-13/solution/quarantine.json),
has exactly one entry out of 94, which is **1.1% of the suite**. That is what a healthy quarantine list
looks like and you should be able to say the number out loud. At 50% you are not running a suite with a
few known-bad checks; you are running a green light wired to nothing, and no ticket will ever be filed
about it.

## Show me

Everything below was run in this repository with no model, no network and no API key. The judge is the
recorded educational model from modules 1 to 12; every statistic below is computed for real from its
verdicts, and none of it measures a named model in the wild.

The gate's own test suite — fourteen tests, which is the executable statement of everything in this lesson:

```
py -m pytest tests/test_gate.py -q
```

```
..............                                                           [100%]
14 passed in 0.20s
```

The tolerance sweep, in one command from the repository root:

```
py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import RecordedJudge, load; from evallab.gate import run_gate; data=load('support'); judge=RecordedJudge(data,'c-rubric-3b'); dev=data.items_for('dev'); v=lambda broken=(),w=0: [(it.label('v1'), 0 if it.id in broken else judge.samples(it,'v1')[w]) for it in dev]; base=v(); T=(0.005,0.02,0.05,0.10,0.20,0.30); print('baseline', sum(j for _,j in base), '/', len(base)); [print(f'broken={k:<3} drop={(sum(j for _,j in base)-sum(j for _,j in c))/len(base)*100:5.2f} pts  blocked@[0.5,2,5,10,20,30] = [' + ','.join('T' if run_gate(base,c,tolerance=t).blocked else 'F' for t in T) + ']') for k in (1,3,12) for c in [v({it.id for it in dev[:k]})]]"
```

```
baseline 34 / 57
broken=1   drop= 1.75 pts  blocked@[0.5,2,5,10,20,30] = [T,F,F,F,F,F]
broken=3   drop= 5.26 pts  blocked@[0.5,2,5,10,20,30] = [T,T,T,F,F,F]
broken=12  drop=12.28 pts  blocked@[0.5,2,5,10,20,30] = [T,T,T,T,F,F]
```

Both failure rates of the shipped gate, 400 trials a cell, 94 items, 5-point tolerance, from the module 13
lab:

```
py labs/module-13/solution/gate_lab.py --grid
```

```
 items  repeats  block  false alarms   missed  the block costs
    20        1      2         31.0%    47.0%            6.09 pts
    20        3      2         28.0%    49.0%            5.28 pts
    20        5      2         24.2%    50.7%            4.74 pts
    40        1      4         23.5%    40.8%            5.95 pts
    40        3      4         19.2%    48.8%            5.06 pts
    40        5      4         18.5%    49.2%            4.94 pts
    94        1      9         13.8%    44.8%            5.19 pts
    94        3      9          9.0%    50.5%            4.87 pts
    94        5      9          7.5%    47.2%            4.74 pts
```

And the gate run twice on the same code — once with a block planted, once healthy — which is the run a
pull request actually gets:

```
py labs/module-13/solution/gate_lab.py --out gate.json
```

```
planted regression : BLOCKED: candidate is 10.6 points below the current build. Interval -19.1 to -3.2 points; tolerance 5.  [1 quarantined: s05]
healthy re-run     : PASS-WITH-WARNING: candidate is 2.1 points down, which is inside the 5-point tolerance. Interval -7.4 to +2.1 points; tolerance 5. Not evidence of a regression and not evidence against one - widen the suite or raise the repeats before you believe this.  [1 quarantined: s05]
wrote gate.json
```

`[1 quarantined: s05]` on both lines is the whole disclosure mechanism. The healthy re-run is **the same
code, scored again**, and it is 2.1 points down — noise, not a regression, and the gate says so in words
rather than in a colour.

The three answers the gate can give, verbatim, so you can see which one is which:

```
passes: 26.3 points better; paired 95% interval +7.0 to +43.9 points (half-width +18.4)
passes, but the candidate is 1.8 points worse, inside the 5-point tolerance. A real drop that you have chosen to allow; paired 95% interval -5.3 to +0.0 points (half-width +2.6)
blocked: candidate is 5.3 points below the current build, over the 5-point tolerance; paired 95% interval -12.3 to +0.0 points (half-width +6.1)
```

And the quarantine, refusing an incomplete entry:

```
py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import Quarantine; q=Quarantine(); q.add('s01','flaky','', '2027-01-01')"
```

```
ValueError: quarantining s01 needs a reason, an owner and a review date; an entry without all three is a deleted test wearing a badge
```

> [!IMPORTANT]
> Every judge verdict above comes from the course's shipped **educational model** — a recorded,
> deliberately-flaky run filed under the judge id `c-rubric-3b`, which is a label and not a measurement of
> any real model. The false-alarm and miss rates are real computations over that recorded data, on 57 dev
> and 94 total items, and they describe *this* suite's noise. They are not a claim about how often a
> hosted judge disagrees with itself. 400 trials of a 10% rate buys you roughly ±2 points; the third
> significant figure on those cells is formatting.

## Try it

**Predict first**, on paper:

1. Your judge gives one verdict per item. Across 94 items the greedy verdict disagrees with a single
   resampled one on 24.5% of item-sample pairs. A healthy build is re-scored and the pass rate moves 4
   points. Is the gate right to block at a 3-point tolerance? What is the probability that a 4-point move
   on 94 items is the change rather than the noise?
2. You raise the repeats from 1 to 3. Name the one failure rate it improves, name the one it leaves roughly
   where it was, and give the sentence explaining why the second one cannot be bought with repeats.
3. A colleague wants to set the tolerance to 12 points because the noise is around 10. Predict what happens
   to a change that breaks 12 of 57 items, and say what you would have to run to know whether the tolerance
   is safe.
4. You quarantine `s05` with the reason "flaky". The `add` call raises. Say which of the three fields is
   missing, then say what the review date is actually for.

[Lab: evallab package](../../labs/common/)

1. **Count your own noise before you tune anything.** Run the 24.5% measurement on your judge, on your
   dev split, and split the items into "all recorded samples agree" and "they do not". Write down the two
   counts. Now compute the pass rate of the *unanimous* items only and compare it with the pass rate of
   the split ones. Say in one sentence which of those two numbers is a measurement and which is a coin.
2. **Price the arity, not the knob.** Use `majority_vote` on `samples[:1]`, `[:2]`, `[:3]`, `[:4]` and
   `[:5]` for every item and write the five pass rates down. Find the ones that are lower than their
   neighbours and explain each in terms of the tie rule. Then decide: what is the cheapest repeat count
   that is not even, and why is the answer not 2?
3. **Buy the false-alarm side and only the false-alarm side.** Write a loop that draws two independent
   healthy runs at 1, 3 and 5 repeats from the recorded samples, 400 pairs each, and blocks whenever the
   drop exceeds a 5-point tolerance. Record the three false-alarm rates and, in a second loop, the three
   miss rates against a 3-item planted break. Then write the one sentence that says what the second column
   is doing across the rows.
4. **Prove the honest limit.** Take the sweep from **Show me** and add a 6-point and an 8-point tolerance to
   the row for `broken=12`. Find the tolerance at which the 12-item regression becomes invisible, and then
   find the tolerance at which a single broken item becomes visible. Write down why no tolerance separates
   them, and what the only procedure is that does.
5. **Use the quarantine, and then misread it on purpose.** Open
   [`quarantine.json`](../../labs/module-13/solution/quarantine.json), add an entry with a real reason, a
   real owner and a date four weeks out, and run `gate_lab.py` again. Then add a second entry with an empty
   owner and read the error. Finally, grow the list to 20 entries and re-run: write down what changed in the
   decision and what changed in the report, in one sentence each.
6. **Find the date that should have fired already.** Call `overdue("2026-10-01")` and
   `overdue("2026-12-01")` on the shipped list. Write the one line you would add to the workflow so that
   an overdue entry is visible on the pull request rather than only in a file nobody opens.

## Break it

**Set the tolerance to whatever stopped the noise.** The healthy re-run moves the pass rate by about 4
points, so the tolerance goes to 10, and the gate goes quiet forever. The 12-item regression above costs
12.28 points and is now invisible too. The lie: **a threshold wide enough to absorb the noise is a threshold
wide enough to absorb the thing the gate was for**, and inside the gate the two look identical — which is
why a gate tuned by feel stops catching regressions without anything going red.

**Buy repeats as if they were items.** Going from 1 repeat to 3 costs three times the calls and takes the
healthy-drop sd from 5.87 points to 4.85, while the miss rate on a 3-item break goes 54.8% → 58.8%. The
lie: **a knob that shrinks the noise and leaves the signal alone cannot rescue a gate whose signal was
never large enough**, and the bill for it is charged on every pull request forever.

**Use an even repeat count and call the drop a regression.** At 2 repeats the pass rate on these items
reads 42.6% against 53.2% at 1, and nothing is wrong with the system. The lie: **two of two is not a
majority, and the tie rule sends it to fail**, so a suite "regressed" by ten points the day somebody halved
the number of calls to save money.

**Quarantine without a reason, or with an owner who left.** The first version is a deleted test wearing a
badge. The second is worse, because the entry has all three fields and a `review_by` in 2027 that nobody
will act on. The lie: **a quarantine list with no expiry is a permanent deletion with a JSON file
attached**, and the file is the only thing making it look like a decision.

**Let the quarantine decide.** Filter the broken items out of the pairs before calling `run_gate`, so the
list genuinely does change the verdict, and enjoy a suite that passes while 12 of 57 items are broken. The
lie: **a gate that can be talked out of a regression by a list someone wrote in advance is not a gate**,
and the list is written by the person who is most tired.

**Treat "one in seven healthy builds blocked" as a rounding error.** It is 55 blocked runs out of 400 on
identical code, and the cost is not the 55 mornings — it is that the 400th engineer to be re-run learns
that the red X is a thing you retry. The lie: **a required check with a known false-alarm rate does not
train people to trust it, it trains them to re-run it**, and the second habit is what eventually deletes
the check.

## Fix it

1. **Measure the noise before you set anything.** 24.5% disagreement and 44 of 94 unanimous items is a
   number you can put in the pull request that adds the gate, and it costs one loop over the recorded
   samples. A gate whose noise has never been measured has a threshold that somebody picked.
2. **Choose the repeat count from the measured false-alarm rate, not from a round number.** 13.8% at one
   repeat, 9.0% at three, 7.5% at five on 94 items — and then write the sentence saying what you gave up,
   because the miss column did not move.
3. **Never ship an even repeat count.** `majority_vote` breaks ties toward fail, so 2 and 4 are the two
   strictest settings available and the two most likely to be reached by accident when somebody halves the
   cost.
4. **Keep the tolerance test as an assertion, not a habit.**
   `test_the_tolerance_is_the_only_knob_that_trades` is the thing that stops a future edit turning the gate
   into a coin, and it is worth re-running whenever the tolerance moves: plant the regression you said you
   were buying detection for, and confirm it is still caught.
5. **Make the quarantine file refuse to be a graveyard.** Reason, owner and review date, enforced in the
   constructor. Print `overdue(today)` on the pull request, and put the overdue count in the comment, so
   the date is a promise with a witness.
6. **Let the quarantine disclose and never decide.** The gate names the ids it ran that are on the list and
   computes its decision over everything. Every entry is a check that has stopped running, so the number
   you watch is the count — and 1 out of 94 is what a list that is doing its job looks like.

## How do I know it works?

**Challenge, on dev.** The dataset's dev split is **57 items**, so all five of these have to hold before the
configuration you chose goes into the workflow:

- **You can state the noise rate for your own judge with a denominator.** On this data it is **52/228 =
  22.8%** on the 57 dev items, and the count of items whose five recorded samples all agree is **29 of 57**.
  A gate specification with no noise figure in it is a threshold somebody picked.
- **The false-alarm rate at your chosen repeat count is measured, not estimated.** At a 5-point tolerance on
  57 items the three rates are **23.5% / 18.2% / 13.8%** at 1 / 3 / 5 repeats over 400 pairs each. The one
  you ship is named in the pull request, with the number of pairs behind it.
- **The tolerance still catches the regression you said you were buying.** On the 57 dev items, a 12-item
  break costs **12.28 points** and must block at your tolerance — `[T,T,T,T,F,F]` across
  `0.5, 2, 5, 10, 20, 30` points is the shape of a real knob; a row of all-`F` is a gate that has stopped
  being one.
- **The repeat count is odd, and the reason is written down.** Not "3 because the config said 3" — the
  reason is the tie rule plus the measured false-alarm rate.
- **The quarantine is a list you can read out loud.** One line, with a count: `N entries of 94`. If N is
  above about 5%, the honest summary is that the suite does not gate and the flag is decoration.

**Then one held-out validation**, on `test_ids` — the remaining **37 items**, run once, on the repeat count
and tolerance you just fixed. It is worse on every axis, and that is the finding:

| | Dev, 57 items | Held-out, 37 items |
|---|---|---|
| Baseline pass rate, first sample | 34/57 = 59.6% | 16/37 = 43.2% |
| Greedy vs one sample, disagree | **52/228 = 22.8%** | **40/148 = 27.0%** |
| Items with all five samples agreeing | 29/57 = 50.9% | 15/37 = 40.5% |
| False alarms, 1 repeat, 5-point tolerance | 23.5% (400 pairs) | **34.2%** (400 pairs) |
| False alarms, 3 repeats, 5-point tolerance | 18.2% (400 pairs) | **24.2%** (400 pairs) |
| A 3-item break costs | 5.26 pts | 2.70 pts |
| A 12-item break costs | 12.28 pts | 8.11 pts |

**The noise got worse on the half you did not tune on — 22.8% to 27.0%, and the false-alarm rate at three
repeats went 18.2% to 24.2%** — and the same tolerance now blocks roughly one healthy build in four. That
is lesson 10.3's half-width story arriving from the other direction: the dev split is a noisier place to
measure than the whole suite, and a tolerance tuned on it is tuned against a measurement that was too
quiet. The last two rows are the counterweight to reading that as bad news. On 37 items a 12-item break
costs **8.11 points, not 12.28**, because a third of the set is smaller and the items in it are not average
items — so the signal shrank *and* the noise grew, and the miss rate is worse on held-out data for the same
reason it always is.

## Use / don't use

**Do measure the judge's self-disagreement before you set a tolerance.** One loop over recorded samples
answers it, and it is the difference between a gate and a coin with a threshold. Record it in the pull
request that adds the gate.

**Do buy false-alarm reduction with items before you buy it with repeats.** On this data the item axis
takes the 94-item false-alarm rate from 31.0% to 13.8%; the repeat axis takes it from 13.8% to 7.5% at
three to five times the calls per run. Repeats are the per-item, per-run cost that never stops.

**Do keep the tolerance's test in the suite.** A planted regression of a named size, asserted at every
tolerance the gate might be set to, is the only procedure that separates "I widened this until the noise
stopped" from "the gate still works". A suite with that test is a suite whose knob can be turned safely.

**Do write a quarantine entry as a sentence with a name and a date on it.** "Judge flips on this one at
temperature — tal — revisit 2027-01-01." Enforce all three in the constructor so nobody can skip one, and
print the overdue count on the pull request so the date means something.

**Do re-run a block only when you can say what would have been different.** The engineering instinct to hit
"re-run" is right and it is also exactly the habit that turns a required check into a suggestion. Knowing
the healthy re-run's drop in advance — 2.1 points on the shipped configuration, measured on the same build —
is what tells the re-run from a regression.

**Don't widen the tolerance because a run was noisy.** The gate cannot tell a noisy run from a hidden
regression; the two produce the same line of output. If the noise is the problem, the answer is repeats or
items, and if that is unaffordable the answer is a narrower gate on a slice, not a wider one on everything.

**Don't quarantine a flaky test instead of fixing its flakiness.** Quarantine is for an eval that has
stopped describing the product — a stale item, a rubric for a feature you removed. An item that is genuinely
coin-flip is an item whose *judge* is the problem, and every entry you add for it makes the suite weaker
without making the judge better.

**Don't let the quarantine change the decision.** The gate discloses; it does not filter. This is a design
property, not a limitation, and the reason it exists is that a list written in advance by a tired person
should not be able to talk the gate out of a real regression.

What teams actually do in production: they run the gate on a frozen set, they record the judge's
disagreement rate as a property of the judge, they set the tolerance against a named regression with a test
that keeps catching it, and they keep the quarantine list short enough to read out loud. The four habits
have one thing in common — **each one writes down something that would otherwise be folklore**, and
folklore is what survives a rebase and loses the argument.

## Reflect

1. The grid reads `false alarms 13.8% / missed 44.8%` at one repeat and `7.5% / 47.2%` at five. Write the
   two sentences that explain to a team why the second column went the wrong way when they spent money on
   the first, and say which knob you would actually spend on.
2. A 12.28-point regression and a 1.75-point drop both pass at a 10-point tolerance and print the same
   line. Write the paragraph you would send to the person who set that tolerance, and say what you would
   put in the code so the next person cannot do it by accident.
3. `quarantine.json` has one entry out of 94. Somebody adds four more "until we fix the judge". Write the
   review comment you would leave, in the sentence that makes the case in terms of what the gate is for
   rather than in terms of process.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- Xuezhi Wang et al., [Self-Consistency Improves Chain of Thought
  Reasoning](https://arxiv.org/abs/2203.11171) (ICLR 2023) — the argument for sampling a set of verdicts
  and taking the most consistent one rather than the greedy one, which is what `majority_vote` does here and
  why one sample is a statement about your sampler rather than about the item.
- Samuel Bowyer et al., [The Mythos of Model
  Evaluation](https://arxiv.org/abs/2411.19994) (2024) — why a headline number on its own is a claim, and
  why the repeat count that produced it belongs in the same sentence as the number.
- GitHub Docs, [About protected
  branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
  — what a required status check actually does to a team's behaviour, and why a check with a 10% false-alarm
  rate costs more patience than a check that never fires.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the habit under every number on this
  page: when a measurement can move on its own, the move and the change have to be told apart before a
  decision is made on the number.
