---
id: "11.1"
module: 11
minutes: 20
practice_minutes: 55
prerequisites: ["10.3", "04.4"]
objectives:
  - Run `evallab doctor`, a suite, and the test suite from a folder you did not create, and say what each one proves before you believe a number.
  - Turn one CLI report into the four checkable figures a reviewer can ask about: pass rate with its interval, kappa with its interval, the confusion counts and the disagreement count.
  - Name three ways a suite prints a confident number that has nothing to do with the feature under test, and the specific check that catches each one.
  - Explain why the first suite in this module runs with no model anywhere in it, and what that buys before the first paid judge call.
volatility: implementation
sources:
  - title: "pytest: Import mechanisms and sys.path/PYTHONPATH"
    url: https://docs.pytest.org/en/stable/explanation/pythonpath.html
  - title: "pytest: Flaky tests"
    url: https://docs.pytest.org/en/stable/explanation/flaky.html
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 11.1 · Your first eval run in Python

Everything in Modules 1 to 10 happened in a browser tab you could reload. This is the same loop in a package
on disk: a suite you can run from a shell, a report a CI job can print, and a test that says whether the
numbers still hold. The run you start with contains no model at all, and that is the point — it means the
first thing you break is a path, not a bill.

## Why it matters

A team gets their first eval suite into CI. It is 57 items, one judge, one threshold, and it prints one
line. On the engineer's laptop that line reads `66.7% pass on n=57`. On the CI runner, on the same commit,
it reads `0.0% pass on n=57`. Nothing in the diff. Nothing in the prompt. Nobody changed anything.

There are three ordinary explanations, and you will meet all three.

**The path resolved from a different working directory.** `python -m` puts the *current* directory on the
import path, so the same command works from `labs/common/` and fails from the repository root:

```
C:\...\python.exe: Error while finding module specification for 'evallab.cli' (ModuleNotFoundError: No module named 'evallab')
```

**The dataset file was never committed.** `.gitignore` was written for `node_modules` and somebody added
`data/` to it. Here is what this package does about that — it searches upward from its own file for a
`datasets/` folder, and when there is none it says so and stops:

```
missing  datasets      datasets/ not found. Run from a module folder, or copy datasets/ next to the labs - the module zip already includes it.

The labs cannot run without the dataset. It ships in the module zip.
```

**The judge is a different model.** The judge menu names sixteen recorded judges, and each entry carries a
`model` field — `llama-3.2-3b`, `qwen3-1.7b`, `prometheus-7b`. That is a *name*, not a build. There is no
digest and no quantisation recorded anywhere in it, so two machines that both say "Llama 3.2 3B" can
disagree about every verdict and the report will look identical on both.

None of those three has anything to do with the feature someone is trying to ship, and all three of them
change the number on the dashboard. **A suite that cannot reproduce itself on a second machine cannot gate
anything, and the first thing it gates is itself.** This lesson's job is to make the suite reproducible
before it is allowed to have an opinion.

### And the part that is specific to this course

The first suite you run here **contains no model at all**. Every verdict is replayed from a JSON file that
ships with the lab; every statistic after it is arithmetic you can read line by line in a file you can open.

That is not a compromise, it is the reason to start here. A suite that talks to a model has two kinds of
problem — the ones you can debug and the ones you cannot — and they arrive together. If you bring the
harness up on recorded verdicts, every number in the first report traces back to a JSON key and a formula,
and the *only* thing that can change without you editing code is a version pin. Get the plumbing right while
the thing on the other end costs nothing, and then add a model in lesson 11.3, when the plumbing is not
also on the hook.

## How it works

### What is actually in the package

[Lab: evallab package](../../labs/common/)

Four files matter, and every one of them is something you already did by hand in a browser:

| File | What it is | The lesson it belongs to |
|---|---|---|
| [`evallab/dataset.py`](../../labs/common/evallab/dataset.py) | loads `datasets/support.json`; `Item.label(variant)` is the human label | [04.2](../module-04/lesson-02.md) |
| [`evallab/judge.py`](../../labs/common/evallab/judge.py) | `RecordedJudge` replays; `MajorityJudge` adds repeats and a threshold; `cache_key` is the keying rule | [05.3](../module-05/lesson-03.md), [07.5](../module-07/lesson-05.md) |
| [`evallab/suite.py`](../../labs/common/evallab/suite.py) | `run_suite`, `verdict_of`, `compare` | [06.2](../module-06/lesson-02.md) |
| [`evallab/stats.py`](../../labs/common/evallab/stats.py) | Wilson, kappa, the bootstrap, the paired comparison, the gate | [04.4](../module-04/lesson-04.md), [06.2](../module-06/lesson-02.md), [10.3](../module-10/lesson-03.md) |

