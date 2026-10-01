---
id: "12.3"
module: 12
minutes: 25
practice_minutes: 60
prerequisites: ["12.2", "02.1"]
objectives:
  - Write the five spans of one instrumented request and say which of them only your own code can emit.
  - Explain why a span must be exported on the way out of the context manager, and what a tracer that loses spans on error actually reports.
  - Reproduce, from this lab, the error rate a naive exporter prints when 10% of model calls fail, and say why that number is not conservative.
  - Name the one attribute that turns a support complaint into a dashboard row, and the one that puts a customer's email in a third-party backend.
volatility: implementation
sources:
  - title: "OpenTelemetry — Generative AI semantic conventions: agent spans"
    url: https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/
  - title: "OpenTelemetry — Tracing API"
    url: https://opentelemetry.io/docs/specs/otel/trace/api/
  - title: "OpenTelemetry — Error handling"
    url: https://opentelemetry.io/docs/specs/otel/error-handling/
last_verified: "2026-10-01"
---

# 12.3 · Instrumenting the support bot by hand

The last two lessons gave you the model and the vocabulary. This one is the app: five spans around one
support request, written by hand, and then the single change that separates a tracer that reports
failures from a tracer that reports only successes and calls it a rate.

## Why it matters

Auto-instrumentation exists and it is good. Attach it to your model client and you get a `chat` span with
tokens and a duration, for free, with no code of yours involved. That is most of what a dashboard wants
and none of what this dashboard is for.

The app in this course does three things a model client cannot see: it retrieves a handbook section, it
runs a post-check on the answer, and it can fail. **None of those cross an instrumented library
boundary**, so an auto-instrumented trace of this bot is complete-looking and blind. Here is the whole
gap, in one line of output — twenty requests with 10% of their model calls made to fail, traced two ways:

```
20 requests, 10% with a planted model failure
  thin tracer   20 traces   chat error rate 0.0%
  fixed tracer  20 traces   chat error rate 10.0%
```

The thin tracer records the model call and nothing else. It cannot see the failures because it never
runs anything that can fail, and — the part that matters — it cannot see the citation rejections either,
because it emits no `chain` span at all, so the `chain` row on its error table is not zero, it is
*absent*. **A tracer that only knows about the library is not a cheaper version of a tracer that knows
about your app. It is a tracer about a different app.**

And here is the failure that turns this from a nice-to-have into the lesson. Take the shipped tracer and
change one line — the one that decides whether to export what it has when a call raises — and the
dashboard goes green:

| | shipped (`keep_errors=True`) | naive (`keep_errors=False`) |
|---|---|---|
| Traces delivered | **20** | **18** |
| `chat` error rate | **10.0%** (2/20) | **0.0%** (0/18) |
| `agent` error rate | 10.0% (2/20) | 0.0% (0/18) |
| `chain` error rate | 27.8% (5/18) | 27.8% (5/18) |
| Total tokens | 977 | **977** |
| Total cost | $0.00005289 | **$0.00005289** |
| p50 end-to-end | 1296.8 ms | **1296.8 ms** |

**Tokens identical. Cost identical to the cent. Median latency identical.** The naive exporter does not
report a slightly worse number. It reports *the same dashboard with the error count deleted*, and the
only visible sign that anything happened is that two traces out of twenty never arrived — which nothing
on the page reports, because there is nothing to report it against.

That is why the sentence at the top of this module matters: **a tracer that drops spans on error does
not under-report errors. It reports a rate computed over the requests that worked.**

## How it works

### The whole app

`instrumented_run` in [`observe.py`](../../labs/common/evallab/observe.py) is the entire lesson. One
function, five spans:

