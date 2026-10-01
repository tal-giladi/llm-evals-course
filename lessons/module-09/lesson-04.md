---
id: "09.4"
module: 9
minutes: 16
practice_minutes: 45
prerequisites: ["09.1", "09.2", "02.3"]
objectives:
  - Read a first-bad-step distribution over 20 failing runs with its denominator and interval, and say what share of failures a check on the first tool call would actually catch.
  - Explain why the per-step partial-credit metric prints no interval, and compute both the pooled step ratio and the mean of per-run ratios from the same 40 runs.
  - Turn a step index into a routed ticket by grouping twenty step labels into a small taxonomy, and hand-label the runs the free checks cannot reach.
volatility: concept
sources:
  - title: "Let's Verify Step by Step (Lightman et al., 2023)"
    url: https://arxiv.org/abs/2305.20050
  - title: "ReAct: Synergizing Reasoning and Acting in Language Models (Yao et al., 2022)"
    url: https://arxiv.org/abs/2210.03629
  - title: "OpenTelemetry GenAI semantic conventions — agent spans"
    url: https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/
last_verified: "2026-10-01"
---

# 09.4 · Finding the failing step

A run-level score tells a team the agent failed; it does not tell them where. On these 40 runs the difference is
between *"the agent is unreliable"* and *"it uses the wrong unit after it has already found the right recipe"* —
two tickets, two owners, two fixes — and the thing that separates them is one integer per failing run. This
lesson reads that integer as a distribution, because **the first bad step is usually not the first step**.

## Why it matters

A team has a trajectory metric. It reads 50.0% (35.2%–64.8%) over 40 runs. Somebody puts that on the dashboard and
the stand-up asks the obvious question: *50%. So what is it doing wrong?*

The dashboard cannot answer, because it is reporting a verdict and not a location. So the engineer opens ten
traces, reads them, and writes in the incident doc:

> *The agent is unreliable.*

Which is true, useless, and has already been in every incident doc for six weeks. Nothing in it tells anyone what
to do, and so nothing in it ever gets fixed.

Now suppose the same ten traces had come with one integer attached to each failure — *step 2 of 3* — and the
engineer had written:

> *Five of the twenty failures are `convert_units` calls with the wrong target unit, and in all five the recipe was
> already found. Five are `scale_quantities` calls with the wrong factor. Five are `search_recipe` calls with the
> wrong tag. Three are `set_timer` calls with the wrong duration. Two are `read_recipe` calls against the wrong
> record.*

That is three tickets and a decision. One goes to the conversion tool, one to the scaling tool, one to the
search layer, and the fact that the first five had already retrieved the right recipe is what tells you the
answer side is probably fine.

The cost of getting from the first paragraph to the second is **one integer per failing run**. On this corpus that
is twenty labels, written once.

## How it works

### The whole addition is one field

Every run in the dataset carries `first_bad_step`: an integer index into `steps`, with `-1` meaning no step was
wrong. That is the entire difference between a score you cannot act on and a score you can:

| Without the index | With the index |
| --- | --- |
| `a21` failed. | `a21` failed at step 2 of 2 — `scale_quantities(1→4)`. |
| `a31` failed. | `a31` failed at step 2 of 3 — `read_recipe(id=garlic bread)`. |

[2.1](../module-02/lesson-01.md) is the lesson that tells you a run is a list of spans and that the list order
falls out of the `parent` links; [2.3](../module-02/lesson-03.md) is the lesson that turns a pile of labelled
failures into a taxonomy you can act on. This is where the two meet: the index is the label, and the label is the
taxonomy's atomic value.

### Where the faults are, over the 20 failing runs

Every run with a `first_bad_step >= 0`, counted from all 40:

| First bad step | Runs | Share of the 20 failures | Wilson 95% | Runs |
| --- | --- | --- | --- | --- |
| Step 1 | 7 | **35.0%** | 18.1%–56.7% | `a22`, `a23`, `a25`, `a30`, `a34`, `a35`, `a38` |
| Step 2 | 10 | **50.0%** | 29.9%–70.1% | `a21`, `a24`, `a26`, `a27`, `a28`, `a29`, `a31`, `a32`, `a39`, `a40` |
| Step 3 | 3 | **15.0%** | 5.2%–36.0% | `a33`, `a36`, `a37` |

