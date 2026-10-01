---
id: "11.2"
module: 11
minutes: 22
practice_minutes: 60
prerequisites: ["11.1"]
objectives:
  - State which numbers in a ported statistics library are identities and which are procedures, and write the tolerance that belongs to each.
  - Explain why passing the wrong container shape to `confusion()` produces a plausible matrix instead of an error, and say what the resulting matrix claims.
  - Read the `fixed`/`broke` inversion between the JavaScript and Python engines and say why the parity test asserts the mapping rather than hiding it.
  - Regenerate the parity fixtures from the JavaScript engine and use a failing parity test to find which of two implementations is wrong.
volatility: implementation
sources:
  - title: "A Coefficient of Agreement for Nominal Scales (Cohen, 1960)"
    url: https://doi.org/10.1177/001316446002000104
  - title: "Interval Estimation for a Binomial Proportion (Brown, Cai & DasGupta, 2001)"
    url: https://doi.org/10.1214/ss/1009213286
  - title: "Evals FAQ (Hamel Husain)"
    url: https://hamel.dev/blog/posts/evals-faq/
last_verified: "2026-10-01"
---

# 11.2 · Porting the statistics, and proving they agree

The Python suite in lesson 11.1 printed `kappa 0.43` and the browser lab in lesson 06.2 printed `kappa 0.43`.
This lesson is about the day those two stop agreeing: how to port a statistics library without changing a
single digit, why two of the numbers in this port have the same value under opposite names, and what a
"faithful" port that silently counted every item as a true negative looks like when it runs without
complaining.

## Why it matters

You write a report in Python because the report has to run in CI. You keep the browser lab open because
the browser lab is where you learned what the numbers mean. On a Tuesday the Python says `kappa 0.42` and
the browser says `kappa 0.43`, and you have no way to tell which one is right.

That is worse than having two numbers, because **there is no procedure you can run to find out**. Kappa is
a closed-form function of four integers. There is no seed, no sample, no "approximately". Two
implementations of the same formula on the same four integers either produce the same double or they do
not, and if they do not, exactly one of them has a bug in it and no amount of staring at the report will
tell you which. The size of the disagreement is itself diagnostic: on these 57 items one misclassified
answer moves kappa by about **0.035**, so a gap of 0.01 is *smaller than any counting difference the data
could produce*. Whatever it is, it is not a miscount — it is arithmetic, and one of these two engines
is doing a slightly different sum.

The nastier version of this failure does not show up as a disagreement at all. Reimplement `confusion()`
from memory, feed it the shape the other implementation expects, and it returns a matrix. The matrix has
four plausible-looking integers in it. The statistics computed from it are percentages. Nothing raises.
Nothing prints a warning. And the numbers it produces are *better than real*: you will get a TNR of 100%
and an accuracy of 100% for a judge that is wrong on 16 of 57 items, and you will believe it, because the
only evidence you have is a report with no error in it.

So the deliverable of this lesson is not the Python file. [`evallab/stats.py`](../../labs/common/evallab/stats.py)
exists and works. The deliverable is
[`tests/test_parity.py`](../../labs/common/tests/test_parity.py), which is the thing that would have
caught the bug, and the discipline of *declaring the tolerance in advance* rather than discovering it after
the two numbers disagree.

### Why this course needs two engines at all

One engine would have been simpler. It is two engines because every number in Modules 1 to 10 was computed
by [`simulations/common/stats.js`](../../simulations/common/stats.js), in a browser tab, on data the learner
can see. If the Python silently disagreed, every lesson after this one would be quoting a number the
learner has already seen be something else, and the whole course would be unreproducible in one of its two
languages. **The port is not a convenience. It is the claim that the Python report and the browser tab are
the same measurement**, and this lesson is where that claim is made checkable instead of merely stated.

## How it works

### What was ported, and what "agree" has to mean

Six functions, each with a JavaScript original in `simulations/common/stats.js` and a Python original whose
docstring names the lesson you learned it in:

| JavaScript | Python | The lesson | Closed form? |
|---|---|---|---|
| `wilson` | `wilson` | [04.4](../module-04/lesson-04.md) | **yes** |
| `confusion`, `tpr`, `tnr`, `accuracy` | `confusion`, `tpr`, `tnr`, `accuracy` | [06.2](../module-06/lesson-02.md) | **yes** |
| `cohensKappa` | `cohens_kappa` | [06.3](../module-06/lesson-03.md) | **yes** |
| `correctedPassRate` | `corrected_pass_rate` | [06.5](../module-06/lesson-05.md) | **yes** |
| `pairedComparison` | `paired_comparison` | [10.1](../module-10/lesson-01.md) | point estimate yes, interval no |
| `simulateGate` | `simulate_gate` | [10.3](../module-10/lesson-03.md) | point estimate yes, intervals no |