`run_suite` is four steps and there is no fifth one:

1. pick the items (`sample_items`, deterministic given a seed),
2. ask the judge for a verdict on each (`verdict_of`),
3. read the human label off the same item and put the pair aside,
4. hand the pairs to `judge_metrics`, and read `wilson` off the pass count.

Step 3 is not optional bookkeeping and it is not "instead of" step 2. [06.2](../module-06/lesson-02.md)
argued that the agreement with humans is computed *alongside* the verdicts, never instead of them. In the
code that is literally two lines in one loop:

```python
v = verdict_of(judge, it, variant)
human = it.label(variant)
pairs.append((human, v))
```

Every number the CLI prints comes out of those pairs. Nothing else feeds in.

### One report, read field by field

Run the plain judge on the 57 dev items — variant `v1`, one sample per item — and this is the whole
report:

```
eval: 66.7% pass on n=57  (dev, Llama 3.2 3B - Plain - 0 shots)
  kappa 0.43   TPR 86.7%   TNR 55.6%   accuracy 71.9%

16 disagreement(s). These are the work:
  s04  human=0 judge=1  (no_citation)
  s13  human=1 judge=0  (correct)
  s18  human=0 judge=1  (over_refusal)
  s21  human=0 judge=1  (no_citation)
  s28  human=0 judge=1  (wrong_fact)
  ... and 11 more
```

Work the arithmetic by hand so the report stops being a display.

**66.7% pass** is 38 of 57. The interval the report does *not* print is the Wilson one, and it is
`53.7% to 77.5%` — nearly 24 points wide for a number you would otherwise report to one decimal place.
That width is the honest size of the evidence behind `66.7%`, and it is wider than the entire
improvement the A/B in lesson 10.1 was chasing.

**TPR 86.7%** is `tp / (tp + fn)` = 26/30. **TNR 55.6%** is `tn / (tn + fp)` = 15/27. Note the two
denominators: 30 answers the humans passed, 27 answers they failed, and the judge is a different person on
each side.

**kappa 0.43** is `(observed - expected) / (1 - expected)`, and it is worth doing once by hand because
this is the number that catches a bad judge and nothing else does:

| Term | Value | Where it comes from |
|---|---|---|
| observed agreement `po` | 41/57 = 0.7193 | tp + tn = 26 + 15 |
| humans' pass share | 30/57 = 0.5263 | tp + fn |
| judge's pass share | 38/57 = 0.6667 | tp + fp |
| expected `pe` | 0.5088 | 0.5263 × 0.6667 + 0.4737 × 0.3333 |
| kappa | (0.7193 − 0.5088) / (1 − 0.5088) | = **0.4286** |

The denominator is what kappa subtracts: the agreement a coin that always guesses the majority label would
have scored on these same 57 items. 0.5088 is a lot of agreement, which is exactly why raw accuracy of
71.9% reads as fine and is not.

**16 disagreements** is the only line on the page that names items, and it is the line that does work. Six
are `no_citation`, four `correct`, three `wrong_fact`, two `over_refusal`, one `out_of_scope` — which is
lesson 02's taxonomy and lesson 05.3's rubric clause 2 in one place, and it is the reason the report has a
disagreement list at all.

### One more number you can compute from the report

Lesson [06.5](../module-06/lesson-05.md) corrected a pass rate for judge error. Nothing stops you doing it
here, because the inputs are all on the screen:

```
observed 66.7%, TPR 86.7%, TNR 55.6%
corrected = (0.6667 + 0.5556 - 1) / (0.8667 + 0.5556 - 1) = 0.2222 / 0.4222 = 52.6%
```

