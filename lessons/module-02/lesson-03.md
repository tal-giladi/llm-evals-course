---
id: "02.3"
module: 2
minutes: 16
practice_minutes: 40
prerequisites: ["02.2"]
objectives:
  - Turn a pile of open-coded notes into named, applicable failure modes, each with a
    count and a share of what you read.
  - Rank failure modes by frequency, severity and cost to fix, and explain why the largest
    row is not automatically the right target.
  - Give every row a named check, and say in one sentence what would make that check wrong.
volatility: concept
sources:
  - title: "Braun & Clarke — Using thematic analysis in psychology"
    url: https://doi.org/10.1191/1478088706qp063oa
  - title: "Hamel Husain — Your AI Product Needs Evals"
    url: https://hamel.dev/blog/posts/evals/
  - title: "Anthropic — Define success criteria and build evaluations"
    url: https://platform.claude.com/docs/en/docs/test-and-evaluate/develop-tests
last_verified: "2026-10-01"
---

# 02.3 · Axial coding: building a failure taxonomy

Open coding gave you one note per trace. Axial coding is what happens next: name each distinct way the
system fails, count how often each name appears, and then decide — in writing, with reasons — which one
you are going to fix first. The counting is the easy half.

## Why it matters

A support team does everything this course asks. They read a couple of hundred traces, write a note on
each one, and come out with six named failure modes and a count for every row. It is the most complete
error analysis that team has ever produced, and it produces the wrong plan.

They sort the rows by count, because that is what a count is for, and the top row is `no_citation` —
78 of the 282 answers they looked at, more than a quarter of everything. They spend two sprints on it,
and it goes well: uncited answers fall from 78 to 19. The pass rate moves 1.4 points. That is the whole
return, because nothing below the top row was worked on, and one of the rows they skipped is the row
that started the project: **14 answers stated a company policy the handbook does not contain**, including
a salary band and a share-buying allowance. Somebody rang support about the salary band. That answer sat
in row five of six, and nobody looked at it, because row five was not the biggest.

Nothing in that story is carelessness. Counting is the part of error analysis that feels like rigour,
and rigour feels like the end of the thinking. The failure is structural: **a count is a fact, and a fact
does not choose.** The three inputs that do choose are the count, what the failure costs the user, and
what it will cost you to remove it — and a spreadsheet takes the first one by default, because the other
two need a person to write down an opinion and sign it.

## How it works

Axial coding turns a pile of notes into an **axis**: a short list of failure modes that another person
could apply to the same trace and reach the same row. Three properties make an axis usable:

1. **It can be applied from an observation.** "Right answer, no handbook section named" is something you
   can point at in a trace. "Hallucination" is something you believe, and you will believe it unevenly.
2. **It names one failure.** If your rule is "whatever went wrong", two analysts will split one trace
   two ways and your counts will not reproduce. Say what a coder does when an answer fails twice.
3. **It has a rule for leftovers.** An answer can be uncited *and* wrong, so a trace can carry more than
   one tag. Your sheet needs a rule — several tags, or the worst one — or your shares will not add up to
   anything and you will not notice.

Here is the taxonomy this course's own recorded data ends up with. The course ships hand-written labels
for **three systems over the same 94 items**: A the handbook-tuned prompt, B a generic prompt with no
retrieval and no citation instruction, and C a small model with no retrieval. Read across all three and
there are 282 answers to sort.

| Category | Count | Share of 282 | How you would recognise it |
|---|---|---|---|
| `no_citation` — right answer, no source named | 78 | 27.7% | The fact is right; no handbook section is cited |
| `wrong_fact` — contradicts the handbook | 60 | 21.3% | States a rule the section it answers from does not contain |
| `extra` — adds an unsupported claim | 27 | 9.6% | The right answer plus an "in practice" sentence the handbook does not state |
| `over_refusal` — refuses an answerable question | 22 | 7.8% | "I can't help with that" on a policy the handbook answers |
| `out_of_scope` — invents policy where none exists | 14 | 5.0% | States a salary or share-scheme rule as fact |
| `correct` | 81 | 28.7% | — |

201 of the 282 answers failed, which is 71.3%. Now read the same data **per system** before you use any
of it, because a pooled count hides which world the failure happens in. The tuned system passes 47 of 94,
the generic prompt 26, the small model 8:

| System | Correct | `no_citation` | `wrong_fact` | `extra` | `over_refusal` | `out_of_scope` |
|---|---|---|---|---|---|---|
| A — handbook-tuned prompt | 47 | 27 | 12 | 0 | 6 | 2 |
| B — generic prompt | 26 | 26 | 19 | 12 | 6 | 5 |
| C — small model, no retrieval | 8 | 25 | 29 | 15 | 10 | 7 |

