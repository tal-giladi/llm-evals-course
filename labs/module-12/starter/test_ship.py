"""Lab 2 — the specification."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from ship import cost_panel, ship
from evallab import TraceStore, load, record


@pytest.fixture(scope="module")
def data():
    return load("support")


@pytest.fixture(scope="module")
def pii_traces(data):
    """Every request carries a customer address, as a real support bot would."""
    return record(data, n=20, split="dev", pii_rate=1.0, seed=1)


# --------------------------------------------------------------------------
# 1 and 2: redaction
# --------------------------------------------------------------------------


def test_no_customer_address_reaches_the_file(pii_traces, tmp_path):
    """TODO 1. The only test that matters for redaction.

    Write a file, then grep it. A unit test on the redactor passes happily
    while the attribute that leaked was one it never saw.
    """
    out = tmp_path / "traces.jsonl"
    ship(pii_traces, out)
    text = out.read_text(encoding="utf-8")
    assert "@example.com" not in text, "customer addresses are in the exported file"
    assert "customer0" not in text


def test_the_local_copy_keeps_the_addresses(pii_traces):
    """Redact at export, not at capture. Otherwise you cannot debug."""
    blob = json.dumps(pii_traces)
    assert "@example.com" in blob, \
        "the in-memory trace should still have it; redaction belongs at export"


def test_the_measurement_survives(pii_traces, tmp_path):
    """Redaction must cost you the text, not the numbers."""
    out = tmp_path / "t.jsonl"
    ship(pii_traces, out)
    spans = [json.loads(line) for line in out.read_text(encoding="utf-8").splitlines() if line]
    chats = [s for t in spans for s in t["spans"] if s["kind"] == "chat"]
    assert chats
    assert all(s["attributes"].get("gen_ai.usage.input_tokens", 0) > 0 for s in chats), \
        "token counts are the measurement; redaction must not remove them"


def test_known_prompt_keys_are_dropped_not_scrubbed(pii_traces, tmp_path):
    """TODO 2. Two different actions for two different situations."""
    out = tmp_path / "t.jsonl"
    ship(pii_traces, out)
    spans = [json.loads(line) for line in out.read_text(encoding="utf-8").splitlines() if line]
    chats = [s for t in spans for s in t["spans"] if s["kind"] == "chat"]
    for s in chats:
        q = s["attributes"].get("question")
        if q is not None:
            assert not q or q.startswith("[dropped"), \
                "a known-prompt key is dropped whole; scrubbing a conversation is guessing"


def test_an_incidental_attribute_is_scrubbed_in_place(pii_traces, tmp_path):
    """Not every attribute is a known prompt, and you cannot be sure."""
    out = tmp_path / "t.jsonl"
    ship(pii_traces, out)
    text = out.read_text(encoding="utf-8")
    for s in pii_traces[0]["spans"]:
        if s["kind"] == "chat" and "user.email" in s["attributes"]:
            assert s["attributes"]["user.email"] not in text
    assert "redacted" in text.lower() or "dropped" in text.lower(), \
        "the exported file should say what it removed, not remove it silently"


# --------------------------------------------------------------------------
# 3: say what you skipped
# --------------------------------------------------------------------------


def test_skipped_backends_are_named(pii_traces, tmp_path):
    """TODO 3. An exporter that implies a write it did not make has lied in
    the one place a reader checks."""
    result = ship(pii_traces, tmp_path / "t.jsonl")
    assert "skipped" in result
    for entry in result["skipped"]:
        assert ":" in entry, f"a skip with no reason: {entry!r}"


def test_jsonl_is_always_written(pii_traces, tmp_path):
    result = ship(pii_traces, tmp_path / "t.jsonl")
    assert Path(result["written"]["jsonl"]).exists()


# --------------------------------------------------------------------------
# 4: cost you can act on
# --------------------------------------------------------------------------


def test_cost_panel_reports_per_request_and_by_variant(data):
    """TODO 4.

    The same facts cost four times as much padded: 2147 input tokens
    against 656. A total hides that completely.
    """
    from evallab.observe import record as rec
    a = TraceStore.from_traces(rec(data, n=20, variant="v1", seed=1))
    b = TraceStore.from_traces(rec(data, n=20, variant="v1padded", seed=1))
    panel = cost_panel(a)
    assert panel["total_cost"] > 0
    assert panel["cost_per_request"] > 0
    assert panel["cost_per_request"] == pytest.approx(panel["total_cost"] / a.__len__())

    padded = cost_panel(b)
    assert padded["total_cost"] > panel["total_cost"] * 2, \
        "the padded variant should cost several times more for identical content"
    assert padded["input_tokens"] > panel["input_tokens"] * 2


def test_cost_panel_includes_the_latency_percentiles(data):
    from evallab.observe import record as rec
    panel = cost_panel(TraceStore.from_traces(rec(data, n=20, seed=1)))
    assert panel["p50_ms"] > 0
    assert panel["p95_ms"] >= panel["p50_ms"]


def test_cost_panel_does_not_add_up_padded_answers_as_good(data):
    """A padded answer is a *failure* the trace should be able to show.

    The token count is the evidence; the pass rate is somewhere else.
    """
    from evallab.observe import record as rec
    panel = cost_panel(TraceStore.from_traces(rec(data, n=20, variant="v1padded", seed=1)))
    assert panel["output_tokens"] > 0