**52.6% is 30 of 57, which is the humans' own pass rate on this split.** That is not a coincidence and it is
not the correction being clever: the Rogan–Gladen estimator inverts the judge's confusion matrix, so on the
same data it lands on the prevalence by construction. Its value is not this number — it is that the number
you would *publish* next to your pass rate, 66.7%, is fourteen points of judge error above the thing the
judge was supposed to measure.

### The knobs, and what each one actually does

The two knobs you already turned in lessons [06.4](../module-06/lesson-04.md) and
[07.5](../module-07/lesson-05.md) are CLI flags now. Same plain judge, same 57 dev items:

| Knob | Pass | Kappa | TPR | TNR |
|---|---|---|---|---|
| `--repeats 1` (the default) | 66.7% | 0.43 | 86.7% | 55.6% |
| `--repeats 2` | **49.1%** | 0.72 | 83.3% | 88.9% |
| `--repeats 3` | 73.7% | 0.50 | 96.7% | 51.9% |
| `--repeats 5` | 73.7% | 0.57 | 100.0% | 55.6% |
| `--repeats 3 --threshold 0.00` | **100.0%** | **0.00** | 100.0% | **0.0%** |
| `--repeats 3 --threshold 0.67` | 45.6% | 0.79 | 83.3% | 96.3% |
| `--repeats 3 --threshold 1.00` | 45.6% | 0.79 | 83.3% | 96.3% |

Two rows in that table are traps and they are the rest of this section.

**Row 2 is the tie rule.** Two recorded samples, one pass and one fail, is not a majority, so it resolves
to fail. Two repeats is *stricter* than three: the pass rate drops from 66.7% to 49.1% and the kappa goes
*up*. Any even repeat count has this property, and it is the same finding lesson 10.3 recorded about the
majority tile.

**Row 5 is the whole course in one line.** A threshold of 0.00 passes every item that has at least one
recorded sample, which is all of them. The judge is now a constant. It passes 100% of the answers, its TNR
is 0.0% — it catches none of the 27 answers the humans failed — its accuracy is 52.6%, which is exactly the
humans' pass rate, and its kappa is **0.00**, because a constant judge agrees with chance and not one
bit more. **The score went up by 33 points and the measurement went to zero.** That is the accuracy-lies
lesson from [06.3](../module-06/lesson-03.md), and the reason kappa is on this line at all.

The last two rows are the same number for the same reason and it is worth catching. A threshold is a
*fraction of samples*, and with three recorded samples a fraction can only be 0, ⅓, ⅔ or 1. Anything at
0.67 or above demands all three, so `--threshold 0.67` and `--threshold 1.00` produce an identical report.
**On a small repeat count the threshold knob has fewer positions than its decimals suggest**, and a knob
whose resolution is not stated is a knob somebody will turn and see nothing happen.

### Output somebody else has to read

One more thing the CLI does that no browser lab has to think about. The judge label stored in the dataset
is `Llama 3.2 3B · Plain · 0 shots` — with real U+00B7 middle dots. On a default Windows console those
render as mojibake, so `safe()` in [`evallab/cli.py`](../../labs/common/evallab/cli.py) rewrites the whole
line to ASCII before printing, and the label arrives as `Llama 3.2 3B - Plain - 0 shots`.

That is a small thing and it is worth thirty seconds of your attention, because the report is going into a
CI log that someone reads at 2am on a machine you have never seen. **A result other people have to read is
part of the result.** A pass rate you cannot read is a pass rate nobody acts on, and the fix — a mangled
label, a traceback instead of a message, an em dash in an error string — costs you a rerun and costs the
reader an hour.

## Show me

Everything in this lesson runs from [`labs/common/`](../../labs/common/) with the package on the import
path. On Windows `py` is the interpreter; on macOS and Linux it is `python3`.

[Lab: evallab package](../../labs/common/)

```
cd labs/common
set PYTHONPATH=.            # Windows PowerShell; on bash: export PYTHONPATH=.
py -m evallab.cli doctor
```

```
Python 3.14.3 on Windows 11

ok       datasets      support.json: 94 items (57 dev / 37 test), 16 recorded judges
ok       suite         eval: 59.6% pass on n=57
               kappa 0.79  TPR 96.7%  TNR 81.5%
optional live judge    ollama not installed - lessons 11.1, 11.2 and 11.4 do not need it
optional docker        installed but not running - lesson 11.3 only

Everything the required path needs is present. Start with lesson 11.1.
```

