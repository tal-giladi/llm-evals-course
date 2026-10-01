---
id: "04.2"
module: 4
minutes: 14
practice_minutes: 30
prerequisites: ["04.1"]
objectives:
  - Split an item set into dev and test before tuning, and say which of the two you are allowed to optimise against.
  - Judge a candidate split by whether it is balanced on the attributes that matter and different on the ones you do not control.
  - Explain, with the width of the interval, why repeatedly choosing between two prompts on the test number measures the search and not the system.
volatility: concept
sources:
  - title: "Kohavi — A Study of Cross-Validation and Bootstrap for Accuracy Estimation and Model Selection"
    url: http://www.jmlr.org/papers/volume2/kohavi01a/kohavi01a.pdf
  - title: "Hamel Husain — Your AI Product Needs Evals"
    url: https://hamel.dev/blog/posts/evals/
  - title: "Hamel Husain — Evals FAQ"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 04.2 · Dev, test, and the one-validation rule

Two sets, cut before you start, and one rule about which of them you are allowed to learn from. The
rule is the entire lesson: you tune on dev, you read test once, and every prompt edit you make after
reading test converts the test number from a measurement into a scoreboard for your own search.

## Why it matters

A support team has a judge that is too generous. They want it stricter. The obvious thing to do is to
tune the judge prompt against the eval set and watch the number fall to where it should be.

They do six rounds of it. Round one: the judge prompt gains a rule about citing the handbook, and the
test pass rate moves from 66.7% to 64.1%. Round two gains a rule about refusing out-of-scope questions,
and the number moves to 61.8%. Round three tightens the wording of the refusal rule. By round six the
test set reads **58.2%** with a confident write-up attached, the judge ships, and the team believes
they have a stricter judge.

They have a judge that agrees with the test set. Nobody ever measured whether it agrees with reality.
The system underneath it did not change once in six rounds — the prompt being tuned was the judge's,
not the product's — and the only thing that moved reliably upward was the number they were selecting
on. The damage is not the 8.5 points of over-strictness; it is that **the team has no longer got a
test set**. They have a set they tuned against, and a number that will now report whatever they most
recently wanted to hear. The next person who changes the judge inherits a scoreboard with no floor
under it, and cannot tell a real improvement from a lucky one.

The mistake is not dishonest and it is not unusual. Six rounds of "try it, look at the number, keep it
if it went up" is what improving a check looks like from the inside. The failure is that the set being
optimised against is the only set that could have told them they were wrong.

## How it works

**Dev** is the set you tune against. You are allowed to look at it as often as you like, change the
prompt until it does what you want, and report its number while you work. Every adjustment you make
raises the dev number by construction, which is fine, because the dev number was never going to be
your evidence — it is your workbench.

**Test** is the set you do not tune against. You run the check on it once, at the end, on items it has
never been edited to fit, and you report that number whatever it says.

The split itself is one decision made *before* any tuning: take the items from [4.1](lesson-01.md), put
about two thirds in dev and the rest in test, write both id lists down, and do not touch them again
for this cycle.

### What a legitimate split looks like here

The lab's split is **57 dev / 37 test**, and the table underneath its callout is the thing to read.
Balanced by difficulty, across every difficulty band:

| Difficulty | In the population | In dev (57) | In test (37) |
|---|---|---|---|
| easy | 18 | 11 (61%) | 7 (39%) |
| medium | 46 | 28 (61%) | 18 (39%) |
| hard | 30 | 18 (60%) | 12 (40%) |

The two halves carry the same shape of work to within about a point, which is what you want: if test
were all the hard items and dev all the easy ones, a drop on test would be a statement about the split
rather than about the system.

Balanced is not identical, and the difference is the point. The two halves are **different draws from
one population**, the way a fresh week of traffic is a different draw from last week. And the split is
*not* balanced on everything — it is not balanced on intent at all. The `exception` slice, three items
in the whole population, sits entirely in dev, and test gets two of the seven `out of_scope` items and
none of the three `exception` ones. A split that matched on every attribute would have to be the same
set twice.

### Why an identical split tells you nothing

Suppose you split by cloning: test is a copy of dev. Then dev reads **52.6% (39.9%–65.0%)** on 57
items and test reads **52.6% (39.9%–65.0%)** on the same 57, and the two intervals are the same
interval. You have not validated anything, because you have measured the same 57 answers twice. The
number on test is a number about the items you tuned on, which is the definition of not having a test
set, achieved without ever doing anything wrong.

This course's own split shows what you lose by making that mistake. Dev's **first 37 items** on their
own read **51.4% (35.9%–66.6%)**. The real test 37, drawn separately from the same population, read
**45.9% (31.0%–61.6%)**. That is a 5.4-point gap between two halves of the same dev set, and both
intervals cover both figures. So even a split that is "balanced" produces a number that moves by
several points on nothing but which items landed in which half — which is why the interval exists, and
why the split has to be drawn once and left alone.

The two figures the split panel prints are:

| | Items | Pass rate | Wilson 95% CI |
|---|---|---|---|
| **Dev** | 57 | 52.6% | 39.9%–65.0% |
| **Test** | 37 | 45.9% | 31.0%–61.6% |

