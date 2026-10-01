---
id: "12.1"
module: 12
minutes: 20
practice_minutes: 50
prerequisites: ["11.1"]
objectives:
  - Read a span tree end to end and say, for any span, what its parent was, how long it took and which attributes make it a measurement rather than a log line.
  - Name the six fields every span carries and say which two of them turn a list of records into a tree you can reason about.
  - Reproduce the whole cost of a 20-request run from the token counts on the chat spans, by hand, with the price sheet open beside you.
  - Say which questions this lesson deliberately does not answer, and why deferring them does not block modules 13 and 14.
volatility: implementation
sources:
  - title: "OpenTelemetry Specification — Tracing API"
    url: https://opentelemetry.io/docs/specs/otel/trace/api/
  - title: "OpenTelemetry Specification — Trace"
    url: https://opentelemetry.io/docs/specs/otel/trace/
  - title: "OpenTelemetry — Generative AI semantic conventions: spans"
    url: https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/
last_verified: "2026-10-01"
---

# 12.1 · OpenTelemetry in twenty minutes

Instrumenting your app before you can measure it is the last piece of machinery between the eval suite
you can run and the production system you can gate. This lesson teaches the whole tracing model in one
page — a trace is a tree of timed spans — and stops deliberately short of collectors, sampling policies
and vendors, because none of them are needed to read what your app already did.

## Why it matters

A team has done everything in [11.1](../module-11/lesson-01.md). They have a suite that runs in a second
on a laptop and in CI. They put it on the support bot. It says the answers are bad. Now they have to
find out *why*, and the only record the app keeps is one log line per request: a user id and the text of
the answer.

That record is enough to be annoying and not enough to be useful. It cannot separate the twenty
requests that interleaved on a busy afternoon, because nothing on the line is a request id. And it
cannot say **what the system did to produce the answer** — which is the entire subject of
[02.1](../module-02/lesson-01.md), where the failure was that a bad answer and an answer produced from
no evidence at all look identical in text.

The size of that gap is not abstract on this app. Take twenty dev requests. Five of them — **25.0%** —
produce an answer the post-check rejects, with `error.type: no_handbook_citation` on the span. That is
one answer in four that a person would have to open. Not one line in the log says so, because the
post-check runs after the answer has been returned and nothing else records what it found.

There is a second gap that costs the team a day. The dashboard says **p95 2404 ms**. Every request over
two seconds looks identical on that panel, and they cannot tell whether the time went into the model
call or into their own code. The honest answer, which nobody can get from a histogram keyed on a log
line, is that **94.8% of a median request is the model call** — a fact about their provider, not about
their code, and a completely different ticket depending on which one it turns out to be.

Both gaps close the moment the app emits a tree instead of a line. Not a vendor, not a collector — a
tree.

> [!IMPORTANT]
> **Why this module sits where it does.** [10.3](../module-10/lesson-03.md) taught that a gate needs the
> width of its measurement beside the threshold, and module 13 puts that gate in CI. A CI job runs against
> production traffic, and production traffic that is not traced is a CI job asserting something nobody can
> check when it goes red. Tracing is not a nice-to-have layer on top of the eval loop; it is the thing the
> loop runs on.

## How it works

### The entire model

A **trace** is one request. A **span** is one timed operation inside it. That is all.

| Field | What it is | In [`tracing.py`](../../labs/common/evallab/tracing.py) |
|---|---|---|
| `name` | what the operation was | `support.answer`, `retrieve_handbook`, `generate answer` |
| `span_id` | this span's identity | `tr_s01-004` |
| `parent_id` | the span it happened inside, or `null` for the root | `tr_s01-001` |
| `kind` | what *kind* of operation it was | `internal`, `agent`, `execute_tool`, `chat`, `chain` |
| `duration_ms` | how long it took | `2364.48` |
| `attributes` | the key–value facts about it | `gen_ai.usage.input_tokens: 28` |