Read that top to bottom, because it answers the question the command exists for: *what can this machine
actually do?* `ok` is a hard requirement, `optional` names the lesson it would unlock. The suite line is
the important one — **`doctor` does not merely check that the package imports, it runs a whole 57-item
suite end to end with no model anywhere.** If that line is `ok`, everything downstream is arithmetic.

Then the run itself, which is the bridge into lesson 11.2:

```
py -m evallab.cli run --judge c-plain-3b --variant v1 --split dev
```

```
eval: 66.7% pass on n=57  (dev, Llama 3.2 3B - Plain - 0 shots)
  kappa 0.43   TPR 86.7%   TNR 55.6%   accuracy 71.9%

16 disagreement(s). These are the work:
  s04  human=0 judge=1  (no_citation)
  ...
```

**These are the numbers lesson [06.2](../module-06/lesson-02.md) measured in a browser tab** — kappa 0.43,
TPR 86.7% (26/30) and TNR 55.6% (15/27) on the same 57 dev items, from the same recorded verdicts. Not
similar numbers. The same ones, in a different language. That equality is not free, it is the entire
subject of lesson 11.2, and right now it is something you have been told rather than something you have
checked.

Third, the comparison, and the reason the judge is the headline:

```
py -m evallab.cli run --judge c-rubric-3b --variant v1 --compare v2
```

```
v1 vs v2: +26.3 points (95% CI 7.0% to 43.9%), 9 fixed, 24 broke, p = 0.014
```

Run the same comparison under the *plain* judge — same items, same two systems, same seed:

```
py -m evallab.cli run --judge c-plain-3b --variant v1 --compare v2
```

```
v1 vs v2: +1.8 points (95% CI -15.8% to 19.3%), 12 fixed, 13 broke, p = 1.000
  The interval crosses zero: on these items the two systems are not distinguishable. That is a result, not a failure to report.
```

Same items. Same two systems. Same command with one flag changed. The measured effect moves from
**+26.3 points, p = 0.014** to **+1.8 points, p = 1.000** — twenty-five points of movement and a complete
reversal of the conclusion, caused by nothing except which judge read the answers.

Fourth, the tests, which are the only check you have that the numbers above are still the numbers you wrote:

```
py -m pytest tests/ -q
```

```
.................                                                        [100%]
17 passed in 0.44s
```

Seventeen tests: four in [`tests/test_parity.py`](../../labs/common/tests/test_parity.py) checking this
Python against the JavaScript engine, and thirteen in [`tests/test_suite.py`](../../labs/common/tests/test_suite.py)
checking that a suite runs with no model, that it is deterministic, and that a degenerate case is reported
as degenerate. Four of them are lesson 11.2's subject and the rest are this module's.

> [!NOTE]
> Every verdict behind these tiles comes from a seeded educational model of judge behaviour recorded into
> `datasets/support.json`, not from a live LLM. The model names in the judge labels are the labels under
> which recorded runs are filed, not published measurements of those models. The statistics computed from
> those verdicts are computed for real, in Python, on your machine.

## Try it

**Predict first**, on paper, before you run anything:

1. `--repeats 2` on this judge and this split. Does the pass rate go up or down, and is kappa higher or
   lower than at one repeat? (The answer is down and up, and the reason is a rule, not a trend.)
2. `--threshold 0.00`. What does the pass rate read, and what does the TNR read? If you had to ship one
   number to a dashboard, which would you ship, and which is the one that means something?
3. The rubric judge scores v1 against v2 at **+26.3 points, p = 0.014**. The plain judge scores the same
   comparison at **+1.8 points, p = 1.000**. Neither system changed. Write one sentence naming what did.
4. `--n 20` instead of all 57 items. Same judge, same split. Predict the pass rate and predict whether it
   will land on 66.7%.

[Lab: evallab package](../../labs/common/)

1. **Get a number you can check by hand.** Run `--judge c-plain-3b --variant v1 --split dev`, then
   reproduce `kappa 0.43` from the confusion counts `tp 26, fp 12, fn 4, tn 15` using the table above.
   Then reproduce the Wilson bounds for 38 of 57. If your hand arithmetic and the package disagree, stop
   and find out which one is wrong before you go on — that is the whole skill.
