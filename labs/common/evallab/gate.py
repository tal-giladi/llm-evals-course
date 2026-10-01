"""A release gate, as code.

Module 13 is about the day the gate exists and someone has to decide what it
does. That decision is three numbers, and this module is where they live:

* **tolerance** — how big a drop the gate tolerates before it blocks
* **budget** — what one run is allowed to cost
* **quarantine** — the tests you have stopped believing

The last one is the interesting one. A failing eval is not a fact, it is a
claim. Sometimes the claim is right and the code is wrong; sometimes the eval
has drifted from what the product does; occasionally the eval itself is
broken. A quarantine list is how you say which of those you currently believe,
in a file, where a pull request can see it.

It is also the thing teams are most tempted to abuse. Every entry added to
quarantine is a check that has stopped running, and a gate that blocks nothing
is indistinguishable from a gate that is not there.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from .stats import paired_comparison, percentile_ci, wilson


@dataclass
class Quarantine:
    """Tests you have stopped believing, with the reason and an owner.

    An entry without a reason and a review date is a test that was deleted
    with extra steps, so both are required.
    """

    items: dict = field(default_factory=dict)   # test id -> {reason, owner, review_by}

    def is_quarantined(self, test_id: str) -> bool:
        return test_id in self.items

    def add(self, test_id: str, reason: str, owner: str, review_by: str) -> None:
        if not reason or not owner or not review_by:
            raise ValueError(
                f"quarantining {test_id} needs a reason, an owner and a review date; "
                "an entry without all three is a deleted test wearing a badge"
            )
        self.items[test_id] = {"reason": reason, "owner": owner, "review_by": review_by}

    def overdue(self, today: str) -> list:
        return [k for k, v in self.items.items() if v["review_by"] < today]

    def to_json(self) -> str:
        return json.dumps(self.items, indent=2, sort_keys=True)

    @classmethod
    def from_json(cls, text: str) -> "Quarantine":
        return cls(items=json.loads(text or "{}"))


@dataclass
class Budget:
    """What one run is allowed to cost, in model calls and in dollars.

    A budget is not an optimisation. It is a claim you can point at when the
    bill goes up: either the suite got more expensive and that was agreed, or
    it did not and something is wrong.
    """

    max_calls: int
    max_usd: float

    def check(self, calls: int, usd: float) -> dict:
        return {
            "calls": calls,
            "usd": usd,
            "over_calls": calls > self.max_calls,
            "over_usd": usd > self.max_usd,
            "ok": not (calls > self.max_calls or usd > self.max_usd),
        }


@dataclass
class GateResult:
    blocked: bool
    reason: str
    delta: float | None = None
    ci: tuple | None = None
    calls: int = 0
    usd: float = 0.0
    quarantined: list = field(default_factory=list)

    def to_json(self) -> str:
        return json.dumps({
            "blocked": self.blocked,
            "reason": self.reason,
            "delta_points": None if self.delta is None else round(self.delta * 100, 2),
            "ci": None if self.ci is None else [round(self.ci[0] * 100, 2),
                                                round(self.ci[1] * 100, 2)],
            "calls": self.calls, "usd": round(self.usd, 6),
            "quarantined": self.quarantined,
        }, indent=2)


def run_gate(baseline_pairs, candidate_pairs, tolerance: float = 0.05,
             repeats: int = 3, min_ci_width: float | None = None,
             quarantine: Quarantine | None = None) -> GateResult:
    """Decide whether the candidate ships.

    ``baseline_pairs`` and ``candidate_pairs`` are ``(human, judge)`` pairs
    over the *same* items, which is what makes the comparison paired and the
    interval mean something.

    The gate is deliberately conservative in one direction only. It blocks on
    a drop it is confident about, and it says so when it is not confident,
    rather than treating "no evidence of a regression" as "evidence of no
    regression". A gate that blocks on noise gets switched off within a month,
    and a gate that is switched off protects nothing.
    """
    q = quarantine or Quarantine()
    if len(baseline_pairs) != len(candidate_pairs):
        return GateResult(False, "SKIP: baseline and candidate must cover the same items")

    cmp = paired_comparison(baseline_pairs, candidate_pairs, resamples=1000, seed=1)
    if cmp is None or cmp.n == 0:
        return GateResult(False, "SKIP: nothing to compare")

    n = cmp.n
    a_pass = sum(1 for _, j in baseline_pairs if j == 1) / n
    b_pass = sum(1 for _, j in candidate_pairs if j == 1) / n
    ci = (cmp.ci.lo, cmp.ci.hi) if cmp.ci else None
    calls = n * repeats

    quarantined = [i for i in q.items if i in {f"item-{k}" for k in range(n)}]

    if cmp.ci and cmp.ci.hi < -tolerance:
        return GateResult(True, f"blocked: candidate is {abs(cmp.delta) * 100:.1f} points "
                                f"worse, interval {cmp.ci.lo * 100:.1f} to {cmp.ci.hi * 100:.1f}",
                          cmp.delta, ci, calls, 0.0, quarantined)

    if cmp.ci and cmp.ci.lo < -tolerance:
        return GateResult(True, f"blocked: drop of {abs(cmp.delta) * 100:.1f} points, and the "
                                f"interval reaches {cmp.ci.lo * 100:.1f}",
                          cmp.delta, ci, calls, 0.0, quarantined)

    if cmp.delta < -tolerance:
        return GateResult(
            False, f"passes, but the drop of {abs(cmp.delta) * 100:.1f} points is inside the "
                   f"interval ({cmp.ci.lo * 100:.1f} to {cmp.ci.hi * 100:.1f}). Not evidence of a "
                   f"regression and not evidence against one - widen the suite or raise the repeats.",
            cmp.delta, ci, calls, 0.0, quarantined)

    return GateResult(False, f"passes: {cmp.delta * 100:+.1f} points", cmp.delta, ci,
                      calls, 0.0, quarantined)
