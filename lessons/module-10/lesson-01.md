---
id: "10.1"
module: 10
minutes: 17
practice_minutes: 45
prerequisites: ["06.2", "04.4"]
objectives:
  - Run a paired A/B on one fixed item set and read the bootstrap interval on the difference instead of the two pass rates.
  - Produce a flip list, sort it into what the candidate fixed and what it broke, and argue why the broke half is the one to read first.
  - Decide whether a four-point change on 94 items is a difference or a draw, using the interval and the sign-test p-value together.
volatility: concept
sources:
  - title: "Bootstrap Methods: Another Look at the Bootstrap (Efron & Tibshirani, 1993)"
    url: https://projecteuclid.org/journals/annals-of-statistics/volume-21/issue-3/Bootstrap-Methods-Another-Look-at-the-Bootstrap/10.1214/aos/1176344552.full
  - title: "The Common Lifecycle of a Machine Learning Model (KDD 2015 model monitoring tutorial)"
    url: https://www.kdd.org/kdd2015/
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 10.1 · A/B on the same items

A candidate system and the system it replaced both answered the same ninety-four questions, so the only
question left is which answers changed. This lesson reads that comparison properly — the interval on the
difference, the two-sided sign test, and above all the list of items that moved, which is the part of an A/B
a person actually acts on.

## Why it matters

A team rewrites a support bot's prompt. Two dashboards, both green, both defensible:

- **Baseline pass rate 55.3%. Candidate pass rate 28.7%.** The candidate is worse by 26.6 points and
  everyone can see it in one subtraction.
- **Baseline 55.3%. Candidate 55.3%.** Same numbers, because the dashboard rounds, or because it averages
  the candidate's pass rate over a week of runs while the baseline's is last month's best.

The first slide gets the change blocked. The second gets it shipped. Both slides are made from the same run,
and the difference between them is not the model — it is whether anyone computed the thing that the run was
designed to compute.

The failure this lesson is about is the shape of that gap. A pass rate is a **total** over items. It does not
say which items moved, in which direction, or whether the movement is the same size on every item. On the
preset in this module, a candidate *fixed* ten items and *broke* thirty-five, and the headline number that
summarises that is `+26.6 points` — a figure that reads identically whether ten things got better or ten
things got much worse.

Nobody debugging a regression wants the headline. They want the thirty-five.

## How it works

### The three numbers, and which one is the result

Put one comparison on a page and it has exactly three parts:

| Part | What it is | On the lab's default preset |
|---|---|---|
| The two pass rates | each system's own total | A **55.3%** (52/94), B **28.7%** (27/94) |
| The difference, with its interval | how far apart, and how sure | **+26.6 pts**, 95% interval **12.8 to 39.4** |
| The flips | which items moved, and which way | **10 fixed, 35 broke**, 49 unchanged |

Configuration for every number in this lesson unless stated otherwise: the lab's judge `c-rubric-3b`, **all
94 items**, **3 repeats** (majority of the three recorded judge samples per item), sampling seed 23. The
variant pair is **A — handbook-tuned prompt** against **B — generic prompt**.

The first two rows are summaries. The third row is the measurement. This is not a rhetorical preference —
it is what the arithmetic says. The difference is literally a function of the flip list:

