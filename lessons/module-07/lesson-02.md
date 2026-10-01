---
id: "07.2"
module: 7
minutes: 15
practice_minutes: 35
prerequisites: ["07.1"]
objectives:
  - Design a bias probe that holds content fixed and changes one thing, and say what a verdict move inside that probe proves.
  - Run the padding probe on a judge and read the resulting change in pass rate, kappa and TNR together.
  - Defend a judge against length by normalising, capping, or grading field-level correctness instead of fluency.
volatility: concept
sources:
  - title: "Length-Controlled AlpacaEval: A Simple Way to Debias Automatic Evaluators (Dubois et al., 2024)"
    url: https://arxiv.org/abs/2404.04475
  - title: "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (Zheng et al., 2023)"
    url: https://arxiv.org/abs/2306.05685
  - title: "Judging the Judges: A Systematic Investigation of Position Bias in Pairwise Comparative Assessments by LLMs (Wang et al., 2024)"
    url: https://arxiv.org/abs/2406.07791
last_verified: "2026-10-01"
---

# 07.2 · Verbosity bias

A judge asked "is this answer good?" on open-ended prose will partly answer "is this answer long?". This
lesson is about the probe that separates those two questions — hold every word of content fixed, change only
the length, and see whether the verdict moves — and about what it looks like when it moves by seventeen
points.

## Why it matters

Two teams run the same product prompt. One adds a short preamble to every answer explaining what the bot is
about to do. The other does not. Everything else — the model, the temperature, the questions — is identical.
After a month of prompt work, team one reports a **19-point improvement** on the eval dashboard, and the
dashboard is right: team one's answers really are 19 points more acceptable to the judge.

They are also the same length. Team one's longer answers earned the pass, not their content.

Nobody catches this, because length and quality are confounded in the normal way evals are run. Every time you
compare two systems you are comparing everything that differs between them at once — prompt, retrieval,
decoding, and now prose style. Length is one of those variables, it is the cheapest one for a team to change,
and a judge with no length prior will reward it.

The reason this needs a dedicated experiment rather than a caution is that a judge can be biased *toward*
length in a way that looks like strictness, which is what the lab's own probe shows.

## How it works

### The probe: hold the content, change the length

The design is the whole lesson. You take an answer, and you make a second copy that says exactly the same
things with two extra sentences appended. Nothing is added to the answer's meaning and nothing is removed.
The human label for the padded copy is the human label for the original — **that is not a modelling choice
someone made at analysis time, it is what the copy is**: same content, so same verdict from a human who can
also read.

This corpus ships exactly that pair. The judge lab's support set has four answer variants per item, and the
fourth is `D — A, padded`:

> **A:** `You get 25 days of paid time off per year, accrued monthly.`
>
> **D:** `You get 25 days of paid time off per year, accrued monthly. It is worth noting that this policy
> was clarified in the 2024 handbook refresh, and that the People team publishes a summary each quarter
> alongside the full document. In addition, teams sometimes localise the rule for their own country, and
> your local lead can confirm whether that applies to you.`

D is A verbatim, with two extra sentences. Across all 57 dev items the padded copy begins with the original
character for character, and every item gains **exactly two** sentences. Mean answer length goes from **101.6
characters to 399.6** — the padded copy is nearly four times as long, and contains not one additional fact.

Nothing else differs. Item, question, human label, judge model, rubric prompt, few-shot count, decoding
settings: all identical. One variable, and it is length.

### What the probe found

Two menu entries, identical except that one has verbosity bias in the recorded run, both scoring the tuned
system's answers on the **57 dev items** with the greedy verdict:

| Judge | Passes A | Passes D | Change |
| --- | --- | --- | --- |
| `Llama 3.2 3B · Rubric · 0 shots` | **59.6%** (34/57) | **56.1%** (32/57) | **−3.5 points** |
| `Llama 3.2 3B · Rubric · 0 shots · verbosity-biased` | **47.4%** (27/57) | **64.9%** (37/57) | **+17.5 points** |

The honest judge does not move. The verbosity-biased judge gains **17.5 points of pass rate from adding
nothing**, and on the full 94 items the same probe reads **+19.1 points** (45.7% → 64.9%).

