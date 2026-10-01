---
id: "14.1"
module: 14
minutes: 18
practice_minutes: 45
prerequisites: ["12.5", "07.5"]
objectives:
  - State the rule for which production requests a sampled judge looks at, and say why "we sample 25%" is not a rule.
  - Run the shipped sampler at four rates over the same 57 dev requests and read the failure count and the failure rate separately.
  - Explain why the sampling decision is hashed from the request id rather than drawn per request, and name the question a coin flip cannot answer.
  - Say which number on a production panel is a rate over traffic and which is a rate over a selected set, and put the sample rate beside the right one.
volatility: implementation
sources:
  - title: "Sampling — OpenTelemetry"
    url: https://opentelemetry.io/docs/concepts/sampling/
  - title: "MLflow Tracing for LLM and Agent Observability"
    url: https://mlflow.org/docs/latest/genai/tracing/
  - title: "The Design and Analysis of Experiments (Dean & Voss, 1998)"
    url: https://link.springer.com/book/10.1007/978-1-4757-5482-1
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 14.1 · Sampling production traces

A judge on every production request is a model call on every production request, and production is the only
place the volume is unbounded. So you sample — and the moment you do, the design question stops being "how
much can we afford" and becomes "which requests does the sample represent". This lesson writes that rule
down, shows the number it produces on the same 57 requests at four different rates, and names the two
numbers on the panel that are not estimates of each other.

## Why it matters

A team ships an online judge. It runs on 25% of traffic, because 25% is what the bill allowed, and the
dashboard has one number on it: the failure rate. It reads **8.3%**, week after week, and nobody changes
anything.

The true failure rate that quarter is **8.8%** — five failures in fifty-seven requests. Those two numbers
are close, and that is the trap: the dashboard is not obviously wrong. What has actually happened is that
the sample, at 25%, caught **one of the five failures** and threw the other four away permanently. The
number is right by accident. Four of the five real failures were never read by a human and never became a
test case, and the reason the panel looks calm is precisely the reason it is empty.

This is the worst property a monitor can have. A monitor that is broken loudly gets fixed. A monitor that
is broken *toward stability* teaches the team that production is fine, and it will keep teaching them that
on a day when it is not fine, because the same sampling rule will quietly remove the evidence then too.

And there is a second, quieter version of the same failure that the honest sampler also produces, so it
is worth naming both in the first section. Swap in the correct rule — keep the volume down, keep the
failures — and the panel now reads **31.2%** on the same traffic that was at 8.8% four minutes earlier.
Nobody broke anything. The denominator moved. A team that sees their error rate triple because they turned
sampling down has learned the wrong lesson about their own product, and the lesson they learn is "turn
sampling back up", which is the one change that makes the monitor worse.

Both numbers are true. Neither one is what a reader assumes it is. This lesson is the two sentences that
tell them apart.

## How it works

### The trace sample and the judge sample are two different decisions

[Lesson 12.5](../module-12/lesson-05.md) introduced a sampler, and its reason was storage: a trace is a
copy of a conversation, and copies cost money to keep. The decision there was *which traces to keep*. This
lesson's decision is *which traces to judge*, and the two are not the same decision, because they are
paid for in different currencies:

| | What you pay for | What a sample costs you when you get it wrong |
|---|---|---|
| **Trace sample** — which requests to store | bytes, and a retention policy | a debugging session with nothing to look at |
| **Judge sample** — which requests to measure | a model call, on every sampled request | a pass rate over a population you cannot name |

A 10% trace sample is usually fine and a 10% judge sample is usually a decision about your budget. The
point of writing them as two rules is that the first one is allowed to be cheap, and the second one is not
allowed to be *biased* — and the way a judge sample goes biased is the thing this lesson is about.

The shipped bot makes both decisions in one place, [`evallab/observe.py`](../../labs/common/evallab/observe.py),
in the loop that decides what to keep:

```python
        keep = fail_on is not None or should_sample(sample_rate, f"tr_{item.id}")
        if not keep:
            continue
```

The comment the shipped source puts immediately above them is the sentence this lesson is built on:
*"Sampling is for volume, never for failures. Decide what will fail **before** sampling, or a 25% sample
silently deletes the errors and the error rate is computed over the requests that worked — the same
mistake as dropping spans on an exception, one level up."*

