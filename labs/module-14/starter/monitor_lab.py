"""Lab 1 — a monitor that is not crying wolf.

The failure this lab exists to fix: an alert fires on day one because last
week's traffic is not this week's traffic, and by the end of the month nobody
believes the monitor at all. The signal it was built to carry is gone, and it
was never replaced — it was just ignored.

Two halves, and the second half is the one people skip:

* **set the band**, from the interval, so it is a decision and not a mood, and
* **price it**, so the team knows what it costs at the sample size it actually
  runs at.

``evallab.online.Band`` is already written: it holds the baseline, the window
size and a sensitivity, and it computes the Wilson interval that measurement was
taken from. What it will not do is refuse. A band five points wide on twenty
requests is a band that fires on luck, and the only way to find that out is to
compare the band against the half-width **before** you ship it.

``price_band`` is the same move as module 13's ``price_gate``: it runs the rule
you wrote over many windows and prints what it costs, so the number on the
dashboard and the number on-call acted on are about the same band.

Three TODOs, and they are all one decision:

    TODO 1: ``Monitor.usable`` - the check. Compare the sensitivity against the
            measurement's own half-width and hand back a bool.
    TODO 2: ``status_for`` - the rule. It has two answers and it needs three.
    TODO 3: ``observe`` - the sentence, including the one ``Band.explain``
            already knows how to print and nobody reads.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]                      # the course root
for _p in (REPO / "labs" / "common", HERE):
    if _p.is_dir() and str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from evallab import Band, load, mix, pct, psi                    # noqa: E402
from evallab.stats import majority_vote, mulberry32             # noqa: E402

# The three answers a monitor can give. The first one is the one this lab is for.
REFUSED = "refused"
FIRES = "fires"
QUIET = "quiet"

JUDGE = "c-rubric-3b"
VARIANT = "v1"
REPEATS = 3
TRAFFIC = 94                              # the frozen list, which stands in for
                                          # a month of production requests


# --------------------------------------------------------------------------
# The monitor, and the interval its band has to survive
# --------------------------------------------------------------------------


@dataclass
class Monitor:
    """A number, a window, and the band it is willing to wake somebody for.

    ``baseline`` is the healthy pass rate. ``n`` is how many requests land in
    one window. ``sensitivity`` is how far from the baseline the rate has to
    move before the monitor has an opinion.

    The last one is the interesting one. It is the only field an engineer picks
    by feel, and it is the only field the other two decide for you: at ``n=20``
    a baseline near 0.55 has a Wilson half-width of **0.20**, so a five-point
    band is a quarter of the uncertainty it is being compared against.
    """

    metric: str = "pass rate"
    baseline: float = 0.0
    n: int = 20
    sensitivity: float = 0.05
    judge: str = JUDGE
    variant: str = VARIANT
    repeats: int = REPEATS

    @property
    def band(self) -> Band:
        return Band(self.metric, self.baseline, self.n, sensitivity=self.sensitivity)

    @property
    def half_width(self) -> float:
        """How far this measurement can be wrong on its own, at this ``n``."""
        return self.band.half_width

    # TODO 1: there is no `usable` here yet, and that is the bug.
    #
    #   `usable` is the check the whole lab is about: is the band at least as
    #   wide as the measurement's own error? At n=20 around a baseline of 0.55
    #   the half-width is 0.200 and a five-point band is a quarter of it.
    #
    #   `Band.explain` already knows how to print the consequence — "the band
    #   is narrower than the measurement's own half-width, so it will fire on
    #   noise" — and right now nothing in this file ever asks the question.

    def spec(self) -> dict:
        return {
            "metric": self.metric,
            "baseline": round(self.baseline, 4),
            "n": self.n,
            "sensitivity": round(self.sensitivity, 4),
            "band": [round(self.band.lower, 4), round(self.band.upper, 4)],
            "half_width": round(self.half_width, 4),
            # TODO 1: this comparison is duplicated here on purpose only so the
            # starter runs. Replace it with `self.usable` once it exists.
            "usable": self.sensitivity >= self.half_width,
        }


# --------------------------------------------------------------------------
# 1. The rule, in one function
# --------------------------------------------------------------------------


def status_for(monitor: Monitor, value: float) -> str:
    """The whole monitor, as a function of the number it was handed.

    Two answers, and the missing one is the whole of module 14.3:

    * ``FIRES`` — the value is outside the band.
    * ``QUIET`` — the value is inside it.

    TODO 2: a monitor has three answers, not two.

            ``REFUSED`` — the band is narrower than the measurement's own
            half-width. The monitor cannot answer its question at this window
            size, so it says so instead of firing. It is not a quiet day and it
            is not a bad day; it is a day on which the number was not a
            measurement of anything.

            This is not a nicety. A monitor that fires on noise is not a
            sensitive monitor, it is a broken one, and it is worse than no
            monitor at all: after a fortnight of pages nobody reads the page
            that matters. `price_band` below already knows how to price it —
            the `refused` column is zero on every row until you write this.
    """
    return FIRES if monitor.band.fires(value) else QUIET


# --------------------------------------------------------------------------
# 2. One run of it
# --------------------------------------------------------------------------


@dataclass
class Verdict:
    """What the on-call engineer is shown, and what the JSON file carries."""

    status: str
    reason: str
    value: float
    monitor: Monitor

    @property
    def fires(self) -> bool:
        return self.status == FIRES

    @property
    def exit_code(self) -> int:
        """1 wakes somebody. A refusal is a build problem, not a page."""
        return 1 if self.fires else 0

    def to_json(self) -> str:
        return json.dumps({
            "status": self.status,
            "fires": self.fires,
            "exit_code": self.exit_code,
            "reason": self.reason,
            "value": round(self.value, 4),
            "spec": self.monitor.spec(),
        }, indent=2)

    def __str__(self) -> str:
        return f"{self.status.upper()}: {self.reason}"


def observe(monitor: Monitor, value: float) -> Verdict:
    """Run the monitor once and say what happened, in words and in numbers.

    TODO 3: the reason is a status and two numbers, which is the shape every
            monitoring tool prints and the shape nobody can act on.

            TODO 3a: the reason has to name the baseline, the window size and
                     the Wilson interval the value was measured against. A band
                     printed without the width of the measurement is a number,
                     not a decision.

            TODO 3b: when the band is narrower than the half-width, say so — and
                     say what would change it. `Band.explain` already has the
                     sentence: "The band is narrower than the measurement's own
                     half-width, so it will fire on noise." The missing part is
                     the decision attached to it. A monitor that prints that
                     sentence and then fires anyway is the bug this lab is
                     about.
    """
    status = status_for(monitor, value)
    reason = (f"{monitor.metric} is {value:.3f} against a baseline of "
              f"{monitor.baseline:.3f} on n={monitor.n}; the band is "
              f"{monitor.band.lower:.3f}-{monitor.band.upper:.3f}.")
    return Verdict(status=status, reason=reason, value=value, monitor=monitor)


# --------------------------------------------------------------------------
# 3. What one window of production traffic actually is
# --------------------------------------------------------------------------


def draw_window(data, monitor: Monitor, size: int, seed: int) -> list:
    """One window of ``size`` production requests, as ``(id, human, judge)``.

    Each request is an item drawn from the frozen list and scored by a fresh
    draw of the recorded judge samples — the same question asked again, to a
    judge that is not deterministic. Items repeat once ``size`` passes the list
    length, because a real request stream repeats topics and because a
    binomial window is the model the Wilson half-width is built for.

    Everything else is the shipped code and the shipped recorded runs. What is
    simulated is the *arrival*, and the docstring above is where you would look
    if you wanted a different arrival process.
    """
    pool = list(data.items)[:TRAFFIC]
    rng = mulberry32(seed)
    out = []
    for _ in range(size):
        it = pool[rng.randrange(len(pool))]
        samples = data.runs[monitor.judge][f"{it.id}|{monitor.variant}"]
        used = [samples[rng.randrange(len(samples))] for _ in range(monitor.repeats)]
        out.append((it.id, it.label(monitor.variant), int(majority_vote(used) or 0)))
    return out


def pass_rate(window) -> float:
    return sum(1 for _, _, v in window if v == 1) / len(window) if window else 0.0


def break_window(window, fraction: float = 0.1) -> list:
    """The same window with a tenth of the requests broken.

    Taken from the requests the judge *passed*, so it is a real regression and
    not a bookkeeping one: breaking a request the judge had already failed costs
    the pass rate nothing, and a monitor that reported that would be one you
    would have to learn to ignore.
    """
    k = max(1, round(len(window) * fraction))
    hit, out = 0, []
    for entry in window:
        if entry[2] == 1 and hit < k:
            hit += 1
            out.append((entry[0], entry[1], 0))
        else:
            out.append(entry)
    return out


def baseline_pass_rate(data, judge: str = JUDGE, variant: str = VARIANT,
                       repeats: int = REPEATS, trials: int = 200,
                       seed: int = 8700) -> float:
    """The healthy pass rate, measured off the recorded judge rather than typed.

    A mean over ``trials`` fresh runs of the whole traffic list. Deliberately
    *not* the first few recorded samples: that is one particular draw, and a
    monitor centred on one particular draw is a monitor whose baseline is
    wherever the judge's recorded ordering happens to start.
    """
    monitor = Monitor(judge=judge, variant=variant, repeats=repeats)
    total = sum(pass_rate(draw_window(data, monitor, TRAFFIC, seed + t))
                for t in range(trials))
    return total / trials


# --------------------------------------------------------------------------
# 4. The price list: the same rule, over many windows
# --------------------------------------------------------------------------


def price_band(data=None, sizes=(20, 50, 94, 200, 400), sensitivity: float = 0.05,
               break_fraction: float = 0.1, trials: int = 400,
               seed: int = 8800) -> list:
    """Price this monitor in both of its failure modes, one window size at a time.

    Two columns, and they are the only two questions about a monitor:

    * **false alarms** — how many healthy windows the band fires on. This is the
      column that ends the project when it gets big.
    * **missed** — how many windows carrying a real, tenth-of-the-window
      regression the band does *not* fire on.

    Both are measured against the **raw** band, not against ``status_for``, on
    purpose. A band that ``status_for`` refuses is not a monitor that never
    fires; it is a monitor that was never switched on. The cost of the refusal
    is the whole of what the band would have done, so that is what the table has
    to show.
    """
    data = data or load("support")
    base = baseline_pass_rate(data)
    rows = []
    for size in sizes:
        monitor = Monitor(metric="pass rate", baseline=base, n=size,
                          sensitivity=sensitivity)
        alarms = missed = refused = 0
        drop = 0.0
        for t in range(trials):
            window = draw_window(data, monitor, size, seed + t)
            rate = pass_rate(window)
            refused += status_for(monitor, rate) == REFUSED
            alarms += monitor.band.fires(rate)

            broken = pass_rate(break_window(window, break_fraction))
            drop += rate - broken
            missed += not monitor.band.fires(broken)

        rows.append({
            "n": size,
            "baseline": base,
            "half_width": monitor.half_width,
            "sensitivity": sensitivity,
            "refused_rate": refused / trials,
            "false_alarm_rate": alarms / trials,
            "missed_rate": missed / trials,
            "mean_drop_broken": drop / trials,
        })
    return rows


def print_price(rows) -> None:
    print(f"{'n':>5} {'half-width':>11} {'band':>6} {'usable':>7} "
          f"{'refused':>8} {'false alarms':>13} {'missed':>8} {'a real drop costs':>19}")
    for r in rows:
        usable = r["sensitivity"] >= r["half_width"]
        print(f"{r['n']:>5} {r['half_width']:>11.3f} {r['sensitivity']:>6.2f} "
              f"{('yes' if usable else 'NO'):>7} {pct(r['refused_rate']):>8} "
              f"{pct(r['false_alarm_rate']):>13} {pct(r['missed_rate']):>8} "
              f"{r['mean_drop_broken'] * 100:>18.2f} pts")


# --------------------------------------------------------------------------
# 5. Drift: the reason the band moved in the first place
# --------------------------------------------------------------------------


def intent_of(item) -> str:
    return (item.slice or {}).get("intent", "unknown")


def dev_mix(data) -> dict:
    """The mix the eval set was built from — the baseline distribution."""
    return mix(data.items_for("dev"), intent_of)


def shift(baseline_mix: dict, kind: str) -> dict:
    """One week later. Five windows, every one of them something that happened.

    ``same``       the mix, re-sampled. The control, and the number a reader
                   should expect to be zero before reading anything else.
    ``thinned``    one category halves and the rest take its share.
    ``vanished``   a category stops arriving. This is the one PSI is for: the
                   thing that disappeared is exactly what you want to be told
                   about, and a monitor on the pass rate will not tell you,
                   because a pass rate does not know what it was asked.
    ``collapsed``  everything piles onto one category.
    ``new_intent`` a category shows up from nowhere at a tenth of traffic.
    """
    if kind == "same":
        return dict(baseline_mix)
    if kind == "thinned":
        return {k: (v / 2 if k == "policy_fact" else v * 1.18)
                for k, v in baseline_mix.items()}
    if kind == "vanished":
        without = {k: v for k, v in baseline_mix.items() if k != "exception"}
        total = sum(without.values())
        return {k: v / total for k, v in without.items()}
    if kind == "collapsed":
        others = len(baseline_mix) - 1
        return {k: (0.70 if k == "policy_fact" else 0.30 / others)
                for k in baseline_mix}
    if kind == "new_intent":
        return {**{k: v * 0.9 for k, v in baseline_mix.items()}, "new_intent": 0.10}
    raise ValueError(f"unknown window {kind!r}; one of same, thinned, vanished, "
                     "collapsed, new_intent")


def reading(value: float) -> str:
    """The usual reading of a PSI. Three words, and the third one is an action."""
    if value < 0.1:
        return "stable"
    if value < 0.25:
        return "worth a look"
    return "assume something moved"


LABELS = {
    "same": "the same mix, re-sampled",
    "thinned": "one category thinned by half",
    "vanished": "a category stops arriving",
    "collapsed": "everything collapses onto one category",
    "new_intent": "a new category appears at 10%",
}


def psi_table(data=None, windows=("same", "thinned", "vanished", "collapsed",
                                  "new_intent")) -> list:
    """Take the shipped dev mix and move it, one way at a time.

    ``psi`` is already written and correct. The point of the table is that the
    pass rate did not have to move for any of this to happen, and the first row
    is the one that earns the rest: a window that has not changed reads 0.000.
    """
    data = data or load("support")
    base = dev_mix(data)
    rows = []
    for k in windows:
        value = psi(base, shift(base, k))
        rows.append({"window": k, "label": LABELS[k], "psi": value,
                     "reading": reading(value)})
    return rows


def print_psi(rows) -> None:
    print(f"{'window':>38} {'psi':>6}   reading")
    for r in rows:
        print(f"{r['label']:>38} {r['psi']:>6.3f}   {r['reading']}")


# --------------------------------------------------------------------------
# The run a monitoring job actually makes
# --------------------------------------------------------------------------


DEFAULT_SIZES = (20, 50, 94, 200, 400)


def main(argv=None) -> int:
    import argparse
    p = argparse.ArgumentParser(description="Run the monitor once, and price it.")
    p.add_argument("--sensitivity", type=float, default=0.05,
                   help="how far from the baseline the rate must move (default 0.05)")
    p.add_argument("--trials", type=int, default=400,
                   help="windows per row for --price (default 400)")
    p.add_argument("--price", action="store_true",
                   help="price the band at every window size and exit")
    p.add_argument("--psi", action="store_true",
                   help="move the input mix and print the PSI table")
    p.add_argument("--out", default="monitor.json", help="where the verdict JSON goes")
    args = p.parse_args(argv)

    data = load("support")
    base = baseline_pass_rate(data)

    if args.psi:
        print_psi(psi_table(data))
        return 0
    if args.price:
        print_price(price_band(data, sizes=DEFAULT_SIZES,
                               sensitivity=args.sensitivity, trials=args.trials))
        return 0

    # Three verdicts from the same baseline and the same band: one window the
    # monitor is not allowed to have an opinion about, and the two answers it
    # gives once it is.
    small = Monitor(metric="pass rate", baseline=base, n=20, sensitivity=args.sensitivity)
    big = Monitor(metric="pass rate", baseline=base, n=400, sensitivity=args.sensitivity)

    print(f"baseline: {base:.3f} pass over the {TRAFFIC} recorded items, judge "
          f"{JUDGE}, {REPEATS} repeats")
    print(f"  n=20  : half-width {small.half_width:.3f}  {observe(small, base - 0.02)}")
    print(f"  n=400 : half-width {big.half_width:.3f}  {observe(big, base + 0.01)}")
    print(f"  n=400 : half-width {big.half_width:.3f}  {observe(big, base - 0.10)}")
    Path(args.out).write_text(observe(big, base - 0.10).to_json(), encoding="utf-8")
    print(f"wrote {args.out}")
    print()
    print_price(price_band(data, sizes=DEFAULT_SIZES,
                           sensitivity=args.sensitivity, trials=args.trials))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())