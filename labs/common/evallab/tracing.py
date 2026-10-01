"""Tracing an LLM app, in OpenTelemetry's GenAI shape.

The point of this module is that it has **no dependencies**. A trace is a
nested dict with timings and attributes, and you can read it, count its
tokens, price it and find its errors without installing anything. That is
deliberate: the same reasoning applies to the production path as to the
browser path in modules 1-10 — the instrumented app is the part you own,
and the backend is a place to put the result.

If ``opentelemetry`` or ``mlflow`` happen to be installed, :func:`export`
sends the same spans there. If they are not, nothing breaks and nothing is
pretended. :func:`backend_status` tells you which case you are in.

The attribute names follow the OpenTelemetry GenAI semantic conventions,
which are still marked *Development* upstream. Pin them, read the spec
before upgrading, and treat any change as a breaking change to your
traces — module 12 says the same thing and this is the code that backs it.
"""

from __future__ import annotations

import json
import os
import time
from contextlib import contextmanager
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterator

# --------------------------------------------------------------------------
# GenAI semantic convention attribute names
# --------------------------------------------------------------------------

GEN_AI_SYSTEM = "gen_ai.system"                 # "openai" | "anthropic" | ...
GEN_AI_OPERATION = "gen_ai.operation.name"      # "chat" | "embeddings" | "execute_tool"
GEN_AI_REQUEST_MODEL = "gen_ai.request.model"
GEN_AI_RESPONSE_MODEL = "gen_ai.response.model"
GEN_AI_INPUT_TOKENS = "gen_ai.usage.input_tokens"
GEN_AI_OUTPUT_TOKENS = "gen_ai.usage.output_tokens"
GEN_AI_CONVERSATION_ID = "gen_ai.conversation.id"
GEN_AI_TOOL_NAME = "gen_ai.tool.name"
GEN_AI_TOOL_CALL_ID = "gen_ai.tool.call.id"
GEN_AI_OUTPUT_MESSAGES = "gen_ai.output.messages"
ERROR_TYPE = "error.type"

# What we charge per million tokens, for the cost panel in lesson 12.5.
# Illustrative prices for small open models, so the arithmetic is real and
# the number is obviously not a quote.
PRICE_PER_MTOK = {
    "qwen3-1.7b": {"in": 0.03, "out": 0.09},
    "qwen3-0.6b": {"in": 0.02, "out": 0.06},
    "llama-3.2-3b": {"in": 0.05, "out": 0.13},
    "flow-judge-3.8b": {"in": 0.06, "out": 0.15},
    "prometheus-2-7b": {"in": 0.12, "out": 0.28},
}
DEFAULT_PRICE = {"in": 0.10, "out": 0.25}


def model_price(model: str) -> dict:
    return PRICE_PER_MTOK.get(model, DEFAULT_PRICE)


def token_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    p = model_price(model)
    return (input_tokens * p["in"] + output_tokens * p["out"]) / 1_000_000


# --------------------------------------------------------------------------
# Spans
# --------------------------------------------------------------------------


@dataclass
class Span:
    """One span. Fields are the GenAI ones plus the four every OTel span has."""

    name: str
    span_id: str
    parent_id: str | None = None
    kind: str = "internal"          # internal | agent | chat | execute_tool | chain
    start_ms: float = 0.0
    duration_ms: float = 0.0
    attributes: dict = field(default_factory=dict)

    # --- convenience readers, so the lessons do not index raw dicts -------

    @property
    def model(self) -> str | None:
        return self.attributes.get(GEN_AI_REQUEST_MODEL)

    @property
    def input_tokens(self) -> int:
        return int(self.attributes.get(GEN_AI_INPUT_TOKENS, 0))

    @property
    def output_tokens(self) -> int:
        return int(self.attributes.get(GEN_AI_OUTPUT_TOKENS, 0))

    @property
    def tool(self) -> str | None:
        return self.attributes.get(GEN_AI_TOOL_NAME)

    @property
    def error(self) -> str | None:
        return self.attributes.get(ERROR_TYPE)

    @property
    def cost_usd(self) -> float:
        return token_cost(self.model or "", self.input_tokens, self.output_tokens)

    def to_dict(self) -> dict:
        d = asdict(self)
        # cost_usd is derived from the model and the token counts, so it
        # goes out with the span but is not a constructor argument.
        d["cost_usd"] = round(self.cost_usd, 8)
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "Span":
        """Rebuild a span from :meth:`to_dict`, ignoring derived fields."""
        fields = {f for f in cls.__dataclass_fields__}
        return cls(**{k: v for k, v in d.items() if k in fields})


# --------------------------------------------------------------------------
# The tracer
# --------------------------------------------------------------------------


