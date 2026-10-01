"""Lab 2 — the specification.

A suite is a set of cases you chose. Production keeps sending you things it did
not send you when you chose it, so the suite is wrong from the day it is
written, and the only thing that fixes it is **carrying a production failure
back into the suite** and showing that the suite now catches it.

Three properties, and the third is the one this lab is really about:

* the failures in a window are found **from the span attributes**, because
  reading them anywhere else returns an empty list that looks exactly like a
  healthy week;
* a failure becomes an item the suite can load, **with a human label**, because
  a regression nobody labelled is a log line and gets argued about again next
  quarter;
* and the round trip is **proved**, by running the suite twice and putting the
  two numbers side by side, not asserted.

The sampling table underneath is the cost of getting any of this: you cannot
judge every request, so the volume goes and the failures stay, and the rate you
report over what is left is not the rate of the traffic.
"""

from __future__ import annotations

import json

import pytest

from loop_lab import (
    a_week_of_traffic, as_item, caught_by_suite, failing_traces, labellable,
    review_queue, sample_report, suite_labels, with_item,
)
from evallab import TraceStore, load, record, sample_for_review

FAIL_RATE = 0.15            # a bad week, planted


@pytest.fixture(scope="module")
def data():
    return load("support")


@pytest.fixture(scope="module")
def traces(data):
    return a_week_of_traffic(data, fail_rate=FAIL_RATE)


@pytest.fixture(scope="module")
def regs(traces):
    """Unlabelled: nothing is claimed to be covered until you look it up."""
    return failing_traces(traces)


def first_labelled(regs):
    """``regs[0]``, but with a failure message that says what to do.

    Called from inside the tests rather than from a fixture on purpose: a
    fixture raises, and an exception in a fixture is the least readable way to
    be told that your loop is returning nothing.
    """
    carried = labellable(regs)
    assert carried, (
        "no failure in this window has an answer to label, because "
        "`failing_traces` returned nothing. TODO 1 in loop_lab.py: `error.type` "
        "is an attribute of the span, not a key on it.")
    return carried[0]


# --------------------------------------------------------------------------
# 1. The failures are found, from the right place
# --------------------------------------------------------------------------


def test_the_window_is_not_silently_empty(traces, regs):
    """A planted 15% bad week has to come back as failures, not as `[]`.

    This is the whole bug and it is worth reading twice: `error.type` is an
    **attribute of the span**, not a key on the span. `span.get("error")`
    returns nothing for every span in the window, so the list comprehension
    finds nothing, so the function returns an empty list — and an empty list is
    the exact shape of a healthy week on every dashboard anybody has built.

    A monitor that reports zero failures by reading the wrong key is worse than
    no monitor, because it is believed.
    """
    assert traces, "the fixture must have traces"
    assert regs, "planted failures were not found; the loop is silently empty"
    assert len(regs) < len(traces), "and it is not the case that nothing failed"
    assert all(r.category for r in regs)


def test_error_type_lives_in_the_span_attributes(traces, regs):
    """The two lines, side by side. Read them once and the bug never ships.

    `regressions_from` reads `s.get("attributes", {}).get("error.type")`.
    The version everybody writes reads `s.get("error")` — which is `None` on
    every span in this dataset, because no span carries that key.
    """
    from evallab import regressions_from

    assert [r.item_id for r in regs] == [r.item_id for r in regressions_from(traces)]

    spans = [s for t in traces for s in t["spans"]]
    assert any("error.type" in s.get("attributes", {}) for s in spans), \
        "the fixture must contain a span with error.type"
    assert not any(s.get("error") for s in spans), \
        "and must contain no span with a bare `error` key - that is the trap"


def test_every_category_in_the_window_is_carried_back(traces, regs):
    """Counting the failures is not the job; naming them is.

    A window with three kinds of failure and a report with one number on it has
    told you that something is wrong and nothing about what. The taxonomy comes
    off `error.type`, and it is the thing the human reads before deciding what
    the new test case is for.
    """
    kinds = sorted({r.category for r in regs})
    assert len(kinds) >= 3, f"a window this broken has more than one kind in it: {kinds}"
    assert "no_handbook_citation" in kinds
    assert "RuntimeError" in kinds, "a raised call is a failure too"


