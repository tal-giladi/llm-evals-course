"""Lab 1 — a gate that blocks a planted regression, and one that does not block everything.

The failure this lab exists to fix: a suite that goes green while something
real is broken, and a team that finds out about it in production.

Two halves, and the second half is the one people skip:

* **plant a regression and prove the gate blocks it**, and
* **run a healthy build twice and prove the gate stays quiet.**

A gate that only does the first is a coin with a label. A gate that only does
the second is a gate that is not there.

``evallab.gate.run_gate`` is already written and is what the numbers come from.
What is missing is the *policy*, and it is two functions. As shipped, this gate
has two answers — green and red — and a two-answer gate cannot say the thing
that matters: that the candidate went down, that the drop is inside the
tolerance, and that nobody has proved there was not a regression.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]                      # the course root
for _p in (REPO / "labs" / "common", HERE):
    if _p.is_dir() and str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from evallab import load, mulberry32, pct                     # noqa: E402
from evallab.gate import Quarantine, run_gate                 # noqa: E402
from evallab.stats import majority_vote                       # noqa: E402

# The three answers a gate can give. The middle one is the one this lab is for.
BLOCKED = "blocked"
WARNING = "pass-with-warning"
PASS = "pass"
SKIP = "skip"

JUDGE = "c-rubric-3b"
VARIANT = "v1"


# --------------------------------------------------------------------------
# The gate specification — lesson 10.3's four numbers, with a name for each
# --------------------------------------------------------------------------


@dataclass
class Spec:
    """What this gate is, in the words a reviewer can argue with.

    ``tolerance`` is the only field the code reads. The other four are the
    sentence the tolerance is supposed to be a decision inside, and they are
    the part of this file that belongs in the pull request.
    """

    tolerance: float = 0.05                  # points of pass rate the gate absorbs
    repeats: int = 3
    items: int = 94                          # the frozen set. A gate on a moving set is not a gate.
    judge: str = JUDGE
    variant: str = VARIANT
    half_width: str = ""                     # "±13.3 pts (94 items, 3 repeats)"
    accepted_false_alarms: str = ""          # "1 in 10 healthy builds"
    accepted_misses: str = ""                # "4 breaks in 10, for the regression named below"
    must_catch: str = ""                     # the regression, named, in words
    quarantine: Quarantine | None = None

    def to_json(self) -> dict:
        return {
            "tolerance_points": round(self.tolerance * 100, 2),
            "repeats": self.repeats,
            "items": self.items,
            "judge": self.judge,
            "variant": self.variant,
            "measurement_half_width": self.half_width,
            "accepted_false_alarm_rate": self.accepted_false_alarms,
            "accepted_miss_rate": self.accepted_misses,
            "must_catch": self.must_catch,
        }


@dataclass
class Verdict:
    """What CI acts on, and what the pull-request comment is built from."""

    status: str
    reason: str
    drop: float
    ci: tuple | None = None
    calls: int = 0
    usd: float = 0.0
    quarantined: list = field(default_factory=list)
    spec: Spec | None = None

    @property
    def blocked(self) -> bool:
        return self.status == BLOCKED

    @property
    def exit_code(self) -> int:
        return 1 if self.blocked else 0

    def to_json(self) -> str:
        return json.dumps({
            "status": self.status,
            "blocked": self.blocked,
            "reason": self.reason,
            "drop_points": round(self.drop * 100, 2),
            "interval": None if self.ci is None else
                        [round(self.ci[0] * 100, 2), round(self.ci[1] * 100, 2)],
            "calls": self.calls,
            "usd": round(self.usd, 6),
            "quarantined": self.quarantined,
            "spec": None if self.spec is None else self.spec.to_json(),
        }, indent=2)

    def __str__(self) -> str:
        q = "" if not self.quarantined else \
            f"  [{len(self.quarantined)} quarantined: {', '.join(self.quarantined)}]"
        return f"{self.status.upper()}: {self.reason}{q}"


# --------------------------------------------------------------------------
# One judge run of one build
# --------------------------------------------------------------------------


def frozen_items(data, spec: Spec) -> list:
    """The item set the gate is allowed to look at, in a fixed order.

    Frozen and ordered, because a gate that re-samples its own item list is
    measuring a different suite every run and will be argued with forever.
    """
    return list(data.items)[: spec.items]


def judge_run(data, items, spec: Spec, seed: int | None = 0, broken=()) -> list:
    """One pass of the judge over every item, as ``(human, judge)`` pairs.

    With ``seed=None`` the verdict for an item is a plain majority over the
    first ``spec.repeats`` recorded samples — the run that is already in the
    cache, identical every time, and the one a gate compares against. With a
    seed it is a majority over ``spec.repeats`` samples drawn at random from
    the recorded ones, which is what run-to-run noise *is*: the same question
    asked three times, to a judge that is not deterministic.

    A candidate with no ``broken`` items is a healthy build. One with a block
    of them is the same build after a change that broke a category of
    question.
    """
    rng = None if seed is None else mulberry32(seed)
    broken = set(broken)
    pairs = []
    for it in items:
        samples = data.runs[spec.judge][f"{it.id}|{spec.variant}"]
        if rng is None:
            used = samples[: spec.repeats]
        else:
            used = [samples[rng.randrange(len(samples))] for _ in range(spec.repeats)]
        verdict = int(majority_vote(used) or 0)
        if it.id in broken:
            verdict = 0
        pairs.append((it.label(spec.variant), verdict))
    return pairs


def price_per_call(data, judge_id: str) -> float:
    """The lab's own price sheet: what one verdict of this judge costs.

    Lesson 11.3's number for the same judge. It is a recorded price for the
    course's educational model, not a bill from a provider.
    """
    return float((data.cost or {}).get(judge_id, {}).get("cost_usd", 0.0))


def plant_block(items, baseline_pairs=None, fraction: float = 0.1) -> tuple:
    """The regression a real change leaves behind.

    A tenth of the list, exactly as lesson 10.3's simulator plants it, because
    a real regression breaks a category of question rather than one unlucky
    item.

    Two things about that sentence that are worth a whole lab each:

    * **A tenth of the list is not a tenth of the pass rate.** The block lands
      on whichever items are at the front, and those items carry different
      amounts of the pass rate at every suite size. That is why the grid below
      shows the same block costing 8.6 points on 20 items and 3.9 on 94.
    * **Breaking an item the judge already failed costs nothing.** Pass the
      baseline in and the block is drawn from the items the baseline *passed*,
      which is the only way a plant is guaranteed to be a real regression. A
      gate that counted edits rather than passes would report one anyway.

    Without ``baseline_pairs`` the block is the first tenth of the list, which
    is the honest simulation and the one that reproduces lesson 10.3's grid.
    """
    k = max(1, round(len(items) * fraction))
    if baseline_pairs is None:
        return tuple(it.id for it in items[:k])
    passing = [it.id for it, (_, v) in zip(items, baseline_pairs) if v == 1]
    return tuple(passing[:k])


def drop_points(baseline_pairs, candidate_pairs) -> float:
    """How far below the current build the candidate sits, in pass-rate points.

    Positive means the candidate is worse. This is the quantity lesson 10.3's
    gate is written on: *fire when the candidate's pass rate is more than T
    points below the current build's, on the same items.*
    """
    n = min(len(baseline_pairs), len(candidate_pairs))
    if n == 0:
        return 0.0
    base = sum(1 for _, v in baseline_pairs[:n] if v == 1) / n
    cand = sum(1 for _, v in candidate_pairs[:n] if v == 1) / n
    return base - cand


# --------------------------------------------------------------------------
# 1. The rule, in one line
# --------------------------------------------------------------------------


def status_for(drop: float, tolerance: float) -> str:
    """The whole gate, as a function of the drop and the tolerance.

    Three answers:

    TODO 1: this has two and it needs three.
    * ``BLOCKED``  - the candidate is more than ``tolerance`` points down.
    * ``WARNING``  - the candidate is down, but by less than the tolerance.
      This is neither a clean pass nor a block, and it is the answer a gate
      that only has a green light cannot give. The suite did not prove a
      regression, and it did not prove there was not one.
    * ``PASS``     - the candidate is level or better.

    The tolerance is the knob. Everything else on the page is the width of the
    measurement the number was taken from.
    """
    if drop > tolerance:
        return BLOCKED
    return PASS


# --------------------------------------------------------------------------
# 2. One run of it
# --------------------------------------------------------------------------


def decide(baseline_pairs, candidate_pairs, spec: Spec,
           quarantined_ids=(), cost_per_call: float = 0.0) -> Verdict:
    """Run the gate once and say what happened, in words and in numbers.

    ``run_gate`` is already written: it does the paired comparison, the
    bootstrap, the interval, the quarantine and the reason text. What is left
    is the decision, and this is it as it usually gets written: two answers,
    green and red.

    TODO 1: a gate has three answers, not two. A drop that is real and smaller
            than the tolerance is not a pass — it is a pass you do not
            believe, and the difference has to survive into the status, the
            reason and the exit code, because a pull-request comment that says
            "passes" is read as "fine".
    TODO 2: the reason has to name the drop *and* the interval it was measured
            against. A tolerance printed without the width of the measurement
            it is applied to is not a decision anybody can review.
    """
    result = run_gate(baseline_pairs, candidate_pairs,
                      tolerance=spec.tolerance, repeats=spec.repeats,
                      cost_per_call=cost_per_call,
                      quarantine=spec.quarantine,
                      quarantined_ids=list(quarantined_ids))
    drop = drop_points(baseline_pairs, candidate_pairs)

    if result.blocked:
        status, reason = BLOCKED, f"candidate is {drop * 100:.1f} points below the current build."
    else:
        status = PASS
        reason = f"passes: {-drop * 100:+.1f} points."

    return Verdict(status=status, reason=reason, drop=drop, ci=result.ci,
                   calls=result.calls, usd=result.usd,
                   quarantined=result.quarantined, spec=spec)


# --------------------------------------------------------------------------
# 3. Both ways it can be wrong, for a whole grid
# --------------------------------------------------------------------------


def price_gate(data=None, sizes=(20, 40, 94), repeats=(1, 3, 5),
               tolerance: float = 0.05, trials: int = 400, seed: int = 7000) -> list:
    """Price this gate in both of its failure modes, one cell at a time.

    A false alarm is two healthy judge runs of the same code, and the gate
    firing anyway. A missed regression is the same pair with a block of the
    item list broken, and the gate staying quiet. Both sides are fresh draws
    on every trial, so the rate is a property of the gate and not of one lucky
    run.

    This prices ``status_for`` — the rule written above — rather than
    ``simulate_gate``'s, because a grid is a price list for the gate you
    actually wrote.
    """
    data = data or load("support")
    rows = []
    for size in sizes:
        items = list(data.items)[:size]
        block = plant_block(items)
        for r in repeats:
            spec = Spec(items=size, repeats=r, tolerance=tolerance)
            healthy_fa = healthy_drop = broken_drop = 0.0
            missed = 0
            for t in range(trials):
                base = judge_run(data, items, spec, seed=seed + t)
                same = judge_run(data, items, spec, seed=seed + 500 + t)
                broke = judge_run(data, items, spec, seed=seed + 500 + t, broken=block)
                d_same = drop_points(base, same)
                d_broke = drop_points(base, broke)
                healthy_fa += status_for(d_same, tolerance) == BLOCKED
                healthy_drop += d_same
                broken_drop += d_broke
                missed += status_for(d_broke, tolerance) != BLOCKED
            rows.append({
                "items": size, "repeats": r, "block": len(block),
                "false_alarm_rate": healthy_fa / trials,
                "missed_rate": missed / trials,
                "mean_drop_healthy": healthy_drop / trials,
                "mean_drop_broken": broken_drop / trials,
            })
    return rows


def print_grid(rows) -> None:
    print(f"{'items':>6} {'repeats':>8} {'block':>6} {'false alarms':>13} "
          f"{'missed':>8} {'the block costs':>16}")
    for r in rows:
        print(f"{r['items']:>6} {r['repeats']:>8} {r['block']:>6} "
              f"{pct(r['false_alarm_rate']):>13} {pct(r['missed_rate']):>8} "
              f"{r['mean_drop_broken'] * 100:>15.2f} pts")


def print_sweep(data, tolerances, items: int = 94, repeats: int = 3,
                trials: int = 400) -> None:
    """The tolerance knob on its own, at one size and one repeat count.

    One column falls and the other rises, and the crossing point is the only
    place on the page where the team's two risks are balanced. Everywhere else
    is a decision about which mistake they would rather make.

    Run this before and after you change `status_for` — a two-answer gate
    prices as if every non-block were a pass, and the missed column below is
    the number it gets wrong.
    """
    print(f"{'tolerance':>10} {'false alarms':>13} {'missed':>8}   "
          f"({items} items, {repeats} repeats, {trials} trials)")
    for t in tolerances:
        row = price_gate(data, sizes=(items,), repeats=(repeats,),
                         tolerance=t, trials=trials)[0]
        print(f"{t * 100:>9.0f}p {pct(row['false_alarm_rate']):>13} "
              f"{pct(row['missed_rate']):>8}")


# --------------------------------------------------------------------------
# The run a CI job actually makes
# --------------------------------------------------------------------------


def load_quarantine(path=None) -> Quarantine:
    path = Path(path) if path else HERE / "quarantine.json"
    return Quarantine.from_json(path.read_text(encoding="utf-8") if path.exists() else "{}")


DEFAULT_SPEC = Spec(
    tolerance=0.05, repeats=3, items=94,
    # Every string below is a measured number from this lab on this dataset,
    # not a number carried over from a lesson. `py gate_lab.py --grid` prints
    # the two rates; the half-width is the median of 40 healthy re-runs.
    half_width="median 6.4 points on a healthy re-run (94 items, 3 repeats, "
               "judge c-rubric-3b). One item is 1.06 points.",
    accepted_false_alarms="9.0% of healthy builds, at this tolerance "
                          "(400 trials, `gate_lab.py --grid`)",
    accepted_misses="50.5% of a break of one question in ten, planted as the "
                    "first tenth of the item list",
    must_catch="a change that breaks one question in ten. Planted as the first "
               "tenth of the list that costs 4.87 points; planted across the 52 "
               "questions this build passes it costs 9.57.",
)


def run_pipeline(data=None, spec: Spec = None, seed: int = 4242, plant=True) -> Verdict:
    """Baseline against a candidate build, on the frozen set, once.

    The baseline is the recorded run the cache already holds — identical every
    time, which is the only reason a gate can compare against it. The
    candidate is a fresh judge run of the code in the pull request.

    With ``plant`` the candidate carries a block of the items the baseline
    passed, which is the regression the gate exists to catch. Without it, the
    candidate is the same healthy code scored again, and that is the run which
    must not block anything.
    """
    data = data or load("support")
    spec = spec or DEFAULT_SPEC
    spec.quarantine = spec.quarantine or load_quarantine()
    items = frozen_items(data, spec)
    baseline = judge_run(data, items, spec, seed=None)
    block = plant_block(items, baseline) if plant else ()
    candidate = judge_run(data, items, spec, seed=seed, broken=block)
    return decide(baseline, candidate, spec,
                  quarantined_ids=[it.id for it in items],
                  cost_per_call=price_per_call(data, spec.judge))


def main(argv=None) -> int:
    import argparse
    p = argparse.ArgumentParser(description="Run the regression gate once.")
    p.add_argument("--out", default="gate.json", help="where the verdict JSON goes")
    p.add_argument("--tolerance", type=float, default=DEFAULT_SPEC.tolerance)
    p.add_argument("--repeats", type=int, default=DEFAULT_SPEC.repeats)
    p.add_argument("--seed", type=int, default=4242)
    p.add_argument("--grid", action="store_true",
                   help="price the gate in both failure modes and exit")
    p.add_argument("--sweep", action="store_true",
                   help="sweep the tolerance knob on its own and exit")
    p.add_argument("--trials", type=int, default=400,
                   help="trials per cell for --grid and --sweep (default 400)")
    args = p.parse_args(argv)

    data = load("support")
    if args.sweep:
        print_sweep(data, (0.0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.08, 0.10, 0.15),
                    trials=args.trials)
        return 0
    if args.grid:
        print_grid(price_gate(data, tolerance=args.tolerance, trials=args.trials))
        return 0

    spec = Spec(tolerance=args.tolerance, repeats=args.repeats, items=DEFAULT_SPEC.items,
                half_width=DEFAULT_SPEC.half_width,
                accepted_false_alarms=DEFAULT_SPEC.accepted_false_alarms,
                accepted_misses=DEFAULT_SPEC.accepted_misses,
                must_catch=DEFAULT_SPEC.must_catch)
    broken = run_pipeline(data, spec, seed=args.seed, plant=True)
    healthy = run_pipeline(data, spec, seed=args.seed, plant=False)

    print("planted regression :", broken)
    print("healthy re-run     :", healthy)
    Path(args.out).write_text(broken.to_json(), encoding="utf-8")
    print(f"wrote {args.out}")
    return broken.exit_code


if __name__ == "__main__":
    raise SystemExit(main())
