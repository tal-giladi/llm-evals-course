---
id: "02.4"
module: 2
minutes: 15
practice_minutes: 35
prerequisites: ["02.3"]
objectives:
  - Choose a sampling strategy for an error-analysis batch and say what each strategy over-samples.
  - Decide when a taxonomy is good enough to stop reading, using coverage rather than a quota of 30.
  - Explain why a count taken from a filtered batch is a statement about the filter, not about the system.
volatility: concept
sources:
  - title: "Hamel Husain — Evals FAQ"
    url: https://hamel.dev/blog/posts/evals-faq/
  - title: "Wikipedia — Simple random sampling"
    url: https://en.wikipedia.org/wiki/Simple_random_sampling
  - title: "Brown, Cai & DasGupta — Interval estimation for a binomial proportion"
    url: https://doi.org/10.1214/ss/1009213286
last_verified: "2026-10-01"
---

# 02.4 · Sampling: which traces to read, and when to stop

Every error analysis is a sample, and the sample is chosen before anybody has written a single note.
This lesson is about the three ways the lab lets you choose one, what each of them over-samples, and
how to tell that you have read enough rather than that you have read a round number.

## Why it matters

A team has a launch in two weeks and an hour a day to spend on error analysis. Their tracing backend
makes filtering easy, so they start with the obvious question: **read the sessions where users were
unhappy.** They pull 30, they note them, they tag them, and they come out with a confident conclusion —
the bot's main problem is refusing questions it should answer, with invented policy second. Both of
those rows have real traces with real spans in them, which is exactly what makes the conclusion so hard
to argue with later.

In this course's own data, the 11 traces that carry a thumbs-down are labelled **correct** 6 times out of
11. The other five are 2 wrong facts, 1 refusal, 1 uncited answer and 1 invented policy. So the largest
category in a thumbs-down batch is *nothing was wrong*, and what the team actually found is an
expectation problem — people pressed the button for reasons the pipeline never saw — filed under the
taxonomy as if it were a failure mode.

And the failure that actually dominates this system never appeared at all. Across 282 answers, 78 are
right but uncited — 27.7%, the biggest single row in the taxonomy. Nobody complains about a right answer,
so a complaint-filtered batch will not contain them, and the team will spend its one hour a day fixing
something else. The filter was the sample, and it selected on being annoyed.

That is the general shape of this mistake. A batch filtered by anything is a sample of that filter. A
taxonomy built from one strategy is a taxonomy *of that strategy*, and it will be confidently wrong in
a way that is very hard to see from inside it.

## How it works

Three strategies, all in the same dropdown, all reading the same 94 traces:

| Strategy | Pool | What it over-samples | What it cannot tell you |
|---|---|---|---|
| **Random** | 94 | nothing in particular | anything about the rarest failures, at this size |
| **Only traces with a span error** | 27 | whatever your post-check happens to detect | one word about the 67 traces it stayed quiet on |
| **Only thumbs down** | 11 | user dissatisfaction | whether the answer was wrong at all |

None of them is neutral, and the two filtered ones are not neutral in the same direction. The error
filter conditions on **the check you already trust**, so its batch is as homogeneous as that check's
detection set: in this lab all 27 of those traces carry the same chip, `answer contained no handbook
citation`, and all 27 of them are the tuned system's `no_citation` answers. One category, 27 times,
100% — a table that looks finished and carries no information about the other 67 traces.

The thumbs-down filter conditions on **the user**, which is a different measurement again. It reaches
only 11 of 94 traces, because 73 carry no feedback at all, and being annoyed is not the same event as
being wrong. Random is the only unbiased strategy here and it is also the one that makes rare failures
invisible, which is the trade you are actually making.

### How many is enough

Read 20 random traces in the default batch and 5 of them carry the error chip. As a rate that is
**25.0%, with an 11.2%–46.9% interval**. The rate in the whole set is **28.7% (20.6%–38.6%)**, so your
estimate is fine — and it is also useless, because 11% and 47% are both inside it. Twenty traces
cannot tell 25% from 5%, which is the width you need to tell two systems apart.

Now the number that should change how long you plan to read. The tuned system invents a company policy
on **2 of its 94 answers** — 2.1%, with an interval from 0.6% to 7.4%. Draw 30 of the 94 at random and
the chance you see even one of those two is **54%**. Draw 20 and it is 38%. To see both you have to read
all 94, because there are only two. "Read 30 and stop" is, for the failure with the worst consequences
in the whole set, a coin flip — and a coin flip you will not notice, because you stopped reading before
the evidence could arrive.

