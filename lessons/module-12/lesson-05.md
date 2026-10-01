---
id: "12.5"
module: 12
minutes: 20
practice_minutes: 50
prerequisites: ["12.3", "10.3"]
objectives:
  - Check a trace store's cost figure against token counts and a price sheet by hand, and explain why a per-call example and a per-run total are not the same number.
  - Report a latency percentile with its denominator and say which part of the number is simulated and which is arithmetic.
  - Explain why a session id on a span is a personal identifier, and decide whether to hash it, drop it, or keep it.
  - Run the exporter with redaction on, read how many values it removed, and say why redaction belongs at export rather than at capture.
  - Explain why a hashed sampling decision can support the rule "never drop errors", and what the shipped sampler does instead.
volatility: implementation
sources:
  - title: "MLflow Tracing — masking PII in traces"
    url: https://mlflow.org/docs/latest/genai/tracing/observe-with-traces/masking/
  - title: "MLflow Tracing — grouping traces into sessions"
    url: https://mlflow.org/docs/latest/genai/tracing/track-users-sessions/
  - title: "MLflow Tracing for LLM and Agent Observability"
    url: https://mlflow.org/docs/latest/genai/tracing/
  - title: "Sampling — OpenTelemetry"
    url: https://opentelemetry.io/docs/concepts/sampling/
  - title: "Semantic conventions for generative AI systems — OpenTelemetry"
    url: https://opentelemetry.io/docs/specs/semconv/gen-ai/
last_verified: "2026-10-01"
---

# 12.5 · Reading traces: cost, latency, sessions, and PII

A trace store shows you four headline numbers — money, milliseconds, sessions, and whatever personal data you
happened to put on a span — and each of the four has a trap that produces a confident, plausible, wrong
answer. This lesson reads all four off the shipped bot, shows the arithmetic behind each one so you can check
it yourself, and ends with the cheapest decision in the module: a sampling rule you can actually keep.

## Why it matters

A support team tunes the bot's answers to be more thorough. Two extra sentences of context, a short summary
before the direct answer, a restatement of the question. Nothing is wrong with any of it. The eval suite
stays green.

The bill goes up four times.

That is not an estimate, it is the two runs this repository ships:

| Variant | Tokens in | Tokens out | Cost, 20 traces |
|---|---|---|---|
| `v1` | 656 | 436 | **$0.00005892** |
| `v1padded` — same content, two extra sentences | 2147 | 1929 | **$0.00023802** |
| | | | **4.04×** |

The same twenty items, the same questions, the same retrieval. And — this is the part that should worry you —
**the pass rate cannot move.** `instrumented_run()` maps `v1padded` onto `v1` before it takes a label
(`label_variant = {"v1padded": "v1"}`), because the padded answer carries the same content and therefore the
same human label. And if you asked for a variant with no label at all, the run raises `KeyError` rather than
guessing one. So a regression suite watching only the pass rate is not merely *unlikely* to catch this; on
this dataset it is **structurally incapable** of catching it, by construction, and it will report a
comfortable margin while the cost panel quadruples.

That is the shape of the whole lesson. A trace number is a fact about the *model call*, and a product
decision is a fact about the *product*. The gap between the two is where a dashboard quietly stops being
evidence. Four tiles, four gaps:

| Tile | What it is actually about | The trap |
|---|---|---|
| cost | tokens × a price sheet, for **whichever variant produced the answer** | identical content, four times the bill |
| latency | two different questions, in two different columns | a good p50 and a p95 nobody can wait for |
| sessions | a join key you chose to put on a span | the join key is a person |
| PII | a conversation, which is where personal data lives | redacted at capture and useless to debug, or not redacted at all |

## How it works

### 1. Cost — checkable arithmetic, and a number that is about your variant

`total_cost()` is the sum over `spans("chat")` only, and one span's cost is
`(input_tokens × price_in + output_tokens × price_out) / 1e6`. The prices live in `PRICE_PER_MTOK` in
[`evallab/tracing.py`](../../labs/common/evallab/tracing.py) and are **illustrative numbers for small open
models**, chosen so the arithmetic is real and the answer is obviously not a quote for a real model.

