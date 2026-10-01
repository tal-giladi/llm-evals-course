---
id: "08.4"
module: 8
minutes: 17
practice_minutes: 45
prerequisites: ["08.3"]
objectives:
  - Run the module-6 agreement procedure against a RAG metric you did not write, and decide whether to adopt it from the confusion matrix rather than from its published score.
  - Show why a metric's own output cannot tell you whether it is trustworthy, using one system that leads the dashboard on the metric and is caught by the humans.
  - Say which part of adopting a third-party metric transfers across its versions, and write the runbook sentence that makes the decision reviewable.
volatility: concept
sources:
  - title: "RAGAS: Automated Evaluation of Retrieval Augmented Generation (Es et al., 2023)"
    url: https://arxiv.org/abs/2309.15217
  - title: "ARES: An Automated Evaluation Framework for Retrieval-Augmented Generation Systems (Saad-Falcon et al., 2023)"
    url: https://arxiv.org/abs/2311.09476
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 08.4 · Validating RAG metrics against humans

Every team that builds RAG ends up running a metric somebody else wrote, and almost none of them check what
that number means on their own data before they gate a release on it. This lesson runs the Module 6
validation procedure against a metric the team did not write, on twenty questions whose answers a human can
check in seconds, and finds a metric that leads its own leaderboard and is wrong about half of what it ranks.

## Why it matters

The sequence is familiar. A paper defines a faithfulness metric. A framework ships it. Someone puts
`faithfulness: 0.82` on the dashboard next to `context_precision: 0.79`, two numbers in the same font, both
with a definition, both looking like they came from the same measurement. A release gate is built on one of
them because it is the one that moves in the direction the team wants.

Three months later the product is being told to quote a number the handbook does not contain, and the metric
that was supposed to catch it reads **80.0%**.

Nobody did anything wrong to the metric. It does exactly what its authors specified. The error was earlier and
quieter: **a metric's name carries authority that its behaviour has not earned on your data.** Until you have
put your own human labels next to its verdicts, you do not know whether "grounded" on your corpus means
"grounded", and the number's precision is not evidence of anything except that someone formatted it well.

This module implements **the procedure for deciding whether to trust a metric**. It does not implement any
named third-party RAG framework — there is no RAGAS code behind these numbers, and no number here is a
measurement of one. What it implements is the transferable half: the confusion matrix, the two rates, kappa,
the per-category table and the one held-out read. That half survives a version bump; the metric probably will
not be the same next quarter.

## How it works

### The six steps, and why each one is there

The procedure is [6.2](../module-06/lesson-02.md) and [6.3](../module-06/lesson-03.md) pointed at somebody
else's number. In order:

| Step | What you do | What it catches |
|---|---|---|
| 1. Freeze a human-labelled set, one category per item | read the passages and label grounded / ungrounded / should-have-abstained / over-refusal | nothing, yet — it is the price of admission |
| 2. Run the metric over the same items | one verdict per item, same run record | plumbing: does the metric even score your output format |
| 3. Build the confusion matrix | `tp fp fn tn` | nothing, yet |
| 4. Read TNR with its denominator | what fraction of real faults it caught | the metric letting your users be wrong |
| 5. Read kappa and the per-category table | chance-corrected agreement; which category is weak | one total hiding three different problems |
| 6. One held-out half, read once | the numbers on items you did not tune on | step 4 on ten items |

Step 4 is the gate and the other five are there to keep step 4 honest.

### Worked on ten items, by hand

Before the real run. Ten items: five human-grounded, five human failures. The metric passes 6.

$$\text{TPR} = \frac{tp}{tp + fn} = \frac{4}{4+1} = 80\% \qquad \text{TNR} = \frac{tn}{tn + fp} = \frac{3}{3+2} = 60\%$$

Every one of those five numbers is visible in the confusion table and none of them is a judgement call. That
is the whole appeal of the procedure: it is arithmetic on counts you can audit, not a score to take on faith.

### The real run: variant B, `Qwen3 1.7B · Plain`, all 20 items

Human labels for variant B: **11 grounded, 9 failures**. The metric's greedy verdicts:

