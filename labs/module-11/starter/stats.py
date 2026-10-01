"""Lab 2 — port two statistics, then prove you landed in the same place.

The bodies are removed. Write them yourself; ``test_stats.py`` checks you
against hand-computable values *and* against the fixtures generated from the
JavaScript engine, so "about right" does not pass.
"""

from __future__ import annotations

import random
from typing import Sequence


def rouge_l(candidate: str, reference: str) -> dict:
    """ROUGE-L: longest common subsequence, reported as precision/recall/F.

    Returns ``{"lcs": int, "precision": float, "recall": float, "f": float}``.

    Two traps, both of which produce a *plausible* wrong answer:

    * the comparison has to be on normalised tokens, so a case difference or
      a stray full stop does not shift the subsequence
    * a longer candidate always has room for a higher recall, which is why
      lesson 3.3 can show padding *raising* an overlap score
    """
    # TODO 1: normalise to lowercase tokens
    # TODO 2: longest common subsequence length
    # TODO 3: precision, recall, and their harmonic mean
    raise NotImplementedError


def bootstrap_ci(values: Sequence[float], resamples: int = 1000,
                 seed: int = 12345) -> tuple[float, float]:
    """A percentile bootstrap interval, as ``(lo, hi)``.

    Three things the tests check that are easy to get wrong:

    * the generator has to be **seeded**. An unseeded one gives a different
      interval every run, so a CI job built on it fails intermittently and
      gets switched off — which is how a real regression ships.
    * the interval is over the *percentiles of resamples*, not the mean plus
      or minus something
    * an empty input has to raise rather than return ``(0.0, 0.0)``, which
      would be a confident answer to a question nobody asked
    """
    # TODO 4: raise on an empty input
    # TODO 5: resample with replacement, resamples times, and take the
    #         2.5th and 97.5th percentiles of the resampled means
    raise NotImplementedError