The first trace in the run:

```
qwen3-1.7b: 28 in, 15 out
= (28 × 0.03 + 15 × 0.09) / 1e6 = $0.0000021900
```

And the whole run, twenty of them, which does **not** equal twenty times that:

| Quantity | Value |
|---|---|
| Tokens for the 20 traces | 656 in / 436 out |
| Mean per trace | 656 / 20 = **32.8 in**, 436 / 20 = **21.8 out** |
| Mean cost per trace | (32.8 × 0.03 + 21.8 × 0.09) / 1e6 = **$0.000002946** |
| 20 × that | **$0.00005892** |

The per-trace example you can check by hand is *cheaper than the average trace*. That is the trap inside the
trap: **a price sheet plus one representative call is not a bill.** Summing the spans is not an optimisation,
it is the only correct procedure, and a cost panel built from a p50 token count will be wrong by whatever the
distribution's spread is — silently, in both directions.

Now the trap that actually costs money. Both variants, priced by hand, per million tokens:

```
v1         656 × 0.03 +  436 × 0.09 =  58.92
v1padded  2147 × 0.03 + 1929 × 0.09 = 238.02
                                        4.04×
```

Notice that the cost ratio (**4.04×**) is *larger* than the token ratio (4076 / 1092 = **3.73×**), and the
reason is in the prices: the padding is mostly **output**, and output is priced at three times input. A team
that watches only "tokens per request" under-states the damage by exactly that factor. Cost is a function of
**which variant produced the answer**, and the variant is a product decision — so the cost number belongs in
the eval suite next to the pass rate, not on a dashboard nobody diffs.

One more trap, and it is a good one, because it looks like good news. Plant a 10% model-call failure rate and
the run's token totals **fall**: 656 / 436 becomes **584 / 393**, and the run's cost falls with them, from
**$0.00005892** to **$0.00005289** — about a tenth. A failed call reports
`gen_ai.usage.output_tokens = 0` and never records an input count, and `test_model_spans_carry_model_and_tokens`
asserts exactly that — a call that failed before the model answered must not report output tokens. So the
failed calls cost nothing, and a run with more failures reports less spend. Do not read that as efficiency;
read it as the price of a call that produced nothing, and keep the error rate and the cost panel on the same
screen so nobody can mistake one for the other.

### 2. Latency — two questions, and a clock that is not real

On the same 20 traces:

| Column | p50 | p95 |
|---|---|---|
| end-to-end (root span) | **1297 ms** | **2404 ms** |
| model call (`chat` span) | **1229 ms** | **2318 ms** |

The trap is treating these as one number with a summary. They are two different questions. p50 end-to-end
answers *how long a typical request takes*. p95 answers *how long the slowest one request in twenty is still
taking* — and that is the one a support inbox is built around. A p50 of 1.3 seconds and a
p95 of 2.4 seconds is not a p50 problem; here the whole spread sits inside the model call, which is why the
two rows are close and why "it is the database" would be wrong on this trace.

> [!WARNING]
> **These durations are simulated.** The app answers from recorded outputs, so a real clock would report
> sub-millisecond spans and a latency dashboard of zeros. `Tracer.__init__` defaults to
> `simulate_latency=True` and stamps `evallab.simulated_latency: true` on every span it creates; the code
> comment says why, and so does this lesson. The *shape* is modelled on a small local model and a vector
> search on a CPU laptop — the model call dominates, the tool span is small, the post-check is smaller — and
> all of the percentile arithmetic is real arithmetic over those durations. What is not real is the
> millisecond. Construct `Tracer(..., simulate_latency=False)` and the code falls back to the real clock
> rather than mislabelling a live app. Never quote a latency from this repository as a measurement of a named
> system, and never quote one at all until you have measured it on your own hardware.

The structural trap, carried over from lesson 12.4: `latency()` defines "end-to-end" as
`max(spans, key=duration)`. That is correct only if the longest span is the root you opened. In a trace
where the only spans are model calls, the two columns become the same two numbers — **1229** and **2318** —
under different headings, and nothing raises.

### 3. Sessions — a join key is an identifier

`sessions()` groups traces by `gen_ai.conversation.id`, read off the root span, and rolls up traces, cost
and tokens per group:

```python
root = max((Span.from_dict(s) for s in t["spans"]), key=lambda x: x.duration_ms)
sid = root.attributes.get(GEN_AI_CONVERSATION_ID, "unknown")
```

The CLI's `--session` defaults to `s-demo`, so all 20 dev traces land in one bucket. That is the *shape* of
the feature and it is genuinely useful: per-conversation cost is the question a support team asks first, and
it is not answerable from a list of independent traces.

The cost is on the same line of code. The moment a session id is stable and unique per person, it is a
personal identifier on every span of every conversation that person has — and it is a much better personal
identifier than the obvious ones, because it is not an email address and it does not look like one. Note also
where it sits in the redaction scheme: `gen_ai.conversation.id` is **not** in `Redactor.KEYS`, so it is
*pattern-scrubbed* rather than *dropped*. An email-shaped session id comes out as `[redacted:email]`; a
session id like `cus_8f21a` comes out unchanged, because it matches none of the four patterns.

That asymmetry is the design, not an oversight, and it is the same asymmetry section 4 is about: **drop what
you know carries a conversation; pattern-match what you are guessing about.** A join key you cannot pattern-match
is the case this rule does not cover, which is why the decision about it has to be made at capture:

- **Hash it** if you need to group across services and can join on the hash.
- **Drop it** if nobody outside your team needs the grouping.
- **Keep it** only if you have already decided what it means, who can see it, and how long it is retained.

And decide it before it ships. A session id is trivially easy to add and very hard to remove: once it is in
the exporter, in the retention policy, and in six dashboards, the trace store is a customer list.

### 4. PII — the one that costs least to get right, if you decide early

A trace is a copy of a conversation, and a conversation is where the personal data is. `record()` therefore
has a `--pii-rate`: it attaches `customerNNN@example.com` as `user.id` and `user.email` to that share of
requests, because a real support bot knows who it is talking to and a dashboard that groups by user needs it
on the span. Run it:

```console
$ py -m evallab.cli trace --n 20 --fail-rate 0.1 --pii-rate 0.6 --redact --out traces.jsonl
20 traces, 78 spans
  cost      $0.0001 total  qwen3-1.7b $0.0001
  tokens    584 in / 393 out (977 total)
  latency   p50 1297 ms, p95 2404 ms end-to-end
  errors    9 span(s) with an error.type

wrote 20 trace(s) to traces.jsonl
  skipped otlp: not installed or no OTEL_EXPORTER_OTLP_ENDPOINT
  skipped mlflow: not installed
  22 personal-data value(s) redacted
```

Twenty-two, not twenty, and not two per request across all twenty. Eleven of the twenty requests carried a
customer identifier — 60% is a rate on a hash, not a guarantee — and each carries two attributes, so eleven ×
2 = 22. The two requests that raised the planted timeout never reached the `if user:` block, so they carry
neither attribute; a redacted-value count is a count of *values*, and a value that was never attached is not
a value that was removed. At `--pii-rate 1.0` over the same 20 items the count is **40**: every request, two
attributes each.

Two layers, and they are not the same operation:

| Layer | Which attributes | What it does | Why |
|---|---|---|---|
| **Drop whole** | `prompt`, `input`, `question`, `answer`, `messages`, `text`, `content`, `gen_ai.output.messages` | `[dropped: 412 chars]` | scrubbing a conversation is guessing; a key known to hold one is dropped and only its length is kept |
| **Scrub in place** | every other string attribute | `[redacted:email]`, `[redacted:phone]`, `[redacted:card]`, `[redacted:iban]` | an incidental attribute nobody thought about is more often missed than dropped |

`test_redaction_removes_pii_but_keeps_the_measurement` is the whole argument in one function: four addresses,
a card number and a phone number go in; none of them come out; `out.input_tokens == 400` still does. **The
measurement survives, which is the entire reason to redact rather than to drop the span.** A redactor that
deletes the trace gives you a clean compliance story and no observability, and observability is the reason
you turned tracing on.

