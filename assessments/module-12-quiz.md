# Module 12 quiz — Tracing and observability

This quiz checks the last instrument you add before the eval loop starts gating releases: that a trace is
a tree you can reason about and not a list of log lines; that the GenAI attribute names are a published
contract somebody else's tooling reads; that auto-instrumentation is a first draft about the model rather
than about your app; that sampling is for cost and never for errors; and that a trace is a copy of a
conversation, which is where the personal data is.

Every question is a situation you will meet in your own work, not a definition. Four options, one correct.
**Pass mark: 70%** — seven of the ten questions. You can retake it; the questions do not change, so a
second attempt is worth taking only after you have re-read the lesson behind the one you got wrong.

What it covers, in the order the lessons build it:

- [12.1 · OpenTelemetry in twenty minutes](../lessons/module-12/lesson-01.md) — the six fields every span
  carries, why `parent_id` and `kind` are the two that turn records into a tree and an error rate into a
  ticket, and the two ways the shipped CLI is taught to lie to you.
- [12.2 · The GenAI semantic conventions](../lessons/module-12/lesson-02.md) — what an absent key reads like,
  why a rename is a breaking change to everyone *reading* your traces rather than writing them, and what
  a Development-status spec obliges you to do before every upgrade.
- [12.3 · Instrumenting the support bot by hand](../lessons/module-12/lesson-03.md) — the four spans around
  one support request, the one line that decides whether a tracer reports failures or only successes, and
  why a dashboard that gets faster as the model gets worse is the most dangerous artefact in the module.
- [12.4 · Auto-instrumentation, and when to stop trusting it](../lessons/module-12/lesson-04.md) — one span of
  four that the patch can give you, the question it can never answer, and the silent failure where an
  end-to-end column quietly reports a model number.
- [12.5 · Reading traces: cost, latency, sessions, PII](../lessons/module-12/lesson-05.md) — four headline
  numbers and four traps, a session id as a personal identifier, redaction at export rather than at
  capture, and the sampling rule you can actually keep.

Two reminders before you start. First, **nothing behind these lessons has been measured against a live
model.** Every span carries `evallab.simulated_latency: true`, the token counts are length estimates, and
the price sheet is an illustrative per-million-token list for a small open model — but every piece of
*arithmetic* in the module, the percentiles, the cost totals, the span counts, the redaction counts and
the two error rates, is computed for real by the shipped code on your machine. Second, two defects in the
shipped CLI are **taught, not overlooked**: `--tree` with an id that is not there silently prints the first
trace, and `summary()` rounds cost to four decimal places, so a healthy run reads `$0.0001` and a run
with half the requests failing reads `$0.0000`. Both are in the questions, because a tool that silently
deletes a measurement is the thing this module exists to teach you to recognise — including in the tool
you are holding.