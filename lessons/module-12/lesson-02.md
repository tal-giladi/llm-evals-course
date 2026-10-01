---
id: "12.2"
module: 12
minutes: 20
practice_minutes: 45
prerequisites: ["12.1"]
objectives:
  - Write the ten `gen_ai.*` and `error.type` attribute names from memory and say what question each one answers.
  - Explain what a semantic convention is a contract *of*, and why the attribute name rather than the JSON is the part other tools depend on.
  - Demonstrate, from this lab, that renaming one attribute to a name your own code also uses silently zeroes a panel, and say which panel and why.
  - Say what the upstream "Development" status obliges you to do before an upgrade, and what a rename costs you.
volatility: implementation
sources:
  - title: "OpenTelemetry — Generative AI semantic conventions: spans"
    url: https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/
  - title: "OpenTelemetry — Generative AI semantic conventions: agent spans"
    url: https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/
  - title: "OpenTelemetry — Attribute naming"
    url: https://opentelemetry.io/docs/specs/otel/common/attribute-naming/
last_verified: "2026-10-01"
---

# 12.2 · The GenAI semantic conventions

The span tree from [12.1](lesson-01.md) is a shape any backend can draw. What makes a trace readable by
*any* backend is the attribute names on it, and those names are a published, versioned contract — this
lesson is about what that contract buys you, what it costs when you ignore it, and what its current
status obliges you to do before an upgrade.

## Why it matters

A team instruments their support bot. They are competent. They name the token counts `prompt_tokens` and
`completion_tokens`, because that is what the model provider's API calls them, and `model`, because that
is what it is. Their code is consistent, their tests pass, and their own dashboard renders.

Eight months later somebody points the same pipeline at a hosted tracing backend, because the local one
has no retention policy. The dashboard comes up empty and stays empty. The backend is looking for
`gen_ai.usage.input_tokens`; the traces carry `prompt_tokens`. Not one span is malformed. Not one span is
rejected. Every span is *there* and every panel reads zero, which is a shape of failure the team has
never seen before because they have never had a consumer they did not write.

Then the cost panel, which they did build, quietly starts telling a different story. It is not empty —
it is **wrong in a direction nobody checks**. Price the same twenty requests under their own names and
under the convention's:

| | Input tokens | Output tokens | Cost |
|---|---|---|---|
| `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens` | 584 | 393 | **$0.00005289** |
| `prompt_tokens` / `completion_tokens` | **0** | 393 | $0.00003537 |
| `gen_ai.*` / `completion_tokens` | 584 | **0** | $0.00001752 |

A third of the spend has vanished from one column and two thirds from the other, and in both cases the
remaining number is *lower*, which is what an efficiency improvement looks like. A cost panel that falls
is a cost panel nobody investigates.

There is a third failure in the same family, and it is the reason this lesson is not optional. Rename
`gen_ai.request.model` to `model` — a name that is not wrong in any way a reviewer would object to — and
the token counts are untouched, because they are a different attribute. The cost does not fall. It
**triples**: $0.00005289 becomes $0.00015665 on the same traces, because a span with no recognised model
name falls through to the price sheet's default row. And `cost_by_model()` now reports a single bucket
called `None`. The team will spend a week arguing about a price increase that is a naming change.

> [!IMPORTANT]
> **The contract is the name, not the JSON.** Your backend does not read your traces because they are
> well-formed JSON; it reads them because the attribute is spelled `gen_ai.usage.input_tokens`. The
> structure is yours to choose — `evallab` writes JSONL and an OTLP exporter writes protobuf, and a
> backend reads both — but the key is the API. A semantic convention is a promise that a given key will
> mean a given thing to a reader you have never met, and it is the reason a trace written once can be read
> by tooling that was written by somebody else, for a model you have not switched to yet.

## How it works

### The eight names, and the question each one answers

The conventions are [status **Development**
upstream](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/), which is the subject of the
last section of this lesson. The names this lab emits, and the question each one exists to answer:

