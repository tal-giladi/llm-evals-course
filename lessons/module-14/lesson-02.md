---
id: "14.2"
module: 14
minutes: 17
practice_minutes: 45
prerequisites: ["14.1", "10.3"]
objectives:
  - Tell a guardrail and an eval apart on the same production traffic, naming what each one costs, what it can see, and how long it takes.
  - Score the shipped post-check against the human labels on dev and report its false-block rate and its miss rate with their denominators.
  - Explain why a guardrail that has no threshold to tune is a wall, and say what you would need to add before putting one in the request path.
  - Answer the honest test — which of the two failures you would rather have — in writing, for one property of your own system.
volatility: implementation
sources:
  - title: "Your AI Product Needs Evals (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals/
  - title: "Semantic conventions for generative AI systems — OpenTelemetry"
    url: https://opentelemetry.io/docs/specs/semconv/gen-ai/
  - title: "MLflow Tracing for LLM and Agent Observability"
    url: https://mlflow.org/docs/latest/genai/tracing/
  - title: "AI Risk Management Framework — NIST"
    url: https://www.nist.gov/itl/ai-risk-management-framework
last_verified: "2026-10-01"
---

# 14.2 · Guardrails versus evals

Two things run in a production loop and both of them are called "checking the output", and they are not
the same kind of object. A guardrail is a cheap deterministic test in the request path that you can afford
on every request and cannot tune. An eval is a slower measurement, run on a sample, that you have decided
how to trust. This lesson puts both on the same 57 requests, scores each against the human labels, and
gives you the one question that decides which one you are building.

## Why it matters

A team wants to stop the model from answering when the handbook has nothing to say. They write a check:
if the retrieval span came back empty, block. It goes into the request path on a Tuesday.

On the first day it blocks **five requests out of fifty-seven**. The panel says `8.8% of traffic blocked`,
somebody reads that as a quality problem with the bot, and the fix is to make the check smarter. It is
made smarter for four months. The check is never wrong, and the check is never turned off, and after seven
months there is a number nobody can reproduce: no record of what property it tested, no count of what it
blocked, no way to ask when it last fired on something that was not a problem.

Meanwhile, on the same fifty-seven requests, a human says **twenty-seven of the answers are wrong**. The
check caught two of them. It is not a bad check. It is a check for a *category*, and the category is
`no_matching_section`, and a wrong fact is not in it.

The failure is not the block. Blocking is the correct behaviour for this property, and the three people
who got a refusal instead of a correct answer paid a real price for a design decision nobody wrote down.
The failure is that the team cannot answer two questions about their own production system: **which of the
two mistakes would you rather have made**, and **what was this measuring**. A guardrail without those two
answers is a wall, and walls are not a monitoring strategy — they are a decision to stop looking.

Both of those questions have answers, and they are answers you can compute. This lesson is the arithmetic
that produces them.

## How it works

### Two objects, and the table that separates them

The shipped support bot already contains both, which is why this lesson can be measured rather than
argued. In [`evallab/observe.py`](../../labs/common/evallab/observe.py), the **post-check** is a guardrail:

```python
        with tracer.span("citation check", "chain") as check:
            category = item.human[label_variant]["category"]
            if category == "no_citation":
                check.attributes[ERROR_TYPE] = "no_handbook_citation"
            elif category == "extra":
                check.attributes[ERROR_TYPE] = "unsupported_addition"
```

The comment the shipped source puts above it — *"3. The post-check. This is the span that turns a user
complaint into a line in a dashboard"* — is the entire job description of a guardrail, in the project's own
words.

A deterministic function of the answer, inside the request, with **no model call at all**. It writes one of
two named properties, and there is no threshold on either: `no_citation` is true or false and the check
fires. The retrieval span adds a third, `no_matching_section`, with the same shape.

The **recorded judge** is an eval: one model call per request it looks at, a rubric, and — this is the part
that makes it an eval rather than another check — a TPR and a TNR you measured against human labels in
[06.2](../module-06/lesson-02.md) and validated once on held-out data.

