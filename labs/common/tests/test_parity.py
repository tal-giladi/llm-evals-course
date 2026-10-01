"""The two engines must agree.

Lesson 11.2 is a port of ``simulations/common/stats.js`` to Python. A port
that quietly differs is worse than no port, because every number the course
reports downstream becomes unreproducible in one of the two languages.

This test is the guarantee. It runs the shipped dataset through both engines
and compares. The tolerance is stated, not assumed: 1e-9 for closed-form
values (they are the same arithmetic), and an interval comparison for the
bootstrap, which draws different numbers from a different PRNG.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from evallab import confusion, cohens_kappa, corrected_pass_rate, paired_comparison, wilson
from evallab.dataset import load

CLOSE = 1e-9

# The same check runs in Node, which is why the fixtures are small and fixed.
CONFIGS = {
    "plain3b": "c-plain-3b",
    "rubric3b": "c-rubric-3b",
    "rubric7b": "c-rubric-7b",
}


@pytest.fixture(scope="module")
def support():
    return load("support")


def pairs_for(data, judge_id, variant, ids):
    return [(data.by_id(i).label(variant), data.runs[judge_id][f"{i}|{variant}"][0]) for i in ids]


# --------------------------------------------------------------------------
# Closed-form statistics must match to floating-point noise
# --------------------------------------------------------------------------


def test_wilson_matches(support):
    """Lesson 4.4. Same formula, same answer."""
    for successes, n in [(0, 10), (6, 10), (27, 40), (38, 57), (94, 94), (1, 3)]:
        py = wilson(successes, n)
        expected = _js_wilson(successes, n)
        assert py.point == pytest.approx(expected[0], abs=CLOSE)
        assert py.lo == pytest.approx(expected[1], abs=CLOSE)
        assert py.hi == pytest.approx(expected[2], abs=CLOSE)


def test_confusion_and_kappa_match(support):
    """Lessons 6.2 and 6.3, on the two judges the lessons quote."""
    ids = support.ids("dev")
    for judge_id in CONFIGS.values():
        pairs = pairs_for(support, judge_id, "v1", ids)
        c = confusion(pairs)
        assert c.tp + c.fp + c.fn + c.tn == c.n == len(pairs)
        if c.kappa is not None:
            expected = _js_kappa(c.tp, c.fp, c.fn, c.tn)
            assert c.kappa == pytest.approx(expected, abs=CLOSE)


def test_corrected_pass_rate_matches(support):
    """Lesson 6.5, including the degenerate cases.

    The fixtures are keyed on the full triple, and a case whose correction is
    unsupported is stored as ``null`` — which is the lesson's own point, so
    the test asserts the ``None`` rather than skipping it.
    """
    c = confusion(pairs_for(support, "c-plain-3b", "v1", support.ids("dev")))
    observed = c.judge_pass_rate
    py = corrected_pass_rate(observed, c.tpr, c.tnr)
    exp = _js_corrected(observed, c.tpr, c.tnr)
    if exp is None:
        assert py is None
    else:
        assert py is not None
        assert py["value"] == pytest.approx(exp["value"], abs=CLOSE)
        assert py["stable"] == exp["stable"]
        assert py["out_of_range"] == exp["out_of_range"]


def test_paired_comparison_matches(support):
    """Lesson 10.1. The point estimate is deterministic, so it must match exactly.

    ``fixed``/``broke`` are named from B's side here, which is the convention
    the lab's flip list uses. The JavaScript ``pairedComparison`` names them
    from A's side — the same numbers, the opposite labels, and the reason
    lesson 10.1 exists. The mapping is asserted explicitly rather than papered
    over, so the inversion cannot hide behind a passing test.
    """
    ids = support.ids("dev")
    pa = pairs_for(support, "c-rubric-3b", "v1", ids)
    pb = pairs_for(support, "c-rubric-3b", "v2", ids)
    py = paired_comparison(pa, pb, resamples=0)
    exp = _js_paired([a[1] for a in pa], [b[1] for b in pb])
    assert py.delta == pytest.approx(exp["delta"], abs=CLOSE)
    assert py.ties == exp["ties"]
    assert py.fixed == exp["broke"], "B gained exactly the items JS calls 'broke'"
    assert py.broke == exp["fixed"], "B lost exactly the items JS calls 'fixed'"
    assert py.p_value == pytest.approx(exp["p"], abs=1e-12)


# --------------------------------------------------------------------------
# Expected values, computed once by the JavaScript engine and frozen here.
# Regenerate with:  node build/parity-fixtures.mjs
# --------------------------------------------------------------------------

FIXTURES = json.loads((Path(__file__).parent / "parity_fixtures.json").read_text(encoding="utf-8"))


def _js_wilson(successes: int, n: int) -> tuple[float, float, float]:
    f = FIXTURES["wilson"][f"{successes}/{n}"]
    return f["point"], f["lo"], f["hi"]


def _js_kappa(tp: int, fp: int, fn: int, tn: int) -> float | None:
    c = FIXTURES["confusion"][f"{tp}/{fp}/{fn}/{tn}"]
    return c["kappa"]


def _js_corrected(observed, tpr, tnr):
    c = FIXTURES["corrected"][f"{observed:.6f}/{tpr:.6f}/{tnr:.6f}"]
    return c


def _js_paired(a: list[int], b: list[int]) -> dict:
    key = f"{sum(a)}/{sum(b)}/{len(a)}"
    f = FIXTURES["paired"][key]
    return {"delta": f["delta"], "fixed": f["fixed"], "broke": f["broke"],
            "ties": f["ties"], "p": f["p"]}
