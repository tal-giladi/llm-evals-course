"""Suite-level behaviour, as opposed to formula-level parity.

These assert the things a learner will rely on in lessons 11.1 to 11.4: that a
suite runs with no model, that the knobs do what the labs said they do, and
that a degenerate case is reported as degenerate rather than as a confident
zero.
"""

from __future__ import annotations

import pytest

from evallab import (
    MajorityJudge, RecordedJudge, cache_key, corrected_pass_rate, load,
    majority_vote, paired_comparison, run_suite, sample_items, simulate_gate, wilson,
)


@pytest.fixture(scope="module")
def support():
    return load("support")


# --------------------------------------------------------------------------
# Lesson 11.1 — a whole suite, with no model anywhere
# --------------------------------------------------------------------------


def test_suite_runs_with_no_model(support):
    result = run_suite(support, RecordedJudge(support, "c-rubric-3b"),
                       variant="v1", split="dev")
    assert result.n == len(support.dev_ids)
    assert 0 <= result.pass_rate <= 1
    assert result.metrics.kappa is not None
    assert result.confusion.tp + result.confusion.fp + \
        result.confusion.fn + result.confusion.tn == result.n


def test_suite_is_deterministic(support):
    """Lesson 13.1. The same suite twice must give the same numbers."""
    a = run_suite(support, RecordedJudge(support, "c-rubric-3b"), seed=7)
    b = run_suite(support, RecordedJudge(support, "c-rubric-3b"), seed=7)
    assert a.pass_rate == b.pass_rate
    assert a.metrics.kappa == b.metrics.kappa
    c = run_suite(support, RecordedJudge(support, "c-rubric-3b"), seed=8)
    assert c.pass_rate == pytest.approx(a.pass_rate, abs=1e-9), \
        "only the bootstrap seed should differ, and it must not move the point estimate"


def test_slice_with_no_failures_is_flagged(support):
    """Lesson 4.3. A slice you cannot measure has to say so."""
    result = run_suite(support, RecordedJudge(support, "c-rubric-3b"), size=20, seed=3)
    assert result.slices
    for s in result.slices:
        assert s.tnr_measurable == (s.failures > 0)


# --------------------------------------------------------------------------
# Lesson 11.2 — the knobs behave the way the labs said
# --------------------------------------------------------------------------


def test_vague_judge_has_a_worse_tnr_than_the_rubric(support):
    """The lesson 6.2 headline, reproduced in Python."""
    plain = run_suite(support, RecordedJudge(support, "c-plain-3b"), size=None, split="dev")
    rubric = run_suite(support, RecordedJudge(support, "c-rubric-3b"), size=None, split="dev")
    assert plain.metrics.tnr < rubric.metrics.tnr - 0.15
    assert plain.metrics.kappa < rubric.metrics.kappa - 0.15


def test_bootstrap_intervals_are_wider_on_fewer_items(support):
    """Lesson 4.4."""
    small = run_suite(support, RecordedJudge(support, "c-rubric-3b"), size=20, seed=7)
    large = run_suite(support, RecordedJudge(support, "c-rubric-3b"), size=None, seed=7)
    width = lambda r: r.pass_ci[1] - r.pass_ci[0]  # noqa: E731
    assert width(small) > width(large)


def test_sampling_strategies_differ(support):
    """Lesson 4.3, after the grouping fix: stratified is not a random draw."""
    items = support.items_for("dev")
    a = sample_items(items, 20, "random", 11)
    b = sample_items(items, 20, "stratified", 11)
    assert sorted(a) != sorted(b), "stratified must not reproduce the random draw"
    assert len(set(a)) == len(a) == 20


# --------------------------------------------------------------------------
# Lesson 11.3 — pinning, and the knobs that change a verdict
# --------------------------------------------------------------------------


def test_cache_key_changes_when_the_prompt_changes(support):
    """Lesson 5.3, as executable code. One character is enough."""
    item = support.items_for("dev")[0]
    a = cache_key(item, "v1", "c-rubric-3b", prompt_hash="abc123")
    b = cache_key(item, "v1", "c-rubric-3b", prompt_hash="abc124")
    c = cache_key(item, "v1", "c-rubric-3b", prompt_hash="abc123")
    assert a != b
    assert a == c, "the same inputs must reuse the same key, or nothing is ever cached"