The port is deliberately *not* a transliteration. Three things changed on purpose:

- `null` became `None`, and a degenerate statistic returns `None` rather than a misleading `0.0`. The
  Python carries a `pct()` that renders `None` as an em dash, so a rate that cannot be computed prints
  `—` and never `0.0%` — the difference between "nobody failed anything" and "there was nothing to
  measure".
- `confusion()` accepts **either** `{human, judge}` objects or `(human, judge)` tuples. The JavaScript takes
  only the first. This is the single most useful line in the port and it is also what makes the next
  section's bug possible.
- `hash_seed` is FNV-1a in both, but the JavaScript iterates UTF-16 code units and Python iterates code
  points. They agree on ASCII, which is every item id, variant id and judge id in the dataset. They would
  not agree on an emoji in an item id, and nothing in the course has one.

### Two kinds of number, and only one of them may be required to match exactly

This is the distinction the whole lesson turns on, and it is easy to state and easy to get wrong.

**A closed-form statistic is the same arithmetic in both languages.** `wilson(38, 57)` is four multiplies
and a square root. IEEE 754 doubles behave the same in Node and in CPython, so the two answers must be
identical to the last bit or one of them has a bug. The parity test asserts them with `abs=1e-9`, which
is a tolerance tens of millions of times smaller than the 0.035 that one misclassified answer moves kappa
by — and many orders of magnitude wider than any floating-point difference these formulas can produce.
That gap is the design: the test is loose enough to survive a compiler's rounding and tight enough that
a single cell of the confusion matrix cannot move inside it.

**A bootstrap is a procedure, not a formula.** `paired_comparison` resamples 1,000 times with a seeded
generator, and here is the thing that catches people: **the Python `mulberry32` is not the JavaScript
`mulberry32`.** The JavaScript one is a 32-bit integer PRNG written out in full. The Python one is

```python
def mulberry32(seed: int) -> random.Random:
    return random.Random(seed & 0xFFFFFFFF)
```

It is *named* after the JavaScript generator and it is a completely different one — CPython's Mersenne
Twister, with a different word size and a different seeding rule. On top of that the two ports index the
resample differently: Python calls `rng.randrange(n)`, the JavaScript computes `(rng() * n) | 0`. Ask each
engine for its first twelve resample indices with seed 4242 and not one of the twelve matches:

| | first twelve resample indices |
|---|---|
| JavaScript `mulberry32(4242)` | `31, 15, 53, 28, 38, 16, 14, 22, 19, 33, 41, 43` |
| Python `mulberry32(4242)` | `55, 26, 8, 1, 39, 24, 24, 20, 17, 11, 32, 31` |

Two engines, one seed, twelve draws, zero overlap. So the bootstrap intervals are two independent
estimates of the same quantity, and on the plain judge over 57 dev items here is what they produce:

| Statistic | JavaScript 95% interval | Python 95% interval | Gap at the low end |
|---|---|---|---|
| accuracy | 59.6% to 82.5% | 59.6% to 82.5% | identical |
| judge pass rate | 52.6% to 78.9% | 54.4% to 78.9% | 1.7 pts |
| TPR | **73.0%** to 97.1% | **75.0%** to 96.8% | **2.0 pts** |
| TNR | **35.7%** to 74.1% | **36.4%** to 75.0% | 0.7 pts |
| kappa | **18.6%** to 64.8% | **19.6%** to 64.9% | 1.0 pt |

Read the first row and then the rest. **The accuracy interval came out identical to every digit, from two
completely different sets of resamples.** That is not the engines agreeing — that is the bootstrap sum
taking only integer values on 57 items, so both engines' 25th and 975th order statistics landed on the
same integer. A coincidence of discreteness, and it is exactly the kind of coincidence that convinces
somebody a port is correct when it is only accidentally indistinguishable on one statistic.

Everywhere else the two intervals differ by one to two points, and not always in the same direction — on
TPR the JavaScript bound is the lower one at the bottom and the higher one at the top — which is what two
independent 1,000-draw bootstrap estimates of the same thing look like. **A learner who ports the
bootstrap and demands `1e-9` equality will spend a day, and the correct answer to their bug report is that
the test is wrong.** That is why `test_parity.py` compares the closed-form values exactly, passes
`resamples=0` to the paired comparison so the assertion is on the point estimate, and never compares a
bootstrap interval for equality at all.

### The bug the parity test exists to catch