**At export, not at capture.** `Redactor` is passed to `export()`, not to `Tracer`, and
`test_local_copy_still_has_the_text_for_debugging` asserts the consequence: after an export with redaction on,
the in-memory span still reads `reach me at tal@example.com`. Your local copy keeps the text because that is
what you debug with at 2 a.m.; the exported copy does not, because that is what a third-party backend, a
wider set of colleagues and a retention policy can see. Redacting at capture gets the second half right and
the first half wrong, and you find out at 2 a.m. with nothing to look at.

And the exporter names what it did not do:

```
skipped otlp: not installed or no OTEL_EXPORTER_OTLP_ENDPOINT
skipped mlflow: not installed
```

Neither package is installed in this repository, so the only artifact every run above produces is the JSONL
file in the directory you ran it from. **A trace store that silently drops its writes is a trace store whose
numbers are a subset you cannot see** — and the run that printed those two lines is the model for how a
tool should behave when part of it is unavailable.

### 5. Sampling — the one you can keep, if it is hashed

`should_sample(rate, key)` is `(hash_seed(key) % 10_000) < rate * 10_000`. The key is the trace id. Same
trace, same decision, forever:

| Rate | Traces kept, out of 40 |
|---|---|
| 100% | **40** |
| 50% | **18** |
| 25% | **9** |

This is the whole reason the sampler is a hash rather than a coin flip. **A coin flip means the trace you
wanted may be missing and you cannot tell which.** With a hash, "we do not trace errors" is a rule you can
state and a claim you can audit: the same twenty requests drop the same five traces on every run, forever,
so a gap in the data is a fact about the trace set rather than a fact about the day you looked.

**And here is the part that makes it a real lesson: the shipped sampler still drops errors.** In `record()`,
`should_sample` is evaluated *before* the failure is planted, so the decision is made before the outcome is
known. The same twenty requests with the same planted 10% failure rate, sampled and unsampled:

```console
$ py -m evallab.cli trace --n 20 --fail-rate 0.1 --out traces.jsonl
20 traces, 78 spans
  errors    9 span(s) with an error.type

$ py -m evallab.cli trace --n 20 --fail-rate 0.1 --sample-rate 0.25 --out traces.jsonl
5 traces, 20 spans
  errors    2 span(s) with an error.type
```

Break that second run down by span kind and the model-call row reads `chat 0 / 5`. Against the unsampled
`chat 2 / 20`, **both** planted failures were sampled out. The model-call error rate went from 10.0% to 0.0%
and the product did not change by one request. The two errors that survived are `chain` errors, which happen
to sit on traces that were sampled in.

So: **sampling at 25% did not make the bot better; it removed the evidence.** The fix is not a better rate
and not a better hash — it is to make the decision *after* you know the outcome. Export errored traces
unconditionally, sample the rest, and the deterministic hash is what makes the resulting sample reproducible
and the resulting claim checkable. That is the rule that costs you almost nothing and that a coin flip would
have made impossible to keep.

## Show me

Everything below is a recorded run from this repository, on a Windows laptop, with no model, no collector and
no trace backend. That is not a limitation being worked around; it is what the lesson is about. **Trace
storage is the cheapest thing in this module to fake and the most expensive thing in production to get
honestly.**

The four numbers, from the shipped CLI on 20 dev traces with no planted errors:

```console
$ py -m evallab.cli trace --n 20 --out traces.jsonl
20 traces, 80 spans
  cost      $0.0001 total  qwen3-1.7b $0.0001
  tokens    656 in / 436 out (1092 total)
  latency   p50 1297 ms, p95 2404 ms end-to-end
  errors    5 span(s) with an error.type

wrote 20 trace(s) to traces.jsonl
  skipped otlp: not installed or no OTEL_EXPORTER_OTLP_ENDPOINT
  skipped mlflow: not installed

backends: jsonl yes, otlp no, mlflow no - install one and re-run to ship these spans.
```

`cost $0.0001` is `%.4f` applied to **$0.00005892**; the summary rounds for a reader, and the precision you
need for the arithmetic is in the tokens line right underneath it. That is the general shape of trace output:
**the headline is rounded, the inputs are not.**

One trace, all four spans, with the per-span cost that makes the tree add up:

```console
$ py -m evallab.cli trace --n 6 --tree tr_s01
[agent] support.answer  2441.371ms
  [execute_tool] retrieve_handbook  57.446ms
  [chat] generate answer  2364.48ms  28in/15out  $0.000002
  [chain] citation check  10.876ms  ERROR no_handbook_citation
```

And the same trace, same item, under the padded variant — the one place on this page where a single line of
output carries the whole argument:

```console
$ py -m evallab.cli trace --n 20 --variant v1padded --tree tr_s01
[agent] support.answer  2441.371ms
  [execute_tool] retrieve_handbook  57.446ms
  [chat] generate answer  2364.48ms  102in/89out  $0.000011
  [chain] citation check  10.876ms  ERROR no_handbook_citation
```

`28in/15out $0.000002` becomes `102in/89out $0.000011`. Same root duration, same tool span, same citation
error, same item — because nothing about the request changed except how long the answer was. Note that the
root span's duration did not move either, which is what makes it obvious that this is a cost regression
rather than a latency one.

Redaction and sampling, the two decisions you make before it ships:

```console
$ py -c "from evallab import load, record, Redactor, export; r = Redactor(); export(record(load('support'), n=20, split='dev', pii_rate=1.0, seed=1), 'traces.jsonl', redactor=r); print(r.redactions)"
40
```

Forty personal-data values removed from twenty traces, and the measurement — token counts, model name,
durations, `error.type` — still in the file.

```console
$ py -c "from evallab import load, record; d = load('support'); [print(r, '->', len(record(d, n=40, split='dev', sample_rate=r, seed=1)), 'of 40 traces') for r in (1.0, 0.5, 0.25)]"
1.0 -> 40 of 40 traces
0.5 -> 18 of 40 traces
0.25 -> 9 of 40 traces
```

And the package's own tests, which encode the four properties this lesson is about:

```console
$ py -m pytest tests/test_tracing.py -q
22 passed in 0.05s
```

`test_cost_is_the_sum_of_the_model_spans` asserts the total equals the hand sum. `test_sessions_group_traces`
asserts the per-session trace counts sum to the number of traces — a join key that loses a row is worse than
no join key. `test_redaction_removes_pii_but_keeps_the_measurement` and
`test_local_copy_still_has_the_text_for_debugging` are the two layers and the export-time decision.
`test_sampling_is_deterministic` compares two 200-element decisions and asserts they are identical lists.
`test_errors_are_kept_at_a_low_sample_rate` asserts that a 25% sample is genuinely smaller than 40 traces —
and, read honestly, it asserts that the sampling **happened**, not that the errors survived it.

> [!IMPORTANT]
> Two numbers in this lesson are not measurements and are labelled as such everywhere they appear. The
> **prices** in `PRICE_PER_MTOK` are illustrative figures for small open models, chosen so the arithmetic is
> checkable; they are not a quote for any hosted model. The **durations** are simulated, stamped
> `evallab.simulated_latency: true` on every span. Neither OTLP nor MLflow is installed here, so every run
> above wrote a JSONL file and nothing else, and the exporter prints the skip list rather than implying a
> write it did not make. Every number that is *arithmetic* — the cost of a token count, the percentile of a
> list, the number of redactions, the number of traces kept — is real and computed by running the shipped
> code.

## Try it

**Predict first**, before you run anything:

1. You replace a representative call's token counts with the run's mean and multiply by 20. Which direction
   does that estimate err, and by roughly how much on this run?
2. `v1padded` costs 4.04× `v1`, but uses 3.73× the tokens. Where does the other 0.3× come from, and which
   number would a "tokens per request" dashboard have told you about?
3. You plant a 10% model-call failure rate and the cost panel drops. Write the two sentences you would send
   to whoever is asking whether the outage saved money.
4. `should_sample` hashes the trace id, so the sample is stable. The shipped `record()` still drops errors at
   25%. Name the one-line change that keeps the stability and loses the failures.
5. `gen_ai.conversation.id` is not in `Redactor.KEYS`. Write down what happens to the session id `cus_8f21a`
   when `--redact` is on, and what happens to `a.customer@example.com`.

[Lab: evallab package](../../labs/common/)