| Attribute | Value here | The question it answers |
|---|---|---|
| `gen_ai.system` | `local` | *which provider's vocabulary is this?* `openai`, `anthropic`, `local` |
| `gen_ai.operation.name` | `chat`, `execute_tool` | *what kind of call was this?* the span's own name is free text; this is the closed set |
| `gen_ai.request.model` | `qwen3-1.7b` | *what did you ask for?* the key to the price sheet |
| `gen_ai.response.model` | `qwen3-1.7b` | *what actually answered?* — a router can send these to different models, and only this one tells you |
| `gen_ai.usage.input_tokens` | `28` | *what did it cost to ask?* |
| `gen_ai.usage.output_tokens` | `15` | *what did it cost to answer?* |
| `gen_ai.tool.name` | `retrieve_handbook` | *which tool ran?* |
| `gen_ai.tool.call.id` | `tr_s01-002` | *which invocation?* — two calls to the same tool in one trace |
| `gen_ai.conversation.id` | `s-demo` | *which conversation?* the grouping key for a session view |
| `error.type` | `no_handbook_citation` | *did it fail, and how?* the one attribute every backend reads first |

Two design choices in that table are worth stating because they are the ones teams get wrong.

**`gen_ai.operation.name` is a closed set; the span's `name` is not.** A span called
`call qwen3-1.7b for user 4471` is legal OTel and useless: it has high cardinality, it embeds a user id,
and no query can select on it. `gen_ai.operation.name: chat` is what a backend filters on. `name` is for
humans reading a waterfall, `operation.name` is for the query you will actually write.

**`error.type` is a convention, not an OTel field.** It is defined by the *general* error conventions and
every backend in the ecosystem reads it, which is exactly why renaming it to `error` costs you the entire
error surface. And its **value** is a low-cardinality string — `no_handbook_citation`,
`unsupported_addition`, `RuntimeError` — never a message, never a stack trace. A value that is unique per
occurrence is a dimension nobody can group by.

### What the twenty dev traces actually carry

Counting every attribute across the twenty traces of the 10%-failure run, with **78 spans**:

| Attribute | Spans out of 78 | Why that number |
|---|---|---|
| `evallab.simulated_latency` | 78 | every span, always — the provenance flag |
| `gen_ai.operation.name` | 40 | the 20 tool spans and the 20 chat spans |
| `gen_ai.usage.input_tokens` | **18** | not on the 2 failed calls |
| `gen_ai.usage.output_tokens` | **20** | on all 20, **including the 2 failures, which record 0** |
| `gen_ai.request.model` | 20 | every chat span names what it asked for |
| `gen_ai.response.model` | 18 | only set once the model has actually answered |
| `gen_ai.output.messages` | 18 | same — the answer text, and the thing [12.5](lesson-05.md) redacts |
| `gen_ai.system` | 20 | every chat span |
| `gen_ai.conversation.id` | 20 | on all 20 root spans |
| `gen_ai.tool.name`, `gen_ai.tool.call.id` | 20 each | one retrieval per request |
| `retrieved` | 20 | **not a convention** — an attribute only this app can emit |
| `question` | 18 | **not a convention** — and a very good example of what not to ship |
| `error.type` | 9 | 2 `agent` + 2 `chat` + 5 `chain` |

Three rows in that table are the lesson.

**Absence and zero are different, and the conventions tell you which to use.** `input_tokens` is *absent*
on a failed call — this app never sent a prompt, so there is nothing to count. `output_tokens` is
*present and zero* — the call was made and produced nothing. `test_model_spans_carry_model_and_tokens`
asserts both, with the reason in the docstring: *inventing a number for [a failed call] would inflate the
cost panel with the price of an error*. A backend that counts "spans reporting output tokens" and a
backend that counts "non-zero output tokens" answer different questions, and only one of them is
"how many answers did we get".

**Three of the fourteen keys are not conventions at all**, and that is not a defect. `retrieved: 1` is
the fact that only *your* code knows — whether the right text was in front of the model — and it is on
the span for the same reason the post-check is on the span. `question` is the counter-example on the same
page: it is the one attribute in the list that ships customer text to a third party, and it got there
because nothing in the conventions forbade it. **The conventions standardise the parts everybody shares;
the parts that are yours are your responsibility, and so is everything they let through.**

### The rename experiment

Take the same 78 spans, rename exactly one attribute in each, and read the same panels:

| Renamed | In | Out | Cost | `chat` errors | `chain` errors |
|---|---|---|---|---|---|
| *(nothing — conventions)* | 584 | 393 | $0.00005289 | **2** | **5** |
| `gen_ai.usage.input_tokens` → `prompt_tokens` | **0** | 393 | $0.00003537 | 2 | 5 |
| `gen_ai.usage.output_tokens` → `completion_tokens` | 584 | **0** | $0.00001752 | 2 | 5 |
| `gen_ai.request.model` → `model` | 584 | 393 | **$0.00015665** | 2 | 5 |
| `error.type` → `error` | 584 | 393 | $0.00005289 | **0** | **0** |