Read the order, because it is the whole lesson. The outcome is decided **before** the sample, so a request
known to have failed is kept at any rate, including zero. Swap the two and the 25% sample silently
deletes the errors, the rate is computed over the requests that worked, and the panel goes green.

### Hash the request id, not a coin

`should_sample(rate, key)` in [`evallab/tracing.py`](../../labs/common/evallab/tracing.py) is
`(hash_seed(key) % 10_000) < rate * 10_000`, and the key is the request id. Same request, same decision,
for ever — which is what makes the phrase *"we sample 25%"* mean **the same 25%** rather than a fresh
draw each time.

A coin flip per request is not a smaller version of this. It produces a set with the same expected
composition and one fatal property: **you cannot tell a request that was dropped from a request that was
never made.** Nobody can answer "where is the trace for that complaint from Tuesday?" — not you, not the
on-call engineer, not anyone reading the dashboard after the fact. With a hash, the kept set is a pure
function of the request ids, so the drop list is computable: the requests you did not judge are the ones
whose hash fell outside the band, and you can name them.

That property is what lets the bias be a *decision* instead of an accident. "Drop the volume, never the
failures" is a rule you can state, audit, and hand to the next person. "We keep a random sample and the
errors usually come through" is not a rule, and the word *usually* is where the 8.3% above came from.

### The shipped form: `sample_for_review`

[`evallab/online.py`](../../labs/common/evallab/online.py) carries the rule in the form you would
actually call, and the two functions are worth telling apart because they differ in exactly one
decision:

```python
def sample_queries(queries, rate: float, seed_key: str = "q") -> list:
    """Keep a deterministic share of requests. ..."""
    return [q for q in queries if should_sample(rate, f"{seed_key}:{q}")]


def sample_for_review(queries, rate: float, errors_first: bool = True) -> list:
    """Keep a share of traffic, plus every request that already failed. ..."""
    kept = []
    for q in queries:
        failed = bool(errors_first and q.get("error")) if isinstance(q, dict) else False
        if failed or should_sample(rate, f"q:{q.get('id') if isinstance(q, dict) else q}"):
            kept.append(q)
    return kept
```

`sample_queries` is the volume half on its own — deterministic, unbiased with respect to anything you did
not put in the key, and useless on its own for a monitor. `sample_for_review` is the whole rule: **a
request that already failed is kept whatever the rate says.** And the test for it is the strictest one in
this module, because it takes the rate to zero:

```python
def test_sample_for_review_keeps_every_failure():
    qs = [{"id": f"q{i}", "error": i % 10 == 0} for i in range(200)]
    kept = sample_for_review(qs, 0.0)
    assert all(q["error"] for q in kept), "a zero sample rate must still keep the failures"
    assert len(kept) == 20
```

Twenty queries, one in ten flagged, **sample rate 0.0**, and twenty kept. A rule that can be tested at
its limit is a rule; "keep the errors" as an intention is not, because the case where it matters is
precisely the case where the sample is small and the failures are rare.

### The two numbers, and why the rate rises

Now the same 57 dev requests, a planted 10% model-call failure rate, `seed=1`, at four sample rates — the
correct rule on the right, and the naive "just hash every request" sampler on the left, which is what you
get by deleting one clause from the loop above:

```
rate    naive: traces  errors  rate  |  keep-rule: traces  errors  rate
 100%           57        5       8.8%         57        5       8.8%
  50%           27        3      11.1%         29        5      17.2%
  25%           12        1       8.3%         16        5      31.2%
   5%            4        0       0.0%          9        5      55.6%
```

Read each column, never the row.

**The naive column, 25% row.** Twelve traces, one failure, `8.3%`. Against the true `5/57 = 8.8%`, that
looks like a *good* number — the dashboard is right to one decimal place and four fifths of the evidence
is gone. The failures it kept are `tr_s10`; the ones it dropped are `tr_s02`, `tr_s31`, `tr_s51`,
`tr_s82`, and no panel, no query, and no future run will ever produce them, because the same ids will fail
the same hash every time. This is the 8.3% from the first section, computed. **The naive column at 5%** is
the pure version of the failure: four traces, zero failures, `0.0%` — a monitor that has never been
capable of reporting a problem.

