---
id: "14.4"
module: 14
minutes: 18
practice_minutes: 50
prerequisites: ["14.3", "02.2"]
objectives:
  - Turn a window of production traces into a list of named failures, and say which span attribute carries the signal and where it actually lives.
  - Convert a failure into a test case in the shape the dataset reader expects, and explain which field in that shape is the point.
  - Decide which of a window's failures can be labelled at all, and say what to do with the ones that cannot.
  - Argue, in writing, why a production failure nobody labelled is a trace rather than a test, and what it costs to leave it as one.
volatility: implementation
sources:
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
  - title: "Semantic conventions for generative AI systems — OpenTelemetry"
    url: https://opentelemetry.io/docs/specs/semconv/gen-ai/
  - title: "The Mythos of Model Evaluation (Bowyer et al., 2024)"
    url: https://arxiv.org/abs/2411.19994
  - title: "A Study of Cross-Validation and Bootstrap for Accuracy Estimation and Model Selection (Kohavi, 2001)"
    url: http://www.jmlr.org/papers/volume2/kohavi01a/kohavi01a.pdf
last_verified: "2026-10-01"
---

# 14.4 · Trace → labelled failure → new test case

A production failure is found, fixed on a Friday, and never written down. Four months later it is back,
in a different form, and the person who shipped the fix is on another team. The fix was real and the
knowledge is gone, because nothing about the incident turned into a thing the suite runs on. This lesson
is the last step of the loop — trace, name it, label it, put it in the suite — and the part that matters
is not the three lines of code, it is the argument for why the labelling step is the whole thing.

## Why it matters

Here is how the incident actually goes, because the shape is the argument.

Monday: a customer emails saying the bot told them they get 25 days of paid leave when their handbook
entry says 20. An engineer finds the answer in the trace in four minutes. The cause is obvious — the
retrieval step returned the wrong section, the model wrote the number from the wrong page, and the
post-check only looks for a citation so it passed a confidently wrong answer. The fix is a two-line
change to the retrieval filter. It ships Tuesday. The customer is answered on Wednesday.

Nobody writes a test. Not out of malice — there was no incident process that asked for one, and the
change looked like a data fix rather than a behavioural one.

In February the same class of failure appears on a different question. The trace looks the same. The fix
takes forty minutes instead of four, because this time somebody has to work out *why* the first fix
worked, and the first fix is a diff in a repository with four hundred commits in it. In June it appears
again on a third question, and the two-line filter change is in three different places, written twice.

**Three incidents, one root cause, and a suite that was green the whole time.** Nothing about the eval
system was broken at any point. The eval system was measuring the questions somebody thought of, and the
production failure was not one of them, because a failure that nobody labelled is not a test. It is a
trace, and traces expire.

The sentence to take from this lesson is in the docstring of the function that does the conversion, and it
is the argument for the whole module:

> *A production failure that nobody labelled is a trace, not a test, and it will be argued about again
> next quarter instead of being fixed once.*

## How it works

### Step one: find the failures, and read the right attribute

`regressions_from(traces, human_labels=None)` in [`evallab/online.py`](../../labs/common/evallab/online.py)
is the whole of step one:

```python
def regressions_from(traces, human_labels: dict | None = None) -> list:
    """Find the failures in a window of production traces.

    A trace is a failure when a span carries ``error.type`` — the post-check
    rejecting the answer, or a call that raised. Not when a human read it and
    frowned, because nobody is reading the stream.

    ``error.type`` lives in the span's **attributes**, not on the span itself.
    Reading ``span["error"]`` finds nothing and returns an empty list, which
    looks exactly like a healthy window.
    """
    def err(s):
        return s.get("attributes", {}).get("error.type")
    ...
```

