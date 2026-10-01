---
id: "09.3"
module: 9
minutes: 15
practice_minutes: 40
prerequisites: ["09.1", "06.1", "04.3"]
objectives:
  - State, from a measurement rather than an assumption, whether a lab's agent runs contain any multi-turn interaction at all, and name the field that would tell you.
  - Compare a recorded user, a scripted persona and a simulated user on determinism, cost and error rate, and say what each does to the number the eval reports.
  - Design a hand-written transcript set with its strata and its label unit stated, and write the procedure that would let you adopt a user simulator only after measuring its agreement with those labels.
volatility: concept
sources:
  - title: "MINT: Evaluating LLMs in Multi-turn Interaction with Tools and Language Feedback (Miranda et al., 2023)"
    url: https://arxiv.org/abs/2309.10691
  - title: "τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains (Yao et al., 2024)"
    url: https://arxiv.org/abs/2406.12045
  - title: "OpenTelemetry GenAI semantic conventions — agent spans"
    url: https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/
last_verified: "2026-10-01"
---

# 09.3 · Multi-turn conversations and simulated users

This is the weakest-tooled lesson in the course and the one where an invented number would do the most damage,
so it is built as an argument with its measurement stated up front: **this lab contains no multi-turn
interaction at all**, and the way you know that is a count you can reproduce rather than a claim. What replaces the
missing measurement is a design budget — how big a hand-written transcript set has to be, and what you have to
validate before you let a model play the user.

## Why it matters

A team has an assistant. They eval it single-turn: one task string in, one answer out, and a clean number. They
ship the conversational version, because the product needs a conversation and the eval is already written.

The first week's tickets are all the same shape. *It forgot what I said three messages ago.* *I told it two onions
and then it bought four.* *I asked it to change the plan and it started over.* Nobody's metric moves, because a
single-turn metric cannot see turn 4 — there is no turn 4 in it.

So the team does the obvious next thing and adds a **user simulator**: a model that plays the customer. The score
comes back 30 points lower overnight. The dashboard is red, the sprint review is tense, and the team concludes the
agent regressed.

The agent did not regress. The *measurement* changed. A simulator is a model with its own opinions about what a
user wants, and those opinions are now inside the number the team is reading. Nobody measured the simulator's error
rate, so nobody can tell a real regression from a stricter user, and the instinct in a tense sprint review is to
roll back the agent.

That is the failure this lesson is about: **you swapped the instrument, and reported the change as a change in the
system.** The course's own discipline — [6.1](../module-06/lesson-01.md) and
[6.2](../module-06/lesson-02.md) — is that an instrument gets validated against labels before you read anything
through it. That rule has never been more load-bearing than here.

## How it works

### Why a conversation breaks the unit of evaluation

Every measurement in modules 1 to 8 assumes an **item** you can read on its own: a question, an answer, a label.
[2.2](../module-02/lesson-02.md) opens code by reading items, [2.3](../module-02/lesson-03.md) groups the notes,
[4.1](../module-04/lesson-01.md) turns the taxonomy into test cases. All of that needs the item to be self-contained.

A multi-turn agent breaks that assumption. Whether turn 4's reply is correct depends on turns 1 to 3, so:

- **You cannot shuffle items.** A turn-4 reply replayed against a turn-2 transcript is not the same measurement, so
  the resampling that [4.4](../module-04/lesson-04.md) depends on stops working at the turn level.
- **Failure is a property of the trajectory, not of a message.** "The agent forgot" is only visible by reading two
  messages together, which means it lands in the category where you already wanted a label and not in a per-message
  rubric.
- **The cost stops being one call per item.** A single-shot eval on 40 items is 40 agent runs. A two-turn set on 20
  conversations is 40 user turns and 40 agent runs, and each agent run now depends on state that has to be either
  replayed or simulated.

### Three ways to produce the user's side