**Two of those six do the real work.** `parent_id` is what makes it a tree rather than a list — with it,
"the post-check ran *after* generation" is a fact you can read; without it you have four records that
happened to arrive together. `kind` is what makes the error rate a **ranking** rather than a number:
`2/20 chat spans failed` tells you where to look, and `2/20 spans failed` tells you almost nothing,
because you do not know what the denominator is made of. The remaining four are a name, an id, a number
and a dict, and any one of them alone is a log line.

The `Tracing API` specification says a span carries a name, a `SpanContext`, a parent, a `SpanKind`, a
start and end timestamp, attributes, links, events and a status. This package carries the first six and
leaves the rest out, which is enough for an LLM app and is the subject of the rest of this module.

### One trace, read the way you would read it in a debugger

```
[agent] support.answer  2441.371ms
  [execute_tool] retrieve_handbook  57.446ms
  [chat] generate answer  2364.48ms  28in/15out  $0.000002
  [chain] citation check  10.876ms  ERROR no_handbook_citation
```

Four lines, and every one of them answers a question. Do the arithmetic so the tree stops being a
picture.

**The root contains its children.** `57.446 + 2364.48 + 10.876 = 2432.802` ms of children inside a
`2441.371` ms root, leaving `8.569` ms of the request for everything the spans do not name. That is a
*requirement*, not a coincidence: a root that reported less than its own children would make the
waterfall a lie, because the slowest step on the page would be longer than the request that contains
it. `Tracer.span` enforces it — on exit, a root span sets its duration to its children's total plus its
own — and `tests/test_tracing.py` checks the parent links resolve.

**The model is the app.** `2364.48 / 2441.371` is **96.9%** of this request. Across twenty requests the
ratio is `p50 model call 1228.9 ms / p50 end-to-end 1296.8 ms` = **94.8%**. That is the sentence the
`p95 2404 ms` log-line histogram cannot say, and it is worth a day's debugging saved.

**The cost is the tokens and a price sheet.** The chat span says `28in/15out`. The sheet in
[`tracing.py`](../../labs/common/evallab/tracing.py) prices `qwen3-1.7b` at $0.03 per million input
tokens and $0.09 per million output tokens:

```
28 * 0.03 + 15 * 0.09 = 0.84 + 1.35 = 2.19   ->   $0.00000219
```

Do the whole run the same way. Twenty requests, 656 input and 436 output tokens:

```
656 * 0.03 + 436 * 0.09 = 19.68 + 39.24 = 58.92   ->   $0.00005892
```

That is the shipped number to the cent, and you produced it with a calculator. **Nothing in this module
is a vendor integration — cost is arithmetic on two integers and a price sheet, and any backend that
can multiply can do it.**

**The failure is on the fast span.** `citation check 10.876ms ERROR no_handbook_citation`. It is the
quickest thing on the page and the only thing that failed. Lesson [02.1](../module-02/lesson-01.md)
again: a post-check that fires is invisible in a latency panel, because a post-check that fires is
*fast*.

### The four span kinds are the denominator

`kind` is not decoration. Twenty clean dev requests carry **80 spans, four each**:

| Kind | Spans | What it buys you |
|---|---|---|
| `agent` | 20 | the request as a whole; the session it belongs to |
| `execute_tool` | 20 | whether the right text was in front of the model |
| `chat` | 20 | tokens, model, price, latency |
| `chain` | 20 | **what the post-check concluded** |

Take the same twenty requests with 10% of the model calls made to fail, and `chain` drops to **18** — 78
spans, not 80. A request that raised inside the chat span never reaches the post-check, so the check did
not run and emitted no span. You learn that from a count, not from a hypothesis — and
[12.3](lesson-03.md) is about what happens when even those 18 are not enough.

### What this lesson is not

Being explicit, because the module is easy to over-build:

- **No collector.** Nothing here listens on a port. `export` writes JSONL.
- **No sampling configuration.** Sampling exists (`should_sample`) and is deterministic, but it is
  [12.5](lesson-05.md)'s subject, not this page's.
