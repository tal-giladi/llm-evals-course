---
id: "09.2"
module: 9
minutes: 16
practice_minutes: 40
prerequisites: ["09.1", "03.2", "02.1"]
objectives:
  - Write a tool-call check as code against the fields the trace already carries, and state what it costs per run in comparisons.
  - Compute the share of trajectory failures that a free name-and-order check flags on the same 40 runs, with the denominator, and explain why a perfect score on that check is not coverage.
  - Sort twenty trajectory failures into the decidable-by-code, decidable-by-reference and needs-a-judge buckets, and say which bucket a given fault belongs to and why.
volatility: concept
sources:
  - title: "Toolformer: Language Models Can Teach Themselves to Use Tools (Schick et al., 2023)"
    url: https://arxiv.org/abs/2302.04761
  - title: "ReAct: Synergizing Reasoning and Acting in Language Models (Yao et al., 2022)"
    url: https://arxiv.org/abs/2210.03629
  - title: "OpenTelemetry GenAI semantic conventions — agent spans"
    url: https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/
last_verified: "2026-10-01"
---

# 09.2 · Tool-call correctness

The cheapest half of a trajectory check is not a judge — it is a string comparison against fields the trace
already carries, and on this lab's 40 runs it costs **91 comparisons** in total. This lesson prices that check
properly, shows that it catches **6 of the 20** trajectory failures, and then is straight about the other
fourteen: the fault is in the arguments, not the name, and deciding which argument was right is not always a
computation.

## Why it matters

A team reads [9.1](lesson-01.md), decides it needs trajectory scoring, and reaches for the obvious tool: a model
that reads each step and says whether it was correct. They write a rubric, they run it over every step of every
run, and the nightly job now takes eleven minutes instead of four and has a line item. Then the job disagrees
with a unit test the same engineer wrote on the way in, and the team cannot say which one is right — because both
are models of the same question and neither was checked against anything.

Now look at what the trace already holds. Run `a22` is *Convert 350 g of flour to cups.* Its single tool step is

```
convert_units(350 g→oz)
```

That is a bug. It is not a judgement, not a matter of taste, and not something a model has to look at: the task
string names the target unit and the step carries a different one. A test that asserts the unit is `cup` finds it,
runs in microseconds, and fails the same way forever.

The failure this lesson is about is not "we measured the wrong thing". It is **spending a model call on a question
the data structure can answer, and then being unable to adjudicate the disagreement** — because the model's
opinion and the assertion have the same authority and no ground truth.

## How it works

### The rule from [3.1](../module-03/lesson-01.md), wearing an agent's clothes

[3.1](../module-03/lesson-01.md) says: if it is decidable, write code. [3.2](../module-03/lesson-02.md) says how —
a regex or a JSON Schema over a value you already have. A tool call is the best case this rule ever gets, because
the call is not prose. It is a record:

| Field | Example, run `a01` | Source |
| --- | --- | --- |
| `kind` | `execute_tool` | the span |
| `tool` | `scale_quantities` | `span.tool` |
| `name` | `scale_quantities(1→3)` | the rendered call, arguments included |
| `parent` | `a01-1` | nesting, so you get the order for free |
| `duration_ms` | 1008 | how long the call took |
| `tools_expected` | `["search_recipe","scale_quantities","set_timer"]` | shipped on the run |

[2.1](../module-02/lesson-01.md) is the lesson that gets you here: an agent run is a tree of spans, and if you
kept the tree you have kept everything needed to check the route. So a whole tool-call check over these 40 runs
is:

$$91 \text{ comparisons} = \sum_{\text{runs}} \text{steps}$$

Ninety-one string comparisons, computed in your browser, no tokens, no milliseconds, no judge to validate.

### What that free check actually finds, on the same 40 runs

Three plausible versions of "did it call the right tools", all of them code:

| Check | Runs passed | Rate | Wilson 95% | Of the 20 trajectory failures, it flags |
| --- | --- | --- | --- | --- |
| The **set** of tools called, order and count ignored | 40 of 40 | **100.0%** | 91.2%–100.0% | **0** — 0.0% (0.0%–16.1%) |
| The **ordered list** of tools called, exactly | 34 of 40 | **85.0%** | 70.9%–92.9% | **6** — 30.0% (14.5%–51.9%) |

The six the ordered check flags are `a31`, `a33`, `a34`, `a37`, `a39` and `a40`, and in all six the thing that
made the check fire is the same: **the agent called the right tool one extra time.** `a39` calls
`scale_quantities` twice. `a33` calls `convert_units` twice. `a40` calls it twice, first to ounces and then to
tablespoons. Note one wrinkle worth carrying into [9.4](lesson-04.md): in `a34` the extra `read_recipe` is what
fires the check, but the dataset's *first bad step* for that run is the `search_recipe(tags=main)` at step 1. A
check fires about the run; a step index says where. They are different objects and they are not always pointing
at the same line.

Read the first row again, because it is the one that will get shipped by accident: **on all 40 runs, every tool
the agent used is a tool the task needed.** The set-only check passes 40 of 40, its interval runs from 91.2% to
100.0%, and it catches **none** of the twenty runs whose route is wrong. A check with a perfect score and no
coverage is not a good check; it is a check that never fires.

### Why the free check misses fourteen of the twenty failures

Fourteen of the twenty trajectory failures call exactly the tools they were supposed to call, in the right order,
the right number of times: `a21`–`a30`, `a32`, `a35`, `a36`, `a38`. **All ten of the wrong-end-state runs are in
this group.** `a21` is *Scale the banana bread from 1 tin to 3 tins* and its step is `scale_quantities(1→4)`. The
tool name is right. The count is right. The number in the argument is not, and that is the whole failure.

Sort the twenty by what it would take to decide them, and the shape of the problem appears:

| What is wrong | Runs | Decided by |
| --- | --- | --- |
| A tool called one extra time | 4 — `a31`, `a33`, `a37`, `a39` | a **count** comparison: `used.length !== expected.length` |
| A right tool, a wrong argument readable from the task string | 12 — `a21`, `a22`, `a23`, `a24`, `a25`, `a28`, `a29`, `a30`, `a34`, `a35`, `a38`, `a40` | one hand-written expectation per item, then a string compare |
| A right tool, a right count, an argument the task string does not name | 3 — `a26`, `a32`, `a36` (the expected bake time) | a **lookup** in the recipe catalogue |
| The right call against the wrong record | 1 — `a27`, `read_recipe(id=brownies)` for a roast-chicken question | a **lookup** in the recipe catalogue |

Sixteen of the twenty are decided by the task string and a count. Four need a reference table. **None of them
needs a model.** Write that down as a fact about *this corpus*, because the reason it holds is a design decision
and not a law: the task string names the target ("to tablespoons", "from 6 to 2"), and the trace records the
call.

### The honest complication, which is also the reason judges exist

The previous table has a row that should worry you. Twelve faults are "readable from the task string" — by a human
who wrote the task string. In this lab that is 36 distinct task strings over 40 runs, so the check is 36 lines
someone typed by hand. Scale it to an agent with 50 tools, open-ended arguments, and thousands of live tasks, and
the hand-written expectation is the thing that stops scaling, not the comparison.

And here is the part that is genuinely not decidable. Run `a38` is *How long do the tacos take?* and its first step
is `search_recipe(tags=main)`. That is wrong — the task wants tacos — but nothing in the trace says the recipe
catalogue has more than one main course, or that the search would have returned nothing. Whether that call was a
mistake depends on what the tool would have returned, which is state the eval record does not hold. The moment
your agent's tools return something whose correctness depends on a world you did not snapshot, you have left the
`assert` world and entered the [3.4](../module-03/lesson-04.md) world, where the options are a reference lookup,
a judge, or a human.

