---
id: "06.5"
module: 6
minutes: 17
practice_minutes: 45
prerequisites: ["06.4"]
objectives:
  - Derive the Rogan–Gladen correction from the observed pass rate and check it against a real run by hand.
  - Say why the denominator vanishes as a judge's rates approach chance, and predict when the corrected number will land outside 0–100%.
  - Decide when the honest answer is to publish the uncorrected pass rate and say why you are not correcting it.
volatility: concept
sources:
  - title: "Judgmental limitations in the application of automated knowledge-based assessment tools (Rogan & Gladen, 1998)"
    url: https://www.sciencedirect.com/science/article/pii/S0360136797000862
  - title: "Evaluating the Effectiveness of LLM-Evaluators (Eugene Yan)"
    url: https://eugeneyan.com/writing/llm-evaluators/
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 06.5 · Correcting a pass rate for judge error

The last number on a judge's page is the one nobody trusts: its own pass rate. It is wrong in a known
direction and by an amount you can measure. This lesson derives the correction, shows it working to
three decimal places, and then spends most of its length on the day it stops working.

## Why it matters

The tuned system's human pass rate is 47 of 94 — **50.0%**. The plain judge reads **69.1%** on the same
94 items. Nobody put anything wrong in either number: the judge was simply generous, and it is
measurably generous — it passes 23 of the 47 answers the humans rejected and fails 5 of the 47 they
accepted.

So the dashboard says the system is a 69% system. It is a 50% system. Every decision made on that
number — release it, keep iterating, tell the customer it is ready — is a decision made on a figure
that is wrong by 19 points in a known direction, and the error is not noise, so it does not average
out over a bigger set.

There is a fix and it is one line of algebra. There is also a version of this that produces **104%**,
which is the reason this lesson is the last one in the module rather than a footnote: the correction
is only as stable as the denominator it divides by, and the page is built to show you when it is not.

## How it works

### The correction

Write the observed pass rate as a mixture of two things the judge actually did. It passes some things
humans passed — a fraction TPR of them — and it passes some things humans failed, which is $1 - \text{TNR}$
of them:

$$\text{observed} = \text{TPR}\cdot S + (1 - \text{TNR})\cdot(1 - S)$$

where $S$ is the pass rate the humans would have given. Solve it:

$$\boxed{\;S = \frac{\text{observed} + \text{TNR} - 1}{\text{TPR} + \text{TNR} - 1}\;}$$

Read the two halves. The **numerator** is roughly how far the observed rate sits above what a judge
that always failed would have reported. The **denominator** is how much better than always-fail the
judge actually is, measured in the same units. Divide one by the other and you have de-biased a pass
rate.

### It works: one run, by hand

Take `Llama 3.2 3B · Plain · 0 shots` over **all 57 dev items**, greedy first sample. All three inputs
come off the page:

- observed pass rate **38/57 = 0.6667**
- TPR **26/30 = 0.8667** — of the 30 dev items the humans passed, the judge passed 26
- TNR **15/27 = 0.5556** — of the 27 dev items the humans failed, the judge failed 15

$$S = \frac{0.6667 + 0.5556 - 1}{0.8667 + 0.5556 - 1} = \frac{0.2222}{0.4222} = 0.5263 \;\Rightarrow\; \textbf{52.6\%}$$

And the humans' actual rate on those 57 items is **30/57 = 0.5263**. The correction landed on the
answer, to four decimals, from three numbers you could read off the page without any of them being the
answer.

That is the strongest possible statement of what the formula does, and it also hides its weakness:
here the observed rate and the TPR/TNR were measured on the *same* 57 items, so the correction is a
fixed point that returns what it started from. Move the observed rate onto a sample and the fixed
point breaks. On 40 random dev items at seed 7 the same judge reads **67.5%** (27 of 40) observed, and
with the same TPR and TNR measured on all 57 dev items:

$$S = \frac{0.675 + 0.5556 - 1}{0.8667 + 0.5556 - 1} = \frac{0.2306}{0.4222} = 0.5461 \;\Rightarrow\; \textbf{54.6\%}$$

The humans' rate on those same 40 items is **55.0%**. The correction moved 67.5% to 54.6% and missed by
four tenths of a point. The rubric judge does the same on the same page: observed **65.0%** → corrected
**59.5%**, against a true **60.0%** on those 40 items.

### The denominator is the whole risk

$$\text{TPR} + \text{TNR} - 1$$

is a measure of how far the judge is from a coin that always says fail. A perfect judge scores 1. A
judge that flips at random scores 0. And **a judge that flips at random makes this expression exactly
zero**, which is the moment the numerator stops mattering and the arithmetic starts producing
nonsense: any non-zero numerator divided by a vanishing denominator runs away to infinity, in one
direction or the other.