The last paragraph of that docstring is the one that saves you, and the reason the module has a test for
it. `error.type` is a **span attribute**, following the GenAI convention that
[12.2](../module-12/lesson-02.md) introduced. It is not a field on the span. So:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load, record, regressions_from; d=load('support'); t=record(d,n=57,split='dev',fail_rate=0.15,seed=1); print('raw span error key  :',sum(1 for x in t for s in x['spans'] if s.get('error')),'broken spans'); print('attributes error.type:',len(regressions_from(t)),'failing traces')"
```

```
raw span error key  : 0 broken spans
attributes error.type: 24 failing traces
```

**Zero and twenty-four, from the same data.** The naive read gives you an empty list, an empty list gives
you a healthy window, and a healthy window gives you a decision not to look. This is why the lesson is
worth a test:

```python
def test_regressions_are_found_and_not_silently_empty(data):
    """`error.type` lives in the span's attributes, not on the span. ..."""
    traces = record(data, n=57, split="dev", fail_rate=0.15, seed=1)
    regs = regressions_from(traces)
    assert regs, "planted failures were not found; the loop is silently empty"
    assert all(r.category for r in regs)
```

The assertion message is the design statement: **the loop's failure mode is silence, so the test asserts
non-silence first.** An empty list from a monitoring loop is not a neutral result; it is the shape a broken
loop and a quiet night both have.

Note also what counts as a failure: a span carrying `error.type`, which is either a check rejecting the
answer or a call that raised. Not "a human read it and frowned", because nobody is reading the stream.
That is a real limitation and it is the gap [14.2](lesson-02.md) measured — the `wrong_fact` and
`over_refusal` failures that no span ever flags do not arrive here, which is exactly why modules 1 and 2
were about reading traces by hand and why 14.1's sample has to keep every failure rather than a random
share of requests.

### Step two: name the failure

`regressions_from` fills `Regression.category` with the *span's own* error type, and this is worth being
precise about, because it is where the loop is thinnest:

```
24 failing trace(s) of 57
categories: {'no_handbook_citation': 14, 'RuntimeError': 6, 'no_matching_section': 4}
```

Those are **trigger names, not failure names**. `no_handbook_citation` is a check that fired;
`RuntimeError` is a class of exception; `no_matching_section` is a retrieval result. What the team needs
to know is *why the answer was wrong* — the taxonomy from [02.3](../module-03/lesson-03.md) — and the loop
cannot supply that, because deciding it requires a person who has read the answer.

This is the first honest boundary in the module, and it is why `as_test_case` takes a `category` argument
that **overrides** the span's name:

```python
tc = reg.as_test_case(human_label=0, judge_verdict=1, category="out_of_scope")
```

Both are available and the override wins. The code is not confused; the code is saying the span's name is
a starting point and a human supplies the category.

### Step three: the test case, and the field that is the point

`as_test_case` emits exactly the five keys `evallab.dataset.Item` needs. Here is the first regression from
the dev window, verbatim:

```json
{
  "id": "tr_s01",
  "question": "How many days of paid time off do I get each year?",
  "outputs": {
    "v1": "You get 25 days of paid time off per year, accrued monthly."
  },
  "human": {
    "v1": {
      "label": 0,
      "category": "no_handbook_citation",
      "critique": "span error: no_handbook_citation"
    }
  },
  "slice": {
    "intent": "production",
    "difficulty": "unrated"
  }
}
```

Read the signature against the body:

```python
def as_test_case(self, human_label: int, judge_verdict: int,
                 category: str | None = None) -> dict:
```

**`judge_verdict` is accepted and never read.** The function takes the model's opinion, throws it away,
and writes the human's. The test says so out loud:

```python
def test_a_regression_becomes_a_test_case(data):
    reg = regressions_from(traces)[0]
    tc = reg.as_test_case(human_label=0, judge_verdict=1)
    assert tc["human"]["v1"]["label"] == 0, "the human label is the point of the test case"
