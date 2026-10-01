# Module 11 labs — from lab to code

Three labs. Each has a **starter** with failing tests and a **solution** next to it. Start with
`starter/`, make the tests pass, then compare — and be suspicious if you had to change a test.

Everything here runs with **no API key and no model download**. The default judge replays runs
recorded at build time, exactly as the browser labs in modules 1–10 did. Lesson 11.3 offers a real
local model as an *option*; none of these three labs requires it.

## Before you start

```bash
cd labs/common
$env:PYTHONPATH="."       # PowerShell; on macOS/Linux: export PYTHONPATH=.
py -m evallab.cli doctor
```

On Windows the launcher is `py`; elsewhere it is `python3`. If `doctor` says the datasets are
missing, you are in the wrong folder — the package looks for `datasets/` as a sibling of
`labs/`, and the module zip has both.

The whole set:

```bash
py -m pytest labs/common/tests -q          # the package's own tests, 17 of them
py -m pytest labs/module-11/starter -q     # your labs, which should fail
```

---

## Lab 1 — Read a suite, then make it readable by a machine

**The failure this fixes.** A suite that prints a pass rate and nothing else is a suite nobody can
act on when the gate fires. The pass rate says *that* something moved; it does not say *what*, *for
whom*, or whether the judge or the system is at fault.

**Your job.** `starter/report.py` already runs a suite and prints a number. Extend it to emit a
machine-readable report that answers the four questions a gate has to answer:

1. What changed? (pass rate, and the interval around it)
2. Is the judge good enough to be the thing deciding? (TPR, TNR, kappa — and the sample size for each)
3. Where are the disagreements? (the items, grouped by the human's failure category)
4. What is invisible? (any slice with no failing items, so its true-negative rate cannot be measured)

Write it to `report.json` and print a two-line summary a person can read in a pull-request comment.

**Tested by** `test_report.py`. Four tests, and one of them is the one that matters: a slice with
no failing items must be reported, not silently omitted. That is lesson 4.3 arriving in production
form, and a report that omits it is how a team finds out their worst slice is unmeasured *after*
shipping.

---

## Lab 2 — Port a statistic and prove it agrees

**The failure this fixes.** A reimplemented statistic that is "about right" produces a report whose
numbers disagree with the ones in the browser tab, and then nobody can tell which is wrong. The
whole cost of the port is a parity test.

**Your job.** `starter/stats.py` has two functions with the bodies removed:

- `rouge_l(candidate, reference)` — longest common subsequence F-measure (lesson 3.3's metric)
- `bootstrap_ci(values, resamples, seed)` — a percentile interval (lesson 4.4)

Implement them. Do not import them from `evallab`; the point is to write them yourself and then
check you landed in the same place.

**Tested by** `test_stats.py`, which checks against hand-computable values *and* against the
shipped JavaScript fixtures. If your `rouge_l` disagrees with `codemetrics.js`, your answer is
wrong, not the fixture.

Two traps are built into the test file, both of which cost the real course real time:

- a multi-word case-sensitive mismatch shifts LCS and quietly changes the score
- a bootstrap with an unseeded RNG gives a different interval on every run, so a CI job built on it
  fails intermittently and gets disabled

---

## Lab 3 — Make a judge verdict reusable, safely

**The failure this fixes.** A cache that returns a verdict for a judge you did not run. It produces
numbers that are plausible, reproducible, and completely wrong — the worst kind, because nobody
questions a number that repeats.

**Your job.** `starter/cache.py` implements a `JudgeCache` with the wrong key. It keys on the item
and the judge id, and ignores everything else. Make it key on the full key from lesson 5.3:

> dataset item id, the system output, judge model build, the full prompt text, the rubric, the
> few-shot ids and order, the answer order, the decoding settings, the sample index

`evallab.judge.cache_key` is in the package and is already correct — you are being asked to
understand why, not to avoid typing. The tests will change one field at a time and assert the key
moves; a key that ignores a field fails the moment that field differs.

Then add a miss counter, because a cache that is always hitting is a cache whose key is too loose,
and you want to see that in the log.

**Tested by** `test_cache.py`.

---

## Running everything

```bash
py -m pytest labs/common/tests -q
py -m pytest labs/module-11/starter -q
```

If `labs/common/tests` fails, the package is broken and nothing else matters — that suite is the
guarantee that your numbers mean the same thing the browser's do.

## What is in the solution folder

`starter/../solution/` holds a working version of each lab. Read it **after** your tests pass and
before you compare line by line. If you solved it differently, that is usually the more interesting
outcome, as long as your tests pass and you can say why the difference is safe.
