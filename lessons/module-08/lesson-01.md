---
id: "08.1"
module: 8
minutes: 17
practice_minutes: 45
prerequisites: ["07.5", "03.1", "05.3"]
objectives:
  - Separate a retrieval metric from an answer metric on one set of items, and say which of the two the user is complaining about.
  - Build the RAG failure taxonomy by reading retrieved passages rather than inventing a parallel one, and assign each of twenty traces one label.
  - Explain why a green context-recall number is not evidence that a RAG feature works, using the gap between two rates on the same twenty questions.
volatility: concept
sources:
  - title: "RAGAS: Automated Evaluation of Retrieval Augmented Generation (Es et al., 2023)"
    url: https://arxiv.org/abs/2309.15217
  - title: "Retrieval-Augmented Generation for Large Language Models: A Survey (Gao et al., 2023)"
    url: https://arxiv.org/abs/2312.10997
  - title: "Citation Needed: A Study of Verifiability in Generative Search Engines (Shuster et al., 2021)"
    url: https://arxiv.org/abs/2102.03929
last_verified: "2026-10-01"
---

# 08.1 · Retrieval failures and answer failures

A RAG feature has two halves that fail for different reasons and get measured by different numbers, and only one
of those numbers corresponds to the sentence a user types into a ticket. This lesson puts them on one chain so
you can see which link is broken, using twenty handbook questions whose retrieved passages ship inside the dataset
so you can check every claim yourself.

## Why it matters

A team ships a handbook assistant. Their dashboard has one headline: **context recall 94%**. It is a good
number, it went up eleven points in the sprint, and the retrieval work is done.

Then a support ticket arrives. A user pastes a sentence back at the bot — `The Data Engineer band starts at
85,000 and tops out at 110,000` — and asks where that came from. Nobody in the company publishes salary bands.
The handbook does not contain that number anywhere, the user has quoted it back as if it were policy, and the
person who filed the ticket will not un-send it.

Nobody can answer the obvious question from the dashboard. Did retrieval fail, or did the model invent it? The
user's sentence is identical in both cases, because from the outside "the bot made that up" is what a retrieval
miss looks like and what a generation failure looks like. The difference is visible only upstream of the model,
and upstream of the model is exactly where a retrieval-only dashboard is not looking.

That is the failure this lesson is about, and it is not a prompting bug. It is a measurement bug with a very
long half-life: the wrong number is green, so nothing triggers.

## How it works

### One chain, three numbers

Put the three rates end to end on the same twenty questions. Every one of them is computable from this
dataset, and every interval below is a Wilson interval from the shipped statistics engine.

| Link | Question it answers | Rate on the 20 items | Wilson 95% |
|---|---|---|---|
| Did retrieval fire? | did *anything* come back | **85.0%** (17/20) | 64.0%–94.8% |
| Did it come back relevant? | does the passage answer the question | **70.0%** (14/20) | 48.1%–85.5% |
| Is the answer grounded? | does every claim trace to a passage | see below | |

Fifteen points are lost at the second link, on this corpus. Retrieval returned *something* on g04 — a salary
question got the **Expense policy** passage, the one about receipts — and a metric that checks "did the
retriever return results?" scores that as a success.

Now the third link. This is the human label the dataset ships per item, and it is a property of the **answer**:

| System | Grounded answers | Rate | Wilson 95% |
|---|---|---|---|
| A — grounded, abstains when nothing is retrieved | 12/20 | **60.0%** | 38.7%–78.1% |
| B — never told to abstain | 11/20 | **55.0%** | 34.2%–74.2% |
| C — small model | 9/20 | **45.0%** | 25.8%–65.8% |

Variant B loses another fifteen points going from "the right passage was in hand" to "the answer used it". Two
drops of the same size, one on each side of the model, and a dashboard carrying only the first.

### The part that is decidable by inspection

