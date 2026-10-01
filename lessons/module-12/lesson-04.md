---
id: "12.4"
module: 12
minutes: 18
practice_minutes: 45
prerequisites: ["12.2"]
objectives:
  - Name the four spans the shipped support bot emits and say which one of them an auto-instrumented model client creates for you.
  - Read an error rate by span kind and identify which of the reported defects a model-only instrumenter would have reported as zero.
  - Write the one-line rule for when to stop trusting an auto-instrumented trace, and test it against a question your own system raises.
  - Separate what this lesson measures by running the shipped code from what it reasons from the conventions, and say which is which.
volatility: implementation
sources:
  - title: "Zero-code instrumentation — OpenTelemetry"
    url: https://opentelemetry.io/docs/zero-code/
  - title: "Semantic conventions for generative AI systems — OpenTelemetry"
    url: https://opentelemetry.io/docs/specs/semconv/gen-ai/
  - title: "MLflow Tracing for LLM and Agent Observability"
    url: https://mlflow.org/docs/latest/genai/tracing/
  - title: "Instrumentation packages — opentelemetry-python-contrib"
    url: https://opentelemetry-python-contrib.readthedocs.io/en/latest/instrumentation/index.html
last_verified: "2026-10-01"
---

# 12.4 · Auto-instrumentation, and when to stop trusting it

Auto-instrumentation is a monkey-patch on your model client's `send`, or a one-line `autolog()` call, and it
gives you a real, useful trace of every model call in an afternoon. This lesson is about the other side of
that trade: what the patch cannot know, and the single rule that tells you when a trace you did not write has
stopped being evidence about your product and become evidence about your HTTP client.

## Why it matters

A team adds an auto-instrumenter on a Monday. By Tuesday there is a dashboard: model calls per minute, tokens
per minute, p95 latency, and an error rate. The error rate is **0.0%**. It stays at 0.0% for six weeks.

Six weeks later the eval suite from Module 11 says a quarter of the bot's answers ship with no citation to
the handbook. The team opens the trace backend to find out what is happening, and a failing request has three
spans in it: a `POST /v1/chat/completions`, a response, and nothing else. Every model call returned 200. The
dashboard was right, and it was answering a different question.

That is not hypothetical in this repository either, and the number that makes it concrete comes from the
shipped app. Here is the error rate by span kind over the **20 dev traces**, straight from
`TraceStore.error_rate()`:

| Span kind | Spans with an `error.type` | Spans | Rate |
|---|---|---|---|
| `agent` | 0 | 20 | 0.0% |
| `chain` | **5** | 20 | **25.0%** |
| `chat` | **0** | 20 | **0.0%** |
| `execute_tool` | 0 | 20 | 0.0% |

The model was healthy on every single request. Five of twenty answers — **25.0%** — were recorded by the
`citation check` span as `no_handbook_citation` or `unsupported_addition`, and every one of those is a
**successful model call that produced a defective answer**. An instrumenter that watches the model client
reports the `chat` row: **0 out of 20, no errors.**

Now plant a real transport failure and both numbers appear at once:

| Span kind | Errors / spans | Rate |
|---|---|---|
| `agent` | 2 / 20 | 10.0% |
| `chain` | 5 / 18 | 27.8% |
| `chat` | **2 / 20** | **10.0%** |
| `execute_tool` | 0 / 20 | 0.0% |

Nine spans carry an `error.type` in that run. A model-only instrumenter sees **two** of them. The other
seven are in spans it never creates: the root request, and the post-check that noticed the answer was
uncited. The instrumenter is not broken. It is reporting 10% on a denominator that excludes the defect the
team actually has.

## How it works

### What a patched client can see, and why

An auto-instrumenter wraps the client's request method. It therefore observes the request it was handed and
the response it got back, plus anything that happened between them: a duration, a retry, an exception. From
that it can produce exactly one kind of span per call:

| Attribute | Where it comes from |
|---|---|
| `gen_ai.request.model` | the model name you passed in |
| `gen_ai.usage.input_tokens` / `output_tokens` | the usage block in the API response |
| the duration | its own clock, around your call |
| `error.type` | the exception, if the call raised |