| The user is… | Deterministic | Cost | What its errors do |
| --- | --- | --- | --- |
| A **recorded transcript**, replayed | yes | nothing to run; the writing was the cost | none, because the turns are ground truth |
| A **scripted persona** with a fixed next-message rule | yes | rule-writing per item | none at run time; the branches are the ones you imagined |
| A **simulated user** — a model | **no** | a model call per simulated turn | its own error rate, invisible in the agent's score |

The recorded transcript is the only one whose user side is a fact rather than an opinion. Its cost is paid once, in
the hours it takes to write real conversations, and that cost is exactly what makes it good: the turns are real,
including the boring parts, the corrections and the things a user says that are not on your checklist.

The simulator's price is that your eval now has two models in it, and only one of them is the thing under test. The
directions of its error are worth being concrete about:

- A simulator that is **agreeable** — vague, satisfied, quick to accept whatever it is offered — removes exactly
  the turns where real users push back, so the agent looks good and the eval has quietly stopped testing the hard
  case.
- A simulator that is **confidently specific** about what it wanted will mark correct answers wrong, so the agent
  looks bad and the team tunes against a user nobody has.
- A simulator that **changes its mind** for reasons of its own adds variance that has nothing to do with the agent,
  and [7.5](../module-07/lesson-05.md) is about what you do with repeats when the variance is real — which is the
  one tool you have here that a simulator genuinely provides.

None of those three shows up as a separate term in the pass rate. That is why a simulator's output is a **proposal
to review**, not ground truth: you keep the generated turn, you label the agent's reply against it by hand, and you
throw away or keep the turn based on whether a human recognises it as something a user would say.

### What this lab contains, as a count

Stated precisely, because everything else in this section is an argument and this is a measurement. Over all 40
runs:

| What you would look for | What the data says |
| --- | --- |
| Fields on a run record | `id`, `task`, `trace_id`, `end_state`, `first_bad_step`, `tools_expected`, `steps`, `spans` |
| Any turn or message field | **none** — there is no field a conversation would be stored in |
| `chat` spans per run | minimum **1**, maximum **1**, on every one of the 40 runs |
| User turns per run | **1** — the `task` string, which is the whole of the user's contribution |
| Agent turns per run | mean **2.27** (91 `execute_tool` steps over 40 runs) |

So: **0 of the 40 runs contain a second user turn**, and the *Calls per run* tile reads **1.0** for exactly that
reason. The trace viewer cannot show you a conversation because there is not one in the record to show.

Keep the last two rows apart, because the word *turn* does different work for each side. The dataset's `steps`
field is the **agent's** actions — tool calls it made. The user contributed one message per run. A mean of 2.27
agent steps per run is not a mean of 2.27 conversation turns, and an eval that reports "turns" without saying whose
turns has a denominator problem that no interval can repair.

### What I would build here, and how to price it

This part is a **design budget, not a measurement**, and it is arithmetic on the shipped runs used for sizing. The
40 tasks fall into **10 distinct tool signatures** — ten task families, from `search_recipe` alone to
`search_recipe → set_timer → scale_quantities` — and call **5 distinct tools**, with `search_recipe` in 37 runs,
`scale_quantities` in 17, `convert_units` in 11, and `set_timer` and `read_recipe` in 10 each. The thinnest tool is
in a quarter of the corpus; that is your stratification target, straight out of
[4.3](../module-04/lesson-03.md).

| If you hand-write | User turns | Agent steps, at the recorded mean of 2.27 |
| --- | --- | --- |
| 20 conversations × 2 turns | 40 | about **91** |
| 10 conversations × 2 turns | 20 | about **45** |

Read the first row again: **a 20-conversation two-turn set costs about the same number of agent steps as the 40
single-shot runs you already have.** Multi-turn is not expensive because turns are expensive; it is expensive
because *writing* the turns is, and because each one has to be labelled.

The defensible starting position is therefore the unglamorous one:

1. A small hand-written set of **real** transcripts, with the user's words kept verbatim, including the ones that
   correct the agent.
