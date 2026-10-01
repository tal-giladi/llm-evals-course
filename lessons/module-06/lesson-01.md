---
id: "06.1"
module: 6
minutes: 16
practice_minutes: 40
prerequisites: ["05.1", "04.2"]
objectives:
  - Say which part of a judge-agreement number is a fact about the judge and which part is a fact about the humans behind it.
  - Choose who should write a label for a given failure category, and name the category where that choice is wrong.
  - Turn two labellers disagreeing into a written rule instead of an argument about the person who was wrong.
volatility: concept
sources:
  - title: "Inter-Coder Agreement for Computational Linguistics (Artstein & Poesio, 2008)"
    url: https://aclanthology.org/J08-4004/
  - title: "A Coefficient of Agreement for Nominal Scales (Jacob Cohen, 1960)"
    url: https://doi.org/10.1177/001316446002000104
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 06.1 · Who writes the human labels

Every number in this module is two things at once: a fact about the judge and a fact about the people
who labelled the items. Module 5 built the judge; this module starts on the other half of the
measurement, because that half is where the disagreement actually lives.

## Why it matters

A team ships a support assistant. The engineer who wrote the retrieval prompt writes the eval set too,
because they are the only person who knows which answers are right. That is a completely reasonable
decision on day one and it is the reason the eval suite cannot be trusted in month three.

The engineer labels by the criteria they implemented. Another engineer, who knows the product but not
the retention policy behind it, labels by whether the answer reads well. Nobody is careless. The two
people produce two different answers to "is this correct?", and neither of them can see the other's
rule because neither of them wrote it down.

What the team sees is a judge at kappa 0.40 and a taxonomy that looks fine. What the team does not see
is that the 0.40 is a comparison between a judge and a labelling convention that was never written
down, by one person, on one afternoon. Six months later, when the judge is replaced and the kappa
moves to 0.55, nobody can tell whether the judge improved or the labels were a different set of
preferences all along — and the eval set has no version, so the comparison cannot even be re-run.

> [!WARNING]
> The dataset this course ships has **exactly one human label per item, per variant**. There is no
> second labeller anywhere in it, so there is no inter-annotator agreement figure to print. This
> lesson argues the method and tells you what measuring it would take. It does not invent a number,
> and neither should you.

## How it works

### A label is three things, not one bit

Each of the 94 items in variant A — the handbook-tuned system — carries a pass/fail label, a failure
category and a written reason. The labels split like this:

| Human label, variant A | Items | Share |
|---|---|---|
| `correct` | 47 | 50.0% |
| `no_citation` | 27 | 28.7% |
| `wrong_fact` | 12 | 12.8% |
| `over_refusal` | 6 | 6.4% |
| `out_of_scope` | 2 | 2.1% |

The exact 47/47 split is a coincidence of this dataset, and [6.3](lesson-03.md) makes a meal of it.
What matters here is the middle column: **the category is part of the label**, because it is the part
that can be argued with. When a judge and a labeller disagree, the category is what tells you which of
the two applied a rule and which one improvised.

The written reason is the same idea one level down. Every item in this dataset has one. But read them
carefully before you admire them: there are only **five distinct reason strings across all 94 items**,
one per category, averaging 7.6 words — for answers that average 18.1 words. A templated reason records
the category you were standing in, not the judgement you made. It is enough to group a disagreement by
failure type. It is not enough to resolve one.

### Who should label this category

The question is not "who is the best labeller" in the abstract. It is **who is closest to the rule**,
and the rules are not all the same kind of thing.

| Failure category | Items (A) | What the call actually is | Who can make it |
|---|---|---|---|
| `no_citation` | 27 | An observation: is there a `(Handbook — section)` marker? | Anyone who can read two short texts |
| `wrong_fact` | 12 | A lookup: does this match the handbook? | Someone with the handbook, **not** the app |
| `over_refusal` | 6 | A policy decision: is declining to answer a failure here? | Whoever owns the product's risk appetite |
| `out_of_scope` | 2 | A product decision: is this question in scope at all? | Whoever owns scope |

Read the last row against the item slices: **7 of the 94 questions are out of scope** — a crèche, an
employee share scheme, the company valuation — and on variant A only **2** of them were failed as
out-of-scope. The other 5 were labelled `correct`, because the system answered them and the answer was
right. Whether answering an out-of-scope question is itself a failure is a decision, not an
observation, and a labeller who has not been told will make it whichever way their last conversation
went. That is the mechanism behind the whole table: a category with no named owner is a category
whose labels will drift.