Read the two share columns next to each other before you use the pooled one. `no_citation` is 78 answers
pooled and 27 answers of system A, which are different projects: A's is a prompt line plus a check, C's
is retrieval and a bigger model. `wrong_fact` is 12 of A's 47 failures and **29 of C's 86** — the same
category name, more than twice the share of the problem, on a system whose fix is not a prompt edit. And
`extra` never appears in A at all, so row three of the pooled table is an artefact of the two systems you
built in order to have something worse to compare against. **A taxonomy is a statement about the systems
you looked at**, and the way to make it true of your system is to count your system, in your system.

The last thing the counts table has to do is decide, and this is where a count stops being enough:

$$\text{priority} = \frac{\text{share} \times \text{severity}}{\text{effort}}$$

Severity is 1 (harmless) to 4 (critical for the user); effort is 1 (a prompt line) to 3 (a migration).
Same six rows, same counts, one more table:

| Row | Share | Severity | Effort | Priority | Rank by priority | Rank by count |
|---|---|---|---|---|---|---|
| `no_citation` | 27.7% | 2 | 1 | **55.3** | 1 | 1 |
| `wrong_fact` | 21.3% | 3 | 2 | **31.9** | 2 | 2 |
| `over_refusal` | 7.8% | 3 | 1 | **23.4** | 3 | 4 |
| `out_of_scope` | 5.0% | 4 | 2 | **9.9** | 4 | 5 |
| `extra` | 9.6% | 1 | 1 | **9.6** | 5 | 3 |

Two rows moved. `extra` is the third-biggest row by count and the last by priority, because adding a
sentence nobody asked for costs a user nothing. `out_of_scope` is the smallest row by count and the
fourth by priority, because the user who reads an invented salary band has no way to know it is made up.
Sort by count and you build a judge for the harmless row before you fix the one that invents policy.

And `over_refusal` is where the argument will actually happen. With severity 3 and effort 1 it lands
third, above the bigger rows. The sheet the course ships puts it lower, on the grounds that a refusal
has a small blast radius — a user who gets nothing calls support once, a user who acts on an invented
salary band resigns. Both rankings come from the same counts, and the difference between them is one
opinion column. That is the point of writing the opinions down instead of letting the sort order decide
them for you.

Be honest about what that arithmetic is. Severity and effort are opinions, and the score is not a
measurement of anything. What it buys is that those opinions are now in a column somebody can argue
with, instead of being the unstated reason the biggest row was chosen. Put those two columns at the top
of the review, not the count.

> [!IMPORTANT]
> **These labs use an educational model.** The traces are generated and the answers come from a seeded
> model of system behaviour, not from a production deployment, and every count in this lesson is computed
> for real in your browser from those recorded labels. So 78 of 282 is a real count on modelled answers. It
> is not a measurement of any named system in the wild, and it must never be quoted as one.

## Show me

The lab's scoreboard is the **Where the batch stands** panel. It opens with the line
`N traces read, K distinct failure modes`, then a table of failure mode, traces and share, and then the
callout that lesson 2.4 is about. Three things about it are worth naming before you trust it:

- **The denominator is traces read, not failures.** Share is `n / traces read`. On a batch where 8 of 20
  answers were correct, a tag holding 5 traces reads 25%, not 42% of the failures.
- **Shares can add to more than 100%.** A trace may carry several tags — that is what the checkbox
  panel allows — so the same answer can land in `no_citation` and `extra` and be counted in both. Sum the
  column before you quote any of it.
- **The Progress panel and the counts table agree on how many modes you have found, and disagree with
  both about how bad they are.** "12 traces read. 3 distinct failure modes named" is a count of names,
  not a measurement of the system.

Open the default batch — 20 random traces out of 94. In it, **5 carry the citation error** — the same 5
that a `no_citation` tag picks up, because the 27 error-flagged traces in this set are exactly the tuned
system's uncited answers. The chip you can see in a trace is one row of the taxonomy, and it is the only
row the trace can show you. The other 20 failures of the tuned system — the 12 wrong facts, the 6
refusals, the 2 invented policies — arrive with a clean post-check and a healthy span tree.

Read all 94 instead of 20 and you get the taxonomy table in **How it works** above. That is what the
sheet looks like when the count is not doing the deciding.

## Try it

**Predict first.** On paper, before opening anything: (1) how many distinct failure modes will you have
after 20 traces? (2) which one will be the largest row? (3) name one row you expect to exist that you
expect to be small — and say now whether you would fix it first if it were critical.

[Simulation: error-analysis](../../simulations/error-analysis/index.html)

1. **Build the table by hand before you look at it.** Read ten traces, write a note, then tag. Copy your
   tags into your own table with counts before opening the **Where the batch stands** panel. If your
   table and the panel disagree, find the trace where they do.
2. **Merge two rows on purpose.** Tick `no_citation` on every trace you judged that way, and put
   `over_refusal` and `out_of_scope` into one row called "the bot ignores the user". Write the sentence
   you would put in the plan for that merged row. Now split it and write the two sentences instead.