- **No vendor, no OTLP, no MLflow.** `export` *tries* OTLP and MLflow if they happen to be importable and
  **prints which ones it skipped**, which is the behaviour you want from every exporter:

  ```
  wrote 20 trace(s) to traces.jsonl
    skipped otlp: not installed or no OTEL_EXPORTER_OTLP_ENDPOINT
    skipped mlflow: not installed
  ```

- **No dependency.** The tracer is a dataclass and a context manager. If the learners who could not
  afford an API key in module 11 needed a collector daemon, this module could not exist.

The dependency-free choice is not a simplification for teaching. **The part you own is the
instrumentation; the backend is a place to put the result.** A team that can only read its own
instrumentation can tell whether it is lying.

> [!WARNING]
> **The durations in this lab are simulated, and every span says so.** This app answers from recorded
> outputs, so a real clock would report sub-millisecond spans and the `p50 1297 ms` above would be a
> column of zeros. `Tracer._sim_ms` draws from fixed ranges — `chat` 180–2400 ms, `execute_tool` 8–90 ms,
> `chain` 2–30 ms — chosen to resemble a small local model plus a vector search, and **every span carries
> `evallab.simulated_latency: true`** so nothing downstream can mistake them for measured. The *shape* of
> the p50/p95 arithmetic is real: the percentiles, the root-contains-its-children rule and the 96.9% share
> are all computed for real on these numbers. The *numbers* are representative, and nothing in this module
> was measured against a live model.

## Show me

Everything runs from [`labs/common/`](../../labs/common/) with the package on the import path. On Windows
`py` is the interpreter; on macOS and Linux it is `python3`.

[Lab: evallab package](../../labs/common/)

```
cd labs/common
set PYTHONPATH=.            # Windows PowerShell; on bash: export PYTHONPATH=.
py -m evallab.cli doctor
```

Then instrument twenty requests and read the panel:

```
py -m evallab.cli trace --n 20 --fail-rate 0.1 --out traces.jsonl
```

```
20 traces, 78 spans
  cost      $0.0001 total  qwen3-1.7b $0.0001
  tokens    584 in / 393 out (977 total)
  latency   p50 1297 ms, p95 2404 ms end-to-end
  errors    9 span(s) with an error.type

wrote 20 trace(s) to traces.jsonl
  skipped otlp: not installed or no OTEL_EXPORTER_OTLP_ENDPOINT
  skipped mlflow: not installed

backends: jsonl yes, otlp no, mlflow no - install one and re-run to ship these spans.
```

**Read that top to bottom.** 78 spans over 20 traces is not 80, and the two missing ones are the
`chain` spans of the two requests that raised. `9 span(s) with an error.type` is `2 agent + 2 chat +
5 chain`: one error marks every span in the stack that unwound, which is why the total is larger than the
number of failed requests and why the rate that means anything is the one computed *per kind*.

Now the model itself, one trace:

```
py -m evallab.cli trace --n 20 --tree tr_s26
```

```
[agent] support.answer  2168.798ms
  [execute_tool] retrieve_handbook  29.32ms
  [chat] generate answer  2131.38ms  26in/15out  $0.000002
  [chain] citation check  2.616ms  ERROR no_handbook_citation
```

`26in/15out $0.000002` is the same calculation as above with 26 instead of 28:
`26 * 0.03 + 15 * 0.09 = 0.78 + 1.35 = 2.13`, so $0.00000213, printed to six places as `$0.000002`.

And the tests, which are the check that the numbers above are still the numbers you wrote:

```
py -m pytest tests/test_tracing.py -q
```

```
.......................                                                  [100%]
23 passed in 0.08s
```

Twenty-three tests, and they are not all "does a span exist". `test_every_trace_is_a_root_with_children`
asserts exactly one root per trace and that every `parent_id` points at a real span;
`test_the_four_span_kinds_are_present` asserts the four kinds are all there;
`test_durations_are_non_negative_and_nested` asserts a child never starts before its parent. **Those are
the properties that make a trace worth keeping, and each one is a production failure somebody has had.**

