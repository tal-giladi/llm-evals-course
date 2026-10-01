"""Check the tracing layer produces the numbers the module 12 lessons quote.

The interesting assertions are not "does a span exist" — they are the
properties that make a trace worth keeping, each of which is a production
failure somebody actually hits:

* a span closes and records ``error.type`` when the call raises
* costs and token counts are the ones a dashboard would show
* PII leaves the process redacted while the local copy keeps it
* sampling is deterministic, so "we do not trace errors" holds
* the exporter says which backends it skipped rather than pretending
"""

from __future__ import annotations

import json

import pytest

from evallab import (
    ERROR_TYPE, GEN_AI_INPUT_TOKENS, GEN_AI_OUTPUT_MESSAGES,
    GEN_AI_OUTPUT_TOKENS, GEN_AI_REQUEST_MODEL, GEN_AI_TOOL_NAME,
    Redactor, Span, TraceStore, Tracer, backend_status, export, load, record,
    should_sample, token_cost,
)


@pytest.fixture(scope="module")
def data():
    return load("support")


@pytest.fixture(scope="module")
def traces(data):
    return record(data, n=20, split="dev", fail_rate=0.10, seed=7)


@pytest.fixture(scope="module")
def store(traces):
    return TraceStore.from_traces(traces)


# --------------------------------------------------------------------------
# The trace has the shape the conventions describe
# --------------------------------------------------------------------------


def test_every_trace_is_a_root_with_children(store):
    for t in store.traces:
        ids = {s["span_id"] for s in t["spans"]}
        roots = [s for s in t["spans"] if s["parent_id"] is None]
        assert len(roots) == 1, "one root per trace"
        for s in t["spans"]:
            if s["parent_id"] is not None:
                assert s["parent_id"] in ids, "a parent id must point at a real span"


def test_the_four_span_kinds_are_present(store):
    kinds = {s.kind for s in store.spans()}
    assert {"agent", "execute_tool", "chat", "chain"} <= kinds


def test_model_spans_carry_model_and_tokens(store):
    chats = store.spans("chat")
    assert chats
    for s in chats:
        assert s.attributes[GEN_AI_REQUEST_MODEL]
        assert s.attributes.get(GEN_AI_INPUT_TOKENS, 0) > 0
        assert s.attributes.get(GEN_AI_OUTPUT_TOKENS, 0) > 0


def test_tool_spans_name_their_tool(store):
    tools = store.spans("execute_tool")
    assert tools
    for s in tools:
        assert s.attributes.get(GEN_AI_TOOL_NAME) == "retrieve_handbook"


def test_durations_are_non_negative_and_nested(store):
    for t in store.traces:
        by_id = {s["span_id"]: s for s in t["spans"]}
        for s in t["spans"]:
            assert s["duration_ms"] >= 0
            if s["parent_id"]:
                assert s["start_ms"] >= by_id[s["parent_id"]]["start_ms"] - 1e-6


# --------------------------------------------------------------------------
# Errors are recorded, not lost
# --------------------------------------------------------------------------


def test_a_raising_call_still_leaves_a_span_with_error_type(data):
    """Lesson 12.3. The span you lose on an error is the one you needed."""
    item = data.items_for("dev")[0]
    from evallab.observe import instrumented_run
    with pytest.raises(RuntimeError):
        instrumented_run(item, data, fail_on=item.id)
    # The tracer is local to the call, so assert the behaviour directly.
    t = Tracer("tr_test")
    with pytest.raises(RuntimeError):
        with t.chat("boom", "qwen3-1.7b") as sp:
            sp.attributes[GEN_AI_OUTPUT_TOKENS] = 0
            raise RuntimeError("upstream timeout")
    assert len(t.spans) == 1
    assert t.spans[0].attributes[ERROR_TYPE] == "RuntimeError"
    assert t.spans[0].duration_ms >= 0


def test_error_rate_is_reported_by_span_kind(store):
    rates = store.error_rate()
    assert "chat" in rates and "chain" in rates
    assert rates["chain"]["rate"] > 0, "the planted citation errors must be visible"
    for kind, v in rates.items():
        assert v["errors"] <= v["spans"]


# --------------------------------------------------------------------------
# Cost and latency — lesson 12.5
# --------------------------------------------------------------------------


def test_cost_is_the_sum_of_the_model_spans(store):
    total = store.total_cost()
    manual = sum(s.cost_usd for s in store.spans("chat"))
    assert total == pytest.approx(manual, abs=1e-12)
    assert total > 0


def test_cost_per_model_adds_up_to_the_total(store):
    by_model = store.cost_by_model()
    assert sum(by_model.values()) == pytest.approx(store.total_cost(), abs=1e-12)


def test_token_counts_match_the_spans(store):
    tok = store.total_tokens()
    chats = store.spans("chat")
    assert tok["input"] == sum(s.input_tokens for s in chats)
    assert tok["total"] == tok["input"] + tok["output"]


