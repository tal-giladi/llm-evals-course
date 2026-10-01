---
id: "03.1"
module: 3
minutes: 14
practice_minutes: 30
prerequisites: ["02.3"]
objectives:
  - Write a code-based check for a failure category and say what output it would have to produce to fail.
  - Tell, from a scoreboard alone, whether a check discriminates between two systems or merely agrees with both.
  - Read a check's pass rate next to the rate at which it catches real failures, and act on the pair.
volatility: concept
sources:
  - title: "Hamel Husain — Evals FAQ"
    url: https://hamel.dev/blog/posts/evals-faq/
  - title: "pytest — How to write and run assertions"
    url: https://docs.pytest.org/en/stable/how-to/assert.html
  - title: "NIST AI Risk Management Framework 1.0"
    url: https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf
last_verified: "2026-10-01"
---

# 03.1 · Assertions: the cheapest check there is

An assertion is a line of code that reads an output and writes down pass or fail, and this lesson is
about why it is the first thing you should reach for. The tell that a check is broken is not that it
fails — it is that it passes everything.

## Why it matters

A team ships a feature that turns recipe text into a JSON object. On a sample of twenty recipes they
find four outputs that are not valid JSON, which crashes the importer in production. They are on a
deadline, so they add an eval: a model, given each output, is asked whether it is valid JSON, and the
verdict becomes a pass rate on their dashboard.

That eval is $0.03794 per call — the price this course's own judge lab records for its educational
model — so forty items cost $1.5176 a run. It is slower than the thing it is checking. And it is not
even a measurement, because nobody ever established that the judge agrees with a parser. When the
team later asks "would `JSON.parse` have caught this?", the answer is that `JSON.parse` *is* the
answer: free, instant, deterministic, and printed in the failure message down to the character
position. The team paid for a slower, noisier opinion about a question a library had already decided.

Worse, the judge can be wrong quietly. A model asked "is this valid JSON?" will often say yes about a
string with a trailing comma, because the string *looks* like JSON to a reader. The pass rate comes
back at 95% and the importer still crashes.

The instinct that produced the judge is the one to unlearn: reaching for the most powerful tool
available when the cheapest one has not been tried. This module starts at the bottom of the ladder,
where most of a good eval suite actually lives.

## How it works

An **assertion** is a check whose verdict is a deterministic function of the output. Four properties,
all of which come from the same fact that no model is involved:

- **It is decidable.** There is a right answer and you know it. `try: json.loads(s) except: fail`.
- **It is free.** Microseconds. It belongs in CI on every commit, not in a nightly job.
- **It is identical every run.** Change nothing, get the same number. There is no temperature to
  lower and no repeat to average.
- **It can be read.** The check is in the diff, in the pull request, in front of a reviewer. When it
  fails, the message says what went wrong, and you do not need to re-run anything to find out.

The fourth property is the one people forget, and it is the one that decides what a check is worth.
A code check is auditable in the same way a test is: you can read it, predict what it will say about
an output you have in front of you, and check the prediction. That is not true of a judge, and it is
not true of a person reading a hundred answers.

### A check that cannot fail is not a check

Here is the shape of the problem, taken from the lab this module uses. It holds twenty recipes, each
with an **exactly known** target JSON object, and three versions of the same system:

- **A — the schema is in the prompt.** The model is shown the schema. Twenty outputs, all raw JSON.
- **B — "output JSON".** No schema, one sentence asking for JSON. The model wraps most outputs in a
  code fence.
- **C — no format instruction at all.** The model is asked for the recipe as JSON and nothing else
  says so.

The truth for each item is decided by comparing the parsed object to the reference object, field by
field. Against that truth, here is what four checks do on variant C:

| Check | Passes | Of those passes, truly wrong | Catches failures | Keeps correct answers |
|---|---|---|---|---|
| Contains the recipe name | 20/20 | 14 | 0 of 14 | 6 of 6 |
| JSON parses | 16/20 | 10 | 4 of 14 | 6 of 6 |
| JSON matches the schema | 16/20 | 10 | 4 of 14 | 6 of 6 |
| Exact match on the raw string | 1/20 | 0 | 14 of 14 | 1 of 6 |

Only six of variant C's twenty outputs are actually the right object. The rest are wrong in fourteen
different ways. Now read the first row: the check looks for the words "sourdough loaf" in the output
and **every one of the twenty passes**, including all fourteen that are broken. It catches zero real
failures. A 100% pass rate there is not a success, it is the number a check produces when it has no
opinion — the pass rate has measured the check, not the system.