Here is the JavaScript, in full:

```js
export function confusion(pairs) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const p of pairs) {
    if (p.human === 1 && p.judge === 1) tp++;
    else if (p.human === 0 && p.judge === 1) fp++;
    else if (p.human === 1 && p.judge === 0) fn++;
    else tn++;
  }
  return { tp, fp, fn, tn, n: pairs.length };
}
```

Now feed it what Python hands you — a list of `(human, judge)` tuples — and follow it. `p` is `[1, 0]`.
`p.human` is `undefined`. `undefined === 1` is `false`. `p.judge` is also `undefined`, so the second test
is `false`. Third one, `false`. Control falls to the `else`, and `tn++`.

**Every pair becomes a true negative, and no branch is ever wrong enough to throw.** Give the JavaScript
engine the 57 dev pairs as tuples and this is what it returns:

```
{ tp: 0, fp: 0, fn: 0, tn: 57, n: 57 }   tpr: null   tnr: 1   accuracy: 1   kappa: null
```

Read those four statistics as a report. **TNR 100%. Accuracy 100%. Kappa undefined.** A judge that agrees
perfectly with every human, on an item set where the plain judge actually disagrees 16 times out of 57 and
has TNR 55.6% and kappa 0.43.

Nothing about that output is malformed. The four counts sum to `n`. The rates are between 0 and 1. The
kappa is honestly reported as undefined, because with every judge verdict equal to 0 there is no variation
to correct against. And a dashboard would render it as the best judge in the module.

The only reason anyone finds out is the parity test, which computes both sides from the *same* pairs and
cannot produce `tn 57` on one side and `tn 15` on the other. The Python does not have this bug because
`_as_pair` accepts both shapes:

```python
def _as_pair(p) -> tuple[int, int]:
    if isinstance(p, dict):
        return int(p["human"]), int(p["judge"])
    return int(p[0]), int(p[1])
```

Which is the same fix seen from the other side: **the Python is more permissive than the reference, and the
permissiveness is a hazard as much as a convenience.** A port that has been made *more* forgiving than its
original can silently accept calls the original would have rejected — and the original here rejects nothing.
`pairedComparison` does not throw either; it reads `pairsA[i].judge`, gets `undefined`, subtracts
`undefined`, and returns `delta: NaN`, `ties: 57`, `wins: 0`, `losses: 0`, `pValue: 1`,
`flipIndices: []`. A comparison of two systems that reports **no difference at all** and no items to go and
read, because every subtraction was performed on `undefined`.

### The one where the numbers agree and the labels do not

This is the part of the port worth reading twice, because it is the part that makes the rest of the port
trustworthy.

The same comparison — `c-rubric-3b`, `v1` against `v2`, 57 dev items — run through both engines:

```
JS  paired     delta=0.2631578947368421 fixed=24 broke=9  ties=24 p=0.013530986849218607
PY  paired     delta=0.2631578947368421 fixed=9  broke=24 ties=24 p=0.013530986849218607
```

**`delta` is identical to all seventeen digits. `ties` is identical. `p` is identical. `fixed` and `broke`
are each other's values.** Both engines are right. Both are counting the same two sets of items. They are
counting them from opposite ends.

Here is the Python, verbatim:

```python
av = [_as_pair(pairs_a[i])[1] for i in range(n)]
bv = [_as_pair(pairs_b[i])[1] for i in range(n)]
diffs = [av[i] - bv[i] for i in range(n)]
fixed = sum(1 for d in diffs if d < 0)   # A failed, B passed
broke = sum(1 for d in diffs if d > 0)   # A passed, B failed
```

`d < 0` means A failed and B passed: **from B's side, those are items B fixed.** And here is the
JavaScript:

```js
if (d > 0) wins.push(i);
else if (d < 0) losses.push(i);
// ...
fixed: wins.length,     // "System B is better on these items"
broke: losses.length,
```

`d > 0` means A passed and B failed, so the JavaScript's `fixed` is the count of items **A** fixed — from
A's side, naming them as though B had got worse.

So: **the JavaScript `pairedComparison` names `fixed` and `broke` from A's side, and the Python names them
from B's.** Identical counts, identical delta, identical p, and the two labels swapped.

There is a third opinion in this project, and it is the one a learner actually sees. Read that comment
against the line under it and then against the panel that draws the flip list:
[`simulations/ab-gates/app.js`](../../simulations/ab-gates/app.js) never uses `paired.fixed` or
`paired.broke`. It throws them away and computes its own:

```js
const fixed = pairs.filter((p) => p.b > p.a);   // B passed, A did not: B fixed it
const broke = pairs.filter((p) => p.b < p.a);   // A passed, B did not: B broke it
```