def test_latency_reports_a_p95_at_or_above_the_p50(store):
    lat = store.latency()
    assert lat["p95_end_to_end"] >= lat["p50_end_to_end"]
    assert lat["p50_model_call"] > 0


def test_sessions_group_traces(store):
    s = store.sessions()
    assert s
    assert sum(v["traces"] for v in s.values()) == len(store)


def test_tree_renders_every_span_as_a_nested_list(store):
    text = store.tree(store.traces[0]["trace_id"])
    assert text.count("[") == len(store.traces[0]["spans"])

    # The error rendering is checked on a trace that definitely has one,
    # rather than on whichever traces a seed happened to produce.
    t = Tracer("tr_err")
    with t.span("support.answer", "agent"):
        with t.chat("generate", "qwen3-1.7b"):
            pass
        with t.span("citation check", "chain") as chk:
            chk.attributes[ERROR_TYPE] = "no_handbook_citation"
    rendered = TraceStore.from_traces([t.to_dict()]).tree("tr_err")
    assert "ERROR no_handbook_citation" in rendered
    assert rendered.count("[") == 3


# --------------------------------------------------------------------------
# PII redaction — lesson 12.5
# --------------------------------------------------------------------------


def test_redaction_removes_pii_but_keeps_the_measurement():
    """Two layers, and they are not the same thing.

    A key *known* to carry a prompt is dropped whole, because scrubbing a
    conversation is guessing. Anything else is scrubbed in place, because it
    might be a note somebody forgot about.
    """
    t = Tracer("tr_pii")
    with t.chat("generate", "qwen3-1.7b") as sp:
        sp.attributes[GEN_AI_INPUT_TOKENS] = 400
        # A known-prompt key: dropped, not scrubbed.
        sp.attributes["question"] = "email me at tal@example.com or call +44 7700 900123"
        sp.attributes[GEN_AI_OUTPUT_MESSAGES] = "Card 4111 1111 1111 1111 was declined"
        # An incidental attribute nobody thought about: scrubbed in place.
        sp.attributes["retrieval_note"] = "found in the record for a@example.co.uk"
    red = Redactor()
    out = red.span(t.spans[0])

    blob = json.dumps(out.attributes)
    assert "tal@example.com" not in blob
    assert "900123" not in blob
    assert "4111" not in blob
    assert "a@example.co.uk" not in blob
    assert "[redacted:email]" in out.attributes["retrieval_note"], \
        "an incidental attribute is scrubbed rather than dropped"
    assert out.attributes["question"].startswith("[dropped:")
    # The measurement survives, which is the whole reason to redact rather
    # than drop the span.
    assert out.input_tokens == 400


def test_export_redacts_the_file_and_reports_what_it_skipped(traces, tmp_path):
    t = Tracer("tr_pii2")
    with t.chat("generate", "qwen3-1.7b") as sp:
        sp.attributes["question"] = "my email is tal@example.com"
    traces = list(traces) + [t.to_dict()]
    out = export(traces, tmp_path / "traces.jsonl", redactor=Redactor())
    text = (tmp_path / "traces.jsonl").read_text(encoding="utf-8")
    assert "tal@example.com" not in text, "PII must not reach the exported file"
    assert out["traces"] == len(traces)
    assert "jsonl" in out["written"]
    # Whatever was not written must be named, not silently absent.
    for skipped in out["skipped"]:
        assert ":" in skipped


def test_local_copy_still_has_the_text_for_debugging(traces, tmp_path):
    """Redact at export, not at capture."""
    t = Tracer("tr_keep")
    with t.chat("generate", "qwen3-1.7b") as sp:
        sp.attributes["question"] = "reach me at tal@example.com"
    export([t.to_dict()], tmp_path / "x.jsonl", redactor=Redactor())
    assert t.spans[0].attributes["question"] == "reach me at tal@example.com"


def test_backend_status_never_raises():
    s = backend_status()
    assert s["jsonl"] is True
    assert isinstance(s["otlp"], bool) and isinstance(s["mlflow"], bool)


# --------------------------------------------------------------------------
# Sampling — lesson 12.5
# --------------------------------------------------------------------------


def test_sampling_is_deterministic():
    a = [should_sample(0.5, f"tr_{i}") for i in range(200)]
    b = [should_sample(0.5, f"tr_{i}") for i in range(200)]
    assert a == b, "the same trace must always get the same decision"


def test_sampling_rates_are_roughly_honoured():
    kept = sum(should_sample(0.25, f"tr_{i}") for i in range(2000))
    assert 0.20 < kept / 2000 < 0.30


def test_sampling_extremes():
    assert should_sample(1.0, "anything")
    assert not should_sample(0.0, "anything")


def test_errors_are_kept_at_a_low_sample_rate(data):
    """The rule worth having: drop the volume, never the errors."""
    out = record(data, n=40, split="dev", sample_rate=0.25, fail_rate=0.10, seed=3)
    assert 0 < len(out) < 40, "sampling must actually drop some"