**The keep-rule column.** The numerator is **5 at every row**. That is the rule holding, and it is the
only number in the table that is a property of the system rather than of the sampler. The denominator is
the part that moves, and the rate rises because the kept set is no longer a random draw from the traffic:
it is a random draw **plus every failure in the window**, which is a set chosen partly for the thing you
are trying to measure.

So the honest statement takes two sentences, and this is the same pair [12.5](../module-12/lesson-05.md)
arrived at for a different sampler. `5/57 = 8.8%` estimates the failure rate of the traffic. `5/9 = 55.6%` is a count
over a set that was **selected** because it contains the failures. Neither is an estimate of the other,
and no interval closes the gap, because the gap is not noise — it is the selection.

The bill for keeping the failures is that your headline rate is now computed over a set whose membership
depends on the outcome. The way to pay it is to stop calling it a rate of production traffic:

| Number | What it is | How to label it |
|---|---|---|
| failing requests in the window / all requests in the window | an estimate of the production failure rate, thinned by sampling | **the metric** — `5/57 = 8.8%` |
| failing requests kept / traces kept | a count over a set selected for its failures | **the work queue** — `5 of 9` |

Both are worth a panel. They are not interchangeable, and the second one is not a number to put a trend
line on.

## Show me

Everything below is the shipped code in this repository, with no model, no network and no API key. The
requests are the 57 dev items; the failures are planted at a known 10% so there is something to find.

The sampling rule, across the three rates, with the numerator and the denominator printed as they are:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load, record, TraceStore; d=load('support'); [print('  rate %4.0f%% -> %3d traces, chat errors %d (%.1f%%)' % (r*100, len(g), c['errors'], c['rate']*100)) for r in (1.0,0.25,0.05) for g in [record(d,n=57,split='dev',fail_rate=0.10,sample_rate=r,seed=1)] for c in [TraceStore.from_traces(g).error_rate()['chat']]]"
```

```
  rate  100% ->  57 traces, chat errors 5 (8.8%)
  rate   25% ->  16 traces, chat errors 5 (31.2%)
  rate    5% ->   9 traces, chat errors 5 (55.6%)
```

`5` three times, `57 / 16 / 9` three times. That is the lesson as a single output line.

The two functions side by side, on 200 synthetic requests:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import sample_queries, sample_for_review; qs=[{'id':'q%d'%i} for i in range(200)]; a=sample_queries(qs,0.25); b=sample_queries(qs,0.25); print(len(a),'of 200 kept at 0.25; identical every call:',[q['id'] for q in a]==[q['id'] for q in b]); qr=[{'id':'q%d'%i,'error':i%10==0} for i in range(200)]; k=sample_for_review(qr,0.0); print(len(k),'kept at a 0.0 sample rate, and every one is a failure:',all(q['error'] for q in k))"
```

```
59 of 200 kept at 0.25; identical every call: True
20 kept at a 0.0 sample rate, and every one is a failure: True
```

`59 of 200` is 29.5% against a requested 25%, which is the sample you get on 200 requests and not a bug:
the hash is a fixed decision per id, not a quota, and the realised share on any small window is a draw.
`True` on the second line is the point of hashing — the same 59 ids, every call, for ever. And the last
line is the rule at its limit: **a 0.0 sample rate still returns 20 requests, because all 20 of them
failed.**

The tests, which are the executable statement of the rule:

```console
$ py -m pytest tests/test_online.py -q
16 passed in 0.04s
```

`test_sampling_keeps_the_failures_and_drops_the_rest` asserts all three halves at once — the error counts
are `[5, 5, 5]`, the trace counts fall monotonically, and the 100% run is strictly larger than the 5% one.
`test_sample_queries_is_deterministic` compares two independent 200-element draws and asserts they are the
same list. `test_sample_for_review_keeps_every_failure` is the one quoted above.