| | Metric says grounded | Metric says ungrounded | Total |
|---|---|---|---|
| **Human says grounded (11)** | `tp` 11 | `fn` 0 | 11 |
| **Human says not (9)** | `fp` 5 | `tn` 4 | 9 |
| **Total** | 16 | 4 | 20 |

$$\text{TPR} = \frac{11}{11} = 100.0\% \qquad \text{TNR} = \frac{4}{9} = 44.4\% \qquad \kappa = 0.47 \ (0.14\text{–}0.80)$$

The TPR is perfect. The TNR is **44.4%**, and the five faults it waves through are g07, g13, g15, g18 and
g20 — four fabrications and one refusal of a question the passage answers. Against the 0.70 TNR floor from
[6.2](../module-06/lesson-02.md), **this metric fails the gate by 26 points.** That is the decision, and it
took four numbers and a spreadsheet.

### The dashboard prefers the metric, and the metric prefers the worst system

Now the part that is worth the whole lesson. The `Compare` panel puts three prompting strategies on the same
twenty questions with this same metric:

| System | Grounded (metric) | Wilson 95% | Kappa | TNR |
|---|---|---|---|---|
| A — grounded, abstains when nothing is retrieved | 75.0% | 53.1%–88.8% | 0.44 | **50.0%** |
| **B — never told to abstain** | **80.0%** | 58.4%–91.9% | 0.47 | **44.4%** |
| C — small model | 75.0% | 53.1%–88.8% | 0.43 | 45.5% |

**The system that fabricates on all three questions where retrieval returned nothing leads the table.** It
leads it by five points, which is inside the interval, and it is bottom of the column that says the metric is
right.

This is not a bug in the metric. A pass rate rewards leniency, and a metric that passes some failures will
always score a failure-heavy system higher than a clean one. What it means is narrower and more useful:
**you cannot rank systems on a metric you have not validated, and you cannot tell from the metric's output
that you should not.** The ranking is only as good as step 4, and step 4 was never run.

### The knob is a prefix, and the prefix lies

The `Questions` knob does not draw a random sample. It takes the **first `n` items in file order**
(`D.items.slice(0, n)`), so changing it changes the *mix*, not just the sample size. Same metric, same
answers, same day, variant B:

| Questions knob | Grounded | Kappa | TPR | TNR | Confusion |
|---|---|---|---|---|---|
| 5 | 60.0% | **1.00** | 100.0% | **100.0%** | `tp 3, fp 0, fn 0, tn 2` |
| 10 | 60.0% | 0.80 | 100.0% | **80.0%** | `tp 5, fp 1, fn 0, tn 4` |
| 12 | 66.7% | 0.82 | 100.0% | 80.0% | `tp 7, fp 1, fn 0, tn 4` |
| 14 | 71.4% | 0.70 | 100.0% | 66.7% | `tp 8, fp 2, fn 0, tn 4` |
| 15 | 73.3% | 0.59 | 100.0% | 57.1% | `tp 8, fp 3, fn 0, tn 4` |
| 20 | 80.0% | 0.47 | 100.0% | **44.4%** | `tp 11, fp 5, fn 0, tn 4` |

On this variant all three of the menu's judges read **kappa 1.00 at `n = 5`**. And the TNR falls monotonically
as the set grows, from 100.0% to 44.4%, while the pass rate *rises*. A team that validated on the first ten
items and reported the first ten items would have shipped the worst metric on the menu with a TNR of 80.0% and
a kappa of 0.80 on the page.

### The held-out half is where the estimate stops being about your search

Items 1–14 as dev, items 15–20 read once, all three metrics on variant B:

| Metric (variant B) | Dev (n = 14) TNR | Dev kappa | Held-out (n = 6) TNR | Held-out kappa |
|---|---|---|---|---|
| `Qwen3 1.7B · Plain` | 66.7% (4/6) | 0.70 | **0.0%** (0/3) | 0.00 (0.00–0.00) |
| `Llama 3.2 3B · Stepwise` | 66.7% (4/6) | 0.70 | **100.0%** (3/3) | 0.67 (0.00–1.00) |
| `Prometheus 2 7B · Stepwise` | 100.0% (6/6) | 1.00 | 66.7% (2/3) | 0.67 (0.00–1.00) |