class Tracer:
    """Collects spans for one trace, and can export them somewhere.

    Use it as a context manager; the span closes itself on exit, so an
    exception inside the block is recorded on the span rather than losing
    the timing. Losing a span on an error is how the one trace you needed
    disappears.
    """

    def __init__(self, trace_id: str, clock: Any = time.perf_counter,
                 simulate_latency: bool = True):
        self.trace_id = trace_id
        self.spans: list[Span] = []
        self._stack: list[Span] = []
        self._n = 0
        self._clock = clock
        # This app answers from recorded outputs, so a real clock would report
        # sub-millisecond spans and a latency dashboard would be fiction.
        # These are the durations a small local model and a vector search
        # actually take on a CPU laptop, and lesson 12.5 says plainly that
        # they are simulated. What they buy is that the p50/p95 arithmetic
        # is real rather than a column of zeros.
        self.simulate_latency = simulate_latency

    def _sim_ms(self, kind: str) -> float:
        if not self.simulate_latency:
            return 0.0
        lo, hi = {
            "chat": (180.0, 2400.0),
            "execute_tool": (8.0, 90.0),
            "chain": (2.0, 30.0),
        }.get(kind, (1.0, 10.0))
        # Deterministic in the trace id and span index, so a trace's
        # durations are reproducible across runs.
        jitter = (hash_span(self.trace_id, self._n) % 1000) / 1000.0
        return round(lo + jitter * (hi - lo), 3)

    def _next_id(self) -> str:
        self._n += 1
        return f"{self.trace_id[:6]}-{self._n:03d}"

    @contextmanager
    def span(self, name: str, kind: str = "internal", **attrs) -> Iterator[Span]:
        parent = self._stack[-1].span_id if self._stack else None
        wall_start = round(self._clock() * 1000, 3)
        simulated = self._sim_ms(kind)
        sp = Span(name=name, span_id=self._next_id(), parent_id=parent, kind=kind,
                  start_ms=wall_start, duration_ms=simulated, attributes=dict(attrs))
        sp.attributes.setdefault("evallab.simulated_latency", bool(simulated))
        self._stack.append(sp)
        self.spans.append(sp)
        try:
            yield sp
        except Exception as exc:  # noqa: BLE001 - the span records it and re-raises
            sp.attributes[ERROR_TYPE] = type(exc).__name__
            raise
        finally:
            wall = round((self._clock() * 1000) - wall_start, 3)
            # Report the simulated duration when there is one; fall back to
            # the real one otherwise, so a live app is never mislabelled.
            sp.duration_ms = simulated if simulated else max(wall, 0.0)
            self._stack.pop()
            # A root span must actually contain its children, or a duration
            # waterfall lies: the parent would show as shorter than the work
            # it contains.
            if parent is None and simulated:
                child_ms = sum(c.duration_ms for c in self.spans
                               if c.parent_id == sp.span_id)
                if child_ms:
                    sp.duration_ms = round(child_ms + simulated, 3)

    def chat(self, name: str, model: str, **attrs) -> "contextmanager":
        return self.span(name, "chat", **{
            GEN_AI_SYSTEM: "local", GEN_AI_OPERATION: "chat",
            GEN_AI_REQUEST_MODEL: model, **attrs})

    def tool(self, name: str, tool_name: str, **attrs) -> "contextmanager":
        return self.span(name, "execute_tool", **{
            GEN_AI_OPERATION: "execute_tool",
            GEN_AI_TOOL_NAME: tool_name,
            GEN_AI_TOOL_CALL_ID: self._next_id(), **attrs})

    def to_dict(self) -> dict:
        return {"trace_id": self.trace_id,
                "spans": [s.to_dict() for s in self.spans]}


# --------------------------------------------------------------------------
# PII redaction — lesson 12.5
# --------------------------------------------------------------------------


class Redactor:
    """Strips personal data from span attributes before they leave the process.

    A trace is a copy of a conversation, and a conversation is where the
    personal data is. The span names and the token counts are what you
    measure; the prompt text is what you cannot afford to ship.

    Redact at the point of export, not at capture: the local copy is what
    you debug with, and the exported one is what a third-party backend and
    a wider set of colleagues can see.
    """

    PATTERNS = {
        "email": r"[\w.+-]+@[\w-]+\.[\w.]+",
        "phone": r"\+?\d[\d\s().-]{8,}\d",
        "card": r"\b(?:\d[ -]*?){13,19}\b",
        "iban": r"\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b",
    }
    KEYS = ("prompt", "input", "question", "answer", "messages",
            "text", "content", GEN_AI_OUTPUT_MESSAGES)

    def __init__(self, drop_keys: bool = True):
        self.drop_keys = drop_keys
        self.redactions = 0

    def _scrub(self, text: str) -> str:
        import re
        for label, pattern in self.PATTERNS.items():
            text, n = re.subn(pattern, f"[redacted:{label}]", text)
            self.redactions += n
        return text

    def span(self, sp: Span) -> Span:
        out = Span.from_dict(asdict(sp))
        for k, v in list(out.attributes.items()):
            if self.drop_keys and k in self.KEYS:
                out.attributes[k] = "[dropped: %d chars]" % len(str(v))
            elif isinstance(v, str):
                out.attributes[k] = self._scrub(v)
        return out


