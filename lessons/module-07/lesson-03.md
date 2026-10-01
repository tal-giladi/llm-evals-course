---
id: "07.3"
module: 7
minutes: 15
practice_minutes: 35
prerequisites: ["07.2"]
objectives:
  - Explain self-preference as a judge being kinder to output written by its own model family, and name the situation where it costs you a decision.
  - Design a family-matched probe that holds item, rubric and length fixed, and say why a confounded comparison cannot replace one.
  - Measure the run-to-run noise floor of your own judge and hold every later bias reading against it.
volatility: concept
sources:
  - title: "LLM Evaluators Recognize and Favor Their Own Generations (Panickssery, Zhu and Li, 2024)"
    url: https://arxiv.org/abs/2404.13076
  - title: "Judging the Judges: A Systematic Investigation of Position Bias in Pairwise Comparative Assessments by LLMs (Wang et al., 2024)"
    url: https://arxiv.org/abs/2406.07791
  - title: "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (Zheng et al., 2023)"
    url: https://arxiv.org/abs/2306.05685
last_verified: "2026-10-01"
---

# 07.3 · Self-preference

Self-preference is a judge being kinder to answers written by the same model family it is. It matters in one
place above all others — a model migration, where your judge and the thing you are judging are often the
same kind of thing — and the cheapest defence is picking a judge from a different family. This lesson also
does something the other bias lessons did not have to: it measures the noise floor, so that you can tell a
bias from a re-roll.

## Why it matters

You are migrating. The system in production writes answers with a Llama-family model; the candidate is a
Qwen-family model you have been benchmarking all quarter. The eval compares them with an LLM judge, because
that is the judge you already built and validated.

Here is the problem with that setup. The judge is a model. It has an opinion about what a good answer looks
like, and that opinion is partly a function of what it has seen written — which is overwhelmingly text from
its own family. Researchers found that LLM evaluators can identify their own generations and rate them higher
than otherwise equivalent generations from other models. If your judge shares a family with the system you
already shipped, then the migration you are running is not a clean comparison. It is a comparison in which
one side is at home.

And the direction of the error is the worst kind: it flatters the incumbent. A migration study that reports
the incumbent as nearly as good as the candidate will be read as *"do not migrate"*, and nobody will go and
look at whether the judge was related to the thing it was judging.

## How it works

### What the bias is, and what it is not

Self-preference is **not** the judge preferring its own output over the output of another judge. It is the
judge being more generous in its verdicts on text produced by the same model family. The mechanism is
recognition: the judge scores text that looks like text it would have written, and that resemblance is a weak
positive signal that leaks into the verdict even when the content is identical.

It is therefore a property of the **pair** (judge model, system model), not of either alone. Two identical
rubric prompts, run by two different judges, against the same answers, can disagree about quality by a
consistent margin — and the margin is not in either prompt.

### Why the usual measurement does not find it

Because "self-preference" is a comparison between two systems, and two systems differ in a dozen ways at
once. The team compares their new model against the old one, sees the judge scoring them differently, and
concludes self-preference. What they have measured is model A against model B with a judge in between, which
confounds at minimum:

- **family** — the thing you are trying to detect;
- **size and capability** — the new model is usually a different size from the old one;
- **prompt-engineering at that size** — two models of the same nominal class differ in how much help they
  need;
- **decoding defaults** — providers change them between versions.

[7.4](lesson-04.md) is about exactly this trap at full size: across a ladder of five judges, the biggest
single jump in kappa is between the 1.7B and the 3B rung — and that rung is also the rung where the model
**family** changes. Two variables, one move, no way to attribute it. This lesson is the same problem one
variable smaller.

The only clean probe is a paired one: the same item, the same rubric, the same answer content, one copy
produced by the judge's own family and one by a different family, **matched for length**. If the judge passes
the first and fails the second, self-preference is the only thing left that can explain it.

### What the lab's `self` panel actually contains

The preset opens the lab on `Llama 3.2 3B · Rubric · 0 shots · self-preference`, with the self panel on
screen. The panel compares that entry against `Llama 3.2 3B · Rubric · 0 shots` on all 57 dev items, greedy
verdict, once per system:

| System | Plain rubric judge | `self-preference` entry | Change | Flips | Paired sign test |
| --- | --- | --- | --- | --- | --- |
| A — handbook-tuned prompt | 59.6% | 47.4% | −12.3 points | 12 one way, 5 the other | p = 0.14 |
| B — generic prompt | 33.3% | 36.8% | +3.5 points | 6 / 4 | p = 0.75 |
| C — small model, no retrieval | 14.0% | 24.6% | +10.5 points | 10 / 4 | p = 0.18 |

Read the flip columns before the change column. **The flips go 12 points apart on system A and 10 points the
other way on system C.** A bias has a direction — the same direction every time, because it is the same
property of the same judge. Re-rolling the same judge produces scatter. None of these three differences is
significant, and on 57 items none of them is evidence.