So the number is a starting point and not a licence. Thirty is where a first taxonomy becomes legible;
it is not where it becomes complete. What actually ends the reading is **coverage**, not a quota:

1. **New traces stop producing new rows.** The lab's own version of this is the callout under the counts
   table: after 20 traces, when the largest category holds under 60% of what you have read, it says
   *"You can probably stop."* That is a statement about the shape of your table, which is worth having
   and is not the same as coverage — lesson 2.3 shows a taxonomy spread thin on purpose that satisfies
   it immediately.
2. **The residual is empty.** How many traces ended in no row? Two is a missing row. Ten is a broken
   rule.
3. **The rare rows you cannot afford to miss are at least represented.** Coverage by *class*, not by
   count, which is what module 4's stratification is for.

Note what the lab does not let you do: keep a trace out of the denominator. `Skip` advances the batch and
still adds the trace to your count, and below 20 traces the callout says so — *"Under 20 traces, a
taxonomy is a guess."*

> [!IMPORTANT]
> **These labs use an educational model.** The traces are generated by a seeded model and the labels
> quoted beside them are recorded labels on modelled answers, not a production capture. Every count and
> every interval here is computed for real in your browser from those records. So "6 of 11" is a real
> count on modelled data, and none of these numbers is a measurement of a named system in the wild.

## Show me

The three strategies over the same 94 traces, with the shipped labels on the traces each one hands you:

| Batch | Size | What you read | Largest row, by the shipped labels |
|---|---|---|---|
| Random, default batch of 20 | 20 | 5 error chips, 3 thumbs-down | `no_citation` and `wrong_fact`, 5 of 20 each — 25% |
| Only traces with a span error | 27 | the same chip every time | `no_citation`, 27 of 27 — 100% |
| Only thumbs down | 11 | no chips at all except one | `correct`, 6 of 11 — 55% |

Three batches, three completely different pictures of the same bot, and only the middle one *looks* like
a diagnosis — which is the problem with it. The random batch's largest row sits at 25%, comfortably under
the 60% bar, so the callout appears at 20 traces. The error batch never triggers that callout at all,
because its single row holds every trace you read. One row at 100% and five rows at 25% are both
telling you the shape of what you sampled, not the shape of the system.

Two more things the page shows that are easy to miss. The **Investing** slice holds exactly one trace out
of 94 — a perfect record with every field populated, and no information. And feedback is thin: 10 traces
carry a thumbs-up, 11 a thumbs-down, and 73 carry nothing at all, so any strategy that filters on a
reaction reaches 11 traces out of 94 or fewer.

For scale: 20 traces cost about **$0.585** of generation at the recorded per-token prices. An hour of
analyst time reading them costs far more than that, and the analyst time is the part a sampling decision
actually controls.

## Try it

**Predict first.** Write down, on paper: (1) in the default random batch of 20, how many traces will
carry the error chip? (2) in the thumbs-down batch, will the largest category be a failure or a
non-failure? (3) at what trace number do you expect your taxonomy to stop changing?

[Simulation: error-analysis](../../simulations/error-analysis/index.html?preset=errors)

The link asks for the error-filtered view. If the page opens with the strategy already on **Only traces
with a span error**, put it back to **Random** before you start: the three passes below each need the
dropdown set by hand, and a filtered batch is the last thing you want to read first.

1. **Run all three strategies at the same size.** Set the batch to 20, read 10 under **Random**, then 10
   under **Only traces with a span error**, then as many as you can under **Only thumbs down**. Write
   the largest row and its share for each before you read anything. The point is that you can predict
   all three from the pools alone.
2. **Count the thumbs-down batch properly.** Set **Only thumbs down** and the batch size to 10. For each
   trace, note the user reaction, the post-check and the answer length — then say, from the trace alone,
   whether you can call that answer wrong. Write down how many you could not.
3. **Watch a residual form.** Read 20 random traces, tagging honestly, and keep a tally of the traces
   that ended in no row. If it is above two, you have found a missing rule before the lab tells you.
4. **Make the stop rule fire early, on purpose.** Spread your tags across the seven suggested boxes so no
   tag holds more than 11 of 20, and watch the callout appear. Then list the failure modes the system
   has that your table does not mention.