Runs in this corpus are short — 4 runs have one step, 21 have two, 15 have three, a mean of **2.27** — so three
positions cover everything. Across the 20 failures the mean first bad step is **1.80**, which is **79.1%** of the
way through the average run.

Read that as a correction rather than a curiosity, because the intuitive claim is wrong in both directions:

- **"Check the first tool call" catches 7 of the 20 failures — 35.0% (18.1%–56.7%).** It is the largest single
  position and it is still a minority, with an interval running from 18% to 57%.
- **The fault is in the first half of the route in 11 of the 20 failures — 55.0% (34.2%–74.2%).** In the other
  nine it happens after the midpoint, which is where "it got the recipe right and then ruined it" lives.

### Group the labels, and the fault has an owner

The bad steps are twenty strings across five tools:

| Bad step's tool | Runs | Which runs |
| --- | --- | --- |
| `scale_quantities` | 5 | `a21`, `a24`, `a28`, `a29`, `a39` |
| `convert_units` | 5 | `a22`, `a30`, `a33`, `a37`, `a40` |
| `search_recipe` | 5 | `a23`, `a25`, `a34`, `a35`, `a38` |
| `set_timer` | 3 | `a26`, `a32`, `a36` |
| `read_recipe` | 2 | `a27`, `a31` |

Five labels for twenty failures, and eighteen distinct call strings — `search_recipe(tags=main)` appears twice
(`a34`, `a38`) and `search_recipe(tags=vegetarian)` twice (`a23`, `a35`). This is [2.3](../module-02/lesson-03.md)
with a denominator: the grouping tells you that conversion, scaling and search each account for a quarter of the
failures, which is three tickets rather than twenty, and the fact that they are equal is the argument for fixing
all three rather than the one that happened to page someone.

### The partial-credit metric, and why its two answers differ

The third scoring mode on the panel gives each run the share of steps before its first bad one. Two ways to
average that over the 40 runs, both correct arithmetic, both on the page's data:

| | Value | What it weights |
| --- | --- | --- |
| Pooled: steps before the first bad step, over all steps | 62 of 91 = **68.1%** | every **step** equally, so long clean runs count for a lot |
| Mean of the 40 per-run ratios | **57.9%** | every **run** equally, so runs that fail early count for a lot |

Ten points apart, answering different questions. The lab prints **57.9%** and deliberately leaves the interval
column as `—`, because a mean of 40 ratios is not a proportion of 40 successes and a Wilson interval does not
describe it. That is not a missing feature; it is the metric telling you what shape it is.

The distribution underneath is where the price shows up:

| Per-step score | Runs |
| --- | --- |
| 1.00 | 20 |
| 0.67 | 2 (`a34`, `a35`) |
| 0.50 | 1 (`a38`) |
| 0.33 | 4 (`a31`, `a32`, `a39`, `a40`) |
| **0.00** | **13** |

Thirteen runs score zero. Four of them are one-step runs whose only step was wrong (`a22`, `a23`, `a25`, `a30`),
six are two-step runs whose second step was wrong, and three are three-step runs whose third step was wrong
(`a33`, `a36`, `a37`). **A run that never worked and a run that worked for two steps and then broke both score
0.00.** Partial credit tells you a run failed; only the index tells you it got three-quarters of the way there
first, and `a36` — right search, right scaling, wrong timer — is the run where that distinction decides whether
you file against the timer tool or against the search layer.

### Where a judge earns its keep, and how little of it there is

The step label is a judgement call and there is no arithmetic that replaces it. Is `search_recipe(tags=vegetarian)`
wrong for *Find a gluten-free main*? A human decides, by reading the task and knowing what the tag means.

But the volume is tiny, and that is the argument for doing it by hand rather than by model. **Twenty labels** cover
every failing run in this corpus, on traces the viewer already renders, and once written they are ground truth
forever — the labelled set a future judge is validated against, per [6.1](../module-06/lesson-01.md) and
[5.1](../module-05/lesson-01.md). Lightman et al. released 800,000 step-level human labels for the same reason:
a step label is an artifact worth collecting, because a run-level score tells you nothing you can act on.

What you must not do is infer the label from a different signal and call it a label. In `a34` the first bad step is
the `search_recipe(tags=main)` at step 1, while the thing [9.2](lesson-02.md)'s ordered tool check fires on is the
*extra* `read_recipe` at step 3. Both are true, they are different objects, and a failure list that shows only one
of them will send the ticket to the wrong team.

## Show me

