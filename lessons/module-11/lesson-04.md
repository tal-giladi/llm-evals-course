---
id: "11.4"
module: 11
minutes: 18
practice_minutes: 45
prerequisites: ["11.2", "03.1"]
objectives:
  - Name the four things an eval framework provides, and say which of them the plain pytest suite you already wrote provides too.
  - Map a named concept from this course — a scorer, a repeat, a cache, a slice — onto what promptfoo, Inspect AI and DeepEval each call it, and say where the mapping stops.
  - Explain why no framework computes your TPR, TNR and kappa, and what that implies about which part of a judge you can delegate.
  - Read a framework's headline score and say whether it is your system's pass rate, your judge's pass rate, or agreement with your humans.
volatility: implementation
sources:
  - title: "Promptfoo — Intro"
    url: https://www.promptfoo.dev/docs/intro/
  - title: "Inspect — an open-source framework for LLM evaluations (UK AI Security Institute)"
    url: https://inspect.aisi.org.uk/
  - title: "DeepEval — 5-minute quickstart"
    url: https://deepeval.com/docs/getting-started
  - title: "The Mythos of Model Evaluation (Bowyer et al., 2024)"
    url: https://arxiv.org/abs/2411.19994
last_verified: "2026-10-01"
---

# 11.4 · Mapping the same suite onto a framework

You now have a suite in plain pytest that runs a judge, scores it against human labels, and reports kappa
by hand. This lesson puts the three frameworks most teams reach for next beside it, one concept at a time,
so that adopting one is a translation rather than a rewrite — and so that you can still say which number on
the resulting dashboard is the pass rate.

## Why it matters

A team has a support bot. An engineer finds promptfoo, writes a YAML file in an afternoon, and has a
dashboard by Friday. Six weeks in, a gate fires. The dashboard says the score fell from **86.5%** to
**81.0%**. The engineer looks at the pull request and sees a one-line change to a retrieval threshold. The
reviewer looks at the dashboard and sees a five-point drop. Nobody can answer the only question that
matters: **is the system worse, or did the judge move?**

And the reason nobody can answer it is a sentence that is true of all three frameworks and is the whole
lesson. **All three score an output against something. None of them scores your output against your
humans**, because your humans are a file on your disk that they have never seen and were not built to
read. What a framework gives you is the first half of a judge validation — a runner, a scorer and a report
— and the second half, which is the half this course spent three modules on, is yours to keep.

Here is the number that makes the point, from one real run of the suite you built. The held-out split is
**37 items**:

```console
$ py -m evallab.cli run --judge c-rubric-3b --variant v1 --split test
eval: 43.2% pass on n=37  (test, Llama 3.2 3B · Rubric · 0 shots)
  kappa 0.73   TPR 82.4%   TNR 90.0%   accuracy 86.5%
```

**43.2% and 86.5%, in the same run, 43 points apart.** One is the share of items the judge passed. The other
is the share of items where the judge agreed with a human. A system that passes fewer than half its own
eval set is 86.5% accurate as a judge, and a dashboard that leads with accuracy has told you a system is
in good health by measuring the opposite of what you shipped.

That is not a bug in any framework. Accuracy is a real metric and the confusion matrix behind it is
correct. It is a bug in reading one number without its row, and the fix is cheap: you already know what the
row is, because you computed it.

## How it works

### What a framework actually gives you

Strip away the install instructions and an eval framework does four things. You have all four already,
which is why the decision this course took — **plain pytest first, with a framework shown alongside** — is
a consequence rather than a preference.

| What it does | In `evallab` | In a framework |
|---|---|---|
| Runs the thing under test over a dataset | `run_suite()` over `Dataset.items_for(split)` | a task/dataset/solver: a provider or app, called per sample |
| Turns an output into a pass or fail | `RecordedJudge.samples()` → `MajorityJudge.verdict()` | a **scorer** — a rule, a similarity check, or a model-graded rubric |
| Repeats, samples, and controls decoding | `MajorityJudge(repeats=…)`, `threshold=…` | repeat/epoch settings and per-run sampling parameters |
| Prints a report you can read in ten seconds | `SuiteResult.__str__` and the CLI's disagreement list | a table, a viewer, a results file |