That is worth saying plainly, because the panel is labelled for self-preference and its data does not measure
it: in the lab's behaviour model the self-preference bonus only applies when the judge's family matches the
system that wrote the answer, and the Llama judge here matches none of the three systems. The second entry is,
in substance, **a second recorded run of the identical judge** — same model, same rubric, same zero shots,
same $0.03794 a call, same 540 ms.

### Which makes it the most useful panel in the module

Because a second run of an identical judge is exactly the control every bias measurement in this course needs,
and this course did not have one until now.

> **Noise floor: two runs of the identical judge, on the identical 57 items, differ by 12.3 points of pass
> rate on one system and 10.5 on another. That is what "nothing changed" looks like.**

Hold every number in this module against it:

| Measurement | Size | Inside the noise floor? |
| --- | --- | --- |
| Verbosity-biased judge, padded vs original (57 items) | 17.5 points, 11–1 flips | No — and the direction is what proves it |
| Honest judge, padded vs original (57 items) | 3.5 points, 6–4 flips | Yes — indistinguishable from no movement |
| Prometheus 2 7B vs Qwen3 0.6B, kappa on 57 items | 0.11, intervals 0.64–0.93 and 0.47–0.86 | Yes — see [7.4](lesson-04.md) |
| Llama 3.2 3B vs Flow-Judge 3.8B, kappa on 57 items | 0.07, intervals 0.62–0.93 and 0.71–0.96 | Yes |

A bias reading that is smaller than the floor is not a small bias. It is a number you cannot use, and the
discipline of saying so is worth more than the bias would have been.

## Show me

The preset opens on `Llama 3.2 3B · Rubric · 0 shots · self-preference` with the self panel. Two panels on the
page matter for this lesson:

- **The self panel** — the table above. Its own caption tells you the intent: *"Variant C was produced by a
  Qwen-family model; the Llama judge is the one being tested here."* Notice what that sentence sets up and
  what the numbers do: a Qwen-family system judged by a Llama-family judge is the **unmatched** case, which
  is the one place self-preference cannot appear.
- **The Judge dropdown** — the full menu of 16 recorded runs. Two entries print the same rubric text, the
  same model, the same token counts and the same price; the labels differ only by `· self-preference`. That
  is the thing to notice: in a production judge menu you would want the configuration fields, not the label,
  and this menu is showing you what happens when the label is all you have.

> [!NOTE]
> > Everything above is arithmetic on the lab's recorded verdicts, from a seeded educational model. The
> > `Llama 3.2 3B` labels are the menu entries under which runs are filed. Nothing here is a measurement of
> > any real model's self-preference, and the real phenomenon this lesson is about is reported in the source
> > listed at the bottom — on real models, with a different design.

## Try it

**Predict first**, before opening the page:

1. The panel shows one system moving −12.3 points and another +10.5 points. If this were a real self-
   preference effect, which way would both move?
2. Two runs of the identical judge on 57 items differ by 12 points of pass rate. Your padding probe says the
   verbosity bias is 17.5 points. Is that enough to call it a bias?
3. You are judging a Qwen-family candidate with a Qwen-family judge, and the judge says the candidate is
   better. What is the cheapest change that makes the comparison fair?

[Simulation: judge-lab](../../simulations/judge-lab/index.html?preset=self)

1. **Establish the floor first.** Before anything else, note the two pass rates the panel prints for system A
   and the two for system C. Write down: *"two runs of this judge, same items, same prompt, differ by 12.3
   and 10.5 points."* Keep that number visible for the rest of the module — it is the bar.
2. **Check the direction, not the size.** For each of the three systems, count how many of the items moved
   toward pass and how many toward fail. Write the three ratios side by side. Then say what a real
   self-preference effect would look like in the same column, and why none of these three looks like it.
3. **Find the confound in the Judge menu.** This corpus has three system families in play and the judge menu
   spans three families. Find two menu entries that differ in family *and* in size, and confirm from the
   prompt box that they share a rubric. Then say, in one sentence, why you cannot attribute any difference
   between them to family.
4. **Run the length-matched comparison you do not have.** Take one item from the support set and write the
   probe you would actually need: the same content, one copy from the judge's family and one from a
   different family, equal length, same human label. Write down what number you would report and what its
   null result would look like.
5. **Read the price of the fix.** Judge size and price move together across the ladder — which judge on the
   menu is both from a different family than your candidate *and* cheap enough to run nightly? Note the cost
   per call from the cost panel, then say what it costs to run the same judge twice and compare.

## Break it

**Read a family story into the panel.** Take the +10.5 points on system C and write "the judge is kinder to
answers from its own family". It will survive a review, because the panel is labelled self-preference and
system C is a smaller model from a different family than the judge. It is wrong for two independent reasons:
the flips go both ways (10 toward pass, 4 toward fail), and the 10.5 points is inside the 12.3-point floor the
same panel establishes one row above. The lie, named: **a bias reading has to beat the noise floor before it
is a bias, and a label in a dropdown is not a measurement.**

**The second break is the migration study.** A judge from family X scores the family-X incumbent at 90% and
the family-Y candidate at 70%, and the study concludes the incumbent is better. Nothing in that number is
about the systems; it is about the judge. The concrete fix costs nothing: **when you are choosing a judge for
a migration, choose one from a different family than the candidate.** Not because it is provably unbiased —
nobody has shown that — but because it removes the one confound you cannot average away, and because a judge
from another family is also a judge nobody has accidentally tuned to the incumbent.

