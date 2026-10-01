---
id: "06.3"
module: 6
minutes: 18
practice_minutes: 50
prerequisites: ["06.2"]
objectives:
  - Compute Cohen's kappa on ten items by hand and get the same number the lab prints.
  - Explain in one sentence what kappa subtracts, and name the case where it stops being comparable between two sets.
  - Turn a disagreement list into a fix list by grouping the items by the human's failure category.
volatility: concept
sources:
  - title: "A Coefficient of Agreement for Nominal Scales (Jacob Cohen, 1960)"
    url: https://doi.org/10.1177/001316446002000104
  - title: "Cohen's kappa — the prevalence critique (Wikipedia)"
    url: https://en.wikipedia.org/wiki/Cohen%27s_kappa
  - title: "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (Zheng et al., 2023)"
    url: https://arxiv.org/abs/2306.05685
last_verified: "2026-10-01"
---

# 06.3 · Cohen's kappa and the disagreement review

Kappa is the one number in this module you can put a threshold on, and the only reason it exists is that
accuracy is not a measurement of a judge. It is also the number that tells you least about what to do
next — which is why this lesson is half arithmetic and half reading.

## Why it matters

Two teams both have a judge reading **kappa 0.40** on the same 94 items, the same answers, the same
labels. Both put it on a slide as a thing to improve. One team rewrites the judge prompt "to make it
stricter" and gets 0.46. The other team reads the 28 disagreements, notices that 23 of them are the
judge passing answers the humans failed and that 12 of those are missing citations, adds one clause to
the rubric, and gets 0.77 in a single change.

The first team will spend a month there. They have not run out of ideas; they have run out of
information. **A number tells you the judge is off. Only reading the items tells you how to fix it** —
and the second team skipped a month because somebody was paid to open 28 links.

The other failure is the mirror image, and it is the one this module is built around. Kappa is a
number, so it can be optimised, and optimising it on the items you tuned on is the easiest mistake in
eval work to make and the hardest to see. A judge at kappa **1.00 on 57 dev items** — zero
disagreements, interval 1.00–1.00 — has been tuned to those 57 items. There is no disagreement left to
resample, which is why the interval has collapsed to a point. That is not a good judge; that is a
lookup table.

## How it works

### kappa by hand, on ten items

Two steps. **Observed agreement** is the share of items where the two agree at all:

$$p_o = \frac{tp + tn}{n}$$

**Expected agreement** is what the two would agree on by accident, given how often each of them says
"pass" — the human marginal multiplied by the judge marginal, summed over both classes:

$$p_e = \underbrace{\frac{tp+fn}{n}\cdot\frac{tp+fp}{n}}_{\text{both pass}} + \underbrace{\frac{tn+fp}{n}\cdot\frac{tn+fn}{n}}_{\text{both fail}}$$

and kappa is the excess over that, as a fraction of the maximum excess available:

$$\kappa = \frac{p_o - p_e}{1 - p_e}$$

Ten items, five passed by the humans, the judge passes six of the ten:

| | Judge passes | Judge fails | Total |
|---|---|---|---|
| **Humans passed** | `tp` 4 | `fn` 1 | 5 |
| **Humans failed** | `fp` 2 | `tn` 3 | 5 |
| **Total** | 6 | 4 | 10 |

$$p_o = \frac{4+3}{10} = 0.70 \qquad p_e = \frac{5}{10}\cdot\frac{6}{10} + \frac{5}{10}\cdot\frac{4}{10} = 0.30 + 0.20 = 0.50$$

$$\kappa = \frac{0.70 - 0.50}{1 - 0.50} = 0.40$$

Now the real run — `Llama 3.2 3B · Plain · 0 shots`, all 94 items, greedy first sample:

$$p_o = \frac{66}{94} = 0.7021, \qquad p_e = \frac{47}{94}\cdot\frac{65}{94} + \frac{47}{94}\cdot\frac{29}{94} = 0.25 + 0.25 = 0.5000$$

$$\kappa = \frac{0.7021 - 0.5000}{1 - 0.5000} = 0.404 \;\Rightarrow\; \textbf{0.40}$$

### The gift in this dataset, and the trap in it