def test_a_failure_already_in_the_suite_is_reported_as_covered(data, traces):
    """Re-filing a known failure every week is not a closing of the loop.

    `in_suite` is the field that stops it. Note what it costs to get right:
    the tracer mints `tr_s01` from the item id `s01`, so a match on one id
    namespace alone reads `False` for every failure on this repository — and
    this repository answers its "production" traffic from the eval set, so
    every failure here really is an item you already have.
    """
    labels = suite_labels(data)
    assert "s01" in labels and "tr_s01" in labels, \
        "both namespaces have to be in the key or this is a lie in one direction"

    covered = failing_traces(traces, labels)
    assert covered and all(r.in_suite for r in covered), \
        "every trace here is a replay of an item in the suite, and it must say so"
    assert not any(r.in_suite for r in failing_traces(traces)), \
        "and with no labels it knows nothing - which is the correct behaviour"


# --------------------------------------------------------------------------
# 2. The round trip
# --------------------------------------------------------------------------


def test_a_regression_becomes_an_item_the_suite_can_load(regs):
    """The shape `evallab.dataset.load` expects, with the field everybody
    forgets.

    A production failure with no human label is a trace, not a test. It will be
    looked at once, argued about next quarter, and fixed a second time.
    """
    reg = first_labelled(regs)
    item = as_item(reg, human_label=0, judge_verdict=1)

    assert item["id"] == reg.item_id
    assert item["question"] == reg.question
    assert item["outputs"]["v1"] == reg.output
    assert item["human"]["v1"]["label"] == 0, "the human label is the point"
    assert item["human"]["v1"]["category"] == reg.category
    assert item["human"]["v1"]["critique"], "a test case with no explanation gets re-argued"
    assert item["slice"]["intent"] == "production"


def test_a_call_that_raised_is_a_trace_and_not_a_test_case(regs):
    """The failures you cannot carry, and why.

    A model call that raised closes its span with `error.type` and never
    records an answer — there is no output on it to agree or disagree with, and
    an item with an empty output and a human label on it teaches the judge
    nothing at all.

    They are still failures. They count in the rate, they belong in the review
    queue, and what they are is an **availability** signal, not a quality one.
    """
    carried, raised = labellable(regs), [r for r in regs if not r.output]

    assert raised, "this window planted raised calls; they must still be visible"
    assert all(r.category == "RuntimeError" for r in raised)
    assert not (set(id(r) for r in carried) & set(id(r) for r in raised)), \
        "a failure with no answer must not be quietly carried into the suite"
    assert len(carried) + len(raised) == len(regs)
    assert all(r.question and r.output for r in carried)


def test_the_new_item_is_named_by_a_suite_that_never_had_it(data, regs):
    """The exercise, and the only part of it that is not bookkeeping.

    Run the suite with the failure in and with it out, on the same recorded
    judge, and put the two next to each other. The property that matters is not
    that a number moved — a number moves for a hundred reasons — it is that the
    new item appears **by name** in the disagreement list and the false-positive
    count goes up by one, which is what "the suite would have caught it" means
    in a form somebody can go and check in the morning.
    """
    catch = caught_by_suite(data, first_labelled(regs),
                            human_label=0, judge_verdict=1)

    assert catch.caught, catch.report()
    assert catch.named, "the failure has to appear by name, not just as a delta"
    assert catch.after["n"] == catch.before["n"] + 1
    assert catch.after["fp"] == catch.before["fp"] + 1
    assert catch.after["tnr"] < catch.before["tnr"], \
        "a false negative the judge missed is exactly what TNR is measuring"
    assert catch.before["tnr"] is not None and catch.after["tnr"] is not None


def test_a_failure_the_judge_already_caught_is_not_the_exercise(data, regs):
    """The other half of the round trip, and the reason the human label exists.

    The same failure, labelled `1` — a human read it and said it was fine, and
    the online judge agreed. It still belongs in the suite, and it moves
    nothing: the suite already scored it correctly. Adding it teaches you that
    you were covered; it does not teach the suite anything new.

    So the disagreement count is what tells you whether the loop is closed or
    just busy.
    """
    reg = first_labelled(regs)
    caught = caught_by_suite(data, reg, human_label=0, judge_verdict=1)
    agreed = caught_by_suite(data, reg, human_label=1, judge_verdict=1)

    assert agreed.after["fp"] == agreed.before["fp"], "nothing was missed here"
    assert not agreed.caught
    assert json.loads(caught.to_json())["item_id"] == json.loads(agreed.to_json())["item_id"]


