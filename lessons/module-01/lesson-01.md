---
id: "01.1"
module: 1
minutes: 14
practice_minutes: 30
prerequisites: []
objectives:
  - Explain, with a counted example, why a pass rate on its own is not evidence that a system improved.
  - Read a judge scoreboard and say what the pass rate, the agreement with humans and the interval width each one tells you.
  - Decide when a feeling about a prompt change is worth keeping and when it is worth measuring.
volatility: concept
sources:
  - title: "Your AI Product Needs Evals (Ham Husain, 2024)"
    url: https://hamel.dev/blog/posts/evals/
  - title: "Probable Inference, the Law of Succession, and Statistical Inference (E. B. Wilson, 1927)"
    url: https://doi.org/10.1080/01621459.1927.10502953
  - title: "A Coefficient of Agreement for Nominal Scales (J. Cohen, 1960)"
    url: https://doi.org/10.1177/001316446002000104
last_verified: "2026-10-01"
---

# 01.1 · Vibes versus evals

A prompt change reads better, everyone agrees, and it ships. This lesson is about the regression that
follows, and about the three numbers that would have caught it: the pass rate, the agreement between the
check and the humans, and the width of the interval around the pass rate.

## Why it matters

Two engineers on a support-bot team rewrite the system prompt to make answers "clearer and more
confident". They try nine questions. The answers are better: no hedging, no rambling, the handbook fact
is right there. They merge it on a Friday.

Eleven days later a customer posts a screenshot in the support channel. The bot told them they can carry
over unlimited paid time off. The old prompt would never have said that. The new one is more fluent, more
confident, and confidently wrong. Three people had read the new answers and all three had said "this
looks better", and all three were right about the things they had read.

Nothing in that story is stupidity. Reading nine answers is how you notice that something is broken. The
mistake is treating the noticing as the measurement. A feeling has no denominator: nobody wrote down which
questions were tried, nobody recorded what "better" meant, and there is no number to compare against next
week. The team's entire memory of the decision is "it felt better", which is exactly the thing that cannot
be re-checked six months later when the regression surfaces.

An eval is not a stricter feeling. It is a feeling plus the three things a feeling cannot carry: the items
it was measured on, the check that produced the verdict, and how much of the answer is the system and how
much is the sample.

## How it works

Take twenty items from the support set. A human read each answer and wrote pass or fail. A judge — a
program that reads the same answers and writes pass or fail — did the same. You now have a 2×2 table.
This is the table every number in the rest of the course comes from:

|                    | Judge says pass | Judge says fail | Total |
| ------------------ | --------------- | --------------- | ----- |
| **Human says pass** | 10              | 4               | 14    |
| **Human says fail** | 5               | 1               | 6     |
| **Total**          | 15              | 5               | 20    |

**The pass rate** is the judge's column total: 15 of 20, so 75.0%. This is the number teams put on a
dashboard. On its own it is a statement about the judge, not about the system. It went up because the judge
became more generous, exactly as much as it would have gone up if the system had improved.

**The agreement with humans** is the same table read by row. Two rates matter:

- TPR, the true positive rate: of the 14 answers humans passed, the judge passed 10. 10 ÷ 14 = 71.4%.
- TNR, the true negative rate: of the 6 answers humans failed, the judge failed 1. 1 ÷ 6 = 16.7%.

TPR says how much of the good stuff survives. TNR says how much of the bad stuff gets caught, and TNR is
the one that decides whether a check can be used as a gate. Here the judge let five of six real problems
through. A check like that is a number generator, not a gate.

**Kappa** is agreement corrected for what a coin that always guessed the majority label would have scored.
By hand, on the table above: the two agree on 10 + 1 = 11 of 20, so observed agreement is 0.55. Humans say
pass 14/20 = 0.70 of the time; the judge says pass 15/20 = 0.75 of the time. A coin that copied those
proportions would agree 0.70 × 0.75 + 0.30 × 0.25 = 0.60 of the time. So

$$\kappa = \frac{0.55 - 0.60}{1 - 0.60} = -0.125$$

which the lab shows as −0.12. The exact third decimal is floating-point dust; the **sign** is the finding.
This judge is worse than a coin. It fails on the good answers more often than luck would.

