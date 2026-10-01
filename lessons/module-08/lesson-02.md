---
id: "08.2"
module: 8
minutes: 18
practice_minutes: 45
prerequisites: ["08.1"]
objectives:
  - Split an answer into atomic claims, decide each one against the supplied passages, and report an ungrounded-claim rate with its denominator.
  - Explain why an answer-level pass or fail cannot separate a fabrication from an over-refusal, using one item both granularities get wrong.
  - Read the TNR difference between a plain grounding prompt and a stepwise one on the same items, and say what it costs and what it does not prove.
volatility: concept
sources:
  - title: "RAGAS: Automated Evaluation of Retrieval Augmented Generation (Es et al., 2023)"
    url: https://arxiv.org/abs/2309.15217
  - title: "ARES: An Automated Evaluation Framework for Retrieval-Augmented Generation Systems (Saad-Falcon et al., 2023)"
    url: https://arxiv.org/abs/2311.09476
  - title: "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (Zheng et al., 2023)"
    url: https://arxiv.org/abs/2306.05685
last_verified: "2026-10-01"
---

# 08.2 · Grounding judges, claim by claim

Grounding can be judged one answer at a time or one claim at a time, and the second is not a refinement of
the first — it is the only granularity at which "is this supported?" and "did it refuse something answerable?"
stop looking like the same question. This lesson builds the claim-level judge, prices it, and reads the gap
between two prompts on the same twenty items.

## Why it matters

[8.1](lesson-01.md) ended with three answers that were wrong in the same way: the right passage was in the
prompt and the sentence that came back said something else. One invented number in an otherwise correct
answer is not a rounding error in the user's day. It is the sentence they forward to their manager.

So you write a judge. The first one you write is the obvious one — take the question, the passages and the
answer, ask for `PASS` or `FAIL`, done. It runs in an afternoon and it produces a number, and on the module's
corpus it reads **80.0% grounded**.

That number is a lie, and you cannot see it by reading the number. The judge's five false alarms are g07,
g13, g15, g18 and g20 — four fabrications and one item where every variant of the system answered `I cannot
help with that.` to a question the passage answers in six words. The judge scored that refusal as **grounded**,
on four of its five recorded calls, because a refusal contains no claim and is therefore consistent with any
passage set you put in front of it.

That is not a bad prompt. That is a granularity that cannot represent the question you are asking.

## How it works

### Split, check, count

Three steps, and none of them is optional:

1. **Split the answer into atomic claims.** One assertion each — a number, a threshold, an entity, a
   condition. Not sentences: `One month, or three for senior staff. It is waived during probation.` is three
   claims, and two of them being right is not the same fact as the answer being right.
2. **Check each claim against the passages you were given**, not against the handbook, not against the model's
   prior. A claim the passages do not support is ungrounded even when it is true in the world.
3. **Count ungrounded claims, and say the denominator.** `15 of 38 claims` and `9 of 20 answers` are two
   different measurements and you need both.

Here is the ledger for variant B, split by hand. The lab ships no claim splitter — this table is the thing
you build, so it is written out rather than read off a tile:

| Item | Answer | Claims | Ungrounded |
|---|---|---|---|
| g01 | `At most 5 unused days carry over into the next year; anything above that is lost.` | 2 | 0 |
| g02 | `You can carry over at most 10 unused days, and there is no expiry on them.` | 2 | **2** — passage says 5, and says above 5 is lost |
| g06 | `One month, or three for senior staff. It is waived during probation.` | 3 | 0 |
| g13 | `Two years, because of a regulatory retention requirement.` | 2 | **2** — passage says 90 days; the reason appears nowhere |
| g20 | `I cannot help with that.` | **0** | 0 — and the human label is a failure |

Variant B across all twenty answers: **38 claims, 15 ungrounded — 39.5%** — carried by **9 of 20 answers,
45.0%**. The claim-level rate is lower than the answer-level rate, and that is the whole reason it is worth
having: the number moved because the unit moved, not because the system improved.

### What zero claims does to a binary verdict

Read the g20 row again. Zero claims, zero ungrounded claims, a ratio of `0/0` — and a user who asked about
remote work and got nothing.

At the answer level the binary has no way to say that. `I cannot help with that.` is trivially consistent with
the remote-work passage, so an answer-level grounding judge passes it, and it passed it on four of five
recorded calls. At the claim level the answer also "passes" — vacuously — but now the *count* tells you
something: this answer made no claim, and a made-no-claim answer needs a second question, not a better grade.