2. **Turn the knobs and fill in the table you predicted.** `--repeats 1, 2, 3, 5`, then
   `--repeats 3 --threshold 0.0, 0.5, 0.67, 1.0`. For each row write TPR *and* TNR, and put a one-line
   note on what that row does to the judge. Find the row where the pass rate is highest and say what the
   TNR on that row tells you about it.
3. **Run the same comparison twice and read the difference.** `--judge c-rubric-3b --variant v1
   --compare v2` and `--judge c-plain-3b --variant v1 --compare v2`. Write the two intervals side by side.
   Then run the same *second* comparison under both judges — `--judge c-rubric-3b --variant v2 --compare
   v3` reads `+19.3 points (95% CI 3.5% to 35.1%), p = 0.035`, and `--judge c-plain-3b --variant v2
   --compare v3` reads `+17.5 points (95% CI 0.0% to 35.1%), p = 0.087`. Write down what the plain
   judge could not tell you that the rubric judge could, and what you would have shipped on the first.
4. **Read all sixteen disagreements, not five.** The CLI prints five and a count. Dump the rest:

   ```
   py -c "import sys; sys.path.insert(0,'.'); from evallab.dataset import load; from evallab.judge import RecordedJudge; from evallab.suite import run_suite; d=load('support'); [print(r) for r in run_suite(d, RecordedJudge(d,'c-plain-3b'), variant='v1', split='dev').disagreements]"
   ```

   Group the sixteen by category and write one sentence per group saying whether the judge was wrong, the
   human label was wrong, or the item is genuinely arguable. Six are `no_citation` — say what a rubric with
   clause 2 would do with those six.
5. **Make it fail on purpose, twice.** Run `--judge c-plain-3b --variant v9 --split dev` and read what it
   says: `missing variant 'v9' is not one of: v1, v2, v3, v1padded`, exit code 2, and not one pass rate
   printed. Then run `--judge c-plain-3b --variant v1padded --split dev` and read what it *does* say. That
   one is a real variant with recorded verdicts and no human labels, so it sails past the guard and prints
   a confident report. Compare the two: write down which of the five numbers on the `v1padded` run are
   measurements and which are artefacts, and say what one line in `Item.label` would have to do to stop it.
   Finish with `--judge c-nope --variant v1 --split dev`, which fails loudly and ungracefully, and say
   which of the three failures you would rather meet in CI.
6. **Prove the report is reproducible.** Run the same command twice and diff the output. Then change
   nothing at all and run `py -m pytest tests/test_suite.py -q -k deterministic` — the test called
   `test_suite_is_deterministic` asserts that the point estimate does not move when only the bootstrap seed
   changes. Say why that distinction is the one CI needs.

## Break it

**Set `--threshold 0.00`.** Pass rate **100.0%**, kappa **0.00**, TPR 100.0%, TNR **0.0%**, accuracy 52.6%,
27 disagreements. Nothing is broken; the run is green and the command exited 0. The lie: **a pass rate
with no TNR beside it is a number that only counts the answers the judge already agreed with**, and 100%
is the shape a reward-hacking judge produces.

**Set `--repeats 2`.** The pass rate falls from 66.7% to 49.1% and kappa rises from 0.43 to 0.72. Both
numbers moved and neither one is a regression. The lie: **a tie resolving to fail looks exactly like a
stricter judge**, and an even repeat count is always stricter than the odd count below it. Nobody reading
the report can tell which of the two happened.

**Run `--n 20`.** Same judge, same split, and now the report reads `65.0% pass on n=20, kappa 0.42`. The
number barely moved — 65.0% against 66.7% — so it looks like the suite is stable. What moved is the
evidence. The Wilson interval is **43.3% to 81.9%** on the 20 items against **53.7% to 77.5%** on all 57:
nearly 39 points wide instead of 24, a point estimate whose uncertainty grew by more than half while the
estimate itself did not move at all. And the 20 items are a seeded draw, not a subset anybody chose. The
lie: **a point estimate that survives resampling still has an interval that did not.**

**Score a variant nobody labelled.** This one is still in the shipped lab, and it is the worst number in
this lesson. Run it:

```
py -m evallab.cli run --judge c-rubric-3b --variant v1padded --split dev
```