The preset is the one built for this lesson, and it is worth reading carefully — **including how it opens.**

It opens on a scoring method that is **not one of the three options** in the `Scoring method` radio group. The
consequence is visible if you look for it: no radio is checked, the pass-rate tile reads **0.0% (0.0%–8.8%)**, and
the list below is headed *Runs failing this scoring (40)*. That is `verdictFor` falling through to its
`default: return 0` branch — a run it has no rule for is scored as a failure, and all forty are. The panel's three
rows are still there, still correct, and still 75.0% / 50.0% / 57.9%; none of them is highlighted, because none of
them is the selected method.

So: click **`Trajectory — every step`** once and the page becomes the one this lesson describes.

| Tile | Value after the click |
| --- | --- |
| Pass rate | **50.0%** (35.2%–64.8%) |
| Runs | 40 |
| Wrong route, right answer | **10** |
| Calls per run | **1.0** |

The panel now highlights the trajectory row, and the list beneath it is headed *Runs failing this scoring (20)*,
printing the first ten in dataset order with the step index on every line:

> *Scale the banana bread from 1 tin to 3 tins.* · *Ended in the wrong state.* · first bad step: **2 of 2** —
> `scale_quantities(1→4)`
>
> *Find a side that takes under 15 minutes.* · *Ended in the wrong state.* · first bad step: **1 of 3** —
> `search_recipe(tags=main)`

Under the list, a `<details>` block titled **Locating the failing step** opens the sentence this lesson is built on:

> A binary run-level score tells you the agent failed. It tells you nothing about where. Attaching a step index to
> each failure is what turns a metric into something you can debug — and it is the difference between 'the agent
> is unreliable' and 'it uses the wrong unit after searching'.

Then use the **Run** picker, which is what this preset is really for. Do this, in order:

1. **Open `a21`, `a24`, `a21`'s neighbour `a29`.** Both are *Scale X to N* runs that ended wrong, both have the bad
   step at position 2, and the arguments are `1→4`, `6→6` and `4→4`. Three runs, one label, one ticket.
2. **Open `a36` and compare it with `a16`.** Identical task strings, identical first two steps, and the third step
   is `set_timer(10 min)` in one and `set_timer(90 min)` in the other. Both are recorded runs in this corpus, and
   they are the cleanest illustration on the page of what a step index is for.
3. **Open `a22` and `a33`.** Both `convert_units` failures with a wrong target unit, both two- and three-step runs
   respectively, and both score **0.00** on per-step scoring. Work out which one got further before it went wrong.
4. **Switch to `Per-step partial credit` and read the tile's interval field.** It does not print one; the tile
   reads *per-step mean*. Put 57.9% next to the pooled 62/91 = 68.1% and decide which one you would put on a
   dashboard and which one you would put in a footnote.
5. **Press `Export runs`.** Four fields per run: `id`, `end_state`, `first_bad_step`, `score`. The whole diagnostic
   is in the export; the score on screen is a summary of it.

> [!NOTE]
> > The 40 runs, their spans, their step lists and their first-bad-step indices are **generated for teaching by an
> > educational model**, not captured from a real agent deployment. Every count and rate above is computed for real
> > in your browser from those recorded runs. None of it is a measurement of a named agent system, and the
> > distribution over the 20 failures is a property of this corpus.

## Try it

**Predict first**, on paper:

1. Twenty runs have a bad step and runs in this corpus average 2.27 steps. At which step do you expect most of the
   faults, and what share of the twenty would a check on the *first* tool call catch?
2. Read `a22` (one step, wrong) and `a33` (three steps, the third wrong). Both score 0.00 on the per-step metric.
   Name the information the metric throws away, and say which number on the panel you would use to get it back.
3. Group the twenty failing runs by the tool in the bad step. How many groups do you get, and how many of them
   point at a different team from the others?

[Simulation: agent-evals](../../simulations/agent-evals/index.html?preset=trace)

1. **Write the index next to every failure before you read the list.** Export the runs and build your own table:
   run, task, end state, first bad step, bad step text. You should reproduce the 7 / 10 / 3 split and the
   5 / 5 / 5 / 3 / 2 split by tool exactly.
2. **Label the twenty failures by hand and write the five labels down.** `wrong scale factor`, `wrong unit`,
   `wrong search tag`, `wrong duration`, `wrong record`. Count each. Then read the three largest and write the
   one-sentence ticket for each — who owns it and what change fixes it.
