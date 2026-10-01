"""The support bot, instrumented — and the queries you run on its traces.

``instrumented_run`` is the whole of module 12.2 in one function: a root agent
span, a retrieval tool span, a model span carrying token counts, a
post-check span, and a final answer span. Every attribute is the GenAI
convention name, and every span closes even when the call raises, because a
span you lose on an error is the one trace you needed.

``TraceStore`` is the other half: what you would otherwise have typed into
the MLflow UI. It is here so the queries are legible and so a learner can
see which numbers come from the trace and which are computed on top of it.
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from .dataset import Dataset, load
from .tracing import (
    ERROR_TYPE, GEN_AI_CONVERSATION_ID, GEN_AI_INPUT_TOKENS,
    GEN_AI_OUTPUT_MESSAGES, GEN_AI_OUTPUT_TOKENS, GEN_AI_REQUEST_MODEL,
    GEN_AI_RESPONSE_MODEL, Span, Tracer, token_cost, should_sample,
)
from .stats import hash_seed

# Rough token estimates, so the counts in a trace are in the right order of
# magnitude without pulling in a tokenizer. The lesson says so.
CHARS_PER_TOKEN = 4


def estimate_tokens(text: str) -> int:
    return max(1, round(len(str(text)) / CHARS_PER_TOKEN))


# --------------------------------------------------------------------------
# The instrumented app
# --------------------------------------------------------------------------


def instrumented_run(item, data: Dataset, variant: str = "v1",
                     model: str = "qwen3-1.7b", session: str = "s-demo",
                     fail_on: str | None = None, user: str | None = None) -> dict:
    """Answer one question, emitting a full OTel GenAI trace.

    ``fail_on`` is an item id: raise inside the model span instead of
    completing, so lesson 12.3 has something real to look at. The span
    records ``error.type`` and the exception still propagates, which is what
    an instrumented library does and what makes the error visible in the
    trace rather than in a log line.

    ``user`` is the requester's identifier. A real support bot knows who it
    is talking to and puts it on the span, because the dashboard groups by
    session — and that is exactly how a trace becomes a copy of your
    customer list. Lesson 12.5 turns it on deliberately.
    """
    tracer = Tracer(trace_id=f"tr_{item.id}")
    answer = item.output(variant)
    question = item.question

    with tracer.span("support.answer", "agent",
                     **{GEN_AI_CONVERSATION_ID: session}) as root:
        # 1. Retrieval. A real app would call a vector store; the shape of
        #    the span is what matters, and it is the span that tells you
        #    whether the right text was in front of the model at all.
        with tracer.tool("retrieve_handbook", "retrieve_handbook") as ret:
            # `out_of_scope` lives in the item's slice descriptor. A question
            # the handbook does not cover retrieves nothing, and that is a
            # trace fact worth having: the model was asked to answer without
            # evidence.
            found = not (item.slice or {}).get("out_of_scope", False)
            ret.attributes["retrieved"] = int(found)
            if not found:
                ret.attributes[ERROR_TYPE] = "no_matching_section"

        # 2. The model call.
        with tracer.chat("generate answer", model) as chat:
            if fail_on == item.id:
                chat.attributes[GEN_AI_OUTPUT_TOKENS] = 0
                raise RuntimeError(f"upstream timeout on {item.id}")
            prompt = f"{question}\n\n{answer}"
            chat.attributes[GEN_AI_INPUT_TOKENS] = estimate_tokens(prompt)
            chat.attributes[GEN_AI_OUTPUT_TOKENS] = estimate_tokens(answer)
            chat.attributes[GEN_AI_RESPONSE_MODEL] = model
            chat.attributes[GEN_AI_OUTPUT_MESSAGES] = answer
            chat.attributes["question"] = question
            if user:
                # A support bot knows who is asking, and a dashboard that
                # groups by user needs it on the span. Both facts are why
                # the redaction in lesson 12.5 exists.
                chat.attributes["user.id"] = user
                chat.attributes["user.email"] = user

        # 3. The post-check. This is the span that turns a user complaint
        #    into a line in a dashboard.
        with tracer.span("citation check", "chain") as check:
            if item.human[variant]["category"] == "no_citation":
                check.attributes[ERROR_TYPE] = "no_handbook_citation"
            elif item.human[variant]["category"] == "extra":
                check.attributes[ERROR_TYPE] = "unsupported_addition"

    return tracer.to_dict()


def record(data: Dataset | None = None, n: int = 20, split: str = "dev",
           variant: str = "v1", model: str = "qwen3-1.7b",
           session: str = "s-demo", fail_rate: float = 0.0,
           sample_rate: float = 1.0, seed: int = 0,
           pii_rate: float = 0.0) -> list[dict]:
    """Run the bot over a slice and collect traces.

    ``fail_rate`` plants errors at a known rate so the error-rate query in
    lesson 12.5 has something to find. ``sample_rate`` uses the
    deterministic sampler, so "we do not trace errors" can be turned on
    and the result is still stable across runs. ``pii_rate`` attaches a
    customer identifier to that share of requests, which is what a real
    support bot does and what the redaction lab turns off.
    """
    data = data or load("support")
    items = data.items_for(split)[:n]
    out: list[dict] = []
    for i, item in enumerate(items):
        if not should_sample(sample_rate, f"tr_{item.id}"):
            continue
        # Hash rather than multiply-and-modulo: a linear sequence of `i`
        # walks straight past a threshold and plants nothing at all, which
        # looks exactly like a redaction that works.
        h = hash_seed(f"{seed}:{item.id}")
        fail_on = item.id if (seed and h % 1000 < fail_rate * 1000) else None
        user = None
        if pii_rate and hash_seed(f"pii:{seed}:{item.id}") % 1000 < pii_rate * 1000:
            user = f"customer{i:03d}@example.com"
        try:
            out.append(instrumented_run(item, data, variant=variant,
                                        model=model, session=session,
                                        fail_on=fail_on, user=user))
        except RuntimeError:
            # The tracer already has the spans; a real app loses them here
            # unless the exporter is inside the context manager, which is
            # exactly the bug lesson 12.3 is about.
            continue
    return out


# --------------------------------------------------------------------------
# Reading traces back
# --------------------------------------------------------------------------


@dataclass
class TraceStore:
    """The queries you would otherwise click in the MLflow UI."""

    traces: list[dict]

    @classmethod
    def load(cls, path: str | Path) -> "TraceStore":
        traces = []
        with Path(path).open(encoding="utf-8") as fh:
            for line in fh:
                if line.strip():
                    traces.append(json.loads(line))
        return cls(traces)

    @classmethod
    def from_traces(cls, traces: Iterable[dict]) -> "TraceStore":
        return cls(list(traces))

    # --- shape -----------------------------------------------------------

    def __len__(self) -> int:
        return len(self.traces)

    def spans(self, kind: str | None = None) -> list[Span]:
        out = []
        for t in self.traces:
            for s in t["spans"]:
                sp = Span.from_dict(s)
                if kind is None or sp.kind == kind:
                    out.append(sp)
        return out

    def with_errors(self) -> list[Span]:
        return [s for s in self.spans() if s.error]

    # --- the four numbers lesson 12.5 asks for --------------------------

    def total_cost(self) -> float:
        return sum(s.cost_usd for s in self.spans("chat"))

    def total_tokens(self) -> dict:
        chats = self.spans("chat")
        return {
            "input": sum(s.input_tokens for s in chats),
            "output": sum(s.output_tokens for s in chats),
            "total": sum(s.input_tokens + s.output_tokens for s in chats),
        }

    def latency(self) -> dict:
        """End-to-end (the root span) and per-model-call, in ms."""
        roots = [max((Span.from_dict(s) for s in t["spans"]), key=lambda x: x.duration_ms)
                 for t in self.traces]
        chats = self.spans("chat")
        return {
            "p50_end_to_end": _pct([r.duration_ms for r in roots], 0.50),
            "p95_end_to_end": _pct([r.duration_ms for r in roots], 0.95),
            "p50_model_call": _pct([s.duration_ms for s in chats], 0.50),
            "p95_model_call": _pct([s.duration_ms for s in chats], 0.95),
        }

    def cost_by_model(self) -> dict:
        out: dict = defaultdict(float)
        for s in self.spans("chat"):
            out[s.model] += s.cost_usd
        return dict(sorted(out.items(), key=lambda kv: -kv[1]))

    def tokens_by_span(self) -> dict:
        out: dict = defaultdict(lambda: [0, 0])
        for s in self.spans("chat"):
            out[s.name][0] += s.input_tokens
            out[s.name][1] += s.output_tokens
        return dict(out)

    def error_rate(self) -> dict:
        """By span kind, which is the number that tells you *where* to look."""
        total: Counter = Counter()
        broken: Counter = Counter()
        for s in self.spans():
            total[s.kind] += 1
            if s.error:
                broken[s.kind] += 1
        return {k: {"errors": broken[k], "spans": v,
                    "rate": broken[k] / v if v else 0.0}
                for k, v in sorted(total.items())}

    def sessions(self) -> dict:
        by_session: dict = defaultdict(lambda: {"traces": 0, "cost": 0.0, "tokens": 0})
        for t in self.traces:
            root = max((Span.from_dict(s) for s in t["spans"]), key=lambda x: x.duration_ms)
            sid = root.attributes.get(GEN_AI_CONVERSATION_ID, "unknown")
            by_session[sid]["traces"] += 1
            by_session[sid]["cost"] += sum(Span.from_dict(s).cost_usd for s in t["spans"])
            by_session[sid]["tokens"] += sum(
                Span.from_dict(s).input_tokens + Span.from_dict(s).output_tokens for s in t["spans"])
        return dict(by_session)

    def tree(self, trace_id: str, indent: int = 0) -> str:
        """A span tree as text — the nested list a screen reader can read."""
        t = next(x for x in self.traces if x["trace_id"] == trace_id)
        spans = {s["span_id"]: Span.from_dict(s) for s in t["spans"]}
        children: dict = defaultdict(list)
        roots = []
        for s in spans.values():
            (children[s.parent_id] if s.parent_id else roots).append(s)
        lines = []
        def walk(node, depth):
            cost = f"  ${node.cost_usd:.6f}" if node.cost_usd else ""
            tok = f"  {node.input_tokens}in/{node.output_tokens}out" if node.model else ""
            err = f"  ERROR {node.error}" if node.error else ""
            lines.append("  " * depth +
                         f"[{node.kind}] {node.name}  {node.duration_ms}ms{tok}{cost}{err}")
            for c in children.get(node.span_id, []):
                walk(c, depth + 1)
        for r in sorted(roots, key=lambda s: s.start_ms):
            walk(r, indent)
        return "\n".join(lines)


def _pct(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    if len(s) == 1:
        return s[0]
    pos = q * (len(s) - 1)
    lo = int(pos)
    hi = min(len(s) - 1, lo + 1)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


def summary(store: TraceStore) -> str:
    """A few lines a human reads in a pull-request comment. Lesson 12.5."""
    tok = store.total_tokens()
    lat = store.latency()
    errs = sum(v["errors"] for v in store.error_rate().values())
    return (
        f"{len(store)} traces, {len(store.spans())} spans\n"
        f"  cost      ${store.total_cost():.4f} total"
        f"  {', '.join(f'{m} ${c:.4f}' for m, c in store.cost_by_model().items()) or 'no model calls'}\n"
        f"  tokens    {tok['input']} in / {tok['output']} out ({tok['total']} total)\n"
        f"  latency   p50 {lat['p50_end_to_end']:.0f} ms, p95 {lat['p95_end_to_end']:.0f} ms end-to-end\n"
        f"  errors    {errs} span(s) with an error.type"
    )

