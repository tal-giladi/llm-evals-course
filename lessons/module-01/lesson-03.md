---
id: "01.3"
module: 1
minutes: 15
practice_minutes: 35
prerequisites: ["01.1", "01.2"]
objectives:
  - Run the analyse, measure, improve loop with one change at a time and read the resulting diff.
  - Show, with numbers you can reproduce, that a change smaller than the run-to-run spread is not evidence.
  - Explain why three simultaneous edits produce a number nobody can act on, and what to do instead when you must ship three.
volatility: concept
sources:
  - title: "Practical Guide to Controlled Experiments on the Web: Listen to Your Customers not to the HiPPO (Kohavi, Henne & Sommerfield, 2007)"
    url: https://exp-platform.com/practical-guide/
  - title: "Statistical Challenges in Online Controlled Experiments: A Review of A/B Testing Methodology (Larsen et al., 2023)"
    url: https://doi.org/10.1080/00031305.2023.2257237
  - title: "Your AI Product Needs Evals (Ham Husain, 2024)"
    url: https://hamel.dev/blog/posts/evals/
last_verified: "2026-10-01"
---

# 01.3 · The loop: analyse, measure, improve

Every improvement a team can act on came from one change, one measurement and one honest comparison. This
lesson runs that loop on a page you can turn knobs on, and shows what a number becomes when three things
change at once.

## Why it matters

A developer opens a pull request with three edits: the system prompt is rewritten, retrieval is switched
on, and the model moves from a 0.6B to a 3B. The eval runs before and after. The pass rate goes from 62%
to 71%. The PR is merged on the strength of that.

Now imagine the next PR. Someone changes one thing — the prompt, nothing else — and the pass rate goes back
to 64%. Two engineers spend two days arguing about whether the first change was ever real. They cannot
settle it, and the reason is on line 4 of the first PR: three knobs moved, so the 9 points belonged to
some unknown mixture of all three. When one of them moves back, the mixture changes.

This is not a discipline problem, it is an arithmetic one. If a change is worth $x$, a change worth $y$
and a change worth $z$, and you run all three together, you measure $x + y + z$ and nothing else. The
number is real. It is also useless, because the only decisions available to you are "keep this, that, or
all of it", and you cannot price any of them. Worse, the three effects are not even additive: a stricter
judge changes how a better system is *counted*, so the mixture is not a sum of three constants. It depends
on the configuration you happened to choose.

The loop below is the fix, and its discipline is one sentence: **one change, one number, one decision.**

## How it works

### The loop

**Analyse** — before you touch anything, know what is broken. Not "quality is bad" but: 15 of 27 failures
on the dev set are answers with the right fact and no citation. This step has no number in it, and it is
the step teams skip. Module 2 is entirely about doing it properly, because an eval suite built without it
measures the wrong thing accurately.

**Measure** — pick the check that can decide the failure you named. If the failure is "the wrong number
came back", assert on the number; no model needed. If the failure is "the answer has no citation", a
program can decide that too. If the failure is "this contradicts the handbook", you need a judge, and
module 6 is about proving the judge is worth trusting before you trust it. The measurement step is where
most teams stop, which is why their suites measure something adjacent to what they are fixing.

**Improve** — change the thing that causes the named failure. One thing. Then measure again, against the
pinned baseline, and read the diff.

The loop is not linear, and the return path is the whole point: the items that flipped tell you what to
analyse next. A change that moves the pass rate but flips the *same* six items every time has not fixed
anything; it has found a sixth thing to be wrong with.

### Why one change at a time, concretely

The reason is the noise floor, and you can measure it. Here is one system, one judge, one set of answers,
run ten times with ten different random draws of 40 dev items. Nothing changed between the runs:

| Seed | 1 | 2 | 3 | 4 | 5 | 7 | 11 | 42 | 101 | 500 |
| ---- | - | - | - | - | - | - | -- | -- | --- | --- |
| Pass rate | 65.0% | 67.5% | 62.5% | 62.5% | 70.0% | 67.5% | 70.0% | 62.5% | 75.0% | 65.0% |

Same system, same judge, same everything. The spread is **62.5% to 75.0% — 12.5 points of pure luck.** A
team that ships a "9-point improvement" and cannot reproduce it at a different seed did not measure an
improvement; they measured which items they happened to draw.