Two of those rows are traps that teams fall into every time. `wrong_fact` looks like the category a
developer should own and is the one they get most wrong: knowing how the product behaves is not the
same as knowing what the policy says, and a developer answering from memory labels a correct answer as
a wrong fact. `over_refusal` looks like the smallest, cheapest, most obvious call — six items, two
people, ten minutes — and it is the only row on this list that is a **decision rather than an
observation**, which means it has to be owned by someone who can say out loud what the rule is.

The third option is the one with the best economics and the most dangerous default. A capable model
drafts the labels and a human spot-checks. That works for the mechanical categories. The failure is in
the spot-check plan: `no_citation` is 27 of 94 items, so a reviewer who checks the biggest category
first has verified nothing about `wrong_fact`, `over_refusal` or `out_of_scope` — 20 items, all of them
judgement calls, all unchecked.

### When two labellers disagree

This is the part worth being careful about, because the instinct is to treat a disagreement as an
outage: somebody is wrong, find out who, move on. That instinct throws away the most expensive
information you have.

Take the 6 `over_refusal` items on the tuned system — answers that decline to state the handbook fact.
The humans failed all six, so the tuned system's human pass rate is 47 of 94. Suppose a second labeller,
reading the same rubric, decides that declining is acceptable on a question the handbook does not cover,
and passes all six. Nothing is re-graded sloppily. One rule was applied differently. Here is what it
does to the agreement numbers, all 94 items, greedy first sample:

| Human labels | TPR | TNR | Kappa | Human pass rate |
|---|---|---|---|---|
| As shipped — over-refusals are failures | 91.5% | 85.1% | **0.77** | 50.0% |
| Over-refusals relabelled as passes | 81.1% | 82.9% | **0.64** | 56.4% |

That is the rubric judge. The plain judge moves from kappa **0.40** to **0.37** over the same relabel.
Six labels out of 94 — one rule, applied consistently by two careful people — and the headline moves 13
kappa points on the better judge. If nobody wrote down the rule, the only evidence that the number moved
is that the number moved.

Note where those six items live: **3 in dev, 3 in test**. The ambiguity sits on both sides of the split
from [4.2](../module-04/lesson-02.md), so no amount of additional held-out data resolves it. Only a
written rule does.

> [!IMPORTANT]
> Measuring this properly is straightforward and this course's dataset does not do it. Label the same
> items twice, with two labellers blind to each other, then run the same kappa from
> [6.3](lesson-03.md) with **human against human** instead of judge against human. Report it per
> category, not in total: a total of 0.9 across 94 items is compatible with two labellers who agree
> completely on `no_citation` and disagree on every single `over_refusal`.

## Show me

This lesson's preset opens the judge lab on `Llama 3.2 3B · Plain · 0 shots`, the handbook-tuned
variant, on a random draw of **40 dev items at seed 7**. The page reads:

- Confusion, rows human and columns judge: `tp 19, fp 8, fn 3, tn 10`.
- TPR **86.4%** (70.4%–100.0%), TNR **55.6%** (31.3%–77.8%), accuracy **72.5%**, kappa **0.43**
  (0.13–0.69).
- Judge pass rate **67.5%** (52.0%–79.9%), 27 of 40.

Read the confusion table's row headers rather than its cells, for a moment. The left column says
"human passed" and "human failed", and behind those two words sit 30 and 27 dev items with a category
and a reason each. Over the full 94-item variant A the humans passed 47 and failed 47, so every
"of what humans passed" denominator you will meet in this module is 47 on the whole set and 30 in the
dev half.

Now do the experiment that shows the labels are not attached to the question but to the answer. Leave
everything alone and change **Answer being judged** from `A — handbook-tuned prompt` to
`C — small model, no retrieval`. The human labels underneath are re-read from the same 94 items and
come out completely different:

| Human labels | `correct` | `no_citation` | `wrong_fact` | `extra` | `over_refusal` | `out_of_scope` |
|---|---|---|---|---|---|---|
| A — handbook-tuned | 47 | 27 | 12 | 0 | 6 | 2 |
| C — small model | 8 | 25 | 29 | 15 | 10 | 7 |

The pass rate on variant C is **8 of 94**, and it is not because the eval set got harder. It is
because the same question now has a worse answer, and the humans re-read it against that answer. A
label is a judgement about an item *and* a system output. Freeze it without the output and it is a
fragment.

> [!NOTE]
> The verdicts behind every tile on that page come from a seeded educational model of judge behaviour,
> not from a live LLM. The model names in the Judge menu — Qwen3, Llama 3.2 3B, Flow-Judge, Prometheus
> — are the labels recorded runs are filed under, not published benchmark results for those models.
> Every statistic computed from the recorded verdicts is computed for real in your browser.