Read the plain judge's row twice. It caught four of six dev failures and **none of the three held-out
failures** — g15, g18 and g20, one fabricated policy from an empty retrieval, one wrong deadline, one refusal
of an answerable question. Its held-out kappa is 0.00, and its TPR held at 100.0%, which is the signature of a
judge that passes everything it has not been told to fail.

The honest reading of the right-hand column is that **three failures cannot settle anything** — the intervals
span a third of the scale and two of them include 0. What it does settle is the decision: the only metric that
passed dev is not the one you ship on dev evidence, and the metric with the best full-set TNR is the one with
a zero held-out TNR.

> [!IMPORTANT]
> There is no RAGAS implementation behind any of this, and no number in this module is a measurement of one.
> The three menu entries are recorded runs of the lab's seeded educational model of judge behaviour, filed
> under model and prompt labels, and every statistic is computed for real in your browser from those recorded
> verdicts. What is being validated here is a *procedure* — and a procedure is the thing you keep when the
> metric you validated gets reimplemented, renamed or version-bumped.

## Show me

The `compare` preset opens on variant B with `Qwen3 1.7B · Plain`, **all 20 items**. Two panels and a list:

**Grounding panel (variant B, this metric):** Grounded **80.0%** (60.0%–95.0%), kappa **0.47**
(moderate, 0.14–0.80), TPR **100.0%**, TNR **44.4%**, confusion `tp 11, fp 5, fn 0, tn 4`.

**Three prompting strategies, same questions:**

| System | Grounded | Wilson 95% | Kappa | TNR |
|---|---|---|---|---|
| A | 75.0% | 53.1%–88.8% | 0.44 | 50.0% |
| B (highlighted) | 80.0% | 58.4%–91.9% | 0.47 | 44.4% |
| C | 75.0% | 53.1%–88.8% | 0.43 | 45.5% |

**Ungrounded answers the judge missed (5):** g07, g13, g15, g18, g20 — all five false alarms.

Do this, in order:

1. **Recompute the matrix from the table before you believe the tiles.** 11 human-grounded, 9 not; the judge
   passes 16. `tp 11, fp 5, fn 0, tn 4`. TPR is 11/11 and TNR is 4/9 — write both fractions out, then compare
   to the tiles.
2. **Switch the Grounding judge to `Prometheus 2 7B · Stepwise`** and re-read the compare table. Variant B
   moves to Grounded **60.0%** (40.0%–80.0%), kappa **0.90** (0.63–1.00), TPR **100.0%**, TNR **88.9%**, and
   the list drops to **(1)**, naming only g15. Same answers, same twenty items, a metric that is right 8 times
   out of 9 instead of 4 — and the leaderboard it produces is the one you would rather ship.
3. **Turn the Questions knob to 10, then 5.** kappa 0.80 then 1.00, TNR 80.0% then 100.0%. Remember that the
   knob takes a prefix: the five items that remain are the first five, which is why the number improves.
4. **Find the ranking the metric gets wrong.** Variant B leads the Grounded column and is bottom on TNR. Write
   down what you would have shipped this week if you had only had the left-hand column.

> [!NOTE]
> The confusion counts are a property of this 20-item educational corpus and its recorded runs. They are not
> published results for Qwen3 1.7B, Llama 3.2 3B or Prometheus 2 7B, and none of them is a measurement of a
> named RAG evaluation framework.

## Try it

**Predict first**, before opening the page:

1. A metric reports 80.0% grounded on variant B and 75.0% on variant A. Which system do you ship, and what
   single additional number would have changed the decision?
2. The same metric reads kappa 1.00 on five items and 0.47 on twenty. What is the metric doing between those
   two readings, and what does that tell you about picking an eval set size?
3. If you adopt a metric on the strength of the number in its paper, what specific thing about your own
   corpus has to be true for that number to transfer — and how would you find out whether it is?

[Simulation: rag-evals](../../simulations/rag-evals/index.html?preset=compare)