> [!IMPORTANT]
> The **failure rate is planted**, not observed: `record(..., fail_rate=0.10)` decides which requests will
> raise before it samples anything, using the same hash the sampler uses. The five failing traces are
> `tr_s02`, `tr_s10`, `tr_s31`, `tr_s51` and `tr_s82`, and they are the same five at every sample rate.
> The **model** is this repository's shipped educational model — a recorded judge and a recorded answer,
> not a live LLM — so no judge call is priced anywhere on this page; the budget argument is made in **call
> counts** (57 model calls at 100%, 16 at 25%) and the dollars are whatever your price sheet says. Every
> number above is arithmetic over the shipped code and the shipped items.

## Try it

**Predict first**, on paper, before you run anything:

1. You change the sample rate from 25% to 5% on the same window. The error **count** is 5 at both. Predict
   the error **rate** at each, and say in one sentence why the second is not an estimate of the first.
2. You delete `fail_on is not None or` from the keep rule in `record()`, so failures are sampled like
   everything else. Predict how many of the five failures survive at 25% and at 5%, and predict what the
   dashboard reports at 25% — including whether the number looks wrong.
3. You replace the hashed sampler with `random.random() < rate`, seeded once so the run is repeatable.
   Predict whether the realised share stays near the requested rate, and name the question about a
   specific request that the new sampler cannot answer.
4. `sample_for_review(qs, 0.25)` returns 67 of 200 requests, and only 20 of them are failures. Predict
   how many *non-failure* requests a 5% judge would have to see to find the same five, and say which
   number a budget should be written in.

[Lab: evallab package](../../labs/common/)

1. **Run the sweep and write both numbers down.** The `Show me` command over `n=57, split='dev',
   fail_rate=0.10`, at `1.0 / 0.25 / 0.05`. For each rate write a row with `traces`, `errors`, `rate`, and
   a fourth column headed *errors that would have been found by judging all 57*. Then write the one
   sentence you would put on the panel to stop a reader treating the 55.6% as a regression.
2. **Build the naive sampler and watch the number look right.** In a scratch file, sample the 57 dev items
   at `0.5 / 0.25 / 0.05` using `should_sample(rate, f"tr_{item.id}")` alone, and count how many of
   `tr_s02, tr_s10, tr_s31, tr_s51, tr_s82` survive each time. Put that beside the table above. Then say,
   in one sentence, why `8.3%` is a *more* dangerous number than `0.0%` even though the 0.0% is the worse
   sampler.
3. **Test the rule at its limit.** `sample_for_review(qs, 0.0)` on 200 requests with one in ten flagged, and
   then with one in three, and then with none. Write down what each call returns and say which of the
   three results is the one that would surprise a reader of the function's docstring.
4. **Check determinism the hard way.** Call `sample_queries` at 0.05, 0.25 and 0.5 over the same 200 ids
   and check the three kept sets are nested — every id kept at 5% is also kept at 25% and at 50%. Then
   delete the `f"{seed_key}:{q}"` prefix and use the raw id, re-run, and write down the two numbers that
   move. That nesting is the property a per-request coin flip destroys.
5. **Write the two panel rows.** Produce the exact JSON you would store per window: `failing_requests`,
   `requests_total`, `traces_kept`, `failing_kept`, `sample_rate`, and one derived field that keeps the
   two rates from being read as the same number. Then write the sentence that goes in the dashboard
   footer, and check it against the 25% row of the table above.

## Break it

**Sample the failures with everything else.** The obvious implementation hashes every request and samples
it, because the rule "25% of requests" reads cleanly. On this window it keeps **1 of 5** failures at 25% and
**0 of 5** at 5%, and reports `8.3%` and `0.0%`. The lie: **a sampled stream that quietly excludes the
failures is a stream with no signal in it**, and it looks *stable*, which is the one property you must never
buy.

**Report the rate over the sample as the production failure rate.** The correct rule, reported carelessly:
`5/9 = 55.6%` on a dashboard labelled "failure rate", against `8.8%` on the same traffic an hour earlier. The
lie: **a rate over a set selected for its failures looks exactly like a rate until you change the sampling**
— the same trap lesson 12.5 found, one level up, and the fix is the same: print the sample rate next to
every number computed over the sample.

**Coin-flip the sample.** Same expected share, no membership rule. The lie: **a sample you cannot
reproduce is not a sample, it is an anecdote** — you cannot compute a rate over a set whose membership you
cannot name, and you cannot find the trace for a request a customer complained about.

