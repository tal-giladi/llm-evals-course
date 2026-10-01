---
id: "03.3"
module: 3
minutes: 16
practice_minutes: 40
prerequisites: ["03.2"]
objectives:
  - Compute ROUGE-L precision, recall and F by hand on a short example, and say what each half rewards.
  - Show, on recorded items, that an overlap metric can pass output which is not valid at all.
  - Choose a numeric tolerance per field, and justify the choice from the consequence of the error.
volatility: concept
sources:
  - title: "ROUGE: A Package for Automatic Evaluation of Summaries (C.-Y. Lin, 2004)"
    url: https://aclanthology.org/W04-1013/
  - title: "SQuAD: 100,000+ Questions for Machine Comprehension of Text (Rajpurkar et al., 2016)"
    url: https://arxiv.org/abs/1606.05250
  - title: "Hamel Husain — Evals FAQ"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 03.3 · Reference metrics and their traps

The metrics you will meet next are ROUGE-L and token F1, and this lesson is the one where you find out
that on a task with a known right answer they are measuring the wrong thing. The failure is not that
they are badly implemented. It is that they reward which words appear, and a longer, more confident,
factually wrong answer scores better than a short correct one.

## Why it matters

A team has a recipe extractor. Their strictest check says 1 of 20 outputs is exactly right, a
5.0% pass rate, and the feature looks close to unusable. Someone remembers that ROUGE-L is the
standard summarisation metric and swaps it in. The scoreboard reads **92.2%**, the dashboard is green,
and two weeks of work look justified.

Now they change the prompt. ROUGE-L moves from 0.922 to 0.931. They ship it, write it up as an
improvement, and move on.

What happened is that the team replaced a measurement of the answer with a measurement of its
vocabulary, and the second measurement improves when the model talks more. Nothing about whether a
recipe was extracted correctly entered into the number. The green scoreboard did not become less
reliable after the change; it had never been reliable, and the improvement they shipped is a change in
wording. A metric like that is worse than no metric, because unlike "we do not know" it produces a
confident number that survives review.

This is the same failure as [3.1](lesson-01.md), wearing better clothes: a number that reads as
quality while measuring something else.

## How it works

**ROUGE-L** takes the length of the longest common subsequence of tokens between candidate and
reference, and turns it into two rates:

$$\text{precision} = \frac{\text{shared}}{\text{candidate tokens}}, \qquad \text{recall} = \frac{\text{shared}}{\text{reference tokens}}$$

$$F = \frac{2 \cdot \text{precision} \cdot \text{recall}}{\text{precision} + \text{recall}}$$

**Token F1** is the same formula with "shared" meaning bag-of-words overlap rather than a subsequence.
Both are functions of **which tokens appear**, not of what they mean. A number in the wrong place is
one token; the sentence around it saying the wrong thing is many tokens, and the wrong tokens cost
precision while the right ones cost nothing at all once they have been counted.

### Worked example: `r02 Tomato soup`

This is a real item from the lab. The reference object is 60 tokens. Variant C's output is the same
object wrapped in a sentence of chat: 104 tokens. The whole reference is a subsequence of the output,
so the shared length is 60 and:

- precision = 60 ÷ 104 = 0.577
- recall = 60 ÷ 60 = 1.000
- F = 2 × 0.577 × 1.000 ÷ 1.577 = **0.732**

Now delete the chat — the same answer, the same facts, 60 tokens — and the numbers are 1.000, 1.000,
**1.000**.

Look at what the recall half did. It read 1.000 in both cases. A coverage metric, asked "does this
answer contain everything in the reference?", says this answer is perfect twice, and it is right both
times: every reference token is present. The precision half is what registered the 44 tokens of
filler, and it charged 0.268 of the score for them. **Verbosity is punished only by precision.** That
asymmetry is the whole trap, and it is why a metric that reports a single F number tells you about a
different property than the one you care about.

### The trap, run for real

Turn on **Break the metric** on the lab page. It doubles the first ingredient's quantity and appends
two sentences of confident filler. On variant C, all twenty items:

| | ROUGE-L | precision | recall |
|---|---|---|---|
| Real outputs | **0.922** | 0.894 | 0.974 |
| Padded outputs | **0.755** | 0.633 | **0.974** |

Read the recall column twice. **0.974 before, 0.974 after.** Every reference token was already present
in the unpadded output, so there was no recall left for the corruption to buy. Corrupt the answer as
hardly as you like — wrong quantities, confident nonsense — and a coverage metric scores it
identically, to four decimal places, to the clean version.