Every row is the same traces, the same items, the same seed. Four different panels are wrong in four
different ways, and **not one of them raises an error**, because a convention violation is not a type
error — it is an absent key, and an absent key reads exactly like a value of zero.

The last row is the one to sit with. Renaming `error.type` to `error` changes the cost by **nothing** —
$0.00005289 either way — and destroys the entire error surface: every rate reads `0.0%`. The trace looks
perfect. It is a trace of a system that had two requests fail and recorded both, and reported success on
both. [12.3](lesson-03.md) reaches the same 0.0% from the opposite direction — there the spans are
*thrown away*; here they are written down and nobody can read them. **Two completely different bugs, the
same number, and a dashboard cannot tell you which one you have.**

### The status, and what it obliges you to do

The `Tracing API` this module builds on is marked **Stable**. The **GenAI semantic conventions are marked
Development**, and the *general* convention they now depend on — `gen_ai.operation.name` — was itself
introduced as a **rename** of an earlier key.

That is not a hypothetical. It happened. The honest reading of a Development-status spec is:

1. **Pin the version you wrote against.** This package records it in `__version__` and in the code
   comment at the top of [`tracing.py`](../../labs/common/evallab/tracing.py). An unpinned trace format
   is a trace format that changes when somebody runs `pip install -U`.
2. **Read the changelog before you upgrade, every time**, and expect attribute *renames*, not only
   additions. `gen_ai.usage.input_tokens` is currently the name; it is the sort of key that a
   Development-status spec may move, and when it does, your traces from before and after describe the
   same requests and read as two different systems.
3. **Treat a rename as a breaking change to your traces, not a refactor.** A rename does not break the
   code that *writes* the attribute — it breaks the queries, dashboards and saved views that *read* it,
   which is where nobody looks in a code review.
4. **Keep the names in one place.** The ten `GEN_AI_*` constants and `ERROR_TYPE` at the top of
   [`tracing.py`](../../labs/common/evallab/tracing.py) exist so a rename has a surface you can grep. A
   `grep -r 'gen_ai'` that returns 40 hits is not a rename, it is an archaeology.

> [!WARNING]
> **Every figure on this page comes from a simulation.** The attribute names are the real convention
> names; the traces they sit on carry `evallab.simulated_latency: true`, the token counts are
> `len(text) / 4` estimates rather than a tokenizer's output, and the price sheet is illustrative
> per-million-token pricing for small open models. The *arithmetic* — the arithmetic is real, it runs on
> your machine, and the four wrong panels are computed from the shipped code. The prices are not a quote
> from anyone, and the durations are not a measurement of a model in the wild.

## Show me

[Lab: evallab package](../../labs/common/)

Instrument twenty dev requests with a 10% planted failure rate and read the store:

```
cd labs/common
set PYTHONPATH=.            # Windows PowerShell; on bash: export PYTHONPATH=.
py -m evallab.cli trace --n 20 --fail-rate 0.1 --out traces.jsonl
```

The names above are not a table you take on trust; they are the keys in that file. Read them:

```
py -c "import json,collections; c=collections.Counter(); [c.update(s['attributes'].keys()) for l in open('traces.jsonl') for s in json.loads(l)['spans']]; [print(f'{v:3d}  {k}') for k,v in sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))]"
```

```
 78  evallab.simulated_latency
 40  gen_ai.operation.name
 20  gen_ai.conversation.id
 20  gen_ai.request.model
 20  gen_ai.system
 20  gen_ai.tool.call.id
 20  gen_ai.tool.name
 20  gen_ai.usage.output_tokens
 20  retrieved
 18  gen_ai.output.messages
 18  gen_ai.response.model
 18  gen_ai.usage.input_tokens
 18  question
  9  error.type
```

That is the census above, from the file the exporter just wrote, with nothing from this page in it. Eleven
of the fourteen keys are convention names, two belong to this lab — `evallab.simulated_latency`, which
is its provenance flag, and `retrieved` — and one is the customer text that should not be there.

