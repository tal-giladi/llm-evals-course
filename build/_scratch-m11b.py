"""Throwaway: held-out numbers for lesson 11.1. Delete when done."""
import sys
sys.path.insert(0, "labs/common")
from evallab.dataset import load
from evallab.judge import RecordedJudge, MajorityJudge
from evallab.suite import run_suite, compare
from evallab import confusion, cohens_kappa, wilson, pct, corrected_pass_rate

d = load("support")
for jid in ("c-plain-3b", "c-rubric-3b"):
    for split in ("dev", "test"):
        r = run_suite(d, RecordedJudge(d, jid), variant="v1", split=split)
        ci = r.metrics.ci_of("kappa")
        print(f"{jid:12} {split:4} n={r.n} pass={pct(r.pass_rate)} "
              f"[{pct(r.pass_ci[0])}-{pct(r.pass_ci[1])}] kappa={r.metrics.kappa:.2f} "
              f"[{pct(ci.lo)}-{pct(ci.hi)}] TPR={pct(r.metrics.tpr)} TNR={pct(r.metrics.tnr)} "
              f"acc={pct(r.metrics.accuracy)} conf={r.confusion} disagree={len(r.disagreements)} "
              f"cost=${r.cost:.4f} calls={r.calls}")
        c = r.confusion
        print("    corrected pass rate:", corrected_pass_rate(c.judge_pass_rate, c.tpr, c.tnr))

print()
print("=== the same comparison under both judges, both splits ===")
for jid in ("c-plain-3b", "c-rubric-3b"):
    for split in ("dev", "test"):
        c, _ = compare(d, RecordedJudge(d, jid), "v1", "v2", split=split)
        print(f"{jid:12} {split:4} delta={c.delta*100:+.1f}pts CI {pct(c.ci.lo)} to {pct(c.ci.hi)} "
              f"fixed={c.fixed} broke={c.broke} ties={c.ties} p={c.p_value:.3f}")

print()
print("=== cost of one dev run, plain judge ===")
r = run_suite(d, RecordedJudge(d, "c-plain-3b"), variant="v1", split="dev")
print("calls", r.calls, "cost", r.cost)
print("per-judge cost table entry:", d.cost["c-plain-3b"])