| | **Guardrail** | **Eval** |
|---|---|---|
| Where it runs | in the request path, before the user sees the answer | on a sample, after the answer shipped |
| Cost per request | zero model calls, microseconds | one model call, seconds |
| What it measures | one property you wrote down | a judgement, with a validated error rate |
| When it can be wrong | only in the direction of the property | in both directions, and the rate is known |
| Can you tune it | only in code, and only by changing what it checks | yes: the prompt, the repeats, the threshold |
| What it is for | not shipping a known-bad answer | finding out whether the system is still good |
| If it is wrong | a user is blocked or not blocked | a number on a panel is wrong, a user is fine |

The last row is the one teams get wrong. **A guardrail's error is felt by a person immediately; an eval's
error is felt by a dashboard later.** That asymmetry is the entire reason both exist, and it is why
"just add a check" is not a strategy — it trades a number you can get wrong for an outcome you cannot take
back.

### What each one can see, on the same 57 requests

Run the post-check and the recorded judge over the same 57 dev items and score both against the human
labels. The guardrail fires on **20 of 57 (35.1%, Wilson 24.0%–48.1%)**. The judge fails **23 of 57
(40.4%)**. The humans fail **27 of 57 (47.4%)**.

Those three numbers are close enough to be one number and are not one number. The cross-tab is the
lesson:

| | Human says fail | Human says pass | |
|---|---|---|---|
| **Guardrail fires** | **17** | **3** | 20 flagged |
| **Guardrail clear** | **10** | 27 | 37 clear |
| | 27 | 30 | 57 |

Two rates, and both are worth knowing:

- **False blocks: 3 of the 20 it flagged were answers a human marked correct.** Precision **17/20 =
  85.0%** (Wilson 64.0%–94.8%). Three people were refused an answer that was right. All three are the
  retrieval check, and the reason is structural: `retrieved == 0` fires, and there is no way to say
  *"retrieved nothing, and the model was going to be fine anyway"*.
- **Misses: 10 of the 27 real failures it did not flag.** Miss rate **10/27 = 37.0%** (Wilson
  21.5%–55.8%). And here is the important part — the ten are not random:

```
  human failures the guardrail did not flag, by category: {'wrong_fact': 7, 'over_refusal': 3}
  human passes the guardrail flagged, by category:      {'correct': 3}
```

Every single missed failure is a `wrong_fact` or an `over_refusal`. **The guardrail's blind spot is
exactly the set of properties nobody wrote a check for**, and that is not a tuning failure. A shape check
cannot detect a false statement; a refusal check cannot detect a refusal that was not warranted. You
either write a check for that property or you go and look, and "go and look" is what modules 1 and 2 were
for and what [14.4](lesson-04.md) is for.

So the guardrail's `35.1%` is not a noisy version of the true `47.4%`. **They are different quantities**,
and a panel that reports the first as "the failure rate" has changed what it is measuring without saying
so. The guardrail number is a *block rate*; the eval number is a *pass rate*. Only one of them estimates
the same thing the other one is estimating, and it is not the guardrail.

### The honest test

When somebody asks you to add a check to the request path, there is one question that settles it, and it
has nothing to do with statistics:

> **Could you explain, to someone who asks, which of the two failures you would rather have?**

The guardrail's two failures are **blocking an answer that was fine** and **letting a bad answer
through**. For `no_matching_section` the shipped answer is the first: blocking a correct answer costs one
annoyed user; letting a fabricated policy through costs a person who relies on it. That is a judgement
about your product, and it is the kind of judgement that belongs in a design review rather than in a
config file — which is precisely why it should be written down.

For `wrong_fact` the honest answer on this data is the second: the guardrail cannot see it at all, and
putting a check in the path would buy nothing. That is not a reason to give up on the property; it is an
instruction to go and find out how often it happens, which is what 14.1's sample and 14.4's loop are for.

**If you cannot answer that question, you are not ready to put the check in the path.** Not because the
check is bad, but because an untunable check with no stated preference is a wall.

### Why a guardrail without a threshold is a wall

Look at the post-check again. There is no threshold, no rate, no confidence — `category == "no_citation"`
is a fact about one answer. It cannot be made stricter, it cannot be made looser, and it cannot be made to
degrade gracefully when the model starts answering well. The only way to change its behaviour is to edit
that function and deploy.