Then do the rename yourself and watch a panel go to zero — this is the whole lesson in one command:

```
py -c "import sys; sys.path.insert(0,'.'); from evallab import TraceStore, load, record; d=load('support'); t=record(d,n=20,split='dev',fail_rate=0.10,seed=1); good=TraceStore.from_traces(t); bad=TraceStore.from_traces([{'trace_id':x['trace_id'],'spans':[{**s,'attributes':{('prompt_tokens' if k=='gen_ai.usage.input_tokens' else k):v for k,v in s['attributes'].items()}} for s in x['spans']]} for x in t]); print('input tokens:', good.total_tokens()['input'], '->', bad.total_tokens()['input']); print('cost:', good.total_cost(), '->', bad.total_cost()); print('chat errors:', good.error_rate()['chat'], bad.error_rate()['chat'])"
```

```
input tokens: 584 -> 0
cost: 5.289e-05 -> 3.537e-05
chat errors: {'errors': 2, 'spans': 20, 'rate': 0.1} {'errors': 2, 'spans': 20, 'rate': 0.1}
```

**584 input tokens became 0, and the run got a third cheaper.** Nothing raised. The file on disk is
complete, every span is well-formed, and the number on the dashboard is wrong in the one direction that
looks like good news.

Finally, the tests, including the two that hold the shape of the contract:

```
py -m pytest tests/test_tracing.py -q
```

```
.......................                                                  [100%]
23 passed in 0.08s
```

`test_model_spans_carry_model_and_tokens` asserts a chat span always names its model and that a failed
call reports **zero** output tokens rather than an invented number.
`test_tool_spans_name_their_tool` asserts every `execute_tool` span carries a `gen_ai.tool.name`.

## Try it

**Predict first**, on paper:

1. You rename `gen_ai.usage.input_tokens` to `prompt_tokens` on every span. Which of these change — token
   count, cost, error rate, latency — and by how much? Which do not move at all, and why is that the more
   dangerous answer?
2. `gen_ai.request.model` is renamed to `model`. The token counts are a different attribute, so they do
   not move. What happens to the cost, and in which direction?
3. Two traces in a file, one written before an upgrade and one after, and a key was renamed between them.
   What does a query grouped by model report?

[Lab: evallab package](../../labs/common/)

1. **Build the census yourself and predict each row.** Run the `py -c` command from *Show me* three
   times: `--fail-rate 0`, `--fail-rate 0.1` and `--fail-rate 0.5`. `gen_ai.usage.input_tokens` lands on
   **20, 18 and 9** of the 20 chat spans, and `gen_ai.usage.output_tokens` lands on **20, 20 and 20**.
   Predict all six before you run anything, then say in one sentence why output tokens and input tokens
   behave differently on a failed call.
2. **Break one name at a time.** Write a small script that takes a trace list and renames one attribute,
   then print `total_tokens()`, `total_cost()` and `error_rate()` for: `input_tokens`, `output_tokens`,
   `request.model`, `error.type`. Fill in this table from your own runs and check it against the one in
   *The rename experiment*:

   | Renamed | Input | Output | Cost | `chat` errors |
   |---|---|---|---|---|
   | *(none)* | | | | |
   | `input_tokens` | | | | |
   | `output_tokens` | | | | |
   | `request.model` | | | | |
   | `error.type` | | | | |

3. **Find the one attribute that is yours.** Of the fourteen keys in the census, three are not convention
   names. Name them, say what question each answers, and say which of the three you would be most nervous
   about shipping to a third-party backend unchanged.
4. **Ask what the names have to be, not what they are.** `gen_ai.operation.name` takes `chat` and
   `execute_tool`; `error.type` takes `no_handbook_citation` and `RuntimeError`; `gen_ai.system` takes
   `local`. Write down the property all three share — the thing that makes grouping possible and high
   cardinality fatal — and then name an attribute on this app that would break it if you gave it an id.
5. **Write the upgrade note.** Pretend you depend on `gen_ai.usage.input_tokens` and a release renames it.
   Write the four-line checklist you would follow before upgrading, and then find the thing on your
   dashboard that the rename breaks and which no test would catch.

## Break it

**Rename `gen_ai.usage.input_tokens` to `prompt_tokens`.** Input tokens read 0 of 584; cost falls from
$0.00005289 to $0.00003537, a third cheaper, with no code change anywhere. Nothing raises, nothing warns,
the export succeeds. The lie: **a cost panel that falls is a cost panel nobody investigates**, and this
one falls because it can no longer see what you paid to ask.