```python
with tracer.span("support.answer", "agent",
                 **{GEN_AI_CONVERSATION_ID: session}):
    # 1. retrieval
    with tracer.tool("retrieve_handbook", "retrieve_handbook") as ret:
        found = not (item.slice or {}).get("out_of_scope", False)
        ret.attributes["retrieved"] = int(found)
        if not found:
            ret.attributes[ERROR_TYPE] = "no_matching_section"

    # 2. the model call
    with tracer.chat("generate answer", model) as chat:
        if fail_on == item.id:
            chat.attributes[GEN_AI_OUTPUT_TOKENS] = 0
            raise RuntimeError(f"upstream timeout on {item.id}")
        chat.attributes[GEN_AI_INPUT_TOKENS] = estimate_tokens(prompt)
        chat.attributes[GEN_AI_OUTPUT_TOKENS] = estimate_tokens(answer)
        chat.attributes[GEN_AI_RESPONSE_MODEL] = model
        chat.attributes[GEN_AI_OUTPUT_MESSAGES] = answer
        chat.attributes["question"] = question

    # 3. the post-check
    with tracer.span("citation check", "chain") as check:
        category = item.human[label_variant]["category"]
        if category == "no_citation":
            check.attributes[ERROR_TYPE] = "no_handbook_citation"
        elif category == "extra":
            check.attributes[ERROR_TYPE] = "unsupported_addition"
```

Four spans around the request and one on the request — and only **two** of them are spans a library
could have produced for you.

| Span | Kind | Who could emit it | What it is for |
|---|---|---|---|
| `support.answer` | `agent` | you | the request; carries `gen_ai.conversation.id`, the grouping key |
| `retrieve_handbook` | `execute_tool` | **you** | whether there was any evidence in front of the model |
| `generate answer` | `chat` | the SDK | tokens, model, price, latency |
| `citation check` | `chain` | **you** | turns a support ticket into a dashboard row |

Three things in that code are choices rather than ceremony.

**The retrieval span exists to answer a question the model span cannot.** `retrieved: 0` with
`error.type: no_matching_section` means *the model was asked to answer with no evidence in front of it*.
The answer that produces will read perfectly fluently, because the failure is not in the words — it is
the whole subject of [02.1](../module-02/lesson-01.md), and this is the span that makes it visible.

**The post-check only fires on a rejection.** There is no `error.type` on a good answer, and that is
deliberate: a check that fires on every request is a check nobody reads, and a `chain` row at 100.0%
carries no information. `test_a_correct_answer_carries_no_postcheck_error` asserts it.

**The failure is raised *inside* the span.** Not caught and logged, not re-raised from a handler —
raised where it happens, with `output_tokens` set to zero first so the cost panel is not billed for an
answer that does not exist. `Tracer.span` catches it, records `error.type: RuntimeError` on the span,
and re-raises.

### What happens to that exception, and why it is the whole lesson

Here is the rest of the function:

```python
except Exception as exc:
    # Ship what we have.
    if keep_errors:
        exc.trace = tracer.to_dict()
    raise

return tracer.to_dict()
```

A real SDK does not need this. The OTel API exports from a span processor as spans *end*, so by the time
an exception leaves your `with` block every span is already on its way out. This package has no SDK, so
the export happens at the end of the function — and `keep_errors=False` is the version where it does not
happen at all, because the function never reaches its `return`.

That single line is the difference between the two rows of the table at the top of this lesson. Read
them again with it in mind: **identical tokens, identical cost, identical median, and the error count
gone.** The naive exporter is not mis-measuring. It is measuring a population from which the failures
have been removed, and a proportion over that population is a true number about the wrong thing.

### The two attributes that are not the model's business

On the same span you will find `user.id` and `user.email` when the app is called with a requester, because
a real support bot knows who it is talking to and the dashboard groups by session. That is correct
engineering and it is the reason [`tracing.py`](../../labs/common/evallab/tracing.py) has a `Redactor`:
**a trace is a copy of a conversation, and a conversation is where the personal data is.**
[12.5](lesson-05.md) turns that on deliberately. This lesson's rule is narrower and older: *decide what
you are shipping before you start shipping it*, and never add a `question` attribute without having
decided where the file lands.

> [!IMPORTANT]
> **Everything on this page is simulated, and the two things that matter most are simulated in different
> ways.** The durations are drawn from fixed ranges and every span carries
> `evallab.simulated_latency: true`; the token counts are `len(text) / 4`, not a tokenizer's; the price
> sheet is illustrative per-million-token pricing for small open models. **The failure rates, the span
> counts, the token totals and the cost totals are all computed for real, by the shipped code, on your
> machine** — the 10.0% and the 0.0% are two readings of the same twenty requests. Nothing here was
> measured against a live model, and no number on this page is a benchmark of a named system.

## Show me

[Lab: evallab package](../../labs/common/)