Compare the eval, which has knobs that are *measurements* rather than code:

| | tunable | the number that says the knob is right |
|---|---|---|
| guardrail | only by changing the check and deploying | none — you cannot measure a boolean's rate without labels |
| eval | prompt, repeats, threshold | TPR and TNR against the human labels; false-alarm rate; half-width |

The structural reason the guardrail has no knob is the same reason [03.4](../module-03/lesson-04.md)
put checks and judges in different boxes: **a check that is wrong is wrong on one property, and you only
learn that by reading outputs.** The moment you want to trade a false block against a miss, you need a
rate for both, and rates need a sample and labels. That is an eval. The honest move when a guardrail
starts costing more than it is worth is to take the property **off** the path and **onto** the sample, not
to add a second guardrail next to it.

## Show me

From this repository, with no model and no API key. The judge is the shipped **educational model** — a
recorded judge replay, not a live LLM — and the human labels are the dataset's own.

The guardrail and the eval on the same 57 dev requests, with the cross-tab against the humans:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import RecordedJudge, load, record, wilson; d=load('support'); j=RecordedJudge(d,'c-rubric-3b'); items=d.items_for('dev')[:57]; tr=record(d,n=57,split='dev',seed=1); fl={t['trace_id'] for t in tr if any(s['attributes'].get('error.type') for s in t['spans'])}; h={i.id:i.human['v1']['label'] for i in items}; v={i.id:j.samples(i,'v1')[0] for i in items}; f=lambda k: str(wilson(k[0],k[1])); print('judge: c-rubric-3b'); print('guardrail fires on %d of 57  %s' % (len(fl),f((len(fl),57)))); print('eval fails on        %d of 57  %.1f%%' % (sum(1 for x in v.values() if x==0), sum(1 for x in v.values() if x==0)/57*100)); print('human fails on       %d of 57  %.1f%%' % (sum(1 for x in h.values() if x==0), sum(1 for x in h.values() if x==0)/57*100)); print('flagged and failing  ',sum(1 for i in items if 'tr_'+i.id in fl and h[i.id]==0)); print('flagged and passing  ',sum(1 for i in items if 'tr_'+i.id in fl and h[i.id]==1)); print('clear and failing    ',sum(1 for i in items if 'tr_'+i.id not in fl and h[i.id]==0)); print('clear and passing    ',sum(1 for i in items if 'tr_'+i.id not in fl and h[i.id]==1))"
```

```
judge: c-rubric-3b
guardrail fires on 20 of 57  35.1% (24.0%–48.1%)
eval fails on        23 of 57  40.4%
human fails on       27 of 57  47.4%
flagged and failing   17
flagged and passing   3
clear and failing     10
clear and passing     27
```

And the blind spot, named — every missed failure, by category:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from collections import Counter; from evallab import load, record; d=load('support'); items=d.items_for('dev')[:57]; tr=record(d,n=57,split='dev',seed=1); fl={t['trace_id'] for t in tr if any(s['attributes'].get('error.type') for s in t['spans'])}; print('missed failures :', dict(Counter(i.human['v1']['category'] for i in items if 'tr_'+i.id not in fl and i.human['v1']['label']==0))); print('false blocks    :', dict(Counter(i.human['v1']['category'] for i in items if 'tr_'+i.id in fl and i.human['v1']['label']==1)))"
```

```
missed failures : {'wrong_fact': 7, 'over_refusal': 3}
false blocks    : {'correct': 3}
```

`wrong_fact` and `over_refusal` are the two categories the post-check has no expression for, and all
three false blocks are the retrieval check firing on answers that were fine.

The tests, which assert the two halves of the shipped rule rather than the prose:

```console
$ py -m pytest tests/test_online.py -q
16 passed in 0.04s
```