```

`human_label=0`, `judge_verdict=1`, and the case is labelled `0`. This is not an oversight to be tidied
up; it is the whole design in one signature. A test case's label is what the suite is *scored against*. If
the judge's verdict became the label, the suite would be scoring itself, and a judge that drifted would
quietly relabel the ground truth. **The human label is the one field in the whole course that nothing
computes for you**, and it is the field the loop exists to fill.

Two other fields are placeholders, and placeholders are a design smell you should notice rather than fix
quietly:

- **`"critique": "span error: no_handbook_citation"`** is not an explanation. It is a copy of the trigger.
  It is non-empty, and the test asserts non-empty, and **non-empty is not the same as explanatory**. The
  docstring's own claim — *"a test case with no explanation gets re-argued"* — is true, and this critique
  does not discharge it: the next person to read `tr_s01` learns that a check fired, and not one word
  about why the answer was wrong or what the right answer was. Writing the critique is step four of the
  loop and it does not happen in code.
- **`"slice": {"intent": "production", "difficulty": "unrated"}`** is an honest admission that the loop
  does not know how to classify the item. `difficulty: unrated` means the item is in the suite and not in
  any slice, so it cannot break a slice gate and cannot be found by a slice query. That is a *useful*
  state — it is visible — and it is also how a suite grows a permanently unmeasured tail.

### Step four: the failures you cannot turn into test cases

Not every failure in the window is a test case, and knowing which ones are not is part of the loop:

```
with the question on the chat span: 18 of 24
empty-question ids: ['tr_s02', 'tr_s10', 'tr_s31', 'tr_s51', 'tr_s82', 'tr_s89']
```

Six of the twenty-four have **no question on them at all**, and all six are the `RuntimeError` traces: the
model call raised, and the exception fired before the span ever recorded `question` or
`gen_ai.output.messages`. Turn one of them into a test case and you get this:

```json
{
  "id": "tr_s02",
  "question": "",
  "outputs": { "v1": "" },
  "human": { "v1": { "label": 0, "category": "RuntimeError",
                     "critique": "span error: RuntimeError" } },
  "slice": { "intent": "production", "difficulty": "unrated" }
}
```

**A test case with an empty question is not a test case.** It will run, it will be scored, and it will
tell you that the system got a request with no content wrong, forever. The honest response is not to
discard them — a raised call is a real failure and it deserves a row in the incident view — it is to keep
them **out of the suite** and to fix the *recording*: put the request on the root span, where it exists
before the call is made, instead of on the chat span, which is only reached if the call succeeds. The
loop is a sensor, and this is a place where the sensor is mounted badly.

### Step five: know whether it is already covered

`in_suite` answers the question the loop cannot ask on its own — have we already got this one? — and it
is driven entirely by the dictionary you hand it:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from evallab import load, record, regressions_from; d=load('support'); t=record(d,n=57,split='dev',fail_rate=0.15,seed=1); r=regressions_from(t); print('in_suite, labelled by trace id:',regressions_from(t,human_labels={x.item_id:0 for x in r})[0].in_suite); print('in_suite, labelled by item id :',regressions_from(t,human_labels=d.dev_ids)[0].in_suite); print('item ids look like',d.dev_ids[:3],' trace ids look like',[x['trace_id'] for x in t[:3]])"
```

```
in_suite, labelled by trace id: True
in_suite, labelled by item id : False
item ids look like ['s26', 's30', 's10']  trace ids look like ['tr_s01', 'tr_s02', 'tr_s03']
```

**The join key is the trace id (`tr_s01`) and the suite's key is the item id (`s01`).** Hand the function
`dev_ids` and every single regression reports `in_suite: False` — including the ones you added last week,
including the ones you are about to add again. And it looks *fine*: a list of fresh production failures,
all of them genuinely new-looking, none of them duplicates. `in_suite` is the deduplication the loop
depends on, and the deduplication depends on a mapping somebody has to write down.

The second lesson from this is about **who labels**. `human_label` is an argument to
`as_test_case`, and nothing in the pipeline can supply it. In a small team that is one engineer, reading
the trace and typing `0` or `1`. At volume it is a queue, and a queue with a turnaround time of a week
turns the loop into a post-mortem process — which is better than nothing and much worse than a loop, and
the difference is entirely the latency between finding a failure and guarding it.

