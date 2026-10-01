---
id: "13.1"
module: 13
minutes: 22
practice_minutes: 55
prerequisites: ["11.1", "12.3"]
objectives:
  - Name the five things a CI runner decides that your laptop does not, and the specific check that catches each one going wrong.
  - Read `run_gate`'s three outcomes and say which one a two-state CI check cannot represent, and what a workflow has to do with it instead.
  - Demonstrate that a gate both blocks a planted regression and stays quiet on a healthy re-run, and say why proving only the first half proves nothing.
  - Explain why a drop is measured in passes rather than in edits, and compute one by hand on the shipped data.
volatility: implementation
sources:
  - title: "GitHub Actions — Workflow syntax for GitHub Actions"
    url: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
  - title: "The Site Reliability Workbook — Canarying Releases (Google)"
    url: https://sre.google/workbook/canarying-releases/
  - title: "pytest: Flaky tests"
    url: https://docs.pytest.org/en/stable/explanation/flaky.html
last_verified: "2026-10-01"
---

# 13.1 · The suite in GitHub Actions

A regression suite becomes a gate the day it stops being something a person runs and starts being something
that runs on every pull request. That is the day the suite's own bugs stop being yours and start being
everybody's — because the first CI run is very often red for a reason that has nothing to do with the
feature, and the second is red again for a reason nobody can name, and by the third red build the team has
learned to click the button that makes it go away.

## Why it matters

The Google SRE workbook puts the bar for a canary in one sentence, and it is the bar for an eval gate too:
a canary process has value when it **detects bad release candidates with high confidence and identifies good
releases without false positives**. Both halves. A gate that only catches bad ones is a wall, and a gate that
only spares good ones is a rubber stamp, and a team that has used one of those for a month will not use the
other one for a year.

So start with the two failures, because they are different and both are on the same team within a quarter.

**The first run is red for a reason that is not the feature.** This is [11.1](../module-11/lesson-01.md)'s
material arriving somewhere new, and nothing about it is new except the address. Three ordinary causes, all
of them environmental:

- **The working directory is different.** `python -m` puts the *current* directory on the import path, so
  the command that works from `labs/common/` fails from the repository root with
  `ModuleNotFoundError: No module named 'evallab'`. Nobody changed a line of Python. The runner simply has a
  different answer to "where am I".
- **The dataset file was never committed.** `datasets/support.json` is 94 items of human labels and recorded
  verdicts, and `.gitignore` is written by people who were thinking about `node_modules` and `data/`. The
  package already handles this properly — it searches upward from its own file and refuses to answer without
  it — and a CI log full of `missing datasets` is a *correct* report of an environment that was never built.
- **The judge is a different model on the runner.** The judge menu names sixteen recorded judges and every
  entry carries a `model` field — `llama-3.2-3b`, `qwen3-1.7b` — and no digest, no quantisation, no date. Two
  machines can both satisfy `llama-3.2-3b` and disagree about every verdict, and the report looks identical
  on both.

The thing to notice is what all three have in common. **None of them is a defect in the feature, and all
three change the number on the gate.** A first CI run that is red tells you almost nothing about the pull
request until you know which of the two it is — the code is broken, or the runner is not the machine you
think it is.

**The second run is red too, and so is the third.** Now nobody believes the gate, and what happens next is
predictable: someone learns that clicking *Re-run jobs* usually makes it green, and starts clicking it. That
is the moment the suite stopped gating. A suite whose red is not explicable is worse than no suite, because
it costs a red build and buys nothing, and because the habit it teaches — re-run until green — is exactly the
habit that hides a real regression on the fifth click.

This lesson is the day that has to not happen. What makes a run reproducible is not the suite code; the
suite code was already right. It is the five things the runner decides for you.

## How it works

### What a runner decides that you did not

A local run inherits five things from the person at the keyboard. A CI runner inherits them from the job
definition instead, and every one of them is a place a number can change without a diff:

| What the runner decides | What goes wrong when it is unpinned | The check that catches it |
|---|---|---|
| **Python version and dependency set** | `random.Random` differs, a dependency resolves to a new version, and the suite's own arithmetic moves | pin the interpreter and the lockfile in the job; run `py -m pytest labs/common/tests -q` *before* the gate |
| **Working directory** | the same command resolves `evallab` and `datasets/` differently, or not at all | run the suite as a module from a stated directory (`py -m evallab.cli doctor`), never as a bare script |
| **The bytes of the dataset** | the labels changed, or the file is missing, and the gate is measuring a different population than the one you tuned on | commit `datasets/support.json`; print its hash in the log |
| **The judge build** | the same model *name* is a different quantisation, and every verdict moves | put the digest in the judge's `model_build` field ([05.3](../module-05/lesson-03.md)) and print it beside the label |
| **The random seeds** | an unseeded bootstrap gives a different interval on every run, and the job goes red intermittently | `paired_comparison(..., resamples=1000, seed=1)` — the seed is an argument, not a hope |