> [!IMPORTANT]
> The **judge verdicts are the shipped educational model** — `RecordedJudge` replays a run recorded at build
> time for `c-rubric-3b` ("Llama 3.2 3B · Rubric · 0 shots"). It is not a live model, and the `40.4%`
> above is a property of a recording, not a measurement of any model in the wild. The **guardrail** costs
> nothing and is real code; the **human labels** are the dataset's own. Nothing on this page is priced in
> dollars, because nothing here is a bill: the cost argument in the table is in model calls per request,
> and the numbers to carry to your own system are the two denominators, not the three percentages.

## Try it

**Predict first**, on paper:

1. The post-check fires on 20 of 57 requests and 3 of those were answers a human marked correct. Predict
   what the block rate does to your support inbox, and say which number on the panel you would rename first.
2. You write a guardrail for `wrong_fact` by asking the model to check its own answer, once, in the
   request path. Predict the cost, the latency, and what happens to the block rate the week the model
   drifts. Then say whether that is a guardrail or an eval, and what the difference is in practice.
3. The eval at a 25% sample sees 16 of 57 requests and the guardrail sees all 57. Predict which one finds
   a rare-but-catastrophic failure first, and name the property that decides the answer.
4. A team argues the guardrail is a useless thing to have because it misses 10 of 27 real failures. Write
   the three-sentence reply that uses the 3-of-20 false blocks and does not appeal to anybody's taste.

[Lab: evallab package](../../labs/common/)

1. **Score the post-check yourself, with denominators.** Over the 57 dev items, count the traces the
   guardrail flags, the ones the humans call failures, and the cross-tab. Write out the two rates — false
   blocks over flags, misses over real failures — each with its denominator and a Wilson interval. Then
   say in one sentence why the guardrail's 35.1% is not a noisy version of the humans' 47.4%.
2. **Name the blind spot by category.** Break the ten missed failures down by `human.v1.category`, and do
   the same for the three false blocks. Then write the list of properties the shipped app actually checks,
   and the list of failure categories present in dev, and circle the difference. That circle is the
   work-list 14.4 starts from.
3. **Break the false blocks on purpose.** `out_of_scope` is 5 items in dev, and the retrieval check fires
   on all 5. Count how many of those 5 the humans marked correct, then edit the retrieval check to also
   require that the answer is long enough to be evasive, and re-count. Write down what you changed and
   whether you can now tune it without editing code — the answer is the point.
4. **Run the eval on the same items and diff the two.** Use `RecordedJudge(d, "c-rubric-3b")` on the same
   57, find the items where the judge fails and the guardrail is clear, and the reverse. Write the
   sentence that says which list you would put in front of a human reviewer first, and why the other list
   is not a waste of anybody's time either.
5. **Write the honest test for one of your own properties.** Pick one property, answer the two-failure
   question in writing, and then say what you would need in order to *change* your answer later — which is
   the test of whether it is a threshold or a wall.

## Break it

**Call the guardrail's block rate the failure rate.** `20 of 57 = 35.1%` on a panel labelled "failure rate",
next to a human failure rate of 47.4%. The lie: **two different quantities with similar shapes get read as
one number**, and the shape similarity is exactly what hides the substitution. A guardrail counts a
property; an eval judges an answer; only one of them estimates the other's quantity.

**Add a guardrail for a property you cannot check by shape.** Ask the model to verify its own answer inside
the request path. The lie: **a check that needs a model call is not free, and a check that is only
sometimes right is a guardrail whose false-block rate you have never measured** — you have moved the
mistake from a known number to an unknown one and put it in front of a user.

**Make the guardrail tunable and keep the old behaviour.** "Only block when the model is also confident"
is untunable because confidence is not on the span. The lie: **a threshold you cannot measure the false
rate of is a knob with a number painted on it**, and it will be set once, by whoever was on call, and never
revised.

**Keep the check that costs three good answers a day.** 3 of 20 flagged were correct. The lie: **a guardrail
is measured by the errors it prevents and not by the ones it causes**, so it never gets reviewed, and the
cost accrues to users the team cannot see.

**Only run the eval, and call the block a bug.** Blocked requests are excluded from the sampled set, so
the pass rate is computed on the requests that were allowed through. The lie: **excluding the blocked
population is the same mistake as excluding the failures from the sample**, one level up: a rate over the
requests you allowed is not a rate over the requests you served.

## Fix it