Why exactly zero movement? The filler is 37 tokens, and against a typical reference it shares exactly
six of them: `the`, `and`, `the`, `the`, `and`, `the`. Stopwords that were already present. It adds
denominator and nothing to the numerator, so precision falls and recall does not move.

Be honest about what the F-measure did here: it **fell**, 0.922 to 0.755, and it fell because of
precision. If your eval had shipped the recall half on its own — a coverage score, which is a real
thing people build — the corruption would have cost it **0.000**. The F-measure caught the padding
only because the precision half was in the room.

### The three numbers that end the argument

Twenty items, variant C, nothing changed between the columns:

| Metric | Reads |
|---|---|
| Exact match on the raw string | 1 of 20 — **5.0%** (0.9%–23.6%) |
| JSON parses | 16 of 20 — **80.0%** (58.4%–91.9%) |
| ROUGE-L, mean score | **92.2%** (72.7%–98.1%) |
| Objects actually equal to the reference | 6 of 20 — **30.0%** (14.5%–51.9%) |

Now set a threshold, because every overlap metric in production has one. At **ROUGE-L ≥ 0.90, 15 of
the 20 pass**. Which fifteen? They include **all four items that are not valid JSON at all**:

| Item | ROUGE-L | What the parse check says |
|---|---|---|
| `r01` Sourdough loaf | 0.975 | Output is not JSON at all. |
| `r03` Banana bread | 0.969 | Output is not JSON at all. |
| `r07` Roast chicken | 0.967 | Output is not JSON at all. |
| `r08` Mushroom risotto | 0.971 | Output is not JSON at all. |

At 0.95, thirteen of twenty pass and all four still do. At 1.00, one passes and none of the four do.
Somewhere in the middle of that range is every threshold anyone has ever picked, and at it the metric
certifies four strings that a strict JSON parser refuses.

One more number worth knowing: on these twenty items **token F1 and ROUGE-L are identical**, both
0.922, and identical on every individual item. That is not a coincidence — the surplus tokens here sit
outside the reference's subsequence, so the bag and the sequence agree. It means adding token F1
alongside ROUGE-L to make the suite look thorough buys you one opinion, not two.

### Numeric tolerance, the other trap

A number check is `|candidate − reference| ≤ tolerance`, and there are two ways to set the tolerance.
The lab's function, exactly:

```js
const allowed = relative ? Math.abs(ref) * tol : tol;
return Math.abs(pred - ref) <= allowed ? 1 : 0;
```

Relative divides by the reference's **magnitude**; absolute divides by nothing. Both are correct
implementations and they answer different questions. Run them over real values from this dataset — a
45-minute bake and a ten-hour prep:

| Field | Reference | Output | Relative 1% | Absolute 5 |
|---|---|---|---|---|
| `cook_minutes` | 45 | 46 | **fail** (allowed 0.45) | pass |
| `cook_minutes` | 45 | 50 | fail (allowed 0.45) | **pass** |
| `prep_minutes` | 600 | 610 | **fail** (allowed 6.00) | fail |
| `prep_minutes` | 600 | 612 | **fail** (allowed 6.00) | **pass** |

Read the first and third rows. A **minute** off a 45-minute bake is rejected by the relative check,
and **twelve minutes** off a ten-hour prep is rejected too. Being wrong by 2% is being wrong by the
same amount, and the relative check cannot tell you which of the two is the bigger problem, because it
is a statement about the reference's magnitude and not about the field's consequences. Meanwhile the
absolute check passes both, including the twelve minutes.

The temperature case shows why you have to choose deliberately rather than by default. 180 °F is
82.2 °C, which is 355.4 K; 350 K is 76.9 °C, which is 170.3 °F. **180 and 350 are the same oven.**
Compared as bare numbers they differ by 170 — 48.6% of 350 — and any tolerance you like catches that
instantly. Compared against the true equivalent, 350 K and 355.4 K, they differ by 5.4, which is 1.5%,
and a 2% relative tolerance waves a unit change straight through. Both comparisons are correct; the
question is which question you are asking. That choice is a decision about what the field is for, and
it belongs in your criterion, not in a constant you typed once.

And here is the part that ties this lesson back to the others. The lab's numeric panel reads
**0.0% (0.0%–16.1%) on every tolerance from 0.001 to 0.2, relative and absolute, on all three
systems** — including variant A, which is exactly right twenty times out of twenty. The reason is
that `Number()` applied to a whole JSON object is `NaN`, `Number.isFinite(NaN)` is false, and the
function returns 0 before comparing anything. **The knob moves and the number does not.** A metric
that measures nothing looks exactly like a metric that works, from every tile on the scoreboard;
the only way to tell them apart is to read what the check is comparing.

## Show me