That is the whole of it, and it is genuinely most of what a *model* dashboard needs. Now compare it to what
the shipped app emits. `instrumented_run()` in [`evallab/observe.py`](../../labs/common/evallab/observe.py)
opens four spans per request:

| Span | Kind | Created by an auto-instrumenter? | The question only it can answer |
|---|---|---|---|
| `support.answer` | `agent` | no | how long the whole request took; which conversation it belongs to |
| `retrieve_handbook` | `execute_tool` | no | **did the model get anything to answer from?** |
| `generate answer` | `chat` | **yes** | model, tokens, cost, transport errors |
| `citation check` | `chain` | no | **is the answer supported by what we retrieved?** |

One of four. And the one it creates is the one you could have written in five lines yourself — lesson 12.3's
`with tracer.chat("generate answer", model):` is a context manager and a dict.

The three it misses are not overhead to be tidied up later. Each one records a decision that exists nowhere
except in your code:

- **`retrieve_handbook` carries `retrieved: 0`.** It is the only place in the whole trace that says the model
  was asked to answer without evidence. A model call cannot know what was in the prompt; only your retrieval
  can know what was missing from it.
- **`citation check` carries `error.type: no_handbook_citation`.** It is the only place the defect exists.
- **`support.answer` carries `gen_ai.conversation.id`** and nothing else. It is the only place the request's
  own boundary is recorded, so it is what every end-to-end duration is measured against.

### The part you get for free, and did not ask for

The other half of the trade, stated honestly: a patched client sits inside your HTTP stack, so it is also in
position to produce spans for the transport — connection acquisition, a retry, and, if you use a helper
library, one span per internal call the library makes. You do not choose those, and silencing them is
configuration work rather than deletion. I have not measured any of that here; it is the standard shape of
this kind of instrumentation, and the reason vendors ship filters and "suppress" lists for it. The lesson to
take is not "auto-instrumentation is noisy" but **"auto-instrumentation decides which spans exist, and that
decision is not yours."**

### What each query needs, which is the decision rule in table form

[`TraceStore`](../../labs/common/evallab/observe.py) is the set of questions you would otherwise click in a
trace UI. Ask each one what it has to read:

| Query | Reads | Served by a model-only trace? |
|---|---|---|
| `total_cost()`, `total_tokens()` | `spans("chat")` | **yes, completely** |
| `p50_model_call`, `p95_model_call` | `spans("chat")` | **yes, completely** |
| `p50_end_to_end`, `p95_end_to_end` | the span with no `parent_id` | **no — it will report the model call** |
| `error_rate()` | all four span kinds | **no** |
| `sessions()` | `gen_ai.conversation.id` | **no** |

The third row is the subtle one, because nothing goes wrong. `latency()` takes the spans with no parent as
the roots, and a patched model client opens its span at the top of a context that usually has no enclosing
request in it — so the model span *is* the root, and the end-to-end column reads the model call: **1229 ms**
at p50 and **2318 ms** at p95, the same two numbers as the model-call column, under a heading that says
"end-to-end". That is the **correct** reading of the trace you have. It is simply not a measurement of your
request, because your request is not in it. A dashboard built this way is not broken; it is answering a
question nobody asked, and it looks exactly like a dashboard.

The last row is quieter still: with no span carrying `gen_ai.conversation.id`, every trace groups under
`unknown` and `sessions()` returns one bucket that means nothing.

### The rule

> **An auto-instrumented trace is evidence about the model's behaviour and nothing else. The moment a
> question touches your logic — your retrieval, your post-check, your refusal branch, your threshold, your
> session — the span that answers it has to be yours, because no configuration tells an instrumenter what
> your code meant.**

The operational form is one line: *keep the auto-instrumented model span; add the three that are yours.* Not
instead of — with. The three are three `with` blocks and four attribute names, they cost no dependency, and
`Tracer` in `evallab/tracing.py` is eighty-odd lines and imports nothing outside the standard library. The
GenAI conventions they follow are still marked **Development** upstream, which is the other reason the
hand-written half is cheap to own: there is no stable attribute to be locked out of.