## Show me

From this repository, with no model and no API key. The failures are planted at a known rate with
`record(..., fail_rate=0.15)`, which raises inside the model call on hashed request ids.

The window, read four ways:

```console
$ py -c "import sys; sys.path.insert(0,'labs/common'); from collections import Counter; from evallab import load, record, regressions_from; d=load('support'); t=record(d,n=57,split='dev',fail_rate=0.15,seed=1); r=regressions_from(t); print(len(r),'failing trace(s) of',len(t)); print('categories:',dict(sorted(Counter(x.category for x in r).items()))); print('with the question on the chat span:',sum(1 for x in r if x.question),'of',len(r)); print('empty-question ids:',[x.item_id for x in r if not x.question])"
```

```
24 failing trace(s) of 57
categories: {'no_handbook_citation': 14, 'RuntimeError': 6, 'no_matching_section': 4}
with the question on the chat span: 18 of 24
empty-question ids: ['tr_s02', 'tr_s10', 'tr_s31', 'tr_s51', 'tr_s82', 'tr_s89']
```

The first one, as a test case, with the judge's verdict passed in as `1` and the human's label as `0`:

```console
$ py -c "import sys, json; sys.path.insert(0,'labs/common'); from evallab import load, record, regressions_from; d=load('support'); t=record(d,n=57,split='dev',fail_rate=0.15,seed=1); print(json.dumps(regressions_from(t)[0].as_test_case(human_label=0,judge_verdict=1),indent=2))"
```

```json
{
  "id": "tr_s01",
  "question": "How many days of paid time off do I get each year?",
  "outputs": {
    "v1": "You get 25 days of paid time off per year, accrued monthly."
  },
  "human": {
    "v1": {
      "label": 0,
      "category": "no_handbook_citation",
      "critique": "span error: no_handbook_citation"
    }
  },
  "slice": {
    "intent": "production",
    "difficulty": "unrated"
  }
}
```

`label: 0`. The `judge_verdict=1` on the command line does not appear anywhere in the object.

The tests, four of which are the loop:

```console
$ py -m pytest tests/test_online.py -q
16 passed in 0.04s
```

`test_regressions_are_found_and_not_silently_empty` asserts the list is non-empty first.
`test_a_regression_becomes_a_test_case` asserts the human label lands in the case and the critique is
present. `test_a_test_case_can_be_known_to_be_in_the_suite` asserts `in_suite` flips to `True` when the
trace id is in `human_labels` and stays `False` when it is not — the whole of the `tr_s01` / `s01` story
in four lines.

> [!IMPORTANT]
> The failures are **planted**: `record(..., fail_rate=0.15, seed=1)` decides which requests will raise
> before it records anything, using the same hash the sampler uses. The `RuntimeError` category is the
> real exception class from a raised `RuntimeError` inside the model span, and `tr_s02`, `tr_s10`,
> `tr_s31`, `tr_s51`, `tr_s82` and `tr_s89` are the six requests that were chosen to raise. The model
> itself is this repository's shipped educational model — a recorded answer, not a live LLM — so nothing
> here is a measurement of a model in the wild, and nothing is priced. Every count is real arithmetic over
> the shipped code and the shipped items.

## Try it

**Predict first**, on paper:

1. You read `span["error"]` instead of `span["attributes"]["error.type"]` on a window with 24 planted
   failures. Predict what the loop returns, what the dashboard above it shows, and what the team concludes.
2. Six of the twenty-four failures have no question on the chat span. Predict what the test case looks like
   when you convert one, and say whether the resulting suite entry is doing any work.
3. `as_test_case` is called with `human_label=0, judge_verdict=1`. Predict what the case's `label` is, and
   explain what would break in the suite if the judge's verdict were written instead.
4. You pass `dev_ids` as `human_labels` and every regression reports `in_suite: False`. Predict which
   number the loop will report as "new failures this week" after a year of this, and say what the fix is.

[Lab: evallab package](../../labs/common/)

