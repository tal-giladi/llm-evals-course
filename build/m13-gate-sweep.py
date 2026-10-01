import sys; sys.path.insert(0, "labs/common")
from evallab import load, RecordedJudge
from evallab.gate import run_gate
d = load("support"); j = RecordedJudge(d, "c-rubric-3b")
items = d.items_for("dev")
base = [(it.label("v1"), j.samples(it, "v1")[0]) for it in items]
print(f"n={len(items)}  tolerance=5 points  repeats=3")
print("broken  delta    ci                  blocked  reason head")
for k in (0, 2, 4, 6, 8, 10, 12, 15, 20):
    broken = {it.id for it in items[:k]}
    cand = [(it.label("v1"), 0 if it.id in broken else j.samples(it, "v1")[0]) for it in items]
    g = run_gate(base, cand, tolerance=0.05, repeats=3)
    ci = "-" if g.ci is None else f"({g.ci[0]*100:6.1f},{g.ci[1]*100:6.1f})"
    print(f"{k:5d}  {g.delta*100:+6.1f}  {ci}  {str(g.blocked):7s}  {g.reason[:58]}")
