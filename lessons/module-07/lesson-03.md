---
id: "07.3"
module: 7
minutes: 16
practice_minutes: 40
prerequisites: ["07.2"]
objectives:
  - Explain self-preference as a judge being kinder to output written by its own model family, and name the situation where it costs you a decision.
  - Design a family-matched paired probe that holds item, rubric, judge and length fixed, and say why a comparison across the judge menu cannot replace one.
  - Read a bias probe against a measured noise floor and against a held-out split, and report what survives both.
volatility: concept
sources:
  - title: "LLM Evaluators Recognize and Favor Their Own Generations (Panickssery, Zhu and Li, 2024)"
    url: https://arxiv.org/abs/2404.13076
  - title: "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (Zheng et al., 2023)"
    url: https://arxiv.org/abs/2306.05685
  - title: "Judging the Judges: A Systematic Investigation of Position Bias in Pairwise Comparative Assessments by LLMs (Wang et al., 2024)"
    url: https://arxiv.org/abs/2406.07791
last_verified: "2026-10-01"
---

# 07.3 · Self-preference

Self-preference is a judge being kinder to answers written by the same model family it is. It matters in one
place above all others — a model migration, where your judge and the thing you are judging are often the
same kind of thing. This lesson builds the probe that isolates it, reads what the probe found, and then does
the harder thing: measures how far two runs of the same judge can differ, so that the number is worth
anything at all.

## Why it matters

You are migrating. The system in production writes answers with a Llama-family model; the candidate is a
Qwen-family model you have been benchmarking all quarter. The eval compares them with an LLM judge, because
that is the judge you already built and validated.

Here is the problem with that setup. The judge is a model. It has an opinion about what a good answer looks
like, and that opinion is partly a function of what it has seen written — which is overwhelmingly text from
its own family. Researchers found that LLM evaluators can identify their own generations and rate them higher
than otherwise equivalent generations from other models. If your judge shares a family with the system you
already shipped, the migration you are running is not a clean comparison. It is a comparison in which one
side is at home.

And the direction of the error is the worst kind: it flatters the incumbent. A migration study that reports
the incumbent as nearly as good as the candidate will be read as *"do not migrate"*, and nobody will go and
look at whether the judge was related to the thing it was judging.

This is the one bias in the course that no prompt edit can reach, and the only fix that costs nothing is
available before you have measured anything at all.

## How it works

### What the bias is, and what it is not

Self-preference is **not** the judge preferring its own output over another judge's output. It is the judge
being more generous in its verdicts on text produced by the same model family it is. The mechanism is
recognition: the judge scores text that looks like text it would have written, and that resemblance is a weak
positive signal that leaks into the verdict even when the content is identical.

It is therefore a property of the **pair** (judge model, system model), not of either alone. Two identical
rubric prompts, run by two different judges, against the same answers, can disagree about quality by a
consistent margin — and the margin is not in either prompt.

### Why comparing two judges does not find it

Because "self-preference" is a comparison, and any comparison between two different judges confounds at
minimum:

- **family** — the thing you are trying to detect;
- **size and capability** — the two judges are almost never the same size;
- **prompt-engineering at that size** — two models of the same nominal class differ in how much help they
  need;
- **decoding defaults** — providers change them between versions.

You can see how badly this goes wrong on this corpus without leaving the lab. The judge menu spans three
families. Run every rubric judge against variant C and read the pass rates, all 57 dev items, greedy:

| Judge | Family | Size | Pass rate on C | TNR |
| --- | --- | --- | --- | --- |
| Qwen3 0.6B | Qwen | 0.6B | **35.1%** | 71.2% |
| Qwen3 1.7B | Qwen | 1.7B | 26.3% | 80.8% |
| Llama 3.2 3B | Llama | 3B | 14.0% | 92.3% |
| Flow-Judge 3.8B | Flow | 3.8B | **10.5%** | 94.2% |
| Prometheus 2 7B | Qwen | 7B | 15.8% | 92.3% |

