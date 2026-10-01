"""Lab 2 — an export you can defend.

The starter writes traces out and checks nothing. Four TODOs; the
specification is ``test_ship.py``.

The redaction test writes a file and greps it, which is the only kind of
test for "did the personal data leave" — a passing unit test on the
redactor proves nothing about the file the backend receives.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from evallab import TraceStore, load, record, token_cost
from evallab.tracing import Redactor, backend_status, export

# Attributes a support bot puts on a span that are personal data. The
# pattern list is not exhaustive and that is the point — see TODO 2.
KNOWN_PROMPT_KEYS = ("question", "answer", "gen_ai.output.messages")


def ship(traces: list[dict], out: str | Path) -> dict:
    """Write traces somewhere defensibly.

    TODO 1: redact, and do it at export rather than at capture.
    TODO 2: drop the keys known to carry a conversation, scrub the rest.
    TODO 3: return which backends were written and which were skipped.
    TODO 4: include a per-request cost, not only the total.
    """
    # TODO 1 goes here
    result = export(traces, out)
    result["per_request_cost"] = {}
    return result


def cost_panel(store: TraceStore) -> dict:
    """Cost per request, and the variant comparison.

    TODO 4: the same content can cost very different amounts, so a total
    alone is not a number anybody can act on.
    """
    raise NotImplementedError


def main() -> int:
    data = load("support")
    traces = record(data, n=20, split="dev", pii_rate=1.0, seed=1)
    out = Path("shipped-traces.jsonl")
    result = ship(traces, out)
    print(f"wrote {result['traces']} trace(s) to {out}")
    for k, v in result.get("written", {}).items():
        print(f"  wrote   {k}: {v}")
    for s in result.get("skipped", []):
        print(f"  skipped {s}")
    if result.get("redactions"):
        print(f"  {result['redactions']} personal-data value(s) redacted")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
