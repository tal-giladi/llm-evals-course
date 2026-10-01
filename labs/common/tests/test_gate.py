"""The gate's decision logic.

``run_gate`` was shipped once with its sign inverted: it blocked when the
candidate was *better* and passed a ten-point regression, and nothing about
the output looked wrong because the reason strings used ``abs()``. The only
defence is these tests, so they check the sign and the three outcomes
separately rather than just "a GateResult came back".
"""

from __future__ import annotations

import pytest

from evallab import RecordedJudge, load
from evallab.gate import Budget, GateResult, Quarantine, run_gate


@pytest.fixture(scope="module")
def data():
    return load("support")


@pytest.fixture(scope="module")
def judge(data):
    return RecordedJudge(data, "c-rubric-3b")


def verdicts(data, judge, items, variant, window=0, broken: set | None = None):
    """(human, judge) pairs, optionally with a planted regression."""
    broken = broken or set()
    out = []
    for it in items:
        j = judge.samples(it, variant)[window]
        out.append((it.label(variant), 0 if it.id in broken else j))
    return out


@pytest.fixture(scope="module")
def items(data):
    return data.items_for("dev")


# --------------------------------------------------------------------------
# The sign. Everything else depends on this being right.
# --------------------------------------------------------------------------


def test_a_worse_candidate_gives_a_negative_delta(data, judge, items):
    """delta is candidate minus baseline, so worse is negative."""
    base = verdicts(data, judge, items, "v1")
    broken = {it.id for it in items[:12]}
    cand = verdicts(data, judge, items, "v1", broken=broken)
    g = run_gate(base, cand, tolerance=0.05)
    assert g.delta is not None and g.delta < 0, \
        "a candidate that fails twelve more items must have a negative delta"
    assert g.blocked, "a 12-item regression must block at a 5-point tolerance"


def test_a_better_candidate_gives_a_positive_delta(data, judge, items):
    base = verdicts(data, judge, items, "v2")
    cand = verdicts(data, judge, items, "v1")
    g = run_gate(base, cand, tolerance=0.05)
    assert g.delta > 0
    assert not g.blocked, "an improvement must never block"


def test_the_sign_is_not_hiding_under_abs(data, judge, items):
    """The bug that shipped: correct words, inverted decision."""
    base = verdicts(data, judge, items, "v1")
    cand = verdicts(data, judge, items, "v1", broken={it.id for it in items[:12]})
    g = run_gate(base, cand)
    assert g.blocked and "below the current build" in g.reason
    assert not run_gate(cand, base).blocked


# --------------------------------------------------------------------------
# The three outcomes lesson 10.3 argues for
# --------------------------------------------------------------------------


def test_a_planted_regression_blocks(data, judge, items):
    base = verdicts(data, judge, items, "v1")
    for k in (3, 12, 20):
        cand = verdicts(data, judge, items, "v1", broken={it.id for it in items[:k]})
        assert run_gate(base, cand, tolerance=0.05).blocked, \
            f"{k} broken items should block at a 5-point tolerance"


def test_run_to_run_noise_does_not_block(data, judge, items):
    """The same build, judged from a different repeat window."""
    base = verdicts(data, judge, items, "v1", window=0)
    for window in (1, 2, 3, 4):
        cand = verdicts(data, judge, items, "v1", window=window)
        assert not run_gate(base, cand, tolerance=0.05).blocked, \
            f"judge noise (window {window}) must not block"


def test_a_real_drop_inside_the_tolerance_passes_with_a_warning(data, judge, items):
    """The outcome that is the point of module 10.3, and the one teams skip.

    One broken item on 57 is a 1.8-point drop. The gate must not block, and
    must not call it a clean pass either — it is a real drop you have chosen
    to allow, and the report has to say so.
    """
    base = verdicts(data, judge, items, "v1")
    cand = verdicts(data, judge, items, "v1", broken={items[0].id})
    g = run_gate(base, cand, tolerance=0.05)
    assert not g.blocked
    assert "worse" in g.reason and "inside" in g.reason
    assert g.delta < 0


