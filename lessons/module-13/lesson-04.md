---
id: "13.4"
module: 13
minutes: 18
practice_minutes: 50
prerequisites: ["13.2", "13.3"]
objectives:
  - Count a run's judge calls and its cost from the shipped code, and say which of the two numbers a budget should be written in.
  - Explain why the budget is checked before each call rather than after the run, and what a run that hit its ceiling is allowed to report.
  - Write the six lines a pull-request comment needs so a reader can decide in ten seconds whether to look.
  - Say which numbers on a pull request are a measurement of this run and which are a claim about the gate, and keep them apart.
volatility: implementation
sources:
  - title: "Dependency caching reference (GitHub Docs)"
    url: https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching
  - title: "The Mythos of Model Evaluation (Bowyer et al., 2024)"
    url: https://arxiv.org/abs/2411.19994
  - title: "The Design and Analysis of Experiments (Dean & Voss, 1998)"
    url: https://link.springer.com/book/10.1007/978-1-4757-5482-1
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 13.4 · The eval budget, and the report on the pull request

A regression suite that nobody prices is a suite that gets switched off the first month the bill moves,
and a gate that posts forty lines of log output is a gate nobody reads. This lesson puts a ceiling on one
run, shows the two orderings that make a ceiling mean anything, and then fixes the other half: what goes
on the pull request, so a human can decide in ten seconds whether to look.

## Why it matters

The eval suite goes in on a Monday. It runs on every pull request, against the main branch, on a judge that
is a real model. Nobody writes down what one run costs, because one run is $0.00 on a laptop — the
recorded judge in this repository is free — and the number feels like it belongs to the observability bill
somebody else owns.

It belongs to nobody, which is why nobody acts on it. Three months later the invoice arrives and the eval
bill is the second-largest line on it. The meeting has two options and both are bad. **Raise the budget**,
which nobody can justify because nobody knows what the budget was. Or **turn the gate off**, which takes
ninety seconds and is invisible in every dashboard the product team owns. The second option wins; it
almost always wins. A gate nobody runs protects nothing, and the cost of a gate nobody runs is exactly the
money it spent while it was running.

And the failure is not only the money. The first week, the engineer who pushed the broken pull request
gets a red X. There is no comment. They open Actions, find the failing step, read a hundred and forty
lines of pytest output, and work out from a `PAUSED` in the middle of a stack trace what the gate thought.
On the third day they do not read the log. On the fourth they re-run the suite locally, where it passes,
because they have by then learned the thing every team learns about a required check that is hard to
interpret: **the reliable response to a red X is to re-run it, not to believe it.** Lesson [13.3](lesson-03.md)
is about what makes a gate trustworthy; this lesson is about what makes it *legible*, and both fail the
same way — quietly, and by making the cheap response the right one.

So the deliverable is two artefacts, not one. A **ceiling per run**, written down, that somebody can point
at when the bill moves. And a **comment on the pull request** carrying six lines: what the gate decided,
by how much, against what interval, what the gate was specified to catch, what the run cost, and which
checks are quarantined. Everything else belongs in the log.

## How it works

### The budget is a claim, not a target

[`evallab/gate.py`](../../labs/common/evallab/gate.py) has the whole thing in nineteen lines:

```python
@dataclass
class Budget:
    """What one run is allowed to cost, in model calls and in dollars.

    A budget is not an optimisation. It is a claim you can point at when the
    bill goes up: either the suite got more expensive and that was agreed, or
    it did not and something is wrong.
    """

    max_calls: int
    max_usd: float

    def check(self, calls: int, usd: float) -> dict:
        return {
            "calls": calls,
            "usd": usd,
            "over_calls": calls > self.max_calls,
            "over_usd": usd > self.max_usd,
            "ok": not (calls > self.max_calls or usd > self.max_usd),
        }
```

**Two ceilings, not one, and they are not the same currency.** `max_calls` is a property of *your suite* —
94 items times 3 repeats is 282 whatever anybody charges per call, and it is the number that says whether
the run did what it was configured to do. `max_usd` is a property of *a price sheet on a particular day*,
and the price sheet is the part that changes underneath you without anybody editing the suite. Writing both
is what lets you tell the two failures apart:

| What happened | `over_calls` | `over_usd` | What it means |
|---|---|---|---|
| nothing | false | false | the run is what you configured |
| suite grew | **true** | maybe | somebody added items or a repeat without agreeing to it |
| prices moved | false | **true** | the provider changed, or you moved to a bigger judge |
| both | true | true | read the commit, it is probably a good one |

Set them to the same number with slack and you get a budget that cannot fail, which is the same thing as
no budget with more typing. The shipped configuration sets **282 calls and $10.70** — the exact size of the
run, with no headroom — and the day somebody adds a fourth repeat, the suite goes red and says so:

```
94 items x 3 repeats: 40 judge call(s), 0 cache hit(s), $1.5176  STOPPED: budget ceiling reached: 40 call(s) and $1.5176 so far, limit is 40 call(s) and $10.70. The suite did not finish, so it has no result to report.
```

Read that message as a design statement rather than an error. **A run that hit its ceiling did not produce
a measurement, so it must not report one.** A suite that scores 14 of its 94 items and prints a pass rate
anyway has produced a number about fourteen questions wearing a number about ninety-four, and that is the
same class of failure as the `tn 57` matrix in lesson [11.2](../module-11/lesson-02.md): a confident value
computed over a population nobody named.

### Counting a run, and the two orderings that matter

A run's size is arithmetic, and it is worth writing down in the pull request that adds the suite:

```
94 items x 3 repeats = 282 judge calls
282 x $0.03794       = $10.69908
```

`run_gate` counts it the same way — `calls = n * repeats`, `usd = calls * cost_per_call` — and carries both
on the result, so the gate's answer and the suite's bill can never disagree. On this course's price sheet
that is **$3.57 for one repeat, $10.70 for three, $17.83 for five.** A hundred pull requests a day at
three repeats with nothing cached is **$1,069.91 a day**, and that is the number the conversation in the
first section was actually about.

Two orderings in [`cost_lab.py`](../../labs/module-13/solution/cost_lab.py) are the whole of lesson 13.4's
mechanism, and both are the kind of thing that looks like a detail until you have been on the wrong side
of it.

**The budget is checked before the call, not after the run.** A run that totals up at the end has already
spent the money and has only decided not to admit it. The call it refuses is the first one *past* the
ceiling, which is the one it does not make — which is why the run above stopped at exactly 40 with a limit
of 40, and why `--max-calls 40` is a clean stop rather than 41.

**The cache is asked before the budget is.** A cache hit is a lookup, not a call, and costs nothing. A
budget that charges for lookups fails every warm run, and the fix the first person reaches for is to delete
the cache — so a budget written in the wrong order actively destroys the only lever that makes the suite
affordable. Lesson [13.2](lesson-02.md) is the keying; this is where the keying turns into money, and the
two orders together are the difference between **$10.70 and $0.00** for the same 282 verdicts:

```
94 items x 3 repeats: 282 judge call(s), 0 cache hit(s), $10.6991
  suite cache key: 4fa9ed62   (cache file: .judge-cache.json)
```

```
94 items x 3 repeats: 0 judge call(s), 282 cache hit(s), $0.0000
  suite cache key: 4fa9ed62   (cache file: .judge-cache.json)
```

Same key, same suite, same day. `4fa9ed62` is a hash of all eight non-item components of the cache key, and
it is the whole safety argument for the restore: a verdict filed under a different prompt or a different
model build is not a verdict this configuration produced, so it must not come back under this name. A
budget saves you money and a badly-keyed cache spends it back on numbers from a prompt nobody ran — which
is why **the budget and the cache key are the same review**, not two settings.

### What goes on the pull request

The report is the discipline of [`templates/eval-design-review.md`](../../templates/eval-design-review.md)
applied to a single run instead of to a system. That template's rule is that every number carries a sample
size and a reason next to it; the same rule at the scale of one CI run means **every number on the comment
is either a measurement of this run or a quoted property of the gate, and the reader must be able to tell
which in a glance.** Six lines, in this order:

