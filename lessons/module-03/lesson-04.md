---
id: "03.4"
module: 3
minutes: 13
practice_minutes: 30
prerequisites: ["03.3"]
objectives:
  - Assign a failure category from your taxonomy to code, judge or human, and write the reason down.
  - Price the three options in cost, latency and auditability on one of your own failure categories.
  - Recognise a check that has been stretched onto a category it cannot decide, before it ships.
volatility: concept
sources:
  - title: "G-Eval: NLG Evaluation using GPT-4 with Human Alignment (Liu et al., 2023)"
    url: https://arxiv.org/abs/2303.16634
  - title: "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (Zheng et al., 2023)"
    url: https://arxiv.org/abs/2306.05685
  - title: "Hamel Husain — Evals FAQ"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 03.4 · Choosing code, judge or human

You have a failure taxonomy with nine rows and no way to decide which check belongs on which row.
This lesson gives you the ordering: code first, judge where no rule decides but people agree, human
where your own targets disagree — and a written reason every time, because a check without a reason is
a check nobody will remember to maintain.

## Why it matters

A team has fourteen checks in its eval suite. Eleven are code, two are LLM judges, one is a set of
hand-written human labels. There is no ordering principle behind that split; it is what accumulated
over two years of incidents.

Then the suite starts to lie, in a way nobody notices. Every time a production failure is investigated,
someone adds a check for it — and a check written in response to a failure you have already looked at
is a check that passes on that failure. So the suite's headline pass rate goes **up** every time
something goes **wrong**. Two quarters later the number reads 91% and nobody can reconstruct the
decision, because there is no record of which category each check was written for or why it was
allowed to be an automated verdict at all.

The release gate is whichever check happened to run first in CI, and that is a fact about the order of
imports.

The cost of this is not abstract. When a real regression finally does get caught, the person reading
the alert cannot tell which of the fourteen checks meant anything, so they turn them all off. The suite
is then quieter than the single check it replaced, and the next incident is caught by a customer.

## How it works

The decision is not "how accurate is this check" — you cannot know that before you have built it, and
guessing at it is how teams end up with expensive vague judges. The decision is **per failure
category**, and it has three rungs. Work down and stop at the first one that fits:

**1. Code — is there one right answer, and do you know what it is?**

If you can write down the correct answer, or a rule that decides it, a program can decide it too. This
rung is free, instant, deterministic, auditable in the diff, and it names what went wrong when it
fails. Two categories from this lab sit here:

- **Malformed JSON.** Decidable, free, instant, and the error names the field. Nothing about this is a
  judgement.
- **A wrong oven temperature.** The right number is known. This is the one that gets argued about, so
  say it plainly: **comparing strings is a worse judge than a judge.** A string comparison cannot tell
  180 from 180 °C from 180 °F; a schema with `type: number` and a documented unit can, and it costs
  nothing. The argument for a judge here is not that a judge is better — it is that the category
  sounds like it needs one.

**2. Judge — no rule decides it, but people agree often enough to measure.**

"Is this step clear to a beginner?" No rule decides it. But two people asked the same question agree
most of the time, and that residual agreement is what a judge can be measured against. The important
part is the second clause: if people did *not* agree often enough, you have no target and no amount of
judge tuning will produce one. Agreeing often enough is a property of the category, not of the judge,
and you find it out by labelling (Module 6).

**3. Human — the targets disagree with each other.**

"Is this recipe a good idea for a dinner party?" Two labelers asked this will not agree, because there
is no single thing being asked. A judge here would average its labels into mush: it can only report
what the majority of its own labels think, and when the labels themselves are split the average is a
number with no referent. A human does not fix that either — but a human is the only one of the three
who can tell you *why* they split, and that disagreement is the finding. Anything you cannot even
settle with two people is not a metric yet. It is a dashboard, and you should label it as one.

The lab renders this as a decision table on every page. Read the third column, not the second:

| Failure | Use | Because |
|---|---|---|
| Malformed JSON | Code | Decidable, free, instant, and the error names the field. |
| Wrong oven temperature | Code | The right number is known. Comparing strings is a worse judge than a judge. |
| Is this step clear to a beginner? | Judge | No rule decides it, but people agree often enough to measure. |
| Is this recipe a good idea for a dinner party? | Human | The targets disagree with each other. A judge would average them into mush. |

**The reason is the deliverable.** The third column is not a justification written afterwards. It is
the thing that makes the choice reviewable: six months later, when someone asks why this category is
judged rather than checked, the answer is a sentence somebody already committed to the repository. A
check with no stated reason gets "simplified" by the next person who does not know why it is lenient.

### What each rung costs

Three ladders, and they move together — which is the reason to go in order.

