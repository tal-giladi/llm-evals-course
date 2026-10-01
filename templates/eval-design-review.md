# Eval design review — template (capstone)

One page. Every number on it has a sample size next to it and a reason it is the number it is. If you
cannot fill in a row, that row is the weakest part of your eval and you should say so here.

---

## Feature under test

_One sentence. What it does, who uses it, what breaks if it is wrong._

## Success criterion

_One sentence, decidable by someone who did not build it._

## The eval set

| | |
|---|---|
| Items | _142_ |
| Split | _85 dev / 57 test, balanced by difficulty_ |
| Built from | _counts from the taxonomy: 10% of each top failure, plus all of the rare critical ones_ |
| Pass rate | _0.71 (Wilson 95% CI 0.63–0.78) on dev_ |

> Sample size justification: at 50 items the interval is ±12 points, which is wider than the change we
> need to detect. At 142 it is ±7. We chose the smallest size where the interval is narrower than the
> effect we care about.

## Checks, per failure category

| Failure | Check | Why this check and not another |
|---|---|---|
| Malformed JSON | Code: schema validation | Decidable, free, and the error names the field |
| Wrong oven temperature | Code: numeric equality | The right number is known |
| Answerable question refused | Code: regex for refusal phrases | No model needed to detect "I cannot help" |
| Unclear to a beginner | Judge, binary | People agree often enough to measure |
| Is this a good idea? | Human review | Targets disagree; a judge would average them into mush |

## The judges

| Judge | TPR | TNR | Kappa (95% CI) | Cost/call | Used for |
|---|---|---|---|---|---|
| v3 rubric | _0.92_ | _0.86_ | _0.78 (0.71–0.84)_ | _$0.0004_ | "unclear" category |
| v5 critique-first | _0.90_ | _0.88_ | _0.80 (0.73–0.86)_ | _$0.0009_ | held-out validation only |

- Human labels: _two annotators on 40 items, agreement 0.88 (kappa). Disagreements resolved by a third
  reviewer and kept as a test set._
- Held-out test agreement: _kappa 0.79, run once, recorded._
- Bias checks: _swap consistency 0.94; verbosity probe no movement; self-preference gap 1 point._

## Comparing systems

_Paired comparison on the same items, 142 items, bootstrap 1,000 resamples._

- A (current): _0.71_
- B (candidate): _0.79_
- Difference: _+8.1 points, 95% CI +2.3 to +13.9_
- Flip list: _31 fixed, 4 broke. All 4 breaks are in the "long answers" slice._

## The gate

| | |
|---|---|
| Blocks a pull request when | _pass rate drops more than 5 points on the dev suite_ |
| Sample size / repeats | _142 items, 3 repeats, majority vote_ |
| Estimated false alarm rate | _6% (1 run in 17 blocks a healthy build)_ |
| Estimated missed regression rate | _11% (a single-item regression usually slips through)_ |
| Judge calls cached by | _dataset id + item + model build + prompt hash + sample index_ |

> The 11% miss rate is the honest number. It is acceptable because online evals in module 14 catch most
> of what the gate lets through, within a day.

## What we are not measuring, and why

- _Latency and cost per request are instrumented but not gated, because the feature has no latency budget
  agreed with the business yet._
- _Multi-turn conversations are out of scope for this release._

## Reproduce

```
one command
```

> _Expected numbers, and the tolerance within which a different run is considered the same:
> kappa ±0.03, pass rate ±0.02, gate outcome must match exactly._