The same lesson with a different knob — sample size. Same system, same judge, same seed:

| Items | 10 | 15 | 20 | 30 | 40 | 50 | 57 |
| ----- | -- | -- | -- | -- | -- | -- | -- |
| Pass rate | 60.0% | 66.7% | 75.0% | 70.0% | 67.5% | 70.0% | 66.7% |
| Interval | 31.3%–83.2% | 41.7%–84.8% | 53.1%–88.8% | 52.1%–83.3% | 52.0%–79.9% | 56.2%–80.9% | 53.7%–77.5% |

Look along the top row: the point estimate wanders over 15 points with no change in the system at all. Look
along the bottom row: the interval collapses from 52 points wide to 24. The point estimate wandering is
noise; the interval shrinking is the only thing that actually buys you the ability to act.

So: a point estimate is a rumour, an interval is a claim, and a diff between two pinned runs on the same
items is the only number that can support a decision.

## Show me

The page this lesson links to opens on the same run as the previous lesson: a vague judge scoring the tuned
system's answers on 40 randomly drawn dev items. Judge pass rate **67.5%** (27 of 40, interval
52.0%–79.9%), kappa **0.43**, TPR **86.4%**, TNR **55.6%**, and **22 of those same 40 items** passed on the
humans' labels. Press **Pin as A** before you touch anything, and the scoreboard keeps this run for
comparison.

Now change one knob at a time, from that baseline, and record each:

| Change | Pass rate | Kappa | TPR | TNR | Humans on the same items |
| ------ | --------- | ----- | --- | --- | ----------------------- |
| *baseline (pinned as A)* | 67.5% | 0.43 | 86.4% | 55.6% | 22/40 = 55.0% |
| Judge → rubric | 65.0% | 0.79 | 95.8% | 81.3% | 24/40 = 60.0% |
| Answer → B (generic prompt) | 67.5% | 0.38 | 100.0% | 48.1% | 13/40 = 32.5% |
| Sample → 20 items | 75.0% | 0.38 | 85.7% | 50.0% | 14/20 = 35.0% |
| Seed → 101 | 75.0% | 0.47 | 95.5% | 50.0% | 22/40 = 55.0% |

One caution before you read the table, because it will save you an argument later: the page mixes the judge
into the sampling seed, so at the same numeric seed the two judges are scored on **different draws of 40
items**. Every row except the judge row is on the same items as the baseline. When you want to compare two
*judges*, set *How to choose them* to **All of them** and compare on the same 57 dev items — that is the
comparison at the end of this section.

Three things to read out of that table.

**The seed row is the noise floor.** Changing nothing but the seed moved the pass rate 7.5 points, and
across the ten seeds in the table above the range is 12.5. Any change worth less than that cannot be
demonstrated on 40 items, no matter how real it is.

**The answer row is the one that should alarm you.** Swapping in a system that the humans rate at 32.5%
instead of 55.0% — a 22.5-point drop in real quality — moves the pass rate by **exactly nothing**. The
judge flipped 7 items to pass and 7 items to fail and landed on the same 27 of 40. A suite that reports only
the pass rate would have called that a no-op.

**The judge row is the real finding**: a better check moves kappa from 0.43 to 0.79 and TNR from 55.6% to
81.3% while the pass rate barely moves. The check got much better and the headline number did not notice,
which is exactly why the loop needs more than one number.

## Try it

**Predict first.** In writing, before you open the page:

1. You will change only the sampling seed, five times. Over five runs, what is the largest pass-rate gap you
   expect, and does a 5-point "improvement" survive it?
2. You will swap the answer from A to B and change nothing else. Will the pass rate move by more than 5
   points? Will the kappa?
3. You will pin the baseline, then change the sample size from 40 to 10. Which of the five numbers gets
   worse — and which one gets *worse in a way that is not about the system*?

[Simulation: judge-lab](../../simulations/judge-lab/index.html?preset=tnr)

1. **Establish the noise floor first.** Pin as A. Now change only the *Sampling seed* — 1, 2, 3, 4, 5 —
   and write down the five pass rates. You should land between 62.5% and 70.0%. That range is now the
   number every later experiment has to beat, and it took five clicks to obtain.