**The interval width** is how much of the number is the system and how much is which items you happened to
sample. Run the same judge, the same system, the same 40 dev items, ten times with ten different random
draws, and the pass rate lands anywhere between **62.5% and 75.0%**. Nothing changed between those runs
except luck. Now add the interval and the picture is honest: at 10 items the same system reads
**60.0% with a 31.3%–83.2% interval**; at 57 items it reads **66.7% with a 53.7%–77.5% interval**. Same
system, same judge. Only the sample changed.

That is why a pass rate with no interval is not evidence. "It went from 62% to 71%" is a claim about two
numbers, and the interval on each of those numbers is roughly ±14 points. The difference you are selling
is smaller than the noise you are ignoring.

The interval itself is two lines of arithmetic. For 27 passes out of 40:

$$p = 0.675,\quad \text{centre} = p + \frac{z^2}{2n} = 0.723,\quad \text{margin} = z\sqrt{\frac{p(1-p) + z^2/4n}{n}} = 0.153$$

$$lo = \frac{0.723 - 0.153}{1 + z^2/n} = 52.0\%,\qquad hi = \frac{0.723 + 0.153}{1 + z^2/n} = 79.9\%$$

with $z = 1.96$. This is the Wilson interval, and the labs use it everywhere because eval sets are small
and pass rates sit near 1, where the normal approximation runs past 100% and is simply wrong.

## Show me

The tour page computes the table above live, in your browser, from twenty recorded items. As it loads it
shows four tiles: judge pass rate **75.0%** (15 of 20), kappa **−0.12** with a bootstrap interval of
**−0.44–0.30**, TPR **71.4%**, TNR **16.7%**. The confusion table underneath is the same 2×2 you built
above, and its bottom-right cell is the number the callout leans on: 1 − 16.7% = 83.3% of real failures
sail through, which the page's prose rounds to four in five.

> [!IMPORTANT]
> **These labs use an educational model.** The judge verdicts in every lab are produced by a seeded model
> of judge behaviour, not by a real LLM, and every statistic is computed for real in your browser from
> those recorded verdicts. So a number like 75.0% here is a real computation on modelled verdicts. It is
> not a measurement of Llama, GPT, Claude or any other named model, and it must never be quoted as one.
> Every lab footer says so, and the rest of Module 1 repeats it on purpose. The arithmetic is real; the
> judge is a stand-in for a judge.

## Try it

**Predict before you open anything.** On paper: (1) how many of the 20 items will the judge pass? (2) will
its kappa be positive or negative? (3) which of the two rates, TPR or TNR, will be the small one, and by
roughly how much? Write all three down. You will check yourself against the page, not against anybody.

[Simulation: tour](../../simulations/tour/index.html)

1. **Count the table before you read the tiles.** Cover the tiles with your hand and read the confusion
   table. Write down the four cell counts, then compute the pass rate, the TPR and the TNR yourself. Then
   look. The first time you do this anywhere in this course, the gap between your number and the page's
   number is usually the point estimate of a rate you read as a percentage.
2. **Find the five that got away.** The five items the judge passed and the human failed are the whole
   lesson. For each one, say in one sentence what the judge must have liked about the answer. Then say
   what a check would have had to look at to catch it. That sentence is a candidate failure category, and
   failure categories are what Module 2 turns into an eval set.
3. **Check the kappa against the two rates.** The kappa is −0.12 and the TNR is 16.7%. Write down which of
   those two facts explains the negative sign, then check the arithmetic in the section above. It is the
   TNR: a judge that waves through failures is a judge that disagrees with the humans on the items that
   matter, and chance-correction punishes disagreement with the majority label hardest.
4. **Split the 20 in half.** Compute the TNR on items 1–10 and on items 11–20. You should get 0% (0 of 2
   real failures caught) and 25% (1 of 4). Both halves are too small to tell apart, and that is the lesson
   in one line: a demo set cannot resolve the difference it is being asked to resolve.

## Break it

The knob in this lab is not a slider. It is **which number you read**.

Read the pass rate and the story writes itself: the judge passes 75% of these answers, so the bot is fine.
Now take that number to the support set in the judge lab — module 1.2 opens it — and score two systems on
all 57 dev items with a vague judge. The handbook-tuned system scores **66.7%** and the much worse
generic-prompt system scores **64.9%**. Nearly the same number. The humans who labelled the same 57 items
say **52.6%** and **35.1%** — a 17.5-point gap between two systems the judge calls identical.

The lie has a name: **the pass rate of an unvalidated check is a measurement of the check.** Read the
kappa and the TNR next to it and the same run tells the opposite story, because kappa 0.43 and a TNR of
55.6% are saying "this check is not yet good enough to gate a release".