```
eval: 56.1% pass on n=57  (dev, Llama 3.2 3B - Rubric - 0 shots)
  kappa 0.00   TPR -   TNR 43.9%   accuracy 43.9%

32 disagreement(s). These are the work:
  s02  human=0 judge=1  (unknown)
  s03  human=0 judge=1  (unknown)
  s08  human=0 judge=1  (unknown)
  s10  human=0 judge=1  (unknown)
  s13  human=0 judge=1  (unknown)
  ... and 27 more
```

Exit code 0. The `v1padded` variant has recorded judge verdicts and **no human labels at all** —
`Item.label` returns `0` for a variant it has no entry for, so the suite compares the judge against a
label set of fifty-seven zeros. The confusion matrix comes out `tp=0 fp=32 fn=0 tn=25`: no true positives
and no false negatives, because on this run no human ever passed anything.

Now read that report as a reviewer would. **One number on it is real** — the 56.1% pass rate is a true count
of the judge's own verdicts on those 57 items, and it is the one figure on the line that a rerun would
reproduce. **Everything beside it is manufactured**: kappa 0.00, TNR 43.9% and accuracy 43.9% are all just
the judge's pass rate counted against an absence, and the 32-item disagreement list is the judge grading
itself. TPR prints as a bare `-`, because there were no human passes to compute it from — and a dash on a
report reads as *we chose not to print this*, not *there was nothing here*.

The disagreement list is where this hides best, because it is the part of a report people trust most.
Thirty-two rows with real item ids is the most convincing artefact this suite produces, it is what a
reviewer reads first, and every one of those rows was generated against a label that does not exist. An
interval hides nearly as well for a different reason: this CLI does not print one at all, so somebody will
write `56.1% (43.3%–68.2%)` on the strength of a pass rate that happens to be the only honest number on
the screen — and the same hand will attach one to `kappa 0.00` in the report above it. An interval reads
as rigour. It is the one thing on a page nobody thinks to check.

The lie: **a suite that answers when it has nothing to measure will answer every time, and nothing on the
page tells you which of your numbers are real.** The report names the judge and the split and does *not*
name the variant, so it cannot even be reconstructed from the output.

**Report `66.7%` without the interval.** The Wilson bounds are 53.7% to 77.5%. That is a number that could
honestly be 54% or 77%, and every downstream decision that treats 66.7% as a point is treating one draw as
the measurement. The lie: **a bare proportion on a dashboard is a claim, and the interval is what makes it
evidence** ([04.4](../module-04/lesson-04.md)).

**Trust `doctor`'s green because the suite line is green.** `ok suite` means a suite ran *with a recorded
judge*. It does not mean your judge is pinned — the judge menu has no digest in it, which is lesson 11.3's
entire problem, and `doctor` cannot check a field the dataset does not carry. It does not mean every variant
has labels either, as the break above shows. The lie: **a health check that reports what exists is read as
a guarantee about what is pinned**, and the gap between those two is where CI goes red.

## Fix it

1. **Fail before you print, not after.** The rule worth more than any of the others: **a missing
   measurement is not a failure.** Zero is a measurement — something passed zero items, and that is a fact
   about the items. A typo is the *absence* of a measurement. The code cannot tell those two apart unless
   you make it, and until you do, it will answer "0.0%" to both.
2. **Validate the subject before you score it, and say what you have.** This package now does both halves
   of that. The CLI rejects an unknown variant before it does any work at all:

   ```
   py -m evallab.cli run --judge c-plain-3b --variant v9 --split dev
   ```

   ```
   missing  variant       'v9' is not one of: v1, v2, v3, v1padded
   ```

   …exits 2, prints no pass rate, and hands you the list you should have typed. And lower down,
   `RecordedJudge.samples` refuses a key it has no record of, naming the variants it does have:

   ```
   KeyError: no recorded run for c-plain-3b on item s01 variant 'v9'.
   Recorded variants: v1, v1padded, v2, v3. A missing run is a missing measurement, not a failure.
   ```

   A `KeyError` that names the variants it does have is the difference between a five-second fix and a
   number that ends up in somebody's report.
