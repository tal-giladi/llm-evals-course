"""Lab 1 — the specification.

A gate is judged on two things at once, and the second one is the one teams
skip: it has to block the build that is really broken, **and** it has to stay
quiet when nothing has changed. A gate that only does the first is a coin with
a label. A gate that only does the second is a gate that is not there.

Everything below runs against the recorded judge. No model, no network, no
key — the suite in `evallab` is the same one lesson 10.3 priced.
"""

from __future__ import annotations

import json

import pytest

from gate_lab import (
    BLOCKED, PASS, WARNING, Spec, decide, drop_points, frozen_items, judge_run,
    plant_block, price_gate, status_for,
)
from evallab import Quarantine, load

TOLERANCE = 0.05          # 5 points, the tolerance lesson 10.3's panel ships
REPEATS = 3
ITEMS = 94


@pytest.fixture(scope="module")
def data():
    return load("support")


@pytest.fixture
def spec():
    return Spec(tolerance=TOLERANCE, repeats=REPEATS, items=ITEMS)


@pytest.fixture
def items(data, spec):
    """The frozen set. A gate that re-picks its items is measuring a new suite."""
    return frozen_items(data, spec)


@pytest.fixture
def baseline(data, items, spec):
    """The run the cache already holds: the same numbers every time."""
    return judge_run(data, items, spec, seed=None)


def healthy_run(data, items, spec, seed):
    """The same build, scored again. A change in this verdict is noise."""
    return judge_run(data, items, spec, seed=seed)


# --------------------------------------------------------------------------
# 1. It has to catch the thing that is really broken
# --------------------------------------------------------------------------


def test_a_planted_regression_is_blocked(data, items, spec, baseline):
    """The headline. Nine of the ninety-four questions the build passes now fail.

    The block is drawn from the items the baseline *passed*, so this is a real
    regression and not a bookkeeping one — see the test two below for the
    difference.
    """
    block = plant_block(items, baseline)
    assert len(block) == 9, "a tenth of 94; lesson 10.3's planted regression"

    # On the identical recorded run, the block and nothing else is exactly a
    # tenth of the pass rate. The candidate below is a *fresh* judge run, so it
    # also picks up the noise a real run would.
    assert drop_points(baseline,
                       judge_run(data, items, spec, seed=None, broken=block)) == \
        pytest.approx(9 / 94, abs=1e-9)

    v = decide(baseline, judge_run(data, items, spec, seed=4242, broken=block), spec)

    assert v.status == BLOCKED
    assert v.blocked is True
    assert v.exit_code == 1, "CI exits on this"
    assert v.drop > spec.tolerance
    assert v.drop == pytest.approx(0.1064, abs=0.0001)


def test_the_block_decides_and_the_message_says_why(data, items, spec, baseline):
    """A block with no verdict attached cannot be reviewed in a pull request."""
    v = decide(baseline, judge_run(data, items, spec, seed=4242,
                                   broken=plant_block(items, baseline)), spec)
    assert "10.6 points" in v.reason
    assert "tolerance" in v.reason
    assert v.ci is not None and v.ci[1] < 0, \
        "the interval is reported even when it is not obeyed"


def test_breaking_an_item_the_judge_already_failed_costs_nothing(data, items, spec, baseline):
    """The metric counts passes, not edits.

    Force nine items to fail when the baseline had already failed them and the
    pass rate does not move at all. A gate that reported a regression here
    would be one you would have to learn to ignore, and then it would be no
    gate.
    """
    already_failed = tuple(it.id for it, (_, v) in zip(items, baseline) if v == 0)[:9]
    assert len(already_failed) == 9

    same_run = judge_run(data, items, spec, seed=None)
    assert drop_points(baseline, same_run) == 0.0
    assert drop_points(baseline,
                       judge_run(data, items, spec, seed=None, broken=already_failed)) == 0.0


# --------------------------------------------------------------------------
# 2. It has to stay quiet when nothing has changed
# --------------------------------------------------------------------------


def test_a_noisy_gate_does_not_block_healthy_builds(data, items, spec, baseline):
    """Forty healthy judge runs of the same code, at the shipped tolerance.

    A gate that blocks most of these does not protect the product; it makes
    every engineer re-run the suite to prove a build was fine, and a gate like
    that is switched off inside a month.
    """
    blocked = sum(decide(baseline, healthy_run(data, items, spec, 8000 + t), spec).blocked
                  for t in range(40))
    assert blocked <= 8, f"{blocked}/40 healthy builds blocked at a 5-point tolerance"


def test_tightening_the_tolerance_is_what_costs_you_the_healthy_builds(
        data, items, spec, baseline):
    """The same forty runs, at one point.

    This is the whole trade of lesson 10.3 in two columns, and it is why the
    tolerance is a decision somebody has to sign rather than a number somebody
    typed.
    """
    tight = Spec(tolerance=0.01, repeats=REPEATS, items=ITEMS)
    blocked = sum(decide(baseline, healthy_run(data, items, spec, 8000 + t), tight).blocked
                  for t in range(40))
    assert blocked >= 20, f"only {blocked}/40 blocked at a 1-point tolerance"