1. **Name the property, the direction, and the preference.** Every guardrail ships with three lines: *this
   checks `X`; it errs toward blocking because of `Y`; the false-block rate is `Z`, measured on `n`
   items.* The shipped post-check has only the first, which is why its three false blocks are a surprise
   rather than a known quantity.
2. **Put a rate on the guardrail.** False blocks over flags, misses over real failures, both with a
   denominator. `17/20` and `10/27` on dev, with the interval, is what turns a boolean into something a
   design review can argue about.
3. **Move a property off the path when the cost is wrong.** The fix for a guardrail that blocks too often is
   not a second guardrail; it is to take it out of the request path and put it on the [14.1](lesson-01.md)
   sample, where you can afford to measure it properly.
4. **Report the two rates on separate lines, with different names.** `block rate` for the guardrail,
   `pass rate` for the eval. They are not the same number and they do not estimate each other.
5. **Count what the guardrail cannot see, every window.** The `wrong_fact` and `over_refusal` rows are the
   work-list; leaving them on a panel as an explicit "not monitored" line is better than a panel that
   looks complete.
6. **Run the eval on a sample, not on the whole stream.** 16 judge calls at 25% on 57 requests against 57
   for the guardrail's free boolean, and the eval is the one that can tell you whether the system is still
   good. The saving is the point; the reason you can save it is that the guardrail already covered the
   cheap properties.

## How do I know it works?

**Challenge, on dev.** The 57 dev requests, and five checks before any of this goes in the request path:

- **You can answer the honest test out loud for every property on the list.** One sentence each: which of
  the two failures you would rather have, and why for *this* product. A property you cannot answer for is
  a property you have not evaluated, whatever the code says.
- **The guardrail's two rates are computed and written down.** `17/20` false blocks on dev, `10/27` misses,
  each with its denominator and its interval. A guardrail whose rates nobody has computed is a boolean in
  a request path.
- **The miss list is a taxonomy, not a number.** Ten misses, split `wrong_fact` 7 / `over_refusal` 3, and
  both categories have an owner. The point is not that ten is a good number; it is that the misses have
  *names*, which is what makes them a work-list rather than a complaint.
- **The two rates are labelled differently on the panel** and neither is called "the failure rate" without
  a property attached.
- **You have watched the guardrail block something good.** Three times on 57. A guardrail nobody has seen
  misfire is a guardrail nobody knows the cost of.

**Then one held-out validation**, on the 37 test items the guardrail was never scored against:

| | dev, 57 | held-out, 37 |
|---|---|---|
| Guardrail fires | 20 (35.1%, 24.0%–48.1%) | 14 (37.8%, 24.1%–53.9%) |
| Eval fails | 23 (40.4%) | 21 (56.8%) |
| Human fails | 27 (47.4%) | 20 (54.1%) |
| Flagged and failing | 17 | 12 |
| **Flagged and passing** | **3** | **2** |
| Precision | 85.0% (64.0%–94.8%) | 85.7% (60.1%–96.0%) |
| **Clear and failing** | **10** | **8** |
| Miss rate | 37.0% (21.5%–55.8%) | 40.0% (21.9%–61.3%) |
| Missed categories | `wrong_fact` 7, `over_refusal` 3 | `wrong_fact` 5, `over_refusal` 3 |

The two rows to read are the **precision** and the **miss rate**, and both hold their level across the
split: `85.0%` and `85.7%` on the flagged side, `37.0%` and `40.0%` on the missed side, on intervals that
overlap comfortably. The guardrail is not mis-tuned on the held-out half; it is doing the same thing it
was doing on dev, and the same thing it was always going to do. And the **missed categories are identical
in kind** — `wrong_fact` and `over_refusal` on both splits, never `no_citation`, never `out_of_scope` —
which is the check that matters. **A blind spot is a property of the check, not of the sample**, so it
transfers to a split you never scored, and it will transfer to production too.

The eval's own numbers moving (`40.4%` to `56.8%`) is lesson [10.3](../module-10/lesson-03.md)'s lesson
in a new place: a pass rate on 37 items and a pass rate on 57 items are two measurements of two different
populations. Do not read the gap as a regression without the intervals on both sides, and do not read the
guardrail's stability as evidence that the system is stable. The guardrail is stable because it is
checking something that did not move.

