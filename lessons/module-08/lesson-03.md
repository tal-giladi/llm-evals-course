---
id: "08.3"
module: 8
minutes: 16
practice_minutes: 40
prerequisites: ["08.2"]
objectives:
  - Measure abstention and over-refusal as two separate rates with two denominators, and say why one combined refusal number hides both.
  - Reconcile a shipped abstention tile with the behaviour it claims to measure, using an item the tile reports as handled and the trace shows fabricated.
  - Write the one-sentence prompt change that removes a confabulation class, and design the eval that would show whether it worked.
volatility: concept
sources:
  - title: "RAGAS: Automated Evaluation of Retrieval Augmented Generation (Es et al., 2023)"
    url: https://arxiv.org/abs/2309.15217
  - title: "Retrieval-Augmented Generation for Large Language Models: A Survey (Gao et al., 2023)"
    url: https://arxiv.org/abs/2312.10997
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 08.3 · Abstention and over-refusal

A RAG system that never says "the passages do not cover this" invents policy; a system that says it too
eagerly refuses questions it already has the answer to. Both faults cost money, they pull the same knob in
opposite directions, and this lesson is about measuring them as two numbers rather than one — and about what
happens when the tile you publish measures the label instead of the behaviour.

## Why it matters

Variant B is a perfectly ordinary handbook assistant. Nothing in its prompt is broken. It scores **55.0%
grounded** on twenty questions and every retrieval-side number looks acceptable.

Now put this in front of it:

> **Q:** Is there an employee share scheme?
> **Retrieved:** *(nothing)*
> **A:** Yes, a 12-week paid internship runs every summer, applications open in January.

That is not a slip about a number. It is a fluent, specific, entirely invented policy, offered to a user who
will act on it. Nobody asked for it; there is no passage behind any part of it. The system was not instructed
to stop, and a model with a question and no evidence will use what it has — which, on an empty retrieval, is
its prior about what companies say.

The obvious fix is to add a line to the prompt telling the model to decline when the passages do not answer
the question. It is one sentence. It costs nothing at inference.

Then somebody on the team gets enthusiastic, tightens the condition, and a week later a user who asked
`When can I work remotely?` — against a passage reading `You can work remotely up to 3 days a week, and only
from a country on the approved list` — gets:

> **A:** I cannot help with that.

Nobody files that one. Nobody forwards it. They just stop asking, and the team's adoption graph flattens
without a single red tile anywhere.

The failure is symmetrical and the second half is quieter, which is exactly why it survives a review.

## How it works

### Two rates, two denominators, always paired

Abstention has two failure directions and each needs its own denominator:

| Rate | Denominator | What one failure costs |
|---|---|---|
| **answered when nothing was retrieved** | items where retrieval returned no usable passage | a user acts on invented policy |
| **refused when the passage answers** | items where a returned passage does answer the question | a user who could have been helped re-asks in Slack |

The denominators are different populations, so the rates cannot be added, averaged, or reported as one
"refusal rate". A system can move either number by editing the same sentence of the prompt, and the two
edits push opposite ways.

### What this corpus actually does

The dataset ships three items where retrieval returned an **empty array** — g07, g08, g15 — and flags two
items as ones where nothing retrieved should be answered at all (`should_abstain`): g08, which returned
nothing, and g16, which returned the **parental-leave** passage for the question `Do you have a crèche?`.
g16 is the harder of the two and it is the one people forget: a passage *came back*, and the right move was
still to decline.

Count by behaviour rather than by label — did the answer make a claim at all:

| System | Answered with nothing retrieved | Declined on a `should_abstain` case | Refused a question the passage answered |
|---|---|---|---|
| A — grounded, abstains when nothing is retrieved | **2 of 3** (g07, g15) | **2 of 2** (g08, g16) | **1 of 14** (g20) |
| B — never told to abstain | **3 of 3** | **1 of 2** (g16) | **1 of 14** (g20) |
| C — small model | **3 of 3** | **1 of 2** (g16) | **2 of 14** (g06, g20) |

Read the first column: **the abstention instruction removed exactly one confabulation in twenty items.** It
is not nothing — it is the difference between an invented internship and an honest "the handbook does not
describe an employee share scheme" — and it is also a single item, which is the size of the evidence you have.

Read the third column: the instruction **did not reduce over-refusal at all** on this corpus. All three
variants refuse g20, where the passage answers in six words. The abstention fix bought the first column and
left the third alone, and a team that only watched one of them would draw the wrong conclusion about which
button did what.

> [!IMPORTANT]
> The denominators are 3, 2 and 14. A 3-of-3 against a 2-of-3 is one item, and the Wilson interval on a
> denominator of 3 spans more than half the scale. Nothing in this table supports a claim that A is "better at
> abstaining" in general. What it supports is a mechanism and a direction, and the honest report says both.