```
cd labs/common
set PYTHONPATH=.            # Windows PowerShell; on bash: export PYTHONPATH=.
py -m evallab.cli trace --n 20 --fail-rate 0.1 --out traces.jsonl
```

```
20 traces, 78 spans
  cost      $0.0001 total  qwen3-1.7b $0.0001
  tokens    584 in / 393 out (977 total)
  latency   p50 1297 ms, p95 2404 ms end-to-end
  errors    9 span(s) with an error.type
```

Now the same run, with the exporter that throws the trace away. There is no flag for it — that is the
point — so do it in Python:

```
py -c "import sys; sys.path.insert(0,'.'); from evallab import TraceStore, load, record; d=load('support'); k=TraceStore.from_traces(record(d,n=20,split='dev',fail_rate=0.10,seed=1,keep_errors=True)); l=TraceStore.from_traces(record(d,n=20,split='dev',fail_rate=0.10,seed=1,keep_errors=False)); print('traces', len(k), '->', len(l)); print('tokens', k.total_tokens()['total'], '->', l.total_tokens()['total']); print('cost', k.total_cost(), '->', l.total_cost()); print('agent', k.error_rate()['agent']['errors'], '->', l.error_rate()['agent']['errors']); print('chat', k.error_rate()['chat']['errors'], '->', l.error_rate()['chat']['errors']); print('chain', k.error_rate()['chain']['errors'], '->', l.error_rate()['chain']['errors'])"
```

```
traces 20 -> 18
tokens 977 -> 977
cost 5.289e-05 -> 5.289e-05
agent 2 -> 0
chat 2 -> 0
chain 5 -> 5
```

**Read those arrows from left to right.** Traffic fell by two, the spend did not move, and the two
things that fell are exactly the two that could have told you the model was failing.

Now the whole sweep, which is where the argument stops being an anecdote:

```
py build/m12-errors.py
```

```
planted   exporter    traces   chat errors   tokens   cost          p95
   0%    shipped       20       0/20   0.0%    1092   $0.00005892   2403.6
   0%    naive         20       0/20   0.0%    1092   $0.00005892   2403.6

  10%    shipped       20       2/20  10.0%     977   $0.00005289   2403.6
  10%    naive         18       0/18   0.0%     977   $0.00005289   2407.6

  25%    shipped       20       5/20  25.0%     842   $0.00004566   2403.1
  25%    naive         15       0/15   0.0%     842   $0.00004566   2238.7

  50%    shipped       20      11/20  55.0%     449   $0.00002409   2378.1
  50%    naive          9       0/9    0.0%     449   $0.00002409   1879.1

traces the naive exporter loses at a 10% planted rate: ['tr_s02', 'tr_s10']
```

Four facts in that table, and the first three are ordinary and the fourth is the lesson.

**Tokens and cost are identical in every pair.** Failed calls set `output_tokens` to 0 and never set
`input_tokens`, so a dropped trace and a kept trace contribute the same nothing to the bill. A cost panel
cannot detect the bug.

**The error rate is 0.0% at every planted rate**, including 50%. It is not conservative, and it is not
"under-reporting" in the sense of being a bit low. It is *structurally* zero, because the numerator and
the denominator are drawn from the same filtered set.

**At 50%, the naive exporter delivers 9 traces instead of 20 and reports that nothing went wrong.** And
the latency got *better*: p95 falls from 2378.1 ms to **1879.1 ms**, because a request that raised is a
short request. **A dashboard that gets faster as the model gets worse is the single most dangerous
artefact in this module**, because a latency improvement is what a team is told to celebrate.

**`tr_s02` and `tr_s10` are named.** The naive exporter's two missing traces are the two that contained
a model failure — not two random requests, *exactly* the failures. That is the asymmetry: what you lose
is never a neutral sample.

Finally, the tests, one of which is this lesson written as an assertion:

```
py -m pytest tests/test_tracing.py -q -k "failed_traces or raising"
```

```
collected 23 items / 21 deselected / 2 selected

tests\test_tracing.py ..                                                 [100%]
====================== 2 passed, 21 deselected in 0.03s =======================
```

`test_failed_traces_survive_the_exception` asserts `len(kept) == 20`, `len(lost) < 20`, and — the line
that carries the lesson — that the lost store's `chat` error count is **0**.

## Try it