The lab flags two failure modes rather than hiding either:

- **TPR + TNR barely above 1** — the correction multiplies a small numerator by a small denominator.
  The number still prints, and it is a direction, not a value.
- **The correction lands outside 0–100%** — not a crash, a warning. A pass rate above 100% is a
  statement that the judge's TPR and TNR cannot both be true of the set you measured.

Both exist in the shipped data. `Qwen3 0.6B · Plain · 0 shots` reads TPR **86.7%** (26/30) and TNR
**33.3%** (9/27) on the dev half — TPR + TNR is **1.200**, a denominator of exactly **0.200**, so the
page marks every correction from this judge as a direction rather than a value. On 40 dev items at seed
7 it reads an observed **75.0%**, which corrects to **41.7%** while the truth is 47.5%. Turn the seed
to 20 and the observed rate becomes **87.5%**:

$$S = \frac{0.875 + 0.3333 - 1}{0.8667 + 0.3333 - 1} = \frac{0.2083}{0.2000} = 1.042 \;\Rightarrow\; \textbf{104.2\%}$$

The page says, in words: *the correction landed outside 0–100%. That is not a bug in the arithmetic: it
means this judge is so close to useless that the data cannot support any estimate.*

And the punchline of that whole paragraph is the cheap number: **that judge's pass rate over all 94
items is 76.6%, against a human 50.0%.** If you had a dashboard with no kappa on it, that is the judge
you would be congratulating yourself on.

### What the correction is worth, and when to refuse it

It is worth exactly one thing: it tells a stakeholder that the number they are about to act on is
biased, by how much, and in which direction. It is not worth being published on its own. It has three
properties that should govern when you use it at all:

1. **It inherits every error in TPR and TNR.** Both were measured on your dev items, by a judge whose
   prompt you may have tuned on those same items. A stale TPR produces a confidently wrong correction,
   which is worse than no correction.
2. **It assumes the judge's errors are the same on the new set as on the dev set.** If your production
   mix is more generous — longer answers, friendlier questions, a different product area — the
   correction is answering a question about your dev set.
3. **Its instability is a property of the judge, not of the formula.** When the denominator is 0.2, the
   honest answer is not a corrected number with four significant figures. It is a sentence.

> [!IMPORTANT]
> That sentence is the deliverable of this lesson: **sometimes the correct thing to publish is the raw
> pass rate, its interval, its item count, and a statement that you are not correcting it and why.** A
> corrected number with a denominator near zero is a more confident-looking artefact produced by less
> information. That trade is not worth making in either direction.

## Show me

This lesson's preset opens the lab on `Llama 3.2 3B · Plain · 0 shots`, variant A, **40 dev items at seed
7**, with the correction panel already on. The four tiles read:

- **Judge pass rate 67.5%** (52.0%–79.9%)
- **Corrected 54.6%** (bootstrap 38.6%–64.9%)
- **Judge TPR 86.7%** — *measured on all dev items*
- **Judge TNR 55.6%** — *measured on all dev items*

Note the note under the last two. The correction's TPR and TNR come from **all 57 dev items**, not from
the 40 you are looking at, and that is deliberate: correcting a 40-item pass rate with rates estimated
on those same 40 items just returns the same 40 items. The observed rate and the rates used to correct
it have to come from different samples or the arithmetic is circular.

Then:

1. **Check it by hand.** Read the three numbers and compute the formula above. You get 54.6%, which is
   the tile. Now look up what the humans actually said about those 40 items: **55.0%**.
2. **Read the callout under the tiles.** It says *stable enough to quote — but quote the interval with
   it, and say which judge produced the correction.* The interval, 38.6%–64.9%, is the honest width and
   it is wide.
3. **Switch the Judge dropdown to `Llama 3.2 3B · Rubric · 0 shots`.** Observed **65.0%**, TPR 96.7%,
   TNR 81.5%, denominator **0.782**, corrected **59.5%** — and the humans' rate on the same 40 items
   is **60.0%**. A different judge, a different bias, the same four-tenths of a point.
4. **Switch to `Qwen3 0.6B · Plain · 0 shots`.** TPR 86.7%, TNR 33.3%, denominator **0.200**, and the
   callout changes to *TPR + TNR is barely above 1, so the correction multiplies a small numerator by a
   small denominator. Treat the corrected number as a direction, not a value.*
5. **Set the sampling seed to 20.** The observed rate becomes **87.5%**, the corrected tile becomes
   **104.2%**, and a third callout appears: *the correction landed outside 0–100%.* Nothing changed
   except which 40 items you looked at.

> [!NOTE]
> The pass rates behind these tiles come from a seeded educational model of judge behaviour, not from
> a live LLM, and the model names in the Judge menu are the labels runs are filed under. The
> correction arithmetic is the real thing, applied to recorded verdicts, in your browser.