**Thin the rare-but-serious slice with the rest.** A sample rate chosen for total volume is applied to every
intent equally, so the `exception` slice — a handful of requests a day — is sampled down to nothing. The
lie: **one rate over a mixture of things with different rates of occurrence is a rate that only describes
the common case.** The exception is where the wrong answers cost the most and it is the first thing the
sample deletes.

**Re-draw the sample every window.** A fresh random draw per day makes every dip and every spike a
different set of requests, so the trend line is measuring the sampler. The lie: **a monitor whose
comparison baseline changes every run cannot distinguish a regression from a redraw**, and the team's
correct response to that is to stop reading it.

## Fix it

1. **Write the rule as one sentence and put it in the exporter's docstring.** *Decide the outcome before you
   sample; a request that failed is kept at any rate.* `sample_for_review` is that sentence in code, and
   `record()` implements it one level down.
2. **Hash the request id, never a coin.** `should_sample(rate, f"tr_{item.id}")` makes "we sample 25%" name
   the same requests every day, which is what makes the drop list computable and the trend line
   meaningful.
3. **Test the rule at its limit.** `sample_for_review(qs, 0.0)` must still return every failure, and the test
   asserts it. A rule only exercised at a comfortable sample rate is a rule that has never been tested.
4. **Print both numbers, and never the second one alone.** `failing_kept / traces_kept` is the work queue;
   `failing_total / requests_total` is the rate. A panel that carries the first without the second is a
   panel that has silently redefined its headline.
5. **Carry the sample rate on every number computed over the sample**, next to the number. If the rate
   changes, everything downstream of it changes too, and a reader who cannot see the rate cannot see that.
6. **Keep the raw kept-set next to the metric**, so "which requests did we judge this window" is a query
   rather than a re-derivation from a seed nobody wrote down.

## How do I know it works?

**Challenge, on dev.** The 57 dev requests, planted 10% failure rate, `seed=1`. Six checks before this
sample goes near production:

- **The failure count is identical at every rate.** `5, 5, 5` at 100%, 25% and 5%. If the count moves, the
  sampler is taking failures and the fix is the keep rule, not a higher rate.
- **The kept-set really is smaller.** `57 / 16 / 9` traces, monotonically falling. A sampler that keeps
  everything passes the first check and measures nothing.
- **The naive comparison is in your notes, not just in your head.** At 25% the naive sampler keeps `1` of the
  five failures and reports `8.3%`; at 5% it keeps `0` and reports `0.0%`. You should be able to produce
  that table without running it, because the day somebody proposes deleting the keep clause you will have
  about thirty seconds to make the case.
- **The sample is reproducible.** `sample_queries` at 0.25 over 200 ids returns the same 59 ids on two
  independent calls, and the 5% set is nested inside the 25% set inside the 50% set.
- **The two numbers are labelled differently on the panel**, and you have read the 31.2% row without
  experiencing the urge to file a ticket.
- **The realised share is checked against the requested share.** `59 of 200` at a requested 25% is a draw,
  not a bug; if it were `12 of 200` you would be reading a broken hash, not a sample.

**Then one held-out validation**, on the split you did not sample against — the **37 test items**, same
planted rate, same seed, same sweep:

```
  dev  rate  100% ->  57 traces, chat errors 5 (8.8%)
  dev  rate   25% ->  16 traces, chat errors 5 (31.2%)
  dev  rate    5% ->   9 traces, chat errors 5 (55.6%)
 test rate  100% ->  37 traces, chat errors 3 (8.1%)
 test  rate   25% ->  13 traces, chat errors 3 (23.1%)
 test  rate    5% ->   5 traces, chat errors 3 (60.0%)
```

Three things in that table are the check, and one of them is the reason the held-out run is a validation
rather than a formality:

- **The rule holds on data you did not develop against.** `3, 3, 3` on 37 requests from the other half of
  the set, at every rate. A keep rule that works on dev and not on test would mean the hash, not the rule,
  was doing the work.
- **The thinner half is the noisier half, exactly as in module 13.** 3 failures in 5 traces reads `60.0%`
  against 3 in 37 reading `8.1%`, on identical underlying behaviour. Same lesson as the held-out row in
  [13.4](../module-13/lesson-04.md): **you are always permitted to look at a number about a small sample
  once you know what the small sample's width is**, and a rate over nine traces is not a number you can
  alert on. That is the argument for 14.3.