1. **Run the loop and write the loop down as a table.** For the dev window at `fail_rate=0.15`: the number
   of traces, the number of failing traces, the category counts, the number with a question, and the
   number already in the suite. Then write the one sentence that says what happens to the suite if the
   last column is all zeros — and go and read the `tr_` prefix out loud while you say it.
2. **Break the attribute read on purpose.** Change `err(s)` to `s.get("error")`, run the loop, and record
   what comes back. Then restore it and add the test from `test_regressions_are_found_and_not_silently_empty`
   to whatever you build next. Write down why an empty list is the *worst* possible return value here and
   not a neutral one.
3. **Convert all 24, then read them.** Build the test case for every regression and print them. For each,
   write what a human would have to add that the code cannot: a real category, a real critique, a rating
   of how much the answer matters. Then count how many of the 24 you would actually be willing to sign,
   and say what that number tells you about labelling capacity.
4. **Separate the labelgable from the unlabelable.** Take the six with empty questions. Write out the test
   case for one, then find the line in [`evallab/observe.py`](../../labs/common/evallab/observe.py) that
   puts the question on the chat span, and say where it has to move so that a raised call is still
   readable. Say what the incident view should do with them in the meantime.
5. **Write the critique by hand for `tr_s01`.** Not `"span error: no_handbook_citation"` — the sentence a
   person would write after reading the trace, naming the right answer and what the fix has to guarantee.
   Then write the second sentence of the pull request that adds the item, and check it against the
   assertion `assert tc["human"]["v1"]["critique"]`, which only checks that it is not empty.

## Break it

**Read the error attribute from the span instead of its attributes.** `0` broken spans and a healthy
window from a window with 24 real failures. The lie: **an empty list from a monitoring loop is
indistinguishable from a quiet night**, and the correct-looking behaviour is the broken one. Every
monitoring function should have a test that fails when it returns nothing.

**Take the judge's verdict as the label.** Write `judge_verdict` into the case and the loop closes without
a human anywhere. The lie: **a test case's label is what the suite is scored against, so putting the judge
in that field makes the suite grade its own homework** — and a judge that drifts relabels the ground truth
rather than disagreeing with it.

**Convert every failure, including the ones with no question.** Twenty-four items in the suite, six of
them scored against an empty prompt, `difficulty: unrated` so they never appear in a slice report. The
lie: **a test case with no question is a permanent, invisible, un-arguable green check** — the suite gets
slightly bigger and the specific thing you learned is lost.

**File the critique the span gives you.** `"span error: no_handbook_citation"` is a trigger name wearing
an explanation's clothes. The lie: **non-empty is not explanatory**, and the next person to read the item
learns which check fired and nothing about why the answer was wrong — which is the thing the incident
would have had to explain.

**Treat `in_suite: False` as a new failure every week.** Pass the wrong key, or pass nothing, and every
regression looks brand new. The lie: **deduplication that silently never matches is worse than no
deduplication**, because the list keeps growing and the suite never does, and the growth is the thing
everybody looks at.

**Fix it in the pull request and stop there.** The two-line retrieval fix ships, the customer's answered,
and the knowledge leaves with the engineer. The lie: **a fix with no item behind it is a coincidence that
lasted one release**, and the suite's job is to turn the coincidence into a guarantee.

## Fix it

1. **Assert non-emptiness first.** The loop's test begins `assert regs, "planted failures were not found;
   the loop is silently empty"`. Any function whose failure mode is silence needs a test that fails on
   silence, before any assertion about its contents.
2. **Read `error.type` from the span's `attributes`, and say so in the docstring.** The shipped
   `regressions_from` does; the paragraph explaining why is worth keeping, because the naive read is the
   one everybody tries first.
3. **Keep the human label as the only source of the case's label.** `as_test_case` takes `judge_verdict`
   and drops it, and the test asserts the human's value. If you extend the function, do not add the
   judge's verdict to `label`; put it somewhere it can be compared *against* the label instead.