Four rows, three of which you have written. That is the honest accounting of what a framework buys: **a
better runner and a bigger scorer library, in exchange for your control over the report and the cache.**

### The three, described honestly

**promptfoo** — MIT licensed, TypeScript, runs from a Node CLI or as a library. You describe an eval as
YAML: which prompts, which test cases, which providers, which assertions. It is the strongest of the three
at the *matrix* view — the same test set scored under several prompts or several models side by side, which
is exactly the A/B panel from [10.1](../module-10/lesson-01.md) — and it has first-class providers for
local models, so it can drive the container from the last lesson. Its assertions cover the deterministic
ground from [3.1](../module-03/lesson-01.md): contains, regex, JSON schema, similarity, and LLM-rubric. It
has caching and a GitHub Action, and it runs entirely locally.

**Inspect AI** — MIT licensed, Python, built by the **UK AI Security Institute** (with Meridian Labs). Its
model is the one this course already teaches: an eval is a `Task` made of a **dataset** (labelled samples,
`input` and `target`), a **solver** (what produces the answer), and a **scorer** (what grades it). You
register a task with `@task` and run it with `inspect eval my-task.py --model …`, then read it with
`inspect view`. It has a caching page, repeat support, per-scorer metrics, a log viewer, and built-in
sandboxing for tool-using agents. Its 20-plus providers and support for local inference make it the closest
of the three to a research lab's setup, and the least like a drop-in config file.

**DeepEval** — Apache-2.0, Python, and a **pytest plugin**: it collects and runs your eval files the way
`pytest` already would, via `deepeval test run`. A test case is an `LLMTestCase` with a required `input` and
`actual_output` and an optional `expected_output`; you assert on it with `assert_test`, parameterise with
`pytest.mark.parametrize`, and write your own metric with `@evaluate`. It has a large library of
model-graded metrics, and it can store results centrally through Confident AI — which is the one place on
this list where eval data may leave your machine, and a thing to decide about deliberately.

The three differ in the one dimension that matters most for this course: **how much of the report you get
back**. All three hand you a pass rate. None of them hands you a TNR.

### The mapping, concept by concept

> [!NOTE]
> **This table is the author's reading of three projects' documentation, and this repository implements none
> of them.** It is a translation table, not a result. `evallab` here is plain Python and pytest; nothing in
> `labs/common/` imports promptfoo, Inspect or DeepEval, and nothing in this course has been executed
> against any of them. Exact flag names and config keys change between releases — treat the three project
> links in `## Sources` as the authority and this table as a way to know which page to go read.

| This course | `evallab` | promptfoo | Inspect AI | DeepEval |
|---|---|---|---|---|
| The system under test | `variant` (`v1`, `v2`, …) | `prompts` + `providers` | the **solver** | the app you call to fill `actual_output` |
| A labelled eval set | `datasets/support.json`, `dev_ids` / `test_ids` | `tests:` in YAML | the **dataset**, `input` / `target` | a list of `LLMTestCase` |
| A deterministic check | an `assert` in `tests/` | a non-LLM assertion | a `scorer` | a non-LLM metric |
| An LLM judge | `RecordedJudge` / `MajorityJudge` | an LLM-rubric assertion | `model_graded_qa()` and similar | a model-graded metric |
| The judge's own verdict | `judge_metrics()` — kappa, TPR, TNR | **nothing** | **nothing** | **nothing** |
| A human label | `item.human[variant].label` | `vars` in the test case, if you use it as one | `target`, if you use it as one | `expected_output`, if you use it as one |
| Repeats | `repeats=3` on `MajorityJudge` | repeat the test case, or parameterise it | an epochs/repeat setting on the task | parameterise the test, or loop |
| Decoding settings | `decoding` in `cache_key` | provider options | provider options | provider options |
| Caching | `cache_key()` | a caching layer | a caching layer | a caching layer |
| A slice | `slice.intent`, `SliceScore` | grouping by test metadata | dataset grouping / scorers per group | tags and metadata |
| The report | `SuiteResult.__str__` | table + web viewer | `inspect view` | pytest output + Confident AI |