**Predict first**, on paper:

1. Ten percent of model calls raise, and your exporter returns nothing when a call raises. How many
   traces do you expect to arrive out of 20, and what does `chat` error rate read?
2. The dropped traces fail *inside* the chat span, before the post-check runs. What happens to the
   `chain` error rate — does it move up, move down, or stay put?
3. A failed request is a fast request. If the failures stop being recorded, what does p95 latency do?

[Lab: evallab package](../../labs/common/)

1. **Do the lab.** [`labs/module-12/`](../../labs/module-12/) has a starter with three TODOs and a
   solution beside it: the retrieval span, the post-check span, and — the one that matters — shipping
   your spans when the call raises. From the **repository root** — these two files are not under
   `labs/common/`, so they need the package on the path:

   ```
   $env:PYTHONPATH="labs/common"        # PowerShell; on bash: export PYTHONPATH=labs/common
   py labs/module-12/starter/instrument.py
   py labs/module-12/solution/instrument.py
   ```

   ```
   20 requests, 10% with a planted model failure
     thin tracer  20 traces   chat error rate 0.0%
     fixed tracer 20 traces   chat error rate 0.0%
     The two agree, which means the failures are being dropped in both.
   ```

   ```
   20 requests, 10% with a planted model failure
     thin tracer   20 traces   chat error rate 0.0%
     fixed tracer  20 traces   chat error rate 10.0%
   ```

   The `thin` row is 0.0% in both and always will be: it has no post-check span and no failure. It is in
   the output so you can see that the contrast is *fixed tracer versus thin tracer*, not *fixed versus
   broken*.

2. **Reproduce the sweep yourself.** From the repository root, `py build/m12-errors.py` prints the table
   above. Then write your own loop over `fail_rate` in `(0.0, 0.1, 0.25, 0.5)` and `keep_errors` in
   `(True, False)`, printing traces, `chat` errors, tokens, cost, p50 and p95 for each. If yours
   disagrees with the shipped script, stop and find out which of you is wrong before you go on.
3. **Read a failed trace and a healthy one side by side.**

   ```
   py -m evallab.cli trace --n 20 --fail-rate 0.1 --tree tr_s02
   py -m evallab.cli trace --n 20 --fail-rate 0.1 --tree tr_s01
   ```

   `tr_s02` is three lines with `ERROR RuntimeError` on the root and the chat span, `0in/0out`, and **no
   post-check span at all**. Write down the three questions the failed tree answers that the healthy one
   does not, and the one question only the healthy one answers.

4. **Instrument something only you can see.** Find an item in the dev split whose `slice` has
   `out_of_scope: True`, run `instrumented_run` on it, and read the retrieval span. You should see
   `retrieved: 0` and `error.type: no_matching_section` on a request that still returns an answer. Write
   the two sentences you would put on the dashboard: what the bot did, and what it should have done.
5. **Count how many of your spans the SDK could have given you.** For the twenty traces at
   `--fail-rate 0.1`, the kinds are `agent 20`, `execute_tool 20`, `chat 20`, `chain 18` over 78 spans.
   Sort them into "an SDK gives me this" and "only my code can emit this", and compute the share of the
   trace that auto-instrumentation alone would cover.

## Break it

**Set `keep_errors=False`.** Twenty requests run, 10% of the model calls raise, and the store receives
**18 traces**. `chat 0/18 = 0.0%`, `agent 0/18 = 0.0%`, `errors 5 span(s) with an error.type` against 9.
Everything is green. The lie: **a tracer that loses spans on error reports a rate computed over the
requests that worked**, and the rate it reports is exactly as correct — and exactly as meaningless — as
the population it was computed over.

**Let the failures out of the latency panel too.** At a 50% planted rate the naive exporter's p95 falls
to 1879.1 ms against the shipped 2378.1 ms, a **21% latency improvement**. The lie: **a failure is a
short request**, so dropping failures makes your p50, your p95 and your traffic chart all improve at
once, and the team that was told to celebrate the latency win is the team that stopped shipping.