That second question is `should_have_abstained`, and it belongs in a different tile. **Claim counting does not
fix refusals; it makes them visible enough to route elsewhere.** [8.3](lesson-03.md) is that other tile.

### The cost, which is about two claims per answer

Variant B averages **1.9 claims per answer** (38 over 20). At the menu prices:

| | Per call | 20 answer-level verdicts | 38 claim-level verdicts |
|---|---|---|---|
| `Qwen3 1.7B · Plain` | $0.02244, 380 ms | $0.4488 | $0.8527 |
| `Llama 3.2 3B · Stepwise` | $0.03794, 540 ms | $0.7588 | **$1.4417** |
| `Prometheus 2 7B · Stepwise` | $0.09872, 1250 ms | $1.9744 | $3.7514 |

Claim granularity roughly doubles the bill on this corpus — 1.9× on a short-answer handbook, more on a system
that writes paragraphs, because paragraph-shaped answers decompose into a lot of claims. And you pay for the
split step on top, whether it is a model call or a sentence splitter.

It is still cheap, and the reason to spend it is not the rate. It is that a claim-level judge can fail
**one claim and say which**, so the disagreement list from [6.3](../module-06/lesson-03.md) becomes a list of
sentences to fix rather than a list of answers to re-read.

### The prompt is the whole difference, and you cannot read it

Three grounding judges sit on the menu. The dataset carries a label for each — `Plain binary prompt` for
`g-plain`, `Stepwise, one question per rule` for `g-claim` and `g-strict` — and **not the prompt text**. The
page cannot show you what the judge was asked. That is worth knowing before you trust anything else on it: a
judge whose prompt you cannot read is a judge whose behaviour you can only describe by its outputs.

What the outputs say, on variant B, all 20 items, greedy first sample:

| Grounding judge | Grounded | Kappa | TPR | TNR | Confusion |
|---|---|---|---|---|---|
| `Qwen3 1.7B · Plain` | **80.0%** (60.0%–95.0%) | 0.47 (0.14–0.80) | 100.0% | **44.4%** | `tp 11, fp 5, fn 0, tn 4` |
| `Llama 3.2 3B · Stepwise` | 60.0% (40.0%–80.0%) | 0.69 (0.31–1.00) | 90.9% | **77.8%** | `tp 10, fp 2, fn 1, tn 7` |
| `Prometheus 2 7B · Stepwise` | 60.0% (40.0%–80.0%) | **0.90** (0.63–1.00) | 100.0% | **88.9%** | `tp 11, fp 1, fn 0, tn 8` |

Read the first column against the last one. **The plain judge reports the highest grounded rate and catches the
fewest real faults.** Denominators: variant B has 11 human-grounded answers and 9 human failures, so those TNRs
are 4/9, 7/9 and 8/9 — the plain judge waves through 5 of 9, the stepwise judges wave through 2 and 1. That is
a 44-point gap in TNR and a 20-point gap in reported quality, pointing in opposite directions.

On variant A the same spread is wider: TPR/TNR of **91.7% / 50.0%** (kappa 0.44) for the plain judge against
**100.0% / 100.0%** (kappa 1.00) for the stepwise one. On variant C: **100.0% / 45.5%** against **88.9% /
100.0%**.

> [!IMPORTANT]
> Read the denominators before you read the spread. The three menu entries differ in **model and prompt at
> once** — `g-plain` is a 1.7B model on the plain prompt, `g-claim` is a 3B model on the stepwise one — so this
> table cannot tell you the prompt did it. What it does isolate is the behaviour each entry actually produces
> on these twenty answers, and the behaviour is not subtle: the plain judge is the only entry of the three
> that passes the refusal `g20` on the variant the presets open on, and it does so on four of its five
> recorded calls (`g-plain` v2: pass, pass, pass, pass, fail; both stepwise entries: five fails).

### The category where each one earns or loses its TNR

Per-category agreement on variant B, greedy, from the same table — this is the view that says which number is
doing the work:

| Category | Items | `g-plain` | `g-claim` | `g-strict` |
|---|---|---|---|---|
| `grounded` | 11 | 11/11 | 10/11 | 11/11 |
| `ungrounded` | 7 | **3/7** | 5/7 | 6/7 |
| `should_have_abstained` | 1 | 1/1 | 1/1 | 1/1 |
| `over_refusal` | 1 | **0/1** | 1/1 | 1/1 |

The `ungrounded` row is the size argument and the `over_refusal` row is the shape argument. A whole-answer TNR
of 44.4% looks uniform; per category it is 100% on one category, 43% on another and 0% on a third, and those
three numbers want three different fixes.

### One number that will not survive contact with the panel

Before leaving: the panel reads **Grounded (judge) 80.0%** for the plain judge, and the plain judge is the one
that waves through 5 of 9. A pass rate rewards leniency by construction — the judge that passes everything
tops the table — so **on this lab the grounded rate is not a measure of the system, it is a measure of the
judge's generosity and the system's grounded rate at the same time.** [6.2](../module-06/lesson-02.md) measured
that on the support set; the RAG lab reproduces it in a different place, which is what makes it a habit rather
than an anecdote.

## Show me

The preset opens on variant B with `Qwen3 1.7B · Plain`, **all 20 items**, greedy first sample:

| Tile | Value |
|---|---|
| Grounded (judge) | **80.0%** (60.0%–95.0%) |
| Kappa vs humans | **0.47** (moderate, 0.14–0.80) |
| TPR | **100.0%** |
| TNR | **44.4%** |

Confusion `tp 11, fp 5, fn 0, tn 4`. Then, in order:

1. **Switch the Grounding judge dropdown to `Llama 3.2 3B · Stepwise`.** Grounded drops to **60.0%**
   (40.0%–80.0%), kappa rises to **0.69** (0.31–1.00), TPR **90.9%**, TNR **77.8%**, confusion `tp 10, fp 2,
   fn 1, tn 7`. The dashboard got 20 points worse and the judge got 33 points better at catching faults.
2. **Switch to `Prometheus 2 7B · Stepwise`.** Grounded **60.0%** (40.0%–80.0%), kappa **0.90** (0.63–1.00),
   TPR **100.0%**, TNR **88.9%**, confusion `tp 11, fp 1, fn 0, tn 8`. One false alarm left on the whole run.
3. **Read the intervals before you read the gap.** 60.0%–95.0% against 40.0%–80.0% overlap heavily, so the
   20-point pass-rate difference is not resolvable on 20 items and you should not claim it. The TNR
   difference is a statement about four named items versus one named item, and that you *can* act on.
4. **Read the list at the bottom each time.** Under `g-plain` it reads *(5)* and names g07, g13, g15, g18,
   g20 — all false alarms. Under `g-strict` it reads *(1)* and names g15. Under `g-claim` it reads *(3)*:
   g07, g10, g17, where g17 is the one grounded answer it wrongly failed.
5. **Do the claim ledger yourself on three items.** g01, g02 and g20 from the table above. Then set the
   "Questions" knob to 5 and watch every judge read kappa 1.00 — the reminder from
   [4.4](../module-04/lesson-04.md) that a rate without its `n` is a decoration.

> [!NOTE]
> Every verdict behind those tiles comes from a seeded educational model of judge behaviour, not from a live
> LLM; the model names in the Grounding judge menu — Qwen3 1.7B, Llama 3.2 3B, Prometheus 2 7B — are the
> labels recorded runs are filed under. Every statistic is computed for real in your browser from those
> recorded verdicts. The claim counts in the tables above are counted by hand from the shipped answers and
> passages; the lab ships no claim splitter, because building one is the exercise.

## Try it

**Predict first**, before opening the page:

1. The plain judge reports 80.0% grounded and the stepwise judge reports 60.0%, on the same twenty answers.
   Which number should a release gate be built on, and what does the difference tell you about the other one?
2. `I cannot help with that.` is checked against a passage that says remote work is allowed three days a
   week. A claim-level judge splits it into zero claims and finds zero ungrounded claims. Does that fix the
   problem, and if not, what check does?
3. Two judges differ in both model size and prompt shape. What can the table establish about which change
   caused the 33-point TNR gap, and what would you need to add to establish it?

[Simulation: judge-lab](../../simulations/rag-evals/index.html?preset=grounding)

1. **Write the four-cell confusion yourself for all three judges.** The page gives you the counts; the work is
   the TPR denominator (11 for variant B) and the TNR denominator (9). Before clicking anything, predict which
   of the five false alarms each judge will share and which will be private to the plain judge.