1. **Price the run by hand before you read the tool's number.** From `labs/common/`, write out
   `656 × 0.03 + 436 × 0.09` and compare with the `cost` line in the summary. Then do the same for a single
   trace's `28 in / 15 out` and multiply by 20 to see how far a "typical call" is from a real total. Write
   both numbers down; the gap between them is the argument for summing spans.
2. **Price the padded variant and find the missing 0.3.** Run
   `py -m evallab.cli trace --n 20 --variant v1padded --out traces.jsonl` and
   `--tree tr_s01` against the unpadded run. Account for the gap between the token ratio and the cost ratio
   in one sentence, then write down which of the two a cost dashboard would have shown you.
3. **Plant an outage and watch the bill.** Run with and without `--fail-rate 0.1`. Note the token totals,
   the error count, and the span count (78 rather than 80, because the two failed requests never reach the
   post-check). Write the sentence for the finance ticket that explains why the spend fell during an
   incident.
4. **Read a percentile properly.** Write down p50 and p95 end-to-end and p50 and p95 model call. Then find
   one trace where the two rows are far apart rather than close, and say what would have to be slow for that
   to be the normal case.
5. **Do the redaction twice, for two different reasons.** Once with `--pii-rate 1.0 --redact` and count the
   values removed. Then take `traces.jsonl`, load it with `TraceStore.load(...)`, and confirm the token
   counts and `error.type` values survived. Write the sentence you would use to get a security reviewer's
   sign-off on shipping the file.
6. **Break the sampler.** Run the same `--fail-rate 0.1` command at `--sample-rate 1.0`, `0.5` and `0.25`, and
   print `error_rate()` for each. Write down at which rate the model-call error row goes to zero, and what
   you would have to change so it never does.

## Break it

**Watch only the pass rate.** The padded variant carries `v1`'s label, so the score is unchanged while the
cost goes up **4.04×**. The lie: **a metric that cannot move cannot fail**, and a suite made only of
unchanged metrics is a suite that reports a comfortable margin through any regression that does not touch the
judge.

**Report p50 and call it latency.** p50 end-to-end here is **1297 ms**; p95 is **2404 ms**, and the p95 is
the one a person on the other end is waiting through. The lie: **a percentile is a question, not a summary**,
and answering "how slow is it?" with the median answers a question nobody asked.

**Put a user id on the span and call it a session id.** The dashboard says "sessions", which sounds like
plumbing. It is a customer list with a join key. The lie: **a join key is an identifier as soon as it is
stable and unique**, and naming it `gen_ai.conversation.id` does not change what it is. It also survives
redaction, because no pattern matches it.

**Redact at capture.** Now nobody can debug, because the local copy is `[dropped: 412 chars]` too. The lie:
**redacting at capture solves the compliance problem and creates the debugging problem**, and the debugging
problem is the one that gets the tracing switched off.

**Sample with a coin flip.** You cannot answer "where is the trace for that complaint?" — you do not know
whether it was dropped, dropped by whom, or never created. The lie: **a sample you cannot reproduce is not a
sample, it is an anecdote**, and you cannot compute a rate over a set whose membership you cannot name.

**Sample, and keep only the sample.** Even hashed, the shipped sampler decides before it knows the outcome, so
errors drop with the volume. The lie: **"we sample 25%" is not a statement about cost, it is a statement about
which failures you will never see**, and nobody reading the dashboard can tell those two apart.

**Install one backend and trust the numbers.** Once OTLP succeeds, `export()` stops printing the skip line —
correctly, because it wrote. The hazard is the run where it does not, and where the trace count on the
dashboard is lower than the request count and nothing says why. The lie: **a trace store with a partial write
is worse than no trace store, because it looks like evidence.**

## Fix it

1. **Put cost in the eval suite, beside the pass rate, per variant.** `v1` at $0.00005892 and `v1padded` at
   $0.00023802 over the same 20 items is a one-line comparison, and it is the comparison a release gate
   should refuse to pass without. Module 13 turns it into a threshold; the arithmetic starts here.
2. **Report p50 and p95 together, with the denominator, and label the simulation.** On this run `n = 20`.
   And print `simulated_latency` next to the number if it is true, which is what the span attribute is for.
