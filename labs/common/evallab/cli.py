"""The ``evallab`` command line.

``evallab doctor`` is the first thing lesson 11.1 tells a learner to run. It
answers one question — *what can this machine actually do?* — and it answers
it before they hit an error halfway through a lab.
"""

from __future__ import annotations

import argparse
import builtins
import platform
import shutil
import subprocess
import sys

from .dataset import load
from .judge import MajorityJudge, RecordedJudge
from .stats import pct
from .suite import compare, run_suite

OK = "ok      "
NO = "missing "
OPT = "optional"

_REPLACEMENTS = {
    "·": "-", "—": "-", "–": "-", "≥": ">=", "≤": "<=",
    "…": "...", "’": "'", "‘": "'", "“": '"', "”": '"',
    "×": "x", "±": "+/-", "→": "->", " ": " ",
}


def safe(text) -> str:
    """Make text safe to print on a default Windows console.

    The judge labels use a middle dot, which a cp1252 console renders as
    mojibake. A learner should never have to fight their terminal to read a
    pass rate.
    """
    s = str(text)
    for bad, good in _REPLACEMENTS.items():
        s = s.replace(bad, good)
    return s.encode("ascii", "replace").decode("ascii")


def say(*args) -> None:
    builtins.print(*(safe(a) for a in args))


def _doctor() -> int:
    """Report what is available. Never raises; a failing check is data."""
    say(f"Python {platform.python_version()} on {platform.system()} {platform.release()}")
    say("")
    problems = 0

    # 1. Datasets — the only hard requirement.
    try:
        data = load("support")
        say(f"{OK} datasets      support.json: {len(data)} items "
            f"({len(data.dev_ids)} dev / {len(data.test_ids)} test), "
            f"{len(data.judge_menu)} recorded judges")
    except Exception as exc:  # noqa: BLE001 - the message is the point
        say(f"{NO} datasets      {exc}")
        say("")
        say("The labs cannot run without the dataset. It ships in the module zip.")
        return 1

    # 2. The suite itself, end to end, with no model anywhere.
    try:
        result = run_suite(data, RecordedJudge(data, "c-rubric-3b"), variant="v1", split="dev")
        say(f"{OK} suite         {result.suite}: {pct(result.pass_rate)} pass on n={result.n}")
        say(f"               kappa {result.metrics.kappa:.2f}  "
            f"TPR {pct(result.metrics.tpr)}  TNR {pct(result.metrics.tnr)}")
    except Exception as exc:  # noqa: BLE001
        say(f"{NO} suite         {exc}")
        problems += 1

    # 3. Optional: a live local model. No earlier lesson needs it.
    try:
        import ollama  # noqa: F401
        say(f"{OK} live judge    ollama is importable (lesson 11.3)")
    except ImportError:
        say(f"{OPT} live judge    ollama not installed - lessons 11.1, 11.2 and 11.4 do not need it")

    # 4. Optional: Docker, for the pinned judge container.
    if shutil.which("docker"):
        try:
            out = subprocess.run(["docker", "version", "--format", "{{.Server.Version}}"],
                                 capture_output=True, text=True, timeout=8)
            say(f"{OK} docker        {out.stdout.strip()}" if out.returncode == 0
                else f"{OPT} docker        installed but not running - lesson 11.3 only")
        except Exception:  # noqa: BLE001
            say(f"{OPT} docker        installed but not responding - lesson 11.3 only")
    else:
        say(f"{OPT} docker        not on PATH - lesson 11.3 only")

    if problems:
        say("")
        say(f"{problems} required check(s) failed.")
        return 1
    say("")
    say("Everything the required path needs is present. Start with lesson 11.1.")
    return 0


def _run(args) -> int:
    data = load(args.dataset)
    judge = RecordedJudge(data, args.judge)
    if args.repeats > 1 or args.threshold is not None:
        judge = MajorityJudge(
            judge, repeats=args.repeats,
            threshold=args.threshold if args.threshold is not None else 0.5,
            use_threshold=args.threshold is not None,
        )
    result = run_suite(data, judge, variant=args.variant, split=args.split, size=args.n)
    say(f"{result.suite}: {pct(result.pass_rate)} pass on n={result.n}  "
        f"({result.split}, {result.judge})")
    say(f"  kappa {result.metrics.kappa:.2f}   TPR {pct(result.metrics.tpr)}   "
        f"TNR {pct(result.metrics.tnr)}   accuracy {pct(result.metrics.accuracy)}")

    invisible = [s for s in result.slices if not s.tnr_measurable]
    if invisible:
        say("")
        say(f"  {len(invisible)} slice(s) contain no failing items, so their true-negative "
            f"rate is not measurable: {', '.join(s.name.replace('_', ' ') for s in invisible)}")

    if result.disagreements:
        say("")
        say(f"{len(result.disagreements)} disagreement(s). These are the work:")
        for item_id, human, got, cat in result.disagreements[:5]:
            say(f"  {item_id}  human={human} judge={got}  ({cat})")
        if len(result.disagreements) > 5:
            say(f"  ... and {len(result.disagreements) - 5} more")

    if args.compare:
        cmp_result, _ = compare(data, judge, args.variant, args.compare, split=args.split)
        if cmp_result:
            ci = cmp_result.ci
            say("")
            say(f"{args.variant} vs {args.compare}: {cmp_result.delta * 100:+.1f} points "
                f"(95% CI {pct(ci.lo)} to {pct(ci.hi)}), {cmp_result.fixed} fixed, "
                f"{cmp_result.broke} broke, p = {cmp_result.p_value:.3f}")
            if ci.lo < 0 < ci.hi:
                say("  The interval crosses zero: on these items the two systems are not "
                    "distinguishable. That is a result, not a failure to report.")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="evallab", description="Eval Lab, in Python.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("doctor", help="check what this machine can run")

    run = sub.add_parser("run", help="score a recorded judge against the human labels")
    run.add_argument("--dataset", default="support")
    run.add_argument("--judge", default="c-rubric-3b")
    run.add_argument("--variant", default="v1", help="which system output to grade")
    run.add_argument("--compare", default=None, help="a second variant to compare against")
    run.add_argument("--split", default="dev", choices=["dev", "test"])
    run.add_argument("--n", type=int, default=None, help="sample this many items")
    run.add_argument("--repeats", type=int, default=1)
    run.add_argument("--threshold", type=float, default=None,
                     help="probability-weighted threshold, 0 to 1")

    args = ap.parse_args(argv)
    if args.cmd == "doctor":
        return _doctor()
    return _run(args)


if __name__ == "__main__":
    sys.exit(main())