**Rename `gen_ai.usage.output_tokens` to `completion_tokens`.** Output reads 0; cost falls to
$0.00001752, two thirds gone. Worse than the first, because a panel with no input and no output tokens
reads as *a model that answers instantly and for free*, which is a claim somebody will put in a
roadmap. The lie: **a missing dimension does not read as missing, it reads as zero**, and zero is the
value that means "we checked".

**Rename `gen_ai.request.model` to `model`.** Tokens unchanged — the counts are a different attribute.
Cost **triples** to $0.00015665, because an unrecognised model falls through to `DEFAULT_PRICE`, and
`cost_by_model()` returns one bucket keyed `None`. The lie: **a price sheet's default row is not a price,
and landing in it looks exactly like the model becoming more expensive.** This one is the most expensive
to diagnose, because it is the only rename here that makes the number go *up*, and teams have a story
ready for a price increase.

**Rename `error.type` to `error`.** Every error rate on the page reads `0.0%`. Cost, tokens and latency
are all untouched, so the dashboard's *health* tiles are perfect. The lie: **a dashboard reporting zero
errors because it cannot read the name is indistinguishable from a dashboard reporting zero errors
because there were none** — and on the day the real answer is the second one, you ship a quarter of
uncited answers.

**Publish the price sheet and forget the version.** Nothing is renamed, nothing breaks, and in six months
a dependency upgrade moves the conventions underneath you. The lie: **an unpinned trace format is a trace
format that changes when somebody runs `pip install -U`**, and no test in this lab can see it happen.

## Fix it

1. **Define every name once, as a constant, and never inline the string.** The ten `GEN_AI_*`
   constants and `ERROR_TYPE` at the top of [`tracing.py`](../../labs/common/evallab/tracing.py) exist
   so a rename has a surface you can grep. A `grep -r 'gen_ai'` that returns 40 hits is not a rename,
   it is an archaeology.
2. **Write a test that reads the attribute back through the convention name.** `TraceStore` queries by
   `s.attributes.get(GEN_AI_REQUEST_MODEL)`; a test that asserts every chat span answers to
   `s.model` catches a rename on the day it is made rather than the day somebody looks at the dashboard.
3. **Treat an absent key as a gap, not a zero, in your own code.** `Span.input_tokens` uses
   `.get(..., 0)` because a cost calculation needs a number — so the *display* has to say which spans
   were counted. Print "584 across 18 of 20 chat spans" and the ambiguity is gone.
4. **Record `error.type` values from a closed set of your own, listed somewhere.** The post-check in
   [`observe.py`](../../labs/common/evallab/observe.py) writes exactly two — `no_handbook_citation` and
   `unsupported_addition` — plus `RuntimeError` for a call that raised.
   `no_handbook_citation` is a fact; `f"citation missing in {section}"` is a log message, and the second
   one cannot be grouped by.
5. **Pin the convention version next to the code that writes it, and re-read it before every upgrade.**
   A one-line comment at the top of the module, a line in the changelog, and a diff of the attribute
   registry. That is the entire Development-status workflow.
6. **Distinguish your attributes from the convention's in review.** `retrieved` is yours and it is
   valuable. `question` is yours and it is a problem. The conventions do not review either for you.
7. **Put the conventions in a dashboard contract, not a style guide.** "`gen_ai.*` only" is a lint rule;
   "a hosted backend must be able to compute cost and error rate from our traces without custom code" is
   a test, and it is the one that catches a rename.

## How do I know it works?

**Challenge, on dev.** Run the 20 dev traces at `--fail-rate 0.1` and require all four of these:

- **Every one of the ten names resolves through `TraceStore`.** `st.total_tokens()` returns
  `{input: 584, output: 393}`, `st.cost_by_model()` returns `{'qwen3-1.7b': 5.289e-05}` with that exact
  key, and `st.error_rate()` reports `chat 2/20` and `chain 5/18`. If any of those reads zero, the name
  is wrong, not the data.
- **A rename changes exactly the panel it should.** Do the four renames and reproduce the table in *Try
  it*. You are checking that your code is *sensitive* to the names — a tracer that produces the same
  numbers whichever way you spell them is not reading the convention, it is coincidentally agreeing.