**That is B's side — the same side as the Python, and the opposite of the engine field the fixture was
generated from.** Run those two filters over the same 57 pairs and you get `9 fixed, 24 broke`, which is
exactly what the Python reports and exactly what lesson [10.1](../module-10/lesson-01.md) quotes when it
reconciles its own difference against its own list. Plug the engine's fields into that same formula and
the sign flips:

```
lesson 10.1's formula, (broke - fixed) / n
  with the panel's counts   (24 - 9) / 57  =  +0.2632   matches the reported delta
  with the engine's fields  ( 9 - 24) / 57 =  -0.2632   the wrong sign
```

So the real shape of this bug is not "two languages disagree about a label". It is **a field nothing
displays, in a function whose return value is only ever read by the fixture generator.** The browser lab
recomputed the flip list from scratch, so the mislabelled field was invisible for as long as the course
existed — and the moment the port froze it into
[`parity_fixtures.json`](../../labs/common/tests/parity_fixtures.json), which stores `r.fixed` and
`r.broke` straight off the function's return value, a number nobody had ever read became a number other
code has to be wrong about. `34/19/57` in that file reads `fixed: 24, broke: 9`.

Lesson [10.1](../module-10/lesson-01.md) already taught this trap — "fixed" is a story you tell about a
comparison, and the story is only as good as the sentence that defines the subject. Here is what it looks
like when the story crosses a language boundary: a comment that names B's side over a line that computes
A's, and a parity test that has to encode the difference or it would fail for the right reason and teach
the wrong lesson.

So the parity test does not paper over it. It writes the inversion down:

```python
assert py.fixed == exp["broke"], "B gained exactly the items JS calls 'broke'"
assert py.broke == exp["fixed"], "B lost exactly the items JS calls 'fixed'"
```

Two assertions, each with the reason in the failure message, each naming the inversion rather than
asserting the numbers are equal. Anyone reading the test learns the convention; anyone who changes one side
gets told exactly which way round it went. **A test that hid this would have been greener and worth less.**

### How the fixtures work

A parity test needs something to compare against, and the obvious wrong answer is to type the expected
numbers out by hand — a table someone copied off a browser tab, once, and then maintained by memory.

Instead the expected values are *generated from the other engine*.
[`build/parity-fixtures.mjs`](../../build/parity-fixtures.mjs) imports
[`simulations/common/stats.js`](../../simulations/common/stats.js), runs the shipped dataset through it, and
writes [`labs/common/tests/parity_fixtures.json`](../../labs/common/tests/parity_fixtures.json):

```
  "26/12/4/15": { "kappa": 0.42857142857142855,
                  "tpr":   0.8666666666666667,
                  "tnr":   0.5555555555555556,
                  "accuracy": null },
```

Keys are the confusion counts, so a matrix that does not appear in the fixture cannot be looked up — which
means a port that produces a matrix nobody has ever seen fails rather than quietly skipping.

> [!NOTE]
> Two things in that fixture are worth knowing, because they are what a generated artefact looks like when
> nobody has looked at it recently. Every `accuracy` in the `confusion` block is `null` — not because
> accuracy is undefined, but because the generator writes `c.accuracy`, and the JavaScript `confusion()`
> returns `{tp, fp, fn, tn, n}` with no `accuracy` field; `accuracy` in that module is an exported *function*
> you call separately. The numbers are right and one field is empty because of how the field was named on
> the other side. Separately, the generator has to borrow a label for the `v1padded` variant, which has no
> entry of its own in the dataset, and it does so in a single named constant rather than inlining the
> trick. **A fixture file is code too, and it gets the same review as the code it replaces.** The parity
> test does not check either of these fields, and that is a real gap — worth knowing rather than
> discovering.

Regenerating is one command, and it is idempotent — running it against the shipped dataset and the shipped
engine reproduces the committed file exactly:

```
node build/parity-fixtures.mjs
```

The four tests that read it are:

| Test | What it compares | Tolerance |
|---|---|---|
| `test_wilson_matches` | six `(successes, n)` pairs including `0/10`, `94/94` and `1/3` | `1e-9` |
| `test_confusion_and_kappa_match` | three judges on 57 dev items, matrix and kappa | `1e-9` |
| `test_corrected_pass_rate_matches` | the plain judge on dev, looked up in a fixture block that holds four cases including the unstable one; asserts the `None` path rather than skipping it | `1e-9` on the value, exact on `stable` and `out_of_range` |
| `test_paired_comparison_matches` | `resamples=0`, so the assertion is on the point estimate, plus the inversion | `1e-9`, and `1e-12` on p |