4. **Write the critique, by hand, in the pull request that adds the item.** A person, a sentence, the right
   answer, and what the fix has to guarantee. The field is non-empty by default and the default is not
   good enough; that is what `assert tc["human"]["v1"]["critique"]` does not check.
5. **Keep unlabelable failures out of the suite and fix the recording.** Put the request on the root span
   so a raised call is still readable, and give the unlabelable ones a row in the incident view rather
   than a row in the dataset.
6. **Write down the id mapping and test it.** The suite's key is the item id and the trace's key is
   `tr_<item id>`; keep a dictionary, and add a test that a known trace id comes back `in_suite: True`.
7. **Time the loop and publish the number.** The time between a failure appearing in production and a
   labelled item existing in the suite is the loop's real latency, and it is the number a team can improve
   without becoming more rigorous.

## How do I know it works?

**Challenge, on dev.** The 57 dev requests at `fail_rate=0.15`, and six checks before the loop is allowed
to run unattended:

- **The loop returns something, and the test fails if it does not.** `assert regs` comes first. A loop
  that can return an empty list from a window with failures has no monitor, whatever the dashboard says.
- **The signal is read from `attributes["error.type"]`, and you can say why.** `0` on the naive read, `24`
  on the correct one, from the same window.
- **Every category count is a trigger name you have renamed by hand.** `no_handbook_citation` 14,
  `RuntimeError` 6, `no_matching_section` 4 — and for each, a decision about which taxonomy bucket the
  item actually belongs in. A category copied from a span name is a trigger, not a finding.
- **Every critique in the suite is a sentence a person wrote.** None of them is `"span error: ..."`. The
  assertion only checks non-empty, so this one is on you, and it is the difference between a test case and
  an anecdote.
- **The unlabelable six are accounted for and out of the suite.** Six items, named, with a decision
  recorded about where they go instead.
- **`in_suite` is tested against a known id**, and you can produce `True` and `False` on demand. A
  deduplication you have not watched work is a deduplication that might not be.

**Then one held-out validation**, on the **37 test items**, with the loop unchanged:

| | dev, 57 | held-out, 37 |
|---|---|---|
| Failing traces | **24 of 57** (42.1%) | **16 of 37** (43.2%) |
| `no_handbook_citation` | 14 | 9 |
| `no_matching_section` | 4 | 2 |
| `RuntimeError` | 6 | 5 |
| With a question on the chat span | 18 of 24 | 11 of 16 |
| Empty-question ids | `tr_s02, tr_s10, tr_s31, tr_s51, tr_s82, tr_s89` | `tr_s25, tr_s36, tr_s43, tr_s67, tr_s74` |

Three things in that table are the check, and the third is the one that closes the course.

- **The loop transfers.** Same three categories, same shape, on requests it has never seen — 42.1% and
  43.2% failing, and the mix of triggers in the same order. A loop that only worked on the half you
  developed against would be a filter over your own dev set, not a monitor.
- **The unlabelable fraction transfers too, at roughly the same level.** `18 of 24` with a question on
  dev, `11 of 16` on test — 75.0% and 68.8% — and the empty ones are the same failure: a call that raised
  before the span recorded the request. That is a property of *where the recorder is mounted*, not of the
  data, so it holds everywhere and it is fixable once.
- **The held-out run produces test cases nobody has looked at, and that is the point.** Those sixteen
  `Regression` objects are exactly the raw material of modules 1 and 2: sixteen traces, open-coded, turned
  into a taxonomy, cut into slices. Module 2 began by reading outputs and naming failures, and this is
  where that act runs on production and writes its result back into the suite. **The loop's output is not
  a number; it is a queue of things a person has to read.** Sixteen items is a day of work for one
  engineer, and a suite that did not absorb them has spent a sampling budget for nothing.

## Use / don't use

**Do keep the loop boring and human at exactly one point.** Everything up to `human_label` is code:
attribute read, trigger name, test-case shape. Everything after it is a person reading an answer. The
faster you make the code, the more the queue is the bottleneck, and the bottleneck is supposed to be the
person who knows what the right answer was.

