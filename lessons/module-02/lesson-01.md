---
id: "02.1"
module: 2
minutes: 15
practice_minutes: 35
prerequisites: ["01.3"]
objectives:
  - Read one OpenTelemetry-shaped trace end to end and say, for each span, what it proves and what it does not.
  - Tell from a trace whether a pipeline step ran, what it cost in time and money, and what the automated post-check reported.
  - Explain why searching the user-facing answer text cannot reach the failure classes that live in the pipeline.
volatility: concept
sources:
  - title: "OpenTelemetry — Generative AI semantic conventions: spans"
    url: https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/
  - title: "OpenTelemetry — Generative AI semantic conventions: agent spans"
    url: https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/
  - title: "Hamel Husain — Evals FAQ"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 02.1 · Reading a trace

A trace is the record of everything one request did: what it retrieved, what it sent to the model, how many tokens that cost, and what the automated checks said afterwards. This lesson teaches you to read one end to end, because the failure a trace shows you and the failure a sentence shows you are rarely the same one.

## Why it matters

A support bot answers questions from a company handbook. Users report that some answers are wrong. The team does the sensible thing: copies the complained-about answers into a spreadsheet, puts them next to the handbook, and reads them. That finds the real failures — the answers that state a rule the handbook does not contain.

It cannot find the rest, and the reason is structural rather than a matter of care. Text tells you **what the user was shown**. It cannot tell you **what the system did to produce it**. A whole class of failures — every answer produced by a code path that skipped a step, or fed the model the wrong section, or ran with a different prompt — reads perfectly fluently, because the failure is not in the words. It is in the path that made them. When you search for bad wording, you are searching in the one place where that class of failure cannot appear, so it never shows up in your spreadsheet and never reaches your backlog.

You can see the same wall in this lab one step later. The trace lab shows you a question and a span tree for 94 answers and none of the answer text at all. That is not an omission to work around; it is what production traces look like for many teams once answer text is redacted, stored separately, or simply never attached to the span. A trace is a map of the pipeline. You still need the output to judge the output — but only the map can tell you where to look.

## How it works

A **trace** is one request. It is a tree of **spans**, each span being one operation with a name, a start time, a duration, a parent, and a handful of attributes. The OpenTelemetry GenAI conventions define the shape this course uses: an `agent` span for the whole request, `execute_tool` spans for tool calls, a `chat` span for the model call carrying `model`, `input_tokens`, `output_tokens` and `cost_usd`, and whatever post-processing spans your app runs.

Read a trace top to bottom, one span at a time, and ask two questions of each: **what does this prove**, and **what does it not prove**. Here is trace `tr_s01` from the lab — "How many days of paid time off do I get each year?" — with the numbers the lab shows:

| Span | Kind | Duration | What it proves | What it does not prove |
|---|---|---|---|---|
| `support.answer: Leave and time off` | `agent` (root) | 1112 ms | the whole request took 1.1 s | nothing about quality |
| `retrieve_handbook` | `execute_tool` | 39 ms | the retrieval step ran | **what it returned** — no section, no count |
| `generate answer` | `chat`, `qwen3-0.6b` | 691 ms | 786 in / 53 out tokens, $0.02835 | that the 53 output tokens are correct |
| `citation check` | `chain` | 312 ms | `error: answer contained no handbook citation` | that the fact itself is wrong |

