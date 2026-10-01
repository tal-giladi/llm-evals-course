"""Lab 1 — solution.

The shape is the same as the starter; only the three TODOs are filled in.
Notice that "unmeasurable_slices" is reported rather than filtered out.
Dropping those slices makes the report shorter and the numbers look better
and the system is worse.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

from evallab import RecordedJudge, load, run_suite, pct


def build_report(dataset: str = "support", judge_id: str = "c-rubric-3b",
                 variant: str = "v1", split: str = "dev") -> dict:
    data = load(dataset)
    judge = RecordedJudge(data, judge_id)

    # --- 0: refuse to score a variant nobody labelled --------------------
    # `Item.label` returns 0 for a variant it has no entry for, so a missing
    # label set does not raise. It grades the judge against a wall of zeros
    # and produces a report in which the pass rate is real and every
    # agreement figure is manufactured. A missing measurement is not a
    # failure, and this check is what keeps the two apart.
    population = data.items_for(split)
    unlabelled = [i.id for i in population if variant not in i.human]
    if unlabelled:
        return {
            "judge": judge.label,
            "variant": variant,
            "split": split,
            "refused": True,
            "error": (
                f"no human labels for variant {variant!r} on "
                f"{len(unlabelled)} of {len(population)} items. The judge "
                "verdicts are recorded, so the pass rate would be real and "
                "the agreement figures would be invented. Refusing is the "
                "only honest answer until the labels exist."
            ),
            "n": 0,
        }

    result = run_suite(data, judge, variant=variant, split=split)

    # --- 1: the headline numbers, always with the sample size ----------
    report = {
        "judge": result.judge,
        "variant": variant,
        "split": split,
        "n": result.n,
        "variant": variant,
        "confusion": {
            "tp": result.confusion.tp, "fp": result.confusion.fp,
            "fn": result.confusion.fn, "tn": result.confusion.tn,
        },
        "pass_rate": result.pass_rate,
        "pass_ci": [result.pass_ci[0], result.pass_ci[1]],
        "agreement": {
            "tpr": result.metrics.tpr,
            "tnr": result.metrics.tnr,
            "kappa": result.metrics.kappa,
            "n": result.n,
        },
    }

    # --- 2: the disagreements, flat and grouped -------------------------
    report["disagreements"] = [
        {"id": item_id, "human": human, "judge": got, "category": cat}
        for item_id, human, got, cat in result.disagreements
    ]
    report["disagreements_by_category"] = dict(
        sorted(Counter(row["category"] for row in report["disagreements"]).items())
    )

    # --- 3: the slices you cannot measure, named -------------------------
    # Reported, not filtered. A slice with no failing items contributes
    # nothing to the true-negative rate, so hiding it makes the judge look
    # better than it is on exactly that population.
    report["unmeasurable_slices"] = sorted(
        s.name for s in result.slices if not s.tnr_measurable
    )
    return report


def summarise(report: dict) -> str:
    a = report["agreement"]
    tail = ""
    if report["unmeasurable_slices"]:
        tail = (f"; TNR not measurable on {len(report['unmeasurable_slices'])} "
                f"slice(s) with no failing items")
    return (
        f"{pct(report['pass_rate'])} pass on n={report['n']} "
        f"({pct(report['pass_ci'][0])}-{pct(report['pass_ci'][1])}), "
        f"judge {report['judge']}"
    ) + (
        f" | kappa {a['kappa']:.2f}, TPR {pct(a['tpr'])}, TNR {pct(a['tnr'])}"
        f"{tail} | {len(report['disagreements'])} open disagreement(s)"
    )


def main(argv=None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    report = build_report(*argv) if argv else build_report()
    out = Path("report.json")
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(summarise(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