def test_the_suite_grows_by_exactly_one_item(data, regs):
    """`with_item` is the join between a trace and a loadable suite, and a join
    that quietly duplicated or dropped an item would make every number above
    meaningless."""
    item = as_item(first_labelled(regs))
    grown = with_item(data, item, judge_verdict=1)

    assert len(grown.items_for("dev")) == len(data.items_for("dev")) + 1
    assert item["id"] in grown.dev_ids
    assert grown.runs["c-rubric-3b"][f"{item['id']}|v1"], \
        "the recorded verdict travels with the item, or the judge cannot score it"
    assert grown.by_id(item["id"]).label("v1") == 0


# --------------------------------------------------------------------------
# 3. The sample: the volume goes, the failures stay
# --------------------------------------------------------------------------


@pytest.fixture(scope="module")
def sample(data):
    return sample_report(data, rates=(1.0, 0.5, 0.25, 0.05), fail_rate=0.10)


def test_sampling_keeps_every_failure_and_moves_the_rate(sample):
    """The numerator holds at five at every sample rate. The reported rate
    goes **8.8% -> 17.2% -> 31.2% -> 55.6%**, and both numbers are true.

    ``5/57`` estimates the failure rate of the traffic. ``5/9`` is a count over
    a set that was *chosen* because it contains the failures — it is not a
    smaller version of the first number and no interval closes the gap.

    If the count moves, the exporter is sampling failures and the alternative
    is a dashboard that improves because you stopped looking.
    """
    kept = [r["chat_errors"] for r in sample]
    assert kept == [5, 5, 5, 5], f"failures did not survive sampling: {kept}"

    traced = [r["traces"] for r in sample]
    assert traced == sorted(traced, reverse=True), f"sampling must drop something: {traced}"
    assert traced[0] > traced[-1]

    rates = [r["chat_rate"] for r in sample]
    assert rates == sorted(rates), f"the reported rate must climb: {rates}"
    assert rates[0] == pytest.approx(0.088, abs=0.002)
    assert rates[-1] > 0.50


def test_the_review_queue_keeps_the_failures_at_a_zero_sample_rate(data):
    """The rule, at its limit. Nothing is sampled and every failure is still
    there — which is the only reason the other rows are worth reading."""
    queue = review_queue(a_week_of_traffic(data, fail_rate=0.10))
    assert any(q["error"] for q in queue), "the queue has to know what a failure is"

    kept = sample_for_review(queue, 0.0)
    assert all(q["error"] for q in kept)
    assert len(kept) == sum(1 for q in queue if q["error"]) > 0
    assert len(kept) < len(queue), "and it is still a sample of something"


def test_the_sample_is_the_same_sample_every_time(data):
    """Deterministic on the request id, so "we sample 25%" means the same
    requests every time.

    A coin flip means the request you wanted to look at may be missing and you
    cannot tell which. With a hash, a gap in the data is a fact about the trace
    set rather than a fact about the day you happened to look at it.
    """
    traces = a_week_of_traffic(data, fail_rate=0.10)
    queue = review_queue(traces)
    a = [q["id"] for q in sample_for_review(queue, 0.25)]
    b = [q["id"] for q in sample_for_review(queue, 0.25)]
    assert a == b
    assert 0 < len(a) < len(queue)

    again = [q["id"] for q in sample_for_review(review_queue(traces), 0.25)]
    assert again == a, "and rebuilding the queue does not reshuffle it"


def test_the_error_rate_is_computed_over_spans_and_named_as_such(data):
    """Lesson 12.5's denominator, arriving in the online number.

    `error_rate()` returns `{errors, spans, rate}` per span kind rather than a
    float, because 5 chat spans out of 57 and 5 requests out of 57 are
    different claims. A rate printed without its denominator is a number
    somebody can argue with.
    """
    traces = record(data, n=57, split="dev", fail_rate=0.10, sample_rate=1.0, seed=1)
    chat = TraceStore.from_traces(traces).error_rate()["chat"]
    assert chat["spans"] == 57
    assert chat["errors"] == 5
    assert chat["rate"] == pytest.approx(5 / 57, abs=1e-9)