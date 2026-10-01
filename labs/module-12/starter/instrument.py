"""Lab 1 — add the spans only your app can emit.

This starter records the model call and nothing else, which is roughly what
you get from an auto-instrumented client: a complete-looking trace that
cannot answer a question about your own logic.

Three TODOs. ``test_instrument.py`` is the specification.
"""

from __future__ import annotations

import sys
from pathlib import Path

from evallab import (
    ERROR_TYPE, GEN_AI_OPERATION, GEN_AI_TOOL_NAME, Tracer, load, record,
)
from evallab.observe import TraceStore, instrumented_run, summary


def thin_trace(item, data, variant: str = "v1", model: str = "qwen3-1.7b") -> dict:
    """A trace with only the model span. The starting point."""
    tracer = Tracer(trace_id=f"tr_{item.id}")
    answer = item.output(variant)
    with tracer.span("support.answer", "agent"):
        with tracer.chat("generate answer", model) as chat:
            chat.attributes["gen_ai.usage.input_tokens"] = len(item.question) // 4
            chat.attributes["gen_ai.usage.output_tokens"] = len(answer) // 4
            chat.attributes["gen_ai.output.messages"] = answer
    return tracer.to_dict()


def fixed_trace(item, data, variant: str = "v1", model: str = "qwen3-1.7b",
                fail_on: str | None = None) -> dict:
    """The trace you are trying to end up with.

    TODO 1: emit the retrieval span, and say whether anything was found.
    TODO 2: emit the post-check span, and say why an answer was rejected.
    TODO 3: when the model call raises, still return the spans you have.
    """
    tracer = Tracer(trace_id=f"tr_{item.id}")
    answer = item.output(variant)
    label_variant = {"v1padded": "v1"}.get(variant, variant)
    category = item.human.get(label_variant, {}).get("category", "unknown")

    with tracer.span("support.answer", "agent"):
        # --- TODO 1: the retrieval span -------------------------------
        # An `execute_tool` span naming the tool, with a `retrieved`
        # attribute. The questions the handbook does not cover are marked in
        # the item's slice as `out_of_scope`; retrieving nothing for one of
        # those is a bug the model span will never show you.
        pass

        with tracer.chat("generate answer", model) as chat:
            # --- TODO 3: an exception here must not lose the spans -----
            chat.attributes["gen_ai.usage.input_tokens"] = len(item.question) // 4
            chat.attributes["gen_ai.usage.output_tokens"] = len(answer) // 4
            chat.attributes["gen_ai.output.messages"] = answer

        # --- TODO 2: the post-check span ------------------------------
        # A `chain` span after generation. Categories worth recording:
        #   no_citation   -> ERROR no_handbook_citation
        #   extra          -> ERROR unsupported_addition
        #   over_refusal   -> ERROR refused_answerable_question
        #   out_of_scope   -> ERROR no_policy_for_question
        # Leave the attribute off entirely for a correct answer; a post-check
        # that always fires is a post-check nobody reads.
        pass

    return tracer.to_dict()


def compare(n: int = 20, split: str = "dev", variant: str = "v1",
            fail_rate: float = 0.10, seed: int = 1) -> dict:
    """Both tracers over the same items, for a side-by-side number."""
    data = load("support")
    items = data.items_for(split)[:n]
    thin, fixed, lost = [], [], []
    for item in items:
        thin.append(thin_trace(item, data, variant=variant))
        try:
            fixed.append(fixed_trace(item, data, variant=variant))
        except RuntimeError as exc:
            salvaged = getattr(exc, "trace", None)
            if salvaged is None:
                lost.append(item.id)
            else:
                fixed.append(salvaged)
    return {
        "thin": TraceStore.from_traces(thin).error_rate(),
        "fixed": TraceStore.from_traces(fixed).error_rate(),
        "traces": len(items),
        "lost": lost,
        "n_thin": len(thin),
        "n_fixed": len(fixed),
    }


def main() -> int:
    r = compare()
    thin = r["thin"].get("chat", {}).get("rate", 0.0)
    fixed = r["fixed"].get("chat", {}).get("rate", 0.0)
    print(f"{r['traces']} requests, 10% with a planted model failure")
    print(f"  thin tracer  {r['n_thin']:2d} traces   chat error rate {thin:.1%}")
    print(f"  fixed tracer {r['n_fixed']:2d} traces   chat error rate {fixed:.1%}")
    if r["lost"]:
        print(f"  {len(r['lost'])} trace(s) lost on error — every one of them a failure")
    elif abs(fixed - thin) < 1e-9:
        print("  The two agree, which means the failures are being dropped in both.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