The first row is the one that catches the rest, and it is why `doctor` is the right first step in the job
rather than a nice-to-have. Read what it actually checks:

```
ok       datasets      support.json: 94 items (57 dev / 37 test), 16 recorded judges
ok       suite         eval: 59.6% pass on n=57
               kappa 0.79  TPR 96.7%  TNR 81.5%
optional live judge    ollama not installed - lessons 11.1, 11.2 and 11.4 do not need it
optional docker        installed but not running - lesson 11.3 only
```

`ok suite` is not an import check. It is **a whole 57-item suite, end to end, with no model anywhere** — the
same one that runs in every later lesson. If that line is `ok`, every number downstream is arithmetic over a
file you can open. If it is not, the log has already told you the run is not about the pull request.

### The gate: a point estimate, on purpose

Now the part that is actually new in this module. `run_gate` in
[`evallab/gate.py`](../../labs/common/evallab/gate.py) is the whole decision, and it is worth reading as
code rather than as prose because it says three things in three branches:

```python
base_rate = sum(1 for _, j in baseline_pairs if j == 1) / n
cand_rate = sum(1 for _, j in candidate_pairs if j == 1) / n
drop = base_rate - cand_rate                     # positive = candidate worse
```

**The decision is a point estimate.** The gate fires when the candidate's pass rate is more than `tolerance`
points below the current build's, on the same items. That is the rule lesson [10.3](../module-10/lesson-03.md)
priced, and it is the rule `stats.simulate_gate` already implements. `drop` is `baseline − candidate`, so
**positive means the candidate is worse**, and it is computed from the pass rates directly rather than from
`paired_comparison`'s delta — because that function returns `A − B`, and an earlier version of this file
passed the baseline first, which inverted every branch.

That is the whole of it. Now the bootstrap interval, which is computed on the very next lines and then
**not** obeyed:

```python
cmp = paired_comparison(candidate_pairs, baseline_pairs, resamples=1000, seed=1)
ci = (cmp.ci.lo, cmp.ci.hi) if (cmp and cmp.ci) else None
```

The interval is *reported beside the decision*. Read the three reason strings that come out of the three
branches, because the middle one is the lesson:

```
blocked: candidate is 12.3 points below the current build, over the 5-point tolerance; paired 95% interval -21.1 to -5.3 points (half-width +7.9)

passes, but the candidate is 1.8 points worse, inside the 5-point tolerance. A real drop that you have chosen to allow; paired 95% interval -5.3 to +0.0 points (half-width +2.6)

passes: 0.0 points level; paired 95% interval +0.0 to +0.0 points (half-width +0.0)
```

Three outcomes, because **"not blocked" and "fine" are different claims**. The first says the drop is
evidence of a regression. The second says a drop happened, it is smaller than the line, and the team has
chosen to allow it — which is a true statement about a real regression and it deserves its own line in the
log. The third says the candidate is level or better. A gate with two states cannot say the middle thing at
all, and that is the first thing a workflow has to fix; see below.

### The two versions that shipped wrong

This function has a history, and it is recorded in the source, because both bugs are the kind that survive
a code review. Read [`evallab/gate.py`](../../labs/common/evallab/gate.py)'s own account and
[`tests/test_gate.py`](../../labs/common/tests/test_gate.py)'s, then watch both on this data.

**The sign, inverted.** It blocked when the candidate was *better* and passed a twelve-item regression. The
output never looked wrong, because the reason strings used `abs()` — so "7.0 points below the current
build" could be printed by a branch that had just decided the candidate was 7 points *above* it. Correct
words, inverted decision. Run the shipped gate and the inverted rule on the same two comparisons:

| | shipped rule | sign inverted |
|---|---|---|
| candidate 12.3 points **worse** | **blocks** | passes |
| candidate 26.3 points **better** | passes | **blocks** |

The lie is not in the number. It is in the sentence: **a report that formats a signed quantity through
`abs()` will read correctly while the decision underneath it is backwards.** The only defence is the pair of
tests that check the sign and the outcome separately —
`test_a_worse_candidate_gives_a_negative_delta` and `test_the_sign_is_not_hiding_under_abs`.