**Read the `chain` row as a reprieve.** On the 10%-plant run, `chain` is `5/18 = 27.8%` with the failures
kept and `5/18 = 27.8%` with them dropped — identical numerator, identical denominator. On the clean run
the same five rejections read `5/20 = 25.0%`, because no request failed before reaching the check. So the
naive exporter pushed the post-check *up* by nearly three points while driving the model to zero, and the
comparison against a run you did not plant makes it look like the check got worse. The lie: **an
unchanged number is not a stable number.** The bug does not even under-report uniformly — it re-ranks,
and sends you to the component that is working.

**Ship the cost panel as the health signal.** Cost falls as failures rise — $0.00005892 at 0% down to
$0.00002409 at 50% — and `summary()` prints it to four places, so the shipped panel reads `cost $0.0001
total` on a healthy run and **`cost $0.0000 total`** when half the requests are failing. The lie: **a
number that falls when the product breaks is being read as an efficiency win**, and a panel that prints
`$0.0000` has deleted the measurement rather than rounded it.

**Instrument only the model call.** `thin_trace` — 20 traces, 20 chat spans, `chat 0/20 = 0.0%`, and no
`chain` row in the table at all. Complete-looking, correct, and blind to every failure this app has. The
lie: **auto-instrumentation measures the library, and it reports the absence of your own spans as
success** rather than as a gap.

## Fix it

1. **Export inside the context manager, not after the function.** This is what a real SDK does and it is
   why a real SDK cannot have this bug. If you hand-roll a tracer, put the export in a `finally` or an
   `except` that re-raises — never only on the success path. One `try/except` around the whole function:
   salvage, attach, re-raise.
2. **Assert that the number of traces you sent is the number you received.** `len(lost) == len(kept)` on
   a run with no failures, and the difference on a run with failures is *exactly* the failures. A
   collector that reports "received 18 of 20" in the same breath as the error rate closes the loop; the
   one that does not is the bug.
3. **Never let a rate be computed over a filtered population without saying so.** `chat 0/18` is a
   correct number about the traces that arrived. `chat 0/18, 2 traces lost` is the same number with a
   caveat, and the caveat is the whole difference.
4. **Keep the failing spans, and make them cost nothing.** `output_tokens = 0` on a failed call, input
   tokens omitted rather than invented. `test_model_spans_carry_model_and_tokens` asserts both, and the
   reason in the docstring is that a made-up number on a failure inflates the cost panel with the price
   of an error.
5. **Emit the spans only your app owns, even when they look redundant.** `retrieved: 0` and the post-check
   are two lines each, and between them they are the only thing standing between you and a quarter of
   uncited answers with a latency panel showing nothing wrong.
6. **Make the post-check's rejection reasons a short table of strings, not formatted messages.** Two
   reasons in `instrumented_run`, four in the lab's solution, both a set. You cannot group by a message;
   [12.2](lesson-02.md) covers why, and this is the second half of the same lesson.
7. **Test the failure path, not just the happy one.**
   `test_failed_traces_survive_the_exception` and `test_a_raising_call_still_leaves_a_span_with_error_type`
   are the only tests in the file that would catch this class of bug, and the second of them is fifteen
   lines long. A tracer whose tests only exercise successful calls is a tracer whose error reporting is
   untested.

## How do I know it works?

**Challenge, on dev.** 20 dev traces at a 10% planted failure rate. Five conditions, and the third is
the one that fails first:

- **Every trace has all four spans** — 78 of 80, and the two missing `chain` spans are on the two traces
  that raised. If you get 80, your planted failures are not raising; if you get fewer than 78, your
  tracer is losing spans somewhere the failure did not come from.
- **`error_rate()` names a denominator you can account for.** `agent 2/20`, `chat 2/20`,
  `chain 5/18`, `execute_tool 0/20` — 9 errors over 78 spans, and you can say which spans carry each.
- **`keep_errors=True` and `keep_errors=False` deliver the same traces on a run with no failures, and
  differ by exactly the failure count when there are failures.** 20 and 20 at `--fail-rate 0`; 20 and 18
  at `--fail-rate 0.1`. If the naive run ever delivers *more*, you have a different bug.
- **The cost of a failed request is zero and the span is still there.** `tr_s02` reads `0in/0out` and
  `ERROR RuntimeError`, and it appears in the store.
- **`py -m pytest labs/module-12/solution -q` passes**, and its
  `test_a_planted_failure_reaches_the_error_rate` asserts what you just checked by hand.

**Then one held-out read**, on the **37 `test_ids`**, at the same 10% plant:

| | First 37 dev | Held-out 37 |
|---|---|---|
| Traces / spans | 37 traces, 144 spans | 37 traces, **145 spans** |
| `agent` errors | 4/37 | **3/37** |
| `chat` errors | 4/37 | **3/37** |
| `chain` errors | 10/33 (30.3%) | **11/34 (32.4%)** |
| Chat spans carrying `output_tokens` | 37 of 37 | 37 of 37 |
| Chat spans carrying `input_tokens` | **33** of 37 | **34** of 37 |

Within each split, the gap between the `output_tokens` row and the `input_tokens` row is four on dev and
three on held-out, and it equals the number of raised calls on that split. **That is the check you would
run on a real tracer**: the count of spans missing an attribute should equal the count of failures, not
approximately equal it, and if you cannot make those two numbers agree you do not know what your tracer is
dropping.

The `chain` row is the one that moved in a direction worth reading: 10 rejections in 33 on dev, **11 in
34** on data the post-check had never run against. Same check, same code, one more answer rejected and a
smaller denominator. A rejection rate that goes *up* on held-out data is the measurement working — and it
is the first number in this module that is a finding rather than a property of the instrument.

## Use / don't use

**Do instrument the branch points, not the library calls.** The retrieval, the post-check and the error
path are yours. The `chat` span is the SDK's, and you can usually have it for free.

**Do make the exception path a first-class case.** If the only traces you ever read are the ones that
worked, you have a dashboard of your successes and no idea how many there are.

**Do report how many traces you received against how many you sent.** It is one number and it catches the
worst bug in this lesson.

**Do record rejection reasons as a small set of strings.** You want `chain` grouped by reason, which
[05.3](../module-05/lesson-03.md)'s rubric already gives you a vocabulary for.

**Do decide about customer data before the first export, not after the first complaint.** `user.email`
on a span is one line of code and a one-way door; [12.5](lesson-05.md) is the lesson about which side of
it you end up on.

**Don't build a dashboard whose health tiles are cost and latency.** Both fall when the product breaks, in
this app and in a real one, because a failed request consumes little. **An error rate is the only tile
that rises when the product breaks** — which is precisely why it is the one that must not be computed
over a population that has had its failures filtered out.

**Don't hand-roll a tracer if a real SDK will do, and don't assume a hand-rolled one behaves like one.**
`Tracer` is a dataclass with a `try/except/finally`, and the `finally` is the entire design. Everything in
this lesson is the argument for using a library once it has one.

What teams actually do in production: auto-instrument the model client, hand-instrument the two or three
branches that are theirs, wrap the entry point, and make sure the export path runs on the exception as
well as the return. Then — and this is the part most teams skip — they alert on the per-kind error rate
computed over *received* traces, and they watch the received count, because the day that count stops
matching the sent count your error rate is measuring a population you have already filtered.

## Reflect

1. Your dashboard reads `chat error rate 0.0%` and your traces counter reads 9 of the last 20 requests.
   Write the two sentences you would send to the team, and say which panel you would trust if you had to
   choose one and explain why in a third.
2. On the 10% run, `keep_errors=False` produces identical tokens, identical cost and an identical p50.
   Name two more quantities that stay identical under that bug, and one that changes. Then repeat the
   question at a 50% planted rate, where the p50 moves too, and say which of your answers change.
3. At a 50% planted failure rate the naive exporter's p95 latency improves by 21%. Write the paragraph
   you would put in a design document explaining why a latency improvement is evidence *against* a
   deployment, and what you would have to record on every span to make that check routine.

## Sources

- OpenTelemetry, [Generative AI semantic conventions: agent
  spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) — the `agent` root span
  and its nesting, which is the shape `instrumented_run` builds by hand.
- OpenTelemetry, [Tracing API](https://opentelemetry.io/docs/specs/otel/trace/api/) — the rule that a
  span must be *ended*, and that "any span that is created MUST also be ended"; the `RecordException` and
  `Set Status` operations are how a real SDK makes the error path a span attribute rather than a log
  line.
- OpenTelemetry, [Error
  handling](https://opentelemetry.io/docs/specs/otel/error-handling/) — how the project expects
  libraries to behave when an operation fails, and why `error.type` rather than an exception message is
  the thing on the span.