| Line | Measured or quoted | Why it is there |
|---|---|---|
| status, in one sentence | measured | the decision, before anything else |
| drop, with the tolerance beside it | measured | a number alone does not say whether it fired |
| paired 95% interval | measured | the width of the measurement the drop was taken from |
| judge calls | measured | what this run cost, in the cheapest unit |
| **must catch / accepted false-alarm rate / accepted miss rate / half-width** | **quoted from the spec** | the decision the drop is being compared against |
| quarantined ids | measured | which checks have stopped running |

The second block is the one people leave out and it is the one that makes the first block readable. A drop
of `-12.3 points` on its own is a number; a drop of `-12.3 points` against a gate specified to catch a
break of one question in ten, at an accepted false-alarm rate of 9.0% and a measurement half-width of 6.4
points, is a decision somebody can agree or disagree with. Here is the shape, from the shipped lab's
output files:

```
### Eval gate

**blocked** — candidate is 10.6 points below the current build. Interval -19.1 to -3.2 points; tolerance 5.

| | |
|---|---|
| Drop | 10.64 points (tolerance 5.0) |
| Paired 95% interval | -19.15 to -3.19 points |
| Judge calls | 282 |
| Quarantined | s05 |

**The gate specification**

- Judge `c-rubric-3b`, variant `v1`, 94 frozen items, 3 repeats
- Must catch: a change that breaks one question in ten. Planted as the first tenth of the list that costs 4.87 points; planted across the 52 questions this build passes it costs 9.57.
- Accepted false-alarm rate: 9.0% of healthy builds, at this tolerance (400 trials)
- Accepted miss rate: 50.5% of a break of one question in ten, planted as the first tenth of the item list
- Measurement half-width: median 6.4 points on a healthy re-run (94 items, 3 repeats). One item is 1.06 points.

**What the run cost**

- 282 judge call(s), 0 cache hit(s) (hit rate 0.0)
- $10.69908 at $0.03794 a verdict
- Inside the per-run budget.
```

Three properties of that shape are load-bearing, and the workflow in
[`labs/module-13/.github/workflows/evals.yml`](../../labs/module-13/.github/workflows/evals.yml) exists to
produce all three. **Post the reason before you fail the job** — the gate step carries `continue-on-error`
and the failure is a later step, so a blocked pull request gets its explanation instead of a bare red X.
**Update one comment in place**, marked with an HTML comment sentinel, so a pull request with nine pushes
has one verdict on it rather than nine, and the merge button is talking about the one that is current.
**Exit 0 for a warning.** `pass-with-warning` is a drop the suite can see and cannot resolve, and it
belongs in the comment rather than in a red X nobody has agreed to be scared of yet — that is the
same distinction lesson 10.3 argued for and lesson 13.1 put in the status field.

## Show me

All of it is from this repository, with no model, no network and no API key.

Cold, then warm, same command twice:

```
py labs/module-13/solution/cost_lab.py --cache .judge-cache.json --out cost.json
```

```
94 items x 3 repeats: 282 judge call(s), 0 cache hit(s), $10.6991
  suite cache key: 4fa9ed62   (cache file: .judge-cache.json)
wrote cost.json
```

```
py labs/module-13/solution/cost_lab.py --cache .judge-cache.json --out cost.json
```

```
94 items x 3 repeats: 0 judge call(s), 282 cache hit(s), $0.0000
  suite cache key: 4fa9ed62   (cache file: .judge-cache.json)
wrote cost.json
```

The ceiling, on a fresh cache, set to the shipped size so the day somebody adds a fourth repeat is the day
this goes red:

```
py labs/module-13/solution/cost_lab.py --cache fresh.json --max-calls 40 --out cost.json
```

```
94 items x 3 repeats: 40 judge call(s), 0 cache hit(s), $1.5176  STOPPED: budget ceiling reached: 40 call(s) and $1.5176 so far, limit is 40 call(s) and $10.70. The suite did not finish, so it has no result to report.
  suite cache key: 4fa9ed62   (cache file: fresh.json)
wrote cost.json
```