If family drove pass rate, the three Qwen-family judges would cluster. They do not: they read 35.1%, 26.3%
and 15.8% on the same items, and **the smallest family-matched judge is by far the most generous of the
five.** Size dominates, family does not show a clean signal, and anyone who reads "same family ⇒ kinder" off
this table is reading it off a confounded column.

### The paired probe

The only clean measurement is one where **everything but family is identical** — which means the same judge,
so the two arms of the probe are the same recorded configuration except for the family term:

- **System A — handbook-tuned prompt.** A different model family from the judge.
- **System B — generic prompt.** A different model family from the judge.
- **System C — small model, no retrieval.** **The same family as the judge.**

If the probe is built correctly the effect should land on C and leave A and B alone. That is the prediction,
and it is what the panel's own caption now asks you to check.

### What it found

`Qwen3 1.7B · Rubric · 0 shots`, against `Qwen3 1.7B · Rubric · 0 shots · self-preference`. Same judge, same
prompt, same 0 shots, same $0.02244 a call, same 380 ms. All 57 dev items, greedy verdict:

| System | Plain judge | Self-preference judge | Change | Items changed | Paired sign test |
| --- | --- | --- | --- | --- | --- |
| A — handbook-tuned | 54.4% (31/57) | 52.6% (30/57) | −1.8 points | 17: 8 newly passed, 9 newly failed | p = 1.00 |
| B — generic prompt | 43.9% (25/57) | 47.4% (27/57) | +3.5 points | 20: 11 newly passed, 9 newly failed | p = 0.82 |
| **C — small model** | **26.3%** (15/57) | **36.8%** (21/57) | **+10.5 points** | 22: 14 newly passed, 8 newly failed | **p = 0.29** |

The shape is exactly what the probe predicts: the effect is on C, the only system from the judge's family,
and A and B are flat or slightly better. **But read the p-value before you read anything else: at 57 items
and one greedy sample, +10.5 points is not evidence of anything.** That is the first half of this lesson and
it matters more than the table.

### The signature: only C's true-negative rate falls

Pass rate is a weak way to see a bias, because a judge can gain passes in two different ways. The confusion
tables separate them, and this is where the effect announces itself:

| System | TPR, plain → self | TNR, plain → self | False alarms | Kappa, plain → self |
| --- | --- | --- | --- | --- |
| A | 83.3% → 83.3% | 77.8% → **81.5%** | 6 → 5 | 0.61 → **0.65** |
| B | 80.0% → **100.0%** | 75.7% → **81.1%** | 9 → 7 | 0.53 → **0.75** |
| **C** | 100.0% → 100.0% | 80.8% → **69.2%** | 10 → **16** | 0.42 → **0.28** |

A and B get *better* on every one of those measures. C is the only row where the true-negative rate falls, the
only row where false alarms rise, and the only row where kappa drops. A bias that shows up as higher accuracy
and a higher pass rate is a bias in your favour; a bias that shows up as **lower TNR on one family and higher
TNR on the others** is the thing you cannot argue with, because the judge got worse specifically where it
should have been most reliable.

### Measure the floor before you claim the bias

This judge records five samples per item. Draw one sample per item, twice, independently, and you have
simulated two single-verdict runs of the identical judge on the identical 57 items. Over 20,000 such draws
with `Qwen3 1.7B · Rubric · 0 shots`:

| Two independent single-sample runs, 57 dev items | A | B | C |
| --- | --- | --- | --- |
| Median gap in pass rate | 5.3 points | 5.3 points | 5.3 points |
| 90th percentile | 10.5 | 12.3 | 10.5 |
| **95th percentile** | **12.3** | 14.0 | **14.0** |
| 99th percentile | 17.5 | 19.3 | 17.5 |

**Two runs of this judge differ by 12 to 14 points of pass rate on 57 items about one time in twenty.** The
observed +10.5 on C sits at the 90th percentile of that distribution. So the honest reading of the table
above is not "the bias is 10.5 points". It is:

> The probe has the right shape, and at 57 items with one sample per item that shape is not yet enough to
> size the effect.

You can see the same thing without any simulation. Across all 94 items, the greedy verdict disagrees with a
single temperature sample on **32.2%** of the 376 item-sample pairs for this judge on system C — nearly a
third of the time, one verdict from this judge is not the verdict it would have given at temperature.

### What aggregation does to the number

Now put five repeats and a majority vote under both arms — the setting from [7.5](lesson-05.md) — and rerun
the same comparison on the same 57 dev items:

| Repeats | Plain judge | Self-preference judge | Change | False alarms | TNR |
| --- | --- | --- | --- | --- | --- |
| 1 (greedy) | 26.3% | 36.8% | +10.5 (p = 0.29) | 10 → 16 | 80.8% → 69.2% |
| 2 + majority | 7.0% | 21.1% | +14.0 (p = 0.022) | 1 → 7 | 98.1% → 86.5% |
| 3 + majority | 14.0% | 33.3% | +19.3 (p = 0.013) | 3 → 14 | 94.2% → 73.1% |
| 5 + majority | **8.8%** | **35.1%** | **+26.3 (p = 0.00006)** | **0 → 15** | **100.0% → 71.2%** |

Two things happen, and both are worth a lesson on their own.

**The effect gets bigger when you remove the noise.** That is not what a bias normally does — most effects
shrink under aggregation, because the noise was masking nothing. Here the greedy verdict on a weak judge
scoring a bad system is mostly noise: the plain judge's five samples collapse to a pass rate of 8.8% with a
*perfect* true-negative rate, catching **all 52** real failures. The family term shifts every sample on the
same items, so once you stop listening to individual samples the shift survives intact, and the gap widens
from 10.5 to 26.3 points.

**The five-repeat result is one-directional.** Fifteen items change, and **all fifteen move toward pass —
none moves toward fail.** On the plain judge's five repeats the confusion table is `tp 5, fp 0, fn 0, tn 52`:
kappa 1.00, TPR 100%, TNR 100%. On the self-preferring judge's it is `tp 5, fp 15, fn 0, tn 37`: kappa 0.30,
TPR 100%, TNR 71.2%. The same five good answers are passed either way, fifteen extra failures are waved
through, and the only thing that changed is a family term inside the judge.

> [!CAUTION]
> > A kappa of 1.00 with `fp 0` is not a triumph, it is the shape [5.4](../module-05/lesson-04.md) tells you
> > to distrust: with zero disagreements there is nothing left in the bootstrap to vary. Read the TPR and
> > TNR cells, not the kappa, whenever one arm of a comparison reads 1.00.

### And on the held-out split, it does not reproduce

The same two arms, the same five repeats, the **37 items you did not tune against**, system C:

| Repeats | Plain judge | Self-preference judge | Change | False alarms | TNR | Items changed |
| --- | --- | --- | --- | --- | --- | --- |
| 1 (greedy) | 35.1% | 32.4% | **−2.7** | 10 → 9 | 70.6% → 73.5% | 13 |
| 5 + majority | 16.2% | 18.9% | **+2.7** | 3 → 4 | 91.2% → 88.2% | 5: 3 pass, 2 fail |

Five items change, three one way and two the other, and the sign is not even stable across repeat counts. On
dev the effect added 15 false alarms out of 52 failures; on the split you were not allowed to tune, it added
one out of 23.

That is the finding, and it is the same finding every other measurement in this course has produced: **57
items bought a large, correctly-signed, one-directional dev result that the held-out split does not confirm.**
The probe is built right. The evidence is not yet strong enough to quote a number from.

## Show me

The preset opens the lab on `Qwen3 1.7B · Rubric · 0 shots` with the self panel. The scoreboard above it is the
baseline judge on variant A over a random draw of 40 dev items at seed 7: judge pass rate **57.5%**
(42.2%–71.5%), kappa **0.60** (0.34–0.84, *moderate*), TPR **85.7%**, TNR **73.7%**, accuracy **80.0%**,
confusion `tp 18, fp 5, fn 3, tn 14`. The cost panel prices that at **$0.02244 a call, 380 ms** — $0.8976
for 40 calls.

