"""Lab 1 — the specification.

A monitor is judged on two things at once, and the second one is the one teams
skip: it has to fire on a change that is real, **and** it has to stay quiet on a
day when nothing happened. A monitor that only does the first is a coin with a
label. A monitor that does neither is a page nobody reads — and by the end of
the month, a monitor nobody reads cannot carry a signal either.

Everything below runs against the recorded judge and recorded traffic. No
model, no network, no key.

The three properties worth taking away:

* a band narrower than the measurement's own half-width is **refused**, not
  accepted, and a refusal is not a quiet day;
* the cost of a band is a **rate at a window size**, and both halves of it move
  in the same direction as ``n`` — there is no free lunch here;
* the input mix can move without the pass rate moving at all, which is why the
  drift index is a separate measurement rather than something the band absorbs.
"""

from __future__ import annotations

import json

import pytest

from monitor_lab import (
    FIRES, QUIET, REFUSED, Monitor, baseline_pass_rate, break_window,
    dev_mix, draw_window, observe, pass_rate, price_band, psi_table, shift,
    status_for,
)
from evallab import load

SENSITIVITY = 0.05          # the five-point band everybody ships


@pytest.fixture(scope="module")
def data():
    return load("support")


@pytest.fixture(scope="module")
def baseline(data):
    return baseline_pass_rate(data)


@pytest.fixture
def small(baseline):
    """A window of twenty. The size every monitor ships at on day one."""
    return Monitor(metric="pass rate", baseline=baseline, n=20, sensitivity=SENSITIVITY)


@pytest.fixture
def big(baseline):
    """A window of four hundred. The size the same band needs to be worth having."""
    return Monitor(metric="pass rate", baseline=baseline, n=400, sensitivity=SENSITIVITY)


# --------------------------------------------------------------------------
# 1. A band narrower than the measurement is refused
# --------------------------------------------------------------------------


def test_a_band_narrower_than_the_half_width_is_refused(small):
    """The one this lab is for, and it is not a rounding argument.

    A five-point band on twenty requests is compared against a measurement whose
    own 95% interval is 40 points wide. The number on the dashboard cannot
    distinguish a healthy day from a broken one, and a band that fires anyway
    will fire on most of them — and the engineer who gets paged learns to close
    the page, which takes the real signal with it.

    Refusing is the honest answer. It says the question cannot be answered at
    this window size, which is a different claim from "nothing happened".
    """
    assert small.sensitivity < small.half_width, "the fixture must be a bad band"
    assert not small.usable

    assert status_for(small, small.baseline) == REFUSED
    assert status_for(small, small.baseline - 0.02) == REFUSED
    assert status_for(small, small.baseline - 0.30) == REFUSED, \
        "and a real collapse is refused too — that is what refusal means"


def test_the_refusal_is_not_a_quiet_day(small, big):
    """A refusal and a quiet day are different claims, and they must not share
    a status: "the number was not a measurement" and "nothing happened" are
    both things you would act on, in opposite directions.

    The exit code is 0 for both — a refusal is a **build** problem, not a page.
    Escalating it would be the same cry-wolf mistake wearing a different hat.
    """
    refused, quiet = observe(small, small.baseline), observe(big, small.baseline)

    assert refused.status == REFUSED and quiet.status == QUIET
    assert refused.status != quiet.status
    assert refused.exit_code == quiet.exit_code == 0
    assert not refused.fires and not quiet.fires


def test_the_refusal_names_both_numbers_and_a_way_out(small):
    """A refusal a reader cannot act on is just a refusal.

    It has to carry the band, the half-width it lost to, and the two things
    that would fix it — because "widen the band" and "wait for a bigger window"
    are different decisions and one of them means giving up on noticing things.
    """
    v = observe(small, small.baseline)
    assert f"{small.half_width:.3f}" in v.reason
    assert f"{SENSITIVITY:.3f}" in v.reason
    assert "fire on noise" in v.reason
    assert "widen the band" in v.reason and "more requests" in v.reason


# --------------------------------------------------------------------------
# 2. A window that can answer, answers both ways
# --------------------------------------------------------------------------


