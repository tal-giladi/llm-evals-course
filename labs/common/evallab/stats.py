"""The statistics, ported from ``simulations/common/stats.js``.

Every function here has a counterpart the learner has already used in a
browser lab. The docstrings say which lesson, because the whole point of
module 11 is that these are the same numbers and not merely similar ones.

Two conventions carried over from the JavaScript, both deliberate:

* a proportion is always reported next to the sample size it came from,
* a degenerate case returns ``None`` rather than a misleading zero.
  ``kappa`` of a judge that cannot fail is ``None``, not 0.0.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Callable, Iterable, Sequence

# --------------------------------------------------------------------------
# Deterministic randomness
# --------------------------------------------------------------------------

Z95 = 1.959964


def mulberry32(seed: int) -> random.Random:
    """A seeded generator.

    The bootstrap resamples 1,000 times per recompute. Without a seed the
    same suite would report a different interval on every run, and a CI job
    that fails intermittently is a CI job people disable.
    """
    return random.Random(seed & 0xFFFFFFFF)


def hash_seed(text: str) -> int:
    """A stable 32-bit seed from a string (FNV-1a, as in the JavaScript)."""
    h = 2166136261
    for ch in text:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


# --------------------------------------------------------------------------
# Proportions — lesson 4.4
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class Interval:
    point: float
    lo: float
    hi: float
    n: int

    def __str__(self) -> str:
        if self.n == 0:
            return "—"
        return f"{pct(self.point)} ({pct(self.lo)}–{pct(self.hi)})"


def wilson(successes: int, n: int, z: float = Z95) -> Interval:
    """Wilson score interval for a binomial proportion.

    Used instead of the normal approximation because eval sets are small and
    pass rates sit near 1, where the normal interval runs past 100%.
    """
    if n == 0:
        return Interval(0.0, 0.0, 1.0, 0)
    p = successes / n
    z2 = z * z
    denom = 1 + z2 / n
    centre = p + z2 / (2 * n)
    margin = z * math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)
    return Interval(p, max(0.0, (centre - margin) / denom),
                    min(1.0, (centre + margin) / denom), n)


def pct(x: float | None, digits: int = 1) -> str:
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return "—"
    return f"{x * 100:.{digits}f}%"


# --------------------------------------------------------------------------
# Agreement — lessons 6.2 and 6.3
# --------------------------------------------------------------------------


@dataclass
class Confusion:
    tp: int = 0
    fp: int = 0
    fn: int = 0
    tn: int = 0
    n: int = 0

    @property
    def tpr(self) -> float | None:
        d = self.tp + self.fn
        return None if d == 0 else self.tp / d

    @property
    def tnr(self) -> float | None:
        d = self.tn + self.fp
        return None if d == 0 else self.tn / d

    @property
    def accuracy(self) -> float | None:
        return None if self.n == 0 else (self.tp + self.tn) / self.n

    @property
    def prevalence(self) -> float | None:
        """Share of items humans passed. Drives the "accuracy lies" lesson."""
        return None if self.n == 0 else (self.tp + self.fn) / self.n

    @property
    def judge_pass_rate(self) -> float | None:
        return None if self.n == 0 else (self.tp + self.fp) / self.n

    @property
    def kappa(self) -> float | None:
        return cohens_kappa(self)

    def __str__(self) -> str:
        return (f"tp={self.tp} fp={self.fp} fn={self.fn} tn={self.tn} "
                f"TPR={pct(self.tpr)} TNR={pct(self.tnr)} "
                f"kappa={self.kappa:.2f}" if self.kappa is not None
                else f"tp={self.tp} fp={self.fp} fn={self.fn} tn={self.tn}")


def _as_pair(p) -> tuple[int, int]:
    """Accept ``(human, judge)`` or ``{"human":…, "judge":…}``.

    The JavaScript engine takes the second shape. Being liberal here means a
    learner can paste a list straight out of the browser labs, which is half
    the point of lesson 11.2.
    """
    if isinstance(p, dict):
        return int(p["human"]), int(p["judge"])
    return int(p[0]), int(p[1])


def confusion(pairs: Iterable) -> Confusion:
    """Build the 2x2 table from ``(human, judge)`` pairs."""
    c = Confusion()
    for p in pairs:
        human, judge = _as_pair(p)
        c.n += 1
        if human == 1 and judge == 1:
            c.tp += 1
        elif human == 0 and judge == 1:
            c.fp += 1
        elif human == 1 and judge == 0:
            c.fn += 1
        else:
            c.tn += 1
    return c


def tpr(c: Confusion) -> float | None:
    return c.tpr


def tnr(c: Confusion) -> float | None:
    return c.tnr


def accuracy(c: Confusion) -> float | None:
    return c.accuracy


def cohens_kappa(c: Confusion) -> float | None:
    """Chance-corrected agreement.

    ``(observed - expected) / (1 - expected)``. High accuracy alone is
    misleading when nearly everything passes, and kappa subtracts what a
    coin copying the majority label would have scored.
    """
    if c.n == 0:
        return None
    po = c.accuracy
    human_pos = (c.tp + c.fn) / c.n
    human_neg = (c.tn + c.fp) / c.n
    judge_pos = (c.tp + c.fp) / c.n
    judge_neg = (c.tn + c.fn) / c.n
    pe = human_pos * judge_pos + human_neg * judge_neg
    if abs(1 - pe) < 1e-12:
        return None  # no variation to correct
    return (po - pe) / (1 - pe)


@dataclass
class Metrics:
    confusion: Confusion
    resamples: int
    seed: int
    ci: dict[str, Interval] = field(default_factory=dict)

    @property
    def n(self) -> int:
        return self.confusion.n

    @property
    def tpr(self) -> float | None:
        return self.confusion.tpr

    @property
    def tnr(self) -> float | None:
        return self.confusion.tnr

    @property
    def accuracy(self) -> float | None:
        return self.confusion.accuracy

    @property
    def kappa(self) -> float | None:
        return self.confusion.kappa

    @property
    def judge_pass_rate(self) -> float | None:
        return self.confusion.judge_pass_rate

    def ci_of(self, name: str) -> Interval | None:
        return self.ci.get(name)

    def __str__(self) -> str:
        return (f"n={self.n} pass={pct(self.judge_pass_rate)} "
                f"kappa={self.kappa:.2f} TPR={pct(self.tpr)} TNR={pct(self.tnr)}"
                if self.kappa is not None else
                f"n={self.n} pass={pct(self.judge_pass_rate)}")


def _percentile_ci(values: Sequence[float]) -> Interval | None:
    if not values:
        return None
    s = sorted(values)
    lo = s[int(0.025 * (len(s) - 1))]
    hi = s[math.ceil(0.975 * (len(s) - 1)) - 1] if len(s) > 1 else s[0]
    return Interval(s[len(s) // 2], lo, hi, len(s))


def judge_metrics(pairs: Sequence[tuple[int, int]], resamples: int = 1000,
                  seed: int = 12345) -> Metrics:
    """Agreement against human labels, with a bootstrap interval on each rate.

    ``resamples=0`` skips the bootstrap, which is what a CI smoke test wants:
    the point estimates still have to be right, and the interval is the slow
    part.
    """
    c = confusion(pairs)
    m = Metrics(confusion=c, resamples=resamples, seed=seed)
    if c.n == 0 or resamples <= 0:
        return m

    rng = mulberry32(seed)
    accs, tprs, tnrs, kappas, passes = [], [], [], [], []
    for _ in range(resamples):
        sample = [pairs[rng.randrange(c.n)] for _ in range(c.n)]
        cb = confusion(sample)
        accs.append(cb.accuracy)
        passes.append(cb.judge_pass_rate)
        if cb.tpr is not None:
            tprs.append(cb.tpr)
        if cb.tnr is not None:
            tnrs.append(cb.tnr)
        k = cohens_kappa(cb)
        if k is not None:
            kappas.append(k)

    m.ci = {
        "accuracy": _percentile_ci(accs),
        "judge_pass_rate": _percentile_ci(passes),
        "tpr": _percentile_ci(tprs),
        "tnr": _percentile_ci(tnrs),
        "kappa": _percentile_ci(kappas),
    }
    return m


# --------------------------------------------------------------------------
# Correcting a pass rate for judge error — lesson 6.5
# --------------------------------------------------------------------------


def corrected_pass_rate(observed: float | None, tpr_v: float | None,
                        tnr_v: float | None) -> dict | None:
    """Rogan-Gladen correction of an observed pass rate.

    The judge saw the answers, not the humans, so its pass rate is wrong in a
    way we can estimate. ``None`` when the correction is not supportable —
    which is the interesting case, and one the lab flags rather than hides.
    """
    if observed is None or tpr_v is None or tnr_v is None:
        return None
    denom = tpr_v + tnr_v - 1
    if abs(denom) < 1e-6:
        return None
    s = (observed + tnr_v - 1) / denom
    return {
        "value": s,
        "stable": abs(denom) > 0.2 and 0 <= s <= 1,
        "out_of_range": s < 0 or s > 1,
        "denom": denom,
    }


# --------------------------------------------------------------------------
# Sampling and voting — lessons 4.3 and 7.5
# --------------------------------------------------------------------------


def _slice_key(item) -> str:
    """A stable, low-cardinality grouping key for an item.

    A dataset's ``slice`` is usually a dict, and grouping on it by identity
    gives one key per item — which is how a "stratified" sampler silently
    becomes a prefix of the item list.
    """
    s = getattr(item, "slice", None)
    if s is None:
        return "all"
    if isinstance(s, dict):
        for k in ("intent", "type", "kind", "category", "difficulty"):
            if k in s:
                return str(s[k])
        return "|".join(f"{k}={s[k]}" for k in sorted(s))
    return str(s)


def sample_items(items: Sequence, size: int, strategy: str = "random",
                 seed: int = 0) -> list[int]:
    """Indices into ``items``.

    ``strategy`` is ``all`` | ``random`` | ``stratified``. Stratified keeps
    the proportion of every slice; it preserves the *mix*, and cannot
    manufacture items the population does not have.
    """
    n_items = len(items)
    if n_items == 0:
        return []
    size = max(0, min(n_items, size))
    if strategy == "all" or size == n_items:
        return list(range(n_items))

    rng = mulberry32(seed)
    if strategy == "stratified":
        buckets: dict[str, list[int]] = {}
        for i, it in enumerate(items):
            buckets.setdefault(_slice_key(it), []).append(i)
        keys = sorted(buckets)
        quotas = []
        remaining = size
        for k in keys:
            share = len(buckets[k]) / n_items * size
            take = min(len(buckets[k]), int(share))
            remaining -= take
            quotas.append({"bucket": buckets[k], "take": take, "frac": share - int(share)})
        # Largest remainder, so the total is exactly `size`.
        quotas.sort(key=lambda q: -q["frac"])
        for q in quotas:
            if remaining <= 0:
                break
            extra = min(remaining, len(q["bucket"]) - q["take"])
            q["take"] += extra
            remaining -= extra
        out: list[int] = []
        for q in quotas:
            bucket = list(q["bucket"])
            rng.shuffle(bucket)
            out.extend(bucket[:q["take"]])
        return sorted(out)

    idx = list(range(n_items))
    rng.shuffle(idx)
    return sorted(idx[:size])


def majority_vote(samples: Sequence[int]) -> int | None:
    """Majority verdict; ties resolve to 0 (fail), the safe side."""
    if not samples:
        return None
    return 1 if sum(1 for s in samples if s == 1) * 2 > len(samples) else 0


def threshold_verdict(samples: Sequence[int], threshold: float) -> int | None:
    """Pass if at least ``threshold`` of the samples said pass."""
    if not samples:
        return None
    return 1 if (sum(1 for s in samples if s == 1) / len(samples)) >= threshold else 0


# --------------------------------------------------------------------------
# Comparing two systems — lessons 10.1 and 10.2
# --------------------------------------------------------------------------


@dataclass
class Comparison:
    n: int
    delta: float
    ci: Interval | None
    fixed: int
    broke: int
    ties: int
    p_value: float


def _two_sided_binomial_p(successes: int, trials: int) -> float:
    """Exact two-sided sign test under p = 0.5."""
    if trials == 0:
        return 1.0
    k = min(successes, trials - successes)
    total = 0.0
    for i in range(k + 1):
        p = 1.0
        for j in range(i):
            p *= (trials - j) / (j + 1)
        total += p
    return min(1.0, (total * 2) / (2 ** trials))


def paired_comparison(pairs_a: Sequence[tuple[int, int]],
                      pairs_b: Sequence[tuple[int, int]],
                      resamples: int = 1000, seed: int = 4242) -> Comparison | None:
    """Paired bootstrap of A against B over the same items.

    Paired because both systems answered the *same* items: item difficulty
    cancels, and what is left is the difference. Unpaired throws that away.
    ``fixed`` counts items B passes and A does not.
    """
    n = min(len(pairs_a), len(pairs_b))
    if n == 0:
        return None
    av = [_as_pair(pairs_a[i])[1] for i in range(n)]
    bv = [_as_pair(pairs_b[i])[1] for i in range(n)]
    diffs = [av[i] - bv[i] for i in range(n)]
    mean = sum(diffs) / n
    fixed = sum(1 for d in diffs if d < 0)   # A failed, B passed
    broke = sum(1 for d in diffs if d > 0)   # A passed, B failed
    rng = mulberry32(seed)
    boot = [sum(diffs[rng.randrange(n)] for _ in range(n)) / n for _ in range(resamples)]
    positive = sum(1 for d in diffs if d < 0)
    return Comparison(
        n=n, delta=mean, ci=_percentile_ci(boot),
        fixed=fixed, broke=broke, ties=n - fixed - broke,
        p_value=_two_sided_binomial_p(positive, fixed + broke),
    )


# --------------------------------------------------------------------------
# The release gate — lesson 10.3
# --------------------------------------------------------------------------


@dataclass
class Gate:
    false_alarm_rate: float
    missed_rate: float | None
    n: int
    repeats: int
    tolerance: float
    broken_items: int


def simulate_gate(runs: Sequence[Sequence[int]], tolerance: float = 0.05,
                  repeats: int = 1, n: int | None = None, seed: int = 777,
                  regression_index: int | None = 0, regression_count: int | None = None,
                  trials: int = 400) -> Gate:
    """Price a release gate in both of its failure modes.

    ``runs[s][i]`` is repeat ``s`` of item ``i``. Each trial draws a fresh
    majority verdict per item, which is what makes ``repeats`` a real knob:
    more repeats average away judge noise, so the gate fires less spuriously
    *and* misses less.

    Regressions plant as a block of ``regression_count`` items (a tenth of the
    set by default), because that is what a real regression looks like — a
    change breaking a category of question, not one unlucky item.
    """
    num_runs = len(runs)
    items = n if n is not None else len(runs[0])
    rng = mulberry32(seed)
    broken = regression_count if regression_count is not None else max(1, round(items * 0.1))
    broken_idx = set()
    if regression_index is not None:
        for k in range(min(broken, items)):
            broken_idx.add((regression_index + k) % items)

    def draw(apply_regression: bool) -> float:
        ones = 0
        for i in range(items):
            if apply_regression and i in broken_idx:
                continue
            hits = sum(1 for _ in range(repeats) if runs[rng.randrange(num_runs)][i] == 1)
            if hits * 2 > repeats:
                ones += 1
        return ones / items

    fired_healthy = 0
    fired_broken = 0
    for _ in range(trials):
        before = draw(False)
        if before - draw(False) > tolerance:
            fired_healthy += 1
        if before - draw(True) > tolerance:
            fired_broken += 1
    return Gate(
        false_alarm_rate=fired_healthy / trials,
        missed_rate=(1 - fired_broken / trials) if broken_idx else None,
        n=items, repeats=repeats, tolerance=tolerance, broken_items=len(broken_idx),
    )