## Try it

**Predict first**, in writing, before you open anything:

1. The humans passed exactly 47 of 94 on variant A. A judge that agrees with them on every `no_citation`
   item and disagrees on every `wrong_fact` item would read what TPR and what TNR?
2. You relabel the 6 `over_refusal` items as passes. Does the judge's **TNR** go up or down, and why?
3. Why is a spot-check that samples the largest failure category on its own worth nothing?

[Simulation: judge-lab](../../simulations/judge-lab/index.html?preset=tnr)

1. **Read the labels, not the tiles.** Switch **Answer being judged** through all four variants and
   write down the human pass rate each time. You should get 50.0% on A, and much lower numbers on B and
   C. Then answer, in one sentence, what a pass rate means when the humans re-read every item for every
   variant.
2. **Find the categories that need a decision.** The taxonomy on variant A has four failure rows. For
   each, write down whether the call is an observation or a decision, and who has to own it. The two
   rows where you cannot answer "who" without a conversation are the ones that will cost you a kappa
   later.
3. **Run the sensitivity you cannot run in real life.** Take the 6 `over_refusal` items out of the
   failed group and re-read the TPR, TNR and kappa tiles as if they had been passed. Write down which
   tile moved most and by how much, then write the sentence you would put in a ticket: *what rule did
   we not write down?*
4. **Find a category with no owner.** Item slices in this dataset include 5 hard and 2 medium
   `out_of_scope` items. Seven questions were asked that the product does not answer, and on variant A
   only 2 of them produced an out-of-scope failure. Work out where the other 5 went, and say whether the
   answer is a labelling problem or a taxonomy problem.
5. **Read a disagreement as a label question.** Open a `no_citation` item from the disagreement list
   and read the label's written reason. Then write what *your* reason would be, and compare. If your
   sentence says something the stored one does not, you have found a criterion nobody wrote down — on
   your own set, which is the only set you will ever have.

## Break it

Three ways to lose the humans, in increasing order of how long they survive a review.

**One labeller, no second pass.** "We will find out if the judge is wrong, because the judge will
disagree and we will go and look." This sounds like a plan and is a loop that closes on itself. The
judge was built from the same criteria as the labels — it is downstream of them, not independent of
them — so agreement between the two is evidence that one document was applied twice, not that two
things were measured. The lie: **a judge is not a check on the labels.** It is the same opinion with a
different temperature.

**Model-drafted labels, spot-checked where it is easiest.** The model reads 94 answers and proposes a
category. A reviewer checks 20, drawn from `no_citation` because that is the biggest pile. What has been
verified is that the model can count citation markers. What has not been verified is the part that
matters — the 12 `wrong_fact`, the 6 `over_refusal`, the 2 `out_of_scope`, which is 20 items and every
judgement call among them. The lie: **a spot-check rate quoted without its category spread is a spot
check of the easy 85%.**

**The one that survives code review: the labeller is the author.** The person who wrote the retrieval
prompt labels the set, because they are available and it is faster. Every criterion they cannot apply
cleanly they resolve in favour of their own prompt, silently, because resolving it the other way would
mean rewriting the thing they shipped. The eval then reports a rising kappa that is really a rising
self-consistency. The lie: **an instrument calibrated by the thing it measures cannot disagree with it.**
The cost is not the labels; it is that you have spent your label budget and bought nothing you could
have bought from a stranger.

## Fix it

1. **Write the criterion before the label, in the label file.** The category list *is* the criteria
   document. `no_citation` is a rule because it says what is missing; `helpful` is not, because there
   is no way to tell a labeller who has never seen it whether they applied it.
2. **Label twice on the contested slice, not twice on everything.** Two labellers, blind, on the 20
   judgement-call items in this dataset — the `wrong_fact`, `over_refusal` and `out_of_scope` rows —
   costs about an hour. The mechanical 27 need one pass. The disagreements you get back are the
   deliverable, not the defect: each one is a sentence of criteria that nobody had to write.
3. **Record the category and one sentence for every label.** Not because the sentence will be good —
   this dataset's own reasons are five templates — but because the moment a human and a judge disagree
   you need something to argue about that is finer than a bit.
4. **Freeze the labels with a hash, exactly as [5.3](../module-05/lesson-03.md) keys a verdict.** The
   item id, the system variant, the answer text and the criterion version travel together in one key. A
   relabelled set is a new key: the old kappa is archived under the old one, and the judge is
   re-measured against the new set from zero. Never restate an old number against a new set of labels.

