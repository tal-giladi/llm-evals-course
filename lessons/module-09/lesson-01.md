---
id: "09.1"
module: 9
minutes: 17
practice_minutes: 45
prerequisites: ["08.4", "02.1", "03.2"]
objectives:
  - Score the same 40 agent runs three ways — end state, trajectory, per-step — and say which of the ten disagreements end-state scoring cannot see.
  - Explain with one worked run why a right answer reached by a wrong route is a different defect from a wrong answer, and name the side effect each one leaves behind.
  - Decide which of the two scores your release gate should read, and write the config sentence that makes that choice reviewable six months later.
volatility: concept
sources:
  - title: "τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains (Yao et al., 2024)"
    url: https://arxiv.org/abs/2406.12045
  - title: "ReAct: Synergizing Reasoning and Acting in Language Models (Yao et al., 2022)"
    url: https://arxiv.org/abs/2210.03629
  - title: "OpenTelemetry GenAI semantic conventions — agent spans"
    url: https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/
last_verified: "2026-10-01"
---

# 09.1 · End state versus trajectory

An agent that reaches the right answer has not necessarily done the right thing, and on this lab's 40 recorded
kitchen-assistant runs the two questions score **75.0%** and **50.0%** — the whole difference is ten runs that
arrived by a route nobody chose. This lesson scores the same 40 runs both ways, puts an interval on each, and is
about which one your dashboard should be reporting.

## Why it matters

A team ships a recipe assistant. The dashboard leads with one number: **task success 95%**. It is a good number,
it went up through the sprint, and the team is happy.

Now read run `a39` in this lab. The task is *Scale the French onion soup to 4.* The agent searches for the recipe,
calls `scale_quantities(4→8)`, and then calls `scale_quantities(8→4)`. The first call doubles the order. The second
halves it back. The end state is correct and the task scores as a **pass**. The dataset marks step 2 as the first
bad step, so under trajectory scoring the same run is a **failure**.

Nothing is wrong with the user's evening. Something is wrong with the ledger. If `scale_quantities` writes to an
order draft, that run created a doubled draft, then corrected it; if it appends to a shopping list, the list has
two entries where there should be one. If the tool charges a rate limit or bills an external API, that run spent
it. The end-state metric counts none of this, because by the time it looks, the damage has already been undone —
which is precisely the case where undoing it is the interesting part.

Read `a36` as well: *Double the garlic bread and set a timer.* The agent scales 4→8, which is correct, and then
sets a 90-minute timer instead of 10. The answer the user reads is right. The side effect is an alarm that rings
when the garlic bread has been out for an hour.

This is not a prompting bug. It is a measurement bug with a very long half-life: the number is green, so nothing
triggers, and the only person who finds out is a user reading a list.

## How it works

### Three scores, one function

The whole module is three lines of `verdictFor` in the lab's `app.js`, and everything in this lesson is a
consequence of which branch you take:

```js
function verdictFor(run, mode) {
  switch (mode) {
    case "end":
      // Did it reach an acceptable end state, however it got there?
      return run.end_state === "ok" || run.end_state === "ok_but_wrong_path" ? 1 : 0;
    case "trajectory":
      // Every step correct: the route matters.
      return run.first_bad_step === -1 ? 1 : 0;
    case "steps":
      // Share of steps that were correct.
      return run.steps.length
        ? Math.max(0, (run.steps.length - Math.max(0, run.first_bad_step + 1)) / run.steps.length) : 0;
    default:
      return 0;
  }
}
```

Scoring all 40 recorded runs all three ways, with a Wilson interval from the shipped statistics engine on each
binary rate:

| Scoring | The question it asks | Checks on 40 runs | Passes | Rate | Wilson 95% |
| --- | --- | --- | --- | --- | --- |
| End state | did it end somewhere acceptable, however it got there | 40 | 30 | **75.0%** | 59.8%–85.8% |
| Trajectory | was every step right | 91 | 20 | **50.0%** | 35.2%–64.8% |
| Per-step | what share of steps were right | 91 | — | mean **57.9%** | — (see below) |

The check counts are the cost column, and they are already on the page as the *Calls per run* tile. The 40 runs
carry 171 spans — 40 `agent` roots, 91 `execute_tool`, 40 `chat` — so a trajectory check has **2.27×** as many
things to look at as an end-state check. [9.2](lesson-02.md) takes the cheap one apart; [9.4](lesson-04.md) takes
the third one apart.

### The gap is ten runs, and they are all one kind of run

Every run in this dataset carries one of three end states, and the dataset says which:

| End state | Runs | Share of 40 | Wilson 95% |
| --- | --- | --- | --- |
| `ok` — right answer, right route | 20 | 50.0% | 35.2%–64.8% |
| `wrong` — wrong end state | 10 | 25.0% | 14.2%–40.2% |
| `ok_but_wrong_path` — right answer, wrong route | 10 | 25.0% | 14.2%–40.2% |

The trajectory pass set is *identical* to the `ok` set — runs `a01` to `a20`, all twenty of them, no more and no
fewer. So the 25-point gap between the two rates is exactly the ten `ok_but_wrong_path` runs, and nothing else.
Restated as the number that actually stings: **10 of the 30 runs end-state scoring hands you are runs trajectory
scoring rejects — 33.3% (19.2%–51.2%).** A third of your green.

### Two rates on the same 40 runs: one comparison that fails and one that works

Start with the comparison that does not work. The two Wilson intervals are 59.8%–85.8% and 35.2%–64.8%, and they
overlap between 59.8% and 64.8%. [4.4](../module-04/lesson-04.md) is unambiguous about what that means: if all
you had were the two marginal rates, you could not call the difference.

But you do not have only the two marginal rates. You have **both scores on the same 40 runs**, so you can pair
them run by run:

| Paired on the same 40 runs | Count |
| --- | --- |
| Both score pass | 30 |
| End state passes, trajectory fails | 10 |
| Trajectory passes, end state fails | **0** |
| Both fail | 0 |

Paired difference **−25.0 points**, 95% interval **−40.0% to −12.5%**, exact two-sided p = **0.00195** — ten
discordant pairs, all in one direction. Pairing works here because it removes the run-to-run difficulty that both
marginals carry: the easy runs are in both sets, and what is left is the ten runs where the two questions actually
disagree. If every disagreement had gone the other way, the interval would have contained zero and the honest
sentence would have been *"we cannot rank these two scores on 40 runs."* It does not.

### Reading end-state scoring as a judge

Treat trajectory as truth and end-state as the scorer over the same 40 runs, and you are in the
[6.2](../module-06/lesson-02.md) situation, with a machine doing the judging and the answer already in the trace:

| | Trajectory passes (20) | Trajectory fails (20) |
| --- | --- | --- |
| End state passes | tp **20** | fp **10** |
| End state fails | fn **0** | tn **10** |

Accuracy **75.0%**, TPR **100.0%**, TNR **50.0%**, kappa **0.50** (moderate). The TPR of 100% is the safe
direction and worth naming: end-state scoring never rejected a run that a clean route would have accepted. The TNR
of 50.0% is the number that matters if what you are protecting is the side effects — half of the runs it waves
through left something behind on the way to the right answer.

### The third row deliberately has no interval

The per-step score is **57.9%**, and the lab prints `—` in its interval column, on purpose. It is a mean of 40
ratios, not a proportion of 40 successes, so a Wilson interval does not describe it. Both the mean of ratios
(57.9%) and the pooled ratio of steps-before-the-first-bad-step (62 of 91 steps = **68.1%**) are real numbers on
this corpus, and they disagree by ten points, which is the subject of [9.4](lesson-04.md).

## Show me

The preset opens the lab on **End state only**. The four tiles read:

| Tile | Value |
| --- | --- |
| Pass rate | **75.0%** (59.8%–85.8%) |
| Runs | 40 |
| Wrong route, right answer | **10** — *invisible to end-state scoring* |
| Calls per run | **1.0** — *a trajectory check runs once per step* |

`Calls per run` reads 1.0 because every one of the 40 runs has exactly one `chat` span — the final answer. The
agent's other 91 actions are tool calls, recorded as `execute_tool` spans with no tokens and no price. Hold that
thought; it is the cost argument in [9.2](lesson-02.md).

Under the tiles, the panel titled *Three ways to score the same 40 runs* prints all three rows whether or not the
one you are on, with the current method highlighted:

| Scoring | Pass rate | Wilson 95% CI | Runs passed |
| --- | --- | --- | --- |
| End state | 75.0% | 59.8%–85.8% | 30 |
| Trajectory | 50.0% | 35.2%–64.8% | 20 |
| Per-step | 57.9% | — | — |

And under it, the callout, which is the sentence this lesson exists for:

> **10 runs reached the right answer by a wrong route.** End-state scoring calls them passes. Trajectory scoring
> does not. Which one you want depends on what you are actually protecting: the answer the user sees, or the side
> effects on the way there — cost, rate limits, and writes to systems that are hard to undo.

Below that, *Runs failing this scoring* names **10** runs under end-state, every one of them a `wrong` end state,
each with its first bad step printed:

- `a21` · Scale the banana bread from 1 tin to 3 tins · *Ended in the wrong state.* · first bad step: 2 of 2 —
  `scale_quantities(1→4)`
- `a30` · Convert 700 g of chicken to pounds · *Ended in the wrong state.* · first bad step: 1 of 1 —
  `convert_units(700 g→kg)`
- and eight more of the same shape.

Do this, in order:

1. **Count the ten yourself before touching anything.** They are `a21` to `a30`. Read the end-state column of the
   table above and you will find that all ten share one value — the runs the route rejected *and* the answer
   rejected. Confirm it on the page: the end-state failure list and the trajectory failure list start with the
   same ten names, in the same order.
2. **Switch the Scoring method to `Trajectory — every step`.** The tile becomes **50.0%** (35.2%–64.8%), the list
   becomes *Runs failing this scoring (20)*, and the first bad step is printed on every line. Note what the panel
   shows: only the first ten, in dataset order, so you see `a21`–`a30` again and the ten wrong-route runs are not
   on screen. Press **Export runs** to get all 40 with `end_state`, `first_bad_step` and `score` — the export is
   the only place the full set is visible, and it is three fields per run.
3. **Switch to `Per-step partial credit`.** The tile loses its interval and reads *per-step mean*, **57.9%**, and
   every run with a bad step now has a score between 0 and 1 rather than a 0. The list still reads 20, and the
   detail line on each is the score.
4. **Open one `ok_but_wrong_path` run in the picker.** Choose `a39` in the *Run* dropdown. Under the trace you get
   `Scale the French onion soup to 4.`, `tr_a39`, `end state: ok but wrong path`, `first bad step: 2 of 3`. Read
   the spans: three `execute_tool` spans, two of them `scale_quantities`, and one `chat`. That is the whole
   failure of this lesson in one pane.

> [!NOTE]
> > The 40 runs, their spans and their end states are **generated for teaching by an educational model**, not
> > captured from a real agent deployment. Every statistic on this page is computed for real in your browser from
> > those recorded runs, and every count in this lesson is arithmetic over all 40 of them. None of it is a
> > measurement of a named agent system in the wild, and the rates are a property of this corpus, not a benchmark.

## Try it

**Predict first**, on paper, before you open the page:

1. Thirty of the 40 runs end somewhere acceptable. Ten of them got there after a step the dataset marks as wrong.
   What fraction of your *passes* is that, and what would you tell a stakeholder who asks whether the agent is
   "really" 75% right?
2. The two Wilson intervals on the pass rates overlap. Someone shows you only those two numbers and says the
   difference is not evidence. What is missing from their analysis, and what one extra piece of arithmetic settles
   it?
3. `a36` and `a16` are the same task — *Double the garlic bread and set a timer* — and only one of them ends
   cleanly. Predict which step differs and what the end-state metric says about the pair.

[Simulation: agent-evals](../../simulations/agent-evals/index.html?preset=end-state)

1. **Write out the three end-state values by hand.** Read the end state of all 40 runs from the export and sort
   them into `ok`, `wrong` and `ok_but_wrong_path`. You should land on 20 / 10 / 10, with `a21`–`a30` all `wrong`
   and `a31`–`a40` all `ok_but_wrong_path`.
2. **Find the four repeated tasks.** Four task strings appear twice in the 40 runs — `a04`/`a24`,
   `a14`/`a31`, `a16`/`a36`, `a20`/`a40`. For each pair, write down what end-state scoring says about both runs,
   then what trajectory scoring says. Three of the four pairs are the same story: one clean run and one run that
   reached the same answer by a worse route.
3. **Price the difference in verdicts.** End-state scoring needs 40 checks. Trajectory scoring needs 91. Work out
   the multiplier, then find the two cost figures under the trace of any run — tokens, cost and duration on the
   `chat` span, duration on each `execute_tool` span — and say what that multiplier would cost if a check meant one
   model call at the recorded rate.
4. **Find the tile that does the arguing for you.** The *Wrong route, right answer* tile sits next to the pass
   rate and reads 10, with the note *invisible to end-state scoring*. Decide whether that tile should be on your
   own board, and write the one line you would add to it if it were.
5. **Decide what your agent protects.** For an agent that only reads, end-state scoring is defensible and
   trajectory scoring is mostly overhead. For an agent that can write, it is the other way round. Pick a real agent
   you have shipped or plan to ship, and write the sentence that says which of the two numbers gates it.

## Break it

