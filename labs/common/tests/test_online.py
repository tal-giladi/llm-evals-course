"""Online evals: drift, bands, sampling, and the loop back to the suite.

Each test here is a failure mode that has shipped somewhere. The one that
bites hardest is the last in the sampling block: a sampler that excludes the
failures returns a perfectly stable error rate of zero.
"""

from __future__ import annotations

import pytest

from evallab import (
    Band, TraceStore, load, mix, psi, record, regressions_from,
    sample_for_review, sample_queries,
)


@pytest.fixture(scope="module")
def data():
    return load("support")


# --------------------------------------------------------------------------
# Drift
# --------------------------------------------------------------------------


def test_psi_is_zero_for_the_same_mix(data):
    m = mix(data.items_for("dev"), lambda it: (it.slice or {}).get("intent", "unknown"))
    assert psi(m, dict(m)) == pytest.approx(0.0, abs=1e-9)


def test_psi_grows_with_the_size_of_the_shift(data):
    dev = data.items_for("dev")
    base = mix(dev, lambda it: (it.slice or {}).get("intent", "unknown"))
    small = {k: v * 0.95 for k, v in base.items()}
    large = {k: v * 0.5 for k, v in base.items()}
    assert psi(base, small) < psi(base, large)


def test_a_category_that_disappears_is_reported_not_swallowed(data):
    """The thing that vanished is exactly what you want to be told about."""
    dev = data.items_for("dev")
    base = mix(dev, lambda it: (it.slice or {}).get("intent", "unknown"))
    without = {k: v for k, v in base.items() if k != "exception"}
    total = sum(without.values())
    without = {k: v / total for k, v in without.items()}
    assert psi(base, without) > 0.1


def test_a_new_category_shows_up(data):
    dev = data.items_for("dev")
    base = mix(dev, lambda it: (it.slice or {}).get("intent", "unknown"))
    with_new = {k: v * 0.9 for k, v in base.items()}
    with_new["brand_new_intent"] = 0.10
    assert psi(base, with_new) > 0.25, "a tenth of traffic arriving from nowhere is not stable"


def test_psi_survives_a_missing_key_on_either_side(data):
    assert psi({"a": 1.0}, {"b": 1.0}) > 0
    assert psi({}, {"a": 1.0}) > 0


# --------------------------------------------------------------------------
# Bands come from an interval
# --------------------------------------------------------------------------


def test_the_band_narrows_with_n():
    widths = [Band("pass rate", 0.90, n).half_width for n in (20, 50, 100, 200, 500)]
    assert widths == sorted(widths, reverse=True), f"not narrowing: {widths}"


def test_a_band_narrower_than_the_measurement_fires_on_noise():
    """n=20 against a 0.90 baseline has a half-width of 0.137.

    A 5-point band is a third of that, so a monitor built on it wakes
    somebody up for a change it cannot distinguish from luck.
    """
    b = Band("pass rate", 0.90, 20, sensitivity=0.05)
    assert b.half_width > b.sensitivity
    assert "will fire on noise" in b.explain(0.87)


def test_the_same_band_at_a_reasonable_n_does_not():
    b = Band("pass rate", 0.90, 200, sensitivity=0.05)
    assert b.sensitivity > b.half_width
    assert "will fire on noise" not in b.explain(0.87)


def test_a_real_drop_does_fire_at_a_reasonable_n():
    b = Band("pass rate", 0.90, 200, sensitivity=0.05)
    assert b.fires(0.80)
    assert not b.fires(0.87)


def test_the_band_is_symmetric_about_the_baseline():
    b = Band("pass rate", 0.90, 200, sensitivity=0.05)
    assert b.lower == pytest.approx(b.baseline - b.sensitivity)
    assert b.upper == pytest.approx(b.baseline + b.sensitivity)


# --------------------------------------------------------------------------
# Sampling: the volume goes, the failures stay
# --------------------------------------------------------------------------


def test_sampling_keeps_the_failures_and_drops_the_rest(data):
    """The rule from module 12, applied to production traffic.

    5 planted errors survive at every rate while the trace count falls. The
    *reported rate* rises, because the denominator is shrinking, and that is
    honest rather than a bug: a sampled stream is not a smaller version of
    the full stream, it is a stream biased towards what went wrong.
    """
    counts = []
    for rate in (1.0, 0.25, 0.05):
        got = record(data, n=57, split="dev", fail_rate=0.10, sample_rate=rate, seed=1)
        st = TraceStore.from_traces(got)
        counts.append((len(got), st.error_rate()["chat"]["errors"]))
    assert [c for _, c in counts] == [5, 5, 5], f"errors did not survive sampling: {counts}"
    assert [n for n, _ in counts] == sorted([n for n, _ in counts], reverse=True)
    assert counts[0][0] > counts[-1][0], "sampling must actually drop something"


def test_sample_queries_is_deterministic():
    qs = [{"id": f"q{i}"} for i in range(200)]
    a = [q["id"] for q in sample_queries(qs, 0.25)]
    b = [q["id"] for q in sample_queries(qs, 0.25)]
    assert a == b, "the same requests must be sampled every time"
    assert 0.15 < len(a) / len(qs) < 0.35


def test_sample_for_review_keeps_every_failure():
    qs = [{"id": f"q{i}", "error": i % 10 == 0} for i in range(200)]
    kept = sample_for_review(qs, 0.0)
    assert all(q["error"] for q in kept), "a zero sample rate must still keep the failures"
    assert len(kept) == 20


# --------------------------------------------------------------------------
# The loop back to the suite
# --------------------------------------------------------------------------


def test_regressions_are_found_and_not_silently_empty(data):
    """`error.type` lives in the span's attributes, not on the span.

    Reading ``span["error"]`` returns nothing, and the result is an empty
    list that looks exactly like a healthy window.
    """
    traces = record(data, n=57, split="dev", fail_rate=0.15, seed=1)
    regs = regressions_from(traces)
    assert regs, "planted failures were not found; the loop is silently empty"
    assert all(r.category for r in regs)


def test_a_regression_becomes_a_test_case(data):
    traces = record(data, n=57, split="dev", fail_rate=0.15, seed=1)
    reg = regressions_from(traces)[0]
    tc = reg.as_test_case(human_label=0, judge_verdict=1)
    assert tc["id"] == reg.item_id
    assert tc["human"]["v1"]["label"] == 0, "the human label is the point of the test case"
    assert tc["human"]["v1"]["critique"], "a test case with no explanation gets re-argued"
    assert tc["outputs"]["v1"] == reg.output


def test_a_test_case_can_be_known_to_be_in_the_suite(data):
    traces = record(data, n=57, split="dev", fail_rate=0.15, seed=1)
    first = traces[0]["trace_id"]
    regs = regressions_from(traces, human_labels={first: 0})
    assert regs and regs[0].in_suite is True
    assert regressions_from(traces)[0].in_suite is False