### Direction, not just size

A pass-rate difference of 17.5 points on 57 items could be noise, and on this module's own standard the noise
floor is large — [7.3](lesson-03.md) measures it at 12.3 points for two runs of an *identical* judge. So size
alone is not enough. The direction is what settles it. Count the items whose verdict changed:

| Judge | Items that flipped | Which way | Paired sign test |
| --- | --- | --- | --- |
| Honest | 10 of 57 | 6 one way, 4 the other | p = 0.75 |
| Verbosity-biased | 12 of 57 | **11 pass-ward, 1 fail-ward** | p = 0.006 |

On the 94 items the same test reads p = 1.00 for the honest judge and p < 0.001 for the biased one, with 19 of
the 20 flips going the same way. The honest judge's six-four split is a coin; the biased judge's eleven-one
split is not. That is what separates a bias from a re-roll.

### Where the change goes: the TNR, not the TPR

This is the part that decides whether it matters. Same two judges, same items, confusion tables:

| Judge | Answer | `tp` | `fp` | `fn` | `tn` | Kappa | TPR | TNR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Honest | A | 29 | 5 | 1 | 22 | 0.79 | 96.7% | 81.5% |
| Honest | D | 28 | 4 | 2 | 23 | 0.79 | 93.3% | 85.2% |
| Verbosity-biased | A | 27 | 0 | 3 | 27 | 0.90 | 90.0% | **100.0%** |
| Verbosity-biased | D | 29 | 8 | 1 | 19 | **0.68** | 96.7% | **70.4%** |

Read the bottom two rows together. On the original answer the verbosity-biased judge has a **perfect** TNR —
it catches all 27 real failures — and a kappa of 0.90. On the padded copy it catches 19 and waves through 8,
and its kappa falls to **0.68**. The padding bought it ten answers it now passes and cost it the failures it
used to catch.

And note the top row of that block: the biased judge on A is *stricter* than the honest judge on A (47.4%
against 59.6%, TNR 100% against 81.5%). **Verbosity bias is not leniency.** It is a length prior. A judge
that punishes short answers looks strict right up until your answers get long, and then it inverts without
anybody touching the prompt.

## Show me

The preset opens the lab on `Llama 3.2 3B · Rubric · 0 shots · verbosity-biased` with the verbosity panel open.
The panel scores all 57 dev items twice — once against `v1` (A) and once against `v1padded` (D) — for the
honest judge and the verbosity-biased judge, and prints three numbers: the pass rate on the original, the
pass rate on the padded copy, and the change.

Two other panels on the same page are part of this lesson:

- **Answer being judged.** The dropdown holds four variants, and the fourth is `D — A, padded` with the note
  `Identical content to A with 2 extra sentences`. That note is the probe: the fourth variant exists only so
  the first three have something to be compared against on length alone.
- **Judge prompt.** Both entries print the *same* three-clause rubric. There is no clause about length, no
  instruction to prefer detail, nothing in the prompt a reviewer could point at. That is what makes the
  effect worth chasing: it is in the model, not in the instructions.

> [!NOTE]
> > Both menu entries are recorded runs of the lab's seeded educational model, filed under the labels
> > `Llama 3.2 3B · Rubric · 0 shots` and `Llama 3.2 3B · Rubric · 0 shots · verbosity-biased`. They are not
> > measurements of Llama in the wild, and the +17.5 figure is arithmetic on 57 recorded verdicts, not a
> > published result.

## Try it

**Predict first**, before opening the page:

1. Answer A and its padded copy D are the same answer. If a judge is correct about both, which way should the
   pass rate move — up, down, or not at all?
2. The verbosity-biased judge scores **47.4%** on A and **64.9%** on D. Its TPR is 90% on A and 97% on D. So
   where do the extra passes come from — good answers it newly recognises, or failures it newly waves
   through?
3. Your team adds one sentence of preamble to every answer and the dashboard pass rate rises 8 points. What
   experiment, run on the same items, would tell you whether that 8 points is content?

