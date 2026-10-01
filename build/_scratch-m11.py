"""Throwaway: collect exact numbers for lessons 11.1 and 11.2. Delete when done."""
import sys, json
sys.path.insert(0, "labs/common")

from evallab.dataset import load
from evallab.judge import RecordedJudge, MajorityJudge
from evallab.suite import run_suite, compare
from evallab import confusion, cohens_kappa, wilson, pct, paired_comparison

d = load("support")
print("=== judge labels, raw (not passed through safe()) ===")
for jid in ("c-plain-3b", "c-rubric-3b", "c-rubric-7b"):
    print(repr(d.judge(jid)["label"]), "| model =", d.judge(jid)["model"],
          "| digest field?", "digest" in d.judge(jid) or "version" in d.judge(jid))

print()
print("=== plain judge on dev, sample[0] only (greedy) ===")
r = run_suite(d, RecordedJudge(d, "c-plain-3b"), variant="v1", split="dev")
print(r)
print("confusion:", r.confusion)
print("pass CI: %.4f to %.4f" % r.pass_ci)
print("kappa CI:", r.metrics.ci_of("kappa"))
print("calls:", r.calls, "cost:", r.cost)
print("slices:", [(s.name, s.passed, s.total, s.failures, s.tnr_measurable) for s in r.slices])
print("disagreements:", len(r.disagreements))
from collections import Counter
print("categories:", Counter(c for _, _, _, c in r.disagreements))

print()
print("=== the six disagreements, all of them ===")
for row in r.disagreements:
    print(row)

print()
print("=== rubric judge on dev ===")
rr = run_suite(d, RecordedJudge(d, "c-rubric-3b"), variant="v1", split="dev")
print(rr)
print("confusion:", rr.confusion)
print("kappa CI:", rr.metrics.ci_of("kappa"))
print("pass CI: %.4f to %.4f" % rr.pass_ci)
print("disagreements:", rr.disagreements)

print()
print("=== plain judge on test (37 items) ===")
rt = run_suite(d, RecordedJudge(d, "c-plain-3b"), variant="v1", split="test")
print(rt)

print()
print("=== compare v1 vs v2, rubric judge ===")
c, items = compare(d, RecordedJudge(d, "c-rubric-3b"), "v1", "v2", split="dev")
print(c)

print()
print("=== python confusion from tuples, JS-shaped call would be ===")
ids = d.ids("dev")
pairs = [(d.by_id(i).label("v1"), d.runs["c-plain-3b"][f"{i}|v1"][0]) for i in ids]
print("python confusion(tuples):", confusion(pairs))
# what the JS engine does with the same tuples: p.human is undefined
tn = 0
for p in pairs:
    if p[0] == 1 and p[1] == 1: pass
    else: tn += 1
print("JS confusion(tuples) would be: tp=0 fp=0 fn=0 tn=%d n=%d" % (tn, len(pairs)))

print()
print("=== repeats / threshold ===")
for rep in (1, 2, 3, 5):
    j = MajorityJudge(RecordedJudge(d, "c-plain-3b"), repeats=rep)
    x = run_suite(d, j, variant="v1", split="dev")
    print("repeats", rep, "->", pct(x.pass_rate), "kappa %.2f" % x.metrics.kappa,
          "TPR", pct(x.metrics.tpr), "TNR", pct(x.metrics.tnr))
for th in (0.0, 0.5, 0.67, 1.0):
    j = MajorityJudge(RecordedJudge(d, "c-plain-3b"), repeats=3, threshold=th, use_threshold=True)
    x = run_suite(d, j, variant="v1", split="dev")
    print("threshold", th, "->", pct(x.pass_rate), "kappa %.2f" % x.metrics.kappa,
          "TPR", pct(x.metrics.tpr), "TNR", pct(x.metrics.tnr))

print()
print("=== wilson 38/57 and the pass interval ===")
print(wilson(38, 57))
print(wilson(34, 57))

print()
print("=== corrected pass rate, plain judge on dev ===")
from evallab import corrected_pass_rate
c1 = confusion(pairs)
print("observed", pct(c1.judge_pass_rate), "tpr", pct(c1.tpr), "tnr", pct(c1.tnr))
print(corrected_pass_rate(c1.judge_pass_rate, c1.tpr, c1.tnr))