3. **Compute both averages yourself.** 62 of 91 steps, and the mean of the 40 per-run ratios. Write both on the same
   line, then write one sentence saying which question each answers and which you would put on the dashboard.
4. **Find the two runs that make the point of this lesson.** Look for a repeated task string where one run is clean
   and the other is not — `a16`/`a36` and `a20`/`a40` both qualify. For each pair, write down what the step index
   adds to the end-state score, and what a ticket filed from the index alone would say.
5. **Test whether the index is enough.** Find the run where the first bad step and the tool-check failure point at
   different calls — `a34` is the one — and decide whether your failure list should print the first bad step, the
   whole step list, or both.

## Break it

**Lint the first tool call and declare it done.** The largest single position on the distribution is step 1, and a
check on `search_recipe` arguments is cheap, so it goes in CI and everyone moves on. It catches **7 of the 20
failures — 35.0% (18.1%–56.7%)**, which is a minority with an interval that reaches past 55%. The lie has a name:
**an index is a position, not a cause.** Ten of the twenty failures are at step 2, and step 2 is a scaling call in
three of them, a conversion in two and a search in two. "The fault is at step 2" tells you nothing about which team
to wake up.

**Report 68.1% and 57.9% as one per-step score.** They are both arithmetic over the same 40 runs and they are ten
points apart, because one weights steps and the other weights runs. The lie: **a mean of ratios and a ratio of
totals are different quantities wearing the same percentage sign.** The lab prints one of them and prints `—` in
the interval column, and someone on the team who computes the other one by hand will not notice the difference.

**Ship the failing-step list with the end state removed.** The index says *where*; nothing on a
step-only list says whether the user got an answer. `a34`'s first bad step is the search at position 1, and the
`read_recipe` that [9.2](lesson-02.md)'s check flags is at position 3 — so the list would file the wrong ticket.
The lie: **the first bad step is a place, not the whole fault**, and a failure list that shows only one of the two
is the same class of error as the dashboard with one number on it.

## Fix it

1. **Store one integer per failing run and print it beside the score.** `first_bad_step` next to the end state,
   with the step's own text, exactly as the lab's failure list does. It is a few bytes per run and it is the only
   reason a reader can act on the number at all.
2. **Print the end state next to the index, never instead of it.** *Ended in the wrong state* and *Reached the
   right end state after a wrong step* are different urgencies and they are on separate lines of the same record.
   A run that got the right answer and left a mess behind is a ticket; a run that got the wrong answer is a bug.
3. **Group the step labels into a small taxonomy before you act, and count each group with its `n`.** Five groups
   over twenty failures here, roughly equal. That is [2.3](../module-02/lesson-03.md) done on a step index, and it
   converts twenty tickets into three.
4. **Hand-label the steps, once, and keep the labels.** Twenty labels on this corpus. They cost an afternoon, they
   are the ground truth any future judge is validated against, and unlike a per-step model verdict they do not get
   worse when you change the prompt.
5. **Decide whether you need per-step labels or just the first bad index.** The shipped record keeps one index, and
   one index is enough for attribution — it names the tool and the owner. It is not enough to know whether the
   agent recovered, and that question needs a label on every step, which on this corpus is 91 labels rather than
   20. Price the difference before you promise the second one.

## How do I know it works?

**Challenge, on dev.** The same random 20-run half used in [9.1](lesson-01.md) and [9.2](lesson-02.md),
`sampleItems(runs, 20, "random", 42)`:

| Dev half (seed 42, n = 20) | Value |
| --- | --- |
| Runs with a bad step | 10 |
| First bad step: step 1 / step 2 / step 3 | **3 / 4 / 3** |
| Mean first bad step | **2.00** of a mean 2.40 steps — 83.3% of the way through |
| Per-step mean | **55.0%** |
| Bad-step tools | `convert_units` 3, `scale_quantities` 3, `search_recipe` 2, `set_timer` 2, `read_recipe` 0 |
| Free tool-name check flags | **2** of the 10 (`a33`, `a37`) |

Three requirements. Every failing run carries a step index and a tool. Every tool that appears in the dev half has a
label you can write a ticket from. And the hand labels agree with the dataset's own index — you labelled the same
step the shipped field names, which is the only validation available when you did not write the labels yourself.

**Then one held-out validation** on the other 20, read once:

| | Dev (seed 42, n = 20) | Held-out (n = 20) |
| --- | --- | --- |
| Runs with a bad step | 10 | 10 |
| First bad step: step 1 / step 2 / step 3 | 3 / 4 / 3 | **4 / 6 / 0** |
| Mean first bad step | 2.00 of 2.40 (83.3%) | 1.60 of 2.15 (74.4%) |
| Per-step mean | 55.0% | 60.8% |
| Bad-step tools | convert_units 3, scale_quantities 3, search_recipe 2, set_timer 2 | scale_quantities 2, search_recipe 3, set_timer 1, read_recipe 2, convert_units 2 |

The mean position moved from 2.00 to 1.60. **You cannot act on that.** It is a 0.4-step difference computed from
ten failures per half, and [4.4](../module-04/lesson-04.md) is the reason: there is no interval here worth reading,
and if you built one it would cover most of the range a run can have. Nobody should claim from this split that the
agent fails earlier on the held-out half or that it is getting better at recovering.

What the split *does* validate is the taxonomy, and it validates it in the way a split can: across the two halves
all five bad-step tools appear, and `read_recipe` — absent from dev — shows up twice in the held-out half. A
five-label taxonomy built by reading 20 traces of one block covers the population; a taxonomy built from the same 20
traces sorted by id would have looked identical. That is the claim the held-out half supports, and it is a claim
about **coverage of the label set**, not about a rate.

## Use / don't use

**Do attach a step index to every failure, and print the step's own text next to it.** `a21` is not a failure, it is
`scale_quantities(1→4)` at 2 of 2, and the second form is the one somebody can act on.

**Do count the labels.** Five tool labels over twenty failures tells you the shape of the problem; twenty
individual tickets tells you only that there were twenty. Group them the way [2.3](../module-02/lesson-03.md)
says to, every time.

**Do keep the end state in the same record as the index.** They answer different questions and the second one
without the first routes tickets to the wrong team.

**Do hand-label a small set and keep it.** Twenty labels is an afternoon and it is the only labelled step data you
will ever have for judging anything.

**Don't report a mean position without its denominator.** "Fails at step 1.80 on average" over 20 failures is a
fact about 20 runs; over 200 it would be a fact about a different population, and the two are not comparable.

**Don't treat the first bad step as the whole fault.** It is the first one. A run can go wrong twice — `a34` has a
bad search at step 1 and an extra read at step 3 — and a list that shows only the first hides the second.

**Don't put a per-step mean on a dashboard without saying what it is a mean of.** 57.9% and 68.1% are ten points
apart and both correct; the lab prints `—` in the interval column for exactly this reason, and a percentage with no
denominator shape is a percentage nobody can argue with.

What teams actually do: the trajectory score and the first-bad-step index are written to the same record every
run; the failure list shows the step index, the step's text and the end state together; labels are counted by tool
monthly so a new failure mode shows up as a new group rather than as a slightly lower number; a hand-labelled
step set is kept as the reference for anything automated that touches step correctness; and the per-step mean is
reported in a footnote with its definition attached.

## Reflect

1. Your trajectory metric reads 50.0% on 40 runs and the stand-up asks what the agent is doing wrong. Write the
   sentence your answer would look like with a step index attached, and say which of the five tool labels you would
   open a ticket on first and why.
2. Seven of twenty failures are at step 1 and ten are at step 2. A colleague proposes a CI lint on the first tool
   call and a second on `search_recipe` arguments everywhere. Work out what each catches on these 40 runs, and
   write what you would tell them the intervals do and do not settle.
3. `a22` and `a33` both score 0.00 on the per-step metric. Explain what the metric cannot tell you about them, name
   the field that can, and say what it would cost you to populate that field on all 91 steps of this corpus.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Hunter Lightman et al., [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) (2023) — the case for
  collecting step-level human labels as a first-class artifact rather than deriving a step verdict from the final
  one, and the dataset size that shows how much of that work exists in the wild.
- Shunyu Yao et al., [ReAct: Synergizing Reasoning and Acting in Language
  Models](https://arxiv.org/abs/2210.03629) (2022) — the interleaved trajectory whose steps are the unit here, and
  the observation that reading them is part of what makes the agent inspectable.
- OpenTelemetry, [GenAI semantic conventions — agent
  spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) — the parent/child ordering that
  gives you "step 2 of 3" for free, and the span fields a step label has to be attached to.