**The third break is fixing it with a bigger judge.** "Our judge is too small to be self-preferring." Size
and family are confounded across this menu exactly as they are in production, and nothing in [7.4](lesson-04.md)
lets you separate them. A bigger judge from the same family is the same confound with a bigger bill.

## Fix it

Three changes, in order of how much they buy:

1. **Measure your own noise floor, once, and write it down.** Run the identical judge configuration twice on
   the same items and record the gap in pass rate and kappa. On this corpus that gap is **12.3 points and
   0.17 of kappa on 57 items**. Every bias number, size claim and judge comparison you report afterwards is
   measured against it. This is one extra run per judge, once, and it is the highest-value five minutes in
   this module.
2. **For a migration, pick a judge from a different family than the candidate.** It costs one line of config
   and it removes a confound that no amount of averaging removes. Where you have to compare two candidates
   and only have a judge from one of their families, say so in the write-up — *"our judge shares a family
   with the incumbent, so the incumbent's score is an upper bound"* — rather than reporting a symmetric
   comparison that is not one.
3. **If you want the number, build the paired probe.** Same item, same rubric, same human label, two answers
   matched for length, one from the judge's family and one from another. Only the family differs. Report the
   gap against your noise floor, and report it on the held-out split too, the way [7.2](lesson-02.md) does.

And the ceiling: a length prior and a family prior are properties of the model behind the judge. If you cannot
get a judge from another family, the field-level design from [5.1](../module-05/lesson-01.md) is what is left
— "does the answer name the handbook section it came from?" is a question with no room for either prior to
operate.

## How do I know it works?

**Challenge, on dev.** Two targets, and the first one is the more important:

- **Noise floor measured before anything else.** Two runs of the identical judge, 57 items, greedy, pass
  rate and kappa both recorded. The challenge is met when the floor exists as a number in your runbook, not
  when it is small. On this corpus: **12.3 points, 0.17 of kappa.**
- **A family-matched probe, if you claim a self-preference effect.** Your effect has to exceed the floor, in
  the same direction, on a second sample. The three differences on this panel — 12.3, 3.5 and 10.5 points,
  with sign-test p-values of 0.14, 0.75 and 0.18 — fail on both counts and should be reported as "no effect
  measurable on 57 items", which is a legitimate and useful result.

**Then one held-out validation**, and for this one it is a different question again. Do not re-measure the
effect on new items — the effect has to be reproducible on the *same* items, because the thing you are
measuring is a property of the judge, not of your data. Instead, validate the *defence*: swap the judge to a
different family, rerun the same migration comparison, and check that the gap between the two candidates does
not shrink by more than your noise floor. If it does shrink, the original gap was self-preference and you have
found it after the fact, which is better than never.

## Use / don't use

**Do** measure the noise floor before you compare anything. One extra run of your judge on your dev set,
recorded permanently, is the cheapest diagnostic in this course and the one most often skipped.

**Do** pick a judge from a different family than the candidate when you are migrating models. It is one field
in a config, it is usually free, and it is the only intervention on this list that does not require an
experiment to justify.

**Don't** run two judges and average them to "cancel out" a family prior. Two judges from the same family
have the same prior. Two judges from different families give you two independent measurements of the same
thing — which is useful, and is a completely different claim.

**Don't** upgrade your judge to escape this. Family and size are confounded in every model menu ever shipped,
and the evidence you would need to separate them does not exist on 57 items.

What teams actually do: keep one frozen calibration set of hand-labelled items, run the *identical* judge
configuration twice at the start of a migration to establish the floor, and hold the judge family constant
across the whole comparison — never the candidate's family — so that the migration changes exactly one thing.

## Reflect

1. Your migration study puts a family-X incumbent at 90% and a family-Y candidate at 70% under a family-X
   judge, with a measured noise floor of 12 points. Write the sentence you would put at the top of the
   write-up, and the one you would put at the bottom.
2. The `self` panel is labelled for one bias and measures another. Write the sentence you would put in a
   code review that made you check, and say what number in that panel would have changed your mind.
3. You have exactly one judge available and its family matches the candidate you are evaluating. List every
   measurement you *can* still make on that comparison, and every one you must now drop from the write-up.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Arjun Panickssery, Sato Zhu and Yong Li, [LLM Evaluators Recognize and Favor Their Own
  Generations](https://arxiv.org/abs/2404.13076) (2024) — the real measurement of self-preference, and the
  paper this lesson is about.
- Peiyi Wang et al., [Judging the Judges: A Systematic Investigation of Position Bias in Pairwise
  Comparative Assessments by LLMs](https://arxiv.org/abs/2406.07791) (2024) — the same discipline applied to
  a second bias: hold the content fixed, change one thing, and see whether the verdict follows.
- Lianmin Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot
  Arena](https://arxiv.org/abs/2306.05685) (2023) — the reference design, and the paper that established how
  much of a judge-vs-human comparison depends on which model is doing the judging.