[Simulation: judge-lab](../../simulations/judge-lab/index.html?preset=verbosity)

1. **Read the panel before you interpret it.** Record the three numbers for both judges. Then write down, in
   one sentence each, what the honest judge's −3.5 points and the biased judge's +17.5 points each tell you.
   The honest judge is not slightly better behaved; it is the control, and it tells you what the panel's
   floor looks like.
2. **Count the flips, not the rate.** For each judge, count how many of the 57 items change verdict between A
   and D, and split them by direction. Compare those two counts against the noise floor from [7.3](lesson-03.md)
   — 12.3 points of pass rate between two runs of the identical judge on these same items. Ten flips for the
   honest judge is that floor; twelve for the biased judge is eleven one way and one the other, which is a
   different shape entirely.
3. **Check the TNR, not the pass rate.** Take the confusion counts the panel implies and work out how many
   real failures the biased judge catches on A versus on D. Then compute what happens to its kappa. A verdict
   that improves your headline and costs you eight caught failures is not an improvement; say so in the
   language of the gate.
4. **Run the probe against a second judge.** Switch the Judge dropdown to `Qwen3 1.7B · Rubric · 0 shots` or
   `Prometheus 2 7B · Rubric · 0 shots`, leave everything else alone, and re-read the panel. Predict the
   change for each before you look. Then ask the question that matters: if the two judges disagree about
   length, which one are you going to trust on an open-ended question, and how would you decide?
5. **Design your own probe.** Take one answer from your own eval set and write the padded copy yourself —
   same content, two extra sentences that add nothing. Run both through your judge. Write down how many
   words you had to add to move the verdict, because that number is your judge's price per sentence.

## Break it

**Ship the padded prompt.** A team takes the system that gained 17.5 points from adding two sentences and
writes the two sentences into the production prompt. Nothing breaks: the answers are not wrong, the eval
still runs, the pass rate is real, and the judge is the judge. The lie is named: **when length is a free
variable, every eval measures it.** From that week on, "did our prompt get better?" has a second possible
answer that nobody is measuring.

**The quieter break is trusting a single direction of the delta.** Note that the honest judge's number went
*down* 3.5 points, not up. It is tempting to say "the honest judge is anti-verbose, it slightly prefers
shorter". It is not. Six of its ten flips went one way and four the other; that is a coin with a small sample,
and reading a preference into it is the same mistake as reading a preference into 12.3 points of run-to-run
noise. A null result is a null result, and this module measures exactly how big a null looks.

**The third break is capping the wrong thing.** Truncating the answer to the first 200 characters before
sending it to the judge stops the length bias and quietly throws away the part of the answer a real user
reads — usually the conclusion. If your judge is scoring the wrong thing, shortening the input is not the
fix; changing what it is asked is.

## Fix it

Three changes, in increasing order of how much they buy:

1. **Run the padding probe before you trust a judge on open-ended answers.** It is four items of work: one
   original answer, one padded copy, one comparison. The target is a verdict that does not move — and on 57
   items, "does not move" means the pass-rate change is inside about **±3.5 points** for this judge, not that
   it is exactly zero. Report the flip count too; the biased judge's 11-to-1 split is what gives the effect
   away even when the point estimate looks modest.
2. **Grade the fields, not the fluency.** A judge that asks *"does the answer name the handbook section it
   came from?"* cannot be gamed by padding, because the padding does not change the section name. This is the
   one failure-per-judge design from [5.1](../module-05/lesson-01.md) doing the work that no amount of prompt
   tuning on a vague question will do. Every one of the four taxonomy judges in this course is
   padding-proof by construction.
3. **If you must score whole answers, cap the length the judge sees and say so.** Truncate at a fixed
   character count, or pass only the fields the rubric names, and record `truncated_at: 200` in the run key.
   Then accept what you gave up: a judge that reads 200 characters is a field-level judge wearing a whole-
   answer prompt, and you should say that in the runbook rather than discover it later.

And the honest ceiling: a length prior is a property of the judge model. Prompting around it moves the
prior; it does not remove it. On an eval where length varies a lot — long documents, agentic traces,
reasoning chains — the defence that actually holds is the field-level judge.