- **The kept-set is a different set of requests.** Dev at 5% keeps 9 of 57; test at 5% keeps 5 of 37. They
  share no ids, because the ids are different — which is the point. A monitor built on dev's ids is a
  monitor that will never see the traffic you did not sample.

## Use / don't use

**Do decide the outcome before you sample, and write the order down where the next engineer will read it.**
The comment in `record()` and the `errors_first` parameter in `sample_for_review` are the same fact stated
twice, in two places that are two months apart.

**Do hash the request id.** It costs one line and it buys the only property that makes a sample auditable:
membership you can compute. `test_sample_queries_is_deterministic` is two lines long and is the whole
argument.

**Do print the sample rate next to every rate computed over the sample.** `5 of 9` with `rate 5%` beside it
is a work queue. `55.6%` on its own is a claim about production.

**Do keep the two failure numbers separate on the panel.** The rate over all requests is the metric; the
count over kept traces is the queue you work through. A single blended number forces a choice between a
number you can alert on and a number you can act on, and you will get whichever one you did not mean.

**Do sample the rare slices at 100%, or not at all.** If a category is 2% of traffic and the sample is 5%,
you are measuring luck. Either keep that category whole or accept that you have no monitor on it — but
write that down, because "we monitor the exception path" and "we sample 5% of everything" are different
claims.

**Don't sample the failures.** Not at any rate, not as a default, not because the rate is small. The
`8.3%`-that-happens-to-be-right number is the worst artefact in this module.

**Don't read a rate over the sample as a rate over traffic.** 12.5 made this point for a trace store; the
same arithmetic arrives on a production panel with money attached, and the reader there is an on-call
engineer at 2 a.m.

**Don't quote a judge call in dollars from this page.** The model here is the course's educational model
and the cost of judging 57 requests was never priced, because it is not a real call. The transferable
arithmetic is `requests x sample_rate + failures kept`, on your own price sheet.

What teams actually do: one sentence in the exporter — *keep the failures, hash the volume* — a sample rate
reviewed when the bill moves rather than when somebody remembers, per-slice overrides for the rare
categories, and a panel with the sample rate printed on it. The interesting part is that almost none of
that is statistics. It is the discipline of writing down which population a number is about, which is the
same thing lesson [04.2](../module-04/lesson-02.md) asked for at the start of the course and the reason
14.3 needs a drift check before it needs an alert.

## Reflect

1. The panel reads `55.6%` at a 5% sample and `8.8%` on the full window, and nobody changed anything.
   Write the two lines you would put in the dashboard footer, and say which field you would remove first
   if you could only keep one.
2. Somebody proposes raising the sample rate from 5% to 100% because the reported error rate is
   "distorted". Write the reply in three sentences that uses the 5-of-9 and 5-of-57 numbers and does not
   appeal to anybody's preferences.
3. You are adding a new intent to the bot next sprint, and it will be 0.5% of traffic. Write down what
   happens to the monitor under the rule in this lesson, and say what you would have to add for that
   intent to have any monitoring at all.
4. `sample_for_review` takes an `errors_first` flag, and nobody has ever turned it off. Write the commit
   message that removes it, in the two sentences that would make a reviewer agree.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- OpenTelemetry, [Sampling](https://opentelemetry.io/docs/concepts/sampling/) — why a consistent decision
  from a hash is what makes a sampled trace set analysable rather than a collection of anecdotes, and what
  "tail-based sampling" exists to fix when the decision genuinely has to wait until the span is finished.
- MLflow, [Tracing (Observability)](https://mlflow.org/docs/latest/genai/tracing/) — the production
  substrate this sampling rule lives in, and the reason the volume question is a storage and cost question
  before it is an evaluation one.
- Douglas Dean and Daniel Voss, [The Design and Analysis of
  Experiments](https://link.springer.com/book/10.1007/978-1-4757-5482-1) (1998) — why a sample is a claim
  about a population you did not look at, and the machinery for saying out loud which population you meant.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the habit underneath the whole rule:
  an eval that runs in production is a measurement somebody will act on, and a measurement over a set
  chosen for its failures is a number that gets misread within a week.