## How do I know it works?

**Challenge, on dev.** Your label set is ready to measure a judge when all four of these hold:

- **Every label carries a category and a sentence**, and the categories are the ones in your taxonomy
  rather than the ones the labeller preferred. On this dataset that is 94 of 94, with 47 `correct`, 27
  `no_citation`, 12 `wrong_fact`, 6 `over_refusal`, 2 `out_of_scope`.
- **Every judgement-call category has a named owner** who can answer, without looking anything up,
  whether declining to answer counts as a failure here. If that answer does not exist, the category is
  not ready to be measured.
- **The contested slice has been labelled twice, blind**, and the disagreements are written down as
  rules — not resolved by seniority. The count is the output; you are allowed to ship a non-zero count.
- **You can say how much the labels moved the headline.** Relabelling 6 items moves the rubric judge
  from kappa 0.77 to 0.64. If your own sensitivity run moves your number more than your prompt edit did,
  then the labels were the bigger lever and the write-up has to say so instead of crediting the prompt.

**Validation, once.** Press **Validate on test**. The human labels are frozen across both halves —
they were never re-read when the split changed — so the difference between the two numbers is the
judge, not the people. `Llama 3.2 3B · Plain · 0 shots` reads dev kappa **0.43** (0.20–0.64) on 57 items
and test kappa **0.37** (0.12–0.63) on 37. `Llama 3.2 3B · Rubric · 0 shots` reads **0.79** (0.60–0.93)
on dev and **0.73** (0.49–0.94) on test. Both hold their shape and neither interval is narrow; that is
the honest size of the evidence you have, and it is the size you would have had even with perfect
labels.

## Use / don't use

**Do use** a named domain owner for every category that is a decision rather than an observation. On
this corpus that is 6 `over_refusal` and 2 `out_of_scope` items out of 94 — an afternoon, and the two
categories most likely to be contested.

**Do** keep the category and the sentence. They are what makes a disagreement review in
[6.3](lesson-03.md) possible at all; a set of bare bits can only ever be counted, and counting tells
you the judge is off without telling you how to fix it.

**Do use** a model to draft labels where the rule is mechanical and a human to own the decisions. The
drafting is free and the checking is cheap; the error is in letting the cheap half define the scope of
the expensive half.

**Don't let the author of the prompt be the only labeller**, and don't let the developer who knows the
app label `wrong_fact`. Both are the same mistake with different costumes: familiarity with the system
is not familiarity with the standard.

**Don't re-label to improve a number.** If a label changes, the reason changes with it, and the reason
goes in the record next to the item. A label edited to move a kappa is indistinguishable, a year
later, from a label edited because it was wrong.

What teams actually do: the eval set lives in the repository as a CSV with `item_id`, `variant`,
`answer`, `label`, `category`, `reason`, `labeller_id` and `criteria_version`, hashed on commit. A
`criteria_version` bump invalidates every agreement number computed under the old version and they
know it, because the number carries the version. Once a quarter, someone re-labels 20 frozen items as a
canary; a canary that drifts is a policy change that nobody wrote a ticket for. And the label set is
never deleted after the judge reaches a target — it is the only artefact that can tell you whether a
future judge improved, or whether the humans moved.

## Reflect

1. Your taxonomy has one category where nobody can say what the rule is without a conversation. Write
   the rule in one sentence, and say which items in your set change label when you do.
2. Someone proposes replacing your 94 human labels with a model that drafts and a reviewer who checks
   the 20 largest items. Write the two sentences that would stop them, and name the category that would
   be least checked.
3. Your judge reads kappa 0.77 on dev and 0.73 on test. A week later you relabel 6 items after a policy
   meeting and dev reads 0.64. Which number goes in the write-up, and what do you have to record
   alongside it for the next person to be able to reproduce any of them?

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Z. Artstein and M. Poesio, [Inter-Coder Agreement for Computational
  Linguistics](https://aclanthology.org/J08-4004/) (2008) — why agreement between labellers has to be
  measured separately from agreement between a labeller and a system, and why the per-category number
  is the one worth having.
- Jacob Cohen, [A Coefficient of Agreement for Nominal
  Scales](https://doi.org/10.1177/001316446002000104) (1960) — the statistic this module spends
  [6.2](lesson-02.md) and [6.3](lesson-03.md) building up to, and the thing you would compute between
  two human labellers if this dataset had two.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the ordering underneath this
  lesson: the criterion is written before the automation, and the humans are the reference the
  automation is measured against.