Every tolerance is written in the file rather than assumed, and the p-value gets a tighter one than the
statistics because it is a sum of exact rationals and there is no reason for it to drift.

## Show me

From [`labs/common/`](../../labs/common/), with `PYTHONPATH=.`:

```
py -m pytest tests/ -q
```

```
.................                                                        [100%]
17 passed in 0.44s
```

```
py -m pytest tests/test_parity.py -v
```

```
tests/test_parity.py::test_wilson_matches PASSED                         [ 25%]
tests/test_parity.py::test_confusion_and_kappa_match PASSED              [ 50%]
tests/test_parity.py::test_corrected_pass_rate_matches PASSED            [ 75%]
tests/test_parity.py::test_paired_comparison_matches PASSED              [100%]

4 passed in 0.13s
```

Now put the two engines side by side on the same data. Python first, from `labs/common/`:

```
py -c "from evallab import load, confusion, cohens_kappa, paired_comparison; d=load('support'); P=lambda j,v:[(d.by_id(i).label(v), d.runs[j][f'{i}|{v}'][0]) for i in d.ids('dev')]; c=confusion(P('c-plain-3b','v1')); print(f'PY confusion  tp={c.tp} fp={c.fp} fn={c.fn} tn={c.tn}  kappa={c.kappa!r}'); r=paired_comparison(P('c-rubric-3b','v1'), P('c-rubric-3b','v2'), resamples=0); print(f'PY paired     delta={r.delta!r} fixed={r.fixed} broke={r.broke} ties={r.ties} p={r.p_value!r}')"
```

```
PY confusion  tp=26 fp=12 fn=4 tn=15  kappa=0.42857142857142855
PY paired     delta=0.2631578947368421 fixed=9 broke=24 ties=24 p=0.013530986849218607
```

<details>
<summary>The JavaScript half, one command, from the repository root</summary>

```
node --input-type=module -e 'import { readFileSync } from "node:fs"; import { confusion, cohensKappa, pairedComparison } from "./simulations/common/stats.js"; const D = JSON.parse(readFileSync("datasets/support.json","utf8")); const byId = new Map(D.items.map(i => [i.id, i])); const P = (j,v) => D.dev_ids.map(id => ({ human: byId.get(id).human[v].label, judge: D.runs[j][`${id}|${v}`][0] })); const c = confusion(P("c-plain-3b","v1")); console.log("JS confusion  tp=%d fp=%d fn=%d tn=%d  kappa=%s", c.tp, c.fp, c.fn, c.tn, cohensKappa(c)); const r = pairedComparison(P("c-rubric-3b","v1"), P("c-rubric-3b","v2"), { resamples: 0 }); console.log("JS paired     delta=%s fixed=%d broke=%d ties=%d p=%s", r.delta, r.fixed, r.broke, r.ties, r.pValue);'
```

```
JS confusion  tp=26 fp=12 fn=4 tn=15  kappa=0.42857142857142855
JS paired     delta=0.2631578947368421 fixed=24 broke=9 ties=24 p=0.013530986849218607
```

</details>

Put those four lines next to each other and the whole lesson is in them. The confusion matrix is
character-identical and kappa is `0.42857142857142855` in both. The paired delta, ties and p are
character-identical. `fixed` and `broke` are `9, 24` in Python and `24, 9` in JavaScript, and both are
right.

Now break it, on purpose, and watch the parity test earn its keep. Pass the same 57 pairs to the
JavaScript engine as tuples:

```
node --input-type=module -e 'import { readFileSync } from "node:fs"; import { confusion, cohensKappa, tnr, accuracy, pairedComparison } from "./simulations/common/stats.js"; const D = JSON.parse(readFileSync("datasets/support.json","utf8")); const byId = new Map(D.items.map(i => [i.id, i])); const T = D.dev_ids.map(id => [byId.get(id).human.v1.label, D.runs["c-plain-3b"][`${id}|v1`][0]]); const c = confusion(T); console.log(c, "tnr", tnr(c), "accuracy", accuracy(c), "kappa", cohensKappa(c)); console.log(pairedComparison(T, T, { resamples: 0 }));'
```

```
{ tp: 0, fp: 0, fn: 0, tn: 57, n: 57 } tnr 1 accuracy 1 kappa null
{
  n: 57, delta: NaN, ci: null, wins: 0, losses: 0, ties: 57,
  flipIndices: [], pValue: 1, fixed: 0, broke: 0
}
```