$$\text{difference} = \frac{\#(\text{broke}) - \#(\text{fixed})}{n}$$

A `broke` item is one the baseline passed and the candidate does not, so it counts towards the baseline;
a `fixed` item counts the other way. On the preset that is $(35 - 10) / 94 = +0.266$, which is the 26.6
points the tile prints, to one decimal place. Two pass rates, one difference, one flip list — and the
difference is the **only** one of the three that cannot be read item by item. When two systems differ by 26
points and you cannot say which 45 items changed, you do not have an A/B result. You have a subtraction.

### The interval is the part that changes decisions

The difference of 26.6 points has a 95% interval of **12.8 to 39.4**. That is a paired bootstrap interval,
resampled 1,000 times from the shipped statistics engine, and it answers one question: *on how large a set of
items like these, how far apart would the two systems typically be?*

Read the two ends separately:

- **Both ends above zero** → the whole plausible range has B worse on this set. That is a result.
- **Both ends below zero** → the whole plausible range has B better. Also a result.
- **An end on each side of zero** → on items like these you cannot tell the two systems apart.

This is the [4.4](../module-04/lesson-04.md) rule wearing the right clothes. The reason it matters *here*,
and not only in the abstract, is that the interval is computed on the **difference**, so it is already as
narrow as the item set allows. You do not have to guess at how many items you would need — the interval tells
you how much room is left.

Two comparisons on the same items, same judge, same 94:

| Pair | A pass | B pass | Difference | 95% interval | Sign-test p | Fixed | Broke |
|---|---|---|---|---|---|---|---|
| A vs B | 55.3% | 28.7% | **+26.6** | **12.8 to 39.4** | 0.000 | 10 | 35 |
| A vs C (small model) | 55.3% | 9.6% | **+45.7** | **34.0 to 56.4** | 0.000 | 2 | 45 |
| B vs C | 28.7% | 9.6% | **+19.2** | **8.5 to 30.9** | 0.001 | 6 | 24 |
| A vs D (A, padded) | 55.3% | 51.1% | **+4.3** | **−2.1 to 10.6** | 0.344 | 3 | 7 |

The last row is the one to slow down on. D is A with a paragraph of generic filler bolted onto every answer —
same facts, more words, and the same judge that rates A at 55.3% rates it at 51.1%. The difference is 4.3
points and the interval runs from −2.1 to 10.6, so it contains zero and the page says so in words:

> The interval crosses zero. On these items you cannot tell the two systems apart. That is a real answer,
> and it is the answer most A/B results of six points on twenty items actually are.

That sentence is worth more than a decision. "We padded the answers and the measured effect is inside the
noise on 94 items" is a finding you can act on. A p-value of 0.344 and a list of three fixed and seven broke
tell you the same thing from two directions.

### The sign test, in one paragraph

The bootstrap interval answers "how big is the effect". The sign test answers a narrower and older question:
**on the items where the two systems disagreed at all, was the disagreement lopsided?**

Ignore every item both systems graded the same way — they carry no information about which is better. Count
what is left. On the default preset that is 45 items: A wins 35, B wins 10. Under the null — *the two
systems are interchangeable, so on the items where they differ, a coin decides* — the probability of a split
at least this lopsided in either direction is

$$p = \min\!\left(1,\ \frac{2}{2^{w+l}}\sum_{i=0}^{\min(w,l)} \binom{w+l}{i}\right) = \frac{2}{2^{45}}\sum_{i=0}^{10}\binom{45}{i} \approx 0.00025$$

Thirty-five against ten on 45 disagreements. That is what the page prints as `0.000`.

For A against D the split is **7 against 3 on 10 disagreements**, and

$$\frac{2}{2^{10}}\sum_{i=0}^{3}\binom{10}{i} = \frac{2\cdot(1+10+45+120)}{1024} = 0.344$$

Ten disagreements. The page prints `0.344` and marks it *not significant*, which is the same verdict the
interval reached from a different direction. Two statistics agreeing is worth more than either one alone,
and neither is a score — [10.2](lesson-02.md) is about what a p-value is actually for.

### Why the broke list deserves more of your attention

Both halves of the list get the same glyph treatment and the same grey row. They should not.

**A fixed item was already broken.** The user who would have had a bad answer from A now has a good one from
B, and they never knew there was a problem. The fix is invisible to everyone it helped, which means nobody
will ever file a ticket about it — and nobody will ever notice if a later change silently un-fixes it. A
fixed item is worth reading once and then forgetting.

**A broken item was working.** Someone had a good answer from A and now has a bad one from B. They will
write it up. If the item is a leave policy and the new answer is wrong about the number of days, that
ticket arrives today, is attributed to this release, and is the first thing support reads when they decide
whether to roll back.

Concretely, on the default preset the 35 broken items are

`s02, s03, s05, s08, s15, s16, s19, s22, s29, s30, s32, s39, s40, s41, s45, s46, s47, s57, s59, s65, s68, s70, s71, s72, s76, s77, s80, s81, s83, s86, s87, s88, s91, s92, s94`

and the ten fixed ones are

`s04, s11, s17, s21, s25, s28, s42, s67, s74, s90`.

Read three of the broken ones before you read any of the fixed ones:

| Item | Question | What B does with it |
|---|---|---|
| s02 | what happens to unused paid time off | declines to answer a policy the handbook covers |
| s16 | how often the laptop is replaced | declines to answer an equipment rule that is written down |
| s76 | what to do when the laptop is lost | declines to answer a security deadline that is written down |

Three of B's six over-refusals are in the broke list. The other three of its refusals are items A also fails,
so they never appear on this list at all — which is the argument [10.4](lesson-04.md) is built on: the flip
list shows you the *differences*, and a slice shows you the *state*.

### The glyphs, precisely

The lab marks each row with one of two glyphs and a word, so the reading never depends on colour:

| Glyph | Word on the row | Means | Count on the preset |
|---|---|---|---|
| ▲ | `Now passes` | the candidate failed this item under A and passes it under B | 10 |
| ▼ | `Used to pass, does not any more` | the candidate passed this item under A and fails it under B | 35 |

Forty-nine of the 94 items carry neither glyph: both systems graded them the same way. They are still in the
denominator — that is what keeps the difference honest — but they have nothing to tell you, which is exactly
what the sign test's "ignore the ties" step is doing.

## Show me

This lesson's preset opens the lab on **A — handbook-tuned prompt** against **B — generic prompt**, the
`c-rubric-3b` judge, **all 94 items**, **3 repeats**, seed 23, paired. The four tiles read:

| Tile | Value |
|---|---|
| A pass rate | **55.3%** |
| B pass rate | **28.7%** |
| Difference | **+26.6 pts**, interval **12.8 to 39.4** |
| Sign test p | **0.000** — *significant* |

The panel heading underneath reads `What flipped — 10 fixed, 35 broke`, and under it, in the lab's own words:

> This list is the result. The number above is a summary of it.

Do this, in order:

1. **Count the denominators yourself before touching the page.** 52 of A's answers pass and 27 of B's, on
   94 items each. 52 − 27 = 25, and 25/94 = 26.6 points. The difference tile is arithmetic on two counts you
   can do in your head, which is how you know it is not doing anything clever.
2. **Read the callout.** `The whole interval is above zero: B is better on this set, not just on one lucky
   draw.` Read the tiles beside it: A is 55.3% and B is 28.7%, so **B is not better here** — it is 26.6
   points worse. The difference tile is computed as A minus B, so a positive number names A, and the sentence
   above it names the other side. Swap the two dropdowns and watch the sign flip: that is the one-minute
   check that tells you which way a signed number on this panel runs.
3. **Switch B to `D — A, padded`.** Difference **+4.3 pts**, interval **−2.1 to 10.6**, sign test **0.344**
   (*not significant*), and the callout changes to the interval-crosses-zero wording. Seven fixed, seven
   broke. Same judge, same 94 items, same page — and now the honest answer is "we cannot tell".
4. **Read the broke list against the fixed list and count.** Ten fixed, thirty-five broke, and the panel
   shows the first fourteen rows followed by `…and 31 more (use Export to see all)`. The truncation is
   visible, which is the only reason it is acceptable; a list that silently shows fourteen of forty-five is
   the same failure as a dashboard that shows a rate with no `n`.
5. **Move the `Items` knob from 94 to 40 and watch nothing move.** The tiles stay at 55.3% and 28.7% and the
   difference stays at +26.6, because this panel's item set is fixed at all 94 and the knob only
   highlights a row in the gate grid. If you sized a comparison with that knob you would be reporting a
   number computed over the full set under a label that says forty.
6. **Open the items the flip list cannot show you.** Pick two of B's over-refusals that are *not* on the
   list — s37, s43 and s73 are three. A fails those items too, so nothing moved and nothing is listed.
   Your A/B is reporting a system whose behaviour is not fully described by anything on the panel.

> [!NOTE]
> Every number on this panel comes from a seeded educational model of judge behaviour, not from a live
> LLM. The 94 support questions, the four answer variants and the human labels are generated for
> teaching, and the variant names are labels recorded runs are filed under. The bootstrap, the interval
> and the sign test are computed for real in your browser from those recorded verdicts. The counts are a
> property of this corpus — no number here is a measurement of a named support bot in the wild.

## Try it

**Predict first**, on paper:

1. A candidate scores 55.3% and its baseline scores 28.7% on the same 94 items. Give the difference, then say
   whether you could name the items that changed. What extra information does the second answer need?
2. The difference on A against D is +4.3 points and the interval runs −2.1 to 10.6. Write the sentence you
   would put in the release note, and say how many items it rests on.
3. A system fixes 3 items and breaks 7, and the sign test prints 0.344. Two people argue: "the system is
   better" and "there is no evidence". Who is right, and what is the difference between their claims?

[Simulation: ab-gates](../../simulations/ab-gates/index.html?preset=ab)

1. **Write the flip list on paper before you open the page.** Predict the direction of each of the 45 items
   where A and B disagree, using nothing but the questions. Then open the panel and score yourself. The
   point is not to be right — it is to find out whether you are guessing, which is what an unexplained
   headline number really is.
2. **Do the arithmetic the panel does not show.** Read the fixed and broke counts off the panel, divide
   their difference by 94, and check you get the difference tile. Then compute the same thing from the two
   pass rates. If both agree, the difference really is a summary of the flips and nothing else.
3. **Find the smallest change the page will call a result.** Set A against D, then B against C. Record the
   difference, both ends of the interval, the sign-test p, and the fixed and broke counts for each. One of
   them clears zero and one does not — write down what the non-clearing one is allowed to claim.
4. **Move the `Repeats` knob from 3 to 1 and back to 5, keeping the pair at A against B.** Record the two
   pass rates, the difference and the interval at each setting. Then say which of those numbers changed
   because the system changed and which changed because the judge's verdict did.
5. **Break the tie-count.** Set A against B, set `Repeats` to 1, and count the items where the two systems
   disagree. Work out by hand what the sign test would be for a 20-versus-10 split and compare it with the
   tile. Then ask what you would have to change to get the same conclusion from a smaller item set.

## Break it

**Publish the two pass rates and let the reader subtract.** `55.3% vs 28.7%` on a slide invites the reader to
compute 26.6 and believe it. On the preset that difference summarises 45 moved items and says nothing about
which 45, so the slide supports a decision that the run does not support. The lie: **a difference without
its flip list is a number with the actionable part deleted.**

**Read a signed difference without its orientation.** The Difference tile is A minus B; the callout above it
names B for a positive interval, which on the default preset is the wrong system. Nothing on the page tells
you which convention a signed number follows, and a sign error here does not produce an obviously broken
page — it produces a launch. The lie: **a sign is a claim about direction, and the page does not label
which system it points at.**

**Trust the fixed list and skim the broke list.** The fixed rows are the good news, so they get read. But
every broken item was a working answer a user had yesterday, and the broken list on this preset is three
times the size of the fixed one. The lie: **a fix is invisible to the user it helped, which is exactly why a
regression is the only half of the list that generates a ticket.**

**Trust the list is the whole picture.** Thirty-five items broke and ten were fixed, and that reads like a
complete account of what B did to the product. It is not: three of B's six over-refusals — s37, s43 and
s73 — are items A also fails, so no verdict moved and none of them appears. The lie: **a list of differences
is not a census of failures, and the items it is blind to are the ones the system was already bad at.**

**Size the comparison with the `Items` knob.** The knob is right there, it moves, and it says `Items`. This
panel's item set is fixed at all 94 whatever you set it to, so every number above is a 94-item number and a
runbook that says "40 items" is describing something that was not computed. The lie: **a control that does
not change the quantity is worse than no control, because it looks like the thing you configured.**

**Round the difference and drop the interval.** `+27 points` is what gets said in the standup. The interval
on that comparison runs 12.8 to 39.4 — a range a factor of three wide — and the number that decides anything
is the low end, not the middle. The lie: **a point estimate with the interval removed is a claim about the
centre of a range somebody has not read.**

## Fix it

1. **Publish the triple, every time.** Pass rate A, pass rate B, difference with its interval, and the
   sign-test p, all on 94 items with the judge named. On this run: `A 55.3% (52/94), B 28.7% (27/94),
   difference +26.6 pts (95% 12.8 to 39.4), sign test p 0.000, judge c-rubric-3b, 3 repeats`. Every number
   is checkable and every number has a denominator.
2. **Ship the flip list as the artefact and the difference as its caption.** The list is what a person reads
   at 9am; the number is what goes in the changelog. Make sure the list says *fixed* and *broke* separately
   and shows how many it truncated — `…and 31 more` on this preset.
3. **Read the broke list first, in the order users would feel it.** Sort it by blast radius, not by item id.
   A wrong leave-policy answer and a wrong laptop-replacement answer are not the same severity, and the list
   gives you the item ids to decide with.
4. **State the null next to the p-value.** `Sign test p = 0.000 under "the two systems are interchangeable
   on the items where they differ"; 35 against 10 on 45 disagreements.` A p-value with no stated null is a
   number with no meaning, and [10.2](lesson-02.md) is the lesson that makes that concrete.
5. **Write the non-result down as carefully as the result.** `+4.3 pts, interval −2.1 to 10.6, p 0.344: we
   cannot distinguish A from A-padded on these 94 items.` A recorded non-result is a decision you can defend
   six months later; a rounded +4 is an argument you have to have again every quarter.

## How do I know it works?

**Challenge, on dev.** This panel always runs on all 94 items, so the dev split it gives you is the
dataset's own published one: **`dev_ids`, 57 items**, which is where any tuning of this eval would have
happened. Take A against B on those 57 and require all four of these:

- **The interval is on the page and it has been read.** A against B on the 57-item dev split reads a
  difference of **+19.3 pts**, interval **3.5 to 35.1**, sign test **p 0.043** — 18 fixed, 7 broke. That is
  19.3 points with a lower end of 3.5, against 26.6 with a lower end of 12.8 on all 94. Same systems, same
  judge, same question; half the denominator and less than half the margin.
- **The flip list is published split into fixed and broke**, with both counts and the truncation count if
  any. `10 fixed, 35 broke, 49 unchanged, 31 not shown` on the preset.
- **The sign test is stated with its null and its raw split**, not as a bare `p = 0.000`.
- **The difference reconciles with the list.** $(35 - 10)/94 = +26.6$ equals the tile to one decimal place.
  If it does not, one of the two is being computed over a different item set and you have found a bug before
  you shipped on it.

**Then one held-out validation**, on `test_ids` — the remaining **37 items** — read once, A against B:

| | Dev, 57 items | Held-out, 37 items |
|---|---|---|
| A pass rate | 56.1% (32/57) | 54.1% (20/37) |
| B pass rate | 36.8% (21/57) | 16.2% (6/37) |
| Difference | **+19.3 pts** | **+37.8 pts** |
| 95% interval | 3.5 to 35.1 | 16.2 to 59.5 |
| Sign test p | 0.043 | 0.003 |
| Flips | 7 fixed, 18 broke | 3 fixed, 17 broke |

The held-out half shows a *larger* effect than dev — +37.8 against +19.3 — and both ends of its interval
clear zero, so the direction survived contact with items nobody tuned on. That is the good outcome. Write
down the second number as carefully as the first: the reason the held-out gap is wider is that the two
halves are not the same difficulty. Human pass rates over the same split are **52.6% vs 35.1%** on dev and
**45.9% vs 16.2%** on test, so B is a lot worse on the held-out half than on the dev half, and the pairing
is what keeps that from being a different system. It is [4.3](../module-04/lesson-03.md) arithmetic
wearing an A/B costume.

Now run **A against D** on the same two halves and the picture inverts into the lesson's other half. On dev
the difference is **+1.8 pts**, interval **−7.0 to 10.5**, sign test **p 1.000**. On the held-out half it is
**+8.1 pts**, interval **0.0 to 16.2**, sign test **p 0.250**, and every single flip went the same way — 3
fixed, 0 broke. A panel that reports "no difference" on dev and a positive number on test is not a bug. It
is three disagreements, which is not enough to say anything, and the interval's low end sitting at exactly
zero is the page telling you so in the only way a bootstrap can.

## Use / don't use

**Do run the paired comparison.** Both systems answer the same items, the pairing is free because you already
have the runs, and it removes item difficulty from the variance. [10.2](lesson-02.md) shows what you lose
when you throw it away.

**Do keep the item set frozen between A and B.** If the baseline was measured in March and the candidate in
June, you have an unpaired comparison and you should read it as one — including the noise it adds. Freezing
the set costs one release cycle and buys the whole difference.

**Do export the flip list into the run record.** The Export button writes `{a, b, judge, n}`. The list itself
is the part that will still be useful in six months, because it is the only thing on the page that names
items.

**Don't compare systems across judges.** A against B on `c-rubric-3b` and A against B on `c-plain-1.7b` are
two different experiments with two different denominators in effect. This lab runs one judge,
`c-rubric-3b`, on every recorded verdict; changing judge changes which items are in the flip list, and the
flip list is the result.

**Don't gate on the difference alone.** A +26.6 with an interval that clears zero is a release decision.
A +4.3 with an interval that does not is not, whatever the p-value's fourth decimal says. That is
[10.3](lesson-03.md).

What teams actually do: run the paired comparison on every candidate against a frozen baseline, attach the
three broken items with the highest blast radius to the release ticket, and record the non-results too —
because six months later the question "did we try that?" is answered by the log, not by the memory of
whoever was on the team.

## Reflect

1. The Difference tile reads `+26.6 pts` and the callout above it says B is better. Write the two sentences
   you would send to the team that ran the comparison, and say which one you would put in the release note.
2. A candidate fixes 3 items and breaks 7, sign test p 0.344. Write the sentence that stops the release
   without implying the candidate is worse — and say what you would collect to change the answer.
3. Thirty-five items broke and ten were fixed, and three of the candidate's six over-refusals are not on the
   list. Name the number that would show those three, and say who has to own it.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- Bradley Efron and Robert J. Tibshirani, [An Introduction to the
  Bootstrap](https://projecteuclid.org/journals/annals-of-statistics/volume-21/issue-3/Bootstrap-Methods-Another-Look-at-the-Bootstrap/10.1214/aos/1176344552.full)
  (1993) — why a resampled interval on a *difference* is the right way to say how sure you are, and why the
  paired resample is the one you want when both systems saw the same items.
- [KDD 2015](https://www.kdd.org/kdd2015/) model lifecycle tutorial — the production framing this module
  assumes: an eval set is frozen, a candidate is compared against a baseline on it, and the decision is made
  on that comparison rather than on the candidate's absolute score.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the habit underneath the fifth fix on
  this page: when the measurement cannot separate the two systems, writing that down is a result.