5. **Go up to 30 and compare.** Set the batch to 30 and read the ten traces you have not seen. Record
   how many of them added a row or changed a count. That number is the only honest answer to "is 30
   enough", and it is almost never zero.

## Break it

Set the sampling strategy to **Only traces with a span error** and read ten traces all the way down.
Every one shows the same chip on the same span, from one of two models, in the same four-step shape.
Write your conclusion about how this bot fails, in one paragraph, as though you were going to present
it.

The paragraph will be fluent, specific and wrong. The lie has a name: **a batch filtered by the check you
already trust contains only what that check found.** You replaced a sample of the system with a sample
of one failure class, and the resulting homogeneity reads as clarity. The proof is in the data rather
than in your reasoning: those 27 traces are exactly the 27 `no_citation` answers, so a taxonomy built
from them has one row and says nothing about the 67 traces where the post-check stayed quiet — which is
where 12 wrong facts, 6 refusals and 2 invented policies were hiding in lesson 2.1.

The same move with a slice instead of a filter is quieter and just as wrong: **Investing** is one item,
perfectly recorded, and tells you nothing at all.

## Fix it

Read a random batch first, and keep the strategy on the sheet with the conclusion it produced. Then go
looking for the rare classes on purpose, with a slice, rather than waiting for them to arrive.

On the scoreboard, the fix is visible as a difference in the Progress panel. A random batch moves it
through "12 traces read. 3 distinct failure modes named" and keeps adding rows; the error-filtered batch
reports "20 traces read. 1 distinct failure modes named", which is not success, it is the absence of
information. The **Export notes and tags** button then gives you `readOrder` alongside the tags, so the
next person can see which traces a conclusion rests on — and can tell a 20-trace conclusion from a
30-trace one.

## How do I know it works?

**Dev run.** Read 20 traces from the default random batch, noting before tagging.

**Target:**

- Largest category under 60% of the 20 you read, and at least 4 distinct rows.
- Residual: at most 2 traces in no row.
- Your sheet records the strategy that produced each row, so a filtered number can never be quoted as a
  system rate later.
- One sentence naming a failure class you have **not** seen yet, and the slice you would read to look
  for it.

**Validation, once.** Set **Start over**, switch to **Only thumbs down**, and read 10. Target: at least 2
land in a row you already have *and* at least 1 lands in none. If all 10 fit, your rows are too coarse
and one of them is a junk drawer. If none fit, they were fitted to a single batch. Either way, write down
which signal that batch was measuring, because it was not measuring failures.

## Use / don't use

**Do use** a random batch as the spine of any error analysis, and treat sampling as a budget decision
with two numbers attached: the generation cost, which is small (about sixty cents for 20 traces), and
the analyst hours, which are not. In production the pattern is the one this course has been building
towards — random first for coverage, then targeted slices for the failure classes that matter to you,
then a frozen golden set that only grows and is re-read by hand every couple of weeks. Record the
strategy next to every count, because your tracing backend will sample traces away over time and
someone will eventually ask what these numbers were measured on.

**Don't use** a filter that conditions on the check you already trust; a thumbs-down filter as a proxy
for wrongness, which this data puts at 6 of 11 correct; a share from a filtered batch quoted as the
system's rate; or the "you can probably stop" callout as evidence of coverage. And do not plan an
afternoon around "read 30" — plan around the residual, and then read until it is empty for the classes
that would embarrass you.

## Reflect

1. Which strategy would you reach for first on your own system, and what is it structurally blind to?
2. Your taxonomy is finished and the rarest category has 2 items in 94. Write down how many traces you
   would have to read to see it twice, and say whether that is affordable this quarter.

Module 2 ends here, and the artefact is the sheet you built in lesson 2.3. Module 4 turns its rows into
test cases, and Module 5 turns the rows with a decidable criterion into judges.

## Sources

- [Hamel Husain — Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — why looking at your data comes before writing any metric, and why the first pass over it should not be filtered.
- [Wikipedia — Simple random sampling](https://en.wikipedia.org/wiki/Simple_random_sampling) — plain-language treatment of why a filtered sample describes the filter, and what uniform random selection is for.
- [Brown, Cai & DasGupta — Interval estimation for a binomial proportion](https://doi.org/10.1214/ss/1009213286) (2001) — the Wilson interval behind the 25.0% (11.2%–46.9%) figures above, and why the sample-size question is an interval question.