"""Online evals: the same checks, run on production.

Modules 1-13 measure a fixed set of items you chose. That set is wrong from
the day you write it, because production keeps sending you things it did not
send you when you built it. This module is the loop that notices, and the
loop that turns what it notices into a test case.

Three things live here, and each answers a question module 14 keeps asking:

* **sampling** — you cannot judge every request, so which ones?
* **drift** — the input mix moved. Population stability index says how far.
* **the band** — a number that has to change before anyone is woken up. The
  band is an interval, and a band that is not derived from one is a mood.
"""

from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass, field

from .stats import wilson
from .tracing import Redactor, should_sample, token_cost


# --------------------------------------------------------------------------
# Drift
# --------------------------------------------------------------------------


def psi(expected: dict, actual: dict, eps: float = 1e-6) -> float:
    """Population stability index between two distributions over the same keys.

    ``sum((actual - expected) * ln(actual / expected))`` per bucket. The
    usual reading is under 0.1 stable, 0.1 to 0.25 worth a look, over 0.25
    assume something moved.

    ``eps`` floors a zero bucket rather than dividing by zero. That is not
    free: a category that is absent from one window and present in the other
    contributes a large finite amount, which is the right direction — the
    thing that vanished is exactly what you want to be told about.
    """
    keys = set(expected) | set(actual)
    total = 0.0
    for k in sorted(keys):
        e = expected.get(k, 0.0)
        a = actual.get(k, 0.0)
        e = max(e, eps)
        a = max(a, eps)
        total += (a - e) * math.log(a / e)
    return total


def mix(items, key) -> dict:
    """Turn a list of items into a proportion map, which is what psi wants."""
    counts = Counter(key(i) for i in items)
    n = sum(counts.values()) or 1
    return {k: v / n for k, v in counts.items()}


def read(baseline, window) -> dict:
    """One dictionary of headline numbers for two windows of traces."""
    def one(items):
        chats = [s for t in items for s in t["spans"] if s["kind"] == "chat"]
        cost = sum(s.cost_usd for s in chats)
        lat = [s["duration_ms"] for s in chats]
        lat_sorted = sorted(lat)
        p95 = lat_sorted[min(len(lat_sorted) - 1, int(0.95 * len(lat_sorted)))] if lat_sorted else 0.0
        return {"cost": cost, "p95_ms": p95, "errors": sum(1 for t in items for s in t["spans"] if s.get("error"))}

    b, a = one(baseline), one(window)
    out = {k: (b[k], a[k]) for k in b}
    out["psi_cost"] = None
    return out


# --------------------------------------------------------------------------
# Alert bands
# --------------------------------------------------------------------------


@dataclass
class Band:
    """When to wake somebody up.

    Built from an interval rather than chosen. A pass rate of 0.9 on 20
    requests has a Wilson interval roughly 0.70 to 0.97, so a rule that fires
    below 0.95 would fire on most healthy days. That is not a sensitive
    monitor, it is a broken one, and the only way to know is to compute the
    interval before choosing the number.
    """

    metric: str
    baseline: float
    n: int
    sensitivity: float = 0.05   # how far from baseline must it move

    @property
    def interval(self):
        """The baseline's own uncertainty at this sample size."""
        w = wilson(int(round(self.baseline * self.n)), self.n)
        return w

    @property
    def lower(self) -> float:
        return self.baseline - self.sensitivity

    @property
    def upper(self) -> float:
        return min(1.0, self.baseline + self.sensitivity)

    @property
    def half_width(self) -> float:
        w = self.interval
        return (w.hi - w.lo) / 2

    def fires(self, value: float) -> bool:
        return value < self.lower or value > self.upper

    def explain(self, value: float) -> str:
        w = self.interval
        return (f"{self.metric} is {value:.3f} against a baseline of {self.baseline:.3f} "
                f"on n={self.n} (Wilson {w.lo:.3f}-{w.hi:.3f}, half-width {self.half_width:.3f}). "
                f"The band is {self.lower:.3f}-{self.upper:.3f}. "
                + ("FIRES." if self.fires(value) else "does not fire.")
                + (" The band is narrower than the measurement's own half-width, "
                   "so it will fire on noise." if self.sensitivity < self.half_width else ""))


# --------------------------------------------------------------------------
# Sampling production traffic
# --------------------------------------------------------------------------


def sample_queries(queries, rate: float, seed_key: str = "q") -> list:
    """Keep a deterministic share of requests.

    Deterministic on the request id, so "we sample 25%" means the same
    requests every time and a dip is a dip rather than a different draw.
    """
    return [q for q in queries if should_sample(rate, f"{seed_key}:{q}")]


def sample_for_review(queries, rate: float, errors_first: bool = True) -> list:
    """Keep a share of traffic, plus every request that already failed.

    Same rule as the sampler in ``observe.record``: drop the volume, never
    the failures. A sampled stream that quietly excludes the failures is a
    stream with no signal in it.
    """
    kept = []
    for q in queries:
        failed = bool(errors_first and q.get("error")) if isinstance(q, dict) else False
        if failed or should_sample(rate, f"q:{q.get('id') if isinstance(q, dict) else q}"):
            kept.append(q)
    return kept


# --------------------------------------------------------------------------
# The loop: a production failure becomes a test case
# --------------------------------------------------------------------------


@dataclass
class Regression:
    """A failure found in production, carried back to the suite."""

    item_id: str
    question: str
    output: str
    category: str
    why: str = ""
    in_suite: bool = False

    def as_test_case(self, human_label: int, judge_verdict: int,
                     category: str | None = None) -> dict:
        """The item, in the shape ``evallab.dataset.load`` expects.

        The human label is the point. A production failure that nobody
        labelled is a trace, not a test, and it will be argued about again
        next quarter instead of being fixed once.
        """
        return {
            "id": self.item_id,
            "question": self.question,
            "outputs": {"v1": self.output},
            "human": {
                "v1": {
                    "label": human_label,
                    "category": category or self.category,
                    "critique": self.why or "found in production",
                }
            },
            "slice": {"intent": "production", "difficulty": "unrated"},
        }


def regressions_from(traces, human_labels: dict | None = None) -> list:
    """Find the failures in a window of production traces.

    A trace is a failure when a span carries ``error.type`` — the post-check
    rejecting the answer, or a call that raised. Not when a human read it and
    frowned, because nobody is reading the stream.

    ``error.type`` lives in the span's **attributes**, not on the span itself.
    Reading ``span["error"]`` finds nothing and returns an empty list, which
    looks exactly like a healthy window.
    """
    human_labels = human_labels or {}

    def err(s):
        return s.get("attributes", {}).get("error.type")

    out = []
    for t in traces:
        broken = [s for s in t["spans"] if err(s)]
        if not broken:
            continue
        chat = next((s for s in t["spans"] if s["kind"] == "chat"), {})
        attrs = chat.get("attributes", {})
        out.append(Regression(
            item_id=t["trace_id"],
            question=attrs.get("question", ""),
            output=attrs.get("gen_ai.output.messages", ""),
            category=err(broken[0]),
            why=f"span error: {err(broken[0])}",
            in_suite=t["trace_id"] in human_labels,
        ))
    return out