That is where a judge belongs, and only there. A per-step judge is a measurement instrument with its own error
rate, and it is the most expensive rung on the ladder. [5.1](../module-05/lesson-01.md) on one failure per judge
and [7.4](../module-07/lesson-04.md) on what a judge costs are both downstream of that sentence.

### What the ladder costs, in verdicts

[9.1](lesson-01.md) gave you the verdict counts: **40** end-state checks for 40 runs, **91** trajectory checks for
the same 40 runs, a factor of **2.27**. The page prices the recorded calls too: each of the 40 `chat` spans is
500 input tokens and 120 output tokens at **$0.00003**, so the 40 final answers cost **$0.00120** in total, and
the same 40 runs spent 15,794 ms inside the model and 50,805 ms inside their tools (a mean of 558 ms a tool
call, against a mean run length of 1,752 ms).

At that recorded rate, a per-step judge over these 40 runs would be 91 calls — **$0.00273** — against $0.00120
for 40.

> [!IMPORTANT]
> That last figure is an illustration of **volume**, not a quote. The lab records exactly one `chat` span per run,
> and it is the final answer; it records no per-step judge call, because the recorded agent never made one. A
> step-judge prompt carries a different payload from an answer-judge prompt and would not cost the same. The
> honest claim is the multiplier — 2.27× as many checks, touching all 91 tool calls — and the rest has to be
> measured on your own prompts, as [3.4](../module-03/lesson-04.md) says.

## Show me

The preset opens the lab on **Trajectory — every step**. The tiles read:

| Tile | Value |
| --- | --- |
| Pass rate | **50.0%** (35.2%–64.8%) |
| Runs | 40 |
| Wrong route, right answer | **10** — *invisible to end-state scoring* |
| Calls per run | **1.0** — *a trajectory check runs once per step* |

The mode panel underneath carries all three rows with the trajectory one highlighted, and the callout under it
still reads *10 runs reached the right answer by a wrong route*. Below that, *Runs failing this scoring (20)*
prints the first ten, in dataset order — `a21` to `a30` — each with **Ended in the wrong state.** and a `meta`
line naming the first bad step:

> `Scale the banana bread from 1 tin to 3 tins.` · *Ended in the wrong state.* · first bad step: **2 of 2** —
> `scale_quantities(1→4)`

Note that the heading says 20 and the list shows 10. The panel prints the first ten failing runs; the other ten —
the whole `ok_but_wrong_path` block, `a31` to `a40` — are only in **Export runs**.

Do this, in order:

1. **Open the three failure types by hand.** Pick `a22` from the *Run* dropdown (its bad step is the only step,
   `convert_units(350 g→oz)` for a task that asks for cups). Pick `a31` (three tool calls where the task needs
   two). Pick `a40` (three tool calls, the second to ounces and the third to tablespoons). For each, write down
   which check would catch it: a count, an argument comparison, or neither.
2. **Count the tool calls on the page.** The run panel prints `Calls per run 1.0`; the trace under it shows one
   `chat` span and two or three `execute_tool` spans. The 1.0 is chat spans only. Add up the `execute_tool` spans
   across the 40 runs and you should land on 91 — that is the number of comparisons a whole tool-call check costs.
3. **Do the set-only check by hand.** Read the `tool` field on every `execute_tool` span of one run and write the
   distinct tool names. Do that for `a31` and for `a34`. Both sets are exactly what `tools_expected` says, because
   the extra call was a *repeat* of a tool already in the set. Now write the ordered list instead, and watch
   `a31` fail.
4. **Check the claim that flags nothing.** Export the runs and confirm that all ten of the `wrong` end states are
   runs whose ordered tool list matches `tools_expected` exactly. If so, a name-based check has a recall of zero
   on the failure class that produced the ticket that made you build this.