The self panel below it does **not** use your sample knob. It always scores **all 57 dev items**, one greedy
verdict, both arms of the probe:

| System | Judge, no self-preference | Judge, self-preference | Change |
| --- | --- | --- | --- |
| A — handbook-tuned prompt | 54.4% | 52.6% | −1.8 pts |
| B — generic prompt | 43.9% | 47.4% | +3.5 pts |
| C — small model, no retrieval | 26.3% | 36.8% | **+10.5 pts** |

Its caption states the expectation in advance: *"Variant C was written by a Qwen-family model and the judge
here is Qwen 1.7B, so the effect should land on C and leave A and B alone. If all three rows move together,
the probe is measuring run-to-run noise, not a bias."* That last sentence is the most useful thing on the
panel. **A probe that tells you what it should look like is a probe you can check; a probe that only reports
what it found is a chart.**

Two other controls on the same page belong to this lesson:

- **Answer being judged.** Switch it to `C — small model, no retrieval` and read the scoreboard tiles above
  the panel. Those tiles *are* your own judge on your own sample; the panel is all 57 dev items. Two
  different measurements, and reading one as the other is the easiest mistake on this page.
- **Repeats.** Turn it from 1 to 5 and come back to the panel. The panel will not change — it is fixed at the
  greedy verdict — which is itself the lesson: the panel is the first move, and Repeats is the second.

> [!NOTE]
> > Every verdict in the panel is a recorded run of the lab's seeded educational model, filed under the labels
> > `Qwen3 1.7B · Rubric · 0 shots` and `Qwen3 1.7B · Rubric · 0 shots · self-preference`. They are not
> > measurements of Qwen3 in the wild, and the family term is a parameter in the lab's behaviour model, not
> > an observation about any real model. The real phenomenon this lesson is about is reported in the source
> > at the bottom.

## Try it

**Predict first**, before opening the page:

1. The judge is Qwen 1.7B. Three of the systems come from other families and one — system C — comes from the
   judge's own family. Which row of the panel should move, and which two should not?
2. If the effect is real, a pass rate can rise for two different reasons. Name them, and say which column of
   the confusion table tells them apart.
3. Two runs of this judge on 57 items differ by about 13 points of pass rate 95% of the time. The panel
   shows +10.5 on C. Is that a bias, a coincidence, or something else?

[Simulation: judge-lab](../../simulations/judge-lab/index.html?preset=self)

1. **Read the panel against its own caption.** Before you look at the change column, write down which row the
   caption says should move. Then look. If all three rows moved together you would be looking at noise, and
   the caption tells you so — run that check first, every time.
2. **Find the signature, not the headline.** For each of the three systems, work out the false alarms and the
   true negatives from the pass rate and the tiles, then fill in this table for yourself:

   | System | TPR, plain → self | TNR, plain → self | False alarms | Kappa |
   | --- | --- | --- | --- | --- |
   | A | | | | |
   | B | | | | |
   | C | | | | |

   C should be the only row where TNR falls and kappa falls. Then write down which single number you would
   give a stakeholder if you only had one, and why it is not the pass rate.
3. **Estimate your own noise floor.** Switch to system C, note the scoreboard, click **Pin as A**, move the
   seed, read the tiles, move it back, and repeat. Count how many of the 40 verdicts changed when only the
   seed changed. Compare that to the 15 items the panel moves at five repeats. You have just measured, by
   hand, the width of the distribution the panel's single verdict is one point of.
4. **Aggregate and watch the gap widen.** Set Repeats to 1 and record the tiles on C. Set them to 5 and
   record them again. Predict first: does the self-preference gap get bigger or smaller when you average
   five samples instead of taking one? Then check the direction of the changed items, not just the size.