def test_a_window_that_can_answer_says_quiet_or_fires(big):
    """Four hundred requests and the same five-point band: the half-width is
    0.049, so the band is finally wider than the noise and the monitor is
    allowed to have an opinion."""
    assert big.sensitivity >= big.half_width
    assert big.usable

    assert status_for(big, big.baseline) == QUIET
    assert status_for(big, big.baseline + SENSITIVITY / 2) == QUIET
    assert status_for(big, big.baseline - 0.10) == FIRES

    fired = observe(big, big.baseline - 0.10)
    assert fired.fires and fired.exit_code == 1
    assert "outside the band" in fired.reason


def test_the_band_is_symmetric_about_the_baseline(big):
    """A band is two numbers, and they are not two decisions."""
    assert big.band.lower == pytest.approx(big.baseline - SENSITIVITY)
    assert big.band.upper == pytest.approx(big.baseline + SENSITIVITY)


def test_the_half_width_is_the_measurement_and_not_the_band(baseline):
    """The shipped arithmetic, which is the sentence ``Band.explain`` already
    knows how to print:

        "The band is narrower than the measurement's own half-width, so it will
         fire on noise."

    Twenty requests: half-width **0.200**. Four hundred: **0.049**. A single
    pair of numbers is the difference between a monitor and a noise generator.
    """
    widths = {n: Monitor(baseline=baseline, n=n).half_width for n in (20, 50, 94, 200, 400)}
    assert list(widths.values()) == sorted(widths.values(), reverse=True), \
        f"not narrowing: {widths}"
    assert widths[20] == pytest.approx(0.200, abs=0.001)
    assert widths[400] == pytest.approx(0.049, abs=0.001)
    assert widths[400] < SENSITIVITY < widths[200], \
        "the crossover sits between 200 and 400 requests, and the table below is where"


# --------------------------------------------------------------------------
# 3. The rule and the run are the same rule
# --------------------------------------------------------------------------


def test_the_monitor_the_spec_describes_is_the_monitor_that_runs(baseline):
    """``status_for`` is the rule the price list is built from; ``observe`` is
    what the on-call engineer is shown. Two copies of one rule, and two copies
    of a rule drift.

    If this fails, one of them has been edited without the other — and the band
    printed on the dashboard and the band the job acted on are now different
    numbers.
    """
    for n in (20, 50, 94, 200, 400):
        monitor = Monitor(baseline=baseline, n=n, sensitivity=SENSITIVITY)
        for offset in (-0.30, -0.10, -0.05, -0.01, 0.0, 0.01, 0.05, 0.10, 0.30):
            value = monitor.baseline + offset
            assert observe(monitor, value).status == status_for(monitor, value), \
                f"n={n} value={value:.3f}"


def test_the_verdict_is_the_json_the_job_posts(big):
    """What a monitoring job reads, and what a reviewer reads six weeks later."""
    payload = json.loads(observe(big, big.baseline - 0.10).to_json())
    assert payload["status"] == FIRES
    assert payload["fires"] is True
    assert payload["exit_code"] == 1
    assert payload["value"] == pytest.approx(round(big.baseline - 0.10, 4), abs=1e-4)
    for key in ("metric", "baseline", "n", "sensitivity", "band", "half_width", "usable"):
        assert key in payload["spec"], f"the specification travels with the verdict: {key}"
    assert payload["spec"]["usable"] is True


# --------------------------------------------------------------------------
# 4. What the band costs, at every window size
# --------------------------------------------------------------------------


@pytest.fixture(scope="module")
def price(data):
    """Both failure rates, for every window size. 400 windows a row."""
    return price_band(data, trials=400)


def row(price, n):
    return next(r for r in price if r["n"] == n)


def test_the_price_list_is_about_the_monitor_you_wrote(price):
    """``price_band`` measures the raw band, and ``status_for`` is the rule you
    ship. This is the join between them: wherever the band is unusable, the rule
    refuses every single window, and the refusal costs nothing.

    If this fails, the number in the table is a price for a rule nobody is
    running.
    """
    for r in price:
        usable = r["sensitivity"] >= r["half_width"]
        assert r["refused_rate"] == (0.0 if usable else 1.0), \
            f"n={r['n']} usable={usable} refused={r['refused_rate']}"


