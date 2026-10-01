"""Lab 1 — solution.

The three additions, and what each one is for:

* the retrieval span tells you the model was asked to answer without evidence
* the post-check span turns a support ticket into a dashboard row
* exporting on the way out is what makes the error rate mean anything

The last one is the smallest change and the biggest lesson. Everything else
in this course is arithmetic; a tracer that drops spans on error does not
under-report errors, it reports a rate with the failures removed, and the
removal leaves no trace of its own.
"""

from __future__ import annotations

import sys
from pathlib import Path

from evallab import (
    ERROR_TYPE, GEN_AI_OPERATION, GEN_AI_TOOL_NAME, Tracer, load,
)
from evallab.observe import TraceStore

# The categories that mean the answer is not acceptable, and the reason to
# put on the span. A post-check that fires on every request is a post-check
# nobody reads, so a correct answer records nothing.
REJECTIONS = {
    "no_citation": "no_handbook_citation",
    "extra": "unsupported_addition",
    "over_refusal": "refused_answerable_question",
    "out_of_scope": "no_policy_for_question",
}


def thin_trace(item, data, variant: str = "v1", model: str = "qwen3-1.7b") -> dict:
    """A trace with only the model span — what auto-instrumentation gives you."""
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
    tracer = Tracer(trace_id=f"tr_{item.id}")
    answer = item.output(variant)
    label_variant = {"v1padded": "v1"}.get(variant, variant)
    category = item.human.get(label_variant, {}).get("category", "unknown")

    try:
        with tracer.span("support.answer", "agent"):
            # --- 1: the span only this app can emit ---------------------
            with tracer.tool("retrieve_handbook", "retrieve_handbook") as ret:
                found = not (item.slice or {}).get("out_of_scope", False)
                ret.attributes["retrieved"] = int(found)
                if not found:
                    ret.attributes[ERROR_TYPE] = "no_matching_section"

            with tracer.chat("generate answer", model) as chat:
                if fail_on == item.id:
                    chat.attributes["gen_ai.usage.output_tokens"] = 0
                    raise RuntimeError(f"upstream timeout on {item.id}")
                chat.attributes["gen_ai.usage.input_tokens"] = len(item.question) // 4
                chat.attributes["gen_ai.usage.output_tokens"] = len(answer) // 4
                chat.attributes["gen_ai.output.messages"] = answer

            # --- 2: the other one --------------------------------------
            with tracer.span("citation check", "chain") as check:
                reason = REJECTIONS.get(category)
                if reason:
                    check.attributes[ERROR_TYPE] = reason
    except Exception as exc:
        # --- 3: ship what you have -------------------------------------
        # A real SDK exports inside the context manager so this cannot
        # happen. Hand-rolled exporters put the call at the end, and lose
        # exactly the traces that would have told them what broke.
        exc.trace = tracer.to_dict()
        raise

    return tracer.to_dict()


def _planted(item, fail_rate: float, seed: int) -> bool:
    from evallab import hash_seed
    return seed and hash_seed(f"{seed}:{item.id}") % 1000 < fail_rate * 1000


def compare(n: int = 20, split: str = "dev", variant: str = "v1",
            fail_rate: float = 0.10, seed: int = 1) -> dict:
    data = load("support")
    items = data.items_for(split)[:n]
    thin, fixed, lost = [], [], []
    for item in items:
        thin.append(thin_trace(item, data, variant=variant))
        try:
            fixed.append(fixed_trace(
                item, data, variant=variant,
                fail_on=item.id if _planted(item, fail_rate, seed) else None))
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
    print(f"  thin tracer   {r['n_thin']:2d} traces   chat error rate {thin:.1%}")
    print(f"  fixed tracer  {r['n_fixed']:2d} traces   chat error rate {fixed:.1%}")
    if r["lost"]:
        print(f"  {len(r['lost'])} trace(s) lost on error — every one of them a failure")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