5. **Do the measurement the menu cannot do.** Pick any two judges from the Judge dropdown that differ in
   family, score system C with both, and write down the difference. Then state, in one sentence, why that
   number tells you nothing about self-preference — and what it *does* tell you.

## Break it

**Quote the greedy +10.5.** The panel's last column says `+10.5 pts` on system C, the panel is called
self-preference, and a dashboard tile is a dashboard tile. Ship the migration study on that basis. The lie has
a name: **a bias reading has to beat the noise floor before it is a bias**, and this one does not — 12 to 14
points is what two runs of this judge produce one time in twenty on 57 items, and the sign test says p = 0.29.
You have a hypothesis with a mechanism behind it and a number that will not support it.

**The subtler break is quoting the five-repeat number and dropping the split.** `+26.3 points`, fifteen of
fifteen items toward pass, `p = 0.00006`, TNR 100% → 71%. Every one of those figures is exact and none of them
survives the 37 items you were not allowed to tune, where the same comparison moves five items and lands at
+2.7. The lie: **a bias measured on the set you tuned on is a description of that set.** The shape held on
both splits; the size held on neither consistently. Reporting the size without the split is how a team ends up
holding a number it cannot defend in the one meeting where it matters.

**The third break is skipping straight to the ladder.** Go to the menu, find the same-family judges, compare
their pass rates on C, and conclude that Qwen3 0.6B is self-preferring because it passes 35.1% where
Flow-Judge 3.8B passes 10.5%. You have measured size, which is confounded with everything, and called it
family. The probe exists precisely so you do not have to make that inference.

## Fix it

Four changes, in increasing order of how much they cost:

1. **Measure your own noise floor, once, before you claim anything.** Run the identical judge configuration
   twice on the same items and record the gap in pass rate and kappa. Here that is a median of 5.3 points and
   a 95th percentile of 12 to 14 points on 57 items for this judge. It costs one extra run per judge, it
   takes minutes, and every bias number, size claim and judge comparison you report afterwards is measured
   against it.
2. **Build the probe as a paired one, and make it family-matched.** Same judge, same items, same rubric, same
   decoding; two arms differing only in the family term, with at least one system from the judge's family and
   at least one from another. The probe is only as good as the variable it holds still — if you cannot
   produce a length-matched, label-matched family pair, you cannot attribute the difference to family.
3. **Report the TNR row, not the pass rate.** A and B got *better* under the bias; C got worse, and the only
   measure that shows it is the true-negative rate. `C: TNR 80.8% → 69.2%, false alarms 10 → 16` is a sentence
   a release manager can act on. `+10.5 points on C` is not.
4. **If you are migrating, pick a judge from a different family than the candidate, and do not wait for the
   measurement.** This is the one intervention on the list that needs no experiment to justify. The evidence
   above says the effect is real in shape and unsettled in size; the defence costs one line of config and
   removes the confound whether or not you ever settle it. Report the constraint honestly: *"our judge shares
   a family with the incumbent, so the incumbent's score is an upper bound."*

And the ceiling: a family prior is a property of the model behind the judge. If you cannot get a judge from
another family, the field-level design from [5.1](../module-05/lesson-01.md) is what is left — *"does the
answer name the handbook section it came from?"* is a question with nowhere for a family prior to operate.

## How do I know it works?

**Challenge, on dev.** Write the probe's targets before you run anything:

- **The effect lands on the family-matched system and only there.** C moves +10.5 points, A moves −1.8 and B
  +3.5. A probe where all three rows move together is measuring noise — the panel's caption says so, and you
  should check that first.
- **Only the family-matched system's TNR falls.** C: 80.8% → 69.2%, false alarms 10 → 16. A: 77.8% → 81.5%.
  B: 75.7% → 81.1%. If A and B also degrade, you have not measured a family prior.
- **The gap clears your noise floor.** On one greedy sample it does not: +10.5 against a 95th-percentile floor
  of 14.0 on system C. At five repeats with a majority vote it does, by a wide margin: +26.3, fifteen of
  fifteen items toward pass, p = 0.00006.
