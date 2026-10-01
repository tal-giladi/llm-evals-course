"""Lab 1 — a report a machine can read and a person can skim.

A pass rate on its own is a number, not a result. The four questions a
release gate has to answer are in the module README; this file answers three
of them and flags the fourth.

Fill in the TODOs. ``test_report.py`` is the specification.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

from evallab import RecordedJudge, load, run_suite, pct
from evallab.stats import Interval


def build_report(dataset: str = "support", judge_id: str = "c-rubric-3b",
                 variant: str = "v1", split: str = "dev") -> dict:
    """Run a suite and return a report.

    Shape, which ``test_report.py`` checks exactly::

        {
          "judge": ..., "variant": ..., "split": ..., "n": ...,
          "pass_rate": 0.667, "pass_ci": [lo, hi],
          "agreement": {"tpr": .., "tnr": .., "kappa": .., "n": ..},
          "disagreements": [{"id": .., "human": 0, "judge": 1, "category": ..}, ...],
          "disagreements_by_category": {"no_citation": 4, ...},
          "unmeasurable_slices": ["exception", ...],
        }

    A slice goes in ``unmeasurable_slices`` when it contains no failing
    items, because a slice with no failures cannot contribute to the
    true-negative rate. Omitting those slices entirely is the bug this lab
    exists to prevent: the report looks complete and your worst population is
    unmeasured.
    """
    data = load(dataset)
    judge = RecordedJudge(data, judge_id)
    result = run_suite(data, judge, variant=variant, split=split)

    # --- TODO 1: the headline numbers ---------------------------------
    report = {
        "judge": result.judge,
        "variant": variant,
        "split": split,
        "n": result.n,
    }

    # --- TODO 2: disagreements, flat and grouped by the human's category

    # --- TODO 3: the slices whose true-negative rate cannot be measured

    return report


def summarise(report: dict) -> str:
    """Two lines, for a pull-request comment.

    TODO 4: fill in the body. It should say what passed, whether the judge
    is trustworthy, and how many disagreements are open.
    """
    return ""


def main(argv=None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    report = build_report(*argv) if argv else build_report()
    out = Path("report.json")
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(summarise(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