The reason this module can make claims the other modules had to argue for is one line of dataset design: **the
passages retrieval actually returned are in the data**, including the fact that on three of the twenty
questions it returned an empty array. There is no ranker to run, no index to rebuild and no judge to trust —
for every one of the twenty items you can hold the question, the passage and the answer side by side and decide.

So split the twenty by reading them:

- **Retrieval hit (14 of 20, 70.0%)** — the passage answers the question: g01, g02, g03, g05, g06, g09, g10,
  g11, g12, g13, g14, g17, g19, g20.
- **Retrieval miss (6 of 20, 30.0%)** — nothing usable came back: g04 (expense policy for a salary question),
  g07, g08, g15 (empty array), g16 (parental-leave passage for a crèche question), g18 (password-rotation
  passage for an incident-reporting question).

Now the number that matters. Restrict to the 14 retrieval hits — where the correct passage was in the model's
context, and every remaining fault is the model's — and count human-grounded answers:

| System | Grounded among the 14 retrieval hits | Rate | Wilson 95% |
|---|---|---|---|
| A | 10/14 | **71.4%** | 45.4%–88.3% |
| B | 10/14 | **71.4%** | 45.4%–88.3% |
| C | 8/14 | **57.1%** | 32.6%–78.6% |

Four of the fourteen answers are still wrong for variants A and B, with the right passage sitting in the prompt.
Three of them are one invented number each, and you can read them without a judge:

| Item | Question | Passage says | Answer says |
|---|---|---|---|
| g02 | carryover limit for unused PTO | `at most 5 unused days` | `at most 10 unused days, and there is no expiry` |
| g10 | when do performance reviews happen | `Twice a year, in January and July` | `Once a year, each December` |
| g13 | how long are customer logs kept | `90 days, then they are deleted automatically` | `Two years, because of a regulatory retention requirement` |

The fourth, g20, is the opposite fault and the same mechanism: the passage says remote work is allowed up to
three days a week, and all three systems answer `I cannot help with that.` Section [8.3](lesson-03.md) is
about that one.

### Setting the category vocabulary

This is the Module 2 move applied to a new surface, not a new taxonomy. Open-code twenty traces, write a note
on each, group the notes under one label each — [2.2](../module-02/lesson-02.md) and
[2.3](../module-02/lesson-03.md). The four answer-side labels are the ones the dataset ships on every item, so
your confusion matrix has four cells for free:

| Label | What it means | Shipped on which variants | Fix belongs to |
|---|---|---|---|
| `grounded` | every claim traces to a supplied passage | all three | — |
| `ungrounded` | the answer states something no passage supports | A 7, B 7, C 9 | the answer |
| `should_have_abstained` | nothing usable retrieved, the system answered anyway | B 1, C 1 | the prompt |
| `over_refusal` | the passage answers the question and the system refused | A 1, B 1, C 1 | the prompt |

And one retrieval-side label you assign yourself, by reading the passages, because the dataset does not ship it:

| Label | Items | What it tells the team |
|---|---|---|
| retrieval miss | g04, g07, g08, g15, g16, g18 | work belongs in the retriever or the index |

> [!IMPORTANT]
> The split matters because the two halves have different owners and different fixes. `ungrounded` is a
> generation problem and a prompt problem; a retrieval miss is a chunking, embedding or query-rewrite problem.
> A ticket says "it made that up" and tells you neither. Your eval has to tell you which, and the only way it
> can is by shipping the passages into the eval — which is why this lab does, and why a RAG eval set that does
> not store them is a RAG eval set that cannot tell you what went wrong.

### Why a code check is the first thing to reach for

Two of the three failures above are decidable without a model at all, which is the [3.1](../module-03/lesson-01.md)
point in a new costume. If your answers are generated from the passages you pass in, the numbers in them are
checkable with an assertion; the passages and the answers are both in the run record, so `assert 5 == 5` in the
extracted number is a real check and it costs nothing. That is also the natural ceiling on the claim-level judge
in [8.2](lesson-02.md): if you can extract and compare the number yourself, do not pay a judge to tell you
whether the number matches.