5. **Price the rung you would actually ship.** 91 comparisons for the name check, versus 91 model calls for a
   per-step judge. Write both on the same line with their denominators, and add the line for what you would have
   to write by hand to get the argument rung: one expected argument per item, and this corpus has 36 distinct
   task strings.

> [!NOTE]
> > The 40 runs, their `execute_tool` spans and their expected tool lists are **generated for teaching by an
> > educational model**, not captured from a real agent deployment. Every statistic and every count above is
> > computed for real in your browser from those recorded spans. None of it is a measurement of a named agent
> > system, and the 100.0%, 85.0% and 30.0% are properties of this corpus.

## Try it

**Predict first**, on paper:

1. The agent used only tools the task needed, on all 40 runs. How many of the 20 runs with a wrong step does that
   check flag, and what does a check that fires on nothing look like on a dashboard?
2. `a21` is *Scale the banana bread from 1 tin to 3 tins* and its step is `scale_quantities(1→4)`. The tool name
   and the call count are both correct. Write the one-line check that fails it, and say where the `4` came from.
3. `a27` asks *What temperature do I roast the chicken at?* and calls `read_recipe(id=brownies)`. Both the tool
   and the argument shape are right. Say what piece of information the eval record is missing that you would need
   before any check — code or model — could decide it.

[Simulation: agent-evals](../../simulations/agent-evals/index.html?preset=trajectory)

1. **Write the free check as code before you open the page.** `runs.filter(r => r.spans.filter(s => s.kind === "execute_tool").map(s => s.tool).join() !== r.tools_expected.join())` should return six ids. If it returns something else, you have filtered the wrong spans.
2. **Split the twenty failures into the three rows of the table in *How it works*** and check your split against the
   runs the panel names. Then work out, for each of the twelve task-string-argument faults, the exact string you
   would compare against — `oz` against `cup`, `4→8` against `1→3`, `tags=main` against `tags=tacos`.
3. **Find the run where the free check is not enough by any code you write.** Look at `a25` (*Find a vegan soup*,
   which searched `tags=vegan`) and at `a35` (*Find a vegetarian soup and halve it*, which searched
   `tags=vegetarian`). Decide whether "the task said soup and the search had no soup tag" is a string comparison,
   a rule, or a judgement, and say what would have to be in the eval record to make it one.
4. **Price two rungs on your own agent.** Take a real agent you have, count the steps in ten recorded runs, and
   work out the comparison count for a name check and the model-call count for a per-step judge at a real per-call
   price. Then find the fraction of those steps where the tool name and the argument are both right — on this
   corpus that fraction is high, and it is the number that decides whether the judge rung is affordable at all.
5. **Write the rung list for your own agent and stop at the last rung you can justify.** Name the data each rung
   needs: the trace, the expected tool list, the expected argument per item, the reference table, the labelled
   set. Whichever rung you cannot name data for, you are not allowed to spend a model call on yet.

## Break it

**Ship `tool selection: 100%`.** The set-only check passes 40 of 40, its Wilson interval is 91.2%–100.0%, and it
flags **none** of the 20 runs whose route is wrong. The lie is the one this whole module is about, wearing a new
hat: **a check that never fires produces a perfect score, and a perfect score on a check nobody validated against
failures is indistinguishable from a check that works.** Every tool the agent used was a tool the task needed.
Ten of those runs reached the right answer by scaling by the wrong factor or converting to the wrong unit.

**Ship `tool correctness: 85%` from the ordered check.** 34 of 40, 85.0% (70.9%–92.9%), and it flags 6 of the 20
failures. Read the denominator: 20 of those 40 runs are already wrong by end state, and on **all ten of them** the
ordered tool list is correct. The lie: **a percentage whose denominator contains the failures you are hunting is a
number that hides them.** The check is silent on fourteen failures and the tile cannot tell you that, because
85.0% and 14.5% are printed in the same type size on different panels.