**The interval, obeyed.** The other version decided on the bootstrap rather than the point estimate. It
looked more rigorous, which is exactly why nobody argued with it in review, and it was worse: a percentile
bootstrap of a sample mean puts its 2.5th percentile below the point estimate almost always, so the gate
fired on nearly every drop and **the tolerance stopped mattering**. The source records the sweep — 192
configurations of the real data, blocking a ten-point regression at every tolerance from 2 to 15 points. A
knob that does not move the output is not a knob, and a gate whose tolerance does nothing is a gate with one
setting you did not choose.

Rebuilt on this data so you can watch it, the same mistake reads like this. Four broken sizes from 3 to 20
items, fourteen tolerances from 2 to 15 points, four repeat windows — **224 configurations**, one rule per
row, and the last column is the number of blocks that rule produces at each of the fourteen tolerances, out
of sixteen configurations per tolerance:

| The rule | Configurations it blocks (of 224) | Blocks per tolerance, 2 → 15 points (of 16 each) |
|---|---|---|
| **shipped:** point estimate `> tolerance` | **120** | 15, 15, 12, 12, 9, 9, 8, 8, 8, 6, 6, 4, 4, 4 |
| the whole interval below the line (`ci.hi < −tolerance`) | 44 | 8, 8, 6, 6, 4, 4, 4, 2, 2, 0, 0, 0, 0, 0 |
| the 2.5th percentile against a **positive** tolerance (`ci.lo < tolerance`) | **224** | **16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16** |
| the 2.5th percentile below `−tolerance` (`ci.lo < −tolerance`) | 183 | 16, 16, 16, 16, 15, 15, 15, 12, 12, 12, 12, 9, 9, 8 |

Row one falls off as the tolerance widens, which is what a knob does. Row four does too, slowly. **Row three
does not move at all**: sixteen out of sixteen, at every tolerance from 2 to 15 points. That is the whole
failure in one line — a gate whose output does not depend on the tolerance is a gate with one setting you did
not choose, and a wall rather than a filter. And this is why
`test_the_tolerance_is_the_only_knob_that_trades` exists: it asserts `[True, True, True, True, False, False]`
across six tolerances, and its own docstring says it is the test that would have caught the interval-based
version.

### A drop is a drop in passes, not in edits

One more measurement, and it is the one that catches people writing a gate that counts regressions. On the
57 dev items with judge `c-rubric-3b`, the baseline build passes **34 of 57** — so it already fails 23
items. Break the first *k* items and see how far the pass rate actually moves:

| Broken items | Of those, already failing | Edits that cost a pass | Pass-rate drop |
|---|---|---|---|
| 1 | 0 | 1 | **1.75 pts** |
| 3 | 0 | 3 | **5.26 pts** |
| **6** | **2** | **4** | **7.02 pts** |
| 12 | 5 | 7 | **12.28 pts** |

Six broken items is **7.02 points, not 10.5**. Six out of fifty-seven is 10.5% of the *items*, and two of
those six were already failing, so flipping them moves nothing — they cost zero passes and the metric does
not know they were touched. A gate that counted "how many items did this change break" would report a
10.5-point regression where the pass rate moved 7.0, and would report **zero** for the run that flips six
items the judge had already failed, which is a pass rate that did not move at all.

That last case is
`test_breaking_an_item_the_judge_already_failed_costs_nothing`, and it asserts `abs(g.delta) < 1e-9` and
`not g.blocked`. **The metric is about the system, not about the diff.** Count passes, or count nothing.

### Two states, three answers

A CI job has exactly two outcomes: exit 0 and exit non-zero. `run_gate` has three. That mismatch is the
whole engineering problem of putting this thing in CI, and it has one correct resolution:

| Gate outcome | Exit code | What the job does |
|---|---|---|
| `blocked` | non-zero | the check fails; the pull request cannot merge without an override somebody has to type |
| `passes, but …` | **0** | the check is green, **and the middle sentence has to be printed where a human reads it** |
| `passes` | 0 | the check is green |

Collapsing the middle outcome into "green" is the tempting move and it is the wrong one: the drop is real,
it is inside the line, and the team chose the line. Collapsing it into "red" is worse — it is the wall, and
13.3 is the lesson about what a wall does to a team. The answer is that the middle outcome is not a verdict
at all. It is a **report**, and it belongs in the log and on the pull request, where somebody reads it in ten
seconds. The report on the pull request is lesson 13.4's subject; the rule for this lesson is only that a
workflow must not discard the sentence.