Two rows carry the whole lesson. **`The judge's own verdict` is empty in all three columns**, and
**`A human label` is a normal input in all of them but is not the same thing in any of them.** In a
framework, `expected_output` is the *answer the output is compared to*. In this course, the human label is
*the verdict a person reached, which the judge's verdict is then measured against*. Same file, two different
jobs, and confusing them is exactly how a team ends up with an 86.5% "score" on a 43.2% pass rate.

### The part that does not map, and why pytest came first

Draw the confusion matrix by hand from the 37 test items and every number above falls out of it:

| | Human passed | Human failed |
|---|---|---|
| **Judge passed** | **tp = 14** | **fp = 2** |
| **Judge failed** | **fn = 3** | **tn = 18** |

```
judge pass rate = (14 + 2) / 37 = 16/37 = 43.2%     <- the system's score, as the judge sees it
TPR             = 14 / (14 + 3)  = 14/17 = 82.4%   <- of the humans' passes, how many it caught
TNR             = 18 / (18 + 2)  = 18/20 = 90.0%   <- of the humans' failures, how many it caught
accuracy        = (14 + 18) / 37 = 32/37 = 86.5%   <- of all items, how often the two agreed
```

Kappa is the one number you cannot read off the table, and it is the same arithmetic as [6.3](../module-06/lesson-03.md):
observed agreement 0.865, expected agreement if both merely copied the majority label 0.505, so
kappa = (0.865 − 0.505) / (1 − 0.505) = **0.73**. The run printed that, and the four-cell table is where it
came from.

Now the sentence that justifies the whole lesson. **Every one of those five numbers is a function of the
`tp`/`fp`/`fn`/`tn` cells, and every one of those cells is a function of a human label.** A framework
computes the judge's row of the table. It cannot compute the humans', because the humans are a labelled file
in your repository and are the most valuable thing in it — they are what a framework's model-graded scorer
is *standing in for* until you have measured it against them.

So the division of labour is not "framework versus hand-written". It is:

- **Delegate the runner.** Model calls, retries on malformed output, parallelism, caching, provider
  plumbing, a viewer. This is real work and you should not write it again.
- **Keep the scorer that needs your labels.** TPR, TNR, kappa, the disagreement list, the corrected pass
  rate. This is the part a framework cannot do for you and the part that decides whether a gate firing
  means anything.

If you adopt a framework, adopt it as a **second reader on the same items and the same recorded verdicts**,
and keep the plain suite as the source of truth. Then the comparison is the interesting artefact, and it is
one you can actually run: both read the same `datasets/support.json`, and a disagreement between them is a
finding rather than a migration.

## Show me

The plain suite, both splits, and the test that keeps the arithmetic honest. All of it from
`labs/common/`, no model, no container:

```console
$ py -m evallab.cli run --judge c-rubric-3b --variant v1 --split dev
eval: 59.6% pass on n=57  (dev, Llama 3.2 3B · Rubric · 0 shots)
  kappa 0.79   TPR 96.7%   TNR 81.5%   accuracy 89.5%

6 disagreement(s). These are the work:
  s01  human=0 judge=1  (no_citation)
  s38  human=1 judge=0  (correct)
  s60  human=0 judge=1  (wrong_fact)
  s64  human=0 judge=1  (no_citation)
  s73  human=0 judge=1  (no_citation)
  ... and 1 more
```

```console
$ py -m evallab.cli run --judge c-rubric-3b --variant v1 --split test
eval: 43.2% pass on n=37  (test, Llama 3.2 3B · Rubric · 0 shots)
  kappa 0.73   TPR 82.4%   TNR 90.0%   accuracy 86.5%

  1 slice(s) contain no failing items, so their true-negative rate is not measurable: out of scope
```

```console
$ py -m pytest tests/ -q
17 passed in 0.64s
```

One thing in that output is what a framework hands you, and three are what it does not:

1. **The pass rate.** A framework gives you this, in one line, and it means the same thing here and there:
   the share of items the scorer passed.