> [!IMPORTANT]
> Everything measured in this lesson comes from the hand-instrumented path, run on this repository. No
> auto-instrumenter was executed: neither `opentelemetry` nor `mlflow` is installed in this environment — the
> exporter says so on every run, `skipped otlp: not installed or no OTEL_EXPORTER_OTLP_ENDPOINT` and `skipped
> mlflow: not installed` — and there is no `openai` client here to patch. The comparison between the two
> paths is reasoned from what each one can observe, and it is reasoned in a specific direction: an
> auto-instrumenter is not worse than hand instrumentation, it is narrower. Do not read "one of four" as a
> measurement of a named library's output; read it as a count of the spans in this app that only app code can
> produce.

## Show me

One trace, from the shipped CLI. Four spans, one of them carrying the defect:

```console
$ py -m evallab.cli trace --n 6 --tree tr_s26
[agent] support.answer  2441.371ms
  [execute_tool] retrieve_handbook  57.446ms
  [chat] generate answer  2364.48ms  28in/15out  $0.000002
  [chain] citation check  10.876ms  ERROR no_handbook_citation
```

Two things about that command that are worth more than the tree. First, `tr_s26` is **not** one of the first
six dev items, so the CLI fell back to the first trace it had — and said nothing. What you are reading is
`tr_s01`. A tool that shows you a different trace than the one you asked for, without a word, is the reason
the sampler in lesson 12.5 has to be deterministic rather than a coin flip: when the thing you wanted is
missing, the worst thing you can do is pretend you were shown something. Second, the `[chat]` line is the only
line an auto-instrumenter writes, and it is the only line that says nothing is wrong.

The error breakdown, same 20 dev traces, from `TraceStore.error_rate()`:

```console
$ py -c "from evallab import TraceStore, load, record; s=TraceStore.from_traces(record(load('support'), n=20, split='dev', seed=1)); print(s.error_rate())"
{'agent': {'errors': 0, 'spans': 20, 'rate': 0.0}, 'chain': {'errors': 5, 'spans': 20, 'rate': 0.25},
 'chat': {'errors': 0, 'spans': 20, 'rate': 0.0}, 'execute_tool': {'errors': 0, 'spans': 20, 'rate': 0.0}}
```

And now the retrieval span, which does not fire at all on the first twenty dev items — because none of the
first twenty is an `out_of_scope` question. Run the whole dev split and it appears:

```console
$ py -m evallab.cli trace --n 57 --out traces.jsonl
57 traces, 228 spans
  cost      $0.0002 total  qwen3-1.7b $0.0002
  tokens    2055 in / 1448 out (3503 total)
  latency   p50 1585 ms, p95 2378 ms end-to-end
  errors    20 span(s) with an error.type

$ py -c "from evallab import TraceStore, load, record; s=TraceStore.from_traces(record(load('support'), n=57, split='dev', seed=1)); print(s.error_rate())"
{'agent': {'errors': 0, 'spans': 57, 'rate': 0.0}, 'chain': {'errors': 15, 'spans': 57, 'rate': 0.2631578947368421},
 'chat': {'errors': 0, 'spans': 57, 'rate': 0.0}, 'execute_tool': {'errors': 5, 'spans': 57, 'rate': 0.08771929824561403}}
```

**Twenty error spans in the full dev run, and five of them are `no_matching_section`** — the retrieval span
reporting that the handbook does not cover the question. Those five still called the model, and they still
paid for it. A model-only trace has **0 of 57** errors, and the question it cannot answer is the one Module 8
spent a lesson on: was the bot asked to answer something the handbook does not contain?

One of those five, as a tree:

```console
$ py -m evallab.cli trace --n 57 --tree tr_s88
[agent] support.answer  2223.522ms
  [execute_tool] retrieve_handbook  30.304ms  ERROR no_matching_section
  [chat] generate answer  2158.02ms  38in/26out  $0.000003
  [chain] citation check  29.608ms
```