3. **Sum your shares.** Add the Share column up by hand. If it passes 100%, find the trace that carries
   two tags, and write the rule your sheet needs: several tags, or the worst one only.
4. **Score the table.** Write a severity (1–4) and an effort (1–3) next to each row and compute
   `share × severity ÷ effort`. Then check: which row moved, and would you still disagree with its
   severity if somebody asked you why?

## Break it

Merge everything into three rows — `bad answer`, `too slow`, `bad tone` — and read ten more traces with
those boxes ticked. The sheet looks finished: three clean rows, a total, a plan. The counts are also
true, and completely useless, because no row names a change a person can make on Monday.

The sharper version of the same break is flatter. Tag 20 traces with two tags each, spread so no single
tag holds more than 11 of them, and the lab's stop callout fires — **"You can probably stop"** — after
20 traces, with a largest-category share comfortably under the 60% bar. You have covered a fraction of
what the system does wrong and the scoreboard is telling you the work is done.

The lie has a name: **the stop rule measures the shape of your table, not the coverage of your data.** A
taxonomy spread thin on purpose is indistinguishable from a taxonomy that has seen everything. The only
defence is the residual: count the traces that ended in no row, and if that number is large, you stopped
early and called it coverage.

## Fix it

One row per distinct way to fail, each row carrying a count, a share of what you read, a severity, an
effort and the name of the check that will catch it. Nothing gets merged that the notes do not support,
and every trace ends in a row or in a written-down leftover.

On the scoreboard this looks like a worse result. The counts table grows to the number of rows your notes
actually support, the largest share falls, and the number of distinct failure modes named goes up. Every
one of those three movements looks like going backwards on a dashboard and is the signature of a taxonomy
that can survive being handed to somebody else. The **Export notes and tags** button then produces the
artefact: a JSON file where every tag still has the notes that justify it, which is the difference between
a taxonomy and a list of opinions someone liked.

## How do I know it works?

**Dev run.** Read 20 traces from the default random batch, note before tagging, and produce a taxonomy
sheet.

**Target:**

- At least 4 distinct rows, every one applicable from a span field rather than from a feeling.
- Every row with a count, a share of the 20 traces read, a severity, an effort and a named check.
- At most 1 trace in no row at all. Two is a missing row, not a leftover.
- Largest row under 60% of what you read — the same bar the lab's callout uses.
- A ranked list whose top row has a reason that is not "it is the biggest".

**Validation, once.** Set **Slice** to `Working here` — 24 traces, five of which are in the default batch —
and read the first 10. Target: at least 8 of the 10 land in a row you already have without inventing
one. For each miss, write down whether it is a genuinely new failure mode or the same failure worded
differently. The second kind is a naming defect in your sheet, not a finding, and it is the thing two
analysts will disagree about when they re-run your coding next quarter.

## Use / don't use

**Do use** the taxonomy as the backlog and as the argument for which check to build first: it is the only
place in an eval project where "we are fixing the third-biggest failure" is a decision with a number
attached. Re-run it after each fix — a row that does not move for three releases is telling you your
fix did not work, and a new row appearing is telling you the fix moved something you had not counted.
In production this is a small, versioned document next to the eval set, and the counts come out of the
annotation store: `select category, count(*) … group by category`. That query is free. The labelling
underneath it is the expensive part, and it is why module 6 spends a lesson on who is allowed to write
those labels.

**Don't use** a count as a priority order on its own; a taxonomy as a quality score, because it has no
row for the answers that were correct and a sheet that only describes failure describes half the
behaviour; or a merged row as a way of making the document shorter. And do not build a judge for a row
whose check cannot be written down as a rule — if your criterion for that row is "does the answer feel
right", you have not finished deciding what to build.

## Reflect

1. Take your largest row and write its severity and effort honestly, next to the count. Did the rank
   change? If it did not, what would have to be true for it to?
2. Find one row that no check can catch. Write the row's name, then decide: is that a reason to build a
   judge, or a reason to accept it and say so out loud — and what will you do about it in the meantime?

The sheet this lesson fills in is in [templates/failure-taxonomy.md](../../templates/failure-taxonomy.md).
Its counts are printed from the shipped dataset, so they match the table in **How it works** — but the
severity and cost columns in that sheet are one team's opinions, and they are the columns you are meant
to overrule.

## Sources

- [Braun & Clarke — Using thematic analysis in psychology](https://doi.org/10.1191/1478088706qp063oa) — where open coding and axial coding come from, and why the second pass is a re-reading of the first, not a fresh look.
- [Hamel Husain — Your AI Product Needs Evals](https://hamel.dev/blog/posts/evals/) — error analysis first, and the argument that the categories come from your data rather than from a list someone made in a meeting.
- [Anthropic — Define success criteria and build evaluations](https://platform.claude.com/docs/en/docs/test-and-evaluate/develop-tests) — the same workflow as production guidance: failures first, checks after.