## Show me

This lesson's preset opens the lab on variant B — **never told to abstain** — with the default grounding judge
`Qwen3 1.7B · Plain`, on **all 20 items**, greedy first sample. The four tiles read:

| Tile | Value |
|---|---|
| Grounded (judge) | **80.0%** (60.0%–95.0%) |
| Kappa vs humans | **0.47** (moderate, 0.14–0.80) |
| TPR | **100.0%** |
| TNR | **44.4%** |

and the confusion table reads `tp 11, fp 5, fn 0, tn 4`. Under it, the line that is the whole lesson:

> Retrieval recall cannot see any of this. The right passage was retrieved and the answer still invented a
> number.

Do this, in order:

1. **Count the denominators yourself before touching the page.** 11 of the 20 variant-B answers are
   human-grounded, so TPR is 11/11 and TNR is 4/9. Those two fractions are the whole story; the tiles are
   arithmetic on them.
2. **Switch the System dropdown to `A — grounded, abstains when nothing is retrieved`.** Grounded **75.0%**
   (55.0%–90.0%), kappa **0.44** (moderate, 0.00–0.80), TPR **91.7%**, TNR **50.0%**, confusion `tp 11, fp 4,
   fn 1, tn 4`. The better system gets a *lower* grounded rate. Hold that for [8.2](lesson-02.md).
3. **Switch to `C — small model`.** Grounded **75.0%** (55.0%–95.0%), kappa **0.43** (0.14–0.71), TPR
   **100.0%**, TNR **45.5%**, confusion `tp 9, fp 6, fn 0, tn 5`. All three systems land between 75% and 80% on
   the same judge while their human labels sit between 45% and 60%.
4. **Read the list under the table.** On variant B with this judge the panel reads *Ungrounded answers the
   judge missed (5)* and names g07, g13, g15, g18, g20. Every one of those is a case where the judge said
   **pass** and the human said **fail** — false alarms, the safe direction. Not one is a grounded answer the
   judge missed. The heading names one of the two things the count contains; that is [8.2](lesson-02.md)'s
   first break.

> [!NOTE]
> Every verdict behind those tiles comes from a seeded educational model of judge behaviour, not from a live
> LLM; the model names in the Grounding judge menu — Qwen3 1.7B, Llama 3.2 3B, Prometheus 2 7B — are the
> labels recorded runs are filed under. Every statistic is computed for real in your browser from those
> recorded verdicts, and the passages, questions, answers and human labels in this dataset are generated for
> teaching. The counts are a property of this corpus, not a measurement of any RAG system in the wild.

## Try it

**Predict first**, on paper:

1. A RAG feature's dashboard says context recall is 94% and a user reports the bot stated a salary band that
   does not exist. Which of the two numbers below tells you whether retrieval or generation failed, and why
   does the ticket not tell you?
2. On this corpus, 17 of 20 questions got a passage back and 14 of 20 got a *relevant* one. What does that
   15-point gap tell you about a metric that stops at the first number?
3. Variant A is human-grounded on 12 of 20 answers and variant B on 11. Is one point of 20 enough evidence to
   rank them? Compute the interval before you answer.

[Simulation: judge-lab](../../simulations/rag-evals/index.html?preset=grounding)

1. **Split the twenty by hand, then compare with the labels.** Read each item's question and passage and write
   `hit` or `miss` on your own sheet before you look at anything else. You should land on 14 hits and 6 misses,
   with g04, g07, g08, g15, g16 and g18 on the miss side. Then work out, for variant B, how many of the 14 hits
   are human-grounded — 10 — and name the four that are not.
2. **Write the three-number chain on your own dashboard.** `retrieval fired 85.0%`, `retrieval relevant 70.0%`,
   `answer grounded 55.0%`. Now find the four answers on the 14 retrieval hits that are still ungrounded and
   read the passage beside each one. That is the work a context-recall tile cannot do.