2. **kappa, TPR, TNR.** Yours, from your labels. Not on any of the three dashboards.
3. **The disagreement list, with ids and categories.** Yours. `s01 human=0 judge=1 (no_citation)` is the
   unit of work in a judge review, and no framework prints it because it does not know what a human said.
4. **`1 slice(s) contain no failing items, so their true-negative rate is not measurable`.** The honest
   reporting of a measurement that cannot exist. A dashboard has no way to render this, because it has no
   concept of a slice that has no negatives.

> [!IMPORTANT]
> The recorded judge runs behind all of these numbers come from the same seeded educational model as the
> browser labs in Modules 1–10, not from a real LLM. The statistics are computed for real. The model names
> in the judge menu are the labels recorded runs are filed under, not measurements of those models in the
> wild — and this course has not executed `evallab` against promptfoo, Inspect or DeepEval, or against
> Ollama, at any point.

## Try it

**Predict first**, on paper:

1. The held-out run prints a pass rate of 43.2% and an accuracy of 86.5%. A dashboard leads with accuracy.
   Is the system in good health, and what single number from the run tells you?
2. A framework scores an output against `expected_output`. This course scores a judge against a human
   label. Both fields are called "the reference". What goes wrong if you treat them as the same field?
3. Your framework run and your pytest run disagree on 4 of 57 items. Name the three causes you would
   check, in the order you would check them.

[Lab: evallab package](../../labs/common/)

1. **Read your own report as a stranger would.** Run both splits, then write the four numbers from each on
   a blank piece of paper with no labels on them. Hand the paper to someone who has not read this course
   and ask them which number they would put on a dashboard. Then add the labels back — *judge pass rate*,
   *accuracy against humans*, *true-negative rate*, *kappa* — and ask again. The gap between the two
   answers is the failure this lesson is about, reproduced in a room.
2. **Build the confusion matrix by hand for one judge and both splits.** `c-rubric-3b`, dev and test. Fill
   in `tp`/`fp`/`fn`/`tn` from the run, then compute the pass rate, accuracy, TPR and TNR yourself with a
   calculator. Every number must match the printed one. Then compute kappa from
   `(po − pe) / (1 − pe)` and check it against 0.79 and 0.73. Doing this once is what makes the mapping
   table above a translation rather than a slogan.
3. **Plan the cross-check before you have a framework.** Write out the two result tables a framework run
   would produce for the 57 dev items, side by side with the plain suite's, with the item id in the first
   column of both. Then work out what a disagreement on 4 of those 57 items could mean, what it could not,
   and the order you would investigate the three candidate causes in. That order is the answer to
   prediction 3, and writing it down is the only way to check later that you investigated in it.
4. **Decide the adoption criterion in writing.** For your own project, write the sentence: *we adopt a
   framework when one named bottleneck is in the way, and we keep plain pytest for one named thing.* If the
   second blank is hard to fill, that is the finding, and it is the answer to prediction 2.
5. **If you want to see it for real, read the three docs rather than a blog post.** The links are in
   `## Sources`. For each one, find the page that answers "where do my test cases live" and the page that
   answers "what happens when the scorer is wrong". Write down, for each framework, whether a wrong scorer
   is *visible*. That word is the whole difference between the three, and it is the reason the second half
   of this lesson stays in Python.

## Break it

**Adopt the framework first.** The pull request is "add promptfoo, replace the eval suite", and the
reviewer cannot tell what the suite measured before, so the review is a rubber stamp on a change whose only
reviewable content is a dependency bump. The lie: **a framework is a large diff in which the assertions are
a small part**, and reviewing it as a dependency change means reviewing none of the parts that matter.

**Lead the report with accuracy.** 86.5% on the held-out split, next to a 43.2% pass rate. A system that
passes fewer than half its own eval set is presented as healthy because the judge agreed with the humans.
The lie: **agreement and performance are different quantities and only one of them is about your product** —
and which one a dashboard leads with is a decision, not a fact.