A second way to break this eval, which costs nothing: drop ten items. The interval goes from
52.0%–79.9% to 31.3%–83.2% and the point estimate barely moves. Shrinking the sample never improves the
system, it only hides how little you know.

## Fix it

Three changes, all visible on the scoreboard, none of them "get a better number":

1. **Report the pass rate with its interval, always.** 66.7% (53.7%–77.5%) is a claim. 66.7% is a rumour.
2. **Report the check's agreement beside it.** kappa 0.43, TPR 86.7%, TNR 55.6% says the check is not
   ready. The repair is a better check, not a different system.
3. **Change the check, then read the scoreboard again.** Swap the vague judge for one that writes its
   rules down, same 57 items, same answers: kappa **0.43 → 0.79**, TNR **55.6% → 81.5%**, and the pass
   rate *falls* from 66.7% to 59.6% because the number got closer to the humans' 52.6%. The fix made the
   scoreboard look worse. That is what a fix looks like when the number was lying.

## How do I know it works?

**Challenge.** Before you touch the judge lab, write down the target you would set for your own feature
and the evidence that would make you believe it. Then check the target against the numbers you already
have, in this order:

1. Your judge must have a **TNR above 0.80**. A check that misses one real failure in five cannot gate a
   release, whatever its pass rate says. The tour's judge has a TNR of 16.7%, so it fails this before it
   starts.
2. Your run must have a **point estimate plus an interval narrow enough to act on**. Ask: could this same
   system have produced the other end of the interval on a different sample? At n = 10, yes, easily. At
   n = 57 with a 24-point-wide interval, still yes for a 5-point change. A target you cannot resolve is
   not a target.
3. Then, and only then, **one held-out run on items you have not tuned against.** That button exists on the
   judge lab page and it is one-way; module 1.3 and every module after it use it. Tuning on dev and
   reporting dev is how a check gets to agree with you perfectly and still be wrong about the world.

Write your target as a sentence with numbers in it: "TNR ≥ 0.80 on dev, pass rate within 5 points of the
human rate on 37 held-out items". That sentence is the first line of every eval you will build in this
course.

## Use / don't use

**Do use** a bare pass rate for the thing a bare pass rate is good at: a dashboard number that nobody
gates on, trending over weeks, where the point is the direction and the sample is thousands of items. On
that page, a number without an interval is a rounding error waiting to happen but not a disaster.

**Don't use** it to decide whether to ship. A gate needs three things a pass rate cannot supply: the
agreement of the check with humans, the interval, and a held-out set. Teams that gate on a pass rate alone
get a gate that fires on noise and misses real regressions, and the cost lands on whoever gets paged.

In production this costs real money, which is why people skip it. The judge run in the lab is priced on the
page: **$0.03794 per call, 40 calls, $1.5176** for a run of 40, **$7.5880** at five repeats, 540 ms per
call. A nightly suite of 200 items with three repeats is about three dollars a night. The expensive part is
never the judge calls; it is the human labels, and that cost is why the course spends Module 2 on choosing
what to label rather than labelling everything.

What teams actually do, in the order the cost climbs: assert on the things a program can decide (does the
output parse, does it contain the section it claims, is it under 200 words), keep a frozen golden set of
30 to 50 hand-labelled items that only ever grows, and re-read it by hand every couple of weeks. The hand
reading is not a step you skip once you have an automated check — it is how you find out the check has
stopped matching reality.

## Reflect

1. Think of the last prompt or model change you shipped because it "felt better". What were the items, and
   what number would you have needed to be able to reverse the decision later?
2. You have a judge with 90% accuracy and a TNR of 20%. Write, in one sentence, the decision you would
   refuse to let anyone make with that judge.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Hamel Husain, [Your AI Product Needs Evals](https://hamel.dev/blog/posts/evals/) (2024) — the failure
  this course is built around: products plateau because the team is iterating on the system without
  iterating on the measurement.
- E. B. Wilson, [Probable Inference, the Law of Succession, and Statistical
  Inference](https://doi.org/10.1080/01621459.1927.10502953) (1927) — the interval used throughout the
  labs.
- J. Cohen, [A Coefficient of Agreement for Nominal Scales](https://doi.org/10.1177/001316446002000104)
  (1960) — kappa, the chance-corrected agreement behind the headline number on the tour page.