def test_the_tolerance_is_the_only_knob_that_trades(data, judge, items):
    """Tighten it and the gate fires more; widen it and it fires less.

    This is the test that would have caught the interval-based version, which
    blocked a ten-point regression at every tolerance from 2 to 15 points and
    so had no tolerance at all.
    """
    base = verdicts(data, judge, items, "v1")
    cand = verdicts(data, judge, items, "v1", broken={it.id for it in items[:12]})
    outcomes = [run_gate(base, cand, tolerance=t).blocked
                for t in (0.005, 0.02, 0.05, 0.10, 0.20, 0.30)]
    assert outcomes == [True, True, True, True, False, False], \
        f"the gate must stop blocking as the tolerance widens; got {outcomes}"


def test_breaking_an_item_the_judge_already_failed_costs_nothing(data, judge, items):
    """A drop is a drop in *passes*, not a count of edits.

    Flipping six items the judge has already failed changes the pass rate by
    exactly zero, so a gate that counted regressions rather than pass rates
    would report a regression where the metric did not move at all.
    """
    base = verdicts(data, judge, items, "v1")
    already_failing = [it.id for it in items
                       if judge.samples(it, "v1")[0] == 0][:6]
    if len(already_failing) < 6:
        pytest.skip("not enough already-failing judge verdicts in this split")
    cand = verdicts(data, judge, items, "v1", broken=set(already_failing))
    g = run_gate(base, cand, tolerance=0.01)
    assert abs(g.delta) < 1e-9, \
        f"the pass rate did not move, so the drop must be zero; got {g.delta}"
    assert not g.blocked


def test_tolerance_is_the_dominant_knob(data, judge, items):
    base = verdicts(data, judge, items, "v1")
    cand = verdicts(data, judge, items, "v1", broken={it.id for it in items[:12]})
    assert run_gate(base, cand, tolerance=0.02).blocked
    assert not run_gate(base, cand, tolerance=0.30).blocked, \
        "a tolerance wider than the drop must not fire"


def test_mismatched_lengths_skip_rather_than_block():
    g = run_gate([(1, 1), (0, 0)], [(1, 1)], tolerance=0.01)
    assert not g.blocked and "SKIP" in g.reason
    assert run_gate([], [], tolerance=0.01).reason.startswith("SKIP")


# --------------------------------------------------------------------------
# Cost, budget, quarantine
# --------------------------------------------------------------------------


def test_the_gate_reports_its_own_cost(data, judge, items):
    base = verdicts(data, judge, items, "v1")
    g = run_gate(base, base, repeats=3, cost_per_call=0.0004)
    assert g.calls == len(items) * 3
    assert g.usd == pytest.approx(g.calls * 0.0004)


def test_a_budget_can_refuse_a_run():
    b = Budget(max_calls=100, max_usd=1.0)
    assert b.check(50, 0.01)["ok"]
    over = b.check(500, 0.01)
    assert not over["ok"] and over["over_calls"]
    assert not b.check(10, 5.0)["ok"] and b.check(10, 5.0)["over_usd"]


def test_quarantine_requires_a_reason_an_owner_and_a_date():
    q = Quarantine()
    with pytest.raises(ValueError):
        q.add("s01", "", "me", "2027-01-01")
    with pytest.raises(ValueError):
        q.add("s01", "flaky", "", "2027-01-01")
    q.add("s01", "flaky", "me", "2027-01-01")
    assert q.is_quarantined("s01")
    assert q.overdue("2028-01-01") == ["s01"]
    assert q.overdue("2026-01-01") == []


def test_quarantine_uses_real_item_ids(data, judge, items):
    """It used to match against positional `item-0..n`, so a real quarantine
    file always reported empty."""
    q = Quarantine()
    q.add(items[0].id, "flaky", "me", "2027-01-01")
    base = verdicts(data, judge, items, "v1")
    g = run_gate(base, base, quarantine=q, quarantined_ids=[it.id for it in items[:3]])
    assert g.quarantined == [items[0].id], \
        "a quarantined test id must appear in the gate's report"
