"""Lab 2 — solution.

Two things to notice when you read this against your own version.

First, the LCS table is the obvious nested loop and the *normalisation* is
the part that matters. A port that compares raw tokens disagrees with the
shipped metric on every real input, and disagrees by a little, so it reads
as rounding.

Second, ``bootstrap_ci`` seeds its generator. Without that line this lab
still passes once and then fails in CI roughly a fifth of the time, which
is the exact shape of the bug in lesson 13.3.
"""

from __future__ import annotations

import random
import re
from typing import Sequence


def _tokens(text: str) -> list[str]:
    return re.sub(r"[^a-z0-9\s'-]", " ", str(text).lower()).split()


def rouge_l(candidate: str, reference: str) -> dict:
    c = _tokens(candidate)
    r = _tokens(reference)
    if not c or not r:
        return {"lcs": 0, "precision": 0.0, "recall": 0.0, "f": 0.0}

    # Longest common subsequence, one row per candidate token.
    prev = [0] * (len(r) + 1)
    for i in range(1, len(c) + 1):
        cur = [0] * (len(r) + 1)
        for j in range(1, len(r) + 1):
            if c[i - 1] == r[j - 1]:
                cur[j] = prev[j - 1] + 1
            else:
                cur[j] = max(prev[j], cur[j - 1])
        prev = cur
    lcs = prev[len(r)]

    precision = lcs / len(c)
    recall = lcs / len(r)
    f = 0.0 if precision + recall == 0 else 2 * precision * recall / (precision + recall)
    return {"lcs": lcs, "precision": precision, "recall": recall, "f": f}


def bootstrap_ci(values: Sequence[float], resamples: int = 1000,
                 seed: int = 12345) -> tuple[float, float]:
    values = list(values)
    if not values:
        raise ValueError("bootstrap_ci needs at least one value; "
                         "an empty input is not a zero-width interval")
    rng = random.Random(seed)
    n = len(values)
    means = []
    for _ in range(resamples):
        sample = [values[rng.randrange(n)] for _ in range(n)]
        means.append(sum(sample) / n)
    means.sort()
    lo = means[int(0.025 * (resamples - 1))]
    hi = means[min(resamples - 1, int(round(0.975 * (resamples - 1))))]
    return lo, hi