**Ask a model whether the right tool was called.** This is the expensive version of the same error and it is the
one that produces the eleven-minute nightly job. On `a22` the answer is decidable in a test; on `a38` it is a
judgement; and a single rubric has to serve both, so the model will be confidently wrong on the easy ones in the
same direction every night. The lie: **one rubric for a decidable check and an undecidable one costs you the
decidable one**, because the cheap assertion that would have caught it never gets written — and once you have two
answers to the same question with no ground truth, you cannot tell which to trust. That is [6.3](../module-06/lesson-03.md)'s
disagreement review with nothing to review against.

## Fix it

1. **Rung 1, code, always: the ordered tool list.** `spans.filter(kind === "execute_tool").map(s => s.tool)` must
   equal `tools_expected`. On this corpus that is 91 comparisons over 40 runs, and it catches the four runs that
   call a tool twice. It is the first thing in any agent eval and it costs nothing.
2. **Rung 2, code: the count.** `used.length !== expected.length`. On this corpus it finds the same four runs as
   rung 1, because the extra call is always a repeat — but it is a different check, and the day the extra call is
   not a repeat it finds something rung 1 cannot. A count is the cheapest tool-call invariant there is.
3. **Rung 3, code plus human: the arguments.** One hand-written expectation per item — 36 on this corpus, one per
   distinct task string — and then a comparison. This is where `scale_quantities(1→4)`, `convert_units(350 g→oz)`
   and `search_recipe(tags=main)` die. Ship it as a [3.2](../module-03/lesson-02.md) JSON Schema where the tool has
   one, and as an explicit expected-value list where it does not.
4. **Rung 4, a lookup, not a model: the reference table.** Whenever the correct answer is not in the task string,
   it is in the system the tool reads — the recipe catalogue, the schema, the account. Snapshot what the tool saw
   into the eval record. Four of the twenty failures here need this, and every one of them becomes a comparison
   the moment the catalogue is in the record.
5. **Rung 5, a judge, only for what is left.** If a fault survives rungs 1–4 because it depends on what a tool
   *would have returned*, it is a judge question — and a judge at that point is a new measurement instrument with
   its own error rate, which you validate on a labelled set before it gates anything.

Publish the ladder, not the top rung. A dashboard that says `tool checks: rung 1 + rung 3 (94 comparisons, 0 model
calls)` tells a reader what is actually covered; a dashboard that says `tool correctness: 85%` does not.

## How do I know it works?

**Challenge, on dev.** Draw 20 of the 40 at random — `sampleItems(runs, 20, "random", 42)`, the same half used in
[9.1](lesson-01.md) — and measure the free check against the failures in that half:

| Dev half (seed 42, n = 20) | Value |
| --- | --- |
| Runs the ordered check flags, out of the 10 with a bad step | **2** — `a33`, `a37` — 20.0% (5.7%–51.0%) |
| Of those, wrong end state / wrong route | **0** / **2** |
| Failures the check is silent on | 8 — `a22`, `a24`, `a25`, `a28`, `a29`, `a32`, `a35`, `a36` |

Look at that interval: 5.7% to 51.0% on ten failures. **On 20 dev runs this eval set cannot tell you whether the
check is a good check.** That is the honest result and it is [4.4](../module-04/lesson-04.md) again — the coverage
of a check is a proportion, and a proportion measured on ten failures is worth very little.

**Then one held-out validation** on the other 20, read once:

| | Dev (seed 42, n = 20) | Held-out (n = 20) |
| --- | --- | --- |
| Runs with a bad step | 10 | 10 |
| Flagged by the ordered tool check | **2** — 20.0% (5.7%–51.0%) | **4** — 40.0% (16.8%–68.7%) |
| Flagged that were wrong end state | 0 | 0 |
| Tool calls the whole check examined | 48 | 43 |

Dev and held-out disagree by two runs and both intervals are enormous, so the validation tells you what a 20-item
half always tells you: nothing you can rank on. The useful output of this validation is not the rate. It is the
third row — **zero on both halves** — plus the structural fact underneath it, which needs no interval at all:

> Across all 40 runs, the ordered tool check flags **0 of the 10** wrong-end-state runs and **6 of the 10**
> wrong-route runs.

That is a **census, not an estimate.** The 40 runs are the whole population for this claim, the denominators are
6, 10 and 10, and there is no sampling in it at all. This is the distinction worth carrying out of the module: some
numbers on this page are estimates from a sample and need an interval, and some are counts over the entire
population and do not. *"This check cannot see a wrong argument"* is a census. *"This check catches 30% of
failures"* is an estimate, and 30.0% (14.5%–51.9%) is what it is actually worth.

## Use / don't use

**Do run the name, count and schema checks in CI.** They are microseconds, they are deterministic, and they catch
the class of regression that reaches a user as "the agent did something odd" rather than "the agent was wrong".
They are the part of an agent eval that belongs on a pull request.

**Do hand-write the expected argument per item, and treat the writing as the work.** On this corpus it is 36 lines
for 40 runs. It is also the artifact that stops being useful when you have thousands of live tasks, which is
exactly the point at which you decide whether to buy reference data or a judge.

**Do ship the reference snapshot.** If your tools read a catalogue, a schema or an account state, put what they saw
into the eval record. Four of the twenty failures in this lab are decided by one lookup, and without the snapshot
they are decided by nothing.

**Don't quote a tool-check accuracy without the failure count in the denominator.** `100.0%` and `85.0%` are both
true and both useless on their own, because the corpus contains no faults in tool *selection* to be found.

**Don't let a model judge what an assertion can decide.** The cost is not the $0.00273; it is that you can no longer
adjudicate the disagreement between the assertion and the model, because the model was never the ground truth.

**Don't build the whole check at once.** The rungs are ordered by cost and by how little they can tell you. Ship
rung 1 on day one, look at what it is silent on, and decide whether rung 2 or rung 5 is next. A team that reaches
for rung 5 first has bought an instrument it cannot validate and a latency budget it has not measured.

What teams actually do: a unit-test suite for tool names and argument schemas on the tool layer itself; a nightly
eval that scores end state, trajectory and the argument check on the same frozen items; a reference snapshot in the
record so that catalogue-dependent faults stay decidable; and a judge reserved for the residue, with its agreement
measured on a labelled handful before anybody lets it gate.

## Reflect

1. Your check reports `tool correctness 85.0% (70.9%–92.9%)` and the CI dashboard is green. Write the sentence you
   would put in the PR description that makes the number true, and say what you would add to the board.
2. Run `a25` searched `tags=vegan` for *Find a vegan soup*, and `a35` searched `tags=vegetarian` for *Find a
   vegetarian soup and halve it*. Decide whether "the search had no soup tag" is decidable by code, by a lookup,
   or by a judge — and say what you would put in the eval record to move it one rung down.
3. You have 91 tool calls across 40 runs and the name check finds 6 faults. Write out the full ladder for your own
   agent with the data each rung needs, and mark the highest rung you can justify today. What is the one thing
   missing that would move you up one rung?

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Timo Schick et al., [Toolformer: Language Models Can Teach Themselves to Use
  Tools](https://arxiv.org/abs/2302.04761) (2023) — the decomposition of an agent's competence into *which* API to
  call, *when* to call it and *what arguments to pass*, which is the decomposition this lesson's ladder follows.
- Shunyu Yao et al., [ReAct: Synergizing Reasoning and Acting in Language
  Models](https://arxiv.org/abs/2210.03629) (2022) — interleaved reasoning and action traces, the format that makes
  a per-step check possible at all.
- OpenTelemetry, [GenAI semantic conventions — agent
  spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) — the `execute_tool` span and its
  tool and argument fields, which is what a name-and-argument check reads and what your instrumentation has to
  emit for any of this to be computable.