2. **Do one real comparison.** Clear A, re-pin the baseline, then change only *Answer being judged* to
   **B — generic prompt**. Read the scoreboard diff. The pass rate does not move; the kappa falls from
   0.43 to 0.38 and the TPR rises to 100.0% while the TNR falls to 48.1%. A judge that now passes
   everything humans passed and still waves through half the failures is a check that has stopped
   discriminating, and the diff told you before you shipped.
3. **Watch the interval, not the point estimate.** Move *How many items* from 40 down to 10, then up to 57.
   Record the width of the pass-rate interval at each stop. Then set *How to choose them* to **All of
   them**: the point estimate barely changes, the interval collapses, and the sample stops being a source
   of surprise. This is the cheapest improvement available to anyone and almost nobody makes it.
4. **Find out whether your change moved anything at all.** With the rubric judge selected, pin the tuned
   system's run as A, then switch only the answer to B and read the diff. On that judge's default draw of
   40 items you should see the judge newly pass 5 items and newly fail 19 — 24 items flipping — where the
   vague judge flipped 7 each way and netted zero. Now set *How to choose them* to **All of them** and read
   both judges on the identical 57 dev items: the vague judge sees 66.7% against 64.9% and the rubric judge
   sees 59.6% against 33.3%. Same two systems, two completely different verdicts about whether anything
   happened. Both are true. Only one of them is useful, and the difference is 1.8 points versus 26.3.

## Break it

Change three knobs before you look at the page: set the Judge to the rubric, set the answer to B, and drop
the sample to 20 items. The scoreboard now reads **25.0%** (5 of 20, interval 11.2%–46.9%) against a
pinned baseline of 67.5%.

That is a 42.5-point collapse. If you believed it, you would revert the whole branch, including the one
change in it that was an improvement. And the single-knob runs say the collapse is nowhere to be found. On
the same 57 dev items, the judge change alone reads **59.6%** and the answer change alone reads **64.9%**,
against a 66.7% baseline. Not one of them is anywhere near 25.0%, because the score is not a sum of the
three — you changed which questions were asked, by whom, and of what, and those three choices interact.

The lie has a name: **a scoreboard is a snapshot, not a diff.** Two numbers from two different
configurations are two different experiments, and subtracting them produces a number that belongs to
neither. The only comparison the page can make honestly is the one between two runs that differ in exactly
one setting.

There is a quieter version of the same break, and teams hit it more often: change one knob, but change
the *sample* too, because you were in there anyway. The pass rate moves 7.5 points and you cannot tell
whether the knob or the sample did it. This is why the seed is a first-class control in this lab rather
than a footnote.

## Fix it

The repair is procedural, and it shows up as a diff on the scoreboard rather than as a paragraph:

1. **Pin the baseline as A** before the first change. Unpinned, the page has no memory and every number
   is a rumour.
2. **Change exactly one control**, then read the diff: pass rate, kappa, TPR, TNR, and the cost panel.
3. **Compare against the noise floor you measured**, not against zero. A 3-point gain on 40 items is not a
   gain; it is seed 3 talking.
4. **If the diff is empty, say so, and do not ship on it.** An empty diff on a known-real change means
   your check cannot see that change. That is a finding about the check, and it is more valuable than a
   noisy pass rate.

The same swap that the vague judge scored as a no-op, on the identical 57 dev items, with *How many
items* set to 57 and *How to choose them* set to **All of them**:

| All 57 dev items | Vague judge | Rubric judge | Humans |
| ---------------- | ----------- | ------------ | ------ |
| A, tuned — pass rate | 66.7% | 59.6% | 52.6% (30 of 57) |
| B, generic — pass rate | 64.9% | **33.3%** | 35.1% (20 of 57) |
| Gap the judge sees between the systems | **1.8 points** | **26.3 points** | 17.5 points |
| Kappa / TNR on A | 0.43 / 55.6% | 0.79 / 81.5% | — |

The vague judge moves 1.8 points when you swap in a system the humans rate 17.5 points worse, and that
1.8 is well inside the noise floor you measured two sections ago. The rubric judge moves 26.3 and lands
within 1.8 points of the human gap. Same items, same humans, same answers: the difference is entirely in
whether the measurement step of the loop was done properly.

And when a change *should* move the number, the loop says so plainly: the judge row in the table above is
the clearest win available in this lab. Kappa 0.43 → 0.79, TNR 55.6% → 81.3%, for **$1.52** of judge calls
and one dropdown.