The last row is the opposite failure and just as instructive. Exact match on the raw string catches
every one of the fourteen wrong answers, and in doing so throws away five of the six answers that were
right, because those five wrapped the correct object in a sentence of prose. TNR 100%, TPR 16.7%. That
is not a broken check; it is a check whose *definition* of correct is stricter than the feature's, and
no amount of data will fix it.

Put the two together and you get the rule this module runs on:

> **A check earns its place by giving different systems different numbers.**

Read that as the test you apply to every metric you ever write. If check *X* returns 100% on the good
system and 100% on the broken one, it has told you nothing, and the number is worse than no number —
because it will be read as good news. The same is true of a check stuck at 0%: the lab's numeric
metric reads **0.0% (0.0%–16.1%)** on all three variants, including variant A, which is exactly
right twenty times out of twenty. That is not a system failing every check; it is a check that never
ran. Lesson [3.3](lesson-03.md) opens that one up, because the reason is the most useful thing in
this module.

## Show me

The code-checks lab is the one place in this course where every evaluator is real code that runs in
your browser. Open it and the scoreboard reads from twenty recorded outputs; change the metric, change
the system, and every number is recomputed in front of you by the same functions that a production
eval would call. There is no model call anywhere on that page and nothing leaves your browser.

Three numbers off the first screen, all on the same twenty items:

- **Contains a substring, variant C: 100.0% (83.9%–100.0%)** — twenty of twenty, including the four
  that are not JSON at all.
- **Numeric tolerance, variant C: 0.0% (0.0%–16.1%)** — zero of twenty, including the items that are
  exactly right. Turn the tolerance knob from 0.001 to 0.2 and switch between relative and absolute:
  the number does not move, because the check is calling `Number()` on a whole JSON object.
- **Exact match, variant C: 5.0% (0.9%–23.6%)** — one of twenty.

Switch the "System output" selector to variant A and the first number stays at 100.0%, the second
stays at 0.0%, and the third goes to 100.0%. That is the whole lesson in one gesture: two of the three
checks cannot tell a perfect system from a broken one, and only the strictest one can.

## Try it

**Predict first.** Write these four numbers on paper before you open the page. They are the ones the
lesson claims, and the point of predicting is to find out whether your model of the check is wrong:

1. What does **Contains a substring** read on variant C, which is wrong on 14 of 20 items?
2. What does **Numeric tolerance** read on variant A, which is exactly right on 20 of 20?
3. How many of the 20 items does **Exact match** pass on variant B, whose objects are all correct
   once the code fence is stripped?
4. On variant C, how many of the four failing items are failing because of the JSON or because of the
   content?

[Simulation: code-checks](../../simulations/code-checks/index.html?preset=assertions)

1. **Run one check on all three systems and write down the three numbers.** Start with Contains.
   Then Exact match. Then JSON parses. Three rows, three columns. The first row is all 100% and the
   third row is 100%, 20% and 5%. Fill in what you predicted and compare.
2. **Check whether your check can fail.** Set Metric to *Numeric tolerance*. Drag Allowed error from
   0.001 to 0.2 and flip the radio between relative and absolute. Write down what happened, then open
   the evaluator in the page source and find the line that decides. Do not skip this: the reason the
   number will not move is the most useful thing in the lesson, and you will not find it by looking at
   the number.
3. **Find the one item exact match lets through on variant C.** Switch to Exact match, variant C. One
   item passes. Open it, and confirm by eye that it really is the reference object. Then count how many
   items are *correct* and were still rejected — that is the price exact match on raw text charges,
   and it is five items.
4. **Break your own check.** Switch to Regex, and delete a character from the default pattern so it
   no longer compiles. The page scores 0 on everything rather than crashing. Read what that means: a
   typo in the check is now indistinguishable from a system that fails every item. Before you fix it,
   write down how you would tell those two apart from the scoreboard alone.
5. **Use Pin as A and come back to it.** Pin the current run, change the metric, and watch the two
   cards on the scoreboard. Two numbers on the same twenty items, and the gap between them is the only
   evidence you have that anything is different.

## Break it

Set the metric to **Contains a substring**. Read the scoreboard: **100.0% (83.9%–100.0%)** on variant
C. Turn the recipe count down to five: still 100.0%. Turn on **Break the metric** so the outputs are
padded with two sentences of confident filler and the first ingredient's quantity is doubled: still
100.0%. Switch to variant A, the perfect system: still 100.0%.

The lie is precise, and it is the default reading of a green scoreboard: **"100% of our outputs pass"
is being read as "our outputs are correct"**, when what it actually says is "this check has no opinion".
The dashboard turns that second sentence into the first because dashboards do not carry the
distinction, and 100% is a number people believe.