2. **Ledger three answers claim by claim.** Take g02, g13 and g18 and split each into atomic claims against the
   passage. Then answer: does any of the three contain a claim that is right, wrong, and separately wrong?
   Record what the answer-level binary would have told you instead.
3. **Price the granularity.** Compute the cost of 38 claim verdicts and 20 answer verdicts at each of the three
   menu prices. Then work out what a claim-level judge costs on a system that writes 120-word answers with
   about six claims each, at 200 items, and say whether the number would still be small.
4. **Find where each judge's TNR is earned.** Read the per-category table, then use the bottom list to name the
   items `g-plain` misses that `g-strict` catches. Then write the one sentence you would put in the runbook
   about `over_refusal`, using the g20 samples as your evidence.
5. **Test the "repeats will fix it" reflex.** Five repeats are recorded per item. On variant A, the majority
   verdict for `g-plain` reads kappa **0.15** and TNR **12.5%**, against greedy **0.44** and **50.0%**.
   Work out why voting made that judge worse, and say what [7.5](../module-07/lesson-05.md) would say about it.

## Break it

**Ship the grounded pass rate as the headline.** 80.0% for variant B, and variant B is the system that
confabulates on three of the three empty-retrieval questions. A pass rate is one-sided by construction, so the
lenient judge wins it. The lie: **a rate with no rate beside it measures the judge's generosity and is read as
the system's quality.**

**Judge the whole answer with the passages nowhere in the prompt.** That is the `Plain binary prompt` shape,
and it fails 5 of 9 — the same failure the plain judge in [6.2](../module-06/lesson-02.md) shows on the
support set, where it passes 23 of 47 real faults. The lie: **the grounding judge was asked whether the answer
sounds right while the object that could make it sound wrong sat outside its context.**

**Split into claims and still score the answer binary.** You paid 1.9× for the granularity and threw it away
at the last step. The lie: **granularity you do not report is a cost with no return** — you cannot rank two
answers at 1-of-3-claims ungrounded against 2-of-2.

**Trust the list's heading.** *Ungrounded answers the judge missed (5)* is `human !== judge`. On variant B
with `g-plain`, all five are false alarms and none is a missed fault. The lie: **a count under a heading that
names one direction can be counting the other, and the disagreement review you build on top of it inherits
the error.**

## Fix it

1. **Put the passages in the judge prompt, verbatim, and ask one question per rule.** That is what the
   `Stepwise, one question per rule` entry is, and it is worth 33 points of TNR over the plain prompt on these
   twenty answers — a result about *these* runs, not about prompts in general. Ship the retrieved passages in
   the same payload you send the user, never a summary of them.
2. **Report two rates with two denominators.** `15/38 claims ungrounded (39.5%)` and `9/20 answers carrying an
   ungrounded claim (45.0%)`. The first tells you how much text is unsupported; the second tells you how often a
   user would see it. One of the two without the other is a number nobody can act on.
3. **Gate on TNR, report kappa, and name the category.** For variant B: TNR **44.4%** (4/9) fails the 0.70
   floor from [6.2](../module-06/lesson-02.md); **77.8%** (7/9) clears it; **88.9%** (8/9) clears it with one
   false alarm. Then print the per-category table — 3/7, 5/7, 6/7 on `ungrounded` and 0/1, 1/1, 1/1 on
   `over_refusal` — because the totals hide that one judge is perfect on one category and useless on another.
4. **Keep an abstention check separate, and run it on every item.** Any answer with **zero claims** is routed to
   the abstention metric from [8.3](lesson-03.md), not scored as a pass. Zero claims is a routing signal, not
   a good result, and it is the only way the `g20` failure is ever going to be caught.

## How do I know it works?

**Challenge, on dev.** Take items 1–14 as the dev set and require:

- **TNR ≥ 0.85 on dev with the denominator written next to it.** On items 1–14 of variant B the three judges
  read **66.7%** (4/6), **66.7%** (4/6) and **100.0%** (6/6). The two plain-ish readings fail; the stepwise
  7B passes. Six failures is a small denominator and you should say so in the runbook.
- **TPR ≥ 0.90, so the judge cannot buy TNR by refusing everything.** Dev readings: **100.0%**, **100.0%**,
  **100.0%**. All three clear it, and on the full 20 `g-claim` slips to **90.9%** — worth watching.
