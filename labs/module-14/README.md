# Module 14 labs — close the loop

Two labs. Each has a **starter** with failing tests and a **solution** beside it.

**Nothing here needs an API key, a model or a network.** The judge behind every
number is the recorded one that modules 1–10 used in the browser and modules 11–13
used in Python, the traffic is the shipped tracer replaying that recorded data, and
every statistic on this page is computed for real from it. Lesson 11.3's live Ollama
judge is still an *option* that neither lab requires.

## Before you start

```bash
py -m pytest labs/common/tests -q      # the package: 71 tests
py -m pytest labs/module-14/starter -q # your labs, which should fail
```

You do not need `PYTHONPATH`. `pytest.ini` puts `labs/common` on the path, and each
lab's `conftest.py` puts the lab itself there. To run a lab as a script instead — no
pytest, no install:

```bash
py labs/module-14/solution/monitor_lab.py      # one window, three verdicts, the price list
py labs/module-14/solution/monitor_lab.py --psi    # move the input mix and watch the index
py labs/module-14/solution/loop_lab.py         # a production failure becomes a test case
py labs/module-14/solution/loop_lab.py --sample    # the cost of sampling
```

---

## Lab 1 — A monitor that is not crying wolf

**The failure this fixes.** The alert fires on day one, nobody believes it by the end
of the month, and the signal it was built to carry is gone. Not degraded — gone.
A monitor that cries wolf is worse than no monitor, because a missing monitor is
obviously missing and a crying one is believed right up until the week it matters.

**Your job.** `starter/monitor_lab.py` has the interval arithmetic, the window model
and the price list already written. Three TODOs, and they are one decision:

1. **`Monitor.usable`** — the check. Compare the sensitivity against the
   measurement's own Wilson half-width.
2. **`status_for(monitor, value)`** — the rule. It has two answers and it needs
   three: `REFUSED`, `FIRES`, `QUIET`.
3. **`observe(monitor, value)`** — the sentence, including the one
   `Band.explain()` already knows how to print and that nobody acts on.

**The case the lab is for.** `Band.explain()` ends with *"The band is narrower than
the measurement's own half-width, so it will fire on noise."* The package knows the
sentence. It does not know the **decision**, and a monitor that prints that sentence
and then fires anyway is the bug. `test_a_band_narrower_than_the_half_width_is_refused`
is the test that says so — including the case a rule usually forgets, which is that a
real collapse is refused too. A refusal is not a quiet day.

**Tested by** `test_monitor_lab.py` — 16 tests. The price-list tests run
`price_band` 400 windows a row; that function is in the starter too, so those tests
pass before you start and are there to keep the two failure modes honest while you
work.

### What the monitor says when you run it

Real output, on this repository, with no model anywhere in it. A recorded baseline of
**0.546** pass, judge `c-rubric-3b`, variant `v1`, 3 repeats, a five-point band.

```console
$ py labs/module-14/solution/monitor_lab.py
baseline: 0.546 pass over the 94 recorded items, judge c-rubric-3b, 3 repeats
  n=20  : half-width 0.200  REFUSED: cannot decide at n=20. The band is 0.050 and the measurement's own half-width is 0.200, so it will fire on noise. Either widen the band to 0.200 or wait for a window of more requests - and write down which, because one of them is a decision to stop noticing.
  n=400 : half-width 0.049  QUIET: pass rate is 0.556, inside the band 0.496-0.596 against a baseline of 0.546 on n=400 (Wilson 0.496-0.593, half-width 0.049).
  n=400 : half-width 0.049  FIRES: pass rate is 0.446, outside the band 0.496-0.596 against a baseline of 0.546 on n=400 (Wilson 0.496-0.593, half-width 0.049).
wrote monitor.json
```

Three numbers in the first line carry the whole lab: **0.200**, **0.050**, and the
fact that the first one is four times the second. A twenty-request window is not a
measurement of a five-point change; it is a measurement of a forty-point one, and the
monitor is honest enough to say it does not know.

The third line is the monitor working. Same code, same band, same day, a window four
hundred requests wide — and now the band is wider than the noise, so it is allowed to
have an opinion about a real ten-point collapse.

### The band, priced

`py labs/module-14/solution/monitor_lab.py --price`, 400 windows a row, the
regression planted as a tenth of the window drawn from the requests the healthy run
*passed*:

```console
    n  half-width   band  usable  refused  false alarms   missed   a real drop costs
   20       0.200   0.05      NO   100.0%         63.7%    27.8%              10.00 pts
   50       0.133   0.05      NO   100.0%         46.8%    25.0%              10.00 pts
   94       0.099   0.05      NO   100.0%         37.0%    19.5%               9.57 pts
  200       0.068   0.05      NO   100.0%         15.5%     7.8%              10.00 pts
  400       0.049   0.05     yes     0.0%          5.8%     2.5%              10.00 pts
```

**Read the columns, not the cells.**

- The **false alarms** column is the one that ends the project. At twenty requests a
  five-point band fires on **63.7%** of healthy days — two days in three somebody is
  paged about a day nothing happened. At four hundred it fires on **5.8%**, which is
  roughly what a five-point band is supposed to mean.
- The **missed** rate falls too, from **27.8%** to **2.5%**, and that is the trap in
  reading this table as a simple trade. A tenth of the window breaking is a
  **proportion**: it costs **10.00 points** at every window size, because the requests
  it broke are the same requests. What a bigger window buys is not sensitivity, it is
  a quieter measurement — and a quieter measurement is worth exactly one thing, which
  is stopping people from being paged.
- **Refused** is the column the exercise adds, and it is the only one that is free.
  Everywhere the band is narrower than the half-width the rule refuses every window,
  so the cost of the refusal is *nothing* rather than the 63.7% in the next column.

**The crossover sits between 200 and 400 requests.** That is the computed answer to
"how big does my window have to be", and it is the number to put in the pull request
that adds the monitor. 400 windows a row buys you about ±2 points of width on a rate
near 6% and about ±5 near 64%, so the third significant figure on any of these is
formatting.

### Drift: the other half of the monitor

A pass rate cannot tell you that the product stopped being asked the thing you built
it for. `psi` is a separate measurement, and the shipped `shift()` gives you five
windows to move the dev mix into:

```console
$ py labs/module-14/solution/monitor_lab.py --psi
                                window    psi   reading
              the same mix, re-sampled  0.000   stable
          one category thinned by half  0.163   worth a look
             a category stops arriving  0.575   assume something moved
everything collapses onto one category  0.485   assume something moved
         a new category appears at 10%  1.162   assume something moved
```

Five windows, and the first one is the row that earns the rest: a window that has not
changed reads **0.000**, so if your index is not zero on a quiet day it is measuring
something other than drift.

- **0.163** — one category halved, the rest take its share. "Worth a look."
- **0.575** — a category stops arriving. `psi` floors a zero bucket rather than
  dividing by zero, and that is not free: the thing that vanished is exactly what you
  want to be told about, and it is the loudest thing on the page.
- **1.162** — a category at a tenth of traffic, from nowhere. The most expensive
  drift there is, and the least likely to move a pass rate you are already watching.

---

## Lab 2 — Close the loop

**The failure this fixes.** A production failure gets fixed by hand once, is never
guarded, and comes back. It comes back because the thing that went wrong was never an
item, and a suite cannot regress on a case it does not contain.

**Your job.** `starter/loop_lab.py` has the round trip and the sampler written. Two
TODOs, and they are the two that cost people a quarter:

1. **`failing_traces`** reads the error off the wrong place. There are planted
   failures in the window and your function returns an empty list.
   `error.type` is an **attribute of the span**, not a key on the span — and an empty
   list is the exact shape of a healthy week on every dashboard anybody has built.
   A monitor that reports zero failures by reading the wrong key is worse than no
   monitor, because it is believed.
2. **`suite_labels`** keys on one id namespace. The tracer mints `tr_s01` from the
   item `s01`, so a match on one of them reads `False` for every failure, and a
   failure you have been fixing for months looks brand new every week.

**Tested by** `test_loop_lab.py` — 13 tests. `caught_by_suite` is written for you, so
you can read what *"the suite would have caught it"* has to mean before you fix step
one: not that a number moved, but that the new item appears **by name** in the
disagreement list.

### The round trip, run