3. **Check whether the judge can tell generation faults from retrieval ones.** On variant B the judge waves
   through g07, g13, g15, g18 and g20. Sort those five into retrieval misses and answer-side faults. Then say
   what a single "grounded" number would have cost you on each side of that sort.
4. **Price the cheap half of the check.** The cost table under the tiles reads 860 input and 36 output tokens,
   380 ms, **$0.02244** a call for `Qwen3 1.7B · Plain`; **$0.03794** for `Llama 3.2 3B · Stepwise`;
   **$0.09872** for `Prometheus 2 7B · Stepwise`. Twenty greedy verdicts cost **$0.4488**, **$0.7588** and
   **$1.9744**. Work out how many of the 14 retrieval hits you could check with a string assertion for free,
   and what you would still need the judge for.
5. **Find the item that breaks both halves.** g18 asks for the security incident reporting deadline and the
   retrieval returned the password-rotation passage. The answer says `within 24 hours`. Decide: retrieval
   fault, generation fault, or both, and say which fix you would ship first.

## Break it

**Ship context recall as "the RAG eval".** 94% recall means the retriever put *a* candidate passage in the
top *k*. On this corpus that metric is 85.0%, and 15 points of it is a passage about receipts being handed to
a question about salary. The lie is named: **a retrieval number describes the retriever, and the sentence the
user typed describes the whole system.**

**Keep the answer metric off the dashboard because retrieval "covers" it.** Retrieval does not cover it. On the
14 items where the passage was right, four answers were still wrong. The lie: **a green upstream number is
treated as a licence to stop measuring downstream**, which is the move [1.3](../module-01/lesson-03.md) is
about in its general form and the one this module exists to block.

**Trust the heading over the count.** *Ungrounded answers the judge missed (5)* lists five items, all of them
false alarms. The count is `human !== judge`, both directions, under a name that describes one. The lie:
**a list whose title promises a direction can be counting the other one, and nothing on the page will tell
you.**

**The free one: report the grounded rate with no `n`.** `55.0%` on 20 items and `71.4%` on 14 items are both
sentences a slide can carry; the first is over a set where a third of the questions were unanswerable, the
second is over the set where retrieval worked. Same format, different populations — the trap from
[4.4](../module-04/lesson-04.md) wearing RAG clothes.

## Fix it

1. **Publish the chain, not one link.** Three tiles with their denominators: retrieval fired, retrieval
   relevant, answer grounded. On this corpus that is **17/20**, **14/20** and **11/20** for variant B. Nobody
   has to guess which link broke, and the tiles cost nothing extra — every one of them is a count over items
   you already have.
2. **Split the labels by side before you look at any rate.** `ungrounded` on a retrieval hit is a generation
   bug; `ungrounded` on a retrieval miss is a retrieval bug wearing a generation costume. Report the answer-side
   rate *within* the retrieval-hit slice first, because that slice is the only one where the answer is entirely
   responsible — 10/14 for variants A and B, 8/14 for C.
3. **Store the passages in the eval record, keyed to the item.** It costs a few hundred bytes per item and it
   is the only reason anyone will be able to read the failure list in six months. A RAG eval that logs the
   answer but not the retrieved context has thrown away the half of the trace that decides the ticket.
4. **Reach for the assertion first.** Any number, date, threshold or entity in the answer that also appears in
   the passages is a code check from [3.1](../module-03/lesson-01.md). `g02` says 10 where the passage says 5;
   that is a string comparison, not a $0.02244 call. Spend the judge on the claims your extractor cannot reach.

## How do I know it works?

**Challenge, on dev.** Take the first 14 items as your dev set and require all three of these:

- **The chain is published with all three denominators.** 85.0%, 70.0% and 55.0% for variant B on 20; on the
  14-item prefix, 85.7% retrieval fired, 78.6% relevant, 57.1% grounded.