## Try it

**Predict first**, before opening anything:

1. A judge reads TPR 90.0% and TNR 30.0% over 94 items, and its pass rate reads 70.0%. Compute the
   denominator, then say whether you would publish the corrected number.
2. Your corrected pass rate is 104%. Name the two facts about the judge that make that possible, and say
   which of them you would check first.
3. The correction fixed a 40-item sample exactly. Why does the same correction, on all 57 items, look
   like it did nothing?

[Simulation: judge-lab](../../simulations/judge-lab/index.html?preset=corrected)

1. **Do the arithmetic three times.** Write out the correction for (a) the plain judge on 40 items at
   seed 7, (b) the rubric judge on the same 40, and (c) the plain judge on all 57 dev items. Record the
   observed rate, TPR, TNR, denominator, corrected rate, and the humans' true rate on those items in a
   row each. Two of the three should land within a point.
2. **Find the denominator on the page.** Work down the Judge dropdown and record TPR, TNR and
   $\text{TPR} + \text{TNR} - 1$ for each: `Qwen3 0.6B · Plain` reads **0.200**, `Prometheus 2 7B ·
   Stepwise · 0 shots` reads **0.967**. Rank the judges by that column and say which of them you would
   correct a number for.
3. **Break the correction with the seed, deliberately.** With `Qwen3 0.6B · Plain · 0 shots` selected,
   move the sampling seed from 7 to 20 and read the corrected tile. Then move it to 43. Write down the
   observed rate, the corrected rate and the out-of-range warning each time, and then write the sentence
   you would put in a review of that run.
4. **Ask what the correction assumed.** TPR and TNR are measured on all 57 dev items with one recorded
   configuration. Change **Answer being judged** from A to C and watch the corrected rate move while
   your dev labels underneath change too. Write down which of the two halves of the correction you would
   have to re-measure after a system change, and which you would not.
5. **Try the circular version on paper.** Take the 40 items, estimate TPR and TNR *on those 40 items*
   rather than on all 57, and apply the correction. Then do it again on all 57. Write one sentence
   explaining why the first version tells you nothing, which is the reason the page labels the two
   tiles *measured on all dev items*.

## Break it

**Publish the corrected number without the denominator.** The corrected tile renders, it has a decimal
point, and it moves in the right direction, so it goes on the slide. But a correction from a judge with
$\text{TPR} + \text{TNR} = 1.2$ is a 0.2-times-multiplier on a small numerator, and it swings from 41.7%
to 104.2% depending on which 40 items you drew. The lie: **a corrected number with no denominator beside
it is more confident than the raw number it replaced, and less true.**

**Correct with rates measured on the same sample.** Observed pass rate, TPR and TNR all from the same
40 items, correction applied, and the answer comes back at the human rate on those items — which looks
like the formula working perfectly. It is the formula proving that it is circular. On this dataset it
returns exactly 52.6% on all 57 dev items, because the dev set *is* the set the rates came from. The
lie: **a correction that lands on the answer when the answer was its input is measuring its input.**

**Correct a stale judge.** TPR and TNR were measured in March, the prompt changed in April, and the
dashboard applies April's pass rate with March's bias. The number is precise, it is wrong, and nothing
on the page can tell you — because the page is not told either. This is the [5.3](../module-05/lesson-03.md)
keying rule one level up: **the correction's key contains the judge's key.**

**Correct the pass rate instead of fixing the judge.** The plain judge's observed rate on all 94 items
is 69.1% against a human 50.0%; the correction says 52.6%; and the team moves on. The judge still
passes 23 of the 47 real faults, and it is still the judge that will be in the gate next month. The lie:
**a correction is a measurement of a judge, and it is used far too often as a repair of one.**

**The quiet one.** Report the corrected rate without the raw one. 54.6% is a good number. Nobody can
tell how far it moved, so nobody can tell whether it was a small correction of a small bias or a large
one — and "the corrected rate" with no raw rate beside it is unfalsifiable.

## Fix it

1. **Report both, always, with the inputs.** `Judge pass rate 67.5% (52.0%–79.9%) on 40 items; human
   pass rate 55.0%; corrected 54.6% (38.6%–64.9%); TPR 86.7%, TNR 55.6% measured on all 57 dev items
   for `Llama 3.2 3B · Plain · 0 shots`, prompt hash `…`.` That is a paragraph, and every number in it
   is one somebody can check.
2. **Print the denominator next to the correction, every time.** $\text{TPR} + \text{TNR} - 1 = 0.422$
   for this judge, 0.782 for the rubric judge, 0.200 for the weakest one in the menu. A denominator
   below about 0.2 means the correction is a direction and the caption must say so in words.