## How do I know it works?

**Challenge, on dev.** Write the probe down as a target:

- **Padding delta at or below 3.5 points on the 57 dev items**, measured with the greedy verdict. The honest
  rubric judge reads −3.5 points (59.6% → 56.1%) and passes. The verbosity-biased judge reads +17.5 and
  fails, before you look at anything else.
- **Flip direction.** Fewer than 2-to-1 in favour of either direction. The honest judge's 6–4 split passes.
  The biased judge's 11–1 split fails at p = 0.006.
- **TNR does not fall by more than 3 points when the answer is padded.** This is the one to gate on, because
  it is the number that turns into shipped failures. The biased judge goes 100.0% → 70.4% and fails.

**Then one held-out validation** on the 37 test items, which is where the effect either survives as a real
property of the judge or turns out to have been fitted:

| Judge | Answer | Pass rate | TNR | Caught failures |
| --- | --- | --- | --- | --- |
| Honest | A | 43.2% | 90.0% | 18 of 20 |
| Honest | D | 45.9% | 85.0% | 17 of 20 |
| Verbosity-biased | A | 43.2% | 95.0% | 19 of 20 |
| Verbosity-biased | D | **64.9%** | **65.0%** | **13 of 20** |

The honest judge moves 2.7 points on items it was not tuned on, which is its dev-set behaviour. The biased
judge moves **21.6 points** on the same held-out items, gaining 6 false alarms and losing 6 caught failures —
and all 8 of its flips on those 37 items went the same way, toward pass. The effect is not an artefact of
the dev split.

## Use / don't use

**Do run the padding probe** on any judge that scores free-text answers, once, before you let it near a gate.
It is cheap, it is the only bias you can test without inventing an adversary, and it produces a number you can
put in the runbook: *this judge's verdict is invariant to ±N sentences of neutral padding, measured on 57
items on 2026-10-01*.

**Don't use length as a control variable and leave it there.** Two teams' answers will never be the same
length, and normalising it away post hoc is worse than measuring it, because you lose the information about
which lengths were actually hard.

**Don't use a whole-answer judge on fields you can check in code.** The cost ordering is unchanged by any of
this — a code check is free, a 3B judge is $0.03794 a call, a human is your afternoon — and the padding probe
tells you what you are paying that $0.03794 for.

What teams actually do: field-level judges wherever the criterion is checkable; a length probe in the
calibration suite that runs whenever the judge model is upgraded, not just at build time; and a standing rule
that any change to the answer's *shape* — a preamble, a "here's what I'll do" block, a summary at the end —
gets its own A/B on the eval set before it is counted as a quality change.

## Reflect

1. Your system scores 8 points higher this week. A teammate adds two neutral sentences to every answer and
   the score moves 6 of them. Write the two sentences you would send, one to the team and one to whoever
   reads the dashboard next quarter.
2. On this corpus the verbosity-biased judge has a *better* TNR than the honest judge on the original answer
   (100% against 81.5%). Write the one-sentence rule that stops a team from shipping it because of that
   number — and say what that rule costs when the system's answers are genuinely getting longer.
3. Your judge passes 64.9% of padded copies and 43.2% of originals on the held-out split. Design the
   experiment you would run to find out how many sentences it takes to pass any answer at all, and write
   down the sentence you would put in the runbook when you have the number.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Yann Dubois et al., [Length-Controlled AlpacaEval: A Simple Way to Debias
  Evaluators](https://arxiv.org/abs/2404.04475) (2024) — length bias in automatic evaluators, and the
  length-controlled comparison that this lesson's probe is a one-variable version of.
- Lianmin Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot
  Arena](https://arxiv.org/abs/2306.05685) (2023) — the reference design for whole-answer judges, whose
  verbosity sensitivity this lesson measures rather than assumes.
- Peiyi Wang et al., [Judging the Judges: A Systematic Investigation of Position Bias in Pairwise
  Comparative Assessments by LLMs](https://arxiv.org/abs/2406.07791) (2024) — the same discipline applied to
  a second bias: hold the content fixed, change one thing, and see whether the verdict follows.