The arithmetic checks out, and it is worth doing once by hand so the shape sticks: the three step durations are 39 + 691 + 312 = 1042 ms, and the root span reports 1112 ms. The missing 70 ms is the three 10 ms gaps between steps plus the 50 ms the root span adds to close itself out. The cost is the same kind of arithmetic: 786 input tokens at $0.03 per million plus 53 output tokens at $0.09 per million is $0.02835. (Those per-token prices are what this lab records for its educational model, not a vendor's price list — the multiplication is real, the price is a placeholder.)

The single most important cell in that table is the "does not prove" one on the retrieval span. `retrieve_handbook` ran for 39 ms and the trace records **no result count and no section identifier**. So a trace can tell you the retrieval step happened; it cannot tell you it returned the right section. When your failure analysis needs that, the fix is to record it on the span — add a result count and the section id — not to read harder.

## Show me

The lab ships 94 traces of one support bot, all in that same four-span shape. Here is what reading the whole set tells you, none of which is visible in the answer text:

- **The pipeline is uniform.** All 94 traces have exactly four spans in the same order: `agent` → `execute_tool` → `chat` → `chain`. There is no trace where retrieval was skipped, so the "answers produced with no retrieval step" failure genuinely cannot be present in this batch — which is the useful part. Reading the tree tells you which classes are *absent*, not only which are present.
- **Where the time goes.** The median request is 1015 ms. The median step times are 60 ms for retrieval, 546 ms for the model call and 300 ms for the post-check: 906 ms of the 1015 ms. Two thirds of every answer is the model call and nearly a third is a check that only looks for citations.
- **Which model actually ran.** 86 of the 94 answers were produced by `qwen3-0.6b`; 8 by `qwen3-1.7b`. Nobody chose a model per question. The trace is where that fact is visible.
- **What it costs.** Median $0.0293 per answer, range $0.0182 to $0.0428, and $2.82 for all 94. Twenty traces is about sixty cents of generation — the model is not the expensive part of error analysis. Your afternoon is.
- **What the post-check caught.** 27 of the 94 traces carry `error: answer contained no handbook citation`. The other 67 report nothing.

That last number is the one to sit with. The course also ships human labels for this bot's tuned system, which module 5 will make you judge. Those labels say that of the 94 tuned answers, **47 were correct, 27 were right but uncited, 12 stated a wrong fact, 6 refused a question the handbook answers, and 2 invented a policy the handbook does not contain**. So the citation check flagged 27 of the 47 failures. The other **20 failures produced a completely clean post-check**: wrong facts, refusals and invented policies all pass a check that only tests for citations.

## Try it

**Predict first.** Before you open anything, write down two answers on paper:

1. In the default batch of 20 random traces, how many will carry an error chip on the `citation check` span?
2. Name one thing the span tree will show you that the question text cannot.

Then open the lab.

[Simulation: error-analysis](../../simulations/error-analysis/index.html)

1. **Read one trace all the way down.** The first trace in the default batch is "What happens if I do not use all my paid time off before December 31?" — and it has no error chip anywhere, which is your first free lesson in sampling: the default batch is not pre-filtered for you. Write one line per span in the form `span name — what it proves — what it does not`. Four lines, no more.
2. **Check your first prediction.** Count the error chips across all 20 traces of the batch. The batch is shuffled deterministically so that this number is the same for everyone; write down what you counted and compare it with your prediction.
3. **Read a clean trace next to a dirty one.** Find a trace with an error chip and one without, and list every field that differs between them. Then list the fields that are identical, and say which of those identical fields you would have wanted to be different.
4. **Sort the batch by what it costs.** Find the trace with the largest `$` chip and the one with the smallest. Note the `output_tokens` of each and whether the total time is explained by the model span.

## Break it

Set the sampling strategy to **Only traces with a span error** and read five of them. Every one shows the same error on the same span, from the same model, with the same four-step shape. Write a one-paragraph conclusion about how this bot fails.

The conclusion will be confident, specific and wrong. The lie is this: *a batch filtered by the check you already trust contains only what that check found.* You have replaced a sample of the system's behaviour with a sample of one failure class, and the sample is now perfectly homogeneous — which feels like clarity and is actually the absence of information. The post-check is a useful alarm; it is not a measurement of quality, and a trace list it selected is not evidence about the other 67 traces.

The same move with a different filter: set the slice to **Investing**, which holds exactly one item out of 94. You now have a perfect trace, with every field populated. You also know nothing.

## Fix it

Read one random trace before any filtered trace, and pair every trace with its output before you judge it.

On the lab's scoreboard this shows up as a completely different read. Open the default random batch, work through all 20 traces without filtering, and watch the **Progress** panel: it starts at "0 traces read. 0 distinct failure modes named." As you go it becomes "12 traces read. 3 distinct failure modes named." That second number is the honest one — it is the count of things you have actually seen, from a batch that was not chosen by the thing you already suspected. Filtered to errors, it would read "20 traces read. 1 distinct failure modes named" and tell you nothing you did not already know before opening the page.

## How do I know it works?

**Dev run.** Open the default batch — 20 traces, random, all sections — and write one line per trace:

```text
model / did retrieval run / what the post-check said / what this trace still cannot tell me
```

**Target:** 20 lines, no blank fields, and at least 12 lines that quote a number or a span name rather than a feeling.

**Validation, once.** Switch to **Only traces with a span error** and open the first 10 traces. Prediction: all 10 show `answer contained no handbook citation` on the `citation check` span, all 10 ran `qwen3-0.6b` or `qwen3-1.7b`, and every one of them still cannot tell you whether the answer was true. If any of those 10 surprises you, your model of the pipeline is wrong and you have earned the twenty lines.

## Use / don't use

**Use it for:** finding out which step a class of answers came from; measuring time and money per request type; spotting the answers your own checks flagged; and getting a defensible record to paste into a ticket. In production this lives in a tracing backend — Phoenix, Langfuse, MLflow or a collector with a trace viewer — fed by the OpenTelemetry SDK. Instrument the agent span, the tool span and the model span at minimum, and put the output's storage id on the root span so you can join trace to answer in one click.

**Don't use it for:** deciding whether an answer is correct (that is a label, not a span); as your only record of a failure (traces expire and sampling drops them); or as a quality score. `span error count / trace count` measures how often your post-check fires, which is a property of the post-check.

Two production facts worth knowing before module 12. The GenAI semantic conventions are still marked **Development**, so pin a version and expect attribute names to move. And traces carry prompts and answers, which means personal data: sample, redact and set retention limits before you turn this on for real traffic. Module 12 handles both.

## Reflect

1. Pick the failure you would *not* have found by reading the answer text in this batch. What single span attribute would you have to add to your instrumentation to find it next time?
2. The citation check flagged 27 of 47 failures in the tuned system. If you shipped that check as a release gate, which 20 failures would it wave through, and what would you add to catch them?

## Sources

- [OpenTelemetry — Generative AI semantic conventions: spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) — the span shape and attribute names this lab's traces follow.
- [OpenTelemetry — Generative AI semantic conventions: agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) — the `agent` span and how a multi-step request is nested.
- [Hamel Husain — Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — why looking at your data comes before writing any metric.

The working artefact this module produces is a **failure taxonomy sheet**: one row per failure mode, with a count and a named check. Lesson [2.3](lesson-03.md) builds it from your own notes, and the course ships a blank copy of the sheet in `templates/`.