3. **Check that the label set is the size you think it is, not just that it exists.** The variant guard
   catches `v9`. It cannot catch `v1padded`, which is a real variant with real judge verdicts and no human
   labels — and `tp=0` with `fn=0` is the signature. Any variant whose confusion matrix has no true
   positives *and* no false negatives has no positive human labels in it, and that is a dataset fact you
   can assert on in one line. Do the same for slices: `SliceScore.tnr_measurable` already refuses to
   report a rate over a population that has no failures in it.
4. **Print the variant in the report.** One field. `eval: 66.7% pass on n=57 (v1, dev, Llama 3.2 3B - Plain
   - 0 shots)` — and put the digest next to the model name the moment one exists. A report whose subject
   cannot be named from the report is a report nobody can debug at 2am, and this one does not even
   say which of the five figures on it came from a measurement.
5. **Print the interval beside the point.** `66.7% (53.7%-77.5%)` on the same line. It is one call —
   `SuiteResult` already carries `pass_ci` — and it is the difference between a measurement and a claim.
6. **Put kappa and TNR on every report, never kappa alone.** A judge that passes everything reads
   `100% pass, kappa 0.00`; the kappa is what says so, and it is the only number on the line that does.
7. **Make `doctor` print the pin, not the name.** `ok judge c-rubric-3b  model=llama-3.2-3b  build=<none
   recorded>` is a line a reader can act on. Today's `ok datasets` line tells you a file exists; the pin is
   the thing that has to be identical on the second machine.
8. **Run `py -m pytest tests/ -q` in the same job as the suite.** Seventeen tests, under a second. A suite
   whose arithmetic can change without a test failing is not a gate, it is a print statement.

## How do I know it works?

**Challenge, on dev.** The dev split is **57 items** and it is two thirds of the evidence, so a suite that
clears these is not finished:

- **`doctor` says `ok` on both required lines, and you can say what each one checked.** Datasets found,
  and a full 57-item suite ran end to end with no model. The two `optional` lines name their lessons rather
  than failing, which is what makes the course completable without an API key or a GPU.
- **Every figure on the report has its denominator and, for the pass rate, its interval.** `66.7% (38/57)`,
  Wilson `53.7%–77.5%`, kappa `0.43` with a bootstrap interval of `19.5%–64.4%`, TPR `86.7% (26/30)`,
  TNR `55.6% (15/27)`, and 16 disagreements out of 57.
- **The same command twice gives byte-identical output**, and `test_suite_is_deterministic` passes. This is
  the floor, not the ambition: a suite that reports a different interval on every run is a suite that will
  be turned off.
- **The report names its judge, its variant, its split and its item count** — and you have looked up that
  judge's `model` field and written down what is *not* recorded next to it.

**Then one held-out validation**, on `test_ids` — the remaining **37 items**, read once:

| | Dev, 57 items | Held-out, 37 items |
|---|---|---|
| Plain judge pass rate | 66.7% (53.7–77.5) | **73.0% (57.0–84.6)** |
| Plain judge kappa | 0.43 (19.5–64.4) | **0.37 (12.1–62.8)** |
| Plain judge TNR | 55.6% | **45.0%** |
| Rubric judge pass rate | 59.6% (46.7–71.4) | **43.2% (28.7–59.1)** |
| Rubric judge kappa | 0.79 (61.7–92.9) | **0.73 (48.5–94.5)** |
| Rubric judge TNR | 81.5% | **90.0%** |

Every point estimate in that table is the one lesson [06.2](../module-06/lesson-02.md) validated in the
browser: kappa 0.43 and 0.37 for the plain judge, 0.79 and 0.73 for the rubric judge, TNRs 55.6/45.0 and
81.5/90.0. The intervals differ from that lesson's by about a point at each end — the browser's bootstrap
draws different resamples from this engine's — and that gap is the whole of lesson 11.2.

Four things in that table are the lesson.

**The plain judge's kappa got worse on held-out data**, 0.43 to 0.37, and its TNR fell ten points. It did
not overfit a threshold — it has no threshold — but 37 items is a genuinely smaller sample and the
interval widened from ±22 to ±25 points around a kappa that fell. A judge you validated on 57 items has a
number with a width, and the width is what grew.

**The rubric judge's kappa held** (0.79 to 0.73, overlapping intervals) while its *pass rate* fell from
59.6% to 43.2%. Those are different measurements and they moved apart: the judge kept agreeing with the
humans while the system scored worse on the half it had never been tuned against. If you had been watching
only the pass rate you would have concluded the rubric regressed.