| | Code | Judge | Human |
|---|---|---|---|
| Cost of one suite run | effectively zero | $0.03794 per call, so $1.5176 for 40 items | your afternoon, every time you repeat it |
| Latency | microseconds, in CI | 540 ms per call, 40 calls, about 22 s | minutes to hours |
| Re-run it twice, get | the same number | a different number | a different answer |
| You can audit it by | reading the diff | reading the prompt | asking the person |
| When it breaks, it tells you | the path and the field | a sentence of prose | nothing, unless you asked |
| Good for | every commit | nightly | every couple of weeks |

The judge prices are this course's own recorded prices for its educational model, quoted from the judge
lab; the multiplication is real and the price is a placeholder. The ordering is not: a suite of code
checks is free enough to run on every pull request, which is exactly where you want a check that
catches a broken bracket, and exactly where a nightly judge would not be allowed to live.

The auditability row is the one that decides ties. Code you can review in a pull request. A judge you
can review only as a prompt — the verdict itself is a black box you will spend Module 6 measuring. A
human label you can ask about, and the answer is worth more than the label.

## Show me

Open the lab on the overlap preset. The decision table is rendered in its own panel at the bottom of
the results column, and it is the only table in this course that gives you a *reason* alongside every
recommendation. Attach the numbers this module produced to its four rows and the table stops being an
opinion:

| Failure | Use | What the lab says about it |
|---|---|---|
| Malformed JSON | Code | 4 of 20 outputs on variant C are not JSON. The check is instant and the error names the missing `]`. |
| Wrong oven temperature | Code | The numeric panel reads **0.0%** at every tolerance — not because the temperatures are wrong, but because the check calls `Number()` on a whole object. Lesson [3.3](lesson-03.md) took this apart. |
| Is this step clear to a beginner? | Judge | Nothing in the lab decides this, and that is the signal. No code check exists because no rule can be written. |
| Is this a good idea for a dinner party? | Human | Also undecidable, but for the other reason: two labelers would disagree, so there is no target to measure a judge against. |

The third and fourth rows look identical from the page — both are "nobody can decide this" — and they
land on different rungs. That is the part the table teaches and the part people skip: **undecidable by
rule is not the same question as contested between people**, and the first is a judge and the second
is a human.

Then read the hint under the table, which is the whole lesson in one line: *write the reason down. A
check without a stated reason is a check nobody will remember to maintain.*

## Try it

**Predict first.** You have a nine-row failure taxonomy for a customer-support assistant and no checks
written yet. On paper:

1. Which rows go to code, and for each one name the rule — the thing a function could evaluate.
2. Which rows go to a judge, and for each one name the question the judge would be asked.
3. Which row, if any, goes to a human, and why is it not the same as the judge rows?

If you cannot fill in all three columns for a row, that row is the one to think about first.

[Simulation: code-checks](../../simulations/code-checks/index.html?preset=overlap)

1. **Classify the lab's own four failures.** Switch Metric to JSON parses and variant C. The four
   failing items — `r01`, `r03`, `r07`, `r08` — all fail the same way. Which rung of the ladder is
   that, and what is the rule a function would evaluate to catch it?
2. **Find the row the suite gets wrong.** Switch Metric to JSON matches the schema and variant B. The
   check reads 100.0% while 5 of the 20 objects differ from the reference. Write the reason column for
   "the object is well-formed" in your own words, and decide whether that check belongs on a row at
   all or is only a precondition for the rows that do.
3. **Write a fourth row the lab does not have.** The lab's table covers malformed JSON and oven
   temperature as code, clarity as judge, and dinner-party suitability as human. Add one from a system
   you know — for example "the answer cites the section it came from" — and fill in all three columns.
   Then check it against the data: the support-bot traces in Module 2 had 27 of 94 answers flagged for
   exactly this, and a regex is the check.
4. **Price your own suite.** Take your taxonomy and cost it under the table above. One code check per
   row is free. Two judge rows at 40 items each is about $3 a run. Say out loud how often you would run
   each, and notice whether any row you wanted to gate on is a row you can only afford nightly.
5. **Find a check that has been stretched.** Take one metric from the page — Contains substring reads
   100.0% on every system — and write down which failure category it could plausibly be defending. Then
   write what output would make it fail. If you cannot write one, that is a row in your taxonomy
   pointing at a check that cannot decide it.

## Break it

Two wrong assignments, and the first is the more common.

The first is putting a judge on a decidable category. Someone writes "is this valid JSON?" as a judge
call. On this lab's twenty items that judge costs $1.5176 a run, takes about 22 seconds, gives a
different answer on a re-run, and — the part that matters — has never been checked against a parser.
The lie is named: **a judge on a decidable category is not a safer check, it is an unvalidated one
that costs 10,000 times more.** And it is unvalidated in a specific direction: models asked whether a
string is JSON tend to say yes about a trailing comma, because it looks like JSON to a reader. The
four items that fail here all fail on exactly that, and a judge asked would have waved them through.

