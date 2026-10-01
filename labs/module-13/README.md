# Module 13 labs — the gate, on every pull request

Two labs. Each has a **starter** with failing tests and a **solution** beside it.

**Nothing here needs an API key, a model, or a network.** The judge is the recorded one that modules
1–10 used in the browser and modules 11–12 used in Python, every statistic is computed for real
from it, and lesson 11.3's live Ollama judge is still an *option* that neither lab requires. The
whole suite is 94 items and 282 verdicts, which on the course's recorded price sheet is **$10.70**
— a number that exists so the budget line in lab 2 is not zero, not a bill from anywhere.

## Before you start

```bash
py -m pytest labs/common/tests -q      # the package: 55 tests
py -m pytest labs/module-13/starter -q # your labs, which should fail
```

You do not need `PYTHONPATH`. `pytest.ini` puts `labs/common` on the path, and each lab's
`conftest.py` puts the lab itself there. To run a lab as a script instead — no pytest, no
install — use the entry points the CI workflow calls:

```bash
py labs/module-13/solution/gate_lab.py --grid     # price the gate both ways
py labs/module-13/solution/gate_lab.py --out gate.json
py labs/module-13/solution/cost_lab.py key         # the judge's cache name
py labs/module-13/solution/cost_lab.py --cache .judge-cache.json --out cost.json
```

---

## Lab 1 — A gate that blocks a planted regression

**The failure this fixes.** A suite that goes green while something real is broken, and a team that
finds out in production. The exercise is to build a gate and then **plant a regression and prove
the gate blocks it** — and to prove the other half too, because a gate that only does the first is a
coin with a label.

**Your job.** `starter/gate_lab.py` has `evallab.gate.run_gate` wired up: it does the paired
comparison, the bootstrap, the interval, the quarantine and the reason text. What is missing is two
functions, and they are the whole decision:

1. **`status_for(drop, tolerance)`** — the rule. It needs **three** answers, not two:
   `blocked`, `pass-with-warning`, `pass`. A drop that is real and smaller than the tolerance is
   not a pass. It is a pass you do not believe, and the difference has to survive into the status,
   the reason and the exit code, because a pull-request comment that says "passes" gets read as
   "fine".
2. **`decide(...)`** — one run of it, as a `Verdict` a pull request can branch on, with a reason
   that names the drop *and* the interval it was measured against.

**The case the lab is for.** The healthy re-run above is **2.1 points** down; the test
`test_a_real_drop_inside_the_tolerance_is_a_warning_not_a_silent_pass` pins a **1.1-point** one. Either
way the gate is right not to block it, and either way it is *a drop* — and "the suite did not prove a
regression" and "the suite proved there was no regression" are different claims. A gate that only has
a green light has to pick one of them, and the one it picks by default is the one that is wrong.
Lesson 10.3's whole argument is that a gate which blocks on noise gets switched off within a month;
the gate that goes silent on a dip it cannot resolve is the same gate arriving from the other
direction.

**Tested by** `test_gate_lab.py` — 17 tests, and the grid ones are the lesson rather than the code.
`price_gate()` runs the gate you wrote 400 times a cell and prints both of its failure rates; the
same function is in the starter, so those tests pass either way and are there to keep the two
failure modes honest while you work.

`quarantine.json` ships one entry, `s05`, with a reason and an owner and a review date, and it is
the list the verdict reports: every entry is a check that has stopped running, and a check that has
stopped running and is not printed anywhere is indistinguishable from a check that is not there.
`Quarantine.add` refuses an entry that is missing any of the three.

### What the gate says when you run it

Real output, on this repository, with no model anywhere in it. 94 frozen items, judge `c-rubric-3b`,
variant `v1`, 3 repeats, tolerance 5 points. The recorded baseline is **52 of 94 = 55.3%**.

```console
$ py labs/module-13/solution/gate_lab.py
planted regression : BLOCKED: candidate is 10.6 points below the current build. Interval -19.1 to -3.2 points; tolerance 5.  [1 quarantined: s05]
healthy re-run     : PASS-WITH-WARNING: candidate is 2.1 points down, which is inside the 5-point tolerance. Interval -7.4 to +2.1 points; tolerance 5. Not evidence of a regression and not evidence against one - widen the suite or raise the repeats before you believe this.  [1 quarantined: s05]
wrote gate.json
$ echo $?
1
```

Read the second line carefully. That is **the same healthy code, scored again**. It did not block,
and it did not pass either, and both of those are the gate working. A run that had reported `PASS`
there would have told the engineer "we tested this" when what was tested was one of the two ways of
being wrong.

The plant is 9 of the 52 questions the recorded baseline passes — `s02 s03 s05 s08 s13 s14 s15 s16
s19` — which is **9.57 points** on the identical run. The run above reports 10.6 because the
candidate is a *fresh* judge run and picks up the noise a real run would.