Now set the metric to **Numeric tolerance** and read the opposite lie: **0.0% (0.0%–16.1%)**, and it
stays there for all three systems and every tolerance. That number is equally uninformative and it is
going to be read as a catastrophe — twenty recipes, every one of them with the wrong oven
temperature. Not one of them does. The check is comparing a whole JSON object as if it were a number,
so it fails everything for a reason that has nothing to do with the system.

Both readings are the same mistake. A pass rate is a statement about the check and the sample until
you have shown the check discriminates.

## Fix it

Three changes, and all three are visible on the scoreboard without touching a single output:

1. **Run more than one check, and require the numbers to differ.** Contains 100.0%, JSON parses
   80.0% (58.4%–91.9%), exact match 5.0% (0.9%–23.6%). The spread between them is the information. A
   single number on a scoreboard is a hypothesis; three disagreeing numbers are an argument you can
   act on.
2. **Report the rate at which the check catches real failures next to its pass rate.** On variant C
   the truth is 6 of 20 correct. JSON parses reports 16 of 20 and catches 4 of the 14 real failures.
   That pair — 80.0% and 4 of 14 — is the honest reading, and it says the check is not ready to gate
   anything. A pass rate alone cannot tell you that.
3. **Fix the check, then read the scoreboard again.** Parse the output and compare the objects instead
   of the raw strings, and the same twenty items go from 5.0% to **30.0% (14.5%–51.9%)** on variant C
   — the true number of correct objects. Nothing about the system changed. The check stopped measuring
   the wrapper and started measuring the answer, and the scoreboard looks worse because it is finally
   true.

Notice that none of these three steps made the system better. They made the number mean something.

## How do I know it works?

**Challenge, on dev.** Use variant C and all twenty recipes. For each check you are considering, fill
in two numbers before you run it:

| Check | Passes | What did it pass that is wrong? | What would make it fail? |
|---|---|---|---|
| | | | |

The third column is the one that matters. If you cannot write a concrete output — a string, a JSON
object, a sentence — that would make this check fail, you do not have a check, you have a vibe with a
function name. The lab's own page says the same thing at the bottom of its panel: a check that passes
100% is often a check that cannot fail.

Then set a target you can actually fail:

- **A check is only worth putting in the suite if it catches at least 4 of the 14 real failures on
  variant C.** Exact match passes at 14 of 14 and contains passes at 0 of 14; JSON parses sits at 4
  of 14, which is enough to keep and not enough to trust alone.
- **No check on its own may be the headline.** Two or more checks, disagreeing, or you have one
  number and no idea what it means.

**Validation, once, and only once.** Switch the system from variant C to variant B. Variant B is
wrong on 5 of 20 and its errors are different in kind — the object is fine, the wrapper is not. Your
check has to still catch those five. Prediction before you look: exact match catches 5 of 5 because
the fence breaks the string; contains catches 0 of 5. If your dev-tuned check scores 100% on variant B,
it tuned to one failure shape and nothing else — and you have just found out that before production
did.

## Use / don't use

**Use code checks for** anything decidable: does it parse, does it have the required fields, is the
number in range, does it contain the section it claims, is it under 200 words. In production these are
unit tests. They cost microseconds, they run on every commit, and when one fails it names the field and
the character offset, which means the bug is already located before a human sees it.

**Don't use them for** anything where the answer is a judgement rather than a fact. A regex cannot
decide whether a recipe step is clear to a beginner, and a schema cannot decide whether it is good. A
check that has been stretched to cover an undecidable category is worse than no check, because it
will pass, and its passing will be believed.

Two production habits worth forming now. First, **put the code checks in CI and run them on every
pull request**, not in a nightly suite — the entire point is that they are free. Second, **write the
failure message as the deliverable.** The lab's validators do this: the JSON parse check names which
recovery it used, and the schema check reports the path and the rule, so a failure tells you where to
look rather than that something is wrong somewhere. An assertion that says `false` has pushed the work
onto whoever gets paged.

## Reflect

1. Find a check in a codebase you work on that returns the same answer on everything. Write down what
   it would take to make it fail, or why you would keep it as a smoke test rather than an eval.
2. Exact match on raw text catches 14 of 14 real failures and throws away 5 of 6 correct answers on
   variant C. Which of those two numbers is worse for the team that owns this feature, and what does
   that depend on — the cost of a missed failure, or the cost of a false alarm?

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the ordering this module is
  built on: write down what you can check with code before you spend tokens on a model.
- [pytest — How to write and run assertions](https://docs.pytest.org/en/stable/how-to/assert.html) —
  the same idea in the place most teams meet it first, and the reason assertion messages are written
  to be read by the person who did not write them.
- [NIST AI Risk Management Framework 1.0](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf) —
  measurement as a distinct function from evaluation: a metric has to be shown to separate the cases
  it claims to separate, or it is documenting itself.