2. Strata from the ten task families and the five tools, so the set is not 20 variations on one search.
3. One label per **agent reply**, written by hand, before any automation is allowed near it.
4. A simulator, if you use one at all, **measured against those labels** first — TPR and TNR, the same procedure as
   [6.2](../module-06/lesson-02.md) — and generating new items rather than scoring existing ones.

## Show me

Open the preset and look at the shape of one run rather than at the tiles. Choose `a36` — *Double the garlic bread
and set a timer* — in the *Run* dropdown. The trace renders as:

```
agent  run: Double the garlic bread and set a timer     (root)
├── execute_tool   search_recipe(garlic bread)
├── execute_tool   scale_quantities(4→8)
├── execute_tool   set_timer(90 min)                    ← first bad step: 3 of 3
└── chat           final answer                         (model qwen3-1.7b)
```

Under the trace the page prints the run's `trace_id`, its end state and its first bad step — and that is the whole
record. One task string in, three tool calls, one `chat` span labelled *final answer*. There is no earlier message
from the user, there is no reply that the user might have found wrong, and there is no field in which either would
go. The *Calls per run* tile reads 1.0 for the same reason.

Switch to `Per-step partial credit` and the tile loses its interval, reads *per-step mean*, and `a36` scores
**0.00** — its three steps are right, right, wrong, and the metric credits only what came before the bad one. That is
[9.4](lesson-04.md)'s subject and it is the only per-run number on this page that is not a binary verdict.

The honest summary of this section: **the panel shows a single-turn agent eval, accurately and completely.** There
is no preset that adds a second user turn, because there is no second user turn in the data. The Export button
carries `id`, `end_state`, `first_bad_step` and `score` per run — a trajectory record, not a transcript.

> [!NOTE]
> > The 40 runs, their 171 spans and their task strings are **generated for teaching by an educational model**,
> > not captured from a real agent deployment. Every count above is computed for real in your browser from those
> > recorded runs. No rate in this lesson describes conversational quality, because the corpus contains no
> > conversations — and the design budget is arithmetic on these runs, presented as sizing, never as evidence.

## Try it

**Predict first**, on paper:

1. Your eval has 40 single-turn items and a clean pass rate. A user says *it forgot what I said three messages
   ago*. Name the field in your eval record that holds turn 3, or say plainly that there is not one.
2. You add a model as the simulated user and the pass rate falls from 80% to 50%. List the two hypotheses that
   this result is consistent with, and say what measurement separates them.
3. Decide the unit. If a conversation is the item, is the label on the conversation or on each agent reply, and
   what does the choice do to the denominator?

[Simulation: agent-evals](../../simulations/agent-evals/index.html?preset=steps)

1. **Prove the absence rather than assuming it.** In the *Run* dropdown, count the `chat` spans on ten runs. Every
   one has exactly one, and it is labelled *final answer*. Then open the export: four fields per run, none of them a
   message. Write the sentence you would put in a design document to justify a multi-turn eval set.
2. **Hand-write the turn that is missing.** Take five of the 40 tasks and write the follow-up user message the run
   does not contain — a correction, a change of mind, a narrowing of the request. Then write down what the agent
   would need in order to answer it correctly. Check each against the run record: `task`, `trace_id`, `end_state`,
   `first_bad_step`, `tools_expected`, `steps`, `spans`. Count how many of your five follow-ups the current record
   could support. That count is your instrumentation gap, and it is a real number.
3. **Stratify the 40 by tool signature.** Group the runs by `tools_expected` and you should find **10** families
   and **5** tools. Then find the thinnest tool — `set_timer` and `read_recipe` are each in 10 runs — and decide how
   many conversations your transcript set needs so that every tool appears at least twice. Write the number down
   before you start writing.
4. **Decide the label unit on paper.** Write the pass/fail rubric for (a) a single agent reply inside a
   conversation, and (b) the conversation as a whole. Then write the same rubric twice with its denominator spelled
   out, and decide which one you would rather have on a dashboard.
5. **Size it and cost it.** Twenty two-turn conversations is 40 user turns and about 91 agent steps at the recorded
   mean. Now write down how many of those 91 you could check with a free assertion from
   [9.2](lesson-02.md), and how many would need a human. That ratio is the argument for the hand-written set.