The exit code, which is what CI branches on:

```
py labs/module-13/solution/cost_lab.py --cache fresh2.json --max-calls 40 --out cost2.json ; echo $?
```

```
94 items x 3 repeats: 40 judge call(s), 0 cache hit(s), $1.5176  STOPPED: budget ceiling reached: 40 call(s) and $1.5176 so far, limit is 40 call(s) and $10.70. The suite did not finish, so it has no result to report.
  suite cache key: 4fa9ed62   (cache file: fresh2.json)
wrote cost2.json
1
```

Read that last line against the `cost.json` the run leaves behind: `ok: false`, `calls: 40`, `hits: 0`,
`verdicts_scored: 14`. **It scored 14 of 94 items and correctly refuses to call that a result.**

And the run that produces the comment, which is what lesson 13.3's tolerance and quarantine arguments are
attached to:

```
py labs/module-13/solution/gate_lab.py --out gate.json
```

```
planted regression : BLOCKED: candidate is 10.6 points below the current build. Interval -19.1 to -3.2 points; tolerance 5.  [1 quarantined: s05]
healthy re-run     : PASS-WITH-WARNING: candidate is 2.1 points down, which is inside the 5-point tolerance. Interval -7.4 to +2.1 points; tolerance 5. Not evidence of a regression and not evidence against one - widen the suite or raise the repeats before you believe this.  [1 quarantined: s05]
wrote gate.json
```

`gate.json` is what the comment is rendered from, and every field on the comment is in it:

```json
{
  "status": "blocked",
  "reason": "candidate is 10.6 points below the current build. Interval -19.1 to -3.2 points; tolerance 5.",
  "drop_points": 10.64,
  "interval": [-19.15, -3.19],
  "calls": 282,
  "usd": 10.69908,
  "quarantined": ["s05"],
  "spec": {
    "tolerance_points": 5.0,
    "repeats": 3,
    "items": 94,
    "judge": "c-rubric-3b",
    "variant": "v1"
  }
}
```

The four spec strings — `must_catch`, `accepted_false_alarm_rate`, `accepted_miss_rate`,
`measurement_half_width` — sit beside it, unchanged, on every run. **They are the only numbers on the
comment that did not come from this run**, and that is the distinction the whole format exists to make
visible.

The budget itself, asked directly:

```
py -c "import sys; sys.path.insert(0,'labs/common'); from evallab.gate import Budget; b=Budget(max_calls=282, max_usd=10.70); print(b.check(282, 10.69908)); print(b.check(376, 14.26544))"
```

```
{'calls': 282, 'usd': 10.69908, 'over_calls': False, 'over_usd': False, 'ok': True}
{'calls': 376, 'usd': 14.26544, 'over_calls': True, 'over_usd': True, 'ok': False}
```

376 calls is what a fourth repeat costs on 94 items. Both ceilings cross together, because the two are
describing the same edit from two directions — which is the healthy case. The interesting case is a run
that crosses only `max_usd`, and that is the one nobody investigates.

> [!IMPORTANT]
> The **price** used here, **$0.03794** a verdict, is the course's recorded price sheet for its shipped
> **educational model** — a recorded judge, not a live LLM. It is chosen so the budget line is not zero and
> the arithmetic is checkable. It is **not** a quote from a provider, it is not what a live judge would
> cost you, and a hundred pull requests a day at $1,069.91 is a number about this repository's price sheet
> and about nothing else. What travels is the *shape* — `n x repeats x price`, two ceilings, a check before
> each call — not the dollars. The call counts, the cache behaviour, the exit codes and every statistic in
> the comment are real, computed by running the shipped code on the shipped data.

## Try it

**Predict first**, on paper:

1. Your suite is 57 items at 3 repeats at $0.03794 a verdict. Somebody adds a fourth repeat and does not
   touch the budget. Predict which of `over_calls` and `over_usd` goes true first, and say why the answer
   is a property of the price sheet rather than of the code.