```console
$ py labs/module-14/solution/loop_lab.py
24 failing request(s) in a window of 57, 42.1% of traffic, 24 of them already in the suite
  (the shipped record() replays the dev split as traffic, so every one of them
   is an item you already have. Real production traffic is the half of this
   exercise that is not a simulation, and it is the half worth writing down.)
   14  no_handbook_citation
    6  RuntimeError
    4  no_matching_section

the first one, carried back into the suite:
  18 of the 24 have an answer a human can label; the other
  6 are calls that raised, and there is nothing to label on those.
  tr_s01  no_handbook_citation  question: 'How many days of paid time off do I get each year?'
  human label 0 (a human read it and said this is wrong), judge verdict 1 (the online judge said it was fine)
  tr_s01 : suite n=57 -> 58, tn=22 -> 22, fp=5 -> 6, TNR 81.5% -> 78.6%
                 named in the disagreement list: yes   caught: yes
wrote loop.json
```

Four things in that output are the lab:

- **The taxonomy, not the count.** Three kinds of failure and a report with one number
  on it has told you something is wrong and nothing about what.
- **6 of the 24 cannot be carried.** A call that raised has no answer attached, so
  there is nothing for a human to agree or disagree with. Those are traces: they
  belong in the failure count and the review queue, and an item with an empty output
  and a human label on it teaches the judge nothing.
- **`human label 0, judge verdict 1`.** This is why it shipped. The online judge said
  the answer was fine, and the fix is not "make the judge better" — it is putting the
  case in the suite where the miss is a number somebody can see.
- **`fp=5 → 6`, TNR 81.5% → 78.6%, named in the disagreement list.** That is what
  "the suite would have caught it" means in a form a person can go and check in the
  morning. Labelling the same failure `1` moves nothing, and that is the point: a
  failure the judge already caught teaches the suite nothing new.

The recorded verdict travels with the item, into `runs["c-rubric-3b"]["tr_s01|v1"]`.
That is not a shortcut — it is the loop. The online judge already ran on that
request, so the verdict is a measurement somebody actually made.

### What sampling costs

```console
$ py labs/module-14/solution/loop_lab.py --sample
 sample rate    traced   errors kept  reported rate    in the review queue
       100%     57 of 57              5           8.8%          24 of 57
        50%     29 of 57              5          17.2%          24 of 39
        25%     16 of 57              5          31.2%          24 of 34
         5%      9 of 57              5          55.6%          24 of 25
```

**The numerator holds at 5 and at 24, and the reported rate goes 8.8% → 17.2% →
31.2% → 55.6%.** Both columns are true and neither estimates the other. `5/57`
estimates the failure rate of the traffic; `5/9` is a count over a set that was
*chosen* because it contains the failures, and no interval closes that gap.

That is the price of keeping every failure, and it is worth paying: the alternative
is a number that improves because you stopped looking. Print the sample rate next to
the rate computed over it, so the reader can see which one moved.

The same rule is module 12.5's: `record()` decides `fail_on` **before** it samples.
Whatever you cannot know at capture time, you cannot sample around — which is the
reason to decide the rule while you write the exporter rather than after a dashboard
has been green for a month.

---

## Running everything

```bash
py -m pytest -q                          # the whole repo: 186 tests
py -m pytest labs/module-14/solution -q  # these two labs: 29
py -m pytest labs/module-14/starter -q   # your labs, which should fail: 14 of 29
```

If `labs/common/tests` fails, the package is broken and nothing else matters — in
particular, `labs/common/tests/test_online.py` is what pins the band arithmetic and
the `error.type`-in-attributes trap, and those are the two things this module's labs
are about.

## A note on honesty

The **judge** behind every number above is the recorded one: a seeded educational
model of judge behaviour, not a live LLM. Every statistic computed from those
verdicts is computed for real, and the recorded runs disagree with themselves across
repeats, which is exactly the noise the band in lab 1 has to survive.

The **traffic** in lab 2 is `record()` replaying the dev split, so every failure it
produces is an item you already have. The lab prints that on every run. Real
production traffic is the half of the exercise that is not a simulation, and it is
the half worth writing down when you carry the loop into your own repository.

The **arrival process** in lab 1 is the one thing here that is drawn rather than
replayed: a window is `n` requests, each an item from the frozen list scored by a
fresh draw of its recorded judge samples. That is a binomial window, which is the
model `wilson()` is built for, and it is why the measured false-alarm rate at `n=400`
(5.8%) is close to what the five-point band means. Change the arrival process and the
half-width stops being the right model — which is its own lesson.

The **durations** on these spans are simulated (lesson 12.5 says so), and nothing in
these two labs depends on them.