## Break it

**Generate 100 simulated users per item and average.** It sounds like rigor and it is the most common way to make a
conversational eval unfalsifiable. The lie is named: **an unvalidated simulator's score is being published as the
agent's score.** Its error rate is unmeasured, its direction is unknown, and its turns are the only thing standing
between the agent's reply and a pass. A hundred repeats per item narrow the *sampling* noise and do nothing about
the *instrument's* bias — which is the one error that averaging cannot remove. [7.5](../module-07/lesson-05.md)
is about repeats, and repeats only buy you something once the thing you are repeating is the right thing.

**Treat a recorded transcript as a test set you are allowed to tune on.** Ten real conversations, one per failure
mode, and the agent is tuned until it passes them. The lie: **the eval set's diversity is the diversity of the
transcripts somebody happened to write, and a tuned agent has read the script.** Playback is deterministic, which is
exactly why it feels safe and exactly why it stops measuring anything once the agent has seen it. Split by
*conversation*, hold the held-out transcripts out of every tuning session, and keep them long.

**Report the simulator's score against last week's single-turn score as a regression.** The measurement changed and
the system did not; the number went down, so the sprint review will believe the system changed. The lie: **two
numbers from two different instruments are not a time series.** Nothing on a dashboard can tell you which one moved,
which is the same gap [1.3](../module-01/lesson-03.md) is about, and the way out is the same: name the
instrumentation change in the config, on the same line as the metric, so the two numbers are never compared by
accident.

## Fix it

1. **Start with ten hand-written transcripts and label every agent reply by hand.** Real user words, kept verbatim,
   including the turn that corrects the agent. Ten conversations is two turns per one of the five tools. It is not a
   statistically meaningful set and it is not meant to be — it is a **labelled set**, and its job is to be the thing
   everything else is measured against.
2. **Declare the unit before you write the first item.** Per reply or per conversation, on the board, with the
   denominator. Per reply is the more debuggable choice and the one [9.4](lesson-04.md) wants, because a reply has a
   position in a trajectory and a label with a position routes to an owner.
3. **If you add a simulator, validate it before you read the agent through it.** Label the hand-written turns, run
   the simulator against those labels, and report TPR and TNR separately with their denominators. A simulator with
   poor TNR — it proposes turns that are not what users say — is a bad instrument and no agent score fixes it. Only
   then use it to *generate* items, never to grade them.
4. **Keep the simulator's turns in the record next to the labels.** When a run fails, the first question is whether
   the user turn was realistic, and you cannot answer it if the eval stored only the pass and the fail. This is the
   same rule as [8.1](../module-08/lesson-01.md)'s — store the retrieved context — in a different surface: an eval
   that logs the score and discards the transcript has thrown away the half that decides the ticket.

## How do I know it works?

**Challenge, on dev.** Because this corpus has no multi-turn items, the challenge here is a **count challenge, not
a rate challenge**, and pretending otherwise would be inventing the number this lesson exists not to invent.
Require all five of:

- **Ten hand-written two-turn transcripts.** 20 user turns, at least two turns exercising each of the five tools
  (`search_recipe`, `read_recipe`, `scale_quantities`, `convert_units`, `set_timer`) and at least one transcript
  from each of four of the ten task families.
- **Every agent reply labelled pass or fail by hand**, before any code or model runs over them. Twenty labels. That
  is an afternoon, and it is the entire asset.
- **The user's turns kept verbatim** in the same record as the reply, so a later reader can check whether the turn
  was realistic.
- **A stated label unit and denominator**, in the same place as the metric name.
- **A written decision on the simulator**, either "not used, because the cost of measuring it exceeds the cost of
  labelling twenty turns" or "used to generate items only, never to grade them". The sentence has to exist either
  way.

**Then one held-out validation.** Hold out 5 of the 10 transcripts — 10 user turns — and label them again from
scratch, without the first labels in view, the way [4.2](../module-04/lesson-02.md) asks. Report the agreement
between the two label sets on those 10 turns.