Look at that $p_e$. The humans split **exactly 47 / 47** on variant A, so their marginal is 0.5, and
whatever the judge's marginal is, $p_e = 0.5$ exactly. That collapses the whole formula to:

$$\kappa = 2 \cdot \text{accuracy} - 1 \qquad\text{whenever the humans split 50/50}$$

Both of this module's headline judges collapse to it:

| Judge, 94 items | `tp` | `fp` | `fn` | `tn` | Accuracy | $2\cdot\text{acc}-1$ | Labelled kappa |
|---|---|---|---|---|---|---|---|
| Plain, 0 shots | 42 | 23 | 5 | 24 | 66/94 = 70.2% | 0.404 | **0.40** |
| Rubric, 0 shots | 43 | 7 | 4 | 40 | 83/94 = 88.3% | 0.766 | **0.77** |

So on this dataset you can compute either number from the other by hand, which makes it the nicest
teaching example in the course — and it is also a trap you should be able to see. The collapse only
happens at a 50/50 human split. On a set that is 90% good answers, $p_e$ is nowhere near 0.5, kappa and
accuracy stop agreeing, and **two judges can rank in opposite orders under the two numbers.** That is
the prevalence critique from [6.2](lesson-02.md), and you can see its sharpest edge in this dataset:
throw away the 47 items the humans passed and evaluate the plain judge on the failures alone.

| Plain judge, failures only (47 items) | Accuracy | Kappa |
|---|---|---|
| All 94 items | 70.2% | 0.40 |
| Failures only, humans all fail | **51.1%** | **0.00** |

Nothing about that judge changed. It still agrees with the humans on 24 of 47 items, exactly as before.
But with every human verdict in the `fail` column, the agreement you would expect by accident from a
labeller with the same marginals is also 51.1%, so the excess is exactly zero. **Kappa is not
comparable across sets with different class balance**, and the number to quote with it is the class
balance.

### What the number is not

- **It is not "77% of verdicts were right."** Kappa 0.77 sits beside accuracy 88.3% on the same 94
  items. Reporting kappa alone understates the judge; reporting accuracy alone overstates it. They are
  different claims and you need both.
- **It is not stable at small `n`.** The same plain judge, on 40 dev items at seed 7, reads kappa
  **0.43** with a bootstrap interval of **0.13–0.69**. A point estimate with a 56-point spread behind
  it is a range that happens to be printed with a decimal point.
- **It is not a goal.** The bands on the tile are a reading aid — under 0.2 slight, 0.2–0.4 fair,
  0.4–0.6 moderate, 0.6–0.8 substantial, above 0.8 almost perfect — and the plain judge at 0.40 and the
  rubric judge at 0.77 are three bands apart on the same items. A target is something you set before you
  look, from what a false alarm and a missed fault cost you. **0.40 is not a target. It is a symptom.**

### The disagreement review

Here is the part that produces a diff. Take the same 94 items and list every item where the human and
the judge differ, then group them by **the human's failure category** — not by the judge's verdict, and
not in the order the items happen to sit in the file:

| Human's category | Plain judge: disagreements | Rubric judge: disagreements |
|---|---|---|
| `no_citation` | **12** (judge passed them all) | **5** (judge passed them all) |
| `wrong_fact` | 7 (judge passed them all) | 2 (judge passed them all) |
| `over_refusal` | 3 (judge passed them all) | 0 |
| `out_of_scope` | 1 (judge passed them all) | 0 |
| `correct` | 5 (judge **failed** them all) | 4 (judge **failed** them all) |
| **Total** | **28** | **11** |

The grouping is the deliverable, because it converts a list of 28 into a specification. Read it as
"what clause should have fired":

- **12 of the plain judge's 23 false alarms are missing citations.** A rubric with a clause that names
  the citation marker removes 12 disagreements in one line — which is the whole content of
  [5.3](../module-05/lesson-03.md).
- **7 more are wrong facts** — "Are Wednesdays meeting-free?" answered *No, Wednesdays are the main
  standup day*, and "What is the daily rate for meals while travelling?" answered *there is no daily
  rate*. The rubric judge still passes 2 of these, but catching 5 of 7 instead of 0 of 7 is the
  difference between the two kappas.
- **3 are over-refusals and 1 is an invented policy.** The plain judge passes "There is an employee
  share option pool that vests over 4 years" on a question the handbook does not answer at all.