### The shape of the job

The workflow file for this lab lives in [`labs/module-13/`](../../labs/module-13/) and is yours to copy
wholesale — read it there rather than trusting a snippet, because the file is the artifact and a lesson's
rendering of it is a copy. What a job that gates has to do, in order:

1. **Trigger on the pull request**, not on every push to `main`. A gate that only runs after merge has
   already shipped the thing it was going to catch.
2. **Pin the interpreter and the dependency set.** Not "the latest Python"; the one your suite's tests pass
   on. This is the [11.3](../module-11/lesson-03.md) pin, applied to the whole job rather than to the judge.
3. **Check the repository out, with the data.** If `datasets/support.json` is not committed, this job is
   going to discover that on someone's pull request.
4. **Run the package's own tests before the gate**, and treat them as part of the gate. Fourteen gate tests
   in under a second are cheaper than any red build you do not have to explain.
5. **Restore the judge cache, keyed on something that changes when the judge changes** — the next lesson is
   entirely about the key, because the wrong one is indistinguishable from the right one for months.
6. **Run the gate and print the full reason string**, not a boolean.
7. **Upload the verdict as an artefact and comment the middle outcome on the pull request.**
8. **Exit with the gate's code**, and nothing else.

That is the whole shape. None of it is clever and all of it is load-bearing, which is why the difference
between a suite that gates and a suite that runs is about six lines of configuration and one decision about
the middle outcome.

## Show me

Everything below was run from the repository root on a Windows laptop with Python 3.14, no model, no
container, no API key. First the environment check a job should make first, then the gate itself.

```
$ $env:PYTHONPATH="labs/common"; py -m evallab.cli doctor
Python 3.14.3 on Windows 11

ok       datasets      support.json: 94 items (57 dev / 37 test), 16 recorded judges
ok       suite         eval: 59.6% pass on n=57
               kappa 0.79  TPR 96.7%  TNR 81.5%
optional live judge    ollama not installed - lessons 11.1, 11.2 and 11.4 do not need it
optional docker        installed but not running - lesson 11.3 only

Everything the required path needs is present. Start with lesson 11.1.
```

Now the gate, swept over the size of a planted regression and the width of the tolerance. The whole sweep is
this script — save it as `sweep.py` in [`labs/common/`](../../labs/common/) and run it with `py sweep.py`.
Baseline is the 57 dev items under `c-rubric-3b` at 34 of 57 passing; the columns are the tolerance in
points; `T` means the gate blocked:

```python
from evallab import RecordedJudge, load
from evallab.gate import run_gate

data = load("support")
judge = RecordedJudge(data, "c-rubric-3b")
items = data.items_for("dev")

def verdicts(broken=()):
    return [(it.label("v1"), 0 if it.id in broken else judge.samples(it, "v1")[0])
            for it in items]

base = verdicts()
n = len(items)
b = sum(1 for _, j in base if j == 1)
print(f"{n} dev items, baseline {b}/{n} = {b / n * 100:.1f}%")
print(f"{'broken':>6} {'drop':>9}   blocked at tolerance [0.5, 2, 5, 10, 20, 30]")
for k in (1, 3, 6, 12):
    cand = verdicts({it.id for it in items[:k]})
    drop = (b - sum(1 for _, j in cand if j == 1)) / n * 100
    outs = ["T" if run_gate(base, cand, tolerance=t).blocked else "F"
            for t in (0.005, 0.02, 0.05, 0.10, 0.20, 0.30)]
    print(f"{k:>6} {drop:>8.2f}pts   {outs}")
```

```
57 dev items, baseline 34/57 = 59.6%
broken      drop   blocked at tolerance [0.5, 2, 5, 10, 20, 30]
     1     1.75pts   ['T', 'F', 'F', 'F', 'F', 'F']
     3     5.26pts   ['T', 'T', 'T', 'F', 'F', 'F']
     6     7.02pts   ['T', 'T', 'T', 'F', 'F', 'F']
    12    12.28pts   ['T', 'T', 'T', 'T', 'F', 'F']
```

Read it as a decision surface and not as a grid. Every row's `T`s form a prefix, which is the only shape a
gate is allowed to have: widen the tolerance and the set of blocked builds shrinks, monotonically. A row
with a gap in the middle — `T F T F F F` — is a gate whose tolerance is a decoration.