3. **Refuse the correction and say why.** The lab's own wording is the one to steal: *report the raw
   pass rate with its interval and say why you are not correcting it.* That sentence ends a review in
   one line, and it is more useful than a number produced by dividing by 0.2.
4. **Keep the raw pass rate as the primary number.** The correction is a diagnostic — it tells you how
   far your headline is from the truth, which is a fact about the judge. The headline stays the number
   you can reproduce, and the corrected value lives beside it as an annotation rather than replacing it.

## How do I know it works?

**Challenge, on dev.** Your corrected number is publishable when all four hold:

- **The denominator is comfortably above 0.2** for the judge producing it. On this data: plain 3B
  **0.422**, rubric 3B **0.782**, Qwen3 0.6B plain **0.200** — which is the last one you would correct
  with and the first one the page warns about.
- **The interval is on the page.** The bootstrap here runs **38.6%–64.9%** — 26 points wide on 57 dev
  items — and it is the honest width. A corrected rate without it is a point estimate of a quantity
  whose inputs were themselves estimated.
- **The raw rate, the corrected rate and the human rate are all visible.** The plain judge on 40 items:
  67.5%, 54.6%, 55.0%. If your three numbers cannot be printed together, the correction is not ready.
- **The correction's inputs are from the same key as the pass rate being corrected.** Same judge,
  same variant, same repeat count and threshold. A correction produced by a different configuration is
  not a correction, it is a guess with a fraction in it.

**Validation, once.** Press **Validate on test** and check that the correction still points the right
way on items nobody tuned on. The plain judge on the held-out 37 reads **73.0%** observed, and with its
dev TPR of 86.7% and dev TNR of 55.6% the corrected value is **67.6%** against a true human rate of
**45.9%** — 22 points of over-estimate remaining. That is the honest end of this: the correction was
measured on dev, the system behaves differently on test, and the gap between 67.6% and 45.9% is the
part the formula cannot reach. Write both numbers down rather than choosing the one you prefer.

## Use / don't use

**Do use the correction to explain a gap, not to close one.** "The judge passes 67.5% where the humans
pass 55.0%; correcting for its measured bias gives 54.6%" is a true, checkable sentence about a judge.
"It passes 54.6% effective" is a number about nothing in particular.

**Do keep the raw pass rate as the headline.** The raw rate is what your pipeline produced and what you
can reproduce tomorrow. The corrected value is an annotation with its own caveats and its own key.

**Do measure the judge's TPR and TNR on a different sample from the pass rate you are correcting.** That
is not a detail — it is the difference between correcting and reflecting.

**Don't correct when the denominator is small.** Below roughly 0.2 the correction amplifies noise by
five times, and the amplified number will be quoted without the flag that produced it. Below zero —
possible when TPR + TNR < 1, which happens when a judge is worse than always-fail — it flips sign and
produces a confidently wrong answer inside the valid range.

**Don't correct your way out of a weak judge.** A judge at TNR 33.3% does not become usable because its
bias is now documented. It becomes a judge whose bias is documented, which is worth something, and it
is still the judge in the gate.

What teams actually do in production: publish the judge's pass rate with its interval and item count as
the headline, and put the correction in a separate panel with TPR, TNR and the denominator printed
beside it. The correction is refreshed whenever the judge is re-validated, and the panel is disabled
rather than hidden when the denominator drops below a floor — a visible absence is more honest than a
number with a warning attached. When the corrected and human rates disagree by more than the interval,
that is a finding about the dev set, and the next piece of work is [6.1](lesson-01.md), not a second
division.

## Reflect

1. Your corrected pass rate reads 54.6% and the judge's TPR + TNR is 1.20. Write the two sentences that
   would appear in a release note, and say which number you would put in the headline.
2. The page can produce 104.2%. Write the arithmetic that produces it and the one sentence that explains
   it to a stakeholder who is not going to read the formula.
3. The correction fixed a 40-item sample to within 0.4 points and then missed the held-out half by 22.
   Write what that pair of numbers says about your dev set, and what you would change first.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- G. J. Rogan and J. J. Gladen, [Judgmental limitations in the application of automated
  knowledge-based assessment tools](https://www.sciencedirect.com/science/article/pii/S0360136797000862)
  (1998) — the origin of the sensitivity-and-specificity pass-rate correction used here, written for
  automated scorers and exactly as unstable as it sounds when the scorer is close to chance.
- Eugene Yan, [Evaluating the Effectiveness of
  LLM-Evaluators](https://eugeneyan.com/writing/llm-evaluators/) — why the measured bias of an
  LLM judge is reported as a diagnostic alongside the score rather than subtracted from it in
  production.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the habit underneath the last
  fix on this page: when the measurement is not trustworthy enough to publish, say so in words rather
  than publishing the measurement.