def test_cache_key_varies_by_every_component(support):
    item = support.items_for("dev")[0]
    base = dict(item=item, variant="v1", judge_id="c-rubric-3b", model_build="qwen3-1.7b",
                prompt_hash="p", decoding="greedy", fewshot="0,1", answer_order="AB",
                sample_index=0)
    first = cache_key(**base)
    for field, value in [("variant", "v2"), ("judge_id", "c-rubric-7b"),
                         ("model_build", "qwen3-1.7b-q4"),
                         ("prompt_hash", "q"), ("decoding", "temp0.7"),
                         ("fewshot", "0,1,2"), ("answer_order", "BA"), ("sample_index", 1)]:
        assert cache_key(**{**base, field: value}) != first, f"{field} must change the key"


def test_repeats_and_threshold_knobs_are_wired_through(support):
    """Lessons 6.4 and 7.5. Greedy, majority and threshold are three verdicts."""
    data = support
    base = MajorityJudge(RecordedJudge(data, "c-rubric-3b"), repeats=1)
    major = MajorityJudge(RecordedJudge(data, "c-rubric-3b"), repeats=3)
    strict = MajorityJudge(RecordedJudge(data, "c-rubric-3b"), repeats=3,
                           threshold=1.0, use_threshold=True)
    lenient = MajorityJudge(RecordedJudge(data, "c-rubric-3b"), repeats=3,
                            threshold=0.0, use_threshold=True)
    items = data.items_for("dev")
    greedy_n = sum(base.verdict(it, "v1") for it in items)
    strict_n = sum(strict.verdict(it, "v1") for it in items)
    lenient_n = sum(lenient.verdict(it, "v1") for it in items)
    assert strict_n <= greedy_n <= lenient_n, \
        "a stricter threshold cannot pass more items than a looser one"
    assert lenient_n == len(items), "a threshold of 0 passes everything"


def test_majority_vote_breaks_ties_toward_fail():
    assert majority_vote([1, 0]) == 0
    assert majority_vote([1, 1, 0]) == 1
    assert majority_vote([1, 1, 0, 0]) == 0, "4 is stricter than 3: 2 of 4 is not a majority"


# --------------------------------------------------------------------------
# Lesson 11.4 — the gate
# --------------------------------------------------------------------------


def test_gate_trades_false_alarms_against_misses(support):
    """Lesson 10.3, in Python. The tolerance is the knob that moves both."""
    ids = support.dev_ids
    runs = [[support.runs["c-rubric-3b"][f"{i}|v1"][s] for i in ids]
            for s in range(support.repeats)]
    # The planted block is a tenth of the set, so the tolerance has to bracket
    # its size for the trade to be visible at all. A tolerance above the
    # regression cannot fire, which is its own lesson but not this one.
    loose = simulate_gate(runs, tolerance=0.12, repeats=3, n=len(ids), seed=23)
    tight = simulate_gate(runs, tolerance=0.01, repeats=3, n=len(ids), seed=23)
    assert tight.missed_rate < loose.missed_rate, \
        "a tighter tolerance must miss fewer regressions"
    assert tight.false_alarm_rate > loose.false_alarm_rate, \
        "and it must pay for it in false alarms — that is the whole trade"
    assert loose.false_alarm_rate + loose.missed_rate < 1.0, \
        "the two rates are different events and must not sum to one"


# --------------------------------------------------------------------------
# Degenerate cases are reported as degenerate
# --------------------------------------------------------------------------


def test_degenerate_cases_do_not_return_confident_zeros():
    assert wilson(0, 0).n == 0
    assert corrected_pass_rate(0.5, 0.5, 0.5) is None, \
        "a coin has no correction; returning 0.5 would be a confident lie"
    assert corrected_pass_rate(0.5, 0.6, 0.4) is None, \
        "TPR + TNR == 1 means the denominator vanishes"


def test_paired_comparison_is_symmetric_in_its_counts(support):
    ids = support.dev_ids[:20]
    a = [(support.by_id(i).label("v1"), 1) for i in ids]
    b = [(support.by_id(i).label("v2"), 0) for i in ids]
    ab = paired_comparison(a, b, resamples=0)
    ba = paired_comparison(b, a, resamples=0)
    assert ab.fixed == ba.broke and ab.broke == ba.fixed
    assert ab.delta == pytest.approx(-ba.delta)