Now be precise about what that number is. **On 10 turns, agreement is a sanity check and not a measurement.** Ten
turns is a denominator so small that almost any rate you compute on it has an interval running most of the way
across the dial, and two label sets agreeing on all ten tells you your rubric is unambiguous rather than that it is
right. If you need a real number, the [4.4](../module-04/lesson-04.md) arithmetic is the one to do: decide the
smallest agreement difference you would act on, and size the labelled set from that — which is on a different
order of magnitude from ten, and is the honest price of conversational evals.

If you do adopt a simulator, the gate moves to the confusion matrix: on the 10 held-out user turns, report the
simulator's TPR and TNR against your hand labels with their denominators, and treat a simulator that cannot hold
TNR above your target as an instrument you are not allowed to generate items with. That is the same order of
events as everything else in this course: label, measure the instrument, then read the system through it.

## Use / don't use

**Do start with real transcripts, small, and keep the words the user actually used.** Ten conversations written
from support tickets will teach you more than a hundred generated ones, and they cost the same order of writing
time.

**Do label the agent's reply, per turn, and keep the transcript next to the label.** A conversational eval without
transcripts is an eval you cannot debug, and debugging is the entire point of having one.

**Do stratify by task family and by tool before you write anything.** This corpus has 10 task families and 5
tools, with the thinnest tool in 10 runs. A set of 20 conversations that exercises only `search_recipe` tells you
nothing about the other four.

**Do measure a simulator against your hand labels before you generate anything with it,** and report its TPR and
TNR separately from the agent's score. Until you do, a simulator's number is a proposal.

**Don't average 100 simulated users and call the result precise.** Repeats narrow sampling noise, not instrument
bias. [7.5](../module-07/lesson-05.md) again: five samples of the wrong question are still the wrong question.

**Don't compare a simulator's score to a single-turn score, in either direction.** Different instruments, and the
dashboard cannot tell you which moved.

**Don't let a simulator grade.** It may write the user; it does not write the label. A generated turn judged by the
same kind of model that played it is a closed loop with no reference to the world in it.

What teams actually do: hand-written transcripts as the labelled reference; a generator that expands the set along
named strata and proposes items for a human to accept or reject; per-reply labels stored with the transcript; a
simulator that is re-validated against the reference whenever its prompt changes, exactly like any other judge in
modules 6 and 7; and a dashboard that names the instrument next to the number, so the conversation when it moves
starts with "which one changed?" rather than "who broke it?".

## Reflect

1. Your eval has no multi-turn items and your product is a conversation. Write the design document paragraph that
   justifies a new set — what you measured in the current 40 runs, how many transcripts you will hand-write, and
   what each one has to contain to be worth the writing.
2. Your simulator drops the pass rate from 80% to 50% overnight. Write the two hypotheses, the one measurement that
   separates them, and the sentence you would say in the sprint review to prevent the rollback.
3. A hand-written transcript set of ten conversations is all the labelling budget you have. Two of your tools appear
   in only a quarter of the current corpus. Decide what your ten conversations must each contain, and write the
   reason a recorded script and a simulated user are not substitutes for each other.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Miranda et al., [MINT: Evaluating LLMs in Multi-turn Interaction with Tools and Language
  Feedback](https://arxiv.org/abs/2309.10691) (2023) — evaluation built around multi-turn interaction rather than
  single prompts, and the argument that the multi-turn setting changes what the measurement has to look at.
- Shunyu Yao et al., [τ-bench: A Benchmark for Tool-Agent-User
  Interaction in Real-World Domains](https://arxiv.org/abs/2406.12045) (2024) — the clearest published example of a
  simulated user: the user is a language model, the scoring compares final database state with an annotated goal,
  and the same agent is reported as inconsistent across repeats of one task.
- OpenTelemetry, [GenAI semantic conventions — agent
  spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) — the span shape a multi-turn
  record has to extend: the `chat` span per turn is what a transcript is made of, and this corpus has exactly one
  of them per run.