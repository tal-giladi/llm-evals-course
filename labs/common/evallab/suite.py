"""Running a suite and reporting it in a form a human can read in ten seconds.

Lesson 13.4 is about what a CI job prints. This module is that print, so the
shape of the report is decided while the arithmetic is still fresh.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

from .dataset import Dataset, Item
from .judge import Judge
from .stats import (
    Confusion,
    hash_seed,
    judge_metrics,
    paired_comparison,
    sample_items,
    wilson,
    pct,
)


@dataclass
class SliceScore:
    name: str
    passed: int
    total: int
    caught: int
    failures: int

    @property
    def pass_rate(self) -> str:
        return pct(self.passed / self.total if self.total else None)

    @property
    def tnr_measurable(self) -> bool:
        """False when the slice contains no failing items at all.

        A slice with no failures contributes nothing to the true-negative
        rate, so the judge looks better than it is on exactly the population
        you care about. Lesson 4.3.
        """
        return self.failures > 0


@dataclass
class SuiteResult:
    suite: str
    judge: str
    variant: str
    split: str
    n: int
    pass_rate: float
    pass_ci: tuple[float, float]
    metrics: object                 # Metrics
    confusion: Confusion
    slices: list[SliceScore] = field(default_factory=list)
    disagreements: list[tuple[str, int, int, str]] = field(default_factory=list)
    cost: float = 0.0
    calls: int = 0

    def __str__(self) -> str:
        m = self.metrics
        return (
            f"{self.suite}: {pct(self.pass_rate)} pass on n={self.n} "
            f"(judge {self.judge}, split {self.split})\n"
            f"  kappa {m.kappa:.2f}  TPR {pct(m.tpr)}  TNR {pct(m.tnr)}  "
            f"accuracy {pct(m.accuracy)}"
        )


def verdict_of(judge, item, variant: str) -> int:
    """One pass/fail for one item, whichever way the judge exposes it.

    A judge may return a single verdict (``MajorityJudge``) or the recorded
    samples and let the caller decide (``RecordedJudge``). Accepting both is
    what lets a learner swap one for the other without touching the suite.
    """
    v = getattr(judge, "verdict", None)
    if callable(v):
        result = v(item, variant)
        if isinstance(result, (list, tuple)):
            from .stats import majority_vote
            return int(majority_vote(result) or 0)
        return int(result)
    samples = judge.samples(item, variant)
    return int(samples[0]) if samples else 0


def run_suite(data: Dataset, judge: Judge, variant: str = "v1",
              split: str = "dev", size: int | None = None,
              strategy: str = "random", seed: int = 7,
              suite: str = "eval", by_slice: bool = True) -> SuiteResult:
    """Score every item in a split and report agreement with the human labels.

    The order of operations matters and is the point of lesson 6.2: the judge
    verdicts come first, and the agreement with humans is computed alongside
    them, never instead of them.
    """
    items = data.items_for(split)
    idx = sample_items(items, size, strategy, seed + hash_seed(judge.id)) if size else list(range(len(items)))
    scored = [items[i] for i in idx]

    pairs = []
    disagreements = []
    for it in scored:
        v = verdict_of(judge, it, variant)
        human = it.label(variant)
        pairs.append((human, v))
        if human != v:
            disagreements.append((it.id, human, v, it.category(variant)))

    m = judge_metrics(pairs, resamples=1000, seed=seed)
    passed = sum(1 for _, j in pairs if j == 1)
    ci = wilson(passed, len(pairs))

    slices: list[SliceScore] = []
    if by_slice:
        names = sorted({(it.slice or {}).get("intent", "all") for it in scored})
        for name in names:
            group = [p for p, it in zip(pairs, scored) if (it.slice or {}).get("intent", "all") == name]
            items_g = [it for it in scored if (it.slice or {}).get("intent", "all") == name]
            slices.append(SliceScore(
                name=name,
                passed=sum(1 for _, j in group if j == 1),
                total=len(group),
                caught=m.confusion.tn,
                failures=sum(1 for h, _ in group if h == 0),
            ))

    calls = len(scored) * getattr(judge, "repeats", 1)
    cost = 0.0
    if data.cost and judge.id in data.cost:
        cost = data.cost[judge.id]["cost_usd"] * calls

    return SuiteResult(
        suite=suite, judge=getattr(judge, "label", judge.id), variant=variant,
        split=split, n=len(pairs), pass_rate=ci.point, pass_ci=(ci.lo, ci.hi),
        metrics=m, confusion=m.confusion, slices=slices,
        disagreements=disagreements, cost=cost, calls=calls,
    )


def compare(data: Dataset, judge: Judge, variant_a: str, variant_b: str,
            split: str = "dev", size: int | None = None, seed: int = 23,
            resamples: int = 1000):
    """Paired comparison of two system variants over the same items."""
    items = data.items_for(split)
    if size:
        idx = sample_items(items, size, "random", seed)
        items = [items[i] for i in idx]
    pa = [(it.label(variant_a), verdict_of(judge, it, variant_a)) for it in items]
    pb = [(it.label(variant_b), verdict_of(judge, it, variant_b)) for it in items]
    return paired_comparison(pa, pb, resamples=resamples, seed=seed), items

