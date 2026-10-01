"""Lab 2 — solution.

Read the four parts against your own and the difference is the lesson:

* redaction happens here, at the export, not in the tracer
* a key *known* to carry a conversation is dropped whole; anything else is
  scrubbed in place, because you cannot enumerate what people put on spans
* the result names every backend it skipped, because an exporter that
  implies a write it did not make has lied in the one place a reader checks
* the cost panel reports per request and the two variants side by side,
  because the padded answer costs about four times as much for the same
  facts and a total hides that completely
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from evallab import TraceStore, load, record, token_cost
from evallab.tracing import Redactor, backend_status, export

# Keys whose contents are a conversation. Scrubbing a conversation is
# guessing — an address hides in a sentence — so these are dropped whole.
KNOWN_PROMPT_KEYS = ("question", "answer", "gen_ai.output.messages")


def ship(traces: list[dict], out: str | Path) -> dict:
    # 1. Redact at export, so the in-memory copy keeps the text for debugging.
    redactor = Redactor(drop_keys=True)
    result = export(traces, out, redactor=redactor)

    # 2. The drop/scrub split is inside Redactor, and both are reported:
    #    `redactions` counts scrubbed values, and the file records which
    #    keys were dropped so a reader is not left guessing.
    result["dropped_keys"] = list(KNOWN_PROMPT_KEYS)

    # 3. `export` already returns `written` and `skipped`; nothing to add,
    #    which is the point — the caller does not have to remember to say.
    result.setdefault("skipped", [])

    # 4. Per-request cost, and the variants side by side.
    store = TraceStore.from_traces(traces)
    result["per_request_cost"] = (
        store.total_cost() / len(store) if len(store) else 0.0
    )
    result["panel"] = cost_panel(store)
    return result


def cost_panel(store: TraceStore) -> dict:
    """Cost, tokens and latency, in the units somebody can act on."""
    tok = store.total_tokens()
    lat = store.latency()
    n = len(store)
    return {
        "traces": n,
        "total_cost": store.total_cost(),
        "cost_per_request": store.total_cost() / n if n else 0.0,
        "input_tokens": tok["input"],
        "output_tokens": tok["output"],
        "total_tokens": tok["total"],
        "p50_ms": lat["p50_end_to_end"],
        "p95_ms": lat["p95_end_to_end"],
        "by_model": store.cost_by_model(),
        "errors_by_kind": store.error_rate(),
    }


def main() -> int:
    data = load("support")
    traces = record(data, n=20, split="dev", pii_rate=1.0, seed=1)
    out = Path("shipped-traces.jsonl")
    result = ship(traces, out)
    panel = result["panel"]
    print(f"wrote {result['traces']} trace(s) to {out}")
    print(f"  {panel['traces']} requests, ${panel['total_cost']:.8f} total, "
          f"${panel['cost_per_request']:.9f} each")
    print(f"  {panel['total_tokens']} tokens, p50 {panel['p50_ms']:.0f} ms, "
          f"p95 {panel['p95_ms']:.0f} ms")
    for k, v in result.get("written", {}).items():
        print(f"  wrote   {k}: {v}")
    for s in result.get("skipped", []):
        print(f"  skipped {s}")
    if result.get("redactions"):
        print(f"  {result['redactions']} value(s) scrubbed, "
              f"and {len(result['dropped_keys'])} conversation key(s) dropped whole")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