Read it carefully: the model call is the expensive line, and it succeeded. The line that says the question was
unanswerable is the cheap one above it.

And the package's own tests, which encode the properties rather than the numbers:

```console
$ py -m pytest tests/test_tracing.py -q
24 passed in 0.06s
```

`test_error_rate_is_reported_by_span_kind` is the one this lesson is about: it asserts that `chain` and `chat`
are both present in `error_rate()` and that the `chain` rate is above zero. A trace with no `chain` spans
cannot pass it — which is the executable form of "one of four".
`test_latency_uses_the_root_not_the_longest_span` is the counterexample the table above predicts: build a
trace with one parentless `chat` span and the test asserts end-to-end equals the model call, because they are
the same span. Nothing is broken and nothing raises — the number is simply a measurement of the model.

> [!NOTE]
> The durations above are **simulated**, and every span says so: the app answers from recorded outputs, so a
> real clock would report sub-millisecond spans and a latency column of zeros. `Tracer` defaults to
> `simulate_latency=True` and stamps `evallab.simulated_latency: true` on every span it creates, for exactly
> this reason. What is real here is the *shape* — the model call dominates, the tool span is small, the
> post-check is smaller — and all of the arithmetic. Lesson 12.5 makes this explicit and prices it.

## Try it

**Predict first**, before running anything:

1. The auto-instrumented dashboard says the model error rate is 0.0%. The eval suite says 25% of answers are
   uncited. Name the one number you would put on the incident page and the one you would delete.
2. A model-only trace reports a p95 end-to-end of **2318 ms**. The shipped app's p95 model call is also
   **2318 ms**. Is anything wrong, and if not, why is the heading a lie?
3. `retrieve_handbook` never fires `no_matching_section` on the first twenty dev traces. Is that the span
   being useless, the retrieval being perfect, or something about the item set?
4. You have written all four spans by hand. A vendor SDK arrives that also emits agent spans. Name one thing
   you would delete, and say what the SDK would need to know before you could.

[Lab: evallab package](../../labs/common/)

1. **Count the spans you would lose.** From `labs/common/`, run the `--tree` command above and the
   `error_rate()` one-liner. Write the four span names in a column and, next to each, the one question it
   answers that the other three cannot. If a row has an empty cell, that span is decoration — delete it or
   give it an attribute.
2. **Delete a span and read the number again.** Open `traces.jsonl` from the `Show me` section, remove every
   `chain` span from the first five traces, and load them back with
   `TraceStore.load(...)`. The `error_rate()` you get is exactly what the auto-instrumented team would have
   seen. Write down the question you would no longer be able to ask that trace.
3. **Remove the root and read the headings again.** Same trick with the `agent` span, then call `.latency()`.
   The `chat` spans have no parent left, so each one *is* the root and `p50_end_to_end` becomes
   `p50_model_call`. Confirm it, then write the tooltip you would put on a dashboard if you shipped the
   first number under the second heading — and say whether the tooltip is a fix or a confession.
4. **Run the split the defect lives on.** `py -m evallab.cli trace --n 57`, then find the five
   `out_of_scope` items on the dev split in `datasets/support.json` and confirm each one produces
   `retrieved: 0`. Ask the question from prediction 3 again with the answer in hand.
5. **Write the rule as a line your team could paste into a runbook**, then try to break it. Write down one
   question about your own product that the rule fails to settle, and say whether the answer is "add a span"
   or "the question does not need a span". Most of them are the second, and knowing which is which is the
   skill.

## Break it

**Quote the model error rate as the product's error rate.** In the planted run it is 2 of 20 = 10.0%, and the
defect rate is 5 of 18 = 27.8%. Two denominators, two questions, one tile. The lie: **an error rate over the
calls you made is not an error rate over the requests you answered**, and the difference is exactly the part
of the system that is yours.

**Read "every model call returned 200" as health.** It is a fact about the transport and it was true on the
run at the top of this lesson while a quarter of the answers shipped uncited. The lie: **a trace with no
errors is not a trace with no problems; it is a trace with no questions.** The model answering confidently
without evidence produces no error, because nothing in the request told it that was wrong.