**Ship 75.0% as "agent success".** The dashboard is green, the sprint was a success, and the ten wrong-route runs
are inside the number without being visible anywhere on it. The lie has a name: **an end-state score is a measure
of the final state, and the sentence in front of it is a claim about the whole run.** That is the [1.3](../module-01/lesson-03.md)
move in an agent costume — a green number on the thing you measured, standing in for the thing you care about.

**Split the 40 runs in order and validate on the tail.** Take `a01`–`a20` as dev and `a21`–`a40` as the held-out
set, which is the reflex when a dataset arrives in a list:

| | Dev, runs a01–a20 | Held-out, runs a21–a40 |
| --- | --- | --- |
| End-state pass | 20 of 20 = **100.0%** (83.9%–100.0%) | 10 of 20 = **50.0%** (29.9%–70.1%) |
| Trajectory pass | 20 of 20 = **100.0%** (83.9%–100.0%) | 0 of 20 = **0.0%** (0.0%–16.1%) |
| Runs that ended right by a wrong route | **0** | **10** |

The dev set has no wrong-route runs in it at all, so the metric you tuned on was measuring something the held-out
set does not contain. The lie: **a prefix is not a sample.** The 40 runs here happen to be stored in three blocks
— twenty `ok`, then ten `wrong`, then ten `ok_but_wrong_path` — so an in-order split puts every pass in dev and
every failure in test. [2.4](../module-02/lesson-04.md) and [4.2](../module-04/lesson-02.md) are about this, and
nothing on the page tells you a run list is sorted by outcome.

**Average the two rates.** 75.0% and 50.0% average to 62.5%, and 62.5% describes no run, no tool call and no
user. It is the mean of two numbers computed on two different questions over the same 40 runs, and it cannot be
given an interval because there is no single proportion behind it. The lie: **an average of two scores is a score
on neither.** Publish the pair with its denominators, or pick one and say why.

## Fix it

1. **Score both ways, on the same runs, with the denominator in the label.** Two tiles — `end state 30/40` and
   `trajectory 20/40` — cost nothing extra here, because every verdict comes from fields the run record already
   carries. The rate that gates is written next to them; the other one is reported so a drop in either is visible.
2. **Keep `end_state` and `first_bad_step` as two fields and never collapse them.** The lab's export already does
   exactly this: `id`, `end_state`, `first_bad_step`, `score`. A record that stores only `passed: true` has thrown
   away the half of the information that tells you what to do next, and no amount of log retention gets it back.
3. **Draw the split; do not take a prefix.** A reproducible random draw is a line of code — `sampleItems(runs, 20,
   "random", 42)` — and it puts the wrong-route runs on both sides. Keep the seed in the config so the split is
   reviewable, and report what fraction of the rare class landed on each side.
4. **Write down what you protect, in the config, next to the gate.** One sentence, with the number in it:

   > We protect the side effects on the way to the answer, so the release gate reads trajectory scoring. End-state
   > scoring is reported on every run and does not gate. Below 60% trajectory on the held-out 20, the build is
   > blocked.

   That sentence is reviewable in six months. A gate with no sentence behind it gets re-argued every time the
   number moves, which is how 75.0% and 50.0% end up on the same slide arguing.

## How do I know it works?

**Challenge, on dev.** Draw 20 of the 40 at random with seed 42 — `sampleItems(runs, 20, "random", 42)` — and put
your gate on that half:

| Dev half (seed 42, n = 20) | Value |
| --- | --- |
| End-state pass | 15 of 20 = **75.0%** (53.1%–88.8%) |
| Trajectory pass | 10 of 20 = **50.0%** (29.9%–70.1%) |
| Wrong-route runs in this half | **5** of the 10 in the corpus |

Three requirements, all stated with numbers. First, both rates are published with `n`. Second, the gate names one
of them and the sentence above says why. Third — and this is the one that catches a bad draw — **the half you tune
on contains at least a few of the runs the other metric rejects.** Five is fine. Zero is not, and that is the
signature of the in-order split.

**Then one held-out validation**, on the other 20, read once:

| | Dev (seed 42, n = 20) | Held-out (n = 20) |
| --- | --- | --- |
| End-state pass | 15 of 20 (75.0%, 53.1%–88.8%) | 15 of 20 (75.0%, 53.1%–88.8%) |
| Trajectory pass | 10 of 20 (50.0%, 29.9%–70.1%) | 10 of 20 (50.0%, 29.9%–70.1%) |
| Wrong-route runs | 5 | 5 |