**Let `expected_output` do the humans' job.** A framework scorer comparing an output to a reference answer
looks, on a whiteboard, exactly like a judge scored against human labels. They are not: the reference is
the *right answer*, and the human label is *a verdict*. Swap one for the other and you have quietly
replaced "did the judge agree with a person" with "did the output match a string", which measures a
different system and reports a different number with the same name. The lie: **a field called "the
reference" in a framework and a field called "the human label" in a judge are the same shape and different
questions**, and only one of them needs the labelling budget.

**Keep two suites on two item sets.** The plain suite on 57 dev items, the framework run on whatever
`tests:` the YAML happens to contain. The scores differ, everyone assumes the framework is measuring
something different or better, and the disagreement is unresolvable because the two runs never saw the same
question twice. The lie: **two dashboards you cannot join on an item id are two opinions, not a cross-check.**

**Read a leaderboard as a result.** Model and prompt variants in a matrix view, ranked. Every row is one
system, one prompt, one item set and one scorer, and the rank is meaningless unless all four are shared. The
lie: **a comparison is only a comparison when it is over the same items with the same scorer**, which is the
reason [10.2](../module-10/lesson-02.md) exists and the reason a framework's matrix view is genuinely
dangerous before you have learned that lesson.

## Fix it

1. **Adopt as a second reader, never as a replacement.** Both run the same `datasets/support.json` on the
   same split. The plain pytest suite stays the source of truth for the gate; the framework run is the
   cross-check, and a disagreement between them is a finding about a judge, not a migration to reconcile.
2. **Print the four numbers by name, on one line, every run.**
   `pass 43.2% (judge) | accuracy 86.5% (vs humans) | TNR 90.0% | kappa 0.73 | n=37`. If a framework is
   driving the run, make its report carry the same names, or keep the plain suite's line on the pull
   request. A number without its row is an opinion.
3. **Gate on the confusion matrix, never on a single score.** A gate that fires has to be able to say
   which cell moved. `tp 14, fp 2, fn 3, tn 18` is a page of context; `81.0%` is not — and the
   system-or-judge question is answered by looking at whether `fn` rose or `fp` rose, which is one subtraction.
4. **Keep the labels, and budget for them.** The labels are the only input that makes TPR, TNR and kappa
   computable, and they are the only part of the judge a framework cannot reconstruct. Every framework will
   happily run for a year on model-graded scores and hand you a dashboard that cannot answer "is the judge
   still right".
5. **Delegate the runner when the runner is the bottleneck.** Lots of model calls, retries, parallelism,
   caching, a viewer, a provider matrix. That is real work and you should not write it twice. If the
   bottleneck is *deciding whether to trust the number*, the framework is the wrong purchase.

## How do I know it works?

**Challenge, on dev.** The 57-item dev split. Four conditions before anyone calls a framework run
"equivalent" to the plain suite:

- **You can name every number on the report without looking it up.** Pass rate, accuracy, TNR, kappa — and
  for each, the sentence of what population it is a proportion *of*. A report you cannot narrate is a
  report you cannot defend when the gate fires.
- **The confusion matrix agrees.** `tp 29, fp 5, fn 1, tn 22` on dev, computed from the framework's own
  per-item results, reproduces pass **59.6%**, TPR **96.7%**, TNR **81.5%** and kappa **0.79**. Not within a
  tolerance — the same cells. A framework that reports 59.6% and cannot show you which 34 items produced it
  has not been validated, it has been summarised.
- **A wrong scorer is visible.** Take three items the judge got wrong — `s01`, `s60`, `s64` are all
  `no_citation` — and confirm that the framework's output makes each one findable by id and category. If the
  only way to see a judge error is to go back to the other tool, you have two tools and one measurement.
- **The gate can answer system-or-judge.** Write the sentence the gate would print when it fires. It has to
  be able to name which cell moved, and it has to have the labels in order to say.

**Then one held-out validation**, on `test_ids` — the remaining **37 items**, once:

| | Dev, 57 items | Held-out, 37 items |
|---|---|---|
| Judge pass rate | 59.6% | **43.2%** |
| Accuracy against humans | 89.5% | 86.5% |
| TPR | 96.7% | **82.4%** |
| TNR | 81.5% | **90.0%** |
| Kappa | 0.79 | **0.73** |
| Cells | `tp 29, fp 5, fn 1, tn 22` | `tp 14, fp 2, fn 3, tn 18` |