**Delete the hand-written spans because the SDK has its own agent spans.** It does. The lie: **a span can be
recorded for you and still mean nothing** — the SDK will happily emit a `chain` span the moment you call it,
and it has no way to know that your `chain` is a citation check that failed, as opposed to a formatting
step, a retry, or a cache lookup. The event is not the finding. Only your code knows which one it was.

**Turn the auto-instrumenter on in production and leave the hand-written root behind "because they are the
same".** They are not the same: one root is your request, the other is the library's. The lie: **two roots,
or a root you do not control, means every end-to-end number is measured against a boundary you cannot change
without noticing.**

**Trust the patch on a framework whose internals you have not read.** A helper library that wraps the client
may itself call the client, so one logical call becomes two nested spans and the token counts add twice. The
lie: **"auto-instrumented" describes how the span was made, not how many things it is counting.**

## Fix it

1. **Keep the auto-instrumented model span; add the three that are yours.** The shipped app is the worked
   example: one `tracer.chat(...)` block the patch would have given you, and three blocks it would not. Add
   rather than replace, because the model span is genuinely good and free.
2. **Name every hand-written span after the question it answers.** `citation check`, not `chain`. `chain` is
   a kind and a kind cannot be queried; the name can. If you cannot write the question in the span name, you
   do not yet know what that span is for.
3. **Record `error.type` on the span that *detected* the problem, not on the one that raised.** A citation
   check that fails is an `error.type` on a span where nothing raised. That is why the defect rate is
   readable from `error_rate()` at all, and it costs one line: `check.attributes[ERROR_TYPE] = ...`.
4. **Assert the shape in a test, or the shape will drift.** `test_error_rate_is_reported_by_span_kind`
   asserts that `chain` and `chat` are both in `error_rate()` and that the `chain` rate is above zero. That
   is Module 13's regression gate, applied to instrumentation instead of to a prompt.
5. **Put the rule in the runbook**, as the sentence from the rule box. Not the rule as a preference — the
   rule as the thing that stops a reviewer's approval, because the next person to add a model call will
   otherwise have no reason to open the other file.

## How do I know it works?

**Challenge, on dev.** The 20 dev traces, and four conditions before the auto-instrumented trace is allowed
to be the only trace:

- **Every error in the run is attributable to a span kind you wrote.** The run has **9** spans carrying an
  `error.type` with failures planted; `agent 2`, `chat 2`, `chain 5`. Ask which of the three kinds a
  model-only trace would not contain, and write the answer into the runbook.
- **The defect rate and the transport rate are different numbers and both are reported.** `chain 5/20 =
  25.0%` and `chat 0/20 = 0.0%` on the clean run. A dashboard that prints one of them as *the* error rate has
  already failed this condition.
- **`p50_end_to_end` and `p50_model_call` are different numbers.** **1297 ms** against **1229 ms** on the
  clean run. If your two columns agree, nothing is broken — you have no enclosing request span, so the model
  call is the root and your end-to-end number is a model number wearing an end-to-end heading.
- **The retrieval span fires on the items that are out of scope.** It does not fire on the first twenty dev
  items at all; over the full **57** it fires on five, and `execute_tool` reports **5 / 57**. A span that
  never fires is either a bug or an item set that does not contain the case, and you cannot tell which
  without running the split that does.

**Then one held-out validation**, on `test_ids` — the remaining **37 items**, run once:

```console
$ py -m evallab.cli trace --n 37 --split test --out traces.jsonl
37 traces, 148 spans
  cost      $0.0001 total  qwen3-1.7b $0.0001
  tokens    1366 in / 979 out (2345 total)
  latency   p50 1197 ms, p95 2125 ms end-to-end
  errors    14 span(s) with an error.type
```

Three things in that output are the check, and all three are about the instrumentation rather than the
product:

- **Every trace has exactly four spans: 148 / 37.** No trace is short a span, which is the shape an
  auto-instrumented trace would never have — and no trace is long one, which is what you would get if a
  helper library double-counted a call. Both numbers fall out of one division.