The 25-point gap survives the split intact, which is what you hoped for and not much more than you should hope
for. Note what each half costs you: **each half holds only 5 of the 10 wrong-route runs**, so the share of passes
that were wrong-route reads 5 of 15 on both sides, and with `n = 20` per half the intervals run from 53.1% to
88.8% — about 36 points wide. Two halves that agree that closely on 20 items each are not evidence that the
underlying rate is 75%; they are two noisy readings of the same 40 runs.

Be explicit about the seed's price, because [4.4](../module-04/lesson-04.md) applies here in agent clothes.
Across 1000 random 20-item draws from these 40 runs, the **dev-half end-state rate ranges from 50.0% to 95.0%**
(median 75.0%) and the **dev-half trajectory rate from 20.0% to 75.0%** (median 50.0%). So on a 20-item half you
can read the trajectory metric anywhere in a 55-point band depending on nothing but the draw. Every one of those
1000 halves did contain at least one wrong-route run (mean 4.98), which is why the random draw works where the
prefix does not — but the *level* you report still wobbles. What 40 runs can do is resolve a 25-point gap in this
corpus. What they cannot do is rank two agents that differ by less than that, and you should size the set for the
smaller difference you actually need to see.

## Use / don't use

**Do publish both rates on the same items, with `n`.** They answer different questions and both are one pass over
runs you already have. Two tiles cost nothing; one tile costs a ticket nobody can classify.

**Do choose the gate by what the agent can do, not by which number looks better.** An agent that reads and
summarises is protected by the end state. An agent that writes to a system, spends money, or fires a notification
is protected by the route. Writing that down is the deliverable; the number is the easy part.

**Do report the wrong-route count next to the pass rate.** It is the cheapest possible early warning, it is a
count and not an estimate, and a rising number on that tile means the agent is getting right for the wrong reason,
which is a different and usually more urgent problem than getting worse.

**Do pair the comparison.** Both scores exist on the same runs, so the discordant pairs are countable and the
interval on the difference is much narrower than the overlap of the marginals suggests. Ten one-directional
disagreements is a result; two is not.

**Don't quote end-state scoring as trajectory scoring, or average them.** 75.0% and 50.0% are not two estimates of
one quantity, and 62.5% is not a weaker version of the truth.

**Don't compare two agents on end-state alone if either of them can write.** You will rank them on the runs where
the route did not matter, which is the part of the population where you least need to be right.

**Don't validate on a tail.** The single most expensive mistake available on this page is free to make and takes
ten seconds: take the first 20 as dev and you get 100.0% and 100.0%, and a gate that has never seen the failure
it exists to catch.

What teams actually do: one nightly job that scores the frozen item set both ways and writes both numbers into the
same record; a release gate on the one they chose, with the sentence from *Fix it* in the config; a held-out split
drawn once with a seed in the repo and never regenerated; and a weekly read of the wrong-route count, because
that count moves first when an agent starts succeeding for the wrong reasons — which is the failure mode
[8.1](../module-08/lesson-01.md) found on the retrieval side of a RAG system and this module finds on the action
side of an agent.

## Reflect

1. Your agent has a 75.0% end-state pass rate on 40 runs and you now know a third of those passes were wrong
   route. Write the two sentences you would send the team that owns the top gap, and say which of the two numbers
   you would put in the release gate and why.
2. The end-state rate is 75.0% (59.8%–85.8%) and the trajectory rate is 50.0% (35.2%–64.8%). Someone points at
   the overlap and says the gap is not evidence. Write the reply that uses the pairing, and say what you would
   need to collect to say the same thing about a *different* agent rather than this one.
3. Run `a39` scaled a recipe 4→8 and then 8→4. Your agent's scaling tool appends to a shopping list rather than
   overwriting it. Which of the two metrics would have caught this, would either have caught it, and what would
   you add to the trace so that the next one is caught for free?

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Shunyu Yao et al., [τ-bench: A Benchmark for Tool-Agent-User
  Interaction in Real-World Domains](https://arxiv.org/abs/2406.12045) (2024) — scores an agent by comparing the
  final database state with an annotated goal state, which is end-state scoring made explicit, and reports how
  inconsistent the same agent is across repeats of the same task.
- Shunyu Yao et al., [ReAct: Synergizing Reasoning and Acting in Language
  Models](https://arxiv.org/abs/2210.03629) (2022) — the interleaved reason-and-act loop that makes the route a
  separate object from the answer, and the argument for reading the trajectory rather than only the final state.
- OpenTelemetry, [GenAI semantic conventions — agent
  spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) — the `agent` root span and its
  nested tool spans, which is the shape the 171 spans in this dataset follow and the format that makes a
  trajectory check computable at all.