## How do I know it works?

**Challenge.** One loop, all three steps, and one held-out confirmation.

1. **Analyse.** From the confusion table, name the largest single bucket of human failure you can see:
   on the 40-item draw it is `no citation`, seven of the eighteen items the humans failed. Write that
   sentence down. It is your hypothesis, and it is what your change is supposed to move.
2. **Measure.** With the rubric judge selected on dev, confirm the check can see that bucket: TNR 81.3%
   means it fails four out of five real failures. A check that cannot fail the bucket cannot measure a fix
   to it.
3. **Improve, one knob.** Change the answer from the tuned system to the generic one. You are not trying
   to make the score go up — you are asking whether the loop can *detect a real regression*. The rubric
   judge drops from 65.0% to 30.0% on the same 40 items. The loop works.
4. **Validate once.** Switch the answer back, press **Validate on test** and record the four numbers for
   the rubric judge on the 37 held-out items: pass rate **43.2%** (16 of 37, 28.7%–59.1%), kappa **0.73**
   (0.49–0.94), TPR **82.4%**, TNR **90.0%** — against **17 of 37 = 45.9%** from the humans.

The pass rate lands 2.7 points from the human rate on data nobody tuned against, and the TPR has fallen
from 96.7% on dev to 82.4% on test. Both facts are the loop working: the check travels well enough to be
useful, and the held-out run still charged you for having tuned on dev. A loop that survives validation
usually looks slightly worse on the first held-out run. If yours does not, suspect that you validated
nothing.

## Use / don't use

**Do use** one change per run, always, and pin the baseline every time. The cost is wall-clock time: four
runs instead of one, at $1.52 each, about six dollars and ten minutes for a change you will defend for
months. The saving is that nobody has to re-litigate the result, and the eval stays usable as a decision
record instead of becoming a number that gets re-explained every sprint.

**Don't use** this to make three changes faster. When a deadline forces three edits into one run, the
honest version is: make them one at a time on dev, in three cheap runs, then make one final confirmation
run on the held-out set with all three applied at once. You lose the individual effect sizes on the
confirmation run — which you already measured — and you keep the ability to answer "which one broke it?"
six weeks later. The only case where a combined run is enough is when all three changes are already
individually measured and you only need to know whether they interact. That is a real answer, but it is
an answer you get *after* the three single runs, not instead of them.

In production the loop is a scheduled job, not a habit. A nightly CI run re-executes the pinned suite
against the current prompt and model, posts the diff on the pull request, and blocks when the drop exceeds
a tolerance. Module 13 builds exactly that, including the hard part: flaky runs, caching judge calls, and
the eval budget per pull request. Until then, the discipline is identical — one change, one number, one
decision — and the labs are the place to practise it, because a knob turns in a millisecond and a real
judge call takes 540 ms and a cent.

The failure mode to watch for after a few good months: the loop becomes ritual. Someone runs the suite,
sees a drop, and pastes the number into Slack without reading the diff. Ritual is worse than no loop,
because it produces the *appearance* of measurement. The pin-and-diff habit is the part that carries the
value; the running is just how it is started.

## Reflect

1. Think of the last change you were confident about. Name the pinned baseline, the single knob, and the
   noise floor you would have needed to believe it. Could you have produced all three?
2. Your team ships three changes together every release. Write the two-runs-per-change rule you would
   propose, and the one number you would put in the pull request comment.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- R. Kohavi, R. Henne and D. Sommerfield, [Practical Guide to Controlled Experiments on the Web: Listen to
  Your Customers not to the HiPPO](https://exp-platform.com/practical-guide/) (KDD 2007) — the rule this
  lesson applies to eval sets: one treatment per experiment, or the effect is unattributable.
- N. Larsen, J. Stallrich, S. Sengupta, A. Deng, R. Kohavi and N. T. Steven, [Statistical Challenges in
  Online Controlled Experiments: A Review of A/B Testing
  Methodology](https://doi.org/10.1080/00031305.2023.2257237) (2023) — why a point estimate without an
  interval is not a decision, and what to do about sample size.
- Hamel Husain, [Your AI Product Needs Evals](https://hamel.dev/blog/posts/evals/) (2024) — the fast
  evaluate, debug, change cycle this lesson turns into a procedure.