And the six-item row is the trap from the section above. Six edits, four of which cost a pass, **7.02 points
and not 10.5**, because two of the six were already failing at baseline.

The three outcomes, printed verbatim, one per branch:

```
[blocked] blocked=True  delta=-0.1228  calls=171  ci=[-21.05, -5.26]
  blocked: candidate is 12.3 points below the current build, over the 5-point tolerance; paired 95% interval -21.1 to -5.3 points (half-width +7.9)

[inside tolerance] blocked=False  delta=-0.0175  calls=171  ci=[-5.26, 0.0]
  passes, but the candidate is 1.8 points worse, inside the 5-point tolerance. A real drop that you have chosen to allow; paired 95% interval -5.3 to +0.0 points (half-width +2.6)

[level] blocked=False  delta=-0.0000  calls=171  ci=[0.0, 0.0]
  passes: 0.0 points level; paired 95% interval +0.0 to +0.0 points (half-width +0.0)
```

`calls=171` on every line is `n × repeats` — 57 items at three repeats — and it is the number lesson
[13.2](lesson-02.md) is about.

Now the other half of the SRE sentence: **does the gate stay quiet when nothing has changed?** Same build,
same code, scored again from a different recorded repeat window. That is the closest thing this lab has to
run-to-run judge noise, and nothing is planted:

```
--- does the SHIPPED gate block on judge noise alone? ---
same healthy build, window 0 as baseline, window w as candidate
  window 0: pass-rate drop   0.00 pts | blocked at tol 0/0.5/2/5 = [False, False, False, False]
  window 1: pass-rate drop   1.75 pts | blocked at tol 0/0.5/2/5 = [True, True, False, False]
  window 2: pass-rate drop   1.75 pts | blocked at tol 0/0.5/2/5 = [True, True, False, False]
  window 3: pass-rate drop   0.00 pts | blocked at tol 0/0.5/2/5 = [False, False, False, False]
  window 4: pass-rate drop  -3.51 pts | blocked at tol 0/0.5/2/5 = [False, False, False, False]
```

**The pass rate of one unchanged build moves by up to 3.51 points** depending only on which repeat window
you read. At a 5-point tolerance none of the four re-scores blocks, which is why
`test_run_to_run_noise_does_not_block` passes. At a **half-point** tolerance two of those four block — and
note the asymmetry: window 4 reads as the candidate being *better*, which a gate that only looks for drops
can never see, and window 3 reads as exactly level. A suite tight enough to sound impressive at half a point
blocks half of its own healthy re-judgings, and the team learns to re-run within a week.

And the executable statement of the whole thing, which is what you should run before you believe any of it:

```
$ py -m pytest labs/common/tests/test_gate.py -q
..............                                                           [100%]
14 passed in 0.19s
```

Fourteen tests. Three of them exist because of the two bugs in the section above, and one of them exists
because the gate once matched its quarantine list against positional `item-0..n` indices so that a real
quarantine file always reported empty — a gate that is confident it ran everything while silently running
nothing.

> [!IMPORTANT]
> Every number above is computed from the seeded educational model of judge behaviour recorded into
> `datasets/support.json` at build time. The judge verdicts are not a measurement of any named LLM, the
> `c-rubric-3b` label is the name the run is filed under, and a pass rate here is a real count of a
> recorded table. The two historical claims — the inverted sign and the 192-configuration interval sweep —
> are the ones this repository's own source and tests record about itself in `gate.py` and `test_gate.py`;
> the rule-by-rule table above is a rebuild of that mistake on this data, run here, and is labelled as such.
> The cost per judge call used anywhere in this module is an illustrative figure for a small open model, not
> a quote.

## Try it

**Predict first**, on paper, before you run anything:

1. You break the first six dev items and the baseline passes 34 of 57. What is the drop, in points? (It is
   7.02, and the reason is a row of this lesson, not a rounding question.)
2. The gate reports a 1.8-point drop, inside a 5-point tolerance. Should the CI check be green or red? Write
   the one sentence you would put on the pull request either way.
3. You swap the gate's decision from the point estimate to the bootstrap interval, "to be more rigorous".
   What happens to the tolerance, and how would you notice from the outside, without reading the code?
4. Your CI job passes on your machine and reads `missing datasets` on the runner. Name the fix and the one
   line of the log that told you it was not the pull request.

[Lab: evallab package](../../labs/common/)

