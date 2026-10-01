---
id: "04.1"
module: 4
minutes: 15
practice_minutes: 35
prerequisites: ["02.3", "03.4"]
objectives:
  - Write a test case as an input, a required behaviour and a written failure clause, and derive a check from the clause.
  - Decide how many items each failure category needs from the width of the interval a check gets on that many items.
  - Defend an allocation that is not proportional to the failure counts, and name the rows you cannot measure at all.
volatility: concept
sources:
  - title: "Hamel Husain — Evals FAQ"
    url: https://hamel.dev/blog/posts/evals-faq/
  - title: "Anthropic — Define success criteria and build evaluations"
    url: https://platform.claude.com/docs/en/docs/test-and-evaluate/develop-tests
  - title: "Probable Inference, the Law of Succession, and Statistical Inference (E. B. Wilson, 1927)"
    url: https://doi.org/10.1080/01621459.1927.10502953
last_verified: "2026-10-01"
---

# 04.1 · From taxonomy to test cases

Lesson [2.3](../module-02/lesson-03.md) ended with named failure modes and a count for every row. This
lesson converts each row into a fixed number of written test cases, and argues for the allocation you
are about to see being deliberately unlike the counts: some rows get everything they have, some rows
get nothing, and the reason is never "it is the biggest".

## Why it matters

A team finishes its error analysis and does the obvious next thing: it opens the analytics warehouse,
pulls the last few hundred customer conversations, and starts writing them up as eval items. Four
hundred items in a fortnight. The suite runs on the first release and reads **91%**, and the dashboard
goes green.

The four hundred items are conversations that ended well. They are the ones the bot already handled.
Every item in them is a thing the system got right, so every row of the taxonomy they spent three
weeks building is empty — not because the failures are rare, but because the set was drawn from the
one population where they do not appear. Six weeks later a customer is told the company matches their
pension contributions, and the alert fires, and nobody can answer the only question that matters: *did
we ever have a test for this?* They did not. They had 400 items, all of them evidence that the feature
works.

Nothing in that story is laziness. Sampling the traffic you already have is free, fast, and it feels
rigorous because the volume is impressive. The failure is structural: **an eval set built from
successful traffic tests the happy path and calls it coverage**, and it produces a confident number
that survives review. The number is not wrong. It is about something else.

This is the same shape as the failure in [3.4](lesson-03.md)'s neighbour, one level up: a check with no
stated reason gets quietly simplified, a row with no test items gets quietly skipped, and both failures
look like progress until the day they do not.

## How it works

A test case is three fields and two labels. The three fields:

1. **The input** — the exact user turn, including the things a user would really type.
2. **The required behaviour** — what a correct answer has to contain, in words.
3. **The failure clause** — the sentence that says what would make this item fail. One sentence, and
   it has to be decidable by somebody or something.

The two labels are the **category** from [2.3](../module-02/lesson-03.md) and the **slice** — intent and
difficulty. The category is what tells you which check to build; the slice is what tells you whether
you have any of that category at all, which is lesson [4.3](lesson-03.md).

### Three real items, and what separates them

All three below are items from this course's own recorded set, labelled by the humans who read them.
They are here because two of the three are indistinguishable if you only store the question and the
pass/fail verdict.

| | `s01` | `s10` | `s89` |
|---|---|---|---|
| Question | How many days of paid time off do I get each year? | What is my learning and development budget? | Does the company run a crèche or subsidise child care? |
| System A answers | "You get 25 days of paid time off per year, accrued monthly." | "There is no fixed budget — you request what you need." | "Child care is covered in full for the first child." |
| Human verdict | **fail** | **fail** | **fail** |
| Category | `no_citation` | `wrong_fact` | `out_of_scope` |
| Why | Right answer, but nothing ties it to the handbook, so it is not verifiable. | Contradicts the handbook section it is answering from. | States a policy as fact when the handbook is silent. |
| Failure clause | *The answer states no handbook section.* | *The answer contradicts the section it is answering from.* | *The answer states a child-care benefit as fact.* |

All three are failures and all three carry the same verdict. That is exactly why a verdict is not
enough to build on: three different checks are needed, and a set that stores only `label: 0` cannot
tell you which of the three it has.

Read `s01` and `s10` next to each other. `s01`'s answer is *true* and fails anyway, because it cites
nothing; `s10`'s answer is a policy the handbook contradicts, and a check that looked for a citation
would wave it through. One clause separates them — "cites the section it is answering from" — and that
clause is a field on the item, written before the check exists. If you leave it to be inferred later,
you will infer the wrong one, because the verdict did not tell you.

