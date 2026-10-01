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

from .stats import paired_comparison


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
             repeats: int = 3, cost_per_call: float = 0.0,
             quarantine: Quarantine | None = None,
             quarantined_ids: list | None = None) -> GateResult:
    """Decide whether the candidate ships.

    ``baseline_pairs`` and ``candidate_pairs`` are ``(human, judge)`` pairs
    over the *same* items, which is what makes the comparison paired and the
    interval mean something.

    **The decision is a point estimate, and that is the whole point.** A gate
    fires when the candidate's pass rate is more than ``tolerance`` points
    below the current build's — that is the rule lesson 10.3 prices, and it
    is the rule ``stats.simulate_gate`` already implements. The bootstrap
    interval is *reported next to the decision*, not the decision itself.

    An earlier version of this function gated on the interval instead. It
    looked more rigorous and was worse: a percentile bootstrap of a sample
    mean puts its 2.5th percentile below the point estimate almost always,
    so the gate fired on nearly every drop and the tolerance stopped mattering.
    Sweeping 192 configurations of the real data, that version blocked a
    ten-point regression at every tolerance from 2 to 15 points.

    ``drop`` here is *baseline minus candidate*, so **positive means the
    candidate is worse**. It is computed from the pass rates directly rather
    than from ``paired_comparison``'s delta, because that function returns
    ``A - B`` and an earlier version of this file passed baseline first,
    which inverted every branch. The reason strings use ``abs`` nowhere on a
    signed quantity for that reason.

    Three outcomes, because "not blocked" and "fine" are different claims:

    * ``drop > tolerance`` — blocked
    * ``0 < drop <= tolerance`` — passes, with a warning naming the drop
    * ``drop <= 0`` — passes
    """
    q = quarantine or Quarantine()
    if len(baseline_pairs) != len(candidate_pairs):
        return GateResult(False, "SKIP: baseline and candidate must cover the same items")

    n = len(baseline_pairs)
    if n == 0:
        return GateResult(False, "SKIP: nothing to compare")

    base_rate = sum(1 for _, j in baseline_pairs if j == 1) / n
    cand_rate = sum(1 for _, j in candidate_pairs if j == 1) / n
    drop = base_rate - cand_rate                     # positive = candidate worse
    calls = n * repeats
    usd = calls * cost_per_call
    quarantined = [t for t in (quarantined_ids or []) if q.is_quarantined(t)]

    # The interval is reported, not obeyed. Candidate first, so a worse
    # candidate gives a negative delta and the sign reads the same way.
    cmp = paired_comparison(candidate_pairs, baseline_pairs, resamples=1000, seed=1)
    ci = (cmp.ci.lo, cmp.ci.hi) if (cmp and cmp.ci) else None
    width = None if ci is None else round((ci[1] - ci[0]) * 50, 1)   # half-width, points

    def result(blocked: bool, reason: str) -> GateResult:
        return GateResult(blocked, reason, -drop, ci, calls, usd, quarantined)

    ci_text = (f"; paired 95% interval {ci[0] * 100:+.1f} to {ci[1] * 100:+.1f} points "
               f"(half-width {width:+.1f})" if ci else "")

    if drop > tolerance:
        return result(True, f"blocked: candidate is {drop * 100:.1f} points below the current "
                             f"build, over the {tolerance * 100:.0f}-point tolerance{ci_text}")

    if drop > 0:
        return result(False, f"passes, but the candidate is {drop * 100:.1f} points worse, inside "
                             f"the {tolerance * 100:.0f}-point tolerance. A real drop that you have "
                             f"chosen to allow{ci_text}")

    return result(False, f"passes: {abs(drop) * 100:.1f} points "
                         f"{'better' if drop < 0 else 'level'}{ci_text}")