## Use / don't use

**Do use a guardrail for properties that are cheap, mechanical, and have an obvious safe default.** No
citation, empty retrieval, a disallowed topic, a PII pattern. The check is a boolean on the output, the
direction of the error is agreed, and a wrong block costs one user one turn.

**Do use an eval for anything you intend to call a number.** Helpfulness, faithfulness to a rubric, "did
it actually answer the question". These need a rate, and a rate needs a sample and labels, and the sample
is [14.1](lesson-01.md)'s sample and the labels are [06.1](../module-06/lesson-01.md)'s labels.

**Do answer the honest test before writing the check into the path, and write the answer down.** Which
failure you would rather have is a product judgement, and it is the one thing a code review cannot infer
from the code.

**Do report the guardrail's two rates and the eval's rate as three different numbers.** `block rate`,
`false-block rate`, `pass rate`. They are not versions of each other and a dashboard that has to choose one
label for all three has already lost information.

**Do keep an explicit "not monitored" list.** `wrong_fact` and `over_refusal` on this system. A panel that
shows only what you can see is indistinguishable from a panel where everything is fine.

**Don't put a model call inside a guardrail and call it cheap.** One extra model call per request is a
dollars-per-request line item, and its false-block rate is unmeasured until somebody measures it.

**Don't exclude blocked requests from the eval's sample without saying so.** That is [14.1](lesson-01.md)'s
failure one level up: a rate over the requests you allowed is not a rate over the requests you served.

**Don't argue the guardrail is useless because it misses failures.** On this data it caught 17 of 27 and
blocked three good answers. That is a good trade for `no_citation`, and a bad argument against a good
tool — the fix is to name the other properties, not to remove the one that works.

What teams actually do: a short list of named guardrails, each with a written direction of error and a
measured false-block rate, and everything else on a sampled eval with a judge whose TPR and TNR they
published. The guardrails are cheap enough to be boring — a boolean and an error attribute — and the eval
is the only one of the two that can tell you the system got worse. The discipline is not the technology;
it is that each of the two carries a **different name on the panel**, so nobody has to guess which one
they are reading.

## Reflect

1. The post-check blocks 20 of 57 requests and 3 of those answers were correct. Write the two lines you
   would put in the pull request that adds it, and say what number you would refuse to ship without.
2. Somebody wants the `wrong_fact` property in the request path. Write the reply, in three sentences, that
   takes the property off the path and onto the sample, and says what you will do with the 7 dev failures
   it cannot see.
3. Your panel shows one number called "failure rate" and it is currently the guardrail's block rate. Write
   the three field names you would replace it with, and the sentence that goes in the dashboard footer
   explaining which of the three is the one you would alert on.
4. `unsupported_addition` is a property the post-check declares and this dev split never exercises. Write
   down what you would need in order to say whether that property is worth having, and what a property
   nobody has ever seen fire on looks like six months later.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- Hamel Husain, [Your AI Product Needs Evals](https://hamel.dev/blog/posts/evals/) — the separation this
  lesson is about: a check that runs in the path and a measurement that runs on a sample are different
  instruments with different costs, and conflating them is how a system ends up with checks that block
  users and no numbers anyone trusts.
- OpenTelemetry, [Semantic conventions for generative AI
  systems](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — where `error.type` on a span comes from,
  which is the mechanism both the guardrail and this module's regression loop use to say that a request
  went wrong, and the Development status that means the attribute list can still move underneath you.
- MLflow, [Tracing (Observability)](https://mlflow.org/docs/latest/genai/tracing/) — the production
  substrate, and the reason a guardrail is a span attribute rather than a dashboard query: it has to be
  recorded at the moment it fires, while the answer that caused it is still in hand.
- NIST, [AI Risk Management
  Framework](https://www.nist.gov/itl/ai-risk-management-framework) — the measure/manage vocabulary this
  lesson borrows, and the reason the two instruments get separate names: a control that operates in the
  path and a measurement that operates over time are different artefacts with different owners.