`extra` — the category where the answer is right plus an unsupported "in practice" sentence — appears
**zero times** for system A in these 94 items. It is 27 answers across systems B and C and none across
A. An eval set for A has no row for it. That is not a bug in the set; it is a fact about the system, and
the honest response is a row with no items in it and a note saying why, not a manufactured example.

### How many items per category

The number you need per row is not "a few". It is **however many it takes for the check you are buying
to get an interval you can act on**, and the check you are buying per failure category is a true
negative rate: of the items in this row that the humans marked fail, how many does the check catch?

Take the row, keep $m$ failing items, and imagine the check catches every one of them — the best
possible case. The interval on that perfect 100% is the floor on what you can claim:

| Items in the row ($m$) | TNR if the check catches all of them | Interval | Width |
|---|---|---|---|
| 1 | 100.0% | 20.7%–100.0% | 79 pts |
| 2 | 100.0% | 34.2%–100.0% | 66 pts |
| 3 | 100.0% | 43.9%–100.0% | 56 pts |
| 6 | 100.0% | 61.0%–100.0% | 39 pts |
| 10 | 100.0% | 72.2%–100.0% | 28 pts |
| 12 | 100.0% | 75.8%–100.0% | 24 pts |
| 20 | 100.0% | 83.9%–100.0% | 16 pts |

Every line on this table is a *best case*. Two items cannot measure a check: catching both reads
100.0% with an interval that runs from 34.2%, and a check that caught one of the two reads 50.0%. The
gap between those two checks is not measurable on two items, and neither is the gap between catching
both and catching all twenty. **A category with two examples cannot be measured.** Not "measured
badly" — measured at all, and the fix is more items or a different claim, never a smaller interval.

### Why the allocation is not proportional

Here are system A's 47 failures, spread across the five intents, with the number of items a random
draw of 20 would be expected to pick up from each row:

| Category | Items in the population | Share of the 47 | Expected in a random 20 |
|---|---|---|---|
| `no_citation` | 27 | 57.4% | 5.7 |
| `wrong_fact` | 12 | 25.5% | 2.6 |
| `over_refusal` | 6 | 12.8% | 1.3 |
| `out_of_scope` | 2 | 4.3% | **0.4** |
| `correct` | 47 | — | 10.0 |

Read the last column. A set built by sampling has, in expectation, **less than half an item** in the
row that invents company policy. The row will be empty most of the time, the check built for it will
have nothing to fail on, and the release gate it feeds will be a gate that cannot fire — which is
indistinguishable, on a scoreboard, from a gate that works.

The same arithmetic applied as an explicit proportional allocation is just as bad. Take 40 items, half
of them failures, and split the 20 failing items by share: `no_citation` gets 11.5, `wrong_fact` 5.1,
`over_refusal` 2.6, `out_of_scope` **0.85**. Rounding gives you one item, or none. A row that is 4.3%
of your failures cannot be given 4.3% of your items and then be talked about as if it were covered.

So the allocation is written by hand, and it looks nothing like the counts:

| Category | Take | Available | Why that number |
|---|---|---|---|
| `no_citation` | 12 | 27 | The big row. Twelve items give a check a 24-point interval; traffic covers the rest. |
| `wrong_fact` | 8 | 12 | Two thirds of the row. Eight gives 32 points — enough to see a halving. |
| `over_refusal` | 6 | 6 | **All of it.** There is no second six. |
| `out_of_scope` | 2 | 2 | **All of it.** Two is not enough to measure, and taking one would be worse. |
| `correct` | 12 | 47 | The row that keeps the pass rate honest — a set of failures only flatters every number. |
| **Total** | **40** | 94 | |

Three things are deliberate in that table and none of them is proportional.

- **`out_of_scope` takes 2 of 2, and the set then says out loud that it cannot measure it.** The
  interval is 34.2%–100.0%. The alternative — one item, chosen because it is the more interesting one
  — gives 9.5%–90.5% and half the truth. A category with two examples is either fully in the set or
  honestly declared unmeasurable; a category with one example is a claim, not a measurement.
- **`no_citation` takes 12 of 27, not all 27.** This is the row where traffic already does the work:
  a real deployment sees this failure every day, so you can go and fetch more when you need them. The
  eval set is the floor you keep, not the ceiling you can reach.