1. **Write the validation down as a table before you read any tile.** Columns: metric, `n`, `tp fp fn tn`,
   TPR, TNR, kappa. Fill one row for each of the three menu entries on variant B, all 20 items. Then write
   the one sentence you would put in the runbook for each: adopt, adopt with a floor, or reject.
2. **Do the held-out read yourself.** Set the knob to 14, record all three metrics, then compute the same
   three numbers on items 15–20 by hand from the exported verdicts. Which metric's dev rank survives, and
   what does the interval on the held-out half allow you to claim?
3. **Price the validation, not just the metric.** The cost table reads **$0.02244** and 380 ms for
   `g-plain`, **$0.03794** and 540 ms for `g-claim`, **$0.09872** and 1250 ms for `g-strict`. Twenty greedy
   verdicts cost **$0.4488**, **$0.7588** and **$1.9744**. Work out what a nightly three-metric run costs at
   200 items with five repeats, then say what you would drop if that number were rejected.
4. **Reverse the ranking.** Name the five items `g-plain` waves through and the one `g-strict` waves through.
   Sort each into retrieval fault and answer fault. Then write down which of the two the metric's TNR was
   measuring and which it was blind to.
5. **Test the procedure on your own set.** Take five items from a project, label them by hand against the
   passages, and run your metric over them. Compute the confusion matrix at `n = 5` and at `n = 5 + whatever
   you already had`. Write the sentence that explains to your team why the two numbers differ.

## Break it

**Adopt the metric because it is published.** Its reported score was measured on someone else's items, someone
 else's passages and someone else's answers. The name is the only thing that transfers, and names are what
 gets put on slides. The lie: **an authority in the literature is not a measurement on your data.**

**Validate on the items you used to choose the metric.** Once the metric's scores are in the loop, the dev
 numbers describe your search. The plain metric reads kappa 0.80 and TNR 80.0% on the first ten items and
 0.47 and 44.4% on all twenty. The lie: **a metric tuned and reported on the same items describes the tuning.**

**Turn the knob down until the numbers look good.** On variant B, `n = 5` gives kappa 1.00 and TNR 100.0%
for every metric on the menu, and the knob takes a prefix rather than a draw, so it is not even a smaller
random sample — it is a different population. The lie: **a subset you can choose after seeing the numbers is
not a sample.**

**Gate on kappa alone.** Kappa 1.00 at five items is the best number on the page. It is also the number most
 sensitive to the mix, and [6.2](../module-06/lesson-02.md) measured exactly how: the same verdicts, re-weighted
 for prevalence, send kappa down while accuracy goes up. The lie: **the one agreement number that moves with
 your class balance is the one you cannot build a gate on.**

## Fix it

1. **Run the six steps once, on a frozen labelled set of at least 30 items per failure category, and write the
   result into the runbook.** For variant B on 20 items that is: `tp 11, fp 5, fn 0, tn 4`, TPR 100.0%, TNR
   44.4%, kappa 0.47, held-out TNR 0.0%. A sentence with six numbers in it is reviewable in a year; "we use the
   standard faithfulness metric" is not.
2. **Gate on TNR and publish kappa beside it, both with `n`.** Three numbers is the minimum that makes the
   other two interpretable. On this corpus `Prometheus 2 7B · Stepwise` at **88.9%** (8/9) clears the 0.70
   floor and `Qwen3 1.7B · Plain` at **44.4%** (4/9) fails it by 26 points.
3. **Re-run the validation whenever the metric changes — and pin the version.** The metric is a dependency
   like any other, and a metric upgrade is exactly the event [7.4](../module-07/lesson-04.md) says to test on
   eval items rather than in production. Record the entry, the model label, the few-shot count and the corpus
   hash in the run key.
4. **Adopt the procedure when you cannot adopt the metric.** If no framework's metric clears your own gate,
   the thing worth keeping is the confusion matrix: 30 labelled items, four categories, two rates and a
   held-out half. That is about a day of reading and it is what lets you tell whether *any* metric is telling
   the truth, including the one you write next quarter.

## How do I know it works?

**Challenge, on dev.** Items 1–14, variant B. A metric is ready to gate on when:

- **TNR ≥ 0.85 on dev with the denominator written next to it.** `Prometheus 2 7B · Stepwise` reads
  **100.0%** (6/6) and passes. `Qwen3 1.7B · Plain` reads **66.7%** (4/6) and fails. `Llama 3.2 3B · Stepwise`
  reads **66.7%** (4/6) and fails.
- **TPR ≥ 0.90, so it cannot buy TNR by failing good answers.** All three read **100.0%** on dev; the
  stepwise 3B slips to **90.9%** on all 20.
- **Per-category TNR clears the floor with the weak category named.** On items 1–14 the six human failures are
  five `ungrounded` and one `should_have_abstained`; `g-strict` catches all six, `g-plain` catches four and
  waves through g07 and g13.

**Then one held-out validation** on items 15–20, read once, never used to re-tune:

| Metric, variant B | Held-out TNR | Held-out kappa | What you may claim |
|---|---|---|---|
| `Qwen3 1.7B · Plain` | 0.0% (0/3) | 0.00 (0.00–0.00) | caught none of three; reject |
| `Llama 3.2 3B · Stepwise` | 100.0% (3/3) | 0.67 (0.00–1.00) | no evidence against; adopt with the floor |
| `Prometheus 2 7B · Stepwise` | 66.7% (2/3) | 0.67 (0.00–1.00) | no evidence against; adopt with the floor |

The third column is why the table has a "what you may claim" column. With a denominator of 3 the intervals
run 0.00–1.00, so **the defensible claim on two of these three rows is the absence of evidence against them,
not evidence for them.** The defensible claim on the first row is different and much stronger: it is a
specific, named failure on items you held out. Twenty items buy you a rejection and a shortlist — nothing
more, and a runbook that says so is worth more than one that says 0.67.

## Use / don't use

**Do treat validation as a scheduled run, not a launch task.** Re-run it whenever the metric, the judge model,
the system prompt or the corpus changes. The four numbers and their intervals are the artefact; the decision
is a byproduct.

**Do keep the human labels.** They are the only thing that makes the next metric's adoption a measurement
instead of an opinion. A hundred labelled items across four categories is roughly an afternoon and it is
reusable by every metric you will ever evaluate.

**Do check the metric's ranking against the TNR ordering at least once.** On this corpus the two disagree
about which system is best, and the disagreement is the finding.

**Don't adopt a metric's number, its name or its benchmark score.** All three describe somebody else's items.
Adopt the *definition*, validate the *implementation*.

**Don't compare two metrics by their pass rates.** The lenient metric wins the pass rate every time, on every
corpus. Compare TNR, with denominators — and if you must compare headline numbers, compare kappa, knowing
that kappa falls as your class balance shifts.

What teams actually do: pin one metric version, keep a labelled RAG eval set of about a hundred items
stratified over the four answer-side categories, and run the full validation suite — TPR, TNR, kappa,
per-category, and one held-out half — on every metric change and every quarter regardless. The dashboard
carries the metric's score; the runbook carries the validation, and a release gate is built on the runbook
number rather than the dashboard one.

## Reflect

1. The metric ranks variant B first and the humans rank it second. Write the two sentences you would send
   the team that owns the dashboard, and say which one of them you would put in the release note.
2. Every metric reads kappa 1.00 on five items. Design the experiment that tells you how much data this
   particular metric needs, and write down what you would report if you only had twenty items.
3. No framework's metric clears your own gate on your own data. Write the one-page spec for the metric you
   would write instead — its categories, its prompt, its failure mode — and say which part of it is the
   procedure you already have.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Shahul Es et al., [RAGAS: Automated Evaluation of Retrieval Augmented
  Generation](https://arxiv.org/abs/2309.15217) (2023) — the metric definitions this lesson deliberately does
  not reimplement, and the reason adopting one is a measurement decision rather than a formatting decision.
- Jacob Saad-Falcon et al., [ARES: An Automated Evaluation Framework for Retrieval-Augmented Generation
  Systems](https://arxiv.org/abs/2311.09476) (2023) — a trained RAG classifier evaluated against human labels
  with agreement statistics, which is the shape of the validation this lesson runs by hand.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the standing rule underneath the six
  steps: you do not have a metric until you have measured it against humans on your own items, and that
  measurement is part of the eval rather than a prelude to it.