> [!NOTE]
> Every span in this lesson carries `evallab.simulated_latency: true` and every price is an illustrative
> per-million-token figure for a small open model. The arithmetic is real and runs on your machine; the
> durations and the price sheet are representative, and nothing here is a measurement of a named model or
> a named product in the wild.

## Try it

**Predict first**, on paper, before you run anything:

1. One request takes `2441.371` ms and its three children take `57.446`, `2364.48` and `10.876` ms. Is the
   root allowed to be *smaller* than the sum of its children? What would a reader conclude if it were?
2. Twenty requests produce 80 spans. Ten percent of the model calls are made to fail. How many spans do
   you get, and which kind is missing?
3. A chat span says `28in/15out`. Your price sheet says $0.03/M input and $0.09/M output. What is the
   call worth, and how would that number change if the sheet had the prices the other way round?

[Lab: evallab package](../../labs/common/)

1. **Read three traces by hand before you read the panel.** Run
   `py -m evallab.cli trace --n 20 --tree tr_s01`, then `tr_s02`, then `tr_s26`, and for each one write
   down: the root's duration, the sum of its children, and the share the `chat` span took. Check that the
   root contains its children every time. Then run
   `py -m evallab.cli trace --n 20 --fail-rate 0.1 --tree tr_s02` and compare: the same request with a
   planted failure is **three lines instead of four**, both the `agent` and the `chat` span carry
   `ERROR RuntimeError`, the chat span reads `0in/0out`, and there is no post-check at all — because the
   exception unwound before it could run.
2. **Count the kinds yourself.** Without trusting the summary, count how many spans of each kind are in
   the file you just wrote:

   ```
   py -c "import json,collections; c=collections.Counter(); [c.update(s['kind'] for s in json.loads(l)['spans']) for l in open('traces.jsonl')]; print(dict(c))"
   ```

   Do it once after re-running the export with `--fail-rate 0` and once with `--fail-rate 0.5`. Which
   kind loses spans, how many, and why that kind specifically? Write the answer as one sentence about
   control flow.
3. **Reproduce the cost total by hand.** Run with `--fail-rate 0` so nothing is lost, note the token
   counts, and reproduce `656 * 0.03 + 436 * 0.09 = 58.92` from the price sheet in
   [`tracing.py`](../../labs/common/evallab/tracing.py). Then run the same arithmetic with the input and
   output prices swapped, and say what a price sheet gets wrong in a way that costs you money.
4. **Find where the time goes.** Take the p50 and p95 end-to-end from the summary, take the p50 and p95
   model call from `TraceStore.latency()`, and compute the ratio. Write the sentence you would put in a
   ticket titled *slow responses*. Then say what you would have to add to the app to tell the remaining
   5.2% apart.
5. **Make the tool lie to you.** `py -m evallab.cli trace --n 20 --tree tr_NOPE` prints a trace — the
   first one — with no warning that your id was not found. Work out where in
   [`cli.py`](../../labs/common/evallab/cli.py) that fallback is, decide whether you would rather it
   printed `no trace with id 'tr_NOPE'` and exited 2, and write the argument for your choice in one
   sentence.

## Break it

**Ship the total without the tree.** `p50 1297 ms, p95 2404 ms` on a panel, no spans behind it. Nothing is
broken; the numbers are correct. The lie: **a latency percentile without a waterfall is a statement about
your app that cannot be acted on**, because "slower" is not a diagnosis and you have no way to find out
which of the three steps grew.

**Sort the spans by duration and never open the fast ones.** On `tr_s26` the rejected answer is the
`citation check` at `2.616ms` — the second-quickest thing on the page. A latency panel ranks by duration,
so the only span that failed never appears near the top. The lie: **a failure that is fast is invisible to
a latency panel**, and a post-check that records its rejections is a rejection that costs nothing to make
and everything to miss.

**Drop the `kind` and keep everything else.** The token counts still add up, the trace still renders, the
file is the same size. The error rate becomes `9/78` with no denominator you can name, and you can no
longer answer the only question the number was for — *which component is failing*. The lie: **a rate with
an unnamed denominator is a number, not a measurement**, and it is always safe to print.

