"""Lab 1 — the specification.

The test that matters is ``test_a_planted_failure_reaches_the_error_rate``.
A tracer that drops spans on error does not under-report errors: it reports
a rate with the failures already removed, and the removal is invisible.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from instrument import compare, fixed_trace, thin_trace
from evallab import ERROR_TYPE, load

OUT_OF_SCOPE = "out_of_scope"
NO_CITATION = "no_citation"
REFUSAL = "over_refusal"
EXTRA = "extra"


@pytest.fixture(scope="module")
def data():
    return load("support")


@pytest.fixture(scope="module")
def items(data):
    return data.items_for("dev")


def _item_with_category(items, category):
    """Find an item with this category, in any system variant.

    Not every category occurs in every variant — the tuned system never adds
    an unsupported claim, so ``extra`` only appears in B and C — and a test
    that searches one variant will fail on a dataset that is behaving exactly
    as designed.
    """
    for variant in ("v1", "v2", "v3"):
        for i in items:
            if i.human.get(variant, {}).get("category") == category:
                return i, variant
    raise AssertionError(f"no item anywhere in the dev split has category {category!r}")


# --------------------------------------------------------------------------
# 1 and 2: the spans only your app can emit
# --------------------------------------------------------------------------


def test_retrieval_span_is_emitted(items):
    t = fixed_trace(items[0], load("support"))
    kinds = {s["kind"] for s in t["spans"]}
    assert "execute_tool" in kinds, "TODO 1: the retrieval span is missing"


def test_retrieval_span_says_whether_anything_was_found(items, data):
    covered = next(i for i in items if not (i.slice or {}).get("out_of_scope"))
    uncovered = next(i for i in items if (i.slice or {}).get("out_of_scope"))
    a = fixed_trace(covered, data)
    b = fixed_trace(uncovered, data)
    a_tools = [s for s in a["spans"] if s["kind"] == "execute_tool"]
    b_tools = [s for s in b["spans"] if s["kind"] == "execute_tool"]
    assert a_tools and b_tools
    assert a_tools[0]["attributes"].get("retrieved") == 1
    assert b_tools[0]["attributes"].get("retrieved") == 0, \
        "retrieving nothing for a question the handbook does not cover is a bug " \
        "the model span can never show you"


def test_postcheck_span_is_emitted(items):
    t = fixed_trace(items[0], load("support"))
    assert "chain" in {s["kind"] for s in t["spans"]}, "TODO 2: the post-check span is missing"


def test_postcheck_names_the_rejection_reason(items, data):
    for category, expected in [
        (NO_CITATION, "no_handbook_citation"),
        (EXTRA, "unsupported_addition"),
        (REFUSAL, "refused_answerable_question"),
        (OUT_OF_SCOPE, "no_policy_for_question"),
    ]:
        item, variant = _item_with_category(items, category)
        t = fixed_trace(item, data, variant=variant)
        checks = [s for s in t["spans"] if s["kind"] == "chain"]
        assert checks, f"no post-check span for a {category} item ({variant})"
        assert checks[0]["attributes"].get(ERROR_TYPE) == expected, \
            f"a {category} item should report {expected}"


def test_a_correct_answer_carries_no_postcheck_error(items, data):
    good, variant = _item_with_category(items, "correct")
    t = fixed_trace(good, data, variant=variant)
    for s in t["spans"]:
        if s["kind"] == "chain":
            assert s["attributes"].get(ERROR_TYPE) is None, \
                "a post-check that always fires is a post-check nobody reads"


# --------------------------------------------------------------------------
# 3: the one that actually matters
# --------------------------------------------------------------------------


def test_a_planted_failure_reaches_the_error_rate():
    """TODO 3.

    10% of requests are made to fail inside the model span. If the spans are
    exported on the way out, the chat error rate is 10%. If they are not, the
    rate is 0% — not because nothing failed, but because the failures were
    never in the set the rate was computed over.
    """
    r = compare(n=20, fail_rate=0.10, seed=1)
    assert r["n_fixed"] == r["traces"], \
        f"{r['traces'] - r['n_fixed']} trace(s) lost on error; every one is a failure"
    assert not r["lost"], "a raised model call must still return its spans"
    rate = r["fixed"].get("chat", {}).get("rate", 0.0)
    assert rate > 0.05, f"chat error rate is {rate:.1%}; the failures are not being reported"


def test_the_thin_tracer_reports_no_errors_at_all():
    """The contrast. A model-only tracer cannot see a failure it never caught."""
    r = compare(n=20, fail_rate=0.10, seed=1)
    assert r["thin"].get("chat", {}).get("rate", 0.0) == 0.0, \
        "if the thin tracer also reports errors, the plant is not doing what you think"


def test_error_rate_is_reported_per_span_kind():
    r = compare(n=20, fail_rate=0.10, seed=1)
    for kind in ("chat", "chain", "execute_tool"):
        assert kind in r["fixed"], f"{kind} spans must be counted separately"
        v = r["fixed"][kind]
        assert v["errors"] <= v["spans"]


# --------------------------------------------------------------------------
# And the starter is meant to fail
# --------------------------------------------------------------------------


def test_starter_thin_tracer_has_only_a_model_span(items, data):
    t = thin_trace(items[0], data)
    assert {s["kind"] for s in t["spans"]} == {"agent", "chat"}