3. **Decide the session key at capture.** Hash it, drop it, or keep it — but write down which, in the same
   commit that adds the attribute. A session id added in a hurry and reviewed in a quarter is a customer list
   nobody chose.
4. **Redact at export, always, and always run the exporter.** `Redactor` inside `export()` gives you a
   debuggable local copy and a safe exported one. Running the export even when the only backend is JSONL
   costs nothing and keeps the skip list honest, which is the only way to notice the day a write stops.
5. **Make the sampler error-aware and keep it hashed.** Decide after the outcome: trace every error, sample
   the successes at the rate you can afford. The hash is what lets you state the rule and audit it; the
   ordering is what makes the rule true.
6. **Write the four numbers down with their definitions.** *Cost: chat-span tokens at the price sheet for the
   variant under test. Latency: p50 and p95 of the root span, n traces. Sessions: root spans grouped by
   `gen_ai.conversation.id`. PII: redacted at export, dropped keys enumerated in `Redactor.KEYS`.* A number
   whose definition is not written down will be re-used with a different one inside a month.

## How do I know it works?

**Challenge, on dev.** The 20 dev traces, and five checks before any of these four numbers goes on a
dashboard:

- **The cost figure reconciles with the token counts by hand.** `656 × 0.03 + 436 × 0.09 = 58.92` per
  million, and **$0.00005892** over twenty. If your panel cannot be reproduced from the two token counts and
  the price sheet, you are reading a different run than the one you think.
- **Both variants are priced, not one.** `v1` **$0.00005892** and `v1padded` **$0.00023802**, same items. A
  panel with a single variant on it cannot catch a regression that only changes which variant ships.
- **Both percentiles are printed, with `n`.** **p50 1297 ms, p95 2404 ms** end-to-end, **n = 20**, with
  `evallab.simulated_latency: true` beside them. A single percentile on a panel is a p50 wearing a label.
- **Every session bucket is accounted for.** `test_sessions_group_traces` asserts the per-session trace
  counts sum to the number of traces. On the default run that is one bucket, `s-demo`, holding all 20 — which
  is correct and also says the feature is untested, because one bucket exercises nothing.
- **Redaction removes personal data and keeps the measurement.** **40 values** at `--pii-rate 1.0`, token
  counts and `error.type` intact, and the in-memory span still readable after the export.

**Then one held-out validation**, on `test_ids` — the remaining **37 items**, run once:

```console
$ py -m evallab.cli trace --n 37 --split test --out traces.jsonl
37 traces, 148 spans
  cost      $0.0001 total  qwen3-1.7b $0.0001
  tokens    1366 in / 979 out (2345 total)
  latency   p50 1197 ms, p95 2125 ms end-to-end
  errors    14 span(s) with an error.type
```

Compare it to the dev run above, and read the differences rather than the level:

| | dev, 20 traces | held-out, 37 traces |
|---|---|---|
| Spans per trace | 80 / 20 = **4** | 148 / 37 = **4** |
| Tokens per trace | 656 / 20 = **32.8 in** | 1366 / 37 = **36.9 in** |
| Output tokens per trace | 436 / 20 = **21.8 out** | 979 / 37 = **26.5 out** |
| p50 / p95 end-to-end | **1297 / 2404 ms** | **1197 / 2125 ms** |
| Spans with an `error.type` | **5 of 80** | **14 of 148** |

Three things in that table are the check:

- **The output-to-input ratio rose on held-out data** — 21.8 / 32.8 = **0.66** on dev against
  26.5 / 36.9 = **0.72** on held-out, moving in the same direction as the padded variant's 0.90. Two splits,
  one variant, and the mix of what the model writes shifts. That is invisible in the totals unless you
  divide, and it is the reason a cost number belongs in the suite rather than on a dashboard nobody diffs.
- **The error counts are not comparable and should not be compared.** 5 of 80 and 14 of 148 are both about
  6% and 9% of spans, but the denominators are span counts, not requests, and the composition changes. If you
  want a rate here, `error_rate()` by span kind is the one with a named denominator — which is why
  `error_rate()` returns `{errors, spans, rate}` and not a single float.