The rougetrap preset opens on **ROUGE-L**, **variant C**, and with **Break the metric already turned
on**. The scoreboard reads **75.5% (53.6%–89.1%)** with twenty failing items, and each item's detail
line gives you both halves, for example `r04 Chicken curry`:

> ROUGE-L 0.77 — precision 0.63, recall 0.98.

and `r05 Pesto`:

> ROUGE-L 0.74 — precision 0.59, recall 1.00. Low precision: lots of tokens that are not in the
> reference.

The page is deliberately showing you precision and recall separately, because the single mean would
have hidden the only half that moved. Click **Show the real outputs** and the same twenty items read
**92.2% (72.7%–98.1%)**, with every precision up and every recall identical.

Two things on that screen are worth naming out loud. First, the tile is labelled **Pass rate** and
reads 75.5%, when what has been computed is a mean F-measure with no threshold in it — nothing here
has passed or failed yet, and the label is doing half a word of work it has not earned. Second, the
failing-items panel is not showing you failures: at this metric every one of the twenty items is
"failing" only because a continuous score is not 1.00. Read the per-item detail line; that is where
the information is.

## Try it

**Predict first.** On paper, before you open the page:

1. Exact match on variant C reads 5.0%. What does ROUGE-L read on the same twenty items — and which
   specific four items will it score above 0.90 despite them being unparseable?
2. You corrupt an answer and make it longer. Which half of ROUGE-L moves, and which half cannot move
   at all once the answer already contains every reference token?
3. The numeric metric reads 0.0% on variant A, which is exactly right twenty times out of twenty.
   What does that tell you about the number, and what does it not tell you about the system?

[Simulation: code-checks](../../simulations/code-checks/index.html?preset=rougetrap)

1. **Read the two halves before the mean.** On the padded run, read the detail line for `r05` and
   `r06`. Then click Show the real outputs and read them again. Write down precision before and after
   for three items and recall before and after for the same three. Your recall column will be
   identical, and finding that out yourself is the lesson.
2. **Count how many of the items that are not JSON pass your threshold.** Switch to JSON parses,
   variant C: four items fail. Switch to ROUGE-L and check the scores of `r01`, `r03`, `r07` and
   `r08` — 0.975, 0.969, 0.967, 0.971. Write down how many threshold values between 0 and 1 let all
   four through, then check 0.90 and 0.95 on the page.
3. **Do the r02 arithmetic yourself.** With the lab open on variant C, open `r02 Tomato soup` and
   count: the reference is 60 tokens, the output is 104. Compute 60 ÷ 104, 60 ÷ 60, and the harmonic
   mean of the two. Then find the JSON object inside that output, count 60 tokens again, and explain
   in one sentence why removing 44 tokens of chat moved the score by 0.268 and the recall by 0.000.
4. **Compare the two metrics and find out whether you have two opinions.** Run token F1 and ROUGE-L on
   variant C, both real. Both read 92.2%. Read the metric definitions in the page source and write
   down why they agree exactly on these items, and what kind of output would make them disagree.
5. **Use the numeric knob and read what it is comparing.** Set Metric to Numeric tolerance and drag
   Allowed error from 0.001 to 0.2, flipping between relative and absolute. It never leaves 0.0%. Now
   do the arithmetic by hand on a real field: reference `cook_minutes` 45, output 50, relative 5% —
   allowed 2.25, gap 5, so fail; absolute 5, so pass. Then decide, in writing, which of those two
   verdicts your feature wants for a bake that is five minutes short.

## Break it

Set the threshold in your head at **0.90** and read the scoreboard as if it were a release gate.
**15 of 20 pass — 75.0%, interval 53.1%–88.8%** — and the fifteen include four items that are not
valid JSON. Set it at 0.60 and it is 20 of 20: a perfect score on a system whose output is unparseable
a fifth of the time and whose objects match the reference 6 times in 20.

The lie has a name and it is this: **a mean overlap score, presented as a pass rate, is a measurement
of the answer's vocabulary that everyone reads as a measurement of the answer.** The tile says "Pass
rate". Nobody has set a threshold. The 92.2% and the 5.0% are both computed from the same twenty
strings, and the one on the dashboard is the one that cannot fail.

A quieter version of the same break costs nothing: switch the metric to *Contains substring*. The
scoreboard returns to a clean 100.0% (83.9%–100.0%) on the system that is wrong fourteen times out
of twenty. Somewhere between 0.0% and 100.0% is the truth about this feature, and none of the five
metrics available to you points at it.

## Fix it

Three changes, all of them visible on the same twenty items:

1. **Never let an overlap metric be the only check, and never let it gate a release.** Run ROUGE-L
   next to a decidable one. Variant C reads **92.2%** on ROUGE-L and **80.0%** on JSON parses and
   **5.0%** on exact match. One number invites a reading; three disagreeing numbers force one, and
   the disagreement is where the work is.
2. **Report precision and recall separately, always.** The mean hides the entire mechanism. The padded
   run's real finding is "precision 0.894 → 0.633, recall 0.974 → 0.974", and that sentence tells you
   the model got wordier, that the corruption is invisible to coverage, and that any recall-based
   alert you have shipped has been blind this whole time.
3. **Set tolerance per field, from the consequence.** `cook_minutes` and `prep_minutes` get different
   numbers, and both numbers are written next to the field in the schema where the next person will
   read them. Then go and fix the check that reads 0.0% everywhere: it is comparing whole objects as
   numbers, and until it compares `obj.ingredients[0].qty` it is a check that never ran.

None of those three made the system better. They made the number say something about the thing you
are building.

## How do I know it works?

**Challenge, on dev.** Variant C, twenty items, three targets:

- **Every overlap number is reported next to a decidable check.** A ROUGE-L figure with no parse rate
  beside it does not count as a result, because the whole failure mode here is a lone number that
  looks fine.
- **No threshold you choose may pass an unparseable item.** Read the four failing items from the JSON
  parses run, note their ROUGE-L scores — 0.975, 0.969, 0.967, 0.971 — and set your bar at or above
  0.972 or drop the threshold idea entirely. A threshold that admits text a parser rejects is not a
  threshold, it is a rounding error with a number attached.
- **You can state, for each numeric field, the tolerance and the reason.** "Relative 1% on
  `prep_minutes` because ten hours is a long job and two percent of it is not" passes. "Relative 1%
  because it is the default" does not.

**Validation, once.** Switch the system from variant C to variant B. Variant B's outputs are fenced,
so they score differently for a reason that has nothing to do with content quality. Prediction before
you look: ROUGE-L falls slightly — B reads **97.6%** against C's 92.2% — while exact match rises to
20.0% and the true correct rate is 75.0%. If your metric still ranks B well above C after you switch,
you have measured the wrapper. Overlap metrics reward a candidate that looks like the reference, and a
code fence is not a content error; that is why this metric belongs in a suite, next to the checks that
know the difference.

## Use / don't use

**Use ROUGE-L for** the job it was built for: summarisation and translation, where there is no single
right answer, where you are tracking drift over thousands of items, and where a human comparison would
be both slow and unstable. There, the fact that it rewards overlap is not a bug — a summary that
covers the reference's content *should* score well, and the number is a reasonable cheap proxy for
"did the model get to the same material". Track it over time and read it next to a human spot-check;
that is a legitimate eval.

**Don't use it for** anything decidable. Extraction, classification, tool calls, anything with a schema
behind it — there, the answer is known and a code check is both cheaper and sharper. And do not report
it alone: a single F number on a dashboard is indistinguishable from a quality number, and the failure
appears the first time someone uses it to gate a release.

**Do use token F1** in reading-comprehension work, where it is the standard metric for exactly the same
reason — a reference span and a predicted span, both checkable against a source — and read it with the
same caveat: it does not know which of the two spans was correct, only how much they look alike.

In production these are free, so the cost argument never applies. What does apply is drift: a
reference-based metric scores whatever your reference says is right, and a reference that nobody has
re-read in six months is a frozen opinion. Overlap metrics age badly in a specific way — they keep
reporting a stable number while the reference behind them quietly stops being correct.

## Reflect

1. The padded run moved precision from 0.894 to 0.633 and left recall at 0.974. If you had shipped a
   coverage score instead of an F-score, what would your dashboard have shown on the day you shipped
   the wrong quantities?
2. Variant C reads 92.2% on ROUGE-L, 80.0% on JSON parses, 5.0% on exact match, and 30.0% on "objects
   equal to the reference". Which of those four numbers would you put in front of a stakeholder, and
   what would you have to write underneath it?

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- Chin-Yew Lin, [ROUGE: A Package for Automatic Evaluation of
  Summaries](https://aclanthology.org/W04-1013/) (2004) — the LCS-based F-measure, built for
  summarisation, where there is deliberately no single correct output to compare against.
- Rajpurkar et al., [SQuAD: 100,000+ Questions for Machine Comprehension of
  Text](https://arxiv.org/abs/1606.05250) (2016) — token-level F1 as the standard reading-comprehension
  metric, and a setting where the prediction is a span against a known source rather than free text.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the ordering this course keeps:
  reach for the check that can decide before the one that sounds reasonable.