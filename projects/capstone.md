# Capstone — your own feature, end to end

Take one LLM feature you have built or prototyped, and carry it through the whole loop the
course teaches. The feature is yours; the grading is on the reasoning and the numbers, not on
which feature you picked.

Budget about six hours. Modules 1–14 are the tools; this is where you find out whether you can
sequence them on something you actually own.

## What you are handing in

**One page**, filled in from [`templates/eval-design-review.md`](../templates/eval-design-review.md).
That template *is* the deliverable — every row on it is a number with a sample size and a reason
next to it. A capstone is two pages of that sheet with the blanks filled, plus a link to your
suite.

**Your eval code**, running. One command, stated in the sheet, that reproduces your numbers on
someone else's machine.

## The ten things the sheet asks for

| # | Criterion | What "meets the bar" looks like |
|---|---|---|
| 1 | **Error analysis** | 50 traces read and open-coded, a failure taxonomy with counts, and the top failure chosen with a reason |
| 2 | **Eval set** | A dev/test split by slice, and a sample size justified from an interval rather than from habit |
| 3 | **Check selection** | Each top failure mapped to code, a judge or a human, with the reason written down |
| 4 | **Judge validation** | At least one binary judge with TPR, TNR and kappa on dev, one held-out validation, and the disagreements reviewed |
| 5 | **Bias control** | Position or verbosity checked where the answers are free-form, and repeats justified |
| 6 | **Honest reporting** | Pass rates with intervals, corrected for judge error wherever a judge is used |
| 7 | **Tracing** | The app instrumented with OpenTelemetry GenAI attributes; cost and latency per request visible |
| 8 | **Regression suite** | A CI job with cached judge calls, a stated budget, and a gate that blocks a regression you planted |
| 9 | **Online loop** | A sampled online judge, and one production failure turned into a test case |
| 10 | **Reproducibility** | One command, and the tolerance within which a different run counts as the same |

## The three that are harder than they look

Most submissions pass 1–6 and stall on these. Budget your time accordingly.

**8 — the gate has to block something.** Not a number on a page: a real failure, planted by you,
that the gate catches. If you cannot make it fail, you have not built a gate, you have built a
report. The fastest way to get there is to write the failing case first and the gate second.

**9 — the loop has to close.** A production failure that gets fixed by hand once, with no test
case, comes back. The evidence is a diff: an item in your suite that did not exist a month ago,
arriving from something that went wrong in production. If you have no production yet, say so and
substitute a realistic incident you simulate end to end — and say that is what you did.

**10 — "works on my machine" is not reproducibility.** State the tolerance explicitly: *kappa
±0.03, pass rate ±0.02, the gate decision identical.* Anything vaguer is not a claim a reader can
check.

## What is not graded

- **Which feature you chose.** A small internal tool you understand completely beats a large
  system you do not.
- **The absolute numbers.** A 62% pass rate is a fine result. A 95% pass rate on a feature that
  nobody has used is a warning sign, and the sheet asks for your sample size so a reader can tell
  the difference.
- **Whether your feature is good.** It is the vehicle, not the subject. A perfectly-run evaluation
  of a mediocre feature is a better capstone than a rushed one of a good feature.

## If you would rather not use your own feature

Some readers will not have one they can share, which is fine. Fall back, in this order of
preference:

1. A feature from work you are cleared to discuss, with nothing confidential in the outputs.
2. An open-source project you contribute to, evaluated on public issues.
3. **The course's own support bot**, over `datasets/support.json`, with a stated variation of your
   own. This is fully specified by the material you have already built, and the only difference is
   that you are not proving you can handle your own data.

Say which you chose and why. The reasoning matters more than the answer.

## A note on the educational model

Everything in the course's labs — the judge verdicts, the spans, the prices — is generated, and
every lab says so. Your capstone should not carry that caveat, because your judge and your
instrumentation are real. But do not carry over any number from the course's datasets into your
own sheet, and do not present a result as a benchmark. If your judge is a model, it is one
measurement of one judge on one set, and the sheet should say so the way lessons 5 and 6 taught.

## Where to ask

There is no instructor. The place to get unstuck is the material: module 2 for the taxonomy,
module 6 for the judge, module 10 for the gate, module 14 for the loop. If a number on your sheet
would not survive someone asking for the interval behind it, that is the lesson it belongs to.