# --------------------------------------------------------------------------
# Sampling — lesson 12.5
# --------------------------------------------------------------------------


def should_sample(rate: float, key: str) -> bool:
    """Deterministic sampling: the same key always gets the same answer.

    A coin flip per request means a trace you wanted may be missing and you
    cannot tell which. Hashing the trace id means the sample is stable, so
    "we do not trace errors" actually holds across runs.
    """
    if rate >= 1.0:
        return True
    if rate <= 0.0:
        return False
    from .stats import hash_seed
    return (hash_seed(key) % 10_000) < rate * 10_000


# --------------------------------------------------------------------------
# Export
# --------------------------------------------------------------------------

HERE = Path(__file__).resolve()


def hash_span(trace_id: str, index: int) -> int:
    """A small deterministic hash, for reproducible simulated durations."""
    from .stats import hash_seed
    return hash_seed(f"{trace_id}#{index}")


def backend_status() -> dict:
    """What can this machine actually receive a trace? Never raises."""
    status = {"jsonl": True, "otlp": False, "mlflow": False,
              "otlp_endpoint": os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT"),
              "mlflow_uri": os.environ.get("MLFLOW_TRACKING_URI")}
    try:
        import opentelemetry.sdk.trace  # noqa: F401
        status["otlp"] = True
    except ImportError:
        pass
    try:
        import mlflow  # noqa: F401
        status["mlflow"] = True
    except ImportError:
        pass
    return status


def export(traces: list[dict], path: str | Path, redactor: Redactor | None = None) -> dict:
    """Write traces out.

    Always writes JSONL — that is the format everything else ingests and the
    one you can read with ``jq``. Additionally writes OTLP and MLflow when
    those backends are present, and says which ones it skipped rather than
    pretending they were written.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    written = {"jsonl": str(path)}
    skipped: list[str] = []

    n = 0
    with path.open("w", encoding="utf-8") as fh:
        for t in traces:
            spans = t["spans"]
            if redactor is not None:
                red = redactor
                spans = [red.span(Span.from_dict(s)).to_dict() for s in spans]
            fh.write(json.dumps({"trace_id": t["trace_id"], "spans": spans}) + "\n")
            n += 1

    status = backend_status()
    if status["otlp"] and status["otlp_endpoint"]:
        try:
            _export_otlp(traces)
            written["otlp"] = status["otlp_endpoint"]
        except Exception as exc:  # noqa: BLE001
            skipped.append(f"otlp: {exc}")
    else:
        skipped.append("otlp: not installed or no OTEL_EXPORTER_OTLP_ENDPOINT")

    if status["mlflow"]:
        try:
            _export_mlflow(traces, path.with_suffix(""))
            written["mlflow"] = status["mlflow_uri"] or "local ./mlruns"
        except Exception as exc:  # noqa: BLE001
            skipped.append(f"mlflow: {exc}")
    else:
        skipped.append("mlflow: not installed")

    return {"traces": n, "written": written, "skipped": skipped,
            "redactions": redactor.redactions if redactor else 0}


def _export_otlp(traces: list[dict]) -> None:
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import SimpleSpanProcessor
    from opentelemetry.sdk.resources import Resource
    provider = TracerProvider(resource=Resource.create({"service.name": "support-bot"}))
    provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter()))
    tp = provider.get_tracer("support-bot")
    for t in traces:
        for s in t["spans"]:
            tp.start_span(s["name"], attributes=s["attributes"])


def _export_mlflow(traces: list[dict], path: Path) -> None:
    import mlflow
    for t in traces:
        with mlflow.start_run(run_name=t["trace_id"], nested=False):
            for s in t["spans"]:
                mlflow.log_table(
                    [{"span": s["name"], "kind": s["kind"], "ms": s["duration_ms"]}],
                    artifact_file=f"{t['trace_id']}-{s['span_id']}.json")
            for k in ("total_cost_usd", "total_tokens", "n_spans", "duration_ms"):
                mlflow.log_metric(k, _trace_metric(t, k))
    mlflow.flush()


def _trace_metric(trace: dict, key: str) -> float:
    spans = [Span.from_dict(s) for s in trace["spans"]]
    if key == "total_cost_usd":
        return sum(s.cost_usd for s in spans)
    if key == "total_tokens":
        return float(sum(s.input_tokens + s.output_tokens for s in spans))
    if key == "n_spans":
        return float(len(spans))
    if key == "duration_ms":
        root = max(spans, key=lambda s: s.duration_ms)
        return root.duration_ms
    return 0.0



