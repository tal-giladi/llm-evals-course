# Module 12 labs — see what the app actually did

Two labs. Each has a **starter** with failing tests and a **solution** beside it.

**Nothing here needs a backend.** The tracer is a dependency-free module and writes JSONL; OTLP and
MLflow are optional exports, and the exporter tells you which ones it skipped rather than pretending.
You need Python 3.10+ and nothing else. `py -m evallab.cli doctor` will tell you what your machine
can do.

## Before you start

```bash
cd labs/common
$env:PYTHONPATH="."        # PowerShell; macOS/Linux: export PYTHONPATH=.
py -m evallab.cli doctor
py -m evallab.cli trace --n 20 --fail-rate 0.1 --out traces.jsonl
py -m evallab.cli trace --n 6 --tree tr_s01
```

Then read one trace by hand:

```bash
py -m evallab.cli trace --n 3 --tree tr_s01
```

That tree is the whole model: one root, a retrieval tool call, a model call with tokens and a price,
and a post-check. If you can read that, you can read any trace.

> **A sharp edge, on purpose.** `--tree` takes a trace id, and if the id is not in the run it prints
> the first trace instead, without saying so. Try `--tree tr_nope` and notice. It is left that way
> because "a tool that answers a question you did not ask" is worth meeting once, and lab 1 asks you to
> break exactly this kind of thing. Everything else in these labs tells you when it did nothing.

---

## Lab 1 — The span that is only yours

**The failure this fixes.** An auto-instrumented trace knows a model was called. It does not know
that *your* code retrieved nothing and carried on anyway, because that never crossed an instrumented
library boundary. The trace looks complete and the worst class of failure is invisible.

**Your job.** `starter/instrument.py` is a deliberately thin tracer: it records the model call and
nothing else. Add the two spans only your app can emit.

1. **The retrieval span.** An `execute_tool` span named after the tool, carrying whether anything was
   found. The dataset marks questions the handbook does not cover, and a retrieval that returns
   nothing for one of those is a bug the model call span will never show you.
2. **The post-check span.** A `chain` span that runs after generation and records why an answer was
   rejected — an uncited answer, an unsupported addition, a refusal of a question the handbook
   answers. This is the span that turns a support ticket into a line on a dashboard.

Then, and this is the part that matters:

3. **Export what you have when the call raises.** Run with `--fail-rate 0.1` and compare the
   `chat` error rate you can see with the one that actually happened. If the two disagree, you have
   found the bug this lab is about.

**Tested by** `test_instrument.py`. The test that matters asserts that a planted model failure shows
up in the error rate. If it does not, your spans are being dropped, and the error rate you are about
to publish is computed over the requests that worked.

---

## Lab 2 — Ship a trace you can defend

**The failure this fixes.** You got the traces. Now you are about to send them somewhere, and a trace
is a copy of a conversation — which is where the personal data is.

**Your job.** `starter/ship.py` exports traces and is missing every check that makes an export
defensible.

1. **Redact at export, not at capture.** Your local copy keeps the text for debugging; the exported
   copy does not. Scrubbing at capture leaves you unable to debug, and not scrubbing at all ships
   your customer list to a third-party backend.
2. **Decide what to drop and what to scrub.** A key *known* to carry a prompt is dropped whole —
   scrubbing a conversation is guessing. An incidental attribute somebody added by hand is scrubbed
   in place, because you cannot be sure what is in it.
3. **Say which backends you skipped.** An exporter that writes JSONL and reports an MLflow export
   that did not happen has lied in the one place a reader checks.
4. **Report cost per request, not just in total.** The same content can cost four times as much: the
   padded variant in this dataset runs 2147 input tokens against 656 for the tuned one, for identical
   facts. A dashboard that shows only a total hides that entirely.

**Tested by** `test_ship.py`. The redaction test writes a file and greps it, which is the only kind of
test for "did the personal data leave".

---

## Running everything

```bash
py -m pytest labs/common/tests -q        # the package: 69 tests
py -m pytest labs/module-12/solution -q  # these two labs
```

If `labs/common/tests` fails, the package is broken and nothing else matters.

## A note on honesty

Span durations in this lab are **simulated**. The app answers from recorded outputs, so a real clock
would report sub-millisecond spans and a p50/p95 panel would be a column of zeros. The durations
carry `evallab.simulated_latency: true` so nothing downstream mistakes them for measured, and cost
uses illustrative per-million-token prices for small open models.

That is deliberate, and it is the standard the course holds itself to: **the arithmetic is real, the
model behind it is named as an educational model, and nothing here claims to be a benchmark.**

Three known sharp edges are left in deliberately, and each is a lesson:

| What it does | Why it stays |
|---|---|
| `--tree` with an unknown id prints the first trace, silently | A tool that answers a question you did not ask. Lab 1 is about exactly this. |
| `summary()` rounds cost to 4 decimal places, so a healthy 20-trace run reads `$0.0001` and a 50%-failure run reads `$0.0000` | A cost panel that reads "free" while the product is broken is a real dashboard failure, and seeing it is faster than being told |
| Simulated durations are hashed from the item id, so the held-out p50 comes out about 25% *better* than dev with no code change | A latency number that moves when nothing changed must not be gated on. Lesson 12.1 says so |