**And the comparison you tuned on did not survive.** On dev, the rubric judge read `v1 vs v2` as
**+26.3 points, 95% CI 7.0% to 43.9%, p = 0.014** — a result. On the held-out 37, the same comparison
reads **+18.9 points, 95% CI −5.4% to 40.5%, p = 0.167** — the interval crosses zero. Nothing regressed;
the sample got smaller and the effect was inside its own noise the whole way. This is lesson
[04.2](../module-04/lesson-02.md)'s one-validation rule, in Python, with a number on it, and it is why
the 37-item read is done once and not tuned on.

## Use / don't use

**Do run `doctor` first, every time, on every machine — including CI.** It costs under a second and it
answers the only question that matters before you start: *can this machine do the thing at all?* The
`optional` lines are the valuable part; they tell a learner on a machine with no container runtime that
lesson 11.3 is the one they cannot do, instead of letting them find out at the last step.

**Do run a suite on recorded verdicts before you run one that costs money.** The whole of this lesson took
no credits. The first paid judge call should be the one where you already trust the plumbing, because by
then the expensive failure modes are the ones you chose.

**Do commit the dataset file, and commit the package.** Two of the three failures above are "a file was not
there". `datasets/support.json` is 94 items of labels and recorded verdicts; it belongs in the repository
next to the code that reads it, and a checksum of it in the CI log turns "the data changed" from an
argument into a fact.

**Do print ASCII, or at least ASCII-safe, in anything that goes to a log.** The whole reason `safe()` exists
is that a middle dot in a judge label rendered as mojibake on a stock Windows console. Your CI logs are read
on machines you do not control.

**Don't trust a model name as a pin.** `llama-3.2-3b` is a name. It is not a digest, not a quantisation and
not a date, and two machines can satisfy it with different weights. Until the key in
[`judge.py`](../../labs/common/evallab/judge.py) — `model_build` — is filled with something that actually
identifies the build, your suite is not reproducible, and `doctor` cannot tell you otherwise.

**Don't put a suite in CI before you can run it locally and read it.** Every failure in this lesson is a
suite that was believed and not read. The report is the interface; if you cannot read it in ten seconds,
nobody will read it in ten seconds on a red build either.

What teams actually do in production: keep the dataset and the suite in the same repository, run
`doctor` as the first step of the pipeline, print the judge label *and* its digest *and* the variant
together on one line, and keep the disagreement list in the log rather than only on a dashboard. The
dashboard is where numbers go to be believed; the log is where they have to survive being wrong.

## Reflect

1. The rubric judge reads `v1 vs v2` as **+26.3 points, p = 0.014** and the plain judge reads the same
   comparison as **+1.8 points, p = 1.000**. Write the two sentences you would put in a design document to
   explain to a stakeholder why the conclusion about the *system* depends on the *judge*, and say which of
   the two numbers your team would have shipped on Monday.
2. `doctor` prints `ok datasets` and `ok suite`, and the judge menu has no digest in any of its sixteen
   entries. Write the one line you would add to `doctor`'s output that turns "the judge is named" into "the
   judge is pinned", and say what you would do when the answer is that it is not.
3. Your report says `66.7% pass on n=57` and nothing else about how sure that is. Write the exact sentence
   you would put next to it in a pull request description, including the interval, the kappa and the number
   of items — and say which of those four numbers you would defend hardest if the PR reviewer asked "how do
   you know?".

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- pytest, [Import mechanisms and `sys.path`/`PYTHONPATH`](https://docs.pytest.org/en/stable/explanation/pythonpath.html)
  — why `python -m pytest` and `python -m evallab.cli` behave differently from the bare command, and the
  documented reason the working directory ends up on the import path at all. This is the mechanism behind
  the first failure on this page.
- pytest, [Flaky tests](https://docs.pytest.org/en/stable/explanation/flaky.html) — the toolkit's own account
  of a suite that fails intermittently, and of the seed being part of the test rather than something the
  test hopes for. `test_suite_is_deterministic` is that rule applied to an eval suite.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the habit that separates a suite
  from a print statement: the number, the sample size behind it, and the check you would run if the number
  moved. All three are on the first page of this report; the first is the one everybody ships.