- **The effect's size and the noise floor written down together**, so a reader can check one against the other
  without rerunning anything.

**Then one held-out validation**, and it fails, so the honest sentence is the one you write. The 37 items you
did not tune against, system C, five repeats: plain **16.2%** (TNR 91.2%, 3 false alarms), self-preference
**18.9%** (TNR 88.2%, 4 false alarms). Five items change, three one way and two the other, p = 1.00. On dev
the same comparison added 15 false alarms out of 52 failures; on the held-out split it added one out of 23.

**The shape held. The size did not.** That is the correct conclusion to carry out of this lesson, not a
disappointment to be explained away:

1. The probe is built correctly — you can tell, because it predicted where the effect would land and the
   effect landed there.
2. The dev effect is large, one-directional, and significant once you aggregate.
3. The held-out split does not reproduce it at that size.
4. So the effect is a **well-supported hypothesis**, not a measurement you can quote a number from, and the
   fix that costs nothing is not "measure it harder first" — it is **change the judge**.

If you want the number, the next step is not another prompt tweak. It is more items on a paired probe with
length-matched answers, and a report that says how many you would need. Until then, run the migration with a
judge from another family and write the constraint into the write-up.

## Use / don't use

**Do** measure the noise floor before you compare anything. One extra run of your judge on your dev set,
recorded permanently, is the cheapest diagnostic in this course and the one most often skipped.

**Do** pick a judge from a different family than the candidate when you are migrating models. It is one field
in a config, it is usually cheaper than the judge you already have, and it removes the one confound that no
amount of averaging removes.

**Do** run a family-matched probe — once per judge, on a frozen calibration set — and report the result even
when it is null. "No self-preference measurable on 57 items" is a legitimate and useful thing to have written
down.

**Don't** run two judges and average them to "cancel out" a family prior. Two judges from the same family have
the same prior; two from different families give you two independent measurements of the same thing, which is
a different claim.

**Don't** upgrade your judge to escape this. Family and size are confounded across every model menu ever
shipped — the 0.6B and 7B judges here share a family and read system C at 35.1% and 15.8% — and nothing on a
57-item set separates them.

What teams actually do: keep one frozen calibration set of hand-labelled items; run the *identical* judge
configuration twice at the start of a migration to establish the floor; run a family-matched probe per judge
before promoting it; and hold the judge family constant across every comparison, so the thing you are testing
changes exactly one thing.

## Reflect

1. Your migration study puts a family-X incumbent at 90% and a family-Y candidate at 70% under a family-X
   judge, with a measured noise floor of 13 points on 57 items. Write the sentence you would put at the top of
   the write-up, and the one you would put at the bottom.
2. Dev gives +26.3 points, fifteen of fifteen items toward pass, `p = 0.00006`. The held-out 37 give +2.7 and
   five items. Write the paragraph that reports both, in a form you would sign your name to, and say what you
   would have to change about the experiment to make the number quotable.
3. On this corpus the three Qwen-family judges read system C at 35.1%, 26.3% and 15.8%. Write the one
   sentence that explains why the judge menu cannot answer the self-preference question, and name the single
   control in the lab that can.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Arjun Panickssery, Sato Zhu and Yong Li, [LLM Evaluators Recognize and Favor Their Own
  Generations](https://arxiv.org/abs/2404.13076) (2024) — the real measurement of self-preference, and the
  paper this lesson is about.
- Lianmin Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot
  Arena](https://arxiv.org/abs/2306.05685) (2023) — the reference design, and the paper that established how
  much of a judge-vs-human comparison depends on which model is doing the judging.
- Peiyi Wang et al., [Judging the Judges: A Systematic Investigation of Position Bias in Pairwise
  Comparative Assessments by LLMs](https://arxiv.org/abs/2406.07791) (2024) — the same discipline applied to
  a second bias: hold the content fixed, change one thing, and see whether the verdict follows.