- **All 5 missed faults are `correct` items.** The judge failed answers the humans passed: a doctor's
  note policy, a cycle-to-work scheme, the flight-fare rules, a sibling-supplier conflict rule, and the
  eval-suite ownership rule. None of them are failures in disguise; they are things the rubric's
  conjunction happens to trip on.

And then the pattern a number cannot show you: **every single one of the 9 missed faults across both
judges begins with a fail sample.** `s13`, `s34`, `s59`, `s70`, `s87` for the plain judge; `s15`, `s29`,
`s38`, `s47` for the rubric judge — in all nine cases the first recorded verdict is `FAIL` and the other
four say `PASS`. Ask the judge the same question five times with majority voting instead of taking the
first sample, and the plain judge's 28 disagreements become 24 (all false alarms, no missed faults)
while the rubric judge's 11 become 3. That is not a number, it is a **change of operating point**, and
it is [6.4](lesson-04.md).

One last check before you trust the grouping: remove the biggest category and see whether the judge was
only ever bad at one thing. Drop all 27 `no_citation` items and the plain judge reads kappa **0.38**
with TNR **45.0%** — worse, not better. The disagreements are not one concentrated weakness; they are a
judge that has no clause for anything.

## Show me

This lesson's preset opens the lab on `Llama 3.2 3B · Rubric · 0 shots`, variant A, **40 dev items at
seed 7**. The panel's own headline is **`Disagreements: 4 of 40`** and its subtitle is the sentence this
lesson is built on: *a number tells you the judge is off; only reading these tells you how to fix it.*

The four are grouped under three headings — two `no citation`, one `correct`, one `wrong fact` — and
each row carries the question, the judge's verdict, the human's verdict, and the first 150 characters
of the answer:

- `s01`, *How many days of paid time off do I get each year?* — the answer is "You get 25 days of paid
  time off per year, accrued monthly." Correct, uncited. Human **fail**, judge **pass**.
- `s73`, *Can I paste customer data into an external AI tool?* — "No. Customer data never leaves our own
  tools…" Human **fail**, judge **pass**.
- `s82`, *Does the company track customer satisfaction?* — "Yes, and each agent gets a personal score
  used in review." Human **fail** (`wrong_fact`), judge **pass**.
- `s38`, *Is adoption leave the same as parental leave?* — "Yes, the same 18 weeks at full pay…" Human
  **pass**, judge **fail**.

Then, in order:

1. Write one line per item: *which clause should have fired, and why did it not?* The first two are the
   same line twice, which is the point — a repeated line is a clause you can write.
2. Click **Pin as A**, switch the Judge dropdown to `Llama 3.2 3B · Plain · 0 shots`, and watch the
   disagreement count go from 4 to 16 on the same 40 items. Then set **How many items** to **All of
   them** and read both halves separately: the plain judge disagrees on 16 of 57 dev items and 12 of 37
   test items; the rubric judge on 6 and 5.
3. Read the tile's band. The rubric judge reads kappa **0.79** (0.56–0.95) — "substantial", one band
   below almost perfect — and the number you would have to beat is a threshold you set before you look,
   not the band the page picked.

> [!NOTE]
> These verdicts come from a seeded educational model of judge behaviour, not from a live LLM, and the
> model names in the Judge menu are the labels runs are filed under. Every count on this page is
> computed in your browser from those recorded per-item verdicts.

## Try it

**Predict first**, before you open anything:

1. Your judge reads kappa 0.55 over 94 items. Human-vs-human kappa on the same items is 0.40. What is
   the upper bound on what you can fix, and why is it not 0.55?
2. The human labels split 47 / 47 on this dataset. Write down what kappa would be for a judge with 90%
   accuracy, and then say what changes about that answer on a set that is 90% good answers.
3. All 9 missed faults in this module begin with a fail sample. Predict what happens to the number of
   false alarms if the judge is asked the same question five times and the majority is taken.

[Simulation: judge-lab](../../simulations/judge-lab/index.html?preset=disagreements)

1. **Do the ten-item kappa by hand before you touch the page.** Write out the matrix, compute $p_o$,
   $p_e$ and $\kappa$, and get 0.40. Then do the same on the page's confusion table for the rubric
   judge and check you can reproduce the printed figure.