1. **Run the sweep and reproduce one row by hand.** Save `sweep.py` from *Show me* into
   [`labs/common/`](../../labs/common/) and run it with `py sweep.py`. Then, for each row, write down how
   many of the first *k* items the judge already failed, and check `drop = (edits that cost a pass) / 57`.
   Get the 7.02 by hand before you go any further — it is `4 / 57`, not `6 / 57`.
2. **Prove both halves or prove nothing.** Run `test_a_planted_regression_blocks` and
   `test_run_to_run_noise_does_not_block` on their own, then delete the second one's loop body and watch
   which of the two claims survives being weakened. Then score one healthy build from each of the four
   other recorded repeat windows and write down the pass-rate drop for each — the table above, reproduced by
   hand.
3. **Rebuild the interval-based gate and sweep it.** Write a ten-line function that decides on
   `ci.lo < tolerance` instead of on the point estimate, run it over four broken sizes × fourteen tolerances
   × four windows, and count how many of the 224 configurations it blocks. Then write the one sentence you
   would put in the pull request that replaced it.
4. **Make it two-state and find what you lost.** Take the three reason strings, flatten them to
   `PASS`/`FAIL` the way a bare `if g.blocked: sys.exit(1)` does, and read the second string as the reader
   of the log will. Write the line of the report that has to survive the flattening, and say whether it
   belongs in the log, the pull request, or both.
5. **Break the environment on purpose, in the three ways a runner does.** Run the suite from the repository
   root with `PYTHONPATH` unset and read the `ModuleNotFoundError`. Run it with `datasets/` renamed away and
   read `doctor`'s refusal. Then look at the judge menu and write down, for `c-rubric-3b`, exactly which
   field of the cache key would have to be filled in to stop the third failure — and check
   [`evallab/judge.py`](../../labs/common/evallab/judge.py) for whether it is.
6. **Read [`labs/module-13/`](../../labs/module-13/)'s workflow end to end** and write the eight steps from
   "The shape of the job" next to the lines that implement them. Any step you cannot point at is a step the
   workflow does not do yet.

## Break it

**Let the gate decide on the interval.** A rule that compares the bootstrap's 2.5th percentile against a
tolerance with the sign dropped blocks **16 of 16 configurations at every tolerance from 2 to 15 points** —
224 of 224, a flat line. The lie: **a stricter-looking rule that reads the interval is not stricter, it is
less sensitive to the thing you set**, and the tolerance printed beside it is the one field the reader will
trust.

**Ship a two-state gate.** `exit 1 if g.blocked else 0` throws away the sentence that says *a real drop
that you have chosen to allow*. The lie: **"not blocked" reads as "nothing happened", and something did** —
the pass rate fell, the log says the check passed, and the person who reads it learns that this gate has
nothing to say about small regressions. That is how a gate gets disabled rather than retuned.

**Invert the sign.** The version that shipped blocked a 26.3-point improvement and passed a 12.3-point
regression, and its output read `7.0 points below the current build` on the branch that had decided the
opposite. The lie: **a reason string built with `abs()` on a signed quantity will keep reading correctly
long after the decision underneath it is wrong**, and the report is the last place anybody looks for an
inverted sign.

**Pin nothing but the branch.** `runs-on: ubuntu-latest` with unpinned Python and no lockfile means the
judge, the dependency tree and the interpreter all move under the gate between two runs a week apart. The
lie: **a suite whose inputs are not pinned is measuring a moving target and calling it a regression**, and
the first person who loses an afternoon to it will assume the suite is flaky rather than unpinned.

**Tighten the tolerance until it sounds rigorous.** Half a point blocks two of the four healthy re-scores
above, and the block arrives with a 12-point interval attached, so it *looks* careful. The lie: **false
positives are not free because they are small**; they are free right up until somebody re-runs the job, and
after that they cost you the gate.

**Re-run until green.** The button is one click and the cost is invisible. The lie: **a gate that is
re-run until it passes has a false-alarm rate of 100% and a miss rate nobody is measuring** — the run that
would have caught the regression is the run you deleted.

## Fix it

1. **Make `doctor` the first step of the job, and treat a `missing` line as a build failure rather than a
   warning.** It costs under a second and it separates the two failures — *the code is broken* from *this is
   not the machine you tuned on* — before anyone reads a pass rate. The `optional` lines are the valuable
   part: they name the lesson a learner cannot do instead of failing halfway through it.
2. **Run the package's tests in the same job, before the gate.** Fourteen gate tests in 0.19s are the only
   thing standing between a sign inversion and a week of green builds, and a gate whose own arithmetic can
   change without a test failing is a print statement.