- **Per-category TNR above the floor, with the weak category named.** On items 1–14 of variant B the six human
  failures are five `ungrounded` answers plus one `should_have_abstained`, and `g-strict` catches all six —
  which is the profile you want: the difficulty is concentrated in one category, and it is the one this lesson
  is about.

**Then one held-out validation** on items 15–20, read once:

| Grounding judge, variant B | Dev (n = 14) TNR | Held-out (n = 6) TNR | Held-out kappa |
|---|---|---|---|
| `Qwen3 1.7B · Plain` | 66.7% (4/6) | **0.0%** (0/3) | 0.00 (0.00–0.00) |
| `Llama 3.2 3B · Stepwise` | 66.7% (4/6) | 100.0% (3/3) | 0.67 (0.00–1.00) |
| `Prometheus 2 7B · Stepwise` | 100.0% (6/6) | 66.7% (2/3) | 0.67 (0.00–1.00) |

Read the last column before the middle one. Three held-out failures produces intervals a third of the scale,
and on a denominator of 3 the honest statement is "no evidence against", not "held". What you *can* say is
that the plain judge caught none of the three, the stepwise 3B caught all three and the 7B caught two, and
that the 7B — the only one that passed dev — did not hold a perfect held-out rate. Choosing a judge on 14 items
and reporting those 14 items would have shipped the worst of the three.

## Use / don't use

**Do build the claim split if you need to explain a failure.** "Sentence 2 of the answer is unsupported" is a
fix; "this answer failed grounding" is a re-read. That is the return on the 1.9×, and it is the only one.

**Do use a stepwise prompt with the passages in the payload.** The measured gap here is 44.4% to 77.8% TNR on
the same 20 answers, and the mechanism is the same one Module 6 measured: a judge with no clause that catches
anything catches nothing.

**Do keep answer-level and claim-level rates both.** They move differently. When a prompt change adds a
sentence, the claim rate rises and the answer rate may not — only the claim rate sees it.

**Don't assume a claim splitter is free.** Splitting, checking and aggregating are three operations; the price
above counts the checking. On long-form answers the split is the expensive half.

**Don't read a grounded pass rate as quality.** It is a joint property of the judge and the answers. Publish
it only beside TPR, TNR and kappa, as [6.2](../module-06/lesson-02.md) argued, and gate on TNR.

What teams actually do: put the retrieved passages into the judge payload verbatim, ask one question per claim
with a `SUPPORTED` / `NOT SUPPORTED` / `PARTIAL` response, and log the claim text next to the verdict so a
disagreement review can be done on sentences. A zero-claim answer goes to the abstention metric. And the
judge prompt lives in version control next to the system prompt, because a grounding judge you cannot read is
one you cannot fix.

## Reflect

1. The plain judge reads 80.0% grounded and catches 4 of 9 faults; the stepwise judge reads 60.0% and catches
   7 of 9. Write the sentence you would put in a release note, and say which of the two numbers you would
   show a stakeholder who asks "is the bot making things up?"
2. `g20` produces zero claims under any granularity, and all three judges fail it or pass it depending on
   prompt. Design the check that catches it, and say what it costs per answer relative to the claim check.
3. Your claim-level judge reads 39.5% ungrounded claims on variant B today. You add one sentence to the
   system prompt asking for a citation. What would the claim rate, the answer rate and TNR each do, and which
   of the three would you trust to tell you the sentence helped?

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- Shahul Es et al., [RAGAS: Automated Evaluation of Retrieval Augmented
  Generation](https://arxiv.org/abs/2309.15217) (2023) — where faithfulness is defined against the retrieved
  context rather than against a reference answer, which is the choice this lesson's claim check makes.
- Jacob Saad-Falcon et al., [ARES: An Automated Evaluation Framework for Retrieval-Augmented Generation
  Systems](https://arxiv.org/abs/2311.09476) (2023) — a trained classifier over multiple RAG signals, and the
  argument that the classification target has to be defined before the model can be trusted on it.
- Lianmin Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot
  Arena](https://arxiv.org/abs/2306.05685) (2023) — the reference design for whole-answer judges. The stepwise
  grounding entry is that design with the passages added, and the gap it closes on this corpus is the same
  effect Module 6 measured on the support set.