# --------------------------------------------------------------------------
# 3. The answer in the middle
# --------------------------------------------------------------------------


def test_a_real_drop_inside_the_tolerance_is_a_warning_not_a_silent_pass(
        data, items, spec, baseline):
    """The one this lab is for.

    The candidate is 1.1 points down. That is smaller than the tolerance, so
    the gate is right not to block. It is also *a drop*, and the two claims are
    different: the suite did not prove a regression, and it did not prove there
    was not one. A gate that only has a green light has to pick one of those
    two, and the one it picks by default is the one that is wrong.
    """
    v = decide(baseline, healthy_run(data, items, spec, 9001), spec)

    assert 0 < v.drop <= spec.tolerance, "this run must have a real drop to test anything"
    assert v.status == WARNING
    assert v.blocked is False
    assert v.exit_code == 0


def test_the_warning_names_the_drop_and_the_width_it_was_measured_against(
        data, items, spec, baseline):
    """A tolerance printed without the interval is not a decision anybody can
    review — it is a number."""
    v = decide(baseline, healthy_run(data, items, spec, 9001), spec)
    assert "1.1 points" in v.reason
    assert "interval" in v.reason.lower()
    assert "tolerance" in v.reason.lower()
    assert v.ci is not None


def test_a_quiet_run_is_not_the_same_as_no_regression(data, items, spec, baseline):
    """Over twenty healthy runs, some of them are warnings.

    That is the population a two-state gate silently swallows: 20 of 60 runs
    in the table below, every one of them a build where the suite said
    "passes" and the pull request went green.
    """
    statuses = [decide(baseline, healthy_run(data, items, spec, 8000 + t), spec).status
                for t in range(20)]
    assert WARNING in statuses, \
        "if no healthy run warns, this test data is not reproducing run-to-run noise"
    assert statuses.count(BLOCKED) <= 4


# --------------------------------------------------------------------------
# 4. The arithmetic that prices the gate
# --------------------------------------------------------------------------


@pytest.fixture(scope="module")
def grid(data):
    """Both failure rates, for every cell of the items x repeats grid.

    400 trials a cell. Four hundred trials of a 10% rate buys you about plus
    or minus two points, which is why the third significant figure on any of
    these numbers is formatting.
    """
    return price_gate(data, trials=400)


def cell(grid, items, repeats):
    return next(r for r in grid if r["items"] == items and r["repeats"] == repeats)


def test_the_tolerance_is_the_knob_that_trades_the_two_rates(data):
    """Sweep it at 94 items and 3 repeats and read the two columns separately.

    They move in opposite directions and they cross. Every tolerance that is
    not the crossing point is a decision about which mistake the team would
    rather make, and a team that has not written that sentence down has made
    it by accident.
    """
    sweep = [price_gate(data, sizes=(94,), repeats=(3,), tolerance=t, trials=400)[0]
             for t in (0.0, 0.03, 0.05, 0.10)]

    false_alarms = [r["false_alarm_rate"] for r in sweep]
    missed = [r["missed_rate"] for r in sweep]
    assert false_alarms == sorted(false_alarms, reverse=True), \
        "loosening the tolerance must not make false alarms more likely"
    assert missed == sorted(missed), \
        "loosening the tolerance must not make the gate better at catching things"

    # and the trade is not free in either direction
    assert sweep[0]["false_alarm_rate"] > 0.35
    assert sweep[-1]["missed_rate"] > 0.85
    assert sweep[2]["missed_rate"] > sweep[0]["missed_rate"]


def test_items_buy_down_the_false_alarm_rate_and_nothing_else(grid):
    """Read the two columns separately, not the cells.

    Down the item axis at three repeats the false-alarm rate goes 28.0% ->
    19.2% -> 9.0%. The missed rate goes 49.0% -> 48.8% -> 50.5%, which is
    nowhere. More items did not make the gate better at catching regressions;
    it made it better at not crying wolf.
    """
    down = [cell(grid, n, 3) for n in (20, 40, 94)]
    assert [r["false_alarm_rate"] for r in down] == \
        sorted([r["false_alarm_rate"] for r in down], reverse=True)
    assert down[-1]["false_alarm_rate"] < down[0]["false_alarm_rate"] / 2

    missed = [r["missed_rate"] for r in down]
    assert max(missed) - min(missed) < 0.10, \
        "the miss rate should not be buying anything the item count sold"


def test_repeats_buy_a_quieter_measurement_and_not_a_bigger_signal(grid):
    """The sharpest form of lesson 10.3's argument, and it is arithmetic.

    A regression is a *proportion*. It costs the same number of points at one
    repeat as at five, because the items it broke are the same items. What
    five repeats buy is a quieter measurement of the same drop — and a quieter
    measurement of the same drop is worth exactly one thing: fewer false
    alarms.
    """
    at_94 = [cell(grid, 94, r) for r in (1, 3, 5)]
    assert [r["false_alarm_rate"] for r in at_94] == \
        sorted([r["false_alarm_rate"] for r in at_94], reverse=True), \
        "more repeats must buy down false alarms"

    costs = [r["mean_drop_broken"] for r in at_94]
    assert max(costs) - min(costs) < 0.01, \
        f"the same block should cost the same at every repeat count, not {costs}"

    missed = [r["missed_rate"] for r in at_94]
    assert max(missed) - min(missed) < 0.10, \
        "and the miss rate is not what the repeat count is buying"