def test_a_monitor_that_only_shipped_at_twenty_requests_would_be_ignored(price):
    """The column that ends the project.

    Twenty requests, a five-point band: the band fires on **63.7%** of healthy
    days. Two days in three somebody is paged about a day nothing happened,
    and the pager is a noise generator by the end of the fortnight.

    Read the column and not the cells. This is the same trade module 13 priced
    for the gate and it moves the same way: more items quiet the measurement,
    and they do not make the regression more detectable.
    """
    alarms = [r["false_alarm_rate"] for r in price]
    assert alarms == sorted(alarms, reverse=True), f"not monotone in n: {alarms}"
    assert row(price, 20)["false_alarm_rate"] > 0.60
    assert row(price, 400)["false_alarm_rate"] < 0.10


def test_a_bigger_window_quietens_the_measurement_and_finds_nothing_else(price):
    """Two columns fall together and one does not move at all.

    A tenth of the window breaking is a **proportion**: it costs the same ten
    points at every window size, because the requests it broke are the same
    requests. What a bigger window buys is a quieter measurement of that drop,
    and a quieter measurement is worth exactly one thing — it stops paging
    people who do not need to be paged.
    """
    drops = [r["mean_drop_broken"] for r in price]
    assert max(drops) - min(drops) < 0.02, f"the same break should cost the same: {drops}"
    assert drops[0] == pytest.approx(0.10, abs=0.02)

    missed = [r["missed_rate"] for r in price]
    assert missed == sorted(missed, reverse=True), \
        f"a bigger window must not make the monitor worse at catching things: {missed}"
    assert missed[0] > 0.20 and missed[-1] < 0.05


def test_breaking_a_request_the_judge_had_already_failed_costs_nothing(data, big):
    """The metric counts passes, not edits.

    Break a tenth of a window that had already failed and the pass rate does
    not move. A monitor that reported a regression here would be one you would
    have to learn to ignore, and then it would be no monitor.
    """
    window = draw_window(data, big, 200, seed=4242)
    already = [(i, h, 0) if v == 0 else (i, h, v) for i, h, v in window]
    assert pass_rate(already) == pytest.approx(pass_rate(window))
    assert pass_rate(break_window(window)) < pass_rate(window)


# --------------------------------------------------------------------------
# 5. The other half of the monitor: the input mix moved
# --------------------------------------------------------------------------


@pytest.fixture(scope="module")
def psi(data):
    return {r["window"]: r for r in psi_table(data)}


def test_psi_of_a_mix_that_did_not_change_is_zero(psi):
    """The control, and the row that earns every other row.

    A window that has not changed reads **0.000**. If this is not zero, the
    index is measuring something other than drift and every number above it is
    noise.
    """
    assert psi["same"]["psi"] == pytest.approx(0.0, abs=1e-9)
    assert psi["same"]["reading"] == "stable"


def test_a_category_that_vanishes_is_reported_not_swallowed(psi):
    """The thing that disappeared is exactly what you want to be told about.

    ``psi`` floors a zero bucket rather than dividing by zero, which is not
    free: a category absent from one window and present in the other
    contributes a large finite amount, in the right direction. It reads
    **0.575** here, which is the loudest thing on the page, and the pass rate
    did not have to move for it to happen.
    """
    assert psi["vanished"]["psi"] > 0.25
    assert psi["vanished"]["reading"] == "assume something moved"
    assert psi["vanished"]["psi"] > psi["thinned"]["psi"]


def test_a_new_category_at_a_tenth_of_traffic_is_not_stable(psi):
    """Traffic arriving from nowhere is the most expensive drift there is and
    the least likely to move a pass rate you are already watching."""
    assert psi["new_intent"]["psi"] > 0.25
    assert psi["new_intent"]["psi"] > psi["collapsed"]["psi"]


def test_the_mix_is_a_distribution_and_not_a_count(data):
    """Both windows are proportions over the same keys, which is the whole
    requirement. Counting one and not the other is a number with no meaning."""
    base = dev_mix(data)
    assert pytest.approx(sum(base.values())) == 1.0
    assert shift(base, "same") == base
    with pytest.raises(ValueError):
        shift(base, "not-a-window")