### The tile measures the label, not the behaviour

The lab's abstention panel has four tiles. Open it on variant A and it reads:

| Empty-retrieval questions | Answered anyway | Correctly abstained | Over-refusals |
|---|---|---|---|
| **3** | **0** | **1** | **1** |

That is the best-looking panel in the module, and it is wrong in a way you can only catch by reading the
items underneath it. `Answered anyway` counts items whose **shipped category** is `should_have_abstained`, and
variant A is shipped with `ungrounded` on g07 and g15 — both zero-passage questions it answers with a
fabricated share scheme and a fabricated internship. So the tile reads 0 while the system confabulates on two
of the three questions it was given nothing for.

Both readings are true and they disagree:

| Definition | Variant A | Variant B | Variant C |
|---|---|---|---|
| The shipped `should_have_abstained` label | 0 of 1 failed | 1 of 1 failed | 1 of 1 failed |
| Behaviour: answered a zero-passage question | **2 of 3** | **3 of 3** | **3 of 3** |

A tile that reports the label is a tile that will go green when you relabel your data and change nothing
about the product. That is the failure this lesson is really about.

And the same thing happens on the over-refusal side. Variant C refuses **two** answerable questions —
g06 (`I cannot help with that question.`, over a passage that states the notice period) and g20 — but the
tile reports **1**, because g06 is shipped as `ungrounded`. The rate and the panel are computed over different
definitions of the same word.

### g16 is not on the page

The panel's per-item list is built from the zero-passage items, so it shows g07, g08 and g15. g16 never
appears on the abstention panel at any setting — one passage came back, so the panel does not consider it an
abstention case, even though declining is the only correct move and every one of the three variants gets it
right.

That is the harder half of the lesson in one missing row. **Knowing you have nothing is easy; knowing what
you have is not enough is the skill.** A retriever that returns the nearest chunk for every question will
return something every time, which means the empty-retrieval branch of this metric fires almost never in
production — while the `g16` case fires constantly.

### The fix is one sentence, and the measurement is the part that is hard

The panel's own hint says it: the instruction *"if the passages do not answer it, say so"* costs nothing at
inference and is the highest-value line in most RAG prompts. On this corpus it is worth one item out of
twenty.

The reason teams do not ship it is not the sentence — it is that nobody measures the two directions, so the
sentence that fixes one fault gets credited with fixing the system, and the fault it quietly creates is
invisible for a month.

Two design points for the eval, not just the prompt:

- **A second judge, one failure each.** From [5.1](../module-05/lesson-01.md): the grounding judge answers
  "is this supported?" and the abstention judge answers "should this have been answered?" Two questions, two
  judges, no shared prompt. And the second one can often be code, which from [3.1](../module-03/lesson-01.md)
  is the cheapest check there is: extract the claims, and if **none** of their content words appear anywhere in
  the passages, the answer is either a refusal or a fabrication. One code check, both faults.
- **A `refusal` category that is not `ungrounded`.** If the label set has no cell for "said nothing useful",
  refusals land in whichever cell is nearest, and the tile inherits their number.

## Show me

The `abstain` preset opens on variant B — **never told to abstain** — with the abstention panel. Read it:

| Tile | Value |
|---|---|
| Empty-retrieval questions | **3** |
| Answered anyway | **1** |
| Correctly abstained | **0** |
| Over-refusals | **1** |

Under them, three items, each with `passages retrieved: 0`:

| Item | Question | Variant B answer |
|---|---|---|
| g07 | Is there an employee share scheme? | `The Data Engineer band starts at 85,000 and tops out at 110,000.` |
| g08 | Is there an employee share scheme? | `Yes, a 12-week paid internship runs every summer, applications open in January.` |
| g15 | Do you run a summer internship? | `The company pays 40 a month towards a gym membership, claimable in the expenses tool.` |

Then:

1. **Switch System to `A — grounded, abstains when nothing is retrieved`.** Tiles become **3 / 0 / 1 / 1**, and
   the list changes: g07 becomes `Yes — you can buy up to 20,000 of shares each year at a 25% discount.`, g08
   becomes `The handbook does not describe an employee share scheme. Ask the People team whether one is
   running.`, and g15 stays `Yes, a 12-week paid internship runs every summer and applications open in
   January.` One abstention gained, two fabrications unchanged, and the tile says the gain is complete.