3. **Decide on the point estimate, and print the interval beside it.** `drop = base_rate - cand_rate;
   blocked = drop > tolerance`, then attach `ci` to the reason string. The interval is the honest width of
   the measurement and it belongs on the report; making it the *decision* is what made the tolerance inert.
4. **Print the sign, never `abs()` of it.** The reason strings say `below the current build` and `points
   better`, and `GateResult.delta` is `−drop` so a worse candidate reads negative.
   `test_the_sign_is_not_hiding_under_abs` is the assertion, and it should be the first test anybody adds to
   a gate they have written.
5. **Prove the quiet half as carefully as the loud half.** A planted regression that blocks and a healthy
   re-score that does not are one test file, and shipping only the first is how a suite ends up as a wall.
   `test_run_to_run_noise_does_not_block` is the half that gets skipped.
6. **Keep the middle outcome in the report and out of the exit code.** `passes, but …` exits 0 and is
   printed in full, on the pull request, in a line a person reads. The check stays green; the information
   does not go.
7. **Pin the job the way you pin the judge.** Interpreter version, dependency lock, the dataset's bytes and
   the judge's `model_build` all belong in the job definition, and all four belong in the log line the
   report prints.

## How do I know it works?

**Challenge, on dev.** The dev split is **57 items**, so a gate that clears these is a gate tuned on two
thirds of the evidence:

- **Both halves are demonstrated, in the same run, from the same fixtures.** A planted 12-item regression
  blocks at tolerances 0.5, 2, 5 and 10 points; a healthy re-score from each of the four other repeat
  windows blocks at none. If you can only produce one of those two, you have a print statement.
- **The decision is monotone in the tolerance.** Sweep it and every row's blocks form a prefix:
  `[T F F F F F]`, `[T T T F F F]`, `[T T T F F F]`, `[T T T T F F]`. A gap in the middle is a gate whose
  tolerance does not mean anything, and
  `test_the_tolerance_is_the_only_knob_that_trades` is the assertion.
- **Every outcome is a sentence, and the middle one has a different sentence.** Blocked, *passes but*,
  passes. If the second and the third read alike in your log, you have thrown away the difference between
  "we allowed a real drop" and "nothing happened".
- **The drop is computed from pass rates.** You can reproduce 1.75, 5.26, 7.02 and 12.28 points by counting
  passes, and `test_breaking_an_item_the_judge_already_failed_costs_nothing` passes — a run that flips six
  already-failing items moves the metric by exactly zero.
- **The gate reports its own inputs.** 57 items, 3 repeats, **171 judge calls**, judge id, tolerance, and the
  paired interval's half-width beside the decision. A gate whose report does not say what it ran is a gate
  nobody can reproduce.
- **The environment is checked before the gate runs, and the log names all of it** — Python version,
  dataset hash, judge id and digest, tolerance, repeats.

**Then one held-out validation**, on `test_ids` — the remaining **37 items**, run once, same judge, same
5-point tolerance, same break applied to the front of the list:

| | Dev, 57 items | Held-out, 37 items |
|---|---|---|
| Baseline pass rate | **34/57 = 59.6%** | **16/37 = 43.2%** |
| Items the baseline already fails | **23** | **21** |
| Judge calls at 3 repeats | 171 | 111 |
| Break 1 item: already failing / drop | 0 / **1.75 pts** | 0 / **2.70 pts** |
| Break 4 items: already failing / drop | 1 / **5.26 pts** | **3 / 2.70 pts** |
| Break 6 items: already failing / drop | 2 / **7.02 pts** | **4 / 5.41 pts** |
| Break 12 items: already failing / drop | 5 / **12.28 pts** | **9 / 8.11 pts** |
| Blocked at 5 points? (1, 4, 6, 12 broken) | no, **yes**, yes, yes | no, no, **yes**, yes |

Read the *break 4 items* row across. **The same edit count moves the pass rate by 5.26 points on dev and by
2.70 points on the held-out half** — because on the held-out half 21 of 37 items are already failing, so
three of the four items you break were failures already and cost nothing. The gate's own output says so:

```
passes, but the candidate is 2.7 points worse, inside the 5-point tolerance. A real drop that you have chosen to allow; paired 95% interval -8.1 to +0.0 points (half-width +4.1)
```

That is a middle outcome on a build where four questions are genuinely broken, and it is correct. The
*count* of edits was the thing that was never the metric; on a set this unhealthy the count and the metric
come apart by a factor of three.