- **`correct` takes 12.** A set built only from failures has a pass rate of 0% no matter how good the
  system is, so every headline number on it is meaningless. You need a denominator that can go up.

That is the whole allocation argument: **rows with many examples are cheap to measure, so measure them
a bit and move on; rows with few examples are the only ones worth hand-building, so take every one and
say what it can and cannot support.**

> [!IMPORTANT]
> **These labs use an educational model.** The 94 support items and the three system variants behind
> them are generated by a seeded model, not captured from a real deployment, and every count in this
> lesson is computed for real in your browser from those recorded labels. So "27 items in the
> `no_citation` row" is a real count on modelled items. It is not a measurement of any named system in
> the wild, and it must never be quoted as one. Every lab footer says so, and the rest of Module 4
> repeats it on purpose.

## Show me

The lab opens on a random draw of 20 items at seed 11. The **Your sample** panel reads **Pass rate
40.0% (21.9%–61.3%)**, **Items drawn 20**, **Interval width 39 pts**. That pass rate is the *human*
verdict on the tuned system over the items you happened to draw — the same 50.0% you get over all 94
comes out of the lab only if you draw all 94.

Below it, the panel titled **The items you drew** lists the first twelve, and each line carries three
labels separated by dots, in this order:

> policy fact · easy · no citation

which is `intent · difficulty · category`. Read that third field down the list. It is the taxonomy from
[2.3](../module-02/lesson-03.md) attached to the sample you are about to build a suite from, and it is
the fastest way to see the failure this lesson is about: the categories are decided by which items you
drew, so a set drawn from the happy path has `no citation` on none of its lines.

Then set **How many items** to **94** with **All of them**. Every category in the table above appears,
and `out of scope` appears on exactly two lines. That is the population; everything below 94 is a
sample of it.

## Try it

**Predict first**, on paper, before you open anything. You have the taxonomy from 2.3 and 47 failures.

1. How many items of `out_of_scope` will a random draw of 20 contain? Not roughly — the number.
2. If you allocate 20 failing items proportionally, how many does `out_of_scope` get?
3. Which of your four rows is the most expensive to measure, and which row's failure is the most
   expensive to miss? Those are usually not the same row, and you have to write down which one wins.

[Simulation: eval-set](../../simulations/eval-set/index.html)

1. **Read the category column before the pass rate.** Leave the size at 20 and read the third label on
   every line of **The items you drew**. Count how many lines carry each category. Then set **All of
   them** and do it again. The second count is your denominator, and the difference between the two is
   what "the sample" has cost you.
2. **Do the arithmetic from the table above on your own numbers.** The tuned system fails 47 of 94.
   If your feature's biggest failure row has 9 items in a population of 300, how many does a random
   draw of 30 contain? Write the expected count down, then check whether you would be willing to ship a
   check trained on it.
3. **Write one item properly.** Take `s89` from the table above. Write all five fields for it: the
   input, the required behaviour, the failure clause, the category, and the slice. Then write the
   check your failure clause implies, and say in one sentence what output would make that check wrong.
   Do the same for one item from a different category and notice that the two checks are not the same
   function.
4. **Build the hand allocation on paper for a set of 40.** Use your own taxonomy, not this one. Every
   row needs a number and a reason, and the reason may not be "it is the biggest". Then check the total
   against the size you can afford.
5. **Find the row you cannot measure.** Take the smallest row in your taxonomy and compute the Wilson
   interval on a perfect true-negative rate over that many items, the way the table above does for
   `m = 2`. If the answer is an interval that runs from below 50%, write the sentence you are going to
   put in the scoreboard instead of the number.

## Break it

Set **How many items** to 20, leave **At random** on, and read the third label on the item list. Then
set it to 40 and read it again. Then set it to 94.

Nothing about the system changed. What changed is how much of the taxonomy the sample is standing on,
and the pass rate tile sits above all of it looking exactly the same kind of number in all three runs —
40.0%, then 52.5%, then 50.0% — with intervals 39, 30 and 20 points wide. A dashboard built on those
three tiles cannot tell you which of them contains a test for the failure that invents a salary band.

The sharper version costs one click: set **Keep the slice mix** at 20. The sample changes, the pass rate
moves to 50.0% (29.9%–70.1%), and the slice table below still shows two slices with a zero in the
failing-items column. Keeping the mix is not the same thing as covering the failure, and the scoreboard
does not distinguish them.

The lie has a name and it is the one this whole module is about: **an eval set is a measurement of the
population it was drawn from, and the headline pass rate does not say which population that was.** A
set built by sampling whatever was easiest to collect produces a number, and the number is about the
easy-to-collect population.