- **Every retrieval miss is a labelled item.** On the first 14 items there are 3 — g04, g07, g08 — and on the
  last 6 there are 3 more — g15, g16, g18. That is **21.4% of the dev prefix against 50.0% of the held-out
  tail**, and it is the whole reason a 14-item dev set is the wrong size for this eval: it halves the share of
  the failures you are trying to catch. Size the set for the category, as [4.3](../module-04/lesson-03.md)
  says.
- **The four answer-side categories exist on every item**, so the confusion matrix has four cells and a
  per-category table is one group-by away.

**Then one held-out validation**, on items 15–20, read once:

| | Dev, items 1–14 | Held-out, items 15–20 |
|---|---|---|
| Retrieval misses | 3 of 14 (21.4%) | 3 of 6 (50.0%) |
| Variant B human-grounded | 8 of 14 (57.1%) | 3 of 6 (50.0%) |
| `g-plain` TNR on variant B | 66.7% (4/6) | 0.0% (0/3) |

The judge — not the system — is what falls apart here, and it is the reason [8.4](lesson-04.md) exists. Read
the TNR row last and do not act on it yet: three failures is a denominator you cannot build a gate on.

## Use / don't use

**Do keep retrieval and answer rates on the same board.** Two tiles from the same items beat one tile that is
half a system. The cost of the answer-side number is a judge call or a code check; the cost of not having it is
a ticket you cannot classify.

**Do slice the answer metric by retrieval outcome first.** On a slice where retrieval always worked, the
grounded rate measures the generator. Everywhere else it is a blend, and a blended number cannot tell a team
whose problem it is.

**Do record the passages with the answers.** This is the cheapest thing on the page and the one teams skip,
because it is invisible in a dashboard and obvious in a postmortem.

**Don't quote context recall as a quality score, and don't compare two systems on it.** Two teams with
identical generation and different retrievers differ enormously on recall and identically on what the user
experiences. The user experiences the third number.

**Don't build a judge for what an assertion can check.** The cost ordering has not moved since
[3.4](../module-03/lesson-04.md): a code check is free, `Qwen3 1.7B · Plain` is $0.02244 and 380 ms,
`Prometheus 2 7B · Stepwise` is $0.09872 and 1250 ms, a human is your afternoon. Twenty verdicts at the
dearest setting cost $1.9744; on 200 items that is $19.744 a run, which is a line item somebody has to approve.

What teams actually do: run the chain nightly against a frozen item set, put the two rates next to each other
with their `n`, and treat a drop in the *grounded-among-hits* slice as the alarm — because a drop in retrieval
fires a different engineer than a drop in grounding, and a dashboard that only shows one of them routes every
incident to the same person.

## Reflect

1. Your dashboard leads with context recall 94% and the support queue has eleven tickets of the form "where
   did that number come from?". Write the two sentences you would send the team that close the top gap, and
   say which of the three chain links you would instrument first.
2. Variant A is human-grounded on 12 of 20 answers, variant B on 11. Both intervals are over 35 points wide.
   Write the sentence that tells a stakeholder what you actually know from these two numbers, and say what you
   would need to collect to rank them.
3. g04 hands a salary question the expense-policy passage. If the model had been told to abstain on
   insufficient context, would g04 have been caught? Work it through the label it would carry and say which
   number on the chain would have moved.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- Shahul Es et al., [RAGAS: Automated Evaluation of Retrieval Augmented
  Generation](https://arxiv.org/abs/2309.15217) (2023) — the separation of retrieval-side and answer-side
  metrics into named families, which is the distinction this module's chain is an instance of.
- Yunfan Gao et al., [Retrieval-Augmented Generation for Large Language Models: A
  Survey](https://arxiv.org/abs/2312.10997) (2023) — why retrieval quality and generation faithfulness are
  scored separately, and what each family's numbers do and do not tell you.
- Kurt Shuster et al., [Citation Needed: A Study of Verifiability in Generative Search
  Engines](https://arxiv.org/abs/2102.03929) (2021) — the underlying observation that a fluent answer can be
  wholly unsupported, and that attributing it back to a source is a separate measurement from generating it.