The finding is not "tighten the tolerance" — lesson [10.3](../module-10/lesson-03.md) already priced that
trade, and a 37-item set at a 2-point tolerance blocks a single-item regression. The finding is that **the
set you gate on determines how many points a regression is worth**, so a gate validated on one set is not a
gate validated at all until it has been run on the other. A 5-point tolerance here catches a four-item break
on dev and misses it on held-out, for a reason that has nothing to do with either tolerance or the code: the
baseline on the held-out half is 16 points worse, and a set where 21 of 37 items already fail cannot price a
four-item regression at 5 points.

## Use / don't use

**Do run the same command the developer runs.** A gate you can only reproduce inside the runner is a gate
whose red builds you cannot investigate. `py -m evallab.cli doctor` and `py -m evallab.cli run` should work
identically in both places, from a stated directory, with a stated `PYTHONPATH`.

**Do commit the data and print its hash.** `datasets/support.json` is the measurement. A gate whose dataset
lives in someone's Dropbox is a gate whose population changes without a diff.

**Do treat the two states as three.** Green, red, and *green with a warning sentence* are three different
claims, and the third one is the one that gets lost.

**Do make the gate's own tests part of the gate.** They are fast, they are the only defence against a sign
inversion, and a suite whose tests run in a different job than its numbers is a suite that ships a broken
gate and a green test run.

**Do tune the tolerance against the noise you measured, on the set you will gate on.** Half a point blocks
two of the four healthy re-scores above on 57 items. That is a decision somebody has to make and write down,
and [10.3](../module-10/lesson-03.md) is where the four numbers come from.

**Don't gate a moving item set.** If the frozen set is re-sampled each run, every run compares two different
populations and the number on the gate is a difference between two suites. Freeze the list, freeze the
order, and diff the list when it changes.

**Don't let the gate's pass rate be the only thing in the report.** The padded variant from lesson
[12.5](../module-12/lesson-05.md) costs **4.04×** and passes at exactly the same rate by construction. A
regression suite watching only the pass rate is structurally incapable of catching it, and it will report a
comfortable margin.

**Don't make "re-run" a habit.** If a green build comes from the second attempt, the number you have is the
distribution's best sample, not its estimate, and the PR you approved was approved on a draw.

What teams actually do in production: a job that checks out the data, pins the interpreter and the judge
digest, runs the suite's own tests, restores a cache keyed on everything that can change a verdict, runs the
gate, prints the full reason string with the interval attached, writes a JSON artefact, comments the middle
outcome on the pull request, and exits on the blocked/non-blocked line. Roughly sixty lines of YAML, and
every one of them exists because a specific failure is otherwise invisible.

## Reflect

1. The gate reports `passes, but the candidate is 1.8 points worse, inside the 5-point tolerance`. Write the
   exact text of the pull-request comment you would post on that run — two lines, no hedging — and say what
   you would change about it after the fourth time you post it.
2. The gate once decided on the bootstrap interval and blocked a ten-point regression at every tolerance from
   2 to 15 points. Write the code-review comment you would write on the pull request that proposed it, given
   that its author argued it was *more* rigorous. Then write the sentence you would add to the docstring so
   that the next person does not try it again.
3. Your CI log says `missing datasets` on one pull request and the developer who opened it has never seen
   that file. Write the two sentences you would put in the repository's README about where the data lives,
   and say what you would change in `.gitignore` if you could change one line.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- GitHub Actions, [Workflow syntax for GitHub
  Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) — the job
  definition as a first-class reviewable artifact: `runs-on`, the interpreter pin, the dependency pin, the
  trigger, the step order, and the step whose exit code becomes the check's verdict. Everything in "The shape
  of the job" is one of these fields.
- Google SRE, [The Site Reliability Workbook — Canarying
  Releases](https://sre.google/workbook/canarying-releases/) — the sentence this lesson is built on: a
  canary has value when it *detects bad release candidates with high confidence and identifies good releases
  without false positives*. The chapter's own warnings about un-attributable metrics and about metrics whose
  window is wider than the canary are the same two mistakes a misconfigured eval gate makes.
- pytest, [Flaky tests](https://docs.pytest.org/en/stable/explanation/flaky.html) — the toolkit's account of
  a suite that fails intermittently, of the seed being part of the test rather than something the test hopes
  for, and of `pytest-rerunfailures` being a way of *marking* a flaky test rather than fixing it. A gate whose
  first response to a red build is a re-run is the last one on that page.