- **Every error rate has a denominator you can name.** `chat 2/20` not `2/78`. A pooled rate over all
  spans is not a rate; it is a ratio of things with different meanings.
- **Your own attributes are labelled as yours.** Three names in the census are not convention names. Say
  which is which in a comment, because the reviewer who has to redact one of them will start from the
  ones you flagged.

**Then one held-out read**, on the **37 `test_ids`**, which is where a name stops being a convention and
becomes a contract:

| | First 37 dev | Held-out 37 |
|---|---|---|
| Traces / spans | 37 traces, 144 spans | 37 traces, **145 spans** |
| Tokens read through `gen_ai.usage.*` | 1143 in / 806 out | **1275 in / 916 out** |
| `chat` spans | 37 | 37 |
| `chat` spans carrying `input_tokens` | **33** (4 raised before a prompt was sent) | **34** (3 raised) |
| `chat` spans carrying `output_tokens` | 37 (the 4 failures record 0) | 37 (the 3 failures record 0) |

The last two rows are the whole lesson. **Four dev traces and three held-out traces are chat spans with
no `input_tokens` attribute at all, and every single chat span carries an `output_tokens`.** If you had
written the failed calls' input count as `0` instead of omitting it — which every instinct says to do,
and which the test forbids — then a backend counting "chat spans reporting tokens" would report 37 on
both splits and a backend counting "non-zero" would report 33 and 34. Neither number is wrong. They
answer different questions, and the conventions exist so that the question you are asking is written
down in the name.

## Use / don't use

**Do use the convention names for everything another tool will read.** Model, tokens, tool name,
conversation id, error type. That is the whole shared surface.

**Do use your own names for everything only you can know.** `retrieved`, the handbook section id, the
check that produced the rejection. The conventions deliberately do not cover these, and pretending they
do is how you end up either shipping customer text or shipping nothing useful.

**Do keep values low-cardinality.** Grouping is the only thing a backend does well, and it can only
group values that repeat.

**Do pin and diff.** Development status means *expect renames*, and a rename is invisible to your tests
because nothing in your code is wrong.

**Don't invent a namespace.** `llm.tokens` looks reasonable and is a private API you will maintain
forever. If you genuinely need a local extension, put it under `gen_ai.` only if the spec has blessed it,
and put everything else in your own namespace so the two are separable.

**Don't put a price in an attribute.** `gen_ai.usage.input_tokens` is the contract. Cost is
derived — this package computes it in `Span.cost_usd` from the model name and the token counts — and a
stored price goes stale the moment the sheet changes, which is [12.5](lesson-05.md)'s subject.

**Don't upgrade a Development-status dependency in a release that also changes behaviour.** One change
at a time, so that when the panel moves you know which one moved it.

What teams actually do in production: keep the convention names in one small module, add a test that
asserts every chat span answers to the model and token accessors, record the spec version in the
service's own metadata, and re-read the registry page before every dependency bump. The names are not
the interesting part of tracing and they are the part that quietly rots.

## Reflect

1. Renaming `error.type` to `error` and dropping failed traces both make every error rate read `0.0%`.
   Write the one question you would ask a dashboard to tell those two apart, and say what you would have
   to record on every span to make the question answerable.
2. Your cost panel reads `$0.00005289` and you are about to present it next to last month's
   `$0.00005892`. Write the two sentences you would put in the document explaining the 10.2% drop, and
   say what you would need to see on the panel to know whether it was a real saving or the
   `input_tokens` rename from *Break it*.
3. The conventions are marked **Development** and `gen_ai.operation.name` was itself a rename. Write the
   paragraph you would put in a design document explaining what a team is accepting by depending on it,
   including what it costs and what it buys.

## Sources

- OpenTelemetry, [Generative AI semantic conventions:
  spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) — the attribute registry this
  lesson's table is transcribed from, and the page whose **Development** status is the reason for the
  pinning discipline above.
- OpenTelemetry, [Generative AI semantic conventions: agent
  spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) — the `agent` root span
  and how a multi-step request nests under it, which is the shape [12.3](lesson-03.md) instruments by hand.
- OpenTelemetry, [Attribute
  naming](https://opentelemetry.io/docs/specs/otel/common/attribute-naming/) — the upstream rule behind
  the closed-set half of the "name versus `operation.name`" distinction, and behind why cardinality in a
  value is a cost.