2. **Switch to `C — small model`.** Tiles **3 / 1 / 0 / 1** — identical to B on this panel, for a different
   reason: C's extra fault is a refusal on an *answerable* question, which this panel cannot see. Its `over-
   refusals` tile still reads 1 while its behaviour is 2.
3. **Look for g16 anywhere on the page.** It is not there, at any system setting, because it returned a
   passage. Ask yourself how often a real retriever returns an empty array; the answer decides whether this
   panel's first tile is the important one or the decorative one.
4. **Read the panel's own hint.** It names the cost of both directions and then says the abstention sentence is
   the highest-value line in most RAG prompts. The hint is the only claim on the page that has to be measured
   rather than assumed — and the panel that shows it measured is the `compare` preset, not this one. Open it
   after you have finished here and compare what each variant's abstention behaviour does to its grounded rate.

> [!NOTE]
> Every tile above is computed live in your browser from the shipped items and the human labels; no model is
> called to produce them. The questions, passages, answers and labels in this dataset are generated for
> teaching, and the two rates are a property of this 20-item corpus — denominators of 3 and 2, where a single
> item is a third of the measurement.

## Try it

**Predict first**, before opening the page:

1. Three questions returned nothing. A team adds "if the passages do not answer it, say so" to the prompt and
   the `answered anyway` tile goes from 1 to 0. What else in the panel should have moved, and what does it
   staying still tell you?
2. Variant A declines on both items flagged `should_abstain` and still fabricates on two of the three
   zero-passage questions. Which of those numbers would you put in a release note, and how would you word it so
   nobody reads it as "variant A never invents anything"?
3. All three systems refuse `When can I work remotely?` although the passage answers it. Why does tightening
   an abstention instruction tend to trade one of these two columns for the other, and which one users
   complain about first?

[Simulation: judge-lab](../../simulations/rag-evals/index.html?preset=abstain)

1. **Recount the tile by behaviour.** With the panel open on variant A, mark each of the three listed items as
   *declined* or *answered* using only the answer text. The tile says 0 answered anyway; your recount says 2.
   Write down the one line of code that would produce your number instead of the tile's.
2. **Find the item the panel drops.** Locate g16's question — `Do you have a crèche?` — and write down what
   retrieval returned for it. Then work out what fraction of items in this corpus returned an empty array, and
   what a retriever with a lower similarity threshold would return instead.
3. **Read the over-refusal column across all three systems.** A refuses 1 of 14 answerable items, B refuses 1
   of 14, C refuses 2 of 14. Now find C's second refusal and check which cell it was shipped in. Write the
   sentence you would add to the runbook.
4. **Design the paired check.** For each item, write the two questions a human has to answer: one about
   grounding, one about whether the system should have answered at all. Then say which of the two you could
   implement as a string comparison over the run record, and what it would cost per answer next to the
   judge's $0.02244 and 380 ms.
5. **Test the sentence.** Predict the effect of adding the abstain instruction, then switch the System
   dropdown between A and B and count how many items change. Write down what size of item set would be needed
   to resolve a one-item difference at 95% confidence, and where your twenty items sit against it.

## Break it

**Publish one "refusal rate".** It is a blend of two faults with opposite fixes and opposite owners, and it can
be moved in either direction by editing one sentence without the product getting better. The lie: **a rate
whose two failure modes need opposite fixes is not a metric, it is an average that hides the question.**

**Trust `Answered anyway` because it reads 0.** On variant A it reads 0 while the system fabricates on two of
the three zero-passage questions, because those two are shipped as `ungrounded`. The lie: **a tile computed
over a category reports the category, and relabelling the data changes the tile without changing the bot.**

**Trim the panel to zero-passage items.** It is the easy half and it is the half a tuned retriever almost
never produces. g16 — a passage came back, and declining was still right — never appears on the page. The lie:
**the panel measures the case your retriever avoids.**

**Count refusals over the whole set instead of over answerable items.** Every question then lands in the
denominator, the rate falls, and the number improves as the eval set grows. That is the [4.4](../module-04/lesson-04.md)
denominator trap in a new costume: a rate whose denominator drifts is a rate you are steering.

## Fix it

1. **Two tiles, always adjacent, each with its denominator.** `answered with nothing retrieved: 2 of 3` and
   `refused an answerable question: 1 of 14` for variant A; `3 of 3` and `1 of 14` for B. A team that moves
   one and not the other can see it on the same row, which is the only way to tell a prompt change from a
   regression.
2. **Count behaviourally, not by label.** A refusal is any answer that makes no claim traceable to a passage;
   a fabrication is any answer that makes a claim not traceable to one. Both are decidable from the run record
   without a model, and doing it that way makes the two columns add up instead of disagreeing with the label
   table.
3. **Add a `refusal` cell and an `abstained_correctly` cell to the taxonomy**, so a refusal is not `ungrounded`
   and a correct decline is not `grounded`. The dataset ships `should_have_abstained` and `over_refusal` for
   exactly this reason; the disagreement in this lesson is entirely about the items shipped under the wrong
   one.
4. **Make the retriever's empty case a real part of the eval set.** At [4.3](../module-04/lesson-03.md) the
   rule is to keep the proportion of categories you expect in production. This corpus has 3 zero-passage
   items out of 20 and 2 `should_abstain` items out of 20, and the second number is the one that matters.

## How do I know it works?

**Challenge, on dev.** Take items 1–10 as the dev set. It contains two zero-passage questions (g07, g08) and
one `should_abstain` case (g08). Require:

- **`answered with nothing retrieved` is 0 on every zero-passage dev item.** Variant A reads **1 of 2** — it
  declines g08 and fabricates g07. Variant B and C read **2 of 2**. One of three systems passes.
- **`refused an answerable question` is 0 on every dev item whose passage answers it.** Variant A **0 of 7**,
  variant B **0 of 7**, variant C **1 of 7** — C refuses g06, which returns the notice-period passage and which
  is shipped as `ungrounded` rather than `over_refusal`, so this check is only possible by reading the answer
  text.
- **Both rates are reported with their denominators**, and the denominators are 2 and 7 on this split. Two
  items is not a measurement, and the runbook has to say so.

**Then one held-out validation** on items 11–20, read once:

| | Dev, items 1–10 | Held-out, items 11–20 |
|---|---|---|
| Zero-passage questions | 2 (g07, g08) | 1 (g15) |
| `should_abstain` cases | 1 (g08) | 1 (g16) |
| Variant A declined, of the zero-passage questions | 1 of 2 | **0 of 1** |
| Variant A declined, of the `should_abstain` cases | 1 of 1 | 1 of 1 (g16) |

Variant A declines the only flagged abstention case on each half and confabulates on the only zero-passage
question it meets on the held-out half. The held-out half contains **one** zero-passage item, so this is not
evidence that A is worse on held-out data — it is evidence that **twenty items cannot measure this axis**, and
that the axis needs its own eval set built to [4.3](../module-04/lesson-03.md). Write that down instead of
writing down a number.

## Use / don't use

**Do ship the abstention sentence.** It is one line, it costs nothing at inference, and on this corpus it
converts an invented internship policy into an honest "the handbook does not describe this, ask the People
team". That is one item in twenty, and one item in twenty is still a class of user harm removed.

**Do measure both directions from day one.** The fix for one is the risk for the other, and a system tuned on
the first column alone will drift into the second within a week.

**Do put a `refusal` category in the taxonomy.** Not as a nicety: it is what stops the tile and the behaviour
from disagreeing, which is what happens here.

**Don't treat abstention rate as a quality score to maximise.** Variant A's abstention tile is the best in the
module and its fabrication behaviour is the same as variant C's on zero-passage items. The tile is measuring
its own label.

**Don't try to settle this axis on a general-purpose eval set.** If zero-passage questions are 1% of your
traffic, a general set gives you one of them in two hundred items, and [4.2](../module-04/lesson-02.md) is the
lesson about what happens when you measure anyway.

What teams actually do: keep a small dedicated set of unanswerable questions — maybe thirty, built from
questions the search logs show people asked and retrieval has nothing for — and run it nightly with two
counters. One for fabrication on those, one for refusal on a companion set of answerable questions drawn
from the same log. The two counters move together whenever the prompt changes, which is the only reason
anyone notices the second one.

## Reflect

1. Variant A reads `0` on `Answered anyway` and 2 of 3 on the behavioural count. Write the two sentences you
   would put in a release note that state both, and say which one belongs in the dashboard tile.
2. You add the abstain instruction and `answered with nothing retrieved` drops from 3 of 3 to 2 of 3 while
   `refused an answerable question` stays at 1 of 14. Write the sentence you would send the team, and say what
   you would need in the eval set to see the second number move.
3. Your retriever is tuned to never return an empty array, so the `g07` case never fires in production. Name
   the failure it still produces on every single query, and design the twenty-item set that would catch it.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- Shahul Es et al., [RAGAS: Automated Evaluation of Retrieval Augmented
  Generation](https://arxiv.org/abs/2309.15217) (2023) — where the abstention dimension of a RAG eval sits
  relative to faithfulness and context relevance, and why measuring one does not stand in for the others.
- Yunfan Gao et al., [Retrieval-Augmented Generation for Large Language Models: A
  Survey](https://arxiv.org/abs/2312.10997) (2023) — the failure taxonomy behind "the model makes something up
  when retrieval fails", and the prompt-level mitigations this lesson prices at one sentence.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the discipline under the two tiles: an
  eval that does not hold out a failure you care about is not measuring whether you fixed it.