No exception. No warning. `tn 57`, TNR 100%, accuracy 100%, kappa undefined, and a paired comparison
reporting that the two systems are identical with `p = 1`.

> [!IMPORTANT]
> Both of these are the real shipped engines, unmodified, and neither one is broken — one was handed the
> wrong shape. That is the point of the section. A port that had been "approximately right" would have been
> caught by the parity test; a port that was *exactly* wrong in a way that threw an error would have been
> caught by the first run. The failures that reach production are the ones that produce a number.

## Try it

**Predict first**, on paper:

1. `wilson(38, 57)` is computed twice, once in each language. Should the two answers be identical to all
   seventeen digits, identical to about `1e-9`, or within a few points of each other? Say which, and why the
   other two are wrong.
2. `paired_comparison` runs a 1,000-sample bootstrap. Its Python function is called `mulberry32` and the
   JavaScript one is also called `mulberry32`. Predict whether the two bootstrap intervals come out
   identical, close-but-different, or unrelated.
3. You pass `(human, judge)` tuples instead of `{human, judge}` objects to the JavaScript `confusion()`.
   Predict the confusion matrix, and predict what TPR and TNR do.

[Lab: evallab package](../../labs/common/)

1. **Run the parity tests and then break one.** `py -m pytest tests/test_parity.py -q` first, so you know
   what green looks like. Then open [`evallab/stats.py`](../../labs/common/evallab/stats.py), change the
   kappa line from `(po - pe) / (1 - pe)` to `po - pe`, re-run the tests, and read the failure message.
   Write down: what is the first number in the assertion output, and how far is it from the fixture? Then
   put the line back and re-run to confirm 4 passed.
2. **Reproduce the inversion deliberately.** Add a `print` of `exp["fixed"]`, `exp["broke"]`, `py.fixed`
   and `py.broke` to `test_paired_comparison_matches` and run it with `-s`. Then swap the two argument
   lists in the call to `paired_comparison(pa, pb, ...)` so the Python computes from A's side, and run the
   test again. Write the sentence that tells a reviewer what changed and why the test failed.
3. **Check the tolerance is real.** Change `CLOSE = 1e-9` to `1e-3` and run the four tests — they still
   pass, because the agreement is exact. Now change it to `1e-12` and run them again — still pass. Write
   down what the tightest tolerance is that the current port satisfies, and why choosing `1e-9` instead of
   `1e-12` was a decision about what the test is *for*.
4. **Ask the bootstrap a question it cannot answer.** Run
   `py -c "from evallab import load, paired_comparison; d=load('support'); P=lambda v:[(d.by_id(i).label(v), d.runs['c-rubric-3b'][f'{i}|{v}'][0]) for i in d.ids('dev')]; c=paired_comparison(P('v1'),P('v2')); print('with bootstrap:', c.ci); c=paired_comparison(P('v1'),P('v2'),resamples=0); print('without:', c.ci, 'delta', c.delta)"`
   and explain what the first line tells you that the second does not, and what `resamples=0` is for.
5. **Find the numbers the parity test does not cover.** `wilson`, `confusion`, kappa, the correction and
   the paired point estimate are checked. Look at [`stats.py`](../../labs/common/evallab/stats.py) and
   list the exported functions with no parity test: `sample_items`, `majority_vote`,
   `threshold_verdict`, `simulate_gate`, the `Interval` formatting and the bootstrap itself. For each,
   write one sentence saying whether you could write a parity test for it at all, and why.
6. **Prove the fixtures are generated, not typed.** Run `node build/parity-fixtures.mjs` and then
   `git status`. The fixture file does not change — the numbers in it are what the JavaScript engine
   produces right now, from this dataset, not a table somebody kept in sync. Then open one entry and
   check by hand that the key really is the confusion counts.

## Break it

**Reimplement kappa "approximately".** Same four integers, same formula shape, slightly different
treatment of the degenerate case, and now the Python report reads `0.42` where the browser tab reads
`0.43`. There is no procedure that resolves this, because both numbers are confident. The lie: **"close
enough" is not a tolerance you can state afterwards — a port is either the same arithmetic or it is a
second, undocumented implementation of a statistic nobody has validated.**

**Port the bootstrap and demand `1e-9`.** The two engines draw different resamples — zero overlap in the
first twelve. The test will fail on a difference of one to two points, forever, and the bug is in the test.
The lie: **requiring an identity from a procedure converts a correct test into a permanently red one, and
the team's response to a permanently red test is to delete it.**

**Read the comment instead of the code.** `// "System B is better on these items"` sits directly above
`fixed: wins.length`, and `wins` is `d > 0`, which is A fixing things. The comment is wrong about the line
underneath it. The lie: **a docstring that explains the intent of a line is a claim about that line, not a
substitute for reading it**, and in a port it is the most trusted thing in the file because it is the only
thing in prose.