The second, and worse, is putting code on a category code cannot decide. Write a regex for "is this
step clear to a beginner?" — something like `/\b(step|then|next)\b/` — and run it. It scores **100.0%
(83.9%–100.0%)** on every system, including the one whose output is unparseable a fifth of the time.
The suite now has a gate. The gate cannot fire, and it is labelled with the name of a real failure
category, so somebody will eventually trust it.

That second lie is the dangerous one, because it is the honest-looking one. **A code check applied to
an undecidable category is not a cheap judge; it is a green light wired to nothing.** The passing is
indistinguishable from a working check on a scoreboard, and the category name on the check makes it
more believable, not less.

## Fix it

Give the taxonomy a third column and refuse to let a row ship without it. The course ships a blank
copy in [`templates/failure-taxonomy.md`](../../templates/failure-taxonomy.md) — its last section asks
exactly the right question: *which check decides this, and what would make that check wrong?* A row
that cannot answer that is a vibe with a table around it.

Three changes, visible in the shape of the suite rather than in a number:

1. **Every row gets a check kind and a written reason.** Nine rows, nine sentences. This is what stops
   the "whatever is cheapest" drift, because a check whose reason has been written down cannot be
   swapped for something cheaper without somebody noticing that the reason no longer holds.
2. **Promote code checks into CI and demote everything else to its own schedule.** Code on every pull
   request, free. The judge suite nightly on 40 items, about $1.52 a run. The human-labelled golden set
   re-read every couple of weeks. The schedule is not a detail — a check on the wrong schedule is a
   check that fires after the damage, and that is the same as no check.
3. **Re-read your judge rows every time you re-read the human set.** The human set is how you find out
   the judge has stopped matching reality, which is the failure you saw at the top of this lesson: a
   suite that has drifted from the thing it measures, discovered by nobody, until somebody turns it
   off.

## How do I know it works?

**Challenge, on dev.** Take your taxonomy and produce a decision table with three columns per row —
category, check kind, reason — where the reason is a full sentence someone could disagree with.

Then set three targets:

- **No row has a reason that is only a restatement.** "Use a judge because the task is subjective" is a
  restatement. "Use a judge because two labelers agreed on 9 of 10 borderline steps, so there is a
  target to measure against" is a reason, and it names a number.
- **Every row can name what would make its check wrong.** For a code row that is a concrete output. For
  a judge row it is the agreement rate you would need before trusting it. For a human row it is the
  disagreement you expect, and what you will do about it.
- **No category is gated by a check that cannot fail it.** If the check returns the same number on
  every input, it cannot gate anything, whatever its name says.

**Validation, once, and it is the real test.** Collect the next five failures your system actually
produces, and classify each one **before** writing any check for it. Then compare that list against your
taxonomy.

If every one of the five maps to a row you already have, the taxonomy is doing its job and you have
earned your table. If three of the five do not map, you have just found the thing you were measuring
for: a class of failure your eval cannot see, discovered by a method that does not depend on your eval
at all. Write the new rows down before you write the checks. Classifying before checking is the whole
discipline — a check written after the failure is a check written to pass it, which is exactly how
the pass rate starts climbing every time something goes wrong.

## Use / don't use

**Use code checks for** everything decidable, on every pull request, at no cost. This is the bulk of a
production eval suite and it should never have been a debate.

**Use judges for** categories with no rule but reliable human agreement, on a schedule you can afford —
nightly, on tens of items — and never as the only gate. A judge you have not validated against humans
is a number generator, whatever its cost.

**Use humans for** contested categories and for keeping everything else honest. A frozen, hand-labelled
golden set of 30 to 50 items that only ever grows, re-read by hand every couple of weeks, is the
cheapest thing in this course that finds out your checks have stopped working.

What teams actually do, in the order the cost climbs: assert on the things a program can decide; add a
schema for the contract with the code downstream; reach for a judge only when the taxonomy says a
category has no rule; keep the human set small and frozen. The failure mode to avoid is not picking
the wrong one of these — it is picking one at random per row, which is what produces a suite whose
headline number nobody can act on.

## Reflect

1. You have nine taxonomy rows and fourteen checks. What would you need to know about each check in
   order to say whether it is allowed to gate a release, and which of those things is missing from your
   repository right now?
2. "Is this step clear to a beginner?" and "Is this a good idea for a dinner party?" are both
   undecidable by rule. Write the one sentence that tells them apart, and say what you would have to
   measure first in each case.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Yang Liu et al., [G-Eval: NLG Evaluation using GPT-4 with Human Alignment](https://arxiv.org/abs/2303.16634)
  (2023) — why a judge is worth building when humans agree on the thing: the target has to exist before
  the judge can be measured against it.
- Lianmin Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot
  Arena](https://arxiv.org/abs/2306.05685) (2023) — the biases that make a judge a second-tier check
  rather than a first-tier one, which is where Module 7 goes.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the ordering this whole module
  runs on: code, then a judge, then people, in that order, with the reason written down.