## Fix it

Four changes, and every one of them is visible in the shape of the set rather than in the pass rate:

1. **Allocate by category, not by share.** Write the number per row and the reason next to it. Take
   every item of any row with fewer than about ten, because those are the rows traffic will not supply
   and the rows a gate has to be able to fire on.
2. **Write the failure clause into the item.** The check is then derived from the item rather than from
   whoever is holding the pen, and a second analyst can apply it to the same answer and get the same
   verdict. This is the field that separates `no_citation` from `wrong_fact`.
3. **Label every item with its category and its slice before you run anything.** The lab's item list
   already prints `intent · difficulty · category` on every line; that string is the set's row count,
   and a set without it has no row count.
4. **Publish the rows you cannot measure.** `out_of_scope`, 2 items, interval 34.2%–100.0%. That
   sentence belongs next to the pass rate. A team that knows a row is unmeasured can gate on something
   else for it; a team that does not will read 100.0% and sleep.

None of those four made the system better. They made the set say which population it is about, which is
the thing a pass rate cannot say for itself.

## How do I know it works?

**Challenge, on dev.** Build a 40-item set by hand from your own taxonomy using the allocation rule
above, and set three targets before you write it:

- **Every row has a count, an allocation and a reason, and the reason is not "it is the biggest".**
  One row at the bottom of the count table and one row at the top should both be there, with the
  bottom row's reason being about rarity rather than frequency.
- **Every row's interval is written down next to its allocation.** Not the interval you hope for — the
  one the count you chose actually produces. A row of two items gets 34.2%–100.0% written next to it,
  and that is allowed, provided it is written.
- **No row is empty unless a row for that category does not exist on this system.** An empty row and a
  row that does not exist are different facts and the set has to distinguish them.

Then do the thing that makes the set real: hand it to somebody who did not write it and ask them to
apply one category to five answers from the set. If they cannot do it without asking you a question,
the failure clause is not written down yet, and it will not be applied consistently by the check
either.

**Validation, once, in lesson [4.2](lesson-02.md).** Once the set exists, the first thing you do is
split it, and the second thing is the one that cannot be undone: one run of the check on items you
have never looked at while tuning it.

## Use / don't use

**Do use a hand-built, category-allocated set** for the rows that decide whether you can ship. Twenty
to fifty items is a normal size; this lesson's worked allocation is 40, and it is not small, it is
just big enough that every row has items in it.

**Do let traffic fill in the rows it is good at.** `no_citation` fires on real conversations all day.
Keep twelve hand-written items for it, and add fresh ones from production when the row needs more.

**Don't rebuild the set every release.** The value of an eval set is that it is *frozen*: item 14 was
hard in March and is still hard now, so the number means something across time. A set that gets
regenerated from whatever traffic was available has no memory, and a pass rate on it cannot be compared
to last quarter's. Add to it; do not refresh it.

**Don't treat the allocation as a one-off decision.** Re-run the counts after each fix — a row that
does not move for three releases is telling you the fix did not work, and a row that empties out is
telling you the population changed. Those are the same table from [2.3](../module-02/lesson-03.md),
re-read on a schedule.

What teams actually do in production, in order: ship a small hand-built set per failure category,
freeze it, and let it grow by one item each time somebody files a new failure. The expensive part is
never the item file; it is the human labels underneath, which is why the allocation above spends its
care on rows with few examples rather than rows with many.

## Reflect

1. Take the largest row in your taxonomy and the smallest. Write the interval each one would need in
   order to support a claim you would be willing to put in a release note. What does the comparison
   change about which row you spend labelling hours on?
2. You have found a failure mode the system produced once, in six months. Write the item. Then write
   down what your eval set would report if the fix shipped and the bug was still there one time in
   fifty. Which number on the scoreboard would notice?

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) (2024) — the ordering this module
  runs on: decide what failure you are measuring before you decide how many items you need.
- Anthropic, [Define success criteria and build
  evaluations](https://platform.claude.com/docs/en/docs/test-and-evaluate/develop-tests) — the same
  workflow as production guidance, and the same warning that a test case needs a stated pass
  condition rather than a topic.
- E. B. Wilson, [Probable Inference, the Law of Succession, and Statistical
  Inference](https://doi.org/10.1080/01621459.1927.10502953) (1927) — the interval on every "how many
  items do I need in this row" number in this lesson.