**Do write a critique for every item you add.** A sentence, in the pull request, by a person. It is the
only artefact in this module that nothing can generate, and it is the one that stops the next quarter's
argument.

**Do assert non-emptiness on anything that monitors.** The first line of the test is the feature. An empty
list is the shape of both a quiet night and a broken loop, and only one of them is good news.

**Do keep the unlabelable failures somewhere visible.** They are real, they are a quarter of the window,
and they are a sensor bug rather than a product bug. Fix the recorder; meanwhile put them in the incident
view, not in the dataset.

**Do time the loop.** Failure appears → item labelled → item in the suite → run in CI. Four steps, and the
gap between the first and the last is the thing a team can actually improve.

**Don't take the judge's verdict as the label.** The signature already ignores it; keep ignoring it. A
suite that grades itself cannot detect its own drift, and the whole course exists to make drift visible.

**Don't file the span's error name as the category or the critique.** `no_handbook_citation` says which
check fired. It does not say what was wrong, and a taxonomy is only a taxonomy if somebody chose which
bucket an item is in.

**Don't let the suite grow without a dedup key.** The loop's key is the trace id and the suite's key is
the item id, and passing the wrong one gives you a growing list of "new" failures that are not new — a
report that is wrong in the direction that looks like progress.

**Don't run the loop once and call it a process.** One extraction is a script. The thing worth building is
a queue with an owner, a turnaround time you have written down, and a rule for what happens when it is
more than a week old.

What teams actually do: a nightly job that pulls the [14.1](lesson-01.md) sample, a detector on
`error.type`, and a review queue that a named person works on. The queue is sorted by the failure
category from [14.2](lesson-02.md)'s blind-spot list, because the checkable failures get triaged
automatically and the un-checkable ones are the ones a human is needed for. Each item that survives gets
a label, a written critique, a real category, and a pull request — and the pull request is the artefact,
because it is the one place where the label, the reason, and the fix that motivated it all appear
together. **A loop that produces a queue of failures is a process. A loop that produces labelled items in
a suite is a closed loop**, and the difference is entirely whether somebody read the answers.

## Reflect

1. The loop returns 24 `Regression` objects and `in_suite` is `False` for all of them, because the labels
   were passed as dataset item ids. Write the three lines you would put in the weekly report, and say what
   the number "24 new production failures" would have meant by the end of the year.
2. Six of the 24 failures have no question on them. Write the pull request that fixes the recorder,
   including the line that proves the fix, and say what you would do with those six this week.
3. `as_test_case` accepts a judge verdict and drops it. Write the argument for keeping it that way, in
   three sentences, for somebody who wants to close the loop with no humans in it at all.
4. A production failure gets fixed, gets filed as `tr_s01` with the critique `span error: no_handbook_citation`,
   and comes back in April. Write the critique you should have written in January, in two sentences, and
   say which of the two the suite would have caught.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the argument underneath the whole
  loop: an eval that never grows is an eval that only measures what was already thought of, and production
  is where the rest of the failures arrive.
- OpenTelemetry, [Semantic conventions for generative AI
  systems](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — where `error.type` and
  `gen_ai.output.messages` are defined, which is why this lesson reads the first from `attributes` and not
  from the span, and why a `Development`-status spec means a rename here is a silent-empty loop rather
  than an error.
- Samuel Bowyer et al., [The Mythos of Model
  Evaluation](https://arxiv.org/abs/2411.19994) (2024) — the reason a failure that is not written down
  does not exist as far as the next person is concerned, which is the cost side of the "labelled, not
  just found" argument.
- Ron Kohavi, [A Study of Cross-Validation and Bootstrap for Accuracy Estimation and Model
  Selection](http://www.jmlr.org/papers/volume2/kohavi01a/kohavi01a.pdf) (2001) — the same discipline at
  the scale of one item set: a suite that grows during the measurement is measuring a different suite each
  time, and a production-derived item is a change to that suite that has to be accounted for like any
  other.