One trap worth meeting once, because it is the kind of thing a reader tries and gets the wrong
answer to: **breaking an item the judge already failed costs exactly nothing.** Force the first nine
failures to fail again and the drop is `0.00 points`. The metric counts passes, not edits, and a gate
that reported a regression there would be one you would have to learn to ignore.

### The two rates, priced

`py labs/module-13/solution/gate_lab.py --grid`, 400 trials a cell, the regression planted as the
first tenth of the item list exactly as lesson 10.3's simulator plants it:

```console
$ py labs/module-13/solution/gate_lab.py --grid
 items  repeats  block  false alarms   missed  the block costs
    20        1      2         31.0%    47.0%            6.09 pts
    20        3      2         28.0%    49.0%            5.28 pts
    20        5      2         24.2%    50.7%            4.74 pts
    40        1      4         23.5%    40.8%            5.95 pts
    40        3      4         19.2%    48.8%            5.06 pts
    40        5      4         18.5%    49.2%            4.94 pts
    94        1      9         13.8%    44.8%            5.19 pts
    94        3      9          9.0%    50.5%            4.87 pts
    94        5      9          7.5%    47.2%            4.74 pts
```

**Read the two columns separately, not the cells.** Down the item axis at 3 repeats, false alarms go
28.0% → 19.2% → 9.0% and missed goes 49.0% → 48.8% → 50.5%, which is nowhere. Across the repeat axis
at 94 items, false alarms go 13.8% → 9.0% → 7.5% and missed goes 44.8% → 50.5% → 47.2%. **A
regression is a proportion.** It costs 4.74 to 6.09 points in every row of this table, because the
items it broke are the same items; what more items and more repeats buy is a quieter measurement of
the same drop, and a quieter measurement of the same drop is worth exactly one thing.

The block cost is not constant either, and that is the wrinkle: a tenth of the list is not a tenth
of the pass rate, because the items at the front are not average items. It is 6.09 points on 20
items and 4.87 on 94. **A miss rate is always a miss rate for a named regression.**

The tolerance is the knob that trades the two, and at 94 items × 3 repeats:

```console
$ py labs/module-13/solution/gate_lab.py --sweep
 tolerance  false alarms   missed   (94 items, 3 repeats, 400 trials)
        0p         45.2%    10.5%
        1p         45.2%    10.5%
        2p         32.2%    18.5%
        3p         23.2%    28.5%
        4p         16.2%    38.0%
        5p          9.0%    50.5%
        8p          1.0%    81.0%
       10p          0.5%    92.5%
       15p          0.0%    99.8%
```

That is lesson 10.3's table, reproduced in Python on the same dataset and the same rule. At zero
tolerance this gate blocks **45.2%** of healthy builds — that is one healthy build in two, and it
would be disabled inside a month.

The measurement's own width, measured the same way: over 40 healthy re-runs at 94 items × 3 repeats
the paired 95% interval has a **median half-width of 6.4 points** (min 4.8, max 8.5), and one item
is 1.06 points. The tolerance is 5 points against a 6.4-point half-width, and the regression it has
to see is 4.87. **The signal is smaller than the noise it is being resolved against** — which is
why the miss rate is 50.5% and why no amount of threshold tuning fixes it. The fix is more items on
the failing slice, and the price of that is the last column of the first table.

400 trials of a 10% rate buys you about ±2 points. Every figure above is a real computed number from
this repository, and the third significant figure is formatting.

---

## Lab 2 — Keep the suite affordable

**The failure this fixes.** The suite costs more to run than the product it protects, so somebody
turns it off. A gate nobody runs protects nothing. Two things keep it alive, and the first one is
not a new idea — lesson [5.3](../../lessons/module-05/lesson-03.md) already wrote the rule.

**Your job.** `starter/cost_lab.py` has two holes:

1. **The cache key is too loose.** It covers the item, the variant, the judge id and the repeat
   number, and nothing else. Key it on the whole of lesson 5.3 — item id, variant, judge id, model
   build, prompt text, rubric, few-shot ids and order, answer order, decoding settings, sample index.
   `evallab.judge.cache_key` is already correct; you are being asked to understand why, not to avoid
   typing. The tests change one field at a time and assert the key moves, exactly as
   `labs/module-11/starter/test_cache.py` does.
2. **The run accepts a `Budget` and then ignores it.** Check the ceiling *before* each call, not
   after the run: a run that checks at the end has already spent the money and has only decided not
   to admit it.

**The thing people get wrong on the way.** The cache is asked *before* the budget is. A hit is a
lookup and costs nothing, so it must not count against the ceiling — a budget that charges for
lookups fails every warm run, and the fix somebody reaches for is to delete the cache. There is a
test for exactly this: warm the cache, then run the whole suite with a ceiling of **zero** calls, and
it must still finish.

**Tested by** `test_cost_lab.py` — 20 tests.

### What a run costs, cold and warm

Same repository, same command, twice:

```console
$ py labs/module-13/solution/cost_lab.py --cache .judge-cache.json
94 items x 3 repeats: 282 judge call(s), 0 cache hit(s), $10.6991
  suite cache key: 4fa9ed62   (cache file: .judge-cache.json)

$ py labs/module-13/solution/cost_lab.py --cache .judge-cache.json
94 items x 3 repeats: 0 judge call(s), 282 cache hit(s), $0.0000
  suite cache key: 4fa9ed62   (cache file: .judge-cache.json)
```

That is the whole cost lever: **282 verdicts to $0.00**, for the price of reading a file. It is not
a free lunch and it is not nearly free either — change one character of the rubric and every one of
the 282 keys misses, which is the middle row of lesson 11.3's table and the first test in
`test_cost_lab.py`.

And the ceiling, with a cold cache and the limit set to 40 calls:

```console
$ py labs/module-13/solution/cost_lab.py --cache fresh.json --max-calls 40
94 items x 3 repeats: 40 judge call(s), 0 cache hit(s), $1.5176  STOPPED: budget ceiling reached: 40 call(s) and $1.5176 so far, limit is 40 call(s) and $10.70. The suite did not finish, so it has no result to report.
$ echo $?
1
```

It stopped at exactly 40 — the last call *inside* the ceiling, not the first one past it — and it
scored 14 of the 94 items. It reports `"ok": false`, and the job goes red. Set the shipped ceiling to
the shipped size, 282, with no slack: the day somebody adds a fourth repeat without raising it, this
is the step that tells them, and it is a pull request somebody can argue with. A ceiling with room
in it is a ceiling nobody has thought about.

---

## The CI workflow

`labs/module-13/.github/workflows/evals.yml` is a complete, copyable GitHub Actions job: it names the
judge, restores the judge-call cache between runs, runs the suite under the budget, runs the gate,
posts the verdict as a pull-request comment, and only then fails the merge.

**Copy it to `.github/workflows/evals.yml` at the root of your repository.** GitHub only reads
workflows from the root, so the copy in this folder is a template and nothing in it runs until you
move it. Then change the four `labs/module-13/...` paths to wherever your suite lives — that is the
only edit the job needs.

Four things in it are the lesson rather than plumbing:

- **The cache key is what makes the restore safe.** Step 1 runs `cost_lab.py key`, which hashes all
  eight non-item components of the lesson 5.3 key — dataset, judge id, variant, model build, prompt
  hash, few-shot ids and order, answer order, decoding settings. On the shipped configuration that
  is `4fa9ed62`. A verdict is only reusable by a run that would have produced it, and "would have
  produced it" is exactly that string. **A cache keyed on anything weaker — the commit, the branch,
  the date — will happily serve verdicts from a prompt nobody ran, and it will do it silently,
  because the numbers will look exactly right and nothing about a number says when it was measured.**
- **`${{ github.run_id }}` is in the cache key on purpose.** A static key is written once and never
  written again: the second run would restore the first run's verdicts and no run after that would
  save anything. With the run id in the key, every run saves under its own name and
  `restore-keys` finds the most recent one for the same judge.
- **`continue-on-error` on the gate step, and the failure comes last.** A gate that turns the job red
  at step 4 never reaches the comment, so the engineer gets a red X and no explanation and then
  re-runs the suite by hand. Post the reason first; block the merge second.
- **The required path installs nothing.** No `pip install`, no container, no service, no secret. The
  one step that needs a package — running the suite's own tests — is marked optional at the bottom.
  That is not tidiness; it is why the suite still runs on the machine of the person most likely to
  disagree with your judge.

The job's exit code is 0 for a pass *and* for a pass-with-warning. A warning is a drop the suite can
see and cannot resolve, and it belongs in the comment rather than in a red X nobody has agreed to be
scared of yet.

---

## Running everything

```bash
py -m pytest -q                          # the whole repo: 141 tests
py -m pytest labs/module-13/solution -q  # these two labs: 37
py -m pytest labs/module-13/starter -q   # your labs, which should fail: 14 of 37
```

If `labs/common/tests` fails, the package is broken and nothing else matters — in particular,
`labs/common/tests/test_gate.py` is what pins the sign of the gate and its three outcomes, and a
change to `run_gate` that breaks the trade will fail there before it reaches this lab.

## A note on honesty

The **judge** behind every number above is the recorded one: a seeded educational model of judge
behaviour, not a live LLM. The judge names in `datasets/support.json` are the labels the recorded
runs are filed under, not measurements of those models in the wild. Every statistic computed from
those verdicts is computed for real.

The **prices** are the course's recorded price sheet for that educational model, so that a budget
line is not zero. They are not a bill from a provider, they are not what a live judge would cost you,
and the wall-clock of one is not a number this repository has measured — lesson 11.3 says so and
means it.

The **noise model** is the shipped simulator's: for one item, the verdict is a majority over
`repeats` samples drawn at random from the recorded ones, because the recorded samples *are* the
same question asked that many times. Two healthy judge runs of the same code differing is not a
simulation artefact; it is what run-to-run judge noise is.