**Rename the fields to something friendlier.** Change `fixed` to `improvements` and `broke` to
`regressions` in the Python, and skip the two assertions in `test_paired_comparison_matches` that encode
the inversion. All four tests pass; the fixture matches; and every report that comes out of that package
gives the two counts the same names the engine gives them, which is the opposite of what the panel in
lesson 10.1 has always shown. The lie: **a green parity suite is a statement about the numbers you chose
to compare, and renaming is how a suite stops comparing anything.**

**Accept the permissive shape on trust.** `_as_pair` accepts dicts and tuples, so a Python caller cannot
tell you it passed the wrong thing — and the JavaScript, which is stricter and is the reference, does not
tell you either. The lie: **an API that cannot be misused is a claim, and `confusion()` is the counter
example: `tn 57`, TNR 100%, accuracy 100%, and nothing anywhere says no.**

**Leave a field unrendered.** `pairedComparison`'s `fixed` and `broke` are wrong today *because nothing
displays them* — the panel recomputes its own. The instant a generated fixture reads them they become
load-bearing, and the instant a report prints them a learner believes them. The lie: **an untested field
is not an unused field, it is a field nobody has paid for yet.**

**Trust the fixture file because it is JSON.** Every `accuracy` in its `confusion` block is `null`, and the
parity test asserts nothing about any of them, because the generator wrote `c.accuracy` against a JavaScript
object that has no such field. The lie: **generated data inherits the bugs of the generator and skips the
review a hand-written table would have got** — and a `null` in a fixture is indistinguishable from a `null`
that means something.

## Fix it

1. **Declare the tolerance in the test, per statistic, in writing.** `CLOSE = 1e-9` for closed form,
   `resamples=0` for anything with a bootstrap in it, and no equality assertion on an interval. A tolerance
   you had to discover after the two numbers disagreed is a tolerance somebody chose to make the red go away.
2. **Generate the expected values from the reference, never by hand.**
   [`build/parity-fixtures.mjs`](../../build/parity-fixtures.mjs) runs the JavaScript engine on the shipped
   dataset and writes the fixture; the test then has one source of truth. Regenerating is one command and
   it is idempotent, so "did the fixture change?" is answerable in a diff.
3. **Key the fixture on the inputs, not the outputs.** `"26/12/4/15"` means a matrix the port has never
   produced cannot be looked up, and the test fails instead of quietly skipping. `test_corrected_pass_rate_matches`
   does the same thing with the degenerate case: it asserts the `None`.
4. **Assert the inversion instead of hiding it.** `assert py.fixed == exp["broke"], "B gained exactly the
   items JS calls 'broke'"` is two lines and a comment in a test rather than a disagreement in a code review
   six months later. Write down every place the project names the same thing differently — and include the
   places that are *only* different because one of them recomputes instead of reading the field.
5. **Make the permissive path loud.** `_as_pair` should be able to tell tuples from dicts and either reject
   an empty pair or count it. A shape that is accepted and silently misread is the one failure mode a
   parity test is the only defence against, so add the parity test *and* make the shape explicit in the type
   annotation.
6. **Put both engines on the same command.** The side-by-side in **Show me** is four lines of output and it
   is the whole diagnostic. A CI job that prints both is a CI job that can answer "which one is wrong?"
   instead of opening a code review.

## How do I know it works?

**Challenge.** On your own copy of the lab, all five of these hold before the port is trustworthy:

- **`py -m pytest tests/test_parity.py -q` passes, all four tests, and the tolerance is in the file.**
  A suite that passes without saying how close it has to be is not a parity test.
- **You can regenerate the fixture from the JavaScript engine and the file does not change.**
  `node build/parity-fixtures.mjs` followed by `git status` with a clean tree is the proof that the expected
  values are generated rather than maintained.
- **You can show, from a single run, that the two engines agree on `delta`, `ties` and `p` to every
  digit and disagree on the *names* of `fixed` and `broke`.** Not "they agree" — the specific claim, with
  the specific inversion, which you can point at in two lines of each source file. Then find out which one
  the panel in the browser lab shows, and say why it is not the same answer again.
- **You have produced the failure the test exists for.** Feed the JavaScript `confusion()` the tuples and
  read out `tn 57`, TNR 100%, kappa undefined. Then explain in one sentence why nothing raised. If you have
  not seen the wrong answer, you do not yet know what the right one looks like.