2. **Prove the 50/50 collapse.** Confirm on the page that the humans passed 47 and failed 47 on variant
   A, then show that `2 × accuracy − 1` gives the printed kappa for both judges, on both halves. Then
   switch **Answer being judged** to variant C, where the humans passed only 8, and check that the
   collapse no longer holds — you now need the real formula.
3. **Build the fix list.** Open the disagreements panel on the plain judge, set **All of them** on dev,
   and write the grouping table above from the page. Then write one line per category: which clause
   would remove it, and how many items that clause removes. If a category has no clause, write the
   clause you would add.
4. **Find the items that are not judge-shaped at all.** On the plain judge's list, `s90` is an invented
   employee share option and `s18` is an over-refusal. Read both answers, then read
   [6.1](lesson-01.md)'s argument about who owns those labels. Decide whether these two items are
   judge defects or label defects, and say which you would change first.
5. **Watch kappa move when you remove a category.** Take the plain judge on dev, note kappa, then use
   **How to choose them → Keep the slice mix** and the item knob to build a set with no `no_citation`
   items. Record the new kappa and TNR, and write down what you would have concluded if you had built
   the gate on that set without noticing what you removed.

## Break it

**Tune kappa.** The failure this lesson exists to prevent: set the target from the number you already
have. The rubric judge reads 0.79 on dev, so the target is 0.80; you edit the rubric until dev reads
0.85, then 0.90, then one clause per remaining disagreement. Kappa 1.00 on 57 items with an interval
of 1.00–1.00 arrives eventually and is worthless. The lie: **an agreement number measured on the items
you tuned on describes your search, not your judge.**

**Drop the categories you cannot fix.** Disagreements are 12 `no_citation` out of 28, and `no_citation`
is the hardest thing to argue about, so the set loses them. Kappa rises. TNR rises. Everything looks
better and the judge is identical, because you deleted the evidence. The lie: **removing the failures
you could not catch makes the gate look sharper by making the set easier.**

**Quote kappa with no `n` and no interval.** "Our judge reads 0.77." On 94 items that is a fair
sentence. On 10 items, 0.77 is three or four items of luck, and the same figure would be a completely
different claim. The number is not the measurement; the number with its denominator and its spread is
the measurement.

**Read the disagreement list without writing anything down.** Reading 28 items feels like reviewing 28
items. It is not: you will remember the two that were funniest and you will fix your prompt around
them. The artefact is one line per disagreement — *which clause, why not* — and a list of lines is the
only thing that survives the meeting.

**The subtle one.** When a disagreement is resolved in favour of the judge, the fix is to the label.
Nobody notices this happening because it looks like consistency. The check is [6.1](lesson-01.md)'s:
the relabelled item carries a new category and a new reason, or it does not.

## Fix it

1. **Report kappa with `n` and with its interval, next to accuracy.** `kappa 0.77 (0.85–1.00) on 94
   items, accuracy 88.3%` is a claim. `kappa 0.77` is a rumour, and `kappa 0.43 (0.13–0.69) on 40
   items` is a rumour that happens to be true.
2. **Set the target before you look, from the cost of each error.** A target of 0.80 means "fewer than
   about one in five disagreements in either direction", which you can defend in terms of how many
   items a week somebody is going to re-read. A target chosen after the fact is a description.
3. **Read every disagreement, once per change, and write one line per item.** Group by the human's
   category. The repeated line becomes the clause; the unrepeated one becomes the question you ask your
   domain owner. On this dataset that is 28 lines for the plain judge and 11 for the rubric judge, and
   the rubric judge's 11 contain exactly 3 distinct problems.
4. **Validate once, and believe the drop more than the rise.** The rubric judge reads 0.79 (0.60–0.93)
   on dev and 0.73 (0.49–0.94) on test. The plain judge reads 0.43 (0.20–0.64) and 0.37 (0.12–0.63).
   Both transfer; neither is precise. A judge that tuned from 0.43 to 0.90 on dev and lands at 0.4 on
   test has told you the truth about itself, and the held-out half is the only place that truth is
   available.

## How do I know it works?

**Challenge, on dev.** Your judge is validated when:

- **Kappa ≥ 0.80 on dev, with the interval's lower end above 0.60**, and the interval printed next to
  it. The rubric judge on all 57 dev items reads **0.79 (0.60–0.93)** — which fails the point target and
  passes the lower-end test, and you should be able to say which of those two facts is the one you
  would ship on. The plain judge reads **0.43 (0.20–0.64)** and fails both.
- **Every disagreement has a line against it.** No item in the list is "just a close one". If a
  category's disagreements are all the same line, that category has a clause to write.
- **The class balance is written down next to the kappa.** 47 / 47 on this dataset, which is why
  accuracy and kappa agree here and will not agree on your set.
- **Removing a category does not raise the score.** If dropping `no_citation` moves kappa from 0.38 to
  something better, you were measuring your set, not your judge.

**Validation, once.** Press **Validate on test** — the one button in this lab you press a single time —
and write both halves down:

| Judge | Dev, n = 57 | Test, n = 37 |
|---|---|---|
| Plain, 0 shots | kappa 0.43 (0.20–0.64), 16 disagreements | kappa 0.37 (0.12–0.63), 12 disagreements |
| Rubric, 0 shots | kappa 0.79 (0.60–0.93), 6 disagreements | kappa 0.73 (0.49–0.94), 5 disagreements |

The plain judge's 4-point drop comes with 11 false alarms out of 18 human failures on test. That is the
judge you would have shipped if you had tuned on dev and never pressed the button, and it is exactly the
kind of finding the button exists to produce.

## Use / don't use

**Do use** kappa as the one gate number, with `n` and with its interval, always beside accuracy. It is
the only scalar that answers "is this judge better than chance on this set", and it is the only one
that can be a release criterion.

**Do read every disagreement after each change to the judge.** It is the cheapest work in the module:
28 items, an hour, and it is the difference between a prompt change that helps and a prompt change
that helps once.

**Do keep the disagreement list in the repository next to the prompt.** The list is the argument for
the prompt; the prompt without it is a text box, which is the thing
[5.3](../module-05/lesson-03.md) refused to let the page pretend was reviewable.

**Don't compare kappa across two sets with different class balance.** The drop-the-`correct`-items
table above is the whole warning: the same judge reads 0.40 on 94 items and 0.00 on the 47 failures
inside them. When you compare two judges, compare them on the same items, which is what the split from
[4.2](../module-04/lesson-02.md) is for.

**Don't use kappa as the optimisation target.** Use the disagreement list. A prompt tuned until the
number is high is tuned until the list is short on items it was tuned on.

What teams actually do: the agreement suite runs nightly over a frozen human set and publishes kappa
with its bootstrap interval, accuracy, TPR and TNR, with the class balance in the panel header. Any
change to the judge prompt opens a review that includes the disagreement diff for that change — not the
new kappa, the diff. A judge whose kappa is flat but whose disagreements have moved from 20
`no_citation` to 5 `no_citation` and 15 `wrong_fact` has got worse where it matters and the total will
not say so, which is why the list, not the number, is the artefact a team actually reads.

## Reflect

1. Your judge reads kappa 0.88 on dev with an interval of 0.71–1.00, and 0.44 on test. Write the two
   sentences that go in the release note, and say which of the two numbers you would have if you had
   only the dev half.
2. A colleague proposes dropping the 27 `no_citation` items because the judge cannot be fixed for them
   this sprint. Write the numbers that would move, the numbers that would not, and the sentence that
   stops them.
3. Every one of the 9 missed faults in this module starts with a fail sample and passes on the other
   four. Write the change you would make to the judge's *run* rather than to its prompt, and name what
   it costs.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Jacob Cohen, [A Coefficient of Agreement for Nominal
  Scales](https://doi.org/10.1177/001316446002000104) (1960) — the statistic this lesson derives by
  hand, and the reason it exists: to subtract the agreement two labellers would reach by accident.
- [Cohen's kappa](https://en.wikipedia.org/wiki/Cohen%27s_kappa) (Wikipedia) — the plain-language
  treatment, including the prevalence critique that the failures-only table in this lesson is an example
  of: the statistic moves when the class balance moves, even when nothing else does.
- Lianmin Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot
  Arena](https://arxiv.org/abs/2306.05685) (2023) — the empirical backdrop for reading disagreements by
  category rather than one at a time, and for treating a judge's systematic errors as a fix list.