A 6.7-point gap between them, on intervals that are 25 and 31 points wide and that overlap across a
21.7-point stretch from 39.9% to 61.6%. **The gap is inside the noise on both halves.** On this split,
you cannot tell whether dev and test are the same system — and that is a useful thing to be unable to
tell, because a split where the two halves differ by more than the interval is a split where something
went wrong before you started measuring.

### Why tuning on test destroys the test set

Watch what a *choice* does to a number. Suppose the two candidate judge prompts are equally good. You
run both on the 37 test items, they read 47.9% and 53.8%, and you keep the second one because it read
higher. What you have recorded is not "the system reads 53.8%"; it is "of two equally good options,
one of them read 6 points higher on 37 items", and you kept the one that got lucky.

The size of that effect is set by the width of the interval, because the width is how far apart two
draws of the same population routinely land. At n = 20, the seed knob on this lab — nothing changed
but which 20 items you drew — produces **25.0%** on one seed and **75.0%** on another. A 50-point
swing on an identical system. At n = 37 the test interval is **31 points** wide. So two prompts that
are genuinely identical will differ by double figures on the test set often enough that "keep the
higher one" is, most rounds, a coin with a bias.

Do that six times and the reported test number is the maximum of a chain of noisy draws, not an
estimate of anything. The number climbs. The judge does not get stricter. And now consider what the
number is *for*: it was the only evidence anyone had, and it has been spent.

Two things are worth being precise about, because teams get both wrong:

- **Reading test once is fine. Changing anything after reading test is not.** Reading the number and
  shipping anyway is the honest outcome, even when the number is disappointing. The test set is
  destroyed by the *decision*, not by the observation.
- **The leak does not have to be deliberate.** "Let me just try one more wording on test to be sure"
  is the single most common way a test set dies, and it sounds like caution rather than tuning.

## Show me

The split preset opens at 40 items, random, seed 11. The **Your sample** panel reads **Pass rate 52.5%
(37.5%–67.1%)**, **Items drawn 40**, **Interval width 30 pts**.

Now compare that to the two rows further down the page, which the sample controls do not touch:

| | Items | Pass rate | Wilson 95% CI |
|---|---|---|---|
| Your 40-item draw | 40 | 52.5% | 37.5%–67.1% |
| **Dev** | 57 | 52.6% | 39.9%–65.0% |
| **Test** | 37 | 45.9% | 31.0%–61.6% |

Your draw reads 52.5% and dev reads 52.6%. They agree to a tenth of a point, and neither of them is
the number you are allowed to publish, because the third row is 6.6 points lower and has never been
tuned against. Three tiles, three intervals, and only one of them is evidence.

Then turn every knob on the page — size, strategy, seed — and watch the split panel. It does not
move, because the split was cut from the item list before any of those knobs existed. That fixedness
is the feature. A split you can re-roll after seeing a result is not a held-out set; it is a fresh
draw you have not looked at yet, and the moment you look at it, it is dev.

## Try it

**Predict first**, on paper, before opening anything:

1. Dev reads 52.6% and test reads 45.9%. Is that 6.7-point gap evidence that something differs
   between the halves? Say yes or no and write the number that decides it.
2. You have two judge prompts and a test set of 37 items. How large a difference between them does
   this population produce by accident, and how often would "keep the higher one" be the wrong call?
3. If the test run comes back worse than dev, write down what you are allowed to do next. One item.

[Simulation: eval-set](../../simulations/eval-set/index.html?preset=split)

1. **Compare the three rows before touching anything.** Record the three pass rates and the three
   intervals. Then compute the gap between dev and test and compare it to the width of each interval.
   Write the sentence you would use in a review: is the gap evidence, or is it inside the noise?
2. **Read the difficulty balance yourself.** The item list at the bottom prints `intent · difficulty ·
   category` on every line. Count the difficulty labels on the first twelve drawn items, then set
   **All of them** and count them across all 94. Compute the three difficulty shares on both sides and
   check whether the split really is balanced by difficulty.
3. **Find what the split is *not* balanced on.** Set **All of them** and read the **intent** field of
   every line. One of the five intents exists entirely inside dev. Name it, count it, and write down
   what it means that your held-out set contains zero items from a slice your product has three of.
4. **Watch the interval do the arguing.** Set the seed to 11 and note the pass rate, then turn it to 3
   and then to 10, holding the size at 20. Write all three numbers and all three intervals down.
   Nothing about the system changed between them. Now do the same at size 94 — the strategy button is
   irrelevant there, because there is only one draw left to make. Say out loud which of those numbers
   you could have shipped on.
5. **Practise the one-validation rule.** Write down a sentence you would put in a pull request after a
   test run that came back 6.6 points below dev. It has to contain the number, the interval, and it may
   not contain the word "but". Then write the follow-up you would file instead of re-running the tune.

## Break it

The knob here is not a slider. It is **which of the three rows you quote**.

Quote the 40-item draw. It reads 52.5% (37.5%–67.1%), it is larger than either half, and it is
comfortably inside the dev figure — so it looks like the more reliable number, because forty items is
more than thirty-seven. It is 6.6 points above the only figure that was ever going to mean anything,
and nobody can tell from the tile.