- **You have introduced a bug, seen the parity test fail, and reverted it.** A test you have never watched
  fail is a test whose assertions you have not read.

**Then one held-out check, on the split the fixtures were not built from.** The parity fixtures are computed
on the **57 dev items**. Run the same four comparisons on the **37 test items** — the ones no fixture
covers — and confirm the two engines still agree to `1e-9`:

- plain judge on test: both engines must produce the matrix `tp 16, fp 11, fn 1, tn 9` and the same kappa.
- rubric judge on test: both must produce `tp 14, fp 2, fn 3, tn 18`.
- `v1` against `v2` on test with `resamples=0`: the same `delta` and the same `p`, with `fixed` and `broke`
  still inverted relative to the JavaScript.

If they agree on dev and disagree on test, you do not have a floating-point problem, you have a
data-dependent one — most likely somewhere that indexed rather than compared, which is the other way a port
diverges from its original and the harder of the two to find.

## Use / don't use

**Do port statistics between languages with a generated fixture and a stated tolerance.** The tolerance is
the artefact. `1e-9` says "these are the same arithmetic"; "close enough" says "nobody checked".

**Do compare closed-form values exactly and procedures distributionally.** Identical formulas to the last
bit, and intervals that agree to within a point or two on 1,000 draws. Treating both as one kind of number is
the mistake that produces a permanently red test.

**Do write the inversion down at the moment you find it**, as two assertions with the reason in the message.
The cost is two lines. The cost of not doing it is a frozen fixture and a port that disagree by a swap, and
the next person to read it concluding that one of them is broken.

**Do keep the reference engine readable while the port is in use.** Every confusing thing on this page — the
`mulberry32` that is not mulberry32, the comment that contradicts the line under it, the `accuracy` field
that does not exist — is only findable because the original is four directories away in a file with no
abstraction in it.

**Don't port a statistic and then change it in the same commit.** If the Python's kappa is *better* than the
JavaScript's, that is a bug in the course, not an improvement in the port. Change the original too, or
leave both; a course whose two halves disagree is a course where nobody can check anything.

**Don't assert on a bootstrap interval.** You will lose a day, the day will end with the assertion removed,
and the removal will not be in the commit message.

**Don't assume a passing generated fixture means the generator is right.** A `null` in a fixture is a value
nobody checked. The parity test verifies the port against the fixture; the fixture is verified against the
engine; and the engine is verified against the browser tab you can open and click. That chain has to end
somewhere, and knowing where it ends is what lets you trust the links above it.

What teams actually do in production: keep the reference implementation in the repository next to the port,
generate a fixture on every change to either, run the parity test with the tolerance declared in the test
file, and — when a number is reported in a dashboard — record which engine produced it. Most teams reach
the third state by accident and never notice they have not reached the fourth.

## Reflect

1. The JavaScript says `fixed: wins.length` under a comment reading *"System B is better on these items"*,
   the Python counts `fixed` from the `d < 0` branch, and the browser panel ignores both and filters
   `p.b > p.a` itself. Three places, two answers, and the one a learner has actually read is the one no
   unit test covers. Write the one sentence you would put in a pull request that changed any of them, and
   say which of the other two has to change with it.
2. `confusion()` given tuples returns `tn 57`, TNR 100%, accuracy 100%, kappa `null` — and raises nothing.
   Write the paragraph you would send to a team that shipped that report, and say what single check would
   have caught it before the number went on a dashboard.
3. The Python function named `mulberry32` is not the JavaScript function named `mulberry32`, so the two
   bootstrap intervals differ by one to two points and no tolerance can close the gap, because the draws
   themselves are different. Write the sentence you would add to the docstring of a ported function that
   tells a reader which of the two kinds of number it returns — and say what you would name the Python one.

Finish with the knowledge check for this lesson: five questions, one correct answer each.

## Sources

- Jacob Cohen, [A Coefficient of Agreement for Nominal
  Scales](https://doi.org/10.1177/001316446002000104) (1960) — the original statement of the statistic both
  engines implement, and the reason the parity test has to compare it exactly: it is closed-form, so two
  correct implementations cannot differ.
- E. S. Brown, T. T. Cai and A. DasGupta, [Interval Estimation for a Binomial
  Proportion](https://doi.org/10.1214/ss/1009213286) (2001) — why `wilson` is in the parity fixture six
  times over a spread of sizes including `0/10`, `1/3` and `94/94`, and what happens to the normal
  approximation at the ends where eval pass rates live.
- Hamel Husain, [Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) — the reason this module exists at all:
  a number that cannot be reproduced on the second machine is a claim, and a port whose two halves cannot be
  compared is how you find out which claims you were making.