- **The error rate moved from 5-in-20 on dev to 14-in-37 on held-out.** That is a different rate on data the
  spans were not written against, which is the only evidence available that the spans describe something
  real rather than describing the twenty items they were debugged on.
- **Nothing was exported anywhere.** The exporter prints
  `skipped otlp: not installed or no OTEL_EXPORTER_OTLP_ENDPOINT` and `skipped mlflow: not installed`, and
  the only thing written is the JSONL file in the directory you ran it from. A trace that reached a
  production backend would be a trace on someone else's machine, and this lesson makes no claim about what a
  backend does with one.

## Use / don't use

**Do auto-instrument first, and say so.** It is an afternoon, it needs no code review, and it gives you cost,
tokens and model latency for a system nobody has instrumented. That is a real win and pretending otherwise
is cargo-culting hand-written spans.

**Do hand-instrument before the first eval, not after.** An eval item set is chosen by what you suspect, and
the spans for what you suspect are the ones that are not model calls. A team that runs its first eval against
an auto-instrumented trace will discover the missing spans from a failing score, which is the most expensive
possible way to find out.

**Do keep both layers, and label which is which.** Production traces carry the vendor SDK's spans *and*
yours, with your `service.name` and your span names on top. The reader needs to know which spans came from the
patch, because that is what tells them what the trace cannot see.

**Don't build an eval on an auto-instrumented trace.** Not because it is inaccurate — the model span is
accurate — but because the items you will want to look at afterwards are the ones the patch does not record.
You will end up re-running under manual instrumentation to investigate, which means the trace that settled the
question is not the trace you shipped.

**Don't quote a comparison you did not run.** This lesson is explicit that no auto-instrumenter was executed
here, and the reason is a sentence you can reuse: *the packages are not installed and there is no client to
patch.* If you run the comparison on your own system, quote your numbers and name the versions. If you have
not, quote the shape of the difference and say it is reasoning.

What teams actually do: the SDK goes on in week one, because it is cheap and it tells you whether the model
call is the bottleneck. Three spans are added by hand in the same week, because that is when somebody first
asks "what did it actually retrieve" and gets no answer. The auto-instrumented trace is never switched off —
it is the only part that survives a library rewrite — and the hand-written three are the part that survives a
question nobody had thought of yet.

## Reflect

1. The clean 20-trace run reports a 0.0% model error rate and a 25.0% citation-defect rate. Write the two
   sentences you would put on the incident page, and say which one belongs in a dashboard tile and which
   belongs in the eval suite.
2. `p95_end_to_end` and `p95_model_call` both read 2318 ms in a model-only trace, and nothing is broken.
   Write the sentence that would stop a reviewer treating the first as a latency SLO, and name the single span
   whose absence causes it.
3. You are about to add auto-instrumentation to a service that already has hand-written spans from a previous
   team. Write the rule you would put in the pull-request description, in one sentence, that a reviewer could
   disagree with.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- OpenTelemetry, [Zero-code instrumentation](https://opentelemetry.io/docs/zero-code/) — what
  auto-instrumentation is and where it sits, and why it observes the client rather than the application. The
  second half of this lesson is the part of that page a vendor page cannot tell you.
- OpenTelemetry, [Semantic conventions for generative AI
  systems](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — the attribute names this repo uses, and the
  Development status that makes owning the three hand-written spans cheap rather than a burden.
- MLflow, [Tracing for LLM and Agent Observability](https://mlflow.org/docs/latest/genai/tracing/) — the
  one-line `mlflow.openai.autolog()` shape, and its own manual-instrumentation path alongside it. A vendor
  shipping both is making the same argument this lesson makes: the automatic half and the hand-written half
  are for different questions.
- OpenTelemetry Python contrib,
  [instrumentation packages](https://opentelemetry-python-contrib.readthedocs.io/en/latest/instrumentation/index.html)
  — the list of libraries that can be patched for you, which is also the list of libraries whose internals
  decide what your trace looks like.