**Ask `--tree` for a trace that is not there.** It prints the first trace instead, silently, with the same
`[agent] support.answer` header and no warning. The lie: **a tool that answers a question you did not ask
is worse than one that refuses**, because the output looks exactly like success. This is lesson
[11.1](../module-11/lesson-01.md)'s rule in a new place: *a missing measurement is not a failure*.

**Round the cost to four decimal places.** `summary()` prints `cost $0.0001 total` for a run that really
cost $0.00005892 — a figure 70% high for the run underneath it. Push it: run `--fail-rate 0.5`, where the
true total is $0.00002409, and the same line prints **`cost $0.0000 total`**. The lie: **a display
precision chosen for one scale is a silent deletion at another**, and at the scale where the cost panel
stops being legible it reads as *free*.

## Fix it

1. **One root per request, and the root must contain its children.** `Tracer.span` already sets a root's
   duration to its children's total plus its own; assert it in a test, the way
   `test_durations_are_non_negative_and_nested` already asserts ordering. A waterfall whose parent is
   shorter than its child is not a waterfall.
2. **Put a `kind` on every span, and make it one of a closed set.** `internal`, `agent`, `chat`,
   `execute_tool`, `chain`. The value of the set is not that it is complete — it will grow — it is that a
   reader can tell what the denominator of an error rate is made of.
3. **Name the operation, not the data.** `generate answer`, not `s01`. The OTel API spec is explicit that
   a span name should identify a *class* of work, not an instance, and `account_id` belongs in an
   attribute. High-cardinality names are how a trace backend bills you.
4. **Record the fact worth measuring, and leave the text behind for [12.5](lesson-05.md).** The
   retrieval span carries `retrieved: 1` and a name; it does not carry the handbook paragraph. Attributes
   like `retrieved` are what turn a support ticket into a dashboard row.
5. **Report a percentile on the root and the same percentile per kind.** `p50 1297 ms end-to-end` alone
   is a fact about a provider. `p50 1229 ms on chat spans` is a fact you can put in a ticket.
6. **Print the precision the number has.** `summary()` formats cost to four places because that suits a
   hosted API, not a 1.7B model on a laptop. One line — `:.8f` — is the difference between a cost panel
   and a cost panel that reads `$0.0000`.
7. **Make an unknown id an error, not a fallback.** `pick = args.tree if any(...) else traces[0]` should
   exit 2 with the list of ids it does have, exactly as `--variant v9` does in [11.1](../module-11/lesson-01.md).

## How do I know it works?

**Challenge, on dev.** Take the first **37 dev items** and the same 10% planted failure rate. A tracer
that reads cleanly on twenty requests has not been shown anything hard:

| | First 37 dev items |
|---|---|
| Traces / spans | 37 traces, **144 spans** |
| Tokens | 1143 in / 806 out (1949) |
| Cost | $0.00010683 |
| Latency | p50 **1601 ms**, p95 2380 ms |
| Error rate by kind | `agent 4/37`, `chat 4/37`, `chain 10/33`, `execute_tool 0/37` |

Four things must be true before you call it done:

- **144 spans over 37 traces, and the shortfall against 37 × 4 = 148 is explained.** Four `chain` spans are
  missing because four requests raised inside the chat span. If you cannot name the four, your tracer is
  dropping spans somewhere else.
- **Every trace has exactly one root and every `parent_id` resolves.** Not "most of them" — all of them.
  A single orphan is a request whose tree you cannot draw.
- **The root contains its children in every trace.** Check it on all 37, not on a sample. The test
  enforces it; a human eye does not.
- **You can name, in one sentence, where the time goes.** Here: `p50 model call / p50 end-to-end` for
  those 37, which is the number the `p50 1601 ms` line cannot give you.

**Then one held-out read**, on the **37 `test_ids`**, read once:

| | First 37 dev | Held-out 37 |
|---|---|---|
| Traces / spans | 37 traces, 144 spans | 37 traces, **145 spans** |
| Tokens | 1143 in / 806 out | **1275 in / 916 out** |
| Cost | $0.00010683 | **$0.00012069** |
| Latency | p50 **1601 ms**, p95 2380 ms | p50 **1197 ms**, p95 2125 ms |
| `chat` error rate | 4/37 | **3/37** |
| `chain` error rate | 10/33 (30.3%) | **11/34 (32.4%)** |

Two rows in that table are the lesson. **The held-out half is a quarter faster** — p50 1197 ms against
1601 ms — and that is *not* good news, because nothing about the app changed. The median moved because
the same deterministic duration ranges were drawn against different item ids, which is exactly what a
simulated latency figure does and the reason every span is flagged. **A latency number that moves 25% when
the code does not is a latency number you must not put in a gate.** And the `chain` rate got *worse* on
data it had never seen, 30.3% to 32.4%, on the same post-check against different answers — which is the
one movement in that table that is a real measurement, and it is the one the held-out read existed to get.

## Use / don't use

**Do instrument the code paths only your app owns.** The retrieval and the post-check are yours; the model
call is the SDK's. [12.4](lesson-04.md) covers auto-instrumentation, and the short version is that the
library gives you the `chat` span for free and gives you nothing about the step that fed it.

**Do assert the shape, not just the content.** One root, resolvable parents, a contained duration. Those
three assertions are cheap and they are the difference between a trace and a pile of records.

**Do record decisions as attributes while you have them.** `retrieved: 1` costs nothing at the moment you
know it and cannot be reconstructed from the answer afterwards. Anything you do not write on the span is
something you will have to guess at from a text file.

**Do report per-kind rates, never a pooled one.** 9 errors over 78 spans is a true count and a useless
one. `chat 2/20` is a ticket.

**Don't wire up a collector before the app emits spans.** An empty trace in a real backend is a much worse
place to discover that your instrumentation is wrong than a printed JSONL file is.

**Don't trust a duration you have not read the provenance of.** Every span here says
`evallab.simulated_latency: true`. Carry the same flag into your own app the day it calls a real model —
`gen_ai.system` is where it belongs, and a dashboard that cannot tell a simulated number from a measured
one is a dashboard somebody will gate a release on.

**Don't sample before you can read what you are sampling.** [12.5](lesson-05.md) has the rule; the short
form is that unsampled traces are invisible, so the only failures you have are the ones somebody
complained about.

What teams actually do in production: wrap the entry point in one `agent` span, put a span around every
branch that can behave differently, put the measurable facts in attributes and the text nowhere, and
print the per-kind error rate on the same run that prints the cost. The waterfall is for the human
debugging one bad request; the per-kind rate is for the dashboard everyone looks at.

## Reflect

1. Your dashboard reads `p95 2404 ms` and the waterfall for a typical request reads `p50 model call
   1228.9 ms / p50 end-to-end 1296.8 ms`. Write the two sentences you would put in a ticket, one for
   *the model is slow* and one for *our code is slow*, and say which one the log-line histogram is
   currently forcing your team to write.
2. `summary()` printed `cost $0.0001 total` for a run that cost $0.00005892, and `cost $0.0000 total`
   for one that cost $0.00002409. Write the line you would add to `summary()`, and say what other panel
   in this course has the same defect — a number rounded to a precision that does not survive the data
   it is asked to display.

## Sources

- OpenTelemetry, [Tracing
  API](https://opentelemetry.io/docs/specs/otel/trace/api/) — the normative definition of the span
  fields, of `SpanKind`, and of the rule that a span name identifies a class of work rather than an
  instance. It is marked **Stable**, which is the contrast that makes the *next* lesson's caveat matter.
- OpenTelemetry, [Trace](https://opentelemetry.io/docs/specs/otel/trace/) — where the SDK, the sampling
  decision and the exporters sit relative to the API, i.e. the parts this lesson deliberately skips.
- OpenTelemetry, [Generative AI semantic conventions:
  spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) — the attribute names on the
  spans above. Their status and what "Development" obliges you to do about it are [12.2](lesson-02.md)'s
  whole subject.