2. The budget check runs once, after the suite finishes, instead of before each call. Predict the
   difference in the reported numbers, and say what the run is able to report in each case.
3. The budget charges for cache hits as well as misses. The suite runs entirely warm, 282 hits and 0
   calls. Predict what the run reports, and then predict what the first person to see it will change.
4. A pull request is blocked. The workflow fails the job at the gate step and posts the comment in a later
   step. Predict what the engineer sees on the pull request, and what they do next.

[Lab: evallab package](../../labs/common/)

1. **Price your own run from three numbers.** Write down items, repeats and price per call, multiply them,
   and compare with the `usd` field `run_gate` puts on its result. Then set repeats to 4 and to 5 and
   write the two numbers down. The paragraph you would put in the pull request that adds the gate should
   contain the first number and the reason for the repeat count, and nothing else.
2. **Make the ceiling fire, and see where it stops.** Run `cost_lab.py` with `--max-calls 40` against a
   fresh cache file and then with `--max-calls 41`. Write down the call count at which each stops and
   explain in one sentence why they are not the same number. Then read `verdicts_scored` in `cost.json` —
   **14** at a ceiling of 40 — and say what a pass rate over that many items would mean.
3. **Check the orderings by breaking them.** In `cost_lab.py`, move the budget check to the end of the loop,
   run with a ceiling of 40, and compare the reported spend with the run above. Then move the cache lookup
   below the budget check, warm the cache, and run with `--max-calls 0`. Write the one sentence that says
   which of the two orderings costs you more if you get it wrong.
4. **Render the comment for all three statuses.** Run `gate_lab.py` three times: with a plant, healthy, and
   with `--tolerance 0.5` on a healthy build. Write the three comment bodies by hand from the `gate.json`
   each run leaves behind, and check that a reader could tell the three apart without opening a log.
5. **Find the line that is not from this run.** Take the comment above and mark every number that came out
   of this run and every number that was quoted from the specification. Then delete one of the quoted ones
   and write the sentence you would expect somebody to ask for it — that is the test of whether the block
   earns its place.
6. **Put the whole thing in the template.** Open
   [`templates/eval-design-review.md`](../../templates/eval-design-review.md) and fill in its *The gate*
   table from this run's `gate.json` and the `Spec` defaults, and its *Reproduce* row with the two
   commands above. Anything in the template you cannot fill in is the part of your eval design review you
   have not done.

## Break it

**Set the ceiling with headroom.** `max_calls = 500` on a 282-call suite reads like prudence and does
nothing at all: no configuration the team will plausibly choose fits under it, so the first person to add
a fourth repeat sails through. The lie: **a ceiling with room in it is a ceiling nobody has thought about**,
and the reason it feels careful is that it never has to explain itself.

**Check the budget after the run.** The suite spends the money, totals it up, discovers it is over, and
reports the total with a warning. The number is right and the claim is wrong — the money is already gone
and the report is a receipt rather than a control. The lie: **a limit you check at the end is a decision
not to admit a number you already paid**.

**Charge cache hits against the ceiling.** Every warm run now "costs" 282 calls, the budget fires, and the
only fix anybody reaches for is to turn the cache off. The lie: **a hit is a lookup, and a budget that
charges for lookups destroys the only lever that makes the suite affordable** — and it does it silently,
on exactly the runs where the cache was saving the most.

**Post the comment after failing the job.** The pull request goes red at the gate step; the comment step
never runs. The engineer gets a bare cross and a stack trace with a `PAUSED` in it. The lie: **a failure a
human cannot read is an instruction to re-run, and re-running is how a gate stops being believed.**

**Print forty lines of pytest and call it the report.** The numbers are in there somewhere, under a
traceback. The lie: **a log is optimised for the person who wrote it, and a pull-request comment is read
by somebody with ten seconds and a merge button.**

**Print the tolerance and drop, and leave out the spec.** `-12.3 points, tolerance 5` reads as a pass of a
test. Without the regression the gate was built to catch, the accepted false-alarm rate, and the width of
the measurement, nobody can tell whether the gate worked. The lie: **a threshold without the decision it
was a threshold inside is a number, not a gate** — the same omission as lesson 10.3's spec with no width
beside it.

