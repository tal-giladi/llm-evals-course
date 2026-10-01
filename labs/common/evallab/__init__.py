"""evallab — the evaluation toolkit for the production path.

Modules 1-10 do this work in the browser. This package is the same work in
Python, so that a suite you can read, run and put in CI is the same suite the
course measured by hand.

The statistics here are a port of ``simulations/common/stats.js``. They are
not an independent reimplementation: lesson 11.2 makes the two agree as an
exercise, and ``tests/test_parity.py`` checks they still do. If you change a
formula here, change it there, or the lesson stops being true.
"""

from .dataset import Dataset, Item, load
from .stats import (
    Confusion,
    Interval,
    accuracy,
    cohens_kappa,
    confusion,
    corrected_pass_rate,
    judge_metrics,
    majority_vote,
    paired_comparison,
    pct,
    sample_items,
    simulate_gate,
    threshold_verdict,
    tnr,
    tpr,
    wilson,
)
from .judge import Judge, MajorityJudge, RecordedJudge, cache_key
from .suite import SuiteResult, SliceScore, compare, run_suite

__version__ = "1.0.0"

__all__ = [
    "Dataset", "Item", "load",
    "Confusion", "Interval",
    "confusion", "tpr", "tnr", "accuracy", "cohens_kappa", "wilson", "pct",
    "judge_metrics", "corrected_pass_rate", "paired_comparison", "sample_items",
    "majority_vote", "threshold_verdict", "simulate_gate",
    "Judge", "RecordedJudge", "MajorityJudge", "cache_key",
    "SuiteResult", "SliceScore", "run_suite", "compare",
]