Then take the other break, the one this lesson is actually about. Take the split you would have got
for free: dev's own first 37 items, **51.4% (35.9%–66.6%)**, standing in for test. Both halves now
agree exactly, every tuning round reads as an improvement, and the agreement is the evidence that the
split has stopped working. **A test set that confirms your tuning is not a test set that passed.** The
thing you want from the second number is for it to be able to be worse than the first.

## Fix it

Four changes, and none of them requires a single extra labelled item:

1. **Split once, before anything is tuned, and write both id lists into version control.** The lists,
   not just the sizes. A split you cannot reconstruct is a split you will accidentally change.
2. **Report the dev number only while you work, and only with its interval.** It is a workbench, and a
   workbench that reads 91% every afternoon tells you nothing about whether you are improving anything.
3. **One validation run on test, at the end, reported whatever it says.** If the test number is worse,
   the correct response is to write it down and open a new row in the taxonomy from [2.3](../module-02/lesson-03.md).
   Going back to edit the prompt because of what test said converts test into dev, permanently, for
   this cycle.
4. **Re-split for a new cycle, with new items, and say so.** When you have genuinely changed the
   product, draw a fresh test set rather than re-rolling the old one. The replacement set has to be
   items the current dev work has never touched, which means it comes from new traffic or new
   hand-written cases — not from the leftovers of the split you just used.

The cost of all four is zero dollars and about twenty minutes. The cost of skipping them is that your
only evidence is gone, and it is gone in a way nobody can detect, because a destroyed test set looks
exactly like a passing one.

## How do I know it works?

**Challenge, on dev.** Before you look at the test half, write the sentence you will publish after
the validation run. It has to name the number, the interval, and the item count — something like
"52.6% on 57 dev items (39.9%–65.0%); test run once on 37 held-out items". Then set three targets on
the dev half alone:

- **Your dev workbench is not your dashboard.** Every dev figure you report during tuning carries its
  interval. A dev number without one is the failure from [1.1](../module-01/lesson-01.md) wearing a
  different hat.
- **No tuning decision cites test.** Not once, not "just to confirm", not "only for this wording". The
  id list in version control is the thing that makes this auditable rather than a promise.
- **Both halves are drawn, not chosen.** If you find yourself able to say which items are in which
  half, that is a warning, not a convenience — the point of the list is that the cut happened before
  you had opinions.

**Validation, once.** Run the check on the 37 test items and report the number. Then do the harder
half: predict the test number on paper *before* you run it, using the dev interval as your range. A
prediction that lands inside the test interval tells you the dev number was honest. A prediction that
lands far above it tells you the same thing about your tuning — and, unlike the number, you can act on
that before you ship.

## Use / don't use

**Do use dev/test for anything where a decision follows the number.** A prompt or judge change, a
retrieval configuration, a model swap. The split costs you nothing at run time and it is the only
thing standing between "we tried six things and kept the best" and "we measured one thing once".

**Do keep dev large relative to test.** Two thirds to three quarters is the usual shape, and the
reason is not statistical purity: dev is where you iterate, and a dev set too small to resolve the
changes you are making will make you stop at six rounds of guessing. This course's split is 57/37,
which is close to the low end — and its test half is 31 points wide, which is why the validation run
here can only rule out large regressions.

**Don't use test as a second dev set.** The moment it is one, the number on it is a function of how
many things you tried, not of the system. If you need ten variants compared, compare them on dev and
run one of them on test.

**Don't treat a small, quiet product as exempt.** "We only have about sixty real examples" is the
situation where a held-out set matters most and is cheapest: with few items, every one of them is a
large share of what you know, and the interval on a five-item test set is useless.

What teams actually do in production: freeze a dev set and a test set in version control next to the
prompts they tune; run dev on every pull request and test nightly or at release; when the release
candidates have narrowed to one, run test once and post the number in the channel with the interval
next to it. Teams that have to re-split often are usually teams whose eval set grew a row per incident
and never split again; a deliberate re-split every few months, from fresh traffic, is cheaper than
discovering the old one stopped working.

## Reflect

1. Your test run came back 6.6 points below dev. Write the message you send the channel, then write
   what you do on Monday. Which of the two is harder to do honestly?
2. Someone proposes splitting by cloning — "test is just dev, it is faster to set up". Find the
   number in the lab that shows what that costs you, and explain it in one sentence to somebody who
   thinks the split is only there to halve the run time.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Ron Kohavi, [A Study of Cross-Validation and Bootstrap for Accuracy Estimation and Model
  Selection](http://www.jmlr.org/papers/volume2/kohavi01a/kohavi01a.pdf) (1995) — why the held-out
  estimate has to come from a sample the selection never saw.
- Hamel Husain, [Your AI Product Needs Evals](https://hamel.dev/blog/posts/evals/) (2024) — iterating
  on the system requires iterating on the measurement, and the split is where the measurement stops
  following you.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the habit this lesson installs:
  keep the tuning set and the reporting set different, and report the second one honestly.