**Quote this repository's dollars in a business case.** $10.70 a run is the recorded price of a recorded
judge, chosen so the line is not zero. The lie: **a price sheet for a teaching model measures the teaching
model**, and the only number from this page that transfers is `items x repeats x your price`.

## Fix it

1. **Write both ceilings, and set them to the exact size of the run.** `Budget(max_calls=282, max_usd=10.70)`
   on a 94-item, 3-repeat suite. Then put both numbers in the pull request that adds the gate, with the
   arithmetic that produced them, so the day they move somebody can see whether a decision was made.
2. **Check before every call, and refuse the call that would cross the ceiling.** The run above stops at
   exactly 40 with a limit of 40, reports `"ok": false`, and exits 1. A run that hit its ceiling reports no
   pass rate, because it has none.
3. **Ask the cache before the budget, always.** A hit is free. Write it that way and add the test that
   runs the whole suite warm with a ceiling of zero calls and expects it to finish.
4. **Carry `calls` and `usd` on the gate result itself.** `run_gate` already does, which means the
   decision and the bill are the same object and cannot drift apart in a report.
5. **Post six lines, in this order: status, drop with tolerance, interval, calls, the spec, the
   quarantined ids.** The spec block is what turns a number into a decision. Post it before the job goes
   red, and update it in place so a pull request with nine pushes has one verdict on it.
6. **Exit 0 for a pass and for a pass-with-warning; exit 1 for blocked and for over-budget.** A warning
   the team has not agreed to be scared of does not belong in a red X. It belongs in the comment, in words,
   where somebody can read it and decide.

## How do I know it works?

**Challenge, on dev.** Before the budget goes in, all five of these hold:

- **The run's size is written as arithmetic somewhere a reviewer can see it.** `94 items x 3 repeats = 282
  calls, 282 x $0.03794 = $10.69908`, and the `usd` on the gate result equals that to the last digit. A
  budget nobody can reproduce from two integers and a price sheet is a number somebody typed.
- **Both ceilings are set to the current run with no slack, and you have watched the ceiling fire.** The
  `--max-calls 40` run above stops at 40, reports `ok: false`, exits 1, and `cost.json` records
  `verdicts_scored: 14` against a 94-item suite. A ceiling you have never seen trip is a number, not a
  control.
- **A warm run costs nothing and still finishes.** 282 hits, 0 calls, `$0.0000`, and the gate produces the
  same verdict as the cold run. If a warm run fails the ceiling, the orderings in `cost_lab.py` are wrong
  and the fix is not to raise the ceiling.
- **The comment names the spec.** `must_catch`, the two accepted rates and the half-width are on it, and
  someone who has not read this lesson can say what regression the gate was built to catch. A comment
  carrying only the drop is a test result, not a decision.
- **You can tell the three statuses apart at a glance**, and a `pass-with-warning` does not turn the job
  red. The healthy re-run in **Show me** is 2.1 points down and says so in a sentence; that sentence is the
  feature.

**Then one held-out check, on the split you did not price.** The 37 held-out items at 3 repeats are **111
calls and $4.21134** — 39% of the full-suite budget, from a set that is smaller and therefore *cheaper*,
which is the trap. A budget written against the dev half's 57 items is `171 calls, $6.48774`, and the
same tolerance on that half carries a **24.2%** false-alarm rate against **18.2%** on dev (400 independent
healthy pairs each, lesson 13.3's table). So the cheaper set is also the noisier one, and:

| | Dev, 57 items | Held-out, 37 items |
|---|---|---|
| Judge calls per run at 3 repeats | 171 | 111 |
| Cost per run at the recorded price | $6.48774 | $4.21134 |
| Share of the full-suite budget | 60.6% | 39.4% |
| False alarms at 5 points, 3 repeats | 18.2% (400 pairs) | **24.2%** (400 pairs) |

**A budget priced on the smaller set under-counts the suite it is protecting by 60%, and the same
tolerance mis-fires one time in four instead of one in five on the half nobody tuned it on.** The first
row is why you price the *whole* frozen set and not the split you happened to develop on; the last row is
lesson 10.3's half-width arriving in the cost column instead of the pass-rate column. Neither is a reason to
buy a bigger set — it is a reason to write down which set the budget was measured on, and to re-measure
when the set changes.

## Use / don't use

**Do price one run, in calls and in dollars, and put the arithmetic in the pull request that adds the
gate.** Two integers and a price sheet. It is the cheapest artefact in this module and it is the only thing
that survives the first budget conversation.

**Do set the ceiling to the exact size of the run.** No headroom. The first person to add a repeat gets a
red build and a sentence explaining it, and that is a pull request somebody can argue with.

**Do check before the call and ask the cache before the budget.** In that order, always. The first makes the
ceiling a control; the second stops the ceiling from deleting the thing that makes the suite affordable.

**Do carry the cost on the verdict, not in a separate job.** `run_gate` already returns `calls` and `usd`,
so the number on the comment and the decision on the comment come from the same object and cannot disagree
after somebody changes one of them.

**Do write the specification block on the comment.** Tolerance, the regression you must catch, both
accepted rates and the measurement's half-width. Four lines, unchanging, copied from the spec — and they
are what let a reader argue with the gate instead of with the number.

**Don't set a ceiling with slack.** A ceiling that cannot be crossed is documentation, and the day it is
crossed nobody remembers what it was for.

**Don't let the run report a result it does not have.** A suite stopped at 40 of 282 calls has scored 14
items and has no pass rate. `"ok": false` and exit 1 is the correct output; a partial score printed as a
total is a number over a population nobody named.

**Don't post the log.** Not trimmed, not linked, not as an appendix below the comment. The comment is six
lines and the log is where you send people who have decided to look — and the whole design is that most
readers should not have to.

**Don't quote this repository's prices anywhere outside it.** They are a teaching number for a recorded
judge, chosen so the budget line is not zero. What you carry to your own repository is `items x repeats x
your price`, checked before each call.

What teams actually do: they keep the ceiling in the same file as the gate specification, they set it to the
exact size of the run, and they render a comment with the decision, the drop, the interval, the cost and
the spec, updated in place, posted before the job goes red. Everything else is a log. The three properties
that survive contact with a busy team are all about *legibility* — one comment, one order, one place where
the decision is written in words — and none of them is about the statistics, which lesson 10.3 already
settled.

## Reflect

1. `--max-calls 40` stops the run at 40 calls and `$1.5176`, and `cost.json` records that the suite scored
   14 of 94 items. Write the two lines you would add to the pull-request comment when a run stops this way,
   and say what a pass rate over 14 items would be if the suite printed one.
2. Somebody argues the budget should be `500 calls` because "we might add items later". Write the reply, in
   three sentences, that explains what a ceiling with headroom costs without appealing to anybody's
   preferences.
3. The comment above carries `9.0%`, `50.5%` and `6.4 points`, and none of the three came from this run.
   Write the sentence that makes that visible on the comment itself, and say what you would add to the
   template if the spec block were ever removed from it.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- GitHub Docs, [Dependency caching
  reference](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching) — what a
  cache key is for and what happens when it is the commit rather than the configuration: the restore looks
  like it worked, and the numbers served back come from a run nobody performed.
- Samuel Bowyer et al., [The Mythos of Model
  Evaluation](https://arxiv.org/abs/2411.19994) (2024) — the reason the comment separates what this run
  measured from what the gate has claimed about itself, which is the per-run version of putting an interval
  next to every headline.
- Douglas Dean and Daniel Voss, [The Design and Analysis of
  Experiments](https://link.springer.com/book/10.1007/978-1-4757-5482-1) (1998) — the arithmetic behind
  re-measuring a ceiling rather than adjusting it by feel, and the reason a rate quoted from 400 trials
  carries a width of about ±2 points.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the habit underneath the whole
  format: a number a reader cannot check is a claim, and a claim on a pull request is the one that decides
  whether the merge button gets pressed.