Read the two columns against each other and the last row is why the exercise is worth doing. The **pass
rate fell 16.4 points** and the **accuracy barely moved**, because the judge got stricter in both directions
at once: `fn` went from 1 in 30 to 3 in 17 and `fp` from 5 in 27 to 2 in 20. A framework reporting only the
pass rate would have called this a catastrophic regression. One reporting only accuracy would have called it
a non-event. **The cells are the only row that says which**, and that row is a subtraction off four integers
you already had.

## Use / don't use

**Do use a framework for the runner.** Many model calls, retries on malformed output, parallelism, a cache
across runs, a provider matrix, a viewer, a GitHub Action. That is engineering you should not write twice,
and two of the three reach a local model directly — promptfoo drives Ollama, Inspect documents local
inference through HuggingFace, vLLM and SGLang — so either can point at the pinned judge container from the
last lesson.

**Do use one when your scorer is a string, a schema or a similarity.** That is the ground from
[3.1](../module-03/lesson-01.md), it is genuinely tedious to write, and all three frameworks have a
maintained implementation of it.

**Do run the framework on the same items as the plain suite**, and diff the two per-item results. The
diff is worth more than either report, because it is the only artefact that can tell you which of two
readers is wrong.

**Don't delegate the judge validation.** TPR, TNR, kappa, the disagreement review and the corrected pass
rate are a function of your human labels, and no framework on this list reads them. A framework scorer is a
*candidate* judge until you have measured it the way [6.2](../module-06/lesson-02.md) says to.

**Don't let a framework own the gate before it owns the labels.** It is possible, it is common, and it
produces a dashboard that fires for reasons nobody can reconstruct — which is the failure at the top of this
lesson, arrived at by the fastest route.

**Don't migrate because the config was shorter.** A 30-line YAML file is a nice way to describe an eval. It
is not a reason to delete the 40 lines of readable Python that compute the number the gate uses, because the
whole reason the gate fired is a thing the YAML cannot express.

What teams actually do: they write the eval once in plain code, because the thing they most often need to
change is *which metric they trust*, and that is a two-line edit in Python and a research project in a
config format. Then, once the metric stops moving and the plumbing starts costing them, they adopt a
framework as the runner and keep the scorer that needs their labels. The order is not a preference about
taste. It is the order in which each layer becomes worth outsourcing.

## Reflect

1. The held-out run reports `43.2% pass` and `86.5% accuracy`. Write the two sentences you would put in a
   pull request comment if a colleague posted only the second number, and say which of the two would have
   caused the wrong decision.
2. A framework scorer and a human label are both "the reference". Describe the experiment you would run to
   find out whether your framework's scorer has quietly become the thing you are grading against, and say
   what the result would look like if it had.
3. Write the adoption criterion for your own project — one sentence, with both blanks filled. Then name
   the one number that framework's dashboard will never show you, and say what you would have to build to
   get it.

Finish with the knowledge check for this lesson: four questions, one correct answer each.

## Sources

- Promptfoo, [Intro](https://www.promptfoo.dev/docs/intro/) — the MIT-licensed, Node-based CLI and the
  declarative test/prompt/provider/assertion model this lesson's table reads from; the authority for the
  promptfoo column, not this table.
- UK AI Security Institute, [Inspect](https://inspect.aisi.org.uk/) — the Python framework built by the
  UK AISI, and the clearest statement of the dataset / solver / scorer decomposition this course has been
  teaching in pieces since Module 3.
- DeepEval, [5-minute
  quickstart](https://deepeval.com/docs/getting-started) — the Apache-2.0 pytest plugin, `LLMTestCase`
  with `input` / `actual_output` / `expected_output`, and `deepeval test run`; the authority for the
  DeepEval column, and the clearest example of `expected_output` not being a human label.
- Samuel Bowyer et al., [The Mythos of Model
  Evaluation](https://arxiv.org/abs/2411.19994) (2024) — why a headline number presented without its
  uncertainty, or without the population it is a proportion of, is a claim rather than a measurement.
