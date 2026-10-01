"""Lab 2 — close the loop: a production failure becomes a test case.

The failure this lab exists to fix: a production failure gets fixed by hand
once, is never guarded, and comes back. Which it will, because the thing that
went wrong was never an item, and a suite cannot regress on a case it does not
contain.

The loop is three steps and the middle one is the one people skip:

1. **find the failures** in a window of production traces,
2. **label them**, because a production failure nobody labelled is a trace and
   not a test, and
3. **prove the existing suite would now catch it** — not assert that it does,
   run it twice and show the difference.

``evallab.online.regressions_from`` is already written and already correct, and
it is shorter than yours. Step 1 is here anyway, because the trap it documents
is so easy to walk into that every hand-rolled version of it does:

    ``error.type`` lives in a span's **attributes**.

Two TODOs:

    TODO 1: ``failing_traces`` reads the error off the wrong place. There are
            planted failures in the window and this function returns an empty
            list.
    TODO 2: ``suite_labels`` keys on one id namespace, so every failure looks
            brand new — including the ones you have been fixing for months.

Step 3 is written for you, because it is bookkeeping and bookkeeping is not the
exercise: it is there so you can read it and be sure what "the suite would have
caught it" has to mean before you fix step 1.
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

from evallab import (                                       # noqa: E402
    Dataset, Item, RecordedJudge, Regression, TraceStore, load, pct, record,
    run_suite, sample_for_review,
)

JUDGE = "c-rubric-3b"
VARIANT = "v1"
SPLIT = "dev"
WINDOW = 57                 # the dev split, standing in for a day of traffic
FAIL_RATE = 0.15            # a bad week, planted
SEED = 1


# --------------------------------------------------------------------------
# 1. The failures in a window
# --------------------------------------------------------------------------


def failing_traces(traces, human_labels: dict | None = None) -> list:
    """Every production request in this window that failed, as a ``Regression``.

    A request failed when a span carries ``error.type`` — the post-check
    rejecting the answer, or a call that raised.

    TODO 1: this function returns an empty list for every window, including one
            with a bad week planted in it. Run it and find out why.

            The error is an **attribute of the span**, not a key on the span.
            `span["error"]` is None on every span this repository produces, so
            `broken` comes back empty, so this function returns `[]` — and an
            empty list is indistinguishable from a healthy week on every
            dashboard anybody has ever built.

            A monitor that reports zero failures by reading the wrong key is
            worse than no monitor, because it is believed.
    """
    out = []
    for t in traces:
        broken = [s for s in t["spans"] if s.get("error")]
        if not broken:
            continue
        chat = next((s for s in t["spans"] if s["kind"] == "chat"), {})
        attrs = chat.get("attributes", {})
        labels = human_labels or {}
        out.append(Regression(
            item_id=t["trace_id"],
            question=attrs.get("question", ""),
            output=attrs.get("gen_ai.output.messages", ""),
            category=str(broken[0].get("error")),
            why="",
            in_suite=t["trace_id"] in labels,
        ))
    return out


def suite_labels(data, split: str = SPLIT) -> dict:
    """The ids the eval set already holds, so a regression can say so.

    TODO 2: key the suite's items on their own ids and nothing else.

            The tracer mints a trace id from an item id (``s01`` becomes
            ``tr_s01``), so a match on one namespace reads ``False`` for every
            failure on this repository. And every failure here really is an
            item you already have: the shipped ``record`` replays the dev split
            as production traffic. Which is the one thing real traffic never
            does, so the honest answer has to come from a lookup that knows
            about both names.
    """
    return {it.id: it.label(VARIANT) for it in data.items_for(split)}


def a_week_of_traffic(data=None, n: int = WINDOW, fail_rate: float = FAIL_RATE,
                      seed: int = SEED) -> list:
    """One window of production traces, with a bad week planted in it."""
    data = data or load("support")
    return record(data, n=n, split=SPLIT, fail_rate=fail_rate, seed=seed)


def labellable(regs) -> list:
    """The failures you can actually turn into a test case.

    A call that raised has **no answer attached** — there is nothing for a
    human to agree or disagree with, so there is nothing to label. Those are
    traces: they belong in the review queue and in the failure count, and they
    do not belong in the suite, where an item with an empty output and a human
    label on it teaches the judge nothing.

    Every other failure in the window has an answer, and those are the ones the
    loop can carry back.
    """
    return [r for r in regs if r.output and r.question]


# --------------------------------------------------------------------------
# 2. The round trip: a trace becomes an item the suite can load
# --------------------------------------------------------------------------


def as_item(reg, human_label: int = 0, judge_verdict: int = 1) -> dict:
    """One production failure, in the shape ``evallab.dataset.load`` expects.

    ``human_label`` is the part a hand-written test case always leaves out. A
    regression with no label is a log line: it gets argued about again next
    quarter instead of being fixed once. ``judge_verdict`` is what the online
    judge actually said about that request — which is very often *wrong*, and
    that is why it shipped.
    """
    return reg.as_test_case(human_label=human_label, judge_verdict=judge_verdict)


def with_item(data: Dataset, item: dict, judge_verdict: int = 1,
              repeats: int | None = None) -> Dataset:
    """The shipped suite with one production failure added to it.

    The recorded run travels with the item. That is not a shortcut: it is the
    whole loop. The online judge already ran on that request — it ran, and it
    said the answer was fine, which is why the failure shipped — so the verdict
    is a measurement somebody actually made, and the suite can reuse it rather
    than paying for it twice.
    """
    extra = Item(id=item["id"], outputs=item["outputs"], human=item["human"],
                 slice=item.get("slice"), question=item.get("question", ""))
    runs = {judge: dict(table) for judge, table in (data.runs or {}).items()}
    n = repeats if repeats is not None else max(1, data.repeats)
    for judge in runs:
        runs[judge][f"{extra.id}|{VARIANT}"] = [judge_verdict] * n
    return Dataset(
        name=data.name, title=data.title,
        items=[*data.items_for(SPLIT), extra],
        dev_ids=[*data.dev_ids, extra.id],
        test_ids=list(data.test_ids),
        variants=list(data.variants), judge_menu=data.judge_menu,
        runs=runs, repeats=data.repeats, cost=data.cost,
    )


def _summary(result) -> dict:
    """The four numbers that move when an item is added, and nothing else."""
    c = result.confusion
    return {"n": result.n, "tp": c.tp, "fp": c.fp, "fn": c.fn, "tn": c.tn,
            "tnr": c.tnr, "kappa": c.kappa, "pass_rate": result.pass_rate}


@dataclass
class Catch:
    """What the suite said before, what it says now, and by how much."""

    item_id: str
    before: dict
    after: dict
    named: bool

    @property
    def caught(self) -> bool:
        """The suite did not have this failure, and now it names it.

        Not "the numbers moved". The numbers move for a hundred reasons; the
        item appearing by name in the disagreement list is the claim somebody
        can go and check in the morning.
        """
        return self.named and self.after["fp"] > self.before["fp"]

    def report(self) -> str:
        b, a = self.before, self.after
        return (f"  {self.item_id} : suite n={b['n']} -> {a['n']}, "
                f"tn={b['tn']} -> {a['tn']}, fp={b['fp']} -> {a['fp']}, "
                f"TNR {pct(b['tnr'])} -> {pct(a['tnr'])}\n"
                f"  {'':>14} named in the disagreement list: "
                f"{'yes' if self.named else 'NO'}"
                f"   caught: {'yes' if self.caught else 'NO'}")

    def to_json(self) -> str:
        return json.dumps({"item_id": self.item_id, "caught": self.caught,
                           "named": self.named, "before": self.before,
                           "after": self.after}, indent=2)


def caught_by_suite(data, reg, human_label: int = 0, judge_verdict: int = 1,
                    split: str = SPLIT) -> Catch:
    """Run the suite twice and show what one new item does to it.

    This is the exercise. Not "add the test case" — everybody can do that — but
    **prove the suite would have caught it**, by running the suite the item was
    never in and the suite the item is in, on the same recorded judge, and
    putting both numbers next to each other.
    """
    item = as_item(reg, human_label, judge_verdict)
    before = run_suite(data, RecordedJudge(data, JUDGE), VARIANT, split=split, seed=7)
    grown = with_item(data, item, judge_verdict)
    after = run_suite(grown, RecordedJudge(grown, JUDGE), VARIANT, split=split, seed=7)
    named = item["id"] in {d[0] for d in after.disagreements}
    return Catch(item_id=item["id"], before=_summary(before), after=_summary(after),
                 named=named)


# --------------------------------------------------------------------------
# 3. Sampling that keeps the failures
# --------------------------------------------------------------------------


def review_queue(traces) -> list:
    """The rows an online eval samples from: one per request.

    Two fields, and both of them are load-bearing. ``id`` is what the sampler
    hashes, so the sample is the same sample every time and a dip is a dip
    rather than a different draw. ``error`` is what the keep-rule looks at, so
    a failure is never the thing that got thinned away.
    """
    return [{"id": t["trace_id"],
             "error": any(s.get("attributes", {}).get("error.type")
                          for s in t["spans"])}
            for t in traces]


def sample_report(data=None, rates=(1.0, 0.5, 0.25, 0.05),
                  fail_rate: float = 0.10, n: int = WINDOW,
                  split: str = SPLIT, seed: int = SEED) -> list:
    """Drop the volume. Keep every failure. Watch what that does to the rate.

    The numerator holds at every sample rate and the reported rate climbs,
    because the denominator is the sample rather than the traffic. Both numbers
    are true and neither is an estimate of the other: ``5/57`` estimates the
    failure rate of the traffic; ``5/9`` is a count over a set that was *chosen*
    because it contains the failures.
    """
    data = data or load("support")
    full = record(data, n=n, split=split, fail_rate=fail_rate, sample_rate=1.0, seed=seed)
    queue = review_queue(full)
    rows = []
    for rate in rates:
        traced = record(data, n=n, split=split, fail_rate=fail_rate,
                        sample_rate=rate, seed=seed)
        chat = TraceStore.from_traces(traced).error_rate().get("chat", {})
        kept = sample_for_review(queue, rate)
        kept_bad = sum(1 for q in kept if q["error"])
        rows.append({
            "rate": rate,
            "requests": n,
            "traces": len(traced),
            "chat_errors": chat.get("errors", 0),
            "chat_rate": chat.get("rate", 0.0),
            "queue": len(kept),
            "queue_failures": kept_bad,
            "queue_rate": kept_bad / len(kept) if kept else 0.0,
            "failures_planted": sum(1 for q in queue if q["error"]),
        })
    return rows


def print_sample(rows) -> None:
    print(f"{'sample rate':>12} {'traced':>9} {'errors kept':>13} "
          f"{'reported rate':>14} {'in the review queue':>22}")
    for r in rows:
        print(f"{r['rate']:>11.0%} {r['traces']:>6} of {r['requests']:<3} "
              f"{r['chat_errors']:>13} {pct(r['chat_rate']):>14} "
              f"{r['queue_failures']:>11} of {r['queue']:<10}")


# --------------------------------------------------------------------------
# The run
# --------------------------------------------------------------------------


def main(argv=None) -> int:
    import argparse
    p = argparse.ArgumentParser(description="Close the loop, and price the sample.")
    p.add_argument("--fail-rate", type=float, default=FAIL_RATE,
                   help="the bad week planted in the window (default 0.15)")
    p.add_argument("--sample-fail-rate", type=float, default=0.10,
                   help="the failure rate planted for the sampling table (default 0.10)")
    p.add_argument("--sample", action="store_true",
                   help="price the sampled stream and exit")
    p.add_argument("--out", default="loop.json", help="where the round trip JSON goes")
    args = p.parse_args(argv)

    data = load("support")
    if args.sample:
        print_sample(sample_report(data, fail_rate=args.sample_fail_rate))
        return 0

    traces = a_week_of_traffic(data, fail_rate=args.fail_rate)
    regs = failing_traces(traces, suite_labels(data))
    print(f"{len(regs)} failing request(s) in a window of {len(traces)}, "
          f"{len(regs) / len(traces):.1%} of traffic, "
          f"{sum(1 for r in regs if r.in_suite)} of them already in the suite")
    print("  (the shipped record() replays the dev split as traffic, so every one "
          "of them\n   is an item you already have. Real production traffic is the "
          "half of this\n   exercise that is not a simulation, and it is the half "
          "worth writing down.)")
    if not regs:
        print("no failures found. Look at failing_traces before you read on: an "
              "empty list is the shape of a healthy week and it is not one.")
        return 1

    by_category: dict = {}
    for r in regs:
        by_category[r.category] = by_category.get(r.category, 0) + 1
    for name, count in sorted(by_category.items(), key=lambda kv: -kv[1]):
        print(f"  {count:>3}  {name}")

    print("\nthe first one, carried back into the suite:")
    carried = labellable(regs)
    if not carried:
        print("  nothing in this window has an answer attached, so there is nothing "
              "to label.\n  A raised call is a trace; the loop needs an answer.")
        return 1
    print(f"  {len(carried)} of the {len(regs)} have an answer a human can label; "
          f"the other\n  {len(regs) - len(carried)} are calls that raised, and there is "
          f"nothing to label on those.")
    reg = carried[0]
    item = as_item(reg)
    print(f"  {reg.item_id}  {reg.category}  question: {reg.question[:52]!r}")
    print(f"  human label {item['human']['v1']['label']} (a human read it and said "
          f"this is wrong), judge verdict 1 (the online judge said it was fine)")
    catch = caught_by_suite(data, reg)
    print(catch.report())
    Path(args.out).write_text(catch.to_json(), encoding="utf-8")
    print(f"wrote {args.out}")

    print("\nand the sample that decides how many of those you get to see:")
    print_sample(sample_report(data, fail_rate=args.sample_fail_rate))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())