def test_the_block_costs_different_points_at_different_suite_sizes(grid):
    """A tenth of the list is not a tenth of the pass rate.

    The block is the same fraction of the list in every row and a different
    size every time, because the items at the front are not average items.
    This is why a miss rate is always a miss rate *for a named regression*.
    """
    costs = [r["mean_drop_broken"] * 100 for r in grid]
    assert min(costs) < 5.0 < max(costs), \
        f"the same block should not cost the same points at 20 items and at 94: {costs}"
    assert cell(grid, 94, 3)["mean_drop_broken"] == pytest.approx(0.0487, abs=0.005)


# --------------------------------------------------------------------------
# 5. The decision and the rule are the same decision
# --------------------------------------------------------------------------


def test_the_gate_the_spec_describes_is_the_gate_that_runs(data, items, spec, baseline):
    """``status_for`` prices the grid; ``decide`` runs the build.

    They are two copies of one rule, and two copies of a rule drift. If this
    fails, one of them has been edited without the other — and the number on
    the dashboard and the number CI acted on are now about different gates.
    """
    for t in range(20):
        candidate = healthy_run(data, items, spec, 8000 + t)
        drop = drop_points(baseline, candidate)
        assert decide(baseline, candidate, spec).blocked == \
            (status_for(drop, spec.tolerance) == BLOCKED), \
            f"seed {8000 + t}: drop {drop * 100:+.2f} points"


def test_status_for_is_monotone_in_the_tolerance():
    """One rule, three answers, and the ordering cannot be rearranged."""
    assert status_for(0.09, 0.05) == BLOCKED
    assert status_for(0.05, 0.05) == WARNING, "equal to the tolerance is not over it"
    assert status_for(0.01, 0.05) == WARNING
    assert status_for(0.0, 0.05) == PASS
    assert status_for(-0.2, 0.05) == PASS, "a candidate that improved is not a warning"


# --------------------------------------------------------------------------
# 6. Quarantine, and the payload CI posts
# --------------------------------------------------------------------------


def test_quarantining_something_needs_a_reason_an_owner_and_a_review_date():
    """Every entry added to the quarantine is a check that has stopped running.

    An entry with a reason and a review date is a decision. An entry without
    one is a deleted test wearing a badge, and the badge is the part that makes
    it survive.
    """
    with pytest.raises(ValueError):
        Quarantine().add("s05", reason="", owner="release-eng", review_by="2026-11-01")
    with pytest.raises(ValueError):
        Quarantine().add("s05", reason="stale", owner="", review_by="2026-11-01")
    with pytest.raises(ValueError):
        Quarantine().add("s05", reason="stale", owner="release-eng", review_by="")

    q = Quarantine()
    q.add("s05", reason="stale", owner="release-eng", review_by="2026-11-01")
    assert q.is_quarantined("s05")
    assert q.overdue("2026-12-01") == ["s05"]


def test_a_quarantined_item_is_named_in_the_verdict_a_pull_request_reads(
        data, items, spec, baseline):
    """A gate that blocks nothing is indistinguishable from a gate that is not
    there — so a check that has been switched off has to be visible in the same
    place as the ones that are still on."""
    q = Quarantine()
    q.add("s05", reason="the handbook section it grades against was rewritten",
          owner="release-eng", review_by="2026-11-01")
    q.add("s41", reason="still on", owner="release-eng", review_by="2026-11-01")
    spec.quarantine = q

    v = decide(baseline, judge_run(data, items, spec, seed=4242,
                                   broken=plant_block(items, baseline)), spec,
               quarantined_ids=[it.id for it in items])

    assert set(v.quarantined) == {"s05", "s41"}
    assert "s05" in v.to_json() and "s41" in v.to_json()
    assert v.status == BLOCKED, \
        "quarantine is reported, not obeyed: a quarantined item is not a licence to ignore a drop"


def test_the_verdict_is_the_json_the_workflow_posts(data, items, spec, baseline):
    """``evals.yml`` posts this file. Every field a reviewer needs, one call."""
    v = decide(baseline, judge_run(data, items, spec, seed=4242,
                                   broken=plant_block(items, baseline)), spec,
               quarantined_ids=[it.id for it in items],
               cost_per_call=0.03794)

    payload = json.loads(v.to_json())
    assert payload["status"] == BLOCKED and payload["blocked"] is True
    assert payload["drop_points"] == pytest.approx(10.64, abs=0.01)
    assert payload["calls"] == 94 * 3 == 282
    assert payload["interval"][1] < 0
    for key in ("measurement_half_width", "accepted_false_alarm_rate",
                "accepted_miss_rate", "must_catch"):
        assert key in payload["spec"], f"the specification travels with the verdict: {key}"