- **p95 came down, p50 came down, and neither is a pass or a fail.** Both are simulated. The check is that
  they were computed over 37 traces you had not looked at before, which is what makes the comparison a
  validation rather than a second opinion.

## Use / don't use

**Do put cost in the eval suite, per variant.** Not on a dashboard, not monthly: in the suite, next to the
pass rate, so a change that costs four times as much has to be argued for in a pull request. A cost number
nobody diffs is a cost number nobody reads.

**Do report p50 and p95, and say which is which.** They answer different questions and the gap between them
is the experience. On a small n — 20 traces here, and 20 is not a latency measurement — say so in the
sentence, not in a footnote.

**Do decide the session key before it ships, and prefer a hash.** Sessions are genuinely useful and the cost
is one attribute; the expensive part is removing it later. `cus_8f21a` is not a conversation id, it is a
customer, and it will outlive the dashboard that needed it.

**Do redact at export, and do run the exporter.** The local copy is your debugging tool and the exported copy
is somebody else's data. Redacting at capture trades a compliance problem for an observability problem and
loses.

**Do sample — but trace every error.** The cost of a trace is real and a hash makes the sample reproducible;
what is not affordable is not knowing which failures you threw away. Errors are rare, they are the ones you
will need, and they are a rounding error against the volume.

**Don't quote this repository's costs as anyone's bill.** `PRICE_PER_MTOK` is a teaching price list. The
arithmetic is real; the prices are not a quote, and the ratio between your variants is the number worth
carrying to your own price sheet.

**Don't quote this repository's latencies as anyone's latency.** They are simulated, stamped as such, and the
only honest latency figure is the one you measured on your own hardware with your own model. The shape is
useful; the milliseconds are not evidence.

What teams actually do: a trace store with three rules. **Errors are always traced**; everything else is
sampled at a rate chosen from the bill, hashed so the sample is reproducible and the drop list is computable.
**The session key is a hash**, generated at the edge, never an email and never a name. **Redaction runs at
export**, with the key list reviewed like any other schema, because that list is the only thing standing
between a conversation and a shared backend. None of those three rules requires a sophisticated tool. They
require deciding them before the first trace ships, which is why this lesson is the last one in module 12.

## Reflect

1. The padded variant costs **4.04×** and passes at exactly the same rate, by construction. Write the two
   sentences you would put in the pull request that ships it anyway, and say what number in that pull request
   would have stopped it.
2. Your run's cost panel fell by about a tenth during a model outage. Write the message to the person who
   noticed, and say what you would add to the panel so that the drop cannot be read as a saving.
3. `should_sample` hashes the trace id, and the shipped sampler still drops errors because it decides first.
   Write the one-line change, and the one sentence that would let you prove next quarter that no errored
   trace was dropped.
4. You are adding `gen_ai.conversation.id` to every span next sprint. Write the decision you would record —
   hash, drop, or keep, and why — in the two sentences that would survive you leaving the team.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- MLflow, [Tracing (Observability)](https://mlflow.org/docs/latest/genai/tracing/) — the feature set this
  lesson's four numbers come from, and the reason a trace store is cheap in a lab and expensive in
  production: what it captures per request is a copy of the conversation.
- MLflow, [Group and filter traces using
  sessions](https://mlflow.org/docs/latest/genai/tracing/track-users-sessions/) — the vendor's own account
  of why sessions are worth having and how they are keyed, which is the same trade `sessions()` makes here.
- MLflow, [Redact PII data from
  traces](https://mlflow.org/docs/latest/genai/tracing/observe-with-traces/masking/) — the mask-at-export
  pattern `Redactor` implements, including the difference between dropping a key and scrubbing a value.
- OpenTelemetry, [Sampling](https://opentelemetry.io/docs/concepts/sampling/) — why consistent decisions from
  a hash are what make a sampled trace set analysable, and what "tail-based sampling" exists to fix when the
  decision has to be made after the span is complete.
- OpenTelemetry, [Semantic conventions for generative AI
  systems](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — where `gen_ai.conversation.id` and
  `gen_ai.usage.*` are defined, and the Development status that means this attribute's meaning can still
  move underneath you.